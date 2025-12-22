import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BattleIndicator } from './BattleIndicator'
import type { ActiveBattle } from '../types/game'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, Polygon, MultiPolygon, FeatureCollection } from 'geojson'
import * as turf from '@turf/turf'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { calculateConsequences } from '../utils/calculateConsequences'
import { calculateCityCapture, parseCities } from '../utils/calculateCityCapture'
import { analyzeExpansionClaim } from '../utils/resolveExpansion'
import { initFreeformDraw } from '../utils/freeformDraw'
import { initArrowDraw } from '../utils/arrowDraw'
import { getAllAirportsGeoJSON, getAllPortsGeoJSON, calculateInfrastructure } from '../utils/infrastructure'
import { clipToLand } from '../utils/geometry'
import countriesData from '../data/countries.json'
import citiesData from '../data/cities.json'

function BattleMarker({ battle, map }: { battle: ActiveBattle, map: maplibregl.Map }) {
    const el = useMemo(() => {
        const div = document.createElement('div')
        div.className = 'battle-marker-container pointer-events-none'
        return div
    }, [])

    useEffect(() => {
        if (!battle.location) return

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat(battle.location)
            .addTo(map)

        return () => {
            marker.remove()
        }
    }, [battle.location, map, el])

    return createPortal(<BattleIndicator battle={battle} />, el)
}

import { WarMarker } from './WarMarker'
import { WarDetailModal } from './WarDetailModal'
import type { AIWar } from '../types/game'

function WarMapMarker({ war, map, aiTerritories, onClick }: { war: AIWar, map: maplibregl.Map, aiTerritories: Map<string, Feature>, onClick?: () => void }) {
    const el = useMemo(() => {
        const div = document.createElement('div')
        div.className = 'war-marker-container cursor-pointer pointer-events-auto hover:scale-110 transition-transform'
        if (onClick) {
            div.onclick = (e) => {
                e.stopPropagation()
                onClick()
            }
        }
        return div
    }, [onClick])

    const [location, setLocation] = useState<[number, number] | null>(null)
    const { aiCountries } = useWorldStore()

    // Calculate position (midpoint between capitals or centroids)
    useEffect(() => {
        const attacker = aiTerritories.get(war.attackerCode)
        const defender = aiTerritories.get(war.defenderCode)

        if (attacker && defender) {
            try {
                // Position on Defender's territory (User Request)
                const defenderCentroid = turf.centerOfMass(defender as any).geometry.coordinates
                setLocation(defenderCentroid as [number, number])
            } catch (e) {
                console.warn('Failed to calculate war marker position', e)
            }
        }
    }, [war, aiTerritories])

    useEffect(() => {
        if (!location) return

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat(location)
            .addTo(map)

        return () => {
            marker.remove()
        }
    }, [location, map, el])

    const attackerName = aiCountries.get(war.attackerCode)?.name || war.attackerCode
    const defenderName = aiCountries.get(war.defenderCode)?.name || war.defenderCode

    return createPortal(
        <WarMarker
            war={war}
            attackerName={attackerName}
            defenderName={defenderName}
        />,
        el
    )
}

interface GameMapProps {
    onCountryClick?: (code: string) => void
    warPlanningMode?: boolean
    isDrawingWarArrows?: boolean
    onWarArrowsUpdate?: (arrows: FeatureCollection) => void
    clearWarArrowsRequest?: number
    activeArrowType?: string
}

