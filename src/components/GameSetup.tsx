import React, { useState } from 'react'
import type { GameSettings } from '../types/game'
import './GameSetup.css'

interface GameSetupProps {
    onStartGame: (settings: GameSettings) => void
    onCancel: () => void
}

const EXISTING_COUNTRIES = [
    { code: 'USA', name: 'United States' },
    { code: 'GBR', name: 'United Kingdom' },
    { code: 'FRA', name: 'France' },
    { code: 'DEU', name: 'Germany' },
    { code: 'RUS', name: 'Russia' },
    { code: 'CHN', name: 'China' },
    { code: 'JPN', name: 'Japan' },
    { code: 'IND', name: 'India' },
    { code: 'BRA', name: 'Brazil' },
    { code: 'AUS', name: 'Australia' },
    { code: 'CAN', name: 'Canada' },
    { code: 'ITA', name: 'Italy' },
    { code: 'ESP', name: 'Spain' },
    { code: 'MEX', name: 'Mexico' },
    { code: 'KOR', name: 'South Korea' },
    { code: 'ARG', name: 'Argentina' },
    { code: 'ZAF', name: 'South Africa' },
    { code: 'TUR', name: 'Turkey' },
    { code: 'SAU', name: 'Saudi Arabia' },
    { code: 'POL', name: 'Poland' },
]

export const GameSetup: React.FC<GameSetupProps> = ({ onStartGame, onCancel }) => {
    const [startMode, setStartMode] = useState<'FREEFORM' | 'EXISTING_COUNTRY'>('FREEFORM')
    const [expansionPoints, setExpansionPoints] = useState(1000)
    const [startingCountry, setStartingCountry] = useState('USA')
    const [enableRealCoalitions, setEnableRealCoalitions] = useState(true)
    const [enableElections, setEnableElections] = useState(true)
    const [difficulty, setDifficulty] = useState<'EASY' | 'NORMAL' | 'HARD'>('NORMAL')

    const handleStart = () => {
        onStartGame({
            startMode,
            expansionPoints: startMode === 'FREEFORM' ? expansionPoints : 0,
            startingCountry: startMode === 'EXISTING_COUNTRY' ? startingCountry : undefined,
            enableRealCoalitions,
            enableElections,
            difficulty
        })
    }

    return (
        <div className="game-setup-overlay">
            <div className="game-setup-modal">
                <div className="setup-header">
                    <h1>🌍 New Game</h1>
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
                            <h2>Select Country</h2>
                            <p className="section-desc">Choose your nation to lead</p>
                            <div className="country-grid">
                                {EXISTING_COUNTRIES.map(country => (
                                    <button
                                        key={country.code}
                                        className={`country-btn ${startingCountry === country.code ? 'selected' : ''}`}
                                        onClick={() => setStartingCountry(country.code)}
                                    >
                                        {country.name}
                                    </button>
                                ))}
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
                    <button className="cancel-btn" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className="start-btn" onClick={handleStart}>
                        🚀 Start Game
                    </button>
                </div>
            </div>
        </div>
    )
}
