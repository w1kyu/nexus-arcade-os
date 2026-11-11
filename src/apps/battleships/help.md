# Battleships

Battleships is a tactical naval combat simulator played on dual 10x10 grids.

## Gameplay

1. **Deployment Phase:**
   - Place all 5 fleet vessels: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), and Destroyer (2).
   - Use Rotate (or press `R`) to toggle orientation between horizontal and vertical.
   - Click "Randomize Fleet" to automatically position your ships.
   - Click "Start Battle" once all vessels are deployed.

2. **Battle Phase:**
   - Click a coordinate on the Enemy Radar grid to fire a naval strike.
   - White pegs denote misses; fiery detonations represent direct hits.
   - Sunk vessels are highlighted in crimson with an alert toast.
   - The AI uses a parity hunt-and-target probability density algorithm to locate your ships.
