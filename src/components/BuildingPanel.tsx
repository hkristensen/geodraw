import { useGameStore } from '../store/gameStore'
import { BuildingType } from '../types/game'
import { formatMoney } from '../utils/economy'

interface BuildingOption {
    type: BuildingType
    name: string
    icon: string
    cost: number
    description: string
    effect: string
}

const BUILDINGS: BuildingOption[] = [
    {
        type: 'FORT',
        name: 'Fortification',
        icon: '🏰',
        cost: 10_000_000,
        description: 'Defensive structure that increases local defence rating.',
        effect: '+500 Defence'
    },
    {
        type: 'TRAINING_CAMP',
        name: 'Training Camp',
        icon: '⚔️',
        cost: 5_000_000,
        description: 'Military facility to train soldiers faster and better.',
        effect: '+10% Recruitment'
    },
    {
        type: 'UNIVERSITY',
        name: 'University',
        icon: '🎓',
        cost: 20_000_000,
        description: 'Center of learning that boosts research and efficiency.',
        effect: '+5% Tech Efficiency'
    }
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
                {BUILDINGS.map((building) => {
                    const canAfford = nation.stats.budget >= building.cost
                    const isSelected = buildingMode === building.type

                    return (
                        <button
                            key={building.type}
                            onClick={() => handleSelectBuilding(building.type)}
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
                                <p className="text-xs text-green-400 mt-1 font-medium">{building.effect}</p>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
