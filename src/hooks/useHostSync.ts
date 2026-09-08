import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { useMultiplayerStore } from '../store/multiplayerStore'
import { updateGame } from '../firebase/game'
import * as turf from '@turf/turf'

export function useHostSync() {
    const { isMultiplayer, isHost, gameId: multiplayerGameId } = useMultiplayerStore()
    const isSyncing = useRef(false) // Semaphore to prevent overlapping writes
    const lastDataHashRef = useRef<string>('') // Track if data changed

    useEffect(() => {
        if (!isMultiplayer || !isHost || !multiplayerGameId) return

        console.log('🔄 Host Sync Loop Active (Throttled 15s)')

        let isMounted = true
        let timeoutRef: NodeJS.Timeout

        const syncLoop = async () => {
            if (!isMounted) return

            // Check if still host
            if (!useMultiplayerStore.getState().isHost) return

            // Prevent overlapping syncs (Write stream exhaustion fix)
            if (isSyncing.current) {
                console.warn('⚠️ Sync skipped - previous sync still in progress')
                if (isMounted) timeoutRef = setTimeout(syncLoop, 5000) // Retry sooner
                return
            }

            isSyncing.current = true

            try {
                const updates: any = {}

                // Sync AI Countries (Optimized State Replication)
                const aiCountriesMap = useWorldStore.getState().aiCountries
                if (aiCountriesMap.size > 0) {
                    updates.aiCountries = Array.from(aiCountriesMap.values()).map(c => ({
                        ...c,
                        units: [],
                        modifiers: c.modifiers ? c.modifiers.slice(0, 5) : [],
                        strategyState: undefined
                    }))
                }

                // Sync Wars state
                const activeWars = useWorldStore.getState().aiWars
                if (activeWars) {
                    updates.wars = activeWars.map(w => {
                        const warClone = { ...w }
                        if (warClone.planArrow) {
                            try {
                                const arrow = warClone.planArrow as any
                                const simpleArrow = turf.simplify(arrow, { tolerance: 0.01, highQuality: false })
                                    ; (warClone as any).planArrow = JSON.stringify(simpleArrow)
                            } catch (e) {
                                (warClone as any).planArrow = JSON.stringify(warClone.planArrow)
                            }
                        }
                        return warClone
                    })
                }

                // Sync Active Battles
                const activeBattles = useGameStore.getState().activeBattles
                if (activeBattles && activeBattles.length > 0) {
                    updates.activeBattles = activeBattles.map(b => {
                        const battleClone = { ...b }
                        if (battleClone.plan) {
                            (battleClone as any).plan = JSON.stringify(battleClone.plan)
                        }
                        return battleClone
                    })
                }

                // Sync Contested Zones
                const contestedMap = useWorldStore.getState().contestedZones
                if (contestedMap.size > 0) {
                    updates.contestedZones = Array.from(contestedMap.entries()).map(([id, feature]) => {
                        try {
                            const simple = turf.simplify(feature as any, { tolerance: 0.005, highQuality: false })
                            return { id, featureString: JSON.stringify(simple) }
                        } catch {
                            return { id, featureString: JSON.stringify(feature) }
                        }
                    })
                }

                // Sync AI Territories (permanent border changes from wars/annexations).
                // Clients build an identical baseline locally from the same bundled
                // countries.json, so we only need to send countries whose borders have
                // actually diverged from that baseline (currently at war, holding lost
                // territory, or annexed) - not the full ~190-country world every tick.
                // Without this, clients only ever saw the transient contestedZones
                // overlay and never the permanent border change it resolves into.
                const territoriesMap = useWorldStore.getState().aiTerritories
                const affectedCountries = useWorldStore.getState().aiCountries
                const territoryUpdates: { code: string, featureString: string | null }[] = []
                affectedCountries.forEach((country, code) => {
                    if (country.isAnnexed) {
                        // Signal clients to remove this country's territory entirely
                        territoryUpdates.push({ code, featureString: null })
                        return
                    }
                    if (country.isAtWar || (country.territoryLost || 0) > 0) {
                        const poly = territoriesMap.get(code)
                        if (poly) {
                            try {
                                const simple = turf.simplify(poly as any, { tolerance: 0.01, highQuality: false })
                                territoryUpdates.push({ code, featureString: JSON.stringify(simple) })
                            } catch {
                                territoryUpdates.push({ code, featureString: JSON.stringify(poly) })
                            }
                        }
                    }
                })
                if (territoryUpdates.length > 0) {
                    updates.aiTerritories = territoryUpdates
                }

                // Sync Irradiated Zones
                const irradiatedMap = useWorldStore.getState().irradiatedZones
                if (irradiatedMap.size > 0) {
                    updates.irradiatedZones = Array.from(irradiatedMap.entries()).map(([id, zone]) => ({
                        id,
                        zoneString: JSON.stringify(zone)
                    }))
                }

                // Sync Diplomatic Events (only last 10)
                const diplomaticEvents = useGameStore.getState().diplomaticEvents
                if (diplomaticEvents && diplomaticEvents.length > 0) {
                    updates.events = diplomaticEvents.slice(-10)
                }

                const gameSpeed = useGameStore.getState().gameSpeed
                updates.gameSpeed = gameSpeed
                updates.tickNumber = Date.now()
                updates.gameDate = useGameStore.getState().gameDate

                // Sync Player Data
                const myId = useMultiplayerStore.getState().user?.uid
                const myNickname = useMultiplayerStore.getState().nickname || 'Player'
                const gameState = useGameStore.getState()

                if (myId && gameState.nation) {
                    const playerKey = `players.${myId}`
                    let territoryPayload = null
                    if (gameState.playerTerritories.length > 0) {
                        try {
                            const mainPoly = gameState.playerTerritories[0]
                            const simplePoly = turf.simplify(mainPoly, { tolerance: 0.005, highQuality: false })
                            territoryPayload = JSON.stringify(simplePoly)
                        } catch (e) {
                            territoryPayload = JSON.stringify(gameState.playerTerritories[0])
                        }
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

                    if (gameState.nation.constitution && gameState.selectedCountry) {
                        playerData.countryCode = gameState.selectedCountry
                    }

                    updates[playerKey] = playerData
                }

                // DIRTY CHECK: Only sync if data actually changed significantly
                const dataHash = JSON.stringify({
                    aiCount: updates.aiCountries?.length,
                    warCount: updates.wars?.length,
                    contestedCount: updates.contestedZones?.length,
                    territoriesCount: updates.aiTerritories?.length,
                    gameDate: updates.gameDate
                })

                if (Object.keys(updates).length > 0 && isMounted) {
                    // Only send full update if something meaningful changed
                    if (dataHash !== lastDataHashRef.current) {
                        lastDataHashRef.current = dataHash
                        const cleanUpdates = JSON.parse(JSON.stringify(updates))
                        await updateGame(multiplayerGameId, cleanUpdates)
                        console.log('✅ Host sync complete')
                    } else {
                        // Light sync - just update timestamp to show host is alive
                        await updateGame(multiplayerGameId, {
                            tickNumber: Date.now(),
                            gameDate: updates.gameDate,
                            gameSpeed: updates.gameSpeed
                        })
                    }
                }
            } catch (err) {
                console.error('❌ HOST SYNC FAILED:', err)
            } finally {
                isSyncing.current = false

                // INCREASED interval to 15s to reduce Firebase write load
                if (isMounted) {
                    timeoutRef = setTimeout(syncLoop, 15000)
                }
            }
        }

        // Start the loop
        syncLoop()

        return () => {
            isMounted = false
            if (timeoutRef) clearTimeout(timeoutRef)
        }
    }, [isMultiplayer, isHost, multiplayerGameId])
}
