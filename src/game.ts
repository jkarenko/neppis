import type * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { Car } from './car.ts';
import type { Track, TrackQuery } from './track.ts';
import { CAR, PHYS_DT, PLAYER_COLORS, type Rules } from './config.ts';
import { Rng } from './rng.ts';
import { clampTurn, maxPowerForTurn, planFlick, wrapAngle, type AiProfile, type Plan, type RaceContext } from './ai.ts';

/** Where to put a car instead of its grid slot, in track terms so scenarios survive track edits. */
export interface TrackPose {
  /** Position along the lap, 0..1. */
  t: number;
  /** Extra distance along the lap from t, world units, so "three car lengths before the jump" is expressible. */
  along?: number;
  /** Offset from the centreline in world units, positive to the right of travel. */
  lateral: number;
  /** Nose heading relative to the direction of travel, radians, positive turns right. */
  heading: number;
}

export interface PlayerSetup {
  name: string;
  ai: boolean;
  /** How an AI drives; the default driver when missing. */
  profile?: AiProfile;
  /** Roster id of an AI driver, for the portrait. */
  driverId?: string;
  /** Car colour; the grid slot's colour when missing. */
  color?: number;
  pose?: TrackPose;
}

export interface Player {
  id: number;
  name: string;
  ai: boolean;
  profile?: AiProfile;
  /** The player's last flick ended on the roof. */
  flipped: boolean;
  driverId?: string;
  color: number;
  /** Race stats for the results: flicks taken, flips, and the longest single flick in world units. */
  flicks: number;
  flips: number;
  bestFlick: number;
  car: Car;
  lap: number;
  prevT: number;
  t: number;
  progress: number;
  finished: boolean;
  place: number;
}

export type Phase = 'setup' | 'aim' | 'flying' | 'settle' | 'finished';
export type Outcome = 'ok' | 'kelli' | 'puolikelli' | 'offtrack';

export type MessageKind = 'flip' | 'tip' | 'offtrack' | 'finish' | 'info';

export interface GameEvents {
  message(text: string, kind: MessageKind, ms?: number): void;
  turnStart(p: Player): void;
  flick(p: Player): void;
  changed(): void;
  raceOver(placings: Player[]): void;
}

/** A place a car can be put back to, with the lap count as it stood there so a placement restores it too. */
interface Pose {
  x: number;
  z: number;
  yaw: number;
  lap: number;
  /** The last on-track position the lap counter had seen there. */
  t: number;
}

/** Turn-based rule engine sitting on top of the physics world. */
export class Game {
  phase: Phase = 'setup';
  players: Player[] = [];
  order: number[] = [];
  orderPos = 0;
  current: Player | null = null;
  flicksLeft = 0;
  round = 0;
  lastOutcome: Outcome | null = null;
  readonly rng: Rng;

  private flickStart: Pose = { x: 0, z: 0, yaw: 0, lap: 0, t: 0 };
  private turnStart: Pose = { x: 0, z: 0, yaw: 0, lap: 0, t: 0 };
  private lastOnTrack: Pose | null = null;
  private startedOffTrack = false;
  /** The current flick has been off the track at some point, on the ground or in the air. */
  private leftTrack = false;
  private path: Pose[] = [];
  private pathLen = 0;
  private flightTime = 0;
  private settleTimer = 0;
  private finishedCount = 0;
  private aiTimer = 0;
  private aiPlan: Plan | null = null;
  /** The heading the current car came to rest with: the centre of the turn wedge for the next flick. */
  restYaw = 0;
  /** AI flicks whose wanted line was outside the wedge, for the headless race report. */
  aiClamped = 0;
  /** The plan behind the AI's latest flick, for the headless tools. */
  lastPlan: Plan | null = null;
  readonly heightAt = (x: number, z: number): number => this.track.heightAt(x, z);

  constructor(
    readonly world: RAPIER.World,
    readonly track: Track,
    readonly scene: THREE.Scene,
    readonly rules: Rules,
    readonly events: GameEvents,
    seed = Date.now(),
  ) {
    this.rng = new Rng(seed);
  }

