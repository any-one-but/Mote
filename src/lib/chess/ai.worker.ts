// Mote thinks about chess here, off to the side, so their face keeps moving
// smoothly while they work out a move.
import { chooseMove } from "./ai.ts";
import { fromFen } from "./rules.ts";
import type { CloseInfo } from "../close-game.ts";

type Ask = { id: number; fen: string; history: string[]; close: CloseInfo };

self.onmessage = (e: MessageEvent<Ask>) => {
  const { id, fen, history, close } = e.data;
  self.postMessage({ id, choice: chooseMove(fromFen(fen), Math.random, history, close) });
};
