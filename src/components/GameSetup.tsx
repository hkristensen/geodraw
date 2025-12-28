import React, { useState, useMemo } from 'react'
import type { GameSettings } from '../types/game'
import countriesData from '../data/countries.json'
import './GameSetup.css'

interface GameSetupProps {
    onStartGame: (settings: GameSettings) => void
    onCancel: () => void
    onMultiplayer?: () => void
}

// Extract all countries from GeoJSON
interface CountryOption {
    code: string
    name: string
}

function getAllCountries(): CountryOption[] {
    const countries: CountryOption[] = []
    const features = (countriesData as any).features || []

    for (const feature of features) {
        const props = feature.properties
        if (props?.iso_a3 && props?.admin && props.iso_a3 !== '-99') {
            countries.push({
                code: props.iso_a3,
                name: props.admin
            })
        }
    }

    // Sort alphabetically by name
    return countries.sort((a, b) => a.name.localeCompare(b.name))
}

export const GameSetup: React.FC<GameSetupProps> = ({ onStartGame, onCancel, onMultiplayer }) => {
    // Mode selection: 'select' (initial), 'local', or call onMultiplayer for multiplayer
    const [gameMode, setGameMode] = useState<'select' | 'local'>('select')

    // Local game settings
    const [startMode, setStartMode] = useState<'FREEFORM' | 'EXISTING_COUNTRY'>('FREEFORM')
    const [expansionPoints, setExpansionPoints] = useState(1000)
    const [startingCountry, setStartingCountry] = useState('USA')
    const [enableRealCoalitions, setEnableRealCoalitions] = useState(true)
    const [enableElections, setEnableElections] = useState(true)
    const [enableNuclearNations, setEnableNuclearNations] = useState(true)
    const [difficulty, setDifficulty] = useState<'EASY' | 'NORMAL' | 'HARD'>('NORMAL')
    const [countrySearch, setCountrySearch] = useState('')

    // Memoize country list
    const allCountries = useMemo(() => getAllCountries(), [])

    // Filter countries by search
    const filteredCountries = useMemo(() => {
        if (!countrySearch.trim()) return allCountries
        const search = countrySearch.toLowerCase()
        return allCountries.filter(c =>
            c.name.toLowerCase().includes(search) ||
            c.code.toLowerCase().includes(search)
        )
    }, [allCountries, countrySearch])

    const handleStart = () => {
        onStartGame({
            startMode,
            expansionPoints: startMode === 'FREEFORM' ? expansionPoints : 0,
            startingCountry: startMode === 'EXISTING_COUNTRY' ? startingCountry : undefined,
            enableRealCoalitions,
            enableElections,
            enableNuclearNations,
            difficulty
        })
    }

    const handleMultiplayer = () => {
        if (onMultiplayer) {
            onMultiplayer()
        }
    }

    // MODE SELECTION SCREEN
    if (gameMode === 'select') {
        return (
            <div className="game-setup-overlay">
                <div className="game-setup-modal" style={{ maxWidth: '600px' }}>
                    <div className="setup-header">
                        <h1>🌍 GeoDraw</h1>
                        <p>Build your empire. Shape history.</p>
                    </div>

                    <div className="mode-selection" style={{ padding: '32px 24px' }}>
                        {/* Local Game Button */}
                        <button
                            className="mode-select-btn"
                            onClick={() => setGameMode('local')}
                            style={{
                                width: '100%',
                                padding: '24px',
                                marginBottom: '16px',
                                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                border: 'none',
                                borderRadius: '16px',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)'
                                e.currentTarget.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.4)'
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.3)'
                            }}
                        >
                            <span style={{ fontSize: '48px' }}>🎮</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>Local Game</div>
                                <div style={{ fontSize: '14px', opacity: 0.9 }}>Play solo against AI nations</div>
                            </div>
                        </button>

                        {/* Multiplayer Button */}
                        <button
                            className="mode-select-btn"
                            onClick={handleMultiplayer}
                            style={{
                                width: '100%',
                                padding: '24px',
                                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                border: 'none',
                                borderRadius: '16px',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)'
                                e.currentTarget.style.boxShadow = '0 8px 30px rgba(139, 92, 246, 0.4)'
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = '0 4px 20px rgba(139, 92, 246, 0.3)'
                            }}
                        >
                            <span style={{ fontSize: '48px' }}>🌐</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>Multiplayer</div>
                                <div style={{ fontSize: '14px', opacity: 0.9 }}>Play with friends online</div>
                            </div>
                        </button>
                    </div>

                    <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                            className="cancel-btn"
                            onClick={onCancel}
                            style={{ width: '100%' }}
                        >
                            Back
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // LOCAL GAME SETUP SCREEN
    return (
        <div className="game-setup-overlay">
            <div className="game-setup-modal">
                <div className="setup-header">
                    <h1>🎮 Local Game</h1>
                    <p>Configure your geopolitical simulation</p>
                </div>

                <div className="setup-sections">
                    {/* Start Mode */}
                    <section className="setup-section">
                        <h2>Starting Mode</h2>
                        <div className="mode-options">
                            <button
                                className={`mode-btn ${startMode === 'FREEFORM' ? 'active' : ''}`}
                                onClick={() => setStartMode('FREEFORM')}
                            >
                                <span className="mode-icon">🖌️</span>
                                <span className="mode-title">Draw Territory</span>
                                <span className="mode-desc">Carve out your own nation</span>
                            </button>
                            <button
                                className={`mode-btn ${startMode === 'EXISTING_COUNTRY' ? 'active' : ''}`}
                                onClick={() => setStartMode('EXISTING_COUNTRY')}
                            >
                                <span className="mode-icon">🏳️</span>
                                <span className="mode-title">Existing Country</span>
                                <span className="mode-desc">Lead a real nation</span>
                            </button>
                        </div>
                    </section>

                    {/* Conditional: Expansion Points or Country Selection */}
                    {startMode === 'FREEFORM' ? (
                        <section className="setup-section">
                            <h2>Expansion Points</h2>
                            <p className="section-desc">Points determine initial territory size</p>
                            <div className="slider-container">
                                <input
                                    type="range"
                                    min={100}
                                    max={5000}
                                    step={100}
                                    value={expansionPoints}
                                    onChange={(e) => setExpansionPoints(Number(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span>100</span>
                                    <span className="slider-value">{expansionPoints}</span>
                                    <span>5000</span>
                                </div>
                            </div>
                            <div className="point-hints">
                                <span className={expansionPoints < 500 ? 'active' : ''}>City-State</span>
                                <span className={expansionPoints >= 500 && expansionPoints < 1500 ? 'active' : ''}>Small Nation</span>
                                <span className={expansionPoints >= 1500 && expansionPoints < 3000 ? 'active' : ''}>Regional Power</span>
                                <span className={expansionPoints >= 3000 ? 'active' : ''}>Great Power</span>
                            </div>
                        </section>
                    ) : (
                        <section className="setup-section">
                            <h2>Select Country ({allCountries.length} available)</h2>
                            {/* Search Input */}
                            <div style={{ marginBottom: '12px' }}>
                                <input
                                    type="text"
                                    placeholder="🔍 Search countries..."
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        background: 'rgba(0,0,0,0.3)',
                                        color: 'white',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>
                            {/* Country Grid */}
                            <div className="country-grid" style={{
                                maxHeight: '250px',
                                overflowY: 'auto',
                                padding: '4px'
                            }}>
                                {filteredCountries.map(country => (
                                    <button
                                        key={country.code}
                                        className={`country-btn ${startingCountry === country.code ? 'selected' : ''}`}
                                        onClick={() => setStartingCountry(country.code)}
                                    >
                                        {country.name}
                                    </button>
                                ))}
                                {filteredCountries.length === 0 && (
                                    <p style={{ color: '#888', padding: '12px', gridColumn: '1/-1' }}>
                                        No countries match "{countrySearch}"
                                    </p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* World Settings */}
                    <section className="setup-section">
                        <h2>World Settings</h2>
                        <div className="toggle-options">
                            <label className="toggle-option">
                                <input
                                    type="checkbox"
                                    checked={enableRealCoalitions}
                                    onChange={(e) => setEnableRealCoalitions(e.target.checked)}
                                />
                                <span className="toggle-label">
                                    <strong>Real-World Coalitions</strong>
                                    <small>Start with NATO, EU, BRICS, etc.</small>
                                </span>
                            </label>
                            <label className="toggle-option">
                                <input
                                    type="checkbox"
                                    checked={enableElections}
                                    onChange={(e) => setEnableElections(e.target.checked)}
                                />
                                <span className="toggle-label">
                                    <strong>Political Elections</strong>
                                    <small>Countries hold elections & change governments</small>
                                </span>
                            </label>
                            <label className="toggle-option">
                                <input
                                    type="checkbox"
                                    checked={enableNuclearNations}
                                    onChange={(e) => setEnableNuclearNations(e.target.checked)}
                                />
                                <span className="toggle-label">
                                    <strong>☢️ Nuclear Nations</strong>
                                    <small>USA, Russia, China, etc. start with nuclear weapons</small>
                                </span>
                            </label>
                        </div>
                    </section>

                    {/* Difficulty */}
                    <section className="setup-section">
                        <h2>Difficulty</h2>
                        <div className="difficulty-options">
                            <button
                                className={`diff-btn ${difficulty === 'EASY' ? 'active' : ''}`}
                                onClick={() => setDifficulty('EASY')}
                            >
                                🌱 Easy
                            </button>
                            <button
                                className={`diff-btn ${difficulty === 'NORMAL' ? 'active' : ''}`}
                                onClick={() => setDifficulty('NORMAL')}
                            >
                                ⚔️ Normal
                            </button>
                            <button
                                className={`diff-btn ${difficulty === 'HARD' ? 'active' : ''}`}
                                onClick={() => setDifficulty('HARD')}
                            >
                                💀 Hard
                            </button>
                        </div>
                    </section>
                </div>

                <div className="setup-actions">
                    <button
                        className="cancel-btn"
                        onClick={() => setGameMode('select')}
                    >
                        ← Back
                    </button>
                    <button className="start-btn" onClick={handleStart}>
                        🚀 Start Game
                    </button>
                </div>
            </div>
        </div>
    )
}
