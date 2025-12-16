import { useGameStore } from '../store/gameStore'

export function GameOverModal() {
    const gameOver = useGameStore(state => state.gameOver)

    if (!gameOver) return null

    const handleRestart = () => {
        window.location.reload()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border-2 border-red-600 rounded-xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300">
                <div className="text-6xl mb-6">☠️</div>
                <h2 className="text-4xl font-black text-red-500 mb-2 uppercase tracking-wider">Game Over</h2>
                <p className="text-gray-300 mb-8 text-lg">
                    Your nation has been completely conquered. Your reign has come to an end.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={handleRestart}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xl transition-all hover:scale-105 shadow-lg shadow-red-900/50"
                    >
                        Start New Game
                    </button>

                    {/* Optional: Spectate Mode (just closes modal but keeps game over state?) 
                        For now, just restart is fine.
                    */}
                </div>
            </div>
        </div>
    )
}
