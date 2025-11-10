$(function() {
  $.fn.dataTable.ext.order['status-voucher'] = function(settings, col) {
    const priority = {
      'Online': 4,
      'Stand by': 3,
      'Offline': 2,
      'Expired': 1
    };
    return this.api().column(col, { order: 'index' }).nodes().map(function(td) {
      const text = $(td).text().trim();
      return priority[text] !== undefined ? priority[text] : 0;
    });
  };

  const hotspotTable = $('#hotspotTable').DataTable({
    pageLength: 10,
    lengthMenu: [10, 25, 50, 100],
    responsive: true,
    dom: '<"d-flex justify-content-between align-items-center mb-3"<"d-flex align-items-center"l><"d-flex"f><"ms-3"#statusFilterContainer>>rtip',
    order: [[2, 'desc'], [0, 'asc']],
    columnDefs: [
      { targets: 0, width: '6%', className: 'text-center text-nowrap' },
      { targets: 1, width: '18%', className: 'text-nowrap' },
      { targets: 2, orderDataType: 'status-voucher', width: '16%', className: 'text-center text-nowrap' },
      { targets: 3, width: '24%', className: 'text-nowrap' },
      { targets: 4, width: '20%', className: 'text-nowrap' },
      { targets: 5, width: '16%', className: 'text-nowrap' },
      { targets: -1, orderable: false, width: '20%', className: 'text-center text-nowrap' }
    ],
    language: {
      url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/id.json',
      paginate: {
        previous: '<i class="bi bi-chevron-left"></i>',
        next: '<i class="bi bi-chevron-right"></i>'
      },
      info: 'Menampilkan _START_ sampai _END_ dari _TOTAL_ user',
      lengthMenu: 'Tampilkan _MENU_ user',
      search: 'Cari:',
      zeroRecords: 'Tidak ada user ditemukan',
      infoEmpty: 'Menampilkan 0 sampai 0 dari 0 user',
      infoFiltered: '(difilter dari _MAX_ total user)'
    }
  });

  const statusFilter = $('<select class="form-select form-select-sm ms-2" style="width:auto; display:inline-block;">' +
    '<option value="">Semua Status</option>' +
    '<option value="Online">Online</option>' +
    '<option value="Stand by">Stand by</option>' +
    '<option value="Offline">Offline</option>' +
    '<option value="Expired">Expired</option>' +
    '</select>');
  $('#statusFilterContainer').append(statusFilter);

  statusFilter.on('change', function() {
    const val = $(this).val();
    if (val) {
      hotspotTable.column(2).search('^' + val + '$', true, false).draw();
    } else {
      hotspotTable.column(2).search('', true, false).draw();
    }
    updateOnlineCount();
    hotspotTable.order([2, 'desc'], [0, 'asc']).draw();
  });

  $('#hotspotTable_filter input').on('input', function() {
    setTimeout(function() {
      hotspotTable.order([2, 'desc'], [0, 'asc']).draw();
    }, 120);
  });

  function extractStatus(cellHtml) {
    return $('<div>').html(cellHtml).text().trim().toLowerCase();
  }

  function updateOnlineCount() {
    let count = 0;
    hotspotTable.rows({ search: 'applied' }).every(function() {
      const rowData = this.data();
      const statusText = extractStatus(rowData[2]);
      if (statusText === 'online') count++;
    });
    $('#activeUserCount').text(count);
  }

  hotspotTable.on('draw', function() {
    updateOnlineCount();
  });

  updateOnlineCount();

  $('#hotspotTable').on('click', '.edit-user-btn', function() {
    const username = $(this).data('username');
    const password = $(this).data('password');
    const profile = $(this).data('profile');
    const routerId = $(this).data('router-id');
    $('#editUsername').val(username);
    $('#editPassword').val(password);
    $('#editProfile').val(profile);
    $('#editRouterId').val(routerId || '');
    $('#originalUsername').val(username);
    $('#editUserModal').modal('show');
  });

  $('#hotspotTable').on('click', '.delete-user-btn', function() {
    const username = $(this).data('username');
    const routerId = $(this).data('router-id');
    if (confirm('Yakin hapus user ' + username + '?')) {
      const form = $('<form>', { method: 'POST', action: '/admin/hotspot/delete' });
      form.append($('<input>', { type: 'hidden', name: 'username', value: username }));
      if (routerId) {
        form.append($('<input>', { type: 'hidden', name: 'router_id', value: routerId }));
      }
      $('body').append(form);
      form.submit();
    }
  });

  let disconnectUsername = '';
  $('#hotspotTable').on('click', '.disconnect-session-btn', function() {
    disconnectUsername = $(this).data('username');
    $('#disconnectUsername').text(disconnectUsername);
    $('#disconnectUserModal').modal('show');
  });

  $('#confirmDisconnect').on('click', function() {
    if (!disconnectUsername) return;
    $.ajax({
      url: '/admin/hotspot/disconnect-user',
      method: 'POST',
      data: { username: disconnectUsername },
      success: function() {
        $('#disconnectUserModal').modal('hide');
        showToast('Berhasil', 'User ' + disconnectUsername + ' berhasil diputus.', 'success');
        setTimeout(() => window.location.reload(), 1000);
      },
      error: function(xhr) {
        $('#disconnectUserModal').modal('hide');
        let msg = 'Gagal memutus user.';
        if (xhr.responseJSON && xhr.responseJSON.message) msg = xhr.responseJSON.message;
        showToast('Error', msg, 'danger');
      }
    });
  });

  function showToast(title, message, type) {
    $('#toastTitle').text(title);
    $('#toastMessage').text(message);
    $('#toastHeader').removeClass('bg-success bg-danger bg-warning').addClass('bg-' + type);
    $('#toastIcon').removeClass().addClass('bi me-2 ' + (type === 'success' ? 'bi-check-circle-fill' : type === 'danger' ? 'bi-x-circle-fill' : 'bi-exclamation-triangle-fill'));
    $('#notificationToast').toast('show');
  }
});
