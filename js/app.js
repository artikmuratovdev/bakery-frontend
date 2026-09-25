/* ===================== Global State ===================== */
const state = {
  user: null,
  businesses: [],
  currentBusinessId: null, // super_admin: null = "all", or specific business ID
  route: '#/dashboard'
};

/* ===================== Toast Notification ===================== */
function toast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' toast-' + type : '');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    setTimeout(() => el.remove(), 250);
  }, 4000);
}

/* ===================== Theme Switcher ===================== */
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeToggleLabel(saved);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeToggleLabel(next);
}

function updateThemeToggleLabel(theme) {
  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  if (icon) icon.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  if (label) label.textContent = theme === 'dark' ? "Kunduzgi rejim" : "Tungi rejim";
}

/* ===================== Mobile Drawer ===================== */
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar && overlay) {
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('active', isOpen);
  }
}

/* ===================== Auth / Bootstrap ===================== */
let revalidateTimer = null;
function initCacheSubscriber() {
  ApiCache.subscribe((changedUrl) => {
    if (!state.user) return;
    if (revalidateTimer) clearTimeout(revalidateTimer);
    revalidateTimer = setTimeout(() => {
      // Faqat foydalanuvchi tizimda bo'lsa va joriy sahifaga daxldor bo'lsa yangilaymiz
      render(true);
    }, 100);
  });
}

function initSyncIndicator() {
  const el = document.getElementById('sync-status');
  if (!el) return;

  let hideTimer = null;

  ApiCache.onSyncStatus((status) => {
    if (hideTimer) clearTimeout(hideTimer);

    if (!navigator.onLine || status === 'offline') {
      el.className = 'sync-status-pill offline';
      el.innerHTML = '<i class="fa-solid fa-cloud-slash"></i><span class="sync-text">Oflayn rejim</span>';
      el.title = "Internet bilan aloqa yo'q. Oxirgi keshdagi ma'lumotlar ko'rsatilmoqda.";
      el.classList.remove('hidden');
      return;
    }

    if (status === 'syncing') {
      el.className = 'sync-status-pill syncing';
      el.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i><span class="sync-text">Yangilanmoqda...</span>';
      el.title = "Serverdan so'nggi ma'lumotlar tekshirilmoqda...";
      el.classList.remove('hidden');
      return;
    }

    if (status === 'updated') {
      el.className = 'sync-status-pill updated';
      el.innerHTML = '<i class="fa-solid fa-circle-check"></i><span class="sync-text">Yangilandi</span>';
      el.title = "Ma'lumotlar muvaffaqiyatli yangilandi.";
      el.classList.remove('hidden');

      hideTimer = setTimeout(() => {
        el.classList.add('hidden');
      }, 2500);
      return;
    }

    // idle
    el.classList.add('hidden');
  });

  el.addEventListener('click', () => {
    if (state.user) {
      render(true);
      toast("Ma'lumotlar qayta yuklanmoqda...", 'info');
    }
  });
}

function hasCachedDataForRoute(route) {
  const [, view, param] = (route || '#/dashboard').split('/');
  const bizId = state.user?.role === 'super_admin' ? state.currentBusinessId : state.user?.business_id;

  if (view === 'dashboard' || !view) {
    if (state.user?.role === 'store') {
      return ApiCache.has(`/stores/${state.user.store_id}/history`);
    }
    return ApiCache.has('/dashboard/summary' + qs({ business_id: bizId }));
  }
  if (view === 'businesses') return ApiCache.has('/businesses');
  if (view === 'products') return ApiCache.has('/products' + qs({ business_id: bizId }));
  if (view === 'stores') {
    if (param) return ApiCache.has(`/stores/${param}/history`);
    return ApiCache.has('/stores' + qs({ business_id: bizId }));
  }
  if (view === 'production') return ApiCache.hasMatch('/production');
  if (view === 'orders') return ApiCache.hasMatch('/orders');
  if (view === 'delivery') return ApiCache.hasMatch('/deliveries');
  if (view === 'drivers') return ApiCache.hasMatch('/delivery-assignments') || ApiCache.hasMatch('/users');
  if (view === 'distribution') return ApiCache.hasMatch('/distribution');
  if (view === 'payments') return ApiCache.hasMatch('/payments') || ApiCache.hasMatch('/stores');
  if (view === 'reports') return ApiCache.hasMatch('/reports');
  return false;
}

