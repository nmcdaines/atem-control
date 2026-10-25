import { expect, test } from "@playwright/test";
import type { Config, Snapshot } from "../src/bindings";

let baseline: Config;
test.beforeAll(async ({ request }) => {
  const response = await request.get("http://127.0.0.1:3849/api/snapshot");
  baseline = ((await response.json()) as Snapshot).config;
});
test.beforeEach(async ({ request, page }) => {
  await request.post("http://127.0.0.1:3849/api/config", { data: baseline });
  await page.goto("/");
  await expect(
    page.getByText("RUST CORE ONLINE", { exact: true }),
  ).toBeVisible();
});
test.afterAll(async ({ request }) => {
  if (baseline)
    await request.post("http://127.0.0.1:3849/api/config", { data: baseline });
});

test("switches preview/program and runs a combined camera/switcher cue", async ({
  page,
  request,
}) => {
  const row = page.locator(".input-row").nth(1);
  await row.getByRole("button", { name: "04 Camera 4" }).click();
  await expect(row.getByRole("button", { name: "04 Camera 4" })).toHaveClass(
    /preview/,
  );
  await page.getByRole("button", { name: "CUT", exact: true }).click();
  await expect(
    page
      .locator(".input-row")
      .first()
      .getByRole("button", { name: "04 Camera 4" }),
  ).toHaveClass(/program/);
  await page.locator(".cue").filter({ hasText: "Camera 1 → program" }).click();
  await expect(page.locator(".history-row .run-status")).toHaveText(
    "completed",
  );
  const state = (await (
    await request.get("http://127.0.0.1:3849/api/snapshot")
  ).json()) as Snapshot;
  expect(
    state.devices.find((d) => d.device_id === "demo-atem")?.switcher?.program,
  ).toBe(1);
  expect(
    state.devices.find((d) => d.device_id === "demo-camera")?.camera?.pan,
  ).toBe(120);
  await page.screenshot({
    path: "../../../.local/surface.png",
    fullPage: true,
  });
});

