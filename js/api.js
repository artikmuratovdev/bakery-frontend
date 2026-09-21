// const API_BASE ="https://bakery-system-q9nt.onrender.com/api";
const API_BASE ="http://localhost:5000/api";

function parseBackendError(data, res, rawText) {
  if (data) {
    if (typeof data === 'string') return data;

    // 1. data.error
    if (typeof data.error === 'string') return data.error;
    if (data.error && typeof data.error === 'object') {
      if (typeof data.error.message === 'string') return data.error.message;
      if (typeof data.error.msg === 'string') return data.error.msg;
    }

    // 2. data.message
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.message)) {
      return data.message.map(m => (typeof m === 'object' && m ? (m.msg || m.message || JSON.stringify(m)) : m)).join(', ');
    }
    if (data.message && typeof data.message === 'object') {
      return data.message.msg || data.message.message || JSON.stringify(data.message);
    }

    // 3. data.msg
    if (typeof data.msg === 'string') return data.msg;

    // 4. data.detail
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map(d => (typeof d === 'object' && d ? (d.msg || d.message || JSON.stringify(d)) : d)).join(', ');
    }

    // 5. data.errors (validation xatolari)
    if (typeof data.errors === 'string') return data.errors;
    if (Array.isArray(data.errors)) {
      return data.errors
        .map(e => (typeof e === 'object' && e ? (e.msg || e.message || e.error || JSON.stringify(e)) : String(e)))
        .join(', ');
    }
    if (typeof data.errors === 'object' && data.errors !== null) {
      return Object.entries(data.errors)
        .map(([field, val]) => {
          const valStr = Array.isArray(val) ? val.join(', ') : (typeof val === 'object' ? JSON.stringify(val) : val);
          return `${field}: ${valStr}`;
        })
        .join(', ');
    }
  }

  // Agar JSON bo'lmasa, lekin qisqa matn qaytgan bo'lsa (HTML emas)
  if (rawText && typeof rawText === 'string') {
    const trimmed = rawText.trim();
    if (trimmed && !trimmed.startsWith('<!DOCTYPE') && !trimmed.startsWith('<html') && trimmed.length < 200) {
      return trimmed;
    }
  }

  return res.statusText ? `Xatolik (${res.status}): ${res.statusText}` : 'Xatolik yuz berdi';
}

