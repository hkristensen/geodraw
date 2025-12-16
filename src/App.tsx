import { useState, useEffect } from 'react'
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
import { useGameStore } from './store/gameStore'
import { useWorldStore } from './store/worldStore'
import { initCountryData } from './utils/countryData'
import { initInfrastructure } from './utils/infrastructure'
import { calculateEconomy } from './utils/economy'
import { GameOverModal } from './components/GameOverModal'
import { GameLog } from './components/GameLog'
import { BreakingNews } from './components/BreakingNews'
import * as turf from '@turf/turf'
import countriesData from './data/countries.json'

function App() {
    const {
        phase,
        diplomaticEvents,
        userPolygon,
        setPhase,
        consequences,
        selectedClaimId,
        setSelectedClaim,
        nation,
        startBattle,
        gameOver
    } = useGameStore()
    const { initializeAICountries, aiCountries, processAITurn } = useWorldStore()

    // Load data on mount
    useEffect(() => {
        initCountryData()
        initInfrastructure()
    }, [])

    // Safety check: Ensure AI countries are initialized if we have consequences
    useEffect(() => {
        if (consequences.length > 0 && aiCountries.size === 0) {
            console.log('🔄 Re-initializing AI countries from consequences...')
            initializeAICountries(consequences, nation?.constitution)
        }
    }, [consequences, aiCountries, initializeAICountries, nation])

    // AI Turn Loop
    useEffect(() => {
        if (phase !== 'RESULTS') return

        const interval = setInterval(() => {
            const { offensives, wars } = processAITurn()

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
    }, [phase, processAITurn, aiCountries])

    const [selectedCountryForDiplomacy, setSelectedCountryForDiplomacy] = useState<string | null>(null)

    // Economy Loop (Monthly)
    useEffect(() => {
        const interval = setInterval(() => {
            const { nation, infrastructureStats, updateBudget, setNation, advanceDate } = useGameStore.getState()
            if (!nation) return

            const { aiCountries } = useWorldStore.getState()
            const { netIncome, soldierGrowth, stats } = calculateEconomy(nation, infrastructureStats, aiCountries)

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

            // Random Event Trigger (10% chance per month)
            const { currentEvent, triggerEvent } = useGameStore.getState()
            if (!currentEvent && Math.random() < 0.10) {
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

        }, 5000) // 5 seconds = 1 month

        return () => clearInterval(interval)
    }, [])



    const handleLaunchOffensive = (countryCode: string, countryName: string) => {
        if (!nation) return

        // Start offensive battle
        // We need enemy soldiers count
        const enemy = aiCountries.get(countryCode)
        const enemySoldiers = enemy ? enemy.soldiers : 10000

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

        startBattle(
            'PLAYER',
            nation.name,
            countryCode,
            countryName,
            nation.stats.soldiers,
            enemySoldiers,
            'BATTLE',
            true, // isPlayerAttacker
            false, // isPlayerDefender
            undefined, // claimId (could pass if we knew it)
            battleLocation
        )

        setSelectedCountryForDiplomacy(null) // Close diplomacy modal
    }

    return (
        <div className="relative w-full h-screen overflow-hidden bg-slate-900">
            {/* Map layer */}
            <GameMap onCountryClick={setSelectedCountryForDiplomacy} />

            {/* UI overlays */}
            <NationInfoPanel />
            <DiplomacyPanel />
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
                                useGameStore.getState().addModifiers([{
                                    id: `separatists-${Date.now()}`,
                                    countryCode: primaryTarget.code,
                                    countryName: primaryTarget.name,
                                    type: 'UNREST',
                                    intensity: 10,
                                    duration: 12, // 1 year
                                    description: 'Separatist Activity funded by foreign power'
                                }])

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



            {/* Instructions - only show during drawing phase */}
            {phase === 'DRAWING' && (
                <div className="absolute bottom-14 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                    <p className="text-sm text-gray-300">
                        <span className="text-orange-400">Click</span> to draw points •
                        <span className="text-orange-400 ml-1">Double-click</span> to complete your borders
                    </p>
                </div>
            )}

            {/* Expansion mode indicator */}
            {phase === 'EXPANSION' && (
                <div className="absolute bottom-14 left-4 z-10 bg-red-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-red-500/30">
                    <p className="text-sm text-red-300">
                        🏴 <span className="font-bold">EXPANSION MODE</span> — Draw territory to claim
                    </p>
                </div>
            )}

            {/* Locked borders indicator */}
            {phase === 'RESULTS' && (
                <div className="absolute bottom-14 left-4 z-10 bg-slate-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                    <p className="text-sm text-gray-300">
                        Click <span className="text-orange-400">🏴 Claim Territory</span> to expand •
                        <span className="text-gray-400 ml-1">Use Diplomacy panel to interact</span>
                    </p>
                </div>
            )}

            {/* News Ticker */}
            {(phase === 'RESULTS' || phase === 'EXPANSION' || diplomaticEvents.length > 0) && <NewsTicker />}
        </div>
    )
}

export default App
