/**
 * TutorialSystem — конечный автомат пошагового обучения (Шаги 1–4).
 * Гарантирует наличие целевого автомобиля, корректные переходы без зависаний
 * и автоматическое завершение после успешной мойки и оплаты.
 */
import gameState from './GameState.js';
import saveSystem from './SaveSystem.js';
import { showToast } from '../../ui/ToastUI.js';

export const TUTORIAL_STEP = {
  APPROACH: 0,
  START: 1,
  WASH: 2,
  COMPLETE: 3,
};

export const TUTORIAL_STEPS = [
  {
    step: TUTORIAL_STEP.APPROACH,
    badge: 'Шаг 1 из 4',
    title: 'Подойди к машине',
    text: 'Управляй джойстиком слева (или WASD) и подойди к первому автомобилю в Боксе 1.',
  },
  {
    step: TUTORIAL_STEP.START,
    badge: 'Шаг 2 из 4',
    title: 'Начни обслуживание',
    text: 'Подойди вплотную к автомобилю и нажми кнопку «НАЧАТЬ МОЙКУ» справа (или клавишу [E]).',
  },
  {
    step: TUTORIAL_STEP.WASH,
    badge: 'Шаг 3 из 4',
    title: 'Нанеси пену и смой грязь',
    text: 'Нажимай кнопку действия, чтобы поэтапно нанести пену и выполнить смывание.',
  },
  {
    step: TUTORIAL_STEP.COMPLETE,
    badge: 'Шаг 4 из 4',
    title: 'Заверши мойку и получи оплату',
    text: 'Заверши финальную обработку, чтобы клиент рассчитался за заказ.',
  },
];

export class TutorialSystem {
  constructor() {
    this._element = null;
    this._hiddenByDialog = false;
  }

  start(scene) {
    if (gameState.tutorialCompleted) {
      this._remove();
      return;
    }
    if (scene) {
      this.ensureTargetCar(scene);
    }
    this.update();
  }

  update() {
    if (gameState.tutorialCompleted) {
      this._remove();
      return;
    }

    if (this._hiddenByDialog) return;

    const stepData = TUTORIAL_STEPS.find(s => s.step === gameState.tutorialStep);
    if (!stepData) {
      // Если шаг вышел за пределы, завершаем обучение
      if (gameState.tutorialStep >= 3) {
        this.complete();
      }
      return;
    }

    this._show(stepData);
  }

  /**
   * Гарантирует наличие целевой обучающей машины в Боксе 1
   */
  ensureTargetCar(scene) {
    if (gameState.tutorialCompleted) return null;

    const post1 = gameState.posts[0];
    if (!post1.busy || !post1.carId || !gameState.getCar(post1.carId)) {
      // Ищем свободную машину или создаем новую
      let car = gameState.cars.find(c => !c.completed && !c.paid);
      if (!car) {
        car = gameState.addCar('sedan');
      }
      if (car) {
        post1.busy = false;
        post1.carId = null;
        gameState.assignCarToPost(car.id, post1.id);
        gameState.tutorialCarId = car.id;

        if (scene && scene._carSprites) {
          let sprite = scene._carSprites[car.id];
          if (!sprite || !sprite.active) {
            const pos = { x: 300, y: 310 };
            sprite = scene.add.image(pos.x, pos.y + 12, 'car_sedan_dirty');
            sprite.setDepth(10);
            scene._carSprites[car.id] = sprite;
          }
        }
      }
      return car;
    }
    gameState.tutorialCarId = post1.carId;
    return gameState.getCar(post1.carId);
  }

  advance(expectedStep) {
    if (gameState.tutorialCompleted) return;
    const ok = gameState.advanceTutorial(expectedStep);
    if (ok) {
      this.update();
    }
  }

  /**
   * Завершение обучения: вызывается сразу после начисления оплаты за первую машину
   */
  complete(profit = 500) {
    if (gameState.tutorialCompleted) return;

    this._remove();
    gameState.completeTutorial();
    saveSystem.save();

    showToast(`🎉 Обучение завершено! Оплата получена (+${profit} ₽). Развивай бизнес!`, 'success');
  }

  hide() {
    this._hiddenByDialog = true;
    if (this._element) {
      this._element.style.display = 'none';
    }
  }

  show() {
    this._hiddenByDialog = false;
    if (this._element && !gameState.tutorialCompleted) {
      this._element.style.display = 'flex';
    } else {
      this.update();
    }
  }

  _show(stepData) {
    this._remove();

    // Размещаем в контейнер #tutorial-slot внутри HUD (если доступен), иначе в #ui-overlay
    const slot = document.getElementById('tutorial-slot') || document.getElementById('ui-overlay');
    if (!slot) return;

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
    slot.appendChild(div);
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
}

export const tutorialSystem = new TutorialSystem();
export default tutorialSystem;
