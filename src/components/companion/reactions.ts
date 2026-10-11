import type { MindValues } from "@/components/companion/mind";

// Every stimulus → response rule Mote follows, in one place. The engine fires
// these by id (and applies their `effects` to Mote's feelings); the debug
// window lists them all, live and planned. Add new behaviours here first.

export type ReactionGroup =
  | "Touch"
  | "Pointer"
  | "Window"
  | "Sound"
  | "Interest"
  | "Helping you"
  | "Speech"
  | "Time"
  | "Lasting moods"
  | "Ideas";

export type Reaction = {
  id: string;
  group: ReactionGroup;
  name: string;
  /** The stimulus: what Mote notices. */
  when: string;
  /** The outcome: what Mote does. */
  then: string;
  /** How it moves Mote's feelings, each time it fires. */
  effects?: Partial<MindValues>;
  /** "live" is built; "idea" is planned and doesn't happen yet. */
  status: "live" | "idea";
};

export const REACTIONS: Reaction[] = [
  // Touch
  {
    id: "poke",
    group: "Touch",
    name: "Poke",
    when: "You click right on Mote’s face",
    then: "A happy little hop",
    effects: { happy: 0.5 },
    status: "live",
  },
  {
    id: "poke-grumpy",
    group: "Touch",
    name: "Poke while frustrated",
    when: "You poke Mote while they’re frustrated",
    then: "A grumpy scowl and stomp instead of a hop",
    effects: { happy: -0.5, restless: 0.5 },
    status: "live",
  },
  {
    id: "poke-spam",
    group: "Touch",
    name: "Too many pokes",
    when: "Four pokes within about two seconds",
    then: "Gets grumpy: scowls and stomps",
    effects: { happy: -2.5, restless: 1 },
    status: "live",
  },
  {
    id: "poke-giggle",
    group: "Touch",
    name: "Lots of pokes (Friendly mode)",
    when: "Four pokes within about two seconds, with Friendly mode on",
    then: "It tickles! A giggly little wiggle",
    effects: { happy: 0.3 },
    status: "live",
  },
  {
    id: "pet",
    group: "Touch",
    name: "Petting",
    when: "You press and rub back and forth across Mote’s face (each second)",
    then: "Melts into a relaxed purr, leaning into your hand",
    effects: { happy: 0.3, restless: -0.3 },
    status: "live",
  },
  {
    id: "empty-click",
    group: "Touch",
    name: "Clicking around Mote",
    when: "You click the empty window around Mote",
    then: "Nothing: only Mote’s face counts",
    status: "live",
  },

  // Pointer
  {
    id: "follow",
    group: "Pointer",
    name: "Watching your pointer",
    when: "Your pointer moves (with Follows your pointer on)",
    then: "Eyes and body turn to follow it",
    status: "live",
  },
  {
    id: "close",
    group: "Pointer",
    name: "Pointer up close",
    when: "Your pointer sits right in front of Mote’s face",
    then: "Eyes open a touch wider",
    status: "live",
  },
  {
    id: "company",
    group: "Pointer",
    name: "Keeping company",
    when: "You’ve been around Mote’s window for a minute",
    then: "Cheers up and settles a tiny bit",
    effects: { happy: 0.15, restless: -0.1 },
    status: "live",
  },
  {
    id: "shake-pointer",
    group: "Pointer",
    name: "Shaken pointer",
    when: "You whip the pointer around wildly",
    then: "Gets dizzy: swirling eyes, wobbling, then shakes it off",
    effects: { happy: -0.5, restless: 1 },
    status: "live",
  },
  {
    id: "left-alone",
    group: "Pointer",
    name: "Pointer goes still",
    when: "The pointer stops moving for a few seconds",
    then: "Stops watching it; eyes wander on their own",
    status: "live",
  },

  // Window
  {
    id: "drag",
    group: "Window",
    name: "Window dragged",
    when: "You drag Mote’s window",
    then: "Trails behind it and swings back into place",
    effects: { restless: 0.3 },
    status: "live",
  },
  {
    id: "throw",
    group: "Window",
    name: "Window thrown around",
    when: "You shake the window back and forth hard",
    then: "Gets dizzy",
    effects: { happy: -0.75, restless: 1 },
    status: "live",
  },

  // Sound
  {
    id: "sound-start",
    group: "Sound",
    name: "Sound starts somewhere",
    when: "Another visible window starts playing sound",
    then: "Perks up and turns to watch it",
    status: "live",
  },
  {
    id: "sound-ongoing",
    group: "Sound",
    name: "Watching along",
    when: "Sound keeps playing in another window",
    then: "Keeps watching that window; no other idle moods",
    status: "live",
  },

  // Interest
  {
    id: "intrigued-you",
    group: "Interest",
    name: "Intrigued by you",
    when: "You’re using Mote’s window: moving around it, poking, petting, dragging",
    then: "Pays attention: does fewer random things",
    status: "live",
  },
  {
    id: "intrigued-media",
    group: "Interest",
    name: "Intrigued by what’s playing",
    when: "A window you can see is making sound (covered-up windows don’t count)",
    then: "Pays attention to it; the only thing Mote does is check in on you now and then",
    status: "live",
  },
  {
    id: "look-away",
    group: "Interest",
    name: "A little break",
    when: "Every so often while watching",
    then: "Looks away for a moment instead of checking in",
    status: "live",
  },
  {
    id: "pointer-elsewhere",
    group: "Interest",
    name: "Pointer out on the screen",
    when: "You move the pointer a lot anywhere on the screen",
    then: "Glances at it for a moment",
    status: "live",
  },
  {
    id: "typing",
    group: "Interest",
    name: "Watching you type",
    when: "You type steadily in another app (Mote only notices that keys are being pressed, never which)",
    then: "Looks over at the window you’re typing in; counts as being intrigued",
    status: "live",
  },
  {
    id: "split-attention",
    group: "Interest",
    name: "Split attention",
    when: "More than one thing is going on (something playing, the pointer moving)",
    then: "The newest gets a look straight away; then Mote’s eyes move between them",
    status: "live",
  },
  {
    id: "check-in",
    group: "Interest",
    name: "Checking in",
    when: "Every 15–35 seconds while watching (sooner when restless, later when calm)",
    then: "Looks out at you for a moment, then back to watching",
    status: "live",
  },
  {
    id: "check-in-happy",
    group: "Interest",
    name: "Happy check-in",
    when: "A small chance on each check-in, bigger the happier Mote is",
    then: "A cute wiggle or a little hop",
    status: "live",
  },

  // Helping you
  {
    id: "given-folder",
    group: "Helping you",
    name: "Given a folder",
    when: "You drop a folder on Mote",
    then: "Offers the cleanup jobs: do all of them, any one of them, or done. After each job, says how it went and offers them again",
    status: "live",
  },
  {
    id: "given-videos",
    group: "Helping you",
    name: "Given videos",
    when: "You drop one or more video files on Mote",
    then: "Offers to trim the start, trim the end, or pull the audio out as an MP3, as many times and in whatever order you like",
    status: "live",
  },
  {
    id: "given-other",
    group: "Helping you",
    name: "Given something else",
    when: "You drop something that isn’t a folder or videos (or a mix)",
    then: "Says what they can help with instead",
    status: "live",
  },
  {
    id: "play",
    group: "Helping you",
    name: "Playing a game",
    when: "You drop a game on Mote: Chess, Minecraft, any app marked as a game or built with a game engine, Steam/GOG/Epic/Battle.net and their games (including Steam’s little shortcut apps)",
    then: "Chess: a long think, then a clever move and a smug look, or a blunder and a laugh. Minecraft: mines a block, or a creeper… BOOM. Other games: locks in, mashes buttons, wins or loses. May ask to go again",
    effects: { happy: 0.4, restless: -0.6 },
    status: "live",
  },
  {
    id: "offer-apple-app",
    group: "Helping you",
    name: "One of the Mac’s own apps",
    when: "You drop an app that came with the Mac: Safari, Music, Calculator, Photo Booth and about 60 more",
    then: "Says something about it and reacts: hums for Music, poses for Photo Booth, gets dizzy at Numbers…",
    status: "live",
  },
  {
    id: "offer-app",
    group: "Helping you",
    name: "Some other app",
    when: "You drop an app that isn’t a game",
    then: "“That’s an app, not a game. I can’t play that!”",
    status: "live",
  },
  {
    id: "link-saved",
    group: "Helping you",
    name: "Saving a link",
    when: "You drag a link (from a browser, or a link file from Finder) onto Mote",
    then: "Saves it, with a happy hop, to bring up some day",
    status: "live",
  },
  {
    id: "link-already",
    group: "Helping you",
    name: "Already saved",
    when: "You drag a link Mote already has",
    then: "“I already have that one!”",
    status: "live",
  },
  {
    id: "suggest-link",
    group: "Helping you",
    name: "Suggesting a saved link",
    when: "Now and then (about every 20 minutes at most, never within 12), when Mote is awake, nothing is playing and you’ve been around in the last couple of minutes",
    then: "Picks a saved link (favouring ones never suggested, ones you usually open, and ones not suggested lately) and asks if you’d like to go there",
    status: "live",
  },
  {
    id: "link-opened",
    group: "Helping you",
    name: "Opening a link",
    when: "You say yes to a suggested link",
    then: "Opens it in your browser, delighted",
    status: "live",
  },
  {
    id: "job-done",
    group: "Helping you",
    name: "Job done",
    when: "A job finishes without problems",
    then: "A happy hop, then a short report",
    effects: { happy: 0.4, restless: -0.3 },
    status: "live",
  },
  {
    id: "job-trouble",
    group: "Helping you",
    name: "Job had problems",
    when: "Some files in a job failed",
    then: "A worried look and a sheepish shrug, then says what went wrong",
    effects: { happy: -0.2 },
    status: "live",
  },
  {
    id: "spin",
    group: "Touch",
    name: "Rolled like a ball",
    when: "You scroll on Mote, or grab them and drag (a flick on letting go spins them on)",
    then: "Rolls the way you push, eyes travelling round the ball: blissful at a gentle roll, squeezing tighter the faster it goes, eyes blurring into bands at top speed (about 100 turns a second). Grabbing them stops it dead. As they slow they go woozy and turn back to face you",
    status: "live",
  },
  {
    id: "spin-caught",
    group: "Touch",
    name: "Caught mid-spin",
    when: "You press on Mote while they’re spinning",
    then: "Stops dead in your hand (not a poke); let go and they turn back to face you, dizzy if they’d been going a while",
    status: "live",
  },
  {
    id: "spun-dizzy",
    group: "Touch",
    name: "Dizzy from spinning",
    when: "A spin faster than about half a turn a second, or longer than a second and a half, comes to a stop",
    then: "Giddily dizzy, for longer the bigger the spin, then says something about it (different for how fast, how long and how many turns)",
    status: "live",
  },
  {
    id: "spun-little",
    group: "Touch",
    name: "A little twirl",
    when: "A small, slow spin stops",
    then: "A happy hop, and sometimes a word about it",
    status: "live",
  },
  {
    id: "poke-busy",
    group: "Touch",
    name: "Poked while busy",
    when: "You poke Mote while they’re working on a job",
    then: "Carries on working",
    status: "live",
  },

  // Speech
  {
    id: "speak",
    group: "Speech",
    name: "Speaking up",
    when: "Right after something happens (a pet, waking up, a meal, a game…), or when Mote needs something. Never just on a timer",
    then: "Says something that fits in a speech bubble",
    status: "live",
  },
  {
    id: "answer-yes",
    group: "Speech",
    name: "Green answer",
    when: "You press the green button on a question",
    then: "Depends on the question; usually pleased",
    status: "live",
  },
  {
    id: "answer-no",
    group: "Speech",
    name: "Red answer",
    when: "You press the red button on a question",
    then: "Depends on the question; sometimes a little hurt",
    status: "live",
  },
  {
    id: "answer-moved",
    group: "Speech",
    name: "Moved as asked",
    when: "Mote asks to go somewhere and you drag the window there",
    then: "Delighted with the new view",
    status: "live",
  },
  {
    id: "answer-petted",
    group: "Speech",
    name: "Petted as asked",
    when: "Mote asks for a pet and you give one",
    then: "Very content",
    status: "live",
  },
  {
    id: "answer-ignored",
    group: "Speech",
    name: "Ignored",
    when: "A question or request runs out of time",
    then: "Usually a little let down; the bubble goes away",
    status: "live",
  },
  {
    id: "needs",
    group: "Speech",
    name: "Asking for what they need",
    when: "Mote notices a need and it lasts 8–25 seconds: feeling down (Happy 3 or less) or restless (Restless 7½ or more). Never while helping you",
    then: "Asks for a pet, or to be moved somewhere new. If ignored, asks again only after a while",
    status: "live",
  },
  {
    id: "welcome-back",
    group: "Speech",
    name: "Welcome back",
    when: "You do something after 10 minutes or more away (move the pointer, type, touch Mote)",
    then: "Often says hello",
    effects: { happy: 0.5 },
    status: "live",
  },

  // Time
  {
    id: "doze",
    group: "Time",
    name: "Nodding off",
    when: "Left be for 4–7 minutes (nobody poking, petting or moving Mote’s window) with nothing intriguing going on",
    then: "Yawns, dozes, and falls asleep (unless something happens meanwhile). Can be switched off in Settings",
    status: "live",
  },
  {
    id: "fall-asleep",
    group: "Time",
    name: "Asleep",
    when: "A doze goes undisturbed",
    then: "Sleeps, breathing slowly, with little twitches. Only a poke, something starting to play, or something dropped on Mote wakes them",
    status: "live",
  },
  {
    id: "wake-rested",
    group: "Touch",
    name: "Woken after a proper nap",
    when: "You poke Mote after more than 3 minutes asleep (or drop something on them)",
    then: "Wakes up bright: “Good morning! …Is it morning?”",
    status: "live",
  },
  {
    id: "wake-groggy",
    group: "Touch",
    name: "Woken too soon",
    when: "You poke Mote while dozing or just after they dropped off",
    then: "Wakes up groggy: “Five more minutes…”",
    status: "live",
  },
  {
    id: "startled-awake",
    group: "Sound",
    name: "Startled awake",
    when: "Something starts playing while Mote is napping",
    then: "Jolts awake, eyes huge: “Who’s there?!”",
    status: "live",
  },
  {
    id: "drift-cross",
    group: "Time",
    name: "Left to themselves: crosser",
    when: "Every 6 minutes with nobody around (not while you use Mote’s window, type nearby, or Mote is helping you)",
    then: "Happy drops a step. Attention is what lifts Mote back up",
    status: "live",
  },
  {
    id: "drift-restless",
    group: "Time",
    name: "Left to themselves: restless",
    when: "Every 6 minutes awake with nobody around",
    then: "Restless rises a step. Petting and attention calm Mote down",
    status: "live",
  },
  {
    id: "friendly-floors",
    group: "Time",
    name: "Friendly mode’s limits",
    when: "Friendly mode is on",
    then: "However long Mote is left alone: Happy stays at 4 or above, Restless at 7 or below",
    status: "live",
  },
  {
    id: "idle-mood",
    group: "Time",
    name: "Idle moods",
    when: "Every so often, when Mote isn’t watching anything",
    then: "Does a little something: glance, think, cute, surprise… Never grumpy at random",
    status: "live",
  },

  // Lasting moods
  {
    id: "mood-frustrated",
    group: "Lasting moods",
    name: "Frustrated",
    when: "Happy is 2 or lower (rare: takes real pestering)",
    then: "Scowls; huffs, sulks and looks away; pokes make it worse",
    status: "live",
  },
  {
    id: "mood-annoyed",
    group: "Lasting moods",
    name: "Annoyed",
    when: "Happy is 3.5 or lower",
    then: "A slight scowl and fewer cute moods",
    status: "live",
  },
  {
    id: "mood-happy",
    group: "Lasting moods",
    name: "Happy",
    when: "Happy is 8 or higher",
    then: "Brighter eyes; hums and sways; more cute moods",
    status: "live",
  },
  {
    id: "mood-restless",
    group: "Lasting moods",
    name: "Restless",
    when: "Restless is 8 or higher",
    then: "Fidgets, looks around more, does things a bit more often",
    status: "live",
  },
  {
    id: "mood-calm",
    group: "Lasting moods",
    name: "Calm",
    when: "Restless is 2 or lower",
    then: "Slower breathing, fewer moods, long blinks",
    status: "live",
  },

  // Ideas for later
  {
    id: "idea-typing",
    group: "Ideas",
    name: "Busy typing",
    when: "You’re typing a lot in another app",
    then: "Intrigued: watches quietly and stays calm",
    effects: { restless: -0.5 },
    status: "idea",
  },
];

export const REACTION_GROUPS: ReactionGroup[] = [
  "Touch",
  "Pointer",
  "Window",
  "Sound",
  "Interest",
  "Helping you",
  "Speech",
  "Time",
  "Lasting moods",
  "Ideas",
];

export const reactionById = new Map(REACTIONS.map((r) => [r.id, r]));
