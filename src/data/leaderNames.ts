/**
 * Leader Name Generation
 * Country-specific name pools for generating realistic leader names on regime changes
 */

interface NamePool {
    given: string[]
    family: string[]
    titles: string[]
}

// Country-specific name pools (ISO3 code -> names)
export const LEADER_NAMES: Record<string, NamePool> = {
    // North America
    'USA': {
        given: ['John', 'Michael', 'Robert', 'James', 'William', 'David', 'Richard', 'Thomas', 'Joseph', 'Charles'],
        family: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Anderson', 'Taylor'],
        titles: ['President']
    },
    'CAN': {
        given: ['Justin', 'Stephen', 'Pierre', 'Jean', 'Paul', 'Brian', 'Michael', 'Andrew', 'Thomas', 'Robert'],
        family: ['Trudeau', 'Harper', 'Martin', 'Mulroney', 'Chretien', 'Campbell', 'Turner', 'Clark', 'Pearson', 'Diefenbaker'],
        titles: ['Prime Minister']
    },
    'MEX': {
        given: ['Andrés', 'Enrique', 'Felipe', 'Vicente', 'Carlos', 'Ernesto', 'Miguel', 'José', 'Luis', 'Manuel'],
        family: ['López', 'Peña', 'Calderón', 'Fox', 'Salinas', 'Zedillo', 'González', 'Hernández', 'Martínez', 'García'],
        titles: ['President']
    },

    // Europe
    'DEU': {
        given: ['Friedrich', 'Wolfgang', 'Hans', 'Klaus', 'Helmut', 'Gerhard', 'Angela', 'Olaf', 'Franz', 'Werner'],
        family: ['Merz', 'Schmidt', 'Müller', 'Weber', 'Schneider', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Schulz'],
        titles: ['Chancellor']
    },
    'FRA': {
        given: ['Emmanuel', 'François', 'Nicolas', 'Jacques', 'Valéry', 'Georges', 'Charles', 'Jean', 'Pierre', 'Michel'],
        family: ['Macron', 'Hollande', 'Sarkozy', 'Chirac', 'Mitterrand', 'Pompidou', 'de Gaulle', 'Dupont', 'Martin', 'Bernard'],
        titles: ['President']
    },
    'GBR': {
        given: ['Keir', 'Boris', 'Theresa', 'David', 'Gordon', 'Tony', 'John', 'Margaret', 'James', 'Edward'],
        family: ['Starmer', 'Johnson', 'May', 'Cameron', 'Brown', 'Blair', 'Major', 'Thatcher', 'Heath', 'Wilson'],
        titles: ['Prime Minister']
    },
    'RUS': {
        given: ['Vladimir', 'Dmitri', 'Alexei', 'Ivan', 'Sergei', 'Mikhail', 'Nikolai', 'Andrei', 'Boris', 'Viktor'],
        family: ['Putin', 'Medvedev', 'Petrov', 'Volkov', 'Sokolov', 'Ivanov', 'Smirnov', 'Kuznetsov', 'Popov', 'Vasiliev'],
        titles: ['President']
    },
    'UKR': {
        given: ['Volodymyr', 'Petro', 'Viktor', 'Leonid', 'Yulia', 'Oleksandr', 'Mykola', 'Andrii', 'Ivan', 'Dmytro'],
        family: ['Zelensky', 'Poroshenko', 'Yanukovych', 'Kuchma', 'Tymoshenko', 'Bondarenko', 'Shevchenko', 'Kovalenko', 'Melnyk', 'Tkachenko'],
        titles: ['President']
    },
    'POL': {
        given: ['Andrzej', 'Jarosław', 'Donald', 'Lech', 'Aleksander', 'Bronisław', 'Wojciech', 'Tadeusz', 'Jan', 'Piotr'],
        family: ['Duda', 'Kaczyński', 'Tusk', 'Wałęsa', 'Kwaśniewski', 'Komorowski', 'Mazowiecki', 'Nowak', 'Kowalski', 'Wiśniewski'],
        titles: ['President']
    },
    'ITA': {
        given: ['Giorgia', 'Mario', 'Sergio', 'Giuseppe', 'Silvio', 'Romano', 'Giulio', 'Enrico', 'Matteo', 'Paolo'],
        family: ['Meloni', 'Draghi', 'Mattarella', 'Conte', 'Berlusconi', 'Prodi', 'Renzi', 'Rossi', 'Russo', 'Ferrari'],
        titles: ['Prime Minister']
    },
    'ESP': {
        given: ['Pedro', 'Mariano', 'José', 'Felipe', 'Adolfo', 'Leopoldo', 'Santiago', 'Pablo', 'Alberto', 'Luis'],
        family: ['Sánchez', 'Rajoy', 'Zapatero', 'Aznar', 'González', 'Suárez', 'Abascal', 'García', 'Martínez', 'López'],
        titles: ['Prime Minister']
    },

    // Asia
    'CHN': {
        given: ['Xi', 'Li', 'Hu', 'Wen', 'Jiang', 'Deng', 'Mao', 'Zhou', 'Chen', 'Wang'],
        family: ['Jinping', 'Keqiang', 'Jintao', 'Jiabao', 'Zemin', 'Xiaoping', 'Zedong', 'Enlai', 'Yi', 'Hong'],
        titles: ['President', 'General Secretary']
    },
    'JPN': {
        given: ['Shigeru', 'Fumio', 'Yoshihide', 'Shinzo', 'Naoto', 'Yukio', 'Taro', 'Yasuo', 'Junichiro', 'Keizo'],
        family: ['Ishiba', 'Kishida', 'Suga', 'Abe', 'Kan', 'Hatoyama', 'Aso', 'Fukuda', 'Koizumi', 'Obuchi'],
        titles: ['Prime Minister']
    },
    'KOR': {
        given: ['Yoon', 'Moon', 'Park', 'Lee', 'Kim', 'Roh', 'Chun', 'Noh', 'Choi', 'Jeong'],
        family: ['Suk-yeol', 'Jae-in', 'Geun-hye', 'Myung-bak', 'Dae-jung', 'Moo-hyun', 'Young-sam', 'Tae-woo', 'Doo-hwan'],
        titles: ['President']
    },
    'IND': {
        given: ['Narendra', 'Manmohan', 'Atal', 'Rajiv', 'Indira', 'Jawaharlal', 'Morarji', 'Charan', 'Deve', 'Narasimha'],
        family: ['Modi', 'Singh', 'Gandhi', 'Nehru', 'Vajpayee', 'Desai', 'Rao', 'Sharma', 'Gupta', 'Kumar'],
        titles: ['Prime Minister']
    },
    'PAK': {
        given: ['Shehbaz', 'Imran', 'Nawaz', 'Benazir', 'Pervez', 'Yousaf', 'Zulfikar', 'Muhammad', 'Asif', 'Raja'],
        family: ['Sharif', 'Khan', 'Bhutto', 'Musharraf', 'Gilani', 'Ali', 'Ahmed', 'Hassan', 'Raza', 'Malik'],
        titles: ['Prime Minister']
    },

    // Middle East
    'SAU': {
        given: ['Mohammed', 'Abdullah', 'Salman', 'Faisal', 'Fahd', 'Khalid', 'Turki', 'Bandar', 'Sultan', 'Nayef'],
        family: ['bin Salman', 'bin Abdulaziz', 'Al-Saud', 'Al-Rashid', 'Al-Faisal', 'Al-Sheikh', 'Al-Turki'],
        titles: ['King', 'Crown Prince']
    },
    'IRN': {
        given: ['Ali', 'Hassan', 'Mahmoud', 'Mohammad', 'Ebrahim', 'Akbar', 'Hossein', 'Reza', 'Abbas', 'Ahmad'],
        family: ['Khamenei', 'Rouhani', 'Raisi', 'Ahmadinejad', 'Khatami', 'Hashemi', 'Larijani', 'Zarif', 'Soleimani', 'Rezaei'],
        titles: ['President', 'Supreme Leader']
    },
    'ISR': {
        given: ['Benjamin', 'Yair', 'Naftali', 'Yitzhak', 'Ariel', 'Ehud', 'Shimon', 'Moshe', 'David', 'Menachem'],
        family: ['Netanyahu', 'Lapid', 'Bennett', 'Rabin', 'Sharon', 'Barak', 'Peres', 'Dayan', 'Ben-Gurion', 'Begin'],
        titles: ['Prime Minister']
    },
    'TUR': {
        given: ['Recep', 'Abdullah', 'Ahmet', 'Bülent', 'Süleyman', 'Turgut', 'Tansu', 'Mesut', 'Necmettin', 'Kemal'],
        family: ['Erdoğan', 'Gül', 'Davutoğlu', 'Ecevit', 'Demirel', 'Özal', 'Çiller', 'Yılmaz', 'Erbakan', 'Kılıçdaroğlu'],
        titles: ['President']
    },

    // Africa
    'EGY': {
        given: ['Abdel', 'Hosni', 'Mohamed', 'Anwar', 'Gamal', 'Ahmed', 'Mahmoud', 'Ibrahim', 'Mustafa', 'Hassan'],
        family: ['el-Sisi', 'Mubarak', 'Morsi', 'Sadat', 'Nasser', 'Shafik', 'Abbas', 'Hussein', 'Mansour', 'Salem'],
        titles: ['President']
    },
    'NGA': {
        given: ['Bola', 'Muhammadu', 'Goodluck', 'Olusegun', 'Umaru', 'Sani', 'Ibrahim', 'Yakubu', 'Shehu', 'Nnamdi'],
        family: ['Tinubu', 'Buhari', 'Jonathan', 'Obasanjo', 'Yar\'Adua', 'Abacha', 'Babangida', 'Gowon', 'Shagari', 'Azikiwe'],
        titles: ['President']
    },
    'ZAF': {
        given: ['Cyril', 'Jacob', 'Thabo', 'Nelson', 'Kgalema', 'Frederik', 'Pieter', 'John', 'Julius', 'Hendrik'],
        family: ['Ramaphosa', 'Zuma', 'Mbeki', 'Mandela', 'Motlanthe', 'de Klerk', 'Botha', 'Vorster', 'Malema', 'Verwoerd'],
        titles: ['President']
    },

    // South America
    'BRA': {
        given: ['Lula', 'Jair', 'Dilma', 'Michel', 'Fernando', 'Itamar', 'José', 'João', 'Getúlio', 'Juscelino'],
        family: ['da Silva', 'Bolsonaro', 'Rousseff', 'Temer', 'Cardoso', 'Franco', 'Sarney', 'Goulart', 'Vargas', 'Kubitschek'],
        titles: ['President']
    },
    'ARG': {
        given: ['Javier', 'Alberto', 'Mauricio', 'Cristina', 'Néstor', 'Eduardo', 'Carlos', 'Fernando', 'Raúl', 'Juan'],
        family: ['Milei', 'Fernández', 'Macri', 'Kirchner', 'Duhalde', 'Menem', 'de la Rúa', 'Alfonsín', 'Perón'],
        titles: ['President']
    },

    // Oceania
    'AUS': {
        given: ['Anthony', 'Scott', 'Malcolm', 'Tony', 'Julia', 'Kevin', 'John', 'Paul', 'Bob', 'Gough'],
        family: ['Albanese', 'Morrison', 'Turnbull', 'Abbott', 'Gillard', 'Rudd', 'Howard', 'Keating', 'Hawke', 'Whitlam'],
        titles: ['Prime Minister']
    },
    'NZL': {
        given: ['Christopher', 'Jacinda', 'Bill', 'John', 'Helen', 'Jenny', 'Jim', 'David', 'Robert', 'Geoffrey'],
        family: ['Luxon', 'Ardern', 'English', 'Key', 'Clark', 'Shipley', 'Bolger', 'Palmer', 'Lange', 'Muldoon'],
        titles: ['Prime Minister']
    },
}

// Default fallback for countries not in the list
const DEFAULT_NAMES: NamePool = {
    given: ['Alexander', 'Victor', 'Michael', 'John', 'Peter', 'David', 'James', 'Robert', 'Thomas', 'William'],
    family: ['Smith', 'Johnson', 'Anderson', 'Wilson', 'Brown', 'Taylor', 'Martin', 'Thompson', 'Garcia', 'Martinez'],
    titles: ['President', 'Prime Minister']
}

/**
 * Generate a random leader name for a country
 */
export function generateLeaderName(countryCode: string): { name: string, title: string } {
    const pool = LEADER_NAMES[countryCode] || DEFAULT_NAMES

    const givenIndex = Math.floor(Math.random() * pool.given.length)
    const familyIndex = Math.floor(Math.random() * pool.family.length)
    const titleIndex = Math.floor(Math.random() * pool.titles.length)

    const name = `${pool.given[givenIndex]} ${pool.family[familyIndex]}`
    const title = pool.titles[titleIndex]

    return { name, title }
}

/**
 * Get appropriate title for a government type
 */
export function getTitleForGovType(govType: string): string {
    const lower = govType.toLowerCase()

    if (lower.includes('monarchy') || lower.includes('emirate')) {
        return Math.random() > 0.5 ? 'King' : 'Queen'
    }
    if (lower.includes('theocr')) {
        return 'Supreme Leader'
    }
    if (lower.includes('junta') || lower.includes('military')) {
        return 'General'
    }
    if (lower.includes('communist') || lower.includes('one-party')) {
        return 'General Secretary'
    }
    if (lower.includes('parliamentary')) {
        return 'Prime Minister'
    }

    return 'President'
}
