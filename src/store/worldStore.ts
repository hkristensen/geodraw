import { create } from 'zustand'
import type { AICountry, Disposition, Constitution, Agreement } from '../types/game'
import type { WorldState } from '../types/store'
import { getCountryData, getPrimaryReligion, getPrimaryLanguage, getPrimaryCulture } from '../utils/countryData'
import { calculatePower } from '../utils/powerSystem'


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
    activeWars: [],
    allies: [],

    initializeAICountries: (consequences, playerConstitution) => {
        const countries = new Map<string, AICountry>()

        for (const c of consequences) {
            // Get real data from GeoJSON files
            const realData = getCountryData(c.countryCode)
            const primaryReligion = getPrimaryReligion(c.countryCode)
            const primaryLanguage = getPrimaryLanguage(c.countryCode)
            const primaryCulture = getPrimaryCulture(c.countryCode)

            // Generic Revanchism: If they lost > 5% of their land, they want it back
            const hasRevanchism = c.lostPercentage > 5

            // Use real data if available, with fallbacks
            const population = realData?.population || c.population || 1000000
            const remainingRatio = (100 - c.lostPercentage) / 100

            // Power based on real prosperity/economy data
            // const basePower = realData?.power || Math.round(Math.log10(population + 1) * 10)
            // const adjustedPower = Math.round(basePower * remainingRatio) // Legacy power calculation

            // Soldiers: 1% of remaining population
            const soldiers = Math.round(population * remainingRatio * 0.01)

            // Economy from real GNI data
            const economy = realData?.economy || 50

            // Authority from real freedom data
            const authority = realData?.authority || 50

            // Calculate Power using unified system
            const powerStats = calculatePower(soldiers, economy, authority, false)

            const compatibility = calculateCulturalCompatibility({
                religion: primaryReligion,
                culture: primaryCulture,
                language: primaryLanguage
            }, playerConstitution)

            countries.set(c.countryCode, {
                code: c.countryCode,
                name: c.countryName,
                disposition: calculateDisposition(c.lostPercentage, hasRevanchism),
                relations: calculateRelations(c.lostPercentage, compatibility),
                territoryLost: c.lostPercentage,
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
                agreements: [],
                tariff: 'LOW', // Default low tariff
                theirTariff: 'LOW'
            })
        }

        console.log('🌍 Initialized AI countries with real data:', countries.size)
        set({ aiCountries: countries })
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

        // Iterate through all AI countries
        aiCountries.forEach((country, code) => {
            // Skip if annexed
            if (country.isAnnexed) return

            // 0. Handle Active Wars (AI Offensives)
            if (country.isAtWar) {
                // Chance to launch offensive: 10% per tick (every 30s)
                // Increased if they are stronger or desperate
                let offensiveChance = 0.1

                // If they are losing badly (revanchism), they are desperate
                if (country.modifiers.includes('REVANCHISM')) offensiveChance += 0.1

                if (Math.random() < offensiveChance) {
                    offensives.push({
                        countryCode: code,
                        strength: country.soldiers // Use soldiers as strength metric
                    })
                    events.push(`OFFENSIVE_LAUNCHED:${code} `)
                }
                return // Skip other diplomacy if at war
            }

            // Skip if allied
            if (country.modifiers.includes('ALLIED')) return

            // 1. Check for Claim Generation (Fabrication)
            // Conditions: Hostile (< -20) and no existing claim (Revanchism)
            if (country.relations < -20 && !country.modifiers.includes('REVANCHISM')) {
                if (Math.random() < 0.05) { // 5% chance per turn
                    generateAIClaim(code)
                    events.push(`CLAIM_FABRICATED:${code} `)
                }
            }

            // 2. Check for War Declaration
            // Conditions: Hostile relations (< -50) OR Revanchism
            if (country.relations < -50 || country.modifiers.includes('REVANCHISM')) {
                // Base chance 2% per turn
                let warChance = 0.02

                // Increase chance if very hostile
                if (country.relations < -80) warChance += 0.03

                // Increase chance if they have Revanchism (Claim)
                if (country.modifiers.includes('REVANCHISM')) {
                    // Scale aggression with territory lost
                    // If they lost 50% of land, they are VERY desperate (20% chance per turn)
                    // If they lost 5%, they are annoyed (5% chance)
                    const desperation = Math.min(0.2, country.territoryLost / 200)
                    warChance += 0.05 + desperation
                }

                if (Math.random() < warChance) {
                    // Declare war!
                    newWars.push(code)
                    events.push(`WAR_DECLARED:${code} `)

                    // Update country state
                    aiCountries.set(code, {
                        ...country,
                        disposition: 'at_war',
                        isAtWar: true,
                        warDeclaredAt: Date.now(),
                        modifiers: [...country.modifiers, 'AT_WAR'],
                        agreements: [], // Break all deals
                        tariff: 'EMBARGO',
                        theirTariff: 'EMBARGO'
                    })
                }
            } else if (country.relations < 0) {
                // Chance to worsen relations if already negative
                if (Math.random() < 0.1) {
                    const newRelations = Math.max(-100, country.relations - 5)
                    aiCountries.set(code, {
                        ...country,
                        relations: newRelations
                    })
                }
            } else {
                // Small chance to improve relations if positive
                if (Math.random() < 0.05) {
                    const newRelations = Math.min(100, country.relations + 2)
                    aiCountries.set(code, {
                        ...country,
                        relations: newRelations
                    })
                }
            }
        })

        if (newWars.length > 0) {
            set({
                aiCountries: new Map(aiCountries),
                activeWars: [...activeWars, ...newWars]
            })
        } else {
            // Just update for relation changes
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

        // Initialize single country
        const realData = getCountryData(countryCode)
        const primaryReligion = getPrimaryReligion(countryCode)
        const primaryLanguage = getPrimaryLanguage(countryCode)
        const primaryCulture = getPrimaryCulture(countryCode)

        // Defaults if no data found
        // Randomize population slightly if unknown to avoid everyone having 1M
        const fallbackPop = 1000000 + Math.floor(Math.random() * 4000000)

        const population = realData?.population || fallbackPop
        // const basePower = realData?.power || Math.round(Math.log10(population + 1) * 10) // Legacy
        const soldiers = Math.round(population * 0.01)
        const economy = realData?.economy || 50
        const authority = realData?.authority || 50

        const powerStats = calculatePower(soldiers, economy, authority, false)

        const compatibility = calculateCulturalCompatibility({
            religion: primaryReligion,
            culture: primaryCulture,
            language: primaryLanguage
        }, playerConstitution)

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
            agreements: [],
            tariff: 'LOW',
            theirTariff: 'LOW'
        })

        console.log(`🆕 Initialized single country: ${countryCode} `)
        set({ aiCountries: new Map(aiCountries) })
    },

    reset: () => set({
        aiCountries: new Map(),
        activeWars: [],
        allies: [],
    })
}))
