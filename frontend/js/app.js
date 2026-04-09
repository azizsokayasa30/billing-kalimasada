/* ============================================
   CI/CD Monitoring Dashboard — App Logic
   ============================================ */

// ========== SAMPLE DATA ==========
const servers = [
  {
    id: 1,
    name: 'Production Server',
    ip_address: '103.56.148.22',
    ssh_user: 'root',
    ssh_port: 22,
    description: 'Main production server — Jakarta DC',
    projects_count: 4,
    status: 'up',
    uptime: '99.9%',
    last_deploy: '2 hours ago'
  },
  {
    id: 2,
    name: 'Staging Server',
    ip_address: '103.56.148.45',
    ssh_user: 'deploy',
    ssh_port: 22,
    description: 'Staging & testing environment',
    projects_count: 2,
    status: 'up',
    uptime: '99.5%',
    last_deploy: '5 hours ago'
  },
  {
    id: 3,
    name: 'Development Server',
    ip_address: '192.168.1.100',
    ssh_user: 'root',
    ssh_port: 2222,
    description: 'Local development & CI testing',
    projects_count: 1,
    status: 'up',
    uptime: '98.2%',
    last_deploy: '1 day ago'
  }
];

const projects = [
  {
    id: 1, name: 'Aurelif', repo_name: 'team/aurelif-web',
    server: 'Production Server', server_id: 1, branch: 'main',
    domain_url: 'https://aurelif.com', server_path: '/var/www/aurelif',
    status: 'up', last_deploy_status: 'success', last_deploy_time: '2 hours ago',
    deploy_script: 'composer install --no-dev && php artisan migrate --force',
    ssl_expires_at: '2026-06-15', last_check_at: '2026-04-01'
  },
  {
    id: 2, name: 'Bajay Online', repo_name: 'team/bajay-online',
    server: 'Production Server', server_id: 1, branch: 'main',
    domain_url: 'https://bajayonline.com', server_path: '/var/www/bajay-online',
    status: 'up', last_deploy_status: 'success', last_deploy_time: '4 hours ago',
    deploy_script: 'composer install --no-dev && php artisan migrate --force && php artisan config:cache',
    ssl_expires_at: '2026-05-10', last_check_at: '2026-04-01'
  },
  {
    id: 3, name: 'Akshabiyah', repo_name: 'team/akshabiyah-app',
    server: 'Production Server', server_id: 1, branch: 'main',
    domain_url: 'https://akshabiyah.id', server_path: '/var/www/akshabiyah',
    status: 'up', last_deploy_status: 'success', last_deploy_time: '5 hours ago',
    deploy_script: 'composer install --no-dev && php artisan migrate --force',
    ssl_expires_at: '2026-08-22', last_check_at: '2026-04-01'
  },
  {
    id: 4, name: 'MaxRide Customer', repo_name: 'team/maxride-customer',
    server: 'Production Server', server_id: 1, branch: 'production',
    domain_url: 'https://maxride.id', server_path: '/var/www/maxride',
    status: 'up', last_deploy_status: 'success', last_deploy_time: '1 day ago',
    deploy_script: 'npm install && npm run build',
    ssl_expires_at: '2026-04-12', last_check_at: '2026-04-01'
  },
  {
    id: 5, name: 'RT Management', repo_name: 'team/rt-management',
    server: 'Production Server', server_id: 1, branch: 'main',
    domain_url: 'https://rt-app.com', server_path: '/var/www/rt-management',
    status: 'down', last_deploy_status: 'failed', last_deploy_time: '3 hours ago',
    deploy_script: 'composer install --no-dev && php artisan migrate --force',
    ssl_expires_at: '2026-04-05', last_check_at: '2026-04-01'
  },
  {
    id: 6, name: 'Mobile Guru', repo_name: 'team/mobile-guru-api',
    server: 'Staging Server', server_id: 2, branch: 'develop',
    domain_url: 'https://staging.mobileguru.id', server_path: '/var/www/mobile-guru',
    status: 'up', last_deploy_status: 'success', last_deploy_time: '6 hours ago',
    deploy_script: 'composer install && php artisan migrate',
    ssl_expires_at: '2026-09-30', last_check_at: '2026-04-01'
  },
  {
    id: 7, name: 'Landing Page', repo_name: 'team/landing-page',
    server: 'Staging Server', server_id: 2, branch: 'main',
    domain_url: 'https://staging.company.com', server_path: '/var/www/landing',
    status: 'up', last_deploy_status: 'success', last_deploy_time: '2 days ago',
    deploy_script: 'npm install && npm run build',
    ssl_expires_at: '2026-12-01', last_check_at: '2026-04-01'
  },
  {
    id: 8, name: 'Internal Tools', repo_name: 'team/internal-tools',
    server: 'Development Server', server_id: 3, branch: 'develop',
    domain_url: null, server_path: '/var/www/internal',
    status: 'unknown', last_deploy_status: 'running', last_deploy_time: 'Just now',
    deploy_script: 'docker compose up -d --build',
    ssl_expires_at: null, last_check_at: null
  }
];

