/**
 * Summit System
 * 
 * Handles diplomatic conferences and negotiations:
 * - Summit proposal and scheduling
 * - Topic selection and proposal generation
 * - Negotiation mechanics
 * - Agreement implementation
 */

import type {
    Summit,
    SummitType,
    SummitTopic,
    SummitProposal,
    SummitOutcome,
    SummitOutcomeType,
    SummitEffect
} from '../types/diplomaticTypes'
import type { AICountry } from '../types/game'

// =============================================================================
// SUMMIT CREATION
// =============================================================================

/**
 * Create a new summit proposal
 */
export function createSummit(
    type: SummitType,
    participants: string[],
    host: string,
    topics: SummitTopic[],
    gameDate: number
): Summit {
    const title = generateSummitTitle(type, host, topics)

    return {
        id: `summit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        participants,
        host,
        scheduledFor: gameDate + (30 * 24 * 60 * 60 * 1000), // 30 days from now
        topics,
        proposals: [],
        status: 'SCHEDULED'
    }
}

function generateSummitTitle(type: SummitType, host: string, topics: SummitTopic[]): string {
    const topicNames: Record<SummitTopic, string> = {
        PEACE_TREATY: 'Peace',
        TERRITORIAL: 'Territorial',
        TRADE_DEAL: 'Trade',
        ALLIANCE: 'Security',
        CRISIS_RESOLUTION: 'Crisis Resolution',
        COALITION_FORMATION: 'Coalition',
        ARMS_REDUCTION: 'Arms Control'
    }

    const primaryTopic = topics[0] ? topicNames[topics[0]] : 'Diplomatic'

    switch (type) {
        case 'BILATERAL':
            return `${host} ${primaryTopic} Summit`
        case 'REGIONAL':
            return `${host} Regional ${primaryTopic} Conference`
        case 'GLOBAL':
            return `${host} World ${primaryTopic} Summit`
    }
}

/**
 * Get available summit topics based on relationship
 */
export function getAvailableSummitTopics(
    _hostCountry: string,
    targetCountry: AICountry,
    isAtWar: boolean,
    hasActiveCrisis: boolean
): SummitTopic[] {
    const topics: SummitTopic[] = []

    // War-specific topic
    if (isAtWar) {
        topics.push('PEACE_TREATY')
    }

    // Crisis-specific topic
    if (hasActiveCrisis) {
        topics.push('CRISIS_RESOLUTION')
    }

    // General topics based on relations
    if (targetCountry.relations > -50) {
        topics.push('TRADE_DEAL')
    }

    if (targetCountry.relations > 0) {
        topics.push('TERRITORIAL')
        topics.push('ARMS_REDUCTION')
    }

    if (targetCountry.relations > 30) {
        topics.push('ALLIANCE')
        topics.push('COALITION_FORMATION')
    }

    return topics
}

// =============================================================================
// PROPOSAL GENERATION
// =============================================================================

/**
 * Generate a proposal for a summit topic
 */
export function createProposal(
    topic: SummitTopic,
    offeredBy: string,
    context: {
        territory?: string
        tradeTerms?: string
        allianceType?: string
    }
): SummitProposal {
    const terms: string[] = []

    switch (topic) {
        case 'PEACE_TREATY':
            terms.push('Immediate cessation of hostilities')
            terms.push('Return to pre-war borders')
            terms.push('Exchange of prisoners')
            break

        case 'TERRITORIAL':
            if (context.territory) {
                terms.push(`Recognition of ${context.territory} sovereignty`)
                terms.push('Demarcation of borders')
            } else {
                terms.push('Mutual border recognition')
            }
            terms.push('Non-aggression pledge for 10 years')
            break

        case 'TRADE_DEAL':
            terms.push('Reduce tariffs to LOW')
            terms.push('Most Favored Nation status')
            terms.push('Joint investment framework')
            break

        case 'ALLIANCE':
            terms.push('Mutual defense pact')
            terms.push('Intelligence sharing')
            terms.push('Joint military exercises')
            break

        case 'CRISIS_RESOLUTION':
            terms.push('Stand down military forces')
            terms.push('Third-party mediation')
            terms.push('Cooling-off period of 90 days')
            break

        case 'COALITION_FORMATION':
            terms.push('Founding member status')
            terms.push('Shared policy coordination')
            terms.push('Collective decision-making')
            break

        case 'ARMS_REDUCTION':
            terms.push('10% reduction in military spending')
            terms.push('Troop withdrawal from borders')
            terms.push('Arms inspection regime')
            break
    }

    return {
        topic,
        terms,
        offeredBy
    }
}

/**
 * Evaluate if AI would accept a proposal
 */
export function evaluateProposal(
    proposal: SummitProposal,
    evaluator: AICountry,
    proposerRelations: number
): { accept: boolean, counterOffer?: SummitProposal, reason: string } {
    const personality = evaluator.strategyState?.personality || 'OPPORTUNIST'
    const baseAcceptance = 0.3 + (proposerRelations / 200) // -50 to +80%

    // Personality modifiers
    let acceptanceModifier = 0

    switch (personality) {
        case 'DEFENSIVE':
        case 'TRADING_POWER':
            // More likely to accept peaceful proposals
            if (['TRADE_DEAL', 'PEACE_TREATY', 'ARMS_REDUCTION'].includes(proposal.topic)) {
                acceptanceModifier += 0.2
            }
            break

        case 'EXPANSIONIST':
        case 'OPPORTUNIST':
            // Less likely to accept restrictive agreements
            if (['ARMS_REDUCTION', 'TERRITORIAL'].includes(proposal.topic)) {
                acceptanceModifier -= 0.2
            }
            break

        case 'ISOLATIONIST':
            // Generally reluctant
            acceptanceModifier -= 0.1
            break

        case 'IDEOLOGICAL':
            // Depends on alignment (simplified)
            acceptanceModifier += 0.1
            break
    }

    const finalChance = Math.max(0.1, Math.min(0.9, baseAcceptance + acceptanceModifier))

    if (Math.random() < finalChance) {
        return { accept: true, reason: 'Terms are acceptable.' }
    }

    // Generate counter-offer with modified terms
    if (Math.random() < 0.5) {
        const modifiedTerms = proposal.terms.slice(0, -1) // Remove last term as concession
        return {
            accept: false,
            counterOffer: {
                ...proposal,
                terms: modifiedTerms,
                offeredBy: evaluator.code
            },
            reason: 'Propose modified terms.'
        }
    }

    return { accept: false, reason: 'Unable to agree on terms.' }
}

// =============================================================================
// SUMMIT EXECUTION
// =============================================================================

/**
 * Process the summit and determine outcome
 */
export function conductSummit(
    summit: Summit,
    playerAcceptsProposals: Map<SummitTopic, boolean>,
    aiParticipant?: AICountry,
    playerRelations?: number
): SummitOutcome {
    const agreements: SummitOutcome['agreements'] = []
    const failedTopics: SummitTopic[] = []
    const relationChanges: { country: string, delta: number }[] = []

    for (const proposal of summit.proposals) {
        let accepted = false

        if (proposal.offeredBy === 'PLAYER') {
            // AI evaluates player proposal
            if (aiParticipant && playerRelations !== undefined) {
                const evaluation = evaluateProposal(proposal, aiParticipant, playerRelations)
                accepted = evaluation.accept
            }
        } else {
            // Player decision
            accepted = playerAcceptsProposals.get(proposal.topic) || false
        }

        if (accepted) {
            agreements.push({
                topic: proposal.topic,
                signatories: summit.participants,
                terms: proposal.terms,
                effects: getTopicEffects(proposal.topic, summit.participants)
            })

            // Improve relations for successful agreement
            for (const participant of summit.participants) {
                if (participant !== 'PLAYER') {
                    relationChanges.push({ country: participant, delta: 10 })
                }
            }
        } else {
            failedTopics.push(proposal.topic)

            // Small relation hit for failed topic
            for (const participant of summit.participants) {
                if (participant !== 'PLAYER') {
                    relationChanges.push({ country: participant, delta: -2 })
                }
            }
        }
    }

    // Determine overall outcome
    let outcomeType: SummitOutcomeType

    if (agreements.length === summit.topics.length) {
        outcomeType = 'AGREEMENT'
    } else if (agreements.length > 0) {
        outcomeType = 'PARTIAL'
    } else if (failedTopics.length === summit.topics.length) {
        outcomeType = 'BREAKDOWN'
    } else {
        outcomeType = 'POSTPONED'
    }

    return {
        type: outcomeType,
        agreements,
        failedTopics,
        relationChanges
    }
}

/**
 * Get effects for a summit topic
 */
function getTopicEffects(topic: SummitTopic, participants: string[]): SummitEffect[] {
    const effects: SummitEffect[] = []

    switch (topic) {
        case 'PEACE_TREATY':
            effects.push({ type: 'AGREEMENT', details: 'War ended' })
            for (const p of participants) {
                if (p !== 'PLAYER') {
                    effects.push({ type: 'MODIFIER', targetCountry: p, duration: 60 })
                }
            }
            break

        case 'TRADE_DEAL':
            for (const p of participants) {
                if (p !== 'PLAYER') {
                    effects.push({ type: 'TRADE', targetCountry: p })
                }
            }
            break

        case 'ALLIANCE':
            for (const p of participants) {
                if (p !== 'PLAYER') {
                    effects.push({ type: 'ALLIANCE', targetCountry: p })
                }
            }
            break

        case 'TERRITORIAL':
            effects.push({ type: 'TERRITORY_TRANSFER', details: 'Border agreement' })
            break

        case 'CRISIS_RESOLUTION':
            effects.push({ type: 'AGREEMENT', details: 'Crisis ended' })
            break

        case 'COALITION_FORMATION':
            effects.push({ type: 'AGREEMENT', details: 'Coalition formed' })
            break

        case 'ARMS_REDUCTION':
            effects.push({ type: 'MODIFIER', duration: 24, details: 'Arms limited' })
            break
    }

    return effects
}

/**
 * Apply summit outcome effects
 */
export function applySummitEffects(
    outcome: SummitOutcome,
    _aiCountries: Map<string, AICountry>
): {
    alliances: string[]
    tradeDeals: string[]
    peaceTreaties: string[]
    crisisesResolved: string[]
    messages: string[]
} {
    const alliances: string[] = []
    const tradeDeals: string[] = []
    const peaceTreaties: string[] = []
    const crisisesResolved: string[] = []
    const messages: string[] = []

    for (const agreement of outcome.agreements) {
        for (const effect of agreement.effects) {
            switch (effect.type) {
                case 'ALLIANCE':
                    if (effect.targetCountry) {
                        alliances.push(effect.targetCountry)
                        messages.push(`Alliance formed with ${effect.targetCountry}`)
                    }
                    break

                case 'TRADE':
                    if (effect.targetCountry) {
                        tradeDeals.push(effect.targetCountry)
                        messages.push(`Trade deal signed with ${effect.targetCountry}`)
                    }
                    break

                case 'AGREEMENT':
                    if (effect.details?.includes('War ended')) {
                        for (const sig of agreement.signatories) {
                            if (sig !== 'PLAYER') {
                                peaceTreaties.push(sig)
                                messages.push(`Peace treaty signed with ${sig}`)
                            }
                        }
                    }
                    if (effect.details?.includes('Crisis ended')) {
                        crisisesResolved.push('crisis_resolved')
                        messages.push('Crisis resolved through diplomacy')
                    }
                    break
            }
        }
    }

    return { alliances, tradeDeals, peaceTreaties, crisisesResolved, messages }
}

// =============================================================================
// AI SUMMIT INITIATION
// =============================================================================

/**
 * Determine if AI should propose a summit
 */
export function shouldAIProposeSummit(
    country: AICountry,
    potentialPartner: AICountry | null,
    hasActiveCrisis: boolean,
    isAtWar: boolean
): { shouldPropose: boolean, topics: SummitTopic[] } {
    const personality = country.strategyState?.personality || 'OPPORTUNIST'
    const topics: SummitTopic[] = []

    // Priority: end war or crisis
    if (isAtWar && country.strategyState?.threatLevel?.totalThreat || 0 > 50) {
        topics.push('PEACE_TREATY')
    }

    if (hasActiveCrisis && personality !== 'EXPANSIONIST') {
        topics.push('CRISIS_RESOLUTION')
    }

    // Secondary: build relationships
    if (potentialPartner) {
        const relations = potentialPartner.relations

        if (relations > 30 && personality === 'DEFENSIVE') {
            topics.push('ALLIANCE')
        }

        if (relations > 0 && ['TRADING_POWER', 'DEFENSIVE'].includes(personality)) {
            topics.push('TRADE_DEAL')
        }
    }

    // Only propose if we have topics
    const shouldPropose = topics.length > 0 && Math.random() < 0.3 // 30% chance per check

    return { shouldPropose, topics }
}

/**
 * Get summit outcome message
 */
export function getSummitOutcomeMessage(summit: Summit, outcome: SummitOutcome): string {
    switch (outcome.type) {
        case 'AGREEMENT':
            return `The ${summit.title} concluded successfully with full agreement on all topics.`
        case 'PARTIAL':
            return `The ${summit.title} reached partial agreement on ${outcome.agreements.length} of ${summit.topics.length} topics.`
        case 'BREAKDOWN':
            return `The ${summit.title} ended in failure. No agreements were reached.`
        case 'POSTPONED':
            return `The ${summit.title} has been postponed. Delegations will reconvene.`
    }
}
