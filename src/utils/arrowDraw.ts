/**
 * Arrow drawing utility for Mapbox
 * Enables drawing directed arrows for war planning
 */

import type { Map, GeoJSONSource, MapMouseEvent } from 'maplibre-gl'
import type { Feature, LineString, Position, FeatureCollection } from 'geojson'
import * as turf from '@turf/turf'

interface ArrowDrawState {
    isDrawing: boolean
    currentPath: Position[]
    arrows: Feature<LineString>[]
}

const SOURCE_ID = 'arrow-draw'
const LAYER_LINE = 'arrow-draw-line'
// const LAYER_HEAD = 'arrow-draw-head'

/**
 * Initialize arrow drawing on a map
 */
export function initArrowDraw(
    map: Map,
    style: { color: string; width: number } = { color: '#ef4444', width: 4 },
    callbacks?: { onDrawStart?: () => void; onDrawEnd?: (features: FeatureCollection<LineString>) => void }
): { cleanup: () => void; start: () => void; stop: () => void; clear: () => void; getArrows: () => FeatureCollection<LineString>; setType: (type: string) => void } {

    const state: ArrowDrawState = {
        isDrawing: false,
        currentPath: [],
        arrows: []
    }

    let isEnabled = false
    let currentType = 'OFFENSE' // Default

    // Add source and layers
    const ensureSourceExists = () => {
        if (!map.getSource(SOURCE_ID)) {
            map.addSource(SOURCE_ID, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            })
        }

        if (!map.getLayer(LAYER_LINE)) {
            map.addLayer({
                id: LAYER_LINE,
                type: 'line',
                source: SOURCE_ID,
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': [
                        'match',
                        ['get', 'type'],
                        'OFFENSE', '#ef4444', // Red
                        'DEFENSE', '#3b82f6', // Blue
                        'SUPPLY', '#eab308',  // Yellow
                        '#ef4444' // Default
                    ],
                    'line-width': style.width,
                    'line-opacity': 0.8
                }
            })
        }
    }

    // Update the drawing on the map
    const updateDrawing = () => {
        if (!map || !map.getStyle()) return

        let source: GeoJSONSource | undefined
        try {
            source = map.getSource(SOURCE_ID) as GeoJSONSource
        } catch (e) { return }

        if (!source) return

        const features: Feature[] = [...state.arrows]

        // Add current drawing (preview)
        if (state.currentPath.length >= 2) {
            features.push({
                type: 'Feature',
                properties: { type: currentType },
                geometry: {
                    type: 'LineString',
                    coordinates: state.currentPath
                }
            })
        }

        source.setData({ type: 'FeatureCollection', features })
    }

    const onMouseDown = (e: MapMouseEvent) => {
        if (!isEnabled) return
        map.dragPan.disable()
        state.isDrawing = true
        state.currentPath = [[e.lngLat.lng, e.lngLat.lat]]
        callbacks?.onDrawStart?.()
    }

    const onMouseMove = (e: MapMouseEvent) => {
        if (!state.isDrawing || !isEnabled || state.currentPath.length === 0) return

        const lastPoint = state.currentPath[state.currentPath.length - 1]
        // Filter small movements
        const dist = Math.sqrt(
            Math.pow(e.lngLat.lng - lastPoint[0], 2) +
            Math.pow(e.lngLat.lat - lastPoint[1], 2)
        )

        if (dist > 0.0005) {
            state.currentPath.push([e.lngLat.lng, e.lngLat.lat])
            updateDrawing()
        }
    }

    const onMouseUp = () => {
        if (!state.isDrawing || !isEnabled) return

        map.dragPan.enable()
        state.isDrawing = false

        if (state.currentPath.length >= 2) {
            // Simplify line
            const line = turf.lineString(state.currentPath)
            const simplified = turf.simplify(line, { tolerance: 0.005, highQuality: true })

            // Add properties
            simplified.properties = {
                id: `arrow-${Date.now()}`,
                type: currentType,
                createdAt: Date.now()
            }

            state.arrows.push(simplified as Feature<LineString>)
            console.log('🏹 Arrow drawn', simplified)
        }

        state.currentPath = []
        updateDrawing()

        callbacks?.onDrawEnd?.({
            type: 'FeatureCollection',
            features: state.arrows
        })
    }

    const start = () => {
        ensureSourceExists()
        isEnabled = true
        map.getCanvas().style.cursor = 'crosshair'
    }

    const stop = () => {
        isEnabled = false
        state.isDrawing = false
        map.dragPan.enable()
        map.getCanvas().style.cursor = ''
    }

    const clear = () => {
        state.arrows = []
        state.currentPath = []
        updateDrawing()
    }

    const setType = (type: string) => {
        currentType = type
    }

    const getArrows = () => {
        return {
            type: 'FeatureCollection',
            features: state.arrows
        } as FeatureCollection<LineString>
    }

    // Attach listeners
    map.on('mousedown', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)

    const cleanup = () => {
        stop()
        map.off('mousedown', onMouseDown)
        map.off('mousemove', onMouseMove)
        map.off('mouseup', onMouseUp)
        if (map.getLayer(LAYER_LINE)) map.removeLayer(LAYER_LINE)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }

    return { cleanup, start, stop, clear, getArrows, setType }
}
