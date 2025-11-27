/**
 * Configuración de mapas para el instrumento PRESAS
 */

const PRESAS_MAPS = [
    {
        name: 'Presas y Sitios Ramsar',
        description: 'Visualización de presas y sitios Ramsar en México',
        sheetUrl: null, // Sin hoja de datos por el momento
        baseMap: 'carto-voyager', // Mapa base Voyager (Colores)
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/presas.geojson',
        geojsonUrlType: 'presas',
        additionalLayers: [
            {
                url: 'https://cdn.sassoapps.com/Gabvy/ramsar.geojson',
                type: 'ramsar'
            },
            {
                url: 'https://cdn.sassoapps.com/Mapas/ANP2025.geojson',
                type: 'anp'
            },
            {
                url: 'https://cdn.sassoapps.com/Mapas/areas_destinadas_voluntariamentea_la_conservaci%C3%B3n.geojson',
                type: 'advc'
            },
            {
                url: 'https://cdn.sassoapps.com/Mapas/Electricidad/usumacinta.geojson',
                type: 'usumacinta'
            }
        ],
        // Capas de datos para análisis espacial
        dataLayers: [
            {
                url: 'https://cdn.sassoapps.com/Gabvy/loc_indigenas_datos.geojson',
                type: 'localidades_indigenas',
                name: 'Localidades Indígenas',
                geometryType: 'Point',
                visible: false
            },
            {
                url: 'https://cdn.sassoapps.com/Gabvy/ramsar.geojson',
                type: 'ramsar_analysis',
                name: 'Sitios Ramsar',
                geometryType: 'Polygon',
                visible: false
            },
            {
                url: 'https://cdn.sassoapps.com/Mapas/Electricidad/usumacinta.geojson',
                type: 'usumacinta_analysis',
                name: 'Río Usumacinta',
                geometryType: 'LineString',
                visible: false
            },
            {
                url: 'https://cdn.sassoapps.com/Mapas/ANP2025.geojson',
                type: 'anp_analysis',
                name: 'Áreas Naturales Protegidas',
                geometryType: 'Polygon',
                visible: false
            },
            {
                url: 'https://cdn.sassoapps.com/Mapas/areas_destinadas_voluntariamentea_la_conservaci%C3%B3n.geojson',
                type: 'advc_analysis',
                name: 'Áreas Destinadas Voluntariamente a la Conservación',
                geometryType: 'Polygon',
                visible: false
            }
        ],
        center: [23.6345, -102.5528], // Centro de México
        zoom: 5,
        minZoom: 4,
        maxZoom: 18
    }
];

// Hacer disponible globalmente
window.PRESAS_MAPS = PRESAS_MAPS;
