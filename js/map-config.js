/**
 * Configuración e inicialización del mapa principal
 */
document.addEventListener('DOMContentLoaded', function () {
    const MAP_CONTAINER_ID = 'map';
    const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4QU5BVBEHmewrNOLjaKoqca3qH16zYKXzvYfMwhrMiW1mR4yUHNJlbIjDhQuDmWtN803Da7r4SZV6/pub?gid=0&single=true&output=csv';
    const REFRESH_MS = 0; // Cambia a 300000 para 5 minutos
    const NO_SHEET_MESSAGE = 'Este mapa no obtiene valores de Excel; son solo capas, shapes o GeoJSON.';
    const SELECT_MAP_MESSAGE = 'Seleccione un mapa para ver su hoja de calculo.';
    let currentSheetUrl = SHEET_CSV;
    const NODE_MARKER_OPTIONS = {
        radius: 3,
        fillColor: '#1f7a62',
        color: '#ffffff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9
    };

    /**
     * Helper function to draw a rounded rectangle on a canvas context.
     */
    function roundRect(ctx, x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
        return ctx;
    }

    const mapContainer = document.getElementById(MAP_CONTAINER_ID);
    if (!mapContainer) {
        console.error('No se encontró el contenedor del mapa.');
        return;
    }

    const preloader = document.getElementById('preloader');
    const lastUpdatedEl = document.getElementById('last-updated');
    const refreshBtn = document.getElementById('refresh-data');

    // Configuración de límites del mapa
    const mexicoBounds = L.latLngBounds(
        [14.0, -118.0],
        [33.5, -86.0]
    );

    // Configuración de graticule (retícula de coordenadas)
    const GRATICULE_STEP = 5;
    const GRATICULE_FINE_STEP = 0.5;
    const GRATICULE_PADDING_DEGREES = 10;

    const graticuleBounds = L.latLngBounds(
        [
            mexicoBounds.getSouth() - GRATICULE_PADDING_DEGREES,
            mexicoBounds.getWest() - GRATICULE_PADDING_DEGREES
        ],
        [
            mexicoBounds.getNorth() + GRATICULE_PADDING_DEGREES,
            mexicoBounds.getEast() + GRATICULE_PADDING_DEGREES
        ]
    );

    // Generar coordenadas de graticule
    const graticuleLatitudes = [];
    for (
        let lat = Math.floor(graticuleBounds.getSouth() / GRATICULE_STEP) * GRATICULE_STEP;
        lat <= Math.ceil(graticuleBounds.getNorth() / GRATICULE_STEP) * GRATICULE_STEP;
        lat += GRATICULE_STEP
    ) {
        graticuleLatitudes.push(lat);
    }

    const graticuleLongitudes = [];
    for (
        let lng = Math.floor(graticuleBounds.getWest() / GRATICULE_STEP) * GRATICULE_STEP;
        lng <= Math.ceil(graticuleBounds.getEast() / GRATICULE_STEP) * GRATICULE_STEP;
        lng += GRATICULE_STEP
    ) {
        graticuleLongitudes.push(lng);
    }

    const graticuleWest = Math.min(...graticuleLongitudes) - GRATICULE_STEP;
    const graticuleEast = Math.max(...graticuleLongitudes) + GRATICULE_STEP;
    const graticuleSouth = Math.min(...graticuleLatitudes) - GRATICULE_STEP;
    const graticuleNorth = Math.max(...graticuleLatitudes) + GRATICULE_STEP;

    // Configuración de capas de MapTiler
    const mapTilerKeys = {
        personal: 'jAAFQsMBZ9a6VIm2dCwg',
        amigo: 'xRR3xCujdkUjxkDqlNTG'
    };

    const mapTilerAttribution = '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    const fallbackAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    function hasMapTilerSDK() {
        return typeof L !== 'undefined' &&
            typeof L.maptiler !== 'undefined' &&
            typeof L.maptiler.maptilerLayer === 'function';
    }

    function buildMapTilerUrl(styleId, apiKey) {
        return 'https://api.maptiler.com/maps/' + styleId + '/256/{z}/{x}/{y}.png?key=' + apiKey;
    }

    let map;
    let geoJsonLayer; // Declare geoJsonLayer globally
    let leaderLineSvg;

    function createMapTilerLayer(styleId, keyName, fallbackUrl, name) {
        const apiKey = mapTilerKeys[keyName];
        const fallbackLayer = fallbackUrl ? L.tileLayer(fallbackUrl, {
            attribution: fallbackAttribution,
            maxZoom: 18
        }) : null;

        if (!apiKey) {
            console.warn('No existe API key para', keyName, '; usando fallback para', name);
            return fallbackLayer;
        }

        if (hasMapTilerSDK()) {
            try {
                const layer = L.maptiler.maptilerLayer({
                    apiKey: apiKey,
                    style: styleId,
                    maxZoom: 18
                });
                if (layer && layer.options && !layer.options.maxZoom) {
                    layer.options.maxZoom = 18;
                }
                return layer;
            } catch (error) {
                console.warn('Error creando ' + name + ' con MapTiler SDK:', error);
            }
        } else {
            console.warn('MapTiler SDK no disponible; usando fallback para ' + name);
        }

        if (fallbackLayer) {
            return fallbackLayer;
        }

        return L.tileLayer(buildMapTilerUrl(styleId, apiKey), {
            attribution: mapTilerAttribution,
            maxZoom: 18
        });
    }

    // URLs de fallback
    const fallbackLight = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    const fallbackDark = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    // Configuración de capas de mapa
    const layerConfigs = {
        /* 'sener-azul': {
            label: 'SENER Azul',
            creator: () => createMapTilerLayer('0198a42c-5e08-77a1-9773-763ee4e12b32', 'personal', fallbackLight, 'SENER Azul'),
            isMapTiler: true
        }, */
        'sener-light': {
            label: 'SENER Light',
            creator: () => createMapTilerLayer('0198a9af-dc7c-79d3-8316-a80767ad1d0f', 'amigo', fallbackLight, 'SENER Light'),
            isMapTiler: true
        },
        /* 'sener-oscuro': {
            label: 'SENER Oscuro',
            creator: () => createMapTilerLayer('0198a9f0-f135-7991-aaec-bea71681556e', 'amigo', fallbackDark, 'SENER Oscuro'),
            isMapTiler: true
        }, */
        'carto-positron': {
            label: 'Positron (Claro)',
            creator: () => L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: fallbackAttribution,
                maxZoom: 19,
                crossOrigin: 'anonymous'
            }),
            exportable: true
        },
        'carto-voyager': {
            label: 'Voyager (Colores)',
            creator: () => L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: fallbackAttribution,
                maxZoom: 19,
                crossOrigin: 'anonymous'
            }),
            exportable: true
        },
        'carto-voyager-nolabels': {
            label: 'Voyager Sin Etiquetas',
            creator: () => L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20,
                crossOrigin: 'anonymous'
            }),
            exportable: true
        },
        'esri-worldimagery': {
            label: 'Satélite (ESRI)',
            creator: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri',
                maxZoom: 19,
                crossOrigin: 'anonymous'
            }),
            exportable: true
        },
        'stadia-alidade': {
            label: 'Alidade Smooth (Colorido)',
            creator: () => L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
                maxZoom: 20,
                crossOrigin: 'anonymous'
            }),
            exportable: true
        },
        'stamen-terrain-background': {
            label: 'Terrain Background (Sutil)',
            creator: () => L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://stamen.com">Stamen Design</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
                maxZoom: 18,
                crossOrigin: 'anonymous'
            }),
            exportable: true
        }/*,
        'osm-standard': {
            label: 'OpenStreetMap (Estándar)',
            creator: () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
                crossOrigin: 'anonymous'
            }),
            exportable: true
        },
        'stamen-toner-lite': {
            label: 'Toner Lite (Minimalista)',
            creator: () => L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://stamen.com">Stamen Design</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
                maxZoom: 20,
                crossOrigin: 'anonymous'
            }),
            exportable: true
        },
        'stamen-watercolor': {
            label: 'Watercolor (Artístico)',
            creator: () => L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', {
                attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://stamen.com">Stamen Design</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
                maxZoom: 16,
                crossOrigin: 'anonymous'
            }),
            exportable: true
        },
        'esri-worldstreetmap': {
            label: 'ESRI Street Map (Formal)',
            creator: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri',
                maxZoom: 19,
                crossOrigin: 'anonymous'
            }),
            exportable: true
        } */
    };

    const baseLayers = {};
    const baseLayersForControl = {};

    Object.entries(layerConfigs).forEach(function ([key, config]) {
        config.layer = config.creator();
        if (config.layer) {
            baseLayers[key] = config.layer;
            baseLayersForControl[config.label] = config.layer;
        }
    });


    // Variable global para las capas de México con diferentes estilos
    let mexicoOutlineLayerCrema = null;
    let mexicoOutlineLayerGris = null;
    let mexicoOutlineLayerNinguno = null;

    // Función para cargar el contorno de México con estilo específico
    async function loadMexicoOutline(colorStyle = 'crema') {
        const styles = {
            crema: {
                fillColor: '#FFF9E6', // Crema aún más claro
                fillOpacity: 0.7,
                color: '#C8C8C8' // Borde muy claro
            },
            gris: {
                fillColor: '#E0E0E0',
                fillOpacity: 0.7,
                color: '#808080'
            },
            ninguno: {
                fillColor: '#FFFFFF', // Blanco
                fillOpacity: 0,  // Transparente
                color: '#666666', // Borde gris oscuro
                weight: 2,
                shadow: true  // Indicador para agregar sombra
            }
        };

        try {
            const response = await fetch('https://cdn.sassoapps.com/Mapas/mexico.geojson');
            const data = await response.json();

            // Definir la proyección de México (Lambert Conformal Conic)
            const mexicoProj = '+proj=lcc +lat_1=17.5 +lat_2=29.5 +lat_0=12 +lon_0=-102 +x_0=2500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
            const wgs84 = 'EPSG:4326';

            // Reproyectar las coordenadas
            const reprojectCoordinates = (coords) => {
                if (typeof coords[0] === 'number') {
                    const [lng, lat] = proj4(mexicoProj, wgs84, coords);
                    return [lng, lat];
                } else {
                    return coords.map(coord => reprojectCoordinates(coord));
                }
            };

            // Reproyectar todas las geometrías
            data.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    feature.geometry.coordinates = reprojectCoordinates(feature.geometry.coordinates);
                }
            });

            const selectedStyle = styles[colorStyle] || styles.crema;

            const mexicoLayer = L.geoJSON(data, {
                pane: 'mexicoOverlayPane',
                style: function () {
                    return {
                        fillColor: selectedStyle.fillColor,
                        fill: true,
                        fillOpacity: selectedStyle.fillOpacity,
                        weight: selectedStyle.weight || 2,
                        opacity: 1,
                        color: selectedStyle.color,
                        interactive: false,
                        ...(selectedStyle.shadow && {
                            shadowColor: '#000000',
                            shadowBlur: 8,
                            shadowOffsetX: 2,
                            shadowOffsetY: 2,
                            className: 'mexico-shadow'
                        })
                    };
                }
            });

            console.log(`✅ Capa de México ${colorStyle} cargada - Features:`, data.features.length);
            return mexicoLayer;
        } catch (error) {
            console.error('Error al cargar la capa de México:', error);
            return null;
        }
    }

    // Crear panes personalizados para cada estilo
    const CREMA_TILE_PANE = 'cremaTilePane';
    const GRIS_TILE_PANE = 'grisTilePane';

    // Crear capas base con diferentes filtros
    const cremaBaseLayer = L.layerGroup();
    const grisBaseLayer = L.layerGroup();
    const ningunoBaseLayer = L.layerGroup();

    // Cargar capas de México para cada estilo
    loadMexicoOutline('crema').then(layer => {
        if (layer) {
            mexicoOutlineLayerCrema = layer;
            cremaBaseLayer.addLayer(layer);
        }
    });

    loadMexicoOutline('gris').then(layer => {
        if (layer) {
            mexicoOutlineLayerGris = layer;
            grisBaseLayer.addLayer(layer);
        }
    });

    loadMexicoOutline('ninguno').then(layer => {
        if (layer) {
            mexicoOutlineLayerNinguno = layer;

        }
    });

    baseLayersForControl['Crema'] = cremaBaseLayer;
    baseLayersForControl['Gris'] = grisBaseLayer;
    baseLayersForControl['Ninguno'] = ningunoBaseLayer;



    const baseKeys = Object.keys(baseLayers);
    if (!baseKeys.length) {
        console.error('No hay mapas base disponibles.');
        return;
    }

    // Determinar mapa base por defecto
    let defaultBaseKey = 'carto-voyager-nolabels';
    let activeBaseLayer = baseLayers[defaultBaseKey];

    // Verificar si hay una configuración específica de mapa base (ej. desde PRESAS_MAPS)
    // Esto asume que el primer mapa de PRESAS_MAPS es el activo por defecto
    if (window.PRESAS_MAPS && window.PRESAS_MAPS.length > 0 && window.PRESAS_MAPS[0].baseMap) {
        const configBaseMap = window.PRESAS_MAPS[0].baseMap;
        if (baseLayers[configBaseMap]) {
            defaultBaseKey = configBaseMap;
            activeBaseLayer = baseLayers[configBaseMap];
            console.log(`✅ Mapa base configurado desde PRESAS_MAPS: ${defaultBaseKey}`);
        }
    }

    console.log(`✅ Listo. Mapa base activo: ${defaultBaseKey}`);

    // Inicializar el mapa
    map = L.map(MAP_CONTAINER_ID, {
        center: [23.6345, -102.5528],  // Centro de México
        zoom: 5.2,  // Zoom para escala de ~500km
        minZoom: 4,  // Permitir más alejamiento
        maxZoom: 18,
        maxBounds: graticuleBounds,
        maxBoundsViscosity: 1,
        layers: activeBaseLayer ? [activeBaseLayer] : [],
        zoomControl: false,
        preferCanvas: false // Disable canvas rendering to fall back to SVG for better event handling
    });
    map.isBasemapActive = false;

    // Función para actualizar clases de zoom en el contenedor del mapa
    function updateMapZoomClasses() {
        const zoom = map.getZoom();
        const container = map.getContainer();

        // Remover clases anteriores
        container.classList.remove('map-zoom-low', 'map-zoom-mid', 'map-zoom-high');

        // Agregar clase según nivel de zoom
        if (zoom < 6) {
            container.classList.add('map-zoom-low');
        } else if (zoom < 8) {
            container.classList.add('map-zoom-mid');
        } else {
            container.classList.add('map-zoom-high');
        }

        console.log(`🔍 Zoom actual: ${zoom} - Clase aplicada: ${container.className}`);
    }

    // Escuchar cambios de zoom
    map.on('zoomend', updateMapZoomClasses);

    // Inicializar clases
    map.whenReady(updateMapZoomClasses);

    // Configurar fondo blanco si la capa base por defecto es "Ninguno"
    if (defaultBaseKey === 'Ninguno') {
        map.getContainer().style.backgroundColor = 'white';
    }

    // Create SVG overlay for leader lines
    leaderLineSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    leaderLineSvg.classList.add('leader-line-svg');
    map.getContainer().appendChild(leaderLineSvg);

    // Crear panes para cada estilo con sus filtros

    // Pane Crema
    map.createPane(CREMA_TILE_PANE);
    const cremaTilePane = map.getPane(CREMA_TILE_PANE);
    if (cremaTilePane) {
        cremaTilePane.style.zIndex = 150;
        cremaTilePane.style.filter = 'sepia(0.4) saturate(0.2) brightness(1.2) contrast(0.85)';
        cremaTilePane.style.opacity = '0.45';
    }

    // Pane Gris
    map.createPane(GRIS_TILE_PANE);
    const grisTilePane = map.getPane(GRIS_TILE_PANE);
    if (grisTilePane) {
        grisTilePane.style.zIndex = 150;
        grisTilePane.style.filter = 'grayscale(1) brightness(1.1) contrast(0.9)';
        grisTilePane.style.opacity = '0.5';
    }

    // Crear pane para la capa de México (encima del satélite, debajo de otras capas)
    const MEXICO_OVERLAY_PANE = 'mexicoOverlayPane';
    map.createPane(MEXICO_OVERLAY_PANE);
    const mexicoPane = map.getPane(MEXICO_OVERLAY_PANE);
    if (mexicoPane) {
        mexicoPane.style.zIndex = 199; // Entre satélite (150) y otras capas (200+)
    }

    // Crear capas satélite para cada estilo
    const esriSatelliteCrema = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19,
        crossOrigin: 'anonymous',
        pane: CREMA_TILE_PANE
    });

    const esriSatelliteGris = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19,
        crossOrigin: 'anonymous',
        pane: GRIS_TILE_PANE
    });

    // Agregar satélites a sus respectivas capas
    cremaBaseLayer.addLayer(esriSatelliteCrema);
    grisBaseLayer.addLayer(esriSatelliteGris);
    // ningunoBaseLayer no tiene satélite, solo capa de México

    // Exponer mapa globalmente para exportación
    window.map = map;

    // Añadir controles
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Control de escala personalizado con saltos de 50km hasta 800km
    L.Control.CustomScale = L.Control.extend({
        options: {
            position: 'bottomleft',
            maxWidth: 180,
            metric: true,
            imperial: false,
            updateWhenIdle: true
        },

        onAdd: function (map) {
            const className = 'leaflet-control-scale';
            const container = L.DomUtil.create('div', className);
            this._mScale = L.DomUtil.create('div', className + '-line', container);

            map.on(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
            map.whenReady(this._update, this);

            return container;
        },

        onRemove: function (map) {
            map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
        },

        _update: function () {
            const map = this._map;
            const y = map.getSize().y / 2;
            const maxMeters = map.distance(
                map.containerPointToLatLng([0, y]),
                map.containerPointToLatLng([this.options.maxWidth, y])
            );

            this._updateMetric(maxMeters);
        },

        _updateMetric: function (maxMeters) {
            const meters = this._getRoundNum(maxMeters);
            const label = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km';

            this._updateScale(this._mScale, label, meters / maxMeters);
        },

        _updateScale: function (scale, text, ratio) {
            scale.style.width = Math.round(this.options.maxWidth * ratio) + 'px';
            scale.innerHTML = text;
        },

        _getRoundNum: function (num) {
            const pow10 = Math.pow(10, (Math.floor(num) + '').length - 1);
            let d = num / pow10;

            // Saltos personalizados de 50 en 50 hasta 800km
            if (num >= 1000) { // Si es >= 1km
                const km = num / 1000;

                // Definir saltos de 50km
                const steps = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800];

                // Encontrar el salto más cercano
                for (let i = 0; i < steps.length; i++) {
                    if (km <= steps[i] * 1.5) {
                        return steps[i] * 1000; // Convertir a metros
                    }
                }

                return 800000; // Máximo 800km
            }

            // Para distancias menores a 1km, usar la lógica estándar
            d = d >= 10 ? 10 :
                d >= 5 ? 5 :
                    d >= 3 ? 3 :
                        d >= 2 ? 2 : 1;

            return pow10 * d;
        }
    });

    L.control.customScale = function (options) {
        return new L.Control.CustomScale(options);
    };

    L.control.customScale({
        position: 'bottomleft',
        maxWidth: 180,
        updateWhenIdle: true
    }).addTo(map);

    let currentBaseLayerName = 'Ninguno';
    window.currentBaseLayerName = currentBaseLayerName;

    // Handle background for "None" basemap
    map.on('baselayerchange', function (e) {
        currentBaseLayerName = e.name;
        window.currentBaseLayerName = e.name; // Expose globally
        map.isBasemapActive = e.name !== 'Ninguno';

        // Handle main map background for "Ninguno"
        if (e.name === 'Ninguno') {
            map.getContainer().style.backgroundColor = 'white';
        } else {
            map.getContainer().style.backgroundColor = '';
        }

        // Update inset maps
        insetControllers.forEach(controller => {
            if (controller.baseLayer) {
                controller.map.removeLayer(controller.baseLayer);
            }

            let newInsetBaseLayer;

            if (e.name === 'Crema') {
                newInsetBaseLayer = L.layerGroup();

                // Asegurar que el pane existe en el minimapa
                if (!controller.map.getPane(CREMA_TILE_PANE)) {
                    controller.map.createPane(CREMA_TILE_PANE);
                    const pane = controller.map.getPane(CREMA_TILE_PANE);
                    if (pane) {
                        pane.style.zIndex = 150;
                        pane.style.filter = 'sepia(0.4) saturate(0.2) brightness(1.2) contrast(0.85)';
                        pane.style.opacity = '0.45';
                    }
                }

                const esriSatelliteCremaInset = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri',
                    maxZoom: 19,
                    crossOrigin: 'anonymous',
                    pane: CREMA_TILE_PANE
                });
                newInsetBaseLayer.addLayer(esriSatelliteCremaInset);

                if (mexicoOutlineLayerCrema) {
                    // Asegurar que el pane de México existe en el minimapa
                    if (!controller.map.getPane(MEXICO_OVERLAY_PANE)) {
                        controller.map.createPane(MEXICO_OVERLAY_PANE);
                        const mexPane = controller.map.getPane(MEXICO_OVERLAY_PANE);
                        if (mexPane) {
                            mexPane.style.zIndex = 199;
                        }
                    }

                    const clonedLayer = L.geoJSON(mexicoOutlineLayerCrema.toGeoJSON(), {
                        pane: MEXICO_OVERLAY_PANE,
                        style: mexicoOutlineLayerCrema.options.style
                    });
                    newInsetBaseLayer.addLayer(clonedLayer);
                }
                controller.map.getContainer().style.backgroundColor = '';

            } else if (e.name === 'Gris') {
                newInsetBaseLayer = L.layerGroup();

                // Asegurar que el pane existe en el minimapa
                if (!controller.map.getPane(GRIS_TILE_PANE)) {
                    controller.map.createPane(GRIS_TILE_PANE);
                    const pane = controller.map.getPane(GRIS_TILE_PANE);
                    if (pane) {
                        pane.style.zIndex = 150;
                        pane.style.filter = 'grayscale(1) brightness(1.1) contrast(0.9)';
                        pane.style.opacity = '0.5';
                    }
                }

                const esriSatelliteGrisInset = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri',
                    maxZoom: 19,
                    crossOrigin: 'anonymous',
                    pane: GRIS_TILE_PANE
                });
                newInsetBaseLayer.addLayer(esriSatelliteGrisInset);

                if (mexicoOutlineLayerGris) {
                    // Asegurar que el pane de México existe en el minimapa
                    if (!controller.map.getPane(MEXICO_OVERLAY_PANE)) {
                        controller.map.createPane(MEXICO_OVERLAY_PANE);
                        const mexPane = controller.map.getPane(MEXICO_OVERLAY_PANE);
                        if (mexPane) {
                            mexPane.style.zIndex = 199;
                        }
                    }

                    const clonedLayer = L.geoJSON(mexicoOutlineLayerGris.toGeoJSON(), {
                        pane: MEXICO_OVERLAY_PANE,
                        style: mexicoOutlineLayerGris.options.style
                    });
                    newInsetBaseLayer.addLayer(clonedLayer);
                }
                controller.map.getContainer().style.backgroundColor = '';

            } else if (e.name === 'Ninguno') {
                newInsetBaseLayer = L.layerGroup();

                if (mexicoOutlineLayerNinguno) {
                    // Asegurar que el pane de México existe en el minimapa
                    if (!controller.map.getPane(MEXICO_OVERLAY_PANE)) {
                        controller.map.createPane(MEXICO_OVERLAY_PANE);
                        const mexPane = controller.map.getPane(MEXICO_OVERLAY_PANE);
                        if (mexPane) {
                            mexPane.style.zIndex = 199;
                        }
                    }

                    const clonedLayer = L.geoJSON(mexicoOutlineLayerNinguno.toGeoJSON(), {
                        pane: MEXICO_OVERLAY_PANE,
                        style: mexicoOutlineLayerNinguno.options.style
                    });
                    newInsetBaseLayer.addLayer(clonedLayer);
                }
                controller.map.getContainer().style.backgroundColor = 'white';

            } else {
                const newLayerConfig = Object.values(layerConfigs).find(config => config.label === e.name);
                if (newLayerConfig && newLayerConfig.creator) {
                    newInsetBaseLayer = newLayerConfig.creator();
                }
                controller.map.getContainer().style.backgroundColor = '';
            }

            if (newInsetBaseLayer) {
                newInsetBaseLayer.addTo(controller.map);
                controller.baseLayer = newInsetBaseLayer;
            }
        });
    });

    // Contenedor para los logos institucionales
    const logoContainer = L.DomUtil.create('div', 'logos-control-wrapper', map.getContainer());
    logoContainer.innerHTML = `
        <div class="logos-container">
            <div id="sener-logo-wrapper" class="logo-wrapper">
                <img src="img/logo_sener.png" alt="SENER" class="logo-sener" />
            </div>
            <div id="snien-logo-wrapper" class="logo-wrapper">
                <img src="img/snien.png" alt="SNIEn" class="logo-snien" />
            </div>
        </div>
    `;
    const senerLogoWrapper = document.getElementById('sener-logo-wrapper');
    const snienLogoWrapper = document.getElementById('snien-logo-wrapper');



    // Crear capa de graticule (líneas de latitud y longitud)
    function createGraticule() {
        const graticuleLayer = L.layerGroup();

        // Líneas de latitud (horizontales)
        graticuleLatitudes.forEach(function (lat) {
            const latlngs = [];
            for (let lng = graticuleWest; lng <= graticuleEast; lng += GRATICULE_FINE_STEP) {
                latlngs.push([lat, lng]);
            }

            L.polyline(latlngs, {
                color: '#999999',
                weight: 1.2,
                opacity: 0.6,
                dashArray: '3, 6'
            }).addTo(graticuleLayer);
        });

        // Líneas de longitud (verticales)
        graticuleLongitudes.forEach(function (lng) {
            const latlngs = [];
            for (let lat = graticuleSouth; lat <= graticuleNorth; lat += GRATICULE_FINE_STEP) {
                latlngs.push([lat, lng]);
            }

            L.polyline(latlngs, {
                color: '#999999',
                weight: 1.2,
                opacity: 0.6,
                dashArray: '3, 6'
            }).addTo(graticuleLayer);
        });

        return graticuleLayer;
    }

    // Capa ligera para mostrar etiquetas de coordenadas junto a las líneas de graticule
    const GraticuleLabels = L.Layer.extend({
        initialize: function (options = {}) {
            L.setOptions(this, options);
            this._latitudes = Array.isArray(options.latitudes) && options.latitudes.length ? options.latitudes : graticuleLatitudes;
            this._longitudes = Array.isArray(options.longitudes) && options.longitudes.length ? options.longitudes : graticuleLongitudes;
        },

        onAdd: function (map) {
            this._map = map;
            this._container = L.DomUtil.create('div', 'graticule-labels-control', map.getContainer());
            this._container.style.pointerEvents = 'none';

            this._topLabels = L.DomUtil.create('div', 'graticule-labels-top', this._container);
            this._bottomLabels = L.DomUtil.create('div', 'graticule-labels-bottom', this._container);
            this._leftLabels = L.DomUtil.create('div', 'graticule-labels-left', this._container);
            this._rightLabels = L.DomUtil.create('div', 'graticule-labels-right', this._container);

            map.on('move zoom viewreset resize', this._updateLabels, this);
            if (this.options.targetLayer) {
                map.on('overlayadd overlayremove', this._updateLabels, this);
            }

            this._updateLabels();
        },

        onRemove: function (map) {
            map.off('move zoom viewreset resize', this._updateLabels, this);
            if (this.options.targetLayer) {
                map.off('overlayadd overlayremove', this._updateLabels, this);
            }

            if (this._container) {
                L.DomUtil.remove(this._container);
                this._container = null;
                this._topLabels = null;
                this._bottomLabels = null;
                this._leftLabels = null;
                this._rightLabels = null;
            }

            this._map = null;
        },

        _formatLongitude: function (lng) {
            const hemisphere = lng < 0 ? 'O' : 'E';
            const absValue = Math.abs(Math.round(lng));
            return `${absValue}&deg;00'00" ${hemisphere}`;
        },

        _formatLatitude: function (lat) {
            const hemisphere = lat >= 0 ? 'N' : 'S';
            const absValue = Math.abs(Math.round(lat));
            return `${absValue}&deg;00'00" ${hemisphere}`;
        },

        _clearLabels: function () {
            if (!this._topLabels) {
                return;
            }
            this._topLabels.innerHTML = '';
            this._bottomLabels.innerHTML = '';
            this._leftLabels.innerHTML = '';
            this._rightLabels.innerHTML = '';
        },

        _updateLabels: function () {
            if (!this._map || !this._container) {
                return;
            }

            const shouldShow = !this.options.targetLayer || this._map.hasLayer(this.options.targetLayer);
            this._container.style.display = shouldShow ? '' : 'none';

            if (!shouldShow) {
                this._clearLabels();
                return;
            }

            const bounds = this._map.getBounds();
            const size = this._map.getSize();
            const north = bounds.getNorth();
            const south = bounds.getSouth();
            const west = bounds.getWest();
            const east = bounds.getEast();
            const longitudes = Array.isArray(this._longitudes) ? this._longitudes : [];
            const latitudes = Array.isArray(this._latitudes) ? this._latitudes : [];

            this._clearLabels();

            longitudes.forEach((lng) => {
                if (lng < west - 0.1 || lng > east + 0.1) {
                    return;
                }

                const topPoint = this._map.latLngToContainerPoint([north, lng]);
                if (topPoint.x < 0 || topPoint.x > size.x) {
                    return;
                }

                const labelText = this._formatLongitude(lng);

                const topLabel = L.DomUtil.create('div', 'graticule-label-item', this._topLabels);
                topLabel.innerHTML = labelText;
                topLabel.style.left = topPoint.x + 'px';
                topLabel.style.position = 'absolute';

                const bottomLabel = L.DomUtil.create('div', 'graticule-label-item', this._bottomLabels);
                bottomLabel.innerHTML = labelText;
                bottomLabel.style.left = topPoint.x + 'px';
                bottomLabel.style.position = 'absolute';
            });

            latitudes.forEach((lat) => {
                if (lat < south - 0.1 || lat > north + 0.1) {
                    return;
                }

                const leftPoint = this._map.latLngToContainerPoint([lat, west]);
                if (leftPoint.y < 0 || leftPoint.y > size.y) {
                    return;
                }

                const labelText = this._formatLatitude(lat);

                const leftLabel = L.DomUtil.create('div', 'graticule-label-item', this._leftLabels);
                leftLabel.innerHTML = labelText;
                leftLabel.style.top = leftPoint.y + 'px';
                leftLabel.style.position = 'absolute';

                const rightPoint = this._map.latLngToContainerPoint([lat, east]);
                const rightLabel = L.DomUtil.create('div', 'graticule-label-item', this._rightLabels);
                rightLabel.innerHTML = labelText;
                rightLabel.style.top = rightPoint.y + 'px';
                rightLabel.style.position = 'absolute';
            });
        }
    });

    const graticuleLayer = createGraticule();
    const graticuleLabels = new GraticuleLabels({ targetLayer: graticuleLayer, latitudes: graticuleLatitudes, longitudes: graticuleLongitudes });
    map.createPane('marinasPane');
    const marinasLayer = L.layerGroup({ pane: 'marinasPane' }).addTo(map);

    // Crear capa de contorno de México para el control
    let mexicoBorderLayer = L.layerGroup();
    (async () => {
        try {
            const response = await fetch('https://cdn.sassoapps.com/Mapas/mexico.geojson');
            const data = await response.json();
            const mexicoProj = '+proj=lcc +lat_1=17.5 +lat_2=29.5 +lat_0=12 +lon_0=-102 +x_0=2500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
            const wgs84 = 'EPSG:4326';
            const reprojectCoordinates = (coords) => {
                if (typeof coords[0] === 'number') {
                    const [lng, lat] = proj4(mexicoProj, wgs84, coords);
                    return [lng, lat];
                } else {
                    return coords.map(coord => reprojectCoordinates(coord));
                }
            };
            data.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    feature.geometry.coordinates = reprojectCoordinates(feature.geometry.coordinates);
                }
            });
            const borderLayer = L.geoJSON(data, {
                style: {
                    color: '#333333',
                    weight: 1.5,
                    opacity: 0.8,
                    fillOpacity: 0,
                    className: 'mexico-border-shadow' // Add class for styling
                },
                interactive: false
            });
            mexicoBorderLayer.addLayer(borderLayer);
            console.log('✅ Capa de contorno de México cargada para el control.');
        } catch (error) {
            console.error('Error al cargar la capa de contorno de México:', error);
        }
    })();

    graticuleLayer.addTo(map);
    graticuleLabels.addTo(map);
    // marinasLayer.addTo(map); // Deshabilitado por defecto
    mexicoBorderLayer.addTo(map); // Add to map by default

    // Crear capas dummy para controlar logos
    const senerLogoLayer = L.layerGroup();
    senerLogoLayer.addTo(map); // Add by default to be checked
    const snienLogoLayer = L.layerGroup();
    snienLogoLayer.addTo(map); // Add by default to be checked

    function updateLogoVisibility() {
        const showSener = map.hasLayer(senerLogoLayer);
        const showSnien = map.hasLayer(snienLogoLayer);

        if (senerLogoWrapper) {
            senerLogoWrapper.style.display = showSener ? '' : 'none';
        }
        if (snienLogoWrapper) {
            snienLogoWrapper.style.display = showSnien ? '' : 'none';
        }
    }

    // Listener para mostrar/ocultar logos
    map.on('overlayadd', updateLogoVisibility);
    map.on('overlayremove', updateLogoVisibility);

    // Crear overlays para el control de capas
    const overlays = {
        'Contorno de México': mexicoBorderLayer,
        'Retícula (Lat/Lon)': graticuleLayer,
        'Regiones Marinas': marinasLayer,
        'Logo SENER': senerLogoLayer,
        'Logo SNIEn': snienLogoLayer
    };

    if (Object.keys(baseLayersForControl).length) {
        L.control.layers(baseLayersForControl, overlays, { position: 'topright', collapsed: true }).addTo(map);
    }

    // Initial call to set logo visibility
    updateLogoVisibility();

    // Asegurar que las regiones marinas estén deshabilitadas al inicio
    if (map.hasLayer(marinasLayer)) {
        map.removeLayer(marinasLayer);
    }

    console.log('✅ Control de capas con logos integrado');

    // Configurar vista inicial del mapa
    let currentBaseLayer = activeBaseLayer || null;

    map.fitBounds(mexicoBounds.pad(-0.15));

    const markersLayer = L.layerGroup().addTo(map);
    let markersClusterGroup = null;
    let electricityPermitsData = []; // Store electricity permits data for search
    let currentFilteredData = []; // Store currently filtered/visible permits
    let currentFilter = null; // Store current filter {type: 'gcr'|'tech', value: 'name'}
    let gcrGeometries = null; // Store GCR geometries from GeoJSON
    let statesGeometries = null; // Store States geometries from GeoJSON
    let gcrLayerGroup = null; // Layer for GCR highlighting
    let statesLayerGroup = null; // Layer for States highlighting

    // State ID to Name mapping
    const stateIdToName = {
        '01': 'Aguascalientes',
        '02': 'Baja California',
        '03': 'Baja California Sur',
        '04': 'Campeche',
        '05': 'Coahuila',
        '06': 'Colima',
        '07': 'Chiapas',
        '08': 'Chihuahua',
        '09': 'Ciudad de México',
        '10': 'Durango',
        '11': 'Guanajuato',
        '12': 'Guerrero',
        '13': 'Hidalgo',
        '14': 'Jalisco',
        '15': 'México',
        '16': 'Michoacán',
        '17': 'Morelos',
        '18': 'Nayarit',
        '19': 'Nuevo León',
        '20': 'Oaxaca',
        '21': 'Puebla',
        '22': 'Querétaro',
        '23': 'Quintana Roo',
        '24': 'San Luis Potosí',
        '25': 'Sinaloa',
        '26': 'Sonora',
        '27': 'Tabasco',
        '28': 'Tamaulipas',
        '29': 'Tlaxcala',
        '30': 'Veracruz',
        '31': 'Yucatán',
        '32': 'Zacatecas'
    };

    // Presas data - Análisis espacial
    var presasDataLayers = {}; // Store data layers (localidades indígenas, etc.)
    let presasAnalysisLayer = null; // Layer para análisis espacial (círculos, localidades cercanas)
    let currentPresaSelected = null; // Presa actualmente seleccionada
    let currentSearchRadius = 10000; // Radio de búsqueda en metros (default 10km)
    let radiusControl = null; // Control del slider de radio

    // EXPONER currentSearchRadius como variable global para que window.analyzePresaClick pueda actualizarla
    window.currentSearchRadius = currentSearchRadius;

    // Petrolíferos data
    let petroliferosPermitsData = []; // Store petroliferos permits data
    let petroliferosStats = {}; // Store petroliferos statistics
    let currentPetroliferosFilter = null; // Current filter for petroliferos
    let currentPetroliferosFilteredData = []; // Filtered data for petroliferos

    // Gas LP data
    let gasLPPermitsData = []; // Store Gas LP permits data
    let gasLPStats = {}; // Store Gas LP statistics
    let currentGasLPFilter = null; // Current filter for Gas LP
    let currentGasLPFilteredData = []; // Filtered data for Gas LP

    // Gas Natural data
    let gasNaturalPermitsData = []; // Store Gas Natural permits data
    let gasNaturalStats = {}; // Store Gas Natural statistics
    let currentGasNaturalFilter = null; // Current filter for Gas Natural
    let currentGasNaturalFilteredData = []; // Filtered data for Gas Natural

    // Chart.js instances
    let electricityTechChart = null;
    let electricityStatesChart = null;
    let petroliferosBrandChart = null;
    let petroliferosStatesChart = null;
    let gasLPTypeChart = null;
    let gasLPStatesChart = null;
    let gasNaturalTypeChart = null;
    let gasNaturalStatesChart = null;

    let electricityStats = {
        byState: {}, // By EfId (Estado/Entidad Federativa)
        byGCR: {}, // By GCR geometry (calculated with Turf.js)
        byTech: {},
        matrix: {}, // GCR x Technology matrix
        totals: {
            capacity: 0,
            generation: 0,
            count: 0
        }
    };

    // Funciones auxiliares
    function togglePreloader(show) {
        // Preloader principal (fuera del mapa)
        if (preloader) {
            console.log(`🔄 togglePreloader principal: ${show ? 'MOSTRANDO' : 'OCULTANDO'}`);
            preloader.classList.toggle('hidden', !show);

            if (!show) {
                preloader.style.display = 'none';
            } else {
                preloader.style.display = 'flex';
            }
        }

        // Preloader del mapa (visible en pantalla completa)
        const mapPreloader = document.getElementById('map-preloader');
        if (mapPreloader) {
            console.log(`🔄 togglePreloader del mapa: ${show ? 'MOSTRANDO' : 'OCULTANDO'}`);
            if (show) {
                mapPreloader.classList.add('active');
                mapPreloader.style.display = 'flex';
            } else {
                mapPreloader.classList.remove('active');
                mapPreloader.style.display = 'none';
            }
        }
    }

    const insetBoundsLayerGroup = L.layerGroup().addTo(map);
    let insetControllers = [];

    function updateLeaderLines() {
        if (!leaderLineSvg || !insetControllers.length) return;

        insetControllers.forEach(controller => {
            if (!controller.line || !controller.rectangle || !controller.container) return;

            const rectBounds = controller.rectangle.getBounds();
            const rectCenterLatLng = rectBounds.getCenter();
            const rectPoint = map.latLngToContainerPoint(rectCenterLatLng);

            const insetRect = controller.container.getBoundingClientRect();
            const mapRect = map.getContainer().getBoundingClientRect();

            // Calculate inset center relative to the map container
            const insetCenterX = (insetRect.left - mapRect.left) + insetRect.width / 2;
            const insetCenterY = (insetRect.top - mapRect.top) + insetRect.height / 2;

            controller.line.setAttribute('x1', rectPoint.x);
            controller.line.setAttribute('y1', rectPoint.y);
            controller.line.setAttribute('x2', insetCenterX);
            controller.line.setAttribute('y2', insetCenterY);
        });
    }

    map.on('move', updateLeaderLines);


    function clearInsetMarkers() {
        insetControllers.forEach(controller => {
            if (controller.markersLayer && typeof controller.markersLayer.clearLayers === 'function') {
                controller.markersLayer.clearLayers();
            }
        });
    }

    function clearInsetPolygons() {
        insetControllers.forEach(controller => {
            if (controller.polygonsLayer && typeof controller.polygonsLayer.clearLayers === 'function') {
                controller.polygonsLayer.clearLayers();
            }
        });
    }

    function clearInsetLines() {
        insetControllers.forEach(controller => {
            if (controller.linesLayer && typeof controller.linesLayer.clearLayers === 'function') {
                controller.linesLayer.clearLayers();
            }
        });
    }

    function clearInsetLayers() {
        clearInsetMarkers();
        clearInsetPolygons();
        clearInsetLines();
    }

    function destroyInsetMaps() {
        clearInsetLayers();
        if (leaderLineSvg) {
            leaderLineSvg.innerHTML = '';
        }
        insetControllers.forEach(controller => {
            if (controller.map) {
                controller.map.remove();
            }
            if (controller.container && controller.container.parentNode) {
                controller.container.parentNode.removeChild(controller.container);
            }
        });
        insetControllers = [];
        insetBoundsLayerGroup.clearLayers();

        // Remover botón de toggle de minimapas
        removeInsetToggleButton();
    }

    function createInsetMaps(insets) {
        destroyInsetMaps();
        if (!Array.isArray(insets) || !insets.length) {
            return;
        }
        const mapContainerEl = map.getContainer();
        const defaultPositions = [
            { top: '18px', right: '18px' },
            { bottom: '18px', right: '18px' },
            { top: '18px', left: '18px' },
            { bottom: '18px', left: '18px' }
        ];

        insets.forEach((insetConfig, index) => {
            const container = document.createElement('div');
            container.className = 'map-inset';
            const widthValue = insetConfig.size && insetConfig.size.width !== undefined ? insetConfig.size.width : 220;
            const heightValue = insetConfig.size && insetConfig.size.height !== undefined ? insetConfig.size.height : 160;
            container.style.width = typeof widthValue === 'number' ? widthValue + 'px' : String(widthValue);
            container.style.height = typeof heightValue === 'number' ? heightValue + 'px' : String(heightValue);

            const position = insetConfig.position || defaultPositions[index] || defaultPositions[0];
            Object.keys(position).forEach(prop => {
                const value = position[prop];
                container.style[prop] = typeof value === 'number' ? value + 'px' : value;
            });

            const titleEl = document.createElement('div');
            titleEl.className = 'map-inset__title';
            titleEl.textContent = insetConfig.label || 'Detalle';
            container.appendChild(titleEl);

            const insetMapEl = document.createElement('div');
            insetMapEl.className = 'map-inset__map';
            container.appendChild(insetMapEl);

            // Crear 4 handles de redimensionamiento (uno en cada esquina)
            const resizeHandleSE = document.createElement('div');
            resizeHandleSE.className = 'map-inset__resize-handle map-inset__resize-handle--se';
            resizeHandleSE.title = 'Redimensionar';
            container.appendChild(resizeHandleSE);

            const resizeHandleSW = document.createElement('div');
            resizeHandleSW.className = 'map-inset__resize-handle map-inset__resize-handle--sw';
            resizeHandleSW.title = 'Redimensionar';
            container.appendChild(resizeHandleSW);

            const resizeHandleNE = document.createElement('div');
            resizeHandleNE.className = 'map-inset__resize-handle map-inset__resize-handle--ne';
            resizeHandleNE.title = 'Redimensionar';
            container.appendChild(resizeHandleNE);

            const resizeHandleNW = document.createElement('div');
            resizeHandleNW.className = 'map-inset__resize-handle map-inset__resize-handle--nw';
            resizeHandleNW.title = 'Redimensionar';
            container.appendChild(resizeHandleNW);

            mapContainerEl.appendChild(container);

            L.DomEvent.disableClickPropagation(container);

            const insetMap = L.map(insetMapEl, {
                attributionControl: false,
                zoomControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false,
                tap: false,
                inertia: false
            });

            // Crear panes para cada estilo con sus filtros
            insetMap.createPane(CREMA_TILE_PANE);
            const insetCremaPane = insetMap.getPane(CREMA_TILE_PANE);
            if (insetCremaPane) {
                insetCremaPane.style.zIndex = 150;
                insetCremaPane.style.filter = 'sepia(0.4) saturate(0.2) brightness(1.2) contrast(0.85)';
                insetCremaPane.style.opacity = '0.45';
            }

            insetMap.createPane(GRIS_TILE_PANE);
            const insetGrisPane = insetMap.getPane(GRIS_TILE_PANE);
            if (insetGrisPane) {
                insetGrisPane.style.zIndex = 150;
                insetGrisPane.style.filter = 'grayscale(1) brightness(1.1) contrast(0.9)';
                insetGrisPane.style.opacity = '0.5';
            }

            insetMap.createPane(MEXICO_OVERLAY_PANE);
            const insetMexicoPane = insetMap.getPane(MEXICO_OVERLAY_PANE);
            if (insetMexicoPane) {
                insetMexicoPane.style.zIndex = 199;
            }

            // --- Draggable and Resizable Logic ---
            let isDragging = false;
            let dragStartX, dragStartY, elStartX, elStartY;

            titleEl.addEventListener('mousedown', function (e) {
                L.DomEvent.stopPropagation(e);
                e.preventDefault();
                isDragging = true;

                document.body.style.userSelect = 'none';

                dragStartX = e.clientX;
                dragStartY = e.clientY;

                const rect = container.getBoundingClientRect();
                const parentRect = mapContainerEl.getBoundingClientRect();

                elStartX = rect.left - parentRect.left;
                elStartY = rect.top - parentRect.top;

                document.addEventListener('mousemove', onDrag);
                document.addEventListener('mouseup', onDragEnd);
            });

            function onDrag(e) {
                if (!isDragging) return;
                const dx = e.clientX - dragStartX;
                const dy = e.clientY - dragStartY;

                container.style.left = `${elStartX + dx}px`;
                container.style.top = `${elStartY + dy}px`;
                container.style.right = 'auto';
                container.style.bottom = 'auto';
                updateLeaderLines();
            }

            function onDragEnd() {
                isDragging = false;
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onDrag);
                document.removeEventListener('mouseup', onDragEnd);
                updateLeaderLines();
            }

            let isResizing = false;
            let resizeStartX, resizeStartY, elStartWidth, elStartHeight, elStartLeft, elStartTop;
            let resizeDirection = ''; // 'se', 'sw', 'ne', 'nw'

            // Función genérica para iniciar el redimensionamiento
            function startResize(e, direction) {
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                resizeDirection = direction;

                document.body.style.userSelect = 'none';

                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                elStartWidth = container.offsetWidth;
                elStartHeight = container.offsetHeight;

                const rect = container.getBoundingClientRect();
                const parentRect = mapContainerEl.getBoundingClientRect();
                elStartLeft = rect.left - parentRect.left;
                elStartTop = rect.top - parentRect.top;

                document.addEventListener('mousemove', onResize);
                document.addEventListener('mouseup', onResizeEnd);
            }

            // Agregar event listeners a cada handle
            resizeHandleSE.addEventListener('mousedown', (e) => startResize(e, 'se'));
            resizeHandleSW.addEventListener('mousedown', (e) => startResize(e, 'sw'));
            resizeHandleNE.addEventListener('mousedown', (e) => startResize(e, 'ne'));
            resizeHandleNW.addEventListener('mousedown', (e) => startResize(e, 'nw'));

            function onResize(e) {
                if (!isResizing) return;
                const dx = e.clientX - resizeStartX;
                const dy = e.clientY - resizeStartY;

                let newWidth = elStartWidth;
                let newHeight = elStartHeight;
                let newLeft = elStartLeft;
                let newTop = elStartTop;

                // Calcular nuevas dimensiones y posición según la dirección
                switch (resizeDirection) {
                    case 'se': // Sureste (abajo-derecha) - comportamiento original
                        newWidth = Math.max(150, elStartWidth + dx);
                        newHeight = Math.max(100, elStartHeight + dy);
                        break;

                    case 'sw': // Suroeste (abajo-izquierda)
                        newWidth = Math.max(150, elStartWidth - dx);
                        newHeight = Math.max(100, elStartHeight + dy);
                        newLeft = elStartLeft + (elStartWidth - newWidth);
                        break;

                    case 'ne': // Noreste (arriba-derecha)
                        newWidth = Math.max(150, elStartWidth + dx);
                        newHeight = Math.max(100, elStartHeight - dy);
                        newTop = elStartTop + (elStartHeight - newHeight);
                        break;

                    case 'nw': // Noroeste (arriba-izquierda)
                        newWidth = Math.max(150, elStartWidth - dx);
                        newHeight = Math.max(100, elStartHeight - dy);
                        newLeft = elStartLeft + (elStartWidth - newWidth);
                        newTop = elStartTop + (elStartHeight - newHeight);
                        break;
                }

                container.style.width = `${newWidth}px`;
                container.style.height = `${newHeight}px`;

                // Actualizar posición si es necesario (para esquinas izquierdas o superiores)
                if (resizeDirection.includes('w') || resizeDirection.includes('n')) {
                    container.style.left = `${newLeft}px`;
                    container.style.top = `${newTop}px`;
                    container.style.right = 'auto';
                    container.style.bottom = 'auto';
                }

                if (insetMap) {
                    insetMap.invalidateSize({ debounceMoveend: true });
                }
                updateLeaderLines();
            }

            function onResizeEnd() {
                isResizing = false;
                resizeDirection = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onResize);
                document.removeEventListener('mouseup', onResizeEnd);
                if (insetMap) {
                    insetMap.invalidateSize({ debounceMoveend: true });
                }
                updateLeaderLines();
            }

            container.addEventListener('mouseover', () => {
                insetMap.dragging.enable();
                insetMap.scrollWheelZoom.enable();
                insetMap.doubleClickZoom.enable();
                insetMap.boxZoom.enable();
            });

            container.addEventListener('mouseout', () => {
                if (!isDragging && !isResizing) {
                    insetMap.dragging.disable();
                    insetMap.scrollWheelZoom.disable();
                    insetMap.doubleClickZoom.disable();
                    insetMap.boxZoom.disable();
                }
            });

            const initialLayerConfig = Object.values(layerConfigs).find(config => config.label === currentBaseLayerName);
            let initialInsetBaseLayer;

            if (currentBaseLayerName === 'Ninguno') {
                // Caso especial para "Ninguno": solo agregar la capa de México sin satélite
                initialInsetBaseLayer = L.layerGroup();
                if (mexicoOutlineLayerNinguno) {
                    // Asegurar que el pane de México existe en el minimapa
                    if (!insetMap.getPane(MEXICO_OVERLAY_PANE)) {
                        insetMap.createPane(MEXICO_OVERLAY_PANE);
                        const mexPane = insetMap.getPane(MEXICO_OVERLAY_PANE);
                        if (mexPane) {
                            mexPane.style.zIndex = 199;
                        }
                    }

                    const clonedLayer = L.geoJSON(mexicoOutlineLayerNinguno.toGeoJSON(), {
                        pane: MEXICO_OVERLAY_PANE,
                        style: mexicoOutlineLayerNinguno.options.style
                    });
                    initialInsetBaseLayer.addLayer(clonedLayer);
                }
                // Configurar fondo blanco para el minimapa
                insetMap.getContainer().style.backgroundColor = 'white';
            } else if (initialLayerConfig && initialLayerConfig.creator) {
                initialInsetBaseLayer = initialLayerConfig.creator();
            } else {
                initialInsetBaseLayer = L.tileLayer(fallbackLight, {
                    attribution: fallbackAttribution,
                    maxZoom: 18
                });
            }
            initialInsetBaseLayer.addTo(insetMap);

            const insetPolygonsLayer = L.layerGroup().addTo(insetMap);
            const insetLinesLayer = L.layerGroup().addTo(insetMap);
            const insetMarkersLayer = L.layerGroup().addTo(insetMap);

            let rectangle;
            if (Array.isArray(insetConfig.bounds) && insetConfig.bounds.length === 2) {
                rectangle = L.rectangle(insetConfig.bounds, {
                    color: '#1f7a62',
                    weight: 1.5,
                    dashArray: '4',
                    fill: false,
                    interactive: false
                }).addTo(insetBoundsLayerGroup);

                // Ocultar los rectángulos de los minimapas al inicio
                insetBoundsLayerGroup.removeLayer(rectangle);
            }

            const leaderLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            leaderLine.classList.add('leader-line');
            leaderLineSvg.appendChild(leaderLine);

            if (Array.isArray(insetConfig.center) && insetConfig.center.length === 2) {
                insetMap.setView(insetConfig.center, insetConfig.zoom || 7);
            } else if (Array.isArray(insetConfig.bounds) && insetConfig.bounds.length === 2) {
                insetMap.fitBounds(insetConfig.bounds);
            }

            insetControllers.push({
                container,
                map: insetMap,
                baseLayer: initialInsetBaseLayer,
                polygonsLayer: insetPolygonsLayer,
                linesLayer: insetLinesLayer,
                markersLayer: insetMarkersLayer,
                config: insetConfig,
                rectangle,
                line: leaderLine
            });

            // Ocultar minimapas por defecto
            container.style.display = 'none';
        });

        // Initial draw of leader lines
        updateLeaderLines();

        // Crear botón de toggle para minimapas
        createInsetToggleButton();
    }

    // Función para crear el botón de toggle de minimapas
    function createInsetToggleButton() {
        // Remover botón existente si hay
        const existingBtn = document.getElementById('toggle-insets-btn');
        if (existingBtn) {
            existingBtn.remove();
        }

        // Crear botón de toggle
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-insets-btn';
        toggleBtn.className = 'btn-secondary btn-icon toggle-insets-btn';
        toggleBtn.title = 'Mostrar/Ocultar Minimapas';
        toggleBtn.innerHTML = '<i class="bi bi-grid-3x3-gap"></i>';
        toggleBtn.style.cssText = `
            position: absolute;
            bottom: 80px;
            right: 10px;
            z-index: 1000;
            width: 40px;
            height: 40px;
            border-radius: 4px;
            background: white;
            border: 2px solid rgba(0,0,0,0.2);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;

        let insetsVisible = false;

        toggleBtn.addEventListener('click', function () {
            insetsVisible = !insetsVisible;

            insetControllers.forEach(controller => {
                if (controller.container) {
                    controller.container.style.display = insetsVisible ? 'block' : 'none';
                }
                if (controller.line) {
                    controller.line.style.display = insetsVisible ? 'block' : 'none';
                }
                if (controller.rectangle) {
                    if (insetsVisible) {
                        insetBoundsLayerGroup.addLayer(controller.rectangle);
                    } else {
                        insetBoundsLayerGroup.removeLayer(controller.rectangle);
                    }
                }
            });

            // Actualizar icono y estilo del botón
            if (insetsVisible) {
                toggleBtn.innerHTML = '<i class="bi bi-grid-3x3-gap-fill"></i>';
                toggleBtn.style.background = '#1f7a62';
                toggleBtn.style.color = 'white';
                toggleBtn.title = 'Ocultar Minimapas';
                updateLeaderLines();
            } else {
                toggleBtn.innerHTML = '<i class="bi bi-grid-3x3-gap"></i>';
                toggleBtn.style.background = 'white';
                toggleBtn.style.color = '#333';
                toggleBtn.title = 'Mostrar Minimapas';
            }
        });

        // Agregar al contenedor del mapa
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.appendChild(toggleBtn);
        }
    }

    // Función para remover el botón de toggle
    function removeInsetToggleButton() {
        const toggleBtn = document.getElementById('toggle-insets-btn');
        if (toggleBtn) {
            toggleBtn.remove();
        }
    }

    // Función para crear el botón de toggle de etiquetas
    function createLabelToggleControl() {
        // Remover botón existente si hay
        const existingBtn = document.getElementById('toggle-labels-btn');
        if (existingBtn) {
            existingBtn.remove();
        }

        // Crear botón de toggle
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-labels-btn';
        toggleBtn.className = 'btn-secondary btn-icon toggle-labels-btn';
        toggleBtn.title = 'Ocultar Etiquetas';
        toggleBtn.innerHTML = '<i class="bi bi-tags-fill"></i>'; // Icono de etiquetas activas por defecto
        toggleBtn.style.cssText = `
            position: absolute;
            bottom: 130px; /* Encima del botón de minimapas */
            right: 10px;
            z-index: 1000;
            width: 40px;
            height: 40px;
            border-radius: 4px;
            background: #1f7a62; /* Activo por defecto */
            color: white;
            border: 2px solid rgba(0,0,0,0.2);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;

        let labelsVisible = false;
        const mapContainer = document.getElementById('map');

        // Asegurar que las etiquetas estén ocultas inicialmente
        if (mapContainer) {
            mapContainer.classList.add('hide-node-labels');
        }

        // Actualizar el estado inicial del botón
        toggleBtn.innerHTML = '<i class="bi bi-tags"></i>';
        toggleBtn.style.background = 'white';
        toggleBtn.style.color = '#333';
        toggleBtn.title = 'Mostrar Etiquetas';

        toggleBtn.addEventListener('click', function () {
            labelsVisible = !labelsVisible;

            if (mapContainer) {
                if (labelsVisible) {
                    mapContainer.classList.remove('hide-node-labels');
                    toggleBtn.innerHTML = '<i class="bi bi-tags-fill"></i>';
                    toggleBtn.style.background = '#1f7a62';
                    toggleBtn.style.color = 'white';
                    toggleBtn.title = 'Ocultar Etiquetas';
                } else {
                    mapContainer.classList.add('hide-node-labels');
                    toggleBtn.innerHTML = '<i class="bi bi-tags"></i>';
                    toggleBtn.style.background = 'white';
                    toggleBtn.style.color = '#333';
                    toggleBtn.title = 'Mostrar Etiquetas';
                }
            }
        });

        // Agregar al contenedor del mapa
        if (mapContainer) {
            mapContainer.appendChild(toggleBtn);
        }
    }

    // Función para remover el botón de toggle de etiquetas
    function removeLabelToggleControl() {
        const toggleBtn = document.getElementById('toggle-labels-btn');
        if (toggleBtn) {
            toggleBtn.remove();
        }
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.classList.remove('hide-node-labels');
        }
    }

    function getNodeMarkerOptions(includePane) {
        const options = {
            radius: NODE_MARKER_OPTIONS.radius,
            fillColor: NODE_MARKER_OPTIONS.fillColor,
            color: NODE_MARKER_OPTIONS.color,
            weight: NODE_MARKER_OPTIONS.weight,
            opacity: NODE_MARKER_OPTIONS.opacity,
            fillOpacity: NODE_MARKER_OPTIONS.fillOpacity
        };
        if (includePane) {
            options.pane = 'nodesPane';
        }
        return options;
    }

    function clearData() {
        markersLayer.clearLayers();
        clearInsetMarkers();
        removeLabelToggleControl();

        // Clear cluster group if exists
        if (markersClusterGroup) {
            map.removeLayer(markersClusterGroup);
            markersClusterGroup = null;
        }

        // Clear presas analysis layers
        if (presasAnalysisLayer) {
            map.removeLayer(presasAnalysisLayer);
            presasAnalysisLayer = null;
        }
        presasDataLayers = {};
        currentPresaSelected = null;

        // Clear electricity permits data
        electricityPermitsData = [];
        currentFilteredData = [];
        currentFilter = null;

        // Clear petroliferos permits data
        petroliferosPermitsData = [];
        currentPetroliferosFilteredData = [];
        currentPetroliferosFilter = null;

        // Clear Gas LP permits data
        gasLPPermitsData = [];
        currentGasLPFilteredData = [];
        currentGasLPFilter = null;

        // Clear Gas Natural permits data
        gasNaturalPermitsData = [];
        currentGasNaturalFilteredData = [];
        currentGasNaturalFilter = null;

        // Don't clear gcrGeometries and statesGeometries - we can reuse them

        // Clear search box
        clearSearchBox();

        // Hide geometry layers
        hideGeometryLayers();

        // Hide filters panels
        const electricityFiltersPanel = document.getElementById('electricity-filters-panel');
        if (electricityFiltersPanel) {
            electricityFiltersPanel.style.display = 'none';
        }

        const petroliferosFiltersPanel = document.getElementById('petroliferos-filters-panel');
        if (petroliferosFiltersPanel) {
            petroliferosFiltersPanel.style.display = 'none';
        }

        const gasLPFiltersPanel = document.getElementById('gaslp-filters-panel');
        if (gasLPFiltersPanel) {
            gasLPFiltersPanel.style.display = 'none';
        }

        const gasNaturalFiltersPanel = document.getElementById('gasnatural-filters-panel');
        if (gasNaturalFiltersPanel) {
            gasNaturalFiltersPanel.style.display = 'none';
        }

        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = '--';
        }
    }

    // --- Instrument and Map Selection Logic ---

    const instrumentSelect = document.getElementById('instrument-select');
    const mapSelect = document.getElementById('map-select');
    const MAP_SELECT_IDS = ['map-select', 'mobile-map-select', 'fullscreen-map-select'];

    function syncMapDropdowns(targetValue) {
        MAP_SELECT_IDS.forEach(id => {
            const selectEl = document.getElementById(id);
            if (!selectEl) {
                return;
            }

            if (targetValue) {
                const hasOption = Array.from(selectEl.options || []).some(option => option.value === targetValue);
                if (hasOption) {
                    selectEl.value = targetValue;
                }
            } else if (selectEl.options && selectEl.options.length) {
                selectEl.selectedIndex = 0;
            } else {
                selectEl.value = '';
            }
        });
    }

    function syncMapDropdownOptions() {
        const primarySelect = document.getElementById('map-select');
        if (!primarySelect) {
            return;
        }

        MAP_SELECT_IDS.forEach(id => {
            if (id === 'map-select') {
                return;
            }
            const selectEl = document.getElementById(id);
            if (!selectEl) {
                return;
            }

            selectEl.innerHTML = primarySelect.innerHTML;
            selectEl.disabled = primarySelect.disabled;
        });
    }
    const sheetInfoEl = document.querySelector('.data-source');

    map.createPane('gerenciasPane');
    map.getPane('gerenciasPane').style.zIndex = 400; // Set explicit z-index for gerencias
    map.createPane('statesPane');
    map.getPane('statesPane').style.zIndex = 400; // Same level as gerencias
    const instrumentLayerGroup = L.layerGroup({ pane: 'gerenciasPane' }).addTo(map);
    map.createPane('connectionsPane');
    const connectionsLayerGroup = L.layerGroup({ pane: 'connectionsPane' }).addTo(map);
    map.createPane('municipalitiesPane');
    map.getPane('municipalitiesPane').style.zIndex = 450;
    const municipalitiesLayerGroup = L.layerGroup({ pane: 'municipalitiesPane' }).addTo(map);
    map.createPane('nodesPane');
    const nodesPane = map.getPane('nodesPane');
    if (nodesPane) {
        nodesPane.style.zIndex = 620;
        nodesPane.style.pointerEvents = 'auto';
    }

    // Create pane for electricity permits markers (above gerencias)
    map.createPane('electricityMarkersPane');
    const electricityMarkersPane = map.getPane('electricityMarkersPane');
    if (electricityMarkersPane) {
        electricityMarkersPane.style.zIndex = 650; // Increased to be well above everything
        electricityMarkersPane.style.pointerEvents = 'auto';
    }

    const connectionsPane = map.getPane('connectionsPane');
    if (connectionsPane) {
        connectionsPane.style.zIndex = 610;
        connectionsPane.style.pointerEvents = 'none';
    }

    const mapTitleDisplay = document.getElementById('map-title-display');
    const selectedRegionBanner = document.getElementById('selected-region-banner');
    const selectedRegionText = document.getElementById('selected-region-text');
    const DEFAULT_MAP_TITLE = [
        'Mapa SNIEn - Sistema Nacional de Informaci',
        String.fromCharCode(243),
        'n Energ',
        String.fromCharCode(233),
        'tica'
    ].join('');

    function updateMapTitleDisplay(title) {
        if (!mapTitleDisplay) {
            return;
        }
        const displayTitle = title && title.trim() ? title : DEFAULT_MAP_TITLE;
        mapTitleDisplay.textContent = displayTitle;

        // Exponer globalmente para exportación
        window.currentMapTitle = displayTitle;
    }
    updateMapTitleDisplay(DEFAULT_MAP_TITLE);
    let currentMapTitle = DEFAULT_MAP_TITLE;
    window.currentMapTitle = currentMapTitle;
    let municipalitiesData = null;
    let electrificationData = null;
    let focusedRegion = null; // Track currently focused region for electrification map
    let pibSenData = null; // Store SEN data for PIB map
    let pibSinData = null; // Store SIN data for PIB map
    let capacityTotals = null; // Store totals for capacity additions map

    async function loadTotalCapacityData() {
        const urls = [
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vR6orBJGbqI8xr6TkOUaJM7I-8RbE7inbex6PrKWHdgTUif8EBFljKuzFR42OqoroQ87kAGpZt_ry-J/pub?gid=0&single=true&output=csv',
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuLWC7WRjRZ-Kicm-0rWJd9beVu4jAwsABNLcixRUCr6XvC0pVvrgPXJW-qh-44AvmLt6gYBDwdoms/pub?gid=0&single=true&output=csv',
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vRIo6nqNkppQCVqqsUC1LNKSw8n9AyslhakQb_3gB7bccFP1Tb7ssDX1ycdMe0rTSlSrWXpH_CSTMna/pub?gid=0&single=true&output=csv',
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vTYfjJ8D1nJGd7IFKOzzg_e7Dpn77RyyeQM1MVFLg4pN4CB7TR1hj_5Zt2igXlDiht8p7hVs-aIp3DQ/pub?gid=0&single=true&output=csv'
        ];

        const aggregatedData = {};
        const allTechs = new Set();

        const normalizeGCRName = (name) => {
            if (!name) return null;
            const lowerName = name.toLowerCase().trim();

            if (lowerName.includes('baja california sur') || lowerName === 'bcs' || lowerName === 'b.c.s.') return 'Baja California Sur';
            if (lowerName.includes('baja california') || lowerName === 'bc' || lowerName === 'b.c.') return 'Baja California';
            if (lowerName.includes('mulege')) return 'Mulegé';
            if (lowerName === 'cen') return 'Central';
            if (lowerName === 'nes') return 'Noreste';
            if (lowerName === 'nor') return 'Noroeste';
            if (lowerName === 'nte') return 'Norte';
            if (lowerName === 'occ') return 'Occidental';
            if (lowerName === 'ori') return 'Oriental';
            if (lowerName === 'pen') return 'Peninsular';

            return name;
        };

        const fetchData = url => new Promise((resolve, reject) => {
            Papa.parse(url, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: results => resolve(results.data),
                error: err => reject(err)
            });
        });

        const allResults = await Promise.all(urls.map(fetchData));

        allResults.forEach((dataSet, index) => {
            console.log(`Processing file ${index + 1}`);
            dataSet.forEach(row => {
                const gcrKey = Object.keys(row).find(k => k.toLowerCase().trim() === 'gcr' || k.toLowerCase().trim() === 'gerencia de control regional');
                const originalGcr = row[gcrKey];
                const gcr = normalizeGCRName(originalGcr);

                if (!gcr) {
                    return;
                }

                if (!aggregatedData[gcr]) {
                    aggregatedData[gcr] = { 'Gerencia de Control Regional': gcr };
                }

                Object.keys(row).forEach(key => {
                    const lowerKey = key.toLowerCase().trim();
                    if (lowerKey === 'gcr' || lowerKey === 'gerencia de control regional' || lowerKey === 'id' || lowerKey === 'unidades') {
                        return; // Skip non-data columns
                    }

                    const value = parseFloat(row[key]) || 0;
                    if (value > 0) {
                        aggregatedData[gcr][key] = (aggregatedData[gcr][key] || 0) + value;
                        allTechs.add(key);
                    }
                });
            });
        });

        console.log('Final aggregated data:', aggregatedData);

        // Create a clean array of objects from the aggregated data
        const finalData = Object.values(aggregatedData);

        // Ensure all objects have all technology columns
        finalData.forEach(gcrData => {
            allTechs.forEach(tech => {
                if (!gcrData[tech]) {
                    gcrData[tech] = 0;
                }
            });
        });

        return finalData;
    }

    const mapConfigurations = {
        'PRESAS': (typeof PRESAS_MAPS !== 'undefined' ? PRESAS_MAPS : []),
        'MUNICIPIOS_RIOS': (typeof MUNICIPIOS_RIOS_MAPS !== 'undefined' ? MUNICIPIOS_RIOS_MAPS : []),
        'PLADESE': (typeof PLADESE_MAPS !== 'undefined' ? PLADESE_MAPS : []),
        'PLADESHI': (typeof PLADESHI_MAPS !== 'undefined' ? PLADESHI_MAPS : []),
        'PLATEASE': (typeof PLATEASE_MAPS !== 'undefined' ? PLATEASE_MAPS : []),
        'PROSENER': (typeof PROSENER_MAPS !== 'undefined' ? PROSENER_MAPS : []),
        'ELECTRICIDAD': (typeof ELECTRICIDAD_MAPS !== 'undefined' ? ELECTRICIDAD_MAPS : []),
        'GAS NATURAL': (typeof GAS_NATURAL_MAPS !== 'undefined' ? GAS_NATURAL_MAPS : []),
        'GAS L.P.': (typeof GAS_LP_MAPS !== 'undefined' ? GAS_LP_MAPS : []),
        'PETROLIFEROS': (typeof PETROLIFEROS_MAPS !== 'undefined' ? PETROLIFEROS_MAPS : [])
    };

    // Exponer para la interfaz móvil y otras integraciones
    try { window.mapConfigurations = mapConfigurations; } catch (e) { }

    function hasValidSheetUrl(url) {
        const trimmed = (url || '').trim();
        return Boolean(trimmed) && !trimmed.startsWith('URL_TO_');
    }

    function getDisplaySheetUrl(url) {
        const trimmed = (url || '').trim();
        if (!trimmed) {
            return '';
        }
        try {
            const sheetUrl = new URL(trimmed);
            const output = sheetUrl.searchParams.get('output');
            if (output && output.toLowerCase() === 'csv') {
                sheetUrl.searchParams.set('output', 'html');
                return sheetUrl.toString();
            }
            if (!output && trimmed.includes('/pub?')) {
                return trimmed.replace('/pub?', '/pubhtml?');
            }
            return sheetUrl.toString();
        } catch (error) {
            return trimmed;
        }
    }

    // Exponer helper para uso desde móvil
    try { window.getDisplaySheetUrl = getDisplaySheetUrl; } catch (e) { }

    function updateSheetInfo(mapConfig, fallbackMessage) {
        if (!sheetInfoEl) {
            return;
        }
        sheetInfoEl.innerHTML = '';

        const viewUrl = mapConfig && mapConfig.googleSheetUrl ? (mapConfig.googleSheetUrl || '').trim() : '';
        const editUrl = mapConfig && mapConfig.googleSheetEditUrl ? (mapConfig.googleSheetEditUrl || '').trim() : '';

        const hasViewUrl = hasValidSheetUrl(viewUrl);
        const hasEditUrl = hasValidSheetUrl(editUrl);

        console.log('[SHEET INFO] map:', mapConfig ? mapConfig.name : '(none)', 'hasViewUrl:', hasViewUrl, 'hasEditUrl:', hasEditUrl);
        if (hasViewUrl) console.log('[SHEET INFO] raw viewUrl:', viewUrl);
        if (hasEditUrl) console.log('[SHEET INFO] raw editUrl:', editUrl);

        if (hasViewUrl || hasEditUrl) {
            sheetInfoEl.appendChild(document.createTextNode('Fuente de datos: '));
            if (hasViewUrl) {
                const displayUrl = getDisplaySheetUrl(viewUrl);
                console.log('[SHEET INFO] display viewUrl:', displayUrl);
                if (/^https?:\/\//i.test(displayUrl)) {
                    const link = document.createElement('a');
                    link.href = displayUrl;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = 'Ver datos';
                    sheetInfoEl.appendChild(link);
                }
            }

            if (hasViewUrl && hasEditUrl) {
                sheetInfoEl.appendChild(document.createTextNode(' | '));
            }

            if (hasEditUrl) {
                const link = document.createElement('a');
                link.href = editUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = 'Editar datos';
                sheetInfoEl.appendChild(link);
                console.log('[SHEET INFO] edit link appended');
            }
        } else {
            sheetInfoEl.textContent = fallbackMessage || NO_SHEET_MESSAGE;
            console.log('[SHEET INFO] fallback text set:', sheetInfoEl.textContent);
        }
        console.log('[SHEET INFO] final innerHTML:', sheetInfoEl.innerHTML);
    }

    updateSheetInfo(null, SELECT_MAP_MESSAGE);

    if (instrumentSelect) {
        instrumentSelect.addEventListener('change', function () {
            console.log('[DEBUG] Instrumento cambiado a:', this.value);
            const selectedInstrument = this.value;
            mapSelect.innerHTML = '<option value="">Seleccione un mapa</option>'; // Clear previous options
            mapSelect.disabled = true;
            mapSelect.value = '';
            syncMapDropdowns('');
            syncMapDropdownOptions();
            instrumentLayerGroup.clearLayers();
            connectionsLayerGroup.clearLayers();
            municipalitiesLayerGroup.clearLayers();
            destroyInsetMaps();
            removeLegend();

            if (selectedInstrument && mapConfigurations[selectedInstrument]) {
                const maps = mapConfigurations[selectedInstrument];
                console.log('[DEBUG] Mapas disponibles para', selectedInstrument, maps.map(m => m.name));
                maps.forEach(mapConfig => {
                    const option = document.createElement('option');
                    option.value = mapConfig.name;
                    option.textContent = mapConfig.name;
                    mapSelect.appendChild(option);
                });
                mapSelect.disabled = false;
                console.log('[DEBUG] Opciones de mapa añadidas. Total:', mapSelect.options.length);
                currentSheetUrl = null;
                clearData();
                updateSheetInfo(null, SELECT_MAP_MESSAGE);
                currentMapTitle = DEFAULT_MAP_TITLE;
                updateMapTitleDisplay(DEFAULT_MAP_TITLE);
                syncMapDropdownOptions();
            } else {
                currentSheetUrl = null;
                updateSheetInfo(null, SELECT_MAP_MESSAGE);
                clearData();
                connectionsLayerGroup.clearLayers();
                destroyInsetMaps();
                currentMapTitle = DEFAULT_MAP_TITLE;
                updateMapTitleDisplay(DEFAULT_MAP_TITLE);
                syncMapDropdownOptions();
            }
        });
    }

    let legendControl;
    let provinciaLegendControl; // Leyenda personalizada de provincias petroleras

    function addLegend(colors) {
        if (legendControl) {
            map.removeControl(legendControl);
        }

        legendControl = L.control({ position: 'bottomright' });

        legendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML += '<strong>Gerencias de Control Regional</strong>';

            for (const key in colors) {
                if (colors.hasOwnProperty(key)) {
                    const color = colors[key];
                    const item = L.DomUtil.create('div', 'legend-item', div);
                    item.innerHTML = `<i style="background:${color}"></i> ${key}`;
                }
            }
            return div;
        };

        legendControl.addTo(map);
    }

    function addGasLegend() {
        if (legendControl) {
            map.removeControl(legendControl);
        }

        legendControl = L.control({ position: 'bottomright' });

        legendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML += '<strong>Simbología</strong>';
            div.innerHTML += '<div class="legend-item"><i style="background: #7a1c32; width: 20px; height: 3px; border: none;"></i> Ducto de gas</div>';
            div.innerHTML += '<div class="legend-item"><i style="background: #1f7a62; border-radius: 50%;"></i> Centrales de Ciclo Combinado</div>';
            return div;
        };

        legendControl.addTo(map);
    }

    let municipalitiesLegendControl;

    function addMunicipalitiesLegend() {
        if (municipalitiesLegendControl) {
            map.removeControl(municipalitiesLegendControl);
        }

        municipalitiesLegendControl = L.control({ position: 'bottomleft' });

        municipalitiesLegendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            const grades = [0, 1, 21, 41, 61, 81];
            const colors = ['#F2D7D9', '#E0B0B6', '#CC8893', '#B86070', '#A3384D', '#601623'];
            const labels = ['0', '1 - 20', '21 - 40', '41 - 60', '61 - 80', '> 80'];

            div.innerHTML += '<strong>Número de localidades sin electrificar por municipio</strong><br>';

            for (let i = 0; i < grades.length; i++) {
                div.innerHTML +=
                    '<i style="background:' + colors[i] + '"></i> ' +
                    labels[i] + '<br>';
            }

            return div;
        };

        municipalitiesLegendControl.addTo(map);
    }

    function removeMunicipalitiesLegend() {
        if (municipalitiesLegendControl) {
            map.removeControl(municipalitiesLegendControl);
            municipalitiesLegendControl = null;
        }
    }



    function removeLegend() {
        if (legendControl) {
            map.removeControl(legendControl);
            legendControl = null;
        }
        // Remover también la leyenda de provincias petroleras si existe
        if (provinciaLegendControl) {
            map.removeControl(provinciaLegendControl);
            provinciaLegendControl = null;
        }
        // Remover etiquetas de provincias petroleras si existen
        if (window.ProvinciasPetroleras && window.ProvinciasPetroleras.removeProvinciaLabels) {
            window.ProvinciasPetroleras.removeProvinciaLabels(map);
        }
    }

    let pibLegendControl;

    function addPIBLegend(senData, sinData) {
        if (pibLegendControl) {
            map.removeControl(pibLegendControl);
        }

        pibLegendControl = L.control({ position: 'bottomleft' });

        pibLegendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = '<strong>Tasa de Crecimiento PIB</strong><br>';
            div.innerHTML += '<div class="legend-item"><i style="background: #1f7a62; width: 20px; height: 3px; border: none;"></i> 2025-2030</div>';
            div.innerHTML += '<div class="legend-item"><i style="background: #601623; width: 20px; height: 3px; border: none;"></i> 2025-2039</div>';

            // Add SEN and SIN data if available
            if (senData || sinData) {
                div.innerHTML += '<br><strong style="font-size: 11px;">TMCA (%) √</strong><br>';
                div.innerHTML += '<div style="font-size: 11px; line-height: 1.6;">';

                if (senData) {
                    div.innerHTML += '<div><strong>SEN:</strong></div>';
                    if (senData['2025-2030']) {
                        div.innerHTML += '<div style="color: #1f7a62; margin-left: 8px;">2025-2030: ' + senData['2025-2030'] + '%</div>';
                    }
                    if (senData['2025-2039']) {
                        div.innerHTML += '<div style="color: #601623; margin-left: 8px;">2025-2039: ' + senData['2025-2039'] + '%</div>';
                    }
                }

                if (sinData) {
                    div.innerHTML += '<div style="margin-top: 4px;"><strong>SIN:</strong></div>';
                    if (sinData['2025-2030']) {
                        div.innerHTML += '<div style="color: #1f7a62; margin-left: 8px;">2025-2030: ' + sinData['2025-2030'] + '%</div>';
                    }
                    if (sinData['2025-2039']) {
                        div.innerHTML += '<div style="color: #601623; margin-left: 8px;">2025-2039: ' + sinData['2025-2039'] + '%</div>';
                    }
                }

                div.innerHTML += '</div>';
            }

            return div;
        };

        pibLegendControl.addTo(map);
    }

    function addConsumptionLegend(senData, sinData) {
        if (pibLegendControl) {
            map.removeControl(pibLegendControl);
        }

        pibLegendControl = L.control({ position: 'bottomleft' });

        pibLegendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = '<strong>Pronóstico de Consumo Bruto</strong><br>';
            div.innerHTML += '<div class="legend-item"><i style="background: #1f7a62; width: 20px; height: 3px; border: none;"></i> 2025-2030</div>';
            div.innerHTML += '<div class="legend-item"><i style="background: #601623; width: 20px; height: 3px; border: none;"></i> 2025-2039</div>';

            // Add SEN and SIN data if available
            if (senData || sinData) {
                div.innerHTML += '<br><strong style="font-size: 11px;">TMCA (%)</strong><br>';
                div.innerHTML += '<div style="font-size: 11px; line-height: 1.6;">';

                if (senData) {
                    div.innerHTML += '<div><strong>SEN<sup>2</sup>:</strong></div>';
                    if (senData['2025-2030']) {
                        div.innerHTML += '<div style="color: #1f7a62; margin-left: 8px;">2025-2030: ' + senData['2025-2030'] + '%</div>';
                    }
                    if (senData['2025-2039']) {
                        div.innerHTML += '<div style="color: #601623; margin-left: 8px;">2025-2039: ' + senData['2025-2039'] + '%</div>';
                    }
                }

                if (sinData) {
                    div.innerHTML += '<div style="margin-top: 4px;"><strong>SIN<sup>2</sup>:</strong></div>';
                    if (sinData['2025-2030']) {
                        div.innerHTML += '<div style="color: #1f7a62; margin-left: 8px;">2025-2030: ' + sinData['2025-2030'] + '%</div>';
                    }
                    if (sinData['2025-2039']) {
                        div.innerHTML += '<div style="color: #601623; margin-left: 8px;">2025-2039: ' + sinData['2025-2039'] + '%</div>';
                    }
                }

                div.innerHTML += '</div>';
            }

            return div;
        };

        pibLegendControl.addTo(map);
    }

    // Function to get consistent color for each technology
    function getTechnologyColor(techName) {
        const techColors = {
            // Tecnologías fósiles/térmicas
            'CICLO COMBINADO': '#8B4513',           // Café (gas)
            'TURBOGAS': '#D2691E',                  // Café claro (gas)
            'TURBOGÁS': '#D2691E',                  // Café claro (gas)
            'CARBOELÉCTRICA': '#2F4F4F',            // Gris oscuro (carbón)
            'CARBOELECTRICA': '#2F4F4F',            // Gris oscuro (carbón)
            'COGENERACIÓN': '#FF8C00',              // Naranja oscuro (cogeneración)
            'COGENERACION': '#FF8C00',              // Naranja oscuro (cogeneración)

            // Hidroeléctricas
            'HIDROELÉCTRICA': '#1E90FF',            // Azul (agua)
            'HIDROELECTRICA': '#1E90FF',            // Azul (agua)
            'HIDROELÉCTRICA CON ALMACENAMIENTO': '#4169E1', // Azul real (agua con almacenamiento)
            'HIDROELECTRICA CON ALMACENAMIENTO': '#4169E1',
            'REBOMBEO': '#4682B4',                  // Azul acero (rebombeo)

            // Energías renovables
            'EÓLICA': '#00CED1',                    // Turquesa oscuro (viento)
            'EOLICA': '#00CED1',                    // Turquesa oscuro (viento)
            'FOTOVOLTAICA': '#FFA500',              // Naranja brillante (sol) - mejorado contraste
            'SOLAR': '#FFA500',                     // Naranja brillante (sol) - mejorado contraste
            'CSP': '#FF4500',                       // Rojo naranja (concentración solar)
            'GEOTÉRMICA': '#DC143C',                // Rojo carmesí (calor)
            'GEOTERMICA': '#DC143C',                // Rojo carmesí (calor)
            'BIOMASA': '#228B22',                   // Verde bosque (biomasa)

            // Hidrógeno
            'HIDRÓGENO': '#00BFFF',                 // Azul cielo profundo (hidrógeno)
            'HIDROGENO': '#00BFFF',                 // Azul cielo profundo (hidrógeno)
            'H2': '#00BFFF',                        // Azul cielo profundo (hidrógeno)

            // Almacenamiento
            'ALMACENAMIENTO': '#9932CC',            // Púrpura oscuro/Orquídea oscura (almacenamiento)
            'BATERÍAS': '#BA55D3',                  // Orquídea medio (baterías)
            'BATERIAS': '#BA55D3',                  // Orquídea medio (baterías)

            // Nuclear
            'NUCLEAR': '#FF6347',                   // Tomate (nuclear)

            // Otras
            'COMBUSTIÓN INTERNA': '#A0522D',        // Sienna (diesel)
            'COMBUSTION INTERNA': '#A0522D'         // Sienna (diesel)
        };

        // Normalize technology name
        const normalizedTech = techName.toUpperCase().trim();

        // Return specific color if found, otherwise return a default based on hash
        if (techColors[normalizedTech]) {
            return techColors[normalizedTech];
        }

        // Default color for unknown technologies (dark gray)
        return '#696969';
    }

    // Function to get technology acronym
    function getTechnologyAcronym(techName) {
        const techAcronyms = {
            'CICLO COMBINADO': 'CC',
            'TURBOGAS': 'TG',
            'TURBOGÁS': 'TG',
            'CARBOELÉCTRICA': 'CARB',
            'CARBOELECTRICA': 'CARB',
            'COGENERACIÓN': 'COG',
            'COGENERACION': 'COG',
            'HIDROELÉCTRICA': 'HIDRO',
            'HIDROELECTRICA': 'HIDRO',
            'HIDROELÉCTRICA CON ALMACENAMIENTO': 'HIDRO-ALM',
            'HIDROELECTRICA CON ALMACENAMIENTO': 'HIDRO-ALM',
            'REBOMBEO': 'REB',
            'EÓLICA': 'EOL',
            'EOLICA': 'EOL',
            'FOTOVOLTAICA': 'FV',
            'SOLAR': 'SOL',
            'CSP': 'CSP',
            'GEOTÉRMICA': 'GEO',
            'GEOTERMICA': 'GEO',
            'BIOMASA': 'BIO',
            'HIDRÓGENO': 'H2',
            'HIDROGENO': 'H2',
            'H2': 'H2',
            'ALMACENAMIENTO': 'ALM',
            'BATERÍAS': 'BAT',
            'BATERIAS': 'BAT',
            'NUCLEAR': 'NUC',
            'COMBUSTIÓN INTERNA': 'CI',
            'COMBUSTION INTERNA': 'CI'
        };

        const normalizedTech = techName.toUpperCase().trim();

        if (techAcronyms[normalizedTech]) {
            return techAcronyms[normalizedTech];
        }

        // Generate acronym from first letters if not found
        return techName.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 4);
    }

    function addCapacityLegend(totals, mapName) {
        if (pibLegendControl) {
            map.removeControl(pibLegendControl);
        }

        // Posicionar en bottomright para mayor visibilidad y evitar solapamiento
        pibLegendControl = L.control({ position: 'bottomright' });

        pibLegendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = '<strong>ADICIONES DE CAPACIDAD Y ALMACENAMIENTO (MW)</strong><br>';

            // Add dynamic legend items with color, acronym, technology and value
            if (totals && totals.columnNames) {
                totals.columnNames.forEach((col, index) => {
                    if (totals.columns[col] > 0) {
                        const color = getTechnologyColor(col);
                        const acronym = getTechnologyAcronym(col);
                        const value = totals.columns[col].toLocaleString('es-MX');
                        div.innerHTML += `<div class="legend-item"><i style="background: ${color}; width: 20px; height: 10px; border: none;"></i> ${col.toUpperCase()} (${acronym}): ${value} MW</div>`;
                    }
                });
            }

            // Add separated totals
            if (totals) {
                div.innerHTML += '<br><div style="border-top: 2px solid #333; padding-top: 6px; margin-top: 6px;">';
                if (totals.generationTotal && totals.generationTotal > 0) {
                    div.innerHTML += `<div style="font-size: 12px; font-weight: 700; color: #1a1a1a; margin-bottom: 3px;">TOTAL CAPACIDAD: ${totals.generationTotal.toLocaleString('es-MX')} MW</div>`;
                }
                if (totals.storageTotal && totals.storageTotal > 0) {
                    div.innerHTML += `<div style="font-size: 12px; font-weight: 700; color: #9932CC; margin-bottom: 3px;">TOTAL ALMACENAMIENTO: ${totals.storageTotal.toLocaleString('es-MX')} MW</div>`;
                }
                div.innerHTML += '</div>';
            }

            return div;
        };

        pibLegendControl.addTo(map);
    }

    function addTotalCapacityLegendTwoColumns(totals, mapName) {
        if (pibLegendControl) {
            map.removeControl(pibLegendControl);
        }

        pibLegendControl = L.control({ position: 'bottomright' });

        pibLegendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend legend-two-columns');
            // Asegurar que se muestre por encima con estilos inline forzados
            div.style.cssText = 'display: block !important; z-index: 1001 !important; visibility: visible !important; opacity: 1 !important;';
            div.innerHTML = '<strong>ADICIONES DE CAPACIDAD Y ALMACENAMIENTO (MW)</strong><br>';

            // Create two-column container
            const columnsContainer = L.DomUtil.create('div', 'legend-columns-container', div);
            const column1 = L.DomUtil.create('div', 'legend-column', columnsContainer);
            const column2 = L.DomUtil.create('div', 'legend-column', columnsContainer);

            let hasData = false;
            if (totals && totals.columnNames) {
                const itemsPerColumn = Math.ceil(totals.columnNames.length / 2);
                totals.columnNames.forEach((col, index) => {
                    if (totals.columns[col] > 0) {
                        hasData = true;
                        const color = getTechnologyColor(col);
                        const acronym = getTechnologyAcronym(col);
                        const value = totals.columns[col].toLocaleString('es-MX');
                        const targetColumn = index < itemsPerColumn ? column1 : column2;
                        const itemDiv = L.DomUtil.create('div', 'legend-item', targetColumn);
                        itemDiv.innerHTML = `<i style="background: ${color}; width: 16px; height: 10px; border: none; display: inline-block; margin-right: 6px;"></i> ${col.toUpperCase()} (${acronym}): ${value} MW`;
                    }
                });
            }

            // Add separated totals at the bottom (full width)
            const totalsContainer = L.DomUtil.create('div', 'legend-totals-row', div);
            if (totals && totals.generationTotal && totals.generationTotal > 0) {
                hasData = true;
                const genDiv = L.DomUtil.create('span', 'legend-total-item', totalsContainer);
                genDiv.innerHTML = `<strong>TOTAL CAPACIDAD: ${totals.generationTotal.toLocaleString('es-MX')} MW</strong>`;
            }
            if (totals && totals.storageTotal && totals.storageTotal > 0) {
                hasData = true;
                const almDiv = L.DomUtil.create('span', 'legend-total-item', totalsContainer);
                almDiv.innerHTML = `<strong style="color: #9932CC;">TOTAL ALMACENAMIENTO: ${totals.storageTotal.toLocaleString('es-MX')} MW</strong>`;
            }

            if (!hasData) {
                const emptyDiv = L.DomUtil.create('div', 'legend-item', div);
                emptyDiv.innerHTML = '<em>Sin datos disponibles</em>';
            }

            return div;
        };

        pibLegendControl.addTo(map);
    }

    function addHorizontalCapacityLegend(totals, mapName) {
        if (pibLegendControl) {
            map.removeControl(pibLegendControl);
        }

        pibLegendControl = L.control({ position: 'topright' });

        pibLegendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend horizontal-legend');
            div.innerHTML = '<strong>ADICIONES DE CAPACIDAD Y ALMACENAMIENTO (MW)</strong>';

            const container = L.DomUtil.create('div', 'horizontal-legend-container', div);

            if (totals && totals.columnNames) {
                totals.columnNames.forEach((col, index) => {
                    const value = totals.columns[col] || 0;
                    if (value > 0) {
                        const color = getTechnologyColor(col);
                        const acronym = getTechnologyAcronym(col);
                        const item = L.DomUtil.create('div', 'horizontal-legend-item', container);
                        item.innerHTML = `<i style="background:${color};"></i> ${col.toUpperCase()} (${acronym}): ${value.toLocaleString('es-MX')} MW`;
                    }
                });
            }

            // Add separated totals
            if (totals) {
                if (totals.generationTotal && totals.generationTotal > 0) {
                    const genItem = L.DomUtil.create('div', 'horizontal-legend-item total', container);
                    genItem.innerHTML = `<strong>TOTAL CAP: ${totals.generationTotal.toLocaleString('es-MX')} MW</strong>`;
                }
                if (totals.storageTotal && totals.storageTotal > 0) {
                    const almItem = L.DomUtil.create('div', 'horizontal-legend-item total', container);
                    almItem.innerHTML = `<strong style="color: #9932CC;">TOTAL ALM: ${totals.storageTotal.toLocaleString('es-MX')} MW</strong>`;
                }
            }

            return div;
        };

        pibLegendControl.addTo(map);
    }

    function removePIBLegend() {
        if (pibLegendControl) {
            map.removeControl(pibLegendControl);
            pibLegendControl = null;
        }
    }

    // Leyenda para capas de conservación (Presas)
    function addConservationLayersLegend() {
        // En móvil, agregar la leyenda al tab de capas en lugar del mapa
        if (window.mobileInterface && window.mobileInterface.isMobile) {
            let legendHtml = '<strong style="display: block; margin-bottom: 10px; font-size: 13px; color: #601623;">CAPAS DE CONSERVACIÓN</strong>';

            // Construir HTML de la leyenda (reutilizando la lógica existente)
            // Ramsar
            legendHtml += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <i style="background: #8D6E63; width: 22px; height: 16px; border: 2px solid #5D4037; opacity: 0.7; display: inline-block; margin-right: 8px; border-radius: 2px;"></i>
                    <span style="font-size: 12px; font-weight: 600; color: #5D4037;">Sitios Ramsar</span>
                </div>
            `;
            // ANP
            legendHtml += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <i style="background: #66BB6A; width: 22px; height: 16px; border: 2px solid #388E3C; opacity: 0.7; display: inline-block; margin-right: 8px; border-radius: 2px;"></i>
                    <span style="font-size: 12px; font-weight: 600; color: #388E3C;">Áreas Naturales Protegidas</span>
                </div>
            `;
            // ADVC
            legendHtml += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <i style="background: #AB47BC; width: 22px; height: 16px; border: 2px solid #7B1FA2; opacity: 0.7; display: inline-block; margin-right: 8px; border-radius: 2px;"></i>
                    <span style="font-size: 12px; font-weight: 600; color: #7B1FA2;">Áreas Voluntarias (ADVC)</span>
                </div>
            `;
            // Río Usumacinta
            legendHtml += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <div style="width: 22px; height: 0; border-top: 3px solid #0288D1; display: inline-block; margin-right: 8px;"></div>
                    <span style="font-size: 12px; font-weight: 600; color: #0288D1;">Río Usumacinta</span>
                </div>
            `;
            // Separador
            legendHtml += `<div style="border-top: 1px solid #ddd; margin: 10px 0;"></div>`;
            // Presas
            legendHtml += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <img src="https://cdn.sassoapps.com/iconos/represa.png" style="width: 20px; height: 20px; display: inline-block; margin-right: 8px;" alt="Presa">
                    <span style="font-size: 12px; font-weight: 600; color: #601623;">Presas Hidroeléctricas</span>
                </div>
            `;
            // Localidades
            legendHtml += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <i style="background: #FF9800; width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; margin-left: 6px;"></i>
                    <span style="font-size: 12px; font-weight: 600; color: #E65100;">Localidades Indígenas</span>
                </div>
            `;

            window.mobileInterface.addLegendToLayersTab(legendHtml);
            return; // No crear control de Leaflet
        }

        if (pibLegendControl) {
            map.removeControl(pibLegendControl);
        }

        pibLegendControl = L.control({ position: 'topright' });

        pibLegendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend conservation-legend');
            div.innerHTML = '<strong style="display: block; margin-bottom: 10px; font-size: 13px; color: #601623;">CAPAS DE CONSERVACIÓN</strong>';

            // Ramsar
            div.innerHTML += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <i style="background: #8D6E63; width: 22px; height: 16px; border: 2px solid #5D4037; opacity: 0.7; display: inline-block; margin-right: 8px; border-radius: 2px;"></i>
                    <span style="font-size: 12px; font-weight: 600; color: #5D4037;">Sitios Ramsar</span>
                </div>
            `;

            // ANP
            div.innerHTML += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <i style="background: #66BB6A; width: 22px; height: 16px; border: 2px solid #388E3C; opacity: 0.7; display: inline-block; margin-right: 8px; border-radius: 2px;"></i>
                    <span style="font-size: 12px; font-weight: 600; color: #388E3C;">Áreas Naturales Protegidas</span>
                </div>
            `;

            // ADVC
            div.innerHTML += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <i style="background: #AB47BC; width: 22px; height: 16px; border: 2px solid #7B1FA2; opacity: 0.7; display: inline-block; margin-right: 8px; border-radius: 2px;"></i>
                    <span style="font-size: 12px; font-weight: 600; color: #7B1FA2;">Áreas Voluntarias (ADVC)</span>
                </div>
            `;

            // Río Usumacinta
            div.innerHTML += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <div style="width: 22px; height: 0; border-top: 3px solid #0288D1; display: inline-block; margin-right: 8px;"></div>
                    <span style="font-size: 12px; font-weight: 600; color: #0288D1;">Río Usumacinta</span>
                </div>
            `;

            // Separador
            div.innerHTML += `<div style="border-top: 1px solid #ddd; margin: 10px 0;"></div>`;

            // Presas
            div.innerHTML += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <img src="https://cdn.sassoapps.com/iconos/represa.png" style="width: 20px; height: 20px; display: inline-block; margin-right: 8px;" alt="Presa">
                    <span style="font-size: 12px; font-weight: 600; color: #601623;">Presas Hidroeléctricas</span>
                </div>
            `;

            // Localidades Indígenas
            div.innerHTML += `
                <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
                    <i style="background: #FFA726; width: 10px; height: 10px; border: 2px solid #F57C00; border-radius: 50%; display: inline-block; margin-right: 10px;"></i>
                    <span style="font-size: 12px; font-weight: 600; color: #F57C00;">Localidades Indígenas</span>
                </div>
            `;

            return div;
        };

        pibLegendControl.addTo(map);
    }

    async function loadGeoJSON(url, options) {
        const showPreloader = !(options && options.silent);
        const type = options && options.type || 'regions';
        const clearLayers = options && options.clearLayers !== undefined ? options.clearLayers : true;

        console.log('🟢 loadGeoJSON iniciando:', { type, url, clearLayers });

        if (showPreloader) {
            togglePreloader(true);
        }
        try {
            const response = await fetch(url);
            const data = await response.json();

            console.log('🟢 GeoJSON cargado tipo', type, ':', data.features ? data.features.length : 0, 'features');

            let styleFunction;
            let onEachFeatureFunction;

            if (type === 'ramsar') {
                // Estilo para sitios Ramsar (humedales)
                // Crear pane para Ramsar con z-index alto
                if (!map.getPane('ramsarPane')) {
                    map.createPane('ramsarPane');
                    map.getPane('ramsarPane').style.zIndex = 450; // Encima de ANP y ADVC
                }

                styleFunction = function (feature) {
                    return {
                        fillColor: '#8D6E63',
                        fill: true,
                        weight: 2,
                        opacity: 0.8,
                        color: '#5D4037',
                        fillOpacity: 0.4,
                        pane: 'ramsarPane'
                    };
                };
                onEachFeatureFunction = function (feature, layer) {
                    const props = feature.properties || {};
                    const nombre = props.RAMSAR || props.name || props.nombre || props.NOMBRE || 'Sitio Ramsar';
                    const estado = props.ESTADO || props.estado || 'Estado N/D';
                    const municipios = props.MUNICIPIOS || props.municipios || props.MUNICIPIO || 'Municipios N/D';
                    let areaHa = null;
                    try {
                        areaHa = (turf.area(feature) / 10000).toFixed(1);
                    } catch (e) {
                        areaHa = null;
                    }

                    const popupHtml = `
                        <div style="font-family: 'Montserrat', sans-serif; max-width: 260px; line-height: 1.4;">
                            <div style="font-size: 14px; font-weight: 700; color: #5D4037;">
                                <i class="bi bi-water" style="color:#8D6E63;"></i> ${nombre}
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 4px;">
                                ${estado} • ${municipios}
                            </div>
                            ${areaHa ? `
                                <div style="margin-top: 8px; font-size: 12px;">
                                    <strong>Área:</strong> ${Number(areaHa).toLocaleString('es-MX')} ha
                                </div>
                            ` : ''}
                            <div style="margin-top: 8px; font-size: 11px; color: #555;">
                                Sitio Ramsar registrado como humedal de importancia internacional.
                            </div>
                        </div>
                    `;
                    layer.bindPopup(popupHtml, {
                        className: 'ramsar-popup-simple',
                        maxWidth: 280
                    });
                };
            } else if (type === 'anp') {
                // Estilo para Áreas Naturales Protegidas
                // Crear pane para ANP con z-index bajo
                if (!map.getPane('anpPane')) {
                    map.createPane('anpPane');
                    map.getPane('anpPane').style.zIndex = 410; // Debajo de Ramsar
                }

                styleFunction = function (feature) {
                    return {
                        fillColor: '#66BB6A',
                        fill: true,
                        weight: 2,
                        opacity: 0.8,
                        color: '#388E3C',
                        fillOpacity: 0.3,
                        pane: 'anpPane'
                    };
                };
                onEachFeatureFunction = function (feature, layer) {
                    const props = feature.properties || {};
                    const nombre = props.NOMBRE || props.name || props.nombre || 'Área Natural Protegida';
                    const tipo = props.TIPO || props.tipo || 'Tipo N/D';
                    const categoria = props.CAT_DEC || props.categoria || 'Categoría N/D';
                    const entidad = props.ENTIDAD || props.entidad || props.estado || 'Entidad N/D';
                    const municipio = props.MUN_DEC || props.municipio || 'Municipio N/D';
                    let areaHa = null;
                    try {
                        areaHa = (turf.area(feature) / 10000).toFixed(1);
                    } catch (e) {
                        areaHa = null;
                    }

                    const popupHtml = `
                        <div style="font-family: var(--font-family-body); max-width: 280px; line-height: 1.4;">
                            <div style="font-size: 14px; font-weight: 700; color: var(--color-gobmx-verde);">
                                <i class="bi bi-tree-fill" style="color:#66BB6A;"></i> ${nombre}
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 4px;">
                                <i class="bi bi-shield-fill-check"></i> ${categoria} • ${tipo}
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                <i class="bi bi-geo-alt-fill"></i> ${entidad} • ${municipio}
                            </div>
                            ${areaHa ? `
                                <div style="margin-top: 8px; font-size: 12px;">
                                    <strong>Área:</strong> ${Number(areaHa).toLocaleString('es-MX')} ha
                                </div>
                            ` : ''}
                            <div style="margin-top: 8px; font-size: 11px; color: #555; padding: 6px; background: #E8F5E9; border-radius: 4px;">
                                <i class="bi bi-info-circle"></i> Área Natural Protegida bajo protección ${tipo.toLowerCase()}.
                            </div>
                        </div>
                    `;
                    layer.bindPopup(popupHtml, {
                        className: 'anp-popup-simple',
                        maxWidth: 300
                    });
                };
            } else if (type === 'advc') {
                // Estilo para Áreas Destinadas Voluntariamente a la Conservación
                // Crear pane para ADVC con z-index medio
                if (!map.getPane('advcPane')) {
                    map.createPane('advcPane');
                    map.getPane('advcPane').style.zIndex = 420; // Entre ANP y Ramsar
                }

                styleFunction = function (feature) {
                    return {
                        fillColor: '#AB47BC',
                        fill: true,
                        weight: 2,
                        opacity: 0.8,
                        color: '#7B1FA2',
                        fillOpacity: 0.3,
                        pane: 'advcPane'
                    };
                };
                onEachFeatureFunction = function (feature, layer) {
                    const props = feature.properties || {};
                    const nombre = props.ADVC || props.NOMBRE || props.name || props.nombre || 'ADVC';
                    const entidad = props.ESTADO || props.ENTIDAD || props.entidad || props.estado || 'Entidad N/D';
                    const municipio = props.MUNICIPIO || props.municipio || props.MUN_DEC || 'Municipio N/D';
                    let areaHa = null;
                    try {
                        areaHa = (turf.area(feature) / 10000).toFixed(1);
                    } catch (e) {
                        areaHa = null;
                    }

                    const popupHtml = `
                        <div style="font-family: var(--font-family-body); max-width: 280px; line-height: 1.4;">
                            <div style="font-size: 14px; font-weight: 700; color: #7B1FA2;">
                                <i class="bi bi-heart-fill" style="color:#AB47BC;"></i> ${nombre}
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 4px;">
                                <i class="bi bi-award-fill"></i> Área Destinada Voluntariamente a la Conservación
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                <i class="bi bi-geo-alt-fill"></i> ${entidad} • ${municipio}
                            </div>
                            ${areaHa ? `
                                <div style="margin-top: 8px; font-size: 12px;">
                                    <strong>Área:</strong> ${Number(areaHa).toLocaleString('es-MX')} ha
                                </div>
                            ` : ''}
                            <div style="margin-top: 8px; font-size: 11px; color: #555; padding: 6px; background: #F3E5F5; border-radius: 4px;">
                                <i class="bi bi-info-circle"></i> Área bajo conservación voluntaria por iniciativa privada o comunitaria.
                            </div>
                        </div>
                    `;
                    layer.bindPopup(popupHtml, {
                        className: 'advc-popup-simple',
                        maxWidth: 300
                    });
                };
            } else if (type === 'usumacinta') {
                // Estilo para río Usumacinta
                // Crear pane para río con z-index más alto (encima de todo)
                if (!map.getPane('rioPane')) {
                    map.createPane('rioPane');
                    map.getPane('rioPane').style.zIndex = 460; // Encima de todo
                }

                styleFunction = function (feature) {
                    return {
                        color: '#0288D1',
                        weight: 3,
                        opacity: 0.7,
                        pane: 'rioPane'
                    };
                };
                onEachFeatureFunction = function (feature, layer) {
                    const props = feature.properties || {};
                    const nombre = props.name || props.nombre || props.NOMBRE || 'Río Usumacinta';
                    layer.bindPopup(`<strong>Río:</strong> ${nombre}`);
                };
            } else if (type === 'states') {
                styleFunction = function (feature) {
                    return {
                        fillColor: '#E0E0E0',
                        fill: true,
                        weight: 1,
                        opacity: 1,
                        color: 'white',
                        fillOpacity: 0.7,
                        pane: 'statesPane'
                    };
                }
            } else if (type === 'interactive-regions') {
                const regionColors = {
                    "Baja California": "#939594",
                    "Central": "#6A1C32",
                    "Noreste": "#235B4E",
                    "Noroeste": "#DDC9A4",
                    "Norte": "#10302B",
                    "Occidental": "#BC955C",
                    "Oriental": "#9F2240",
                    "Peninsular": "#A16F4A"
                };

                styleFunction = function (feature) {
                    const color = regionColors[feature.properties.name] || '#808080';
                    return {
                        fillColor: color,
                        fill: true,
                        weight: 0,
                        opacity: 1,
                        color: 'transparent',
                        dashArray: '3',
                        fillOpacity: 0.7,
                        pane: 'gerenciasPane' // Use the same pane for shadow
                    };
                }

                // Descripciones de las Gerencias de Control Regional
                const gcrDescriptions = {
                    "Central": {
                        title: "GCR Central",
                        description: "La GCR Central ocupa aproximadamente el 3.8% del territorio nacional. En 2024, concentró el 24.8% de la población (32.8 millones de personas) y atendió al 21.2% de las personas usuarias finales de energía eléctrica. Su consumo per cápita de energía se estima en 1,777 kWh/habitante. Sus principales Centros de Carga se encuentran en la industria de la construcción (cementeras), industria del acero, el Sistema de Transporte Colectivo-Metro, armadoras automotrices, refinería de Miguel Hidalgo (Tula) y las plantas de bombeo Cutzamala.<br><br>La GCR Central se divide en tres regiones: Valle de México Norte, Valle de México Centro y Valle de México Sur, las cuales representaron el 39.4%, 18.9% y 41.6%, respectivamente de la demanda máxima de esta GCR, para 2024. Al interior de la región Valle de México Norte destaca la zona Cuautitlán como la que concentra la mayor proporción de la demanda máxima (17.1%), seguido de Tula (12.5%) y Azteca (11.9%). Las zonas con mayor crecimiento entre 2023 y 2024 fueron Pachuca y Tula con un alza de 8.0% y 5.4%, respectivamente.<br><br>En la región Valle de México Centro, la zona Polanco y Chapingo abarcaron en conjunto el 42.2% de la demanda máxima. El mayor crecimiento durante 2024 lo registró la zona Polanco con una tasa anual de 8.0%. En lo que respecta a la región Valle de México Sur, la zona Lázaro Cárdenas destaca porque, además de concentrar el 20.1% de la demanda máxima también tuvo la tasa de crecimiento anual más elevada de la región durante 2024 con 4.3%.<br><br>En la GCR Central hay 212 localidades que no están electrificadas, repartidas en los estados de Guerrero, Hidalgo, México, Michoacán y Puebla."
                    },
                    "Baja California": {
                        title: "GCR de Baja California",
                        description: "La GCR de Baja California, opera el SIBC, el SIBCS, y el SIMUL. El SIBC ocupa el 3.6% del territorio nacional aproximadamente. En 2024, la población representó cerca de 3.1%, esto es, 4.1 millones de personas. Este Sistema atendió al 3.5% de las personas usuarias finales, con un consumo per cápita de energía eléctrica de 4,139 kWh por habitante. Los principales Centros de Carga pertenecen a las industrias siderúrgica, vidriera, plantas de bombeo de agua, aeroespacial, fabricación de rines de aluminio, automotriz, cementera y minera, y están localizadas en las zonas Mexicali, Tijuana y Ensenada.<br><br>En el SIBC, la zona Mexicali representa casi la mitad de la demanda máxima (48.8%), seguido por Tijuana-Tecate con 32.0%. Las zonas que registraron la tasa de crecimiento anual más alta durante 2024 también fueron Tijuana-Tecate y Mexicali con 3.7% y 3.1%, respectivamente.<br><br>Los SIBCS y SIMUL en conjunto abarcan aproximadamente el 3.8% del territorio nacional. En 2024, su población representó cerca del 0.7%, lo cual equivale a 0.9 millones de personas. El Sistema atendió al 0.8% de las personas usuarias finales, con un consumo per cápita de energía eléctrica de 3,941 kWh por habitante.<br><br>El SIBCS representa el 95.3% de la demanda máxima mientras que el SIMUL el 4.7% restante. El primero registró una tasa de crecimiento anual durante 2024 de 3.2% mientras que, el segundo, de 1.4%. Las zonas de mayor crecimiento fueron Los Cabos con 4.2% y Santa Rosalía con 2.4%.<br><br>En la GCR de Baja California hay 1,056 localidades que no están electrificadas que están distribuidas en los estados Baja California, Baja California Sur y Sonora."
                    },
                    "Noreste": {
                        title: "GCR Noreste",
                        description: "La GCR Noreste ocupa el 14.8% del territorio nacional, aproximadamente. En 2024, sus habitantes ascendieron cerca de 13.6 millones de personas, es decir, el 10.3% de la población del país. En 2024, la GCR NES atendió al 10.7% de las personas usuarias finales del servicio de energía eléctrica con un consumo de energía eléctrica per cápita de 4,640 kWh por habitante, siendo la GCR con el mayor consumo. Los principales Centros de Carga se concentran en las industrias siderúrgica, minera y de refinación de petróleo localizadas en las zonas Monterrey, Monclova, Concepción del Oro y Tampico.<br><br>La zona Monterrey representa casi la mitad de la demanda máxima en la GCR Noreste con 47.4%, le siguen Saltillo con 9.7%, Reynosa y Tampico con 8% cada una. Las zonas que registraron la tasa de crecimiento anual más alta durante 2024 fueron Cerralvo con un incremento cercano al 13%, Nueva Rosita con 9.6% y Río Verde con 5.6%.<br><br>En la GCR Noreste hay 767 localidades que no están electrificadas que están distribuidas en los estados Coahuila, Hidalgo, Nuevo León, San Luis Potosí, Tamaulipas y Veracruz."
                    },
                    "Noroeste": {
                        title: "GCR Noroeste",
                        description: "La GCR Noroeste ocupa alrededor de 12.1% del territorio nacional. En 2024, sus habitantes ascendieron a 6.3 millones de personas aproximadamente, lo que representa cerca del 4.7% de la población del país. En ese año, la GCR Noroeste atendió al 4.7% de las personas usuarias finales, con un consumo per cápita de 4,487 kWh por habitante. Los principales centros de carga se presentan en las industrias minera, cementera y automotriz, localizadas en las zonas Cananea, Hermosillo y Caborca.<br><br>La zona Hermosillo es la que representa el porcentaje más alto de participación en la demanda de esta GCR con 21.3%, seguida de Culiacán y Cananea Nacozari con 16.5% y 9.5%, respectivamente. Durante 2024, la zona con mayor crecimiento fue Agrícola Hermosillo con 3.5%.<br><br>En la GCR Noroeste hay 617 localidades que no están electrificadas que están distribuidas en los estados de Sinaloa y Sonora."
                    },
                    "Norte": {
                        title: "GCR Norte",
                        description: "La GCR Norte ocupa alrededor del 21.2% del territorio nacional. En 2024, sus habitantes ascendieron cerca de 6.9 millones de personas, lo que representa el 5.2% de la población del país. En ese año, la GCR Norte atendió al 5% de las personas usuarias finales del servicio de energía eléctrica con un consumo per cápita de 4,604 kWh por habitante.<br><br>Los principales Centros de Carga se agrupan en las industrias minera y metalúrgica, industria cementera, madera y papel, manufactura y agrícola. La zona Torreón es la que representa el porcentaje más alto de participación en la demanda en la GCR NTE con 24%, seguida de Ciudad Juárez con 21.9%. Las zonas que registraron el crecimiento anual más alto fueron: Casas Grandes y Durango con 5.8% y 4.9%, respectivamente.<br><br>En la GCR Norte hay 2,357 localidades que no están electrificadas que están distribuidas en los estados Chihuahua, Coahuila, Durango y Zacatecas."
                    },
                    "Occidental": {
                        title: "GCR Occidental",
                        description: "La GCR Occidental ocupa aproximadamente el 15% del territorio nacional y, durante 2024, se estima que albergó al 21.3% de la población (28.2 millones de personas). En ese mismo año, la GCR Occidental atendió al 24.2% de las personas usuarias finales mientras que, su consumo per cápita de energía eléctrica resultó de 2,709 kWh/habitante. Los principales Centros de Carga se presentan en las industrias siderúrgica, minera, cementera, automotriz e industrias conexas, las cuales se localizan principalmente en los estados de Jalisco, Guanajuato, Querétaro, Aguascalientes, Zacatecas y San Luis Potosí.<br><br>Al igual que la GCR Central, la GCR Occidental también se divide en tres regiones. La región Jalisco representó el 28.6% de la demanda máxima integrada mientras que, las regiones Bajío y Centro Occidente, el 59.9% y 11.5%, respectivamente.<br><br>En la Región Jalisco, la zona Metropolitana Hidalgo concentró el 17.3% de la demanda máxima, mientras que la zona que registró el mayor crecimiento fue Los Altos con una tasa anual de 7.2%. En el Bajío, la zona San Luis Potosí tiene la mayor concentración de demanda con 15.6% de la demanda, en tanto que la zona de mayor crecimiento fue Salamanca con 6.4%. En la región Centro Occidente, la zona Colima participa con el 30.3% de la demanda máxima. Por otro lado, la zona Apatzingán registró la tasa de crecimiento anual más alta con 3.0% durante 2024.<br><br>En la GCR Occidental hay 3,010 localidades que no están electrificadas que están distribuidas en los estados de Aguascalientes, Colima, Guanajuato, Hidalgo, Jalisco, Michoacán, Nayarit, Querétaro, San Luis Potosí y Zacatecas."
                    },
                    "Oriental": {
                        title: "GCR Oriental",
                        description: "La GCR Oriental ocupa el 18.5% del territorio nacional aproximadamente, concentrando en 2024 el 25.7% de la población (34.1 millones de personas) y atendió al 25.3% de las personas usuarias finales con un consumo per cápita de 1,680 kWh/habitante. Los principales Centros de Carga se encuentran en las industrias siderúrgica, petroquímica y del plástico, cementera y automotriz, además de la minería. Estas empresas están localizadas principalmente en los estados de Veracruz, Puebla, Tlaxcala y Guerrero.<br><br>Para el análisis de la demanda máxima, la GCR Oriental se divide en cuatro regiones. Durante 2024, la región Oriente representó el 35.8%, la Sureste el 29.9%, la Centro Oriente el 21.6% y la Centrosur el 12.7%. Al interior de éstas, en la región Oriente, la zona Coatzacoalcos presentó la mayor concentración de demanda con 28.8% y un crecimiento anual de 6.3%, solo después de la zona Tuxtlas con 6.4 %. En las regiones Sureste, Centro Oriente y Centro Sur, las zonas más representativas en cuanto a demanda son: Villahermosa (25.4%), Puebla (42.6%) y Acapulco (29.1%). En cuanto al crecimiento anual registrado durante 2024, destacan las zonas Oaxaca con 8.2% de la región Sureste, la zona San Martín con 5.7 % en la región Centro Oriente y la zona Chilpancingo con 12%, ésta última pertenece a la región Centro Sur.<br><br>En la GCR Oriental hay 4,160 localidades que no están electrificadas que están distribuidas en los estados de Chiapas, Guerrero, Morelos, Oaxaca, Puebla, Tabasco, Tlaxcala y Veracruz."
                    },
                    "Peninsular": {
                        title: "GCR Peninsular",
                        description: "La GCR Peninsular ocupa el 7.2% del territorio nacional aproximadamente. Se estima que, en 2024, la población de esta GCR ascendió a 5.5 millones de personas, es decir, el 4.2% del total de los habitantes. Esta GCR atendió al 4.6% de las personas usuarias finales mientras que, su consumo de energía eléctrica per cápita resultó de 3,038 kWh por habitante. Los principales Centros de Carga provienen de la industria del turismo además de una cementera, una procesadora de aceites y semillas, así como una embotelladora de cervezas.<br><br>La zona Mérida representa el 30.3% de la demanda máxima en la GCR Peninsular, seguida por Cancún en menor porcentaje con un 25.1% y Riviera Maya con 15.8%. Las zonas que registraron la tasa de crecimiento anual más alta durante 2024 fueron Ticul con 24.6%, Campeche con 9.6% y Motul con 8.6%.<br><br>En la GCR Peninsular hay 1,001 localidades que no están electrificadas que están distribuidas en los estados Campeche, Quintana Roo y Yucatán."
                    }
                };

                const gcrTitles = {
                    "Central": "Figura 2.15. Municipios con localidades sin electrificar en la GCR Central",
                    "Oriental": "Figura 2.16. Municipios con localidades sin electrificar en la GCR Oriental",
                    "Occidental": "Figura 2.17. Municipios con localidades sin electrificar en la GCR Occidental",
                    "Noroeste": "Figura 2.18. Municipios con localidades sin electrificar en la GCR Noroeste",
                    "Norte": "Figura 2.19. Municipios con localidades sin electrificar en la GCR Norte",
                    "Noreste": "Figura 2.20. Municipios con localidades sin electrificar en la GCR Noreste",
                    "Peninsular": "Figura 2.21. Municipios con localidades sin electrificar en la GCR Peninsular",
                    "Baja California": "Figura 2.22. Municipios con localidades sin electrificar en la GCR de Baja California"
                };

                function resetAllRegionsToInitialState() {
                    focusedRegion = null;
                    geoJsonLayer.eachLayer(l => {
                        geoJsonLayer.resetStyle(l);
                    });
                    municipalitiesLayerGroup.clearLayers();

                    // Remove municipalities legend and restore gerencias legend
                    removeMunicipalitiesLegend();
                    if (legendControl) {
                        map.removeControl(legendControl);
                    }
                    addLegend(regionColors);

                    if (selectedRegionBanner) {
                        selectedRegionBanner.style.display = 'none';
                    }

                    if (mapDescriptionEl) {
                        mapDescriptionEl.style.display = 'none';
                    }

                    // Reset map title
                    updateMapTitleDisplay('Figuras 2.15 a 2.22. Municipios con localidades sin electrificar');
                }

                onEachFeatureFunction = function (feature, layer) {
                    layer.on({
                        mouseover: function (e) {
                            if (focusedRegion === null) {
                                e.target.setStyle({ weight: 5, color: '#000' });
                                e.target.bringToFront();
                            }
                        },
                        mouseout: function (e) {
                            if (focusedRegion === null) {
                                geoJsonLayer.resetStyle(e.target);
                            }
                        },
                        click: function (e) {
                            L.DomEvent.stopPropagation(e);
                            const clickedRegionName = feature.properties.name;

                            // Si se hace clic en la misma región seleccionada, restablecer todo
                            if (focusedRegion === clickedRegionName) {
                                resetAllRegionsToInitialState();
                                return;
                            }

                            focusedRegion = clickedRegionName;

                            if (legendControl) {
                                map.removeControl(legendControl);
                            }

                            if (selectedRegionBanner && selectedRegionText) {
                                selectedRegionText.textContent = 'Gerencia de Control Regional: ' + clickedRegionName;
                                selectedRegionBanner.style.display = 'block';
                            }

                            // Update map title
                            if (gcrTitles[clickedRegionName]) {
                                updateMapTitleDisplay(gcrTitles[clickedRegionName]);
                            }

                            // Update description
                            if (mapDescriptionEl) {
                                const titleEl = document.getElementById('map-description-title');
                                const contentEl = document.getElementById('map-description-content');
                                const gcrInfo = gcrDescriptions[clickedRegionName];

                                if (gcrInfo && titleEl && contentEl) {
                                    titleEl.innerHTML = gcrInfo.title;
                                    contentEl.innerHTML = gcrInfo.description;
                                    mapDescriptionEl.style.display = 'block';
                                } else {
                                    mapDescriptionEl.style.display = 'none';
                                }
                            }

                            // Restyle all regions
                            geoJsonLayer.eachLayer(l => {
                                const regionColor = regionColors[l.feature.properties.name] || '#808080';
                                if (l.feature.properties.name === clickedRegionName) {
                                    l.setStyle({
                                        fillColor: regionColor,
                                        weight: 2,
                                        color: '#999',
                                        fillOpacity: 0,
                                        dashArray: '5, 5',
                                        className: 'gerencia-focused'
                                    });
                                    l.bringToFront();
                                } else {
                                    l.setStyle({
                                        fillColor: regionColor,
                                        weight: 1,
                                        color: '#ddd',
                                        fillOpacity: 0.1,
                                        dashArray: '3',
                                        className: ''
                                    });
                                }
                            });

                            // Filter and display municipalities
                            municipalitiesLayerGroup.clearLayers();
                            if (!municipalitiesData || !electrificationData) {
                                console.warn('Municipality or electrification data not loaded yet.');
                                return;
                            }

                            const electrificationDataMap = new Map(electrificationData.map(row => [row.CVEGEO, row]));

                            const filteredFeatures = municipalitiesData.features.filter(f => {
                                const municipalityData = electrificationDataMap.get(f.properties.CVEGEO);
                                return municipalityData && municipalityData.GCR === clickedRegionName;
                            });

                            // Log de diagnóstico
                            const municipiosEnSheet = electrificationData.filter(row => row.GCR === clickedRegionName);
                            console.log('=== DIAGNÓSTICO GERENCIA: ' + clickedRegionName + ' ===');
                            console.log('Municipios en Google Sheets para esta GCR:', municipiosEnSheet.length);
                            console.log('Municipios encontrados en GeoJSON:', filteredFeatures.length);
                            console.log('CVEGEOs en Google Sheets:', municipiosEnSheet.map(m => m.CVEGEO));
                            console.log('CVEGEOs encontrados en GeoJSON:', filteredFeatures.map(f => f.properties.CVEGEO));
                            console.log('===========================================');

                            function getColor(pendientes) {
                                const p = parseInt(pendientes, 10);
                                if (isNaN(p)) return '#ccc';
                                if (p === 0) return '#F2D7D9';
                                if (p <= 20) return '#E0B0B6';
                                if (p <= 40) return '#CC8893';
                                if (p <= 60) return '#B86070';
                                if (p <= 80) return '#A3384D';
                                return '#601623';
                            }

                            const municipalitiesLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
                                style: function (feature) {
                                    const municipalityData = electrificationDataMap.get(feature.properties.CVEGEO);

                                    if (!municipalityData || municipalityData.PENDIENTE === undefined || municipalityData.PENDIENTE === null) {
                                        return {
                                            fillOpacity: 0,
                                            opacity: 0,
                                            interactive: false
                                        };
                                    }

                                    const pendientes = municipalityData.PENDIENTE;
                                    return {
                                        fillColor: getColor(pendientes),
                                        weight: 1,
                                        opacity: 1,
                                        color: 'white',
                                        fillOpacity: 0.8
                                    };
                                },
                                onEachFeature: function (feature, layer) {
                                    const municipalityData = electrificationDataMap.get(feature.properties.CVEGEO);
                                    const pendientes = municipalityData ? municipalityData.PENDIENTE : 'N/A';
                                    const gcr = municipalityData ? municipalityData.GCR : 'N/A';
                                    const cvegeo = feature.properties.CVEGEO || 'N/A';
                                    const nomgeo = feature.properties.NOMGEO || 'Sin nombre';

                                    const popupContent = `
                                        <div style="font-family: 'Montserrat', sans-serif;">
                                            <strong style="font-size: 14px; color: #601623;">${nomgeo}</strong><br>
                                            <strong>CVEGEO:</strong> ${cvegeo}<br>
                                            <strong>GCR:</strong> ${gcr}<br>
                                            <strong>Localidades pendientes:</strong> ${pendientes}
                                        </div>
                                    `;

                                    // Usar tooltip en lugar de popup
                                    layer.bindTooltip(popupContent, {
                                        permanent: false,
                                        direction: 'top',
                                        className: 'municipality-tooltip'
                                    });

                                    layer.on('mouseover', function (e) {
                                        console.log('Municipio hover:', {
                                            CVEGEO: cvegeo,
                                            NOMGEO: nomgeo,
                                            GCR: gcr,
                                            PENDIENTE: pendientes
                                        });
                                    });
                                }
                            });

                            municipalitiesLayerGroup.addLayer(municipalitiesLayer);
                            if (typeof municipalitiesLayer.bringToFront === 'function') {
                                municipalitiesLayer.bringToFront();
                            }
                            addMunicipalitiesLegend();

                            if (filteredFeatures.length > 0) {
                                const municipalitiesBounds = municipalitiesLayer.getBounds();
                                map.fitBounds(municipalitiesBounds.pad(0.1));
                            }
                        }
                    });
                }

                // Evento para hacer clic fuera de las gerencias y restablecer todo
                map.on('click', function (e) {
                    // Si estamos saliendo de un drag de leyenda, ignorar este click
                    if (window.isLegendDragging || window.ignoreNextMapClick) {
                        return;
                    }
                    if (focusedRegion !== null) {
                        resetAllRegionsToInitialState();
                    }
                });

                addLegend(regionColors);
            } else if (type === 'pib-forecast') {
                const regionColors = {
                    "Baja California": "#939594",
                    "Central": "#6A1C32",
                    "Noreste": "#235B4E",
                    "Noroeste": "#DDC9A4",
                    "Norte": "#10302B",
                    "Occidental": "#BC955C",
                    "Oriental": "#9F2240",
                    "Peninsular": "#A16F4A"
                };

                styleFunction = function (feature) {
                    const color = regionColors[feature.properties.name] || '#808080';
                    return {
                        fillColor: color,
                        fill: true,
                        weight: 2,
                        opacity: 1,
                        color: '#555',
                        dashArray: '3',
                        fillOpacity: 0.7,
                        pane: 'gerenciasPane'
                    };
                }

                onEachFeatureFunction = function (feature, layer) {
                    layer.on({
                        mouseover: function (e) {
                            const targetLayer = e.target;
                            const originalColor = regionColors[feature.properties.name] || '#808080';
                            const darkerColor = darkenColor(originalColor, 20);

                            targetLayer.setStyle({
                                weight: 5,
                                color: darkerColor,
                                dashArray: '',
                                fillOpacity: 0.9
                            });
                            targetLayer.bringToFront();
                        },
                        mouseout: function (e) {
                            geoJsonLayer.resetStyle(e.target);
                        }
                    });
                }
                // Add gerencias legend and PIB legend
                addLegend(regionColors);
                addPIBLegend(pibSenData, pibSinData);
            } else if (type === 'consumption-forecast') {
                const regionColors = {
                    "Baja California": "#939594",
                    "Central": "#6A1C32",
                    "Noreste": "#235B4E",
                    "Noroeste": "#DDC9A4",
                    "Norte": "#10302B",
                    "Occidental": "#BC955C",
                    "Oriental": "#9F2240",
                    "Peninsular": "#A16F4A"
                };

                styleFunction = function (feature) {
                    const color = regionColors[feature.properties.name] || '#808080';
                    return {
                        fillColor: color,
                        fill: true,
                        weight: 2,
                        opacity: 1,
                        color: '#555',
                        dashArray: '3',
                        fillOpacity: 0.7,
                        pane: 'gerenciasPane'
                    };
                }

                onEachFeatureFunction = function (feature, layer) {
                    layer.on({
                        mouseover: function (e) {
                            const targetLayer = e.target;
                            const originalColor = regionColors[feature.properties.name] || '#808080';
                            const darkerColor = darkenColor(originalColor, 20);

                            targetLayer.setStyle({
                                weight: 5,
                                color: darkerColor,
                                dashArray: '',
                                fillOpacity: 0.9
                            });
                            targetLayer.bringToFront();
                        },
                        mouseout: function (e) {
                            geoJsonLayer.resetStyle(e.target);
                        }
                    });
                }
                // Add gerencias legend and consumption legend
                addLegend(regionColors);
                addConsumptionLegend(pibSenData, pibSinData);
            } else if (type === 'capacity-additions') {
                const regionColors = {
                    "Baja California": "#939594",
                    "Central": "#6A1C32",
                    "Noreste": "#235B4E",
                    "Noroeste": "#DDC9A4",
                    "Norte": "#10302B",
                    "Occidental": "#BC955C",
                    "Oriental": "#9F2240",
                    "Peninsular": "#A16F4A"
                };

                styleFunction = function (feature) {
                    const color = regionColors[feature.properties.name] || '#808080';
                    return {
                        fillColor: color,
                        fill: true,
                        weight: 2,
                        opacity: 1,
                        color: '#555',
                        dashArray: '3',
                        fillOpacity: 0.7,
                        pane: 'gerenciasPane'
                    };
                }

                onEachFeatureFunction = function (feature, layer) {
                    layer.on({
                        mouseover: function (e) {
                            const targetLayer = e.target;
                            const originalColor = regionColors[feature.properties.name] || '#808080';
                            const darkerColor = darkenColor(originalColor, 20);

                            targetLayer.setStyle({
                                weight: 5,
                                color: darkerColor,
                                dashArray: '',
                                fillOpacity: 0.9
                            });
                            targetLayer.bringToFront();
                        },
                        mouseout: function (e) {
                            geoJsonLayer.resetStyle(e.target);
                        }
                    });
                }
                // Add gerencias legend and capacity legend
                addLegend(regionColors);
                addCapacityLegend(capacityTotals);
            } else if (type === 'provincias-petroleras') {
                // Usar el módulo de Provincias Petroleras si está disponible
                if (window.ProvinciasPetroleras) {
                    styleFunction = window.ProvinciasPetroleras.styleProvincias;
                    onEachFeatureFunction = window.ProvinciasPetroleras.onEachProvinciaFeature;

                    // La leyenda se creará después de cargar el GeoJSON con los IDs correctos
                } else {
                    console.warn('Módulo de Provincias Petroleras no cargado');
                    // Fallback a estilo básico
                    styleFunction = function (feature) {
                        return {
                            fillColor: '#95A5A6',
                            fill: true,
                            weight: 2,
                            opacity: 1,
                            color: '#2C3E50',
                            fillOpacity: 0.7
                        };
                    };
                }
            } else { // regions
                const regionColors = {
                    "Baja California": "#939594",
                    "Central": "#6A1C32",
                    "Noreste": "#235B4E",
                    "Noroeste": "#DDC9A4",
                    "Norte": "#10302B",
                    "Occidental": "#BC955C",
                    "Oriental": "#9F2240",
                    "Peninsular": "#A16F4A"
                };

                styleFunction = function (feature) {
                    const color = regionColors[feature.properties.name] || '#808080'; // Default color
                    return {
                        fillColor: color,
                        fill: true,
                        weight: 0, // No default border
                        opacity: 1,
                        color: 'transparent', // Transparent border by default
                        dashArray: '3',
                        fillOpacity: 0.7, // Set fillOpacity to 0.7 as requested
                        pane: 'gerenciasPane',
                        className: 'region-polygon' // Clase para estilos personalizados
                    };
                }

                onEachFeatureFunction = function (feature, layer) {
                    layer.on({
                        mouseover: function (e) {
                            const targetLayer = e.target;
                            const originalColor = regionColors[feature.properties.name] || '#808080';
                            const darkerColor = darkenColor(originalColor, 20); // Darken by 20%

                            targetLayer.setStyle({
                                weight: 5,
                                color: darkerColor,
                                dashArray: '',
                                fillOpacity: 0.9
                            });
                            targetLayer.bringToFront();
                        },
                        mouseout: function (e) {
                            geoJsonLayer.resetStyle(e.target);
                        }
                    });
                }
                addLegend(regionColors);
            }

            geoJsonLayer = L.geoJSON(data, { // Assign to global geoJsonLayer
                style: styleFunction,
                onEachFeature: onEachFeatureFunction
            });

            if (clearLayers) {
                console.log('🟢 Limpiando capas anteriores...');
                instrumentLayerGroup.clearLayers(); // Clear before adding new layers
            } else {
                console.log('🟢 NO limpiando capas anteriores (clearLayers=false)');
            }
            instrumentLayerGroup.addLayer(geoJsonLayer);
            console.log('🟢 Capa agregada. Total capas en instrumentLayerGroup:', instrumentLayerGroup.getLayers().length);

            // Auto-select default region if specified
            if (options.mapConfig && options.mapConfig.defaultRegion) {
                // Wait for layer to be added and data to be ready
                setTimeout(() => {
                    const targetRegion = options.mapConfig.defaultRegion;
                    console.log('Auto-selecting region:', targetRegion);

                    let targetLayer = null;
                    geoJsonLayer.eachLayer(l => {
                        if (l.feature && l.feature.properties && l.feature.properties.name === targetRegion) {
                            targetLayer = l;
                        }
                    });

                    if (targetLayer) {
                        targetLayer.fireEvent('click');
                    } else {
                        console.warn('Target region not found:', targetRegion);
                    }
                }, 1000); // Increased timeout to ensure data is ready
            }

            // Etiquetas de gerencias - la información está en la leyenda
            if (type === 'regions') {
                geoJsonLayer.eachLayer(layer => {
                    const regionName = layer.feature.properties.name;
                    const center = layer.getBounds().getCenter();

                    // Consistent position overrides
                    if (regionName === 'Noroeste') {
                        center.lat += 2.0;
                    } else if (regionName === 'Baja California') {
                        center.lat = 32.3;
                        center.lng = -115.5;
                    }

                    const label = L.marker(center, {
                        icon: L.divIcon({
                            className: 'region-label',
                            html: `<span>${regionName}</span>`,
                            iconSize: [200, 30]
                        }),
                        pane: 'nodesPane' // Ensure it's on top
                    }).addTo(instrumentLayerGroup); // Use instrumentLayerGroup so it persists until clearData
                });

                // Add toggle control for these labels
                createLabelToggleControl();
            }


            // Agregar etiquetas y actualizar leyenda si es mapa de provincias petroleras
            if (type === 'provincias-petroleras' && window.ProvinciasPetroleras) {
                // Agregar etiquetas
                window.ProvinciasPetroleras.addProvinciaLabels(geoJsonLayer, map);

                // Actualizar leyenda con IDs del GeoJSON
                if (provinciaLegendControl) {
                    map.removeControl(provinciaLegendControl);
                }
                provinciaLegendControl = window.ProvinciasPetroleras.createProvinciaLegend(geoJsonLayer);
                provinciaLegendControl.addTo(map);
            }

            if (insetControllers.length) {
                insetControllers.forEach(controller => {
                    controller.polygonsLayer.clearLayers();

                    const insetStyleFunction = function (feature) {
                        const style = styleFunction(feature);
                        delete style.pane;
                        return style;
                    };

                    const insetLayer = L.geoJSON(data, {
                        style: insetStyleFunction
                    });
                    controller.polygonsLayer.addLayer(insetLayer);
                    if (typeof controller.polygonsLayer.bringToBack === 'function') {
                        controller.polygonsLayer.bringToBack();
                    }
                });
            }

        } catch (error) {
            console.error('Error cargando GeoJSON:', error);
            // Optionally, show a notification to the user
        } finally {
            if (showPreloader) {
                togglePreloader(false);
            }
        }
    }

    async function loadConnectionsGeoJSON(url, options) {
        const showPreloader = options && options.showPreloader;
        const clear = options && options.clear !== undefined ? options.clear : true;

        if (showPreloader) {
            togglePreloader(true);
        }
        try {
            if (clear) {
                connectionsLayerGroup.clearLayers();
            }
            const response = await fetch(url);
            const data = await response.json();
            const baseStyle = {
                color: '#7a1c32',
                weight: 3,
                opacity: 0.92
            };
            const connectionsLayer = L.geoJSON(data, {
                style: function (feature) {
                    const props = feature && feature.properties ? feature.properties : {};
                    const color = props.color || baseStyle.color;
                    const weight = Number(props.weight) || baseStyle.weight;
                    const opacity = typeof props.opacity === 'number' ? props.opacity : baseStyle.opacity;
                    return {
                        color: color,
                        weight: weight,
                        opacity: opacity,
                        pane: 'connectionsPane',
                        className: 'connections-line'
                    };
                }
            });
            connectionsLayerGroup.addLayer(connectionsLayer);
            if (typeof connectionsLayerGroup.bringToFront === 'function') {
                connectionsLayerGroup.bringToFront();
            }

            if (insetControllers.length) {
                insetControllers.forEach(controller => {
                    controller.linesLayer.clearLayers();
                    const insetLinesLayer = L.geoJSON(data, {
                        style: function (feature) {
                            const props = feature && feature.properties ? feature.properties : {};
                            const color = props.color || baseStyle.color;
                            const weight = Number(props.weight) || baseStyle.weight;
                            const opacity = typeof props.opacity === 'number' ? props.opacity : baseStyle.opacity;
                            return {
                                color: color,
                                weight: weight,
                                opacity: opacity,
                                interactive: false,
                                className: 'connections-line'
                            };
                        }
                    });
                    controller.linesLayer.addLayer(insetLinesLayer);
                    if (typeof controller.linesLayer.bringToFront === 'function') {
                        controller.linesLayer.bringToFront();
                    }
                    if (typeof controller.markersLayer.bringToFront === 'function') {
                        controller.markersLayer.bringToFront();
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando GeoJSON de líneas:', error);
        } finally {
            if (showPreloader) {
                togglePreloader(false);
            }
        }
    }

    // Función para cargar dataLayers (capas de datos para análisis)
    async function loadPresasDataLayers(dataLayersConfig) {
        if (!dataLayersConfig || !Array.isArray(dataLayersConfig)) {
            return;
        }

        console.log('🟣 Cargando', dataLayersConfig.length, 'dataLayers para análisis espacial...');

        for (const layerConfig of dataLayersConfig) {
            try {
                const response = await fetch(layerConfig.url);
                const data = await response.json();

                presasDataLayers[layerConfig.type] = {
                    data: data,
                    config: layerConfig
                };

                console.log(`✅ DataLayer cargado: ${layerConfig.name} (${data.features.length} features)`);
            } catch (error) {
                console.error(`❌ Error cargando dataLayer ${layerConfig.name}:`, error);
            }
        }
    }

    // Crear control de radio de búsqueda
    function createRadiusControl() {
        if (radiusControl) {
            map.removeControl(radiusControl);
        }

        radiusControl = L.control({ position: 'topleft' });
        radiusControl.onAdd = function () {
            const div = L.DomUtil.create('div', 'radius-control');
            div.innerHTML = `
                <div style="background: white; padding: 12px 15px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.3); min-width: 250px; font-family: 'Montserrat', sans-serif; margin-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label style="font-size: 13px; font-weight: 600; color: #333;">
                            <i class="bi bi-bullseye"></i> Radio de Búsqueda
                        </label>
                        <span id="radius-value" style="font-weight: 700; color: #1f7a62; font-size: 14px;">${currentSearchRadius / 1000} km</span>
                    </div>
                    <input type="range" id="radius-slider" min="5" max="50" step="5" value="${currentSearchRadius / 1000}" 
                           style="width: 100%; cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999; margin-top: 4px;">
                        <span>5 km</span>
                        <span>50 km</span>
                    </div>
                    <button id="apply-radius-btn" style="width: 100%; margin-top: 10px; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">
                        <i class="bi bi-arrow-clockwise"></i> Actualizar Análisis
                    </button>
                </div>
            `;

            L.DomEvent.disableClickPropagation(div);

            return div;
        };

        radiusControl.addTo(map);

        // Event listeners
        setTimeout(() => {
            const slider = document.getElementById('radius-slider');
            const valueDisplay = document.getElementById('radius-value');
            const applyBtn = document.getElementById('apply-radius-btn');

            if (slider && valueDisplay) {
                // SOLO actualizar el display, NO currentSearchRadius
                // currentSearchRadius se actualiza solo cuando se hace clic en "Actualizar Análisis"
                slider.addEventListener('input', function () {
                    valueDisplay.textContent = this.value + ' km';
                });
            }

            if (applyBtn && currentPresaSelected) {
                applyBtn.addEventListener('click', function () {
                    // AQUÍ sí actualizar currentSearchRadius cuando el usuario hace clic
                    const slider = document.getElementById('radius-slider');
                    if (slider) {
                        currentSearchRadius = slider.value * 1000;
                        console.log(`🎚️ Radio actualizado desde SLIDER: ${slider.value} km`);
                    }
                    analyzePresaResources(currentPresaSelected.latlng, currentPresaSelected.name);
                });
            }
        }, 100);
    }

    // Función para actualizar el panel de descripción con análisis detallado
    function updateAnalysisDescriptionPanel(stats) {
        const mapDescriptionEl = document.getElementById('map-description');
        const titleEl = document.getElementById('map-description-title');
        const contentEl = document.getElementById('map-description-content');

        if (!mapDescriptionEl || !titleEl || !contentEl) return;

        titleEl.innerHTML = `<i class="bi bi-graph-up-arrow"></i> Análisis Espacial: ${stats.presaNombre}`;

        let content = `
            <div style="font-family: var(--font-family-body); line-height: 1.6;">
                <div style="background: var(--gradient-verde); color: white; padding: var(--spacing-md); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-lg); box-shadow: var(--shadow-soft);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="bi bi-bullseye" style="font-size: 24px;"></i>
                        <div>
                            <div style="font-size: 18px; font-weight: 700;">Radio de Búsqueda: ${stats.radioKm} km</div>
                            <div style="font-size: 13px; opacity: 0.95;">Análisis de recursos en el área de influencia</div>
                        </div>
                    </div>
                </div>
        `;

        // Localidades Indígenas
        if (stats.totalLocalidades > 0) {
            content += `
                <div style="background: var(--color-gobmx-dorado-light); border-left: 4px solid var(--color-gobmx-dorado); padding: var(--spacing-lg); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-lg); box-shadow: var(--shadow-card);">
                    <h4 style="margin: 0 0 var(--spacing-md) 0; color: var(--color-gobmx-dorado); font-size: var(--font-size-h4); font-family: var(--font-family-headings);">
                        <i class="bi bi-people-fill"></i> Localidades Indígenas Cercanas
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-md); margin-bottom: var(--spacing-md);">
                        <div style="background: var(--color-background); padding: var(--spacing-md); border-radius: var(--border-radius-md); text-align: center; box-shadow: var(--shadow-card);">
                            <div style="font-size: 32px; font-weight: 700; color: var(--color-gobmx-dorado); margin-bottom: var(--spacing-xs);">
                                ${stats.totalLocalidades}
                            </div>
                            <div style="font-size: var(--font-size-small); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
                                <i class="bi bi-geo-alt-fill"></i> Localidades
                            </div>
                        </div>
                        <div style="background: var(--color-background); padding: var(--spacing-md); border-radius: var(--border-radius-md); text-align: center; box-shadow: var(--shadow-card);">
                            <div style="font-size: 32px; font-weight: 700; color: var(--color-gobmx-verde); margin-bottom: var(--spacing-xs);">
                                ${stats.poblacionTotal.toLocaleString('es-MX')}
                            </div>
                            <div style="font-size: var(--font-size-small); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
                                <i class="bi bi-people"></i> Población Total
                            </div>
                        </div>
                        <div style="background: var(--color-background); padding: var(--spacing-md); border-radius: var(--border-radius-md); text-align: center; box-shadow: var(--shadow-card);">
                            <div style="font-size: 32px; font-weight: 700; color: var(--color-gobmx-guinda); margin-bottom: var(--spacing-xs);">
                                ${stats.hogaresIndigenas.toLocaleString('es-MX')}
                            </div>
                            <div style="font-size: var(--font-size-small); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
                                <i class="bi bi-house-fill"></i> Hogares Indígenas
                            </div>
                        </div>
                        ${stats.poblacionAfro > 0 ? `
                            <div style="background: var(--color-background); padding: var(--spacing-md); border-radius: var(--border-radius-md); text-align: center; box-shadow: var(--shadow-card);">
                                <div style="font-size: 32px; font-weight: 700; color: var(--color-gobmx-gris); margin-bottom: var(--spacing-xs);">
                                    ${stats.poblacionAfro.toLocaleString('es-MX')}
                                </div>
                                <div style="font-size: var(--font-size-small); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
                                    <i class="bi bi-people"></i> Población Afro
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Tabla detallada de localidades -->
                    <div style="margin-top: var(--spacing-lg); overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; background: var(--color-background); border-radius: var(--border-radius-md); overflow: hidden; box-shadow: var(--shadow-card); font-size: var(--font-size-small);">
                            <thead>
                                <tr style="background: var(--gradient-verde); color: white;">
                                    <th style="padding: var(--spacing-sm); text-align: left; font-weight: 600;">#</th>
                                    <th style="padding: var(--spacing-sm); text-align: left; font-weight: 600;">Localidad</th>
                                    <th style="padding: var(--spacing-sm); text-align: left; font-weight: 600;">Municipio</th>
                                    <th style="padding: var(--spacing-sm); text-align: center; font-weight: 600;">Población</th>
                                    <th style="padding: var(--spacing-sm); text-align: center; font-weight: 600;">Hogares Ind.</th>
                                    <th style="padding: var(--spacing-sm); text-align: center; font-weight: 600;">Dist. Presa</th>
                                    <th style="padding: var(--spacing-sm); text-align: center; font-weight: 600;">Sitio Ramsar</th>
                                    <th style="padding: var(--spacing-sm); text-align: center; font-weight: 600;">ANP</th>
                                    <th style="padding: var(--spacing-sm); text-align: center; font-weight: 600;">ADVC</th>
                                    <th style="padding: var(--spacing-sm); text-align: center; font-weight: 600;">Río Usumacinta</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            // Agregar cada localidad a la tabla
            stats.localidadesDetalle.forEach((loc, index) => {
                const rowBg = index % 2 === 0 ? 'var(--color-background)' : 'var(--color-surface)';
                content += `
                                <tr style="background: ${rowBg}; border-bottom: 1px solid var(--color-border);">
                                    <td style="padding: var(--spacing-sm); font-weight: 600; color: var(--color-gobmx-dorado);">${index + 1}</td>
                                    <td style="padding: var(--spacing-sm); font-weight: 600;">${loc.nombre}</td>
                                    <td style="padding: var(--spacing-sm);">${loc.municipio}</td>
                                    <td style="padding: var(--spacing-sm); text-align: center;">${loc.poblacion.toLocaleString('es-MX')}</td>
                                    <td style="padding: var(--spacing-sm); text-align: center;">${loc.hogaresIndigenas.toLocaleString('es-MX')}</td>
                                    <td style="padding: var(--spacing-sm); text-align: center; font-weight: 600; color: var(--color-gobmx-guinda);">${loc.distanciaPresa} km</td>
                                    <td style="padding: var(--spacing-sm); text-align: center; font-size: 11px;">${loc.sitioRamsar || '<span style="color: var(--color-text-secondary);">—</span>'}</td>
                                    <td style="padding: var(--spacing-sm); text-align: center; font-size: 11px;">${loc.areaNatural || '<span style="color: var(--color-text-secondary);">—</span>'}</td>
                                    <td style="padding: var(--spacing-sm); text-align: center; font-size: 11px;">${loc.areaVoluntaria || '<span style="color: var(--color-text-secondary);">—</span>'}</td>
                                    <td style="padding: var(--spacing-sm); text-align: center;">${loc.distanciaRio || '<span style="color: var(--color-text-secondary);">—</span>'}</td>
                                </tr>
                `;
            });

            content += `
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="background: var(--color-surface); padding: var(--spacing-sm); border-radius: var(--border-radius-sm); font-size: var(--font-size-small); color: var(--color-text-secondary); margin-top: var(--spacing-md);">
                        <i class="bi bi-info-circle-fill" style="color: var(--color-gobmx-dorado);"></i>
                        <strong>Nota:</strong> La tabla muestra las ${stats.totalLocalidades} localidades identificadas con todos sus detalles y distancias a los recursos cercanos.
                    </div>
                </div>
            `;
        }

        // Sitios Ramsar
        if (stats.sitiosRamsar.length > 0) {
            content += `
                <div style="background: #EFEBE9; border-left: 4px solid #8D6E63; padding: var(--spacing-lg); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-lg); box-shadow: var(--shadow-card);">
                    <h4 style="margin: 0 0 var(--spacing-md) 0; color: #5D4037; font-size: var(--font-size-h4); font-family: var(--font-family-headings);">
                        <i class="bi bi-water"></i> Sitios Ramsar (${stats.sitiosRamsar.length})
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
            `;

            stats.sitiosRamsar.forEach((ramsar, index) => {
                content += `
                    <div style="background: var(--color-background); padding: var(--spacing-md); border-radius: var(--border-radius-md); border-left: 3px solid ${ramsar.intersecta ? '#8D6E63' : '#A1887F'}; box-shadow: var(--shadow-card);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-sm);">
                            <div style="flex: 1;">
                                <div style="font-size: 16px; font-weight: 700; color: #5D4037; margin-bottom: var(--spacing-xs); font-family: var(--font-family-headings);">
                                    ${ramsar.nombre}
                                </div>
                                <div style="font-size: var(--font-size-small); color: var(--color-text-secondary);">
                                    <i class="bi bi-geo-alt-fill"></i> ${ramsar.estado} • ${ramsar.municipios}
                                </div>
                            </div>
                            <div style="padding: 8px 15px; background: ${ramsar.intersecta ? '#EFEBE9' : '#D7CCC8'}; border-radius: 20px; font-size: var(--font-size-small); font-weight: 600; color: ${ramsar.intersecta ? '#5D4037' : '#4E342E'}; white-space: nowrap;">
                                ${ramsar.intersecta ?
                        '<i class="bi bi-check-circle-fill"></i> DENTRO' :
                        `<i class="bi bi-rulers"></i> ${(ramsar.distancia / 1000).toFixed(2)} km`
                    }
                            </div>
                        </div>
                        <div style="font-size: var(--font-size-small); padding: var(--spacing-sm); background: #FBE9E7; border-radius: var(--border-radius-sm); color: #5D4037;">
                            <i class="bi bi-info-circle"></i> Humedal de importancia internacional bajo la Convención de Ramsar
                        </div>
                    </div>
                `;
            });

            content += `
                    </div>
                </div>
            `;
        }

        // Áreas Naturales Protegidas
        if (stats.areasNaturales.length > 0) {
            content += `
                <div style="background: var(--color-gobmx-verde-light); border-left: 4px solid var(--color-gobmx-verde); padding: var(--spacing-lg); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-lg); box-shadow: var(--shadow-card);">
                    <h4 style="margin: 0 0 var(--spacing-md) 0; color: var(--color-gobmx-verde); font-size: var(--font-size-h4); font-family: var(--font-family-headings);">
                        <i class="bi bi-tree-fill"></i> Áreas Naturales Protegidas (${stats.areasNaturales.length})
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
            `;

            stats.areasNaturales.forEach((anp, index) => {
                content += `
                    <div style="background: var(--color-background); padding: var(--spacing-md); border-radius: var(--border-radius-md); border-left: 3px solid ${anp.intersecta ? 'var(--color-gobmx-verde)' : 'var(--color-gobmx-dorado)'}; box-shadow: var(--shadow-card);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-sm);">
                            <div style="flex: 1;">
                                <div style="font-size: 16px; font-weight: 700; color: var(--color-gobmx-verde); margin-bottom: var(--spacing-xs); font-family: var(--font-family-headings);">
                                    ${anp.nombre}
                                </div>
                                <div style="font-size: var(--font-size-small); color: var(--color-text-secondary); margin-bottom: 4px;">
                                    <i class="bi bi-shield-fill-check"></i> ${anp.categoria} • ${anp.tipo}
                                </div>
                                <div style="font-size: var(--font-size-small); color: var(--color-text-secondary);">
                                    <i class="bi bi-geo-alt-fill"></i> ${anp.entidad} • ${anp.municipio}
                                </div>
                            </div>
                            <div style="padding: 8px 15px; background: ${anp.intersecta ? 'var(--color-gobmx-verde-light)' : 'var(--color-gobmx-dorado-light)'}; border-radius: 20px; font-size: var(--font-size-small); font-weight: 600; color: ${anp.intersecta ? 'var(--color-gobmx-verde)' : 'var(--color-gobmx-dorado)'}; white-space: nowrap;">
                                ${anp.intersecta ?
                        '<i class="bi bi-check-circle-fill"></i> DENTRO' :
                        `<i class="bi bi-rulers"></i> ${(anp.distancia / 1000).toFixed(2)} km`
                    }
                            </div>
                        </div>
                    </div>
                `;
            });

            content += `
                    </div>
                </div>
            `;
        }

        // Áreas Destinadas Voluntariamente a la Conservación (ADVC)
        if (stats.areasVoluntarias.length > 0) {
            content += `
                <div style="background: #F3E5F5; border-left: 4px solid #AB47BC; padding: var(--spacing-lg); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-lg); box-shadow: var(--shadow-card);">
                    <h4 style="margin: 0 0 var(--spacing-md) 0; color: #7B1FA2; font-size: var(--font-size-h4); font-family: var(--font-family-headings);">
                        <i class="bi bi-heart-fill"></i> Áreas Destinadas Voluntariamente a la Conservación (${stats.areasVoluntarias.length})
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
            `;

            stats.areasVoluntarias.forEach((advc, index) => {
                content += `
                    <div style="background: var(--color-background); padding: var(--spacing-md); border-radius: var(--border-radius-md); border-left: 3px solid ${advc.intersecta ? '#AB47BC' : '#BA68C8'}; box-shadow: var(--shadow-card);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-sm);">
                            <div style="flex: 1;">
                                <div style="font-size: 16px; font-weight: 700; color: #7B1FA2; margin-bottom: var(--spacing-xs); font-family: var(--font-family-headings);">
                                    ${advc.nombre}
                                </div>
                                <div style="font-size: var(--font-size-small); color: var(--color-text-secondary);">
                                    <i class="bi bi-geo-alt-fill"></i> ${advc.entidad} • ${advc.municipio}
                                </div>
                            </div>
                            <div style="padding: 8px 15px; background: ${advc.intersecta ? '#F3E5F5' : '#FCE4EC'}; border-radius: 20px; font-size: var(--font-size-small); font-weight: 600; color: ${advc.intersecta ? '#7B1FA2' : '#C2185B'}; white-space: nowrap;">
                                ${advc.intersecta ?
                        '<i class="bi bi-check-circle-fill"></i> DENTRO' :
                        `<i class="bi bi-rulers"></i> ${(advc.distancia / 1000).toFixed(2)} km`
                    }
                            </div>
                        </div>
                        <div style="font-size: var(--font-size-small); padding: var(--spacing-sm); background: #F8BBD0; border-radius: var(--border-radius-sm); color: #880E4F;">
                            <i class="bi bi-award-fill"></i> Área bajo conservación voluntaria
                        </div>
                    </div>
                `;
            });

            content += `
                    </div>
                </div>
            `;
        }

        // Río Usumacinta
        if (stats.distanciaRioUsumacinta !== null) {
            content += `
                <div style="background: var(--color-gobmx-guinda-light); border-left: 4px solid var(--color-gobmx-guinda); padding: var(--spacing-lg); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-lg); box-shadow: var(--shadow-card);">
                    <h4 style="margin: 0 0 var(--spacing-md) 0; color: var(--color-gobmx-guinda); font-size: var(--font-size-h4); font-family: var(--font-family-headings);">
                        <i class="bi bi-water"></i> Río Usumacinta
                    </h4>
                    <div style="background: var(--color-background); padding: var(--spacing-lg); border-radius: var(--border-radius-md); text-align: center; box-shadow: var(--shadow-card);">
                        <div style="font-size: var(--font-size-small); color: var(--color-text-secondary); margin-bottom: var(--spacing-sm);">
                            <i class="bi bi-rulers"></i> Distancia más corta a la presa
                        </div>
                        <div style="font-size: 48px; font-weight: 700; color: var(--color-gobmx-guinda); margin-bottom: var(--spacing-sm);">
                            ${(stats.distanciaRioUsumacinta / 1000).toFixed(2)} km
                        </div>
                        <div style="font-size: var(--font-size-small); padding: var(--spacing-sm); background: var(--color-surface); border-radius: var(--border-radius-sm); color: var(--color-text-secondary); margin-top: var(--spacing-md);">
                            <strong><i class="bi bi-info-circle-fill" style="color: var(--color-gobmx-guinda);"></i> Importancia:</strong><br>
                            Uno de los ríos más caudalosos de México • Frontera natural con Guatemala • Cuenca de gran biodiversidad
                        </div>
                    </div>
                </div>
            `;
        }

        // Mensaje si no hay recursos
        if (stats.totalLocalidades === 0 && stats.sitiosRamsar.length === 0 && stats.distanciaRioUsumacinta === null) {
            content += `
                <div style="background: var(--color-surface); padding: var(--spacing-xl); border-radius: var(--border-radius-md); text-align: center; color: var(--color-text-secondary); box-shadow: var(--shadow-card);">
                    <i class="bi bi-info-circle" style="font-size: 48px; display: block; margin-bottom: var(--spacing-md); color: var(--color-gobmx-gris);"></i>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: var(--spacing-xs); color: var(--color-text-primary); font-family: var(--font-family-headings);">No se encontraron recursos</div>
                    <div style="font-size: var(--font-size-small);">
                        No hay localidades indígenas, sitios Ramsar ni el río Usumacinta dentro del radio de ${stats.radioKm} km.
                    </div>
                    <div style="margin-top: var(--spacing-md); font-size: var(--font-size-small); color: var(--color-text-secondary);">
                        <i class="bi bi-lightbulb"></i> Intenta aumentar el radio de búsqueda usando el control en la esquina superior izquierda.
                    </div>
                </div>
            `;
        }

        content += `</div>`;

        contentEl.innerHTML = content;
        mapDescriptionEl.style.display = 'block';

        // Scroll suave al panel de descripción
        setTimeout(() => {
            mapDescriptionEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 300);
    }

    // Función para analizar recursos cercanos a una presa
    function analyzePresaResources(presaLatLng, presaNombre) {
        // MOSTRAR PRELOADER al iniciar análisis
        console.log('🔄 Mostrando preloader para análisis...');
        togglePreloader(true);

        // Animar barra de progreso en AMBOS preloaders
        const progressBars = document.querySelectorAll('.progress-fill');
        const progressTexts = document.querySelectorAll('#preloader p, #map-preloader p');

        // Función para actualizar todos los preloaders
        const updateProgress = (width, text) => {
            progressBars.forEach(bar => bar.style.width = width);
            progressTexts.forEach(txt => txt.textContent = text);
        };

        // Iniciar animación
        updateProgress('0%', 'Iniciando análisis...');

        // Animar hasta 30%
        setTimeout(() => {
            updateProgress('30%', 'Procesando localidades indígenas...');
        }, 150);

        // Animar hasta 60%
        setTimeout(() => {
            updateProgress('60%', 'Analizando áreas protegidas...');
        }, 300);

        // Animar hasta 90%
        setTimeout(() => {
            updateProgress('90%', 'Finalizando análisis...');
        }, 450);

        // Dar tiempo al navegador para renderizar el preloader antes de iniciar el análisis pesado
        setTimeout(() => {
            executeAnalysis(presaLatLng, presaNombre);
        }, 100);
    }

    // Función auxiliar que ejecuta el análisis real
    function executeAnalysis(presaLatLng, presaNombre) {
        // IMPORTANTE: currentSearchRadius debe estar ya configurado ANTES de llamar esta función
        console.log(`🔍 INICIO analyzePresaResources - currentSearchRadius = ${currentSearchRadius} metros (${currentSearchRadius / 1000} km)`);

        // Cerrar todos los popups abiertos
        map.closePopup();

        // Limpiar análisis anterior
        if (presasAnalysisLayer) {
            map.removeLayer(presasAnalysisLayer);
        }
        presasAnalysisLayer = L.layerGroup().addTo(map);

        // Actualizar el slider si existe para que refleje el radio usado
        if (radiusControl) {
            const slider = document.getElementById('radius-slider');
            const valueDisplay = document.getElementById('radius-value');
            if (slider && valueDisplay) {
                slider.value = currentSearchRadius / 1000;
                valueDisplay.textContent = (currentSearchRadius / 1000) + ' km';
            }
        }

        console.log(`🔍 Analizando recursos cercanos a: ${presaNombre} (Radio: ${currentSearchRadius / 1000}km)`);

        // Centrar mapa en la presa con zoom apropiado para ver el radio
        const zoomLevel = currentSearchRadius <= 20000 ? 10 : (currentSearchRadius <= 50000 ? 9 : 8);
        map.setView(presaLatLng, zoomLevel, {
            animate: true,
            duration: 0.8
        });

        // ⚠️ VERIFICACIÓN CRÍTICA: Valor de currentSearchRadius en este punto
        console.log(`⚠️ CRÍTICO - currentSearchRadius en análisis: ${currentSearchRadius} metros (${currentSearchRadius / 1000} km)`);

        // Objeto para almacenar estadísticas del análisis
        const analysisStats = {
            presaNombre: presaNombre,
            radioKm: currentSearchRadius / 1000,
            totalLocalidades: 0,
            poblacionTotal: 0,
            hogaresIndigenas: 0,
            poblacionAfro: 0,
            sitiosRamsar: [],
            areasNaturales: [],
            areasVoluntarias: [],
            distanciaRioUsumacinta: null,
            localidadesDetalle: [] // Array para almacenar detalle de cada localidad
        };

        console.log(`📊 analysisStats.radioKm configurado a: ${analysisStats.radioKm} km`);

        // Analizar cada dataLayer
        Object.keys(presasDataLayers).forEach(layerType => {
            const layerData = presasDataLayers[layerType];
            const config = layerData.config;
            const radius = currentSearchRadius; // Usar radio actual

            console.log(`🔄 Procesando capa: ${layerType}, usando radius: ${radius} metros (${radius / 1000} km)`);

            // Dibujar círculo de búsqueda (solo una vez)
            if (layerType === Object.keys(presasDataLayers)[0]) {
                const searchCircle = L.circle(presaLatLng, {
                    radius: radius,
                    color: '#FF6B6B',
                    fillColor: '#FF6B6B',
                    fillOpacity: 0.1,
                    weight: 2,
                    dashArray: '5, 10',
                    interactive: false // No interactivo para evitar clics
                }).addTo(presasAnalysisLayer);

                // Agregar etiqueta al círculo
                const circleLabel = L.marker(presaLatLng, {
                    icon: L.divIcon({
                        className: 'circle-label',
                        html: `
                            <div style="background: rgba(255, 107, 107, 0.9); color: white; padding: 5px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                                <i class="bi bi-bullseye"></i> Radio: ${(radius / 1000)} km
                            </div>
                        `,
                        iconSize: [100, 30],
                        iconAnchor: [50, -20]
                    }),
                    interactive: false
                }).addTo(presasAnalysisLayer);
            }

            // Buscar features dentro del radio según tipo de geometría
            const nearbyFeatures = [];

            layerData.data.features.forEach(feature => {
                const geomType = feature.geometry.type;

                if (geomType === 'Point') {
                    // Análisis para puntos (localidades)
                    const featureLatLng = L.latLng(
                        feature.geometry.coordinates[1],
                        feature.geometry.coordinates[0]
                    );
                    const distance = presaLatLng.distanceTo(featureLatLng);

                    if (distance <= radius) {
                        nearbyFeatures.push({
                            feature: feature,
                            distance: distance
                        });
                    }
                } else if (geomType === 'MultiPolygon' || geomType === 'Polygon') {
                    // Análisis para polígonos (Ramsar)
                    const presaPoint = turf.point([presaLatLng.lng, presaLatLng.lat]);
                    const presaBuffer = turf.buffer(presaPoint, radius / 1000, { units: 'kilometers' });

                    try {
                        const intersects = turf.booleanIntersects(presaBuffer, feature);
                        if (intersects) {
                            // Calcular distancia al borde más cercano del polígono
                            let distance = 0;
                            try {
                                const polyLine = turf.polygonToLine(feature);
                                distance = turf.pointToLineDistance(presaPoint, polyLine, { units: 'meters' });
                            } catch (lineError) {
                                // Si falla al convertir a línea, usar distancia 0 (está dentro o muy cerca)
                                distance = 0;
                            }

                            nearbyFeatures.push({
                                feature: feature,
                                distance: distance,
                                intersects: true
                            });
                        }
                    } catch (e) {
                        console.warn('Error calculando intersección con polígono:', e);
                    }
                } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                    // Análisis para líneas (ríos)
                    const presaPoint = turf.point([presaLatLng.lng, presaLatLng.lat]);

                    try {
                        let distance;
                        if (geomType === 'MultiLineString') {
                            // Para MultiLineString, calcular distancia a cada línea y tomar la mínima
                            let minDist = Infinity;
                            feature.geometry.coordinates.forEach(lineCoords => {
                                const lineFeature = turf.lineString(lineCoords);
                                const dist = turf.pointToLineDistance(presaPoint, lineFeature, { units: 'meters' });
                                if (dist < minDist) {
                                    minDist = dist;
                                }
                            });
                            distance = minDist;
                        } else {
                            distance = turf.pointToLineDistance(presaPoint, feature, { units: 'meters' });
                        }

                        if (distance <= radius) {
                            nearbyFeatures.push({
                                feature: feature,
                                distance: distance
                            });
                        }
                    } catch (e) {
                        console.warn('Error calculando distancia a línea:', e);
                    }
                }
            });

            console.log(`  📍 ${config.name}: ${nearbyFeatures.length} recursos encontrados dentro de ${radius / 1000}km`);

            // Procesar Sitios Ramsar
            if (layerType === 'ramsar_analysis' && nearbyFeatures.length > 0) {
                console.log(`  🌿 Sitios Ramsar encontrados: ${nearbyFeatures.length}`);
                nearbyFeatures.forEach(item => {
                    const props = item.feature.properties;
                    const ramsar = {
                        nombre: props.RAMSAR || 'Sin nombre',
                        estado: props.ESTADO || 'N/A',
                        municipios: props.MUNICIPIOS || 'N/A',
                        distancia: item.distance,
                        intersecta: item.intersects || false
                    };
                    analysisStats.sitiosRamsar.push(ramsar);

                    // Dibujar polígono del sitio Ramsar
                    const ramsarLayer = L.geoJSON(item.feature, {
                        style: {
                            fillColor: ramsar.intersecta ? '#8D6E63' : '#A1887F',
                            color: ramsar.intersecta ? '#5D4037' : '#795548',
                            weight: 2,
                            opacity: 0.8,
                            fillOpacity: 0.2
                        }
                    });

                    // Calcular área del sitio Ramsar
                    let areaHectareas = 0;
                    try {
                        const areaMetros = turf.area(item.feature);
                        areaHectareas = (areaMetros / 10000).toFixed(2); // Convertir a hectáreas
                    } catch (e) {
                        console.warn('Error calculando área del sitio Ramsar:', e);
                    }

                    // Obtener coordenadas del centro
                    let centroCoords = '';
                    try {
                        const centro = turf.center(item.feature);
                        const lat = centro.geometry.coordinates[1].toFixed(6);
                        const lng = centro.geometry.coordinates[0].toFixed(6);
                        centroCoords = `${lat}, ${lng}`;
                    } catch (e) {
                        console.warn('Error calculando centro del sitio Ramsar:', e);
                    }

                    // Crear popup simplificado para el sitio Ramsar
                    const ramsarPopupContent = `
                        <div style="font-family: 'Montserrat', sans-serif; min-width: 220px;">
                            <div style="background: linear-gradient(135deg, #8D6E63 0%, #A1887F 100%); padding: 10px; margin: -10px -10px 10px -10px; border-radius: 4px 4px 0 0;">
                                <h4 style="margin: 0; color: white; font-size: 14px;">
                                    <i class="bi bi-water"></i> Sitio Ramsar
                                </h4>
                            </div>
                            
                            <div style="margin-bottom: 12px;">
                                <div style="font-size: 15px; font-weight: 700; color: #5D4037; margin-bottom: 5px;">
                                    ${ramsar.nombre}
                                </div>
                                <div style="font-size: 12px; color: #666;">
                                    <i class="bi bi-geo-alt-fill"></i> ${ramsar.estado} • ${ramsar.municipios}
                                </div>
                            </div>
                            
                            <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">
                            
                            <div style="font-size: 13px; line-height: 1.8;">
                                ${areaHectareas > 0 ? `
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding: 8px; background: #EFEBE9; border-radius: 4px;">
                                        <span><i class="bi bi-bounding-box"></i> <strong>Área:</strong></span>
                                        <span style="font-weight: 600; color: #5D4037;">${parseFloat(areaHectareas).toLocaleString('es-MX')} ha</span>
                                    </div>
                                ` : ''}
                                
                                ${centroCoords ? `
                                    <div style="margin-bottom: 8px;">
                                        <div style="font-size: 11px; color: #999; margin-bottom: 3px;">
                                            <i class="bi bi-crosshair"></i> Centro del sitio:
                                        </div>
                                        <div style="font-family: monospace; font-size: 11px; color: #666; background: #f5f5f5; padding: 4px 8px; border-radius: 3px;">
                                            ${centroCoords}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                <div style="margin-top: 12px; padding: 10px; background: ${ramsar.intersecta ? '#EFEBE9' : '#FFF3E0'}; border-left: 3px solid ${ramsar.intersecta ? '#8D6E63' : '#FFA726'}; border-radius: 4px;">
                                    <div style="font-weight: 600; color: ${ramsar.intersecta ? '#5D4037' : '#F57C00'};">
                                        ${ramsar.intersecta ?
                            '<i class="bi bi-check-circle-fill"></i> La presa está DENTRO de este sitio' :
                            `<i class="bi bi-rulers"></i> Distancia a presa: ${(ramsar.distancia / 1000).toFixed(2)} km`
                        }
                                    </div>
                                </div>
                                
                                <div style="margin-top: 10px; padding: 8px; background: #E3F2FD; border-radius: 4px; font-size: 11px; color: #0277BD;">
                                    <i class="bi bi-info-circle-fill"></i> <strong>Sitio Ramsar:</strong> Humedal de importancia internacional bajo la Convención de Ramsar
                                </div>
                            </div>
                        </div>
                    `;

                    ramsarLayer.bindPopup(ramsarPopupContent, {
                        maxWidth: 320,
                        className: 'ramsar-popup'
                    });

                    ramsarLayer.addTo(presasAnalysisLayer);
                });
            }

            // Procesar Áreas Naturales Protegidas
            if (layerType === 'anp_analysis') {
                console.log(`  🌲 Procesando ANP... Features cercanas: ${nearbyFeatures.length}`);
                if (nearbyFeatures.length > 0) {
                    console.log(`  🌲 ANP encontradas dentro del radio: ${nearbyFeatures.length}`);
                    nearbyFeatures.forEach(item => {
                        const props = item.feature.properties;

                        // Debug: mostrar los campos disponibles
                        if (nearbyFeatures.indexOf(item) === 0) {
                            console.log('🔍 Campos disponibles en ANP:', Object.keys(props));
                            console.log('🔍 Valores:', props);
                        }

                        const anp = {
                            nombre: props.NOMBRE || props.name || props.nombre || 'Sin nombre',
                            tipo: props.TIPO || props.tipo || props.tipo_anp || props.TIPO_ANP || 'N/A',
                            categoria: props.CAT_DEC || props.categoria || props.CATEGORIA || props.cat_manejo || props.CAT_MANEJO || 'N/A',
                            entidad: props.ENTIDAD || props.entidad || props.ESTADO || props.estado || 'N/A',
                            municipio: props.MUN_DEC || props.municipio || props.MUNICIPIO || props.municipios || props.MUNICIPIOS || 'N/A',
                            distancia: item.distance,
                            intersecta: item.intersects || false
                        };
                        analysisStats.areasNaturales.push(anp);

                        // Dibujar polígono del ANP
                        const anpLayer = L.geoJSON(item.feature, {
                            style: {
                                fillColor: anp.intersecta ? '#66BB6A' : '#FFA726',
                                color: anp.intersecta ? '#388E3C' : '#F57C00',
                                weight: 2,
                                opacity: 0.8,
                                fillOpacity: 0.2
                            }
                        });

                        // Crear popup para ANP
                        const anpPopupContent = `
                        <div style="font-family: var(--font-family-body); min-width: 220px;">
                            <div style="background: linear-gradient(135deg, #66BB6A 0%, #81C784 100%); padding: 10px; margin: -10px -10px 10px -10px; border-radius: 4px 4px 0 0;">
                                <h4 style="margin: 0; color: white; font-size: 14px;">
                                    <i class="bi bi-tree-fill"></i> ANP
                                </h4>
                            </div>
                            
                            <div style="font-size: 14px; font-weight: 600; color: #388E3C; margin-bottom: 8px;">
                                ${anp.nombre}
                            </div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                                <i class="bi bi-shield-fill-check"></i> ${anp.categoria}
                            </div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 12px;">
                                <i class="bi bi-geo-alt-fill"></i> ${anp.entidad}
                            </div>
                            
                            <div style="padding: 8px; background: ${anp.intersecta ? '#E8F5E9' : '#FFF3E0'}; border-radius: 4px; text-align: center;">
                                <div style="font-weight: 600; font-size: 13px; color: ${anp.intersecta ? '#388E3C' : '#F57C00'};">
                                    ${anp.intersecta ?
                                '<i class="bi bi-check-circle-fill"></i> DENTRO' :
                                `<i class="bi bi-rulers"></i> ${(anp.distancia / 1000).toFixed(2)} km`
                            }
                                </div>
                            </div>
                            
                            <div style="margin-top: 10px; font-size: 11px; color: #999; text-align: center;">
                                <i class="bi bi-info-circle"></i> Ver detalles abajo ↓
                            </div>
                        </div>
                    `;

                        anpLayer.bindPopup(anpPopupContent, {
                            maxWidth: 250,
                            className: 'anp-popup'
                        });

                        anpLayer.addTo(presasAnalysisLayer);
                    });
                } else {
                    console.log(`  🌲 No hay ANP dentro del radio de ${currentSearchRadius / 1000} km`);
                }
            }

            // Procesar Áreas Destinadas Voluntariamente a la Conservación (ADVC)
            if (layerType === 'advc_analysis') {
                console.log(`  💜 Procesando ADVC... Features cercanas: ${nearbyFeatures.length}`);
                if (nearbyFeatures.length > 0) {
                    console.log(`  💜 ADVC encontradas dentro del radio: ${nearbyFeatures.length}`);
                    nearbyFeatures.forEach(item => {
                        const props = item.feature.properties;
                        const advc = {
                            nombre: props.ADVC || props.NOMBRE || props.name || 'Sin nombre',
                            entidad: props.ESTADO || props.ENTIDAD || 'N/A',
                            municipio: props.MUNICIPIO || props.MUN_DEC || 'N/A',
                            distancia: item.distance,
                            intersecta: item.intersects || false
                        };
                        analysisStats.areasVoluntarias.push(advc);

                        // Dibujar polígono del ADVC
                        const advcLayer = L.geoJSON(item.feature, {
                            style: {
                                fillColor: advc.intersecta ? '#AB47BC' : '#CE93D8',
                                color: advc.intersecta ? '#7B1FA2' : '#BA68C8',
                                weight: 2,
                                opacity: 0.8,
                                fillOpacity: 0.2
                            }
                        });

                        // Crear popup para ADVC
                        const advcPopupContent = `
                        <div style="font-family: var(--font-family-body); min-width: 220px;">
                            <div style="background: linear-gradient(135deg, #AB47BC 0%, #BA68C8 100%); padding: 10px; margin: -10px -10px 10px -10px; border-radius: 4px 4px 0 0;">
                                <h4 style="margin: 0; color: white; font-size: 14px;">
                                    <i class="bi bi-heart-fill"></i> ADVC
                                </h4>
                            </div>
                            
                            <div style="font-size: 14px; font-weight: 600; color: #7B1FA2; margin-bottom: 8px;">
                                ${advc.nombre}
                            </div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 12px;">
                                <i class="bi bi-geo-alt-fill"></i> ${advc.entidad} • ${advc.municipio}
                            </div>
                            
                            <div style="padding: 8px; background: ${advc.intersecta ? '#F3E5F5' : '#FCE4EC'}; border-radius: 4px; text-align: center;">
                                <div style="font-weight: 600; font-size: 13px; color: ${advc.intersecta ? '#7B1FA2' : '#C2185B'};">
                                    ${advc.intersecta ?
                                '<i class="bi bi-check-circle-fill"></i> DENTRO' :
                                `<i class="bi bi-rulers"></i> ${(advc.distancia / 1000).toFixed(2)} km`
                            }
                                </div>
                            </div>
                            
                            <div style="margin-top: 10px; font-size: 11px; color: #999; text-align: center;">
                                <i class="bi bi-info-circle"></i> Ver detalles abajo ↓
                            </div>
                        </div>
                    `;

                        advcLayer.bindPopup(advcPopupContent, {
                            maxWidth: 250,
                            className: 'advc-popup'
                        });

                        advcLayer.addTo(presasAnalysisLayer);
                    });
                } else {
                    console.log(`  💜 No hay ADVC dentro del radio de ${currentSearchRadius / 1000} km`);
                }
            }

            // Procesar Río Usumacinta - Calcular distancia siempre
            if (layerType === 'usumacinta_analysis') {
                // Calcular distancia al río sin importar el radio (para info)
                const presaPoint = turf.point([presaLatLng.lng, presaLatLng.lat]);
                let minDistanceTotal = Infinity;

                layerData.data.features.forEach(rioFeature => {
                    try {
                        let distance;
                        const geomType = rioFeature.geometry.type;

                        if (geomType === 'MultiLineString') {
                            // Para MultiLineString, calcular distancia a cada línea
                            let minDist = Infinity;
                            rioFeature.geometry.coordinates.forEach(lineCoords => {
                                const lineFeature = turf.lineString(lineCoords);
                                const dist = turf.pointToLineDistance(presaPoint, lineFeature, { units: 'meters' });
                                if (dist < minDist) {
                                    minDist = dist;
                                }
                            });
                            distance = minDist;
                        } else {
                            distance = turf.pointToLineDistance(presaPoint, rioFeature, { units: 'meters' });
                        }

                        if (distance < minDistanceTotal) {
                            minDistanceTotal = distance;
                        }
                    } catch (e) {
                        console.warn('Error calculando distancia total al río:', e);
                    }
                });

                // Guardar la distancia total (siempre)
                if (minDistanceTotal !== Infinity) {
                    analysisStats.distanciaRioUsumacinta = minDistanceTotal;
                    console.log(`  🌊 Río Usumacinta: ${(minDistanceTotal / 1000).toFixed(2)} km (distancia total)`);
                }

                // Dibujar el río solo si está dentro del radio de búsqueda
                if (nearbyFeatures.length > 0) {
                    const minDistance = Math.min(...nearbyFeatures.map(f => f.distance));
                    console.log(`  🌊 Segmentos dentro del radio: ${nearbyFeatures.length}`);

                    // Dibujar el río con estilo destacado
                    nearbyFeatures.forEach(item => {
                        const rioLayer = L.geoJSON(item.feature, {
                            style: {
                                color: '#0288D1',
                                weight: 4,
                                opacity: 0.8
                            }
                        });

                        // Calcular longitud del segmento del río
                        let longitudKm = 0;
                        try {
                            longitudKm = turf.length(item.feature, { units: 'kilometers' }).toFixed(2);
                        } catch (e) {
                            console.warn('Error calculando longitud del río:', e);
                        }

                        // Crear popup para el río
                        const rioPopupContent = `
                        <div style="font-family: 'Montserrat', sans-serif; max-width: 320px;">
                            <div style="background: linear-gradient(135deg, #0288D1 0%, #03A9F4 100%); padding: 12px; margin: -10px -10px 15px -10px; border-radius: 4px 4px 0 0;">
                                <h4 style="margin: 0; color: white; font-size: 16px;">
                                    <i class="bi bi-water"></i> Río Usumacinta
                                </h4>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <div style="font-size: 13px; color: #666; margin-bottom: 8px;">
                                    <strong>Distancia más corta a la presa:</strong>
                                </div>
                                <div style="font-size: 1.4em; color: #0288D1; font-weight: 700; text-align: center; padding: 15px; background: #E3F2FD; border-radius: 8px; border: 2px solid #0288D1;">
                                    <i class="bi bi-rulers"></i> ${(item.distance / 1000).toFixed(2)} km
                                </div>
                            </div>
                            
                            ${longitudKm > 0 ? `
                                <div style="margin-bottom: 12px; padding: 10px; background: #E1F5FE; border-radius: 4px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 13px;"><i class="bi bi-arrows-expand"></i> <strong>Longitud segmento:</strong></span>
                                        <span style="font-size: 14px; font-weight: 600; color: #01579B;">${parseFloat(longitudKm).toLocaleString('es-MX')} km</span>
                                    </div>
                                </div>
                            ` : ''}
                            
                            <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">
                            
                            <div style="font-size: 12px; line-height: 1.6; color: #555;">
                                <div style="margin-bottom: 8px;">
                                    <i class="bi bi-info-circle-fill" style="color: #0288D1;"></i> 
                                    <strong>Importancia:</strong>
                                </div>
                                <ul style="margin: 5px 0 0 20px; padding: 0;">
                                    <li>Uno de los ríos más caudalosos de México</li>
                                    <li>Frontera natural entre México y Guatemala</li>
                                    <li>Cuenca hidrográfica de gran biodiversidad</li>
                                    <li>Longitud total: ~1,123 km</li>
                                </ul>
                            </div>
                            
                            <div style="margin-top: 10px; padding: 8px; background: #FFF9C4; border-left: 3px solid #FBC02D; border-radius: 4px; font-size: 11px; color: #F57F17;">
                                <i class="bi bi-exclamation-triangle-fill"></i> <strong>Nota:</strong> Este río es de importancia estratégica para la región
                            </div>
                        </div>
                    `;

                        rioLayer.bindPopup(rioPopupContent, {
                            maxWidth: 300,
                            className: 'rio-popup'
                        });

                        rioLayer.addTo(presasAnalysisLayer);
                    });
                } // Cierre del if nearbyFeatures.length > 0
            } // Cierre del if usumacinta_analysis

            // Mostrar las localidades cercanas
            if (layerType === 'localidades_indigenas' && nearbyFeatures.length > 0) {
                // Acumular estadísticas
                analysisStats.totalLocalidades = nearbyFeatures.length;

                nearbyFeatures.forEach(item => {
                    const feature = item.feature;
                    const props = feature.properties;
                    const coords = feature.geometry.coordinates;
                    const localidadLatLng = L.latLng(coords[1], coords[0]);

                    // Acumular datos
                    analysisStats.poblacionTotal += (props.POBTOTAL || 0);
                    analysisStats.hogaresIndigenas += (props.PIHOGARES || 0);
                    analysisStats.poblacionAfro += (props.POB_AFRO || 0);

                    // Calcular distancia a Ramsar más cercano
                    let ramsarCercano = null;
                    let distanciaRamsarMin = Infinity;

                    // Si hay Ramsar dentro del radio, usar esos
                    if (analysisStats.sitiosRamsar.length > 0) {
                        analysisStats.sitiosRamsar.forEach(ramsar => {
                            if (ramsar.distancia < distanciaRamsarMin) {
                                distanciaRamsarMin = ramsar.distancia;
                                ramsarCercano = ramsar.nombre;
                            }
                        });
                    } else if (presasDataLayers['ramsar_analysis']) {
                        // Si no hay Ramsar en el radio, buscar el más cercano de todos
                        const ramsarData = presasDataLayers['ramsar_analysis'];
                        const localidadPoint = turf.point([coords[0], coords[1]]);

                        ramsarData.data.features.forEach(ramsarFeature => {
                            try {
                                const distance = turf.pointToLineDistance(
                                    localidadPoint,
                                    turf.polygonToLine(ramsarFeature),
                                    { units: 'meters' }
                                );
                                if (distance < distanciaRamsarMin) {
                                    distanciaRamsarMin = distance;
                                    ramsarCercano = ramsarFeature.properties.RAMSAR || ramsarFeature.properties.name || 'Sin nombre';
                                }
                            } catch (e) {
                                // Si falla, intentar con el centroide
                                try {
                                    const ramsarCentroid = turf.centroid(ramsarFeature);
                                    const distance = turf.distance(localidadPoint, ramsarCentroid, { units: 'meters' });
                                    if (distance < distanciaRamsarMin) {
                                        distanciaRamsarMin = distance;
                                        ramsarCercano = ramsarFeature.properties.RAMSAR || ramsarFeature.properties.name || 'Sin nombre';
                                    }
                                } catch (e2) {
                                    console.warn('Error calculando distancia a Ramsar:', e2);
                                }
                            }
                        });
                    }

                    // Calcular distancia a ANP más cercana (buscar en TODAS las ANP, no solo las del radio)
                    let anpCercana = null;
                    let distanciaANPMin = Infinity;

                    // Si hay ANP dentro del radio, usar esas
                    if (analysisStats.areasNaturales.length > 0) {
                        analysisStats.areasNaturales.forEach(anp => {
                            if (anp.distancia < distanciaANPMin) {
                                distanciaANPMin = anp.distancia;
                                anpCercana = anp.nombre;
                            }
                        });
                    } else if (presasDataLayers['anp_analysis']) {
                        // Si no hay ANP en el radio, buscar la más cercana de todas
                        const anpData = presasDataLayers['anp_analysis'];
                        const localidadPoint = turf.point([coords[0], coords[1]]);

                        anpData.data.features.forEach(anpFeature => {
                            try {
                                const distance = turf.pointToLineDistance(
                                    localidadPoint,
                                    turf.polygonToLine(anpFeature),
                                    { units: 'meters' }
                                );
                                if (distance < distanciaANPMin) {
                                    distanciaANPMin = distance;
                                    anpCercana = anpFeature.properties.NOMBRE || 'Sin nombre';
                                }
                            } catch (e) {
                                // Si falla, intentar con el centroide
                                try {
                                    const anpCentroid = turf.centroid(anpFeature);
                                    const distance = turf.distance(localidadPoint, anpCentroid, { units: 'meters' });
                                    if (distance < distanciaANPMin) {
                                        distanciaANPMin = distance;
                                        anpCercana = anpFeature.properties.NOMBRE || 'Sin nombre';
                                    }
                                } catch (e2) {
                                    console.warn('Error calculando distancia a ANP:', e2);
                                }
                            }
                        });
                    }

                    // Calcular distancia a ADVC más cercana
                    let advcCercana = null;
                    let distanciaADVCMin = Infinity;

                    // Si hay ADVC dentro del radio, usar esas
                    if (analysisStats.areasVoluntarias.length > 0) {
                        analysisStats.areasVoluntarias.forEach(advc => {
                            if (advc.distancia < distanciaADVCMin) {
                                distanciaADVCMin = advc.distancia;
                                advcCercana = advc.nombre;
                            }
                        });
                    } else if (presasDataLayers['advc_analysis']) {
                        // Si no hay ADVC en el radio, buscar la más cercana de todas
                        const advcData = presasDataLayers['advc_analysis'];
                        const localidadPoint = turf.point([coords[0], coords[1]]);

                        advcData.data.features.forEach(advcFeature => {
                            try {
                                const distance = turf.pointToLineDistance(
                                    localidadPoint,
                                    turf.polygonToLine(advcFeature),
                                    { units: 'meters' }
                                );
                                if (distance < distanciaADVCMin) {
                                    distanciaADVCMin = distance;
                                    advcCercana = advcFeature.properties.ADVC || advcFeature.properties.NOMBRE || advcFeature.properties.nombre || 'Sin nombre';
                                }
                            } catch (e) {
                                // Si falla, intentar con el centroide
                                try {
                                    const advcCentroid = turf.centroid(advcFeature);
                                    const distance = turf.distance(localidadPoint, advcCentroid, { units: 'meters' });
                                    if (distance < distanciaADVCMin) {
                                        distanciaADVCMin = distance;
                                        advcCercana = advcFeature.properties.ADVC || advcFeature.properties.NOMBRE || advcFeature.properties.nombre || 'Sin nombre';
                                    }
                                } catch (e2) {
                                    console.warn('Error calculando distancia a ADVC:', e2);
                                }
                            }
                        });
                    }

                    // Calcular distancia al río Usumacinta
                    let distanciaRio = null;
                    if (presasDataLayers['usumacinta_analysis']) {
                        const rioData = presasDataLayers['usumacinta_analysis'];
                        const localidadPoint = turf.point([coords[0], coords[1]]);
                        try {
                            rioData.data.features.forEach(rioFeature => {
                                const geomType = rioFeature.geometry.type;
                                let dist;

                                if (geomType === 'MultiLineString') {
                                    // Para MultiLineString, calcular distancia a cada línea
                                    let minDist = Infinity;
                                    rioFeature.geometry.coordinates.forEach(lineCoords => {
                                        const lineFeature = turf.lineString(lineCoords);
                                        const d = turf.pointToLineDistance(localidadPoint, lineFeature, { units: 'kilometers' });
                                        if (d < minDist) {
                                            minDist = d;
                                        }
                                    });
                                    dist = minDist;
                                } else {
                                    dist = turf.pointToLineDistance(localidadPoint, rioFeature, { units: 'kilometers' });
                                }

                                if (distanciaRio === null || dist < distanciaRio) {
                                    distanciaRio = dist;
                                }
                            });
                        } catch (e) {
                            console.warn('Error calculando distancia al río desde localidad:', e);
                        }
                    }

                    // Guardar detalle de la localidad
                    analysisStats.localidadesDetalle.push({
                        nombre: props.LOCALIDAD || 'N/A',
                        municipio: props.MUNICIPIO || 'N/A',
                        entidad: props.ENTIDAD || 'N/A',
                        poblacion: props.POBTOTAL || 0,
                        hogaresIndigenas: props.PIHOGARES || 0,
                        distanciaPresa: (item.distance / 1000).toFixed(2),
                        sitioRamsar: ramsarCercano ? `${ramsarCercano} (${(distanciaRamsarMin / 1000).toFixed(2)} km)` : null,
                        areaNatural: anpCercana ? `${anpCercana} (${(distanciaANPMin / 1000).toFixed(2)} km)` : null,
                        areaVoluntaria: advcCercana ? `${advcCercana} (${(distanciaADVCMin / 1000).toFixed(2)} km)` : null,
                        distanciaRio: distanciaRio !== null ? `${distanciaRio.toFixed(2)} km` : null
                    });

                    // Crear marcador para localidad indígena
                    const marker = L.circleMarker([coords[1], coords[0]], {
                        radius: 6,
                        fillColor: '#FFA726',
                        color: '#F57C00',
                        weight: 2,
                        fillOpacity: 0.8
                    });

                    // Calcular porcentaje de hogares indígenas
                    const porcHogares = props.pPIHOGARES || 0;
                    const esAltamenteIndigena = porcHogares >= 40;

                    // Crear popup con información mejorado
                    const popupContent = `
                        <div style="font-family: 'Montserrat', sans-serif; max-width: 260px; line-height: 1.4;">
                            <div style="display: flex; gap: 10px; justify-content: space-between;">
                                <div style="flex: 1;">
                                    <div style="font-size: 14px; font-weight: 700; color: #BF360C;">
                                        ${props.LOCALIDAD || 'Localidad sin nombre'}
                                    </div>
                                    <div style="font-size: 11px; color: #777;">
                                        ${props.MUNICIPIO || 'Municipio N/D'}, ${props.ENTIDAD || 'Entidad N/D'}
                                    </div>
                                    ${props.cvegeo ? `
                                        <div style="font-size: 10px; color: #9E9E9E; font-family: monospace;">
                                            CVE: ${props.cvegeo}
                                        </div>
                                    ` : ''}
                                </div>
                                <div style="background: #FFE0B2; color: #C75B12; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; align-self: flex-start;">
                                    ${(item.distance / 1000).toFixed(1)} km
                                </div>
                            </div>

                            <div style="margin-top: 10px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;">
                                <div style="background: #FFF3E0; border-radius: 6px; padding: 8px;">
                                    <div style="font-size: 10px; text-transform: uppercase; color: #9E9E9E;">Población</div>
                                    <div style="font-size: 16px; font-weight: 700; color: #BF360C;">
                                        ${(props.POBTOTAL || 0).toLocaleString('es-MX')}
                                    </div>
                                </div>
                                <div style="background: #FFE0B2; border-radius: 6px; padding: 8px;">
                                    <div style="font-size: 10px; text-transform: uppercase; color: #9E9E9E;">Hogares Ind.</div>
                                    <div style="font-size: 16px; font-weight: 700; color: #BF360C;">
                                        ${(props.PIHOGARES || 0).toLocaleString('es-MX')}
                                    </div>
                                </div>
                            </div>

                            <div style="margin-top: 8px; padding: 8px; border-radius: 6px; background: ${esAltamenteIndigena ? '#E8F5E9' : '#FFF8E1'}; border-left: 3px solid ${esAltamenteIndigena ? '#2E7D32' : '#FFA726'};">
                                <div style="font-size: 12px; font-weight: 600; color: ${esAltamenteIndigena ? '#2E7D32' : '#C75B12'};">
                                    ${porcHogares.toFixed(1)}% hogares indígenas
                                </div>
                                ${props.TIPOLOC_PI ? `<div style="font-size: 10px; color: #777;">${props.TIPOLOC_PI}</div>` : ''}
                            </div>

                            ${props.POB_AFRO && props.POB_AFRO > 0 ? `
                                <div style="margin-top: 8px; padding: 8px; border-radius: 6px; background: #F3E5F5;">
                                    <div style="font-size: 11px; font-weight: 600; color: #6A1B9A;">
                                        Pob. afro: ${(props.POB_AFRO || 0).toLocaleString('es-MX')}
                                    </div>
                                    ${props.pPOB_AFRO ? `<div style="font-size: 10px; color: #6A1B9A;">${props.pPOB_AFRO.toFixed(1)}% del total</div>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;

                    marker.bindPopup(popupContent);
                    marker.addTo(presasAnalysisLayer);
                });
            }
        });

        // Actualizar panel de descripción con información detallada
        updateAnalysisDescriptionPanel(analysisStats);

        // Mostrar resumen estadístico en consola
        console.log('📊 Resumen del Análisis:');
        console.log(`   • Radio: ${analysisStats.radioKm} km`);
        if (analysisStats.totalLocalidades > 0) {
            console.log(`   • Localidades encontradas: ${analysisStats.totalLocalidades}`);
            console.log(`   • Población total: ${analysisStats.poblacionTotal.toLocaleString('es-MX')}`);
            console.log(`   • Hogares indígenas: ${analysisStats.hogaresIndigenas.toLocaleString('es-MX')}`);
            if (analysisStats.poblacionAfro > 0) {
                console.log(`   • Población afrodescendiente: ${analysisStats.poblacionAfro.toLocaleString('es-MX')}`);
            }
        }
        if (analysisStats.sitiosRamsar.length > 0) {
            console.log(`   • Sitios Ramsar: ${analysisStats.sitiosRamsar.length}`);
            analysisStats.sitiosRamsar.forEach(ramsar => {
                const status = ramsar.intersecta ? '(DENTRO)' : `(${(ramsar.distancia / 1000).toFixed(2)} km)`;
                console.log(`     - ${ramsar.nombre} ${status}`);
            });
        }
        if (analysisStats.distanciaRioUsumacinta !== null) {
            console.log(`   • Río Usumacinta: ${(analysisStats.distanciaRioUsumacinta / 1000).toFixed(2)} km`);
        }

        if (analysisStats.totalLocalidades > 0 || analysisStats.sitiosRamsar.length > 0 || analysisStats.distanciaRioUsumacinta !== null) {

            // Crear panel de resumen flotante (solo en desktop)
            const isMobile = window.innerWidth < 768;
            if (!isMobile) {
                const summaryPanel = L.control({ position: 'bottomright' });
                summaryPanel.onAdd = function () {
                    const div = L.DomUtil.create('div', 'analysis-summary-panel');
                    div.innerHTML = `
                    <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.3); min-width: 300px; max-width: 350px; font-family: 'Montserrat', sans-serif; max-height: 80vh; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="margin: 0; color: #601623; font-size: 14px;">
                                <i class="bi bi-graph-up"></i> Análisis Espacial
                            </h4>
                            <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                    style="background: none; border: none; cursor: pointer; font-size: 18px; color: #999;">
                                ×
                            </button>
                        </div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
                            <strong>${presaNombre}</strong> • Radio: ${analysisStats.radioKm} km
                        </div>
                        <hr style="margin: 10px 0; border: none; border-top: 1px solid #eee;">
                        
                        ${analysisStats.totalLocalidades > 0 ? `
                            <div style="margin-bottom: 15px;">
                                <h5 style="margin: 0 0 8px 0; color: #FFA726; font-size: 13px;">
                                    <i class="bi bi-people-fill"></i> Localidades Indígenas
                                </h5>
                                <div style="font-size: 13px; line-height: 1.8; padding-left: 10px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                        <span><i class="bi bi-geo-alt-fill"></i> Total:</span>
                                        <strong>${analysisStats.totalLocalidades}</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                        <span><i class="bi bi-people"></i> Población:</span>
                                        <strong>${analysisStats.poblacionTotal.toLocaleString('es-MX')}</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                        <span><i class="bi bi-house"></i> Hogares Ind.:</span>
                                        <strong>${analysisStats.hogaresIndigenas.toLocaleString('es-MX')}</strong>
                                    </div>
                                    ${analysisStats.poblacionAfro > 0 ? `
                                        <div style="display: flex; justify-content: space-between;">
                                            <span><i class="bi bi-people"></i> Pob. Afro:</span>
                                            <strong>${analysisStats.poblacionAfro.toLocaleString('es-MX')}</strong>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${analysisStats.sitiosRamsar.length > 0 ? `
                            <div style="margin-bottom: 15px;">
                                <h5 style="margin: 0 0 8px 0; color: #4CAF50; font-size: 13px;">
                                    <i class="bi bi-tree-fill"></i> Sitios Ramsar (${analysisStats.sitiosRamsar.length})
                                </h5>
                                <div style="font-size: 12px; line-height: 1.6; padding-left: 10px;">
                                    ${analysisStats.sitiosRamsar.map(ramsar => `
                                        <div style="margin-bottom: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid ${ramsar.intersecta ? '#4CAF50' : '#FFA726'};">
                                            <div style="font-weight: 600; color: #333;">${ramsar.nombre}</div>
                                            <div style="color: #666; font-size: 11px; margin-top: 2px;">
                                                ${ramsar.estado} • ${ramsar.municipios}
                                            </div>
                                            <div style="color: ${ramsar.intersecta ? '#4CAF50' : '#666'}; font-size: 11px; margin-top: 3px; font-weight: 600;">
                                                ${ramsar.intersecta ? '✓ La presa está DENTRO del sitio' : `📍 ${(ramsar.distancia / 1000).toFixed(2)} km de distancia`}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${analysisStats.distanciaRioUsumacinta !== null ? `
                            <div style="margin-bottom: 15px;">
                                <h5 style="margin: 0 0 8px 0; color: #0288D1; font-size: 13px;">
                                    <i class="bi bi-water"></i> Río Usumacinta
                                </h5>
                                <div style="font-size: 13px; line-height: 1.8; padding-left: 10px;">
                                    <div style="display: flex; justify-content: space-between;">
                                        <span><i class="bi bi-rulers"></i> Distancia:</span>
                                        <strong>${(analysisStats.distanciaRioUsumacinta / 1000).toFixed(2)} km</strong>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${analysisStats.totalLocalidades === 0 && analysisStats.sitiosRamsar.length === 0 && analysisStats.distanciaRioUsumacinta === null ? `
                            <div style="text-align: center; padding: 20px; color: #999;">
                                <i class="bi bi-info-circle" style="font-size: 32px; display: block; margin-bottom: 10px;"></i>
                                <p style="margin: 0; font-size: 13px;">No se encontraron recursos en el radio de búsqueda</p>
                            </div>
                        ` : ''}
                    </div>
                `;
                    return div;
                };
                summaryPanel.addTo(map);
            }
        }

        // Completar barra de progreso al 100% en AMBOS preloaders
        const progressBars = document.querySelectorAll('.progress-fill');
        const progressTexts = document.querySelectorAll('#preloader p, #map-preloader p');

        progressBars.forEach(bar => bar.style.width = '100%');
        progressTexts.forEach(txt => txt.textContent = '¡Análisis completado!');

        // OCULTAR AMBOS PRELOADERS después de una breve pausa para mostrar el 100%
        setTimeout(() => {
            togglePreloader(false);
            console.log('✅ Análisis completado - Preloaders ocultados');
        }, 300);
    }

    // Funciones globales para el popup de presas con radio dinámico
    // FORZAR sobreescritura de cualquier definición previa
    window.radiusPreviewCircle = null;

    // ELIMINAR cualquier definición previa
    delete window.analyzePresaClick;

    // Definir la función CORRECTA
    window.analyzePresaClick = function (presaNombre, lat, lng, radius) {
        console.log('📥 Parámetros recibidos:', { presaNombre, lat, lng, radius, tipo: typeof radius });

        // Convertir radio de km a metros
        const radiusValue = radius ? parseInt(radius) : 10;
        const radiusInMeters = radiusValue * 1000;

        // IMPORTANTE: Actualizar AMBAS variables (local y global)
        currentSearchRadius = radiusInMeters;
        window.currentSearchRadius = radiusInMeters;
        currentPresaSelected = { name: presaNombre, latlng: L.latLng(lat, lng) };

        console.log(`🎯 Análisis iniciado: ${presaNombre}, Radio seleccionado: ${radiusValue} km (${radiusInMeters} metros)`);
        console.log(`✅ currentSearchRadius (local) actualizado a: ${currentSearchRadius} metros`);
        console.log(`✅ window.currentSearchRadius (global) actualizado a: ${window.currentSearchRadius} metros`);

        // Remover círculo de previsualización
        if (window.radiusPreviewCircle) {
            map.removeLayer(window.radiusPreviewCircle);
            window.radiusPreviewCircle = null;
        }

        // Cerrar popup
        map.closePopup();

        // VERIFICAR valor antes de ejecutar análisis
        console.log(`🚀 Ejecutando análisis con currentSearchRadius = ${currentSearchRadius} metros`);

        // Ejecutar análisis
        analyzePresaResources(L.latLng(lat, lng), presaNombre);
    };

    console.log('✅ window.analyzePresaClick definida correctamente en map-config.js');

    window.updateRadiusPreview = function (radiusKm, lat, lng) {
        // Remover círculo anterior
        if (window.radiusPreviewCircle) {
            map.removeLayer(window.radiusPreviewCircle);
        }

        // Crear nuevo círculo de previsualización
        window.radiusPreviewCircle = L.circle([lat, lng], {
            radius: radiusKm * 1000,
            color: '#4CAF50',
            fillColor: '#4CAF50',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '5, 5',
            interactive: false
        }).addTo(map);

        // Ajustar vista para mostrar el círculo completo
        const circleBounds = window.radiusPreviewCircle.getBounds();
        map.fitBounds(circleBounds, { padding: [50, 50], maxZoom: 10 });
    };

    // Función específica para cargar presas con icono personalizado
    async function loadPresasGeoJSON(url, options) {
        const showPreloader = !(options && options.silent);
        const mapConfig = options && options.mapConfig;

        console.log('🔵 loadPresasGeoJSON iniciando:', url);

        if (showPreloader) {
            togglePreloader(true);
        }

        try {
            const response = await fetch(url);
            const data = await response.json();

            console.log('🔵 Presas GeoJSON cargado:', data.features ? data.features.length : 0, 'features');

            // Cargar dataLayers si existen
            if (mapConfig && mapConfig.dataLayers) {
                await loadPresasDataLayers(mapConfig.dataLayers);
            }

            // Limpiar capas anteriores
            instrumentLayerGroup.clearLayers();

            // Crear icono personalizado con HTML para asegurar visibilidad
            const createPresaIcon = function () {
                return L.divIcon({
                    className: 'custom-presa-icon',
                    html: `
                        <div style="position: relative; width: 40px; height: 40px;">
                            <img src="https://cdn.sassoapps.com/iconos/represa.png" 
                                 style="width: 40px; height: 40px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                            <div style="display: none; width: 32px; height: 32px; background: var(--color-gobmx-guinda); 
                                        border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(155,34,71,0.4);
                                        position: absolute; top: 4px; left: 4px;">
                                <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                                             font-size: 20px; color: white;">💧</span>
                            </div>
                        </div>
                    `,
                    iconSize: [40, 40],
                    iconAnchor: [20, 40],
                    popupAnchor: [0, -40]
                });
            };

            // Crear capa GeoJSON con iconos personalizados
            const presasLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return L.marker(latlng, {
                        icon: createPresaIcon(),
                        pane: 'electricityMarkersPane'
                    });
                },
                onEachFeature: function (feature, layer) {
                    const props = feature.properties || {};

                    // El nombre está en el campo "id"
                    const nombrePresa = props.id || props.nombre || props.NOMBRE || props.name || 'Presa';
                    const numero = props.no || props.NO || '';
                    const latitud = props.lat ? props.lat.toFixed(6) : '';
                    const longitud = props.lon ? props.lon.toFixed(6) : '';

                    // Verificar si hay dataLayers disponibles para análisis
                    const hasDataLayers = Object.keys(presasDataLayers).length > 0;

                    // ID seguro para el selector
                    const presaId = nombrePresa.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

                    // Crear popup compacto con selector de radio dinámico
                    const popupContent = `
                        <div class="presa-popup-content">
                            <div class="presa-popup-header">
                                <i class="bi bi-water presa-popup-icon"></i>
                                <h4 class="presa-popup-title" title="${nombrePresa}">${nombrePresa}</h4>
                            </div>
                            <div class="presa-popup-body">
                                ${hasDataLayers ? `
                                    <div class="presa-popup-control">
                                        <i class="bi bi-bullseye"></i>
                                        <select id="radio-select-${presaId}" 
                                                class="presa-popup-select"
                                                onchange="window.updateRadiusPreview(this.value, ${feature.geometry.coordinates[1]}, ${feature.geometry.coordinates[0]})">
                                            <option value="5">Radio: 5 km</option>
                                            <option value="10" selected>Radio: 10 km</option>
                                            <option value="15">Radio: 15 km</option>
                                            <option value="20">Radio: 20 km</option>
                                            <option value="30">Radio: 30 km</option>
                                            <option value="50">Radio: 50 km</option>
                                        </select>
                                    </div>
                                    <button onclick="(function() { try { console.log('🔘 INICIO botón'); const popup = document.querySelector('.leaflet-popup-content'); console.log('popup:', popup); const select = popup ? popup.querySelector('select[id^=\\'radio-select-\\']') : null; console.log('select:', select); const radio = select ? select.value : 10; console.log('🔘 Radio capturado:', radio, 'tipo:', typeof radio); if (typeof window.analyzePresaClick !== 'function') { console.error('❌ window.analyzePresaClick NO existe'); return; } console.log('✅ Llamando window.analyzePresaClick'); window.analyzePresaClick('${nombrePresa.replace(/'/g, "\\'")}', ${feature.geometry.coordinates[1]}, ${feature.geometry.coordinates[0]}, radio); } catch(e) { console.error('❌ ERROR en botón:', e); } })()" class="presa-popup-btn">
                                        <i class="bi bi-search"></i>
                                        <span>Analizar Recursos</span>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;

                    const popup = layer.bindPopup(popupContent, {
                        maxWidth: 240,
                        minWidth: 200,
                        className: 'presa-popup-compact'
                    });

                    // Limpiar círculo de previsualización cuando se cierre el popup
                    layer.on('popupclose', function () {
                        if (window.radiusPreviewCircle) {
                            map.removeLayer(window.radiusPreviewCircle);
                            window.radiusPreviewCircle = null;
                        }
                    });
                }
            });

            instrumentLayerGroup.addLayer(presasLayer);

            // Exponer la capa globalmente para el buscador móvil
            window.presasDataLayers = presasLayer;

            console.log(`✅ Presas agregadas a instrumentLayerGroup:`, data.features ? data.features.length : 0, 'presas');
            console.log('🔵 Capas actuales en instrumentLayerGroup:', instrumentLayerGroup.getLayers().length);

            // Centrar mapa en las presas cargadas
            try {
                const bounds = presasLayer.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, {
                        padding: [50, 50],
                        maxZoom: 7
                    });
                    console.log('🗺️ Mapa centrado en las presas');
                }
            } catch (error) {
                console.warn('No se pudo centrar el mapa en las presas:', error);
            }

        } catch (error) {
            console.error('❌ Error cargando presas:', error);
        } finally {
            if (showPreloader) {
                togglePreloader(false);
            }
        }
    }

    // ELIMINADO: Función vieja que sobrescribía la nueva (movida a línea 4795)
    // La función window.analyzePresaClick ahora se define ANTES en el código (línea ~4795)
    // con soporte para el parámetro "radius"

    function createGradientPattern(color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const size = 200;
        canvas.width = size;
        canvas.height = size;

        const lighterColor = lightenColor(color, 40);
        const gradient = context.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, lighterColor);

        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);

        return canvas;
    }

    function lightenColor(hex, percent) {
        hex = hex.replace(/[^0-9a-f]/gi, '');
        if (hex.length < 6) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        percent = percent || 0;

        var rgb = "#", c, i;
        for (i = 0; i < 3; i++) {
            c = parseInt(hex.substr(i * 2, 2), 16);
            c = Math.round(Math.min(Math.max(0, c + (c * percent / 100)), 255)).toString(16);
            rgb += ("00" + c).substr(c.length);
        }

        return rgb;
    }

    function darkenColor(hex, percent) {
        let f = parseInt(hex.slice(1), 16),
            R = f >> 16,
            G = (f >> 8) & 0x00ff,
            B = f & 0x0000ff;
        return "#" + (
            0x1000000 +
            (Math.round((R * (100 - percent)) / 100) * 0x10000) +
            (Math.round((G * (100 - percent)) / 100) * 0x100) +
            (Math.round((B * (100 - percent)) / 100))
        ).toString(16).slice(1);
    }

    async function loadMarinasGeoJSON(url) {
        try {
            const response = await fetch(url);
            const data = await response.json();

            const marinaStyle = {
                fillColor: '#bcd7f6',
                weight: 1,
                opacity: 0.5,
                color: '#8cb4e2',
                fillOpacity: 0.3,
                pane: 'marinasPane'
            };

            const geoJsonLayer = L.geoJSON(data, {
                style: marinaStyle,
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.name) {
                        layer.bindTooltip(feature.properties.name, {
                            permanent: false,
                            direction: 'center',
                            className: 'marina-label'
                        });
                    }
                }
            });
            marinasLayer.addLayer(geoJsonLayer);
        } catch (error) {
            console.error('Error cargando GeoJSON de marinas:', error);
        }
    }


    function updateTimestamp() {
        if (!lastUpdatedEl) {
            return;
        }
        const now = new Date();
        lastUpdatedEl.textContent = now.toLocaleString('es-MX', {
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function drawRows(rows, mapConfig) {
        markersLayer.clearLayers();
        clearInsetMarkers();
        const bounds = [];
        rows.forEach(function (row) {
            const latRaw = row.lat || row.Lat || row.latitude || row.Latitude || row.latitud || '';
            const lngRaw = row.lng || row.Lng || row.lon || row.Lon || row.longitude || row.Longitud || '';
            const lat = parseFloat(latRaw.toString().replace(',', '.'));
            const lng = parseFloat(lngRaw.toString().replace(',', '.'));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            let popup = '';
            if (mapConfig && mapConfig.name === 'Red nacional de gasoductos en 2024') {
                popup = [
                    '<div><strong>Permiso:</strong> ' + (row.NumeroPermiso || 'N/A') + '</div>',
                    '<div><strong>Razón Social:</strong> ' + (row.RazonSocial || 'N/A') + '</div>',
                    '<div><strong>Capacidad (MW):</strong> ' + (row.CapacidadAutorizadaMW || 'N/A') + '</div>',
                    '<div><strong>Generación Anual:</strong> ' + (row.Generación_estimada_anual || 'N/A') + '</div>',
                    '<div><strong>Inversión (mdls):</strong> ' + (row.Inversion_estimada_mdls || 'N/A') + '</div>',
                    '<div><strong>Energético:</strong> ' + (row.Energetico_primario || 'N/A') + '</div>',
                    '<div><strong>Actividad:</strong> ' + (row.Actividad_economica || 'N/A') + '</div>',
                    '<div><strong>Tecnología:</strong> ' + (row.Tecnología || 'N/A') + '</div>',
                    '<div><strong>País de Origen:</strong> ' + (row.PaísDeOrigen || 'N/A') + '</div>',
                    '<div><strong>Tipo de Empresa:</strong> ' + (row.Tipo_Empresa || 'N/A') + '</div>'
                ].join('');
            } else {
                const idValue = row.id || row.ID || row.Id || row.identificador || row.Identificador || '';
                const name = row.name || row.Name || row.nombre || row.Nombre || row.titulo || row.Titulo || 'Registro';
                const description = row.descripcion || row.Descripcion || row.description || row.Description || '';
                const badgeLabel = idValue ? 'ID ' + idValue : 'Hoja';
                popup = [
                    '<div><span class="badge">' + badgeLabel + '</span></div>',
                    '<strong>' + name + '</strong>',
                    description ? '<div class="description">' + description + '</div>' : '',
                    '<small>(' + lat.toFixed(5) + ', ' + lng.toFixed(5) + ')</small>'
                ].filter(Boolean).join('');
            }

            let markerOptions = getNodeMarkerOptions(true);
            if (mapConfig && mapConfig.name === 'Red nacional de gasoductos en 2024') {
                markerOptions.radius = 6;
            }

            const marker = L.circleMarker([lat, lng], markerOptions);
            marker.bindPopup(popup);
            if (row.id || row.ID || row.Id) {
                marker.bindTooltip(String(row.id || row.ID || row.Id), {
                    permanent: true,
                    direction: 'top',
                    className: 'node-label',
                    offset: [0, -6]
                });
            }
            marker.addTo(markersLayer);
            if (insetControllers.length) {
                insetControllers.forEach(controller => {
                    const insetMarkerOptions = getNodeMarkerOptions(false);
                    const insetMarker = L.circleMarker([lat, lng], insetMarkerOptions);
                    insetMarker.bindPopup(popup);
                    if (row.id || row.ID || row.Id) {
                        insetMarker.bindTooltip(String(row.id || row.ID || row.Id), {
                            permanent: true,
                            direction: 'top',
                            className: 'node-label',
                            offset: [0, -6]
                        });
                    }
                    controller.markersLayer.addLayer(insetMarker);
                    if (typeof controller.markersLayer.bringToFront === 'function') {
                        controller.markersLayer.bringToFront();
                    }
                });
            }
            bounds.push([lat, lng]);
        });
        // Don't auto-fit bounds, keep the default center and zoom
        // if (bounds.length) {
        //     const calculatedBounds = L.latLngBounds(bounds);
        //     map.fitBounds(bounds.length === 1 ? calculatedBounds.pad(0.25) : calculatedBounds.pad(0.2));
        // }
    }

    // Electricity filters and statistics functions

    // Function to load and display GCR layer with highlighting
    function showGCRLayer(highlightGCR = null) {
        console.log('showGCRLayer called with:', highlightGCR);

        // FORCE remove States layer completely
        if (statesLayerGroup) {
            console.log('FORCE Removing States layer');
            try {
                map.removeLayer(statesLayerGroup);
            } catch (e) {
                console.warn('Error removing states layer:', e);
            }
            statesLayerGroup = null;
        }

        // FORCE remove existing GCR layer completely
        if (gcrLayerGroup) {
            console.log('FORCE Removing existing GCR layer');
            try {
                map.removeLayer(gcrLayerGroup);
            } catch (e) {
                console.warn('Error removing GCR layer:', e);
            }
            gcrLayerGroup = null;
        }

        // Double check - remove all layers from gerenciasPane
        map.eachLayer(function (layer) {
            if (layer.options && layer.options.pane === 'gerenciasPane') {
                console.log('Found stray layer in gerenciasPane, removing');
                map.removeLayer(layer);
            }
        });

        if (!gcrGeometries) {
            console.warn('GCR geometries not loaded');
            return;
        }

        console.log('Creating NEW GCR layer with highlighting:', highlightGCR);

        gcrLayerGroup = L.geoJSON(gcrGeometries, {
            style: function (feature) {
                const isHighlighted = highlightGCR && feature.properties.name === highlightGCR;

                return {
                    fillColor: isHighlighted ? '#1f7a62' : '#ffffff',
                    fillOpacity: isHighlighted ? 0.8 : 0.05,
                    color: isHighlighted ? '#0A4F3D' : '#cbd5e0',
                    weight: isHighlighted ? 5 : 1.5,
                    opacity: isHighlighted ? 1 : 0.3,
                    dashArray: isHighlighted ? '' : '3, 3'
                };
            },
            onEachFeature: function (feature, layer) {
                const gcrName = feature.properties.name;

                // Tooltip
                layer.bindTooltip(gcrName, {
                    permanent: false,
                    direction: 'center',
                    className: 'gcr-tooltip'
                });

                // Click to filter
                layer.on('click', function (e) {
                    L.DomEvent.stopPropagation(e);
                    filterElectricityPermits('gcr', gcrName);

                    document.querySelectorAll('#gcr-cards .filter-card').forEach(card => {
                        if (card.dataset.filterValue === gcrName) {
                            card.classList.add('active');
                            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        } else {
                            card.classList.remove('active');
                        }
                    });
                });
            },
            pane: 'gerenciasPane'
        }).addTo(map);

        console.log('GCR layer added to map - bringing to back');

        if (gcrLayerGroup) {
            gcrLayerGroup.bringToBack();
        }
    }

    // Function to load and display States layer with highlighting
    function showStatesLayer(highlightState = null) {
        console.log('showStatesLayer called with:', highlightState);

        // FORCE remove GCR layer completely
        if (gcrLayerGroup) {
            console.log('FORCE Removing GCR layer');
            try {
                map.removeLayer(gcrLayerGroup);
            } catch (e) {
                console.warn('Error removing GCR layer:', e);
            }
            gcrLayerGroup = null;
        }

        // FORCE remove existing States layer completely
        if (statesLayerGroup) {
            console.log('FORCE Removing existing States layer');
            try {
                map.removeLayer(statesLayerGroup);
            } catch (e) {
                console.warn('Error removing states layer:', e);
            }
            statesLayerGroup = null;
        }

        // Double check - remove all layers from gerenciasPane
        map.eachLayer(function (layer) {
            if (layer.options && layer.options.pane === 'gerenciasPane') {
                console.log('Found stray layer in gerenciasPane, removing');
                map.removeLayer(layer);
            }
        });

        // Load states GeoJSON if not loaded
        if (!statesGeometries) {
            console.log('Loading states GeoJSON...');
            fetch('https://cdn.sassoapps.com/Mapas/Electricidad/estados.geojson')
                .then(response => {
                    console.log('States GeoJSON response:', response.status);
                    return response.json();
                })
                .then(data => {
                    console.log('States geometries loaded:', data.features.length, 'states');
                    statesGeometries = data;
                    displayStatesLayer(highlightState);
                })
                .catch(error => {
                    console.error('Error loading States geometries:', error);
                });
        } else {
            console.log('States geometries already loaded, displaying...');
            displayStatesLayer(highlightState);
        }
    }

    function displayStatesLayer(highlightState) {
        console.log('displayStatesLayer called with:', highlightState);

        if (!statesGeometries) {
            console.error('States geometries not loaded!');
            return;
        }

        console.log('Creating NEW states layer with', statesGeometries.features?.length, 'features');

        // Helper function to normalize state names for comparison
        function normalizeStateName(name) {
            if (!name) return '';
            // Remove leading numbers and spaces (e.g., "09 CDMX" -> "CDMX")
            return name.replace(/^\d+\s*/, '').trim().toUpperCase();
        }

        // Helper function to get the main state name (without "de Zaragoza", etc.)
        function getMainStateName(name) {
            const normalized = normalizeStateName(name);
            // Remove common suffixes
            return normalized
                .replace(/\s+DE\s+ZARAGOZA$/i, '')
                .replace(/\s+DE\s+JUAREZ$/i, '')
                .replace(/\s+DE\s+IGNACIO\s+DE\s+LA\s+LLAVE$/i, '')
                .trim();
        }

        const normalizedHighlight = normalizeStateName(highlightState);
        const mainHighlight = getMainStateName(highlightState);

        statesLayerGroup = L.geoJSON(statesGeometries, {
            style: function (feature) {
                const stateName = feature.properties.name || feature.properties.NOMGEO || feature.properties.NOM_ENT || feature.properties.estado;
                const normalizedStateName = normalizeStateName(stateName);
                const mainStateName = getMainStateName(stateName);

                // Check if highlighted using flexible matching
                let isHighlighted = false;
                if (highlightState) {
                    // Try exact match first
                    if (normalizedStateName === normalizedHighlight) {
                        isHighlighted = true;
                    }
                    // Try main name match (Coahuila matches Coahuila de Zaragoza)
                    else if (mainStateName === mainHighlight) {
                        isHighlighted = true;
                    }
                    // Try partial match in both directions
                    else if (normalizedStateName.includes(mainHighlight) ||
                        mainHighlight.includes(normalizedStateName)) {
                        isHighlighted = true;
                    }
                }

                console.log('State:', stateName, '| Normalized:', normalizedStateName, '| Main:', mainStateName, '| Highlight?', isHighlighted);

                return {
                    fillColor: isHighlighted ? '#601623' : '#ffffff',
                    fillOpacity: isHighlighted ? 0.85 : 0.08,
                    color: isHighlighted ? '#C41E3A' : '#cbd5e0',
                    weight: isHighlighted ? 5 : 1.5,
                    opacity: isHighlighted ? 1 : 0.4,
                    dashArray: isHighlighted ? '' : '3, 3'
                };
            },
            onEachFeature: function (feature, layer) {
                const stateName = feature.properties.name || feature.properties.NOMGEO || feature.properties.NOM_ENT || feature.properties.estado;

                if (stateName) {
                    layer.bindTooltip(stateName, {
                        permanent: false,
                        direction: 'center',
                        className: 'state-tooltip'
                    });

                    layer.on('click', function (e) {
                        L.DomEvent.stopPropagation(e);

                        console.log('State clicked:', stateName);

                        // Helper function to normalize state names
                        function normalizeStateName(name) {
                            if (!name) return '';
                            return name.replace(/^\d+\s*/, '').trim().toUpperCase();
                        }

                        // Helper function to get the main state name (without "de Zaragoza", etc.)
                        function getMainStateName(name) {
                            const normalized = normalizeStateName(name);
                            // Remove common suffixes
                            return normalized
                                .replace(/\s+DE\s+ZARAGOZA$/i, '')
                                .replace(/\s+DE\s+JUAREZ$/i, '')
                                .replace(/\s+DE\s+IGNACIO\s+DE\s+LA\s+LLAVE$/i, '')
                                .trim();
                        }

                        const normalizedClickedState = normalizeStateName(stateName);
                        const mainClickedState = getMainStateName(stateName);

                        console.log('Normalized:', normalizedClickedState, '| Main:', mainClickedState);

                        // Find matching state in data
                        const matchingState = Object.keys(electricityStats.byState).find(state => {
                            const normalizedDataState = normalizeStateName(state);
                            const mainDataState = getMainStateName(state);

                            // Try exact match first
                            if (normalizedDataState === normalizedClickedState) return true;

                            // Try main name match (Coahuila matches Coahuila de Zaragoza)
                            if (mainDataState === mainClickedState) return true;

                            // Try partial match in both directions
                            if (normalizedDataState.includes(mainClickedState) ||
                                mainClickedState.includes(normalizedDataState)) return true;

                            return false;
                        });

                        console.log('Matching state in data:', matchingState);

                        if (matchingState) {
                            filterElectricityPermits('state', matchingState);

                            document.querySelectorAll('#state-cards .filter-card').forEach(card => {
                                if (card.dataset.filterValue === matchingState) {
                                    card.classList.add('active');
                                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                } else {
                                    card.classList.remove('active');
                                }
                            });
                        }
                    });
                }
            },
            pane: 'gerenciasPane'
        }).addTo(map);

        console.log('States layer added to map - bringing to back');

        if (statesLayerGroup) {
            statesLayerGroup.bringToBack();
        }
    }

    // Function to hide both layers
    function hideGeometryLayers() {
        console.log('hideGeometryLayers called - FORCE removing all');

        // FORCE remove GCR
        if (gcrLayerGroup) {
            console.log('FORCE Removing GCR layer');
            try {
                map.removeLayer(gcrLayerGroup);
            } catch (e) {
                console.warn('Error removing GCR layer:', e);
            }
            gcrLayerGroup = null;
        }

        // FORCE remove States
        if (statesLayerGroup) {
            console.log('FORCE Removing States layer');
            try {
                map.removeLayer(statesLayerGroup);
            } catch (e) {
                console.warn('Error removing states layer:', e);
            }
            statesLayerGroup = null;
        }

        // Clean up any stray layers in gerenciasPane
        let removed = 0;
        map.eachLayer(function (layer) {
            if (layer.options && layer.options.pane === 'gerenciasPane') {
                console.log('Found stray layer in gerenciasPane, removing');
                map.removeLayer(layer);
                removed++;
            }
        });

        console.log('All geometry layers hidden. Removed', removed, 'stray layers');
    }

    // Function to assign permits to GCRs using Turf.js spatial analysis
    function assignPermitsToGCR(data, gcrGeoJSON) {
        const assignments = {};

        if (!gcrGeoJSON || !gcrGeoJSON.features) {
            console.warn('GCR GeoJSON not loaded');
            return assignments;
        }

        data.forEach(row => {
            const latRaw = row.lat || row.Lat || row.latitude || row.Latitude || row.latitud || '';
            const lngRaw = row.lng || row.Lng || row.lon || row.Lon || row.longitude || row.Longitud || '';
            const lat = parseFloat(latRaw.toString().replace(',', '.'));
            const lng = parseFloat(lngRaw.toString().replace(',', '.'));

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            // Create point using Turf
            const point = turf.point([lng, lat]);

            // Check which GCR polygon contains this point
            for (const feature of gcrGeoJSON.features) {
                const gcrName = feature.properties.name;

                try {
                    if (turf.booleanPointInPolygon(point, feature)) {
                        if (!assignments[gcrName]) {
                            assignments[gcrName] = [];
                        }
                        assignments[gcrName].push(row);
                        break; // Stop after finding the first match
                    }
                } catch (e) {
                    console.warn('Error checking point in polygon:', e);
                }
            }
        });

        return assignments;
    }

    function calculateElectricityStats(data) {
        const stats = {
            byState: {}, // By Estado (EfId)
            byGCR: {}, // By GCR (spatial)
            byTech: {},
            matrix: {}, // GCR x Technology
            totals: {
                capacity: 0,
                generation: 0,
                count: 0
            }
        };

        // Calculate by State and Technology
        data.forEach(row => {
            const capacity = parseFloat(row.CapacidadAutorizadaMW) || 0;
            const generation = parseFloat(row.Generación_estimada_anual) || 0;
            const state = (row.EfId || 'Sin Estado').trim();
            const tech = (row.Tecnología || 'Sin Tecnología').trim();

            // Totals
            stats.totals.capacity += capacity;
            stats.totals.generation += generation;
            stats.totals.count++;

            // By State (EfId)
            if (!stats.byState[state]) {
                stats.byState[state] = { capacity: 0, generation: 0, count: 0 };
            }
            stats.byState[state].capacity += capacity;
            stats.byState[state].generation += generation;
            stats.byState[state].count++;

            // By Technology
            if (!stats.byTech[tech]) {
                stats.byTech[tech] = { capacity: 0, generation: 0, count: 0 };
            }
            stats.byTech[tech].capacity += capacity;
            stats.byTech[tech].generation += generation;
            stats.byTech[tech].count++;
        });

        // Calculate by GCR using spatial analysis with Turf.js
        if (gcrGeometries) {
            const gcrAssignments = assignPermitsToGCR(data, gcrGeometries);

            Object.keys(gcrAssignments).forEach(gcrName => {
                const permits = gcrAssignments[gcrName];
                stats.byGCR[gcrName] = {
                    capacity: 0,
                    generation: 0,
                    count: permits.length,
                    technologies: {}
                };

                permits.forEach(row => {
                    const capacity = parseFloat(row.CapacidadAutorizadaMW) || 0;
                    const generation = parseFloat(row.Generación_estimada_anual) || 0;
                    const tech = (row.Tecnología || 'Sin Tecnología').trim();

                    stats.byGCR[gcrName].capacity += capacity;
                    stats.byGCR[gcrName].generation += generation;

                    // Track by technology within this GCR
                    if (!stats.byGCR[gcrName].technologies[tech]) {
                        stats.byGCR[gcrName].technologies[tech] = {
                            capacity: 0,
                            generation: 0,
                            count: 0
                        };
                    }
                    stats.byGCR[gcrName].technologies[tech].capacity += capacity;
                    stats.byGCR[gcrName].technologies[tech].generation += generation;
                    stats.byGCR[gcrName].technologies[tech].count++;
                });
            });

            // Create matrix (for easy access)
            stats.matrix = stats.byGCR;
        }

        return stats;
    }

    function updateElectricityTotals(stats) {
        const capacityEl = document.getElementById('total-capacity');
        const generationEl = document.getElementById('total-generation');
        const permitsEl = document.getElementById('total-permits');

        if (capacityEl) {
            capacityEl.textContent = stats.totals.capacity.toLocaleString('es-MX', { maximumFractionDigits: 2 }) + ' MW';
        }
        if (generationEl) {
            generationEl.textContent = stats.totals.generation.toLocaleString('es-MX', { maximumFractionDigits: 2 }) + ' GWh';
        }
        if (permitsEl) {
            permitsEl.textContent = stats.totals.count.toLocaleString('es-MX');
        }
    }

    function createFilterCards(stats, type) {
        let container, data;

        if (type === 'state') {
            container = document.getElementById('state-cards');
            data = stats.byState;
        } else if (type === 'gcr') {
            container = document.getElementById('gcr-cards');
            data = stats.byGCR;
        } else {
            container = document.getElementById('tech-cards');
            data = stats.byTech;
        }

        if (!container) return;

        container.innerHTML = '';

        const sortedKeys = Object.keys(data).sort((a, b) => data[b].capacity - data[a].capacity);

        sortedKeys.forEach(key => {
            const item = data[key];
            const card = document.createElement('div');
            card.className = 'filter-card';
            card.dataset.filterType = type;
            card.dataset.filterValue = key;

            card.innerHTML = `
                <div class="filter-card-header">
                    <div class="filter-card-title">${key}</div>
                    <div class="filter-card-count">${item.count}</div>
                </div>
                <div class="filter-card-stats">
                    <div class="filter-stat">
                        <span class="filter-stat-label">⚡ Capacidad:</span>
                        <span class="filter-stat-value">${item.capacity.toLocaleString('es-MX', { maximumFractionDigits: 2 })} MW</span>
                    </div>
                    <div class="filter-stat">
                        <span class="filter-stat-label">🔋 Generación:</span>
                        <span class="filter-stat-value">${item.generation.toLocaleString('es-MX', { maximumFractionDigits: 2 })} GWh</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', function () {
                filterElectricityPermits(type, key);

                // Update active state
                container.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
            });

            container.appendChild(card);
        });
    }

    function createMatrixView(stats) {
        const container = document.getElementById('matrix-view');
        if (!container) return;

        container.innerHTML = '';

        if (!stats.byGCR || Object.keys(stats.byGCR).length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--color-muted); padding: 40px;">No hay datos de GCR disponibles. Asegúrate de que el GeoJSON esté cargado.</p>';
            return;
        }

        // Sort GCRs by capacity
        const sortedGCRs = Object.keys(stats.byGCR).sort((a, b) =>
            stats.byGCR[b].capacity - stats.byGCR[a].capacity
        );

        sortedGCRs.forEach(gcrName => {
            const gcr = stats.byGCR[gcrName];

            const section = document.createElement('div');
            section.className = 'matrix-gcr-section';

            // Header
            const header = document.createElement('div');
            header.className = 'matrix-gcr-header';
            header.innerHTML = `
                <div class="matrix-gcr-title">${gcrName}</div>
                <div class="matrix-gcr-totals">
                    <div class="matrix-total-item">
                        <span class="matrix-total-label">Permisos</span>
                        <span class="matrix-total-value">${gcr.count}</span>
                    </div>
                    <div class="matrix-total-item">
                        <span class="matrix-total-label">Capacidad</span>
                        <span class="matrix-total-value">${gcr.capacity.toLocaleString('es-MX', { maximumFractionDigits: 2 })} MW</span>
                    </div>
                    <div class="matrix-total-item">
                        <span class="matrix-total-label">Generación</span>
                        <span class="matrix-total-value">${gcr.generation.toLocaleString('es-MX', { maximumFractionDigits: 2 })} GWh</span>
                    </div>
                </div>
            `;

            // Click on header to filter by this GCR
            header.addEventListener('click', function () {
                filterElectricityPermitsByGCRGeometry(gcrName);
            });

            section.appendChild(header);

            // Technology grid
            if (gcr.technologies && Object.keys(gcr.technologies).length > 0) {
                const techGrid = document.createElement('div');
                techGrid.className = 'matrix-tech-grid';

                // Sort technologies by capacity
                const sortedTechs = Object.keys(gcr.technologies).sort((a, b) =>
                    gcr.technologies[b].capacity - gcr.technologies[a].capacity
                );

                sortedTechs.forEach(techName => {
                    const tech = gcr.technologies[techName];

                    const techCard = document.createElement('div');
                    techCard.className = 'matrix-tech-card';
                    techCard.innerHTML = `
                        <div class="matrix-tech-name">${techName}</div>
                        <div class="matrix-tech-stats">
                            <div class="matrix-tech-stat">
                                <span class="matrix-tech-stat-label">Permisos:</span>
                                <span class="matrix-tech-stat-value">${tech.count}</span>
                            </div>
                            <div class="matrix-tech-stat">
                                <span class="matrix-tech-stat-label">Capacidad:</span>
                                <span class="matrix-tech-stat-value">${tech.capacity.toLocaleString('es-MX', { maximumFractionDigits: 2 })} MW</span>
                            </div>
                            <div class="matrix-tech-stat">
                                <span class="matrix-tech-stat-label">Generación:</span>
                                <span class="matrix-tech-stat-value">${tech.generation.toLocaleString('es-MX', { maximumFractionDigits: 2 })} GWh</span>
                            </div>
                        </div>
                    `;

                    // Click on tech card to filter by GCR + Tech
                    techCard.addEventListener('click', function (e) {
                        e.stopPropagation(); // Don't trigger GCR header click
                        filterElectricityPermitsByGCRAndTech(gcrName, techName);
                    });

                    techGrid.appendChild(techCard);
                });

                section.appendChild(techGrid);
            }

            container.appendChild(section);
        });
    }

    function filterElectricityPermits(type, value) {
        if (!markersClusterGroup || !electricityPermitsData.length) return;

        currentFilter = { type, value };

        // Clear search box
        clearSearchBox();

        // Clear existing cluster
        map.removeLayer(markersClusterGroup);
        markersClusterGroup.clearLayers();

        // Show/hide geometry layers based on filter type
        if (type === 'state') {
            showStatesLayer(value);
        } else if (type === 'gcr') {
            showGCRLayer(value);
        } else {
            // For technology filter, hide geometry layers
            hideGeometryLayers();
        }

        // Filter data
        let filteredData;
        if (type === 'state') {
            filteredData = electricityPermitsData.filter(row =>
                (row.EfId || 'Sin Estado').trim() === value
            );
        } else if (type === 'tech') {
            filteredData = electricityPermitsData.filter(row =>
                (row.Tecnología || 'Sin Tecnología').trim() === value
            );
        } else if (type === 'gcr') {
            // Filter using spatial analysis
            if (gcrGeometries) {
                const gcrAssignments = assignPermitsToGCR(electricityPermitsData, gcrGeometries);
                filteredData = gcrAssignments[value] || [];
            } else {
                filteredData = [];
            }
        }

        // Store filtered data for search
        currentFilteredData = filteredData;
        console.log('Filter applied:', type, value, '- Showing', filteredData.length, 'permits');

        // Recalculate stats for filtered data
        const filteredStats = calculateElectricityStats(filteredData);
        updateElectricityTotals(filteredStats);

        // Update charts with filtered data
        updateElectricityCharts(filteredStats);

        // Redraw markers with filtered data
        drawElectricityMarkersOnly(filteredData);
    }

    function filterElectricityPermitsByGCRGeometry(gcrName) {
        // Clear search box
        clearSearchBox();

        filterElectricityPermits('gcr', gcrName);

        // Show GCR layer with highlight
        showGCRLayer(gcrName);

        // Update active state in matrix view
        document.querySelectorAll('.matrix-gcr-section').forEach(section => {
            if (section.querySelector('.matrix-gcr-title').textContent === gcrName) {
                section.style.borderColor = 'var(--color-verde-profundo)';
                section.style.background = 'rgba(31, 122, 98, 0.03)';
            } else {
                section.style.borderColor = '#eef3f6';
                section.style.background = 'white';
            }
        });
    }

    function filterElectricityPermitsByGCRAndTech(gcrName, techName) {
        if (!gcrGeometries || !electricityPermitsData.length) return;

        // Clear search box
        clearSearchBox();

        // Get permits in this GCR
        const gcrAssignments = assignPermitsToGCR(electricityPermitsData, gcrGeometries);
        const gcrPermits = gcrAssignments[gcrName] || [];

        // Filter by technology
        const filteredData = gcrPermits.filter(row =>
            (row.Tecnología || 'Sin Tecnología').trim() === techName
        );

        currentFilter = { type: 'gcr-tech', gcr: gcrName, tech: techName };

        // Store filtered data for search
        currentFilteredData = filteredData;
        console.log('GCR+Tech filter applied:', gcrName, '+', techName, '- Showing', filteredData.length, 'permits');

        // Show GCR layer with highlight
        showGCRLayer(gcrName);

        // Clear existing cluster
        if (markersClusterGroup) {
            map.removeLayer(markersClusterGroup);
            markersClusterGroup.clearLayers();
        }

        // Recalculate stats
        const filteredStats = calculateElectricityStats(filteredData);
        updateElectricityTotals(filteredStats);

        // Redraw markers
        drawElectricityMarkersOnly(filteredData);
    }

    function resetElectricityFilters() {
        currentFilter = null;
        currentFilteredData = []; // Clear filtered data - search will use all data

        console.log('Filters reset - searching in all', electricityPermitsData.length, 'permits');

        // Clear search box
        clearSearchBox();

        // Remove active class from all cards
        document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));

        // Reset matrix view highlighting
        document.querySelectorAll('.matrix-gcr-section').forEach(section => {
            section.style.borderColor = '#eef3f6';
            section.style.background = 'white';
        });

        // Show layer based on active tab
        const activeTab = document.querySelector('.filter-tab.active');
        if (activeTab) {
            const tabType = activeTab.dataset.tab;

            if (tabType === 'state') {
                // Tab "Por Estado" - Mostrar Estados sin highlighting
                showStatesLayer(null);
            } else if (tabType === 'gcr') {
                // Tab "Por Gerencia" - Mostrar GCR sin highlighting
                showGCRLayer(null);
            } else if (tabType === 'tech') {
                // Tab "Por Tecnología" - Ocultar capas
                hideGeometryLayers();
            } else if (tabType === 'matrix') {
                // Tab "Vista Detallada" - Mostrar GCR sin highlighting
                showGCRLayer(null);
            }
        } else {
            // Default: show states layer
            showStatesLayer(null);
        }

        // Recalculate stats for all data
        updateElectricityTotals(electricityStats);

        // Update charts with all data
        updateElectricityCharts(electricityStats);

        // Redraw all markers
        if (electricityPermitsData.length) {
            drawElectricityMarkersOnly(electricityPermitsData);
        }
    }

    function drawElectricityMarkersOnly(rows) {
        if (!markersClusterGroup) {
            markersClusterGroup = L.markerClusterGroup({
                maxClusterRadius: 50,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                iconCreateFunction: function (cluster) {
                    const count = cluster.getChildCount();
                    let c = ' marker-cluster-';
                    if (count < 10) {
                        c += 'small';
                    } else if (count < 100) {
                        c += 'medium';
                    } else {
                        c += 'large';
                    }
                    return new L.DivIcon({
                        html: '<div><span>' + count + '</span></div>',
                        className: 'marker-cluster' + c,
                        iconSize: new L.Point(40, 40)
                    });
                }
            });
        } else {
            markersClusterGroup.clearLayers();
        }

        rows.forEach(function (row) {
            const latRaw = row.lat || row.Lat || row.latitude || row.Latitude || row.latitud || '';
            const lngRaw = row.lng || row.Lng || row.lon || row.Lon || row.longitude || row.Longitud || '';
            const lat = parseFloat(latRaw.toString().replace(',', '.'));
            const lng = parseFloat(lngRaw.toString().replace(',', '.'));

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            const popup = [
                '<div style="font-family: \'Montserrat\', sans-serif; max-width: 300px;">',
                '<div style="margin-bottom: 8px;"><strong style="font-size: 14px; color: #601623;">' + (row.NumeroPermiso || 'N/A') + '</strong></div>',
                '<div><strong>Razón Social:</strong> ' + (row.RazonSocial || 'N/A') + '</div>',
                '<div><strong>Estado:</strong> ' + (row.EfId || 'N/A') + '</div>',
                '<div><strong>Municipio:</strong> ' + (row.MpoId || 'N/A') + '</div>',
                '<div><strong>Estatus:</strong> ' + (row.Estatus || 'N/A') + '</div>',
                '<div><strong>Tipo de Permiso:</strong> ' + (row.TipoPermiso || 'N/A') + '</div>',
                '<div><strong>Capacidad (MW):</strong> ' + (row.CapacidadAutorizadaMW || 'N/A') + '</div>',
                '<div><strong>Tecnología:</strong> ' + (row.Tecnología || 'N/A') + '</div>',
                '<div><strong>Fuente de Energía:</strong> ' + (row.FuenteEnergía || 'N/A') + '</div>',
                '<div><strong>Fecha de Otorgamiento:</strong> ' + (row.FechaOtorgamiento || 'N/A') + '</div>',
                '</div>'
            ].join('');

            const plantIcon = L.divIcon({
                className: 'electricity-marker-icon',
                html: '<img src="https://cdn.sassoapps.com/iconos_snien/planta_generacion.png" style="width: 32px; height: 32px;">',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16]
            });

            const marker = L.marker([lat, lng], {
                icon: plantIcon,
                zIndexOffset: 1000
            });

            marker.bindPopup(popup);
            marker.permitData = row;
            markersClusterGroup.addLayer(marker);
        });

        map.addLayer(markersClusterGroup);

        if (markersClusterGroup._featureGroup && map.getPane('markerPane')) {
            const markerPane = map.getPane('markerPane');
            markerPane.style.zIndex = 650;
        }
    }

    function drawElectricityPermits(rows) {
        drawElectricityPermitsWithStats(rows);
    }

    function drawElectricityPermitsWithStats(rows) {
        // Clear existing markers
        markersLayer.clearLayers();
        if (markersClusterGroup) {
            map.removeLayer(markersClusterGroup);
            markersClusterGroup = null;
        }

        // Store data for search
        electricityPermitsData = rows;

        // Load GCR geometries if not loaded
        if (!gcrGeometries) {
            fetch('https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson')
                .then(response => response.json())
                .then(data => {
                    gcrGeometries = data;
                    console.log('GCR geometries loaded:', gcrGeometries.features.map(f => f.properties.name));

                    // Now calculate stats with GCR data
                    electricityStats = calculateElectricityStats(rows);
                    updateElectricityTotals(electricityStats);
                    createFilterCards(electricityStats, 'state');
                    createFilterCards(electricityStats, 'gcr');
                    createFilterCards(electricityStats, 'tech');
                    createMatrixView(electricityStats);

                    // Show States layer by default (since "Por Estado" tab is active)
                    showStatesLayer(null);
                })
                .catch(error => {
                    console.error('Error loading GCR geometries:', error);
                    // Calculate without GCR data
                    electricityStats = calculateElectricityStats(rows);
                    updateElectricityTotals(electricityStats);
                    createFilterCards(electricityStats, 'state');
                    createFilterCards(electricityStats, 'tech');

                    // Show States layer by default
                    showStatesLayer(null);
                });
        } else {
            // Calculate statistics
            electricityStats = calculateElectricityStats(rows);
            updateElectricityTotals(electricityStats);
            createFilterCards(electricityStats, 'state');
            createFilterCards(electricityStats, 'gcr');
            createFilterCards(electricityStats, 'tech');
            createMatrixView(electricityStats);

            // Create charts
            createElectricityCharts(electricityStats);

            // Show States layer by default (since "Por Estado" tab is active)
            showStatesLayer(null);
        }

        // Show filters panel
        const filtersPanel = document.getElementById('electricity-filters-panel');
        if (filtersPanel) {
            filtersPanel.style.display = 'block';
        }

        // Draw markers
        drawElectricityMarkersOnly(rows);
    }

    // ==========================================
    // ELECTRICITY CHARTS FUNCTIONS
    // ==========================================

    function createElectricityCharts(stats) {
        createElectricityTechChart(stats);
        createElectricityStatesChart(stats);
    }

    function createElectricityTechChart(stats) {
        const ctx = document.getElementById('electricity-tech-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (electricityTechChart) {
            electricityTechChart.destroy();
        }

        // Prepare data
        const technologies = Object.keys(stats.byTech).sort((a, b) =>
            stats.byTech[b].capacity - stats.byTech[a].capacity
        );

        const data = technologies.map(tech => stats.byTech[tech].capacity);
        const colors = [
            '#1f7a62', '#601623', '#24a47a', '#8B1E3F', '#0D5C4A',
            '#C41E3A', '#165845', '#7a2432', '#2d9575', '#4a0e16'
        ];

        electricityTechChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: technologies,
                datasets: [{
                    label: 'Capacidad (MW)',
                    data: data,
                    backgroundColor: colors.slice(0, technologies.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: {
                                family: "'Montserrat', sans-serif",
                                size: 11
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Capacidad por Tecnología',
                        font: {
                            family: "'Montserrat', sans-serif",
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#601623'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value.toLocaleString('es-MX')} MW (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function createElectricityStatesChart(stats) {
        const ctx = document.getElementById('electricity-states-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (electricityStatesChart) {
            electricityStatesChart.destroy();
        }

        // Get top 10 states by capacity
        const states = Object.keys(stats.byState).sort((a, b) =>
            stats.byState[b].capacity - stats.byState[a].capacity
        ).slice(0, 10);

        const data = states.map(state => stats.byState[state].capacity);

        electricityStatesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: states,
                datasets: [{
                    label: 'Capacidad (MW)',
                    data: data,
                    backgroundColor: '#1f7a62',
                    borderColor: '#0D5C4A',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Top 10 Estados por Capacidad',
                        font: {
                            family: "'Montserrat', sans-serif",
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#601623'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.parsed.x || 0;
                                return `${value.toLocaleString('es-MX')} MW`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return value.toLocaleString('es-MX');
                            }
                        }
                    }
                }
            }
        });
    }

    function updateElectricityCharts(stats) {
        updateElectricityTechChart(stats);
        updateElectricityStatesChart(stats);
    }

    function updateElectricityTechChart(stats) {
        if (!electricityTechChart) {
            createElectricityTechChart(stats);
            return;
        }

        const technologies = Object.keys(stats.byTech).sort((a, b) =>
            stats.byTech[b].capacity - stats.byTech[a].capacity
        );
        const data = technologies.map(tech => stats.byTech[tech].capacity);

        electricityTechChart.data.labels = technologies;
        electricityTechChart.data.datasets[0].data = data;
        electricityTechChart.update();
    }

    function updateElectricityStatesChart(stats) {
        if (!electricityStatesChart) {
            createElectricityStatesChart(stats);
            return;
        }

        const states = Object.keys(stats.byState).sort((a, b) =>
            stats.byState[b].capacity - stats.byState[a].capacity
        ).slice(0, 10);
        const data = states.map(state => stats.byState[state].capacity);

        electricityStatesChart.data.labels = states;
        electricityStatesChart.data.datasets[0].data = data;
        electricityStatesChart.update();
    }

    // ==========================================
    // PETROLIFEROS FUNCTIONS
    // ==========================================

    // Helper function to get state name from ID
    function getStateName(stateId) {
        if (!stateId) return 'Sin Estado';
        // Normalize the ID by padding with zeros if needed
        const id = stateId.toString().trim().padStart(2, '0');
        return stateIdToName[id] || stateId;
    }

    function calculatePetroliferosStats(data) {
        const stats = {
            byState: {}, // By Estado (EfId)
            byType: {}, // By TipoPermiso
            byBrand: {}, // By Marca
            totals: {
                capacity: 0,
                investment: 0,
                count: 0
            }
        };

        data.forEach(row => {
            const stateId = (row.EfId || 'Sin Estado').trim();
            const stateName = getStateName(stateId);
            const type = (row.TipoPermiso || 'Sin Tipo').trim();
            const brand = (row.Marca || 'Sin Marca').trim();
            const capacity = parseFloat(row.CapacidadAutorizadaBarriles) || 0;
            const investment = parseFloat(row.InversionEstimada) || 0;

            // By State (using state name instead of ID)
            if (!stats.byState[stateName]) {
                stats.byState[stateName] = { capacity: 0, investment: 0, count: 0, stateId: stateId };
            }
            stats.byState[stateName].capacity += capacity;
            stats.byState[stateName].investment += investment;
            stats.byState[stateName].count++;

            // By Type
            if (!stats.byType[type]) {
                stats.byType[type] = { capacity: 0, investment: 0, count: 0 };
            }
            stats.byType[type].capacity += capacity;
            stats.byType[type].investment += investment;
            stats.byType[type].count++;

            // By Brand
            if (!stats.byBrand[brand]) {
                stats.byBrand[brand] = { capacity: 0, investment: 0, count: 0 };
            }
            stats.byBrand[brand].capacity += capacity;
            stats.byBrand[brand].investment += investment;
            stats.byBrand[brand].count++;

            // Totals
            stats.totals.capacity += capacity;
            stats.totals.investment += investment;
            stats.totals.count++;
        });

        return stats;
    }

    function drawPetroliferosPermits(rows) {
        console.log('drawPetroliferosPermits called with', rows.length, 'rows');

        // Clear existing markers
        markersLayer.clearLayers();
        if (markersClusterGroup) {
            map.removeLayer(markersClusterGroup);
            markersClusterGroup = null;
        }

        // Store data
        petroliferosPermitsData = rows;
        console.log('Stored petroliferosPermitsData:', petroliferosPermitsData.length);

        // Calculate statistics
        petroliferosStats = calculatePetroliferosStats(rows);
        console.log('Calculated stats:', petroliferosStats);

        updatePetroliferosTotals(petroliferosStats);
        createPetroliferosFilterCards(petroliferosStats, 'state');
        createPetroliferosFilterCards(petroliferosStats, 'type');
        createPetroliferosFilterCards(petroliferosStats, 'brand');

        // Create charts
        createPetroliferosCharts(petroliferosStats);

        // Show States layer by default
        showStatesLayer(null);

        // Show filters panel
        const filtersPanel = document.getElementById('petroliferos-filters-panel');
        if (filtersPanel) {
            filtersPanel.style.display = 'block';
            console.log('Petroliferos filters panel shown');
        } else {
            console.error('Petroliferos filters panel not found!');
        }

        // Draw markers
        drawPetroliferosMarkersOnly(rows);
        console.log('Markers drawn');
    }

    function drawPetroliferosMarkersOnly(rows) {
        console.log('drawPetroliferosMarkersOnly called with', rows.length, 'rows');

        if (!markersClusterGroup) {
            console.log('Creating new cluster group');
            markersClusterGroup = L.markerClusterGroup({
                maxClusterRadius: 50,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                iconCreateFunction: function (cluster) {
                    const count = cluster.getChildCount();
                    let className = 'marker-cluster-small';
                    if (count >= 100) {
                        className = 'marker-cluster-large';
                    } else if (count >= 10) {
                        className = 'marker-cluster-medium';
                    }
                    return L.divIcon({
                        html: '<div><span>' + count + '</span></div>',
                        className: 'marker-cluster ' + className,
                        iconSize: L.point(40, 40)
                    });
                }
            });
        } else {
            console.log('Clearing existing cluster group');
            markersClusterGroup.clearLayers();
        }

        let markersAdded = 0;

        rows.forEach(row => {
            const latRaw = row.lat || '';
            const lngRaw = row.lon || '';
            const lat = parseFloat(latRaw.toString().replace(',', '.'));
            const lng = parseFloat(lngRaw.toString().replace(',', '.'));

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            markersAdded++;

            const popup = [
                '<div class="permit-popup">',
                '<div class="permit-header">',
                '<strong>' + (row.NumeroPermiso || 'S/N') + '</strong>',
                '</div>',
                '<div class="permit-details">',
                '<div><strong>Razón Social:</strong> ' + (row.RazonSocial || 'N/A') + '</div>',
                '<div><strong>Estado:</strong> ' + getStateName(row.EfId) + '</div>',
                '<div><strong>Municipio:</strong> ' + (row.MpoId || 'N/A') + '</div>',
                '<div><strong>Estatus:</strong> ' + (row.Estatus || 'N/A') + '</div>',
                '<div><strong>Tipo:</strong> ' + (row.TipoPermiso || 'N/A') + '</div>',
                '<div><strong>Marca:</strong> ' + (row.Marca || 'N/A') + '</div>',
                '<div><strong>Capacidad:</strong> ' + (row.CapacidadAutorizadaBarriles || '0') + ' Barriles</div>',
                '<div><strong>Inversión:</strong> $' + (parseFloat(row.InversionEstimada) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 }) + '</div>',
                row.FechaOtorgamiento ? '<div><strong>Fecha:</strong> ' + row.FechaOtorgamiento + '</div>' : '',
                '</div>',
                '</div>'
            ].join('');

            const gasIcon = L.divIcon({
                className: 'electricity-marker-icon',
                html: '<img src="https://cdn.sassoapps.com/iconos_snien/gasolinera.png" style="width: 32px; height: 32px;">',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16]
            });

            const marker = L.marker([lat, lng], {
                icon: gasIcon,
                zIndexOffset: 1000
            });

            marker.bindPopup(popup);
            marker.permitData = row;
            markersClusterGroup.addLayer(marker);
        });

        console.log('Markers added to cluster:', markersAdded);

        map.addLayer(markersClusterGroup);
        console.log('Cluster group added to map');

        if (markersClusterGroup._featureGroup && map.getPane('markerPane')) {
            const markerPane = map.getPane('markerPane');
            markerPane.style.zIndex = 650;
        }
    }

    function updatePetroliferosTotals(stats) {
        const capacityEl = document.getElementById('total-petroliferos-capacity');
        const investmentEl = document.getElementById('total-petroliferos-investment');
        const permitsEl = document.getElementById('total-petroliferos-permits');

        if (capacityEl) {
            capacityEl.textContent = stats.totals.capacity.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' Barriles';
        }
        if (investmentEl) {
            investmentEl.textContent = '$' + stats.totals.investment.toLocaleString('es-MX', { maximumFractionDigits: 2 });
        }
        if (permitsEl) {
            permitsEl.textContent = stats.totals.count.toLocaleString('es-MX');
        }
    }

    function createPetroliferosFilterCards(stats, type) {
        let container, data;

        if (type === 'state') {
            container = document.getElementById('petroliferos-state-cards');
            data = stats.byState;
        } else if (type === 'type') {
            container = document.getElementById('petroliferos-type-cards');
            data = stats.byType;
        } else {
            container = document.getElementById('petroliferos-brand-cards');
            data = stats.byBrand;
        }

        if (!container) return;

        container.innerHTML = '';

        const sortedKeys = Object.keys(data).sort((a, b) => data[b].capacity - data[a].capacity);

        sortedKeys.forEach(key => {
            const item = data[key];
            const card = document.createElement('div');
            card.className = 'filter-card';
            card.dataset.filterType = type;
            card.dataset.filterValue = key;

            card.innerHTML = `
                <div class="filter-card-header">
                    <div class="filter-card-title">${key}</div>
                    <div class="filter-card-count">${item.count}</div>
                </div>
                <div class="filter-card-stats">
                    <div class="filter-stat">
                        <span class="filter-stat-label">⛽ Capacidad:</span>
                        <span class="filter-stat-value">${item.capacity.toLocaleString('es-MX', { maximumFractionDigits: 0 })} Barriles</span>
                    </div>
                    <div class="filter-stat">
                        <span class="filter-stat-label">💰 Inversión:</span>
                        <span class="filter-stat-value">$${item.investment.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', function () {
                filterPetroliferosPermits(type, key);

                // Update active state
                container.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
            });

            container.appendChild(card);
        });
    }

    function filterPetroliferosPermits(type, value) {
        if (!markersClusterGroup || !petroliferosPermitsData.length) return;

        currentPetroliferosFilter = { type, value };

        // Clear search box
        clearSearchBox();

        // Clear existing cluster
        map.removeLayer(markersClusterGroup);
        markersClusterGroup.clearLayers();

        // Show/hide geometry layers based on filter type
        if (type === 'state') {
            showStatesLayer(value);
        } else {
            // For other filters, show states without highlighting
            showStatesLayer(null);
        }

        // Filter data
        let filteredData;
        if (type === 'state') {
            // When filtering by state name, we need to match by state ID
            // Find the state ID for this state name from the stats
            const stateId = petroliferosStats.byState[value] ? petroliferosStats.byState[value].stateId : null;

            console.log('Filtering by state:', value, 'State ID:', stateId);

            if (stateId) {
                // Normalize both IDs for comparison (pad with zeros)
                const normalizedFilterId = stateId.toString().trim().padStart(2, '0');

                filteredData = petroliferosPermitsData.filter(row => {
                    const rowId = (row.EfId || '').toString().trim().padStart(2, '0');
                    return rowId === normalizedFilterId;
                });
            } else {
                // Fallback: try to match by name
                filteredData = petroliferosPermitsData.filter(row => {
                    const rowStateName = getStateName(row.EfId);
                    return rowStateName === value;
                });
            }
        } else if (type === 'type') {
            filteredData = petroliferosPermitsData.filter(row =>
                (row.TipoPermiso || 'Sin Tipo').trim() === value
            );
        } else if (type === 'brand') {
            filteredData = petroliferosPermitsData.filter(row =>
                (row.Marca || 'Sin Marca').trim() === value
            );
        }

        // Store filtered data for search
        currentPetroliferosFilteredData = filteredData;
        console.log('Petroliferos filter applied:', type, value, '- Showing', filteredData.length, 'permits');

        // Recalculate stats for filtered data
        const filteredStats = calculatePetroliferosStats(filteredData);
        updatePetroliferosTotals(filteredStats);

        // Update charts with filtered data
        updatePetroliferosCharts(filteredStats);

        // Redraw markers with filtered data
        drawPetroliferosMarkersOnly(filteredData);
    }

    function resetPetroliferosFilters() {
        currentPetroliferosFilter = null;
        currentPetroliferosFilteredData = [];

        console.log('Petroliferos filters reset - searching in all', petroliferosPermitsData.length, 'permits');

        // Clear search box
        clearSearchBox();

        // Remove active class from all cards
        document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));

        // Show layer based on active tab
        const activeTab = document.querySelector('.filter-tab-petroliferos.active');
        if (activeTab) {
            const tabType = activeTab.dataset.tab;

            if (tabType === 'state') {
                showStatesLayer(null);
            } else {
                showStatesLayer(null);
            }
        } else {
            showStatesLayer(null);
        }

        // Recalculate stats for all data
        updatePetroliferosTotals(petroliferosStats);

        // Update charts with all data
        updatePetroliferosCharts(petroliferosStats);

        // Redraw all markers
        if (petroliferosPermitsData.length) {
            drawPetroliferosMarkersOnly(petroliferosPermitsData);
        }
    }

    // ==========================================
    // PETROLIFEROS CHARTS FUNCTIONS
    // ==========================================

    function createPetroliferosCharts(stats) {
        createPetroliferosBrandChart(stats);
        createPetroliferosStatesChart(stats);
    }

    function createPetroliferosBrandChart(stats) {
        const ctx = document.getElementById('petroliferos-brand-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (petroliferosBrandChart) {
            petroliferosBrandChart.destroy();
        }

        // Prepare data
        const brands = Object.keys(stats.byBrand).sort((a, b) =>
            stats.byBrand[b].count - stats.byBrand[a].count
        );

        const data = brands.map(brand => stats.byBrand[brand].count);
        const colors = [
            '#601623', '#1f7a62', '#8B1E3F', '#24a47a', '#C41E3A',
            '#0D5C4A', '#7a2432', '#165845', '#4a0e16', '#2d9575'
        ];

        petroliferosBrandChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: brands,
                datasets: [{
                    label: 'Número de Permisos',
                    data: data,
                    backgroundColor: colors.slice(0, brands.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: {
                                family: "'Montserrat', sans-serif",
                                size: 11
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Distribución por Marca',
                        font: {
                            family: "'Montserrat', sans-serif",
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#601623'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value.toLocaleString('es-MX')} permisos (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function createPetroliferosStatesChart(stats) {
        const ctx = document.getElementById('petroliferos-states-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (petroliferosStatesChart) {
            petroliferosStatesChart.destroy();
        }

        // Get top 10 states by permit count
        const states = Object.keys(stats.byState).sort((a, b) =>
            stats.byState[b].count - stats.byState[a].count
        ).slice(0, 10);

        const data = states.map(state => stats.byState[state].count);

        petroliferosStatesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: states,
                datasets: [{
                    label: 'Número de Permisos',
                    data: data,
                    backgroundColor: '#601623',
                    borderColor: '#4a0e16',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Top 10 Estados por Permisos',
                        font: {
                            family: "'Montserrat', sans-serif",
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#601623'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.parsed.x || 0;
                                return `${value.toLocaleString('es-MX')} permisos`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return value.toLocaleString('es-MX');
                            }
                        }
                    }
                }
            }
        });
    }

    function updatePetroliferosCharts(stats) {
        updatePetroliferosBrandChart(stats);
        updatePetroliferosStatesChart(stats);
    }

    function updatePetroliferosBrandChart(stats) {
        if (!petroliferosBrandChart) {
            createPetroliferosBrandChart(stats);
            return;
        }

        const brands = Object.keys(stats.byBrand).sort((a, b) =>
            stats.byBrand[b].count - stats.byBrand[a].count
        );
        const data = brands.map(brand => stats.byBrand[brand].count);

        petroliferosBrandChart.data.labels = brands;
        petroliferosBrandChart.data.datasets[0].data = data;
        petroliferosBrandChart.update();
    }

    function updatePetroliferosStatesChart(stats) {
        if (!petroliferosStatesChart) {
            createPetroliferosStatesChart(stats);
            return;
        }

        const states = Object.keys(stats.byState).sort((a, b) =>
            stats.byState[b].count - stats.byState[a].count
        ).slice(0, 10);
        const data = states.map(state => stats.byState[state].count);

        petroliferosStatesChart.data.labels = states;
        petroliferosStatesChart.data.datasets[0].data = data;
        petroliferosStatesChart.update();
    }

    // ==========================================
    // GAS LP FUNCTIONS
    // ==========================================

    // Helper function already exists: getStateName()

    function calculateGasLPStats(data) {
        const stats = {
            byState: {}, // By Estado (EfId)
            byType: {}, // By TipoPermiso
            totals: {
                capacity: 0,
                capacityLiters: 0,
                count: 0
            }
        };

        data.forEach(row => {
            const stateId = (row.EfId || 'Sin Estado').trim();
            const stateName = getStateName(stateId);
            const type = (row.TipoPermiso || 'Sin Tipo').trim();
            const capacityInstall = parseFloat(row.CapacidadInstalacion) || 0;
            const capacityLiters = parseFloat(row.CapacidadLitros) || 0;

            // By State
            if (!stats.byState[stateName]) {
                stats.byState[stateName] = { capacity: 0, capacityLiters: 0, count: 0, stateId: stateId };
            }
            stats.byState[stateName].capacity += capacityInstall;
            stats.byState[stateName].capacityLiters += capacityLiters;
            stats.byState[stateName].count++;

            // By Type
            if (!stats.byType[type]) {
                stats.byType[type] = { capacity: 0, capacityLiters: 0, count: 0 };
            }
            stats.byType[type].capacity += capacityInstall;
            stats.byType[type].capacityLiters += capacityLiters;
            stats.byType[type].count++;

            // Totals
            stats.totals.capacity += capacityInstall;
            stats.totals.capacityLiters += capacityLiters;
            stats.totals.count++;
        });

        return stats;
    }

    function drawGasLPPermits(rows) {
        console.log('drawGasLPPermits called with', rows.length, 'rows');

        // Clear existing markers
        markersLayer.clearLayers();
        if (markersClusterGroup) {
            map.removeLayer(markersClusterGroup);
            markersClusterGroup = null;
        }

        // Store data
        gasLPPermitsData = rows;
        console.log('Stored gasLPPermitsData:', gasLPPermitsData.length);

        // Calculate statistics
        gasLPStats = calculateGasLPStats(rows);
        console.log('Calculated stats:', gasLPStats);

        updateGasLPTotals(gasLPStats);
        createGasLPFilterCards(gasLPStats, 'state');
        createGasLPFilterCards(gasLPStats, 'type');

        // Create charts
        createGasLPCharts(gasLPStats);

        // Show States layer by default
        showStatesLayer(null);

        // Show filters panel
        const filtersPanel = document.getElementById('gaslp-filters-panel');
        if (filtersPanel) {
            filtersPanel.style.display = 'block';
            console.log('Gas LP filters panel shown');
        } else {
            console.error('Gas LP filters panel not found!');
        }

        // Draw markers
        drawGasLPMarkersOnly(rows);
        console.log('Markers drawn');
    }

    function drawGasLPMarkersOnly(rows) {
        console.log('drawGasLPMarkersOnly called with', rows.length, 'rows');

        if (!markersClusterGroup) {
            console.log('Creating new cluster group');
            markersClusterGroup = L.markerClusterGroup({
                maxClusterRadius: 50,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                iconCreateFunction: function (cluster) {
                    const count = cluster.getChildCount();
                    let className = 'marker-cluster-small';
                    if (count >= 100) {
                        className = 'marker-cluster-large';
                    } else if (count >= 10) {
                        className = 'marker-cluster-medium';
                    }
                    return L.divIcon({
                        html: '<div><span>' + count + '</span></div>',
                        className: 'marker-cluster ' + className,
                        iconSize: L.point(40, 40)
                    });
                }
            });
        } else {
            console.log('Clearing existing cluster group');
            markersClusterGroup.clearLayers();
        }

        let markersAdded = 0;

        rows.forEach(row => {
            const latRaw = row.lat || row.Lat || '';
            const lngRaw = row.lon || row.lng || row.Lon || row.Lng || '';
            const lat = parseFloat(latRaw.toString().replace(',', '.'));
            const lng = parseFloat(lngRaw.toString().replace(',', '.'));

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            markersAdded++;

            const popup = [
                '<div class="permit-popup">',
                '<div class="permit-header">',
                '<strong>' + (row.NumeroPermiso || 'S/N') + '</strong>',
                '</div>',
                '<div class="permit-details">',
                '<div><strong>Razón Social:</strong> ' + (row.RazonSocial || 'N/A') + '</div>',
                '<div><strong>Estado:</strong> ' + getStateName(row.EfId) + '</div>',
                '<div><strong>Municipio:</strong> ' + (row.MpoId || 'N/A') + '</div>',
                '<div><strong>Estatus:</strong> ' + (row.Estatus || 'N/A') + '</div>',
                '<div><strong>Tipo:</strong> ' + (row.TipoPermiso || 'N/A') + '</div>',
                row.CapacidadInstalacion ? '<div><strong>Capacidad Instalación:</strong> ' + parseFloat(row.CapacidadInstalacion).toLocaleString('es-MX') + ' Litros</div>' : '',
                row.CapacidadLitros ? '<div><strong>Capacidad Total:</strong> ' + parseFloat(row.CapacidadLitros).toLocaleString('es-MX') + ' Litros</div>' : '',
                row.NumeroTanques ? '<div><strong>Tanques:</strong> ' + row.NumeroTanques + '</div>' : '',
                row.FechaDeOtorgamiento ? '<div><strong>Fecha:</strong> ' + row.FechaDeOtorgamiento + '</div>' : '',
                '</div>',
                '</div>'
            ].join('');

            const gasLPIcon = L.divIcon({
                className: 'electricity-marker-icon',
                html: '<img src="https://cdn.sassoapps.com/iconos_snien/gaslp.png" style="width: 32px; height: 32px;">',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16]
            });

            const marker = L.marker([lat, lng], {
                icon: gasLPIcon,
                zIndexOffset: 1000
            });

            marker.bindPopup(popup);
            marker.permitData = row;
            markersClusterGroup.addLayer(marker);
        });

        console.log('Markers added to cluster:', markersAdded);

        map.addLayer(markersClusterGroup);
        console.log('Cluster group added to map');

        if (markersClusterGroup._featureGroup && map.getPane('markerPane')) {
            const markerPane = map.getPane('markerPane');
            markerPane.style.zIndex = 650;
        }
    }

    function updateGasLPTotals(stats) {
        const capacityEl = document.getElementById('total-gaslp-capacity');
        const investmentEl = document.getElementById('total-gaslp-investment');
        const permitsEl = document.getElementById('total-gaslp-permits');

        if (capacityEl) {
            const totalCapacity = stats.totals.capacity + stats.totals.capacityLiters;
            capacityEl.textContent = totalCapacity.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' Litros';
        }
        if (investmentEl) {
            // Show capacity in liters instead since there's no investment data
            investmentEl.textContent = stats.totals.capacityLiters.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' L (Tanques)';
        }
        if (permitsEl) {
            permitsEl.textContent = stats.totals.count.toLocaleString('es-MX');
        }
    }

    function createGasLPFilterCards(stats, type) {
        let container, data;

        if (type === 'state') {
            container = document.getElementById('gaslp-state-cards');
            data = stats.byState;
        } else {
            container = document.getElementById('gaslp-type-cards');
            data = stats.byType;
        }

        if (!container) return;

        container.innerHTML = '';

        const sortedKeys = Object.keys(data).sort((a, b) => data[b].capacity - data[a].capacity);

        sortedKeys.forEach(key => {
            const item = data[key];
            const card = document.createElement('div');
            card.className = 'filter-card';
            card.dataset.filterType = type;
            card.dataset.filterValue = key;

            card.innerHTML = `
                <div class="filter-card-header">
                    <div class="filter-card-title">${key}</div>
                    <div class="filter-card-count">${item.count}</div>
                </div>
                <div class="filter-card-stats">
                    <div class="filter-stat">
                        <span class="filter-stat-label">💧 Capacidad:</span>
                        <span class="filter-stat-value">${(item.capacity + item.capacityLiters).toLocaleString('es-MX', { maximumFractionDigits: 0 })} Litros</span>
                    </div>
                    <div class="filter-stat">
                        <span class="filter-stat-label">🛢️ Tanques:</span>
                        <span class="filter-stat-value">${item.capacityLiters.toLocaleString('es-MX', { maximumFractionDigits: 0 })} L</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', function () {
                filterGasLPPermits(type, key);

                // Update active state
                container.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
            });

            container.appendChild(card);
        });
    }

    function filterGasLPPermits(type, value) {
        if (!markersClusterGroup || !gasLPPermitsData.length) return;

        currentGasLPFilter = { type, value };

        // Clear search box
        clearSearchBox();

        // Clear existing cluster
        map.removeLayer(markersClusterGroup);
        markersClusterGroup.clearLayers();

        // Show/hide geometry layers based on filter type
        if (type === 'state') {
            showStatesLayer(value);
        } else {
            showStatesLayer(null);
        }

        // Filter data
        let filteredData;
        if (type === 'state') {
            const stateId = gasLPStats.byState[value] ? gasLPStats.byState[value].stateId : null;

            console.log('Filtering by state:', value, 'State ID:', stateId);

            if (stateId) {
                const normalizedFilterId = stateId.toString().trim().padStart(2, '0');

                filteredData = gasLPPermitsData.filter(row => {
                    const rowId = (row.EfId || '').toString().trim().padStart(2, '0');
                    return rowId === normalizedFilterId;
                });
            } else {
                filteredData = gasLPPermitsData.filter(row => {
                    const rowStateName = getStateName(row.EfId);
                    return rowStateName === value;
                });
            }
        } else if (type === 'type') {
            filteredData = gasLPPermitsData.filter(row =>
                (row.TipoPermiso || 'Sin Tipo').trim() === value
            );
        }

        // Store filtered data for search
        currentGasLPFilteredData = filteredData;
        console.log('Gas LP filter applied:', type, value, '- Showing', filteredData.length, 'permits');

        // Recalculate stats for filtered data
        const filteredStats = calculateGasLPStats(filteredData);
        updateGasLPTotals(filteredStats);

        // Update charts with filtered data
        updateGasLPCharts(filteredStats);

        // Redraw markers with filtered data
        drawGasLPMarkersOnly(filteredData);
    }

    function resetGasLPFilters() {
        currentGasLPFilter = null;
        currentGasLPFilteredData = [];

        console.log('Gas LP filters reset - searching in all', gasLPPermitsData.length, 'permits');

        // Clear search box
        clearSearchBox();

        // Remove active class from all cards
        document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));

        // Show layer based on active tab
        const activeTab = document.querySelector('.filter-tab-gaslp.active');
        if (activeTab) {
            const tabType = activeTab.dataset.tab;

            if (tabType === 'state') {
                showStatesLayer(null);
            } else {
                showStatesLayer(null);
            }
        } else {
            showStatesLayer(null);
        }

        // Recalculate stats for all data
        updateGasLPTotals(gasLPStats);

        // Update charts with all data
        updateGasLPCharts(gasLPStats);

        // Redraw all markers
        if (gasLPPermitsData.length) {
            drawGasLPMarkersOnly(gasLPPermitsData);
        }
    }

    // ==========================================
    // GAS LP CHARTS FUNCTIONS
    // ==========================================

    function createGasLPCharts(stats) {
        createGasLPTypeChart(stats);
        createGasLPStatesChart(stats);
    }

    function createGasLPTypeChart(stats) {
        const ctx = document.getElementById('gaslp-type-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (gasLPTypeChart) {
            gasLPTypeChart.destroy();
        }

        // Prepare data
        const types = Object.keys(stats.byType).sort((a, b) =>
            stats.byType[b].count - stats.byType[a].count
        );

        const data = types.map(type => stats.byType[type].count);
        const colors = [
            '#1f7a62', '#601623', '#24a47a', '#8B1E3F', '#0D5C4A',
            '#C41E3A', '#165845', '#7a2432', '#2d9575', '#4a0e16'
        ];

        gasLPTypeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: types,
                datasets: [{
                    label: 'Número de Permisos',
                    data: data,
                    backgroundColor: colors.slice(0, types.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: {
                                family: "'Montserrat', sans-serif",
                                size: 11
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Distribución por Tipo de Permiso',
                        font: {
                            family: "'Montserrat', sans-serif",
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#601623'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value.toLocaleString('es-MX')} permisos (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function createGasLPStatesChart(stats) {
        const ctx = document.getElementById('gaslp-states-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (gasLPStatesChart) {
            gasLPStatesChart.destroy();
        }

        // Get top 10 states by permit count
        const states = Object.keys(stats.byState).sort((a, b) =>
            stats.byState[b].count - stats.byState[a].count
        ).slice(0, 10);

        const data = states.map(state => stats.byState[state].count);

        gasLPStatesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: states,
                datasets: [{
                    label: 'Número de Permisos',
                    data: data,
                    backgroundColor: '#1f7a62',
                    borderColor: '#0D5C4A',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Top 10 Estados por Permisos',
                        font: {
                            family: "'Montserrat', sans-serif",
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#601623'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.parsed.x || 0;
                                return `${value.toLocaleString('es-MX')} permisos`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return value.toLocaleString('es-MX');
                            }
                        }
                    }
                }
            }
        });
    }

    function updateGasLPCharts(stats) {
        updateGasLPTypeChart(stats);
        updateGasLPStatesChart(stats);
    }

    function updateGasLPTypeChart(stats) {
        if (!gasLPTypeChart) {
            createGasLPTypeChart(stats);
            return;
        }

        const types = Object.keys(stats.byType).sort((a, b) =>
            stats.byType[b].count - stats.byType[a].count
        );
        const data = types.map(type => stats.byType[type].count);

        gasLPTypeChart.data.labels = types;
        gasLPTypeChart.data.datasets[0].data = data;
        gasLPTypeChart.update();
    }

    function updateGasLPStatesChart(stats) {
        if (!gasLPStatesChart) {
            createGasLPStatesChart(stats);
            return;
        }

        const states = Object.keys(stats.byState).sort((a, b) =>
            stats.byState[b].count - stats.byState[a].count
        ).slice(0, 10);
        const data = states.map(state => stats.byState[state].count);

        gasLPStatesChart.data.labels = states;
        gasLPStatesChart.data.datasets[0].data = data;
        gasLPStatesChart.update();
    }

    // ==========================================
    // GAS NATURAL FUNCTIONS
    // ==========================================

    function calculateGasNaturalStats(data) {
        const stats = {
            byState: {}, // By Estado (EfId)
            byType: {}, // By TipoPermiso
            totals: {
                investment: 0,
                compressors: 0,
                dispatchers: 0,
                cylinders: 0,
                count: 0
            }
        };

        data.forEach(row => {
            // Parse EfId to extract state ID and name
            const efIdRaw = (row.EfId || '').trim();
            let stateId = '';
            let stateName = '';

            if (efIdRaw.includes('-')) {
                const parts = efIdRaw.split('-');
                stateId = parts[0].trim();
                stateName = parts[1] ? parts[1].trim() : getStateName(stateId);
            } else {
                stateId = efIdRaw;
                stateName = getStateName(stateId);
            }

            const type = (row.TipoPermiso || 'Sin Tipo').trim();
            const investment = parseFloat(row.InversionEstimada) || 0;
            const compressors = parseInt(row.Compresores) || 0;
            const dispatchers = parseInt(row.NumeroDespachadores) || 0;
            const cylinders = parseInt(row.Cilindros) || 0;

            // By State
            if (!stats.byState[stateName]) {
                stats.byState[stateName] = {
                    investment: 0,
                    compressors: 0,
                    dispatchers: 0,
                    cylinders: 0,
                    count: 0,
                    stateId: stateId
                };
            }
            stats.byState[stateName].investment += investment;
            stats.byState[stateName].compressors += compressors;
            stats.byState[stateName].dispatchers += dispatchers;
            stats.byState[stateName].cylinders += cylinders;
            stats.byState[stateName].count++;

            // By Type
            if (!stats.byType[type]) {
                stats.byType[type] = {
                    investment: 0,
                    compressors: 0,
                    dispatchers: 0,
                    cylinders: 0,
                    count: 0
                };
            }
            stats.byType[type].investment += investment;
            stats.byType[type].compressors += compressors;
            stats.byType[type].dispatchers += dispatchers;
            stats.byType[type].cylinders += cylinders;
            stats.byType[type].count++;

            // Totals
            stats.totals.investment += investment;
            stats.totals.compressors += compressors;
            stats.totals.dispatchers += dispatchers;
            stats.totals.cylinders += cylinders;
            stats.totals.count++;
        });

        return stats;
    }

    function drawGasNaturalPermits(rows) {
        console.log('drawGasNaturalPermits called with', rows.length, 'rows');

        // Clear existing markers
        markersLayer.clearLayers();
        if (markersClusterGroup) {
            map.removeLayer(markersClusterGroup);
            markersClusterGroup = null;
        }

        // Store data
        gasNaturalPermitsData = rows;
        console.log('Stored gasNaturalPermitsData:', gasNaturalPermitsData.length);

        // Calculate statistics
        gasNaturalStats = calculateGasNaturalStats(rows);
        console.log('Calculated stats:', gasNaturalStats);

        updateGasNaturalTotals(gasNaturalStats);
        createGasNaturalFilterCards(gasNaturalStats, 'state');
        createGasNaturalFilterCards(gasNaturalStats, 'type');

        // Create charts
        createGasNaturalCharts(gasNaturalStats);

        // Show States layer by default
        showStatesLayer(null);

        // Show filters panel
        const filtersPanel = document.getElementById('gasnatural-filters-panel');
        if (filtersPanel) {
            filtersPanel.style.display = 'block';
            console.log('Gas Natural filters panel shown');
        } else {
            console.error('Gas Natural filters panel not found!');
        }

        // Draw markers
        drawGasNaturalMarkersOnly(rows);
        console.log('Markers drawn');
    }

    function drawGasNaturalMarkersOnly(rows) {
        console.log('drawGasNaturalMarkersOnly called with', rows.length, 'rows');

        if (!markersClusterGroup) {
            console.log('Creating new cluster group');
            markersClusterGroup = L.markerClusterGroup({
                maxClusterRadius: 50,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                iconCreateFunction: function (cluster) {
                    const count = cluster.getChildCount();
                    let className = 'marker-cluster-small';
                    if (count >= 100) {
                        className = 'marker-cluster-large';
                    } else if (count >= 10) {
                        className = 'marker-cluster-medium';
                    }
                    return L.divIcon({
                        html: '<div><span>' + count + '</span></div>',
                        className: 'marker-cluster ' + className,
                        iconSize: L.point(40, 40)
                    });
                }
            });
        } else {
            console.log('Clearing existing cluster group');
            markersClusterGroup.clearLayers();
        }

        let markersAdded = 0;

        rows.forEach(row => {
            const latRaw = row.lat || row.Lat || '';
            const lngRaw = row.lon || row.lng || row.Lon || row.Lng || '';
            const lat = parseFloat(latRaw.toString().replace(',', '.'));
            const lng = parseFloat(lngRaw.toString().replace(',', '.'));

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            markersAdded++;

            const popup = [
                '<div class="permit-popup">',
                '<div class="permit-header">',
                '<strong>' + (row.NumeroPermiso || 'S/N') + '</strong>',
                '</div>',
                '<div class="permit-details">',
                '<div><strong>Razón Social:</strong> ' + (row.RazonSocial || 'N/A') + '</div>',
                '<div><strong>Estado:</strong> ' + (row.EfId || 'N/A').split('-')[1] || 'N/A' + '</div>',
                '<div><strong>Municipio:</strong> ' + (row.MpoId || 'N/A').split('-')[1] || 'N/A' + '</div>',
                '<div><strong>Estatus:</strong> ' + (row.Estatus || 'N/A') + '</div>',
                '<div><strong>Tipo:</strong> ' + (row.TipoPermiso || 'N/A') + '</div>',
                row.InversionEstimada ? '<div><strong>Inversión:</strong> $' + parseFloat(row.InversionEstimada).toLocaleString('es-MX', { maximumFractionDigits: 2 }) + '</div>' : '',
                row.Compresores ? '<div><strong>Compresores:</strong> ' + row.Compresores + '</div>' : '',
                row.NumeroDespachadores ? '<div><strong>Despachadores:</strong> ' + row.NumeroDespachadores + '</div>' : '',
                row.Cilindros ? '<div><strong>Cilindros:</strong> ' + row.Cilindros + '</div>' : '',
                row.FechaOtorgamiento ? '<div><strong>Fecha:</strong> ' + row.FechaOtorgamiento + '</div>' : '',
                '</div>',
                '</div>'
            ].join('');

            const gasNaturalIcon = L.divIcon({
                className: 'electricity-marker-icon',
                html: '<img src="https://cdn.sassoapps.com/iconos_snien/gas_natural.png" style="width: 32px; height: 32px;">',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16]
            });

            const marker = L.marker([lat, lng], {
                icon: gasNaturalIcon,
                zIndexOffset: 1000
            });

            marker.bindPopup(popup);
            marker.permitData = row;
            markersClusterGroup.addLayer(marker);
        });

        console.log('Markers added to cluster:', markersAdded);

        map.addLayer(markersClusterGroup);
        console.log('Cluster group added to map');

        if (markersClusterGroup._featureGroup && map.getPane('markerPane')) {
            const markerPane = map.getPane('markerPane');
            markerPane.style.zIndex = 650;
        }
    }

    function updateGasNaturalTotals(stats) {
        const investmentEl = document.getElementById('total-gasnatural-investment');
        const compressorsEl = document.getElementById('total-gasnatural-compressors');
        const permitsEl = document.getElementById('total-gasnatural-permits');

        if (investmentEl) {
            investmentEl.textContent = '$' + stats.totals.investment.toLocaleString('es-MX', { maximumFractionDigits: 2 });
        }
        if (compressorsEl) {
            compressorsEl.textContent = stats.totals.compressors.toLocaleString('es-MX');
        }
        if (permitsEl) {
            permitsEl.textContent = stats.totals.count.toLocaleString('es-MX');
        }
    }

    function createGasNaturalFilterCards(stats, type) {
        let container, data;

        if (type === 'state') {
            container = document.getElementById('gasnatural-state-cards');
            data = stats.byState;
        } else {
            container = document.getElementById('gasnatural-type-cards');
            data = stats.byType;
        }

        if (!container) return;

        container.innerHTML = '';

        const sortedKeys = Object.keys(data).sort((a, b) => data[b].investment - data[a].investment);

        sortedKeys.forEach(key => {
            const item = data[key];
            const card = document.createElement('div');
            card.className = 'filter-card';
            card.dataset.filterType = type;
            card.dataset.filterValue = key;

            card.innerHTML = `
                <div class="filter-card-header">
                    <div class="filter-card-title">${key}</div>
                    <div class="filter-card-count">${item.count}</div>
                </div>
                <div class="filter-card-stats">
                    <div class="filter-stat">
                        <span class="filter-stat-label">💰 Inversión:</span>
                        <span class="filter-stat-value">$${item.investment.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="filter-stat">
                        <span class="filter-stat-label">⚙️ Compresores:</span>
                        <span class="filter-stat-value">${item.compressors.toLocaleString('es-MX')}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', function () {
                filterGasNaturalPermits(type, key);

                // Update active state
                container.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
            });

            container.appendChild(card);
        });
    }

    function filterGasNaturalPermits(type, value) {
        if (!markersClusterGroup || !gasNaturalPermitsData.length) return;

        currentGasNaturalFilter = { type, value };

        // Clear search box
        clearSearchBox();

        // Clear existing cluster
        map.removeLayer(markersClusterGroup);
        markersClusterGroup.clearLayers();

        // Show/hide geometry layers based on filter type
        if (type === 'state') {
            showStatesLayer(value);
        } else {
            showStatesLayer(null);
        }

        // Filter data
        let filteredData;
        if (type === 'state') {
            const stateId = gasNaturalStats.byState[value] ? gasNaturalStats.byState[value].stateId : null;

            console.log('Filtering by state:', value, 'State ID:', stateId);

            if (stateId) {
                const normalizedFilterId = stateId.toString().trim();

                filteredData = gasNaturalPermitsData.filter(row => {
                    const rowEfId = (row.EfId || '').toString().trim();
                    const rowId = rowEfId.split('-')[0].trim();
                    return rowId === normalizedFilterId || rowEfId.includes(value);
                });
            } else {
                filteredData = gasNaturalPermitsData.filter(row => {
                    const rowEfId = (row.EfId || '').toString().trim();
                    return rowEfId.includes(value);
                });
            }
        } else if (type === 'type') {
            filteredData = gasNaturalPermitsData.filter(row =>
                (row.TipoPermiso || 'Sin Tipo').trim() === value
            );
        }

        // Store filtered data for search
        currentGasNaturalFilteredData = filteredData;
        console.log('Gas Natural filter applied:', type, value, '- Showing', filteredData.length, 'permits');

        // Recalculate stats for filtered data
        const filteredStats = calculateGasNaturalStats(filteredData);
        updateGasNaturalTotals(filteredStats);

        // Update charts with filtered data
        updateGasNaturalCharts(filteredStats);

        // Redraw markers with filtered data
        drawGasNaturalMarkersOnly(filteredData);
    }

    function resetGasNaturalFilters() {
        currentGasNaturalFilter = null;
        currentGasNaturalFilteredData = [];

        console.log('Gas Natural filters reset - searching in all', gasNaturalPermitsData.length, 'permits');

        // Clear search box
        clearSearchBox();

        // Remove active class from all cards
        document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));

        // Show layer based on active tab
        const activeTab = document.querySelector('.filter-tab-gasnatural.active');
        if (activeTab) {
            const tabType = activeTab.dataset.tab;

            if (tabType === 'state') {
                showStatesLayer(null);
            } else {
                showStatesLayer(null);
            }
        } else {
            showStatesLayer(null);
        }

        // Recalculate stats for all data
        updateGasNaturalTotals(gasNaturalStats);

        // Update charts with all data
        updateGasNaturalCharts(gasNaturalStats);

        // Redraw all markers
        if (gasNaturalPermitsData.length) {
            drawGasNaturalMarkersOnly(gasNaturalPermitsData);
        }
    }

    // ==========================================
    // GAS NATURAL CHARTS FUNCTIONS
    // ==========================================

    function createGasNaturalCharts(stats) {
        createGasNaturalTypeChart(stats);
        createGasNaturalStatesChart(stats);
    }

    function createGasNaturalTypeChart(stats) {
        const ctx = document.getElementById('gasnatural-type-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (gasNaturalTypeChart) {
            gasNaturalTypeChart.destroy();
        }

        // Prepare data
        const types = Object.keys(stats.byType).sort((a, b) =>
            stats.byType[b].count - stats.byType[a].count
        );

        const data = types.map(type => stats.byType[type].count);
        const colors = [
            '#601623', '#1f7a62', '#8B1E3F', '#24a47a', '#C41E3A',
            '#0D5C4A', '#7a2432', '#165845', '#4a0e16', '#2d9575'
        ];

        gasNaturalTypeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: types,
                datasets: [{
                    label: 'Número de Permisos',
                    data: data,
                    backgroundColor: colors.slice(0, types.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: {
                                family: "'Montserrat', sans-serif",
                                size: 11
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Distribución por Tipo de Permiso',
                        font: {
                            family: "'Montserrat', sans-serif",
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#601623'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value.toLocaleString('es-MX')} permisos (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function createGasNaturalStatesChart(stats) {
        const ctx = document.getElementById('gasnatural-states-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (gasNaturalStatesChart) {
            gasNaturalStatesChart.destroy();
        }

        // Get top 10 states by investment
        const states = Object.keys(stats.byState).sort((a, b) =>
            stats.byState[b].investment - stats.byState[a].investment
        ).slice(0, 10);

        const data = states.map(state => stats.byState[state].investment);

        gasNaturalStatesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: states,
                datasets: [{
                    label: 'Inversión ($)',
                    data: data,
                    backgroundColor: '#601623',
                    borderColor: '#4a0e16',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Top 10 Estados por Inversión',
                        font: {
                            family: "'Montserrat', sans-serif",
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#601623'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.parsed.x || 0;
                                return `$${value.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return '$' + value.toLocaleString('es-MX');
                            }
                        }
                    }
                }
            }
        });
    }

    function updateGasNaturalCharts(stats) {
        updateGasNaturalTypeChart(stats);
        updateGasNaturalStatesChart(stats);
    }

    function updateGasNaturalTypeChart(stats) {
        if (!gasNaturalTypeChart) {
            createGasNaturalTypeChart(stats);
            return;
        }

        const types = Object.keys(stats.byType).sort((a, b) =>
            stats.byType[b].count - stats.byType[a].count
        );
        const data = types.map(type => stats.byType[type].count);

        gasNaturalTypeChart.data.labels = types;
        gasNaturalTypeChart.data.datasets[0].data = data;
        gasNaturalTypeChart.update();
    }

    function updateGasNaturalStatesChart(stats) {
        if (!gasNaturalStatesChart) {
            createGasNaturalStatesChart(stats);
            return;
        }

        const states = Object.keys(stats.byState).sort((a, b) =>
            stats.byState[b].investment - stats.byState[a].investment
        ).slice(0, 10);
        const data = states.map(state => stats.byState[state].investment);

        gasNaturalStatesChart.data.labels = states;
        gasNaturalStatesChart.data.datasets[0].data = data;
        gasNaturalStatesChart.update();
    }

    async function loadAndRender(options) {
        const silent = options && options.silent;
        const sourceUrl = (currentSheetUrl || '').trim();
        if (!hasValidSheetUrl(sourceUrl)) {
            clearData();
            return;
        }
        const expectedUrl = sourceUrl;
        if (!silent) {
            togglePreloader(true);
        }
        try {
            const cacheBuster = 'cb=' + Date.now();
            const url = sourceUrl + (sourceUrl.includes('?') ? '&' : '?') + cacheBuster;
            const response = await fetch(url, { cache: 'no-store' });
            const csvText = await response.text();
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            if (expectedUrl === (currentSheetUrl || '').trim()) {
                const selectedInstrument = instrumentSelect.value;
                const mapConfig = selectedInstrument && mapConfigurations[selectedInstrument] ? mapConfigurations[selectedInstrument].find(m => m.name === currentMapTitle) : null;

                // Use cluster function for electricity, petroliferos, gas LP and gas natural permits
                if (mapConfig && mapConfig.useClusters) {
                    if (mapConfig.mapType === 'petroliferos') {
                        drawPetroliferosPermits(parsed.data);
                    } else if (mapConfig.mapType === 'gaslp') {
                        drawGasLPPermits(parsed.data);
                    } else if (mapConfig.mapType === 'gasnatural') {
                        drawGasNaturalPermits(parsed.data);
                    } else {
                        drawElectricityPermits(parsed.data);
                    }
                } else {
                    drawRows(parsed.data, mapConfig);
                }

                updateTimestamp();
            }
        } catch (error) {
            console.error('Fallo de carga:', error);
        } finally {
            if (!silent) {
                togglePreloader(false);
            }
        }
    }

    async function loadElectrificationMap(mapConfig) {
        togglePreloader(true);
        try {
            // Fetch both data sources in parallel
            const [municipalitiesResponse, sheetResponse] = await Promise.all([
                fetch(mapConfig.municipalitiesGeojsonUrl),
                fetch(mapConfig.googleSheetUrl)
            ]);

            municipalitiesData = await municipalitiesResponse.json();
            const csvText = await sheetResponse.text();
            electrificationData = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;

            // Load the regional control areas
            if (mapConfig.geojsonUrl) {
                await loadGeoJSON(mapConfig.geojsonUrl, {
                    type: mapConfig.geojsonUrlType,
                    mapConfig: mapConfig
                });
            }

        } catch (error) {
            console.error('Error loading electrification map:', error);
        } finally {
            togglePreloader(false);
        }
    }

    async function loadPIBForecastMap(mapConfig) {
        togglePreloader(true);
        try {
            // Load GeoJSON and Google Sheets data in parallel
            const [geoJsonResponse, sheetResponse] = await Promise.all([
                fetch(mapConfig.geojsonUrl),
                fetch(mapConfig.googleSheetUrl + (mapConfig.googleSheetUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now())
            ]);

            const geoJsonData = await geoJsonResponse.json();
            const csvText = await sheetResponse.text();
            const pibData = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;

            // Create a map for quick lookup
            const pibDataMap = new Map(pibData.map(row => [row.GCR, row]));

            // Extract SEN and SIN data from columns G, H, I
            pibSenData = null;
            pibSinData = null;

            if (pibData.length > 0) {
                pibSenData = { '2025-2030': 'N/A', '2025-2039': 'N/A' };
                pibSinData = { '2025-2030': 'N/A', '2025-2039': 'N/A' };

                // Look for rows with SISTEMA, TMCA(%), AÑOS columns
                pibData.forEach(row => {
                    const sistema = row['SISTEMA'] || '';
                    const tmca = row['TMCA(%)'] || row['TMACA(%)'] || '';
                    const años = row['AÑOS'] || row['ANOS'] || '';

                    console.log('Row:', sistema, tmca, años);

                    if (sistema.includes('SEN')) {
                        if (años.includes('2025-2030')) {
                            pibSenData['2025-2030'] = tmca;
                            console.log('Found SEN 2025-2030:', tmca);
                        }
                        if (años.includes('2025-2039') || años.includes('2025- 2039')) {
                            pibSenData['2025-2039'] = tmca;
                            console.log('Found SEN 2025-2039:', tmca);
                        }
                    }

                    if (sistema.includes('SIN')) {
                        if (años.includes('2025-2030')) {
                            pibSinData['2025-2030'] = tmca;
                            console.log('Found SIN 2025-2030:', tmca);
                        }
                        if (años.includes('2025-2039') || años.includes('2025- 2039')) {
                            pibSinData['2025-2039'] = tmca;
                            console.log('Found SIN 2025-2039:', tmca);
                        }
                    }
                });
            }

            console.log('Final SEN data:', pibSenData);
            console.log('Final SIN data:', pibSinData);

            // Specific coordinates for Baja California regions
            const bajaCaliforniaCoords = {
                'Baja California': { lat: 32.3, lng: -115.5 },      // Cerca de la frontera (Tijuana/Mexicali)
                'Baja California Sur': { lat: 23.5, lng: -110.0 },  // Cerca de Los Cabos (era Mulegé)
                'Mulegé': { lat: 28.5, lng: -113.0 }                // Centro-norte península (era Baja California Sur)
            };

            // Load GeoJSON first
            await loadGeoJSON(mapConfig.geojsonUrl, { type: mapConfig.geojsonUrlType });

            // Add labels for each region using the loaded layer
            if (geoJsonLayer) {
                geoJsonLayer.eachLayer(layer => {
                    const regionName = layer.feature.properties.name;
                    const pibInfo = pibDataMap.get(regionName);

                    if (pibInfo) {
                        // Get the center of the layer bounds
                        const bounds = layer.getBounds();
                        let center = bounds.getCenter();

                        // Override position for Baja California to move it to the border
                        if (regionName === 'Baja California') {
                            center = L.latLng(bajaCaliforniaCoords['Baja California'].lat, bajaCaliforniaCoords['Baja California'].lng);
                        }

                        // Create two markers for each value
                        const gcrName = regionName;
                        const value2025_2030 = pibInfo['2025-2030'] || 'N/A';
                        const value2025_2039 = pibInfo['2025-2039'] || 'N/A';

                        console.log('Creating labels for:', regionName, gcrName, value2025_2030, value2025_2039);

                        // Create single marker with both values
                        const marker = L.marker([center.lat, center.lng], {
                            icon: L.divIcon({
                                className: 'pib-label',
                                html: `<div class="pib-label-content">
                                    <div class="pib-label-id">${gcrName}</div>
                                    <div class="pib-row pib-row-2030">
                                        <span class="pib-value">${value2025_2030}%</span>
                                    </div>
                                    <div class="pib-row pib-row-2039">
                                        <span class="pib-value">${value2025_2039}%</span>
                                    </div>
                                </div>`,
                                iconSize: [80, 42]
                            })
                        });

                        marker.addTo(markersLayer);
                    }
                });
            }

            // Add special points for Baja California Sur and Mulegé
            ['Baja California Sur', 'Mulegé'].forEach(regionName => {
                const pibInfo = pibDataMap.get(regionName);
                const coords = bajaCaliforniaCoords[regionName];

                if (pibInfo && coords) {
                    const gcrName = regionName;
                    const value2025_2030 = pibInfo['2025-2030'] || 'N/A';
                    const value2025_2039 = pibInfo['2025-2039'] || 'N/A';

                    console.log('Creating special point for:', regionName, gcrName, value2025_2030, value2025_2039);

                    const marker = L.marker([coords.lat, coords.lng], {
                        icon: L.divIcon({
                            className: 'pib-label',
                            html: `<div class="pib-label-content">
                                <div class="pib-label-id">${gcrName}</div>
                                <div class="pib-row pib-row-2030">
                                    <span class="pib-value">${value2025_2030}%</span>
                                </div>
                                <div class="pib-row pib-row-2039">
                                    <span class="pib-value">${value2025_2039}%</span>
                                </div>
                            </div>`,
                            iconSize: [80, 42]
                        })
                    });

                    marker.addTo(markersLayer);
                }
            });

            updateTimestamp();

        } catch (error) {
            console.error('Error loading PIB forecast map:', error);
        } finally {
            togglePreloader(false);
        }
    }

    async function loadConsumptionForecastMap(mapConfig) {
        // Reutilizar la misma función que PIB pero con el nuevo Google Sheets
        await loadPIBForecastMap(mapConfig);
    }

    async function loadCapacityAdditionsMap(mapConfig) {
        togglePreloader(true);
        try {
            // Load GeoJSON and Google Sheets data in parallel
            const [geoJsonResponse, sheetResponse] = await Promise.all([
                fetch(mapConfig.geojsonUrl),
                fetch(mapConfig.googleSheetUrl + (mapConfig.googleSheetUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now())
            ]);

            const geoJsonData = await geoJsonResponse.json();
            const csvText = await sheetResponse.text();
            const capacityData = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;

            // Get dynamic column names (excluding Id, GCR, and UNIDADES)
            const allColumns = capacityData.length > 0 ? Object.keys(capacityData[0]) : [];
            const capacityColumns = allColumns.filter(col =>
                col !== 'Id' && col !== 'GCR' && col !== 'UNIDADES' && col.trim() !== ''
            );

            console.log('Capacity columns found:', capacityColumns);

            // Create a map for quick lookup
            const capacityDataMap = new Map();

            // Function to check if a technology is storage
            const isStorageTech = (techName) => {
                const upperTech = techName.toUpperCase().trim();
                return upperTech.includes('ALMACENAMIENTO') ||
                    upperTech.includes('BATERIA') ||
                    upperTech.includes('BATERÍAS') ||
                    upperTech === 'ALM' ||
                    upperTech.startsWith('ALM ') ||
                    upperTech.includes('STORAGE');
            };

            // Calculate totals by column and row, separating generation and storage
            const columnTotals = {};
            capacityColumns.forEach(col => columnTotals[col] = 0);
            let grandTotal = 0;
            let storageTotal = 0;
            let generationTotal = 0;

            capacityData.forEach(row => {
                const gcrName = row.GCR;
                let rowTotal = 0;
                let rowStorageTotal = 0;
                let rowGenerationTotal = 0;
                const rowData = { GCR: gcrName };

                capacityColumns.forEach(col => {
                    const value = parseFloat(row[col] || 0);
                    rowData[col] = value;
                    rowTotal += value;
                    columnTotals[col] += value;

                    if (isStorageTech(col)) {
                        rowStorageTotal += value;
                        storageTotal += value;
                    } else {
                        rowGenerationTotal += value;
                        generationTotal += value;
                    }
                });

                rowData.TOTAL = rowTotal;
                rowData.STORAGE_TOTAL = rowStorageTotal;
                rowData.GENERATION_TOTAL = rowGenerationTotal;
                grandTotal += rowTotal;
                capacityDataMap.set(gcrName, rowData);
            });

            // Store totals globally
            capacityTotals = {
                columns: columnTotals,
                total: grandTotal,
                storageTotal: storageTotal,
                generationTotal: generationTotal,
                columnNames: capacityColumns
            };

            console.log('Capacity totals:', capacityTotals);

            // Specific coordinates for Baja California regions and adjusted positions
            const bajaCaliforniaCoords = {
                'Baja California': { lat: 32.3, lng: -115.5 },
                'Baja California Sur': { lat: 23.5, lng: -111.5 },  // Movido más a la izquierda (antes -110.0)
                'Mulegé': { lat: 28.5, lng: -113.0 }                // Centro-norte península (era Baja California Sur)
            };

            // Load GeoJSON first
            await loadGeoJSON(mapConfig.geojsonUrl, { type: mapConfig.geojsonUrlType });

            // Add labels for each region
            if (geoJsonLayer) {
                geoJsonLayer.eachLayer(layer => {
                    const regionName = layer.feature.properties.name;
                    const capacityInfo = capacityDataMap.get(regionName);

                    if (capacityInfo) {
                        const bounds = layer.getBounds();
                        let center = bounds.getCenter();

                        // Override position for Baja California and Noroeste
                        if (regionName === 'Baja California') {
                            center = L.latLng(bajaCaliforniaCoords['Baja California'].lat, bajaCaliforniaCoords['Baja California'].lng);
                        } else if (regionName === 'Noroeste') {
                            center.lat += 2.0; // Move label further up to avoid being covered
                        } const gcrName = regionName;
                        const total = capacityInfo.TOTAL || 0;
                        const storageTotal = capacityInfo.STORAGE_TOTAL || 0;
                        const generationTotal = capacityInfo.GENERATION_TOTAL || 0;

                        // Only show label if there's capacity > 0
                        if (total > 0) {
                            // Build label HTML dynamically
                            let labelHTML = `<div class="pib-label-content">
                                <div class="pib-label-id">${gcrName}</div>`;

                            // Add each capacity type with consistent technology colors and acronyms
                            capacityColumns.forEach((col, index) => {
                                const value = capacityInfo[col] || 0;
                                if (value > 0 && !isStorageTech(col)) {
                                    const color = getTechnologyColor(col);
                                    const acronym = getTechnologyAcronym(col);
                                    labelHTML += `<div class="pib-row" style="color: ${color};">
                                        <span class="pib-value">${acronym}: ${value.toLocaleString('es-MX')} MW</span>
                                    </div>`;
                                }
                            });

                            labelHTML += `<div style="border-top: 1px solid #333; margin-top: 2px; padding-top: 2px;">`;
                            if (generationTotal > 0) {
                                labelHTML += `<div style="font-size: 11px; font-weight: 700; color: #1a1a1a;">CAP: ${generationTotal.toLocaleString('es-MX')} MW</div>`;
                            }
                            if (storageTotal > 0) {
                                labelHTML += `<div style="font-size: 11px; font-weight: 700; color: #9932CC;">ALM: ${storageTotal.toLocaleString('es-MX')} MW</div>`;
                            }
                            labelHTML += `</div></div>`;

                            const marker = L.marker([center.lat, center.lng], {
                                icon: L.divIcon({
                                    className: 'pib-label',
                                    html: labelHTML,
                                    iconSize: [90, 60 + (capacityColumns.filter(col => (capacityInfo[col] || 0) > 0).length * 5)]
                                })
                            });

                            marker.addTo(markersLayer);
                        }
                    }
                });
            }

            // Add special points for Baja California Sur and Mulegé if they have capacity
            ['Baja California Sur', 'Mulegé'].forEach(regionName => {
                const capacityInfo = capacityDataMap.get(regionName);
                const coords = bajaCaliforniaCoords[regionName];

                if (capacityInfo && coords) {
                    const gcrName = regionName;
                    const total = capacityInfo.TOTAL || 0;
                    const storageTotal = capacityInfo.STORAGE_TOTAL || 0;
                    const generationTotal = capacityInfo.GENERATION_TOTAL || 0;

                    if (total > 0) {
                        // Build label HTML dynamically
                        let labelHTML = `<div class="pib-label-content">
                            <div class="pib-label-id">${gcrName}</div>`;

                        // Add each capacity type with consistent technology colors and acronyms
                        capacityColumns.forEach((col, index) => {
                            const value = capacityInfo[col] || 0;
                            if (value > 0 && !isStorageTech(col)) {
                                const color = getTechnologyColor(col);
                                const acronym = getTechnologyAcronym(col);
                                labelHTML += `<div class="pib-row" style="color: ${color};">
                                    <span class="pib-value">${acronym}: ${value.toLocaleString('es-MX')} MW</span>
                                </div>`;
                            }
                        });

                        labelHTML += `<div style="border-top: 1px solid #333; margin-top: 2px; padding-top: 2px;">`;
                        if (generationTotal > 0) {
                            labelHTML += `<div style="font-size: 11px; font-weight: 700; color: #1a1a1a;">CAP: ${generationTotal.toLocaleString('es-MX')} MW</div>`;
                        }
                        if (storageTotal > 0) {
                            labelHTML += `<div style="font-size: 11px; font-weight: 700; color: #9932CC;">ALM: ${storageTotal.toLocaleString('es-MX')} MW</div>`;
                        }
                        labelHTML += `</div></div>`;

                        const marker = L.marker([coords.lat, coords.lng], {
                            icon: L.divIcon({
                                className: 'pib-label',
                                html: labelHTML,
                                iconSize: [90, 60 + (capacityColumns.filter(col => (capacityInfo[col] || 0) > 0).length * 5)]
                            })
                        });

                        marker.addTo(markersLayer);
                    }
                }
            });

            // Add legend with capacity totals
            addCapacityLegend(capacityTotals, mapConfig.name);

            updateTimestamp();

        } catch (error) {
            console.error('Error loading capacity additions map:', error);
        } finally {
            togglePreloader(false);
        }
    }

    async function loadTotalCapacityAdditionsMap(mapConfig) {

        togglePreloader(true);

        try {

            // Load aggregated data and GeoJSON in parallel

            const [aggregatedData, geoJsonResponse] = await Promise.all([

                loadTotalCapacityData(),

                fetch(mapConfig.geojsonUrl)

            ]);



            const geoJsonData = await geoJsonResponse.json();



            // Get dynamic column names robustly from the union of all aggregated rows
            const capacityColumns = Array.from(new Set(
                aggregatedData.flatMap(row => Object.keys(row))
            )).filter(col => col !== 'Gerencia de Control Regional' && col !== 'GCR' && col.trim() !== '');



            console.log('Aggregated capacity columns found:', capacityColumns);



            const capacityDataMap = new Map();

            // Function to check if a technology is storage
            const isStorageTech = (techName) => {
                const upperTech = techName.toUpperCase().trim();
                return upperTech.includes('ALMACENAMIENTO') ||
                    upperTech.includes('BATERIA') ||
                    upperTech.includes('BATERÍAS') ||
                    upperTech === 'ALM' ||
                    upperTech.startsWith('ALM ') ||
                    upperTech.includes('STORAGE');
            };

            const columnTotals = {};

            capacityColumns.forEach(col => columnTotals[col] = 0);

            let grandTotal = 0;
            let storageTotal = 0;
            let generationTotal = 0;



            aggregatedData.forEach(row => {

                const gcrName = row['Gerencia de Control Regional'];

                let rowTotal = 0;
                let rowStorageTotal = 0;
                let rowGenerationTotal = 0;

                const rowData = { GCR: gcrName };



                capacityColumns.forEach(col => {

                    const value = parseFloat(row[col] || 0);

                    rowData[col] = value;

                    rowTotal += value;

                    columnTotals[col] += value;

                    if (isStorageTech(col)) {
                        rowStorageTotal += value;
                        storageTotal += value;
                    } else {
                        rowGenerationTotal += value;
                        generationTotal += value;
                    }

                });



                rowData.TOTAL = rowTotal;
                rowData.STORAGE_TOTAL = rowStorageTotal;
                rowData.GENERATION_TOTAL = rowGenerationTotal;

                grandTotal += rowTotal;

                capacityDataMap.set(gcrName, rowData);

            });



            capacityTotals = {

                columns: columnTotals,

                total: grandTotal,

                storageTotal: storageTotal,

                generationTotal: generationTotal,

                columnNames: capacityColumns

            };



            console.log('Aggregated capacity totals:', capacityTotals);



            const bajaCaliforniaCoords = {

                'Baja California': { lat: 32.3, lng: -115.5 },

                'Baja California Sur': { lat: 23.5, lng: -111.5 },  // Movido más a la izquierda

                'Mulegé': { lat: 28.5, lng: -113.0 }

            };



            await loadGeoJSON(mapConfig.geojsonUrl, { type: mapConfig.geojsonUrlType });



            if (geoJsonLayer) {

                geoJsonLayer.eachLayer(layer => {

                    const regionName = layer.feature.properties.name;

                    const capacityInfo = capacityDataMap.get(regionName);



                    if (capacityInfo) {

                        const bounds = layer.getBounds();

                        let center = bounds.getCenter();



                        if (regionName === 'Baja California') {

                            center = L.latLng(bajaCaliforniaCoords['Baja California'].lat, bajaCaliforniaCoords['Baja California'].lng);

                        } else if (regionName === 'Noroeste') {
                            center.lat += 2.0; // Move label further up to avoid being covered
                        }



                        const gcrName = regionName;

                        const total = capacityInfo.TOTAL || 0;



                        if (total > 0) {
                            const storageTotal = capacityInfo.STORAGE_TOTAL || 0;
                            const generationTotal = capacityInfo.GENERATION_TOTAL || 0;

                            // Build label HTML dynamically
                            let labelHTML = `<div class="pib-label-content">
                                    <div class="pib-label-id">${gcrName}</div>`;

                            // Add each capacity type with consistent technology colors and acronyms
                            capacityColumns.forEach((col, index) => {
                                const value = capacityInfo[col] || 0;
                                if (value > 0 && !isStorageTech(col)) {
                                    const color = getTechnologyColor(col);
                                    const acronym = getTechnologyAcronym(col);
                                    labelHTML += `<div class="pib-row" style="color: ${color};">
                                            <span class="pib-value">${acronym}: ${value.toLocaleString('es-MX')} MW</span>
                                        </div>`;
                                }
                            });

                            labelHTML += `<div style="border-top: 1px solid #333; margin-top: 2px; padding-top: 2px;">`;
                            if (generationTotal > 0) {
                                labelHTML += `<div style="font-size: 11px; font-weight: 700; color: #1a1a1a;">CAP: ${generationTotal.toLocaleString('es-MX')} MW</div>`;
                            }
                            if (storageTotal > 0) {
                                labelHTML += `<div style="font-size: 11px; font-weight: 700; color: #9932CC;">ALM: ${storageTotal.toLocaleString('es-MX')} MW</div>`;
                            }
                            labelHTML += `</div></div>`;

                            const marker = L.marker([center.lat, center.lng], {
                                icon: L.divIcon({
                                    className: 'pib-label',
                                    html: labelHTML,
                                    iconSize: [90, 60 + (capacityColumns.filter(col => (capacityInfo[col] || 0) > 0).length * 5)]
                                })
                            }).addTo(instrumentLayerGroup);

                            // Bind a simple popup for consistency, though the main label has the info
                            layer.bindPopup(`<strong>${gcrName}</strong><br>Capacidad Total: ${total.toLocaleString('es-MX')} MW`);
                        }

                    }

                });

            }



            // Manually add labels for Baja California Sur and Mulegé as they are not in the GeoJSON

            ['Baja California Sur', 'Mulegé'].forEach(regionName => {

                const capacityInfo = capacityDataMap.get(regionName);



                if (capacityInfo) {

                    const center = L.latLng(bajaCaliforniaCoords[regionName].lat, bajaCaliforniaCoords[regionName].lng);

                    const total = capacityInfo.TOTAL || 0;



                    if (total > 0) {
                        const storageTotal = capacityInfo.STORAGE_TOTAL || 0;
                        const generationTotal = capacityInfo.GENERATION_TOTAL || 0;

                        // Build label HTML dynamically
                        let labelHTML = `<div class="pib-label-content">
                                <div class="pib-label-id">${regionName}</div>`;

                        // Add each capacity type with consistent technology colors and acronyms
                        capacityColumns.forEach((col, index) => {
                            const value = capacityInfo[col] || 0;
                            if (value > 0 && !isStorageTech(col)) {
                                const color = getTechnologyColor(col);
                                const acronym = getTechnologyAcronym(col);
                                labelHTML += `<div class="pib-row" style="color: ${color};">
                                        <span class="pib-value">${acronym}: ${value.toLocaleString('es-MX')} MW</span>
                                    </div>`;
                            }
                        });

                        labelHTML += `<div style="border-top: 1px solid #333; margin-top: 2px; padding-top: 2px;">`;
                        if (generationTotal > 0) {
                            labelHTML += `<div style="font-size: 11px; font-weight: 700; color: #1a1a1a;">CAP: ${generationTotal.toLocaleString('es-MX')} MW</div>`;
                        }
                        if (storageTotal > 0) {
                            labelHTML += `<div style="font-size: 11px; font-weight: 700; color: #9932CC;">ALM: ${storageTotal.toLocaleString('es-MX')} MW</div>`;
                        }
                        labelHTML += `</div></div>`;

                        const marker = L.marker(center, {
                            icon: L.divIcon({
                                className: 'pib-label',
                                html: labelHTML,
                                iconSize: [90, 60 + (capacityColumns.filter(col => (capacityInfo[col] || 0) > 0).length * 5)]
                            })
                        }).addTo(instrumentLayerGroup);

                        // Bind a simple popup for consistency
                        marker.bindPopup(`<strong>${regionName}</strong><br>Capacidad Total: ${total.toLocaleString('es-MX')} MW`);
                    }

                }

            });



            // CALL SPECIAL LEGEND FUNCTION FOR TOTAL CAPACITY MAP (TWO COLUMNS, BOTTOM)
            console.log('📊 Agregando leyenda de totales con datos:', capacityTotals);
            addTotalCapacityLegendTwoColumns(capacityTotals, mapConfig.name);
            console.log('✅ Leyenda de totales agregada al mapa');



        } catch (error) {

            console.error('Error loading total capacity additions map:', error);

            if (typeof showNotification === 'function') {

                showNotification('Error al cargar el mapa de adiciones totales', error.message, 'error');

            }

        } finally {

            togglePreloader(false);

        }

    }        // Event listeners
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function () {
            const selectedInstrument = instrumentSelect.value;
            const selectedMapName = mapSelect.value;

            if (selectedInstrument && selectedMapName && mapConfigurations[selectedInstrument]) {
                const mapConfig = mapConfigurations[selectedInstrument].find(m => m.name === selectedMapName);

                // Si es el mapa de electrificación
                if (mapConfig && mapConfig.name === 'Figuras 2.15 a 2.22. Municipios con localidades sin electrificar') {
                    togglePreloader(true);
                    try {
                        // Recargar solo los datos del Google Sheets
                        const cacheBuster = 'cb=' + Date.now();
                        const url = mapConfig.googleSheetUrl + (mapConfig.googleSheetUrl.includes('?') ? '&' : '?') + cacheBuster;
                        const response = await fetch(url, { cache: 'no-store' });
                        const csvText = await response.text();
                        electrificationData = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;

                        console.log('Datos de electrificación actualizados:', electrificationData.length, 'registros');

                        // Si hay una región enfocada, actualizar los municipios mostrados
                        if (focusedRegion) {
                            // Trigger click event on the focused region to refresh municipalities
                            municipalitiesLayerGroup.clearLayers();

                            const electrificationDataMap = new Map(electrificationData.map(row => [row.CVEGEO, row]));
                            const filteredFeatures = municipalitiesData.features.filter(f => {
                                const municipalityData = electrificationDataMap.get(f.properties.CVEGEO);
                                return municipalityData && municipalityData.GCR === focusedRegion;
                            });

                            // Re-render municipalities with updated data
                            const regionColors = {
                                "Baja California": "#939594",
                                "Central": "#6A1C32",
                                "Noreste": "#235B4E",
                                "Noroeste": "#DDC9A4",
                                "Norte": "#10302B",
                                "Occidental": "#BC955C",
                                "Oriental": "#9F2240",
                                "Peninsular": "#A16F4A"
                            };

                            function getColor(pendientes) {
                                const p = parseInt(pendientes, 10);
                                if (isNaN(p)) return '#ccc';
                                if (p === 0) return '#F2D7D9';
                                if (p <= 20) return '#E0B0B6';
                                if (p <= 40) return '#CC8893';
                                if (p <= 60) return '#B86070';
                                if (p <= 80) return '#A3384D';
                                return '#601623';
                            }

                            const municipalitiesLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
                                style: function (feature) {
                                    const municipalityData = electrificationDataMap.get(feature.properties.CVEGEO);
                                    if (!municipalityData || municipalityData.PENDIENTE === undefined || municipalityData.PENDIENTE === null) {
                                        return { fillOpacity: 0, opacity: 0, interactive: false };
                                    }
                                    const pendientes = municipalityData.PENDIENTE;
                                    return {
                                        fillColor: getColor(pendientes),
                                        weight: 1,
                                        opacity: 1,
                                        color: 'white',
                                        fillOpacity: 0.8
                                    };
                                },
                                onEachFeature: function (feature, layer) {
                                    const municipalityData = electrificationDataMap.get(feature.properties.CVEGEO);
                                    const pendientes = municipalityData ? municipalityData.PENDIENTE : 'N/A';
                                    const gcr = municipalityData ? municipalityData.GCR : 'N/A';
                                    const cvegeo = feature.properties.CVEGEO || 'N/A';
                                    const nomgeo = feature.properties.NOMGEO || 'Sin nombre';

                                    const popupContent = `
                                        <div style="font-family: 'Montserrat', sans-serif;">
                                            <strong style="font-size: 14px; color: #601623;">${nomgeo}</strong><br>
                                            <strong>CVEGEO:</strong> ${cvegeo}<br>
                                            <strong>GCR:</strong> ${gcr}<br>
                                            <strong>Localidades pendientes:</strong> ${pendientes}
                                        </div>
                                    `;

                                    layer.bindTooltip(popupContent, {
                                        permanent: false,
                                        direction: 'top',
                                        className: 'municipality-tooltip'
                                    });

                                    layer.on('mouseover', function (e) {
                                        console.log('Municipio hover:', {
                                            CVEGEO: cvegeo,
                                            NOMGEO: nomgeo,
                                            GCR: gcr,
                                            PENDIENTE: pendientes
                                        });
                                    });
                                }
                            });

                            municipalitiesLayerGroup.addLayer(municipalitiesLayer);
                            if (typeof municipalitiesLayer.bringToFront === 'function') {
                                municipalitiesLayer.bringToFront();
                            }
                        }

                        updateTimestamp();
                    } catch (error) {
                        console.error('Error actualizando datos de electrificación:', error);
                    } finally {
                        togglePreloader(false);
                    }
                } else if (mapConfig && mapConfig.name === 'Figura 3.5. Pronóstico regional del PIB, escenario de planeación 2025 - 2030 y 2025-2039') {
                    // Recargar datos del mapa PIB
                    await loadPIBForecastMap(mapConfig);
                } else if (mapConfig && mapConfig.name === 'Figura 3.9. Pronósticos del consumo bruto 2025 - 2030 y 2025 - 2039') {
                    // Recargar datos del mapa de consumo
                    await loadConsumptionForecastMap(mapConfig);
                } else if (mapConfig && mapConfig.name === 'Figura 4.3. Adiciones de Capacidad de proyectos de fortalecimiento de la CFE 2025 - 2027') {
                    // Recargar datos del mapa de adiciones de capacidad CFE
                    await loadCapacityAdditionsMap(mapConfig);
                } else if (mapConfig && mapConfig.name === 'Figura 4.4. Adiciones de capacidad de proyectos del Estado 2027 - 2030') {
                    // Recargar datos del mapa de adiciones de capacidad del Estado
                    await loadCapacityAdditionsMap(mapConfig);
                } else if (mapConfig && mapConfig.name === 'Figura 4.5. Adiciones de capacidad de proyectos con prelación 2025 - 2030') {
                    // Recargar datos del mapa de adiciones de capacidad por Particulares
                    await loadCapacityAdditionsMap(mapConfig);
                } else if (mapConfig && mapConfig.name === 'Figura 4.6. Adición de capacidad para desarrollarse por particulares 2026 - 2030') {
                    // Recargar datos del mapa de adiciones de capacidad para desarrollarse por Particulares
                    await loadCapacityAdditionsMap(mapConfig);
                } else if (mapConfig && mapConfig.name === 'Adición de capacidad 2025-2030') {
                    // Recargar datos del mapa de adiciones de capacidad totales
                    await loadTotalCapacityAdditionsMap(mapConfig);
                } else {
                    // Para otros mapas (incluyendo Figura 2.1), recargar GeoJSON y datos
                    togglePreloader(true);
                    try {
                        // Limpiar capas actuales
                        instrumentLayerGroup.clearLayers();
                        connectionsLayerGroup.clearLayers();
                        clearInsetLayers();

                        // Recargar geometrías (regiones/líneas)
                        if (mapConfig.geojsonUrl) {
                            await loadGeoJSON(mapConfig.geojsonUrl, { type: mapConfig.geojsonUrlType });
                        }
                        if (mapConfig.connectionsGeojsonUrl) {
                            await loadConnectionsGeoJSON(mapConfig.connectionsGeojsonUrl, { showPreloader: false, clear: true });
                        }

                        // Recargar datos de Google Sheets si existen
                        if (mapConfig.googleSheetUrl && hasValidSheetUrl(mapConfig.googleSheetUrl)) {
                            currentSheetUrl = mapConfig.googleSheetUrl;
                            await loadAndRender({ silent: false });
                        }

                        console.log('✅ Mapa actualizado:', mapConfig.name);
                    } catch (error) {
                        console.error('Error actualizando mapa:', error);
                    } finally {
                        togglePreloader(false);
                    }
                }
            } else {
                loadAndRender({ silent: false });
            }
        });
    }

    // Cargar datos iniciales
    loadAndRender({ silent: false });
    loadMarinasGeoJSON('https://cdn.sassoapps.com/Mapas/Electricidad/regionmarinamx.geojson');

    if (REFRESH_MS > 0) {
        setInterval(function () {
            loadAndRender({ silent: true });
        }, REFRESH_MS);
    }

    // Sistema de exportación simplificado manejado por simple-export.js
    console.log('✅ Mapa disponible globalmente para exportación');

    // Update currentMapTitle when a new map is selected
    const mapDescriptionEl = document.getElementById('map-description');


    if (mapSelect) {
        mapSelect.addEventListener('change', async function () {
            console.log('[DEBUG] Mapa seleccionado:', this.value, 'Instrumento actual:', instrumentSelect.value);
            const selectedMapName = this.value;
            const selectedInstrument = instrumentSelect.value;
            instrumentLayerGroup.clearLayers();
            connectionsLayerGroup.clearLayers();
            municipalitiesLayerGroup.clearLayers();
            destroyInsetMaps();
            removeLegend(); // Remove legend when changing map
            removeMunicipalitiesLegend(); // Remove municipalities legend when changing map
            removePIBLegend(); // Remove PIB legend when changing map
            if (selectedRegionBanner) {
                selectedRegionBanner.style.display = 'none'; // Hide region banner when changing map
            }
            clearData();

            if (!selectedMapName) {
                currentSheetUrl = null;
                updateSheetInfo(null, SELECT_MAP_MESSAGE);
                currentMapTitle = DEFAULT_MAP_TITLE;
                updateMapTitleDisplay(DEFAULT_MAP_TITLE);
                syncMapDropdowns('');

                // Hide search field
                const searchGroup = document.getElementById('search-group');
                if (searchGroup) {
                    searchGroup.style.display = 'none';
                }

                if (mapDescriptionEl) {
                    mapDescriptionEl.innerHTML = '';
                    mapDescriptionEl.style.display = 'none';
                }
                if (selectedRegionBanner) {
                    selectedRegionBanner.style.display = 'none';
                }
                return;
            }

            if (selectedInstrument && mapConfigurations[selectedInstrument]) {
                const mapConfig = mapConfigurations[selectedInstrument].find(m => m.name === selectedMapName);
                console.log('[DEBUG] Configuración de mapa encontrada:', mapConfig);
                if (mapConfig) {
                    // Check if map is under construction
                    if (mapConfig.underConstruction) {
                        currentMapTitle = mapConfig.name;
                        updateMapTitleDisplay(currentMapTitle);

                        // Show construction message
                        if (mapDescriptionEl) {
                            const titleEl = document.getElementById('map-description-title');
                            const contentEl = document.getElementById('map-description-content');

                            if (titleEl) {
                                titleEl.innerHTML = '<i class="bi bi-cone-striped"></i> En Construcción';
                                titleEl.style.color = '#f0ad4e';
                            }
                            if (contentEl) {
                                contentEl.innerHTML = 'Este mapa está actualmente en desarrollo. Pronto estará disponible con información actualizada.';
                            }
                            mapDescriptionEl.style.display = 'block';
                        }

                        // Show construction overlay on map
                        const constructionOverlay = document.createElement('div');
                        constructionOverlay.id = 'construction-overlay';
                        constructionOverlay.style.cssText = `
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: rgba(255, 255, 255, 0.9);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 1000;
                            pointer-events: none;
                        `;
                        constructionOverlay.innerHTML = `
                            <div style="text-align: center; font-family: 'Montserrat', sans-serif;">
                                <i class="bi bi-cone-striped" style="font-size: 80px; color: #f0ad4e; display: block; margin-bottom: 20px;"></i>
                                <h2 style="color: #601623; font-size: 32px; margin: 0 0 10px 0;">En Construcción</h2>
                                <p style="color: #555; font-size: 18px; margin: 0;">Este mapa estará disponible próximamente</p>
                            </div>
                        `;

                        // Remove existing construction overlay if any
                        const existing = document.getElementById('construction-overlay');
                        if (existing) existing.remove();

                        // Add to map container
                        document.getElementById('map').appendChild(constructionOverlay);

                        currentSheetUrl = null;
                        updateSheetInfo(null, 'Mapa en construcción');
                        return;
                    }

                    // Remove construction overlay if switching from construction map
                    const existing = document.getElementById('construction-overlay');
                    if (existing) existing.remove();

                    currentMapTitle = mapConfig.name; // Update the current map title
                    updateMapTitleDisplay(currentMapTitle);
                    syncMapDropdowns(mapConfig.name);

                    // Resetear estado de análisis móvil si existe
                    if (window.mobileInterface && typeof window.mobileInterface.resetAnalysis === 'function') {
                        window.mobileInterface.resetAnalysis();
                    }

                    if (mapDescriptionEl) {
                        const titleEl = document.getElementById('map-description-title');
                        const contentEl = document.getElementById('map-description-content');

                        if (mapConfig.description) {
                            if (titleEl) {
                                titleEl.innerHTML = mapConfig.descriptionTitle || '';
                            }
                            if (contentEl) {
                                contentEl.innerHTML = mapConfig.description || '';
                            }
                            mapDescriptionEl.style.display = 'block';
                        } else {
                            if (titleEl) titleEl.innerHTML = '';
                            if (contentEl) contentEl.innerHTML = '';
                            mapDescriptionEl.style.display = 'none';
                        }
                    }

                    // Show/hide search field based on map config
                    const searchGroup = document.getElementById('search-group');
                    if (searchGroup) {
                        searchGroup.style.display = mapConfig.enableSearch ? 'flex' : 'none';
                    }

                    if (mapConfig.name === 'Figuras 2.15 a 2.22. Municipios con localidades sin electrificar' ||
                        mapConfig.name === 'Figura 2.16. Municipios con localidades sin electrificar en la GCR Oriental') {
                        updateSheetInfo(mapConfig); // Update sheet info for this map
                        loadElectrificationMap(mapConfig);
                        return; // Stop further processing for this map for now
                    }

                    if (mapConfig.name === 'Figura 3.5. Pronóstico regional del PIB, escenario de planeación 2025 - 2030 y 2025-2039') {
                        updateSheetInfo(mapConfig);
                        await loadPIBForecastMap(mapConfig);
                        return;
                    }

                    if (mapConfig.name === 'Figura 3.9. Pronósticos del consumo bruto 2025 - 2030 y 2025 - 2039') {
                        updateSheetInfo(mapConfig);
                        await loadConsumptionForecastMap(mapConfig);
                        return;
                    }

                    if (mapConfig.name === 'Figura 4.3. Adiciones de Capacidad de proyectos de fortalecimiento de la CFE 2025 - 2027') {
                        updateSheetInfo(mapConfig);
                        await loadCapacityAdditionsMap(mapConfig);
                        return;
                    }

                    if (mapConfig.name === 'Figura 4.4. Adiciones de capacidad de proyectos del Estado 2027 - 2030') {
                        updateSheetInfo(mapConfig);
                        await loadCapacityAdditionsMap(mapConfig);
                        return;
                    }

                    if (mapConfig.name === 'Figura 4.5. Adiciones de capacidad de proyectos con prelación 2025 - 2030') {
                        updateSheetInfo(mapConfig);
                        await loadCapacityAdditionsMap(mapConfig);
                        return;
                    }

                    if (mapConfig.name === 'Figura 4.6. Adición de capacidad para desarrollarse por particulares 2026 - 2030') {
                        updateSheetInfo(mapConfig);
                        await loadCapacityAdditionsMap(mapConfig);
                        return;
                    }

                    if (mapConfig.name === 'Adición de capacidad 2025-2030') {
                        updateSheetInfo(mapConfig);
                        await loadTotalCapacityAdditionsMap(mapConfig);
                        return;
                    }

                    if (Array.isArray(mapConfig.insets) && mapConfig.insets.length) {
                        createInsetMaps(mapConfig.insets);
                    }
                    if (mapConfig.geojsonUrl) {
                        if (mapConfig.name === 'Red nacional de gasoductos en 2024') {
                            addGasLegend();
                        }
                        if (mapConfig.geojsonUrlType === 'presas') {
                            console.log('🟡 Cargando mapa de PRESAS');
                            await loadPresasGeoJSON(mapConfig.geojsonUrl, { silent: false, mapConfig: mapConfig });

                            // Cargar capas adicionales si existen (Ramsar, Usumacinta, etc.)
                            if (mapConfig.additionalLayers && Array.isArray(mapConfig.additionalLayers)) {
                                console.log('🟡 Cargando', mapConfig.additionalLayers.length, 'capas adicionales');
                                for (const additionalLayer of mapConfig.additionalLayers) {
                                    if (additionalLayer.url && additionalLayer.type) {
                                        console.log('🟡 Cargando capa adicional:', additionalLayer.type);
                                        await loadGeoJSON(additionalLayer.url, {
                                            type: additionalLayer.type,
                                            silent: true,
                                            clearLayers: false // No limpiar capas anteriores
                                        });
                                    }
                                }
                                console.log('🟡 Todas las capas adicionales cargadas');

                                // Agregar leyenda de capas de conservación
                                addConservationLayersLegend();
                                console.log('🟡 Leyenda de capas de conservación agregada');

                                // FORZAR ocultación del preloader después de cargar todo
                                console.log('🔄 Forzando ocultación final del preloader...');
                                togglePreloader(false);
                            } else {
                                console.log('🟡 No hay capas adicionales para cargar');
                                // FORZAR ocultación del preloader
                                console.log('🔄 Forzando ocultación final del preloader...');
                                togglePreloader(false);
                            }
                        } else {
                            await loadGeoJSON(mapConfig.geojsonUrl, { type: mapConfig.geojsonUrlType });
                        }
                    }
                    if (mapConfig.connectionsGeojsonUrl) {
                        const showPreloader = !mapConfig.geojsonUrl;
                        await loadConnectionsGeoJSON(mapConfig.connectionsGeojsonUrl, { showPreloader, clear: true });
                    }
                    if (mapConfig.pipelineGeojsonUrls && Array.isArray(mapConfig.pipelineGeojsonUrls)) {
                        for (let i = 0; i < mapConfig.pipelineGeojsonUrls.length; i++) {
                            const url = mapConfig.pipelineGeojsonUrls[i];
                            const isFirst = i === 0;
                            // If there was no connectionsGeojsonUrl, the first pipeline layer should clear the group.
                            const shouldClear = isFirst && !mapConfig.connectionsGeojsonUrl;
                            await loadConnectionsGeoJSON(url, { showPreloader: false, clear: shouldClear });
                        }
                    }
                    if (mapConfig.googleSheetUrl && hasValidSheetUrl(mapConfig.googleSheetUrl)) {
                        currentSheetUrl = mapConfig.googleSheetUrl;
                        updateSheetInfo(mapConfig);
                        await loadAndRender({ silent: false });
                    } else {
                        currentSheetUrl = null;
                        updateSheetInfo(null);
                    }
                    return;
                }
            }

            currentSheetUrl = null;
            updateSheetInfo(null, SELECT_MAP_MESSAGE);
            currentMapTitle = DEFAULT_MAP_TITLE;
            updateMapTitleDisplay(DEFAULT_MAP_TITLE);
            syncMapDropdowns('');
            if (mapDescriptionEl) {
                mapDescriptionEl.innerHTML = '';
                mapDescriptionEl.style.display = 'none';
            }
        });
    }

    // Search functionality for electricity permits
    const permitSearchInput = document.getElementById('permit-search');
    const searchSuggestionsEl = document.getElementById('search-suggestions');
    const searchHelpBtn = document.getElementById('search-help-btn');
    let selectedSuggestionIndex = -1;

    // Search help button
    if (searchHelpBtn) {
        searchHelpBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            openSearchHelpModal();
        });
    }

    // Search help modal functions
    function openSearchHelpModal() {
        const modal = document.getElementById('search-help-modal');
        const statusEl = document.getElementById('search-help-status');

        if (!modal) return;

        // Update status text dynamically
        const hasFilter = currentFilteredData.length > 0;
        if (statusEl) {
            if (hasFilter) {
                statusEl.innerHTML = `
                    <i class="bi bi-funnel" style="margin-right: 6px;"></i>
                    <strong>Filtro activo:</strong> Buscando solo en ${currentFilteredData.length} permiso(s) filtrado(s).
                `;
                statusEl.style.borderLeftColor = 'var(--color-guinda)';
            } else {
                statusEl.innerHTML = `
                    <i class="bi bi-globe" style="margin-right: 6px;"></i>
                    <strong>Sin filtro:</strong> Buscando en todos los ${electricityPermitsData.length} permisos disponibles.
                `;
                statusEl.style.borderLeftColor = 'var(--color-verde-profundo)';
            }
        }

        // Show modal
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    function closeSearchHelpModal() {
        const modal = document.getElementById('search-help-modal');
        if (!modal) return;

        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');

        // Restore body scroll
        document.body.style.overflow = '';
    }

    // Event listeners for closing the modal
    const searchHelpModalCloseButtons = document.querySelectorAll('.search-help-modal-close');
    searchHelpModalCloseButtons.forEach(btn => {
        btn.addEventListener('click', closeSearchHelpModal);
    });

    // Close on overlay click
    const searchHelpModal = document.getElementById('search-help-modal');
    if (searchHelpModal) {
        const overlay = searchHelpModal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeSearchHelpModal);
        }

        // Close on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && searchHelpModal.style.display === 'flex') {
                closeSearchHelpModal();
            }
        });
    }

    if (permitSearchInput) {
        // Input event for live suggestions
        permitSearchInput.addEventListener('input', function () {
            const searchTerm = this.value.trim();

            if (!searchTerm || searchTerm.length < 2) {
                hideSuggestions();
                return;
            }

            // Check if we have data (electricity, petroliferos, Gas LP or Gas Natural)
            const hasData = electricityPermitsData.length > 0 || petroliferosPermitsData.length > 0 || gasLPPermitsData.length > 0 || gasNaturalPermitsData.length > 0;
            if (!hasData) {
                console.warn('No search data available');
                return;
            }

            // Search and show suggestions
            showSearchSuggestions(searchTerm);
        });

        // Keydown for navigation
        permitSearchInput.addEventListener('keydown', function (e) {
            const suggestions = document.querySelectorAll('.search-suggestion-item');

            if (!suggestions.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
                updateSuggestionSelection(suggestions);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
                updateSuggestionSelection(suggestions);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                    suggestions[selectedSuggestionIndex].click();
                }
            } else if (e.key === 'Escape') {
                hideSuggestions();
            }
        });

        // Click outside to close
        document.addEventListener('click', function (e) {
            if (!permitSearchInput.contains(e.target) && !searchSuggestionsEl.contains(e.target)) {
                hideSuggestions();
            }
        });
    }

    function showSearchSuggestions(searchTerm) {
        const upperSearch = searchTerm.toUpperCase();

        // Determine which dataset to search based on active map
        let dataToSearch;
        let isPetroliferos = petroliferosPermitsData.length > 0 && document.getElementById('petroliferos-filters-panel').style.display === 'block';
        let isGasLP = gasLPPermitsData.length > 0 && document.getElementById('gaslp-filters-panel').style.display === 'block';
        let isGasNatural = gasNaturalPermitsData.length > 0 && document.getElementById('gasnatural-filters-panel').style.display === 'block';
        let hasActiveFilter = false;
        let filterInfo = '';

        if (isPetroliferos) {
            hasActiveFilter = currentPetroliferosFilteredData.length > 0;
            dataToSearch = hasActiveFilter ? currentPetroliferosFilteredData : petroliferosPermitsData;

            if (hasActiveFilter && currentPetroliferosFilter) {
                const filterType = currentPetroliferosFilter.type === 'state' ? 'Estado' :
                    currentPetroliferosFilter.type === 'type' ? 'Tipo' : 'Marca';
                filterInfo = ` (Filtro: ${filterType} - ${currentPetroliferosFilter.value})`;
            }

            console.log('Searching in petroliferos:', hasActiveFilter ?
                'filtered data (' + currentPetroliferosFilteredData.length + ' permits)' + filterInfo :
                'all data (' + petroliferosPermitsData.length + ' permits)');
        } else if (isGasLP) {
            hasActiveFilter = currentGasLPFilteredData.length > 0;
            dataToSearch = hasActiveFilter ? currentGasLPFilteredData : gasLPPermitsData;

            if (hasActiveFilter && currentGasLPFilter) {
                const filterType = currentGasLPFilter.type === 'state' ? 'Estado' : 'Tipo';
                filterInfo = ` (Filtro: ${filterType} - ${currentGasLPFilter.value})`;
            }

            console.log('Searching in Gas LP:', hasActiveFilter ?
                'filtered data (' + currentGasLPFilteredData.length + ' permits)' + filterInfo :
                'all data (' + gasLPPermitsData.length + ' permits)');
        } else if (isGasNatural) {
            hasActiveFilter = currentGasNaturalFilteredData.length > 0;
            dataToSearch = hasActiveFilter ? currentGasNaturalFilteredData : gasNaturalPermitsData;

            if (hasActiveFilter && currentGasNaturalFilter) {
                const filterType = currentGasNaturalFilter.type === 'state' ? 'Estado' : 'Tipo';
                filterInfo = ` (Filtro: ${filterType} - ${currentGasNaturalFilter.value})`;
            }

            console.log('Searching in Gas Natural:', hasActiveFilter ?
                'filtered data (' + currentGasNaturalFilteredData.length + ' permits)' + filterInfo :
                'all data (' + gasNaturalPermitsData.length + ' permits)');
        } else {
            hasActiveFilter = currentFilteredData.length > 0;
            dataToSearch = hasActiveFilter ? currentFilteredData : electricityPermitsData;

            if (hasActiveFilter && currentFilter) {
                const filterType = currentFilter.type === 'state' ? 'Estado' :
                    currentFilter.type === 'gcr' ? 'GCR' : 'Tecnología';
                filterInfo = ` (Filtro: ${filterType} - ${currentFilter.value})`;
            }

            console.log('Searching in electricity:', hasActiveFilter ?
                'filtered data (' + currentFilteredData.length + ' permits)' + filterInfo :
                'all data (' + electricityPermitsData.length + ' permits)');
        }

        // Find matches - more intelligent search
        const matches = dataToSearch.filter(row => {
            const permitNumber = (row.NumeroPermiso || '').toUpperCase();
            const razonSocial = (row.RazonSocial || '').toUpperCase();

            // Prioritize exact start matches
            return permitNumber.includes(upperSearch) || razonSocial.includes(upperSearch);
        }).sort((a, b) => {
            // Sort: exact matches first, then starts with, then contains
            const aPermit = (a.NumeroPermiso || '').toUpperCase();
            const bPermit = (b.NumeroPermiso || '').toUpperCase();
            const aCompany = (a.RazonSocial || '').toUpperCase();
            const bCompany = (b.RazonSocial || '').toUpperCase();

            const aExact = aPermit === upperSearch || aCompany === upperSearch;
            const bExact = bPermit === upperSearch || bCompany === upperSearch;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            const aStarts = aPermit.startsWith(upperSearch) || aCompany.startsWith(upperSearch);
            const bStarts = bPermit.startsWith(upperSearch) || bCompany.startsWith(upperSearch);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            return 0;
        }).slice(0, 8); // Limit to 8 results

        if (!searchSuggestionsEl) return;

        if (matches.length === 0) {
            const noResultsMsg = hasActiveFilter
                ? `No se encontraron resultados${filterInfo}`
                : 'No se encontraron resultados';
            searchSuggestionsEl.innerHTML = '<div class="search-no-results">' + noResultsMsg + '</div>';
            searchSuggestionsEl.style.display = 'block';
            return;
        }

        // Create suggestion items
        searchSuggestionsEl.innerHTML = '';

        // Add header if there's an active filter
        if (hasActiveFilter) {
            const header = document.createElement('div');
            header.className = 'search-suggestions-header';
            header.innerHTML = `<small>🔍 Buscando en: <strong>${filterInfo.replace(/^\s*\(Filtro:\s*/, '').replace(/\)$/, '')}</strong></small>`;
            searchSuggestionsEl.appendChild(header);
        }

        matches.forEach((row, index) => {
            const item = document.createElement('div');
            item.className = 'search-suggestion-item';
            item.dataset.index = index;

            // Different format for petroliferos, gas LP, gas natural vs electricity
            if (isPetroliferos) {
                item.innerHTML = `
                    <div class="suggestion-permit">${row.NumeroPermiso || 'S/N'}</div>
                    <div class="suggestion-company">${row.RazonSocial || 'Sin razón social'}</div>
                    <div class="suggestion-details">${getStateName(row.EfId)} • ${row.TipoPermiso || ''} • ${row.Marca || ''}</div>
                `;
            } else if (isGasLP) {
                item.innerHTML = `
                    <div class="suggestion-permit">${row.NumeroPermiso || 'S/N'}</div>
                    <div class="suggestion-company">${row.RazonSocial || 'Sin razón social'}</div>
                    <div class="suggestion-details">${getStateName(row.EfId)} • ${row.TipoPermiso || ''}</div>
                `;
            } else if (isGasNatural) {
                const stateName = (row.EfId || '').split('-')[1] || getStateName((row.EfId || '').split('-')[0]);
                item.innerHTML = `
                    <div class="suggestion-permit">${row.NumeroPermiso || 'S/N'}</div>
                    <div class="suggestion-company">${row.RazonSocial || 'Sin razón social'}</div>
                    <div class="suggestion-details">${stateName.trim()} • ${row.TipoPermiso || ''}</div>
                `;
            } else {
                item.innerHTML = `
                    <div class="suggestion-permit">${row.NumeroPermiso || 'S/N'}</div>
                    <div class="suggestion-company">${row.RazonSocial || 'Sin razón social'}</div>
                    <div class="suggestion-details">${row.EfId || ''} • ${row.CapacidadAutorizadaMW || '0'} MW • ${row.Tecnología || ''}</div>
                `;
            }

            item.addEventListener('click', function () {
                selectPermit(row);
            });

            searchSuggestionsEl.appendChild(item);
        });

        searchSuggestionsEl.style.display = 'block';
        selectedSuggestionIndex = -1;
    }

    function updateSuggestionSelection(suggestions) {
        suggestions.forEach((item, index) => {
            if (index === selectedSuggestionIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    function selectPermit(row) {
        if (!markersClusterGroup) return;

        console.log('Searching for permit:', row.NumeroPermiso);

        // Find marker with this permit
        let found = false;
        let targetMarker = null;

        markersClusterGroup.eachLayer(function (layer) {
            if (layer.permitData && layer.permitData.NumeroPermiso === row.NumeroPermiso) {
                targetMarker = layer;
                found = true;
                return false; // Stop iteration
            }
        });

        if (found && targetMarker) {
            const latLng = targetMarker.getLatLng();

            // Zoom to the marker location
            map.setView(latLng, 16, {
                animate: true,
                duration: 0.8
            });

            // Wait for zoom animation and cluster spiderfy
            setTimeout(function () {
                // If marker is in a cluster, spiderfy it
                if (markersClusterGroup.getVisibleParent(targetMarker)) {
                    markersClusterGroup.zoomToShowLayer(targetMarker, function () {
                        // Open popup after layer is visible
                        targetMarker.openPopup();

                        // Add temporary highlight effect
                        if (targetMarker._icon) {
                            targetMarker._icon.style.transform = 'scale(1.4)';
                            targetMarker._icon.style.transition = 'transform 0.3s ease';
                            targetMarker._icon.style.filter = 'drop-shadow(0 0 10px rgba(96, 22, 35, 0.8))';

                            setTimeout(function () {
                                if (targetMarker._icon) {
                                    targetMarker._icon.style.transform = 'scale(1)';
                                    targetMarker._icon.style.filter = 'drop-shadow(2px 2px 3px rgba(0, 0, 0, 0.3))';
                                }
                            }, 1500);
                        }
                    });
                } else {
                    // Marker is already visible, just open popup
                    targetMarker.openPopup();

                    // Add temporary highlight effect
                    if (targetMarker._icon) {
                        targetMarker._icon.style.transform = 'scale(1.4)';
                        targetMarker._icon.style.transition = 'transform 0.3s ease';
                        targetMarker._icon.style.filter = 'drop-shadow(0 0 10px rgba(96, 22, 35, 0.8))';

                        setTimeout(function () {
                            if (targetMarker._icon) {
                                targetMarker._icon.style.transform = 'scale(1)';
                                targetMarker._icon.style.filter = 'drop-shadow(2px 2px 3px rgba(0, 0, 0, 0.3))';
                            }
                        }, 1500);
                    }
                }
            }, 900);

            console.log('Permit found and centered:', row.NumeroPermiso);

            // Update search input
            permitSearchInput.value = row.NumeroPermiso || '';
            hideSuggestions();
        } else {
            console.warn('Permit marker not found:', row.NumeroPermiso);

            // Show a message to the user
            if (permitSearchInput) {
                const originalPlaceholder = permitSearchInput.placeholder;
                permitSearchInput.placeholder = '⚠️ Permiso no encontrado en el mapa actual';
                permitSearchInput.style.borderColor = '#e74c3c';

                setTimeout(function () {
                    permitSearchInput.placeholder = originalPlaceholder;
                    permitSearchInput.style.borderColor = '';
                }, 3000);
            }
        }
    }

    function hideSuggestions() {
        const suggestionsEl = document.getElementById('search-suggestions');
        if (suggestionsEl) {
            suggestionsEl.style.display = 'none';
            suggestionsEl.innerHTML = '';
        }
        if (typeof selectedSuggestionIndex !== 'undefined') {
            selectedSuggestionIndex = -1;
        }
    }

    function clearSearchBox() {
        const searchInput = document.getElementById('permit-search');
        if (searchInput) {
            searchInput.value = '';
        }
        hideSuggestions();
    }

    // Event listeners for electricity filters
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.dataset.tab;

            console.log('Tab clicked:', targetTab);

            // Reset filters when changing tabs
            if (currentFilter) {
                console.log('Resetting filters on tab change');
                currentFilter = null;
                currentFilteredData = [];

                // Restore all markers
                if (electricityPermitsData.length) {
                    drawElectricityMarkersOnly(electricityPermitsData);
                }

                // Update totals to show all data
                updateElectricityTotals(electricityStats);
            }

            // Remove active class from all filter cards
            document.querySelectorAll('.filter-card').forEach(card => {
                card.classList.remove('active');
            });

            // Reset matrix view highlighting
            document.querySelectorAll('.matrix-gcr-section').forEach(section => {
                section.style.borderColor = '#eef3f6';
                section.style.background = 'white';
            });

            // Update tabs
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Update content
            document.querySelectorAll('.filter-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(targetTab + '-filters').classList.add('active');

            // Show/hide layers based on tab
            if (targetTab === 'state') {
                // Tab "Por Estado" - Mostrar Estados, ocultar GCR
                console.log('Showing States layer');
                showStatesLayer(null);
            } else if (targetTab === 'gcr') {
                // Tab "Por Gerencia" - Mostrar GCR, ocultar Estados
                console.log('Showing GCR layer');
                showGCRLayer(null);
            } else if (targetTab === 'tech') {
                // Tab "Por Tecnología" - Ocultar ambas (nivel nacional)
                console.log('Hiding all layers');
                hideGeometryLayers();
            } else if (targetTab === 'matrix') {
                // Tab "Vista Detallada" - Mostrar GCR, ocultar Estados
                console.log('Showing GCR layer for matrix');
                showGCRLayer(null);
            }
        });
    });

    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function () {
            resetElectricityFilters();
        });
    }

    // Click on map (outside polygons) to reset filter
    map.on('click', function (e) {
        // Evitar reset si proviene de terminar arrastre de leyenda
        if (window.isLegendDragging || window.ignoreNextMapClick) {
            return;
        }
        // Only reset if we're on electricity map and have a filter active
        if (!electricityPermitsData.length || !currentFilter) {
            return;
        }

        // Check if click was on a polygon (it would have been stopped)
        // If we get here, it means click was NOT on a polygon
        resetElectricityFilters();
    });

    // Welcome screen handling
    const welcomeScreen = document.getElementById('welcome-screen');
    const welcomeStartBtn = document.getElementById('welcome-start-btn');

    if (welcomeScreen && welcomeStartBtn) {
        // Show welcome screen on load
        welcomeScreen.style.display = 'flex';

        // Hide welcome screen when start button is clicked
        welcomeStartBtn.addEventListener('click', function () {
            welcomeScreen.style.display = 'none';
        });
    }

    // ==========================================
    // PETROLIFEROS EVENT LISTENERS
    // ==========================================

    // Event listeners for petroliferos filters tabs
    const petroliferosTabs = document.querySelectorAll('.filter-tab-petroliferos');
    petroliferosTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.dataset.tab;

            console.log('Petroliferos tab clicked:', targetTab);

            // Reset filters when changing tabs
            if (currentPetroliferosFilter) {
                console.log('Resetting petroliferos filters on tab change');
                currentPetroliferosFilter = null;
                currentPetroliferosFilteredData = [];

                // Restore all markers
                if (petroliferosPermitsData.length) {
                    drawPetroliferosMarkersOnly(petroliferosPermitsData);
                }

                // Update totals to show all data
                updatePetroliferosTotals(petroliferosStats);
            }

            // Remove active class from all filter cards
            document.querySelectorAll('.filter-card').forEach(card => {
                card.classList.remove('active');
            });

            // Update tabs
            petroliferosTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Update content
            document.querySelectorAll('.filter-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('petroliferos-' + targetTab + '-filters').classList.add('active');

            // Show/hide layers based on tab
            if (targetTab === 'state') {
                console.log('Showing States layer');
                showStatesLayer(null);
            } else {
                // For type and brand, show states without highlighting
                console.log('Showing States layer without highlighting');
                showStatesLayer(null);
            }
        });
    });

    // Reset button for petroliferos
    const resetPetroliferosBtn = document.getElementById('reset-petroliferos-filters-btn');
    if (resetPetroliferosBtn) {
        resetPetroliferosBtn.addEventListener('click', function () {
            resetPetroliferosFilters();
        });
    }

    // ==========================================
    // GAS LP EVENT LISTENERS
    // ==========================================

    // Event listeners for Gas LP filters tabs
    const gasLPTabs = document.querySelectorAll('.filter-tab-gaslp');
    gasLPTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.dataset.tab;

            console.log('Gas LP tab clicked:', targetTab);

            // Reset filters when changing tabs
            if (currentGasLPFilter) {
                console.log('Resetting Gas LP filters on tab change');
                currentGasLPFilter = null;
                currentGasLPFilteredData = [];

                // Restore all markers
                if (gasLPPermitsData.length) {
                    drawGasLPMarkersOnly(gasLPPermitsData);
                }

                // Update totals to show all data
                updateGasLPTotals(gasLPStats);
            }

            // Remove active class from all filter cards
            document.querySelectorAll('.filter-card').forEach(card => {
                card.classList.remove('active');
            });

            // Update tabs
            gasLPTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Update content
            document.querySelectorAll('.filter-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('gaslp-' + targetTab + '-filters').classList.add('active');

            // Show/hide layers based on tab
            if (targetTab === 'state') {
                console.log('Showing States layer');
                showStatesLayer(null);
            } else {
                console.log('Showing States layer without highlighting');
                showStatesLayer(null);
            }
        });
    });

    // Reset button for Gas LP
    const resetGasLPBtn = document.getElementById('reset-gaslp-filters-btn');
    if (resetGasLPBtn) {
        resetGasLPBtn.addEventListener('click', function () {
            resetGasLPFilters();
        });
    }

    // ==========================================
    // GAS NATURAL EVENT LISTENERS
    // ==========================================

    // Event listeners for Gas Natural filters tabs
    const gasNaturalTabs = document.querySelectorAll('.filter-tab-gasnatural');
    gasNaturalTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.dataset.tab;

            console.log('Gas Natural tab clicked:', targetTab);

            // Reset filters when changing tabs
            if (currentGasNaturalFilter) {
                console.log('Resetting Gas Natural filters on tab change');
                currentGasNaturalFilter = null;
                currentGasNaturalFilteredData = [];

                // Restore all markers
                if (gasNaturalPermitsData.length) {
                    drawGasNaturalMarkersOnly(gasNaturalPermitsData);
                }

                // Update totals to show all data
                updateGasNaturalTotals(gasNaturalStats);
            }

            // Remove active class from all filter cards
            document.querySelectorAll('.filter-card').forEach(card => {
                card.classList.remove('active');
            });

            // Update tabs
            gasNaturalTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Update content
            document.querySelectorAll('.filter-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('gasnatural-' + targetTab + '-filters').classList.add('active');

            // Show/hide layers based on tab
            if (targetTab === 'state') {
                console.log('Showing States layer');
                showStatesLayer(null);
            } else {
                console.log('Showing States layer without highlighting');
                showStatesLayer(null);
            }
        });
    });

    // Reset button for Gas Natural
    const resetGasNaturalBtn = document.getElementById('reset-gasnatural-filters-btn');
    if (resetGasNaturalBtn) {
        resetGasNaturalBtn.addEventListener('click', function () {
            resetGasNaturalFilters();
        });
    }

    // ==========================================
    // INSTRUMENT SELECT AUTO-LOAD (at the end to ensure all functions are defined)
    // ==========================================

    if (instrumentSelect) {
        instrumentSelect.addEventListener('change', async function () {
            const selectedInstrument = this.value;
            console.log('Instrument changed to:', selectedInstrument);

            if (!selectedInstrument || !mapConfigurations[selectedInstrument]) {
                // Clear map select if no instrument selected
                if (mapSelect) {
                    mapSelect.innerHTML = '<option value="">Seleccione un mapa</option>';
                    mapSelect.disabled = true;
                }
                return;
            }

            const maps = mapConfigurations[selectedInstrument];
            console.log('Maps available:', maps.length, maps.map(m => m.name));

            // Populate mapSelect
            if (mapSelect) {
                mapSelect.innerHTML = '<option value="">Seleccione un mapa</option>';
                maps.forEach(mapConfig => {
                    const option = document.createElement('option');
                    option.value = mapConfig.name;
                    option.textContent = mapConfig.name;
                    mapSelect.appendChild(option);
                });
                mapSelect.disabled = false;
                console.log('Map select populated with', maps.length, 'options');

                // Auto-load if only one map available
                if (maps.length === 1) {
                    console.log('Auto-loading single map for instrument:', selectedInstrument, maps[0].name);
                    mapSelect.value = maps[0].name;
                    console.log('Map select value set to:', mapSelect.value);

                    // Trigger the change event on mapSelect instead of duplicating logic
                    setTimeout(() => {
                        console.log('Triggering map select change event');
                        const event = new Event('change', { bubbles: true });
                        mapSelect.dispatchEvent(event);
                    }, 100);
                }
            }
        });
    }
});
