/**
 * CarWashScene — оптимизированная сцена с правильным полезным масштабом камеры,
 * четким фокусом на персонаже, информативной кнопкой действия и подсказками расстояния.
 */
import gameState from '../systems/GameState.js';
import BALANCE from '../config/balance.js';
import saveSystem from '../systems/SaveSystem.js';
import { createHUD, updateHUD, destroyHUD } from '../../ui/HudUI.js';
import { showWashProgress, hideWashProgress } from '../../ui/WashProgressUI.js';
import { showToast } from '../../ui/ToastUI.js';
import { StorySystem } from '../systems/StorySystem.js';
import { TutorialSystem } from '../systems/TutorialSystem.js';

// Пропорциональная компактная площадка (мир оптимизирован под мобильные и десктоп)
const WORLD = {
  width: 900,
  height: 640,
  // Административное здание
  building: { x: 450, y: 105 },
  // 2 моечных бокса
  posts: [
    { x: 300, y: 310, label: 'Бокс 1' },
    { x: 600, y: 310, label: 'Бокс 2' },
  ],
  // Зона ожидания клиентов
  queueStart: { x: 130, y: 490 },
  queueSpacing: 70,
  // Въезд и выезд
  entrance: { x: 40, y: 575 },
  exit: { x: 860, y: 575 },
  roadY: 585,
  // Стартовая позиция игрока
  playerStart: { x: 450, y: 390 },
};

