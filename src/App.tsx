import { useState, useEffect, useCallback } from 'react'
import { GameSetup } from './components/GameSetup'
import type { GameSettings } from './types/game'
import { GameMap } from './components/GameMap'
import { ConsequencesPanel } from './components/ConsequencesPanel'
import { ConstitutionModal } from './components/ConstitutionModal'
import { EventModal } from './components/EventModal'

import { ExpansionModal } from './components/ExpansionModal'
import { DiplomacyActionModal } from './components/DiplomacyActionModal'
import { ClaimActionModal } from './components/ClaimActionModal'
import { NewsTicker } from './components/NewsTicker'
import { NationInfoPanel } from './components/NationInfoPanel'
import { DiplomacyPanel } from './components/DiplomacyPanel'
import { TerritoryAnalysisModal } from './components/TerritoryAnalysisModal'
import { CoalitionPanel } from './components/CoalitionPanel'
import { useGameStore } from './store/gameStore'
import { useWorldStore } from './store/worldStore'
import { initCountryData } from './utils/countryData'
import { initGeopoliticalData } from './utils/geopoliticalData'
import { initInfrastructure, calculateInfrastructure } from './utils/infrastructure'
import type { VictoryCondition, Achievement } from './utils/victorySystem'
import { WarPlanningModal } from './components/WarPlanningModal'
import { MilitaryPanel } from './components/MilitaryPanel'

import type { BattlePlan } from './types/game'
import { calculateConsequences } from './utils/calculateConsequences'
import { calculateCityCapture, parseCities } from './utils/calculateCityCapture'
import { GameOverModal } from './components/GameOverModal'
import { VictoryModal, AchievementPopup } from './components/VictoryModal'
import { GameLog } from './components/GameLog'
import { BreakingNews } from './components/BreakingNews'
import * as turf from '@turf/turf'
import countriesData from './data/countries.json'
import citiesData from './data/cities.json'

import { ActiveWarsPanel } from './components/ActiveWarsPanel'
import { CoalitionWarPanel } from './components/CoalitionWarPanel'
import { AdvancedDiplomacyPanel } from './components/AdvancedDiplomacyPanel'
import { MobileNav, useIsMobile, type MobilePanel } from './components/MobileNav'
import { MultiplayerFlow } from './components/MultiplayerFlow'
import { MultiplayerStatusModal } from './components/MultiplayerStatusModal'
import { useMultiplayerStore } from './store/multiplayerStore'
import { subscribeGame } from './firebase/game'


import { initializeCloudGame } from './firebase/persistence'
import { signInAnonymous } from './firebase/auth'
import { NotificationLog } from './components/NotificationLog'
import { useGameLoop } from './hooks/useGameLoop'
import { useHostSync } from './hooks/useHostSync'
import { useHostActions } from './hooks/useHostActions'
import { useClientSync } from './hooks/useClientSync'
import { GameSpeedControl } from './components/GameSpeedControl'

import "../src/styles/AdvancedDiplomacyPanel.css"

