import { useState } from 'react'
import { createLobby, joinLobby } from '../firebase/lobby'

interface LobbyScreenProps {
    playerId: string
    nickname: string
    onLobbyJoined: (lobbyCode: string, isHost: boolean) => void
    onCancel: () => void
}

export function LobbyScreen({ playerId, nickname, onLobbyJoined, onCancel }: LobbyScreenProps) {
    const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu')
    const [joinCode, setJoinCode] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [asSpectator, setAsSpectator] = useState(false)

    const handleCreate = async () => {
        setLoading(true)
        setError('')
        try {
            const code = await createLobby(playerId, nickname)
            onLobbyJoined(code, true)
        } catch (err) {
            setError('Failed to create lobby. Please try again.')
            console.error(err)
        }
        setLoading(false)
    }

    const handleJoin = async () => {
        if (joinCode.length !== 6) {
            setError('Code must be 6 characters')
            return
        }

        setLoading(true)
        setError('')
        try {
            const result = await joinLobby(joinCode.toUpperCase(), playerId, nickname, asSpectator)
            if (result.success) {
                onLobbyJoined(joinCode.toUpperCase(), false)
            } else {
                setError(result.error || 'Failed to join lobby')
            }
        } catch (err) {
            setError('Failed to join lobby. Please try again.')
            console.error(err)
        }
        setLoading(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
            <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-8 w-full max-w-lg mx-4 border border-white/10 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                        🌍 GeoDraw
                    </h1>
                    <p className="text-gray-400">Multiplayer</p>
                    <p className="text-sm text-gray-500 mt-2">Playing as <span className="text-blue-400 font-medium">{nickname}</span></p>
                </div>

                {mode === 'menu' ? (
                    <div className="space-y-4">
                        <button
                            onClick={handleCreate}
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3"
                        >
                            <span className="text-2xl">🎮</span>
                            Create Game
                        </button>

                        <button
                            onClick={() => setMode('join')}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3"
                        >
                            <span className="text-2xl">🔗</span>
                            Join Game
                        </button>

                        <button
                            onClick={onCancel}
                            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-xl font-medium transition-colors"
                        >
                            ← Back to Single Player
                        </button>
                    </div>
                ) : mode === 'join' ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Enter Game Code</label>
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => {
                                    setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                                    setError('')
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                                placeholder="ABC123"
                                className="w-full px-4 py-4 bg-slate-700 border border-white/20 rounded-xl text-white text-center text-3xl tracking-[0.5em] font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                                maxLength={6}
                            />
                        </div>

                        <div className="flex items-center gap-3 bg-slate-700/50 rounded-lg p-3">
                            <input
                                type="checkbox"
                                id="spectator"
                                checked={asSpectator}
                                onChange={(e) => setAsSpectator(e.target.checked)}
                                className="w-5 h-5 rounded"
                            />
                            <label htmlFor="spectator" className="text-gray-300 cursor-pointer">
                                👁️ Join as spectator (watch only)
                            </label>
                        </div>

                        {error && (
                            <p className="text-red-400 text-sm text-center">{error}</p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setMode('menu')}
                                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handleJoin}
                                disabled={loading || joinCode.length !== 6}
                                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all"
                            >
                                {loading ? 'Joining...' : 'Join Game'}
                            </button>
                        </div>
                    </div>
                ) : null}

                {loading && mode === 'menu' && (
                    <div className="text-center text-gray-400 mt-4">
                        <div className="animate-spin inline-block w-6 h-6 border-2 border-white/20 border-t-white rounded-full mr-2"></div>
                        Creating lobby...
                    </div>
                )}
            </div>
        </div>
    )
}