const deployments = [
  { id: 1, project: 'Internal Tools', commit: 'f8e2a1c', status: 'running', time: 'Just now', branch: 'develop', trigger: 'Manual' },
  { id: 2, project: 'Aurelif', commit: 'a1b2c3d', status: 'success', time: '2 hours ago', branch: 'main', trigger: 'GitHub Push' },
  { id: 3, project: 'RT Management', commit: '7d9e4f2', status: 'failed', time: '3 hours ago', branch: 'main', trigger: 'GitHub Push' },
  { id: 4, project: 'Bajay Online', commit: '9a3f1b2', status: 'success', time: '4 hours ago', branch: 'main', trigger: 'GitHub Push' },
  { id: 5, project: 'Akshabiyah', commit: 'b3c4d5e', status: 'success', time: '5 hours ago', branch: 'main', trigger: 'GitHub Push' },
  { id: 6, project: 'Mobile Guru', commit: 'c4d5e6f', status: 'success', time: '6 hours ago', branch: 'develop', trigger: 'GitHub Push' },
  { id: 7, project: 'MaxRide Customer', commit: 'd5e6f7a', status: 'success', time: '1 day ago', branch: 'production', trigger: 'GitHub Push' },
  { id: 8, project: 'Aurelif', commit: 'e6f7a8b', status: 'success', time: '1 day ago', branch: 'main', trigger: 'Manual' },
  { id: 9, project: 'Landing Page', commit: 'f7a8b9c', status: 'success', time: '2 days ago', branch: 'main', trigger: 'GitHub Push' },
  { id: 10, project: 'RT Management', commit: 'a8b9c0d', status: 'failed', time: '2 days ago', branch: 'main', trigger: 'GitHub Push' },
];

const chartData = [
  { day: 'Mon', success: 5, failed: 1 },
  { day: 'Tue', success: 8, failed: 0 },
  { day: 'Wed', success: 3, failed: 2 },
  { day: 'Thu', success: 7, failed: 1 },
  { day: 'Fri', success: 6, failed: 0 },
  { day: 'Sat', success: 2, failed: 0 },
  { day: 'Sun', success: 4, failed: 1 },
];

// ========== HELPERS ==========
function getSSLDaysLeft(sslExpiresAt) {
  if (!sslExpiresAt) return null;
  const now = new Date('2026-04-02'); // Simulated current date
  const expiry = new Date(sslExpiresAt);
  const diff = Math.ceil((expiry - now) / (1000 * 3600 * 24));
  return diff;
}

function getSSLBadge(sslExpiresAt) {
  const days = getSSLDaysLeft(sslExpiresAt);
  if (days === null) return '<span class="badge badge-muted">No SSL</span>';
  if (days <= 0) return `<span class="badge badge-danger"><span class="badge-dot"></span>Expired</span>`;
  if (days <= 7) return `<span class="badge badge-danger"><span class="badge-dot"></span>${days} hari lagi</span>`;
  if (days <= 30) return `<span class="badge badge-warning"><span class="badge-dot"></span>${days} hari lagi</span>`;
  return `<span class="badge badge-success"><span class="badge-dot"></span>${days} hari lagi</span>`;
}

// ========== NAVIGATION ==========
let currentPage = 'dashboard';

function navigateTo(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  // Show target
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.style.display = 'block';
    target.style.animation = 'fadeIn 0.2s ease-out';
  }
  // Update sidebar
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
  const activeItem = document.querySelector(`.sidebar-item[data-page="${page}"]`);
  if (activeItem) activeItem.classList.add('active');
  // Update breadcrumb
  const names = { dashboard: 'Dashboard', servers: 'Servers', projects: 'Projects', deployments: 'Deployments', settings: 'Settings' };
  document.getElementById('breadcrumb-current').textContent = names[page] || page;
  currentPage = page;
  // Close sidebar on mobile
  if (window.innerWidth <= 1024) closeSidebar();
}

// Add fade-in animation
const styleTag = document.createElement('style');
styleTag.textContent = `@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`;
document.head.appendChild(styleTag);

// ========== RENDER FUNCTIONS ==========

