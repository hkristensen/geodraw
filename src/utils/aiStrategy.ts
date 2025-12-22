/**
 * AI Strategy System
 * 
 * Provides strategic intelligence for AI nations including:
 * - Personality assignment (weighted by country data)
 * - Threat/Opportunity assessment
 * - Strategic focus selection
 * - Action queue generation
 */

import type {
    AIPersonality,
    StrategicFocus,
    AIStrategyState,
    ThreatAssessment,
    OpportunityAssessment,
    StrategicAction,
    AICountry,
    WarGoalType,
    WarGoal
} from '../types/game'
import { WAR_GOAL_LEGITIMACY } from '../types/game'

// =============================================================================
// PERSONALITY ASSIGNMENT
// =============================================================================

interface PersonalityWeight {
    type: AIPersonality
    weight: number
}

/**
 * Calculate personality weights based on country data
 * Higher weight = more likely to be assigned
 */
function calculatePersonalityWeights(country: AICountry): PersonalityWeight[] {
    const ps = country.politicalState
    const aggression = country.aggression || ps?.aggression || 3
    const military = ps?.military || 3
    const freedom = ps?.freedom || 3
    const tradePartners = country.tradePartners?.length || 0
    const orientation = ps?.orientation || 0

    const weights: PersonalityWeight[] = [
        {
            type: 'EXPANSIONIST',
            weight: (aggression >= 4 ? 30 : 0) + (military >= 4 ? 20 : 0) + (aggression * 5)
        },
        {
            type: 'DEFENSIVE',
            weight: (freedom >= 4 ? 25 : 0) + (aggression <= 2 ? 20 : 0) + (military >= 3 ? 10 : 0)
        },
        {
            type: 'TRADING_POWER',
            weight: (tradePartners >= 5 ? 30 : tradePartners * 5) + (freedom >= 3 ? 15 : 0) + (aggression <= 2 ? 10 : 0)
        },
        {
            type: 'IDEOLOGICAL',
            weight: (Math.abs(orientation) > 60 ? 30 : 0) + (aggression >= 3 ? 10 : 0)
        },
        {
            type: 'OPPORTUNIST',
            weight: (aggression === 3 ? 20 : 0) + (military >= 3 ? 15 : 0) + 10 // Base chance
        },
        {
            type: 'ISOLATIONIST',
            weight: (tradePartners <= 2 ? 20 : 0) + (military <= 2 ? 20 : 0) + (aggression <= 1 ? 15 : 0)
        }
    ]

    // Ensure at least some chance for each
    return weights.map(w => ({ ...w, weight: Math.max(5, w.weight) }))
}

/**
 * Assign a randomized personality weighted by country characteristics
 */
export function assignPersonality(country: AICountry): AIPersonality {
    const weights = calculatePersonalityWeights(country)
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)

    let random = Math.random() * totalWeight
    for (const pw of weights) {
        random -= pw.weight
        if (random <= 0) {
            return pw.type
        }
    }

    return 'OPPORTUNIST' // Fallback
}

// =============================================================================
// THREAT ASSESSMENT
// =============================================================================

/**
 * Assess threats facing a country
 */
export function assessThreats(
    country: AICountry,
    allCountries: Map<string, AICountry>,
    playerPower: number
): ThreatAssessment {
    let militaryThreats = 0
    let economicThreats = 0
    let internalThreats = 0

    // Military threats from hostile neighbors and player
    const enemies = country.enemies || []
    for (const enemyCode of enemies) {
        const enemy = allCountries.get(enemyCode)
        if (enemy && !enemy.isAnnexed) {
            const powerRatio = (enemy.power || 50) / Math.max(country.power || 50, 1)
            militaryThreats += Math.min(30, powerRatio * 20)
        }
    }

    // Threat from player (if hostile)
    if (country.relations < -30) {
        const playerRatio = playerPower / Math.max(country.power || 50, 1)
        militaryThreats += Math.min(40, playerRatio * 25)
    }

    // Currently at war = high threat
    if (country.isAtWar) {
        militaryThreats += 30
    }

    // Economic threats: sanctions, trade wars
    if (country.tariff === 'EMBARGO') {
        economicThreats += 30
    } else if (country.tariff === 'HIGH') {
        economicThreats += 15
    }

    // Low economy = vulnerability
    if (country.economy < 30) {
        economicThreats += 20
    }

    // Internal threats: unrest, low popularity
    const unrest = country.politicalState?.unrest || 3
    const popularity = country.politicalState?.leader_pop || 3

    internalThreats += (unrest - 3) * 15  // 3 is neutral
    internalThreats += (3 - popularity) * 10  // Low popularity = threat

    // Clamp values
    militaryThreats = Math.min(100, Math.max(0, militaryThreats))
    economicThreats = Math.min(100, Math.max(0, economicThreats))
    internalThreats = Math.min(100, Math.max(0, internalThreats))

    // Weighted average (military matters most)
    const totalThreat = Math.round(
        militaryThreats * 0.5 +
        economicThreats * 0.3 +
        internalThreats * 0.2
    )

    return {
        militaryThreats,
        economicThreats,
        internalThreats,
        totalThreat
    }
}

