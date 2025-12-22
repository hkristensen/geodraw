// Diplomatic Event Types
export type DiplomaticEventType =
    | 'LANDLOCK_WARNING'
    | 'CAPITAL_CAPTURED'
    | 'CULTURE_SPLIT'
    | 'RESOURCE_SEIZURE'
    | 'BORDER_TENSION'
    | 'GREAT_POWER_RISE'
    | 'REVANCHISM'
    | 'WAR_DECLARED'
    | 'PEACE_OFFERED'
    | 'ALLIANCE_PROPOSED'
    | 'TERRITORY_DEMANDED'
    | 'ANNEXATION'
    | 'PEACE_TREATY'
    | 'INSURGENCY'
    | 'LIBERATION'
    | 'ALLIANCE'
    | 'DIPLOMACY'

export interface DiplomaticEvent {
    id: string
    type: DiplomaticEventType
    severity: 1 | 2 | 3 // 1 = minor, 2 = major, 3 = critical
    title: string
    description: string
    affectedNations: string[]
    timestamp: number
}

// City data from Natural Earth
export interface City {
    name: string
    countryCode: string
    countryName: string
    population: number
    isCapital: boolean
    coordinates: [number, number] // [lng, lat]
}

export interface CapturedCity extends City {
    capturedAt: number
}

// Country modifiers
export type ModifierType =
    | 'REVANCHISM'    // +100% aggression when capital captured
    | 'LANDLOCKED'    // Lost sea access
    | 'PARTITIONED'   // Country split in two
    | 'HUMILIATED'    // Lost >50% territory
    | 'AT_WAR'        // Currently at war
    | 'ALLIED'        // Allied with player
    | 'DESTABILIZED'  // Weakened by player actions
    | 'PROPAGANDA_CAMPAIGN' // Influenced by player propaganda
    | 'UNREST'        // Internal instability
    | 'LIBERATED'     // Recently un-annexed
    | 'ANNEXED'       // Fully annexed (internal use)
    | 'STABILITY'     // General stability
    | 'ECONOMIC_DEPRESSION' // Reduced income
    | 'ECONOMIC_BOOM' // Increased income
    | 'DEFENSE_BONUS' // Military defense bonus
    | 'MILITARY_QUALITY' // Better troops
    | 'MILITARY_QUANTITY' // More troops
    | 'PLAGUE'        // Population/Economy loss
    | 'TRADE_BOOST'   // Increased trade income
    | 'CULTURAL_BOOM' // Prestige/Influence boost
    | 'CORRUPTION'    // Budget loss/inefficiency
    | 'RESEARCH_BOOST' // Tech/Development boost
    | 'POPULATION_BOOM' // Growth boost

export interface CountryModifier {
    id: string
    countryCode: string
    countryName: string
    type: ModifierType
    intensity: number // 0-100
    duration: number // Months remaining
    description: string
}

// Constitution - the identity of the nation
export interface Constitution {
    language: string
    culture: string
    religion: string
}

// Political System Types
export type PoliticalOrientation = number // -100 (far left) to +100 (far right)

export type GovernmentType =
    | 'DEMOCRACY'
    | 'PARLIAMENTARY'
    | 'PRESIDENTIAL'
    | 'SEMI_PRESIDENTIAL'
    | 'CONSTITUTIONAL_MONARCHY'
    | 'ABSOLUTE_MONARCHY'
    | 'AUTHORITARIAN'
    | 'MILITARY_JUNTA'
    | 'THEOCRACY'
    | 'COMMUNIST'
    | 'ONE_PARTY'
    | 'TRANSITIONAL'

export interface Leader {
    name: string
    title: string  // President, Prime Minister, King, etc.
    orientation: PoliticalOrientation
    popularity: number  // 1-5
    inOfficeSince: number
}

export interface PoliticalState {
    government: GovernmentType
    govType: GovernmentType // Alias for compatibility
    orientation: PoliticalOrientation
    leader: Leader | string // Allow string for compatibility
    policies: string[]
    nextElection?: number  // Game timestamp
    stability: number  // 0-100
    // Properties from geopolitical data
    unrest: number // 1-5
    leader_pop: number // Leader popularity 1-5
    freedom: number // Political freedom 1-5
    military: number // Military strength 1-5
    aggression: number // Aggressiveness 1-5
}

export type CoalitionType = 'MILITARY' | 'TRADE' | 'RESEARCH'

