import { useCallback, useEffect, useRef, useState } from "react";
import { listenBus, send } from "@/lib/companion/bus";
import {
  emptyBook,
  readBook,
  writeBook,
  type CalorieBook,
} from "@/lib/companion/calories";

/** Save the days and tell every other Mote window. */
export function commitBook(book: CalorieBook) {
  writeBook(book);
  send({ type: "calories", book });
}

/** The first time you open the days, set a goal, or log something. */
export function markCalorieCare() {
  const book = readBook();
  if (book.care) return;
  commitBook({ ...book, care: true });
}

/** The saved days, kept in step across Mote's windows. */
export function useCalorieBook() {
  const [book, setBook] = useState<CalorieBook>(emptyBook);
  const current = useRef(book);
  current.current = book;

  useEffect(() => {
    setBook(readBook());
    const stop = listenBus((msg) => {
      if (msg.type === "calories") setBook(msg.book);
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === "mote.calories") setBook(readBook());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      stop();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const commit = useCallback((next: CalorieBook) => {
    current.current = next;
    setBook(next);
    commitBook(next);
  }, []);

  return [book, commit] as const;
}
