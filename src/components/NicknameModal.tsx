import { useState } from 'react'

interface NicknameModalProps {
    onSubmit: (nickname: string) => void
    onCancel?: () => void
    title?: string
}

export function NicknameModal({ onSubmit, onCancel, title = 'Enter Your Name' }: NicknameModalProps) {
    const [nickname, setNickname] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = () => {
        const trimmed = nickname.trim()
        if (trimmed.length < 2) {
            setError('Name must be at least 2 characters')
            return
        }
        if (trimmed.length > 20) {
            setError('Name must be 20 characters or less')
            return
        }
        onSubmit(trimmed)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4 border border-white/10 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-4 text-center">
                    {title}
                </h2>

                <div className="mb-4">
                    <input
                        type="text"
                        value={nickname}
                        onChange={(e) => {
                            setNickname(e.target.value)
                            setError('')
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder="Your nickname..."
                        className="w-full px-4 py-3 bg-slate-700 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                        autoFocus
                        maxLength={20}
                    />
                    {error && (
                        <p className="text-red-400 text-sm mt-2">{error}</p>
                    )}
                </div>

                <div className="flex gap-3">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={nickname.trim().length < 2}
                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    )
}
