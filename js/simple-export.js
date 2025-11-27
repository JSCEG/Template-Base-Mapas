/**
 * Sistema de exportación simplificado para mapas
 * Usa dom-to-image para capturar el mapa como PNG
 */

(function () {
    'use strict';

    // Esperar a que el DOM esté listo
    document.addEventListener('DOMContentLoaded', function () {
        const exportBtn = document.getElementById('export-map-btn');
        const exportWordBtn = document.getElementById('export-word-btn');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const exitFullscreenBtn = document.getElementById('exit-fullscreen-btn');
        const exportFullscreenBtn = document.getElementById('export-fullscreen-btn');
        const exportWordFullscreenBtn = document.getElementById('export-word-fullscreen-btn');
        const mapContainer = document.getElementById('map');
        const mapCard = document.querySelector('.map-card');
        const mapDescription = document.getElementById('map-description');
        const cardFooter = document.querySelector('.card-footer');

        if (!exportBtn || !mapContainer) {
            console.warn('Botón de exportación o contenedor de mapa no encontrado');
            return;
        }

        // Verificar si el mapa base actual es de MapTiler
        function isMapTilerActive() {
            // Acceder a las variables globales del map-config.js
            if (typeof window.currentBaseLayerName === 'undefined') {
                return false;
            }

            const mapTilerLayers = ['SENER Azul', 'SENER Light', 'SENER Oscuro'];
            return mapTilerLayers.includes(window.currentBaseLayerName);
        }

        // Mostrar modal de advertencia de MapTiler
        function showMapTilerWarning() {
            const modal = document.getElementById('maptiler-warning-modal');
            if (modal) {
                modal.style.display = 'flex';
                modal.setAttribute('aria-hidden', 'false');

                // Cerrar modal
                const closeButtons = modal.querySelectorAll('.maptiler-warning-close, .modal-overlay');
                closeButtons.forEach(btn => {
                    btn.addEventListener('click', function () {
                        modal.style.display = 'none';
                        modal.setAttribute('aria-hidden', 'true');
                    });
                });
            }
        }

        // Esperar a que todos los tiles se carguen
        function waitForTiles() {
            return new Promise((resolve) => {
                if (!window.map) {
                    resolve();
                    return;
                }

                let tilesLoading = 0;
                let tilesLoaded = 0;

                window.map.eachLayer(layer => {
                    if (layer instanceof L.TileLayer) {
                        layer.on('tileloadstart', () => tilesLoading++);
                        layer.on('tileload', () => {
                            tilesLoaded++;
                            if (tilesLoaded >= tilesLoading && tilesLoading > 0) {
                                setTimeout(resolve, 500);
                            }
                        });
                        layer.on('tileerror', () => {
                            tilesLoaded++;
                            if (tilesLoaded >= tilesLoading && tilesLoading > 0) {
                                setTimeout(resolve, 500);
                            }
                        });
                    }
                });

                // Timeout de seguridad
                setTimeout(() => resolve(), 3000);
            });
        }

        function prepareLayoutForExport() {
            if (!mapContainer) {
                return () => { };
            }

            const layoutState = {
                map: {
                    overflow: mapContainer.style.overflow,
                    clipPath: mapContainer.style.clipPath
                },
                controls: [],
                legends: []
            };

            mapContainer.style.overflow = 'visible';
            mapContainer.style.clipPath = 'none';

            const controlElements = document.querySelectorAll('.leaflet-control-container .leaflet-control');
            controlElements.forEach(control => {
                layoutState.controls.push({
                    element: control,
                    overflow: control.style.overflow,
                    clipPath: control.style.clipPath
                });

                control.style.overflow = 'visible';
                control.style.clipPath = 'none';
            });

            const legendElements = document.querySelectorAll('.info.legend');
            legendElements.forEach(legend => {
                layoutState.legends.push({
                    element: legend,
                    paddingBottom: legend.style.paddingBottom,
                    marginBottom: legend.style.marginBottom,
                    overflow: legend.style.overflow,
                    clipPath: legend.style.clipPath
                });

                legend.style.overflow = 'visible';
                legend.style.clipPath = 'none';
                legend.style.paddingBottom = '24px';
                legend.style.marginBottom = '8px';
            });

            return () => {
                if (mapContainer) {
                    mapContainer.style.overflow = layoutState.map.overflow;
                    mapContainer.style.clipPath = layoutState.map.clipPath;
                }

                layoutState.controls.forEach(state => {
                    state.element.style.overflow = state.overflow;
                    state.element.style.clipPath = state.clipPath;
                });

                layoutState.legends.forEach(state => {
                    state.element.style.overflow = state.overflow;
                    state.element.style.clipPath = state.clipPath;
                    state.element.style.paddingBottom = state.paddingBottom;
                    state.element.style.marginBottom = state.marginBottom;
                });
            };
        }

        // Función helper para actualizar AMBOS overlays de progreso
        function updateAllProgressOverlays(message, percentage) {
            const overlays = [
                document.getElementById('export-progress-overlay'),
                document.getElementById('map-export-progress-overlay')
            ];
            
            overlays.forEach(overlay => {
                if (!overlay) return;
                const msg = overlay.querySelector('.progress-message');
                const pct = overlay.querySelector('.progress-percentage');
                const fill = overlay.querySelector('.progress-fill');
                if (msg) msg.textContent = message;
                if (pct) pct.textContent = percentage;
                if (fill) fill.style.width = percentage;
            });
        }
        
        // Exportar mapa optimizado para Word (tamaño carta, 300 DPI)
        async function exportMapForWord() {
            // Verificar si MapTiler está activo
            if (isMapTilerActive()) {
                showMapTilerWarning();
                return;
            }

            // Mostrar AMBOS overlays de progreso (principal y del mapa)
            const progressOverlay = document.getElementById('export-progress-overlay');
            const mapProgressOverlay = document.getElementById('map-export-progress-overlay');
            
            const progressMessage = progressOverlay ? progressOverlay.querySelector('.progress-message') : null;
            const progressPercentage = progressOverlay ? progressOverlay.querySelector('.progress-percentage') : null;
            const progressFill = progressOverlay ? progressOverlay.querySelector('.progress-fill') : null;
            
            const mapProgressMessage = mapProgressOverlay ? mapProgressOverlay.querySelector('.progress-message') : null;
            const mapProgressPercentage = mapProgressOverlay ? mapProgressOverlay.querySelector('.progress-percentage') : null;
            const mapProgressFill = mapProgressOverlay ? mapProgressOverlay.querySelector('.progress-fill') : null;

            if (progressOverlay) {
                progressOverlay.style.display = 'flex';
                if (progressMessage) progressMessage.textContent = 'Optimizando para Word...';
                if (progressPercentage) progressPercentage.textContent = '10%';
                if (progressFill) progressFill.style.width = '10%';
            }
            
            if (mapProgressOverlay) {
                mapProgressOverlay.style.display = 'flex';
                if (mapProgressMessage) mapProgressMessage.textContent = 'Optimizando para Word...';
                if (mapProgressPercentage) mapProgressPercentage.textContent = '10%';
                if (mapProgressFill) mapProgressFill.style.width = '10%';
            }

            // Ocultar todos los controles
            const layersControl = document.querySelector('.leaflet-control-layers');
            const layersControlWasVisible = layersControl && layersControl.style.display !== 'none';
            if (layersControl) layersControl.style.display = 'none';

            const fullscreenControls = document.getElementById('fullscreen-controls');
            const fullscreenControlsWasVisible = fullscreenControls && fullscreenControls.style.display !== 'none';
            if (fullscreenControls) fullscreenControls.style.display = 'none';

            const attribution = document.querySelector('.leaflet-control-attribution');
            const attributionWasVisible = attribution && attribution.style.display !== 'none';
            if (attribution) attribution.style.display = 'none';

            const scaleControl = document.querySelector('.leaflet-control-scale');
            const scaleControlWasVisible = scaleControl && scaleControl.style.display !== 'none';
            if (scaleControl) scaleControl.style.display = 'none';

            const fullscreenToolbar = document.getElementById('fullscreen-toolbar');
            const fullscreenToolbarWasVisible = fullscreenToolbar && fullscreenToolbar.style.display !== 'none';
            if (fullscreenToolbar) fullscreenToolbar.style.display = 'none';

            // Mostrar temporalmente el título del mapa si estamos en pantalla completa
            const mapTitle = document.getElementById('map-title-display');
            let mapTitleOriginalDisplay = '';
            const isFullscreen = document.fullscreenElement !== null;

            if (mapTitle && isFullscreen) {
                mapTitleOriginalDisplay = mapTitle.style.display;
                mapTitle.style.display = 'block';
                mapTitle.style.visibility = 'visible';
            }

            const restoreLayout = prepareLayoutForExport();
            let mapDescriptionOriginalDisplay = '';
            let cardFooterOriginalDisplay = '';

            try {
                console.log('🔄 Esperando carga de tiles para exportación Word...');
                await waitForTiles();

                // Ocultar descripción y pie de página del mapa
                if (mapDescription) {
                    mapDescriptionOriginalDisplay = mapDescription.style.display;
                    mapDescription.style.display = 'none';
                }
                if (cardFooter) {
                    cardFooterOriginalDisplay = cardFooter.style.display;
                    cardFooter.style.display = 'none';
                }

                updateAllProgressOverlays('Capturando imagen optimizada...', '50%');

                console.log('🔄 Capturando imagen optimizada para Word (300 DPI, Alta Calidad)...');

                // Calcular dimensiones manteniendo aspect ratio del contenedor
                // Escala 6x para obtener ~300 DPI en documentos Word
                const scale = 6;
                const mapContentWrapper = document.querySelector('.map-content-wrapper');
                const targetWidth = mapContentWrapper.offsetWidth * scale;
                const targetHeight = mapContentWrapper.offsetHeight * scale;

                const dataUrl = await domtoimage.toPng(mapContentWrapper, {
                    quality: 1.0,
                    width: targetWidth,
                    height: targetHeight,
                    style: {
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        '-webkit-font-smoothing': 'antialiased',
                        '-moz-osx-font-smoothing': 'grayscale',
                        'text-rendering': 'optimizeLegibility'
                    },
                    cacheBust: true,
                    bgcolor: '#ffffff',
                    filter: function (node) {
                        const idsToExclude = [
                            'fullscreen-controls',
                            'fullscreen-toolbar',
                            'toggle-insets-btn',
                            'toggle-labels-btn'
                        ];
                        if (node.id && idsToExclude.includes(node.id)) {
                            return false;
                        }

                        if (node.classList) {
                            const classesToExclude = [
                                'leaflet-control-zoom',
                                'leaflet-control-layers',
                                'leaflet-control-attribution',
                                'leaflet-control-scale',
                                'fullscreen-controls',
                                'fullscreen-control-btn',
                                'fullscreen-toolbar'
                            ];
                            for (let i = 0; i < classesToExclude.length; i++) {
                                if (node.classList.contains(classesToExclude[i])) {
                                    return false;
                                }
                            }
                        }
                        return true;
                    }
                });

                updateAllProgressOverlays('Descargando imagen...', '90%');

                // Descargar imagen con identificador especial para Word
                const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                const mapTitle = window.currentMapTitle || 'mapa_snien';
                const filename = `${mapTitle.replace(/\s+/g, '_')}_WORD_${timestamp}.png`;

                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                updateAllProgressOverlays('¡Exportación completada!', '100%');

                console.log('✅ Exportación para Word completada:', filename);
                console.log(`📐 Dimensiones optimizadas: ${targetWidth}x${targetHeight}px (Escala 6x para 300 DPI)`);

                if (typeof showNotification === 'function') {
                    showNotification(
                        'Exportación para Word completada',
                        `Imagen optimizada (6x, ~300 DPI) guardada como: ${filename}`,
                        'success'
                    );
                }

                // Cerrar AMBOS overlays y restaurar controles
                setTimeout(() => {
                    if (progressOverlay) progressOverlay.style.display = 'none';
                    if (mapProgressOverlay) mapProgressOverlay.style.display = 'none';
                    if (layersControl && layersControlWasVisible) layersControl.style.display = '';
                    if (fullscreenControls && fullscreenControlsWasVisible) fullscreenControls.style.display = '';
                    if (attribution && attributionWasVisible) attribution.style.display = '';
                    if (scaleControl && scaleControlWasVisible) scaleControl.style.display = '';
                    if (fullscreenToolbar && fullscreenToolbarWasVisible) fullscreenToolbar.style.display = '';
                }, 1000);

            } catch (error) {
                console.error('❌ Error en exportación para Word:', error);

                // Restaurar todos los controles
                if (layersControl && layersControlWasVisible) layersControl.style.display = '';
                if (fullscreenControls && fullscreenControlsWasVisible) fullscreenControls.style.display = '';
                if (attribution && attributionWasVisible) attribution.style.display = '';
                if (scaleControl && scaleControlWasVisible) scaleControl.style.display = '';
                if (fullscreenToolbar && fullscreenToolbarWasVisible) fullscreenToolbar.style.display = '';

                if (typeof showNotification === 'function') {
                    showNotification('Error en exportación', error.message, 'error');
                }

                if (progressOverlay) progressOverlay.style.display = 'none';
            } finally {
                // Restaurar descripción y pie de página del mapa
                if (mapDescription) {
                    mapDescription.style.display = mapDescriptionOriginalDisplay;
                }
                if (cardFooter) {
                    cardFooter.style.display = cardFooterOriginalDisplay;
                }

                // Restaurar el título del mapa a su estado original
                if (mapTitle && isFullscreen) {
                    mapTitle.style.display = mapTitleOriginalDisplay;
                    mapTitle.style.visibility = '';
                }

                restoreLayout();
            }
        }

        // Exportar mapa como PNG usando dom-to-image
        async function exportMapAsPNG() {
            // Verificar si MapTiler está activo
            if (isMapTilerActive()) {
                showMapTilerWarning();
                return;
            }

            // Mostrar AMBOS overlays de progreso
            const progressOverlay = document.getElementById('export-progress-overlay');
            const mapProgressOverlay = document.getElementById('map-export-progress-overlay');

            if (progressOverlay) progressOverlay.style.display = 'flex';
            if (mapProgressOverlay) mapProgressOverlay.style.display = 'flex';
            
            updateAllProgressOverlays('Esperando carga de tiles...', '10%');

            // Ocultar control de capas temporalmente
            const layersControl = document.querySelector('.leaflet-control-layers');
            const layersControlWasVisible = layersControl && layersControl.style.display !== 'none';
            if (layersControl) {
                layersControl.style.display = 'none';
            }

            // Ocultar botones flotantes de pantalla completa
            const fullscreenControls = document.getElementById('fullscreen-controls');
            const fullscreenControlsWasVisible = fullscreenControls && fullscreenControls.style.display !== 'none';
            if (fullscreenControls) {
                fullscreenControls.style.display = 'none';
            }

            // Ocultar atribución de Leaflet (créditos de tiles)
            const attribution = document.querySelector('.leaflet-control-attribution');
            const attributionWasVisible = attribution && attribution.style.display !== 'none';
            if (attribution) {
                attribution.style.display = 'none';
            }

            // Ocultar control de escala
            const scaleControl = document.querySelector('.leaflet-control-scale');
            const scaleControlWasVisible = scaleControl && scaleControl.style.display !== 'none';
            if (scaleControl) {
                scaleControl.style.display = 'none';
            }

            // Ocultar toolbar de pantalla completa
            const fullscreenToolbar = document.getElementById('fullscreen-toolbar');
            const fullscreenToolbarWasVisible = fullscreenToolbar && fullscreenToolbar.style.display !== 'none';
            if (fullscreenToolbar) {
                fullscreenToolbar.style.display = 'none';
            }

            const restoreLayout = prepareLayoutForExport();
            let mapDescriptionOriginalDisplay = '';
            let cardFooterOriginalDisplay = '';

            try {
                console.log('🔄 Esperando carga de tiles...');
                await waitForTiles();

                // Ocultar descripción y pie de página del mapa
                if (mapDescription) {
                    mapDescriptionOriginalDisplay = mapDescription.style.display;
                    mapDescription.style.display = 'none';
                }
                if (cardFooter) {
                    cardFooterOriginalDisplay = cardFooter.style.display;
                    cardFooter.style.display = 'none';
                }

                updateAllProgressOverlays('Capturando imagen del mapa...', '50%');

                console.log('🔄 Capturando imagen con dom-to-image (Calidad 4x - Alta Resolución)...');

                // Usar dom-to-image para capturar con máxima calidad
                // Escala 4x para imágenes de alta resolución
                const scale = 4;
                const mapContentWrapper = document.querySelector('.map-content-wrapper');
                const dataUrl = await domtoimage.toPng(mapContentWrapper, {
                    quality: 1.0,
                    width: mapContentWrapper.offsetWidth * scale,
                    height: mapContentWrapper.offsetHeight * scale,
                    style: {
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        // Mejorar renderizado de texto
                        '-webkit-font-smoothing': 'antialiased',
                        '-moz-osx-font-smoothing': 'grayscale',
                        'text-rendering': 'optimizeLegibility'
                    },
                    cacheBust: true,
                    // Configuración adicional para mejor calidad
                    bgcolor: '#ffffff',
                    filter: function (node) {
                        const idsToExclude = [
                            'fullscreen-controls',
                            'fullscreen-toolbar',
                            'toggle-insets-btn',
                            'toggle-labels-btn'
                        ];
                        if (node.id && idsToExclude.includes(node.id)) {
                            return false;
                        }

                        if (node.classList) {
                            const classesToExclude = [
                                'leaflet-control-zoom',
                                'leaflet-control-layers',
                                'leaflet-control-attribution',
                                'leaflet-control-scale',
                                'fullscreen-controls',
                                'fullscreen-control-btn',
                                'fullscreen-toolbar'
                            ];
                            for (let i = 0; i < classesToExclude.length; i++) {
                                if (node.classList.contains(classesToExclude[i])) {
                                    return false;
                                }
                            }
                        }
                        return true;
                    }
                });

                updateAllProgressOverlays('Descargando imagen...', '90%');

                // Descargar imagen
                const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                const mapTitle = window.currentMapTitle || 'mapa_snien';
                const filename = `${mapTitle.replace(/\s+/g, '_')}_${timestamp}.png`;

                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                updateAllProgressOverlays('¡Exportación completada!', '100%');

                const finalWidth = mapContainer.offsetWidth * scale;
                const finalHeight = mapContainer.offsetHeight * scale;
                console.log('✅ Exportación completada:', filename);
                console.log(`📐 Dimensiones: ${finalWidth}x${finalHeight}px (Escala ${scale}x)`);

                // Mostrar notificación de éxito
                if (typeof showNotification === 'function') {
                    showNotification(
                        'Exportación completada',
                        `Imagen de alta resolución (${scale}x) guardada como: ${filename}`,
                        'success'
                    );
                }

                // Cerrar overlay después de un momento
                setTimeout(() => {
                    if (progressOverlay) progressOverlay.style.display = 'none';
                    if (mapProgressOverlay) mapProgressOverlay.style.display = 'none';

                    // Restaurar control de capas
                    if (layersControl && layersControlWasVisible) {
                        layersControl.style.display = '';
                    }

                    // Restaurar botones flotantes
                    if (fullscreenControls && fullscreenControlsWasVisible) {
                        fullscreenControls.style.display = '';
                    }

                    // Restaurar atribución
                    if (attribution && attributionWasVisible) {
                        attribution.style.display = '';
                    }

                    // Restaurar control de escala
                    if (scaleControl && scaleControlWasVisible) {
                        scaleControl.style.display = '';
                    }

                    // Restaurar toolbar de pantalla completa
                    if (fullscreenToolbar && fullscreenToolbarWasVisible) {
                        fullscreenToolbar.style.display = '';
                    }
                }, 1000);

            } catch (error) {
                console.error('❌ Error en exportación:', error);

                // Restaurar todos los controles en caso de error
                if (layersControl && layersControlWasVisible) {
                    layersControl.style.display = '';
                }

                if (fullscreenControls && fullscreenControlsWasVisible) {
                    fullscreenControls.style.display = '';
                }

                if (attribution && attributionWasVisible) {
                    attribution.style.display = '';
                }

                if (scaleControl && scaleControlWasVisible) {
                    scaleControl.style.display = '';
                }

                if (fullscreenToolbar && fullscreenToolbarWasVisible) {
                    fullscreenToolbar.style.display = '';
                }

                if (typeof showNotification === 'function') {
                    showNotification('Error en exportación', error.message, 'error');
                }

                if (progressOverlay) progressOverlay.style.display = 'none';
            } finally {
                // Restaurar descripción y pie de página del mapa
                if (mapDescription) {
                    mapDescription.style.display = mapDescriptionOriginalDisplay;
                }
                if (cardFooter) {
                    cardFooter.style.display = cardFooterOriginalDisplay;
                }
                restoreLayout();
            }
        }

        // Toggle pantalla completa
        function toggleFullscreen() {
            if (!mapCard) return;

            if (!document.fullscreenElement) {
                // Entrar en pantalla completa
                mapCard.requestFullscreen().catch(err => {
                    console.error('Error al entrar en pantalla completa:', err);
                });

                // Invalidar tamaño del mapa después de un momento
                setTimeout(() => {
                    if (window.map && window.map.invalidateSize) {
                        window.map.invalidateSize();
                    }
                }, 100);

                if (fullscreenBtn) {
                    fullscreenBtn.querySelector('i').className = 'bi bi-fullscreen-exit';
                    fullscreenBtn.title = 'Salir de pantalla completa';
                }
            } else {
                // Salir de pantalla completa
                document.exitFullscreen();

                // Invalidar tamaño del mapa después de un momento
                setTimeout(() => {
                    if (window.map && window.map.invalidateSize) {
                        window.map.invalidateSize();
                    }
                }, 100);

                if (fullscreenBtn) {
                    fullscreenBtn.querySelector('i').className = 'bi bi-arrows-fullscreen';
                    fullscreenBtn.title = 'Pantalla completa';
                }
            }
        }

        // Event listeners
        exportBtn.addEventListener('click', function (e) {
            // Prevenir que el click se propague al mapa
            e.stopPropagation();
            e.preventDefault();
            exportMapAsPNG();
        });

        if (exportWordBtn) {
            exportWordBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                exportMapForWord();
            });
        }

        if (exportWordFullscreenBtn) {
            exportWordFullscreenBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                exportMapForWord();
            });
        }

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', function (e) {
                // Prevenir que el click se propague al mapa
                e.stopPropagation();
                e.preventDefault();
                toggleFullscreen();
            });
        }

        if (exitFullscreenBtn) {
            exitFullscreenBtn.addEventListener('click', function (e) {
                // Prevenir que el click se propague al mapa
                e.stopPropagation();
                e.preventDefault();
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                }
            });
        }

        if (exportFullscreenBtn) {
            exportFullscreenBtn.addEventListener('click', function (e) {
                // Prevenir que el click se propague al mapa
                e.stopPropagation();
                e.preventDefault();
                exportMapAsPNG();
            });
        }

        // Listener para cambios de pantalla completa
        document.addEventListener('fullscreenchange', function () {
            // Invalidar tamaño del mapa cuando cambia el estado de pantalla completa
            setTimeout(() => {
                if (window.map && window.map.invalidateSize) {
                    window.map.invalidateSize();
                }
            }, 100);

            if (fullscreenBtn) {
                if (document.fullscreenElement) {
                    fullscreenBtn.querySelector('i').className = 'bi bi-fullscreen-exit';
                    fullscreenBtn.title = 'Salir de pantalla completa (ESC)';
                } else {
                    fullscreenBtn.querySelector('i').className = 'bi bi-arrows-fullscreen';
                    fullscreenBtn.title = 'Pantalla completa';
                }
            }
        });

        // Prevenir propagación de clicks en el contenedor de controles flotantes
        const fullscreenControlsContainer = document.getElementById('fullscreen-controls');
        if (fullscreenControlsContainer) {
            fullscreenControlsContainer.addEventListener('click', function (e) {
                e.stopPropagation();
            });
            fullscreenControlsContainer.addEventListener('mousedown', function (e) {
                e.stopPropagation();
            });
            fullscreenControlsContainer.addEventListener('mouseup', function (e) {
                e.stopPropagation();
            });
        }

        console.log('✅ Sistema de exportación simplificado inicializado');
    });
})();
