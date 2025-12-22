/**
 * Coalition System
 * Handles Military, Trade, and Research alliances between nations
 */

import type { AICountry, Coalition, CoalitionType } from '../types/game'

// Real world coalitions to seed
const REAL_WORLD_COALITIONS = [
    {
        name: 'NATO',
        type: 'MILITARY' as CoalitionType,
        leader: 'USA',
        color: '#004990',
        icon: '🛡️',
        members: ['USA', 'GBR', 'FRA', 'DEU', 'ITA', 'CAN', 'TUR', 'POL', 'ESP', 'NLD', 'NOR', 'DNK', 'BEL', 'PRT', 'GRC', 'CZE', 'HUN', 'ROU', 'BGR', 'EST', 'LVA', 'LTU', 'SVK', 'SVN', 'HRV', 'ALB', 'MNE', 'MKD', 'ISL', 'FIN', 'SWE']
    },
    {
        name: 'European Union',
        type: 'TRADE' as CoalitionType,
        leader: 'DEU',
        color: '#003399',
        icon: '🇪🇺',
        members: ['DEU', 'FRA', 'ITA', 'ESP', 'NLD', 'BEL', 'AUT', 'POL', 'SWE', 'DNK', 'FIN', 'IRL', 'PRT', 'GRC', 'CZE', 'HUN', 'ROU', 'BGR', 'SVK', 'HRV', 'SVN', 'EST', 'LVA', 'LTU', 'CYP', 'MLT', 'LUX']
    },
    {
        name: 'BRICS',
        type: 'TRADE' as CoalitionType,
        leader: 'CHN',
        color: '#FFD700',
        icon: '🧱',
        members: ['BRA', 'RUS', 'IND', 'CHN', 'ZAF', 'EGY', 'ETH', 'IRN', 'ARE']
    },
    {
        name: 'CSTO',
        type: 'MILITARY' as CoalitionType,
        leader: 'RUS',
        color: '#D52B1E',
        icon: '⭐',
        members: ['RUS', 'BLR', 'KAZ', 'KGZ', 'TJK']
    }
]

/**
 * Create a new coalition
 */
