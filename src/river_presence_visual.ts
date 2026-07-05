// Vertical slice "O Rio": the river's first localized visual presence (E8).
//
// The problem the first human playtest surfaced: the river reacts in logic and
// text, but the place still looks like plain water. This module adds a small,
// experimental presence in the 3D scene near the territorial anchor so the
// player can FEEL that something noticed their arrival, without reading the HUD.
//
// This is NOT the final art direction and NOT an NPC: it is an incomplete
// manifestation made of water-surface pulse rings, a soft breathing core glow,
// and a few rising particles. It is presentation only:
//   - it lives in the slice renderer's own scene, never a Sim entity;
//   - it never enters the spatial grid, is never a collider, never blocks
//     movement or the camera (transparent, additive, depthWrite off);
//   - it carries NO loot/quest/NPC/ability, and it never mutates the river
//     relation. It only READS the presence state and reflects it.
//
// Composition: river_spirit.ts stays the sim-pure source of truth. The slice
// bootstrap (river_main.ts) maps that truth to a RiverPresenceMode each frame
// via the pure riverPresenceMode() below and calls setMode/update; nothing here
// touches the Sim. The state -> mode mapping and the per-mode parameters are
// DOM/THREE-free and unit-tested (tests/river_presence_visual.test.ts).
import * as THREE from 'three';
import type { RiverRelation } from './sim/encounters/river_spirit';
import { WATER_LEVEL } from './sim/world';

// The presence sits over the OPEN body of Mirror Lake (center known at (-92, 88),
// radius ~30), not on the shore. E11 moved it here from the old shore-shelf point
// (-73, 77): that spot was barely water (depth ~0.5yd) and the hillside relief hid
// it from the elevated spawn. This point is validated for seed 20061 as deep open
// water (groundHeight -8.5, depth ~4yd below WATER_LEVEL) and ~12yd from the lake
// center, so it reads unobstructed from the spawn hill, the descent, the shore, and
// the crossing. The detection anchor and the manifestation trigger are UNCHANGED
// (they stay in river_spirit.ts); only this visual position moved. Guarded by
// tests/river_presence_visual.test.ts.
export const RIVER_PRESENCE_CENTER = Object.freeze({ x: -82, z: 82 });

// The five presentation modes. 'dormant' is the pre-manifestation hush (hidden);
// the other four are the visible relational faces of the presence.
export type RiverPresenceMode = 'dormant' | 'observed' | 'offended' | 'authorized' | 'reconciled';

// Pure state -> visual-mode mapping. The presence is hidden until the river has
// manifested; the active current (the resistance in motion) always reads as the
// offended face regardless of the stored relation. Never mutates its inputs.
export function riverPresenceMode(
  relation: RiverRelation,
  hasManifested: boolean,
  currentActive: boolean,
): RiverPresenceMode {
  if (!hasManifested) return 'dormant';
  if (currentActive) return 'offended';
  switch (relation) {
    case 'offended':
      return 'offended';
    case 'authorized':
      return 'authorized';
    case 'reconciled':
      return 'reconciled';
    default:
      // observed, or the transient unknown-after-manifest that cannot occur: the
      // presence is awake and merely watching.
      return 'observed';
  }
}

// Per-mode visual parameters. Deliberately plain data so the distinctions are
// unit-testable without THREE: opacity 0 hides the presence; turbulence/amplitude
// drive how agitated it looks; reach is how far the rings open (offended closes
// in, authorized opens wide); pulseSpeed is the ring cadence.
export interface RiverPresenceParams {
  readonly color: number; // core glow + particle tint
  readonly ringColor: number;
  readonly opacity: number;
  readonly pulseSpeed: number;
  readonly turbulence: number;
  readonly amplitude: number;
  readonly reach: number;
}

