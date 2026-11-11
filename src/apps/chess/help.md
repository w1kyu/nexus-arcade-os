# Nexus Chess

Nexus Chess is a tactical chess game featuring an alpha-beta search AI with iterative deepening running in a Web Worker, tactical puzzles, PGN import and export, board flipping, and local 2-player modes.

## Rules & Features

- **Full Chess Invariants:** Castling (kingside and queenside), en passant captures, pawn promotion (Queen, Rook, Bishop, Knight), and checkmate detection.
- **Draw Detection:** Automatic detection of threefold repetition, the 50-move rule, stalemate, and insufficient material (K vs K, K+B vs K, K+N vs K).
- **Engine AI:** 5 adjustable strength levels powered by iterative deepening, piece-square tables, and alpha-beta pruning.
- **Tactical Puzzles:** Curated tactics puzzles testing decisive moves and mate sequences.
- **PGN Portability:** Export games to standard Portable Game Notation (PGN) or import games and positions.
- **Move History:** Step through the move list to review key positions.
