import {
    GamePhase,
    Nation,
    ExpansionClaim,
    CapturedCity,
    DiplomaticEvent,
    CountryModifier,
    ActiveBattle,
    Building,
    BuildingType,
    NationStats,
    AICountry,
    Disposition,

    TariffStatus,
    AgreementType,
    Constitution
} from './game'
import { InfrastructureStats } from '../utils/infrastructure'

// --- Game Store Types ---

export interface Consequence {
    countryName: string
    countryCode: string
    lostPercentage: number
    lostArea: number // in km²
    population: number
    populationCaptured: number
}

export interface PendingInvasion {
    code: string
    name: string
    feature: GeoJSON.Feature
}

export interface GameState {
    // Game phase
    phase: GamePhase

    // User's initial drawn polygon
    userPolygon: GeoJSON.Feature | null

    // All player-controlled territories (merged into one polygon)
    playerTerritories: GeoJSON.Feature[]

    // Calculated consequences from country overlaps
    consequences: Consequence[]

    // Captured cities (Heart System)
    capturedCities: CapturedCity[]

    // Diplomatic events and modifiers
    diplomaticEvents: DiplomaticEvent[]
    modifiers: CountryModifier[]

    // Player's nation (after Constitution phase)
    nation: Nation | null

    // Current expansion claim being processed
    currentClaim: ExpansionClaim | null

    // Pending invasion (waiting for War Modal)
    pendingInvasion: PendingInvasion | null

    // Selected country code (for map click interaction)
    selectedCountry: string | null

    // Countries fully annexed (100% conquered)
    annexedCountries: string[]

    // Active claims (visible on map)
    activeClaims: ExpansionClaim[]

    // UI state
    isCalculating: boolean
    showResults: boolean

    // Infrastructure stats for budget calculation
    infrastructureStats: InfrastructureStats | null

    // Game Date (starts at Jan 1, 2025)
    gameDate: number

    // Building Mode
    buildingMode: BuildingType | null

    // Selected Claim ID (for modal)
    selectedClaimId: string | null

    // Active Battles (on map)
    activeBattles: ActiveBattle[]

    // Current Random Event
    currentEvent: RandomEvent | null

    // Game Over State
    gameOver: boolean

    // Actions
    setPhase: (phase: GamePhase) => void
    setUserPolygon: (polygon: GeoJSON.Feature | null) => void
    addTerritory: (territory: GeoJSON.Feature) => void
    setConsequences: (consequences: Consequence[]) => void
    addConsequences: (newConsequences: Consequence[]) => void
    setCapturedCities: (cities: CapturedCity[]) => void
    setInfrastructureStats: (stats: InfrastructureStats | null) => void
    addDiplomaticEvents: (events: DiplomaticEvent[]) => void
    addModifiers: (modifiers: CountryModifier[]) => void
    setNation: (nation: Nation | null) => void
    setCurrentClaim: (claim: ExpansionClaim | null) => void
    setPendingInvasion: (invasion: PendingInvasion | null) => void
    setSelectedCountry: (code: string | null) => void
    setSelectedClaim: (id: string | null) => void
    setIsCalculating: (isCalculating: boolean) => void
    updateNationSoldiers: (delta: number) => void
    updateNationStats: (stats: Partial<NationStats>) => void
    updateBudget: (amount: number) => void
    setTaxRate: (rate: number) => void
    setMilitaryBudget: (budget: number) => void
    annexCountry: (countryCode: string) => void
    addActiveClaim: (claim: ExpansionClaim) => void
    removeActiveClaim: (id: string) => void
    advanceDate: (days: number) => void
    reset: () => void
    setBuildingMode: (mode: BuildingType | null) => void
    addBuilding: (building: Building) => void
    destabilizeTarget: (claimId: string) => void
    plantPropaganda: (claimId: string) => void
    removeTerritory: (territory: GeoJSON.Feature) => void
    startBattle: (
        attackerCode: string,
        attackerName: string,
        defenderCode: string,
        defenderName: string,
        attackerSoldiers: number,
        defenderSoldiers: number,
        intensity: 'SKIRMISH' | 'BATTLE' | 'ALL_OUT_WAR', // BattleIntensity
        isPlayerAttacker: boolean,
        isPlayerDefender: boolean,
        claimId?: string,
        location?: [number, number],
        defenseBonus?: number
    ) => void
    dismissBattle: (id: string) => void
    triggerEvent: (event: RandomEvent) => void
    resolveEvent: () => void
}

// --- World Store Types ---

export interface WorldState {
    // AI-controlled countries
    aiCountries: Map<string, AICountry>

    // Active wars
    activeWars: string[] // Country codes at war with player

    // Alliances
    allies: string[] // Country codes allied with player

    // Initialize AI countries from consequences
    initializeAICountries: (consequences: Consequence[], playerConstitution?: Constitution) => void

    // Update country relations
    updateRelations: (countryCode: string, delta: number) => void

    // Change disposition
    setDisposition: (countryCode: string, disposition: Disposition) => void

    // Declare war
    declareWar: (countryCode: string) => void

    // Make peace
    makePeace: (countryCode: string) => void

    // Form alliance
    formAlliance: (countryCode: string) => void

    // Process AI turn (reactions)
    processAITurn: () => { events: string[], wars: string[], offensives: { countryCode: string, strength: number }[] }

    // Diplomacy
    proposeAgreement: (countryCode: string, type: AgreementType) => boolean
    setTariff: (countryCode: string, level: TariffStatus) => void
    breakAgreement: (countryCode: string, agreementId: string) => void

    // Update occupation/territory lost
    updateOccupation: (countryCode: string, amount: number) => void

    // Fund Separatists (Hostile Action)
    fundSeparatists: (countryCode: string) => boolean

    // Add passive claim
    addClaim: (countryCode: string, percentage: number) => void

    // Generate AI claim
    generateAIClaim: (countryCode: string) => boolean

    // Get country by code
    getCountry: (code: string) => AICountry | undefined

    // Annex country (remove from active AI)
    annexCountry: (countryCode: string) => void

    // Ensure country is initialized (for interaction)
    ensureCountryInitialized: (countryCode: string, playerConstitution?: Constitution) => void

    // Liberate country
    liberateCountry: (countryCode: string) => void

    // Destabilize (Hostile Action)
    destabilizeCountry: (countryCode: string) => void

    // Propaganda (Hostile Action)
    plantPropaganda: (countryCode: string) => void

    // Request Support (Alliance Action)
    requestSupport: (countryCode: string) => number // returns soldiers sent

    // Update soldiers for a country
    updateCountrySoldiers: (countryCode: string, delta: number) => void
}

// --- Event Types ---

export interface EventOption {
    label: string
    description: string // Tooltip or subtext explaining the effect
    effect: (gameStore: GameState, worldStore: WorldState) => void
}

export interface RandomEvent {
    id: string
    title: string
    description: string
    icon?: string // Emoji or icon
    options: EventOption[]
    condition?: (gameStore: GameState, worldStore: WorldState) => boolean // Optional trigger condition
    weight?: number // Frequency weight (default 1)
}
