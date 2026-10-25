export function shortcutPages(
  current: number,
  count: number,
): Array<number | "ellipsis"> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const visible = new Set([0, count - 1, current, current - 1, current + 1]);
  if (current <= 1) visible.add(2);
  if (current >= count - 2) visible.add(count - 3);
  const pages = [...visible]
    .filter((page) => page >= 0 && page < count)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  for (const page of pages) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && page - previous > 1)
      result.push("ellipsis");
    result.push(page);
  }
  return result;
}
