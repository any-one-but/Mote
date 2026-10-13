import { test } from "node:test";
import assert from "node:assert/strict";
import { distance, understand, type IntentId } from "./converse.ts";

const ALL = new Set<IntentId>([
  "games",
  "chess",
  "checkers",
  "tictactoe",
  "liarsdice",
  "solitaire",
  "files",
  "links",
  "saveLink",
  "settings",
  "help",
  "greet",
  "thanks",
  "howAreYou",
  "pet",
  "cancel",
]);

const heard = (text: string, known: ReadonlySet<IntentId> = ALL, choices?: IntentId[]) => {
  const h = understand(text, { known, choices });
  return h.kind === "unknown" ? "unknown" : `${h.kind}:${h.intent}`;
};

test("swaps count as one edit", () => {
  assert.equal(distance("gmae", "game"), 1);
  assert.equal(distance("game", "game"), 0);
  assert.equal(distance("gatme", "game"), 1);
});

test("plain requests do the thing straight away", () => {
  const cases: Array<[string, string]> = [
    ["game", "do:games"],
    ["games", "do:games"],
    ["I want to play a game", "do:games"],
    ["can we play something", "do:games"],
    ["I'm bored", "do:games"],
    ["chess", "do:chess"],
    ["I want to play chess", "do:chess"],
    ["let's play chess!", "do:chess"],
    ["checkers please", "do:checkers"],
    ["tic tac toe", "do:tictactoe"],
    ["tic-tac-toe", "do:tictactoe"],
    ["tictactoe", "do:tictactoe"],
    ["noughts and crosses", "do:tictactoe"],
    ["liar's dice", "do:liarsdice"],
    ["dice", "do:liarsdice"],
    ["solitaire", "do:solitaire"],
    ["I want to play solitaire", "do:solitaire"],
    ["cards", "do:solitaire"],
    ["play cards", "do:solitaire"],
    ["patience", "do:solitaire"],
    ["clean up my downloads", "do:files"],
    ["help me tidy a folder", "do:files"],
    ["show me a video", "do:links"],
    ["play a video", "do:links"],
    ["something to watch", "do:links"],
    ["how do I save a link", "do:saveLink"],
    ["settings", "do:settings"],
    ["dark mode", "do:settings"],
    ["what can you do", "do:help"],
    ["idk", "do:help"],
    ["help", "do:help"],
    ["hi", "do:greet"],
    ["hey, chess?", "do:chess"],
    ["thanks", "do:thanks"],
    ["how are you", "do:howAreYou"],
    ["nothing", "do:cancel"],
    ["never mind", "do:cancel"],
    ["no thanks", "do:cancel"],
    ["can I pet you", "do:pet"],
  ];
  for (const [text, want] of cases) assert.equal(heard(text), want, text);
});

test("typos get a check first", () => {
  const cases: Array<[string, string]> = [
    ["I want to paaly a gatme", "check:games"],
    ["gmae", "check:games"],
    ["chss", "check:chess"],
    ["chekers", "check:checkers"],
    ["solitare", "check:solitaire"],
  ];
  for (const [text, want] of cases) assert.equal(heard(text), want, text);
});

test("short-cut words and run-together words are understood", () => {
  assert.equal(heard("solitai"), "do:solitaire");
  assert.equal(heard("tictacto"), "do:tictactoe");
  assert.equal(heard("liars dic"), "do:liarsdice");
});

test("a typo-looking ordinary word isn't taken for a keyword", () => {
  assert.equal(heard("same"), "unknown");
  assert.equal(heard("the weather is nice"), "unknown");
  assert.equal(heard("asdfgh"), "unknown");
  assert.equal(heard(""), "unknown");
});

test("don't is respected, and a no doesn't cancel what follows", () => {
  assert.equal(heard("I don't want to play"), "unknown");
  assert.equal(heard("no, chess"), "do:chess");
});

test("two games by name is the games menu", () => {
  assert.equal(heard("chess or checkers"), "do:games");
});

test("menus can be picked from by number", () => {
  const games: IntentId[] = ["checkers", "chess", "tictactoe", "liarsdice", "solitaire"];
  assert.equal(heard("2", ALL, games), "do:chess");
  assert.equal(heard("the first one", ALL, games), "do:checkers");
  assert.equal(heard("last", ALL, games), "do:solitaire");
});

test("anything Mote can't do is as if they never heard of it", () => {
  const known = new Set([...ALL].filter((i) => i !== "files"));
  assert.equal(heard("clean up my downloads", known), "unknown");
  assert.equal(heard("checkers", known), "do:checkers");
});

test("the diet tracker, Local Gallery, snacks and bedtime are gone", () => {
  assert.equal(heard("log calories"), "unknown");
  assert.equal(heard("open local gallery"), "unknown");
  assert.equal(heard("have a cookie"), "unknown");
  assert.equal(heard("go to bed"), "unknown");
});
