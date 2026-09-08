import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * Generate an organic-looking shape for invasions (instead of perfect circle)
 */
/**
 * Generate an organic-looking shape for invasions using noisy radial generation.
 * Creates a jagged, irregular "splat" shape.
 */
export function createOrganicInvasionShape(
    center: import('geojson').Feature<import('geojson').Point> | import('geojson').Position,
    baseRadius: number, // km
    options: { steps?: number, noise?: number } = {}
): Feature<Polygon> {
    const centerCoords = Array.isArray(center) ? center : (center as any).geometry.coordinates
    const steps = options.steps || 24 // More steps = more detail
    const noiseFactor = options.noise || 0.4 // 0.0 = circle, 0.9 = spiky star

    const points: number[][] = []

    // Generate initial random seed for global rotation
    const rotationOffset = Math.random() * 360

    for (let i = 0; i <= steps; i++) {
        // Calculate angle
        const angleStep = 360 / steps
        const angle = (i * angleStep + rotationOffset) % 360

        // Add randomness to the radius (Perlin-ish noise would be better but random works for independent vertices)
        // We use a simple smoothing by averaging with previous to avoid extreme spikes
        const randomVariation = (Math.random() - 0.5) * 2 * noiseFactor // -noise to +noise
        const r = baseRadius * (1 + randomVariation)

        const destination = turf.destination(turf.point(centerCoords), r, angle, { units: 'kilometers' })
        points.push(destination.geometry.coordinates)
    }

    // Close the loop
    points.push(points[0])

    const poly = turf.polygon([points])

    // Smooth it slightly - standard bezier spline would be nicer but simplified cleanCoords helps
    // Actually, let's leave it jagged for that "frontline" look
    return poly
}

/**
 * STRICT validation of a polygon feature.
 * Reject empty coordinates to prevent phantom geometries.
 */
function isValidFeature(feature: Feature<Polygon | MultiPolygon> | null | undefined): boolean {
    if (!feature || !feature.geometry || !feature.geometry.coordinates) return false

    const geom = feature.geometry
    if (geom.type === 'Polygon') {
        // Must have at least one ring, and that ring must have >= 4 points
        return geom.coordinates.length > 0 && geom.coordinates[0].length >= 4
    }

    if (geom.type === 'MultiPolygon') {
        // Must have at least one valid polygon
        return geom.coordinates.length > 0 && geom.coordinates.some(poly => poly.length > 0 && poly[0].length >= 4)
    }

    return false
}

/**
 * Manual MultiPolygon creation to avoid turf.combine failures
 */
function manualCombine(p1: Feature<Polygon | MultiPolygon>, p2: Feature<Polygon | MultiPolygon>): Feature<MultiPolygon> {
    const coords1 = p1.geometry.type === 'Polygon'
        ? [p1.geometry.coordinates]
        : p1.geometry.coordinates

    const coords2 = p2.geometry.type === 'Polygon'
        ? [p2.geometry.coordinates]
        : p2.geometry.coordinates

    return turf.multiPolygon([...coords1, ...coords2] as any)
}

/**
 * Safely Union two polygons with fallbacks.
 * Guaranteed to return a result containing both inputs if they are valid.
 */
