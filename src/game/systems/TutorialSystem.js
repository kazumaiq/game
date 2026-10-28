/**
 * TutorialSystem — пошаговое понятное обучение (Шаг 1 из 4 ... Шаг 4 из 4).
 * Лаконичные подсказки, не перекрывающие игровое поле.
 */
import gameState from './GameState.js';

const TUTORIAL_STEPS = [
  {
    step: 0,
    badge: 'Шаг 1 из 4',
    title: 'Подойди к машине',
    text: 'Управляй джойстиком слева (или WASD на ПК) и подойди к автомобилю в боксе.',
  },
  {
    step: 1,
    badge: 'Шаг 2 из 4',
    title: 'Нажми «Начать мойку»',
    text: 'Подойди вплотную к автомобилю и нажми большую круглую кнопку «ДЕЙСТВИЕ» справа.',
  },
  {
    step: 2,
    badge: 'Шаг 3 из 4',
    title: 'Нанеси пену и смой грязь',
    text: 'Продолжай нажимать кнопку действия, чтобы пройти этапы: пена → смыв → сушка.',
  },
  {
    step: 3,
    badge: 'Шаг 4 из 4',
    title: 'Заверши мойку и получи оплату',
    text: 'Машина помыта! Клиент рассчитается, а выручка поступит на твой счет.',
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
    div.className = 'tutorial-badge-overlay';
    div.id = 'tutorial-badge-overlay';
    div.innerHTML = `
      <div class="tutorial-compact-pill">
        <span class="step-num">${stepData.badge}</span>
        <div class="step-desc">
          <strong>${stepData.title}:</strong> ${stepData.text}
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
    const existing = document.getElementById('tutorial-badge-overlay');
    if (existing) existing.remove();
  }

  complete() {
    this._remove();
  }
}

export default TutorialSystem;
