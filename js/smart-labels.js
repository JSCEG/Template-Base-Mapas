/**
 * Sistema de etiquetas inteligentes con detección de colisiones y leader lines
 * Para el mapa "Regiones y enlaces del SEN en 2025"
 */

(function () {
    'use strict';

    // Configuración del sistema
    const CONFIG = {
        labelPadding: 5, // Padding alrededor de cada etiqueta
        minDistance: 20, // Distancia mínima entre etiquetas
        leaderLineColor: '#1f7a62',
        leaderLineWidth: 1.5,
        leaderLineDash: [3, 3],
        maxIterations: 50, // Iteraciones máximas para el algoritmo de reposicionamiento
        forceStrength: 0.3, // Fuerza de repulsión entre etiquetas
        anchorForce: 0.1 // Fuerza de atracción hacia el nodo original
    };

    // Almacenamiento global de etiquetas y líneas
    let labelData = [];
    let leaderLinesLayer = null;
    let labelsInitialized = false;

    /**
     * Clase para representar una etiqueta con su geometría
     */
    class SmartLabel {
        constructor(marker, text, originalPos) {
            this.marker = marker;
            this.text = text;
            this.originalPos = originalPos; // Posición del nodo
            this.currentPos = { ...originalPos }; // Posición actual de la etiqueta
            this.velocity = { x: 0, y: 0 };
            this.bounds = null;
            this.needsLeaderLine = false;
        }

        /**
         * Calcula los límites (bounding box) de la etiqueta
         */
        calculateBounds(map) {
            if (!this.marker._icon) return null;

            const iconElement = this.marker._icon;
            const rect = iconElement.getBoundingClientRect();
            const mapContainer = map.getContainer().getBoundingClientRect();

            // Convertir coordenadas de pantalla a coordenadas del mapa
            const point = map.latLngToContainerPoint(this.currentPos);

            this.bounds = {
                left: point.x - rect.width / 2 - CONFIG.labelPadding,
                right: point.x + rect.width / 2 + CONFIG.labelPadding,
                top: point.y - rect.height / 2 - CONFIG.labelPadding,
                bottom: point.y + rect.height / 2 + CONFIG.labelPadding,
                width: rect.width + CONFIG.labelPadding * 2,
                height: rect.height + CONFIG.labelPadding * 2
            };

            return this.bounds;
        }

        /**
         * Verifica si esta etiqueta colisiona con otra
         */
        collidesWith(otherLabel) {
            if (!this.bounds || !otherLabel.bounds) return false;

            return !(
                this.bounds.right < otherLabel.bounds.left ||
                this.bounds.left > otherLabel.bounds.right ||
                this.bounds.bottom < otherLabel.bounds.top ||
                this.bounds.top > otherLabel.bounds.bottom
            );
        }

        /**
         * Calcula la distancia al nodo original
         */
        distanceToOriginal(map) {
            const currentPoint = map.latLngToContainerPoint(this.currentPos);
            const originalPoint = map.latLngToContainerPoint(this.originalPos);

            const dx = currentPoint.x - originalPoint.x;
            const dy = currentPoint.y - originalPoint.y;

            return Math.sqrt(dx * dx + dy * dy);
        }

        /**
         * Actualiza la posición del marcador
         */
        updateMarkerPosition() {
            if (this.marker && this.marker.setLatLng) {
                this.marker.setLatLng(this.currentPos);
            }
        }
    }

    /**
     * Detecta colisiones entre todas las etiquetas
     */
    function detectCollisions(labels) {
        const collisions = [];

        for (let i = 0; i < labels.length; i++) {
            for (let j = i + 1; j < labels.length; j++) {
                if (labels[i].collidesWith(labels[j])) {
                    collisions.push([labels[i], labels[j]]);
                }
            }
        }

        return collisions;
    }

    /**
     * Aplica fuerzas de repulsión entre etiquetas que colisionan
     */
    function applyRepulsionForces(labels, map) {
        // Calcular bounds para todas las etiquetas
        labels.forEach(label => label.calculateBounds(map));

        // Detectar colisiones
        const collisions = detectCollisions(labels);

        if (collisions.length === 0) return false;

        // Aplicar fuerzas de repulsión
        collisions.forEach(([label1, label2]) => {
            const point1 = map.latLngToContainerPoint(label1.currentPos);
            const point2 = map.latLngToContainerPoint(label2.currentPos);

            const dx = point2.x - point1.x;
            const dy = point2.y - point1.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;

            // Fuerza de repulsión inversamente proporcional a la distancia
            const force = CONFIG.forceStrength * (CONFIG.minDistance - distance) / distance;

            // Aplicar fuerza a ambas etiquetas
            label1.velocity.x -= (dx / distance) * force;
            label1.velocity.y -= (dy / distance) * force;
            label2.velocity.x += (dx / distance) * force;
            label2.velocity.y += (dy / distance) * force;
        });

        return true;
    }

    /**
     * Aplica fuerza de atracción hacia la posición original
     */
    function applyAnchorForces(labels, map) {
        labels.forEach(label => {
            const currentPoint = map.latLngToContainerPoint(label.currentPos);
            const originalPoint = map.latLngToContainerPoint(label.originalPos);

            const dx = originalPoint.x - currentPoint.x;
            const dy = originalPoint.y - currentPoint.y;

            label.velocity.x += dx * CONFIG.anchorForce;
            label.velocity.y += dy * CONFIG.anchorForce;
        });
    }

    /**
     * Actualiza las posiciones de las etiquetas basándose en las velocidades
     */
    function updatePositions(labels, map) {
        labels.forEach(label => {
            const currentPoint = map.latLngToContainerPoint(label.currentPos);

            // Actualizar posición
            currentPoint.x += label.velocity.x;
            currentPoint.y += label.velocity.y;

            // Convertir de vuelta a LatLng
            label.currentPos = map.containerPointToLatLng(currentPoint);

            // Aplicar fricción
            label.velocity.x *= 0.8;
            label.velocity.y *= 0.8;

            // Actualizar marcador
            label.updateMarkerPosition();

            // Determinar si necesita leader line
            label.needsLeaderLine = label.distanceToOriginal(map) > 15;
        });
    }

    /**
     * Algoritmo principal de reposicionamiento
     */
    function repositionLabels(labels, map) {
        console.log('🔄 Iniciando reposicionamiento de', labels.length, 'etiquetas...');

        let iteration = 0;
        let hasCollisions = true;

        while (hasCollisions && iteration < CONFIG.maxIterations) {
            // Aplicar fuerzas de repulsión
            hasCollisions = applyRepulsionForces(labels, map);

            // Aplicar fuerzas de anclaje
            applyAnchorForces(labels, map);

            // Actualizar posiciones
            updatePositions(labels, map);

            iteration++;
        }

        console.log(`✅ Reposicionamiento completado en ${iteration} iteraciones`);
        console.log(`📊 Etiquetas con leader lines: ${labels.filter(l => l.needsLeaderLine).length}`);
    }

    /**
     * Dibuja las leader lines (líneas de conexión)
     */
    function drawLeaderLines(labels, map, leaderLinesLayer) {
        // Limpiar líneas anteriores
        leaderLinesLayer.clearLayers();

        labels.forEach(label => {
            if (label.needsLeaderLine) {
                const line = L.polyline(
                    [label.originalPos, label.currentPos],
                    {
                        color: CONFIG.leaderLineColor,
                        weight: CONFIG.leaderLineWidth,
                        dashArray: CONFIG.leaderLineDash,
                        opacity: 0.7,
                        interactive: false
                    }
                );

                leaderLinesLayer.addLayer(line);
            }
        });
    }

    /**
     * Inicializa el sistema de etiquetas inteligentes
     */
    function initializeSmartLabels(map, markers) {
        console.log('🎯 Inicializando sistema de etiquetas inteligentes...');

        // Crear capa para leader lines si no existe
        if (!leaderLinesLayer) {
            leaderLinesLayer = L.layerGroup().addTo(map);
        }

        // Crear objetos SmartLabel para cada marcador
        labelData = markers.map(marker => {
            const latLng = marker.getLatLng();
            const text = marker.options.title || marker.getTooltip()?._content || '';
            return new SmartLabel(marker, text, latLng);
        });

        // Ejecutar algoritmo de reposicionamiento
        repositionLabels(labelData, map);

        // Dibujar leader lines
        drawLeaderLines(labelData, map, leaderLinesLayer);

        labelsInitialized = true;
        console.log('✅ Sistema de etiquetas inteligentes inicializado');
    }

    /**
     * Actualiza el sistema cuando el mapa cambia (zoom, pan)
     */
    function updateSmartLabels(map) {
        if (!labelsInitialized || labelData.length === 0) return;

        console.log('🔄 Actualizando etiquetas inteligentes...');

        // Recalcular posiciones
        repositionLabels(labelData, map);

        // Redibujar leader lines
        drawLeaderLines(labelData, map, leaderLinesLayer);
    }

    /**
     * Limpia el sistema de etiquetas inteligentes
     */
    function cleanupSmartLabels(map) {
        if (leaderLinesLayer) {
            map.removeLayer(leaderLinesLayer);
            leaderLinesLayer = null;
        }

        labelData = [];
        labelsInitialized = false;

        console.log('🧹 Sistema de etiquetas inteligentes limpiado');
    }

    // Exponer funciones globalmente
    window.SmartLabels = {
        initialize: initializeSmartLabels,
        update: updateSmartLabels,
        cleanup: cleanupSmartLabels,
        isInitialized: () => labelsInitialized
    };

    console.log('📦 Módulo SmartLabels cargado');
})();
