import type { Gender } from "@/lib/companion/settings";
import { useSettings } from "@/lib/companion/settings";

/**
 * Mote's pronouns follow the Gender setting. Any text that refers to Mote
 * should be built from these, never written as a fixed "he" / "she" / "they".
 */
export type Pronouns = {
  they: string;
  them: string;
  their: string;
  theirs: string;
  themself: string;
  They: string;
  Them: string;
  Their: string;
  /** Picks the verb form: `p.s("does", "do")` → "does" for he/she, "do" for they. */
  s: (singular: string, plural: string) => string;
};

const SETS: Record<Gender, [string, string, string, string, string, boolean]> = {
  man: ["he", "him", "his", "his", "himself", false],
  nonbinary: ["they", "them", "their", "theirs", "themself", true],
  woman: ["she", "her", "her", "hers", "herself", false],
};

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export function pronounsFor(gender: Gender): Pronouns {
  const [they, them, their, theirs, themself, plural] = SETS[gender];
  return {
    they,
    them,
    their,
    theirs,
    themself,
    They: cap(they),
    Them: cap(them),
    Their: cap(their),
    s: (singular, pluralForm) => (plural ? pluralForm : singular),
  };
}

/** Mote's current pronouns, updating live when the setting changes. */
export function usePronouns(): Pronouns {
  const [settings] = useSettings();
  return pronounsFor(settings.gender);
}
