/**
 * MenuUI — главное меню с динамическим статусом полноэкранного режима.
 */
import FullscreenManager from '../game/systems/FullscreenManager.js';

let _menuElement = null;

export function showMenu({ hasSave, onNewGame, onContinue }) {
  hideMenu();

  const overlay = document.getElementById('ui-overlay');
  const div = document.createElement('div');
  div.className = 'menu-screen';
  div.id = 'main-menu';

  const isFs = FullscreenManager.isFullscreen();

  div.innerHTML = `
    <h1 class="menu-title">АВТОМОЙКА</h1>
    <p class="menu-subtitle">Бизнес на грани</p>
    <div class="menu-buttons">
      <button class="game-btn primary" id="menu-new-game">Новая игра</button>
      <button class="game-btn" id="menu-continue" ${hasSave ? '' : 'disabled'}>Продолжить</button>
      <button class="game-btn" id="menu-fullscreen">${isFs ? 'Выйти из полноэкранного режима' : 'Полный экран ⛶'}</button>
    </div>
  `;
  overlay.appendChild(div);
  _menuElement = div;

  document.getElementById('menu-new-game').addEventListener('click', onNewGame);
  if (hasSave) {
    document.getElementById('menu-continue').addEventListener('click', onContinue);
  }

  const fsBtn = document.getElementById('menu-fullscreen');
  fsBtn.addEventListener('click', () => {
    FullscreenManager.toggleFullscreen((active) => {
      fsBtn.textContent = active ? 'Выйти из полноэкранного режима' : 'Полный экран ⛶';
    });
  });

  FullscreenManager.initListeners((active) => {
    const b = document.getElementById('menu-fullscreen');
    if (b) b.textContent = active ? 'Выйти из полноэкранного режима' : 'Полный экран ⛶';
  });
}

export function hideMenu() {
  if (_menuElement) {
    _menuElement.remove();
    _menuElement = null;
  }
  const existing = document.getElementById('main-menu');
  if (existing) existing.remove();
}
