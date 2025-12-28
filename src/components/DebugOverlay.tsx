

import { useMultiplayerStore } from '../store/multiplayerStore'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'

export function DebugOverlay() {
    const { isMultiplayer, isHost, gameId, phase: mpPhase, lobbyCode } = useMultiplayerStore()
    const { phase, gameDate, nation, diplomaticEvents } = useGameStore()
    const { activeWars, aiCountries } = useWorldStore()



    return (
        <div className="fixed top-20 right-4 bg-black/80 text-green-300 p-4 rounded text-xs z-[9999] pointer-events-none font-mono">
            <h3 className="font-bold border-b border-green-500 mb-2">DEBUG INFO</h3>
            <div>MP Phase: {mpPhase}</div>
            <div>Is Multiplayer: {isMultiplayer ? 'YES' : 'NO'}</div>
            <div>Is Host: {isHost ? 'YES' : 'NO'}</div>
            <div>Game Phase: {phase}</div>
            <div>Game ID: {gameId?.substring(0, 6)}...</div>
            <div>Lobby: {lobbyCode}</div>
            <div>Date: {new Date(gameDate).toLocaleDateString()}</div>
            <div>Nation: {nation?.name} (Budget: {nation?.stats.budget})</div>
            <div>Active Wars: {Array.isArray(activeWars) ? activeWars.length : (activeWars as any).size}</div>
            <div>AI Countries: {aiCountries.size}</div>
            <div>Events: {diplomaticEvents.length}</div>
        </div>
    )
}
