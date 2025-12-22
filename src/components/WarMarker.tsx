import type { AIWar } from '../types/game'

interface WarMarkerProps {
    war: AIWar
    attackerName: string
    defenderName: string
}

export function WarMarker({ war, attackerName, defenderName }: WarMarkerProps) {
    // Determine status color
    // Determine status color - logic moved to jsx


    return (
        <div className="group relative flex flex-col items-center justify-center transform hover:scale-110 transition-transform duration-200 pointer-events-none">
            {/* Pulsing Background */}
            {war.status === 'active' && (
                <div className="absolute w-full h-full bg-red-500/30 rounded-full animate-ping opacity-75" />
            )}

            {/* Icon Container */}
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-red-900 to-slate-900 border-2 border-red-500/50 shadow-lg flex items-center justify-center backdrop-blur-sm z-10 cursor-help pointer-events-auto">
                <span className="text-lg filter drop-shadow-lg">⚔️</span>
            </div>

            {/* Tooltip (Hover) */}
            <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 min-w-[180px]">
                <div className="bg-slate-900/95 backdrop-blur-md border border-red-500/30 rounded-lg p-3 shadow-2xl">
                    <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2 text-center border-b border-white/10 pb-1">
                        Active Conflict
                    </div>

                    {/* Status Text */}
                    <div className="text-center mb-3">
                        <div className="text-xs font-mono mb-1 text-gray-400">Current Status</div>
                        <div className={`text-sm font-bold ${(war.attackerGain || 0) > (war.defenderGain || 0) + 5 ? 'text-red-400' :
                            (war.defenderGain || 0) > (war.attackerGain || 0) + 5 ? 'text-blue-400' :
                                'text-yellow-400'
                            }`}>
                            {(war.attackerGain || 0) > (war.defenderGain || 0) + 5 ? `${attackerName} Advancing` :
                                (war.defenderGain || 0) > (war.attackerGain || 0) + 5 ? `${defenderName} Defending` :
                                    'Frontline Stalemate'}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden flex mb-1">
                        <div className="bg-red-500 transition-all duration-500" style={{ width: `${50 + ((war.attackerGain || 0) - (war.defenderGain || 0)) / 2}%` }} />
                        <div className="bg-blue-500 transition-all duration-500 flex-1" />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 font-mono items-center">
                        <div className="flex flex-col items-start">
                            <span className="text-[9px] uppercase tracking-widest text-red-400/70">Aggressor</span>
                            <span>{(war.attackerGain || 0).toFixed(0)}%</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] uppercase tracking-widest text-blue-400/70">Defender</span>
                            <span>{(war.defenderGain || 0).toFixed(0)}%</span>
                        </div>
                    </div>
                </div>

                {/* Arrow */}
                <div className="absolute left-1/2 -bottom-1 w-2 h-2 bg-slate-900 border-r border-b border-red-500/30 transform rotate-45 -translate-x-1/2"></div>
            </div>
        </div>
    )
}
