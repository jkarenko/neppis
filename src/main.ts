import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initPhysics } from './physics.ts';
import { Track, TRACKS } from './track.ts';
import { Game, type Player } from './game.ts';
import { FlickIndicator } from './indicator.ts';
import { TurnCue } from './cue.ts';
import { FlickInput } from './input.ts';
import { Hud } from './hud.ts';
import { DEFAULT_RULES, MAX_STEPS_PER_FRAME, PHYS_DT } from './config.ts';

async function main(): Promise<void> {
  const world = await initPhysics();

  const app = document.getElementById('app')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe3f2);
  scene.fog = new THREE.Fog(0xcfe3f2, 45, 110);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 24, 30);

  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x8f7a58, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(18, 32, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -36;
  sun.shadow.camera.right = 36;
  sun.shadow.camera.top = 36;
  sun.shadow.camera.bottom = -36;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const track = new Track(TRACKS[0]);
  scene.add(track.createMesh());
  track.createCollider(world);

  const indicator = new FlickIndicator();
  scene.add(indicator.group);
  const cue = new TurnCue();
  scene.add(cue.group);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 2.5;
  controls.maxDistance = 45;
  controls.maxPolarAngle = 1.45;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.target.set(0, 0, 0);

  const hud = new Hud();
  const rules = { ...DEFAULT_RULES };
  const timer = new THREE.Timer();

  let camAnim: { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; t: number } | null = null;

  function frameCar(p: Player): void {
    const pos = p.car.position;
    const q = track.query(pos.x, pos.z);
    const tg = track.tangentAt(q.index);
    const toTarget = pos.clone();
    const toPos = pos.clone().addScaledVector(tg, -6.5).add(new THREE.Vector3(0, 4.2, 0));
    camAnim = { fromPos: camera.position.clone(), toPos, fromTarget: controls.target.clone(), toTarget, t: 0 };
  }

  // The ring under the car marks a human player's turn for as long as it lasts. The finger drag is shown on each
  // human's first turn of a race, once the camera has settled on the car, until they start dragging.
  const tutored = new Set<number>();
  let fingerAt: number | null = null; // elapsed time at which the finger should appear
  function endFinger(): void {
    fingerAt = null;
    hud.showFinger(null);
  }
  function endCue(): void {
    cue.hide();
    endFinger();
  }

  const game = new Game(world, track, scene, rules, {
    message: (text, ms) => hud.say(text, ms),
    turnStart: (p) => {
      frameCar(p);
      endCue();
      if (p.ai) return;
      cue.show(p.color);
      if (!tutored.has(p.id)) {
        tutored.add(p.id);
        fingerAt = timer.getElapsed() + 1.1; // the camera glide takes 0.7 s
      }
    },
    flick: () => {
      camAnim = null;
      endFinger();
    },
    changed: () => hud.render(game),
    raceOver: (placings) => {
      hud.showResults(placings, () => hud.showSetup(startRace));
    },
  });

  function startRace(setups: { name: string; ai: boolean }[], laps: number): void {
    rules.laps = laps;
    tutored.clear();
    endCue();
    game.start(setups);
  }

  new FlickInput(renderer.domElement, camera, {
    target: () => (game.currentIsHuman ? game.current!.car.position : null),
    onAim: (aim) => {
      if (!aim || !game.current) {
        indicator.hide();
        hud.showPower(null);
        return;
      }
      endFinger();
      // Turning the nose before a flick is allowed, so the car simply faces where you aim.
      game.rotateCurrent(Math.atan2(-aim.dir.z, aim.dir.x));
      indicator.show(game.current.car.position, aim.dir, aim.current, aim.power, aim.valid);
      hud.showPower(aim.valid ? aim.power : null);
    },
    onFlick: (dir, power) => {
      indicator.hide();
      hud.showPower(null);
      game.flick(dir, power);
    },
  });

  document.getElementById('newRace')!.addEventListener('click', () => {
    game.clear();
    indicator.hide();
    endCue();
    hud.render(game);
    hud.showSetup(startRace);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  hud.showPower(null);
  hud.showSetup(startRace);

  // Frame statistics overlay: add ?stats to the URL.
  const stats = new URLSearchParams(location.search).has('stats') ? document.createElement('div') : null;
  if (stats) {
    stats.id = 'stats';
    stats.style.cssText = 'position:fixed;left:12px;bottom:12px;font:12px monospace;background:rgba(0,0,0,.6);color:#fff;padding:6px 8px;border-radius:6px;white-space:pre;z-index:5';
    document.body.appendChild(stats);
  }
  const acc = { frames: 0, physMs: 0, renderMs: 0, steps: 0, time: 0 };

  let accumulator = 0;
  renderer.setAnimationLoop(() => {
    timer.update();
    const frameDt = Math.min(timer.getDelta(), 0.1);
    accumulator = Math.min(accumulator + frameDt, MAX_STEPS_PER_FRAME * PHYS_DT);
    const tPhys = performance.now();
    while (accumulator >= PHYS_DT) {
      world.step();
      game.afterStep(PHYS_DT);
      accumulator -= PHYS_DT;
      acc.steps++;
    }
    for (const p of game.players) p.car.sync();
    const tRender = performance.now();
    acc.physMs += tRender - tPhys;

    if (camAnim) {
      camAnim.t = Math.min(1, camAnim.t + frameDt / 0.7);
      const k = camAnim.t * camAnim.t * (3 - 2 * camAnim.t);
      camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
      controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, k);
      if (camAnim.t >= 1) camAnim = null;
    } else if (game.current && game.phase !== 'finished') {
      const pos = game.current.car.position;
      const delta = pos.clone().sub(controls.target);
      controls.target.copy(pos);
      camera.position.add(delta);
    }
    controls.update();

    indicator.update(timer.getElapsed());
    if (cue.visible && game.current) {
      const pos = game.current.car.position;
      cue.update(pos, timer.getElapsed());
      if (fingerAt !== null && timer.getElapsed() >= fingerAt) {
        const projected = pos.clone().project(camera);
        hud.showFinger({ x: ((projected.x + 1) / 2) * window.innerWidth, y: ((1 - projected.y) / 2) * window.innerHeight });
      }
    }
    renderer.render(scene, camera);
    if (stats) {
      acc.renderMs += performance.now() - tRender;
      acc.frames++;
      acc.time += frameDt;
      if (acc.time >= 0.5) {
        const f = acc.frames;
        stats.textContent =
          `${(f / acc.time).toFixed(0)} fps\nphysics ${(acc.physMs / f).toFixed(2)} ms/frame (${(acc.steps / f).toFixed(1)} steps)\n` +
          `render ${(acc.renderMs / f).toFixed(2)} ms/frame (js side)\nframe ${((acc.time * 1000) / f).toFixed(1)} ms\n` +
          `phase ${game.phase}${game.current ? ' ' + game.current.name : ''}`;
        acc.frames = 0;
        acc.physMs = 0;
        acc.renderMs = 0;
        acc.steps = 0;
        acc.time = 0;
      }
    }
  });
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById('message');
  if (el) {
    el.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`;
    el.classList.add('show');
  }
});
