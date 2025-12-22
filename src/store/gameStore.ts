import { create } from 'zustand'
import * as turf from '@turf/turf'
import { calculateInfrastructure } from '../utils/infrastructure'
import {
    DiplomaticEvent,
    ActiveBattle
} from '../types/game'
import type { GameState } from '../types/store'
import { useWorldStore } from './worldStore'
import { calculatePower } from '../utils/powerSystem'
import { simulateWar } from '../utils/warSystem'
import { calculateIncome, calculateExpenses } from '../utils/economy'
import countriesData from '../data/countries.json'

export const useGameStore = create<GameState>((set) => ({
    phase: 'SETUP',
    gameDate: new Date('2025-01-01').getTime(),
    userPolygon: null,
    playerTerritories: [],
    consequences: [],
    capturedCities: [],
    infrastructureStats: null,
    diplomaticEvents: [],
    modifiers: [],
    nation: null,
    currentClaim: null,
    pendingInvasion: null,
    selectedCountry: null,
    annexedCountries: [],
    activeClaims: [],
    isCalculating: false,
    showResults: false,
    buildingMode: null,
    selectedClaimId: null,
    activeBattles: [],
    currentEvent: null,
    gameOver: false,
    isDrawing: false,

    // New Systems
    researchPoints: 0,
    unlockedTechs: [],
    activePolicies: [],
    unrest: 0,
    factions: [],
    infrastructureLoaded: false,

    // Economic Cycle
    economicCycle: null,

    // Victory Tracking
    victoriesAchieved: [],
    consecutiveMonthsAsTopPower: 0,
    consecutiveMonthsAsTopGDP: 0,
    achievementsUnlocked: [],

    // War Exhaustion Tracking
    totalWarCasualties: 0,
    monthsAtWar: 0,

    gameSettings: null,
    selectedCountryName: null,

    setPhase: (phase) => set({ phase }),
    setGameSettings: (settings) => set({ gameSettings: settings }),
    setSelectedCountryName: (name) => set({ selectedCountryName: name }),
    setIsDrawing: (isDrawing) => set({ isDrawing }),

    setUserPolygon: (polygon) => set({
        userPolygon: polygon,
        playerTerritories: polygon ? [polygon] : [],
    }),

    // Merge new territory with existing using turf.union
    addTerritory: (territory) => set((state) => {
        let newTerritories: GeoJSON.Feature[] = []

        if (state.playerTerritories.length === 0) {
            newTerritories = [territory]
        } else {
            try {
                // Get current combined territory
                const combined = state.playerTerritories[0]

                // Merge with new territory using turf.union
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const merged = turf.union(turf.featureCollection([combined, territory]) as any)

                if (merged) {
                    console.log('🔗 Merged territory with existing land')
                    newTerritories = [merged as GeoJSON.Feature]
                } else {
                    newTerritories = [...state.playerTerritories, territory]
                }
            } catch (e) {
                console.warn('⚠️ Could not merge territory:', e)
                newTerritories = [...state.playerTerritories, territory]
            }
        }

        // Recalculate infrastructure stats for the new territory
        const mainPolygon = newTerritories[0] as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
        const newInfraStats = calculateInfrastructure(mainPolygon)
        console.log('🏭 Recalculated infrastructure stats:', newInfraStats)

        // Update nation stats if nation exists
        let newNation = state.nation
        if (newNation) {
            // Recalculate derived stats
            const newWealth = newInfraStats.totalPopulation * 10 + newInfraStats.totalPorts * 5000000 + newInfraStats.totalAirports * 10000000
            const newManpower = Math.floor(newInfraStats.totalPopulation * 0.05) // 5% manpower

            // Adjust soldiers if they exceed manpower (desertion/disbanding)
            let newSoldiers = newNation.stats.soldiers
            if (newSoldiers > newManpower) {
                newSoldiers = newManpower
            }

            // Recalculate Power
            const powerStats = calculatePower(newSoldiers, newWealth, newNation.stats.diplomaticPower, true)

            newNation = {
                ...newNation,
                stats: {
                    ...newNation.stats,
                    wealth: newWealth,
                    manpower: newManpower,
                    soldiers: newSoldiers,
                    power: powerStats.totalPower
                }
            }
        }

        return {
            playerTerritories: newTerritories,
            infrastructureStats: newInfraStats,
            nation: newNation
        }
    }),

    removeTerritory: (territory) => set((state) => {
        if (state.playerTerritories.length === 0) return {}

        try {
            const currentPoly = state.playerTerritories[0]
            // Use turf.difference to subtract the lost territory
            const newPoly = turf.difference(turf.featureCollection([currentPoly, territory]) as any)

            if (!newPoly) {
                console.warn('⚠️ Territory removal resulted in null geometry (wiped out?)')
                return { playerTerritories: [], gameOver: true }
            }

            // Recalculate stats
            // Recalculate stats
            const newInfraStats = calculateInfrastructure(newPoly as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)

            // Check for liberation of annexed countries
            const { annexedCountries, addDiplomaticEvents } = state
            const remainingAnnexed: string[] = []
            const liberated: string[] = []

            annexedCountries.forEach(code => {
                const countryFeature = (countriesData as any).features.find((f: any) => f.properties.iso_a3 === code)
                if (countryFeature) {
                    // Check if player still holds this country
                    // We use a simple check: does the new player polygon intersect significantly with the country?
                    // Or simpler: does it contain the center?
                    // Let's use booleanContains for strictness, or intersect for leniency.
                    // Given "un-annexed again because the player lost the land", implies we lost the chunk covering it.

                    // If the new player territory does NOT intersect with the country anymore, it's liberated.
                    const stillHeld = turf.booleanIntersects(newPoly as any, countryFeature as any)

                    if (stillHeld) {
                        remainingAnnexed.push(code)
                    } else {
                        liberated.push(code)
                    }
                } else {
                    remainingAnnexed.push(code)
                }
            })

            if (liberated.length > 0) {
                console.log('🔓 Liberating countries:', liberated)
                const events: DiplomaticEvent[] = []

                liberated.forEach(code => {
                    useWorldStore.getState().liberateCountry(code)

                    const countryName = (countriesData as any).features.find((f: any) => f.properties.iso_a3 === code)?.properties.name || code

                    events.push({
                        id: `liberation - ${Date.now()} -${code} `,
                        type: 'LIBERATION',
                        severity: 3,
                        title: 'Country Liberated',
                        description: `${countryName} has been liberated from your control!`,
                        affectedNations: [code],
                        timestamp: Date.now()
                    })
                })

                addDiplomaticEvents(events)
            }

            // Update nation stats if nation exists
            let newNation = state.nation
            if (newNation) {
                // ... (rest of update logic)
                // Recalculate derived stats
                const newWealth = newInfraStats.totalPopulation * 10 + newInfraStats.totalPorts * 5000000 + newInfraStats.totalAirports * 10000000
                const newManpower = Math.floor(newInfraStats.totalPopulation * 0.05) // 5% manpower

                // Adjust soldiers if they exceed manpower (desertion/disbanding)
                let newSoldiers = newNation.stats.soldiers
                if (newSoldiers > newManpower) {
                    newSoldiers = newManpower
                }

                // Recalculate Power
                const powerStats = calculatePower(newSoldiers, newWealth, newNation.stats.diplomaticPower, true)

                newNation = {
                    ...newNation,
                    stats: {
                        ...newNation.stats,
                        wealth: newWealth,
                        manpower: newManpower,
                        soldiers: newSoldiers,
                        power: powerStats.totalPower
                    }
                }
            }

            return {
                playerTerritories: [newPoly as GeoJSON.Feature],
                infrastructureStats: newInfraStats,
                nation: newNation,
                annexedCountries: remainingAnnexed
            }
        } catch (e) {
            console.warn('⚠️ Failed to remove territory:', e)
            return {}
        }
    }),

    setConsequences: (consequences) => set({
        consequences,
        showResults: consequences.length > 0
    }),

    addConsequences: (newConsequences) => set((state) => {
        // Merge consequences, updating existing countries
        const merged = [...state.consequences]
        for (const nc of newConsequences) {
            const existing = merged.find(c => c.countryCode === nc.countryCode)
            if (existing) {
                existing.lostPercentage += nc.lostPercentage
                existing.lostArea += nc.lostArea
                existing.populationCaptured += nc.populationCaptured
            } else {
                merged.push(nc)
            }
        }
        return { consequences: merged }
    }),

    setCapturedCities: (capturedCities) => set({ capturedCities }),
    setInfrastructureStats: (infrastructureStats) => set({ infrastructureStats }),

    addDiplomaticEvents: (events) => set((state) => ({
        diplomaticEvents: [...state.diplomaticEvents, ...events]
    })),

    addModifiers: (modifiers) => set((state) => ({
        modifiers: [...state.modifiers, ...modifiers]
    })),

    setNation: (nation) => {
        if (!nation) {
            set({ nation: null })
            return
        }

        // Initialize budget allocation if missing
        const stats = {
            ...nation.stats,
            budgetAllocation: nation.stats.budgetAllocation || {
                social: 50,
                military: 50,
                infrastructure: 50,
                research: 50
            }
        }

        // Initialize Arrays & Migrate
        let units = nation.units || []
        const warPlans = nation.warPlans || []
        const buildings = nation.buildings || []

        // Migration: Soldiers -> Units (if legacy save has soldiers but no units)
        // DEPRECATED: Users now start with full reserves and draft manually.
        // if (units.length === 0 && stats.soldiers > 0) { ... } logic removed.

        set({
            nation: {
                ...nation,
                stats,
                buildings,
                units,
                warPlans
            }
        })
    },

    setCurrentClaim: (claim) => set({ currentClaim: claim }),
    setPendingInvasion: (invasion) => set({ pendingInvasion: invasion }),
    setSelectedCountry: (code) => set({ selectedCountry: code }),
    setSelectedClaim: (id) => set((state) => ({
        selectedClaimId: id,
        activeClaims: state.activeClaims.map(claim =>
            claim.id === id ? { ...claim, isSelected: true } : { ...claim, isSelected: false }
        )
    })),
    setIsCalculating: (isCalculating) => set({ isCalculating }),

    updateNationSoldiers: (delta) => set((state) => {
        if (!state.nation) return { nation: null }
        return {
            nation: {
                ...state.nation,
                stats: {
                    ...state.nation.stats,
                    soldiers: Math.max(0, state.nation.stats.soldiers + delta)
                }
            }
        }
    }),

    updateNationStats: (stats) => set((state) => {
        if (!state.nation) return { nation: null }
        return {
            nation: {
                ...state.nation,
                stats: {
                    ...state.nation.stats,
                    ...stats
                }
            }
        }
    }),

    updateBudget: (amount) => set((state) => {
        if (!state.nation) return { nation: null }

        // If amount is 0 (tick), recalculate based on income/expenses
        if (amount === 0) {
            const { stats } = state.nation
            const infra = state.infrastructureStats || {
                airports: [],
                ports: [],
                cities: [],
                totalAirports: 0,
                totalPorts: 0,
                totalPopulation: 0,
                totalAreaKm2: 0,
                hasSeaAccess: false,
                hasAirAccess: false
            }

            // Calculate population
            // Use infrastructure stats (which includes annexed territory) if available
            // Fallback to consequences (initial draw) if not
            const population = state.infrastructureStats?.totalPopulation ||
                state.consequences.reduce((sum, c) => sum + c.populationCaptured, 0) ||
                1000000

            const buildings = state.nation.buildings || []
            const income = calculateIncome(stats, infra, population, buildings)
            const expenses = calculateExpenses(stats, population, buildings)

            const netIncome = income.total - expenses.total

            return {
                nation: {
                    ...state.nation,
                    stats: {
                        ...stats,
                        budget: Math.max(0, stats.budget + netIncome),
                        taxIncome: income.taxIncome,
                        tradeIncome: income.tradeIncome,
                        expenses: expenses.total
                    }
                }
            }
        }

        return {
            nation: {
                ...state.nation,
                stats: {
                    ...state.nation.stats,
                    budget: Math.max(0, state.nation.stats.budget + amount)
                }
            }
        }
    }),

    setTaxRate: (rate) => set((state) => ({
        nation: state.nation ? {
            ...state.nation,
            stats: { ...state.nation.stats, taxRate: rate }
        } : null
    })),

    setMilitaryBudget: (budget) => set((state) => ({
        nation: state.nation ? {
            ...state.nation,
            stats: { ...state.nation.stats, militaryBudget: budget }
        } : null
    })),

    annexCountry: (code) => set((state) => ({
        annexedCountries: [...state.annexedCountries, code]
    })),

    addActiveClaim: (claim) => set((state) => {
        console.log('➕ Adding active claim to store:', claim)
        return {
            activeClaims: [...state.activeClaims, claim]
        }
    }),

    removeActiveClaim: (id) => set((state) => ({
        activeClaims: state.activeClaims.filter(c => c.id !== id)
    })),

    advanceDate: (days) => set((state) => ({
        gameDate: state.gameDate + (days * 24 * 60 * 60 * 1000)
    })),

    reset: () => set({
        phase: 'DRAWING',
        userPolygon: null,
        playerTerritories: [],
        consequences: [],
        capturedCities: [],
        diplomaticEvents: [],
        modifiers: [],
        nation: null,
        currentClaim: null,
        activeClaims: [],
        pendingInvasion: null,
        selectedCountry: null,
        annexedCountries: [],
        isCalculating: false,
        showResults: false,
        buildingMode: null,
        selectedClaimId: null,
    }),

    setBuildingMode: (mode) => set({ buildingMode: mode }),

    addBuilding: (building) => set((state) => {
        if (!state.nation) return { nation: null }

        // Calculate cost
        let cost = 0
        switch (building.type) {
            case 'FORT': cost = 10000000; break
            case 'TRAINING_CAMP': cost = 5000000; break
            case 'UNIVERSITY': cost = 20000000; break
        }

        if (state.nation.stats.budget < cost) {
            console.warn('❌ Not enough funds for building')
            return {}
        }

        return {
            nation: {
                ...state.nation,
                buildings: [...(state.nation.buildings || []), building],
                stats: {
                    ...state.nation.stats,
                    budget: state.nation.stats.budget - cost
                }
            },
            buildingMode: null // Exit building mode after placement
        }
    }),

    destabilizeTarget: (claimId) => set((state) => {
        if (!state.nation) return { nation: null }

        const claim = state.activeClaims.find(c => c.id === claimId)
        if (!claim) return {}

        // Get primary target
        const primaryTarget = [...claim.targetCountries].sort((a, b) => b.areaClaimedKm2 - a.areaClaimedKm2)[0]
        if (!primaryTarget) return {}

        const COST = 5000000 // $5M
        if (state.nation.stats.budget < COST) {
            console.warn('❌ Not enough funds to destabilize')
            return {}
        }

        // Call World Store
        useWorldStore.getState().destabilizeCountry(primaryTarget.code)

        return {
            nation: {
                ...state.nation,
                stats: {
                    ...state.nation.stats,
                    budget: state.nation.stats.budget - COST
                }
            }
        }
    }),

    plantPropaganda: (claimId) => set((state) => {
        if (!state.nation) return { nation: null }

        const claim = state.activeClaims.find(c => c.id === claimId)
        if (!claim) return {}

        // Get primary target
        const primaryTarget = [...claim.targetCountries].sort((a, b) => b.areaClaimedKm2 - a.areaClaimedKm2)[0]
        if (!primaryTarget) return {}

        const COST = 2000000 // $2M
        if (state.nation.stats.budget < COST) {
            console.warn('❌ Not enough funds for propaganda')
            return {}
        }

        useWorldStore.getState().plantPropaganda(primaryTarget.code)

        return {
            nation: {
                ...state.nation,
                stats: {
                    ...state.nation.stats,
                    budget: state.nation.stats.budget - COST
                }
            }
        }
    }),

    startBattle: (attackerCode, attackerName, defenderCode, defenderName, attackerSoldiers, defenderSoldiers, intensity, isPlayerAttacker, isPlayerDefender, claimId, location, defenseBonus = 0, plan) => set((state) => {
        // Run simulation immediately
        const result = simulateWar(attackerSoldiers, defenderSoldiers, intensity, defenseBonus)

        const battle: ActiveBattle = {
            id: `battle - ${Date.now()} -${Math.random()} `,
            attackerCode,
            attackerName,
            defenderCode,
            defenderName,
            initialAttackerSoldiers: attackerSoldiers,
            initialDefenderSoldiers: defenderSoldiers,
            intensity,
            startTime: Date.now(),
            result,
            isPlayerAttacker,
            isPlayerDefender,
            claimId,
            location,
            plan
        }

        console.log('⚔️ Starting new battle:', battle, 'Defense Bonus:', defenseBonus, 'Plan:', plan)

        return {
            activeBattles: [...state.activeBattles, battle]
        }
    }),

    dismissBattle: (id) => set((state) => ({
        activeBattles: state.activeBattles.filter(b => b.id !== id)
    })),

    triggerEvent: (event) => set({ currentEvent: event }),

    resolveEvent: () => set({ currentEvent: null }),

    // New System Actions
    addResearchPoints: (amount) => set((state) => ({ researchPoints: state.researchPoints + amount })),

    unlockTech: (techId) => set((state) => ({
        unlockedTechs: [...state.unlockedTechs, techId],
        researchPoints: state.researchPoints // Cost should be deducted by caller or here if we pass cost
    })),

    enactPolicy: (policyId) => set((state) => ({
        activePolicies: [...state.activePolicies, policyId]
    })),

    revokePolicy: (policyId) => set((state) => ({
        activePolicies: state.activePolicies.filter(id => id !== policyId)
    })),

    updateUnrest: (delta) => set((state) => ({
        unrest: Math.max(0, Math.min(100, state.unrest + delta))
    })),

    addFaction: (faction) => set((state) => ({
        factions: [...state.factions, faction]
    })),

    updateFaction: (id, updates) => set((state) => ({
        factions: state.factions.map(f => f.id === id ? { ...f, ...updates } : f)
    })),

    removeFaction: (id) => set((state) => ({
        factions: state.factions.filter(f => f.id !== id)
    })),

    setInfrastructureLoaded: (loaded) => set({ infrastructureLoaded: loaded }),

    // Military Actions
    createUnit: (type, soldierCount, source = 'HIRE') => set((state) => {
        if (!state.nation) return {}

        const unitId = `unit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        // Base stats
        const unitBaseStats = {
            'INFANTRY': { attack: 10, defense: 15, mobility: 5, soldiers: 1000 },
            'ARMOR': { attack: 25, defense: 20, mobility: 20, soldiers: 500 },
            'SPECIAL_FORCES': { attack: 30, defense: 10, mobility: 15, soldiers: 200 },
            'DEFENSE': { attack: 5, defense: 30, mobility: 0, soldiers: 1000 },
            'MILITIA': { attack: 5, defense: 5, mobility: 5, soldiers: 1500 }
        }

        const stats = unitBaseStats[type] || { attack: 10, defense: 10, mobility: 10, soldiers: 1000 }
        const finalSoldiers = soldierCount || stats.soldiers

        // Update nation stats based on source
        const newStats = { ...state.nation.stats }

        if (source === 'HIRE') {
            // Hired guns add to the total military pool
            newStats.soldiers += finalSoldiers
            // Also increase total manpower capability slightly to reflect permanent expansion
            newStats.manpower += finalSoldiers
        }
        // If DRAFT, we don't change .soldiers (total pool), 
        // effectively "taking" them from the unassigned pool.

        const newUnit: import('../types/game').MilitaryUnit = {
            id: unitId,
            name: `${state.nation.units?.length + 1 || 1}st ${type.charAt(0) + type.slice(1).toLowerCase()} Brigade`,
            type,
            soldiers: finalSoldiers,
            experience: source === 'HIRE' ? 20 : 0, // Mercenaries come with some experience
            morale: 100,
            location: state.nation.capital?.coordinates || [0, 0],
            status: 'IDLE',
            stats: {
                attack: stats.attack,
                defense: stats.defense,
                mobility: stats.mobility
            }
        }

        return {
            nation: {
                ...state.nation,
                stats: newStats,
                units: [...(state.nation.units || []), newUnit]
            }
        }
    }),

    updateUnit: (unitId, updates) => set((state) => {
        if (!state.nation) return {}
        return {
            nation: {
                ...state.nation,
                units: (state.nation.units || []).map(u => u.id === unitId ? { ...u, ...updates } : u)
            }
        }
    }),

    deleteUnit: (unitId) => set((state) => {
        if (!state.nation) return {}
        return {
            nation: {
                ...state.nation,
                units: (state.nation.units || []).filter(u => u.id !== unitId)
            }
        }
    }),

    saveWarPlan: (plan) => set((state) => {
        if (!state.nation) return {}
        return {
            nation: {
                ...state.nation,
                warPlans: [...(state.nation.warPlans || []), plan]
            }
        }
    }),

    deleteWarPlan: (planId) => set((state) => {
        if (!state.nation) return {}
        return {
            nation: {
                ...state.nation,
                warPlans: (state.nation.warPlans || []).filter(p => p.id !== planId)
            }
        }
    }),

    executeWarPlan: (planId) => {
        const state = useGameStore.getState()
        if (!state.nation) return

        const plan = state.nation.warPlans?.find(p => p.id === planId)
        if (!plan) return

        // Get assigned units
        const units = state.nation.units?.filter(u => plan.assignedUnitIds.includes(u.id)) || []
        const totalSoldiers = units.reduce((sum, u) => sum + u.soldiers, 0)

        const target = useWorldStore.getState().aiCountries.get(plan.targetCountry)
        if (!target) return

        state.startBattle(
            'PLAYER',
            state.nation.name,
            target.code,
            target.name,
            totalSoldiers,
            target.soldiers, // Placeholder: Defenders should use their units too eventually
            'BATTLE',
            true,
            false,
            undefined, // claimId
            undefined, // location
            0, // defenseBonus
            plan
        )

        // Delete the plan after execution to free up units and prevent reuse
        state.deleteWarPlan(planId)
    },

    transferSoldiers: (fromUnitId, toUnitId, amount) => set((state) => {
        if (!state.nation || !state.nation.units) return {}

        const units = [...state.nation.units]
        const fromUnitIndex = units.findIndex(u => u.id === fromUnitId)
        const toUnitIndex = units.findIndex(u => u.id === toUnitId)

        if (fromUnitIndex === -1 || toUnitIndex === -1) return {}

        const fromUnit = { ...units[fromUnitIndex] }
        const toUnit = { ...units[toUnitIndex] }

        if (fromUnit.soldiers < amount) return {}

        fromUnit.soldiers -= amount
        toUnit.soldiers += amount

        units[fromUnitIndex] = fromUnit
        units[toUnitIndex] = toUnit

        return { nation: { ...state.nation, units } }
    }),

    recallUnit: (_unitId) => set((state) => {
        if (!state.nation || !state.nation.units) return {}
        return {}
    })
}))
