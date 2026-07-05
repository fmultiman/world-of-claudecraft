// E9 guard for the slice-only touch controls (src/river_touch_controls.ts). We
// test the PURE logic (joystick normalization / dead zone / magnitude clamp,
// move-flag mapping, delta -> camera, pitch clamp, the keyboard+touch merge, and
// the current-blocks-input rule) and drive the thin Pointer Events class with tiny
// structural fakes (no jsdom, no browser). Behavioral coverage: return-to-zero on
// release, pointercancel, camera delta + stop-on-release, right-half gating, and
// the interact button firing the shared action.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cameraLookDelta,
  clampCameraPitch,
  JOYSTICK_DEAD_ZONE,
  JOYSTICK_RADIUS_PX,
  joystickMoveFlags,
  mergeMoveInput,
  NEUTRAL_JOYSTICK_FLAGS,
  normalizeJoystick,
  RiverTouchControls,
  resolveSliceMoveInput,
  touchControlsShouldShow,
} from '../src/river_touch_controls';
import type { MoveInput } from '../src/sim/types';
import { emptyMoveInput } from '../src/sim/types';

function mv(partial: Partial<MoveInput>): MoveInput {
  return { ...emptyMoveInput(), ...partial };
}

describe('touchControlsShouldShow', () => {
  it('shows on a coarse pointer', () => {
    expect(touchControlsShouldShow({ coarsePointer: true, maxTouchPoints: 0 })).toBe(true);
  });
  it('shows when touch points are reported', () => {
    expect(touchControlsShouldShow({ coarsePointer: false, maxTouchPoints: 5 })).toBe(true);
  });
  it('is hidden on a conventional desktop', () => {
    expect(touchControlsShouldShow({ coarsePointer: false, maxTouchPoints: 0 })).toBe(false);
  });
});

describe('normalizeJoystick', () => {
  it('returns zero inside the dead zone', () => {
    const v = normalizeJoystick(4, -3, JOYSTICK_RADIUS_PX, JOYSTICK_DEAD_ZONE);
    expect(v).toEqual({ x: 0, y: 0, magnitude: 0 });
  });
  it('returns zero at the exact center', () => {
    expect(normalizeJoystick(0, 0, JOYSTICK_RADIUS_PX, JOYSTICK_DEAD_ZONE)).toEqual({
      x: 0,
      y: 0,
      magnitude: 0,
    });
  });
  it('reaches full magnitude at the radius (dead-zone edge maps to 0, radius to 1)', () => {
    const v = normalizeJoystick(0, -JOYSTICK_RADIUS_PX, JOYSTICK_RADIUS_PX, JOYSTICK_DEAD_ZONE);
    expect(v.magnitude).toBeCloseTo(1, 6);
    expect(v.y).toBeCloseTo(-1, 6);
    expect(v.x).toBeCloseTo(0, 6);
  });
  it('clamps magnitude to 1 beyond the radius', () => {
    const v = normalizeJoystick(0, 400, JOYSTICK_RADIUS_PX, JOYSTICK_DEAD_ZONE);
    expect(v.magnitude).toBeCloseTo(1, 6);
    expect(v.y).toBeCloseTo(1, 6);
  });
  it('preserves direction', () => {
    const v = normalizeJoystick(-JOYSTICK_RADIUS_PX, 0, JOYSTICK_RADIUS_PX, JOYSTICK_DEAD_ZONE);
    expect(v.x).toBeCloseTo(-1, 6);
    expect(v.y).toBeCloseTo(0, 6);
  });
});

describe('joystickMoveFlags', () => {
  it('maps up to forward, down to back (screen convention: up is -y)', () => {
    expect(joystickMoveFlags({ x: 0, y: -1, magnitude: 1 }, 0.35)).toEqual({
      forward: true,
      back: false,
      turnLeft: false,
      turnRight: false,
    });
    expect(joystickMoveFlags({ x: 0, y: 1, magnitude: 1 }, 0.35)).toEqual({
      forward: false,
      back: true,
      turnLeft: false,
      turnRight: false,
    });
  });
  it('maps left/right to turn', () => {
    expect(joystickMoveFlags({ x: -1, y: 0, magnitude: 1 }, 0.35).turnLeft).toBe(true);
    expect(joystickMoveFlags({ x: 1, y: 0, magnitude: 1 }, 0.35).turnRight).toBe(true);
  });
  it('is neutral below the threshold', () => {
    expect(joystickMoveFlags({ x: 0.1, y: -0.1, magnitude: 0.14 }, 0.35)).toEqual(
      NEUTRAL_JOYSTICK_FLAGS,
    );
  });
  it('can fire forward and turn together (an arc)', () => {
    const f = joystickMoveFlags({ x: 0.7, y: -0.7, magnitude: 1 }, 0.35);
    expect(f.forward).toBe(true);
    expect(f.turnRight).toBe(true);
  });
});

