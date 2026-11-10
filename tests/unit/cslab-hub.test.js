// @ts-check
import { describe, expect, it } from 'vitest';
import { CSLAB_TOOLS, SYLLABUS_TOPICS, terminal } from '../../src/apps/cslab/index.js';

describe('CS Lab Hub Module', () => {
  it('registers all 8 core computer science educational tools', () => {
    const expectedIds = [
      'nexus.sorting',
      'nexus.pathfinding',
      'nexus.graphlab',
      'nexus.datastructures',
      'nexus.automata',
      'nexus.turing',
      'nexus.circuits',
      'nexus.archlab',
    ];

    expect(CSLAB_TOOLS.length).toBe(8);
    for (const id of expectedIds) {
      const tool = CSLAB_TOOLS.find((t) => t.id === id);
      expect(tool).toBeDefined();
      expect(tool?.name.en).toBeTruthy();
      expect(tool?.name.de).toBeTruthy();
      expect(tool?.description.en).toBeTruthy();
      expect(tool?.description.de).toBeTruthy();
      expect(tool?.badge).toBeTruthy();
      expect(tool?.keywords.length).toBeGreaterThan(0);
    }
  });

  it('provides syllabus topics tracking key exam competencies', () => {
    expect(SYLLABUS_TOPICS.length).toBeGreaterThanOrEqual(8);
    for (const s of SYLLABUS_TOPICS) {
      expect(s.id).toBeTruthy();
      expect(s.text).toBeTruthy();
    }
  });

  it('runs terminal command cslab list with outputs', async () => {
    let out = '';
    const io = {
      args: ['list'],
      stdout: (msg) => (out += msg),
      stderr: () => {},
    };

    const code = await terminal.cslab({}, io);
    expect(code).toBe(0);
    expect(out).toContain('nexus.sorting');
    expect(out).toContain('nexus.archlab');
    expect(out).toContain('nexus.circuits');
  });
});
