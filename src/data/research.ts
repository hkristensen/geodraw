import { ResearchTech } from '../types/game'

export const RESEARCH_TREE: ResearchTech[] = [
    // Military
    {
        id: 'mil_1',
        name: 'Standardized Logistics',
        description: 'Improves army movement and reduces upkeep.',
        category: 'MILITARY',
        cost: 500,
        effects: [{ type: 'MILITARY_QUALITY', value: 5 }]
    },
    {
        id: 'mil_2',
        name: 'Modern Fortifications',
        description: 'Increases defensive bonuses of forts and terrain.',
        category: 'MILITARY',
        cost: 1000,
        prerequisites: ['mil_1'],
        effects: [{ type: 'DEFENSE_BONUS', value: 10 }]
    },
    {
        id: 'mil_3',
        name: 'Advanced Ballistics',
        description: 'Significantly increases military power.',
        category: 'MILITARY',
        cost: 2500,
        prerequisites: ['mil_2'],
        effects: [{ type: 'MILITARY_QUALITY', value: 15 }]
    },

    // Economy
    {
        id: 'eco_1',
        name: 'Central Banking',
        description: 'Improves tax collection efficiency.',
        category: 'ECONOMY',
        cost: 500,
        effects: [{ type: 'ECONOMIC_BOOM', value: 5 }]
    },
    {
        id: 'eco_2',
        name: 'Industrial Automation',
        description: 'Boosts factory output and GDP.',
        category: 'ECONOMY',
        cost: 1200,
        prerequisites: ['eco_1'],
        effects: [{ type: 'ECONOMIC_BOOM', value: 10 }]
    },
    {
        id: 'eco_3',
        name: 'Global Trade Network',
        description: 'Greatly increases trade income.',
        category: 'ECONOMY',
        cost: 3000,
        prerequisites: ['eco_2'],
        effects: [{ type: 'TRADE_BOOST', value: 20 }]
    },

    // Civic
    {
        id: 'civ_1',
        name: 'Civil Service',
        description: 'Reduces corruption and improves stability.',
        category: 'CIVIC',
        cost: 400,
        effects: [{ type: 'STABILITY', value: 5 }]
    },
    {
        id: 'civ_2',
        name: 'Public Education',
        description: 'Increases research point generation.',
        category: 'CIVIC',
        cost: 1000,
        prerequisites: ['civ_1'],
        effects: [{ type: 'RESEARCH_BOOST', value: 10 }]
    },
    {
        id: 'civ_3',
        name: 'Universal Healthcare',
        description: 'Boosts population growth and reduces unrest.',
        category: 'CIVIC',
        cost: 2000,
        prerequisites: ['civ_2'],
        effects: [{ type: 'POPULATION_BOOM', value: 10 }]
    },

    // Nuclear Technology
    {
        id: 'nuke_1',
        name: 'Nuclear Physics',
        description: 'Unlock the secrets of the atom. Foundation for nuclear technology.',
        category: 'NUCLEAR',
        cost: 2000,
        prerequisites: ['eco_2', 'mil_2'],
        effects: [{ type: 'RESEARCH_BOOST', value: 10 }]
    },
    {
        id: 'nuke_2',
        name: 'Nuclear Power',
        description: 'Build nuclear reactors for clean energy. Reduces costs and boosts trade.',
        category: 'NUCLEAR',
        cost: 3000,
        prerequisites: ['nuke_1'],
        effects: [{ type: 'TRADE_BOOST', value: 15 }, { type: 'ECONOMIC_BOOM', value: 10 }]
    },
    {
        id: 'nuke_3',
        name: 'Uranium Enrichment',
        description: 'Develop uranium enrichment capabilities. Prerequisite for weapons program.',
        category: 'NUCLEAR',
        cost: 4000,
        prerequisites: ['nuke_1'],
        effects: [{ type: 'ENRICHMENT_ENABLED', value: 1 }]
    },
    {
        id: 'nuke_4',
        name: 'Nuclear Weapons',
        description: '☢️ The ultimate deterrent. Enables production of nuclear warheads.',
        category: 'NUCLEAR',
        cost: 8000,
        prerequisites: ['nuke_3', 'mil_3'],
        effects: [{ type: 'NUCLEAR_WEAPONS_ENABLED', value: 1 }]
    }
]
