# Pathfinding & Maze Lab

An interactive environment for exploring grid pathfinding algorithms and procedural maze generation.

## Supported Algorithms

- **BFS (Breadth-First Search)**: Explores level by level, guarantees shortest unweighted path.
- **DFS (Depth-First Search)**: Explores deep down each branch, does not guarantee shortest path.
- **Dijkstra's Algorithm**: Guarantees optimal path on weighted grids.
- _*A* Search_*: Guided search using Manhattan, Euclidean, or Chebyshev heuristics.
- **Greedy Best-First**: Fast exploration guided purely by distance to goal.
- **Bidirectional BFS**: Searches simultaneously from Start and Goal until frontiers collide.

## Maze Generation

- **Recursive Backtracker**: Long, winding corridors with few dead ends.
- **Randomized Prim's**: Highly branchy mazes with short dead ends.
- **Randomized Kruskal's**: Tree-based spanning maze.
- **Recursive Division**: Generates chambers by recursively bisecting with walls and single doors.
- **Random Terrain**: Generates scattered mud pits and walls.
