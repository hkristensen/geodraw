import { useWorldStore } from '../store/worldStore'
import type { AIWar } from '../types/game'

interface ActiveWarsPanelProps {
    onClose: () => void
    onFocusWar: (war: AIWar) => void
}

export function ActiveWarsPanel({ onClose, onFocusWar }: ActiveWarsPanelProps) {
    const { aiWars, aiCountries } = useWorldStore()
    const activeWars = aiWars.filter(w => w.status === 'active')

    // Sort by most recent start time
    activeWars.sort((a, b) => b.startTime - a.startTime)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-800/50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">⚔️</span>
                        <div>
                            <h2 className="text-xl font-bold text-white">Global Conflicts</h2>
                            <p className="text-xs text-gray-400 uppercase tracking-widest">{activeWars.length} ACTIVE WARS</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-4 space-y-3 flex-1">
                    {activeWars.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p className="text-4xl mb-2">🕊️</p>
                            <p>Global Peace prevails.</p>
                            <p className="text-sm opacity-50 mt-1">No active wars reported.</p>
                        </div>
                    ) : (
                        activeWars.map(war => {
                            const attacker = aiCountries.get(war.attackerCode)
                            const defender = aiCountries.get(war.defenderCode)

                            if (!attacker || !defender) return null

                            // Calculate progress bar widths
                            // Normalize somewhat for visual display
                            const attackerWidth = 50 + ((war.attackerGain || 0) - (war.defenderGain || 0)) / 2

                            return (
                                <div key={war.id} className="bg-slate-800/50 border border-white/5 rounded-lg p-4 hover:border-white/10 transition-colors">
                                    {/* Countries Header */}
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="text-right flex-1">
                                                <div className="font-bold text-red-400 text-lg leading-tight">{attacker.name}</div>
                                                <div className="text-[10px] text-red-300/50 uppercase tracking-widest font-mono">Aggressor</div>
                                            </div>
                                            <div className="text-xl">vs</div>
                                            <div className="text-left flex-1">
                                                <div className="font-bold text-blue-400 text-lg leading-tight">{defender.name}</div>
                                                <div className="text-[10px] text-blue-300/50 uppercase tracking-widest font-mono">Defender</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onFocusWar(war)}
                                            className="ml-4 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-mono uppercase tracking-wide transition-colors"
                                        >
                                            Locate 🎯
                                        </button>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                                        {/* Center marker */}
                                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 z-10" />

                                        {/* Bar */}
                                        <div
                                            className="absolute top-0 bottom-0 left-0 bg-red-500/80 transition-all duration-500"
                                            style={{ width: `${Math.max(0, Math.min(100, attackerWidth))}%` }}
                                        />
                                        <div
                                            className="absolute top-0 bottom-0 right-0 bg-blue-500/80 transition-all duration-500"
                                            style={{ left: `${Math.max(0, Math.min(100, attackerWidth))}%` }}
                                        />
                                    </div>

                                    {/* Stats */}
                                    <div className="flex justify-between text-xs text-gray-400 font-mono">
                                        <span>{(war.attackerGain || 0).toFixed(1)}% Captured</span>
                                        <span>
                                            {(war.attackerGain || 0) > (war.defenderGain || 0)
                                                ? `${attacker.name} Winning`
                                                : (war.defenderGain || 0) > (war.attackerGain || 0)
                                                    ? `${defender.name} Winning`
                                                    : 'Stalemate'
                                            }
                                        </span>
                                        <span>{(war.defenderGain || 0).toFixed(1)}% Captured</span>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
