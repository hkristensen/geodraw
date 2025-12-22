import { useWorldStore } from '../store/worldStore'
// import { useGameStore } from '../store/gameStore'

interface WarDetailModalProps {
    warId: string
    onClose: () => void
}

export function WarDetailModal({ warId, onClose }: WarDetailModalProps) {
    const { aiWars, aiCountries } = useWorldStore()

    // Find the war (either AI-AI or Player-AI)
    // Currently aiWars only stores AI-AI. 
    // Player wars are in activeBattles in gameStore, but we need to unify viewing them?
    // For now let's support AI wars first as requested.
    const aiWar = aiWars.find(w => w.id === warId)

    if (!aiWar) return null

    const attacker = aiCountries.get(aiWar.attackerCode)
    const defender = aiCountries.get(aiWar.defenderCode)

    if (!attacker || !defender) return null

    const attackerLosses = aiWar.casualties?.attacker || 0
    const defenderLosses = aiWar.casualties?.defender || 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 border-b border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="animate-pulse text-red-500 text-xs font-bold px-2 py-0.5 border border-red-500/50 rounded-full bg-red-900/20">LIVE WAR</span>
                        <span className="text-gray-400 text-sm font-mono">#{aiWar.id.slice(-6)}</span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
                </div>

                {/* Conflict Status */}
                <div className="p-6 grid grid-cols-[1fr,auto,1fr] gap-8 items-center bg-slate-900/80">
                    {/* Attacker */}
                    <div className="text-center space-y-2">
                        <div className="text-4xl">⚔️</div>
                        <h2 className="text-xl font-bold text-red-400">{attacker.name}</h2>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-400 uppercase tracking-widest">Attacker</span>
                            <div className="mt-2 px-3 py-1 bg-red-900/30 border border-red-500/20 rounded text-red-200 font-mono text-sm">
                                {attackerLosses.toLocaleString()} Casualties
                            </div>
                        </div>
                    </div>

                    {/* VS */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="text-2xl font-black text-white/20 italic">VS</div>
                        <div className="px-2 py-1 bg-slate-800 rounded text-xs text-gray-400 font-mono">
                            {Math.floor((Date.now() - aiWar.startTime) / 1000)}s duration
                        </div>
                    </div>

                    {/* Defender */}
                    <div className="text-center space-y-2">
                        <div className="text-4xl">🛡️</div>
                        <h2 className="text-xl font-bold text-blue-400">{defender.name}</h2>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-400 uppercase tracking-widest">Defender</span>
                            <div className="mt-2 px-3 py-1 bg-blue-900/30 border border-blue-500/20 rounded text-blue-200 font-mono text-sm">
                                {defenderLosses.toLocaleString()} Casualties
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress Bars */}
                <div className="px-6 pb-6 space-y-6">
                    {/* Territory Control */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-gray-400 uppercase">
                            <span>Attacker Control (+{aiWar.attackerGain}%)</span>
                            <span>Defender Control (+{aiWar.defenderGain}%)</span>
                        </div>
                        <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                            {/* Attacker Bar */}
                            <div
                                className="bg-red-500 transition-all duration-1000 ease-out"
                                style={{ width: `${50 + (aiWar.attackerGain / 2) - (aiWar.defenderGain / 2)}%` }}
                            />
                            {/* Defender Bar (Implicit remainder) */}
                            <div className="flex-1 bg-blue-500" />
                        </div>
                    </div>

                    {/* War Plans / Objectives */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                        <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                            <span>🗺️</span> Strategic Objectives
                        </h3>
                        {aiWar.planArrow ? (
                            <div className="flex items-center gap-3 p-2 bg-slate-900 rounded border border-white/5">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <div className="text-sm text-gray-300">
                                    <span className="font-bold text-red-400">Operation Rolling Thunder</span>
                                    <span className="block text-xs text-gray-500">Direct assault on {defender.name} capital region.</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 italic">No specific war plans intercepted.</div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-900 border-t border-white/5 p-3 text-center text-xs text-gray-500">
                    Watching live feed from satellites...
                </div>
            </div>
        </div>
    )
}
