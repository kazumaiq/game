/**
 * ToastUI — всплывающие уведомления.
 */

let _toastContainer = null;

function _ensureContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    _toastContainer.style.cssText = 'position:fixed;bottom:calc(var(--safe-bottom, 0px) + 140px);left:50%;transform:translateX(-50%);z-index:250;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;width:max-content;max-width:92vw;';
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
