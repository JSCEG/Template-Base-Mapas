/**
 * Sincronización de controles en pantalla completa
 */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        // Elementos principales
        const instrumentSelect = document.getElementById('instrument-select');
        const mapSelect = document.getElementById('map-select');
        const permitSearch = document.getElementById('permit-search');
        const refreshBtn = document.getElementById('refresh-data');
        const searchGroup = document.getElementById('search-group');

        // Elementos en pantalla completa
        const fullscreenInstrumentSelect = document.getElementById('fullscreen-instrument-select');
        const fullscreenMapSelect = document.getElementById('fullscreen-map-select');
        const fullscreenPermitSearch = document.getElementById('fullscreen-permit-search');
        const fullscreenRefreshBtn = document.getElementById('fullscreen-refresh-btn');
        const fullscreenSearchGroup = document.getElementById('fullscreen-search-group');
        const fullscreenToolbar = document.getElementById('fullscreen-toolbar');

        if (!instrumentSelect || !fullscreenInstrumentSelect) {
            console.warn('Controles de toolbar no encontrados');
            return;
        }

        // Sincronizar opciones de instrumentos
        function syncInstrumentOptions() {
            fullscreenInstrumentSelect.innerHTML = instrumentSelect.innerHTML;
            fullscreenInstrumentSelect.value = instrumentSelect.value;
        }

        // Sincronizar opciones de mapas
        function syncMapOptions() {
            fullscreenMapSelect.innerHTML = mapSelect.innerHTML;
            fullscreenMapSelect.value = mapSelect.value;
            fullscreenMapSelect.disabled = mapSelect.disabled;
        }

        // Sincronizar visibilidad de búsqueda
        function syncSearchVisibility() {
            if (searchGroup && fullscreenSearchGroup) {
                const isVisible = searchGroup.style.display !== 'none';
                fullscreenSearchGroup.style.display = isVisible ? '' : 'none';
            }
        }

        // Sincronizar valor de búsqueda
        function syncSearchValue() {
            if (permitSearch && fullscreenPermitSearch) {
                fullscreenPermitSearch.value = permitSearch.value;
            }
        }

        // Inicializar sincronización
        syncInstrumentOptions();
        syncMapOptions();
        syncSearchVisibility();
        syncSearchValue();

        // Listeners para cambios en controles principales
        instrumentSelect.addEventListener('change', function () {
            fullscreenInstrumentSelect.value = this.value;
        });

        mapSelect.addEventListener('change', function () {
            syncMapOptions();
        });

        if (permitSearch) {
            permitSearch.addEventListener('input', function () {
                if (fullscreenPermitSearch) {
                    fullscreenPermitSearch.value = this.value;
                }
            });
        }

        // Listeners para cambios en controles de pantalla completa
        fullscreenInstrumentSelect.addEventListener('change', function (e) {
            e.stopPropagation();
            instrumentSelect.value = this.value;
            instrumentSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });

        fullscreenMapSelect.addEventListener('change', function (e) {
            e.stopPropagation();
            mapSelect.value = this.value;
            mapSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });

        if (fullscreenPermitSearch) {
            fullscreenPermitSearch.addEventListener('input', function (e) {
                e.stopPropagation();
                if (permitSearch) {
                    permitSearch.value = this.value;
                    permitSearch.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            // Prevenir propagación de clicks
            fullscreenPermitSearch.addEventListener('click', function (e) {
                e.stopPropagation();
            });
        }

        if (fullscreenRefreshBtn) {
            fullscreenRefreshBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                if (refreshBtn) {
                    refreshBtn.click();
                }
            });
        }

        // Prevenir propagación de clicks en el toolbar
        if (fullscreenToolbar) {
            fullscreenToolbar.addEventListener('click', function (e) {
                e.stopPropagation();
            });
            fullscreenToolbar.addEventListener('mousedown', function (e) {
                e.stopPropagation();
            });
            fullscreenToolbar.addEventListener('mouseup', function (e) {
                e.stopPropagation();
            });
        }

        // Observer para detectar cambios en las opciones
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.type === 'childList' || mutation.type === 'attributes') {
                    syncInstrumentOptions();
                    syncMapOptions();
                    syncSearchVisibility();
                }
            });
        });

        // Observar cambios en los selects principales
        observer.observe(instrumentSelect, { childList: true, subtree: true });
        observer.observe(mapSelect, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

        if (searchGroup) {
            observer.observe(searchGroup, { attributes: true, attributeFilter: ['style'] });
        }

        // Prevenir propagación de clicks en el toolbar
        if (fullscreenToolbar) {
            fullscreenToolbar.addEventListener('click', function (e) {
                e.stopPropagation();
            });
            fullscreenToolbar.addEventListener('mousedown', function (e) {
                e.stopPropagation();
            });
            fullscreenToolbar.addEventListener('mouseup', function (e) {
                e.stopPropagation();
            });
        }

        // Toggle para colapsar/expandir toolbar
        const fullscreenToolbarToggle = document.getElementById('fullscreen-toolbar-toggle');
        if (fullscreenToolbarToggle && fullscreenToolbar) {
            fullscreenToolbarToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                fullscreenToolbar.classList.toggle('collapsed');
            });
        }

        // Botón de editar datos
        const fullscreenEditBtn = document.getElementById('fullscreen-edit-btn');
        if (fullscreenEditBtn) {
            fullscreenEditBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                // Obtener la URL de edición del sheet-info
                const sheetInfo = document.getElementById('sheet-info');
                if (sheetInfo) {
                    const editLink = sheetInfo.querySelector('a[href*="edit"]');
                    if (editLink) {
                        window.open(editLink.href, '_blank');
                    } else {
                        alert('No hay hoja de cálculo disponible para editar');
                    }
                }
            });
        }

        // Botón de ver datos
        const fullscreenViewBtn = document.getElementById('fullscreen-view-btn');
        if (fullscreenViewBtn) {
            fullscreenViewBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                // Obtener la URL de visualización del sheet-info
                const sheetInfo = document.getElementById('sheet-info');
                if (sheetInfo) {
                    const viewLink = sheetInfo.querySelector('a[href*="pub"]') || sheetInfo.querySelector('a');
                    if (viewLink) {
                        window.open(viewLink.href, '_blank');
                    } else {
                        alert('No hay hoja de cálculo disponible para ver');
                    }
                }
            });
        }

        console.log('✅ Toolbar de pantalla completa sincronizado con toggle y botones de datos');
    });
})();
