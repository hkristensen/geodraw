import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { useMultiplayerStore } from '../store/multiplayerStore'
import { updateGame } from '../firebase/game'

export function useHostSync() {
    const { isMultiplayer, isHost, gameId: multiplayerGameId } = useMultiplayerStore()

    useEffect(() => {
        if (!isMultiplayer || !isHost || !multiplayerGameId) return

        console.log('🔄 Host Sync Loop Active')

        const interval = setInterval(() => {
            const updates: any = {}

            // Sync AI Countries (Full State Replication)
            const aiCountriesMap = useWorldStore.getState().aiCountries
            if (aiCountriesMap.size > 0) {
                updates.aiCountries = Array.from(aiCountriesMap.values())
            }

            // Sync Wars state
            const activeWars = useWorldStore.getState().aiWars
            if (activeWars) {
                updates.wars = activeWars.map(w => {
                    const warClone = { ...w }
                    if (warClone.planArrow) {
                        try {
                            (warClone as any).planArrow = JSON.stringify(warClone.planArrow)
                        } catch (e) { console.error('Failed to stringify planArrow', e) }
                    }
                    return warClone
                })
            }

            // Sync Active Battles
            const activeBattles = useGameStore.getState().activeBattles
            if (activeBattles && activeBattles.length > 0) {
                updates.activeBattles = activeBattles
            }

            // Sync Contested Zones
            const contestedMap = useWorldStore.getState().contestedZones
            if (contestedMap.size > 0) {
                updates.contestedZones = Array.from(contestedMap.entries()).map(([id, feature]) => ({
                    id,
                    featureString: JSON.stringify(feature)
                }))
            }

            // Sync Irradiated Zones
            const irradiatedMap = useWorldStore.getState().irradiatedZones
            if (irradiatedMap.size > 0) {
                updates.irradiatedZones = Array.from(irradiatedMap.entries()).map(([id, zone]) => ({
                    id,
                    zoneString: JSON.stringify(zone)
                }))
            }

            // Sync Diplomatic Events (for notifications like nuclear strikes)
            const diplomaticEvents = useGameStore.getState().diplomaticEvents
            if (diplomaticEvents && diplomaticEvents.length > 0) {
                // Only sync recent events (last 10) to avoid bloating
                updates.events = diplomaticEvents.slice(-10)
            }

            // Sync Game Speed for clients
            const gameSpeed = useGameStore.getState().gameSpeed
            updates.gameSpeed = gameSpeed

            // Sync Tick & Date
            updates.tickNumber = Date.now()
            updates.gameDate = useGameStore.getState().gameDate

            // Sync Player Data (Host's own data + ensuring structure)
            const myId = useMultiplayerStore.getState().user?.uid
            const myNickname = useMultiplayerStore.getState().nickname || 'Player'
            const gameState = useGameStore.getState()

            if (myId && gameState.nation) {
                const playerKey = `players.${myId}`
                let territoryPayload = null
                if (gameState.playerTerritories.length > 0) {
                    territoryPayload = JSON.stringify(gameState.playerTerritories[0])
                }

                const playerData: any = {
                    id: myId,
                    nickname: myNickname,
                    isAlive: true,
                    color: useMultiplayerStore.getState().playerColor || '#3b82f6',
                    resources: {
                        budget: gameState.nation.stats.budget,
                        soldiers: gameState.nation.stats.soldiers,
                        power: gameState.nation.stats.power
                    },
                    territory: territoryPayload
                }

                // Only add countryCode if it exists (avoid undefined in Firestore)
                if (gameState.nation.constitution && gameState.selectedCountry) {
                    playerData.countryCode = gameState.selectedCountry
                }

                updates[playerKey] = playerData
            }

            // Execute Update
            if (Object.keys(updates).length > 0) {
                const cleanUpdates = JSON.parse(JSON.stringify(updates))
                updateGame(multiplayerGameId, cleanUpdates).catch(err => {
                    console.error('❌ HOST SYNC FAILED:', err)
                })
            }

        }, 5000) // Sync every 5 seconds

        return () => clearInterval(interval)
    }, [isMultiplayer, isHost, multiplayerGameId])
}
