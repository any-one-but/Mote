// Close games: how Mote plays by default. No difficulty to pick: Mote plays
// well, but keeps themself just behind you. Whenever they get further ahead
// than they should be, they make a mistake on purpose, and a believable one:
// a move that looks fine at a glance and only goes wrong a few moves later,
// so catching it feels like your good play, not a gift. When you're ahead,
// they play their best and keep the pressure on. How far behind they let
// themself fall grows as the game goes on, and more if an ending drags on
// without anything happening, so you can close it out.
//
// Now and then (decided once per game) Mote is allowed to win: in those games
// they stop holding back once the game is past its middle.

/** What Mote needs to know about the game as a whole. */
export type CloseInfo = {
  /** This is one of the games Mote may win. */
  mayWin: boolean;
  /** Checkers only (a chess position carries its own): moves played, and
   * moves in a row without a capture or a man moving. */
  ply?: number;
  quiet?: number;
};

/** How often a game is one Mote may win. */
export const MAY_WIN = 0.15;

export const rollMayWin = (rand: () => number = Math.random) => rand() < MAY_WIN;

export type Scored<M> = { move: M; score: number };

/**
 * Picks Mote's move from moves scored by a deep look ahead (best first, from
 * Mote's side; moves within `spread` of the best scored exactly). `glance`
 * gives a move's score from a shallow look, if there was one: how good it
 * looks without thinking too hard.
 */
export function pickClose<M>(
  deep: Array<Scored<M>>,
  opts: {
    /** What a pawn or a man is worth in these scores. */
    unit: number;
    /** How far through the game: 0 at the start, 1 near the end, and more
     * the longer an ending drags on. */
    progress: number;
    /** A score above this is a forced win. */
    won: number;
    spread: number;
    glance?: (m: M) => number | undefined;
    mayWin: boolean;
  },
  rand: () => number = Math.random,
): { pick: Scored<M>; slip: boolean } {
  const { unit: u, progress, won, spread, glance, mayWin } = opts;
  const best = deep[0];
  // Equally good best moves are picked between, so games vary.
  const ties = deep.filter((r) => r.score >= best.score - 5);
  const straight = { pick: ties[Math.floor(rand() * ties.length)] ?? best, slip: false };

  // Losing anyway: fight on with the best there is.
  if (best.score < -won) return straight;
  if (mayWin && progress > 0.5) return straight;

  // The most Mote lets themself be ahead: a little early on, slipping to a
  // little behind by the end.
  const ceiling = (0.4 - 1.9 * progress) * u;
  if (best.score <= ceiling) return straight;

  // Ahead of where they should be. Not every time, or it'd look like
  // throwing; the further over, the likelier.
  const over = best.score - ceiling;
  const chance = best.score > won ? 1 : 0.45 + 0.55 * Math.min(1, over / (2 * u));
  if (rand() >= chance) return straight;

  // Where to land: just under the line. A lead Mote already has is given
  // back a couple of pieces' worth at a time; one you've just handed them
  // (a piece left hanging) mostly goes untaken. (A forced win is never
  // taken; the best of the rest is where to start from.)
  const exact = deep.filter((r) => r.score >= best.score - spread && r.score < won);
  if (!exact.length) return straight;
  const top = exact[0].score;
  const target = Math.max(ceiling - 0.5 * u, top - Math.max(2.5 * u, (top - ceiling) * 0.6));
  const near = exact.filter(
    (r) => (r.score < top - 0.2 * u || best.score > won) && Math.abs(r.score - target) <= 1.5 * u,
  );
  if (!near.length) {
    if (best.score > won) return { pick: exact[0], slip: true };
    // An ending that's gone on and on with nothing happening: drift into
    // something a little worse, so it can be finished.
    if (progress >= 1.75 && !mayWin) {
      const worse = deep.find((r) => r.score < top - 0.2 * u);
      if (worse) return { pick: worse, slip: true };
    }
    return straight;
  }

  // Moves that look about as good as the best, at a glance, are the
  // believable mistakes.
  const looks = glance ? deep.map((r) => glance(r.move)).filter((v): v is number => v !== undefined) : [];
  const glanceBest = looks.length ? Math.max(...looks) : undefined;
  const weight = (r: Scored<M>) => {
    const g = glance?.(r.move);
    const believable = glanceBest !== undefined && g !== undefined && glanceBest - g <= 0.6 * u ? 4 : 1;
    return believable * Math.exp(-Math.abs(r.score - target) / (0.6 * u));
  };
  const weights = near.map(weight);
  let roll = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < near.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return { pick: near[i], slip: true };
  }
  return { pick: near[near.length - 1], slip: true };
}
