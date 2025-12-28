import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { calculateEconomy, calculateResearchOutput, initEconomicCycle, updateEconomicCycle } from '../utils/economy'
import { checkVictoryConditions, checkAchievements } from '../utils/victorySystem'
import { useMultiplayerStore } from '../store/multiplayerStore'

export function useGameLoop() {
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const {
        gameSpeed,
        triggerEvent,
        updateBudget,
        setNation,
        advanceDate,
        gameDate
    } = useGameStore()

    const { isMultiplayer, isHost } = useMultiplayerStore()

    // Initialize economic cycle if missing
    useEffect(() => {
        if (!useGameStore.getState().economicCycle) {
            const cycle = initEconomicCycle()
            useGameStore.setState({ economicCycle: cycle })
            console.log('📊 Economic cycle initialized:', cycle.phase)
        }
    }, [])

    useEffect(() => {
        // Clear existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }

        // If paused, do nothing
        if (gameSpeed === 0) return

        // Calculate interval duration based on speed
        // Base (1x) = 5000ms
        // 2x = 2500ms
        // 5x = 1000ms
        const baseInterval = 5000
        const intervalDuration = baseInterval / gameSpeed

        intervalRef.current = setInterval(() => {
            // Re-fetch latest state to avoid closures
            const currentState = useGameStore.getState()
            const currentNation = currentState.nation
            if (!currentNation) return

            const currentWorldState = useWorldStore.getState()
            const currentAiCountries = currentWorldState.aiCountries

            const { netIncome, soldierGrowth, stats } = calculateEconomy(currentNation, currentState.infrastructureStats, currentAiCountries)

            // Update economic cycle
            if (currentState.economicCycle) {
                const newCycle = updateEconomicCycle(currentState.economicCycle)
                if (newCycle.phase !== currentState.economicCycle.phase) {
                    console.log('📈 Economic cycle changed:', currentState.economicCycle.phase, '→', newCycle.phase)
                }
                useGameStore.setState({ economicCycle: newCycle })
            }

            // Apply income
            updateBudget(netIncome)

            // Advance time (1 month)
            advanceDate(30)

            // Update stats
            setNation({
                ...currentNation,
                stats: {
                    ...currentNation.stats,
                    ...stats,
                    soldiers: Math.min(currentNation.stats.manpower, currentNation.stats.soldiers + soldierGrowth)
                }
            })

            // Generate research points
            const population = currentState.infrastructureStats?.totalPopulation || 1000000
            const researchOutput = calculateResearchOutput(currentNation.stats, population, currentNation.buildings || [])
            if (researchOutput > 0) {
                useGameStore.getState().addResearchPoints(researchOutput)
            }

            // Check victory conditions
            const worldTotalLand = 510_072_000 // km2
            const playerLand = currentState.infrastructureStats?.totalAreaKm2 || 0
            const monthsPlayed = Math.floor((gameDate - new Date('2025-01-01').getTime()) / (30 * 24 * 60 * 60 * 1000))

            // Collect all powers and GDPs
            const playerGDP = currentNation.stats.wealth
            const playerPower = currentNation.stats.power
            const allPowers: number[] = [playerPower]
            const allGDPs: number[] = [playerGDP]

            currentAiCountries.forEach(ai => {
                allPowers.push(ai.power)
                allGDPs.push((ai.economy || 50) * (ai.population || 1000000))
            })

            // Update streaks
            const isTopPower = playerPower >= Math.max(...allPowers)
            const isTopGDP = playerGDP >= Math.max(...allGDPs)
            const newTopPowerMonths = isTopPower ? currentState.consecutiveMonthsAsTopPower + 1 : 0
            const newTopGDPMonths = isTopGDP ? currentState.consecutiveMonthsAsTopGDP + 1 : 0
            useGameStore.setState({
                consecutiveMonthsAsTopPower: newTopPowerMonths,
                consecutiveMonthsAsTopGDP: newTopGDPMonths
            })

            // Check victory conditions
            const conditions = checkVictoryConditions({
                playerTerritory: (playerLand / worldTotalLand) * 100, // Convert to %
                playerPower,
                allPowers,
                playerGDP,
                allGDPs,
                monthsPlayed,
                consecutiveMonthsAsTopPower: newTopPowerMonths,
                consecutiveMonthsAsTopGDP: newTopGDPMonths
            })

            const victoriesAchieved = currentState.victoriesAchieved
            const newVictory = conditions.find(c => c.achieved && !victoriesAchieved.includes(c.type))
            if (newVictory) {
                console.log('🏆 VICTORY:', newVictory.type)
                useGameStore.setState({ victoriesAchieved: [...victoriesAchieved, newVictory.type] })
            }

            // Check achievements
            const allyList = currentWorldState.allies
            const activeWarsList = currentWorldState.activeWars
            let positiveRelationsCount = 0
            currentAiCountries.forEach(ai => { if (ai.relations > 0) positiveRelationsCount++ })

            const newAchievements = checkAchievements({
                warsWon: 0,
                warAgainstStronger: false,
                territoryControlled: (playerLand / worldTotalLand) * 100,
                monthsAtPeace: activeWarsList.length === 0 ? monthsPlayed : 0,
                allianceCount: allyList.length,
                coalitionSize: 0,
                positiveRelations: positiveRelationsCount,
                gdpGrowthPercent: 0,
                tradeAgreements: 0,
                budgetReserves: currentNation.stats.budget,
                lowUnrestMonths: currentState.unrest < 20 ? monthsPlayed : 0,
                revolutionsTriggered: 0,
                simultaneousWars: activeWarsList.length,
                isTop10Power: true,
                warsDeclared: 0
            }, currentState.achievementsUnlocked)

            if (newAchievements.length > 0) {
                console.log('🎖️ Achievements unlocked:', newAchievements.map(a => a.title))
                useGameStore.setState({
                    achievementsUnlocked: [...currentState.achievementsUnlocked, ...newAchievements.map(a => a.id)]
                })
            }

            // HOST ONLY LOGIC (AI & Events)
            if (!isMultiplayer || isHost) {
                // Random Event Trigger (3% chance per month)
                if (!currentState.currentEvent && Math.random() < 0.03) {
                    import('../data/events').then(({ RANDOM_EVENTS }) => {
                        const validEvents = RANDOM_EVENTS.filter(e => {
                            if (e.condition) {
                                return e.condition(useGameStore.getState(), useWorldStore.getState())
                            }
                            return true
                        })

                        if (validEvents.length > 0) {
                            const event = validEvents[Math.floor(Math.random() * validEvents.length)]
                            triggerEvent(event)
                            console.log('🎲 Random Event Triggered:', event.title)
                        }
                    })
                }

                // AI Processing & Diplomacy
                if (currentState.phase === 'RESULTS' || currentState.phase === 'WAR' || currentState.phase === 'EXPANSION') {

                    useWorldStore.getState().processElections()

                    // Check for Separatist Rebellions
                    import('../utils/separatistSystem').then(({ checkSeparatistRebellion }) => {
                        checkSeparatistRebellion(useWorldStore.getState(), useGameStore)
                    })

                    const currentWorldState = useWorldStore.getState()
                    const currentAiCountries = currentWorldState.aiCountries

                    // 1. Process AI Turn (Military movements/Attacks on Player)
                    const { offensives, wars } = currentWorldState.processAITurn()

                    // Handle new wars on player
                    if (wars.length > 0) {
                        wars.forEach(warCountryCode => {
                            const attacker = currentAiCountries.get(warCountryCode)
                            if (attacker) {
                                useGameStore.getState().addDiplomaticEvents([{
                                    id: `war-decl-${Date.now()}-${warCountryCode}`,
                                    type: 'WAR_DECLARED',
                                    severity: 3,
                                    title: 'WAR DECLARED!',
                                    description: `${attacker.name} has declared war on us!`,
                                    affectedNations: [warCountryCode],
                                    timestamp: Date.now()
                                }])
                            }
                        })
                    }

                    // Handle Offensives against Player
                    if (offensives.length > 0) {
                        console.log(`⚠️ AI launching ${offensives.length} offensives!`)
                        offensives.forEach(offensive => {
                            const attacker = currentAiCountries.get(offensive.countryCode)
                            if (!attacker || !currentNation) return

                            useGameStore.getState().startBattle(
                                offensive.countryCode,
                                attacker.name,
                                'PLAYER',
                                currentNation.name,
                                offensive.strength,
                                currentNation.stats.soldiers || 1000,
                                'BATTLE',
                                false, // isPlayerAttacker
                                true,  // isPlayerDefender
                                undefined,
                                undefined,
                                0
                            )
                        })
                    }

                    // 2. Process AI vs AI Wars
                    const aiVsAiResult = currentWorldState.processAIvsAI()

                    if (aiVsAiResult.events.length > 0) {
                        aiVsAiResult.events.forEach(event => {
                            const attacker = currentAiCountries.get(event.attackerCode)
                            const defender = currentAiCountries.get(event.defenderCode)
                            if (!attacker || !defender) return

                            if (event.type === 'WAR_DECLARED') {
                                useGameStore.getState().addDiplomaticEvents([{
                                    id: `ai-war-${Date.now()}-${event.attackerCode}-${event.defenderCode}-${Math.random()}`,
                                    type: 'WAR_DECLARED',
                                    severity: 2,
                                    title: 'WAR BREAKS OUT',
                                    description: `${attacker.name} has declared war on ${defender.name}!`,
                                    affectedNations: [event.attackerCode, event.defenderCode],
                                    timestamp: Date.now()
                                }])
                            }
                        })
                    }

                    // Process Advanced Diplomacy
                    useWorldStore.getState().processDiplomacy()
                }
            }

        }, intervalDuration)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [gameSpeed, isMultiplayer, isHost])
}
