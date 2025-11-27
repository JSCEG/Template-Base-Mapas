/**
 * Sistema de progreso para exportación
 */
class ProgressSystem {
    constructor() {
        this.overlay = document.getElementById('export-progress-overlay');
        this.titleElement = this.overlay.querySelector('.progress-title');
        this.messageElement = this.overlay.querySelector('.progress-message');
        this.fillElement = this.overlay.querySelector('.progress-fill');
        this.percentageElement = this.overlay.querySelector('.progress-percentage');

        this.isVisible = false;
        this.currentProgress = 0;
    }

    /**
     * Muestra el overlay de progreso
     * @param {Object} options - Opciones del progreso
     */
    show(options = {}) {
        const {
            title = 'Exportando mapa...',
            message = 'Preparando exportación',
            progress = 0
        } = options;

        this.titleElement.textContent = title;
        this.messageElement.textContent = message;
        this.setProgress(progress);

        this.overlay.style.display = 'flex';
        this.isVisible = true;

        // Prevenir scroll del body
        document.body.style.overflow = 'hidden';
    }

    /**
     * Oculta el overlay de progreso
     */
    hide() {
        this.overlay.style.display = 'none';
        this.isVisible = false;
        this.currentProgress = 0;

        // Restaurar scroll del body
        document.body.style.overflow = '';
    }

    /**
     * Actualiza el progreso
     * @param {number} progress - Progreso (0-100)
     * @param {string} message - Mensaje opcional
     */
    setProgress(progress, message = null) {
        this.currentProgress = Math.max(0, Math.min(100, progress));

        this.fillElement.style.width = `${this.currentProgress}%`;
        this.percentageElement.textContent = `${Math.round(this.currentProgress)}%`;

        if (message) {
            this.messageElement.textContent = message;
        }
    }

    /**
     * Actualiza solo el mensaje
     * @param {string} message - Nuevo mensaje
     */
    setMessage(message) {
        this.messageElement.textContent = message;
    }

    /**
     * Actualiza el título
     * @param {string} title - Nuevo título
     */
    setTitle(title) {
        this.titleElement.textContent = title;
    }

    /**
     * Simula progreso automático
     * @param {number} duration - Duración en ms
     * @param {Function} callback - Callback al completar
     */
    simulateProgress(duration = 3000, callback = null) {
        const steps = 50;
        const interval = duration / steps;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            const progress = (step / steps) * 100;
            this.setProgress(progress);

            if (step >= steps) {
                clearInterval(timer);
                if (callback) callback();
            }
        }, interval);

        return timer;
    }
}