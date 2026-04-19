/**
 * Modern Notification System
 * Sistem notifikasi yang modern dan elegan dengan animasi smooth
 */

(function() {
    'use strict';

    // Create notification container if not exists
    function createNotificationContainer() {
        let container = document.getElementById('modern-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'modern-notification-container';
            container.className = 'modern-notification-container';
            document.body.appendChild(container);
        }
        return container;
    }

    // Add CSS styles
    function injectStyles() {
        if (document.getElementById('modern-notification-styles')) {
            return; // Styles already injected
        }

        const style = document.createElement('style');
        style.id = 'modern-notification-styles';
        style.textContent = `
            .modern-notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-width: 400px;
                pointer-events: none;
            }

            .modern-notification {
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
                padding: 0;
                min-width: 320px;
                max-width: 400px;
                overflow: hidden;
                pointer-events: auto;
                transform: translateX(400px);
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }

            .modern-notification.slide-out {
                animation: slideOutRight 0.3s ease-in forwards;
            }

            .modern-notification-header {
                display: flex;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                background: linear-gradient(135deg, var(--notification-color, #667eea) 0%, var(--notification-color-dark, #764ba2) 100%);
            }

            .modern-notification-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 12px;
                flex-shrink: 0;
            }

            .modern-notification-icon i {
                font-size: 20px;
                color: #ffffff;
            }

            .modern-notification-title-section {
                flex: 1;
                min-width: 0;
            }

            .modern-notification-title {
                font-size: 16px;
                font-weight: 600;
                color: #ffffff;
                margin: 0;
                line-height: 1.4;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .modern-notification-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                margin-left: 12px;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }

            .modern-notification-close:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }

            .modern-notification-close i {
                font-size: 14px;
                color: #ffffff;
            }

            .modern-notification-body {
                padding: 16px 20px;
                color: #2d3748;
                font-size: 14px;
                line-height: 1.6;
            }

            .modern-notification-progress {
                height: 3px;
                background: rgba(0, 0, 0, 0.05);
                position: relative;
                overflow: hidden;
            }

            .modern-notification-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, var(--notification-color, #667eea) 0%, var(--notification-color-dark, #764ba2) 100%);
                width: 100%;
                animation: progressAnimation linear forwards;
            }

            @keyframes progressAnimation {
                from {
                    width: 100%;
                }
                to {
                    width: 0%;
                }
            }

            /* Notification Types */
            .modern-notification.success {
                --notification-color: #10b981;
                --notification-color-dark: #059669;
            }

            .modern-notification.error,
            .modern-notification.danger {
                --notification-color: #ef4444;
                --notification-color-dark: #dc2626;
            }

            .modern-notification.warning {
                --notification-color: #f59e0b;
                --notification-color-dark: #d97706;
            }

            .modern-notification.info {
                --notification-color: #3b82f6;
                --notification-color-dark: #2563eb;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .modern-notification-container {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }

                .modern-notification {
                    min-width: auto;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Get icon class based on type
    function getIconClass(type) {
        const icons = {
            'success': 'bi-check-circle-fill',
            'error': 'bi-x-circle-fill',
            'danger': 'bi-x-circle-fill',
            'warning': 'bi-exclamation-triangle-fill',
            'info': 'bi-info-circle-fill'
        };
        return icons[type] || icons['info'];
    }

    // Main notification function
    window.showToast = function(title, message, type = 'info', duration = 5000) {
        // Inject styles
        injectStyles();

        // Create container
        const container = createNotificationContainer();

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `modern-notification ${type}`;
        
        const notificationId = 'notification-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        notification.id = notificationId;

        const iconClass = getIconClass(type);

        // Create progress bar if duration > 0
        let progressBarHtml = '';
        if (duration > 0) {
            progressBarHtml = `
                <div class="modern-notification-progress">
                    <div class="modern-notification-progress-bar" style="animation-duration: ${duration}ms;"></div>
                </div>
            `;
        }

        notification.innerHTML = `
            <div class="modern-notification-header">
                <div class="modern-notification-icon">
                    <i class="bi ${iconClass}"></i>
                </div>
                <div class="modern-notification-title-section">
                    <h6 class="modern-notification-title">${escapeHtml(title)}</h6>
                </div>
                <button class="modern-notification-close" onclick="closeNotification('${notificationId}')">
                    <i class="bi bi-x"></i>
                </button>
            </div>
            <div class="modern-notification-body">
                ${escapeHtml(message)}
            </div>
            ${progressBarHtml}
        `;

        // Append to container
        container.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 10);

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                closeNotification(notificationId);
            }, duration);
        }

        return notificationId;
    };

    // Close notification function
    window.closeNotification = function(notificationId) {
        const notification = document.getElementById(notificationId);
        if (notification) {
            notification.classList.add('slide-out');
            setTimeout(() => {
                notification.remove();
                // Remove container if empty
                const container = document.getElementById('modern-notification-container');
                if (container && container.children.length === 0) {
                    container.remove();
                }
            }, 300);
        }
    };

    // Helper function to escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Expose escapeHtml globally if needed
    window.escapeHtml = escapeHtml;

})();
