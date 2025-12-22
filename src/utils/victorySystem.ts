/**
 * Victory System
 * 
 * Tracks victory conditions and achievements.
 * All victories are optional and continuable (sandbox mode).
 */

// =============================================================================
// VICTORY TYPES
// =============================================================================

export type VictoryType =
    | 'DOMINATION'    // Control 40%+ world territory
    | 'HEGEMONY'      // Highest power score for 10+ years
    | 'ECONOMIC'      // Highest GDP for 20+ years
    | 'SURVIVAL'      // Maintain independence for 100+ years

export interface VictoryCondition {
    type: VictoryType
    title: string
    description: string
    icon: string
    requirement: string
    achieved: boolean
    achievedAt?: number
    progress: number      // 0-100
    progressText: string
}

export interface VictoryState {
    conditions: VictoryCondition[]
    achievementsUnlocked: Achievement[]
    gameStartTime: number
    totalMonthsPlayed: number
}

// =============================================================================
// ACHIEVEMENT TYPES
// =============================================================================

export type AchievementCategory =
    | 'MILITARY'
    | 'DIPLOMATIC'
    | 'ECONOMIC'
    | 'POLITICAL'
    | 'SPECIAL'

export interface Achievement {
    id: string
    title: string
    description: string
    icon: string
    category: AchievementCategory
    unlockedAt: number
    rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY'
}

// Achievement definitions
export const ACHIEVEMENTS: Omit<Achievement, 'unlockedAt'>[] = [
    // Military
    {
        id: 'first_blood',
        title: 'First Blood',
        description: 'Win your first war',
        icon: '⚔️',
        category: 'MILITARY',
        rarity: 'COMMON'
    },
    {
        id: 'paper_tiger',
        title: 'Paper Tiger',
        description: 'Win a war against a nation with 50% more power',
        icon: '🐯',
        category: 'MILITARY',
        rarity: 'RARE'
    },
    {
        id: 'world_conqueror',
        title: 'World Conqueror',
        description: 'Control 50% of world territory',
        icon: '🌍',
        category: 'MILITARY',
        rarity: 'LEGENDARY'
    },
    {
        id: 'peacekeeper',
        title: 'Peacekeeper',
        description: 'Maintain peace for 20 consecutive years',
        icon: '🕊️',
        category: 'MILITARY',
        rarity: 'UNCOMMON'
    },

    // Diplomatic
    {
        id: 'diplomats_touch',
        title: "Diplomat's Touch",
        description: 'Form your first alliance',
        icon: '🤝',
        category: 'DIPLOMATIC',
        rarity: 'COMMON'
    },
    {
        id: 'coalition_builder',
        title: 'Coalition Builder',
        description: 'Lead a coalition with 10+ members',
        icon: '🏛️',
        category: 'DIPLOMATIC',
        rarity: 'RARE'
    },
    {
        id: 'friend_to_all',
        title: 'Friend to All',
        description: 'Have positive relations with 50+ nations',
        icon: '💚',
        category: 'DIPLOMATIC',
        rarity: 'UNCOMMON'
    },

    // Economic
    {
        id: 'economic_miracle',
        title: 'Economic Miracle',
        description: 'Double your GDP in 10 years',
        icon: '📈',
        category: 'ECONOMIC',
        rarity: 'UNCOMMON'
    },
    {
        id: 'trade_empire',
        title: 'Trade Empire',
        description: 'Have trade agreements with 20+ nations',
        icon: '🚢',
        category: 'ECONOMIC',
        rarity: 'RARE'
    },
    {
        id: 'billionaire_nation',
        title: 'Billionaire Nation',
        description: 'Accumulate $100B in reserves',
        icon: '💰',
        category: 'ECONOMIC',
        rarity: 'RARE'
    },

    // Political
    {
        id: 'stable_government',
        title: 'Stable Government',
        description: 'Maintain unrest below 2 for 10 years',
        icon: '⚖️',
        category: 'POLITICAL',
        rarity: 'UNCOMMON'
    },
    {
        id: 'revolutionary',
        title: 'Revolutionary',
        description: 'Successfully trigger a revolution in another country',
        icon: '✊',
        category: 'POLITICAL',
        rarity: 'RARE'
    },

    // Special
    {
        id: 'against_all_odds',
        title: 'Against All Odds',
        description: 'Survive being at war with 3+ nations simultaneously',
        icon: '🎖️',
        category: 'SPECIAL',
        rarity: 'LEGENDARY'
    },
    {
        id: 'peaceful_rise',
        title: 'Peaceful Rise',
        description: 'Become a top 10 power without declaring any wars',
        icon: '☮️',
        category: 'SPECIAL',
        rarity: 'LEGENDARY'
    }
]

// =============================================================================
// VICTORY CONDITION CHECKS
// =============================================================================

interface VictoryCheckParams {
    playerTerritory: number       // % of world controlled
    playerPower: number
    allPowers: number[]           // Power scores of all nations
    playerGDP: number
    allGDPs: number[]
    monthsPlayed: number
    consecutiveMonthsAsTopPower: number
    consecutiveMonthsAsTopGDP: number
}

/**
 * Check all victory conditions
 */
