/**
 * GeoDraw Multiplayer Cloud Functions
 * 
 * Functions for lobby management and game state synchronization
 */

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

// Initialize Firebase Admin
admin.initializeApp()
const db = admin.firestore()

// ============================================
// TYPES
// ============================================

interface LobbyPlayer {
    id: string
    nickname: string
    color: string
    ready: boolean
    isHost: boolean
    joinedAt: number
    countryCode?: string
}

interface LobbySpectator {
    id: string
    nickname: string
    joinedAt: number
}

interface Lobby {
    code: string
    hostId: string
    hostNickname: string
    createdAt: admin.firestore.Timestamp
    status: 'waiting' | 'starting' | 'in_game' | 'finished'
    maxPlayers: number
    players: LobbyPlayer[]
    spectators: LobbySpectator[]
    gameSettings: {
        aiCountries: boolean
        startingResources: 'low' | 'medium' | 'high'
        mapRegion: string
    }
    gameId?: string
    allowLateJoin?: boolean
}

interface GamePlayer {
    id: string
    nickname: string
    color: string
    countryCode?: string  // Assigned country
    territory?: object    // GeoJSON
    resources: {
        budget: number
        soldiers: number
        power: number
    }
    isAlive: boolean
}

interface GameState {
    id: string
    lobbyCode: string
    startedAt: admin.firestore.Timestamp
    lastTick: admin.firestore.Timestamp
    tickNumber: number
    gameDate: number  // In-game timestamp
    status: 'initializing' | 'active' | 'paused' | 'finished'
    players: { [playerId: string]: GamePlayer }
    spectators: LobbySpectator[]
    aiCountries: { [code: string]: object }  // AI state
    wars: object[]
    events: object[]
    winner?: string
}

// Player colors
const PLAYER_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
]

// ============================================
// CONSTANTS
// ============================================

const NICKNAME_MIN_LENGTH = 2
const NICKNAME_MAX_LENGTH = 20
const MAX_PLAYERS_PER_LOBBY = 8
const STALE_LOBBY_MS = 24 * 60 * 60 * 1000 // 24 hours
const LOBBY_CREATE_COOLDOWN_MS = 10_000 // 10s between lobby creations per user
const MAX_ACTION_PAYLOAD_BYTES = 10_000 // 10KB
const VALID_ACTION_TYPES = ['CLAIM_TERRITORY', 'DECLARE_WAR', 'DRAW_ARROW'] as const
const INITIAL_RESOURCES = { budget: 1_000_000, soldiers: 10_000, power: 100 }

// Generate random lobby code
function generateLobbyCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

function isValidNickname(nickname: unknown): nickname is string {
    return typeof nickname === 'string'
        && nickname.trim().length >= NICKNAME_MIN_LENGTH
        && nickname.length <= NICKNAME_MAX_LENGTH
}

function isValidLobbyCode(code: unknown): code is string {
    return typeof code === 'string' && /^[A-Z0-9]{6}$/.test(code.toUpperCase())
}

// Any error that isn't already an HttpsError (a Firestore internal error, a
// thrown TypeError, etc.) used to propagate to the client as a raw,
// unstructured error message. Normalize it into a generic HttpsError instead
// so callers always get a predictable shape, and log the real cause server-side.
function rethrowAsHttpsError(e: unknown): never {
    if (e instanceof functions.https.HttpsError) throw e
    console.error('Unexpected error:', e)
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred')
}

// Simple per-user cooldown to stop a single anonymous session from spamming
// an expensive action (e.g. createLobby, which also does a code-collision
// read) in a tight loop. Stored outside firestore.rules' reach since this
// collection is only ever touched by Admin SDK code here, never the client.
async function checkAndUpdateRateLimit(uid: string, action: string, cooldownMs: number): Promise<void> {
    const rateLimitRef = db.collection('rateLimits').doc(`${uid}_${action}`)
    const rateLimitDoc = await rateLimitRef.get()
    const now = Date.now()
    const lastAt = rateLimitDoc.data()?.lastAt as number | undefined
    if (lastAt && now - lastAt < cooldownMs) {
        throw new functions.https.HttpsError('resource-exhausted', 'Please wait a moment before trying again')
    }
    await rateLimitRef.set({ lastAt: now })
}

// ============================================
// LOBBY FUNCTIONS
// ============================================

/**
 * Create a new multiplayer lobby
 */
