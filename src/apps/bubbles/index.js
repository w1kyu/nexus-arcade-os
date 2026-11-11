// @ts-check
import { createGameShell, gsButton, gsSelect } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import {
  ARENA_H,
  ARENA_W,
  BUBBLE_COLORS,
  BUBBLE_RADIUS,
  GRID_COLS,
  GRID_ROWS,
  calculateTrajectory,
  createLevelGrid,
  findConnectedCluster,
  findFloatingBubbles,
  getBubbleCenter,
} from './logic.js';
import './styles.css';

const APP_ID = 'nexus.bubbles';

export const commands = {
  'bubbles.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  bubbles: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-bubbles' });
  const { t, root, audio } = shell;
  await shell.load();

  let levelIdx = 0;
  let grid = createLevelGrid(levelIdx);
  let score = 0;
  let shotsCount = 0;
  let aimAngle = -Math.PI / 2; // Aiming straight up initially
  let currentBubbleColor = getRandomColor();
  let nextBubbleColor = getRandomColor();
  let gameOver = false;
  let animId = 0;
  let lastTime = performance.now();

  /** @type {{ x: number, y: number, vx: number, vy: number, color: string } | null} */
  let projectile = null;

  function getRandomColor() {
    return BUBBLE_COLORS[Math.floor(Math.random() * 4)];
  }

  // Top Bar HUD
  const levelEl = h('b', {}, String(levelIdx + 1));
  const scoreEl = h('b', {}, String(score));
  const shotsEl = h('b', {}, String(shotsCount));

  const hud = h(
    'div',
    { class: 'nx-bubbles-hud' },
    h('div', {}, t('hud.level') + ':', levelEl),
    h('div', {}, t('hud.score') + ':', scoreEl),
    h('div', {}, t('hud.shots') + ':', shotsEl),
  );

  const levelSelect = gsSelect(
    Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: `L${i + 1}` })),
    '0',
    (val) => {
      levelIdx = Number(val);
      loadLevel(levelIdx);
    },
    { 'aria-label': t('actions.selectLevel') },
  );

  const bar = h(
    'div',
    { class: 'nx-bubbles-bar' },
    hud,
    h('span', { style: 'flex: 1' }),
    levelSelect,
    gsButton(t('actions.restart'), () => loadLevel(levelIdx)),
    gsButton(shell.labels().stats, () =>
      shell.statsDialog(
        Array.from({ length: 10 }, (_, i) => ({ mode: `lvl_${i + 1}`, label: `L${i + 1}` })),
        { score: true },
      ),
    ),
    gsButton('⏸', () => shell.pause(), { 'aria-label': shell.labels().pause }),
  );

  // Main Canvas
  const canvas = /** @type {HTMLCanvasElement} */ (
    h('canvas', {
      class: 'nx-bubbles-canvas',
      width: ARENA_W,
      height: ARENA_H,
      'data-testid': 'bubbles-canvas',
      tabindex: '0',
    })
  );
  const ctx2d = canvas.getContext('2d');
  const main = h('div', { class: 'nx-bubbles-main' }, canvas);

  root.append(bar, main);

  function loadLevel(idx) {
    grid = createLevelGrid(idx);
    score = 0;
    shotsCount = 0;
    projectile = null;
    currentBubbleColor = getRandomColor();
    nextBubbleColor = getRandomColor();
    gameOver = false;
    updateHUD();
    canvas.focus();
  }

  function updateHUD() {
    levelEl.textContent = String(levelIdx + 1);
    scoreEl.textContent = String(score);
    shotsEl.textContent = String(shotsCount);
  }

  // Aiming & Shooting Events
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Cannon is at bottom center (ARENA_W / 2, ARENA_H - 24)
    const cx = ARENA_W / 2;
    const cy = ARENA_H - 24;
    const angle = Math.atan2(my - cy, mx - cx);

    // Limit angle to upper half with margin
    if (angle < -0.15 && angle > -Math.PI + 0.15) {
      aimAngle = angle;
    }
  });

  canvas.addEventListener('pointerdown', () => {
    if (projectile || gameOver || shell.paused) return;

    // Launch bubble
    const speed = 750;
    projectile = {
      x: ARENA_W / 2,
      y: ARENA_H - 24,
      vx: Math.cos(aimAngle) * speed,
      vy: Math.sin(aimAngle) * speed,
      color: currentBubbleColor,
    };

    currentBubbleColor = nextBubbleColor;
    nextBubbleColor = getRandomColor();
    shotsCount++;
    audio.play('launch');
    updateHUD();
  });

  function snapProjectileToGrid(p) {
    // Find closest cell coordinate
    let bestDist = Infinity;
    let bestR = 0;
    let bestC = 0;

    for (let r = 0; r < GRID_ROWS; r++) {
      const maxCols = r % 2 === 1 ? GRID_COLS - 1 : GRID_COLS;
      for (let c = 0; c < maxCols; c++) {
        if (!grid.has(`${r},${c}`)) {
          const center = getBubbleCenter(r, c);
          const d = Math.hypot(p.x - center.x, p.y - center.y);
          if (d < bestDist) {
            bestDist = d;
            bestR = r;
            bestC = c;
          }
        }
      }
    }

    grid.set(`${bestR},${bestC}`, { r: bestR, c: bestC, color: p.color });

    // Check matches
    const cluster = findConnectedCluster(grid, bestR, bestC);
    if (cluster.length >= 3) {
      audio.play('place');
      score += cluster.length * 40;

      for (const b of cluster) {
        grid.delete(`${b.r},${b.c}`);
      }

      // Check floating bubbles
      const floating = findFloatingBubbles(grid);
      if (floating.length > 0) {
        audio.play('drop');
        score += floating.length * 100;
        if (floating.length >= 10) ctx.achievements.unlock('bubbles_cascade_drop');

        for (const b of floating) {
          grid.delete(`${b.r},${b.c}`);
        }
      }
    } else {
      audio.play('blip');
    }

    updateHUD();

    // Check game outcome
    if (grid.size === 0) {
      gameOver = true;
      audio.play('victory');
      if (levelIdx === 0) ctx.achievements.unlock('bubbles_first_win');

      shell.finish({
        won: true,
        score: score + 1000,
        mode: `lvl_${levelIdx + 1}`,
        scoreText: `${score + 1000} pts (${shotsCount} shots)`,
        onRestart: () => {
          if (levelIdx + 1 < 10) {
            levelIdx++;
            levelSelect.value = String(levelIdx);
          }
          loadLevel(levelIdx);
        },
      });
    } else if (bestR >= GRID_ROWS - 2) {
      gameOver = true;
      audio.play('gameover');

      shell.finish({
        won: false,
        score,
        mode: `lvl_${levelIdx + 1}`,
        scoreText: String(score),
        onRestart: () => loadLevel(levelIdx),
      });
    }
  }

  // Render Loop
  function render() {
    if (!ctx2d) return;

    // Background
    ctx2d.fillStyle = '#060914';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);

    // Aim Guide (bank-shot trajectory)
    if (!projectile && !gameOver) {
      const trajectory = calculateTrajectory(ARENA_W / 2, ARENA_H - 24, aimAngle, 2);
      ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx2d.lineWidth = 2;
      ctx2d.setLineDash([6, 6]);
      ctx2d.beginPath();
      ctx2d.moveTo(trajectory[0].x, trajectory[0].y);
      for (let i = 1; i < trajectory.length; i++) {
        ctx2d.lineTo(trajectory[i].x, trajectory[i].y);
      }
      ctx2d.stroke();
      ctx2d.setLineDash([]);
    }

    // Grid Bubbles
    for (const b of grid.values()) {
      const center = getBubbleCenter(b.r, b.c);
      ctx2d.fillStyle = b.color;
      ctx2d.beginPath();
      ctx2d.arc(center.x, center.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
      ctx2d.fill();

      // Highlight sheen
      ctx2d.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx2d.beginPath();
      ctx2d.arc(center.x - 4, center.y - 4, 4, 0, Math.PI * 2);
      ctx2d.fill();
    }

    // Moving Projectile
    if (projectile) {
      ctx2d.fillStyle = projectile.color;
      ctx2d.beginPath();
      ctx2d.arc(projectile.x, projectile.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
      ctx2d.fill();
    }

    // Cannon & Loaded Bubble at bottom
    ctx2d.fillStyle = currentBubbleColor;
    ctx2d.beginPath();
    ctx2d.arc(ARENA_W / 2, ARENA_H - 24, BUBBLE_RADIUS, 0, Math.PI * 2);
    ctx2d.fill();

    // Next preview bubble
    ctx2d.fillStyle = nextBubbleColor;
    ctx2d.beginPath();
    ctx2d.arc(ARENA_W / 2 - 40, ARENA_H - 20, BUBBLE_RADIUS * 0.7, 0, Math.PI * 2);
    ctx2d.fill();
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (!shell.paused && projectile && !gameOver) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;

      // Bounce off left/right side walls
      if (projectile.x <= BUBBLE_RADIUS) {
        projectile.x = BUBBLE_RADIUS;
        projectile.vx = -projectile.vx;
        audio.play('blip');
      } else if (projectile.x >= ARENA_W - BUBBLE_RADIUS) {
        projectile.x = ARENA_W - BUBBLE_RADIUS;
        projectile.vx = -projectile.vx;
        audio.play('blip');
      }

      // Check collision with ceiling
      let collided = projectile.y <= BUBBLE_RADIUS;

      // Check collision with any existing bubble
      if (!collided) {
        for (const b of grid.values()) {
          const center = getBubbleCenter(b.r, b.c);
          if (Math.hypot(projectile.x - center.x, projectile.y - center.y) < BUBBLE_RADIUS * 1.8) {
            collided = true;
            break;
          }
        }
      }

      if (collided) {
        const p = projectile;
        projectile = null;
        snapProjectileToGrid(p);
      }
    }

    render();
    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);

  shell.enablePause({
    onRestart: () => loadLevel(levelIdx),
  });

  shell.onDispose(() => {
    cancelAnimationFrame(animId);
  });

  loadLevel(0);

  return {
    unmount: () => shell.dispose(),
  };
}