export function checkVictoryConditions(params: VictoryCheckParams): VictoryCondition[] {
    const {
        playerTerritory,
        playerPower,
        allPowers,
        playerGDP,
        allGDPs,
        monthsPlayed,
        consecutiveMonthsAsTopPower,
        consecutiveMonthsAsTopGDP
    } = params

    const maxPower = Math.max(...allPowers)
    const maxGDP = Math.max(...allGDPs)
    const isTopPower = playerPower >= maxPower
    const isTopGDP = playerGDP >= maxGDP

    return [
        // Domination Victory: 40% world territory
        {
            type: 'DOMINATION' as VictoryType,
            title: 'Domination',
            description: 'Control 40% of the world',
            icon: '🌍',
            requirement: '40% world territory',
            achieved: playerTerritory >= 40,
            progress: Math.min(100, (playerTerritory / 40) * 100),
            progressText: `${playerTerritory.toFixed(1)}% / 40%`
        },
        // Hegemony Victory: Top power for 120 months (10 years)
        {
            type: 'HEGEMONY' as VictoryType,
            title: 'Hegemony',
            description: 'Maintain highest power for 10 years',
            icon: '👑',
            requirement: '10 years as #1 power',
            achieved: consecutiveMonthsAsTopPower >= 120,
            progress: Math.min(100, (consecutiveMonthsAsTopPower / 120) * 100),
            progressText: `${Math.floor(consecutiveMonthsAsTopPower / 12)} / 10 years${isTopPower ? ' (current #1)' : ''}`
        },
        // Economic Victory: Top GDP for 240 months (20 years)
        {
            type: 'ECONOMIC' as VictoryType,
            title: 'Economic',
            description: 'Maintain highest GDP for 20 years',
            icon: '💎',
            requirement: '20 years as #1 economy',
            achieved: consecutiveMonthsAsTopGDP >= 240,
            progress: Math.min(100, (consecutiveMonthsAsTopGDP / 240) * 100),
            progressText: `${Math.floor(consecutiveMonthsAsTopGDP / 12)} / 20 years${isTopGDP ? ' (current #1)' : ''}`
        },
        // Survival Victory: 1200 months (100 years) of independence
        {
            type: 'SURVIVAL' as VictoryType,
            title: 'Survival',
            description: 'Maintain independence for 100 years',
            icon: '🏛️',
            requirement: '100 years of independence',
            achieved: monthsPlayed >= 1200,
            progress: Math.min(100, (monthsPlayed / 1200) * 100),
            progressText: `${Math.floor(monthsPlayed / 12)} / 100 years`
        }
    ]
}

// =============================================================================
// ACHIEVEMENT CHECKS
// =============================================================================

interface AchievementCheckParams {
    warsWon: number
    warAgainstStronger: boolean
    territoryControlled: number
    monthsAtPeace: number
    allianceCount: number
    coalitionSize: number
    positiveRelations: number
    gdpGrowthPercent: number
    tradeAgreements: number
    budgetReserves: number
    lowUnrestMonths: number
    revolutionsTriggered: number
    simultaneousWars: number
    isTop10Power: boolean
    warsDeclared: number
}

/**
 * Check which achievements have been unlocked
 */
export function checkAchievements(
    params: AchievementCheckParams,
    existingAchievements: string[]
): Achievement[] {
    const newAchievements: Achievement[] = []
    const now = Date.now()

    const checks: Record<string, boolean> = {
        'first_blood': params.warsWon >= 1,
        'paper_tiger': params.warAgainstStronger,
        'world_conqueror': params.territoryControlled >= 50,
        'peacekeeper': params.monthsAtPeace >= 240, // 20 years
        'diplomats_touch': params.allianceCount >= 1,
        'coalition_builder': params.coalitionSize >= 10,
        'friend_to_all': params.positiveRelations >= 50,
        'economic_miracle': params.gdpGrowthPercent >= 100, // Doubled
        'trade_empire': params.tradeAgreements >= 20,
        'billionaire_nation': params.budgetReserves >= 100_000_000_000,
        'stable_government': params.lowUnrestMonths >= 120, // 10 years
        'revolutionary': params.revolutionsTriggered >= 1,
        'against_all_odds': params.simultaneousWars >= 3,
        'peaceful_rise': params.isTop10Power && params.warsDeclared === 0
    }

    for (const [id, unlocked] of Object.entries(checks)) {
        if (unlocked && !existingAchievements.includes(id)) {
            const template = ACHIEVEMENTS.find(a => a.id === id)
            if (template) {
                newAchievements.push({
                    ...template,
                    unlockedAt: now
                })
            }
        }
    }

    return newAchievements
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize victory state for a new game
 */
export function initVictoryState(): VictoryState {
    return {
        conditions: checkVictoryConditions({
            playerTerritory: 0,
            playerPower: 0,
            allPowers: [0],
            playerGDP: 0,
            allGDPs: [0],
            monthsPlayed: 0,
            consecutiveMonthsAsTopPower: 0,
            consecutiveMonthsAsTopGDP: 0
        }),
        achievementsUnlocked: [],
        gameStartTime: Date.now(),
        totalMonthsPlayed: 0
    }
}

/**
 * Get victory message for display
 */
export function getVictoryMessage(type: VictoryType): {
    title: string
    subtitle: string
    description: string
} {
    switch (type) {
        case 'DOMINATION':
            return {
                title: '🌍 DOMINATION VICTORY!',
                subtitle: 'World Conqueror',
                description: 'You have conquered 40% of the world. Your empire spans continents.'
            }
        case 'HEGEMONY':
            return {
                title: '👑 HEGEMONY VICTORY!',
                subtitle: 'Supreme Power',
                description: 'You have maintained global dominance for a full decade. The world bows to your power.'
            }
        case 'ECONOMIC':
            return {
                title: '💎 ECONOMIC VICTORY!',
                subtitle: 'Economic Titan',
                description: 'Your economy has dominated global trade for two decades. Your currency is the world standard.'
            }
        case 'SURVIVAL':
            return {
                title: '🏛️ SURVIVAL VICTORY!',
                subtitle: 'Enduring Legacy',
                description: 'Your nation has stood the test of time for a century. Empires have risen and fallen, but you endure.'
            }
    }
}
