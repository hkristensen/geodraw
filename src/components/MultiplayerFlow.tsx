import { useEffect, useState } from 'react'
import { useMultiplayerStore } from '../store/multiplayerStore'
import { signInAnonymous, setPlayerNickname, onAuthChange } from '../firebase/auth'
import { NicknameModal } from './NicknameModal'
import { LobbyScreen } from './LobbyScreen'
import { LobbyWaiting } from './LobbyWaiting'

interface MultiplayerFlowProps {
    onGameStart: (gameId: string, isMultiplayer: true, selectedCountry?: string, playerColor?: string) => void
    onExit: () => void
}

/**
 * MultiplayerFlow manages the entire multiplayer lobby process:
 * 1. Anonymous authentication
 * 2. Nickname entry
 * 3. Create/Join lobby
 * 4. Lobby waiting room
 * 5. Game start
 */
export function MultiplayerFlow({ onGameStart, onExit }: MultiplayerFlowProps) {
    const {
        phase,
        user,
        nickname,
        lobbyCode,
        isHost,
        setPhase,
        setUser,
        setNickname,
        setLobbyCode,
        setIsHost,
        exitMultiplayer
    } = useMultiplayerStore()

    const [authError, setAuthError] = useState('')

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthChange((authUser) => {
            setUser(authUser)
        })
        return () => unsubscribe()
    }, [setUser])

    // Auto-authenticate when entering multiplayer
    useEffect(() => {
        if (phase === 'authenticating' && !user) {
            signInAnonymous()
                .then((authUser) => {
                    setUser(authUser)
                    setPhase('nickname')
                })
                .catch((err) => {
                    console.error('Auth error:', err)
                    setAuthError('Failed to connect. Please try again.')
                })
        }
    }, [phase, user, setUser, setPhase])

    // Handle exit
    const handleExit = () => {
        exitMultiplayer()
        onExit()
    }

    // Handle nickname submission
    const handleNicknameSubmit = async (name: string) => {
        if (user) {
            await setPlayerNickname(user.uid, name)
            setNickname(name)
            setPhase('lobby_menu')
        }
    }

    // Handle lobby joined
    const handleLobbyJoined = (code: string, host: boolean) => {
        setLobbyCode(code)
        setIsHost(host)
        setPhase('lobby_waiting')
    }

    // Handle lobby left
    const handleLobbyLeft = () => {
        setLobbyCode(null)
        setIsHost(false)
        setPhase('lobby_menu')
    }

    // Handle game start - now includes selected country and player color
    const handleGameStart = (gameId: string, selectedCountry?: string, playerColor?: string) => {
        // Critical: Store the Game ID immediately
        useMultiplayerStore.getState().setGameId(gameId)

        setPhase('game_active')
        onGameStart(gameId, true, selectedCountry, playerColor)
    }

    // Render based on phase
    if (phase === 'authenticating') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
                <div className="text-center">
                    <div className="animate-spin inline-block w-12 h-12 border-4 border-white/20 border-t-white rounded-full mb-4"></div>
                    <p className="text-white text-lg">Connecting...</p>
                    {authError && (
                        <div className="mt-4">
                            <p className="text-red-400 mb-4">{authError}</p>
                            <button
                                onClick={handleExit}
                                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                            >
                                Back
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (phase === 'nickname') {
        return (
            <NicknameModal
                title="Choose Your Name"
                onSubmit={handleNicknameSubmit}
                onCancel={handleExit}
            />
        )
    }

    if (phase === 'lobby_menu' && user) {
        return (
            <LobbyScreen
                playerId={user.uid}
                nickname={nickname}
                onLobbyJoined={handleLobbyJoined}
                onCancel={handleExit}
            />
        )
    }

    if (phase === 'lobby_waiting' && user && lobbyCode) {
        return (
            <LobbyWaiting
                lobbyCode={lobbyCode}
                playerId={user.uid}
                isHost={isHost}
                onGameStart={handleGameStart}
                onLeave={handleLobbyLeft}
            />
        )
    }

    // Fallback
    return null
}
