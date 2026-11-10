// @ts-check

/**
 * Nexus-8 Toy 8-bit Microarchitecture Engine
 */

export const REG_MAP = {
  A: 0,
  B: 1,
  C: 2,
};

export const REG_NAMES = ['A', 'B', 'C'];

export class Nexus8Cpu {
  constructor() {
    this.memory = new Uint8Array(256);
    this.A = 0;
    this.B = 0;
    this.C = 0;
    this.PC = 0;
    this.SP = 255;
    this.flags = { Z: 0, C: 0, V: 0, N: 0 };
    this.halted = false;
    this.cycles = 0;
    this.stage = 'FETCH'; // FETCH, DECODE, EXECUTE
    /** @type {number[]} */
    this.output = [];
  }

  reset() {
    this.memory.fill(0);
    this.A = 0;
    this.B = 0;
    this.C = 0;
    this.PC = 0;
    this.SP = 255;
    this.flags = { Z: 0, C: 0, V: 0, N: 0 };
    this.halted = false;
    this.cycles = 0;
    this.stage = 'FETCH';
    this.output = [];
  }

  getRegister(idx) {
    if (idx === 0) return this.A;
    if (idx === 1) return this.B;
    if (idx === 2) return this.C;
    return 0;
  }

  setRegister(idx, val) {
    const byte = val & 0xff;
    if (idx === 0) this.A = byte;
    else if (idx === 1) this.B = byte;
    else if (idx === 2) this.C = byte;
  }

  updateFlags(res, carry = 0, overflow = 0) {
    const byte = res & 0xff;
    this.flags.Z = byte === 0 ? 1 : 0;
    this.flags.N = (byte & 0x80) !== 0 ? 1 : 0;
    this.flags.C = carry ? 1 : 0;
    this.flags.V = overflow ? 1 : 0;
  }
}

/**
 * Simple 2-pass mini-assembler for Nexus-8.
 * @param {string} sourceCode
 */
