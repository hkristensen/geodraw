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
    GameSettings,
    TariffStatus,
    AIWar,
    AgreementType,
    Constitution,
    Coalition,
    CoalitionType,
    CoalitionInvite
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
    isDrawing: boolean

    // New Systems
    researchPoints: number
    unlockedTechs: string[]
    activePolicies: string[]
    unrest: number // 0-100
    factions: import('./game').Faction[]
    infrastructureLoaded: boolean

    // Economic Cycle (global economy state)
    economicCycle: import('../utils/economy').EconomicCycleState | null

    // Victory System
    victoriesAchieved: import('../utils/victorySystem').VictoryType[]
    consecutiveMonthsAsTopPower: number
    consecutiveMonthsAsTopGDP: number
    achievementsUnlocked: string[]

    // War Exhaustion Tracking
    totalWarCasualties: number
    monthsAtWar: number

    // Game settings (from setup screen)
    gameSettings: GameSettings | null
    selectedCountryName: string | null // For pre-filling nation name


    // Actions
    setPhase: (phase: GamePhase) => void
    setGameSettings: (settings: GameSettings) => void
    setSelectedCountryName: (name: string | null) => void
    setIsDrawing: (isDrawing: boolean) => void
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
        defenseBonus?: number,
        plan?: import('./game').BattlePlan
    ) => void
    dismissBattle: (id: string) => void
    triggerEvent: (event: RandomEvent) => void
    resolveEvent: () => void

    // New System Actions
    addResearchPoints: (amount: number) => void
    unlockTech: (techId: string) => void
    enactPolicy: (policyId: string) => void
    revokePolicy: (policyId: string) => void
    updateUnrest: (delta: number) => void
    addFaction: (faction: import('./game').Faction) => void
    updateFaction: (id: string, updates: Partial<import('./game').Faction>) => void
    removeFaction: (id: string) => void
    setInfrastructureLoaded: (loaded: boolean) => void

    // Military Actions
    createUnit: (type: import('./game').UnitType, soldierCount?: number, source?: 'DRAFT' | 'HIRE') => void
    updateUnit: (unitId: string, updates: Partial<import('./game').MilitaryUnit>) => void
    deleteUnit: (unitId: string) => void
    transferSoldiers: (sourceUnitId: string, targetUnitId: string, amount: number) => void
    recallUnit: (unitId: string) => void
    saveWarPlan: (plan: import('./game').BattlePlan) => void
    deleteWarPlan: (planId: string) => void
    executeWarPlan: (planId: string) => void
}

// --- World Store Types ---

export interface WorldState {
    // AI-controlled countries
    aiCountries: Map<string, AICountry>

    // Dynamic country territories (polygons that can change)
    aiTerritories: Map<string, GeoJSON.Feature>

    // Contested zones during active wars (red-ish territory, merged on peace)
    contestedZones: Map<string, GeoJSON.Feature> // keyed by warId

    // AI vs AI wars
    aiWars: AIWar[]

    // Active wars (with player)
    activeWars: string[] // Country codes at war with player

    // Alliances
    allies: string[] // Country codes allied with player

    // === ADVANCED DIPLOMACY STATE ===
    // United Nations
    unitedNations: import('../types/diplomaticTypes').UNState | null

    // Active diplomatic crises
    activeCrises: import('../types/diplomaticTypes').DiplomaticCrisis[]

    // Player soft power state
    softPowerState: import('../types/diplomaticTypes').SoftPowerState | null

    // Pending/active summit
    activeSummit: import('../types/diplomaticTypes').Summit | null

    // Diplomacy message log (for UI)
    diplomacyMessages: string[]

    // Initialize AI countries from consequences
    initializeAICountries: (consequences: Consequence[], playerConstitution?: Constitution, allCountries?: any) => void

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

    // Process AI turn (reactions to player)
    processAITurn: () => { events: string[], wars: string[], offensives: { countryCode: string, strength: number }[] }

    // Process AI vs AI wars
    processAIvsAI: () => { events: Array<{ type: string, attackerCode: string, defenderCode: string }>, wars: AIWar[] }

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
    annexCountry: (countryCode: string, annexerCode?: string) => void

    // Ensure country is initialized (for interaction)
    ensureCountryInitialized: (countryCode: string, playerConstitution?: Constitution) => void

    // Process elections, coups, and revolutions monthly
    processElections: () => void

    // Liberate country
    liberateCountry: (countryCode: string) => void

    // Destabilize (Hostile Action)
    destabilizeCountry: (countryCode: string) => void

    // Propaganda (Hostile Action)
    plantPropaganda: (countryCode: string) => void

    // Request Support (Alliance Action)
    requestSupport: (countryCode: string) => number // returns soldiers sent

    // Coalitions
    coalitions: Coalition[]
    coalitionInvites: CoalitionInvite[]
    coalitionsInitialized: boolean
    createCoalition: (name: string, type: CoalitionType, requirements?: Coalition['requirements']) => void
    joinCoalition: (coalitionId: string) => void
    requestJoinCoalition: (coalitionId: string) => void
    leaveCoalition: (coalitionId: string) => void
    inviteToCoalition: (coalitionId: string, countryCode: string) => void
    kickFromCoalition: (coalitionId: string, countryCode: string) => void
    processCoalitions: () => void // Monthly processing

    // Update soldiers for a country
    updateCountrySoldiers: (countryCode: string, delta: number) => void

    // Article 5: Collective Defense
    triggerAllianceResponse: (defenderCode: string, attackerCode: string) => void

    // Surrender to valid coalition
    surrenderToCoalition: (coalitionId: string, surrenderingCountryCode: string) => void

    // === ADVANCED DIPLOMACY ACTIONS ===

    // UN Actions
    initializeDiplomacy: () => void
    voteOnResolution: (resolutionId: string, vote: 'YES' | 'NO' | 'ABSTAIN') => void
    proposeResolution: (type: import('../types/diplomaticTypes').ResolutionType, targetCountry?: string) => void

    // Crisis Actions
    respondToCrisis: (crisisId: string, action: import('../types/diplomaticTypes').CrisisAction) => void

    // Soft Power Actions
    executeInfluenceAction: (actionType: import('../types/diplomaticTypes').InfluenceActionType, targetCountry: string) => boolean

    // Summit Actions
    proposeSummit: (targetCountry: string, topics: import('../types/diplomaticTypes').SummitTopic[]) => boolean
    respondToSummitProposal: (accept: boolean, topicResponses?: Map<import('../types/diplomaticTypes').SummitTopic, boolean>) => void

    // Process all diplomacy systems monthly
    processDiplomacy: () => string[]

    // Clear diplomacy messages
    clearDiplomacyMessages: () => void

    // Reset state
    reset: () => void
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
