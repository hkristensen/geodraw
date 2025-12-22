import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { ActiveBattle } from '../types/game'
import countriesData from '../data/countries.json'
import type { FeatureCollection } from 'geojson'

interface BattleIndicatorProps {
    battle: ActiveBattle
}

export function BattleIndicator({ battle }: BattleIndicatorProps) {
    const {
        dismissBattle,
        updateNationSoldiers,
        addTerritory,
        removeTerritory,
        addDiplomaticEvents,
        annexCountry,
        currentClaim,
        removeActiveClaim,
        setCurrentClaim
    } = useGameStore()

    const {
        updateCountrySoldiers: updateAISoldiers,
        updateOccupation,
        annexCountry: annexAICountry,
        makePeace,
        updateRelations
    } = useWorldStore()

    const [currentRound, setCurrentRound] = useState(0)
    const [isFinished, setIsFinished] = useState(false)
    const [hasAppliedResult, setHasAppliedResult] = useState(false)

    const totalRounds = battle.result.rounds.length
    const durationPerRound = 100 // ms

    // Animation loop
    useEffect(() => {
        const interval = setInterval(() => {
            const elapsed = Date.now() - battle.startTime
            const round = Math.min(totalRounds, Math.floor(elapsed / durationPerRound))

            setCurrentRound(round)

            if (round >= totalRounds) {
                setIsFinished(true)
                clearInterval(interval)
            }
        }, 100)

        return () => clearInterval(interval)
    }, [battle.startTime, totalRounds])

    // Apply results when finished
    useEffect(() => {
        if (isFinished && !hasAppliedResult) {
            applyResult()
            setHasAppliedResult(true)
        }
    }, [isFinished, hasAppliedResult])

    const applyResult = () => {
        console.log('🏁 Battle finished, applying result:', battle.id)
        const { result, isPlayerAttacker, isPlayerDefender, attackerCode, defenderCode, initialAttackerSoldiers, initialDefenderSoldiers } = battle

        // 1. Update Soldiers
        if (isPlayerDefender) {
            // Player is Defender
            const delta = result.defenderSoldiersRemaining - initialDefenderSoldiers
            updateNationSoldiers(delta)

            // AI is Attacker
            const aiDelta = result.attackerSoldiersRemaining - initialAttackerSoldiers
            updateAISoldiers(attackerCode, aiDelta)
        } else if (isPlayerAttacker) {
            // Player is Attacker
            const delta = result.attackerSoldiersRemaining - initialAttackerSoldiers
            updateNationSoldiers(delta)

            // AI is Defender
            const aiDelta = result.defenderSoldiersRemaining - initialDefenderSoldiers
            updateAISoldiers(defenderCode, aiDelta)
        } else {
            // AI vs AI (not implemented yet, but good to have)
            const atkDelta = result.attackerSoldiersRemaining - initialAttackerSoldiers
            updateAISoldiers(attackerCode, atkDelta)

            const defDelta = result.defenderSoldiersRemaining - initialDefenderSoldiers
            updateAISoldiers(defenderCode, defDelta)
        }

        // 2. Handle Territory Changes
        if (result.winner === 'attacker') {
            if (isPlayerAttacker) {
                // PLAYER WON OFFENSIVE
                handlePlayerVictory(battle)
            } else if (isPlayerDefender) {
                // PLAYER LOST DEFENSIVE
                handlePlayerDefeat(battle)
            }
        } else {
            // Defender Won
            if (isPlayerAttacker) {
                // PLAYER LOST OFFENSIVE
                handlePlayerDefeat(battle)
            } else if (isPlayerDefender) {
                // PLAYER WON DEFENSIVE
                handlePlayerDefenseVictory(battle)
            }
        }
    }

    const handlePlayerVictory = (battle: ActiveBattle) => {
        const { defenderCode, defenderName, result, claimId } = battle

        // Calculate territory gained
        // Base gain 5% + up to 20% based on decisiveness
        const gain = 5 + Math.round(result.decisiveness * 20)
        updateOccupation(defenderCode, gain)

        // Check if fully annexed
        const storeCountry = useWorldStore.getState().aiCountries.get(defenderCode)
        const newOccupation = (storeCountry?.territoryLost || 0) + gain

        if (newOccupation >= 100 || (result.decisiveness > 0.8 && !claimId)) {
            // Full Annexation
            annexCountry(defenderCode)
            annexAICountry(defenderCode)

            const countryFeature = (countriesData as FeatureCollection).features.find(
                f => f.properties?.iso_a3 === defenderCode
            )
            if (countryFeature) addTerritory(countryFeature)

            addDiplomaticEvents([{
                id: `annex-${Date.now()}`,
                type: 'ANNEXATION',
                severity: 3,
                title: 'Full Annexation',
                description: `You have completely conquered ${defenderName}!`,
                affectedNations: [defenderCode],
                timestamp: Date.now()
            }])
            makePeace(defenderCode)
        } else {
            // Dynamic Conquest
            const countryFeature = (countriesData as FeatureCollection).features.find(
                f => f.properties?.iso_a3 === defenderCode
            )
            const playerPoly = useGameStore.getState().playerTerritories[0]

            // Handle Claim-based conquest
            if (claimId) {
                const claim = useGameStore.getState().activeClaims.find(c => c.id === claimId)
                if (claim && claim.polygon) {
                    console.log('🏴 Claim victory! Adding claim polygon as territory')

                    // If decisive victory (>0.8), add the entire claim
                    if (result.decisiveness > 0.8) {
                        addTerritory(claim.polygon)
                    } else {
                        // Partial victory - add portion of claim based on decisiveness
                        // For simplicity, we add the whole claim but could use calculateConquest
                        import('../utils/territoryUtils').then(({ calculateConquest }) => {
                            const conquest = calculateConquest(
                                playerPoly as any,
                                claim.polygon as any,
                                result.decisiveness,
                                undefined,
                                battle.plan,
                                battle.location
                            )
                            if (conquest) {
                                addTerritory(conquest)
                            } else {
                                // Fallback: if conquest calc fails, add the claim scaled by decisiveness
                                // For now, just add the whole claim on any victory
                                console.log('⚠️ Conquest calc failed, adding full claim')
                                addTerritory(claim.polygon)
                            }
                        })
                    }

                    const targetInfo = claim.targetCountries.find(t => t.code === defenderCode)
                    if (targetInfo) updateOccupation(defenderCode, targetInfo.percentageClaimed)
                    removeActiveClaim(claimId)
                    if (currentClaim?.id === claimId) setCurrentClaim(null)
                }
            } else if (countryFeature && playerPoly) {
                // No claim - general conquest, buffer from player territory
                import('../utils/territoryUtils').then(({ calculateConquest }) => {
                    const conquest = calculateConquest(
                        playerPoly as any,
                        countryFeature as any,
                        result.decisiveness,
                        undefined,
                        battle.plan,
                        battle.location
                    )
                    if (conquest) addTerritory(conquest)
                })
            }

            addDiplomaticEvents([{
                id: `victory-${Date.now()}`,
                type: 'PEACE_TREATY',
                severity: 2,
                title: 'Victory',
                description: `You defeated ${defenderName} and seized territory.`,
                affectedNations: [defenderCode],
                timestamp: Date.now()
            }])
            // Do NOT make peace automatically. War continues.
        }
    }

    const handlePlayerDefeat = (battle: ActiveBattle) => {
        const { attackerCode, attackerName, defenderCode, defenderName, result, isPlayerDefender } = battle
        const enemyCode = isPlayerDefender ? attackerCode : defenderCode
        const enemyName = isPlayerDefender ? attackerName : defenderName

        if (isPlayerDefender) {
            // Lost territory to enemy
            const playerPoly = useGameStore.getState().playerTerritories[0]
            const enemyFeature = (countriesData as FeatureCollection).features.find(
                f => f.properties?.iso_a3 === enemyCode
            )

            if (playerPoly && enemyFeature) {
                import('../utils/territoryUtils').then(({ calculateConquest }) => {
                    const lostArea = calculateConquest(
                        enemyFeature as any,
                        playerPoly as any,
                        result.decisiveness,
                        undefined,
                        undefined,
                        battle.location
                    )
                    if (lostArea) {
                        removeTerritory(lostArea)
                        updateOccupation(enemyCode, -10) // Rough estimate
                    }
                })
            }
        } else {
            // Failed offensive
            updateRelations(enemyCode, -50)
        }

        addDiplomaticEvents([{
            id: `defeat-${Date.now()}`,
            type: 'WAR_DECLARED', // Keep as WAR_DECLARED or BATTLE_LOST?
            severity: 3,
            title: 'Defeat',
            description: `You lost the battle against ${enemyName}.`,
            affectedNations: [enemyCode],
            timestamp: Date.now()
        }])
        // Do NOT make peace automatically.
    }

    const handlePlayerDefenseVictory = (battle: ActiveBattle) => {
        const { attackerCode, attackerName } = battle
        addDiplomaticEvents([{
            id: `defended-${Date.now()}`,
            type: 'PEACE_TREATY', // Change to DEFENSE_SUCCESS?
            severity: 1,
            title: 'Invasion Repelled',
            description: `You successfully defended against ${attackerName}.`,
            affectedNations: [attackerCode],
            timestamp: Date.now()
        }])
        // Do NOT make peace automatically.
    }

    // Calculate current soldiers for display
    const currentAttackerSoldiers = Math.max(0, battle.initialAttackerSoldiers - (battle.result.rounds[currentRound - 1]?.attackerLosses || 0))
    const currentDefenderSoldiers = Math.max(0, battle.initialDefenderSoldiers - (battle.result.rounds[currentRound - 1]?.defenderLosses || 0))

    const attackerLost = battle.initialAttackerSoldiers - currentAttackerSoldiers
    const defenderLost = battle.initialDefenderSoldiers - currentDefenderSoldiers

    const formatNumber = (num: number): string => {
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
        if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
        return num.toString()
    }

    return (
        <div className="bg-slate-900/90 backdrop-blur border border-white/10 rounded-lg shadow-xl p-3 w-64 pointer-events-auto mb-2">
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-bold text-gray-400 uppercase">
                    {battle.isPlayerAttacker ? '⚔️ Offensive' : battle.isPlayerDefender ? '🛡️ Defensive' : '⚔️ Battle'}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        dismissBattle(battle.id)
                    }}
                    className="text-gray-500 hover:text-white"
                >
                    ×
                </button>
            </div>

            {/* Combatants */}
            <div className="flex justify-between items-center text-sm mb-2">
                <div className={`font-bold ${battle.isPlayerAttacker ? 'text-orange-400' : 'text-red-400'}`}>
                    {battle.attackerName}
                </div>
                <div className="text-gray-500 text-xs">vs</div>
                <div className={`font-bold ${battle.isPlayerDefender ? 'text-orange-400' : 'text-red-400'}`}>
                    {battle.defenderName}
                </div>
            </div>

            {/* Bars */}
            <div className="space-y-3 mb-2">
                {/* Attacker */}
                <div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
                        <div
                            className="h-full bg-red-500 transition-all duration-300"
                            style={{ width: `${(currentAttackerSoldiers / battle.initialAttackerSoldiers) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                        <span>Lost: {formatNumber(attackerLost)}</span>
                        <span>(Total: {formatNumber(battle.initialAttackerSoldiers)})</span>
                    </div>
                </div>

                {/* Defender */}
                <div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${(currentDefenderSoldiers / battle.initialDefenderSoldiers) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                        <span>Lost: {formatNumber(defenderLost)}</span>
                        <span>(Total: {formatNumber(battle.initialDefenderSoldiers)})</span>
                    </div>
                </div>
            </div>

            {/* Status */}
            <div className="text-xs text-center border-t border-white/10 pt-2 mt-2">
                {isFinished ? (
                    <span className={battle.result.winner === 'attacker' ? 'text-red-400' : 'text-blue-400'}>
                        {battle.result.winner === 'attacker' ? `${battle.attackerName} Won!` : `${battle.defenderName} Won!`}
                    </span>
                ) : (
                    <span className="text-gray-400">Fighting...</span>
                )}
            </div>
        </div>
    )
}
