/// <reference types="vite/client" />

// Allow importing GeoJSON files
declare module '*.geojson' {
    const value: import('geojson').FeatureCollection
    export default value
}


interface ImportMetaEnv {
    readonly VITE_MAPBOX_TOKEN: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

// Type declarations for mapbox-gl-draw
declare module '@mapbox/mapbox-gl-draw' {
    import type { IControl, Map } from 'mapbox-gl'
    import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'

    interface DrawOptions {
        displayControlsDefault?: boolean
        controls?: {
            point?: boolean
            line_string?: boolean
            polygon?: boolean
            trash?: boolean
            combine_features?: boolean
            uncombine_features?: boolean
        }
        defaultMode?: string
        styles?: object[]
    }

    class MapboxDraw implements IControl {
        constructor(options?: DrawOptions)
        onAdd(map: Map): HTMLElement
        onRemove(): void
        add(geojson: Feature | FeatureCollection): string[]
        get(featureId: string): Feature | undefined
        getAll(): FeatureCollection
        delete(ids: string | string[]): MapboxDraw
        deleteAll(): MapboxDraw
        set(featureCollection: FeatureCollection): string[]
        trash(): MapboxDraw
        getMode(): string
        changeMode(mode: string, options?: object): MapboxDraw
        setFeatureProperty(
            featureId: string,
            property: string,
            value: unknown
        ): MapboxDraw
    }

    export = MapboxDraw
}
