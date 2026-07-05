// Vertical slice "O Rio": isolated offline bootstrap (E3).
//
// This entry deliberately does NOT reuse src/main.ts startGame. That bootstrap
// is ~1700 lines coupled to the landing/login DOM, the full HUD template
// (#game-ui-template in index.html), click-to-move, mobile overlays, and the
// online path; and importing src/main.ts executes the landing flow at module
// scope (wireStartScreens/startSitePresence/initHomepageMusic). Instead this
// file composes the same public seams the main game uses (Sim with the E2
// InitialWorldContent seam, Renderer, Input/Keybinds, camera_follow) into the
// smallest offline loop that proves the slice boots the engine with an
// injected world. Deliberately absent in E3 (documented limitations, not
// oversights): the Hud (needs the game-ui-template markup; E4+ decides what
// surface the slice needs), click-to-move, gamepad, touch controls, audio,
// perf overlay, and every online path. Unifying this with main.ts's bootstrap
// into a shared module is future work once the slice's real needs are known.
import * as THREE from 'three';
import './styles/index.css';
import { cameraFollowShouldSettle, updateFollowCameraYaw, wrapAngle } from './game/camera_follow';
import { Input } from './game/input';
import { Keybinds } from './game/keybinds';
import { assetsReady } from './render/assets/preload';
import { Renderer } from './render/renderer';
import {
  isCrossingEffect,
  offerHintVisible,
  RIVER_CONCLUSION_LINE,
  RIVER_INITIAL_HINT,
  RIVER_OFFER_HINT_TEXT,
  tokenStonesVisible,
} from './river_hints';
import { createRiverPresence, riverPresenceMode } from './river_presence_visual';
import { RIVER_INITIAL_WORLD_CONTENT, RIVER_WORLD_SEED } from './sim/content/river/initial_world';
import {
  attemptOffer,
  createRiverSpiritState,
  isRiverCurrentActive,
  RIVER_CROSSED_FORD_LINE,
  RIVER_CROSSED_OPEN_LINE,
  RIVER_FORD_CENTER,
  RIVER_MANIFESTATION_LINE,
  RIVER_OFFER_ACCEPTED_LINE,
  RIVER_OFFER_EMPTY_LINE,
  RIVER_OFFER_REJECTED_LINE,
  RIVER_RECONCILED_LINE,
  RIVER_RESISTANCE_LINE,
  RIVER_TOKEN_LINE,
  RIVER_TOKEN_SPOT,
  updateRiverSpirit,
} from './sim/encounters/river_spirit';
import { Sim } from './sim/sim';
import { DT, emptyMoveInput } from './sim/types';

// Mirror Lake's center (src/sim/content/zone1.ts LAKE): the spawn faces the
// water so the first thing the player sees is the reason the slice exists.
const LAKE_CENTER = { x: -92, z: 88 };

// E7 legibility cues: small procedural stones placed in the slice renderer's own
// scene (presentation only; never a Sim entity, never loot). Grey stones mark
// where the token can be gathered; pale stones mark the shallow ford so the safe
// crossing reads to the eye. Deterministic layout (fixed offsets, no rng).
function stone(sim: Sim, x: number, z: number, r: number, color: number, lift: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(r),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }),
  );
  mesh.position.set(x, sim.groundPos(x, z).y + lift, z);
  mesh.rotation.set(x * 0.7, z * 0.9, x * 0.3); // deterministic tumble
  return mesh;
}

interface SliceCues {
  tokenStones: THREE.Group;
}

function buildSliceCues(scene: THREE.Scene, sim: Sim): SliceCues {
  const tokenStones = new THREE.Group();
  const tokenOffsets: [number, number, number][] = [
    [0, 0, 0.5],
    [1.1, 0.6, 0.35],
    [-0.9, 0.8, 0.4],
    [0.4, -1.0, 0.3],
    [-0.6, -0.7, 0.28],
  ];
  for (const [dx, dz, r] of tokenOffsets) {
    tokenStones.add(
      stone(sim, RIVER_TOKEN_SPOT.x + dx, RIVER_TOKEN_SPOT.z + dz, r, 0x8a8a86, r * 0.6),
    );
  }
  scene.add(tokenStones);

  // Ford stones span the shallow neck (x -96..-102 at z 62), lifted to poke just
  // above the waterline so the crossing reads as steppable shallows.
  const fordStones = new THREE.Group();
  for (let i = 0; i <= 6; i++) {
    const x = RIVER_FORD_CENTER.x - 3 + i; // -102 .. -96
    const z = RIVER_FORD_CENTER.z + (i % 2 === 0 ? 0.4 : -0.4);
    fordStones.add(stone(sim, x, z, 0.34, 0xb8c4c0, 0.55));
  }
  scene.add(fordStones);

  return { tokenStones };
}

function setStatus(text: string): void {
  const status = document.getElementById('river-status');
  if (status) status.textContent = text;
}

function hideBootOverlay(): void {
  const overlay = document.getElementById('river-boot');
  if (overlay) overlay.style.display = 'none';
}

