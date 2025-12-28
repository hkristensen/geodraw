import { useState, useEffect } from 'react'

export type MobilePanel = 'map' | 'nation' | 'diplomacy' | 'military' | 'more'

interface MobileNavProps {
    activePanel: MobilePanel
    setActivePanel: (panel: MobilePanel) => void
    hasWars?: boolean
    hasNotifications?: boolean
}

export function MobileNav({ activePanel, setActivePanel, hasWars, hasNotifications }: MobileNavProps) {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Hide on desktop
    if (!isMobile) return null

    const tabs: { id: MobilePanel; icon: string; label: string; badge?: boolean }[] = [
        { id: 'map', icon: '🗺️', label: 'Map' },
        { id: 'nation', icon: '🏛️', label: 'Nation' },
        { id: 'diplomacy', icon: '🌐', label: 'World', badge: hasWars },
        { id: 'military', icon: '🪖', label: 'Army' },
        { id: 'more', icon: '⚙️', label: 'More', badge: hasNotifications },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-slate-700 safe-area-bottom">
            <div className="flex justify-around items-center h-16">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActivePanel(tab.id)}
                        className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${activePanel === tab.id
                                ? 'text-orange-400'
                                : 'text-gray-400 active:text-white'
                            }`}
                    >
                        <span className="text-xl relative">
                            {tab.icon}
                            {tab.badge && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                            )}
                        </span>
                        <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
                        {activePanel === tab.id && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-400 rounded-full" />
                        )}
                    </button>
                ))}
            </div>
        </nav>
    )
}

// Hook to check if on mobile
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    return isMobile
}