export const RIVER_PRESENCE_PARAMS: Record<RiverPresenceMode, RiverPresenceParams> = {
  // Hidden hush before the river notices the player.
  dormant: {
    color: 0x9fd8d4,
    ringColor: 0x9fd8d4,
    opacity: 0,
    pulseSpeed: 0,
    turbulence: 0,
    amplitude: 0,
    reach: 0,
  },
  // Curious, soft, slow breathing.
  observed: {
    color: 0x9fd8d4,
    ringColor: 0xb9e4d8,
    opacity: 0.42,
    pulseSpeed: 0.5,
    turbulence: 0.12,
    amplitude: 0.1,
    reach: 2.6,
  },
  // Agitated and closed: fast, turbulent, high amplitude, rings pulled in tight.
  offended: {
    color: 0x7fc6d6,
    ringColor: 0x6fbcd0,
    opacity: 0.6,
    pulseSpeed: 1.7,
    turbulence: 0.85,
    amplitude: 0.3,
    reach: 2.2,
  },
  // Calm and open: brighter light, the rings reach out wide, almost no churn.
  authorized: {
    color: 0xb9e4d8,
    ringColor: 0xd4f0e8,
    opacity: 0.5,
    pulseSpeed: 0.35,
    turbulence: 0.05,
    amplitude: 0.08,
    reach: 3.6,
  },
  // Contained calm that keeps a trace of tension: quieter than observed, cooler
  // and slightly more restless than authorized (the water yields but remembers).
  reconciled: {
    color: 0x8fb8c0,
    ringColor: 0x9fc4cc,
    opacity: 0.4,
    pulseSpeed: 0.45,
    turbulence: 0.18,
    amplitude: 0.09,
    reach: 2.4,
  },
};

// Whether a mode paints anything at all (the enable/disable seam: 'dormant' and
// any zero-opacity mode are off). Presentation-only; never gates the sim.
export function presenceVisibleForMode(mode: RiverPresenceMode): boolean {
  return RIVER_PRESENCE_PARAMS[mode].opacity > 0;
}

const RING_COUNT = 3;
const PARTICLE_COUNT = 24;
// E11: a slightly taller plume so the presence reads over the open water from the
// spawn hill (the position, not the scale, is the real fix; this is a small nudge).
const PARTICLE_RISE = 2.8;

// Mutable copy of a params set, eased toward the target each frame so mode
// changes read as the presence settling rather than snapping.
interface LiveParams {
  color: THREE.Color;
  ringColor: THREE.Color;
  opacity: number;
  pulseSpeed: number;
  turbulence: number;
  amplitude: number;
  reach: number;
}

function liveFrom(p: RiverPresenceParams): LiveParams {
  return {
    color: new THREE.Color(p.color),
    ringColor: new THREE.Color(p.ringColor),
    opacity: p.opacity,
    pulseSpeed: p.pulseSpeed,
    turbulence: p.turbulence,
    amplitude: p.amplitude,
    reach: p.reach,
  };
}

// The THREE presence: a small group of additive, non-writing-depth meshes over
// the water. Built by createRiverPresence below. Kept intentionally light; this
// is an experimental first pass, not a shader system.
export class RiverPresence {
  readonly group: THREE.Group;
  private readonly rings: THREE.Mesh[] = [];
  private readonly core: THREE.Mesh;
  private readonly particles: THREE.Points;
  private readonly particleBase: { a: number; r: number; seed: number }[] = [];
  private readonly cur: LiveParams = liveFrom(RIVER_PRESENCE_PARAMS.dormant);
  private target: RiverPresenceParams = RIVER_PRESENCE_PARAMS.dormant;
  private mode: RiverPresenceMode = 'dormant';
  private t = 0;

