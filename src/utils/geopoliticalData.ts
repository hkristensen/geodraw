/**
 * Geopolitical Data Loader
 * Loads and parses political data from JSON files for all countries
 */

export interface GeopoliticalCountry {
    name: string
    leader: string
    orientation: string
    gov_type: string
    policies: string[]
    allies: string[]
    enemies: string[]
    religions: string[]
    unrest: number        // 1-5
    leader_pop: number    // 1-5 (popularity)
    freedom: number       // 1-5
    military: number      // 1-5
    aggression: number    // 1-5
    trade: string[]
}

interface ContinentData {
    continent: string
    last_updated?: string
    data_version?: string
    countries: RawCountryData[]
}

// Raw data structure as it comes from JSON (stats nested)
interface RawCountryData {
    name: string
    leader: string
    orientation: string
    gov_type: string
    policies: string[]
    allies: string[]
    enemies: string[]
    religions: string[]
    trade: string[]
    stats: {
        unrest: number
        popularity: number
        freedom: number
        military: number
        aggressiveness: number
    }
}


// Map orientation strings to numeric values (-100 to +100)
export const ORIENTATION_MAP: Record<string, number> = {
    // Far Left
    'Far-Left': -90,
    'Far-Left Authoritarian': -85,
    'Communist': -80,
    'Communist (Juche)': -85,
    'Communist (CCP)': -75,

    // Left
    'Left-Wing': -60,
    'Left-Populist': -55,
    'Center-Left': -30,
    'Center-Left (Liberal)': -25,

    // Center
    'Centrist': 0,
    'Centrist (Transitional)': 5,
    'Centrist (Technocratic)': 5,
    'Independent-Left': -15,
    'National Centrist': 10,

    // Right
    'Center-Right': 30,
    'Right-Wing': 60,
    'Right-Wing Populist': 65,
    'Right-Wing (Military)': 70,
    'Far-Right': 90,
    'Far-Right Nationalist': 85,
    'Far-Right Authoritarian': 88,

    // Special
    'Nationalist': 50,
    'Nationalist (Military)': 55,
    'Military-Nationalist': 60,
    'Libertarian': 20,
    'Conservative': 45,
    'Conservative-Modernist': 40,
    'Theocratic': 70,
    'Traditionalist': 65,
    'Pro-China': 10,
    'Pro-Russian': 15,
    'Transitional (Military)': 40,
}

// Map government type strings to enum
export type GovernmentTypeEnum =
    | 'DEMOCRACY'
    | 'PARLIAMENTARY'
    | 'PRESIDENTIAL'
    | 'SEMI_PRESIDENTIAL'
    | 'CONSTITUTIONAL_MONARCHY'
    | 'ABSOLUTE_MONARCHY'
    | 'AUTHORITARIAN'
    | 'MILITARY_JUNTA'
    | 'THEOCRACY'
    | 'COMMUNIST'
    | 'ONE_PARTY'
    | 'TRANSITIONAL'

export const GOV_TYPE_MAP: Record<string, GovernmentTypeEnum> = {
    'Federal Republic': 'PRESIDENTIAL',
    'Presidential Republic': 'PRESIDENTIAL',
    'Semi-Presidential': 'SEMI_PRESIDENTIAL',
    'Semi-Presidential Republic': 'SEMI_PRESIDENTIAL',
    'Parliamentary Republic': 'PARLIAMENTARY',
    'Parliamentary Democracy': 'PARLIAMENTARY',
    'Federal Parliamentary': 'PARLIAMENTARY',
    'Constitutional Monarchy': 'CONSTITUTIONAL_MONARCHY',
    'Constitutional Co-Principality': 'CONSTITUTIONAL_MONARCHY',
    'Absolute Monarchy': 'ABSOLUTE_MONARCHY',
    'Authoritarian': 'AUTHORITARIAN',
    'Military Junta': 'MILITARY_JUNTA',
    'Theocratic Republic': 'THEOCRACY',
    'Theocratic Emirate': 'THEOCRACY',
    'One-Party State': 'ONE_PARTY',
    'Totalitarian Dictatorship': 'AUTHORITARIAN',
    'Interim Council': 'TRANSITIONAL',
    'Interim Government': 'TRANSITIONAL',
    'Presidential Council': 'TRANSITIONAL',
    'Direct Democracy': 'DEMOCRACY',
}

