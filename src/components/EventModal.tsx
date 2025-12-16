import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'

export function EventModal() {
    const { currentEvent, resolveEvent } = useGameStore()
    const gameStore = useGameStore.getState()
    const worldStore = useWorldStore.getState()

    if (!currentEvent) return null

    const handleOption = (index: number) => {
        const option = currentEvent.options[index]
        if (option) {
            option.effect(gameStore, worldStore)
        }
        resolveEvent()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-900/40 to-slate-900 p-6 border-b border-amber-500/20 flex items-center gap-4">
                    <div className="text-4xl">{currentEvent.icon || '📜'}</div>
                    <div>
                        <div className="text-amber-500 font-bold uppercase tracking-wider text-sm mb-1">
                            Random Event
                        </div>
                        <h2 className="text-2xl font-bold text-white">
                            {currentEvent.title}
                        </h2>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    <p className="text-lg text-gray-300 leading-relaxed mb-8">
                        {currentEvent.description}
                    </p>

                    {/* Options */}
                    <div className="grid gap-4">
                        {currentEvent.options.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleOption(index)}
                                className="group relative overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/50 rounded-xl p-4 text-left transition-all"
                            >
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <div className="font-bold text-amber-100 group-hover:text-amber-400 transition-colors mb-1">
                                            {option.label}
                                        </div>
                                        <div className="text-sm text-gray-400 group-hover:text-gray-300">
                                            {option.description}
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-500">
                                        ➜
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
