import { create } from 'zustand'
import * as turf from '@turf/turf'
import type { AICountry, Disposition, Constitution, Agreement, PoliticalState } from '../types/game'
import type { WorldState, Consequence } from '../types/store'
import { getCountryData, getPrimaryReligion, getPrimaryLanguage, getPrimaryCulture } from '../utils/countryData'
import { getGeopoliticalData, mapOrientationToNumber, mapGovType, isDemocracy, getISO3FromName } from '../utils/geopoliticalData'
import { getTitleForGovType } from '../data/leaderNames'
import { calculatePower } from '../utils/powerSystem'
import { useGameStore } from './gameStore'
import { createCoalition as createCoalitionUtil, seedRealWorldCoalitions, calculateJoinChance } from '../utils/coalitionSystem'
// Imports removed (unused)
import { assessStrategy, createWarGoal } from '../utils/aiStrategy'


// Calculate initial disposition based on territory lost
function calculateDisposition(territoryLost: number, hasRevanchism: boolean): Disposition {
    if (hasRevanchism || territoryLost > 50) return 'hostile'
    if (territoryLost > 20) return 'hostile'
    if (territoryLost > 5) return 'neutral'
    return 'neutral'
}

// Calculate initial relations based on territory lost
function calculateRelations(territoryLost: number, compatibility: number): number {
    // More territory lost = worse relations
    // Compatibility modifies base relations (-20 to +25)
    return Math.max(-100, Math.round(-territoryLost * 2 + compatibility))
}

// Calculate cultural compatibility score
function calculateCulturalCompatibility(
    ai: { religion: string, culture: string, language: string },
    player?: Constitution
): number {
    if (!player) return 0

    let score = 0

    // Same Religion: +10
    if (ai.religion === player.religion) score += 10

    // Same Culture: +10
    if (ai.culture === player.culture) score += 10

    // Same Language: +5
    if (ai.language === player.language) score += 5

    // Conflicting (All Different): -20
    if (score === 0) score = -20

    return score
}