describe('cameraLookDelta / clampCameraPitch', () => {
  it('converts px deltas to radians via the sensitivity', () => {
    expect(cameraLookDelta(10, -4, 0.006)).toEqual({ dYaw: 0.06, dPitch: -0.024 });
  });
  it('clamps pitch to the shared camera limits', () => {
    expect(clampCameraPitch(5)).toBeCloseTo(1.35, 6);
    expect(clampCameraPitch(-5)).toBeCloseTo(-0.4, 6);
    expect(clampCameraPitch(0.32)).toBeCloseTo(0.32, 6);
  });
});

describe('mergeMoveInput', () => {
  it('leaves the keyboard untouched when the joystick is neutral', () => {
    const kb = mv({ forward: true, strafeLeft: true, jump: true });
    expect(mergeMoveInput(kb, NEUTRAL_JOYSTICK_FLAGS)).toEqual(kb);
  });
  it('ORs the joystick movement into the keyboard', () => {
    const merged = mergeMoveInput(mv({}), {
      forward: true,
      back: false,
      turnLeft: false,
      turnRight: true,
    });
    expect(merged.forward).toBe(true);
    expect(merged.turnRight).toBe(true);
  });
  it('keeps strafe and jump keyboard-only', () => {
    const merged = mergeMoveInput(mv({ strafeRight: true, jump: true }), {
      forward: true,
      back: false,
      turnLeft: false,
      turnRight: false,
    });
    expect(merged.strafeRight).toBe(true);
    expect(merged.jump).toBe(true);
  });
});

describe('resolveSliceMoveInput', () => {
  it('blocks all input (keyboard AND touch) while the current owns the body', () => {
    const blocked = resolveSliceMoveInput(true, mv({ forward: true }), {
      forward: true,
      back: false,
      turnLeft: true,
      turnRight: false,
    });
    expect(blocked).toEqual(emptyMoveInput());
  });
  it('merges keyboard and touch when not blocked', () => {
    const merged = resolveSliceMoveInput(false, mv({ back: true }), {
      forward: false,
      back: false,
      turnLeft: true,
      turnRight: false,
    });
    expect(merged.back).toBe(true);
    expect(merged.turnLeft).toBe(true);
  });
});

// --- Thin class driven with structural fakes (no DOM) ----------------------

interface FakeEl {
  handlers: Map<string, ((e: unknown) => void)[]>;
  addEventListener(type: string, h: (e: unknown) => void): void;
  removeEventListener(type: string, h: (e: unknown) => void): void;
  setPointerCapture(): void;
  releasePointerCapture(): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  classList: { has(c: string): boolean } & Record<string, unknown>;
  style: Record<string, string>;
}

