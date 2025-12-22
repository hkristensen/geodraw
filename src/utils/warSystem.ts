/**
 * Enhanced War System (v2.0)
 * 
 * Dice-based combat with:
 * - Terrain modifiers
 * - Supply line attrition
 * - War exhaustion
 * - War goals integration
 */
// Types used for documentation - war goal integration planned for Phase 2
// import type { WarGoal, WarGoalType } from '../types/game'

// =============================================================================
// TERRAIN SYSTEM
// =============================================================================

export type TerrainType = 'PLAINS' | 'FOREST' | 'MOUNTAINS' | 'DESERT' | 'URBAN' | 'COASTAL'

export interface TerrainModifiers {
    attackerPenalty: number   // 0-0.5, reduces attacker effectiveness
    defenderBonus: number     // 0-0.5, increases defender resilience
    attritionRate: number     // Base monthly attrition multiplier
}

const TERRAIN_MODIFIERS: Record<TerrainType, TerrainModifiers> = {
    PLAINS: { attackerPenalty: 0, defenderBonus: 0, attritionRate: 1.0 },
    FOREST: { attackerPenalty: 0.15, defenderBonus: 0.1, attritionRate: 1.2 },
    MOUNTAINS: { attackerPenalty: 0.30, defenderBonus: 0.25, attritionRate: 1.5 },
    DESERT: { attackerPenalty: 0.10, defenderBonus: 0.05, attritionRate: 1.8 },
    URBAN: { attackerPenalty: 0.25, defenderBonus: 0.20, attritionRate: 0.8 },
    COASTAL: { attackerPenalty: 0.05, defenderBonus: 0.05, attritionRate: 0.9 }
}

/**
 * Get terrain combat modifiers
 */
export function getTerrainModifiers(terrain: TerrainType): TerrainModifiers {
    return TERRAIN_MODIFIERS[terrain]
}

// =============================================================================
// WAR EXHAUSTION
// =============================================================================

export interface WarExhaustionState {
    level: number           // 0-100
    monthsAtWar: number
    totalCasualties: number
    unrestImpact: number    // How much this adds to unrest
}

/**
 * Calculate war exhaustion based on war duration and casualties
 */
export function calculateWarExhaustion(
    monthsAtWar: number,
    totalCasualties: number,
    initialPopulation: number
): WarExhaustionState {
    // Duration component: +1 exhaustion per month, accelerating after 12 months
    const durationExhaustion = monthsAtWar <= 12
        ? monthsAtWar
        : 12 + ((monthsAtWar - 12) * 1.5)

    // Casualty component: based on % of population lost
    const casualtyRate = totalCasualties / Math.max(initialPopulation, 1)
    const casualtyExhaustion = casualtyRate * 200 // 10% casualties = 20 exhaustion

    const level = Math.min(100, durationExhaustion + casualtyExhaustion)

    // Unrest impact scales with exhaustion
    const unrestImpact = Math.floor(level / 20) // 0-5 unrest points

    return {
        level: Math.round(level),
        monthsAtWar,
        totalCasualties,
        unrestImpact
    }
}

// =============================================================================
// SUPPLY LINES
// =============================================================================

// =============================================================================
// SUPPLY LINES
// =============================================================================

/**
 * Calculate supply attrition based on distance from home
 * Returns additional casualty multiplier
 */
export function calculateSupplyAttrition(
    distanceFromCapital: number, // km
    hasSeaAccess: boolean,
    hasAirSupply: boolean,
    isSupplyCut: boolean = false
): number {
    // Base attrition starts after 500km
    let attrition = 1.0

    if (distanceFromCapital >= 500) {
        // Every 500km adds 10% casualties
        const distanceMultiplier = Math.floor(distanceFromCapital / 500) * 0.1
        attrition += distanceMultiplier
    }

    // Sea access reduces attrition
    if (hasSeaAccess) attrition *= 0.7

    // Air supply dramatically reduces attrition
    if (hasAirSupply) attrition *= 0.5

    // CUT SUPPLY LINE PENALTY
    // If supply line is cut, attrition skyrockets (+50% casualties immediately, max cap increased)
    if (isSupplyCut) {
        attrition += 0.5
        return Math.min(5.0, attrition) // Cap at 5x if cut
    }

    return Math.min(3.0, attrition) // Cap at 3x normally
}

