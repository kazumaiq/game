/**
 * ToastUI — всплывающие уведомления.
 */

const MAX_VISIBLE_TOASTS = 2;
const DUPLICATE_COOLDOWN_MS = 2400;
const TOAST_DURATION_MS = 2300;
const IMPORTANT_DURATION_MS = 3600;
const ICONS = {
  success: '✓',
  warning: '!',
  error: '×',
  info: 'i',
};

let _toastContainer = null;
const _recentMessages = new Map();

function _ensureContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    _toastContainer.setAttribute('aria-live', 'polite');
    _toastContainer.setAttribute('aria-atomic', 'false');
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

function _removeToast(toast) {
  if (!toast.parentElement) return;
  toast.classList.add('is-leaving');
  window.setTimeout(() => toast.remove(), 190);
}

export function showToast(message, type = 'info', important = false) {
  const text = String(message).trim();
  if (!text) return;

  const now = Date.now();
  const lastShownAt = _recentMessages.get(text) ?? 0;
  if (now - lastShownAt < DUPLICATE_COOLDOWN_MS) return;
  _recentMessages.set(text, now);

  const container = _ensureContainer();
  while (container.children.length >= MAX_VISIBLE_TOASTS) {
    _removeToast(container.firstElementChild);
  }

  const toast = document.createElement('div');
  const safeType = Object.hasOwn(ICONS, type) ? type : 'info';
  toast.className = `toast ${safeType}`;
  toast.setAttribute('role', safeType === 'error' || safeType === 'warning' ? 'alert' : 'status');

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = ICONS[safeType];

  const content = document.createElement('span');
  content.className = 'toast-message';
  content.textContent = text;

  toast.append(icon, content);
  container.appendChild(toast);

  const lifetime = important ? IMPORTANT_DURATION_MS : TOAST_DURATION_MS;
  const removalTimer = window.setTimeout(() => _removeToast(toast), lifetime);
  toast.addEventListener('animationend', (event) => {
    if (event.animationName === 'toast-out') window.clearTimeout(removalTimer);
  }, { once: true });
}

export function clearToasts() {
  if (!_toastContainer) return;
  [..._toastContainer.children].forEach(_removeToast);
}
