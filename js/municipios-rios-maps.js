/**
 * Configuración de mapas para el instrumento MUNICIPIOS Y RIOS
 */

const MUNICIPIOS_RIOS_MAPS = [
    {
        name: 'Figuras 2.15 a 2.22. Municipios con localidades sin electrificar',
        description: 'Visualización de municipios con localidades sin electrificar y ríos',
        sheetUrl: null, // Sin hoja de datos por el momento
        baseMap: 'carto-voyager', // Mapa base Voyager (Colores)
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/municipios_sin_electrificar.geojson', // Placeholder URL, update if needed
        geojsonUrlType: 'municipios_sin_electrificar', // Custom type for specific logic
        additionalLayers: [
            // Rivers GeoJSONs will be added here later
        ],
        // Capas de datos para análisis espacial (si son necesarias)
        dataLayers: [],
        center: [23.6345, -102.5528], // Centro de México
        zoom: 5,
        minZoom: 4,
        maxZoom: 18
    }
];

// Hacer disponible globalmente
window.MUNICIPIOS_RIOS_MAPS = MUNICIPIOS_RIOS_MAPS;
