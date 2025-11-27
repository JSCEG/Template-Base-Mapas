/**
 * Configuración de mapas para PROSENER
 * Programa Sectorial de Energía
 */

const PROSENER_MAPS = [
    {
        name: 'En construcción',
        underConstruction: true
    }
];

// Exportar para uso en map-config.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PROSENER_MAPS;
}
