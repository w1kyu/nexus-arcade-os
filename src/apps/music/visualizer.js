// @ts-check
/**
 * Canvas audio visualizer with 5 rendering styles:
 * - bars: frequency spectrum bars with peak caps
 * - circle: radial circular visualizer
 * - waveform: oscilloscope line
 * - bass: bass-reactive particle burst
 * - starfield: 3D warp starfield
 */

export class MusicVisualizer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./player').AudioEngine} engine
   */
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    this.engine = engine;
    /** @type {'bars' | 'circle' | 'waveform' | 'bass' | 'starfield'} */
    this.style = 'bars';
    this.animationId = 0;
    this.isRunning = false;

    // Visualizer state
    this.freqData = new Uint8Array(256);
    this.waveData = new Uint8Array(256);
    this.peakBars = new Float32Array(64);
    this.particles = [];
    this.stars = [];
    this._initStars();
  }

  _initStars() {
    this.stars = [];
    for (let i = 0; i < 150; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 800,
        z: Math.random() * 800,
      });
    }
  }

  setStyle(style) {
    this.style = style;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      if (!this.isRunning) return;
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  render() {
    const { canvas, ctx } = this;
    if (!canvas || !ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    this.engine.getFrequencyData(this.freqData);
    this.engine.getWaveformData(this.waveData);

    ctx.clearRect(0, 0, w, h);

    if (this.style === 'bars') {
      this._renderBars(w, h);
    } else if (this.style === 'circle') {
      this._renderCircle(w, h);
    } else if (this.style === 'waveform') {
      this._renderWaveform(w, h);
    } else if (this.style === 'bass') {
      this._renderBass(w, h);
    } else if (this.style === 'starfield') {
      this._renderStarfield(w, h);
    }
  }

  _renderBars(w, h) {
    const ctx = this.ctx;
    const barCount = 48;
    const barWidth = w / barCount - 2;

    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor((i / barCount) * 160);
      const val = this.freqData[idx] / 255;
      const barHeight = Math.max(4, val * (h - 20));

      // Peak cap decay
      if (val > this.peakBars[i]) {
        this.peakBars[i] = val;
      } else {
        this.peakBars[i] = Math.max(0, this.peakBars[i] - 0.015);
      }
      const peakY = h - this.peakBars[i] * (h - 20) - 4;

      const grad = ctx.createLinearGradient(0, h, 0, h - barHeight);
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(0.7, '#ec4899');
      grad.addColorStop(1, '#06b6d4');

      ctx.fillStyle = grad;
      ctx.fillRect(i * (barWidth + 2) + 1, h - barHeight, barWidth, barHeight);

      // Draw peak dot
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(i * (barWidth + 2) + 1, peakY, barWidth, 2);
    }
  }

  _renderCircle(w, h) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) * 0.45;
    const count = 64;

    ctx.save();
    ctx.translate(cx, cy);

    for (let i = 0; i < count; i++) {
      const rad = (i / count) * Math.PI * 2;
      const idx = Math.floor((i / count) * 180);
      const val = this.freqData[idx] / 255;
      const len = val * (radius * 0.8);

      const x1 = Math.cos(rad) * radius;
      const y1 = Math.sin(rad) * radius;
      const x2 = Math.cos(rad) * (radius + len);
      const y2 = Math.sin(rad) * (radius + len);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `hsl(${(i / count) * 280 + 160}, 90%, 60%)`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Inner glowing circle
    ctx.beginPath();
    ctx.arc(0, 0, radius - 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  _renderWaveform(w, h) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 8;

    const sliceWidth = w / this.waveData.length;
    let x = 0;

    for (let i = 0; i < this.waveData.length; i++) {
      const v = this.waveData[i] / 128.0;
      const y = (v * h) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _renderBass(w, h) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;

    // Calculate bass energy from first 8 frequency bins
    let bass = 0;
    for (let i = 0; i < 8; i++) bass += this.freqData[i];
    bass = bass / (8 * 255);

    // Spawn particles on beat
    if (bass > 0.4 && this.particles.length < 120) {
      for (let p = 0; p < 4; p++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * bass * 8;
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          color: `hsl(${Math.random() * 60 + 280}, 90%, 65%)`,
          size: 2 + Math.random() * 4,
        });
      }
    }

    // Draw central pulsing core
    ctx.beginPath();
    ctx.arc(cx, cy, 20 + bass * 40, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(236, 72, 153, ${0.2 + bass * 0.4})`;
    ctx.fill();

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  _renderStarfield(w, h) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;

    let energy = 0;
    for (let i = 0; i < 32; i++) energy += this.freqData[i];
    energy = energy / (32 * 255);
    const speed = 3 + energy * 18;

    ctx.fillStyle = '#ffffff';

    for (const star of this.stars) {
      star.z -= speed;
      if (star.z <= 0) {
        star.z = 800;
        star.x = (Math.random() - 0.5) * 800;
        star.y = (Math.random() - 0.5) * 800;
      }

      const k = 200 / star.z;
      const px = star.x * k + cx;
      const py = star.y * k + cy;

      if (px >= 0 && px < w && py >= 0 && py < h) {
        const size = Math.max(1, (1 - star.z / 800) * 3.5);
        const alpha = Math.min(1, (1 - star.z / 800) * 1.2);
        ctx.fillStyle = `rgba(165, 180, 252, ${alpha})`;
        ctx.fillRect(px, py, size, size);
      }
    }
  }
}
