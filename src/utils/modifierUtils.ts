import { CountryModifier, ModifierType } from '../types/game'

export function createModifier(
    type: ModifierType,
    country: { code: string, name: string },
    overrides: Partial<CountryModifier> = {}
): CountryModifier {
    return {
        id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        countryCode: country.code,
        countryName: country.name,
        type,
        intensity: 50, // Default intensity
        duration: 24, // Default 2 years (24 months)
        description: overrides.description || getDescriptionForType(type),
        ...overrides
    }
}

function getDescriptionForType(type: ModifierType): string {
    switch (type) {
        case 'REVANCHISM': return 'Strong desire to reclaim lost territory.'
        case 'UNREST': return 'Political instability and civil disorder.'
        case 'ECONOMIC_BOOM': return 'Rapid economic growth.'
        case 'ECONOMIC_CRISIS': return 'Severe economic downturn.'
        case 'MILITARY_BUILDUP': return 'Expanding military capabilities.'
        case 'PACIFIST_MOVEMENT': return 'Public demand for peace.'
        case 'SCANDAL': return 'Government embroiled in scandal.'
        case 'GOLDEN_AGE': return 'Era of prosperity and cultural influence.'
        case 'NUCLEAR_DEVASTATED': return 'Suffering from nuclear fallout.'
        case 'MARTIAL_LAW': return 'Military rule enforced.'
        case 'DIPLOMATIC_ISOLATION': return 'Cut off from international community.'
        case 'SANCTIONS': return 'Under economic sanctions.'
        case 'TRADE_WAR': return 'Engaged in trade hostilities.'
        case 'HYPERINFLATION': return 'Currency is worthless.'
        case 'FAMINE': return 'Severe food shortage.'
        default: return type.replace('_', ' ')
    }
}

export function hasModifier(modifiers: CountryModifier[], type: ModifierType | string): boolean {
    return modifiers.some(m => m.type === type)
}

export function getModifier(modifiers: CountryModifier[], type: ModifierType | string): CountryModifier | undefined {
    return modifiers.find(m => m.type === type)
}
