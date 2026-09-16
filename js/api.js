const API_BASE = 'http://localhost:3000/api';

const API = {
  getToken() {
    return localStorage.getItem('token');
  },
  setToken(token) {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  },
  removeToken() {
    localStorage.removeItem('token');
  },
  async request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    const opts = {
      method,
      headers
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + url, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      if (res.status === 401 && !url.includes('/login')) {
        this.removeToken();
        if (typeof showLogin === 'function') {
          showLogin();
        }
      }
      const err = new Error((data && data.error) || 'Xatolik yuz berdi');
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  del(url) { return this.request('DELETE', url); }
};

function qs(params) {
  const clean = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!clean.length) return '';
  return '?' + clean.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

function fmtMoney(n) {
  n = Number(n) || 0;
  return n.toLocaleString('uz-UZ') + " so'm";
}

function fmtNum(n) {
  n = Number(n) || 0;
  return n.toLocaleString('uz-UZ');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
