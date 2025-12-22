/**
 * Freeform drawing utility for Mapbox
 * Enables pen-style drawing by dragging the mouse
 */

import type { Map, GeoJSONSource, MapMouseEvent } from 'maplibre-gl'
import type { Feature, Polygon, Position } from 'geojson'

interface FreeformDrawState {
    isDrawing: boolean
    points: Position[]
}

const SOURCE_ID = 'freeform-draw'
const LINE_LAYER_ID = 'freeform-draw-line'
const FILL_LAYER_ID = 'freeform-draw-fill'

/**
 * Initialize freeform drawing on a map
 */
export function initFreeformDraw(
    map: Map,
    onComplete: (polygon: Feature<Polygon>) => void,
    style: { lineColor: string; fillColor: string } = { lineColor: '#f97316', fillColor: 'rgba(249, 115, 22, 0.3)' },
    callbacks?: { onDrawStart?: () => void; onDrawEnd?: () => void }
): { cleanup: () => void; start: () => void; stop: () => void } {

    const state: FreeformDrawState = {
        isDrawing: false,
        points: [],
    }

    let isEnabled = false

    // Add source and layers
    const ensureSourceExists = () => {
        if (!map.getSource(SOURCE_ID)) {
            map.addSource(SOURCE_ID, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            })
        }

        if (!map.getLayer(LINE_LAYER_ID)) {
            map.addLayer({
                id: LINE_LAYER_ID,
                type: 'line',
                source: SOURCE_ID,
                paint: {
                    'line-color': style.lineColor,
                    'line-width': 3,
                }
            })
        }

        if (!map.getLayer(FILL_LAYER_ID)) {
            map.addLayer({
                id: FILL_LAYER_ID,
                type: 'fill',
                source: SOURCE_ID,
                paint: {
                    'fill-color': style.fillColor,
                    'fill-opacity': 0.4,
                }
            }, LINE_LAYER_ID) // Insert below line layer
        }
    }

    // Update the drawing on the map
    const updateDrawing = () => {
        // Safety check: if map is destroyed or style not loaded, don't try to update
        if (!map || !map.getStyle()) return

        let source: GeoJSONSource | undefined
        try {
            source = map.getSource(SOURCE_ID) as GeoJSONSource
        } catch (e) {
            // Ignore error if source cannot be retrieved
            return
        }

        if (!source) return

        if (state.points.length < 2) {
            source.setData({ type: 'FeatureCollection', features: [] })
            return
        }

        // Create a closed polygon for preview
        const closedPoints = [...state.points, state.points[0]]

        const feature: Feature<Polygon> = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [closedPoints]
            }
        }

        source.setData({ type: 'FeatureCollection', features: [feature] })
    }

    // Clear the drawing
    const clearDrawing = () => {
        state.points = []
        updateDrawing()
    }

    // Mouse handlers
    const onMouseDown = (e: MapMouseEvent) => {
        if (!isEnabled) return

        // Prevent map panning
        map.dragPan.disable()

        state.isDrawing = true
        state.points = [[e.lngLat.lng, e.lngLat.lat]]

        map.getCanvas().style.cursor = 'crosshair'
        console.log('🖊️ Freeform draw started')
        callbacks?.onDrawStart?.()
    }

    const onMouseMove = (e: MapMouseEvent) => {
        if (!state.isDrawing || !isEnabled) return

        // Add point (with some distance threshold to avoid too many points)
        const lastPoint = state.points[state.points.length - 1]
        const dx = e.lngLat.lng - lastPoint[0]
        const dy = e.lngLat.lat - lastPoint[1]
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Only add if moved enough (prevents too many points)
        if (distance > 0.001) { // ~100m threshold
            state.points.push([e.lngLat.lng, e.lngLat.lat])
            updateDrawing()
        }
    }

    const onMouseUp = () => {
        if (!state.isDrawing || !isEnabled) return

        map.dragPan.enable()
        state.isDrawing = false
        map.getCanvas().style.cursor = ''
        callbacks?.onDrawEnd?.()

        console.log('✅ Freeform draw complete:', state.points.length, 'points')

        // Need at least 3 points for a polygon
        if (state.points.length >= 3) {
            const closedPoints = [...state.points, state.points[0]]

            const polygon: Feature<Polygon> = {
                type: 'Feature',
                id: `freeform-${Date.now()}`,
                properties: {},
                geometry: {
                    type: 'Polygon',
                    coordinates: [closedPoints]
                }
            }

            onComplete(polygon)
        }

        clearDrawing()
    }

    // Start freeform drawing mode
    const start = () => {
        ensureSourceExists()
        isEnabled = true
        map.getCanvas().style.cursor = 'crosshair'
        console.log('🎨 Freeform drawing enabled')
    }

    // Stop freeform drawing mode
    const stop = () => {
        isEnabled = false
        state.isDrawing = false
        map.dragPan.enable()
        map.getCanvas().style.cursor = ''
        clearDrawing()
        console.log('🛑 Freeform drawing disabled')
    }

    // Attach event listeners
    map.on('mousedown', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)

    // Cleanup function
    const cleanup = () => {
        stop()
        map.off('mousedown', onMouseDown)
        map.off('mousemove', onMouseMove)
        map.off('mouseup', onMouseUp)

        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID)
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }

    return { cleanup, start, stop }
}
