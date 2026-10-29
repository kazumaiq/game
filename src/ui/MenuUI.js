/**
 * MenuUI — кинематографичное меню для 2.5D симулятора автомойки.
 * Сцена остаётся видимой за стеклянными UI-панелями; действия меню доступны с клавиатуры и touch.
 */
import FullscreenManager from '../game/systems/FullscreenManager.js';
import saveSystem from '../game/systems/SaveSystem.js';
import { audioManager } from '../game/systems/AudioManager.js';
import { showUpgradePanel } from './UpgradePanelUI.js';

let _menuElement = null;
let _settingsModal = null;

function readPreference(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function showMenu({ hasSave, onNewGame, onContinue }) {
  hideMenu();

  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return;

  const div = document.createElement('div');
  div.className = 'menu-screen menu-screen-premium';
  div.id = 'main-menu';

  const isFs = FullscreenManager.isFullscreen();

  div.innerHTML = [
    '<div class="menu-zone menu-zone-top">',
      '<div class="menu-brand-row">',
        '<div class="menu-brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>',
        '<div class="menu-brand-copy"><strong>WASH / EMPIRE</strong><span>TYCOON SIMULATOR</span></div>',
        '<span class="menu-edition-pill"><i></i> WEB EDITION</span>',
      '</div>',
      '<div class="menu-logo-group">',
        '<div class="menu-eyebrow"><span class="menu-eyebrow-line"></span>СВОЙ БИЗНЕС. СВОИ ПРАВИЛА.</div>',
        '<h1 class="menu-title">АВТОМОЙКА</h1>',
        '<div class="menu-subtitle"><span>БИЗНЕС</span> НА ГРАНИ</div>',
        '<p class="menu-tagline">От первого бокса до собственной сети.<br class="menu-desktop-break"> Каждый день решает, вырастешь ты или прогоришь.</p>',
      '</div>',
      '<div class="menu-feature-pills" aria-label="Особенности игры">',
        '<span><i>01</i> УПРАВЛЯЙ</span>',
        '<span><i>02</i> РАЗВИВАЙ</span>',
        '<span><i>03</i> ВЫЖИВАЙ</span>',
      '</div>',
    '</div>',

    '<div class="menu-zone menu-zone-center" aria-hidden="true">',
      '<div class="menu-scene-caption"><span class="menu-live-dot"></span><span>ГОРОД НЕ СПИТ</span><b>24 / 7</b></div>',
      '<div class="menu-scene-hint"><span>WASH</span><span class="menu-scene-hint-line"></span><span>REPEAT</span></div>',
    '</div>',

    '<div class="menu-zone menu-zone-bottom">',
      '<div class="menu-control-card">',
        '<div class="menu-control-card-top">',
          '<div><div class="menu-control-kicker">ТВОЯ ИСТОРИЯ НАЧИНАЕТСЯ ЗДЕСЬ</div><div class="menu-control-title">Готов открыть первую мойку?</div></div>',
          '<div class="menu-save-symbol" aria-hidden="true">↗</div>',
        '</div>',
        '<div class="menu-save-indicator ' + (hasSave ? 'is-saved' : 'is-empty') + '" id="menu-save-indicator">',
          '<span class="menu-save-dot"></span>',
          '<span id="menu-save-label">' + (hasSave ? 'СОХРАНЕНИЕ НАЙДЕНО' : 'СТАРТОВЫЙ КАПИТАЛ · 6 000 000 ₽') + '</span>',
        '</div>',
        '<div class="menu-actions">',
          '<button class="menu-btn menu-btn-primary menu-btn-premium" id="menu-new-game" type="button">',
            '<span class="menu-btn-icon menu-play-icon" aria-hidden="true">▶</span>',
            '<span class="menu-btn-copy"><strong>НАЧАТЬ БИЗНЕС</strong><small>Выбери локацию и открой первую мойку</small></span>',
            '<span class="menu-btn-arrow" aria-hidden="true">↗</span>',
          '</button>',
          '<button class="menu-btn menu-btn-secondary menu-btn-premium" id="menu-continue" type="button" ' + (hasSave ? '' : 'disabled') + '>',
            '<span class="menu-btn-icon menu-continue-icon" aria-hidden="true">↻</span>',
            '<span class="menu-btn-copy"><strong>ПРОДОЛЖИТЬ</strong><small>' + (hasSave ? 'Вернуться к сохранённой карьере' : 'Сохранение пока отсутствует') + '</small></span>',
            '<span class="menu-btn-arrow" aria-hidden="true">→</span>',
          '</button>',
        '</div>',
        '<div class="menu-bottom-row">',
          '<button class="menu-link-btn" id="menu-upgrades" type="button"><span class="menu-link-icon" aria-hidden="true">↗</span> Улучшения</button>',
          '<button class="menu-link-btn" id="menu-settings" type="button"><span class="menu-link-icon" aria-hidden="true">⚙</span> Настройки</button>',
          '<button class="menu-link-btn" id="menu-fullscreen" type="button"><span class="menu-link-icon" aria-hidden="true">' + (isFs ? '⊡' : '⛶') + '</span> ' + (isFs ? 'Свернуть' : 'Полный экран') + '</button>',
        '</div>',
      '</div>',
      '<div class="menu-footer-row"><span>АВТОМОЙКА: БИЗНЕС НА ГРАНИ</span><span class="menu-version"><i></i> WEB BUILD · 2.5D</span></div>',
    '</div>'
  ].join('');

  overlay.appendChild(div);
  _menuElement = div;

  let isTransitioning = false;
  const newGameButton = div.querySelector('#menu-new-game');
  const continueButton = div.querySelector('#menu-continue');

  newGameButton.addEventListener('click', () => {
    if (isTransitioning) return;
    isTransitioning = true;
    audioManager.ensureContext();
    audioManager.play('buttonClick');
    onNewGame();
    window.setTimeout(() => { isTransitioning = false; }, 1200);
  });

  if (hasSave) {
    continueButton.addEventListener('click', () => {
      if (isTransitioning) return;
      isTransitioning = true;
      audioManager.ensureContext();
      audioManager.play('buttonClick');
      onContinue();
      window.setTimeout(() => { isTransitioning = false; }, 1200);
    });
  }

  div.querySelector('#menu-upgrades').addEventListener('click', () => {
    audioManager.ensureContext();
    audioManager.play('buttonClick');
    showUpgradePanel();
  });

  div.querySelector('#menu-settings').addEventListener('click', () => {
    audioManager.ensureContext();
    audioManager.play('buttonClick');
    _showSettings();
  });

  const fsBtn = div.querySelector('#menu-fullscreen');
  fsBtn.addEventListener('click', () => {
    audioManager.ensureContext();
    audioManager.play('buttonClick');
    FullscreenManager.toggleFullscreen((active) => {
      fsBtn.innerHTML = active
        ? '<span class="menu-link-icon">⊡</span> Свернуть'
        : '<span class="menu-link-icon">⛶</span> Полный экран';
    });
  });

  FullscreenManager.initListeners((active) => {
    const button = document.getElementById('menu-fullscreen');
    if (button) {
      button.innerHTML = active
        ? '<span class="menu-link-icon">⊡</span> Свернуть'
        : '<span class="menu-link-icon">⛶</span> Полный экран';
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

function _showSettings() {
  _hideSettings();

  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'settings-backdrop settings-backdrop-premium';
  backdrop.id = 'settings-modal';
  const joystickEnabled = readPreference('carwash_joystick_enabled', 'true') !== 'false';

  backdrop.innerHTML = [
    '<div class="settings-panel settings-panel-premium" role="dialog" aria-modal="true" aria-labelledby="settings-title">',
      '<div class="settings-header">',
        '<span class="settings-icon">⚙</span>',
        '<span id="settings-title">Настройки</span>',
        '<button class="settings-close-btn" id="settings-close" type="button" aria-label="Закрыть настройки">✕</button>',
      '</div>',
      '<div class="settings-body">',
        '<div class="settings-group">',
          '<div class="settings-label">Звук</div>',
          '<div class="settings-row">',
            '<span class="settings-desc">Звуковые эффекты</span>',
            '<label class="settings-toggle"><input type="checkbox" id="settings-sfx" ' + (audioManager.sfxEnabled ? 'checked' : '') + ' /><span class="toggle-track"></span></label>',
          '</div>',
          '<div class="settings-row settings-volume-row">',
            '<label class="settings-desc" for="settings-volume">Громкость</label>',
            '<input type="range" id="settings-volume" min="0" max="100" value="' + Math.round(audioManager.masterVolume * 100) + '" />',
          '</div>',
          '<p class="settings-note">Звуковые эффекты генерируются самой игрой. Настройки сохраняются на этом устройстве.</p>',
        '</div>',
        '<div class="settings-group">',
          '<div class="settings-label">Управление</div>',
          '<div class="settings-row">',
            '<span class="settings-desc">Виртуальный джойстик</span>',
            '<label class="settings-toggle"><input type="checkbox" id="settings-joystick" ' + (joystickEnabled ? 'checked' : '') + ' /><span class="toggle-track"></span></label>',
          '</div>',
          '<p class="settings-note">Можно отключить экранный джойстик и играть с клавиатуры на компьютере.</p>',
        '</div>',
        '<div class="settings-group settings-danger-group">',
          '<div class="settings-label">Данные игры</div>',
          '<button class="menu-btn menu-btn-danger" id="settings-reset" type="button">Сбросить сохранение</button>',
          '<p class="settings-note">Удаление локального сохранения нельзя отменить.</p>',
        '</div>',
      '</div>',
      '<div class="settings-footer">АВТОМОЙКА · WEB EDITION</div>',
    '</div>'
  ].join('');

  overlay.appendChild(backdrop);
  _settingsModal = backdrop;

  backdrop.querySelector('#settings-close').focus();
  backdrop.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      _hideSettings();
    }
  });

  backdrop.querySelector('#settings-close').addEventListener('click', () => {
    audioManager.play('buttonClick');
    _hideSettings();
  });
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) _hideSettings();
  });

  backdrop.querySelector('#settings-sfx').addEventListener('change', event => {
    const enabled = event.target.checked;
    if (enabled !== audioManager.sfxEnabled) audioManager.toggleSFX();
    audioManager.play('buttonClick');
  });

  backdrop.querySelector('#settings-volume').addEventListener('input', event => {
    audioManager.setVolume(Number(event.target.value) / 100);
  });

  backdrop.querySelector('#settings-joystick').addEventListener('change', event => {
    const enabled = event.target.checked;
    writePreference('carwash_joystick_enabled', enabled ? 'true' : 'false');
    const zone = document.getElementById('joystick-zone');
    if (zone) zone.style.display = enabled ? '' : 'none';
    audioManager.play('buttonClick');
  });

  backdrop.querySelector('#settings-reset').addEventListener('click', () => {
    if (!confirm('Удалить сохранение игры на этом устройстве? Это действие нельзя отменить.')) return;

    saveSystem.deleteSave();
    const continueBtn = document.getElementById('menu-continue');
    if (continueBtn) {
      continueBtn.disabled = true;
      const copy = continueBtn.querySelector('.menu-btn-copy small');
      if (copy) copy.textContent = 'Сохранение пока отсутствует';
    }

    const indicator = document.getElementById('menu-save-indicator');
    const label = document.getElementById('menu-save-label');
    if (indicator) {
      indicator.classList.remove('is-saved');
      indicator.classList.add('is-empty');
    }
    if (label) label.textContent = 'СТАРТОВЫЙ КАПИТАЛ · 6 000 000 ₽';

    audioManager.play('buttonClick');
    _hideSettings();
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
