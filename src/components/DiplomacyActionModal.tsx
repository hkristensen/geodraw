import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import type { AgreementType, TariffStatus } from '../types/game'

interface DiplomacyActionModalProps {
    countryCode: string
    onClose: () => void
    onLaunchOffensive?: (code: string, name: string) => void
}

export function DiplomacyActionModal({ countryCode, onClose, onLaunchOffensive }: DiplomacyActionModalProps) {
    const { nation, addDiplomaticEvents, removeTerritory, playerTerritories } = useGameStore()
    const {
        getCountry,
        declareWar,
        proposeAgreement,
        setTariff,
        breakAgreement,
        updateRelations,
        ensureCountryInitialized,
        requestSupport
    } = useWorldStore()

    // Ensure country exists in store
    useEffect(() => {
        if (!getCountry(countryCode)) {
            ensureCountryInitialized(countryCode)
        }
    }, [countryCode, getCountry, ensureCountryInitialized])

    const country = getCountry(countryCode)
    const [activeTab, setActiveTab] = useState<'overview' | 'treaties' | 'economic' | 'hostile'>('overview')
    const [message, setMessage] = useState<string | null>(null)

    if (!country || !nation) return null

    const handleDeclareWar = () => {
        declareWar(countryCode)
        addDiplomaticEvents([{
            id: `war-${Date.now()}`,
            type: 'WAR_DECLARED',
            severity: 3,
            title: `⚔️ WAR DECLARED!`,
            description: `${nation.name} has declared war on ${country.name}.`,
            affectedNations: [countryCode],
            timestamp: Date.now(),
        }])
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
                            <span className={`text-sm px-2 py-1 rounded border ${country.disposition === 'friendly' ? 'bg-green-900/50 border-green-500 text-green-400' :
                                country.disposition === 'hostile' ? 'bg-red-900/50 border-red-500 text-red-400' :
                                    'bg-yellow-900/50 border-yellow-500 text-yellow-400'
                                }`}>
                                {country.disposition.toUpperCase()}
                            </span>
                        </h2>
                        <div className="text-gray-400 text-sm mt-1">
                            Relations: <span className={country.relations > 0 ? 'text-green-400' : 'text-red-400'}>{country.relations}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    {(['overview', 'treaties', 'economic', 'hostile'] as const).map(tab => (
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

                    {activeTab === 'treaties' && (
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
                                        <button
                                            onClick={() => onLaunchOffensive?.(countryCode, country.name)}
                                            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span>🚀</span> LAUNCH OFFENSIVE
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
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded">
                                        <h3 className="text-red-400 font-bold mb-2">⚠️ Declaration of War</h3>
                                        <p className="text-sm text-gray-400 mb-4">
                                            Declaring war will immediately mobilize your forces. All trade and agreements will be cancelled.
                                            Relations with their allies will suffer.
                                        </p>
                                        <button
                                            onClick={handleDeclareWar}
                                            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg transition-colors"
                                        >
                                            DECLARE WAR
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
        </div >
    )
}
