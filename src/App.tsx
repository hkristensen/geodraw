import { useState, useEffect, useCallback } from 'react'
import { GameSetup } from './components/GameSetup'
import type { GameSettings } from './types/game'
import { GameMap } from './components/GameMap'
import { ConsequencesPanel } from './components/ConsequencesPanel'
import { ConstitutionModal } from './components/ConstitutionModal'
import { EventModal } from './components/EventModal'

import { ExpansionModal } from './components/ExpansionModal'
import { DiplomacyActionModal } from './components/DiplomacyActionModal'
import { ClaimActionModal } from './components/ClaimActionModal'
import { NewsTicker } from './components/NewsTicker'
import { NationInfoPanel } from './components/NationInfoPanel'
import { DiplomacyPanel } from './components/DiplomacyPanel'
import { TerritoryAnalysisModal } from './components/TerritoryAnalysisModal'
import { CoalitionPanel } from './components/CoalitionPanel'
import { useGameStore } from './store/gameStore'
import { useWorldStore } from './store/worldStore'
import { initCountryData } from './utils/countryData'
import { initGeopoliticalData } from './utils/geopoliticalData'
import { initInfrastructure, calculateInfrastructure } from './utils/infrastructure'
import { calculateEconomy, calculateResearchOutput } from './utils/economy'
import { initEconomicCycle, updateEconomicCycle } from './utils/economy'
import { checkVictoryConditions, checkAchievements } from './utils/victorySystem'
import type { VictoryCondition, Achievement } from './utils/victorySystem'
import { WarPlanningModal } from './components/WarPlanningModal'
import { MilitaryPanel } from './components/MilitaryPanel'

import type { BattlePlan } from './types/game'
import { calculateConsequences } from './utils/calculateConsequences'
import { calculateCityCapture, parseCities } from './utils/calculateCityCapture'
import { GameOverModal } from './components/GameOverModal'
import { VictoryModal, AchievementPopup, VictoryProgressPanel } from './components/VictoryModal'
import { GameLog } from './components/GameLog'
import { BreakingNews } from './components/BreakingNews'
import * as turf from '@turf/turf'
import countriesData from './data/countries.json'
import citiesData from './data/cities.json'

import { ActiveWarsPanel } from './components/ActiveWarsPanel'

