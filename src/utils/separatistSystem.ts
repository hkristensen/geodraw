import * as turf from '@turf/turf'
import { AICountry, ReligionType } from '../types/game'
import { createOrganicInvasionShape, subtractTerritory, normalizeGeometry } from './territoryUtils'
import { useWorldStore } from '../store/worldStore'
// Import infrastructure utility to calculate real stats
import { calculateInfrastructure, getTopCitiesGeoJSON, City } from './infrastructure'

// Expanded naming templates based on political alignment
const NAMING_TEMPLATES: Record<string, string[]> = {
    'COMMUNIST': [
        'People\'s Republic of {NAME}',
        'Socialist Republic of {NAME}',
        'Democratic Republic of {NAME}',
        '{NAME} Commune',
        'Red {NAME}',
        'Workers\' State of {NAME}',
        'Union of {NAME} People',
        '{NAME} Soviet Republic'
    ],
    'DEMOCRATIC': [
        'Free Republic of {NAME}',
        'Republic of {NAME}',
        'United {NAME}',
        'Democratic Federation of {NAME}',
        'State of {NAME}',
        'Commonwealth of {NAME}',
        '{NAME} Union',
        'Independent State of {NAME}'
    ],
    'RELIGIOUS': [
        'Holy State of {NAME}',
        'Islamic Emirate of {NAME}',
        'Caliphate of {NAME}',
        'Kingdom of God in {NAME}',
        'Divine State of {NAME}',
        'Sacred Republic of {NAME}',
        'Emirate of {NAME}'
    ],
    'NATIONALIST': [
        'Greater {NAME}',
        'True {NAME}',
        'National State of {NAME}',
        'Empire of {NAME}',
        '{NAME} Liberation Front',
        '{NAME} First',
        'Sovereign State of {NAME}'
    ],
    'GEOGRAPHIC': [
        '{direction} {NAME}',
        'Trans-{NAME}',
        'Cis-{NAME}',
        'Upper {NAME}',
        'Lower {NAME}',
        'Coast of {NAME}',
        '{NAME} Highlands',
        'New {NAME}'
    ]
}

function getCompassDirection(parent: any, rebel: any): string {
    const pCenter = turf.centroid(parent)
    const rCenter = turf.centroid(rebel)
    const bearing = turf.bearing(pCenter, rCenter)

    if (bearing >= -45 && bearing < 45) return 'North'
    if (bearing >= 45 && bearing < 135) return 'East'
    if (bearing >= 135 || bearing < -135) return 'South'
    if (bearing >= -135 && bearing < -45) return 'West'
    return 'Central'
}

/**
 * Determine the political alignment of the rebellion based on backers
 */
function determineAlignment(
    interference: Record<string, number>,
    gameStore: any
): { alignment: string, backername: string | null } {
    let maxFunder: string | null = null
    let maxAmount = 0

    // Find biggest backer
    for (const [funder, amount] of Object.entries(interference)) {
        if (amount > maxAmount) {
            maxAmount = amount
            maxFunder = funder
        }
    }

    if (!maxFunder || maxAmount < 1000) return { alignment: 'GEOGRAPHIC', backername: null }

    // If player is backer
    if (maxFunder === 'PLAYER') {
        const playerConst = gameStore.getState().constitution
        if (playerConst) {
            if (playerConst.religion === 'Atheist State') return { alignment: 'COMMUNIST', backername: 'PLAYER' }
            if (playerConst.religion !== 'Secular State') return { alignment: 'RELIGIOUS', backername: 'PLAYER' }
            return { alignment: 'DEMOCRATIC', backername: 'PLAYER' }
        }
        return { alignment: 'DEMOCRATIC', backername: 'PLAYER' }
    }

    // Checking AI backer
    const backer = useWorldStore.getState().aiCountries.get(maxFunder)
    if (!backer) return { alignment: 'GEOGRAPHIC', backername: null }

    // Logic based on backer culture/religion
    const backerReligion = backer.religion as string // Cast to string to safely compare
    const backerGov = (backer as any).governmentType || 'Unknown' // Safe access

    if (backerReligion === 'Islam' || backerReligion === 'Catholicism') return { alignment: 'RELIGIOUS', backername: backer.name }
    if (backer.culture === 'East Asian' || backerGov === 'Communist State') return { alignment: 'COMMUNIST', backername: backer.name }
    if (backer.culture === 'Western European') return { alignment: 'DEMOCRATIC', backername: backer.name }

    return { alignment: 'NATIONALIST', backername: backer.name }
}

