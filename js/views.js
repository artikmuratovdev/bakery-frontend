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
  return `<select id="${id}">
    ${state.businesses.map(b => `<option value="${b.id}" ${String(b.id) === String(selected) ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
  </select>`;
}

function effectiveBizId() {
  return state.user.role === 'super_admin' ? state.currentBusinessId : state.user.business_id;
}

/* ===================== DASHBOARD ===================== */
async function renderDashboard(content) {
  if (state.user.role === 'store') return renderStoreDashboard(content);

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
  const list = await API.get('/businesses');
  content.innerHTML = `
    <div class="section-head">
      <h2>Nonvoyxonalar</h2>
      <p>Barcha bizneslarni shu yerdan boshqaring</p>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Ro'yxat (${list.length})</h3>
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
    </div>
  `;

  content.querySelector('#add-biz-btn').onclick = () => bizFormModal();
  content.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    const biz = list.find(x => x.id == b.dataset.edit);
    bizFormModal(biz);
  });
  content.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    confirmAction("Bu nonvoyxonani o'chirmoqchimisiz? Unga tegishli barcha ma'lumotlar (do'konlar, mahsulotlar, tarix) o'chib ketadi.", async () => {
      await API.del('/businesses/' + b.dataset.del);
      toast("Nonvoyxona o'chirildi", 'success');
      state.businesses = await API.get('/businesses');
      render();
    });
  });
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
        state.businesses = await API.get('/businesses');
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
  const list = await API.get('/products' + qs({ business_id: bizId }));
  const bizName = (id) => state.businesses.find(b => b.id == id)?.name || '';

  content.innerHTML = `
    <div class="section-head">
      <h2>Mahsulot turlari</h2>
      <p>Nonning narxi va turlarini shu yerda boshqaring</p>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Ro'yxat (${list.length})</h3>
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
    </div>
  `;

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
}

function productFormModal(product, defaultBizId) {
  const needsBizSelect = state.user.role === 'super_admin';
  openModal(product ? "Mahsulotni tahrirlash" : "Yangi mahsulot turi", `
    <form id="product-form">
      <div class="form-grid">
        ${needsBizSelect ? `<div class="field span-2"><label>Nonvoyxona</label>${bizSelectHtml('f-biz', product?.business_id || defaultBizId || state.businesses[0]?.id)}</div>` : ''}
        <div class="field span-2"><label>Mahsulot nomi</label><input required id="f-name" value="${escapeHtml(product?.name || '')}" placeholder="Masalan: 8000 so'mlik non" /></div>
        <div class="field span-2"><label>Narxi (so'm)</label><input required type="number" min="0" step="100" id="f-price" value="${product?.price ?? ''}" placeholder="Masalan: 8000" /></div>
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
  const list = await API.get('/stores' + qs({ business_id: bizId }));
  const bizName = (id) => state.businesses.find(b => b.id == id)?.name || '';
  const canManage = state.user.role === 'super_admin' || state.user.role === 'bakery_admin';

  // fetch debt summary per store quickly via distribution list is expensive; skip inline debt for list view to keep it fast
  content.innerHTML = `
    <div class="section-head">
      <h2>Do'konlar</h2>
      <p>Nonvoyxonaga biriktirilgan barcha do'konlar</p>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Ro'yxat (${list.length})</h3>
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
    </div>
  `;

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
  const filterDate = state.prodFilterDate || '';
  const [entries, stock] = await Promise.all([
    API.get('/production' + qs({ business_id: bizId, date: filterDate || undefined })),
    bizId ? API.get('/production/stock' + qs({ business_id: bizId })) : Promise.resolve([])
  ]);

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
      <div class="card-header"><h3>Yozuvlar (${entries.length})</h3></div>
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
    </div>
  `;
  content.innerHTML = '';
  content.appendChild(wrap);

  content.querySelector('#filter-date').onchange = (e) => { state.prodFilterDate = e.target.value; render(); };
  content.querySelector('#clear-filter').onclick = () => { state.prodFilterDate = ''; render(); };
  const addBtn = content.querySelector('#add-production-btn');
  if (addBtn) addBtn.onclick = () => productionFormModal(bizId);
  content.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    confirmAction("Bu yozuvni o'chirmoqchimisiz?", async () => {
      try { await API.del('/production/' + b.dataset.del); toast("O'chirildi", 'success'); render(); }
      catch (err) { toast(err.message, 'error'); }
    });
  });
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
        <div class="field"><label>Tayyorlangan soni</label><input type="number" min="1" step="1" id="f-qty" placeholder="Masalan: 500" required /></div>
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
      products = await API.get('/products' + qs({ business_id: bizId }));
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
  const filterDate = state.distFilterDate || '';
  const entries = await API.get('/distribution' + qs({ business_id: bizId, date: filterDate || undefined }));

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
      <div class="card-header"><h3>Yozuvlar (${entries.length})</h3></div>
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
    </div>
  `;

  content.querySelector('#filter-date').onchange = (e) => { state.distFilterDate = e.target.value; render(); };
  content.querySelector('#clear-filter').onclick = () => { state.distFilterDate = ''; render(); };
  const addBtn = content.querySelector('#add-dist-btn');
  if (addBtn) addBtn.onclick = () => distributionFormModal(bizId);
  content.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    confirmAction("Bu yozuvni o'chirmoqchimisiz?", async () => {
      try { await API.del('/distribution/' + b.dataset.del); toast("O'chirildi", 'success'); render(); }
      catch (err) { toast(err.message, 'error'); }
    });
  });
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
        API.get('/products' + qs({ business_id: bizId })),
        API.get('/stores' + qs({ business_id: bizId })),
        API.get('/production/stock' + qs({ business_id: bizId }))
      ]);
      products = loadedProducts;
      stock = loadedStock;
      m.querySelector('#f-product').innerHTML = products.map(p => `<option value="${p.id}" data-price="${p.price}">${escapeHtml(p.name)} — ${fmtMoney(p.price)}</option>`).join('') || `<option value="">Mahsulot yo'q</option>`;
      m.querySelector('#f-store').innerHTML = stores.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('') || `<option value="">Do'kon yo'q</option>`;
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

  const [stores, distributions, payments] = await Promise.all([
    API.get('/stores' + qs({ business_id: bizId })),
    API.get('/distribution' + qs({ business_id: bizId })),
    API.get('/payments' + qs({ business_id: bizId }))
  ]);

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
    <div class="grid grid-4" style="margin-bottom:20px;">
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

  let rawOrders = [];
  try {
    rawOrders = await API.get('/orders');
  } catch (err) {
    content.innerHTML = `<div class="alert alert-warning"><i class="fa-solid fa-triangle-exclamation"></i> Zakazlarni yuklashda xatolik: ${escapeHtml(err.message)}</div>`;
    return;
  }

  const allOrders = Array.isArray(rawOrders) ? rawOrders : (rawOrders?.orders || rawOrders?.data || []);

  let statusFilter = state.orderStatusFilter || 'all';
  let storeFilter = state.orderStoreFilter || 'all';
  let searchFilter = state.orderSearchFilter || '';

  function getFilteredOrders() {
    return allOrders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
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
  }

  const storeMap = {};
  if (isSuperAdmin) {
    allOrders.forEach(o => {
      const sid = o.store_id || o.store?.id;
      const sname = o.store?.name || o.store_name;
      if (sid && sname && !storeMap[sid]) {
        storeMap[sid] = sname;
      }
    });
  }

  function draw() {
    const filtered = getFilteredOrders();

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
          <h3>Zakazlar ro'yxati (${filtered.length})</h3>
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
                <th style="width:90px; text-align:right;">Amallar</th>
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
                    <td style="text-align:right;">
                      <button class="btn btn-secondary btn-sm" data-view-order="${o.id}">
                        <i class="fa-solid fa-eye"></i> Ko'rish
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr class="empty-row">
                  <td colspan="${isSuperAdmin ? 7 : 6}" style="text-align:center; padding:36px 16px;">
                    <i class="fa-solid fa-cart-shopping" style="font-size:32px; color:var(--color-text-muted); opacity:0.5; margin-bottom:12px; display:block;"></i>
                    <p style="margin:0 0 10px 0; color:var(--color-text-muted);">Hozircha mos keladigan zakazlar topilmadi</p>
                    ${isStore ? `<button class="btn btn-primary btn-sm" id="empty-add-order-btn">+ Yangi zakaz berish</button>` : ''}
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const statusSelect = content.querySelector('#orders-status-filter');
    if (statusSelect) {
      statusSelect.onchange = (e) => {
        statusFilter = e.target.value;
        state.orderStatusFilter = statusFilter;
        draw();
      };
    }

    const storeSelect = content.querySelector('#orders-store-filter');
    if (storeSelect) {
      storeSelect.onchange = (e) => {
        storeFilter = e.target.value;
        state.orderStoreFilter = storeFilter;
        draw();
      };
    }

    const searchInput = content.querySelector('#orders-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        searchFilter = e.target.value;
        state.orderSearchFilter = searchFilter;
        draw();
      };
    }

    const newBtn = content.querySelector('#open-new-order-btn');
    if (newBtn) {
      newBtn.onclick = () => orderCreateModal(() => renderOrders(content));
    }
    const emptyNewBtn = content.querySelector('#empty-add-order-btn');
    if (emptyNewBtn) {
      emptyNewBtn.onclick = () => orderCreateModal(() => renderOrders(content));
    }

    content.querySelectorAll('[data-view-order]').forEach(btn => {
      btn.onclick = () => {
        const orderId = btn.dataset.viewOrder;
        const ord = allOrders.find(x => String(x.id) === String(orderId));
        if (ord) {
          orderDetailModal(ord, () => renderOrders(content));
        }
      };
    });
  }

  draw();
}

async function orderCreateModal(onSuccess) {
  let products = [];
  try {
    const bizId = effectiveBizId();
    products = await API.get('/products' + qs({ business_id: bizId }));
    if (!Array.isArray(products) || !products.length) {
      products = await API.get('/products');
    }
  } catch (err) {
    try {
      products = await API.get('/products');
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
          Zakaz statusini o'zgartirish
        </label>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <select id="modal-order-status" style="flex:1; min-width:180px; height:38px;">
            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Kutilmoqda (pending)</option>
            <option value="approved" ${order.status === 'approved' ? 'selected' : ''}>Tasdiqlandi (approved)</option>
            <option value="rejected" ${order.status === 'rejected' ? 'selected' : ''}>Rad etildi (rejected)</option>
            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Bajarildi (completed)</option>
          </select>
          <button class="btn btn-primary" id="save-status-btn">
            <i class="fa-solid fa-check"></i> Statusni saqlash
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
          toast(err.message || "Statusni o'zgartirishda xatolik", 'danger');
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Statusni saqlash`;
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
      const all = await API.get('/orders');
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


