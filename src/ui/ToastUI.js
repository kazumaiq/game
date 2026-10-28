/**
 * ToastUI — всплывающие уведомления.
 */

let _toastContainer = null;

function _ensureContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    _toastContainer.style.cssText = 'position:fixed;top:60px;right:16px;z-index:300;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(_toastContainer);
  }
}

export function showToast(message, type = 'info') {
  _ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.pointerEvents = 'auto';
  _toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 3000);
}
