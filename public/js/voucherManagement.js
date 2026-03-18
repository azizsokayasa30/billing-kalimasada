/**
 * Voucher Management Functions untuk Admin Hotspot Users
 * Fungsi ini mengintegrasikan fitur print voucher dari voucher-manager
 */

// Fungsi untuk print voucher yang dipilih
function printSelectedVouchers() {
    const selectedUsernames = getSelectedUsernames();
    
    if (selectedUsernames.length === 0) {
        if (typeof showToast === 'function') {
            showToast('Peringatan', 'Pilih voucher terlebih dahulu', 'warning');
        } else {
            alert('Pilih voucher terlebih dahulu');
        }
        return;
    }
    
    // Tampilkan modal untuk memilih template
    showTemplateSelectionModal(selectedUsernames);
}

// Fungsi untuk mendapatkan username yang dipilih
function getSelectedUsernames() {
    const selected = [];
    // Coba beberapa selector untuk kompatibilitas
    const checkboxes = $('.voucher-select-checkbox:checked, input.voucher-select-checkbox:checked, .form-check-input.voucher-select-checkbox:checked');
    
    if (checkboxes.length === 0) {
        console.warn('Tidak ada checkbox yang terpilih');
        return selected;
    }
    
    checkboxes.each(function() {
        const username = $(this).data('username') || $(this).attr('data-username');
        if (username) {
            selected.push(username);
        } else {
            console.warn('Checkbox tidak memiliki data-username:', this);
        }
    });
    
    console.log('Selected usernames:', selected);
    return selected;
}

