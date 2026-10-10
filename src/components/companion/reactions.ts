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
  | "Things you give Mote"
  | "Learning"
  | "Speech"
  | "Accessories"
  | "Time and rest"
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
    effects: { happy: 0.5, alert: 0.3 },
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
    id: "wake-rested",
    group: "Touch",
    name: "Woken up, rested",
    when: "You poke a sleeping Mote who has rested enough",
    then: "Wakes up bright-eyed",
    effects: { happy: 0.5, alert: 2 },
    status: "live",
  },
  {
    id: "wake-groggy",
    group: "Touch",
    name: "Woken up too soon",
    when: "You poke a sleeping Mote who is still tired",
    then: "Wakes up, but not happy about it",
    effects: { happy: -1, alert: 1.5 },
    status: "live",
  },
  {
    id: "pet",
    group: "Touch",
    name: "Petting",
    when: "You press and keep stroking across Mote’s face (each second)",
    then: "Melts into a relaxed purr, leaning into your hand",
    effects: { happy: 0.3, restless: -0.3, alert: -0.15 },
    status: "live",
  },
  {
    id: "pet-asleep",
    group: "Touch",
    name: "Petting while asleep",
    when: "You stroke a sleeping Mote (each second)",
    then: "A sleepy purr, without waking up",
    effects: { happy: 0.15, restless: -0.15 },
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
    when: "You’ve been moving around near Mote for 15 seconds",
    then: "Cheers up a tiny bit",
    effects: { happy: 0.15, alert: 0.2 },
    status: "live",
  },
  {
    id: "shake-pointer",
    group: "Pointer",
    name: "Shaken pointer",
    when: "You whip the pointer around wildly",
    then: "Gets dizzy: swirling eyes, wobbling, then shakes it off",
    effects: { happy: -0.5, restless: 1, alert: 0.5 },
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
    effects: { alert: 0.3, restless: 0.3 },
    status: "live",
  },
  {
    id: "throw",
    group: "Window",
    name: "Window thrown around",
    when: "You shake the window back and forth hard",
    then: "Gets dizzy",
    effects: { happy: -0.75, restless: 1, alert: 0.5 },
    status: "live",
  },

  // Sound
  {
    id: "sound-start",
    group: "Sound",
    name: "Sound starts somewhere",
    when: "Another visible window starts playing sound",
    then: "Perks up and turns to watch it",
    effects: { alert: 0.5 },
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
    then: "Pays attention: does fewer random things, doesn’t get tired, won’t nap",
    status: "live",
  },
  {
    id: "intrigued-media",
    group: "Interest",
    name: "Intrigued by what’s playing",
    when: "A window you can see is actually playing sound or video (covered-up windows and paused players don’t count)",
    then: "Pays attention to it; the only thing Mote does is check in on you now and then",
    status: "live",
  },
  {
    id: "startled-awake",
    group: "Interest",
    name: "Startled awake",
    when: "Something starts playing while Mote is asleep",
    then: "Jolts awake, eyes huge, with a little shiver",
    effects: { alert: 3, restless: 1, happy: -0.3 },
    status: "live",
  },
  {
    id: "watching-video",
    group: "Interest",
    name: "Watching a video",
    when: "What’s playing looks like a video (the picture keeps moving)",
    then: "Keeps their eyes on it, looking away now and then for a break",
    status: "live",
  },
  {
    id: "look-away",
    group: "Interest",
    name: "A little break",
    when: "Every so often during a video",
    then: "Looks away for a moment instead of checking in",
    status: "live",
  },
  {
    id: "dancing",
    group: "Interest",
    name: "Dancing",
    when: "What’s playing is music with a beat",
    then: "Bobs and sways to its tempo, harder when it’s loud and lively, when Mote is happy, or when it’s a song they like",
    status: "live",
  },
  {
    id: "listening-in",
    group: "Interest",
    name: "Listening",
    when: "What’s playing is talk, or Mote can’t tell what it is",
    then: "Tilts their head toward it and listens, glancing over now and then",
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
    id: "swaying",
    group: "Interest",
    name: "Swaying along",
    when: "Music is playing but Mote can’t make out its beat (e.g. copy-protected songs)",
    then: "Sways gently instead of bouncing on the beat",
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
  {
    id: "nod-off",
    group: "Interest",
    name: "Nodding off while watching",
    when: "Mote is intrigued but really sleepy (Alert 2 or less)",
    then: "Starts to doze, then catches themself",
    status: "live",
  },
  {
    id: "drop-off",
    group: "Interest",
    name: "Falling asleep while watching",
    when: "Mote is intrigued but utterly exhausted (Alert ½ or less)",
    then: "Dozes off for real",
    status: "live",
  },

  // Things from the tray
  {
    id: "sleepset-on",
    group: "Things you give Mote",
    name: "Earmuffs and mask on",
    when: "You put the sleep set on Mote (from the tray)",
    then: "Mote can’t see or hear what’s playing, your pointer or your typing, so they sleep right through it",
    status: "live",
  },
  {
    id: "sleepset-sleepy",
    group: "Things you give Mote",
    name: "Just what they needed",
    when: "The sleep set goes on a sleepy Mote (Alert 4 or less)",
    then: "“Ooh, perfect. Night night…” and off to sleep",
    status: "live",
  },
  {
    id: "sleepset-awake",
    group: "Things you give Mote",
    name: "Not even sleepy",
    when: "The sleep set goes on a wide-awake Mote",
    then: "Asks if they have to: yes and they nap anyway, no (or no answer) and they take it off",
    status: "live",
  },
  {
    id: "sleepset-off",
    group: "Things you give Mote",
    name: "Earmuffs and mask off",
    when: "You take the sleep set off, or poke Mote awake while wearing it",
    then: "Taking it off doesn’t wake a sleeping Mote; awake, they blink at the light",
    status: "live",
  },
  {
    id: "snack",
    group: "Things you give Mote",
    name: "A snack",
    when: "You give Mote a cookie from the tray",
    then: "Leans in and munches it happily",
    effects: { happy: 0.5, alert: 0.2 },
    status: "live",
  },
  {
    id: "snack-full",
    group: "Things you give Mote",
    name: "Too many snacks",
    when: "A fourth cookie within five minutes",
    then: "“I’m full! Maybe later.”",
    status: "live",
  },
  {
    id: "play",
    group: "Things you give Mote",
    name: "Playing ball",
    when: "You toss Mote the ball from the tray",
    then: "Watches it bounce in, bops it with their head, and may ask to go again",
    effects: { happy: 0.4, restless: 0.3, alert: 0.5 },
    status: "live",
  },

  // Learning
  {
    id: "learning-taste",
    group: "Learning",
    name: "Learning what Mote likes",
    when: "Mote is happier or crosser while something plays, or you answer “do you like this?”",
    then: "Mote remembers that song or video, and likes or dislikes it more",
    status: "live",
  },
  {
    id: "media-liked",
    group: "Learning",
    name: "A favourite comes on",
    when: "Something Mote likes starts playing",
    then: "Delighted; dances harder, says so",
    effects: { happy: 0.5 },
    status: "live",
  },
  {
    id: "media-disliked",
    group: "Learning",
    name: "Not this again",
    when: "Something Mote dislikes starts playing",
    then: "Unimpressed: won’t dance, looks away more, may ask to skip it",
    effects: { happy: -0.5, restless: 0.3 },
    status: "live",
  },
  {
    id: "enjoying-media",
    group: "Learning",
    name: "Enjoying it",
    when: "Something Mote likes keeps playing (every 30 seconds)",
    then: "A little happier",
    effects: { happy: 0.15 },
    status: "live",
  },
  {
    id: "enduring-media",
    group: "Learning",
    name: "Putting up with it",
    when: "Something Mote dislikes keeps playing (every 30 seconds)",
    then: "A little crosser",
    effects: { happy: -0.15, restless: 0.1 },
    status: "live",
  },

  // Speech
  {
    id: "speak",
    group: "Speech",
    name: "Speaking up",
    when: "Every minute or two when Mote feels like it, or right after something happens",
    then: "Says something that fits the moment in a speech bubble",
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

  // Accessories
  {
    id: "wear-headphones",
    group: "Accessories",
    name: "Headphones on",
    when: "The cat-ear headphones go on",
    then: "Pleased; listens, bops and flicks an ear now and then",
    effects: { happy: 0.5 },
    status: "live",
  },
  {
    id: "wear-mustache",
    group: "Accessories",
    name: "Mustache on",
    when: "The bushy mustache goes on",
    then: "Pleased; twirls it, blows on it, nearly sneezes",
    effects: { happy: 0.5 },
    status: "live",
  },

  // Time and rest
  {
    id: "drift",
    group: "Time and rest",
    name: "Settling back",
    when: "Every 2 minutes",
    then: "Happy and Restless each take one step back toward 5",
    status: "live",
  },
  {
    id: "tiring",
    group: "Time and rest",
    name: "Getting tired",
    when: "Every 16 minutes awake and not intrigued by anything",
    then: "Alertness drops a step, so Mote slowly gets sleepy",
    effects: { alert: -1 },
    status: "live",
  },
  {
    id: "idle-mood",
    group: "Time and rest",
    name: "Idle moods",
    when: "Every so often, when Mote isn’t watching anything",
    then: "Does a little something: glance, think, cute, surprise… Never grumpy or asleep at random",
    status: "live",
  },
  {
    id: "doze",
    group: "Time and rest",
    name: "Dozing off",
    when: "Left completely alone for a while and properly sleepy (Alert 2 or less)",
    then: "Dozes, then falls asleep. Only a poke wakes Mote",
    status: "live",
  },
  {
    id: "resting",
    group: "Time and rest",
    name: "Resting",
    when: "Every 60 seconds asleep (or with the app closed)",
    then: "Recharges: more alert, calmer",
    effects: { alert: 1.5, restless: -1 },
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
  {
    id: "mood-sleepy",
    group: "Lasting moods",
    name: "Sleepy",
    when: "Alert is 2 or lower",
    then: "Heavy eyelids, slow blinks, yawns",
    status: "live",
  },
  {
    id: "mood-alert",
    group: "Lasting moods",
    name: "Alert",
    when: "Alert is 8 or higher",
    then: "Wide eyes, perked ears; won’t doze off",
    status: "live",
  },

  // Ideas for later
  {
    id: "idea-night",
    group: "Ideas",
    name: "Night time",
    when: "It’s late at night",
    then: "Gets sleepy faster",
    effects: { alert: -1 },
    status: "idea",
  },
  {
    id: "idea-mac-wakes",
    group: "Ideas",
    name: "Mac wakes up",
    when: "Your Mac wakes from sleep",
    then: "Wakes up too, a little groggy",
    status: "idea",
  },
  {
    id: "idea-typing",
    group: "Ideas",
    name: "Busy typing",
    when: "You’re typing a lot in another app",
    then: "Intrigued: watches quietly and stays calm",
    effects: { restless: -0.5 },
    status: "idea",
  },
  {
    id: "idea-welcome-back",
    group: "Ideas",
    name: "Welcome back",
    when: "You come back after hours away",
    then: "Excited to see you",
    effects: { happy: 1, alert: 1 },
    status: "idea",
  },
];

export const REACTION_GROUPS: ReactionGroup[] = [
  "Touch",
  "Pointer",
  "Window",
  "Sound",
  "Interest",
  "Things you give Mote",
  "Learning",
  "Speech",
  "Accessories",
  "Time and rest",
  "Lasting moods",
  "Ideas",
];

export const reactionById = new Map(REACTIONS.map((r) => [r.id, r]));
