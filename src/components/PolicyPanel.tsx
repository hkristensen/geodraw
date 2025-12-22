import { useGameStore } from '../store/gameStore'
import { POLICIES } from '../data/policies'

export function PolicyPanel({ onClose }: { onClose: () => void }) {
    const { activePolicies, enactPolicy, revokePolicy, updateUnrest } = useGameStore()

    const handleToggle = (policyId: string, isActive: boolean, unrestImpact: number) => {
        if (isActive) {
            revokePolicy(policyId)
            // Revoking might reduce unrest or cause stability hit? For now, let's say it causes half impact
            updateUnrest(Math.abs(unrestImpact) / 2)
        } else {
            enactPolicy(policyId)
            updateUnrest(unrestImpact)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-purple-500/20 flex justify-between items-center bg-slate-800/50">
                    <div>
                        <h2 className="text-2xl font-bold text-purple-400">National Policies</h2>
                        <p className="text-gray-400 text-sm">Shape your nation's society and laws</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                </div>

                {/* Policies List */}
                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {POLICIES.map(policy => {
                        const isActive = activePolicies.includes(policy.id)

                        return (
                            <div
                                key={policy.id}
                                className={`p-4 rounded-xl border transition-all flex justify-between items-center ${isActive
                                        ? 'bg-purple-900/20 border-purple-500/50'
                                        : 'bg-slate-800 border-gray-700 hover:border-purple-500/30'
                                    }`}
                            >
                                <div className="flex-1 mr-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-700 text-gray-300">{policy.category}</span>
                                        <h4 className={`font-bold ${isActive ? 'text-purple-300' : 'text-gray-200'}`}>{policy.name}</h4>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-2">{policy.description}</p>
                                    <div className="flex gap-3 text-xs">
                                        <span className="text-red-400">Unrest: {policy.unrestImpact > 0 ? '+' : ''}{policy.unrestImpact}</span>
                                        <span className="text-gray-500">Monthly: {policy.monthlyUnrestChange > 0 ? '+' : ''}{policy.monthlyUnrestChange}/mo</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleToggle(policy.id, isActive, policy.unrestImpact)}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${isActive
                                            ? 'bg-red-900/50 text-red-400 hover:bg-red-900/80 border border-red-500/30'
                                            : 'bg-purple-600 hover:bg-purple-500 text-white'
                                        }`}
                                >
                                    {isActive ? 'Revoke' : 'Enact'}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
