/**
 * CarWashScene — основной игровой мир.
 * Управляет отрисовкой мира, персонажем, автомобилями и взаимодействием.
 */
import gameState from '../systems/GameState.js';
import BALANCE from '../config/balance.js';
import saveSystem from '../systems/SaveSystem.js';
import { createHUD, updateHUD, destroyHUD } from '../../ui/HudUI.js';
import { showWashProgress, hideWashProgress } from '../../ui/WashProgressUI.js';
import { showToast } from '../../ui/ToastUI.js';
import { StorySystem } from '../systems/StorySystem.js';
import { TutorialSystem } from '../systems/TutorialSystem.js';

// Позиции мира (изометрические координаты — упрощённая 2D проекция)
const WORLD = {
  width: 900,
  height: 700,
  // Здание
  building: { x: 450, y: 100 },
  // Вывеска
  sign: { x: 450, y: 55 },
  // Два моечных поста
  posts: [
    { x: 340, y: 280, label: 'Пост 1' },
    { x: 560, y: 280, label: 'Пост 2' },
  ],
  // Зона очереди
  queueStart: { x: 150, y: 500 },
  queueSpacing: 55,
  // Въезд/выезд
  entrance: { x: 100, y: 600 },
  exit: { x: 800, y: 600 },
  // Дорога
  road: { y: 620, height: 60 },
  // Стартовая позиция игрока
  playerStart: { x: 450, y: 380 },
  // Зона парковки
  parking: { x: 750, y: 400 },
};

