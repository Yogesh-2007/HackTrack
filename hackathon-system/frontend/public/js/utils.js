/* ══════════════════════════════════════════════════
   HACKATHON SYSTEM — Shared JS Utilities
   ══════════════════════════════════════════════════ */

const API_BASE = '/api';

/* ── API Client ──────────────────────────────────── */
const api = {
  _getHeaders(isFormData = false) {
    const headers = {};
    const token = localStorage.getItem('hkt_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';
    return headers;
  },

  async get(path) {
    const res = await fetch(API_BASE + path, { headers: this._getHeaders() });
    return res.json();
  },

  async post(path, body, isFormData = false) {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: this._getHeaders(isFormData),
      body: isFormData ? body : JSON.stringify(body)
    });
    return res.json();
  },

  async put(path, body) {
    const res = await fetch(API_BASE + path, {
      method: 'PUT',
      headers: this._getHeaders(),
      body: JSON.stringify(body)
    });
    return res.json();
  },

  async delete(path) {
    const res = await fetch(API_BASE + path, { method: 'DELETE', headers: this._getHeaders() });
    return res.json();
  }
};

/* ── Toast Notifications ─────────────────────────── */
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => toast.remove(), 280);
  }, duration);
}

/* ── Loader ──────────────────────────────────────── */
function showLoader() {
  const existing = document.getElementById('global-loader');
  if (existing) return;
  const overlay = document.createElement('div');
  overlay.id = 'global-loader';
  overlay.className = 'loader-overlay';
  overlay.innerHTML = '<div class="loader"></div>';
  document.body.appendChild(overlay);
}

function hideLoader() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.remove();
}

/* ── Auth Helpers ────────────────────────────────── */
const auth = {
  setToken(token, userData) {
    localStorage.setItem('hkt_token', token);
    localStorage.setItem('hkt_user', JSON.stringify(userData));
  },
  getToken() { return localStorage.getItem('hkt_token'); },
  getUser() {
    try { return JSON.parse(localStorage.getItem('hkt_user')); }
    catch { return null; }
  },
  logout() {
    localStorage.removeItem('hkt_token');
    localStorage.removeItem('hkt_user');
  },
  isLoggedIn() { return !!this.getToken(); },
  async verify() {
    if (!this.isLoggedIn()) return null;
    const data = await api.get('/auth/me');
    if (!data.success) { this.logout(); return null; }
    return data;
  }
};

/* ── Format Helpers ──────────────────────────────── */
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(d) {
  if (!d) return '';
  const seconds = Math.floor((new Date() - new Date(d)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return formatDate(d);
}

/* ── Status Badge ────────────────────────────────── */
function statusBadge(status, checkedIn) {
  if (checkedIn) return `<span class="badge badge-checkedin badge-dot">Checked In</span>`;
  const map = {
    pending:  `<span class="badge badge-pending badge-dot">Pending</span>`,
    approved: `<span class="badge badge-approved badge-dot">Approved</span>`,
    rejected: `<span class="badge badge-rejected badge-dot">Rejected</span>`
  };
  return map[status] || status;
}

/* ── Tab Switcher ────────────────────────────────── */
function initTabs(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  const btns = container.querySelectorAll('.tab-btn');
  const panels = container.querySelectorAll('.tab-panel');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      btns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = container.querySelector(`[data-panel="${target}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // Activate first tab
  if (btns.length) btns[0].click();
}

/* ── Modal Helpers ───────────────────────────────── */
function createModal(title, content, onConfirm, confirmText = 'Confirm', confirmClass = 'btn-primary') {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">${content}</div>
      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;">
        <button class="btn btn-ghost btn-sm" id="modal-cancel-btn">Cancel</button>
        <button class="btn ${confirmClass} btn-sm" id="modal-confirm-btn">${confirmText}</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('#modal-close-btn').onclick = close;
  backdrop.querySelector('#modal-cancel-btn').onclick = close;
  backdrop.querySelector('#modal-confirm-btn').onclick = async () => {
    await onConfirm();
    close();
  };
  backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
}

/* ── Highlight active nav ────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelectorAll('.navbar-nav a');
  links.forEach(link => {
    if (link.href === window.location.href) link.classList.add('active');
  });
});
