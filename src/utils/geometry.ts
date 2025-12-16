import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon, FeatureCollection } from 'geojson'

/**
 * Clips a polygon to the landmass defined in the world GeoJSON.
 * Returns a new Feature containing only the intersection with land.
 * If no intersection is found (drawn entirely over water), returns null.
 */
export function clipToLand(
    polygon: Feature<Polygon | MultiPolygon>,
    worldGeoJSON: FeatureCollection
): Feature<Polygon | MultiPolygon> | null {
    try {
        let clipped: Feature<Polygon | MultiPolygon> | null = null

        // Iterate through all countries to find intersections
        for (const country of worldGeoJSON.features) {
            const countryFeature = country as Feature<Polygon | MultiPolygon>

            // Skip non-polygons
            if (!countryFeature.geometry || (countryFeature.geometry.type !== 'Polygon' && countryFeature.geometry.type !== 'MultiPolygon')) {
                continue
            }

            // Check for intersection
            const intersection = turf.intersect(
                turf.featureCollection([polygon, countryFeature])
            )

            if (intersection) {
                if (!clipped) {
                    clipped = intersection
                } else {
                    // Union with existing clipped area
                    clipped = turf.union(
                        turf.featureCollection([clipped, intersection])
                    )
                }
            }
        }

        return clipped
    } catch (e) {
        console.warn('⚠️ Error clipping polygon to land:', e)
        return polygon // Fallback to original if error
    }
}
