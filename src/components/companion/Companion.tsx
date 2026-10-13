import { useCallback, useEffect, useRef, useState } from "react";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import { Face } from "@/components/companion/Face";
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
  MEETING,
  PLACEHOLDERS,
  sayTo,
  understand,
  type IntentId,
} from "@/components/companion/converse";
import { loadLinks } from "@/components/companion/links";
import { DEBUG_DEFAULTS, listenBus, send, type DebugState, type FakeAudio } from "@/lib/companion/bus";
import {
  onDropped,
  openLink,
  openSettingsWindow,
  onMediaElsewhere,
  onPointerElsewhere,
  onTypingElsewhere,
  onWindowMoved,
  appDropped,
  growWindow,
  setListening,
  windowPlacement,
} from "@/lib/companion/desktop";
import { featureOn, useFeatures } from "@/lib/companion/features";
import { forcedMouth, lookOf, nameOf, readSettings, useDark, useMode, useSettings } from "@/lib/companion/settings";
import { Checkers } from "@/components/companion/Checkers";
import { Chess } from "@/components/companion/Chess";
import { TicTacToe } from "@/components/companion/TicTacToe";
import { Solitaire } from "@/components/companion/Solitaire";
import { Uno } from "@/components/companion/Uno";

type MediaInfo = EngineOptions["media"];

/** Debug's pretend media: a window off to one side playing something, or
 * music to dance to (quiet and slow, or loud and fast). */
function pretend(kind: FakeAudio): NonNullable<MediaInfo> {
  const at = { dx: kind === "left" ? -700 : 700, dy: 0, app: "Pretend", heard: true };
  if (kind === "left" || kind === "right") return { ...at, music: null };
  const bpm = kind === "music-slow" ? 84 : 128;
  const period = 60 / bpm;
  return { ...at, music: { bpm, beatAgo: (Date.now() / 1000) % period, intensity: kind === "music-slow" ? 0.25 : 0.95 } };
}

type MeetStep = "hello" | "touch" | "talk" | "share" | "name";
const MEET_STEPS: MeetStep[] = ["hello", "touch", "talk", "share", "name"];

/** Whether you've met Mote (told them your name, or said you'd rather not). */
const MET = "mote.met";
function metBefore() {
  try {
    return localStorage.getItem(MET) === "1";
  } catch {
    return false;
  }
}
function markMet() {
  try {
    localStorage.setItem(MET, "1");
  } catch {
    // Fine: Mote will just say hello again next time.
  }
}
function forgetMeeting() {
  try {
    localStorage.removeItem(MET);
  } catch {
    // Nothing to forget.
  }
}