export interface Coalition {
    id: string
    name: string
    type: CoalitionType
    members: string[] // ISO3 codes
    leader: string // ISO3 code of leader/founder
    color: string
    created: number
    icon: string
    requirements?: {
        // Cultural/Religious requirements
        religion?: string
        culture?: string

        // Minimum relations with all members (-100 to 100)
        minRelations?: number

        // MILITARY-specific
        minMilitaryBudgetPercent?: number  // 0-100
        defenseContributionPercent?: number // % of army committed to collective defense

        // TRADE-specific  
        fixedTariffLevel?: TariffStatus  // Tariff between members

        // RESEARCH-specific
        minResearchBudgetPercent?: number  // 0-100
    }
}

export interface CoalitionInvite {
    id: string
    coalitionId: string
    targetCountry: string
    expires: number
}

// Game Settings for new game
export interface GameSettings {
    expansionPoints: number
    startMode: 'FREEFORM' | 'EXISTING_COUNTRY'
    startingCountry?: string  // ISO3 code if existing country
    enableRealCoalitions: boolean
    enableElections: boolean
    difficulty: 'EASY' | 'NORMAL' | 'HARD'
}

// Available options for constitution
export const LANGUAGES = [
    'English', 'French', 'German', 'Spanish', 'Italian',
    'Russian', 'Arabic', 'Mandarin', 'Japanese', 'Portuguese',
    'Dutch', 'Polish', 'Turkish', 'Swedish', 'Greek'
] as const

export const CULTURES = [
    'Western European', 'Eastern European', 'Nordic', 'Mediterranean',
    'Slavic', 'Middle Eastern', 'East Asian', 'South Asian',
    'African', 'Latin American', 'Anglo-Saxon', 'Germanic'
] as const

export const RELIGIONS = [
    'Secular State', 'Christianity', 'Islam', 'Buddhism',
    'Hinduism', 'Judaism', 'Orthodox Christianity', 'Protestantism',
    'Catholicism', 'Atheist State'
] as const

// Nation statistics derived from conquered lands
export interface NationStats {
    wealth: number           // Economic power (from area + cities)
    defence: number          // Defensive military capability
    diplomaticPower: number  // Influence in negotiations
    manpower: number         // Total available military personnel
    soldiers: number         // Current active soldiers
    power: number            // Unified Power Score (Military + Economy + Authority)

    // Economy
    budget: number           // Current treasury
    taxRate: number          // 0-100 percentage

    // Budget Allocation (0-100 sliders)
    budgetAllocation: Budget

    gdpPerCapita: number     // Derived from captured territory
    tradeIncome: number      // Calculated from ports/airports
    taxIncome: number        // Calculated from population * GDP * taxRate
    expenses: number         // Calculated from soldiers * cost
}

export interface Budget {
    social: number       // Improves stability, happiness
    military: number     // Improves defence, recruitment
    infrastructure: number // Improves trade, growth
    research: number     // Improves tech/efficiency
}



// Flag definitions
export type FlagPattern = 'tricolor-v' | 'tricolor-h' | 'cross' | 'saltire' | 'circle' | 'checkered'
export interface FlagData {
    pattern: FlagPattern
    colors: [string, string, string] // Primary, Secondary, Emblem/Detail
}

// Building Types
export type BuildingType = 'FORT' | 'TRAINING_CAMP' | 'UNIVERSITY' | 'RESEARCH_LAB' | 'TEMPLE' | 'FACTORY' | 'MARKET' | 'HOSPITAL'

// Research Types
export type ResearchCategory = 'MILITARY' | 'ECONOMY' | 'CIVIC'

export interface ResearchTech {
    id: string
    name: string
    description: string
    category: ResearchCategory
    cost: number
    prerequisites?: string[]
    effects: {
        type: ModifierType
        value: number
    }[]
}

// Policy Types
export type PolicyCategory = 'RELIGION' | 'CULTURE' | 'CONSCRIPTION' | 'TAXATION' | 'FREE_SPEECH'

export interface Policy {
    id: string
    name: string
    description: string
    category: PolicyCategory
    unrestImpact: number // Immediate unrest change
    monthlyUnrestChange: number // Long-term unrest effect
    effects: {
        type: ModifierType
        value: number
    }[]
}

// Faction Types
export interface Faction {
    id: string
    name: string
    type: 'SEPARATIST' | 'REVOLUTIONARY' | 'RELIGIOUS'
    strength: number // 0-100
    location: [number, number] // Center of activity
    active: boolean
}

export interface Building {
    id: string
    type: BuildingType
    location: [number, number] // [lng, lat]
    constructedAt: number
}

// Nation (player's created country)
export interface Nation {
    name: string
    flag: FlagData
    capital: {
        name: string
        coordinates: [number, number]
    } | null
    constitution: Constitution
    foundedAt: number
    stats: NationStats
    buildings: Building[]
    // Military
    units: MilitaryUnit[]
    warPlans: BattlePlan[]
}

