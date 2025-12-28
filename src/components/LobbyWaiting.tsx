import { useEffect, useState, useRef } from 'react'
import { Lobby, subscribeLobby, setPlayerReady, setPlayerColor, setPlayerCountry, leaveLobby, startGame, toggleLateJoin, PLAYER_COLORS } from '../firebase/lobby'


interface CountryOption {
    code: string
    name: string
}

interface LobbyWaitingProps {
    lobbyCode: string
    playerId: string
    isHost: boolean
    onGameStart: (gameId: string, selectedCountry?: string, playerColor?: string) => void
    onLeave: () => void
}

export function LobbyWaiting({ lobbyCode, playerId, isHost, onGameStart, onLeave }: LobbyWaitingProps) {
    const [lobby, setLobby] = useState<Lobby | null>(null)
    const [error, setError] = useState('')
    const [starting, setStarting] = useState(false)
    const [copied, setCopied] = useState(false)
    const [selectedCountry, setSelectedCountry] = useState<string>('')
    const [countrySearch, setCountrySearch] = useState('')
    const [startMode, setStartMode] = useState<'country' | 'draw'>('country')

    // Country list state - loaded dynamically
    const [allCountries, setAllCountries] = useState<CountryOption[]>([])
    const [countriesLoading, setCountriesLoading] = useState(true)

    // Load countries on mount
    useEffect(() => {
        async function loadCountries() {
            try {
                // Dynamic import of countries data
                const countriesModule = await import('../data/countries.json')
                const data = countriesModule.default || countriesModule
                const features = data?.features || []

                console.log('🌍 Loading countries from features:', features.length)

                const countries: CountryOption[] = []
                for (const feature of features) {
                    const props = feature.properties
                    if (props?.iso_a3 && props?.admin && props.iso_a3 !== '-99') {
                        countries.push({
                            code: props.iso_a3,
                            name: props.admin
                        })
                    }
                }

                countries.sort((a, b) => a.name.localeCompare(b.name))
                console.log('🌍 Loaded', countries.length, 'countries')
                setAllCountries(countries)

                // Set default country
                if (countries.length > 0) {
                    setSelectedCountry(countries.find(c => c.code === 'USA')?.code || countries[0].code)
                }
            } catch (err) {
                console.error('Failed to load countries:', err)
            } finally {
                setCountriesLoading(false)
            }
        }
        loadCountries()
    }, [])

    // Filter by search
    const filteredCountries = allCountries.filter(c => {
        if (!countrySearch.trim()) return true
        const search = countrySearch.toLowerCase()
        return c.name.toLowerCase().includes(search) || c.code.toLowerCase().includes(search)
    })

    // Guard to prevent duplicate game start calls
    const hasStartedRef = useRef(false)
    const selectedCountryRef = useRef(selectedCountry)
    const startModeRef = useRef(startMode)

    // Keep refs in sync with state
    useEffect(() => {
        selectedCountryRef.current = selectedCountry
        startModeRef.current = startMode
    }, [selectedCountry, startMode])

    // Subscribe to lobby updates
    useEffect(() => {
        const unsubscribe = subscribeLobby(lobbyCode, (updatedLobby) => {
            if (updatedLobby) {
                setLobby(updatedLobby)

                // Check if game started
                const gameStarted = (updatedLobby.status === 'starting' || updatedLobby.status === 'in_game') && updatedLobby.gameId

                // Get current player
                const currentPlayer = updatedLobby.players.find(p => p.id === playerId)

                // Only auto-start if game is started AND player is ready (fixes late joiners getting skipped)
                if (gameStarted && !hasStartedRef.current && (currentPlayer?.ready || currentPlayer?.isHost)) {
                    hasStartedRef.current = true
                    // Get current player's color from lobby
                    const playerColor = currentPlayer?.color || '#3b82f6'
                    console.log('🎮 Game starting!', updatedLobby.gameId, 'Mode:', startModeRef.current, 'Country:', selectedCountryRef.current, 'Color:', playerColor)
                    // Pass undefined country if draw mode
                    const country = startModeRef.current === 'country' ? selectedCountryRef.current : undefined
                    onGameStart(updatedLobby.gameId!, country, playerColor)
                }

                if (updatedLobby.status === 'finished') {
                    setError('Host closed the lobby')
                }
            } else {
                setError('Lobby no longer exists')
            }
        })

        return () => unsubscribe()
    }, [lobbyCode, onGameStart])

    const handleReady = async () => {
        const currentPlayer = lobby?.players.find(p => p.id === playerId)
        if (currentPlayer) {
            await setPlayerReady(lobbyCode, playerId, !currentPlayer.ready)
        }
    }

    const handleColorChange = async (color: string) => {
        await setPlayerColor(lobbyCode, playerId, color)
    }

    const handleCountryChange = async (countryCode: string) => {
        setSelectedCountry(countryCode)
        await setPlayerCountry(lobbyCode, playerId, countryCode)
    }

    const handleStart = async () => {
        if (!isHost) return

        // Validate before starting
        if (startMode === 'country' && !selectedCountry) {
            setError('Please select a country first')
            return
        }

        setStarting(true)
        setError('')

        try {
            const result = await startGame(lobbyCode, playerId)
            if (!result.success) {
                setError(result.error || 'Failed to start game')
            }
        } catch (err) {
            setError('Failed to start game')
            console.error(err)
        }
        setStarting(false)
    }

    const handleLeave = async () => {
        await leaveLobby(lobbyCode, playerId)
        onLeave()
    }

    const copyCode = () => {
        navigator.clipboard.writeText(lobbyCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Get countries already selected by other players
    const getUsedCountries = () => {
        if (!lobby) return []
        return lobby.players
            .filter(p => p.id !== playerId && (p as any).countryCode)
            .map(p => (p as any).countryCode)
    }

    const currentPlayer = lobby?.players.find(p => p.id === playerId)
    const allReady = lobby?.players.every(p => p.ready || p.isHost)
    const playerCount = lobby?.players.length || 0
    const spectatorCount = lobby?.spectators.length || 0
    const usedCountries = getUsedCountries()

    if (error && !lobby) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
                <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-8 text-center">
                    <p className="text-red-400 text-lg mb-4">{error}</p>
                    <button
                        onClick={onLeave}
                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                    >
                        Back to Menu
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4 overflow-auto">
            <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-6 w-full max-w-2xl border border-white/10 shadow-2xl my-4">
                {/* Header with Code */}
                <div className="text-center mb-6">
                    <p className="text-gray-400 text-sm mb-1">Game Code</p>
                    <button
                        onClick={copyCode}
                        className="text-4xl font-mono font-bold tracking-[0.3em] text-white hover:text-blue-400 transition-colors"
                    >
                        {lobbyCode}
                        <span className="text-sm ml-2">{copied ? '✓' : '📋'}</span>
                    </button>
                    <p className="text-gray-500 text-xs mt-1">Click to copy • Share with friends</p>
                </div>

                {/* Players List */}
                <div className="mb-4">
                    <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-3">
                        Players ({playerCount}/8)
                    </h3>
                    <div className="space-y-2">
                        {lobby?.players.map((player) => (
                            <div
                                key={player.id}
                                className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-8 h-8 rounded-full border-2 border-white/20"
                                        style={{ backgroundColor: player.color }}
                                    />
                                    <div>
                                        <span className="text-white font-medium">
                                            {player.nickname}
                                            {player.isHost && (
                                                <span className="ml-2 text-yellow-400 text-xs">👑 Host</span>
                                            )}
                                            {player.id === playerId && (
                                                <span className="ml-2 text-blue-400 text-xs">(You)</span>
                                            )}
                                        </span>
                                        {(player as any).countryCode && (
                                            <span className="block text-xs text-gray-400">
                                                🏳️ {allCountries.find(c => c.code === (player as any).countryCode)?.name || (player as any).countryCode}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {player.ready || player.isHost ? (
                                        <span className="text-green-400 text-sm">✓ Ready</span>
                                    ) : (
                                        <span className="text-gray-500 text-sm">Waiting...</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Spectators */}
                {spectatorCount > 0 && (
                    <div className="mb-4">
                        <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2">
                            👁️ Spectators ({spectatorCount})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {lobby?.spectators.map((s) => (
                                <span key={s.id} className="px-3 py-1 bg-slate-700/50 rounded-full text-gray-400 text-sm">
                                    {s.nickname}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Start Mode Selection */}
                {currentPlayer && (
                    <div className="mb-4">
                        <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2">🎮 Starting Mode</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setStartMode('country')
                                    handleCountryChange('') // Clear selection
                                }}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${startMode === 'country'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                    }`}
                            >
                                🏳️ Existing Country
                            </button>
                            <button
                                onClick={() => {
                                    setStartMode('draw')
                                    handleCountryChange('FREEFORM') // Set dummy code for backend
                                }}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${startMode === 'draw'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                    }`}
                            >
                                🖌️ Draw Territory
                            </button>
                        </div>
                    </div>
                )}

                {/* Country Selection (if country mode) */}
                {currentPlayer && startMode === 'country' && (
                    <div className="mb-4">
                        <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2">
                            🏳️ Select Country ({allCountries.length} available)
                        </h3>
                        {countriesLoading ? (
                            <div className="text-gray-400 text-center py-4">Loading countries...</div>
                        ) : (
                            <>
                                {/* Search input */}
                                <input
                                    type="text"
                                    placeholder="🔍 Search countries..."
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                    className="w-full px-3 py-2 mb-2 bg-slate-600 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {/* Country list */}
                                <div
                                    className="bg-slate-700/50 rounded-lg overflow-y-auto"
                                    style={{ maxHeight: '200px' }}
                                >
                                    {filteredCountries.length === 0 ? (
                                        <div className="text-gray-400 text-center py-4">
                                            {countrySearch ? 'No countries match search' : 'No countries loaded'}
                                        </div>
                                    ) : (
                                        filteredCountries.map((country) => {
                                            const taken = usedCountries.includes(country.code)
                                            const selected = selectedCountry === country.code
                                            return (
                                                <button
                                                    key={country.code}
                                                    onClick={() => !taken && handleCountryChange(country.code)}
                                                    disabled={taken}
                                                    className={`w-full text-left px-4 py-2 transition-all ${selected
                                                        ? 'bg-blue-600 text-white'
                                                        : taken
                                                            ? 'text-gray-500 cursor-not-allowed'
                                                            : 'text-white hover:bg-slate-600'
                                                        }`}
                                                >
                                                    {country.name} {taken && '(Taken)'}
                                                </button>
                                            )
                                        })
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Draw mode info */}
                {currentPlayer && startMode === 'draw' && (
                    <div className="mb-4 bg-slate-700/50 rounded-lg p-4">
                        <p className="text-gray-300 text-sm">
                            🖌️ You will draw your territory on the map after the game starts.
                        </p>
                    </div>
                )}

                {/* Color Selection (if player) */}
                {currentPlayer && (
                    <div className="mb-4">
                        <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2">🎨 Your Color</h3>
                        <div className="flex gap-2 flex-wrap">
                            {PLAYER_COLORS.map((color) => {
                                const taken = lobby?.players.some(p => p.color === color && p.id !== playerId)
                                return (
                                    <button
                                        key={color}
                                        onClick={() => !taken && handleColorChange(color)}
                                        disabled={taken}
                                        className={`w-10 h-10 rounded-full border-2 transition-all ${currentPlayer.color === color
                                            ? 'border-white scale-110'
                                            : taken
                                                ? 'border-transparent opacity-30 cursor-not-allowed'
                                                : 'border-transparent hover:border-white/50 hover:scale-105'
                                            }`}
                                        style={{ backgroundColor: color }}
                                    />
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Host Settings */}
                {isHost && (
                    <div className="mb-6 bg-slate-700/50 rounded-lg p-4">
                        <label className="flex items-center justify-between cursor-pointer">
                            <div>
                                <span className="text-white font-medium block">Allow Late Join</span>
                                <span className="text-gray-400 text-xs">Players can join after game starts</span>
                            </div>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={lobby?.allowLateJoin || false}
                                    onChange={(e) => toggleLateJoin(lobbyCode, e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </div>
                        </label>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <p className="text-red-400 text-sm text-center mb-4">{error}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={handleLeave}
                        className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                    >
                        Leave Lobby
                    </button>

                    {!isHost && currentPlayer && (
                        <button
                            onClick={handleReady}
                            className={`flex-1 py-3 rounded-lg font-bold transition-all ${currentPlayer.ready
                                ? 'bg-gray-600 text-gray-300'
                                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white'
                                }`}
                        >
                            {currentPlayer.ready
                                ? '✓ Ready'
                                : lobby?.status === 'in_game' || lobby?.status === 'starting'
                                    ? 'Join Game'
                                    : 'Ready Up'
                            }
                        </button>
                    )}

                    {isHost && (
                        <button
                            onClick={handleStart}
                            disabled={starting || !allReady || playerCount < 1 || (startMode === 'country' && !selectedCountry)}
                            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all"
                        >
                            {starting ? 'Starting...' : 'Start Game'}
                        </button>
                    )}
                </div>

                {isHost && !allReady && (
                    <p className="text-center text-gray-500 text-sm mt-3">
                        Waiting for all players to ready up...
                    </p>
                )}

                {isHost && startMode === 'country' && !selectedCountry && (
                    <p className="text-center text-yellow-500 text-sm mt-3">
                        Select a country to enable Start Game
                    </p>
                )}
            </div>
        </div>
    )
}
