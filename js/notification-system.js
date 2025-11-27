/**
 * Sistema de notificaciones
 */
class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notification-container');
        this.notifications = new Map();
        this.nextId = 1;
    }

    /**
     * Muestra una notificación
     * @param {Object} options - Opciones de la notificación
     * @returns {string} ID de la notificación
     */
    show(options = {}) {
        const {
            type = 'info',
            title = '',
            message = '',
            duration = 5000,
            persistent = false,
            icon = this.getDefaultIcon(type)
        } = options;

        const id = `notification-${this.nextId++}`;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', type === 'error' ? 'alert' : 'status');
        notification.innerHTML = `
            <div class="notification-icon" aria-hidden="true">${icon}</div>
            <div class="notification-content">
                ${title ? `<h5 class="notification-title">${title}</h5>` : ''}
                ${message ? `<p class="notification-message">${message}</p>` : ''}
            </div>
            <button type="button" class="notification-close" aria-label="Cerrar notificación">
                <span aria-hidden="true">&times;</span>
            </button>
        `;

        // Event listener para cerrar
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.hide(id));

        this.container.appendChild(notification);
        this.notifications.set(id, notification);

        // Mostrar con animación
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Auto-ocultar si no es persistente
        if (!persistent && duration > 0) {
            setTimeout(() => this.hide(id), duration);
        }

        return id;
    }

    /**
     * Oculta una notificación
     * @param {string} id - ID de la notificación
     */
    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        notification.classList.remove('show');

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.notifications.delete(id);
        }, 300);
    }

    /**
     * Oculta todas las notificaciones
     */
    hideAll() {
        this.notifications.forEach((_, id) => this.hide(id));
    }

    /**
     * Obtiene el icono por defecto según el tipo
     * @param {string} type - Tipo de notificación
     * @returns {string} Icono
     */
    getDefaultIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    /**
     * Métodos de conveniencia
     */
    success(title, message, options = {}) {
        return this.show({ ...options, type: 'success', title, message });
    }

    error(title, message, options = {}) {
        return this.show({ ...options, type: 'error', title, message, persistent: true });
    }

    warning(title, message, options = {}) {
        return this.show({ ...options, type: 'warning', title, message });
    }

    info(title, message, options = {}) {
        return this.show({ ...options, type: 'info', title, message });
    }
}