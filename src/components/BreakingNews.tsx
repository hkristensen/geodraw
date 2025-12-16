import { useGameStore } from '../store/gameStore'
import { useEffect, useState } from 'react'
import { DiplomaticEvent } from '../types/game'

export function BreakingNews() {
    const events = useGameStore(state => state.diplomaticEvents)
    const [currentNews, setCurrentNews] = useState<DiplomaticEvent | null>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (events.length === 0) return

        const latest = events[events.length - 1]

        // Only show major events (severity 2 or 3)
        if (latest.severity >= 2) {
            setCurrentNews(latest)
            setIsVisible(true)

            // Hide after 8 seconds
            const timer = setTimeout(() => {
                setIsVisible(false)
            }, 8000)

            return () => clearTimeout(timer)
        }
    }, [events])

    if (!currentNews || !isVisible) return null

    return (
        <div className="absolute bottom-0 left-0 right-0 z-50 bg-red-600 text-white py-2 px-4 shadow-lg overflow-hidden">
            <div className="flex items-center gap-4 animate-in slide-in-from-bottom duration-500">
                <div className="bg-white text-red-600 font-black px-2 py-0.5 text-sm uppercase tracking-wider rounded-sm whitespace-nowrap">
                    Breaking News
                </div>
                <div className="text-lg font-bold truncate flex-1">
                    {currentNews.title}: {currentNews.description}
                </div>
                <div className="text-xs opacity-75 whitespace-nowrap">
                    {new Date(currentNews.timestamp).toLocaleTimeString()}
                </div>
            </div>
        </div>
    )
}
