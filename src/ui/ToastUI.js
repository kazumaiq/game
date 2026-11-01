/**
 * ToastUI — компактные, дедуплицированные уведомления без перекрытия игрового поля.
 */
let _toastContainer = null;
let _lastMessage = '';
let _lastShownAt = 0;
let _dismissTimer = null;

function _ensureContainer() {
  if (_toastContainer?.isConnected) return _toastContainer;

  _toastContainer = document.createElement('div');
  _toastContainer.id = 'toast-container';
  _toastContainer.setAttribute('aria-live', 'polite');
  _toastContainer.setAttribute('aria-atomic', 'true');
  _toastContainer.style.cssText = [
    'position:fixed',
    'top:calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 86px)',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:250',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:6px',
    'pointer-events:none',
    'width:min(88vw, 360px)',
    'max-width:88vw',
  ].join(';');
  document.body.appendChild(_toastContainer);
  return _toastContainer;
}

export function showToast(message, type = 'info') {
  const text = String(message ?? '').trim();
  if (!text) return;

  const now = Date.now();
  // Repeated taps/actions should not create a stack of identical notifications.
  if (text === _lastMessage && now - _lastShownAt < 4000) return;
  _lastMessage = text;
  _lastShownAt = now;

  const container = _ensureContainer();
  container.replaceChildren();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = text;
  toast.style.pointerEvents = 'none';
  container.appendChild(toast);

  if (_dismissTimer) clearTimeout(_dismissTimer);
  _dismissTimer = setTimeout(() => {
    toast.classList.add('toast-leaving');
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 180);
  }, 1800);
}
