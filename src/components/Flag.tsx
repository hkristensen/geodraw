import type { FlagData } from '../types/game'

interface FlagProps {
    flag: FlagData
    className?: string
}

export function Flag({ flag, className = '' }: FlagProps) {
    const { pattern, colors } = flag
    const [c1, c2, c3] = colors

    return (
        <div className={`overflow-hidden relative ${className}`} style={{ backgroundColor: c1 }}>
            <svg viewBox="0 0 120 80" className="w-full h-full" preserveAspectRatio="none">
                {pattern === 'tricolor-v' && (
                    <>
                        <rect x="0" y="0" width="40" height="80" fill={c1} />
                        <rect x="40" y="0" width="40" height="80" fill={c2} />
                        <rect x="80" y="0" width="40" height="80" fill={c3} />
                    </>
                )}

                {pattern === 'tricolor-h' && (
                    <>
                        <rect x="0" y="0" width="120" height="26.6" fill={c1} />
                        <rect x="0" y="26.6" width="120" height="26.6" fill={c2} />
                        <rect x="0" y="53.2" width="120" height="26.8" fill={c3} />
                    </>
                )}

                {pattern === 'cross' && (
                    <>
                        <rect x="0" y="0" width="120" height="80" fill={c1} />
                        <rect x="30" y="0" width="20" height="80" fill={c2} />
                        <rect x="0" y="30" width="120" height="20" fill={c2} />
                    </>
                )}

                {pattern === 'saltire' && (
                    <>
                        <rect x="0" y="0" width="120" height="80" fill={c1} />
                        <path d="M0 0 L120 80 L120 70 L10 0 Z" fill={c2} />
                        <path d="M120 0 L0 80 L0 70 L110 0 Z" fill={c2} />
                        <path d="M0 10 L110 80 L120 80 L10 0 Z" fill={c2} />
                        <path d="M120 10 L10 80 L0 80 L110 0 Z" fill={c2} />
                    </>
                )}

                {pattern === 'circle' && (
                    <>
                        <rect x="0" y="0" width="120" height="80" fill={c1} />
                        <circle cx="60" cy="40" r="20" fill={c2} />
                    </>
                )}

                {pattern === 'checkered' && (
                    <>
                        <rect x="0" y="0" width="60" height="40" fill={c1} />
                        <rect x="60" y="0" width="60" height="40" fill={c2} />
                        <rect x="0" y="40" width="60" height="40" fill={c2} />
                        <rect x="60" y="40" width="60" height="40" fill={c1} />
                    </>
                )}
                {pattern === 'canton' && (
                    <>
                        <rect x="0" y="0" width="120" height="80" fill={c1} />
                        <rect x="0" y="0" width="60" height="40" fill={c2} />
                    </>
                )}

                {pattern === 'triangle' && (
                    <>
                        <rect x="0" y="0" width="120" height="80" fill={c1} />
                        <path d="M0 0 L60 40 L0 80 Z" fill={c2} />
                    </>
                )}

                {/* Symbols Overlay */}
                {flag.symbol && flag.symbol !== 'none' && (
                    <g transform="translate(60, 40)" fill={flag.symbolColor || c3}>
                        {flag.symbol === 'star' && (
                            <path d="M0,-20 L5,-5 L20,-5 L8,5 L12,20 L0,10 L-12,20 L-8,5 L-20,-5 L-5,-5 Z" />
                        )}
                        {flag.symbol === 'crescent' && (
                            <path d="M-10,-15 A 20,20 0 1,0 -10,15 A 16,16 0 1,1 -10,-15 Z" transform="scale(0.8)" />
                        )}
                        {flag.symbol === 'sun' && (
                            <g>
                                <circle r="10" />
                                <path d="M0,-20 L4,-12 M0,20 L-4,12 M20,0 L12,4 M-20,0 L-12,-4 M14,-14 L10,-8 M-14,14 L-10,8 M14,14 L10,8 M-14,-14 L-10,-8" stroke={flag.symbolColor || c3} strokeWidth="2" />
                            </g>
                        )}
                        {flag.symbol === 'eagle' && (
                            <path d="M0,-15 Q15,-20 25,-10 T30,5 L20,0 L25,10 Q10,15 0,10 Q-10,15 -25,10 L-20,0 L-30,5 T-25,-10 Q-15,-20 0,-15 Z M0,-15 L0,10" transform="scale(0.8)" />
                        )}
                        {flag.symbol === 'shield' && (
                            <path d="M-15,-15 H15 V5 Q15,20 0,25 Q-15,20 -15,5 Z" />
                        )}
                        {flag.symbol === 'crown' && (
                            <path d="M-15,10 L-15,-5 L-10,0 L0,-10 L10,0 L15,-5 L15,10 Z M-15,10 H15" />
                        )}
                        {flag.symbol === 'swords' && (
                            <g stroke={flag.symbolColor || c3} strokeWidth="3">
                                <path d="M-15,-15 L15,15 M-15,15 L15,-15" />
                            </g>
                        )}
                        {flag.symbol === 'skull' && (
                            <g>
                                <circle r="10" cy="-5" />
                                <rect x="-8" y="5" width="16" height="10" rx="2" />
                                <circle cx="-4" cy="-5" r="3" fill={c1} />
                                <circle cx="4" cy="-5" r="3" fill={c1} />
                            </g>
                        )}
                        {flag.symbol === 'laurel' && (
                            <path d="M-20,10 Q-25,0 -15,-10 Q-10,-15 0,-18 Q10,-15 15,-10 Q25,0 20,10 M-20,10 Q-15,5 -15,0 M20,10 Q15,5 15,0" fill="none" stroke={flag.symbolColor || c3} strokeWidth="2" />
                        )}
                    </g>
                )}
            </svg>
        </div>
    )
}
