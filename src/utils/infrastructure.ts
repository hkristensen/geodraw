/**
 * Infrastructure capture utility - airports, ports, and populated places
 * Uses async fetch to load GeoJSON (Vite can't parse large GeoJSON as imports)
 */

import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon, Point, FeatureCollection } from 'geojson'

export interface Airport {
    name: string
    iataCode: string
    type: 'major' | 'medium' | 'small'
    location: [number, number] // [lng, lat]
}

export interface Port {
    name: string
    type: 'major' | 'medium' | 'small'
    location: [number, number] // [lng, lat]
}

export interface City {
    name: string
    population: number
    countryCode: string
    isCapital: boolean
    location: [number, number] // [lng, lat]
}

export interface InfrastructureStats {
    airports: Airport[]
    ports: Port[]
    cities: City[]
    totalAirports: number
    totalPorts: number
    totalPopulation: number
    totalAreaKm2: number
    hasSeaAccess: boolean
    hasAirAccess: boolean
}

// Cache for parsed data
let allAirports: Airport[] | null = null
let allPorts: Port[] | null = null
let allCities: City[] | null = null
let loadingPromise: Promise<void> | null = null

/**
 * Load and parse all infrastructure data
 */
async function loadInfrastructureData(): Promise<void> {
    try {
        const [airportsRes, portsRes, citiesRes] = await Promise.all([
            fetch('/src/data/airports.geojson'),
            fetch('/src/data/ports.geojson'),
            fetch('/src/data/populated_places.geojson'),
        ])

        const [airportsFC, portsFC, citiesFC] = await Promise.all([
            airportsRes.json() as Promise<FeatureCollection>,
            portsRes.json() as Promise<FeatureCollection>,
            citiesRes.json() as Promise<FeatureCollection>,
        ])

        // Parse airports
        allAirports = airportsFC.features
            .filter(f => f.geometry?.type === 'Point')
            .map(f => {
                const props = f.properties as any
                const coords = (f.geometry as Point).coordinates
                const scalerank = props.scalerank || 10

                return {
                    name: props.name || 'Unknown Airport',
                    iataCode: props.iata_code || props.abbrev || '',
                    type: scalerank <= 3 ? 'major' : scalerank <= 6 ? 'medium' : 'small',
                    location: [coords[0], coords[1]] as [number, number],
                }
            })

        // Parse ports
        allPorts = portsFC.features
            .filter(f => f.geometry?.type === 'Point')
            .map(f => {
                const props = f.properties as any
                const coords = (f.geometry as Point).coordinates
                const scalerank = props.scalerank || 10

                return {
                    name: props.name || 'Unknown Port',
                    type: scalerank <= 3 ? 'major' : scalerank <= 6 ? 'medium' : 'small',
                    location: [coords[0], coords[1]] as [number, number],
                }
            })

        // Parse cities
        allCities = citiesFC.features
            .filter(f => f.geometry?.type === 'Point')
            .map(f => {
                const props = f.properties as any
                const coords = (f.geometry as Point).coordinates

                return {
                    name: props.name || 'Unknown City',
                    population: props.pop_max || props.pop_min || 0,
                    countryCode: props.iso_a2 || props.adm0_a3 || '',
                    isCapital: props.featurecla === 'Admin-0 capital' || props.capital === 1,
                    location: [coords[0], coords[1]] as [number, number],
                }
            })

        console.log(`📊 Loaded infrastructure: ${allAirports.length} airports, ${allPorts.length} ports, ${allCities.length} cities`)
    } catch (error) {
        console.warn('⚠️ Could not load infrastructure data:', error)
        allAirports = []
        allPorts = []
        allCities = []
    }
}

/**
 * Initialize infrastructure data (call early in app lifecycle)
 */
export async function initInfrastructure(): Promise<void> {
    if (!allAirports && !loadingPromise) {
        loadingPromise = loadInfrastructureData()
        await loadingPromise
        loadingPromise = null
    }
}

function getAirports(): Airport[] {
    return allAirports || []
}

function getPorts(): Port[] {
    return allPorts || []
}

function getCities(): City[] {
    return allCities || []
}

/**
 * Calculate infrastructure within a polygon
 */
export function calculateInfrastructure(
    polygon: Feature<Polygon | MultiPolygon>
): InfrastructureStats {
    const airports = getAirports()
    const ports = getPorts()
    const cities = getCities()

    // Find airports within polygon
    const capturedAirports = airports.filter(airport => {
        const point = turf.point(airport.location)
        return turf.booleanPointInPolygon(point, polygon)
    })

    // Find ports within polygon
    const capturedPorts = ports.filter(port => {
        const point = turf.point(port.location)
        return turf.booleanPointInPolygon(point, polygon)
    })

    // Find cities within polygon
    const capturedCities = cities.filter(city => {
        const point = turf.point(city.location)
        return turf.booleanPointInPolygon(point, polygon)
    })

    // Calculate total population
    // 1. Urban population from cities
    const urbanPopulation = capturedCities.reduce((sum, city) => sum + city.population, 0)

    // 2. Rural population estimate
    // Calculate area in km2
    const areaKm2 = turf.area(polygon) / 1_000_000

    // Base rural density (people per km2)
    // This is a rough estimate. Europe average is ~30-100.
    // We'll use a conservative 15 people/km2 for rural areas to avoid overcounting
    const RURAL_DENSITY = 15
    const ruralPopulation = Math.round(areaKm2 * RURAL_DENSITY)

    const totalPopulation = urbanPopulation + ruralPopulation

    return {
        airports: capturedAirports,
        ports: capturedPorts,
        cities: capturedCities,
        totalAirports: capturedAirports.length,
        totalPorts: capturedPorts.length,
        totalPopulation,
        totalAreaKm2: Math.round(areaKm2),
        hasSeaAccess: capturedPorts.length > 0,
        hasAirAccess: capturedAirports.length > 0,
    }
}

/**
 * Get all airports for map display
 */
export function getAllAirportsGeoJSON(): FeatureCollection {
    const airports = getAirports()
    return {
        type: 'FeatureCollection',
        features: airports.map(a => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: a.location },
            properties: { name: a.name, iataCode: a.iataCode, type: a.type },
        })),
    } as FeatureCollection
}

/**
 * Get all ports for map display
 */
export function getAllPortsGeoJSON(): FeatureCollection {
    const ports = getPorts()
    return {
        type: 'FeatureCollection',
        features: ports.map(p => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: p.location },
            properties: { name: p.name, type: p.type },
        })),
    } as FeatureCollection
}

/**
 * Get top cities for map display (by population)
 */
export function getTopCitiesGeoJSON(limit = 500): FeatureCollection {
    const cities = getCities()
        .sort((a, b) => b.population - a.population)
        .slice(0, limit)

    return {
        type: 'FeatureCollection',
        features: cities.map(c => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: c.location },
            properties: {
                name: c.name,
                population: c.population,
                isCapital: c.isCapital,
            },
        })),
    } as FeatureCollection
}
