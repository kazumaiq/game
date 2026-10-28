/**
 * HudUI — адаптивный интерфейс: компактный мобильный вид + десктоп.
 */
import gameState from '../game/systems/GameState.js';
import BALANCE from '../game/config/balance.js';
import { showBusinessPanel } from './BusinessPanelUI.js';
import { showUpgradePanel } from './UpgradePanelUI.js';
import { showToast } from './ToastUI.js';

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
  hud.className = 'hud';
  hud.innerHTML = `
    <div class="hud-top-bar">
      <div class="hud-stats-group">
        <div class="hud-stat"><span class="label">₽</span> <span class="value" id="hud-money">0 ₽</span></div>
        <div class="hud-stat"><span class="label">День</span> <span class="value" id="hud-day">1</span></div>
        <div class="hud-stat"><span class="label">★</span> <span class="value" id="hud-rep">50</span></div>
      </div>
      <div class="hud-buttons-group">
        <button class="game-btn icon-btn" id="hud-business" title="Бизнес">💼</button>
        <button class="game-btn icon-btn" id="hud-upgrades" title="Улучшения">⚡</button>
        <button class="game-btn icon-btn" id="hud-pause" title="Пауза">⏸</button>
        <button class="game-btn primary" id="hud-end-shift" style="font-size:11px;padding:4px 8px;min-height:32px;">Смена ❯</button>
      </div>
    </div>
    <div class="hud-sub-bar">
      <div class="hud-stats-group">
        <div class="hud-stat" id="hud-post-1"><span class="label">П1:</span> <span class="value" id="hud-post1-status">Свободен</span></div>
        <div class="hud-stat" id="hud-post-2"><span class="label">П2:</span> <span class="value" id="hud-post2-status">Свободен</span></div>
        <div class="hud-stat"><span class="label">Очередь:</span> <span class="value" id="hud-queue">0</span></div>
      </div>
      <div class="hud-stat" style="min-width:70px;">
        <span class="label">Смена</span>
        <div class="progress-bar" style="width:40px;display:inline-block;vertical-align:middle;margin:0 2px;">
          <div class="fill" id="hud-shift-fill" style="width:100%"></div>
        </div>
      </div>
    </div>
  `;
  overlay.appendChild(hud);
  _hudElement = hud;

  document.getElementById('hud-business').addEventListener('click', () => showBusinessPanel());
  document.getElementById('hud-upgrades').addEventListener('click', () => showUpgradePanel());
  document.getElementById('hud-pause').addEventListener('click', () => {
    gameState.paused = !gameState.paused;
    if (gameState.paused) {
      _scene.physics.pause();
      document.getElementById('hud-pause').textContent = '▶';
      showToast('ПАУЗА', 'info');
    } else {
      _scene.physics.resume();
      document.getElementById('hud-pause').textContent = '⏸';
    }
  });

  document.getElementById('hud-end-shift').addEventListener('click', () => {
    if (confirm('Завершить смену?')) {
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

  if (moneyEl) {
    moneyEl.textContent = fmt(gameState.money);
    moneyEl.className = gameState.money < 0 ? 'value negative' : 'value';
  }
  if (dayEl) dayEl.textContent = gameState.day;
  if (repEl) repEl.textContent = Math.round(gameState.reputation);
  if (queueEl) queueEl.textContent = gameState.queue.length;

  if (shiftFill) {
    const pct = (gameState.shiftTimeRemaining / BALANCE.time.shiftDurationMs) * 100;
    shiftFill.style.width = Math.max(0, pct) + '%';
  }

  for (let i = 0; i < gameState.posts.length; i++) {
    const el = document.getElementById(`hud-post${i + 1}-status`);
    if (!el) continue;
    const post = gameState.posts[i];
    if (post.broken) {
      el.textContent = 'Слом!';
      el.style.color = '#ff6b6b';
    } else if (post.busy) {
      el.textContent = 'Мойка';
      el.style.color = '#f0932b';
    } else {
      el.textContent = 'Свободен';
      el.style.color = '#2ed573';
    }
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