async function boot() {
  initTheme();
  initSyncIndicator();
  initCacheSubscriber();

  // Tarmoq holati hodisalari
  window.addEventListener('online', () => {
    toast("Internet aloqasi tiklandi. Ma'lumotlar yangilanmoqda...", 'success');
    if (state.user) {
      render(true);
    }
  });

  window.addEventListener('offline', () => {
    toast("Internet bilan aloqa uzildi. Keshdagi ma'lumotlar ko'rsatiladi.", 'warning');
    ApiCache.setSyncStatus('offline');
  });

  // Login event
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', onLogin);

  // Password visibility toggle
  const pwdToggle = document.getElementById('password-toggle');
  if (pwdToggle) {
    pwdToggle.addEventListener('click', () => {
      const pwdInput = document.getElementById('login-password');
      if (pwdInput) {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
        pwdToggle.innerHTML = isPwd ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
      }
    });
  }

  // Logout & Theme
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', onLogout);

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Responsive Drawer events
  const burger = document.getElementById('sidebar-burger');
  if (burger) burger.addEventListener('click', toggleSidebar);

  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Hash route change
  window.addEventListener('hashchange', () => {
    state.route = location.hash || '#/dashboard';
    render();
  });

  // Check existing session
  try {
    if (!API.getToken()) {
      showLogin();
      return;
    }
    const data = await API.get('/auth/me');
    state.user = data?.user || data;
    await afterLogin();
  } catch (e) {
    API.removeToken();
    showLogin();
  }
}

function showLogin() {
  const loginScr = document.getElementById('login-screen');
  const appShell = document.getElementById('app-shell');
  if (loginScr) loginScr.classList.remove('hidden');
  if (appShell) {
    appShell.classList.add('hidden');
    appShell.style.display = 'none';
  }
}

async function onLogin(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('login-submit-btn');

  // Agar request allaqachon ketayotgan bo'lsa, takroriy yuborishni oldini olamiz
  if (submitBtn && submitBtn.disabled) return;

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  
  if (errEl) errEl.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Kirilmoqda...';
  }

  try {
    const data = await API.post('/auth/login', { username, password });
    const token = data?.token || data?.accessToken || data?.data?.token || data?.data?.accessToken;
    if (token) {
      API.setToken(token);
    }
    state.user = data?.user || data?.data?.user || data;
    await afterLogin();
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || 'Login yoki parol noto‘g‘ri';
      errEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Kirish';
    }
  }
}

async function onLogout() {
  try {
    await API.post('/auth/logout');
  } catch (e) { /* ignore */ }
  cleanupNotificationCenter();
  if (typeof stopDeliveryPolling === 'function') stopDeliveryPolling();
  API.removeToken();
  ApiCache.clear();
  state.user = null;
  location.hash = '#/dashboard';
  closeSidebar();
  showLogin();
}

async function afterLogin() {
  const loginScr = document.getElementById('login-screen');
  const appShell = document.getElementById('app-shell');
  if (loginScr) loginScr.classList.add('hidden');
  if (appShell) {
    appShell.classList.remove('hidden');
    appShell.style.display = '';
  }

  const roleName = roleLabel(state.user.role);
  const displayName = state.user.full_name || state.user.username || 'Foydalanuvchi';

  const userChip = document.getElementById('user-chip');
  if (userChip) {
    userChip.textContent = `${displayName} · ${roleName}`;
  }

  // Sidebar foydalanuvchi ma'lumotlarini yangilash
  const userNameEl = document.getElementById('sidebar-user-name');
  const userRoleEl = document.getElementById('sidebar-user-role');
  const userAvatarEl = document.getElementById('sidebar-user-avatar');
  if (userNameEl) userNameEl.textContent = displayName;
  if (userRoleEl) userRoleEl.textContent = roleName;
  if (userAvatarEl) {
    const initials = displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
    userAvatarEl.textContent = initials || displayName.slice(0, 2).toUpperCase() || 'U';
  }

  if (state.user.role === 'super_admin') {
    const bRes = await API.get('/businesses?limit=100');
    state.businesses = Array.isArray(bRes) ? bRes : (bRes?.data || []);
  } else {
    state.currentBusinessId = state.user.business_id;
  }

  initNotificationCenter();
  renderBusinessSwitcher();
  renderNav();
  state.route = location.hash && location.hash !== '#/' ? location.hash : '#/dashboard';
  render();
}

