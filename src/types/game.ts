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
export type BuildingType = 'FORT' | 'TRAINING_CAMP' | 'UNIVERSITY'

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

    // Diplomacy
    agreements: Agreement[]
    tariff: TariffStatus // Tariff player imposes on them
    theirTariff: TariffStatus // Tariff they impose on player
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
}