  constructor(center: { x: number; z: number }, surfaceY: number) {
    this.group = new THREE.Group();
    // Sit just above the water surface so the rings never z-fight the water plane.
    this.group.position.set(center.x, surfaceY + 0.06, center.z);

    // Pulse rings: a shared unit annulus laid flat on the water, one mesh per
    // ring, each scaled/faded independently in update().
    const ringGeo = new THREE.RingGeometry(0.86, 1.0, 48);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < RING_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, mat);
      this.rings.push(ring);
      this.group.add(ring);
    }

    // Core glow: a soft breathing bulge just above the surface, the presence
    // "lifting" toward the arriving player.
    this.core = new THREE.Mesh(
      // E11: slightly larger and lifted a touch higher so the glow reads over the
      // open water at the greater viewing distance (a small nudge, not a rescale).
      new THREE.IcosahedronGeometry(0.85, 2),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.core.position.y = 0.5;
    this.group.add(this.core);

    // Rising particles: a handful of motes drifting up out of the water, laid out
    // deterministically (no rng) so the slice stays reproducible.
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const a = (i / PARTICLE_COUNT) * Math.PI * 2 * 1.618;
      const r = 0.25 + ((i * 7) % 11) / 11;
      const seed = (i * 0.137) % 1;
      this.particleBase.push({ a, r, seed });
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = seed * PARTICLE_RISE;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.16,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    this.group.add(this.particles);
  }

  setMode(mode: RiverPresenceMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.target = RIVER_PRESENCE_PARAMS[mode];
  }

  // Advance the animation by visual dt seconds. Eases the live params toward the
  // target (so the presence appears/calms smoothly), then paints rings, core, and
  // particles. Pure presentation; never reads or writes the sim.
  update(dt: number): void {
    const step = Math.min(1, Math.max(0, dt) * 3);
    const c = this.cur;
    c.opacity += (this.target.opacity - c.opacity) * step;
    c.pulseSpeed += (this.target.pulseSpeed - c.pulseSpeed) * step;
    c.turbulence += (this.target.turbulence - c.turbulence) * step;
    c.amplitude += (this.target.amplitude - c.amplitude) * step;
    c.reach += (this.target.reach - c.reach) * step;
    c.color.lerp(new THREE.Color(this.target.color), step);
    c.ringColor.lerp(new THREE.Color(this.target.ringColor), step);

    this.t += dt;
    const t = this.t;
    this.group.visible = c.opacity > 0.01;
    if (!this.group.visible) return;

    // Rings: each rides its own phase, growing from the center to `reach` and
    // fading as it opens; turbulence adds a restless wobble to the radius.
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      const phase = (t * c.pulseSpeed * 0.5 + i / this.rings.length) % 1;
      const wobble = 1 + c.turbulence * 0.25 * Math.sin(t * 7 + i * 2.1);
      const radius = Math.max(0.001, phase * c.reach * wobble);
      ring.scale.set(radius, 1, radius);
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.color.copy(c.ringColor);
      mat.opacity = c.opacity * (1 - phase) * 0.9;
    }

    // Core: a breathing lift; turbulence adds a small nervous flutter.
    const breath = 1 + c.amplitude * Math.sin(t * (1.2 + c.pulseSpeed));
    const flutter = 1 + c.turbulence * 0.15 * Math.sin(t * 11);
    this.core.scale.setScalar(breath * flutter);
    const coreMat = this.core.material as THREE.MeshBasicMaterial;
    coreMat.color.copy(c.color);
    coreMat.opacity = c.opacity * 0.9;

    // Particles: rise and wrap; turbulence spreads them and jitters the drift.
    const attr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const b = this.particleBase[i];
      const y = ((t * (0.5 + c.pulseSpeed * 0.4) + b.seed) % 1) * PARTICLE_RISE;
      const spread = 1 + c.turbulence * 0.6;
      const drift = c.turbulence * 0.2 * Math.sin(t * 5 + i);
      arr[i * 3] = Math.cos(b.a) * b.r * spread + drift;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(b.a) * b.r * spread - drift;
    }
    attr.needsUpdate = true;
    const pMat = this.particles.material as THREE.PointsMaterial;
    pMat.color.copy(c.color);
    pMat.opacity = c.opacity;
  }

  // Remove from the scene and release GPU resources. Not strictly needed for the
  // page-lifetime slice, but keeps the presence a clean, disposable add-on.
  dispose(): void {
    this.group.parent?.remove(this.group);
    this.group.traverse((obj) => {
      const withGeo = obj as { geometry?: THREE.BufferGeometry; material?: THREE.Material };
      withGeo.geometry?.dispose();
      withGeo.material?.dispose();
    });
  }
}

// Factory the slice calls: builds the presence over the water at the anchor and
// adds it to the given scene. The presence starts dormant (hidden) until the
// slice drives setMode() from the river's manifestation state.
export function createRiverPresence(scene: THREE.Scene): RiverPresence {
  // Over water the ground is below the waterline, so the visible surface is the
  // water plane at WATER_LEVEL (validated for the center by the tests).
  const presence = new RiverPresence(RIVER_PRESENCE_CENTER, WATER_LEVEL);
  scene.add(presence.group);
  return presence;
}
