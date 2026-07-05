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

// The natural ford: the lake narrows to a shallow neck at its southern tip
// (validated for seed 20061, tests/river_spirit.test.ts). Around z=62, x=-96..-102
// the water is <= ~0.6yd deep with NO deep cell (ground stays above WATER_LEVEL -
// PLAYER_SWIM_DEPTH), so wading it never triggers the current. The player finds it
// by walking the shore south from the anchor. Crossing here keeps the relation
// 'observed' (the shallows are the water's own leave, not a granted authorization).
export const RIVER_FORD_CENTER = Object.freeze({ x: -99, z: 62 });

// The far (west) bank: reaching dry ground at or beyond this x means crossed.
// The ford lands here; an authorized/reconciled deep swim ends here too.
export const RIVER_FAR_SHORE_X = -106;

// The offering place: the shore stone at the anchor, where the presence first
// noticed the player. Bringing the gathered token here and offering (interact)
// is the offer. Radius keeps it a place, not a pixel.
export const RIVER_OFFERING_STONE = Object.freeze({ x: -67, z: 73 });
export const RIVER_OFFERING_RADIUS = 5;

// Loose river stones on the meadow shore: the natural token. Walking over them
// gathers them (no inventory, no UI); carrying them to the offering stone is the
// offer. Validated dry for seed 20061.
export const RIVER_TOKEN_SPOT = Object.freeze({ x: -52, z: 66 });
export const RIVER_TOKEN_RADIUS = 4;

// Slice text, rendered by the slice's own message element (never the MMO HUD).
export const RIVER_MANIFESTATION_LINE = 'A água percebe sua pressa.';
export const RIVER_MANIFESTATION_COLOR = '#9fd8d4';
export const RIVER_RESISTANCE_LINE = 'A água não abre caminho.';
export const RIVER_RESISTANCE_COLOR = '#7fc6d6';
export const RIVER_TOKEN_LINE = 'Você recolhe pedras do leito.';
export const RIVER_TOKEN_COLOR = '#cdd8c8';
export const RIVER_OFFER_ACCEPTED_LINE = 'A água abre caminho.';
export const RIVER_OFFER_ACCEPTED_COLOR = '#b9e4d8';
export const RIVER_OFFER_REJECTED_LINE = 'A água devolve o que você oferece.';
export const RIVER_OFFER_REJECTED_COLOR = '#7fc6d6';
export const RIVER_OFFER_EMPTY_LINE = 'Suas mãos estão vazias.';
export const RIVER_OFFER_EMPTY_COLOR = '#cdd8c8';
export const RIVER_CROSSED_FORD_LINE = 'Onde a água é rasa, ela deixa passar.';
export const RIVER_CROSSED_FORD_COLOR = '#b9e4d8';
export const RIVER_CROSSED_OPEN_LINE = 'A água se abre para você.';
export const RIVER_CROSSED_OPEN_COLOR = '#b9e4d8';
export const RIVER_RECONCILED_LINE = 'A água cede, mas não esquece.';
export const RIVER_RECONCILED_COLOR = '#8fb8c0';

// The territory's memory of the player. authorized (offered while observed) and
// reconciled (humbled by the ford after offending) both permit the deep channel;
// reconciled keeps the memory of the offense and never becomes authorized.
export type RiverRelation = 'unknown' | 'observed' | 'authorized' | 'offended' | 'reconciled';

export interface RiverSpiritState {
  relation: RiverRelation;
  hasManifested: boolean;
  manifestedAtTick: number | null;
  // Gathered the river-stone token (consumed by an accepted offer).
  hasToken: boolean;
  // Edge-tracking for the far-shore crossing (rising edge = a crossing event).
  beyondFarShore: boolean;
  // The active current, or null when the body is under the player's control.
  current: {
    startTick: number;
    from: { x: number; z: number };
    to: { x: number; z: number };
  } | null;
}

export function createRiverSpiritState(): RiverSpiritState {
  return {
    relation: 'unknown',
    hasManifested: false,
    manifestedAtTick: null,
    hasToken: false,
    beyondFarShore: false,
    current: null,
  };
}

// Result of an offer attempt at the stone (driven by the interact key, not the
// per-tick update).
export type RiverOfferOutcome = 'accepted' | 'rejected' | 'empty' | 'tooFar' | 'none';

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
export type RiverSpiritEffect =
  | 'none'
  | 'manifested'
  | 'tokenGathered'
  | 'resistStarted'
  | 'carrying'
  | 'released'
  | 'crossedFord'
  | 'crossedOpen'
  | 'reconciled';

export function isRiverCurrentActive(state: RiverSpiritState): boolean {
  return state.current !== null;
}

