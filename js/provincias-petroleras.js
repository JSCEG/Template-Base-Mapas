/**
 * Configuración de estilos y leyenda para Provincias Petroleras
 */

(function() {
    'use strict';

    // Paleta de colores elegante y equilibrada - Azules, Vinos y Verdes institucionales
    const PROVINCIAS_COLORS = {
        'BURGOS': '#8B3A62',                                            // 1. Vino elegante
        'CINTURON PLEGADO DE CHIAPAS': '#2E5266',                       // 2. Azul petróleo
        'CUENCAS DEL SURESTE': '#6C5B7B',                               // 3. Púrpura suave
        'GOLFO DE MEXICO PROFUNDO': '#1f7a62',                          // 4. Verde SENER profundo
        'PLATAFORMA DE YUCATAN': '#4A7C8C',                             // 5. Azul grisáceo
        'SABINAS - BURRO - PICACHOS': '#9B6B6B',                        // 6. Terracota suave
        'TAMPICO-MISANTLA': '#24a47a',                                  // 7. Verde SENER claro
        'VERACRUZ': '#5D8AA8',                                          // 8. Azul acero
        'CHIHUAHUA': '#7B9E87',                                         // 9. Verde salvia
        'CINTURON PLEGADO DE LA SIERRA MADRE ORIENTAL': '#8B7355',     // 10. Café elegante
        'GOLFO DE CALIFORNIA': '#6B4C4C',                               // 11. Vino chocolate
        'VIZCAINO-LA PURISIMA-IRAY': '#A67C52'                          // 12. Caramelo
    };

    // Función para obtener el color de una provincia
    function getProvinciaColor(nombre) {
        return PROVINCIAS_COLORS[nombre] || '#95A5A6';
    }

    // Función para aplicar estilo a las provincias
    function styleProvincias(feature) {
        const nombre = feature.properties.nombre;
        return {
            fillColor: getProvinciaColor(nombre),
            weight: 0,
            opacity: 0,
            color: 'transparent',
            fillOpacity: 0.75,
            // Efecto de sombra usando className
            className: 'provincia-polygon'
        };
    }

    // Funcion para crear popup con informacion de la provincia
    function createProvinciaPopup(feature) {
        const props = feature.properties || {};
        const nombre = props.nombre || 'Provincia petrolera';
        const situacion = props.situacin || 'Dato no disponible';
        const ubicacion = props.ubicacin || 'Dato no disponible';
        const version = props.versin || 'N/A';

        let areaTexto = 'N/A';
        const area = parseFloat(props.rea_km2);
        if (!isNaN(area)) {
            areaTexto = `${area.toLocaleString('es-MX')} km²`;
        }

        return `
            <div style="font-family: 'Montserrat', sans-serif; max-width: 250px;">
                <h3 style="margin: 0 0 6px 0; color: #2C3E50; font-size: 12px; border-bottom: 2px solid ${getProvinciaColor(nombre)}; padding-bottom: 3px;">
                    ${nombre}
                </h3>

                <p style="margin: 0 0 8px 0; font-size: 9px; color: #7F8C8D;">
                    Vista resumida mientras se depura la informacion duplicada.
                </p>

                <div style="font-size: 10px; color: #34495E; display: flex; flex-direction: column; gap: 4px;">
                    <div>
                        <strong>Situacion:</strong>
                        <span style="color: #7F8C8D;">${situacion}</span>
                    </div>
                    <div>
                        <strong>Ubicacion:</strong>
                        <span style="color: #7F8C8D;">${ubicacion}</span>
                    </div>
                    <div>
                        <strong>Area aproximada:</strong>
                        <span style="color: #7F8C8D;">${areaTexto}</span>
                    </div>
                </div>

                <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #BDC3C7; font-size: 9px; color: #95A5A6;">
                    <strong>Version:</strong> ${version}
                </div>
            </div>
        `;
    }
// Función para crear la leyenda personalizada con datos del GeoJSON
    function createProvinciaLegend(geoJsonLayer) {
        const legend = L.control({ position: 'bottomleft' });

        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'info legend provincias-legend');
            
            let html = `
                <h4 style="margin: 0 0 6px 0; font-size: 11px; font-weight: 600; color: #1f7a62;">
                    Provincias Petroleras
                </h4>
            `;

            // Crear array de provincias con sus IDs del GeoJSON
            const provincias = [];
            geoJsonLayer.eachLayer(function(layer) {
                const props = layer.feature.properties;
                provincias.push({
                    nombre: props.nombre,
                    id: props.Id,
                    color: getProvinciaColor(props.nombre)
                });
            });

            // Ordenar por ID
            provincias.sort((a, b) => a.id - b.id);

            // Agregar cada provincia con su color e ID del GeoJSON
            provincias.forEach(provincia => {
                html += `
                    <div style="clear: both; margin-bottom: 4px;">
                        <i style="background: ${provincia.color}; border-radius: 3px; border: 1px solid rgba(0,0,0,0.2);"></i>
                        <span style="font-size: 9px; color: #162230; line-height: 1.2;">
                            ${provincia.nombre} <strong style="color: #1f7a62;">(${provincia.id})</strong>
                        </span>
                    </div>
                `;
            });

            div.innerHTML = html;
            return div;
        };

        return legend;
    }

    // Función para aplicar interactividad a las provincias
    function onEachProvinciaFeature(feature, layer) {
        // Popup
        layer.bindPopup(createProvinciaPopup(feature), {
            maxWidth: 450,
            className: 'provincia-popup'
        });

        // Agregar etiqueta con el ID en el centro de la provincia
        const nombre = feature.properties.nombre;
        const id = feature.properties.Id || '?';
        
        // Calcular el centro del polígono
        const center = layer.getBounds().getCenter();
        
        // Crear etiqueta permanente con el ID
        const label = L.marker(center, {
            icon: L.divIcon({
                className: 'provincia-label',
                html: `<div style="
                    background: rgba(255, 255, 255, 0.85);
                    border: 2px solid ${getProvinciaColor(nombre)};
                    border-radius: 50%;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 13px;
                    color: #2C3E50;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    font-family: 'Montserrat', sans-serif;
                ">${id}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            }),
            interactive: false
        });
        
        // Guardar referencia a la etiqueta en el layer
        layer.label = label;

        // Eventos de hover
        layer.on({
            mouseover: function(e) {
                const layer = e.target;
                layer.setStyle({
                    weight: 2.5,
                    opacity: 1,
                    fillOpacity: 0.95,
                    color: '#000000'
                });
                layer.bringToFront();
            },
            mouseout: function(e) {
                const layer = e.target;
                layer.setStyle({
                    weight: 0,
                    opacity: 0,
                    fillOpacity: 0.75,
                    color: 'transparent'
                });
            }
        });
    }

    // Variable global para guardar el grupo de etiquetas
    let provinciaLabelsGroup = null;

    // Función para agregar etiquetas al mapa
    function addProvinciaLabels(geoJsonLayer, map) {
        // Limpiar etiquetas anteriores si existen
        if (provinciaLabelsGroup) {
            map.removeLayer(provinciaLabelsGroup);
        }
        
        provinciaLabelsGroup = L.layerGroup();
        
        geoJsonLayer.eachLayer(function(layer) {
            if (layer.label) {
                layer.label.addTo(provinciaLabelsGroup);
            }
        });
        
        provinciaLabelsGroup.addTo(map);
        return provinciaLabelsGroup;
    }

    // Función para limpiar etiquetas
    function removeProvinciaLabels(map) {
        if (provinciaLabelsGroup) {
            map.removeLayer(provinciaLabelsGroup);
            provinciaLabelsGroup = null;
        }
    }

    // Exportar funciones globalmente
    window.ProvinciasPetroleras = {
        styleProvincias: styleProvincias,
        onEachProvinciaFeature: onEachProvinciaFeature,
        createProvinciaLegend: createProvinciaLegend,
        getProvinciaColor: getProvinciaColor,
        addProvinciaLabels: addProvinciaLabels,
        removeProvinciaLabels: removeProvinciaLabels
    };

    console.log('✅ Módulo de Provincias Petroleras cargado');
})();