export default class CarWashScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CarWashScene' });
  }

  create() {
    this._destroyed = false;
    this.cameras.main.setBackgroundColor('#0b0e14');

    this._createEnvironment();
    this._createPlayer();
    this._setupControls();

    this._carSprites = {};
    this._washingCar = null;
    this._isWashing = false;

    this._spawnTimer = 0;
    this._shiftTimer = 0;
    this._employeeTimers = {};
    this._walkAnimTimer = 0;
    this._walkFrame = 0;

    this._storySystem = new StorySystem();
    this._tutorialSystem = new TutorialSystem();

    createHUD(this);
    saveSystem.startAutoSave();

    this._spawnTimer = BALANCE.customer.spawnIntervalBase * 0.2;
    this._storySystem.checkEvents(this);

    if (!gameState.tutorialCompleted) {
      this._tutorialSystem.start();
    }

    this._onStateChanged = () => updateHUD();
    gameState.on('stateChanged', this._onStateChanged);

    this.scale.on('resize', this._handleResize, this);
    this._handleResize({ width: this.scale.width, height: this.scale.height });

    updateHUD();
  }

  _handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    // Оптимальный зум камеры: вблизи объекты четкие и крупные
    const minDim = Math.min(width, height);
    let targetZoom = 1.25;
    if (minDim < 420) {
      targetZoom = 1.0;
    } else if (minDim < 650) {
      targetZoom = 1.15;
    }

    this.cameras.main.setZoom(targetZoom);
  }

  _createEnvironment() {
    // 1. Газон вокруг
    for (let x = 0; x < WORLD.width; x += 64) {
      for (let y = 0; y < WORLD.height; y += 64) {
        this.add.image(x + 32, y + 32, 'lawn_tile').setDepth(0);
      }
    }

    // 2. Асфальтированная площадка автомойки
    const yardW = 820;
    const yardH = 470;
    const yardX = WORLD.width / 2;
    const yardY = 270;

    const border = this.add.rectangle(yardX, yardY, yardW + 10, yardH + 10, 0x334155);
    border.setDepth(1);

    const yard = this.add.tileSprite(yardX, yardY, yardW, yardH, 'asphalt_ground');
    yard.setDepth(2);

    // 3. Дорожная полоса снизу
    const road = this.add.tileSprite(WORLD.width / 2, WORLD.roadY, WORLD.width, 80, 'road_strip');
    road.setDepth(3);

    this.add.text(WORLD.entrance.x, WORLD.entrance.y - 32, '➔ ВЪЕЗД', {
      fontSize: '12px',
      color: '#38bdf8',
      fontStyle: 'bold',
      fontFamily: 'sans-serif',
    }).setDepth(4);

    this.add.text(WORLD.exit.x, WORLD.exit.y - 32, 'ВЫЕЗД ➔', {
      fontSize: '12px',
      color: '#22c55e',
      fontStyle: 'bold',
      fontFamily: 'sans-serif',
    }).setOrigin(1, 0).setDepth(4);

    // 4. Административное здание
    this._building = this.add.image(WORLD.building.x, WORLD.building.y, 'building_complex');
    this._building.setDepth(8);

    // 5. Боксы мойки
    this._postSprites = [];
    for (let i = 0; i < WORLD.posts.length; i++) {
      const pos = WORLD.posts[i];
      const postData = gameState.posts[i];
      const tex = postData.broken ? 'wash_bay_broken' : 'wash_bay_normal';
      
      const sprite = this.add.image(pos.x, pos.y, tex).setDepth(6);
      
      this.add.text(pos.x, pos.y - 68, pos.label, {
        fontSize: '13px',
        color: '#f8fafc',
        backgroundColor: '#0f172a',
        padding: { x: 8, y: 3 },
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(7);

      this._postSprites.push(sprite);
    }

    // 6. Декорации
    this.add.image(180, 180, 'potted_tree').setDepth(7);
    this.add.image(720, 180, 'potted_tree').setDepth(7);
    this.add.image(30, 260, 'lamp_post').setDepth(7);
    this.add.image(870, 260, 'lamp_post').setDepth(7);

    this.add.image(WORLD.entrance.x + 35, WORLD.entrance.y - 60, 'cone').setDepth(7);
    this.add.image(WORLD.entrance.x + 65, WORLD.entrance.y - 60, 'cone').setDepth(7);

    this.physics.world.setBounds(20, 170, WORLD.width - 40, WORLD.height - 210);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
  }

  _createPlayer() {
    this.player = this.physics.add.sprite(
      WORLD.playerStart.x,
      WORLD.playerStart.y,
      'player_idle'
    );
    this.player.setDepth(15);
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(24, 28);
    this.player.body.setOffset(9, 16);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  _setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.interactKey.on('down', () => this._handleInteract());
    this.escKey.on('down', () => this._handleEscape());

    this._joystickActive = false;
    this._joystickVec = { x: 0, y: 0 };
    this._createMobileTouchControls();
  }

  _createMobileTouchControls() {
    const overlay = document.getElementById('ui-overlay');
    if (document.getElementById('mobile-controls-root')) return;

    const root = document.createElement('div');
    root.id = 'mobile-controls-root';
    root.className = 'mobile-controls';
    root.innerHTML = `
      <div class="joystick-zone" id="joystick-zone">
        <div class="joystick-base" id="joystick-base">
          <div class="joystick-stick" id="joystick-stick"></div>
        </div>
      </div>
      <div class="interact-btn-container">
        <button class="mobile-action-btn" id="mobile-action-btn">
          <span class="icon">🚿</span>
          <span class="main-text" id="action-btn-text">ДЕЙСТВИЕ</span>
          <span class="subtext" id="action-btn-sub">НАЖМИ [E]</span>
        </button>
      </div>
    `;
    overlay.appendChild(root);
    this._touchControlsRoot = root;

    const zone = document.getElementById('joystick-zone');
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    const actionBtn = document.getElementById('mobile-action-btn');

    let touchId = null;

    const updateStick = (clientX, clientY) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxR = rect.width * 0.36;

      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }

      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      this._joystickVec.x = dx / maxR;
      this._joystickVec.y = dy / maxR;
      this._joystickActive = true;
    };

    const resetStick = () => {
      stick.style.transform = 'translate(0px, 0px)';
      this._joystickVec.x = 0;
      this._joystickVec.y = 0;
      this._joystickActive = false;
      touchId = null;
    };

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      touchId = t.identifier;
      updateStick(t.clientX, t.clientY);
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchId) {
          updateStick(t.clientX, t.clientY);
          break;
        }
      }
    }, { passive: false });

    zone.addEventListener('touchend', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          resetStick();
          break;
        }
      }
    });

    zone.addEventListener('touchcancel', resetStick);

    const triggerAction = (e) => {
      e.preventDefault();
      this._handleInteract();
    };

    actionBtn.addEventListener('touchstart', triggerAction, { passive: false });
    actionBtn.addEventListener('click', triggerAction);
  }

  _updateActionBtnContext() {
    const btnText = document.getElementById('action-btn-text');
    const btnSub = document.getElementById('action-btn-sub');
    if (!btnText || !btnSub) return;

    if (this._isWashing) {
      btnText.textContent = 'МОЙКА';
      btnSub.textContent = 'НАЖИМАЙ';
      return;
    }

    // Проверяем близость к сломанному боксу
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.broken) {
        const pos = WORLD.posts[i];
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
        if (dist < 100) {
          btnText.textContent = 'РЕМОНТ';
          btnSub.textContent = 'ПОЧИНИТЬ БОКС';
          return;
        }
      }
    }

    // Проверяем близость к машине в боксе
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.busy && post.carId) {
        const car = gameState.getCar(post.carId);
        if (car && !car.completed && !car.paid) {
          const pos = WORLD.posts[i];
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
          if (dist < 100) {
            btnText.textContent = 'НАЧАТЬ МОЙКУ';
            btnSub.textContent = 'ОБСЛУЖИТЬ АВТО';
            return;
          }
        }
      }
    }

    btnText.textContent = 'ДЕЙСТВИЕ';
    btnSub.textContent = 'ПОДОЙДИ БЛИЖЕ';
  }

  _handleInteract() {
    if (gameState.paused || !gameState.shiftActive) return;

    if (this._isWashing) {
      this._advanceWashStage();
      return;
    }

    // Ремонт сломанного бокса
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.broken) {
        const pos = WORLD.posts[i];
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
        if (dist < 100) {
          const result = gameState.repairPost(post.id);
          if (result.success) {
            this._postSprites[i].setTexture('wash_bay_normal');
            showToast('Бокс успешно отремонтирован!', 'success');
          } else {
            showToast(result.reason, 'warning');
          }
          return;
        }
      }
    }

    // Мойка машины
    let nearestCarDistance = Infinity;
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.busy && post.carId) {
        const car = gameState.getCar(post.carId);
        if (!car || car.completed || car.paid) continue;

        const pos = WORLD.posts[i];
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
        if (dist < nearestCarDistance) nearestCarDistance = dist;

        if (dist < 100) {
          this._startWashing(car.id);
          return;
        }
      }
    }

    if (nearestCarDistance < 220) {
      showToast('Подойди ближе к машине в боксе!', 'info');
    } else {
      showToast('Нет машин поблизости. Дождись заезда клиента в бокс!', 'info');
    }
  }

  _startWashing(carId) {
    const car = gameState.getCar(carId);
    if (!car || this._isWashing || car.completed) return;

    this._isWashing = true;
    this._washingCar = carId;
    car.washStage = 0;
    car.washProgress = 0;

    this.player.setTexture('player_work');

    const stages = BALANCE.services.expressWash.stages;
    const stageName = BALANCE.services.expressWash.stageNames[stages[0]];
    showWashProgress(stageName, 0, 'Нажимай кнопку для нанесения пены!');

    if (!gameState.tutorialCompleted && gameState.tutorialStep === 1) {
      gameState.tutorialStep = 2;
      this._tutorialSystem.update();
    }
  }

  _advanceWashStage() {
    const car = gameState.getCar(this._washingCar);
    if (!car) {
      this._stopWashing();
      return;
    }

    const stages = BALANCE.services.expressWash.stages;
    if (car.washProgress < 100) {
      car.washProgress += 25;
      if (car.washProgress > 100) car.washProgress = 100;

      const stageName = BALANCE.services.expressWash.stageNames[stages[car.washStage]];
      showWashProgress(stageName, car.washProgress, car.washProgress >= 100 ? 'Этап готов! Нажми для перехода' : 'Продолжай мойку!');
      this._updateCarVisual(car);

      if (car.washProgress >= 100) {
        if (car.washStage < stages.length - 1) {
          car.washStage++;
          car.washProgress = 0;
          const nextName = BALANCE.services.expressWash.stageNames[stages[car.washStage]];
          showWashProgress(nextName, 0, 'Нажимай кнопку действия!');
          this._updateCarVisual(car);
        } else {
          this._completeWash(car);
        }
      }
    } else {
      if (car.washStage < stages.length - 1) {
        car.washStage++;
        car.washProgress = 0;
        const nextName = BALANCE.services.expressWash.stageNames[stages[car.washStage]];
        showWashProgress(nextName, 0, 'Нажимай кнопку действия!');
        this._updateCarVisual(car);
      } else {
        this._completeWash(car);
      }
    }
  }

  _completeWash(car) {
    const qualityMult = gameState.getUpgradeEffect('equipmentQuality', 1);
    const quality = Math.min(1, 0.75 * qualityMult);

    car.quality = quality;
    car.state = 'done';
    car.completed = true;

    const profit = gameState.addServiceIncome(car.id, quality);
    hideWashProgress();
    this._isWashing = false;
    this._washingCar = null;
    this.player.setTexture('player_idle');

    showToast(`Готово! Клиент оплатил +${this._formatMoney(profit)}`, 'success');
    this._updateCarVisual(car);

    this.time.delayedCall(1400, () => {
      this._carLeave(car.id);
    });

    this._checkBreakdown(car.postId);

    if (!gameState.tutorialCompleted && gameState.tutorialStep === 2) {
      gameState.tutorialStep = 3;
      this._tutorialSystem.update();
    }

    updateHUD();
  }

  _stopWashing() {
    this._isWashing = false;
    this._washingCar = null;
    this.player.setTexture('player_idle');
    hideWashProgress();
  }

  _checkBreakdown(postId) {
    if (!postId) return;
    const reliabilityMult = gameState.getUpgradeEffect('reliability', 1);
    const chance = BALANCE.breakdown.baseChancePerWash * reliabilityMult;
    if (Math.random() < chance) {
      const idx = gameState.posts.findIndex(p => p.id === postId);
      if (idx !== -1) {
        gameState.breakPost(postId);
        this._postSprites[idx].setTexture('wash_bay_broken');
        showToast(`${WORLD.posts[idx].label} вышел из строя! Подойди для починки.`, 'warning');
      }
    }
  }

  _carLeave(carId) {
    const sprite = this._carSprites[carId];
    if (sprite) {
      this.tweens.add({
        targets: sprite,
        x: WORLD.exit.x + 80,
        y: WORLD.roadY,
        duration: 1200,
        ease: 'Power2',
        onComplete: () => {
          sprite.destroy();
          delete this._carSprites[carId];
        },
      });
    }
    for (const post of gameState.posts) {
      if (post.carId === carId) {
        post.busy = false;
        post.carId = null;
      }
    }
    gameState.removeCar(carId);
  }

  _spawnCar() {
    if (!gameState.shiftActive || gameState.paused) return;

    const demandMult = gameState.getDemandMultiplier();
    const maxQueue = gameState.getUpgradeEffect('capacity', BALANCE.customer.maxQueueSize);

    if (gameState.queue.length >= maxQueue) return;
    if (gameState.cars.length >= BALANCE.customer.maxActiveCars) return;

    const classes = Object.keys(BALANCE.carClasses);
    const weights = [0.35, 0.35, 0.2, 0.1];
    let r = Math.random();
    let classId = classes[0];
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) { classId = classes[i]; break; }
    }

    const car = gameState.addCar(classId);
    if (!car) return;

    const queueIndex = gameState.queue.indexOf(car.id);
    const targetX = WORLD.queueStart.x + queueIndex * WORLD.queueSpacing;
    const targetY = WORLD.queueStart.y;

    const sprite = this.add.image(WORLD.entrance.x - 30, WORLD.entrance.y, `car_${classId}_dirty`);
    sprite.setDepth(10);
    this._carSprites[car.id] = sprite;

    this.tweens.add({
      targets: sprite,
      x: targetX,
      y: targetY,
      duration: 1100,
      ease: 'Power2',
    });
  }

  _moveCarToPost(carId, postIndex) {
    const postPos = WORLD.posts[postIndex];
    const sprite = this._carSprites[carId];
    if (!sprite) return;

    const postData = gameState.posts[postIndex];
    const assigned = gameState.assignCarToPost(carId, postData.id);
    if (!assigned) return;

    this.tweens.add({
      targets: sprite,
      x: postPos.x,
      y: postPos.y + 14,
      duration: 850,
      ease: 'Power2',
    });
  }

  _updateCarVisual(car) {
    const sprite = this._carSprites[car.id];
    if (!sprite) return;

    const stages = BALANCE.services.expressWash.stages;
    const stage = stages[car.washStage];

    let texKey;
    if (car.completed) {
      texKey = `car_${car.carClass}`;
    } else if (stage === 'foam') {
      texKey = car.washProgress > 50 ? `car_${car.carClass}_foam` : `car_${car.carClass}_dirty`;
    } else if (stage === 'rinse') {
      texKey = car.washProgress > 50 ? `car_${car.carClass}` : `car_${car.carClass}_foam`;
    } else if (stage === 'finish') {
      texKey = `car_${car.carClass}`;
    } else {
      texKey = `car_${car.carClass}_dirty`;
    }

    if (this.textures.exists(texKey)) {
      sprite.setTexture(texKey);
    }
  }

  _processQueue() {
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (!post.busy && !post.broken && gameState.queue.length > 0) {
        const carId = gameState.queue[0];
        this._moveCarToPost(carId, i);
      }
    }

    for (let qi = 0; qi < gameState.queue.length; qi++) {
      const carId = gameState.queue[qi];
      const sprite = this._carSprites[carId];
      if (!sprite) continue;
      const targetX = WORLD.queueStart.x + qi * WORLD.queueSpacing;
      if (Math.abs(sprite.x - targetX) > 5) {
        this.tweens.add({
          targets: sprite,
          x: targetX,
          y: WORLD.queueStart.y,
          duration: 350,
          ease: 'Power2',
        });
      }
    }
  }

  _processPatience(delta) {
    const toRemove = [];
    for (const carId of gameState.queue) {
      const car = gameState.getCar(carId);
      if (!car) continue;
      car.waitTime += delta;
      if (car.waitTime >= car.patience) {
        toRemove.push(carId);
      }
    }

    for (const carId of toRemove) {
      showToast('Клиент устал ждать в очереди и уехал!', 'warning');
      gameState.changeReputation(BALANCE.reputation.missedCustomerPenalty);
      this._carLeave(carId);
    }
  }

  _processEmployees(delta) {
    for (const emp of gameState.employees) {
      if (emp.status !== 'idle') continue;

      for (let i = 0; i < gameState.posts.length; i++) {
        const post = gameState.posts[i];
        if (post.busy && post.carId && !post.broken) {
          const car = gameState.getCar(post.carId);
          if (car && car.state === 'washing' && !car.completed && !this._isEmployeeAssigned(post.id)) {
            if (this._washingCar === car.id) continue;
            emp.status = 'working';
            emp.assignedPost = post.id;
            emp.assignedCar = car.id;
            this._startEmployeeWash(emp, car);
            break;
          }
        }
      }
    }
  }

  _isEmployeeAssigned(postId) {
    return gameState.employees.some(e => e.assignedPost === postId && e.status === 'working');
  }

  _startEmployeeWash(emp, car) {
    const stages = BALANCE.services.expressWash.stages;
    car.washStage = 0;
    car.washProgress = 0;

    const speedMult = gameState.getUpgradeEffect('washSpeed', 1);
    const carClass = BALANCE.carClasses[car.carClass];
    const totalTime = BALANCE.services.expressWash.baseDuration * stages.length *
      carClass.timeMultiplier * speedMult / emp.speed;

    const stageTime = totalTime / stages.length;
    let currentStage = 0;

    const advanceStage = () => {
      if (this._destroyed) return;
      const freshCar = gameState.getCar(car.id);
      if (!freshCar || freshCar.completed || freshCar.paid) {
        emp.status = 'idle';
        emp.assignedPost = null;
        emp.assignedCar = null;
        return;
      }

      freshCar.washStage = currentStage;
      freshCar.washProgress = 100;
      this._updateCarVisual(freshCar);

      currentStage++;
      if (currentStage >= stages.length) {
        const qualityMult = gameState.getUpgradeEffect('equipmentQuality', 1);
        const quality = Math.min(1, emp.quality * qualityMult);
        freshCar.quality = quality;
        freshCar.state = 'done';
        freshCar.completed = true;
        gameState.addServiceIncome(freshCar.id, quality);
        this._updateCarVisual(freshCar);

        this.time.delayedCall(1400, () => {
          this._carLeave(freshCar.id);
        });

        this._checkBreakdown(freshCar.postId);

        emp.status = 'idle';
        emp.assignedPost = null;
        emp.assignedCar = null;
        updateHUD();
      } else {
        this._employeeTimers[emp.id] = this.time.delayedCall(stageTime, advanceStage);
      }
    };

    this._employeeTimers[emp.id] = this.time.delayedCall(stageTime, advanceStage);
  }

  _handleEscape() {
    const panels = document.querySelectorAll('.panel-overlay, .dialog-backdrop');
    if (panels.length > 0) {
      panels.forEach(p => p.remove());
      return;
    }

    gameState.paused = !gameState.paused;
    if (gameState.paused) {
      this.physics.pause();
      showToast('Пауза', 'info');
    } else {
      this.physics.resume();
      showToast('Продолжаем!', 'info');
    }
  }

  update(time, delta) {
    if (gameState.paused || !gameState.shiftActive) return;

    this._updatePlayerMovement(delta);

    this._spawnTimer += delta;
    const demandMult = gameState.getDemandMultiplier();
    const spawnInterval = (BALANCE.customer.spawnIntervalBase +
      (Math.random() * 2 - 1) * BALANCE.customer.spawnIntervalVariance) / demandMult;

    if (this._spawnTimer >= spawnInterval) {
      this._spawnTimer = 0;
      this._spawnCar();
    }

    this._processQueue();
    this._processPatience(delta);
    this._processEmployees(delta);

    this._shiftTimer += delta;
    gameState.shiftTimeRemaining = Math.max(0, BALANCE.time.shiftDurationMs - this._shiftTimer);

    this._updateDepth();
    this._updateActionBtnContext();

    if (Math.floor(time / 250) !== Math.floor((time - delta) / 250)) {
      updateHUD();
    }
  }

  _updatePlayerMovement(delta) {
    const speed = 190;
    let vx = 0, vy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vy = 1;

    if (this._joystickActive) {
      vx = this._joystickVec.x;
      vy = this._joystickVec.y;
    }

    const len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0) {
      vx = (vx / len) * speed;
      vy = (vy / len) * speed;

      this._walkAnimTimer += delta;
      if (this._walkAnimTimer > 170) {
        this._walkAnimTimer = 0;
        this._walkFrame = (this._walkFrame + 1) % 2;
        this.player.setTexture(this._walkFrame === 0 ? 'player_walk_1' : 'player_walk_2');
      }
    } else if (!this._isWashing) {
      this.player.setTexture('player_idle');
    }

    this.player.setVelocity(vx, vy);

    if (!gameState.tutorialCompleted && gameState.tutorialStep === 0 && len > 0) {
      for (let i = 0; i < gameState.posts.length; i++) {
        const post = gameState.posts[i];
        if (post.busy && post.carId) {
          const pos = WORLD.posts[i];
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
          if (dist < 100) {
            gameState.tutorialStep = 1;
            this._tutorialSystem.update();
          }
        }
      }
    }
  }

  _updateDepth() {
    this.player.setDepth(10 + this.player.y * 0.01);
    for (const carId of Object.keys(this._carSprites)) {
      const sprite = this._carSprites[carId];
      if (sprite && sprite.active) {
        sprite.setDepth(9 + sprite.y * 0.01);
      }
    }
  }

  endShift() {
    if (gameState.shiftEndProcessing) return;
    gameState.shiftEndProcessing = true;

    this._stopWashing();

    for (const timerId of Object.keys(this._employeeTimers)) {
      if (this._employeeTimers[timerId]) {
        this._employeeTimers[timerId].remove(false);
      }
    }
    this._employeeTimers = {};

    for (const emp of gameState.employees) {
      emp.status = 'idle';
      emp.assignedPost = null;
      emp.assignedCar = null;
    }

    const remainingCars = [...gameState.cars];
    for (const car of remainingCars) {
      if (!car.completed) {
        gameState.changeReputation(BALANCE.reputation.missedCustomerPenalty);
      }
      const sprite = this._carSprites[car.id];
      if (sprite) {
        sprite.destroy();
        delete this._carSprites[car.id];
      }
    }
    gameState.cars = [];
    gameState.queue = [];

    for (const post of gameState.posts) {
      post.busy = false;
      post.carId = null;
    }

    gameState.applyDailyExpenses();
    saveSystem.save();
    this._storySystem.checkEvents(this);
    this._showDayReport();

    gameState.shiftEndProcessing = false;
  }

  _showDayReport() {
    const overlay = document.getElementById('ui-overlay');
    const todayLogs = gameState.financialLog.filter(l => l.day === gameState.day);
    const income = todayLogs.filter(l => l.type === 'income').reduce((s, l) => s + l.amount, 0);
    const expenses = todayLogs.filter(l => l.type === 'expense').reduce((s, l) => s + l.amount, 0);
    const profit = income - expenses;

    let rows = '';
    for (const log of todayLogs) {
      const cls = log.type === 'income' ? 'income' : 'expense';
      const sign = log.type === 'income' ? '+' : '-';
      rows += `<tr class="${cls}"><td>${log.description}</td><td>${sign}${this._formatMoney(log.amount)}</td></tr>`;
    }

    const panel = document.createElement('div');
    panel.className = 'panel-overlay';
    panel.innerHTML = `
      <div class="panel">
        <button class="panel-close" id="report-close">✕</button>
        <h2>Итоги смены ${gameState.day}</h2>
        <table class="finance-table">
          ${rows}
          <tr class="total">
            <td>Прибыль за смену</td>
            <td style="color:${profit >= 0 ? '#22c55e' : '#ef4444'}">${profit >= 0 ? '+' : ''}${this._formatMoney(profit)}</td>
          </tr>
        </table>
        <p style="margin-top:10px;color:#cbd5e1;font-size:12px;">Помыто: <strong>${gameState.stats.todayCarsWashed}</strong> машин</p>
        <p style="color:#cbd5e1;font-size:12px;">Баланс кассы: <strong style="color:#38bdf8">${this._formatMoney(gameState.money)}</strong></p>
        ${gameState.money < 0 ? '<p style="color:#ef4444;font-weight:bold;margin-top:6px;font-size:12px;">⚠ Баланс ушел в минус! Оптимизируйте расходы.</p>' : ''}
        <div style="text-align:center;margin-top:14px;">
          <button class="game-btn primary" id="next-day-btn" style="width:100%;">Начать следующий рабочий день</button>
        </div>
      </div>
    `;
    overlay.appendChild(panel);

    document.getElementById('report-close').addEventListener('click', () => panel.remove());
    document.getElementById('next-day-btn').addEventListener('click', () => {
      panel.remove();
      this._startNextDay();
    });

    if (!gameState.tutorialCompleted && gameState.tutorialStep === 3) {
      gameState.tutorialCompleted = true;
      gameState.tutorialStep = 4;
      this._tutorialSystem.complete();
      saveSystem.save();
    }
  }

  _startNextDay() {
    gameState.nextDay();
    this._shiftTimer = 0;
    this._spawnTimer = 0;
    this._storySystem.checkEvents(this);
    updateHUD();
    saveSystem.save();
  }

  _formatMoney(amount) {
    if (typeof amount !== 'number' || !isFinite(amount)) return '0 ₽';
    return amount.toLocaleString('ru-RU') + ' ₽';
  }

  shutdown() {
    this._destroyed = true;
    this.scale.off('resize', this._handleResize, this);
    saveSystem.stopAutoSave();
    gameState.off('stateChanged', this._onStateChanged);
    destroyHUD();
    hideWashProgress();

    if (this._touchControlsRoot) {
      this._touchControlsRoot.remove();
      this._touchControlsRoot = null;
    }

    for (const timerId of Object.keys(this._employeeTimers)) {
      if (this._employeeTimers[timerId]) {
        this._employeeTimers[timerId].remove(false);
      }
    }
  }
}
