/**
 * Interfaz de usuario para exportación de mapas
 */
class ExportUI {
    constructor() {
        this.modal = document.getElementById('export-modal');
        this.form = document.getElementById('export-config-form');
        this.exportButtons = {
            pdf: document.getElementById('export-pdf'),
            png: document.getElementById('export-png')
        };
        this.modalButtons = {
            close: this.modal.querySelector('.modal-close'),
            cancel: this.modal.querySelector('.btn-cancel'),
            confirm: this.modal.querySelector('.btn-export-confirm')
        };
        this.pageSizeSelect = document.getElementById('page-size');
        this.customSizeSection = document.getElementById('custom-size-section');

        this.currentFormat = 'pdf';
        this.isExporting = false;

        this.initializeEventListeners();
    }

    /**
     * Inicializa los event listeners
     */
    initializeEventListeners() {
        // Botones de exportación
        this.exportButtons.pdf.addEventListener('click', () => this.openModal('pdf'));
        this.exportButtons.png.addEventListener('click', () => this.openModal('png'));

        // Botones del modal
        this.modalButtons.close.addEventListener('click', () => this.closeModal());
        this.modalButtons.cancel.addEventListener('click', () => this.closeModal());
        this.modalButtons.confirm.addEventListener('click', () => this.handleExport());

        // Overlay del modal
        this.modal.querySelector('.modal-overlay').addEventListener('click', () => this.closeModal());

        // Escape key para cerrar modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.closeModal();
            }
        });

        // Cambio de tamaño de página
        this.pageSizeSelect.addEventListener('change', () => this.toggleCustomSizeSection());

        // Cambio de formato
        this.form.addEventListener('change', (e) => {
            if (e.target.name === 'format') {
                this.currentFormat = e.target.value;
                this.updateModalForFormat();
            }
        });

        // Validación de campos personalizados
        const customInputs = this.modal.querySelectorAll('#custom-width, #custom-height');
        customInputs.forEach(input => {
            input.addEventListener('input', () => this.validateCustomSize());
        });
    }

    /**
     * Abre el modal de configuración
     * @param {string} format - Formato inicial (pdf o png)
     * @param {string} mapTitle - Título del mapa a pre-llenar en el formulario
     */
    openModal(format = 'pdf') {
        const mapSelect = document.getElementById('map-select');
        const selectedMapName = mapSelect.selectedIndex > 0 ? mapSelect.options[mapSelect.selectedIndex].text : '';
        const mapTitle = selectedMapName || 'Mapa SNIEn - Sistema Nacional de Información Energética';

        console.log('Abriendo modal con título:', mapTitle);
        this.currentFormat = format;

        // Establecer formato seleccionado
        const formatRadio = this.form.querySelector(`input[name="format"][value="${format}"]`);
        if (formatRadio) {
            formatRadio.checked = true;
        }

        // Set the map title input field
        const mapTitleInput = document.getElementById('map-title');
        if (mapTitleInput) {
            mapTitleInput.value = mapTitle;
        }

        this.updateModalForFormat();
        this.modal.classList.add('active');
        this.modal.setAttribute('aria-hidden', 'false');

        // Focus en el primer elemento
        const firstInput = this.modal.querySelector('input, select, button');
        if (firstInput) {
            firstInput.focus();
        }
    }

    /**
     * Cierra el modal
     */
    closeModal() {
        if (this.isExporting) return;

        this.modal.classList.remove('active');
        this.modal.setAttribute('aria-hidden', 'true');
    }

    /**
     * Actualiza el modal según el formato seleccionado
     */
    updateModalForFormat() {
        const title = this.modal.querySelector('#export-modal-title');
        const confirmButton = this.modalButtons.confirm;

        if (this.currentFormat === 'pdf') {
            title.textContent = 'Configurar exportación PDF';
            confirmButton.innerHTML = '<span class="btn-text">Exportar PDF</span><span class="btn-spinner" style="display: none;"><span class="spinner-small"></span></span>';
        } else {
            title.textContent = 'Configurar exportación PNG';
            confirmButton.innerHTML = '<span class="btn-text">Exportar PNG</span><span class="btn-spinner" style="display: none;"><span class="spinner-small"></span></span>';
        }
    }

    /**
     * Muestra/oculta la sección de tamaño personalizado
     */
    toggleCustomSizeSection() {
        const isCustom = this.pageSizeSelect.value === 'custom';
        this.customSizeSection.style.display = isCustom ? 'grid' : 'none';

        if (isCustom) {
            this.validateCustomSize();
        }
    }

    /**
     * Valida los campos de tamaño personalizado
     */
    validateCustomSize() {
        const widthInput = document.getElementById('custom-width');
        const heightInput = document.getElementById('custom-height');
        const confirmButton = this.modalButtons.confirm;

        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);

        const isValid = width >= 100 && width <= 8000 && height >= 100 && height <= 8000;
        confirmButton.disabled = !isValid;

        if (!isValid) {
            confirmButton.style.opacity = '0.5';
            confirmButton.style.cursor = 'not-allowed';
        } else {
            confirmButton.style.opacity = '1';
            confirmButton.style.cursor = 'pointer';
        }
    }

    /**
     * Obtiene la configuración actual del formulario
     * @returns {Object} Configuración de exportación
     */
    getConfiguration() {
        const formData = new FormData(this.form);
        const config = {
            format: formData.get('format') || 'pdf',
            size: {
                preset: formData.get('pageSize') || 'A4',
                dpi: parseInt(formData.get('dpi')) || 300
            },
            elements: {
                includeScale: formData.has('includeScale'),
                includeLegend: formData.has('includeLegend'),
                includeAttribution: formData.has('includeAttribution'),
                includeTimestamp: formData.has('includeTimestamp'),
                includeTitle: formData.has('includeTitle')
            },
            metadata: {
                title: formData.get('mapTitle') || 'Mapa SNIEn - Sistema Nacional de Información Energética'
            }
        };

        // Añadir dimensiones personalizadas si aplica
        if (config.size.preset === 'custom') {
            config.size.width = parseInt(formData.get('customWidth')) || 2480;
            config.size.height = parseInt(formData.get('customHeight')) || 3508;
        }

        return config;
    }

    /**
     * Maneja el proceso de exportación
     */
    async handleExport() {
        if (this.isExporting) return;

        try {
            this.setExportingState(true);

            const config = this.getConfiguration();

            // Aquí se integrará con el MapExporter cuando esté disponible
            if (window.mapExporter) {
                if (config.format === 'pdf') {
                    await window.mapExporter.exportToPDF(config);
                } else {
                    await window.mapExporter.exportToPNG(config);
                }

                this.showSuccessMessage(config.format.toUpperCase());
            } else {
                throw new Error('Exportador de mapas no disponible');
            }

            this.closeModal();
        } catch (error) {
            console.error('Error durante la exportación:', error);
            this.showErrorMessage(error.message);
        } finally {
            this.setExportingState(false);
        }
    }

    /**
     * Establece el estado de exportación
     * @param {boolean} isExporting - Si está exportando
     */
    setExportingState(isExporting) {
        this.isExporting = isExporting;
        const confirmButton = this.modalButtons.confirm;

        if (isExporting) {
            confirmButton.classList.add('loading');
            confirmButton.disabled = true;
        } else {
            confirmButton.classList.remove('loading');
            confirmButton.disabled = false;
        }
    }

    /**
     * Muestra mensaje de éxito
     * @param {string} format - Formato exportado
     */
    showSuccessMessage(format) {
        // Esta funcionalidad se implementará en la siguiente tarea
        console.log(`Exportación ${format} completada exitosamente`);
    }

    /**
     * Muestra mensaje de error
     * @param {string} message - Mensaje de error
     */
    showErrorMessage(message) {
        // Esta funcionalidad se implementará en la siguiente tarea
        console.error('Error de exportación:', message);
    }
}