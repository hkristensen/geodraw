/**
 * Diplomatic Types
 * 
 * Type definitions for the advanced diplomacy system including:
 * - United Nations resolutions and voting
 * - International crises and escalation
 * - Soft power and influence
 * - Diplomatic summits and negotiations
 * - International incidents
 */

import type { AICountry } from './game'

// =============================================================================
// SOFT POWER SYSTEM
// =============================================================================

export type InfluenceActionType =
    | 'CULTURAL_EXCHANGE'    // Slow relation improvement
    | 'ECONOMIC_AID'         // Fast relation boost, costs budget
    | 'FUND_OPPOSITION'      // Destabilize target (covert)
    | 'PROPAGANDA_CAMPAIGN'  // Damage world opinion (covert)
    | 'ESPIONAGE'            // Gather intel, sabotage (covert)
    | 'HOST_EVENT'           // Olympics, World Expo (prestige)

export interface InfluenceAction {
    id: string
    type: InfluenceActionType
    targetCountry: string
    startedAt: number
    duration: number         // Months
    influenceCost: number
    budgetCost?: number
    isCovert: boolean
    detected?: boolean       // If covert action was caught
}

export interface SoftPowerState {
    influencePoints: number
    worldOpinion: number     // -100 to +100
    monthlyInfluenceIncome: number
    activeActions: InfluenceAction[]
    hostedEvents: string[]   // Past events hosted
}

export const INFLUENCE_ACTION_DEFS: Record<InfluenceActionType, {
    name: string
    description: string
    influenceCost: number
    budgetCost: number
    duration: number
    isCovert: boolean
    effects: string
}> = {
    CULTURAL_EXCHANGE: {
        name: 'Cultural Exchange Program',
        description: 'Establish cultural ties with the target nation',
        influenceCost: 10,
        budgetCost: 5_000_000,
        duration: 12,
        isCovert: false,
        effects: '+2 relations/month for 12 months'
    },
    ECONOMIC_AID: {
        name: 'Economic Aid Package',
        description: 'Send financial assistance to improve relations',
        influenceCost: 20,
        budgetCost: 100_000_000,
        duration: 1,
        isCovert: false,
        effects: '+25 relations immediately'
    },
    FUND_OPPOSITION: {
        name: 'Fund Opposition Parties',
        description: 'Secretly support anti-government groups',
        influenceCost: 30,
        budgetCost: 50_000_000,
        duration: 6,
        isCovert: true,
        effects: '-1 stability/month, -50 relations if caught'
    },
    PROPAGANDA_CAMPAIGN: {
        name: 'International Propaganda',
        description: 'Launch a media campaign against the target',
        influenceCost: 25,
        budgetCost: 20_000_000,
        duration: 3,
        isCovert: true,
        effects: '-15 world opinion for target'
    },
    ESPIONAGE: {
        name: 'Espionage Operation',
        description: 'Gather intelligence and potentially sabotage',
        influenceCost: 40,
        budgetCost: 30_000_000,
        duration: 1,
        isCovert: true,
        effects: 'Intel on target, chance to sabotage military'
    },
    HOST_EVENT: {
        name: 'Host International Event',
        description: 'Bid to host Olympics, World Expo, or Summit',
        influenceCost: 50,
        budgetCost: 500_000_000,
        duration: 1,
        isCovert: false,
        effects: '+20 world opinion, +10 relations with all'
    }
}

// =============================================================================
// UNITED NATIONS SYSTEM
// =============================================================================

export type ResolutionType =
    | 'CONDEMN_AGGRESSION'   // Condemn a nation for war/annexation
    | 'IMPOSE_SANCTIONS'     // Economic sanctions on target
    | 'PEACEKEEPING'         // Deploy observers to conflict zone
    | 'HUMANITARIAN'         // Aid/intervention mandate
    | 'CLIMATE_ACCORD'       // Environmental treaty
    | 'ARMS_CONTROL'         // Weapons reduction
    | 'TRADE_STANDARDS'      // Global trade rules
    | 'HUMAN_RIGHTS'         // Human rights condemnation

export type VoteChoice = 'YES' | 'NO' | 'ABSTAIN'