function isDeliveryUser() {
  return state.user?.role === 'delivery' || state.user?.role === 'dostavkachi';
}

function roleLabel(role) {
  return {
    super_admin: 'Super Admin',
    bakery_admin: 'Nonvoyxona Admini',
    store: "Do‘kon",
    delivery: "Dostavkachi",
    dostavkachi: "Dostavkachi"
  }[role] || role;
}

function renderBusinessSwitcher() {
  const el = document.getElementById('business-switcher');
  if (!el) return;
  if (state.user.role !== 'super_admin') {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `<select id="biz-select" aria-label="Nonvoyxonani tanlang">
      <option value="">Barcha nonvoyxonalar</option>
      ${state.businesses.map(b => `<option value="${b.id}" ${state.currentBusinessId == b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
    </select>`;
  const select = document.getElementById('biz-select');
  if (select) {
    select.addEventListener('change', (e) => {
      state.currentBusinessId = e.target.value || null;
      render();
    });
  }
}

/* ===================== Navigation Structure ===================== */
const NAV_ITEMS = {
  super_admin: [
    { group: 'Umumiy', items: [
      { href: '#/dashboard', label: 'Boshqaruv paneli', icon: '<i class="fa-solid fa-chart-pie"></i>' },
    ]},
    { group: 'Boshqaruv', items: [
      { href: '#/businesses', label: 'Nonvoyxonalar', icon: '<i class="fa-solid fa-industry"></i>' },
      { href: '#/products', label: 'Mahsulotlar', icon: '<i class="fa-solid fa-bread-slice"></i>' },
      { href: '#/stores', label: "Do‘konlar", icon: '<i class="fa-solid fa-store"></i>' },
      { href: '#/drivers', label: 'Haydovchilar', icon: '<i class="fa-solid fa-id-card"></i>' },
    ]},
    { group: 'Amaliyot', items: [
      { href: '#/orders', label: 'Do‘kon zakazlari', icon: '<i class="fa-solid fa-clipboard-check"></i>' },
      { href: '#/production', label: 'Ishlab chiqarish', icon: '<i class="fa-solid fa-kitchen-set"></i>' },
      { href: '#/distribution', label: 'Taqsimlash', icon: '<i class="fa-solid fa-truck-fast"></i>' },
      { href: '#/payments', label: 'Naqd / Nasiya', icon: '<i class="fa-solid fa-wallet"></i>' },
    ]},
    { group: 'Hisobotlar', items: [
      { href: '#/reports/daily', label: 'Kunlik hisobot', icon: '<i class="fa-solid fa-calendar-day"></i>' },
      { href: '#/reports/overall', label: 'Umumiy hisobot', icon: '<i class="fa-solid fa-chart-line"></i>' },
    ]},
  ],
  bakery_admin: [
    { group: 'Umumiy', items: [
      { href: '#/dashboard', label: 'Boshqaruv paneli', icon: '<i class="fa-solid fa-chart-pie"></i>' }
    ]},
    { group: 'Boshqaruv', items: [
      { href: '#/drivers', label: 'Haydovchilar', icon: '<i class="fa-solid fa-id-card"></i>' }
    ]},
    { group: 'Amaliyot', items: [
      { href: '#/production', label: 'Ishlab chiqarish', icon: '<i class="fa-solid fa-kitchen-set"></i>' },
    ]},
    { group: 'Hisobotlar', items: [
      { href: '#/reports/daily', label: 'Kunlik hisobot', icon: '<i class="fa-solid fa-calendar-day"></i>' },
      { href: '#/reports/overall', label: 'Umumiy hisobot', icon: '<i class="fa-solid fa-chart-line"></i>' },
    ]},
  ],
  store: [
    { group: 'Umumiy', items: [
      { href: '#/dashboard', label: 'Mening do‘konim', icon: '<i class="fa-solid fa-store"></i>' },
      { href: '#/orders', label: 'Zakazlar', icon: '<i class="fa-solid fa-cart-shopping"></i>' },
    ]},
  ],
  delivery: [
    { group: 'Yetkazib berish', items: [
      { href: '#/dashboard', label: 'Tasdiqlangan zakazlar', icon: '<i class="fa-solid fa-truck-fast"></i>' },
      { href: '#/delivery/history', label: 'Yetkazilganlar', icon: '<i class="fa-solid fa-clock-rotate-left"></i>' }
    ]}
  ],
  dostavkachi: [
    { group: 'Yetkazib berish', items: [
      { href: '#/dashboard', label: 'Tasdiqlangan zakazlar', icon: '<i class="fa-solid fa-truck-fast"></i>' },
      { href: '#/delivery/history', label: 'Yetkazilganlar', icon: '<i class="fa-solid fa-clock-rotate-left"></i>' }
    ]}
  ]
};

function renderNav() {
  const groups = NAV_ITEMS[state.user.role] || [];
  const el = document.getElementById('nav-links');
  if (!el) return;
  el.innerHTML = groups.map(g => `
    <div class="nav-section-label">${g.group}</div>
    ${g.items.map(i => `<div class="nav-link" data-href="${i.href}"><span class="icon">${i.icon}</span><span>${i.label}</span></div>`).join('')}
  `).join('');

  el.querySelectorAll('.nav-link').forEach(n => {
    n.addEventListener('click', () => {
      location.hash = n.dataset.href;
      closeSidebar();
    });
  });
}

function setActiveNav() {
  const base = '#/' + (state.route.split('/')[1] || 'dashboard');
  document.querySelectorAll('.nav-link').forEach(n => {
    n.classList.toggle('active', n.dataset.href === base || n.dataset.href === state.route);
  });
}

/* ===================== Router ===================== */
async function render(isRevalidating = false) {
  setActiveNav();
  const content = document.getElementById('content');
  if (!content) return;

  // Agar kesh mavjud bo'lsa yoki orqa fonda yangilanish bo'lsa, yuklanish spinnere ko'rsatilmaydi
  const hasCache = hasCachedDataForRoute(state.route);
  if (!isRevalidating && !hasCache) {
    content.innerHTML = `<div style="padding: 40px 0; text-align: center; color: var(--color-text-muted);">
      <div style="font-size: 28px; margin-bottom: 12px; color: var(--color-primary);"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
      <div>Ma'lumotlar yuklanmoqda...</div>
    </div>`;
  }

  const [, view, param] = state.route.split('/');

  if (view !== 'dashboard' && view !== 'delivery') {
    if (typeof stopDeliveryPolling === 'function') stopDeliveryPolling();
  }

  // Ruxsatlar (Role guards)
  if (isDeliveryUser()) {
    if (view !== 'dashboard' && view !== 'delivery') {
      location.hash = '#/dashboard';
      return;
    }
  } else {
    if (view === 'delivery') {
      location.hash = '#/dashboard';
      return;
    }
  }

  if (state.user?.role === 'bakery_admin' && (view === 'products' || view === 'stores' || view === 'distribution' || view === 'payments' || view === 'orders')) {
    location.hash = '#/dashboard';
    return;
  }

  if (view === 'drivers' && state.user?.role !== 'super_admin' && state.user?.role !== 'bakery_admin') {
    location.hash = '#/dashboard';
    return;
  }

  const titleMap = {
    dashboard: isDeliveryUser() ? 'Yetkazib berish paneli' : 'Boshqaruv paneli',
    delivery: 'Yetkazilgan zakazlar',
    drivers: 'Haydovchilar boshqaruvi',
    businesses: 'Nonvoyxonalar',
    products: 'Mahsulotlar',
    stores: "Do‘konlar",
    orders: state.user?.role === 'store' ? 'Mening zakazlarim' : 'Do‘kon zakazlari',
    production: 'Ishlab chiqarish',
    distribution: 'Taqsimlash',
    payments: 'Naqd / Nasiya hisob-kitobi',
    reports: 'Hisobotlar'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titleMap[view] || 'Boshqaruv paneli';

  try {
    if (view === 'dashboard' || !view) await renderDashboard(content);
    else if (view === 'delivery' && param === 'history') await renderDeliveryDashboard(content, 'history');
    else if (view === 'delivery') await renderDeliveryDashboard(content, 'active');
    else if (view === 'drivers') await renderDrivers(content);
    else if (view === 'businesses') await renderBusinesses(content);
    else if (view === 'products') await renderProducts(content);
    else if (view === 'stores' && !param) await renderStores(content);
    else if (view === 'stores' && param) await renderStoreDetail(content, param);
    else if (view === 'orders') await renderOrders(content);
    else if (view === 'production') await renderProduction(content);
    else if (view === 'distribution') await renderDistribution(content);
    else if (view === 'payments') await renderPayments(content);
    else if (view === 'reports' && param === 'daily') await renderDailyReport(content);
    else if (view === 'reports' && param === 'overall') await renderOverallReport(content);
    else content.innerHTML = `<div class="card card-body">Bunday sahifa topilmadi.</div>`;
  } catch (e) {
    if (!isRevalidating) {
      content.innerHTML = `<div class="alert alert-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(e.message || 'Xatolik yuz berdi')}</div>`;
    } else {
      console.warn('[Revalidate] Sahifani yangilashda xatolik:', e);
    }
  }
}

