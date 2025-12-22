import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * Validate availability of a polygon feature
 */
function isValidFeature(feature: Feature<Polygon | MultiPolygon> | null | undefined): boolean {
    if (!feature || !feature.geometry || !feature.geometry.coordinates) return false
    if (feature.geometry.type === 'Polygon' && feature.geometry.coordinates[0].length < 4) return false
    // For MultiPolygon, at least one poly should be valid
    if (feature.geometry.type === 'MultiPolygon' && feature.geometry.coordinates.length > 0) {
        return feature.geometry.coordinates.some(poly => poly[0].length >= 4)
    }
    return true
}

/**
 * Helper to clean and truncate geometry to avoid floating point precision errors
 */
function normalizeGeometry(feature: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> {
    try {
        const truncated = turf.truncate(feature, { precision: 6 })
        const cleaned = turf.cleanCoords(truncated) as Feature<Polygon | MultiPolygon>

        // Fix self-intersections (kinks)
        try {
            const unkinked = turf.unkinkPolygon(cleaned as any)
            if (unkinked && unkinked.features && unkinked.features.length > 0) {
                // Instead of unioning (which might recreate kinks), we convert to MultiPolygon
                // This keeps all the pieces but treats them as distinct valid polygons
                const polygons = unkinked.features
                const allCoords: any[] = []

                polygons.forEach(p => {
                    if (p.geometry.type === 'Polygon') {
                        allCoords.push(p.geometry.coordinates)
                    }
                })

                if (allCoords.length > 0) {
                    const multi = turf.multiPolygon(allCoords)
                    // CRITICAL: Preserve properties during unkinking!
                    multi.properties = { ...feature.properties }
                    return multi
                }
            }
        } catch (e) {
            // If unkink fails, fallback to cleaned
        }

        return cleaned
    } catch (e) {
        return feature
    }
}

/**
 * Calculate the area conquered in a battle based on decisiveness
 */
export function calculateConquest(
    attackerPoly: Feature<Polygon | MultiPolygon>,
    defenderPoly: Feature<Polygon | MultiPolygon>,
    decisiveness: number,
    claimPoly?: Feature<Polygon | MultiPolygon>,
    plan?: import('../types/game').BattlePlan,
    battleLocation?: [number, number]
): Feature<Polygon | MultiPolygon> | null {
    try {
        if (!isValidFeature(attackerPoly)) {
            console.log('calculateConquest: Invalid Attacker Poly')
            return null
        }
        if (!isValidFeature(defenderPoly)) {
            console.log('calculateConquest: Invalid Defender Poly')
            return null
        }

        // Normalize inputs
        let cleanAttacker = normalizeGeometry(attackerPoly)
        let cleanDefender = normalizeGeometry(defenderPoly)

        // 0. Use Battle Plan if available
        if (plan && plan.arrows.features.length > 0) {
            const planConquest = calculatePlanConquest(cleanAttacker, cleanDefender, plan, decisiveness)
            if (planConquest) return planConquest
        }

        // 1. If there's a specific claim, we prioritize taking chunks of that
        if (claimPoly && isValidFeature(claimPoly)) {
            // ... (omitted for brevity, assume claim checks pass or fail similarly)
            // For now let's focus on logic
            const claimable = turf.intersect(turf.featureCollection([normalizeGeometry(claimPoly), cleanDefender]))
            if (!claimable) return null // Claim not overlapping defender
            if (decisiveness > 0.8) return claimable as Feature<Polygon | MultiPolygon>
            return calculateBufferConquest(cleanAttacker, claimable as Feature<Polygon | MultiPolygon>, decisiveness)
        }

        // 2. No specific claim (or claim fully taken), just general conquest
        return calculateBufferConquest(cleanAttacker, cleanDefender, decisiveness, battleLocation)

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
    intensity: number,
    battleLocation?: [number, number]
): Feature<Polygon | MultiPolygon> | null {
    try {
        if (!isValidFeature(attackerPoly) || !isValidFeature(targetPoly)) return null

        const minDistance = 10
        const maxDistance = 100
        // Ensure intensity is valid
        const safeIntensity = isNaN(intensity) ? 0.1 : Math.max(0, Math.min(1, intensity))
        const distance = minDistance + (maxDistance - minDistance) * safeIntensity

        // Normalize and SIMPLIFY to ensure buffer doesn't crash on complex edges
        let cleanAttacker = normalizeGeometry(attackerPoly)



        // Use a smaller number of steps for performance and stability
        // Buffer with fallback strategy
        let bufferedAttacker: Feature<Polygon | MultiPolygon> | undefined

        try {
            bufferedAttacker = turf.buffer(cleanAttacker, distance, {
                units: 'kilometers',
                steps: 4
            }) as Feature<Polygon | MultiPolygon>
        } catch (bufferError) {
            console.warn('⚠️ Buffer failed, trying aggressive simplification...')
            try {
                // Fallback 1: Aggressive simplification
                const verySimple = turf.simplify(cleanAttacker, { tolerance: 0.05, highQuality: false })
                bufferedAttacker = turf.buffer(verySimple, distance, {
                    units: 'kilometers',
                    steps: 4
                }) as Feature<Polygon | MultiPolygon>
            } catch (fallbackError) {
                console.warn('⚠️ Simplified buffer failed, trying convex hull fallback...')
                try {
                    // Fallback 2: Convex Hull (Guaranteed to be simple)
                    const hull = turf.convex(cleanAttacker)
                    if (hull) {
                        bufferedAttacker = turf.buffer(hull, distance, {
                            units: 'kilometers',
                            steps: 4
                        }) as Feature<Polygon | MultiPolygon>
                    } else {
                        throw new Error('Convex hull failed')
                    }
                } catch (finalError) {
                    console.error('❌ All polygon buffer attempts failed')

                    // Fallback 3: Point-based Point-Zero conquest (if battle location known)
                    if (battleLocation &&
                        typeof battleLocation[0] === 'number' && !isNaN(battleLocation[0]) &&
                        typeof battleLocation[1] === 'number' && !isNaN(battleLocation[1])
                    ) {
                        console.log('📍 Attempting Point-Based Fallback at', battleLocation)
                        try {
                            const point = turf.point(battleLocation)
                            // Create a circle around the battle point
                            bufferedAttacker = turf.circle(point, distance, {
                                steps: 10,
                                units: 'kilometers'
                            })
                        } catch (pointError) {
                            console.error('❌ Point fallback failed', pointError)
                            return null
                        }
                    } else {
                        return null
                    }
                }
            }
        }

        if (!bufferedAttacker) {
            console.log('calculateBufferConquest: Buffer failed')
            return null
        }

        // Intersect with target to find the "conquered" zone
        let conquest = turf.intersect(turf.featureCollection([bufferedAttacker, normalizeGeometry(targetPoly)]))

        if (!conquest) {
            // Buffer didn't reach target (e.g. Island Invasion or distant neighbors)
            // Try to create a "Beachhead" using battleLocation
            if (battleLocation &&
                typeof battleLocation[0] === 'number' && !isNaN(battleLocation[0]) &&
                typeof battleLocation[1] === 'number' && !isNaN(battleLocation[1])
            ) {
                // console.log('🏖️ Buffer intersection failed - Attempting Beachhead at', battleLocation)
                try {
                    const point = turf.point(battleLocation)
                    const beachheadPoly = turf.circle(point, distance, {
                        steps: 10,
                        units: 'kilometers'
                    })
                    conquest = turf.intersect(turf.featureCollection([beachheadPoly, normalizeGeometry(targetPoly)]))
                    if (conquest) {
                        // console.log('✅ Beachhead established!')
                    }
                } catch (beachheadError) {
                    console.warn('❌ Beachhead attempt failed', beachheadError)
                }
            }

            if (!conquest) {
                // console.log('calculateBufferConquest: No intersection even with beachhead.')
                return null
            }
        }

        // Ensure result is big enough to matter (approx 1 sq km)
        const area = turf.area(conquest)
        if (area < 1000000) {
            // console.log('calculateBufferConquest: Area too small', area)
            return null
        }

        return normalizeGeometry(conquest as Feature<Polygon | MultiPolygon>)

    } catch (e) {
        console.warn('Failed to calculate buffer conquest', e)
        return null
    }
}

/**
 * Calculate conquest based on battle plan arrows
 */
export function calculatePlanConquest(
    attackerPoly: Feature<Polygon | MultiPolygon>,
    targetPoly: Feature<Polygon | MultiPolygon>,
    plan: import('../types/game').BattlePlan,
    intensity: number
): Feature<Polygon | MultiPolygon> | null {
    try {
        const arrowFeatures = plan.arrows.features
        if (arrowFeatures.length === 0) return null

        // Buffer the arrows to create "attack corridors"
        const bufferDistance = 15 + (intensity * 40) // 15km to 55km width

        let corridors: Feature<Polygon | MultiPolygon>[] = []

        arrowFeatures.forEach(arrow => {
            try {
                if (arrow.geometry.type === 'LineString') {
                    // Normalize coords to avoid crazy precision issues
                    const coords = (arrow.geometry as any).coordinates
                    if (coords.length < 2) return

                    // Check if line length is sufficient
                    const lineLen = turf.length(arrow, { units: 'kilometers' })
                    if (lineLen < 1) return // Ignore tiny arrows

                    // Simplify cautiously
                    // Removed high tolerance simplification to avoid collapsing valid paths

                    // Buffer
                    const buffered = turf.buffer(arrow, bufferDistance, { units: 'kilometers', steps: 8 }) // Increased steps for stability
                    if (buffered) corridors.push(buffered as Feature<Polygon | MultiPolygon>)
                }
            } catch (err) {
                // Ignore individual arrow failure
            }
        })

        if (corridors.length === 0) return null

        // Union coords iteratively (safer than bulk union in some turf versions)
        let corridorPoly = corridors[0]
        if (corridors.length > 1) {
            for (let i = 1; i < corridors.length; i++) {
                try {
                    const next = corridors[i]
                    const merged = turf.union(turf.featureCollection([corridorPoly, next]))
                    if (merged) corridorPoly = merged as Feature<Polygon | MultiPolygon>
                } catch (e) {
                    // If union fails, just keep the accumulated poly so far
                }
            }
        }

        if (!corridorPoly) return null

        // Intersect corridors with target territory
        try {
            const corridorInTarget = turf.intersect(turf.featureCollection([corridorPoly, normalizeGeometry(targetPoly)]))
            if (!corridorInTarget) return null

            // Also take some random buffer around the attacker (standard conquest) to represent general frontline changes
            // But smaller than usual since force is concentrated
            const baseConquest = calculateBufferConquest(attackerPoly, targetPoly, intensity * 0.5)

            if (baseConquest) {
                try {
                    const combined = turf.union(turf.featureCollection([corridorInTarget, baseConquest]))
                    return combined ? normalizeGeometry(combined as Feature<Polygon | MultiPolygon>) : corridorInTarget
                } catch (e) {
                    return corridorInTarget
                }
            }

            return normalizeGeometry(corridorInTarget as Feature<Polygon | MultiPolygon>)
        } catch (e) {
            console.warn('Final intersection in PlanConquest failed', e)
            return null
        }

    } catch (e) {
        console.warn('Failed to calculate plan conquest', e)
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
        if (!isValidFeature(original)) return null
        if (!isValidFeature(toRemove)) return original

        const cleanOriginal = normalizeGeometry(original)
        const cleanToRemove = normalizeGeometry(toRemove)

        const result = turf.difference(turf.featureCollection([cleanOriginal, cleanToRemove]))
        if (!result) return null // Should not happen unless completely erased

        // CRITICAL: Preserve properties! Turf operations strip them.
        result.properties = { ...original.properties }

        return normalizeGeometry(result as Feature<Polygon | MultiPolygon>)
    } catch (e) {
        console.warn('Failed to subtract territory', e)
        return original
    }
}

/**
 * Merge two territories (Expansion)
 */
export function mergeTerritory(
    original: Feature<Polygon | MultiPolygon>,
    toAdd: Feature<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> | null {
    try {
        if (!isValidFeature(original)) return toAdd
        if (!isValidFeature(toAdd)) return original

        const cleanOriginal = normalizeGeometry(original)
        const cleanToAdd = normalizeGeometry(toAdd)

        const result = turf.union(turf.featureCollection([cleanOriginal, cleanToAdd]))
        if (!result) return original

        // CRITICAL: Preserve properties!
        result.properties = { ...original.properties }

        return normalizeGeometry(result as Feature<Polygon | MultiPolygon>)
    } catch (e) {
        console.warn('Failed to merge territory', e)
        return original
    }
}