export const useWorldStore = create<WorldState>((set, get) => ({
    aiCountries: new Map(),
    aiTerritories: new Map(), // Dynamic country polygons
    aiWars: [], // AI vs AI wars
    activeWars: [],
    allies: [],
    coalitions: [],
    coalitionInvites: [],
    coalitionsInitialized: false,

    initializeAICountries: (consequences: Consequence[], playerConstitution?: Constitution, allCountries?: any) => {
        const countries = new Map<string, AICountry>()
        const territories = new Map<string, GeoJSON.Feature>() // Store country polygons

        // Create a map of consequences for faster lookup
        const consequenceMap = new Map(consequences.map(c => [c.countryCode, c]))

        // If allCountries is provided, iterate over it. Otherwise fallback to consequences (legacy behavior)
        const features = allCountries ? allCountries.features : []

        if (features.length === 0 && consequences.length > 0) {
            // Fallback for when allCountries isn't passed but consequences exist (e.g. freeform mode without full world init?)
            // Actually, we should always try to init the world. 
            // If features is empty, we can't do much unless we rely on consequences only.
            console.warn('⚠️ No world data provided to initializeAICountries. Using consequences only.')
        }

        const itemsToProcess = features.length > 0 ? features : consequences

        // Get player's selected country to skip it (player IS that country)
        const { gameSettings } = useGameStore.getState()
        const playerCountryCode = gameSettings?.startingCountry

        for (const item of itemsToProcess) {
            let countryCode: string
            let countryName: string
            let lostPercentage = 0

            if (features.length > 0) {
                // Processing Feature
                const f = item as any
                countryCode = f.properties.iso_a3 || f.properties.adm0_a3
                countryName = f.properties.name_long || f.properties.name

                // Store the territory polygon for dynamic rendering
                if (f.geometry && countryCode) {
                    territories.set(countryCode, f as GeoJSON.Feature)
                }

                const consequence = consequenceMap.get(countryCode)
                if (consequence) {
                    lostPercentage = consequence.lostPercentage
                }
            } else {
                // Processing Consequence (Legacy/Fallback)
                const c = item as any
                countryCode = c.countryCode
                countryName = c.countryName
                lostPercentage = c.lostPercentage
            }

            if (!countryCode) continue

            // Skip player's selected country - player IS that country, not an AI
            if (playerCountryCode && countryCode === playerCountryCode) {
                console.log('🏳️ Skipping player country from AI initialization:', countryCode)
                continue
            }

            // Skip countries that are fully annexed (>99% lost)
            // This prevents duplicate AI countries when playing as an existing nation
            if (lostPercentage > 99) continue;

            // Get real data from GeoJSON files
            const realData = getCountryData(countryCode)
            const geoData = getGeopoliticalData(countryCode)
            const primaryReligion = getPrimaryReligion(countryCode)
            const primaryLanguage = getPrimaryLanguage(countryCode)
            const primaryCulture = getPrimaryCulture(countryCode)

            // Generic Revanchism: If they lost > 5% of their land, they want it back
            const hasRevanchism = lostPercentage > 5

            // Use real data if available, with fallbacks
            // If processing feature, we might not have population in consequence if not affected
            // So use realData or feature properties
            const featurePop = (item as any).properties?.pop_est
            const consequencePop = consequenceMap.get(countryCode)?.population

            const population = realData?.population || consequencePop || featurePop || 1000000
            const remainingRatio = (100 - lostPercentage) / 100

            // Soldiers: 1% of remaining population
            const soldiers = Math.round(population * remainingRatio * 0.01)

            // Economy from real GNI data, reduced proportionally by territory lost
            const baseEconomy = realData?.economy || 50
            const economy = Math.round(baseEconomy * remainingRatio)

            // Authority from real freedom data
            const authority = realData?.authority || 50

            // Calculate Power using unified system
            const powerStats = calculatePower(soldiers, economy, authority, false)

            const compatibility = calculateCulturalCompatibility({
                religion: primaryReligion,
                culture: primaryCulture,
                language: primaryLanguage
            }, playerConstitution)

            // Build political state from geopolitical data
            let politicalState: PoliticalState | undefined
            let allies: string[] = []
            let enemies: string[] = []
            let tradePartners: string[] = []
            let aggression = 3

            if (geoData) {
                const govType = mapGovType(geoData.gov_type)
                const orientation = mapOrientationToNumber(geoData.orientation)
                const stability = (6 - geoData.unrest) * 20 // Convert 1-5 unrest to 0-100 stability

                politicalState = {
                    government: govType,
                    govType, // Alias for compatibility
                    orientation,
                    leader: {
                        name: geoData.leader,
                        title: getTitleForGovType(geoData.gov_type),
                        orientation,
                        popularity: geoData.leader_pop,
                        inOfficeSince: Date.now()
                    },
                    policies: geoData.policies,
                    nextElection: isDemocracy(govType) ? Date.now() + (365 * 24 * 60 * 60 * 1000) : undefined,
                    stability,
                    // Properties from geopolitical data
                    unrest: geoData.unrest,
                    leader_pop: geoData.leader_pop,
                    freedom: geoData.freedom,
                    military: geoData.military,
                    aggression: geoData.aggression
                }

                // Convert ally/enemy names to ISO3 codes where possible
                allies = (geoData.allies || []).map(n => getISO3FromName(n) || n).filter(a => a !== 'None')
                enemies = (geoData.enemies || []).map(n => getISO3FromName(n) || n).filter(e => e !== 'None')
                tradePartners = (geoData.trade || []).map(n => getISO3FromName(n) || n)
                aggression = geoData.aggression || 3
            }

            countries.set(countryCode, {
                code: countryCode,
                name: countryName,
                disposition: calculateDisposition(lostPercentage, hasRevanchism),
                relations: calculateRelations(lostPercentage, compatibility),
                territoryLost: lostPercentage,
                population: Math.round(population * remainingRatio),
                power: powerStats.totalPower,
                soldiers,
                economy,
                authority,
                religion: primaryReligion,
                culture: primaryCulture,
                language: primaryLanguage,
                modifiers: hasRevanchism ? ['REVANCHISM'] : [],
                isAtWar: false,
                isAnnexed: false,
                claimedPercentage: 0,
                politicalState,
                allies,
                enemies,
                tradePartners,
                aggression,
                agreements: [],
                tariff: 'LOW',
                theirTariff: 'LOW',
                units: []
            })
        }

        // 2nd Pass: Seed Procedural Enemies (Cold War / Rivalry Logic)
        // Ensure that aggressive nations have targets, and ideological opposites clash
        countries.forEach((country, code) => {
            if (country.isAnnexed) return

            // If aggressive but has no enemies, find one
            if (country.enemies.length === 0 && country.aggression >= 3) {
                // Find potential target: Different orientation, close by ideally (but we don't have distance easily here), or just random
                // Let's filter for ideological opposites first
                let potentialTargets = Array.from(countries.values()).filter(c =>
                    c.code !== code &&
                    !c.isAnnexed &&
                    Math.abs((c.politicalState?.orientation || 0) - (country.politicalState?.orientation || 0)) > 50
                )

                // If no opposites, just pick random
                if (potentialTargets.length === 0) {
                    potentialTargets = Array.from(countries.values()).filter(c => c.code !== code && !c.isAnnexed)
                }

                if (potentialTargets.length > 0) {
                    // Pick 1-2 enemies
                    const count = Math.min(potentialTargets.length, Math.random() < 0.5 ? 1 : 2)
                    for (let i = 0; i < count; i++) {
                        const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)]
                        if (!country.enemies.includes(target.code)) {
                            country.enemies.push(target.code)
                            // Mutual enmity? Maybe not always, but usually yes
                            const targetCountry = countries.get(target.code)
                            if (targetCountry && !targetCountry.enemies.includes(code)) {
                                targetCountry.enemies.push(code)
                            }
                            console.log(`⚔️ Rivalry seeded: ${country.name} vs ${target.name}`)
                        }
                    }
                }
            }
        })

        console.log('🌍 Initialized AI countries with geopolitical data:', countries.size)
        // Seed real-world coalitions
        const playerCountry = useGameStore.getState().selectedCountry || undefined
        const realCoalitions = seedRealWorldCoalitions(countries, playerCountry)
        console.log(`🌍 Seeded ${realCoalitions.length} real-world coalitions`)

        set({
            aiCountries: countries,
            aiTerritories: territories, // Store country polygons for dynamic rendering
            coalitions: realCoalitions,
            coalitionsInitialized: true
        })
    },

    updateRelations: (countryCode, delta) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return

        const newRelations = Math.max(-100, Math.min(100, country.relations + delta))
        const newDisposition: Disposition =
            newRelations > 50 ? 'friendly' :
                newRelations > -20 ? 'neutral' : 'hostile'

        aiCountries.set(countryCode, {
            ...country,
            relations: newRelations,
            disposition: country.isAtWar ? 'at_war' : newDisposition,
        })

        set({ aiCountries: new Map(aiCountries) })
    },

    setDisposition: (countryCode, disposition) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return

        aiCountries.set(countryCode, { ...country, disposition })
        set({ aiCountries: new Map(aiCountries) })
    },

    declareWar: (countryCode) => {
        const { aiCountries, activeWars } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return

        // Break all agreements
        // const brokenAgreements = country.agreements

        aiCountries.set(countryCode, {
            ...country,
            disposition: 'at_war',
            isAtWar: true,
            warDeclaredAt: Date.now(),
            modifiers: [...country.modifiers, 'AT_WAR'],
            agreements: [], // Clear agreements
            tariff: 'EMBARGO',
            theirTariff: 'EMBARGO'
        })

        set({
            aiCountries: new Map(aiCountries),
            activeWars: [...activeWars, countryCode],
        })
    },

    makePeace: (countryCode) => {
        const { aiCountries, activeWars } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return

        const newModifiers = country.modifiers.filter(m => m !== 'AT_WAR')

        aiCountries.set(countryCode, {
            ...country,
            disposition: 'hostile', // Still hostile after war
            isAtWar: false,
            modifiers: newModifiers,
            tariff: 'HIGH', // Reset to high tariff
            theirTariff: 'HIGH'
        })

        set({
            aiCountries: new Map(aiCountries),
            activeWars: activeWars.filter(c => c !== countryCode),
        })
    },

    formAlliance: (countryCode) => {
        // Legacy method, now handled by proposeAgreement
        const { aiCountries, allies } = get()
        const country = aiCountries.get(countryCode)
        if (!country || country.isAtWar) return

        // Add agreement
        const alliance: Agreement = {
            id: `alliance - ${Date.now()} `,
            type: 'MILITARY_ALLIANCE',
            targetCountry: countryCode,
            signedAt: Date.now()
        }

        aiCountries.set(countryCode, {
            ...country,
            disposition: 'friendly',
            relations: 100,
            modifiers: [...country.modifiers, 'ALLIED'],
            agreements: [...country.agreements, alliance]
        })

        set({
            aiCountries: new Map(aiCountries),
            allies: [...allies, countryCode],
        })
    },

    // New Diplomacy Actions
    proposeAgreement: (countryCode, type) => {
        const { aiCountries, allies } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return false

        // Logic to determine acceptance
        // Base chance depends on relations
        let chance = 0
        const rel = country.relations

        switch (type) {
            case 'TRADE_AGREEMENT':
                // Easy to get if neutral+
                if (rel > -10) chance = 0.8
                else chance = 0.1
                break
            case 'NON_AGGRESSION':
                // Needs neutral+
                if (rel > 0) chance = 0.7
                else chance = 0.2
                break
            case 'MILITARY_ALLIANCE':
                // Hard, needs friendly
                if (rel > 70) chance = 0.6
                else chance = 0
                break
            case 'FREE_TRADE':
                // Needs friendly
                if (rel > 50) chance = 0.7
                else chance = 0.1
                break
            case 'SECURITY_GUARANTEE':
                // Player guaranteeing AI - they usually accept unless hostile
                if (rel > -50) chance = 0.95
                else chance = 0.1
                break
        }

        if (Math.random() < chance) {
            // Accepted!
            const agreement: Agreement = {
                id: `agr - ${Date.now()} `,
                type,
                targetCountry: countryCode,
                signedAt: Date.now()
            }

            const newAgreements = [...country.agreements, agreement]
            let newModifiers = [...country.modifiers]
            let newAllies = [...allies]

            if (type === 'MILITARY_ALLIANCE') {
                newModifiers.push('ALLIED')
                newAllies.push(countryCode)
            }

            aiCountries.set(countryCode, {
                ...country,
                agreements: newAgreements,
                modifiers: newModifiers,
                relations: Math.min(100, country.relations + 10) // Boost relations
            })

            set({
                aiCountries: new Map(aiCountries),
                allies: newAllies
            })
            return true
        }

        // Rejected - slight relation hit
        aiCountries.set(countryCode, {
            ...country,
            relations: Math.max(-100, country.relations - 2)
        })
        set({ aiCountries: new Map(aiCountries) })
        return false
    },

    setTariff: (countryCode, level) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return

        // Changing tariffs affects relations
        let relChange = 0
        if (level === 'FREE_TRADE') relChange = 10
        if (level === 'LOW') relChange = 0
        if (level === 'HIGH') relChange = -10
        if (level === 'EMBARGO') relChange = -50

        aiCountries.set(countryCode, {
            ...country,
            tariff: level,
            relations: Math.max(-100, Math.min(100, country.relations + relChange))
        })
        set({ aiCountries: new Map(aiCountries) })
    },

    breakAgreement: (countryCode, agreementId) => {
        const { aiCountries, allies } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return

        const agreement = country.agreements.find(a => a.id === agreementId)
        if (!agreement) return

        const newAgreements = country.agreements.filter(a => a.id !== agreementId)
        let newModifiers = [...country.modifiers]
        let newAllies = [...allies]

        if (agreement.type === 'MILITARY_ALLIANCE') {
            newModifiers = newModifiers.filter(m => m !== 'ALLIED')
            newAllies = newAllies.filter(c => c !== countryCode)
        }

        // Huge penalty for breaking deals
        aiCountries.set(countryCode, {
            ...country,
            agreements: newAgreements,
            modifiers: newModifiers,
            relations: Math.max(-100, country.relations - 40)
        })

        set({
            aiCountries: new Map(aiCountries),
            allies: newAllies
        })
    },

    processAITurn: () => {
        const { aiCountries, activeWars, generateAIClaim } = get()
        const events: string[] = []
        const newWars: string[] = []
        const offensives: { countryCode: string, strength: number }[] = []

        // Get player power for threat assessment
        const gameState = useGameStore.getState()
        const playerPower = gameState.nation?.stats?.power || 50
        const gameDate = gameState.gameDate || Date.now()

        // Iterate through all AI countries
        aiCountries.forEach((country, code) => {
            // Skip if annexed
            if (country.isAnnexed) return

            // === PHASE 1: STRATEGIC ASSESSMENT ===
            // Run strategy assessment (assigns personality if needed, evaluates situation)
            const strategyState = assessStrategy(country, aiCountries, playerPower, gameDate)

            // Update country with strategy state
            const updatedCountry = {
                ...country,
                strategyState
            }
            aiCountries.set(code, updatedCountry)

            // Log personality assignment (once per country)
            if (!country.strategyState?.personality) {
                console.log(`🧠 ${country.name} personality: ${strategyState.personality}, focus: ${strategyState.currentFocus}`)
            }

            // === PHASE 2: HANDLE ACTIVE WARS ===
            if (country.isAtWar) {
                // Chance to launch offensive based on personality
                let offensiveChance = 0.1

                // Expansionist/Opportunist more aggressive in war
                if (strategyState.personality === 'EXPANSIONIST') offensiveChance += 0.1
                if (strategyState.personality === 'OPPORTUNIST') offensiveChance += 0.05

                // Defensive personality less likely to offensive
                if (strategyState.personality === 'DEFENSIVE') offensiveChance -= 0.05
                if (strategyState.personality === 'ISOLATIONIST') offensiveChance -= 0.08

                // If they are losing badly (revanchism), they are desperate
                if (country.modifiers.includes('REVANCHISM')) offensiveChance += 0.1

                if (Math.random() < offensiveChance) {
                    offensives.push({
                        countryCode: code,
                        strength: country.soldiers
                    })
                    events.push(`OFFENSIVE_LAUNCHED:${code}`)
                    console.log(`🚀 OFFENSIVE by ${country.name} (${strategyState.personality})`)
                }
                return // Skip other diplomacy if at war
            }

            // Skip if allied with player
            if (country.modifiers.includes('ALLIED')) return

            // === PHASE 3: PROCESS ACTION QUEUE ===
            for (const action of strategyState.actionQueue.slice(0, 2)) {
                switch (action.type) {
                    case 'DECLARE_WAR':
                        // Only if relations are very bad
                        if (country.relations < -50) {
                            // Create war goal based on situation
                            const warGoal = country.modifiers.includes('REVANCHISM')
                                ? createWarGoal('RECONQUEST', 'PLAYER')
                                : createWarGoal('AGGRESSION', 'PLAYER')

                            newWars.push(code)
                            events.push(`WAR_DECLARED:${code}`)

                            aiCountries.set(code, {
                                ...updatedCountry,
                                disposition: 'at_war',
                                isAtWar: true,
                                warDeclaredAt: Date.now(),
                                warGoal,
                                modifiers: [...country.modifiers, 'AT_WAR'],
                                agreements: [],
                                tariff: 'EMBARGO',
                                theirTariff: 'EMBARGO'
                            })
                            console.log(`⚔️ ${country.name} declares war! (${warGoal.type})`)
                        }
                        break

                    case 'DEMAND_TERRITORY':
                        // Check for claim generation
                        if (!country.modifiers.includes('REVANCHISM') && country.relations < -20) {
                            if (Math.random() < 0.1) { // 10% chance when focusing on expansion
                                generateAIClaim(code)
                                events.push(`CLAIM_FABRICATED:${code}`)
                            }
                        }
                        break

                    case 'BUILD_MILITARY':
                        // Passively boost soldiers (simulated by not doing anything hostile)
                        break

                    case 'PROPOSE_ALLIANCE':
                    case 'TRADE_AGREEMENT':
                        // AI to AI diplomacy (future enhancement)
                        break
                }
            }

            // === PHASE 4: PERSONALITY-BASED RELATION DRIFT ===
            // Aggressive nations drift negative, peaceful drift positive
            const driftChance = 0.05
            if (Math.random() < driftChance) {
                let relationDelta = 0

                switch (strategyState.personality) {
                    case 'EXPANSIONIST':
                        relationDelta = -3 // Tend to worsen relations
                        break
                    case 'OPPORTUNIST':
                        relationDelta = country.relations > 0 ? -2 : 1 // Unstable
                        break
                    case 'DEFENSIVE':
                    case 'TRADING_POWER':
                        relationDelta = 2 // Tend to improve
                        break
                    case 'ISOLATIONIST':
                        relationDelta = 0 // No drift
                        break
                    case 'IDEOLOGICAL':
                        // Same orientation = positive, different = negative
                        const playerOrientation = 0 // Assume center for now
                        const theirOrientation = country.politicalState?.orientation || 0
                        relationDelta = Math.abs(theirOrientation - playerOrientation) > 50 ? -2 : 1
                        break
                }

                if (relationDelta !== 0) {
                    const newRelations = Math.max(-100, Math.min(100, country.relations + relationDelta))
                    aiCountries.set(code, {
                        ...aiCountries.get(code)!,
                        relations: newRelations
                    })
                }
            }

            // === PHASE 5: WAR DECLARATION CHECK (Legacy + Strategy) ===
            // Only aggressive personalities or those with claims will actually declare war
            if ((strategyState.personality === 'EXPANSIONIST' || strategyState.personality === 'OPPORTUNIST')
                && (country.relations < -50 || country.modifiers.includes('REVANCHISM'))) {

                let warChance = 0.005 // Base 0.5%

                // Personality modifiers
                if (strategyState.personality === 'EXPANSIONIST') warChance *= 2
                if (strategyState.currentFocus === 'EXPAND') warChance *= 1.5

                // Revanchism increases chance significantly
                if (country.modifiers.includes('REVANCHISM')) {
                    warChance += 0.02 + Math.min(0.1, country.territoryLost / 200)
                }

                if (Math.random() < warChance && !newWars.includes(code)) {
                    const warGoal = country.modifiers.includes('REVANCHISM')
                        ? createWarGoal('RECONQUEST', 'PLAYER')
                        : createWarGoal('TERRITORIAL', 'PLAYER')

                    newWars.push(code)
                    events.push(`WAR_DECLARED:${code}`)

                    aiCountries.set(code, {
                        ...aiCountries.get(code)!,
                        disposition: 'at_war',
                        isAtWar: true,
                        warDeclaredAt: Date.now(),
                        warGoal,
                        modifiers: [...country.modifiers, 'AT_WAR'],
                        agreements: [],
                        tariff: 'EMBARGO',
                        theirTariff: 'EMBARGO'
                    })
                    console.log(`⚔️ ${country.name} declares war: ${warGoal.description}`)
                }
            }
        })

        if (newWars.length > 0) {
            set({
                aiCountries: new Map(aiCountries),
                activeWars: [...activeWars, ...newWars]
            })
        } else {
            // Just update for relation changes and strategy state
            set({ aiCountries: new Map(aiCountries) })
        }

        return { events, wars: newWars, offensives }
    },

    updateOccupation: (countryCode, amount) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return

        const newTerritoryLost = Math.min(100, Math.max(0, country.territoryLost + amount))

        // Add Revanchism if they lost significant land
        const newModifiers = [...country.modifiers]
        if (newTerritoryLost > 5 && !newModifiers.includes('REVANCHISM')) {
            newModifiers.push('REVANCHISM')
        }

        aiCountries.set(countryCode, {
            ...country,
            territoryLost: newTerritoryLost,
            modifiers: newModifiers
        })

        set({ aiCountries: new Map(aiCountries) })
    },

    fundSeparatists: (countryCode) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return false

        // Effect: Reduce soldiers by 15-25%
        const damagePercent = 0.15 + (Math.random() * 0.10)
        const soldiersLost = Math.round(country.soldiers * damagePercent)
        const newSoldiers = Math.max(0, country.soldiers - soldiersLost)

        // Relation hit: -30
        const newRelations = Math.max(-100, country.relations - 30)

        // Disposition update
        const newDisposition = newRelations < -20 ? 'hostile' : country.disposition

        aiCountries.set(countryCode, {
            ...country,
            soldiers: newSoldiers,
            relations: newRelations,
            disposition: country.isAtWar ? 'at_war' : newDisposition
        })

        set({ aiCountries: new Map(aiCountries) })
        return true
    },

    addClaim: (countryCode, percentage) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return

        // Update claimed percentage (accumulate)
        const newClaim = Math.min(100, (country.claimedPercentage || 0) + percentage)

        // Relation hit: -10 for making a claim
        const newRelations = Math.max(-100, country.relations - 10)

        aiCountries.set(countryCode, {
            ...country,
            claimedPercentage: newClaim,
            relations: newRelations,
            // If we claim > 50%, they become hostile
            disposition: newClaim > 50 ? 'hostile' : country.disposition
        })

        set({ aiCountries: new Map(aiCountries) })
    },

    destabilizeCountry: (countryCode) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return false

        // Recalculate power
        const powerStats = calculatePower(country.soldiers, country.economy, country.authority, false)
        // Apply destabilization penalty (20% reduction)
        const newPower = Math.round(powerStats.totalPower * 0.8)

        // Relation hit: -40 (Hostile act)
        const newRelations = Math.max(-100, country.relations - 40)

        // Add modifier if not present
        const newModifiers = [...country.modifiers]
        if (!newModifiers.includes('DESTABILIZED')) {
            newModifiers.push('DESTABILIZED')
        }

        aiCountries.set(countryCode, {
            ...country,
            power: newPower,
            relations: newRelations,
            modifiers: newModifiers,
            disposition: newRelations < -20 ? 'hostile' : country.disposition
        })

        set({ aiCountries: new Map(aiCountries) })
        return true
    },

    plantPropaganda: (countryCode) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return false

        // Effect: Reduce resistance (improve relations slightly) or increase claim legitimacy
        // For now, let's say it improves relations by +15 (softening them up)
        // And adds PROPAGANDA_CAMPAIGN modifier

        const newRelations = Math.min(100, country.relations + 15)

        const newModifiers = [...country.modifiers]
        if (!newModifiers.includes('PROPAGANDA_CAMPAIGN')) {
            newModifiers.push('PROPAGANDA_CAMPAIGN')
        }

        aiCountries.set(countryCode, {
            ...country,
            relations: newRelations,
            modifiers: newModifiers,
            // Might change disposition if relations improve enough
            disposition: newRelations > -20 ? (newRelations > 50 ? 'friendly' : 'neutral') : 'hostile'
        })

        set({ aiCountries: new Map(aiCountries) })
        return true
    },

    updateCountrySoldiers: (countryCode, delta) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return

        const newSoldiers = Math.max(0, country.soldiers + delta)

        aiCountries.set(countryCode, {
            ...country,
            soldiers: newSoldiers
        })

        set({ aiCountries: new Map(aiCountries) })
    },



    // Generate a claim from AI against player
    generateAIClaim: (countryCode) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return false

        // In a real implementation, this would generate a GeoJSON polygon
        // For now, we'll simulate the effect of a claim
        // This is a "logical" claim that leads to war justification

        console.log(`⚠️ AI ${countryCode} is fabricating a claim against player!`)

        // Worsen relations significantly
        const newRelations = Math.max(-100, country.relations - 30)

        aiCountries.set(countryCode, {
            ...country,
            relations: newRelations,
            disposition: 'hostile',
            modifiers: [...country.modifiers, 'REVANCHISM'] // Add Revanchism as a marker for "wants land"
        })

        set({ aiCountries: new Map(aiCountries) })
        return true
    },

    getCountry: (code) => get().aiCountries.get(code),

    annexCountry: (countryCode) => {
        const { aiCountries, activeWars } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return

        aiCountries.set(countryCode, {
            ...country,
            isAnnexed: true,
            isAtWar: false,
            disposition: 'neutral',
            agreements: [],
            modifiers: []
        })

        set({
            aiCountries: new Map(aiCountries),
            activeWars: activeWars.filter(c => c !== countryCode)
        })
    },

    liberateCountry: (countryCode) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return

        const newModifiers = country.modifiers.filter(m => m !== 'ANNEXED')
        if (!newModifiers.includes('LIBERATED')) newModifiers.push('LIBERATED')

        aiCountries.set(countryCode, {
            ...country,
            isAnnexed: false,
            soldiers: 10000, // Reset soldiers
            territoryLost: 0,
            relations: -50, // They are still wary after annexation
            disposition: 'hostile', // Fighting for freedom
            modifiers: newModifiers
        })

        set({ aiCountries: new Map(aiCountries) })
    },

    requestSupport: (countryCode) => {
        const { aiCountries } = get()
        const country = aiCountries.get(countryCode)
        if (!country) return 0

        // Check if at war
        if (country.isAtWar) return 0

        // Check if allied or high relations
        const isAllied = country.modifiers.includes('ALLIED')
        if (!isAllied && country.relations < 50) return 0

        // Calculate support amount (5-10% of their soldiers)
        const percent = isAllied ? 0.10 : 0.05
        const supportAmount = Math.floor(country.soldiers * percent)

        if (supportAmount < 100) return 0

        // Deduct from ally
        const newSoldiers = country.soldiers - supportAmount

        // Relation hit (cost of asking)
        const relationHit = isAllied ? -5 : -15
        const newRelations = Math.max(-100, country.relations + relationHit)

        aiCountries.set(countryCode, {
            ...country,
            soldiers: newSoldiers,
            relations: newRelations
        })

        set({ aiCountries: new Map(aiCountries) })
        return supportAmount
    },

    ensureCountryInitialized: (countryCode, playerConstitution) => {
        const { aiCountries } = get()
        if (aiCountries.has(countryCode)) return

        // Special case: PLAYER code for FREEFORM mode drawn territories
        if (countryCode === 'PLAYER') {
            const { nation, consequences } = useGameStore.getState()

            // Import weighted data utility dynamically to avoid circular deps
            import('../utils/territoryWeightedData').then(({ calculateWeightedTerritoryData, calculateCulturalUnrest }) => {
                const weightedData = calculateWeightedTerritoryData(consequences)
                const initialUnrest = nation?.constitution
                    ? calculateCulturalUnrest(nation.constitution, weightedData)
                    : 0

                // Store initial unrest in gameStore (unrest state is a simple number)
                useGameStore.setState({ unrest: initialUnrest })

                const soldiers = Math.round(weightedData.population * 0.01)
                const powerStats = calculatePower(soldiers, Math.round(weightedData.prosperityIndex), 50, false)

                aiCountries.set('PLAYER', {
                    code: 'PLAYER',
                    name: nation?.name || 'Your Nation',
                    disposition: 'friendly',
                    relations: 100,
                    territoryLost: 0,
                    population: weightedData.population,
                    power: powerStats.totalPower,
                    soldiers,
                    economy: Math.round(weightedData.prosperityIndex),
                    authority: Math.round(100 - weightedData.freedomScore),
                    religion: weightedData.primaryReligion,
                    culture: weightedData.primaryCulture,
                    language: weightedData.primaryLanguage,
                    modifiers: [],
                    isAtWar: false,
                    isAnnexed: false,
                    claimedPercentage: 0,
                    politicalState: {
                        government: 'PRESIDENTIAL' as const,
                        govType: 'PRESIDENTIAL' as const,
                        orientation: 0,
                        leader: {
                            name: 'Player',
                            title: 'Leader',
                            orientation: 0,
                            popularity: 3,
                            inOfficeSince: Date.now()
                        },
                        policies: [],
                        nextElection: Date.now() + (4 * 365 * 24 * 60 * 60 * 1000),
                        stability: 100 - initialUnrest,
                        unrest: Math.ceil(initialUnrest / 20) || 1, // Convert 0-100 to 1-5 scale
                        leader_pop: 3,
                        freedom: Math.round(weightedData.freedom),
                        military: Math.round(weightedData.military),
                        aggression: 1
                    },
                    allies: [],
                    enemies: [],
                    tradePartners: [],
                    aggression: 1,
                    agreements: [],
                    tariff: 'NONE',
                    theirTariff: 'NONE',
                    // Store weighted data for display
                    weightedTerritoryData: weightedData
                } as any)

                console.log(`🏠 Initialized PLAYER nation with weighted data from ${weightedData.constituents.length} countries`)
                console.log(`📊 Weighted data:`, weightedData)
                set({ aiCountries: new Map(aiCountries) })
            })
            return
        }

        // Initialize single country (normal path)
        const realData = getCountryData(countryCode)
        const geoData = getGeopoliticalData(countryCode)
        const primaryReligion = getPrimaryReligion(countryCode)
        const primaryLanguage = getPrimaryLanguage(countryCode)
        const primaryCulture = getPrimaryCulture(countryCode)

        // Defaults if no data found
        const fallbackPop = 1000000 + Math.floor(Math.random() * 4000000)

        const population = realData?.population || fallbackPop
        const soldiers = Math.round(population * 0.01)
        const economy = realData?.economy || 50
        const authority = realData?.authority || 50

        const powerStats = calculatePower(soldiers, economy, authority, false)

        const compatibility = calculateCulturalCompatibility({
            religion: primaryReligion,
            culture: primaryCulture,
            language: primaryLanguage
        }, playerConstitution)

        // Build political state from geopolitical data
        let politicalState: PoliticalState | undefined
        let allies: string[] = []
        let enemies: string[] = []
        let tradePartners: string[] = []
        let aggression = 3

        if (geoData) {
            const govType = mapGovType(geoData.gov_type)
            const orientation = mapOrientationToNumber(geoData.orientation)
            const stability = (6 - geoData.unrest) * 20

            politicalState = {
                government: govType,
                govType, // Alias for compatibility
                orientation,
                leader: {
                    name: geoData.leader,
                    title: getTitleForGovType(geoData.gov_type),
                    orientation,
                    popularity: geoData.leader_pop,
                    inOfficeSince: Date.now()
                },
                policies: geoData.policies || [],
                nextElection: isDemocracy(govType) ? Date.now() + (365 * 24 * 60 * 60 * 1000) : undefined,
                stability,
                // Properties from geopolitical data
                unrest: geoData.unrest,
                leader_pop: geoData.leader_pop,
                freedom: geoData.freedom,
                military: geoData.military,
                aggression: geoData.aggression
            }

            allies = (geoData.allies || []).map(n => getISO3FromName(n) || n).filter(a => a !== 'None')
            enemies = (geoData.enemies || []).map(n => getISO3FromName(n) || n).filter(e => e !== 'None')
            tradePartners = (geoData.trade || []).map(n => getISO3FromName(n) || n)
            aggression = geoData.aggression || 3
        }

        aiCountries.set(countryCode, {
            code: countryCode,
            name: realData?.name || countryCode,
            disposition: 'neutral',
            relations: calculateRelations(0, compatibility),
            territoryLost: 0,
            population,
            power: powerStats.totalPower,
            soldiers,
            economy,
            authority,
            religion: primaryReligion,
            culture: primaryCulture,
            language: primaryLanguage,
            modifiers: [],
            isAtWar: false,
            isAnnexed: false,
            claimedPercentage: 0,
            politicalState,
            allies,
            enemies,
            tradePartners,
            aggression,
            agreements: [],
            tariff: 'LOW',
            theirTariff: 'LOW',
            units: []
        })

        console.log(`🆕 Initialized single country with geopolitical data: ${countryCode}`)
        set({ aiCountries: new Map(aiCountries) })
    },

    createCoalition: (name, type, requirements) => {
        const { coalitions } = get()
        const playerCountry = useGameStore.getState().selectedCountry
        if (!playerCountry) return

        const newCoalition = createCoalitionUtil(name, type, playerCountry, '#FFFFFF', requirements)
        set({ coalitions: [...coalitions, newCoalition] })

        useGameStore.getState().addDiplomaticEvents([{
            id: `coalition-create-${Date.now()}`,
            type: 'ALLIANCE',
            severity: 1,
            title: `New Coalition Formed: ${name}`,
            description: `The ${name} has been formed by ${playerCountry}.`,
            affectedNations: [playerCountry],
            timestamp: Date.now()
        }])
    },

    joinCoalition: (coalitionId) => set((state) => {
        const playerCountry = useGameStore.getState().selectedCountry
        if (!playerCountry) return {}

        // Allow multiple coalitions, just check if already in THIS one
        const coalition = state.coalitions.find(c => c.id === coalitionId)
        if (coalition && coalition.members.includes(playerCountry)) return {}

        return {
            coalitions: state.coalitions.map(c =>
                c.id === coalitionId
                    ? { ...c, members: [...c.members, playerCountry] }
                    : c
            ),
            coalitionInvites: state.coalitionInvites.filter(i => i.coalitionId !== coalitionId)
        }
    }),

    leaveCoalition: (coalitionId) => {
        const { coalitions } = get()
        const playerCountry = useGameStore.getState().selectedCountry
        if (!playerCountry) return

        const coalition = coalitions.find(c => c.id === coalitionId)
        if (!coalition) return

        const updatedMembers = coalition.members.filter(m => m !== playerCountry)

        // If empty or only 1 member left (and not player), dissolve? 
        // Or if leader leaves, assign new leader?
        let updatedCoalitions = coalitions.map(c => c.id === coalitionId ? { ...c, members: updatedMembers } : c)

        if (updatedMembers.length < 2) {
            // Dissolve if less than 2 members
            updatedCoalitions = coalitions.filter(c => c.id !== coalitionId)
            useGameStore.getState().addDiplomaticEvents([{
                id: `coalition-dissolve-${Date.now()}`,
                type: 'ALLIANCE',
                severity: 1,
                title: `${coalition.name} Dissolved`,
                description: `The ${coalition.name} has been dissolved after members left.`,
                affectedNations: coalition.members,
                timestamp: Date.now()
            }])
        } else {
            useGameStore.getState().addDiplomaticEvents([{
                id: `coalition-leave-${Date.now()}`,
                type: 'ALLIANCE',
                severity: 1,
                title: `${playerCountry} leaves ${coalition.name}`,
                description: `${playerCountry} has withdrawn from the ${coalition.name}.`,
                affectedNations: [playerCountry, ...coalition.members],
                timestamp: Date.now()
            }])
        }

        set({ coalitions: updatedCoalitions })
    },

    requestJoinCoalition: (coalitionId: string) => {
        const playerCountry = useGameStore.getState().selectedCountry

        if (!playerCountry) {
            console.warn('❌ Cannot request to join coalition: No player country selected')
            return
        }

        const { coalitions } = get()
        const coalition = coalitions.find(c => c.id === coalitionId)

        if (!coalition) return

        // Check requirements
        if (coalition.requirements) {
            const playerNation = useGameStore.getState().nation
            if (playerNation) {
                if (coalition.requirements.religion && playerNation.constitution.religion !== coalition.requirements.religion) {
                    useGameStore.getState().addDiplomaticEvents([{
                        id: `join-coalition-reject-${Date.now()}`,
                        type: 'ALLIANCE',
                        severity: 1,
                        title: 'Membership Rejected',
                        description: `You do not meet the religious requirements (${coalition.requirements.religion}) to join ${coalition.name}.`,
                        affectedNations: [coalition.leader],
                        timestamp: Date.now()
                    }])
                    return
                }
                if (coalition.requirements.culture && playerNation.constitution.culture !== coalition.requirements.culture) {
                    useGameStore.getState().addDiplomaticEvents([{
                        id: `join-coalition-reject-${Date.now()}`,
                        type: 'ALLIANCE',
                        severity: 1,
                        title: 'Membership Rejected',
                        description: `You do not meet the cultural requirements (${coalition.requirements.culture}) to join ${coalition.name}.`,
                        affectedNations: [coalition.leader],
                        timestamp: Date.now()
                    }])
                    return
                }
            }
        }

        // Calculate chance based on relations with leader
        const leader = get().aiCountries.get(coalition.leader)
        if (!leader) return

        // Base chance: 50%
        // + Relations * 0.5
        // + Power similarity?
        // For now, simple check: relations > 0
        const relations = leader.relations || 0
        const accepted = relations > 0

        if (accepted) {
            // Auto-accept if relations are positive
            set((state) => ({
                coalitions: state.coalitions.map(c =>
                    c.id === coalitionId
                        ? { ...c, members: [...c.members, playerCountry] }
                        : c
                )
            }))

            useGameStore.getState().addDiplomaticEvents([{
                id: `join-coalition-${Date.now()}`,
                type: 'ALLIANCE',
                severity: 1,
                title: 'Coalition Membership Approved',
                description: `Your request to join ${coalition.name} has been approved by ${coalition.leader}.`,
                affectedNations: [coalition.leader],
                timestamp: Date.now()
            }])
        } else {
            useGameStore.getState().addDiplomaticEvents([{
                id: `join-coalition-reject-${Date.now()}`,
                type: 'ALLIANCE',
                severity: 1,
                title: 'Coalition Membership Rejected',
                description: `Your request to join ${coalition.name} was rejected by ${coalition.leader} due to poor relations.`,
                affectedNations: [coalition.leader],
                timestamp: Date.now()
            }])
        }
    },

    inviteToCoalition: (coalitionId, countryCode) => {
        const { coalitions, coalitionInvites } = get()
        const coalition = coalitions.find(c => c.id === coalitionId)
        if (!coalition) return

        // Check if already member
        if (coalition.members.includes(countryCode)) return

        // Check if already invited
        if (coalitionInvites.some(i => i.coalitionId === coalitionId && i.targetCountry === countryCode)) return

        const newInvite = {
            id: `invite-${Date.now()}`,
            coalitionId,
            targetCountry: countryCode,
            expires: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
        }

        set({ coalitionInvites: [...coalitionInvites, newInvite] })

        // AI Logic to accept/reject immediately for simplicity?
        // Or process in processCoalitions? Let's process immediately for better UX
        const { aiCountries } = get()
        const target = aiCountries.get(countryCode)
        const leader = aiCountries.get(coalition.leader) || { politicalState: { orientation: 0, military: 3, aggression: 3, freedom: 3 } } as any // Fallback if leader is player

        if (target) {
            const chance = calculateJoinChance(coalition, target, leader)
            if (Math.random() * 100 < chance) {
                // Accept
                const updatedCoalition = { ...coalition, members: [...coalition.members, countryCode] }
                const updatedCoalitions = coalitions.map(c => c.id === coalitionId ? updatedCoalition : c)
                // Remove invite
                const updatedInvites = coalitionInvites.filter(i => i.id !== newInvite.id) // Filter out the new invite we just added (conceptually)

                set({ coalitions: updatedCoalitions, coalitionInvites: updatedInvites })

                useGameStore.getState().addDiplomaticEvents([{
                    id: `coalition-join-${Date.now()}`,
                    type: 'ALLIANCE',
                    severity: 1,
                    title: `${target.name} joins ${coalition.name}`,
                    description: `${target.name} has accepted the invitation to join ${coalition.name}.`,
                    affectedNations: [countryCode, ...coalition.members],
                    timestamp: Date.now()
                }])
            } else {
                useGameStore.getState().addDiplomaticEvents([{
                    id: `coalition-reject-${Date.now()}`,
                    type: 'DIPLOMACY',
                    severity: 1,
                    title: `${target.name} rejects invitation`,
                    description: `${target.name} has declined to join ${coalition.name}.`,
                    affectedNations: [countryCode],
                    timestamp: Date.now()
                }])
            }
        }
    },

    kickFromCoalition: (coalitionId, countryCode) => {
        const { coalitions } = get()
        const coalition = coalitions.find(c => c.id === coalitionId)
        if (!coalition) return

        const updatedMembers = coalition.members.filter(m => m !== countryCode)
        const updatedCoalitions = coalitions.map(c => c.id === coalitionId ? { ...c, members: updatedMembers } : c)

        set({ coalitions: updatedCoalitions })

        useGameStore.getState().addDiplomaticEvents([{
            id: `coalition-kick-${Date.now()}`,
            type: 'ALLIANCE',
            severity: 2,
            title: `${countryCode} expelled from ${coalition.name}`,
            description: `${countryCode} has been kicked out of the ${coalition.name}.`,
            affectedNations: [countryCode, ...coalition.members],
            timestamp: Date.now()
        }])
    },

    processCoalitions: () => {
        // Auto-seed if not initialized (migration for existing saves)
        const { coalitionsInitialized, aiCountries, coalitions } = get()
        if (!coalitionsInitialized && aiCountries.size > 0 && coalitions.length === 0) {
            console.log('🌍 Auto-seeding coalitions for existing save...')
            const playerCountry = useGameStore.getState().selectedCountry || undefined
            const seeded = seedRealWorldCoalitions(aiCountries, playerCountry)
            set({
                coalitions: seeded,
                coalitionsInitialized: true
            })

            if (seeded.length > 0) {
                useGameStore.getState().addDiplomaticEvents([{
                    id: `coalition-seed-${Date.now()}`,
                    type: 'ALLIANCE',
                    severity: 1,
                    title: 'Global Alliances Formed',
                    description: 'Major powers have formalized their alliances into official coalitions.',
                    affectedNations: seeded.map(c => c.leader),
                    timestamp: Date.now()
                }])
            }
        } else if (!coalitionsInitialized) {
            set({ coalitionsInitialized: true })
        }

        // Handle AI coalition logic here (leaving, forming new ones)
        // For now, just cleanup expired invites
        const { coalitionInvites } = get()
        const now = Date.now()
        const validInvites = coalitionInvites.filter(i => i.expires > now)

        if (validInvites.length !== coalitionInvites.length) {
            set({ coalitionInvites: validInvites })
        }
    },

    processElections: () => {
        const { aiCountries } = get()
        const { addDiplomaticEvents, gameDate } = useGameStore.getState()
        const events: any[] = []
        const FOUR_YEARS = 4 * 365 * 24 * 60 * 60 * 1000 // 4 years in ms

        // Import election system functions
        import('../utils/electionSystem').then(({
            calculateElectionChance,
            runElection,
            calculateCoupChance,
            executeCoup,
            calculateRevolutionChance,
            triggerRevolution
        }) => {
            aiCountries.forEach((country, code) => {
                if (!country.politicalState) return

                // Check for revolution first (highest priority)
                const revolutionChance = calculateRevolutionChance(country)
                if (Math.random() < revolutionChance) {
                    const result = triggerRevolution(country)

                    // Update country
                    country.politicalState.leader = result.newLeader
                    country.politicalState.orientation = result.newOrientation as any
                    country.politicalState.govType = result.newGovType
                    country.politicalState.unrest = Math.max(1, Math.min(5, country.politicalState.unrest + result.unrestChange))
                    country.politicalState.leader_pop = 3 // Reset to neutral

                    // Generate event
                    events.push({
                        id: `revolution-${code}-${Date.now()}`,
                        type: 'REGIME_CHANGE' as any,
                        severity: 3,
                        title: `🔥 REVOLUTION in ${country.name}!`,
                        description: `${result.newLeader} has seized power after massive uprising. The government has been completely overthrown.${result.civilWar ? ' Civil war has erupted!' : ''}`,
                        affectedNations: [code],
                        timestamp: Date.now()
                    })
                    return
                }

                // Check for coup
                const coupChance = calculateCoupChance(country)
                if (Math.random() < coupChance) {
                    const result = executeCoup(country)

                    // Update country
                    country.politicalState.leader = result.newLeader
                    country.politicalState.orientation = result.newOrientation as any
                    country.politicalState.govType = result.newGovType
                    country.politicalState.unrest = Math.max(1, Math.min(5, country.politicalState.unrest + result.unrestIncrease))
                    country.politicalState.leader_pop = 2 // Low initial popularity

                    // Generate event
                    events.push({
                        id: `coup-${code}-${Date.now()}`,
                        type: 'COUP' as any,
                        severity: 2,
                        title: `⚠️ COUP in ${country.name}!`,
                        description: `${result.newLeader} has seized power in a military coup. Unrest is rising.${result.civilWarRisk > 0.5 ? ' Risk of civil war!' : ''}`,
                        affectedNations: [code],
                        timestamp: Date.now()
                    })
                    return
                }

                // Check for normal election
                const electionChance = calculateElectionChance(country, gameDate)
                if (Math.random() < electionChance) {
                    const currentLeader = country.politicalState.leader
                    const result = runElection(country)

                    const incumbent = result.winner === currentLeader

                    // Update country
                    country.politicalState.leader = result.winner
                    country.politicalState.orientation = result.newOrientation as any
                    country.politicalState.leader_pop = Math.max(1, Math.min(5, country.politicalState.leader_pop + result.popularityChange))
                    country.politicalState.unrest = Math.max(1, Math.min(5, country.politicalState.unrest + result.unrestChange))

                    // Schedule next election 4 years from now
                    country.politicalState.nextElection = gameDate + FOUR_YEARS

                    if (result.governmentTypeChange) {
                        country.politicalState.govType = result.governmentTypeChange
                    }

                    // Generate event
                    const orientationLabel = result.newOrientation < -50 ? 'Far-Left' :
                        result.newOrientation < -20 ? 'Center-Left' :
                            result.newOrientation < 20 ? 'Centrist' :
                                result.newOrientation < 50 ? 'Center-Right' : 'Far-Right'

                    events.push({
                        id: `election-${code}-${Date.now()}`,
                        type: 'POLITICAL_CHANGE' as any,
                        severity: 1,
                        title: `${incumbent ? '📊' : '🗳️'} Election in ${country.name}`,
                        description: `${result.winner} ${incumbent ? 're-elected' : 'elected'}. Political orientation: ${orientationLabel}.${result.governmentTypeChange ? ` Government changed to ${result.governmentTypeChange}.` : ''}`,
                        affectedNations: [code],
                        timestamp: Date.now()
                    })
                }
            })

            // Update store and post events
            set({ aiCountries: new Map(aiCountries) })
            if (events.length > 0) {
                addDiplomaticEvents(events)
                console.log(`🗳️ Processed ${events.length} political events`)
            }
        })
    },

    // Process AI vs AI wars
    processAIvsAI: () => {
        const { aiCountries, aiWars, aiTerritories: _aiTerritories } = get() // _aiTerritories will be used for territory transfer
        const events: Array<{ type: string, attackerCode: string, defenderCode: string }> = []
        const newWars: typeof aiWars = [...aiWars]

        // 1. Check for new war declarations between AI countries
        aiCountries.forEach((attacker, attackerCode) => {
            if (attacker.isAnnexed || attacker.isAtWar) return

            // Dynamic Enemy Finding: If aggressive but no enemies, find one!
            if ((!attacker.enemies || attacker.enemies.length === 0) && attacker.aggression >= 3) {
                if (Math.random() < 0.2) { // 20% chance to pick a fight every check (30s)
                    const { aiTerritories } = get()
                    const attackerPoly = aiTerritories.get(attackerCode)

                    const potentialTargets = Array.from(aiCountries.values()).filter(c => {
                        if (c.code === attackerCode || c.isAnnexed) return false

                        // Power check: Don't rival someone > 3x your size unless you are very aggressive (5)
                        const powerRatio = c.power / (attacker.power || 1)
                        if (powerRatio > 3 && attacker.aggression < 5) return false

                        // Distance Check
                        if (attackerPoly) {
                            const targetPoly = aiTerritories.get(c.code)
                            if (targetPoly) {
                                // Simple centroid distance check
                                const p1 = turf.centroid(attackerPoly as any)
                                const p2 = turf.centroid(targetPoly as any)
                                const dist = turf.distance(p1, p2, { units: 'kilometers' })

                                // Only rival neighbors or close countries (< 3000km)
                                // Unless super aggressive world power
                                if (dist > 3000 && attacker.power < 500) return false
                            }
                        }

                        // Safe access to orientation
                        const startOrientation = attacker.politicalState?.orientation ?? 0
                        const targetOrientation = c.politicalState?.orientation ?? 0

                        return Math.abs(startOrientation - targetOrientation) > 30 // Lower threshold
                    })

                    if (potentialTargets.length > 0) {
                        const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)]
                        if (!attacker.enemies) attacker.enemies = []
                        attacker.enemies.push(target.code) // Add rivalry

                        // Mutual rivalry
                        const targetCountry = aiCountries.get(target.code)
                        if (targetCountry) {
                            if (!targetCountry.enemies) targetCountry.enemies = []
                            if (!targetCountry.enemies.includes(attackerCode)) {
                                targetCountry.enemies.push(attackerCode)
                            }
                        }

                        console.log(`🔥 Tension rising: ${attacker.name} rivals ${target.name}`)
                    }
                }
            }

            // Check enemies list for potential war targets
            for (const enemyName of (attacker.enemies || [])) {
                // Find enemy by name or code
                let enemyCode: string | undefined
                aiCountries.forEach((country, code) => {
                    if (country.name === enemyName || code === enemyName) {
                        enemyCode = code
                    }
                })

                if (!enemyCode) continue
                const defender = aiCountries.get(enemyCode)
                if (!defender || defender.isAnnexed) continue

                // Check if already at war with this country
                const alreadyAtWar = newWars.some(
                    w => w.status === 'active' &&
                        ((w.attackerCode === attackerCode && w.defenderCode === enemyCode) ||
                            (w.defenderCode === attackerCode && w.attackerCode === enemyCode))
                )
                if (alreadyAtWar) continue

                // War declaration chance
                let warChance = 0.05
                if (attacker.aggression >= 4) warChance += 0.05
                if (attacker.aggression >= 5) warChance += 0.10
                if (attacker.territoryLost > 10) warChance += 0.05

                const { aiTerritories } = get()
                const attackerPoly = aiTerritories.get(attackerCode)
                const defenderPoly = aiTerritories.get(defender.code)

                if (attackerPoly && defenderPoly) {
                    const p1 = turf.centroid(attackerPoly as any)
                    const p2 = turf.centroid(defenderPoly as any)
                    const dist = turf.distance(p1, p2, { units: 'kilometers' })

                    if (dist > 4000 && attacker.territoryLost < 10) warChance = 0
                    else if (dist > 2000 && attacker.aggression < 5) warChance *= 0.2
                }

                // Power Balance Check
                const powerRatio = defender.power / (attacker.power || 1)
                if (powerRatio > 1.5 && attacker.territoryLost < 20) warChance *= 0.5
                if (powerRatio > 2.0 && attacker.territoryLost < 10) warChance = 0

                if (Math.random() < warChance) {
                    // GENERATE WAR PLAN (Visual Arrow)
                    // Simple straight line from attacker centroid to defender centroid
                    let planFeature: any = null
                    if (attackerPoly && defenderPoly) {
                        const p1 = turf.centroid(attackerPoly as any).geometry.coordinates
                        const p2 = turf.centroid(defenderPoly as any).geometry.coordinates
                        planFeature = {
                            type: 'Feature',
                            properties: {
                                id: `plan-${Date.now()}`,
                                type: 'OFFENSE', // Red arrow
                                attackerCode
                            },
                            geometry: {
                                type: 'LineString',
                                coordinates: [p1, p2]
                            }
                        }
                    }

                    // Declare war!
                    const war: import('../types/game').AIWar = {
                        id: `aiwar-${attackerCode}-${enemyCode}-${Date.now()}`,
                        attackerCode,
                        defenderCode: enemyCode,
                        startTime: Date.now(),
                        lastBattleTime: 0,
                        status: 'active',
                        attackerGain: 0,
                        defenderGain: 0,
                        // New properties for UI
                        planArrow: planFeature,
                        casualties: { attacker: 0, defender: 0 }
                    }
                    newWars.push(war)
                    events.push({ type: 'WAR_DECLARED', attackerCode, defenderCode: enemyCode })

                    console.log(`⚔️ AI War: ${attacker.name} declared war on ${defender.name}!`)

                    // Trigger Alliance Response (Article 5)
                    get().triggerAllianceResponse(enemyCode, attackerCode)
                }
            }
        })

        // 2. Process active AI wars - USING FULL SIMULATION
        import('../utils/warSystem').then(({ simulateWar }) => {
            for (const war of newWars) {
                if (war.status !== 'active') continue

                // SPEED UP: Battle every 10 seconds to make it dynamic
                const timeSinceLastBattle = Date.now() - war.lastBattleTime
                if (timeSinceLastBattle < 10000) continue

                const attacker = aiCountries.get(war.attackerCode)
                const defender = aiCountries.get(war.defenderCode)
                if (!attacker || !defender) continue

                // --- ADVANCED BATTLE SIMULATION ---
                // We use 5% of their forces per "battle step"
                const attSoldiers = Math.floor(attacker.soldiers * 0.05)
                const defSoldiers = Math.floor(defender.soldiers * 0.05)

                if (attSoldiers < 100 || defSoldiers < 100) {
                    // One side has collapsed
                    war.status = 'peace'

                    const winner = attSoldiers > defSoldiers ? attacker : defender
                    const loser = attSoldiers > defSoldiers ? defender : attacker

                    events.push({
                        type: 'PEACE_TREATY',
                        attackerCode: winner.code, // reusing fields: attacker=winner
                        defenderCode: loser.code   // defender=loser
                    })
                    console.log(`🕊️ War ended: ${winner.name} defeats ${loser.name}`)
                    continue
                }

                // Generate Stats (Simplified: Aggression/Tech based)
                // Just use default stats but scaled by generic military score if available
                const getStats = (c: import('../types/game').AICountry) => ({
                    attack: 10 + (c.politicalState?.military || 0) * 2,
                    defense: 10 + (c.politicalState?.military || 0) * 2,
                    mobility: 10,
                    morale: 100
                })

                const result = simulateWar(
                    attSoldiers, // 5% chunk
                    defSoldiers,
                    'SKIRMISH',
                    0, // defense bonus
                    {
                        attackerStats: getStats(attacker),
                        defenderStats: getStats(defender)
                    }
                )

                // Apply Results
                const attLoss = result.attackerTotalLosses
                const defLoss = result.defenderTotalLosses

                attacker.soldiers = Math.max(0, attacker.soldiers - attLoss)
                defender.soldiers = Math.max(0, defender.soldiers - defLoss)

                // Track total casualties
                if (!war.casualties) war.casualties = { attacker: 0, defender: 0 }
                war.casualties.attacker += attLoss
                war.casualties.defender += defLoss

                // Calculate Territory Gain based on "Winner" of this skirmish
                // Who lost less % of their committed force?
                const attLossPct = attLoss / attSoldiers
                const defLossPct = defLoss / defSoldiers

                let gain = 0
                if (attLossPct < defLossPct) {
                    // Attacker won
                    gain = 1 + Math.round((defLossPct - attLossPct) * 20) // 1-5% gain
                    war.attackerGain += gain
                    war.defenderGain = Math.max(0, war.defenderGain - gain)

                    console.log(`⚔️ ${attacker.name} advances! (+${gain}%) - Cas: ${attLoss} vs ${defLoss}`)
                } else {
                    // Defender won
                    gain = 1 + Math.round((attLossPct - defLossPct) * 20)
                    war.defenderGain += gain
                    war.attackerGain = Math.max(0, war.attackerGain - gain)
                    console.log(`🛡️ ${defender.name} repels! (+${gain}%) - Cas: ${attLoss} vs ${defLoss}`)
                }

                // Update Power Score
                const getPower = (c: any) => (c.soldiers / 1000) + (c.economy * 5) + (c.authority * 2)
                attacker.power = getPower(attacker)
                defender.power = getPower(defender)

                // Visual Territory Transfer (Same as before but using calculated gain)
                const { aiTerritories } = get()
                const attackerPoly = aiTerritories.get(war.attackerCode)
                const defenderPoly = aiTerritories.get(war.defenderCode)

                if (attackerPoly && defenderPoly && gain > 0) {
                    // Determine winner/loser for this turn
                    const winnerPoly = attLossPct < defLossPct ? attackerPoly : defenderPoly
                    const loserPoly = attLossPct < defLossPct ? defenderPoly : attackerPoly
                    const intensity = Math.min(0.05, gain / 100)

                    import('../utils/territoryUtils').then(({ calculateConquest, subtractTerritory, mergeTerritory }) => {
                        const conquest = calculateConquest(winnerPoly as any, loserPoly as any, intensity)
                        if (conquest) {
                            const newLoser = subtractTerritory(loserPoly as any, conquest as any)
                            const newWinner = mergeTerritory(winnerPoly as any, conquest as any)

                            if (newLoser && newWinner) {
                                const newMap = new Map(aiTerritories)
                                newMap.set(attLossPct < defLossPct ? war.defenderCode : war.attackerCode, newLoser as any)
                                newMap.set(attLossPct < defLossPct ? war.attackerCode : war.defenderCode, newWinner as any)
                                set({ aiTerritories: newMap })
                            }
                        }
                    })
                }

                war.lastBattleTime = Date.now()

                // Check End Conditions
                if (war.attackerGain >= 90) { // Total Annexation
                    import('../store/worldStore').then(store => store.useWorldStore.getState().annexCountry(war.defenderCode))
                    war.status = 'peace'
                    events.push({
                        type: 'PEACE_TREATY',
                        attackerCode: attacker.code,
                        defenderCode: defender.code
                    })
                }
                else if (war.attackerGain >= 50) { // Forced peace
                    war.status = 'peace'
                    events.push({
                        type: 'PEACE_TREATY',
                        attackerCode: attacker.code,
                        defenderCode: defender.code
                    })
                }
            }
        })

        // Remove ended wars
        const activeWarsOnly = newWars.filter(w => w.status === 'active')

        set({
            aiWars: activeWarsOnly
        })

        return { events, wars: activeWarsOnly }
    },

    reset: () => set({
        aiCountries: new Map(),
        aiTerritories: new Map(),
        aiWars: [],
        activeWars: [],
        allies: [],
    }),

    // Article 5: Collective Defense
    triggerAllianceResponse: (defenderCode: string, attackerCode: string) => {
        const { coalitions, aiCountries } = get()
        const defender = aiCountries.get(defenderCode)
        if (!defender) return

        // 1. Find if defender is in a MILITARY coalition
        const alliance = coalitions.find(c =>
            c.type === 'MILITARY' && c.members.includes(defenderCode)
        )

        if (!alliance) return

        console.log(`🛡️ ARTICLE 5 TRIGGERED: ${alliance.name} defending ${defender.name} against ${attackerCode}`)

        // 2. Notify Player via Event
        useGameStore.getState().addDiplomaticEvents([{
            id: `article5-${Date.now()}`,
            type: 'ALLIANCE',
            severity: 3, // CRITICAL
            title: `ARTICLE 5 INVOKED: ${alliance.name}`,
            description: `${defender.name} has invoked Article 5! The entire ${alliance.name} coalition is mobilizing against ${attackerCode}.`,
            affectedNations: alliance.members,
            timestamp: Date.now()
        }])

        // 3. Mobilize Allies
        const allies = alliance.members.filter(m => m !== defenderCode)
        const reinforcementPerAlly = 5000 // 5k troops per ally sent to defender
        let totalReinforcements = 0

        allies.forEach(allyCode => {
            // A. Declare War on Attacker
            if (attackerCode === 'PLAYER') {
                // If player is attacker, ally declares war on player
                const ally = aiCountries.get(allyCode)
                if (ally && !ally.isAtWar) {
                    get().declareWar(allyCode) // This sets them to AT_WAR state
                    // Make sure they target player? declareWar handles state, but we might need explicit "war on player" flag in future
                }
            } else {
                // AI vs AI: Ally declares war on AI Attacker
                // Check if already at war
                const { aiWars } = get()
                const alreadyAtWar = aiWars.some(w =>
                    (w.attackerCode === allyCode && w.defenderCode === attackerCode) ||
                    (w.defenderCode === allyCode && w.attackerCode === attackerCode)
                )

                if (!alreadyAtWar) {
                    // Create new war
                    const war: import('../types/game').AIWar = {
                        id: `aiwar-${allyCode}-${attackerCode}-${Date.now()}`,
                        attackerCode: allyCode,
                        defenderCode: attackerCode,
                        startTime: Date.now(),
                        lastBattleTime: 0,
                        status: 'active',
                        attackerGain: 0,
                        defenderGain: 0,
                        casualties: { attacker: 0, defender: 0 }
                    }
                    set(state => ({ aiWars: [...state.aiWars, war] }))
                }
            }

            // B. Send Reinforcements (Abstracted)
            totalReinforcements += reinforcementPerAlly
        })

        // 4. Boost Defender
        // They get a massive influx of "high quality" troops (just raw numbers for now, maybe morale boost later)
        const newSoldiers = defender.soldiers + totalReinforcements
        const newModifiers = [...defender.modifiers]
        if (!newModifiers.includes('MILITARY_QUALITY')) newModifiers.push('MILITARY_QUALITY') // Boost quality/stats implied

        aiCountries.set(defenderCode, {
            ...defender,
            soldiers: newSoldiers,
            modifiers: newModifiers
        })

        set({ aiCountries: new Map(aiCountries) })

        console.log(`⚔️ ${defender.name} reinforced with ${totalReinforcements} troops from ${alliance.name}`)
    },

    surrenderToCoalition: (coalitionId: string, surrenderingCountryCode: string) => {
        const { coalitions, aiCountries } = get()
        const coalition = coalitions.find(c => c.id === coalitionId)
        if (!coalition) return

        const surrenderingCountry = aiCountries.get(surrenderingCountryCode)
        if (!surrenderingCountry) return

        let endedWarsCount = 0

        // Iterate through all members and make peace
        coalition.members.forEach(memberCode => {
            if (memberCode === surrenderingCountryCode) return

            // Check if at war
            const member = aiCountries.get(memberCode)
            if (member && member.enemies.includes(surrenderingCountryCode)) {
                // Force peace
                get().makePeace(memberCode) // This will handle the reverse as well (surrendering -> member) if implemented symmetrically

                // If the surrendering country is the player, we might need to manually ensure peace with AI
                // The current makePeace mostly clears "AT_WAR" status for the single country passed, 
                // but we need to ensure the war object is removed. `makePeace` does filter `activeWars`.
                // However, for AI vs AI, we need to remove from `aiWars`.

                const { aiWars } = get()
                const updatedWars = aiWars.map(w => {
                    if ((w.attackerCode === surrenderingCountryCode && w.defenderCode === memberCode) ||
                        (w.defenderCode === surrenderingCountryCode && w.attackerCode === memberCode)) {
                        return { ...w, status: 'peace' } as any
                    }
                    return w
                })
                // Filter out peace wars if necessary or just update status
                // Actually makePeace removes from activeWars (player wars). 
                // We should likely ensure AI wars are also cleared if this involves AI.

                set({ aiWars: updatedWars })
                endedWarsCount++
            }
        })

        if (endedWarsCount > 0) {
            // Apply Humiliation
            const currentModifiers = surrenderingCountry.modifiers.filter(m => m !== 'AT_WAR')
            if (!currentModifiers.includes('HUMILIATED')) currentModifiers.push('HUMILIATED')

            aiCountries.set(surrenderingCountryCode, {
                ...surrenderingCountry,
                modifiers: currentModifiers,
                disposition: 'neutral',
                isAtWar: false
            })
            set({ aiCountries: new Map(aiCountries) })

            // Log Event
            useGameStore.getState().addDiplomaticEvents([{
                id: `surrender-${Date.now()}`,
                type: 'PEACE_TREATY',
                severity: 2,
                title: `Unconditional Surrender`,
                description: `${surrenderingCountry.name} has surrendered to the ${coalition.name}! They have been humiliated and forced to accept peace.`,
                affectedNations: [surrenderingCountryCode, ...coalition.members],
                timestamp: Date.now()
            }])
            console.log(`🏳️ ${surrenderingCountry.name} surrendered to ${coalition.name}`)
        }
    }

}))