export function createCoalition(
    name: string,
    type: CoalitionType,
    founder: string,
    color: string = '#FFFFFF',
    requirements?: Coalition['requirements']
): Coalition {
    const iconMap: Record<CoalitionType, string> = {
        'MILITARY': '⚔️',
        'TRADE': '💰',
        'RESEARCH': '🔬'
    }

    return {
        id: `coalition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        type,
        members: [founder],
        leader: founder,
        color,
        created: Date.now(),
        icon: iconMap[type],
        requirements
    }
}

/**
 * Seed real world coalitions based on available countries
 */
export function seedRealWorldCoalitions(availableCountries: Map<string, AICountry>, playerCountry?: string): Coalition[] {
    const coalitions: Coalition[] = []

    REAL_WORLD_COALITIONS.forEach(template => {
        // Only include members that actually exist in the game OR are the player
        const validMembers = template.members.filter(code =>
            availableCountries.has(code) || (playerCountry && code === playerCountry)
        )

        // Need at least 2 members including leader to form
        // Leader must exist (either AI or Player)
        const leaderExists = availableCountries.has(template.leader) || (playerCountry && template.leader === playerCountry)

        if (validMembers.length >= 2 && leaderExists) {
            coalitions.push({
                id: `real-${template.name.toLowerCase().replace(/\s/g, '-')}`,
                name: template.name,
                type: template.type,
                members: validMembers,
                leader: template.leader,
                color: template.color,
                created: Date.now(),
                icon: template.icon
            })
        }
    })

    return coalitions
}

/**
 * Calculate chance of AI accepting an invite
 */
export function calculateJoinChance(
    coalition: Coalition,
    target: AICountry,
    leaderCountry: AICountry
): number {
    if (!target.politicalState || !leaderCountry.politicalState) return 0

    let score = 50

    // 1. Relations with leader
    // We don't have direct relations score here easily without store access, 
    // but we can use alignment/compatibility
    const alignmentDiff = Math.abs(target.politicalState.orientation - leaderCountry.politicalState.orientation)
    score += (50 - alignmentDiff) // +/- 50 based on ideological similarity

    // 2. Coalition Type Preferences
    if (coalition.type === 'MILITARY') {
        // High aggression/military nations like military pacts
        score += (target.politicalState.military - 3) * 10
        score += (target.politicalState.aggression - 3) * 5

        // Fear factor: if they have enemies in the coalition, they won't join
        // If they have enemies OUTSIDE the coalition that the coalition also hates, they join
    } else {
        // Trade coalitions liked by peaceful/free nations
        score += (target.politicalState.freedom - 3) * 10
        score -= (target.politicalState.aggression - 3) * 10
    }

    // 3. Existing Size
    // Nations like joining strong coalitions
    score += Math.min(20, coalition.members.length * 2)

    return Math.max(0, Math.min(100, score))
}

/**
 * Get benefits description
 */
export function getCoalitionBenefits(type: CoalitionType, requirements?: Coalition['requirements']): string {
    switch (type) {
        case 'MILITARY':
            const defensePercent = requirements?.defenseContributionPercent ?? 25
            return `Mutual defense pact. Members contribute ${defensePercent}% of their army to collective defense. +10% Military Power per member.`
        case 'TRADE':
            const tariff = requirements?.fixedTariffLevel ?? 'FREE'
            return `Trade agreement with ${tariff} tariffs between members. +5% GDP Growth per member.`
        case 'RESEARCH':
            return `Research cooperation. +10% Research Points per member. Shared technology benefits.`
        default:
            return 'Alliance benefits.'
    }
}

/**
 * Calculate coalition defense support for a country
 */
export function calculateCoalitionDefenseSupport(
    countryCode: string,
    coalitions: Coalition[],
    aiCountries: Map<string, AICountry>
): { total: number, contributions: { code: string, name: string, soldiers: number }[] } {
    const contributions: { code: string, name: string, soldiers: number }[] = []
    let total = 0

    for (const coalition of coalitions) {
        // Only military coalitions provide defense support
        if (coalition.type !== 'MILITARY') continue

        // Check if country is a member
        if (!coalition.members.includes(countryCode)) continue

        const defensePercent = (coalition.requirements?.defenseContributionPercent ?? 25) / 100

        // Get soldiers from all other members
        for (const memberCode of coalition.members) {
            if (memberCode === countryCode) continue

            const member = aiCountries.get(memberCode)
            if (member && !member.isAtWar && !member.isAnnexed) {
                const contribution = Math.floor(member.soldiers * defensePercent)
                contributions.push({
                    code: memberCode,
                    name: member.name,
                    soldiers: contribution
                })
                total += contribution
            }
        }
    }

    return { total, contributions }
}

/**
 * Check if a country meets coalition requirements
 */
export function meetsCoalitionRequirements(
    coalition: Coalition,
    country: AICountry,
    aiCountries: Map<string, AICountry>
): { meets: boolean, reason?: string } {
    const reqs = coalition.requirements
    if (!reqs) return { meets: true }

    // Check religion
    if (reqs.religion && country.religion !== reqs.religion) {
        return { meets: false, reason: `Requires ${reqs.religion} religion` }
    }

    // Check culture
    if (reqs.culture && country.culture !== reqs.culture) {
        return { meets: false, reason: `Requires ${reqs.culture} culture` }
    }

    // Check minimum relations with all members
    if (reqs.minRelations !== undefined) {
        for (const memberCode of coalition.members) {
            const member = aiCountries.get(memberCode)
            if (member) {
                // For AI, we approximate relations based on alignment
                const alignmentDiff = country.politicalState?.orientation !== undefined &&
                    member.politicalState?.orientation !== undefined
                    ? Math.abs(country.politicalState.orientation - member.politicalState.orientation)
                    : 50
                const approxRelations = 50 - alignmentDiff

                if (approxRelations < reqs.minRelations) {
                    return { meets: false, reason: `Poor relations with ${member.name}` }
                }
            }
        }
    }

    return { meets: true }
}
