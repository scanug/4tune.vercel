import { ICONS, PALETTE } from '@/components/PixelIcon';
import { GAMES } from '@/lib/games';

// La scena si disegna a bassa risoluzione e il canvas viene ingrandito con
// image-rendering: pixelated, così anche il 3D ha i pixel grossi del 16-bit.
const PIXEL_DESKTOP = 3;
const PIXEL_MOBILE = 2;

// I cabinati stanno su un semicerchio rivolto verso il centro della sala.
const ARC_RADIUS = 5.6;
const ARC_STEP = (30 * Math.PI) / 180;
const CAM_DISTANCE = 6.2;
const FLY_SECONDS = 0.9;

function nearest(THREE, tex) {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function canvasTexture(THREE, w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw?.(ctx);
  const tex = nearest(THREE, new THREE.CanvasTexture(canvas));
  return { tex, ctx };
}

function drawIcon(ctx, name, x, y) {
  ICONS[name].forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '.') continue;
      ctx.fillStyle = PALETTE[row[i]];
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  });
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function buildRoom(THREE, OrbitControls, host, { reducedMotion, onSelect }) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Sala 3D con ${GAMES.length} cabinati arcade, uno per gioco, ognuno con il suo modellino.`);
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0618');
  scene.fog = new THREE.Fog('#0a0618', 11, 24);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
  camera.position.set(0, 4, 7);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2.8;
  controls.maxDistance = 9;
  controls.minPolarAngle = 0.5;
  controls.maxPolarAngle = 1.5;

  // Ombreggiatura a 3 bande, tipo sprite
  const gradientMap = new THREE.DataTexture(new Uint8Array([70, 160, 255]), 3, 1, THREE.RedFormat);
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
  const glow = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

  // ---------- Stanza ----------
  const floorTex = canvasTexture(THREE, 2, 2, (ctx) => {
    ctx.fillStyle = '#1d1145'; ctx.fillRect(0, 0, 2, 2);
    ctx.fillStyle = '#2c1a66'; ctx.fillRect(0, 0, 1, 1); ctx.fillRect(1, 1, 1, 1);
  }).tex;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(22, 22);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), toon('#ffffff', { map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -2;
  scene.add(floor);

  const brickTex = canvasTexture(THREE, 16, 16, (ctx) => {
    ctx.fillStyle = '#1a0f3d'; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#231552';
    ctx.fillRect(0, 0, 7, 7); ctx.fillRect(8, 0, 8, 7);
    ctx.fillRect(4, 8, 7, 7); ctx.fillRect(12, 8, 4, 7); ctx.fillRect(0, 8, 3, 7);
  }).tex;
  brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;
  const wall = (w, h, x, z, ry) => {
    const t = brickTex.clone();
    t.repeat.set(w / 1.4, h / 1.4);
    t.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon('#ffffff', { map: t }));
    m.position.set(x, h / 2, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  wall(22, 8, 0, -9, 0);
  wall(16, 8, -10, -1, Math.PI / 2);
  wall(16, 8, 10, -1, -Math.PI / 2);

  const strip = (w, color, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.07), glow(color));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  strip(22, '#ff4fd8', 0, 0.05, -8.95);
  strip(16, '#ff4fd8', -9.95, 0.05, -1, Math.PI / 2);
  strip(16, '#ff4fd8', 9.95, 0.05, -1, Math.PI / 2);
  strip(22, '#3ee8ff', 0, 6, -8.95);
  strip(16, '#3ee8ff', -9.95, 6, -1, Math.PI / 2);
  strip(16, '#3ee8ff', 9.95, 6, -1, Math.PI / 2);

  // Insegna al neon sulla parete di fondo
  const sign = canvasTexture(THREE, 128, 20);
  const drawSign = () => {
    const { ctx } = sign;
    ctx.clearRect(0, 0, 128, 20);
    const family = getComputedStyle(document.body).fontFamily || 'monospace';
    ctx.font = `10px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#7a1f6a'; ctx.fillText('SALA TROFEI', 65, 12);
    ctx.fillStyle = '#ff4fd8'; ctx.fillText('SALA TROFEI', 64, 11);
    sign.tex.needsUpdate = true;
  };
  drawSign();
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.25), glow('#ffffff', { map: sign.tex, transparent: true }));
  signMesh.position.set(0, 4.6, -8.9);
  scene.add(signMesh);

  // ---------- Cabinati ----------
  const voxel = new THREE.BoxGeometry(1, 1, 1);
  const cabinets = GAMES.map((game, index) => {
    const angle = (index - (GAMES.length - 1) / 2) * ARC_STEP;
    const pos = new THREE.Vector3(Math.sin(angle) * ARC_RADIUS, 0, -Math.cos(angle) * ARC_RADIUS);
    const facing = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));

    const root = new THREE.Group();
    root.position.copy(pos);
    root.rotation.y = -angle;
    root.userData.index = index;
    scene.add(root);

    // Piedistallo con bordo al neon
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.3, 8), toon('#2b2156'));
    pedestal.position.y = 0.15;
    root.add(pedestal);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.08, 8, 1, true), glow(game.accent, { side: THREE.DoubleSide }));
    ring.position.y = 0.27;
    root.add(ring);
    const beamMat = glow(game.accent, { transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.05, 5.5, 8, 1, true), beamMat);
    beam.position.y = 3.0;
    root.add(beam);

    const cab = new THREE.Group();
    cab.position.y = 0.3;
    root.add(cab);
    const box = (w, h, d, mat, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.rotation.x = rx;
      cab.add(m);
      return m;
    };
    const accentMat = toon(game.accent);
    box(0.9, 2.0, 0.85, toon('#241a52'), 0, 1.0, 0);
    box(0.06, 2.1, 0.95, accentMat, -0.48, 1.05, 0);
    box(0.06, 2.1, 0.95, accentMat, 0.48, 1.05, 0);

    // Frontone con il nome del gioco
    const marqueeTex = canvasTexture(THREE, 96, 24);
    const drawMarquee = () => {
      const { ctx } = marqueeTex;
      const g = ctx.createLinearGradient(0, 0, 96, 0);
      g.addColorStop(0, game.accent); g.addColorStop(1, '#6c4dff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 96, 24);
      const family = getComputedStyle(document.body).fontFamily || 'monospace';
      const size = game.short.length > 6 ? 8 : 11;
      ctx.font = `${size}px ${family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#120b2e'; ctx.fillText(game.short, 49, 14);
      ctx.fillStyle = '#ffffff'; ctx.fillText(game.short, 48, 13);
      marqueeTex.tex.needsUpdate = true;
    };
    drawMarquee();
    const side = toon(game.accent);
    const marquee = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.26, 0.3),
      [side, side, side, side, glow('#ffffff', { map: marqueeTex.tex }), side],
    );
    marquee.position.set(0, 1.88, 0.3);
    cab.add(marquee);

    // Schermo con l'icona del gioco
    box(0.84, 0.72, 0.1, toon('#120b2e'), 0, 1.36, 0.42);
    const screenTex = canvasTexture(THREE, 40, 30);
    const drawScreen = (blink) => {
      const { ctx } = screenTex;
      ctx.fillStyle = '#05030d'; ctx.fillRect(0, 0, 40, 30);
      ctx.fillStyle = blink ? game.accent : '#05030d';
      ctx.fillRect(0, 0, 40, 1); ctx.fillRect(0, 29, 40, 1); ctx.fillRect(0, 0, 1, 30); ctx.fillRect(39, 0, 1, 30);
      drawIcon(ctx, game.icon, 12, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let y = 0; y < 30; y += 2) ctx.fillRect(0, y, 40, 1);
      screenTex.tex.needsUpdate = true;
    };
    drawScreen(false);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.54), glow('#ffffff', { map: screenTex.tex }));
    screen.position.set(0, 1.36, 0.476);
    cab.add(screen);

    // Pulsantiera
    box(0.9, 0.12, 0.45, toon('#3a2a80'), 0, 0.92, 0.5, 0.35);
    box(0.04, 0.16, 0.04, toon('#c9c3e6'), -0.22, 1.04, 0.52, 0.35);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toon('#ff3b5c'));
    knob.position.set(-0.22, 1.13, 0.55);
    cab.add(knob);
    ['#3ee8ff', '#ffd23f', '#39ff88'].forEach((c, i) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), glow(c));
      b.position.set(0.06 + i * 0.12, 1.0, 0.52);
      b.rotation.x = 0.35;
      cab.add(b);
    });
    box(0.4, 0.36, 0.02, toon('#120b2e'), 0, 0.42, 0.435);
    box(0.06, 0.1, 0.02, glow(game.accent), -0.08, 0.46, 0.45);
    box(0.06, 0.1, 0.02, glow(game.accent), 0.08, 0.46, 0.45);

    // Modellino voxel: l'icona 16x16 del gioco estrusa in cubetti
    const pixels = [];
    ICONS[game.icon].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.') pixels.push([x, y, PALETTE[row[x]]]);
    });
    const model = new THREE.InstancedMesh(voxel, toon('#ffffff'), pixels.length);
    const S = 0.055;
    const m4 = new THREE.Matrix4();
    const color = new THREE.Color();
    pixels.forEach(([x, y, hex], i) => {
      m4.makeScale(S, S, S * 3);
      m4.setPosition((x - 7.5) * S, (7.5 - y) * S, 0);
      model.setMatrixAt(i, m4);
      model.setColorAt(i, color.set(hex));
    });
    model.position.y = 3.15;
    root.add(model);

    const light = new THREE.PointLight(game.accent, 6, 5, 2);
    light.position.set(0, 2.6, 1.2);
    root.add(light);

    const azimuth = Math.atan2(facing.x, facing.z);

    return { root, beamMat, model, drawScreen, drawMarquee, pos, facing, azimuth };
  });

  // Il font pixel potrebbe arrivare dopo: si ridisegnano le scritte
  document.fonts?.ready?.then(() => { drawSign(); cabinets.forEach((c) => c.drawMarquee()); });

  // ---------- Pulviscolo ----------
  const DUST = 140;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 14;
    dustPos[i * 3 + 1] = Math.random() * 5;
    dustPos[i * 3 + 2] = -Math.random() * 8;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#ffd23f', size: 1, sizeAttenuation: false, transparent: true, opacity: 0.7 })));

  // ---------- Luci ----------
  scene.add(new THREE.HemisphereLight('#9d8cff', '#1a0b33', 1.4));
  const key = new THREE.DirectionalLight('#ffffff', 1.5);
  key.position.set(2, 6, 5);
  scene.add(key);

  // ---------- Selezione e volo della camera ----------
  let selected = -1;
  let fly = null;

  // Inquadratura di un cabinato: su schermi stretti (telefono in verticale)
  // la camera si allontana, così cabinato e modellino restano interi.
  const poseFor = (c) => {
    const dist = CAM_DISTANCE * Math.max(1, Math.sqrt(0.9 / camera.aspect));
    return {
      target: c.pos.clone().add(new THREE.Vector3(0, 1.3, 0)),
      eye: c.pos.clone().addScaledVector(c.facing, dist).add(new THREE.Vector3(0, 2.4, 0)),
    };
  };

  const lockAzimuth = (c) => {
    controls.minAzimuthAngle = c.azimuth - 0.9;
    controls.maxAzimuthAngle = c.azimuth + 0.9;
  };

  const select = (index, instant = false) => {
    const c = cabinets[index];
    if (!c || index === selected) return;
    selected = index;
    if (instant || reducedMotion) {
      const pose = poseFor(c);
      camera.position.copy(pose.eye);
      controls.target.copy(pose.target);
      lockAzimuth(c);
      controls.update();
      fly = null;
      return;
    }
    controls.enabled = false;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    fly = { t: 0, fromEye: camera.position.clone(), fromTarget: controls.target.clone(), cab: c, ...poseFor(c) };
  };

  // Un tocco (non un trascinamento) su un cabinato lo seleziona
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt = null;
  const onDown = (e) => { downAt = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(cabinets.map((c) => c.root), true)[0];
    let obj = hit?.object;
    while (obj && obj.userData.index === undefined) obj = obj.parent;
    if (obj) onSelect?.(obj.userData.index);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  // ---------- Dimensioni ----------
  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    const px = w < 600 ? PIXEL_MOBILE : PIXEL_DESKTOP;
    renderer.setSize(Math.ceil(w / px), Math.ceil(h / px), false);
    const changed = Math.abs(camera.aspect - w / h) > 0.05;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Se lo schermo cambia forma (es. telefono ruotato) si reinquadra il cabinato
    if (changed && selected >= 0 && !fly) {
      const i = selected;
      selected = -1;
      select(i, true);
    }
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  let blinkTimer = 0;
  let blink = false;
  let frame = 0;
  const animate = () => {
    frame = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    if (fly) {
      fly.t = Math.min(1, fly.t + dt / FLY_SECONDS);
      const k = ease(fly.t);
      camera.position.lerpVectors(fly.fromEye, fly.eye, k);
      controls.target.lerpVectors(fly.fromTarget, fly.target, k);
      camera.lookAt(controls.target);
      if (fly.t >= 1) {
        lockAzimuth(fly.cab);
        controls.enabled = true;
        fly = null;
      }
    } else {
      controls.update();
    }

    cabinets.forEach((c, i) => {
      const on = i === selected;
      c.beamMat.opacity = on ? 0.09 : 0.035;
      if (!reducedMotion) {
        c.model.rotation.y += dt * (on ? 1.2 : 0.4);
        c.model.position.y = 3.15 + (on ? Math.round(Math.sin(t * 2) * 6) / 100 : 0);
      }
    });

    blinkTimer += dt;
    if (blinkTimer > 0.4) {
      blinkTimer = 0;
      blink = !blink;
      cabinets.forEach((c, i) => c.drawScreen(i === selected && blink));
    }

    if (!reducedMotion) {
      const p = dustGeo.attributes.position;
      for (let i = 0; i < DUST; i++) {
        let y = p.getY(i) + dt * 0.2;
        if (y > 5) y = 0.2;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }

    renderer.render(scene, camera);
  };
  animate();

  return {
    select,
    dispose() {
      cancelAnimationFrame(frame);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      controls.dispose();
      scene.traverse((obj) => {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
      gradientMap.dispose();
      brickTex.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
