// Runs in the browser: shows whether the business is open now and marks today's hours, using
// the visitor's clock in the business's time zone. Without JavaScript nothing is lost: the
// full table of hours is always in the page.
import { localTime, statusAt, type WeekSchedule } from "@brotasites/schema/hours";

const source = document.querySelector<HTMLElement>("[data-schedule]");
if (source) {
  const week = JSON.parse(source.dataset.week ?? "null") as WeekSchedule | null;
  const { weekday, minute } = localTime(new Date(), source.dataset.tz ?? "America/Sao_Paulo");
  const status = week ? statusAt(week, weekday, minute) : null;
  if (status) {
    for (const element of document.querySelectorAll<HTMLElement>("[data-open-status]")) {
      element.textContent = `${status.label} · ${status.detail}`;
      element.dataset.open = String(status.open);
      element.hidden = false;
    }
  }
  for (const row of document.querySelectorAll<HTMLElement>("[data-days]")) {
    if ((row.dataset.days ?? "").split(",").map(Number).includes(weekday)) row.dataset.today = "";
  }
}