// AI Country state
export type Disposition = 'friendly' | 'neutral' | 'hostile' | 'at_war'

export type ReligionType =
    | 'Christian'
    | 'Muslim'
    | 'Hindu'
    | 'Buddhist'
    | 'Jewish'
    | 'Folk'
    | 'Other'
    | 'Unaffiliated'

export type AgreementType =
    | 'TRADE_AGREEMENT'
    | 'NON_AGGRESSION'
    | 'MILITARY_ALLIANCE'
    | 'SECURITY_GUARANTEE'
    | 'FREE_TRADE'

export interface Agreement {
    id: string
    type: AgreementType
    targetCountry: string // The other party
    signedAt: number
}

export type TariffStatus = 'FREE_TRADE' | 'NONE' | 'LOW' | 'HIGH' | 'EMBARGO'

export interface AICountry {
    code: string
    name: string
    disposition: Disposition
    relations: number // -100 (enemy) to +100 (ally)
    territoryLost: number // Percentage lost to player
    claimedPercentage: number // 0-100% (Claimed by player but not yet occupied)
    population: number
    power: number
    soldiers: number
    economy: number // 0-100 scale from GNI
    authority: number // 0-100 (higher = more authoritarian)
    religion: ReligionType
    culture: string
    language: string
    modifiers: ModifierType[]
    isAtWar: boolean
    isAnnexed?: boolean
    warDeclaredAt?: number
    units: MilitaryUnit[]

    // Political State
    politicalState?: PoliticalState
    allies: string[]       // ISO3 codes from geopolitical data
    enemies: string[]      // ISO3 codes from geopolitical data
    tradePartners: string[] // ISO3 codes
    aggression: number     // 1-5 from geopolitical data

    // Diplomacy
    agreements: Agreement[]
    tariff: TariffStatus // Tariff player imposes on them
    theirTariff: TariffStatus // Tariff they impose on player

    // AI Strategy (Phase 1 enhancements)
    strategyState?: AIStrategyState
    warGoal?: WarGoal  // Current war goal if at war
}

// =============================================================================
// AI STRATEGY SYSTEM
// =============================================================================

// AI Personality Types (randomized per game, weighted by country data)
export type AIPersonality =
    | 'EXPANSIONIST'    // Seeks territory, aggressive claims
    | 'DEFENSIVE'       // Alliance-building, status quo
    | 'TRADING_POWER'   // Economic influence focus
    | 'IDEOLOGICAL'     // Spread their government type
    | 'OPPORTUNIST'     // Exploit weak neighbors when safe
    | 'ISOLATIONIST'    // Minimal intervention, self-defense

// Strategic Focus (changes based on situation)
export type StrategicFocus =
    | 'EXPAND'       // Pursuing territorial gains
    | 'DEFEND'       // Responding to threats
    | 'DEVELOP'      // Building economy/research
    | 'CONSOLIDATE'  // Stabilizing after gains
    | 'ALLY'         // Building coalitions/alliances

// Threat/Opportunity assessment
export interface ThreatAssessment {
    militaryThreats: number    // 0-100 (hostile neighbors, claims against us)
    economicThreats: number    // 0-100 (sanctions, trade war)
    internalThreats: number    // 0-100 (unrest, coup risk)
    totalThreat: number        // Weighted average
}

export interface OpportunityAssessment {
    weakNeighbors: string[]          // Countries we could attack
    allianceGaps: string[]           // Potential allies not yet allied
    tradeOpportunities: string[]     // Potential trade partners
    bestOpportunity: 'EXPAND' | 'ALLY' | 'TRADE' | 'NONE'
}

// Strategic Action (queued by AI)
export interface StrategicAction {
    type: 'DECLARE_WAR' | 'PROPOSE_ALLIANCE' | 'IMPROVE_RELATIONS' |
    'TRADE_AGREEMENT' | 'BUILD_MILITARY' | 'ECONOMIC_FOCUS' |
    'JOIN_COALITION' | 'SANCTION' | 'DEMAND_TERRITORY'
    targetCode?: string     // Target country if applicable
    priority: number        // 1-10, higher = more urgent
    reasoning: string       // Why this action was chosen
}

// AI Strategy State (attached to AICountry)
export interface AIStrategyState {
    personality: AIPersonality
    currentFocus: StrategicFocus
    threatLevel: ThreatAssessment
    opportunities: OpportunityAssessment
    actionQueue: StrategicAction[]
    lastAssessment: number  // Timestamp
    longTermGoal?: string   // Description of multi-year goal
}

// =============================================================================
// WAR GOAL SYSTEM
// =============================================================================

