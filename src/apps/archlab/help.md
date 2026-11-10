# Number & CPU Lab

Educational workbench for computer architecture, binary number formats, and microarchitecture simulation.

## Number Representation

- **Integer Formats**: Unsigned, Sign-Magnitude, One's Complement, and Two's Complement across configurable bit widths (4, 8, 16, 32, 64 bits).
- **ALU Addition & Overflow Flags**: Visualizes full adder chain with Carry ($C$), Overflow ($V$), Zero ($Z$), and Sign ($S$) flags.
- **IEEE 754 Floating-Point Inspector**: Half (16-bit), Single (32-bit), and Double (64-bit) precision breakdown with sign, exponent, and mantissa bit visualizers.
- **Floating Point Rounding Explainer**: Demonstrates why $0.1 + 0.2 \ne 0.3$.
- **Step-by-Step Base Conversion**: Division algorithm for integers and multiplication algorithm for fractional parts.

## Nexus-8 Toy CPU Simulator

- **8-bit Architecture**: Accumulator `A`, registers `B` and `C`, Program Counter `PC`, Stack Pointer `SP`, and status flags.
- **256 Bytes RAM**: Full memory hex grid with real-time inspection.
- **Instruction Cycle**: Visualizes Fetch, Decode, and Execute stages.
- **Integrated Assembler**: Supports labels, arithmetic (`ADD`, `SUB`, `CMP`), jumps (`JMP`, `JZ`, `JNZ`, `JC`, `JNC`), stack operations (`PUSH`, `POP`), memory transfers (`LDR`, `STR`), and I/O (`OUT`).
