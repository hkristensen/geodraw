import type { NationStats, Building } from '../types/game'
import type { InfrastructureStats } from './infrastructure'

// =============================================================================
// ECONOMIC CYCLE SYSTEM
// =============================================================================

/**
 * Economic cycle phases (realistic business cycles)
 * Full cycle: ~48-72 game months
 */
export type EconomicPhase = 'EXPANSION' | 'PEAK' | 'RECESSION' | 'RECOVERY'

export interface EconomicCycleState {
    phase: EconomicPhase
    monthsInPhase: number
    globalModifier: number      // -0.20 to +0.15
    oilPrice: number           // 50-150 (baseline 100)
    lastPhaseChange: number    // Timestamp
}

// Phase durations (in game months)
const PHASE_DURATIONS: Record<EconomicPhase, { min: number, max: number }> = {
    EXPANSION: { min: 18, max: 36 },
    PEAK: { min: 1, max: 6 },
    RECESSION: { min: 12, max: 24 },
    RECOVERY: { min: 12, max: 24 }
}

// Phase effects on economy
const PHASE_MODIFIERS: Record<EconomicPhase, number> = {
    EXPANSION: 0.10,   // +10% income
    PEAK: 0.15,        // +15% income (but risky)
    RECESSION: -0.15,  // -15% income
    RECOVERY: 0.0      // Neutral, returning to normal
}

// Oil price ranges per phase
const PHASE_OIL_PRICES: Record<EconomicPhase, { min: number, max: number }> = {
    EXPANSION: { min: 90, max: 130 },
    PEAK: { min: 110, max: 150 },
    RECESSION: { min: 50, max: 80 },
    RECOVERY: { min: 70, max: 100 }
}

/**
 * Initialize economic cycle state
 */
export function initEconomicCycle(): EconomicCycleState {
    // Start in a random phase for variety
    const phases: EconomicPhase[] = ['EXPANSION', 'RECOVERY', 'EXPANSION', 'RECOVERY']
    const phase = phases[Math.floor(Math.random() * phases.length)]

    return {
        phase,
        monthsInPhase: 0,
        globalModifier: PHASE_MODIFIERS[phase],
        oilPrice: 100,
        lastPhaseChange: Date.now()
    }
}

/**
 * Get the next phase in the cycle
 */
function getNextPhase(current: EconomicPhase): EconomicPhase {
    switch (current) {
        case 'RECOVERY': return 'EXPANSION'
        case 'EXPANSION': return 'PEAK'
        case 'PEAK': return 'RECESSION'
        case 'RECESSION': return 'RECOVERY'
    }
}

/**
 * Update economic cycle (call monthly)
 */
export function updateEconomicCycle(state: EconomicCycleState): EconomicCycleState {
    const newMonths = state.monthsInPhase + 1
    const duration = PHASE_DURATIONS[state.phase]

    // Check if phase should transition
    // Guaranteed transition after max duration, chance to transition after min
    let shouldTransition = false
    if (newMonths >= duration.max) {
        shouldTransition = true
    } else if (newMonths >= duration.min) {
        // Increasing chance to transition as we approach max
        const transitionChance = (newMonths - duration.min) / (duration.max - duration.min)
        shouldTransition = Math.random() < transitionChance * 0.3 // Max 30% chance per month
    }

    if (shouldTransition) {
        const newPhase = getNextPhase(state.phase)
        const oilRange = PHASE_OIL_PRICES[newPhase]

        return {
            phase: newPhase,
            monthsInPhase: 0,
            globalModifier: PHASE_MODIFIERS[newPhase],
            oilPrice: oilRange.min + Math.random() * (oilRange.max - oilRange.min),
            lastPhaseChange: Date.now()
        }
    }

    // Drift oil price based on phase
    const oilRange = PHASE_OIL_PRICES[state.phase]
    const oilDrift = (Math.random() - 0.5) * 10 // ±5 per month
    const newOilPrice = Math.max(oilRange.min, Math.min(oilRange.max, state.oilPrice + oilDrift))

    return {
        ...state,
        monthsInPhase: newMonths,
        oilPrice: newOilPrice
    }
}

/**
 * Calculate country-specific economic modifier based on characteristics
 * Some countries are more affected by global cycles than others
 */
export function getCountryEconomicModifier(
    globalCycle: EconomicCycleState,
    countryCharacteristics: {
        isOilExporter?: boolean
        isOilImporter?: boolean
        tradeDependency?: number    // 0-1, how reliant on trade
        economyDiversity?: number   // 0-1, how diverse the economy
    }
): number {
    const {
        isOilExporter = false,
        isOilImporter = false,
        tradeDependency = 0.5,
        economyDiversity = 0.5
    } = countryCharacteristics

    let modifier = globalCycle.globalModifier

    // Oil price effects
    const oilDeviation = (globalCycle.oilPrice - 100) / 100 // -0.5 to +0.5

    if (isOilExporter) {
        // Oil exporters benefit from high prices, hurt by low prices
        modifier += oilDeviation * 0.2
    }
    if (isOilImporter) {
        // Oil importers hurt by high prices, benefit from low prices
        modifier -= oilDeviation * 0.15
    }

    // Trade dependency amplifies global effects
    modifier *= (1 + (tradeDependency - 0.5) * 0.5)

    // Economic diversity reduces volatility
    modifier *= (1.5 - economyDiversity)

    // Clamp to reasonable range
    return Math.max(-0.30, Math.min(0.25, modifier))
}

