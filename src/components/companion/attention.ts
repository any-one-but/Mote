// Split attention: with more than one thing going on, Mote takes turns
// between them. What's playing comes first: it gets the long turns, and the
// pointer and your typing only get a look now and then, the way Mote checks
// in on you. Otherwise each gets a turn in order, the one looked at longest
// ago next.

/** Something going on that Mote can turn to look at. */
export type Focus = "media" | "pointer" | "typing";

/** Whose turn it is next, and for how long (ms from now). */
export function nextTurn(
  candidates: Focus[],
  current: Focus | null,
  lastTurn: Record<Focus, number>,
  rand: () => number = Math.random,
): { focus: Focus; ms: number } {
  const media = candidates.includes("media");
  const others = candidates.filter((c) => c !== current);
  const oldest = (list: Focus[]) => list.reduce((a, b) => (lastTurn[b] < lastTurn[a] ? b : a));
  const focus: Focus = media
    ? current === "media" && others.length
      ? oldest(others)
      : "media"
    : others.length
      ? oldest(others)
      : candidates[0];
  const span = (min: number, max: number) => min + rand() * (max - min);
  const ms = media
    ? focus === "media"
      ? span(6000, 12000)
      : focus === "pointer"
        ? span(900, 1600)
        : span(1400, 2600)
    : focus === "pointer"
      ? span(2500, 5000)
      : span(3000, 5500);
  return { focus, ms };
}
