import * as THREE from 'three';
import { CAR, POWER_COLORS } from './config.ts';

const stops = POWER_COLORS.map(([p, c]) => ({ p, c: new THREE.Color(c) }));

export function powerColor(power: number, out = new THREE.Color()): THREE.Color {
  const p = Math.max(0, Math.min(1, power));
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i].p) {
      const a = stops[i - 1];
      const b = stops[i];
      const k = (p - a.p) / (b.p - a.p);
      return out.copy(a.c).lerp(b.c, k);
    }
  }
  return out.copy(stops[stops.length - 1].c);
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uLen;
  varying vec2 vUv;
  void main() {
    float y = vUv.y - 0.5;
    float x = vUv.x * uLen;
    float phase = fract(x * 2.2 + abs(y) * 1.6 - uTime * 3.0);
    float chev = smoothstep(0.0, 0.1, phase) * (1.0 - smoothstep(0.45, 0.55, phase));
    float edge = 1.0 - smoothstep(0.3, 0.5, abs(y));
    float tail = smoothstep(0.0, 0.15, vUv.x);
    float a = chev * edge * tail * 0.95;
    gl_FragColor = vec4(uColor, a);
  }
`;

/** Animated chevron ribbon from the finger to the back of the car. */
export class FlickIndicator {
  readonly group: THREE.Group;
  private readonly ribbon: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly disc: THREE.Mesh;
  private readonly triangle: THREE.Mesh;
  private readonly triangleMaterial: THREE.MeshBasicMaterial;
  private readonly color = new THREE.Color();

  constructor() {
    this.group = new THREE.Group();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x3b82f6) },
        uTime: { value: 0 },
        uLen: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.ribbon = new THREE.Mesh(geo, this.material);
    this.ribbon.renderOrder = 10;
    this.ribbon.visible = false;
    this.group.add(this.ribbon);

    // Marker under the car: a grey disc while the drag is too short, a coloured triangle
    // pointing the way the car will go once it counts as a flick.
    const discGeo = new THREE.CircleGeometry(0.6, 32);
    discGeo.rotateX(-Math.PI / 2);
    this.disc = new THREE.Mesh(
      discGeo,
      new THREE.MeshBasicMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    this.disc.visible = false;
    this.group.add(this.disc);

    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([0.75, 0, 0, -0.3, 0, -0.45, -0.3, 0, 0.45], 3));
    tri.setIndex([0, 2, 1]);
    tri.computeVertexNormals();
    this.triangleMaterial = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.triangle = new THREE.Mesh(tri, this.triangleMaterial);
    this.triangle.visible = false;
    this.group.add(this.triangle);
  }

  /**
   * car = car position, dir = flick direction, from = finger position on the ground.
   * While the drag is too short to be a flick only the grey disc shows.
   */
  show(car: THREE.Vector3, dir: { x: number; z: number }, from: THREE.Vector3, power: number, valid: boolean): void {
    const groundY = car.y - CAR.restHeight + 0.01;
    this.disc.visible = !valid;
    this.disc.position.set(car.x, groundY, car.z);
    this.triangle.visible = valid;
    this.ribbon.visible = valid;
    if (!valid) return;

    const yaw = Math.atan2(-dir.z, dir.x);
    this.triangle.position.set(car.x, groundY, car.z);
    this.triangle.rotation.y = yaw;
    this.triangleMaterial.color.copy(powerColor(power, this.color));

    const to = { x: car.x - dir.x * 0.45, z: car.z - dir.z * 0.45 };
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.max(0.05, Math.hypot(dx, dz));
    this.ribbon.position.set((from.x + to.x) / 2, car.y, (from.z + to.z) / 2);
    this.ribbon.rotation.y = Math.atan2(-dz, dx);
    this.ribbon.scale.set(len, 1, 0.34);
    this.material.uniforms.uLen.value = len;
    this.material.uniforms.uColor.value.copy(this.color);
  }

  hide(): void {
    this.ribbon.visible = false;
    this.disc.visible = false;
    this.triangle.visible = false;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }
}