export type WarGoalType =
    | 'DEFENSIVE'        // We were attacked
    | 'TERRITORIAL'      // Claim specific territory
    | 'RECONQUEST'       // Retake lost territory
    | 'REGIME_CHANGE'    // Replace their government
    | 'HUMILIATION'      // Reduce their power/prestige
    | 'LIBERATION'       // Free occupied territories
    | 'AGGRESSION'       // No specific casus belli

export interface WarGoal {
    type: WarGoalType
    targetCountry: string
    targetTerritory?: string  // For territorial claims
    legitimacy: number        // -50 to +20
    description: string
}

// Legitimacy impacts
export const WAR_GOAL_LEGITIMACY: Record<WarGoalType, number> = {
    'DEFENSIVE': 20,
    'RECONQUEST': 10,
    'TERRITORIAL': 0,
    'LIBERATION': 10,
    'REGIME_CHANGE': -20,
    'HUMILIATION': -30,
    'AGGRESSION': -50
}

// Diplomatic actions player can take
export type DiplomaticAction =
    | 'PROPOSE_ALLIANCE'
    | 'IMPROVE_RELATIONS'
    | 'DEMAND_TERRITORY'
    | 'DECLARE_WAR'
    | 'OFFER_PEACE'
    | 'SEND_AID'
    | 'RETURN_TERRITORY'

// Game phase
export type GamePhase =
    | 'SETUP'       // New setup screen
    | 'DRAWING'       // Player is drawing initial territory
    | 'CALCULATING'   // Processing results
    | 'ANALYSIS'      // Showing territory analysis modal
    | 'CONSTITUTION'  // Naming the nation
    | 'RESULTS'       // Normal gameplay (borders locked, use diplomacy)
    | 'EXPANSION'     // Drawing an expansion claim

// Expansion claim status
export type ExpansionClaimStatus =
    | 'pending'       // Just drawn, needs resolution
    | 'negotiating'   // In negotiation
    | 'war'           // War declared for this territory
    | 'claimed'       // Passive claim active on map
    | 'resolved'      // Claim resolved (success or failure)

// An expansion claim drawn by the player
export interface ExpansionClaim {
    id: string
    polygon: GeoJSON.Feature
    targetCountries: Array<{
        code: string
        name: string
        areaClaimedKm2: number
        percentageClaimed: number
    }>
    status: ExpansionClaimStatus
    createdAt: number
}

// Resolution method for expansion
export type ExpansionResolutionMethod =
    | 'NEGOTIATE'  // Peaceful, requires good relations
    | 'DEMAND'     // Aggressive, requires power advantage
    | 'WAR'        // Military, power comparison with random factor

import { WarResult, BattleIntensity } from '../utils/warSystem'
import type { FeatureCollection, LineString } from 'geojson'

// Military Units
export type UnitType = 'INFANTRY' | 'ARMOR' | 'SPECIAL_FORCES' | 'DEFENSE' | 'MILITIA'
export type UnitStatus = 'IDLE' | 'DEFENDING' | 'ATTACKING' | 'TRAINING' | 'MOVING'

export interface MilitaryUnit {
    id: string
    name: string
    type: UnitType
    soldiers: number
    experience: number // 0-100, affects combat performance
    morale: number // 0-100
    location: [number, number] // Coordinates (City or central point of region)
    status: UnitStatus
    assignedPlanId?: string // If attached to a war plan
    stats: {
        attack: number
        defense: number
        mobility: number
    }
}

export interface BattlePlan {
    id: string
    name: string
    targetCountry: string
    assignedUnitIds: string[]
    arrows: FeatureCollection<LineString>
    createdAt: number
}

export interface ActiveBattle {
    id: string
    attackerCode: string
    attackerName: string
    defenderCode: string
    defenderName: string
    initialAttackerSoldiers: number
    initialDefenderSoldiers: number
    intensity: BattleIntensity
    startTime: number // Timestamp when battle started
    result: WarResult // Pre-calculated result
    isPlayerAttacker: boolean
    isPlayerDefender: boolean
    claimId?: string // If fighting for a specific claim
    location?: [number, number] // Coordinates for map display
    plan?: BattlePlan // Optional battle plan
}

// AI vs AI War
export interface AIWar {
    id: string
    attackerCode: string
    defenderCode: string
    startTime: number
    lastBattleTime: number
    status: 'active' | 'peace'
    // Track territory changes
    attackerGain: number // % of defender territory taken
    defenderGain: number // % of attacker territory taken

    // Detailed Simulation
    planArrow?: GeoJSON.Feature<GeoJSON.LineString>
    casualties: {
        attacker: number
        defender: number
    }
}
