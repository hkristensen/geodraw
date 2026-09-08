import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { DiplomaticEvent } from '../types/game'

// Template-based news generation
function generateNewsHeadline(event: DiplomaticEvent): string {
    switch (event.type) {
        case 'REVANCHISM':
            return `🔥 BREAKING: ${event.title} - "${event.description}"`
        case 'CAPITAL_CAPTURED':
            return `⚔️ ${event.title} - World leaders react with shock`
        case 'GREAT_POWER_RISE':
            return `👑 ${event.title} - Global balance of power shifts`
        case 'LANDLOCK_WARNING':
            return `⚠️ ${event.title} - International shipping routes disrupted`
        case 'BORDER_TENSION':
            return `📢 ${event.title} - Military forces mobilizing`
        default:
            return `📰 ${event.title}`
    }
}

function getSeverityColor(severity: 1 | 2 | 3): string {
    switch (severity) {
        case 1: return 'text-blue-400'
        case 2: return 'text-yellow-400'
        case 3: return 'text-red-400'
    }
}

interface Headline {
    text: string
    severity: 1 | 2 | 3
}

export function NewsTicker() {
    const { diplomaticEvents, consequences } = useGameStore()
    const [displayedHeadlines, setDisplayedHeadlines] = useState<Headline[]>([])

    // Generate headlines from events and consequences. Each headline carries its
    // own severity so coloring never depends on lining up two differently-shaped,
    // differently-ordered arrays by index.
    useEffect(() => {
        const headlines: Headline[] = []

        // Add diplomatic event headlines
        for (const event of diplomaticEvents) {
            headlines.push({ text: generateNewsHeadline(event), severity: event.severity })
        }

        // Add consequence-based headlines
        for (const consequence of consequences.slice(0, 3)) {
            if (consequence.lostPercentage > 30) {
                headlines.push({
                    text: `📢 ${consequence.countryName} CONDEMNS annexation of ${consequence.lostPercentage.toFixed(0)}% of their territory!`,
                    severity: 2
                })
            } else if (consequence.lostPercentage > 10) {
                headlines.push({
                    text: `📰 ${consequence.countryName} issues formal protest over territorial claims`,
                    severity: 1
                })
            }
        }

        // Add rival country reactions
        const affectedCountryCodes = new Set(consequences.map(c => c.countryCode))
        if (affectedCountryCodes.has('FRA') && !affectedCountryCodes.has('DEU')) {
            headlines.push({ text: `🇩🇪 Germany maintains "neutral stance" on French territorial losses`, severity: 1 })
        }
        if (affectedCountryCodes.has('RUS')) {
            headlines.push({ text: `⚠️ URGENT: Moscow warns of "severe consequences" for territorial violations`, severity: 2 })
        }

        setDisplayedHeadlines(headlines)
    }, [diplomaticEvents, consequences])

    if (displayedHeadlines.length === 0) {
        return null
    }

    // Detect mobile for responsive positioning
    const isMobile = window.innerWidth < 768

    return (
        <div className={`absolute ${isMobile ? 'bottom-16' : 'bottom-0'} left-0 right-0 z-20 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-orange-500/30`}>
            <div className={`flex items-center ${isMobile ? 'h-8' : 'h-10'} overflow-hidden`}>
                {/* Breaking News Label */}
                <div className={`flex-shrink-0 ${isMobile ? 'px-2' : 'px-4'} h-full flex items-center bg-red-600 font-bold text-white ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {isMobile ? '⚡' : 'BREAKING'}
                </div>

                {/* Scrolling Headlines */}
                <div className="flex-1 overflow-hidden">
                    <div className="animate-marquee whitespace-nowrap flex items-center h-full">
                        {displayedHeadlines.map((headline, index) => (
                            <span key={index} className="mx-8 text-sm">
                                <span className={getSeverityColor(headline.severity)}>
                                    {headline.text}
                                </span>
                            </span>
                        ))}
                        {/* Duplicate for seamless loop */}
                        {displayedHeadlines.map((headline, index) => (
                            <span key={`dup-${index}`} className="mx-8 text-sm">
                                <span className={getSeverityColor(headline.severity)}>
                                    {headline.text}
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