export const createLobby = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        // Require authentication
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
        }

        const { nickname } = data
        if (!isValidNickname(nickname)) {
            throw new functions.https.HttpsError('invalid-argument', `Nickname must be ${NICKNAME_MIN_LENGTH}-${NICKNAME_MAX_LENGTH} characters`)
        }

        const hostId = context.auth.uid
        await checkAndUpdateRateLimit(hostId, 'createLobby', LOBBY_CREATE_COOLDOWN_MS)

        const hostPlayer: LobbyPlayer = {
            id: hostId,
            nickname: nickname.trim(),
            color: PLAYER_COLORS[0],
            ready: true,
            isHost: true,
            joinedAt: Date.now()
        }

        try {
            // Generate a unique code and create the lobby atomically. A plain
            // get-then-set here would let two concurrent calls both pass the
            // exists-check for the same code, and one .set() would silently
            // clobber the other. transaction.create() fails (and the whole
            // transaction auto-retries) if the doc already exists by commit
            // time, closing that race.
            const code = await db.runTransaction(async (transaction) => {
                for (let attempts = 0; attempts < 10; attempts++) {
                    const candidate = generateLobbyCode()
                    const candidateRef = db.collection('lobbies').doc(candidate)
                    const existing = await transaction.get(candidateRef)
                    if (existing.exists) continue

                    const lobby: Omit<Lobby, 'createdAt'> & { createdAt: admin.firestore.FieldValue } = {
                        code: candidate,
                        hostId,
                        hostNickname: nickname.trim(),
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        status: 'waiting',
                        maxPlayers: MAX_PLAYERS_PER_LOBBY,
                        players: [hostPlayer],
                        spectators: [],
                        gameSettings: {
                            aiCountries: true,
                            startingResources: 'medium',
                            mapRegion: 'world'
                        }
                    }
                    transaction.create(candidateRef, lobby)
                    return candidate
                }
                throw new functions.https.HttpsError('resource-exhausted', 'Could not generate a unique lobby code, please try again')
            })

            console.log(`🎮 Lobby created: ${code} by ${nickname}`)
            return { code }
        } catch (e) {
            rethrowAsHttpsError(e)
        }
    })

/**
 * Join an existing lobby
 */
export const joinLobby = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
        }

        const { code, nickname } = data
        const asSpectator = data.asSpectator === true
        if (!isValidLobbyCode(code)) {
            throw new functions.https.HttpsError('invalid-argument', 'Valid 6-character code required')
        }
        if (!isValidNickname(nickname)) {
            throw new functions.https.HttpsError('invalid-argument', `Nickname must be ${NICKNAME_MIN_LENGTH}-${NICKNAME_MAX_LENGTH} characters`)
        }

        const playerId = context.auth.uid
        const lobbyRef = db.collection('lobbies').doc(code.toUpperCase())

        try {
            return await db.runTransaction(async (transaction) => {
            const lobbyDoc = await transaction.get(lobbyRef)

            if (!lobbyDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Lobby not found')
            }

            const lobby = lobbyDoc.data() as Lobby

            if (lobby.status !== 'waiting') {
                // If game started, check if late join is allowed
                const isGameActive = lobby.status === 'in_game' || lobby.status === 'starting'
                if (!isGameActive || !lobby.allowLateJoin) {
                    throw new functions.https.HttpsError('failed-precondition', 'Game already started')
                }
            }

            // Check if already in lobby
            if (lobby.players.some(p => p.id === playerId)) {
                return { success: true, alreadyJoined: true }
            }

            if (asSpectator) {
                const spectator: LobbySpectator = {
                    id: playerId,
                    nickname: nickname.trim(),
                    joinedAt: Date.now()
                }
                transaction.update(lobbyRef, {
                    spectators: admin.firestore.FieldValue.arrayUnion(spectator)
                })
            } else {
                if (lobby.players.length >= lobby.maxPlayers) {
                    throw new functions.https.HttpsError('resource-exhausted', 'Lobby is full')
                }

                // Assign unused color
                const usedColors = lobby.players.map(p => p.color)
                const availableColor = PLAYER_COLORS.find(c => !usedColors.includes(c)) || PLAYER_COLORS[0]

                const newPlayer: LobbyPlayer = {
                    id: playerId,
                    nickname: nickname.trim(),
                    color: availableColor,
                    ready: false,
                    isHost: false,
                    joinedAt: Date.now()
                }

                transaction.update(lobbyRef, {
                    players: admin.firestore.FieldValue.arrayUnion(newPlayer)
                })

                // If game is already active, add player to game state as well
                if (lobby.gameId && (lobby.status === 'in_game' || lobby.status === 'starting')) {
                    const gameRef = db.collection('games').doc(lobby.gameId)
                    const gameDoc = await transaction.get(gameRef)

                    if (gameDoc.exists) {
                        const newGamePlayer: GamePlayer = {
                            id: playerId,
                            nickname: nickname.trim(),
                            color: availableColor,
                            resources: { ...INITIAL_RESOURCES },
                            isAlive: true
                        }

                        transaction.update(gameRef, {
                            [`players.${playerId}`]: newGamePlayer
                        })
                        console.log(`🎮 Added late joiner ${nickname} to game ${lobby.gameId}`)
                    }
                }
            }

                console.log(`👤 Player joined lobby ${code}: ${nickname}`)
                return { success: true }
            })
        } catch (e) {
            rethrowAsHttpsError(e)
        }
    })

