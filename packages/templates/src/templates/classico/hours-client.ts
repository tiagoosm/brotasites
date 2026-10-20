// Runs in the browser: fills the door sign and marks today's opening hours,
// using the visitor's clock converted to the business's time zone.
import { localTime, statusAt, type WeekSchedule } from "../../lib/hours";

const source = document.querySelector<HTMLElement>("[data-schedule]");

if (source) {
  const week = JSON.parse(source.dataset.week ?? "[]") as WeekSchedule;
  const { weekday, minute } = localTime(new Date(), source.dataset.tz ?? "America/Sao_Paulo");

  const status = week.length ? statusAt(week, weekday, minute) : null;
  if (status) {
    for (const sign of document.querySelectorAll<HTMLElement>("[data-door-sign]")) {
      const label = sign.querySelector("[data-sign-label]");
      const detail = sign.querySelector("[data-sign-detail]");
      if (label) label.textContent = status.label;
      if (detail) detail.textContent = status.detail;
      sign.dataset.state = status.open ? "open" : "closed";
      sign.hidden = false;
    }
  }

  // Highlight today's row and show today's hours under the hero.
  let todayHours: string | undefined;
  for (const row of document.querySelectorAll<HTMLElement>("[data-days]")) {
    const days = (row.dataset.days ?? "").split(",").map(Number);
    if (!days.includes(weekday)) continue;
    row.dataset.today = "";
    row.querySelector("[data-today-badge]")?.removeAttribute("hidden");
    todayHours ??= row.dataset.rowHours;
  }
  const todayFact = document.querySelector<HTMLElement>("[data-today-fact]");
  const todayValue = todayFact?.querySelector("[data-today-value]");
  if (todayFact && todayValue && todayHours) {
    todayValue.textContent = todayHours;
    todayFact.hidden = false;
  }
}
