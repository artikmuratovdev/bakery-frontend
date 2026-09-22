/* ===================== Modal helper ===================== */
function openModal(title, bodyHtml, onMount) {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">
    <div class="modal-header"><h3>${title}</h3><button class="modal-close" type="button" aria-label="Yopish"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body">${bodyHtml}</div>
  </div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector('.modal-close').onclick = () => backdrop.remove();
  let isBackdropMouseDown = false;
  backdrop.addEventListener('mousedown', (e) => {
    isBackdropMouseDown = (e.target === backdrop);
  });
  backdrop.addEventListener('click', (e) => {
    if (isBackdropMouseDown && e.target === backdrop) {
      backdrop.remove();
    }
    isBackdropMouseDown = false;
  });
  if (onMount) onMount(backdrop);
  return backdrop;
}
function closeModal() { document.querySelectorAll('.modal-backdrop').forEach(m => m.remove()); }

function confirmAction(msg, onYes) {
  openModal('Tasdiqlash', `
    <p style="margin-bottom:18px;">${escapeHtml(msg)}</p>
    <div class="form-actions">
      <button class="btn btn-secondary" id="confirm-no">Bekor qilish</button>
      <button class="btn btn-danger" id="confirm-yes">Ha, davom etish</button>
    </div>
  `, (m) => {
    m.querySelector('#confirm-no').onclick = () => m.remove();
    m.querySelector('#confirm-yes').onclick = async () => { m.remove(); await onYes(); };
  });
}

function bizSelectHtml(id, selected) {
  const list = Array.isArray(state.businesses) ? state.businesses : [];
  return `<select id="${id}">
    ${list.map(b => `<option value="${b.id}" ${String(b.id) === String(selected) ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
  </select>`;
}

/* ===================== Pagination helpers ===================== */
function extractListData(res, defaultPage = 1, defaultLimit = 10) {
  if (Array.isArray(res)) {
    return {
      items: res,
      data: res,
      pagination: {
        page: defaultPage,
        limit: defaultLimit,
        total: res.length,
        totalPages: Math.max(1, Math.ceil(res.length / defaultLimit))
      }
    };
  }
  const items = Array.isArray(res?.data)
    ? res.data
    : (Array.isArray(res?.orders) ? res.orders : []);
  const p = res?.pagination || {};
  const total = Number(p.total ?? items.length) || 0;
  const page = Number(p.page ?? defaultPage) || defaultPage;
  const limit = Number(p.limit ?? defaultLimit) || defaultLimit;
  const totalPages = Number(p.totalPages ?? Math.max(1, Math.ceil(total / limit))) || 1;

  return {
    items,
    data: items,
    pagination: { page, limit, total, totalPages }
  };
}

function renderPaginationHtml(pagination, prefix = 'pg') {
  if (!pagination) return '';
  const page = pagination.page || 1;
  const totalPages = Math.max(1, pagination.totalPages || 1);
  const total = pagination.total || 0;
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return `
    <div class="pagination-bar" id="${prefix}-bar">
      <div class="pagination-info">
        Jami: <strong>${fmtNum(total)}</strong> ta &bull; Sahifa <strong>${page}</strong> / <strong>${totalPages}</strong>
      </div>
      <div class="pagination-controls">
        <button type="button" class="pagination-btn pagination-prev-btn" id="${prefix}-prev-btn" ${isFirst ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left"></i> Oldingi
        </button>
        <span class="pagination-page-indicator">
          ${page} / ${totalPages}
        </span>
        <button type="button" class="pagination-btn pagination-next-btn" id="${prefix}-next-btn" ${isLast ? 'disabled' : ''}>
          Keyingi <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>
  `;
}

function bindPaginationEvents(container, pagination, onPageChange, prefix = 'pg') {
  if (!container || !pagination) return;
  const prevBtn = container.querySelector(`#${prefix}-prev-btn`);
  const nextBtn = container.querySelector(`#${prefix}-next-btn`);
  const page = pagination.page || 1;
  const totalPages = Math.max(1, pagination.totalPages || 1);

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (page > 1) onPageChange(page - 1);
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (page < totalPages) onPageChange(page + 1);
    };
  }
}

function effectiveBizId() {
  return state.user.role === 'super_admin' ? state.currentBusinessId : state.user.business_id;
}

/* ===================== DASHBOARD ===================== */
async function renderDashboard(content) {
  if (state.user.role === 'store') return renderStoreDashboard(content);
  if (isDeliveryUser()) return renderDeliveryDashboard(content, 'active');

  const bizId = effectiveBizId();
  const summary = await API.get('/dashboard/summary' + qs({ business_id: bizId }));
  const isBakeryAdmin = state.user.role === 'bakery_admin';

  if (isBakeryAdmin) {
    content.innerHTML = `
      <div class="section-head">
        <h2>Umumiy ko'rinish</h2>
        <p>Nonvoyxona bo'yicha ma'lumotlar</p>
      </div>

      <div class="grid grid-2" style="margin-bottom:20px;">
        ${statCard('<i class="fa-solid fa-kitchen-set"></i>', 'Bugun tayyorlangan', fmtNum(summary.todayProduced) + ' dona', '', 'green')}
        ${statCard('<i class="fa-solid fa-boxes-stacked"></i>', 'Nonvoyxonada qoldi', fmtNum(summary.remaining) + ' dona', 'Jami: ishlab chiqarilgan − tarqatilgan', '')}
      </div>

      <div class="card">
        <div class="card-header"><h3>Mahsulotlar bo'yicha balans</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Mahsulot</th><th class="text-right">Tayyorlangan</th><th class="text-right">Berilgan</th><th class="text-right">Qoldi</th></tr></thead>
          <tbody>
            ${summary.byProduct.length ? summary.byProduct.map(p => `
              <tr><td>${escapeHtml(p.name)}</td>
                <td class="text-right num">${fmtNum(p.produced)}</td>
                <td class="text-right num">${fmtNum(p.distributed)}</td>
                <td class="text-right num">${fmtNum(p.produced - p.distributed)}</td></tr>
            `).join('') : `<tr class="empty-row"><td colspan="4">Ma'lumot yo'q</td></tr>`}
          </tbody>
        </table></div>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <div class="section-head">
      <h2>Umumiy ko'rinish</h2>
      <p>${bizId ? "Tanlangan nonvoyxona bo'yicha statistika" : "Barcha nonvoyxonalar bo'yicha umumiy statistika"}</p>
    </div>

    <div class="grid grid-4" style="margin-bottom:20px;">
      ${statCard('<i class="fa-solid fa-industry"></i>', 'Jami nonvoyxonalar', fmtNum(summary.businessCount), '', '')}
      ${statCard('<i class="fa-solid fa-store"></i>', "Jami do'konlar", fmtNum(summary.storeCount), '', 'blue')}
      ${statCard('<i class="fa-solid fa-kitchen-set"></i>', 'Bugun tayyorlangan', fmtNum(summary.todayProduced) + ' dona', '', 'green')}
      ${statCard('<i class="fa-solid fa-truck-fast"></i>', 'Bugun berilgan', fmtNum(summary.todayDistributed) + ' dona', '', 'blue')}
    </div>

    <div class="grid grid-4" style="margin-bottom:20px;">
      ${statCard('<i class="fa-solid fa-boxes-stacked"></i>', 'Nonvoyxonada qoldi', fmtNum(summary.remaining) + ' dona', 'Jami: ishlab chiqarilgan − tarqatilgan', '')}
      ${statCard('<i class="fa-solid fa-money-bill-wave"></i>', 'Jami naqd tushum', fmtMoney(summary.totalCash), '', 'green')}
      ${statCard('<i class="fa-solid fa-receipt"></i>', 'Jami nasiya', fmtMoney(summary.totalCredit), '', 'blue')}
      ${statCard('<i class="fa-solid fa-triangle-exclamation"></i>', 'Jami qarzdorlik', fmtMoney(summary.totalDebt), '', 'red')}
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><h3>Mahsulotlar bo'yicha balans</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Mahsulot</th><th class="text-right">Tayyorlangan</th><th class="text-right">Berilgan</th><th class="text-right">Qoldi</th></tr></thead>
          <tbody>
            ${summary.byProduct.length ? summary.byProduct.map(p => `
              <tr><td>${escapeHtml(p.name)}</td>
                <td class="text-right num">${fmtNum(p.produced)}</td>
                <td class="text-right num">${fmtNum(p.distributed)}</td>
                <td class="text-right num">${fmtNum(p.produced - p.distributed)}</td></tr>
            `).join('') : `<tr class="empty-row"><td colspan="4">Ma'lumot yo'q</td></tr>`}
          </tbody>
        </table></div>
      </div>

      <div class="card">
        <div class="card-header"><h3>${bizId ? 'Nonvoyxona' : 'Nonvoyxonalar'} bo'yicha statistika</h3></div>
        ${bizId ? `<div class="card-body"><p class="muted">Umumiy ko'rinish uchun yuqoridagi "Barcha nonvoyxonalar" ni tanlang.</p></div>` : `
        <div class="table-wrap"><table>
          <thead><tr><th>Nonvoyxona</th><th class="text-right">Tayyorlangan</th><th class="text-right">Berilgan</th><th class="text-right">Naqd</th><th class="text-right">Nasiya</th></tr></thead>
          <tbody>
            ${summary.byBusiness.map(b => `
              <tr><td>${escapeHtml(b.name)}</td>
                <td class="text-right num">${fmtNum(b.produced)}</td>
                <td class="text-right num">${fmtNum(b.distributed)}</td>
                <td class="text-right num">${fmtMoney(b.cash)}</td>
                <td class="text-right num">${fmtMoney(b.credit)}</td></tr>
            `).join('')}
          </tbody>
        </table></div>`}
      </div>
    </div>
  `;
}

const ICON_MAP = {
  '🏭': '<i class="fa-solid fa-industry"></i>',
  '🏪': '<i class="fa-solid fa-store"></i>',
  '🧑‍🍳': '<i class="fa-solid fa-kitchen-set"></i>',
  '🚚': '<i class="fa-solid fa-truck-fast"></i>',
  '📦': '<i class="fa-solid fa-boxes-stacked"></i>',
  '💵': '<i class="fa-solid fa-money-bill-wave"></i>',
  '🧾': '<i class="fa-solid fa-receipt"></i>',
  '📋': '<i class="fa-solid fa-clipboard-list"></i>',
  '⚠️': '<i class="fa-solid fa-triangle-exclamation"></i>',
  '✅': '<i class="fa-solid fa-circle-check"></i>',
  '💰': '<i class="fa-solid fa-wallet"></i>',
  '📊': '<i class="fa-solid fa-chart-pie"></i>',
  '🍞': '<i class="fa-solid fa-bread-slice"></i>',
  '👤': '<i class="fa-solid fa-users"></i>',
  '📅': '<i class="fa-solid fa-calendar-day"></i>',
  '📈': '<i class="fa-solid fa-chart-line"></i>',
  '✏️': '<i class="fa-solid fa-pen-to-square"></i>',
  '🗑️': '<i class="fa-solid fa-trash-can"></i>',
  '👁️': '<i class="fa-solid fa-eye"></i>',
  'ℹ️': '<i class="fa-solid fa-circle-info"></i>',
  '🌾': '<img src="icons/logo.png" alt="Bek Logo" class="inline-logo-icon" />'
};

function renderIcon(icon) {
  if (!icon) return '';
  return ICON_MAP[icon] || icon;
}

function statCard(icon, label, value, sub, colorClass) {
  return `<div class="card stat-card ${colorClass || ''}">
    <div class="stat-card-top">
      <span class="stat-label">${label}</span>
      <div class="stat-icon ${colorClass || ''}">${renderIcon(icon)}</div>
    </div>
    <div class="stat-value">${value}</div>
    ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
  </div>`;
}

async function renderStoreDashboard(content) {
  const [data, ordersRes] = await Promise.all([
    API.get(`/stores/${state.user.store_id}/history`),
    API.get('/orders').catch(() => [])
  ]);
  const orders = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.orders || ordersRes?.data || []);
  const recentOrders = orders.slice(0, 5);

  content.innerHTML = `
    <div class="section-head" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
      <div>
        <h2>${escapeHtml(data.store.name)}</h2>
        <p>${escapeHtml(data.store.address || '')} ${data.store.phone ? '· ' + escapeHtml(data.store.phone) : ''}</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" id="store-new-order-top-btn">
          <i class="fa-solid fa-plus"></i> Yangi zakaz
        </button>
        <a href="#/orders" class="btn btn-secondary">
          <i class="fa-solid fa-cart-shopping"></i> Zakazlar tarixi
        </a>
      </div>
    </div>
    <div class="grid grid-4" style="margin-bottom:20px;">
      ${statCard('<i class="fa-solid fa-receipt"></i>', 'Jami sotuv', fmtMoney(data.summary.total_sales), '', '')}
      ${statCard('<i class="fa-solid fa-money-bill-wave"></i>', 'Naqd', fmtMoney(data.summary.total_cash), '', 'green')}
      ${statCard('<i class="fa-solid fa-clipboard-list"></i>', 'Nasiya', fmtMoney(data.summary.total_credit), '', 'blue')}
      ${statCard('<i class="fa-solid fa-triangle-exclamation"></i>', 'Qolgan qarz', fmtMoney(data.summary.remaining_debt), '', 'red')}
    </div>

    <!-- Zakazlar bo'limi -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3><i class="fa-solid fa-cart-shopping" style="color:var(--color-primary); margin-right:8px;"></i>Zakazlar</h3>
        <button class="btn btn-primary btn-sm" id="store-dash-add-order-btn">
          <i class="fa-solid fa-plus"></i> Yangi zakaz
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:60px;">#</th>
              <th>Sana</th>
              <th>Mahsulotlar</th>
              <th>Izoh</th>
              <th>Status</th>
              <th style="width:80px; text-align:right;"></th>
            </tr>
          </thead>
          <tbody>
            ${recentOrders.length ? recentOrders.map(o => `
              <tr>
                <td><strong>#${o.id}</strong></td>
                <td class="muted" style="white-space:nowrap;">${formatDateTime(o.created_at || o.createdAt)}</td>
                <td>${formatOrderItemsSummary(o.items || o.order_items || o.OrderItems || [])}</td>
                <td class="muted" style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(o.note || '—')}</td>
                <td>${orderStatusBadge(o.status)}</td>
                <td style="text-align:right;">
                  <button class="btn btn-secondary btn-sm" data-order-view="${o.id}">Ko'rish</button>
                </td>
              </tr>
            `).join('') : `
              <tr class="empty-row">
                <td colspan="6" style="text-align:center; padding:24px;">
                  Hozircha zakazlar berilmagan.
                  <button class="btn btn-primary btn-sm" id="store-dash-empty-order-btn" style="margin-left:8px;">+ Yangi zakaz berish</button>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><h3>Olingan mahsulotlar tarixi</h3></div>
      ${renderDistTable(data.distributions, false)}
    </div>
    <div class="card">
      <div class="card-header"><h3>To'lovlar tarixi</h3></div>
      ${renderPaymentsTable(data.payments, false)}
    </div>
  `;

  const openNewOrder = () => orderCreateModal(() => renderStoreDashboard(content));
  const btn1 = content.querySelector('#store-new-order-top-btn');
  const btn2 = content.querySelector('#store-dash-add-order-btn');
  const btn3 = content.querySelector('#store-dash-empty-order-btn');
  if (btn1) btn1.onclick = openNewOrder;
  if (btn2) btn2.onclick = openNewOrder;
  if (btn3) btn3.onclick = openNewOrder;

  content.querySelectorAll('[data-order-view]').forEach(b => {
    b.onclick = () => {
      const ord = orders.find(x => String(x.id) === String(b.dataset.orderView));
      if (ord) orderDetailModal(ord, () => renderStoreDashboard(content));
    };
  });
}

function renderDistTable(rows, showStore = true) {
  return `<div class="table-wrap"><table>
    <thead><tr>
      <th>Sana</th>${showStore ? '<th>Do\'kon</th>' : ''}<th>Mahsulot</th>
      <th class="text-right">Soni</th><th class="text-right">Summa</th>
      <th class="text-right">Naqd</th><th class="text-right">Nasiya</th>
    </tr></thead>
    <tbody>
      ${rows.length ? rows.map(r => `
        <tr><td>${fmtDate(r.date)}</td>${showStore ? `<td>${escapeHtml(r.store_name)}</td>` : ''}<td>${escapeHtml(r.product_name)}</td>
          <td class="text-right num">${fmtNum(r.quantity)}</td>
          <td class="text-right num">${fmtMoney(r.total_amount)}</td>
          <td class="text-right num">${fmtMoney(r.cash_amount)}</td>
          <td class="text-right num">${fmtMoney(r.credit_amount)}</td></tr>
      `).join('') : `<tr class="empty-row"><td colspan="7">Ma'lumot yo'q</td></tr>`}
    </tbody>
  </table></div>`;
}

function renderPaymentsTable(rows) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Sana</th><th>Izoh</th><th class="text-right">Summa</th></tr></thead>
    <tbody>
      ${rows.length ? rows.map(r => `
        <tr><td>${fmtDate(r.date)}</td><td class="muted">${escapeHtml(r.note || '—')}</td><td class="text-right num">${fmtMoney(r.amount)}</td></tr>
      `).join('') : `<tr class="empty-row"><td colspan="3">Ma'lumot yo'q</td></tr>`}
    </tbody>
  </table></div>`;
}

