/**
 * TutorialSystem — интерактивное обучение.
 */
import gameState from './GameState.js';

const TUTORIAL_STEPS = [
  {
    step: 0,
    title: 'Шаг 1: Подойдите к машине',
    text: 'Используйте WASD или джойстик, чтобы подойти к машине на моечном посту.',
  },
  {
    step: 1,
    title: 'Шаг 2: Начните мойку',
    text: 'Нажмите E или кнопку взаимодействия рядом с машиной.',
  },
  {
    step: 2,
    title: 'Шаг 3: Выполните все этапы',
    text: 'Нажимайте E для каждого этапа: пена → смывание → финишная обработка.',
  },
  {
    step: 3,
    title: 'Шаг 4: Получите оплату',
    text: 'Отлично! Вы получили деньги за мойку. Откройте управление бизнесом для финансового отчёта.',
  },
  {
    step: 4,
    title: 'Шаг 5: Завершите смену',
    text: 'Нажмите кнопку «Завершить смену» для подведения итогов дня.',
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
      <div class="tutorial-box">
        <h4>${stepData.title}</h4>
        <p>${stepData.text}</p>
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