function App() {
    const [showCoalitionPanel, setShowCoalitionPanel] = useState(false)
    const [showDiplomacyPanel, setShowDiplomacyPanel] = useState(false)
    const [showWarsPanel, setShowWarsPanel] = useState(false)

    // Victory and Achievement state
    const [currentVictory, setCurrentVictory] = useState<VictoryCondition | null>(null)
    const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null)
    const [victoryConditions, setVictoryConditions] = useState<VictoryCondition[]>([])

    // War Planning State
    const [showWarPlanningModal, setShowWarPlanningModal] = useState(false)
    const [planningTarget, setPlanningTarget] = useState<{ code: string, name: string } | null>(null)
    const [isDrawMode, setIsDrawMode] = useState(false)
    const [activeArrowType, setActiveArrowType] = useState<'OFFENSE' | 'DEFENSE' | 'SUPPLY'>('OFFENSE')
    // New: We need to store assignments of units to arrows
    // Map<ArrowID, UnitIDs[]>
    const [arrowAssignments, setArrowAssignments] = useState<Record<string, string[]>>({})
    const [battlePlan, setBattlePlan] = useState<BattlePlan | undefined>(undefined)
    const [arrowCount, setArrowCount] = useState(0)
    const [clearWarSignal, setClearWarSignal] = useState<number | undefined>(undefined)



    const {
        phase,
        diplomaticEvents,
        userPolygon,
        setPhase,
        setGameSettings,
        setUserPolygon,
        setConsequences,
        setCapturedCities,
        setInfrastructureStats,
        consequences,
        selectedClaimId,
        setSelectedClaim,
        nation,
        startBattle,
        gameOver
    } = useGameStore()
    const { initializeAICountries, aiCountries, processAITurn, processAIvsAI } = useWorldStore()

    // Handlers for GameSetup
    const handleStartGame = (settings: GameSettings) => {
        setGameSettings(settings)

        if (settings.startMode === 'EXISTING_COUNTRY' && settings.startingCountry) {
            // Load the selected country's territory
            const countryFeature = (countriesData as any).features.find(
                (f: any) => f.properties.iso_a3 === settings.startingCountry
            )

            if (countryFeature) {
                console.log('🏳️ Starting as existing country:', settings.startingCountry, countryFeature.properties.ADMIN)

                // Set the country as player's territory
                setUserPolygon(countryFeature)

                // Calculate consequences (what other countries we now control)
                const newConsequences = calculateConsequences(countryFeature, countriesData as any)
                setConsequences(newConsequences)

                // Calculate captured cities
                const cities = parseCities(citiesData as any)
                const cityResult = calculateCityCapture(countryFeature, cities)
                setCapturedCities(cityResult.capturedCities)

                // Calculate infrastructure
                const infrastructureStats = calculateInfrastructure(countryFeature)
                setInfrastructureStats(infrastructureStats)

                console.log('📊 Existing country initialized:', {
                    consequences: newConsequences.length,
                    cities: cityResult.capturedCities.length,
                    population: infrastructureStats.totalPopulation
                })

                // Store the country name for pre-filling in Constitution
                const countryName = countryFeature.properties?.admin || countryFeature.properties?.name
                useGameStore.getState().setSelectedCountryName(countryName)
                useGameStore.getState().setSelectedCountry(settings.startingCountry)

                // Skip directly to CONSTITUTION phase (no need for ANALYSIS for existing countries)
                setPhase('CONSTITUTION')
            } else {
                console.error('❌ Country not found:', settings.startingCountry)
                setPhase('DRAWING') // Fallback to drawing mode
            }
        } else {
            // Freeform drawing mode
            setPhase('DRAWING')
        }
    }

    const handleCancelSetup = () => {
        setPhase('DRAWING')
    }

    // Load data on mount
    useEffect(() => {
        initCountryData()
        initGeopoliticalData()
        initInfrastructure().then(() => {
            useGameStore.getState().setInfrastructureLoaded(true)
            console.log('✅ Infrastructure loaded and store updated')
        })
    }, [])

    // Safety check: Ensure AI countries are initialized if we have consequences
    // Safety check: Ensure AI countries are initialized if we have consequences
    useEffect(() => {
        const { coalitionsInitialized } = useWorldStore.getState()
        if (consequences.length > 0 && aiCountries.size === 0 && !coalitionsInitialized) {
            console.log('🔄 Re-initializing AI countries from consequences...')
            initializeAICountries(consequences, nation?.constitution, countriesData as any)
        }
    }, [consequences, aiCountries, initializeAICountries, nation])

    // AI Turn Loop
    useEffect(() => {
        if (phase !== 'RESULTS') return

        const interval = setInterval(() => {
            const { offensives, wars } = processAITurn()

            // Process AI vs AI wars
            const aiVsAiResult = processAIvsAI()

            // Handle AI vs AI war declarations (news events)
            if (aiVsAiResult.events.length > 0) {
                aiVsAiResult.events.forEach(event => {
                    const attacker = aiCountries.get(event.attackerCode)
                    const defender = aiCountries.get(event.defenderCode)

                    if (!attacker || !defender) return

                    if (event.type === 'WAR_DECLARED') {
                        useGameStore.getState().addDiplomaticEvents([{
                            id: `ai-war-${Date.now()}-${event.attackerCode}-${event.defenderCode}-${Math.random().toString(36).substr(2, 9)}`,
                            type: 'WAR_DECLARED',
                            severity: 2, // Major news
                            title: 'WAR BREAKS OUT',
                            description: `${attacker.name} has declared war on ${defender.name}!`,
                            affectedNations: [event.attackerCode, event.defenderCode],
                            timestamp: Date.now()
                        }])
                    } else if (event.type === 'PEACE_TREATY') {
                        // Winner is stored in 'attackerCode', Loser in 'defenderCode' for this event type
                        const winner = attacker
                        const loser = defender

                        useGameStore.getState().addDiplomaticEvents([{
                            id: `ai-peace-${Date.now()}-${event.attackerCode}-${event.defenderCode}`,
                            type: 'DIPLOMACY',
                            severity: 1,
                            title: 'PEACE TREATY SIGNED',
                            description: `${winner.name} and ${loser.name} have signed a peace treaty. ${winner.name} is victorious.`,
                            affectedNations: [event.attackerCode, event.defenderCode],
                            timestamp: Date.now()
                        }])
                    }
                })
            }

            // Handle new wars (AI declaring war on player)
            if (wars && wars.length > 0) {
                wars.forEach(warCountryCode => {
                    const attacker = aiCountries.get(warCountryCode)
                    if (attacker) {
                        useGameStore.getState().addDiplomaticEvents([{
                            id: `war-decl-${Date.now()}-${warCountryCode}`,
                            type: 'WAR_DECLARED',
                            severity: 3, // Breaking News
                            title: 'WAR DECLARED!',
                            description: `${attacker.name} has declared war on us!`,
                            affectedNations: [warCountryCode],
                            timestamp: Date.now()
                        }])
                    }
                })
            }


            // Handle AI Offensives (AI attacking player)
            if (offensives && offensives.length > 0) {
                console.log(`⚠️ App.tsx received ${offensives.length} offensives!`)
                const { playerTerritories } = useGameStore.getState()
                const playerPoly = playerTerritories[0]

                offensives.forEach(offensive => {
                    const attacker = aiCountries.get(offensive.countryCode)
                    if (!attacker) return

                    // Calculate battle location (on player territory)
                    let battleLocation: [number, number] | undefined
                    if (playerPoly) {
                        try {
                            const center = turf.centerOfMass(playerPoly as any)
                            battleLocation = center.geometry.coordinates as [number, number]
                        } catch (e) {
                            console.warn('Failed to calculate defensive battle location', e)
                        }
                    }

                    // Calculate defense bonus from nearby forts
                    let defenseBonus = 0
                    if (battleLocation && nation?.buildings) {
                        const battlePoint = turf.point(battleLocation)
                        const forts = nation.buildings.filter(b => b.type === 'FORT')

                        for (const fort of forts) {
                            const fortPoint = turf.point(fort.location)
                            const distance = turf.distance(battlePoint, fortPoint, { units: 'kilometers' })

                            // Forts provide protection within 500km
                            if (distance < 500) {
                                defenseBonus = 1
                                console.log('🛡️ Fort providing defense bonus! Distance:', distance.toFixed(0), 'km')
                                break // Bonuses don't stack
                            }
                        }
                    }

                    startBattle(
                        offensive.countryCode,
                        attacker.name,
                        'PLAYER',
                        nation?.name || 'Player',
                        offensive.strength,
                        nation?.stats.soldiers || 1000,
                        'BATTLE',
                        false, // isPlayerAttacker
                        true,  // isPlayerDefender
                        undefined,
                        battleLocation,
                        defenseBonus
                    )
                })
            }
        }, 30000) // Every 30 seconds


        return () => clearInterval(interval)
    }, [phase, processAITurn]) // Removed aiCountries to prevent timer reset

    const [selectedCountryForDiplomacy, setSelectedCountryForDiplomacy] = useState<string | null>(null)

    // Economy Loop (Monthly)
    useEffect(() => {
        // Initialize economic cycle on mount
        const gameState = useGameStore.getState()
        if (!gameState.economicCycle) {
            const cycle = initEconomicCycle()
            useGameStore.setState({ economicCycle: cycle })
            console.log('📊 Economic cycle initialized:', cycle.phase)
        }

        const interval = setInterval(() => {
            const {
                nation, infrastructureStats, updateBudget, setNation, advanceDate,
                economicCycle, victoriesAchieved, achievementsUnlocked,
                consecutiveMonthsAsTopPower, consecutiveMonthsAsTopGDP,
                gameDate
            } = useGameStore.getState()
            if (!nation) return

            const { aiCountries } = useWorldStore.getState()
            const { netIncome, soldierGrowth, stats } = calculateEconomy(nation, infrastructureStats, aiCountries)

            // Update economic cycle
            if (economicCycle) {
                const newCycle = updateEconomicCycle(economicCycle)
                if (newCycle.phase !== economicCycle.phase) {
                    console.log('📈 Economic cycle changed:', economicCycle.phase, '→', newCycle.phase)
                }
                useGameStore.setState({ economicCycle: newCycle })
            }

            // Apply income
            updateBudget(netIncome)

            // Advance time (1 month)
            advanceDate(30)

            // Update stats
            setNation({
                ...nation,
                stats: {
                    ...nation.stats,
                    ...stats,
                    soldiers: Math.min(nation.stats.manpower, nation.stats.soldiers + soldierGrowth)
                }
            })

            // Generate research points
            const population = infrastructureStats?.totalPopulation || 1000000
            const researchOutput = calculateResearchOutput(nation.stats, population, nation.buildings || [])
            if (researchOutput > 0) {
                useGameStore.getState().addResearchPoints(researchOutput)
            }

            // Check victory conditions
            const worldTotalLand = 510_072_000 // km2
            const playerLand = infrastructureStats?.totalAreaKm2 || 0
            const monthsPlayed = Math.floor((gameDate - new Date('2025-01-01').getTime()) / (30 * 24 * 60 * 60 * 1000))

            // Collect all powers and GDPs
            const playerGDP = nation.stats.wealth
            const playerPower = nation.stats.power
            const allPowers: number[] = [playerPower]
            const allGDPs: number[] = [playerGDP]

            aiCountries.forEach(ai => {
                allPowers.push(ai.power)
                // Use economy * population as GDP proxy
                allGDPs.push((ai.economy || 50) * (ai.population || 1000000))
            })

            // Update streaks
            const isTopPower = playerPower >= Math.max(...allPowers)
            const isTopGDP = playerGDP >= Math.max(...allGDPs)
            const newTopPowerMonths = isTopPower ? consecutiveMonthsAsTopPower + 1 : 0
            const newTopGDPMonths = isTopGDP ? consecutiveMonthsAsTopGDP + 1 : 0
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
            setVictoryConditions(conditions)

            // Check for new victories
            const newVictory = conditions.find(c => c.achieved && !victoriesAchieved.includes(c.type))
            if (newVictory) {
                console.log('🏆 VICTORY:', newVictory.type)
                useGameStore.setState({ victoriesAchieved: [...victoriesAchieved, newVictory.type] })
                setCurrentVictory(newVictory)
            }

            // Check achievements (simplified - using game state for now)
            const { allies: allyList } = useWorldStore.getState()
            const { activeWars } = useWorldStore.getState()
            let positiveRelationsCount = 0
            aiCountries.forEach(ai => { if (ai.relations > 0) positiveRelationsCount++ })

            const newAchievements = checkAchievements({
                warsWon: 0, // TODO: track properly
                warAgainstStronger: false,
                territoryControlled: (playerLand / worldTotalLand) * 100,
                monthsAtPeace: activeWars.length === 0 ? monthsPlayed : 0,
                allianceCount: allyList.length,
                coalitionSize: 0, // TODO: track properly
                positiveRelations: positiveRelationsCount,
                gdpGrowthPercent: 0, // TODO: track properly
                tradeAgreements: 0, // TODO: track properly
                budgetReserves: nation.stats.budget,
                lowUnrestMonths: useGameStore.getState().unrest < 20 ? monthsPlayed : 0,
                revolutionsTriggered: 0,
                simultaneousWars: activeWars.length,
                isTop10Power: true, // Simplified
                warsDeclared: 0 // TODO: track properly
            }, achievementsUnlocked)

            if (newAchievements.length > 0) {
                console.log('🎖️ Achievements unlocked:', newAchievements.map(a => a.title))
                useGameStore.setState({
                    achievementsUnlocked: [...achievementsUnlocked, ...newAchievements.map(a => a.id)]
                })
                // Show first achievement popup
                if (!currentAchievement) {
                    setCurrentAchievement(newAchievements[0])
                }
            }

            // Random Event Trigger (3% chance per month)
            const { currentEvent, triggerEvent } = useGameStore.getState()
            if (!currentEvent && Math.random() < 0.03) {
                import('./data/events').then(({ RANDOM_EVENTS }) => {
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

            // Process Elections/Coups/Revolutions in AI countries
            useWorldStore.getState().processElections()

        }, 5000) // 5 seconds = 1 month

        return () => clearInterval(interval)
    }, [currentAchievement])





    // War Planning Handlers
    const handleSavePlan = (unitIds: string[]) => {
        if (!battlePlan) return

        const planToSave = {
            ...battlePlan,
            assignedUnitIds: unitIds
        }

        useGameStore.getState().saveWarPlan(planToSave)

        // Reset and close
        setShowWarPlanningModal(false)
        setPlanningTarget(null)
        setBattlePlan(undefined)
        setArrowCount(0)
        setIsDrawMode(false)

        // Maybe show toast?
        console.log('📝 War Plan Saved:', planToSave.name)
    }

    // Launch Offensive Handler - Opens War Planning Modal
    const handleLaunchOffensive = (countryCode: string, countryName: string) => {
        if (!nation) return

        // Initialize War Planning
        setPlanningTarget({ code: countryCode, name: countryName })
        setShowWarPlanningModal(true)
        setSelectedCountryForDiplomacy(null) // Close diplomacy modal
    }


    // Arrow Drawing Handler
    const handleWarArrowsUpdate = useCallback((arrows: any) => {
        if (!planningTarget) return
        setBattlePlan({
            id: `plan-${Date.now()}`,
            name: `Attack on ${planningTarget.name}`,
            targetCountry: planningTarget.code,
            assignedUnitIds: [], // Units will be assigned in WarPlanningModal
            arrows: arrows,
            createdAt: Date.now()
        })
        setArrowCount(arrows.features.length)
    }, [planningTarget])

    const executeOffensive = (unitIds: string[]) => {
        if (!nation || !planningTarget) return

        const countryCode = planningTarget.code
        const countryName = planningTarget.name

        // Start offensive battle
        // Get enemy soldiers
        const enemy = aiCountries.get(countryCode)
        const enemySoldiers = enemy ? enemy.soldiers : 10000

        // Auto-declare war if not already at war
        if (enemy && !enemy.isAtWar && aiCountries.has(countryCode)) {
            console.log('⚔️ Executing plan triggers War Declaration:', countryCode)
            useWorldStore.getState().declareWar(countryCode)

            // Add diplomatic event for the war declaration
            useGameStore.getState().addDiplomaticEvents([{
                id: `war-decl-${Date.now()}`,
                type: 'WAR_DECLARED',
                severity: 3,
                title: 'War Declared',
                description: `We have declared war on ${countryName} by launching a surprise offensive!`,
                affectedNations: [countryCode],
                timestamp: Date.now()
            }])

            // Trigger Alliance Response (Article 5)
            useWorldStore.getState().triggerAllianceResponse(countryCode, 'PLAYER')
        }

        // Calculate battle location (center of target country)
        let battleLocation: [number, number] | undefined
        const targetFeature = (countriesData as any).features.find(
            (f: any) => f.properties?.iso_a3 === countryCode
        )
        if (targetFeature) {
            try {
                const center = turf.centerOfMass(targetFeature)
                battleLocation = center.geometry.coordinates as [number, number]
            } catch (e) {
                console.warn('Failed to calculate offensive battle location', e)
            }
        }

        // Calculate Attacker Soldiers from Units
        const participatingUnits = nation.units?.filter(u => unitIds.includes(u.id)) || []
        const totalSoldiers = participatingUnits.reduce((sum, u) => sum + u.soldiers, 0) || nation.stats.soldiers // Fallback if no units selected (legacy)

        // Finalize Plan
        const finalPlan = battlePlan ? { ...battlePlan, assignedUnitIds: unitIds } : undefined

        startBattle(
            'PLAYER',
            nation.name,
            countryCode,
            countryName,
            totalSoldiers,
            enemySoldiers,
            'BATTLE',
            true, // isPlayerAttacker
            false, // isPlayerDefender
            undefined, // claimId
            battleLocation,
            0, // defenseBonus
            finalPlan // Pass the plan!
        )

        // Reset Planning State
        setShowWarPlanningModal(false)
        setPlanningTarget(null)
        setBattlePlan(undefined)
        setArrowCount(0)
        setIsDrawMode(false)
    }

    // Effect to toggle drawing mode
    // We need to pass isDrawMode to GameMap?
    // Or we initializing arrowDraw here and passing map instance?
    // GameMap has the map instance ref. We need to access it.
    // Ideally, we move initArrowDraw inside GameMap and expose controls via props.
    // OR we pass `isDrawRef` to GameMap.

    // Let's modify GameMap to accept `warPlanningMode` prop.


    // Render setup screen if in SETUP phase
    if (phase === 'SETUP') {
        return <GameSetup onStartGame={handleStartGame} onCancel={handleCancelSetup} />
    }

    // Handler for country clicks - opens diplomacy modal (including own country for inspection)
    const handleCountryClick = (code: string) => {
        setSelectedCountryForDiplomacy(code)
    }

    return (
        <div className="relative w-full h-screen overflow-hidden bg-slate-900">
            {/* Map layer */}
            {showWarPlanningModal && planningTarget && (
                <WarPlanningModal
                    targetCountryCode={planningTarget.code}
                    onConfirm={executeOffensive}
                    onSave={handleSavePlan}
                    onCancel={() => {
                        setShowWarPlanningModal(false)
                        setPlanningTarget(null)
                        setIsDrawMode(false)
                    }}
                    isDrawing={isDrawMode}
                    setIsDrawing={setIsDrawMode}
                    clearArrows={() => {
                        setArrowCount(0)
                        setBattlePlan(undefined)
                        setClearWarSignal(Date.now())
                        setArrowAssignments({})
                    }}
                    arrowCount={arrowCount}
                    activeArrowType={activeArrowType}
                    setActiveArrowType={setActiveArrowType}
                    arrows={battlePlan?.arrows?.features || []}
                    arrowAssignments={arrowAssignments}
                    onAssignUnits={(arrowId, unitIds) => {
                        setArrowAssignments(prev => ({
                            ...prev,
                            [arrowId]: unitIds
                        }))
                    }}
                />
            )}

            {/* Map Component */}
            <GameMap
                onCountryClick={handleCountryClick}
                warPlanningMode={showWarPlanningModal}
                isDrawingWarArrows={isDrawMode}
                activeArrowType={activeArrowType}
                onWarArrowsUpdate={handleWarArrowsUpdate}
                clearWarArrowsRequest={clearWarSignal}
            />

            {/* UI overlays */}
            <NationInfoPanel />
            <DiplomacyPanel />
            <MilitaryPanel onOpenDefensivePlanning={() => handleLaunchOffensive('PLAYER', nation?.name || 'Player Nation')} />
            <ConsequencesPanel />



            {/* Modals */}
            {phase === 'ANALYSIS' && userPolygon && (
                <TerritoryAnalysisModal
                    polygon={userPolygon as any}
                    onConfirm={() => setPhase('CONSTITUTION')}
                />
            )}
            <ConstitutionModal />
            <ExpansionModal />
            <EventModal />
            {/* Game Over Modal */}
            {gameOver && <GameOverModal />}

            {/* Victory Modal */}
            {currentVictory && (
                <VictoryModal
                    victory={currentVictory}
                    onContinue={() => setCurrentVictory(null)}
                    onNewGame={() => {
                        useGameStore.getState().reset()
                        useWorldStore.getState().reset()
                        window.location.reload()
                    }}
                />
            )}

            {/* Achievement Popup */}
            {currentAchievement && (
                <AchievementPopup
                    achievement={currentAchievement}
                    onDismiss={() => setCurrentAchievement(null)}
                />
            )}

            {/* Victory Progress Panel (bottom right) */}
            {phase === 'RESULTS' && victoryConditions.length > 0 && (
                <div className="absolute bottom-20 right-4 z-10 w-64">
                    <VictoryProgressPanel
                        conditions={victoryConditions}
                        onViewDetails={(type) => console.log('View victory:', type)}
                    />
                </div>
            )}

            {/* Game Log */}
            <GameLog />

            {/* Breaking News Banner */}
            <BreakingNews />

            {/* Diplomacy Action Modal */}
            {selectedCountryForDiplomacy && (
                <DiplomacyActionModal
                    countryCode={selectedCountryForDiplomacy}
                    onClose={() => setSelectedCountryForDiplomacy(null)}
                    onLaunchOffensive={handleLaunchOffensive}
                />
            )}

            {/* Claim Action Modal */}
            {selectedClaimId && (
                <ClaimActionModal
                    claimId={selectedClaimId}
                    onClose={() => setSelectedClaim(null)}
                    onLaunchOffensive={handleLaunchOffensive}
                    onFundSeparatists={(claimId, amount) => {
                        console.log('💰 Funding separatists:', claimId, amount)
                        useGameStore.getState().updateBudget(-amount)

                        // Find target country and add unrest
                        const claim = useGameStore.getState().activeClaims.find(c => c.id === claimId)
                        if (claim) {
                            const primaryTarget = [...claim.targetCountries].sort((a, b) => b.areaClaimedKm2 - a.areaClaimedKm2)[0]
                            if (primaryTarget) {
                                useGameStore.getState().addDiplomaticEvents([{
                                    id: `fund-separatists-${Date.now()}`,
                                    type: 'INSURGENCY',
                                    severity: 2,
                                    title: 'Separatist Funding',
                                    description: `We have secretly funded separatist groups in ${primaryTarget.name}.`,
                                    affectedNations: [primaryTarget.code],
                                    timestamp: Date.now()
                                }])
                            }
                        }
                    }}
                />
            )}

            {/* Right Panel - Diplomacy/Stats */}
            {showDiplomacyPanel && (phase === 'RESULTS' || phase === 'EXPANSION') && (
                <div className="absolute top-20 right-4 w-80 h-[calc(100vh-6rem)] z-10">
                    <DiplomacyPanel />
                </div>
            )}

            {/* Coalition Panel */}
            {showCoalitionPanel && (
                <CoalitionPanel onClose={() => setShowCoalitionPanel(false)} />
            )}

            {/* Floating Action Buttons */}
            {(phase === 'RESULTS' || phase === 'EXPANSION') && (
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                    <button
                        onClick={() => setShowDiplomacyPanel(!showDiplomacyPanel)}
                        className={`p-3 rounded-full shadow-lg border transition-all ${showDiplomacyPanel
                            ? 'bg-blue-600 text-white border-blue-400'
                            : 'bg-slate-800/90 hover:bg-slate-700 text-white border-slate-600'
                            }`}
                        title="Diplomacy & Relations"
                    >
                        🌐
                    </button>
                    <button
                        onClick={() => setShowCoalitionPanel(true)}
                        className="p-3 bg-slate-800/90 hover:bg-slate-700 text-white rounded-full shadow-lg border border-slate-600 transition-all"
                        title="Coalitions"
                    >
                        🤝
                    </button>
                    <button
                        onClick={() => setShowWarsPanel(true)}
                        className="p-3 bg-red-900/90 hover:bg-red-800 text-white rounded-full shadow-lg border border-red-600 transition-all animate-pulse"
                        title="Active Conflicts"
                    >
                        ⚔️
                    </button>
                </div>
            )}

            {/* Wars Panel */}
            {showWarsPanel && (
                <ActiveWarsPanel
                    onClose={() => setShowWarsPanel(false)}
                    onFocusWar={(war) => {
                        console.log('Focusing war:', war.id)
                        setShowWarsPanel(false)
                        // TODO: Implement focus logic (move camera)
                    }}
                />
            )}

            {/* Instructions - only show during drawing phase */}
            {
                phase === 'DRAWING' && (
                    <div className="absolute bottom-14 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                        <p className="text-sm text-gray-300">
                            <span className="text-orange-400">Click</span> to draw points •
                            <span className="text-orange-400 ml-1">Double-click</span> to complete your borders
                        </p>
                    </div>
                )
            }

            {/* Expansion mode indicator */}
            {
                phase === 'EXPANSION' && (
                    <div className="absolute bottom-14 left-4 z-10 bg-red-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-red-500/30">
                        <p className="text-sm text-red-300">
                            🏴 <span className="font-bold">EXPANSION MODE</span> — Draw territory to claim
                        </p>
                    </div>
                )
            }

            {/* Locked borders indicator */}
            {
                phase === 'RESULTS' && (
                    <div className="absolute bottom-14 left-4 z-10 bg-slate-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                        <p className="text-sm text-gray-300">
                            Click <span className="text-orange-400">🏴 Claim Territory</span> to expand •
                            <span className="text-gray-400 ml-1">Use Diplomacy panel to interact</span>
                        </p>
                    </div>
                )
            }

            {/* News Ticker */}
            {(phase === 'RESULTS' || phase === 'EXPANSION' || diplomaticEvents.length > 0) && <NewsTicker />}
        </div>
    )
}

export default App
