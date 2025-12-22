/**
 * Soft Power System
 * 
 * Handles non-military influence mechanics:
 * - Influence point generation and spending
 * - Cultural exchange, propaganda, espionage
 * - World opinion tracking
 * - Covert action detection
 */

import type {
    InfluenceAction,
    InfluenceActionType,
    SoftPowerState
} from '../types/diplomaticTypes'
import { INFLUENCE_ACTION_DEFS } from '../types/diplomaticTypes'
import type { AICountry, NationStats, CountryModifier } from '../types/game'

// =============================================================================
// INFLUENCE GENERATION
// =============================================================================

/**
 * Calculate monthly influence point income based on nation stats
 */
export function calculateInfluenceIncome(stats: NationStats, modifiers: CountryModifier[]): number {
    let income = 0

    // Base income from economy (rich nations have more soft power)
    income += Math.floor(stats.gdpPerCapita / 2000) // ~5-25 from GDP

    // Bonus from stability (stable governments project power)
    const stabilityModifier = modifiers.find(m => m.type === 'STABILITY')
    if (stabilityModifier) {
        income += Math.floor(stabilityModifier.intensity * 2)
    }

    // Bonus from cultural boom
    const culturalModifier = modifiers.find(m => m.type === 'CULTURAL_BOOM')
    if (culturalModifier) {
        income += Math.floor(culturalModifier.intensity * 5)
    }

    // Penalty from unrest
    const unrestModifier = modifiers.find(m => m.type === 'UNREST')
    if (unrestModifier) {
        income -= Math.floor(unrestModifier.intensity * 3)
    }

    // Penalty from being a pariah
    const pariahModifier = modifiers.find(m => m.type === 'WORLD_PARIAH')
    if (pariahModifier) {
        income = Math.floor(income * 0.5)
    }

    // Minimum 1 influence per month
    return Math.max(1, income)
}

/**
 * Calculate world opinion for a nation
 * Based on actions taken and international standing
 */
export function calculateWorldOpinion(
    baseOpinion: number,
    modifiers: CountryModifier[],
    recentActions: { type: string, delta: number }[]
): number {
    let opinion = baseOpinion

    // Modifier-based adjustments
    for (const mod of modifiers) {
        switch (mod.type) {
            case 'WORLD_PARIAH':
                opinion -= 30
                break
            case 'UN_SANCTIONED':
                opinion -= 20
                break
            case 'CULTURAL_BOOM':
                opinion += 10
                break
            case 'REVANCHISM':
                opinion -= 5
                break
        }
    }

    // Recent action adjustments
    for (const action of recentActions.slice(-10)) {
        opinion += action.delta
    }

    // Clamp to -100 to 100
    return Math.max(-100, Math.min(100, opinion))
}

// =============================================================================
// INFLUENCE ACTIONS
// =============================================================================

/**
 * Create a new influence action
 */
