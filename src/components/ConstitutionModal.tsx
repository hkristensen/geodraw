import { useState, useMemo, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { getCityCaptureStats } from '../utils/calculateCityCapture'
import { calculateNationStats } from '../utils/calculateNationStats'
import { getPrimaryLanguage, getPrimaryCulture, getPrimaryReligion } from '../utils/countryData'
import { LANGUAGES, CULTURES, RELIGIONS } from '../types/game'
import type { Nation, FlagData, FlagPattern } from '../types/game'
import { Flag } from './Flag'
import countriesData from '../data/countries.json'

// Expanded color palettes
const PALETTES = [
    ['#dc2626', '#ffffff', '#1d4ed8'], // Red, White, Blue
    ['#16a34a', '#ffffff', '#dc2626'], // Green, White, Red  
    ['#eab308', '#dc2626', '#000000'], // Yellow, Red, Black
    ['#2563eb', '#ffffff', '#f97316'], // Blue, White, Orange
    ['#7c3aed', '#fbbf24', '#000000'], // Purple, Gold, Black
    ['#0891b2', '#10b981', '#ffffff'], // Cyan, Emerald, White
    ['#be123c', '#fecdd3', '#881337'], // Rose
    ['#1e3a8a', '#bfdbfe', '#172554'], // Ocean
    ['#3f6212', '#d9f99d', '#14532d'], // Forest
    ['#78350f', '#fef3c7', '#451a03'], // Earth
    ['#4c1d95', '#ddd6fe', '#2e1065'], // Royal
    ['#701a75', '#fbcfe8', '#500724'], // Magenta
]

const PATTERNS: FlagPattern[] = ['tricolor-v', 'tricolor-h', 'cross', 'saltire', 'circle', 'checkered']

// Generate random flag
function generateFlag(): FlagData {
    const colors = PALETTES[Math.floor(Math.random() * PALETTES.length)] as [string, string, string]
    const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)]

    // Shuffle colors for more variety
    const shuffled = [...colors].sort(() => Math.random() - 0.5) as [string, string, string]

    return {
        pattern,
        colors: shuffled
    }
}

