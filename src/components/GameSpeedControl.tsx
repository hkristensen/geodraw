import { useGameStore } from '../store/gameStore'
import { useMultiplayerStore } from '../store/multiplayerStore'

export function GameSpeedControl() {
    const { gameSpeed, setGameSpeed } = useGameStore()
    const { isMultiplayer, isHost } = useMultiplayerStore()

    const speeds = [
        { label: '⏸️', value: 0, title: 'Pause' },
        { label: '▶️', value: 1, title: 'Normal Speed (1x)' },
        { label: '⏩', value: 2, title: 'Fast (2x)' },
        { label: '⏭️', value: 5, title: 'Super Fast (5x)' },
    ]

    // In multiplayer, only host can control speed
    const canControl = !isMultiplayer || isHost

    return (
        <div className="bg-slate-900/90 backdrop-blur border border-white/10 rounded-lg p-1 flex gap-1 shadow-xl">
            {speeds.map((speed) => (
                <button
                    key={speed.value}
                    onClick={() => canControl && setGameSpeed(speed.value)}
                    title={canControl ? speed.title : 'Host controls game speed'}
                    disabled={!canControl}
                    className={`w-8 h-8 flex items-center justify-center rounded transition-all ${gameSpeed === speed.value
                        ? 'bg-orange-600 text-white shadow-lg scale-105'
                        : canControl
                            ? 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            : 'bg-white/5 text-gray-600 cursor-not-allowed'
                        }`}
                >
                    {speed.label}
                </button>
            ))}
        </div>
    )
}
