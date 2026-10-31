/**
 * CarWashScene — оптимизированная сцена с гарантированной целевой машиной в боксе 1
 * на старте новой игры, интерактивной неоновой рамкой подсветки цели,
 * depth-сортировкой (пол < машина < навес бокса < персонаж), проверками инспекций
 * и полноценным Fullscreen.
 */
import gameState from '../systems/GameState.js';
import BALANCE from '../config/balance.js';
import saveSystem from '../systems/SaveSystem.js';
import { createHUD, updateHUD, destroyHUD } from '../../ui/HudUI.js';
import { showWashProgress, hideWashProgress } from '../../ui/WashProgressUI.js';
import { showToast } from '../../ui/ToastUI.js';
import { StorySystem } from '../systems/StorySystem.js';
import { tutorialSystem, TutorialSystem } from '../systems/TutorialSystem.js';
import { audioManager } from '../systems/AudioManager.js';
import { getShiftClock, getDayCycleProfile } from '../systems/DayCycle.js';
import { ThreeWashEnvironment } from '../render/ThreeWashEnvironment.js';

const WORLD = {
  width: 900,
  height: 820,
  building: { x: 450, y: 105 },
  posts: [
    { x: 300, y: 310, label: 'Бокс 1' },
    { x: 600, y: 310, label: 'Бокс 2' },
    { x: 130, y: 402, label: 'Бокс 3', expansion: true },
    { x: 770, y: 402, label: 'Бокс 4', expansion: true },
  ],
  queueStart: { x: 130, y: 490 },
  queueSpacing: 70,
  entrance: { x: 40, y: 575 },
  exit: { x: 860, y: 575 },
  roadY: 585,
  playerStart: { x: 450, y: 390 },
};

