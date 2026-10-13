// Mote thinks about checkers here, off to the side, so their face keeps
// moving smoothly while they work out a move.
import { chooseMove } from "./ai.ts";
import type { Board, Side } from "./rules.ts";
import type { CloseInfo } from "../close-game.ts";

type Ask = { id: number; board: Board; side: Side; close: CloseInfo };

self.onmessage = (e: MessageEvent<Ask>) => {
  const { id, board, side, close } = e.data;
  const choice = chooseMove(board, side, Math.random, close);
  self.postMessage({ id, choice });
};