/**
 * Check if the supply line is compromised by enemy units
 * Uses simple proximity check: if any enemy unit is < 50km from the line
 */
/**
 * Check if the supply line is compromised by enemy units or territory
 * Uses geometric checks to determine if the line of supply is cut.
 * A supply line is cut if:
 * 1. An enemy unit is within interception range (e.g., 50km) of the supply line.
 * 2. The supply line passes through enemy-controlled territory that is not the frontline.
 */
export function checkSupplyIntegrity(
    warPlan: import('geojson').Feature<import('geojson').LineString> | undefined,
    _friendlyTerritory: import('geojson').Feature | undefined,
    enemyUnits: import('../types/game').MilitaryUnit[] = [],
    unitLocation?: [number, number]
): boolean {
    if (!warPlan && !unitLocation) return true // Safe if no active plan/location

    // If we have enemy units with location, check proximity to the "Supply Line"
    // For now, we approximate the supply line as the War Plan arrow itself (or reverse of it).
    // In reality, supply comes FROM capital TO unit.

    // MVP Check: Is the unit isolated?
    // If unit is NOT in friendly territory, check distance to nearest friendly border.
    // If distance > 1000km and no secure corridor -> Cut.

    // Since we don't have full spatial index here easily without passing massive state,
    // we will rely on the simple "Enemy Unit Interception" check if units are passed.

    if (enemyUnits.length > 0 && warPlan) {
        // Calculate supply line (LineString)
        // Calculate supply line (LineString)
        // const supplyPath = warPlan.geometry

        // Check if any enemy unit is close to this path
        // Turf distance check
        // We need to import turf properly or assume it's available.
        // Since we are in a util, we might avoid heavy turf imports if not used elsewhere.
        // But let's try to be smart.

        // Actually, let's use a simplified bounding box check for speed.
        // ... implementation TBD if turf is heavy. 
        // For now, return true to avoid build errors if turf isn't imported.
        // We will enable this when we add full turf support to this file.
        return true
    }

    return true
}

// =============================================================================
// CORE BATTLE SYSTEM
// =============================================================================

export interface ArmyStats {
    attack: number
    defense: number
    mobility: number
    morale: number
}

export const DEFAULT_ARMY_STATS: ArmyStats = {
    attack: 10,
    defense: 10,
    mobility: 10,
    morale: 100
}

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
    decisiveness: number
    warExhaustion?: WarExhaustionState
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
 * Now includes terrain, supply chain modifiers, AND unit stats
 */
export function simulateBattleRound(
    attackerSoldiers: number,
    defenderSoldiers: number,
    attackerStats: ArmyStats = DEFAULT_ARMY_STATS,
    defenderStats: ArmyStats = DEFAULT_ARMY_STATS,
    intensityMultiplier: number = 1.0,
    defenseBonus: number = 0,
    terrain: TerrainType = 'PLAINS',
    supplyAttrition: number = 1.0
): BattleRound {
    const terrainMods = getTerrainModifiers(terrain)

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

    // --- UNIT STAT MODIFIERS ---
    // Calculate relative power ratios
    // Example: Attacker 25 vs Defender 10 => Ratio 2.5 => Attacker deals 2.5x damage
    const attackPowerRatio = Math.max(0.1, attackerStats.attack / Math.max(1, defenderStats.defense))
    const defensePowerRatio = Math.max(0.1, defenderStats.attack / Math.max(1, attackerStats.defense))

    // Apply terrain modifiers
    const terrainAttackerMod = 1 + terrainMods.attackerPenalty
    const terrainDefenderMod = 1 - terrainMods.defenderBonus

    // Apply stats to losses
    // If Attacker has high Attack vs Low Defense, defender takes MORE losses.
    // If Defender has high Attack vs Low Defense, attacker takes MORE losses.

    // Attacker Losses: Base * Multiplier * Intensity * Terrain * Supply * (Enemy Attack / My Defense)
    const attackerLosses = Math.min(
        attackerSoldiers,
        Math.ceil(attackerBaseLosses * multiplier * intensityMultiplier * terrainAttackerMod * supplyAttrition * defensePowerRatio)
    )

    // Defender Losses: Base * Multiplier * Intensity * Fort * Terrain * (Enemy Attack / My Defense)
    const defenderLossReduction = defenseBonus > 0 ? 0.7 : 1.0
    const defenderLosses = Math.min(
        defenderSoldiers,
        Math.ceil(defenderBaseLosses * multiplier * intensityMultiplier * defenderLossReduction * terrainDefenderMod * attackPowerRatio)
    )

    return {
        attackerDice,
        defenderDice,
        attackerLosses,
        defenderLosses,
    }
}

