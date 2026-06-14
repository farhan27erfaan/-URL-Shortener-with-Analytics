// Trimm SPA App Logic

const API_BASE = window.location.origin;

// State Management
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null,
  currentView: 'auth', // 'auth', 'dashboard', 'analytics'
  isSignUpMode: false,
  links: [],
  activeAnalyticsId: null,
  activeAnalyticsData: null,
  clicksChart: null // Chart.js instance holder
};

// DOM Cache
const elements = {
  header: document.getElementById('app-header'),
  navLogo: document.getElementById('nav-logo'),
  navDashboardBtn: document.getElementById('nav-dashboard-btn'),
  userEmailText: document.getElementById('user-email-text'),
  logoutBtn: document.getElementById('logout-btn'),
  
  // Views
  authView: document.getElementById('auth-view'),
  dashboardView: document.getElementById('dashboard-view'),
  analyticsView: document.getElementById('analytics-view'),
  
  // Auth Elements
  authForm: document.getElementById('auth-form'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  authTitleText: document.getElementById('auth-title-text'),
  authSubtitleText: document.getElementById('auth-subtitle-text'),
  authSubmitBtn: document.getElementById('auth-submit-btn'),
  authToggleBtn: document.getElementById('auth-toggle-btn'),
  authToggleMsg: document.getElementById('auth-toggle-msg'),
  
  // Dashboard Elements
  shortenForm: document.getElementById('shorten-form'),
  longUrlInput: document.getElementById('long-url-input'),
  customCodeInput: document.getElementById('custom-code-input'),
  statTotalLinks: document.getElementById('stat-total-links'),
  statTotalClicks: document.getElementById('stat-total-clicks'),
  linksListTbody: document.getElementById('links-list-tbody'),
  refreshLinksBtn: document.getElementById('refresh-links-btn'),
  
  // Analytics Elements
  backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),
  analyticsShortCode: document.getElementById('analytics-short-code'),
  analyticsLongUrl: document.getElementById('analytics-long-url'),
  analyticsQrBtn: document.getElementById('analytics-qr-btn'),
  analyticsCopyBtn: document.getElementById('analytics-copy-btn'),
  clicksChartCanvas: document.getElementById('clicks-chart'),
  browserBreakdownList: document.getElementById('browser-breakdown-list'),
  deviceBreakdownList: document.getElementById('device-breakdown-list'),
  referrerBreakdownList: document.getElementById('referrer-breakdown-list'),
  recentVisitsTbody: document.getElementById('recent-visits-tbody'),
  
  // Modals
  editModal: document.getElementById('edit-modal'),
  closeEditModalBtn: document.getElementById('close-edit-modal-btn'),
  cancelEditModalBtn: document.getElementById('cancel-edit-modal-btn'),
  editAliasForm: document.getElementById('edit-alias-form'),
  editLinkId: document.getElementById('edit-link-id'),
  editAliasInput: document.getElementById('edit-alias-input'),
  
  qrModal: document.getElementById('qr-modal'),
  closeQrModalBtn: document.getElementById('close-qr-modal-btn'),
  qrCodeDisplay: document.getElementById('qr-code-display'),
  qrUrlText: document.getElementById('qr-url-text'),
  downloadQrBtn: document.getElementById('download-qr-btn'),
  
  toastContainer: document.getElementById('toast-container')
};

// --- HELPER FUNCTIONS ---

// 1. Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
  if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation"></i>';
  
  toast.innerHTML = `${icon}<span>${message}</span>`;
  elements.toastContainer.appendChild(toast);
  
  // Fade and remove toast
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

// 2. View Router/Switcher
function showView(viewName) {
  state.currentView = viewName;
  
  // Hide all views
  elements.authView.style.display = 'none';
  elements.dashboardView.style.display = 'none';
  elements.analyticsView.style.display = 'none';
  elements.header.style.display = 'none';
  
  if (viewName === 'auth') {
    elements.authView.style.display = 'block';
  } else if (viewName === 'dashboard') {
    elements.header.style.display = 'block';
    elements.dashboardView.style.display = 'grid';
    loadLinks();
  } else if (viewName === 'analytics') {
    elements.header.style.display = 'block';
    elements.analyticsView.style.display = 'block';
    loadAnalytics();
  }
}

