// @ts-check
// Canvas 2D rendering pipeline with high-DPI scaling, camera with shake, and letterboxing

import { Vec2 } from './math.js';

/**
 * Camera with position, zoom, and screen shake effects.
 */
export class Camera {
  constructor() {
    this.pos = new Vec2(0, 0);
    this.zoom = 1.0;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeElapsed = 0;
    this.shakeOffset = new Vec2(0, 0);
  }

  /**
   * Triggers screen shake
   * @param {number} intensity Max pixel displacement
   * @param {number} duration In seconds
   */
  shake(intensity = 8, duration = 0.3) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeElapsed = 0;
  }

  /**
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    if (this.shakeElapsed < this.shakeDuration) {
      this.shakeElapsed += dt;
      const progress = this.shakeElapsed / this.shakeDuration;
      const currentIntensity = this.shakeIntensity * (1 - progress);
      const angle = Math.random() * Math.PI * 2;
      this.shakeOffset.set(Math.cos(angle) * currentIntensity, Math.sin(angle) * currentIntensity);
    } else {
      this.shakeOffset.set(0, 0);
    }
  }

  /**
   * Applies camera transform to a canvas context
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   */
  apply(ctx, viewportWidth, viewportHeight) {
    ctx.translate(viewportWidth / 2, viewportHeight / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-(this.pos.x + this.shakeOffset.x), -(this.pos.y + this.shakeOffset.y));
  }
}

/**
 * Game renderer wrapping an HTML5 Canvas.
 */
export class GameRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   * @param {number} [options.virtualWidth]
   * @param {number} [options.virtualHeight]
   * @param {boolean} [options.letterbox]
   */
  constructor(canvas, { virtualWidth = 800, virtualHeight = 600, letterbox = true } = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.ctx = ctx;

    this.virtualWidth = virtualWidth;
    this.virtualHeight = virtualHeight;
    this.letterbox = letterbox;

    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.viewport = { x: 0, y: 0, width: virtualWidth, height: virtualHeight, scale: 1 };
    this.camera = new Camera();

    this.resize();
  }

  /**
   * Resizes canvas backing store to high-DPI resolution while maintaining aspect ratio.
   * @param {number} [containerWidth]
   * @param {number} [containerHeight]
   */
  resize(containerWidth, containerHeight) {
    const parent = this.canvas.parentElement;
    const width = containerWidth ?? (parent ? parent.clientWidth : this.virtualWidth);
    const height = containerHeight ?? (parent ? parent.clientHeight : this.virtualHeight);

    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    this.canvas.width = Math.max(1, Math.floor(width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(height * this.dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    if (this.letterbox) {
      const scaleX = width / this.virtualWidth;
      const scaleY = height / this.virtualHeight;
      const scale = Math.min(scaleX, scaleY);

      const vpW = this.virtualWidth * scale;
      const vpH = this.virtualHeight * scale;
      const vpX = (width - vpW) / 2;
      const vpY = (height - vpH) / 2;

      this.viewport = { x: vpX, y: vpY, width: vpW, height: vpH, scale };
    } else {
      this.viewport = { x: 0, y: 0, width, height, scale: 1 };
    }
  }

  /**
   * Converts a screen client pointer coordinate to virtual game world coordinates.
   * @param {number} clientX
   * @param {number} clientY
   * @returns {Vec2}
   */
  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    if (this.letterbox) {
      const vx = (canvasX - this.viewport.x) / this.viewport.scale;
      const vy = (canvasY - this.viewport.y) / this.viewport.scale;
      return new Vec2(Math.max(0, Math.min(this.virtualWidth, vx)), Math.max(0, Math.min(this.virtualHeight, vy)));
    }
    return new Vec2(canvasX, canvasY);
  }

  /**
   * Begins frame: clears canvas, clips to letterbox viewport, and prepares transform.
   * @param {string} [clearColor]
   */
  beginFrame(clearColor = '#05060d') {
    const ctx = this.ctx;
    ctx.save();

    // Clear entire high-DPI canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000000'; // outer letterbox border
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply high-DPI scale and letterbox offset
    ctx.setTransform(
      this.dpr * this.viewport.scale,
      0,
      0,
      this.dpr * this.viewport.scale,
      this.dpr * this.viewport.x,
      this.dpr * this.viewport.y,
    );

    // Clip to virtual play area
    ctx.beginPath();
    ctx.rect(0, 0, this.virtualWidth, this.virtualHeight);
    ctx.clip();

    if (clearColor) {
      ctx.fillStyle = clearColor;
      ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);
    }
  }

  /**
   * Ends frame: restores canvas state.
   */
  endFrame() {
    this.ctx.restore();
  }

  /**
   * Applies camera transform for game entities.
   */
  applyCamera() {
    this.camera.apply(this.ctx, this.virtualWidth, this.virtualHeight);
  }

  /**
   * Renders text using OS sans-serif fonts with optional drop shadow / glow.
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {object} [options]
   * @param {number} [options.size]
   * @param {string} [options.color]
   * @param {CanvasTextAlign} [options.align]
   * @param {CanvasTextBaseline} [options.baseline]
   * @param {string} [options.fontFamily]
   * @param {boolean} [options.bold]
   * @param {string} [options.shadowColor]
   * @param {number} [options.shadowBlur]
   */
  drawText(
    text,
    x,
    y,
    {
      size = 16,
      color = '#ffffff',
      align = 'left',
      baseline = 'middle',
      fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      bold = false,
      shadowColor,
      shadowBlur = 0,
    } = {},
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${fontFamily}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadowColor && shadowBlur > 0) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * Draws a glowing rectangle (cyber/arcade aesthetic).
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} color
   * @param {number} [blur]
   * @param {number} [radius]
   */
  drawGlowRect(x, y, w, h, color, blur = 12, radius = 4) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.restore();
  }
}