// The slice's one-line message surface (#river-message in river.html): fade in,
// hold, fade out. Deliberately tiny and slice-owned; NOT the MMO HUD, not a
// toast system. Reused by later steps for every line the territory speaks.
let messageHideTimer: number | null = null;
function showRiverMessage(text: string, holdMs = 5200): void {
  const el = document.getElementById('river-message');
  if (!el) return;
  if (messageHideTimer !== null) window.clearTimeout(messageHideTimer);
  el.textContent = text;
  el.classList.add('show');
  messageHideTimer = window.setTimeout(() => {
    el.classList.remove('show');
    messageHideTimer = null;
  }, holdMs);
}

// One ambient "breath" of the water's presence (#river-veil): a soft screen
// tint that eases in and back out via CSS transitions. Pointer-events: none,
// so it never blocks play; cool water tones, nothing that reads as damage.
let veilHideTimer: number | null = null;
function breatheRiverVeil(inMs = 2300): void {
  const el = document.getElementById('river-veil');
  if (!el) return;
  if (veilHideTimer !== null) window.clearTimeout(veilHideTimer);
  el.classList.add('show');
  veilHideTimer = window.setTimeout(() => {
    el.classList.remove('show');
    veilHideTimer = null;
  }, inMs);
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const nameplates = document.getElementById('nameplates') as HTMLDivElement | null;
  if (!canvas || !nameplates) {
    setStatus('Erro: elementos de jogo ausentes na pagina.');
    return;
  }

  setStatus('Carregando o vale...');
  await assetsReady((done, total) => setStatus(`Carregando o vale... ${done}/${total}`));

  const sim = new Sim({
    seed: RIVER_WORLD_SEED,
    // Temporary TECHNICAL placeholder for the slice, not a design decision:
    // the Sim requires an existing class, and warrior needs no pet, no form,
    // and no special setup. The Neofito's real identity is future work.
    playerClass: 'warrior',
    playerName: 'Neofito',
    world: RIVER_INITIAL_WORLD_CONTENT,
  });
  // Cosmetic only: face the spawn toward Mirror Lake (angleTo convention,
  // atan2(dx, dz)) so the water reads as the destination from the first frame.
  const facing = Math.atan2(LAKE_CENTER.x - sim.player.pos.x, LAKE_CENTER.z - sim.player.pos.z);
  sim.player.facing = facing;
  sim.player.prevFacing = facing;

  // The river presence (E4): host-driven scenario state, one per Sim session.
  // updateRiverSpirit runs before each tick below; nothing inside Sim knows it.
  const riverSpirit = createRiverSpiritState();

  const keybinds = new Keybinds('river:neofito');
  let renderer: Renderer;
  try {
    renderer = new Renderer(sim, canvas, nameplates);
  } catch (err) {
    setStatus(`Erro ao iniciar o renderizador (WebGL): ${String(err)}`);
    return;
  }
  const noop = (): void => {};
  // The offer is edge-triggered by the interact key; the loop consumes this each
  // frame. Local to the slice's own InputCallbacks; the shared Input is untouched.
  let pendingInteract = false;
  const input = new Input(
    canvas,
    {
      onTab: noop,
      onTargetFriendly: noop,
      onCycleFriendly: noop,
      onAbility: noop,
      onUiKey: (key) => {
        if (key === 'interact') pendingInteract = true;
      },
      onEmoteWheel: noop,
      onClickPick: noop,
    },
    keybinds,
  );
  // Start the camera behind the player, matching its lake-facing heading.
  input.camYaw = facing;

  document.body.classList.add('game-active');
  hideBootOverlay();

  // E7 playtest cues, in the slice renderer's own scene (presentation only).
  const cues = buildSliceCues(renderer.scene, sim);
  // E8 localized river presence: a small, experimental water manifestation over
  // the water at the anchor. Presentation only (never a Sim entity, never in the
  // spatial grid, never a collider); it READS the river's relation each frame and
  // reflects it, and never mutates the sim. Starts dormant (hidden) until the
  // river manifests.
  const presence = createRiverPresence(renderer.scene);
  const hintEl = document.getElementById('river-hint');
  if (hintEl) hintEl.textContent = RIVER_OFFER_HINT_TEXT;
  // One-time spatial-intent line at boot: fades and does not reappear.
  showRiverMessage(RIVER_INITIAL_HINT);
  let concluded = false;

  // Dev/E2E handle, mirroring main.ts's window.__game for the shipped game.
  (window as unknown as { __river: object }).__river = {
    sim,
    renderer,
    input,
    spirit: riverSpirit,
    presence,
  };

  // Fixed-step offline loop: the trimmed sibling of main.ts's offline arm
  // (no hud/click-move/perf/online). The sim ticks at DT (20 Hz) behind an
  // accumulator; the renderer interpolates with alpha = acc / DT.
  let last = performance.now();
  let acc = 0;
  let lastInterpFacing: number | null = null;
  function frame(now: number): void {
    requestAnimationFrame(frame);
    let frameDt = (now - last) / 1000;
    last = now;
    if (frameDt > 0.25) frameDt = 0.25;

    // Offer at the shore stone (interact key), edge-triggered, not tick-aligned.
    if (pendingInteract) {
      pendingInteract = false;
      const outcome = attemptOffer(riverSpirit, sim);
      if (outcome === 'accepted') {
        showRiverMessage(RIVER_OFFER_ACCEPTED_LINE);
        breatheRiverVeil();
      } else if (outcome === 'rejected') {
        showRiverMessage(RIVER_OFFER_REJECTED_LINE);
        breatheRiverVeil(2600);
      } else if (outcome === 'empty') {
        showRiverMessage(RIVER_OFFER_EMPTY_LINE);
      }
    }

    const mouselook = input.isMouselookActive() && !sim.player.dead;
    acc += frameDt;
    while (acc >= DT) {
      // The presence runs BEFORE the tick: it may start/advance the current and
      // move the body directly. Its returned effect drives presentation and
      // tells us when the water, not the player, owns the body this tick.
      const effect = updateRiverSpirit(riverSpirit, sim);
      const riverOwnsBody = isRiverCurrentActive(riverSpirit) || effect === 'released';
      if (riverOwnsBody) {
        // Input blocked: the current owns displacement, so the tick must not
        // apply player intent (and facing is left to the camera). Local to the
        // slice; the shared Input/controls are untouched.
        Object.assign(sim.moveInput, emptyMoveInput());
      } else {
        Object.assign(sim.moveInput, input.readMoveInput());
        // Under mouselook the camera owns the heading (classic right-mouse
        // turn); otherwise the sim turns the character via turnLeft/Right.
        if (mouselook) sim.player.facing = input.camYaw;
      }
      sim.tick();
      if (effect === 'manifested') {
        showRiverMessage(RIVER_MANIFESTATION_LINE);
        breatheRiverVeil();
      } else if (effect === 'tokenGathered') {
        showRiverMessage(RIVER_TOKEN_LINE);
      } else if (effect === 'resistStarted') {
        showRiverMessage(RIVER_RESISTANCE_LINE);
        // A stronger, longer breath for the water taking the body.
        breatheRiverVeil(2900);
      } else if (effect === 'crossedFord') {
        showRiverMessage(RIVER_CROSSED_FORD_LINE);
        breatheRiverVeil();
      } else if (effect === 'crossedOpen') {
        showRiverMessage(RIVER_CROSSED_OPEN_LINE);
        breatheRiverVeil();
      } else if (effect === 'reconciled') {
        showRiverMessage(RIVER_RECONCILED_LINE);
        // A wary, cooler breath: the water yields but keeps the memory.
        breatheRiverVeil(2600);
      }
      // One-time closing beat on reaching the far bank by any valid path,
      // after the path-specific line has had its moment.
      if (!concluded && isCrossingEffect(effect)) {
        concluded = true;
        window.setTimeout(() => showRiverMessage(RIVER_CONCLUSION_LINE), 5500);
      }
      acc -= DT;
    }

    // E7 cues reflect the module's truth: the river-stone cue hides once the
    // token is gathered; the interaction hint shows only at the stone with it.
    cues.tokenStones.visible = tokenStonesVisible(riverSpirit.hasToken);
    const showHint = offerHintVisible(riverSpirit.hasToken, sim.player.pos.x, sim.player.pos.z);
    if (hintEl) hintEl.classList.toggle('show', showHint);

    // E8 presence reflects the river's truth (relation + active current); it never
    // feeds back into the sim. dormant until manifested; the active current reads
    // as the offended (turbulent) face.
    presence.setMode(
      riverPresenceMode(
        riverSpirit.relation,
        riverSpirit.hasManifested,
        isRiverCurrentActive(riverSpirit),
      ),
    );
    presence.update(frameDt);

    const pp = sim.player;
    const interpFacing = pp.prevFacing + wrapAngle(pp.facing - pp.prevFacing) * (acc / DT);
    const follow = updateFollowCameraYaw({
      camYaw: input.camYaw,
      interpFacing,
      frameDt,
      lastInterpFacing,
      mouselook: input.isMouselookActive(),
      moving: cameraFollowShouldSettle(input.readMoveInput(), false),
      clickMoving: false,
      // Mouse Camera mode is not wired in the slice yet (no settings menu).
      cameraDriven: false,
      orbiting: input.leftDown && input.isCameraDragActive(),
    });
    input.camYaw = follow.camYaw;
    lastInterpFacing = follow.lastInterpFacing;

    renderer.camYaw = input.camYaw;
    renderer.camPitch = input.camPitch;
    renderer.camDist = input.camDist;
    renderer.sync(acc / DT, frameDt, null);
  }
  requestAnimationFrame(frame);
}

void boot().catch((err) => {
  setStatus(`Erro ao iniciar a slice: ${String(err)}`);
});
