
import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { UnitType } from '../types/game'

const UNIT_TEMPLATES: Record<UnitType, { costPerSoldier: number, label: string, emoji: string }> = {
    'INFANTRY': { costPerSoldier: 10000, label: 'Infantry Brigade', emoji: '🪖' },
    'ARMOR': { costPerSoldier: 50000, label: 'Armored Division', emoji: '🚜' }, // Expensive but strong
    'SPECIAL_FORCES': { costPerSoldier: 100000, label: 'Special Operations', emoji: '⚡' }, // Elite
    'DEFENSE': { costPerSoldier: 5000, label: 'Garrison', emoji: '🛡️' }, // Cheap defense
    'MILITIA': { costPerSoldier: 1000, label: 'Militia', emoji: '✊' } // Very cheap, weak
}

const MIN_SOLDIERS = 1000
const MAX_SOLDIERS = 50000

interface MilitaryPanelProps {
    onOpenDefensivePlanning?: () => void
}

type Tab = 'OVERVIEW' | 'RECRUIT' | 'ORGANIZE'

export function MilitaryPanel({ onOpenDefensivePlanning }: MilitaryPanelProps) {
    const { nation, createUnit, updateBudget, deleteUnit, transferSoldiers, recallUnit } = useGameStore()
    const [isOpen, setIsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW')

    // Recruitment State
    const [recruitSource, setRecruitSource] = useState<'DRAFT' | 'HIRE'>('DRAFT')
    const [recruitType, setRecruitType] = useState<UnitType>('INFANTRY')
    const [recruitCount, setRecruitCount] = useState(10000)

    // Organize State
    const [transferSourceId, setTransferSourceId] = useState<string>('')
    const [transferTargetId, setTransferTargetId] = useState<string>('')
    const [transferAmount, setTransferAmount] = useState(1000)

    if (!nation) return null

    // Calculate Manpower
    const totalSoldiers = nation.stats.soldiers
    const assignedSoldiers = nation.units?.reduce((sum, u) => sum + u.soldiers, 0) || 0
    const unassignedSoldiers = Math.max(0, totalSoldiers - assignedSoldiers)

    // Recruit Logic
    const selectedTemplate = UNIT_TEMPLATES[recruitType]
    const baseCost = recruitCount * selectedTemplate.costPerSoldier
    const totalRecruitCost = recruitSource === 'HIRE' ? baseCost : baseCost * 0.2
    const canDraft = recruitSource === 'DRAFT' ? unassignedSoldiers >= recruitCount : true

    const handleRecruit = () => {
        if (nation.stats.budget < totalRecruitCost) {
            alert('Insufficient funds!')
            return
        }
        if (recruitSource === 'DRAFT' && !canDraft) {
            alert('Not enough unassigned soldiers in the Reserves!')
            return
        }
        updateBudget(-totalRecruitCost)
        createUnit(recruitType, recruitCount, recruitSource)
    }

    // Transfer Logic
    const handleTransfer = () => {
        if (!transferSourceId || !transferTargetId) return
        if (transferSourceId === transferTargetId) return

        transferSoldiers(transferSourceId, transferTargetId, transferAmount)
        // Reset or keep? Keep for rapid adjustments
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 left-4 z-40 px-4 py-2 bg-slate-900/90 text-white rounded-lg border border-slate-700 shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
            >
                🪖 Military Command
                <span className="bg-red-600 text-xs px-1.5 py-0.5 rounded-full">
                    {nation.units?.length || 0}
                </span>
            </button>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            🪖 Military Command Center
                        </h2>
                        {/* Tabs */}
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-white/10">
                            {(['OVERVIEW', 'RECRUIT', 'ORGANIZE'] as Tab[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === tab
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>

                {/* Manpower Bar */}
                <div className="bg-black/30 p-2 flex gap-4 text-xs border-b border-white/5">
                    <div className="flex-1 flex flex-col justify-center">
                        <div className="flex justify-between text-gray-400 mb-1">
                            <span>Total Army: <strong className="text-white">{totalSoldiers.toLocaleString()}</strong></span>
                            <span>Reserves: <strong className={unassignedSoldiers > 0 ? "text-green-400" : "text-red-400"}>{unassignedSoldiers.toLocaleString()}</strong></span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative">
                            {/* Assigned part */}
                            <div
                                className="absolute left-0 top-0 bottom-0 bg-blue-600"
                                style={{ width: `${(assignedSoldiers / totalSoldiers) * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className="border-l border-white/10 pl-4 flex items-center gap-4">
                        <button
                            onClick={() => {
                                if (onOpenDefensivePlanning) {
                                    onOpenDefensivePlanning()
                                    setIsOpen(false)
                                }
                            }}
                            className="bg-red-900/50 hover:bg-red-800 text-red-100 px-3 py-1.5 rounded border border-red-500/30 font-bold transition-colors flex items-center gap-2"
                        >
                            ⚔️ War Room
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden p-4 bg-slate-900/50">

                    {/* --- OVERVIEW TAB --- */}
                    {activeTab === 'OVERVIEW' && (
                        <div className="h-full flex flex-col gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-2">
                                {nation.units?.length === 0 ? (
                                    <div className="col-span-full text-center text-gray-500 py-10">No active units. Go to Recruit tab!</div>
                                ) : (
                                    nation.units?.map(unit => (
                                        <div key={unit.id} className="bg-slate-800 p-3 rounded border border-white/5 hover:border-white/20 transition-colors group relative">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="font-bold text-white">{unit.name}</div>
                                                    <div className="text-xs text-gray-400">{unit.type}</div>
                                                </div>
                                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${unit.status === 'IDLE' ? 'bg-green-900/50 text-green-400' :
                                                        unit.status === 'ATTACKING' ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'
                                                    }`}>
                                                    {unit.status}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                                <div className="bg-slate-900/50 p-1.5 rounded">
                                                    <span className="text-gray-500 block">Soldiers</span>
                                                    <span className="text-white font-mono">{unit.soldiers.toLocaleString()}</span>
                                                </div>
                                                <div className="bg-slate-900/50 p-1.5 rounded">
                                                    <span className="text-gray-500 block">Exp / Morale</span>
                                                    <span className="text-yellow-400">{Math.round(unit.experience)}</span> / <span className="text-blue-400">{Math.round(unit.morale)}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => recallUnit(unit.id)}
                                                    className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 text-xs rounded text-white disabled:opacity-50"
                                                    disabled={unit.status === 'IDLE'}
                                                    title="Recall Unit to Base (Reset Status)"
                                                >
                                                    Recall
                                                </button>
                                                <button
                                                    onClick={() => deleteUnit(unit.id)}
                                                    className="px-2 py-1 bg-red-900/20 hover:bg-red-900/50 text-red-400 border border-red-900/30 rounded text-xs"
                                                    title="Disband Unit"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- RECRUIT TAB --- */}
                    {activeTab === 'RECRUIT' && (
                        <div className="h-full max-w-2xl mx-auto flex flex-col gap-6 pt-4">
                            {/* Source Toggle */}
                            <div className="flex bg-slate-800 rounded-lg p-1 self-center">
                                <button
                                    onClick={() => setRecruitSource('DRAFT')}
                                    className={`px-6 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${recruitSource === 'DRAFT' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <span>📉</span> Draft (Reserves)
                                </button>
                                <button
                                    onClick={() => setRecruitSource('HIRE')}
                                    className={`px-6 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${recruitSource === 'HIRE' ? 'bg-yellow-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <span>💰</span> Hire (Mercenaries)
                                </button>
                            </div>

                            {/* Type Selection */}
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {Object.entries(UNIT_TEMPLATES).map(([type, tmpl]) => (
                                    <button
                                        key={type}
                                        onClick={() => setRecruitType(type as UnitType)}
                                        className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-2 ${recruitType === type
                                                ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-500'
                                                : 'bg-slate-800 border-white/5 text-gray-400 hover:bg-slate-700'
                                            }`}
                                    >
                                        <span className="text-2xl">{tmpl.emoji}</span>
                                        <span className="text-xs font-bold text-center">{tmpl.label}</span>
                                        <span className="text-[10px] opacity-60">${(tmpl.costPerSoldier * (recruitSource === 'DRAFT' ? 0.2 : 1)).toLocaleString()}/m</span>
                                    </button>
                                ))}
                            </div>

                            {/* Size Slider */}
                            <div className="bg-slate-800 p-4 rounded-xl border border-white/5 space-y-4">
                                <div className="flex justify-between items-end">
                                    <label className="text-gray-400 text-sm font-bold">Brigade Size</label>
                                    <span className="text-2xl font-bold text-blue-400">{recruitCount.toLocaleString()} <span className="text-sm text-gray-500">soldiers</span></span>
                                </div>
                                <input
                                    type="range"
                                    min={MIN_SOLDIERS}
                                    max={MAX_SOLDIERS}
                                    step={100}
                                    value={recruitCount}
                                    onChange={(e) => setRecruitCount(parseInt(e.target.value))}
                                    className="w-full accent-blue-500 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            {/* Action Button */}
                            <div className="flex justify-center">
                                <button
                                    onClick={handleRecruit}
                                    disabled={nation.stats.budget < totalRecruitCost || (recruitSource === 'DRAFT' && !canDraft)}
                                    className="w-full max-w-md py-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg text-lg flex flex-col items-center gap-1 transition-all"
                                >
                                    <span>Confirm Recruitment</span>
                                    <span className="text-xs font-normal opacity-80">
                                        Cost: ${(totalRecruitCost / 1000000).toFixed(2)}M
                                        {recruitSource === 'DRAFT' ? ' (Training Only)' : ' (Full Cost)'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- ORGANIZE TAB --- */}
                    {activeTab === 'ORGANIZE' && (
                        <div className="h-full flex flex-col gap-4">
                            <div className="bg-slate-800 p-4 rounded-lg text-sm text-gray-400 text-center border-l-4 border-blue-500">
                                Transfer soldiers between brigades to reinforce weakened units or reorganize your army structure.
                            </div>

                            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 h-full">
                                {/* Source List */}
                                <div className="flex flex-col gap-2 bg-slate-900/50 rounded-lg p-2 overflow-y-auto border border-white/5">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase text-center sticky top-0 bg-slate-900 py-1">Source</h3>
                                    {nation.units?.map(unit => (
                                        <button
                                            key={unit.id}
                                            onClick={() => setTransferSourceId(unit.id)}
                                            className={`text-left p-2 rounded border transition-colors ${transferSourceId === unit.id
                                                    ? 'bg-blue-600/20 border-blue-500 text-white'
                                                    : 'bg-slate-800 border-white/5 text-gray-400 hover:bg-slate-700'
                                                }`}
                                        >
                                            <div className="font-bold text-xs">{unit.name}</div>
                                            <div className="flex justify-between text-[10px] mt-1">
                                                <span>{unit.type}</span>
                                                <span>{unit.soldiers.toLocaleString()} men</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Controls */}
                                <div className="flex flex-col justify-center items-center gap-4 w-48">
                                    <div className="text-2xl">➡️</div>
                                    <div className="w-full">
                                        <label className="text-[10px] text-gray-500 uppercase block mb-1 text-center">Amount</label>
                                        <input
                                            type="number"
                                            value={transferAmount}
                                            onChange={(e) => setTransferAmount(Math.max(0, parseInt(e.target.value)))}
                                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-center text-white font-bold"
                                        />
                                    </div>
                                    <button
                                        onClick={handleTransfer}
                                        disabled={!transferSourceId || !transferTargetId || transferSourceId === transferTargetId}
                                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:opacity-50 text-white font-bold rounded"
                                    >
                                        Transfer
                                    </button>
                                </div>

                                {/* Target List */}
                                <div className="flex flex-col gap-2 bg-slate-900/50 rounded-lg p-2 overflow-y-auto border border-white/5">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase text-center sticky top-0 bg-slate-900 py-1">Target</h3>
                                    {nation.units?.map(unit => (
                                        <button
                                            key={unit.id}
                                            onClick={() => setTransferTargetId(unit.id)}
                                            className={`text-left p-2 rounded border transition-colors ${transferTargetId === unit.id
                                                    ? 'bg-blue-600/20 border-blue-500 text-white'
                                                    : 'bg-slate-800 border-white/5 text-gray-400 hover:bg-slate-700'
                                                } ${transferSourceId === unit.id ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            disabled={transferSourceId === unit.id}
                                        >
                                            <div className="font-bold text-xs">{unit.name}</div>
                                            <div className="flex justify-between text-[10px] mt-1">
                                                <span>{unit.type}</span>
                                                <span>{unit.soldiers.toLocaleString()} men</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}