function fakeEl(rect = { left: 0, top: 0, width: 800, height: 600 }): FakeEl {
  const handlers = new Map<string, ((e: unknown) => void)[]>();
  const set = new Set<string>();
  return {
    handlers,
    addEventListener(type, h) {
      const a = handlers.get(type) ?? [];
      a.push(h);
      handlers.set(type, a);
    },
    removeEventListener(type, h) {
      handlers.set(
        type,
        (handlers.get(type) ?? []).filter((x) => x !== h),
      );
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect() {
      return rect;
    },
    classList: {
      add: (c: string) => set.add(c),
      remove: (c: string) => set.delete(c),
      toggle: (c: string, f?: boolean) => {
        const on = f ?? !set.has(c);
        if (on) set.add(c);
        else set.delete(c);
        return on;
      },
      has: (c: string) => set.has(c),
    },
    style: {},
  };
}

function fire(el: FakeEl, type: string, e: Record<string, unknown>): void {
  const evt = { preventDefault() {}, pointerType: 'touch', ...e } as unknown;
  for (const h of el.handlers.get(type) ?? []) h(evt);
}

function build(isValid = () => false) {
  const joystickBase = fakeEl({ left: 100, top: 400, width: 120, height: 120 }); // center (160,460)
  const joystickKnob = fakeEl();
  const interactButton = fakeEl();
  const cameraSurface = fakeEl({ left: 0, top: 0, width: 800, height: 600 }); // center x = 400
  const camera = { camYaw: 1, camPitch: 0.32 };
  const onInteract = vi.fn();
  const controls = new RiverTouchControls({
    // biome-ignore lint/suspicious/noExplicitAny: structural fakes stand in for DOM
    cameraSurface: cameraSurface as any,
    // biome-ignore lint/suspicious/noExplicitAny: structural fakes stand in for DOM
    joystickBase: joystickBase as any,
    // biome-ignore lint/suspicious/noExplicitAny: structural fakes stand in for DOM
    joystickKnob: joystickKnob as any,
    // biome-ignore lint/suspicious/noExplicitAny: structural fakes stand in for DOM
    interactButton: interactButton as any,
    camera,
    onInteract,
    isInteractValid: isValid,
  });
  return { controls, joystickBase, interactButton, cameraSurface, camera, onInteract };
}

describe('RiverTouchControls (fakes)', () => {
  it('joystick down+move produces analog flags, and release returns to zero', () => {
    const { controls, joystickBase } = build();
    fire(joystickBase, 'pointerdown', { pointerId: 1, clientX: 160, clientY: 460 });
    // Push straight up (dy = -60): forward.
    fire(joystickBase, 'pointermove', { pointerId: 1, clientX: 160, clientY: 400 });
    expect(controls.moveFlags().forward).toBe(true);
    fire(joystickBase, 'pointerup', { pointerId: 1, clientX: 160, clientY: 400 });
    expect(controls.moveFlags()).toEqual(NEUTRAL_JOYSTICK_FLAGS);
  });

  it('pointercancel clears the joystick (no stuck movement)', () => {
    const { controls, joystickBase } = build();
    fire(joystickBase, 'pointerdown', { pointerId: 2, clientX: 100, clientY: 460 }); // push left: turnLeft
    expect(controls.moveFlags().turnLeft).toBe(true);
    fire(joystickBase, 'pointercancel', { pointerId: 2, clientX: 100, clientY: 460 });
    expect(controls.moveFlags()).toEqual(NEUTRAL_JOYSTICK_FLAGS);
  });

  it('right-half drag rotates the camera and stops on release', () => {
    const { controls, cameraSurface, camera } = build();
    fire(cameraSurface, 'pointerdown', { pointerId: 3, clientX: 600, clientY: 300 });
    expect(controls.isCameraDragging()).toBe(true);
    fire(cameraSurface, 'pointermove', { pointerId: 3, clientX: 620, clientY: 300 });
    expect(camera.camYaw).toBeCloseTo(1 - 20 * 0.006, 6); // camYaw -= dx*sens
    fire(cameraSurface, 'pointerup', { pointerId: 3, clientX: 620, clientY: 300 });
    expect(controls.isCameraDragging()).toBe(false);
    const after = camera.camYaw;
    // A move after release must not rotate the camera.
    fire(cameraSurface, 'pointermove', { pointerId: 3, clientX: 700, clientY: 300 });
    expect(camera.camYaw).toBe(after);
  });

  it('a left-half touch does not rotate the camera', () => {
    const { controls, cameraSurface, camera } = build();
    fire(cameraSurface, 'pointerdown', { pointerId: 4, clientX: 100, clientY: 300 });
    expect(controls.isCameraDragging()).toBe(false);
    expect(camera.camYaw).toBe(1);
  });

  it('a mouse pointer never starts a touch camera drag (desktop coexistence)', () => {
    const { controls, cameraSurface } = build();
    fire(cameraSurface, 'pointerdown', {
      pointerId: 5,
      clientX: 600,
      clientY: 300,
      pointerType: 'mouse',
    });
    expect(controls.isCameraDragging()).toBe(false);
  });

  it('the interact button fires the shared action', () => {
    const { interactButton, onInteract } = build();
    fire(interactButton, 'pointerdown', { pointerId: 6, clientX: 700, clientY: 500 });
    expect(onInteract).toHaveBeenCalledTimes(1);
  });

  it('syncInteractHighlight toggles the valid class from the validity predicate', () => {
    let valid = false;
    const { controls, interactButton } = build(() => valid);
    controls.syncInteractHighlight();
    expect(interactButton.classList.has('valid')).toBe(false);
    valid = true;
    controls.syncInteractHighlight();
    expect(interactButton.classList.has('valid')).toBe(true);
  });
});

// --- E10 global safety resets (blur / hidden tab / orientation) --------------
// The module wires window/document listeners only when those globals exist; here
// we stub them so we can fire the captured handlers and assert neutralization.

interface FakeGlobal {
  handlers: Map<string, ((e: unknown) => void)[]>;
  visibilityState?: string;
  addEventListener(type: string, h: (e: unknown) => void): void;
  removeEventListener(type: string, h: (e: unknown) => void): void;
}

function fakeGlobal(): FakeGlobal {
  const handlers = new Map<string, ((e: unknown) => void)[]>();
  return {
    handlers,
    addEventListener(type, h) {
      const a = handlers.get(type) ?? [];
      a.push(h);
      handlers.set(type, a);
    },
    removeEventListener(type, h) {
      handlers.set(
        type,
        (handlers.get(type) ?? []).filter((x) => x !== h),
      );
    },
  };
}

function fireGlobal(g: FakeGlobal, type: string): void {
  for (const h of g.handlers.get(type) ?? []) h({});
}

describe('RiverTouchControls global safety resets (E10)', () => {
  let win: FakeGlobal;
  let doc: FakeGlobal;

  beforeEach(() => {
    win = fakeGlobal();
    doc = fakeGlobal();
    doc.visibilityState = 'visible';
    (globalThis as { window?: unknown }).window = win;
    (globalThis as { document?: unknown }).document = doc;
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = undefined;
    (globalThis as { document?: unknown }).document = undefined;
  });

  it('window.blur releases a held joystick (no stuck movement)', () => {
    const { controls, joystickBase } = build();
    fire(joystickBase, 'pointerdown', { pointerId: 61, clientX: 100, clientY: 460 }); // turnLeft
    expect(controls.moveFlags().turnLeft).toBe(true);
    fireGlobal(win, 'blur');
    expect(controls.moveFlags()).toEqual(NEUTRAL_JOYSTICK_FLAGS);
  });

  it('a hidden tab stops an active camera drag', () => {
    const { controls, cameraSurface } = build();
    fire(cameraSurface, 'pointerdown', { pointerId: 62, clientX: 600, clientY: 300 });
    expect(controls.isCameraDragging()).toBe(true);
    doc.visibilityState = 'hidden';
    fireGlobal(doc, 'visibilitychange');
    expect(controls.isCameraDragging()).toBe(false);
  });

  it('a visibilitychange back to visible does NOT neutralize', () => {
    const { controls, joystickBase } = build();
    fire(joystickBase, 'pointerdown', { pointerId: 63, clientX: 100, clientY: 460 });
    doc.visibilityState = 'visible';
    fireGlobal(doc, 'visibilitychange');
    expect(controls.moveFlags().turnLeft).toBe(true);
  });

  it('orientationchange releases active pointers', () => {
    const { controls, joystickBase } = build();
    fire(joystickBase, 'pointerdown', { pointerId: 64, clientX: 100, clientY: 460 });
    expect(controls.moveFlags().turnLeft).toBe(true);
    fireGlobal(win, 'orientationchange');
    expect(controls.moveFlags()).toEqual(NEUTRAL_JOYSTICK_FLAGS);
  });

  it('dispose detaches the global safety listeners', () => {
    const { controls } = build();
    expect((win.handlers.get('blur') ?? []).length).toBe(1);
    expect((doc.handlers.get('visibilitychange') ?? []).length).toBe(1);
    controls.dispose();
    expect((win.handlers.get('blur') ?? []).length).toBe(0);
    expect((win.handlers.get('orientationchange') ?? []).length).toBe(0);
    expect((doc.handlers.get('visibilitychange') ?? []).length).toBe(0);
  });
});
