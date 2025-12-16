/**
 * Country data utility - merges economic and religion data
 */
import type { FeatureCollection } from 'geojson'

export type Religion =
    | 'Christian'
    | 'Muslim'
    | 'Hindu'
    | 'Buddhist'
    | 'Jewish'
    | 'Folk'
    | 'Other'
    | 'Unaffiliated'

export interface CountryData {
    iso3: string
    name: string
    // Population
    population: number
    // Economics
    gniPerCapita: number
    economicFreedomIndex: number
    prosperityIndex: number
    // Governance
    freedomScore: number
    liberalDemocracyIndex: number
    corruptionIndex: number
    // Religion distribution (percentages)
    religions: Partial<Record<Religion, number>>
    // Derived stats
    power: number
    soldiers: number
    economy: number
    authority: number
}

// Cache for country data
let countryDataCache: Map<string, CountryData> | null = null
let loadingPromise: Promise<Map<string, CountryData>> | null = null

/**
 * Load and parse country data from GeoJSON files
 */
async function loadCountryData(): Promise<Map<string, CountryData>> {
    const dataMap = new Map<string, CountryData>()

    try {
        // Fetch both files
        const [indicesResponse, religionResponse] = await Promise.all([
            fetch('/src/data/2023-world-indices.geojson'),
            fetch('/src/data/2012-world-religion.geojson'),
        ])

        const indicesFC = await indicesResponse.json() as FeatureCollection
        const religionFC = await religionResponse.json() as FeatureCollection

        // Build religion data lookup
        const religionMap = new Map<string, any>()
        for (const feature of religionFC.features) {
            const props = feature.properties as any
            if (props?.ISO3) {
                religionMap.set(props.ISO3, props)
            }
        }

        // Process indices data and merge with religion
        for (const feature of indicesFC.features) {
            const props = feature.properties as any
            if (!props?.ISO3) continue

            const iso3 = props.ISO3
            const religionProps = religionMap.get(iso3) || {}

            // Parse values with fallbacks
            const population = religionProps['Population 2010'] || 1000000
            const gniPerCapita = props['GNI per Capita'] || 10000
            const economicFreedomIndex = props['Economic Freedom Index 2023'] || 50
            const prosperityIndex = props['Prosperity Index'] || 50
            const freedomScore = props['Freedom Score 2023'] || 50
            const liberalDemocracyIndex = props['Liberal Democracy Index'] || 0.5
            const corruptionIndex = props['Corruption Perceptions Index'] || 50

            // Parse religion percentages
            const religions: Partial<Record<Religion, number>> = {
                Christian: religionProps['Percent Christian'] || 0,
                Muslim: religionProps['Percent Muslim'] || 0,
                Hindu: religionProps['Percent Hindu'] || 0,
                Buddhist: religionProps['Percent Buddhist'] || 0,
                Jewish: religionProps['Percent Jewish'] || 0,
                Folk: religionProps['Percent Folk Religion'] || 0,
                Other: religionProps['Percent Other'] || 0,
                Unaffiliated: religionProps['Percent Unaffiliated'] || 0,
            }

            // Calculate derived stats
            const economyScale = Math.log10((gniPerCapita * population) / 1_000_000_000 + 1)
            const power = Math.round((prosperityIndex * 0.5 + economyScale * 20 + freedomScore * 0.3))
            const soldiers = Math.round(population * 0.01)
            const economy = Math.min(100, Math.round((gniPerCapita / 80000) * 100))
            const authority = Math.round(100 - freedomScore)

            dataMap.set(iso3, {
                iso3,
                name: props.Name || props['Official Name'] || iso3,
                population,
                gniPerCapita,
                economicFreedomIndex,
                prosperityIndex,
                freedomScore,
                liberalDemocracyIndex,
                corruptionIndex,
                religions,
                power,
                soldiers,
                economy,
                authority,
            })
        }

        console.log(`📊 Loaded data for ${dataMap.size} countries`)
    } catch (error) {
        console.warn('⚠️ Could not load country data:', error)
    }

    return dataMap
}

/**
 * Initialize country data (call early in app lifecycle)
 */
export async function initCountryData(): Promise<void> {
    if (!countryDataCache && !loadingPromise) {
        loadingPromise = loadCountryData()
        countryDataCache = await loadingPromise
        loadingPromise = null
    }
}

/**
 * Get country data by ISO3 code
 */
export function getCountryData(iso3: string): CountryData | undefined {
    return countryDataCache?.get(iso3)
}

/**
 * Get all country data
 */
export function getAllCountryData(): Map<string, CountryData> {
    return countryDataCache || new Map()
}

/**
 * Get primary religion for a country
 */
export function getPrimaryReligion(iso3: string): Religion {
    const data = getCountryData(iso3)
    if (!data) return 'Unaffiliated'

    let maxReligion: Religion = 'Unaffiliated'
    let maxPercent = 0

    for (const [religion, percent] of Object.entries(data.religions)) {
        if ((percent ?? 0) > maxPercent) {
            maxPercent = percent ?? 0
            maxReligion = religion as Religion
        }
    }

    return maxReligion
}

/**
 * Get all religions sorted by percentage for a country
 */
export function getReligionDistribution(iso3: string): Array<{ religion: Religion, percent: number }> {
    const data = getCountryData(iso3)
    if (!data) return []

    return Object.entries(data.religions)
        .map(([religion, percent]) => ({ religion: religion as Religion, percent: percent ?? 0 }))
        .filter(r => r.percent > 0)
        .sort((a, b) => b.percent - a.percent)
}

import { COUNTRY_CULTURE_MAP, DEFAULT_CULTURE } from '../data/cultureData'

/**
 * Get primary language for a country
 */
export function getPrimaryLanguage(iso3: string): string {
    return COUNTRY_CULTURE_MAP[iso3]?.language || DEFAULT_CULTURE.language
}

/**
 * Get primary culture for a country
 */
export function getPrimaryCulture(iso3: string): string {
    return COUNTRY_CULTURE_MAP[iso3]?.culture || DEFAULT_CULTURE.culture
}
