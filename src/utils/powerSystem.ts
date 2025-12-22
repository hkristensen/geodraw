/**
 * Unified Power System (v2.0)
 * 
 * Calculates a standardized "Power Score" for both Player and AI nations.
 * Used for diplomatic calculations, rankings, and war predictions.
 * 
 * New Formula (5 components):
 * - Military: 25% (soldiers × quality modifier)
 * - Economy: 25% (GDP × trade openness)
 * - Diplomacy: 20% (allies + coalitions + agreements)
 * - Stability: 15% (100 - unrest)
 * - Technology: 15% (research level + buildings)
 */

export interface PowerComponents {
    militaryScore: number
    economyScore: number
    diplomacyScore: number
    stabilityScore: number
    technologyScore: number
    totalPower: number
}

// Weights for each component
export const POWER_WEIGHTS = {
    military: 0.25,
    economy: 0.25,
    diplomacy: 0.20,
    stability: 0.15,
    technology: 0.15
} as const

/**
 * Extended power calculation with all components
 */
export function calculatePowerExtended(params: {
    soldiers: number
    economy: number       // 0-100 for AI, or raw GDP for player
    isPlayer: boolean
    // Optional components (default to neutral)
    allyCount?: number
    coalitionCount?: number
    agreementCount?: number
    unrest?: number       // 0-100, lower = more stable
    researchLevel?: number // 0-100
    buildingCount?: number
    qualityModifier?: number // 0.5-2.0, affects military effectiveness
}): PowerComponents {
    const {
        soldiers,
        economy,
        isPlayer = false,
        allyCount = 0,
        coalitionCount = 0,
        agreementCount = 0,
        unrest = 50,
        researchLevel = 0,
        buildingCount = 0,
        qualityModifier = 1.0
    } = params

    // 1. Military Score (0-200+)
    // Base: 10,000 soldiers = 10 points, 100,000 = 100 points
    // Modified by quality (training, tech, equipment)
    const baseMilitary = Math.min(200, Math.round(soldiers / 1000))
    const militaryScore = Math.round(baseMilitary * qualityModifier)

    // 2. Economy Score (0-200)
    let economyScore = 0
    if (isPlayer) {
        // Player: $1M = 10 points, $10M = 100 points
        economyScore = Math.min(200, Math.round(economy / 100000))
    } else {
        // AI: Already normalized 0-100
        economyScore = Math.min(200, economy)
    }

    // 3. Diplomacy Score (0-100)
    // Each ally = +10, coalition = +15, agreement = +5
    const diplomacyScore = Math.min(100,
        (allyCount * 10) +
        (coalitionCount * 15) +
        (agreementCount * 5)
    )

    // 4. Stability Score (0-100)
    // Inverse of unrest
    const stabilityScore = Math.max(0, Math.min(100, 100 - unrest))

    // 5. Technology Score (0-100)
    // Research level + buildings bonus
    const techFromResearch = Math.min(60, researchLevel)
    const techFromBuildings = Math.min(40, buildingCount * 5)
    const technologyScore = Math.min(100, techFromResearch + techFromBuildings)

    // Calculate weighted total
    const totalPower = Math.round(
        (militaryScore * POWER_WEIGHTS.military) +
        (economyScore * POWER_WEIGHTS.economy) +
        (diplomacyScore * POWER_WEIGHTS.diplomacy) +
        (stabilityScore * POWER_WEIGHTS.stability) +
        (technologyScore * POWER_WEIGHTS.technology)
    )

    return {
        militaryScore,
        economyScore,
        diplomacyScore,
        stabilityScore,
        technologyScore,
        totalPower
    }
}

/**
 * Simplified power calculation (backward compatible)
 * Uses only basic inputs, estimates missing components
 */
export function calculatePower(
    soldiers: number,
    wealthOrEconomy: number,
    authority: number,
    isPlayer: boolean = false
): PowerComponents {
    // Estimate stability from authority (higher authority = more controlled, less unrest)
    const estimatedUnrest = Math.max(0, 100 - authority)

    const result = calculatePowerExtended({
        soldiers,
        economy: wealthOrEconomy,
        isPlayer,
        unrest: estimatedUnrest,
        // Use neutral defaults for other components
        allyCount: 0,
        coalitionCount: 0,
        agreementCount: 0,
        researchLevel: 20, // Baseline
        buildingCount: 0
    })

    // Return with backward compatible interface
    return {
        militaryScore: result.militaryScore,
        economyScore: result.economyScore,
        diplomacyScore: result.diplomacyScore,
        stabilityScore: result.stabilityScore,
        technologyScore: result.technologyScore,
        totalPower: result.totalPower
    }
}

/**
 * Calculate player power with full context
 */
export function calculatePlayerPower(
    soldiers: number,
    budget: number,
    allyCount: number,
    coalitionMemberships: number,
    agreements: number,
    unrest: number,
    researchPoints: number,
    buildingCount: number
): PowerComponents {
    return calculatePowerExtended({
        soldiers,
        economy: budget,
        isPlayer: true,
        allyCount,
        coalitionCount: coalitionMemberships,
        agreementCount: agreements,
        unrest,
        researchLevel: Math.min(100, researchPoints / 10), // Convert RP to level
        buildingCount
    })
}

/**
 * Calculate AI country power with available data
 */
export function calculateAIPower(
    country: {
        soldiers: number
        economy: number
        allies: string[]
        agreements: { id: string }[]
        politicalState?: { unrest?: number }
    },
    coalitionMemberships: number = 0
): PowerComponents {
    return calculatePowerExtended({
        soldiers: country.soldiers,
        economy: country.economy,
        isPlayer: false,
        allyCount: country.allies?.length || 0,
        coalitionCount: coalitionMemberships,
        agreementCount: country.agreements?.length || 0,
        unrest: (country.politicalState?.unrest || 3) * 20, // Convert 1-5 to 0-100
        researchLevel: 30, // Baseline estimate
        buildingCount: 0
    })
}

/**
 * Compare powers and get advantage description
 */
export function comparePower(
    attackerPower: number,
    defenderPower: number
): { ratio: number, advantage: string } {
    const ratio = attackerPower / Math.max(defenderPower, 1)

    let advantage: string
    if (ratio >= 3.0) {
        advantage = 'Overwhelming advantage'
    } else if (ratio >= 2.0) {
        advantage = 'Strong advantage'
    } else if (ratio >= 1.5) {
        advantage = 'Moderate advantage'
    } else if (ratio >= 1.1) {
        advantage = 'Slight advantage'
    } else if (ratio >= 0.9) {
        advantage = 'Evenly matched'
    } else if (ratio >= 0.66) {
        advantage = 'Slight disadvantage'
    } else if (ratio >= 0.5) {
        advantage = 'Moderate disadvantage'
    } else {
        advantage = 'Severe disadvantage'
    }

    return { ratio, advantage }
}
