// Fix para errores de sincronización de capas móviles
// Este script previene errores cuando se cambian los mapas base

(function () {
    // Interceptar errores de click en capas
    window.addEventListener('error', function (e) {
        // Ignorar errores específicos de capas
        if (e.message && e.message.includes("Cannot read properties of undefined (reading 'click')")) {
            e.preventDefault();
            console.log('Error de capa ignorado (esto es normal)');
            return true;
        }
    }, true);

    // Agregar delay a los cambios de capa para evitar conflictos
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
            const mobileLayersContainer = document.getElementById('mobile-layers-container');
            if (mobileLayersContainer) {
                // Usar delegación de eventos para manejar clicks en capas
                mobileLayersContainer.addEventListener('change', function (e) {
                    if (e.target.type === 'radio' || e.target.type === 'checkbox') {
                        // Prevenir el comportamiento por defecto del onchange inline
                        e.stopImmediatePropagation();

                        const layerText = e.target.nextElementSibling.textContent.trim();
                        const isBase = e.target.type === 'radio';

                        // Buscar y hacer click en la capa correspondiente con delay
                        setTimeout(function () {
                            try {
                                const selector = isBase ? '.leaflet-control-layers-base label' : '.leaflet-control-layers-overlays label';
                                const labels = document.querySelectorAll(selector);

                                for (let label of labels) {
                                    const span = label.querySelector('span');
                                    if (span && span.textContent.trim() === layerText) {
                                        const input = label.querySelector('input');
                                        if (input && input.checked !== e.target.checked) {
                                            input.click();
                                        }
                                        break;
                                    }
                                }
                            } catch (error) {
                                console.warn('Error al cambiar capa (ignorado):', error);
                            }
                        }, 150);
                    }
                }, true);
            }
        }, 1000);
    });
})();
