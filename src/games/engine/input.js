// @ts-check
// Unified input manager: Keyboard, Mouse, Touch (virtual joystick/buttons, swipe), and Gamepad API

import { Vec2 } from './math.js';

/**
 * @typedef {Record<string, string[]>} ActionMap
 */

export const DEFAULT_ACTION_MAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  action: ['Space', 'KeyZ', 'Enter'],
  action2: ['KeyX', 'ShiftLeft', 'ShiftRight'],
  pause: ['Escape', 'KeyP'],
  restart: ['KeyR'],
};

export class InputManager {
  /**
   * @param {HTMLElement} target
   * @param {object} [options]
   * @param {ActionMap} [options.actionMap]
   * @param {import('./renderer.js').GameRenderer} [options.renderer]
   * @param {boolean} [options.enableTouchControls]
   */
  constructor(target, { actionMap = DEFAULT_ACTION_MAP, renderer, enableTouchControls = true } = {}) {
    this.target = target;
    this.renderer = renderer;
    /** @type {ActionMap} */
    this.actionMap = { ...actionMap };

    // Keys
    /** @type {Set<string>} */
    this.keysDown = new Set();
    /** @type {Set<string>} */
    this.keysJustPressed = new Set();
    /** @type {Set<string>} */
    this.keysJustReleased = new Set();

    // Mouse / Pointer
    this.pointerPos = new Vec2(0, 0);
    this.pointerDown = false;
    this.pointerJustPressed = false;
    this.pointerJustReleased = false;

    // Gamepad
    this.gamepadIndex = -1;
    /** @type {Set<number>} */
    this.gamepadButtonsDown = new Set();
    /** @type {Set<number>} */
    this.gamepadButtonsJustPressed = new Set();
    this.gamepadAxes = [0, 0, 0, 0];

    // Touch & Virtual Controls
    this.enableTouchControls = enableTouchControls;
    this.touchJoystick = {
      active: false,
      base: new Vec2(0, 0),
      current: new Vec2(0, 0),
      dir: new Vec2(0, 0),
      radius: 50,
      identifier: -1,
    };
    this.touchSwipe = {
      startX: 0,
      startY: 0,
      startTime: 0,
    };
    /** @type {string | null} */
    this.lastSwipe = null;

    /** @type {(() => void)[]} */
    this.cleanups = [];

    this._bindEvents();
  }

  /**
   * Rebinds action mapping
   * @param {string} action
   * @param {string[]} codes
   */
  bindAction(action, codes) {
    this.actionMap[action] = [...codes];
  }

  _bindEvents() {
    const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
      // Don't intercept shortcuts if modifying text inputs outside canvas
      if (['INPUT', 'TEXTAREA'].includes(/** @type {HTMLElement} */ (e.target)?.tagName)) return;

      const code = e.code;
      if (!this.keysDown.has(code)) {
        this.keysJustPressed.add(code);
      }
      this.keysDown.add(code);

      // Prevent scrolling on game control keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }
    };

    const onKeyUp = (/** @type {KeyboardEvent} */ e) => {
      const code = e.code;
      this.keysDown.delete(code);
      this.keysJustReleased.add(code);
    };

    const onPointerDown = (/** @type {PointerEvent} */ e) => {
      this.pointerDown = true;
      this.pointerJustPressed = true;
      this._updatePointerPos(e.clientX, e.clientY);
    };

    const onPointerMove = (/** @type {PointerEvent} */ e) => {
      this._updatePointerPos(e.clientX, e.clientY);
    };

    const onPointerUp = (/** @type {PointerEvent} */ e) => {
      this.pointerDown = false;
      this.pointerJustReleased = true;
      this._updatePointerPos(e.clientX, e.clientY);
    };

    // Touch swipes & virtual joystick
    const onTouchStart = (/** @type {TouchEvent} */ e) => {
      if (!this.enableTouchControls || e.touches.length === 0) return;
      const touch = e.touches[0];
      this.touchSwipe.startX = touch.clientX;
      this.touchSwipe.startY = touch.clientY;
      this.touchSwipe.startTime = performance.now();

      // If touching the left half of the target, start virtual joystick
      const rect = this.target.getBoundingClientRect();
      const relX = touch.clientX - rect.left;
      if (relX < rect.width * 0.5 && !this.touchJoystick.active) {
        this.touchJoystick.active = true;
        this.touchJoystick.identifier = touch.identifier;
        this.touchJoystick.base.set(touch.clientX, touch.clientY);
        this.touchJoystick.current.set(touch.clientX, touch.clientY);
        this.touchJoystick.dir.set(0, 0);
      }
    };

