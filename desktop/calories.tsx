import { createRoot } from "react-dom/client";
import {
  averageIntake,
  colorFor,
  dateKey,
  type CalorieBook,
} from "@/lib/companion/calories";
import { useCalorieBook } from "@/lib/companion/calorie-store";
import { useSettings } from "@/lib/companion/settings";
import { Page } from "./ui";
import "./calories.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthsOf(startMonth: string, now: Date) {
  const [sy, sm] = startMonth.split("-").map(Number);
  const list: Array<{ y: number; m: number }> = [];
  let y = now.getFullYear();
  let m = now.getMonth();
  const startY = sy ?? y;
  const startM = (sm ?? m + 1) - 1;
  while (y > startY || (y === startY && m >= startM)) {
    list.push({ y, m });
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (list.length > 240) break;
  }
  return list;
}

function standing(y: number, m: number, d: number, now: Date) {
  const cell = new Date(y, m, d).setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).setHours(0, 0, 0, 0);
  if (cell > today) return "future";
  if (cell === today) return "today";
  return "past";
}

function Days() {
  const [settings] = useSettings();
  const [book] = useCalorieBook();
  const goal = settings.calorieGoal;
  const now = new Date();
  const today = dateKey(now);
  const todayTotal = book.days[today]?.total ?? 0;
  const months = monthsOf(book.startMonth, now);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const sevenStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  return (
    <Page wide>
      <header className="days-head">
        <div>
          <h1>Days</h1>
          <p>
            {goal > 0
              ? `Goal ${goal.toLocaleString()}. Change it in Settings.`
              : "Set a daily goal in Settings and the colors will show how close you came."}
          </p>
          <p className="days-now">
            Today · <strong>{todayTotal.toLocaleString()}</strong>
            {goal > 0 ? <span> of {goal.toLocaleString()}</span> : null}
          </p>
        </div>
        <div className="days-stats">
          <Stat label="This week" value={averageIntake(book, weekStart, now)} />
          <Stat label="Last 7 days" value={averageIntake(book, sevenStart, now)} />
        </div>
      </header>
      {months.map((month) => (
        <Month key={`${month.y}-${month.m}`} y={month.y} m={month.m} book={book} goal={goal} now={now} />
      ))}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="days-stat">
      <span>{label}</span>
      <strong>{value === null ? "—" : value.toLocaleString()}</strong>
    </div>
  );
}

function Month({
  y,
  m,
  book,
  goal,
  now,
}: {
  y: number;
  m: number;
  book: CalorieBook;
  goal: number;
  now: Date;
}) {
  const first = new Date(y, m, 1).getDay();
  const count = new Date(y, m + 1, 0).getDate();
  const cells: Array<{ d: number } | null> = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: count }, (_, i) => ({ d: i + 1 })),
  ];
  return (
    <section className="month">
      <h2>
        {MONTHS[m]}
        <span>{y}</span>
      </h2>
      <div className="weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="day-grid">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`b-${i}`} className="day is-blank" />;
          const key = dateKey(new Date(y, m, cell.d));
          const when = standing(y, m, cell.d, now);
          const entry = book.days[key];
          const show = when === "today" || !!entry;
          const total = entry?.total ?? 0;
          const colored = show && goal > 0;
          return (
            <div
              key={key}
              className={`day${when === "future" ? " is-future" : ""}${when === "today" ? " is-today" : ""}${colored ? " has-color" : ""}`}
              style={colored ? { background: colorFor(total, goal) } : undefined}
            >
              <div className="day-num">{cell.d}</div>
              {show && when !== "future" ? (
                <div className="day-cal">
                  {total.toLocaleString()}
                  <small>cal</small>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(<Days />);
