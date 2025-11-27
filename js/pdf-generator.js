/**
 * Generador de archivos PDF
 */
class PDFGenerator {
    constructor() {
        this.jsPDF = window.jspdf?.jsPDF || window.jsPDF;
        if (!this.jsPDF) {
            throw new Error('jsPDF no está disponible');
        }

        // Definir tamaños de página estándar en mm
        this.pageSizes = {
            'A4': { width: 210, height: 297 },
            'A3': { width: 297, height: 420 },
            'Letter': { width: 216, height: 279 }
        };
    }

    /**
     * Crea un canvas limpio copiando los datos píxel por píxel para evitar problemas de CORS
     * @param {HTMLCanvasElement} sourceCanvas - Canvas fuente que puede estar "tainted"
     * @returns {HTMLCanvasElement} Canvas limpio sin restricciones CORS
     */
    createCleanCanvas(sourceCanvas) {
        try {
            console.log('Creando canvas limpio para evitar problemas CORS...');

            // Crear nuevo canvas con las mismas dimensiones
            const cleanCanvas = document.createElement('canvas');
            cleanCanvas.width = sourceCanvas.width;
            cleanCanvas.height = sourceCanvas.height;

            const cleanCtx = cleanCanvas.getContext('2d');
            const sourceCtx = sourceCanvas.getContext('2d');

            try {
                // Intentar copiar usando getImageData (método más seguro)
                const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
                cleanCtx.putImageData(imageData, 0, 0);

                console.log('Canvas limpio creado usando getImageData');
                return cleanCanvas;

            } catch (getImageDataError) {
                console.warn('getImageData falló, intentando drawImage:', getImageDataError);

                try {
                    // Fallback: intentar drawImage
                    cleanCtx.drawImage(sourceCanvas, 0, 0);

                    console.log('Canvas limpio creado usando drawImage');
                    return cleanCanvas;

                } catch (drawImageError) {
                    console.warn('drawImage también falló:', drawImageError);

                    // Último recurso: crear canvas básico con información
                    cleanCtx.fillStyle = '#ffffff';
                    cleanCtx.fillRect(0, 0, cleanCanvas.width, cleanCanvas.height);

                    cleanCtx.fillStyle = '#333333';
                    cleanCtx.font = '20px Arial';
                    cleanCtx.textAlign = 'center';
                    cleanCtx.fillText('Mapa SNIEn', cleanCanvas.width / 2, cleanCanvas.height / 2);
                    cleanCtx.fillText('(Exportación de emergencia)', cleanCanvas.width / 2, cleanCanvas.height / 2 + 30);

                    console.log('Canvas básico creado como último recurso');
                    return cleanCanvas;
                }
            }

        } catch (error) {
            console.error('Error creando canvas limpio:', error);

            // Canvas de emergencia
            const emergencyCanvas = document.createElement('canvas');
            emergencyCanvas.width = 800;
            emergencyCanvas.height = 600;
            const emergencyCtx = emergencyCanvas.getContext('2d');

            emergencyCtx.fillStyle = '#ffffff';
            emergencyCtx.fillRect(0, 0, 800, 600);

            emergencyCtx.fillStyle = '#333333';
            emergencyCtx.font = '24px Arial';
            emergencyCtx.textAlign = 'center';
            emergencyCtx.fillText('Error en exportación', 400, 280);
            emergencyCtx.fillText('Mapa SNIEn', 400, 320);

            return emergencyCanvas;
        }
    }

    /**
     * Genera un PDF a partir de un canvas
     * @param {HTMLCanvasElement} canvas - Canvas con la imagen del mapa
     * @param {ExportConfiguration} config - Configuración de exportación
     * @param {Object} metadata - Metadatos del mapa
     * @returns {Blob} Archivo PDF generado
     */
    async generatePDF(canvas, config, metadata) {
        try {
            console.log('Generando PDF con configuración:', config);

            // Determinar formato y orientación del PDF
            const pdfConfig = this.determinePDFConfiguration(config);
            console.log('Configuración PDF determinada:', pdfConfig);

            // Crear documento PDF
            const pdf = new this.jsPDF({
                orientation: pdfConfig.orientation,
                unit: 'mm',
                format: pdfConfig.format
            });

            // Añadir metadatos del documento
            this.addDocumentMetadata(pdf, config, metadata);

            // Crear canvas limpio para evitar problemas de CORS
            const cleanCanvas = this.createCleanCanvas(canvas);

            // Convertir canvas limpio a imagen de alta calidad
            const imgData = cleanCanvas.toDataURL('image/png', 1.0);
            console.log('Imagen convertida a base64, tamaño:', imgData.length, 'caracteres');

            // Calcular dimensiones y posicionamiento
            const layout = this.calculateLayout(pdf, canvas, config);
            console.log('Layout calculado:', layout);

            // Añadir imagen principal al PDF
            pdf.addImage(
                imgData,
                'PNG',
                layout.imageX,
                layout.imageY,
                layout.imageWidth,
                layout.imageHeight,
                undefined,
                'NONE' // Usar compresión sin pérdidas para máxima calidad
            );

            // Añadir información contextual si está habilitada
            if (this.shouldIncludeContextualInfo(config)) {
                this.addContextualInfo(pdf, config, metadata, layout);
            }

            // Generar y retornar el blob del PDF
            const pdfBlob = pdf.output('blob');
            console.log('PDF generado exitosamente, tamaño:', pdfBlob.size, 'bytes');

            return pdfBlob;
        } catch (error) {
            console.error('Error detallado en generatePDF:', error);
            throw new Error('Error generando PDF: ' + error.message);
        }
    }