export function GameMap({
    onCountryClick,
    warPlanningMode,
    isDrawingWarArrows,
    onWarArrowsUpdate,
    clearWarArrowsRequest,
    activeArrowType
}: GameMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<maplibregl.Map | null>(null)
    const freeformDraw = useRef<ReturnType<typeof initFreeformDraw> | null>(null)
    const arrowDraw = useRef<ReturnType<typeof initArrowDraw> | null>(null)
    const drawInitialized = useRef(false)

    const phase = useGameStore(state => state.phase)
    const nation = useGameStore(state => state.nation)
    const playerTerritories = useGameStore(state => state.playerTerritories)
    const {
        setConsequences,
        setIsCalculating,
        setUserPolygon,
        setCapturedCities,
        addDiplomaticEvents,
        addModifiers,
        setPhase,
        setCurrentClaim,
        annexedCountries,
        setInfrastructureStats,
        activeBattles,
        setIsDrawing,
        infrastructureLoaded,
    } = useGameStore()

    const {
        aiTerritories,
        aiWars
    } = useWorldStore()

    // Parse cities once
    const cities = useMemo(() => parseCities(citiesData as FeatureCollection), [])

    // STATE: Selected War for Detail View
    const [selectedWarId, setSelectedWarId] = useState<string | null>(null)

    // Update map with dynamic territories
    useEffect(() => {
        const mapInstance = map.current
        if (!mapInstance || aiTerritories.size === 0 || !mapInstance.getStyle()) return

        try {
            const source = mapInstance.getSource?.('countries') as maplibregl.GeoJSONSource | undefined
            if (source) {
                console.log('🗺️ Updating map with dynamic territories:', aiTerritories.size)
                source.setData({
                    type: 'FeatureCollection',
                    features: Array.from(aiTerritories.values()) as Feature[]
                })
            }
        } catch (e) {
            console.warn('⚠️ Error updating dynamic territories:', e)
        }
    }, [aiTerritories])

    // RENDER AI WAR PLANS (Visual Arrows)
    useEffect(() => {
        const mapInstance = map.current
        // Ensure map exists and has a style (it might be in process of being destroyed or created)
        if (!mapInstance || !mapInstance.getStyle()) return

        try {
            // Collect all active plans
            const planFeatures = aiWars
                .filter(w => w.status === 'active' && w.planArrow)
                .map(w => w.planArrow) as Feature[]

            // Use optional chaining just to be absolutely safe even inside try block
            const source = mapInstance.getSource?.('ai-war-plans') as maplibregl.GeoJSONSource | undefined
            if (source) {
                source.setData({
                    type: 'FeatureCollection',
                    features: planFeatures
                })
            }
        } catch (e) {
            console.warn('⚠️ Error updating AI War Plans layer:', e)
        }
    }, [aiWars])

    // Manage War Arrow Drawing
    useEffect(() => {
        if (!map.current) return

        if (warPlanningMode && !arrowDraw.current) {
            // ... existing arrow draw logic ...

            arrowDraw.current = initArrowDraw(
                map.current,
                { color: '#ef4444', width: 4 }, // Red arrows
                {
                    onDrawEnd: (fc) => {
                        if (onWarArrowsUpdate) onWarArrowsUpdate(fc)
                    }
                }
            )
            console.log('🏹 Arrow drawing initialized')
        } else if (!warPlanningMode && arrowDraw.current) {
            // Cleanup arrow drawing
            arrowDraw.current.cleanup()
            arrowDraw.current = null
        }
    }, [warPlanningMode, onWarArrowsUpdate])

    // Handle Draw Mode Toggle
    useEffect(() => {
        if (!arrowDraw.current) return

        if (isDrawingWarArrows) {
            arrowDraw.current.start()
        } else {
            arrowDraw.current.stop()
        }
    }, [isDrawingWarArrows])

    // Update Arrow Type
    useEffect(() => {
        if (arrowDraw.current && activeArrowType) {
            arrowDraw.current.setType(activeArrowType)
        }
    }, [activeArrowType])

    // Handle Clear Request
    useEffect(() => {
        if (clearWarArrowsRequest && arrowDraw.current) {
            arrowDraw.current.clear()
            if (onWarArrowsUpdate) onWarArrowsUpdate({ type: 'FeatureCollection', features: [] })
        }
    }, [clearWarArrowsRequest, onWarArrowsUpdate])

    // Handle initial territory drawing
    const handleInitialDraw = useCallback((e: { features: Feature[] }) => {
        // Only handle in DRAWING phase
        if (useGameStore.getState().phase !== 'DRAWING') {
            console.log('⏭️ Skipping initial draw - not in DRAWING phase')
            return
        }

        const polygon = e.features[0] as Feature<Polygon | MultiPolygon>
        if (!polygon) return

        console.log('🎨 Initial territory drawn:', polygon)

        // Clip to land
        const clippedPolygon = clipToLand(polygon, countriesData as FeatureCollection)

        if (!clippedPolygon) {
            console.log('⚠️ Drawn area is entirely over water!')
            // Optional: Show error to user
            return
        }

        console.log('✂️ Clipped territory to land:', clippedPolygon)
        setUserPolygon(clippedPolygon)
        setIsCalculating(true)
        setPhase('CALCULATING')

        setTimeout(() => {
            const newConsequences = calculateConsequences(polygon, countriesData as FeatureCollection)

            const { capturedCities, modifiers, events } = calculateCityCapture(polygon, cities)

            // Calculate infrastructure for budget
            const infraStats = calculateInfrastructure(polygon)

            // CHECK COST LIMIT
            const totalPop = newConsequences.reduce((sum, c) => sum + c.populationCaptured, 0) +
                capturedCities.reduce((sum, c) => sum + c.population, 0)

            let cost = (totalPop / 1_000_000) * 200

            if (infraStats) {
                infraStats.airports.forEach(a => {
                    if (a.type === 'major') cost += 200
                    else if (a.type === 'medium') cost += 100
                    else cost += 50
                })
                infraStats.ports.forEach(p => {
                    if (p.type === 'major') cost += 200
                    else if (p.type === 'medium') cost += 100
                    else cost += 50
                })
            }

            if (cost > 5000) {
                console.log('⚠️ Territory too expensive:', cost)
                alert(`Territory too expensive! Cost: ${Math.round(cost)} / 5000 points.\nTry drawing a smaller area or avoiding major cities.`)

                // Reset
                setUserPolygon(null)
                setPhase('DRAWING')
                setIsCalculating(false)
                return
            }

            // Valid territory, proceed
            setConsequences(newConsequences)
            setCapturedCities(capturedCities)
            addModifiers(modifiers)
            addDiplomaticEvents(events)
            setInfrastructureStats(infraStats)

            setIsCalculating(false)
            setPhase('ANALYSIS')
        }, 100)
    }, [setConsequences, setIsCalculating, setUserPolygon, setCapturedCities, addDiplomaticEvents, addModifiers, setPhase, cities])

    // Handle expansion claim drawing
    const handleExpansionDraw = useCallback((e: { features: Feature[] }) => {
        // Only handle in EXPANSION phase
        if (useGameStore.getState().phase !== 'EXPANSION') {
            console.log('⏭️ Skipping expansion draw - not in EXPANSION phase')
            return
        }

        const polygon = e.features[0] as Feature<Polygon | MultiPolygon>
        if (!polygon) return

        console.log('🏴 Expansion claim drawn:', polygon)

        // Clip to land
        const clippedPolygon = clipToLand(polygon, countriesData as FeatureCollection)

        if (!clippedPolygon) {
            console.log('⚠️ Claim is entirely over water!')
            addDiplomaticEvents([{
                id: `claim-water-${Date.now()}`,
                type: 'BORDER_TENSION',
                severity: 1,
                title: 'Invalid Claim',
                description: 'You cannot claim the open ocean! Draw on land.',
                affectedNations: [],
                timestamp: Date.now(),
            }])
            setPhase('RESULTS')
            return
        }

        console.log('✂️ Clipped claim to land:', clippedPolygon)

        // Analyze which countries this affects
        const targetCountries = analyzeExpansionClaim(
            clippedPolygon as Feature<Polygon | MultiPolygon>,
            countriesData as FeatureCollection,
            useGameStore.getState().consequences
        )

        if (targetCountries.length === 0) {
            addDiplomaticEvents([{
                id: `claim-invalid-${Date.now()}`,
                type: 'BORDER_TENSION',
                severity: 1,
                title: 'Invalid Claim',
                description: 'Your claim does not overlap with any foreign territory.',
                affectedNations: [],
                timestamp: Date.now(),
            }])
            setPhase('RESULTS')
            return
        }

        // Create the expansion claim
        setCurrentClaim({
            id: `claim-${Date.now()}`,
            polygon: clippedPolygon as Feature<Polygon | MultiPolygon>,
            targetCountries,
            status: 'pending',
            createdAt: Date.now(),
        })

        // Phase stays EXPANSION, modal will handle it
    }, [addDiplomaticEvents, setPhase, setCurrentClaim])

    // Update layer filters when annexedCountries changes
    useEffect(() => {
        if (!map.current) return

        try {
            if (!map.current.isStyleLoaded()) return

            // Hide labels and borders for annexed countries
            const filter = ['!in', 'iso_a3', ...annexedCountries] as any

            if (map.current.getLayer('countries-label')) {
                map.current.setFilter('countries-label', filter)
            }

            if (map.current.getLayer('countries-borders')) {
                map.current.setFilter('countries-borders', filter)
            }
        } catch (e) {
            console.warn('⚠️ Error updating annexed countries filter:', e)
        }
    }, [annexedCountries])

    // Update disputed lands visualization
    const aiCountries = useWorldStore(state => state.aiCountries)

    useEffect(() => {
        if (!map.current || !map.current.isStyleLoaded()) return

        const disputedCodes: string[] = []
        const labelFeatures: Feature[] = []

        aiCountries.forEach((country) => {
            // Show stripes ONLY if we are at war (claims are handled by active-claims layer)
            // AND not annexed
            if (country.isAtWar && !country.isAnnexed) {
                disputedCodes.push(country.code)
            }

            // Show label if we have claimed significant land (> 1%) OR are at war
            const showLabel = (country.territoryLost > 1 && country.territoryLost < 100) || country.isAtWar || (country.claimedPercentage && country.claimedPercentage > 5)

            if (showLabel) {
                // Create a label feature for this country
                // We need the centroid. Since we don't have it easily, we can try to find it from the source
                // Or just use a known city or approximate.
                // For now, let's try to query the rendered features to find the country's location
                // This is tricky without the geometry.
                // Alternative: Use the 'countries' source data if we can access it.
                // Let's iterate through the countriesData (imported) to find the geometry

                const feature = (countriesData as FeatureCollection).features.find(
                    f => f.properties?.iso_a3 === country.code
                )

                if (feature) {
                    try {
                        const center = turf.centerOfMass(feature as any)
                        let labelText = ''
                        if (country.isAtWar) labelText = '⚔️ WAR'
                        else if (country.territoryLost > 1) labelText = `${Math.round(country.territoryLost)}% Occupied`
                        else if (country.claimedPercentage > 0) labelText = `${Math.round(country.claimedPercentage)}% Claimed`

                        labelFeatures.push({
                            type: 'Feature',
                            geometry: center.geometry,
                            properties: {
                                label: labelText
                            }
                        })
                    } catch (e) {
                        // Ignore geometry errors
                    }
                }
            }
        })

        // Update fill pattern filter
        if (map.current.getLayer('countries-disputed-fill')) {
            // Only show pattern for disputed countries
            map.current.setFilter('countries-disputed-fill', ['in', 'iso_a3', ...disputedCodes])
        }

        // Update labels source
        const source = map.current.getSource('disputed-labels') as maplibregl.GeoJSONSource
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: labelFeatures
            })
        }

    }, [aiCountries])

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current) return

        // Get initial annexed countries
        const initialAnnexedCountries = useGameStore.getState().annexedCountries
        const initialFilter = ['!in', 'iso_a3', ...initialAnnexedCountries] as any

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    'countries': {
                        type: 'geojson',
                        data: countriesData as FeatureCollection
                    }
                },
                layers: [
                    {
                        id: 'background',
                        type: 'background',
                        paint: {
                            'background-color': '#0f172a', // Slate 900 (Deep ocean)
                        }
                    },
                    {
                        id: 'countries-fill',
                        type: 'fill',
                        source: 'countries',
                        paint: {
                            'fill-color': '#1e293b', // Slate 800 (Land)
                            'fill-opacity': 1
                        }
                    },
                    {
                        id: 'countries-borders',
                        type: 'line',
                        source: 'countries',
                        paint: {
                            'line-color': '#334155', // Slate 700 (Borders)
                            'line-width': 1
                        },
                        filter: initialFilter
                    },
                    {
                        id: 'countries-label',
                        type: 'symbol',
                        source: 'countries',
                        minzoom: 2,
                        layout: {
                            'text-field': ['get', 'name'],
                            'text-font': ['Open Sans Regular'],
                            'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 14],
                            'text-max-width': 8,
                        },
                        paint: {
                            'text-color': '#94a3b8', // Slate 400
                            'text-halo-color': '#0f172a',
                            'text-halo-width': 1,
                        },
                        filter: initialFilter
                    }
                ]
            },
            center: [10, 50],
            zoom: 3,
        })

        map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right')

        // Add country borders layer when map loads
        map.current.on('load', () => {
            if (!map.current) return

            // Load striped pattern
            const patternCanvas = document.createElement('canvas');
            patternCanvas.width = 8;
            patternCanvas.height = 8;
            const ctx = patternCanvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(0, 0, 8, 8);
                ctx.strokeStyle = 'rgba(249, 115, 22, 0.6)'; // Orange stripes, slightly more opaque
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, 8);
                ctx.lineTo(8, 0);
                ctx.stroke();

                const patternData = ctx.getImageData(0, 0, 8, 8);
                map.current.addImage('striped-pattern', patternData);
                console.log('🏁 Striped pattern added to map')
            }

            // Sources and layers are already added in style, but we can add more here if needed
            // or just keep the existing logic for dynamic layers like player territory

            // Hover effect state
            // let hoveredStateId: string | number | null = null

            // We need to ensure features have IDs for hover state to work
            // Since our GeoJSON might not have IDs, we can't easily use feature state for hover
            // Instead we'll use a filter-based approach or just rely on the fill color change

            // For now, let's skip the complex hover state logic that relied on feature IDs
            // and just use a simple cursor change

            map.current.on('mousemove', 'countries-fill', () => {
                map.current!.getCanvas().style.cursor = 'pointer'
            })

            map.current.on('mouseleave', 'countries-fill', () => {
                map.current!.getCanvas().style.cursor = ''
            })

            // Unified Click Handler
            map.current.on('click', (e) => {
                const { phase, annexedCountries, activeClaims, setSelectedCountry, buildingMode, addBuilding } = useGameStore.getState()

                // 0. Check for Building Mode (Top Priority)
                if (buildingMode) {
                    // Check if clicked within player territory
                    const features = map.current?.queryRenderedFeatures(e.point, { layers: ['player-territory-fill'] })

                    if (features && features.length > 0) {
                        console.log('🏗️ Placing building:', buildingMode)
                        addBuilding({
                            id: `bld-${Date.now()}`,
                            type: buildingMode,
                            location: [e.lngLat.lng, e.lngLat.lat],
                            constructedAt: Date.now()
                        })
                        return
                    } else {
                        console.log('🚫 Cannot build outside territory')
                        // Optional: Show feedback
                        return
                    }
                }

                // 1. Check for Active Claims first (Top priority)
                // Query both fill and border to ensure we catch the click
                const claimFeatures = map.current?.queryRenderedFeatures(e.point, {
                    layers: ['active-claims-fill', 'active-claims-border']
                })
                console.log('🖱️ Click at', e.point, 'Claims found:', claimFeatures?.length, 'BuildingMode:', buildingMode)

                if (claimFeatures && claimFeatures.length > 0) {
                    const feature = claimFeatures[0]
                    const claimId = feature.properties?.id
                    console.log('🏴 Claim feature clicked, ID:', claimId)

                    if (claimId) {
                        console.log('🏴 Claim clicked:', claimId)
                        const claim = activeClaims.find(c => c.id === claimId)
                        console.log('🔍 Found claim in store:', claim)

                        if (claim && claim.targetCountries.length > 0) {
                            // Select the primary target country
                            const primaryTarget = [...claim.targetCountries].sort((a, b) => b.areaClaimedKm2 - a.areaClaimedKm2)[0]

                            if (primaryTarget) {
                                console.log('🎯 Selecting claim:', claimId)
                                const { setSelectedClaim } = useGameStore.getState()
                                setSelectedClaim(claimId)
                                return // Stop processing to prevent clicking country underneath
                            }
                        }
                    }
                }

                // 2. Check for Player Territory (clicking on your own drawn territory)
                if (phase === 'RESULTS') {
                    const playerTerritoryFeatures = map.current?.queryRenderedFeatures(e.point, {
                        layers: ['player-territory-fill']
                    })

                    if (playerTerritoryFeatures && playerTerritoryFeatures.length > 0) {
                        console.log('🏠 Player territory clicked - opening player modal')
                        const { gameSettings } = useGameStore.getState()
                        // For EXISTING_COUNTRY mode, use the starting country code
                        // For FREEFORM mode, use 'PLAYER' as a special code
                        const playerCode = gameSettings?.startMode === 'EXISTING_COUNTRY'
                            ? gameSettings.startingCountry || 'PLAYER'
                            : 'PLAYER'
                        if (onCountryClick) {
                            onCountryClick(playerCode)
                        }
                        return // Stop processing - don't fall through to country underneath
                    }
                }

                // 3. Check for Countries (Lower priority)
                // Include labels and disputed fill to ensure clicks register even if covered
                const countryFeatures = map.current?.queryRenderedFeatures(e.point, {
                    layers: ['countries-fill', 'countries-label', 'countries-disputed-fill']
                })
                if (countryFeatures && countryFeatures.length > 0) {
                    const feature = countryFeatures[0]
                    const props = feature.properties
                    const countryCode = props?.iso_a3 || props?.adm0_a3
                    const countryName = props?.name_long || props?.name

                    if (countryCode) {
                        console.log('🖱️ Country clicked:', countryName, countryCode)

                        // Ignore if already annexed
                        if (annexedCountries.includes(countryCode)) {
                            console.log('🚫 Country already annexed:', countryName)
                            return
                        }

                        if (phase === 'RESULTS') {
                            if (onCountryClick) {
                                onCountryClick(countryCode)
                            }
                        } else {
                            setSelectedCountry(countryCode)
                        }
                    }
                }
            })

            // Add player territory source (empty initially)
            map.current.addSource('player-territory', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            })

            // Player territory fill
            map.current.addLayer({
                id: 'player-territory-fill',
                type: 'fill',
                source: 'player-territory',
                paint: {
                    'fill-color': '#f97316', // Orange
                    'fill-opacity': 0.4,
                },
            })

            // Player territory border
            map.current.addLayer({
                id: 'player-territory-line',
                type: 'line',
                source: 'player-territory',
                paint: {
                    'line-color': '#f97316',
                    'line-width': 3,
                },
            })

            // Add disputed lands layer (pattern)
            map.current.addLayer({
                id: 'countries-disputed-fill',
                type: 'fill',
                source: 'countries',
                paint: {
                    'fill-pattern': 'striped-pattern',
                    'fill-opacity': 1
                },
                filter: ['in', 'iso_a3', ''] // Empty initially
            })

            // Add disputed labels source
            map.current.addSource('disputed-labels', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            })

            // Add disputed labels layer
            map.current.addLayer({
                id: 'countries-disputed-label',
                type: 'symbol',
                source: 'disputed-labels',
                layout: {
                    'text-field': ['get', 'label'],
                    'text-font': ['Open Sans Bold'],
                    'text-size': 14,
                    'text-offset': [0, 1.5], // Offset below country name
                },
                paint: {
                    'text-color': '#f97316', // Orange
                    'text-halo-color': '#000000',
                    'text-halo-width': 2,
                }
            })

            // Add airports source and layer
            map.current.addSource('airports', {
                type: 'geojson',
                data: getAllAirportsGeoJSON(),
            })

            map.current.addLayer({
                id: 'airports-layer',
                type: 'symbol',
                source: 'airports',
                layout: {
                    'text-field': '✈️',
                    'text-size': 16,
                    'text-allow-overlap': true,
                },
            })

            // Add factions source and layer
            map.current.addSource('factions', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            })

            map.current.addLayer({
                id: 'factions-layer',
                type: 'symbol',
                source: 'factions',
                layout: {
                    'text-field': '✊',
                    'text-size': 20,
                    'text-allow-overlap': true,
                    'text-offset': [0, -1]
                },
                paint: {
                    'text-halo-color': '#000000',
                    'text-halo-width': 2
                }
            })

            // Add ports source and layer
            map.current.addSource('ports', {
                type: 'geojson',
                data: getAllPortsGeoJSON(),
            })

            map.current.addLayer({
                id: 'ports-layer',
                type: 'symbol',
                source: 'ports',
                layout: {
                    'text-field': '⚓',
                    'text-size': 16,
                    'text-allow-overlap': true,
                },
            })

            // Add fort coverage source
            map.current.addSource('fort-coverage', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            })

            // Fort coverage fill
            map.current.addLayer({
                id: 'fort-coverage-fill',
                type: 'fill',
                source: 'fort-coverage',
                paint: {
                    'fill-color': '#3b82f6', // Blue
                    'fill-opacity': 0.1,
                }
            })

            // Fort coverage outline
            map.current.addLayer({
                id: 'fort-coverage-line',
                type: 'line',
                source: 'fort-coverage',
                paint: {
                    'line-color': '#3b82f6',
                    'line-width': 1,
                    'line-dasharray': [2, 2],
                    'line-opacity': 0.5
                }
            })

            // (Buildings are now handled by HTML Markers)

            // Add cities source and layer
            map.current.addSource('cities', {
                type: 'geojson',
                data: citiesData as FeatureCollection,
            })

            map.current.addLayer({
                id: 'cities-label',
                type: 'symbol',
                source: 'cities',
                minzoom: 4,
                filter: ['>', ['get', 'pop_max'], 1000000], // Only show cities > 1M pop
                layout: {
                    'text-field': ['get', 'name'],
                    'text-font': ['Open Sans Regular'],
                    'text-size': 10,
                    'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
                    'text-radial-offset': 0.5,
                    'text-justify': 'auto',
                },
                paint: {
                    'text-color': '#e2e8f0', // Slate 200
                    'text-halo-color': '#0f172a',
                    'text-halo-width': 1,
                }
            })

            // Add player label source (empty initially)
            map.current.addSource('player-label', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            })

            map.current.addLayer({
                id: 'player-label',
                type: 'symbol',
                source: 'player-label',
                layout: {
                    'text-field': ['get', 'name'],
                    'text-font': ['Open Sans Bold'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 2, 12, 10, 24],
                    'text-transform': 'uppercase',
                    'text-letter-spacing': 0.2,
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#f97316', // Orange halo
                    'text-halo-width': 2,
                }
            })

            // Add active claims source
            map.current.addSource('active-claims', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            })

            // Active claims fill (striped)
            map.current.addLayer({
                id: 'active-claims-fill',
                type: 'fill',
                source: 'active-claims',
                paint: {
                    'fill-pattern': 'striped-pattern',
                    'fill-opacity': 0.6
                }
            })

            // Active claims border
            map.current.addLayer({
                id: 'active-claims-border',
                type: 'line',
                source: 'active-claims',
                paint: {
                    'line-color': '#f97316', // Orange
                    'line-width': 2,
                    'line-dasharray': [2, 2]
                }
            })

            // Cursor for claims
            map.current.on('mousemove', 'active-claims-fill', () => {
                map.current!.getCanvas().style.cursor = 'pointer'
            })

            map.current.on('mouseleave', 'active-claims-fill', () => {
                map.current!.getCanvas().style.cursor = ''
            })

            // Initialize data layers immediately on load to prevent race conditions
            const state = useGameStore.getState()

            // 1. Active Claims
            if (state.activeClaims.length > 0) {
                const source = map.current.getSource('active-claims') as maplibregl.GeoJSONSource
                if (source) {
                    const features = state.activeClaims.map(claim => ({
                        ...claim.polygon,
                        properties: {
                            ...claim.polygon.properties,
                            id: claim.id
                        }
                    }))
                    source.setData({
                        type: 'FeatureCollection',
                        features: features as Feature[]
                    })
                    console.log('🏁 Initialized active claims:', features.length)
                }
            }

            // 2. Player Territory
            if (state.playerTerritories.length > 0) {
                const source = map.current.getSource('player-territory') as maplibregl.GeoJSONSource
                if (source) {
                    source.setData({
                        type: 'FeatureCollection',
                        features: state.playerTerritories,
                    })
                }

                // Player Label
                const labelSource = map.current.getSource('player-label') as maplibregl.GeoJSONSource
                if (labelSource) {
                    const combined = turf.featureCollection(state.playerTerritories)
                    try {
                        const center = turf.centerOfMass(combined)
                        labelSource.setData({
                            type: 'FeatureCollection',
                            features: [{
                                type: 'Feature',
                                geometry: center.geometry,
                                properties: { name: state.nation?.name || 'New Nation' }
                            }]
                        })
                    } catch (e) { /* ignore */ }
                }
            }

            // 3. Buildings
            if (state.nation?.buildings) {
                const source = map.current.getSource('buildings') as maplibregl.GeoJSONSource
                if (source) {
                    const features = state.nation.buildings.map(b => ({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: b.location },
                        properties: {
                            id: b.id,
                            type: b.type,
                            icon: b.type === 'FORT' ? '🏰' : b.type === 'TRAINING_CAMP' ? '⚔️' : b.type === 'UNIVERSITY' ? '🎓' : b.type === 'RESEARCH_LAB' ? '🔬' : b.type === 'TEMPLE' ? '⛩️' : b.type === 'FACTORY' ? '🏭' : b.type === 'MARKET' ? '🏪' : '🏥'
                        }
                    }))
                    source.setData({
                        type: 'FeatureCollection',
                        features: features as Feature[]
                    })
                }
            }

            // 4. Factions
            if (state.factions.length > 0) {
                const source = map.current.getSource('factions') as maplibregl.GeoJSONSource
                if (source) {
                    const features = state.factions.map(f => ({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: f.location },
                        properties: {
                            id: f.id,
                            name: f.name,
                            strength: f.strength
                        }
                    }))
                    source.setData({
                        type: 'FeatureCollection',
                        features: features as Feature[]
                    })
                }
            }
        })

        return () => {
            map.current?.remove()
        }
    }, [])

    // Update infrastructure layers when loaded
    useEffect(() => {
        if (!map.current || !map.current.isStyleLoaded() || !infrastructureLoaded) return

        const airportsSource = map.current.getSource('airports') as maplibregl.GeoJSONSource
        if (airportsSource) {
            airportsSource.setData(getAllAirportsGeoJSON())
            console.log('✈️ Updated airports layer')
        }

        const portsSource = map.current.getSource('ports') as maplibregl.GeoJSONSource
        if (portsSource) {
            portsSource.setData(getAllPortsGeoJSON())
            console.log('⚓ Updated ports layer')
        }
    }, [infrastructureLoaded]) // Empty dependency array - map should only initialize once

    // Update active claims display
    const activeClaims = useGameStore(state => state.activeClaims)

    useEffect(() => {
        if (!map.current) return

        const updateActiveClaimsLayer = () => {
            if (!map.current) return

            try {
                // Check if source exists - this is the best indicator if we are ready to update
                const source = map.current.getSource('active-claims') as maplibregl.GeoJSONSource

                if (source) {
                    console.log('🔄 Updating active claims layer. Count:', activeClaims.length)

                    const features = activeClaims.map(claim => ({
                        ...claim.polygon,
                        properties: {
                            ...claim.polygon.properties,
                            id: claim.id
                        }
                    }))

                    console.log('📍 Setting claim features:', features)
                    source.setData({
                        type: 'FeatureCollection',
                        features: features as Feature[]
                    })
                } else {
                    // Source missing. If map is not loaded, wait for load.
                    // If map IS loaded but source missing, we might have a race condition or error.
                    console.log('⏳ Active claims source missing. Map loaded:', map.current.loaded())

                    if (!map.current.loaded()) {
                        map.current.once('load', updateActiveClaimsLayer)
                    } else {
                        // Map loaded but source missing? Try waiting a bit or checking style
                        if (!map.current.isStyleLoaded()) {
                            map.current.once('style.load', updateActiveClaimsLayer)
                        } else {
                            console.warn('⚠️ Map loaded but active-claims source missing! This should not happen if init ran.')
                        }
                    }
                }
            } catch (e) {
                console.warn('⚠️ Error updating active claims:', e)
            }
        }

        // Always try to update immediately
        updateActiveClaimsLayer()

    }, [activeClaims])

    // Update player territory display when territories change
    useEffect(() => {
        if (!map.current) return

        const updateTerritoryLayer = () => {
            if (!map.current || !map.current.isStyleLoaded()) return
            const source = map.current.getSource('player-territory') as maplibregl.GeoJSONSource
            if (source) {
                console.log('🗺️ Updating territory display:', playerTerritories.length, 'polygons')
                source.setData({
                    type: 'FeatureCollection',
                    features: playerTerritories,
                })

                // Update player label
                const labelSource = map.current?.getSource('player-label') as maplibregl.GeoJSONSource
                if (labelSource && playerTerritories.length > 0) {
                    // Combine all territories to find center
                    const combined = turf.featureCollection(playerTerritories)
                    let center
                    try {
                        // Try to find center of mass of all territories
                        // If multiple polygons, we might want the largest one or the center of the bbox
                        // For now, let's use center of mass of the first one or the union if possible
                        // Simple approach: center of mass of the feature collection
                        center = turf.centerOfMass(combined)
                    } catch (e) {
                        // Ignore error
                    }

                    if (center) {
                        labelSource.setData({
                            type: 'FeatureCollection',
                            features: [{
                                type: 'Feature',
                                geometry: center.geometry,
                                properties: {
                                    name: nation?.name || 'New Nation'
                                }
                            }]
                        })
                    }
                }
            }
        }

        // Try to update immediately, or wait for map load
        if (map.current.loaded()) {
            updateTerritoryLayer()
        } else {
            map.current.once('load', updateTerritoryLayer)
        }

        // Also retry after a short delay to catch timing issues
        const retryTimeout = setTimeout(updateTerritoryLayer, 100)
        return () => clearTimeout(retryTimeout)
    }, [playerTerritories, nation])

    // Update buildings display
    // Manage Building Markers
    const buildingMarkers = useRef<maplibregl.Marker[]>([])

    useEffect(() => {
        if (!map.current) return

        // Clear existing markers
        buildingMarkers.current.forEach(marker => marker.remove())
        buildingMarkers.current = []

        const fortFeatures: Feature[] = []

        if (nation?.buildings) {
            nation.buildings.forEach(b => {
                // Create marker element
                const el = document.createElement('div')
                el.className = 'building-marker'
                el.style.fontSize = '24px'
                el.style.cursor = 'pointer'
                el.innerText = b.type === 'FORT' ? '🏰' : b.type === 'TRAINING_CAMP' ? '⚔️' : '🎓'

                // Add tooltip
                el.title = `${b.type.replace('_', ' ')}\nUpkeep: $${b.type === 'FORT' ? '50k' : b.type === 'TRAINING_CAMP' ? '20k' : '100k'}`

                // Create and add marker
                const marker = new maplibregl.Marker({
                    element: el,
                    anchor: 'bottom'
                })
                    .setLngLat(b.location as [number, number])
                    .addTo(map.current!)

                buildingMarkers.current.push(marker)

                // If Fort, add coverage circle
                if (b.type === 'FORT') {
                    const center = b.location as [number, number]
                    const circle = turf.circle(center, 500, { steps: 64, units: 'kilometers' })
                    fortFeatures.push(circle)
                }
            })
        }

        // Update fort coverage source
        const source = map.current.getSource('fort-coverage') as maplibregl.GeoJSONSource
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: fortFeatures
            })
        }

    }, [nation?.buildings]) // Only re-run when buildings change

    // (Removed old layer update logic)

    // Handle freeform draw completion for initial territory
    const onInitialDrawComplete = useCallback((polygon: Feature<Polygon>) => {
        if (useGameStore.getState().phase !== 'DRAWING') return
        handleInitialDraw({ features: [polygon] })
    }, [handleInitialDraw])

    // Handle freeform draw completion for expansion
    const onExpansionDrawComplete = useCallback((polygon: Feature<Polygon>) => {
        if (useGameStore.getState().phase !== 'EXPANSION') return
        handleExpansionDraw({ features: [polygon] })
    }, [handleExpansionDraw])

    // Local state for initial drawing activation
    const [isInitialDrawingActive, setIsInitialDrawingActive] = useState(false)

    // Initialize freeform drawing for DRAWING phase
    useEffect(() => {
        if (!map.current || phase !== 'DRAWING' || drawInitialized.current) return

        const initDraw = () => {
            if (!map.current) return

            // Only start if active
            if (!isInitialDrawingActive) {
                if (freeformDraw.current) {
                    freeformDraw.current.stop()
                }
                return
            }

            freeformDraw.current = initFreeformDraw(
                map.current,
                onInitialDrawComplete,
                { lineColor: '#f97316', fillColor: 'rgba(249, 115, 22, 0.3)' },
                {
                    onDrawStart: () => setIsDrawing(true),
                    onDrawEnd: () => setIsDrawing(false)
                }
            )
            freeformDraw.current.start()
            drawInitialized.current = true
            console.log('🖊️ Freeform drawing initialized for initial territory')
        }

        if (map.current.loaded()) {
            initDraw()
        } else {
            map.current.on('load', initDraw)
        }
    }, [phase, onInitialDrawComplete, isInitialDrawingActive, setIsDrawing])

    // Reset drawInitialized when active state changes to force re-init
    useEffect(() => {
        drawInitialized.current = false
    }, [isInitialDrawingActive])

    // Handle expansion mode - enable freeform drawing with red color
    useEffect(() => {
        if (!map.current || phase !== 'EXPANSION') return

        // Stop old freeform draw if exists
        if (freeformDraw.current) {
            freeformDraw.current.cleanup()
        }

        // Create new freeform draw for expansion (red)
        freeformDraw.current = initFreeformDraw(
            map.current,
            onExpansionDrawComplete,
            { lineColor: '#ef4444', fillColor: 'rgba(239, 68, 68, 0.4)' },
            {
                onDrawStart: () => setIsDrawing(true),
                onDrawEnd: () => setIsDrawing(false)
            }
        )
        freeformDraw.current.start()
        console.log('🖊️ Freeform drawing enabled for expansion')

        return () => {
            if (freeformDraw.current) {
                freeformDraw.current.stop()
            }
        }
    }, [phase, onExpansionDrawComplete])

    // Stop freeform drawing when entering RESULTS phase
    useEffect(() => {
        if (phase === 'RESULTS' && freeformDraw.current) {
            freeformDraw.current.stop()
            console.log('🛑 Freeform drawing stopped')
        }
    }, [phase])

    return (
        <>
            <div ref={mapContainer} className="h-full w-full" />

            {/* Initial Draw Button */}
            {phase === 'DRAWING' && !isInitialDrawingActive && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900/80 backdrop-blur-md p-8 rounded-2xl border border-orange-500/30 shadow-2xl text-center pointer-events-auto max-w-md mx-4">
                        <h1 className="text-4xl font-bold text-white mb-4">Welcome to GeoDraw</h1>
                        <p className="text-gray-300 mb-8 text-lg">
                            Explore the map, then claim your starting territory to begin your nation's journey.
                        </p>
                        <button
                            onClick={() => setIsInitialDrawingActive(true)}
                            className="px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold text-xl rounded-xl shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-3 mx-auto"
                        >
                            <span>✏️</span>
                            <span>Draw Territory</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Cancel Initial Draw Button */}
            {phase === 'DRAWING' && isInitialDrawingActive && (
                <button
                    onClick={() => setIsInitialDrawingActive(false)}
                    className="absolute top-4 right-4 z-20 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg transition-all flex items-center gap-2"
                >
                    <span>✕</span>
                    <span>Cancel Drawing</span>
                </button>
            )}

            {/* Active Battles */}
            {map.current && activeBattles.map(battle => (
                <BattleMarker key={battle.id} battle={battle} map={map.current!} />
            ))}

            {/* AI vs AI Wars */}
            {/* AI vs AI Wars */}
            {map.current && aiWars.map(war => (
                <WarMapMarker
                    key={war.id}
                    war={war}
                    map={map.current!}
                    aiTerritories={aiTerritories}
                    onClick={() => setSelectedWarId(war.id)}
                />
            ))}

            {/* Claim Territory Button - shows in RESULTS phase */}
            {phase === 'RESULTS' && nation && (
                <button
                    onClick={() => setPhase('EXPANSION')}
                    className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-lg shadow-lg transition-all flex items-center gap-2 hover:scale-105"
                >
                    <span>🏴</span>
                    <span>Claim Territory</span>
                </button>
            )}

            {/* Cancel Expansion Button */}
            {phase === 'EXPANSION' && (
                <button
                    onClick={() => setPhase('RESULTS')}
                    className="absolute top-4 right-4 z-20 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg transition-all"
                >
                    ✕ Cancel
                </button>
            )}

            {/* War Detail Modal */}
            {selectedWarId && (
                <WarDetailModal
                    warId={selectedWarId}
                    onClose={() => setSelectedWarId(null)}
                />
            )}
        </>
    )
}
