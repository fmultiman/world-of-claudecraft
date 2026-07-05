// Vertical slice "O Rio": minimal, slice-only touch controls (E9).
//
// The slice is reachable on the tablet over the LAN but was not playable there:
// river_main.ts only wired keyboard + mouse. This module adds the smallest set of
// touch controls that make it playable on a tablet:
//   1. a left virtual joystick for movement (Pointer Events, touch + pen);
//   2. right-half drag to rotate the camera;
//   3. a contextual "Interagir" button equivalent to the F key.
//
// It is deliberately NOT a general mobile system for the whole game. It never
// touches the global Input class, the Sim, IWorld, the server, the protocol, the
// general renderer, the relational machine, the current, or the three-path rules.
// It only:
//   - reads its own pointer state and produces analog joystick flags that the
//     slice loop OR-merges into the SAME moveInput the keyboard feeds;
//   - applies camera yaw/pitch deltas directly to the camera target (Input's
//     public camYaw/camPitch fields), reusing Input's own pitch limits;
//   - fires the SAME interact callback the keyboard fires (one offer path).
//
// The pure helpers below (normalization, dead zone, magnitude clamp, delta ->
// camera, move merge, visibility) are DOM-free and unit-tested. The class is thin
// glue over Pointer Events, structural enough to drive from tests with tiny fakes.
import type { MoveInput } from './sim/types';
import { emptyMoveInput } from './sim/types';

// Camera pitch limits: identical to src/game/input.ts (applyTouchLookDelta /
// updateTouchLook clamp to [-0.4, 1.35]). Kept in sync deliberately so touch and
// mouse share one range; this module never widens the camera's limits.
export const CAMERA_PITCH_MIN = -0.4;
export const CAMERA_PITCH_MAX = 1.35;

// Joystick tuning. RADIUS is the knob travel in CSS px; DEAD_ZONE and
// MOVE_THRESHOLD are in normalized [0,1] units.
export const JOYSTICK_RADIUS_PX = 56;
export const JOYSTICK_DEAD_ZONE = 0.22;
export const JOYSTICK_MOVE_THRESHOLD = 0.35;

// Camera look sensitivity in radians per CSS px of drag (near Input's mouse
// BASE_LOOK_SENS 0.0045; a touch drag wants a touch more reach).
export const CAMERA_LOOK_SENS = 0.006;

export interface JoystickVector {
  x: number;
  y: number;
  magnitude: number;
}

// Movement flags the joystick can express. y drives forward/back, x drives the
// turn (the slice's keyboard is W/S forward-back + A/D turn, so the stick matches
// it and is self-sufficient for steering without the camera).
export interface JoystickMoveFlags {
  forward: boolean;
  back: boolean;
  turnLeft: boolean;
  turnRight: boolean;
}

export const NEUTRAL_JOYSTICK_FLAGS: Readonly<JoystickMoveFlags> = Object.freeze({
  forward: false,
  back: false,
  turnLeft: false,
  turnRight: false,
});

// Show the controls on coarse-pointer devices or anything reporting touch points;
// hidden on a conventional desktop. Never keyed off the user agent.
export function touchControlsShouldShow(opts: {
  coarsePointer: boolean;
  maxTouchPoints: number;
}): boolean {
  return opts.coarsePointer || opts.maxTouchPoints > 0;
}

// Normalize a raw knob offset (px from the joystick center, screen coords where
// +y is down) into a unit vector with a radial dead zone and a magnitude clamped
// to 1. Below the dead zone returns zero; above it, the magnitude is rescaled so
// the dead-zone edge maps to 0 and the radius edge (and beyond) maps to 1.
export function normalizeJoystick(
  dx: number,
  dy: number,
  radius: number,
  deadZone: number,
): JoystickVector {
  const len = Math.hypot(dx, dy);
  if (len === 0 || radius <= 0) return { x: 0, y: 0, magnitude: 0 };
  const rawMag = Math.min(1, len / radius);
  if (rawMag <= deadZone) return { x: 0, y: 0, magnitude: 0 };
  const scaled = (rawMag - deadZone) / (1 - deadZone);
  const dirX = dx / len;
  const dirY = dy / len;
  return { x: dirX * scaled, y: dirY * scaled, magnitude: scaled };
}

// Map a normalized joystick vector to movement flags (screen convention: up is
// -y). Both axes can fire at once (forward + turn = an arc).
export function joystickMoveFlags(vec: JoystickVector, threshold: number): JoystickMoveFlags {
  return {
    forward: vec.y <= -threshold,
    back: vec.y >= threshold,
    turnLeft: vec.x <= -threshold,
    turnRight: vec.x >= threshold,
  };
}

