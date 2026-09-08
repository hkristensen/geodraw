import { useGameStore } from '../store/gameStore'
import { BuildingType } from '../types/game'
import { formatMoney } from '../utils/economy'
import { BUILDINGS, BUILDING_EFFECTS } from '../data/buildings'

// Display order (roughly cheapest/most-general first)
const BUILDING_ORDER: BuildingType[] = [
    'TRAINING_CAMP', 'TEMPLE', 'MARKET', 'HOSPITAL', 'RESEARCH_LAB', 'FORT', 'UNIVERSITY', 'FACTORY'
]

export function BuildingPanel() {
    const { buildingMode, setBuildingMode, nation } = useGameStore()

    if (!nation) return null

    const handleSelectBuilding = (type: BuildingType) => {
        if (buildingMode === type) {
            setBuildingMode(null) // Toggle off
        } else {
            setBuildingMode(type)
        }
    }

    return (
        <div className="space-y-4 text-white">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>🏗️</span> Construction
            </h3>

            {buildingMode && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 mb-4 animate-pulse">
                    <p className="text-sm text-orange-200 font-bold text-center">
                        Select a location on the map to build
                    </p>
                </div>
            )}

            <div className="grid gap-3">
                {BUILDING_ORDER.map((type) => {
                    const building = BUILDINGS[type]
                    const canAfford = nation.stats.budget >= building.cost
                    const isSelected = buildingMode === type

                    return (
                        <button
                            key={type}
                            onClick={() => handleSelectBuilding(type)}
                            disabled={!canAfford && !isSelected}
                            className={`
                                relative flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                                ${isSelected
                                    ? 'bg-orange-600/40 border-orange-500 ring-2 ring-orange-500/50'
                                    : canAfford
                                        ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-700 hover:border-slate-600'
                                        : 'bg-slate-900/50 border-slate-800 opacity-50 cursor-not-allowed'
                                }
                            `}
                        >
                            <div className="text-2xl">{building.icon}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="font-bold text-sm truncate">{building.name}</span>
                                    <span className={`text-xs font-mono ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {formatMoney(building.cost)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 line-clamp-1">{building.description}</p>
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-xs text-green-400 font-medium">{BUILDING_EFFECTS[type]}</p>
                                    <p className="text-[10px] text-slate-500">Upkeep {formatMoney(building.upkeep)}/mo</p>
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