/* ===================== Notification Center (faqat super_admin) ===================== */
let notifPollTimer = null;
let currentNotifications = [];

function initNotificationCenter() {
  const wrapper = document.getElementById('notif-wrapper');
  if (!wrapper) return;

  // Faqat super_admin uchun ko'rsatiladi
  if (state.user?.role !== 'super_admin') {
    cleanupNotificationCenter();
    return;
  }

  wrapper.classList.remove('hidden');

  const bellBtn = document.getElementById('notif-bell-btn');
  const dropdown = document.getElementById('notif-dropdown');
  const markAllBtn = document.getElementById('notif-mark-all-btn');
  const viewAllLink = document.getElementById('notif-view-all');

  if (bellBtn && dropdown) {
    bellBtn.onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    };

    if (!document._notifClickListener) {
      document._notifClickListener = (e) => {
        const dd = document.getElementById('notif-dropdown');
        const wrp = document.getElementById('notif-wrapper');
        if (dd && wrp && !wrp.contains(e.target)) {
          dd.classList.add('hidden');
        }
      };
      document.addEventListener('click', document._notifClickListener);
    }
  }

  if (markAllBtn) {
    markAllBtn.onclick = async (e) => {
      e.stopPropagation();
      await markAllNotificationsAsRead();
    };
  }

  if (viewAllLink) {
    viewAllLink.onclick = () => {
      if (dropdown) dropdown.classList.add('hidden');
    };
  }

  fetchNotifications();
  startNotificationPolling();
}

