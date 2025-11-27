/**
 * Módulo principal de exportación de mapas
 */
class MapExporter {
    constructor(map, options = {}) {
        this.map = map;
        this.options = {
            defaultFormat: 'png',
            defaultSize: 'A4',
            defaultDPI: 300,
            includeMetadata: true,
            ...options
        };

        this.canvasCapture = new CanvasCapture(map);
        this.pdfGenerator = new PDFGenerator();
        this.pngProcessor = new PNGProcessor();
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
     * Exporta el mapa a formato PDF
     * @param {Object} customOptions - Opciones personalizadas de exportación
     * @returns {Promise<boolean>} True si la exportación fue exitosa
     */
    async exportToPDF(customOptions = {}) {
        try {
            const config = new ExportConfiguration({
                format: 'pdf',
                size: { preset: this.options.defaultSize, dpi: this.options.defaultDPI },
                ...customOptions
            });

            console.log('Iniciando exportación PDF con configuración:', config);

            // Capturar el mapa
            const canvas = await this.canvasCapture.captureMap(config);
            console.log('Canvas capturado exitosamente:', canvas.width + 'x' + canvas.height);

            // Obtener metadatos completos
            const metadata = this.canvasCapture.getMapMetadata();
            console.log('Metadatos obtenidos:', metadata);

            // Generar PDF
            const pdfBlob = await this.pdfGenerator.generatePDF(canvas, config, metadata);
            console.log('PDF generado exitosamente, tamaño:', pdfBlob.size, 'bytes');

            // Generar nombre de archivo descriptivo
            const filename = this.generateFileName('pdf', metadata.timestamp, metadata);
            console.log('Nombre de archivo generado:', filename);

            // Descargar archivo
            const downloadSuccess = await this.downloadFile(pdfBlob, filename, 'PDF');

            if (downloadSuccess) {
                console.log('Exportación PDF completada exitosamente');
                return true;
            } else {
                throw new Error('Falló la descarga del archivo PDF');
            }

        } catch (error) {
            console.error('Error detallado en exportación PDF:', error);

            // Mostrar notificación de error al usuario
            this.showNotification(
                'Error en exportación PDF',
                `No se pudo generar el PDF: ${error.message}`,
                'error'
            );

            throw new Error('Error exportando PDF: ' + error.message);
        }
    }

    /**
     * Exporta el mapa a formato PNG
     * @param {Object} customOptions - Opciones personalizadas de exportación
     * @returns {Promise<boolean>} True si la exportación fue exitosa
     */
    async exportToPNG(customOptions = {}) {
        try {
            // Crear configuración con valores por defecto optimizados para PNG
            const config = new ExportConfiguration({
                format: 'png',
                size: {
                    dpi: customOptions.size?.dpi || this.options.defaultDPI,
                    preset: customOptions.size?.preset || 'A4',
                    width: customOptions.size?.width,
                    height: customOptions.size?.height
                },
                elements: {
                    includeScale: true,
                    includeLegend: true,
                    includeAttribution: true,
                    includeTimestamp: true,
                    ...customOptions.elements
                },
                ...customOptions
            });

            console.log('Iniciando exportación PNG con configuración:', config);

            // Validar configuración antes de proceder
            this.validateExportConfiguration(config);

            // Capturar el mapa con configuración optimizada para PNG
            const canvas = await this.canvasCapture.captureMap(config);
            console.log('Canvas capturado exitosamente:', canvas.width + 'x' + canvas.height);

            // Validar que el canvas tenga contenido válido
            if (!this.pngProcessor.validateMarkerReadability(canvas)) {
                console.warn('Advertencia: El canvas puede no tener marcadores visibles');
            }

            // Obtener metadatos completos del mapa
            const metadata = this.canvasCapture.getMapMetadata();
            console.log('Metadatos obtenidos:', metadata);

            // Procesar PNG con optimizaciones específicas
            const pngBlob = await this.pngProcessor.processPNG(canvas, config);
            console.log('PNG procesado exitosamente, tamaño:', pngBlob.size, 'bytes');

            // Validar que el archivo generado tenga un tamaño razonable
            this.validateFileSize(pngBlob, 'PNG');

            // Generar nombre de archivo descriptivo con información del mapa
            const filename = this.generateFileName('png', metadata.timestamp, metadata);
            console.log('Nombre de archivo generado:', filename);

            // Descargar archivo automáticamente
            const downloadSuccess = await this.downloadFile(pngBlob, filename, 'PNG');

            if (downloadSuccess) {
                console.log('Exportación PNG completada exitosamente');

                // Mostrar notificación de éxito con detalles
                this.showNotification(
                    'PNG exportado exitosamente',
                    `Archivo generado: ${filename} (${this.formatFileSize(pngBlob.size)})`,
                    'success'
                );

                return true;
            } else {
                throw new Error('Falló la descarga del archivo PNG');
            }

        } catch (error) {
            console.error('Error detallado en exportación PNG:', error);

            // Mostrar notificación de error específica al usuario
            this.showNotification(
                'Error en exportación PNG',
                `No se pudo generar el PNG: ${error.message}`,
                'error'
            );

            throw new Error('Error exportando PNG: ' + error.message);
        }
    }

    /**
     * Valida la configuración de exportación
     * @param {ExportConfiguration} config - Configuración a validar
     * @throws {Error} Si la configuración es inválida
     */
    validateExportConfiguration(config) {
        // Validar DPI
        const validDPIs = [150, 300, 600, 1200, 2400];
        if (!validDPIs.includes(config.size.dpi)) {
            throw new Error(`DPI inválido: ${config.size.dpi}. Valores válidos: ${validDPIs.join(', ')}`);
        }

        // Validar dimensiones personalizadas
        if (config.size.preset === 'custom') {
            if (!config.size.width || !config.size.height) {
                throw new Error('Dimensiones personalizadas requeridas para tamaño custom');
            }
            if (config.size.width < 100 || config.size.height < 100) {
                throw new Error('Dimensiones mínimas: 100x100 píxeles');
            }
            if (config.size.width > 12000 || config.size.height > 12000) {
                throw new Error('Dimensiones máximas: 12000x12000 píxeles');
            }
        }
    }

    /**
     * Valida el tamaño del archivo generado
     * @param {Blob} blob - Archivo generado
     * @param {string} format - Formato del archivo
     * @throws {Error} Si el archivo es demasiado grande o pequeño
     */
    validateFileSize(blob, format) {
        const maxSize = 50 * 1024 * 1024; // 50MB máximo
        const minSize = 1024; // 1KB mínimo

        if (blob.size > maxSize) {
            throw new Error(`Archivo ${format} demasiado grande: ${this.formatFileSize(blob.size)}. Máximo: 50MB`);
        }
        if (blob.size < minSize) {
            throw new Error(`Archivo ${format} demasiado pequeño: ${this.formatFileSize(blob.size)}. Puede estar vacío`);
        }
    }

    /**
     * Formatea el tamaño de archivo para mostrar al usuario
     * @param {number} bytes - Tamaño en bytes
     * @returns {string} Tamaño formateado
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Prueba la funcionalidad de captura sin generar archivos
     * @returns {Promise<Object>} Información sobre la captura de prueba
     */
    async testCapture() {
        try {
            console.log('Iniciando prueba de captura...');

            // Verificar estado del mapa
            this.canvasCapture.validateMapState();
            console.log('Estado del mapa: válido');

            // Obtener estado de tiles
            const tileStatus = this.canvasCapture.getTileLoadingStatus();
            console.log('Estado de tiles:', tileStatus);

            // Realizar captura de prueba
            const config = new ExportConfiguration({ format: 'png' });
            const canvas = await this.canvasCapture.captureMap(config);

            // Obtener metadatos
            const metadata = this.canvasCapture.getMapMetadata();

            return {
                success: true,
                canvasSize: { width: canvas.width, height: canvas.height },
                metadata: metadata,
                tileStatus: tileStatus
            };
        } catch (error) {
            console.error('Error en prueba de captura:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Genera un nombre de archivo descriptivo con timestamp
     * @param {string} format - Formato del archivo (pdf, png)
     * @param {Date} timestamp - Fecha y hora de generación
     * @param {Object} metadata - Metadatos del mapa para contexto adicional
     * @returns {string} Nombre del archivo descriptivo
     */
    generateFileName(format, timestamp, metadata = {}) {
        // Crear timestamp legible
        const year = timestamp.getFullYear();
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const day = String(timestamp.getDate()).padStart(2, '0');
        const hours = String(timestamp.getHours()).padStart(2, '0');
        const minutes = String(timestamp.getMinutes()).padStart(2, '0');
        const seconds = String(timestamp.getSeconds()).padStart(2, '0');

        const dateStr = `${year}${month}${day}_${hours}${minutes}${seconds}`;

        // Construir nombre base
        let baseName = 'mapa-snien';

        // Añadir información contextual si está disponible
        if (metadata.selectedInstrumentValue && metadata.selectedInstrumentValue !== '') {
            const instrumentCode = this.sanitizeForFilename(metadata.selectedInstrumentValue);
            baseName += `-${instrumentCode}`;
        }

        if (metadata.selectedPlanValue && metadata.selectedPlanValue !== '') {
            const planCode = this.sanitizeForFilename(metadata.selectedPlanValue);
            baseName += `-${planCode}`;
        }

        // Añadir nivel de zoom si es significativo
        if (metadata.zoomLevel && metadata.zoomLevel >= 6) {
            baseName += `-z${metadata.zoomLevel}`;
        }

        return `${baseName}_${dateStr}.${format}`;
    }

    /**
     * Sanitiza texto para uso en nombres de archivo
     * @param {string} text - Texto a sanitizar
     * @returns {string} Texto sanitizado
     */
    sanitizeForFilename(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50); // Limitar longitud
    }

    /**
     * Descarga un archivo al dispositivo del usuario con manejo de errores
     * @param {Blob} blob - Contenido del archivo
     * @param {string} filename - Nombre del archivo
     * @param {string} format - Formato del archivo para mensajes de error
     * @returns {Promise<boolean>} True si la descarga fue exitosa
     */
    async downloadFile(blob, filename, format = 'archivo') {
        try {
            // Verificar que el blob sea válido
            if (!blob || blob.size === 0) {
                throw new Error('El archivo generado está vacío');
            }

            console.log(`Iniciando descarga de ${format}: ${filename} (${blob.size} bytes)`);

            // Validaciones específicas para PNG
            if (format.toLowerCase() === 'png') {
                return await this.downloadPNGFile(blob, filename);
            }

            // Crear URL del objeto
            const url = URL.createObjectURL(blob);

            // Crear elemento de descarga
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            // Añadir al DOM temporalmente
            document.body.appendChild(link);

            // Simular click para iniciar descarga
            link.click();

            // Limpiar después de un breve delay
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);

            // Mostrar notificación de éxito
            this.showNotification(
                `${format.toUpperCase()} descargado exitosamente`,
                `El archivo "${filename}" se ha guardado en tu dispositivo.`,
                'success'
            );

            console.log(`Descarga de ${format} completada exitosamente`);
            return true;

        } catch (error) {
            console.error(`Error en descarga de ${format}:`, error);

            // Mostrar notificación de error
            this.showNotification(
                `Error al descargar ${format.toUpperCase()}`,
                `No se pudo descargar el archivo: ${error.message}`,
                'error'
            );

            return false;
        }
    }

    /**
     * Descarga específica para archivos PNG con validaciones adicionales
     * @param {Blob} pngBlob - Blob del archivo PNG
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<boolean>} True si la descarga fue exitosa
     */
    async downloadPNGFile(pngBlob, filename) {
        try {
            console.log(`Iniciando descarga PNG especializada: ${filename}`);

            // Validar que es realmente un PNG
            if (!pngBlob.type.includes('png')) {
                console.warn('Advertencia: El blob no tiene tipo PNG, forzando tipo correcto');
            }

            // Crear un nuevo blob con el tipo correcto si es necesario
            const correctedBlob = new Blob([pngBlob], { type: 'image/png' });

            // Validar calidad de imagen antes de descargar
            const qualityCheck = await this.validatePNGQuality(correctedBlob);
            if (!qualityCheck.isValid) {
                console.warn('Advertencia de calidad PNG:', qualityCheck.warning);
            }

            // Crear URL del objeto
            const url = URL.createObjectURL(correctedBlob);

            // Crear elemento de descarga con atributos específicos para PNG
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            // Añadir atributos para mejor compatibilidad
            link.setAttribute('type', 'image/png');
            link.setAttribute('target', '_blank');

            // Añadir al DOM temporalmente
            document.body.appendChild(link);

            // Usar evento para asegurar que la descarga se complete
            return new Promise((resolve) => {
                const cleanup = () => {
                    setTimeout(() => {
                        if (document.body.contains(link)) {
                            document.body.removeChild(link);
                        }
                        URL.revokeObjectURL(url);
                    }, 1000); // Delay más largo para PNG
                };

                // Manejar eventos de descarga
                link.addEventListener('click', () => {
                    console.log('Descarga PNG iniciada');
                    cleanup();

                    // Mostrar notificación específica para PNG
                    this.showNotification(
                        'PNG de alta calidad descargado',
                        `Imagen exportada: "${filename}" (${this.formatFileSize(correctedBlob.size)})`,
                        'success'
                    );

                    resolve(true);
                });

                // Simular click para iniciar descarga
                link.click();
            });

        } catch (error) {
            console.error('Error en descarga PNG especializada:', error);

            // Mostrar notificación de error específica
            this.showNotification(
                'Error al descargar PNG',
                `No se pudo descargar la imagen PNG: ${error.message}`,
                'error'
            );

            return false;
        }
    }

    /**
     * Valida la calidad de un archivo PNG
     * @param {Blob} pngBlob - Blob del PNG a validar
     * @returns {Promise<Object>} Resultado de la validación
     */
    async validatePNGQuality(pngBlob) {
        try {
            // Crear una imagen temporal para validar
            const img = new Image();
            const url = URL.createObjectURL(pngBlob);

            return new Promise((resolve) => {
                img.onload = () => {
                    URL.revokeObjectURL(url);

                    const result = {
                        isValid: true,
                        width: img.width,
                        height: img.height,
                        fileSize: pngBlob.size
                    };

                    // Validaciones de calidad
                    if (img.width < 100 || img.height < 100) {
                        result.isValid = false;
                        result.warning = 'Imagen demasiado pequeña para buena legibilidad';
                    } else if (pngBlob.size < 10000) { // Menos de 10KB
                        result.isValid = false;
                        result.warning = 'Archivo muy pequeño, puede estar vacío o corrupto';
                    } else if (pngBlob.size > 20 * 1024 * 1024) { // Más de 20MB
                        result.warning = 'Archivo muy grande, puede tardar en descargarse';
                    }

                    console.log('Validación PNG completada:', result);
                    resolve(result);
                };

                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve({
                        isValid: false,
                        warning: 'No se pudo cargar la imagen PNG generada'
                    });
                };

                img.src = url;
            });

        } catch (error) {
            console.error('Error validando PNG:', error);
            return {
                isValid: false,
                warning: 'Error validando calidad de PNG: ' + error.message
            };
        }
    }

    /**
     * Muestra una notificación al usuario
     * @param {string} title - Título de la notificación
     * @param {string} message - Mensaje de la notificación
     * @param {string} type - Tipo de notificación (success, error, info)
     */
    showNotification(title, message, type = 'info') {
        // Buscar el contenedor de notificaciones
        let container = document.getElementById('notification-container');

        // Crear contenedor si no existe
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('aria-atomic', 'true');
            document.body.appendChild(container);
        }

        // Crear elemento de notificación
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.setAttribute('role', 'alert');

        notification.innerHTML = `
            <div class="notification-content">
                <h4 class="notification-title">${title}</h4>
                <p class="notification-message">${message}</p>
            </div>
            <button type="button" class="notification-close" aria-label="Cerrar notificación">
                <span aria-hidden="true">&times;</span>
            </button>
        `;

        // Añadir evento de cierre
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });

        // Añadir al contenedor
        container.appendChild(notification);

        // Auto-remover después de 5 segundos para notificaciones de éxito
        if (type === 'success') {
            setTimeout(() => {
                if (notification.parentNode) {
                    this.removeNotification(notification);
                }
            }, 5000);
        }

        console.log(`Notificación mostrada: ${type} - ${title}`);
    }

    /**
     * Remueve una notificación con animación
     * @param {HTMLElement} notification - Elemento de notificación a remover
     */
    removeNotification(notification) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    /**
     * Muestra el diálogo de configuración de exportación
     */
    showExportDialog() {
        // Esta funcionalidad se implementará en tareas posteriores
        console.log('Diálogo de exportación - pendiente de implementación');
    }
}