function renderChart() {
  const container = document.getElementById('deployChart');
  if (!container) return;
  const maxVal = Math.max(...chartData.map(d => d.success + d.failed), 1);
  container.innerHTML = chartData.map(d => `
    <div class="chart-bar-group">
      <div class="chart-bars">
        <div class="chart-bar bar-success" style="height: ${(d.success / maxVal) * 100}%" title="${d.success} successful"></div>
        <div class="chart-bar bar-danger" style="height: ${Math.max((d.failed / maxVal) * 100, d.failed > 0 ? 4 : 0)}%" title="${d.failed} failed"></div>
      </div>
      <span class="chart-label">${d.day}</span>
    </div>
  `).join('');
}

function renderActivity() {
  const container = document.getElementById('activityList');
  if (!container) return;
  const recent = deployments.slice(0, 5);
  container.innerHTML = recent.map(d => `
    <div class="activity-item">
      <div class="activity-icon ${d.status}">
        ${d.status === 'success' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' :
          d.status === 'failed' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' :
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'}
      </div>
      <div class="activity-body">
        <div class="activity-title">
          <span class="project-name">${d.project}</span>
          <span style="color: var(--foreground-subtle)">deployed</span>
          <span class="badge ${d.status === 'success' ? 'badge-success' : d.status === 'failed' ? 'badge-danger' : 'badge-primary'}">
            <span class="badge-dot"></span>
            ${d.status}
          </span>
        </div>
        <div class="activity-meta">
          <span style="font-family: 'JetBrains Mono', monospace">${d.commit}</span>
          <span class="activity-meta-separator"></span>
          <span>${d.branch}</span>
          <span class="activity-meta-separator"></span>
          <span>${d.trigger}</span>
        </div>
      </div>
      <span class="activity-time">${d.time}</span>
    </div>
  `).join('');
}

function getStatusBadge(status) {
  const map = {
    up: 'badge-success',
    down: 'badge-danger',
    unknown: 'badge-muted',
    success: 'badge-success',
    failed: 'badge-danger',
    running: 'badge-primary'
  };
  return `<span class="badge ${map[status] || 'badge-muted'}"><span class="badge-dot"></span>${status}</span>`;
}