    const onTouchMove = (/** @type {TouchEvent} */ e) => {
      if (this.touchJoystick.active) {
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          if (t.identifier === this.touchJoystick.identifier) {
            this.touchJoystick.current.set(t.clientX, t.clientY);
            const dx = t.clientX - this.touchJoystick.base.x;
            const dy = t.clientY - this.touchJoystick.base.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 10) {
              this.touchJoystick.dir.set(dx / dist, dy / dist);
            } else {
              this.touchJoystick.dir.set(0, 0);
            }
          }
        }
      }
    };

    const onTouchEnd = (/** @type {TouchEvent} */ e) => {
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - this.touchSwipe.startX;
        const dy = touch.clientY - this.touchSwipe.startY;
        const dt = performance.now() - this.touchSwipe.startTime;
        const dist = Math.hypot(dx, dy);

        // Detect swipe: minimum 30px distance within 400ms
        if (dist > 30 && dt < 400) {
          if (Math.abs(dx) > Math.abs(dy)) {
            this.lastSwipe = dx > 0 ? 'right' : 'left';
          } else {
            this.lastSwipe = dy > 0 ? 'down' : 'up';
          }
        }

        if (this.touchJoystick.active && touch.identifier === this.touchJoystick.identifier) {
          this.touchJoystick.active = false;
          this.touchJoystick.identifier = -1;
          this.touchJoystick.dir.set(0, 0);
        }
      }
    };

    // Gamepad connection
    const onGamepadConnected = (/** @type {GamepadEvent} */ e) => {
      this.gamepadIndex = e.gamepad.index;
    };
    const onGamepadDisconnected = (/** @type {GamepadEvent} */ e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = -1;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this.target.addEventListener('pointerdown', onPointerDown);
    this.target.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    this.target.addEventListener('touchstart', onTouchStart, { passive: true });
    this.target.addEventListener('touchmove', onTouchMove, { passive: true });
    this.target.addEventListener('touchend', onTouchEnd, { passive: true });

    window.addEventListener('gamepadconnected', onGamepadConnected);
    window.addEventListener('gamepaddisconnected', onGamepadDisconnected);

    this.cleanups.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      this.target.removeEventListener('pointerdown', onPointerDown);
      this.target.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      this.target.removeEventListener('touchstart', onTouchStart);
      this.target.removeEventListener('touchmove', onTouchMove);
      this.target.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('gamepadconnected', onGamepadConnected);
      window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
    });
  }

  _updatePointerPos(clientX, clientY) {
    if (this.renderer) {
      this.pointerPos.copy(this.renderer.screenToWorld(clientX, clientY));
    } else {
      const rect = this.target.getBoundingClientRect();
      this.pointerPos.set(clientX - rect.left, clientY - rect.top);
    }
  }

  /**
   * Polls gamepad hardware and clears single-frame justPressed/justReleased sets.
   * Call this at the end of each frame update.
   */
  update() {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
    this.pointerJustPressed = false;
    this.pointerJustReleased = false;
    this.lastSwipe = null;

    this._pollGamepad();
  }

  _pollGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    const gp = this.gamepadIndex >= 0 ? gamepads[this.gamepadIndex] : gamepads.find((g) => g !== null);

    if (!gp) {
      this.gamepadButtonsDown.clear();
      this.gamepadButtonsJustPressed.clear();
      return;
    }

    this.gamepadButtonsJustPressed.clear();
    for (let i = 0; i < gp.buttons.length; i++) {
      const pressed = gp.buttons[i].pressed || gp.buttons[i].value > 0.5;
      if (pressed) {
        if (!this.gamepadButtonsDown.has(i)) {
          this.gamepadButtonsJustPressed.add(i);
        }
        this.gamepadButtonsDown.add(i);
      } else {
        this.gamepadButtonsDown.delete(i);
      }
    }

    this.gamepadAxes = [...gp.axes];
  }

  /**
   * Triggers haptic rumble if supported on active gamepad.
   * @param {number} [durationMs]
   * @param {number} [weakMagnitude]
   * @param {number} [strongMagnitude]
   */
  async vibrate(durationMs = 150, weakMagnitude = 0.5, strongMagnitude = 0.5) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gp = navigator.getGamepads()[this.gamepadIndex];
    // @ts-ignore
    const actuator = gp?.vibrationActuator;
    if (actuator?.playEffect) {
      try {
        await actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude,
          strongMagnitude,
        });
      } catch {
        // Ignore haptics failure
      }
    }
  }

  /**
   * Checks if an action is currently pressed down (keyboard, gamepad, or touch).
   * @param {string} action
   * @returns {boolean}
   */
  isDown(action) {
    const codes = this.actionMap[action];
    if (codes && codes.some((code) => this.keysDown.has(code))) return true;

    // Gamepad mappings
    if (action === 'left' && (this.gamepadButtonsDown.has(14) || this.gamepadAxes[0] < -0.4)) return true;
    if (action === 'right' && (this.gamepadButtonsDown.has(15) || this.gamepadAxes[0] > 0.4)) return true;
    if (action === 'up' && (this.gamepadButtonsDown.has(12) || this.gamepadAxes[1] < -0.4)) return true;
    if (action === 'down' && (this.gamepadButtonsDown.has(13) || this.gamepadAxes[1] > 0.4)) return true;
    if (action === 'action' && (this.gamepadButtonsDown.has(0) || this.gamepadButtonsDown.has(2))) return true;
    if (action === 'action2' && (this.gamepadButtonsDown.has(1) || this.gamepadButtonsDown.has(3))) return true;
    if (action === 'pause' && this.gamepadButtonsDown.has(9)) return true;

    // Virtual touch joystick direction
    if (this.touchJoystick.active) {
      if (action === 'left' && this.touchJoystick.dir.x < -0.3) return true;
      if (action === 'right' && this.touchJoystick.dir.x > 0.3) return true;
      if (action === 'up' && this.touchJoystick.dir.y < -0.3) return true;
      if (action === 'down' && this.touchJoystick.dir.y > 0.3) return true;
    }

    return false;
  }

  /**
   * Checks if an action was just triggered this frame.
   * @param {string} action
   * @returns {boolean}
   */
  justPressed(action) {
    const codes = this.actionMap[action];
    if (codes && codes.some((code) => this.keysJustPressed.has(code))) return true;

    if (action === 'left' && this.gamepadButtonsJustPressed.has(14)) return true;
    if (action === 'right' && this.gamepadButtonsJustPressed.has(15)) return true;
    if (action === 'up' && this.gamepadButtonsJustPressed.has(12)) return true;
    if (action === 'down' && this.gamepadButtonsJustPressed.has(13)) return true;
    if (action === 'action' && (this.gamepadButtonsJustPressed.has(0) || this.gamepadButtonsJustPressed.has(2)))
      return true;
    if (action === 'action2' && (this.gamepadButtonsJustPressed.has(1) || this.gamepadButtonsJustPressed.has(3)))
      return true;
    if (action === 'pause' && this.gamepadButtonsJustPressed.has(9)) return true;

    if (this.lastSwipe === action) return true;

    return false;
  }

  /**
   * Alias for isDown()
   * @param {string} action
   * @returns {boolean}
   */
  isActionDown(action) {
    return this.isDown(action);
  }

  /**
   * Alias for isDown()
   * @param {string} action
   * @returns {boolean}
   */
  isActionActive(action) {
    return this.isDown(action);
  }

  /**
   * Alias for justPressed()
   * @param {string} action
   * @returns {boolean}
   */
  isActionJustPressed(action) {
    return this.justPressed(action);
  }

  /**
   * Alias for justPressed()
   * @param {string} action
   * @returns {boolean}
   */
  wasActionJustPressed(action) {
    return this.justPressed(action);
  }

  /**
   * Returns continuous axis value in [-1, 1]
   * @param {'horizontal' | 'vertical'} axis
   */
  getAxis(axis) {
    let val = 0;
    if (axis === 'horizontal') {
      if (this.isDown('left')) val -= 1;
      if (this.isDown('right')) val += 1;
      if (Math.abs(this.gamepadAxes[0]) > 0.2) val = this.gamepadAxes[0];
      if (this.touchJoystick.active) val = this.touchJoystick.dir.x;
    } else if (axis === 'vertical') {
      if (this.isDown('up')) val -= 1;
      if (this.isDown('down')) val += 1;
      if (Math.abs(this.gamepadAxes[1]) > 0.2) val = this.gamepadAxes[1];
      if (this.touchJoystick.active) val = this.touchJoystick.dir.y;
    }
    return Math.max(-1, Math.min(1, val));
  }

  /**
   * Draws virtual on-screen joystick if active.
   * @param {CanvasRenderingContext2D} ctx
   */
  renderTouchControls(ctx) {
    if (!this.touchJoystick.active) return;
    const { base, current, radius } = this.touchJoystick;

    ctx.save();
    // Base circle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(base.x, base.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Thumbstick handle
    const dx = current.x - base.x;
    const dy = current.y - base.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, radius);
    const angle = Math.atan2(dy, dx);
    const hx = base.x + Math.cos(angle) * clampedDist;
    const hy = base.y + Math.sin(angle) * clampedDist;

    ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(hx, hy, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  dispose() {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
  }
}
