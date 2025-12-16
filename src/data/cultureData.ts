export const COUNTRY_CULTURE_MAP: Record<string, { language: string, culture: string }> = {
    // North America
    'USA': { language: 'English', culture: 'Anglo-Saxon' },
    'CAN': { language: 'English', culture: 'Anglo-Saxon' },
    'MEX': { language: 'Spanish', culture: 'Latin American' },

    // South America
    'BRA': { language: 'Portuguese', culture: 'Latin American' },
    'ARG': { language: 'Spanish', culture: 'Latin American' },
    'COL': { language: 'Spanish', culture: 'Latin American' },
    'PER': { language: 'Spanish', culture: 'Latin American' },
    'VEN': { language: 'Spanish', culture: 'Latin American' },
    'CHL': { language: 'Spanish', culture: 'Latin American' },

    // Western Europe
    'GBR': { language: 'English', culture: 'Anglo-Saxon' },
    'FRA': { language: 'French', culture: 'Western European' },
    'DEU': { language: 'German', culture: 'Germanic' },
    'NLD': { language: 'Dutch', culture: 'Germanic' },
    'BEL': { language: 'French', culture: 'Western European' },
    'CHE': { language: 'German', culture: 'Western European' },
    'AUT': { language: 'German', culture: 'Germanic' },

    // Southern Europe
    'ITA': { language: 'Italian', culture: 'Mediterranean' },
    'ESP': { language: 'Spanish', culture: 'Mediterranean' },
    'PRT': { language: 'Portuguese', culture: 'Mediterranean' },
    'GRC': { language: 'Greek', culture: 'Mediterranean' },

    // Nordic
    'SWE': { language: 'Swedish', culture: 'Nordic' },
    'NOR': { language: 'Swedish', culture: 'Nordic' }, // Fallback to Swedish/Nordic group
    'DNK': { language: 'Swedish', culture: 'Nordic' }, // Fallback
    'FIN': { language: 'Swedish', culture: 'Nordic' }, // Fallback

    // Eastern Europe / Slavic
    'RUS': { language: 'Russian', culture: 'Slavic' },
    'POL': { language: 'Polish', culture: 'Slavic' },
    'UKR': { language: 'Russian', culture: 'Slavic' }, // Fallback
    'CZE': { language: 'Polish', culture: 'Slavic' }, // Fallback
    'HUN': { language: 'Polish', culture: 'Eastern European' }, // Fallback
    'ROU': { language: 'Italian', culture: 'Eastern European' }, // Fallback (Romance lang)

    // Middle East
    'TUR': { language: 'Turkish', culture: 'Middle Eastern' },
    'SAU': { language: 'Arabic', culture: 'Middle Eastern' },
    'IRN': { language: 'Arabic', culture: 'Middle Eastern' }, // Fallback (Persian not in list)
    'IRQ': { language: 'Arabic', culture: 'Middle Eastern' },
    'EGY': { language: 'Arabic', culture: 'Middle Eastern' },
    'ISR': { language: 'English', culture: 'Middle Eastern' }, // Fallback
    'ARE': { language: 'Arabic', culture: 'Middle Eastern' },

    // Asia
    'CHN': { language: 'Mandarin', culture: 'East Asian' },
    'JPN': { language: 'Japanese', culture: 'East Asian' },
    'KOR': { language: 'Mandarin', culture: 'East Asian' }, // Fallback
    'IND': { language: 'English', culture: 'South Asian' }, // Fallback (Hindi not in list)
    'PAK': { language: 'English', culture: 'South Asian' },
    'BGD': { language: 'English', culture: 'South Asian' },
    'IDN': { language: 'English', culture: 'South Asian' }, // Fallback
    'VNM': { language: 'Mandarin', culture: 'East Asian' }, // Fallback
    'THA': { language: 'Mandarin', culture: 'East Asian' }, // Fallback

    // Africa
    'NGA': { language: 'English', culture: 'African' },
    'ETH': { language: 'English', culture: 'African' },
    'ZAF': { language: 'English', culture: 'African' },
    'COD': { language: 'French', culture: 'African' },
    'TZA': { language: 'English', culture: 'African' },
    'KEN': { language: 'English', culture: 'African' },

    // Oceania
    'AUS': { language: 'English', culture: 'Anglo-Saxon' },
    'NZL': { language: 'English', culture: 'Anglo-Saxon' },
}

export const DEFAULT_CULTURE = { language: 'English', culture: 'Western European' }