function App() {
    const [showCoalitionPanel, setShowCoalitionPanel] = useState(false)
    const [showDiplomacyPanel, setShowDiplomacyPanel] = useState(false)
    const [showAdvancedDiplomacy, setShowAdvancedDiplomacy] = useState(false)
    const [showWarsPanel, setShowWarsPanel] = useState(false)
    const [showMultiplayerStatus, setShowMultiplayerStatus] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)

    // Mobile navigation state
    const [activePanel, setActivePanel] = useState<MobilePanel>('map')
    const isMobile = useIsMobile()

    // Victory and Achievement state
    const [currentVictory, setCurrentVictory] = useState<VictoryCondition | null>(null)
    const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null)

    // War Planning State
    const [showWarPlanningModal, setShowWarPlanningModal] = useState(false)
    const [planningTarget, setPlanningTarget] = useState<{ code: string, name: string } | null>(null)
    const [isDrawMode, setIsDrawMode] = useState(false)
    const [activeArrowType, setActiveArrowType] = useState<'OFFENSE' | 'DEFENSE' | 'SUPPLY'>('OFFENSE')
    // New: We need to store assignments of units to arrows
    // Map<ArrowID, UnitIDs[]>
    const [arrowAssignments, setArrowAssignments] = useState<Record<string, string[]>>({})
    const [battlePlan, setBattlePlan] = useState<BattlePlan | undefined>(undefined)
    const [arrowCount, setArrowCount] = useState(0)

    // Nuclear targeting mode subscription
    const nuclearTargetingMode = useWorldStore(state => state.nuclearTargetingMode)
    const [clearWarSignal, setClearWarSignal] = useState<number | undefined>(undefined)



    const {
        phase,
        diplomaticEvents,
        userPolygon,
        setPhase,
        setGameSettings,
        setUserPolygon,
        setConsequences,
        setCapturedCities,
        setInfrastructureStats,
        consequences,
        selectedClaimId,
        setSelectedClaim,
        nation,
        startBattle,
        gameOver
    } = useGameStore()
    const { initializeAICountries, aiCountries, activeWars } = useWorldStore()

    // Multiplayer state
    const {
        isMultiplayer,
        phase: multiplayerPhase,
        gameId: multiplayerGameId,
        lobbyCode,
        enterMultiplayer,
        exitMultiplayer
    } = useMultiplayerStore()

    // Game Logic Hooks
    useGameLoop()
    useHostSync()
    useHostActions()
    useClientSync()

    // Handlers for GameSetup
    const handleStartGame = (settings: GameSettings) => {
        setGameSettings(settings)

        if (settings.startMode === 'EXISTING_COUNTRY' && settings.startingCountry) {
            // Load the selected country's territory
            const countryFeature = (countriesData as any).features.find(
                (f: any) => f.properties.iso_a3 === settings.startingCountry
            )

            if (countryFeature) {
                console.log('🏳️ Starting as existing country:', settings.startingCountry, countryFeature.properties.ADMIN)

                // Set the country as player's territory
                setUserPolygon(countryFeature)

                // Calculate consequences (what other countries we now control)
                const newConsequences = calculateConsequences(countryFeature, countriesData as any)
                setConsequences(newConsequences)

                // Calculate captured cities
                const cities = parseCities(citiesData as any)
                const cityResult = calculateCityCapture(countryFeature, cities)
                setCapturedCities(cityResult.capturedCities)

                // Calculate infrastructure
                const infrastructureStats = calculateInfrastructure(countryFeature)
                setInfrastructureStats(infrastructureStats)

                console.log('📊 Existing country initialized:', {
                    consequences: newConsequences.length,
                    cities: cityResult.capturedCities.length,
                    population: infrastructureStats.totalPopulation
                })

                // Store the country name for pre-filling in Constitution
                const countryName = countryFeature.properties?.admin || countryFeature.properties?.name
                useGameStore.getState().setSelectedCountryName(countryName)
                useGameStore.getState().setSelectedCountry(settings.startingCountry)

                // Skip directly to CONSTITUTION phase (no need for ANALYSIS for existing countries)
                setPhase('CONSTITUTION')
            } else {
                console.error('❌ Country not found:', settings.startingCountry)
                setPhase('DRAWING') // Fallback to drawing mode
            }
        } else {
            // Freeform drawing mode
            setPhase('DRAWING')
        }

        // --- CLOUD PERSISTENCE FOR LOCAL GAME ---
        // Automatically start a "private cloud game" to enable saving
        const startPersistence = async () => {
            try {
                // 1. Ensure Auth
                let uid = useMultiplayerStore.getState().user?.uid
                let nickname = useMultiplayerStore.getState().nickname || 'Player'

                if (!uid) {
                    console.log('☁️ Signing in anonymously for save capability...')
                    const user = await signInAnonymous()
                    uid = user.uid
                    useMultiplayerStore.getState().setUser(user)
                }

                // 2. Create Cloud Game
                const gameId = await initializeCloudGame(uid, nickname)

                // 3. Connect Store
                useMultiplayerStore.setState({
                    isMultiplayer: true, // Enable sync
                    isHost: true,        // Enable write authority
                    gameId: gameId,
                    lobbyCode: null,     // Distinct from lobby-based game
                    phase: 'game_active'
                })

                console.log('✅ Cloud Persistence Active. Game ID:', gameId)

            } catch (err) {
                console.error('❌ Failed to initialize cloud persistence:', err)
                // Game continues locally without saving
            }
        }

        // Fire and forget
        startPersistence()
    }

    const handleCancelSetup = () => {
        setPhase('DRAWING')
    }

    // Multiplayer State handled above

    // Sync remote game state
    useEffect(() => {
        if (!multiplayerGameId || !isMultiplayer) return

        const unsubscribe = subscribeGame(multiplayerGameId, (remoteGame) => {
            if (remoteGame) {
                // Update remote players in store
                useGameStore.getState().setRemotePlayers(remoteGame.players)
                console.log('📡 Synced remote game state:', Object.keys(remoteGame.players).length, 'players', '| Date:', remoteGame.gameDate, '| Wars:', remoteGame.wars?.length)

                // Debug raw remote object
                console.log('📡 RAW REMOTE GAME:', remoteGame)

                // Update local player stats from server
                const myId = useMultiplayerStore.getState().user?.uid
                if (myId && remoteGame.players && remoteGame.players[myId]) {
                    const myData = remoteGame.players[myId]

                    // Sync Resources
                    if (myData.resources) {
                        useGameStore.setState(state => ({
                            nation: state.nation ? {
                                ...state.nation,
                                stats: {
                                    ...state.nation.stats,
                                    ...myData.resources
                                }
                            } : state.nation
                        }))
                    }

                    // Sync Territory & Map Objects (Crucial for Restore)
                    if (myData.territory) {
                        try {
                            const territoryClone = typeof myData.territory === 'string'
                                ? JSON.parse(myData.territory)
                                : myData.territory

                            // Only update if we don't have territory yet (Initial Load)
                            // or if we trust server more (simple assumption: if we have 0 territory, take server's)
                            if (useGameStore.getState().playerTerritories.length === 0) {
                                console.log('🗺️ Restoring territory from cloud save...')
                                useGameStore.getState().setUserPolygon(territoryClone)

                                // Restore derived state if available in other fields, 
                                // otherwise we might need to recalculate?
                                // Ideally, we should sync 'consequences' and 'capturedCities' too.
                                // For now, we assume recalculation might happen or we add those fields later.
                            }
                        } catch (e) {
                            console.error('Failed to parse remote territory', e)
                        }
                    }
                }

                // Sync Global State
                useGameStore.setState({
                    gameDate: remoteGame.gameDate
                    // TODO: Sync AI countries here if backend simulates them
                })

                // Sync Wars (Overwrite local state with authoritative server state)
                if (remoteGame.wars && Array.isArray(remoteGame.wars)) {
                    // Update AI Wars locally
                    const { setAIWars } = useWorldStore.getState()

                    // Parse planArrow if it's a string (Workaround for Firestore nested array limitation)
                    const parsedWars = remoteGame.wars.map((w: any) => {
                        if (typeof w.planArrow === 'string') {
                            try {
                                w.planArrow = JSON.parse(w.planArrow)
                            } catch (e) {
                                console.error('Failed to parse planArrow for war', w.id)
                            }
                        }
                        return w
                    })

                    setAIWars(parsedWars)
                }

                // Sync Active Battles (Player Wars)
                // We cast to any because RemoteGameState might not have fully typed activeBattles everywhere yet
                if (remoteGame.activeBattles && Array.isArray(remoteGame.activeBattles)) {
                    // Force update local active battles store
                    useGameStore.setState({ activeBattles: remoteGame.activeBattles })
                }

                // Sync Game Date
                if (remoteGame.gameDate) {
                    useGameStore.getState().setGameDate(remoteGame.gameDate)
                }

                // Sync Events (Append new ones)
                if (remoteGame.events && Array.isArray(remoteGame.events)) {
                    const localEvents = useGameStore.getState().diplomaticEvents
                    const newEvents = remoteGame.events.filter((e: any) => !localEvents.some(le => le.id === e.id))

                    if (newEvents.length > 0) {
                        useGameStore.getState().addDiplomaticEvents(newEvents)
                        console.log('📬 Received', newEvents.length, 'new events from host')
                    }
                }

                // Sync Game Speed (Clients follow Host's speed)
                if (!useMultiplayerStore.getState().isHost && (remoteGame as any).gameSpeed !== undefined) {
                    const currentSpeed = useGameStore.getState().gameSpeed
                    if (currentSpeed !== (remoteGame as any).gameSpeed) {
                        useGameStore.getState().setGameSpeed((remoteGame as any).gameSpeed)
                        console.log('⏱️ Synced game speed from host:', (remoteGame as any).gameSpeed)
                    }
                }

                if (remoteGame.contestedZones && Array.isArray(remoteGame.contestedZones)) {
                    const newMap = new Map()
                    remoteGame.contestedZones.forEach((item: any) => {
                        try {
                            const feature = JSON.parse(item.featureString)
                            newMap.set(item.id, feature)
                        } catch (e) {
                            console.error('Failed to parse contested zone', item.id)
                        }
                    })
                    // Direct update to store
                    useWorldStore.setState({ contestedZones: newMap })
                    console.log(`📥 SYNC [Client]: Updated ${newMap.size} contested zones from Host`)
                    // Log the first zone for debug
                    if (newMap.size > 0) {
                        const firstKey = newMap.keys().next().value
                        console.log(`  -> Sample Zone (${firstKey}):`, JSON.stringify(newMap.get(firstKey)))
                    }
                }

                // Sync AI Territories (permanent border changes from wars/annexations).
                // The host only sends countries whose borders diverged from the shared
                // baseline (see useHostSync.ts), so this MERGES into our locally-built
                // aiTerritories map rather than replacing it - our own baseline for
                // untouched countries came from the same countries.json at startup and
                // must be preserved. A null featureString means the host fully annexed
                // that country; remove it from our local map too.
                if (remoteGame.aiTerritories && Array.isArray(remoteGame.aiTerritories)) {
                    const territoryUpdates = remoteGame.aiTerritories
                    const mergedTerritories = new Map(useWorldStore.getState().aiTerritories)
                    territoryUpdates.forEach((item) => {
                        if (!item.featureString) {
                            mergedTerritories.delete(item.code)
                            return
                        }
                        try {
                            const feature = JSON.parse(item.featureString)
                            mergedTerritories.set(item.code, feature)
                        } catch (e) {
                            console.error('Failed to parse AI territory', item.code)
                        }
                    })
                    useWorldStore.setState({ aiTerritories: mergedTerritories })
                    console.log(`📥 SYNC [Client]: Merged ${territoryUpdates.length} AI territory updates from Host`)
                }

                // Sync Irradiated Zones (Nuclear Blasts)
                if (remoteGame.irradiatedZones && Array.isArray(remoteGame.irradiatedZones)) {
                    const newMap = new Map()
                    remoteGame.irradiatedZones.forEach((item: any) => {
                        try {
                            const zone = JSON.parse(item.zoneString)
                            newMap.set(item.id, zone)
                        } catch (e) {
                            console.error('Failed to parse nuke zone', item.id)
                        }
                    })
                    useWorldStore.setState({ irradiatedZones: newMap })
                }

            } else {
                console.warn('⚠️ Synced remote game is null/undefined!', multiplayerGameId)
            }
        })

        return () => unsubscribe()
    }, [multiplayerGameId, isMultiplayer])

    // Load data on mount
    useEffect(() => {
        initCountryData()
        initGeopoliticalData()
        initInfrastructure().then(() => {
            useGameStore.getState().setInfrastructureLoaded(true)
            console.log('✅ Infrastructure loaded and store updated')
        })
    }, [])

    // Safety check: Ensure AI countries are initialized if we have consequences
    // Safety check: Ensure AI countries are initialized if we have consequences
    useEffect(() => {
        const { coalitionsInitialized } = useWorldStore.getState()
        if (consequences.length > 0 && aiCountries.size === 0 && !coalitionsInitialized) {
            console.log('🔄 Re-initializing AI countries from consequences...')
            initializeAICountries(consequences, nation?.constitution, countriesData as any)
        }
    }, [consequences, aiCountries, initializeAICountries, nation])

    // AI Turn Loop (HOST AUTHORITY)


    // --- HOST ACION PROCESSING LOOP ---
    // Listens for client actions (Declaration of War, etc.) and executes them authoritatively



    const [selectedCountryForDiplomacy, setSelectedCountryForDiplomacy] = useState<{ code: string, name?: string } | null>(null)






    // War Planning Handlers
    const handleSavePlan = (unitIds: string[]) => {
        if (!battlePlan) return

        const planToSave = {
            ...battlePlan,
            assignedUnitIds: unitIds
        }

        useGameStore.getState().saveWarPlan(planToSave)

        // Reset and close
        setShowWarPlanningModal(false)
        setPlanningTarget(null)
        setBattlePlan(undefined)
        setArrowCount(0)
        setIsDrawMode(false)

        // Maybe show toast?
        console.log('📝 War Plan Saved:', planToSave.name)
    }

    // Launch Offensive Handler - Opens War Planning Modal
    const handleLaunchOffensive = (countryCode: string, countryName: string) => {
        if (!nation) return

        // Initialize War Planning
        setPlanningTarget({ code: countryCode, name: countryName })
        setShowWarPlanningModal(true)
        setSelectedCountryForDiplomacy(null) // Close diplomacy modal
    }


    // Arrow Drawing Handler
    const handleWarArrowsUpdate = useCallback((arrows: any) => {
        if (!planningTarget) return
        setBattlePlan({
            id: `plan-${Date.now()}`,
            name: `Attack on ${planningTarget.name}`,
            targetCountry: planningTarget.code,
            assignedUnitIds: [], // Units will be assigned in WarPlanningModal
            arrows: arrows,
            createdAt: Date.now()
        })
        setArrowCount(arrows.features.length)
    }, [planningTarget])

    const executeOffensive = (unitIds: string[]) => {
        if (!nation || !planningTarget) return

        const countryCode = planningTarget.code
        const countryName = planningTarget.name

        // Start offensive battle
        // Get enemy soldiers
        const enemy = aiCountries.get(countryCode)
        const enemySoldiers = enemy ? enemy.soldiers : 10000

        // Auto-declare war if not already at war
        if (enemy && !enemy.isAtWar && aiCountries.has(countryCode)) {
            console.log('⚔️ Executing plan triggers War Declaration:', countryCode)
            useWorldStore.getState().declareWar(countryCode)

            // Add diplomatic event for the war declaration
            useGameStore.getState().addDiplomaticEvents([{
                id: `war-decl-${Date.now()}`,
                type: 'WAR_DECLARED',
                severity: 3,
                title: 'War Declared',
                description: `We have declared war on ${countryName} by launching a surprise offensive!`,
                affectedNations: [countryCode],
                timestamp: Date.now()
            }])

            // Trigger Alliance Response (Article 5)
            useWorldStore.getState().triggerAllianceResponse(countryCode, 'PLAYER')
        }

        // Calculate battle location (center of target country)
        let battleLocation: [number, number] | undefined
        const targetFeature = (countriesData as any).features.find(
            (f: any) => f.properties?.iso_a3 === countryCode
        )
        if (targetFeature) {
            try {
                const center = turf.centerOfMass(targetFeature)
                battleLocation = center.geometry.coordinates as [number, number]
            } catch (e) {
                console.warn('Failed to calculate offensive battle location', e)
            }
        }

        // Calculate Attacker Soldiers from Units
        const participatingUnits = nation.units?.filter(u => unitIds.includes(u.id)) || []
        const totalSoldiers = participatingUnits.reduce((sum, u) => sum + u.soldiers, 0) || nation.stats.soldiers // Fallback if no units selected (legacy)

        // Finalize Plan
        const finalPlan = battlePlan ? { ...battlePlan, assignedUnitIds: unitIds } : undefined

        startBattle(
            'PLAYER',
            nation.name,
            countryCode,
            countryName,
            totalSoldiers,
            enemySoldiers,
            'BATTLE',
            true, // isPlayerAttacker
            false, // isPlayerDefender
            undefined, // claimId
            battleLocation,
            0, // defenseBonus
            finalPlan // Pass the plan!
        )

        // Reset Planning State
        setShowWarPlanningModal(false)
        setPlanningTarget(null)
        setBattlePlan(undefined)
        setArrowCount(0)
        setIsDrawMode(false)
    }

    // Effect to toggle drawing mode
    // We need to pass isDrawMode to GameMap?
    // Or we initializing arrowDraw here and passing map instance?
    // GameMap has the map instance ref. We need to access it.
    // Ideally, we move initArrowDraw inside GameMap and expose controls via props.
    // OR we pass `isDrawRef` to GameMap.

    // Let's modify GameMap to accept `warPlanningMode` prop.


    // Render setup screen if in SETUP phase
    if (phase === 'SETUP') {
        // Check if in multiplayer flow
        if (isMultiplayer && multiplayerPhase !== 'offline' && multiplayerPhase !== 'game_active') {
            return (
                <MultiplayerFlow
                    onGameStart={(gameId, _, selectedCountry, playerColor) => {
                        console.log('🎮 Starting multiplayer game:', gameId, 'Country:', selectedCountry, 'Color:', playerColor)

                        // Store player color in multiplayer store
                        if (playerColor) {
                            const currentColor = useMultiplayerStore.getState().playerColor
                            if (currentColor !== playerColor) {
                                console.log('🎨 Updating persistent player color from', currentColor, 'to', playerColor)
                                useMultiplayerStore.getState().setPlayerColor(playerColor)
                            }
                        }

                        // Initialize with selected country (like single player EXISTING_COUNTRY mode)
                        if (selectedCountry) {
                            const countryFeature = (countriesData as any).features.find(
                                (f: any) => f.properties.iso_a3 === selectedCountry
                            )

                            if (countryFeature) {
                                const countryName = countryFeature.properties?.admin || countryFeature.properties?.name
                                console.log('🏳️ Starting as existing country:', selectedCountry, countryName)

                                // Set game settings
                                setGameSettings({
                                    startMode: 'EXISTING_COUNTRY',
                                    expansionPoints: 0,
                                    startingCountry: selectedCountry,
                                    enableRealCoalitions: true,
                                    enableElections: true,
                                    enableNuclearNations: true,
                                    difficulty: 'NORMAL'
                                })

                                // Set the country as player's territory
                                setUserPolygon(countryFeature)

                                // Calculate consequences
                                const newConsequences = calculateConsequences(countryFeature, countriesData as any)
                                setConsequences(newConsequences)

                                // Calculate captured cities
                                const cities = parseCities(citiesData as any)
                                const cityResult = calculateCityCapture(countryFeature, cities)
                                setCapturedCities(cityResult.capturedCities)

                                // Calculate infrastructure
                                const infrastructureStats = calculateInfrastructure(countryFeature)
                                setInfrastructureStats(infrastructureStats)

                                // IMPORTANT: Set the selected country (this marks it as player's nation)
                                useGameStore.getState().setSelectedCountryName(countryName)
                                useGameStore.getState().setSelectedCountry(selectedCountry)

                                console.log('📊 Multiplayer existing country initialized:', {
                                    selectedCountry,
                                    countryName,
                                    consequences: newConsequences.length,
                                    cities: cityResult.capturedCities.length
                                })

                                // Go to CONSTITUTION phase to finalize nation setup
                                setPhase('CONSTITUTION')
                            } else {
                                // Fallback to drawing if country not found
                                console.warn('Country not found:', selectedCountry)
                                setPhase('DRAWING')
                            }
                        } else {
                            // No country selected (draw mode), go to drawing phase
                            setPhase('DRAWING')
                        }
                    }}
                    onExit={() => {
                        exitMultiplayer()
                    }}
                />
            )
        }

        return (
            <GameSetup
                onStartGame={handleStartGame}
                onCancel={handleCancelSetup}
                onMultiplayer={enterMultiplayer}
            />
        )
    }

    // Handler for country clicks - opens diplomacy modal (including own country for inspection)
    const handleCountryClick = (code: string, name?: string) => {
        setSelectedCountryForDiplomacy({ code, name })
    }

    return (
        <div className="relative w-full h-screen overflow-hidden bg-slate-900">
            {/* Map layer */}
            {showWarPlanningModal && planningTarget && (
                <WarPlanningModal
                    targetCountryCode={planningTarget.code}
                    onConfirm={executeOffensive}
                    onSave={handleSavePlan}
                    onCancel={() => {
                        setShowWarPlanningModal(false)
                        setPlanningTarget(null)
                        setIsDrawMode(false)
                    }}
                    isDrawing={isDrawMode}
                    setIsDrawing={setIsDrawMode}
                    clearArrows={() => {
                        setArrowCount(0)
                        setBattlePlan(undefined)
                        setClearWarSignal(Date.now())
                        setArrowAssignments({})
                    }}
                    arrowCount={arrowCount}
                    activeArrowType={activeArrowType}
                    setActiveArrowType={setActiveArrowType}
                    arrows={battlePlan?.arrows?.features || []}
                    arrowAssignments={arrowAssignments}
                    onAssignUnits={(arrowId, unitIds) => {
                        setArrowAssignments(prev => ({
                            ...prev,
                            [arrowId]: unitIds
                        }))
                    }}
                />
            )}

            {/* Map Component */}
            <GameMap
                onCountryClick={handleCountryClick}
                warPlanningMode={showWarPlanningModal}
                isDrawingWarArrows={isDrawMode}
                activeArrowType={activeArrowType}
                onWarArrowsUpdate={handleWarArrowsUpdate}
                clearWarArrowsRequest={clearWarSignal}
            />

            {/* UI overlays - Mobile: show active panel only, Desktop: show all */}
            {(!isMobile || activePanel === 'nation') && <NationInfoPanel isMobile={isMobile} onClose={() => setActivePanel('map')} />}
            {(!isMobile || activePanel === 'diplomacy') && <DiplomacyPanel isMobile={isMobile} onClose={() => setActivePanel('map')} />}
            {(!isMobile || activePanel === 'military') && (
                <MilitaryPanel
                    isMobile={isMobile}
                    onClose={() => setActivePanel('map')}
                />
            )}

            {/* More Panel (Mobile Only) - Contains additional menus */}
            {isMobile && activePanel === 'more' && (
                <div className="fixed inset-0 bg-slate-900 z-40 overflow-y-auto pb-20">
                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-orange-400">More Options</h2>
                            <button
                                onClick={() => setActivePanel('map')}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Coalition Button */}
                        <button
                            onClick={() => setShowCoalitionPanel(true)}
                            className="w-full bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-xl p-4 hover:border-blue-400/50 transition-all text-left"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🤝</span>
                                    <div>
                                        <div className="text-white font-bold">Coalitions</div>
                                        <div className="text-gray-400 text-sm">View alliances</div>
                                    </div>
                                </div>
                                <span className="text-gray-500">→</span>
                            </div>
                        </button>

                        {/* Wars Button */}
                        <button
                            onClick={() => setShowWarsPanel(true)}
                            className="w-full bg-gradient-to-r from-red-900/40 to-orange-900/40 border border-red-500/30 rounded-xl p-4 hover:border-red-400/50 transition-all text-left"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">⚔️</span>
                                    <div>
                                        <div className="text-white font-bold">Active Wars</div>
                                        <div className="text-gray-400 text-sm">{(activeWars?.length || 0)} ongoing</div>
                                    </div>
                                </div>
                                <span className="text-gray-500">→</span>
                            </div>
                        </button>

                        {/* Notifications Button */}
                        <button
                            onClick={() => setShowNotifications(true)}
                            className="w-full bg-gradient-to-r from-slate-800/40 to-slate-700/40 border border-slate-600/30 rounded-xl p-4 hover:border-slate-500/50 transition-all text-left"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">📬</span>
                                    <div>
                                        <div className="text-white font-bold">Notifications</div>
                                        <div className="text-gray-400 text-sm">{diplomaticEvents.length} events</div>
                                    </div>
                                </div>
                                <span className="text-gray-500">→</span>
                            </div>
                        </button>

                        {/* Multiplayer Status (if in MP game) */}
                        {isMultiplayer && (
                            <button
                                onClick={() => setShowMultiplayerStatus(true)}
                                className="w-full bg-gradient-to-r from-green-900/40 to-teal-900/40 border border-green-500/30 rounded-xl p-4 hover:border-green-400/50 transition-all text-left"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">👥</span>
                                        <div>
                                            <div className="text-white font-bold">Multiplayer Status</div>
                                            <div className="text-gray-400 text-sm">{lobbyCode || 'View game'}</div>
                                        </div>
                                    </div>
                                    <span className="text-gray-500">→</span>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {!isMobile && <ConsequencesPanel />}
            {!isMobile && <CoalitionWarPanel />}

            {/* Mobile Navigation */}
            <MobileNav
                activePanel={activePanel}
                setActivePanel={setActivePanel}
                hasWars={(activeWars?.length || 0) > 0}
            />



            {/* Modals */}
            {phase === 'ANALYSIS' && userPolygon && (
                <TerritoryAnalysisModal
                    polygon={userPolygon as any}
                    onConfirm={() => setPhase('CONSTITUTION')}
                />
            )}
            <ConstitutionModal />
            <ExpansionModal />
            <EventModal />
            {/* Game Over Modal */}
            {gameOver && <GameOverModal />}

            {/* Victory Modal */}
            {currentVictory && (
                <VictoryModal
                    victory={currentVictory}
                    onContinue={() => setCurrentVictory(null)}
                    onNewGame={() => {
                        useGameStore.getState().reset()
                        useWorldStore.getState().reset()
                        window.location.reload()
                    }}
                />
            )}

            {/* Achievement Popup */}
            {currentAchievement && (
                <AchievementPopup
                    achievement={currentAchievement}
                    onDismiss={() => setCurrentAchievement(null)}
                />
            )}

            {/* Victory Progress Panel (bottom right) - Desktop only */}
            {/* Victory Progress Panel (disabled for now) */}
            {/* 
            {!isMobile && phase === 'RESULTS' && victoryConditions.length > 0 && (
                <div className="absolute bottom-20 right-4 z-10 w-64">
                    <VictoryProgressPanel
                        conditions={victoryConditions}
                        onViewDetails={(type) => console.log('View victory:', type)}
                    />
                </div>
            )} 
            */}

            {/* Game Log */}
            <GameLog />

            {/* Breaking News Banner */}
            <BreakingNews />

            {/* Diplomacy Action Modal */}
            {selectedCountryForDiplomacy && (
                <DiplomacyActionModal
                    countryCode={selectedCountryForDiplomacy.code}
                    initialName={selectedCountryForDiplomacy.name}
                    onClose={() => setSelectedCountryForDiplomacy(null)}
                    onLaunchOffensive={handleLaunchOffensive}
                />
            )}

            {/* Claim Action Modal */}
            {selectedClaimId && (
                <ClaimActionModal
                    claimId={selectedClaimId}
                    onClose={() => setSelectedClaim(null)}
                    onLaunchOffensive={handleLaunchOffensive}
                    onFundSeparatists={(claimId, amount) => {
                        console.log('💰 Funding separatists:', claimId, amount)
                        useGameStore.getState().updateBudget(-amount)

                        // Find target country and add unrest
                        const claim = useGameStore.getState().activeClaims.find(c => c.id === claimId)
                        if (claim) {
                            const primaryTarget = [...claim.targetCountries].sort((a, b) => b.areaClaimedKm2 - a.areaClaimedKm2)[0]
                            if (primaryTarget) {
                                useGameStore.getState().addDiplomaticEvents([{
                                    id: `fund-separatists-${Date.now()}`,
                                    type: 'INSURGENCY',
                                    severity: 2,
                                    title: 'Separatist Funding',
                                    description: `We have secretly funded separatist groups in ${primaryTarget.name}.`,
                                    affectedNations: [primaryTarget.code],
                                    timestamp: Date.now()
                                }])
                            }
                        }
                    }}
                />
            )}

            {/* Right Panel - Diplomacy/Stats */}
            {showDiplomacyPanel && (phase === 'RESULTS' || phase === 'EXPANSION') && (
                <div className="absolute top-20 right-4 w-80 h-[calc(100vh-6rem)] z-10">
                    <DiplomacyPanel />
                </div>
            )}

            {/* Coalition Panel */}
            {showCoalitionPanel && (
                <CoalitionPanel onClose={() => setShowCoalitionPanel(false)} />
            )}

            {/* Advanced Diplomacy Panel */}
            {showAdvancedDiplomacy && (phase === 'RESULTS' || phase === 'EXPANSION') && (
                <div className="absolute top-20 left-4 w-96 max-h-[calc(100vh-6rem)] z-20 overflow-y-auto">
                    <div className="relative">
                        <button
                            onClick={() => setShowAdvancedDiplomacy(false)}
                            className="absolute top-2 right-2 z-30 bg-red-600 hover:bg-red-500 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm"
                        >
                            ×
                        </button>
                        <AdvancedDiplomacyPanel />
                    </div>
                </div>
            )}

            {/* Floating Action Buttons - Unified Top Right Container */}
            {!isMobile && (phase === 'RESULTS' || phase === 'EXPANSION' || phase === 'WAR') && (
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                    {/* Notification Toggle */}
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`p-3 rounded-full shadow-lg border transition-all ${showNotifications
                            ? 'bg-amber-600 text-white border-amber-400'
                            : 'bg-slate-800/90 hover:bg-slate-700 text-white border-slate-600'
                            }`}
                        title="Notification Log"
                    >
                        📜
                    </button>

                    <button
                        onClick={() => setShowDiplomacyPanel(!showDiplomacyPanel)}
                        className={`p-3 rounded-full shadow-lg border transition-all ${showDiplomacyPanel
                            ? 'bg-blue-600 text-white border-blue-400'
                            : 'bg-slate-800/90 hover:bg-slate-700 text-white border-slate-600'
                            }`}
                        title="Diplomacy & Relations"
                    >
                        🌐
                    </button>
                    <button
                        onClick={() => setShowCoalitionPanel(true)}
                        className="p-3 bg-slate-800/90 hover:bg-slate-700 text-white rounded-full shadow-lg border border-slate-600 transition-all"
                        title="Coalitions"
                    >
                        🤝
                    </button>
                    <button
                        onClick={() => setShowWarsPanel(true)}
                        className="p-3 bg-red-900/90 hover:bg-red-800 text-white rounded-full shadow-lg border border-red-600 transition-all animate-pulse"
                        title="Active Conflicts"
                    >
                        ⚔️
                    </button>
                    <button
                        onClick={() => setShowAdvancedDiplomacy(!showAdvancedDiplomacy)}
                        className={`p-3 rounded-full shadow-lg border transition-all ${showAdvancedDiplomacy
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-slate-800/90 hover:bg-slate-700 text-white border-slate-600'
                            }`}
                        title="Advanced Diplomacy (UN, Crises, Influence)"
                    >
                        🏛️
                    </button>
                </div>
            )}

            {/* Wars Panel */}
            {showWarsPanel && (
                <ActiveWarsPanel
                    onClose={() => setShowWarsPanel(false)}
                    onFocusWar={(war) => {
                        console.log('Focusing war:', war.id)
                        setShowWarsPanel(false)
                        // TODO: Implement focus logic (move camera)
                    }}
                />
            )}

            {/* Instructions - only show during drawing phase */}
            {
                phase === 'DRAWING' && (
                    <div className="absolute bottom-14 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                        <p className="text-sm text-gray-300">
                            <span className="text-orange-400">Click</span> to draw points •
                            <span className="text-orange-400 ml-1">Double-click</span> to complete your borders
                        </p>
                    </div>
                )
            }

            {/* Expansion mode indicator */}
            {
                phase === 'EXPANSION' && (
                    <div className="absolute bottom-14 left-4 z-10 bg-red-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-red-500/30">
                        <p className="text-sm text-red-300">
                            🏴 <span className="font-bold">EXPANSION MODE</span> — Draw territory to claim
                        </p>
                    </div>
                )
            }

            {/* Nuclear Targeting Mode Overlay */}
            {nuclearTargetingMode && (
                <div className="absolute inset-x-0 top-4 z-50 flex justify-center pointer-events-none">
                    <div className="bg-red-900/90 backdrop-blur-sm rounded-lg px-6 py-4 border-2 border-yellow-500 shadow-2xl pointer-events-auto animate-pulse">
                        <div className="flex items-center gap-4">
                            <span className="text-4xl">☢️</span>
                            <div>
                                <h3 className="text-yellow-400 font-bold text-lg">NUCLEAR TARGETING MODE</h3>
                                <p className="text-gray-200 text-sm">
                                    Click on <strong className="text-yellow-400">{nuclearTargetingMode.countryCode}</strong> to select impact location (50km radius)
                                </p>
                            </div>
                            <button
                                onClick={() => useWorldStore.getState().exitNuclearTargetingMode()}
                                className="ml-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-bold transition-colors"
                            >
                                ✕ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Locked borders indicator */}
            {
                phase === 'RESULTS' && (
                    <div className="absolute bottom-14 left-4 z-10 bg-slate-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                        <p className="text-sm text-gray-300">
                            Click <span className="text-orange-400">🏴 Claim Territory</span> to expand •
                            <span className="text-gray-400 ml-1">Use Diplomacy panel to interact</span>
                        </p>
                    </div>
                )
            }

            {/* Multiplayer Status Button - shows during multiplayer games */}
            {isMultiplayer && phase === 'RESULTS' && (
                <button
                    onClick={() => setShowMultiplayerStatus(true)}
                    className="fixed bottom-20 right-4 z-40 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition-all"
                    style={{ boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)' }}
                >
                    <span className="text-xl">🌐</span>
                    <span>Multiplayer</span>
                </button>
            )}

            {/* Multiplayer Status Modal */}
            <MultiplayerStatusModal
                isOpen={showMultiplayerStatus}
                onClose={() => setShowMultiplayerStatus(false)}
            />

            {/* News Ticker */}
            {(phase === 'RESULTS' || phase === 'EXPANSION' || diplomaticEvents.length > 0) && <NewsTicker />}

            {/* Game Speed Control - Top Center */}
            {(phase === 'RESULTS' || phase === 'EXPANSION' || phase === 'WAR') && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                    <GameSpeedControl />
                </div>
            )}

            {/* Notification Log Render - Now handled in unified container above */}
            {showNotifications && (
                <div className="absolute top-4 right-20 z-30">
                    <NotificationLog onClose={() => setShowNotifications(false)} />
                </div>
            )}


        </div>
    )

}

export default App