    /**
     * Determina la configuración del PDF basada en el tamaño especificado
     * @param {ExportConfiguration} config - Configuración de exportación
     * @returns {Object} Configuración del PDF (formato y orientación)
     */
    determinePDFConfiguration(config) {
        const preset = config.size.preset;

        // Para tamaños personalizados
        if (preset === 'custom') {
            const width = config.size.width * 0.264583; // Convertir píxeles a mm (96 DPI)
            const height = config.size.height * 0.264583;

            return {
                format: [width, height],
                orientation: width > height ? 'landscape' : 'portrait'
            };
        }

        // Para tamaños estándar
        if (this.pageSizes[preset]) {
            const size = this.pageSizes[preset];
            return {
                format: [size.width, size.height],
                orientation: 'portrait' // Por defecto portrait, se puede cambiar según necesidades
            };
        }

        // Fallback a A4 si no se reconoce el tamaño
        console.warn('Tamaño de página no reconocido:', preset, '- usando A4 por defecto');
        return {
            format: 'a4',
            orientation: 'portrait'
        };
    }

    /**
     * Añade metadatos al documento PDF
     * @param {Object} pdf - Instancia de jsPDF
     * @param {ExportConfiguration} config - Configuración de exportación
     * @param {Object} metadata - Metadatos del mapa
     */
    addDocumentMetadata(pdf, config, metadata) {
        const currentDate = new Date();

        pdf.setProperties({
            title: config.metadata.title || 'Mapa SNIEn',
            subject: config.metadata.subject || 'Mapa del Sistema Nacional de Información Energética',
            author: config.metadata.author || 'SENER',
            creator: config.metadata.creator || 'SNIEn - SENER',
            keywords: 'SNIEn, SENER, Mapa, Energía, México',
            creationDate: currentDate,
            modDate: currentDate
        });

        console.log('Metadatos del documento añadidos');
    }

    /**
     * Calcula el layout y dimensiones para la imagen en el PDF
     * @param {Object} pdf - Instancia de jsPDF
     * @param {HTMLCanvasElement} canvas - Canvas con la imagen
     * @param {ExportConfiguration} config - Configuración de exportación
     * @returns {Object} Información del layout
     */
    calculateLayout(pdf, canvas, config) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15; // Margen en mm

        // Área disponible para la imagen
        const availableWidth = pageWidth - (margin * 2);
        const availableHeight = pageHeight - (margin * 2);

        // Reservar espacio para información contextual si es necesario
        const contextualInfoHeight = this.shouldIncludeContextualInfo(config) ? 25 : 0;
        const imageAreaHeight = availableHeight - contextualInfoHeight;

        // Calcular dimensiones manteniendo proporción
        const canvasRatio = canvas.width / canvas.height;
        const availableRatio = availableWidth / imageAreaHeight;

        let imageWidth, imageHeight;

        if (canvasRatio > availableRatio) {
            // La imagen es más ancha, ajustar por ancho
            imageWidth = availableWidth;
            imageHeight = availableWidth / canvasRatio;
        } else {
            // La imagen es más alta, ajustar por alto
            imageHeight = imageAreaHeight;
            imageWidth = imageAreaHeight * canvasRatio;
        }

        // Centrar la imagen
        const imageX = margin + (availableWidth - imageWidth) / 2;
        const imageY = margin;

