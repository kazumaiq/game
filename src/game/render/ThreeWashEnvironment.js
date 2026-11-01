import * as THREE from 'three';

const WORLD = { width: 900, height: 820 };
const DEG = Math.PI / 180;

function mat(color, roughness = 0.72, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export class ThreeWashEnvironment {
  constructor(scene) {
    this.gameScene = scene;
    this.host = document.getElementById('game-shell');
    if (!this.host) throw new Error('Не найден контейнер игрового мира #game-shell');

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'three-world-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.host.insertBefore(this.canvas, document.getElementById('game-container'));

    const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    this.maxFps = mobile ? 30 : 60;
    this.lastFrame = 0;
    this.disposed = false;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: !mobile,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.world = new THREE.Scene();
    this.world.background = null;
    this.world.fog = new THREE.Fog(0x263744, 1250, 2300);

    // Phaser uses X/Y on the ground. Three.js uses X/Z for the ground and Y for height.
    // A near-overhead orthographic camera preserves the existing control/gameplay layout
    // while the slight tilt reveals the vertical faces of buildings and wash equipment.
    this.camera = new THREE.OrthographicCamera(-450, 450, 410, -410, 0.1, 2600);
    this.camera.up.set(0, 0, -1);
    this.camera.position.set(450, 1500, 800);
    this.camera.lookAt(450, 0, 410);

    this.carActors = new Map();
    this.workerActor = null;
    this.washTime = 0;
    this.washingCarId = null;
    this.washBrushes = [];
    this.carPaintColor = new THREE.Color();
    this._buildLighting();
    this._buildGround();
    this._buildMainBuilding();
    this._buildWashBays();
    this._buildRivalLocation();
    this._buildStreetFurniture();

    this._resize = () => this.resize();
    window.addEventListener('resize', this._resize, { passive: true });
    this.resize();
    this._syncCamera();
    this._raf = requestAnimationFrame(this._frame);
  }

  _buildLighting() {
    this.world.add(new THREE.HemisphereLight(0xd5edff, 0x26313b, 2.15));

    const sun = new THREE.DirectionalLight(0xffe3c4, 3.25);
    sun.position.set(-340, 1050, 520);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -620;
    sun.shadow.camera.right = 620;
    sun.shadow.camera.top = 720;
    sun.shadow.camera.bottom = -720;
    sun.shadow.bias = -0.00025;
    this.world.add(sun);

    const cyan = new THREE.PointLight(0x35cfff, 78, 520, 2);
    cyan.position.set(300, 190, 510);
    this.world.add(cyan);
    const pink = new THREE.PointLight(0xff4f91, 38, 420, 2);
    pink.position.set(610, 150, 510);
    this.world.add(pink);
    const warm = new THREE.PointLight(0xffb36b, 46, 430, 2);
    warm.position.set(450, 170, 690);
    this.world.add(warm);
  }

  _add(geometry, material, x, height, z, options = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, height, z);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    this.world.add(mesh);
    return mesh;
  }

  _box(x, z, base, width, depth, height, color, roughness = 0.7, metalness = 0.08, options = {}) {
    return this._add(
      new THREE.BoxGeometry(width, height, depth),
      mat(color, roughness, metalness),
      x, base + height / 2, z, options
    );
  }

  _groundPlane(x, z, width, depth, height, material, options = {}) {
    const mesh = this._add(new THREE.PlaneGeometry(width, depth), material, x, height, z, options);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  _buildGround() {
    this._groundPlane(450, 410, 1160, 1120, -8,
      new THREE.MeshPhysicalMaterial({
        color: 0x303b46, roughness: 0.27, metalness: 0.18,
        clearcoat: 0.72, clearcoatRoughness: 0.2,
      }), { castShadow: false });

    // Subtle concrete panels, curb, drains and real reflective puddles.
    for (let i = 0; i < 18; i++) {
      const x = 45 + i * 48;
      this._box(x, 310, -6.5, 27, 1.6, 0.7, i % 3 ? 0x71808b : 0x9bb8c7, 0.45, 0.2, { castShadow: false });
    }
    for (const x of [300, 600]) {
      this._box(x, 425, -5.4, 224, 8, 1.4, 0x111b25, 0.42, 0.62, { castShadow: false });
      for (let i = 0; i < 22; i++) {
        this._box(x - 105 + i * 10, 425, -3.8, 2, 6, 0.6, 0x9aabb8, 0.32, 0.82, { castShadow: false });
      }
      const puddle = this._groundPlane(x + 28, 365, 165, 42, -5.2,
        new THREE.MeshPhysicalMaterial({
          color: 0x57c9e9, roughness: 0.08, metalness: 0.32,
          transparent: true, opacity: 0.2, clearcoat: 1, clearcoatRoughness: 0.06,
        }), { castShadow: false });
    }
    this._box(450, 96, -2, 820, 12, 7, 0x687985, 0.82, 0.08);
    this._box(450, 84, -5, 820, 5, 2, 0xd1dbe1, 0.65, 0.08);
    this._box(450, 598, -2, 820, 8, 7, 0x64727d, 0.8, 0.08);
    this._box(450, 606, -1, 820, 2, 1, 0xffb36b, 0.3, 0.35, { castShadow: false });
  }

  _buildMainBuilding() {
    this._box(450, 690, 0, 590, 126, 104, 0x172533, 0.62, 0.28);
    this._box(450, 688, 105, 604, 12, 8, 0x0c1722, 0.32, 0.45);
    this._box(450, 683, 113, 612, 8, 2.5, 0x35c9f3, 0.25, 0.55, { castShadow: false });

    this._box(450, 624, 12, 500, 5, 75, 0x101d2b, 0.2, 0.35);
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x5ca2ba, roughness: 0.12, metalness: 0.3,
      transparent: true, opacity: 0.56, clearcoat: 1,
    });
    this._add(new THREE.BoxGeometry(490, 68, 3), glass, 450, 51, 624, { castShadow: false });
    for (let i = 0; i < 8; i++) this._box(220 + i * 65, 624, 13, 3.2, 4, 73, 0x91d9ed, 0.16, 0.6, { castShadow: false });

    this._box(450, 616, 0, 610, 16, 8, 0x263b4c, 0.48, 0.35);
    this._box(450, 609, 8, 580, 2, 2, 0xffb56e, 0.25, 0.35, { castShadow: false });
    this._box(450, 751, 0, 625, 24, 10, 0x263747, 0.55, 0.25);
    this._box(450, 751, 10, 590, 4, 2, 0x42d7f1, 0.24, 0.5, { castShadow: false });

    for (const x of [250, 650]) {
      this._box(x, 740, 12, 56, 34, 22, 0x455766, 0.72, 0.3);
      for (let i = 0; i < 5; i++) this._box(x - 20 + i * 10, 721, 34, 2, 1.5, 12, 0x17232e, 0.7, 0.3);
    }
    this._box(450, 754, 18, 250, 5, 28, 0x0c1520, 0.45, 0.3);
    this._box(450, 750, 47, 235, 2, 2, 0xffb36b, 0.2, 0.4, { castShadow: false });
  }

  _buildWashBays() {
    for (const [index, x] of [300, 600].entries()) {
      const z = 510;
      this._box(x, z, -1, 286, 190, 12, 0x1d2b37, 0.58, 0.22);
      this._box(x, z, 11, 276, 180, 2, 0x465763, 0.38, 0.32);
      this._box(x, z, 13, 258, 162, 1.2, 0x15232e, 0.24, 0.38, { castShadow: false });
      this._box(x, z + 79, 15, 254, 5, 112, 0x223747, 0.42, 0.35);

      const glass = new THREE.MeshPhysicalMaterial({
        color: index ? 0x5ca9bd : 0x75c9d7, roughness: 0.18, metalness: 0.22,
        transparent: true, opacity: 0.2, clearcoat: 1,
      });
      this._add(new THREE.BoxGeometry(5, 92, 150), glass, x - 128, 65, z - 2, { castShadow: false });
      this._add(new THREE.BoxGeometry(5, 92, 150), glass, x + 128, 65, z - 2, { castShadow: false });

      for (const side of [-1, 1]) {
        this._box(x + side * 120, z - 4, 14, 13, 13, 136, 0x8296a3, 0.32, 0.72);
        this._box(x + side * 120, z - 4, 151, 17, 17, 8, 0x152432, 0.42, 0.42);
        this._box(x + side * 120, z - 4, 159, 18, 18, 2, 0x43d7f0, 0.22, 0.55, { castShadow: false });
      }
      this._box(x, z + 4, 150, 254, 18, 12, 0x263a4b, 0.34, 0.65);
      this._box(x, z + 4, 157, 238, 3, 2, 0x40d9f1, 0.2, 0.5, { castShadow: false });

      for (const side of [-1, 1]) {
        const brush = new THREE.Group();
        brush.position.set(x + side * 91, 65, z - 10);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 82, 16), mat(0x183b4c, 0.62, 0.24));
        core.rotation.z = Math.PI / 2;
        brush.add(core);
        for (let segment = -3; segment <= 3; segment++) {
          const tuft = new THREE.Mesh(new THREE.BoxGeometry(11, 2.4, 2.4), mat(segment % 2 ? 0x56c8df : 0x35a7c9, 0.48, 0.22));
          tuft.position.x = segment * 11;
          for (let spoke = 0; spoke < 8; spoke++) {
            const fin = new THREE.Mesh(new THREE.BoxGeometry(9.5, 8, 2), tuft.material);
            fin.position.x = segment * 11;
            fin.rotation.x = spoke * Math.PI / 4;
            brush.add(fin);
          }
          brush.add(tuft);
        }
        brush.traverse((part) => { part.castShadow = true; part.receiveShadow = true; });
        this.world.add(brush);
        this.washBrushes.push(brush);
      }

      this._box(x, z - 3, 139, 176, 8, 5, 0x344c5d, 0.36, 0.65);
      for (let i = 0; i < 11; i++) {
        this._add(new THREE.CylinderGeometry(1.6, 2.4, 10, 8), mat(0x9cecff, 0.26, 0.7),
          x - 76 + i * 15, 132, z - 3);
      }
      this._box(x, z - 54, 14, 208, 1.5, 0.8, 0x4ac6e5, 0.18, 0.38, { castShadow: false });
      for (let i = 0; i < 9; i++) {
        this._box(x - 76 + i * 19, z + 73, 14, 2, 7, 0.8, 0x9bb2c0, 0.35, 0.6, { castShadow: false });
      }
    }
  }

  _buildRivalLocation() {
    this._box(450, 160, -1, 770, 150, 10, 0x202c37, 0.68, 0.18);
    this._box(450, 160, 8, 700, 118, 78, 0x202c39, 0.62, 0.22);
    this._box(450, 220, 86, 730, 12, 8, 0x111e2b, 0.42, 0.45);
    for (const x of [250, 450, 650]) {
      this._box(x, 170, 15, 184, 6, 60, 0x142434, 0.24, 0.3);
      this._box(x - 86, 165, 16, 8, 8, 74, 0x879ba8, 0.32, 0.72);
      this._box(x + 86, 165, 16, 8, 8, 74, 0x879ba8, 0.32, 0.72);
      this._box(x, 165, 88, 180, 12, 8, 0xff9a50, 0.28, 0.45, { castShadow: false });
    }
    this._box(450, 238, 96, 260, 3, 24, 0x0b1520, 0.5, 0.3);
    this._box(450, 236, 120, 250, 2, 2, 0xff9a50, 0.2, 0.4, { castShadow: false });
  }

  _buildStreetFurniture() {
    for (const x of [36, 864]) {
      this._box(x, 355, -2, 10, 10, 110, 0x334858, 0.48, 0.62);
      this._add(new THREE.SphereGeometry(9, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0xffe7b5, emissive: 0xffbd72, emissiveIntensity: 2.2 }),
        x, 112, 355, { castShadow: false });
      const glow = new THREE.PointLight(0xffcf8a, 24, 190, 2);
      glow.position.set(x, 110, 355);
      this.world.add(glow);
    }
    for (const x of [170, 730]) {
      this._box(x, 300, -1, 48, 48, 22, 0x3d4a55, 0.82, 0.05);
      this._add(new THREE.SphereGeometry(27, 18, 14), mat(0x2e9667, 0.9), x, 39, 300);
      this._add(new THREE.SphereGeometry(18, 16, 12), mat(0x3bb77b, 0.88), x - 12, 48, 310);
    }
  }

  _createCarActor(id, sprite) {
    const group = new THREE.Group();
    const colorMap = {
      sedan: 0x2775c8, compact: 0x27a58a, suv: 0x7c8796,
      wagon: 0xc44f69, van: 0xd2d7dc, premium: 0x202a36,
    };
    const className = String(sprite.texture?.key || '').replace(/^car_/, '').replace(/_(dirty|foam|rinse)$/, '');
    const paint = colorMap[className] || 0x2879bd;
    const profiles = {
      compact: { length: 60, width: 29, cabin: 33, cabinY: 14, wheelbase: 39, roof: 17 },
      sedan: { length: 70, width: 30, cabin: 39, cabinY: 15, wheelbase: 46, roof: 18 },
      suv: { length: 70, width: 34, cabin: 38, cabinY: 18, wheelbase: 44, roof: 22 },
      wagon: { length: 73, width: 30, cabin: 47, cabinY: 15, wheelbase: 47, roof: 18 },
      van: { length: 72, width: 34, cabin: 49, cabinY: 17, wheelbase: 43, roof: 23 },
      premium: { length: 74, width: 32, cabin: 42, cabinY: 15, wheelbase: 49, roof: 19 },
    };
    const shape = profiles[className] || profiles.sedan;
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: paint, roughness: 0.24, metalness: 0.42, clearcoat: 0.82, clearcoatRoughness: 0.16 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x17384d, roughness: 0.12, metalness: 0.28, clearcoat: 1 });
    const rubber = mat(0x111820, 0.92, 0.02);
    const metal = mat(0x9aa9b4, 0.28, 0.8);
    const light = new THREE.MeshStandardMaterial({ color: 0xfff0bd, emissive: 0xffd27a, emissiveIntensity: 0.7 });
    const rear = new THREE.MeshStandardMaterial({ color: 0xff3e52, emissive: 0xb20e25, emissiveIntensity: 0.6 });
    const wheels = [];
    const addBox = (w, h, d, material, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    // Distinct body, cabin and glazing proportions keep each customer class readable.
    const halfLength = shape.length / 2;
    addBox(shape.length, 8, shape.width, bodyMat, 0, 7, 0);
    addBox(shape.length * 0.82, 4, shape.width * 0.92, bodyMat, 0, 11, 0);
    const cabinFront = shape.cabin * 0.12;
    const cabinRear = -shape.cabin * 0.22;
    addBox(shape.cabin, shape.roof - 8, shape.width * 0.72, glassMat, (cabinFront + cabinRear) / 2, shape.cabinY, 0);
    addBox(shape.cabin * 0.62, 2.2, shape.width * 0.75, bodyMat, (cabinFront + cabinRear) / 2, shape.cabinY + (shape.roof - 8) / 2, 0);
    addBox(4, 2.5, shape.width + 2, metal, -halfLength + 1, 6, 0);
    addBox(4, 2.5, shape.width + 2, metal, halfLength - 1, 6, 0);
    for (const x of [-shape.wheelbase / 2, shape.wheelbase / 2]) for (const z of [-shape.width * 0.51, shape.width * 0.51]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 5.5, z);
      group.add(wheel);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 4.5, 16), rubber);
      tire.rotation.z = Math.PI / 2;
      wheel.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 4.8, 12), metal);
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);
      for (let spoke = 0; spoke < 5; spoke++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.2, 0.7), metal);
        bar.position.y = 0;
        bar.rotation.x = spoke * Math.PI * 2 / 5;
        hub.add(bar);
      }
      wheels.push(wheel);
    }
    for (const z of [-shape.width * 0.43, shape.width * 0.43]) {
      addBox(3, 2.4, 5, light, halfLength - 2, 8, z);
      addBox(3, 2.6, 5, rear, -halfLength + 2, 8, z);
      addBox(5, 3.6, 4, bodyMat, 4, 10.2, z * 1.08); // side mirror
      addBox(shape.cabin * 0.48, 1.5, 1.1, metal, -2, 12, z * 1.02); // door handle
    }
    // Hood and grille details face the positive-X front of the car.
    addBox(2, 4, shape.width * 0.34, mat(0x1a2731, 0.48, 0.28), halfLength - 0.8, 7, 0);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(38, 28),
      new THREE.MeshBasicMaterial({ color: 0x02060b, transparent: true, opacity: 0.34, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(shape.length / 34, shape.width / 31, 1);
    shadow.position.set(0, 0.2, 0);
    group.add(shadow);
    this.world.add(group);
    this.carActors.set(id, { group, bodyMat, className, shadow, wheels, lastX: sprite.x, lastY: sprite.y });
    return this.carActors.get(id);
  }

  _createWorkerActor() {
    const group = new THREE.Group();
    const uniform = mat(0x176f9a, 0.58, 0.12);
    const trim = mat(0x5de0e8, 0.35, 0.25);
    const skin = mat(0xf0c4a1, 0.8, 0);
    const dark = mat(0x17232d, 0.8, 0.02);
    const limbs = [];
    const add = (geometry, material, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    add(new THREE.CapsuleGeometry(6, 13, 4, 8), uniform, 0, 17, 0);
    add(new THREE.SphereGeometry(5.5, 12, 10), skin, 0, 29, 0);
    add(new THREE.BoxGeometry(13, 2, 8), trim, 0, 23, 0);
    add(new THREE.BoxGeometry(3, 2, 8), dark, 0, 34, 0);
    for (const side of [-1, 1]) {
      const arm = add(new THREE.CapsuleGeometry(2, 9, 3, 6), uniform, side * 8, 17, 0);
      const leg = add(new THREE.CapsuleGeometry(2.3, 8, 3, 6), dark, side * 3, 5, 0);
      arm.geometry.translate(0, -4, 0);
      leg.geometry.translate(0, -4, 0);
      arm.position.set(side * 6, 20, 0);
      limbs.push({ arm, leg, side });
    }
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(12, 20),
      new THREE.MeshBasicMaterial({ color: 0x02060b, transparent: true, opacity: 0.28, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.2, 0.6, 1);
    shadow.position.y = 0.15;
    group.add(shadow);
    this.world.add(group);
    this.workerActor = group;
    this.workerLimbs = limbs;
  }

  syncActors(player, carSprites, washState = null) {
    if (this.disposed) return;
    this.washTime += 1 / this.maxFps;
    this.washingCarId = washState?.active ? String(washState.carId) : null;
    if (!this.workerActor) this._createWorkerActor();
    if (player?.active) {
      this.workerActor.visible = player.active !== false;
      this.workerActor.position.set(player.x, 0, player.y);
      const vx = player.body?.velocity?.x || 0;
      const vy = player.body?.velocity?.y || 0;
      const speed = Math.hypot(vx, vy);
      if (speed > 1) this.workerActor.rotation.y = Math.atan2(vx, -vy);
      const gait = speed > 1 ? Math.sin(this.washTime * 10) * Math.min(0.65, speed / 120) : (washState?.active ? Math.sin(this.washTime * 7) * 0.22 : 0);
      for (const { arm, leg, side } of this.workerLimbs || []) {
        arm.rotation.z = gait * side;
        leg.rotation.z = -gait * side;
      }
    }
    const active = new Set();
    for (const [id, sprite] of Object.entries(carSprites || {})) {
      if (!sprite?.active) continue;
      active.add(id);
      const actor = this.carActors.get(id) || this._createCarActor(id, sprite);
      actor.group.visible = sprite.active !== false && sprite.alpha > 0.01;
      actor.group.position.set(sprite.x, 0, sprite.y);
      actor.group.rotation.y = -sprite.rotation;
      actor.group.scale.setScalar(Math.max(0.35, sprite.scaleX || 1));
      const travel = Math.hypot(sprite.x - actor.lastX, sprite.y - actor.lastY);
      if (travel > 0.01) for (const wheel of actor.wheels) wheel.rotation.x += travel / 6.2;
      actor.lastX = sprite.x;
      actor.lastY = sprite.y;
      const textureKey = String(sprite.texture?.key || '');
      const clean = !/(dirty|foam)/.test(textureKey);
      const washing = String(id) === this.washingCarId;
      const progress = washing
        ? THREE.MathUtils.clamp(((Number(washState.stageIndex) || 0) + THREE.MathUtils.clamp(Number(washState.progress) / 100, 0, 1)) / Math.max(1, Number(washState.stageCount) || 1), 0, 1)
        : (clean ? 1 : 0);
      const dirty = 1 - progress;
      actor.bodyMat.color.setHex(0x3e9bc8).lerp(this.carPaintColor.setHex(0x75624e), dirty * (washing ? 0.72 : 0.86));
      actor.bodyMat.roughness = THREE.MathUtils.lerp(0.2, 0.74, dirty);
      actor.bodyMat.clearcoat = THREE.MathUtils.lerp(0.82, 0.12, dirty);
      if (washing) {
        if (!actor.foam) {
          actor.foam = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xe9fbff, transparent: true, opacity: 0.64, depthWrite: false }));
          actor.foam.scale.set(27, 4, 11);
          actor.foam.position.set(0, 18, 0);
          actor.group.add(actor.foam);
        }
        const foaming = washState.stage === 'foam';
        actor.foam.visible = foaming;
        actor.foam.material.opacity = 0.42 + Math.sin(this.washTime * 5) * 0.08;
        actor.foam.scale.x = 24 + progress * 8;
      } else if (actor.foam) actor.foam.visible = false;
    }
    for (const brush of this.washBrushes) brush.rotation.x += 0.045;
    for (const [id, actor] of this.carActors) {
      if (!active.has(id)) {
        this.world.remove(actor.group);
        actor.group.traverse((obj) => {
          obj.geometry?.dispose?.();
          if (obj.material && obj.material !== actor.bodyMat) obj.material.dispose?.();
        });
        actor.bodyMat.dispose();
        this.carActors.delete(id);
      }
    }
  }

  resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this._syncCamera();
  }

  _syncCamera() {
    const cam = this.gameScene.cameras.main;
    const view = cam.worldView;
    const viewW = Math.max(1, view.width || cam.width / cam.zoom);
    const viewH = Math.max(1, view.height || cam.height / cam.zoom);
    const centerX = (Number.isFinite(view.x) ? view.x : cam.scrollX) + viewW / 2;
    const centerZ = (Number.isFinite(view.y) ? view.y : cam.scrollY) + viewH / 2;
    const tilt = 15 * DEG;
    const distance = 1450;
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / Math.cos(tilt) / 2;
    this.camera.bottom = -viewH / Math.cos(tilt) / 2;
    this.camera.position.set(centerX, distance, centerZ + Math.tan(tilt) * distance);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(centerX, 0, centerZ);
    this.camera.updateProjectionMatrix();
  }

  _frame = (now) => {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._frame);
    if (now - this.lastFrame < 1000 / this.maxFps) return;
    this.lastFrame = now;
    this._syncCamera();
    this.renderer.render(this.world, this.camera);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
    this.world.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((entry) => entry.dispose());
      else object.material?.dispose?.();
    });
    this.renderer.dispose();
    this.canvas.remove();
  }
}
