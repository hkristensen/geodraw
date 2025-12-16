import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { simulateWar, WarResult, BattleIntensity } from '../utils/warSystem'
import countriesData from '../data/countries.json'
import type { FeatureCollection } from 'geojson'

interface WarModalProps {
    countryCode: string
    countryName: string
    territory?: GeoJSON.Feature
    onClose: () => void
    isDefender?: boolean
    isOffensive?: boolean
}

export function WarModal({ countryCode, countryName, territory, onClose, isDefender = false, isOffensive = false }: WarModalProps) {
    const { nation, updateNationSoldiers, addDiplomaticEvents, annexCountry, addTerritory, currentClaim } = useGameStore()
    const { aiCountries, makePeace, updateRelations, updateOccupation, annexCountry: annexAICountry } = useWorldStore()

    const [warState, setWarState] = useState<'ready' | 'fighting' | 'victory' | 'defeat'>('ready')
    const [currentRound, setCurrentRound] = useState(0)
    const [attackerSoldiers, setAttackerSoldiers] = useState(0)
    const [defenderSoldiers, setDefenderSoldiers] = useState(0)
    const [initialAttackerSoldiers, setInitialAttackerSoldiers] = useState(0)
    const [initialDefenderSoldiers, setInitialDefenderSoldiers] = useState(0)
    const [totalRounds, setTotalRounds] = useState(0)
    const [warResult, setWarResult] = useState<WarResult | null>(null)
    const [intensity, setIntensity] = useState<BattleIntensity>('standard')
    const animationRef = useRef<number | null>(null)

    // Get country from store or create fallback
    const storeCountry = aiCountries.get(countryCode)
    const enemyCountry = storeCountry || {
        code: countryCode,
        name: countryName,
        population: 1000000, // Fallback population
        territoryLost: 0,
        disposition: 'neutral',
        relations: 0,
        power: 50,
        economy: 50,
        authority: 50,
        soldiers: 10000,
        religion: 'Unaffiliated',
        modifiers: [],
        isAtWar: false
    }

    // Calculate defender soldiers based on territory and population
    const getDefenderSoldiers = () => {
        // Use actual current soldiers from store
        const totalSoldiers = (enemyCountry as any).soldiers || 10000

        // If fighting for a specific claim, only a portion of the army is engaged
        // Scale based on the percentage of the country being claimed
        if (currentClaim) {
            const targetInfo = currentClaim.targetCountries.find(t => t.code === countryCode)
            if (targetInfo) {
                // Base engagement is proportional to claim size
                // e.g. claiming 5% of country -> 5% of army defends
                // Minimum 2% to represent local garrison
                const engagementFactor = Math.max(0.02, targetInfo.percentageClaimed / 100)
                return Math.round(totalSoldiers * Math.min(1.0, engagementFactor))
            }
        }

        return totalSoldiers
    }

    // Initialize soldiers
    useEffect(() => {
        if (nation) {
            const playerSoldiers = nation.stats.soldiers
            const enemySoldiers = getDefenderSoldiers()

            if (isDefender) {
                // Player is defending: Enemy is Attacker, Player is Defender
                setAttackerSoldiers(enemySoldiers)
                setDefenderSoldiers(playerSoldiers)
                setInitialAttackerSoldiers(enemySoldiers)
                setInitialDefenderSoldiers(playerSoldiers)
            } else {
                // Player is attacking: Player is Attacker, Enemy is Defender
                setAttackerSoldiers(playerSoldiers)
                setDefenderSoldiers(enemySoldiers)
                setInitialAttackerSoldiers(playerSoldiers)
                setInitialDefenderSoldiers(enemySoldiers)
            }
        }
    }, [nation, countryCode, currentClaim, isDefender]) // Added isDefender dependency

    // Cleanup animation on unmount
    useEffect(() => {
        return () => {
            if (animationRef.current) {
                clearTimeout(animationRef.current)
            }
        }
    }, [])

    const startWar = () => {
        if (!nation || !enemyCountry) return

        setWarState('fighting')

        // Run war simulation
        const result = simulateWar(initialAttackerSoldiers, initialDefenderSoldiers, intensity)
        setWarResult(result)
        setTotalRounds(result.rounds.length)

        // Animate through rounds quickly (50ms per round)
        let roundIndex = 0
        let currentAtk = initialAttackerSoldiers
        let currentDef = initialDefenderSoldiers

        const animateRound = () => {
            if (roundIndex < result.rounds.length) {
                const round = result.rounds[roundIndex]
                currentAtk = Math.max(0, currentAtk - round.attackerLosses)
                currentDef = Math.max(0, currentDef - round.defenderLosses)

                setCurrentRound(roundIndex + 1)
                setAttackerSoldiers(currentAtk)
                setDefenderSoldiers(currentDef)

                roundIndex++
                animationRef.current = window.setTimeout(animateRound, 80) // 80ms per round
            } else {
                // War ended
                finishWar(result)
            }
        }

        animationRef.current = window.setTimeout(animateRound, 300)
    }

    // Auto-start defensive wars
    useEffect(() => {
        if (isDefender && warState === 'ready' && nation && enemyCountry) {
            // Small delay to let the modal open and user see "THEY ARE ATTACKING"
            const timer = setTimeout(() => {
                startWar()
            }, 1500)
            return () => clearTimeout(timer)
        }
    }, [isDefender, warState, nation, enemyCountry])

    const finishWar = (result: WarResult) => {
        if (!nation) return

        const { removeTerritory } = useGameStore.getState()
        const { updateCountrySoldiers: updateAISoldiers } = useWorldStore.getState()

        // Update nation soldiers (pass delta)
        if (isDefender) {
            const delta = result.defenderSoldiersRemaining - initialDefenderSoldiers
            updateNationSoldiers(delta)

            // Update AI soldiers (Attacker)
            const aiDelta = result.attackerSoldiersRemaining - initialAttackerSoldiers
            updateAISoldiers(countryCode, aiDelta)
        } else {
            const delta = result.attackerSoldiersRemaining - initialAttackerSoldiers
            updateNationSoldiers(delta)

            // Update AI soldiers (Defender)
            const aiDelta = result.defenderSoldiersRemaining - initialDefenderSoldiers
            updateAISoldiers(countryCode, aiDelta)
        }

        // DYNAMIC BORDER SHIFTING LOGIC
        // Import utils dynamically or assume they are available
        // We need to import them at the top of the file first.
        // For now, let's assume we'll add the import.

        if (result.winner === 'attacker') {
            // If player is attacker (normal war)
            if (!isDefender) {
                setWarState('victory')

                // Calculate territory gained
                // If offensive war, we gain occupation %
                if (isOffensive) {
                    // Base gain 5% + up to 20% based on decisiveness
                    const gain = 5 + Math.round(result.decisiveness * 20)
                    updateOccupation(countryCode, gain)

                    // Check if fully annexed
                    const newOccupation = (storeCountry?.territoryLost || 0) + gain

                    if (newOccupation >= 100) {
                        // Full annexation!
                        annexCountry(countryCode)
                        annexAICountry(countryCode)

                        // Find geometry to merge
                        const countryFeature = (countriesData as FeatureCollection).features.find(
                            f => f.properties?.iso_a3 === countryCode
                        )

                        if (countryFeature) {
                            addTerritory(countryFeature)
                        }

                        addDiplomaticEvents([{
                            id: `annex-${Date.now()}`,
                            type: 'ANNEXATION',
                            severity: 3,
                            title: 'Full Annexation',
                            description: `You have completely conquered ${countryName}!`,
                            affectedNations: [countryCode],
                            timestamp: Date.now()
                        }])
                        makePeace(countryCode)
                    } else {
                        // DYNAMIC BORDER SHIFT: Gain territory based on decisiveness
                        // Only if we have a valid enemy geometry to take from
                        const countryFeature = (countriesData as FeatureCollection).features.find(
                            f => f.properties?.iso_a3 === countryCode
                        )

                        // And we need our own geometry (attacker)
                        const playerPoly = useGameStore.getState().playerTerritories[0]

                        if (countryFeature && playerPoly) {
                            // Calculate conquest
                            import('../utils/territoryUtils').then(({ calculateConquest }) => {
                                const conquest = calculateConquest(
                                    playerPoly as any,
                                    countryFeature as any,
                                    result.decisiveness,
                                    currentClaim?.polygon as any
                                )

                                if (conquest) {
                                    console.log('⚔️ Dynamic Conquest Successful!', conquest)
                                    addTerritory(conquest)
                                }
                            })
                        }

                        // Just occupation gain
                        addDiplomaticEvents([{
                            id: `occupy-${Date.now()}`,
                            type: 'WAR_DECLARED', // Reuse type
                            severity: 2,
                            title: 'Territory Occupied',
                            description: `Offensive successful! You pushed the front line forward.`,
                            affectedNations: [countryCode],
                            timestamp: Date.now()
                        }])
                    }
                } else if (result.decisiveness > 0.8 && !currentClaim) {
                    // Legacy: Full annexation if super decisive in initial invasion AND no specific claim
                    annexCountry(countryCode)
                    annexAICountry(countryCode)

                    // Find geometry to merge
                    const countryFeature = (countriesData as FeatureCollection).features.find(
                        f => f.properties?.iso_a3 === countryCode
                    )

                    if (countryFeature) {
                        addTerritory(countryFeature)
                    }

                    addDiplomaticEvents([{
                        id: `annex-${Date.now()}`,
                        type: 'ANNEXATION',
                        severity: 3,
                        title: 'Full Annexation',
                        description: `You have completely conquered ${countryName}!`,
                        affectedNations: [countryCode],
                        timestamp: Date.now()
                    }])
                    makePeace(countryCode)

                    // If we have the territory geometry, add it to our own
                    if (territory) {
                        addTerritory(territory)
                    }
                } else {
                    // Partial victory or Claim victory
                    updateRelations(countryCode, -50)
                    makePeace(countryCode)

                    if (currentClaim) {
                        console.log('🏳️ Taking claimed territory:', currentClaim.id)

                        // Always award the claimed territory if we won
                        // BUT now we might want to scale it?
                        // For now, let's stick to full claim award if specifically fighting for it
                        // UNLESS we want to use the dynamic system here too?
                        // User said: "depending on the decisiveness... border will instantly move"

                        // Let's try to use the dynamic calculation for claims too
                        // But fallback to full claim if it fails or is super decisive

                        if (result.decisiveness > 0.6) {
                            addTerritory(currentClaim.polygon)
                        } else {
                            // Partial claim conquest?
                            // Let's use the utility
                            const playerPoly = useGameStore.getState().playerTerritories[0]
                            const countryFeature = (countriesData as FeatureCollection).features.find(
                                f => f.properties?.iso_a3 === countryCode
                            )

                            if (playerPoly && countryFeature) {
                                import('../utils/territoryUtils').then(({ calculateConquest }) => {
                                    const conquest = calculateConquest(
                                        playerPoly as any,
                                        countryFeature as any,
                                        result.decisiveness,
                                        currentClaim.polygon as any
                                    )

                                    if (conquest) {
                                        addTerritory(conquest)
                                    } else {
                                        // Fallback
                                        addTerritory(currentClaim.polygon)
                                    }
                                })
                            } else {
                                addTerritory(currentClaim.polygon)
                            }
                        }

                        // Update occupation to 100% of the claim
                        const targetInfo = currentClaim.targetCountries.find(t => t.code === countryCode)
                        if (targetInfo) {
                            updateOccupation(countryCode, targetInfo.percentageClaimed)
                        }

                        // Remove the claim as it is now fulfilled
                        const { removeActiveClaim, setCurrentClaim } = useGameStore.getState()
                        removeActiveClaim(currentClaim.id)
                        setCurrentClaim(null)

                        addDiplomaticEvents([{
                            id: `conquest-${Date.now()}`,
                            type: 'PEACE_TREATY',
                            severity: 2,
                            title: 'Territory Conquered',
                            description: `You have successfully seized territory from ${countryName}.`,
                            affectedNations: [countryCode],
                            timestamp: Date.now()
                        }])
                    } else {
                        // No specific claim, just pillaging
                        // But maybe we should gain some land?
                        // "if i have a claim... attack it... border will move"
                        // If no claim, maybe just pillage.

                        addDiplomaticEvents([{
                            id: `victory-${Date.now()}`,
                            type: 'PEACE_TREATY',
                            severity: 1,
                            title: 'Victory',
                            description: `You defeated ${countryName} but had no active territorial claim to enforce.`,
                            affectedNations: [countryCode],
                            timestamp: Date.now()
                        }])
                    }
                }
            } else {
                // Player is defender and LOST (Attacker won)
                setWarState('defeat')
                updateNationSoldiers(0)

                // DYNAMIC BORDER SHIFT: Player loses territory!
                // Enemy (Attacker) takes land from Player (Defender)
                const playerPoly = useGameStore.getState().playerTerritories[0]
                const enemyFeature = (countriesData as FeatureCollection).features.find(
                    f => f.properties?.iso_a3 === countryCode
                )

                if (playerPoly && enemyFeature) {
                    import('../utils/territoryUtils').then(({ calculateConquest }) => {
                        // Calculate what the enemy takes
                        // Enemy is attacker, Player is defender
                        const lostArea = calculateConquest(
                            enemyFeature as any,
                            playerPoly as any,
                            result.decisiveness
                        )

                        if (lostArea) {
                            console.log('😱 Lost territory to enemy!', lostArea)
                            removeTerritory(lostArea)

                            // Update AI occupation (they gained land)
                            // Calculate percentage of player land lost
                            // This is tricky as we don't track "Player Territory Lost" metric usually
                            // But we should track it for the AI's "territoryLost" metric (which is negative if they gain?)
                            // Actually, AI gaining land means their territoryLost decreases (or goes negative)
                            // Let's assume 10% gain for now as a rough estimate based on decisiveness
                            const gainPercent = 5 + Math.round(result.decisiveness * 10)
                            updateOccupation(countryCode, -gainPercent)

                            addDiplomaticEvents([{
                                id: `lost-land-${Date.now()}`,
                                type: 'WAR_DECLARED',
                                severity: 3,
                                title: 'Territory Lost!',
                                description: `The enemy has pushed their borders into your land!`,
                                affectedNations: [countryCode],
                                timestamp: Date.now()
                            }])
                        }
                    })
                }

                // If we have a claim and we attacked and lost, we should lose some claim progress
                if (!isDefender && currentClaim) {
                    const targetInfo = currentClaim.targetCountries.find(t => t.code === countryCode)
                    if (targetInfo) {
                        // Lose 10-20% of claim progress
                        const lossFactor = 0.1 + (Math.random() * 0.1)
                        const lossAmount = targetInfo.percentageClaimed * lossFactor

                        updateOccupation(countryCode, -lossAmount)

                        addDiplomaticEvents([{
                            id: `lost-claim-${Date.now()}`,
                            type: 'WAR_DECLARED', // Reuse type
                            severity: 2,
                            title: 'Offensive Failed',
                            description: `Your forces were repelled and you lost control over some of the disputed territory.`,
                            affectedNations: [countryCode],
                            timestamp: Date.now()
                        }])
                    }
                } else {
                    // Standard defeat
                    addDiplomaticEvents([{
                        id: `lost-war-${Date.now()}`,
                        type: 'WAR_DECLARED', // Reusing type for now
                        severity: 3,
                        title: 'Defeat!',
                        description: `You lost the war against ${countryName}. They have pillaged your lands.`,
                        affectedNations: [countryCode],
                        timestamp: Date.now()
                    }])
                }

                makePeace(countryCode)
            }
        } else {
            // Defender won
            if (!isDefender) {
                // Player was attacker and LOST
                setWarState('defeat')
                updateNationSoldiers(0)
                updateRelations(countryCode, -30)
                makePeace(countryCode)
            } else {
                // Player was defender and WON
                setWarState('victory')

                // Maybe gain some land back? (Revanchism)
                // For now just defend.

                addDiplomaticEvents([{
                    id: `defended-${Date.now()}`,
                    type: 'PEACE_TREATY',
                    severity: 1,
                    title: 'Invasion Repelled',
                    description: `You successfully defended against ${countryName}.`,
                    affectedNations: [countryCode],
                    timestamp: Date.now()
                }])
                makePeace(countryCode)
            }
        }
    }

    if (!nation || !enemyCountry) {
        return null
    }

    const attackerLosses = initialAttackerSoldiers - attackerSoldiers
    const defenderLosses = initialDefenderSoldiers - defenderSoldiers

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className={`bg-slate-900 border ${isDefender ? 'border-red-500/30' : 'border-orange-500/30'} rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden`}>
                {/* Header */}
                <div className={`p-6 border-b ${isDefender ? 'bg-red-900/30 border-red-500/30' : 'bg-gradient-to-r from-orange-600/20 to-amber-600/20 border-orange-500/20'}`}>
                    <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-3">
                        <span className="text-3xl">⚔️</span>
                        {isDefender ? `DEFENDING AGAINST ${countryName.toUpperCase()}` : `WAR WITH ${countryName.toUpperCase()}`}
                        <span className="text-3xl">⚔️</span>
                    </h2>
                    {isDefender && (
                        <p className="text-red-400 text-center mt-2 font-bold animate-pulse">
                            ⚠️ THEY ARE ATTACKING OUR BORDERS!
                        </p>
                    )}
                </div>

                {/* Battle Display */}
                <div className="p-6">
                    {/* Armies */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        {/* Left Side (Attacker usually, but Player if defending) */}
                        <div className="text-center">
                            <div className={`text-lg font-bold mb-2 ${isDefender ? 'text-red-400' : 'text-orange-400'}`}>
                                {isDefender ? `🛡️ ${countryName}` : `🏴 ${nation.name}`}
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">
                                {isDefender ? attackerSoldiers.toLocaleString() : attackerSoldiers.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-400">soldiers</div>
                            {attackerLosses > 0 && (
                                <div className="text-red-400 text-sm mt-1">
                                    -{attackerLosses.toLocaleString()} lost
                                </div>
                            )}
                        </div>

                        {/* Right Side (Defender usually, but Enemy if defending) */}
                        <div className="text-center">
                            <div className={`text-lg font-bold mb-2 ${isDefender ? 'text-orange-400' : 'text-red-400'}`}>
                                {isDefender ? `🏴 ${nation.name}` : `🛡️ ${countryName}`}
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">
                                {isDefender ? defenderSoldiers.toLocaleString() : defenderSoldiers.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-400">soldiers</div>
                            {defenderLosses > 0 && (
                                <div className="text-red-400 text-sm mt-1">
                                    -{defenderLosses.toLocaleString()} lost
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progress bar during fighting */}
                    {warState === 'fighting' && (
                        <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                            <div
                                className="bg-orange-500 h-2 rounded-full transition-all duration-100"
                                style={{ width: `${(currentRound / totalRounds) * 100}%` }}
                            />
                        </div>
                    )}

                    {/* Result */}
                    {warState === 'victory' && (
                        <div className="text-center p-4 bg-green-900/30 rounded-lg border border-green-500/30 mb-4">
                            <div className="text-3xl mb-2">🏆</div>
                            <div className="text-xl font-bold text-green-400">VICTORY!</div>
                            <p className="text-sm text-gray-400 mt-1">
                                {isDefender
                                    ? "You have successfully repelled the invaders!"
                                    : (warResult?.decisiveness || 0) > 0.8
                                        ? `${countryName} has been fully annexed!`
                                        : `Claimed ${Math.round((warResult?.decisiveness || 0) * 100)}% of disputed territory.`
                                }
                            </p>
                        </div>
                    )}

                    {warState === 'defeat' && (
                        <div className="text-center p-4 bg-red-900/30 rounded-lg border border-red-500/30 mb-4">
                            <div className="text-3xl mb-2">💀</div>
                            <div className="text-xl font-bold text-red-400">DEFEAT!</div>
                            <p className="text-sm text-gray-400 mt-1">
                                {isDefender
                                    ? "Your defenses have crumbled. The enemy is pillaging your lands."
                                    : "Your forces have been repelled."
                                }
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        {warState === 'ready' && (
                            <>
                                {/* Battle Intensity Selection */}
                                {!isDefender && (
                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                        {(['skirmish', 'standard', 'total_war'] as const).map((mode) => (
                                            <button
                                                key={mode}
                                                onClick={() => setIntensity(mode)}
                                                className={`py-2 px-1 rounded text-xs font-bold border transition-all ${intensity === mode
                                                    ? 'bg-orange-600 border-orange-400 text-white'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {mode === 'skirmish' && '⚡ Skirmish'}
                                                {mode === 'standard' && '⚔️ Standard'}
                                                {mode === 'total_war' && '☠️ Total War'}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={startWar}
                                        className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
                                    >
                                        {isDefender ? '🛡️ Defend Borders' : '⚔️ Begin Battle'}
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold rounded-lg transition-colors"
                                    >
                                        {isDefender ? 'Surrender' : 'Retreat'}
                                    </button>
                                </div>
                                {!isDefender && (
                                    <p className="text-xs text-center text-slate-500 mt-1">
                                        {intensity === 'skirmish' && "Low risk, low reward. Good for probing defenses."}
                                        {intensity === 'standard' && "Balanced engagement."}
                                        {intensity === 'total_war' && "High casualties, high reward. Fight to the death."}
                                    </p>
                                )}
                            </>
                        )}

                        {warState === 'fighting' && (
                            <div className="w-full text-center text-gray-400">
                                Battle in progress...
                            </div>
                        )}

                        {(warState === 'victory' || warState === 'defeat') && (
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
                            >
                                Continue
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
