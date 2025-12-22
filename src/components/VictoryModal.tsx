import type { VictoryCondition, Achievement, VictoryType } from '../utils/victorySystem'
import { getVictoryMessage } from '../utils/victorySystem'

// =============================================================================
// VICTORY MODAL (Victory Screen)
// =============================================================================

interface VictoryModalProps {
    victory: VictoryCondition
    onContinue: () => void
    onNewGame: () => void
}

export function VictoryModal({ victory, onContinue, onNewGame }: VictoryModalProps) {
    const message = getVictoryMessage(victory.type)

    const colorScheme = getVictoryColors(victory.type)

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
            {/* Confetti animation would go here */}
            <div className={`bg-gradient-to-br ${colorScheme.gradient} border-2 ${colorScheme.border} rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-pulse-slow`}>
                {/* Trophy Icon */}
                <div className="text-center pt-8">
                    <div className="text-8xl mb-4 animate-bounce">
                        {victory.icon}
                    </div>
                </div>

                {/* Victory Message */}
                <div className="text-center px-8 pb-8">
                    <h1 className={`text-4xl font-black ${colorScheme.text} mb-2`}>
                        {message.title}
                    </h1>
                    <h2 className="text-xl font-bold text-white/80 mb-4">
                        {message.subtitle}
                    </h2>
                    <p className="text-gray-300 text-lg leading-relaxed">
                        {message.description}
                    </p>
                </div>

                {/* Stats */}
                <div className="bg-black/30 px-8 py-4 border-t border-white/10">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-white">{victory.progressText}</div>
                            <div className="text-xs text-gray-400 uppercase">Final Score</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green-400">✓</div>
                            <div className="text-xs text-gray-400 uppercase">Objective Complete</div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 flex gap-4">
                    <button
                        onClick={onContinue}
                        className={`flex-1 py-4 ${colorScheme.buttonPrimary} text-white font-bold text-lg rounded-xl transition-all hover:scale-105 shadow-lg`}
                    >
                        🎮 Continue Playing
                    </button>
                    <button
                        onClick={onNewGame}
                        className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-gray-200 font-bold text-lg rounded-xl transition-all"
                    >
                        🆕 New Game
                    </button>
                </div>

                {/* Sandbox Mode Hint */}
                <div className="px-6 pb-6 text-center">
                    <p className="text-sm text-gray-500">
                        Continue playing in sandbox mode - your achievements are saved!
                    </p>
                </div>
            </div>
        </div>
    )
}

function getVictoryColors(type: VictoryType) {
    switch (type) {
        case 'DOMINATION':
            return {
                gradient: 'from-red-900 via-orange-900 to-red-900',
                border: 'border-orange-500',
                text: 'text-orange-400',
                buttonPrimary: 'bg-orange-600 hover:bg-orange-500'
            }
        case 'HEGEMONY':
            return {
                gradient: 'from-purple-900 via-indigo-900 to-purple-900',
                border: 'border-purple-500',
                text: 'text-purple-400',
                buttonPrimary: 'bg-purple-600 hover:bg-purple-500'
            }
        case 'ECONOMIC':
            return {
                gradient: 'from-emerald-900 via-teal-900 to-emerald-900',
                border: 'border-emerald-500',
                text: 'text-emerald-400',
                buttonPrimary: 'bg-emerald-600 hover:bg-emerald-500'
            }
        case 'SURVIVAL':
            return {
                gradient: 'from-blue-900 via-slate-800 to-blue-900',
                border: 'border-blue-500',
                text: 'text-blue-400',
                buttonPrimary: 'bg-blue-600 hover:bg-blue-500'
            }
    }
}

// =============================================================================
// ACHIEVEMENT POPUP (Toast-style notification)
// =============================================================================

interface AchievementPopupProps {
    achievement: Achievement
    onDismiss: () => void
}

