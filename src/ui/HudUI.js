/**
 * HudUI — верхняя панель информации + кнопки управления.
 */
import gameState from '../game/systems/GameState.js';
import BALANCE from '../game/config/balance.js';
import { showBusinessPanel } from './BusinessPanelUI.js';
import { showUpgradePanel } from './UpgradePanelUI.js';
import { showToast } from './ToastUI.js';
import saveSystem from '../game/systems/SaveSystem.js';

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
  hud.innerHTML = `
    <div class="hud">
      <div class="hud-left">
        <div class="hud-stat"><span class="label">Баланс</span> <span class="value" id="hud-money">0 ₽</span></div>
        <div class="hud-stat"><span class="label">День</span> <span class="value" id="hud-day">1</span></div>
      </div>
      <div class="hud-center">
        <div class="hud-stat"><span class="label">Репутация</span> <span class="value" id="hud-rep">50</span></div>
        <div class="hud-stat"><span class="label">Очередь</span> <span class="value" id="hud-queue">0</span></div>
        <div class="hud-stat"><span class="label">Помыто</span> <span class="value" id="hud-washed">0</span></div>
      </div>
      <div class="hud-right">
        <button class="game-btn" id="hud-business">Бизнес</button>
        <button class="game-btn" id="hud-upgrades">Улучшения</button>
        <button class="game-btn" id="hud-pause">⏸</button>
        <button class="game-btn primary" id="hud-end-shift">Завершить смену</button>
      </div>
    </div>
    <div id="hud-posts" style="position:absolute;top:40px;left:12px;display:flex;gap:6px;">
      <div class="hud-stat" id="hud-post-1"><span class="label">Пост 1:</span> <span class="value" id="hud-post1-status">Свободен</span></div>
      <div class="hud-stat" id="hud-post-2"><span class="label">Пост 2:</span> <span class="value" id="hud-post2-status">Свободен</span></div>
    </div>
    <div id="hud-shift-bar" style="position:absolute;top:40px;right:12px;">
      <div class="hud-stat"><span class="label">Смена</span>
        <div class="progress-bar" style="width:100px;display:inline-block;vertical-align:middle;">
          <div class="fill" id="hud-shift-fill" style="width:100%"></div>
        </div>
      </div>
    </div>
  `;
  overlay.appendChild(hud);
  _hudElement = hud;

  // Event listeners
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
    if (confirm('Завершить смену? Оставшиеся клиенты уедут.')) {
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
  const washedEl = document.getElementById('hud-washed');
  const shiftFill = document.getElementById('hud-shift-fill');

  if (moneyEl) {
    moneyEl.textContent = fmt(gameState.money);
    moneyEl.className = gameState.money < 0 ? 'value negative' : 'value';
  }
  if (dayEl) dayEl.textContent = gameState.day;
  if (repEl) repEl.textContent = Math.round(gameState.reputation);
  if (queueEl) queueEl.textContent = gameState.queue.length;
  if (washedEl) washedEl.textContent = gameState.stats.todayCarsWashed;

  if (shiftFill) {
    const pct = (gameState.shiftTimeRemaining / BALANCE.time.shiftDurationMs) * 100;
    shiftFill.style.width = Math.max(0, pct) + '%';
  }

  // Статусы постов
  for (let i = 0; i < gameState.posts.length; i++) {
    const el = document.getElementById(`hud-post${i + 1}-status`);
    if (!el) continue;
    const post = gameState.posts[i];
    if (post.broken) {
      el.textContent = 'Сломан!';
      el.style.color = '#ff6b6b';
    } else if (post.busy) {
      el.textContent = 'Занят';
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
