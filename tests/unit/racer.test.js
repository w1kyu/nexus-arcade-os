import { describe, it, expect } from 'vitest';
import { TRACKS, createCar, createRacerState, stepRacer } from '../../src/apps/racer/logic.js';

describe('Neon Racer Logic & Vehicle Dynamics', () => {
  it('defines 5 neon racing circuits with waypoints and start grids', () => {
    expect(TRACKS.length).toBeGreaterThanOrEqual(5);
    for (const t of TRACKS) {
      expect(t.id).toBeDefined();
      expect(t.name).toBeDefined();
      expect(t.roadWidth).toBeGreaterThan(30);
      expect(t.waypoints.length).toBeGreaterThanOrEqual(8);
      expect(t.startGrid).toBeDefined();
      expect(t.startGrid.x).toBeGreaterThan(0);
      expect(t.startGrid.y).toBeGreaterThan(0);
    }
  });

  it('initializes car physics and responds to throttle and braking', () => {
    const car = createCar(1, 'Test Car', '#00f0ff', false, 100, 100, 0);
    expect(car.speed).toBe(0);

    const state = createRacerState(0);
    state.started = true; // Skip countdown

    // Accelerate with throttle
    for (let i = 0; i < 10; i++) {
      stepRacer(state, 0.05, { throttle: true, brake: false, left: false, right: false });
    }
    expect(state.player.speed).toBeGreaterThan(50);
    expect(state.player.x).toBeGreaterThan(state.track.startGrid.x);

    // Brake
    const speedBeforeBrake = state.player.speed;
    for (let i = 0; i < 5; i++) {
      stepRacer(state, 0.05, { throttle: false, brake: true, left: false, right: false });
    }
    expect(state.player.speed).toBeLessThan(speedBeforeBrake);
  });

  it('updates steering angles and records drift score', () => {
    const state = createRacerState(0);
    state.started = true;
    state.player.speed = state.player.maxSpeed; // At top speed

    const startAngle = state.player.angle;
    for (let i = 0; i < 10; i++) {
      stepRacer(state, 0.05, { throttle: true, brake: false, left: false, right: true });
    }
    expect(state.player.angle).toBeGreaterThan(startAngle);
    expect(state.player.driftScore).toBeGreaterThan(0);
  });

  it('advances AI opponent cars along waypoints', () => {
    const state = createRacerState(0);
    state.started = true;
    const ai = state.aiCars[0];
    const initialWp = ai.currentWaypoint;

    // Simulate several seconds of AI driving
    for (let i = 0; i < 60; i++) {
      stepRacer(state, 0.05, { throttle: false, brake: false, left: false, right: false });
    }
    expect(ai.speed).toBeGreaterThan(100);
    expect(ai.currentWaypoint).not.toBe(initialWp);
  });

  it('records ghost lap samples during player driving', () => {
    const state = createRacerState(0);
    state.started = true;

    for (let i = 0; i < 10; i++) {
      stepRacer(state, 0.05, { throttle: true, brake: false, left: false, right: false });
    }
    expect(state.currentLapSamples.length).toBeGreaterThan(0);
    const sample = state.currentLapSamples[0];
    expect(sample.x).toBeDefined();
    expect(sample.y).toBeDefined();
    expect(sample.angle).toBeDefined();
  });
});
