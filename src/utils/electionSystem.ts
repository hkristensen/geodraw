/**
 * Election System
 * Handles elections, coups, and political regime changes for AI countries
 */

import type { AICountry, GovernmentType } from '../types/game'
import { generateLeaderName } from '../data/leaderNames'

export interface ElectionResult {
    winner: string // New leader name
    orientationChange: number // Change in political orientation
    newOrientation: number // New absolute orientation value
    popularityChange: number // Change in leader popularity
    unrestChange: number // Change in unrest
    governmentTypeChange?: GovernmentType
}

export interface CoupResult {
    newLeader: string
    newOrientation: number
    newGovType: GovernmentType
    unrestIncrease: number
    civilWarRisk: number // 0-1 probability
}

export interface RevolutionResult {
    newLeader: string
    newOrientation: number
    newGovType: GovernmentType
    unrestChange: number
    civilWar: boolean
}

/**
 * Calculate probability of election occurring this month
 * Democracies have elections every 4-5 years based on nextElection timestamp
 * Authoritarian regimes have rare sham elections
 */
export function calculateElectionChance(country: AICountry, gameDate?: number): number {
    if (!country.politicalState) return 0

    const { govType, freedom, unrest, leader_pop, nextElection } = country.politicalState
    const now = gameDate || Date.now()

    // For democracies, check if election is due
    const isDemocratic = ['PRESIDENTIAL', 'PARLIAMENTARY', 'SEMI_PRESIDENTIAL', 'CONSTITUTIONAL_MONARCHY'].includes(govType)

    if (isDemocratic && nextElection) {
        // Election is due if we've passed the scheduled date
        if (now >= nextElection) {
            return 1.0 // 100% - election happens now
        }

        // Early election can be triggered by high unrest or very low popularity
        // But only in the last year of the term
        const oneYear = 365 * 24 * 60 * 60 * 1000
        const timeUntilElection = nextElection - now

        if (timeUntilElection < oneYear) {
            // In the last year, early elections possible
            if (unrest >= 4 && leader_pop <= 2) {
                return 0.15 // 15% chance for snap election
            }
            if (unrest >= 5) {
                return 0.25 // 25% at maximum unrest
            }
        }

        return 0 // No election until scheduled time
    }

    // Non-democracies: rare sham elections
    let baseChance = 0.005 // 0.5% per month for sham elections

    switch (govType) {
        case 'AUTHORITARIAN':
        case 'MILITARY_JUNTA':
        case 'ONE_PARTY':
            baseChance = 0.008 // ~1 sham election per 10 years
            break
        case 'ABSOLUTE_MONARCHY':
        case 'THEOCRACY':
            baseChance = 0.002 // Very rare
            break
        default:
            baseChance = 0.01
    }

    // Freedom level affects whether even sham elections happen
    baseChance *= freedom / 5

    return Math.min(baseChance, 0.02) // Cap at 2% per month for non-democracies
}

/**
 * Run an election and determine the outcome
 */
export function runElection(country: AICountry): ElectionResult {
    if (!country.politicalState) {
        throw new Error('Country has no political state')
    }

    const { orientation, unrest, leader_pop, freedom } = country.politicalState

    // Determine if incumbent wins or opposition
    const incumbentAdvantage = leader_pop * 10 // 10-50 points
    const stabilityBonus = (5 - unrest) * 5 // -25 to 20 points
    const freedomFactor = freedom * 5 // 5-25 points for fair elections

    const incumbentScore = 50 + incumbentAdvantage + stabilityBonus
    const oppositionScore = 50 - incumbentAdvantage + (unrest * 10) + freedomFactor

    const incumbentWins = incumbentScore > oppositionScore

    let orientationChange = 0
    let popularityChange = 0
    let unrestChange = 0
    let governmentTypeChange: GovernmentType | undefined

    if (incumbentWins) {
        // Incumbent re-elected
        orientationChange = Math.random() * 10 - 5 // Small shift -5 to +5
        popularityChange = 1 // Slight boost
        unrestChange = -1 // Stability improves
    } else {
        // Opposition wins
        // Opposition tends to be opposite of current orientation
        const oppositionLean = orientation > 0 ? -1 : 1
        orientationChange = (Math.random() * 40 + 10) * oppositionLean // 10-50 point shift

        popularityChange = 2 // New leader popular initially
        unrestChange = -2 // Hope for change reduces unrest

        // Small chance of government type change
        if (Math.random() < 0.15) {
            governmentTypeChange = getRandomDemocraticGovType()
        }
    }

    const newOrientation = Math.max(-100, Math.min(100, orientation + orientationChange))
    const currentLeader = typeof country.politicalState.leader === 'string'
        ? country.politicalState.leader
        : country.politicalState.leader.name
    const newLeader = incumbentWins ? currentLeader : generateLeaderName(country.code).name

    return {
        winner: newLeader,
        orientationChange,
        newOrientation,
        popularityChange,
        unrestChange,
        governmentTypeChange
    }
}

/**
 * Calculate probability of coup occurring this month
 * Coups are RARE events requiring severe instability
 */
