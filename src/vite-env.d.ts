/// <reference types="vite/client" />

// Allow importing GeoJSON files
declare module '*.geojson' {
    const value: import('geojson').FeatureCollection
    export default value
}


