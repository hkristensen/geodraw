import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { useWorldStore } from '../store/worldStore'
import { subtractTerritory, mergeTerritory } from './territoryUtils'

/**
 * Mirror a territory change onto the AI side of a player-vs-AI battle.
 *
 * Player-facing battle UIs (WarModal, BattleIndicator) call addTerritory/
 * removeTerritory on the player's own store to move their border, but that
 * call alone doesn't touch the AI's aiTerritories entry - without also
 * subtracting/merging here, land gained by the player is never removed from
 * the AI (a visible overlap: both sides "own" the same patch), and land lost
 * by the player is never given to the AI (the land vanishes - reported as
 * "ocean" appearing where a border used to be).
 *
 * Synchronous and statically imported deliberately: these used to be behind
 * a dynamic import()/.then(), which left a real (if brief) window where the
 * player's side of a battle had already updated but the AI's mirrored update
 * was still pending on a microtask - exactly the kind of async gap that lets
 * a concurrent game tick read inconsistent territory state.
 */
export function subtractFromAITerritory(countryCode: string, feature: Feature<Polygon | MultiPolygon>) {
    const currentPoly = useWorldStore.getState().aiTerritories.get(countryCode)
    if (!currentPoly) return
    const newPoly = subtractTerritory(currentPoly as any, feature as any)
    const newMap = new Map(useWorldStore.getState().aiTerritories)
    if (newPoly) {
        newMap.set(countryCode, newPoly as any)
    } else {
        newMap.delete(countryCode)
    }
    useWorldStore.setState({ aiTerritories: newMap })
}

export function addToAITerritory(countryCode: string, feature: Feature<Polygon | MultiPolygon>) {
    const currentPoly = useWorldStore.getState().aiTerritories.get(countryCode)
    const merged = mergeTerritory(currentPoly as any, feature as any)
    if (merged) {
        const newMap = new Map(useWorldStore.getState().aiTerritories)
        newMap.set(countryCode, merged as any)
        useWorldStore.setState({ aiTerritories: newMap })
    }
}