// Cache for loaded data
let geopoliticalCache: Map<string, GeopoliticalCountry> | null = null
let loadingPromise: Promise<Map<string, GeopoliticalCountry>> | null = null

// Country name to ISO3 code mapping (partial - extend as needed)
const NAME_TO_ISO3: Record<string, string> = {
    'United States': 'USA', 'Canada': 'CAN', 'Mexico': 'MEX', 'Cuba': 'CUB',
    'Haiti': 'HTI', 'Dominican Republic': 'DOM', 'El Salvador': 'SLV',
    'Guatemala': 'GTM', 'Honduras': 'HND', 'Panama': 'PAN', 'Costa Rica': 'CRI',
    'Nicaragua': 'NIC', 'Jamaica': 'JAM', 'Trinidad and Tobago': 'TTO',
    'The Bahamas': 'BHS', 'Belize': 'BLZ',
    // South America
    'Brazil': 'BRA', 'Argentina': 'ARG', 'Chile': 'CHL', 'Venezuela': 'VEN',
    'Colombia': 'COL', 'Peru': 'PER', 'Ecuador': 'ECU', 'Bolivia': 'BOL',
    'Uruguay': 'URY', 'Paraguay': 'PRY', 'Guyana': 'GUY', 'Suriname': 'SUR',
    // Europe
    'Germany': 'DEU', 'France': 'FRA', 'United Kingdom': 'GBR', 'Italy': 'ITA',
    'Spain': 'ESP', 'Poland': 'POL', 'Romania': 'ROU', 'Netherlands': 'NLD',
    'Belgium': 'BEL', 'Greece': 'GRC', 'Portugal': 'PRT', 'Sweden': 'SWE',
    'Hungary': 'HUN', 'Austria': 'AUT', 'Switzerland': 'CHE', 'Norway': 'NOR',
    'Denmark': 'DNK', 'Finland': 'FIN', 'Ireland': 'IRL', 'Czechia': 'CZE',
    'Slovakia': 'SVK', 'Croatia': 'HRV', 'Slovenia': 'SVN', 'Estonia': 'EST',
    'Latvia': 'LVA', 'Lithuania': 'LTU', 'Bulgaria': 'BGR', 'Serbia': 'SRB',
    'Ukraine': 'UKR', 'Russia': 'RUS', 'Belarus': 'BLR', 'Moldova': 'MDA',
    'Albania': 'ALB', 'North Macedonia': 'MKD', 'Montenegro': 'MNE',
    'Bosnia and Herzegovina': 'BIH', 'Kosovo': 'XKX', 'Cyprus': 'CYP',
    'Malta': 'MLT', 'Luxembourg': 'LUX', 'Iceland': 'ISL',
    'Monaco': 'MCO', 'San Marino': 'SMR', 'Andorra': 'AND', 'Vatican City': 'VAT',
    // Asia
    'China': 'CHN', 'Japan': 'JPN', 'South Korea': 'KOR', 'North Korea': 'PRK',
    'India': 'IND', 'Pakistan': 'PAK', 'Bangladesh': 'BGD', 'Indonesia': 'IDN',
    'Thailand': 'THA', 'Vietnam': 'VNM', 'Philippines': 'PHL', 'Malaysia': 'MYS',
    'Singapore': 'SGP', 'Myanmar': 'MMR', 'Cambodia': 'KHM', 'Laos': 'LAO',
    'Nepal': 'NPL', 'Sri Lanka': 'LKA', 'Afghanistan': 'AFG', 'Iran': 'IRN',
    'Iraq': 'IRQ', 'Syria': 'SYR', 'Saudi Arabia': 'SAU', 'Yemen': 'YEM',
    'UAE': 'ARE', 'Israel': 'ISR', 'Jordan': 'JOR', 'Lebanon': 'LBN',
    'Turkey': 'TUR', 'Kuwait': 'KWT', 'Qatar': 'QAT', 'Bahrain': 'BHR',
    'Oman': 'OMN', 'Kazakhstan': 'KAZ', 'Uzbekistan': 'UZB', 'Turkmenistan': 'TKM',
    'Tajikistan': 'TJK', 'Kyrgyzstan': 'KGZ', 'Mongolia': 'MNG', 'Taiwan': 'TWN',
    'Georgia': 'GEO', 'Armenia': 'ARM', 'Azerbaijan': 'AZE', 'Bhutan': 'BTN',
    'Brunei': 'BRN', 'Maldives': 'MDV', 'Timor-Leste': 'TLS', 'Palestine': 'PSE',
    // Africa
    'Algeria': 'DZA', 'Angola': 'AGO', 'Benin': 'BEN', 'Botswana': 'BWA',
    'Burkina Faso': 'BFA', 'Burundi': 'BDI', 'Cabo Verde': 'CPV', 'Cameroon': 'CMR',
    'Central African Republic': 'CAF', 'Chad': 'TCD', 'Comoros': 'COM',
    'Congo (Brazzaville)': 'COG', 'Congo (DRC)': 'COD', "Côte d'Ivoire": 'CIV',
    'Djibouti': 'DJI', 'Egypt': 'EGY', 'Equatorial Guinea': 'GNQ', 'Eritrea': 'ERI',
    'Eswatini': 'SWZ', 'Ethiopia': 'ETH', 'Gabon': 'GAB', 'Gambia': 'GMB',
    'Ghana': 'GHA', 'Guinea': 'GIN', 'Guinea-Bissau': 'GNB', 'Kenya': 'KEN',
    'Lesotho': 'LSO', 'Liberia': 'LBR', 'Libya': 'LBY', 'Madagascar': 'MDG',
    'Malawi': 'MWI', 'Mali': 'MLI', 'Mauritania': 'MRT', 'Mauritius': 'MUS',
    'Morocco': 'MAR', 'Mozambique': 'MOZ', 'Namibia': 'NAM', 'Niger': 'NER',
    'Nigeria': 'NGA', 'Rwanda': 'RWA', 'Senegal': 'SEN', 'Seychelles': 'SYC',
    'Sierra Leone': 'SLE', 'Somalia': 'SOM', 'South Africa': 'ZAF', 'South Sudan': 'SSD',
    'Sudan': 'SDN', 'Tanzania': 'TZA', 'Togo': 'TGO', 'Tunisia': 'TUN',
    'Uganda': 'UGA', 'Zambia': 'ZMB', 'Zimbabwe': 'ZWE', 'São Tomé and Príncipe': 'STP',
    // Oceania
    'Australia': 'AUS', 'New Zealand': 'NZL', 'Papua New Guinea': 'PNG',
    'Fiji': 'FJI', 'Samoa': 'WSM', 'Solomon Islands': 'SLB', 'Vanuatu': 'VUT',
    'Kiribati': 'KIR', 'Micronesia (FSM)': 'FSM', 'Marshall Islands': 'MHL',
    'Palau': 'PLW', 'Tonga': 'TON', 'Nauru': 'NRU', 'Tuvalu': 'TUV',
}