export function Companion() {
  const engineRef = useRef<FaceEngine | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [settings, updateSettings] = useSettings();
  const [playing, setPlaying] = useState<"checkers" | "chess" | "tictactoe" | "solitaire" | "uno" | null>(null);
  const debugState = useRef<DebugState>({ ...DEBUG_DEFAULTS });
  const events = useRef<string[]>([]);
  const realMedia = useRef<MediaInfo>(null);
  const press = useRef<{ x: number; y: number; moved: number; stroked: number; at: number } | null>(
    null,
  );
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const getEngine = useCallback(() => engineRef.current, []);
  // Mote's own resizing moves the window; that isn't someone flinging it.
  const ownMoveUntil = useRef(0);
  useEffect(() => {
    ownMoveUntil.current = performance.now() + 800;
    // The board needs a taller window than the file options do;
    // Solitaire's seven columns, and Uno's two hands, want a little more
    // room still.
    const size =
      playing === "solitaire" || playing === "uno"
        ? { width: 480, height: 800 }
        : playing
          ? { width: 430, height: 740 }
          : undefined;
    growWindow(!!playing, size);
  }, [playing]);
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
    // Mote also changes size when a game board opens; the bubble follows.
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
  // (With noticing the screen switched off, only the pretend one.)
  const applyAudio = () => {
    const { fakeAudio } = debugState.current;
    engineRef.current?.configure({
      media: fakeAudio ? pretend(fakeAudio) : noticingOn.current ? realMedia.current : null,
    });
  };

  const { energy, friendly } = settings;
  const dark = useDark(settings.theme);
  const look = lookOf(settings);
  useMode(look);

  const [features] = useFeatures();
  const brows = featureOn(features, "brows");
  // The mouth is an experimental switch, except that Mote Appearance's
  // jack-o'-lantern always has its grin.
  const mouth = featureOn(features, "mouth") || forcedMouth(settings);
  const links = featureOn(features, "links");
  const checkIns = featureOn(features, "checkins");
  const games = featureOn(features, "games");
  const eyesOnly = featureOn(features, "eyes");
  const glint = featureOn(features, "glint");
  const moodShape = featureOn(features, "moodshape");
  const apps = featureOn(features, "apps");
  const debugOn = featureOn(features, "debug");
  const mindOn = featureOn(features, "mind");
  const remarks = featureOn(features, "remarks");
  const chat = featureOn(features, "chat");
  const needs = featureOn(features, "needs");
  const memories = featureOn(features, "memories");
  const gameTalk = featureOn(features, "gametalk");
  const talkOn = featureOn(features, "talk");
  const noticing = featureOn(features, "noticing");
  const dizzy = featureOn(features, "dizzy");
  const dancing = featureOn(features, "dancing");
  const antics = featureOn(features, "antics");
  const linksOn = useRef(links);
  linksOn.current = links;
  const noticingOn = useRef(noticing);
  noticingOn.current = noticing;
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
  // Toy chest switched off: a game that's open is put away.
  useEffect(() => {
    if (!games) setPlaying(null);
  }, [games]);
  const engineOptions: Partial<EngineOptions> = {
    energy,
    friendly,
    mind: mindOn,
    remarks,
    chat,
    needs,
    memories,
    gameTalk,
    dizzy,
    dancing,
    antics,
    brows,
    mouth,
    links,
    checkIns,
    games,
    eyesOnly,
    dark,
    glint,
    moodShape,
    look,
    name: settings.name,
    animations: settings.animations,
  };
  const optionsNow = useRef(engineOptions);
  optionsNow.current = engineOptions;
  useEffect(() => {
    engineRef.current?.configure(optionsNow.current);
  }, [energy, friendly, mindOn, remarks, chat, needs, memories, gameTalk, dizzy, dancing, antics, brows, mouth, links, checkIns, games, eyesOnly, dark, glint, moodShape, look, settings.name, settings.animations]);
  // Noticing the screen switched on or off: sound elsewhere counts, or doesn't.
  useEffect(() => {
    applyAudio();
  }, [noticing]);
  // Dancing on: the helper may listen to what's playing (the first time, macOS
  // asks). Off, it doesn't listen at all.
  useEffect(() => setListening(dancing), [dancing]);

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
  useEffect(
    () =>
      onTypingElsewhere((dx, dy) => {
        if (noticingOn.current) engineRef.current?.typingAt(dx, dy);
      }),
    [],
  );
  // Something dropped on the window: an app gets played or reacted to (if
  // that's switched on); anything else, Mote has a word about but doesn't take.
  const appsOn = useRef(apps);
  appsOn.current = apps;
  const give = useCallback((paths: string[]) => {
    void appDropped(paths).then((app) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (!app) return engine.notForMe();
      if (!appsOn.current) return engine.declined();
      engine.offerApp(app);
    });
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
      else if (cmd.do === "meet") {
        forgetMeeting();
        updateSettings({ name: "" });
        window.setTimeout(() => meetRef.current(), 300);
      }
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


  /** A line from a list, said to you by name when Mote knows it. */
  const say = (lines: readonly string[]) => sayTo(lines, settings.name);
  const meeting = useRef<MeetStep | null>(null);
  // The first time: a moment after Mote opens, if they don't know you yet.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!readSettings().name && !metBefore()) meetRef.current();
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);
  // Your name changed in Settings: Mote takes note, out loud.
  const knownName = useRef<string | null>(null);
  useEffect(() => {
    knownName.current = settings.name;
  }, [settings.name]);
  useEffect(() => {
    knownName.current = readSettings().name;
    return listenBus((msg) => {
      if (msg.type !== "settings") return;
      const name = msg.settings.name;
      if (name === knownName.current) return;
      knownName.current = name;
      if (!name) return;
      if (meeting.current) {
        meeting.current = null;
        markMet();
      }
      engineRef.current?.talk({ kind: "flavor", text: sayTo(MEETING.renamed, name) });
    });
  }, []);

  // Talking with Mote (see converse.ts). A click on Mote puts away whatever
  // was open and Mote asks what you'd like to do; you type it, and Mote does
  // it (or checks a guess first, or asks you to say it another way).
  /** Choices on offer right now, and a guess waiting for a yes or no. */
  const menu = useRef<IntentId[] | null>(null);
  const checking = useRef<IntentId | null>(null);

  // What Mote can be talked into. Anything switched off, Mote knows about
  // but says so.
  const known = new Set<IntentId>([
    "games",
    "chess",
    "checkers",
    "tictactoe",
    "solitaire",
    "uno",
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
  /** Is this one switched on? */
  const on = (i: IntentId) =>
    isGame(i) || i === "games"
      ? games
      : i === "links" || i === "saveLink"
          ? links
          : true;
  const ready = new Set([...known].filter(on));

  const mind = () => ({
    moods: engineRef.current?.snapshot().moods ?? [],
    friendly,
    hour: new Date().getHours(),
    name: settings.name,
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
    solitaire: "Solitaire",
    uno: "Uno",
  };
  const offerGames = (text: string = say(LINES.games)) =>
    offer(text, ["checkers", "chess", "tictactoe", "solitaire", "uno"], GAME_NAMES);

  /** Whatever was open goes away: a game (it's saved). */
  const putAway = () => {
    setPlaying(null);
  };

  const startTalking = () => {
    menu.current = null;
    checking.current = null;
    meeting.current = null;
    question(introLine(mind()));
  };

  // Meeting Mote (see MEETING in converse.ts): the first time Mote opens,
  // while they don't know your name. Which step is up (null when not
  // meeting). Each step has just a button to go on (no box to type in, so
  // it's clear what to do); the last asks your name. Skipping it is fine:
  // Mote won't ask again.
  const after = (step: MeetStep): MeetStep => {
    const i = MEET_STEPS.indexOf(step);
    const next = MEET_STEPS[Math.min(i + 1, MEET_STEPS.length - 1)];
    if (next === "talk" && !talkOn) return after(next);
    if (next === "share" && !noticing && !links) return after(next);
    return next;
  };
  const askName = (text: string) =>
    talk({
      kind: "choose",
      text,
      choices: [{ id: "meet-skip", label: MEETING.name.skip }],
      placeholder: MEETING.name.placeholder,
    });
  const meetStep = (step: MeetStep) => {
    meeting.current = step;
    const go = (text: string, next: string) =>
      talk({ kind: "choose", text, choices: [{ id: "meet-next", label: next }], noTyping: true });
    if (step === "hello") return go(MEETING.hello.text, MEETING.hello.next);
    if (step === "touch") return go(MEETING.touch.text, MEETING.touch.next);
    if (step === "talk") return go(MEETING.talk.text, MEETING.talk.next);
    if (step === "share") {
      const watch = noticing ? (dancing ? MEETING.dance : MEETING.watch) : null;
      const text = [watch, links ? MEETING.links : null].filter(Boolean).join(" ");
      return go(text.replace(/^And i/, "I"), MEETING.shareNext);
    }
    askName(MEETING.name.text);
  };
  const metDone = (name: string | null) => {
    meeting.current = null;
    markMet();
    if (name) {
      updateSettings({ name });
      engineRef.current?.poke();
      talk({ kind: "flavor", text: sayTo(MEETING.hi, name) });
    } else talk({ kind: "flavor", text: say(MEETING.skipped) });
  };
  const meetChoice = (id: string) => {
    const step = meeting.current;
    if (!step) return;
    if (id === "meet-skip") return metDone(null);
    meetStep(after(step));
  };
  const meetText = (text: string) => {
    const step = meeting.current;
    if (!step) return;
    if (step !== "name") return meetStep(after(step));
    const name = nameOf(text);
    if (!name) return askName(say(MEETING.again));
    metDone(name);
  };
  const meet = () => {
    if (!engineRef.current) return;
    putAway();
    meetStep("hello");
  };
  const meetRef = useRef(meet);
  meetRef.current = meet;

  /** Doing what was asked for. */
  const act = (intent: IntentId) => {
    const engine = engineRef.current;
    if (!engine) return;
    menu.current = null;
    checking.current = null;
    if (!on(intent)) {
      const off = LINES.off;
      return remark(
        isGame(intent) || intent === "games" ? off.games : off.links,
      );
    }
    if (isGame(intent)) {
      engine.endTalk();
      putAway();
      setPlaying(intent);
      return;
    }
    switch (intent) {
      case "games":
        return offerGames();
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
          links: "Something you saved",
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
    if (!engine || engine.drowsy() || !talkOn) return;
    putAway();
    engine.react("talk");
    startTalking();
  };
  const tapped = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const now = performance.now();
    const last = lastTap.current;
    // (With conversations switched off, every click is just a poke.)
    if (talkOn && last && now - last.at < 350) {
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
      className={`stage${eyesOnly ? " is-eyes" : ""}${playing ? " is-playing" : ""}`}
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
            // The meeting's bubble went (timed out, or something else came
            // up): it's over for now, and picks up next time Mote opens.
            if (meeting.current && b?.lineId !== TALK) meeting.current = null;
          }}
        />
      </button>
      {playing === "checkers" ? <Checkers engine={getEngine} onClose={() => setPlaying(null)} /> : null}
      {playing === "chess" ? <Chess engine={getEngine} onClose={() => setPlaying(null)} /> : null}
      {playing === "tictactoe" ? <TicTacToe engine={getEngine} onClose={() => setPlaying(null)} /> : null}
      {playing === "solitaire" ? <Solitaire engine={getEngine} onClose={() => setPlaying(null)} /> : null}
      {playing === "uno" ? <Uno engine={getEngine} onClose={() => setPlaying(null)} /> : null}
      <SpeechBubble
        bubble={bubble}
        anchor={anchor}
        onAnswer={(yes) => (bubble?.lineId === TALK ? answered(yes) : engineRef.current?.answer(yes))}
        onDismiss={() => engineRef.current?.dismissSpeech()}
        onSubmit={(text) => (meeting.current ? meetText(text) : heard(text))}
        onChoose={(id) => (meeting.current ? meetChoice(id) : act(id as IntentId))}
        onTyping={() => engineRef.current?.stillTalking()}
      />
    </div>
  );
}
