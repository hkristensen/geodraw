import { RandomEvent } from '../types/store'

export const RANDOM_EVENTS: RandomEvent[] = [
    {
        id: 'civil_unrest',
        title: 'Civil Unrest',
        description: 'Dissatisfaction with the current administration has led to protests in the streets. The people demand lower taxes or political reform.',
        icon: '🔥',
        condition: (game) => game.nation !== null && game.nation.stats.taxRate > 15,
        options: [
            {
                label: 'Lower Taxes',
                description: 'Reduce tax rate to 10% for stability. (Income -)',
                effect: (game) => {
                    game.setTaxRate(10)
                    game.addModifiers([{
                        id: `tax-relief-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'STABILITY',
                        intensity: 1,
                        duration: 12,
                        description: 'Tax Relief'
                    }])
                }
            },
            {
                label: 'Crackdown',
                description: 'Deploy the army to restore order. (Soldiers -20%, Stability -)',
                effect: (game) => {
                    const lost = Math.round(game.nation!.stats.soldiers * 0.2)
                    game.updateNationSoldiers(-lost)
                    game.addModifiers([{
                        id: `crackdown-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'UNREST',
                        intensity: 1,
                        duration: 6,
                        description: 'Martial Law'
                    }])
                }
            }
        ]
    },
    {
        id: 'economic_boom',
        title: 'Economic Boom',
        description: 'New trade routes and industrial innovation have led to a surge in economic activity.',
        icon: '📈',
        options: [
            {
                label: 'Invest in Military',
                description: 'Use the surplus to modernize the army. (+2000 Soldiers)',
                effect: (game) => {
                    game.updateNationSoldiers(2000)
                }
            },
            {
                label: 'Save for Rainy Day',
                description: 'Add to the treasury. (+$500M)',
                effect: (game) => {
                    game.updateBudget(500_000_000)
                }
            }
        ]
    },
    {
        id: 'plague_outbreak',
        title: 'Plague Outbreak',
        description: 'A mysterious illness is spreading through the major cities. Panic is rising.',
        icon: 'microbe', // Will use emoji in UI if needed, or map to icon
        condition: (game) => (game.nation?.stats.gdpPerCapita || 0) < 15000, // Poor nations more susceptible
        options: [
            {
                label: 'Quarantine',
                description: 'Shut down trade to stop the spread. (Trade Income -50% for 6 months)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `quarantine-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'ECONOMIC_DEPRESSION',
                        intensity: 1,
                        duration: 6,
                        description: 'Trade Quarantine'
                    }])
                }
            },
            {
                label: 'Do Nothing',
                description: 'Let it run its course. (Population -5%, Stability -)',
                effect: (game) => {
                    // Complex to reduce pop directly, simulate via soldier loss and unrest
                    const lost = Math.round(game.nation!.stats.soldiers * 0.1)
                    game.updateNationSoldiers(-lost)
                    game.addModifiers([{
                        id: `plague-panic-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'UNREST',
                        intensity: 2,
                        duration: 6,
                        description: 'Plague Panic'
                    }])
                }
            }
        ]
    },
    {
        id: 'diplomatic_insult',
        title: 'Diplomatic Insult',
        description: 'A foreign ambassador has publicly insulted our nation\'s heritage!',
        icon: '🤬',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Demand Apology',
                description: 'Relations with random neighbor worsen.',
                effect: (game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.updateRelations(target.code, -20)
                        game.addDiplomaticEvents([{
                            id: `insult-${Date.now()}`,
                            type: 'BORDER_TENSION',
                            severity: 1,
                            title: 'Diplomatic Spat',
                            description: `Relations with ${target.name} have soured over recent comments.`,
                            affectedNations: [target.code],
                            timestamp: Date.now()
                        }])
                    }
                }
            },
            {
                label: 'Ignore It',
                description: 'Lose face but keep peace. (Authority -)',
                effect: (_game) => {
                    // No direct authority stat for player yet, but maybe stability hit?
                    // Or just a flavor text event
                }
            }
        ]
    },
    {
        id: 'military_innovation',
        title: 'Military Innovation',
        description: 'Our generals have proposed a new doctrine for the army.',
        icon: '⚔️',
        options: [
            {
                label: 'Quality over Quantity',
                description: 'Better training, fewer soldiers. (-10% Soldiers, +Defense Bonus)',
                effect: (game) => {
                    const lost = Math.round(game.nation!.stats.soldiers * 0.1)
                    game.updateNationSoldiers(-lost)
                    game.addModifiers([{
                        id: `elite-training-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'DEFENSE_BONUS',
                        intensity: 1,
                        duration: 12,
                        description: 'Elite Training'
                    }])
                }
            },
            {
                label: 'Mass Conscription',
                description: 'Recruit everyone! (+20% Soldiers, -Stability)',
                effect: (game) => {
                    const gain = Math.round(game.nation!.stats.soldiers * 0.2)
                    game.updateNationSoldiers(gain)
                    game.addModifiers([{
                        id: `conscription-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'UNREST',
                        intensity: 1,
                        duration: 6,
                        description: 'Forced Conscription'
                    }])
                }
            }
        ]
    },
    // --- Economy Events ---
    {
        id: 'gold_rush',
        title: 'Resource Discovery',
        description: 'Geologists have discovered massive deposits of valuable resources in our territory!',
        icon: '💰',
        options: [
            {
                label: 'Nationalize It',
                description: 'Direct profit for the state. (+$1B)',
                effect: (game) => {
                    game.updateBudget(1_000_000_000)
                }
            },
            {
                label: 'Encourage Private Sector',
                description: 'Boost long-term economy. (Economic Boom Modifier)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `gold-rush-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'ECONOMIC_BOOM',
                        intensity: 2,
                        duration: 24,
                        description: 'Resource Boom'
                    }])
                }
            }
        ]
    },
    {
        id: 'market_crash',
        title: 'Stock Market Crash',
        description: 'Global financial instability has hit our markets hard.',
        icon: '📉',
        options: [
            {
                label: 'Bailout Banks',
                description: 'Costly but stabilizes the economy. (-$500M)',
                effect: (game) => {
                    game.updateBudget(-500_000_000)
                }
            },
            {
                label: 'Let it Burn',
                description: 'Save the budget, lose stability. (Economic Depression)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `depression-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'ECONOMIC_DEPRESSION',
                        intensity: 2,
                        duration: 12,
                        description: 'Market Crash'
                    }])
                }
            }
        ]
    },
    {
        id: 'infrastructure_failure',
        title: 'Infrastructure Collapse',
        description: 'Aging bridges and roads are failing across the country.',
        icon: '🏗️',
        options: [
            {
                label: 'Emergency Repairs',
                description: 'Fix it immediately. (-$200M)',
                effect: (game) => {
                    game.updateBudget(-200_000_000)
                }
            },
            {
                label: 'Ignore',
                description: 'The people will suffer. (Stability -)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `infra-fail-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'UNREST',
                        intensity: 1,
                        duration: 6,
                        description: 'Crumbling Infrastructure'
                    }])
                }
            }
        ]
    },
    {
        id: 'tech_breakthrough',
        title: 'Technological Breakthrough',
        description: 'Our scientists have made a major discovery!',
        icon: '🔬',
        options: [
            {
                label: 'Military Application',
                description: 'New weapons. (Military Quality +)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `tech-mil-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'MILITARY_QUALITY',
                        intensity: 1,
                        duration: 24,
                        description: 'Advanced Weaponry'
                    }])
                }
            },
            {
                label: 'Civilian Application',
                description: 'Better quality of life. (Research Boost)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `tech-civ-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'RESEARCH_BOOST',
                        intensity: 1,
                        duration: 24,
                        description: 'High Tech Economy'
                    }])
                }
            }
        ]
    },
    {
        id: 'trade_deal',
        title: 'Trade Proposal',
        description: 'A major corporation wants to establish a regional hub.',
        icon: '🤝',
        options: [
            {
                label: 'Accept',
                description: 'Tax breaks for them, jobs for us. (Trade Boost)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `trade-hub-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'TRADE_BOOST',
                        intensity: 1,
                        duration: 12,
                        description: 'Regional Trade Hub'
                    }])
                }
            },
            {
                label: 'Reject',
                description: 'Protect local businesses. (No effect)',
                effect: (_game) => {
                    // No effect
                }
            }
        ]
    },
    // --- Military Events ---
    {
        id: 'generals_coup',
        title: 'Rumors of a Coup',
        description: 'Disgruntled generals are plotting against the government.',
        icon: '🎖️',
        condition: (game) => game.nation !== null && game.nation.stats.soldiers > 50000,
        options: [
            {
                label: 'Purge Command',
                description: 'Remove disloyal officers. (Military Quality -, Stability +)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `purge-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'MILITARY_QUALITY',
                        intensity: -1,
                        duration: 12,
                        description: 'Officer Purge'
                    }])
                }
            },
            {
                label: 'Bribe Them',
                description: 'Increase military budget. (-$100M, Military Quantity +)',
                effect: (game) => {
                    game.updateBudget(-100_000_000)
                    game.addModifiers([{
                        id: `bribed-generals-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'MILITARY_QUANTITY',
                        intensity: 1,
                        duration: 12,
                        description: 'Loyal Generals'
                    }])
                }
            }
        ]
    },
    {
        id: 'border_skirmish',
        title: 'Border Skirmish',
        description: 'Our troops have exchanged fire with a neighbor\'s patrol.',
        icon: '🔫',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Escalate',
                description: 'Show strength! (Relations -, Military Experience +)',
                effect: (game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.updateRelations(target.code, -30)
                        game.addModifiers([{
                            id: `combat-exp-${Date.now()}`,
                            countryCode: 'PLAYER',
                            countryName: game.nation?.name || 'Your Nation',
                            type: 'MILITARY_QUALITY',
                            intensity: 1,
                            duration: 6,
                            description: 'Combat Experience'
                        }])
                    }
                }
            },
            {
                label: 'De-escalate',
                description: 'Apologize and pull back. (Prestige -)',
                effect: (_game) => {
                    // No major effect, avoided war
                }
            }
        ]
    },
    {
        id: 'arms_smuggling',
        title: 'Arms Smuggling Ring',
        description: 'We\'ve uncovered a massive illegal arms trade operation.',
        icon: '📦',
        options: [
            {
                label: 'Seize Weapons',
                description: 'Add to our stockpile. (+Soldiers)',
                effect: (game) => {
                    game.updateNationSoldiers(500)
                }
            },
            {
                label: 'Sell Them',
                description: 'Sell on the black market. (+$50M, Corruption +)',
                effect: (game) => {
                    game.updateBudget(50_000_000)
                    game.addModifiers([{
                        id: `corruption-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'CORRUPTION',
                        intensity: 1,
                        duration: 6,
                        description: 'Black Market Deals'
                    }])
                }
            }
        ]
    },
    {
        id: 'naval_exercise',
        title: 'Joint Naval Exercises',
        description: 'An opportunity to train our navy in international waters.',
        icon: '⚓',
        options: [
            {
                label: 'Host the Games',
                description: 'Expensive but prestigious. (-$50M, Defense Bonus)',
                effect: (game) => {
                    game.updateBudget(-50_000_000)
                    game.addModifiers([{
                        id: `naval-games-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'DEFENSE_BONUS',
                        intensity: 1,
                        duration: 12,
                        description: 'Naval Readiness'
                    }])
                }
            },
            {
                label: 'Decline',
                description: 'Save the money.',
                effect: (_game) => {
                    // No effect
                }
            }
        ]
    },
    {
        id: 'defensive_pact',
        title: 'Defensive Pact Offer',
        description: 'A minor nation seeks our protection.',
        icon: '🛡️',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Guarantee Independence',
                description: 'We promise to defend them. (Prestige +, Risk of War)',
                effect: (game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.updateRelations(target.code, 50)
                        game.addModifiers([{
                            id: `guarantor-${Date.now()}`,
                            countryCode: 'PLAYER',
                            countryName: game.nation?.name || 'Your Nation',
                            type: 'CULTURAL_BOOM', // Using as prestige
                            intensity: 1,
                            duration: 12,
                            description: 'Defender of the Weak'
                        }])
                    }
                }
            },
            {
                label: 'Ignore',
                description: 'Not our problem.',
                effect: (_game) => {
                    // No effect
                }
            }
        ]
    },
    // --- Social Events ---
    {
        id: 'national_festival',
        title: 'National Festival',
        description: 'The people want to celebrate our nation\'s heritage.',
        icon: '🎉',
        options: [
            {
                label: 'Fund Lavish Party',
                description: 'Boost morale! (-$20M, Stability +)',
                effect: (game) => {
                    game.updateBudget(-20_000_000)
                    game.addModifiers([{
                        id: `festival-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'STABILITY',
                        intensity: 1,
                        duration: 6,
                        description: 'National Euphoria'
                    }])
                }
            },
            {
                label: 'Small Celebration',
                description: 'Keep it modest.',
                effect: (_game) => {
                    // No effect
                }
            }
        ]
    },
    {
        id: 'religious_schism',
        title: 'Religious Tensions',
        description: 'Sectarian violence is flaring up in the provinces.',
        icon: '🛐',
        options: [
            {
                label: 'Enforce Secularism',
                description: 'Crack down on extremists. (Unrest)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `secular-unrest-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'UNREST',
                        intensity: 1,
                        duration: 6,
                        description: 'Religious Protests'
                    }])
                }
            },
            {
                label: 'Support Majority',
                description: 'Side with the main religion. (Stability +, Minority Unrest)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `religious-favor-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'STABILITY',
                        intensity: 1,
                        duration: 12,
                        description: 'Religious Unity'
                    }])
                }
            }
        ]
    },
    {
        id: 'refugee_crisis',
        title: 'Refugee Crisis',
        description: 'War in a neighboring region has sent thousands to our border.',
        icon: '⛺',
        options: [
            {
                label: 'Accept Them',
                description: 'Humanitarian aid. (Population +, Budget -)',
                effect: (game) => {
                    game.updateBudget(-50_000_000)
                    game.addModifiers([{
                        id: `refugees-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'POPULATION_BOOM',
                        intensity: 1,
                        duration: 24,
                        description: 'Refugee Integration'
                    }])
                }
            },
            {
                label: 'Close Borders',
                description: 'Turn them away. (Prestige -)',
                effect: (_game) => {
                    // No effect
                }
            }
        ]
    },
    {
        id: 'brain_drain',
        title: 'Brain Drain',
        description: 'Our brightest minds are leaving for better opportunities abroad.',
        icon: '🧠',
        options: [
            {
                label: 'Increase Research Grants',
                description: 'Keep them here. (-$100M)',
                effect: (game) => {
                    game.updateBudget(-100_000_000)
                    game.addModifiers([{
                        id: `research-grant-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'RESEARCH_BOOST',
                        intensity: 1,
                        duration: 12,
                        description: 'Retained Talent'
                    }])
                }
            },
            {
                label: 'Let them go',
                description: 'We can\'t afford them. (Research -)',
                effect: (_game) => {
                    // Implicit loss of potential
                }
            }
        ]
    },
    {
        id: 'corruption_scandal',
        title: 'Corruption Scandal',
        description: 'A high-ranking minister has been caught embezzling funds.',
        icon: '💼',
        options: [
            {
                label: 'Public Trial',
                description: 'Justice must be served. (Stability +, Budget +)',
                effect: (game) => {
                    game.updateBudget(10_000_000) // Seized assets
                    game.addModifiers([{
                        id: `justice-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'STABILITY',
                        intensity: 1,
                        duration: 6,
                        description: 'Anti-Corruption Drive'
                    }])
                }
            },
            {
                label: 'Cover it up',
                description: 'Protect the party. (Corruption +)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `coverup-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'CORRUPTION',
                        intensity: 1,
                        duration: 12,
                        description: 'Systemic Corruption'
                    }])
                }
            }
        ]
    },
    // --- Flavor Events ---
    {
        id: 'meteor_sighting',
        title: 'Meteor Sighting',
        description: 'A brilliant meteor streaked across the sky last night. The people see it as a good omen.',
        icon: '☄️',
        options: [
            {
                label: 'Make a Wish',
                description: 'Hope for the best. (Stability +)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `omen-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'STABILITY',
                        intensity: 1,
                        duration: 3,
                        description: 'Good Omen'
                    }])
                }
            }
        ]
    },
    {
        id: 'famous_artist',
        title: 'Cultural Renaissance',
        description: 'A local artist has gained international fame, bringing attention to our culture.',
        icon: '🎨',
        options: [
            {
                label: 'Patronize the Arts',
                description: 'Fund their work. (-$5M, Cultural Boom)',
                effect: (game) => {
                    game.updateBudget(-5_000_000)
                    game.addModifiers([{
                        id: `culture-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'CULTURAL_BOOM',
                        intensity: 1,
                        duration: 12,
                        description: 'Golden Age of Art'
                    }])
                }
            },
            {
                label: 'Ignore',
                description: 'Art doesn\'t pay the bills.',
                effect: (_game) => {
                    // No effect
                }
            }
        ]
    },
    {
        id: 'ancient_ruins',
        title: 'Ancient Ruins Discovered',
        description: 'Construction workers have unearthed an ancient temple complex.',
        icon: '🏛️',
        options: [
            {
                label: 'Tourism Site',
                description: 'Develop it for visitors. (+$50M)',
                effect: (game) => {
                    game.updateBudget(50_000_000)
                }
            },
            {
                label: 'Research Site',
                description: 'Study the history. (Research Boost)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `archaeology-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'RESEARCH_BOOST',
                        intensity: 1,
                        duration: 12,
                        description: 'Historical Insights'
                    }])
                }
            }
        ]
    },
    {
        id: 'spy_ring',
        title: 'Spy Ring Busted',
        description: 'We have captured foreign agents operating in our capital.',
        icon: '🕵️',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Expose Them',
                description: 'Publicly shame their nation. (Relations -)',
                effect: (game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.updateRelations(target.code, -50)
                        game.addDiplomaticEvents([{
                            id: `spy-scandal-${Date.now()}`,
                            type: 'BORDER_TENSION',
                            severity: 2,
                            title: 'Espionage Scandal',
                            description: `Spies from ${target.name} were caught in our capital!`,
                            affectedNations: [target.code],
                            timestamp: Date.now()
                        }])
                    }
                }
            },
            {
                label: 'Turn Them',
                description: 'Force them to work for us. (Defense Bonus)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `counter-intel-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'DEFENSE_BONUS',
                        intensity: 1,
                        duration: 12,
                        description: 'Counter-Intelligence'
                    }])
                }
            }
        ]
    },
    {
        id: 'diplomatic_marriage',
        title: 'Royal Wedding',
        description: 'A strategic marriage has been proposed between our leading families and a neighbor.',
        icon: '💍',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Accept',
                description: 'Strengthen ties. (Relations +)',
                effect: (game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.updateRelations(target.code, 50)
                        game.addDiplomaticEvents([{
                            id: `wedding-${Date.now()}`,
                            type: 'ALLIANCE_PROPOSED',
                            severity: 1,
                            title: 'Royal Wedding',
                            description: `A union with ${target.name} has been celebrated!`,
                            affectedNations: [target.code],
                            timestamp: Date.now()
                        }])
                    }
                }
            },
            {
                label: 'Decline',
                description: 'We marry for love, not politics.',
                effect: (_game) => {
                    // No effect
                }
            }
        ]
    },
    // === DIPLOMATIC CRISIS EVENTS ===
    {
        id: 'embassy_siege',
        title: 'Embassy Under Siege',
        description: 'Protesters have surrounded our embassy in a foreign capital. Our diplomats are trapped inside.',
        icon: '🏛️',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Demand Protection',
                description: 'Insist the host nation restore order. (Relations -, Potential Crisis)',
                effect: (game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.updateRelations(target.code, -25)
                        game.addDiplomaticEvents([{
                            id: `embassy-crisis-${Date.now()}`,
                            type: 'BORDER_TENSION',
                            severity: 2,
                            title: 'Embassy Crisis',
                            description: `Tensions rise as ${target.name} fails to protect our embassy.`,
                            affectedNations: [target.code],
                            timestamp: Date.now()
                        }])
                    }
                }
            },
            {
                label: 'Evacuate Quietly',
                description: 'Pull out our diplomats to avoid escalation. (Prestige -)',
                effect: (_game) => { }
            }
        ]
    },
    {
        id: 'border_patrol_clash',
        title: 'Border Patrol Clash',
        description: 'Our border guards exchanged gunfire with a neighboring country\'s patrol. Several casualties reported.',
        icon: '🔫',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Demand Apology',
                description: 'Issue ultimatum for formal apology. (Relations -, Crisis Risk)',
                effect: (game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.updateRelations(target.code, -30)
                        game.addDiplomaticEvents([{
                            id: `border-clash-${Date.now()}`,
                            type: 'WAR_DECLARED',
                            severity: 2,
                            title: 'Border Incident',
                            description: `Military clash at the ${target.name} border could escalate.`,
                            affectedNations: [target.code],
                            timestamp: Date.now()
                        }])
                    }
                }
            },
            {
                label: 'Issue Joint Statement',
                description: 'De-escalate with mutual investigation. (Stability +)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `deescalation-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'STABILITY',
                        intensity: 1,
                        duration: 6,
                        description: 'Successful De-escalation'
                    }])
                }
            }
        ]
    },
    {
        id: 'cyber_attack',
        title: 'Major Cyber Attack',
        description: 'Our critical infrastructure has been hit by a sophisticated cyber attack. Evidence points to a foreign government.',
        icon: '💻',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Public Accusation',
                description: 'Name and shame the perpetrator. (Relations --, World Opinion +)',
                effect: (game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                        .filter(c => c.politicalState?.freedom && c.politicalState.freedom <= 2)
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.updateRelations(target.code, -40)
                        game.addDiplomaticEvents([{
                            id: `cyber-accusation-${Date.now()}`,
                            type: 'BORDER_TENSION',
                            severity: 2,
                            title: 'Cyber Warfare Accusation',
                            description: `We have publicly accused ${target.name} of cyber attacks.`,
                            affectedNations: [target.code],
                            timestamp: Date.now()
                        }])
                    }
                }
            },
            {
                label: 'Covert Retaliation',
                description: 'Strike back through our own cyber capabilities.',
                effect: (game) => {
                    game.addModifiers([{
                        id: `cyber-ops-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'MILITARY_QUALITY',
                        intensity: 1,
                        duration: 12,
                        description: 'Cyber Warfare Experience'
                    }])
                }
            }
        ]
    },
    {
        id: 'summit_invitation',
        title: 'Summit Invitation',
        description: 'A major power has invited us to a bilateral summit to discuss regional issues.',
        icon: '🤝',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Accept',
                description: 'Attend the summit. (Relations +, Prestige +)',
                effect: (game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                        .filter(c => c.relations > -20)
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.updateRelations(target.code, 20)
                        game.addModifiers([{
                            id: `summit-${Date.now()}`,
                            countryCode: 'PLAYER',
                            countryName: game.nation?.name || 'Your Nation',
                            type: 'CULTURAL_BOOM',
                            intensity: 1,
                            duration: 6,
                            description: 'Diplomatic Prestige'
                        }])
                    }
                }
            },
            {
                label: 'Decline',
                description: 'We have our own agenda.',
                effect: (_game) => { }
            }
        ]
    },
    {
        id: 'refugee_crisis',
        title: 'Massive Refugee Wave',
        description: 'War and famine in a neighboring region have sent hundreds of thousands of refugees to our borders.',
        icon: '⛺',
        options: [
            {
                label: 'Open Borders',
                description: 'Accept all refugees. (Budget --, Population +, World Opinion +)',
                effect: (game) => {
                    game.updateBudget(-200_000_000)
                    game.addModifiers([{
                        id: `refugee-help-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'POPULATION_BOOM',
                        intensity: 2,
                        duration: 24,
                        description: 'Refugee Integration'
                    }])
                }
            },
            {
                label: 'Limited Intake',
                description: 'Accept only verified refugees. (Budget -, Stability maintained)',
                effect: (game) => {
                    game.updateBudget(-50_000_000)
                }
            },
            {
                label: 'Close Borders',
                description: 'Turn them away at the border. (World Opinion --)',
                effect: (_game) => { }
            }
        ]
    },
    {
        id: 'un_resolution_vote',
        title: 'Critical UN Vote',
        description: 'The UN Security Council is voting on a resolution that could affect our interests.',
        icon: '🏛️',
        condition: (_game, world) => world.aiCountries.size > 5,
        options: [
            {
                label: 'Vote Yes',
                description: 'Support the resolution. (Improves standing with Western nations)',
                effect: (_game, world) => {
                    const western = ['USA', 'GBR', 'FRA', 'DEU']
                    western.forEach(code => {
                        if (world.aiCountries.has(code)) {
                            world.updateRelations(code, 10)
                        }
                    })
                }
            },
            {
                label: 'Vote No',
                description: 'Oppose the resolution. (Improves standing with non-Western powers)',
                effect: (_game, world) => {
                    const eastern = ['RUS', 'CHN', 'IRN', 'IND']
                    eastern.forEach(code => {
                        if (world.aiCountries.has(code)) {
                            world.updateRelations(code, 10)
                        }
                    })
                }
            },
            {
                label: 'Abstain',
                description: 'Stay neutral on this issue.',
                effect: (_game) => { }
            }
        ]
    },
    {
        id: 'diplomatic_expulsion',
        title: 'Diplomats Expelled',
        description: 'A foreign nation has expelled our diplomats, accusing them of espionage.',
        icon: '🚪',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Retaliate in Kind',
                description: 'Expel their diplomats immediately. (Relations --)',
                effect: (game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.updateRelations(target.code, -35)
                        game.addDiplomaticEvents([{
                            id: `expulsion-${Date.now()}`,
                            type: 'DIPLOMACY',
                            severity: 2,
                            title: 'Diplomatic Expulsions',
                            description: `Mutual diplomat expulsions between us and ${target.name}.`,
                            affectedNations: [target.code],
                            timestamp: Date.now()
                        }])
                    }
                }
            },
            {
                label: 'Demand Explanation',
                description: 'Request formal clarification through channels.',
                effect: (_game) => { }
            }
        ]
    },
    {
        id: 'trade_dispute',
        title: 'Trade Dispute',
        description: 'A trading partner accuses us of unfair trade practices and threatens tariffs.',
        icon: '📊',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Counter-Tariffs',
                description: 'Respond with our own trade barriers. (Trade War)',
                effect: (_game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                        .filter(c => c.tradePartners.length > 0)
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.setTariff(target.code, 'HIGH')
                        world.updateRelations(target.code, -20)
                    }
                }
            },
            {
                label: 'Negotiate',
                description: 'Seek a mutual solution. (Relations maintained)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `trade-deal-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'TRADE_BOOST',
                        intensity: 1,
                        duration: 12,
                        description: 'Trade Negotiation'
                    }])
                }
            }
        ]
    },
    {
        id: 'foreign_investment',
        title: 'Foreign Investment Offer',
        description: 'A major foreign corporation wants to invest heavily in our economy.',
        icon: '💵',
        options: [
            {
                label: 'Welcome Investment',
                description: 'Accept foreign capital. (+$500M, Influence risk)',
                effect: (game) => {
                    game.updateBudget(500_000_000)
                    game.addModifiers([{
                        id: `foreign-invest-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'ECONOMIC_BOOM',
                        intensity: 1,
                        duration: 24,
                        description: 'Foreign Investment'
                    }])
                }
            },
            {
                label: 'Restrict Sectors',
                description: 'Allow investment only in non-strategic sectors. (+$200M)',
                effect: (game) => {
                    game.updateBudget(200_000_000)
                }
            },
            {
                label: 'Reject',
                description: 'Protect national sovereignty.',
                effect: (_game) => { }
            }
        ]
    },
    {
        id: 'cultural_victory',
        title: 'Cultural Achievement',
        description: 'Our nation has won a prestigious international award, bringing global attention.',
        icon: '🏆',
        options: [
            {
                label: 'Celebrate Publicly',
                description: 'Boost national pride. (Stability +, World Opinion +)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `cultural-win-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'CULTURAL_BOOM',
                        intensity: 2,
                        duration: 12,
                        description: 'International Recognition'
                    }])
                }
            }
        ]
    },
    {
        id: 'assassination_attempt',
        title: 'Assassination Attempt',
        description: 'An attempt was made on a high-ranking official\'s life. Foreign involvement suspected.',
        icon: '🎯',
        condition: (_game, world) => world.aiCountries.size > 0,
        options: [
            {
                label: 'Public Investigation',
                description: 'Launch transparent investigation. (World Opinion +)',
                effect: (game) => {
                    game.addModifiers([{
                        id: `investigation-${Date.now()}`,
                        countryCode: 'PLAYER',
                        countryName: game.nation?.name || 'Your Nation',
                        type: 'STABILITY',
                        intensity: 1,
                        duration: 6,
                        description: 'Transparent Governance'
                    }])
                }
            },
            {
                label: 'Accuse Rival Nation',
                description: 'Blame a foreign power. (Relations --, Crisis Risk)',
                effect: (game, world) => {
                    const countries = Array.from(world.aiCountries.values())
                        .filter(c => c.relations < 0)
                    const target = countries[Math.floor(Math.random() * countries.length)]
                    if (target) {
                        world.updateRelations(target.code, -50)
                        game.addDiplomaticEvents([{
                            id: `assassination-crisis-${Date.now()}`,
                            type: 'WAR_DECLARED',
                            severity: 3,
                            title: 'Assassination Crisis',
                            description: `We have accused ${target.name} of orchestrating an assassination attempt.`,
                            affectedNations: [target.code],
                            timestamp: Date.now()
                        }])
                    }
                }
            }
        ]
    },
    {
        id: 'proxy_conflict',
        title: 'Proxy War Opportunity',
        description: 'A rebel group in a rival nation requests our support. They oppose our enemy\'s government.',
        icon: '⚔️',
        condition: (_game, world) => {
            const hostile = Array.from(world.aiCountries.values()).filter(c => c.relations < -30)
            return hostile.length > 0
        },
        options: [
            {
                label: 'Covert Support',
                description: 'Fund and arm the rebels secretly. (Budget -, Relations -- if caught)',
                effect: (game, world) => {
                    game.updateBudget(-100_000_000)
                    const hostile = Array.from(world.aiCountries.values())
                        .filter(c => c.relations < -30)
                    const target = hostile[Math.floor(Math.random() * hostile.length)]
                    if (target && Math.random() < 0.3) {
                        // Caught!
                        world.updateRelations(target.code, -40)
                        game.addDiplomaticEvents([{
                            id: `proxy-caught-${Date.now()}`,
                            type: 'WAR_DECLARED',
                            severity: 3,
                            title: 'Covert Support Exposed',
                            description: `${target.name} has evidence of our support for rebel groups.`,
                            affectedNations: [target.code],
                            timestamp: Date.now()
                        }])
                    }
                }
            },
            {
                label: 'Refuse',
                description: 'Stay out of their internal affairs.',
                effect: (_game) => { }
            }
        ]
    }
]