/**
 * Get human-readable cycle description
 */
export function getCycleDescription(cycle: EconomicCycleState): string {
    const descriptions: Record<EconomicPhase, string> = {
        EXPANSION: 'The global economy is expanding. Trade is booming.',
        PEAK: 'Economic activity has peaked. Overheating risks present.',
        RECESSION: 'Global recession in effect. Markets are struggling.',
        RECOVERY: 'Economic recovery underway. Conditions stabilizing.'
    }
    return descriptions[cycle.phase]
}

/**
 * Calculate total income based on stats and budget
 * Now includes optional economic cycle modifier
 */
export function calculateIncome(
    stats: NationStats,
    infra: InfrastructureStats,
    population: number,
    buildings: Building[] = [],
    aiCountries: Map<string, any> = new Map(),
    economicCycle?: EconomicCycleState,
    countryCharacteristics?: { isOilExporter?: boolean, isOilImporter?: boolean, tradeDependency?: number, economicDiversity?: number }
): {
    total: number
    taxIncome: number
    tradeIncome: number
    resourceIncome: number
    cycleModifier: number
} {
    // Count buildings
    const universities = buildings.filter(b => b.type === 'UNIVERSITY').length
    const factories = buildings.filter(b => b.type === 'FACTORY').length
    const markets = buildings.filter(b => b.type === 'MARKET').length

    // 1. Tax Income
    // Base GDP per capita is modified by infrastructure and stability (social budget)
    // Default GDP/capita around $10k - $50k
    const baseGDP = stats.gdpPerCapita || 20000

    // Infrastructure multiplier (0.5 to 2.0)
    const infraMult = 0.5 + (stats.budgetAllocation.infrastructure / 100) * 1.5

    // Social stability multiplier (0.8 to 1.2)
    const stabilityMult = 0.8 + (stats.budgetAllocation.social / 100) * 0.4

    // Factory Bonus (GDP)
    const factoryBonus = factories * 0.1 // +10% GDP per factory
    const realGDP = baseGDP * infraMult * stabilityMult * (1 + factoryBonus)
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
    // Market Bonus
    const marketBonus = markets * 0.05 // +5% trade openness per market
    const tradeOpenness = portBonus + airportBonus + marketBonus

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

    // Apply economic cycle modifier if provided
    let cycleModifier = 0
    if (economicCycle) {
        // Get global modifier
        cycleModifier = economicCycle.globalModifier

        // Apply country-specific adjustments if characteristics provided
        if (countryCharacteristics) {
            cycleModifier = getCountryEconomicModifier(
                economicCycle,
                {
                    isOilExporter: countryCharacteristics.isOilExporter ?? false,
                    isOilImporter: countryCharacteristics.isOilImporter ?? false,
                    tradeDependency: countryCharacteristics.tradeDependency ?? 0.5,
                    economyDiversity: countryCharacteristics.economicDiversity ?? 0.5
                }
            )
        }
    }

    const baseTotal = taxIncome + tradeIncome + resourceIncome
    const adjustedTotal = baseTotal * (1 + cycleModifier)

    return {
        total: Math.round(adjustedTotal),
        taxIncome: Math.round(taxIncome),
        tradeIncome: Math.round(tradeIncome),
        resourceIncome: Math.round(resourceIncome),
        cycleModifier
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
            case 'RESEARCH_LAB': buildingUpkeep += 150000; break
            case 'TEMPLE': buildingUpkeep += 30000; break
            case 'FACTORY': buildingUpkeep += 80000; break
            case 'MARKET': buildingUpkeep += 25000; break
            case 'HOSPITAL': buildingUpkeep += 60000; break
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
        totalAreaKm2: 0,
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

/**
 * Calculate monthly Research Points generation
 */
export function calculateResearchOutput(
    stats: NationStats,
    population: number,
    buildings: Building[] = []
): number {
    // 1. Base RP from Budget
    // Scales with population and research budget
    // Example: 1M pop, 50% budget => 50 RP/month
    const baseRP = (stats.budgetAllocation.research / 100) * (population / 10000)

    // 2. Building Bonuses
    const researchLabs = buildings.filter(b => b.type === 'RESEARCH_LAB').length
    const universities = buildings.filter(b => b.type === 'UNIVERSITY').length

    const labBonus = researchLabs * 10 // +10 RP per lab
    const uniBonus = universities * 5  // +5 RP per university

    return Math.floor(baseRP + labBonus + uniBonus)
}
