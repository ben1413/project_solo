export function chapterDisplayTitle(
  title: string | null | undefined,
  index: number
): string {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (trimmed.length > 0) return trimmed;
  return `Chapter ${index + 1}`;
}
