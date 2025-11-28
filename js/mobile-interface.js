/**
 * Mobile Interface Controller
 * Maneja la interfaz estilo Google Maps para dispositivos móviles
 */

class MobileInterface {
    constructor() {
        // Forzar interfaz móvil en todas las pantallas
        this.isMobile = true;
        this.bottomSheet = null;
        this.sideDrawer = null;
        this.searchModal = null;
        this.drawerOverlay = null;
        this.isBottomSheetExpanded = false;
        this.touchStartY = 0;
        this.currentBottomSheetY = 0;
        this.isAnalysisActive = false;

        this.init();
    }

    init() {
        this.createMobileElements();
        this.attachEventListeners();
        this.setupTouchHandlers();
    }

    attachEventListeners() {
        // Este método se puede usar para event listeners globales si es necesario
        // Por ahora, los event listeners se agregan en cada método create*
    }

    createMobileElements() {






        // Crear botón de capas (bottom-left)
        this.createLayersButton();



        // Crear bottom sheet
        this.createBottomSheet();

        // Configurar manejadores de zoom
        this.setupZoomHandlers();




    }











    createLayersButton() {
        // Botón de menú principal
        const btn = document.createElement('button');
        btn.className = 'mobile-menu-toggle-btn';
        btn.innerHTML = `
            <i class="bi bi-list"></i>
            <span>Menú</span>
        `;
        btn.setAttribute('aria-label', 'Menú principal');
        document.body.appendChild(btn);

        // Crear menú flotante
        const menu = document.createElement('div');
        menu.className = 'mobile-floating-menu';
        menu.innerHTML = `
            <button class="mobile-floating-menu-item" data-tab="controls">
                <i class="bi bi-sliders"></i>
                <span>Controles</span>
            </button>
            <button class="mobile-floating-menu-item" data-tab="layers">
                <i class="bi bi-layers"></i>
                <span>Capas</span>
            </button>
            <button class="mobile-floating-menu-item" data-tab="info">
                <i class="bi bi-info-circle"></i>
                <span>Información</span>
            </button>
            <div style="height: 1px; background: #eee; margin: 0.5rem 0;"></div>
            <button class="mobile-floating-menu-item" data-action="search">
                <i class="bi bi-search"></i>
                <span>Buscar</span>
            </button>
            <button class="mobile-floating-menu-item" data-action="refresh">
                <i class="bi bi-arrow-clockwise"></i>
                <span>Actualizar datos</span>
            </button>
            <button class="mobile-floating-menu-item" data-action="export-word">
                <i class="bi bi-file-word"></i>
                <span>Exportar Word</span>
            </button>
            <button class="mobile-floating-menu-item" data-action="export-png">
                <i class="bi bi-download"></i>
                <span>Exportar PNG</span>
            </button>
            <div style="height: 1px; background: #eee; margin: 0.5rem 0;"></div>
            <button class="mobile-floating-menu-item" data-action="edit-data">
                <i class="bi bi-pencil-square"></i>
                <span>Editar datos</span>
            </button>
            <button class="mobile-floating-menu-item" data-action="view-data">
                <i class="bi bi-table"></i>
                <span>Ver datos</span>
            </button>
            <div style="height: 1px; background: #eee; margin: 0.5rem 0;"></div>
            <button class="mobile-floating-menu-item" data-tab="about">
                <i class="bi bi-book"></i>
                <span>Acerca de</span>
            </button>
        `;
        document.body.appendChild(menu);

        // Toggle menú flotante
        btn.addEventListener('click', () => {
            const isMenuActive = menu.classList.contains('active');
            if (isMenuActive) {
                menu.classList.remove('active');
            } else {
                menu.classList.add('active');
            }
        });

        // Manejar selección de opciones del menú
        menu.querySelectorAll('.mobile-floating-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const tabName = item.getAttribute('data-tab');
                const action = item.getAttribute('data-action');

                // Ocultar menú
                menu.classList.remove('active');

                if (tabName) {
                    // Expandir bottom sheet y cambiar al tab seleccionado
                    this.bottomSheet.classList.add('active');
                    this.expandBottomSheet();
                    this.switchBottomSheetTab(tabName);
                } else if (action) {
                    this.handleMenuAction(action);
                }
            });
        });
    }



    createBottomSheet() {
        const sheet = document.createElement('div');
        sheet.className = 'mobile-bottom-sheet collapsed';
        sheet.innerHTML = `
            <div class="bottom-sheet-handle"></div>
            <div class="bottom-sheet-header">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 class="bottom-sheet-title">Controles del Mapa</h3>
                        <p class="bottom-sheet-subtitle">Desliza para ver más opciones</p>
                    </div>
                    <button class="bottom-sheet-close-btn" style="background: none; border: none; font-size: 24px; color: #666; cursor: pointer; padding: 0.5rem;">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            </div>
            <div class="bottom-sheet-tabs">
                <button class="bottom-sheet-tab active" data-tab="controls">Controles</button>
                <button class="bottom-sheet-tab" data-tab="layers">Capas</button>
                <button class="bottom-sheet-tab" data-tab="info">Información</button>
                <button class="bottom-sheet-tab" data-tab="about">Acerca de</button>
            </div>
            <div class="bottom-sheet-content">
                <!-- Tab: Controles -->
                <div class="bottom-sheet-tab-content" data-content="controls">
                    <div class="bottom-sheet-controls">
                        <div class="bottom-sheet-control-group">
                            <label for="mobile-instrument-select">Instrumento</label>
                            <select id="mobile-instrument-select" class="control">
                                <option value="">Seleccione un instrumento</option>
                                <option value="PLADESE">PLADESE</option>
                                <option value="PRESAS">PRESAS</option>
                                <option value="MUNICIPIOS_RIOS">Municipios y Ríos</option>
                                <option value="PLADESHI">PLADESHI</option>
                                <option value="PLATEASE">PLATEASE</option>
                                <option value="PROSENER">PROSENER</option>
                                <option value="ELECTRICIDAD">Electricidad</option>
                                <option value="GAS NATURAL">Gas Natural</option>
                                <option value="GAS L.P.">Gas L.P.</option>
                                <option value="PETROLIFEROS">Petrolíferos</option>
                            </select>
                        </div>
                        <div class="bottom-sheet-control-group">
                            <label for="mobile-map-select">Mapa</label>
                            <select id="mobile-map-select" class="control" disabled>
                                <option value="">Seleccione un mapa</option>
                            </select>
                        </div>
                        <div class="bottom-sheet-control-group" id="mobile-search-group" style="display: none;">
                            <label for="mobile-permit-search">Buscar Presa</label>
                            <input type="text" id="mobile-permit-search" class="control" placeholder="ID de presa (1-5) o nombre">
                        </div>
                    </div>
                </div>
                
                <!-- Tab: Capas -->
                <div class="bottom-sheet-tab-content" data-content="layers" style="display: none;">
                    <div id="mobile-layers-container">
                        <p style="color: #666; padding: 1rem;">Selecciona un mapa para ver las capas disponibles.</p>
                    </div>
                </div>
                
                <!-- Tab: Información -->
                <div class="bottom-sheet-tab-content" data-content="info" style="display: none;">
                    <div id="mobile-map-info">
                        <div id="mobile-map-description" style="padding: 1rem;">
                            <h4 id="mobile-map-description-title" style="margin: 0 0 0.5rem 0; color: var(--color-gobmx-verde);"></h4>
                            <p id="mobile-map-description-content" style="margin: 0; color: #666; line-height: 1.6;"></p>
                        </div>
                        <div id="mobile-analysis-data" style="padding: 1rem; border-top: 1px solid #eee; display: none;">
                            <h4 style="margin: 0 0 1rem 0; color: var(--color-gobmx-verde);">Datos de Análisis</h4>
                            <div id="mobile-analysis-content"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Tab: Acerca de -->
                <div class="bottom-sheet-tab-content" data-content="about" style="display: none;">
                    <div style="padding: 1.5rem; text-align: center;">
                        <div style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                            <img src="img/logo_sener.png" alt="SENER" style="height: 60px;">
                            <img src="img/snien.png" alt="SNIEn" style="height: 50px;">
                        </div>
                        <h3 style="margin: 0 0 0.5rem 0; color: var(--color-gobmx-verde); font-size: 1.1rem;">Mapas Dinámicos de Presas</h3>
                        <p style="margin: 0 0 1rem 0; color: #666; font-size: 0.9rem;">Subsecretaría de Planeación y Transición Energética</p>
                        <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                            <p style="margin: 0; font-size: 0.85rem; color: #666;">
                                <strong>Fuente de datos:</strong><br>
                                Hoja de cálculo institucional publicada (Google Sheets)
                            </p>
                        </div>
                        <div id="mobile-last-updated" style="margin-top: 1rem; padding: 0.75rem; background: #e8f5e9; border-radius: 8px;">
                            <p style="margin: 0; font-size: 0.85rem; color: #2e7d32;">
                                <i class="bi bi-clock"></i> <strong>Última actualización:</strong> <span id="mobile-update-time">--</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(sheet);
        this.bottomSheet = sheet;

        // Sincronizar con los selectores principales
        this.syncBottomSheetControls();

        // Sincronizar información del mapa
        this.syncMapInfo();

        // Sincronizar capas
        this.syncLayers();
    }





    setupTouchHandlers() {
        if (!this.bottomSheet) return;

        const handle = this.bottomSheet.querySelector('.bottom-sheet-handle');
        const header = this.bottomSheet.querySelector('.bottom-sheet-header');
        const closeBtn = this.bottomSheet.querySelector('.bottom-sheet-close-btn');

        // Event listener para el botón de cerrar
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.collapseBottomSheet();
            });
        }

        [handle, header].forEach(element => {
            element.addEventListener('touchstart', (e) => {
                this.touchStartY = e.touches[0].clientY;
                this.currentBottomSheetY = this.bottomSheet.getBoundingClientRect().top;
            });

            element.addEventListener('touchmove', (e) => {
                const touchY = e.touches[0].clientY;
                const deltaY = touchY - this.touchStartY;

                // Solo permitir arrastrar hacia abajo si está expandido
                // o hacia arriba si está colapsado
                if ((this.isBottomSheetExpanded && deltaY > 0) ||
                    (!this.isBottomSheetExpanded && deltaY < 0)) {
                    const newY = this.currentBottomSheetY + deltaY;
                    this.bottomSheet.style.transform = `translateY(${newY}px)`;
                }
            });

            element.addEventListener('touchend', (e) => {
                const touchY = e.changedTouches[0].clientY;
                const deltaY = touchY - this.touchStartY;

                // Si se arrastró más de 50px, cambiar estado
                if (Math.abs(deltaY) > 50) {
                    if (deltaY > 0) {
                        this.collapseBottomSheet();
                    } else {
                        this.expandBottomSheet();
                    }
                } else {
                    // Volver al estado anterior
                    if (this.isBottomSheetExpanded) {
                        this.expandBottomSheet();
                    } else {
                        this.collapseBottomSheet();
                    }
                }

                this.bottomSheet.style.transform = '';
            });
        });

        // Tabs del bottom sheet
        this.bottomSheet.querySelectorAll('.bottom-sheet-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchBottomSheetTab(tabName);
            });
        });
    }

    syncBottomSheetControls() {
        const mainInstrumentSelect = document.getElementById('instrument-select');
        const mainMapSelect = document.getElementById('map-select');
        const mobileInstrumentSelect = document.getElementById('mobile-instrument-select');
        const mobileMapSelect = document.getElementById('mobile-map-select');
        const desktopSearchGroup = document.getElementById('search-group');
        const mobileSearchGroup = document.getElementById('mobile-search-group');

        if (!mainInstrumentSelect || !mobileInstrumentSelect) return;

        // Sincronizar instrumento
        mobileInstrumentSelect.addEventListener('change', (e) => {
            mainInstrumentSelect.value = e.target.value;
            mainInstrumentSelect.dispatchEvent(new Event('change'));
        });

        mainInstrumentSelect.addEventListener('change', (e) => {
            mobileInstrumentSelect.value = e.target.value;
        });

        // Sincronizar mapa
        if (mainMapSelect && mobileMapSelect) {
            mobileMapSelect.addEventListener('change', (e) => {
                mainMapSelect.value = e.target.value;
                mainMapSelect.dispatchEvent(new Event('change'));
            });

            mainMapSelect.addEventListener('change', (e) => {
                mobileMapSelect.innerHTML = mainMapSelect.innerHTML;
                mobileMapSelect.disabled = mainMapSelect.disabled;
                mobileMapSelect.value = e.target.value;
            });

            // Sincronizar estado inicial una vez
            mobileMapSelect.innerHTML = mainMapSelect.innerHTML;
            mobileMapSelect.disabled = mainMapSelect.disabled;
            mobileMapSelect.value = mainMapSelect.value;

            // Observer para detectar cambios dinámicos en el select principal
            const selectObserver = new MutationObserver(() => {
                if (mobileMapSelect.innerHTML !== mainMapSelect.innerHTML) {
                    const currentValue = mobileMapSelect.value;
                    mobileMapSelect.innerHTML = mainMapSelect.innerHTML;
                    mobileMapSelect.disabled = mainMapSelect.disabled;
                    // Restaurar valor si existe en las nuevas opciones
                    if (currentValue && Array.from(mobileMapSelect.options).some(opt => opt.value === currentValue)) {
                        mobileMapSelect.value = currentValue;
                    } else {
                        mobileMapSelect.value = mainMapSelect.value;
                    }
                }
            });
            selectObserver.observe(mainMapSelect, { childList: true, subtree: true });
        }

        // Copiar valor inicial de instrumento
        mobileInstrumentSelect.value = mainInstrumentSelect.value;


        // Sincronizar búsqueda y manejar búsqueda por ID
        const mainSearchInput = document.getElementById('permit-search');
        const mobileSearchInput = document.getElementById('mobile-permit-search');

        if (mainSearchInput && mobileSearchInput) {
            mobileSearchInput.addEventListener('input', (e) => {
                const val = e.target.value;

                // Verificar si es un número del 1 al 5
                if (/^[1-5]$/.test(val)) {
                    // Búsqueda por ID de presa
                    this.searchPresaById(parseInt(val));
                } else {
                    // Búsqueda normal (sincronizar con desktop)
                    mainSearchInput.value = val;
                    mainSearchInput.dispatchEvent(new Event('input'));
                }
            });
        }

        // Sincronizar visibilidad del buscador móvil con el desktop (#search-group)
        const syncMobileSearchVisibility = () => {
            if (!desktopSearchGroup || !mobileSearchGroup) return;
            // map-config.js establece explícitamente 'flex' o 'none'
            const visible = desktopSearchGroup.style.display !== 'none';
            mobileSearchGroup.style.display = visible ? 'block' : 'none';
        };
        syncMobileSearchVisibility();
        if (desktopSearchGroup) {
            const searchObserver = new MutationObserver(syncMobileSearchVisibility);
            searchObserver.observe(desktopSearchGroup, { attributes: true, attributeFilter: ['style'] });
        }
    }

    searchPresaById(id) {
        // Mapeo de IDs a nombres o coordenadas de presas
        // Asumiendo que window.presasDataLayers contiene las capas cargadas
        if (window.presasDataLayers) {
            let found = false;
            window.presasDataLayers.eachLayer(layer => {
                if (found) return;
                if (layer.feature && layer.feature.properties) {
                    const props = layer.feature.properties;
                    // Comparar con id o no (número), usando == para permitir coincidencia string/number
                    if (props.id == id || props.no == id || props.NO == id) {
                        // Centrar mapa y abrir popup/análisis
                        window.map.setView(layer.getLatLng(), 14);
                        layer.fire('click');
                        found = true;

                        // Cerrar teclado
                        document.activeElement.blur();

                        // Colapsar bottom sheet parcialmente para ver el mapa
                        this.collapseBottomSheet();
                    }
                }
            });

            if (!found) {
                console.log('Presa con ID ' + id + ' no encontrada en las capas cargadas.');
            }
        }
    }

    expandBottomSheet() {
        this.bottomSheet.classList.remove('collapsed');
        this.bottomSheet.classList.add('expanded');
        this.bottomSheet.classList.add('active'); // Necesario para que sea visible según CSS
        this.isBottomSheetExpanded = true;

        // Ocultar botón de menú
        const menuBtn = document.querySelector('.mobile-menu-toggle-btn');
        if (menuBtn) menuBtn.classList.add('hidden');
    }

    collapseBottomSheet() {
        this.bottomSheet.classList.remove('expanded');
        this.bottomSheet.classList.remove('active'); // Ocultar completamente
        this.bottomSheet.classList.add('collapsed');
        this.isBottomSheetExpanded = false;

        // Mostrar botón de menú
        const menuBtn = document.querySelector('.mobile-menu-toggle-btn');
        if (menuBtn) menuBtn.classList.remove('hidden');
    }

    toggleBottomSheet() {
        if (this.isBottomSheetExpanded) {
            this.collapseBottomSheet();
        } else {
            this.expandBottomSheet();
        }
    }

    switchBottomSheetTab(tabName) {
        // Expandir el Bottom Sheet si está colapsado
        if (!this.isBottomSheetExpanded) {
            this.expandBottomSheet();
        }

        // Actualizar tabs activos
        this.bottomSheet.querySelectorAll('.bottom-sheet-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Mostrar contenido correspondiente
        this.bottomSheet.querySelectorAll('.bottom-sheet-tab-content').forEach(content => {
            content.style.display = content.dataset.content === tabName ? 'block' : 'none';
        });
    }

    toggleSideDrawer() {
        this.sideDrawer.classList.toggle('open');
        this.drawerOverlay.classList.toggle('active');
    }

    closeSideDrawer() {
        this.sideDrawer.classList.remove('open');
        this.drawerOverlay.classList.remove('active');
    }



    handleSearch(query) {
        const resultsContainer = this.searchModal.querySelector('#mobile-search-results');

        if (query.length < 2) {
            resultsContainer.innerHTML = `
                <p style="text-align: center; color: #999; padding: 2rem;">
                    Escribe al menos 2 caracteres...
                </p>
            `;
            return;
        }

        // Aquí se integraría con la búsqueda existente
        // Por ahora, mostrar mensaje
        resultsContainer.innerHTML = `
            <p style="text-align: center; color: #999; padding: 2rem;">
                Buscando "${query}"...
            </p>
        `;

        // Trigger búsqueda en el sistema principal
        const mainSearchInput = document.getElementById('permit-search');
        if (mainSearchInput) {
            mainSearchInput.value = query;
            mainSearchInput.dispatchEvent(new Event('input'));
        }
    }

    handleDrawerAction(action) {
        this.closeSideDrawer();

        switch (action) {
            case 'refresh':
                document.getElementById('refresh-data')?.click();
                break;
            case 'export-png':
                document.getElementById('export-map-btn')?.click();
                break;
            case 'export-word':
                document.getElementById('export-word-btn')?.click();
                break;
            case 'fullscreen':
                {
                    const sheetInfo = document.getElementById('sheet-info');
                    const links = sheetInfo ? Array.from(sheetInfo.querySelectorAll('a')) : [];
                    const editLink = links.find(a => a.textContent && a.textContent.trim().toLowerCase() === 'editar datos');
                    console.log('[MOBILE EDIT] sheetInfo exists?', !!sheetInfo);
                    console.log('[MOBILE EDIT] links in #sheet-info:', links);
                    console.log('[MOBILE EDIT] editLink found?', !!editLink, editLink ? editLink.href : undefined);
                    if (editLink && editLink.href) {
                        window.open(editLink.href, '_blank', 'noopener,noreferrer');
                    } else {
                        // Fallback: derive URL from current map configuration
                        const instrumentSelect = document.getElementById('instrument-select');
                        const mapSelect = document.getElementById('map-select');
                        const instrumentName = instrumentSelect ? instrumentSelect.value : undefined;
                        const mapName = mapSelect ? mapSelect.value : undefined;
                        const configs = window.mapConfigurations || {};
                        const instrumentConfigs = instrumentName ? configs[instrumentName] || [] : [];
                        const mapConfig = instrumentConfigs.find(m => m && m.name === mapName);
                        console.log('[MOBILE EDIT][FALLBACK] instrument:', instrumentName, 'map:', mapName, 'config:', mapConfig);
                        const url = mapConfig && mapConfig.googleSheetEditUrl ? mapConfig.googleSheetEditUrl : undefined;
                        if (url) {
                            window.open(url, '_blank', 'noopener,noreferrer');
                        } else {
                            alert('No se encontró el enlace para editar datos.');
                        }
                    }
                    const sheetInfo2 = document.getElementById('sheet-info');
                    const links2 = sheetInfo2 ? Array.from(sheetInfo2.querySelectorAll('a')) : [];
                    const viewLink = links2.find(a => a.textContent && a.textContent.trim().toLowerCase() === 'ver datos');
                    console.log('[MOBILE VIEW] sheetInfo exists?', !!sheetInfo);
                    console.log('[MOBILE VIEW] links in #sheet-info:', links2);
                    console.log('[MOBILE VIEW] viewLink found?', !!viewLink, viewLink ? viewLink.href : undefined);
                    if (viewLink && viewLink.href) {
                        window.open(viewLink.href, '_blank', 'noopener,noreferrer');
                    } else {
                        // Fallback: derive URL from current map configuration and transform for display
                        const instrumentSelect = document.getElementById('instrument-select');
                        const mapSelect = document.getElementById('map-select');
                        const instrumentName = instrumentSelect ? instrumentSelect.value : undefined;
                        const mapName = mapSelect ? mapSelect.value : undefined;
                        const configs = window.mapConfigurations || {};
                        const instrumentConfigs = instrumentName ? configs[instrumentName] || [] : [];
                        const mapConfig = instrumentConfigs.find(m => m && m.name === mapName);
                        console.log('[MOBILE VIEW][FALLBACK] instrument:', instrumentName, 'map:', mapName, 'config:', mapConfig);
                        let url;
                        if (mapConfig && mapConfig.googleSheetUrl) {
                            // Prefer transformed display URL if function available
                            if (typeof window.getDisplaySheetUrl === 'function') {
                                try {
                                    url = window.getDisplaySheetUrl(mapConfig.googleSheetUrl);
                                } catch (e) {
                                    console.warn('[MOBILE VIEW][FALLBACK] getDisplaySheetUrl error:', e);
                                    url = mapConfig.googleSheetUrl;
                                }
                            } else {
                                url = mapConfig.googleSheetUrl;
                            }
                        }
                        if (url) {
                            window.open(url, '_blank', 'noopener,noreferrer');
                        } else {
                            alert('No se encontró el enlace para ver datos.');
                        }
                    }
                }
                break;
                legendContainer.style.background = '#f8f9fa';
                legendContainer.style.borderRadius = '8px';
                legendContainer.style.border = '1px solid #eee';

                // Limpiar estilos inline que puedan venir del control original y ajustar para móvil
                let cleanHtml = legendHtml.replace(/width: 22px;/g, 'width: 18px;'); // Iconos más pequeños
                cleanHtml = cleanHtml.replace(/font-size: 13px;/g, 'font-size: 14px;'); // Títulos más legibles

                legendContainer.innerHTML = cleanHtml;

                // Agregar al contenedor de capas
                layersContainer.appendChild(legendContainer);
        }


    }

    exportMap() {
        document.getElementById('export-map-btn')?.click();
    }

    centerOnLocation() {
        // Aquí se implementaría la geolocalización
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                // Centrar mapa en la ubicación del usuario
                if (window.map) {
                    window.map.setView([position.coords.latitude, position.coords.longitude], 13);
                }
            }, (error) => {
                alert('No se pudo obtener tu ubicación');
            });
        } else {
            alert('Tu navegador no soporta geolocalización');
        }
    }

    syncMapInfo() {
        // Sincronizar información del mapa desde el desktop
        const observer = new MutationObserver(() => {
            // Si estamos mostrando análisis personalizado, no sincronizar para evitar sobrescribir
            if (this.isAnalysisActive) return;

            const desktopTitle = document.getElementById('map-description-title');
            const desktopContent = document.getElementById('map-description-content');
            const mobileTitle = document.getElementById('mobile-map-description-title');
            const mobileContent = document.getElementById('mobile-map-description-content');

            if (desktopTitle && mobileTitle) {
                mobileTitle.innerHTML = desktopTitle.innerHTML;
            }
            if (desktopContent && mobileContent) {
                // Usar innerHTML para preservar el formato HTML
                mobileContent.innerHTML = desktopContent.innerHTML;
            }
        });

        const mapDescription = document.getElementById('map-description');
        if (mapDescription) {
            observer.observe(mapDescription, { childList: true, subtree: true, characterData: true });
        }

        // Sincronizar última actualización
        const lastUpdated = document.getElementById('last-updated');
        const mobileUpdateTime = document.getElementById('mobile-update-time');
        if (lastUpdated && mobileUpdateTime) {
            const updateObserver = new MutationObserver(() => {
                mobileUpdateTime.textContent = lastUpdated.textContent;
            });
            updateObserver.observe(lastUpdated, { childList: true, characterData: true, subtree: true });
            mobileUpdateTime.textContent = lastUpdated.textContent;
        }
    }

    syncLayers() {
        // Sincronizar control de capas de Leaflet con el bottom sheet
        const checkLayers = () => {
            if (!window.map) {
                setTimeout(checkLayers, 500);
                return;
            }

            const layersContainer = document.getElementById('mobile-layers-container');
            if (!layersContainer) return;

            // Observar cambios en el control de capas de Leaflet
            const layersControl = document.querySelector('.leaflet-control-layers');
            if (layersControl) {
                const updateMobileLayers = () => {
                    const baseLayers = layersControl.querySelectorAll('.leaflet-control-layers-base label');
                    const overlays = layersControl.querySelectorAll('.leaflet-control-layers-overlays label');

                    let html = '';

                    if (baseLayers.length > 0) {
                        html += '<div style="margin-bottom: 1.5rem;"><h4 style="margin: 0 0 0.75rem 0; padding: 0 1rem; color: var(--color-gobmx-verde); font-size: 0.9rem;">Mapas Base</h4>';
                        baseLayers.forEach(label => {
                            const input = label.querySelector('input');
                            const text = label.querySelector('span').textContent.trim();
                            const checked = input.checked ? 'checked' : '';
                            html += `
                                <label style="display: flex; align-items: center; padding: 0.75rem 1rem; cursor: pointer; transition: background 0.2s;" 
                                       onmouseover="this.style.background='#f5f5f5'" 
                                       onmouseout="this.style.background='transparent'">
                                    <input type="radio" name="mobile-base-layer" value="${text}" ${checked} 
                                           style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer;"
                                           onchange="document.querySelectorAll('.leaflet-control-layers-base input')[Array.from(document.querySelectorAll('.leaflet-control-layers-base label span')).findIndex(s => s.textContent.trim() === '${text}')].click()">
                                    <span style="flex: 1; font-size: 0.9rem; color: #333;">${text}</span>
                                </label>
                            `;
                        });
                        html += '</div>';
                    }

                    if (overlays.length > 0) {
                        html += '<div><h4 style="margin: 0 0 0.75rem 0; padding: 0 1rem; color: var(--color-gobmx-verde); font-size: 0.9rem;">Capas Adicionales</h4>';
                        overlays.forEach(label => {
                            const input = label.querySelector('input');
                            const text = label.querySelector('span').textContent.trim();
                            const checked = input.checked ? 'checked' : '';
                            html += `
                                <label style="display: flex; align-items: center; padding: 0.75rem 1rem; cursor: pointer; transition: background 0.2s;"
                                       onmouseover="this.style.background='#f5f5f5'" 
                                       onmouseout="this.style.background='transparent'">
                                    <input type="checkbox" ${checked} 
                                           style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer;"
                                           onchange="document.querySelectorAll('.leaflet-control-layers-overlays input')[Array.from(document.querySelectorAll('.leaflet-control-layers-overlays label span')).findIndex(s => s.textContent.trim() === '${text}')].click()">
                                    <span style="flex: 1; font-size: 0.9rem; color: #333;">${text}</span>
                                </label>
                            `;
                        });
                        html += '</div>';
                    }

                    if (html === '') {
                        html = '<p style="color: #666; padding: 1rem;">No hay capas disponibles.</p>';
                    }

                    layersContainer.innerHTML = html;
                };

                // Actualizar inicialmente
                updateMobileLayers();

                // Observar cambios
                const observer = new MutationObserver(updateMobileLayers);
                observer.observe(layersControl, { childList: true, subtree: true, attributes: true });
            }
        };

        checkLayers();
    }

    resetAnalysis() {
        this.isAnalysisActive = false;
    }

    showAnalysisInBottomSheet(analysisData) {
        const infoTab = document.querySelector('.bottom-sheet-tab-content[data-content="info"]');
        if (!infoTab) return;

        const { presaNombre, radioKm, totalLocalidades, poblacionTotal, hogaresIndigenas,
            poblacionAfro, sitiosRamsar, distanciaRioUsumacinta } = analysisData;

        let html = '<div style="padding: 0; font-family: Montserrat, sans-serif;">';
        html += '<div style="background: linear-gradient(135deg, #601623 0%, #8B1E3F 100%); padding: 15px; margin: 0 0 15px 0;">';
        html += '<h3 style="margin: 0; color: white; font-size: 14px; font-weight: 700;"><i class="bi bi-graph-up"></i> Análisis Espacial</h3>';
        html += '<p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.9); font-size: 12px;">' + presaNombre + ' • Radio: ' + radioKm + ' km</p>';
        html += '</div><div style="padding: 0 15px 15px 15px;">';

        if (totalLocalidades > 0) {
            html += '<div style="margin-bottom: 15px;"><h4 style="margin: 0 0 10px 0; color: #FFA726; font-size: 13px; font-weight: 700; border-bottom: 2px solid #FFA726; padding-bottom: 5px;"><i class="bi bi-people-fill"></i> Localidades Indígenas</h4>';
            html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
            html += '<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #666;">Total Localidades:</td><td style="padding: 8px 0; text-align: right; font-weight: 700; color: #FFA726;">' + totalLocalidades + '</td></tr>';
            html += '<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #666;">Población Total:</td><td style="padding: 8px 0; text-align: right; font-weight: 700; color: #FFA726;">' + poblacionTotal.toLocaleString('es-MX') + '</td></tr>';
            html += '<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #666;">Hogares Indígenas:</td><td style="padding: 8px 0; text-align: right; font-weight: 700; color: #FFA726;">' + hogaresIndigenas.toLocaleString('es-MX') + '</td></tr>';
            if (poblacionAfro > 0) {
                html += '<tr><td style="padding: 8px 0; color: #666;">Población Afro:</td><td style="padding: 8px 0; text-align: right; font-weight: 700; color: #6A1B9A;">' + poblacionAfro.toLocaleString('es-MX') + '</td></tr>';
            }
            html += '</table></div>';
        }

        if (sitiosRamsar && sitiosRamsar.length > 0) {
            html += '<div style="margin-bottom: 15px;"><h4 style="margin: 0 0 10px 0; color: #4CAF50; font-size: 13px; font-weight: 700; border-bottom: 2px solid #4CAF50; padding-bottom: 5px;"><i class="bi bi-tree-fill"></i> Sitios Ramsar (' + sitiosRamsar.length + ')</h4>';
            sitiosRamsar.forEach(ramsar => {
                const borderColor = ramsar.intersecta ? '#4CAF50' : '#FFA726';
                const distColor = ramsar.intersecta ? '#4CAF50' : '#FFA726';
                const distText = ramsar.intersecta ? 'DENTRO del sitio' : (ramsar.distancia / 1000).toFixed(2) + ' km';
                html += '<div style="background: #f5f5f5; padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid ' + borderColor + ';">';
                html += '<div style="font-weight: 600; color: #333; font-size: 12px; margin-bottom: 4px;">' + ramsar.nombre + '</div>';
                html += '<table style="width: 100%; font-size: 11px;">';
                html += '<tr><td style="padding: 2px 0; color: #666;">Ubicación:</td><td style="padding: 2px 0; text-align: right; color: #333;">' + ramsar.estado + '</td></tr>';
                html += '<tr><td style="padding: 2px 0; color: #666;">Municipios:</td><td style="padding: 2px 0; text-align: right; color: #333;">' + ramsar.municipios + '</td></tr>';
                html += '<tr><td style="padding: 2px 0; color: #666;">Distancia:</td><td style="padding: 2px 0; text-align: right; font-weight: 600; color: ' + distColor + ';">' + distText + '</td></tr>';
                html += '</table></div>';
            });
            html += '</div>';
        }

        if (distanciaRioUsumacinta !== null) {
            html += '<div style="margin-bottom: 15px;"><h4 style="margin: 0 0 10px 0; color: #0288D1; font-size: 13px; font-weight: 700; border-bottom: 2px solid #0288D1; padding-bottom: 5px;"><i class="bi bi-water"></i> Río Usumacinta</h4>';
            html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><tr><td style="padding: 8px 0; color: #666;">Distancia al río:</td><td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0288D1; font-size: 16px;">' + (distanciaRioUsumacinta / 1000).toFixed(2) + ' km</td></tr></table></div>';
        }

        if (totalLocalidades === 0 && (!sitiosRamsar || sitiosRamsar.length === 0) && distanciaRioUsumacinta === null) {
            html += '<div style="text-align: center; padding: 40px 20px; color: #999;"><i class="bi bi-info-circle" style="font-size: 48px; display: block; margin-bottom: 15px; opacity: 0.5;"></i><p style="margin: 0; font-size: 13px;">No se encontraron recursos en el radio de búsqueda</p></div>';
        }

        html += '</div></div>';
        infoTab.innerHTML = html;
        this.expandBottomSheet();
        this.switchBottomSheetTab('info');
    }

    handleMenuAction(action) {
        switch (action) {
            case 'search':
                // Abrir tab de controles
                this.switchBottomSheetTab('controls');
                this.expandBottomSheet();

                // Mostrar buscador solo si el mapa lo soporta (según desktop #search-group)
                const desktopSearch = document.getElementById('search-group');
                const searchGroup = document.getElementById('mobile-search-group');
                const enabled = desktopSearch ? desktopSearch.style.display !== 'none' : false;
                if (searchGroup) {
                    searchGroup.style.display = enabled ? 'block' : 'none';
                }
                if (!enabled) {
                    alert('Este mapa no tiene buscador disponible.');
                    break;
                }

                // Enfocar input de búsqueda existente
                setTimeout(() => {
                    const searchInput = document.getElementById('mobile-permit-search');
                    if (searchInput) {
                        searchInput.focus();
                        // Asegurar que el input sea visible (scroll si es necesario)
                        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
                break;
            case 'refresh':
                const refreshBtn = document.getElementById('refresh-data');
                if (refreshBtn) refreshBtn.click();
                break;
            case 'export-png':
                this.exportMap();
                break;
            case 'export-word':
                this.exportMap(); // Por ahora usa la misma función
                break;
            case 'edit-data':
                {
                    const sheetInfo = document.getElementById('sheet-info');
                    const links = sheetInfo ? Array.from(sheetInfo.querySelectorAll('a')) : [];
                    const editLink = links.find(a => a.textContent && a.textContent.trim().toLowerCase() === 'editar datos');
                    console.log('[MOBILE EDIT] sheetInfo exists?', !!sheetInfo);
                    console.log('[MOBILE EDIT] links in #sheet-info:', links);
                    console.log('[MOBILE EDIT] editLink found?', !!editLink, editLink ? editLink.href : undefined);
                    if (editLink && editLink.href) {
                        window.open(editLink.href, '_blank', 'noopener,noreferrer');
                    } else {
                        // Fallback: derive URL from current map configuration
                        const instrumentSelect = document.getElementById('instrument-select');
                        const mapSelect = document.getElementById('map-select');
                        const instrumentName = instrumentSelect ? instrumentSelect.value : undefined;
                        const mapName = mapSelect ? mapSelect.value : undefined;
                        const configs = window.mapConfigurations || {};
                        const instrumentConfigs = instrumentName ? configs[instrumentName] || [] : [];
                        const mapConfig = instrumentConfigs.find(m => m && m.name === mapName);
                        console.log('[MOBILE EDIT][FALLBACK] instrument:', instrumentName, 'map:', mapName, 'config:', mapConfig);
                        const url = mapConfig && mapConfig.googleSheetEditUrl ? mapConfig.googleSheetEditUrl : undefined;
                        if (url) {
                            window.open(url, '_blank', 'noopener,noreferrer');
                        } else {
                            alert('No se encontró el enlace para editar datos.');
                        }
                    }
                }
                break;
            case 'view-data':
                {
                    const sheetInfoView = document.getElementById('sheet-info');
                    const linksView = sheetInfoView ? Array.from(sheetInfoView.querySelectorAll('a')) : [];
                    const viewLink = linksView.find(a => a.textContent && a.textContent.trim().toLowerCase() === 'ver datos');
                    console.log('[MOBILE VIEW] sheetInfo exists?', !!sheetInfoView);
                    console.log('[MOBILE VIEW] links in #sheet-info:', linksView);
                    console.log('[MOBILE VIEW] viewLink found?', !!viewLink, viewLink ? viewLink.href : undefined);
                    if (viewLink && viewLink.href) {
                        window.open(viewLink.href, '_blank', 'noopener,noreferrer');
                    } else {
                        // Fallback: derive URL from current map configuration and transform for display
                        const instrumentSelect = document.getElementById('instrument-select');
                        const mapSelect = document.getElementById('map-select');
                        const instrumentName = instrumentSelect ? instrumentSelect.value : undefined;
                        const mapName = mapSelect ? mapSelect.value : undefined;
                        const configs = window.mapConfigurations || {};
                        const instrumentConfigs = instrumentName ? configs[instrumentName] || [] : [];
                        const mapConfig = instrumentConfigs.find(m => m && m.name === mapName);
                        console.log('[MOBILE VIEW][FALLBACK] instrument:', instrumentName, 'map:', mapName, 'config:', mapConfig);
                        let url;
                        if (mapConfig && mapConfig.googleSheetUrl) {
                            if (typeof window.getDisplaySheetUrl === 'function') {
                                try {
                                    url = window.getDisplaySheetUrl(mapConfig.googleSheetUrl);
                                } catch (e) {
                                    console.warn('[MOBILE VIEW][FALLBACK] getDisplaySheetUrl error:', e);
                                    url = mapConfig.googleSheetUrl;
                                }
                            } else {
                                url = mapConfig.googleSheetUrl;
                            }
                        }
                        if (url) {
                            window.open(url, '_blank', 'noopener,noreferrer');
                        } else {
                            alert('No se encontró el enlace para ver datos.');
                        }
                    }
                }
                break;
        }
    }

    setupZoomHandlers() {
        // Sync mobile zoom controls with Leaflet map zoom
        const zoomInBtn = document.getElementById('mobile-zoom-in');
        const zoomOutBtn = document.getElementById('mobile-zoom-out');

        if (!zoomInBtn || !zoomOutBtn) return;

        // Wait for map to be ready
        let attempts = 0;
        const maxAttempts = 50; // ~5s
        const intervalId = setInterval(() => {
            attempts++;
            if (window.map && typeof window.map.on === 'function') {
                clearInterval(intervalId);

                zoomInBtn.addEventListener('click', function () {
                    try { window.map.zoomIn(); } catch (e) { }
                });
                zoomOutBtn.addEventListener('click', function () {
                    try { window.map.zoomOut(); } catch (e) { }
                });

                // Update zoom buttons based on map zoom state
                window.map.on('zoomend', function () {
                    const currentZoom = window.map.getZoom ? window.map.getZoom() : null;
                    const minZoom = window.map.getMinZoom ? window.map.getMinZoom() : 0;
                    const maxZoom = window.map.getMaxZoom ? window.map.getMaxZoom() : 18;
                    if (currentZoom === null) return;
                    zoomOutBtn.disabled = currentZoom <= minZoom;
                    zoomInBtn.disabled = currentZoom >= maxZoom;
                });
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.warn('Mobile zoom handlers: map not ready');
            }
        }, 100);
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.mobileInterface = new MobileInterface();
    });
} else {
    window.mobileInterface = new MobileInterface();
}