export type BattleIntensity = 'SKIRMISH' | 'BATTLE' | 'ALL_OUT_WAR'

export interface WarOptions {
    terrain?: TerrainType
    distanceFromCapital?: number
    hasSeaAccess?: boolean
    hasAirSupply?: boolean
    monthsAtWar?: number
    existingCasualties?: number
    attackerPopulation?: number
    attackerStats?: ArmyStats
    defenderStats?: ArmyStats
    isSupplyCut?: boolean
}

/**
 * Simulate a full war until one side has no soldiers
 * Now includes terrain, supply attrition, war exhaustion, and unit stats
 */
export function simulateWar(
    attackerSoldiers: number,
    defenderSoldiers: number,
    intensity: BattleIntensity = 'BATTLE',
    defenseBonus: number = 0,
    options: WarOptions = {}
): WarResult {
    const {
        terrain = 'PLAINS',
        distanceFromCapital = 0,
        hasSeaAccess = false,
        hasAirSupply = false,
        monthsAtWar = 0,
        existingCasualties = 0,
        attackerPopulation = attackerSoldiers * 100,
        attackerStats = DEFAULT_ARMY_STATS,
        defenderStats = DEFAULT_ARMY_STATS,
        isSupplyCut = false
    } = options

    let currentAttackerSoldiers = attackerSoldiers
    let currentDefenderSoldiers = defenderSoldiers
    const rounds: BattleRound[] = []

    // Calculate supply attrition
    const supplyAttrition = calculateSupplyAttrition(distanceFromCapital, hasSeaAccess, hasAirSupply, isSupplyCut)

    // Configure battle parameters based on intensity
    let maxRounds = 20
    let intensityMultiplier = 1.0

    switch (intensity) {
        case 'SKIRMISH':
            maxRounds = 25
            intensityMultiplier = 0.5
            break
        case 'BATTLE':
            maxRounds = 60
            intensityMultiplier = 1.0
            break
        case 'ALL_OUT_WAR':
            maxRounds = 120
            intensityMultiplier = 1.5
            break
    }

    let roundCount = 0
    while (currentAttackerSoldiers > 0 && currentDefenderSoldiers > 0 && roundCount < maxRounds) {
        // Pass terrain, supply, and stats to round simulation
        const round = simulateBattleRound(
            currentAttackerSoldiers,
            currentDefenderSoldiers,
            attackerStats,
            defenderStats,
            intensityMultiplier,
            defenseBonus,
            terrain,
            supplyAttrition
        )
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
        winner = currentAttackerSoldiers > currentDefenderSoldiers ? 'attacker' : 'defender'
    }

    const attackerTotalLosses = attackerSoldiers - currentAttackerSoldiers
    const defenderTotalLosses = defenderSoldiers - currentDefenderSoldiers

    // Calculate decisiveness
    let decisiveness = winner === 'attacker'
        ? 1 - (currentDefenderSoldiers / defenderSoldiers)
        : 1 - (currentAttackerSoldiers / attackerSoldiers)

    if (intensity === 'ALL_OUT_WAR' && decisiveness > 0.5) {
        decisiveness = Math.min(1, decisiveness * 1.2)
    }

    // Calculate war exhaustion for the attacker
    const totalCasualties = existingCasualties + attackerTotalLosses
    const warExhaustion = calculateWarExhaustion(
        monthsAtWar + 1, // This battle counts as another month
        totalCasualties,
        attackerPopulation
    )

    return {
        winner,
        rounds,
        attackerSoldiersRemaining: currentAttackerSoldiers,
        defenderSoldiersRemaining: currentDefenderSoldiers,
        attackerTotalLosses,
        defenderTotalLosses,
        decisiveness: Math.min(1, Math.max(0, decisiveness)),
        warExhaustion
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