export interface UNResolution {
    id: string
    type: ResolutionType
    title: string
    description: string
    proposedBy: string       // ISO3 code or 'PLAYER'
    targetCountry?: string   // Who it affects (for sanctions, condemnations)
    votingEnds: number       // Game timestamp
    votes: Map<string, VoteChoice>
    status: 'VOTING' | 'PASSED' | 'FAILED'
    passThreshold: number    // 0.5 for simple majority, 0.67 for supermajority
    requiresSecurityCouncil: boolean
    vetoedBy?: string        // Security council member who vetoed
    effects: ResolutionEffect[]
}

export interface ResolutionEffect {
    type: 'SANCTION' | 'RELATION_CHANGE' | 'MODIFIER' | 'TRADE_BLOCK'
    targetCountry?: string
    value: number
    duration?: number
}

export interface SecurityCouncilState {
    permanentMembers: string[]   // P5 with veto
    rotatingMembers: string[]    // Non-permanent members
    lastRotation: number
}

export interface UNState {
    securityCouncil: SecurityCouncilState
    activeResolutions: UNResolution[]
    passedResolutions: UNResolution[]
    failedResolutions: UNResolution[]
    nextResolutionTime: number
    playerReputation: number     // Standing in UN (-100 to 100)
}

// Resolution templates for procedural generation
export const RESOLUTION_TEMPLATES: Record<ResolutionType, {
    titleTemplate: string
    descriptionTemplate: string
    passThreshold: number
    requiresSecurityCouncil: boolean
    effects: (target: string) => ResolutionEffect[]
}> = {
    CONDEMN_AGGRESSION: {
        titleTemplate: 'Condemn {target}\'s Military Aggression',
        descriptionTemplate: 'The General Assembly condemns the recent military actions by {target} and calls for immediate withdrawal.',
        passThreshold: 0.5,
        requiresSecurityCouncil: false,
        effects: (target) => [
            { type: 'RELATION_CHANGE', targetCountry: target, value: -10 },
            { type: 'MODIFIER', targetCountry: target, value: 1, duration: 12 }
        ]
    },
    IMPOSE_SANCTIONS: {
        titleTemplate: 'Economic Sanctions Against {target}',
        descriptionTemplate: 'Impose comprehensive economic sanctions on {target} until compliance with international law.',
        passThreshold: 0.67,
        requiresSecurityCouncil: true,
        effects: (target) => [
            { type: 'SANCTION', targetCountry: target, value: 1, duration: 24 },
            { type: 'TRADE_BLOCK', targetCountry: target, value: 1 }
        ]
    },
    PEACEKEEPING: {
        titleTemplate: 'Peacekeeping Mission in {target}',
        descriptionTemplate: 'Deploy UN peacekeeping observers to monitor the situation in {target}.',
        passThreshold: 0.5,
        requiresSecurityCouncil: true,
        effects: (target) => [
            { type: 'MODIFIER', targetCountry: target, value: 1, duration: 12 }
        ]
    },
    HUMANITARIAN: {
        titleTemplate: 'Humanitarian Intervention in {target}',
        descriptionTemplate: 'Authorize humanitarian aid corridors and intervention in {target}.',
        passThreshold: 0.67,
        requiresSecurityCouncil: true,
        effects: (target) => [
            { type: 'RELATION_CHANGE', targetCountry: target, value: 5 }
        ]
    },
    CLIMATE_ACCORD: {
        titleTemplate: 'Global Climate Accord',
        descriptionTemplate: 'Commit all signatories to emissions reductions and environmental protections.',
        passThreshold: 0.5,
        requiresSecurityCouncil: false,
        effects: () => []
    },
    ARMS_CONTROL: {
        titleTemplate: 'Arms Limitation Treaty',
        descriptionTemplate: 'Limit the proliferation of weapons and reduce global military spending.',
        passThreshold: 0.67,
        requiresSecurityCouncil: false,
        effects: () => []
    },
    TRADE_STANDARDS: {
        titleTemplate: 'International Trade Standards',
        descriptionTemplate: 'Establish fair trade practices and reduce barriers to commerce.',
        passThreshold: 0.5,
        requiresSecurityCouncil: false,
        effects: () => []
    },
    HUMAN_RIGHTS: {
        titleTemplate: 'Human Rights Violations in {target}',
        descriptionTemplate: 'Condemn human rights abuses in {target} and call for reforms.',
        passThreshold: 0.5,
        requiresSecurityCouncil: false,
        effects: (target) => [
            { type: 'RELATION_CHANGE', targetCountry: target, value: -5 }
        ]
    }
}