  start(setups: PlayerSetup[]): void {
    this.clear();
    const slots = this.track.startSlots(setups.length);
    this.players = setups.map((s, i) => {
      const slot = s.pose ? this.resolvePose(s.pose) : slots[i];
      const car = new Car(this.world, s.color ?? PLAYER_COLORS[i % PLAYER_COLORS.length], slot.x, slot.z, this.track.heightAt(slot.x, slot.z), slot.yaw);
      this.scene.add(car.mesh);
      const q = this.track.query(slot.x, slot.z);
      // The grid sits just behind the start line, so the first crossing begins lap 0. A car placed by pose is
      // already on its first lap.
      const lap = s.pose ? 0 : -1;
      return {
        id: i,
        name: s.name,
        ai: s.ai,
        profile: s.profile,
        driverId: s.driverId,
        flipped: false,
        color: car.color,
        flicks: 0,
        flips: 0,
        bestFlick: 0,
        car,
        lap,
        prevT: q.t,
        t: q.t,
        progress: q.t + lap,
        finished: false,
        place: 0,
      };
    });
    this.round = 0;
    this.finishedCount = 0;
    this.lastOutcome = null;
    this.startRound();
  }

  /** World position and yaw for a track pose. */
  resolvePose(pose: TrackPose): { x: number; z: number; yaw: number } {
    const idx = this.track.indexOffset(pose.t * this.track.n, pose.along ?? 0);
    const p = this.track.pointAt(idx);
    const tg = this.track.tangentAt(idx);
    // right = forward x up, as in Track.query
    return {
      x: p.x + -tg.z * pose.lateral,
      z: p.z + tg.x * pose.lateral,
      yaw: Math.atan2(-tg.z, tg.x) - pose.heading,
    };
  }

  clear(): void {
    for (const p of this.players) {
      this.scene.remove(p.car.mesh);
      p.car.dispose();
    }
    this.players = [];
    this.current = null;
    this.phase = 'setup';
    this.aiTimer = 0;
    this.aiPlan = null;
  }

  get currentIsHuman(): boolean {
    return this.phase === 'aim' && this.current !== null && !this.current.ai;
  }

  private startRound(): void {
    this.round++;
    const active = this.players.filter((p) => !p.finished);
    if (this.rules.orderByPosition) active.sort((a, b) => b.progress - a.progress);
    this.order = active.map((p) => p.id);
    this.orderPos = 0;
    this.startTurn();
  }

  private startTurn(): void {
    for (const pl of this.players) pl.car.clearPreview();
    const p = this.players[this.order[this.orderPos]];
    this.current = p;
    this.flicksLeft = this.rules.flicksPerTurn;
    if (p.car.upDot < 0.7) {
      // Knocked over by somebody else: right it where it lies.
      const pos = p.car.position;
      this.place(p, { x: pos.x, z: pos.z, yaw: p.car.yaw, lap: p.lap, t: p.prevT });
    }
    this.turnStart = this.poseOf(p);
    this.restYaw = p.car.yaw;
    this.phase = 'aim';
    this.events.turnStart(p);
    this.events.changed();
    if (p.ai) this.scheduleAi(0.9);
  }

  private poseOf(p: Player): Pose {
    const pos = p.car.position;
    return { x: pos.x, z: pos.z, yaw: p.car.yaw, lap: p.lap, t: p.prevT };
  }

  /**
   * Turn the nose towards a yaw for the coming flick, as far as the turn wedge allows. Only the meshes move until
   * the flick is released. Returns the yaw actually taken, or null when no flick can be aimed now.
   */
  rotateCurrent(yaw: number): number | null {
    if (this.phase !== 'aim' || !this.current || this.current.ai) return null;
    const taken = clampTurn(yaw, this.restYaw);
    this.current.car.setPreview(taken, this.heightAt);
    return taken;
  }

  /** The aim was let go without a flick: the nose goes back to where the car rests. */
  cancelAim(): void {
    if (this.phase === 'aim' && this.current && !this.current.ai) this.current.car.clearPreview();
  }

  /** The nose heading a flick aimed at this yaw would take. */
  clampYaw(yaw: number): number {
    return clampTurn(yaw, this.restYaw);
  }

  /** The most power the current car may flick with at the nose heading it is previewing (or resting with). */
  maxPowerNow(yaw = this.current?.car.yaw ?? this.restYaw): number {
    return maxPowerForTurn(wrapAngle(yaw - this.restYaw));
  }