/* ===================== BUSINESSES ===================== */
async function renderBusinesses(content) {
  if (state.user.role !== 'super_admin') {
    content.innerHTML = `<div class="alert alert-warning">Bu sahifaga faqat Super Admin kira oladi.</div>`;
    return;
  }

  let page = 1;
  const limit = 10;

  async function loadData() {
    try {
      const res = await API.get(`/businesses?page=${page}&limit=${limit}`);
      const { items: list, pagination } = extractListData(res, page, limit);

      content.innerHTML = `
        <div class="section-head">
          <h2>Nonvoyxonalar</h2>
          <p>Barcha bizneslarni shu yerdan boshqaring</p>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>Ro'yxat (${fmtNum(pagination.total)})</h3>
            <button class="btn btn-primary btn-sm" id="add-biz-btn">+ Yangi nonvoyxona</button>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>Nomi</th><th>Manzil</th><th>Telefon</th><th>Holati</th><th></th></tr></thead>
            <tbody>
              ${list.map(b => `
                <tr>
                  <td><strong>${escapeHtml(b.name)}</strong></td>
                  <td class="muted">${escapeHtml(b.address || '—')}</td>
                  <td class="muted">${escapeHtml(b.phone || '—')}</td>
                  <td>${b.active ? '<span class="badge badge-green">Faol</span>' : '<span class="badge badge-red">Nofaol</span>'}</td>
                  <td><div class="row-actions">
                    <button class="icon-btn" data-edit="${b.id}" title="Tahrirlash"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="icon-btn" data-del="${b.id}" title="O'chirish"><i class="fa-solid fa-trash-can"></i></button>
                  </div></td>
                </tr>
              `).join('') || `<tr class="empty-row"><td colspan="5">Nonvoyxona qo'shilmagan</td></tr>`}
            </tbody>
          </table></div>
          ${renderPaginationHtml(pagination, 'biz-pg')}
        </div>
      `;

      bindPaginationEvents(content, pagination, (newPage) => {
        page = newPage;
        loadData();
      }, 'biz-pg');

      content.querySelector('#add-biz-btn').onclick = () => bizFormModal();
      content.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
        const biz = list.find(x => x.id == b.dataset.edit);
        bizFormModal(biz);
      });
      content.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        confirmAction("Bu nonvoyxonani o'chirmoqchimisiz? Unga tegishli barcha ma'lumotlar (do'konlar, mahsulotlar, tarix) o'chib ketadi.", async () => {
          await API.del('/businesses/' + b.dataset.del);
          toast("Nonvoyxona o'chirildi", 'success');
          const bRes = await API.get('/businesses?limit=100');
          state.businesses = Array.isArray(bRes) ? bRes : (bRes?.data || []);
          render();
        });
      });
    } catch (err) {
      content.innerHTML = `
        <div class="alert alert-warning" style="margin-top:20px;">
          <i class="fa-solid fa-triangle-exclamation"></i> Nonvoyxonalarni yuklashda xatolik: ${escapeHtml(err.message || 'Server xatosi')}
        </div>
      `;
    }
  }

  await loadData();
}

function bizFormModal(biz) {
  const isNew = !biz;
  openModal(biz ? 'Nonvoyxonani tahrirlash' : 'Yangi nonvoyxona', `
    <form id="biz-form">
      <div class="form-grid">
        ${isNew ? `<div class="form-section-title"><i class="fa-solid fa-industry"></i> Nonvoyxona ma'lumotlari</div>` : ''}
        <div class="field span-2"><label>Nonvoyxona nomi *</label><input required id="f-name" value="${escapeHtml(biz?.name || '')}" placeholder="Masalan: Nonvoyxona №3" /></div>
        <div class="field span-2"><label>Manzil (ixtiyoriy)</label><input id="f-address" value="${escapeHtml(biz?.address || '')}" placeholder="Masalan: Chilonzor tumani, 5-mavze" /></div>
        <div class="field span-2"><label>Telefon (ixtiyoriy)</label><input type="tel" pattern="[0-9+\\-\\s()]{7,20}" id="f-phone" value="${escapeHtml(biz?.phone || '')}" placeholder="+998 90 123 45 67" title="Telefon raqami (masalan: +998 90 123 45 67)" /></div>
        ${!isNew ? `
          <div class="field span-2">
            <label>Holati (Status)</label>
            <select id="f-biz-active">
              <option value="1" ${biz.active !== false && biz.active !== 0 ? 'selected' : ''}>Faol</option>
              <option value="0" ${biz.active === false || biz.active === 0 ? 'selected' : ''}>Nofaol</option>
            </select>
          </div>
        ` : ''}

        ${isNew ? `
          <div class="form-section-title"><i class="fa-solid fa-user-shield"></i> Nonvoyxona admini ma'lumotlari</div>
          <div class="field span-2">
            <label>Admin login *</label>
            <input required id="f-username" pattern="[A-Za-z0-9_.-]{3,30}" placeholder="Masalan: nonvoy3" title="Login 3-30 ta harf, raqam, nuqta yoki pastki chiziqdan iborat bo'lishi kerak" autocomplete="off" />
          </div>
          <div class="field span-2">
            <label>Admin parol *</label>
            <div class="password-input-wrap">
              <input required type="password" id="f-password" minlength="6" placeholder="Kamida 6 ta belgi" title="Parol kamida 6 ta belgidan iborat bo'lishi kerak" autocomplete="new-password" />
              <button type="button" class="password-toggle-btn" id="biz-pwd-toggle" title="Parolni ko'rsatish/yashirish" tabindex="-1">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="cancel-btn">Bekor qilish</button>
        <button type="submit" class="btn btn-primary" id="save-biz-btn">${biz ? 'Saqlash' : "Qo'shish"}</button>
      </div>
    </form>
  `, (m) => {
    const pwdToggle = m.querySelector('#biz-pwd-toggle');
    if (pwdToggle) {
      pwdToggle.onclick = () => {
        const input = m.querySelector('#f-password');
        if (!input) return;
        const isPwd = input.type === 'password';
        input.type = isPwd ? 'text' : 'password';
        pwdToggle.innerHTML = isPwd ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
      };
    }

    m.querySelector('#cancel-btn').onclick = () => m.remove();
    m.querySelector('#biz-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = m.querySelector('#save-biz-btn');
      const nameVal = m.querySelector('#f-name').value.trim();
      const addressVal = m.querySelector('#f-address').value.trim();
      const phoneVal = m.querySelector('#f-phone').value.trim();

      if (!nameVal) {
        toast("Nonvoyxona nomini kiriting", 'error');
        return;
      }

      const body = {
        name: nameVal,
        address: addressVal,
        phone: phoneVal
      };

      if (!isNew) {
        const activeSel = m.querySelector('#f-biz-active');
        if (activeSel) body.active = Number(activeSel.value);
      }

      if (isNew) {
        const usernameVal = m.querySelector('#f-username').value.trim();
        const pwdInput = m.querySelector('#f-password');
        const passwordVal = pwdInput ? pwdInput.value : '';

        if (!usernameVal) {
          toast("Admin loginini kiriting", 'error');
          return;
        }
        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(usernameVal)) {
          toast("Login faqat harf, raqam va _ . - belgilaridan (3-30 ta) iborat bo'lishi kerak", 'error');
          return;
        }
        if (!passwordVal || passwordVal.length < 6) {
          toast("Parol kamida 6 belgidan iborat bo'lishi kerak", 'error');
          return;
        }

        body.username = usernameVal;
        body.password = passwordVal;
      }

      const originalBtnHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...`;

      try {
        if (biz) {
          await API.put('/businesses/' + biz.id, body);
          toast('Nonvoyxona yangilandi', 'success');
        } else {
          await API.post('/businesses', body);
          toast("Nonvoyxona va admin muvaffaqiyatli yaratildi", 'success');
        }
        if (body.password) body.password = '';
        const pwdField = m.querySelector('#f-password');
        if (pwdField) pwdField.value = '';

        m.remove();
        const bRes = await API.get('/businesses?limit=100');
        state.businesses = Array.isArray(bRes) ? bRes : (bRes?.data || []);
        renderBusinessSwitcher();
        render();
      } catch (err) {
        if (body.password) body.password = '';
        toast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    };
  });
}

/* ===================== PRODUCTS ===================== */
async function renderProducts(content) {
  const bizId = effectiveBizId();
  const bizName = (id) => (Array.isArray(state.businesses) ? state.businesses : []).find(b => b.id == id)?.name || '';

  let page = 1;
  const limit = 10;

  async function loadData() {
    try {
      const res = await API.get('/products' + qs({ business_id: bizId, page, limit }));
      const { items: list, pagination } = extractListData(res, page, limit);

      content.innerHTML = `
        <div class="section-head">
          <h2>Mahsulot turlari</h2>
          <p>Nonning narxi va turlarini shu yerda boshqaring</p>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>Ro'yxat (${fmtNum(pagination.total)})</h3>
            <button class="btn btn-primary btn-sm" id="add-product-btn">+ Yangi mahsulot</button>
          </div>
          <div class="table-wrap"><table>
            <thead><tr>${!bizId ? '<th>Nonvoyxona</th>' : ''}<th>Nomi</th><th class="text-right">Narxi</th><th>Holati</th><th></th></tr></thead>
            <tbody>
              ${list.map(p => `
                <tr>
                  ${!bizId ? `<td class="muted">${escapeHtml(bizName(p.business_id))}</td>` : ''}
                  <td><strong>${escapeHtml(p.name)}</strong></td>
                  <td class="text-right num">${fmtMoney(p.price)}</td>
                  <td>${p.active ? '<span class="badge badge-green">Faol</span>' : '<span class="badge badge-red">Nofaol</span>'}</td>
                  <td><div class="row-actions">
                    <button class="icon-btn" data-edit="${p.id}" title="Tahrirlash"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="icon-btn" data-del="${p.id}" title="O'chirish"><i class="fa-solid fa-trash-can"></i></button>
                  </div></td>
                </tr>
              `).join('') || `<tr class="empty-row"><td colspan="5">Mahsulot qo'shilmagan</td></tr>`}
            </tbody>
          </table></div>
          ${renderPaginationHtml(pagination, 'prod-pg')}
        </div>
      `;

      bindPaginationEvents(content, pagination, (newPage) => {
        page = newPage;
        loadData();
      }, 'prod-pg');

      content.querySelector('#add-product-btn').onclick = () => productFormModal(null, bizId);
      content.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => productFormModal(list.find(x => x.id == b.dataset.edit)));
      content.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        confirmAction("Bu mahsulot turini o'chirmoqchimisiz?", async () => {
          try {
            await API.del('/products/' + b.dataset.del);
            toast("O'chirildi", 'success');
            render();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      content.innerHTML = `
        <div class="alert alert-warning" style="margin-top:20px;">
          <i class="fa-solid fa-triangle-exclamation"></i> Mahsulotlarni yuklashda xatolik: ${escapeHtml(err.message || 'Server xatosi')}
        </div>
      `;
    }
  }

  await loadData();
}

function productFormModal(product, defaultBizId) {
  const needsBizSelect = state.user.role === 'super_admin';
  openModal(product ? "Mahsulotni tahrirlash" : "Yangi mahsulot turi", `
    <form id="product-form">
      <div class="form-grid">
        ${needsBizSelect ? `<div class="field span-2"><label>Nonvoyxona</label>${bizSelectHtml('f-biz', product?.business_id || defaultBizId || state.businesses[0]?.id)}</div>` : ''}
        <div class="field span-2"><label>Mahsulot nomi</label><input required id="f-name" value="${escapeHtml(product?.name || '')}" placeholder="Masalan: 8000 so'mlik non" /></div>
        <div class="field span-2"><label>Narxi (so'm)</label><input required type="number" min="0" step="100" id="f-price" value="${product?.price ?? ''}" placeholder="Masalan: 8000" /></div>
        ${product ? `
          <div class="field span-2">
            <label>Holati (Status)</label>
            <select id="f-prod-active">
              <option value="1" ${product.active !== false && product.active !== 0 ? 'selected' : ''}>Faol</option>
              <option value="0" ${product.active === false || product.active === 0 ? 'selected' : ''}>Nofaol</option>
            </select>
          </div>
        ` : ''}
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="cancel-btn">Bekor qilish</button>
        <button type="submit" class="btn btn-primary">${product ? 'Saqlash' : "Qo'shish"}</button>
      </div>
    </form>
  `, (m) => {
    m.querySelector('#cancel-btn').onclick = () => m.remove();
    m.querySelector('#product-form').onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        name: document.getElementById('f-name').value.trim(),
        price: Number(document.getElementById('f-price').value)
      };
      if (product) {
        const activeSel = document.getElementById('f-prod-active');
        if (activeSel) body.active = Number(activeSel.value);
      }
      if (needsBizSelect && !product) body.business_id = document.getElementById('f-biz').value;
      try {
        if (product) await API.put('/products/' + product.id, body);
        else await API.post('/products', body);
        toast(product ? 'Yangilandi' : "Qo'shildi", 'success');
        m.remove();
        render();
      } catch (err) { toast(err.message, 'error'); }
    };
  });
}

/* ===================== STORES ===================== */
async function renderStores(content) {
  const bizId = effectiveBizId();
  const bizName = (id) => (Array.isArray(state.businesses) ? state.businesses : []).find(b => b.id == id)?.name || '';
  const canManage = state.user.role === 'super_admin' || state.user.role === 'bakery_admin';

  let page = 1;
  const limit = 10;

  async function loadData() {
    try {
      const res = await API.get('/stores' + qs({ business_id: bizId, page, limit }));
      const { items: list, pagination } = extractListData(res, page, limit);

      content.innerHTML = `
        <div class="section-head">
          <h2>Do'konlar</h2>
          <p>Nonvoyxonaga biriktirilgan barcha do'konlar</p>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>Ro'yxat (${fmtNum(pagination.total)})</h3>
            ${canManage ? `<button class="btn btn-primary btn-sm" id="add-store-btn">+ Yangi do'kon</button>` : ''}
          </div>
          <div class="table-wrap"><table>
            <thead><tr>${!bizId ? '<th>Nonvoyxona</th>' : ''}<th>Nomi</th><th>Manzil</th><th>Telefon</th><th>Holati</th><th></th></tr></thead>
            <tbody>
              ${list.map(s => `
                <tr>
                  ${!bizId ? `<td class="muted">${escapeHtml(bizName(s.business_id))}</td>` : ''}
                  <td><a href="#/stores/${s.id}" style="color:var(--accent);font-weight:600;text-decoration:none;">${escapeHtml(s.name)}</a></td>
                  <td class="muted">${escapeHtml(s.address || '—')}</td>
                  <td class="muted">${escapeHtml(s.phone || '—')}</td>
                  <td>${s.active ? '<span class="badge badge-green">Faol</span>' : '<span class="badge badge-red">Nofaol</span>'}</td>
                  <td><div class="row-actions">
                    <button class="icon-btn" data-view="${s.id}" title="Ko'rish"><i class="fa-solid fa-eye"></i></button>
                    ${canManage ? `
                      <button class="icon-btn" data-edit="${s.id}" title="Tahrirlash"><i class="fa-solid fa-pen-to-square"></i></button>
                      <button class="icon-btn" data-del="${s.id}" title="O'chirish"><i class="fa-solid fa-trash-can"></i></button>
                    ` : ''}
                  </div></td>
                </tr>
              `).join('') || `<tr class="empty-row"><td colspan="${!bizId ? 6 : 5}">Do'kon qo'shilmagan</td></tr>`}
            </tbody>
          </table></div>
          ${renderPaginationHtml(pagination, 'store-pg')}
        </div>
      `;

      bindPaginationEvents(content, pagination, (newPage) => {
        page = newPage;
        loadData();
      }, 'store-pg');

      const addStoreBtn = content.querySelector('#add-store-btn');
      if (addStoreBtn) addStoreBtn.onclick = () => storeFormModal(null, bizId);
      content.querySelectorAll('[data-view]').forEach(b => b.onclick = () => location.hash = '#/stores/' + b.dataset.view);
      if (canManage) {
        content.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => storeFormModal(list.find(x => x.id == b.dataset.edit)));
        content.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
          confirmAction("Bu do'konni o'chirmoqchimisiz?", async () => {
            try { await API.del('/stores/' + b.dataset.del); toast("O'chirildi", 'success'); render(); }
            catch (err) { toast(err.message, 'error'); }
          });
        });
      }
    } catch (err) {
      content.innerHTML = `
        <div class="alert alert-warning" style="margin-top:20px;">
          <i class="fa-solid fa-triangle-exclamation"></i> Do'konlarni yuklashda xatolik: ${escapeHtml(err.message || 'Server xatosi')}
        </div>
      `;
    }
  }

  await loadData();
}

function storeFormModal(store, defaultBizId) {
  const isNew = !store;
  const isSuperAdmin = state.user.role === 'super_admin';

  openModal(store ? "Do'konni tahrirlash" : "Yangi do'kon", `
    <form id="store-form">
      <div class="form-grid">
        ${isNew ? `<div class="form-section-title"><i class="fa-solid fa-store"></i> Do'kon ma'lumotlari</div>` : ''}
        ${isNew && isSuperAdmin ? `<div class="field span-2"><label>Nonvoyxona *</label>${bizSelectHtml('f-biz', defaultBizId || state.businesses[0]?.id)}</div>` : ''}
        <div class="field span-2"><label>Do'kon nomi *</label><input required id="f-name" value="${escapeHtml(store?.name || '')}" placeholder="Masalan: Do'kon №1 (Markaz)" /></div>
        <div class="field span-2"><label>Manzil (ixtiyoriy)</label><input id="f-address" value="${escapeHtml(store?.address || '')}" placeholder="Masalan: Amir Temur ko'chasi, 12" /></div>
        <div class="field span-2"><label>Telefon (ixtiyoriy)</label><input type="tel" pattern="[0-9+\\-\\s()]{7,20}" id="f-phone" value="${escapeHtml(store?.phone || '')}" placeholder="+998 90 123 45 67" title="Telefon raqami (masalan: +998 90 123 45 67)" /></div>
        ${!isNew ? `
          <div class="field span-2">
            <label>Holati (Status)</label>
            <select id="f-store-active">
              <option value="1" ${store.active !== false && store.active !== 0 ? 'selected' : ''}>Faol</option>
              <option value="0" ${store.active === false || store.active === 0 ? 'selected' : ''}>Nofaol</option>
            </select>
          </div>
        ` : ''}

        ${isNew ? `
          <div class="form-section-title"><i class="fa-solid fa-user-tag"></i> Do'kon admini ma'lumotlari</div>
          <div class="field span-2">
            <label>Do'kon admini login *</label>
            <input required id="f-username" pattern="[A-Za-z0-9_.-]{3,30}" placeholder="Masalan: dokon3" title="Login 3-30 ta harf, raqam, nuqta yoki pastki chiziqdan iborat bo'lishi kerak" autocomplete="off" />
          </div>
          <div class="field span-2">
            <label>Do'kon admini parol *</label>
            <div class="password-input-wrap">
              <input required type="password" id="f-password" minlength="6" placeholder="Kamida 6 ta belgi" title="Parol kamida 6 ta belgidan iborat bo'lishi kerak" autocomplete="new-password" />
              <button type="button" class="password-toggle-btn" id="store-pwd-toggle" title="Parolni ko'rsatish/yashirish" tabindex="-1">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="cancel-btn">Bekor qilish</button>
        <button type="submit" class="btn btn-primary" id="save-store-btn">${store ? 'Saqlash' : "Qo'shish"}</button>
      </div>
    </form>
  `, (m) => {
    const pwdToggle = m.querySelector('#store-pwd-toggle');
    if (pwdToggle) {
      pwdToggle.onclick = () => {
        const input = m.querySelector('#f-password');
        if (!input) return;
        const isPwd = input.type === 'password';
        input.type = isPwd ? 'text' : 'password';
        pwdToggle.innerHTML = isPwd ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
      };
    }

    m.querySelector('#cancel-btn').onclick = () => m.remove();
    m.querySelector('#store-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = m.querySelector('#save-store-btn');
      const nameVal = m.querySelector('#f-name').value.trim();
      const addressVal = m.querySelector('#f-address').value.trim();
      const phoneVal = m.querySelector('#f-phone').value.trim();

      if (!nameVal) {
        toast("Do'kon nomini kiriting", 'error');
        return;
      }

      const body = {
        name: nameVal,
        address: addressVal,
        phone: phoneVal
      };

      if (!isNew) {
        const activeSel = m.querySelector('#f-store-active');
        if (activeSel) body.active = Number(activeSel.value);
        if (store.business_id) body.business_id = Number(store.business_id);
      }

      if (isNew) {
        if (isSuperAdmin) {
          const bizEl = m.querySelector('#f-biz');
          const bizIdVal = bizEl ? bizEl.value : defaultBizId;
          if (!bizIdVal) {
            toast("Nonvoyxonani tanlang", 'error');
            return;
          }
          body.business_id = Number(bizIdVal) || bizIdVal;
        }

        const usernameVal = m.querySelector('#f-username').value.trim();
        const pwdInput = m.querySelector('#f-password');
        const passwordVal = pwdInput ? pwdInput.value : '';

        if (!usernameVal) {
          toast("Do'kon admini loginini kiriting", 'error');
          return;
        }
        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(usernameVal)) {
          toast("Login faqat harf, raqam va _ . - belgilaridan (3-30 ta) iborat bo'lishi kerak", 'error');
          return;
        }
        if (!passwordVal || passwordVal.length < 6) {
          toast("Parol kamida 6 belgidan iborat bo'lishi kerak", 'error');
          return;
        }

        body.username = usernameVal;
        body.password = passwordVal;
      }

      const originalBtnHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...`;

      try {
        if (store) {
          await API.put('/stores/' + store.id, body);
          toast("Do'kon yangilandi", 'success');
        } else {
          await API.post('/stores', body);
          toast("Do'kon va admin muvaffaqiyatli yaratildi", 'success');
        }
        if (body.password) body.password = '';
        const pwdField = m.querySelector('#f-password');
        if (pwdField) pwdField.value = '';

        m.remove();
        render();
      } catch (err) {
        if (body.password) body.password = '';
        toast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    };
  });
}

async function renderStoreDetail(content, id) {
  const data = await API.get(`/stores/${id}/history`);
  const canManage = state.user.role === 'super_admin' || state.user.role === 'bakery_admin';
  content.innerHTML = `
    <button class="btn btn-ghost btn-sm" id="back-btn" style="margin-bottom:14px;"><i class="fa-solid fa-arrow-left"></i> Orqaga</button>
    <div class="section-head">
      <h2>${escapeHtml(data.store.name)}</h2>
      <p>${escapeHtml(data.store.address || '')} ${data.store.phone ? '· ' + escapeHtml(data.store.phone) : ''}</p>
    </div>
    <div class="grid grid-4" style="margin-bottom:20px;">
      ${statCard('<i class="fa-solid fa-receipt"></i>', 'Jami sotuv', fmtMoney(data.summary.total_sales), '', '')}
      ${statCard('<i class="fa-solid fa-money-bill-wave"></i>', 'Naqd', fmtMoney(data.summary.total_cash), '', 'green')}
      ${statCard('<i class="fa-solid fa-clipboard-list"></i>', 'Nasiya berilgan', fmtMoney(data.summary.total_credit), '', 'blue')}
      ${statCard('<i class="fa-solid fa-triangle-exclamation"></i>', 'Qolgan qarz', fmtMoney(data.summary.remaining_debt), '', 'red')}
    </div>
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <h3>Mahsulot olish tarixi</h3>
      </div>
      ${renderDistTable(data.distributions, false)}
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Qarz to'lovlari tarixi</h3>
        ${canManage ? `<button class="btn btn-primary btn-sm" id="add-payment-btn">+ Qarz to'lash</button>` : ''}
      </div>
      ${renderPaymentsTable(data.payments)}
    </div>
  `;
  content.querySelector('#back-btn').onclick = () => location.hash = '#/stores';
  const payBtn = content.querySelector('#add-payment-btn');
  if (payBtn) payBtn.onclick = () => paymentFormModal(data.store, data.summary.remaining_debt);
}

/* ===================== PRODUCTION ===================== */
async function renderProduction(content) {
  const bizId = effectiveBizId();
  if (!bizId && state.user.role === 'super_admin') {
    content.innerHTML = `<div class="alert alert-info"><i class="fa-solid fa-circle-info"></i> Ishlab chiqarish yozuvlarini kiritish uchun yuqoridan aniq bitta nonvoyxonani tanlang.</div>`;
    await renderProductionList(content, null);
    return;
  }
  await renderProductionList(content, bizId);
}

async function renderProductionList(content, bizId) {
  let page = 1;
  const limit = 10;
  let filterDate = state.prodFilterDate || '';

  async function loadData() {
    try {
      const [prodRes, stockRes] = await Promise.all([
        API.get('/production' + qs({ business_id: bizId, date: filterDate || undefined, page, limit })),
        bizId ? API.get('/production/stock' + qs({ business_id: bizId, limit: 100 })) : Promise.resolve([])
      ]);

      const { items: entries, pagination } = extractListData(prodRes, page, limit);
      const stock = Array.isArray(stockRes) ? stockRes : (stockRes?.data || []);

      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="section-head">
          <h2>Ishlab chiqarish</h2>
          <p>Har kuni tayyorlangan non miqdorini kiriting</p>
        </div>

        ${bizId ? `<div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>Nonvoyxonadagi joriy zaxira (balans)</h3></div>
          <div class="grid grid-3">
            ${stock.map(s => {
              const pct = s.produced ? Math.round((s.remaining / s.produced) * 100) : 0;
              const warn = s.remaining < 0;
              const fillClass = warn ? 'danger' : (pct < 20 ? 'warning' : 'green');
              return `<div class="card" style="padding:14px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                  <strong style="font-size:13.5px;">${escapeHtml(s.product.name)}</strong>
                  <span class="badge ${warn ? 'badge-red' : (pct < 20 ? 'badge-warning' : 'badge-green')}">${fmtNum(s.remaining)} dona</span>
                </div>
                <div class="balance-bar"><div class="balance-bar-fill ${fillClass}" style="width:${Math.max(0, Math.min(100, pct))}%;"></div></div>
                <div class="stat-sub" style="margin-top:8px;">Tayyorlangan: ${fmtNum(s.produced)} · Berilgan: ${fmtNum(s.distributed)}</div>
                ${warn ? `<div class="alert alert-warning" style="margin-top:8px;margin-bottom:0;padding:8px 10px;font-size:12px;"><i class="fa-solid fa-triangle-exclamation"></i> Nomuvofiqlik: berilgan miqdor tayyorlangandan ko'p!</div>` : ''}
              </div>`;
            }).join('') || `<p class="muted">Mahsulot turi yo'q</p>`}
          </div>
        </div>` : ''}

        <div class="filters-bar">
          <div class="field"><label>Sana bo'yicha filtr</label><input type="date" id="filter-date" value="${filterDate}" /></div>
          <button class="btn btn-secondary btn-sm" id="clear-filter">Tozalash</button>
          <div style="margin-left:auto;">
            <button class="btn btn-primary" id="add-production-btn">+ Ishlab chiqarish qo'shish</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Yozuvlar (${fmtNum(pagination.total)})</h3></div>
          <div class="table-wrap"><table>
            <thead><tr>${!bizId ? '<th>Nonvoyxona</th>' : ''}<th>Sana</th><th>Mahsulot</th><th class="text-right">Soni</th><th class="text-right">Narxi</th><th class="text-right">Jami summa</th><th></th></tr></thead>
            <tbody>
              ${entries.length ? entries.map(e => `
                <tr>
                  ${!bizId ? `<td class="muted">${escapeHtml(e.business_name)}</td>` : ''}
                  <td>${fmtDate(e.date)}</td>
                  <td>${escapeHtml(e.product_name)}</td>
                  <td class="text-right num">${fmtNum(e.quantity)}</td>
                  <td class="text-right num">${fmtMoney(e.unit_price)}</td>
                  <td class="text-right num"><strong>${fmtMoney(e.total_amount)}</strong></td>
                  <td><button class="icon-btn" data-del="${e.id}" title="O'chirish"><i class="fa-solid fa-trash-can"></i></button></td>
                </tr>
              `).join('') : `<tr class="empty-row"><td colspan="7">Yozuv topilmadi</td></tr>`}
            </tbody>
          </table></div>
          ${renderPaginationHtml(pagination, 'prod-list-pg')}
        </div>
      `;

      content.innerHTML = '';
      content.appendChild(wrap);

      bindPaginationEvents(content, pagination, (newPage) => {
        page = newPage;
        loadData();
      }, 'prod-list-pg');

      content.querySelector('#filter-date').onchange = (e) => {
        state.prodFilterDate = e.target.value;
        filterDate = e.target.value;
        page = 1;
        loadData();
      };
      content.querySelector('#clear-filter').onclick = () => {
        state.prodFilterDate = '';
        filterDate = '';
        page = 1;
        loadData();
      };
      const addBtn = content.querySelector('#add-production-btn');
      if (addBtn) addBtn.onclick = () => productionFormModal(bizId);
      content.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        confirmAction("Bu yozuvni o'chirmoqchimisiz?", async () => {
          try { await API.del('/production/' + b.dataset.del); toast("O'chirildi", 'success'); loadData(); }
          catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      content.innerHTML = `
        <div class="alert alert-warning" style="margin-top:20px;">
          <i class="fa-solid fa-triangle-exclamation"></i> Ishlab chiqarish yozuvlarini yuklashda xatolik: ${escapeHtml(err.message || 'Server xatosi')}
        </div>
      `;
    }
  }

  await loadData();
}

function productionFormModal(defaultBizId) {
  const needsBizSelect = state.user.role === 'super_admin';
  const initialBiz = defaultBizId || state.businesses[0]?.id;
  openModal("Yangi ishlab chiqarish yozuvi", `
    <form id="prod-form">
      <div class="form-grid">
        ${needsBizSelect ? `<div class="field span-2"><label>Nonvoyxona</label>${bizSelectHtml('f-biz', initialBiz)}</div>` : ''}
        <div class="field span-2"><label>Mahsulot</label><select id="f-product" required></select></div>
        <div class="field"><label>Sana</label><input type="date" id="f-date" value="${todayStr()}" required /></div>
        <div class="field"><label>Soni (dona)</label><input required type="number" min="1" step="1" id="f-qty" placeholder="Masalan: 500" /></div>
        <div class="field span-2"><div id="f-total" class="field-hint"></div></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="cancel-btn">Bekor qilish</button>
        <button type="submit" class="btn btn-primary">Qo'shish</button>
      </div>
    </form>
  `, async (m) => {
    let products = [];
    async function loadProducts(bizId) {
      const pRes = await API.get('/products' + qs({ business_id: bizId, limit: 100 }));
      products = Array.isArray(pRes) ? pRes : (pRes?.data || []);
      const sel = m.querySelector('#f-product');
      sel.innerHTML = products.map(p => `<option value="${p.id}" data-price="${p.price}">${escapeHtml(p.name)} — ${fmtMoney(p.price)}</option>`).join('') || `<option value="">Mahsulot yo'q</option>`;
      updateTotal();
    }
    function updateTotal() {
      const sel = m.querySelector('#f-product');
      const opt = sel.options[sel.selectedIndex];
      const price = opt ? Number(opt.dataset.price || 0) : 0;
      const qty = Number(m.querySelector('#f-qty').value || 0);
      m.querySelector('#f-total').textContent = price ? `Jami summa: ${fmtMoney(price * qty)}` : '';
    }
    await loadProducts(initialBiz);
    if (needsBizSelect) m.querySelector('#f-biz').addEventListener('change', (e) => loadProducts(e.target.value));
    m.querySelector('#f-product').addEventListener('change', updateTotal);
    m.querySelector('#f-qty').addEventListener('input', updateTotal);

    m.querySelector('#cancel-btn').onclick = () => m.remove();
    m.querySelector('#prod-form').onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        product_id: m.querySelector('#f-product').value,
        date: m.querySelector('#f-date').value,
        quantity: Number(m.querySelector('#f-qty').value)
      };
      if (needsBizSelect) body.business_id = m.querySelector('#f-biz').value;
      try {
        await API.post('/production', body);
        toast("Ishlab chiqarish yozuvi qo'shildi", 'success');
        m.remove();
        render();
      } catch (err) { toast(err.message, 'error'); }
    };
  });
}

/* ===================== DISTRIBUTION ===================== */
async function renderDistribution(content) {
  if (state.user.role === 'bakery_admin') {
    location.hash = '#/dashboard';
    return;
  }
  const bizId = effectiveBizId();
  if (!bizId && state.user.role === 'super_admin') {
    content.innerHTML = `<div class="alert alert-info"><i class="fa-solid fa-circle-info"></i> Taqsimlash yozuvini kiritish uchun yuqoridan aniq bitta nonvoyxonani tanlang.</div>`;
    await renderDistributionList(content, null);
    return;
  }
  await renderDistributionList(content, bizId);
}

async function renderDistributionList(content, bizId) {
  let page = 1;
  const limit = 10;
  let filterDate = state.distFilterDate || '';

  async function loadData() {
    try {
      const res = await API.get('/distribution' + qs({ business_id: bizId, date: filterDate || undefined, page, limit }));
      const { items: entries, pagination } = extractListData(res, page, limit);

      content.innerHTML = `
        <div class="section-head">
          <h2>Do'konlarga taqsimlash</h2>
          <p>Tayyorlangan nonlarni do'konlarga bering va to'lov turini belgilang</p>
        </div>

        <div class="filters-bar">
          <div class="field"><label>Sana bo'yicha filtr</label><input type="date" id="filter-date" value="${filterDate}" /></div>
          <button class="btn btn-secondary btn-sm" id="clear-filter">Tozalash</button>
          <div style="margin-left:auto;">
            <button class="btn btn-primary" id="add-dist-btn">+ Taqsimlash kiritish</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Yozuvlar (${fmtNum(pagination.total)})</h3></div>
          <div class="table-wrap"><table>
            <thead><tr>${!bizId ? '<th>Nonvoyxona</th>' : ''}<th>Sana</th><th>Do'kon</th><th>Mahsulot</th><th class="text-right">Soni</th><th class="text-right">Jami</th><th class="text-right">Naqd</th><th class="text-right">Nasiya</th><th></th></tr></thead>
            <tbody>
              ${entries.length ? entries.map(e => `
                <tr>
                  ${!bizId ? `<td class="muted">${escapeHtml(e.business_name)}</td>` : ''}
                  <td>${fmtDate(e.date)}</td>
                  <td>${escapeHtml(e.store_name)}</td>
                  <td>${escapeHtml(e.product_name)}</td>
                  <td class="text-right num">${fmtNum(e.quantity)}</td>
                  <td class="text-right num"><strong>${fmtMoney(e.total_amount)}</strong></td>
                  <td class="text-right num">${fmtMoney(e.cash_amount)}</td>
                  <td class="text-right num">${fmtMoney(e.credit_amount)}</td>
                  <td><button class="icon-btn" data-del="${e.id}" title="O'chirish"><i class="fa-solid fa-trash-can"></i></button></td>
                </tr>
              `).join('') : `<tr class="empty-row"><td colspan="9">Yozuv topilmadi</td></tr>`}
            </tbody>
          </table></div>
          ${renderPaginationHtml(pagination, 'dist-pg')}
        </div>
      `;

      bindPaginationEvents(content, pagination, (newPage) => {
        page = newPage;
        loadData();
      }, 'dist-pg');

      content.querySelector('#filter-date').onchange = (e) => {
        state.distFilterDate = e.target.value;
        filterDate = e.target.value;
        page = 1;
        loadData();
      };
      content.querySelector('#clear-filter').onclick = () => {
        state.distFilterDate = '';
        filterDate = '';
        page = 1;
        loadData();
      };
      const addBtn = content.querySelector('#add-dist-btn');
      if (addBtn) addBtn.onclick = () => distributionFormModal(bizId);
      content.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        confirmAction("Bu yozuvni o'chirmoqchimisiz?", async () => {
          try { await API.del('/distribution/' + b.dataset.del); toast("O'chirildi", 'success'); loadData(); }
          catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      content.innerHTML = `
        <div class="alert alert-warning" style="margin-top:20px;">
          <i class="fa-solid fa-triangle-exclamation"></i> Taqsimlash yozuvlarini yuklashda xatolik: ${escapeHtml(err.message || 'Server xatosi')}
        </div>
      `;
    }
  }

  await loadData();
}

function distributionFormModal(defaultBizId) {
  const needsBizSelect = state.user.role === 'super_admin';
  const initialBiz = defaultBizId || state.businesses[0]?.id;
  openModal("Yangi taqsimlash yozuvi", `
    <form id="dist-form">
      <div class="form-grid">
        ${needsBizSelect ? `<div class="field span-2"><label>Nonvoyxona</label>${bizSelectHtml('f-biz', initialBiz)}</div>` : ''}
        <div class="field"><label>Do'kon</label><select id="f-store" required></select></div>
        <div class="field"><label>Mahsulot</label><select id="f-product" required></select></div>
        <div class="field"><label>Sana</label><input type="date" id="f-date" value="${todayStr()}" required /></div>
        <div class="field"><label>Berilgan soni</label><input type="number" min="1" step="1" id="f-qty" placeholder="Masalan: 200" required /></div>
        <div class="field span-2"><div id="f-stock-hint" class="field-hint"></div></div>
        <div class="field span-2"><label>To'lov turi</label>
          <select id="f-pay-type">
            <option value="cash">To'liq naqd</option>
            <option value="credit">To'liq nasiya</option>
            <option value="mixed">Aralash (naqd + nasiya)</option>
          </select>
        </div>
        <div class="field" id="f-cash-wrap" style="display:none;"><label>Naqd summa</label><input type="number" min="0" step="any" id="f-cash" placeholder="0" /></div>
        <div class="field" id="f-credit-wrap" style="display:none;"><label>Nasiya summa</label><input type="number" min="0" step="any" id="f-credit" placeholder="0" /></div>
        <div class="field span-2"><div id="f-total" class="field-hint"></div></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="cancel-btn">Bekor qilish</button>
        <button type="submit" class="btn btn-primary">Qo'shish</button>
      </div>
    </form>
  `, async (m) => {
    let products = [], stock = [], currentTotal = 0;

    async function loadForBiz(bizId) {
      const [loadedProducts, stores, loadedStock] = await Promise.all([
        API.get('/products' + qs({ business_id: bizId, limit: 100 })),
        API.get('/stores' + qs({ business_id: bizId, limit: 100 })),
        API.get('/production/stock' + qs({ business_id: bizId, limit: 100 }))
      ]);
      products = Array.isArray(loadedProducts) ? loadedProducts : (loadedProducts?.data || []);
      const storeList = Array.isArray(stores) ? stores : (stores?.data || []);
      stock = Array.isArray(loadedStock) ? loadedStock : (loadedStock?.data || []);
      m.querySelector('#f-product').innerHTML = products.map(p => `<option value="${p.id}" data-price="${p.price}">${escapeHtml(p.name)} — ${fmtMoney(p.price)}</option>`).join('') || `<option value="">Mahsulot yo'q</option>`;
      m.querySelector('#f-store').innerHTML = storeList.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('') || `<option value="">Do'kon yo'q</option>`;
      updateStockHint();
      updateTotal();
    }

    function updateStockHint() {
      const bizId = needsBizSelect ? m.querySelector('#f-biz').value : effectiveBizId();
      const productId = m.querySelector('#f-product').value;
      if (!bizId || !productId) return;
      const s = stock.find(x => x.product.id == productId);
      m.querySelector('#f-stock-hint').textContent = s ? `Nonvoyxonada mavjud zaxira: ${fmtNum(s.remaining)} dona` : '';
    }

    function updateTotal() {
      const sel = m.querySelector('#f-product');
      const opt = sel.options[sel.selectedIndex];
      const price = opt ? Number(opt.dataset.price || 0) : 0;
      const qty = Number(m.querySelector('#f-qty').value || 0);
      currentTotal = price * qty;
      m.querySelector('#f-total').textContent = price ? `Jami summa: ${fmtMoney(currentTotal)}` : '';
      syncPaymentFields();
    }

    function syncPaymentFields() {
      const type = m.querySelector('#f-pay-type').value;
      const cashEl = m.querySelector('#f-cash');
      const creditEl = m.querySelector('#f-credit');
      m.querySelector('#f-cash-wrap').style.display = type === 'credit' ? 'none' : '';
      m.querySelector('#f-credit-wrap').style.display = type === 'cash' ? 'none' : '';

      if (type === 'cash') {
        cashEl.value = currentTotal;
        creditEl.value = 0;
      } else if (type === 'credit') {
        creditEl.value = currentTotal;
        cashEl.value = 0;
      } else if (type === 'mixed') {
        const currentCash = Number(cashEl.value) || 0;
        if (currentCash > 0) {
          creditEl.value = Math.max(0, currentTotal - currentCash);
        } else {
          cashEl.value = '';
          creditEl.value = currentTotal;
        }
      }
    }

    function onCashInput() {
      if (m.querySelector('#f-pay-type').value !== 'mixed') return;
      const cashVal = m.querySelector('#f-cash').value;
      const cash = Number(cashVal) || 0;
      const credit = Math.max(0, currentTotal - cash);
      m.querySelector('#f-credit').value = credit;
    }

    function onCreditInput() {
      if (m.querySelector('#f-pay-type').value !== 'mixed') return;
      const creditVal = m.querySelector('#f-credit').value;
      const credit = Number(creditVal) || 0;
      const cash = Math.max(0, currentTotal - credit);
      m.querySelector('#f-cash').value = cash;
    }

    await loadForBiz(initialBiz);
    if (needsBizSelect) m.querySelector('#f-biz').addEventListener('change', (e) => loadForBiz(e.target.value));
    m.querySelector('#f-product').addEventListener('change', () => { updateTotal(); updateStockHint(); });
    m.querySelector('#f-qty').addEventListener('input', updateTotal);
    m.querySelector('#f-pay-type').addEventListener('change', syncPaymentFields);
    m.querySelector('#f-cash').addEventListener('input', onCashInput);
    m.querySelector('#f-credit').addEventListener('input', onCreditInput);

    m.querySelector('#cancel-btn').onclick = () => m.remove();
    m.querySelector('#dist-form').onsubmit = async (e) => {
      e.preventDefault();
      const type = m.querySelector('#f-pay-type').value;
      const cash = type === 'credit' ? 0 : Number(m.querySelector('#f-cash').value || 0);
      const credit = type === 'cash' ? 0 : Number(m.querySelector('#f-credit').value || 0);
      const body = {
        store_id: m.querySelector('#f-store').value,
        product_id: m.querySelector('#f-product').value,
        date: m.querySelector('#f-date').value,
        quantity: Number(m.querySelector('#f-qty').value),
        cash_amount: cash,
        credit_amount: credit
      };
      if (needsBizSelect) body.business_id = m.querySelector('#f-biz').value;
      try {
        await API.post('/distribution', body);
        toast("Taqsimlash yozuvi qo'shildi", 'success');
        m.remove();
        render();
      } catch (err) { toast(err.message, 'error'); }
    };
  });
}

/* ===================== PAYMENTS (Naqd/Nasiya) ===================== */
async function renderPayments(content) {
  if (state.user.role === 'bakery_admin') {
    location.hash = '#/dashboard';
    return;
  }
  const bizId = effectiveBizId();
  const isAllBusinesses = state.user.role === 'super_admin' && !bizId;
  const bizName = (id) => state.businesses?.find(b => b.id == id)?.name || '';

  const [storesRes, distRes, payRes] = await Promise.all([
    API.get('/stores' + qs({ business_id: bizId, limit: 100 })),
    API.get('/distribution' + qs({ business_id: bizId, limit: 100 })),
    API.get('/payments' + qs({ business_id: bizId, limit: 100 }))
  ]);

  const stores = Array.isArray(storesRes) ? storesRes : (storesRes?.data || []);
  const distributions = Array.isArray(distRes) ? distRes : (distRes?.data || []);
  const payments = Array.isArray(payRes) ? payRes : (payRes?.data || []);

  const storeBizMap = {};
  stores.forEach(s => { storeBizMap[s.id] = s.business_id; });

  const byStore = {};
  stores.forEach(s => byStore[s.id] = { store: s, cash: 0, credit: 0, total: 0, paid: 0 });
  distributions.forEach(d => {
    if (!byStore[d.store_id]) return;
    byStore[d.store_id].cash += d.cash_amount;
    byStore[d.store_id].credit += d.credit_amount;
    byStore[d.store_id].total += d.total_amount;
  });
  payments.forEach(p => { if (byStore[p.store_id]) byStore[p.store_id].paid += p.amount; });
  const rows = Object.values(byStore);

  const totalSales = rows.reduce((s, r) => s + r.total, 0);
  const totalDebt = rows.reduce((s, r) => s + (r.credit - r.paid), 0);
  const totalCash = rows.reduce((s, r) => s + r.cash, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);

  // Nonvoyxonalar bo'yicha umumiy hisob-kitob (barcha nonvoyxonalar ko'rilayotgan bo'lsa)
  let bizSummaryHtml = '';
  if (isAllBusinesses) {
    const byBiz = {};
    (state.businesses || []).forEach(b => {
      byBiz[b.id] = { id: b.id, name: b.name, storesCount: 0, total: 0, cash: 0, credit: 0, paid: 0, debt: 0 };
    });

    rows.forEach(r => {
      const bId = r.store.business_id;
      if (!byBiz[bId]) {
        const found = (state.businesses || []).find(b => b.id == bId);
        byBiz[bId] = { id: bId, name: found?.name || `Nonvoyxona #${bId}`, storesCount: 0, total: 0, cash: 0, credit: 0, paid: 0, debt: 0 };
      }
      byBiz[bId].storesCount += 1;
      byBiz[bId].total += r.total;
      byBiz[bId].cash += r.cash;
      byBiz[bId].credit += r.credit;
      byBiz[bId].paid += r.paid;
    });

    Object.values(byBiz).forEach(b => {
      b.debt = b.credit - b.paid;
    });

    const bizRows = Object.values(byBiz);
    bizSummaryHtml = `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><h3>Nonvoyxonalar bo'yicha hisob-kitob</h3></div>
        <div class="table-wrap"><table>
          <thead>
            <tr>
              <th>Nonvoyxona</th>
              <th class="text-right">Do'konlar soni</th>
              <th class="text-right">Jami sotuv</th>
              <th class="text-right">Naqd</th>
              <th class="text-right">Nasiya</th>
              <th class="text-right">To'langan</th>
              <th class="text-right">Qolgan qarz</th>
            </tr>
          </thead>
          <tbody>
            ${bizRows.length ? bizRows.map(b => `
              <tr>
                <td><strong>${escapeHtml(b.name)}</strong></td>
                <td class="text-right num">${b.storesCount}</td>
                <td class="text-right num">${fmtMoney(b.total)}</td>
                <td class="text-right num">${fmtMoney(b.cash)}</td>
                <td class="text-right num">${fmtMoney(b.credit)}</td>
                <td class="text-right num">${fmtMoney(b.paid)}</td>
                <td class="text-right num">${b.debt > 0 ? `<span class="badge badge-red">${fmtMoney(b.debt)}</span>` : `<span class="badge badge-green">0 so'm</span>`}</td>
              </tr>
            `).join('') : `<tr class="empty-row"><td colspan="7">Nonvoyxonalar topilmadi</td></tr>`}
          </tbody>
        </table></div>
      </div>
    `;
  }

  content.innerHTML = `
    <div class="section-head">
      <h2>Naqd / Nasiya hisob-kitobi</h2>
      <p>${isAllBusinesses ? "Barcha nonvoyxonalar bo'yicha to'lov holati va qarzdorlik" : "Har bir do'konning to'lov holati va qarzdorligi"}</p>
    </div>
    <div class="grid grid-5" style="margin-bottom:20px;">
      ${statCard('<i class="fa-solid fa-receipt"></i>', 'Jami sotuv', fmtMoney(totalSales), '', 'primary')}
      ${statCard('<i class="fa-solid fa-money-bill-wave"></i>', 'Jami naqd', fmtMoney(totalCash), '', 'green')}
      ${statCard('<i class="fa-solid fa-clipboard-list"></i>', 'Jami nasiya', fmtMoney(totalCredit), '', 'blue')}
      ${statCard('<i class="fa-solid fa-circle-check"></i>', "Jami to'langan", fmtMoney(totalPaid), '', 'green')}
      ${statCard('<i class="fa-solid fa-triangle-exclamation"></i>', 'Jami qarzdorlik', fmtMoney(totalDebt), '', 'red')}
    </div>
    ${bizSummaryHtml}
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><h3>Do'konlar bo'yicha holat</h3></div>
      <div class="table-wrap"><table>
        <thead><tr>${isAllBusinesses ? '<th>Nonvoyxona</th>' : ''}<th>Do'kon</th><th class="text-right">Jami sotuv</th><th class="text-right">Naqd</th><th class="text-right">Nasiya</th><th class="text-right">To'langan</th><th class="text-right">Qolgan qarz</th><th></th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(r => {
            const remaining = r.credit - r.paid;
            return `<tr>
              ${isAllBusinesses ? `<td class="muted">${escapeHtml(bizName(r.store.business_id))}</td>` : ''}
              <td><a href="#/stores/${r.store.id}" style="color:var(--accent);font-weight:600;text-decoration:none;">${escapeHtml(r.store.name)}</a></td>
              <td class="text-right num">${fmtMoney(r.total)}</td>
              <td class="text-right num">${fmtMoney(r.cash)}</td>
              <td class="text-right num">${fmtMoney(r.credit)}</td>
              <td class="text-right num">${fmtMoney(r.paid)}</td>
              <td class="text-right num">${remaining > 0 ? `<span class="badge badge-red">${fmtMoney(remaining)}</span>` : `<span class="badge badge-green">0 so'm</span>`}</td>
              <td>${remaining > 0 ? `<button class="btn btn-secondary btn-sm" data-pay="${r.store.id}" data-debt="${remaining}">To'lash</button>` : ''}</td>
            </tr>`;
          }).join('') : `<tr class="empty-row"><td colspan="${isAllBusinesses ? 8 : 7}">Do'kon topilmadi</td></tr>`}
        </tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>So'nggi to'lovlar</h3></div>
      ${renderPaymentsTableWithStore(payments, isAllBusinesses, storeBizMap)}
    </div>
  `;

  content.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => {
    const store = stores.find(s => s.id == b.dataset.pay);
    paymentFormModal(store, Number(b.dataset.debt));
  });
}

function renderPaymentsTableWithStore(rows, showBiz = false, storeBizMap = {}) {
  const bizName = (id) => state.businesses?.find(b => b.id == id)?.name || '';
  return `<div class="table-wrap"><table>
    <thead><tr>${showBiz ? '<th>Nonvoyxona</th>' : ''}<th>Sana</th><th>Do'kon</th><th>Izoh</th><th class="text-right">Summa</th></tr></thead>
    <tbody>
      ${rows.length ? rows.slice(0, 30).map(r => `
        <tr>
          ${showBiz ? `<td class="muted">${escapeHtml(r.business_name || bizName(r.business_id || storeBizMap[r.store_id]) || '—')}</td>` : ''}
          <td>${fmtDate(r.date)}</td>
          <td>${escapeHtml(r.store_name)}</td>
          <td class="muted">${escapeHtml(r.note || '—')}</td>
          <td class="text-right num">${fmtMoney(r.amount)}</td>
        </tr>
      `).join('') : `<tr class="empty-row"><td colspan="${showBiz ? 5 : 4}">To'lov qilinmagan</td></tr>`}
    </tbody>
  </table></div>`;
}

function paymentFormModal(store, currentDebt) {
  openModal(`Qarz to'lash — ${escapeHtml(store.name)}`, `
    <div class="alert alert-info">Joriy qarz: <strong>${fmtMoney(currentDebt)}</strong></div>
    <form id="pay-form">
      <div class="form-grid">
        <div class="field"><label>Sana</label><input type="date" id="f-date" value="${todayStr()}" required /></div>
        <div class="field"><label>To'lov summasi</label><input type="number" min="1" max="${currentDebt}" step="any" id="f-amount" placeholder="Masalan: 50000" required /></div>
        <div class="field span-2"><label>Izoh (ixtiyoriy)</label><input id="f-note" placeholder="Masalan: qisman to'lov" /></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="cancel-btn">Bekor qilish</button>
        <button type="submit" class="btn btn-primary">To'lovni saqlash</button>
      </div>
    </form>
  `, (m) => {
    m.querySelector('#cancel-btn').onclick = () => m.remove();
    m.querySelector('#pay-form').onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        store_id: store.id,
        date: m.querySelector('#f-date').value,
        amount: Number(m.querySelector('#f-amount').value),
        note: m.querySelector('#f-note').value.trim(),
        business_id: store.business_id
      };
      try {
        await API.post('/payments', body);
        toast("To'lov qabul qilindi", 'success');
        m.remove();
        render();
      } catch (err) { toast(err.message, 'error'); }
    };
  });
}

/* ===================== DAILY REPORT ===================== */
async function renderDailyReport(content) {
  const bizId = effectiveBizId();
  const date = state.reportDate || todayStr();
  const data = await API.get('/reports/daily' + qs({ business_id: bizId, date }));
  const isBakeryAdmin = state.user.role === 'bakery_admin';

  content.innerHTML = `
    <div class="section-head">
      <h2>Kunlik hisobot</h2>
      <p>Belgilangan kun bo'yicha to'liq hisobot</p>
    </div>
    <div class="filters-bar">
      <div class="field"><label>Sana</label><input type="date" id="report-date" value="${date}" /></div>
    </div>

    <div class="grid ${isBakeryAdmin ? 'grid-3' : 'grid-4'}" style="margin-bottom:20px;">
      ${statCard('<i class="fa-solid fa-kitchen-set"></i>', 'Tayyorlangan', fmtNum(data.totals.produced) + ' dona', '', 'green')}
      ${statCard('<i class="fa-solid fa-truck-fast"></i>', 'Berilgan', fmtNum(data.totals.distributed) + ' dona', '', 'blue')}
      ${statCard('<i class="fa-solid fa-boxes-stacked"></i>', 'Qoldi', fmtNum(data.totals.remaining) + ' dona', '', '')}
      ${!isBakeryAdmin ? statCard('<i class="fa-solid fa-money-bill-wave"></i>', "Naqd / Nasiya", fmtMoney(data.totals.cash) + ' / ' + fmtMoney(data.totals.credit), '', '') : ''}
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><h3>Ishlab chiqarish — ${fmtDate(date)}</h3></div>
      <div class="table-wrap"><table>
        <thead><tr>${!bizId ? '<th>Nonvoyxona</th>' : ''}<th>Mahsulot</th><th class="text-right">Soni</th>${!isBakeryAdmin ? '<th class="text-right">Summa</th>' : ''}</tr></thead>
        <tbody>
          ${data.production.length ? data.production.map(p => `
            <tr>${!bizId ? `<td class="muted">${escapeHtml(p.business_name)}</td>` : ''}<td>${escapeHtml(p.product_name)}</td><td class="text-right num">${fmtNum(p.quantity)}</td>${!isBakeryAdmin ? `<td class="text-right num">${fmtMoney(p.total_amount)}</td>` : ''}</tr>
          `).join('') : `<tr class="empty-row"><td colspan="${(!bizId ? 1 : 0) + (isBakeryAdmin ? 2 : 3)}">Ma'lumot yo'q</td></tr>`}
        </tbody>
      </table></div>
    </div>

    ${!isBakeryAdmin ? `
    <div class="card">
      <div class="card-header"><h3>Do'konlarga taqsimlash — ${fmtDate(date)}</h3></div>
      ${renderDistTable(data.distribution, true)}
    </div>
    ` : ''}
  `;

  content.querySelector('#report-date').onchange = (e) => { state.reportDate = e.target.value; render(); };
}

/* ===================== OVERALL REPORT ===================== */
async function renderOverallReport(content) {
  const bizId = effectiveBizId();
  const from = state.reportFrom || '';
  const to = state.reportTo || '';
  const data = await API.get('/reports/overall' + qs({ business_id: bizId, from, to }));
  const isBakeryAdmin = state.user.role === 'bakery_admin';

  content.innerHTML = `
    <div class="section-head">
      <h2>Umumiy hisobot</h2>
      <p>Tanlangan davr bo'yicha barcha ko'rsatkichlar</p>
    </div>
    <div class="filters-bar">
      <div class="field"><label>Dan</label><input type="date" id="report-from" value="${from}" /></div>
      <div class="field"><label>Gacha</label><input type="date" id="report-to" value="${to}" /></div>
      <button class="btn btn-secondary btn-sm" id="clear-range">Barcha davr</button>
    </div>

    ${isBakeryAdmin ? `
    <div class="grid grid-2" style="margin-bottom:20px;">
      ${statCard('<i class="fa-solid fa-kitchen-set"></i>', 'Ishlab chiqarilgan', fmtNum(data.totals.produced) + ' dona', '', 'green')}
      ${statCard('<i class="fa-solid fa-boxes-stacked"></i>', 'Qoldiq', fmtNum(data.totals.remaining) + ' dona', '', '')}
    </div>

    <div class="card">
      <div class="card-header"><h3>Nonvoyxona bo'yicha</h3></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nonvoyxona</th><th class="text-right">Tayyorlangan</th><th class="text-right">Berilgan</th></tr></thead>
        <tbody>
          ${data.byBusiness.length ? data.byBusiness.map(b => `
            <tr><td>${escapeHtml(b.name)}</td><td class="text-right num">${fmtNum(b.produced)}</td><td class="text-right num">${fmtNum(b.distributed)}</td></tr>
          `).join('') : `<tr class="empty-row"><td colspan="3">Ma'lumot yo'q</td></tr>`}
        </tbody>
      </table></div>
    </div>
    ` : `
    <div class="grid grid-4" style="margin-bottom:20px;">
      ${statCard('<i class="fa-solid fa-kitchen-set"></i>', 'Ishlab chiqarilgan', fmtNum(data.totals.produced) + ' dona', '', 'green')}
      ${statCard('<i class="fa-solid fa-truck-fast"></i>', 'Tarqatilgan', fmtNum(data.totals.distributed) + ' dona', '', 'blue')}
      ${statCard('<i class="fa-solid fa-boxes-stacked"></i>', 'Qoldiq', fmtNum(data.totals.remaining) + ' dona', '', '')}
      ${statCard('<i class="fa-solid fa-triangle-exclamation"></i>', 'Qarzdorlik', fmtMoney(data.totals.debt), '', 'red')}
    </div>
    <div class="grid grid-3" style="margin-bottom:20px;">
      ${statCard('<i class="fa-solid fa-money-bill-wave"></i>', 'Naqd', fmtMoney(data.totals.cash), '', 'green')}
      ${statCard('<i class="fa-solid fa-clipboard-list"></i>', 'Nasiya', fmtMoney(data.totals.credit), '', 'blue')}
      ${statCard('<i class="fa-solid fa-circle-check"></i>', "To'langan", fmtMoney(data.totals.paid), '', 'green')}
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><h3>Nonvoyxonalar bo'yicha</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Nonvoyxona</th><th class="text-right">Tayyorlangan</th><th class="text-right">Berilgan</th><th class="text-right">Naqd</th><th class="text-right">Nasiya</th></tr></thead>
          <tbody>
            ${data.byBusiness.length ? data.byBusiness.map(b => `
              <tr><td>${escapeHtml(b.name)}</td><td class="text-right num">${fmtNum(b.produced)}</td><td class="text-right num">${fmtNum(b.distributed)}</td><td class="text-right num">${fmtMoney(b.cash)}</td><td class="text-right num">${fmtMoney(b.credit)}</td></tr>
            `).join('') : `<tr class="empty-row"><td colspan="5">Ma'lumot yo'q</td></tr>`}
          </tbody>
        </table></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Eng ko'p mahsulot olgan do'konlar</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Do'kon</th><th class="text-right">Soni</th><th class="text-right">Summa</th></tr></thead>
          <tbody>
            ${data.topStores.filter(s => s.total_qty > 0).length ? data.topStores.filter(s => s.total_qty > 0).map(s => `
              <tr><td>${escapeHtml(s.name)}<div class="muted" style="font-size:11.5px;">${escapeHtml(s.business_name)}</div></td><td class="text-right num">${fmtNum(s.total_qty)}</td><td class="text-right num">${fmtMoney(s.total_amount)}</td></tr>
            `).join('') : `<tr class="empty-row"><td colspan="3">Ma'lumot yo'q</td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>
    `}
  `;

  content.querySelector('#report-from').onchange = (e) => { state.reportFrom = e.target.value; render(); };
  content.querySelector('#report-to').onchange = (e) => { state.reportTo = e.target.value; render(); };
  content.querySelector('#clear-range').onclick = () => { state.reportFrom = ''; state.reportTo = ''; render(); };
}

/* ===================== DO'KON ZAKAZLARI (ORDERS) ===================== */
function orderStatusBadge(status) {
  const map = {
    pending: { label: 'Kutilmoqda', cls: 'badge-warning' },
    approved: { label: 'Tasdiqlandi', cls: 'badge-blue' },
    rejected: { label: 'Rad etildi', cls: 'badge-red' },
    completed: { label: 'Bajarildi', cls: 'badge-green' }
  };
  const item = map[status] || { label: status || 'Noma‘lum', cls: 'badge-muted' };
  return `<span class="badge ${item.cls}">${item.label}</span>`;
}

function formatOrderItemsSummary(items) {
  if (!items || !items.length) return '—';
  return items.map(it => {
    const name = it.product?.name || it.product_name || it.name || ('Mahsulot #' + it.product_id);
    const qty = it.quantity || it.qty || 0;
    return `${escapeHtml(name)} (${fmtNum(qty)} dona)`;
  }).join(', ');
}

async function renderOrders(content) {
  if (state.user.role === 'bakery_admin') {
    location.hash = '#/dashboard';
    return;
  }

  const isStore = state.user.role === 'store';
  const isSuperAdmin = state.user.role === 'super_admin';

  let page = 1;
  const limit = 10;
  let statusFilter = state.orderStatusFilter || 'all';
  let storeFilter = state.orderStoreFilter || 'all';
  let searchFilter = state.orderSearchFilter || '';
  const storeMap = {};

  async function loadData() {
    try {
      const qParams = {
        page,
        limit,
        status: statusFilter !== 'all' ? statusFilter : undefined
      };
      const res = await API.get('/orders' + qs(qParams));
      const { items: allOrders, pagination } = extractListData(res, page, limit);

      if (isSuperAdmin) {
        allOrders.forEach(o => {
          const sid = o.store_id || o.store?.id;
          const sname = o.store?.name || o.store_name;
          if (sid && sname && !storeMap[sid]) storeMap[sid] = sname;
        });
      }

      // Filtrlash (store va search bo'yicha klient tomonida ham tekshirish)
      const filtered = allOrders.filter(o => {
        if (isSuperAdmin && storeFilter !== 'all' && String(o.store_id || o.store?.id) !== String(storeFilter)) return false;
        if (searchFilter) {
          const q = searchFilter.toLowerCase();
          const storeName = (o.store?.name || o.store_name || '').toLowerCase();
          const note = (o.note || '').toLowerCase();
          const itemsStr = (o.items || o.order_items || o.OrderItems || []).map(i => i.product?.name || i.product_name || '').join(' ').toLowerCase();
          const idStr = String(o.id);
          if (!storeName.includes(q) && !note.includes(q) && !itemsStr.includes(q) && !idStr.includes(q)) {
            return false;
          }
        }
        return true;
      });

      content.innerHTML = `
        <div class="section-head" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <h2>${isStore ? "Mening zakazlarim" : "Do‘kon zakazlari"}</h2>
            <p>${isStore ? "Nonvoyxonaga yuborilgan barcha zakazlaringiz va ularning holati" : "Do‘konlar tomonidan yuborilgan mahsulot zakazlari ro'yxati"}</p>
          </div>
          ${isStore ? `
            <button class="btn btn-primary" id="open-new-order-btn">
              <i class="fa-solid fa-plus"></i> Yangi zakaz
            </button>
          ` : ''}
        </div>

        <div class="filters-bar" style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end;">
          <div class="field" style="min-width:170px;">
            <label>Status bo'yicha</label>
            <select id="orders-status-filter">
              <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Barcha statuslar</option>
              <option value="pending" ${statusFilter === 'pending' ? 'selected' : ''}>Kutilmoqda (pending)</option>
              <option value="approved" ${statusFilter === 'approved' ? 'selected' : ''}>Tasdiqlandi (approved)</option>
              <option value="rejected" ${statusFilter === 'rejected' ? 'selected' : ''}>Rad etildi (rejected)</option>
              <option value="completed" ${statusFilter === 'completed' ? 'selected' : ''}>Bajarildi (completed)</option>
            </select>
          </div>

          ${isSuperAdmin && Object.keys(storeMap).length ? `
            <div class="field" style="min-width:180px;">
              <label>Do'kon bo'yicha</label>
              <select id="orders-store-filter">
                <option value="all" ${storeFilter === 'all' ? 'selected' : ''}>Barcha do'konlar</option>
                ${Object.entries(storeMap).map(([id, name]) => `
                  <option value="${id}" ${storeFilter === id ? 'selected' : ''}>${escapeHtml(name)}</option>
                `).join('')}
              </select>
            </div>
          ` : ''}

          <div class="field" style="flex:1; min-width:200px;">
            <label>Qidirish</label>
            <input type="text" id="orders-search-input" placeholder="Zakaz #, do'kon, mahsulot yoki izoh..." value="${escapeHtml(searchFilter)}" />
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Zakazlar ro'yxati (${fmtNum(pagination.total)})</h3>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width:60px;">#</th>
                  ${isSuperAdmin ? '<th>Do‘kon</th>' : ''}
                  <th>Sana</th>
                  <th>Mahsulotlar</th>
                  <th>Izoh</th>
                  <th>Status</th>
                  <th style="min-width:${isSuperAdmin ? '180px' : '90px'}; text-align:right;">Amallar</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length ? filtered.map(o => {
                  const storeName = o.store?.name || o.store_name || ('Do‘kon #' + (o.store_id || ''));
                  const createdDate = formatDateTime(o.created_at || o.createdAt);
                  const itemsSummary = formatOrderItemsSummary(o.items || o.order_items || o.OrderItems || []);

                  return `
                    <tr>
                      <td><strong>#${o.id}</strong></td>
                      ${isSuperAdmin ? `<td><strong>${escapeHtml(storeName)}</strong></td>` : ''}
                      <td class="muted" style="white-space:nowrap;">${createdDate}</td>
                      <td>${itemsSummary}</td>
                      <td class="muted" style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(o.note || '')}">
                        ${escapeHtml(o.note || '—')}
                      </td>
                      <td>${orderStatusBadge(o.status)}</td>
                      <td style="text-align:right; white-space:nowrap;">
                        <div style="display:inline-flex; align-items:center; gap:6px; justify-content:flex-end;">
                          ${isSuperAdmin ? `
                            ${o.status === 'pending' ? `
                              <button class="btn btn-primary btn-sm" data-approve-order="${o.id}" title="Zakazni tasdiqlash">
                                <i class="fa-solid fa-check"></i> Tasdiqlash
                              </button>
                            ` : (o.status === 'approved' ? `
                              <span class="badge badge-blue" style="font-size:11px; padding:5px 8px; display:inline-flex; align-items:center; gap:4px;" title="Zakaz allaqachon tasdiqlangan">
                                <i class="fa-solid fa-circle-check"></i> Tasdiqlangan
                              </span>
                            ` : (o.status === 'rejected' ? `
                              <button class="btn btn-secondary btn-sm" data-approve-order="${o.id}" title="Qayta tasdiqlash">
                                <i class="fa-solid fa-rotate-left"></i> Tasdiqlash
                              </button>
                            ` : ''))}
                          ` : ''}
                          <button class="btn btn-secondary btn-sm" data-view-order="${o.id}" title="Batafsil ko'rish">
                            <i class="fa-solid fa-eye"></i> Ko'rish
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr class="empty-row">
                    <td colspan="${isSuperAdmin ? 7 : 6}" style="text-align:center; padding:30px 10px;">
                      <i class="fa-solid fa-clipboard-list" style="font-size:32px; color:var(--color-border); margin-bottom:10px; display:block;"></i>
                      <div class="muted">${searchFilter || statusFilter !== 'all' || storeFilter !== 'all' ? "Qidiruv shartlariga mos keluvchi zakaz topilmadi" : "Hozircha hech qanday zakaz kiritilmagan"}</div>
                      ${isStore && !searchFilter && statusFilter === 'all' ? `
                        <button class="btn btn-primary btn-sm" id="empty-add-order-btn" style="margin-top:12px;">
                          <i class="fa-solid fa-plus"></i> Yangi zakaz yaratish
                        </button>
                      ` : ''}
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
          ${renderPaginationHtml(pagination, 'orders-pg')}
        </div>
      `;

      bindPaginationEvents(content, pagination, (newPage) => {
        page = newPage;
        loadData();
      }, 'orders-pg');

      const statusSelect = content.querySelector('#orders-status-filter');
      if (statusSelect) {
        statusSelect.onchange = (e) => {
          statusFilter = e.target.value;
          state.orderStatusFilter = statusFilter;
          page = 1;
          loadData();
        };
      }

      const storeSelect = content.querySelector('#orders-store-filter');
      if (storeSelect) {
        storeSelect.onchange = (e) => {
          storeFilter = e.target.value;
          state.orderStoreFilter = storeFilter;
          page = 1;
          loadData();
        };
      }

      const searchInput = content.querySelector('#orders-search-input');
      if (searchInput) {
        searchInput.oninput = (e) => {
          searchFilter = e.target.value;
          state.orderSearchFilter = searchFilter;
          page = 1;
          loadData();
        };
      }

      const newBtn = content.querySelector('#open-new-order-btn');
      if (newBtn) {
        newBtn.onclick = () => orderCreateModal(() => loadData());
      }
      const emptyNewBtn = content.querySelector('#empty-add-order-btn');
      if (emptyNewBtn) {
        emptyNewBtn.onclick = () => orderCreateModal(() => loadData());
      }

      if (isSuperAdmin) {
        content.querySelectorAll('[data-approve-order]').forEach(btn => {
          btn.onclick = async (e) => {
            e.stopPropagation();
            const orderId = btn.dataset.approveOrder;
            btn.disabled = true;
            const origHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
              await API.patch(`/orders/${orderId}/status`, {
                status: 'approved'
              });
              toast(`Zakaz #${orderId} muvaffaqiyatli tasdiqlandi`, 'success');
              await loadData();
            } catch (err) {
              toast(err.message || "Zakazni tasdiqlashda xatolik yuz berdi", 'error');
              btn.disabled = false;
              btn.innerHTML = origHtml;
            }
          };
        });
      }

      content.querySelectorAll('[data-view-order]').forEach(btn => {
        btn.onclick = () => {
          const orderId = btn.dataset.viewOrder;
          const ord = allOrders.find(x => String(x.id) === String(orderId));
          if (ord) {
            orderDetailModal(ord, () => loadData());
          }
        };
      });
    } catch (err) {
      content.innerHTML = `
        <div class="alert alert-warning" style="margin-top:20px;">
          <i class="fa-solid fa-triangle-exclamation"></i> Zakazlarni yuklashda xatolik: ${escapeHtml(err.message || 'Server xatosi')}
        </div>
      `;
    }
  }

  await loadData();
}

async function orderCreateModal(onSuccess) {
  let products = [];
  try {
    const bizId = effectiveBizId();
    products = await API.get('/products' + qs({ business_id: bizId, limit: 100 }));
    const checkList = Array.isArray(products) ? products : (products?.data || []);
    if (!checkList.length) {
      products = await API.get('/products?limit=100');
    }
  } catch (err) {
    try {
      products = await API.get('/products?limit=100');
    } catch (e) {
      toast("Mahsulotlar ro'yxatini yuklab bo'lmadi", 'danger');
      return;
    }
  }

  const prodList = Array.isArray(products) ? products : (products?.products || products?.data || []);
  const activeProducts = prodList.filter(p => p.active !== false);

  if (!activeProducts.length) {
    toast("Hozircha buyurtma uchun faol mahsulotlar mavjud emas", 'warning');
    return;
  }

  openModal("Yangi zakaz yaratish", `
    <form id="order-create-form">
      <div style="margin-bottom:14px;">
        <label style="font-weight:600; font-size:var(--text-sm); display:block; margin-bottom:6px;">Zakaz mahsulotlari</label>
        <div class="order-items-box">
          <div id="order-items-rows"></div>
          <button type="button" class="btn btn-secondary btn-sm" id="add-item-row-btn" style="margin-top:10px;">
            <i class="fa-solid fa-plus"></i> Mahsulot qo'shish
          </button>
        </div>
      </div>

      <div class="field span-2" style="margin-bottom:14px;">
        <label>Izoh / Note (ixtiyoriy)</label>
        <textarea id="f-order-note" rows="3" placeholder="Masalan: Ertalab soat 8:00 gacha kerak"></textarea>
      </div>

      <div id="order-form-error" class="form-error hidden" style="margin-bottom:14px;"></div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="order-cancel-btn">Bekor qilish</button>
        <button type="submit" class="btn btn-primary" id="order-submit-btn">
          <i class="fa-solid fa-paper-plane"></i> Zakazni yuborish
        </button>
      </div>
    </form>
  `, (m) => {
    const rowsContainer = m.querySelector('#order-items-rows');
    const addRowBtn = m.querySelector('#add-item-row-btn');
    const cancelBtn = m.querySelector('#order-cancel-btn');
    const form = m.querySelector('#order-create-form');
    const errorEl = m.querySelector('#order-form-error');
    const submitBtn = m.querySelector('#order-submit-btn');

    cancelBtn.onclick = () => m.remove();

    function createRow(selectedProdId = '', initialQty = 1) {
      const row = document.createElement('div');
      row.className = 'order-item-row';
      row.innerHTML = `
        <div class="field field-prod">
          <label>Mahsulot</label>
          <select class="item-product-select" required>
            <option value="">-- Mahsulotni tanlang --</option>
            ${activeProducts.map(p => `
              <option value="${p.id}" ${String(p.id) === String(selectedProdId) ? 'selected' : ''}>
                ${escapeHtml(p.name)} ${p.price ? `(${fmtMoney(p.price)})` : ''}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="field field-qty">
          <label>Miqdor (dona)</label>
          <input type="number" class="item-qty-input" min="1" step="1" value="${initialQty}" required />
        </div>
        <div class="field-remove">
          <button type="button" class="icon-btn remove-row-btn" title="O'chirish" style="color:var(--color-danger); margin-bottom:2px;">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;

      row.querySelector('.remove-row-btn').onclick = () => {
        if (rowsContainer.querySelectorAll('.order-item-row').length <= 1) {
          toast("Kamida bitta mahsulot bo'lishi shart", 'warning');
          return;
        }
        row.remove();
      };

      rowsContainer.appendChild(row);
    }

    createRow();

    addRowBtn.onclick = () => {
      createRow();
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      errorEl.classList.add('hidden');
      errorEl.textContent = '';

      const rows = rowsContainer.querySelectorAll('.order-item-row');
      if (!rows.length) {
        errorEl.textContent = "Kamida bitta mahsulot qo'shing";
        errorEl.classList.remove('hidden');
        return;
      }

      const items = [];
      const selectedProductIds = new Set();

      for (const r of rows) {
        const prodSelect = r.querySelector('.item-product-select');
        const qtyInput = r.querySelector('.item-qty-input');
        const prodId = Number(prodSelect.value);
        const qty = parseInt(qtyInput.value, 10);

        if (!prodId) {
          errorEl.textContent = "Barcha qatorlarda mahsulot tanlanishi kerak";
          errorEl.classList.remove('hidden');
          prodSelect.focus();
          return;
        }

        if (isNaN(qty) || qty <= 0) {
          errorEl.textContent = "Miqdor 0 dan katta butun son bo'lishi kerak";
          errorEl.classList.remove('hidden');
          qtyInput.focus();
          return;
        }

        if (selectedProductIds.has(prodId)) {
          errorEl.textContent = "Bir xil mahsulotni zakazga ikki marta qo'shish mumkin emas";
          errorEl.classList.remove('hidden');
          prodSelect.focus();
          return;
        }

        selectedProductIds.add(prodId);
        items.push({
          product_id: prodId,
          quantity: qty
        });
      }

      const note = m.querySelector('#f-order-note').value.trim();

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Yuborilmoqda...`;

      try {
        await API.post('/orders', {
          items,
          note: note || undefined
        });

        toast("Zakaz muvaffaqiyatli yuborildi!", 'success');
        m.remove();
        if (onSuccess) onSuccess();
      } catch (err) {
        errorEl.textContent = err.message || "Zakaz yuborishda xatolik yuz berdi";
        errorEl.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Zakazni yuborish`;
      }
    };
  });
}

function orderDetailModal(order, onUpdate) {
  const isSuperAdmin = state.user.role === 'super_admin';
  const items = order.items || order.order_items || order.OrderItems || [];
  const storeName = order.store?.name || order.store_name || ('Do‘kon #' + (order.store_id || ''));
  const storePhone = order.store?.phone || '';
  const storeAddress = order.store?.address || '';

  let totalAmount = 0;
  items.forEach(it => {
    const qty = it.quantity || it.qty || 0;
    const price = it.product?.price || it.price || 0;
    totalAmount += qty * price;
  });

  openModal(`Zakaz #${order.id}`, `
    <div class="order-details-grid">
      <div>
        <span class="muted" style="font-size:11.5px; display:block;">Do‘kon:</span>
        <strong>${escapeHtml(storeName)}</strong>
        ${storePhone ? `<div class="muted" style="font-size:12px;">Tel: ${escapeHtml(storePhone)}</div>` : ''}
        ${storeAddress ? `<div class="muted" style="font-size:12px;">${escapeHtml(storeAddress)}</div>` : ''}
      </div>
      <div>
        <span class="muted" style="font-size:11.5px; display:block;">Yaratilgan sana:</span>
        <div>${formatDateTime(order.created_at || order.createdAt)}</div>
        <div style="margin-top:6px;"><span class="muted" style="font-size:11.5px; margin-right:4px;">Holati:</span> ${orderStatusBadge(order.status)}</div>
      </div>
      <div style="grid-column: 1 / -1;">
        <span class="muted" style="font-size:11.5px; display:block;">Izoh / Note:</span>
        <div style="margin-top:2px;">${escapeHtml(order.note || 'Izoh qoldirilmagan')}</div>
      </div>
    </div>

    <h4 style="margin:16px 0 8px 0; font-size:var(--text-sm);">Buyurtma qilingan mahsulotlar</h4>
    <div class="table-wrap" style="margin-bottom:16px;">
      <table>
        <thead>
          <tr>
            <th>Mahsulot</th>
            <th class="text-right">Miqdor</th>
            <th class="text-right">Narxi</th>
            <th class="text-right">Jami summa</th>
          </tr>
        </thead>
        <tbody>
          ${items.length ? items.map(it => {
            const name = it.product?.name || it.product_name || it.name || ('Mahsulot #' + it.product_id);
            const qty = it.quantity || it.qty || 0;
            const price = it.product?.price || it.price || 0;
            const sum = qty * price;
            return `
              <tr>
                <td><strong>${escapeHtml(name)}</strong></td>
                <td class="text-right num">${fmtNum(qty)} dona</td>
                <td class="text-right num">${price ? fmtMoney(price) : '—'}</td>
                <td class="text-right num">${sum ? fmtMoney(sum) : '—'}</td>
              </tr>
            `;
          }).join('') : `<tr class="empty-row"><td colspan="4">Mahsulotlar ro'yxati bo'sh</td></tr>`}
        </tbody>
        ${totalAmount > 0 ? `
          <tfoot>
            <tr>
              <th colspan="3" style="text-align:right;">Umumiy summa:</th>
              <th class="text-right num">${fmtMoney(totalAmount)}</th>
            </tr>
          </tfoot>
        ` : ''}
      </table>
    </div>

    ${isSuperAdmin ? `
      <div style="background:var(--color-surface-muted); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:14px; margin-bottom:14px;">
        <label style="font-weight:600; font-size:var(--text-sm); display:block; margin-bottom:8px;">
          Zakaz statusini boshqarish
        </label>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          ${order.status === 'pending' ? `
            <button class="btn btn-primary" id="modal-quick-approve-btn" style="flex-shrink:0;">
              <i class="fa-solid fa-check"></i> Zakazni tasdiqlash
            </button>
          ` : ''}
          <select id="modal-order-status" style="flex:1; min-width:180px; height:38px;">
            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Kutilmoqda (pending)</option>
            <option value="approved" ${order.status === 'approved' ? 'selected' : ''}>Tasdiqlandi (approved)</option>
            <option value="rejected" ${order.status === 'rejected' ? 'selected' : ''}>Rad etildi (rejected)</option>
            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Bajarildi (completed)</option>
          </select>
          <button class="btn btn-secondary" id="save-status-btn">
            <i class="fa-solid fa-floppy-disk"></i> Statusni saqlash
          </button>
        </div>
      </div>
    ` : ''}

    <div class="form-actions">
      <button class="btn btn-secondary" id="modal-close-order-btn">Yopish</button>
    </div>
  `, (m) => {
    m.querySelector('#modal-close-order-btn').onclick = () => m.remove();

    if (isSuperAdmin) {
      const quickApproveBtn = m.querySelector('#modal-quick-approve-btn');
      if (quickApproveBtn) {
        quickApproveBtn.onclick = async () => {
          quickApproveBtn.disabled = true;
          quickApproveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Tasdiqlanmoqda...`;
          try {
            await API.patch(`/orders/${order.id}/status`, { status: 'approved' });
            toast(`Zakaz #${order.id} muvaffaqiyatli tasdiqlandi`, 'success');
            m.remove();
            if (onUpdate) onUpdate();
          } catch (err) {
            toast(err.message || "Zakazni tasdiqlashda xatolik", 'error');
            quickApproveBtn.disabled = false;
            quickApproveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Zakazni tasdiqlash`;
          }
        };
      }

      const saveBtn = m.querySelector('#save-status-btn');
      const statusSelect = m.querySelector('#modal-order-status');

      saveBtn.onclick = async () => {
        const newStatus = statusSelect.value;
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...`;

        try {
          await API.patch(`/orders/${order.id}/status`, {
            status: newStatus
          });
          toast("Zakaz statusi muvaffaqiyatli o'zgartirildi", 'success');
          m.remove();
          if (onUpdate) onUpdate();
        } catch (err) {
          toast(err.message || "Statusni o'zgartirishda xatolik", 'error');
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Statusni saqlash`;
        }
      };
    }
  });
}

async function openOrderDetailsById(orderId) {
  try {
    let order = null;
    try {
      order = await API.get(`/orders/${orderId}`);
    } catch (e) {
      const all = await API.get('/orders?limit=100');
      const list = Array.isArray(all) ? all : (all?.orders || all?.data || []);
      order = list.find(o => String(o.id) === String(orderId));
    }
    if (order) {
      orderDetailModal(order, () => {
        if (location.hash === '#/orders') render();
      });
    } else {
      toast("Zakaz topilmadi", 'warning');
    }
  } catch (err) {
    toast(err.message || "Zakaz ma'lumotlarini yuklab bo'lmadi", 'danger');
  }
}

/* ===================== YETKAZIB BERISH (DELIVERY / DOSTAVKACHI) ===================== */
let deliveryPollTimer = null;

function stopDeliveryPolling() {
  if (deliveryPollTimer) {
    clearInterval(deliveryPollTimer);
    deliveryPollTimer = null;
  }
}

function getItemDeliveryStats(item) {
  let delivered = 0;
  let deliveryDate = null;

  // Backend Prisma: item.delivery = { id, quantity, cash_amount, credit_amount, delivered_at }
  if (item.delivery && typeof item.delivery.quantity === 'number') {
    delivered = Number(item.delivery.quantity) || 0;
    deliveryDate = item.delivery.delivered_at || item.delivery.created_at;
  } else if (typeof item.delivered_quantity === 'number') {
    delivered = Number(item.delivered_quantity) || 0;
  } else if (typeof item.delivered_qty === 'number') {
    delivered = Number(item.delivered_qty) || 0;
  } else if (typeof item.delivered === 'number') {
    delivered = Number(item.delivered) || 0;
  } else if (Array.isArray(item.deliveries) && item.deliveries.length) {
    delivered = item.deliveries.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
    deliveryDate = item.deliveries[0]?.delivered_at || item.deliveries[0]?.created_at || item.deliveries[0]?.createdAt;
  }

  if (!deliveryDate) {
    deliveryDate = item.delivery_date || item.delivered_at || item.updated_at || item.updatedAt;
  }

  const ordered = Number(item.quantity) || 0;
  const remaining = Math.max(0, ordered - delivered);
  const isDelivered = (item.delivery !== undefined && item.delivery !== null) || (delivered >= ordered && ordered > 0);

  return {
    ordered,
    delivered,
    remaining,
    isDelivered,
    deliveryDate,
    cashAmount: item.delivery?.cash_amount || 0,
    creditAmount: item.delivery?.credit_amount || 0
  };
}

async function renderDeliveryDashboard(content, currentTab = 'active') {
  // Xavfsizlik: faqat delivery yoki dostavkachi roli uchun
  if (!isDeliveryUser()) {
    location.hash = '#/dashboard';
    return;
  }

  content.innerHTML = `
    <div style="padding: 40px 0; text-align: center; color: var(--color-text-muted);">
      <div style="font-size: 28px; margin-bottom: 12px; color: var(--color-primary);"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
      <div>Zakazlar yuklanmoqda...</div>
    </div>
  `;

  let activeTab = currentTab === 'history' ? 'history' : 'active';
  let searchQuery = '';
  let selectedStatus = activeTab === 'history' ? 'completed' : 'approved';
  let counts = { approved: null, completed: null };
  let ordersList = [];
  let page = 1;
  const limit = 10;
  let currentPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };

  async function loadData(isBackground = false) {
    try {
      // Driverdan doim status=approved yoki status=completed bo'lib ketadi
      const currentStatus = (selectedStatus === 'completed' || activeTab === 'history') ? 'completed' : 'approved';
      selectedStatus = currentStatus;
      const endpoint = `/deliveries/orders?status=${encodeURIComponent(currentStatus)}&page=${page}&limit=${limit}`;
      
      const res = await API.get(endpoint, { bypassCache: true });
      const { items, pagination } = extractListData(res, page, limit);
      
      // Driver uchun faqat approved va completed zakazlar
      ordersList = items.filter(o => o && o.status === currentStatus);
      currentPagination = pagination;
      counts[currentStatus] = pagination.total;
      renderUI();
    } catch (err) {
      if (!isBackground) {
        content.innerHTML = `
          <div class="alert alert-warning" style="margin-top:20px;">
            <i class="fa-solid fa-triangle-exclamation"></i> Zakazlarni yuklashda xatolik: ${escapeHtml(err.message || 'Server xatosi')}
          </div>
        `;
      }
    }
  }

  function renderUI() {
    let totalRemainingQty = 0;
    let totalDeliveredQty = 0;

    ordersList.forEach(order => {
      const items = order.items || order.order_items || order.OrderItems || [];
      const isDone = order.status === 'completed';

      items.forEach(it => {
        const stats = getItemDeliveryStats(it);
        if (isDone) {
          totalDeliveredQty += (stats.delivered || stats.ordered);
        } else {
          totalRemainingQty += stats.remaining;
          totalDeliveredQty += stats.delivered;
        }
      });
    });

    // Tartiblash (sana bo'yicha eng yangisi birinchi)
    ordersList.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));

    // Qidiruv bo'yicha filtrlash
    const filteredOrders = ordersList.filter(o => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const storeName = (o.store?.name || o.store_name || '').toLowerCase();
      const storeAddr = (o.store?.address || o.store_address || '').toLowerCase();
      const storePhone = (o.store?.phone || o.store_phone || '').toLowerCase();
      const note = (o.note || '').toLowerCase();
      const idStr = String(o.id);
      return storeName.includes(q) || storeAddr.includes(q) || storePhone.includes(q) || note.includes(q) || idStr.includes(q);
    });

    const activeBadge = counts.approved !== null ? counts.approved : (activeTab === 'active' ? currentPagination.total : '');
    const historyBadge = counts.completed !== null ? counts.completed : (activeTab === 'history' ? currentPagination.total : '');

    content.innerHTML = `
      <!-- Quick Summary Stat Cards -->
      <div class="grid grid-3" style="margin-bottom:20px;">
        ${statCard('<i class="fa-solid fa-truck-ramp-box"></i>', activeTab === 'active' ? 'Tasdiqlangan zakazlar' : 'Yetkazilgan zakazlar', fmtNum(currentPagination.total) + ' ta', '', activeTab === 'active' ? 'blue' : 'green')}
        ${statCard('<i class="fa-solid fa-bread-slice"></i>', 'Yetkazilishi kerak', fmtNum(totalRemainingQty) + ' dona', '', 'amber')}
        ${statCard('<i class="fa-solid fa-circle-check"></i>', 'Yetkazilgan nonlar', fmtNum(totalDeliveredQty) + ' dona', '', 'green')}
      </div>

      <!-- Navigation Tabs, Status Filter & Search -->
      <div class="card" style="margin-bottom:20px; padding:14px 18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div class="delivery-tabs-wrap" style="margin-bottom:0; border-bottom:none; padding-bottom:0;">
            <button class="delivery-tab-btn ${activeTab === 'active' ? 'active' : ''}" id="tab-active-btn">
              <i class="fa-solid fa-truck-fast"></i>
              Tasdiqlangan zakazlar
              ${activeBadge !== '' ? `<span class="delivery-tab-badge">${activeBadge}</span>` : ''}
            </button>
            <button class="delivery-tab-btn ${activeTab === 'history' ? 'active' : ''}" id="tab-history-btn">
              <i class="fa-solid fa-clock-rotate-left"></i>
              Yetkazilganlar
              ${historyBadge !== '' ? `<span class="delivery-tab-badge">${historyBadge}</span>` : ''}
            </button>
          </div>

          <div style="display:flex; align-items:center; gap:8px; min-width:280px; flex:1; max-width:520px;">
            <select id="delivery-status-filter" style="height:38px; padding:0 8px; font-size:var(--text-xs); border-radius:var(--radius-md); border:1px solid var(--color-border); background:var(--color-surface-2); color:var(--color-text); cursor:pointer;" title="Status bo'yicha filterlash">
              <option value="approved" ${selectedStatus === 'approved' ? 'selected' : ''}>Tasdiqlangan (approved)</option>
              <option value="completed" ${selectedStatus === 'completed' ? 'selected' : ''}>Bajarilgan (completed)</option>
            </select>
            <input type="text" id="delivery-search-input" placeholder="Do'kon, manzil yoki zakaz # bo'yicha..." value="${escapeHtml(searchQuery)}" style="height:38px; flex:1;" />
            <button class="icon-btn" id="delivery-manual-refresh-btn" title="Yangilash" style="height:38px; width:38px; flex-shrink:0;">
              <i class="fa-solid fa-rotate"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Orders List Container -->
      <div id="delivery-orders-list">
        ${filteredOrders.length ? filteredOrders.map(order => renderDeliveryOrderCard(order)).join('') : `
          <div class="delivery-empty-state">
            <div class="delivery-empty-icon">
              <i class="fa-solid ${activeTab === 'active' ? 'fa-truck-ramp-box' : 'fa-clipboard-check'}"></i>
            </div>
            <h3 style="margin:0 0 6px 0; color:var(--color-text);">
              ${activeTab === 'active' ? "Hozircha tasdiqlangan zakazlar mavjud emas" : "Hozircha yetkazilgan zakazlar mavjud emas"}
            </h3>
            <p style="margin:0; font-size:var(--text-xs); color:var(--color-text-muted);">
              ${activeTab === 'active' ? "Nonvoyxona admini tomonidan tasdiqlangan yangi zakazlar bu yerda avtomatik paydo bo'ladi." : "Yetkazib berilgan barcha zakazlar tarixi shu yerda saqlanadi."}
            </p>
          </div>
        `}
      </div>
      ${renderPaginationHtml(currentPagination, 'deliv-pg')}
    `;

    bindPaginationEvents(content, currentPagination, (newPage) => {
      page = newPage;
      loadData();
    }, 'deliv-pg');

    // Hodisalarni ulash
    const refreshBtn = content.querySelector('#delivery-manual-refresh-btn');
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        refreshBtn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i>';
        await loadData();
        toast("Zakazlar yangilandi", 'info');
      };
    }

    const logoutBtn = content.querySelector('#delivery-header-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = () => onLogout();
    }

    const statusSelect = content.querySelector('#delivery-status-filter');
    if (statusSelect) {
      statusSelect.onchange = async () => {
        selectedStatus = statusSelect.value === 'completed' ? 'completed' : 'approved';
        activeTab = selectedStatus === 'completed' ? 'history' : 'active';
        page = 1;
        if (activeTab === 'history') {
          location.hash = '#/delivery/history';
        } else {
          location.hash = '#/dashboard';
        }
        await loadData();
      };
    }

    const tabActive = content.querySelector('#tab-active-btn');
    const tabHist = content.querySelector('#tab-history-btn');
    if (tabActive) {
      tabActive.onclick = async () => {
        if (activeTab === 'active' && selectedStatus === 'approved') return;
        activeTab = 'active';
        selectedStatus = 'approved';
        page = 1;
        location.hash = '#/dashboard';
        await loadData();
      };
    }
    if (tabHist) {
      tabHist.onclick = async () => {
        if (activeTab === 'history' && selectedStatus === 'completed') return;
        activeTab = 'history';
        selectedStatus = 'completed';
        page = 1;
        location.hash = '#/delivery/history';
        await loadData();
      };
    }

    const searchInp = content.querySelector('#delivery-search-input');
    if (searchInp) {
      searchInp.oninput = (e) => {
        searchQuery = e.target.value;
        renderUI();
      };
    }

    // Har bir mahsulot uchun zakaz topshirish formasi
    content.querySelectorAll('.delivery-item-form').forEach(form => {
      const orderId = form.dataset.orderId;
      const itemId = form.dataset.itemId;
      const unitPrice = Number(form.dataset.unitPrice) || 0;
      const maxQty = Number(form.dataset.maxQty) || 0;

      const qtyInput = form.querySelector('.delivery-qty-input');
      const totalInput = form.querySelector('.delivery-total-input');
      const cashInput = form.querySelector('.delivery-cash-input');
      const creditInput = form.querySelector('.delivery-credit-input');
      const submitBtn = form.querySelector('.delivery-confirm-btn');

      if (!qtyInput || !totalInput || !cashInput || !creditInput || !submitBtn) return;

      // Miqdor o‘zgarganda jami summa avtomatik yangilansin: quantity × product.unit_price
      qtyInput.oninput = () => {
        if (/^0[0-9]+/.test(qtyInput.value)) {
          qtyInput.value = qtyInput.value.replace(/^0+/, '');
        }
        const qty = parseInt(qtyInput.value, 10) || 0;
        const total = Math.max(0, qty * unitPrice);
        totalInput.value = fmtMoney(total) + " so‘m";
        totalInput.dataset.rawTotal = total;

        const currentCash = parseFloat(cashInput.value) || 0;
        if (currentCash > 0 && currentCash <= total) {
          creditInput.value = Math.max(0, total - currentCash);
        } else {
          creditInput.value = total;
          cashInput.value = '';
        }
      };

      // Naqd summa o‘zgarganda nasiyani avtomatik hisoblash
      cashInput.oninput = () => {
        if (/^0[0-9]+/.test(cashInput.value)) {
          cashInput.value = cashInput.value.replace(/^0+/, '');
        }
        const qty = parseInt(qtyInput.value, 10) || 0;
        const total = Math.max(0, qty * unitPrice);
        const cash = parseFloat(cashInput.value) || 0;
        creditInput.value = Math.max(0, total - cash);
      };

      // Nasiya summa o‘zgarganda naqdni avtomatik hisoblash
      creditInput.oninput = () => {
        if (/^0[0-9]+/.test(creditInput.value)) {
          creditInput.value = creditInput.value.replace(/^0+/, '');
        }
        const qty = parseInt(qtyInput.value, 10) || 0;
        const total = Math.max(0, qty * unitPrice);
        const credit = parseFloat(creditInput.value) || 0;
        cashInput.value = Math.max(0, total - credit);
      };

      // Form topshirish (Tasdiqlash)
      form.onsubmit = async (e) => {
        e.preventDefault();

        const qty = parseInt(qtyInput.value, 10);
        const cash = parseFloat(cashInput.value);
        const credit = parseFloat(creditInput.value);

        // 1. quantity musbat butun son bo‘lsin
        if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
          toast("Iltimos, berilgan miqdorni musbat butun son sifatida kiriting", 'warning');
          qtyInput.focus();
          return;
        }

        if (qty > maxQty) {
          toast(`Berilgan miqdor qolgan zakaz miqdoridan (${maxQty} dona) oshmasligi kerak`, 'warning');
          qtyInput.focus();
          return;
        }

        // 2. cash_amount 0 yoki undan katta bo‘lsin
        if (isNaN(cash) || cash < 0) {
          toast("Naqd summa 0 yoki undan katta bo‘lishi kerak", 'warning');
          cashInput.focus();
          return;
        }

        // 3. credit_amount 0 yoki undan katta bo‘lsin
        if (isNaN(credit) || credit < 0) {
          toast("Nasiya summa 0 yoki undan katta bo‘lishi kerak", 'warning');
          creditInput.focus();
          return;
        }

        // 4. cash_amount + credit_amount = quantity × unit_price
        const total = qty * unitPrice;
        if (Math.abs(cash + credit - total) > 0.01) {
          toast("Naqd va nasiya summasi jami qiymatga teng bo‘lishi kerak.", 'warning');
          return;
        }

        submitBtn.disabled = true;
        qtyInput.disabled = true;
        cashInput.disabled = true;
        creditInput.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...`;

        try {
          await API.post(`/deliveries/orders/${orderId}/items/${itemId}`, {
            quantity: qty,
            cash_amount: cash,
            credit_amount: credit
          });

          toast("Delivery muvaffaqiyatli saqlandi", 'success');
          // Ma'lumotlarni qayta yuklab UI ni to'liq yangilaymiz
          await loadData(true);
        } catch (err) {
          toast(err.message || "Deliveryni saqlashda xatolik yuz berdi", 'error');
          submitBtn.disabled = false;
          qtyInput.disabled = false;
          cashInput.disabled = false;
          creditInput.disabled = false;
          submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Tasdiqlash`;
        }
      };
    });
  }

  function renderDeliveryOrderCard(order) {
    const store = order.store || {};
    const storeName = store.name || order.store_name || ('Do‘kon #' + (order.store_id || ''));
    const storeAddress = store.address || order.store_address || 'Manzil ko‘rsatilmagan';
    const storePhone = store.phone || order.store_phone || '';
    const createdDate = formatDateTime(order.created_at || order.createdAt);
    const items = order.items || order.order_items || order.OrderItems || [];
    const isOrderDone = order.status === 'completed';

    let statusBadge = '';
    if (order.status === 'completed') {
      statusBadge = `<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Bajarilgan (completed)</span>`;
    } else if (order.status === 'approved') {
      statusBadge = `<span class="badge badge-blue"><i class="fa-solid fa-truck-fast"></i> Tasdiqlangan (approved)</span>`;
    } else {
      statusBadge = `<span class="badge badge-gray">${escapeHtml(order.status || '')}</span>`;
    }

    return `
      <div class="delivery-card" id="delivery-order-${order.id}">
        <div class="delivery-card-top">
          <div class="delivery-card-title">
            <span class="delivery-order-tag">
              <i class="fa-solid fa-receipt"></i> Zakaz #${order.id}
            </span>
            ${statusBadge}
          </div>
          <div class="muted" style="font-size:var(--text-xs); display:flex; align-items:center; gap:5px;">
            <i class="fa-regular fa-clock"></i> ${createdDate}
          </div>
        </div>

        <div class="delivery-store-box">
          <div>
            <div class="delivery-store-name">
              <i class="fa-solid fa-store" style="color:var(--color-primary);"></i>
              ${escapeHtml(storeName)}
            </div>
            <div class="delivery-store-address">
              <i class="fa-solid fa-location-dot" style="color:var(--color-danger);"></i>
              ${escapeHtml(storeAddress)}
            </div>
          </div>
          ${storePhone ? `
            <a href="tel:${escapeHtml(storePhone)}" class="delivery-call-btn" title="Do'konga qo'ng'iroq qilish">
              <i class="fa-solid fa-phone"></i>
              <span>${escapeHtml(storePhone)}</span>
            </a>
          ` : ''}
        </div>

        ${order.note ? `
          <div class="delivery-note-box">
            <i class="fa-solid fa-comment-dots" style="color:var(--color-primary); margin-top:2px;"></i>
            <div><strong>Do‘kon izohi:</strong> ${escapeHtml(order.note)}</div>
          </div>
        ` : ''}

        <div class="delivery-items-title">
          <i class="fa-solid fa-boxes-stacked"></i> Yetkazib beriladigan mahsulotlar
        </div>

        <div class="delivery-items-list">
          ${items.map(item => {
            const prodName = item.product?.name || item.product_name || item.name || ('Mahsulot #' + item.product_id);
            const unitPrice = Number(item.unit_price) || Number(item.product?.price) || 0;
            const stats = getItemDeliveryStats(item);
            const isItemDelivered = isOrderDone || stats.isDelivered;
            const initialQty = stats.remaining;
            const initialTotal = initialQty * unitPrice;

            return `
              <div class="delivery-item-card ${isItemDelivered ? 'is-delivered' : ''}">
                <div class="delivery-item-main">
                  <div class="delivery-item-name">
                    <i class="fa-solid fa-bread-slice" style="color:var(--color-primary); margin-right:6px;"></i>
                    ${escapeHtml(prodName)}
                    ${unitPrice > 0 ? `<span style="font-size:12px; color:var(--color-text-muted); font-weight:normal; margin-left:6px;">(${fmtMoney(unitPrice)} so‘m/dona)</span>` : ''}
                  </div>
                  <div class="delivery-item-stats">
                    <span>Zakaz: <strong>${fmtNum(stats.ordered)} dona</strong></span>
                    ${!isItemDelivered ? `
                      <span>Qolgan: <strong style="color:var(--color-primary);">${fmtNum(stats.remaining)} dona</strong></span>
                    ` : `
                      <span>Berilgan: <strong style="color:var(--color-green);">${fmtNum(stats.delivered || stats.ordered)} dona</strong></span>
                    `}
                  </div>
                </div>

                ${isItemDelivered ? `
                  <div class="delivery-completed-panel">
                    <div class="delivery-completed-badge">
                      <i class="fa-solid fa-circle-check"></i>
                      <span>Yetkazildi: <strong>${fmtNum(stats.delivered || stats.ordered)} dona</strong></span>
                      ${stats.deliveryDate ? `<small style="opacity:0.85; margin-left:6px;">(${formatDateTime(stats.deliveryDate)})</small>` : ''}
                    </div>

                    <div class="delivery-finance-chips">
                      <span class="chip-cash" title="Naqd summa"><i class="fa-solid fa-money-bill-wave"></i> Naqd: <strong>${fmtMoney(stats.cashAmount || 0)} so‘m</strong></span>
                      <span class="chip-credit" title="Nasiya summa"><i class="fa-solid fa-file-invoice-dollar"></i> Nasiya: <strong>${fmtMoney(stats.creditAmount != null ? stats.creditAmount : Math.max(0, (stats.delivered || stats.ordered) * unitPrice - (stats.cashAmount || 0)))} so‘m</strong></span>
                      <span class="chip-total" title="Jami summa"><i class="fa-solid fa-calculator"></i> Jami: <strong>${fmtMoney((stats.delivered || stats.ordered) * unitPrice)} so‘m</strong></span>
                    </div>
                  </div>
                ` : `
                  <div class="delivery-form-container">
                    <form class="delivery-item-form" data-order-id="${order.id}" data-item-id="${item.id}" data-unit-price="${unitPrice}" data-max-qty="${stats.remaining}">
                      <div class="delivery-form-grid">
                        <div class="delivery-form-field">
                          <label>Berilgan miqdor</label>
                          <input type="number" class="delivery-qty-input" min="1" max="${stats.remaining}" value="${stats.remaining}" step="1" required placeholder="Miqdor" />
                        </div>

                        <div class="delivery-form-field">
                          <label>Jami summa</label>
                          <input type="text" class="delivery-total-input" readonly value="${fmtMoney(initialTotal)} so‘m" data-raw-total="${initialTotal}" title="quantity × unit_price" />
                        </div>

                        <div class="delivery-form-field">
                          <label>Naqd summa</label>
                          <input type="number" class="delivery-cash-input" min="0" step="100" placeholder="0" />
                        </div>

                        <div class="delivery-form-field">
                          <label>Nasiya summa</label>
                          <input type="number" class="delivery-credit-input" min="0" step="100" value="${initialTotal}" placeholder="0" />
                        </div>

                        <div class="delivery-form-actions">
                          <button type="submit" class="btn btn-primary delivery-confirm-btn">
                            <i class="fa-solid fa-check"></i> Tasdiqlash
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Dastlabki yuklash
  await loadData();

  // 25 soniyali polling boshlash
  stopDeliveryPolling();
  deliveryPollTimer = setInterval(() => {
    if (isDeliveryUser() && (location.hash === '#/dashboard' || location.hash.startsWith('#/delivery'))) {
      loadData(true);
    } else {
      stopDeliveryPolling();
    }
  }, 25000);
}

/* ===================== SECTION 22: HAYDOVCHILAR BOSHQARUVI ===================== */
async function renderDrivers(content) {
  const isSuperAdmin = state.user?.role === 'super_admin';
  const isBakeryAdmin = state.user?.role === 'bakery_admin';

  if (!isSuperAdmin && !isBakeryAdmin) {
    location.hash = '#/dashboard';
    return;
  }

  const bizId = effectiveBizId();
  const bizParam = bizId ? `?business_id=${bizId}&limit=100` : '?limit=100';

  let page = 1;
  const limit = 10;
  let searchQuery = '';

  // Parallel yuklash
  const [assignmentsRes, usersRes, businessesRes] = await Promise.all([
    API.get('/delivery-assignments' + bizParam).catch(() => []),
    API.get('/users?limit=100').catch(() => []),
    (state.businesses?.length ? state.businesses : API.get('/businesses?limit=100')).catch?.(() => []) || state.businesses || []
  ]);

  // Kelgan API javobidan data ichidagi ma'lumotlarni xavfsiz ajratib olish (filter/map uchun tayyorlash)
  const extractDataArray = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.items)) return res.items;
    if (Array.isArray(res.users)) return res.users;
    if (Array.isArray(res.assignments)) return res.assignments;
    if (Array.isArray(res.businesses)) return res.businesses;
    return [];
  };

  const assignments = extractDataArray(assignmentsRes);
  const allUsers = extractDataArray(usersRes);
  const businesses = extractDataArray(businessesRes);

  const bizName = (id) => businesses.find(b => String(b.id) === String(id))?.name || (id ? `Nonvoyxona #${id}` : '—');

  // 1. Haydovchilarni filtrlash (role: delivery, dostavkachi, driver)
  let drivers = allUsers.filter(u => {
    const role = (u.role || '').toLowerCase();
    const isDriverRole = role === 'delivery' || role === 'dostavkachi' || role === 'driver';
    if (!isDriverRole) return false;
    if (bizId) {
      const matchesBiz = String(u.business_id) === String(bizId);
      const hasAssignmentInBiz = assignments.some(a => 
        Number(a.delivery_user_id || a.delivery_user?.id) === Number(u.id) && 
        String(a.business_id) === String(bizId)
      );
      return matchesBiz || hasAssignmentInBiz;
    }
    return true;
  });

  // 2. Biriktiruvlarda (assignments) bor, lekin users ro'yxatida bo'lmasligi mumkin bo'lgan haydovchilarni qo'shish
  assignments.forEach(a => {
    const deliveryUser = a.delivery_user;
    const deliveryUserId = Number(a.delivery_user_id || deliveryUser?.id);
    if (!deliveryUserId) return;

    if (!drivers.some(d => Number(d.id) === deliveryUserId)) {
      if (!bizId || String(a.business_id) === String(bizId)) {
        drivers.push({
          id: deliveryUserId,
          username: deliveryUser?.username || `driver_${deliveryUserId}`,
          full_name: deliveryUser?.full_name || deliveryUser?.username || `Haydovchi #${deliveryUserId}`,
          role: deliveryUser?.role || 'delivery',
          business_id: a.business_id || deliveryUser?.business_id,
          phone: deliveryUser?.phone || '',
          active: deliveryUser?.active !== undefined ? deliveryUser.active : 1
        });
      }
    }
  });

  // 3. Haydovchilar takrorlanmasligi uchun unikal qilib filtrlash
  const uniqueDriversMap = new Map();
  drivers.forEach(d => {
    if (d && d.id && !uniqueDriversMap.has(Number(d.id))) {
      uniqueDriversMap.set(Number(d.id), d);
    }
  });
  drivers = Array.from(uniqueDriversMap.values());

  // 4. Haydovchilar bo'yicha ma'lumotlarni map qilish (biriktiruvlar, do'konlar va nonvoyxona bilan boyitish)
  const allDriverDataList = drivers.map(driver => {
    const driverAssignments = assignments.filter(a => Number(a.delivery_user_id || a.delivery_user?.id) === Number(driver.id));
    
    // Nonvoyxonalar bo'yicha guruhlash
    const bizGroups = {};
    driverAssignments.forEach(a => {
      const bId = Number(a.business_id || a.business?.id);
      if (!bId) return;
      if (!bizGroups[bId]) {
        bizGroups[bId] = {
          bizId: bId,
          bizName: a.business?.name || bizName(bId),
          hasAllStores: false,
          allStoresAssignmentId: null,
          stores: []
        };
      }
      if (a.store_id === null || a.store_id === undefined || a.all_stores === true || a.all_stores === 1 || !a.store) {
        bizGroups[bId].hasAllStores = true;
        bizGroups[bId].allStoresAssignmentId = a.id;
      } else {
        bizGroups[bId].stores.push(a);
      }
    });

    const assignedBizIds = Object.keys(bizGroups).map(Number);
    if (assignedBizIds.length === 0 && driver.business_id) {
      assignedBizIds.push(Number(driver.business_id));
    }

    const totalBizCount = businesses.length;
    const isAllBiz = totalBizCount > 0 && businesses.every(b => assignedBizIds.includes(Number(b.id)));
    const isAllStoresEverywhere = isAllBiz && businesses.every(b => bizGroups[b.id]?.hasAllStores);
    const hasAnyAllStores = Object.values(bizGroups).some(g => g.hasAllStores);
    const assignedBizName = driver.business_name || bizName(driver.business_id) || driverAssignments[0]?.business?.name || '—';

    return {
      driver,
      assignments: driverAssignments,
      bizGroups,
      assignedBizIds,
      isAllBiz,
      isAllStoresEverywhere,
      hasAllStores: hasAnyAllStores || isAllStoresEverywhere,
      specificStores: driverAssignments.filter(a => a.store_id !== null && a.store_id !== undefined && !a.all_stores),
      assignedBizName
    };
  });

  // Statistika
  const totalDrivers = allDriverDataList.length;
  const assignedDriversCount = allDriverDataList.filter(d => d.assignments.length > 0).length;
  const allStoresCount = allDriverDataList.filter(d => d.hasAllStores || d.isAllStoresEverywhere).length;

  content.innerHTML = `
    <div class="section-head" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div>
        <h2>Haydovchilar boshqaruvi</h2>
        <p>Dostavkachilar ro‘yxati, barcha nonvoyxona va do‘konlarga biriktiruvlar nazorati</p>
      </div>
      <div class="drivers-head-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-outline" id="assign-driver-top-btn" title="Haydovchini nonvoyxona va do‘konlarga biriktirish">
          <i class="fa-solid fa-link"></i> Haydovchini biriktirish
        </button>
        ${isSuperAdmin ? `
          <button class="btn btn-primary" id="add-driver-btn">
            <i class="fa-solid fa-user-plus"></i> Yangi haydovchi
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Statistika kartalari -->
    <div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 20px;">
      <div class="stat-card">
        <div class="stat-label"><i class="fa-solid fa-id-card"></i> Jami haydovchilar</div>
        <div class="stat-value" id="stat-total-drivers">${totalDrivers}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label"><i class="fa-solid fa-link"></i> Biriktirilganlar</div>
        <div class="stat-value" style="color:var(--color-green);">${assignedDriversCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label"><i class="fa-solid fa-layer-group"></i> Barcha do‘konlar qamrovi</div>
        <div class="stat-value" style="color:#2563eb;">${allStoresCount}</div>
      </div>
    </div>

    <!-- Asosiy jadval kartasi -->
    <div class="card">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <h3>Haydovchilar ro‘yxati (<span id="drivers-count-badge">${totalDrivers}</span>)</h3>
        <div style="min-width: 240px;">
          <input type="search" id="drivers-search-input" placeholder="Ism, login, nonvoyxona yoki do'kon..." style="width:100%; padding:6px 12px; font-size:var(--text-xs); border-radius:var(--radius-md); border:1px solid var(--color-border); background:var(--color-surface-2);" />
        </div>
      </div>

      <div class="table-wrap">
        <table id="drivers-table">
          <thead>
            <tr>
              <th>Haydovchi</th>
              <th>Login</th>
              <th>Telefon / Ma'lumot</th>
              <th>Biriktirilgan nonvoyxona</th>
              <th>Biriktirilgan do‘konlar</th>
              <th>Holati</th>
              <th style="text-align:right;">Amallar</th>
            </tr>
          </thead>
          <tbody id="drivers-tbody">
          </tbody>
        </table>
      </div>
      <div id="drivers-pagination-container"></div>
    </div>
  `;

  function getFilteredData() {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allDriverDataList;
    return allDriverDataList.filter(item => {
      const name = (item.driver.full_name || '').toLowerCase();
      const uname = (item.driver.username || '').toLowerCase();
      const bizNames = Object.values(item.bizGroups).map(g => g.bizName.toLowerCase()).join(' ') + ' ' + (item.assignedBizName || '').toLowerCase();
      const storeNames = item.assignments.map(a => (a.store?.name || '').toLowerCase()).join(' ');
      return name.includes(q) || uname.includes(q) || bizNames.includes(q) || storeNames.includes(q);
    });
  }

  function renderCurrentPage() {
    const filtered = getFilteredData();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    if (page > totalPages) page = totalPages;

    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    const tbody = content.querySelector('#drivers-tbody');
    const badge = content.querySelector('#drivers-count-badge');
    const paginationBox = content.querySelector('#drivers-pagination-container');

    if (badge) badge.textContent = total;
    if (tbody) tbody.innerHTML = renderDriversRows(paginated, isSuperAdmin);

    const paginationMeta = {
      page,
      limit,
      total,
      totalPages
    };

    if (paginationBox) {
      paginationBox.innerHTML = renderPaginationHtml(paginationMeta, 'drivers');
      bindPaginationEvents(paginationBox, paginationMeta, (newPage) => {
        page = newPage;
        renderCurrentPage();
      }, 'drivers');
    }

    bindDriverActions(content, allDriverDataList, businesses, isSuperAdmin);
  }

  renderCurrentPage();

  // Qidiruv filtri
  const searchInput = content.querySelector('#drivers-search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      searchQuery = e.target.value;
      page = 1;
      renderCurrentPage();
    };
  }

  // Haydovchini biriktirish tugmasi
  const assignTopBtn = content.querySelector('#assign-driver-top-btn');
  if (assignTopBtn) {
    assignTopBtn.onclick = () => addStoreToDriverModal(null, businesses, allDriverDataList);
  }

  // Yangi haydovchi tugmasi (faqat super_admin)
  const addBtn = content.querySelector('#add-driver-btn');
  if (addBtn && isSuperAdmin) {
    addBtn.onclick = () => driverFormModal(bizId, businesses);
  }
}

function renderDriversRows(driverDataList, isSuperAdmin = false) {
  if (!driverDataList.length) {
    return `<tr class="empty-row"><td colspan="7" style="text-align:center; padding:32px 16px; color:var(--color-text-muted);">
      <i class="fa-solid fa-id-card" style="font-size:28px; opacity:0.5; margin-bottom:8px; display:block;"></i>
      Haydovchilar mavjud emas
    </td></tr>`;
  }

  return driverDataList.map(({ driver, assignments, bizGroups, isAllBiz, isAllStoresEverywhere, assignedBizName }) => {
    const initials = (driver.full_name || driver.username || 'H')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');

    // Nonvoyxona ustuni
    let bizHtml = '';
    const bizGroupList = Object.values(bizGroups || {});
    if (isAllBiz) {
      bizHtml = `
        <span class="driver-all-biz-badge" title="Tizimdagi barcha nonvoyxonalarga biriktirilgan">
          <i class="fa-solid fa-globe"></i> Barcha nonvoyxonalar
        </span>
      `;
    } else if (bizGroupList.length > 0) {
      bizHtml = `
        <div style="display:flex; flex-wrap:wrap; gap:4px;">
          ${bizGroupList.map(g => `
            <span class="badge" style="background:var(--color-surface-2); border:1px solid var(--color-border); font-weight:600; color:var(--color-text);">
              <i class="fa-solid fa-industry" style="font-size:10px; color:var(--color-primary); margin-right:4px;"></i>${escapeHtml(g.bizName)}
            </span>
          `).join('')}
        </div>
      `;
    } else {
      bizHtml = `<span style="color:var(--color-text-muted); font-style:italic;">${escapeHtml(assignedBizName || '—')}</span>`;
    }

    // Do'konlar ustuni
    let storesHtml = '';
    if (isAllStoresEverywhere) {
      storesHtml = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="driver-all-everything-badge" title="Barcha nonvoyxonalarning barcha do‘konlariga biriktirilgan">
            <i class="fa-solid fa-layer-group"></i> Barcha do‘konlar (barcha nonvoyxona)
          </span>
        </div>
      `;
    } else if (bizGroupList.length > 0) {
      storesHtml = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${bizGroupList.map(g => {
            if (g.hasAllStores) {
              return `
                <div style="display:inline-flex; align-items:center; gap:6px;">
                  <span class="driver-all-stores-badge" title="${escapeHtml(g.bizName)} ning barcha do‘konlariga biriktirilgan">
                    <i class="fa-solid fa-layer-group"></i> ${escapeHtml(g.bizName)}: Barcha do‘konlar
                  </span>
                  ${g.allStoresAssignmentId ? `
                    <button type="button" class="driver-store-tag-remove" data-del-assignment="${g.allStoresAssignmentId}" title="Ushbu biriktiruvni bekor qilish" style="color:var(--color-danger); font-size:12px;">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  ` : ''}
                </div>
              `;
            } else if (g.stores.length > 0) {
              return `
                <div class="driver-stores-cell" style="display:flex; flex-wrap:wrap; gap:4px;">
                  ${g.stores.map(a => `
                    <span class="driver-store-tag" title="${escapeHtml(a.store?.address || '')}">
                      <i class="fa-solid fa-store"></i>
                      <span><small style="opacity:0.75; font-size:10px;">${escapeHtml(g.bizName)}:</small> ${escapeHtml(a.store?.name || `Do'kon #${a.store_id}`)}</span>
                      <button type="button" class="driver-store-tag-remove" data-del-assignment="${a.id}" title="Do‘konni olib tashlash">
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    </span>
                  `).join('')}
                </div>
              `;
            }
            return '';
          }).filter(Boolean).join('')}
        </div>
      `;
    } else {
      storesHtml = `<span class="driver-unassigned-text"><i class="fa-solid fa-circle-exclamation"></i> Biriktirilmagan</span>`;
    }

    const isActive = driver.active !== 0 && driver.active !== false;

    return `
      <tr data-driver-row="${driver.id}">
        <td>
          <div class="driver-user-cell">
            <div class="driver-avatar-circle">${initials || 'H'}</div>
            <div class="driver-info-col">
              <span class="driver-name-text">${escapeHtml(driver.full_name || 'Ismsiz')}</span>
              <span class="driver-username-text">@${escapeHtml(driver.username)}</span>
            </div>
          </div>
        </td>
        <td>
          <code style="font-size:var(--text-xs); color:var(--color-primary);">${escapeHtml(driver.username)}</code>
        </td>
        <td class="muted">
          ${driver.phone ? `<i class="fa-solid fa-phone" style="font-size:11px; margin-right:4px;"></i>${escapeHtml(driver.phone)}` : '<span style="opacity:0.6;">Dostavka xodimi</span>'}
        </td>
        <td>
          ${bizHtml}
        </td>
        <td>
          ${storesHtml}
        </td>
        <td>
          ${isActive ? '<span class="badge badge-green">Faol</span>' : '<span class="badge badge-red">Nofaol</span>'}
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex; align-items:center; gap:6px; justify-content:flex-end; flex-wrap:nowrap;">
            <button class="btn btn-primary btn-sm" data-add-store="${driver.id}" title="Haydovchiga do‘kon yoki nonvoyxona biriktirish">
              <i class="fa-solid fa-link"></i> Biriktirish
            </button>
            ${isSuperAdmin ? `
              <button class="icon-btn" data-edit-driver="${driver.id}" title="Haydovchini tahrirlash">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="icon-btn" data-del-user="${driver.id}" data-driver-name="${escapeHtml(driver.full_name || driver.username)}" title="Haydovchini o‘chirish" style="color:var(--color-danger);">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            ` : ''}
            ${assignments.length > 0 ? `
              <button class="driver-unassign-btn" data-del-driver-all="${driver.id}" title="Haydovchining barcha biriktiruvlarini bekor qilish">
                <i class="fa-solid fa-link-slash"></i> Bekor qilish
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindDriverActions(container, driverDataList, businesses = [], isSuperAdmin = false) {
  // 1. Alohida biriktiruvni olib tashlash
  container.querySelectorAll('[data-del-assignment]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const assignmentId = btn.dataset.delAssignment;
      confirmAction("Ushbu biriktiruvni haydovchidan olib tashlamoqchimisiz?", async () => {
        try {
          await API.del('/delivery-assignments/' + assignmentId);
          toast("Biriktiruv olib tashlandi", 'success');
          render();
        } catch (err) {
          toast(err.message || 'Xatolik yuz berdi', 'error');
        }
      });
    };
  });

  // 2. Haydovchining barcha biriktiruvlarini bekor qilish
  container.querySelectorAll('[data-del-driver-all]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const driverId = btn.dataset.delDriverAll;
      const driverItem = driverDataList.find(d => Number(d.driver.id) === Number(driverId));
      if (!driverItem || !driverItem.assignments.length) return;

      confirmAction("Haydovchining barcha biriktiruvlarini bekor qilmoqchimisiz?", async () => {
        try {
          for (const a of driverItem.assignments) {
            await API.del('/delivery-assignments/' + a.id);
          }
          toast("Barcha biriktiruvlar bekor qilindi", 'success');
          render();
        } catch (err) {
          toast(err.message || 'Xatolik yuz berdi', 'error');
        }
      });
    };
  });

  // 3. Haydovchiga do‘kon yoki nonvoyxona biriktirish tugmasi
  container.querySelectorAll('[data-add-store]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const driverId = btn.dataset.addStore;
      const driverItem = driverDataList.find(d => Number(d.driver.id) === Number(driverId));
      if (driverItem) {
        addStoreToDriverModal(driverItem, businesses, driverDataList);
      }
    };
  });

  // 4. Haydovchini tahrirlash (faqat super_admin)
  if (isSuperAdmin) {
    container.querySelectorAll('[data-edit-driver]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const driverId = btn.dataset.editDriver;
        const driverItem = driverDataList.find(d => Number(d.driver.id) === Number(driverId));
        if (driverItem) {
          editDriverModal(driverItem.driver, businesses);
        }
      };
    });

    // 5. Haydovchini tizimdan o'chirish (faqat super_admin)
    container.querySelectorAll('[data-del-user]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const driverId = btn.dataset.delUser;
        const driverName = btn.dataset.driverName || 'haydovchi';

        confirmAction(`Haqiqatan ham "${driverName}" haydovchisini tizimdan o‘chirmoqchimisiz?`, async () => {
          try {
            await API.del('/users/' + driverId);
            toast("Haydovchi muvaffaqiyatli o‘chirildi", 'success');
            render();
          } catch (err) {
            toast(err.message || "Haydovchini o‘chirishda xatolik yuz berdi", 'error');
          }
        });
      };
    });
  }
}

/**
 * Yangi haydovchi yaratish formasi modali
 */
function driverFormModal(defaultBizId, businesses = []) {
  const isSuperAdmin = state.user?.role === 'super_admin';
  if (!isSuperAdmin) {
    toast("Faqat katta admin yangi haydovchi qo‘sha oladi", 'error');
    return;
  }
  const myBizId = defaultBizId || businesses[0]?.id || '';

  const bizList = businesses.length ? businesses : (state.businesses || []);
  const currentBizName = bizList.find(b => String(b.id) === String(myBizId))?.name || (myBizId ? `Nonvoyxona #${myBizId}` : '');

  openModal("Yangi haydovchi qo‘shish", `
    <form id="driver-create-form">
      <div class="form-grid">
        <div class="form-section-title"><i class="fa-solid fa-id-card"></i> Haydovchi ma'lumotlari</div>
        
        <div class="field span-2">
          <label>To‘liq ism *</label>
          <input required id="f-driver-name" placeholder="Masalan: Sardor Rustamov" autocomplete="name" />
        </div>

        <div class="field span-2">
          <label>Login *</label>
          <input required id="f-driver-username" pattern="[A-Za-z0-9_.-]{3,30}" placeholder="Masalan: haydovchi2" title="Login 3-30 ta belgi (lotin harflari, raqamlar)" autocomplete="off" />
        </div>

        <div class="field span-2">
          <label>Parol *</label>
          <div style="position:relative; display:flex; align-items:center;">
            <input required type="password" id="f-driver-password" placeholder="Masalan: dostavka123" style="width:100%; padding-right:38px;" autocomplete="new-password" />
            <button type="button" id="f-driver-pwd-toggle" style="position:absolute; right:10px; background:none; border:none; color:var(--color-text-muted); cursor:pointer;" title="Parolni ko'rsatish">
              <i class="fa-regular fa-eye"></i>
            </button>
          </div>
        </div>

        <div class="form-section-title"><i class="fa-solid fa-building-circle-arrow-right"></i> Biriktiriladigan nonvoyxona va do‘konlar</div>

        <div class="field span-2">
          <label>Nonvoyxona *</label>
          ${isSuperAdmin ? `
            <select required id="f-driver-biz" aria-label="Nonvoyxonani tanlang">
              <option value="all" selected>✨ Barcha nonvoyxonalar (${bizList.length} ta)</option>
              ${bizList.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
            </select>
          ` : `
            <input type="hidden" id="f-driver-biz" value="${myBizId}" />
            <div style="background:var(--color-surface-2); border:1px solid var(--color-border); padding:10px 14px; border-radius:var(--radius-md); font-weight:600; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-industry" style="color:var(--color-primary);"></i>
              <span>${escapeHtml(currentBizName)}</span>
            </div>
          `}
        </div>

        <div class="field span-2" style="margin-top:4px;">
          <label class="checkbox-label" style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:600; user-select:none;">
            <input type="checkbox" id="f-driver-all-stores" checked style="width:18px; height:18px; accent-color:var(--color-primary);" />
            <span>Barcha do‘konlarga biriktirish</span>
          </label>
          <small style="color:var(--color-text-muted); font-size:11px; display:block; margin-top:2px;" id="driver-all-stores-help">
            Belgilansa, barcha tegishli do‘konlarga to‘liq biriktiriladi.
          </small>
        </div>

        <div class="field span-2" id="f-driver-stores-group" style="display:none;">
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>Do‘konlar (bir yoki bir nechtasini tanlang)</span>
            <small style="color:var(--color-text-muted); font-size:11px;" id="selected-stores-counter">0 ta tanlandi</small>
          </label>
          
          <div id="stores-picker-wrapper" class="stores-picker-box">
            <div class="stores-picker-empty"><i class="fa-solid fa-circle-notch fa-spin"></i> Do‘konlar yuklanmoqda...</div>
          </div>
        </div>
      </div>

      <div class="form-actions" style="margin-top:20px;">
        <button type="button" class="btn btn-secondary" id="driver-cancel-btn">Bekor qilish</button>
        <button type="submit" class="btn btn-primary" id="driver-save-btn">
          <i class="fa-solid fa-check"></i> Saqlash
        </button>
      </div>
    </form>
  `, (backdrop) => {
    const form = backdrop.querySelector('#driver-create-form');
    const bizSelect = backdrop.querySelector('#f-driver-biz');
    const allStoresCheckbox = backdrop.querySelector('#f-driver-all-stores');
    const storesGroup = backdrop.querySelector('#f-driver-stores-group');
    const pickerWrapper = backdrop.querySelector('#stores-picker-wrapper');
    const counterEl = backdrop.querySelector('#selected-stores-counter');
    const cancelBtn = backdrop.querySelector('#driver-cancel-btn');
    const submitBtn = backdrop.querySelector('#driver-save-btn');
    const pwdToggle = backdrop.querySelector('#f-driver-pwd-toggle');
    const pwdInput = backdrop.querySelector('#f-driver-password');

    // Parol ko'rsatish toggle
    if (pwdToggle && pwdInput) {
      pwdToggle.onclick = () => {
        const isPass = pwdInput.type === 'password';
        pwdInput.type = isPass ? 'text' : 'password';
        pwdToggle.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
      };
    }

    if (cancelBtn) cancelBtn.onclick = () => backdrop.remove();

    let loadedStores = [];

    // Do'konlarni nonvoyxona bo'yicha yuklash funksiyasi
    async function loadStoresForBusiness(selectedBizId) {
      if (!selectedBizId) {
        pickerWrapper.className = 'stores-picker-box is-disabled';
        pickerWrapper.innerHTML = `<div class="stores-picker-empty"><i class="fa-solid fa-circle-info"></i> Avval nonvoyxonani tanlang</div>`;
        if (counterEl) counterEl.textContent = '0 ta tanlandi';
        return;
      }

      pickerWrapper.className = 'stores-picker-box';
      pickerWrapper.innerHTML = `<div class="stores-picker-empty"><i class="fa-solid fa-circle-notch fa-spin"></i> Do‘konlar yuklanmoqda...</div>`;

      try {
        if (selectedBizId === 'all') {
          // Barcha nonvoyxonalarning do'konlarini yuklash
          const promises = bizList.map(b => 
            API.get(`/stores?business_id=${b.id}&limit=100`)
              .then(res => (Array.isArray(res) ? res : (res?.data || [])).map(s => ({ ...s, _bizName: b.name, _bizId: b.id })))
              .catch(() => [])
          );
          const results = await Promise.all(promises);
          loadedStores = results.flat().filter(s => s.active !== 0 && s.active !== false);
        } else {
          const list = await API.get(`/stores?business_id=${selectedBizId}&limit=100`);
          const raw = Array.isArray(list) ? list : (list?.data || []);
          const curBiz = bizList.find(b => String(b.id) === String(selectedBizId));
          loadedStores = raw.filter(s => s.active !== 0 && s.active !== false).map(s => ({
            ...s,
            _bizName: curBiz?.name || `Nonvoyxona #${selectedBizId}`,
            _bizId: Number(selectedBizId)
          }));
        }

        if (!loadedStores.length) {
          pickerWrapper.innerHTML = `<div class="stores-picker-empty">Do‘konlar topilmadi</div>`;
          if (counterEl) counterEl.textContent = '0 ta tanlandi';
          return;
        }

        pickerWrapper.innerHTML = loadedStores.map(store => `
          <label class="store-check-item">
            <input type="checkbox" class="store-check-input" value="${store.id}" data-biz-id="${store._bizId}" />
            <div class="store-check-details">
              <span class="store-check-name">
                ${selectedBizId === 'all' ? `<small style="font-weight:700; color:var(--color-primary); margin-right:4px;">[${escapeHtml(store._bizName)}]</small>` : ''}
                ${escapeHtml(store.name)}
              </span>
              ${store.address ? `<span class="store-check-address">${escapeHtml(store.address)}</span>` : ''}
            </div>
          </label>
        `).join('');

        // Har bir checkbox bosilganda hisoblagichni yangilash
        pickerWrapper.querySelectorAll('.store-check-input').forEach(cb => {
          cb.onchange = updateCounter;
        });
        updateCounter();
      } catch (err) {
        pickerWrapper.innerHTML = `<div class="stores-picker-empty" style="color:var(--color-danger);"><i class="fa-solid fa-triangle-exclamation"></i> Do‘konlarni yuklab bo‘lmadi</div>`;
      }
    }

    function updateCounter() {
      if (!counterEl) return;
      const checked = pickerWrapper.querySelectorAll('.store-check-input:checked').length;
      counterEl.textContent = `${checked} ta tanlandi`;
    }

    // Barcha do'konlarga biriktirish checkbox o'zgarganda
    allStoresCheckbox.onchange = () => {
      const isAll = allStoresCheckbox.checked;
      if (isAll) {
        storesGroup.style.display = 'none';
      } else {
        storesGroup.style.display = '';
        const currentBiz = bizSelect ? bizSelect.value : myBizId;
        loadStoresForBusiness(currentBiz);
      }
    };

    // Nonvoyxona o'zgarganda
    if (bizSelect) {
      bizSelect.onchange = () => {
        if (!allStoresCheckbox.checked) {
          loadStoresForBusiness(bizSelect.value);
        }
      };
    }

    // Form yuborilishi
    form.onsubmit = async (e) => {
      e.preventDefault();

      const fullName = backdrop.querySelector('#f-driver-name').value.trim();
      const username = backdrop.querySelector('#f-driver-username').value.trim();
      const password = backdrop.querySelector('#f-driver-password').value;
      const selectedBiz = bizSelect ? bizSelect.value : myBizId;
      const isAllStores = allStoresCheckbox.checked;

      if (!fullName || !username || !password || !selectedBiz) {
        toast("Iltimos, barcha majburiy maydonlarni to‘ldiring", 'warning');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...';

      try {
        // 1. Foydalanuvchini yaratish
        const primaryBizId = selectedBiz === 'all' ? (bizList[0]?.id || 1) : Number(selectedBiz);
        const payload = {
          username,
          password,
          full_name: fullName,
          role: 'delivery',
          business_id: Number(primaryBizId)
        };

        const userRes = await API.post('/users', payload);
        const newUserId = Number(userRes?.id || userRes?.user?.id || userRes?.data?.id);

        if (!newUserId) {
          throw new Error("Yangi haydovchi yaratildi, lekin ID olinmadi");
        }

        // 2. Biriktiruvlarni (delivery assignments) shakllantirish
        if (selectedBiz === 'all') {
          if (isAllStores) {
            // Har bir nonvoyxonaning barcha do'konlariga biriktirish (store_id: null)
            for (const b of bizList) {
              await API.post('/delivery-assignments', {
                delivery_user_id: newUserId,
                business_id: Number(b.id),
                store_id: null
              }).catch(() => {});
            }
          } else {
            // Tanlangan aniq do'konlar
            const checkedInputs = pickerWrapper.querySelectorAll('.store-check-input:checked');
            for (const cb of checkedInputs) {
              const sId = Number(cb.value);
              const bId = Number(cb.dataset.bizId || primaryBizId);
              await API.post('/delivery-assignments', {
                delivery_user_id: newUserId,
                business_id: bId,
                store_id: sId
              }).catch(() => {});
            }
          }
        } else {
          // Bitta tanlangan nonvoyxona
          const bId = Number(selectedBiz);
          if (isAllStores) {
            await API.post('/delivery-assignments', {
              delivery_user_id: newUserId,
              business_id: bId,
              store_id: null
            }).catch(() => {});
          } else {
            const checkedInputs = pickerWrapper.querySelectorAll('.store-check-input:checked');
            for (const cb of checkedInputs) {
              const sId = Number(cb.value);
              await API.post('/delivery-assignments', {
                delivery_user_id: newUserId,
                business_id: bId,
                store_id: sId
              }).catch(() => {});
            }
          }
        }

        backdrop.remove();
        toast("Yangi haydovchi muvaffaqiyatli qo‘shildi va biriktirildi", 'success');
        render();
      } catch (err) {
        toast(err.message || "Haydovchini yaratishda xatolik", 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saqlash';
      }
    };
  });
}

/**
 * Haydovchini tahrirlash modali (faqat katta admin uchun)
 */
function editDriverModal(driver, businesses = []) {
  const isSuperAdmin = state.user?.role === 'super_admin';
  if (!isSuperAdmin) {
    toast("Faqat katta admin haydovchini tahrirlay oladi", 'error');
    return;
  }

  const bizList = businesses.length ? businesses : state.businesses;
  const currentBizId = driver.business_id || (bizList[0]?.id || '');
  const isActive = driver.active !== 0 && driver.active !== false;

  openModal(`Haydovchini tahrirlash — ${escapeHtml(driver.full_name || driver.username)}`, `
    <form id="driver-edit-form">
      <div class="form-grid">
        <div class="form-section-title"><i class="fa-solid fa-user-pen"></i> Asosiy ma'lumotlar</div>

        <div class="field span-2">
          <label>Login</label>
          <input disabled value="${escapeHtml(driver.username)}" style="opacity:0.75; cursor:not-allowed; background:var(--color-surface-2);" />
          <small style="color:var(--color-text-muted); font-size:11px;">Login o‘zgartirilmaydi</small>
        </div>

        <div class="field span-2">
          <label>To‘liq ism *</label>
          <input required id="f-edit-driver-name" value="${escapeHtml(driver.full_name || '')}" placeholder="Masalan: Sardor Rustamov" autocomplete="name" />
        </div>

        <div class="field span-2">
          <label>Yangi parol <span style="font-weight:400; color:var(--color-text-muted);">(o‘zgartirmaslik uchun bo‘sh qoldiring)</span></label>
          <div style="position:relative; display:flex; align-items:center;">
            <input type="password" id="f-edit-driver-password" placeholder="Yangi parol (ixtiyoriy)" style="width:100%; padding-right:38px;" autocomplete="new-password" />
            <button type="button" id="f-edit-driver-pwd-toggle" style="position:absolute; right:10px; background:none; border:none; color:var(--color-text-muted); cursor:pointer;" title="Parolni ko'rsatish">
              <i class="fa-regular fa-eye"></i>
            </button>
          </div>
        </div>

        <div class="field span-2">
          <label>Nonvoyxona *</label>
          <select required id="f-edit-driver-biz" aria-label="Nonvoyxonani tanlang">
            <option value="">-- Nonvoyxonani tanlang --</option>
            ${bizList.map(b => `<option value="${b.id}" ${String(b.id) === String(currentBizId) ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
          </select>
        </div>

        <div class="field span-2">
          <label>Holati (Status) *</label>
          <select required id="f-edit-driver-status" aria-label="Holatni tanlang">
            <option value="1" ${isActive ? 'selected' : ''}>Faol</option>
            <option value="0" ${!isActive ? 'selected' : ''}>Nofaol</option>
          </select>
        </div>
      </div>

      <div class="form-actions" style="margin-top:20px;">
        <button type="button" class="btn btn-secondary" id="driver-edit-cancel-btn">Bekor qilish</button>
        <button type="submit" class="btn btn-primary" id="driver-edit-save-btn">
          <i class="fa-solid fa-check"></i> Saqlash
        </button>
      </div>
    </form>
  `, (backdrop) => {
    const form = backdrop.querySelector('#driver-edit-form');
    const cancelBtn = backdrop.querySelector('#driver-edit-cancel-btn');
    const submitBtn = backdrop.querySelector('#driver-edit-save-btn');
    const pwdToggle = backdrop.querySelector('#f-edit-driver-pwd-toggle');
    const pwdInput = backdrop.querySelector('#f-edit-driver-password');

    if (pwdToggle && pwdInput) {
      pwdToggle.onclick = () => {
        const isPass = pwdInput.type === 'password';
        pwdInput.type = isPass ? 'text' : 'password';
        pwdToggle.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
      };
    }

    if (cancelBtn) cancelBtn.onclick = () => backdrop.remove();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const fullName = backdrop.querySelector('#f-edit-driver-name').value.trim();
      const newPassword = pwdInput.value.trim();
      const businessId = backdrop.querySelector('#f-edit-driver-biz').value;
      const activeStatus = Number(backdrop.querySelector('#f-edit-driver-status').value);

      if (!fullName) {
        toast("To‘liq ismni kiriting", 'warning');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...';

      try {
        const payload = {
          full_name: fullName,
          business_id: businessId ? Number(businessId) : null,
          active: activeStatus
        };
        if (newPassword) {
          payload.password = newPassword;
        }

        await API.put('/users/' + driver.id, payload);
        backdrop.remove();
        toast("Haydovchi ma’lumotlari muvaffaqiyatli yangilandi", 'success');
        render();
      } catch (err) {
        toast(err.message || "Haydovchini yangilashda xatolik yuz berdi", 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saqlash';
      }
    };
  });
}

/**
 * Haydovchini biriktirish modali
 */
function addStoreToDriverModal(driverItem = null, businesses = [], allDriverDataList = []) {
  const isSuperAdmin = state.user?.role === 'super_admin';
  const isBakeryAdmin = state.user?.role === 'bakery_admin';

  if (!isSuperAdmin && !isBakeryAdmin) {
    toast("Sizda haydovchini biriktirish huquqi yo‘q", 'error');
    return;
  }

  const bizList = businesses.length ? businesses : (state.businesses || []);
  const myBizId = isBakeryAdmin ? state.user.business_id : (bizList[0]?.id || 1);

  // Haydovchilar ro'yxatini olish
  let driversList = [];
  if (allDriverDataList && allDriverDataList.length > 0) {
    driversList = allDriverDataList.map(item => item.driver);
  } else if (driverItem) {
    driversList = [driverItem.driver];
  }

  const preselectedDriverId = driverItem ? driverItem.driver?.id : '';

  openModal("Haydovchini biriktirish", `
    <form id="assign-driver-custom-form">
      <div class="form-grid">
        <!-- 1. Haydovchi tanlash -->
        <div class="field span-2">
          <label style="font-weight:600; margin-bottom:6px; display:block;">Haydovchi:</label>
          <select required id="f-assign-driver-select" style="width:100%;">
            <option value="">-- Haydovchini tanlang --</option>
            ${driversList.map(d => `
              <option value="${d.id}" ${String(d.id) === String(preselectedDriverId) ? 'selected' : ''}>
                ${escapeHtml(d.full_name || d.username)} (@${escapeHtml(d.username)})
              </option>
            `).join('')}
          </select>
        </div>

        <!-- 2. Biriktirish hududi -->
        <div class="field span-2">
          <label style="font-weight:600; margin-bottom:8px; display:block;">Biriktirish hududi:</label>
          <div style="display:flex; flex-direction:column; gap:10px; background:var(--color-surface-2); padding:12px 14px; border-radius:var(--radius-md); border:1px solid var(--color-border);">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:var(--text-sm); font-weight:500;">
              <input type="radio" name="assign_scope" value="single" checked style="width:18px; height:18px; accent-color:var(--color-primary);" />
              <span>Bitta nonvoyxona</span>
            </label>
            ${isSuperAdmin ? `
              <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:var(--text-sm); font-weight:500;">
                <input type="radio" name="assign_scope" value="multiple" style="width:18px; height:18px; accent-color:var(--color-primary);" />
                <span>Bir nechta nonvoyxona</span>
              </label>
              <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:var(--text-sm); font-weight:500;">
                <input type="radio" name="assign_scope" value="all" style="width:18px; height:18px; accent-color:var(--color-primary);" />
                <span>Barcha nonvoyxonalar</span>
              </label>
            ` : ''}
          </div>
        </div>

        <!-- 3. Nonvoyxona tanlash bloki (Bitta nonvoyxona uchun) -->
        <div class="field span-2" id="scope-single-block">
          <label style="font-weight:600; margin-bottom:6px; display:block;">Nonvoyxona:</label>
          ${isSuperAdmin ? `
            <select id="f-single-biz-select" style="width:100%;">
              <option value="">-- Nonvoyxonani tanlang --</option>
              ${bizList.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
            </select>
          ` : `
            <input type="hidden" id="f-single-biz-select" value="${myBizId}" />
            <div style="background:var(--color-surface-2); border:1px solid var(--color-border); padding:10px 14px; border-radius:var(--radius-md); font-weight:600; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-industry" style="color:var(--color-primary);"></i>
              <span>${escapeHtml(bizList.find(b => String(b.id) === String(myBizId))?.name || `Nonvoyxona #${myBizId}`)}</span>
            </div>
          `}
          <!-- Do'konlarni ixtiyoriy tanlash -->
          <div id="single-stores-box" style="margin-top:12px; display:none;">
            <label style="display:flex; justify-content:space-between; align-items:center; font-size:var(--text-xs); margin-bottom:6px;">
              <span>Do‘konlar <small style="color:var(--color-text-muted); font-weight:400;">(ixtiyoriy — tanlanmasa barchasi biriktiriladi)</small></span>
              <small style="color:var(--color-text-muted);" id="single-stores-counter">0 ta tanlandi</small>
            </label>
            <div id="single-stores-picker" class="stores-picker-box" style="max-height:160px; overflow-y:auto;">
              <div class="stores-picker-empty"><i class="fa-solid fa-circle-notch fa-spin"></i> Do‘konlar yuklanmoqda...</div>
            </div>
          </div>
        </div>

        <!-- 4. Bir nechta nonvoyxona tanlash bloki -->
        <div class="field span-2" id="scope-multiple-block" style="display:none;">
          <label style="font-weight:600; margin-bottom:6px; display:block;">Nonvoyxonalar (bir yoki bir nechtasini tanlang):</label>
          <div style="background:var(--color-surface-2); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:10px 12px; display:flex; flex-direction:column; gap:8px;">
            ${bizList.map(b => `
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:var(--text-sm);">
                <input type="checkbox" class="multi-biz-cb" value="${b.id}" style="width:16px; height:16px; accent-color:var(--color-primary);" />
                <span style="font-weight:500;">${escapeHtml(b.name)}</span>
              </label>
            `).join('')}
          </div>
          <!-- Bir nechta nonvoyxona do'konlari -->
          <div id="multi-stores-box" style="margin-top:12px; display:none;">
            <label style="display:flex; justify-content:space-between; align-items:center; font-size:var(--text-xs); margin-bottom:6px;">
              <span>Do‘konlar <small style="color:var(--color-text-muted); font-weight:400;">(ixtiyoriy — tanlanmasa barchasi biriktiriladi)</small></span>
              <small style="color:var(--color-text-muted);" id="multi-stores-counter">0 ta tanlandi</small>
            </label>
            <div id="multi-stores-picker" class="stores-picker-box" style="max-height:160px; overflow-y:auto;"></div>
          </div>
        </div>

        <!-- 5. Barcha nonvoyxonalar tanlanganidagi axborot -->
        <div class="field span-2" id="scope-all-block" style="display:none;">
          <div style="background:rgba(59, 130, 246, 0.08); border:1px solid rgba(59, 130, 246, 0.25); border-radius:var(--radius-md); padding:12px 14px; display:flex; align-items:center; gap:10px;">
            <i class="fa-solid fa-globe" style="color:#2563eb; font-size:22px; flex-shrink:0;"></i>
            <div>
              <strong style="color:var(--color-text); font-size:var(--text-sm);">Barcha nonvoyxonalar (${bizList.length} ta) tanlandi</strong>
              <div style="font-size:var(--text-xs); color:var(--color-text-muted); margin-top:3px;">
                ${bizList.map(b => escapeHtml(b.name)).join(' • ')}
              </div>
            </div>
          </div>
        </div>

        <!-- 6. Eslatma -->
        <div class="field span-2" style="margin-top:2px;">
          <div style="display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border-radius:var(--radius-md); background:rgba(59, 130, 246, 0.08); border:1px solid rgba(59, 130, 246, 0.25); color:var(--color-text);">
            <i class="fa-solid fa-circle-info" style="color:#2563eb; font-size:16px; margin-top:2px; flex-shrink:0;"></i>
            <div style="font-size:var(--text-xs); line-height:1.5;">
              <strong>Eslatma:</strong> Agar aniq do‘kon tanlanmasa, haydovchi tanlangan nonvoyxonaning barcha do‘konlariga biriktiriladi.
            </div>
          </div>
        </div>
      </div>

      <div class="form-actions" style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" class="btn btn-secondary" id="assign-cancel-btn">Bekor qilish</button>
        <button type="submit" class="btn btn-primary" id="assign-submit-btn">
          <i class="fa-solid fa-check"></i> Biriktirish
        </button>
      </div>
    </form>
  `, (backdrop) => {
    const form = backdrop.querySelector('#assign-driver-custom-form');
    const driverSelect = backdrop.querySelector('#f-assign-driver-select');
    const scopeRadios = backdrop.querySelectorAll('input[name="assign_scope"]');
    const scopeSingleBlock = backdrop.querySelector('#scope-single-block');
    const scopeMultipleBlock = backdrop.querySelector('#scope-multiple-block');
    const scopeAllBlock = backdrop.querySelector('#scope-all-block');

    const singleBizSelect = backdrop.querySelector('#f-single-biz-select');
    const singleStoresBox = backdrop.querySelector('#single-stores-box');
    const singleStoresPicker = backdrop.querySelector('#single-stores-picker');
    const singleStoresCounter = backdrop.querySelector('#single-stores-counter');

    const multiBizCbs = backdrop.querySelectorAll('.multi-biz-cb');
    const multiStoresBox = backdrop.querySelector('#multi-stores-box');
    const multiStoresPicker = backdrop.querySelector('#multi-stores-picker');
    const multiStoresCounter = backdrop.querySelector('#multi-stores-counter');

    const cancelBtn = backdrop.querySelector('#assign-cancel-btn');
    const submitBtn = backdrop.querySelector('#assign-submit-btn');

    if (cancelBtn) cancelBtn.onclick = () => backdrop.remove();

    // 1. Hudud (radio) o'zgarganda bloklarni ko'rsatish/yashirish
    scopeRadios.forEach(radio => {
      radio.onchange = () => {
        const val = radio.value;
        if (scopeSingleBlock) scopeSingleBlock.style.display = val === 'single' ? '' : 'none';
        if (scopeMultipleBlock) scopeMultipleBlock.style.display = val === 'multiple' ? '' : 'none';
        if (scopeAllBlock) scopeAllBlock.style.display = val === 'all' ? '' : 'none';

        if (val === 'single') {
          const currentSingleBiz = singleBizSelect ? singleBizSelect.value : myBizId;
          if (currentSingleBiz) loadSingleBizStores(currentSingleBiz);
        } else if (val === 'multiple') {
          loadMultiBizStores();
        }
      };
    });

    // 2. Bitta nonvoyxona do'konlarini yuklash
    async function loadSingleBizStores(bizId) {
      if (!bizId) {
        if (singleStoresBox) singleStoresBox.style.display = 'none';
        return;
      }
      if (singleStoresBox) singleStoresBox.style.display = '';
      if (singleStoresPicker) {
        singleStoresPicker.innerHTML = `<div class="stores-picker-empty"><i class="fa-solid fa-circle-notch fa-spin"></i> Do‘konlar yuklanmoqda...</div>`;
      }

      try {
        const list = await API.get(`/stores?business_id=${bizId}&limit=100`);
        const stores = (Array.isArray(list) ? list : (list?.data || [])).filter(s => s.active !== 0 && s.active !== false);

        if (!stores.length) {
          if (singleStoresPicker) {
            singleStoresPicker.innerHTML = `<div class="stores-picker-empty" style="font-size:11px;">Do‘konlar topilmadi (barcha do‘konlar rejimida biriktiriladi)</div>`;
          }
          if (singleStoresCounter) singleStoresCounter.textContent = '0 ta tanlandi';
          return;
        }

        if (singleStoresPicker) {
          singleStoresPicker.innerHTML = stores.map(store => `
            <label class="store-check-item">
              <input type="checkbox" class="single-store-item-cb" value="${store.id}" />
              <div class="store-check-details">
                <span class="store-check-name">${escapeHtml(store.name)}</span>
                ${store.address ? `<span class="store-check-address">${escapeHtml(store.address)}</span>` : ''}
              </div>
            </label>
          `).join('');

          singleStoresPicker.querySelectorAll('.single-store-item-cb').forEach(cb => {
            cb.onchange = updateSingleCounter;
          });
          updateSingleCounter();
        }
      } catch (err) {
        if (singleStoresPicker) {
          singleStoresPicker.innerHTML = `<div class="stores-picker-empty" style="color:var(--color-danger); font-size:11px;">Do‘konlarni yuklab bo‘lmadi</div>`;
        }
      }
    }

    function updateSingleCounter() {
      if (!singleStoresCounter || !singleStoresPicker) return;
      const cnt = singleStoresPicker.querySelectorAll('.single-store-item-cb:checked').length;
      singleStoresCounter.textContent = `${cnt} ta tanlandi`;
    }

    if (singleBizSelect) {
      singleBizSelect.onchange = () => {
        loadSingleBizStores(singleBizSelect.value);
      };
      // Agar dastlab nonvoyxona tanlangan bo'lsa
      if (singleBizSelect.value) {
        loadSingleBizStores(singleBizSelect.value);
      }
    }

    // 3. Bir nechta nonvoyxona do'konlarini yuklash
    async function loadMultiBizStores() {
      const checkedBizIds = Array.from(multiBizCbs).filter(cb => cb.checked).map(cb => cb.value);
      if (!checkedBizIds.length) {
        if (multiStoresBox) multiStoresBox.style.display = 'none';
        return;
      }
      if (multiStoresBox) multiStoresBox.style.display = '';
      if (multiStoresPicker) {
        multiStoresPicker.innerHTML = `<div class="stores-picker-empty"><i class="fa-solid fa-circle-notch fa-spin"></i> Do‘konlar yuklanmoqda...</div>`;
      }

      try {
        const promises = checkedBizIds.map(bId => 
          API.get(`/stores?business_id=${bId}&limit=100`)
            .then(res => {
              const bName = bizList.find(b => String(b.id) === String(bId))?.name || `Nonvoyxona #${bId}`;
              const items = (Array.isArray(res) ? res : (res?.data || [])).filter(s => s.active !== 0 && s.active !== false);
              return items.map(s => ({ ...s, _bizId: bId, _bizName: bName }));
            })
            .catch(() => [])
        );

        const results = await Promise.all(promises);
        const allStores = results.flat();

        if (!allStores.length) {
          if (multiStoresPicker) {
            multiStoresPicker.innerHTML = `<div class="stores-picker-empty" style="font-size:11px;">Do‘konlar topilmadi (barcha do‘konlar rejimida biriktiriladi)</div>`;
          }
          if (multiStoresCounter) multiStoresCounter.textContent = '0 ta tanlandi';
          return;
        }

        if (multiStoresPicker) {
          multiStoresPicker.innerHTML = allStores.map(store => `
            <label class="store-check-item">
              <input type="checkbox" class="multi-store-item-cb" value="${store.id}" data-biz-id="${store._bizId}" />
              <div class="store-check-details">
                <span class="store-check-name">
                  <small style="font-weight:700; color:var(--color-primary); margin-right:4px;">[${escapeHtml(store._bizName)}]</small>
                  ${escapeHtml(store.name)}
                </span>
                ${store.address ? `<span class="store-check-address">${escapeHtml(store.address)}</span>` : ''}
              </div>
            </label>
          `).join('');

          multiStoresPicker.querySelectorAll('.multi-store-item-cb').forEach(cb => {
            cb.onchange = updateMultiCounter;
          });
          updateMultiCounter();
        }
      } catch (err) {
        if (multiStoresPicker) {
          multiStoresPicker.innerHTML = `<div class="stores-picker-empty" style="color:var(--color-danger); font-size:11px;">Do‘konlarni yuklab bo‘lmadi</div>`;
        }
      }
    }

    function updateMultiCounter() {
      if (!multiStoresCounter || !multiStoresPicker) return;
      const cnt = multiStoresPicker.querySelectorAll('.multi-store-item-cb:checked').length;
      multiStoresCounter.textContent = `${cnt} ta tanlandi`;
    }

    multiBizCbs.forEach(cb => {
      cb.onchange = loadMultiBizStores;
    });

    // 4. Form submit (Biriktirish jarayoni)
    form.onsubmit = async (e) => {
      e.preventDefault();

      const selectedDriverId = driverSelect ? driverSelect.value : '';
      if (!selectedDriverId) {
        toast("Iltimos, haydovchini tanlang", 'warning');
        return;
      }

      const activeScope = Array.from(scopeRadios).find(r => r.checked)?.value || 'single';

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Biriktirilmoqda...';

      try {
        if (activeScope === 'single') {
          // Bitta nonvoyxona
          const selectedBizId = singleBizSelect ? singleBizSelect.value : myBizId;
          if (!selectedBizId) {
            toast("Iltimos, nonvoyxonani tanlang", 'warning');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Biriktirish';
            return;
          }

          const checkedStoreInputs = singleStoresPicker ? singleStoresPicker.querySelectorAll('.single-store-item-cb:checked') : [];
          
          if (checkedStoreInputs.length === 0) {
            // Aniq do'kon tanlanmagan -> Barcha do'konlarga biriktirish (store_id: null)
            await API.post('/delivery-assignments', {
              delivery_user_id: Number(selectedDriverId),
              business_id: Number(selectedBizId),
              store_id: null
            }).catch(() => {});
          } else {
            // Aniq tanlangan do'konlarga biriktirish
            for (const cb of checkedStoreInputs) {
              await API.post('/delivery-assignments', {
                delivery_user_id: Number(selectedDriverId),
                business_id: Number(selectedBizId),
                store_id: Number(cb.value)
              }).catch(() => {});
            }
          }
        } else if (activeScope === 'multiple') {
          // Bir nechta nonvoyxona
          const checkedBizInputs = Array.from(multiBizCbs).filter(cb => cb.checked);
          if (!checkedBizInputs.length) {
            toast("Iltimos, kamida bitta nonvoyxonani belgilang", 'warning');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Biriktirish';
            return;
          }

          const checkedStoreInputs = multiStoresPicker ? multiStoresPicker.querySelectorAll('.multi-store-item-cb:checked') : [];
          
          if (checkedStoreInputs.length === 0) {
            // Har bir belgilangan nonvoyxonaning barcha do'konlariga biriktirish (store_id: null)
            for (const bCb of checkedBizInputs) {
              await API.post('/delivery-assignments', {
                delivery_user_id: Number(selectedDriverId),
                business_id: Number(bCb.value),
                store_id: null
              }).catch(() => {});
            }
          } else {
            // Tanlangan do'konlarga biriktirish
            for (const sCb of checkedStoreInputs) {
              await API.post('/delivery-assignments', {
                delivery_user_id: Number(selectedDriverId),
                business_id: Number(sCb.dataset.bizId),
                store_id: Number(sCb.value)
              }).catch(() => {});
            }
          }
        } else if (activeScope === 'all') {
          // Barcha nonvoyxonalar
          for (const b of bizList) {
            await API.post('/delivery-assignments', {
              delivery_user_id: Number(selectedDriverId),
              business_id: Number(b.id),
              store_id: null
            }).catch(() => {});
          }
        }

        backdrop.remove();
        toast("Haydovchi muvaffaqiyatli biriktirildi", 'success');
        render();
      } catch (err) {
        toast(err.message || "Biriktirishda xatolik yuz berdi", 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Biriktirish';
      }
    };
  });
}
