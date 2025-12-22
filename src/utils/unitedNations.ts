/**
 * United Nations System
 * 
 * Handles international governance mechanics:
 * - Resolution creation and voting
 * - Security Council with veto power
 * - Sanctions and international pressure
 * - AI voting behavior
 */

import type {
    UNResolution,
    UNState,
    ResolutionType,
    VoteChoice,
    SecurityCouncilState
} from '../types/diplomaticTypes'
import { RESOLUTION_TEMPLATES } from '../types/diplomaticTypes'
import type { AICountry } from '../types/game'

// =============================================================================
// SECURITY COUNCIL
// =============================================================================

const PERMANENT_MEMBERS = ['USA', 'CHN', 'RUS', 'GBR', 'FRA'] // P5

/**
 * Initialize the Security Council
 */
export function initSecurityCouncil(availableCountries: Map<string, AICountry>): SecurityCouncilState {
    // Filter P5 to only include those in the game
    const permanentMembers = PERMANENT_MEMBERS.filter(code =>
        availableCountries.has(code)
    )

    // Select rotating members (10 non-permanent seats)
    const rotatingMembers: string[] = []
    const eligibleCountries = Array.from(availableCountries.values())
        .filter(c => !permanentMembers.includes(c.code) && !c.isAnnexed)
        .sort((a, b) => b.power - a.power) // Prefer powerful nations
        .slice(0, 20) // Top 20 candidates

    // Random selection from top candidates
    for (let i = 0; i < 10 && eligibleCountries.length > 0; i++) {
        const idx = Math.floor(Math.random() * Math.min(10, eligibleCountries.length))
        rotatingMembers.push(eligibleCountries[idx].code)
        eligibleCountries.splice(idx, 1)
    }

    return {
        permanentMembers,
        rotatingMembers,
        lastRotation: Date.now()
    }
}

/**
 * Check if a country has veto power
 */
export function hasVetoPower(countryCode: string, securityCouncil: SecurityCouncilState): boolean {
    return securityCouncil.permanentMembers.includes(countryCode)
}

/**
 * Check if a country is on the Security Council
 */
export function isSecurityCouncilMember(
    countryCode: string,
    securityCouncil: SecurityCouncilState
): boolean {
    return securityCouncil.permanentMembers.includes(countryCode) ||
        securityCouncil.rotatingMembers.includes(countryCode)
}

// =============================================================================
// RESOLUTION GENERATION
// =============================================================================

/**
 * Generate a procedural resolution based on game state
 */
export function generateResolution(
    aiCountries: Map<string, AICountry>,
    playerCountryCode: string | null,
    gameDate: number,
    existingResolutions: UNResolution[]
): UNResolution | null {
    // Find potential targets (countries that have done something notable)
    const potentialTargets = Array.from(aiCountries.values()).filter(c =>
        !c.isAnnexed && (
            c.isAtWar ||
            c.modifiers.includes('REVANCHISM') ||
            c.territoryLost > 10 ||
            c.politicalState?.unrest && c.politicalState.unrest >= 4
        )
    )

    // Don't create duplicate resolutions against same target
    const recentTargets = existingResolutions
        .filter(r => r.status === 'VOTING' || r.status === 'PASSED')
        .map(r => r.targetCountry)
        .filter(Boolean)

    const newTargets = potentialTargets.filter(t => !recentTargets.includes(t.code))

    if (newTargets.length === 0 && potentialTargets.length === 0) {
        // Generate a neutral resolution
        const neutralTypes: ResolutionType[] = ['CLIMATE_ACCORD', 'ARMS_CONTROL', 'TRADE_STANDARDS']
        const type = neutralTypes[Math.floor(Math.random() * neutralTypes.length)]
        return createResolution(type, undefined, gameDate, playerCountryCode)
    }

    // Pick a target and appropriate resolution type
    const target = newTargets.length > 0
        ? newTargets[Math.floor(Math.random() * newTargets.length)]
        : potentialTargets[Math.floor(Math.random() * potentialTargets.length)]

    let type: ResolutionType

    if (target.isAtWar) {
        type = Math.random() < 0.5 ? 'CONDEMN_AGGRESSION' : 'PEACEKEEPING'
    } else if (target.politicalState?.unrest && target.politicalState.unrest >= 4) {
        type = Math.random() < 0.5 ? 'HUMANITARIAN' : 'HUMAN_RIGHTS'
    } else if (target.modifiers.includes('REVANCHISM')) {
        type = 'CONDEMN_AGGRESSION'
    } else {
        type = 'IMPOSE_SANCTIONS'
    }

    return createResolution(type, target.code, gameDate, playerCountryCode)
}