export default class CarWashScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CarWashScene' });
  }

  create() {
    this._destroyed = false;
    this.cameras.main.setBackgroundColor('#2a2a3e');

    // Мир
    this._createWorld();

    // Персонаж
    this._createPlayer();

    // Управление
    this._setupControls();

    // Автомобили (спрайты)
    this._carSprites = {};

    // Системы
    this._washingCar = null;  // id машины, которую сейчас моет игрок
    this._washStageTimer = null;
    this._isWashing = false;

    // Таймеры
    this._spawnTimer = 0;
    this._shiftTimer = 0;

    // Сотрудники — автоматика
    this._employeeTimers = {};

    // Сюжет
    this._storySystem = new StorySystem();
    this._tutorialSystem = new TutorialSystem();

    // HUD
    createHUD(this);

    // Автосохранение
    saveSystem.startAutoSave();

    // Начальный спавн машины
    this._spawnTimer = BALANCE.customer.spawnIntervalBase * 0.3;

    // Проверяем сюжетные события на текущий день
    this._storySystem.checkEvents(this);

    // Запускаем туториал если нужно
    if (!gameState.tutorialCompleted) {
      this._tutorialSystem.start();
    }

    // Слушатели
    this._onStateChanged = () => updateHUD();
    gameState.on('stateChanged', this._onStateChanged);

    updateHUD();
  }

  _createWorld() {
    // Фон — асфальт
    for (let x = 0; x < WORLD.width; x += 64) {
      for (let y = 0; y < WORLD.height; y += 64) {
        if (y >= WORLD.road.y - 30 && y < WORLD.road.y + WORLD.road.height + 30) {
          this.add.image(x + 32, y + 32, 'tile_road').setDepth(0);
        } else {
          this.add.image(x + 32, y + 32, 'tile_concrete').setDepth(0);
        }
      }
    }

    // Асфальтовая территория мойки
    const territory = this.add.rectangle(WORLD.width / 2, 300, 500, 250, 0x3a3a4a, 0.6);
    territory.setDepth(0);

    // Здание
    this._building = this.add.image(WORLD.building.x, WORLD.building.y, 'building')
      .setDepth(2)
      .setScale(1.2);

    // Вывеска
    this._sign = this.add.image(WORLD.sign.x, WORLD.sign.y, 'sign').setDepth(3);

    // Посты
    this._postSprites = [];
    for (let i = 0; i < WORLD.posts.length; i++) {
      const pos = WORLD.posts[i];
      const postData = gameState.posts[i];
      const tex = postData.broken ? 'wash_post_broken' : 'wash_post';
      const sprite = this.add.image(pos.x, pos.y, tex).setDepth(1);
      sprite.setScale(1.1);

      // Метка
      this.add.text(pos.x, pos.y - 40, pos.label, {
        fontSize: '11px',
        color: '#aaa',
        fontFamily: 'sans-serif',
      }).setOrigin(0.5).setDepth(4);

      this._postSprites.push(sprite);
    }

    // Указатели очереди
    const queueLabel = this.add.text(WORLD.queueStart.x, WORLD.queueStart.y - 30, 'Очередь', {
      fontSize: '11px',
      color: '#f0932b',
      fontFamily: 'sans-serif',
    }).setOrigin(0.5).setDepth(4);

    // Разметка входа и выхода
    this.add.text(WORLD.entrance.x, WORLD.entrance.y - 20, '← Въезд', {
      fontSize: '10px', color: '#888', fontFamily: 'sans-serif',
    }).setDepth(4);
    this.add.text(WORLD.exit.x, WORLD.exit.y - 20, 'Выезд →', {
      fontSize: '10px', color: '#888', fontFamily: 'sans-serif',
    }).setOrigin(1, 0).setDepth(4);

    // Границы мира
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);

    // Камера
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
  }

  _createPlayer() {
    this.player = this.physics.add.sprite(
      WORLD.playerStart.x,
      WORLD.playerStart.y,
      'player'
    );
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);
    this.player.setScale(1.5);
    this.player.body.setSize(16, 20);

    // Камера следует за игроком
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.3);
  }

  _setupControls() {
    // Клавиатура
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

    // Виртуальный джойстик (мобильный)
    this._joystickActive = false;
    this._joystickVec = { x: 0, y: 0 };

    if (this._isMobile()) {
      this._createMobileControls();
    }
  }

  _isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || ('ontouchstart' in window);
  }

  _createMobileControls() {
    const overlay = document.getElementById('ui-overlay');

    // Джойстик
    const jz = document.createElement('div');
    jz.className = 'joystick-zone';
    jz.innerHTML = `<div class="joystick-base"><div class="joystick-stick" id="joystick-stick"></div></div>`;
    overlay.appendChild(jz);
    this._joystickElement = jz;

    const base = jz.querySelector('.joystick-base');
    const stick = jz.querySelector('#joystick-stick');
    const baseRect = { cx: 60, cy: 60, radius: 45 };

    // Центрируем стик
    stick.style.left = (baseRect.cx - 25) + 'px';
    stick.style.top = (baseRect.cy - 25) + 'px';

    const handleMove = (clientX, clientY) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = baseRect.radius;
      if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
      }
      stick.style.left = (baseRect.cx - 25 + dx) + 'px';
      stick.style.top = (baseRect.cy - 25 + dy) + 'px';
      this._joystickVec.x = dx / maxDist;
      this._joystickVec.y = dy / maxDist;
      this._joystickActive = true;
    };

    const handleEnd = () => {
      stick.style.left = (baseRect.cx - 25) + 'px';
      stick.style.top = (baseRect.cy - 25) + 'px';
      this._joystickVec.x = 0;
      this._joystickVec.y = 0;
      this._joystickActive = false;
    };

    base.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      handleMove(t.clientX, t.clientY);
    }, { passive: false });

    base.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      handleMove(t.clientX, t.clientY);
    }, { passive: false });

    base.addEventListener('touchend', handleEnd);
    base.addEventListener('touchcancel', handleEnd);

    // Кнопка взаимодействия
    const actionBar = document.createElement('div');
    actionBar.className = 'action-bar';
    actionBar.id = 'mobile-action-bar';
    actionBar.innerHTML = `<button class="action-btn interact" id="mobile-interact-btn">E</button>`;
    overlay.appendChild(actionBar);
    this._mobileActionBar = actionBar;

    document.getElementById('mobile-interact-btn').addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._handleInteract();
    });
  }

  _handleInteract() {
    if (gameState.paused || !gameState.shiftActive) return;

    // Проверяем, рядом ли с постом/машиной
    if (this._isWashing) {
      // Уже моем — продвигаем этап
      this._advanceWashStage();
      return;
    }

    // Проверяем ремонт
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.broken) {
        const pos = WORLD.posts[i];
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y, pos.x, pos.y
        );
        if (dist < 60) {
          const result = gameState.repairPost(post.id);
          if (result.success) {
            this._postSprites[i].setTexture('wash_post');
            showToast('Пост отремонтирован!', 'success');
          } else {
            showToast(result.reason, 'warning');
          }
          return;
        }
      }
    }

    // Ищем ближайшую машину на посту
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.busy && post.carId) {
        const car = gameState.getCar(post.carId);
        if (!car || car.completed || car.paid) continue;

        const pos = WORLD.posts[i];
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y, pos.x, pos.y
        );
        if (dist < 70) {
          this._startWashing(car.id);
          return;
        }
      }
    }

    // Подсказка
    showToast('Подойдите к машине на посту для начала мойки', 'info');
  }

  _startWashing(carId) {
    const car = gameState.getCar(carId);
    if (!car || this._isWashing) return;
    if (car.state !== 'washing' || car.completed) return;

    this._isWashing = true;
    this._washingCar = carId;
    car.washStage = 0;
    car.washProgress = 0;

    const stages = BALANCE.services.expressWash.stages;
    const stageName = BALANCE.services.expressWash.stageNames[stages[0]];
    showWashProgress(stageName, 0, 'Нажмите E / кнопку для обработки');

    // Обновляем туториал
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
    const speedMult = gameState.getUpgradeEffect('washSpeed', 1);
    const carClass = BALANCE.carClasses[car.carClass];
    const stageDuration = BALANCE.services.expressWash.baseDuration * carClass.timeMultiplier * speedMult;

    // Прогресс текущего этапа
    if (car.washProgress < 100) {
      car.washProgress += 25; // 4 нажатия на этап
      if (car.washProgress > 100) car.washProgress = 100;

      const stageName = BALANCE.services.expressWash.stageNames[stages[car.washStage]];
      showWashProgress(stageName, car.washProgress, car.washProgress >= 100 ? 'Нажмите E для следующего этапа' : 'Нажмите E для продолжения');

      // Обновляем визуал машины
      this._updateCarVisual(car);

      if (car.washProgress >= 100) {
        // Этап завершён — переходим к следующему
        if (car.washStage < stages.length - 1) {
          car.washStage++;
          car.washProgress = 0;
          const nextStageName = BALANCE.services.expressWash.stageNames[stages[car.washStage]];
          showWashProgress(nextStageName, 0, 'Нажмите E для обработки');
          this._updateCarVisual(car);
        } else {
          // Все этапы завершены
          this._completeWash(car);
        }
      }
      return;
    }

    // Если прогресс уже 100 — переход
    if (car.washStage < stages.length - 1) {
      car.washStage++;
      car.washProgress = 0;
      const nextStageName = BALANCE.services.expressWash.stageNames[stages[car.washStage]];
      showWashProgress(nextStageName, 0, 'Нажмите E для обработки');
      this._updateCarVisual(car);
    } else {
      this._completeWash(car);
    }
  }

  _completeWash(car) {
    // Качество обслуживания
    const qualityMult = gameState.getUpgradeEffect('equipmentQuality', 1);
    const quality = Math.min(1, 0.7 * qualityMult);

    car.quality = quality;
    car.state = 'done';
    car.completed = true;

    const profit = gameState.addServiceIncome(car.id, quality);

    hideWashProgress();
    this._isWashing = false;
    this._washingCar = null;

    showToast(`Мойка завершена! +${this._formatMoney(profit)}`, 'success');

    // Обновляем визуал
    this._updateCarVisual(car);

    // Через 2 секунды машина уезжает
    this.time.delayedCall(2000, () => {
      this._carLeave(car.id);
    });

    // Поломка?
    this._checkBreakdown(car.postId);

    // Туториал
    if (!gameState.tutorialCompleted && gameState.tutorialStep === 2) {
      gameState.tutorialStep = 3;
      this._tutorialSystem.update();
    }

    updateHUD();
  }

  _stopWashing() {
    this._isWashing = false;
    this._washingCar = null;
    hideWashProgress();
  }

  _checkBreakdown(postId) {
    if (!postId) return;
    const reliabilityMult = gameState.getUpgradeEffect('reliability', 1);
    const chance = BALANCE.breakdown.baseChancePerWash * reliabilityMult;
    if (Math.random() < chance) {
      const postIndex = gameState.posts.findIndex(p => p.id === postId);
      if (postIndex !== -1) {
        gameState.breakPost(postId);
        this._postSprites[postIndex].setTexture('wash_post_broken');
        showToast(`${WORLD.posts[postIndex].label} сломался! Нужен ремонт.`, 'warning');
      }
    }
  }

  _carLeave(carId) {
    const sprite = this._carSprites[carId];
    if (sprite) {
      this.tweens.add({
        targets: sprite,
        x: WORLD.exit.x + 50,
        duration: 1500,
        ease: 'Power2',
        onComplete: () => {
          sprite.destroy();
          delete this._carSprites[carId];
        },
      });
    }
    // Освобождаем пост
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

    // Выбираем случайный класс
    const classes = Object.keys(BALANCE.carClasses);
    const weights = [0.35, 0.35, 0.2, 0.1]; // compact, sedan, suv, premium
    let r = Math.random();
    let classId = classes[0];
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) { classId = classes[i]; break; }
    }

    const car = gameState.addCar(classId);
    if (!car) return;

    // Создаём спрайт
    const queueIndex = gameState.queue.indexOf(car.id);
    const targetX = WORLD.queueStart.x + queueIndex * WORLD.queueSpacing;
    const targetY = WORLD.queueStart.y;

    const texKey = `car_${classId}_dirty`;
    const sprite = this.add.image(WORLD.entrance.x - 30, WORLD.entrance.y, texKey);
    sprite.setDepth(5);
    sprite.setScale(1.8);

    this._carSprites[car.id] = sprite;

    // Анимация въезда
    this.tweens.add({
      targets: sprite,
      x: targetX,
      y: targetY,
      duration: 1500,
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
      y: postPos.y + 15,
      duration: 1000,
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
    // Перемещаем машины из очереди на посты
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (!post.busy && !post.broken && gameState.queue.length > 0) {
        const carId = gameState.queue[0];
        this._moveCarToPost(carId, i);
      }
    }

    // Обновляем позиции оставшихся в очереди
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
          duration: 500,
          ease: 'Power2',
        });
      }
    }
  }

  _processPatience(delta) {
    // Обновляем терпение клиентов в очереди
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
      showToast('Клиент уехал — устал ждать!', 'warning');
      gameState.changeReputation(BALANCE.reputation.missedCustomerPenalty);
      this._carLeave(carId);
    }
  }

  _processEmployees(delta) {
    for (const emp of gameState.employees) {
      if (emp.status !== 'idle') continue;

      // Ищем свободный пост с машиной
      for (let i = 0; i < gameState.posts.length; i++) {
        const post = gameState.posts[i];
        if (post.busy && post.carId && !post.broken) {
          const car = gameState.getCar(post.carId);
          if (car && car.state === 'washing' && !car.completed && !this._isEmployeeAssigned(post.id)) {
            // Если игрок уже моет эту машину — пропускаем
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

    // Автоматическая мойка — поэтапно
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
        // Завершение
        const qualityMult = gameState.getUpgradeEffect('equipmentQuality', 1);
        const quality = Math.min(1, emp.quality * qualityMult);
        freshCar.quality = quality;
        freshCar.state = 'done';
        freshCar.completed = true;
        gameState.addServiceIncome(freshCar.id, quality);
        this._updateCarVisual(freshCar);

        this.time.delayedCall(2000, () => {
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
    // Пауза или закрытие активного окна
    const panels = document.querySelectorAll('.panel-overlay');
    if (panels.length > 0) {
      panels.forEach(p => p.remove());
      return;
    }

    // Тогглим паузу
    gameState.paused = !gameState.paused;
    if (gameState.paused) {
      this.physics.pause();
      showToast('ПАУЗА', 'info');
    } else {
      this.physics.resume();
      showToast('Продолжаем!', 'info');
    }
  }

  update(time, delta) {
    if (gameState.paused || !gameState.shiftActive) return;

    // Движение персонажа
    this._updatePlayerMovement();

    // Спавн клиентов
    this._spawnTimer += delta;
    const demandMult = gameState.getDemandMultiplier();
    const spawnInterval = (BALANCE.customer.spawnIntervalBase +
      (Math.random() * 2 - 1) * BALANCE.customer.spawnIntervalVariance) / demandMult;

    if (this._spawnTimer >= spawnInterval) {
      this._spawnTimer = 0;
      this._spawnCar();
    }

    // Очередь → посты
    this._processQueue();

    // Терпение клиентов
    this._processPatience(delta);

    // Сотрудники
    this._processEmployees(delta);

    // Время смены
    this._shiftTimer += delta;
    gameState.shiftTimeRemaining = Math.max(0, BALANCE.time.shiftDurationMs - this._shiftTimer);

    // Глубина (z-sorting)
    this._updateDepth();

    // Обновление HUD (каждые ~200мс)
    if (Math.floor(time / 200) !== Math.floor((time - delta) / 200)) {
      updateHUD();
    }
  }

  _updatePlayerMovement() {
    const speed = 160;
    let vx = 0, vy = 0;

    // Клавиатура
    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vy = 1;

    // Джойстик
    if (this._joystickActive) {
      vx = this._joystickVec.x;
      vy = this._joystickVec.y;
    }

    // Нормализация
    const len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0) {
      vx = (vx / len) * speed;
      vy = (vy / len) * speed;
    }

    this.player.setVelocity(vx, vy);

    // Туториал: шаг 0 — подойти к машине
    if (!gameState.tutorialCompleted && gameState.tutorialStep === 0 && len > 0) {
      // Проверяем, подошёл ли к посту с машиной
      for (let i = 0; i < gameState.posts.length; i++) {
        const post = gameState.posts[i];
        if (post.busy && post.carId) {
          const pos = WORLD.posts[i];
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
          if (dist < 70) {
            gameState.tutorialStep = 1;
            this._tutorialSystem.update();
          }
        }
      }
    }
  }

  _updateDepth() {
    // Простой z-sort: чем ниже объект, тем ближе к камере
    this.player.setDepth(5 + this.player.y * 0.01);
    for (const carId of Object.keys(this._carSprites)) {
      const sprite = this._carSprites[carId];
      if (sprite && sprite.active) {
        sprite.setDepth(5 + sprite.y * 0.01);
      }
    }
  }

  /** Завершение смены */
  endShift() {
    if (gameState.shiftEndProcessing) return;
    gameState.shiftEndProcessing = true;

    // Останавливаем мойку
    this._stopWashing();

    // Останавливаем таймеры сотрудников
    for (const timerId of Object.keys(this._employeeTimers)) {
      if (this._employeeTimers[timerId]) {
        this._employeeTimers[timerId].remove(false);
      }
    }
    this._employeeTimers = {};

    // Сбрасываем статусы сотрудников
    for (const emp of gameState.employees) {
      emp.status = 'idle';
      emp.assignedPost = null;
      emp.assignedCar = null;
    }

    // Оставшиеся машины уезжают (штраф к репутации за каждую)
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

    // Освобождаем посты
    for (const post of gameState.posts) {
      post.busy = false;
      post.carId = null;
    }

    // Дневные расходы
    gameState.applyDailyExpenses();

    // Сохранение
    saveSystem.save();

    // Сюжетные проверки
    this._storySystem.checkEvents(this);

    // Финансовый отчёт
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
        <h2>Итоги дня ${gameState.day}</h2>
        <table class="finance-table">
          ${rows}
          <tr class="total">
            <td>Итого</td>
            <td style="color:${profit >= 0 ? '#2ed573' : '#ff6b6b'}">${profit >= 0 ? '+' : ''}${this._formatMoney(profit)}</td>
          </tr>
        </table>
        <p style="margin-top:12px;color:#aaa;">Обслужено: ${gameState.stats.todayCarsWashed} машин</p>
        <p style="color:#aaa;">Баланс: ${this._formatMoney(gameState.money)}</p>
        ${gameState.money < 0 ? '<p style="color:#ff6b6b;font-weight:bold;margin-top:8px;">⚠ Внимание: у вас отрицательный баланс!</p>' : ''}
        <div style="text-align:center;margin-top:16px;">
          <button class="game-btn primary" id="next-day-btn">Следующий день</button>
        </div>
      </div>
    `;
    overlay.appendChild(panel);

    document.getElementById('report-close').addEventListener('click', () => panel.remove());
    document.getElementById('next-day-btn').addEventListener('click', () => {
      panel.remove();
      this._startNextDay();
    });

    // Туториал
    if (!gameState.tutorialCompleted && gameState.tutorialStep === 4) {
      gameState.tutorialCompleted = true;
      gameState.tutorialStep = 5;
      this._tutorialSystem.complete();
      saveSystem.save();
    }
  }

  _startNextDay() {
    gameState.nextDay();
    this._shiftTimer = 0;
    this._spawnTimer = 0;

    // Проверяем сюжет
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
    saveSystem.stopAutoSave();
    gameState.off('stateChanged', this._onStateChanged);
    destroyHUD();
    hideWashProgress();

    // Убираем мобильные контролы
    if (this._joystickElement) this._joystickElement.remove();
    if (this._mobileActionBar) this._mobileActionBar.remove();

    // Очищаем таймеры сотрудников
    for (const timerId of Object.keys(this._employeeTimers)) {
      if (this._employeeTimers[timerId]) {
        this._employeeTimers[timerId].remove(false);
      }
    }
  }
}
