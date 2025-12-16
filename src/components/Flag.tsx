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
            </svg>
        </div>
    )
}
