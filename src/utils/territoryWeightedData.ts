/**
 * Territory Weighted Data
 * 
 * Calculates country-like data for drawn territories by weighting
 * data from constituent countries based on area claimed.
 */

import type { Consequence } from '../types/store'
import type { Constitution } from '../types/game'
import {
    getCountryData,
    getPrimaryReligion,
    getPrimaryLanguage,
    getPrimaryCulture,
    type Religion
} from './countryData'
import { getGeopoliticalData } from './geopoliticalData'

export interface WeightedTerritoryData {
    // Population (sum, not weighted)
    population: number

    // Economics (weighted averages)
    gniPerCapita: number
    economicFreedomIndex: number
    prosperityIndex: number

    // Governance (weighted averages)
    freedomScore: number
    liberalDemocracyIndex: number
    corruptionIndex: number

    // Primary attributes (majority wins, weighted)
    primaryReligion: Religion
    primaryLanguage: string
    primaryCulture: string

    // Political (weighted averages from geopolitical data)
    unrest: number // 1-5 scale
    freedom: number // 1-5 scale
    military: number // 1-5 scale

    // Breakdown by source country
    constituents: Array<{
        code: string
        name: string
        areaKm2: number
        weight: number // 0-1
        population: number
    }>
}

/**
 * Calculate weighted territory data from consequences
 */
export function calculateWeightedTerritoryData(consequences: Consequence[]): WeightedTerritoryData {
    const totalArea = consequences.reduce((sum, c) => sum + c.lostArea, 0)

    if (totalArea === 0 || consequences.length === 0) {
        // Return defaults if no territory
        return getDefaultTerritoryData()
    }

    // Calculate weights for each country
    const countryWeights = consequences.map(c => ({
        code: c.countryCode,
        name: c.countryName,
        areaKm2: c.lostArea,
        weight: c.lostArea / totalArea,
        population: c.populationCaptured
    }))

    // Weighted economic/governance averages
    let weightedGni = 0
    let weightedEconomicFreedom = 0
    let weightedProsperity = 0
    let weightedFreedomScore = 0
    let weightedDemocracy = 0
    let weightedCorruption = 0
    let weightedUnrest = 0
    let weightedFreedom = 0
    let weightedMilitary = 0

    // Religion/Language/Culture voting (accumulate weighted votes)
    const religionVotes: Record<string, number> = {}
    const languageVotes: Record<string, number> = {}
    const cultureVotes: Record<string, number> = {}

    let totalWeightApplied = 0

    for (const cw of countryWeights) {
        const countryData = getCountryData(cw.code)
        const geoData = getGeopoliticalData(cw.code)

        if (countryData) {
            weightedGni += countryData.gniPerCapita * cw.weight
            weightedEconomicFreedom += countryData.economicFreedomIndex * cw.weight
            weightedProsperity += countryData.prosperityIndex * cw.weight
            weightedFreedomScore += countryData.freedomScore * cw.weight
            weightedDemocracy += countryData.liberalDemocracyIndex * cw.weight
            weightedCorruption += countryData.corruptionIndex * cw.weight
            totalWeightApplied += cw.weight
        }

        if (geoData) {
            weightedUnrest += geoData.unrest * cw.weight
            weightedFreedom += geoData.freedom * cw.weight
            weightedMilitary += geoData.military * cw.weight
        }

        // Vote for religion/language/culture
        const religion = getPrimaryReligion(cw.code)
        const language = getPrimaryLanguage(cw.code)
        const culture = getPrimaryCulture(cw.code)

        religionVotes[religion] = (religionVotes[religion] || 0) + cw.weight
        languageVotes[language] = (languageVotes[language] || 0) + cw.weight
        cultureVotes[culture] = (cultureVotes[culture] || 0) + cw.weight
    }

    // Normalize if not all weights were applied (missing data)
    const normalizer = totalWeightApplied > 0 ? 1 / totalWeightApplied : 1

    // Find winners for categorical attributes
    const primaryReligion = getMaxKey(religionVotes) as Religion || 'Unaffiliated'
    const primaryLanguage = getMaxKey(languageVotes) || 'English'
    const primaryCulture = getMaxKey(cultureVotes) || 'Western'

    const totalPopulation = consequences.reduce((sum, c) => sum + c.populationCaptured, 0)

    return {
        population: totalPopulation,
        gniPerCapita: Math.round(weightedGni * normalizer),
        economicFreedomIndex: Math.round(weightedEconomicFreedom * normalizer * 10) / 10,
        prosperityIndex: Math.round(weightedProsperity * normalizer * 10) / 10,
        freedomScore: Math.round(weightedFreedomScore * normalizer),
        liberalDemocracyIndex: Math.round(weightedDemocracy * normalizer * 100) / 100,
        corruptionIndex: Math.round(weightedCorruption * normalizer),
        primaryReligion,
        primaryLanguage,
        primaryCulture,
        unrest: Math.round(weightedUnrest * 10) / 10 || 2,
        freedom: Math.round(weightedFreedom * 10) / 10 || 3,
        military: Math.round(weightedMilitary * 10) / 10 || 2,
        constituents: countryWeights
    }
}

/**
 * Calculate initial unrest based on cultural compatibility
 * Higher unrest if player's constitution differs from territory's majority
 */
export function calculateCulturalUnrest(
    playerConstitution: Constitution,
    territoryData: WeightedTerritoryData
): number {
    let unrestPenalty = 0

    // +20% unrest for each mismatch
    if (playerConstitution.language !== territoryData.primaryLanguage) {
        unrestPenalty += 20
        console.log(`🗣️ Language mismatch: ${playerConstitution.language} vs ${territoryData.primaryLanguage} (+20% unrest)`)
    }

    if (playerConstitution.culture !== territoryData.primaryCulture) {
        unrestPenalty += 20
        console.log(`🎭 Culture mismatch: ${playerConstitution.culture} vs ${territoryData.primaryCulture} (+20% unrest)`)
    }

    if (playerConstitution.religion !== territoryData.primaryReligion) {
        unrestPenalty += 20
        console.log(`⛪ Religion mismatch: ${playerConstitution.religion} vs ${territoryData.primaryReligion} (+20% unrest)`)
    }

    // Convert base territory unrest (1-5) to percentage (0-100) and add penalty
    const baseUnrestPercent = (territoryData.unrest - 1) * 10 // 1=0%, 5=40%
    const totalUnrest = Math.min(100, baseUnrestPercent + unrestPenalty)

    console.log(`📊 Initial unrest: base ${baseUnrestPercent}% + penalty ${unrestPenalty}% = ${totalUnrest}%`)

    return totalUnrest
}

/**
 * Get default territory data when no consequences available
 */
function getDefaultTerritoryData(): WeightedTerritoryData {
    return {
        population: 0,
        gniPerCapita: 20000,
        economicFreedomIndex: 60,
        prosperityIndex: 60,
        freedomScore: 60,
        liberalDemocracyIndex: 0.5,
        corruptionIndex: 50,
        primaryReligion: 'Unaffiliated',
        primaryLanguage: 'English',
        primaryCulture: 'Western',
        unrest: 2,
        freedom: 3,
        military: 2,
        constituents: []
    }
}

/**
 * Helper to find key with maximum value
 */
function getMaxKey(votes: Record<string, number>): string | undefined {
    let maxKey: string | undefined
    let maxValue = 0

    for (const [key, value] of Object.entries(votes)) {
        if (value > maxValue) {
            maxValue = value
            maxKey = key
        }
    }

    return maxKey
}
