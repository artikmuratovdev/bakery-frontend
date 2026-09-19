/**
 * PWA va Service Worker boshqaruvi
 * Bek kulchalari va nonlari tizimi uchun
 */

let deferredInstallPrompt = null;

// Service Workerni ro'yxatdan o'tkazish
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then((reg) => {
        console.log('[PWA] Service Worker muvaffaqiyatli ro\'yxatdan o\'tdi:', reg.scope);

        // Yangilanish borligini tekshirish
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Ilovaning yangi versiyasi mavjud!');
                if (typeof showToast === 'function') {
                  showToast('Ilovaning yangi versiyasi yuklandi. Yangilash uchun sahifani qayta yuklang.', 'info');
                }
              }
            });
          }
        });
      })
      .catch((err) => {
        console.error('[PWA] Service Worker xatoligi:', err);
      });
  });
}

// Ilova allaqachon standalone rejimda (o'rnatilgan) ochilganligini tekshirish
function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// O'rnatish hodisasini tutib olish (Android / Chrome / Edge)
window.addEventListener('beforeinstallprompt', (e) => {
  // Standart brauzer dialogini kechiktiramiz
  e.preventDefault();
  deferredInstallPrompt = e;

  // Agar allaqachon o'rnatilgan bo'lsa, ko'rsatmaymiz
  if (isRunningStandalone()) {
    return;
  }

  // O'rnatish tugmalari va bannerini faollashtirish
  showInstallUI();
});

// Ilova o'rnatilganda
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallUI();
  console.log('[PWA] Ilova telefonga muvaffaqiyatli o\'rnatildi!');
  if (typeof showToast === 'function') {
    showToast('Ilova muvaffaqiyatli o\'rnatildi!', 'success');
  }
});

// O'rnatish interfeysini ko'rsatish
function showInstallUI() {
  const installBanner = document.getElementById('pwa-install-banner');
  const installBtnTop = document.getElementById('pwa-install-btn');
  const loginInstallBtn = document.getElementById('login-pwa-install-btn');

  if (installBanner) {
    // Agar foydalanuvchi ilgari "Keyinroq" deb yopmagan bo'lsa
    const dismissedTime = localStorage.getItem('pwa_install_dismissed');
    const now = Date.now();
    // 3 kun davomida qayta chiqarmaslik
    if (!dismissedTime || now - parseInt(dismissedTime, 10) > 3 * 24 * 60 * 60 * 1000) {
      installBanner.classList.remove('hidden');
    }
  }

  if (installBtnTop) {
    installBtnTop.classList.remove('hidden');
  }

  if (loginInstallBtn) {
    loginInstallBtn.classList.remove('hidden');
  }
}

// O'rnatish interfeysini yashirish
function hideInstallUI() {
  const installBanner = document.getElementById('pwa-install-banner');
  const installBtnTop = document.getElementById('pwa-install-btn');
  const loginInstallBtn = document.getElementById('login-pwa-install-btn');

  if (installBanner) {
    installBanner.classList.add('hidden');
  }
  if (installBtnTop) {
    installBtnTop.classList.add('hidden');
  }
  if (loginInstallBtn) {
    loginInstallBtn.classList.add('hidden');
  }
}

// O'rnatish jarayonini chaqirish
async function triggerPwaInstall() {
  if (!deferredInstallPrompt) {
    alert('Ilovani o\'rnatish uchun brauzeringiz menyusidan (uch nuqta) "Ilovani o\'rnatish" yoki "Bosh ekranga qo\'shish" bandini tanlang.');
    return;
  }

  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('[PWA] O\'rnatish tanlovi:', outcome);

    if (outcome === 'accepted') {
      deferredInstallPrompt = null;
      hideInstallUI();
    }
  } catch (err) {
    console.error('[PWA] O\'rnatishda xatolik:', err);
  }
}

// DOM yuklanganda hodisalarni bog'lash
document.addEventListener('DOMContentLoaded', () => {
  const installActionBtn = document.getElementById('pwa-install-action');
  const installTopBtn = document.getElementById('pwa-install-btn');
  const loginInstallBtn = document.getElementById('login-pwa-install-btn');
  const installDismissBtn = document.getElementById('pwa-install-dismiss');

  if (installActionBtn) {
    installActionBtn.addEventListener('click', triggerPwaInstall);
  }

  if (installTopBtn) {
    installTopBtn.addEventListener('click', triggerPwaInstall);
  }

  if (loginInstallBtn) {
    loginInstallBtn.addEventListener('click', triggerPwaInstall);
  }

  if (installDismissBtn) {
    installDismissBtn.addEventListener('click', () => {
      hideInstallUI();
      localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    });
  }

  // Agar ilova allaqachon standalone rejimda ochilgan bo'lsa
  if (isRunningStandalone()) {
    hideInstallUI();
    document.body.classList.add('is-standalone-pwa');
  }
});

// ==========================================
// BILDIRISHNOMALAR VA BACKGROUND SYNC BOSHQARUVI
// ==========================================

// Bildirishnoma ruxsatini so'rash
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('[PWA] Ushbu brauzer bildirishnomalarni qo\'llab-quvvatlamaydi.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Bildirishnoma chiqarish (masalan, yangi buyurtma yoki internet tiklanganda)
async function showNotification(title, options = {}) {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const defaultOptions = {
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [100, 50, 100],
    ...options
  };

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    if (reg && reg.showNotification) {
      return reg.showNotification(title, defaultOptions);
    }
  }

  // Standart bildirishnoma fallback
  return new Notification(title, defaultOptions);
}

// Background Sync ro'yxatdan o'tkazish
async function registerBackgroundSync(tag = 'sync-offline-queue') {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register(tag);
      console.log(`[PWA] Background sync ro'yxatga olindi: ${tag}`);
      return true;
    } catch (err) {
      console.warn('[PWA] Background sync xatoligi:', err);
    }
  }
  return false;
}

// Service Worker-dan keladigan xabarlarni tutish
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SYNC_OFFLINE_QUEUE') {
      console.log('[PWA] Background sync hodisasi keldi, ma\'lumotlar yangilanmoqda...');
      if (typeof render === 'function' && window.state?.user) {
        render(true);
      }
    }
  });
}

// Global PWA obyekti
window.PWA = {
  requestNotificationPermission,
  showNotification,
  registerBackgroundSync,
  triggerPwaInstall,
  isRunningStandalone
};

