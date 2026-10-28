/**
 * FullscreenManager — единая система управления настоящим полноэкранным режимом.
 * Оборачивает весь контейнер #game-shell (холст + HUD + мобильные кнопки + диалоги).
 * Для iPhone Safari выводит нативную карточку с инструкцией «На экран Домой».
 */

export class FullscreenManager {
  static getShell() {
    return document.getElementById('game-shell') || document.documentElement;
  }

  static isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  static isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  static isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  static async toggleFullscreen(onStateChange) {
    const shell = this.getShell();

    if (this.isFullscreen()) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        if (onStateChange) onStateChange(false);
      } catch (e) {
        console.warn('Exit fullscreen error:', e);
      }
      return false;
    }

    // Проверяем iOS Safari
    if (this.isIOS() && !this.isStandalone()) {
      this.showIOSPrompt();
      return false;
    }

    try {
      if (shell.requestFullscreen) {
        await shell.requestFullscreen({ navigationUI: 'hide' });
      } else if (shell.webkitRequestFullscreen) {
        await shell.webkitRequestFullscreen();
      } else if (shell.msRequestFullscreen) {
        await shell.msRequestFullscreen();
      }
      if (onStateChange) onStateChange(true);
      return true;
    } catch (e) {
      console.warn('Fullscreen not allowed or denied:', e);
      if (this.isIOS()) {
        this.showIOSPrompt();
      }
      return false;
    }
  }

  static showIOSPrompt() {
    const overlay = document.getElementById('ui-overlay');
    const existing = document.getElementById('ios-pwa-modal');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'ios-pwa-modal';
    div.className = 'dialog-backdrop';
    div.innerHTML = `
      <div class="dialog-box" style="max-width:380px;">
        <div class="dialog-badge">Полный экран на iPhone</div>
        <div class="text" style="text-align:left;font-size:12px;line-height:1.5;">
          iOS Safari блокирует программный полноэкранный режим для веб-страниц.<br><br>
          <strong>Чтобы играть на весь экран без рамок Safari:</strong><br>
          1. Нажми кнопку «Поделиться» <strong>⎋ / [↑]</strong> внизу Safari.<br>
          2. Выбери пункт <strong>«На экран "Домой"»</strong>.<br>
          3. Запусти игру с иконки на рабочем столе как полноценное приложение!
        </div>
        <div class="dialog-choices">
          <button class="game-btn primary" id="ios-pwa-close">Понятно</button>
        </div>
      </div>
    `;
    overlay.appendChild(div);
    div.querySelector('#ios-pwa-close').addEventListener('click', () => div.remove());
  }

  static initListeners(onStateChange) {
    const handler = () => {
      const active = this.isFullscreen();
      if (onStateChange) onStateChange(active);
    };

    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    document.addEventListener('mozfullscreenchange', handler);
    document.addEventListener('MSFullscreenChange', handler);
  }
}

export default FullscreenManager;
