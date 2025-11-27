/**
 * Capturador de canvas del mapa Leaflet
 */
class CanvasCapture {
    constructor(map) {
        this.map = map;
        this.maxWaitTime = 10000; // 10 segundos máximo de espera
        this.tileCheckInterval = 100; // Verificar cada 100ms
    }

    /**
     * Captura el mapa actual como imagen
     * @param {ExportConfiguration} config - Configuración de exportación
     * @returns {Promise<HTMLCanvasElement>} Canvas con la imagen del mapa
     */
    async captureMap(config) {
        try {
            // Validar que el mapa esté en estado válido
            this.validateMapState();

            // Preparar elementos de la interfaz para captura
            const uiState = await this.prepareUIForCapture(config);

            // Esperar a que todos los tiles estén cargados antes de capturar
            await this.waitForTilesToLoad();

            // Asegurar que los marcadores estén visibles y listos
            await this.ensureMarkersReady();

            // Capturar el mapa usando leaflet-image
            const canvas = await this.performCapture(config);

            // Incorporar elementos DOM (etiquetas, escala, popups) en la captura
            await this.drawDomOverlays(canvas, config);

            // Restaurar estado original de la interfaz
            await this.restoreUIState(uiState);

            return canvas;
        } catch (error) {
            throw new Error('Error en la captura del mapa: ' + error.message);
        }
    }

    /**
     * Fuerza la recarga de tiles en el área visible del mapa
     * @returns {Promise<void>}
     */
    async refreshVisibleTiles() {
        return new Promise((resolve) => {
            let layersToRefresh = 0;
            let layersRefreshed = 0;

            const onLayerRefreshed = () => {
                layersRefreshed++;
                if (layersRefreshed >= layersToRefresh) {
                    resolve();
                }
            };

            this.map.eachLayer((layer) => {
                if (layer instanceof L.TileLayer) {
                    layersToRefresh++;

                    // Forzar recarga de la capa
                    layer.once('load', onLayerRefreshed);
                    layer.redraw();
                }
            });

            // Si no hay capas para refrescar, resolver inmediatamente
            if (layersToRefresh === 0) {
                resolve();
            }
        });
    }

    /**
     * Valida que el mapa esté en un estado válido para captura
     * @returns {boolean} True si el mapa está listo para capturar
     */
    validateMapState() {
        if (!this.map) {
            throw new Error('Mapa no inicializado');
        }

        const container = this.map.getContainer();
        if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
            throw new Error('Contenedor del mapa no visible o sin dimensiones');
        }

        const bounds = this.map.getBounds();
        if (!bounds || !bounds.isValid()) {
            throw new Error('Límites del mapa inválidos');
        }

