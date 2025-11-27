/**
 * Hacer las leyendas draggable para exportación
 */

(function () {
    'use strict';

    // Esperar a que el mapa esté listo
    function initDraggableLegends() {
        if (!window.map) {
            setTimeout(initDraggableLegends, 500);
            return;
        }

        // Observar cuando se añadan nuevas leyendas
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Buscar leyendas dentro del nodo
                        const legends = node.querySelectorAll ?
                            node.querySelectorAll('.info.legend, .leaflet-control-layers') : [];

                        legends.forEach(makeLegendDraggable);

                        // Si el nodo mismo es una leyenda
                        if (node.classList && (node.classList.contains('legend') ||
                            node.classList.contains('leaflet-control-layers'))) {
                            makeLegendDraggable(node);
                        }
                    }
                });
            });
        });

        // Observar el contenedor del mapa
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            observer.observe(mapContainer, {
                childList: true,
                subtree: true
            });
        }

        // Hacer draggable las leyendas existentes
        makeExistingLegendsDraggable();
    }

    function makeExistingLegendsDraggable() {
        const legends = document.querySelectorAll('.info.legend, .leaflet-control');
        legends.forEach(makeLegendDraggable);
    }

    function makeLegendDraggable(legendElement) {
        // Evitar procesar dos veces
        if (legendElement.dataset.draggable === 'true') {
            return;
        }

        legendElement.dataset.draggable = 'true';
        legendElement.style.cursor = 'move';
        legendElement.style.userSelect = 'none';
        legendElement.style.position = 'absolute';

        let isDragging = false;
        let startX, startY, offsetX, offsetY;

        // Obtener posición actual si ya está posicionada
        const computedStyle = window.getComputedStyle(legendElement);
        if (computedStyle.position === 'absolute') {
            offsetX = parseInt(computedStyle.left) || 0;
            offsetY = parseInt(computedStyle.top) || 0;
        } else {
            // Posición inicial relativa al padre
            const rect = legendElement.getBoundingClientRect();
            const parentRect = legendElement.parentElement.getBoundingClientRect();
            offsetX = rect.left - parentRect.left;
            offsetY = rect.top - parentRect.top;
        }

        legendElement.style.left = offsetX + 'px';
        legendElement.style.top = offsetY + 'px';

        // Añadir indicador visual de que es draggable (se oculta en exportación)
        const dragHandle = document.createElement('div');
        dragHandle.className = 'legend-drag-handle no-export';
        dragHandle.innerHTML = '⋮⋮';
        dragHandle.style.cssText = `
            position: absolute;
            top: 2px;
            right: 2px;
            padding: 2px 4px;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 3px;
            font-size: 10px;
            color: #666;
            cursor: move;
            user-select: none;
            line-height: 1;
        `;
        legendElement.style.position = 'relative';
        legendElement.insertBefore(dragHandle, legendElement.firstChild);

        function onMouseDown(e) {
            // Solo arrastrar si se hace clic en el handle o en el fondo de la leyenda
            if (e.target !== dragHandle && e.target !== legendElement) {
                return;
            }

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            legendElement.style.zIndex = '10000';
            legendElement.style.opacity = '0.9';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            e.preventDefault();
            e.stopPropagation();
        }

        function onMouseMove(e) {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            offsetX += deltaX;
            offsetY += deltaY;

            legendElement.style.left = offsetX + 'px';
            legendElement.style.top = offsetY + 'px';

            startX = e.clientX;
            startY = e.clientY;

            e.preventDefault();
        }

        function onMouseUp() {
            if (!isDragging) return;

            isDragging = false;
            legendElement.style.opacity = '1';

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        legendElement.addEventListener('mousedown', onMouseDown);
        dragHandle.addEventListener('mousedown', onMouseDown);
    }

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDraggableLegends);
    } else {
        initDraggableLegends();
    }
})();
