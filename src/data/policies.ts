import { Policy } from '../types/game'

export const POLICIES: Policy[] = [
    // Religion
    {
        id: 'state_religion',
        name: 'State Religion',
        description: 'Enforce a single state religion. Increases stability but causes unrest among minorities.',
        category: 'RELIGION',
        unrestImpact: 10,
        monthlyUnrestChange: -0.5,
        effects: [{ type: 'STABILITY', value: 10 }]
    },
    {
        id: 'secularism',
        name: 'Secularism',
        description: 'Separate church and state. Improves research but may anger traditionalists.',
        category: 'RELIGION',
        unrestImpact: 5,
        monthlyUnrestChange: 0,
        effects: [{ type: 'RESEARCH_BOOST', value: 5 }]
    },

    // Conscription
    {
        id: 'mandatory_service',
        name: 'Mandatory Service',
        description: 'All citizens must serve. Greatly increases manpower but causes significant unrest.',
        category: 'CONSCRIPTION',
        unrestImpact: 20,
        monthlyUnrestChange: 0.2,
        effects: [{ type: 'MILITARY_QUANTITY', value: 50 }]
    },
    {
        id: 'volunteer_army',
        name: 'Volunteer Army',
        description: 'Professional army. Better quality troops but fewer numbers.',
        category: 'CONSCRIPTION',
        unrestImpact: -5,
        monthlyUnrestChange: -0.1,
        effects: [{ type: 'MILITARY_QUALITY', value: 20 }]
    },

    // Taxation
    {
        id: 'progressive_tax',
        name: 'Progressive Tax',
        description: 'Tax the rich. Increases income but may reduce investment.',
        category: 'TAXATION',
        unrestImpact: 5,
        monthlyUnrestChange: -0.1,
        effects: [{ type: 'ECONOMIC_BOOM', value: 5 }]
    },
    {
        id: 'flat_tax',
        name: 'Flat Tax',
        description: 'Simple tax code. Boosts trade but may increase inequality.',
        category: 'TAXATION',
        unrestImpact: 5,
        monthlyUnrestChange: 0.1,
        effects: [{ type: 'TRADE_BOOST', value: 10 }]
    },

    // Free Speech
    {
        id: 'censorship',
        name: 'State Censorship',
        description: 'Control the narrative. Increases stability but reduces research.',
        category: 'FREE_SPEECH',
        unrestImpact: 15,
        monthlyUnrestChange: -0.5,
        effects: [{ type: 'STABILITY', value: 15 }, { type: 'RESEARCH_BOOST', value: -10 }]
    },
    {
        id: 'free_press',
        name: 'Free Press',
        description: 'Unrestricted media. Boosts culture and research but can lead to instability.',
        category: 'FREE_SPEECH',
        unrestImpact: -5,
        monthlyUnrestChange: 0.1,
        effects: [{ type: 'CULTURAL_BOOM', value: 10 }, { type: 'RESEARCH_BOOST', value: 5 }]
    }
]
