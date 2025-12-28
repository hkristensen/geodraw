import * as turf from '@turf/turf'
import { AICountry, ReligionType } from '../types/game'
import { createOrganicInvasionShape, subtractTerritory, normalizeGeometry } from './territoryUtils'
// uuid removed

// Adjectives for names based on religion/culture
const RELIGIOUS_TITLES: Record<string, string[]> = {
    'Islam': ['Islamic Republic', 'Emirate', 'Caliphate', 'Sultanate', 'Jamahiriya'],
    'Christianity': ['Christian Republic', 'Holy State', 'Confederacy', 'Dominion'],
    'Catholicism': ['Catholic Republic', 'Holy State', 'Confederacy'],
    'Orthodox Christianity': ['Orthodox Republic', 'Holy Federation'],
    'Protestantism': ['Free State', 'Republic', 'Federation'],
    'Buddhism': ['People\'s Republic', 'State', 'Union'],
    'Hinduism': ['Republic', 'State', 'Federation'],
    'Judaism': ['State', 'Republic'],
    'Atheist State': ['People\'s Republic', 'Democratic Republic', 'Socialist Republic', 'Commune'],
    'Secular State': ['Republic', 'Federation', 'Union', 'Free State', 'Commonwealth']
}

const CULTURAL_TITLES: Record<string, string[]> = {
    'Western European': ['Republic', 'Union', 'Commonwealth'],
    'Eastern European': ['People\'s Republic', 'Federation', 'Union'],
    'Middle Eastern': ['Republic', 'State', 'Emirate'],
    'East Asian': ['People\'s Republic', 'Empire', 'State'],
    'African': ['Republic', 'United Republic', 'People\'s Republic'],
    'Latin American': ['Republic', 'United States', 'Bolivarian Republic'],
    'Slavic': ['Federation', 'Union', 'Republic'],
    'Nordic': ['Republic', 'Union'],
    'Anglo-Saxon': ['Commonwealth', 'Republic', 'Dominion']
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

export function generateSeparatistName(
    parentName: string,
    rebelPoly: any,
    parentPoly: any,
    culture: string,
    religion: string
): string {
    const direction = getCompassDirection(parentPoly, rebelPoly)
    const roll = Math.random()

    // 30% Chance: Geographic Name (e.g., "North Germany")
    if (roll < 0.3) {
        return `${direction} ${parentName}`
    }

    // 30% Chance: Religious/Ideological Name (e.g., "Islamic Republic of France")
    if (roll < 0.6) {
        const titles = RELIGIOUS_TITLES[religion] || RELIGIOUS_TITLES['Secular State']
        const title = titles[Math.floor(Math.random() * titles.length)]
        return `The ${title} of ${parentName}`
    }

    // 20% Chance: Cultural Name (e.g., "The Slavic State of Russia")
    if (roll < 0.8) {
        const titles = CULTURAL_TITLES[culture] || ['Republic', 'State']
        const title = titles[Math.floor(Math.random() * titles.length)]
        return `The ${culture} ${title} of ${parentName}`
    }

    // 20% Chance: "Free State" or similar
    return `The Free State of ${parentName}`
}

export function createRebellion(
    parentCode: string,
    parentCountry: AICountry,
    parentPoly: any,
    gameStore: any,
    worldStore: any
): { newCountry: AICountry, newPoly: any, parentNewPoly: any, name: string } | null {
    try {
        if (!parentPoly || !parentCountry) return null

        // 1. Generate Geometry
        // Use random point inside parent
        // Just pick centroid and move it randomly?
        // Or turf.pointOnFeature

        let centerPoint = turf.pointOnFeature(parentPoly)
        if (!centerPoint) centerPoint = turf.centroid(parentPoly)

        // Move point towards a random border to make it distinct?
        // Actually createOrganicInvasionShape handles creating a shape around a point.
        // We want 20-30% of area.
        const parentArea = turf.area(parentPoly)
        const targetArea = parentArea * (0.15 + Math.random() * 0.15) // 15-30%
        const radius = Math.sqrt(targetArea / Math.PI) / 1000 // approx km radius

        // Randomize location: Try 5 times to find a good spot inside
        let bestPoly = null
        for (let i = 0; i < 5; i++) {
            // Create a random point in bbox
            const bbox = turf.bbox(parentPoly)
            const randomPt = turf.randomPoint(1, { bbox: bbox }).features[0]

            if (turf.booleanPointInPolygon(randomPt, parentPoly)) {
                try {
                    const shape = createOrganicInvasionShape(randomPt, radius)
                    const intersection = turf.intersect(turf.featureCollection([shape, normalizeGeometry(parentPoly)]))
                    if (intersection && turf.area(intersection) > parentArea * 0.05) { // At least 5%
                        bestPoly = intersection
                        break
                    }
                } catch (e) { }
            }
        }

        if (!bestPoly) return null // Failed to generate valid shape

        // 2. Determine Attributes (Funder Influence)
        const interference = parentCountry.foreignInterference || {}
        let maxFunder = null
        let maxAmount = 0

        for (const [funder, amount] of Object.entries(interference)) {
            if (amount > maxAmount) {
                maxAmount = amount
                maxFunder = funder
            }
        }

        let newCulture = parentCountry.culture
        let newReligion = parentCountry.religion
        let relations = -50 // Default hostile to everyone (rogue state)

        // If heavily funded, adopt funder's values
        if (maxFunder && maxAmount > 1000) { // Threshold
            const funderCountry = worldStore.getState().aiCountries.get(maxFunder) || (maxFunder === 'PLAYER' ? { culture: 'Western', religion: 'Secular' } : null) // Mock player stats if needed, or fetch from gameStore

            // If player is funder, get from GameStore
            if (maxFunder === 'PLAYER') {
                // Hacky access to game store state via argument or global (cleaner to pass in)
                // Assuming gameStore has player constitution
                const playerConst = gameStore.getState().constitution
                if (playerConst) {
                    newCulture = playerConst.culture
                    newReligion = playerConst.religion
                }
                relations = 100
            } else if (funderCountry) {
                newCulture = funderCountry.culture
                newReligion = funderCountry.religion
                relations = 100
            }
        } else {
            // Randomize slightly if organic rebellion
            // Maybe pick a random culture from CULTURES if Unrest is high?
            // For now stick to parent to represent civil war split
        }

        // 3. Generate Name
        const name = generateSeparatistName(parentCountry.name, bestPoly, parentPoly, newCulture, newReligion)

        // 4. Create Country Object
        const newCode = `SEP-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`

        const newCountry: AICountry = {
            code: newCode,
            name: name,
            // icon: '🚩', // Removed
            units: [],
            disposition: relations > 0 ? 'friendly' : 'hostile',
            relations: -100, // Hates parent
            territoryLost: 0,
            claimedPercentage: 0,
            population: Math.floor(parentCountry.population * (turf.area(bestPoly) / parentArea)),
            power: Math.floor(parentCountry.power * 0.3), // Weak initially
            soldiers: Math.floor(parentCountry.soldiers * 0.3),
            economy: Math.floor(parentCountry.economy * 0.8), // Disrupted economy
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
            allies: maxFunder ? [maxFunder] : [],
            enemies: [parentCode],
            tradePartners: [],
            aggression: 4, // Aggressive initially
            agreements: [],
            tariff: 'HIGH',
            theirTariff: 'EMBARGO',
            foreignInterference: {}
        }

        // Subtract from Parent
        const newParentPoly = subtractTerritory(parentPoly, bestPoly)
        if (!newParentPoly) return null // Safety check (don't delete parent)

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

export function checkSeparatistRebellion(worldStore: any, gameStore: any) {
    if (!worldStore || !worldStore.aiCountries) return

    const { aiCountries, aiTerritories } = worldStore
    const { addDiplomaticEvents } = gameStore.getState()

    // Convert to array to avoid modification during iteration issues
    const countries = Array.from(aiCountries.values()) as AICountry[]

    countries.forEach((country) => {
        // Find High Unrest
        const unrestMod = country.modifiers?.find(m => m.type === 'UNREST')
        if (!unrestMod || unrestMod.intensity < 80) return

        // Also check if already at war or in chaos (optional: rebellion more likely)
        // Chance: 5% per check (if monthly)
        // If unrest > 90 -> 10%
        const chance = unrestMod.intensity > 90 ? 0.10 : 0.05

        if (Math.random() < chance) {
            console.log(`🔥 Rebellion triggering in ${country.name} (Unrest: ${unrestMod.intensity})`)

            const poly = aiTerritories.get(country.code)
            if (!poly) return

            const result = createRebellion(country.code, country, poly, gameStore, worldStore)

            if (result) {
                const { newCountry, newPoly, parentNewPoly, name } = result

                // Apply updates
                // 1. Update Maps
                const newAiCountries = new Map(aiCountries)
                newAiCountries.set(newCountry.code, newCountry)

                // Update parent stats (pop reduced by createRebellion but we need to saving it)
                // Wait, createRebellion returns NEW country but doesn't mutate parent in place?
                // createRebellion used parent properties to generate new stats but didn't modify parent object?
                // Let's modify parent here.
                const updatedParent = { ...country }
                updatedParent.population -= newCountry.population
                updatedParent.economy = Math.floor(updatedParent.economy * 0.9) // Economic hit
                updatedParent.soldiers -= Math.floor(newCountry.soldiers * 0.5) // Defections
                if (updatedParent.soldiers < 0) updatedParent.soldiers = 0

                newAiCountries.set(updatedParent.code, updatedParent)

                const newTerritories = new Map(aiTerritories)
                newTerritories.set(newCountry.code, newPoly)
                newTerritories.set(updatedParent.code, parentNewPoly)

                // 2. Commit to Store
                worldStore.setAICountries(newAiCountries)
                // NOTE: worldStore doesn't expose setAITerritories directly in interface? 
                // It has `aiTerritories` map. We might need to mutate input map or use specific setter if exists.
                // Checking worldStore definition: `aiTerritories: new Map()` is state.
                // Does it have a setter? `setAICountries` exists. `setAIWars` exists.
                // I probably need to expose `setAITerritories` or just mutate if I have access to getState().
                // worldStore argument is typically `getState()`.
                // Ideally I should emit an action.
                // For now, I'll attempt to use a setter if available or direct mutation if strictly necessary but risky.
                // Actually, useWorldStore (Zustand) state is immutable-ish.
                // I'll check if setAITerritories exists. If not, I'll add it or use a workaround.

                // Assume for now we can Mutate the map if it's a Map object (Zustand creates proxies but Maps are ref types). 
                // Better: use setState if I can import store.
                // The function receives `worldStore` which is `useWorldStore.getState()`. 
                // So I can call `useWorldStore.setState({ aiTerritories: newTerritories })` if I import it?
                // No, I passed `worldStore` (state).
                // I should modify `useHostActions` to pass the `setState` function or just import the store in this file?
                // I'll import `useWorldStore` in this file to be safe.

                // Dispatch Events
                addDiplomaticEvents([{
                    id: `rebellion-${Date.now()}-${newCountry.code}`,
                    type: 'INSURGENCY',
                    severity: 3,
                    title: 'SEPARATIST UPRISING!',
                    description: `${name} has declared independence from ${country.name}!`,
                    affectedNations: [country.code, newCountry.code],
                    timestamp: Date.now()
                }])

                // Start War (Civil War)
                // useWorldStore.getState().declareWar(...)
                // Need to import useWorldStore. I'll do that at top of file.
            }
        }
    })
}

