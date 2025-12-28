import { useGameStore } from '../store/gameStore'

interface NotificationLogProps {
    onClose: () => void
}

export function NotificationLog({ onClose }: NotificationLogProps) {
    const { diplomaticEvents, gameDate } = useGameStore()

    // Sort events by timestamp descending (newest first)
    // Assuming events have timestamp field. If not, use index (reverse).
    const reversedEvents = [...diplomaticEvents].reverse()

    return (
        <div className="bg-slate-900/95 backdrop-blur-md rounded-lg border border-white/20 shadow-2xl flex flex-col h-full max-h-[500px] w-96 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
                <h2 className="text-white font-bold flex items-center gap-2">
                    <span>📜</span> History Log
                </h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    ✕
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {reversedEvents.length === 0 ? (
                    <div className="text-gray-500 text-center py-8 text-sm">
                        No significant events have occurred yet.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {reversedEvents.map((event, index) => (
                            <div key={event.id || index} className="bg-black/20 rounded p-2 border border-white/5 text-sm hover:bg-black/40 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`font-bold ${event.severity === 3 ? 'text-red-400' :
                                            event.severity === 2 ? 'text-yellow-400' :
                                                'text-blue-400'
                                        }`}>
                                        {event.title}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono">
                                        {event.timestamp ? new Date(event.timestamp).toLocaleDateString() : 'Unknown Date'}
                                    </span>
                                </div>
                                <p className="text-gray-300 text-xs leading-relaxed">
                                    {event.description}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-black/50 p-2 text-xs text-center text-gray-500 border-t border-white/5">
                Current Date: {new Date(gameDate).toLocaleDateString()}
            </div>
        </div>
    )
}