// 3. API Request Wrapper with Auth Header
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401 || response.status === 403) {
    // Session expired or unauthorized
    logout();
    showToast('Your session has expired. Please log in again.', 'error');
    throw new Error('Unauthorized');
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  
  return data;
}

// 4. Log out function
function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showView('auth');
}

// --- CONTROLLERS ---

// Auth View Controls - use event delegation on parent to avoid rebinding
function initAuthView() {
  elements.authToggleMsg.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'auth-toggle-btn') {
      state.isSignUpMode = !state.isSignUpMode;
      updateAuthViewMode();
    }
  });
}

function updateAuthViewMode() {
  if (state.isSignUpMode) {
    elements.authTitleText.innerText = 'Create Account';
    elements.authSubtitleText.innerText = 'Start creating and tracking short URLs';
    elements.authSubmitBtn.innerHTML = '<i class="fa-solid fa-user-plus mr-2"></i>Sign Up';
    elements.authToggleMsg.innerHTML = 'Already have an account? <span id="auth-toggle-btn">Sign In</span>';
  } else {
    elements.authTitleText.innerText = 'Welcome Back';
    elements.authSubtitleText.innerText = 'Enter your details to manage your links';
    elements.authSubmitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i>Sign In';
    elements.authToggleMsg.innerHTML = "Don't have an account? <span id='auth-toggle-btn'>Sign Up</span>";
  }
}

