import type { NationStats, Building } from '../types/game'
import type { InfrastructureStats } from './infrastructure'

/**
 * Calculate total income based on stats and budget
 */
export function calculateIncome(
    stats: NationStats,
    infra: InfrastructureStats,
    population: number,
    buildings: Building[] = [],
    aiCountries: Map<string, any> = new Map()
): {
    total: number
    taxIncome: number
    tradeIncome: number
    resourceIncome: number
} {
    // Count buildings
    const universities = buildings.filter(b => b.type === 'UNIVERSITY').length

    // 1. Tax Income
    // Base GDP per capita is modified by infrastructure and stability (social budget)
    // Default GDP/capita around $10k - $50k
    const baseGDP = stats.gdpPerCapita || 20000

    // Infrastructure multiplier (0.5 to 2.0)
    const infraMult = 0.5 + (stats.budgetAllocation.infrastructure / 100) * 1.5

    // Social stability multiplier (0.8 to 1.2)
    const stabilityMult = 0.8 + (stats.budgetAllocation.social / 100) * 0.4

    const realGDP = baseGDP * infraMult * stabilityMult
    const totalGDP = realGDP * population

    // Tax revenue = GDP * Tax Rate
    // Tax rate is 0-100, but effective tax collection efficiency is usually lower
    // Universities boost efficiency (+5% per university)
    const universityBonus = universities * 0.05
    const efficiency = 0.7 + (stats.budgetAllocation.research / 100) * 0.3 + universityBonus
    const taxIncome = (totalGDP * (stats.taxRate / 100)) * efficiency / 12 // Monthly

    // 2. Trade Income
    // Based on GDP and Trade Openness (Ports/Airports)
    // Base Trade = 10% of GDP
    // Each Port adds +5% to Trade Openness
    // Each Airport adds +2% to Trade Openness
    // Infrastructure Budget acts as efficiency multiplier

    const baseTradePotential = totalGDP * 0.1
    const portBonus = infra.totalPorts * 0.05
    const airportBonus = infra.totalAirports * 0.02
    const tradeOpenness = portBonus + airportBonus

    const tradeEfficiency = 0.5 + (stats.budgetAllocation.infrastructure / 100) * 1.0

    // Diplomatic Relations Bonus
    // Sum of positive relations with other countries
    let relationsBonus = 0
    aiCountries.forEach((country) => {
        if (country.relations > 0) {
            relationsBonus += country.relations
        }
    })
    // Cap bonus at 200% (2000 total relations points)
    const tradeRelationsMultiplier = 1.0 + Math.min(2.0, relationsBonus / 1000)

    // Final Trade Income
    // If no ports/airports, trade is 0 (closed economy)
    const tradeIncome = (baseTradePotential * tradeOpenness * tradeEfficiency * tradeRelationsMultiplier) / 12 // Monthly

    // 3. Resource Income
    // Simplified: Based on land area and research
    // $100 per km2 per month base
    const areaIncome = (stats.wealth * 1000) // wealth is approx area in km2
    const resourceEfficiency = 1.0 + (stats.budgetAllocation.research / 100) * 1.0 + universityBonus
    const resourceIncome = areaIncome * resourceEfficiency

    return {
        total: Math.round(taxIncome + tradeIncome + resourceIncome),
        taxIncome: Math.round(taxIncome),
        tradeIncome: Math.round(tradeIncome),
        resourceIncome: Math.round(resourceIncome)
    }
}

/**
 * Calculate total expenses based on stats and budget
 */
