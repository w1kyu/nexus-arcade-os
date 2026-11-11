// @ts-check
// Scene / state manager with transitions

/**
 * @typedef {object} Scene
 * @property {string} name
 * @property {(params?: any) => void} [onEnter]
 * @property {(dt: number) => void} [onUpdate]
 * @property {(alpha: number, ctx: CanvasRenderingContext2D) => void} [onRender]
 * @property {() => void} [onExit]
 */

/**
 * @typedef {'none' | 'fade'} TransitionType
 */

export class SceneManager {
  /**
   * @param {import('./renderer.js').GameRenderer} [renderer]
   */
  constructor(renderer) {
    this.renderer = renderer;
    /** @type {Map<string, Scene>} */
    this.scenes = new Map();
    /** @type {Scene | null} */
    this.current = null;
    /** @type {Scene[]} */
    this.stack = [];

    // Transition state
    this.transitioning = false;
    this.transitionProgress = 0;
    this.transitionDuration = 0.3;
    /** @type {TransitionType} */
    this.transitionType = 'none';
    /** @type {(() => void) | null} */
    this.transitionMidpoint = null;
    this.transitionPhase = 'out'; // 'out' then 'in'
  }

  /**
   * Registers a scene with the manager
   * @param {Scene} scene
   */
  register(scene) {
    this.scenes.set(scene.name, scene);
  }

  /**
   * Switches immediately or via transition to a registered scene
   * @param {string} name
   * @param {object} [options]
   * @param {any} [options.params]
   * @param {TransitionType} [options.transition]
   * @param {number} [options.duration]
   */
  switch(name, { params, transition = 'none', duration = 0.25 } = {}) {
    const nextScene = this.scenes.get(name);
    if (!nextScene) {
      throw new Error(`Scene "${name}" not found`);
    }

    if (transition === 'none') {
      this._changeScene(nextScene, params);
      return;
    }

    this.transitioning = true;
    this.transitionType = transition;
    this.transitionDuration = duration;
    this.transitionProgress = 0;
    this.transitionPhase = 'out';
    this.transitionMidpoint = () => {
      this._changeScene(nextScene, params);
      this.transitionPhase = 'in';
      this.transitionProgress = 0;
    };
  }

  /**
   * @param {Scene} nextScene
   * @param {any} [params]
   */
  _changeScene(nextScene, params) {
    if (this.current?.onExit) {
      this.current.onExit();
    }
    this.current = nextScene;
    if (this.current.onEnter) {
      this.current.onEnter(params);
    }
  }

  /**
   * Pushes current scene onto stack and switches to new scene (e.g. pause menu)
   * @param {string} name
   * @param {any} [params]
   */
  push(name, params) {
    if (this.current) {
      this.stack.push(this.current);
    }
    const nextScene = this.scenes.get(name);
    if (!nextScene) throw new Error(`Scene "${name}" not found`);
    this._changeScene(nextScene, params);
  }

  /**
   * Pops top scene from stack and resumes previous scene
   */
  pop() {
    if (this.stack.length === 0) return;
    const prev = this.stack.pop();
    if (prev) {
      this._changeScene(prev);
    }
  }

  /**
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    if (this.transitioning) {
      this.transitionProgress += dt / (this.transitionDuration / 2);
      if (this.transitionProgress >= 1) {
        if (this.transitionPhase === 'out') {
          this.transitionMidpoint?.();
        } else {
          this.transitioning = false;
        }
      }
    }

    if (this.current?.onUpdate) {
      this.current.onUpdate(dt);
    }
  }

  /**
   * @param {number} alpha
   * @param {CanvasRenderingContext2D} ctx
   */
  render(alpha, ctx) {
    if (this.current?.onRender) {
      this.current.onRender(alpha, ctx);
    }

    if (this.transitioning && this.renderer) {
      ctx.save();
      const alphaVal =
        this.transitionPhase === 'out'
          ? Math.min(1, this.transitionProgress)
          : Math.max(0, 1 - this.transitionProgress);

      ctx.fillStyle = `rgba(0, 0, 0, ${alphaVal})`;
      ctx.fillRect(0, 0, this.renderer.virtualWidth, this.renderer.virtualHeight);
      ctx.restore();
    }
  }
}