elements.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  
  if (!email || !password) {
    showToast('Please enter both email and password.', 'error');
    return;
  }
  
  const endpoint = state.isSignUpMode ? '/api/v1/signup' : '/api/v1/login';
  
  try {
    const data = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (state.isSignUpMode) {
      showToast('Registration successful! Please log in.', 'success');
      state.isSignUpMode = false;
      updateAuthViewMode(); // Switch back to login UI
      elements.authPassword.value = '';
    } else {
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      elements.userEmailText.innerText = data.user.email;
      showToast('Logged in successfully.', 'success');
      showView('dashboard');
      
      // Clear fields
      elements.authEmail.value = '';
      elements.authPassword.value = '';
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Dashboard View Controls
elements.shortenForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const longUrl = elements.longUrlInput.value.trim();
  const customCode = elements.customCodeInput.value.trim();
  
  if (!longUrl) {
    showToast('Please enter a destination URL.', 'error');
    return;
  }
  
  try {
    const data = await apiRequest('/api/v1/links', {
      method: 'POST',
      body: JSON.stringify({ longUrl, customCode: customCode || undefined })
    });
    
    showToast('Link shortened successfully!', 'success');
    elements.longUrlInput.value = '';
    elements.customCodeInput.value = '';
    loadLinks();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function loadLinks() {
  try {
    const links = await apiRequest('/api/v1/links');
    state.links = links;
    
    // Update overview stats
    elements.statTotalLinks.innerText = links.length;
    const clickSum = links.reduce((sum, link) => sum + link.click_count, 0);
    elements.statTotalClicks.innerText = clickSum;
    
    // Populate Table
    if (links.length === 0) {
      elements.linksListTbody.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="empty-state">
              <i class="fa-solid fa-link-slash empty-icon"></i>
              <p>No links shortened yet. Paste a link above to get started!</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }
    
    elements.linksListTbody.innerHTML = links.map(link => {
      return `
        <tr>
          <td>
            <a href="${link.shortUrl}" target="_blank" class="short-url-link">
              /r/${link.short_code} <i class="fa-solid fa-up-right-from-square" style="font-size: 0.75rem;"></i>
            </a>
          </td>
          <td class="link-title-col">
            <span class="long-url-text" title="${link.long_url}">${link.long_url}</span>
          </td>
          <td style="text-align: center;">
            <span class="badge ${link.click_count > 0 ? 'badge-primary' : 'badge-secondary'}">${link.click_count}</span>
          </td>
          <td style="text-align: center;">
            <div class="actions-cell">
              <button class="btn btn-secondary btn-sm" onclick="copyLinkToClipboard('${link.shortUrl}')" title="Copy to clipboard">
                <i class="fa-solid fa-copy"></i>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="viewAnalytics('${link.id}')" title="View Analytics">
                <i class="fa-solid fa-chart-line"></i>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="openEditModal('${link.id}', '${link.short_code}')" title="Edit custom code">
                <i class="fa-solid fa-pencil"></i>
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteLink('${link.id}')" title="Delete link">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Global actions exposed on window for inline button handlers
window.copyLinkToClipboard = function(url) {
  navigator.clipboard.writeText(url)
    .then(() => showToast('Short URL copied to clipboard!', 'success'))
    .catch(() => showToast('Failed to copy. Please copy manually.', 'error'));
};

window.viewAnalytics = function(id) {
  state.activeAnalyticsId = id;
  showView('analytics');
};

window.deleteLink = async function(id) {
  if (!confirm('Are you sure you want to delete this short link? All analytics details will be lost.')) {
    return;
  }
  
  try {
    await apiRequest(`/api/v1/links/${id}`, { method: 'DELETE' });
    showToast('Link deleted successfully.', 'success');
    loadLinks();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

elements.refreshLinksBtn.addEventListener('click', loadLinks);

// Edit Alias Modal Controls
window.openEditModal = function(id, currentAlias) {
  elements.editLinkId.value = id;
  elements.editAliasInput.value = currentAlias;
  elements.editModal.style.display = 'flex';
};

function closeEditModal() {
  elements.editModal.style.display = 'none';
  elements.editAliasForm.reset();
}

elements.closeEditModalBtn.addEventListener('click', closeEditModal);
elements.cancelEditModalBtn.addEventListener('click', closeEditModal);

elements.editAliasForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = elements.editLinkId.value;
  const newAlias = elements.editAliasInput.value.trim();
  
  if (!newAlias) {
    showToast('New alias cannot be empty.', 'error');
    return;
  }
  
  try {
    await apiRequest(`/api/v1/links/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ shortCode: newAlias })
    });
    
    showToast('Alias updated successfully!', 'success');
    closeEditModal();
    loadLinks();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Analytics View Controls
async function loadAnalytics() {
  const id = state.activeAnalyticsId;
  
  try {
    const data = await apiRequest(`/api/v1/links/${id}/analytics`);
    state.activeAnalyticsData = data;
    
    const { link, analytics } = data;
    
    // Header Info
    elements.analyticsShortCode.innerText = `/r/${link.shortCode}`;
    elements.analyticsLongUrl.innerText = link.longUrl;
    elements.analyticsLongUrl.href = link.longUrl;
    elements.analyticsLongUrl.title = link.longUrl;
    
    // Clicks over time chart rendering
    renderClicksTimeline(analytics.timeline);
    
    // Breakdown lists rendering
    renderBreakdownList(elements.browserBreakdownList, analytics.browsers, 'fa-globe');
    renderBreakdownList(elements.deviceBreakdownList, analytics.devices, 'fa-mobile-screen');
    renderBreakdownList(elements.referrerBreakdownList, analytics.referrers, 'fa-compass');
    
    // Log table rendering
    if (analytics.recentVisits.length === 0) {
      elements.recentVisitsTbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center" style="color: var(--text-secondary); padding: 2rem;">
            No visits recorded yet. Share your short URL to start collecting data.
          </td>
        </tr>
      `;
    } else {
      elements.recentVisitsTbody.innerHTML = analytics.recentVisits.map(v => {
        const dateStr = new Date(v.visited_at).toLocaleString();
        return `
          <tr>
            <td>${dateStr}</td>
            <td>${escapeHTML(v.browser)}</td>
            <td>${escapeHTML(v.device)}</td>
            <td><span class="long-url-text" title="${escapeHTML(v.referrer)}">${escapeHTML(v.referrer)}</span></td>
          </tr>
        `;
      }).join('');
    }
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Chart.js Timeline Helper
function renderClicksTimeline(timeline) {
  // Destroy previous chart if it exists to prevent overlap
  if (state.clicksChart) {
    state.clicksChart.destroy();
  }
  
  // Prepare labels (past 7 days) and counts
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d.toISOString().split('T')[0]);
  }
  
  // Map counts to the last 7 days
  const counts = last7Days.map(dateStr => {
    const match = timeline.find(item => item.date === dateStr);
    return match ? match.count : 0;
  });
  
  // Format dates for chart labels (e.g. "Jun 14")
  const labels = last7Days.map(dateStr => {
    const [, month, day] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month) - 1]} ${day}`;
  });

  const ctx = elements.clicksChartCanvas.getContext('2d');
  
  // Chart Gradients
  const primaryGradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight);
  primaryGradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
  primaryGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

  state.clicksChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Clicks',
        data: counts,
        borderColor: '#6366f1',
        borderWidth: 3,
        backgroundColor: primaryGradient,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#818cf8',
        pointBorderColor: '#0b0f19',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { 
            color: '#94a3b8', 
            font: { family: 'Plus Jakarta Sans' },
            stepSize: 1,
            precision: 0
          }
        }
      }
    }
  });
}

