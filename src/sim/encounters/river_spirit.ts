// "O Rio" vertical slice: the river presence, through E5. Two behaviors exist:
// the first manifestation (E4) and the first bodily resistance (E5). The
// relation is a minimal three-state memory (unknown -> observed -> offended);
// authorization, reconciliation, the offering, the ford, a guide, dialogue, and
// body/spirit separation are later steps and deliberately absent.
//
// Composition model: this module is HOST-DRIVEN. The slice bootstrap
// (src/river_main.ts) calls updateRiverSpirit once before each sim.tick();
// nothing in Sim/SimContext references it, so the shipped game, the tick-phase
// order, and the parity gate never see it. It is sim-pure (no DOM, no
// Math.random, no wall clock) and draws no rng, so a scripted walk manifests
// and resists on the same ticks for the same seed. It moves the player only
// through the public Sim surface (pos/prevPos/velocity, groundPos, rebucket,
// emit); it never touches the Sim core.
import { PLAYER_SWIM_DEPTH } from '../pathfind';
import type { Entity, SimEvent, Vec3 } from '../types';
import { WATER_LEVEL } from '../world';

// Territorial anchor on the Mirror Lake shore, on the walk line from the slice
// spawn (-45, 60) toward the water. Validated for seed 20061
// (tests/river_spirit.test.ts): dry ground (h = -1.57, above the water line),
// 25.6yd from spawn. Deep water begins ~9yd further toward the lake, so
// approaching the water always crosses this radius first (manifestation before
// resistance).
export const RIVER_SPIRIT_ANCHOR = Object.freeze({ x: -67, z: 73 });
export const RIVER_SPIRIT_RADIUS = 12;

// Where the current deposits the body: a dry, gentle-slope bank point back
// toward the origin shore, close to the anchor but out of deep water so it does
// not re-trigger without the player walking back in. Validated for seed 20061
// (h = 2.14, ~6.6yd above the water line, slope 0.53, 10.3yd from the anchor).
export const RIVER_RETURN_POS = Object.freeze({ x: -58, z: 68 });

// Current duration: the fixed 20 Hz tick means 50 ticks = 2.5s (within the
// intended 2 to 3 seconds), counted from the tick the current starts.
export const RIVER_CURRENT_TICKS = 50;

// Slice text, rendered by the slice's own message element (never the MMO HUD).
export const RIVER_MANIFESTATION_LINE = 'A água percebe sua pressa.';
export const RIVER_MANIFESTATION_COLOR = '#9fd8d4';
export const RIVER_RESISTANCE_LINE = 'A água não abre caminho.';
export const RIVER_RESISTANCE_COLOR = '#7fc6d6';

// The territory's memory of the player, minimal for E5.
export type RiverRelation = 'unknown' | 'observed' | 'offended';

export interface RiverSpiritState {
  relation: RiverRelation;
  hasManifested: boolean;
  manifestedAtTick: number | null;
  // The active current, or null when the body is under the player's control.
  current: {
    startTick: number;
    from: { x: number; z: number };
    to: { x: number; z: number };
  } | null;
}

export function createRiverSpiritState(): RiverSpiritState {
  return { relation: 'unknown', hasManifested: false, manifestedAtTick: null, current: null };
}

// The narrow structural slice of Sim the presence needs; a full Sim satisfies
// it through public members only. The module reads/writes the live player
// entity (pos/prevPos/velocity) and repositions via groundPos + rebucket, the
// same primitives releasePlayerSpirit uses.
export interface RiverSpiritHost {
  readonly tickCount: number;
  readonly playerId: number;
  readonly player: Entity;
  groundPos(x: number, z: number): Vec3;
  rebucket(e: Entity): void;
  emit(ev: SimEvent): void;
}

// What happened this tick, for the host to present (message + veil) and to gate
// input. 'carrying' and 'resistStarted' mean the current owns the body;
// 'released' is the final tick that hands control back.
export type RiverSpiritEffect = 'none' | 'manifested' | 'resistStarted' | 'carrying' | 'released';

export function isRiverCurrentActive(state: RiverSpiritState): boolean {
  return state.current !== null;
}

// Deep/swim water under a point, matching the sim's own predicate
// (groundHeight < WATER_LEVEL - SWIM_DEPTH; SWIM_DEPTH === PLAYER_SWIM_DEPTH).
function isDeepWaterUnder(host: RiverSpiritHost, x: number, z: number): boolean {
  return host.groundPos(x, z).y < WATER_LEVEL - PLAYER_SWIM_DEPTH;
}

function smoothstep(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

// Call once per tick, BEFORE host.tick(). Advances an active current (ignoring
// player intent, which the host also stops applying), else checks for the first
// manifestation, else for a forced deep-water entry.
export function updateRiverSpirit(
  state: RiverSpiritState,
  host: RiverSpiritHost,
): RiverSpiritEffect {
  const p = host.player;

  // 1) The current owns the body: sweep it toward the origin bank over
  //    RIVER_CURRENT_TICKS, then release it on dry ground.
  if (state.current) {
    const elapsed = host.tickCount - state.current.startTick;
    if (elapsed >= RIVER_CURRENT_TICKS) {
      const gp = host.groundPos(state.current.to.x, state.current.to.z);
      p.pos = { x: gp.x, y: gp.y, z: gp.z };
      p.prevPos = { x: gp.x, y: gp.y, z: gp.z };
      p.vx = 0;
      p.vz = 0;
      p.vy = 0;
      host.rebucket(p);
      state.current = null;
      return 'released';
    }
    // Progressive displacement (never an instant teleport): snapshot prevPos for
    // smooth render interpolation, then step x/z along the eased line. The
    // Sim's vertical clamp lifts the body out of the water as ground rises.
    const t = smoothstep(elapsed / RIVER_CURRENT_TICKS);
    p.prevPos = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    p.pos.x = state.current.from.x + (state.current.to.x - state.current.from.x) * t;
    p.pos.z = state.current.from.z + (state.current.to.z - state.current.from.z) * t;
    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    return 'carrying';
  }

  // 2) First manifestation (E4): once per session, on entering the anchor
  //    radius; unknown -> observed.
  if (!state.hasManifested) {
    const d = Math.hypot(p.pos.x - RIVER_SPIRIT_ANCHOR.x, p.pos.z - RIVER_SPIRIT_ANCHOR.z);
    if (d <= RIVER_SPIRIT_RADIUS) {
      state.hasManifested = true;
      state.manifestedAtTick = host.tickCount;
      if (state.relation === 'unknown') state.relation = 'observed';
      host.emit({
        type: 'log',
        text: RIVER_MANIFESTATION_LINE,
        color: RIVER_MANIFESTATION_COLOR,
        pid: host.playerId,
      });
      return 'manifested';
    }
  }

  // 3) Forced deep-water entry, only after the presence is perceived: the water
  //    takes the body. May happen again on a later attempt, but the first line
  //    never repeats (hasManifested stays true).
  if (state.relation !== 'unknown' && isDeepWaterUnder(host, p.pos.x, p.pos.z)) {
    state.relation = 'offended';
    state.current = {
      startTick: host.tickCount,
      from: { x: p.pos.x, z: p.pos.z },
      to: { x: RIVER_RETURN_POS.x, z: RIVER_RETURN_POS.z },
    };
    host.emit({
      type: 'log',
      text: RIVER_RESISTANCE_LINE,
      color: RIVER_RESISTANCE_COLOR,
      pid: host.playerId,
    });
    return 'resistStarted';
  }

  return 'none';
}
