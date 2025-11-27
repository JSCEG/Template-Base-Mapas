/**
 * Configuración de mapas para PLATEASE
 * Planeación de la Transición Energética
 */

const PLATEASE_MAPS = [
    {
        name: 'En construcción',
        underConstruction: true
    }
];

// Exportar para uso en map-config.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PLATEASE_MAPS;
}
