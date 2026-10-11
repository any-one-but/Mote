// Mote thinks about chess here, off to the side, so their face keeps moving
// smoothly while they work out a move.
import { chooseMove, type Level } from "./ai.ts";
import { fromFen } from "./rules.ts";

type Ask = { id: number; fen: string; level: Level; history: string[] };

self.onmessage = (e: MessageEvent<Ask>) => {
  const { id, fen, level, history } = e.data;
  self.postMessage({ id, choice: chooseMove(fromFen(fen), level, Math.random, history) });
};
