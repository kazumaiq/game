/**
 * HudUI — компактный и функциональный мобильный HUD.
 * Без перегруза, чистые читаемые цифры, интуитивные действия.
 */
import gameState from '../game/systems/GameState.js';
import BALANCE from '../game/config/balance.js';
import { showBusinessPanel } from './BusinessPanelUI.js';
import { showUpgradePanel } from './UpgradePanelUI.js';
import { showDailyContractsPanel } from './DailyContractsUI.js';
import { showToast } from './ToastUI.js';
import { audioManager } from '../game/systems/AudioManager.js';
import { getShiftClock } from '../game/systems/DayCycle.js';
import { showBusinessManagementPanel } from './BusinessManagementUI.js';

let _hudElement = null;
let _scene = null;

function fmt(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '0 ₽';
  return n.toLocaleString('ru-RU') + ' ₽';
}

export function createHUD(scene) {
  _scene = scene;
  destroyHUD();

  const overlay = document.getElementById('ui-overlay');
  const hud = document.createElement('div');
  hud.id = 'game-hud';
  hud.className = 'hud-clean';
  hud.innerHTML = `
    <div class="hud-bar">
      <!-- Блок информации: Баланс, День, Репутация, Очередь -->
      <div class="hud-pill-group">
        <div class="hud-pill time phase-morning" id="hud-time-pill" title="Время внутри текущей смены">
          <span class="icon" id="hud-time-icon">🌤</span>
          <span class="val" id="hud-clock">08:00</span>
          <span class="lbl" id="hud-phase">УТРО</span>
        </div>
        <div class="hud-pill money" id="hud-money-pill">
          <span class="icon">₽</span>
          <span class="val" id="hud-money">0 ₽</span>
        </div>
        <div class="hud-pill">
          <span class="lbl">ДЕНЬ</span>
          <span class="val" id="hud-day">1</span>
        </div>
        <div class="hud-pill">
          <span class="lbl">★</span>
          <span class="val" id="hud-rep">50</span>
        </div>
        <div class="hud-pill">
          <span class="lbl">ОЧЕРЕДЬ:</span>
          <span class="val" id="hud-queue">0</span>
        </div>
      </div>

      <!-- Кнопки управления: Бизнес, Улучшения, Пауза, Смена -->
      <div class="hud-actions-group">
        <button class="hud-btn" id="hud-btn-business">
          <span>💼</span> Бизнес
        </button>
        <button class="hud-btn" id="hud-btn-upgrades">
          <span>⚡</span> Улучшения
        </button>
        <button class="hud-btn" id="hud-btn-management"><span>🏗️</span> Развитие</button>
        <button class="hud-btn" id="hud-btn-contracts">
          <span>🎯</span> Цели
        </button>
        <button class="hud-btn icon-only" id="hud-btn-pause" title="Пауза">
          ⏸
        </button>
        <button class="hud-btn shift-btn" id="hud-btn-end-shift">
          Смена ❯
        </button>
      </div>
    </div>

    <!-- Индикатор рабочего времени смены -->
    <div class="shift-timeline-bar">
      <div class="shift-timeline-fill" id="hud-shift-fill" style="width: 100%;"></div>
    </div>

    <!-- Слот для учебных подсказок (не перекрывает кнопки и сцену) -->
    <div id="tutorial-slot" class="hud-tutorial-slot"></div>
  `;
  overlay.appendChild(hud);
  _hudElement = hud;

  document.getElementById('hud-btn-business').addEventListener('click', () => {
    audioManager.play('buttonClick');
    showBusinessPanel();
  });
  document.getElementById('hud-btn-upgrades').addEventListener('click', () => {
    audioManager.play('buttonClick');
    showUpgradePanel();
  });
  document.getElementById('hud-btn-management').addEventListener('click', () => {
    audioManager.play('buttonClick');
    showBusinessManagementPanel();
  });
  document.getElementById('hud-btn-contracts').addEventListener('click', () => {
    audioManager.play('buttonClick');
    showDailyContractsPanel();
  });
  
  document.getElementById('hud-btn-pause').addEventListener('click', () => {
    audioManager.play('buttonClick');
    gameState.paused = !gameState.paused;
    const btn = document.getElementById('hud-btn-pause');
    if (gameState.paused) {
      _scene.physics.pause();
      if (btn) btn.textContent = '▶';
      showToast('Игра приостановлена', 'info');
    } else {
      _scene.physics.resume();
      if (btn) btn.textContent = '⏸';
      showToast('Игра продолжается', 'info');
    }
  });

  document.getElementById('hud-btn-end-shift').addEventListener('click', () => {
    audioManager.play('buttonClick');
    if (confirm('Завершить текущую рабочую смену? Оставшиеся в очереди машины уедут.')) {
      _scene.endShift();
    }
  });

  updateHUD();
}

export function updateHUD() {
  if (!_hudElement) return;

  const moneyEl = document.getElementById('hud-money');
  const dayEl = document.getElementById('hud-day');
  const repEl = document.getElementById('hud-rep');
  const queueEl = document.getElementById('hud-queue');
  const shiftFill = document.getElementById('hud-shift-fill');
  const timePill = document.getElementById('hud-time-pill');
  const clockEl = document.getElementById('hud-clock');
  const phaseEl = document.getElementById('hud-phase');
  const timeIconEl = document.getElementById('hud-time-icon');

  if (moneyEl) {
    moneyEl.textContent = fmt(gameState.money);
    moneyEl.className = gameState.money < 0 ? 'val negative' : 'val';
  }
  if (dayEl) dayEl.textContent = gameState.day;

  const shiftClock = getShiftClock(gameState.shiftTimeRemaining, BALANCE.time);
  if (clockEl) clockEl.textContent = shiftClock.clock;
  if (phaseEl) phaseEl.textContent = shiftClock.label;
  if (timeIconEl) timeIconEl.textContent = shiftClock.icon;
  if (timePill) {
    timePill.classList.remove('phase-morning', 'phase-day', 'phase-golden', 'phase-evening');
    timePill.classList.add(`phase-${shiftClock.phase}`);
    timePill.title = `${shiftClock.description} · ${shiftClock.clock}`;
  }
  if (repEl) repEl.textContent = Math.round(gameState.reputation);
  if (queueEl) queueEl.textContent = gameState.queue.length;

  if (shiftFill) {
    const pct = (gameState.shiftTimeRemaining / BALANCE.time.shiftDurationMs) * 100;
    shiftFill.style.width = Math.max(0, pct) + '%';
  }
}

export function destroyHUD() {
  if (_hudElement) {
    _hudElement.remove();
    _hudElement = null;
  }
  const existing = document.getElementById('game-hud');
  if (existing) existing.remove();
}
