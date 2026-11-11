// @ts-check
import { createGameShell, gsButton, gsSelect } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { CANVAS_H, CANVAS_W, TRACKS, createRacerState, stepRacer } from './logic.js';
import './styles.css';

const APP_ID = 'nexus.racer';

export const commands = {
  'racer.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  racer: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-racer' });
  const { t, root, audio } = shell;
  await shell.load();

  let trackIdx = 0;
  let state = createRacerState(trackIdx);
  let animId = 0;
  let lastTime = performance.now();

  const input = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
  };

  /** @type {{ x: number, y: number, alpha: number }[]} */
  const skidMarks = [];

  // Top Bar HUD
  const lapEl = h('b', {}, `${state.player.lap}/${state.totalLaps}`);
  const timeEl = h('b', {}, '0.00s');
  const bestLapEl = h('b', {}, '–');
  const speedEl = h('b', {}, '0 km/h');
  const posEl = h('b', {}, '1st');

  const hud = h(
    'div',
    { class: 'nx-racer-hud' },
    h('div', {}, t('hud.pos') + ':', posEl),
    h('div', {}, t('hud.lap') + ':', lapEl),
    h('div', {}, t('hud.time') + ':', timeEl),
    h('div', {}, t('hud.bestLap') + ':', bestLapEl),
    h('div', {}, t('hud.speed') + ':', speedEl),
  );

  const trackSelect = gsSelect(
    TRACKS.map((track, idx) => ({ value: String(idx), label: track.name })),
    '0',
    (val) => {
      trackIdx = Number(val);
      newRace();
    },
    { 'aria-label': t('actions.selectTrack') },
  );

  const bar = h(
    'div',
    { class: 'nx-racer-bar' },
    hud,
    h('span', { style: 'flex: 1' }),
    trackSelect,
    gsButton(t('actions.restart'), () => newRace()),
    gsButton(shell.labels().stats, () =>
      shell.statsDialog(
        TRACKS.map((tr) => ({ mode: tr.id, label: tr.name })),
        { time: true, score: false },
      ),
    ),
    gsButton('⏸', () => shell.pause(), { 'aria-label': shell.labels().pause }),
  );

  // Main Canvas
  const canvas = /** @type {HTMLCanvasElement} */ (
    h('canvas', {
      class: 'nx-racer-canvas',
      width: CANVAS_W,
      height: CANVAS_H,
      'data-testid': 'racer-canvas',
      tabindex: '0',
    })
  );
  const ctx2d = canvas.getContext('2d');
  const main = h('div', { class: 'nx-racer-main' }, canvas);

  root.append(bar, main);

  function newRace() {
    state = createRacerState(trackIdx);
    skidMarks.length = 0;
    updateHUD();
    canvas.focus();
  }

  function updateHUD() {
    lapEl.textContent = `${Math.min(state.player.lap, state.totalLaps)}/${state.totalLaps}`;
    timeEl.textContent = `${state.raceTime.toFixed(2)}s`;
    bestLapEl.textContent = Number.isFinite(state.player.bestLap) ? `${state.player.bestLap.toFixed(2)}s` : '–';
    speedEl.textContent = `${Math.round(Math.abs(state.player.speed) * 0.7)} km/h`;

    // Calculate position
    const sorted = [...state.allCars].sort((a, b) => {
      if (b.lap !== a.lap) return b.lap - a.lap;
      return b.currentWaypoint - a.currentWaypoint;
    });
    const playerRank = sorted.indexOf(state.player) + 1;
    const suffixes = ['st', 'nd', 'rd', 'th'];
    posEl.textContent = `${playerRank}${suffixes[playerRank - 1] || 'th'}`;
  }

  // Driving Controls
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.throttle = true;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.brake = true;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = true;
    if (e.key === 'r' || e.key === 'R') newRace();
  });

  canvas.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.throttle = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.brake = false;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = false;
  });

  // Render Loop
  function render() {
    if (!ctx2d) return;

    // Track Background
    ctx2d.fillStyle = '#060912';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Track Surface
    const wps = state.track.waypoints;
    const len = wps.length;

    ctx2d.strokeStyle = '#1e293b';
    ctx2d.lineWidth = state.track.roadWidth * 2;
    ctx2d.lineCap = 'round';
    ctx2d.lineJoin = 'round';
    ctx2d.beginPath();
    ctx2d.moveTo(wps[0].x, wps[0].y);
    for (let i = 1; i < len; i++) ctx2d.lineTo(wps[i].x, wps[i].y);
    ctx2d.closePath();
    ctx2d.stroke();

    // Road Edge Glowing Neon Lines
    ctx2d.strokeStyle = '#38bdf8';
    ctx2d.lineWidth = 3;
    ctx2d.stroke();

    // Center Dashed Line
    ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx2d.lineWidth = 2;
    ctx2d.setLineDash([12, 12]);
    ctx2d.stroke();
    ctx2d.setLineDash([]);

    // Start / Finish Line Checkered Bar
    const startWp = wps[0];
    const nextWp = wps[1];
    const perpAngle = Math.atan2(nextWp.y - startWp.y, nextWp.x - startWp.x) + Math.PI / 2;
    const halfW = state.track.roadWidth;
    ctx2d.strokeStyle = '#f8fafc';
    ctx2d.lineWidth = 6;
    ctx2d.beginPath();
    ctx2d.moveTo(startWp.x - Math.cos(perpAngle) * halfW, startWp.y - Math.sin(perpAngle) * halfW);
    ctx2d.lineTo(startWp.x + Math.cos(perpAngle) * halfW, startWp.y + Math.sin(perpAngle) * halfW);
    ctx2d.stroke();

    // Draw Skid Marks
    for (let i = skidMarks.length - 1; i >= 0; i--) {
      const sm = skidMarks[i];
      sm.alpha -= 0.008;
      if (sm.alpha <= 0) {
        skidMarks.splice(i, 1);
        continue;
      }
      ctx2d.fillStyle = `rgba(15, 23, 42, ${sm.alpha})`;
      ctx2d.fillRect(sm.x - 2, sm.y - 2, 4, 4);
    }

    // Draw Ghost Replay Car (if available)
    if (state.bestLapGhost.length > 0) {
      const currentLapTime = state.raceTime - state.player.lapStartTime;
      const sample = state.bestLapGhost.find((s) => s.time >= currentLapTime);
      if (sample) {
        drawCar(sample.x, sample.y, sample.angle, '#38bdf8', true);
      }
    }

    // Draw AI Opponent Cars
    for (const ai of state.aiCars) {
      drawCar(ai.x, ai.y, ai.angle, ai.color, false);
    }

    // Draw Player Car
    drawCar(state.player.x, state.player.y, state.player.angle, state.player.color, false);

    // Countdown / Status Overlay
    if (!state.started) {
      ctx2d.fillStyle = '#00f0ff';
      ctx2d.font = 'bold 36px monospace';
      ctx2d.textAlign = 'center';
      const text = state.countdown > 1 ? String(Math.ceil(state.countdown - 1)) : t('status.go');
      ctx2d.fillText(text, canvas.width / 2, canvas.height / 2);
    }
  }

  function drawCar(x, y, angle, color, isGhost) {
    if (!ctx2d) return;
    ctx2d.save();
    ctx2d.translate(x, y);
    ctx2d.rotate(angle);

    ctx2d.globalAlpha = isGhost ? 0.35 : 1.0;
    ctx2d.fillStyle = color;

    // Car Body
    ctx2d.fillRect(-12, -7, 24, 14);

    // Windshield
    ctx2d.fillStyle = '#0f172a';
    ctx2d.fillRect(0, -5, 6, 10);

    // Headlights
    ctx2d.fillStyle = '#fef08a';
    ctx2d.fillRect(10, -6, 2, 3);
    ctx2d.fillRect(10, 3, 2, 3);

    // Tail lights
    ctx2d.fillStyle = '#ef4444';
    ctx2d.fillRect(-12, -6, 2, 3);
    ctx2d.fillRect(-12, 3, 2, 3);

    ctx2d.restore();
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (!shell.paused && !state.gameOver) {
      stepRacer(state, dt, input);

      // Add skid mark if drifting
      if (Math.abs(state.player.speed) > 180 && (input.left || input.right)) {
        skidMarks.push({ x: state.player.x, y: state.player.y, alpha: 0.6 });
      }

      updateHUD();

      if (state.gameOver) {
        audio.play('victory');
        const sorted = [...state.allCars].sort((a, b) => {
          if (b.lap !== a.lap) return b.lap - a.lap;
          return b.currentWaypoint - a.currentWaypoint;
        });
        const playerRank = sorted.indexOf(state.player) + 1;
        const won = playerRank === 1;

        if (won) ctx.achievements.unlock('racer_first_win');
        if (state.player.bestLap < 30) ctx.achievements.unlock('racer_sub_30');
        if (state.player.driftScore >= 5) ctx.achievements.unlock('racer_drift_master');

        shell.finish({
          won,
          score: Math.max(100, Math.round(5000 / (playerRank * (state.raceTime / 60)))),
          mode: state.track.id,
          time: state.raceTime,
          title: won ? t('status.won') : t('status.finished'),
          scoreText: `Rank #${playerRank} (${state.raceTime.toFixed(2)}s)`,
          onRestart: newRace,
        });
      }
    }

    render();
    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);

  shell.enablePause({
    onRestart: newRace,
    onResume: () => {
      lastTime = performance.now();
      canvas.focus();
    },
  });

  shell.onDispose(() => {
    cancelAnimationFrame(animId);
  });

  newRace();

  return {
    unmount: () => shell.dispose(),
  };
}
