// "O Rio" vertical slice: the river presence, E4 cut. Only the first
// manifestation exists here: a fixed territorial anchor on the Mirror Lake
// shore notices the player's first approach, emits one supported log event,
// and never repeats in the session. The relational state machine (observado /
// autorizado / ofendido / reconciliado), offering, current, and crossing
// consequences are later steps and deliberately absent.
//
// Composition model (differs from nythraxis.ts on purpose): this module is
// HOST-DRIVEN. The slice bootstrap (src/river_main.ts) calls updateRiverSpirit
// once before each sim.tick(); nothing in Sim/SimContext references it, so the
// shipped game, the tick-phase order, and the parity gate never see it. It is
// sim-pure (no DOM, no Math.random, no wall clock) and draws no rng, so a
// scripted walk manifests on the same tick for the same seed.
import type { SimEvent, Vec3 } from '../types';

// Anchor on the shore of Mirror Lake, on the natural walk line from the slice
// spawn (-45, 60) toward the water. Numerically validated for seed 20061
// (tests/river_spirit.test.ts): dry ground at h = -1.57 (2.93yd above the
// water line), local slope 0.539, 25.6yd from spawn, waterline ~7yd further
// toward the lake. The spawn sits outside the radius, so only walking toward
// the water triggers the manifestation.
export const RIVER_SPIRIT_ANCHOR = Object.freeze({ x: -67, z: 73 });
export const RIVER_SPIRIT_RADIUS = 12;

// The one manifestation line (slice text, rendered by the slice's own message
// element, never by the MMO HUD) and its log color, a quiet water tone.
export const RIVER_MANIFESTATION_LINE = 'A água percebe sua pressa.';
export const RIVER_MANIFESTATION_COLOR = '#9fd8d4';

// E4 state: only "has the presence manifested this session". Per Sim instance,
// owned by the host (the bootstrap or a test), never global.
export interface RiverSpiritState {
  hasManifested: boolean;
  manifestedAtTick: number | null;
}

export function createRiverSpiritState(): RiverSpiritState {
  return { hasManifested: false, manifestedAtTick: null };
}

// The narrow structural slice of Sim the presence needs; a full Sim satisfies
// it. emit() is Sim's public event entry, so the manifestation rides the
// supported { type: 'log' } SimEvent and drains in the same tick's return.
export interface RiverSpiritHost {
  readonly tickCount: number;
  readonly playerId: number;
  readonly player: { pos: Vec3 };
  emit(ev: SimEvent): void;
}

// Call once per tick, before host.tick(). Returns true only on the single
// manifestation edge (first entry into the anchor radius this session).
export function updateRiverSpirit(state: RiverSpiritState, host: RiverSpiritHost): boolean {
  if (state.hasManifested) return false;
  const p = host.player.pos;
  const d = Math.hypot(p.x - RIVER_SPIRIT_ANCHOR.x, p.z - RIVER_SPIRIT_ANCHOR.z);
  if (d > RIVER_SPIRIT_RADIUS) return false;
  state.hasManifested = true;
  state.manifestedAtTick = host.tickCount;
  host.emit({
    type: 'log',
    text: RIVER_MANIFESTATION_LINE,
    color: RIVER_MANIFESTATION_COLOR,
    pid: host.playerId,
  });
  return true;
}
