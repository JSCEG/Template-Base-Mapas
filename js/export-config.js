/**
 * Configuración de exportación para mapas
 */
class ExportConfiguration {
    constructor(options = {}) {
        this.format = options.format || 'png';
        this.size = {
            preset: options.size?.preset || 'A4',
            width: options.size?.width || 2480,
            height: options.size?.height || 3508,
            dpi: options.size?.dpi || 300
        };
        this.elements = {
            includeScale: options.elements?.includeScale !== false,
            includeLegend: options.elements?.includeLegend !== false,
            includeAttribution: options.elements?.includeAttribution !== false,
            includeTimestamp: options.elements?.includeTimestamp !== false,
            includeTitle: options.elements?.includeTitle !== false
        };
        this.metadata = {
            title: options.metadata?.title || 'Mapa SNIEn',
            author: options.metadata?.author || 'SENER',
            subject: options.metadata?.subject || 'Mapa del Sistema Nacional de Información Energética',
            creator: options.metadata?.creator || 'SNIEn - SENER'
        };
    }
}