        return true;
    }

    /**
     * Obtiene información detallada sobre el estado de carga de tiles
     * @returns {Object} Información de estado de tiles
     */
    getTileLoadingStatus() {
        const status = {
            totalLayers: 0,
            loadedLayers: 0,
            totalTiles: 0,
            loadedTiles: 0,
            failedTiles: 0,
            totalMarkers: 0,
            loadedMarkers: 0,
            failedMarkers: 0
        };

        this.map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                status.totalLayers++;

                const container = layer.getContainer();
                if (container) {
                    const tiles = container.querySelectorAll('img');
                    tiles.forEach((tile) => {
                        status.totalTiles++;
                        if (tile.complete && tile.naturalWidth > 0) {
                            status.loadedTiles++;
                        } else if (tile.complete && tile.naturalWidth === 0) {
                            status.failedTiles++;
                        }
                    });

                    if (tiles.length > 0 && status.loadedTiles === tiles.length) {
                        status.loadedLayers++;
                    }
                }
            }

            // Verificar estado de marcadores
            if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                status.totalMarkers++;

                if (layer._icon) {
                    const img = layer._icon.querySelector('img');
                    if (img) {
                        if (img.complete && img.naturalWidth > 0) {
                            status.loadedMarkers++;
                        } else if (img.complete && img.naturalWidth === 0) {
                            status.failedMarkers++;
                        }
                    } else {
                        // Marcador sin imagen (ej: CircleMarker o icono CSS)
                        status.loadedMarkers++;
                    }
                } else {
                    // Marcador sin icono visible
                    status.loadedMarkers++;
                }
            }
        });

        return status;
    }

    /**
     * Prepara los elementos de la interfaz para la captura
     * @param {ExportConfiguration} config - Configuración de exportación
     * @returns {Object} Estado original de la UI para restaurar después
     */
    async prepareUIForCapture(config) {
        const uiState = {
            hiddenElements: [],
            modifiedElements: []
        };

        // Ocultar controles de zoom si no se requieren en la exportación
        const zoomControls = this.map.getContainer().querySelectorAll('.leaflet-control-zoom');
        zoomControls.forEach(control => {
            if (control.style.display !== 'none') {
                uiState.hiddenElements.push({
                    element: control,
                    originalDisplay: control.style.display
                });
                control.style.display = 'none';
            }
        });

        // Ocultar controles de capas si no se requieren
        const layerControls = this.map.getContainer().querySelectorAll('.leaflet-control-layers');
        layerControls.forEach(control => {
            if (control.style.display !== 'none') {
                uiState.hiddenElements.push({
                    element: control,
                    originalDisplay: control.style.display
                });
                control.style.display = 'none';
            }
        });

        // Mejorar visibilidad de marcadores para la captura
        await this.enhanceMarkersForCapture(uiState);

        return uiState;
    }

    /**
     * Dibuja elementos de interfaz basados en DOM (graticule, escala, popups) sobre el canvas exportado
     * @param {HTMLCanvasElement} canvas
     * @returns {Promise<void>}
     */
    async drawDomOverlays(canvas) {
        if (!canvas || typeof canvas.getContext !== 'function') {
            return;
        }

        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return;
            }

            const mapContainer = this.map.getContainer();
            if (!mapContainer) {
                return;
            }

            const containerRect = mapContainer.getBoundingClientRect();
            if (!containerRect.width || !containerRect.height) {
                return;
            }

            const scaleX = canvas.width / containerRect.width;
            const scaleY = canvas.height / containerRect.height;
            const fontScale = Math.min(scaleX, scaleY);

            const labelElements = mapContainer.querySelectorAll('.graticule-label-item');
            labelElements.forEach((element) => {
                const text = element.textContent ? element.textContent.trim() : '';
                if (!text) {
                    return;
                }

                const rect = element.getBoundingClientRect();
                const centerX = (rect.left - containerRect.left + rect.width / 2) * scaleX;
                const centerY = (rect.top - containerRect.top + rect.height / 2) * scaleY;

                const computedStyle = window.getComputedStyle ? window.getComputedStyle(element) : null;
                const baseFontSize = computedStyle ? parseFloat(computedStyle.fontSize) || 12 : 12;
                const fontFamily = computedStyle?.fontFamily || 'Arial, sans-serif';
                const fontSize = Math.min(18, Math.max(10, baseFontSize * fontScale));

                const paddingX = 6 * scaleX;
                const paddingY = 4 * scaleY;

                ctx.save();
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                ctx.font = fontSize + 'px ' + fontFamily;
                const metrics = ctx.measureText(text);
                const boxWidth = metrics.width + paddingX * 2;
                const boxHeight = fontSize + paddingY * 2;

                ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
                ctx.fillRect(centerX - boxWidth / 2, centerY - boxHeight / 2, boxWidth, boxHeight);

                ctx.strokeStyle = 'rgba(26, 52, 68, 0.35)';
                ctx.lineWidth = Math.max(1, 1.2 * Math.max(scaleX, scaleY));
                ctx.strokeRect(centerX - boxWidth / 2, centerY - boxHeight / 2, boxWidth, boxHeight);

                ctx.fillStyle = '#1a3444';
                ctx.fillText(text, centerX, centerY);
                ctx.restore();
            });

            // Draw region labels (tooltips)
            const regionLabels = mapContainer.querySelectorAll('.region-label');
            regionLabels.forEach((element) => {
                const text = element.textContent ? element.textContent.trim() : '';
                if (!text) {
                    return;
                }

                const rect = element.getBoundingClientRect();
                const centerX = (rect.left - containerRect.left + rect.width / 2) * scaleX;
                const centerY = (rect.top - containerRect.top + rect.height / 2) * scaleY;

                const computedStyle = window.getComputedStyle ? window.getComputedStyle(element) : null;
                const baseFontSize = computedStyle ? parseFloat(computedStyle.fontSize) || 12 : 12;
                const fontFamily = computedStyle?.fontFamily || 'Arial, sans-serif';
                const fontSize = Math.min(18, Math.max(10, baseFontSize * fontScale));

                ctx.save();
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'white';
                ctx.shadowBlur = 2;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                // Add a white background
                const padding = 2;
                const textWidth = ctx.measureText(text).width;
                ctx.fillStyle = 'white';
                ctx.fillRect(centerX - textWidth / 2 - padding, centerY - fontSize / 2 - padding, textWidth + padding * 2, fontSize + padding * 2);

                ctx.fillStyle = '#000000';
                ctx.fillText(text, centerX, centerY);
                ctx.restore();
            });

            // Draw legend
            const legendControl = mapContainer.querySelector('.legend');
            if (legendControl) {
                const legendRect = legendControl.getBoundingClientRect();
                const destX = (legendRect.left - containerRect.left) * scaleX;
                const destY = (legendRect.top - containerRect.top) * scaleY;
                const destWidth = legendRect.width * scaleX;
                const destHeight = legendRect.height * scaleY;

                ctx.save();
                ctx.fillStyle = 'white';
                ctx.fillRect(destX, destY, destWidth, destHeight);

                let yOffset = destY + 10 * scaleY;
                const xOffset = destX + 10 * scaleX;

                // Procesar todos los nodos hijos directamente para mantener el orden
                const childNodes = Array.from(legendControl.childNodes);

                childNodes.forEach(node => {
                    // Procesar nodos de texto directo
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent.trim();
                        if (text) {
                            const parentStyle = window.getComputedStyle(legendControl);
                            const fontSize = parseFloat(parentStyle.fontSize) * fontScale;
                            ctx.font = `${fontSize}px ${parentStyle.fontFamily}`;
                            ctx.fillStyle = parentStyle.color;
                            ctx.textBaseline = 'top';
                            ctx.fillText(text, xOffset, yOffset);
                            yOffset += fontSize * 1.4;
                        }
                    }
                    // Procesar elementos <strong> (títulos)
                    else if (node.nodeName === 'STRONG') {
                        const text = node.textContent.trim();
                        if (text) {
                            const strongStyle = window.getComputedStyle(node);
                            const fontSize = parseFloat(strongStyle.fontSize) * fontScale;
                            ctx.font = `bold ${fontSize}px ${strongStyle.fontFamily}`;
                            ctx.fillStyle = strongStyle.color;
                            ctx.textBaseline = 'top';
                            ctx.fillText(text, xOffset, yOffset);
                            yOffset += fontSize * 1.6;
                        }
                    }
                    // Procesar elementos <br>
                    else if (node.nodeName === 'BR') {
                        yOffset += 8 * scaleY;
                    }
                    // Procesar legend-items
                    else if (node.classList && node.classList.contains('legend-item')) {
                        const colorSwatch = node.querySelector('i');
                        const label = node.textContent.trim();

                        if (colorSwatch) {
                            const itemStyle = window.getComputedStyle(colorSwatch);
                            const itemColor = itemStyle.backgroundColor;
                            const itemSize = 18 * scaleY;

                            ctx.fillStyle = itemColor;
                            ctx.fillRect(xOffset, yOffset, itemSize, itemSize);

                            const labelStyle = window.getComputedStyle(node);
                            const labelFontSize = parseFloat(labelStyle.fontSize) * fontScale;
                            ctx.font = `${labelFontSize}px ${labelStyle.fontFamily}`;
                            ctx.fillStyle = labelStyle.color;
                            ctx.textBaseline = 'top';
                            ctx.fillText(label, xOffset + itemSize + 5 * scaleX, yOffset);

                            yOffset += itemSize * 1.5;
                        }
                    }
                    // Procesar divs con contenido (sección TOTALES)
                    else if (node.nodeName === 'DIV' && !node.classList.contains('legend-item')) {
                        // Procesar recursivamente el contenido del div
                        const processDiv = (divElement, currentY, indentLevel = 0) => {
                            const children = Array.from(divElement.childNodes);
                            let localY = currentY;

                            children.forEach(child => {
                                if (child.nodeType === Node.TEXT_NODE) {
                                    const text = child.textContent.trim();
                                    if (text) {
                                        const divStyle = window.getComputedStyle(divElement);
                                        const fontSize = parseFloat(divStyle.fontSize) * fontScale;
                                        const fontWeight = divStyle.fontWeight;
                                        const isBold = fontWeight === 'bold' || parseInt(fontWeight) >= 700;

                                        ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px ${divStyle.fontFamily}`;
                                        ctx.fillStyle = divStyle.color;
                                        ctx.textBaseline = 'top';
                                        ctx.fillText(text, xOffset + (indentLevel * 8 * scaleX), localY);
                                        localY += fontSize * 1.4;
                                    }
                                } else if (child.nodeName === 'STRONG') {
                                    const text = child.textContent.trim();
                                    if (text) {
                                        const strongStyle = window.getComputedStyle(child);
                                        const fontSize = parseFloat(strongStyle.fontSize) * fontScale;
                                        ctx.font = `bold ${fontSize}px ${strongStyle.fontFamily}`;
                                        ctx.fillStyle = strongStyle.color;
                                        ctx.textBaseline = 'top';
                                        ctx.fillText(text, xOffset + (indentLevel * 8 * scaleX), localY);
                                        localY += fontSize * 1.5;
                                    }
                                } else if (child.nodeName === 'BR') {
                                    localY += 6 * scaleY;
                                } else if (child.nodeName === 'DIV') {
                                    localY = processDiv(child, localY, indentLevel);
                                }
                            });

                            return localY;
                        };

                        yOffset = processDiv(node, yOffset, 0);
                    }
                });

                // Agregar padding adicional al final
                yOffset += 12 * scaleY;

                ctx.restore();
            }

            // Dibujar popups
            const popupPane = mapContainer.querySelector('.leaflet-popup-pane');
            if (popupPane) {
                const popups = popupPane.querySelectorAll('.leaflet-popup');
                for (const popup of popups) {
                    const popupRect = popup.getBoundingClientRect();
                    const destX = (popupRect.left - containerRect.left) * scaleX;
                    const destY = (popupRect.top - containerRect.top) * scaleY;
                    const destWidth = popupRect.width * scaleX;
                    const destHeight = popupRect.height * scaleY;

                    ctx.save();
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
                    ctx.strokeStyle = 'rgba(26, 52, 68, 0.35)';
                    ctx.lineWidth = Math.max(1, 1.2 * Math.max(scaleX, scaleY));

                    const popupStyle = window.getComputedStyle(popup);
                    const borderRadius = parseFloat(popupStyle.borderRadius) * Math.min(scaleX, scaleY);

                    if (borderRadius > 0) {
                        this.roundRect(ctx, destX, destY, destWidth, destHeight, borderRadius);
                        ctx.fill();
                        ctx.stroke();
                    } else {
                        ctx.fillRect(destX, destY, destWidth, destHeight);
                        ctx.strokeRect(destX, destY, destWidth, destHeight);
                    }

                    const content = popup.querySelector('.leaflet-popup-content');
                    const text = content && content.textContent ? content.textContent.trim() : '';
                    if (text) {
                        const computedStyle = content && window.getComputedStyle ? window.getComputedStyle(content) : null;
                        const baseFontSize = computedStyle ? parseFloat(computedStyle.fontSize) || 12 : 12;
                        const fontFamily = computedStyle?.fontFamily || 'Arial, sans-serif';
                        const fontSize = Math.min(18, Math.max(11, baseFontSize * fontScale));

                        ctx.font = `bold ${fontSize}px ${fontFamily}`;
                        ctx.fillStyle = '#1a3444';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'top';

                        const padding = 12 * fontScale;
                        const lines = text.split(/\r?\n/).map(part => part.trim()).filter(Boolean);
                        let offsetY = destY + padding;
                        lines.forEach((line) => {
                            ctx.fillText(line, destX + padding, offsetY);
                            offsetY += fontSize * 1.2;
                        });
                    }

                    ctx.restore();
                }
            }

            // Dibujar controles de escala
            const scaleControl = mapContainer.querySelector('.leaflet-control-scale');
            if (scaleControl) {
                const scaleRect = scaleControl.getBoundingClientRect();
                const destX = (scaleRect.left - containerRect.left) * scaleX;
                const destY = (scaleRect.top - containerRect.top) * scaleY;
                const destWidth = scaleRect.width * scaleX;
                const destHeight = scaleRect.height * scaleY;

                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
                ctx.strokeStyle = 'rgba(26, 52, 68, 0.35)';
                ctx.lineWidth = Math.max(1, 1.2 * Math.max(scaleX, scaleY));
                ctx.fillRect(destX, destY, destWidth, destHeight);
                ctx.strokeRect(destX, destY, destWidth, destHeight);

                const scaleLine = scaleControl.querySelector('.leaflet-control-scale-line');
                if (scaleLine) {
                    const scaleText = scaleLine.textContent;
                    const computedStyle = window.getComputedStyle(scaleLine);
                    const baseFontSize = parseFloat(computedStyle.fontSize) || 10;
                    const fontFamily = computedStyle.fontFamily || 'Arial, sans-serif';
                    const fontSize = Math.min(16, Math.max(9, baseFontSize * fontScale));

                    ctx.font = `bold ${fontSize}px ${fontFamily}`;
                    ctx.fillStyle = '#1a3444';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(scaleText, destX + destWidth / 2, destY + destHeight / 2);
                }
                ctx.restore();
            }

            // Dibujar logos
            const logosWrapper = mapContainer.querySelector('.logos-control-wrapper');
            if (logosWrapper) {
                const logoImages = logosWrapper.querySelectorAll('img');
                logoImages.forEach(img => {
                    const imgRect = img.getBoundingClientRect();
                    const destX = (imgRect.left - containerRect.left) * scaleX;
                    const destY = (imgRect.top - containerRect.top) * scaleY;
                    const destWidth = imgRect.width * scaleX;
                    const destHeight = imgRect.height * scaleY;

                    if (img.complete && img.naturalWidth > 0) {
                        ctx.drawImage(img, destX, destY, destWidth, destHeight);
                    }
                });
            }
        } catch (error) {
            console.warn('Error dibujando overlays del mapa para exportación:', error);
        }
    }

    /**
     * Función auxiliar para dibujar rectángulos redondeados
     */
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    /**
     * Mejora la visibilidad de los marcadores para la captura
     * @param {Object} uiState - Estado de la UI para tracking de cambios
     */
    async enhanceMarkersForCapture(uiState) {
        return new Promise((resolve) => {
            let markersProcessed = 0;
            let totalMarkers = 0;

            // Contar total de marcadores
            this.map.eachLayer((layer) => {
                if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                    totalMarkers++;
                }
            });

            if (totalMarkers === 0) {
                resolve();
                return;
            }

            // Procesar cada marcador
            this.map.eachLayer((layer) => {
                if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                    // Asegurar que el marcador esté visible
                    if (layer._icon) {
                        const icon = layer._icon;

                        // Guardar estado original
                        const originalZIndex = icon.style.zIndex;
                        const originalOpacity = icon.style.opacity;

                        uiState.modifiedElements.push({
                            element: icon,
                            originalZIndex: originalZIndex,
                            originalOpacity: originalOpacity
                        });

                        // Mejorar visibilidad para captura
                        icon.style.zIndex = '1000';
                        icon.style.opacity = '1';

                        // Forzar repaint del marcador
                        icon.style.transform = icon.style.transform;
                    }

                    markersProcessed++;
                    if (markersProcessed >= totalMarkers) {
                        // Dar tiempo para que se apliquen los cambios
                        setTimeout(resolve, 100);
                    }
                }
            });
        });
    }

    /**
     * Asegura que todos los marcadores estén listos para la captura
     * @returns {Promise<void>}
     */
    async ensureMarkersReady() {
        return new Promise((resolve) => {
            let markersReady = 0;
            let totalMarkers = 0;

            // Contar marcadores
            this.map.eachLayer((layer) => {
                if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                    totalMarkers++;
                }
            });

            if (totalMarkers === 0) {
                console.log('No hay marcadores en el mapa');
                resolve();
                return;
            }

            console.log(`Verificando ${totalMarkers} marcadores...`);

            // Verificar cada marcador
            this.map.eachLayer((layer) => {
                if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                    // Verificar si el marcador tiene icono y está en el DOM
                    if (layer._icon && layer._icon.parentNode) {
                        // Verificar si el icono está completamente cargado
                        const icon = layer._icon;
                        const img = icon.querySelector('img');

                        if (img) {
                            if (img.complete && img.naturalWidth > 0) {
                                markersReady++;
                            } else {
                                // Esperar a que la imagen se cargue
                                img.onload = () => {
                                    markersReady++;
                                    if (markersReady >= totalMarkers) {
                                        console.log(`Todos los ${totalMarkers} marcadores están listos`);
                                        resolve();
                                    }
                                };
                                img.onerror = () => {
                                    console.warn('Error cargando icono de marcador');
                                    markersReady++;
                                    if (markersReady >= totalMarkers) {
                                        resolve();
                                    }
                                };
                            }
                        } else {
                            // Marcador sin imagen (ej: CircleMarker)
                            markersReady++;
                        }
                    } else {
                        console.warn('Marcador sin icono o no en DOM');
                        markersReady++;
                    }

                    // Verificar si ya están todos listos
                    if (markersReady >= totalMarkers) {
                        console.log(`Todos los ${totalMarkers} marcadores están listos`);
                        resolve();
                    }
                }
            });

            // Timeout de seguridad
            setTimeout(() => {
                if (markersReady < totalMarkers) {
                    console.warn(`Timeout: solo ${markersReady}/${totalMarkers} marcadores listos`);
                }
                resolve();
            }, 3000);
        });
    }

    /**
     * Restaura el estado original de la interfaz después de la captura
     * @param {Object} uiState - Estado original de la UI
     */
    async restoreUIState(uiState) {
        // Restaurar elementos ocultos
        uiState.hiddenElements.forEach(item => {
            item.element.style.display = item.originalDisplay;
        });

        // Restaurar elementos modificados
        uiState.modifiedElements.forEach(item => {
            if (item.originalZIndex !== undefined) {
                item.element.style.zIndex = item.originalZIndex;
            }
            if (item.originalOpacity !== undefined) {
                item.element.style.opacity = item.originalOpacity;
            }
        });

        // Dar tiempo para que se restauren los cambios
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Obtiene información detallada sobre marcadores visibles
     * @returns {Object} Información de marcadores
     */
    getMarkersInfo() {
        const markersInfo = {
            total: 0,
            visible: 0,
            withIcons: 0,
            inBounds: 0,
            details: []
        };

        const mapBounds = this.map.getBounds();

        this.map.eachLayer((layer) => {
            if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                markersInfo.total++;

                const latLng = layer.getLatLng();
                const isInBounds = mapBounds.contains(latLng);
                const hasIcon = layer._icon && layer._icon.parentNode;
                const isVisible = hasIcon && layer._icon.style.display !== 'none';

                if (isInBounds) markersInfo.inBounds++;
                if (hasIcon) markersInfo.withIcons++;
                if (isVisible) markersInfo.visible++;

                markersInfo.details.push({
                    position: latLng,
                    inBounds: isInBounds,
                    hasIcon: hasIcon,
                    visible: isVisible,
                    type: layer instanceof L.Marker ? 'marker' : 'circle'
                });
            }
        });

        return markersInfo;
    }

    /**
     * Obtiene metadatos del mapa actual
     * @returns {Object} Metadatos del mapa
     */
    getMapMetadata() {
        const center = this.map.getCenter();
        const bounds = this.map.getBounds();

        // Obtener información detallada de la capa base actual
        const baseLayerInfo = this.getBaseLayerInfo();

        const instrumentSelect = document.getElementById('instrument-select');
        const mapSelect = document.getElementById('map-select');

        const selectedInstrumentText = instrumentSelect ? instrumentSelect.options[instrumentSelect.selectedIndex].text : 'N/A';
        const selectedInstrumentValue = instrumentSelect ? instrumentSelect.value : 'N/A';

        const selectedPlanText = mapSelect ? mapSelect.options[mapSelect.selectedIndex].text : 'N/A';
        const selectedPlanValue = mapSelect ? mapSelect.value : 'N/A';

        const selectedBasemapText = baseLayerInfo.name || 'Mapa base activo';

        // Obtener información detallada de marcadores
        const markersInfo = this.getMarkersInfo();

        // Obtener fecha de última actualización de datos
        const lastUpdatedElement = document.getElementById('last-updated');
        const lastUpdated = lastUpdatedElement?.textContent || 'No disponible';

        return {
            timestamp: new Date(),
            baseLayer: baseLayerInfo.name,
            baseLayerAttribution: baseLayerInfo.attribution,
            selectedInstrument: selectedInstrumentText,
            selectedInstrumentValue: selectedInstrumentValue,
            selectedPlan: selectedPlanText,
            selectedPlanValue: selectedPlanValue,
            selectedBasemap: selectedBasemapText,
            selectedBasemapValue: 'control-capas', // This seems to be a placeholder, but I'll leave it for now
            zoomLevel: this.map.getZoom(),
            center: {
                lat: Math.round(center.lat * 100000) / 100000, // 5 decimales
                lng: Math.round(center.lng * 100000) / 100000
            },
            bounds: {
                north: Math.round(bounds.getNorth() * 100000) / 100000,
                south: Math.round(bounds.getSouth() * 100000) / 100000,
                east: Math.round(bounds.getEast() * 100000) / 100000,
                west: Math.round(bounds.getWest() * 100000) / 100000
            },
            markersCount: markersInfo.total,
            markersVisible: markersInfo.visible,
            markersInBounds: markersInfo.inBounds,
            lastDataUpdate: lastUpdated,
            dataSource: 'Hoja de cálculo institucional publicada (Google Sheets)',
            system: 'Sistema Nacional de Información Energética (SNIEn)',
            organization: 'Secretaría de Energía (SENER)'
        };
    }

    /**
     * Obtiene información detallada de la capa base actual
     * @returns {Object} Información de la capa base y atribuciones
     */
    getBaseLayerInfo() {
        let layerName = 'Desconocido';
        let attribution = '';

        this.map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer && layer.options) {
                // Detectar capas de MapTiler
                if (layer.options.style) {
                    const styleName = layer.options.style;
                    layerName = `MapTiler ${styleName}`;
                    attribution = '© MapTiler © OpenStreetMap contributors';
                } else if (layer._url && layer._url.includes('maptiler')) {
                    layerName = 'MapTiler';
                    attribution = '© MapTiler © OpenStreetMap contributors';
                } else if (layer._url && layer._url.includes('google')) {
                    layerName = 'Google Satellite';
                    attribution = '© Google © Satellite imagery';
                } else if (layer._url) {
                    layerName = 'Tile Layer';
                    attribution = layer.options.attribution || '';
                }

                // Si la capa tiene atribución específica, usarla
                if (layer.options.attribution) {
                    attribution = layer.options.attribution;
                }
            }
        });

        return {
            name: layerName,
            attribution: attribution
        };
    }

    /**
     * Espera a que todos los tiles del mapa esten completamente cargados
     * @returns {Promise<void>}
     */
    async waitForTilesToLoad() {
        return new Promise((resolve) => {
            const startTime = Date.now();
            let checkCount = 0;

            const checkTiles = () => {
                checkCount++;
                const elapsed = Date.now() - startTime;

                if (elapsed > this.maxWaitTime) {
                    console.warn(`Timeout esperando tiles despues de ${elapsed}ms (${checkCount} verificaciones) - procediendo con la captura`);
                    resolve();
                    return;
                }

                const tilesLoaded = this.areAllTilesLoaded();
                const status = this.getTileLoadingStatus();

                if (checkCount % 10 === 0) {
                    console.log(`Verificacion ${checkCount}: ${status.loadedTiles}/${status.totalTiles} tiles cargados`);
                }

                if (tilesLoaded) {
                    console.log(`Todos los tiles cargados despues de ${elapsed}ms (${checkCount} verificaciones)`);
                    resolve();
                } else {
                    setTimeout(checkTiles, this.tileCheckInterval);
                }
            };

            console.log('Iniciando espera de carga de tiles...');
            checkTiles();
        });
    }

    /**
     * Verifica si todos los tiles del mapa estan cargados
     * @returns {boolean}
     */
    areAllTilesLoaded() {
        let allLoaded = true;

        this.map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                const container = layer.getContainer();
                if (container) {
                    const tiles = container.querySelectorAll('img');
                    tiles.forEach((tile) => {
                        if (!tile.complete || tile.naturalWidth === 0) {
                            allLoaded = false;
                        }
                    });
                }

                if (layer._loading || (layer._tiles && Object.keys(layer._tiles).length === 0)) {
                    allLoaded = false;
                }
            }

            if (layer instanceof L.Marker && layer._icon) {
                const img = layer._icon.querySelector('img');
                if (img && (!img.complete || img.naturalWidth === 0)) {
                    allLoaded = false;
                }
            }
        });

        return allLoaded;
    }

    /**
     * Realiza la captura del mapa usando leaflet-image
     * @param {ExportConfiguration} config
     * @returns {Promise<HTMLCanvasElement>}
     */
    async performCapture(config) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('Iniciando captura del mapa...');

                const canvas = await this.performSimpleCapture();

                // Create a new canvas with padding for the shadow
                const padding = 20; // 20px padding
                const newCanvas = document.createElement('canvas');
                newCanvas.width = canvas.width + padding * 2;
                newCanvas.height = canvas.height + padding * 2;
                const ctx = newCanvas.getContext('2d');

                // Draw the original canvas onto the new one with an offset
                ctx.drawImage(canvas, padding, padding);

                console.log('Captura con padding completada');
                resolve(newCanvas);

            } catch (error) {
                console.error('Error en performCapture:', error);
                reject(new Error('No se pudo capturar el mapa: ' + error.message));
            }
        });
    }

    /**
     * Cambia temporalmente a un mapa base compatible con exportacion
     * @returns {Promise<Object>}
     */
    async switchToExportFriendlyBasemap() {
        return new Promise((resolve) => {
            try {
                if (!this.map.isBasemapActive) {
                    console.log('El mapa base está inactivo, no se cambiará para la exportación.');
                    resolve({ originalLayer: null, temporaryLayer: null });
                    return;
                }

                console.log('Cambiando a mapa base compatible con exportacion...');

                let currentBaseLayer = null;

                this.map.eachLayer((layer) => {
                    if (layer instanceof L.TileLayer) {
                        if (layer.options && (
                            (layer.options.attribution && layer.options.attribution.includes('MapTiler')) ||
                            (layer.options.attribution && layer.options.attribution.includes('Google')) ||
                            (layer._url && (layer._url.includes('maptiler') || layer._url.includes('google')))
                        )) {
                            currentBaseLayer = layer;
                        }
                    }
                });

                const exportFriendlyLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: 'OpenStreetMap contributors',
                    maxZoom: 19,
                    crossOrigin: null
                });

                if (currentBaseLayer) {
                    this.map.removeLayer(currentBaseLayer);
                }

                exportFriendlyLayer.addTo(this.map);

                console.log('Mapa base cambiado a OpenStreetMap para exportacion');

                resolve({
                    originalLayer: currentBaseLayer,
                    temporaryLayer: exportFriendlyLayer
                });
            } catch (error) {
                console.error('Error cambiando mapa base:', error);
                resolve({ originalLayer: null, temporaryLayer: null });
            }
        });
    }

    /**
     * Restaura el mapa base original despues de la exportacion
     * @param {Object} originalInfo
     * @returns {Promise<void>}
     */
    async restoreOriginalBasemap(originalInfo) {
        return new Promise((resolve) => {
            try {
                console.log('Restaurando mapa base original...');

                if (!originalInfo) {
                    resolve();
                    return;
                }

                if (originalInfo.temporaryLayer) {
                    this.map.removeLayer(originalInfo.temporaryLayer);
                }

                if (originalInfo.originalLayer) {
                    originalInfo.originalLayer.addTo(this.map);
                }

                console.log('Mapa base original restaurado');
                resolve();
            } catch (error) {
                console.error('Error restaurando mapa base:', error);
                resolve();
            }
        });
    }

    /**
     * Captura simple usando leaflet-image
     * @returns {Promise<HTMLCanvasElement>}
     */
    async performSimpleCapture() {
        return new Promise((resolve, reject) => {
            try {
                console.log('Captura simple con leaflet-image...');

                leafletImage(this.map, (err, canvas) => {
                    if (err) {
                        console.error('Error en leaflet-image simple:', err);
                        reject(new Error('Error en captura simple: ' + err.message));
                        return;
                    }

                    if (!canvas || canvas.width === 0 || canvas.height === 0) {
                        reject(new Error('Canvas simple invalido'));
                        return;
                    }

                    console.log('Captura simple completada: ' + canvas.width + 'x' + canvas.height);
                    resolve(canvas);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Crea un canvas basico con informacion del mapa cuando todo falla
     * @returns {Promise<HTMLCanvasElement>}
     */
    async createBasicMapCanvas() {
        return new Promise((resolve) => {
            try {
                const size = this.map.getSize();
                const canvas = document.createElement('canvas');
                canvas.width = size.x;
                canvas.height = size.y;
                const ctx = canvas.getContext('2d');

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = '#333333';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';

                const center = this.map.getCenter();
                const zoom = this.map.getZoom();

                ctx.fillText('Mapa SNIEn', canvas.width / 2, canvas.height / 2 - 40);
                ctx.fillText('Centro: ' + center.lat.toFixed(4) + ', ' + center.lng.toFixed(4), canvas.width / 2, canvas.height / 2);
                ctx.fillText('Zoom: ' + zoom, canvas.width / 2, canvas.height / 2 + 40);
                ctx.fillText('(Vista previa no disponible)', canvas.width / 2, canvas.height / 2 + 80);

                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 2;
                ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

                console.log('Canvas basico creado como ultimo recurso');
                resolve(canvas);

            } catch (error) {
                console.error('Error creando canvas basico:', error);
                const canvas = document.createElement('canvas');
                canvas.width = 800;
                canvas.height = 600;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                resolve(canvas);
            }
        });
    }
}