# Turing Machine Simulator

A visual simulator for formal single-tape Turing Machines.

## Features

- **Interactive Infinite Tape**: Visual horizontal tape with head pointer and index numbers.
- **Step-by-Step Simulation**: Step forward, step backward, run, pause, and speed adjustment.
- **State Transition Table**: Displays full $\delta(q, \sigma) = (q', \sigma', D)$ table with active transition highlighting.
- **Preset Machines**:
  - Binary increment (`1011` → `1100`)
  - Palindrome checker
  - Unary addition (`111#11` → `11111`)
  - Busy Beaver champions (2-state and 3-state)
- **Halt & Loop Protection**: Configurable step limits to prevent non-terminating loops.