  flick(_dir: { x: number; z: number }, power: number): void {
    if (this.phase !== 'aim' || !this.current) return;
    const car = this.current.car;
    car.commitPreview();
    // A sharp turn cannot be taken at speed: the power is capped by how far the nose was turned for this flick.
    power = Math.min(power, this.maxPowerNow(car.yaw));
    this.flickStart = this.poseOf(this.current);
    const q = this.track.query(this.flickStart.x, this.flickStart.z);
    this.startedOffTrack = !q.onTrack;
    this.leftTrack = false;
    this.lastOnTrack = this.startedOffTrack ? null : { ...this.flickStart };
    this.path = [{ ...this.flickStart }];
    this.pathLen = 0;
    this.flightTime = 0;
    car.flick(power);
    this.current.flicks++;
    this.phase = 'flying';
    this.events.flick(this.current);
    this.events.changed();
  }

  /** After the physics step. Runs 240 times a second, so it queries the track once per car. */
  afterStep(dt = PHYS_DT): void {
    let currentQuery: TrackQuery | null = null;
    for (const p of this.players) {
      if (p.car.body.isSleeping() && p !== this.current) continue;
      const pos = p.car.body.translation();
      const q = this.track.query(pos.x, pos.z);
      this.trackLap(p, q);
      if (p === this.current) currentQuery = q;
    }

    if (this.phase === 'flying' && this.current && currentQuery) {
      const car = this.current.car;
      const pos = car.body.translation();
      const q = currentQuery;
      this.flightTime += dt;
      const last = this.path[this.path.length - 1];
      const d = Math.hypot(pos.x - last.x, pos.z - last.z);
      if (d > 0.05) {
        const yaw = Math.atan2(-(pos.z - last.z), pos.x - last.x);
        this.path.push({ x: pos.x, z: pos.z, yaw, lap: this.current.lap, t: this.current.prevT });
        this.pathLen += d;
      }
      // Leaving the track is judged along the whole flight, not just where the car stops, so a cut across the
      // infield that lands back on the track is caught. The point it goes back to is the last one before it left
      // with the car upright, pulled onto the floor inside the ridge so it sits still there.
      if (!q.onTrack) this.leftTrack = true;
      else if (!this.leftTrack && car.upDot > 0.7) this.lastOnTrack = this.floorPose(q, car.yaw, this.current);
      if (car.settled(dt) || this.flightTime > 12) this.resolve();
    } else if (this.phase === 'settle' && this.current) {
      this.settleTimer -= dt;
      if (this.settleTimer <= 0) {
        if (this.current.finished || this.flicksLeft <= 0) {
          this.nextTurn();
        } else {
          this.restYaw = this.current.car.yaw;
          this.phase = 'aim';
          this.events.changed();
          if (this.current.ai) this.scheduleAi(0.5);
        }
      }
    }

    if (this.aiTimer > 0) {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) this.runAi();
    }
  }

  /**
   * Laps are counted from the track position while the car is on the track; off it, t is unreliable (the nearest
   * point of the loop flips across the infield), so it is neither counted nor remembered and the car rejoins
   * relative to where it left.
   */
  private trackLap(p: Player, q: TrackQuery): void {
    if (!q.onTrack) return;
    const dT = q.t - p.prevT;
    if (dT < -0.5) p.lap++;
    else if (dT > 0.5) p.lap--;
    p.prevT = q.t;
  }

  private resolve(): void {
    const p = this.current!;
    const car = p.car;
    const up = car.upDot;
    let outcome: Outcome = 'ok';
    if (up < -0.2) outcome = 'kelli';
    else if (up < 0.6) outcome = 'puolikelli';
    else if (this.leftTrack && !this.startedOffTrack) outcome = 'offtrack';

    switch (outcome) {
      case 'kelli':
        this.place(p, this.rules.kelli === 'turnStart' ? this.turnStart : this.flickStart);
        this.events.message(`Flip! ${p.name} goes back to where the flick started.`, 'flip');
        break;
      case 'puolikelli':
        this.place(p, this.midpointPose());
        this.events.message(`Tipped over. ${p.name} is put back halfway along the flick.`, 'tip');
        break;
      case 'offtrack':
        this.place(p, this.rules.offTrack === 'flickStart' || !this.lastOnTrack ? this.flickStart : this.lastOnTrack);
        this.events.message(`${p.name} left the track. Back to the last point on it.`, 'offtrack');
        break;
      case 'ok':
        break;
    }
    this.lastOutcome = outcome;
    p.flipped = outcome === 'kelli';
    if (outcome === 'kelli') p.flips++;
    else if (outcome === 'ok') p.bestFlick = Math.max(p.bestFlick, this.pathLen);

    for (const pl of this.players) {
      const pp = pl.car.position;
      const pq = this.track.query(pp.x, pp.z);
      pl.t = pq.onTrack ? pq.t : pl.prevT;
      pl.progress = pl.lap + pl.t;
    }
    for (const pl of this.players) {
      if (!pl.finished && pl.lap >= this.rules.laps) {
        pl.finished = true;
        pl.place = ++this.finishedCount;
        this.events.message(`${pl.name} crosses the line in place ${pl.place}!`, 'finish', 4000);
      }
    }

    this.flicksLeft--;
    this.phase = 'settle';
    this.settleTimer = outcome === 'ok' ? 0.2 : 0.6;
    this.events.changed();
  }

  /**
   * Where a car at this track position would rest with the whole of it on the floor: its lateral offset is pulled
   * in from the ridge foot by how far the car reaches sideways with its nose at this yaw, plus a little. A car put
   * down with a wheel on the ridge ramp rolls off the crest and rests off the track.
   */
  private floorPose(q: TrackQuery, yaw: number, p: Player): Pose {
    const tg = this.track.tangentAt(q.index);
    const rel = yaw - Math.atan2(-tg.z, tg.x);
    const reach = (Math.abs(Math.sin(rel)) * CAR.length + Math.abs(Math.cos(rel)) * CAR.width) / 2 + 0.06;
    const limit = Math.max(0, this.track.halfWidth - reach);
    const d = Math.max(-limit, Math.min(limit, q.d));
    const c = this.track.pointAt(q.index);
    return { x: c.x - tg.z * d, z: c.z + tg.x * d, yaw, lap: p.lap, t: p.prevT };
  }

  private midpointPose(): Pose {
    const half = this.pathLen / 2;
    let acc = 0;
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1];
      const b = this.path[i];
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (acc + d >= half) {
        const k = d > 0 ? (half - acc) / d : 0;
        const at = k < 0.5 ? a : b;
        return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: b.yaw, lap: at.lap, t: at.t };
      }
      acc += d;
    }
    return this.flickStart;
  }

  private place(p: Player, pose: Pose): void {
    p.car.setPose(pose.x, pose.z, pose.yaw, this.heightAt);
    p.lap = pose.lap;
    p.prevT = pose.t;
  }

  private nextTurn(): void {
    const active = this.players.filter((p) => !p.finished);
    const over = active.length === 0 || (this.players.length > 1 && active.length <= 1);
    if (over) {
      for (const p of active) {
        p.finished = true;
        p.place = ++this.finishedCount;
      }
      this.phase = 'finished';
      this.current = null;
      this.events.changed();
      this.events.raceOver([...this.players].sort((a, b) => a.place - b.place));
      return;
    }
    this.orderPos++;
    while (this.orderPos < this.order.length && this.players[this.order[this.orderPos]].finished) this.orderPos++;
    if (this.orderPos >= this.order.length) this.startRound();
    else this.startTurn();
  }

  /** What the planner may know about the race: standing, rivals still running, and its own last flick. */
  private raceContext(p: Player): RaceContext {
    const running = this.players.filter((o) => !o.finished);
    const place = 1 + running.filter((o) => o !== p && o.progress > p.progress).length;
    const rivals = running.filter((o) => o !== p).map((o) => ({ x: o.car.position.x, z: o.car.position.z }));
    return { place, rivals, afterFlip: p.flipped };
  }

  private scheduleAi(delay: number): void {
    this.aiPlan = null;
    this.aiTimer = delay;
  }

  private runAi(): void {
    if (this.phase !== 'aim' || !this.current || !this.current.ai) return;
    if (!this.aiPlan) {
      const plan = planFlick(this.track, this.current.car, this.rng, this.current.profile, this.raceContext(this.current));
      // The planner respects the wedge itself; the clamp here only catches its aim noise spilling over the edge.
      plan.yaw = clampTurn(plan.yaw, this.restYaw);
      if (plan.clamped) this.aiClamped++;
      this.aiPlan = plan;
      this.lastPlan = plan;
      this.current.car.setPreview(plan.yaw, this.heightAt);
      this.aiTimer = 0.45;
      return;
    }
    const plan = this.aiPlan;
    this.aiPlan = null;
    this.flick(plan.dir, plan.power);
  }
}
