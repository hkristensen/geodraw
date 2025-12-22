import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import type { WarGoalType, WarGoal } from '../types/game'
import { WAR_GOAL_LEGITIMACY } from '../types/game'
import { createWarGoal, getWarGoalReaction } from '../utils/aiStrategy'

interface WarGoalModalProps {
    countryCode: string
    countryName: string
    onClose: () => void
    onConfirm: (warGoal: WarGoal) => void
}

const WAR_GOAL_INFO: Record<WarGoalType, {
    icon: string
    title: string
    description: string
    available: (hasTerritory: boolean, wasAttacked: boolean, lostTerritory: boolean) => boolean
}> = {
    'DEFENSIVE': {
        icon: '🛡️',
        title: 'Defensive War',
        description: 'Respond to enemy aggression. Maximum international support.',
        available: (_, wasAttacked) => wasAttacked
    },
    'RECONQUEST': {
        icon: '🔄',
        title: 'Reconquest',
        description: 'Retake territory lost in previous wars.',
        available: (_, __, lostTerritory) => lostTerritory
    },
    'TERRITORIAL': {
        icon: '🗺️',
        title: 'Territorial Claim',
        description: 'Pursue active claims on enemy territory.',
        available: (hasTerritory) => hasTerritory
    },
    'LIBERATION': {
        icon: '🕊️',
        title: 'Liberation',
        description: 'Free territories under enemy occupation.',
        available: () => true // Always available as a stated goal
    },
    'REGIME_CHANGE': {
        icon: '👑',
        title: 'Regime Change',
        description: 'Overthrow their government. Significant international backlash.',
        available: () => true
    },
    'HUMILIATION': {
        icon: '💢',
        title: 'Humiliation',
        description: 'Force them to accept humiliating terms. Damages their prestige.',
        available: () => true
    },
    'AGGRESSION': {
        icon: '⚔️',
        title: 'War of Aggression',
        description: 'Unprovoked war. Severe international condemnation.',
        available: () => true
    }
}

export function WarGoalModal({ countryCode, countryName, onClose, onConfirm }: WarGoalModalProps) {
    const { nation } = useGameStore()
    const { getCountry } = useWorldStore()

    const country = getCountry(countryCode)
    const [selectedGoal, setSelectedGoal] = useState<WarGoalType | null>(null)

    if (!country || !nation) return null

    // Determine what war goals are available
    const hasTerritoryClaim = (country.claimedPercentage || 0) > 0
    const wasAttacked = Boolean(country.isAtWar && country.warDeclaredAt
        && Date.now() - country.warDeclaredAt < 30 * 24 * 60 * 60 * 1000) // Within 30 days
    const lostTerritory = country.territoryLost > 0

    // Get the preview war goal for display
    const previewGoal = selectedGoal ? createWarGoal(selectedGoal, countryCode) : null
    const reaction = previewGoal ? getWarGoalReaction(previewGoal) : null

    const handleConfirm = () => {
        if (selectedGoal) {
            const warGoal = createWarGoal(selectedGoal, countryCode)
            onConfirm(warGoal)
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-red-500/30 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-900 to-slate-900 p-5 border-b border-red-500/30">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        ⚔️ Declaration of War
                    </h2>
                    <p className="text-red-200 text-sm mt-1">
                        Select your war goals against <strong>{countryName}</strong>
                    </p>
                </div>

                {/* War Goals Selection */}
                <div className="p-5 space-y-3 max-h-[400px] overflow-y-auto">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Choose War Goal
                    </h3>

                    {(Object.entries(WAR_GOAL_INFO) as [WarGoalType, typeof WAR_GOAL_INFO[WarGoalType]][]).map(([type, info]) => {
                        const isAvailable = info.available(hasTerritoryClaim, wasAttacked, lostTerritory)
                        const legitimacy = WAR_GOAL_LEGITIMACY[type]
                        const isSelected = selectedGoal === type

                        return (
                            <button
                                key={type}
                                onClick={() => isAvailable && setSelectedGoal(type)}
                                disabled={!isAvailable}
                                className={`w-full p-3 rounded-lg border text-left transition-all ${isSelected
                                    ? 'bg-red-900/50 border-red-500 ring-2 ring-red-500/50'
                                    : isAvailable
                                        ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600'
                                        : 'bg-slate-900/50 border-slate-800 opacity-40 cursor-not-allowed'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">{info.icon}</span>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                            <span className={`font-bold ${isSelected ? 'text-red-200' : 'text-white'}`}>
                                                {info.title}
                                            </span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${legitimacy >= 10 ? 'bg-green-900/50 text-green-400 border border-green-500/30' :
                                                legitimacy >= 0 ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-500/30' :
                                                    legitimacy >= -30 ? 'bg-orange-900/50 text-orange-400 border border-orange-500/30' :
                                                        'bg-red-900/50 text-red-400 border border-red-500/30'
                                                }`}>
                                                {legitimacy > 0 ? '+' : ''}{legitimacy}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">{info.description}</p>
                                        {!isAvailable && (
                                            <p className="text-xs text-red-400 mt-1 italic">Not available</p>
                                        )}
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Reaction Preview */}
                {reaction && previewGoal && (
                    <div className="mx-5 mb-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">
                            International Reaction
                        </h4>
                        <p className={`text-sm ${previewGoal.legitimacy >= 10 ? 'text-green-400' :
                            previewGoal.legitimacy >= 0 ? 'text-yellow-400' :
                                previewGoal.legitimacy >= -30 ? 'text-orange-400' :
                                    'text-red-400'
                            }`}>
                            {reaction.description}
                        </p>
                        {reaction.relationsPenalty < 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                                Relations with neutrals: {reaction.relationsPenalty}
                            </p>
                        )}
                        {reaction.coalitionPenalty < 0 && (
                            <p className="text-xs text-gray-500">
                                Coalition standing: {reaction.coalitionPenalty}
                            </p>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="p-5 border-t border-slate-800 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-gray-300 font-medium rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedGoal}
                        className={`flex-1 py-3 font-bold rounded-lg transition-all ${selectedGoal
                            ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg'
                            : 'bg-slate-800 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        ⚔️ Declare War
                    </button>
                </div>
            </div>
        </div>
    )
}
