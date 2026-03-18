/**
 * Modern Alert System
 * Sistem alert modal yang modern dan elegan seperti SweetAlert2
 * Dengan icon besar, animasi smooth, dan desain yang clean
 */

(function() {
    'use strict';

    // Inject CSS styles
    function injectStyles() {
        if (document.getElementById('modern-alert-styles')) {
            return; // Styles already injected
        }

        const style = document.createElement('style');
        style.id = 'modern-alert-styles';
        style.textContent = `
            .modern-alert-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10500;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                opacity: 0;
                transition: opacity 0.3s ease;
                backdrop-filter: blur(4px);
            }

            .modern-alert-overlay.show {
                opacity: 1;
            }

            .modern-alert-modal {
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 500px;
                width: 100%;
                overflow: hidden;
                transform: scale(0.7) translateY(50px);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                position: relative;
            }

            .modern-alert-overlay.show .modern-alert-modal {
                transform: scale(1) translateY(0);
                opacity: 1;
            }

            .modern-alert-icon-container {
                padding: 40px 20px 20px;
                text-align: center;
                background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            }

            .modern-alert-icon {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
                animation: scaleIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }

            @keyframes scaleIn {
                0% {
                    transform: scale(0);
                }
                50% {
                    transform: scale(1.1);
                }
                100% {
                    transform: scale(1);
                }
            }

            .modern-alert-icon.success {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: #ffffff;
            }

            .modern-alert-icon.error,
            .modern-alert-icon.danger {
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                color: #ffffff;
            }

            .modern-alert-icon.warning {
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                color: #ffffff;
            }

            .modern-alert-icon.info {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: #ffffff;
            }

            .modern-alert-icon i {
                font-size: 48px;
            }

            .modern-alert-content {
                padding: 0 30px 30px;
                text-align: center;
            }

            .modern-alert-title {
                font-size: 28px;
                font-weight: 700;
                color: #1f2937;
                margin: 0 0 12px;
                line-height: 1.3;
            }

            .modern-alert-message {
                font-size: 16px;
                color: #6b7280;
                line-height: 1.6;
                margin: 0 0 30px;
            }

            .modern-alert-footer {
                padding: 20px 30px 30px;
                display: flex;
                gap: 12px;
                justify-content: center;
            }

            .modern-alert-btn {
                padding: 12px 32px;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 120px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            .modern-alert-btn:focus {
                outline: none;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
            }

            .modern-alert-btn-primary {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: #ffffff;
            }

            .modern-alert-btn-primary:hover {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            }

            .modern-alert-btn-primary:active {
                transform: translateY(0);
            }

            .modern-alert-btn-secondary {
                background: #f3f4f6;
                color: #374151;
            }

            .modern-alert-btn-secondary:hover {
                background: #e5e7eb;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .modern-alert-btn-secondary:active {
                transform: translateY(0);
            }

            /* Responsive */
            @media (max-width: 768px) {
                .modern-alert-modal {
                    max-width: 90%;
                    margin: 20px;
                }

                .modern-alert-icon {
                    width: 60px;
                    height: 60px;
                }

                .modern-alert-icon i {
                    font-size: 36px;
                }

                .modern-alert-title {
                    font-size: 24px;
                }

                .modern-alert-message {
                    font-size: 14px;
                }

                .modern-alert-footer {
                    flex-direction: column;
                }

                .modern-alert-btn {
                    width: 100%;
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

    // Main alert function
    window.showAlert = function(title, message, type = 'success', options = {}) {
        // Inject styles
        injectStyles();

        // Remove existing alert if any
        const existing = document.getElementById('modern-alert-overlay');
        if (existing) {
            existing.remove();
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'modern-alert-overlay';
        overlay.className = 'modern-alert-overlay';
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modern-alert-modal';

        const iconClass = getIconClass(type);
        const confirmText = options.confirmText || 'OK';
        const cancelText = options.cancelText || 'Batal';
        const showCancel = options.showCancel || false;
        const onConfirm = options.onConfirm || null;
        const onCancel = options.onCancel || null;

        // Build buttons HTML
        let buttonsHtml = '';
        if (showCancel) {
            buttonsHtml = `
                <button class="modern-alert-btn modern-alert-btn-secondary" onclick="closeModernAlert(false)">
                    ${escapeHtml(cancelText)}
                </button>
                <button class="modern-alert-btn modern-alert-btn-primary" onclick="closeModernAlert(true)">
                    ${escapeHtml(confirmText)}
                </button>
            `;
        } else {
            buttonsHtml = `
                <button class="modern-alert-btn modern-alert-btn-primary" onclick="closeModernAlert(true)">
                    ${escapeHtml(confirmText)}
                </button>
            `;
        }

        modal.innerHTML = `
            <div class="modern-alert-icon-container">
                <div class="modern-alert-icon ${type}">
                    <i class="bi ${iconClass}"></i>
                </div>
            </div>
            <div class="modern-alert-content">
                <h3 class="modern-alert-title">${escapeHtml(title)}</h3>
                <p class="modern-alert-message">${escapeHtml(message)}</p>
            </div>
            <div class="modern-alert-footer">
                ${buttonsHtml}
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Store callbacks
        overlay.dataset.onConfirm = onConfirm ? 'true' : 'false';
        overlay.dataset.onCancel = onCancel ? 'true' : 'false';

        // Trigger animation
        setTimeout(() => {
            overlay.classList.add('show');
        }, 10);

        // Handle ESC key
        const escHandler = function(e) {
            if (e.key === 'Escape') {
                closeModernAlert(false);
            }
        };
        document.addEventListener('keydown', escHandler);
        overlay.dataset.escHandler = 'true';

        // Store overlay reference for close function
        window._currentModernAlert = {
            overlay: overlay,
            onConfirm: onConfirm,
            onCancel: onCancel
        };

        // Click overlay to close (optional)
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                // Don't close on overlay click for confirmation dialogs
                // Only close if it's a simple alert (no cancel button)
                if (!showCancel) {
                    closeModernAlert(false);
                }
            }
        });
    };

    // Close alert function
    window.closeModernAlert = function(confirmed = true) {
        const alertData = window._currentModernAlert;
        if (!alertData) return;

        const overlay = alertData.overlay;
        overlay.classList.remove('show');

        setTimeout(() => {
            overlay.remove();
            window._currentModernAlert = null;

            // Call callback
            if (confirmed && alertData.onConfirm) {
                alertData.onConfirm();
            } else if (!confirmed && alertData.onCancel) {
                alertData.onCancel();
            }
        }, 300);
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
