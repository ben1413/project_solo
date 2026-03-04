/**
 * Format meeting end time for list display: "Dec 23rd 2026, 10:30am"
 */
export function formatMeetingDate(d: Date): string {
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const day = d.getDate();
  const suffix = day === 11 || day === 12 || day === 13 ? "th" : ["th", "st", "nd", "rd"][Math.min(day % 10, 3)];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours();
  const mins = d.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  const h = hours % 12 || 12;
  const m = mins < 10 ? `0${mins}` : mins;
  return `${month} ${day}${suffix} ${year}, ${h}:${m}${ampm}`;
}