export function createInfluenceAction(
    type: InfluenceActionType,
    targetCountry: string,
    gameDate: number
): InfluenceAction {
    const def = INFLUENCE_ACTION_DEFS[type]

    return {
        id: `influence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        targetCountry,
        startedAt: gameDate,
        duration: def.duration,
        influenceCost: def.influenceCost,
        budgetCost: def.budgetCost,
        isCovert: def.isCovert,
        detected: false
    }
}

/**
 * Check if a covert action is detected
 */
export function checkCovertDetection(
    action: InfluenceAction,
    targetCountry: AICountry
): boolean {
    if (!action.isCovert) return false

    // Base detection chance: 20%
    let detectionChance = 0.20

    // Higher freedom = better intelligence = higher detection
    const freedom = targetCountry.politicalState?.freedom || 3
    detectionChance += (freedom - 3) * 0.05 // ±15%

    // Authoritarian countries have secret police
    if (targetCountry.authority > 60) {
        detectionChance += 0.15
    }

    // Allied intelligence sharing (if they have allies)
    detectionChance += Math.min(0.15, targetCountry.allies.length * 0.03)

    return Math.random() < detectionChance
}

/**
 * Apply the effects of an influence action
 */
export function applyInfluenceActionEffect(
    action: InfluenceAction,
    targetCountry: AICountry,
    _gameDate: number
): {
    relationChange: number
    stabilityChange: number
    worldOpinionChange: number
    detected: boolean
    message: string
} {
    let relationChange = 0
    let stabilityChange = 0
    let worldOpinionChange = 0
    let message = ''

    const detected = checkCovertDetection(action, targetCountry)

    switch (action.type) {
        case 'CULTURAL_EXCHANGE':
            relationChange = 2 // Per month
            message = `Cultural exchange with ${targetCountry.name} is improving relations.`
            break

        case 'ECONOMIC_AID':
            relationChange = 25
            worldOpinionChange = 5 // Seen as generous
            message = `Your economic aid to ${targetCountry.name} has been warmly received.`
            break

        case 'FUND_OPPOSITION':
            if (detected) {
                relationChange = -50
                worldOpinionChange = -10 // Caught meddling
                message = `Your covert support of opposition in ${targetCountry.name} has been exposed!`
            } else {
                stabilityChange = -1
                message = `Opposition groups in ${targetCountry.name} are gaining strength.`
            }
            break

        case 'PROPAGANDA_CAMPAIGN':
            if (detected) {
                relationChange = -30
                message = `${targetCountry.name} has traced propaganda to your government.`
            } else {
                // Target loses world opinion
                worldOpinionChange = -15 // This applies to TARGET
                message = `International media is portraying ${targetCountry.name} negatively.`
            }
            break

        case 'ESPIONAGE':
            if (detected) {
                relationChange = -40
                worldOpinionChange = -5
                message = `Your spies in ${targetCountry.name} have been caught!`
            } else {
                // Success: reveal intel or sabotage
                const sabotaged = Math.random() < 0.3
                if (sabotaged) {
                    message = `Espionage success: sabotaged military facilities in ${targetCountry.name}.`
                } else {
                    message = `Espionage success: gathered intelligence on ${targetCountry.name}.`
                }
            }
            break

        case 'HOST_EVENT':
            worldOpinionChange = 20
            relationChange = 10 // Global goodwill
            message = `Your international event was a great success! World opinion improved.`
            break
    }

    return {
        relationChange,
        stabilityChange,
        worldOpinionChange,
        detected,
        message
    }
}

// =============================================================================
// AI INFLUENCE DECISIONS
// =============================================================================

/**
 * Determine if an AI country should use an influence action
 */
export function shouldAIUseInfluence(
    country: AICountry,
    influencePoints: number,
    potentialTargets: AICountry[]
): { action: InfluenceActionType, target: string } | null {
    // Need minimum influence to act
    if (influencePoints < 20) return null

    const personality = country.strategyState?.personality
    const aggression = country.aggression || 3
    const freedom = country.politicalState?.freedom || 3

    // Find a suitable target
    let targetCode: string | null = null
    let actionType: InfluenceActionType | null = null

    // Hostile target for covert action
    const hostileTargets = potentialTargets.filter(t =>
        country.enemies.includes(t.code) && !t.isAnnexed
    )

    // Neutral targets for soft power
    const neutralTargets = potentialTargets.filter(t =>
        !country.enemies.includes(t.code) &&
        !country.allies.includes(t.code) &&
        !t.isAnnexed
    )

    // Decision based on personality
    switch (personality) {
        case 'EXPANSIONIST':
        case 'OPPORTUNIST':
            // Prefer destabilization
            if (hostileTargets.length > 0 && aggression >= 3) {
                targetCode = hostileTargets[0].code
                actionType = freedom <= 2 ? 'FUND_OPPOSITION' : 'PROPAGANDA_CAMPAIGN'
            }
            break

        case 'TRADING_POWER':
            // Prefer economic influence
            if (neutralTargets.length > 0 && influencePoints >= 20) {
                targetCode = neutralTargets[0].code
                actionType = 'ECONOMIC_AID'
            }
            break

        case 'DEFENSIVE':
        case 'IDEOLOGICAL':
            // Prefer cultural ties
            if (neutralTargets.length > 0) {
                targetCode = neutralTargets[0].code
                actionType = 'CULTURAL_EXCHANGE'
            }
            break

        case 'ISOLATIONIST':
            // Rarely uses influence
            return null
    }

    if (targetCode && actionType) {
        return { action: actionType, target: targetCode }
    }

    return null
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Initialize soft power state for player
 */
export function initSoftPowerState(): SoftPowerState {
    return {
        influencePoints: 50, // Starting amount
        worldOpinion: 0,     // Neutral
        monthlyInfluenceIncome: 10,
        activeActions: [],
        hostedEvents: []
    }
}

/**
 * Process monthly influence updates
 */
export function processMonthlyInfluence(
    state: SoftPowerState,
    stats: NationStats,
    modifiers: CountryModifier[]
): SoftPowerState {
    const income = calculateInfluenceIncome(stats, modifiers)

    // Remove expired actions
    const activeActions = state.activeActions.filter(a =>
        a.duration > 0
    ).map(a => ({
        ...a,
        duration: a.duration - 1
    }))

    return {
        ...state,
        influencePoints: state.influencePoints + income,
        monthlyInfluenceIncome: income,
        activeActions
    }
}

/**
 * Check if player can afford an influence action
 */
export function canAffordInfluenceAction(
    state: SoftPowerState,
    budget: number,
    actionType: InfluenceActionType
): { canAfford: boolean, reason?: string } {
    const def = INFLUENCE_ACTION_DEFS[actionType]

    if (state.influencePoints < def.influenceCost) {
        return {
            canAfford: false,
            reason: `Need ${def.influenceCost} influence (have ${state.influencePoints})`
        }
    }

    if (budget < def.budgetCost) {
        return {
            canAfford: false,
            reason: `Need $${(def.budgetCost / 1_000_000).toFixed(0)}M budget`
        }
    }

    return { canAfford: true }
}
