import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useMultiplayerStore } from '../store/multiplayerStore'
import { updateGame } from '../firebase/game'

/**
 * Hook for NON-HOST players (Clients) to sync their own state to Firestore.
 * This ensures they are visible to the Host and other players.
 */
export function useClientSync() {
    const { isMultiplayer, isHost, gameId: multiplayerGameId, user, nickname, playerColor } = useMultiplayerStore()
    const lastSyncRef = useRef<number>(0)
    const lastDataHashRef = useRef<string>('') // Track if data changed
    const isSyncingRef = useRef(false) // Prevent overlapping writes

    useEffect(() => {
        // Only run if we are in multiplayer, we have a game ID, and we are NOT the host
        if (!isMultiplayer || isHost || !multiplayerGameId || !user) return

        console.log('🔄 Client Sync Loop Active')

        const interval = setInterval(() => {
            const now = Date.now()
            // INCREASED THROTTLE: Was 2s, now 5s to reduce Firebase writes
            if (now - lastSyncRef.current < 5000) return

            // Prevent overlapping syncs
            if (isSyncingRef.current) return
            isSyncingRef.current = true

            lastSyncRef.current = now

            const gameState = useGameStore.getState()

            // We only need to sync our specific player data
            // The Host will listen to this and update the global state (or we write directly to the sub-field if using map)

            // Construction of our player state
            const myId = user.uid
            const playerKey = `players.${myId}`

            let territoryPayload = null
            if (gameState.playerTerritories.length > 0) {
                // Optimization: Only sync territory if it changed? 
                // For now, sync it to ensure consistency. 
                // Firestore handle updates efficiently if data hasn't changed? 
                // No, we should probably check deep equality but for MVP simplistic approach:
                territoryPayload = JSON.stringify(gameState.playerTerritories[0])
            }

            const playerData: any = {
                id: myId,
                nickname: nickname || 'Player',
                isAlive: true,
                color: playerColor || '#3b82f6',
                resources: {
                    budget: gameState.nation?.stats.budget || 0,
                    soldiers: gameState.nation?.stats.soldiers || 0,
                    power: gameState.nation?.stats.power || 0
                },
                territory: territoryPayload,
                lastSeen: now // useful for heartbeat/disconnect detection
            }

            // Only add countryCode if it exists (avoid undefined in Firestore)
            if (gameState.nation?.constitution && gameState.selectedCountry) {
                playerData.countryCode = gameState.selectedCountry
            }

            // DIRTY CHECK: Only sync if data actually changed
            const dataHash = JSON.stringify(playerData)
            if (dataHash === lastDataHashRef.current) {
                isSyncingRef.current = false
                return // Skip this sync - nothing changed
            }
            lastDataHashRef.current = dataHash

            const updateData: any = {
                [playerKey]: playerData
            }

            // Execute Update
            updateGame(multiplayerGameId, updateData)
                .catch(err => {
                    console.error('❌ CLIENT SYNC FAILED:', err)
                })
                .finally(() => {
                    isSyncingRef.current = false
                })

        }, 5000) // INCREASED: Was 2000ms, now 5000ms

        return () => clearInterval(interval)
    }, [isMultiplayer, isHost, multiplayerGameId, user, nickname, playerColor])
}
