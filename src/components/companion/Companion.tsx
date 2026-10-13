import { useCallback, useEffect, useRef, useState } from "react";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import { Face } from "@/components/companion/Face";
import { Helper, type Gift } from "@/components/companion/Helper";
import { SpeechBubble } from "@/components/companion/SpeechBubble";
import type { Bubble } from "@/components/companion/speech";
import { GEO } from "@/lib/companion/theme";
import { TALK, type EngineOptions, type FaceEngine, type Talk } from "@/components/companion/engine";
import {
  AFTER_NO,
  LINES,
  RETRY,
  checkLine,
  howAmI,
  introLine,
  isGame,
  isSnack,
  PLACEHOLDERS,
  say,
  understand,
  type IntentId,
} from "@/components/companion/converse";
import { loadLinks } from "@/components/companion/links";
import { SNACKS } from "@/components/companion/mind";
import { DEBUG_DEFAULTS, listenBus, send, type DebugState } from "@/lib/companion/bus";
import {
  onDropped,
  openCaloriesWindow,
  openLink,
  openSettingsWindow,
  onMediaElsewhere,
  onPointerElsewhere,
  onTypingElsewhere,
  onWindowMoved,
  setHelpingSize,
  windowPlacement,
} from "@/lib/companion/desktop";
import { featureOn, useFeatures } from "@/lib/companion/features";
import {
  galleryStatus,
  openGallery,
  type GalleryOpened,
  type PasscodeCheck,
} from "@/lib/companion/gallery";
import { useDark, useMode, useSettings } from "@/lib/companion/settings";
import { CaloriePad } from "@/components/companion/CaloriePad";
import { PasscodePad } from "@/components/companion/PasscodePad";
import { Checkers } from "@/components/companion/Checkers";
import { Chess } from "@/components/companion/Chess";
import { TicTacToe } from "@/components/companion/TicTacToe";
import { LiarsDice } from "@/components/companion/LiarsDice";
import { Solitaire } from "@/components/companion/Solitaire";
import { War } from "@/components/companion/War";
import { applyToBook, dateKey, readBook } from "@/lib/companion/calories";
import { markCalorieCare, useCalorieBook } from "@/lib/companion/calorie-store";

type MediaInfo = EngineOptions["media"];

/** Debug's pretend media: a window off to one side playing something. */
function pretend(side: "left" | "right"): NonNullable<MediaInfo> {
  return { dx: side === "left" ? -700 : 700, dy: 0, app: "Pretend" };
}