// =============================================================================
// CRISIS SYSTEM
// =============================================================================

export type CrisisType =
    | 'BORDER_INCIDENT'      // Military clash at border
    | 'ASSASSINATION'        // Leader or diplomat killed
    | 'TERRITORIAL_DISPUTE'  // Contested territory
    | 'HUMANITARIAN'         // Refugee crisis, disaster
    | 'PROXY_WAR'           // Supporting rebels
    | 'TRADE_WAR'           // Economic conflict
    | 'HOSTAGE_SITUATION'   // Embassy siege
    | 'ENVIRONMENTAL'       // Cross-border pollution

export type CrisisPhase = 1 | 2 | 3 | 4 | 5
// 1: Incident, 2: Demands, 3: Ultimatum, 4: Mobilization, 5: War

export type CrisisAction =
    | 'BACK_DOWN'           // Concede, lose face
    | 'HOLD_FIRM'           // Maintain position
    | 'ESCALATE'            // Increase pressure
    | 'SEEK_MEDIATION'      // Request UN/third party help
    | 'PROPOSE_SUMMIT'      // Direct negotiation
    | 'MOBILIZE'            // Move troops (phase 4+)
    | 'DECLARE_WAR'         // End crisis with war

export interface DiplomaticCrisis {
    id: string
    type: CrisisType
    title: string
    description: string
    participants: string[]   // ISO3 codes involved
    initiator: string        // Who started it
    phase: CrisisPhase
    startedAt: number
    lastActionAt: number
    phaseDeadline: number    // When phase auto-escalates
    playerIsParticipant: boolean

    // Tracking
    escalationHistory: { phase: CrisisPhase, action: string, by: string, at: number }[]
    warRisk: number          // 0-100, probability of war

    // Stakes
    territoryAtStake?: string
    demandsMade: string[]
    concessionsMade: string[]
}

export interface CrisisOutcome {
    type: 'PEACEFUL' | 'WAR' | 'STALEMATE'
    winner?: string
    loser?: string
    concessions: { from: string, to: string, what: string }[]
    relationChanges: { country: string, delta: number }[]
    worldOpinionChanges: { country: string, delta: number }[]
}

// Crisis templates
export const CRISIS_TEMPLATES: Record<CrisisType, {
    titleTemplate: string
    descriptionTemplate: string
    baseWarRisk: number
    escalationRate: number
}> = {
    BORDER_INCIDENT: {
        titleTemplate: '{initiator}-{target} Border Clash',
        descriptionTemplate: 'Armed forces from {initiator} and {target} have exchanged fire at the border.',
        baseWarRisk: 20,
        escalationRate: 15
    },
    ASSASSINATION: {
        titleTemplate: 'Assassination Crisis',
        descriptionTemplate: 'A high-ranking official from {target} has been assassinated. {initiator} is accused.',
        baseWarRisk: 30,
        escalationRate: 20
    },
    TERRITORIAL_DISPUTE: {
        titleTemplate: 'Disputed Territory: {territory}',
        descriptionTemplate: '{initiator} and {target} both claim sovereignty over the contested region.',
        baseWarRisk: 25,
        escalationRate: 10
    },
    HUMANITARIAN: {
        titleTemplate: 'Humanitarian Crisis',
        descriptionTemplate: 'A humanitarian disaster in {target} threatens regional stability.',
        baseWarRisk: 10,
        escalationRate: 5
    },
    PROXY_WAR: {
        titleTemplate: 'Proxy Conflict',
        descriptionTemplate: '{initiator} is accused of arming rebel groups in {target}.',
        baseWarRisk: 35,
        escalationRate: 15
    },
    TRADE_WAR: {
        titleTemplate: 'Trade War',
        descriptionTemplate: 'Economic tensions between {initiator} and {target} are escalating.',
        baseWarRisk: 5,
        escalationRate: 5
    },
    HOSTAGE_SITUATION: {
        titleTemplate: 'Embassy Siege',
        descriptionTemplate: 'The embassy of {target} in {initiator} has been seized by militants.',
        baseWarRisk: 40,
        escalationRate: 25
    },
    ENVIRONMENTAL: {
        titleTemplate: 'Environmental Dispute',
        descriptionTemplate: 'Industrial pollution from {initiator} is affecting {target}.',
        baseWarRisk: 5,
        escalationRate: 3
    }
}