function cleanupNotificationCenter() {
  stopNotificationPolling();
  const wrapper = document.getElementById('notif-wrapper');
  if (wrapper) wrapper.classList.add('hidden');
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
  currentNotifications = [];
}

function startNotificationPolling() {
  stopNotificationPolling();
  // 25 soniyada bir marta polling orqali yangilab turish (WebSocket bo'lmaganda)
  notifPollTimer = setInterval(() => {
    if (state.user?.role === 'super_admin') {
      fetchNotifications(true);
    } else {
      cleanupNotificationCenter();
    }
  }, 25000);
}

function stopNotificationPolling() {
  if (notifPollTimer) {
    clearInterval(notifPollTimer);
    notifPollTimer = null;
  }
}

async function fetchNotifications(isPoll = false) {
  if (state.user?.role !== 'super_admin') return;
  try {
    const list = await API.get('/orders/notifications?unread=true&limit=100', { bypassCache: true });
    currentNotifications = Array.isArray(list) ? list : (list?.notifications || list?.data || []);
    renderNotificationsUI();
  } catch (err) {
    if (!isPoll) {
      console.warn('[Notifications] Yuklashda xatolik:', err);
    }
  }
}

function renderNotificationsUI() {
  const badge = document.getElementById('notif-badge');
  const listEl = document.getElementById('notif-list');
  if (!badge || !listEl) return;

  const unreadCount = currentNotifications.length;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  if (unreadCount === 0) {
    listEl.innerHTML = `
      <div class="notif-empty">
        <i class="fa-solid fa-circle-check" style="font-size:24px; color:var(--color-green); margin-bottom:6px; display:block;"></i>
        Yangi zakazlar yo'q
      </div>`;
    return;
  }

  listEl.innerHTML = currentNotifications.map(n => {
    const storeName = n.store_name || n.store?.name || n.order?.store?.name || 'Do‘kon';
    const timeStr = formatTimeAgo(n.created_at || n.createdAt);
    const orderId = n.order_id || n.orderId || n.order?.id;
    const summary = n.message || n.text || (n.order?.items ? `${n.order.items.length} xil mahsulot` : 'Yangi do‘kon zakazi');

    return `
      <div class="notif-item unread" data-id="${n.id}" data-order-id="${orderId || ''}">
        <div class="notif-item-title">
          <span><i class="fa-solid fa-cart-shopping" style="color:var(--color-primary); margin-right:6px;"></i>Yangi do‘kon zakazi</span>
          ${orderId ? `<span class="badge badge-accent">#${orderId}</span>` : ''}
        </div>
        <div style="font-weight:600; font-size:12.5px; color:var(--color-text);">${escapeHtml(storeName)}</div>
        <div class="notif-item-desc">${escapeHtml(summary)}</div>
        <div class="notif-item-time"><i class="fa-regular fa-clock"></i> ${timeStr}</div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.notif-item').forEach(item => {
    item.onclick = async () => {
      const notifId = item.dataset.id;
      const orderId = item.dataset.orderId;
      const dropdown = document.getElementById('notif-dropdown');
      if (dropdown) dropdown.classList.add('hidden');

      try {
        await API.patch(`/orders/notifications/${notifId}/read`);
      } catch (e) {
        console.warn('[Notification read err]', e);
      }

      currentNotifications = currentNotifications.filter(x => String(x.id) !== String(notifId));
      renderNotificationsUI();

      if (orderId) {
        if (location.hash === '#/orders') {
          if (typeof openOrderDetailsById === 'function') {
            openOrderDetailsById(orderId);
          }
        } else {
          location.hash = '#/orders';
          setTimeout(() => {
            if (typeof openOrderDetailsById === 'function') {
              openOrderDetailsById(orderId);
            }
          }, 350);
        }
      } else {
        location.hash = '#/orders';
      }
    };
  });
}