// =============================================================================
// OPPORTUNITY ASSESSMENT
// =============================================================================

/**
 * Identify opportunities for the AI
 */
export function assessOpportunities(
    country: AICountry,
    allCountries: Map<string, AICountry>,
    _playerPower: number
): OpportunityAssessment {
    const weakNeighbors: string[] = []
    const allianceGaps: string[] = []
    const tradeOpportunities: string[] = []

    const myPower = country.power || 50
    const myAllies = new Set(country.allies || [])
    const myTradePartners = new Set(country.tradePartners || [])
    const myEnemies = new Set(country.enemies || [])

    for (const [code, other] of allCountries) {
        if (code === country.code || other.isAnnexed) continue

        const theirPower = other.power || 50
        const isHostile = myEnemies.has(code)
        const isAlly = myAllies.has(code)
        const isTradePartner = myTradePartners.has(code)

        // Weak neighbors (can expand into)
        if (!isAlly && theirPower < myPower * 0.6 && country.aggression >= 3) {
            weakNeighbors.push(code)
        }

        // Alliance gaps (similar ideology, not yet allied)
        if (!isAlly && !isHostile && other.politicalState && country.politicalState) {
            const orientationDiff = Math.abs(
                other.politicalState.orientation - country.politicalState.orientation
            )
            if (orientationDiff < 40 && other.power > 30) {
                allianceGaps.push(code)
            }
        }

        // Trade opportunities
        if (!isTradePartner && !isHostile && other.economy > 40) {
            tradeOpportunities.push(code)
        }
    }

    // Determine best opportunity based on personality tendencies
    let bestOpportunity: 'EXPAND' | 'ALLY' | 'TRADE' | 'NONE' = 'NONE'

    if (weakNeighbors.length > 0 && country.aggression >= 4) {
        bestOpportunity = 'EXPAND'
    } else if (allianceGaps.length > 0) {
        bestOpportunity = 'ALLY'
    } else if (tradeOpportunities.length > 0) {
        bestOpportunity = 'TRADE'
    }

    return {
        weakNeighbors,
        allianceGaps,
        tradeOpportunities,
        bestOpportunity
    }
}

// =============================================================================
// STRATEGIC FOCUS SELECTION
// =============================================================================

/**
 * Determine what the AI should focus on this period
 */
export function selectStrategicFocus(
    personality: AIPersonality,
    threats: ThreatAssessment,
    opportunities: OpportunityAssessment,
    country: AICountry
): StrategicFocus {
    // High threat = defensive regardless of personality
    if (threats.totalThreat > 60) {
        return 'DEFEND'
    }

    // At war = defend or expand depending on personality
    if (country.isAtWar) {
        return personality === 'EXPANSIONIST' ? 'EXPAND' : 'DEFEND'
    }

    // Internal issues = consolidate
    if (threats.internalThreats > 40) {
        return 'CONSOLIDATE'
    }

    // Personality-based focus when stable
    switch (personality) {
        case 'EXPANSIONIST':
            if (opportunities.weakNeighbors.length > 0) return 'EXPAND'
            return 'DEVELOP'

        case 'DEFENSIVE':
            if (opportunities.allianceGaps.length > 0) return 'ALLY'
            return 'DEVELOP'

        case 'TRADING_POWER':
            if (opportunities.tradeOpportunities.length > 0) return 'ALLY' // Trade focus
            return 'DEVELOP'

        case 'IDEOLOGICAL':
            // Look for ideologically compatible allies
            if (opportunities.allianceGaps.length > 0) return 'ALLY'
            return 'DEVELOP'

        case 'OPPORTUNIST':
            // Take best opportunity
            if (opportunities.bestOpportunity === 'EXPAND') return 'EXPAND'
            if (opportunities.bestOpportunity === 'ALLY') return 'ALLY'
            return 'DEVELOP'

        case 'ISOLATIONIST':
            return 'DEVELOP'

        default:
            return 'DEVELOP'
    }
}

// =============================================================================
// ACTION GENERATION
// =============================================================================

/**
 * Generate prioritized actions based on focus and personality
 */