// Convert a touch drag delta (px) into camera yaw/pitch deltas (radians). Applied
// as camYaw -= dYaw and camPitch += dPitch, matching Input's mouse/touch look.
export function cameraLookDelta(
  dxPx: number,
  dyPx: number,
  sens: number,
): { dYaw: number; dPitch: number } {
  return { dYaw: dxPx * sens, dPitch: dyPx * sens };
}

// Clamp a camera pitch to the shared limits.
export function clampCameraPitch(pitch: number): number {
  return Math.min(CAMERA_PITCH_MAX, Math.max(CAMERA_PITCH_MIN, pitch));
}

// OR the joystick's movement into the keyboard's MoveInput. Strafe stays
// keyboard-only (the joystick expresses turn, not strafe); jump is keyboard-only.
export function mergeMoveInput(keyboard: MoveInput, joystick: JoystickMoveFlags): MoveInput {
  return {
    forward: keyboard.forward || joystick.forward,
    back: keyboard.back || joystick.back,
    turnLeft: keyboard.turnLeft || joystick.turnLeft,
    turnRight: keyboard.turnRight || joystick.turnRight,
    strafeLeft: keyboard.strafeLeft,
    strafeRight: keyboard.strafeRight,
    jump: keyboard.jump,
  };
}

// The slice's per-tick move resolution: when the river current owns the body the
// input is blocked entirely (keyboard AND touch ignored), else keyboard + touch
// merge. This is the single place the "touch respects the current" rule lives.
export function resolveSliceMoveInput(
  blocked: boolean,
  keyboard: MoveInput,
  joystick: JoystickMoveFlags,
): MoveInput {
  if (blocked) return emptyMoveInput();
  return mergeMoveInput(keyboard, joystick);
}

// The camera target the touch drag writes to (Input satisfies this structurally).
export interface TouchCameraTarget {
  camYaw: number;
  camPitch: number;
}

export interface RiverTouchControlsOptions {
  // The game surface; touch/pen pointerdowns on its right half start a camera drag.
  cameraSurface: HTMLElement;
  // The joystick base (origin + capture target) and its moving knob.
  joystickBase: HTMLElement;
  joystickKnob: HTMLElement;
  // The contextual interaction button.
  interactButton: HTMLElement;
  // The camera whose yaw/pitch the drag rotates (the slice's Input).
  camera: TouchCameraTarget;
  // Fires the SAME action as the F key (sets the slice's pendingInteract).
  onInteract: () => void;
  // Whether an offer is currently valid (drives the button highlight only).
  isInteractValid: () => boolean;
}

// Thin Pointer Events glue. All the math lives in the pure helpers above; this
// class only tracks pointer ids, moves the knob, writes camera deltas, and toggles
// the interact highlight. It never reads or writes the sim.
export class RiverTouchControls {
  private readonly o: RiverTouchControlsOptions;
  private joyPointerId: number | null = null;
  private joyVec: JoystickVector = { x: 0, y: 0, magnitude: 0 };
  private joyCenter = { x: 0, y: 0 };
  private camPointerId: number | null = null;
  private camLast = { x: 0, y: 0 };
  private cameraDragging = false;

  constructor(options: RiverTouchControlsOptions) {
    this.o = options;
    const { joystickBase, interactButton, cameraSurface } = options;

    joystickBase.addEventListener('pointerdown', this.onJoyDown, { passive: false });
    joystickBase.addEventListener('pointermove', this.onJoyMove, { passive: false });
    joystickBase.addEventListener('pointerup', this.onJoyUp);
    joystickBase.addEventListener('pointercancel', this.onJoyUp);
    joystickBase.addEventListener('lostpointercapture', this.onJoyUp);

    interactButton.addEventListener('pointerdown', this.onInteractDown, { passive: false });

    cameraSurface.addEventListener('pointerdown', this.onCamDown, { passive: false });
    cameraSurface.addEventListener('pointermove', this.onCamMove, { passive: false });
    cameraSurface.addEventListener('pointerup', this.onCamUp);
    cameraSurface.addEventListener('pointercancel', this.onCamUp);
    cameraSurface.addEventListener('lostpointercapture', this.onCamUp);
  }

  // Current joystick movement flags (neutral when no pointer is down).
  moveFlags(): JoystickMoveFlags {
    if (this.joyPointerId === null) return { ...NEUTRAL_JOYSTICK_FLAGS };
    return joystickMoveFlags(this.joyVec, JOYSTICK_MOVE_THRESHOLD);
  }

  // True while a touch camera drag is active, so the slice loop can pass
  // orbiting=true and stop auto-follow from fighting the drag.
  isCameraDragging(): boolean {
    return this.cameraDragging;
  }

  // Refresh the interact-button highlight from the current validity. Called once
  // per frame by the slice loop. Presentation only.
  syncInteractHighlight(): void {
    this.o.interactButton.classList.toggle('valid', this.o.isInteractValid());
  }