/**
 * Find a suitable city to seed the rebellion
 * Prefers cities far from the capital
 */
export function findRebellionSeedCity(
    parentPoly: any,
    parentCapitalLocation: [number, number] | undefined
): City | null {
    // 1. Get cities inside parent polygon
    try {
        const citiesFC = getTopCitiesGeoJSON(10000) // Get many cities
        const citiesInside = citiesFC.features.filter(f => turf.booleanPointInPolygon(f as any, parentPoly))

        if (citiesInside.length === 0) return null

        // 2. Sort by distance from capital (if known) to maximize separation
        if (parentCapitalLocation) {
            const capitalPoint = turf.point(parentCapitalLocation)
            citiesInside.sort((a, b) => {
                const distA = turf.distance(a as any, capitalPoint)
                const distB = turf.distance(b as any, capitalPoint)
                return distB - distA // Descending distance
            })
        }

        // 3. Pick from top 3 candidates (furthest)
        const candidates = citiesInside.slice(0, 3)
        const choice = candidates[Math.floor(Math.random() * candidates.length)]

        if (!choice) return null

        return {
            name: choice.properties?.name,
            population: choice.properties?.population,
            countryCode: choice.properties?.iso_a2,
            isCapital: false,
            location: (choice.geometry as any).coordinates
        }
    } catch (e) {
        console.warn('Error specific city finding', e)
        return null
    }
}

// Helper to check if name is taken
function isNameTaken(name: string, takenNames: Set<string>): boolean {
    return takenNames.has(name)
}

export function generateSeparatistName(
    parentName: string,
    rebelPoly: any,
    parentPoly: any,
    alignment: string,
    takenNames: Set<string>
): string {
    const direction = getCompassDirection(parentPoly, rebelPoly)
    const templates = NAMING_TEMPLATES[alignment] || NAMING_TEMPLATES['GEOGRAPHIC']

    // Try up to 20 times to find a unique name
    for (let i = 0; i < 20; i++) {
        const template = templates[Math.floor(Math.random() * templates.length)]
        let name = template
            .replace('{NAME}', parentName)
            .replace('{direction}', direction)

        // Ensure first letter is capitalized properly
        name = name.charAt(0).toUpperCase() + name.slice(1)

        if (!isNameTaken(name, takenNames)) {
            return name
        }
    }

    // Fallback: Numbered Republic
    let counter = 2
    while (true) {
        const fallback = `Republic of ${parentName} ${romanize(counter)}`
        if (!isNameTaken(fallback, takenNames)) return fallback
        counter++
    }
}

function romanize(num: number): string {
    if (num === 2) return 'II'
    if (num === 3) return 'III'
    if (num === 4) return 'IV'
    if (num === 5) return 'V'
    return num.toString()
}

