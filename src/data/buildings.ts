import { BuildingType } from '../types/game'

export interface BuildingDefinition {
    type: BuildingType
    name: string
    description: string
    cost: number
    upkeep: number
    icon: string
    color: string
}

// Short, mechanically-accurate summary of each building's actual effect,
// shown in the UI next to its cost. Keep this in sync with the formulas in
// utils/economy.ts, utils/unrest.ts, and gameStore.ts's startBattle.
export const BUILDING_EFFECTS: Record<BuildingType, string> = {
    FORT: '+Defense bonus when defending',
    TRAINING_CAMP: '+10% Recruitment',
    UNIVERSITY: '+5% Tax & Resource Efficiency',
    RESEARCH_LAB: '+10 Research Points/month',
    TEMPLE: '-0.2 Unrest/month',
    FACTORY: '+10% GDP (caps at 10 factories)',
    MARKET: '+5% Trade Openness',
    HOSPITAL: '-0.15 Unrest/month'
}

export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
    FORT: {
        type: 'FORT',
        name: 'Fortress',
        description: 'Provides a defensive bonus when your nation is attacked.',
        cost: 10_000_000,
        upkeep: 50000,
        icon: '🏰',
        color: '#ef4444'
    },
    TRAINING_CAMP: {
        type: 'TRAINING_CAMP',
        name: 'Training Camp',
        description: 'Increases soldier recruitment rate.',
        cost: 5_000_000,
        upkeep: 20000,
        icon: '⚔️',
        color: '#f97316'
    },
    UNIVERSITY: {
        type: 'UNIVERSITY',
        name: 'University',
        description: 'Boosts tax collection and resource extraction efficiency.',
        cost: 20_000_000,
        upkeep: 100000,
        icon: '🎓',
        color: '#3b82f6'
    },
    RESEARCH_LAB: {
        type: 'RESEARCH_LAB',
        name: 'Research Lab',
        description: 'Dedicated facility for generating Research Points.',
        cost: 10_000_000,
        upkeep: 150000,
        icon: '🔬',
        color: '#8b5cf6'
    },
    TEMPLE: {
        type: 'TEMPLE',
        name: 'Temple',
        description: 'Reduces national unrest over time.',
        cost: 3_000_000,
        upkeep: 30000,
        icon: '⛩️',
        color: '#eab308'
    },
    FACTORY: {
        type: 'FACTORY',
        name: 'Factory',
        description: 'Increases economic output and GDP.',
        cost: 15_000_000,
        upkeep: 80000,
        icon: '🏭',
        color: '#64748b'
    },
    MARKET: {
        type: 'MARKET',
        name: 'Market',
        description: 'Boosts trade income and economic activity.',
        cost: 5_000_000,
        upkeep: 25000,
        icon: '🏪',
        color: '#10b981'
    },
    HOSPITAL: {
        type: 'HOSPITAL',
        name: 'Hospital',
        description: 'Improves public health, reducing national unrest over time.',
        cost: 6_000_000,
        upkeep: 60000,
        icon: '🏥',
        color: '#f43f5e'
    }
}
