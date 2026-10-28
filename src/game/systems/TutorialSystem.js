/**
 * TutorialSystem — интерактивное обучение в верхней части экрана (banner-style).
 * Не перекрывает сцену и диалоговые окна.
 */
import gameState from './GameState.js';

const TUTORIAL_STEPS = [
  {
    step: 0,
    title: 'Шаг 1: Подойдите к посту',
    text: 'Используйте джойстик (слева) или WASD, чтобы подойти к машине в боксе.',
  },
  {
    step: 1,
    title: 'Шаг 2: Начните мойку',
    text: 'Подойдите вплотную и нажмите большую кнопку «ДЕЙСТВИЕ» (или E на ПК).',
  },
  {
    step: 2,
    title: 'Шаг 3: Пройдите этапы мойки',
    text: 'Нажимайте кнопку действия для нанесения пены, смывания водой и сушки.',
  },
  {
    step: 3,
    title: 'Шаг 4: Получите оплату',
    text: 'Автомобиль вымыт и оплачен! Изучите вкладку 💼 «Бизнес» или ⚡ «Улучшения».',
  },
  {
    step: 4,
    title: 'Шаг 5: Завершите смену',
    text: 'Когда будете готовы, нажмите «Смена ❯» в правом верхнем углу для подсчета прибыли.',
  },
];

export class TutorialSystem {
  constructor() {
    this._element = null;
  }

  start() {
    if (gameState.tutorialCompleted) return;
    this.update();
  }

  update() {
    if (gameState.tutorialCompleted) {
      this._remove();
      return;
    }

    const stepData = TUTORIAL_STEPS.find(s => s.step === gameState.tutorialStep);
    if (!stepData) return;

    this._show(stepData);
  }

  _show(stepData) {
    this._remove();

    const overlay = document.getElementById('ui-overlay');
    const div = document.createElement('div');
    div.className = 'tutorial-overlay';
    div.id = 'tutorial-overlay';
    div.innerHTML = `
      <div class="tutorial-banner">
        <div class="tutorial-step-tag">ОБУЧЕНИЕ</div>
        <div class="tutorial-content">
          <h4>${stepData.title}</h4>
          <p>${stepData.text}</p>
        </div>
      </div>
    `;
    overlay.appendChild(div);
    this._element = div;
  }

  _remove() {
    if (this._element) {
      this._element.remove();
      this._element = null;
    }
    const existing = document.getElementById('tutorial-overlay');
    if (existing) existing.remove();
  }

  complete() {
    this._remove();
  }
}

export default TutorialSystem;
