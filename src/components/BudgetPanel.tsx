import { useGameStore } from '../store/gameStore'
import type { Budget } from '../types/game'

export function BudgetPanel() {
    const { nation, updateNationStats } = useGameStore()

    if (!nation) return null

    const { budgetAllocation, taxRate } = nation.stats

    const handleBudgetChange = (category: keyof Budget, value: number) => {
        updateNationStats({
            budgetAllocation: {
                ...budgetAllocation,
                [category]: value
            }
        })
    }

    const handleTaxChange = (value: number) => {
        updateNationStats({ taxRate: value })
    }

    return (
        <div className="space-y-4 text-white">
            {/* Tax Rate */}
            <div className="mb-6">
                <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-slate-300">Tax Rate</span>
                    <span className="text-sm font-bold text-emerald-400">{taxRate}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => handleTaxChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                    Higher taxes increase income but reduce stability and growth.
                </p>
            </div>

            <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 pb-2">
                    Budget Intensity
                </h4>
                <p className="text-xs text-slate-500 italic">
                    Set funding levels for each department. These are independent spending controls, not a percentage split. Higher intensity means higher costs but better results.
                </p>

                {/* Social Services */}
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-blue-300">🏥 Social Services</span>
                        <span className="text-sm font-bold">{budgetAllocation.social}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={budgetAllocation.social}
                        onChange={(e) => handleBudgetChange('social', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <p className="text-xs text-slate-500">Improves stability and happiness.</p>
                </div>

                {/* Military */}
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-red-300">⚔️ Military</span>
                        <span className="text-sm font-bold">{budgetAllocation.military}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={budgetAllocation.military}
                        onChange={(e) => handleBudgetChange('military', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                    <p className="text-xs text-slate-500">Improves defence and recruitment.</p>
                </div>

                {/* Infrastructure */}
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-amber-300">🏗️ Infrastructure</span>
                        <span className="text-sm font-bold">{budgetAllocation.infrastructure}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={budgetAllocation.infrastructure}
                        onChange={(e) => handleBudgetChange('infrastructure', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <p className="text-xs text-slate-500">Improves trade income and GDP growth.</p>
                </div>

                {/* Research */}
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-purple-300">🔬 Research</span>
                        <span className="text-sm font-bold">{budgetAllocation.research}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={budgetAllocation.research}
                        onChange={(e) => handleBudgetChange('research', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <p className="text-xs text-slate-500">Improves efficiency and technology.</p>
                </div>
            </div>
        </div>
    )
}