test("edits a macro with a wait and cancels before its cut", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Macros", exact: true }).click();
  await page.getByRole("button", { name: "+ New macro", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Wait then cut");
  await page.getByLabel("Command", { exact: true }).selectOption("cut");
  await page.getByRole("button", { name: "+ Wait", exact: true }).click();
  await page.getByLabel("Wait duration (ms)").fill("60000");
  await page.getByRole("button", { name: "Move step 2 up" }).click();
  await page.getByRole("button", { name: "Save macro", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Macro editor" }),
  ).not.toBeVisible();
  await page
    .locator('[role="article"].cue')
    .filter({ hasText: "Wait then cut" })
    .getByRole("button", { name: "Run", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Cancel run" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel run" }).click();
  await expect(page.locator(".history-row .run-status").first()).toHaveText(
    "cancelled",
  );
});

test("saves an observed camera preset and assigns it to a shortcut", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Cameras", exact: true }).click();
  await page.getByLabel("Target pan", { exact: true }).fill("80");
  await page
    .getByRole("button", { name: "Move to position", exact: true })
    .click();
  await expect(
    page.locator(".position-display").getByText("80", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Save observed position").fill("Wide shot");
  await page.getByRole("button", { name: "Save preset", exact: true }).click();
  await page.getByRole("button", { name: "Shortcuts", exact: true }).click();
  await page.getByLabel("Assign slot 2", { exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search macros…" });
  await search.fill("wide");
  const listbox = page.getByRole("listbox");
  await expect(listbox.getByRole("option")).toHaveCount(1);
  await search.fill("nothing like this");
  await expect(listbox.getByText("No matches")).toBeVisible();
  await search.fill("WIDE");
  await search.press("Enter");
  await expect(page.locator(".shortcut").nth(1).getByRole("button")).toHaveText(
    /Wide shot/,
  );
  await page.reload();
  await page.getByRole("button", { name: "Shortcuts", exact: true }).click();
  await expect(page.locator(".shortcut").nth(1).getByRole("button")).toHaveText(
    /Wide shot/,
  );
  await page.getByLabel("Assign slot 2", { exact: true }).click();
  await page.getByRole("option", { name: "Unassign" }).click();
  await expect(page.locator(".shortcut").nth(1).getByRole("button")).toHaveText(
    "Unassigned",
  );
});

test("reports invalid imports and keeps existing devices", async ({ page }) => {
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page
    .getByLabel("Configuration JSON")
    .fill(
      JSON.stringify({ version: 99, devices: [], macros: [], shortcuts: [] }),
    );
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back up & replace workspace", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Unsupported configuration version",
  );
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ATEM Mini · simulator", exact: true }),
  ).toBeVisible();
});

test("reviews a PostgreSQL preview and applies it only after review", async ({
  page,
  request,
}) => {
  const imported = structuredClone(baseline);
  imported.devices[0].name = "Imported ATEM";
  await page.route("**/api/postgres", async (route) => {
    const settings = route.request().postDataJSON();
    expect(settings.database).toBe("nestjs");
    expect(settings.schema).toBe("public");
    await route.fulfill({
      json: { config: imported, warnings: ["Read-only PostgreSQL snapshot."] },
    });
  });
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page
    .getByLabel("PostgreSQL username", { exact: true })
    .fill("test-reader");
  const tls = page.getByRole("checkbox", {
    name: "Require TLS and verify the server certificate",
  });
  await tls.check();
  await expect(tls).toBeChecked();
  await tls.uncheck();
  await page
    .getByLabel("PostgreSQL password", { exact: true })
    .fill("transient-test-password");
  await page
    .getByRole("button", {
      name: "Read PostgreSQL & review import",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("PostgreSQL password", { exact: true }),
  ).toHaveValue("");
  const before = (await (
    await request.get("http://127.0.0.1:3849/api/snapshot")
  ).json()) as Snapshot;
  expect(before.config.devices[0].name).toBe(baseline.devices[0].name);
  await page
    .getByRole("button", { name: "Back up & replace workspace", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Imported ATEM", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(
    page.getByLabel("PostgreSQL username", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("PostgreSQL password", { exact: true }),
  ).toHaveValue("");
});

test("failed PostgreSQL connection clears its password and leaves the workspace intact", async ({
  page,
  request,
}) => {
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.getByLabel("PostgreSQL host", { exact: true }).fill("127.0.0.1");
  await page.getByLabel("PostgreSQL port", { exact: true }).fill("1");
  await page
    .getByLabel("PostgreSQL username", { exact: true })
    .fill("test-reader");
  await page
    .getByLabel("PostgreSQL password", { exact: true })
    .fill("transient-test-password");
  await page
    .getByRole("button", {
      name: "Read PostgreSQL & review import",
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not read PostgreSQL",
  );
  await expect(page.getByRole("alert")).not.toContainText(
    "transient-test-password",
  );
  await expect(
    page.getByLabel("PostgreSQL password", { exact: true }),
  ).toHaveValue("");
  const after = (await (
    await request.get("http://127.0.0.1:3849/api/snapshot")
  ).json()) as Snapshot;
  expect(after.config).toEqual(baseline);
});

test("shortcut pagination stays below the grid and preserves page assignments", async ({
  page,
  request,
}) => {
  await page.getByRole("button", { name: "Shortcuts", exact: true }).click();
  const pagination = page.getByRole("navigation", { name: "Shortcut pages" });
  await expect(
    pagination.getByRole("button", { name: "Previous shortcut page" }),
  ).toBeDisabled();
  await expect(
    pagination.getByRole("button", { name: "Next shortcut page" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Shortcut page 2", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Assign slot 2", { exact: true }).click();
  await page
    .getByRole("option", { name: new RegExp(baseline.macros[0].name) })
    .click();
  await expect(page.locator(".shortcut").nth(1).getByRole("button")).toHaveText(
    new RegExp(baseline.macros[0].name),
  );
  await pagination
    .getByRole("button", { name: "Previous shortcut page" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Shortcut page 1", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".shortcut").nth(1).getByRole("button")).toHaveText(
    "Unassigned",
  );
  await pagination.getByRole("button", { name: "Next shortcut page" }).click();
  await expect(
    pagination.getByRole("button", { name: "Shortcut page 2", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const grid = await page.locator(".shortcut-grid").boundingBox();
  const pager = await pagination.boundingBox();
  expect(pager!.y).toBeGreaterThan(grid!.y + grid!.height);
  const saved = (await (
    await request.get("http://127.0.0.1:3849/api/snapshot")
  ).json()) as Snapshot;
  expect(
    saved.config.shortcuts.some(
      (shortcut) => shortcut.page === 1 && shortcut.slot === 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../../.local/shortcuts-shadcn.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "Shortcuts", exact: true }).click();
  await page
    .getByRole("button", { name: "Shortcut page 2", exact: true })
    .click();
  await expect(page.locator(".shortcut").nth(1).getByRole("button")).toHaveText(
    new RegExp(baseline.macros[0].name),
  );
});

test("PTZ sliders and canvas edit a draft until movement and zoom are applied", async ({
  page,
  request,
}) => {
  await page.getByRole("button", { name: "Cameras", exact: true }).click();
  const snapshot = async () =>
    (await (
      await request.get("http://127.0.0.1:3849/api/snapshot")
    ).json()) as Snapshot;
  const before = (await snapshot()).devices.find(
    (device) => device.device_id === "demo-camera",
  )!.camera;
  const pan = page.getByRole("slider", { name: "Target X (pan)", exact: true });
  const tilt = page.getByRole("slider", {
    name: "Target Y (tilt)",
    exact: true,
  });
  const zoom = page.getByRole("slider", { name: "Target zoom", exact: true });
  await pan.focus();
  await pan.press("End");
  await tilt.focus();
  await tilt.press("Home");
  await zoom.focus();
  await zoom.press("End");
  await expect(page.getByLabel("Target pan", { exact: true })).toHaveValue(
    "32767",
  );
  await expect(page.getByLabel("Target tilt", { exact: true })).toHaveValue(
    "-32767",
  );
  await expect(zoom).toHaveAttribute("aria-valuenow", "16384");
  await expect(tilt).toHaveAttribute("aria-orientation", "vertical");
  const canvas = page.getByRole("img", { name: /^PTZ target map:/ });
  await expect(canvas).toHaveAccessibleName(/X 32767, Y -32767, zoom 16384/);
  expect(
    (await snapshot()).devices.find(
      (device) => device.device_id === "demo-camera",
    )!.camera,
  ).toEqual(before);
  await page
    .getByRole("button", { name: "Move to position", exact: true })
    .click();
  await page.getByRole("button", { name: "Set zoom", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await snapshot()).devices.find(
          (device) => device.device_id === "demo-camera",
        )!.camera,
    )
    .toEqual({ pan: 32767, tilt: -32767, zoom: 16384 });
  await canvas.focus();
  await canvas.press("ArrowLeft");
  await expect(page.getByLabel("Target pan", { exact: true })).toHaveValue(
    "32439",
  );
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  expect(
    Math.abs(
      Number(await page.getByLabel("Target pan", { exact: true }).inputValue()),
    ),
  ).toBeLessThan(500);
  expect(
    Math.abs(
      Number(
        await page.getByLabel("Target tilt", { exact: true }).inputValue(),
      ),
    ),
  ).toBeLessThan(500);
  expect(
    (await snapshot()).devices.find(
      (device) => device.device_id === "demo-camera",
    )!.camera!.pan,
  ).toBe(32767);
  // Single-axis moves keep the other axis at its observed position.
  const camera = async () =>
    (await snapshot()).devices.find(
      (device) => device.device_id === "demo-camera",
    )!.camera;
  await page.getByLabel("Target pan", { exact: true }).fill("100");
  await page.getByLabel("Target tilt", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Pan only", exact: true }).click();
  await expect.poll(camera).toEqual({ pan: 100, tilt: -32767, zoom: 16384 });
  await page.getByRole("button", { name: "Tilt only", exact: true }).click();
  await expect.poll(camera).toEqual({ pan: 100, tilt: 200, zoom: 16384 });
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect.poll(camera).toEqual({ pan: 0, tilt: 0, zoom: 0 });
  await expect(page.getByLabel("Target pan", { exact: true })).toHaveValue("0");
  await page.getByRole("slider", { name: "Target zoom", exact: true }).focus();
  await page
    .getByRole("slider", { name: "Target zoom", exact: true })
    .press("End");
  const targetZoom = () =>
    page
      .getByRole("slider", { name: "Target zoom", exact: true })
      .getAttribute("aria-valuenow")
      .then(Number);
  await canvas.hover();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 500);
  await expect.poll(targetZoom).toBe(8192);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await page.mouse.wheel(0, -250);
  await expect.poll(targetZoom).toBe(12288);
  // Pinch out with two real touch points: doubling the spread adds half the range.
  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 2,
  });
  const pinchBox = (await canvas.boundingBox())!;
  const cx = pinchBox.x + pinchBox.width / 2,
    cy = pinchBox.y + pinchBox.height / 2;
  const fingers = (spread: number) => [
    { x: cx - spread, y: cy, id: 0 },
    { x: cx + spread, y: cy, id: 1 },
  ];
  await zoom.focus();
  await zoom.press("Home");
  await expect.poll(targetZoom).toBe(0);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: fingers(20),
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: fingers(40),
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect.poll(targetZoom).toBe(8192);
  await touch.detach();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../../.local/ptz-shadcn.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "../../../.local/ptz-mobile.png",
    fullPage: true,
  });
});

test("docked device panels expand, control devices and stay collapsed after reload", async ({
  page,
  request,
}) => {
  const snapshot = async () =>
    (await (
      await request.get("http://127.0.0.1:3849/api/snapshot")
    ).json()) as Snapshot;
  const { config } = await snapshot();
  const camera = config.devices.find((d) => d.id === "demo-camera")!;
  const switcher = config.devices.find(
    (d) => d.connection.type === "simulation" && d.connection.kind === "atem",
  )!;
  const dock = page.getByRole("complementary", { name: "Device dock" });
  const header = (name: string) =>
    dock.locator("button[aria-expanded]").filter({ hasText: name });
  for (const device of config.devices)
    await expect(header(device.name)).toHaveAttribute("aria-expanded", "false");

  await header(camera.name).click();
  await expect(header(camera.name)).toHaveAttribute("aria-expanded", "true");
  await dock
    .getByRole("button", { name: `${camera.name} Home`, exact: true })
    .click();
  const observed = () =>
    snapshot().then(
      (s) => s.devices.find((d) => d.device_id === camera.id)!.camera,
    );
  await expect.poll(observed).toEqual({ pan: 0, tilt: 0, zoom: 0 });
  await dock
    .getByRole("button", { name: `${camera.name} Pan right`, exact: true })
    .click();
  await expect.poll(observed).toEqual({ pan: 1638, tilt: 0, zoom: 0 });
  await dock
    .getByRole("button", { name: `${camera.name} Zoom in`, exact: true })
    .click();
  await expect.poll(observed).toEqual({ pan: 1638, tilt: 0, zoom: 1638 });

  await header(switcher.name).click();
  const program = dock.getByRole("group", {
    name: `${switcher.name} Program`,
  });
  await program.getByRole("button").nth(1).click();
  await expect(program.getByRole("button").nth(1)).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await header(camera.name).click();
  await page.reload();
  await expect(header(camera.name)).toHaveAttribute("aria-expanded", "false");
  await expect(header(switcher.name)).toHaveAttribute("aria-expanded", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "../../../.local/device-dock.png" });
});
