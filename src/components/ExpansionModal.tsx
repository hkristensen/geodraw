import { useState, useMemo } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'

export function ExpansionModal() {
    const {
        phase,
        currentClaim,
        nation,
        setCurrentClaim,
        setPhase,
        addDiplomaticEvents,
    } = useGameStore()

    const { aiCountries } = useWorldStore()

    const [result, setResult] = useState<{
        success: boolean
        message: string
        territoryPercent: number
    } | null>(null)

    // Get info about target countries - MUST be before any early returns
    const targetInfo = useMemo(() => {
        if (!currentClaim) return []
        return currentClaim.targetCountries.map(tc => {
            const aiCountry = aiCountries.get(tc.code)
            const soldiers = aiCountry
                ? Math.max(100, Math.round(aiCountry.population * (100 - aiCountry.territoryLost) / 100 * 0.02))
                : 1000
            return {
                ...tc,
                relations: aiCountry?.relations ?? 0,
                soldiers,
                disposition: aiCountry?.disposition ?? 'neutral',
            }
        })
    }, [currentClaim, aiCountries])

    const playerSoldiers = nation?.stats?.soldiers ?? 1000
    const totalEnemySoldiers = targetInfo.reduce((sum, t) => sum + t.soldiers, 0)


    // Only show when we have a pending claim
    if (phase !== 'EXPANSION' || !currentClaim || currentClaim.status !== 'pending') {
        return null
    }





    const handleClose = () => {
        setCurrentClaim(null)
        setPhase('RESULTS')
        setResult(null)
    }

    const handleCancel = () => {
        setCurrentClaim(null)
        setPhase('RESULTS')
    }

    // If we have a result, show it
    if (result) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-slate-900 border border-orange-500/30 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                    <div className={`p - 6 ${result.success ? 'bg-green-900/30' : 'bg-red-900/30'} `}>
                        <div className="text-center">
                            <div className="text-4xl mb-2">{result.success ? '🎉' : '😔'}</div>
                            <h2 className={`text - xl font - bold ${result.success ? 'text-green-400' : 'text-red-400'} `}>
                                {result.success ? 'Success!' : 'Failed'}
                            </h2>
                            <p className="text-gray-300 mt-2">{result.message}</p>
                            {result.success && result.territoryPercent > 0 && (
                                <div className="mt-3 text-sm text-gray-400">
                                    +{result.territoryPercent.toFixed(0)}% of claimed territory added
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="p-4">
                        <button
                            onClick={handleClose}
                            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-orange-500/30 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 p-6 border-b border-orange-500/20">
                    <h2 className="text-2xl font-bold text-white text-center">
                        🏴 Territorial Claim
                    </h2>
                    <p className="text-gray-400 text-center mt-1 text-sm">
                        How will you acquire this territory?
                    </p>
                </div>

                {/* Target Countries */}
                <div className="p-4 bg-black/30 border-b border-white/5">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Affected Nations</h3>
                    <div className="space-y-2">
                        {targetInfo.map(target => (
                            <div key={target.code} className="flex justify-between items-center text-sm">
                                <div>
                                    <span className="text-white">{target.name}</span>
                                    <span className={`ml - 2 text - xs ${target.disposition === 'hostile' ? 'text-red-400' :
                                        target.disposition === 'friendly' ? 'text-green-400' :
                                            'text-gray-400'
                                        } `}>
                                        ({target.relations > 0 ? '+' : ''}{target.relations})
                                    </span>
                                </div>
                                <span className="text-orange-400">{target.percentageClaimed.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs text-gray-400">
                        <span>Your Soldiers: {playerSoldiers.toLocaleString()}</span>
                        <span>Enemy Soldiers: {totalEnemySoldiers.toLocaleString()}</span>
                    </div>
                </div>

                {/* Resolution Options */}
                <div className="p-4 space-y-3">
                    <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded text-sm text-gray-300 mb-4">
                        <p>
                            <strong>ℹ️ Passive Claim:</strong> This will mark the territory as claimed on the map.
                            You can then use Diplomacy to demand it or launch an offensive to seize it.
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            // Apply claims to all target countries
                            currentClaim.targetCountries.forEach(target => {
                                useWorldStore.getState().addClaim(target.code, target.percentageClaimed)
                            })

                            // Add to active claims list for map visualization
                            console.log('📝 Confirming claim:', currentClaim)
                            useGameStore.getState().addActiveClaim({
                                ...currentClaim,
                                status: 'claimed'
                            })

                            // Add diplomatic event
                            addDiplomaticEvents([{
                                id: `claim - ${Date.now()} `,
                                type: 'BORDER_TENSION',
                                severity: 1,
                                title: 'Territory Claimed',
                                description: `We have officially claimed territory in ${currentClaim.targetCountries.map(c => c.name).join(', ')}.`,
                                affectedNations: currentClaim.targetCountries.map(t => t.code),
                                timestamp: Date.now(),
                            }])

                            handleClose()
                        }}
                        className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold rounded-lg shadow-lg transition-all"
                    >
                        ✅ Confirm Claim
                    </button>

                    <button
                        onClick={handleCancel}
                        className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-red-400 hover:text-red-300 font-semibold rounded-lg transition-colors border border-red-900/30"
                    >
                        ✕ Cancel Claim
                    </button>
                </div>
            </div>
        </div>
    )
}