/**
 * Create a specific resolution
 */
export function createResolution(
    type: ResolutionType,
    targetCountry: string | undefined,
    gameDate: number,
    proposedBy: string | null
): UNResolution {
    const template = RESOLUTION_TEMPLATES[type]

    const title = targetCountry
        ? template.titleTemplate.replace('{target}', targetCountry)
        : template.titleTemplate

    const description = targetCountry
        ? template.descriptionTemplate.replace(/{target}/g, targetCountry)
        : template.descriptionTemplate

    return {
        id: `un-res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        description,
        proposedBy: proposedBy || 'UN_SECRETARY',
        targetCountry,
        votingEnds: gameDate + (30 * 24 * 60 * 60 * 1000), // 30 days
        votes: new Map(),
        status: 'VOTING',
        passThreshold: template.passThreshold,
        requiresSecurityCouncil: template.requiresSecurityCouncil,
        effects: targetCountry ? template.effects(targetCountry) : []
    }
}

// =============================================================================
// VOTING MECHANICS
// =============================================================================

/**
 * Calculate how an AI country would vote on a resolution
 */
export function calculateAIVote(
    country: AICountry,
    resolution: UNResolution,
    playerRelations: number
): VoteChoice {
    const target = resolution.targetCountry

    // If they ARE the target, vote NO
    if (target === country.code) {
        return 'NO'
    }

    // If target is an ally, vote NO
    if (target && country.allies.includes(target)) {
        return 'NO'
    }

    // If target is an enemy, vote YES
    if (target && country.enemies.includes(target)) {
        return 'YES'
    }

    // Ideological considerations
    const freedom = country.politicalState?.freedom || 3

    // Authoritarian countries dislike intervention resolutions
    if (resolution.type === 'HUMANITARIAN' || resolution.type === 'HUMAN_RIGHTS') {
        if (freedom <= 2) {
            return Math.random() < 0.7 ? 'NO' : 'ABSTAIN'
        }
    }

    // Democratic countries generally support international order
    if (freedom >= 4) {
        if (resolution.type !== 'IMPOSE_SANCTIONS') {
            return Math.random() < 0.7 ? 'YES' : 'ABSTAIN'
        }
    }

    // If player is proposer and good relations
    if (resolution.proposedBy === 'PLAYER' && playerRelations > 30) {
        return Math.random() < 0.6 ? 'YES' : 'ABSTAIN'
    }

    // If player is proposer and bad relations
    if (resolution.proposedBy === 'PLAYER' && playerRelations < -30) {
        return Math.random() < 0.6 ? 'NO' : 'ABSTAIN'
    }

    // Default: based on general disposition
    const roll = Math.random()
    if (roll < 0.4) return 'YES'
    if (roll < 0.7) return 'ABSTAIN'
    return 'NO'
}

/**
 * Process all AI votes on a resolution
 */
export function processAIVotes(
    resolution: UNResolution,
    aiCountries: Map<string, AICountry>,
    playerRelations: Map<string, number>
): Map<string, VoteChoice> {
    const votes = new Map(resolution.votes)

    for (const [code, country] of aiCountries) {
        if (country.isAnnexed) continue
        if (votes.has(code)) continue // Already voted

        const relations = playerRelations.get(code) || 0
        const vote = calculateAIVote(country, resolution, relations)
        votes.set(code, vote)
    }

    return votes
}

/**
 * Tally votes and determine resolution outcome
 */
export function tallyVotes(
    resolution: UNResolution,
    securityCouncil: SecurityCouncilState,
    _totalVoters: number
): { passed: boolean, vetoedBy?: string, yesVotes: number, noVotes: number, abstentions: number } {
    let yesVotes = 0
    let noVotes = 0
    let abstentions = 0
    let vetoedBy: string | undefined

    for (const [countryCode, vote] of resolution.votes) {
        if (vote === 'YES') yesVotes++
        else if (vote === 'NO') {
            noVotes++
            // Check for veto
            if (resolution.requiresSecurityCouncil && hasVetoPower(countryCode, securityCouncil)) {
                vetoedBy = countryCode
            }
        }
        else abstentions++
    }

    // Check if passed (excluding abstentions from denominator)
    const votingMembers = yesVotes + noVotes
    const passRatio = votingMembers > 0 ? yesVotes / votingMembers : 0
    const passed = passRatio >= resolution.passThreshold && !vetoedBy

    return { passed, vetoedBy, yesVotes, noVotes, abstentions }
}

// =============================================================================
// RESOLUTION EFFECTS
// =============================================================================

/**
 * Apply the effects of a passed resolution
 */
export function applyResolutionEffects(
    resolution: UNResolution,
    _aiCountries: Map<string, AICountry>
): {
    sanctions: string[]
    relationChanges: { country: string, delta: number }[]
    modifiersAdded: { country: string, type: string, duration: number }[]
    message: string
} {
    const sanctions: string[] = []
    const relationChanges: { country: string, delta: number }[] = []
    const modifiersAdded: { country: string, type: string, duration: number }[] = []

    for (const effect of resolution.effects) {
        if (!effect.targetCountry) continue

        switch (effect.type) {
            case 'SANCTION':
                sanctions.push(effect.targetCountry)
                modifiersAdded.push({
                    country: effect.targetCountry,
                    type: 'UN_SANCTIONED',
                    duration: effect.duration || 24
                })
                break

            case 'RELATION_CHANGE':
                relationChanges.push({
                    country: effect.targetCountry,
                    delta: effect.value
                })
                break

            case 'MODIFIER':
                modifiersAdded.push({
                    country: effect.targetCountry,
                    type: 'WORLD_PARIAH',
                    duration: effect.duration || 12
                })
                break

            case 'TRADE_BLOCK':
                // Will be handled by tariff system
                break
        }
    }

    const message = `UN Resolution "${resolution.title}" has been passed.` +
        (sanctions.length > 0 ? ` Sanctions imposed on: ${sanctions.join(', ')}.` : '')

    return { sanctions, relationChanges, modifiersAdded, message }
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Initialize UN state
 */
export function initUNState(availableCountries: Map<string, AICountry>): UNState {
    return {
        securityCouncil: initSecurityCouncil(availableCountries),
        activeResolutions: [],
        passedResolutions: [],
        failedResolutions: [],
        nextResolutionTime: Date.now() + (60 * 24 * 60 * 60 * 1000), // 60 days
        playerReputation: 50 // Start neutral-positive
    }
}

/**
 * Process monthly UN updates
 */
export function processMonthlyUN(
    state: UNState,
    aiCountries: Map<string, AICountry>,
    playerCountryCode: string | null,
    playerRelations: Map<string, number>,
    gameDate: number
): {
    newState: UNState
    newResolutions: UNResolution[]
    resolvedResolutions: { resolution: UNResolution, passed: boolean, vetoedBy?: string }[]
    messages: string[]
} {
    const messages: string[] = []
    const newResolutions: UNResolution[] = []
    const resolvedResolutions: { resolution: UNResolution, passed: boolean, vetoedBy?: string }[] = []

    // Generate new resolution if it's time
    if (gameDate >= state.nextResolutionTime && state.activeResolutions.length < 3) {
        const newRes = generateResolution(
            aiCountries,
            playerCountryCode,
            gameDate,
            state.activeResolutions
        )
        if (newRes) {
            newResolutions.push(newRes)
            messages.push(`New UN Resolution proposed: "${newRes.title}"`)
        }
    }

    // Process voting on active resolutions
    const stillActive: UNResolution[] = []

    for (const resolution of state.activeResolutions) {
        // AI voting
        resolution.votes = processAIVotes(resolution, aiCountries, playerRelations)

        // Check if voting period ended
        if (gameDate >= resolution.votingEnds) {
            const result = tallyVotes(resolution, state.securityCouncil, aiCountries.size)

            if (result.vetoedBy) {
                const vetoCountry = aiCountries.get(result.vetoedBy)
                messages.push(`UN Resolution "${resolution.title}" was VETOED by ${vetoCountry?.name || result.vetoedBy}.`)
                resolvedResolutions.push({
                    resolution: { ...resolution, status: 'FAILED', vetoedBy: result.vetoedBy },
                    passed: false,
                    vetoedBy: result.vetoedBy
                })
            } else if (result.passed) {
                messages.push(`UN Resolution "${resolution.title}" PASSED (${result.yesVotes}-${result.noVotes}).`)
                resolvedResolutions.push({
                    resolution: { ...resolution, status: 'PASSED' },
                    passed: true
                })
            } else {
                messages.push(`UN Resolution "${resolution.title}" FAILED (${result.yesVotes}-${result.noVotes}).`)
                resolvedResolutions.push({
                    resolution: { ...resolution, status: 'FAILED' },
                    passed: false
                })
            }
        } else {
            stillActive.push(resolution)
        }
    }

    // Calculate next resolution time (every 2-4 months)
    const nextResolutionDelay = (60 + Math.random() * 60) * 24 * 60 * 60 * 1000

    const newState: UNState = {
        ...state,
        activeResolutions: [...stillActive, ...newResolutions],
        passedResolutions: [
            ...state.passedResolutions,
            ...resolvedResolutions.filter(r => r.passed).map(r => r.resolution)
        ],
        failedResolutions: [
            ...state.failedResolutions,
            ...resolvedResolutions.filter(r => !r.passed).map(r => r.resolution)
        ],
        nextResolutionTime: state.activeResolutions.length < 3
            ? gameDate + nextResolutionDelay
            : state.nextResolutionTime
    }

    return { newState, newResolutions, resolvedResolutions, messages }
}

/**
 * Player votes on a resolution
 */
export function playerVote(
    state: UNState,
    resolutionId: string,
    vote: VoteChoice
): UNState {
    const newActive = state.activeResolutions.map(res => {
        if (res.id === resolutionId) {
            const newVotes = new Map(res.votes)
            newVotes.set('PLAYER', vote)
            return { ...res, votes: newVotes }
        }
        return res
    })

    return { ...state, activeResolutions: newActive }
}

/**
 * Update player reputation based on voting behavior
 */
export function updatePlayerReputation(
    currentReputation: number,
    resolution: UNResolution,
    playerVote: VoteChoice,
    passed: boolean
): number {
    let delta = 0

    // Voting with majority improves reputation
    if (passed && playerVote === 'YES') delta += 2
    if (!passed && playerVote === 'NO') delta += 1

    // Voting against humanitarian resolutions damages reputation
    if (resolution.type === 'HUMANITARIAN' && playerVote === 'NO') {
        delta -= 5
    }

    // Supporting sanctions shows commitment
    if (resolution.type === 'IMPOSE_SANCTIONS' && playerVote === 'YES' && passed) {
        delta += 3
    }

    return Math.max(-100, Math.min(100, currentReputation + delta))
}