/**
 * Load geopolitical data from all continent files
 */
async function loadGeopoliticalData(): Promise<Map<string, GeopoliticalCountry>> {
    const dataMap = new Map<string, GeopoliticalCountry>()

    const continents = [
        'Africa', 'Asia', 'Europe', 'North_America', 'Oceania', 'South_America'
    ]

    const results = await Promise.all(
        continents.map(async (continent) => {
            try {
                const response = await fetch(`/data/geopolitics/geopolitics_${continent}.json`)

                // Check if response is ok and has content
                if (!response.ok) {
                    console.warn(`⚠️ Failed to load ${continent}: ${response.status}`)
                    return { continent, data: [] as RawCountryData[] }
                }

                const text = await response.text()

                // Skip empty files
                if (!text || text.trim().length === 0) {
                    console.warn(`⚠️ ${continent} data file is empty, skipping`)
                    return { continent, data: [] as RawCountryData[] }
                }

                const parsedData = JSON.parse(text) as ContinentData
                console.log(`✅ Loaded ${continent}: ${parsedData.countries.length} countries`)
                return { continent, data: parsedData.countries }
            } catch (error) {
                console.error(`❌ Error loading ${continent}:`, error)
                return { continent, data: [] as RawCountryData[] }
            }
        })
    )


    for (const result of results) {
        for (const rawCountry of result.data) {
            // Transform raw data to GeopoliticalCountry format (flatten stats)
            const country: GeopoliticalCountry = {
                name: rawCountry.name,
                leader: rawCountry.leader,
                orientation: rawCountry.orientation,
                gov_type: rawCountry.gov_type,
                policies: rawCountry.policies,
                allies: rawCountry.allies,
                enemies: rawCountry.enemies,
                religions: rawCountry.religions,
                trade: rawCountry.trade,
                // Flatten stats with proper field name mapping
                unrest: rawCountry.stats?.unrest ?? 3,
                leader_pop: rawCountry.stats?.popularity ?? 3,
                freedom: rawCountry.stats?.freedom ?? 3,
                military: rawCountry.stats?.military ?? 3,
                aggression: rawCountry.stats?.aggressiveness ?? 3,
            }

            // Get ISO3 code from name
            const iso3 = NAME_TO_ISO3[country.name]
            if (iso3) {
                dataMap.set(iso3, country)
            } else {
                // Also store by name for fallback lookup
                dataMap.set(country.name, country)
            }
        }
    }


    console.log(`🌍 Loaded geopolitical data for ${dataMap.size} countries`)
    return dataMap
}

