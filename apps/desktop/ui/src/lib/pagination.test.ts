import { expect, it } from "vitest";
import { shortcutPages } from "./pagination";
it("keeps imported high shortcut pages navigable without rendering thousands of buttons", () => {
  expect(shortcutPages(0, 1)).toEqual([0]);
  expect(shortcutPages(2, 4)).toEqual([0, 1, 2, 3]);
  expect(shortcutPages(100, 65536)).toEqual([
    0,
    "ellipsis",
    99,
    100,
    101,
    "ellipsis",
    65535,
  ]);
  expect(shortcutPages(65535, 65536)).toEqual([
    0,
    "ellipsis",
    65533,
    65534,
    65535,
  ]);
});
