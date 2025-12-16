import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon, FeatureCollection, Point } from 'geojson'
import type { City, CapturedCity, CountryModifier, DiplomaticEvent } from '../types/game'

interface CityProperties {
    name: string
    nameascii?: string
    adm0name?: string
    adm0_a3?: string
    iso_a2?: string
    pop_max?: number
    pop_min?: number
    adm0cap?: number // 1 = capital
    featureclass?: string
    [key: string]: unknown
}

/**
 * Parse cities from Natural Earth GeoJSON
 */
export function parseCities(citiesGeoJSON: FeatureCollection): City[] {
    return citiesGeoJSON.features
        .filter(f => f.geometry.type === 'Point')
        .map(feature => {
            const props = feature.properties as CityProperties
            const coords = (feature.geometry as Point).coordinates as [number, number]

            return {
                name: props.name || props.nameascii || 'Unknown',
                countryCode: props.adm0_a3 || props.iso_a2 || 'UNK',
                countryName: props.adm0name || 'Unknown',
                population: props.pop_max || props.pop_min || 0,
                isCapital: props.adm0cap === 1 || props.featureclass === 'Admin-0 capital',
                coordinates: coords,
            }
        })
}

/**
 * Find all cities within the user's drawn polygon
 */
export function calculateCityCapture(
    userPolygon: Feature<Polygon | MultiPolygon>,
    cities: City[]
): { capturedCities: CapturedCity[], modifiers: CountryModifier[], events: DiplomaticEvent[] } {
    const capturedCities: CapturedCity[] = []
    const modifiers: CountryModifier[] = []
    const events: DiplomaticEvent[] = []
    const capitalsByCountry = new Map<string, City>()

    console.log('🏙️ Checking', cities.length, 'cities for capture...')

    // Find captured cities
    for (const city of cities) {
        const point = turf.point(city.coordinates)

        if (turf.booleanPointInPolygon(point, userPolygon)) {
            capturedCities.push({
                ...city,
                capturedAt: Date.now(),
            })

            // Track if this is a capital
            if (city.isCapital) {
                capitalsByCountry.set(city.countryCode, city)
            }
        }
    }

    console.log('🎯 Captured', capturedCities.length, 'cities')

    // Generate modifiers for captured capitals
    for (const [countryCode, capital] of capitalsByCountry) {
        // Special case: Paris triggers Revanchism
        if (capital.name === 'Paris') {
            modifiers.push({
                countryCode,
                countryName: capital.countryName,
                type: 'REVANCHISM',
                intensity: 100,
                description: `France gains +100% Aggression from Revanchism`,
            })

            events.push({
                id: `revanchism-${countryCode}-${Date.now()}`,
                type: 'REVANCHISM',
                severity: 3,
                title: '🔥 Revanchism Awakened!',
                description: `The capture of Paris has ignited French nationalism. France will never forget this humiliation.`,
                affectedNations: [countryCode],
                timestamp: Date.now(),
            })

            console.log('🔥 REVANCHISM triggered for France!')
        } else {
            // Other capitals just generate capture events
            events.push({
                id: `capital-${countryCode}-${Date.now()}`,
                type: 'CAPITAL_CAPTURED',
                severity: 2,
                title: `⚔️ ${capital.name} Falls!`,
                description: `The capital of ${capital.countryName} has been captured.`,
                affectedNations: [countryCode],
                timestamp: Date.now(),
            })

            console.log('⚔️ Capital captured:', capital.name, 'of', capital.countryName)
        }
    }

    // Check for Great Power status
    const totalPopulation = capturedCities.reduce((sum, c) => sum + c.population, 0)
    if (totalPopulation >= 10_000_000) {
        events.push({
            id: `great-power-${Date.now()}`,
            type: 'GREAT_POWER_RISE',
            severity: 2,
            title: '👑 A Great Power Rises!',
            description: `With ${(totalPopulation / 1_000_000).toFixed(1)}M people under your control, you are now a Great Power.`,
            affectedNations: [],
            timestamp: Date.now(),
        })

        console.log('👑 Great Power status achieved!', totalPopulation, 'population')
    }

    return { capturedCities, modifiers, events }
}

/**
 * Get statistics from captured cities
 */
export function getCityCaptureStats(capturedCities: CapturedCity[]) {
    const totalPopulation = capturedCities.reduce((sum, c) => sum + c.population, 0)
    const capitalsCaptured = capturedCities.filter(c => c.isCapital).length
    const largestCity = capturedCities.reduce(
        (max, city) => city.population > (max?.population || 0) ? city : max,
        null as CapturedCity | null
    )

    return {
        totalPopulation,
        cityCount: capturedCities.length,
        capitalsCaptured,
        largestCity,
    }
}
