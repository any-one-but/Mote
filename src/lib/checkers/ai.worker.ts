// Mote thinks about checkers here, off to the side, so their face keeps
// moving smoothly while they work out a move.
import { chooseMove, type Level } from "./ai.ts";
import type { Board, Side } from "./rules.ts";

type Ask = { id: number; board: Board; side: Side; level: Level };

self.onmessage = (e: MessageEvent<Ask>) => {
  const { id, board, side, level } = e.data;
  const choice = chooseMove(board, side, level);
  self.postMessage({ id, choice });
};
