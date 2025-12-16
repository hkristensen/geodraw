import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * Calculate the area conquered in a battle based on decisiveness
 * @param attackerPoly The attacker's territory
 * @param defenderPoly The defender's territory
 * @param decisiveness Score from 0.0 to 1.0 indicating how decisive the victory was
 * @param claimPoly Optional specific claim polygon to prioritize
 */
export function calculateConquest(
    attackerPoly: Feature<Polygon | MultiPolygon>,
    defenderPoly: Feature<Polygon | MultiPolygon>,
    decisiveness: number,
    claimPoly?: Feature<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> | null {
    try {
        // 1. If there's a specific claim, we prioritize taking chunks of that
        if (claimPoly) {
            // Intersection of claim and defender (what's left to take)
            const claimable = turf.intersect(turf.featureCollection([claimPoly, defenderPoly]))
            if (!claimable) return null

            // If decisiveness is high (> 0.8), take the whole claim
            if (decisiveness > 0.8) {
                return claimable as Feature<Polygon | MultiPolygon>
            }

            // Otherwise, take a portion of the claim closest to attacker
            // For simplicity in this version, we'll just scale the claim area
            // But ideally we want the part touching the attacker.
            // Let's try to buffer from the attacker into the claim.
            return calculateBufferConquest(attackerPoly, claimable, decisiveness)
        }

        // 2. No specific claim (or claim fully taken), just general conquest
        return calculateBufferConquest(attackerPoly, defenderPoly, decisiveness)

    } catch (error) {
        console.warn('⚠️ Error calculating conquest geometry:', error)
        return null
    }
}

/**
 * Calculate a conquest using a buffer extending from the attacker into the target
 */
export function calculateBufferConquest(
    attackerPoly: Feature<Polygon | MultiPolygon>,
    targetPoly: Feature<Polygon | MultiPolygon>,
    intensity: number
): Feature<Polygon | MultiPolygon> | null {
    try {
        // Validation: Ensure valid geometries
        if (!attackerPoly?.geometry?.coordinates?.length || !targetPoly?.geometry?.coordinates?.length) {
            console.warn('⚠️ Invalid geometry passed to calculateBufferConquest')
            return null
        }

        // 1. Find shared border (intersection of buffers is a cheap way to find proximity)
        // Actually, let's just buffer the attacker and see what overlaps the target

        // Base buffer distance in km. 
        // A small skirmish might move border 5km. A total war victory might move it 50-100km.
        // We scale this by the size of the country to avoid swallowing tiny nations instantly?
        // No, fixed distance makes more sense for "front lines".

        const minDistance = 5 // 5km minimum gain
        const maxDistance = 100 // 100km max gain for decisive victory

        const distance = minDistance + (maxDistance - minDistance) * intensity

        // Buffer the attacker polygon
        // Increase steps for smoother buffer (default is 8, which is too blocky)
        const bufferedAttacker = turf.buffer(attackerPoly, distance, {
            units: 'kilometers',
            steps: 64
        })

        if (!bufferedAttacker) return null

        // Intersect with target to find the "conquered" zone
        const conquest = turf.intersect(turf.featureCollection([bufferedAttacker, targetPoly]))

        if (!conquest) return null

        // Clean coordinates to prevent topology errors
        return turf.cleanCoords(conquest) as Feature<Polygon | MultiPolygon>

    } catch (e) {
        console.warn('Failed to calculate buffer conquest', e)
        return null
    }
}

/**
 * Subtract a territory from another (Loss)
 */
export function subtractTerritory(
    original: Feature<Polygon | MultiPolygon>,
    toRemove: Feature<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> | null {
    try {
        const result = turf.difference(turf.featureCollection([original, toRemove]))
        return result as Feature<Polygon | MultiPolygon>
    } catch (e) {
        console.warn('Failed to subtract territory', e)
        return original // Return original on failure to avoid deleting everything
    }
}