export function Companion() {
  const engineRef = useRef<FaceEngine | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [settings] = useSettings();
  const [book, commitBook] = useCalorieBook();
  const [logging, setLogging] = useState(false);
  const [playing, setPlaying] = useState<
    "checkers" | "chess" | "tictactoe" | "liarsdice" | "solitaire" | "war" | null
  >(null);
  const debugState = useRef<DebugState>({ ...DEBUG_DEFAULTS });
  const events = useRef<string[]>([]);
  const realMedia = useRef<MediaInfo>(null);
  const press = useRef<{ x: number; y: number; moved: number; stroked: number; at: number } | null>(
    null,
  );
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [gift, setGift] = useState<Gift | null>(null);
  const [helping, setHelping] = useState(false);
  // Asking for Local Gallery's passcode: how many wrong so far, what to say
  // under the dots, and whether a try is being checked.
  type Asking = { wrong: number; message: string | null; busy: boolean };
  const [asking, setAsking] = useState<Asking | null>(null);
  const askingNow = useRef(false);
  askingNow.current = !!asking;
  /** Puts the passcode pad away without a word (something else came up). */
  const dropAsking = useCallback(() => {
    if (!askingNow.current) return;
    setAsking(null);
    engineRef.current?.passcode("cancel", { quiet: true });
  }, []);
  const getEngine = useCallback(() => engineRef.current, []);
  // Mote's own resizing moves the window; that isn't someone flinging it.
  const ownMoveUntil = useRef(0);
  useEffect(() => {
    ownMoveUntil.current = performance.now() + 800;
    // The board needs a taller window than the file options do; the
    // passcode pad, room for its keys with Mote above them.
    // Solitaire's seven columns want a little more room still.
    const size =
      playing === "solitaire"
        ? { width: 480, height: 800 }
        : playing
          ? { width: 430, height: 740 }
          : asking
            ? { width: 380, height: 640 }
            : undefined;
    setHelpingSize(helping || !!playing || !!asking, size);
  }, [helping, playing, !!asking]); // eslint-disable-line react-hooks/exhaustive-deps
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });

  // The bubble's tail points down at Mote, just above the eyes.
  const measure = useCallback(() => {
    const svg = buttonRef.current?.querySelector("svg.face");
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const eyeTop = (GEO.eyeY - GEO.eyeH / 2 - 6) / GEO.vbH;
    setAnchor({ x: r.left + r.width / 2, y: r.top + r.height * eyeTop });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    // Mote also changes size when the calorie card or the checkers board
    // opens; the bubble follows.
    const svg = buttonRef.current?.querySelector("svg.face");
    const watch = svg ? new ResizeObserver(measure) : null;
    if (svg) watch?.observe(svg);
    return () => {
      window.removeEventListener("resize", measure);
      watch?.disconnect();
    };
  }, [measure]);

  // Let Mote know roughly where on the screen the window is.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const placement = await windowPlacement();
      if (alive) engineRef.current?.configure({ placement });
    };
    void check();
    const t = window.setInterval(check, 3000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  // Media playing in another window, or Debug's pretend version of it.
  const applyAudio = () => {
    const { fakeAudio } = debugState.current;
    engineRef.current?.configure({
      media: fakeAudio ? pretend(fakeAudio) : realMedia.current,
    });
  };

  const { energy, pace, friendly } = settings;
  const dark = useDark(settings.theme);
  useMode(settings.mode);

  // The diet tracker is a keyed feature (see features.ts): off, Mote keeps no
  // count and says nothing about calories, and its button and card are gone.
  const [features] = useFeatures();
  const diet = featureOn(features, "diet");
  const calorieGoal = diet ? settings.calorieGoal : 0;
  const hunger = featureOn(features, "hunger");
  const sleepNeed = featureOn(features, "sleep");
  const gallery = featureOn(features, "gallery");
  const brows = featureOn(features, "brows");
  const mouth = featureOn(features, "mouth");
  const links = featureOn(features, "links");
  const checkIns = featureOn(features, "checkins");
  const games = featureOn(features, "games");
  const eyesOnly = featureOn(features, "eyes");
  const glint = featureOn(features, "glint");
  const moodShape = featureOn(features, "moodshape");
  const files = featureOn(features, "files");
  const apps = featureOn(features, "apps");
  const debugOn = featureOn(features, "debug");
  const linksOn = useRef(links);
  linksOn.current = links;
  // Debug mode: on while Settings is open with its Debug tabs, which says
  // hello every second. A few seconds without one (Settings closed, or Debug
  // switched off), and it's over.
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    if (!debugOn) {
      setDebug(false);
      return;
    }
    let heard = 0;
    const stop = listenBus((msg) => {
      if (msg.type !== "debug") return;
      heard = Date.now();
      setDebug(true);
    });
    const t = window.setInterval(() => {
      if (Date.now() - heard > 3000) setDebug(false);
    }, 1000);
    return () => {
      stop();
      window.clearInterval(t);
    };
  }, [debugOn]);
  useEffect(() => {
    if (!diet) setLogging(false);
  }, [diet]);
  // Toy chest switched off: a game that's open is put away.
  useEffect(() => {
    if (!games) setPlaying(null);
  }, [games]);
  useEffect(() => {
    if (!gallery) dropAsking();
  }, [gallery, dropAsking]);
  // Settings did something with the passcode: Mote reacts here.
  useEffect(
    () =>
      listenBus((msg) => {
        if (msg.type === "gallery") engineRef.current?.passcode(msg.event, msg.info);
      }),
    [],
  );
  const engineOptions: Partial<EngineOptions> = {
    energy,
    calorieGoal,
    friendly,
    hunger,
    sleepNeed,
    brows,
    mouth,
    links,
    checkIns,
    games,
    eyesOnly,
    dark,
    glint,
    moodShape,
    look: settings.mode,
  };
  const optionsNow = useRef(engineOptions);
  optionsNow.current = engineOptions;
  useEffect(() => {
    engineRef.current?.configure(optionsNow.current);
  }, [energy, calorieGoal, friendly, hunger, sleepNeed, brows, mouth, links, checkIns, games, eyesOnly, dark, glint, moodShape, settings.mode]);

  useEffect(
    () =>
      onMediaElsewhere((media) => {
        const was = realMedia.current;
        realMedia.current = media;
        if ((was === null) !== (media === null)) {
          events.current.push(media ? "sound playing in another window" : "other sound stopped");
        }
        applyAudio();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(
    () =>
      onWindowMoved((dx, dy) => {
        if (performance.now() > ownMoveUntil.current) engineRef.current?.windowMoved(dx, dy);
      }),
    [],
  );
  useEffect(
    () =>
      onPointerElsewhere((dx, dy, inside) => engineRef.current?.pointerElsewhere(dx, dy, inside)),
    [],
  );
  useEffect(() => onTypingElsewhere((dx, dy) => engineRef.current?.typingAt(dx, dy)), []);
  // Folders and videos dropped on the window, for Mote to help with.
  const give = useCallback((paths: string[]) => {
    setGift((g) => ({ paths, seq: (g?.seq ?? 0) + 1 }));
  }, []);
  useEffect(
    () =>
      onDropped(
        (over) => engineRef.current?.dragHover(over),
        (paths) => give(paths),
        (link) => {
          // Saved links switched off: Mote doesn't take it.
          if (linksOn.current) engineRef.current?.saveLink(link.url, link.title);
          else engineRef.current?.declined();
        },
      ),
    [give],
  );

  // Debug mode: take orders from the Debug tabs and report back ~10× a second.
  useEffect(() => {
    if (!debug) {
      const e = engineRef.current;
      if (e) {
        e.setTimeScale(1);
        e.setFrozen(false);
        e.setAutoMoods(true);
        e.setLoop(false);
        e.setGuides(false);
        e.setManual(null);
      }
      debugState.current = { ...DEBUG_DEFAULTS };
      applyAudio();
      events.current = [];
      return;
    }
    const stop = listenBus((msg) => {
      const e = engineRef.current;
      if (msg.type !== "debug" || !e) return;
      const cmd = msg.cmd;
      const d = debugState.current;
      if (cmd.do === "force") e.force(cmd.mood);
      else if (cmd.do === "blink") e.blink(cmd.double);
      else if (cmd.do === "poke") e.poke();
      else if (cmd.do === "timeScale") e.setTimeScale((d.timeScale = cmd.value));
      else if (cmd.do === "frozen") e.setFrozen((d.frozen = cmd.value));
      else if (cmd.do === "autoMoods") e.setAutoMoods((d.autoMoods = cmd.value));
      else if (cmd.do === "loop") e.setLoop((d.loop = cmd.value));
      else if (cmd.do === "guides") e.setGuides((d.guides = cmd.value));
      else if (cmd.do === "feeling") e.setFeeling(cmd.attr, cmd.value);
      else if (cmd.do === "resetFeelings") e.resetFeelings();
      else if (cmd.do === "react") e.react(cmd.id);
      else if (cmd.do === "say") e.say(cmd.id);
      else if (cmd.do === "give") give(cmd.paths);
      else if (cmd.do === "saveLink") e.saveLink(cmd.url, cmd.title);
      else if (cmd.do === "suggestLink") e.suggestLink(cmd.url);
      else if (cmd.do === "fakeAudio") {
        d.fakeAudio = cmd.value;
        applyAudio();
      } else if (cmd.do === "manual") {
        d.manual = cmd.face !== null;
        e.setManual(cmd.face);
      }
    });
    const timer = window.setInterval(() => {
      const e = engineRef.current;
      if (!e) return;
      send({
        type: "state",
        snap: e.snapshot(),
        debug: { ...debugState.current },
        events: events.current.splice(0),
      });
    }, 100);
    return () => {
      stop();
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debug]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && logging) setLogging(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logging]);

  // Local Gallery: straight open with no passcode (or when it's open
  // already), otherwise Mote asks for it first, and without it, it stays shut.
  const ask = () => {
    setLogging(false);
    setPlaying(null);
    setAsking({ wrong: 0, message: null, busy: false });
    engineRef.current?.passcode("ask");
  };
  const refused = (check: PasscodeCheck) => {
    if (check.result === "refused" || check.result === "waiting") {
      engineRef.current?.passcode(check.result === "refused" ? "refuse" : "waiting", { wait: check.wait });
    }
  };
  const opened = (result: GalleryOpened) => {
    const engine = engineRef.current;
    if (result.result === "opened") engine?.openedGallery(true);
    else if (result.result === "alreadyOpen") engine?.passcode("already-open");
    else if (result.result === "needPasscode") ask();
    else if (result.result === "failed") engine?.openedGallery(false);
    else refused(result.check);
  };
  const openLocalGallery = async () => {
    const status = await galleryStatus();
    if (!status?.carried) {
      engineRef.current?.openedGallery(false);
      return;
    }
    if (status.passcode && !status.open) {
      if (status.wait > 0) engineRef.current?.passcode("waiting", { wait: status.wait });
      else ask();
      return;
    }
    opened(await openGallery());
  };
  const tryPasscode = async (pin: string) => {
    setAsking((a) => a && { ...a, busy: true });
    const result = await openGallery(pin);
    const engine = engineRef.current;
    if (result.result === "denied" && result.check.result === "wrong") {
      const left = result.check.triesLeft;
      const message =
        left === 1 ? "That’s not it. One try left." : left === 2 ? "That’s not it. Two tries left." : "That’s not it.";
      engine?.passcode("wrong", { triesLeft: left });
      setAsking((a) => a && { wrong: a.wrong + 1, busy: false, message });
      return;
    }
    if (result.result === "opened") {
      engine?.passcode("right");
      // A beat with the dots full, then the pad goes.
      window.setTimeout(() => setAsking(null), 450);
      return;
    }
    setAsking(null);
    opened(result);
  };

  const todayTotal = book.days[dateKey()]?.total ?? 0;
  const changeCalories = (kind: "add" | "sub" | "set", amount: number) => {
    const result = applyToBook(readBook(), calorieGoal, { kind, amount });
    if (!result) return;
    commitBook(result.book);
    engineRef.current?.noteCalories(result.moment);
  };

  // Talking with Mote (see converse.ts). A click on Mote puts away whatever
  // was open and Mote asks what you'd like to do; you type it, and Mote does
  // it (or checks a guess first, or asks you to say it another way).
  const [putAwaySeq, setPutAwaySeq] = useState(0);
  const helperBusy = useRef(false);
  const noteHelperBusy = useCallback((busy: boolean) => {
    helperBusy.current = busy;
  }, []);
  /** Choices on offer right now, and a guess waiting for a yes or no. */
  const menu = useRef<IntentId[] | null>(null);
  const checking = useRef<IntentId | null>(null);

  // What Mote can be talked into. Anything still locked behind a key is left
  // out, as if Mote had never heard of it; anything switched off, Mote knows
  // about but says so.
  const known = new Set<IntentId>([
    "games",
    "chess",
    "checkers",
    "tictactoe",
    "liarsdice",
    "solitaire",
    "war",
    "files",
    "bed",
    "feed",
    "cookie",
    "berries",
    "meal",
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
  if (features.unlocked.includes("diet")) {
    known.add("diet");
    known.add("dietDays");
  }
  if (features.unlocked.includes("gallery")) known.add("gallery");
  /** Is this one switched on? */
  const on = (i: IntentId) =>
    isGame(i) || i === "games"
      ? games
      : i === "diet" || i === "dietDays"
        ? diet
        : i === "gallery"
          ? gallery
          : i === "files"
            ? files
            : i === "bed"
              ? sleepNeed
              : i === "feed" || isSnack(i)
                ? hunger
                : i === "links" || i === "saveLink"
                  ? links
                  : true;
  const ready = new Set([...known].filter(on));

  const mind = () => ({
    moods: engineRef.current?.snapshot().moods ?? [],
    friendly,
    hour: new Date().getHours(),
  });
  const talk = (t: Talk) => engineRef.current?.talk(t);
  const hint = () => say(PLACEHOLDERS);
  const question = (text: string) => talk({ kind: "talk", text, placeholder: hint() });
  const remark = (lines: readonly string[]) => talk({ kind: "flavor", text: say(lines) });
  const offer = (text: string, ids: IntentId[], labels: Partial<Record<IntentId, string>>) => {
    menu.current = ids;
    talk({
      kind: "choose",
      text,
      choices: ids.map((id) => ({ id, label: labels[id] ?? id })),
      placeholder: "Or type it…",
    });
  };
  const GAME_NAMES: Partial<Record<IntentId, string>> = {
    checkers: "Checkers",
    chess: "Chess",
    tictactoe: "Tic-tac-toe",
    liarsdice: "Liar’s Dice",
    solitaire: "Solitaire",
    war: "War",
  };
  const offerGames = (text: string = say(LINES.games)) =>
    offer(text, ["checkers", "chess", "tictactoe", "liarsdice", "solitaire", "war"], GAME_NAMES);

  /** Whatever was open goes away: a game (it's saved), the calorie card,
   * the passcode pad, the file options. */
  const putAway = () => {
    setPlaying(null);
    setLogging(false);
    dropAsking();
    setPutAwaySeq((n) => n + 1);
  };

  const startTalking = () => {
    menu.current = null;
    checking.current = null;
    question(introLine(mind()));
  };

  /** Doing what was asked for. */
  const act = (intent: IntentId) => {
    const engine = engineRef.current;
    if (!engine) return;
    menu.current = null;
    checking.current = null;
    if (!on(intent)) {
      const off = LINES.off;
      return remark(
        isGame(intent) || intent === "games"
          ? off.games
          : intent === "diet" || intent === "dietDays"
            ? off.diet
            : intent === "gallery"
              ? off.gallery
              : intent === "files"
                ? off.files
                : intent === "bed"
                  ? off.bed
                  : intent === "links" || intent === "saveLink"
                    ? off.links
                    : off.feed,
      );
    }
    if (isGame(intent)) {
      engine.endTalk();
      putAway();
      setPlaying(intent);
      return;
    }
    if (isSnack(intent)) {
      engine.endTalk();
      engine.feed(intent);
      return;
    }
    switch (intent) {
      case "games":
        return offerGames();
      case "diet":
        putAway();
        setLogging(true);
        markCalorieCare();
        return remark(LINES.diet);
      case "dietDays":
        markCalorieCare();
        openCaloriesWindow();
        return remark(LINES.dietDays);
      case "gallery":
        engine.endTalk();
        return void openLocalGallery();
      case "files":
        return remark(LINES.files);
      case "bed":
        engine.endTalk();
        return engine.tuckIn();
      case "feed":
        return offer(
          say(LINES.snacks),
          SNACKS.map((s) => s.id as IntentId),
          Object.fromEntries(SNACKS.map((s) => [s.id, s.name])),
        );
      case "links":
        if (!loadLinks().length) return remark(LINES.noLinks);
        engine.endTalk();
        return engine.suggestLink();
      case "saveLink":
        return remark(LINES.saveLink);
      case "settings":
        openSettingsWindow();
        return remark(LINES.settings);
      case "help": {
        const labels: Partial<Record<IntentId, string>> = {
          games: "Play a game",
          diet: "Log calories",
          dietDays: "See the days",
          gallery: "Open Local Gallery",
          feed: "Give me a snack",
          bed: "Tuck me in",
          links: "Something you saved",
          files: "Help with files",
          settings: "Settings",
        };
        const ids = (Object.keys(labels) as IntentId[]).filter((i) => ready.has(i));
        return offer(say(LINES.help), ids, labels);
      }
      case "greet":
        return question(say(LINES.greet));
      case "howAreYou":
        return question(howAmI(mind()));
      case "thanks":
        return remark(LINES.thanks);
      case "pet":
        return remark(LINES.pet);
      case "cancel":
        return remark(LINES.cancel);
    }
  };

  /** Something typed (or a choice picked by typing it). */
  const heard = (text: string) => {
    const h = understand(text, { known, choices: menu.current ?? undefined });
    engineRef.current?.react(h.kind === "do" ? "talk-understood" : h.kind === "check" ? "talk-check" : "talk-unknown");
    if (h.kind === "do") return act(h.intent);
    menu.current = null;
    if (h.kind === "check") {
      checking.current = h.intent;
      return talk({ kind: "ask", text: checkLine(h.intent) });
    }
    question(say(RETRY));
  };

  /** Yes or no to a guess. */
  const answered = (yes: boolean) => {
    const guess = checking.current;
    checking.current = null;
    if (guess && yes) return act(guess);
    question(say(AFTER_NO));
  };

  // A click on Mote is a poke: a happy hop, or waking them up, or a glance
  // up from a job. A second click close behind it (a double-click) starts a
  // conversation, unless the first one woke them: they need a moment.
  const lastTap = useRef<{ at: number; woke: boolean } | null>(null);
  const talkNow = () => {
    const engine = engineRef.current;
    if (!engine || engine.drowsy()) return;
    if (helperBusy.current) return engine.say("busy");
    putAway();
    engine.react("talk");
    startTalking();
  };
  const tapped = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const now = performance.now();
    const last = lastTap.current;
    if (last && now - last.at < 350) {
      lastTap.current = null;
      if (!last.woke) talkNow();
      return;
    }
    lastTap.current = { at: now, woke: engine.drowsy() };
    engine.poke();
  };

  // A click on Mote's body is a poke and a double-click starts a
  // conversation; pressing and dragging across it is petting. Presses on the
  // empty window around Mote do nothing.
  return (
    <div
      className={`stage${eyesOnly ? " is-eyes" : ""}${helping ? " is-helping" : ""}${logging ? " is-logging" : ""}${asking && !helping ? " is-asking" : ""}${playing && !helping ? " is-playing" : ""}`}
      onContextMenu={(e) => {
        const target = e.target;
        if (target instanceof Element && target.closest("input, textarea")) return;
        e.preventDefault();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="window"
        aria-label="Mote"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (!engineRef.current?.hitTest(e.clientX, e.clientY)) {
            engineRef.current?.react("empty-click");
            return;
          }
          press.current = {
            x: e.clientX,
            y: e.clientY,
            moved: 0,
            stroked: 0,
            at: performance.now(),
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = press.current;
          const engine = engineRef.current;
          if (!p || !engine) return;
          const step = Math.hypot(e.clientX - p.x, e.clientY - p.y);
          p.moved += step;
          p.x = e.clientX;
          p.y = e.clientY;
          if (!engine.hitTest(e.clientX, e.clientY)) return;
          // It only counts as petting after a proper stroke: well over a second
          // of moving across the face, covering a good distance.
          p.stroked += step;
          const width = e.currentTarget.getBoundingClientRect().width || 300;
          if (p.stroked > width * 1.6 && performance.now() - p.at > 1100) {
            engine.pet(e.clientX, e.clientY);
          }
        }}
        onPointerUp={() => {
          const p = press.current;
          press.current = null;
          if (p && p.moved < 8) tapped();
        }}
        onPointerCancel={() => {
          press.current = null;
        }}
        onClick={(e) => {
          // Enter or Space on the focused window starts a conversation too.
          if (e.detail === 0) talkNow();
        }}
      >
        <Face
          onEngine={(engine) => {
            engineRef.current = engine;
            engine?.configure(optionsNow.current);
            applyAudio();
          }}
          onMood={(label) => {
            const button = buttonRef.current;
            if (!button) return;
            const next = label ?? "Mote";
            if (button.getAttribute("aria-label") !== next) button.setAttribute("aria-label", next);
          }}
          onEvent={(text) => {
            if (!debug) return;
            events.current.push(text);
            if (events.current.length > 200) events.current.shift();
          }}
          onOpenLink={openLink}
          onSuggestPlay={() => {
            if (games) offerGames(say(LINES.funNo));
          }}
          onSpeech={(b) => {
            if (b) measure();
            setBubble(b);
          }}
        />
      </button>
      <Helper
        engine={getEngine}
        pace={pace}
        gift={gift}
        files={files}
        apps={apps}
        putAway={putAwaySeq}
        onBusy={noteHelperBusy}
        onOpen={(open) => {
          setHelping(open);
          if (open) {
            setLogging(false);
            dropAsking();
            // The game is saved; it'll be there when you open the board again.
            setPlaying(null);
          }
        }}
      />
      {playing === "checkers" && !helping ? <Checkers engine={getEngine} onClose={() => setPlaying(null)} /> : null}
      {playing === "chess" && !helping ? <Chess engine={getEngine} onClose={() => setPlaying(null)} /> : null}
      {playing === "tictactoe" && !helping ? <TicTacToe engine={getEngine} onClose={() => setPlaying(null)} /> : null}
      {playing === "liarsdice" && !helping ? <LiarsDice engine={getEngine} onClose={() => setPlaying(null)} /> : null}
      {playing === "solitaire" && !helping ? <Solitaire engine={getEngine} onClose={() => setPlaying(null)} /> : null}
      {playing === "war" && !helping ? <War engine={getEngine} onClose={() => setPlaying(null)} /> : null}
      {asking && !helping ? (
        <PasscodePad
          title="Local Gallery"
          prompt="Enter your passcode"
          message={asking.message}
          wrong={asking.wrong}
          busy={asking.busy}
          onDigit={() => engineRef.current?.passcode("digit")}
          onEnter={(pin) => void tryPasscode(pin)}
          onCancel={() => {
            setAsking(null);
            engineRef.current?.passcode("cancel");
          }}
        />
      ) : null}
      {logging && diet ? (
        <CaloriePad
          total={todayTotal}
          goal={calorieGoal}
          onAdd={(amount) => changeCalories("add", amount)}
          onSub={(amount) => changeCalories("sub", amount)}
          onSet={(amount) => changeCalories("set", amount)}
          onClose={() => setLogging(false)}
        />
      ) : null}
      <SpeechBubble
        bubble={bubble}
        anchor={anchor}
        onAnswer={(yes) => (bubble?.lineId === TALK ? answered(yes) : engineRef.current?.answer(yes))}
        onDismiss={() => engineRef.current?.dismissSpeech()}
        onSubmit={heard}
        onChoose={(id) => act(id as IntentId)}
        onTyping={() => engineRef.current?.stillTalking()}
      />
    </div>
  );
}
