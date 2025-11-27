/**
 * Configuración de mapas para ELECTRICIDAD
 */

const ELECTRICIDAD_MAPS = [
    {
        name: 'Permisos de Generación de Electricidad',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
        geojsonUrlType: 'regions',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuFBY3k10223uLmvRWSycRyAea6NjtKVLTHuTnpFMQZgWyxoCqwbXNNjTSY9nTleUoxKDtuuP_bbtn/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/17k0jfGdINb-i6IPREu6wxkOdWdTQPAXqOaSm3MN5KmE/edit?usp=sharing',
        useClusters: true,
        enableSearch: true,
        descriptionTitle: 'Permisos de Generación de Electricidad',
        description: 'Mapa de permisos de generación de electricidad en México. Los marcadores están agrupados para facilitar la visualización. Haga clic en un grupo para ampliar o en un marcador individual para ver los detalles del permiso.'
    }
];

// Exportar para uso en map-config.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ELECTRICIDAD_MAPS;
}
