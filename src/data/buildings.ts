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

export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
    FORT: {
        type: 'FORT',
        name: 'Fortress',
        description: 'Provides defensive bonus to surrounding area and military presence.',
        cost: 1000000,
        upkeep: 50000,
        icon: '🏰',
        color: '#ef4444'
    },
    TRAINING_CAMP: {
        type: 'TRAINING_CAMP',
        name: 'Training Camp',
        description: 'Increases soldier recruitment rate and experience.',
        cost: 500000,
        upkeep: 20000,
        icon: '⚔️',
        color: '#f97316'
    },
    UNIVERSITY: {
        type: 'UNIVERSITY',
        name: 'University',
        description: 'Boosts tax efficiency and generates Research Points.',
        cost: 2000000,
        upkeep: 100000,
        icon: '🎓',
        color: '#3b82f6'
    },
    RESEARCH_LAB: {
        type: 'RESEARCH_LAB',
        name: 'Research Lab',
        description: 'Dedicated facility for generating Research Points.',
        cost: 3000000,
        upkeep: 150000,
        icon: '🔬',
        color: '#8b5cf6'
    },
    TEMPLE: {
        type: 'TEMPLE',
        name: 'Temple',
        description: 'Reduces local unrest and increases national stability.',
        cost: 800000,
        upkeep: 30000,
        icon: '⛩️',
        color: '#eab308'
    },
    FACTORY: {
        type: 'FACTORY',
        name: 'Factory',
        description: 'Increases economic output and GDP.',
        cost: 1500000,
        upkeep: 80000,
        icon: '🏭',
        color: '#64748b'
    },
    MARKET: {
        type: 'MARKET',
        name: 'Market',
        description: 'Boosts trade income and economic activity.',
        cost: 600000,
        upkeep: 25000,
        icon: '🏪',
        color: '#10b981'
    },
    HOSPITAL: {
        type: 'HOSPITAL',
        name: 'Hospital',
        description: 'Increases population growth and reduces plague risk.',
        cost: 1200000,
        upkeep: 60000,
        icon: '🏥',
        color: '#f43f5e'
    }
}
