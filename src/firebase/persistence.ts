
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'
import { useGameStore } from '../store/gameStore'
import type { RemoteGameState, RemotePlayer } from '../types/game'

/**
 * Initializes a Single Player Cloud Game
 * Creates a Firestore document similar to a multiplayer game but without a lobby.
 * This allows "Local Games" to profit from cloud persistence.
 */
export async function initializeCloudGame(playerId: string, nickname: string): Promise<string> {
    const gameId = `local-${playerId}-${Date.now()}`
    const gameRef = doc(db, 'games', gameId)

    const gameState = useGameStore.getState()

    // Construct initial player state
    const playerState: RemotePlayer = {
        id: playerId,
        nickname: nickname || 'Player',
        color: '#3b82f6', // Default blue
        countryCode: gameState.nation?.constitution ? 'PLAYER' : undefined,
        isAlive: true,
        resources: {
            budget: gameState.nation?.stats.budget || 0,
            soldiers: gameState.nation?.stats.soldiers || 0,
            power: gameState.nation?.stats.power || 0
        },
        // We will sync territory in the first host loop update
        territory: null
    }

    const initialGameData: RemoteGameState = {
        gameDate: gameState.gameDate,
        players: {
            [playerId]: playerState
        },
        wars: [],
        aiCountries: [], // Will be synced by host loop
        events: [],
        contestedZones: [],
        irradiatedZones: []
    }

    console.log('☁️ Creating Cloud Game for persistence:', gameId)

    try {
        await setDoc(gameRef, {
            ...initialGameData,
            createdAt: serverTimestamp(),
            hostId: playerId,
            isPrivate: true,
            mode: 'SINGLE_PLAYER_CLOUD'
        })

        return gameId
    } catch (error) {
        console.error('❌ Failed to create cloud persistence doc:', error)
        throw error
    }
}
