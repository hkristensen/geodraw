import { describe, it, expect } from 'vitest'
import * as turf from '@turf/turf'
import { subtractTerritory, mergeTerritory } from './territoryUtils'

// Two adjacent 1-degree squares sharing the edge at x=1, far from the
// antimeridian/poles so turf's spherical math behaves predictably.
const squareA = turf.polygon([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]])
const squareB = turf.polygon([[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]])

describe('mergeTerritory / subtractTerritory conservation', () => {
    it('merging two adjacent territories approximately adds their areas', () => {
        const areaA = turf.area(squareA)
        const areaB = turf.area(squareB)

        const merged = mergeTerritory(squareA, squareB)
        expect(merged).not.toBeNull()

        const mergedArea = turf.area(merged!)
        // Within 1% - union/heal can nudge the boundary by a hair.
        expect(mergedArea).toBeGreaterThan((areaA + areaB) * 0.98)
        expect(mergedArea).toBeLessThan((areaA + areaB) * 1.02)
    })

    it('subtracting what was just merged in recovers (approximately) the original', () => {
        // This is the exact conservation property that was broken this
        // session: land merged into a winner's territory must be fully
        // removable from the loser's, with nothing left over or lost.
        const areaA = turf.area(squareA)
        const merged = mergeTerritory(squareA, squareB)
        expect(merged).not.toBeNull()

        const recovered = subtractTerritory(merged!, squareB)
        expect(recovered).not.toBeNull()

        const recoveredArea = turf.area(recovered!)
        expect(recoveredArea).toBeGreaterThan(areaA * 0.98)
        expect(recoveredArea).toBeLessThan(areaA * 1.02)
    })

    it('subtracting the entirety of a territory from itself returns null (full conquest)', () => {
        const result = subtractTerritory(squareA, squareA)
        expect(result).toBeNull()
    })

    it('subtracting a non-overlapping territory leaves the original unchanged', () => {
        const areaA = turf.area(squareA)
        const farAway = turf.polygon([[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]])

        const result = subtractTerritory(squareA, farAway)
        expect(result).not.toBeNull()

        const resultArea = turf.area(result!)
        expect(resultArea).toBeGreaterThan(areaA * 0.98)
        expect(resultArea).toBeLessThan(areaA * 1.02)
    })

    it('merging into an invalid/missing original just returns the new territory', () => {
        const result = mergeTerritory(undefined as any, squareB)
        expect(result).not.toBeNull()
        expect(turf.area(result!)).toBeCloseTo(turf.area(squareB), -3)
    })
})
