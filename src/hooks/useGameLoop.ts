import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { calculateEconomy, calculateResearchOutput, initEconomicCycle, updateEconomicCycle } from '../utils/economy'
import { checkVictoryConditions, checkAchievements } from '../utils/victorySystem'
import { useMultiplayerStore } from '../store/multiplayerStore'
import { checkSeparatistRebellion } from '../utils/separatistSystem'
import { calculateUnrestChange } from '../utils/unrest'
import { calculatePlayerPower } from '../utils/powerSystem'
import { calculateCoalitionEconomicBonus } from '../utils/coalitionSystem'

export function useGameLoop() {
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    // Re-entrancy guard: a tick does a lot of synchronous turf/geometry work across
    // every active war, and setInterval can fire again while a previous tick's
    // callback is still on the stack (e.g. a very slow tick, or a debugger pause).
    // Without this, two ticks could interleave their reads/writes of aiTerritories /
    // contestedZones / aiCountries and silently drop each other's updates - the same
    // class of bug that used to come from unnecessary async boundaries inside the
    // store itself. Skipping an overlapping tick is safe: the next scheduled tick
    // picks up from current state.
    const isProcessingRef = useRef(false)
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
            if (isProcessingRef.current) {
                console.warn('⏭️ Game tick skipped - previous tick still processing')
                return
            }
            isProcessingRef.current = true

            try {
                runTick()
            } finally {
                isProcessingRef.current = false
            }
        }, intervalDuration)

        function runTick() {
            // Re-fetch latest state to avoid closures
            const currentState = useGameStore.getState()
            const currentNation = currentState.nation
            if (!currentNation) return

            const currentWorldState = useWorldStore.getState()
            const currentAiCountries = currentWorldState.aiCountries

            // Coalition bonuses (getCoalitionBenefits() promises these to the player but
            // they were never actually applied anywhere): TRADE -> +5% GDP/member,
            // RESEARCH -> +10% Research Points/member, MILITARY -> +10% military score/member.
            const playerCode = currentState.selectedCountry || 'PLAYER'
            const coalitionBonus = calculateCoalitionEconomicBonus(playerCode, currentWorldState.coalitions)

            const { netIncome, soldierGrowth, stats, totalGDP } = calculateEconomy(currentNation, currentState.infrastructureStats, currentAiCountries, coalitionBonus)

            // Capture initial GDP once, for tracking GDP growth (economic_miracle achievement)
            if (currentState.initialGDP === null && totalGDP > 0) {
                useGameStore.setState({ initialGDP: totalGDP })
            }

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

            // Apply monthly unrest change (budget allocation, tax rate, active wars,
            // active policies, and stability buildings like Temple/Hospital). This was
            // previously computed by calculateUnrestChange but never called anywhere,
            // so player unrest only ever moved via one-off policy-enactment deltas.
            const unrestChange = calculateUnrestChange(currentState, currentWorldState)
            if (unrestChange !== 0) {
                useGameStore.getState().updateUnrest(unrestChange)
            }

            // Advance time (1 month)
            advanceDate(30)

            // Recalculate player power with real diplomatic/research context.
            // calculatePlayerPower (accounts for allies, coalitions, agreements, and
            // actual research) previously existed but was never called anywhere - the
            // player's power score used to be frozen at allyCount/coalitionCount/
            // agreementCount=0 and a flat researchLevel=20 regardless of actual
            // diplomatic or scientific progress.
            const newSoldiers = Math.min(currentNation.stats.manpower, currentNation.stats.soldiers + soldierGrowth)
            const freshBudget = useGameStore.getState().nation?.stats.budget ?? currentNation.stats.budget
            const allyCount = currentWorldState.allies.length
            const coalitionMemberships = currentWorldState.coalitions.filter(c => c.members.includes(playerCode)).length
            const agreementCount = Array.from(currentAiCountries.values())
                .reduce((sum, c) => sum + (c.agreements?.length || 0), 0)
            const buildingCount = currentNation.buildings?.length || 0
            const powerStats = calculatePlayerPower(
                newSoldiers,
                freshBudget,
                allyCount,
                coalitionMemberships,
                agreementCount,
                currentState.unrest,
                currentState.researchPoints,
                buildingCount,
                coalitionBonus.militaryBonus
            )

            // Update stats
            setNation({
                ...currentNation,
                stats: {
                    ...currentNation.stats,
                    ...stats,
                    soldiers: newSoldiers,
                    power: powerStats.totalPower
                }
            })

            // Generate research points
            const population = currentState.infrastructureStats?.totalPopulation || 1000000
            const researchOutput = calculateResearchOutput(currentNation.stats, population, currentNation.buildings || [], coalitionBonus.researchBonus)
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

            const coalitionSize = currentWorldState.coalitions
                .filter(c => c.leader === playerCode)
                .reduce((max, c) => Math.max(max, c.members.length), 0)

            const tradeAgreements = Array.from(currentAiCountries.values())
                .reduce((sum, c) => sum + c.agreements.filter(a => a.type === 'TRADE_AGREEMENT' || a.type === 'FREE_TRADE').length, 0)

            const gdpGrowthPercent = currentState.initialGDP
                ? ((totalGDP - currentState.initialGDP) / currentState.initialGDP) * 100
                : 0

            // Real rank instead of a hardcoded true: fewer than 10 nations more powerful
            const isTop10Power = allPowers.filter(p => p > playerPower).length < 10

            const newAchievements = checkAchievements({
                warsWon: currentState.warsWonCount,
                warAgainstStronger: currentState.warAgainstStrongerWon,
                territoryControlled: (playerLand / worldTotalLand) * 100,
                monthsAtPeace: activeWarsList.length === 0 ? monthsPlayed : 0,
                allianceCount: allyList.length,
                coalitionSize,
                positiveRelations: positiveRelationsCount,
                gdpGrowthPercent,
                tradeAgreements,
                budgetReserves: currentNation.stats.budget,
                lowUnrestMonths: currentState.unrest < 20 ? monthsPlayed : 0,
                revolutionsTriggered: currentState.revolutionsTriggeredCount,
                simultaneousWars: activeWarsList.length,
                isTop10Power,
                warsDeclared: currentState.warsDeclaredCount
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

                    // Generate natural unrest for AI countries (must run BEFORE separatist check)
                    useWorldStore.getState().processNaturalUnrest()

                    // Check for Separatist Rebellions
                    checkSeparatistRebellion(useWorldStore, useGameStore)

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
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [gameSpeed, isMultiplayer, isHost])
}