export function ConstitutionModal() {
    const {
        phase,
        capturedCities,
        consequences,
        infrastructureStats,
        selectedCountryName,
        gameSettings,
        setNation,
        setPhase,
        reset
    } = useGameStore()

    const { initializeAICountries } = useWorldStore()

    const [nationName, setNationName] = useState(selectedCountryName || '')
    const [flag, setFlag] = useState<FlagData>(generateFlag)

    // Editable constitution state
    const [selectedLanguage, setSelectedLanguage] = useState<string>('')
    const [selectedCulture, setSelectedCulture] = useState<string>('')
    const [selectedReligion, setSelectedReligion] = useState<string>('')

    // Set defaults based on conquered lands
    useEffect(() => {
        if (consequences.length === 0) return

        const languageCounts: Record<string, number> = {}
        const cultureCounts: Record<string, number> = {}
        const religionCounts: Record<string, number> = {}

        consequences.forEach(c => {
            const pop = c.populationCaptured
            const lang = getPrimaryLanguage(c.countryCode)
            const cult = getPrimaryCulture(c.countryCode)
            const rel = getPrimaryReligion(c.countryCode)

            languageCounts[lang] = (languageCounts[lang] || 0) + pop
            cultureCounts[cult] = (cultureCounts[cult] || 0) + pop
            religionCounts[rel] = (religionCounts[rel] || 0) + pop
        })

        const topLang = Object.entries(languageCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'English'
        const topCult = Object.entries(cultureCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Western'
        const topRel = Object.entries(religionCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Christianity'

        setSelectedLanguage(topLang)
        setSelectedCulture(topCult)
        setSelectedReligion(topRel)
    }, [consequences])

    const cityStats = useMemo(() => getCityCaptureStats(capturedCities), [capturedCities])
    const totalPopFromCountries = consequences.reduce((sum, c) => sum + c.populationCaptured, 0)
    const totalPop = totalPopFromCountries + cityStats.totalPopulation

    // Check if we're starting from an existing country (skip budget check)
    const isExistingCountry = gameSettings?.startMode === 'EXISTING_COUNTRY'

    // Budget Calculation (only for freeform mode)
    const BUDGET = gameSettings?.expansionPoints || 5000
    const cost = useMemo(() => {
        if (isExistingCountry) return 0 // No cost for existing countries

        let total = 0

        // Population cost: 200 per million
        total += (totalPop / 1_000_000) * 200

        if (infrastructureStats) {
            // Airports
            infrastructureStats.airports.forEach(a => {
                if (a.type === 'major') total += 200
                else if (a.type === 'medium') total += 100
                else total += 50
            })

            // Ports
            infrastructureStats.ports.forEach(p => {
                if (p.type === 'major') total += 200
                else if (p.type === 'medium') total += 100
                else total += 50
            })
        }

        return Math.round(total)
    }, [totalPop, infrastructureStats, isExistingCountry])

    const isOverBudget = !isExistingCountry && cost > BUDGET

    // Don't show if not in constitution phase
    if (phase !== 'CONSTITUTION') {
        return null
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!nationName.trim() || isOverBudget) {
            return
        }

        // Calculate nation stats from conquered lands
        const stats = calculateNationStats(consequences, capturedCities)

        const nation: Nation = {
            name: nationName.trim(),
            flag,
            capital: cityStats.largestCity ? {
                name: cityStats.largestCity.name,
                coordinates: cityStats.largestCity.coordinates,
            } : null,
            constitution: {
                language: selectedLanguage,
                culture: selectedCulture,
                religion: selectedReligion
            },
            foundedAt: Date.now(),
            stats: {
                ...stats,
                budget: 1_000_000_000, // Start with $1B
                taxRate: 20, // 20% default tax
                gdpPerCapita: 10000, // Placeholder, updated by economy loop
                tradeIncome: 0,
                taxIncome: 0,
                expenses: 0
            },
            buildings: [],
            units: [],
            warPlans: []
        }

        // Initialize AI countries from consequences
        initializeAICountries(consequences, {
            language: selectedLanguage,
            culture: selectedCulture,
            religion: selectedReligion
        }, countriesData as any)

        setNation(nation)
        // Set selectedCountry to 'PLAYER' for custom nations so coalition system works
        if (!isExistingCountry) {
            useGameStore.getState().setSelectedCountry('PLAYER')
        }
        setPhase('RESULTS')
    }

    const regenerateFlag = () => {
        setFlag(generateFlag())
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-orange-500/30 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600/20 to-amber-600/20 p-6 border-b border-orange-500/20 relative">

                    <h2 className="text-2xl font-bold text-white text-center">
                        📜 Declaration of Sovereignty
                    </h2>
                    <p className="text-gray-400 text-center mt-1 text-sm">
                        Your borders have been drawn. Now give your nation its identity.
                    </p>
                </div>

                {/* Budget Section - Only show for freeform mode */}
                {!isExistingCountry && (
                    <div className={`p-4 border-b border-white/5 ${isOverBudget ? 'bg-red-900/20' : 'bg-emerald-900/10'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-gray-300">Expansion Budget</span>
                            <span className={`font-mono font-bold ${isOverBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                                {cost} / {BUDGET} pts
                            </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${isOverBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min((cost / BUDGET) * 100, 100)}%` }}
                            />
                        </div>
                        {isOverBudget && (
                            <p className="text-xs text-red-400 mt-2 text-center">
                                ⚠️ Territory too expensive! Reduce size or capture fewer major cities/ports.
                            </p>
                        )}
                    </div>
                )}

                {/* Stats Summary */}
                <div className="p-4 bg-black/30 border-b border-white/5">
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                            <div className="text-orange-400 font-bold text-lg">
                                {consequences.length}
                            </div>
                            <div className="text-xs text-gray-500">Countries Affected</div>
                        </div>
                        <div>
                            <div className="text-orange-400 font-bold text-lg">
                                {cityStats.cityCount}
                            </div>
                            <div className="text-xs text-gray-500">Cities Captured</div>
                        </div>
                        <div>
                            <div className="text-orange-400 font-bold text-lg">
                                {(totalPop / 1_000_000).toFixed(1)}M
                            </div>
                            <div className="text-xs text-gray-500">Population</div>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Nation Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            🏴 Nation Name
                        </label>
                        <input
                            type="text"
                            value={nationName}
                            onChange={(e) => setNationName(e.target.value)}
                            placeholder="e.g. New Carthage, Greater Moravia..."
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                            autoFocus
                            required
                        />
                    </div>

                    {/* Flag */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            🚩 National Flag
                        </label>
                        <div className="flex items-center gap-4">
                            <div className="w-24 h-16 rounded border border-white/20 overflow-hidden flex shadow-lg">
                                <Flag flag={flag} />
                            </div>
                            <button
                                type="button"
                                onClick={regenerateFlag}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
                            >
                                🎲 Randomize
                            </button>
                        </div>
                    </div>

                    {/* Capital */}
                    {cityStats.largestCity && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                🏛️ Capital City
                            </label>
                            <div className="flex items-center gap-3 bg-black/30 rounded-lg px-4 py-3 border border-white/5">
                                <span className="text-2xl">🏛️</span>
                                <div>
                                    <div className="text-white font-medium">{cityStats.largestCity.name}</div>
                                    <div className="text-xs text-gray-500">
                                        Pop. {(cityStats.largestCity.population / 1_000_000).toFixed(2)}M
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* Constitution Section */}
                    <div className="pt-4 border-t border-white/10">
                        <h3 className="text-sm font-semibold text-orange-400 uppercase mb-4">National Identity</h3>

                        <div className="grid grid-cols-1 gap-4">
                            {/* Language */}
                            <div className="bg-black/30 p-3 rounded-lg border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <span className="text-xl">🗣️</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-500 uppercase">Official Language</div>
                                        <select
                                            value={selectedLanguage}
                                            onChange={(e) => setSelectedLanguage(e.target.value)}
                                            className="w-full bg-transparent text-white font-medium focus:outline-none cursor-pointer hover:text-orange-400 transition-colors"
                                        >
                                            {LANGUAGES.map(l => (
                                                <option key={l} value={l} className="bg-slate-800">{l}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Culture */}
                            <div className="bg-black/30 p-3 rounded-lg border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <span className="text-xl">🎭</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-500 uppercase">Cultural Identity</div>
                                        <select
                                            value={selectedCulture}
                                            onChange={(e) => setSelectedCulture(e.target.value)}
                                            className="w-full bg-transparent text-white font-medium focus:outline-none cursor-pointer hover:text-orange-400 transition-colors"
                                        >
                                            {CULTURES.map(c => (
                                                <option key={c} value={c} className="bg-slate-800">{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Religion */}
                            <div className="bg-black/30 p-3 rounded-lg border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <span className="text-xl">⛪</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-500 uppercase">State Religion</div>
                                        <select
                                            value={selectedReligion}
                                            onChange={(e) => setSelectedReligion(e.target.value)}
                                            className="w-full bg-transparent text-white font-medium focus:outline-none cursor-pointer hover:text-orange-400 transition-colors"
                                        >
                                            {RELIGIONS.map(r => (
                                                <option key={r} value={r} className="bg-slate-800">{r}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Submit */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={reset}
                            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!nationName.trim() || isOverBudget}
                            className="flex-[2] py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:from-gray-800 disabled:to-gray-900 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-orange-500/25"
                        >
                            {isOverBudget ? 'Over Budget' : '🏴 Proclaim Independence'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