function safeUnion(
    p1: Feature<Polygon | MultiPolygon>,
    p2: Feature<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> | null {
    try {
        // 1. Try standard union
        return turf.union(turf.featureCollection([p1, p2])) as Feature<Polygon | MultiPolygon>
    } catch (e) {
        // 2. Try buffering inputs slightly to fix topology
        // INCREASED BUFFER to 0.05km (50m) to fix precision gaps/ocean bug
        try {
            const b1 = turf.buffer(p1, 0.05, { units: 'kilometers' })
            const b2 = turf.buffer(p2, 0.05, { units: 'kilometers' })
            if (b1 && b2) {
                return turf.union(turf.featureCollection([b1, b2])) as Feature<Polygon | MultiPolygon>
            }
        } catch (e2) { }

        // 3. Fallback: Manual Combine (MultiPolygon)
        // This is guaranteed to succeed if inputs are valid arrays
        try {
            return manualCombine(p1, p2)
        } catch (e3) {
            console.error('safeUnion manual combine failed:', e3)
        }

        return null
    }
}

/**
 * Result of a difference computation. This distinguishes two very different
 * outcomes that the old boolean-ish (`Feature | null`) return type conflated:
 *  - success: true, feature: null   -> turf genuinely computed an EMPTY result
 *    (p2 fully covers p1). This is a trustworthy, real answer - not a failure.
 *  - success: false                 -> the underlying polygon-clipping call
 *    threw (self-intersecting rings, degenerate coordinates, etc.) and no
 *    result could be computed at all. The caller has to guess what to do,
 *    and should say so loudly instead of silently discarding the change.
 */
type DifferenceResult =
    | { success: true; feature: Feature<Polygon | MultiPolygon> | null }
    | { success: false }

/**
 * Safely Subtract p2 from p1.
 *
 * turf.difference (polyclip-ts under the hood) returns `null` without
 * throwing when the result is legitimately empty - that must be trusted as
 * the real answer, not second-guessed. It only throws on genuinely malformed
 * input (self-intersections, degenerate rings), which real country polygons
 * accumulate after repeated buffer/union/intersect operations across a long
 * war. When that happens, heal the geometry first (the same multi-strategy
 * approach as healGeometry) rather than a near-zero epsilon buffer, since a
 * buffer of a fraction of a meter almost never fixes real topology problems.
 */
function safeDifference(
    p1: Feature<Polygon | MultiPolygon>,
    p2: Feature<Polygon | MultiPolygon>
): DifferenceResult {
    // 1. Try standard difference
    try {
        const result = turf.difference(turf.featureCollection([p1, p2])) as Feature<Polygon | MultiPolygon> | null
        return { success: true, feature: result }
    } catch (e) { }

    // 2. Heal both inputs (fixes self-intersections/precision drift left over
    // from prior geometry operations), then retry
    try {
        const healedP1 = healGeometry(p1) || p1
        const healedP2 = healGeometry(p2) || p2
        const result = turf.difference(turf.featureCollection([healedP1, healedP2])) as Feature<Polygon | MultiPolygon> | null
        return { success: true, feature: result }
    } catch (e) { }

    // 3. Buffer both inputs by a real distance (50m, matching safeUnion) to
    // close small topology gaps, then retry
    try {
        const b1 = turf.buffer(p1, 0.05, { units: 'kilometers' })
        const b2 = turf.buffer(p2, 0.05, { units: 'kilometers' })
        if (b1 && b2) {
            const result = turf.difference(turf.featureCollection([b1, b2])) as Feature<Polygon | MultiPolygon> | null
            return { success: true, feature: result }
        }
    } catch (e) { }

    return { success: false }
}

/**
 * Heal invalid geometry using multiple strategies
 */
export function healGeometry(feature: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> | null {
    // First, validate the input
    if (!isValidFeature(feature)) return null

    // Check if the geometry already has a reasonable area
    try {
        const inputArea = turf.area(feature)
        if (inputArea < 100000) return null // < 0.1 sq km
    } catch (e) {
        return null
    }

    // Strategy 1: cleanCoords + truncate
    try {
        const cleaned = turf.cleanCoords(turf.truncate(feature, { precision: 7 })) as Feature<Polygon | MultiPolygon>
        // Only return if valid and simple
        const kinks = turf.kinks(cleaned as any)
        if (kinks.features.length === 0) {
            return cleanAndValidate(cleaned, feature.properties)
        }
    } catch (e) { }

    // Strategy 2: unkinkPolygon (Non-destructive)
    try {
        const unkinked = turf.unkinkPolygon(feature as any)
        if (unkinked.features.length > 0) {
            const validPieces = unkinked.features.filter(f => turf.area(f) > 10000)

            if (validPieces.length > 0) {
                if (validPieces.length === 1) {
                    const res = validPieces[0]
                    res.properties = { ...feature.properties }
                    return res as Feature<Polygon | MultiPolygon>
                }
                const combined = turf.combine(turf.featureCollection(validPieces))
                if (combined.features.length > 0) {
                    const res = combined.features[0]
                        ; (res as any).properties = { ...feature.properties }
                    return res as Feature<Polygon | MultiPolygon>
                }
            }
        }
    } catch (e) { }

    // Strategy 3: buffer(0)
    try {
        const healed = turf.buffer(feature, 0, { units: 'kilometers' })
        if (healed) return cleanAndValidate(healed as any, feature.properties)
    } catch (e) { }

    // Strategy 4: LAST RESORT - Simplify
    try {
        const simplified = turf.simplify(feature, { tolerance: 0.00001, highQuality: true })
        const healed = turf.buffer(simplified, 0)
        if (healed) return cleanAndValidate(healed as any, feature.properties)
    } catch (e) { }

    console.warn('healGeometry: All strategies failed')
    return null
}

/**
 * Helper to clean a healed geometry and remove tiny fragments
 */
function cleanAndValidate(healed: Feature<Polygon | MultiPolygon>, properties: any): Feature<Polygon | MultiPolygon> | null {
    if (healed.geometry.type === 'MultiPolygon') {
        const validPolys = healed.geometry.coordinates.filter(poly => {
            try {
                const tempPoly = turf.polygon(poly)
                return turf.area(tempPoly) > 1000000 // > 1 sq km
            } catch {
                return false
            }
        })

        if (validPolys.length === 0) return null
        if (validPolys.length === 1) {
            const result = turf.polygon(validPolys[0])
            result.properties = { ...properties }
            return result
        }

        const result = turf.multiPolygon(validPolys)
        result.properties = { ...properties }
        return result
    }

    if (turf.area(healed) < 1000000) return null

    healed.properties = { ...properties }
    return healed as Feature<Polygon | MultiPolygon>
}

export function normalizeGeometry(feature: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> {
    try {
        const truncated = turf.truncate(feature, { precision: 6 })
        return turf.cleanCoords(truncated) as Feature<Polygon | MultiPolygon>
    } catch (e) {
        return feature
    }
}

export function calculateConquest(
    attackerPoly: Feature<Polygon | MultiPolygon>,
    defenderPoly: Feature<Polygon | MultiPolygon>,
    decisiveness: number,
    claimPoly?: Feature<Polygon | MultiPolygon>,
    plan?: import('../types/game').BattlePlan,
    battleLocation?: [number, number]
): Feature<Polygon | MultiPolygon> | null {
    try {
        if (!isValidFeature(attackerPoly) || !isValidFeature(defenderPoly)) return null

        let cleanAttacker = normalizeGeometry(attackerPoly)
        let cleanDefender = normalizeGeometry(defenderPoly)

        if (plan && plan.arrows.features.length > 0) {
            const planConquest = calculatePlanConquest(cleanAttacker, cleanDefender, plan, decisiveness)
            if (planConquest) return planConquest
        }

        if (claimPoly && isValidFeature(claimPoly)) {
            try {
                const claimable = turf.intersect(turf.featureCollection([normalizeGeometry(claimPoly), cleanDefender]))
                if (claimable) {
                    if (decisiveness > 0.8) return claimable as Feature<Polygon | MultiPolygon>
                    return calculateBufferConquest(cleanAttacker, claimable as Feature<Polygon | MultiPolygon>, decisiveness)
                }
            } catch (e) { }
        }

        return calculateBufferConquest(cleanAttacker, cleanDefender, decisiveness, battleLocation)

    } catch (error) {
        return null
    }
}

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
        const safeIntensity = isNaN(intensity) ? 0.1 : Math.max(0, Math.min(1, intensity))
        const distance = minDistance + (maxDistance - minDistance) * safeIntensity

        const cleanAttacker = normalizeGeometry(attackerPoly)
        let bufferedAttacker: Feature<Polygon | MultiPolygon> | undefined

        try {
            bufferedAttacker = turf.buffer(cleanAttacker, distance, { units: 'kilometers', steps: 4 }) as Feature<Polygon | MultiPolygon>
        } catch (e) {
            try {
                const center = turf.centroid(cleanAttacker)
                bufferedAttacker = turf.buffer(center, distance, { units: 'kilometers', steps: 4 })
            } catch (e2) { }
        }

        if (!bufferedAttacker) return null

        let conquest = turf.intersect(turf.featureCollection([bufferedAttacker, normalizeGeometry(targetPoly)]))

        if (!conquest) {
            if (battleLocation && !isNaN(battleLocation[0])) {
                try {
                    const point = turf.point(battleLocation)
                    const beachheadRadius = Math.max(30, distance * 1.5)
                    const beachheadPoly = createOrganicInvasionShape(point, beachheadRadius)
                    conquest = turf.intersect(turf.featureCollection([beachheadPoly, normalizeGeometry(targetPoly)]))
                } catch (e) { }
            }
        }

        if (!conquest || turf.area(conquest) < 1000000) return null

        return healGeometry(conquest as Feature<Polygon | MultiPolygon>) || conquest as Feature<Polygon | MultiPolygon>

    } catch (e) {
        return null
    }
}

/**
 * Calculate conquest zone ANCHORED to the original defender's border.
 * This prevents gap drift by always using the pristine defender geometry as the outer boundary.
 * 
 * The key insight: instead of calculating conquest as "buffer from attacker intersected with defender",
 * we calculate it as "buffer from frontline intersected with ORIGINAL defender".
 * The original defender geometry never changes, so the outer edge always perfectly aligns.
 */
export function calculateAnchoredConquest(
    attackerPoly: Feature<Polygon | MultiPolygon>,
    originalDefenderPoly: Feature<Polygon | MultiPolygon>,  // PRISTINE geometry from countriesData
    intensity: number,
    existingContestedZone?: Feature<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> | null {
    try {
        if (!isValidFeature(attackerPoly) || !isValidFeature(originalDefenderPoly)) return null

        const minDistance = 10
        const maxDistance = 100
        const safeIntensity = isNaN(intensity) ? 0.1 : Math.max(0, Math.min(1, intensity))
        const distance = minDistance + (maxDistance - minDistance) * safeIntensity

        // Determine the "frontline" - either the attacker's edge or the existing contested zone's edge
        let frontlinePoly = normalizeGeometry(attackerPoly)

        if (existingContestedZone && isValidFeature(existingContestedZone)) {
            // Merge attacker with existing contested zone to get combined frontline
            const merged = safeUnion(frontlinePoly, existingContestedZone)
            if (merged) {
                frontlinePoly = merged
            }
        }

        // Buffer from the frontline
        let bufferedFrontline: Feature<Polygon | MultiPolygon> | undefined
        try {
            bufferedFrontline = turf.buffer(frontlinePoly, distance, { units: 'kilometers', steps: 4 }) as Feature<Polygon | MultiPolygon>
        } catch (e) {
            try {
                const center = turf.centroid(frontlinePoly)
                bufferedFrontline = turf.buffer(center, distance, { units: 'kilometers', steps: 4 })
            } catch (e2) { }
        }

        if (!bufferedFrontline) return null

        // CRITICAL: Intersect with ORIGINAL defender geometry (pristine, no drift)
        const cleanOriginalDefender = normalizeGeometry(originalDefenderPoly)
        let conquest = turf.intersect(turf.featureCollection([bufferedFrontline, cleanOriginalDefender]))

        if (!conquest || turf.area(conquest) < 1000000) return null

        // Heal and return
        const healed = healGeometry(conquest as Feature<Polygon | MultiPolygon>)
        return healed || conquest as Feature<Polygon | MultiPolygon>

    } catch (e) {
        console.warn('calculateAnchoredConquest failed:', e)
        return null
    }
}

/**
 * Clip a geometry to stay within a boundary.
 * Used to re-anchor contested zones to original defender borders after merge operations.
 */
export function clipToBoundary(
    feature: Feature<Polygon | MultiPolygon>,
    boundary: Feature<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> | null {
    try {
        if (!isValidFeature(feature) || !isValidFeature(boundary)) return feature

        const clipped = turf.intersect(turf.featureCollection([
            normalizeGeometry(feature),
            normalizeGeometry(boundary)
        ]))

        if (!clipped || turf.area(clipped) < 100000) return null

        // Preserve properties
        clipped.properties = { ...feature.properties }

        return clipped as Feature<Polygon | MultiPolygon>
    } catch (e) {
        console.warn('clipToBoundary failed:', e)
        return feature // Return original if clipping fails
    }
}

export function calculatePlanConquest(
    attackerPoly: Feature<Polygon | MultiPolygon>,
    targetPoly: Feature<Polygon | MultiPolygon>,
    plan: import('../types/game').BattlePlan,
    intensity: number
): Feature<Polygon | MultiPolygon> | null {
    try {
        const arrows = plan.arrows.features.filter(f => f.geometry.type === 'LineString')
        if (arrows.length === 0) return null

        const bufferDistance = 15 + (intensity * 40)
        let mergedCorridors: Feature<Polygon | MultiPolygon> | null = null

        for (const arrow of arrows) {
            try {
                const buff = turf.buffer(arrow, bufferDistance, { units: 'kilometers', steps: 6 })
                if (buff) {
                    if (!mergedCorridors) {
                        mergedCorridors = buff as Feature<Polygon | MultiPolygon>
                    } else {
                        const newMerged = safeUnion(mergedCorridors, buff as any)
                        if (newMerged) mergedCorridors = newMerged
                    }
                }
            } catch (e) { }
        }

        if (!mergedCorridors) return null

        const inTarget = turf.intersect(turf.featureCollection([mergedCorridors, normalizeGeometry(targetPoly)]))
        if (!inTarget) return null

        const base = calculateBufferConquest(attackerPoly, targetPoly, intensity * 0.5)
        if (base) {
            const combined = safeUnion(inTarget as any, base)
            return combined || inTarget as Feature<Polygon | MultiPolygon>
        }

        return inTarget as Feature<Polygon | MultiPolygon>

    } catch (e) {
        return null
    }
}

export function subtractTerritory(
    original: Feature<Polygon | MultiPolygon>,
    toRemove: Feature<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> | null {
    try {
        if (!isValidFeature(original)) return null
        if (!isValidFeature(toRemove)) return original

        const cleanOriginal = normalizeGeometry(original)
        const cleanToRemove = normalizeGeometry(toRemove)

        const diff = safeDifference(cleanOriginal, cleanToRemove)

        if (!diff.success) {
            // The clip computation genuinely failed (not a clean "nothing
            // left" answer) even after healing/buffering retries in
            // safeDifference. Estimate what SHOULD have happened from area
            // overlap so a confirmed near-total conquest still resolves
            // correctly, but otherwise make the failure loud: silently
            // reverting means this battle's territory change is dropped on
            // the floor with nothing in the game state to show for it.
            let areaOrig = 0
            let takenRatio = 0
            try {
                const intersection = turf.intersect(turf.featureCollection([cleanOriginal as any, cleanToRemove as any]))
                areaOrig = turf.area(cleanOriginal)
                const areaInter = intersection ? turf.area(intersection) : 0
                takenRatio = areaOrig > 0 ? areaInter / areaOrig : 0
            } catch (e) { }

            if (takenRatio > 0.9) return null // Confirmed near-total erasure

            console.error(
                `subtractTerritory: difference computation failed after all healing/buffer retries ` +
                `(estimated ${(takenRatio * 100).toFixed(1)}% of ${areaOrig ? (areaOrig / 1e6).toFixed(0) + 'km²' : 'territory'} overlapped the removed area). ` +
                `Reverting to the original, unmodified geometry - this territory change was NOT applied.`
            )
            return original
        }

        const result = diff.feature

        if (!result) {
            // safeDifference cleanly computed an empty result: toRemove
            // genuinely covers all of original. Trust it - no need to
            // second-guess a result turf didn't have to throw to produce.
            return null
        }

        if (turf.area(result) < turf.area(cleanOriginal) * 0.01) {
            const intersection = turf.intersect(turf.featureCollection([cleanOriginal as any, cleanToRemove as any]))
            const takenArea = intersection ? turf.area(intersection) : 0

            // If we took meaningful territory (>90%) and left <1%, treat as total conquest
            if (takenArea > turf.area(cleanOriginal) * 0.9) {
                return null
            }

            // Otherwise, if we took very little but result is tiny, it might be a glitch, revert to original
            if (takenArea < turf.area(cleanOriginal) * 0.1) {
                console.warn('subtractTerritory: result left a near-zero remainder despite taking <10% of the area - reverting as a likely precision glitch')
                return original
            }
        }

        const healed = healGeometry(result)
        return healed || original // Fallback to original if healing fails

    } catch (e) {
        return original
    }
}

export function mergeTerritory(
    original: Feature<Polygon | MultiPolygon>,
    toAdd: Feature<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> | null {
    try {
        // If original is missing, we can just return toAdd (claiming empty land)
        if (!isValidFeature(original)) return toAdd
        if (!isValidFeature(toAdd)) return original

        const cleanOriginal = normalizeGeometry(original)
        const cleanToAdd = normalizeGeometry(toAdd)

        let toAddBuffered = cleanToAdd
        // INCREASED SNAP BUFFER to 0.05km (50m) to force robust union overlap
        try {
            const buff = turf.buffer(cleanToAdd, 0.05, { units: 'kilometers' })
            if (buff) toAddBuffered = buff as Feature<Polygon | MultiPolygon>
        } catch (e) { }

        // Robust Union
        const result = safeUnion(cleanOriginal, toAddBuffered)

        if (!result) {
            // This should be impossible with manualCombine, but safe fallback:
            try {
                const combined = manualCombine(cleanOriginal, cleanToAdd)
                    ; (combined as any).properties = { ...original.properties }
                return combined
            } catch (e) { }

            // Absolute last resort: return toAdd if original failed? No, return original.
            return original
        }

        result.properties = { ...original.properties }

        // Final heal
        const healed = healGeometry(result)
        return healed || result
    } catch (e) {
        return original
    }
}