        return {
            pageWidth,
            pageHeight,
            margin,
            imageX,
            imageY,
            imageWidth,
            imageHeight,
            availableWidth,
            contextualInfoHeight,
            contextualInfoY: imageY + imageHeight + 10
        };
    }

    /**
     * Determina si se debe incluir información contextual
     * @param {ExportConfiguration} config - Configuración de exportación
     * @returns {boolean} True si se debe incluir información contextual
     */
    shouldIncludeContextualInfo(config) {
        return config.elements.includeTitle ||
            config.elements.includeTimestamp ||
            config.elements.includeAttribution ||
            config.elements.includeScale;
    }

    /**
     * Añade información contextual al PDF
     * @param {Object} pdf - Instancia de jsPDF
     * @param {ExportConfiguration} config - Configuración de exportación
     * @param {Object} metadata - Metadatos del mapa
     * @param {Object} layout - Información del layout
     */
    addContextualInfo(pdf, config, metadata, layout) {
        let currentY = layout.contextualInfoY;
        const lineHeight = 4;
        const sectionSpacing = 2;

        // Configurar estilo del texto principal
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);

        // Título del mapa
        if (config.elements.includeTitle && config.metadata.title) {
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text(config.metadata.title, layout.margin, currentY);
            currentY += lineHeight + sectionSpacing;
            pdf.setFont(undefined, 'normal');
            pdf.setFontSize(10);
        }

        // Información de generación y fecha
        if (config.elements.includeTimestamp) {
            const timestamp = metadata.timestamp ?
                metadata.timestamp.toLocaleString('es-MX', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                }) :
                new Date().toLocaleString('es-MX');

            pdf.text(`Fecha de generación: ${timestamp}`, layout.margin, currentY);
            currentY += lineHeight;

            // Información de última actualización de datos
            if (metadata.lastDataUpdate && metadata.lastDataUpdate !== 'No disponible') {
                pdf.text(`Última actualización de datos: ${metadata.lastDataUpdate}`, layout.margin, currentY);
                currentY += lineHeight;
            }

            currentY += sectionSpacing;
        }

        // Información del mapa base y configuración
        if (metadata.baseLayer) {
            pdf.text(`Mapa base: ${metadata.baseLayer}`, layout.margin, currentY);
            currentY += lineHeight;

            // Nivel de zoom y coordenadas del centro
            pdf.text(`Nivel de zoom: ${metadata.zoomLevel}`, layout.margin, currentY);
            currentY += lineHeight;

            pdf.text(`Centro: ${metadata.center.lat}°, ${metadata.center.lng}°`, layout.margin, currentY);
            currentY += lineHeight + sectionSpacing;
        }

        // Información de selecciones activas
        if (metadata.selectedInstrument && metadata.selectedInstrument !== 'Ninguno seleccionado') {
            pdf.text(`Instrumento seleccionado:`, layout.margin, currentY);
            currentY += lineHeight;

            // Usar texto más pequeño para el nombre completo del instrumento
            pdf.setFontSize(9);
            const instrumentLines = pdf.splitTextToSize(metadata.selectedInstrument, layout.availableWidth - 10);
            pdf.text(instrumentLines, layout.margin + 5, currentY);
            currentY += lineHeight * instrumentLines.length;
            pdf.setFontSize(10);
        }

        if (metadata.selectedPlan && metadata.selectedPlan !== 'Ninguno seleccionado') {
            pdf.text(`Plan complementario seleccionado:`, layout.margin, currentY);
            currentY += lineHeight;

            // Usar texto más pequeño para el nombre completo del plan
            pdf.setFontSize(9);
            const planLines = pdf.splitTextToSize(metadata.selectedPlan, layout.availableWidth - 10);
            pdf.text(planLines, layout.margin + 5, currentY);
            currentY += lineHeight * planLines.length;
            pdf.setFontSize(10);
            currentY += sectionSpacing;
        }

        // Información de marcadores si hay elementos visibles
        if (metadata.markersVisible > 0) {
            pdf.text(`Elementos visibles en el mapa: ${metadata.markersVisible}`, layout.margin, currentY);
            currentY += lineHeight + sectionSpacing;
        }

        // Atribuciones y fuentes de datos
        if (config.elements.includeAttribution) {
            currentY += sectionSpacing;
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);

            // Fuente principal
            pdf.text(`Fuente de datos: ${metadata.dataSource}`, layout.margin, currentY);
            currentY += lineHeight - 1;

            // Sistema y organización
            pdf.text(`Sistema: ${metadata.system}`, layout.margin, currentY);
            currentY += lineHeight - 1;

            pdf.text(`Organización: ${metadata.organization}`, layout.margin, currentY);
            currentY += lineHeight - 1;

            // Atribución cartográfica
            if (metadata.baseLayerAttribution) {
                pdf.text(`Datos cartográficos: ${metadata.baseLayerAttribution}`, layout.margin, currentY);
                currentY += lineHeight - 1;
            }

            // Información adicional
            pdf.text('Generado con tecnología web abierta y estándares de datos abiertos', layout.margin, currentY);
        }

        console.log('Información contextual completa añadida al PDF');
    }
}