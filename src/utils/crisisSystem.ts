/**
 * Crisis System
 * 
 * Handles international crises with multi-phase escalation:
 * - Crisis creation from triggers
 * - 5-phase escalation ladder
 * - Action processing (back down, escalate, mediate)
 * - AI crisis behavior based on personality
 */

import type {
    DiplomaticCrisis,
    CrisisType,
    CrisisPhase,
    CrisisAction,
    CrisisOutcome
} from '../types/diplomaticTypes'
import { CRISIS_TEMPLATES } from '../types/diplomaticTypes'
import type { AICountry } from '../types/game'

// =============================================================================
// CRISIS CREATION
// =============================================================================

/**
 * Create a new diplomatic crisis
 */
export function createCrisis(
    type: CrisisType,
    initiator: string,
    target: string,
    gameDate: number,
    territoryAtStake?: string
): DiplomaticCrisis {
    const template = CRISIS_TEMPLATES[type]

    const title = template.titleTemplate
        .replace('{initiator}', initiator)
        .replace('{target}', target)
        .replace('{territory}', territoryAtStake || 'disputed region')

    const description = template.descriptionTemplate
        .replace(/{initiator}/g, initiator)
        .replace(/{target}/g, target)

    // Phase 1 deadline: 30 days
    const phaseDeadline = gameDate + (30 * 24 * 60 * 60 * 1000)

    return {
        id: `crisis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        description,
        participants: [initiator, target],
        initiator,
        phase: 1,
        startedAt: gameDate,
        lastActionAt: gameDate,
        phaseDeadline,
        playerIsParticipant: initiator === 'PLAYER' || target === 'PLAYER',
        escalationHistory: [],
        warRisk: template.baseWarRisk,
        territoryAtStake,
        demandsMade: [],
        concessionsMade: []
    }
}

/**
 * Check if game state should trigger a crisis
 */
export function checkCrisisTriggers(
    aiCountries: Map<string, AICountry>,
    playerCountryCode: string | null,
    existingCrises: DiplomaticCrisis[],
    gameDate: number
): DiplomaticCrisis | null {
    // Don't create too many simultaneous crises
    const activeCrises = existingCrises.filter(c => c.phase < 5)
    if (activeCrises.length >= 3) return null

    // Check for potential crisis triggers
    for (const [code, country] of aiCountries) {
        if (country.isAnnexed) continue

        // Already in a crisis with this country?
        const inCrisis = activeCrises.some(c => c.participants.includes(code))
        if (inCrisis) continue

        // Border incident: hostile countries with high aggression
        if (country.aggression >= 4 && country.relations < -30) {
            if (Math.random() < 0.02) { // 2% chance per month
                const target = playerCountryCode || getRandomEnemy(country, aiCountries)
                if (target) {
                    return createCrisis('BORDER_INCIDENT', code, target, gameDate)
                }
            }
        }

        // Territorial dispute: revanchist countries
        if (country.modifiers.includes('REVANCHISM') && country.territoryLost > 10) {
            if (Math.random() < 0.03) { // 3% chance
                const target = playerCountryCode || getRandomEnemy(country, aiCountries)
                if (target) {
                    return createCrisis('TERRITORIAL_DISPUTE', code, target, gameDate)
                }
            }
        }

        // Trade war: economic rivals
        if (country.theirTariff === 'EMBARGO' && !country.isAtWar) {
            if (Math.random() < 0.05) { // 5% chance
                const target = playerCountryCode || getRandomEnemy(country, aiCountries)
                if (target) {
                    return createCrisis('TRADE_WAR', code, target, gameDate)
                }
            }
        }
    }

    return null
}

function getRandomEnemy(country: AICountry, aiCountries: Map<string, AICountry>): string | null {
    const enemies = country.enemies.filter(e => {
        const enemy = aiCountries.get(e)
        return enemy && !enemy.isAnnexed
    })

    if (enemies.length === 0) return null
    return enemies[Math.floor(Math.random() * enemies.length)]
}

// =============================================================================
// PHASE MANAGEMENT
// =============================================================================

const PHASE_DEADLINES = {
    1: 30, // Incident: 30 days
    2: 20, // Demands: 20 days
    3: 14, // Ultimatum: 14 days
    4: 7,  // Mobilization: 7 days
    5: 0   // War (no deadline, it's over)
}

const PHASE_NAMES = {
    1: 'Incident',
    2: 'Demands',
    3: 'Ultimatum',
    4: 'Mobilization',
    5: 'War'
}

/**
 * Get available actions for a crisis participant
 */
export function getAvailableActions(
    crisis: DiplomaticCrisis,
    _countryCode: string
): CrisisAction[] {
    const actions: CrisisAction[] = []

    // Always available
    actions.push('HOLD_FIRM')

    // Phase-specific options
    switch (crisis.phase) {
        case 1: // Incident
            actions.push('BACK_DOWN', 'SEEK_MEDIATION', 'ESCALATE')
            break

        case 2: // Demands
            actions.push('BACK_DOWN', 'SEEK_MEDIATION', 'ESCALATE', 'PROPOSE_SUMMIT')
            break

        case 3: // Ultimatum
            actions.push('BACK_DOWN', 'ESCALATE', 'PROPOSE_SUMMIT')
            break

        case 4: // Mobilization
            actions.push('BACK_DOWN', 'DECLARE_WAR', 'MOBILIZE')
            break

        case 5: // Already war
            // No actions, crisis has ended
            break
    }

    return actions
}

/**
 * Process a crisis action
 */
export function processCrisisAction(
    crisis: DiplomaticCrisis,
    actionBy: string,
    action: CrisisAction,
    gameDate: number
): {
    updatedCrisis: DiplomaticCrisis
    outcome?: CrisisOutcome
    message: string
} {
    const template = CRISIS_TEMPLATES[crisis.type]
    let newPhase = crisis.phase
    let newWarRisk = crisis.warRisk
    let message = ''
    let outcome: CrisisOutcome | undefined

    // Record action
    const newHistory = [...crisis.escalationHistory, {
        phase: crisis.phase,
        action,
        by: actionBy,
        at: gameDate
    }]

    switch (action) {
        case 'BACK_DOWN':
            // Crisis ends peacefully, actor loses face
            outcome = {
                type: 'PEACEFUL',
                winner: crisis.participants.find(p => p !== actionBy),
                loser: actionBy,
                concessions: [{
                    from: actionBy,
                    to: crisis.participants.find(p => p !== actionBy) || '',
                    what: 'Diplomatic concession'
                }],
                relationChanges: [
                    { country: actionBy, delta: -10 } // Lose reputation
                ],
                worldOpinionChanges: [
                    { country: actionBy, delta: -5 }
                ]
            }
            message = `${actionBy} has backed down in the ${crisis.title}.`
            break

        case 'HOLD_FIRM':
            // Slight escalation, no immediate change
            newWarRisk = Math.min(100, crisis.warRisk + 5)
            message = `${actionBy} is holding firm in the ${crisis.title}.`
            break

        case 'ESCALATE':
            // Move to next phase
            newPhase = Math.min(5, crisis.phase + 1) as CrisisPhase
            newWarRisk = Math.min(100, crisis.warRisk + template.escalationRate)
            message = `${actionBy} has escalated the ${crisis.title} to ${PHASE_NAMES[newPhase]}.`

            if (newPhase === 5) {
                outcome = {
                    type: 'WAR',
                    concessions: [],
                    relationChanges: [],
                    worldOpinionChanges: []
                }
                message = `The ${crisis.title} has escalated to WAR!`
            }
            break

        case 'SEEK_MEDIATION':
            // Potential de-escalation
            newWarRisk = Math.max(0, crisis.warRisk - 10)
            if (Math.random() < 0.5) {
                // Mediation successful
                newPhase = Math.max(1, crisis.phase - 1) as CrisisPhase
                message = `UN mediation has de-escalated the ${crisis.title}.`
            } else {
                message = `Mediation attempt in the ${crisis.title} has failed.`
            }
            break

        case 'PROPOSE_SUMMIT':
            // High chance of resolution
            if (Math.random() < 0.6) {
                outcome = {
                    type: 'PEACEFUL',
                    concessions: [],
                    relationChanges: [
                        { country: crisis.participants[0], delta: 5 },
                        { country: crisis.participants[1], delta: 5 }
                    ],
                    worldOpinionChanges: []
                }
                message = `Summit diplomacy has resolved the ${crisis.title}.`
            } else {
                message = `Summit proposal rejected in the ${crisis.title}.`
            }
            break

        case 'MOBILIZE':
            newPhase = 4 as CrisisPhase
            newWarRisk = Math.min(100, crisis.warRisk + 20)
            message = `${actionBy} is mobilizing troops in the ${crisis.title}.`
            break

        case 'DECLARE_WAR':
            newPhase = 5 as CrisisPhase
            outcome = {
                type: 'WAR',
                concessions: [],
                relationChanges: [],
                worldOpinionChanges: [
                    { country: actionBy, delta: -15 } // Aggressor penalty
                ]
            }
            message = `${actionBy} has declared WAR in the ${crisis.title}!`
            break
    }

    // Calculate new deadline
    const newDeadline = gameDate + (PHASE_DEADLINES[newPhase] * 24 * 60 * 60 * 1000)

    const updatedCrisis: DiplomaticCrisis = {
        ...crisis,
        phase: newPhase,
        warRisk: newWarRisk,
        lastActionAt: gameDate,
        phaseDeadline: newDeadline,
        escalationHistory: newHistory
    }

    return { updatedCrisis, outcome, message }
}

// =============================================================================
// AI CRISIS BEHAVIOR
// =============================================================================

/**
 * Determine AI action in a crisis
 */
export function getAICrisisAction(
    crisis: DiplomaticCrisis,
    country: AICountry,
    opponentPower: number
): CrisisAction {
    const personality = country.strategyState?.personality || 'OPPORTUNIST'
    const availableActions = getAvailableActions(crisis, country.code)
    const powerRatio = (country.power || 50) / Math.max(opponentPower, 1)

    // Personality-based decision making
    switch (personality) {
        case 'EXPANSIONIST':
            // Aggressive, likes to escalate
            if (crisis.phase < 4 && powerRatio > 0.8) {
                return 'ESCALATE'
            }
            if (crisis.phase === 4 && powerRatio > 1.2) {
                return 'DECLARE_WAR'
            }
            return 'HOLD_FIRM'

        case 'DEFENSIVE':
            // Prefers de-escalation
            if (availableActions.includes('SEEK_MEDIATION')) {
                return Math.random() < 0.6 ? 'SEEK_MEDIATION' : 'HOLD_FIRM'
            }
            if (crisis.phase >= 3 && powerRatio < 0.8) {
                return 'BACK_DOWN'
            }
            return 'HOLD_FIRM'

        case 'OPPORTUNIST':
            // Acts based on power advantage
            if (powerRatio > 1.5 && crisis.phase < 4) {
                return 'ESCALATE'
            }
            if (powerRatio < 0.6) {
                return availableActions.includes('BACK_DOWN') ? 'BACK_DOWN' : 'SEEK_MEDIATION'
            }
            return 'HOLD_FIRM'

        case 'TRADING_POWER':
            // Prefers negotiation
            if (availableActions.includes('PROPOSE_SUMMIT')) {
                return Math.random() < 0.7 ? 'PROPOSE_SUMMIT' : 'SEEK_MEDIATION'
            }
            if (availableActions.includes('SEEK_MEDIATION')) {
                return 'SEEK_MEDIATION'
            }
            return 'HOLD_FIRM'

        case 'IDEOLOGICAL':
            // Stubborn, dislikes backing down
            if (crisis.phase < 3) {
                return 'HOLD_FIRM'
            }
            return powerRatio > 1.0 ? 'ESCALATE' : 'HOLD_FIRM'

        case 'ISOLATIONIST':
            // Avoids conflict
            if (availableActions.includes('BACK_DOWN') && crisis.phase >= 2) {
                return 'BACK_DOWN'
            }
            if (availableActions.includes('SEEK_MEDIATION')) {
                return 'SEEK_MEDIATION'
            }
            return 'HOLD_FIRM'

        default:
            return 'HOLD_FIRM'
    }
}

// =============================================================================
// MONTHLY PROCESSING
// =============================================================================

/**
 * Process monthly crisis updates
 */
export function processMonthCrises(
    crises: DiplomaticCrisis[],
    aiCountries: Map<string, AICountry>,
    playerCountryCode: string | null,
    gameDate: number
): {
    updatedCrises: DiplomaticCrisis[]
    resolvedCrises: { crisis: DiplomaticCrisis, outcome: CrisisOutcome }[]
    newCrisis: DiplomaticCrisis | null
    messages: string[]
} {
    const updatedCrises: DiplomaticCrisis[] = []
    const resolvedCrises: { crisis: DiplomaticCrisis, outcome: CrisisOutcome }[] = []
    const messages: string[] = []

    for (const crisis of crises) {
        // Skip if already resolved (phase 5 = war, handled elsewhere)
        if (crisis.phase === 5) continue

        // Check deadline auto-escalation
        if (gameDate >= crisis.phaseDeadline) {
            const newPhase = Math.min(5, crisis.phase + 1) as CrisisPhase
            const template = CRISIS_TEMPLATES[crisis.type]

            messages.push(`${crisis.title} has escalated to ${PHASE_NAMES[newPhase]} due to inaction.`)

            if (newPhase === 5) {
                resolvedCrises.push({
                    crisis: { ...crisis, phase: 5 },
                    outcome: {
                        type: 'WAR',
                        concessions: [],
                        relationChanges: [],
                        worldOpinionChanges: []
                    }
                })
            } else {
                updatedCrises.push({
                    ...crisis,
                    phase: newPhase,
                    warRisk: Math.min(100, crisis.warRisk + template.escalationRate),
                    phaseDeadline: gameDate + (PHASE_DEADLINES[newPhase] * 24 * 60 * 60 * 1000)
                })
            }
            continue
        }

        // AI takes action if player not involved or opponent's turn
        const aiParticipant = crisis.participants.find(p =>
            p !== playerCountryCode && p !== 'PLAYER'
        )

        if (aiParticipant) {
            const aiCountry = aiCountries.get(aiParticipant)
            if (aiCountry) {
                const opponent = crisis.participants.find(p => p !== aiParticipant)
                let opponentPower = 50

                if (opponent === 'PLAYER' || opponent === playerCountryCode) {
                    // Get player power from somewhere
                    opponentPower = 50 // Default, will be overridden at higher level
                } else if (opponent) {
                    opponentPower = aiCountries.get(opponent)?.power || 50
                }

                // AI acts with some probability each month
                if (Math.random() < 0.3) { // 30% chance to act
                    const action = getAICrisisAction(crisis, aiCountry, opponentPower)
                    const result = processCrisisAction(crisis, aiParticipant, action, gameDate)

                    messages.push(result.message)

                    if (result.outcome) {
                        resolvedCrises.push({
                            crisis: result.updatedCrisis,
                            outcome: result.outcome
                        })
                    } else {
                        updatedCrises.push(result.updatedCrisis)
                    }
                    continue
                }
            }
        }

        // No change, keep crisis
        updatedCrises.push(crisis)
    }

    // Check for new crisis triggers
    const newCrisis = checkCrisisTriggers(
        aiCountries,
        playerCountryCode,
        [...updatedCrises, ...crises],
        gameDate
    )

    if (newCrisis) {
        messages.push(`CRISIS: ${newCrisis.title}`)
        updatedCrises.push(newCrisis)
    }

    return { updatedCrises, resolvedCrises, newCrisis, messages }
}

/**
 * Get crisis summary for display
 */
export function getCrisisSummary(crisis: DiplomaticCrisis): {
    phaseName: string
    warRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    daysRemaining: number
} {
    const phaseName = PHASE_NAMES[crisis.phase]

    let warRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    if (crisis.warRisk < 25) warRiskLevel = 'LOW'
    else if (crisis.warRisk < 50) warRiskLevel = 'MEDIUM'
    else if (crisis.warRisk < 75) warRiskLevel = 'HIGH'
    else warRiskLevel = 'CRITICAL'

    const daysRemaining = Math.max(0, Math.floor(
        (crisis.phaseDeadline - Date.now()) / (24 * 60 * 60 * 1000)
    ))

    return { phaseName, warRiskLevel, daysRemaining }
}