/**
 * Initialize geopolitical data (call early in app lifecycle)
 */
export async function initGeopoliticalData(): Promise<void> {
    if (!geopoliticalCache && !loadingPromise) {
        loadingPromise = loadGeopoliticalData()
        geopoliticalCache = await loadingPromise
        loadingPromise = null
    }
}

/**
 * Get geopolitical data by ISO3 code or country name
 */
export function getGeopoliticalData(codeOrName: string): GeopoliticalCountry | undefined {
    return geopoliticalCache?.get(codeOrName)
}

/**
 * Get all geopolitical data
 */
export function getAllGeopoliticalData(): Map<string, GeopoliticalCountry> {
    return geopoliticalCache || new Map()
}

/**
 * Map orientation string to numeric value
 */
export function mapOrientationToNumber(orientation: string): number {
    // Direct match
    if (ORIENTATION_MAP[orientation] !== undefined) {
        return ORIENTATION_MAP[orientation]
    }

    // Fuzzy match
    const lower = orientation.toLowerCase()
    if (lower.includes('far-left') || lower.includes('communist')) return -80
    if (lower.includes('left')) return -40
    if (lower.includes('far-right')) return 85
    if (lower.includes('right')) return 50
    if (lower.includes('center')) return 0
    if (lower.includes('nationalist')) return 55
    if (lower.includes('theocratic')) return 70

    // Default to center
    return 0
}

/**
 * Map government type string to enum
 */
export function mapGovType(govType: string): GovernmentTypeEnum {
    if (GOV_TYPE_MAP[govType]) {
        return GOV_TYPE_MAP[govType]
    }

    // Fuzzy matching
    const lower = govType.toLowerCase()
    if (lower.includes('junta') || lower.includes('military')) return 'MILITARY_JUNTA'
    if (lower.includes('monarchy')) return 'CONSTITUTIONAL_MONARCHY'
    if (lower.includes('authoritarian')) return 'AUTHORITARIAN'
    if (lower.includes('communist') || lower.includes('one-party')) return 'ONE_PARTY'
    if (lower.includes('theocr')) return 'THEOCRACY'
    if (lower.includes('parliamentary')) return 'PARLIAMENTARY'
    if (lower.includes('presidential')) return 'PRESIDENTIAL'

    return 'PRESIDENTIAL' // Default
}

/**
 * Check if a country is a democracy (has elections)
 */
export function isDemocracy(govType: GovernmentTypeEnum): boolean {
    return [
        'DEMOCRACY', 'PARLIAMENTARY', 'PRESIDENTIAL',
        'SEMI_PRESIDENTIAL', 'CONSTITUTIONAL_MONARCHY'
    ].includes(govType)
}

/**
 * Get ISO3 code from country name
 */
export function getISO3FromName(name: string): string | undefined {
    return NAME_TO_ISO3[name]
}