export function assembleNexus8(sourceCode) {
  const lines = sourceCode.split('\n');
  const labels = new Map();
  const binary = new Uint8Array(256);
  const lineMap = new Map(); // byte offset -> source line index

  // Pass 1: Parse instructions & record labels
  let addr = 0;
  const parsedLines = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    let line = lines[lineIdx].trim();
    const commentIdx = line.indexOf(';');
    if (commentIdx >= 0) line = line.substring(0, commentIdx).trim();
    if (!line) continue;

    // Check for label
    const colonIdx = line.indexOf(':');
    if (colonIdx >= 0) {
      const lbl = line.substring(0, colonIdx).trim().toUpperCase();
      labels.set(lbl, addr);
      line = line.substring(colonIdx + 1).trim();
      if (!line) continue;
    }

    const parts = line
      .split(/[,\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const op = parts[0].toUpperCase();
    const args = parts.slice(1);

    parsedLines.push({ lineIdx, addr, op, args });

    // Determine instruction size in bytes
    let size;
    switch (op) {
      case 'HLT':
        size = 1;
        break;
      case 'MOV':
      case 'ADD':
      case 'SUB':
      case 'CMP':
        size = 3;
        break;
      case 'LDR':
      case 'STR':
        size = 3;
        break;
      case 'JMP':
      case 'JZ':
      case 'JNZ':
      case 'JC':
      case 'JNC':
        size = 2;
        break;
      case 'PUSH':
      case 'POP':
      case 'OUT':
        size = 2;
        break;
      default:
        size = 1;
    }
    addr += size;
  }

  // Pass 2: Emit machine code
  for (const item of parsedLines) {
    const { lineIdx, addr: pc, op, args } = item;
    lineMap.set(pc, lineIdx);

    const resolveVal = (valStr) => {
      if (!valStr) return 0;
      const clean = valStr.replace(/[[\]]/g, '').toUpperCase();
      if (labels.has(clean)) return labels.get(clean);
      if (clean.startsWith('0X')) return parseInt(clean.slice(2), 16);
      return parseInt(clean, 10) || 0;
    };

    switch (op) {
      case 'HLT':
        binary[pc] = 0x00;
        break;
      case 'MOV': {
        const dstReg = REG_MAP[args[0].toUpperCase()] ?? 0;
        const srcReg = REG_MAP[args[1]?.toUpperCase()];
        if (srcReg !== undefined) {
          binary[pc] = 0x02; // MOV R, R
          binary[pc + 1] = dstReg;
          binary[pc + 2] = srcReg;
        } else {
          binary[pc] = 0x01; // MOV R, IMM
          binary[pc + 1] = dstReg;
          binary[pc + 2] = resolveVal(args[1]) & 0xff;
        }
        break;
      }
      case 'LDR': {
        const r = REG_MAP[args[0].toUpperCase()] ?? 0;
        binary[pc] = 0x03;
        binary[pc + 1] = r;
        binary[pc + 2] = resolveVal(args[1]) & 0xff;
        break;
      }
      case 'STR': {
        const r = REG_MAP[args[0].toUpperCase()] ?? 0;
        binary[pc] = 0x04;
        binary[pc + 1] = r;
        binary[pc + 2] = resolveVal(args[1]) & 0xff;
        break;
      }
      case 'ADD': {
        const dst = REG_MAP[args[0].toUpperCase()] ?? 0;
        const src = REG_MAP[args[1]?.toUpperCase()];
        if (src !== undefined) {
          binary[pc] = 0x06;
          binary[pc + 1] = dst;
          binary[pc + 2] = src;
        } else {
          binary[pc] = 0x05;
          binary[pc + 1] = dst;
          binary[pc + 2] = resolveVal(args[1]) & 0xff;
        }
        break;
      }
      case 'SUB': {
        const dst = REG_MAP[args[0].toUpperCase()] ?? 0;
        const src = REG_MAP[args[1]?.toUpperCase()];
        if (src !== undefined) {
          binary[pc] = 0x08;
          binary[pc + 1] = dst;
          binary[pc + 2] = src;
        } else {
          binary[pc] = 0x07;
          binary[pc + 1] = dst;
          binary[pc + 2] = resolveVal(args[1]) & 0xff;
        }
        break;
      }
      case 'CMP': {
        const dst = REG_MAP[args[0].toUpperCase()] ?? 0;
        const src = REG_MAP[args[1]?.toUpperCase()];
        if (src !== undefined) {
          binary[pc] = 0x0a;
          binary[pc + 1] = dst;
          binary[pc + 2] = src;
        } else {
          binary[pc] = 0x09;
          binary[pc + 1] = dst;
          binary[pc + 2] = resolveVal(args[1]) & 0xff;
        }
        break;
      }
      case 'JMP':
        binary[pc] = 0x0b;
        binary[pc + 1] = resolveVal(args[0]) & 0xff;
        break;
      case 'JZ':
        binary[pc] = 0x0c;
        binary[pc + 1] = resolveVal(args[0]) & 0xff;
        break;
      case 'JNZ':
        binary[pc] = 0x0d;
        binary[pc + 1] = resolveVal(args[0]) & 0xff;
        break;
      case 'JC':
        binary[pc] = 0x0e;
        binary[pc + 1] = resolveVal(args[0]) & 0xff;
        break;
      case 'JNC':
        binary[pc] = 0x0f;
        binary[pc + 1] = resolveVal(args[0]) & 0xff;
        break;
      case 'PUSH':
        binary[pc] = 0x10;
        binary[pc + 1] = REG_MAP[args[0].toUpperCase()] ?? 0;
        break;
      case 'POP':
        binary[pc] = 0x11;
        binary[pc + 1] = REG_MAP[args[0].toUpperCase()] ?? 0;
        break;
      case 'OUT':
        binary[pc] = 0x12;
        binary[pc + 1] = REG_MAP[args[0].toUpperCase()] ?? 0;
        break;
    }
  }

  return { binary, labels, lineMap };
}

/**
 * Disassembles instruction at given memory PC.
 * @param {Uint8Array} memory
 * @param {number} pc
 */
export function disassembleInstruction(memory, pc) {
  const op = memory[pc];
  switch (op) {
    case 0x00:
      return { text: 'HLT', size: 1 };
    case 0x01:
      return { text: `MOV ${REG_NAMES[memory[pc + 1]]}, ${memory[pc + 2]}`, size: 3 };
    case 0x02:
      return { text: `MOV ${REG_NAMES[memory[pc + 1]]}, ${REG_NAMES[memory[pc + 2]]}`, size: 3 };
    case 0x03:
      return { text: `LDR ${REG_NAMES[memory[pc + 1]]}, [0x${memory[pc + 2].toString(16)}]`, size: 3 };
    case 0x04:
      return { text: `STR ${REG_NAMES[memory[pc + 1]]}, [0x${memory[pc + 2].toString(16)}]`, size: 3 };
    case 0x05:
      return { text: `ADD ${REG_NAMES[memory[pc + 1]]}, ${memory[pc + 2]}`, size: 3 };
    case 0x06:
      return { text: `ADD ${REG_NAMES[memory[pc + 1]]}, ${REG_NAMES[memory[pc + 2]]}`, size: 3 };
    case 0x07:
      return { text: `SUB ${REG_NAMES[memory[pc + 1]]}, ${memory[pc + 2]}`, size: 3 };
    case 0x08:
      return { text: `SUB ${REG_NAMES[memory[pc + 1]]}, ${REG_NAMES[memory[pc + 2]]}`, size: 3 };
    case 0x09:
      return { text: `CMP ${REG_NAMES[memory[pc + 1]]}, ${memory[pc + 2]}`, size: 3 };
    case 0x0a:
      return { text: `CMP ${REG_NAMES[memory[pc + 1]]}, ${REG_NAMES[memory[pc + 2]]}`, size: 3 };
    case 0x0b:
      return { text: `JMP 0x${memory[pc + 1].toString(16)}`, size: 2 };
    case 0x0c:
      return { text: `JZ 0x${memory[pc + 1].toString(16)}`, size: 2 };
    case 0x0d:
      return { text: `JNZ 0x${memory[pc + 1].toString(16)}`, size: 2 };
    case 0x0e:
      return { text: `JC 0x${memory[pc + 1].toString(16)}`, size: 2 };
    case 0x0f:
      return { text: `JNC 0x${memory[pc + 1].toString(16)}`, size: 2 };
    case 0x10:
      return { text: `PUSH ${REG_NAMES[memory[pc + 1]]}`, size: 2 };
    case 0x11:
      return { text: `POP ${REG_NAMES[memory[pc + 1]]}`, size: 2 };
    case 0x12:
      return { text: `OUT ${REG_NAMES[memory[pc + 1]]}`, size: 2 };
    default:
      return { text: `NOP (0x${op.toString(16)})`, size: 1 };
  }
}

/**
 * Generator runner for Nexus-8 CPU simulation.
 * @param {Nexus8Cpu} cpu
 * @param {number} maxCycles
 */
export function* runCpu(cpu, maxCycles = 1000) {
  while (!cpu.halted && cpu.cycles < maxCycles) {
    const pc = cpu.PC;
    const { text, size } = disassembleInstruction(cpu.memory, pc);

    // Yield FETCH stage
    cpu.stage = 'FETCH';
    yield {
      type: 'fetch',
      cycle: cpu.cycles,
      pc,
      instruction: text,
      stage: 'FETCH',
      registers: { A: cpu.A, B: cpu.B, C: cpu.C, PC: cpu.PC, SP: cpu.SP },
      flags: { ...cpu.flags },
      output: [...cpu.output],
      message: `FETCH [0x${pc.toString(16)}]: ${text}`,
    };

    // DECODE stage
    cpu.stage = 'DECODE';
    yield {
      type: 'decode',
      cycle: cpu.cycles,
      pc,
      instruction: text,
      stage: 'DECODE',
      registers: { A: cpu.A, B: cpu.B, C: cpu.C, PC: cpu.PC, SP: cpu.SP },
      flags: { ...cpu.flags },
      output: [...cpu.output],
      message: `DECODE: ${text}`,
    };

    // EXECUTE stage
    cpu.stage = 'EXECUTE';
    const op = cpu.memory[pc];
    let nextPC = (pc + size) & 0xff;

    switch (op) {
      case 0x00: // HLT
        cpu.halted = true;
        break;
      case 0x01: {
        // MOV R, IMM
        const r = cpu.memory[pc + 1];
        const val = cpu.memory[pc + 2];
        cpu.setRegister(r, val);
        break;
      }
      case 0x02: {
        // MOV R, R
        const dst = cpu.memory[pc + 1];
        const src = cpu.memory[pc + 2];
        cpu.setRegister(dst, cpu.getRegister(src));
        break;
      }
      case 0x03: {
        // LDR R, [addr]
        const r = cpu.memory[pc + 1];
        const addr = cpu.memory[pc + 2];
        cpu.setRegister(r, cpu.memory[addr]);
        break;
      }
      case 0x04: {
        // STR R, [addr]
        const r = cpu.memory[pc + 1];
        const addr = cpu.memory[pc + 2];
        cpu.memory[addr] = cpu.getRegister(r);
        break;
      }
      case 0x05: {
        // ADD R, IMM
        const r = cpu.memory[pc + 1];
        const val = cpu.memory[pc + 2];
        const curr = cpu.getRegister(r);
        const sum = curr + val;
        cpu.setRegister(r, sum);
        cpu.updateFlags(sum, sum > 0xff, (curr < 0x80 && val < 0x80 && sum & 0x80) || false);
        break;
      }
      case 0x06: {
        // ADD R, R
        const dst = cpu.memory[pc + 1];
        const src = cpu.memory[pc + 2];
        const curr = cpu.getRegister(dst);
        const val = cpu.getRegister(src);
        const sum = curr + val;
        cpu.setRegister(dst, sum);
        cpu.updateFlags(sum, sum > 0xff);
        break;
      }
      case 0x07: {
        // SUB R, IMM
        const r = cpu.memory[pc + 1];
        const val = cpu.memory[pc + 2];
        const curr = cpu.getRegister(r);
        const diff = curr - val;
        cpu.setRegister(r, diff);
        cpu.updateFlags(diff, curr < val);
        break;
      }
      case 0x08: {
        // SUB R, R
        const dst = cpu.memory[pc + 1];
        const src = cpu.memory[pc + 2];
        const curr = cpu.getRegister(dst);
        const val = cpu.getRegister(src);
        const diff = curr - val;
        cpu.setRegister(dst, diff);
        cpu.updateFlags(diff, curr < val);
        break;
      }
      case 0x09: {
        // CMP R, IMM
        const r = cpu.memory[pc + 1];
        const val = cpu.memory[pc + 2];
        const diff = cpu.getRegister(r) - val;
        cpu.updateFlags(diff, cpu.getRegister(r) < val);
        break;
      }
      case 0x0a: {
        // CMP R, R
        const dst = cpu.memory[pc + 1];
        const src = cpu.memory[pc + 2];
        const diff = cpu.getRegister(dst) - cpu.getRegister(src);
        cpu.updateFlags(diff, cpu.getRegister(dst) < cpu.getRegister(src));
        break;
      }
      case 0x0b: // JMP addr
        nextPC = cpu.memory[pc + 1];
        break;
      case 0x0c: // JZ addr
        if (cpu.flags.Z === 1) nextPC = cpu.memory[pc + 1];
        break;
      case 0x0d: // JNZ addr
        if (cpu.flags.Z === 0) nextPC = cpu.memory[pc + 1];
        break;
      case 0x0e: // JC addr
        if (cpu.flags.C === 1) nextPC = cpu.memory[pc + 1];
        break;
      case 0x0f: // JNC addr
        if (cpu.flags.C === 0) nextPC = cpu.memory[pc + 1];
        break;
      case 0x10: {
        // PUSH R
        const r = cpu.memory[pc + 1];
        cpu.memory[cpu.SP] = cpu.getRegister(r);
        cpu.SP = (cpu.SP - 1) & 0xff;
        break;
      }
      case 0x11: {
        // POP R
        const r = cpu.memory[pc + 1];
        cpu.SP = (cpu.SP + 1) & 0xff;
        cpu.setRegister(r, cpu.memory[cpu.SP]);
        break;
      }
      case 0x12: {
        // OUT R
        const r = cpu.memory[pc + 1];
        cpu.output.push(cpu.getRegister(r));
        break;
      }
      default:
        break;
    }

    cpu.PC = nextPC;
    cpu.cycles++;

    yield {
      type: 'execute',
      cycle: cpu.cycles,
      pc,
      instruction: text,
      stage: 'EXECUTE',
      registers: { A: cpu.A, B: cpu.B, C: cpu.C, PC: cpu.PC, SP: cpu.SP },
      flags: { ...cpu.flags },
      output: [...cpu.output],
      message: `EXECUTE: ${text} -> PC=0x${cpu.PC.toString(16)}`,
    };
  }

  yield {
    type: 'halt',
    cycle: cpu.cycles,
    pc: cpu.PC,
    instruction: 'HLT',
    stage: 'HALTED',
    registers: { A: cpu.A, B: cpu.B, C: cpu.C, PC: cpu.PC, SP: cpu.SP },
    flags: { ...cpu.flags },
    output: [...cpu.output],
    message: `CPU Halted after ${cpu.cycles} cycles. Output: [${cpu.output.join(', ')}]`,
  };
}

export const CPU_PRESETS = {
  counter: {
    name: { en: 'Counter Loop (0 to 5)', de: 'Zählschleife (0 bis 5)' },
    code: `; Counter from 0 to 5\nMOV A, 0\nloop:\n  OUT A\n  ADD A, 1\n  CMP A, 6\n  JNZ loop\nHLT\n`,
  },
  fibonacci: {
    name: { en: 'Fibonacci Sequence', de: 'Fibonacci-Folge' },
    code: `; Fibonacci up to 55\nMOV A, 0\nMOV B, 1\nloop:\n  OUT A\n  MOV C, A\n  ADD C, B\n  MOV A, B\n  MOV B, C\n  CMP A, 55\n  JNC loop\n  OUT A\nHLT\n`,
  },
  memoryStore: {
    name: { en: 'Memory Store & Load', de: 'Speicher schreiben & lesen' },
    code: `; Write to memory address 0x80\nMOV A, 42\nSTR A, [0x80]\nMOV A, 0\nLDR A, [0x80]\nOUT A\nHLT\n`,
  },
};