export function AchievementPopup({ achievement, onDismiss }: AchievementPopupProps) {
    const rarityColors = {
        COMMON: 'from-slate-700 to-slate-800 border-slate-500',
        UNCOMMON: 'from-green-900 to-green-950 border-green-500',
        RARE: 'from-blue-900 to-blue-950 border-blue-400',
        LEGENDARY: 'from-amber-900 to-orange-950 border-amber-400'
    }

    const rarityGlow = {
        COMMON: '',
        UNCOMMON: 'shadow-green-500/20',
        RARE: 'shadow-blue-400/30',
        LEGENDARY: 'shadow-amber-400/50 animate-pulse'
    }

    return (
        <div
            className={`fixed top-20 right-6 z-[80] bg-gradient-to-r ${rarityColors[achievement.rarity]} 
                border-2 rounded-xl shadow-2xl ${rarityGlow[achievement.rarity]} 
                w-80 overflow-hidden animate-slide-in-right cursor-pointer transition-transform hover:scale-105`}
            onClick={onDismiss}
        >
            <div className="p-4 flex items-center gap-4">
                {/* Icon */}
                <div className="text-4xl">{achievement.icon}</div>

                {/* Content */}
                <div className="flex-1">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                        🏆 Achievement Unlocked
                    </div>
                    <div className="font-bold text-white text-lg">
                        {achievement.title}
                    </div>
                    <div className="text-sm text-gray-300">
                        {achievement.description}
                    </div>
                </div>
            </div>

            {/* Rarity Badge */}
            <div className={`py-1 text-center text-xs font-bold uppercase tracking-wider
                ${achievement.rarity === 'LEGENDARY' ? 'bg-amber-600 text-amber-100' :
                    achievement.rarity === 'RARE' ? 'bg-blue-600 text-blue-100' :
                        achievement.rarity === 'UNCOMMON' ? 'bg-green-600 text-green-100' :
                            'bg-slate-600 text-slate-200'}`}
            >
                {achievement.rarity}
            </div>
        </div>
    )
}

// =============================================================================
// VICTORY PROGRESS PANEL (Sidebar widget)
// =============================================================================

interface VictoryProgressPanelProps {
    conditions: VictoryCondition[]
    onViewDetails: (type: VictoryType) => void
}

export function VictoryProgressPanel({ conditions, onViewDetails }: VictoryProgressPanelProps) {
    return (
        <div className="bg-slate-900/90 border border-white/10 rounded-lg p-4 shadow-xl backdrop-blur-sm">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                🏆 Victory Progress
            </h3>

            <div className="space-y-3">
                {conditions.map(condition => (
                    <button
                        key={condition.type}
                        onClick={() => onViewDetails(condition.type)}
                        className={`w-full p-2 rounded-lg border text-left transition-all hover:scale-[1.02]
                            ${condition.achieved
                                ? 'bg-green-900/30 border-green-500/50'
                                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="flex items-center gap-2">
                                <span>{condition.icon}</span>
                                <span className="font-medium text-white text-sm">
                                    {condition.title}
                                </span>
                            </span>
                            {condition.achieved && (
                                <span className="text-green-400 text-sm">✓</span>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all ${condition.achieved ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${condition.progress}%` }}
                            />
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                            {condition.progressText}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}

// =============================================================================
// ACHIEVEMENTS LIST
// =============================================================================

interface AchievementsListProps {
    achievements: Achievement[]
    allAchievements: typeof import('../utils/victorySystem').ACHIEVEMENTS
}

export function AchievementsList({ achievements, allAchievements }: AchievementsListProps) {
    const unlockedIds = new Set(achievements.map(a => a.id))

    const categories = ['MILITARY', 'DIPLOMATIC', 'ECONOMIC', 'POLITICAL', 'SPECIAL'] as const

    return (
        <div className="space-y-6">
            {categories.map(category => {
                const categoryAchievements = allAchievements.filter(a => a.category === category)

                return (
                    <div key={category}>
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                            {category}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {categoryAchievements.map(achievement => {
                                const isUnlocked = unlockedIds.has(achievement.id)

                                return (
                                    <div
                                        key={achievement.id}
                                        className={`p-3 rounded-lg border transition-all
                                            ${isUnlocked
                                                ? 'bg-slate-800 border-green-500/30'
                                                : 'bg-slate-900/50 border-slate-800 opacity-50'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={isUnlocked ? '' : 'grayscale'}>
                                                {achievement.icon}
                                            </span>
                                            <span className={`font-medium text-sm ${isUnlocked ? 'text-white' : 'text-gray-500'}`}>
                                                {achievement.title}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {isUnlocked ? achievement.description : '???'}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
