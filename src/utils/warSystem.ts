/**
 * Dice-based war system with scaled casualties
 * Better balanced for large armies
 */

export interface BattleRound {
    attackerDice: number[]
    defenderDice: number[]
    attackerLosses: number
    defenderLosses: number
}

export interface WarResult {
    winner: 'attacker' | 'defender'
    rounds: BattleRound[]
    attackerSoldiersRemaining: number
    defenderSoldiersRemaining: number
    attackerTotalLosses: number
    defenderTotalLosses: number
    decisiveness: number // 0-1, how decisive the victory was
}

/**
 * Roll a single die (1-6)
 */
function rollDie(): number {
    return Math.floor(Math.random() * 6) + 1
}

/**
 * Roll multiple dice and sort descending
 */
function rollDice(count: number): number[] {
    const dice: number[] = []
    for (let i = 0; i < count; i++) {
        dice.push(rollDie())
    }
    return dice.sort((a, b) => b - a)
}

/**
 * Calculate loss multiplier based on army size
 * Larger armies = more casualties per round
 */
function getLossMultiplier(totalSoldiers: number): number {
    if (totalSoldiers < 100) return 1
    if (totalSoldiers < 1000) return Math.floor(totalSoldiers / 50)
    if (totalSoldiers < 10000) return Math.floor(totalSoldiers / 100)
    return Math.floor(totalSoldiers / 500)
}

/**
 * Simulate a single battle round with scaled casualties
 */
export function simulateBattleRound(
    attackerSoldiers: number,
    defenderSoldiers: number,
    intensityMultiplier: number = 1.0,
    defenseBonus: number = 0
): BattleRound {
    // Roll 3 dice for attacker
    const attackerDice = rollDice(3)

    // Defender gets 3 dice if they have defense bonus (fort), otherwise 2
    const defenderDiceCount = defenseBonus > 0 ? 3 : 2
    const defenderDice = rollDice(defenderDiceCount)

    // Calculate base losses
    let attackerBaseLosses = 0
    let defenderBaseLosses = 0

    // Compare dice (highest vs highest, second vs second)
    const comparisons = Math.min(attackerDice.length, defenderDice.length)

    for (let i = 0; i < comparisons; i++) {
        // Defender wins ties
        if (defenderDice[i] >= attackerDice[i]) {
            attackerBaseLosses++
        } else {
            defenderBaseLosses++
        }
    }

    // Scale losses based on army size
    const totalArmies = attackerSoldiers + defenderSoldiers
    const multiplier = getLossMultiplier(totalArmies)

    const attackerLosses = Math.min(attackerSoldiers, Math.ceil(attackerBaseLosses * multiplier * intensityMultiplier))
    // Reduce defender losses if they have bonus
    const defenderLossReduction = defenseBonus > 0 ? 0.7 : 1.0
    const defenderLosses = Math.min(defenderSoldiers, Math.ceil(defenderBaseLosses * multiplier * intensityMultiplier * defenderLossReduction))

    return {
        attackerDice,
        defenderDice,
        attackerLosses,
        defenderLosses,
    }
}

export type BattleIntensity = 'SKIRMISH' | 'BATTLE' | 'ALL_OUT_WAR'

/**
 * Simulate a full war until one side has no soldiers
 */
export function simulateWar(
    attackerSoldiers: number,
    defenderSoldiers: number,
    intensity: BattleIntensity = 'BATTLE',
    defenseBonus: number = 0
): WarResult {
    let currentAttackerSoldiers = attackerSoldiers
    let currentDefenderSoldiers = defenderSoldiers
    const rounds: BattleRound[] = []

    // Configure battle parameters based on intensity
    let maxRounds = 20
    let intensityMultiplier = 1.0

    switch (intensity) {
        case 'SKIRMISH':
            maxRounds = 25 // Increased from 10
            intensityMultiplier = 0.5 // Lower casualties
            break
        case 'BATTLE':
            maxRounds = 60 // Increased from 25
            intensityMultiplier = 1.0
            break
        case 'ALL_OUT_WAR':
            maxRounds = 120 // Increased from 50
            intensityMultiplier = 1.5 // Heavy casualties
            break
    }

    let roundCount = 0
    while (currentAttackerSoldiers > 0 && currentDefenderSoldiers > 0 && roundCount < maxRounds) {
        // Pass intensity multiplier to round simulation
        const round = simulateBattleRound(currentAttackerSoldiers, currentDefenderSoldiers, intensityMultiplier, defenseBonus)
        rounds.push(round)

        currentAttackerSoldiers = Math.max(0, currentAttackerSoldiers - round.attackerLosses)
        currentDefenderSoldiers = Math.max(0, currentDefenderSoldiers - round.defenderLosses)

        roundCount++
    }

    // If max rounds hit, determine winner by who has more soldiers remaining
    let winner: 'attacker' | 'defender'
    if (currentDefenderSoldiers <= 0) {
        winner = 'attacker'
    } else if (currentAttackerSoldiers <= 0) {
        winner = 'defender'
    } else {
        // Max rounds reached - winner is whoever has more soldiers
        winner = currentAttackerSoldiers > currentDefenderSoldiers ? 'attacker' : 'defender'
    }

    const attackerTotalLosses = attackerSoldiers - currentAttackerSoldiers
    const defenderTotalLosses = defenderSoldiers - currentDefenderSoldiers

    // Decisiveness: how one-sided was the victory (0-1)
    // 1 = total victory (enemy destroyed), 0 = barely won
    // Bonus decisiveness for Total War victories
    let decisiveness = winner === 'attacker'
        ? 1 - (currentDefenderSoldiers / defenderSoldiers)
        : 1 - (currentAttackerSoldiers / attackerSoldiers)

    if (intensity === 'ALL_OUT_WAR' && decisiveness > 0.5) {
        decisiveness = Math.min(1, decisiveness * 1.2) // 20% bonus to decisiveness for total war
    }

    return {
        winner,
        rounds,
        attackerSoldiersRemaining: currentAttackerSoldiers,
        defenderSoldiersRemaining: currentDefenderSoldiers,
        attackerTotalLosses,
        defenderTotalLosses,
        decisiveness: Math.min(1, Math.max(0, decisiveness)),
    }
}

/**
 * Quick war simulation
 */
export function quickWar(
    attackerSoldiers: number,
    defenderSoldiers: number
): {
    winner: 'attacker' | 'defender',
    attackerRemaining: number,
    defenderRemaining: number,
    decisiveness: number
} {
    const result = simulateWar(attackerSoldiers, defenderSoldiers)
    return {
        winner: result.winner,
        attackerRemaining: result.attackerSoldiersRemaining,
        defenderRemaining: result.defenderSoldiersRemaining,
        decisiveness: result.decisiveness,
    }
}
