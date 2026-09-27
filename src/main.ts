import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initPhysics } from './physics.ts';
import { Track, TRACKS } from './track.ts';
import { TRACK_BY_NAME } from './tracks/index.ts';
import { Game, type Player, type PlayerSetup } from './game.ts';
import { scenarioFromUrl, PRESETS, type CameraMode, type GameState, type NeppisDebug, type Scenario } from './scenario.ts';
import { renderKit } from './kit.ts';
import { FlickIndicator } from './indicator.ts';
import { TurnCue } from './cue.ts';
import { FlickInput } from './input.ts';
import { Hud } from './hud.ts';
import { DEFAULT_RULES, MAX_STEPS_PER_FRAME, PHYS_DT } from './config.ts';

async function main(): Promise<void> {
  // The kit page (?kit) shows every component over a live scene: the straight scenario, HUD hidden.
  const kit = new URLSearchParams(location.search).has('kit');
  const scenario: Scenario | null = kit
    ? { name: 'kit', track: 'test', players: PRESETS.straight.players!, seed: 1, cam: 'chase', laps: 1 }
    : scenarioFromUrl();
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

  const trackDef = scenario ? TRACK_BY_NAME[scenario.track] : TRACKS[0];
  if (!trackDef) throw new Error(`unknown track ${JSON.stringify(scenario?.track)}: ${Object.keys(TRACK_BY_NAME).join(', ')}`);
  const track = new Track(trackDef);
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
  // A scenario runs turns in setup order so the human under test always flicks first.
  const rules = { ...DEFAULT_RULES, ...(scenario ? { orderByPosition: false } : {}) };
  const timer = new THREE.Timer();

  let camAnim: { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; t: number } | null = null;

  function cameraPose(p: Player, mode: CameraMode): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const pos = p.car.position;
    const q = track.query(pos.x, pos.z);
    const tg = track.tangentAt(q.index);
    const target = pos.clone();
    if (mode === 'top') return { pos: pos.clone().add(new THREE.Vector3(0, 14, 0.01)), target };
    if (mode === 'side') return { pos: pos.clone().add(new THREE.Vector3(-tg.z, 0, tg.x).multiplyScalar(7)).add(new THREE.Vector3(0, 3, 0)), target };
    return { pos: pos.clone().addScaledVector(tg, -6.5).add(new THREE.Vector3(0, 4.2, 0)), target };
  }

  function frameCar(p: Player): void {
    const { pos, target } = cameraPose(p, scenario?.cam ?? 'chase');
    if (scenario) {
      // No glide in a scenario: the shot is ready as soon as the page is.
      camAnim = null;
      camera.position.copy(pos);
      controls.target.copy(target);
      return;
    }
    camAnim = { fromPos: camera.position.clone(), toPos: pos, fromTarget: controls.target.clone(), toTarget: target, t: 0 };
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

  /** The ring under the car marks "your flick, drag from here": only while a human may aim and is not yet dragging. */
  function showCue(): void {
    if (game.currentIsHuman) cue.show(game.current!.color);
    else cue.hide();
  }

  const game = new Game(world, track, scene, rules, {
    message: (text, ms) => hud.say(text, ms),
    turnStart: (p) => {
      frameCar(p);
      endCue();
      if (p.ai) return;
      cue.show(p.color);
      if (!scenario && !tutored.has(p.id)) {
        tutored.add(p.id);
        fingerAt = timer.getElapsed() + 1.1; // the camera glide takes 0.7 s
      }
    },
    flick: () => {
      camAnim = null;
      endCue();
    },
    changed: () => {
      hud.render(game);
      // Back in the aim phase after a flick resolved: the ring returns until the next drag starts.
      if (game.phase === 'aim' && !cue.visible) showCue();
    },
    raceOver: (placings) => {
      hud.showResults(placings, () => hud.showSetup(startRace));
    },
  }, scenario?.seed);

  function startRace(setups: PlayerSetup[], laps: number): void {
    rules.laps = laps;
    tutored.clear();
    endCue();
    game.start(setups);
  }

  new FlickInput(renderer.domElement, camera, {
    target: () => (game.currentIsHuman ? game.current!.car.position : null),
    onAim: (aim) => {
      if (!aim || !game.current) {
        game.cancelAim();
        indicator.hide();
        showCue();
        return;
      }
      endFinger();
      cue.hide();
      // The nose turns towards the aim as far as the turn wedge allows; the ribbon shows the line the car will
      // actually take, drawn from where the finger would be on that line.
      const yaw = game.rotateCurrent(Math.atan2(-aim.dir.z, aim.dir.x));
      if (yaw === null) return;
      const dir = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      const pos = game.current.car.position;
      const reach = Math.hypot(aim.current.x - pos.x, aim.current.z - pos.z);
      const from = pos.clone().sub(new THREE.Vector3(dir.x, 0, dir.z).multiplyScalar(reach));
      indicator.show(pos, dir, from, aim.power, aim.valid);
    },
    onFlick: (dir, power) => {
      indicator.hide();
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

  if (scenario) {
    hud.hideSetup();
    startRace(scenario.players, scenario.laps);
    (window as unknown as { __neppis: NeppisDebug }).__neppis = debugHandle();
    if (kit) {
      document.documentElement.classList.add('kit');
      document.getElementById('hud')!.hidden = true;
      renderKit(document.getElementById('kit')!);
    }
  } else {
    hud.showSetup(startRace);
  }

  // Frame statistics overlay: add ?stats to the URL.
  const stats = new URLSearchParams(location.search).has('stats') ? document.createElement('div') : null;
  if (stats) {
    stats.id = 'stats';
    stats.style.cssText = 'position:fixed;left:12px;bottom:12px;font:12px monospace;background:rgba(0,0,0,.6);color:#fff;padding:6px 8px;border-radius:6px;white-space:pre;z-index:5';
    document.body.appendChild(stats);
  }
  const acc = { frames: 0, physMs: 0, renderMs: 0, steps: 0, time: 0 };

  function stepPhysics(): void {
    world.step();
    game.afterStep(PHYS_DT);
    acc.steps++;
  }

  /** window.__neppis in scenario mode: read the game state and drive it synchronously from a test. */
  function debugHandle(): NeppisDebug {
    const deg = (r: number) => (r * 180) / Math.PI;
    const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
    const tangentYaw = (x: number, z: number) => {
      const tg = track.tangentAt(track.query(x, z).index);
      return Math.atan2(-tg.z, tg.x);
    };
    const state = (): GameState => ({
      phase: game.phase,
      round: game.round,
      current: game.current?.name ?? null,
      flicksLeft: game.flicksLeft,
      lastOutcome: game.lastOutcome,
      cars: game.players.map((p) => {
        const pos = p.car.position;
        const q = track.query(pos.x, pos.z);
        return {
          name: p.name,
          ai: p.ai,
          x: pos.x,
          z: pos.z,
          yaw: wrap(deg(p.car.yaw)),
          heading: wrap(deg(tangentYaw(pos.x, pos.z) - p.car.yaw)),
          upDot: p.car.upDot,
          onTrack: q.onTrack,
          t: q.t,
          lateral: q.d,
          lap: p.lap,
          progress: p.progress,
        };
      }),
    });
    const aimDir = (headingDeg: number) => {
      const pos = game.current!.car.position;
      const yaw = game.clampYaw(tangentYaw(pos.x, pos.z) - (headingDeg * Math.PI) / 180);
      return { yaw, dir: { x: Math.cos(yaw), z: -Math.sin(yaw) } };
    };
    const aim = (headingDeg: number, power: number) => {
      if (!game.current || game.phase !== 'aim') return state();
      const { yaw, dir } = aimDir(headingDeg);
      const pos = game.current.car.position;
      endFinger();
      game.rotateCurrent(yaw);
      const from = pos.clone().sub(new THREE.Vector3(dir.x, 0, dir.z).multiplyScalar(0.6 + 3 * power));
      indicator.show(pos, dir, from, power, true);
      cue.hide();
      return state();
    };
    const step = (seconds: number) => {
      const n = Math.round(seconds / PHYS_DT);
      for (let i = 0; i < n; i++) stepPhysics();
      for (const p of game.players) p.car.sync();
      return state();
    };
    return {
      state,
      aim,
      flick: (headingDeg, power) => {
        if (!game.current || game.phase !== 'aim') return state();
        aim(headingDeg, power);
        const { dir } = aimDir(headingDeg);
        indicator.hide();
        game.flick(dir, power);
        return state();
      },
      step,
      settle: (maxSeconds = 12) => {
        let t = 0;
        while ((game.phase === 'flying' || game.phase === 'settle') && t < maxSeconds) {
          stepPhysics();
          t += PHYS_DT;
        }
        for (const p of game.players) p.car.sync();
        return state();
      },
      carScreen: () => {
        if (!game.current) return null;
        const v = game.current.car.position.clone().project(camera);
        return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
      },
      camera: (mode) => {
        if (!game.current) return;
        const { pos, target } = cameraPose(game.current, mode);
        camAnim = null;
        camera.position.copy(pos);
        controls.target.copy(target);
        controls.update();
      },
    };
  }

  let accumulator = 0;
  renderer.setAnimationLoop(() => {
    timer.update();
    const frameDt = Math.min(timer.getDelta(), 0.1);
    accumulator = Math.min(accumulator + frameDt, MAX_STEPS_PER_FRAME * PHYS_DT);
    const tPhys = performance.now();
    while (accumulator >= PHYS_DT) {
      stepPhysics();
      accumulator -= PHYS_DT;
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