async function markAllNotificationsAsRead() {
  if (!currentNotifications.length) return;
  const unread = [...currentNotifications];
  currentNotifications = [];
  renderNotificationsUI();

  for (const n of unread) {
    try {
      await API.patch(`/orders/notifications/${n.id}/read`);
    } catch (e) { /* ignore */ }
  }
  toast("Barcha bildirishnomalar o'qildi", 'success');
}

/* ===================== Global Numeric Input Sanitizer ===================== */
// Barcha raqamli inputlarda oldidan 0 yozilib qolishini (masalan: 03000 -> 3000) bartaraf etish
document.addEventListener('input', (e) => {
  const target = e.target;
  if (!target || target.tagName !== 'INPUT') return;
  
  const isNumeric = target.type === 'number' || 
                    target.inputMode === 'numeric' || 
                    target.classList.contains('delivery-cash-input') ||
                    target.classList.contains('delivery-credit-input') ||
                    target.classList.contains('delivery-qty-input') ||
                    target.id === 'f-cash' || target.id === 'f-credit' || target.id === 'f-qty' || target.id === 'f-price' || target.id === 'f-amount';

  if (isNumeric && typeof target.value === 'string') {
    // Agar "03000" yoki "007" kabi boshida ortiqcha 0 bo'lsa (lekin "0." emas)
    if (/^0[0-9]+/.test(target.value)) {
      target.value = target.value.replace(/^0+/, '');
      if (target.value === '') target.value = '0';
    }
  }
}, true);

document.addEventListener('focusin', (e) => {
  const target = e.target;
  if (!target || target.tagName !== 'INPUT') return;
  
  if (target.type === 'number' || target.inputMode === 'numeric') {
    if (target.value === '0') {
      target.select();
    }
  }
});

document.addEventListener('DOMContentLoaded', boot);
