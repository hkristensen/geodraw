import { useGameStore } from '../store/gameStore'
import { useEffect, useState } from 'react'
import { DiplomaticEvent } from '../types/game'
import { useIsMobile } from './MobileNav'

export function BreakingNews() {
    const events = useGameStore(state => state.diplomaticEvents)
    const [currentNews, setCurrentNews] = useState<DiplomaticEvent | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    const isMobile = useIsMobile()

    useEffect(() => {
        if (events.length === 0) return

        const latest = events[events.length - 1]

        // Reserved for the most critical events only (severity 3) - severity 2 is
        // left to NewsTicker/GameLog, otherwise this banner fires often enough to
        // permanently cover the ticker it shares the bottom of the screen with.
        if (latest.severity >= 3) {
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
        <div
            className={`absolute left-0 right-0 z-50 bg-red-600 text-white py-2 px-4 shadow-lg overflow-hidden ${isMobile ? 'bottom-24' : 'bottom-10'}`}
        >
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