export function calculateExpenses(
    stats: NationStats,
    population: number,
    buildings: Building[] = []
): {
    total: number
    militaryExpense: number
    socialExpense: number
    infraExpense: number
    researchExpense: number
    upkeepExpense: number
} {
    // 1. Military Expense
    // Cost per soldier + equipment maintenance
    // Equipment cost scales with army size and budget intensity
    const costPerSoldier = 2000 // Monthly cost per soldier
    const baseEquipmentCost = 5000000 // Base fixed cost
    const equipmentPerSoldier = 500 // Equipment cost per soldier at max budget
    const equipmentCost = (stats.budgetAllocation.military / 100) * (baseEquipmentCost + (stats.soldiers * equipmentPerSoldier))
    const militaryExpense = (stats.soldiers * costPerSoldier) + equipmentCost

    // 2. Social Expense
    // Cost per capita based on social budget setting
    // $10 - $200 per person per month (Increased top end)
    const perCapitaSocial = 10 + (stats.budgetAllocation.social / 100) * 190
    const socialExpense = population * perCapitaSocial

    // 3. Infrastructure Expense
    // Maintenance of roads, ports, etc.
    // Base cost + budget allocation scaling with territory size (wealth)
    const infraBase = stats.wealth * 500 // $500 per km2 maintenance
    // Investment scales with territory size: up to $2000 per km2 at max budget
    const infraInvestment = (stats.budgetAllocation.infrastructure / 100) * (stats.wealth * 2000)
    const infraExpense = infraBase + infraInvestment

    // 4. Research Expense
    // Investment scales with population (more scientists/universities)
    // Up to $100 per capita at max budget
    const researchExpense = (stats.budgetAllocation.research / 100) * (population * 100)

    // 5. General Upkeep (Bureaucracy + Buildings)
    // Scales with population and territory
    const bureaucracyCost = (population * 5) + (stats.wealth * 100)

    // Building Upkeep
    let buildingUpkeep = 0
    buildings.forEach(b => {
        switch (b.type) {
            case 'FORT': buildingUpkeep += 50000; break
            case 'TRAINING_CAMP': buildingUpkeep += 20000; break
            case 'UNIVERSITY': buildingUpkeep += 100000; break
        }
    })

    const upkeepExpense = bureaucracyCost + buildingUpkeep

    return {
        total: Math.round(militaryExpense + socialExpense + infraExpense + researchExpense + upkeepExpense),
        militaryExpense: Math.round(militaryExpense),
        socialExpense: Math.round(socialExpense),
        infraExpense: Math.round(infraExpense),
        researchExpense: Math.round(researchExpense),
        upkeepExpense: Math.round(upkeepExpense)
    }
}

/**
 * Main economy calculation loop
 */
export function calculateEconomy(
    nation: { stats: NationStats, buildings?: Building[] },
    infra: InfrastructureStats | null,
    aiCountries: Map<string, any>
): {
    netIncome: number
    totalIncome: number
    expenses: number
    tradeIncome: number
    taxIncome: number
    soldierGrowth: number
    stats: Partial<NationStats>
} {
    const stats = nation.stats
    const buildings = nation.buildings || []
    const safeInfra = infra || {
        airports: [],
        ports: [],
        cities: [],
        totalAirports: 0,
        totalPorts: 0,
        totalPopulation: 0,
        hasSeaAccess: false,
        hasAirAccess: false
    }

    // Population is roughly based on captured cities + base
    // In a real game this would be tracked more precisely
    const population = safeInfra.totalPopulation || 1000000

    const income = calculateIncome(stats, safeInfra, population, buildings, aiCountries)
    const expense = calculateExpenses(stats, population, buildings)

    const netIncome = income.total - expense.total

    // Calculate soldier recruitment
    // Base growth + military budget influence
    // Training camps boost recruitment (+10% per camp)
    const trainingCamps = buildings.filter(b => b.type === 'TRAINING_CAMP').length
    const campBonus = trainingCamps * 0.1

    const baseRecruitment = 100
    const recruitment = baseRecruitment * (1 + (stats.budgetAllocation.military / 100) * 2 + campBonus)

    return {
        netIncome,
        totalIncome: income.total,
        expenses: expense.total,
        tradeIncome: income.tradeIncome,
        taxIncome: income.taxIncome,
        soldierGrowth: Math.round(recruitment),
        stats: {
            taxIncome: income.taxIncome,
            tradeIncome: income.tradeIncome,
            expenses: expense.total
        }
    }
}

export function formatMoney(amount: number): string {
    if (Math.abs(amount) >= 1_000_000_000) {
        return `$${(amount / 1_000_000_000).toFixed(1)}B`
    }
    if (Math.abs(amount) >= 1_000_000) {
        return `$${(amount / 1_000_000).toFixed(1)}M`
    }
    if (Math.abs(amount) >= 1_000) {
        return `$${(amount / 1_000).toFixed(1)}K`
    }
    return `$${amount.toLocaleString()}`
}
