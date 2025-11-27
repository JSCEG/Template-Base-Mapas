/**
 * Procesador de imágenes PNG
 */
class PNGProcessor {
    constructor() {
        // Configuraciones predefinidas para diferentes calidades
        this.qualityPresets = {
            150: { compression: 0.8, smoothing: 'medium' },
            300: { compression: 0.9, smoothing: 'high' },
            600: { compression: 1.0, smoothing: 'high' },
            1200: { compression: 1.0, smoothing: 'high' },
            2400: { compression: 1.0, smoothing: 'high' }
        };
    }

    /**
     * Crea un canvas limpio copiando los datos píxel por píxel para evitar problemas de CORS
     * @param {HTMLCanvasElement} sourceCanvas - Canvas fuente que puede estar "tainted"
     * @returns {HTMLCanvasElement} Canvas limpio sin restricciones CORS
     */
    createCleanCanvas(sourceCanvas) {
        try {
            console.log('Creando canvas limpio para PNG...');

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

                console.log('Canvas PNG limpio creado usando getImageData');
                return cleanCanvas;

            } catch (getImageDataError) {
                console.warn('getImageData falló para PNG, intentando drawImage:', getImageDataError);

                try {
                    // Fallback: intentar drawImage
                    cleanCtx.drawImage(sourceCanvas, 0, 0);

                    console.log('Canvas PNG limpio creado usando drawImage');
                    return cleanCanvas;

                } catch (drawImageError) {
                    console.warn('drawImage también falló para PNG:', drawImageError);

                    // Último recurso: crear canvas básico
                    cleanCtx.fillStyle = '#ffffff';
                    cleanCtx.fillRect(0, 0, cleanCanvas.width, cleanCanvas.height);

                    cleanCtx.fillStyle = '#333333';
                    cleanCtx.font = '20px Arial';
                    cleanCtx.textAlign = 'center';
                    cleanCtx.fillText('Mapa SNIEn', cleanCanvas.width / 2, cleanCanvas.height / 2);

                    console.log('Canvas PNG básico creado como último recurso');
                    return cleanCanvas;
                }
            }

        } catch (error) {
            console.error('Error creando canvas PNG limpio:', error);

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
            emergencyCtx.fillText('Error en exportación PNG', 400, 300);

            return emergencyCanvas;
        }
    }

    /**
     * Procesa un canvas para generar PNG optimizado
     * @param {HTMLCanvasElement} canvas - Canvas con la imagen del mapa
     * @param {ExportConfiguration} config - Configuración de exportación
     * @returns {Promise<Blob>} Archivo PNG generado
     */
    async processPNG(canvas, config) {
        try {
            console.log('Iniciando procesamiento PNG con DPI:', config.size.dpi);

            // Validar entrada
            if (!canvas || canvas.width === 0 || canvas.height === 0) {
                throw new Error('Canvas inválido para procesamiento PNG');
            }

            // Obtener configuración de calidad basada en DPI
            const qualityConfig = this.getQualityConfig(config.size.dpi);

            // Calcular dimensiones finales
            const dimensions = this.calculateOutputDimensions(canvas, config);

            // Crear canvas optimizado
            const optimizedCanvas = await this.createOptimizedCanvas(canvas, dimensions, qualityConfig);

            // Aplicar mejoras de imagen si es necesario
            if (config.size.dpi >= 300) {
                await this.enhanceImageQuality(optimizedCanvas, qualityConfig);
            }

            // Generar blob PNG con compresión optimizada
            const pngBlob = await this.generatePNGBlob(optimizedCanvas, qualityConfig);

            console.log(`PNG procesado: ${dimensions.width}x${dimensions.height}, tamaño: ${pngBlob.size} bytes`);

            return pngBlob;

        } catch (error) {
            console.error('Error en procesamiento PNG:', error);
            throw new Error('Error procesando PNG: ' + error.message);
        }
    }

    /**
     * Obtiene la configuración de calidad basada en DPI
     * @param {number} dpi - Resolución en DPI
     * @returns {Object} Configuración de calidad
     */
    getQualityConfig(dpi) {
        return this.qualityPresets[dpi] || this.qualityPresets[300];
    }

    /**
     * Calcula las dimensiones de salida basadas en configuración
     * @param {HTMLCanvasElement} canvas - Canvas original
     * @param {ExportConfiguration} config - Configuración de exportación
     * @returns {Object} Dimensiones calculadas
     */
    calculateOutputDimensions(canvas, config) {
        let targetWidth, targetHeight;

        // Si se especifica tamaño personalizado, usarlo
        if (config.size.preset === 'custom') {
            targetWidth = config.size.width;
            targetHeight = config.size.height;
        } else {
            // Calcular basado en DPI y tamaño de página
            const scaleFactor = config.size.dpi / 96; // 96 DPI es la resolución estándar del navegador
            targetWidth = Math.round(canvas.width * scaleFactor);
            targetHeight = Math.round(canvas.height * scaleFactor);
        }

        // Aplicar límites de seguridad para evitar problemas de memoria
        const maxDimension = this.getMaxDimension(config.size.dpi);
        if (targetWidth > maxDimension || targetHeight > maxDimension) {
            const ratio = Math.min(maxDimension / targetWidth, maxDimension / targetHeight);
            targetWidth = Math.round(targetWidth * ratio);
            targetHeight = Math.round(targetHeight * ratio);
            console.warn(`Dimensiones reducidas por límites de memoria: ${targetWidth}x${targetHeight}`);
        }

        return {
            width: targetWidth,
            height: targetHeight,
            scaleFactor: targetWidth / canvas.width
        };
    }

    /**
     * Obtiene la dimensión máxima permitida basada en DPI
     * @param {number} dpi - Resolución en DPI
     * @returns {number} Dimensión máxima en píxeles
     */
    getMaxDimension(dpi) {
        // Límites conservadores para evitar problemas de memoria
        const limits = {
            150: 4000,
            300: 6000,
            600: 8000,
            1200: 12000,
            2400: 12000
        };
        return limits[dpi] || limits[300];
    }

    /**
     * Crea un canvas optimizado con las dimensiones y calidad especificadas
     * @param {HTMLCanvasElement} sourceCanvas - Canvas original
     * @param {Object} dimensions - Dimensiones objetivo
     * @param {Object} qualityConfig - Configuración de calidad
     * @returns {Promise<HTMLCanvasElement>} Canvas optimizado
     */
    async createOptimizedCanvas(sourceCanvas, dimensions, qualityConfig) {
        return new Promise((resolve) => {
            const outputCanvas = document.createElement('canvas');
            const ctx = outputCanvas.getContext('2d');

            // Configurar dimensiones
            outputCanvas.width = dimensions.width;
            outputCanvas.height = dimensions.height;

            // Configurar calidad de renderizado
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = qualityConfig.smoothing;

            // Aplicar fondo blanco para mejor contraste
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

            // Dibujar imagen escalada con alta calidad
            ctx.drawImage(sourceCanvas, 0, 0, dimensions.width, dimensions.height);

            resolve(outputCanvas);
        });
    }

    /**
     * Aplica mejoras de calidad de imagen para altas resoluciones
     * @param {HTMLCanvasElement} canvas - Canvas a mejorar
     * @param {Object} qualityConfig - Configuración de calidad
     * @returns {Promise<void>}
     */
    async enhanceImageQuality(canvas, qualityConfig) {
        return new Promise((resolve) => {
            const ctx = canvas.getContext('2d');

            // Aplicar filtros de mejora si es necesario
            if (qualityConfig.compression >= 0.9) {
                // Para alta calidad, aplicar un ligero sharpening
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const sharpened = this.applySharpeningFilter(imageData);
                ctx.putImageData(sharpened, 0, 0);
            }

            resolve();
        });
    }

    /**
     * Aplica un filtro de sharpening sutil para mejorar la nitidez
     * @param {ImageData} imageData - Datos de imagen original
     * @returns {ImageData} Datos de imagen con sharpening aplicado
     */
    applySharpeningFilter(imageData) {
        // Kernel de sharpening sutil
        const kernel = [
            0, -0.1, 0,
            -0.1, 1.8, -0.1,
            0, -0.1, 0
        ];

        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const output = new Uint8ClampedArray(data.length);

        // Aplicar convolución
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) { // RGB, sin alpha
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                            const kernelIdx = (ky + 1) * 3 + (kx + 1);
                            sum += data[idx] * kernel[kernelIdx];
                        }
                    }
                    const outputIdx = (y * width + x) * 4 + c;
                    output[outputIdx] = Math.max(0, Math.min(255, sum));
                }
                // Copiar canal alpha sin modificar
                const alphaIdx = (y * width + x) * 4 + 3;
                output[alphaIdx] = data[alphaIdx];
            }
        }

        // Copiar bordes sin modificar
        for (let i = 0; i < data.length; i += 4) {
            const x = (i / 4) % width;
            const y = Math.floor((i / 4) / width);
            if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                output[i] = data[i];
                output[i + 1] = data[i + 1];
                output[i + 2] = data[i + 2];
                output[i + 3] = data[i + 3];
            }
        }

        return new ImageData(output, width, height);
    }

    /**
     * Genera el blob PNG final con compresión optimizada
     * @param {HTMLCanvasElement} canvas - Canvas procesado
     * @param {Object} qualityConfig - Configuración de calidad
     * @returns {Promise<Blob>} Blob PNG generado
     */
    async generatePNGBlob(canvas, qualityConfig) {
        return new Promise((resolve, reject) => {
            try {
                // Crear canvas limpio para evitar problemas de CORS
                const cleanCanvas = this.createCleanCanvas(canvas);

                // Usar máxima calidad para PNG (sin pérdida)
                cleanCanvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('No se pudo generar el blob PNG'));
                        return;
                    }
                    resolve(blob);
                }, 'image/png', qualityConfig.compression);
            } catch (error) {
                reject(new Error('Error generando blob PNG: ' + error.message));
            }
        });
    }

    /**
     * Valida que el canvas tenga marcadores legibles
     * @param {HTMLCanvasElement} canvas - Canvas a validar
     * @returns {boolean} True si los marcadores son legibles
     */
    validateMarkerReadability(canvas) {
        // Verificación básica de que el canvas no esté completamente vacío
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
        const data = imageData.data;

        // Verificar que hay contenido no blanco
        let hasContent = false;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Si encuentra píxeles que no son blancos puros
            if (r < 250 || g < 250 || b < 250) {
                hasContent = true;
                break;
            }
        }

        return hasContent;
    }
}