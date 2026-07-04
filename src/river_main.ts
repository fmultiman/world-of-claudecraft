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
import './styles/index.css';
import { cameraFollowShouldSettle, updateFollowCameraYaw, wrapAngle } from './game/camera_follow';
import { Input } from './game/input';
import { Keybinds } from './game/keybinds';
import { assetsReady } from './render/assets/preload';
import { Renderer } from './render/renderer';
import { RIVER_INITIAL_WORLD_CONTENT, RIVER_WORLD_SEED } from './sim/content/river/initial_world';
import {
  createRiverSpiritState,
  RIVER_MANIFESTATION_LINE,
  updateRiverSpirit,
} from './sim/encounters/river_spirit';
import { Sim } from './sim/sim';
import { DT } from './sim/types';

// Mirror Lake's center (src/sim/content/zone1.ts LAKE): the spawn faces the
// water so the first thing the player sees is the reason the slice exists.
const LAKE_CENTER = { x: -92, z: 88 };

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
  const input = new Input(
    canvas,
    {
      onTab: noop,
      onTargetFriendly: noop,
      onCycleFriendly: noop,
      onAbility: noop,
      onUiKey: noop,
      onEmoteWheel: noop,
      onClickPick: noop,
    },
    keybinds,
  );
  // Start the camera behind the player, matching its lake-facing heading.
  input.camYaw = facing;

  document.body.classList.add('game-active');
  hideBootOverlay();

  // Dev/E2E handle, mirroring main.ts's window.__game for the shipped game.
  (window as unknown as { __river: object }).__river = { sim, renderer, input };

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

    const mouselook = input.isMouselookActive() && !sim.player.dead;
    acc += frameDt;
    let manifestedThisFrame = false;
    while (acc >= DT) {
      Object.assign(sim.moveInput, input.readMoveInput());
      // Under mouselook the camera owns the heading (classic right-mouse turn);
      // otherwise the sim turns the character via moveInput.turnLeft/Right.
      if (mouselook) sim.player.facing = input.camYaw;
      // The presence checks proximity before the tick, so its log event drains
      // in this tick's return (the stream record later steps will consume; the
      // returned edge drives this frame's presentation directly).
      if (updateRiverSpirit(riverSpirit, sim)) manifestedThisFrame = true;
      sim.tick();
      acc -= DT;
    }
    if (manifestedThisFrame) {
      showRiverMessage(RIVER_MANIFESTATION_LINE);
      breatheRiverVeil();
    }

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
