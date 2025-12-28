// Lobby system for multiplayer - Uses Cloud Functions for mutations
import {
    doc,
    getDoc,
    updateDoc,
    onSnapshot,
    deleteDoc,
    Timestamp
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './config'

// Player in a lobby
export interface LobbyPlayer {
    id: string
    nickname: string
    color: string
    ready: boolean
    isHost: boolean
    joinedAt: number
    countryCode?: string
}

// Spectator in a lobby
export interface LobbySpectator {
    id: string
    nickname: string
    joinedAt: number
}

// Lobby state
export interface Lobby {
    code: string
    hostId: string
    hostNickname: string
    createdAt: Timestamp
    status: 'waiting' | 'starting' | 'in_game' | 'finished'
    maxPlayers: number
    players: LobbyPlayer[]
    spectators: LobbySpectator[]
    gameSettings: {
        aiCountries: boolean
        startingResources: 'low' | 'medium' | 'high'
        mapRegion: 'world' | 'europe' | 'asia' | 'americas'
    }
    gameId?: string // Set when game starts
    allowLateJoin?: boolean // If true, players can join after game starts
}

// Available player colors
export const PLAYER_COLORS = [
    '#ef4444', // red
    '#3b82f6', // blue  
    '#22c55e', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
]

// Cloud Function callables
const createLobbyFn = httpsCallable<{ nickname: string }, { code: string }>(functions, 'createLobby')
const joinLobbyFn = httpsCallable<{ code: string; nickname: string; asSpectator?: boolean }, { success: boolean; alreadyJoined?: boolean }>(functions, 'joinLobby')
const startGameFn = httpsCallable<{ lobbyCode: string }, { gameId: string }>(functions, 'startGame')

// Create a new lobby via Cloud Function
export async function createLobby(hostId: string, hostNickname: string): Promise<string> {
    console.log('🎮 Creating lobby via Cloud Function...', { hostId })
    try {
        const result = await createLobbyFn({ nickname: hostNickname })
        console.log('🎮 Created lobby:', result.data.code)
        return result.data.code
    } catch (error: unknown) {
        console.error('❌ Failed to create lobby:', error)
        throw error
    }
}

// Join an existing lobby via Cloud Function
export async function joinLobby(
    code: string,
    playerId: string,
    nickname: string,
    asSpectator: boolean = false
): Promise<{ success: boolean; error?: string; lobby?: Lobby }> {
    console.log('🔗 Joining lobby via Cloud Function...', { code, playerId })
    try {
        const result = await joinLobbyFn({
            code: code.toUpperCase(),
            nickname,
            asSpectator
        })

        if (result.data.success) {
            // Fetch the lobby data
            const lobbyRef = doc(db, 'lobbies', code.toUpperCase())
            const snapshot = await getDoc(lobbyRef)
            const lobby = snapshot.exists() ? snapshot.data() as Lobby : undefined
            return { success: true, lobby }
        }
        return { success: false, error: 'Failed to join' }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('❌ Failed to join lobby:', error)
        return { success: false, error: errorMessage }
    }
}

// Leave a lobby (still direct Firestore for simplicity)
export async function leaveLobby(code: string, playerId: string): Promise<void> {
    const lobbyRef = doc(db, 'lobbies', code)
    const snapshot = await getDoc(lobbyRef)

    if (!snapshot.exists()) return

    const lobby = snapshot.data() as Lobby

    // If host leaves, delete lobby
    if (lobby.hostId === playerId) {
        await deleteDoc(lobbyRef)
        console.log('🗑️ Host left, deleted lobby:', code)
        return
    }

    // Remove player
    const updatedPlayers = lobby.players.filter(p => p.id !== playerId)
    const updatedSpectators = lobby.spectators.filter(s => s.id !== playerId)

    await updateDoc(lobbyRef, {
        players: updatedPlayers,
        spectators: updatedSpectators
    })
}

// Toggle player ready status (direct Firestore - allowed by rules)
export async function setPlayerReady(code: string, playerId: string, ready: boolean): Promise<void> {
    const lobbyRef = doc(db, 'lobbies', code)
    const snapshot = await getDoc(lobbyRef)

    if (!snapshot.exists()) return

    const lobby = snapshot.data() as Lobby
    const updatedPlayers = lobby.players.map(p =>
        p.id === playerId ? { ...p, ready } : p
    )

    await updateDoc(lobbyRef, { players: updatedPlayers })
}

// Change player color (direct Firestore - allowed by rules)
export async function setPlayerColor(code: string, playerId: string, color: string): Promise<void> {
    const lobbyRef = doc(db, 'lobbies', code)
    const snapshot = await getDoc(lobbyRef)

    if (!snapshot.exists()) return

    const lobby = snapshot.data() as Lobby

    // Check if color is taken
    if (lobby.players.some(p => p.color === color && p.id !== playerId)) {
        console.warn('Color already taken')
        return
    }

    const updatedPlayers = lobby.players.map(p =>
        p.id === playerId ? { ...p, color } : p
    )

    await updateDoc(lobbyRef, { players: updatedPlayers })
}

// Change player country (direct Firestore)
export async function setPlayerCountry(code: string, playerId: string, countryCode: string): Promise<void> {
    const lobbyRef = doc(db, 'lobbies', code)
    const snapshot = await getDoc(lobbyRef)

    if (!snapshot.exists()) return

    const lobby = snapshot.data() as Lobby
    const updatedPlayers = lobby.players.map(p =>
        p.id === playerId ? { ...p, countryCode } : p
    )

    await updateDoc(lobbyRef, { players: updatedPlayers })
}

// Toggle allow late join setting (host only - direct Firestore allowed by rules)
export async function toggleLateJoin(code: string, allowLateJoin: boolean): Promise<void> {
    const lobbyRef = doc(db, 'lobbies', code)
    await updateDoc(lobbyRef, { allowLateJoin })
}

// Subscribe to lobby changes (real-time)
export function subscribeLobby(code: string, callback: (lobby: Lobby | null) => void): () => void {
    const lobbyRef = doc(db, 'lobbies', code)
    return onSnapshot(lobbyRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.data() as Lobby)
        } else {
            callback(null)
        }
    })
}

// Start the game via Cloud Function (host only)
export async function startGame(code: string, hostId: string): Promise<{ success: boolean; gameId?: string; error?: string }> {
    console.log('🎮 Starting game via Cloud Function...', { code, hostId })
    try {
        const result = await startGameFn({ lobbyCode: code })
        console.log('🎮 Game started:', result.data.gameId)
        return { success: true, gameId: result.data.gameId }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('❌ Failed to start game:', error)
        return { success: false, error: errorMessage }
    }
}

// Get available colors for lobby
export function getAvailableColors(lobby: Lobby): string[] {
    const usedColors = lobby.players.map(p => p.color)
    return PLAYER_COLORS.filter(c => !usedColors.includes(c))
}


