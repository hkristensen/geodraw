import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon, FeatureCollection } from 'geojson'
import type { Consequence } from '../types/store'

interface CountryProperties {
    name: string
    name_long?: string
    adm0_a3?: string
    iso_a3?: string
    pop_est?: number
    [key: string]: unknown
}

/**
 * Calculate which countries the user's polygon overlaps with
 * and what percentage of each country they've "annexed"
 */
export function calculateConsequences(
    userPolygon: Feature<Polygon | MultiPolygon>,
    worldGeoJSON: FeatureCollection
): Consequence[] {
    const consequences: Consequence[] = []

    console.log('🌍 Calculating consequences for user polygon...')
    console.log('📊 Checking against', worldGeoJSON.features.length, 'countries')

    for (const countryFeature of worldGeoJSON.features) {
        // Skip if not a polygon
        if (
            countryFeature.geometry.type !== 'Polygon' &&
            countryFeature.geometry.type !== 'MultiPolygon'
        ) {
            continue
        }

        const props = countryFeature.properties as CountryProperties
        const countryName = props.name_long || props.name || 'Unknown'
        const countryCode = props.iso_a3 || props.adm0_a3 || 'UNK'
        const population = props.pop_est || 0

        try {
            // Calculate intersection
            const intersection = turf.intersect(
                turf.featureCollection([userPolygon, countryFeature as Feature<Polygon | MultiPolygon>])
            )

            if (intersection) {
                // Calculate areas
                const intersectionArea = turf.area(intersection) / 1_000_000 // km²
                const countryArea = turf.area(countryFeature) / 1_000_000 // km²
                const lostPercentage = (intersectionArea / countryArea) * 100

                // Only include if meaningful overlap (> 0.1%)
                if (lostPercentage > 0.1) {
                    const populationCaptured = Math.round(population * (lostPercentage / 100))

                    consequences.push({
                        countryName,
                        countryCode,
                        lostPercentage,
                        lostArea: intersectionArea,
                        population,
                        populationCaptured,
                    })

                    console.log(
                        `🎯 ${countryName}: ${lostPercentage.toFixed(1)}% annexed ` +
                        `(${intersectionArea.toFixed(0)} km², ~${populationCaptured.toLocaleString()} people)`
                    )
                }
            }
        } catch (error) {
            // Some geometries may cause issues with turf, skip them
            console.warn(`⚠️ Could not process ${countryName}:`, error)
        }
    }

    // Sort by percentage taken (descending)
    consequences.sort((a, b) => b.lostPercentage - a.lostPercentage)

    console.log('✅ Found', consequences.length, 'affected countries')

    return consequences
}

/**
 * Get total statistics from consequences
 */
export function getConsequenceStats(consequences: Consequence[]) {
    const totalPopulation = consequences.reduce((sum, c) => sum + c.populationCaptured, 0)
    const totalArea = consequences.reduce((sum, c) => sum + c.lostArea, 0)
    const countriesAffected = consequences.length

    return {
        totalPopulation,
        totalArea,
        countriesAffected,
    }
}
