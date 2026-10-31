import * as THREE from 'three';

const WORLD = { width: 900, height: 820 };

function material(color, roughness = 0.72, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export class ThreeWashEnvironment {
  constructor(scene) {
    this.gameScene = scene;
    this.host = document.getElementById('game-shell');
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.0 : 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.world = new THREE.Scene();
    this.world.fog = new THREE.Fog(0x101a25, 1050, 1900);
    this.camera = new THREE.OrthographicCamera(-450, 450, 410, -410, 0.1, 2400);
    this.camera.up.set(0, 1, 0);
    this.camera.position.set(450, 410, 1450);
    this.camera.lookAt(450, 410, 0);

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
    const hemi = new THREE.HemisphereLight(0xc6e6ff, 0x18202a, 2.05);
    this.world.add(hemi);
    const key = new THREE.DirectionalLight(0xffe3c2, 3.1);
    key.position.set(-280, 760, 980);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -600;
    key.shadow.camera.right = 600;
    key.shadow.camera.top = 700;
    key.shadow.camera.bottom = -700;
    key.shadow.bias = -0.00025;
    this.world.add(key);
    const cyan = new THREE.PointLight(0x36cfff, 48, 470, 2);
    cyan.position.set(300, 505, 180);
    this.world.add(cyan);
    const pink = new THREE.PointLight(0xff4f91, 24, 360, 2);
    pink.position.set(610, 505, 130);
    this.world.add(pink);
    const warm = new THREE.PointLight(0xffb36b, 28, 360, 2);
    warm.position.set(450, 720, 150);
    this.world.add(warm);
  }

  _mesh(geometry, mat, x, y, z, opts = {}) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = opts.receiveShadow !== false;
    this.world.add(mesh);
    return mesh;
  }

  _box(x, y, z, w, d, h, color, roughness = 0.7, metalness = 0.05, opts = {}) {
    return this._mesh(new THREE.BoxGeometry(w, d, h), material(color, roughness, metalness), x, y, z + h / 2, opts);
  }

  _buildGround() {
    const ground = this._mesh(
      new THREE.PlaneGeometry(WORLD.width + 260, WORLD.height + 260),
      new THREE.MeshStandardMaterial({ color: 0x303b46, roughness: 0.32, metalness: 0.16 }),
      450, 410, -7,
      { castShadow: false }
    );
    ground.receiveShadow = true;

    const concrete = material(0x56616b, 0.48, 0.08);
    for (let i = 0; i < 18; i++) {
      const x = 45 + i * 48;
      const stripe = this._mesh(new THREE.BoxGeometry(27, 1.6, 0.7), material(i % 3 ? 0x71808b : 0x9bb8c7, 0.42, 0.2), x, 310, -5.7, { castShadow: false });
      stripe.rotation.z = (i % 2 ? 0.04 : -0.04);
    }

    // Drain channels and individual metal grates.
    for (const bx of [300, 600]) {
      this._box(bx, 425, -5.4, 224, 8, 1.4, 0x111b25, 0.45, 0.6, { castShadow: false });
      for (let i = 0; i < 22; i++) this._box(bx - 105 + i * 10, 425, -3.8, 2, 6, 0.6, 0x9aabb8, 0.3, 0.82, { castShadow: false });
      const puddle = this._mesh(new THREE.CircleGeometry(48 + (bx % 3) * 4, 40), new THREE.MeshPhysicalMaterial({
        color: 0x57c9e9, roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.16,
        clearcoat: 1, clearcoatRoughness: 0.08,
      }), bx + 28, 365, -5.6, { castShadow: false });
      puddle.scale.set(1.7, 0.38, 1);
    }

    // Raised curb around the property.
    this._box(450, 96, -2, 820, 12, 7, 0x687985, 0.82, 0.08);
    this._box(450, 84, -5, 820, 5, 2, 0xd1dbe1, 0.65, 0.08);
    this._box(450, 598, -2, 820, 8, 7, 0x64727d, 0.8, 0.08);
  }

  _buildMainBuilding() {
    // Modern glass-front office, layered facade and a cantilevered canopy.
    this._box(450, 690, 0, 590, 126, 104, 0x172533, 0.62, 0.28);
    this._box(450, 688, 105, 604, 12, 8, 0x0c1722, 0.32, 0.45);
    this._box(450, 683, 113, 612, 8, 2.5, 0x35c9f3, 0.25, 0.55, { castShadow: false });
    this._box(450, 624, 12, 500, 5, 75, 0x101d2b, 0.2, 0.35);
    for (let i = 0; i < 8; i++) {
      const x = 220 + i * 65;
      this._box(x, 624, 13, 3.2, 4, 73, 0x91d9ed, 0.16, 0.6, { castShadow: false });
    }
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x5ca2ba, roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.62, clearcoat: 1 });
    this._mesh(new THREE.BoxGeometry(490, 3, 68), glass, 450, 624, 51, { castShadow: false });
    this._box(450, 616, 0, 610, 16, 8, 0x263b4c, 0.48, 0.35);
    this._box(450, 609, 8, 580, 2, 2, 0xffb56e, 0.25, 0.35, { castShadow: false });
    this._box(450, 751, 0, 625, 24, 10, 0x263747, 0.55, 0.25);
    this._box(450, 751, 10, 590, 4, 2, 0x42d7f1, 0.24, 0.5, { castShadow: false });

    // Roof vents.
    for (const x of [250, 650]) {
      this._box(x, 740, 12, 56, 34, 22, 0x455766, 0.72, 0.3);
      for (let i = 0; i < 5; i++) this._box(x - 20 + i * 10, 721, 34, 2, 1.5, 12, 0x17232e, 0.7, 0.3);
    }
    this._box(450, 754, 18, 250, 5, 28, 0x0c1520, 0.45, 0.3);
    this._box(450, 750, 47, 235, 2, 2, 0xffb36b, 0.2, 0.4, { castShadow: false });
  }

  _buildWashBays() {
    for (const [index, x] of [300, 600].entries()) {
      const baseY = 510;
      // Concrete pad, raised steel edge and dark service floor.
      this._box(x, baseY, -1, 286, 190, 12, 0x1d2b37, 0.58, 0.22);
      this._box(x, baseY, 11, 276, 180, 2, 0x465763, 0.38, 0.32);
      this._box(x, baseY, 13, 258, 162, 1.2, 0x15232e, 0.24, 0.38, { castShadow: false });
      // Rear wall and glass side screens.
      this._box(x, baseY + 79, 15, 254, 5, 112, 0x223747, 0.42, 0.35);
      const screen = new THREE.MeshPhysicalMaterial({ color: index ? 0x5ca9bd : 0x75c9d7, roughness: 0.18, metalness: 0.22, transparent: true, opacity: 0.24, clearcoat: 1 });
      this._mesh(new THREE.BoxGeometry(5, 150, 92), screen, x - 128, baseY - 2, 65, { castShadow: false });
      this._mesh(new THREE.BoxGeometry(5, 150, 92), screen, x + 128, baseY - 2, 65, { castShadow: false });
      // Structural columns and overhead gantry.
      for (const side of [-1, 1]) {
        this._box(x + side * 120, baseY - 4, 14, 13, 13, 136, 0x8296a3, 0.32, 0.72);
        this._box(x + side * 120, baseY - 4, 151, 17, 17, 8, 0x152432, 0.42, 0.42);
        this._box(x + side * 120, baseY - 4, 159, 18, 18, 2, 0x43d7f0, 0.22, 0.55, { castShadow: false });
      }
      this._box(x, baseY + 4, 150, 254, 18, 12, 0x263a4b, 0.34, 0.65);
      this._box(x, baseY + 4, 157, 238, 3, 2, 0x40d9f1, 0.2, 0.5, { castShadow: false });
      // Industrial side brush drums.
      for (const side of [-1, 1]) {
        const drum = this._mesh(new THREE.CylinderGeometry(13, 13, 82, 20), material(0x35a7c9, 0.48, 0.32), x + side * 91, baseY - 10, 65);
        drum.rotation.x = Math.PI / 2;
        this._mesh(new THREE.TorusGeometry(13, 2.2, 8, 24), material(0xc4e8f0, 0.28, 0.72), x + side * 91, baseY - 10, 65);
      }
      // Ceiling spray rail, individual nozzles and LED strips.
      this._box(x, baseY - 3, 139, 176, 8, 5, 0x344c5d, 0.36, 0.65);
      for (let i = 0; i < 11; i++) {
        const nozzle = this._mesh(new THREE.CylinderGeometry(1.6, 2.4, 10, 8), material(0x9cecff, 0.26, 0.7), x - 76 + i * 15, baseY - 3, 130);
        nozzle.rotation.x = Math.PI / 2;
      }
      // Wet polished concrete catches the colored light.
      this._box(x, baseY - 54, 14, 208, 1.5, 0.8, 0x4ac6e5, 0.18, 0.38, { castShadow: false });
    }
  }

  _buildRivalLocation() {
    // A real opposing three-bay branch beyond the street, kept visible as the story evolves.
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
      const lamp = this._mesh(new THREE.SphereGeometry(9, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffe7b5, emissive: 0xffbd72, emissiveIntensity: 2.2 }), x, 355, 112, { castShadow: false });
      const glow = new THREE.PointLight(0xffcf8a, 18, 180, 2);
      glow.position.set(x, 355, 110);
      this.world.add(glow);
    }
    // Planters and sculpted shrubs.
    for (const x of [170, 730]) {
      this._box(x, 300, -1, 48, 48, 22, 0x3d4a55, 0.82, 0.05);
      this._mesh(new THREE.SphereGeometry(27, 18, 14), material(0x2e9667, 0.9), x, 300, 39);
      this._mesh(new THREE.SphereGeometry(18, 16, 12), material(0x3bb77b, 0.88), x - 12, 310, 48);
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
    // Phaser worldView is already expressed in unzoomed world coordinates.
    // Match its center exactly; only invert Y because the Three.js camera uses Y-up.
    const centerX = (Number.isFinite(view.x) ? view.x : cam.scrollX) + viewW / 2;
    const centerY = WORLD.height - ((Number.isFinite(view.y) ? view.y : cam.scrollY) + viewH / 2);
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.position.set(centerX, centerY, 1450);
    this.camera.lookAt(centerX, centerY, 0);
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