export default class CarWashScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CarWashScene' });
  }

  create() {
    this._destroyed = false;
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    this._createEnvironment();
    this._threeEnvironment = new ThreeWashEnvironment(this);
    // Keep the established Phaser gameplay sprites and controls, but replace
    // the old flat yard artwork with the new real-time 3D environment.
    for (const object of this.children.list) {
      if (object !== this.player && Number(object.depth || 0) < 12) object.setVisible(false);
    }
    this._createPlayer();
    this._setupControls();

    this._carSprites = {};
    this._carShadows = {};
    this._washingCar = null;
    this._isWashing = false;
    this._coffeeRushUntil = 0;

    this._spawnTimer = 0;
    this._shiftTimer = 0;
    this._employeeTimers = {};
    this._employeeSprites = {};
    this._walkAnimTimer = 0;
    this._walkFrame = 0;
    this._dayCycleUpdateTimer = 0;
    this._createDayCycleEffects();

    // Графический маркер подсветки целевой машины во время обучения
    this._targetHighlight = this.add.graphics();
    this._targetHighlight.setDepth(18);

    // Слой струи воды и пены высокого давления
    this._sprayGfx = this.add.graphics();
    this._sprayGfx.setDepth(22);
    // Wet-floor pass sits below the vehicle and workers; one reusable Graphics
    // object is redrawn only while the active wash is running.
    this._wetFloorGfx = this.add.graphics().setDepth(18.6);
    this._wetFloorGfx.setBlendMode(Phaser.BlendModes.NORMAL);
    // Animated wash-bay hardware is drawn into one reusable layer; no per-frame sprites.
    this._equipmentGfx = this.add.graphics().setDepth(11.4);
    // Shared clear-coat pass: one Graphics object for every active vehicle.
    this._carFinishGfx = this.add.graphics().setDepth(24.4);
    this._carFinishUpdateTimer = 0;
    this._equipmentAnimTimer = 0;
    this._lastWetPosition = null;
    this._wetFloorUntil = 0;

    // Reusable emitters: continuous mist while the player washes, no per-frame
    // allocation of particle objects. Phaser 3.90 keeps these lightweight.
    this._waterMist = this.add.particles(0, 0, 'particle_water', {
      emitting: false,
      frequency: 28,
      quantity: 2,
      lifespan: { min: 260, max: 520 },
      speed: { min: 34, max: 105 },
      angle: { min: 205, max: 335 },
      gravityY: 58,
      scale: { start: 0.72, end: 0.08 },
      alpha: { start: 0.78, end: 0 },
      tint: [0xeffaff, 0x7dd3fc, 0x38bdf8],
      blendMode: Phaser.BlendModes.ADD,
      maxParticles: 42,
    }).setDepth(23);
    this._foamMist = this.add.particles(0, 0, 'particle_foam', {
      emitting: false,
      frequency: 48,
      quantity: 1,
      lifespan: { min: 420, max: 760 },
      speed: { min: 12, max: 52 },
      angle: { min: 205, max: 335 },
      gravityY: -8,
      scale: { start: 0.9, end: 0.18 },
      alpha: { start: 0.7, end: 0 },
      tint: [0xffffff, 0xe0f2fe],
      maxParticles: 26,
    }).setDepth(23.1);
    this._activeSprayEmitter = null;

    // One shared lightweight canvas layer tracks waiting-customer patience without
    // creating dozens of per-car DOM elements or particle emitters.
    this._queueMoodGfx = this.add.graphics().setDepth(20.4);
    this._queueMoodUpdateTimer = 0;

    this._storySystem = new StorySystem();
    this._tutorialSystem = tutorialSystem;

    createHUD(this);
    saveSystem.startAutoSave();

    // Если это новая игра и посты пусты — сразу ставим первую машину в Бокс 1!
    this._ensureInitialCar();

    this._storySystem.checkEvents(this);

    if (!gameState.tutorialCompleted) {
      this._tutorialSystem.start(this);
    }

    this._onStateChanged = () => {
      updateHUD();
      this._updateUpgradeVisuals();
      this._createCompetitorVisuals();
    };
    gameState.on('stateChanged', this._onStateChanged);
    this._createCompetitorVisuals();
    this._onAchievementUnlocked = (achievement) => {
      audioManager.play('success');
      showToast(`🏆 ${achievement.title} · +${this._formatMoney(achievement.reward)}`, 'success');
      if (this.player) this._spawnCleanSparkles(this.player.x, this.player.y - 20);
    };
    gameState.on('achievementUnlocked', this._onAchievementUnlocked);
    this._onPerfectStreakBonus = ({ streak, bonus, carId }) => {
      audioManager.play('success');
      showToast(`🔥 Серия идеальных моек ×${streak}! +${this._formatMoney(bonus)}`, 'success');
      const carSprite = this._carSprites[carId];
      if (carSprite && carSprite.active) this._spawnCleanSparkles(carSprite.x, carSprite.y - 12);
    };
    gameState.on('perfectStreakBonus', this._onPerfectStreakBonus);

    this.scale.on('resize', this._handleResize, this);
    this.events.once('shutdown', () => this._threeEnvironment?.dispose());
    this.events.once('destroy', () => this._threeEnvironment?.dispose());
    this._handleResize({ width: this.scale.width, height: this.scale.height });

    this._isCameraFollowingPlayer = false;
    this._updateCameraTracking(true);

    updateHUD();
  }

  /** Гарантированное размещение первой обучающей машины в боксе 1 */
  _ensureInitialCar() {
    this._tutorialSystem.ensureTargetCar(this);
  }

  _handleResize(gameSize) {
    const width = Math.max(1, gameSize.width);
    const height = Math.max(1, gameSize.height);
    const minDim = Math.min(width, height);
    const portraitPhone = width < 460 && height > width;

    // Keep the established, readable camera scale. The previous 0.68 zoom on
    // portrait phones made the yard tiny and pushed the player visually away.
    // Slightly wider view shows more of the yard without making the player tiny.
    let targetZoom = 1.08;
    if (minDim < 360) targetZoom = 0.92;
    else if (minDim < 420) targetZoom = 0.96;
    else if (minDim < 650) targetZoom = 1.0;

    const cam = this.cameras.main;
    cam.setZoom(targetZoom);
    cam.setBounds(0, 0, WORLD.width, WORLD.height);

    // Keep character scale stable; don't enlarge the sprite just because the
    // viewport is portrait. The camera tracks the player after the tutorial.
    if (this.player) this.player.setScale(0.5);

    // Recompute the active camera target after viewport/orientation changes.
    if (this.player) this._updateCameraTracking(true);
  }

  _createEnvironment() {
    // Детализированная векторная сцена: резкие SVG-материалы масштабируются без мыла.
    const environment = this.add.image(WORLD.width / 2, WORLD.height / 2, 'wash-yard-art')
      .setDisplaySize(WORLD.width, WORLD.height)
      .setDepth(0);

    // Здание и боксы отдельными слоями, чтобы машины и сотрудники оставались игровыми спрайтами.
    this._building = this.add.image(WORLD.building.x, WORLD.building.y, 'wash-building-art')
      .setDisplaySize(560, 194)
      .setDepth(5);
    this._createOfficeEntrance();

    this._postSprites = [];
    this._postStatusLabels = [];
    for (let i = 0; i < WORLD.posts.length; i++) {
      const pos = WORLD.posts[i];
      const postData = gameState.posts[i];
      const texture = postData.broken ? 'wash-bay-broken-art' : 'wash-bay-art';
      const compactExpansion = !!pos.expansion;
      const sprite = this.add.image(pos.x, pos.y, texture)
        .setDisplaySize(compactExpansion ? 176 : 300, compactExpansion ? 112 : 192)
        .setDepth(6);
      if (postData.unlocked === false) sprite.setAlpha(0.16);

      const label = this.add.text(pos.x, pos.y - (compactExpansion ? 76 : 112),
        postData.unlocked === false ? `${pos.label.toUpperCase()} · ЗАКРЫТ` : `${pos.label.toUpperCase()} · ГОТОВ`, {
        fontSize: compactExpansion ? '9px' : '11px',
        color: '#8df4ff',
        backgroundColor: 'rgba(5, 12, 24, 0.98)',
        padding: compactExpansion ? { x: 6, y: 4 } : { x: 8, y: 4 },
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontStyle: 'bold',
        stroke: '#07111f',
        strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true },
      }).setOrigin(0.5).setDepth(8);
      if (postData.unlocked === false) label.setColor('#94a3b8');

      this._postSprites.push(sprite);
      this._postStatusLabels.push(label);
    }

    this._createGroundMarkings();
    this._createAmbientLighting();
    this._createScenery();
    this._createCityDetails();
    this._createCompetitorVisuals();
    this._createUpgradeVisuals();

    this.physics.world.setBounds(20, 170, WORLD.width - 40, WORLD.height - 210);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
  }



  /** Original graphic-novel finish: halftones, ink contours and offset neon edges. */
  _createComicBookTreatment() {
    if (this._comicBookGfx) this._comicBookGfx.destroy();
    const g = this.add.graphics().setDepth(1.35);
    this._comicBookGfx = g;
    for (let row=0; row<13; row++) for (let col=0; col<22; col++) {
      const x=18+col*41+(row%2)*12, y=190+row*28;
      const fade=Math.max(0,1-Math.abs(x-450)/520);
      g.fillStyle((row+col)%3===0?0xff4f91:0x70e8ff,0.035+fade*0.025);
      g.fillCircle(x,y,1.15+((row+col)%3)*0.25);
    }
    g.lineStyle(2,0xff4f91,0.22);
    for(let i=0;i<7;i++){const y=176+i*12;g.lineBetween(8,y,112+i*5,y-22);g.lineBetween(892,y+8,790-i*5,y-15);}
    g.lineStyle(1.5,0x62eaff,0.22);
    for(let i=0;i<6;i++){const x=42+i*17;g.lineBetween(x,520,x+24,495-i*3);g.lineBetween(858-i*17,520,834-i*24,495-i*3);}
    const ink=this.add.graphics().setDepth(7.15);
    ink.lineStyle(3,0x080b16,0.9);ink.strokeRoundedRect(164,14,572,185,12);
    ink.lineStyle(1.5,0xff4f91,0.72);ink.strokeRoundedRect(160,12,572,185,12);
    ink.lineStyle(1.5,0x55e8ff,0.72);ink.strokeRoundedRect(168,17,572,185,12);
    for(const pos of WORLD.posts){
      const compact=!!pos.expansion,w=compact?176:300,h=compact?112:192;
      ink.lineStyle(3,0x080b16,0.88);ink.strokeRoundedRect(pos.x-w/2,pos.y-h/2,w,h,8);
      ink.lineStyle(1.25,0xff4f91,0.58);ink.strokeRoundedRect(pos.x-w/2-2,pos.y-h/2-1,w,h,8);
      ink.lineStyle(1.25,0x55e8ff,0.58);ink.strokeRoundedRect(pos.x-w/2+2,pos.y-h/2+1,w,h,8);
    }
    this._comicContourGfx=ink;
  }

  /**
   * Physical rival wash across the road. The scene is intentionally built from
   * lightweight Phaser primitives so it remains crisp on mobile and needs no assets.
   */
  _createCompetitorVisuals() {
    const visualKey = [
      gameState.competitorActive, gameState.competitorBrokenBays,
      gameState.competitorClosed, gameState.competitorAcquired,
      gameState.day <= BALANCE.competitor.appearDay,
    ].join(':');
    if (visualKey === this._competitorVisualKey) return;
    this._competitorVisualKey = visualKey;
    if (this._competitorGroup) {
      this._competitorGroup.destroy(true);
      this._competitorGroup = null;
    }
    if (!gameState.competitorActive) return;

    // A complete rival lot across the road. All elements live in one world-space
    // group so the rival reads as a place, not a HUD sticker or floating sign.
    const group = this.add.container(0, 0).setDepth(2.2);
    this._competitorGroup = group;
    const g = this.add.graphics();
    group.add(g);

    const closed = gameState.competitorClosed;
    const opening = gameState.day <= BALANCE.competitor.appearDay;
    const shell = closed ? 0x1b2633 : 0x17283a;
    const glass = closed ? 0x101923 : 0x24445a;
    const orange = 0xff8a3d;
    const cyan = 0x4bdcf3;

    // Street edge, pedestrian crossing and the deep forecourt.
    g.fillStyle(0x080e18, 0.92);
    g.fillRect(0, 620, WORLD.width, 200);
    g.fillStyle(0x394553, 1);
    g.fillRect(0, 602, WORLD.width, 27);
    g.fillStyle(0x9aa8b5, 0.5);
    g.fillRect(0, 602, WORLD.width, 2);
    g.fillStyle(0x0a111b, 1);
    g.fillRect(0, 629, WORLD.width, 8);
    for (let x = 24; x < 900; x += 82) {
      g.fillStyle(0xe7edf4, 0.58);
      g.fillRoundedRect(x, 610, 42, 3, 1);
    }
    // Entrance lane markings lead the eye into the competitor's property.
    g.fillStyle(0xffa24c, 0.72);
    g.fillRoundedRect(74, 651, 5, 125, 2);
    g.fillRoundedRect(821, 651, 5, 125, 2);
    g.fillStyle(0xd6e1eb, 0.22);
    for (let x = 112; x < 800; x += 86) g.fillRoundedRect(x, 773, 42, 2, 1);

    // Parking apron and raised architectural plinth.
    g.fillStyle(0x02060c, 0.42);
    g.fillEllipse(450, 778, 790, 82);
    g.fillStyle(0x65798b, 0.96);
    g.fillRoundedRect(80, 650, 740, 13, 4);
    g.fillStyle(0x0d1724, 1);
    g.fillRoundedRect(91, 660, 718, 137, 9);
    g.fillStyle(shell, 1);
    g.fillRoundedRect(99, 666, 702, 123, 6);
    g.lineStyle(2, 0x71899d, 0.7);
    g.strokeRoundedRect(99, 666, 702, 123, 6);
    g.fillStyle(0x0b1420, 1);
    g.fillRoundedRect(111, 676, 678, 102, 4);

    // Roof fascia, layered canopy and light strips matching the cyan/orange
    // material language of the player's upgraded wash bays.
    g.fillStyle(0x080e18, 1);
    g.fillRoundedRect(105, 638, 690, 39, 6);
    g.fillStyle(0x25394b, 1);
    g.fillRoundedRect(111, 642, 678, 28, 4);
    g.fillStyle(orange, closed ? 0.25 : 0.95);
    g.fillRoundedRect(126, 645, 648, 3, 1);
    g.fillStyle(cyan, closed ? 0.12 : 0.75);
    g.fillRoundedRect(126, 650, 648, 1.5, 1);
    g.fillStyle(0x080e18, 0.98);
    g.fillRoundedRect(320, 630, 260, 35, 5);
    g.lineStyle(2, orange, closed ? 0.3 : 0.95);
    g.strokeRoundedRect(320, 630, 260, 35, 5);

    // Three deep service portals with visible gantries, glass, floor drains,
    // status lights and equipment silhouettes.
    const bayCenters = [220, 450, 680];
    bayCenters.forEach((cx, i) => {
      const x = cx - 101;
      const broken = i < gameState.competitorBrokenBays;
      g.fillStyle(0x030811, 1);
      g.fillRoundedRect(x, 681, 202, 91, 5);
      g.fillStyle(0x40566a, 1);
      g.fillRoundedRect(x + 5, 685, 192, 82, 3);
      g.fillStyle(closed ? 0x101821 : glass, 1);
      g.fillRoundedRect(x + 10, 690, 182, 70, 2);
      g.fillStyle(0x0b1725, 0.88);
      g.fillRoundedRect(x + 18, 697, 166, 57, 2);
      // Side pillars and overhead gantry.
      g.fillStyle(0x8198a9, 0.85);
      g.fillRoundedRect(x + 7, 685, 7, 81, 2);
      g.fillRoundedRect(x + 188, 685, 7, 81, 2);
      g.fillStyle(0x17293a, 1);
      g.fillRoundedRect(x + 21, 688, 160, 7, 2);
      g.fillStyle(broken ? 0xef5350 : cyan, closed ? 0.12 : 0.9);
      g.fillRoundedRect(x + 25, 689, 152, 2, 1);
      // Twin vertical wash rails and ceiling nozzles.
      g.fillStyle(0x9db6c6, 0.62);
      g.fillRoundedRect(x + 29, 704, 4, 42, 2);
      g.fillRoundedRect(x + 169, 704, 4, 42, 2);
      g.fillStyle(0xffbd68, 0.82);
      for (let n = 0; n < 5; n++) g.fillCircle(x + 48 + n * 26, 702, 1.7);
      // Wet floor and drainage grates.
      g.fillStyle(0x3b7183, 0.34);
      g.fillRoundedRect(x + 22, 747, 158, 5, 2);
      g.fillStyle(0x7e9aa9, 0.55);
      for (let n = 0; n < 9; n++) g.fillRect(x + 32 + n * 16, 755, 2, 7);
      // Bay number and operating state.
      g.fillStyle(broken ? 0x61252b : 0x102a36, 1);
      g.fillRoundedRect(x + 78, 674, 46, 12, 3);
      g.fillStyle(broken ? 0xff6565 : 0x6af0d2, 1);
      g.fillCircle(x + 86, 680, 2);
      if (broken) {
        g.lineStyle(4, 0xff5555, 0.94);
        g.lineBetween(x + 29, 699, x + 173, 750);
        g.lineBetween(x + 173, 699, x + 29, 750);
        g.fillStyle(0x8b1e2a, 0.96);
        g.fillRoundedRect(cx - 31, 712, 62, 18, 4);
        const repair = this.add.text(cx, 721, 'НЕ РАБОТАЕТ', {
          fontFamily: 'Arial, sans-serif', fontSize: '7px', fontStyle: 'bold',
          color: '#ffe1e1', letterSpacing: 0.7,
        }).setOrigin(0.5);
        group.add(repair);
      }
    });

    // Large, legible illuminated brand sign with a separate network badge.
    const title = this.add.text(450, 647, 'КЛИНАВТО', {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '22px', fontStyle: 'bold',
      color: closed ? '#8995a3' : '#fff3e8',
      stroke: '#09111b', strokeThickness: 5,
      letterSpacing: 3,
      shadow: { offsetX: 0, offsetY: 0, color: closed ? '#64748b' : '#ff873f', blur: 12, fill: true },
    }).setOrigin(0.5);
    group.add(title);
    const subtitle = this.add.text(450, 665, closed
      ? 'ФИЛИАЛ ЗАКРЫТ' : '47 ФИЛИАЛОВ  •  ЭКСПРЕСС-МОЙКА ОТ 100 ₽', {
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '8px',
      fontStyle: 'bold', color: closed ? '#f87171' : '#ffc18b',
      letterSpacing: 1.1,
    }).setOrigin(0.5);
    group.add(subtitle);

    // Working cars use detailed layered silhouettes and animated head/tail lamps.
    const drawRivalCar = (cx, cy, color, scale = 1) => {
      const car = this.add.container(cx, cy);
      group.add(car);
      const body = this.add.graphics();
      car.add(body);
      body.fillStyle(0x02050a, 0.48);
      body.fillEllipse(0, 14 * scale, 92 * scale, 24 * scale);
      body.fillStyle(0x050a12, 1);
      body.fillRoundedRect(-43 * scale, -4 * scale, 86 * scale, 30 * scale, 9 * scale);
      body.fillStyle(color, 1);
      body.fillRoundedRect(-40 * scale, -11 * scale, 80 * scale, 28 * scale, 8 * scale);
      body.fillStyle(0xffffff, 0.18);
      body.fillRoundedRect(-34 * scale, -9 * scale, 68 * scale, 3 * scale, 1);
      body.fillStyle(0x12283a, 1);
      body.fillRoundedRect(-22 * scale, -21 * scale, 44 * scale, 20 * scale, 7 * scale);
      body.fillStyle(0x8fd7ed, 0.9);
      body.fillRoundedRect(-17 * scale, -18 * scale, 34 * scale, 13 * scale, 4 * scale);
      body.fillStyle(0x142333, 1);
      body.fillRect(-1 * scale, -18 * scale, 2 * scale, 13 * scale);
      body.fillStyle(0x0a0f17, 1);
      body.fillRoundedRect(-34 * scale, 10 * scale, 15 * scale, 8 * scale, 3 * scale);
      body.fillRoundedRect(19 * scale, 10 * scale, 15 * scale, 8 * scale, 3 * scale);
      body.fillStyle(0xe8f5ff, 0.9);
      body.fillRoundedRect(-37 * scale, -2 * scale, 7 * scale, 4 * scale, 2);
      body.fillRoundedRect(30 * scale, -2 * scale, 7 * scale, 4 * scale, 2);
      body.fillStyle(0xff6a4d, 0.95);
      body.fillRoundedRect(-37 * scale, 8 * scale, 5 * scale, 4 * scale, 1);
      body.fillRoundedRect(32 * scale, 8 * scale, 5 * scale, 4 * scale, 1);
      return car;
    };

    if (!closed) {
      const cars = [
        drawRivalCar(205, 787, 0x2b8caa, 0.83),
        drawRivalCar(450, 787, 0xc7d2dc, 0.83),
        drawRivalCar(695, 787, 0x9a4268, 0.83),
      ];
      cars.forEach((car, i) => {
        this.tweens.add({
          targets: car, y: car.y - 2, duration: 1050 + i * 170,
          yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
      });

      // Staff and customers are full little silhouettes, not dots. The opening
      // day has a crowd, while normal days retain a few visible workers.
      for (let i = 0; i < (opening ? 12 : 6); i++) {
        const x = 145 + i * (opening ? 55 : 110);
        const y = 672 + (i % 2) * 12;
        g.fillStyle(0x02060d, 0.38);
        g.fillEllipse(x, y + 19, 13, 5);
        g.fillStyle(i % 3 === 0 ? 0xffa24c : 0x7ed8e8, 1);
        g.fillRoundedRect(x - 4, y + 5, 8, 12, 3);
        g.fillStyle(0xf1c9aa, 1);
        g.fillCircle(x, y + 2, 4);
        g.fillStyle(0x172638, 1);
        g.fillRect(x - 3, y + 15, 2, 6);
        g.fillRect(x + 1, y + 15, 2, 6);
      }

      // Opening-day stage, speaker stacks and animated spotlights.
      if (opening) {
        g.fillStyle(0x080d18, 1);
        g.fillRoundedRect(380, 615, 140, 23, 4);
        g.lineStyle(2, 0xf472b6, 0.9);
        g.strokeRoundedRect(380, 615, 140, 23, 4);
        for (const x of [392, 508]) {
          g.fillStyle(0x172438, 1);
          g.fillRoundedRect(x, 600, 12, 29, 3);
          g.lineStyle(2, 0x38bdf8, 0.85);
          g.strokeCircle(x + 6, 609, 3);
          g.strokeCircle(x + 6, 620, 3);
        }
        const beamA = this.add.rectangle(420, 612, 4, 58, 0xf472b6, 0.35).setOrigin(0.5, 0);
        const beamB = this.add.rectangle(480, 612, 4, 58, 0x38bdf8, 0.35).setOrigin(0.5, 0);
        group.add([beamA, beamB]);
        [beamA, beamB].forEach((beam, i) => this.tweens.add({
          targets: beam, angle: { from: i ? 22 : -22, to: i ? -22 : 22 },
          alpha: { from: 0.2, to: 0.58 }, duration: 900 + i * 180,
          yoyo: true, repeat: -1,
        }));
      }
    } else {
      g.fillStyle(0x02050a, 0.54);
      g.fillRoundedRect(111, 676, 678, 102, 4);
      g.fillStyle(0x7f1d1d, 0.78);
      g.fillRoundedRect(356, 704, 188, 28, 5);
      const closedSign = this.add.text(450, 718, 'ОБЪЕКТ ОПЕЧАТАН', {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: '#fecaca', letterSpacing: 1.4,
      }).setOrigin(0.5);
      group.add(closedSign);
    }

    // Player-owned takeover gets a clear new brand treatment, not a hidden flag.
    if (gameState.competitorAcquired) {
      const takeover = this.add.text(450, 806, 'ВАША ВТОРАЯ ЛОКАЦИЯ', {
        fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px',
        fontStyle: 'bold', color: '#86efac', backgroundColor: '#07140f',
        padding: { x: 10, y: 6 }, letterSpacing: 1,
      }).setOrigin(0.5);
      group.add(takeover);
    }
  }

  /**
   * Visual feedback for purchased upgrades, using lightweight graphics only.
   * No gameplay values are changed here; GameState remains the source of truth.
   */
  _createUpgradeVisuals() {
    this._upgradeVisuals = this.add.graphics().setDepth(7.6);
    this._updateUpgradeVisuals();
  }

  _updateUpgradeVisuals() {
    if (!this._upgradeVisuals) return;
    const g = this._upgradeVisuals;
    g.clear();

    const levels = [
      Math.min(3, gameState.upgrades.washSpeed || 0),
      Math.min(3, gameState.upgrades.equipmentQuality || 0),
      Math.min(3, gameState.upgrades.reliability || 0),
    ];
    const colors = [0x38bdf8, 0xfbbf24, 0x4ade80];

    // Tiny status lamps on each bay's fascia make equipment upgrades visible in-world.
    for (const pos of WORLD.posts) {
      g.fillStyle(0x07111d, 0.9);
      g.fillRoundedRect(pos.x - 39, pos.y - 82, 78, 13, 3);
      g.lineStyle(1, 0x64748b, 0.58);
      g.strokeRoundedRect(pos.x - 39, pos.y - 82, 78, 13, 3);
      let offset = pos.x - 29;
      for (let group = 0; group < levels.length; group++) {
        for (let led = 0; led < 3; led++) {
          const active = led < levels[group];
          g.fillStyle(colors[group], active ? 0.95 : 0.15);
          g.fillRoundedRect(offset + led * 7, pos.y - 78, 4, 5, 1);
          if (active) {
            g.fillStyle(colors[group], 0.12);
            g.fillCircle(offset + led * 7 + 2, pos.y - 75.5, 5);
          }
        }
        offset += 22;
      }
    }

    // Capacity upgrade is represented by additional illuminated queue markers.
    const capacityLevel = Math.min(3, gameState.upgrades.capacity || 0);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(i < capacityLevel ? 0x4ade80 : 0x64748b, i < capacityLevel ? 0.8 : 0.22);
      g.fillRoundedRect(100 + i * 13, 462, 8, 3, 1);
    }
  }

  /**
   * A clear, lightweight office entrance layered onto the existing building art.
   * It is decorative only; business state remains managed by the existing UI.
   */
  _createOfficeEntrance() {
    const g = this.add.graphics().setDepth(5.35);

    // Recessed doorway, glass panels and a warm interior light.
    g.fillStyle(0x050b15, 0.92);
    g.fillRoundedRect(419, 135, 62, 57, 4);
    g.lineStyle(2, 0x7dd3fc, 0.8);
    g.strokeRoundedRect(419, 135, 62, 57, 4);
    g.fillStyle(0x18364a, 0.98);
    g.fillRoundedRect(424, 140, 52, 47, 2);
    g.fillStyle(0xffd28a, 0.18);
    g.fillRoundedRect(427, 143, 46, 41, 2);
    g.lineStyle(1, 0x9eeeff, 0.55);
    g.lineBetween(450, 141, 450, 186);
    g.fillStyle(0xffd28a, 0.85);
    g.fillCircle(468, 164, 2);

    // Steps and a restrained cyan edge light.
    g.fillStyle(0x172638, 1);
    g.fillRoundedRect(412, 188, 76, 6, 2);
    g.fillStyle(0x7dd3fc, 0.78);
    g.fillRoundedRect(418, 188, 64, 1.5, 1);

    // Compact readable office sign.
    g.fillStyle(0x07111d, 0.96);
    g.fillRoundedRect(409, 113, 82, 17, 3);
    g.lineStyle(1, 0x38bdf8, 0.78);
    g.strokeRoundedRect(409, 113, 82, 17, 3);
    this.add.text(450, 121.5, 'УПРАВЛЕНИЕ', {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#e6faff',
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(5.45);

    // A subtle ground marker makes the interaction point easy to find.
    const marker = this.add.ellipse(450, 198, 46, 12, 0x38bdf8, 0.12).setDepth(5.1);
    this.tweens.add({
      targets: marker,
      alpha: { from: 0.12, to: 0.32 },
      scaleX: { from: 0.9, to: 1.12 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  /**
   * Static city dressing around the playable yard.
   * Kept as lightweight Phaser Graphics + existing generated car textures:
   * no extra library, no new save data, and no changes to collision/gameplay.
   */
  _createCityDetails() {
    const architecture = this.add.graphics().setDepth(1.4);
    const drawFacade = (x, y, width, height, accent, title, subtitle) => {
      // Ground shadow and raised curb make the facade sit in the scene.
      architecture.fillStyle(0x030711, 0.32);
      architecture.fillEllipse(x + width / 2 + 3, y + height + 8, width + 22, 16);
      architecture.fillStyle(0x5d7180, 0.9);
      architecture.fillRoundedRect(x - 5, y + height - 2, width + 10, 9, 2);
      architecture.fillStyle(0x111a29, 0.98);
      architecture.fillRoundedRect(x, y, width, height, 5);
      architecture.fillStyle(0x26384a, 0.96);
      architecture.fillRoundedRect(x + 4, y + 4, width - 8, height - 8, 3);
      architecture.fillStyle(0x0b1422, 0.95);
      architecture.fillRoundedRect(x + 8, y + 10, width - 16, height - 27, 2);
      // Warm interior glass with cool vertical mullions.
      architecture.fillStyle(0x9ac5c8, 0.28);
      architecture.fillRect(x + 11, y + 13, width - 22, height - 34);
      architecture.fillStyle(0xffd28a, 0.23);
      architecture.fillRect(x + 14, y + 16, width - 28, height - 40);
      architecture.lineStyle(2, 0x0d1b2a, 0.9);
      architecture.strokeLineShape(new Phaser.Geom.Line(x + width * 0.36, y + 12, x + width * 0.36, y + height - 20));
      architecture.strokeLineShape(new Phaser.Geom.Line(x + width * 0.65, y + 12, x + width * 0.65, y + height - 20));
      // Canopy and thin illuminated trim.
      architecture.fillStyle(0x172638, 1);
      architecture.fillRoundedRect(x - 4, y + 5, width + 8, 8, 2);
      architecture.fillStyle(accent, 0.88);
      architecture.fillRoundedRect(x + 8, y + 7, width - 16, 2, 1);
      architecture.fillStyle(0x0b1420, 0.98);
      architecture.fillRoundedRect(x + 9, y + height - 21, width - 18, 14, 3);
      architecture.lineStyle(1, accent, 0.7);
      architecture.strokeRoundedRect(x + 9, y + height - 21, width - 18, 14, 3);
      this.add.text(x + width / 2, y + height - 14, title, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '7px',
        fontStyle: 'bold',
        color: '#eaf7ff',
        stroke: '#07111b',
        strokeThickness: 2,
        align: 'center',
      }).setOrigin(0.5).setDepth(2.1);
      this.add.text(x + width / 2, y + height + 15, subtitle, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '7px',
        fontStyle: 'bold',
        color: '#9bb1c4',
        stroke: '#0b111b',
        strokeThickness: 2,
        align: 'center',
      }).setOrigin(0.5).setDepth(2.1);
    };

    // Small neighbouring businesses frame the car wash without covering either bay.
    drawFacade(28, 188, 112, 72, 0x4bd5e5, 'CITY AUTO', 'ЗАПЧАСТИ');
    drawFacade(760, 188, 112, 72, 0xffb86b, 'COFFEE STOP', 'КОФЕ · ОЖИДАНИЕ');

    // Steam drifting from the cafe makes the neighbouring business feel alive.
    this._coffeeSteam = [];
    for (let i = 0; i < 3; i++) {
      const steam = this.add.circle(806 + i * 9, 202 + (i % 2) * 3, 2.2, 0xffe4bd, 0.45)
        .setDepth(3.2 + i * 0.001);
      this._coffeeSteam.push(steam);
      this.tweens.add({
        targets: steam,
        y: steam.y - 13 - i * 2,
        x: steam.x + (i % 2 ? 4 : -3),
        alpha: 0,
        scale: 1.7,
        duration: 1800 + i * 260,
        delay: i * 420,
        repeat: -1,
        onRepeat: () => {
          if (steam.active) { steam.setPosition(806 + i * 9, 202 + (i % 2) * 3); steam.setAlpha(0.45); steam.setScale(1); }
        },
      });
    }

    // Marked customer parking pockets at the far edges of the lot.
    const parking = this.add.graphics().setDepth(2.55);
    for (const side of [{ x: 63, y: 322 }, { x: 737, y: 322 }]) {
      parking.fillStyle(0x050912, 0.22);
      parking.fillRoundedRect(side.x - 8, side.y - 22, 108, 62, 5);
      parking.lineStyle(1.5, 0xd8e5ed, 0.48);
      parking.strokeLineShape(new Phaser.Geom.Line(side.x, side.y - 19, side.x, side.y + 31));
      parking.strokeLineShape(new Phaser.Geom.Line(side.x + 45, side.y - 19, side.x + 45, side.y + 31));
      parking.strokeLineShape(new Phaser.Geom.Line(side.x + 90, side.y - 19, side.x + 90, side.y + 31));
      parking.lineStyle(2, 0x38bdf8, 0.24);
      parking.strokeLineShape(new Phaser.Geom.Line(side.x - 5, side.y + 35, side.x + 95, side.y + 35));
    }

    // Parked cars use the same high-resolution generated textures as customer cars.
    // Their low depth keeps live cars, workers and effects fully interactive in front.
    const parkedCars = [
      { x: 86, y: 335, key: 'car_suv', scale: 0.27, tint: 0x8da7c5 },
      { x: 782, y: 335, key: 'car_premium', scale: 0.27, tint: 0xd5c4a0 },
    ];
    for (const car of parkedCars) {
      const shadow = this.add.ellipse(car.x + 2, car.y + 8, 43, 20, 0x02050a, 0.42).setDepth(2.7);
      const sprite = this.add.image(car.x, car.y, car.key)
        .setScale(car.scale)
        .setTint(car.tint)
        .setDepth(2.85);
      // A tiny windshield glint helps the miniature vehicles read as glossy objects.
      const glint = this.add.graphics().setDepth(2.9);
      glint.lineStyle(1, 0xe6f7ff, 0.55);
      glint.lineBetween(car.x - 5, car.y - 4, car.x + 3, car.y - 6);
      sprite.setData('cityParkingCar', true);
      shadow.setData('cityParkingShadow', true);
    }

    // Directional signs and reflective bollards add legibility at the entrance/exit.
    const signs = this.add.graphics().setDepth(4.2);
    for (const sign of [
      { x: 22, y: 432, color: 0x38bdf8, label: 'IN' },
      { x: 878, y: 432, color: 0x4ade80, label: 'OUT' },
    ]) {
      signs.fillStyle(0x050b14, 0.35);
      signs.fillEllipse(sign.x, sign.y + 18, 17, 6);
      signs.fillStyle(0x263647, 1);
      signs.fillRoundedRect(sign.x - 2, sign.y - 2, 4, 22, 1);
      signs.fillStyle(sign.color, 0.9);
      signs.fillRoundedRect(sign.x - 13, sign.y - 11, 26, 14, 3);
      signs.lineStyle(1, 0xeaf8ff, 0.45);
      signs.strokeRoundedRect(sign.x - 13, sign.y - 11, 26, 14, 3);
      this.add.text(sign.x, sign.y - 4, sign.label, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '7px',
        fontStyle: 'bold',
        color: '#06111c',
      }).setOrigin(0.5).setDepth(4.3);
    }

    // Small pavement studs: deliberately sparse so they read as guidance, not noise.
    const studs = this.add.graphics().setDepth(3.3);
    for (let i = 0; i < 9; i++) {
      const x = 195 + i * 64;
      studs.fillStyle(i % 3 === 0 ? 0xffbd73 : 0x82eaff, i % 3 === 0 ? 0.52 : 0.28);
      studs.fillRoundedRect(x, 535, 8, 2, 1);
      studs.fillStyle(0xe6f8ff, 0.12);
      studs.fillRoundedRect(x + 12, 541, 14, 1, 0);
    }
  }

  _createDayCycleEffects() {
    // A subtle full-world color grade makes the passage of the shift visible
    // without changing the artwork itself. Practical lights glow brighter at dusk.
    this._dayAtmosphere = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0xffd19a, 0)
      .setDepth(22.7)
      .setBlendMode(Phaser.BlendModes.NORMAL);
    this._dayTint = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0xffffff, 0)
      .setDepth(23)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this._dayLights = this.add.graphics()
      .setDepth(24)
      .setBlendMode(Phaser.BlendModes.ADD);
    this._updateDayCycle();
  }

  _updateDayCycle() {
    if (!this._dayTint || !this._dayLights) return;
    const clock = getShiftClock(gameState.shiftTimeRemaining, BALANCE.time);
    const profile = getDayCycleProfile(clock.hour);
    this._dayTint.setFillStyle(profile.tintColor, profile.tintAlpha);
    const atmosphereAlpha = clock.hour < 9 ? 0.13 : clock.hour < 10 ? 0.075 : clock.hour >= 19 ? 0.045 : clock.hour >= 17.5 ? 0.055 : 0.018;
    this._dayAtmosphere.setFillStyle(profile.tintColor, atmosphereAlpha);
    this.cameras.main.setBackgroundColor(profile.tintColor);

    const lights = this._dayLights;
    lights.clear();
    const intensity = profile.lampAlpha;
    // Warm low-angle sunlight makes morning read as morning, not as a dark night map.
    if (clock.hour < 10.5) {
      const morningStrength = clock.hour < 9 ? 0.12 : 0.065;
      lights.fillStyle(0xffb85e, morningStrength * 0.28);
      lights.fillCircle(450, 115, 230);
      lights.fillStyle(0xffd18a, morningStrength * 0.34);
      lights.fillEllipse(450, 320, 570, 250);
      lights.fillStyle(0xffe0a3, morningStrength * 0.18);
      for (const pos of WORLD.posts.slice(0, 2)) lights.fillEllipse(pos.x, pos.y + 18, 115, 48);
    }
    if (intensity > 0.005) {
      // Concentric additive halos imitate warm lamps reflecting on wet concrete.
      for (const pos of WORLD.posts) {
        lights.fillStyle(0xffcb79, intensity * 0.035);
        lights.fillCircle(pos.x, pos.y + 18, 88);
        lights.fillStyle(0xffd896, intensity * 0.055);
        lights.fillCircle(pos.x, pos.y + 18, 56);
        lights.fillStyle(0xffefc2, intensity * 0.075);
        lights.fillEllipse(pos.x, pos.y + 23, 78, 27);
      }
      for (const x of [30, 870]) {
        lights.fillStyle(0xffd27a, intensity * 0.055);
        lights.fillCircle(x, 280, 60);
        lights.fillStyle(0xffe4a3, intensity * 0.09);
        lights.fillCircle(x, 280, 29);
      }
      lights.fillStyle(0xffbf69, intensity * 0.06);
      lights.fillRoundedRect(405, 84, 90, 5, 2);
    }
  }

  _createGroundMarkings() {
    const mg = this.add.graphics();
    mg.setDepth(3);

    // Влажные пятна с отражениями под моечными боксами
    for (let i = 0; i < WORLD.posts.length; i++) {
      const pos = WORLD.posts[i];
      mg.fillStyle(0x0ea5e9, 0.08);
      mg.fillEllipse(pos.x, pos.y + 16, 170, 75);
      mg.fillStyle(0x38bdf8, 0.05);
      mg.fillEllipse(pos.x, pos.y + 14, 130, 50);
    }

    // Дренажные решетки перед боксами
    this.add.image(WORLD.posts[0].x, WORLD.posts[0].y + 60, 'drainage_grate').setDepth(3);
    this.add.image(WORLD.posts[1].x, WORLD.posts[1].y + 60, 'drainage_grate').setDepth(3);

    // Пешеходный переход безопасности (желто-белая разметка)
    mg.fillStyle(0xf59e0b, 0.85);
    for (let y = 195; y < 270; y += 12) {
      mg.fillRect(435, y, 30, 6);
    }

    // Направляющие линии въезда
    mg.lineStyle(2, 0x38bdf8, 0.6);
    mg.strokeLineShape(new Phaser.Geom.Line(WORLD.entrance.x + 20, WORLD.entrance.y - 20, 130, 490));

    // Направляющие линии выезда
    mg.lineStyle(2, 0x22c55e, 0.6);
    mg.strokeLineShape(new Phaser.Geom.Line(WORLD.posts[1].x + 90, WORLD.posts[1].y + 20, WORLD.exit.x - 20, WORLD.exit.y - 20));

    // Трафаретные указатели движения
    this.add.text(WORLD.entrance.x, WORLD.entrance.y - 32, '➔ ВЪЕЗД', {
      fontSize: '12px',
      color: '#38bdf8',
      fontStyle: 'bold',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      padding: { x: 6, y: 2 },
    }).setDepth(4);

    this.add.text(WORLD.exit.x, WORLD.exit.y - 32, 'ВЫЕЗД ➔', {
      fontSize: '12px',
      color: '#22c55e',
      fontStyle: 'bold',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      padding: { x: 6, y: 2 },
    }).setOrigin(1, 0).setDepth(4);
  }

  _createAmbientLighting() {
    const light = this.add.graphics().setDepth(3.4);

    // Мягкие бирюзовые световые лужи от оборудования моечных постов.
    for (const pos of WORLD.posts) {
      light.fillStyle(0x22d3ee, 0.025);
      light.fillEllipse(pos.x, pos.y + 28, 190, 86);
      light.fillStyle(0x22d3ee, 0.035);
      light.fillEllipse(pos.x, pos.y + 25, 145, 62);
      light.fillStyle(0x67e8f9, 0.045);
      light.fillEllipse(pos.x, pos.y + 22, 92, 32);

      // Длинные блики на мокром бетоне, будто отражаются световые панели.
      light.fillStyle(0x9be7ff, 0.14);
      light.fillRoundedRect(pos.x - 66, pos.y + 43, 38, 2, 1);
      light.fillStyle(0x67e8f9, 0.1);
      light.fillRoundedRect(pos.x + 19, pos.y + 55, 51, 2, 1);
      light.fillStyle(0xffffff, 0.08);
      light.fillRoundedRect(pos.x - 12, pos.y + 62, 21, 1, 1);
    }

    // Тёплые закатные рефлексы на дороге контрастируют с холодным светом мойки.
    light.fillStyle(0xfb923c, 0.035);
    light.fillEllipse(130, WORLD.roadY + 3, 150, 22);
    light.fillEllipse(770, WORLD.roadY + 1, 180, 18);
    light.fillStyle(0xfbbf24, 0.08);
    light.fillRoundedRect(95, WORLD.roadY + 5, 52, 2, 1);
    light.fillRoundedRect(720, WORLD.roadY - 4, 37, 2, 1);

    // Мокрые отражения: несколько разной длины полос вместо равномерного шума.
    // Группируем их в перспективные следы, чтобы покрытие читалось как мокрый бетон.
    const reflections = [
      [214, 391, 54, 2, 0x9be7ff, 0.17],
      [284, 410, 23, 1, 0xffffff, 0.13],
      [326, 431, 69, 2, 0x38bdf8, 0.12],
      [470, 397, 36, 1, 0xffffff, 0.12],
      [512, 448, 74, 2, 0xe2e8f0, 0.14],
      [574, 430, 29, 1, 0x67e8f9, 0.17],
      [346, 489, 42, 2, 0xfb923c, 0.12],
      [403, 515, 81, 2, 0x38bdf8, 0.09],
      [612, 500, 44, 1, 0xffffff, 0.11],
      [256, 535, 28, 1, 0x67e8f9, 0.13],
      [690, 420, 32, 1, 0xfb923c, 0.1],
      [162, 453, 36, 1, 0xffffff, 0.1],
    ];
    for (const [x, y, w, h, color, alpha] of reflections) {
      light.fillStyle(color, alpha);
      light.fillRoundedRect(x, y, w, h, 1);
      if (w > 40) {
        light.fillStyle(color, alpha * 0.35);
        light.fillRoundedRect(x + w * 0.2, y + 3, w * 0.45, 1, 1);
      }
    }

    // Низкие направляющие световые маркеры вдоль прохода.
    for (let i = 0; i < 6; i++) {
      const y = 326 + i * 31;
      const alpha = 0.16 - i * 0.012;
      light.fillStyle(0x22d3ee, alpha);
      light.fillRoundedRect(118, y, 7, 2, 1);
      light.fillRoundedRect(775, y, 7, 2, 1);
    }

    // Сохранённые царапины и тонкие кромочные блики.
    light.lineStyle(1, 0xe2e8f0, 0.09);
    light.strokeLineShape(new Phaser.Geom.Line(230, 420, 273, 418));
    light.strokeLineShape(new Phaser.Geom.Line(520, 448, 582, 445));
    light.strokeLineShape(new Phaser.Geom.Line(350, 530, 391, 529));
    light.lineStyle(1, 0x67e8f9, 0.1);
    light.strokeLineShape(new Phaser.Geom.Line(235, 352, 260, 350));
    light.strokeLineShape(new Phaser.Geom.Line(635, 365, 673, 363));

    // Небольшая тёплая подсветка у входа помогает считывать направление движения.
    light.fillStyle(0xf59e0b, 0.045);
    light.fillEllipse(WORLD.entrance.x + 55, WORLD.entrance.y - 35, 78, 38);
    light.fillStyle(0x22c55e, 0.035);
    light.fillEllipse(WORLD.exit.x - 40, WORLD.exit.y - 35, 82, 34);

    // Wet-ground specular streaks: clustered by light source, with darker
    // gaps between them so the concrete reads glossy rather than uniformly blue.
    const puddleGroups = [
      { x: WORLD.posts[0].x, y: WORLD.posts[0].y + 82, color: 0x38bdf8 },
      { x: WORLD.posts[1].x, y: WORLD.posts[1].y + 82, color: 0x67e8f9 },
    ];
    for (const puddle of puddleGroups) {
      light.fillStyle(0x020711, 0.12);
      light.fillEllipse(puddle.x + 4, puddle.y + 7, 142, 29);
      light.fillStyle(puddle.color, 0.055);
      light.fillEllipse(puddle.x, puddle.y + 1, 128, 22);
      light.fillStyle(0xe0f2fe, 0.12);
      light.fillRoundedRect(puddle.x - 47, puddle.y - 2, 26, 1.5, 1);
      light.fillStyle(puddle.color, 0.1);
      light.fillRoundedRect(puddle.x + 12, puddle.y + 4, 43, 1.5, 1);
      light.fillStyle(0xffffff, 0.08);
      light.fillRoundedRect(puddle.x - 8, puddle.y + 8, 14, 1, 1);
    }

    // Short broken reflections beneath the building frontage give a subtle
    // sense of wet paving without creating a noisy repeated pattern.
    const frontageReflections = [
      [188, 278, 34, 1, 0xf8fafc, 0.1],
      [232, 286, 18, 1, 0x67e8f9, 0.11],
      [678, 279, 41, 1, 0xffd28a, 0.11],
      [731, 286, 23, 1, 0xe0f2fe, 0.09],
      [386, 301, 29, 1, 0x94a3b8, 0.08],
      [549, 307, 36, 1, 0x67e8f9, 0.08],
    ];
    for (const [x, y, width, height, color, alpha] of frontageReflections) {
      light.fillStyle(color, alpha);
      light.fillRoundedRect(x, y, width, height, 1);
    }

    // Soft shadow under the car-wash bay apron anchors the buildings to the lot.
    light.fillStyle(0x02040a, 0.16);
    for (const pos of WORLD.posts) {
      light.fillEllipse(pos.x, pos.y + 69, 184, 18);
      light.fillStyle(0x0b1522, 0.14);
      light.fillEllipse(pos.x, pos.y + 72, 150, 10);
    }
  }

  _createScenery() {
    // Зеленые насаждения в кадках
    this.add.image(170, 180, 'potted_tree').setDepth(7);
    this.add.image(730, 180, 'potted_tree').setDepth(7);
    this.add.image(450, 480, 'potted_tree').setDepth(7);

    // Уличные фонари с мягким световым ореолом
    const lamp1 = this.add.image(30, 260, 'lamp_post').setDepth(7);
    const lamp2 = this.add.image(870, 260, 'lamp_post').setDepth(7);

    const lg = this.add.graphics().setDepth(3);
    // Световые круги на земле от фонарей
    lg.fillStyle(0xfef08a, 0.05);
    lg.fillCircle(30, 280, 50);
    lg.fillCircle(870, 280, 50);

    // Ограждающие конусы
    this.add.image(WORLD.entrance.x + 35, WORLD.entrance.y - 60, 'cone').setDepth(7);
    this.add.image(WORLD.entrance.x + 65, WORLD.entrance.y - 60, 'cone').setDepth(7);

    // Контрастные въездные маркеры и световые studs по периметру площадки.
    const perimeter = this.add.graphics().setDepth(3.2);
    perimeter.lineStyle(2, 0x0b1320, 0.7);
    perimeter.strokeLineShape(new Phaser.Geom.Line(66, 112, 834, 112));
    perimeter.strokeLineShape(new Phaser.Geom.Line(66, 428, 834, 428));
    for (let i = 0; i < 16; i++) {
      const x = 86 + i * 48;
      perimeter.fillStyle(i % 4 === 0 ? 0xfb923c : 0x38bdf8, i % 4 === 0 ? 0.78 : 0.36);
      perimeter.fillRoundedRect(x, 117, i % 4 === 0 ? 15 : 8, 2, 1);
      perimeter.fillStyle(0x67e8f9, 0.22);
      perimeter.fillRoundedRect(x + 12, 423, 10, 2, 1);
    }

    // Вытянутые следы воды у дренажа и перед рабочими постами.
    const water = this.add.graphics().setDepth(3.15);
    for (let i = 0; i < 10; i++) {
      const x = 180 + i * 59;
      const y = 352 + (i % 3) * 31;
      water.fillStyle(i % 2 ? 0x67e8f9 : 0x94a3b8, 0.075 + (i % 3) * 0.018);
      water.fillEllipse(x, y, 18 + (i % 4) * 7, 2 + (i % 2));
    }
  }

  /** Animated gantry rollers, status lamps and flexible pressure hoses. Purely visual. */
  _updateEquipmentAnimation(time) {
    const g = this._equipmentGfx;
    if (!g) return;
    g.clear();
    const phase = time * 0.006;
    for (let i = 0; i < WORLD.posts.length; i++) {
      const post = gameState.posts[i];
      if (!post || post.unlocked === false) continue;
      const pos = WORLD.posts[i];
      const active = !!post.busy && !post.broken;
      const broken = !!post.broken;
      const pulse = 0.5 + (Math.sin(phase * 1.7 + i) + 1) * 0.18;
      const rollerPhase = phase * (active ? 2.2 : 0.28);

      // Gantry crossbar and compact service-status lamp.
      g.fillStyle(0x071522, 0.88);
      g.fillRoundedRect(pos.x - 91, pos.y - 73, 182, 7, 3);
      g.lineStyle(1, 0x8beaff, active ? 0.62 : 0.24);
      g.strokeRoundedRect(pos.x - 91, pos.y - 73, 182, 7, 3);
      g.fillStyle(broken ? 0xef4444 : active ? 0x34d399 : 0x64748b,
        broken ? 0.9 : active ? 0.55 + pulse * 0.35 : 0.28);
      g.fillCircle(pos.x, pos.y - 69.5, 2.5);

      if (broken) continue;
      // Side rotary brushes: rotating spokes provide readable motion even at phone scale.
      for (const side of [-1, 1]) {
        const x = pos.x + side * 78;
        const y = pos.y + 7;
        g.fillStyle(0x07111c, 0.82);
        g.fillRoundedRect(x - 7, y - 30, 14, 60, 6);
        g.fillStyle(active ? 0x0e7490 : 0x334155, active ? 0.72 : 0.48);
        g.fillRoundedRect(x - 5, y - 27, 10, 54, 5);
        g.lineStyle(2, active ? 0x9be7ff : 0x94a3b8, active ? 0.72 : 0.3);
        for (let spoke = 0; spoke < 4; spoke++) {
          const a = rollerPhase + spoke * Math.PI / 2 + (side < 0 ? Math.PI / 4 : 0);
          const x1 = x + Math.cos(a) * 3;
          const y1 = y + Math.sin(a) * 3;
          const x2 = x + Math.cos(a) * 9;
          const y2 = y + Math.sin(a) * 9;
          g.lineBetween(x1, y1, x2, y2);
        }
        if (active) {
          g.fillStyle(0x67e8f9, 0.08 + pulse * 0.08);
          g.fillEllipse(x, y, 25, 66);
        }
      }

      // Animated floor-level guide lights travel along the gantry during a wash.
      if (active) {
        const travel = (time * 0.035 + i * 29) % 182;
        g.fillStyle(0x67e8f9, 0.62);
        g.fillCircle(pos.x - 91 + travel, pos.y - 77, 2.2);
        g.fillStyle(0x67e8f9, 0.12);
        g.fillCircle(pos.x - 91 + travel, pos.y - 77, 6);
      }

      // A visible coiled hose hangs from the gantry while the post is operating.
      if (active) {
        const hoseX = pos.x + 48;
        g.lineStyle(3, 0x101c2b, 0.9);
        g.beginPath();
        g.moveTo(hoseX, pos.y - 68);
        g.lineTo(hoseX + 5 + Math.sin(phase + i) * 3, pos.y - 43);
        g.lineTo(hoseX - 4 + Math.sin(phase * 0.8 + i) * 4, pos.y - 18);
        g.lineTo(hoseX + 4 + Math.sin(phase + i) * 3, pos.y + 3);
        g.strokePath();
        g.lineStyle(1, 0x67e8f9, 0.52);
        g.lineBetween(hoseX + 1, pos.y - 66, hoseX + 4, pos.y - 43);
      }
    }
  }

  _updatePostStatuses() {
    if (!this._postStatusLabels) return;
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      const lbl = this._postStatusLabels[i];
      if (!lbl) continue;

      if (post.unlocked === false) {
        lbl.setText(`${WORLD.posts[i].label.toUpperCase()} · ЗАКРЫТ`);
        lbl.setColor('#94a3b8');
        if (this._postSprites[i]) this._postSprites[i].setAlpha(0.16);
      } else if (post.broken) {
        lbl.setText(`${WORLD.posts[i].label.toUpperCase()} · АВАРИЯ`);
        lbl.setColor('#ef4444');
      } else if (post.busy) {
        lbl.setText(`${WORLD.posts[i].label.toUpperCase()} · МОЙКА`);
        if (this._postSprites[i]) this._postSprites[i].setAlpha(1);
        lbl.setColor('#22c55e');
      } else {
        lbl.setText(`${WORLD.posts[i].label.toUpperCase()} · ГОТОВ`);
        lbl.setColor('#38bdf8');
        if (this._postSprites[i]) this._postSprites[i].setAlpha(1);
      }
    }
  }

  _createPlayer() {
    this.player = this.physics.add.sprite(
      WORLD.playerStart.x,
      WORLD.playerStart.y,
      'player_idle'
    );
    this.player.setDepth(15);
    this.player.setScale(0.5);
    this.player.setCollideWorldBounds(true);
    // Body dimensions/offsets are doubled because the display scale is 0.5.
    this.player.body.setSize(48, 56);
    this.player.body.setOffset(18, 32);

    if (gameState.tutorialCompleted) {
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this._isCameraFollowingPlayer = true;
    }
  }

  _updateCameraTracking(immediate = false) {
    const cam = this.cameras.main;
    if (gameState.tutorialCompleted) {
      if (!this._isCameraFollowingPlayer && this.player) {
        this._isCameraFollowingPlayer = true;
        cam.startFollow(this.player, true, 0.1, 0.1);
      }
      return;
    }

    this._isCameraFollowingPlayer = false;
    cam.stopFollow();

    const post1 = WORLD.posts[0];
    let targetX = (this.player.x + post1.x) * 0.5;
    let targetY = (this.player.y + post1.y) * 0.5;

    if (this._isWashing) {
      targetX = post1.x;
      targetY = post1.y + 10;
    }

    if (immediate) {
      cam.centerOn(targetX, targetY);
    } else {
      const currentCenterX = cam.scrollX + (cam.width * 0.5) / cam.zoom;
      const currentCenterY = cam.scrollY + (cam.height * 0.5) / cam.zoom;
      const newX = Phaser.Math.Linear(currentCenterX, targetX, 0.08);
      const newY = Phaser.Math.Linear(currentCenterY, targetY, 0.08);
      cam.centerOn(newX, newY);
    }
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

    // Пользовательская настройка меню действительно управляет видимостью джойстика.
    let joystickEnabled = true;
    try {
      joystickEnabled = localStorage.getItem('carwash_joystick_enabled') !== 'false';
    } catch (e) {
      // При запрещённом localStorage оставляем безопасное управление по умолчанию.
    }
    if (zone) zone.style.display = joystickEnabled ? '' : 'none';

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

    const rivalDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, 450, 710);
    if (rivalDistance < 126) {
      btnText.textContent = 'КЛИНАВТО';
      btnSub.textContent = gameState.competitorClosed ? 'ОБЪЕКТ ЗАКРЫТ' : 'ОСМОТРЕТЬ КОНКУРЕНТА';
      return;
    }

    const coffeeDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, 816, 224);
    if (coffeeDistance < 108) {
      btnText.textContent = 'КОФЕ';
      btnSub.textContent = this._coffeeRushUntil > this.time.now ? 'КЛИЕНТЫ ЖДУТ' : 'ПОДДЕРЖАТЬ ОЧЕРЕДЬ';
      return;
    }

    // Show the office action before generic bay actions when the player reaches the entrance.
    const officeDistance = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, WORLD.building.x, WORLD.building.y + 68
    );
    if (officeDistance < 108) {
      btnText.textContent = 'ОФИС';
      btnSub.textContent = 'УПРАВЛЕНИЕ БИЗНЕСОМ';
      return;
    }

    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.unlocked === false) continue;
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

    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.unlocked === false) continue;
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

  /** Отрисовка маркера подсветки целевого автомобиля во время обучения */
  _updateTargetHighlight() {
    this._targetHighlight.clear();
    if (gameState.tutorialCompleted) return;

    const post1 = gameState.posts[0];
    if (post1.busy && post1.carId) {
      const carSprite = this._carSprites[post1.carId];
      if (carSprite && carSprite.active) {
        const time = this.time.now * 0.005;
        const alpha = 0.6 + Math.sin(time) * 0.35;

        // 1. Неоновая рамка вокруг целевой машины
        this._targetHighlight.lineStyle(3, 0x00d2d3, alpha);
        this._targetHighlight.strokeRoundedRect(
          carSprite.x - carSprite.width / 2 - 6,
          carSprite.y - carSprite.height / 2 - 6,
          carSprite.width + 12,
          carSprite.height + 12,
          8
        );

        // 2. Анимированная стрелка над машиной
        const arrowY = carSprite.y - carSprite.height / 2 - 16 + Math.sin(time * 1.6) * 5;
        this._targetHighlight.fillStyle(0x00d2d3, 0.95);
        this._targetHighlight.fillTriangle(
          carSprite.x, arrowY + 8,
          carSprite.x - 7, arrowY,
          carSprite.x + 7, arrowY
        );

        // 3. Подложка бейджа «ЦЕЛЬ: БОКС 1»
        this._targetHighlight.fillStyle(0x0f172a, 0.9);
        this._targetHighlight.fillRoundedRect(carSprite.x - 48, arrowY - 20, 96, 18, 4);
        this._targetHighlight.lineStyle(1, 0x00d2d3, 0.7);
        this._targetHighlight.strokeRoundedRect(carSprite.x - 48, arrowY - 20, 96, 18, 4);
      }
    }
  }

  _handleInteract() {
    if (gameState.paused || !gameState.shiftActive) return;

    // The rival site is a real point of interest in the world. Walk across the
    // road and inspect its current condition, pricing and operational status.
    const rivalDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, 450, 710);
    if (!this._isWashing && rivalDistance < 112 && gameState.competitorActive) {
      audioManager.play('buttonClick');
      if (gameState.competitorAcquired) {
        showToast('КлинАвто теперь часть вашей сети. Управляй точкой через меню «Бизнес».', 'success');
      } else if (gameState.competitorClosed) {
        showToast('КлинАвто закрыто. Осмотри объект: оборудование и два бокса выведены из строя.', 'warning');
      } else if (gameState.competitorPriceWar) {
        showToast('КлинАвто демпингует: экспресс-мойка 100 ₽. Их очередь растёт, твой поток просел.', 'warning');
      } else {
        showToast('КлинАвто · сеть из 47 автомоек. Региональный игрок открылся прямо напротив.', 'info');
      }
      return;
    }

    // Coffee Stop is a useful customer amenity: one interaction gives the queue
    // a short patience boost, so the neighbouring cafe has a clear gameplay role.
    const coffeeDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, 816, 224);
    if (!this._isWashing && coffeeDistance < 96) {
      // One coffee bonus per 25 seconds. Ignore repeated interaction while active:
      // no timer refresh, no sound spam and no repeated full-screen notification.
      if (this._coffeeRushUntil > this.time.now) return;
      this._coffeeRushUntil = this.time.now + 25000;
      audioManager.play('buttonClick');
      this._showCoffeeSteamBurst(816, 220);
      showToast('☕ Кофейный бонус активирован · 25 сек.', 'success');
      return;
    }

    // City Auto Parts is the physical supply counter for the garage.
    const partsDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, 84, 256);
    if (!this._isWashing && partsDistance < 92) {
      const result = gameState.buySuppliesStock();
      if (result.success) {
        audioManager.play('success');
        this._showCoffeeSteamBurst(84, 250);
        showToast(`Склад пополнен: +50 комплектов · остаток ${result.newStock}`, 'success');
      } else {
        audioManager.play('error');
        showToast(result.reason, 'warning');
      }
      return;
    }

    // Office entrance above the wash bays: open existing business management UI.
    // Reuse the current HUD action so finances/upgrades stay in one source of truth.
    const office = WORLD.building;
    const officeDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      office.x,
      office.y + 68
    );
    if (!this._isWashing && officeDistance < 92) {
      const businessButton = document.getElementById('hud-btn-business');
      if (businessButton && !businessButton.disabled) {
        businessButton.click();
      } else {
        showToast('Офис: открой «Бизнес» в верхнем меню управления.', 'info');
      }
      return;
    }

    if (this._isWashing) {
      audioManager.play('waterSpray');
      this._advanceWashStage();
      return;
    }

    // Ремонт бокса
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.broken) {
        const pos = WORLD.posts[i];
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
        if (dist < 100) {
          audioManager.play('wrenchRepair');
          this.player.setTexture('player_repair');
          this._spawnRepairSparks(pos.x, pos.y);
          this.time.delayedCall(450, () => {
            if (!this._isWashing && this.player) {
              this.player.setTexture('player_idle');
            }
          });
          const result = gameState.repairPost(post.id);
          if (result.success) {
            audioManager.play('success');
            this._postSprites[i].setTexture('wash-bay-art');
            showToast('Бокс успешно отремонтирован!', 'success');
            this._updatePostStatuses();
          } else {
            audioManager.play('error');
            showToast(result.reason, 'warning');
          }
          return;
        }
      }
    }

    // Мойка машины
    let nearestCarDist = Infinity;
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.busy && post.carId) {
        const car = gameState.getCar(post.carId);
        if (!car || car.completed || car.paid) continue;

        const pos = WORLD.posts[i];
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
        if (dist < nearestCarDist) nearestCarDist = dist;

        if (dist < 100) {
          this._startWashing(car.id);
          return;
        }
      }
    }

    if (nearestCarDist < 240) {
      showToast('Подойди ближе к машине в боксе!', 'info');
    } else {
      showToast('Нет машин поблизости. Подожди заезда в бокс!', 'info');
    }
  }

  _startWashing(carId) {
    const car = gameState.getCar(carId);
    if (!car || this._isWashing || car.completed) return;

    this._isWashing = true;
    this._washingCar = carId;
    car.washStage = 0;
    car.washProgress = 0;

    audioManager.startSpray('foam');
    this.player.setTexture('player_work');

    const stages = BALANCE.services.expressWash.stages;
    const stageName = BALANCE.services.expressWash.stageNames[stages[0]];
    showWashProgress(stageName, 0, 'Нажимай кнопку для нанесения пены!');

    if (!gameState.tutorialCompleted && gameState.tutorialStep === 1) {
      this._tutorialSystem.advance(1);
    }
  }

  _advanceWashStage() {
    const car = gameState.getCar(this._washingCar);
    if (!car) {
      this._stopWashing();
      return;
    }

    const stages = BALANCE.services.expressWash.stages;
    const isFoam = stages[car.washStage] === 'foam';
    audioManager.startSpray(isFoam ? 'foam' : 'water');
    audioManager.play(isFoam ? 'foamSpray' : 'rinse');

    if (car.washProgress < 100) {
      car.washProgress += 25;
      if (car.washProgress > 100) car.washProgress = 100;

      const stageName = BALANCE.services.expressWash.stageNames[stages[car.washStage]];
      showWashProgress(stageName, car.washProgress, car.washProgress >= 100 ? 'Этап готов! Нажми для перехода' : 'Продолжай мойку!');
      this._updateCarVisual(car);

      const sprite = this._carSprites[car.id];
      if (sprite) {
        this._spawnSplashBurst(sprite.x, sprite.y, isFoam);
      }

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

    audioManager.stopSpray();
    if (this._sprayGfx) this._sprayGfx.clear();
    if (this._waterMist?.emitting) this._waterMist.stop();
    if (this._foamMist?.emitting) this._foamMist.stop();
    this._activeSprayEmitter = null;
    audioManager.play('cashRegister');
    const profit = gameState.addServiceIncome(car.id, quality);
    hideWashProgress();
    this._isWashing = false;
    this._washingCar = null;
    this.player.setTexture('player_idle');

    showToast(`Готово! Клиент оплатил +${this._formatMoney(profit)}`, 'success');
    this._showWashReward(car, profit, quality);
    this._updateCarVisual(car);

    const carSprite = this._carSprites[car.id];
    if (carSprite) {
      this._spawnCleanSparkles(carSprite.x, carSprite.y);
    }

    this.time.delayedCall(1400, () => {
      this._carLeave(car.id);
    });

    this._checkBreakdown(car.postId);

    if (!gameState.tutorialCompleted) {
      this._tutorialSystem.complete(profit);
    }

    updateHUD();
  }

  _stopWashing() {
    audioManager.stopSpray();
    if (this._sprayGfx) this._sprayGfx.clear();
    if (this._waterMist?.emitting) this._waterMist.stop();
    if (this._foamMist?.emitting) this._foamMist.stop();
    this._activeSprayEmitter = null;
    this._isWashing = false;
    this._washingCar = null;
    this.player.setTexture('player_idle');
    hideWashProgress();
  }

  _showWashReward(car, profit, quality) {
    const sprite = this._carSprites[car.id];
    if (!sprite || !sprite.active) return;
    const perfect = quality >= 0.85;
    const reward = this.add.container(sprite.x, sprite.y - 28).setDepth(40);
    const bg = this.add.graphics();
    bg.fillStyle(perfect ? 0x064e3b : 0x0b2238, 0.94);
    bg.lineStyle(2, perfect ? 0x34d399 : 0x38bdf8, 0.9);
    bg.fillRoundedRect(-65, -18, 130, 36, 12);
    bg.strokeRoundedRect(-65, -18, 130, 36, 12);
    const label = this.add.text(0, 0, (perfect ? '✦ ИДЕАЛЬНО  ' : '✓ ГОТОВО  ') + '+' + this._formatMoney(profit), {
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: perfect ? '#86efac' : '#a5f3fc', align: 'center',
      stroke: '#06111f', strokeThickness: 2,
    }).setOrigin(0.5);
    reward.add([bg, label]);
    this.tweens.add({ targets: reward, y: reward.y - 42, alpha: 0, duration: 1350, ease: 'Cubic.easeOut', onComplete: () => reward.destroy() });
    if (perfect) {
      const badge = this.add.text(sprite.x, sprite.y + 28, 'КАЧЕСТВО 85%+', {
        fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: '#86efac', backgroundColor: '#052e2b', padding: { x: 7, y: 4 },
      }).setOrigin(0.5).setDepth(40);
      this.tweens.add({ targets: badge, y: badge.y + 16, alpha: 0, delay: 300, duration: 900, onComplete: () => badge.destroy() });
    }
  }

  _showCoffeeSteamBurst(x, y) {
    const burst = this.add.particles(x, y, 'particle_mist', {
      speed: { min: 18, max: 48 }, angle: { min: 230, max: 310 },
      scale: { start: 0.6, end: 0 }, alpha: { start: 0.75, end: 0 },
      lifespan: 520, quantity: 8, tint: [0xffd7a0, 0xfff0d0], emitting: false,
    }).setDepth(30);
    burst.explode(8, x, y);
    this.time.delayedCall(650, () => { if (burst && burst.active) burst.destroy(); });
  }

  _checkBreakdown(postId) {
    if (!postId) return;
    const post = gameState.posts.find(item => item.id === postId);
    if (!post) return;
    // Equipment wears down after every completed wash. Preventive service
    // restores condition and materially lowers the chance of an emergency stop.
    post.maintenance = Math.max(0, (Number.isFinite(post.maintenance) ? post.maintenance : 100) - 8);
    const reliabilityMult = gameState.getUpgradeEffect('reliability', 1);
    const wearPenalty = 1 + ((100 - post.maintenance) / 100) * 2.5;
    const chance = BALANCE.breakdown.baseChancePerWash * reliabilityMult * wearPenalty;
    gameState.emit('stateChanged');
    if (Math.random() < chance) {
      const idx = gameState.posts.findIndex(p => p.id === postId);
      if (idx !== -1) {
        audioManager.play('warningBeep');
        gameState.breakPost(postId);
        this._postSprites[idx].setTexture('wash-bay-broken-art');
        showToast(`${WORLD.posts[idx].label} вышел из строя! Подойди для починки.`, 'warning');
      }
    }
  }

  _carLeave(carId) {
    const sprite = this._carSprites[carId];
    const shadow = this._carShadows[carId];
    if (sprite) {
      audioManager.play('carDepart');
      this.tweens.killTweensOf(sprite);
      if (shadow) this.tweens.killTweensOf(shadow);
      delete sprite._queueTargetX;
      sprite.setScale(0.5);
      // Keep the contact shadow slightly behind and below the vehicle while it exits.
      if (shadow) {
        shadow.setPosition(sprite.x + 3, sprite.y + 9).setScale(0.49).setAlpha(sprite.alpha * 0.38);
        this.tweens.add({
          targets: shadow,
          x: WORLD.exit.x + 83,
          y: WORLD.roadY + 9,
          alpha: 0,
          duration: 1200,
          ease: 'Power2',
        });
      }
      this.tweens.add({
        targets: sprite,
        x: WORLD.exit.x + 80,
        y: WORLD.roadY,
        alpha: 0,
        duration: 1200,
        ease: 'Power2',
        onComplete: () => {
          sprite.destroy();
          shadow?.destroy();
          delete this._carSprites[carId];
          delete this._carShadows[carId];
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
    const weights = [0.25, 0.25, 0.18, 0.12, 0.12, 0.08];
    let r = Math.random();
    let classId = classes[0];
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) { classId = classes[i]; break; }
    }

    const car = gameState.addCar(classId);
    if (!car) return;

    audioManager.play('carArrive');
    const queueIndex = gameState.queue.indexOf(car.id);
    const targetX = WORLD.queueStart.x + queueIndex * WORLD.queueSpacing;
    const targetY = WORLD.queueStart.y;

    const sprite = this.add.image(WORLD.entrance.x - 30, WORLD.entrance.y, `car_${classId}_dirty`);
    sprite.setScale(0.44).setAlpha(0.82);
    sprite.setDepth(12 + WORLD.entrance.y * 0.01);
    sprite._queueTargetX = targetX;
    const shadow = this.add.ellipse(sprite.x + 3, sprite.y + 9, 72, 27, 0x02050b, 0.36)
      .setScale(0.44).setDepth(sprite.depth - 0.02);
    this._carSprites[car.id] = sprite;
    this._carShadows[car.id] = shadow;

    this.tweens.add({
      targets: [sprite, shadow],
      x: targetX,
      y: targetY,
      scale: 0.5,
      alpha: 1,
      duration: 1100,
      ease: 'Power2',
      onComplete: () => {
        if (sprite.active && sprite._queueTargetX === targetX) {
          sprite.setPosition(targetX, targetY);
        }
      },
    });
  }

  _moveCarToPost(carId, postIndex) {
    const postPos = WORLD.posts[postIndex];
    const sprite = this._carSprites[carId];
    if (!sprite) return;

    const postData = gameState.posts[postIndex];
    const assigned = gameState.assignCarToPost(carId, postData.id);
    if (!assigned) return;

    // IMPORTANT: cancel the old spawn/queue tween first. Otherwise Phaser runs
    // both tweens on x/y concurrently and the car stays at the entrance or disappears.
    this.tweens.killTweensOf(sprite);
    delete sprite._queueTargetX;
    sprite.setScale(0.54);
    sprite.setDepth(20 + postPos.y * 0.01);

    this.tweens.add({
      targets: sprite,
      x: postPos.x,
      y: postPos.y + 12,
      duration: 850,
      ease: 'Power2',
      onComplete: () => {
        if (sprite.active) {
          sprite.setPosition(postPos.x, postPos.y + 12);
          sprite.setDepth(20 + sprite.y * 0.01);
        }
      },
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
      texKey = car.washProgress > 30 ? `car_${car.carClass}_foam` : `car_${car.carClass}_dirty`;
    } else if (stage === 'rinse') {
      texKey = car.washProgress > 60 ? `car_${car.carClass}` : `car_${car.carClass}_rinse`;
    } else if (stage === 'finish') {
      texKey = `car_${car.carClass}`;
    } else {
      texKey = `car_${car.carClass}_dirty`;
    }

    if (this.textures.exists(texKey)) {
      sprite.setTexture(texKey);
    }
  }

  /**
   * A capped-cadence specular pass adds a clear-coat sheen without per-car objects.
   * Existing textures remain responsible for dirt, foam and rinse state.
   */
  _updateCarFinishHighlights(time) {
    const g = this._carFinishGfx;
    if (!g || !g.active) return;
    g.clear();

    for (const car of gameState.cars) {
      const sprite = this._carSprites[car.id];
      if (!sprite || !sprite.active || sprite.alpha < 0.2) continue;
      const shadow = this._carShadows[car.id];
      if (shadow?.active) {
        shadow.setPosition(sprite.x + 3, sprite.y + Math.max(7, sprite.displayHeight * 0.19));
        shadow.setScale(sprite.scaleX * 0.98, sprite.scaleY * 0.92);
        shadow.setDepth(sprite.depth - 0.02);
        shadow.setAlpha(sprite.alpha * 0.38);
      }
      const stage = BALANCE.services.expressWash.stages[car.washStage];
      const completed = !!car.completed;
      const wet = completed || stage === 'rinse' || stage === 'finish';
      const progress = Math.max(0, Math.min(1, (Number(car.washProgress) || 0) / 100));
      const sheen = completed ? 0.3 : wet ? 0.13 + progress * 0.1 : 0.045;
      const width = Math.max(18, sprite.displayWidth * 0.34);
      const y = sprite.y - Math.max(3, sprite.displayHeight * 0.16);
      const drift = Math.sin(time * 0.0018 + sprite.x * 0.02) * width * 0.12;

      g.lineStyle(Math.max(1, sprite.displayWidth * 0.012), 0xe8faff, sheen);
      g.lineBetween(sprite.x - width * 0.38 + drift, y, sprite.x + width * 0.38 + drift, y - 1.5);
      g.fillStyle(0xc8f5ff, sheen * 0.72);
      g.fillEllipse(sprite.x - width * 0.18 + drift, y - 3, width * 0.2, 2.2);
      g.fillEllipse(sprite.x + width * 0.2 + drift, y - 2, width * 0.12, 1.6);
      if (completed) {
        g.lineStyle(1, 0x7dd3fc, 0.16);
        g.lineBetween(sprite.x - width * 0.3, y + 4, sprite.x + width * 0.3, y + 3);
      }
    }
  }

  _processQueue() {
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.unlocked === false) continue;
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
      if (Math.abs(sprite.x - targetX) > 5 && sprite._queueTargetX !== targetX) {
        // Queue slots may shift after another vehicle leaves; retarget once only.
        this.tweens.killTweensOf(sprite);
        sprite._queueTargetX = targetX;
        this.tweens.add({
          targets: sprite,
          x: targetX,
          y: WORLD.queueStart.y,
          duration: 420,
          ease: 'Power2',
          onComplete: () => {
            if (sprite.active && sprite._queueTargetX === targetX) {
              sprite.setPosition(targetX, WORLD.queueStart.y);
            }
          },
        });
      }
    }
  }

  _updateQueueMood() {
    if (!this._queueMoodGfx) return;
    const gfx = this._queueMoodGfx;
    gfx.clear();
    const coffeeActive = this._coffeeRushUntil > this.time.now;
    for (const carId of gameState.queue) {
      const car = gameState.getCar(carId);
      const sprite = this._carSprites[carId];
      if (!car || !sprite || !sprite.active) continue;
      const patience = Math.max(1, Number(car.patience) || 1);
      const ratio = Phaser.Math.Clamp(1 - (car.waitTime || 0) / patience, 0, 1);
      const x = sprite.x - 18;
      const y = sprite.y - 27;
      const color = coffeeActive ? 0x34d399 : ratio < 0.25 ? 0xfb7185 : ratio < 0.5 ? 0xfbbf24 : 0x38bdf8;
      gfx.fillStyle(0x020817, 0.84);
      gfx.fillRoundedRect(x - 1, y - 1, 38, 7, 3);
      gfx.lineStyle(1, color, coffeeActive ? 0.8 : 0.42);
      gfx.strokeRoundedRect(x - 1, y - 1, 38, 7, 3);
      if (ratio > 0) {
        const alpha = ratio < 0.25 && !coffeeActive ? 0.62 + (Math.sin(this.time.now * 0.018) + 1) * 0.19 : 0.95;
        gfx.fillStyle(color, alpha);
        gfx.fillRoundedRect(x + 1, y + 1, Math.max(2, 34 * ratio), 3, 2);
      }
    }
  }

  _processPatience(delta) {
    // While the coffee amenity is active, queued customers pause their patience timer.
    if (this._coffeeRushUntil > this.time.now) return;
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
    // 1. Создание спрайтов для нанятых сотрудников
    for (let i = 0; i < gameState.employees.length; i++) {
      const emp = gameState.employees[i];
      if (!this._employeeSprites[emp.id]) {
        this._spawnEmployeeSprite(emp, i);
      }
    }

    // 2. Удаление спрайтов уволенных сотрудников
    for (const empId of Object.keys(this._employeeSprites)) {
      if (!gameState.employees.some(e => e.id === empId)) {
        const data = this._employeeSprites[empId];
        if (data && data.sprite && data.sprite.active) {
          data.idleTween?.stop();
          data.workTween?.stop();
          data.idleTween = null;
          data.workTween = null;
          data.sprite.setTexture('employee_walk_1');
          if (data.label) data.label.destroy();
          this.tweens.add({
            targets: data.sprite,
            x: WORLD.exit.x + 40,
            y: WORLD.roadY,
            alpha: 0,
            duration: 1100,
            ease: 'Power2',
            onComplete: () => {
              data.sprite.destroy();
            },
          });
        }
        delete this._employeeSprites[empId];
      }
    }

    // 3. Распределение задач для свободных сотрудников
    for (const emp of gameState.employees) {
      if (emp.status !== 'idle') continue;

      // Техники и универсалы в первую очередь берут задачи ремонта.
      let foundTask = false;
      if (emp.role !== 'washer') {
      for (let i = 0; i < gameState.posts.length; i++) {
        const post = gameState.posts[i];
        if (post.broken && !this._isEmployeeRepairing(post.id)) {
          emp.status = 'repairing';
          emp.assignedPost = post.id;
          this._startEmployeeRepair(emp, i);
          foundTask = true;
          break;
        }
      }
      }
      if (foundTask || emp.role === 'mechanic') continue;

      // Мойщики и универсалы обслуживают машины; техники не отвлекаются от ремонта.
      for (let i = 0; i < gameState.posts.length; i++) {
        const post = gameState.posts[i];
        if (post.busy && post.carId && !post.broken) {
          const car = gameState.getCar(post.carId);
          if (car && car.state === 'washing' && !car.completed && !this._isEmployeeAssigned(post.id)) {
            if (this._washingCar === car.id) continue;
            emp.status = 'working';
            emp.assignedPost = post.id;
            emp.assignedCar = car.id;
            this._startEmployeeWash(emp, car, i);
            break;
          }
        }
      }
    }
  }

  _isEmployeeAssigned(postId) {
    return gameState.employees.some(e => e.assignedPost === postId && e.status === 'working');
  }

  _isEmployeeRepairing(postId) {
    return gameState.employees.some(e => e.assignedPost === postId && e.status === 'repairing');
  }

  _getEmployeeRestPos(empId) {
    const idx = gameState.employees.findIndex(e => e.id === empId);
    const safeIdx = idx >= 0 ? idx : 0;
    return {
      x: WORLD.building.x - 70 + (safeIdx * 45),
      y: WORLD.building.y + 75,
    };
  }

  _spawnEmployeeSprite(emp, index) {
    const rest = this._getEmployeeRestPos(emp.id);
    const sprite = this.add.image(rest.x, rest.y, 'employee_idle').setDepth(14).setScale(0.5);

    const label = this.add.text(rest.x, rest.y - 32, emp.name, {
      fontSize: '10px',
      color: '#fef08a',
      fontStyle: 'bold',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(15);

    const idleTween = this.tweens.add({
      targets: sprite,
      scaleY: { from: 0.49, to: 0.515 },
      angle: { from: -1.2, to: 1.2 },
      duration: 1450 + (index % 3) * 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this._employeeSprites[emp.id] = { sprite, label, emp, idleTween, workTween: null, shadow: null };
  }

  _startEmployeeRepair(emp, bayIndex) {
    const data = this._employeeSprites[emp.id];
    const postPos = WORLD.posts[bayIndex];
    const targetX = postPos.x - 30;
    const targetY = postPos.y + 16;

    if (data && data.sprite) {
      data.idleTween?.stop();
      data.idleTween = null;
      data.workTween?.stop();
      data.workTween = null;
      data.sprite.setScale(0.5).setAngle(0).setTexture('employee_walk_1');
      this.tweens.add({
        targets: data.sprite,
        x: targetX,
        y: targetY,
        duration: 700,
        ease: 'Power1',
        onComplete: () => {
          if (this._destroyed || !data.sprite.active) return;
          data.sprite.setTexture('employee_repair');
          data.workTween = this.tweens.add({
            targets: data.sprite,
            scaleY: { from: 0.47, to: 0.55 },
            angle: { from: -7, to: 5 },
            x: { from: targetX - 2, to: targetX + 2 },
            duration: 190,
            yoyo: true,
            repeat: 10,
            ease: 'Sine.easeInOut',
          });
          this._spawnRepairSparks(targetX, targetY);
          audioManager.play('wrenchRepair');

          this.time.delayedCall(2200, () => {
            if (this._destroyed) return;
            const post = gameState.posts[bayIndex];
            if (post && post.broken) {
              const res = gameState.repairPost(post.id);
              if (res.success) {
                this._postSprites[bayIndex].setTexture('wash-bay-art');
                showToast(`${emp.name} починил ${WORLD.posts[bayIndex].label}!`, 'success');
                audioManager.play('success');
                this._updatePostStatuses();
              }
            }
            emp.status = 'idle';
            emp.assignedPost = null;
            this._returnEmployeeToRest(emp);
          });
        },
      });
    }
  }

  _returnEmployeeToRest(emp) {
    const data = this._employeeSprites[emp.id];
    if (!data || !data.sprite || !data.sprite.active) return;
    data.workTween?.stop();
    data.workTween = null;
    data.idleTween?.stop();
    data.idleTween = null;
    data.sprite.setScale(0.5);
    data.sprite.setAngle(0);
    const rest = this._getEmployeeRestPos(emp.id);

    data.sprite.setTexture('employee_walk_2');
    this.tweens.add({
      targets: data.sprite,
      x: rest.x,
      y: rest.y,
      duration: 800,
      ease: 'Power1',
      onComplete: () => {
        if (data.sprite.active) {
          data.sprite.setTexture('employee_idle');
          data.idleTween = this.tweens.add({
            targets: data.sprite,
            scaleY: { from: 0.49, to: 0.515 },
            angle: { from: -1.2, to: 1.2 },
            duration: 1450 + (Math.max(0, gameState.employees.findIndex(item => item.id === emp.id)) % 3) * 180,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      },
    });
  }

  _startEmployeeWash(emp, car, bayIndex) {
    const stages = BALANCE.services.expressWash.stages;
    car.washStage = 0;
    car.washProgress = 0;

    const postPos = WORLD.posts[bayIndex];
    const targetX = postPos.x - 32;
    const targetY = postPos.y + 14;

    const empData = this._employeeSprites[emp.id];
    if (empData && empData.sprite) {
      empData.idleTween?.stop();
      empData.idleTween = null;
      empData.workTween?.stop();
      empData.workTween = null;
      empData.sprite.setScale(0.5).setAngle(0).setTexture('employee_walk_1');
      this.tweens.add({
        targets: empData.sprite,
        x: targetX,
        y: targetY,
        duration: 650,
        ease: 'Power1',
        onComplete: () => {
          if (empData.sprite.active) {
            empData.sprite.setTexture('employee_work');
          }
        },
      });
    }

    const speedMult = gameState.getUpgradeEffect('washSpeed', 1);
    const carClass = BALANCE.carClasses[car.carClass];
    // Employee service should feel brisk: legacy hires are safely normalized to
    // the new baseline, while car class and purchased speed upgrades still matter.
    const effectiveEmployeeSpeed = Math.max(Number(emp.speed) || 0.9, 0.9);
    const totalTime = BALANCE.services.expressWash.baseDuration * stages.length *
      carClass.timeMultiplier * speedMult / effectiveEmployeeSpeed;
    const stageTime = totalTime / stages.length;
    let currentStage = 0;

    // Visible work loop: the worker leans into the wash and pulses while water
    // effects are triggered at each stage. Keep the tween attached to the worker
    // so it can always be stopped when the task ends or the scene shuts down.
    if (empData?.sprite?.active) {
      empData.sprite.setTexture('employee_work');
      empData.workTween?.stop();
      empData.workTween = this.tweens.add({
        targets: empData.sprite,
        scaleY: { from: 0.47, to: 0.55 },
        scaleX: { from: 0.505, to: 0.49 },
        angle: { from: -5, to: 5 },
        x: { from: targetX - 2, to: targetX + 2 },
        duration: 310,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const advanceStage = () => {
      if (this._destroyed) return;
      const freshCar = gameState.getCar(car.id);
      if (!freshCar || freshCar.completed || freshCar.paid) {
        emp.status = 'idle';
        emp.assignedPost = null;
        emp.assignedCar = null;
        this._returnEmployeeToRest(emp);
        return;
      }

      freshCar.washStage = currentStage;
      freshCar.washProgress = 100;
      this._updateCarVisual(freshCar);

      const sprite = this._carSprites[freshCar.id];
      if (sprite) {
        const isFoam = stages[currentStage] === 'foam';
        this._spawnSplashBurst(sprite.x, sprite.y, isFoam);
        audioManager.play(isFoam ? 'foamSpray' : 'rinse');
      }

      currentStage++;
      if (currentStage >= stages.length) {
        const qualityMult = gameState.getUpgradeEffect('equipmentQuality', 1);
        const quality = Math.min(1, emp.quality * qualityMult);
        freshCar.quality = quality;
        freshCar.state = 'done';
        freshCar.completed = true;
        const profit = gameState.addServiceIncome(freshCar.id, quality);
        audioManager.play('cashRegister');
        this._updateCarVisual(freshCar);

        this.time.delayedCall(1400, () => {
          this._carLeave(freshCar.id);
        });

        this._checkBreakdown(freshCar.postId);

        emp.status = 'idle';
        emp.assignedPost = null;
        emp.assignedCar = null;
        this._returnEmployeeToRest(emp);
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
    this._queueMoodUpdateTimer += delta;
    if (this._queueMoodUpdateTimer >= 180) {
      this._queueMoodUpdateTimer = 0;
      this._updateQueueMood();
    }
    this._processEmployees(delta);

    this._shiftTimer += delta;
    gameState.shiftTimeRemaining = Math.max(0, BALANCE.time.shiftDurationMs - this._shiftTimer);
    this._dayCycleUpdateTimer += delta;
    if (this._dayCycleUpdateTimer >= 100) {
      this._dayCycleUpdateTimer = 0;
      this._updateDayCycle();
    }

    this._updateCameraTracking(false);
    this._updateDepth();
    this._updateActionBtnContext();
    this._updateTargetHighlight(time);
    this._updateSprayEffect(time);
    this._carFinishUpdateTimer += delta;
    if (this._carFinishUpdateTimer >= 110) {
      this._carFinishUpdateTimer = 0;
      this._updateCarFinishHighlights(time);
    }
    this._equipmentAnimTimer += delta;
    if (this._equipmentAnimTimer >= 55) {
      this._equipmentAnimTimer = 0;
      this._updateEquipmentAnimation(time);
    }
    this._updatePostStatuses();

    if (gameState.shiftTimeRemaining <= 0) {
      this.endShift();
      return;
    }

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

    if (this._isWashing && this._washingCar) {
      const sprite = this._carSprites[this._washingCar];
      if (sprite) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);
        if (dist > 130) {
          this._stopWashing();
          showToast('Вы отошли от машины — мойка прервана', 'info');
        }
      }
    }

    if (!gameState.tutorialCompleted && gameState.tutorialStep === 0) {
      const pos = WORLD.posts[0];
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
      if (dist < 115) {
        this._tutorialSystem.advance(0);
      }
    }
  }

  _updateDepth() {
    this.player.setDepth(15 + this.player.y * 0.01);
    for (const carId of Object.keys(this._carSprites)) {
      const sprite = this._carSprites[carId];
      if (sprite && sprite.active) {
        // Машина гарантированно поверх пола (6) и ниже игрока (15).
        const depth = 10 + sprite.y * 0.01;
        sprite.setDepth(depth);
        // Follow the vehicle every frame so the contact shadow never lags
        // behind during queue shifts, bay assignment or arrival tweens.
        const shadow = this._carShadows[carId];
        if (shadow?.active) {
          shadow.setPosition(sprite.x + 3, sprite.y + Math.max(7, sprite.displayHeight * 0.19));
          shadow.setScale(sprite.scaleX * 0.98, sprite.scaleY * 0.92);
          shadow.setDepth(depth - 0.02);
          shadow.setAlpha(sprite.alpha * 0.38);
        }
      }
    }
    for (const empId of Object.keys(this._employeeSprites)) {
      const data = this._employeeSprites[empId];
      if (data && data.sprite && data.sprite.active) {
        data.sprite.setDepth(14 + data.sprite.y * 0.01);
        if (data.label && data.label.active) {
          data.label.setDepth(16 + data.sprite.y * 0.01);
          data.label.setPosition(data.sprite.x, data.sprite.y - 32);
        }
      }
    }
  }

  endShift() {
    if (gameState.shiftEndProcessing) return;
    gameState.shiftEndProcessing = true;
    gameState.shiftActive = false;
    gameState.shiftTimeRemaining = 0;
    updateHUD();

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

    for (const empId of Object.keys(this._employeeSprites)) {
      const data = this._employeeSprites[empId];
      if (data && data.sprite && data.sprite.active) {
        data.workTween?.stop();
        data.workTween = null;
        data.sprite.setScale(0.5);
        data.sprite.setAngle(0);
        data.sprite.setTexture('employee_idle');
        const rest = this._getEmployeeRestPos(empId);
        data.sprite.setPosition(rest.x, rest.y);
        if (data.label && data.label.active) {
          data.label.setPosition(rest.x, rest.y - 32);
        }
      }
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
    if (this._queueMoodGfx) this._queueMoodGfx.clear();

    for (const post of gameState.posts) {
      post.busy = false;
      post.carId = null;
    }

    // Применение суточных расходов
    gameState.applyDailyExpenses();

    // Проверка надзорных инспекций (СЭС, МЧС, Экология)
    const inspResult = gameState.checkInspections();

    saveSystem.save();
    this._storySystem.checkEvents(this);
    this._showDayReport(inspResult);

    gameState.shiftEndProcessing = false;
  }

  _showDayReport(inspResult = null) {
    const overlay = document.getElementById('ui-overlay');
    const todayLogs = gameState.financialLog.filter(l => l.day === gameState.day);
    const income = todayLogs.filter(l => l.type === 'income').reduce((s, l) => s + l.amount, 0);
    const expenses = todayLogs.filter(l => l.type === 'expense').reduce((s, l) => s + l.amount, 0);
    const profit = income - expenses;

    const unlockedToday = todayLogs.filter(log => log.type === 'income' && log.description.startsWith('Достижение:'));

    let rows = '';
    for (const log of todayLogs) {
      const cls = log.type === 'income' ? 'income' : 'expense';
      const sign = log.type === 'income' ? '+' : '-';
      rows += `<tr class="${cls}"><td>${log.description}</td><td>${sign}${this._formatMoney(log.amount)}</td></tr>`;
    }

    let inspectionNotice = '';
    if (inspResult) {
      if (inspResult.passed) {
        inspectionNotice = `
          <div style="background:rgba(34,197,94,0.12);border:1px solid #22c55e;border-radius:8px;padding:8px;margin:8px 0;font-size:12px;color:#86efac;">
            ✓ <strong>${inspResult.insp.name}</strong> пройдена успешно! Репутация повышена (+5).
          </div>
        `;
      } else {
        inspectionNotice = `
          <div style="background:rgba(239,68,68,0.15);border:1px solid #ef4444;border-radius:8px;padding:8px;margin:8px 0;font-size:12px;color:#fca5a5;">
            ⚠️ <strong>${inspResult.insp.name}:</strong> Выявлено нарушение! Отсутствует ${inspResult.docDef.name}. Наложен штраф <strong>${this._formatMoney(inspResult.fine)}</strong>. Оформите документ в разделе «Бизнес».
          </div>
        `;
      }
    }

    const panel = document.createElement('div');
    panel.className = 'panel-overlay';
    panel.innerHTML = `
      <div class="panel">
        <button class="panel-close" id="report-close">✕</button>
        <h2>Итоги смены ${gameState.day}</h2>
        ${inspectionNotice}
        <table class="finance-table">
          ${rows}
          <tr class="total">
            <td>Прибыль за смену</td>
            <td style="color:${profit >= 0 ? '#22c55e' : '#ef4444'}">${profit >= 0 ? '+' : ''}${this._formatMoney(profit)}</td>
          </tr>
        </table>
        <div class="shift-report-metrics">
          <div><span>АВТО ЗА СМЕНУ</span><strong>${gameState.stats.todayCarsWashed}</strong></div>
          <div><span>ИДЕАЛЬНЫЕ МОЙКИ</span><strong>${gameState.stats.todayPerfectWashes}</strong></div>
          <div><span>РЕПУТАЦИЯ</span><strong>${Math.round(gameState.reputation)} / 100</strong></div>
        </div>
        ${unlockedToday.length ? `<div class="shift-report-achievements"><strong>🏆 Новые достижения</strong><span>${unlockedToday.map(log => log.description.replace('Достижение: ', '')).join(' · ')}</span></div>` : ''}
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

    if (!gameState.tutorialCompleted) {
      this._tutorialSystem.complete();
    }
  }

  _startNextDay() {
    gameState.nextDay();
    this._shiftTimer = 0;
    this._spawnTimer = 0;
    this._dayCycleUpdateTimer = 0;
    this._updateDayCycle();
    this._storySystem.checkEvents(this);
    updateHUD();
    saveSystem.save();
  }

  _updateSprayEffect(time) {
    if (!this._sprayGfx) return;
    this._sprayGfx.clear();
    this._wetFloorGfx?.clear();

    if (!this._isWashing || !this._washingCar) {
      if (this._activeSprayEmitter) this._activeSprayEmitter.stop();
      if (this._waterMist?.emitting) this._waterMist.stop();
      if (this._foamMist?.emitting) this._foamMist.stop();
      this._activeSprayEmitter = null;
      if (this._lastWetPosition && (time || 0) < this._wetFloorUntil) {
        const fade = Phaser.Math.Clamp((this._wetFloorUntil - (time || 0)) / 5200, 0, 1);
        const wet = this._wetFloorGfx;
        wet.fillStyle(0x071522, 0.16 * fade);
        wet.fillEllipse(this._lastWetPosition.x, this._lastWetPosition.y + 5, 100, 25);
        wet.fillStyle(0x0e7490, 0.13 * fade);
        wet.fillEllipse(this._lastWetPosition.x - 3, this._lastWetPosition.y + 2, 78, 13);
        wet.lineStyle(1, 0xb9f3ff, 0.2 * fade);
        wet.strokeEllipse(this._lastWetPosition.x + 5, this._lastWetPosition.y + 3, 66, 11);
      } else {
        this._lastWetPosition = null;
      }
      return;
    }

    const car = gameState.getCar(this._washingCar);
    const sprite = this._carSprites[this._washingCar];
    if (!car || !sprite || !this.player) return;

    const stages = BALANCE.services.expressWash.stages;
    const currentStage = stages[car.washStage] || 'foam';
    const pX = this.player.x + 14;
    const pY = this.player.y - 6;
    const t = (time || 0) * 0.006;
    const targetX = sprite.x + Math.sin(t * 3) * 16;
    const targetY = sprite.y + Math.cos(t * 4) * 8;
    const isFoam = currentStage === 'foam';
    const washRatio = Phaser.Math.Clamp((car.washProgress || 0) / 100, 0, 1);
    const wet = this._wetFloorGfx;
    this._lastWetPosition = { x: sprite.x, y: sprite.y + 18 };
    this._wetFloorUntil = (time || 0) + 5200;
    if (wet) {
      const floorY = sprite.y + 18;
      const pulseFloor = 0.92 + Math.sin(t * 2.4) * 0.05;
      // Irregular shallow puddle with layered cool reflections.
      wet.fillStyle(0x071522, 0.22);
      wet.fillEllipse(sprite.x + 2, floorY + 5, 104 * pulseFloor, 27 * pulseFloor);
      wet.fillStyle(0x0e7490, 0.16 + washRatio * 0.12);
      wet.fillEllipse(sprite.x - 2, floorY + 3, 88 * pulseFloor, 17 * pulseFloor);
      wet.fillStyle(0x7dd3fc, 0.14 + washRatio * 0.1);
      wet.fillEllipse(sprite.x - 10, floorY, 49 * pulseFloor, 5 * pulseFloor);
      wet.lineStyle(1, 0xcaf4ff, 0.25 + Math.sin(t * 3.2) * 0.08);
      wet.strokeEllipse(sprite.x + 7, floorY + 3, 70 * pulseFloor, 12 * pulseFloor);
      // Ripples drift outward from the impact zone, strongest during rinse.
      if (!isFoam) {
        for (let i = 0; i < 3; i++) {
          const phase = (t * 0.65 + i / 3) % 1;
          const radius = 5 + phase * 19;
          wet.lineStyle(1, 0xb9f3ff, (1 - phase) * 0.22);
          wet.strokeEllipse(targetX + (i - 1) * 7, floorY + 1, radius * 2, radius * 0.48);
        }
      }
    }
    const emitter = isFoam ? this._foamMist : this._waterMist;
    const inactive = isFoam ? this._waterMist : this._foamMist;

    if (inactive?.emitting) inactive.stop();
    if (this._activeSprayEmitter !== emitter) {
      this._activeSprayEmitter?.stop();
      emitter?.start();
      this._activeSprayEmitter = emitter;
    }
    emitter?.setPosition(targetX, targetY);

    const color = isFoam ? 0xeafaff : 0x67dfff;
    const alpha = isFoam ? 0.7 : 0.62;
    const dx = targetX - pX;
    const dy = targetY - pY;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;

    // Layered pressure stream: soft outer cone, bright core and moving glints.
    this._sprayGfx.lineStyle(isFoam ? 8 : 6, color, alpha * 0.12);
    this._sprayGfx.lineBetween(pX, pY, targetX, targetY);
    this._sprayGfx.lineStyle(isFoam ? 3.2 : 2.2, color, alpha);
    this._sprayGfx.lineBetween(pX, pY, targetX, targetY);
    this._sprayGfx.lineStyle(1, 0xffffff, 0.78);
    this._sprayGfx.lineBetween(pX + nx * 1.5, pY + ny * 1.5, targetX + nx, targetY + ny);

    const pulse = 0.72 + Math.sin(t * 7) * 0.16;
    this._sprayGfx.fillStyle(color, 0.16);
    this._sprayGfx.fillCircle(targetX, targetY, (isFoam ? 18 : 13) * pulse);
    this._sprayGfx.fillStyle(color, 0.46);
    this._sprayGfx.fillCircle(targetX, targetY, isFoam ? 7 : 4.5);
    this._sprayGfx.fillStyle(0xffffff, 0.72);
    this._sprayGfx.fillCircle(targetX - 2, targetY - 2, isFoam ? 2.8 : 1.8);

    // Small directional spray streaks make the impact read at phone scale.
    for (let i = 0; i < 3; i++) {
      const phase = t * 2.2 + i * 2.1;
      const offset = Math.sin(phase) * (isFoam ? 8 : 12);
      const x = targetX + nx * offset;
      const y = targetY + ny * offset;
      this._sprayGfx.fillStyle(0xffffff, 0.34 - i * 0.07);
      this._sprayGfx.fillCircle(x, y, isFoam ? 2.2 : 1.5);
    }
  }

  _spawnSplashBurst(x, y, isFoam = false) {
    const emitter = isFoam ? this._foamMist : this._waterMist;
    if (emitter && emitter.active) {
      emitter.explode(isFoam ? 9 : 13, x, y);
      return;
    }

    // Safe fallback if a burst is requested during scene teardown.
    const tex = isFoam ? 'particle_foam' : 'particle_water';
    for (let i = 0; i < 5; i++) {
      const p = this.add.image(x, y, tex).setDepth(23);
      const angle = (Math.PI * 2 * i) / 5 + (Math.random() - 0.5) * 0.4;
      const speed = 22 + Math.random() * 28;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        scale: { from: 0.8, to: 0.12 },
        alpha: { from: 0.8, to: 0 },
        duration: 300 + Math.random() * 100,
        ease: 'Power1',
        onComplete: () => p.destroy(),
      });
    }
  }

  _spawnCleanSparkles(x, y) {
    const offsets = [
      { dx: -35, dy: -14 },
      { dx: 30, dy: -12 },
      { dx: -20, dy: 16 },
      { dx: 25, dy: 14 },
    ];
    for (let i = 0; i < offsets.length; i++) {
      this.time.delayedCall(i * 120, () => {
        const off = offsets[i];
        const star = this.add.text(x + off.dx, y + off.dy, '✦', {
          fontSize: '18px',
          color: '#fef08a',
          fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(24);

        this.tweens.add({
          targets: star,
          scale: { from: 0.3, to: 1.4 },
          alpha: { from: 1, to: 0 },
          y: y + off.dy - 12,
          duration: 500,
          ease: 'Back.easeOut',
          onComplete: () => star.destroy(),
        });
      });
    }
  }

  _spawnRepairSparks(x, y) {
    for (let i = 0; i < 9; i++) {
      const spark = this.add.rectangle(x, y - 20, 3, 3, i % 2 === 0 ? 0xf59e0b : 0xef4444);
      spark.setDepth(23);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 20 + Math.random() * 30;
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * speed,
        y: y - 20 + Math.sin(angle) * speed,
        alpha: { from: 1, to: 0 },
        duration: 250 + Math.random() * 150,
        onComplete: () => spark.destroy(),
      });
    }
  }

  _formatMoney(amount) {
    if (typeof amount !== 'number' || !isFinite(amount)) return '0 ₽';
    return amount.toLocaleString('ru-RU') + ' ₽';
  }

  shutdown() {
    this._destroyed = true;
    this._stopWashing();
    audioManager.stopSpray();
    this.scale.off('resize', this._handleResize, this);
    saveSystem.stopAutoSave();
    gameState.off('stateChanged', this._onStateChanged);
    gameState.off('achievementUnlocked', this._onAchievementUnlocked);
    gameState.off('perfectStreakBonus', this._onPerfectStreakBonus);
    destroyHUD();
    hideWashProgress();

    for (const data of Object.values(this._employeeSprites)) {
      data?.workTween?.stop();
      if (data?.sprite?.active) {
        data.sprite.setScale(0.5);
        data.sprite.setAngle(0);
      }
    }

    if (this._competitorGroup) {
      this._competitorGroup.destroy(true);
      this._competitorGroup = null;
    }
    this._competitorVisualKey = null;
    if (this._targetHighlight) {
      this._targetHighlight.destroy();
    }

    if (this._sprayGfx) {
      this._sprayGfx.destroy();
    }
    if (this._wetFloorGfx) this._wetFloorGfx.destroy();
    if (this._equipmentGfx) this._equipmentGfx.destroy();
    if (this._carFinishGfx) this._carFinishGfx.destroy();
    this._carFinishGfx = null;
    for (const shadow of Object.values(this._carShadows || {})) shadow?.destroy();
    this._carShadows = {};
    this._equipmentGfx = null;
    this._wetFloorGfx = null;
    if (this._waterMist) this._waterMist.destroy();
    if (this._foamMist) this._foamMist.destroy();
    this._waterMist = null;
    this._foamMist = null;
    this._activeSprayEmitter = null;
    if (this._queueMoodGfx) {
      this._queueMoodGfx.destroy();
      this._queueMoodGfx = null;
    }

    if (this._touchControlsRoot) {
      this._touchControlsRoot.remove();
      this._touchControlsRoot = null;
    }

    for (const empId of Object.keys(this._employeeSprites)) {
      const data = this._employeeSprites[empId];
      if (data) {
        if (data.sprite) data.sprite.destroy();
        if (data.label) data.label.destroy();
      }
    }
    this._employeeSprites = {};

    for (const timerId of Object.keys(this._employeeTimers)) {
      if (this._employeeTimers[timerId]) {
        this._employeeTimers[timerId].remove(false);
      }
    }
  }
}
