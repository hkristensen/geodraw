import React from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'

interface ClaimActionModalProps {
    claimId: string
    onClose: () => void
    onLaunchOffensive: (countryCode: string, countryName: string) => void
    onFundSeparatists: (claimId: string, amount: number) => void
}

export function ClaimActionModal({ claimId, onClose, onLaunchOffensive, onFundSeparatists }: ClaimActionModalProps) {
    const { activeClaims, removeActiveClaim, nation } = useGameStore()
    const { aiCountries } = useWorldStore()

    const claim = activeClaims.find(c => c.id === claimId)

    if (!claim) return null

    // Get primary target country
    const primaryTarget = [...claim.targetCountries].sort((a, b) => b.areaClaimedKm2 - a.areaClaimedKm2)[0]
    const targetCountry = primaryTarget ? aiCountries.get(primaryTarget.code) : null

    const handleSeize = () => {
        if (primaryTarget) {
            // Set current claim so WarModal knows we are fighting for this specific claim
            useGameStore.getState().setCurrentClaim(claim)
            onLaunchOffensive(primaryTarget.code, primaryTarget.name)
            onClose()
        }
    }

    const handleFundSeparatists = () => {
        onFundSeparatists(claimId, 1000000) // Fixed amount for now: $1M
        onClose()
    }

    const handleRelinquish = () => {
        removeActiveClaim(claimId)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-orange-500/50 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-900/50 to-slate-900 p-4 border-b border-orange-500/30 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-orange-400 flex items-center gap-2">
                        🏴 Territorial Claim
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Info */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-400">Target Nation:</span>
                            <span className="text-white font-bold">{primaryTarget?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Claimed Area:</span>
                            <span className="text-orange-300">{Math.round(claim.polygon.properties?.areaKm2 || 0).toLocaleString()} km²</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={handleSeize}
                            className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold rounded-lg shadow-lg border border-red-500/30 flex items-center justify-center gap-2 transition-all group"
                        >
                            <span className="text-xl group-hover:scale-110 transition-transform">⚔️</span>
                            Seize Territory (War)
                        </button>

                        <button
                            onClick={handleFundSeparatists}
                            disabled={!nation || nation.stats.budget < 1000000}
                            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg border border-slate-600 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="text-xl">💰</span>
                            Fund Separatists ($1M)
                        </button>

                        <button
                            onClick={handleRelinquish}
                            className="w-full py-2 px-4 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white font-semibold rounded-lg border border-transparent hover:border-slate-600 transition-all"
                        >
                            🏳️ Relinquish Claim
                        </button>

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700/50">
                            <button
                                onClick={() => {
                                    useGameStore.getState().destabilizeTarget(claimId)
                                    onClose()
                                }}
                                disabled={!nation || nation.stats.budget < 5000000}
                                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-orange-400 font-bold rounded-lg border border-slate-600 flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                <span className="text-lg">💣</span>
                                <span>Destabilize</span>
                                <span className="text-xs text-slate-400">$5M</span>
                            </button>

                            <button
                                onClick={() => {
                                    useGameStore.getState().plantPropaganda(claimId)
                                    onClose()
                                }}
                                disabled={!nation || nation.stats.budget < 2000000}
                                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold rounded-lg border border-slate-600 flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                <span className="text-lg">📢</span>
                                <span>Propaganda</span>
                                <span className="text-xs text-slate-400">$2M</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
