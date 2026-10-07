import { ICONS, PALETTE } from '@/components/PixelIcon';
import { GAMES } from '@/lib/games';

// La scena si disegna a bassa risoluzione e il canvas viene ingrandito con
// image-rendering: pixelated, così anche il 3D ha i pixel grossi del 16-bit.
const PIXEL_DESKTOP = 3;
const PIXEL_MOBILE = 2;

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
  draw(ctx);
  const tex = nearest(THREE, new THREE.CanvasTexture(canvas));
  return { tex, ctx, canvas };
}

function drawIcon(ctx, name, x, y, scale) {
  ICONS[name].forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '.') continue;
      ctx.fillStyle = PALETTE[c];
      ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
    }
  });
}

export function buildRoom(THREE, OrbitControls, host, { reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Sala 3D con il cabinato di 4Tune su un piedistallo e le icone dei giochi alla parete. Trascina o usa le frecce per girarci intorno.');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0618');
  scene.fog = new THREE.Fog('#0a0618', 10, 22);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
  camera.position.set(1.4, 2.2, 5.8);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.3, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 8.5;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.5;
  controls.update();

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
  floorTex.repeat.set(14, 14);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), toon('#ffffff', { map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const brickTex = canvasTexture(THREE, 16, 16, (ctx) => {
    ctx.fillStyle = '#1a0f3d'; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#231552';
    ctx.fillRect(0, 0, 7, 7); ctx.fillRect(8, 0, 8, 7);
    ctx.fillRect(4, 8, 7, 7); ctx.fillRect(12, 8, 4, 7); ctx.fillRect(0, 8, 3, 7);
  }).tex;
  brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;

  const wallMat = (rx, ry) => {
    const t = brickTex.clone();
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    return toon('#ffffff', { map: t });
  };
  const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), wallMat(10, 5));
  back.position.set(0, 3.5, -5);
  scene.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), wallMat(9, 5));
  left.position.set(-6, 3.5, 1);
  left.rotation.y = Math.PI / 2;
  scene.add(left);
  const right = left.clone();
  right.material = wallMat(9, 5);
  right.position.x = 6;
  right.rotation.y = -Math.PI / 2;
  scene.add(right);

  // Strisce al neon lungo pareti e soffitto
  const strip = (w, color, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.06), glow(color));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  strip(14, '#ff4fd8', 0, 0.05, -4.95);
  strip(12, '#ff4fd8', -5.95, 0.05, 1, Math.PI / 2);
  strip(12, '#ff4fd8', 5.95, 0.05, 1, Math.PI / 2);
  strip(14, '#3ee8ff', 0, 5.2, -4.95);
  strip(12, '#3ee8ff', -5.95, 5.2, 1, Math.PI / 2);
  strip(12, '#3ee8ff', 5.95, 5.2, 1, Math.PI / 2);

  // Le icone dei giochi appese alla parete di fondo
  GAMES.forEach((game, i) => {
    const x = (i - (GAMES.length - 1) / 2) * 1.8;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.06), glow(game.accent));
    frame.position.set(x, 3.7, -4.96);
    scene.add(frame);
    const { tex } = canvasTexture(THREE, 20, 20, (ctx) => {
      ctx.fillStyle = '#120b2e'; ctx.fillRect(0, 0, 20, 20);
      drawIcon(ctx, game.icon, 2, 2, 1);
    });
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glow('#ffffff', { map: tex }));
    art.position.set(x, 3.7, -4.92);
    scene.add(art);
  });

  // ---------- Piedistallo ----------
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.3, 8), toon('#2b2156'));
  pedestal.position.y = 0.15;
  scene.add(pedestal);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.27, 1.27, 0.08, 8, 1, true), glow('#3ee8ff', { side: THREE.DoubleSide }));
  ring.position.y = 0.27;
  scene.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 1.3, 5, 8, 1, true),
    glow('#ffd23f', { transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.position.y = 2.8;
  scene.add(beam);

  // ---------- Cabinato (modellino segnaposto) ----------
  const cabinet = new THREE.Group();
  cabinet.position.y = 0.3;
  scene.add(cabinet);

  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    cabinet.add(m);
    return m;
  };

  box(0.9, 2.0, 0.85, toon('#241a52'), 0, 1.0, 0);
  box(0.06, 2.1, 0.95, toon('#6c4dff'), -0.48, 1.05, 0);
  box(0.06, 2.1, 0.95, toon('#6c4dff'), 0.48, 1.05, 0);

  const marqueeTex = canvasTexture(THREE, 96, 24, () => {});
  const drawMarquee = () => {
    const { ctx } = marqueeTex;
    const g = ctx.createLinearGradient(0, 0, 96, 0);
    g.addColorStop(0, '#ff4fd8'); g.addColorStop(1, '#6c4dff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 96, 24);
    const family = getComputedStyle(document.body).fontFamily || 'monospace';
    ctx.font = `12px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#120b2e'; ctx.fillText('4TUNE', 49, 14);
    ctx.fillStyle = '#ffffff'; ctx.fillText('4TUNE', 48, 13);
    marqueeTex.tex.needsUpdate = true;
  };
  drawMarquee();
  document.fonts?.ready?.then(drawMarquee);
  const side = toon('#ff4fd8');
  const marquee = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.26, 0.3),
    [side, side, side, side, glow('#ffffff', { map: marqueeTex.tex }), side],
  );
  marquee.position.set(0, 1.88, 0.3);
  cabinet.add(marquee);

  box(0.84, 0.72, 0.1, toon('#120b2e'), 0, 1.36, 0.42);
  const screenTex = canvasTexture(THREE, 40, 30, () => {});
  let screenIndex = 0;
  let screenBlink = false;
  const drawScreen = () => {
    const { ctx } = screenTex;
    const game = GAMES[screenIndex % GAMES.length];
    ctx.fillStyle = '#05030d'; ctx.fillRect(0, 0, 40, 30);
    ctx.fillStyle = screenBlink ? game.accent : '#05030d';
    ctx.fillRect(0, 0, 40, 1); ctx.fillRect(0, 29, 40, 1); ctx.fillRect(0, 0, 1, 30); ctx.fillRect(39, 0, 1, 30);
    drawIcon(ctx, game.icon, 12, 6, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < 30; y += 2) ctx.fillRect(0, y, 40, 1);
    screenTex.tex.needsUpdate = true;
  };
  drawScreen();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.54), glow('#ffffff', { map: screenTex.tex }));
  screen.position.set(0, 1.36, 0.476);
  cabinet.add(screen);

  const panel = box(0.9, 0.12, 0.45, toon('#ff4fd8'), 0, 0.92, 0.5);
  panel.rotation.x = 0.35;
  const stick = box(0.04, 0.16, 0.04, toon('#c9c3e6'), -0.22, 1.04, 0.52);
  stick.rotation.x = 0.35;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toon('#ff3b5c'));
  knob.position.set(-0.22, 1.13, 0.55);
  cabinet.add(knob);
  ['#3ee8ff', '#ffd23f', '#39ff88'].forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), glow(c));
    b.position.set(0.06 + i * 0.12, 1.0, 0.52);
    b.rotation.x = 0.35;
    cabinet.add(b);
  });
  box(0.4, 0.36, 0.02, toon('#120b2e'), 0, 0.42, 0.435);
  box(0.06, 0.1, 0.02, glow('#ff3b5c'), -0.08, 0.46, 0.45);
  box(0.06, 0.1, 0.02, glow('#ff3b5c'), 0.08, 0.46, 0.45);

  // ---------- Pulviscolo nella luce ----------
  const DUST = 90;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.4 + Math.random() * 1.6;
    dustPos[i * 3] = Math.cos(a) * r;
    dustPos[i * 3 + 1] = Math.random() * 4.5;
    dustPos[i * 3 + 2] = Math.sin(a) * r;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#ffd23f', size: 1, sizeAttenuation: false, transparent: true, opacity: 0.8 }));
  scene.add(dust);

  // ---------- Luci ----------
  scene.add(new THREE.HemisphereLight('#9d8cff', '#1a0b33', 1.4));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(2, 5, 4);
  scene.add(key);
  const pink = new THREE.PointLight('#ff4fd8', 30, 12, 2);
  pink.position.set(-3, 2.5, 2);
  scene.add(pink);
  const cyan = new THREE.PointLight('#3ee8ff', 24, 12, 2);
  cyan.position.set(3, 2.5, 1.5);
  scene.add(cyan);

  // ---------- Dimensioni ----------
  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    const px = w < 600 ? PIXEL_MOBILE : PIXEL_DESKTOP;
    renderer.setSize(Math.ceil(w / px), Math.ceil(h / px), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // Il modellino gira da solo, ma si ferma un attimo quando lo muovi tu
  let autoPausedUntil = 0;
  const pauseAuto = () => { autoPausedUntil = performance.now() + 4000; };
  controls.addEventListener('start', pauseAuto);

  // ---------- Tastiera: frecce per girare e zoomare ----------
  const up = new THREE.Vector3(0, 1, 0);
  const onKey = (e) => {
    const offset = camera.position.clone().sub(controls.target);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      offset.applyAxisAngle(up, e.key === 'ArrowLeft' ? -0.15 : 0.15);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const len = THREE.MathUtils.clamp(offset.length() * (e.key === 'ArrowUp' ? 0.9 : 1.1), controls.minDistance, controls.maxDistance);
      offset.setLength(len);
    } else {
      return;
    }
    e.preventDefault();
    camera.position.copy(controls.target).add(offset);
    controls.update();
    pauseAuto();
  };
  canvas.addEventListener('keydown', onKey);

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  let screenTimer = 0;
  let blinkTimer = 0;
  let frame = 0;
  const animate = () => {
    frame = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    if (!reducedMotion) {
      if (performance.now() > autoPausedUntil) cabinet.rotation.y += dt * 0.35;
      cabinet.position.y = 0.3 + Math.round(Math.sin(t * 1.6) * 4) / 100;
      ring.material.color.setHSL(0.5 + Math.sin(t * 0.8) * 0.05, 1, 0.62);
      const p = dustGeo.attributes.position;
      for (let i = 0; i < DUST; i++) {
        let y = p.getY(i) + dt * 0.25;
        if (y > 4.5) y = 0.3;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }

    screenTimer += dt;
    blinkTimer += dt;
    if (blinkTimer > 0.4) { blinkTimer = 0; screenBlink = !screenBlink; drawScreen(); }
    if (screenTimer > 1.8) { screenTimer = 0; screenIndex++; drawScreen(); }

    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  return () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
    canvas.removeEventListener('keydown', onKey);
    controls.removeEventListener('start', pauseAuto);
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
  };
}