/* ===================== API & Cache Management ===================== */
const ApiCache = {
  PREFIX: 'bakery_api_cache_v1:',
  memory: new Map(),
  subscribers: new Set(),
  inFlight: new Map(),
  syncListeners: new Set(),
  syncStatus: 'idle', // 'idle' | 'syncing' | 'updated' | 'offline'
  STALE_TIME_MS: 3000, // 3 soniyadan oshsa orqa fonda revalidation qilinadi

  getKey(url) {
    return this.PREFIX + url;
  },

  get(url) {
    const key = this.getKey(url);
    // 1. Tezkor xotiradan (RAM) tekshirish
    if (this.memory.has(key)) {
      return this.memory.get(key);
    }
    // 2. localStorage'dan tekshirish
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const entry = JSON.parse(raw);
        this.memory.set(key, entry);
        return entry;
      }
    } catch (e) {
      console.warn('[ApiCache] O\'qishda xatolik:', e);
    }
    return null;
  },

  set(url, data) {
    const key = this.getKey(url);
    const serialized = JSON.stringify(data);
    const entry = {
      url,
      data,
      serialized,
      timestamp: Date.now()
    };
    this.memory.set(key, entry);
    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
      // localStorage to'lib qolsa eski kesh yozuvlarini tozalash
      this.prune();
      try {
        localStorage.setItem(key, JSON.stringify(entry));
      } catch (err) {
        console.warn('[ApiCache] Saqlashda xatolik:', err);
      }
    }
  },

  has(url) {
    return this.get(url) !== null;
  },

  hasMatch(prefix) {
    // URL prefix bo'yicha kesh bormi
    for (const [k] of this.memory) {
      if (k.startsWith(this.PREFIX) && k.includes(prefix)) return true;
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.PREFIX) && k.includes(prefix)) return true;
      }
    } catch (_) {}
    return false;
  },

  isStale(entry) {
    if (!entry || !entry.timestamp) return true;
    return Date.now() - entry.timestamp > this.STALE_TIME_MS;
  },

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  },

  notify(url, freshData, oldData) {
    this.subscribers.forEach(cb => {
      try {
        cb(url, freshData, oldData);
      } catch (e) {
        console.error('[ApiCache] Subscriber xatoligi:', e);
      }
    });
  },

  onSyncStatus(callback) {
    this.syncListeners.add(callback);
    // Joriy holatni darhol xabar qilish
    callback(this.syncStatus);
    return () => this.syncListeners.delete(callback);
  },

  setSyncStatus(status) {
    this.syncStatus = status;
    this.syncListeners.forEach(cb => {
      try {
        cb(status);
      } catch (_) {}
    });
  },

  invalidate(pattern) {
    const keysToRemove = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.PREFIX)) {
          const cleanUrl = k.slice(this.PREFIX.length);
          if (!pattern || cleanUrl.includes(pattern)) {
            keysToRemove.push(k);
          }
        }
      }
    } catch (_) {}

    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
      this.memory.delete(k);
    });

    // Memory xaritani ham tekshirish
    for (const [k] of this.memory) {
      if (k.startsWith(this.PREFIX)) {
        const cleanUrl = k.slice(this.PREFIX.length);
        if (!pattern || cleanUrl.includes(pattern)) {
          this.memory.delete(k);
        }
      }
    }
  },

  clear() {
    const keysToRemove = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (_) {}
    this.memory.clear();
    this.inFlight.clear();
  },

  prune() {
    const entries = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.PREFIX)) {
          try {
            const item = JSON.parse(localStorage.getItem(k));
            entries.push({ key: k, timestamp: item.timestamp || 0 });
          } catch (_) {
            entries.push({ key: k, timestamp: 0 });
          }
        }
      }
      entries.sort((a, b) => a.timestamp - b.timestamp);
      // Eng eski yarmisini o'chirish
      const half = Math.ceil(entries.length / 2);
      for (let i = 0; i < half; i++) {
        localStorage.removeItem(entries[i].key);
        this.memory.delete(entries[i].key);
      }
    } catch (_) {}
  }
};

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

    let res;
    try {
      res = await fetch(API_BASE + url, opts);
    } catch (networkErr) {
      const err = new Error("Server bilan aloqa o'rnatib bo'lmadi (" + (networkErr.message || 'Tarmoq xatosi') + ")");
      err.status = 0;
      throw err;
    }

    let data = null;
    let rawText = '';
    try {
      rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch (jsonErr) {
        // response is not JSON
      }
    } catch (e) {
      /* no body */
    }

    if (!res.ok) {
      if (res.status === 401 && !url.includes('/login')) {
        this.removeToken();
        if (typeof showLogin === 'function') {
          showLogin();
        }
      }
      const errorMsg = parseBackendError(data, res, rawText);
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    // Ma'lumot o'zgartiruvchi amallarda keshni yangilash / tozalash
    if (method !== 'GET') {
      this.invalidateRelatedCache(url);
    }

    return data;
  },

  invalidateRelatedCache(url) {
    if (!url) return;
    if (url.includes('/products')) {
      ApiCache.invalidate('/products');
      ApiCache.invalidate('/production/stock');
      ApiCache.invalidate('/dashboard/summary');
    } else if (url.includes('/stores')) {
      ApiCache.invalidate('/stores');
      ApiCache.invalidate('/dashboard/summary');
      ApiCache.invalidate('/payments');
    } else if (url.includes('/businesses')) {
      ApiCache.invalidate('/businesses');
      ApiCache.invalidate('/dashboard/summary');
    } else if (url.includes('/production')) {
      ApiCache.invalidate('/production');
      ApiCache.invalidate('/production/stock');
      ApiCache.invalidate('/dashboard/summary');
      ApiCache.invalidate('/reports');
    } else if (url.includes('/distribution')) {
      ApiCache.invalidate('/distribution');
      ApiCache.invalidate('/production/stock');
      ApiCache.invalidate('/dashboard/summary');
      ApiCache.invalidate('/reports');
      ApiCache.invalidate('/payments');
      ApiCache.invalidate('/stores');
    } else if (url.includes('/payments')) {
      ApiCache.invalidate('/payments');
      ApiCache.invalidate('/stores');
      ApiCache.invalidate('/dashboard/summary');
      ApiCache.invalidate('/reports');
    } else if (url.includes('/users')) {
      ApiCache.invalidate('/users');
    } else if (url.includes('/orders')) {
      ApiCache.invalidate('/orders');
    } else {
      ApiCache.invalidate(url);
    }
  },

  /**
   * Stale-While-Revalidate GET:
   * 1. Keshda eski ma'lumot bo'lsa darhol qaytaradi (0 ms).
   * 2. Orqa fonda serverdan yangi ma'lumotni yuklaydi.
   * 3. Yangi ma'lumot kelganda keshni yangilaydi va obunachilarga (UI) xabar beradi.
   * 4. Keshda yo'q bo'lsa serverdan kelgunicha kutadi (odatdagi fetch).
   */
  async get(url, options = {}) {
    const { bypassCache = false, forceRefresh = false } = options;
    const cacheEntry = (!bypassCache && !forceRefresh) ? ApiCache.get(url) : null;

    if (cacheEntry) {
      // Agar kesh eskirgan bo'lsa orqa fonda serverdan yangilab olamiz
      if (ApiCache.isStale(cacheEntry) && !ApiCache.inFlight.has(url)) {
        this.revalidateInBackground(url, cacheEntry);
      }
      return cacheEntry.data;
    }

    return this.fetchAndCache(url);
  },

  async fetchAndCache(url) {
    if (ApiCache.inFlight.has(url)) {
      return ApiCache.inFlight.get(url);
    }

    const fetchPromise = (async () => {
      try {
        ApiCache.setSyncStatus('syncing');
        const data = await this.request('GET', url);
        ApiCache.set(url, data);
        ApiCache.setSyncStatus('updated');
        return data;
      } catch (err) {
        ApiCache.setSyncStatus(navigator.onLine ? 'idle' : 'offline');
        // Tarmoq uzilgan bo'lsa, agar keshda biror eski ma'lumot qolgan bo'lsa shuni qaytaramiz
        const fallback = ApiCache.get(url);
        if (fallback) {
          return fallback.data;
        }
        throw err;
      } finally {
        ApiCache.inFlight.delete(url);
      }
    })();

    ApiCache.inFlight.set(url, fetchPromise);
    return fetchPromise;
  },

  revalidateInBackground(url, existingEntry) {
    if (ApiCache.inFlight.has(url)) return;

    const fetchPromise = (async () => {
      try {
        ApiCache.setSyncStatus('syncing');
        const freshData = await this.request('GET', url);
        const freshSerialized = JSON.stringify(freshData);

        const hasChanged = !existingEntry || existingEntry.serialized !== freshSerialized;
        ApiCache.set(url, freshData);

        if (hasChanged) {
          ApiCache.notify(url, freshData, existingEntry?.data);
        }

        ApiCache.setSyncStatus('updated');
      } catch (err) {
        // Orqa fondagi so'rov xatoligi (oflayn yoki server vaqtinchalik javob bermadi)
        ApiCache.setSyncStatus(navigator.onLine ? 'idle' : 'offline');
      } finally {
        ApiCache.inFlight.delete(url);
      }
    })();

    ApiCache.inFlight.set(url, fetchPromise);
  },

  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  patch(url, body) { return this.request('PATCH', url, body); },
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

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const mon = pad(d.getMonth() + 1);
  const yr = d.getFullYear();
  const hr = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${day}.${mon}.${yr} ${hr}:${min}`;
}

function formatTimeAgo(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return 'Hozirgina';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} daqiqa oldin`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} soat oldin`;
  const days = Math.floor(hr / 24);
  return `${days} kun oldin`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