function renderDashboardProjects() {
  const tbody = document.getElementById('dashboardProjectsTable');
  if (!tbody) return;
  tbody.innerHTML = projects.map(p => `
    <tr>
      <td>
        <div class="table-cell-main">${p.name}</div>
        <div class="table-cell-sub">${p.domain_url || '—'}</div>
      </td>
      <td><span style="font-size: 12px; color: var(--foreground-muted)">${p.server}</span></td>
      <td><span class="table-cell-mono">${p.branch}</span></td>
      <td>${getStatusBadge(p.status)}</td>
      <td>${getSSLBadge(p.ssl_expires_at)}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${getStatusBadge(p.last_deploy_status)}
          <span style="font-size: 12px; color: var(--foreground-subtle)">${p.last_deploy_time}</span>
        </div>
      </td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn tooltip-wrapper" onclick="openModal('deployOutput')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            <span class="tooltip">View logs</span>
          </button>
          <button class="table-action-btn tooltip-wrapper" onclick="triggerProjectDeploy('${p.name}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span class="tooltip">Deploy</span>
          </button>
          <button class="table-action-btn tooltip-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            <span class="tooltip">More</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderServers() {
  const grid = document.getElementById('serversGrid');
  if (!grid) return;
  grid.innerHTML = servers.map(s => `
    <div class="server-card" onclick="navigateTo('projects')">
      <div class="server-card-top">
        <div>
          <div class="server-name">${s.name}</div>
          <div class="server-ip">${s.ip_address}:${s.ssh_port}</div>
        </div>
        ${getStatusBadge(s.status)}
      </div>
      <p style="font-size: 12px; color: var(--foreground-subtle); margin-bottom: 16px;">${s.description}</p>
      <div class="server-stats">
        <div class="server-stat-item">
          <div class="server-stat-value">${s.projects_count}</div>
          <div class="server-stat-label">Projects</div>
        </div>
        <div class="server-stat-item">
          <div class="server-stat-value">${s.uptime}</div>
          <div class="server-stat-label">Uptime</div>
        </div>
        <div class="server-stat-item">
          <div class="server-stat-value" style="font-size: 14px;">${s.last_deploy}</div>
          <div class="server-stat-label">Last Deploy</div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderProjects() {
  const tbody = document.getElementById('projectsTable');
  if (!tbody) return;
  tbody.innerHTML = projects.map(p => `
    <tr data-status="${p.status}">
      <td>
        <div class="table-cell-main">${p.name}</div>
        <div class="table-cell-sub">${p.domain_url || 'No domain'}</div>
      </td>
      <td><span class="table-cell-mono" style="font-size: 12px;">${p.repo_name}</span></td>
      <td><span style="font-size: 12px; color: var(--foreground-muted)">${p.server}</span></td>
      <td>${getStatusBadge(p.status)}</td>
      <td>${getSSLBadge(p.ssl_expires_at)}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${getStatusBadge(p.last_deploy_status)}
          <span style="font-size: 12px; color: var(--foreground-subtle)">${p.last_deploy_time}</span>
        </div>
      </td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn tooltip-wrapper" onclick="openModal('deployOutput')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            <span class="tooltip">View logs</span>
          </button>
          <button class="table-action-btn tooltip-wrapper" onclick="triggerProjectDeploy('${p.name}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span class="tooltip">Deploy</span>
          </button>
          <button class="table-action-btn tooltip-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span class="tooltip">Edit</span>
          </button>
          <button class="table-action-btn tooltip-wrapper" style="color: var(--danger)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            <span class="tooltip">Delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderDeployments() {
  const tbody = document.getElementById('deploymentsTable');
  if (!tbody) return;
  tbody.innerHTML = deployments.map(d => `
    <tr data-status="${d.status}">
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="activity-icon ${d.status}" style="width: 28px; height: 28px;">
            ${d.status === 'success' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px"><polyline points="20 6 9 17 4 12"/></svg>' :
              d.status === 'failed' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' :
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'}
          </div>
          ${getStatusBadge(d.status)}
        </div>
      </td>
      <td>
        <div class="table-cell-main">${d.project}</div>
        <div class="table-cell-sub">${d.branch}</div>
      </td>
      <td>
        <span class="table-cell-mono">${d.commit}</span>
      </td>
      <td>
        <div>
          <div style="font-size: 13px; color: var(--foreground-muted)">${d.time}</div>
          <div class="table-cell-sub">${d.trigger}</div>
        </div>
      </td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn tooltip-wrapper" onclick="openDeployOutput('${d.project}', '${d.commit}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            <span class="tooltip">View output</span>
          </button>
          ${d.status === 'failed' ? `
          <button class="table-action-btn tooltip-wrapper" onclick="triggerProjectDeploy('${d.project}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            <span class="tooltip">Retry</span>
          </button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// ========== MODALS ==========
function openModal(name) {
  const overlay = document.getElementById(`modal-${name}`);
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(name) {
  const overlay = document.getElementById(`modal-${name}`);
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function openDeployOutput(project, commit) {
  document.getElementById('outputProject').textContent = project;
  document.getElementById('outputCommit').textContent = commit;
  openModal('deployOutput');
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// Close modal on escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => {
      m.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
});

// ========== FILTERS ==========
function filterProjects(status, btn) {
  // Update button states
  btn.closest('.toolbar-left').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Filter rows
  const rows = document.querySelectorAll('#projectsTable tr');
  rows.forEach(row => {
    if (status === 'all' || row.dataset.status === status) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function filterDeploys(status, btn) {
  btn.closest('.toolbar-left').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const rows = document.querySelectorAll('#deploymentsTable tr');
  rows.forEach(row => {
    if (status === 'all' || row.dataset.status === status) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// ========== SETTINGS TABS ==========
function switchTab(tabEl, tabName) {
  tabEl.closest('.tabs').querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  document.querySelectorAll('.settings-tab').forEach(t => t.style.display = 'none');
  const target = document.getElementById(`settings-${tabName}`);
  if (target) target.style.display = 'block';
}

// ========== ACTIONS ==========
function toggleApiKeyVisibility() {
  const input = document.getElementById('settingsApiKey');
  const btn = input.nextElementSibling;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

function refreshData() {
  const btn = document.getElementById('refreshBtn');
  btn.style.animation = 'spin 0.6s ease';
  setTimeout(() => btn.style.animation = '', 600);
  showToast('success', 'Data Refreshed', 'All data has been synced successfully.');
}

function triggerDeploy() {
  showToast('success', 'Deploy Triggered', 'Deployment workflow has been initiated via n8n.');
}

function triggerProjectDeploy(name) {
  showToast('success', 'Deploy Triggered', `Deploying ${name} via n8n webhook...`);
}

// ========== TOAST ==========
function showToast(type, title, message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg class="toast-icon ${type}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success' ? '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' :
        '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
    </svg>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Spin animation for refresh
const spinStyle = document.createElement('style');
spinStyle.textContent = `@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;
document.head.appendChild(spinStyle);

// ========== SIDEBAR MOBILE ==========
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar.classList.toggle('open');
  if (backdrop) {
    backdrop.classList.toggle('active', sidebar.classList.contains('open'));
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
}

// ========== SEARCH ==========
document.getElementById('searchInput')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  if (currentPage === 'projects') {
    const rows = document.querySelectorAll('#projectsTable tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
  }
});

// Keyboard shortcut: Cmd/Ctrl+K to focus search
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('searchInput')?.focus();
  }
});

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  renderChart();
  renderActivity();
  renderDashboardProjects();
  renderServers();
  renderProjects();
  renderDeployments();
});
