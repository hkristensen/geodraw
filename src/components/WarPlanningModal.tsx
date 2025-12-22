import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
// We don't import initArrowDraw here because it interacts with the map instance directly.
// Instead we'll trigger the map mode from App.tsx via props or store.

interface WarPlanningModalProps {
    targetCountryCode: string
    onConfirm: (unitIds: string[]) => void
    onSave: (unitIds: string[]) => void
    onCancel: () => void
    isDrawing: boolean
    setIsDrawing: (drawing: boolean) => void
    clearArrows: () => void
    arrowCount: number
    activeArrowType: 'OFFENSE' | 'DEFENSE' | 'SUPPLY'
    setActiveArrowType: (type: 'OFFENSE' | 'DEFENSE' | 'SUPPLY') => void
    arrows: any[] // Feature[]
    arrowAssignments: Record<string, string[]> // ArrowID -> UnitIDs[]
    onAssignUnits: (arrowId: string, unitIds: string[]) => void
}

export function WarPlanningModal({
    targetCountryCode,
    onConfirm,
    onSave,
    onCancel,
    isDrawing,
    setIsDrawing,
    clearArrows,
    arrowCount,
    activeArrowType,
    setActiveArrowType,
    arrows,
    arrowAssignments,
    onAssignUnits
}: WarPlanningModalProps) {
    const { aiCountries } = useWorldStore()
    const { nation } = useGameStore()
    const target = aiCountries.get(targetCountryCode) || { name: 'Unknown', code: targetCountryCode }
    const [expandedArrowId, setExpandedArrowId] = useState<string | null>(null)

    if (!nation) return null

    const availableUnits = nation.units?.filter(u => u.status === 'IDLE') || []

    const toggleUnitForArrow = (arrowId: string, unitId: string) => {
        const currentAssigned = arrowAssignments[arrowId] || []
        const newAssigned = currentAssigned.includes(unitId)
            ? currentAssigned.filter(id => id !== unitId)
            : [...currentAssigned, unitId]

        onAssignUnits(arrowId, newAssigned)
    }

    // Helper to get total employed soldiers
    const totalSoldiers = Object.values(arrowAssignments).flat().reduce((sum, uid) => {
        const unit = nation.units?.find(u => u.id === uid)
        return sum + (unit?.soldiers || 0)
    }, 0)

    // Helper to check if unit is assigned elsewhere
    const isUnitAssignedElsewhere = (unitId: string, currentArrowId: string) => {
        return Object.entries(arrowAssignments).some(([aid, uids]) => aid !== currentArrowId && uids.includes(unitId))
    }

    return (
        <div className="fixed top-20 right-4 z-50 w-96 bg-slate-900/95 backdrop-blur border border-red-500/50 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-900 to-slate-900 p-3 border-b border-red-500/30 flex-shrink-0 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>⚔️</span> War Room
                    </h2>
                    <div className="text-xs text-red-200">
                        Target: <span className="font-bold">{target.name}</span>
                    </div>
                </div>
                <div className="text-xs text-right">
                    <div className="text-gray-400">Force Size</div>
                    <div className="font-bold text-white">{totalSoldiers.toLocaleString()} men</div>
                </div>
            </div>

            {/* Tool Selector */}
            <div className="p-2 bg-slate-800 border-b border-white/10 flex gap-1">
                <button
                    onClick={() => setActiveArrowType('OFFENSE')}
                    className={`flex-1 py-1 px-2 rounded text-xs font-bold border transition-colors ${activeArrowType === 'OFFENSE' ? 'bg-red-600 border-red-400 text-white' : 'bg-slate-700 border-transparent text-gray-400 hover:bg-slate-600'
                        }`}
                >
                    🗡️ Attack
                </button>
                <button
                    onClick={() => setActiveArrowType('DEFENSE')}
                    className={`flex-1 py-1 px-2 rounded text-xs font-bold border transition-colors ${activeArrowType === 'DEFENSE' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-700 border-transparent text-gray-400 hover:bg-slate-600'
                        }`}
                >
                    🛡️ Defend
                </button>
                <button
                    onClick={() => setActiveArrowType('SUPPLY')}
                    className={`flex-1 py-1 px-2 rounded text-xs font-bold border transition-colors ${activeArrowType === 'SUPPLY' ? 'bg-yellow-600 border-yellow-400 text-white' : 'bg-slate-700 border-transparent text-gray-400 hover:bg-slate-600'
                        }`}
                >
                    🚚 Supply
                </button>
            </div>

            {/* Drawing Controls */}
            <div className="p-2 border-b border-white/10 flex gap-2">
                <button
                    onClick={() => setIsDrawing(!isDrawing)}
                    className={`flex-1 py-2 rounded font-bold text-sm transition-all border ${isDrawing
                        ? 'bg-orange-600 border-orange-400 text-white animate-pulse'
                        : 'bg-slate-800 border-white/20 text-gray-300 hover:bg-slate-700'
                        }`}
                >
                    {isDrawing ? '🖊️ Drawing Mode Active' : '✏️ Draw Arrow'}
                </button>

                <button
                    onClick={clearArrows}
                    disabled={arrowCount === 0}
                    className="px-3 py-2 bg-slate-800 border border-white/20 rounded text-gray-300 hover:bg-red-900/50 hover:text-red-200 disabled:opacity-50 transition-colors"
                    title="Clear all arrows"
                >
                    🗑️
                </button>
            </div>

            {/* Maneuver List (Arrows) */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {arrowCount === 0 ? (
                    <div className="text-center py-8 text-gray-500 italic text-sm">
                        No maneuvers planned.<br />Select a tool and draw arrows on the map.
                    </div>
                ) : (
                    arrows.map((arrow, idx) => {
                        const arrowId = arrow.properties?.id || `arrow-${idx}` // Fallback ID
                        const arrowType = arrow.properties?.type || 'OFFENSE'
                        const assignedUnitIds = arrowAssignments[arrowId] || []
                        const isExpanded = expandedArrowId === arrowId

                        return (
                            <div key={arrowId} className={`rounded border ${arrowType === 'OFFENSE' ? 'border-red-500/30 bg-red-900/10' :
                                    arrowType === 'DEFENSE' ? 'border-blue-500/30 bg-blue-900/10' :
                                        'border-yellow-500/30 bg-yellow-900/10'
                                }`}>
                                <div
                                    className="p-2 flex justify-between items-center cursor-pointer hover:bg-white/5"
                                    onClick={() => setExpandedArrowId(isExpanded ? null : arrowId)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${arrowType === 'OFFENSE' ? 'bg-red-500' :
                                                arrowType === 'DEFENSE' ? 'bg-blue-500' : 'bg-yellow-500'
                                            }`} />
                                        <span className="font-bold text-sm text-gray-200">
                                            {arrowType.charAt(0) + arrowType.slice(1).toLowerCase()} Power #{idx + 1}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {assignedUnitIds.length} units
                                    </div>
                                </div>

                                {/* Unit Selection (Expanded) */}
                                {isExpanded && (
                                    <div className="p-2 border-t border-white/5 bg-black/20 space-y-1 max-h-40 overflow-y-auto">
                                        {availableUnits.length === 0 && <p className="text-xs text-gray-500">No idle units.</p>}
                                        {availableUnits.map(unit => {
                                            const assignedElsewhere = isUnitAssignedElsewhere(unit.id, arrowId)
                                            return (
                                                <label key={unit.id} className={`flex items-center gap-2 p-1.5 rounded border border-white/5 cursor-pointer ${assignedElsewhere ? 'opacity-50 grayscale' : 'hover:bg-white/5'
                                                    }`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={assignedUnitIds.includes(unit.id)}
                                                        onChange={() => !assignedElsewhere && toggleUnitForArrow(arrowId, unit.id)}
                                                        disabled={assignedElsewhere}
                                                        className="rounded border-gray-600 bg-slate-900 text-red-600 focus:ring-red-500"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="text-xs font-bold text-gray-300">{unit.name}</div>
                                                        <div className="text-[10px] text-gray-500">{unit.type} • {unit.soldiers}</div>
                                                    </div>
                                                    {assignedElsewhere && <span className="text-[10px] text-red-400">Assigned</span>}
                                                </label>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-3 border-t border-white/10 flex gap-2 bg-slate-900 flex-shrink-0">
                <button
                    onClick={() => onSave(Object.values(arrowAssignments).flat())}
                    disabled={arrowCount === 0}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-700 text-white font-bold rounded shadow-lg border border-blue-500 transition-colors text-sm"
                >
                    SAVE
                </button>
                <button
                    onClick={() => onConfirm(Object.values(arrowAssignments).flat())}
                    disabled={arrowCount === 0 || Object.values(arrowAssignments).flat().length === 0}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:bg-slate-700 text-white font-bold rounded shadow-lg border border-red-500 transition-colors text-sm"
                >
                    LAUNCH
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white rounded transition-colors text-sm"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}
