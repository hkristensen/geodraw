import { useGameStore } from '../store/gameStore'
import { useEffect, useState } from 'react'
import { DiplomaticEvent } from '../types/game'

export function GameLog() {
    const events = useGameStore(state => state.diplomaticEvents)
    const [displayEvents, setDisplayEvents] = useState<DiplomaticEvent[]>([])

    useEffect(() => {
        // Keep only the last 5 events
        setDisplayEvents(events.slice(-5).reverse())
    }, [events])

    if (displayEvents.length === 0) return null

    const getIcon = (type: string) => {
        switch (type) {
            case 'WAR_DECLARED': return '⚔️'
            case 'PEACE_TREATY': return '🕊️'
            case 'ANNEXATION': return '🏴'
            case 'LIBERATION': return '🔓'
            case 'ALLIANCE_PROPOSED': return '🤝'
            case 'BORDER_TENSION': return '⚠️'
            default: return '📢'
        }
    }

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-96 pointer-events-none">
            <div className="flex flex-col gap-1 items-center">
                {displayEvents.map((event) => (
                    <div
                        key={event.id}
                        className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 text-xs text-white shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300"
                    >
                        <span>{getIcon(event.type)}</span>
                        <span className="font-medium text-gray-200">{event.description}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
