import type { NationStats, CapturedCity } from '../types/game'
import type { Consequence } from '../store/gameStore'
import { calculatePower } from './powerSystem'

/**
 * Calculate nation stats from conquered territories
 */
export function calculateNationStats(
    consequences: Consequence[],
    capturedCities: CapturedCity[]
): NationStats {
    // Total area in km²
    const totalArea = consequences.reduce((sum, c) => sum + c.lostArea, 0)

    // Total population captured
    const territoryPop = consequences.reduce((sum, c) => sum + c.populationCaptured, 0)
    const cityPop = capturedCities.reduce((sum, c) => sum + c.population, 0)
    const totalPopulation = territoryPop + cityPop

    // Calculate stats
    // Wealth: area contributes + cities contribute more
    const wealth = Math.round(totalArea * 0.01 + capturedCities.length * 10 + cityPop / 100000)

    // Defence: based on population and area (more area = harder to defend)
    const defence = Math.round(totalPopulation * 0.001 + totalArea * 0.005)

    // Diplomatic power: based on economy and population
    const diplomaticPower = Math.round(wealth * 0.5 + totalPopulation / 1000000)

    // Manpower: 10% of population (fit for service)
    const manpower = Math.round(totalPopulation * 0.10)
    const soldiers = Math.round(manpower * 0.10) // 10% of manpower active (1% of total pop)

    // Calculate Power using unified system
    // Player wealth is in $, so we pass it directly
    // Authority is not yet tracked for player, assume 50 for now
    const powerStats = calculatePower(soldiers, wealth, 50, true)

    return {
        wealth,
        defence,
        diplomaticPower,
        manpower,
        soldiers,
        power: powerStats.totalPower,

        // Economy (initialized to defaults, updated by ConstitutionModal)
        budget: 0,
        taxRate: 20,
        gdpPerCapita: 0,
        tradeIncome: 0,
        taxIncome: 0,
        expenses: 0,
        budgetAllocation: {
            social: 50,
            military: 50,
            infrastructure: 50,
            research: 50
        }
    }
}

/**
 * Calculate stats for an AI country based on remaining territory
 */
export function calculateAICountryStats(
    originalPopulation: number,
    territoryLostPercent: number
): { soldiers: number, power: number } {
    const remainingPercent = (100 - territoryLostPercent) / 100
    const effectivePopulation = originalPopulation * remainingPercent

    // Soldiers: 2% of remaining population
    const soldiers = Math.round(effectivePopulation * 0.02)

    // Power: log scale based on soldiers
    const power = Math.round(Math.log10(soldiers + 1) * 10)

    return { soldiers, power }
}