export function calculateCoupChance(country: AICountry): number {
    if (!country.politicalState) return 0

    const { govType, unrest, leader_pop, freedom, military } = country.politicalState

    // Coups ONLY happen with severe unrest (4+) - most countries won't qualify
    if (unrest < 4) return 0

    let baseChance = 0

    // Base chances are VERY low (expressed as monthly probability)
    switch (govType) {
        case 'AUTHORITARIAN':
        case 'MILITARY_JUNTA':
            baseChance = 0.002 // 0.2% base - unstable regimes
            break
        case 'ABSOLUTE_MONARCHY':
        case 'THEOCRACY':
        case 'ONE_PARTY':
            baseChance = 0.001 // 0.1% base
            break
        case 'PRESIDENTIAL':
        case 'PARLIAMENTARY':
        case 'SEMI_PRESIDENTIAL':
        case 'CONSTITUTIONAL_MONARCHY':
            baseChance = 0.0002 // 0.02% - extremely rare in democracies
            break
        default:
            baseChance = 0.0005
    }

    // Unrest 4 = 1x, unrest 5 = 2.5x
    const unrestMultiplier = unrest === 4 ? 1 : 2.5
    baseChance *= unrestMultiplier

    // Extreme conditions make it slightly more likely
    if (leader_pop === 1) {
        baseChance *= 1.3 // Very unpopular leader
    }
    if (freedom === 1) {
        baseChance *= 1.2 // Very oppressive
    }
    if (military >= 5) {
        baseChance *= 1.2 // Powerful military
    }

    // Cap at 3% per month even in absolute worst conditions
    return Math.min(baseChance, 0.03)
}

/**
 * Execute a coup
 */
export function executeCoup(country: AICountry): CoupResult {
    if (!country.politicalState) {
        throw new Error('Country has no political state')
    }

    const { military, orientation } = country.politicalState

    // Military coups tend toward authoritarianism
    const militaryBias = 20 // Shift right
    const randomShift = Math.random() * 60 - 30 // -30 to +30
    const newOrientation = Math.max(-100, Math.min(100, orientation + randomShift + militaryBias))

    const newLeader = generateLeaderName(country.code).name

    // Coups usually install military or authoritarian governments
    const govTypes: GovernmentType[] = ['MILITARY_JUNTA', 'AUTHORITARIAN', 'PRESIDENTIAL']
    const newGovType = govTypes[Math.floor(Math.random() * govTypes.length)]

    // Unrest spikes after coup
    const unrestIncrease = Math.floor(Math.random() * 2) + 1 // +1 to +2

    // Civil war risk based on how strong military is vs unrest
    const civilWarRisk = Math.max(0, (country.politicalState.unrest - military) / 5)

    return {
        newLeader,
        newOrientation,
        newGovType,
        unrestIncrease,
        civilWarRisk: Math.min(civilWarRisk, 0.8)
    }
}

/**
 * Trigger a revolution (extreme regime change)
 */
export function triggerRevolution(country: AICountry): RevolutionResult {
    if (!country.politicalState) {
        throw new Error('Country has no political state')
    }

    const { orientation } = country.politicalState

    // Revolutions tend to swing to opposite extreme
    const revolutionDirection = orientation > 0 ? -1 : 1
    const newOrientation = revolutionDirection * (Math.random() * 40 + 60) // 60-100 in opposite direction

    const newLeader = generateLeaderName(country.code).name

    // Revolution installs various government types
    const leftGovTypes: GovernmentType[] = ['ONE_PARTY', 'PARLIAMENTARY', 'PRESIDENTIAL']
    const rightGovTypes: GovernmentType[] = ['AUTHORITARIAN', 'MILITARY_JUNTA', 'PRESIDENTIAL']
    const govTypes = newOrientation < 0 ? leftGovTypes : rightGovTypes
    const newGovType = govTypes[Math.floor(Math.random() * govTypes.length)]

    // Unrest changes - might go down (hope) or stay high (chaos)
    const unrestChange = Math.random() < 0.5 ? -2 : 1

    // High chance of civil war
    const civilWar = Math.random() < 0.6

    return {
        newLeader,
        newOrientation,
        newGovType,
        unrestChange,
        civilWar
    }
}

/**
 * Helper: Get a random democratic government type
 */
function getRandomDemocraticGovType(): GovernmentType {
    const types: GovernmentType[] = ['PRESIDENTIAL', 'PARLIAMENTARY', 'SEMI_PRESIDENTIAL', 'CONSTITUTIONAL_MONARCHY']
    return types[Math.floor(Math.random() * types.length)]
}

/**
 * Calculate revolution chance (extreme unrest)
 */
export function calculateRevolutionChance(country: AICountry): number {
    if (!country.politicalState) return 0

    const { unrest, leader_pop, freedom } = country.politicalState

    if (unrest < 4) return 0 // Only at extreme unrest

    let baseChance = 0.05 // 5% base at unrest 4

    if (unrest === 5) {
        baseChance = 0.15 // 15% at maximum unrest
    }

    // Very low popularity increases risk
    if (leader_pop === 1) {
        baseChance *= 1.5
    }

    // Low freedom = oppression = more revolution risk
    baseChance *= (6 - freedom) / 3

    return Math.min(baseChance, 0.25) // Cap at 25%
}
