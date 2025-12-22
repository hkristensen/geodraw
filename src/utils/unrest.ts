import { GameState, WorldState } from '../types/store'
import { Faction } from '../types/game'
import * as turf from '@turf/turf'

/**
 * Calculate monthly unrest change based on policies, budget, and events
 */
export function calculateUnrestChange(
    gameState: GameState,
    worldState: WorldState
): number {
    let change = 0

    // 1. Budget Impact
    // Social budget reduces unrest
    const socialBudget = gameState.nation?.stats.budgetAllocation.social || 0
    change -= (socialBudget / 100) * 2 // Up to -2 per month

    // High taxes increase unrest
    const taxRate = gameState.nation?.stats.taxRate || 0
    if (taxRate > 30) {
        change += (taxRate - 30) * 0.1
    }

    // 2. Policy Impact
    // This would need to look up active policies and their monthlyUnrestChange
    // For now, simplified
    // TODO: Lookup policies from ID

    // 3. War Exhaustion
    if (worldState.activeWars.length > 0) {
        change += 0.5 * worldState.activeWars.length
    }

    // 4. Buildings
    const temples = gameState.nation?.buildings.filter(b => b.type === 'TEMPLE').length || 0
    change -= temples * 0.2

    return change
}

/**
 * Check for faction spawning or growth
 */
export function updateFactions(gameState: GameState): Faction[] {
    const { unrest, factions, userPolygon } = gameState
    let newFactions = [...factions]

    // 1. Spawn new faction if unrest is high and no factions exist
    if (unrest > 50 && factions.length === 0 && Math.random() < 0.05) {
        // Spawn a rebel faction
        // Find a random point in user territory
        // Simplified: just use a random point near center for now
        // In real impl, use turf.randomPoint within userPolygon

        if (userPolygon) {
            // Placeholder location logic
            const center = turf.center(userPolygon).geometry.coordinates as [number, number]

            newFactions.push({
                id: `faction-${Date.now()}`,
                name: 'Revolutionary Front',
                type: 'REVOLUTIONARY',
                strength: 10,
                location: center,
                active: true
            })
        }
    }

    // 2. Update existing factions
    newFactions = newFactions.map(f => {
        let strengthChange = 0

        // Growth based on unrest
        if (unrest > 50) strengthChange += 1
        if (unrest > 75) strengthChange += 2
        if (unrest < 30) strengthChange -= 1

        return {
            ...f,
            strength: Math.max(0, Math.min(100, f.strength + strengthChange))
        }
    }).filter(f => f.strength > 0) // Remove defeated factions

    return newFactions
}
