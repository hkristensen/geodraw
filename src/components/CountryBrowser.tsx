import { useState, useMemo } from 'react'
import { getAllGeopoliticalData, mapOrientationToNumber } from '../utils/geopoliticalData'
import { getCountryData } from '../utils/countryData'
import './CountryBrowser.css'

interface CountryBrowserProps {
    isOpen: boolean
    onClose: () => void
    onSelectCountry?: (iso3: string) => void
}

export function CountryBrowser({ isOpen, onClose, onSelectCountry }: CountryBrowserProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const allGeoData = getAllGeopoliticalData()

    // Convert to array and combine with basic country data
    const countries = useMemo(() => {
        const countriesArray: Array<{
            iso3: string
            name: string
            leader: string
            orientation: number
            orientationLabel: string
            govType: string
            population: number
            unrest: number
            military: number
            freedom: number
        }> = []

        allGeoData.forEach((geoData, code) => {
            const basicData = getCountryData(code)
            countriesArray.push({
                iso3: code,
                name: geoData.name,
                leader: geoData.leader,
                orientation: mapOrientationToNumber(geoData.orientation),
                orientationLabel: geoData.orientation,
                govType: geoData.gov_type,
                population: basicData?.population || 0,
                unrest: geoData.unrest,
                military: geoData.military,
                freedom: geoData.freedom,
            })
        })

        return countriesArray.sort((a, b) => a.name.localeCompare(b.name))
    }, [allGeoData])

    // Filter countries based on search
    const filteredCountries = useMemo(() => {
        if (!searchQuery.trim()) return countries

        const query = searchQuery.toLowerCase()
        return countries.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.leader.toLowerCase().includes(query) ||
            c.iso3.toLowerCase().includes(query)
        )
    }, [countries, searchQuery])

    if (!isOpen) return null

    const handleCountryClick = (iso3: string) => {
        if (onSelectCountry) {
            onSelectCountry(iso3)
            onClose()
        }
    }

    return (
        <div className="country-browser-overlay" onClick={onClose}>
            <div className="country-browser-modal country-browser-list" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="browser-header">
                    <h2>🌍 World Countries</h2>
                    <button onClick={onClose} className="close-btn">✕</button>
                </div>

                {/* Search Bar */}
                <div className="browser-search">
                    <input
                        type="text"
                        placeholder="Search by country, leader, or code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                        autoFocus
                    />
                    <span className="search-count">
                        {filteredCountries.length} {filteredCountries.length === 1 ? 'country' : 'countries'}
                    </span>
                </div>

                {/* Countries List */}
                <div className="browser-body country-list">
                    {filteredCountries.length === 0 ? (
                        <div className="no-results">
                            No countries found matching "{searchQuery}"
                        </div>
                    ) : (
                        filteredCountries.map((country) => (
                            <div
                                key={country.iso3}
                                className="country-list-item"
                                onClick={() => handleCountryClick(country.iso3)}
                            >
                                <div className="country-main-info">
                                    <div className="country-name-section">
                                        <h3>{country.name}</h3>
                                        <span className="country-code">{country.iso3}</span>
                                    </div>
                                    <div className="country-leader">
                                        👤 {country.leader}
                                    </div>
                                </div>

                                <div className="country-stats-row">
                                    <div className="stat-mini">
                                        <span className="stat-mini-label">Pop</span>
                                        <span className="stat-mini-value">
                                            {(country.population / 1_000_000).toFixed(1)}M
                                        </span>
                                    </div>
                                    <div className="stat-mini">
                                        <span className="stat-mini-label">Freedom</span>
                                        <span className={`stat-mini-value ${getStatColor(country.freedom)}`}>
                                            {country.freedom}/5
                                        </span>
                                    </div>
                                    <div className="stat-mini">
                                        <span className="stat-mini-label">Military</span>
                                        <span className={`stat-mini-value ${getStatColor(country.military)}`}>
                                            {country.military}/5
                                        </span>
                                    </div>
                                    <div className="stat-mini">
                                        <span className="stat-mini-label">Unrest</span>
                                        <span className={`stat-mini-value ${getStatColor(5 - country.unrest + 1)}`}>
                                            {country.unrest}/5
                                        </span>
                                    </div>
                                </div>

                                <div className="country-orientation">
                                    <div className="orientation-mini-bar">
                                        <div
                                            className="orientation-mini-indicator"
                                            style={{ left: `${((country.orientation + 100) / 200) * 100}%` }}
                                        />
                                    </div>
                                    <span className="orientation-mini-label">{country.orientationLabel}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

function getStatColor(value: number): string {
    if (value >= 4) return 'stat-good'
    if (value >= 3) return 'stat-medium'
    return 'stat-poor'
}
