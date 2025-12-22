import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import type { AgreementType, TariffStatus, WarGoal } from '../types/game'
import { getGeopoliticalData, mapOrientationToNumber, mapGovType } from '../utils/geopoliticalData'
import { getCountryData, getReligionDistribution, type Religion } from '../utils/countryData'
import { WarGoalModal } from './WarGoalModal'

interface DiplomacyActionModalProps {
    countryCode: string
    onClose: () => void
    onLaunchOffensive?: (code: string, name: string) => void
}

export function DiplomacyActionModal({ countryCode, onClose, onLaunchOffensive }: DiplomacyActionModalProps) {
    const { nation, addDiplomaticEvents, removeTerritory, playerTerritories, selectedCountry, executeWarPlan } = useGameStore()
    const {
        getCountry,
        declareWar,
        proposeAgreement,
        setTariff,
        breakAgreement,
        updateRelations,
        ensureCountryInitialized,
        requestSupport,
        coalitions,
        inviteToCoalition,
        activeWars
    } = useWorldStore()

    // Ensure country exists in store
    useEffect(() => {
        if (!getCountry(countryCode)) {
            ensureCountryInitialized(countryCode)
        }
    }, [countryCode, getCountry, ensureCountryInitialized])

    const country = getCountry(countryCode)
    const geoData = getGeopoliticalData(countryCode)
    const [activeTab, setActiveTab] = useState<'overview' | 'data' | 'relations' | 'treaties' | 'economic' | 'hostile'>('overview')
    const [message, setMessage] = useState<string | null>(null)
    const [showWarGoalModal, setShowWarGoalModal] = useState(false)

    // Get ALL coalitions the player is in (not just the first one)
    const playerCoalitions = coalitions.filter(c => c.members.includes(selectedCountry || ''))
    // Get all coalitions the target country is in
    const targetCoalitions = coalitions.filter(c => c.members.includes(countryCode))

    if (!country || !nation) return null

    // Check if this is the player's own country
    const { gameSettings } = useGameStore.getState()
    const isOwnCountry = gameSettings?.startMode === 'EXISTING_COUNTRY'
        ? gameSettings?.startingCountry === countryCode
        : countryCode === 'PLAYER' // FREEFORM mode uses 'PLAYER' as code

    // Helper to get leader name from AICountry (can be string or Leader object)
    const getLeaderName = () => {
        const leader = country.politicalState?.leader
        if (!leader) return geoData?.leader || 'Unknown'
        return typeof leader === 'string' ? leader : leader.name
    }
    const leaderName = getLeaderName()
    const leaderPop = country.politicalState?.leader_pop ?? geoData?.leader_pop ?? 3

    const orientationValue = geoData ? mapOrientationToNumber(geoData.orientation) : 0
    const orientationPercent = ((orientationValue + 100) / 200) * 100

    const handleDeclareWar = (warGoal?: WarGoal) => {
        declareWar(countryCode)
        addDiplomaticEvents([{
            id: `war-${Date.now()}`,
            type: 'WAR_DECLARED',
            severity: 3,
            title: `⚔️ WAR DECLARED!`,
            description: `${nation.name} has declared war on ${country.name}.${warGoal ? ` War goal: ${warGoal.type}` : ''}`,
            affectedNations: [countryCode],
            timestamp: Date.now(),
        }])

        // Trigger Alliance Response (Article 5)
        useWorldStore.getState().triggerAllianceResponse(countryCode, 'PLAYER')

        setShowWarGoalModal(false)
        onClose()
    }

    const handleReturnTerritory = () => {
        setMessage('Calculating territory to return...')

        // Dynamic imports to avoid bundle bloat
        Promise.all([
            import('../data/countries.json'),
            import('@turf/turf')
        ]).then(([countriesDataModule, turf]) => {
            const countriesData = countriesDataModule.default as any
            const originalFeature = countriesData.features.find((f: any) => f.properties?.iso_a3 === countryCode)
            const playerPoly = playerTerritories[0]

            if (originalFeature && playerPoly) {
                try {
                    const intersection = turf.intersect(turf.featureCollection([playerPoly as any, originalFeature as any]))

                    if (intersection) {
                        removeTerritory(intersection as any)

                        // Update relations
                        updateRelations(countryCode, 50)

                        addDiplomaticEvents([{
                            id: `return-${Date.now()}`,
                            type: 'PEACE_TREATY',
                            severity: 1,
                            title: `Territory Returned to ${country.name}`,
                            description: `${nation.name} has returned occupied lands to ${country.name}. Relations have improved significantly.`,
                            affectedNations: [countryCode],
                            timestamp: Date.now(),
                        }])

                        setMessage(`✅ Returned territory to ${country.name}`)
                        setTimeout(() => onClose(), 1500)
                    } else {
                        setMessage('❌ No occupied territory to return.')
                        setTimeout(() => setMessage(null), 2000)
                    }
                } catch (error) {
                    console.error('Error returning territory:', error)
                    setMessage('❌ Error calculating territory.')
                }
            } else {
                setMessage('❌ Could not find territory data.')
            }
        })
    }

    const handlePropose = (type: AgreementType) => {
        const success = proposeAgreement(countryCode, type)
        if (success) {
            setMessage(`✅ ${country.name} accepted the ${type.replace('_', ' ')}!`)
            addDiplomaticEvents([{
                id: `agr-${Date.now()}`,
                type: 'ALLIANCE_PROPOSED', // Reusing type for now
                severity: 1,
                title: `Treaty Signed: ${type}`,
                description: `${country.name} accepted our proposal for ${type}.`,
                affectedNations: [countryCode],
                timestamp: Date.now(),
            }])
        } else {
            setMessage(`❌ ${country.name} rejected the proposal.`)
        }
        setTimeout(() => setMessage(null), 3000)
    }

    const handleTariff = (level: TariffStatus) => {
        setTariff(countryCode, level)
        setMessage(`Tariffs set to ${level}`)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/20 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 border-b border-white/10 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            {country.name}
                            {isOwnCountry ? (
                                <span className="text-sm px-2 py-1 rounded border bg-blue-900/50 border-blue-500 text-blue-400">
                                    YOUR NATION
                                </span>
                            ) : (
                                <span className={`text-sm px-2 py-1 rounded border ${country.disposition === 'friendly' ? 'bg-green-900/50 border-green-500 text-green-400' :
                                    country.disposition === 'hostile' ? 'bg-red-900/50 border-red-500 text-red-400' :
                                        'bg-yellow-900/50 border-yellow-500 text-yellow-400'
                                    }`}>
                                    {country.disposition.toUpperCase()}
                                </span>
                            )}
                        </h2>
                        {!isOwnCountry && (
                            <div className="text-gray-400 text-sm mt-1">
                                Relations: <span className={country.relations > 0 ? 'text-green-400' : 'text-red-400'}>{country.relations}</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>

                {/* Tabs - hide diplomacy tabs for own country */}
                <div className="flex border-b border-white/10">
                    {(isOwnCountry
                        ? (['overview', 'data', 'relations'] as const)
                        : (['overview', 'data', 'relations', 'treaties', 'economic', 'hostile'] as const)
                    ).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab
                                ? 'bg-white/10 text-white border-b-2 border-orange-500'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 min-h-[300px]">
                    {message && (
                        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded text-blue-200 text-center animate-pulse">
                            {message}
                        </div>
                    )}

                    {activeTab === 'relations' && <RelationsTab countryCode={countryCode} />}

                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2">Stats</h3>
                                <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-300">
                                    <span>Population:</span>
                                    <span className="text-right text-white">{(country.population / 1000000).toFixed(1)}M</span>

                                    <span>Economy:</span>
                                    <span className="text-right text-white">{country.economy}/100</span>

                                    <span>Military:</span>
                                    <span className="text-right text-white">{country.soldiers.toLocaleString()}</span>

                                    <span>Territory Lost:</span>
                                    <span className="text-right text-white">{country.territoryLost.toFixed(1)}%</span>

                                    <div className="col-span-2 border-t border-white/10 my-2"></div>

                                    <span>Language:</span>
                                    <span className="text-right text-white">{country.language}</span>

                                    <span>Culture:</span>
                                    <span className="text-right text-white">{country.culture}</span>

                                    <span>Religion:</span>
                                    <span className="text-right text-white">{country.religion}</span>
                                </div>

                                {/* Cultural Compatibility */}
                                <div className="mt-4 p-3 bg-white/5 rounded border border-white/10">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Cultural Compatibility</h4>
                                    <div className="space-y-1 text-sm">
                                        {country.language === nation.constitution.language && (
                                            <div className="flex justify-between text-green-400">
                                                <span>Shared Language</span>
                                                <span>+5</span>
                                            </div>
                                        )}
                                        {country.culture === nation.constitution.culture && (
                                            <div className="flex justify-between text-green-400">
                                                <span>Shared Culture</span>
                                                <span>+10</span>
                                            </div>
                                        )}
                                        {country.religion === nation.constitution.religion && (
                                            <div className="flex justify-between text-green-400">
                                                <span>Shared Religion</span>
                                                <span>+10</span>
                                            </div>
                                        )}
                                        {country.language !== nation.constitution.language &&
                                            country.culture !== nation.constitution.culture &&
                                            country.religion !== nation.constitution.religion && (
                                                <div className="flex justify-between text-red-400">
                                                    <span>Cultural Conflict</span>
                                                    <span>-20</span>
                                                </div>
                                            )}
                                    </div>
                                </div>

                                {/* Political Information */}
                                {geoData && (
                                    <div className="mt-4 p-3 bg-white/5 rounded border border-white/10">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Political System</h4>
                                        <div className="space-y-3 text-sm">
                                            {/* Leader */}
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">Leader</span>
                                                <span className="text-white font-medium">{leaderName}</span>
                                            </div>

                                            {/* Government Type */}
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">Government</span>
                                                <span className="text-white font-medium">
                                                    {mapGovType(geoData.gov_type).replace(/_/g, ' ')}
                                                </span>
                                            </div>

                                            {/* Political Alignment */}
                                            <div>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-gray-400">Alignment</span>
                                                    <span className="text-orange-400 font-medium">{geoData.orientation}</span>
                                                </div>
                                                <div className="h-2 bg-gradient-to-r from-red-600 via-green-500 to-red-600 rounded-full relative">
                                                    <div
                                                        className="absolute top-0 w-3 h-3 -mt-0.5 bg-white border-2 border-black rounded-full shadow-lg"
                                                        style={{ left: `${orientationPercent}%`, transform: 'translateX(-50%)' }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Stats */}
                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 text-xs">Freedom</span>
                                                    <span className="text-white text-xs font-semibold">{geoData.freedom}/5</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 text-xs">Unrest</span>
                                                    <span className={`text-xs font-semibold ${geoData.unrest >= 4 ? 'text-red-400' : 'text-white'}`}>
                                                        {geoData.unrest}/5
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 text-xs">Popularity</span>
                                                    <span className="text-white text-xs font-semibold">{leaderPop}/5</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 text-xs">Aggression</span>
                                                    <span className={`text-xs font-semibold ${geoData.aggression >= 4 ? 'text-red-400' : 'text-white'}`}>
                                                        {geoData.aggression}/5
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Allies/Enemies */}
                                            {(geoData.allies.length > 0 || geoData.enemies.length > 0) && (
                                                <div className="pt-2 border-t border-white/10">
                                                    {geoData.allies.length > 0 && (
                                                        <div className="mb-2">
                                                            <span className="text-green-400 text-xs font-semibold">Allies: </span>
                                                            <span className="text-gray-300 text-xs">{geoData.allies.join(', ')}</span>
                                                        </div>
                                                    )}
                                                    {geoData.enemies.length > 0 && (
                                                        <div>
                                                            <span className="text-red-400 text-xs font-semibold">Enemies: </span>
                                                            <span className="text-gray-300 text-xs">{geoData.enemies.join(', ')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2">Actions</h3>

                                {/* Return Territory Button (Placeholder) */}
                                {country.territoryLost > 0 && (
                                    <button
                                        onClick={() => {
                                            setMessage('Feature temporarily unavailable')
                                            setTimeout(() => setMessage(null), 2000)
                                        }}
                                        className="w-full py-2 bg-blue-900/50 hover:bg-blue-800 text-blue-200 border border-blue-500/30 rounded transition-colors opacity-50 cursor-not-allowed"
                                    >
                                        Return Territory
                                    </button>
                                )}

                                {/* Request Support Button */}
                                {(country.relations > 50 || country.modifiers.includes('ALLIED')) && (
                                    <button
                                        onClick={() => {
                                            const amount = requestSupport(countryCode)
                                            if (amount > 0) {
                                                useGameStore.getState().updateNationSoldiers(amount)
                                                setMessage(`✅ ${country.name} sent ${amount.toLocaleString()} soldiers!`)
                                                addDiplomaticEvents([{
                                                    id: `support-${Date.now()}`,
                                                    type: 'ALLIANCE_PROPOSED', // Reusing type
                                                    severity: 1,
                                                    title: 'Military Support',
                                                    description: `${country.name} has sent ${amount.toLocaleString()} soldiers to aid our cause.`,
                                                    affectedNations: [countryCode],
                                                    timestamp: Date.now(),
                                                }])
                                            } else {
                                                setMessage(`❌ ${country.name} refused to send support.`)
                                            }
                                            setTimeout(() => setMessage(null), 3000)
                                        }}
                                        className="w-full py-2 bg-green-900/50 hover:bg-green-800 text-green-200 border border-green-500/30 rounded transition-colors"
                                    >
                                        Request Military Support
                                    </button>
                                )}

                                {/* Return Land Button */}
                                {country.territoryLost > 0 && (
                                    <button
                                        onClick={handleReturnTerritory}
                                        className="w-full py-2 bg-blue-900/50 hover:bg-blue-800 text-blue-200 border border-blue-500/30 rounded transition-colors mt-2"
                                    >
                                        🏳️ Return Occupied Land
                                    </button>
                                )}

                                <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">Active Agreements</h3>
                                {country.agreements.length === 0 ? (
                                    <p className="text-gray-500 italic">No active agreements.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {country.agreements.map(a => (
                                            <li key={a.id} className="flex justify-between items-center bg-white/5 p-2 rounded">
                                                <span className="text-green-400 text-sm">{a.type.replace('_', ' ')}</span>
                                                <button
                                                    onClick={() => breakAgreement(countryCode, a.id)}
                                                    className="text-xs text-red-400 hover:text-red-300 underline"
                                                >
                                                    Break
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'data' && <DataTab countryCode={countryCode} country={country} geoData={geoData} />}

                    {activeTab === 'treaties' && (
                        <div className="space-y-6">
                            {/* Coalition Actions */}
                            {(playerCoalitions.length > 0 || targetCoalitions.length > 0) && (
                                <div>
                                    <h4 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Coalition Actions</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {/* Show invite buttons for ALL coalitions player is in where target is NOT a member */}
                                        {playerCoalitions.map(coalition => {
                                            const targetIsInThisCoalition = coalition.members.includes(countryCode)

                                            if (targetIsInThisCoalition) {
                                                // Show "already members" status
                                                return (
                                                    <div key={coalition.id} className="p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-lg text-emerald-200 text-sm flex items-center gap-2">
                                                        <span>{coalition.icon}</span>
                                                        <span>Both in <strong>{coalition.name}</strong></span>
                                                    </div>
                                                )
                                            }

                                            // Show invite button
                                            return (
                                                <button
                                                    key={coalition.id}
                                                    onClick={() => {
                                                        inviteToCoalition(coalition.id, countryCode)
                                                        setMessage(`Invited ${country.name} to ${coalition.name}`)
                                                        setTimeout(() => setMessage(null), 2000)
                                                    }}
                                                    className="p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-lg text-blue-200 text-sm font-medium transition-colors text-left flex items-center gap-3"
                                                >
                                                    <span className="text-2xl">{coalition.icon}</span>
                                                    <div>
                                                        <div className="font-bold">Invite to {coalition.name}</div>
                                                        <div className="text-xs opacity-70">{coalition.type} coalition • {coalition.members.length} members</div>
                                                    </div>
                                                </button>
                                            )
                                        })}

                                        {/* Show coalitions target is in that player is NOT in */}
                                        {targetCoalitions.filter(c => !playerCoalitions.some(pc => pc.id === c.id)).map(coalition => (
                                            <button
                                                key={coalition.id}
                                                className="p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 text-sm font-medium text-left flex items-center gap-3 opacity-70 cursor-not-allowed"
                                                title="Request to join logic coming soon"
                                            >
                                                <span className="text-2xl">{coalition.icon}</span>
                                                <div>
                                                    <div className="font-bold">Request to Join</div>
                                                    <div className="text-xs opacity-70">Ask to join {coalition.name}</div>
                                                </div>
                                            </button>
                                        ))}

                                        {/* If no coalitions at all */}
                                        {playerCoalitions.length === 0 && targetCoalitions.length === 0 && (
                                            <div className="col-span-2 p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 text-sm text-center">
                                                Neither you nor {country.name} are in any coalitions.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => handlePropose('NON_AGGRESSION')}
                                    disabled={country.relations < 0}
                                    className="p-4 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="font-bold text-white mb-1">🛡️ Non-Aggression Pact</div>
                                    <div className="text-xs text-gray-400">Requires Neutral relations. Prevents war for 5 years.</div>
                                </button>

                                <button
                                    onClick={() => handlePropose('TRADE_AGREEMENT')}
                                    disabled={country.relations < -10}
                                    className="p-4 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="font-bold text-white mb-1">💰 Trade Agreement</div>
                                    <div className="text-xs text-gray-400">Boosts trade income by 20%. Requires relations &gt; -10.</div>
                                </button>

                                <button
                                    onClick={() => handlePropose('MILITARY_ALLIANCE')}
                                    disabled={country.relations < 70}
                                    className="p-4 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="font-bold text-white mb-1">⚔️ Military Alliance</div>
                                    <div className="text-xs text-gray-400">Call to arms in war. Requires Friendly relations (70+).</div>
                                </button>

                                <button
                                    onClick={() => handlePropose('SECURITY_GUARANTEE')}
                                    className="p-4 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-left"
                                >
                                    <div className="font-bold text-white mb-1">🦅 Security Guarantee</div>
                                    <div className="text-xs text-gray-400">Protect them in war. Improves relations over time. Costs upkeep.</div>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'economic' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4">Tariff Policy</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['FREE_TRADE', 'LOW', 'HIGH', 'EMBARGO'] as const).map(level => (
                                        <button
                                            key={level}
                                            onClick={() => handleTariff(level)}
                                            className={`p-3 rounded border text-sm font-bold transition-all ${country.tariff === level
                                                ? 'bg-orange-600 border-orange-400 text-white shadow-lg scale-105'
                                                : 'bg-slate-800 border-white/10 text-gray-400 hover:bg-slate-700'
                                                }`}
                                        >
                                            {level.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-black/20 p-4 rounded text-sm text-gray-300">
                                <p className="mb-2"><strong className="text-white">Current Impact:</strong></p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Trade Income: <span className={country.tariff === 'FREE_TRADE' ? 'text-green-400' : 'text-yellow-400'}>
                                        {country.tariff === 'FREE_TRADE' ? '+50%' : country.tariff === 'LOW' ? 'Normal' : country.tariff === 'HIGH' ? '-20%' : '-100%'}
                                    </span></li>
                                    <li>Tax Revenue: <span className={country.tariff === 'HIGH' ? 'text-green-400' : 'text-gray-400'}>
                                        {country.tariff === 'HIGH' ? '+High' : country.tariff === 'LOW' ? '+Low' : 'None'}
                                    </span></li>
                                    <li>Relations: <span className={country.tariff === 'FREE_TRADE' ? 'text-green-400' : country.tariff === 'EMBARGO' ? 'text-red-400' : 'text-gray-400'}>
                                        {country.tariff === 'FREE_TRADE' ? 'Improving' : country.tariff === 'EMBARGO' ? 'Collapsing' : 'Stable'}
                                    </span></li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {activeTab === 'hostile' && (
                        <div className="space-y-4">
                            {country.isAtWar ? (
                                <div className="space-y-3">
                                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded">
                                        <h3 className="text-red-400 font-bold mb-2">⚔️ Active War</h3>
                                        <p className="text-sm text-gray-400 mb-4">
                                            You are currently at war with {country.name}. Launch an offensive to seize territory.
                                        </p>

                                        {/* War Plans Section */}
                                        <div className="mb-4 space-y-2">
                                            <h4 className="text-sm font-bold text-gray-400 uppercase">War Plans</h4>
                                            {nation.warPlans?.filter(p => p.targetCountry === countryCode).length === 0 ? (
                                                <p className="text-xs text-gray-500 italic">No saved plans.</p>
                                            ) : (
                                                nation.warPlans?.filter(p => p.targetCountry === countryCode).map(plan => (
                                                    <div key={plan.id} className="bg-slate-800 p-2 rounded border border-white/5 flex justify-between items-center">
                                                        <div>
                                                            <div className="font-bold text-sm text-white">{plan.name}</div>
                                                            <div className="text-xs text-gray-400">{plan.assignedUnitIds.length} Brigades</div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    executeWarPlan(plan.id)
                                                                    onClose()
                                                                }}
                                                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                                                            >
                                                                EXECUTE
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <button
                                            onClick={() => onLaunchOffensive?.(countryCode, country.name)}
                                            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span>🚀</span> NEW OFFENSIVE
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => {
                                            // Offer Peace Logic
                                            // Chance depends on war duration and war score (not tracked yet)
                                            // For now, base it on relations (which are bad) and random chance
                                            // If they are losing (revanchism), they might refuse unless we return land
                                            const chance = 0.3
                                            if (Math.random() < chance) {
                                                useWorldStore.getState().makePeace(countryCode)
                                                setMessage('✅ Peace Offer Accepted! The war is over.')
                                                addDiplomaticEvents([{
                                                    id: `peace-${Date.now()}`,
                                                    type: 'PEACE_TREATY',
                                                    severity: 1,
                                                    title: 'PEACE TREATY SIGNED',
                                                    description: `We have signed a peace treaty with ${country.name}.`,
                                                    affectedNations: [countryCode],
                                                    timestamp: Date.now()
                                                }])
                                            } else {
                                                setMessage('❌ Peace Offer Rejected! They want to fight on.')
                                            }
                                            setTimeout(() => setMessage(null), 3000)
                                        }}
                                        className="w-full py-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 font-bold rounded transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span>🕊️</span> OFFER PEACE
                                    </button>

                                    {/* Surrender to Coalition Option */}
                                    {targetCoalitions.length > 0 && targetCoalitions.some(c =>
                                        c.members.some(m => activeWars.includes(m))
                                    ) && (
                                            <button
                                                onClick={() => {
                                                    const coalition = targetCoalitions.find(c => c.members.some(m => activeWars.includes(m)))
                                                    if (coalition) {
                                                        useWorldStore.getState().surrenderToCoalition(coalition.id, 'PLAYER')
                                                        setMessage(`🏳️ Surrendered to ${coalition.name}. War ended.`)
                                                        setTimeout(() => onClose(), 2000)
                                                    }
                                                }}
                                                className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-gray-300 font-bold rounded transition-colors flex items-center justify-center gap-2 text-xs"
                                            >
                                                <span>🏳️</span> SURRENDER TO {targetCoalitions.find(c => c.members.some(m => activeWars.includes(m)))?.name}
                                            </button>
                                        )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded">
                                        <h3 className="text-red-400 font-bold mb-2">⚠️ Declaration of War</h3>
                                        <p className="text-sm text-gray-400 mb-4">
                                            Declaring war will immediately mobilize your forces. All trade and agreements will be cancelled.
                                            Relations with their allies will suffer.
                                        </p>

                                        {/* Pre-War Plans Section */}
                                        <div className="mb-4 space-y-2">
                                            <h4 className="text-sm font-bold text-gray-400 uppercase">War Plans</h4>
                                            {nation.warPlans?.filter(p => p.targetCountry === countryCode).length === 0 ? (
                                                <p className="text-xs text-gray-500 italic">No saved plans.</p>
                                            ) : (
                                                nation.warPlans?.filter(p => p.targetCountry === countryCode).map(plan => (
                                                    <div key={plan.id} className="bg-slate-800 p-2 rounded border border-white/5 flex justify-between items-center">
                                                        <div>
                                                            <div className="font-bold text-sm text-white">{plan.name}</div>
                                                            <div className="text-xs text-gray-400">{plan.assignedUnitIds.length} Brigades</div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    // Should probably warn about declaring war first?
                                                                    // But let's allow it -> it implicitly declares war?
                                                                    // Store executeWarPlan calls startBattle.
                                                                    // startBattle logic might need to ensure war is declared or it just starts it.
                                                                    // Usually startBattle initializes ActiveBattle.
                                                                    // Let's assume it starts war.
                                                                    executeWarPlan(plan.id)
                                                                    onClose()
                                                                }}
                                                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                                                            >
                                                                EXECUTE
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                            <button
                                                onClick={() => onLaunchOffensive?.(countryCode, country.name)}
                                                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded border border-slate-500"
                                            >
                                                + DRAFT WAR PLAN
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setShowWarGoalModal(true)}
                                            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg transition-colors"
                                        >
                                            ⚔️ DECLARE WAR
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => {
                                            const cost = 10_000_000
                                            if (nation.stats.budget >= cost) {
                                                useGameStore.getState().updateBudget(-cost)
                                                updateRelations(countryCode, 15)
                                                setMessage('✅ Delegation sent! Relations improved (+15).')
                                            } else {
                                                setMessage('❌ Not enough funds ($10M required)')
                                            }
                                            setTimeout(() => setMessage(null), 3000)
                                        }}
                                        className="w-full py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 font-bold rounded transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span>🤝</span> Improve Relations ($10M)
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    // Demand Territory Logic
                                    // If we have a claim, we demand that specific claim
                                    // If not, we just make a generic demand
                                    const claim = country.claimedPercentage || 0

                                    if (claim > 0) {
                                        // Attempt to press claim
                                        const success = Math.random() > 0.6 // Hard to get without war
                                        if (success) {
                                            // They cede the territory!
                                            useWorldStore.getState().updateOccupation(countryCode, claim)
                                            useWorldStore.getState().addClaim(countryCode, -claim) // Remove claim
                                            setMessage(`✅ Demand Accepted! They ceded ${claim.toFixed(1)}% territory.`)
                                            updateRelations(countryCode, -20)
                                        } else {
                                            setMessage('❌ Demand Rejected! They refuse to cede land.')
                                            updateRelations(countryCode, -30)
                                        }
                                    } else {
                                        updateRelations(countryCode, -20)
                                        setMessage('Demand sent! Relations worsened.')
                                    }
                                    setTimeout(() => setMessage(null), 3000)
                                }}
                                className="w-full py-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 text-yellow-400 font-bold rounded transition-colors"
                            >
                                📜 Demand Territory {country.claimedPercentage && country.claimedPercentage > 0 ? `(${country.claimedPercentage.toFixed(0)}% Claimed)` : ''}
                            </button>

                            <button
                                onClick={() => {
                                    const cost = 50_000_000
                                    if (nation.stats.budget >= cost) {
                                        useGameStore.getState().updateBudget(-cost)
                                        const success = useWorldStore.getState().fundSeparatists(countryCode)
                                        if (success) {
                                            setMessage('🕵️ Separatists funded! Enemy forces weakened.')
                                            addDiplomaticEvents([{
                                                id: `sep-${Date.now()}`,
                                                type: 'BORDER_TENSION',
                                                severity: 2,
                                                title: 'Separatist Uprising',
                                                description: `We have funded rebels in ${country.name}. Their military is in disarray.`,
                                                affectedNations: [countryCode],
                                                timestamp: Date.now()
                                            }])
                                        } else {
                                            setMessage('❌ Funding failed. Separatists already active or conditions not met.')
                                        }
                                    } else {
                                        setMessage('❌ Not enough funds ($50M required)')
                                    }
                                    setTimeout(() => setMessage(null), 3000)
                                }}
                                className="w-full py-3 bg-purple-900/40 hover:bg-purple-800/40 border border-purple-500/30 text-purple-300 font-bold rounded transition-colors flex items-center justify-center gap-2"
                            >
                                <span>🕵️</span> Fund Separatists ($50M)
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* War Goal Modal */}
            {showWarGoalModal && (
                <WarGoalModal
                    countryCode={countryCode}
                    countryName={country.name}
                    onClose={() => setShowWarGoalModal(false)}
                    onConfirm={(warGoal) => handleDeclareWar(warGoal)}
                />
            )}
        </div >
    )
}

// Comprehensive Data Tab Component
interface DataTabProps {
    countryCode: string
    country: ReturnType<typeof useWorldStore.getState>['aiCountries'] extends Map<string, infer T> ? T : never
    geoData: ReturnType<typeof getGeopoliticalData>
}

function DataTab({ countryCode, country, geoData }: DataTabProps) {
    const { coalitions } = useWorldStore()
    const realData = getCountryData(countryCode)
    const religionDist = getReligionDistribution(countryCode)
    const countryCoalition = coalitions.find(c => c.members.includes(countryCode))

    // For PLAYER (drawn territory), use weighted data stored on the country object
    const weightedData = (country as any).weightedTerritoryData

    // Use weighted data as fallback for economic indices
    const economicData = realData || (weightedData ? {
        gniPerCapita: weightedData.gniPerCapita,
        economicFreedomIndex: weightedData.economicFreedomIndex,
        prosperityIndex: weightedData.prosperityIndex,
        corruptionIndex: weightedData.corruptionIndex,
        freedomScore: weightedData.freedomScore,
        liberalDemocracyIndex: weightedData.liberalDemocracyIndex
    } : null)

    // Get live leader name from AICountry (can be string or Leader object)
    const leaderName = (() => {
        const leader = country.politicalState?.leader
        if (!leader) return geoData?.leader || 'Unknown'
        return typeof leader === 'string' ? leader : leader.name
    })()
    const leaderPop = country.politicalState?.leader_pop ?? geoData?.leader_pop ?? 3

    // Helper to render a stat row
    const StatRow = ({ label, value, color }: { label: string, value: string | number, color?: string }) => (
        <div className="flex justify-between py-1">
            <span className="text-gray-400">{label}</span>
            <span className={`font-medium ${color || 'text-white'}`}>{value}</span>
        </div>
    )

    // Helper to render a rating (1-5 scale)
    const RatingBar = ({ label, value, max = 5, inverted = false }: { label: string, value: number, max?: number, inverted?: boolean }) => {
        const percent = (value / max) * 100
        const barColor = inverted
            ? (value >= 4 ? 'bg-red-500' : value >= 3 ? 'bg-yellow-500' : 'bg-green-500')
            : (value >= 4 ? 'bg-green-500' : value >= 3 ? 'bg-yellow-500' : 'bg-red-500')

        return (
            <div className="py-1">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-medium">{value}/{max}</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} transition-all`} style={{ width: `${percent}%` }} />
                </div>
            </div>
        )
    }

    // Helper for religion emoji
    const getReligionEmoji = (religion: Religion): string => {
        const emojis: Record<Religion, string> = {
            'Christian': '✝️',
            'Muslim': '☪️',
            'Hindu': '🕉️',
            'Buddhist': '☸️',
            'Jewish': '✡️',
            'Folk': '🌿',
            'Other': '🔮',
            'Unaffiliated': '⚛️'
        }
        return emojis[religion] || '❓'
    }



    return (
        <div className="space-y-6 overflow-y-auto max-h-[500px] pr-2">
            <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            💰 Economic Indices
                        </h4>
                        <div className="text-sm space-y-1">
                            <StatRow label="GNI per Capita" value={economicData ? `$${economicData.gniPerCapita.toLocaleString()}` : 'N/A'} />
                            <StatRow label="Economic Freedom" value={economicData ? `${economicData.economicFreedomIndex.toFixed(1)}` : 'N/A'} />
                            <StatRow label="Prosperity Index" value={economicData ? `${economicData.prosperityIndex.toFixed(1)}` : 'N/A'} />
                            <StatRow label="Corruption Index" value={economicData ? `${economicData.corruptionIndex.toFixed(0)}` : 'N/A'} />
                        </div>
                    </div>

                    {/* Governance Indices */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            🏛️ Governance
                        </h4>
                        <div className="text-sm space-y-1">
                            <StatRow label="Freedom Score" value={economicData ? `${economicData.freedomScore.toFixed(0)}/100` : 'N/A'} />
                            <StatRow label="Liberal Democracy" value={economicData ? `${(economicData.liberalDemocracyIndex * 100).toFixed(0)}%` : 'N/A'} />
                            <StatRow label="Authority" value={`${country.authority}/100`} />
                        </div>
                    </div>

                    {/* Demographics */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                        <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            👥 Demographics
                        </h4>
                        <div className="text-sm space-y-1">
                            <StatRow
                                label="Population"
                                value={`${(country.population / 1_000_000).toFixed(1)}M`}
                            />
                            <StatRow label="Language" value={country.language} />
                            <StatRow label="Culture" value={country.culture} />
                            <StatRow label="Primary Religion" value={country.religion} />
                        </div>
                    </div>

                    {/* Religion Distribution */}
                    {
                        religionDist.length > 0 && (
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                                <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    🙏 Religion Distribution
                                </h4>
                                <div className="space-y-2">
                                    {religionDist.slice(0, 5).map(({ religion, percent }) => (
                                        <div key={religion} className="text-sm">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-gray-300">{getReligionEmoji(religion)} {religion}</span>
                                                <span className="text-white font-medium">{percent.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    {/* Political Data */}
                    {geoData && (
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                            <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                🗳️ Political Data
                            </h4>
                            <div className="text-sm space-y-1 mb-3">
                                <StatRow label="Leader" value={leaderName} />
                                <StatRow label="Government" value={mapGovType(geoData.gov_type).replace(/_/g, ' ')} />
                                <StatRow label="Orientation" value={geoData.orientation} color="text-orange-300" />
                            </div>

                            {/* Political spectrum visualization */}
                            <div className="mb-3">
                                <div className="h-2 bg-gradient-to-r from-red-600 via-green-500 to-red-600 rounded-full relative">
                                    <div
                                        className="absolute top-0 w-3 h-3 -mt-0.5 bg-white border-2 border-black rounded-full shadow-lg"
                                        style={{ left: `${((mapOrientationToNumber(geoData.orientation) + 100) / 200) * 100}%`, transform: 'translateX(-50%)' }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                                    <span>Far Left</span>
                                    <span>Center</span>
                                    <span>Far Right</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <RatingBar label="Freedom" value={geoData.freedom} />
                                <RatingBar label="Unrest" value={geoData.unrest} inverted />
                                <RatingBar label="Leader Popularity" value={leaderPop} />
                                <RatingBar label="Military Strength" value={geoData.military} />
                                <RatingBar label="Aggression" value={geoData.aggression} inverted />
                            </div>

                            {/* Policies */}
                            {geoData.policies && geoData.policies.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-white/10">
                                    <div className="text-xs text-gray-400 mb-2">Active Policies:</div>
                                    <div className="flex flex-wrap gap-1">
                                        {geoData.policies.map((policy, i) => (
                                            <span key={i} className="text-xs px-2 py-0.5 bg-slate-700 rounded text-gray-300">
                                                {policy}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Diplomatic Relations */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                        <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            🤝 Diplomatic Relations
                        </h4>
                        <div className="space-y-3 text-sm">
                            {country.allies.length > 0 && (
                                <div>
                                    <span className="text-green-400 text-xs font-semibold">Allies:</span>
                                    <div className="text-gray-300 text-xs mt-1">{country.allies.join(', ')}</div>
                                </div>
                            )}
                            {country.enemies.length > 0 && (
                                <div>
                                    <span className="text-red-400 text-xs font-semibold">Enemies:</span>
                                    <div className="text-gray-300 text-xs mt-1">{country.enemies.join(', ')}</div>
                                </div>
                            )}
                            {country.tradePartners.length > 0 && (
                                <div>
                                    <span className="text-yellow-400 text-xs font-semibold">Trade Partners:</span>
                                    <div className="text-gray-300 text-xs mt-1">{country.tradePartners.join(', ')}</div>
                                </div>
                            )}
                            {countryCoalition && (
                                <div>
                                    <span className="text-purple-400 text-xs font-semibold">Coalition:</span>
                                    <div className="text-gray-300 text-xs mt-1 flex items-center gap-2">
                                        <span>{countryCoalition.icon}</span>
                                        <span>{countryCoalition.name}</span>
                                        <span className="text-gray-500">({countryCoalition.members.length} members)</span>
                                    </div>
                                </div>
                            )}
                            {country.allies.length === 0 && country.enemies.length === 0 && !countryCoalition && (
                                <p className="text-gray-500 italic">No significant diplomatic relations.</p>
                            )}
                        </div>
                    </div>

                    {/* Game State */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            🎮 Game State
                        </h4>
                        <div className="text-sm space-y-1">
                            <div className="flex justify-between py-1">
                                <span className="text-gray-400">Disposition</span>
                                <span className={`font-medium px-2 py-0.5 rounded text-xs ${country.disposition === 'friendly' ? 'bg-green-900/50 text-green-400' :
                                    country.disposition === 'hostile' ? 'bg-red-900/50 text-red-400' :
                                        country.disposition === 'at_war' ? 'bg-red-900/80 text-red-300' :
                                            'bg-yellow-900/50 text-yellow-400'
                                    }`}>
                                    {country.disposition.toUpperCase()}
                                </span>
                            </div>
                            <StatRow
                                label="Relations"
                                value={country.relations}
                                color={country.relations > 0 ? 'text-green-400' : country.relations < 0 ? 'text-red-400' : 'text-gray-400'}
                            />
                            <StatRow label="Soldiers" value={country.soldiers.toLocaleString()} />
                            <StatRow label="Economy" value={`${country.economy}/100`} />
                            <StatRow label="Power" value={country.power.toLocaleString()} />
                            <StatRow
                                label="Territory Lost"
                                value={`${country.territoryLost.toFixed(1)}%`}
                                color={country.territoryLost > 0 ? 'text-red-400' : 'text-white'}
                            />
                            {country.claimedPercentage > 0 && (
                                <StatRow
                                    label="Claimed by You"
                                    value={`${country.claimedPercentage.toFixed(1)}%`}
                                    color="text-orange-400"
                                />
                            )}
                        </div>

                        {/* Modifiers */}
                        {country.modifiers.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/10">
                                <div className="text-xs text-gray-400 mb-2">Active Modifiers:</div>
                                <div className="flex flex-wrap gap-1">
                                    {country.modifiers.map((mod, i) => (
                                        <span
                                            key={i}
                                            className={`text-xs px-2 py-0.5 rounded ${mod === 'AT_WAR' ? 'bg-red-900/50 text-red-400 border border-red-500/30' :
                                                mod === 'ALLIED' ? 'bg-green-900/50 text-green-400 border border-green-500/30' :
                                                    mod === 'REVANCHISM' ? 'bg-orange-900/50 text-orange-400 border border-orange-500/30' :
                                                        'bg-slate-700 text-gray-300'
                                                }`}
                                        >
                                            {mod.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Agreements */}
                        {country.agreements.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/10">
                                <div className="text-xs text-gray-400 mb-2">Active Agreements:</div>
                                <div className="flex flex-wrap gap-1">
                                    {country.agreements.map((agr) => (
                                        <span
                                            key={agr.id}
                                            className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-400 border border-blue-500/30 rounded"
                                        >
                                            {agr.type.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tariffs */}
                        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span className="text-gray-500">Your Tariff:</span>
                                <span className={`ml-2 ${country.tariff === 'EMBARGO' ? 'text-red-400' :
                                    country.tariff === 'FREE_TRADE' ? 'text-green-400' :
                                        'text-white'
                                    }`}>
                                    {country.tariff.replace('_', ' ')}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500">Their Tariff:</span>
                                <span className={`ml-2 ${country.theirTariff === 'EMBARGO' ? 'text-red-400' :
                                    country.theirTariff === 'FREE_TRADE' ? 'text-green-400' :
                                        'text-white'
                                    }`}>
                                    {country.theirTariff.replace('_', ' ')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Relations Tab Component
function RelationsTab({ countryCode }: { countryCode: string }) {
    const { aiCountries, aiWars, coalitions } = useWorldStore()
    const country = aiCountries.get(countryCode)

    if (!country) return null

    // 1. Calculate Relations Ranking
    const relationsList = Array.from(aiCountries.values())
        .filter(c => c.code !== countryCode && !c.isAnnexed)
        .map(c => {
            // Calculate relation score
            let score = 0
            if (country.allies.includes(c.code)) score += 50
            if (country.enemies.includes(c.code)) score -= 50
            if (c.allies.includes(countryCode)) score += 50
            if (c.enemies.includes(countryCode)) score -= 50

            // Shared Government
            if (c.politicalState?.govType && country.politicalState?.govType && c.politicalState.govType === country.politicalState.govType) score += 10

            // Random flux (stable per session)
            const pseudoRandom = (c.code.charCodeAt(0) + countryCode.charCodeAt(0)) % 20
            score += pseudoRandom

            return { code: c.code, name: c.name, score }
        })
        .sort((a, b) => b.score - a.score)

    const top5 = relationsList.slice(0, 5)
    const bottom5 = relationsList.slice(Math.max(0, relationsList.length - 5)).reverse()

    // 2. Active Wars
    const activeWars = aiWars.filter(w =>
        (w.attackerCode === countryCode || w.defenderCode === countryCode) && w.status === 'active'
    )

    // 3. Coalitions
    const memberCoalitions = coalitions.filter(c => c.members.includes(countryCode))

    // 4. Alliances (Explicit)
    const validAllies = country.allies
        .map(code => aiCountries.get(code))
        .filter(c => c !== undefined && !c.isAnnexed) as any[]

    return (
        <div className="space-y-6">
            {/* Active Wars Section */}
            <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <span>⚔️</span> Active Wars
                </h3>
                {activeWars.length === 0 ? (
                    <p className="text-gray-500 italic text-sm">No active conflicts.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {activeWars.map(war => {
                            const isAttacker = war.attackerCode === countryCode
                            const opponentCode = isAttacker ? war.defenderCode : war.attackerCode
                            const opponent = aiCountries.get(opponentCode)
                            const myGain = isAttacker ? war.attackerGain : war.defenderGain
                            const theirGain = isAttacker ? war.defenderGain : war.attackerGain

                            return (
                                <div key={war.id} className="bg-red-900/20 border border-red-500/30 p-3 rounded flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${isAttacker ? 'bg-red-500' : 'bg-blue-500'}`} />
                                        <div>
                                            <div className="font-bold text-white text-sm">
                                                {isAttacker ? 'Attacking' : 'Defending against'} {opponent?.name || opponentCode}
                                            </div>
                                            <div className="text-xs text-red-300">
                                                {(myGain || 0) > (theirGain || 0) + 5 ? 'Winning' : (theirGain || 0) > (myGain || 0) + 5 ? 'Losing' : 'Stalemate'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono text-gray-400">
                                        {(myGain || 0).toFixed(0)}% Occupied
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Relations Lists */}
                <div className="space-y-4">
                    <div>
                        <h4 className="text-sm font-bold text-green-400 mb-2 uppercase tracking-wide">Best Relations</h4>
                        {top5.length > 0 ? (
                            <ul className="space-y-1">
                                {top5.map(r => (
                                    <li key={r.code} className="flex justify-between text-sm bg-white/5 p-2 rounded">
                                        <span className="text-gray-300">{r.name}</span>
                                        <span className="text-green-400 font-mono">+{r.score}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-gray-500 italic text-xs">None</p>}
                    </div>

                    <div>
                        <h4 className="text-sm font-bold text-red-400 mb-2 uppercase tracking-wide">Worst Relations</h4>
                        {bottom5.length > 0 ? (
                            <ul className="space-y-1">
                                {bottom5.map(r => (
                                    <li key={r.code} className="flex justify-between text-sm bg-white/5 p-2 rounded">
                                        <span className="text-gray-300">{r.name}</span>
                                        <span className="text-red-400 font-mono">{r.score}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-gray-500 italic text-xs">None</p>}
                    </div>
                </div>

                {/* Alliances & Coalitions */}
                <div className="space-y-4">
                    <div>
                        <h4 className="text-sm font-bold text-blue-400 mb-2 uppercase tracking-wide">Coalitions</h4>
                        {memberCoalitions.length > 0 ? (
                            <ul className="space-y-2">
                                {memberCoalitions.map(c => (
                                    <li key={c.id} className="bg-blue-900/20 border border-blue-500/30 p-2 rounded text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{c.icon}</span>
                                            <div>
                                                <div className="font-bold text-blue-200">{c.name}</div>
                                                <div className="text-[10px] text-blue-400/70 uppercase">{c.type}</div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-gray-500 italic text-xs">Not in any coalition.</p>}
                    </div>

                    <div>
                        <h4 className="text-sm font-bold text-purple-400 mb-2 uppercase tracking-wide">Allies</h4>
                        {validAllies.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {validAllies.map(ally => (
                                    <span key={ally?.code} className="px-2 py-1 bg-purple-900/20 border border-purple-500/30 rounded text-purple-200 text-xs">
                                        {ally?.name}
                                    </span>
                                ))}
                            </div>
                        ) : <p className="text-gray-500 italic text-xs">No formal allies.</p>}
                    </div>
                </div>
            </div>
        </div>
    )
}
