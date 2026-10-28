/**
 * MenuUI — премиальное главное меню с тремя зонами:
 *   TOP: логотип + подзаголовок + слоган
 *   CENTER: прозрачная зона (видна Phaser сцена)
 *   BOTTOM: кнопки + настройки
 */
import FullscreenManager from '../game/systems/FullscreenManager.js';
import saveSystem from '../game/systems/SaveSystem.js';
import { audioManager } from '../game/systems/AudioManager.js';

let _menuElement = null;
let _settingsModal = null;

export function showMenu({ hasSave, onNewGame, onContinue }) {
  hideMenu();

  const overlay = document.getElementById('ui-overlay');
  const div = document.createElement('div');
  div.className = 'menu-screen';
  div.id = 'main-menu';

  const isFs = FullscreenManager.isFullscreen();

  div.innerHTML = `
    <div class="menu-zone menu-zone-top">
      <div class="menu-logo-group">
        <h1 class="menu-title">АВТОМОЙКА</h1>
        <div class="menu-subtitle">БИЗНЕС НА ГРАНИ</div>
        <p class="menu-tagline">Построй бизнес. Переживи конкуренцию.</p>
      </div>
    </div>

    <div class="menu-zone menu-zone-center"></div>

    <div class="menu-zone menu-zone-bottom">
      <div class="menu-actions">
        <button class="menu-btn menu-btn-primary" id="menu-new-game">
          <span class="menu-btn-icon">▶</span> НОВАЯ ИГРА
        </button>
        <button class="menu-btn menu-btn-secondary" id="menu-continue" ${hasSave ? '' : 'disabled'}>
          <span class="menu-btn-icon">↻</span> ПРОДОЛЖИТЬ
        </button>
      </div>
      <div class="menu-bottom-row">
        <button class="menu-link-btn" id="menu-settings">
          <span>⚙</span> Настройки
        </button>
        <button class="menu-link-btn" id="menu-fullscreen">
          <span>${isFs ? '⊡' : '⛶'}</span> ${isFs ? 'Свернуть' : 'Полный экран'}
        </button>
      </div>
      <div class="menu-version">v1.0 • 2026</div>
    </div>
  `;

  overlay.appendChild(div);
  _menuElement = div;

  // --- EVENT LISTENERS ---
  let isTransitioning = false;

  document.getElementById('menu-new-game').addEventListener('click', () => {
    if (isTransitioning) return;
    isTransitioning = true;
    audioManager.ensureContext();
    audioManager.play('buttonClick');
    onNewGame();
    // Сбрасываем через 2 сек на случай если confirm отклонён
    setTimeout(() => { isTransitioning = false; }, 2000);
  });

  if (hasSave) {
    document.getElementById('menu-continue').addEventListener('click', () => {
      if (isTransitioning) return;
      isTransitioning = true;
      audioManager.ensureContext();
      audioManager.play('buttonClick');
      onContinue();
      setTimeout(() => { isTransitioning = false; }, 2000);
    });
  }

  // Настройки
  document.getElementById('menu-settings').addEventListener('click', () => {
    _showSettings();
  });

  // Полный экран
  const fsBtn = document.getElementById('menu-fullscreen');
  fsBtn.addEventListener('click', () => {
    FullscreenManager.toggleFullscreen((active) => {
      fsBtn.innerHTML = active
        ? '<span>⊡</span> Свернуть'
        : '<span>⛶</span> Полный экран';
    });
  });

  FullscreenManager.initListeners((active) => {
    const b = document.getElementById('menu-fullscreen');
    if (b) {
      b.innerHTML = active
        ? '<span>⊡</span> Свернуть'
        : '<span>⛶</span> Полный экран';
    }
  });
}

export function hideMenu() {
  _hideSettings();
  if (_menuElement) {
    _menuElement.remove();
    _menuElement = null;
  }
  const existing = document.getElementById('main-menu');
  if (existing) existing.remove();
}

// =================== SETTINGS MODAL ===================
function _showSettings() {
  _hideSettings();

  const overlay = document.getElementById('ui-overlay');
  const backdrop = document.createElement('div');
  backdrop.className = 'settings-backdrop';
  backdrop.id = 'settings-modal';

  backdrop.innerHTML = `
    <div class="settings-panel">
      <div class="settings-header">
        <span class="settings-icon">⚙</span>
        <span>Настройки</span>
        <button class="settings-close-btn" id="settings-close">✕</button>
      </div>

      <div class="settings-body">
        <div class="settings-group">
          <div class="settings-label">Звук</div>
          <div class="settings-row">
            <span class="settings-desc">Звуковые эффекты</span>
            <label class="settings-toggle">
              <input type="checkbox" id="settings-sfx" ${audioManager.sfxEnabled ? 'checked' : ''} />
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="settings-row">
            <span class="settings-desc">Громкость</span>
            <input type="range" id="settings-volume" min="0" max="100" value="${Math.round(audioManager.masterVolume * 100)}" style="width:90px;accent-color:#38bdf8;" />
          </div>
          <div class="settings-row">
            <span class="settings-desc">Музыка</span>
            <label class="settings-toggle">
              <input type="checkbox" id="settings-music" checked />
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-label">Управление</div>
          <div class="settings-row">
            <span class="settings-desc">Виртуальный джойстик</span>
            <label class="settings-toggle">
              <input type="checkbox" id="settings-joystick" checked />
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-label">Данные</div>
          <div class="settings-row">
            <button class="menu-btn menu-btn-danger" id="settings-reset">Сбросить сохранение</button>
          </div>
        </div>
      </div>

      <div class="settings-footer">
        Автомойка: Бизнес на грани • v1.0
      </div>
    </div>
  `;

  overlay.appendChild(backdrop);
  _settingsModal = backdrop;

  // Закрытие
  document.getElementById('settings-close').addEventListener('click', () => {
    audioManager.play('buttonClick');
    _hideSettings();
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) _hideSettings();
  });

  // Звуковые настройки
  const sfxToggle = document.getElementById('settings-sfx');
  if (sfxToggle) {
    sfxToggle.addEventListener('change', () => {
      audioManager.toggleSFX();
      audioManager.play('buttonClick');
    });
  }

  const volSlider = document.getElementById('settings-volume');
  if (volSlider) {
    volSlider.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value, 10) / 100;
      audioManager.setVolume(vol);
    });
    volSlider.addEventListener('change', () => {
      audioManager.play('buttonClick');
    });
  }

  // Сброс
  document.getElementById('settings-reset').addEventListener('click', () => {
    if (confirm('Удалить все сохранения? Это действие нельзя отменить.')) {
      saveSystem.deleteSave();
      _hideSettings();
      // Обновляем состояние кнопки «Продолжить»
      const contBtn = document.getElementById('menu-continue');
      if (contBtn) {
        contBtn.disabled = true;
      }
    }
  });
}

function _hideSettings() {
  if (_settingsModal) {
    _settingsModal.remove();
    _settingsModal = null;
  }
  const existing = document.getElementById('settings-modal');
  if (existing) existing.remove();
}