export function createRebellion(
    parentCode: string,
    parentCountry: AICountry,
    parentPoly: any,
    gameStore: any,
    worldStore: any,
    takenNames: Set<string>,
    forcedAlignment?: string // For Chaos events
): { newCountry: AICountry, newPoly: any, parentNewPoly: any, name: string } | null {
    try {
        if (!parentPoly || !parentCountry) return null

        // 1. Generate Geometry (Smart City Seeding)
        let centerPoint: any = null
        let seedCityName = ''

        // Try to find a seed city
        const capitalLoc = (parentCountry as any).capital?.coordinates
        const seedCity = findRebellionSeedCity(parentPoly, capitalLoc as [number, number])

        if (seedCity) {
            centerPoint = turf.point(seedCity.location)
            seedCityName = seedCity.name
        } else {
            // Fallback to random point
            const bbox = turf.bbox(parentPoly)
            centerPoint = turf.randomPoint(1, { bbox: bbox }).features[0]
            if (!turf.booleanPointInPolygon(centerPoint, parentPoly)) {
                centerPoint = turf.pointOnFeature(parentPoly)
            }
        }

        if (!centerPoint) return null

        // Generate shape around the seed point
        const parentArea = turf.area(parentPoly)
        const targetArea = parentArea * (0.15 + Math.random() * 0.10)
        const radius = Math.sqrt(targetArea / Math.PI) / 1000 // km

        let bestPoly = null
        try {
            const shape = createOrganicInvasionShape(centerPoint, radius, { steps: 20 + Math.floor(Math.random() * 10), noise: 0.5 })
            const intersection = turf.intersect(turf.featureCollection([shape, normalizeGeometry(parentPoly)]))

            if (intersection && turf.area(intersection) > parentArea * 0.02) {
                bestPoly = intersection
            }
        } catch (e) {
            console.warn('Shape generation failed', e)
        }

        if (!bestPoly) return null

        // 2. Real Stats Calculation
        const infraStats = calculateInfrastructure(bestPoly as any)
        const capturedPop = infraStats.totalPopulation
        const finalPop = Math.max(capturedPop, Math.floor(parentCountry.population * 0.05))

        // 3. Determine Attributes & Alignment
        let alignment = 'GEOGRAPHIC'
        let backername = null
        let relations = -100

        if (forcedAlignment) {
            alignment = forcedAlignment
            // Chaos event: Opposing alignment usually implies rival backing implicitly or just ideology
            relations = -100
        } else {
            const interference = parentCountry.foreignInterference || {}
            const res = determineAlignment(interference, gameStore)
            alignment = res.alignment
            backername = res.backername

            // Relations
            if (backername) {
                const backer = worldStore.getState().aiCountries.get(backername)
                if (backer || backername === 'PLAYER') relations = 100
            }
        }

        let newCulture = parentCountry.culture
        let newReligion = parentCountry.religion

        // Apply alignment flavor
        if (alignment === 'COMMUNIST') {
            // newReligion could be Atheist?
        }

        // 4. Generate Name (Unique)
        let nameBase = parentCountry.name
        if (seedCityName && Math.random() < 0.3) {
            nameBase = seedCityName
        }

        const name = generateSeparatistName(nameBase, bestPoly, parentPoly, alignment, takenNames)

        // 5. Create Country Object
        const newCode = `SEP-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`

        if (bestPoly) {
            bestPoly.properties = {
                iso_a3: newCode,
                name: name,
                name_long: name,
                admin: name,
                type: 'Country'
            }
        }

        const newCountry: AICountry = {
            code: newCode,
            name: name,
            units: [],
            disposition: relations > 0 ? 'friendly' : 'hostile',
            relations: relations === 100 ? 50 : -100,
            territoryLost: 0,
            claimedPercentage: 0,
            population: finalPop,
            power: Math.floor(parentCountry.power * (finalPop / parentCountry.population)),
            soldiers: Math.floor(parentCountry.soldiers * (finalPop / parentCountry.population)),
            economy: parentCountry.economy,
            authority: 50,
            religion: newReligion as ReligionType,
            culture: newCulture,
            language: parentCountry.language,
            modifiers: [{
                id: `rebellion-${Date.now()}`,
                countryCode: newCode,
                countryName: name,
                type: 'UNREST' as any,
                intensity: 20,
                duration: 12,
                description: 'Post-revolutionary chaos'
            }],
            isAtWar: true,
            allies: backername && backername !== 'PLAYER' ? [backername] : [],
            enemies: [parentCode],
            tradePartners: [],
            aggression: 4,
            agreements: [],
            tariff: 'HIGH',
            theirTariff: 'EMBARGO',
            foreignInterference: {}
        }

        // Subtract from Parent
        const newParentPoly = subtractTerritory(parentPoly, bestPoly)
        if (!newParentPoly) return null

        return {
            newCountry,
            newPoly: bestPoly,
            parentNewPoly: newParentPoly,
            name
        }

    } catch (e) {
        console.warn('Rebellion creation failed', e)
        return null
    }
}

