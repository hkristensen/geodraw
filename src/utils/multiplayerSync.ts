/**
 * Multiplayer Sync Module
 * 
 * Provides serialization utilities, state versioning, and sync preparation
 * for future multiplayer integration.
 * 
 * Key considerations:
 * - Map<string, T> must be converted to Record<string, T> for JSON
 * - GeoJSON features are already JSON-compatible
 * - All state changes need timestamps for conflict resolution
 * - Turn-batch processing ensures deterministic state updates
 */

// =============================================================================
// STATE VERSION
// =============================================================================

export const STATE_VERSION = '1.0.0'

export interface StateMetadata {
    version: string
    gameId: string
    timestamp: number
    turnNumber: number
    checksum?: string
}

// =============================================================================
// SERIALIZATION HELPERS
// =============================================================================

/**
 * Convert a Map to a JSON-safe Record
 */
export function mapToRecord<K extends string, V>(map: Map<K, V>): Record<K, V> {
    const record = {} as Record<K, V>
    for (const [key, value] of map) {
        record[key] = value
    }
    return record
}

/**
 * Convert a Record back to a Map
 */
export function recordToMap<K extends string, V>(record: Record<K, V>): Map<K, V> {
    return new Map(Object.entries(record) as [K, V][])
}

/**
 * Deep clone with Map handling
 */
export function deepCloneState<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Map) {
        const newMap = new Map()
        for (const [k, v] of obj) {
            newMap.set(k, deepCloneState(v))
        }
        return newMap as unknown as T
    }
    if (obj instanceof Set) {
        return new Set([...obj].map(deepCloneState)) as unknown as T
    }
    if (Array.isArray(obj)) {
        return obj.map(deepCloneState) as unknown as T
    }
    const cloned = {} as T
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepCloneState(obj[key])
        }
    }
    return cloned
}

// =============================================================================
// SERIALIZABLE STATE TYPES
// =============================================================================

/**
 * Game state prepared for JSON serialization
 */
export interface SerializableGameState {
    metadata: StateMetadata
    phase: string
    gameDate: number
    nation: any | null
    playerTerritories: GeoJSON.Feature[]
    consequences: any[]
    capturedCities: any[]
    diplomaticEvents: any[]
    modifiers: string[]
    activeClaims: any[]
    annexedCountries: string[]
    gameSettings: any
    researchPoints: number
    unlockedTechs: string[]
    activePolicies: string[]
    unrest: number
    factions: any[]
}

/**
 * World state prepared for JSON serialization
 */
export interface SerializableWorldState {
    metadata: StateMetadata
    aiCountries: Record<string, any>     // Map converted to Record
    aiTerritories: Record<string, any>   // Map converted to Record
    aiWars: any[]
    activeWars: string[]
    allies: string[]
    coalitions: any[]
    coalitionInvites: any[]
}

/**
 * Combined game snapshot for save/load/sync
 */
export interface GameSnapshot {
    game: SerializableGameState
    world: SerializableWorldState
    timestamp: number
}

// =============================================================================
// SYNC ACTION TYPES
// =============================================================================

export type SyncActionType =
    | 'PLAYER_MOVE'
    | 'DIPLOMACY'
    | 'WAR_DECLARATION'
    | 'PEACE_TREATY'
    | 'TERRITORY_CHANGE'
    | 'TURN_END'

export interface SyncAction {
    type: SyncActionType
    playerId: string
    timestamp: number
    turnNumber: number
    payload: any
    signature?: string  // For validation
}

/**
 * Turn batch - all actions in a single turn
 * Used for deterministic replay
 */
export interface TurnBatch {
    turnNumber: number
    startTimestamp: number
    endTimestamp: number
    actions: SyncAction[]
    resultingChecksum: string
}

// =============================================================================
// SYNC UTILITIES
// =============================================================================

/**
 * Generate a simple checksum for state validation
 */
export function generateChecksum(data: object): string {
    const json = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < json.length; i++) {
        const char = json.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * Create state metadata
 */
export function createMetadata(gameId: string, turnNumber: number): StateMetadata {
    return {
        version: STATE_VERSION,
        gameId,
        timestamp: Date.now(),
        turnNumber
    }
}

/**
 * Validate state version compatibility
 */
export function isVersionCompatible(version: string): boolean {
    const [major, minor] = version.split('.').map(Number)
    const [currentMajor, currentMinor] = STATE_VERSION.split('.').map(Number)

    // Must match major version, minor can be lower
    return major === currentMajor && minor <= currentMinor
}

// =============================================================================
// STATE TIMESTAMP TRACKING
// =============================================================================

/**
 * Timestamped state change for conflict resolution
 */
export interface TimestampedChange {
    field: string
    value: any
    timestamp: number
    playerId: string
}

/**
 * Merge changes using last-write-wins strategy
 */
export function mergeChanges(
    base: Record<string, any>,
    changes: TimestampedChange[]
): Record<string, any> {
    // Sort by timestamp (oldest first)
    const sorted = [...changes].sort((a, b) => a.timestamp - b.timestamp)

    const result = { ...base }
    for (const change of sorted) {
        result[change.field] = change.value
    }
    return result
}

// =============================================================================
// DOCUMENTATION
// =============================================================================

/**
 * MULTIPLAYER SYNC REQUIREMENTS
 * 
 * 1. STATE SERIALIZATION
 *    - All Map<K,V> → Record<K,V> before JSON stringify
 *    - GeoJSON.Feature is already JSON-compatible
 *    - Functions must be excluded from serialization
 * 
 * 2. TURN-BASED PROCESSING
 *    - All player actions batched per turn
 *    - Turn ends trigger: processAITurn(), advanceDate()
 *    - Deterministic: same inputs = same outputs
 * 
 * 3. CONFLICT RESOLUTION
 *    - Last-write-wins for simple fields
 *    - Territory claims need special merge logic
 *    - War declarations are non-reversible per turn
 * 
 * 4. STATE SYNC FLOW
 *    Host → Broadcast TurnBatch → Clients apply → Verify checksum
 * 
 * 5. FIELDS REQUIRING SPECIAL HANDLING
 *    - aiCountries: Map to Record conversion
 *    - aiTerritories: Map to Record conversion
 *    - playerTerritories: GeoJSON merge conflicts possible
 *    - activeWars/allies: Set-like behavior needed
 * 
 * 6. RECOMMENDED ARCHITECTURE
 *    - Host authoritative model (host validates all actions)
 *    - Client prediction for responsiveness
 *    - Rollback on mismatch
 */
