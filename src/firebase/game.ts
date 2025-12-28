import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from './config'
import type { RemotePlayer } from '../types/game'

// Remote Game State structure (partial, focused on sync)
export interface RemoteGameState {
    id: string
    lobbyCode: string
    status: 'initializing' | 'active' | 'paused' | 'finished'
    players: { [id: string]: RemotePlayer }
    gameDate: number
    tickNumber: number
    lastTick: any // Timestamp
    aiCountries?: { [code: string]: any }
    wars?: any[]
    events?: any[]
    contestedZones?: { id: string, featureString: string }[]
    irradiatedZones?: { id: string, zoneString: string }[]
    activeBattles?: any[]
}

/**
 * Subscribe to real-time game state updates
 */
export function subscribeGame(gameId: string, callback: (game: RemoteGameState | null) => void): () => void {
    const gameRef = doc(db, 'games', gameId)

    console.log('📡 Subscribing to game:', gameId)

    return onSnapshot(gameRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data() as RemoteGameState
            callback(data)
        } else {
            console.warn('Game document not found:', gameId)
            callback(null)
        }
    }, (error) => {
        console.error('Game subscription error:', error)
        callback(null)
    })
}

/**
 * Update game state (Host Authority)
 */
export async function updateGame(gameId: string, updates: Partial<RemoteGameState>): Promise<void> {
    const gameRef = doc(db, 'games', gameId)
    try {
        await updateDoc(gameRef, updates)
    } catch (err) {
        console.error('Failed to update game:', err)
    }
}