export function checkSeparatistRebellion(_worldStore: any, gameStore: any) {
    const { aiCountries, aiTerritories, aiWars } = useWorldStore.getState()
    const { addDiplomaticEvents } = gameStore.getState()

    if (!aiCountries || aiCountries.size === 0) return

    const countries = Array.from(aiCountries.values()) as AICountry[]

    // Build set of taken names for uniqueness check
    const takenNames = new Set<string>()
    countries.forEach(c => takenNames.add(c.name))

    countries.forEach((country) => {
        if ((country as any).isAnnexed) return

        // THROTTLING: Check if country is already fighting a civil war
        const existingCivilWar = aiWars.find(w =>
            w.status === 'active' &&
            w.defenderCode === country.code &&
            w.attackerCode.startsWith('SEP-')
        )

        if (existingCivilWar) {
            // Country is already busy fighting rebels, prevent new ones
            return
        }

        // Stats
        const unrestMod = country.modifiers?.find(m => m.type === 'UNREST')
        let chance = 0
        let forcedAlignment: string | undefined = undefined

        if (unrestMod && unrestMod.intensity >= 50) {
            chance = unrestMod.intensity > 90 ? 0.30 :
                unrestMod.intensity > 70 ? 0.20 : 0.10
        } else {
            // BLACK SWAN / CHAOS EVENT
            // 0.5% chance for a random stable country to fracture
            if (Math.random() < 0.005) {
                console.log(`🎲 CHAOS: Unlikely rebellion triggering in ${country.name}`)
                chance = 1.0 // Force trigger if roll passed
                forcedAlignment = 'NATIONALIST' // Or random opposite
            }
        }

        if (chance > 0 && Math.random() < chance) {
            console.log(`🔥 Rebellion triggering in ${country.name}`)

            const poly = aiTerritories.get(country.code)
            if (!poly) return

            const result = createRebellion(country.code, country, poly, gameStore, useWorldStore, takenNames, forcedAlignment)

            if (result) {
                const { newCountry, newPoly, parentNewPoly, name } = result

                // Update maps
                const newAiCountries = new Map(aiCountries)
                newAiCountries.set(newCountry.code, newCountry)

                const updatedParent = { ...country }
                updatedParent.population -= newCountry.population
                updatedParent.economy = Math.floor(updatedParent.economy * 0.9)
                updatedParent.soldiers -= Math.floor(newCountry.soldiers * 0.5)
                if (updatedParent.soldiers < 0) updatedParent.soldiers = 0

                newAiCountries.set(updatedParent.code, updatedParent)

                const newTerritories = new Map(aiTerritories)
                newTerritories.set(newCountry.code, newPoly)
                newTerritories.set(updatedParent.code, parentNewPoly)

                useWorldStore.setState({
                    aiCountries: newAiCountries,
                    aiTerritories: newTerritories
                })

                console.log(`🔥 REBELLION SUCCESS: ${name} has broken away from ${country.name}!`)

                // Dispatch Events (Chaos variant?)
                const title = forcedAlignment ? 'SURPRISE UPRISING!' : 'SEPARATIST UPRISING!'

                addDiplomaticEvents([{
                    id: `rebellion-${Date.now()}-${newCountry.code}`,
                    type: 'INSURGENCY',
                    severity: 3,
                    title: title,
                    description: `${name} has declared independence from ${country.name}!`,
                    affectedNations: [country.code, newCountry.code],
                    timestamp: Date.now()
                }])

                const currentWars = useWorldStore.getState().aiWars
                const civilWar = {
                    id: `civil-war-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    attackerCode: newCountry.code,
                    defenderCode: country.code,
                    startTime: Date.now(),
                    lastBattleTime: Date.now(),
                    status: 'active' as const,
                    attackerGain: 0,
                    defenderGain: 0,
                    casualties: { attacker: 0, defender: 0 }
                }
                useWorldStore.setState({ aiWars: [...currentWars, civilWar] })
            }
        }
    })
}