/**
 * Start the game (host only)
 */
export const startGame = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
        }

        const { lobbyCode } = data
        if (!isValidLobbyCode(lobbyCode)) {
            throw new functions.https.HttpsError('invalid-argument', 'Valid 6-character lobby code required')
        }

        const hostId = context.auth.uid
        const lobbyRef = db.collection('lobbies').doc(lobbyCode)

        try {
            return await db.runTransaction(async (transaction) => {
            const lobbyDoc = await transaction.get(lobbyRef)

            if (!lobbyDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Lobby not found')
            }

            const lobby = lobbyDoc.data() as Lobby

            if (lobby.hostId !== hostId) {
                throw new functions.https.HttpsError('permission-denied', 'Only host can start game')
            }

            if (lobby.status !== 'waiting') {
                throw new functions.https.HttpsError('failed-precondition', 'Game already started')
            }

            // Check all players ready
            const allReady = lobby.players.every(p => p.ready || p.isHost)
            if (!allReady) {
                throw new functions.https.HttpsError('failed-precondition', 'Not all players are ready')
            }

            // Generate game ID
            const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

            // Initialize player game state
            const gamePlayers: { [id: string]: GamePlayer } = {}
            lobby.players.forEach(p => {
                gamePlayers[p.id] = {
                    id: p.id,
                    nickname: p.nickname,
                    color: p.color,
                    countryCode: p.countryCode,
                    resources: { ...INITIAL_RESOURCES },
                    isAlive: true
                }
            })

            // Create game document
            const gameState: Omit<GameState, 'startedAt' | 'lastTick'> & {
                startedAt: admin.firestore.FieldValue
                lastTick: admin.firestore.FieldValue
            } = {
                id: gameId,
                lobbyCode,
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastTick: admin.firestore.FieldValue.serverTimestamp(),
                tickNumber: 0,
                gameDate: Date.now(),
                status: 'active',
                players: gamePlayers,
                spectators: lobby.spectators,
                aiCountries: {},
                wars: [],
                events: []
            }

            const gameRef = db.collection('games').doc(gameId)
            transaction.set(gameRef, gameState)

            // Update lobby
            transaction.update(lobbyRef, {
                status: 'in_game',
                gameId
            })

                console.log(`🎮 Game started: ${gameId} with ${lobby.players.length} players`)
                return { gameId }
            })
        } catch (e) {
            rethrowAsHttpsError(e)
        }
    })

// ============================================
// GAME STATE FUNCTIONS
// ============================================

/**
 * Submit a player action (territory claim, war declaration, etc.)
 *
 * NOT CURRENTLY CALLED FROM THE CLIENT. src/firebase/actions.ts's sendAction()
 * writes directly to Firestore instead, with a DIFFERENT, incompatible shape:
 * {type, playerId, payload, createdAt, status: 'pending'|'processed'|'failed'}
 * vs. this function's {playerId, actionType, payload, timestamp, processed:
 * boolean}. The client-side host loop (useHostActions.ts) only ever queries
 * status == 'pending', so an action submitted through THIS function would be
 * invisible to it. If this is ever wired up client-side, unify the schema
 * with src/firebase/actions.ts first.
 */
export const submitAction = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
        }

        const { gameId, actionType, payload } = data
        if (!gameId || typeof gameId !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'Game ID required')
        }
        if (!VALID_ACTION_TYPES.includes(actionType)) {
            throw new functions.https.HttpsError('invalid-argument', `actionType must be one of: ${VALID_ACTION_TYPES.join(', ')}`)
        }
        if (payload !== undefined) {
            if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
                throw new functions.https.HttpsError('invalid-argument', 'payload must be a plain object')
            }
            const payloadSize = Buffer.byteLength(JSON.stringify(payload), 'utf8')
            if (payloadSize > MAX_ACTION_PAYLOAD_BYTES) {
                throw new functions.https.HttpsError('invalid-argument', `payload too large (max ${MAX_ACTION_PAYLOAD_BYTES} bytes)`)
            }
        }

        const playerId = context.auth.uid
        const gameRef = db.collection('games').doc(gameId)
        const actionsRef = db.collection('games').doc(gameId).collection('actions')

        try {
            // Validate game exists and player is in it
            const gameDoc = await gameRef.get()
            if (!gameDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Game not found')
            }

            const game = gameDoc.data() as GameState
            if (!game.players[playerId]) {
                throw new functions.https.HttpsError('permission-denied', 'Not a player in this game')
            }

            if (game.status !== 'active') {
                throw new functions.https.HttpsError('failed-precondition', 'Game is not active')
            }

            // Store action (will be processed by game tick)
            const action = {
                playerId,
                actionType,
                payload,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                processed: false
            }

            const actionDoc = await actionsRef.add(action)
            console.log(`📤 Action submitted: ${actionType} by ${playerId}`)

            return { actionId: actionDoc.id }
        } catch (e) {
            rethrowAsHttpsError(e)
        }
    })