// =============================================================================
// SUMMIT SYSTEM
// =============================================================================

export type SummitType = 'BILATERAL' | 'REGIONAL' | 'GLOBAL'

export type SummitTopic =
    | 'PEACE_TREATY'         // End war, set terms
    | 'TERRITORIAL'          // Resolve border disputes
    | 'TRADE_DEAL'           // Economic agreement
    | 'ALLIANCE'             // Form military alliance
    | 'CRISIS_RESOLUTION'    // End ongoing crisis
    | 'COALITION_FORMATION'  // Create new coalition
    | 'ARMS_REDUCTION'       // Reduce military

export type SummitOutcomeType = 'AGREEMENT' | 'BREAKDOWN' | 'PARTIAL' | 'POSTPONED'

export interface SummitProposal {
    topic: SummitTopic
    terms: string[]          // Specific conditions
    offeredBy: string
    acceptedBy?: string
}

export interface Summit {
    id: string
    type: SummitType
    title: string
    participants: string[]
    host: string             // Who's hosting
    scheduledFor: number     // Game timestamp
    topics: SummitTopic[]
    proposals: SummitProposal[]
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'CONCLUDED'
    outcome?: SummitOutcome
}

export interface SummitOutcome {
    type: SummitOutcomeType
    agreements: {
        topic: SummitTopic
        signatories: string[]
        terms: string[]
        effects: SummitEffect[]
    }[]
    failedTopics: SummitTopic[]
    relationChanges: { country: string, delta: number }[]
}

export interface SummitEffect {
    type: 'AGREEMENT' | 'TERRITORY_TRANSFER' | 'ALLIANCE' | 'TRADE' | 'MODIFIER'
    targetCountry?: string
    value?: number
    duration?: number
    details?: string
}

// =============================================================================
// INTERNATIONAL INCIDENTS
// =============================================================================

export type IncidentType =
    | 'MILITARY_ACCIDENT'    // Unintentional fire
    | 'DIPLOMARIC_GAFFE'     // Insult or mistake
    | 'SPY_CAUGHT'           // Espionage revealed
    | 'REFUGEE_WAVE'         // Migration crisis
    | 'CYBER_ATTACK'         // Digital warfare
    | 'TRADE_VIOLATION'      // Illegal trade practices
    | 'CULTURAL_OFFENSE'     // Religious/cultural insult
    | 'JOURNALIST_DETAINED'  // Press freedom issue

export interface InternationalIncident {
    id: string
    type: IncidentType
    title: string
    description: string
    involvedCountries: string[]
    severity: 1 | 2 | 3      // Minor, Major, Critical
    occurredAt: number
    resolved: boolean
    canTriggerCrisis: boolean
    relatedCrisisId?: string
}

// =============================================================================
// AI DIPLOMATIC PREFERENCES
// =============================================================================

export interface AIDiplomaticProfile {
    // UN Voting tendencies
    votesWithAllies: number      // 0-100, how likely to follow allies
    supportsInterventions: number // 0-100, humanitarian interventions
    opposesGreatPowers: number   // 0-100, anti-hegemony stance

    // Crisis behavior
    brinksmanship: number        // 0-100, willingness to escalate
    seeksMediation: number       // 0-100, prefers negotiation

    // Soft power usage
    prefersCovertAction: number  // 0-100
    usesEconomicLeverage: number // 0-100
}

/**
 * Generate diplomatic profile from AICountry data
 */
export function generateDiplomaticProfile(country: AICountry): AIDiplomaticProfile {
    const orientation = country.politicalState?.orientation || 0
    const aggression = country.aggression || 3
    const freedom = country.politicalState?.freedom || 3

    return {
        votesWithAllies: 50 + (country.allies.length * 5),
        supportsInterventions: freedom * 15,
        opposesGreatPowers: orientation < -30 ? 70 : orientation > 30 ? 30 : 50,
        brinksmanship: aggression * 15,
        seeksMediation: (6 - aggression) * 15,
        prefersCovertAction: (5 - freedom) * 20,
        usesEconomicLeverage: country.economy > 50 ? 70 : 30
    }
}