// Horizontal breakdown items renderer
function renderBreakdownList(container, data, iconClass) {
  if (!data || data.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; font-style: italic;">No data collected yet</p>`;
    return;
  }
  
  // Calculate total across categories for percentage
  const total = data.reduce((sum, item) => sum + item.count, 0);
  
  container.innerHTML = data.map(item => {
    // Determine title
    let label = item.browser || item.device || item.referrer;
    if (label === 'Direct' || !label) label = 'Direct / Email';
    
    const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
    
    return `
      <div class="breakdown-item">
        <div class="breakdown-label-group">
          <i class="fa-solid ${iconClass}" style="color: var(--text-muted); width: 16px;"></i>
          <span>${escapeHTML(label)}</span>
        </div>
        <div class="breakdown-bar-container">
          <div class="breakdown-bar" style="width: ${percent}%;"></div>
        </div>
        <div class="breakdown-count">${item.count}</div>
      </div>
    `;
  }).join('');
}

elements.backToDashboardBtn.addEventListener('click', () => {
  state.activeAnalyticsId = null;
  state.activeAnalyticsData = null;
  showView('dashboard');
});

elements.analyticsCopyBtn.addEventListener('click', () => {
  if (state.activeAnalyticsData && state.activeAnalyticsData.link) {
    copyLinkToClipboard(state.activeAnalyticsData.link.shortUrl);
  }
});

// QR Code Modal Setup
elements.analyticsQrBtn.addEventListener('click', () => {
  if (!state.activeAnalyticsData) return;
  const shortUrl = state.activeAnalyticsData.link.shortUrl;
  
  // Generate QR code via api.qrserver.com
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(shortUrl)}`;
  elements.qrCodeDisplay.innerHTML = `<img src="${qrUrl}" alt="Short URL QR Code" style="display: block; width: 100%; border-radius: 8px;">`;
  elements.qrUrlText.innerText = shortUrl;
  elements.qrModal.style.display = 'flex';
});

function closeQrModal() {
  elements.qrModal.style.display = 'none';
  elements.qrCodeDisplay.innerHTML = '';
}

elements.closeQrModalBtn.addEventListener('click', closeQrModal);

elements.downloadQrBtn.addEventListener('click', async () => {
  if (!state.activeAnalyticsData) return;
  const shortUrl = state.activeAnalyticsData.link.shortUrl;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(shortUrl)}`;
  
  try {
    const res = await fetch(qrUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `qr_${state.activeAnalyticsData.link.shortCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    showToast('QR Code download started.', 'success');
  } catch (err) {
    showToast('Could not download QR Code directly. Please right click the image to save.', 'error');
  }
});

// HTML Escaper to avoid XSS in dynamically injected analytics values
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Navigation logo/dashboard return
elements.navLogo.addEventListener('click', () => {
  if (state.token) {
    showView('dashboard');
  }
});

elements.navDashboardBtn.addEventListener('click', () => {
  showView('dashboard');
});

elements.logoutBtn.addEventListener('click', logout);

// --- INITIALIZE APPLICATION ---
function init() {
  initAuthView();
  
  if (state.token && state.user) {
    elements.userEmailText.innerText = state.user.email;
    showView('dashboard');
  } else {
    showView('auth');
  }
}

// Boot
init();
