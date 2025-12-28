// Multiplayer session state management
import { create } from 'zustand'
import { User } from 'firebase/auth'
import { Lobby } from '../firebase/lobby'

export type MultiplayerPhase =
    | 'offline'        // Single player mode
    | 'authenticating' // Signing in anonymously
    | 'nickname'       // Entering nickname
    | 'lobby_menu'     // Create/join lobby menu
    | 'lobby_waiting'  // In lobby waiting room
    | 'game_starting'  // Game is initializing
    | 'game_active'    // Multiplayer game in progress

export interface MultiplayerState {
    // Session state
    phase: MultiplayerPhase
    isMultiplayer: boolean

    // Auth
    user: User | null
    nickname: string

    // Lobby
    lobbyCode: string | null
    lobby: Lobby | null
    isHost: boolean
    isSpectator: boolean

    // Game
    gameId: string | null
    playerColor: string | null  // Player's chosen color from lobby

    // Actions
    setPhase: (phase: MultiplayerPhase) => void
    setUser: (user: User | null) => void
    setNickname: (nickname: string) => void
    setLobbyCode: (code: string | null) => void
    setLobby: (lobby: Lobby | null) => void
    setIsHost: (isHost: boolean) => void
    setIsSpectator: (isSpectator: boolean) => void
    setGameId: (gameId: string | null) => void
    setPlayerColor: (color: string | null) => void

    // Enter multiplayer mode
    enterMultiplayer: () => void

    // Exit multiplayer mode
    exitMultiplayer: () => void

    // Reset
    reset: () => void
}

export const useMultiplayerStore = create<MultiplayerState>((set) => ({
    // Initial state
    phase: 'offline',
    isMultiplayer: false,
    user: null,
    nickname: '',
    lobbyCode: null,
    lobby: null,
    isHost: false,
    isSpectator: false,
    gameId: null,
    playerColor: null,

    // Actions
    setPhase: (phase) => set({ phase }),
    setUser: (user) => set({ user }),
    setNickname: (nickname) => set({ nickname }),
    setLobbyCode: (code) => set({ lobbyCode: code }),
    setLobby: (lobby) => set({ lobby }),
    setIsHost: (isHost) => set({ isHost }),
    setIsSpectator: (isSpectator) => set({ isSpectator }),
    setGameId: (gameId) => set({ gameId }),
    setPlayerColor: (playerColor) => set({ playerColor }),

    enterMultiplayer: () => set({
        phase: 'authenticating',
        isMultiplayer: true
    }),

    exitMultiplayer: () => set({
        phase: 'offline',
        isMultiplayer: false,
        lobbyCode: null,
        lobby: null,
        isHost: false,
        isSpectator: false,
        gameId: null
    }),

    reset: () => set({
        phase: 'offline',
        isMultiplayer: false,
        user: null,
        nickname: '',
        lobbyCode: null,
        lobby: null,
        isHost: false,
        isSpectator: false,
        gameId: null
    })
}))