// Fungsi untuk menampilkan modal pemilihan template
function showTemplateSelectionModal(usernames) {
    // Load available templates dari endpoint
    fetch('/admin/hotspot/voucher-templates')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data.length > 0) {
                const templates = data.data.filter(t => t.status === 'enabled');
                
                if (templates.length === 0) {
                    if (typeof showToast === 'function') {
                        showToast('Peringatan', 'Tidak ada template yang aktif', 'warning');
                    } else {
                        alert('Tidak ada template yang aktif');
                    }
                    return;
                }
                
                // Buat modal untuk pemilihan template (sama seperti voucher-manager)
                const modalHtml = `
                    <div class="modal fade" id="printTemplateModal" tabindex="-1" aria-labelledby="printTemplateModalLabel" aria-hidden="true">
                        <div class="modal-dialog">
                            <div class="modal-content">
                                <div class="modal-header bg-primary text-white">
                                    <h5 class="modal-title" id="printTemplateModalLabel">
                                        <i class="bi bi-printer me-2"></i> Print Selected Voucher
                                    </h5>
                                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="alert alert-info">
                                        <strong>Petunjuk:</strong>
                                        <ul class="mb-0 mt-2">
                                            <li>Pilih template voucher yang akan digunakan untuk print</li>
                                            <li>Template akan menentukan format dan layout voucher yang dicetak</li>
                                        </ul>
                                    </div>
                                    <div class="mb-3">
                                        <label for="printTemplateSelect" class="form-label">
                                            Voucher Template <span class="text-danger">*</span>
                                        </label>
                                        <select class="form-select" id="printTemplateSelect">
                                            ${templates.map(t => 
                                                `<option value="${t.id}" ${t.is_default ? 'selected' : ''}>${escapeHtml(t.template_name)}</option>`
                                            ).join('')}
                                        </select>
                                        <small class="form-text text-muted">
                                            Pilih template yang akan digunakan untuk mencetak voucher
                                        </small>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                        <i class="bi bi-x-circle me-1"></i> Batal
                                    </button>
                                    <button type="button" class="btn btn-primary" onclick="proceedPrintVouchersFromUsernames(${JSON.stringify(usernames).replace(/"/g, '&quot;')})">
                                        <i class="bi bi-printer me-1"></i> CONTINUE PRINT
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Hapus modal lama jika ada
                $('#printTemplateModal').remove();
                
                // Tambahkan modal ke body
                $('body').append(modalHtml);
                
                // Tampilkan modal
                const modal = new bootstrap.Modal(document.getElementById('printTemplateModal'));
                modal.show();
            } else {
                if (typeof showToast === 'function') {
                    showToast('Error', 'Tidak ada template tersedia', 'danger');
                } else {
                    alert('Tidak ada template tersedia');
                }
            }
        })
        .catch(error => {
            console.error('Error loading templates:', error);
            if (typeof showToast === 'function') {
                showToast('Error', 'Gagal memuat template', 'danger');
            } else {
                alert('Error: Gagal memuat template');
            }
        });
}

// Fungsi untuk memproses print voucher dari username
function proceedPrintVouchersFromUsernames(usernames) {
    const templateSelect = document.getElementById('printTemplateSelect');
    if (!templateSelect) {
        if (typeof showToast === 'function') {
            showToast('Error', 'Modal template tidak ditemukan', 'danger');
        } else {
            alert('Modal template tidak ditemukan');
        }
        return;
    }
    
    const templateId = templateSelect.value;
    if (!templateId) {
        if (typeof showToast === 'function') {
            showToast('Peringatan', 'Pilih template terlebih dahulu', 'warning');
        } else {
            alert('Pilih template terlebih dahulu');
        }
        return;
    }
    
    // Tutup modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('printTemplateModal'));
    if (modal) {
        modal.hide();
    }
    
    // Kirim request ke endpoint untuk mendapatkan voucher data dan print
    fetch('/admin/hotspot/print-vouchers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            usernames: usernames,
            template_id: parseInt(templateId)
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.message || 'Gagal memproses print voucher');
            });
        }
        return response.text();
    })
    .then(html => {
        // Buka print window dengan HTML response
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            // Tunggu sebentar untuk memastikan konten ter-load
            setTimeout(() => {
                printWindow.print();
            }, 500);
        } else {
            if (typeof showToast === 'function') {
                showToast('Error', 'Tidak dapat membuka window print. Pastikan popup blocker dinonaktifkan.', 'danger');
            } else {
                alert('Tidak dapat membuka window print. Pastikan popup blocker dinonaktifkan.');
            }
        }
    })
    .catch(error => {
        console.error('Error printing vouchers:', error);
        if (typeof showToast === 'function') {
            showToast('Error', error.message || 'Gagal mencetak voucher', 'danger');
        } else {
            alert('Error: ' + (error.message || 'Gagal mencetak voucher'));
        }
    });
}

// Fungsi untuk print semua voucher
function printAllVouchers() {
    // Ambil semua username dari tabel
    const allUsernames = [];
    $('.voucher-select-checkbox').each(function() {
        const username = $(this).data('username');
        if (username) {
            allUsernames.push(username);
        }
    });
    
    if (allUsernames.length === 0) {
        if (typeof showToast === 'function') {
            showToast('Peringatan', 'Tidak ada voucher untuk di-print', 'warning');
        } else {
            alert('Tidak ada voucher untuk di-print');
        }
        return;
    }
    
    // Print semua voucher dengan template default
    // Tampilkan modal template selection dulu
    showTemplateSelectionModal(allUsernames);
}

// Fungsi helper untuk escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function untuk showToast - menggunakan modern notification
function showToastMessage(title, message, type) {
    // Map type untuk konsistensi
    const typeMap = {
        'success': 'success',
        'error': 'error',
        'danger': 'error',
        'warning': 'warning',
        'info': 'info'
    };
    
    const mappedType = typeMap[type] || 'info';
    
    if (typeof showToast === 'function') {
        showToast(title, message, mappedType, 5000);
    } else {
        // Fallback ke alert jika showToast belum tersedia
        alert(`${title}: ${message}`);
    }
}

// Helper function untuk showAlert - menggunakan modern alert modal
function showAlertMessage(title, message, type = 'success', options = {}) {
    // Pastikan showAlert sudah ter-load
    if (typeof showAlert === 'function') {
        showAlert(title, message, type, options);
    } else {
        // Jika belum tersedia, tunggu DOM ready dan coba lagi
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                if (typeof showAlert === 'function') {
                    showAlert(title, message, type, options);
                } else {
                    // Fallback ke confirm jika showAlert belum tersedia
                    fallbackAlert(title, message, options);
                }
            });
        } else {
            // DOM sudah ready, tunggu sebentar untuk script ter-load
            setTimeout(() => {
                if (typeof showAlert === 'function') {
                    showAlert(title, message, type, options);
                } else {
                    fallbackAlert(title, message, options);
                }
            }, 100);
        }
    }
}

// Fallback function untuk alert jika showAlert belum tersedia
function fallbackAlert(title, message, options = {}) {
    if (options.showCancel) {
        if (confirm(`${title}\n\n${message}`)) {
            if (options.onConfirm) options.onConfirm();
        } else {
            if (options.onCancel) options.onCancel();
        }
    } else {
        alert(`${title}\n\n${message}`);
        if (options.onConfirm) options.onConfirm();
    }
}

// Fungsi untuk redirect ke halaman generate voucher
function showGenerateVoucherModal() {
    // Redirect ke halaman buat voucher
    window.location.href = '/admin/hotspot/voucher';
}

// Fungsi untuk search voucher (gunakan search box yang sudah ada)
function showSearchVoucherModal() {
    // Fokus ke search box yang sudah ada di halaman
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="Cari"], input[name*="search"]');
    if (searchInput) {
        searchInput.focus();
        searchInput.select();
        showToastMessage('Info', 'Gunakan kotak pencarian di atas tabel untuk mencari voucher', 'info');
    } else {
        showToastMessage('Info', 'Gunakan kotak pencarian di atas tabel untuk mencari voucher', 'info');
    }
}

// Fungsi untuk menghapus voucher yang expired
function removeExpiredVouchers() {
    showAlertMessage(
        'Konfirmasi',
        'Apakah Anda yakin ingin menghapus semua voucher yang expired?',
        'warning',
        {
            showCancel: true,
            confirmText: 'Ya, Hapus',
            cancelText: 'Batal',
            onConfirm: () => {
                fetch('/admin/hotspot/remove-expired', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showAlertMessage(
                            'Berhasil!',
                            data.message || 'Voucher expired berhasil dihapus',
                            'success',
                            {
                                onConfirm: () => {
                                    window.location.reload();
                                }
                            }
                        );
                    } else {
                        showAlertMessage('Error', data.message || 'Gagal menghapus voucher expired', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error removing expired vouchers:', error);
                    showAlertMessage('Error', 'Gagal menghapus voucher expired: ' + error.message, 'error');
                });
            },
            onCancel: () => {
                // User membatalkan, tidak perlu melakukan apa-apa
            }
        }
    );
}

// Fungsi untuk export CSV
function exportCSV() {
    // Ambil semua data dari tabel
    const table = document.querySelector('table.dataTable, table.table');
    if (!table) {
        showToastMessage('Error', 'Tabel tidak ditemukan', 'danger');
        return;
    }
    
    // Buat CSV content
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    rows.forEach((row, index) => {
        const cols = row.querySelectorAll('td, th');
        const rowData = [];
        cols.forEach(col => {
            // Skip checkbox dan action buttons
            if (!col.querySelector('input[type="checkbox"]') && !col.querySelector('button')) {
                let text = col.innerText.trim();
                // Escape quotes
                text = text.replace(/"/g, '""');
                rowData.push('"' + text + '"');
            }
        });
        if (rowData.length > 0) {
            csv.push(rowData.join(','));
        }
    });
    
    // Download CSV
    const csvContent = csv.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'voucher_export_' + new Date().toISOString().split('T')[0] + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToastMessage('Berhasil', 'Data voucher berhasil diekspor ke CSV', 'success');
}

// Fungsi untuk enable voucher yang dipilih
function enableSelectedVouchers() {
    const selected = getSelectedUsernames();
    if (selected.length === 0) {
        showToastMessage('Peringatan', 'Pilih voucher terlebih dahulu', 'warning');
        return;
    }
    
    showAlertMessage(
        'Konfirmasi',
        `Apakah Anda yakin ingin mengaktifkan ${selected.length} voucher yang dipilih?`,
        'warning',
        {
            showCancel: true,
            confirmText: 'Ya, Aktifkan',
            cancelText: 'Batal',
            onConfirm: () => {
                fetch('/admin/hotspot/enable-vouchers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        usernames: selected
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showAlertMessage(
                            'Berhasil!',
                            data.message || `${selected.length} voucher berhasil diaktifkan`,
                            'success',
                            {
                                onConfirm: () => {
                                    window.location.reload();
                                }
                            }
                        );
                    } else {
                        showAlertMessage('Error', data.message || 'Gagal mengaktifkan voucher', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error enabling vouchers:', error);
                    showAlertMessage('Error', 'Gagal mengaktifkan voucher: ' + error.message, 'error');
                });
            },
            onCancel: () => {
                // User membatalkan
            }
        }
    );
}

// Fungsi untuk disable voucher yang dipilih
function disableSelectedVouchers() {
    const selected = getSelectedUsernames();
    if (selected.length === 0) {
        showToastMessage('Peringatan', 'Pilih voucher terlebih dahulu', 'warning');
        return;
    }
    
    showAlertMessage(
        'Konfirmasi',
        `Apakah Anda yakin ingin menonaktifkan ${selected.length} voucher yang dipilih?`,
        'warning',
        {
            showCancel: true,
            confirmText: 'Ya, Nonaktifkan',
            cancelText: 'Batal',
            onConfirm: () => {
                fetch('/admin/hotspot/disable-vouchers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        usernames: selected
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showAlertMessage(
                            'Berhasil!',
                            data.message || `${selected.length} voucher berhasil dinonaktifkan`,
                            'success',
                            {
                                onConfirm: () => {
                                    window.location.reload();
                                }
                            }
                        );
                    } else {
                        showAlertMessage('Error', data.message || 'Gagal menonaktifkan voucher', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error disabling vouchers:', error);
                    showAlertMessage('Error', 'Gagal menonaktifkan voucher: ' + error.message, 'error');
                });
            },
            onCancel: () => {
                // User membatalkan
            }
        }
    );
}

// Fungsi untuk menghapus voucher yang dipilih
function removeSelectedVouchers() {
    const selected = getSelectedUsernames();
    if (selected.length === 0) {
        showToastMessage('Peringatan', 'Pilih voucher terlebih dahulu', 'warning');
        return;
    }
    
    showAlertMessage(
        'Konfirmasi',
        `Apakah Anda yakin ingin menghapus ${selected.length} voucher yang dipilih?`,
        'warning',
        {
            showCancel: true,
            confirmText: 'Ya, Hapus',
            cancelText: 'Batal',
            onConfirm: () => {
                const vouchers = [];
                selected.forEach(username => {
                    const checkbox = document.querySelector(`input[data-username="${username}"]`);
                    if (checkbox) {
                        const row = checkbox.closest('tr');
                        const routerId = row ? (row.dataset.routerId || null) : null;
                        vouchers.push({
                            username: username,
                            router_id: routerId
                        });
                    } else {
                        vouchers.push({
                            username: username,
                            router_id: null
                        });
                    }
                });
                
                fetch('/admin/hotspot/delete-selected', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        vouchers: vouchers
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showAlertMessage(
                            'Berhasil!',
                            data.message || `${selected.length} voucher berhasil dihapus`,
                            'success',
                            {
                                onConfirm: () => {
                                    window.location.reload();
                                }
                            }
                        );
                    } else {
                        showAlertMessage('Error', data.message || 'Gagal menghapus voucher', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error removing vouchers:', error);
                    showAlertMessage('Error', 'Gagal menghapus voucher: ' + error.message, 'error');
                });
            },
            onCancel: () => {
                // User membatalkan
            }
        }
    );
}

// Export functions untuk digunakan di halaman
// Ekspor langsung karena fungsi sudah didefinisikan di level global
window.printSelectedVouchers = printSelectedVouchers;
window.printAllVouchers = printAllVouchers;
window.showGenerateVoucherModal = showGenerateVoucherModal;
window.showSearchVoucherModal = showSearchVoucherModal;
window.removeExpiredVouchers = removeExpiredVouchers;
window.exportCSV = exportCSV;
window.enableSelectedVouchers = enableSelectedVouchers;
window.disableSelectedVouchers = disableSelectedVouchers;
window.removeSelectedVouchers = removeSelectedVouchers;
window.proceedPrintVouchersFromUsernames = proceedPrintVouchersFromUsernames;
window.showTemplateSelectionModal = showTemplateSelectionModal;
window.showAlertMessage = showAlertMessage;
window.getSelectedUsernames = getSelectedUsernames;