// authorized and reconciled permit the deep channel: the current does not seize
// the body there. unknown never resists (the manifestation comes first).
function deepChannelPermitted(relation: RiverRelation): boolean {
  return relation === 'authorized' || relation === 'reconciled';
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

function emitLine(host: RiverSpiritHost, text: string, color: string): void {
  host.emit({ type: 'log', text, color, pid: host.playerId });
}

// A deliberate offer at the shore stone, driven by the interact key (NOT the
// per-tick update): the player must be at the stone, carrying the gathered
// token. In 'observed' the offer is accepted (-> authorized). In 'offended' the
// same simple offer is refused (the water first wants humility, not a gift).
// Never grants XP/gold/items/abilities; it only changes the river's relation.
export function attemptOffer(state: RiverSpiritState, host: RiverSpiritHost): RiverOfferOutcome {
  const p = host.player;
  const atStone =
    Math.hypot(p.pos.x - RIVER_OFFERING_STONE.x, p.pos.z - RIVER_OFFERING_STONE.z) <=
    RIVER_OFFERING_RADIUS;
  if (!atStone) return 'tooFar';
  if (!state.hasToken) {
    emitLine(host, RIVER_OFFER_EMPTY_LINE, RIVER_OFFER_EMPTY_COLOR);
    return 'empty';
  }
  if (state.relation === 'observed') {
    state.relation = 'authorized';
    state.hasToken = false; // the token is given, not kept
    emitLine(host, RIVER_OFFER_ACCEPTED_LINE, RIVER_OFFER_ACCEPTED_COLOR);
    return 'accepted';
  }
  if (state.relation === 'offended') {
    // Refused: the offense is not undone by a gift. The token stays in hand.
    emitLine(host, RIVER_OFFER_REJECTED_LINE, RIVER_OFFER_REJECTED_COLOR);
    return 'rejected';
  }
  return 'none'; // unknown/authorized/reconciled: nothing to offer
}

// Call once per tick, BEFORE host.tick(). Advances an active current (ignoring
// player intent, which the host also stops applying), else resolves, in order:
// the first manifestation, gathering the token, a far-shore crossing (which is
// how the three paths conclude), and a forced deep-water entry.
export function updateRiverSpirit(
  state: RiverSpiritState,
  host: RiverSpiritHost,
): RiverSpiritEffect {
  const p = host.player;

  // Far-shore edge tracking, updated every tick regardless of branch: dry ground
  // at or beyond the far bank. Rising edge (below) is a crossing event.
  const isBeyond = p.pos.x <= RIVER_FAR_SHORE_X && host.groundPos(p.pos.x, p.pos.z).y > WATER_LEVEL;
  const wasBeyond = state.beyondFarShore;
  state.beyondFarShore = isBeyond;

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
      emitLine(host, RIVER_MANIFESTATION_LINE, RIVER_MANIFESTATION_COLOR);
      return 'manifested';
    }
  }

  // 3) Gather the token by walking over the loose river stones (once).
  if (!state.hasToken) {
    const d = Math.hypot(p.pos.x - RIVER_TOKEN_SPOT.x, p.pos.z - RIVER_TOKEN_SPOT.z);
    if (d <= RIVER_TOKEN_RADIUS) {
      state.hasToken = true;
      emitLine(host, RIVER_TOKEN_LINE, RIVER_TOKEN_COLOR);
      return 'tokenGathered';
    }
  }

  // 4) Far-shore crossing (rising edge). How it reads depends on the relation:
  //    offended -> reconciled (the humble ford after the offense); authorized ->
  //    the opened channel; observed -> the ford (relation unchanged).
  if (isBeyond && !wasBeyond) {
    if (state.relation === 'offended') {
      state.relation = 'reconciled';
      emitLine(host, RIVER_RECONCILED_LINE, RIVER_RECONCILED_COLOR);
      return 'reconciled';
    }
    if (state.relation === 'authorized') {
      emitLine(host, RIVER_CROSSED_OPEN_LINE, RIVER_CROSSED_OPEN_COLOR);
      return 'crossedOpen';
    }
    if (state.relation === 'observed') {
      emitLine(host, RIVER_CROSSED_FORD_LINE, RIVER_CROSSED_FORD_COLOR);
      return 'crossedFord';
    }
  }

  // 5) Forced deep-water entry: only when the deep channel is NOT permitted
  //    (observed or offended) and the presence is perceived. The water takes the
  //    body. authorized/reconciled swim across untouched; unknown never resists.
  if (
    state.relation !== 'unknown' &&
    !deepChannelPermitted(state.relation) &&
    isDeepWaterUnder(host, p.pos.x, p.pos.z)
  ) {
    state.relation = 'offended';
    state.current = {
      startTick: host.tickCount,
      from: { x: p.pos.x, z: p.pos.z },
      to: { x: RIVER_RETURN_POS.x, z: RIVER_RETURN_POS.z },
    };
    emitLine(host, RIVER_RESISTANCE_LINE, RIVER_RESISTANCE_COLOR);
    return 'resistStarted';
  }

  return 'none';
}