  private isTouchLike(e: PointerEvent): boolean {
    return e.pointerType !== 'mouse';
  }

  // Pointer capture is best-effort: it can throw (synthetic pointers, some
  // browsers) and a capture failure must never break input handling.
  private capture(el: HTMLElement, pointerId: number): void {
    try {
      el.setPointerCapture?.(pointerId);
    } catch {
      /* capture is optional; ignore */
    }
  }

  private release(el: HTMLElement, pointerId: number): void {
    try {
      el.releasePointerCapture?.(pointerId);
    } catch {
      /* release is optional; ignore */
    }
  }

  private onJoyDown = (e: PointerEvent): void => {
    if (!this.isTouchLike(e) || this.joyPointerId !== null) return;
    e.preventDefault();
    const rect = this.o.joystickBase.getBoundingClientRect();
    this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.joyPointerId = e.pointerId;
    this.capture(this.o.joystickBase, e.pointerId);
    this.updateJoy(e.clientX, e.clientY);
  };

  private onJoyMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.joyPointerId) return;
    e.preventDefault();
    this.updateJoy(e.clientX, e.clientY);
  };

  private onJoyUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.joyPointerId) return;
    this.release(this.o.joystickBase, e.pointerId);
    this.joyPointerId = null;
    this.joyVec = { x: 0, y: 0, magnitude: 0 };
    this.moveKnob(0, 0);
  };

  private updateJoy(clientX: number, clientY: number): void {
    const dx = clientX - this.joyCenter.x;
    const dy = clientY - this.joyCenter.y;
    this.joyVec = normalizeJoystick(dx, dy, JOYSTICK_RADIUS_PX, JOYSTICK_DEAD_ZONE);
    // Visual knob: clamp the raw offset to the radius so it never leaves the base.
    const len = Math.hypot(dx, dy);
    const scale = len > JOYSTICK_RADIUS_PX ? JOYSTICK_RADIUS_PX / len : 1;
    this.moveKnob(dx * scale, dy * scale);
  }

  private moveKnob(x: number, y: number): void {
    this.o.joystickKnob.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
  }

  private onInteractDown = (e: PointerEvent): void => {
    // Fire on press for responsiveness; prevent the ghost click / any default.
    e.preventDefault();
    this.o.onInteract();
  };

  private onCamDown = (e: PointerEvent): void => {
    if (!this.isTouchLike(e) || this.camPointerId !== null) return;
    const rect = this.o.cameraSurface.getBoundingClientRect();
    // Right half only; the left half is reserved (empty there does nothing).
    if (e.clientX < rect.left + rect.width / 2) return;
    e.preventDefault();
    this.camPointerId = e.pointerId;
    this.camLast = { x: e.clientX, y: e.clientY };
    this.cameraDragging = true;
    this.capture(this.o.cameraSurface, e.pointerId);
  };

  private onCamMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.camPointerId) return;
    e.preventDefault();
    const dx = e.clientX - this.camLast.x;
    const dy = e.clientY - this.camLast.y;
    this.camLast = { x: e.clientX, y: e.clientY };
    const { dYaw, dPitch } = cameraLookDelta(dx, dy, CAMERA_LOOK_SENS);
    this.o.camera.camYaw -= dYaw;
    this.o.camera.camPitch = clampCameraPitch(this.o.camera.camPitch + dPitch);
  };

  private onCamUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.camPointerId) return;
    this.release(this.o.cameraSurface, e.pointerId);
    this.camPointerId = null;
    this.cameraDragging = false;
  };

  // Detach every listener and drop pointer state. Not strictly needed for the
  // page-lifetime slice, but keeps the controls a clean, disposable add-on.
  dispose(): void {
    const { joystickBase, interactButton, cameraSurface } = this.o;
    joystickBase.removeEventListener('pointerdown', this.onJoyDown);
    joystickBase.removeEventListener('pointermove', this.onJoyMove);
    joystickBase.removeEventListener('pointerup', this.onJoyUp);
    joystickBase.removeEventListener('pointercancel', this.onJoyUp);
    joystickBase.removeEventListener('lostpointercapture', this.onJoyUp);
    interactButton.removeEventListener('pointerdown', this.onInteractDown);
    cameraSurface.removeEventListener('pointerdown', this.onCamDown);
    cameraSurface.removeEventListener('pointermove', this.onCamMove);
    cameraSurface.removeEventListener('pointerup', this.onCamUp);
    cameraSurface.removeEventListener('pointercancel', this.onCamUp);
    cameraSurface.removeEventListener('lostpointercapture', this.onCamUp);
    this.joyPointerId = null;
    this.camPointerId = null;
    this.cameraDragging = false;
  }
}
