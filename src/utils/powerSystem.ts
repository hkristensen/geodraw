
/**
 * Unified Power System
 * 
 * Calculates a standardized "Power Score" for both Player and AI nations.
 * This score is used for diplomatic calculations, rankings, and war predictions.
 * 
 * Formula:
 * Power = (Military Score * 0.4) + (Economy Score * 0.4) + (Authority Score * 0.2)
 */

export interface PowerComponents {
    militaryScore: number
    economyScore: number
    authorityScore: number
    totalPower: number
}

export function calculatePower(
    soldiers: number,
    wealthOrEconomy: number, // Player: Wealth ($), AI: Economy (0-100)
    authority: number,       // 0-100
    isPlayer: boolean = false
): PowerComponents {
    // 1. Normalize Military Score (0-100)
    // Baseline: 10,000 soldiers = 10 points. 100,000 soldiers = 100 points.
    // Cap at 100 for "normal" power, but can go higher for superpowers.
    const militaryScore = Math.min(200, Math.round(soldiers / 1000))

    // 2. Normalize Economy Score (0-100)
    let economyScore = 0
    if (isPlayer) {
        // Player Wealth: $1M = 10 points. $10M = 100 points.
        economyScore = Math.min(200, Math.round(wealthOrEconomy / 100000))
    } else {
        // AI Economy: Already 0-100
        economyScore = wealthOrEconomy
    }

    // 3. Normalize Authority Score (0-100)
    const authorityScore = Math.min(100, Math.max(0, authority))

    // 4. Calculate Weighted Total
    // Weights: 40% Military, 40% Economy, 20% Authority
    const totalPower = Math.round(
        (militaryScore * 0.4) +
        (economyScore * 0.4) +
        (authorityScore * 0.2)
    )

    return {
        militaryScore,
        economyScore,
        authorityScore,
        totalPower
    }
}