export function generateActionQueue(
    focus: StrategicFocus,
    _personality: AIPersonality,
    _threats: ThreatAssessment,
    opportunities: OpportunityAssessment,
    _country: AICountry
): StrategicAction[] {
    const actions: StrategicAction[] = []

    switch (focus) {
        case 'EXPAND':
            // Target weakest neighbor
            if (opportunities.weakNeighbors.length > 0) {
                actions.push({
                    type: 'DEMAND_TERRITORY',
                    targetCode: opportunities.weakNeighbors[0],
                    priority: 8,
                    reasoning: 'Weak neighbor identified for expansion'
                })

                // Backup: improve military
                actions.push({
                    type: 'BUILD_MILITARY',
                    priority: 6,
                    reasoning: 'Prepare for potential conflict'
                })
            }
            break

        case 'DEFEND':
            // Seek allies
            if (opportunities.allianceGaps.length > 0) {
                actions.push({
                    type: 'PROPOSE_ALLIANCE',
                    targetCode: opportunities.allianceGaps[0],
                    priority: 9,
                    reasoning: 'Need defensive allies against threats'
                })
            }

            // Build military
            actions.push({
                type: 'BUILD_MILITARY',
                priority: 8,
                reasoning: 'Strengthen defenses against threats'
            })
            break

        case 'ALLY':
            // Propose alliances
            for (const code of opportunities.allianceGaps.slice(0, 2)) {
                actions.push({
                    type: 'PROPOSE_ALLIANCE',
                    targetCode: code,
                    priority: 7,
                    reasoning: 'Building alliance network'
                })
            }

            // Or trade agreements
            for (const code of opportunities.tradeOpportunities.slice(0, 2)) {
                actions.push({
                    type: 'TRADE_AGREEMENT',
                    targetCode: code,
                    priority: 6,
                    reasoning: 'Expanding economic partnerships'
                })
            }
            break

        case 'DEVELOP':
            actions.push({
                type: 'ECONOMIC_FOCUS',
                priority: 6,
                reasoning: 'Focus on internal development'
            })
            break

        case 'CONSOLIDATE':
            actions.push({
                type: 'ECONOMIC_FOCUS',
                priority: 7,
                reasoning: 'Stabilizing internal situation'
            })
            break
    }

    // Sort by priority
    return actions.sort((a, b) => b.priority - a.priority).slice(0, 5)
}

// =============================================================================
// MAIN STRATEGY FUNCTION
// =============================================================================

/**
 * Full strategy assessment for an AI country
 * Called monthly to update AI decision-making
 */
export function assessStrategy(
    country: AICountry,
    allCountries: Map<string, AICountry>,
    playerPower: number,
    gameDate: number
): AIStrategyState {
    // Get or assign personality
    const personality = country.strategyState?.personality || assignPersonality(country)

    // Assess current situation
    const threatLevel = assessThreats(country, allCountries, playerPower)
    const opportunities = assessOpportunities(country, allCountries, playerPower)

    // Determine focus
    const currentFocus = selectStrategicFocus(personality, threatLevel, opportunities, country)

    // Generate action queue
    const actionQueue = generateActionQueue(
        currentFocus,
        personality,
        threatLevel,
        opportunities,
        country
    )

    return {
        personality,
        currentFocus,
        threatLevel,
        opportunities,
        actionQueue,
        lastAssessment: gameDate
    }
}

// =============================================================================
// WAR GOAL HELPERS
// =============================================================================

/**
 * Create a war goal with proper legitimacy
 */
export function createWarGoal(
    type: WarGoalType,
    targetCountry: string,
    targetTerritory?: string
): WarGoal {
    const legitimacy = WAR_GOAL_LEGITIMACY[type]

    const descriptions: Record<WarGoalType, string> = {
        'DEFENSIVE': `Defend against ${targetCountry}'s aggression`,
        'TERRITORIAL': `Claim ${targetTerritory || 'disputed territory'} from ${targetCountry}`,
        'RECONQUEST': `Retake lost territories from ${targetCountry}`,
        'REGIME_CHANGE': `Overthrow the government of ${targetCountry}`,
        'HUMILIATION': `Force ${targetCountry} to accept terms`,
        'LIBERATION': `Free territories occupied by ${targetCountry}`,
        'AGGRESSION': `War of aggression against ${targetCountry}`
    }

    return {
        type,
        targetCountry,
        targetTerritory,
        legitimacy,
        description: descriptions[type]
    }
}

/**
 * Get the international reaction to a war goal
 */
export function getWarGoalReaction(warGoal: WarGoal): {
    coalitionPenalty: number
    relationsPenalty: number
    description: string
} {
    if (warGoal.legitimacy >= 10) {
        return {
            coalitionPenalty: 0,
            relationsPenalty: 0,
            description: 'The international community views this as justified.'
        }
    } else if (warGoal.legitimacy >= 0) {
        return {
            coalitionPenalty: 0,
            relationsPenalty: -5,
            description: 'Some nations question the necessity of this war.'
        }
    } else if (warGoal.legitimacy >= -30) {
        return {
            coalitionPenalty: -10,
            relationsPenalty: -15,
            description: 'This war is seen as aggressive by many nations.'
        }
    } else {
        return {
            coalitionPenalty: -25,
            relationsPenalty: -30,
            description: 'This unprovoked aggression is condemned internationally.'
        }
    }
}
