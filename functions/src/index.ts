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

// Generate random lobby code
function generateLobbyCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
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
        if (!nickname || typeof nickname !== 'string' || nickname.length < 2) {
            throw new functions.https.HttpsError('invalid-argument', 'Valid nickname required')
        }

        const hostId = context.auth.uid

        // Generate unique code
        let code = generateLobbyCode()
        let attempts = 0
        while (attempts < 10) {
            const existing = await db.collection('lobbies').doc(code).get()
            if (!existing.exists) break
            code = generateLobbyCode()
            attempts++
        }

        const hostPlayer: LobbyPlayer = {
            id: hostId,
            nickname: nickname.trim(),
            color: PLAYER_COLORS[0],
            ready: true,
            isHost: true,
            joinedAt: Date.now()
        }

        const lobby: Omit<Lobby, 'createdAt'> & { createdAt: admin.firestore.FieldValue } = {
            code,
            hostId,
            hostNickname: nickname.trim(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'waiting',
            maxPlayers: 8,
            players: [hostPlayer],
            spectators: [],
            gameSettings: {
                aiCountries: true,
                startingResources: 'medium',
                mapRegion: 'world'
            }
        }

        await db.collection('lobbies').doc(code).set(lobby)

        console.log(`🎮 Lobby created: ${code} by ${nickname}`)
        return { code }
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

        const { code, nickname, asSpectator } = data
        if (!code || typeof code !== 'string' || code.length !== 6) {
            throw new functions.https.HttpsError('invalid-argument', 'Valid 6-character code required')
        }
        if (!nickname || typeof nickname !== 'string' || nickname.length < 2) {
            throw new functions.https.HttpsError('invalid-argument', 'Valid nickname required')
        }

        const playerId = context.auth.uid
        const lobbyRef = db.collection('lobbies').doc(code.toUpperCase())

        return db.runTransaction(async (transaction) => {
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
                            resources: {
                                budget: 1000000,
                                soldiers: 10000,
                                power: 100
                            },
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
        if (!lobbyCode) {
            throw new functions.https.HttpsError('invalid-argument', 'Lobby code required')
        }

        const hostId = context.auth.uid
        const lobbyRef = db.collection('lobbies').doc(lobbyCode)

        return db.runTransaction(async (transaction) => {
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
                    resources: {
                        budget: 1000000,
                        soldiers: 10000,
                        power: 100
                    },
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
    })

// ============================================
// GAME STATE FUNCTIONS
// ============================================

/**
 * Submit a player action (territory claim, war declaration, etc.)
 */
export const submitAction = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
        }

        const { gameId, actionType, payload } = data
        if (!gameId || !actionType) {
            throw new functions.https.HttpsError('invalid-argument', 'Game ID and action type required')
        }

        const playerId = context.auth.uid
        const gameRef = db.collection('games').doc(gameId)
        const actionsRef = db.collection('games').doc(gameId).collection('actions')

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
    })

/**
 * Game tick processor - scheduled to run every 5 seconds
 * Processes all pending actions and updates game state
 */
export const processGameTick = functions
    .region('europe-west1')
    .pubsub.schedule('every 1 minutes')
    .onRun(async () => {
        // Find all active games
        const activeGames = await db.collection('games')
            .where('status', '==', 'active')
            .get()

        if (activeGames.empty) {
            return null
        }

        const batch = db.batch()
        const now = admin.firestore.Timestamp.now()

        for (const gameDoc of activeGames.docs) {
            const game = gameDoc.data() as GameState
            const gameRef = gameDoc.ref

            // Get pending actions
            const actionsSnapshot = await gameRef.collection('actions')
                .where('processed', '==', false)
                .orderBy('timestamp')
                .limit(100)
                .get()

            // Process actions
            for (const actionDoc of actionsSnapshot.docs) {
                const action = actionDoc.data()

                // Process based on action type
                switch (action.actionType) {
                    case 'CLAIM_TERRITORY':
                        // Handle territory claim
                        // TODO: Validate territory, check overlaps, update player territory
                        break

                    case 'DECLARE_WAR':
                        // Handle war declaration
                        break

                    case 'DRAW_ARROW':
                        // Handle battle plan
                        break

                    default:
                        console.log(`Unknown action type: ${action.actionType}`)
                }

                // Mark action as processed
                batch.update(actionDoc.ref, { processed: true })
            }

            // Advance game date (1 tick = 1 in-game day)
            const newTickNumber = game.tickNumber + 1
            const newGameDate = game.gameDate + (24 * 60 * 60 * 1000) // +1 day in ms

            batch.update(gameRef, {
                tickNumber: newTickNumber,
                gameDate: newGameDate,
                lastTick: now
            })
        }

        await batch.commit()
        return null
    })

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
        const oneDayAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000)

        const staleLobbies = await db.collection('lobbies')
            .where('createdAt', '<', oneDayAgo)
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

        return null
    })

/**
 * Handle player disconnect - leave lobby if in one
 */
export const onPlayerLeave = functions
    .region('europe-west1')
    .firestore.document('players/{playerId}')
    .onDelete(async (snapshot, context) => {
        const playerId = context.params.playerId

        // Find lobbies this player is in
        const lobbiesWithPlayer = await db.collection('lobbies')
            .where('status', '==', 'waiting')
            .get()

        for (const lobbyDoc of lobbiesWithPlayer.docs) {
            const lobby = lobbyDoc.data() as Lobby

            // Check if player is in this lobby
            if (lobby.players.some(p => p.id === playerId)) {
                if (lobby.hostId === playerId) {
                    // Host left - delete lobby
                    await lobbyDoc.ref.delete()
                    console.log(`🗑️ Deleted lobby ${lobby.code} - host left`)
                } else {
                    // Remove player from lobby
                    const updatedPlayers = lobby.players.filter(p => p.id !== playerId)
                    await lobbyDoc.ref.update({ players: updatedPlayers })
                    console.log(`👋 Removed ${playerId} from lobby ${lobby.code}`)
                }
            }
        }
    })
