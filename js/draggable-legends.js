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

        // Estado de escala para resizing
        let scale = parseFloat(legendElement.dataset.legendScale || '1');
        const minScale = 0.6;
        const maxScale = 2.0;
        legendElement.style.transformOrigin = 'top left';
        applyLegendScale(legendElement, scale);

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

            // Flag global para que otros listeners puedan ignorar eventos durante el drag
            window.isLegendDragging = true;

            legendElement.style.zIndex = '10000';
            legendElement.style.opacity = '0.9';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp, { capture: true });

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
            e.stopPropagation();
        }

        function onMouseUp(e) {
            if (!isDragging) return;

            isDragging = false;
            legendElement.style.opacity = '1';

            // Limpiar flag global
            window.isLegendDragging = false;
            // Ignorar el siguiente click del mapa (mouseup dispara click en Leaflet)
            window.ignoreNextMapClick = true;
            setTimeout(() => { window.ignoreNextMapClick = false; }, 150);

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
        }

        legendElement.addEventListener('mousedown', onMouseDown);
        dragHandle.addEventListener('mousedown', onMouseDown);

        // Evitar que un simple click en el handle se interprete como click fuera
        dragHandle.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        // --- Resize handle ---
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'legend-resize-handle no-export';
        resizeHandle.innerHTML = '⤢';
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 14px;
            height: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 3px;
            font-size: 10px;
            color: #666;
            cursor: nwse-resize;
            user-select: none;
            line-height: 1;
        `;
        legendElement.appendChild(resizeHandle);

        let resizing = false;
        let resizeStartX = 0;
        let resizeStartY = 0;
        let startScale = scale;

        function onResizeDown(e) {
            resizing = true;
            window.isLegendDragging = true; // reutilizamos bandera para ignorar clicks
            resizeStartX = e.clientX;
            resizeStartY = e.clientY;
            startScale = scale;
            document.addEventListener('mousemove', onResizeMove);
            document.addEventListener('mouseup', onResizeUp, { capture: true });
            e.preventDefault();
            e.stopPropagation();
        }

        function onResizeMove(e) {
            if (!resizing) return;
            const dx = e.clientX - resizeStartX;
            const dy = e.clientY - resizeStartY;
            const delta = (Math.abs(dx) + Math.abs(dy)) / 300; // sensibilidad
            const direction = (dx + dy) >= 0 ? 1 : -1;
            scale = Math.min(maxScale, Math.max(minScale, startScale + direction * delta));
            applyLegendScale(legendElement, scale);
            e.preventDefault();
            e.stopPropagation();
        }

        function onResizeUp(e) {
            if (!resizing) return;
            resizing = false;
            window.isLegendDragging = false;
            window.ignoreNextMapClick = true;
            setTimeout(() => { window.ignoreNextMapClick = false; }, 150);
            document.removeEventListener('mousemove', onResizeMove);
            document.removeEventListener('mouseup', onResizeUp);
            legendElement.dataset.legendScale = String(scale);
            e.preventDefault();
            e.stopPropagation();
        }

        resizeHandle.addEventListener('mousedown', onResizeDown);
        resizeHandle.addEventListener('click', function (e) { e.stopPropagation(); });

        // --- Plus / Minus controls ---
        const controls = document.createElement('div');
        controls.className = 'legend-scale-controls no-export';
        controls.style.cssText = `
            position: absolute;
            bottom: 2px;
            left: 2px;
            display: flex;
            gap: 4px;
        `;
        const btnMinus = document.createElement('button');
        btnMinus.textContent = '−';
        btnMinus.title = 'Reducir leyenda';
        btnMinus.style.cssText = `
            width: 18px; height: 18px; line-height: 16px;
            font-size: 12px; cursor: pointer; border: 1px solid #ccc;
            border-radius: 3px; background: #fff; color: #333; padding: 0;
        `;
        const btnPlus = document.createElement('button');
        btnPlus.textContent = '+';
        btnPlus.title = 'Aumentar leyenda';
        btnPlus.style.cssText = btnMinus.style.cssText;
        controls.appendChild(btnMinus);
        controls.appendChild(btnPlus);
        legendElement.appendChild(controls);

        function bumpScale(delta) {
            scale = Math.min(maxScale, Math.max(minScale, scale + delta));
            applyLegendScale(legendElement, scale);
            legendElement.dataset.legendScale = String(scale);
        }

        btnMinus.addEventListener('click', function (e) {
            e.stopPropagation();
            bumpScale(-0.1);
        });

        btnPlus.addEventListener('click', function (e) {
            e.stopPropagation();
            bumpScale(0.1);
        });

        // --- Double click cycle ---
        const cycleScales = [0.8, 1.0, 1.4, 1.8];
        legendElement.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            // Encontrar el siguiente valor del ciclo más cercano
            let idx = cycleScales.findIndex(v => Math.abs(v - scale) < 0.05);
            idx = (idx === -1 ? 0 : (idx + 1) % cycleScales.length);
            scale = cycleScales[idx];
            applyLegendScale(legendElement, scale);
            legendElement.dataset.legendScale = String(scale);
        });
    }

    function applyLegendScale(el, s) {
        // Aplicar transform escala y ajustar fuente para que se vea nítida
        el.style.transform = `scale(${s})`;
        el.style.fontSize = `${Math.round(12 * s)}px`;
        // También ajustar padding/margins internos proporcionales
        // Nota: evitamos tocar width/height para no romper layout absoluto
    }

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDraggableLegends);
    } else {
        initDraggableLegends();
    }
})();
