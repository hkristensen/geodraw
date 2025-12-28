import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { useMultiplayerStore } from '../store/multiplayerStore'

interface MultiplayerStatusModalProps {
    isOpen: boolean
    onClose: () => void
    gameId?: string
}

export function MultiplayerStatusModal({ isOpen, onClose, gameId }: MultiplayerStatusModalProps) {
    const { user, nickname, lobbyCode, isHost, isSpectator } = useMultiplayerStore()
    const remotePlayers = useGameStore(state => state.remotePlayers)
    const [copied, setCopied] = useState(false)

    if (!isOpen) return null

    const copyCode = () => {
        if (lobbyCode) {
            navigator.clipboard.writeText(lobbyCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="bg-slate-800/95 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        🌐 Multiplayer Game
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl"
                    >
                        ✕
                    </button>
                </div>

                {/* Game Info */}
                <div className="space-y-4">
                    {/* Lobby Code */}
                    {lobbyCode && (
                        <div className="bg-slate-700/50 rounded-lg p-4">
                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                                Game Code
                            </div>
                            <button
                                onClick={copyCode}
                                className="text-2xl font-mono font-bold tracking-widest text-white hover:text-blue-400 transition-colors"
                            >
                                {lobbyCode}
                                <span className="text-sm ml-2">{copied ? '✓' : '📋'}</span>
                            </button>
                            <div className="text-gray-500 text-xs mt-1">
                                Share with friends to let them join
                            </div>
                        </div>
                    )}

                    {/* Your Info */}
                    <div className="bg-slate-700/50 rounded-lg p-4">
                        <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                            Your Status
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                                {nickname?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                                <div className="text-white font-medium">
                                    {nickname || 'Unknown'}
                                    {isHost && <span className="ml-2 text-yellow-400 text-xs">👑 Host</span>}
                                </div>
                                <div className="text-gray-400 text-sm">
                                    {isSpectator ? '👁️ Spectator' : '🎮 Player'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Game ID */}
                    {gameId && (
                        <div className="bg-slate-700/50 rounded-lg p-4">
                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                                Game ID
                            </div>
                            <div className="text-gray-300 text-sm font-mono truncate">
                                {gameId}
                            </div>
                        </div>
                    )}

                    {/* Players List */}
                    <div className="bg-slate-700/50 rounded-lg p-4">
                        <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                            Active Players ({Object.keys(remotePlayers).length})
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                            {Object.values(remotePlayers).length === 0 ? (
                                <div className="text-gray-400 text-sm italic">Waiting for sync...</div>
                            ) : (
                                Object.values(remotePlayers).map(player => (
                                    <div key={player.id} className="flex items-center gap-3 p-2 rounded bg-slate-800/50">
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm border border-white/20"
                                            style={{ backgroundColor: player.color }}
                                        >
                                            {player.nickname.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-white text-sm font-medium flex items-center gap-2">
                                                {player.nickname}
                                                {player.id === user?.uid && <span className="text-xs bg-slate-600 px-1.5 rounded text-gray-300">YOU</span>}
                                            </div>
                                            <div className="text-gray-400 text-xs">
                                                {player.countryCode ? `playing as ${player.countryCode}` : 'Spectating'}
                                            </div>
                                        </div>
                                        <div className={`text-xs ${player.isAlive ? 'text-green-400' : 'text-red-400'}`}>
                                            {player.isAlive ? 'Alive' : 'Defeated'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Connection Status */}
                    <div className="bg-slate-700/50 rounded-lg p-4">
                        <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                            Connection
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-green-400 text-sm">Connected</span>
                        </div>
                        {user && (
                            <div className="text-gray-500 text-xs mt-1">
                                ID: {user.uid.slice(0, 8)}...
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
