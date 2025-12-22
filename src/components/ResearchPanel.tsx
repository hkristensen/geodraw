import { useGameStore } from '../store/gameStore'
import { RESEARCH_TREE } from '../data/research'

export function ResearchPanel({ onClose }: { onClose: () => void }) {
    const { researchPoints, unlockedTechs, unlockTech, addResearchPoints } = useGameStore()

    const handleUnlock = (techId: string, cost: number) => {
        if (researchPoints >= cost) {
            addResearchPoints(-cost)
            unlockTech(techId)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-blue-500/30 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-blue-500/20 flex justify-between items-center bg-slate-800/50">
                    <div>
                        <h2 className="text-2xl font-bold text-blue-400">Research & Development</h2>
                        <p className="text-gray-400 text-sm">Unlock new technologies to advance your nation</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-900/40 px-4 py-2 rounded-lg border border-blue-500/30">
                            <span className="text-blue-300 font-mono text-xl">{Math.floor(researchPoints)} RP</span>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                    </div>
                </div>

                {/* Tech Tree */}
                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {['MILITARY', 'ECONOMY', 'CIVIC'].map(category => (
                        <div key={category} className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-300 border-b border-gray-700 pb-2 mb-4">{category}</h3>
                            {RESEARCH_TREE.filter(t => t.category === category).map(tech => {
                                const isUnlocked = unlockedTechs.includes(tech.id)
                                const isAffordable = researchPoints >= tech.cost
                                const hasPrereqs = !tech.prerequisites || tech.prerequisites.every(p => unlockedTechs.includes(p))
                                const isLocked = !hasPrereqs && !isUnlocked

                                return (
                                    <div
                                        key={tech.id}
                                        className={`p-4 rounded-xl border transition-all ${isUnlocked
                                                ? 'bg-blue-900/20 border-blue-500/50'
                                                : isLocked
                                                    ? 'bg-gray-900/50 border-gray-800 opacity-50 grayscale'
                                                    : 'bg-slate-800 border-gray-700 hover:border-blue-500/50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className={`font-bold ${isUnlocked ? 'text-blue-300' : 'text-gray-200'}`}>{tech.name}</h4>
                                            {isUnlocked && <span className="text-green-400 text-xs">✓</span>}
                                        </div>
                                        <p className="text-xs text-gray-400 mb-3 min-h-[40px]">{tech.description}</p>

                                        {!isUnlocked && (
                                            <button
                                                disabled={!isAffordable || isLocked}
                                                onClick={() => handleUnlock(tech.id, tech.cost)}
                                                className={`w-full py-2 rounded text-sm font-bold transition-colors ${isLocked
                                                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                                        : isAffordable
                                                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                                            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                                    }`}
                                            >
                                                {isLocked ? 'Locked' : `Research (${tech.cost} RP)`}
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