/**
 * DISABLED - this scheduled function ran every minute, querying every active
 * game plus its actions subcollection, for functionally zero effect: the
 * CLAIM_TERRITORY and DECLARE_WAR cases were empty // TODO stubs, and the
 * tickNumber/gameDate it advanced here are never read by the client (the
 * client's own useGameLoop.ts is the actual authoritative tick, running
 * locally on the host's browser). That's real Firestore read/write quota
 * spent every minute, for every active game, for no simulation value.
 *
 * It also processes actions via the {actionType, processed: boolean} schema,
 * which - see the note on submitAction above - nothing client-side ever
 * writes, so even the "mark processed" bookkeeping had nothing to do.
 *
 * Re-enable only once there's a real reason for server-authoritative
 * simulation, and only after reconciling this schema with the client's
 * {type, status} one in src/firebase/actions.ts.
 *
 * export const processGameTick = functions
 *     .region('europe-west1')
 *     .pubsub.schedule('every 1 minutes')
 *     .onRun(async () => {
 *         const activeGames = await db.collection('games')
 *             .where('status', '==', 'active')
 *             .get()
 *
 *         if (activeGames.empty) {
 *             return null
 *         }
 *
 *         const batch = db.batch()
 *         const now = admin.firestore.Timestamp.now()
 *
 *         for (const gameDoc of activeGames.docs) {
 *             const game = gameDoc.data() as GameState
 *             const gameRef = gameDoc.ref
 *
 *             const actionsSnapshot = await gameRef.collection('actions')
 *                 .where('processed', '==', false)
 *                 .orderBy('timestamp')
 *                 .limit(100)
 *                 .get()
 *
 *             for (const actionDoc of actionsSnapshot.docs) {
 *                 const action = actionDoc.data()
 *
 *                 switch (action.actionType) {
 *                     case 'CLAIM_TERRITORY':
 *                         // TODO: Validate territory, check overlaps, update player territory
 *                         break
 *                     case 'DECLARE_WAR':
 *                         break
 *                     case 'DRAW_ARROW':
 *                         break
 *                     default:
 *                         console.log(`Unknown action type: ${action.actionType}`)
 *                 }
 *
 *                 batch.update(actionDoc.ref, { processed: true })
 *             }
 *
 *             const newTickNumber = game.tickNumber + 1
 *             const newGameDate = game.gameDate + (24 * 60 * 60 * 1000)
 *
 *             batch.update(gameRef, {
 *                 tickNumber: newTickNumber,
 *                 gameDate: newGameDate,
 *                 lastTick: now
 *             })
 *         }
 *
 *         await batch.commit()
 *         return null
 *     })
 */

// ============================================
// CLEANUP FUNCTIONS
// ============================================

/**
 * Clean up stale lobbies (older than 24 hours)
 */
export const cleanupLobbies = functions
    .region('europe-west1')
    .pubsub.schedule('every 1 hours')
    .onRun(async () => {
        const staleThreshold = admin.firestore.Timestamp.fromMillis(Date.now() - STALE_LOBBY_MS)

        try {
            const staleLobbies = await db.collection('lobbies')
                .where('createdAt', '<', staleThreshold)
                .where('status', '==', 'waiting')
                .get()

            const batch = db.batch()
            staleLobbies.docs.forEach(doc => {
                batch.delete(doc.ref)
            })

            if (!staleLobbies.empty) {
                await batch.commit()
                console.log(`🧹 Cleaned up ${staleLobbies.size} stale lobbies`)
            }
        } catch (e) {
            console.error('cleanupLobbies failed:', e)
        }

        return null
    })

// onPlayerLeave (a Firestore trigger on players/{playerId} delete) was
// removed: nothing client-side ever deletes a players/{id} doc (that doc is
// the player's persistent profile/nickname, only ever setDoc'd in
// src/firebase/auth.ts - deleting it just because someone left one lobby
// would have been wrong anyway). Leaving a lobby is already handled directly
// by src/firebase/lobby.ts's leaveLobby(), which this trigger duplicated
// with no caller of its own.
