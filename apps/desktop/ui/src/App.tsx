import {
  LayoutDashboard,
  Camera as CameraIcon,
  ListVideo,
  Command as CommandIcon,
  Plug,
  Settings2,
  PanelsTopLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { PtzPositionControl } from "@/components/ptz-position";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { shortcutPages } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { NativeSelectOption } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Notice } from "@/components/notice";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api } from "./api";
import PostgresImport from "./PostgresImport";
import type {
  Action,
  Command,
  Config,
  Device,
  DeviceState,
  Macro,
  Snapshot,
  Step,
} from "./bindings";
import {
  commandNames,
  commands,
  defaultCommand,
  kind,
  moveStep,
  newAction,
  removeMacro,
} from "./editor";
type Task = (work: () => Promise<unknown>) => Promise<void>;
type Save = (config: Config) => Promise<unknown>;
const id = () => crypto.randomUUID();
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const tabs = [
  "Surface",
  "Cameras",
  "Macros",
  "Shortcuts",
  "Devices",
  "Workspace",
] as const;
type Tab = (typeof tabs)[number];
const navIcons = [
  LayoutDashboard,
  CameraIcon,
  ListVideo,
  CommandIcon,
  Plug,
  Settings2,
];
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Label className="my-3 grid items-stretch gap-2 leading-normal">
      {label}
      <Input
        type="number"
        required
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Label>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">◈</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
function Status({
  state,
  simulated,
}: {
  state?: DeviceState;
  simulated: boolean;
}) {
  return (
    <Badge
      className={`status ${state?.status ?? "disconnected"}`}
      variant="outline"
    >
      <i />
      {simulated
        ? "SIMULATED"
        : (state?.status?.toUpperCase() ?? "DISCONNECTED")}
    </Badge>
  );
}
export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [tab, setTab] = useState<Tab>("Surface");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(false);
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    const next = await api.snapshot();
    if (mounted.current) {
      setSnapshot(next);
      setOnline(true);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const poll = async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) {
          setOnline(false);
          setError(message(e));
        }
      }
      if (!cancelled) timer = setTimeout(poll, 350);
    };
    void poll();
    return () => {
      cancelled = true;
      mounted.current = false;
      clearTimeout(timer);
    };
  }, [refresh]);
  const task: Task = async (work) => {
    setPending(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setPending(false);
    }
  };
  const active = snapshot?.runs.find((run) => run.status === "running");
  const disabled = pending || !online || !!active;
  const save: Save = async (config) => {
    await api.save(config);
    await refresh();
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setTab("Surface")}>
          <PanelsTopLeft aria-hidden="true" className="brand-mark" />
          <span>
            ATEM<span className="brand-light"> / CONTROL</span>
          </span>
        </a>
        <div className="nav-caption">PRODUCTION WORKSPACE</div>
        <nav>
          {tabs.map((name, index) => {
            const Icon = navIcons[index];
            return (
              <Button
                key={name}
                className={cn(
                  "h-10 justify-start gap-3 text-sm text-muted-foreground",
                  tab === name && "bg-accent text-accent-foreground",
                )}
                onClick={() => setTab(name)}
                variant="ghost"
                aria-current={tab === name ? "page" : undefined}
              >
                <Icon aria-hidden="true" className="size-4" />
                {name}
              </Button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <Badge
            className={`status ${online ? "connected" : "error"}`}
            variant="outline"
          >
            <i />
            {online ? "RUST CORE ONLINE" : "CORE OFFLINE"}
          </Badge>
          <p>Local control. Shared workflow.</p>
          <small>NDI integration · planned</small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <div className="eyebrow">ATEM + PTZ</div>
            <h1>{tab}</h1>
            <p>
              {
                {
                  Surface: "Your switcher, cameras and cues in one place.",
                  Cameras: "Frame the next shot. Save it for later.",
                  Macros: "Build repeatable sequences across your devices.",
                  Shortcuts: "The right cue, one button away.",
                  Devices: "Configure the devices in your production.",
                  Workspace: "Back up, restore and migrate your configuration.",
                }[tab]
              }
            </p>
          </div>
          <div className="header-meta">
            <Badge className="chip" variant="outline">
              DESKTOP PREVIEW
            </Badge>
            <span>{snapshot?.config.devices.length ?? 0} devices</span>
          </div>
        </header>
        {error && (
          <Alert
            role="alert"
            variant="destructive"
            className="alert mb-5 flex items-start justify-between gap-4"
          >
            <span>{error}</span>
            <Button
              aria-label="Dismiss error"
              onClick={() => setError("")}
              variant="outline"
            >
              ×
            </Button>
          </Alert>
        )}
        {active && (
          <div className="running" role="status">
            <span className="pulse" />
            <strong>{active.name}</strong>
            <Progress
              className="h-1.5 w-28"
              value={(active.completed_steps / active.total_steps) * 100}
              aria-label="Macro run progress"
            />
            <span>
              Step {Math.min(active.completed_steps + 1, active.total_steps)} of{" "}
              {active.total_steps}
            </span>
            <Button
              onClick={() => void task(() => api.cancel(active.id))}
              variant="destructive"
            >
              Cancel run
            </Button>
          </div>
        )}
        {!snapshot ? (
          <Empty title="Connecting to the Rust core">
            For a browser preview, start cargo run -p control-server and npm run
            dev. The desktop app starts its core automatically.
          </Empty>
        ) : (
          <>
            {!snapshot.config.devices.length && (
              <div className="welcome">
                <div>
                  <strong>Start with a simulated production</strong>
                  <p>
                    Try a switcher, camera and combined macro without connecting
                    hardware.
                  </p>
                </div>
                <Button
                  disabled={disabled}
                  onClick={() => void task(api.demo)}
                  variant="default"
                >
                  Load demo workspace
                </Button>
              </div>
            )}
            {tab === "Surface" && (
              <Surface snapshot={snapshot} disabled={disabled} task={task} />
            )}
            {tab === "Cameras" && (
              <Cameras
                snapshot={snapshot}
                disabled={disabled}
                task={task}
                save={save}
              />
            )}
            {tab === "Macros" && (
              <Macros
                snapshot={snapshot}
                disabled={disabled}
                task={task}
                save={save}
              />
            )}
            {tab === "Shortcuts" && (
              <Shortcuts
                snapshot={snapshot}
                disabled={disabled}
                task={task}
                save={save}
              />
            )}
            {tab === "Devices" && (
              <Devices
                snapshot={snapshot}
                disabled={disabled}
                task={task}
                save={save}
              />
            )}
            {tab === "Workspace" && (
              <Workspace
                config={snapshot.config}
                disabled={disabled}
                task={task}
              />
            )}
            {snapshot.runs.length > 0 && (
              <section className="history">
                <div className="section-heading">
                  <h2>Recent runs</h2>
                  <span>THIS SESSION</span>
                </div>
                {snapshot.runs.slice(0, 5).map((run) => (
                  <div className="history-row" key={run.id}>
                    <strong>{run.name}</strong>
                    <span>
                      {run.completed_steps}/{run.total_steps} steps
                    </span>
                    <Badge
                      className={`run-status ${run.status}`}
                      variant="outline"
                    >
                      {run.status}
                    </Badge>
                    {run.error && <p className="error-text">{run.error}</p>}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
function Surface({
  snapshot,
  disabled,
  task,
}: {
  snapshot: Snapshot;
  disabled: boolean;
  task: Task;
}) {
  const switchers = snapshot.config.devices.filter((d) => kind(d) === "atem");
  return (
    <>
      {!switchers.length && (
        <Empty title="Add your switcher">
          Add a switcher in Devices or load the demo workspace.
        </Empty>
      )}
      {switchers.map((device) => {
        const state = snapshot.devices.find((s) => s.device_id === device.id);
        const switcher = state?.switcher;
        const execute = (command: Command) =>
          void task(() => api.execute(device.id, command));
        return (
          <Card key={device.id} className="panel gap-0 p-6">
            <CardHeader className="panel-heading mb-6 flex flex-row items-center justify-between gap-4 p-0">
              <div>
                <span className="eyebrow">MIX EFFECTS · 1</span>
                <h2>{device.name}</h2>
              </div>
              <Status
                state={state}
                simulated={device.connection.type === "simulation"}
              />
            </CardHeader>
            {state?.error && <Notice>{state.error}</Notice>}
            {switcher && (
              <>
                <div className="bus-label">
                  <span className="on-air-dot" />
                  PROGRAM<span>ON AIR</span>
                </div>
                <div className="input-row">
                  {switcher.inputs.map((input) => (
                    <Button
                      disabled={disabled}
                      key={input.id}
                      className={`input-button ${switcher.program === input.id ? "program" : ""}`}
                      onClick={() =>
                        execute({ type: "set_program", input: input.id })
                      }
                      size="surface"
                      variant={
                        switcher.program === input.id ? "program" : "outline"
                      }
                    >
                      <span>{input.id.toString().padStart(2, "0")}</span>
                      <strong>{input.long_name}</strong>
                    </Button>
                  ))}
                </div>
                <div className="bus-label preview-label">
                  <i />
                  PREVIEW<span>NEXT SHOT</span>
                </div>
                <div className="input-row">
                  {switcher.inputs.map((input) => (
                    <Button
                      disabled={disabled}
                      key={input.id}
                      className={`input-button ${switcher.preview === input.id ? "preview" : ""}`}
                      onClick={() =>
                        execute({ type: "set_preview", input: input.id })
                      }
                      size="surface"
                      variant={
                        switcher.preview === input.id ? "preview" : "outline"
                      }
                    >
                      <span>{input.id.toString().padStart(2, "0")}</span>
                      <strong>{input.long_name}</strong>
                    </Button>
                  ))}
                </div>
                <div className="transition-bar">
                  <p>
                    Preview → Program
                    <small>
                      {device.connection.type === "simulation"
                        ? "Simulated transitions complete immediately"
                        : "Switcher state confirms the result"}
                    </small>
                  </p>
                  <Button
                    className="cut"
                    disabled={disabled}
                    onClick={() => execute({ type: "cut" })}
                    variant="default"
                  >
                    CUT
                  </Button>
                  <Button
                    className="auto"
                    disabled={disabled}
                    onClick={() => execute({ type: "auto" })}
                    variant="secondary"
                  >
                    AUTO
                  </Button>
                </div>
                <details className="details">
                  <summary>Picture in picture & input labels</summary>
                  <SwitcherSettings
                    device={device}
                    state={switcher}
                    disabled={disabled}
                    task={task}
                  />
                </details>
              </>
            )}
          </Card>
        );
      })}
      <section>
        <div className="section-heading">
          <h2>Quick cues</h2>
          <span>YOUR MACROS</span>
        </div>
        <div className="cue-grid">
          {snapshot.config.macros.map((mac) => (
            <Button
              className="cue"
              key={mac.id}
              disabled={disabled}
              onClick={() => void task(() => api.run(mac.id))}
              variant="outline"
              size="cue"
            >
              <span className="cue-icon">▶</span>
              <strong>{mac.name}</strong>
              <span>{mac.steps.length} steps</span>
              <p>{mac.description}</p>
            </Button>
          ))}
        </div>
      </section>
    </>
  );
}
function SwitcherSettings({
  device,
  state,
  disabled,
  task,
}: {
  device: Device;
  state: NonNullable<DeviceState["switcher"]>;
  disabled: boolean;
  task: Task;
}) {
  const [pip, setPip] = useState<
    Command & {
      type: "set_pip";
    }
  >({
    type: "set_pip",
    ...state.pip,
  });
  const [input, setInput] = useState(1);
  const [longName, setLongName] = useState("Camera 1");
  const [shortName, setShortName] = useState("CAM1");
  return (
    <div className="settings-grid">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void task(() => api.execute(device.id, pip));
        }}
      >
        <CommandFields
          command={pip}
          onChange={(c) => setPip(c as typeof pip)}
        />
        <Button disabled={disabled} variant="outline">
          Apply PiP
        </Button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void task(() =>
            api.execute(device.id, {
              type: "set_input_name",
              input,
              long_name: longName,
              short_name: shortName,
            }),
          );
        }}
      >
        <NumberField label="Input" value={input} onChange={setInput} min={0} />
        <Label className="my-3 grid items-stretch gap-2 leading-normal">
          Long label
          <Input
            required
            maxLength={20}
            value={longName}
            onChange={(e) => setLongName(e.target.value)}
          />
        </Label>
        <Label className="my-3 grid items-stretch gap-2 leading-normal">
          Short label
          <Input
            required
            maxLength={4}
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
          />
        </Label>
        <Button disabled={disabled} variant="outline">
          Rename input
        </Button>
      </form>
    </div>
  );
}
function Cameras({
  snapshot,
  disabled,
  task,
  save,
}: {
  snapshot: Snapshot;
  disabled: boolean;
  task: Task;
  save: Save;
}) {
  const cameras = snapshot.config.devices.filter((d) => kind(d) === "camera");
  return (
    <>
      {!cameras.length && (
        <Empty title="Connect a PTZ camera">
          Add a VISCA-IP camera or a simulated camera in Devices.
        </Empty>
      )}
      <div className="camera-grid">
        {cameras.map((device) => (
          <Camera
            key={device.id}
            device={device}
            state={snapshot.devices.find((s) => s.device_id === device.id)}
            config={snapshot.config}
            disabled={disabled}
            task={task}
            save={save}
          />
        ))}
      </div>
    </>
  );
}
function Camera({
  device,
  state,
  config,
  disabled,
  task,
  save,
}: {
  device: Device;
  state?: DeviceState;
  config: Config;
  disabled: boolean;
  task: Task;
  save: Save;
}) {
  const [target, setTarget] = useState({
    pan: state?.camera?.pan ?? 0,
    tilt: state?.camera?.tilt ?? 0,
    zoom: state?.camera?.zoom ?? 0,
    pan_speed: 8,
    tilt_speed: 8,
  });
  const [presetName, setPresetName] = useState("");
  const current = state?.camera;
  const send = (command: Command) =>
    void task(() => api.execute(device.id, command));
  const pl =
    device.connection.type === "visca" ? device.connection.pan_limit : 32767;
  const tl =
    device.connection.type === "visca" ? device.connection.tilt_limit : 32767;
  const zl =
    device.connection.type === "visca" ? device.connection.zoom_limit : 16384;
  function preset(e: FormEvent) {
    e.preventDefault();
    if (!current) return;
    const action = (command: Command): Step => ({
      type: "action",
      action: { device_id: device.id, command, delay_ms: 0, timeout_ms: 10000 },
    });
    const mac: Macro = {
      id: id(),
      name: presetName,
      description: `Position preset for ${device.name}`,
      steps: [
        action({
          type: "pan_tilt",
          pan: current.pan,
          tilt: current.tilt,
          pan_speed: 8,
          tilt_speed: 8,
        }),
        action({ type: "zoom", position: current.zoom }),
      ],
    };
    void task(async () => {
      await save({ ...config, macros: [...config.macros, mac] });
      setPresetName("");
    });
  }
  return (
    <Card className="panel gap-0 p-6">
      <CardHeader className="panel-heading mb-6 flex flex-row items-center justify-between gap-4 p-0">
        <div>
          <span className="eyebrow">PTZ CONTROL</span>
          <h2>{device.name}</h2>
        </div>
        <Status
          state={state}
          simulated={device.connection.type === "simulation"}
        />
      </CardHeader>
      {state?.error && <Notice>{state.error}</Notice>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
        <div>
          {" "}
          <PtzPositionControl
            target={target}
            observed={current}
            limits={{ pan: pl, tilt: tl, zoom: zl }}
            disabled={disabled}
            onChange={(position) => setTarget({ ...target, ...position })}
          />
        </div>
        <div>
          {" "}
          <div className="position-display">
            <div>
              <span>PAN</span>
              <strong>{current?.pan ?? "—"}</strong>
            </div>
            <div>
              <span>TILT</span>
              <strong>{current?.tilt ?? "—"}</strong>
            </div>
            <div>
              <span>ZOOM</span>
              <strong>{current?.zoom ?? "—"}</strong>
            </div>
          </div>
          <p className="muted">
            {state?.feedback ?? "unknown"} feedback · raw camera units
          </p>
          <div className="button-row">
            <Button
              disabled={disabled}
              onClick={() => send({ type: "refresh" })}
              variant="outline"
            >
              Read position
            </Button>
            <Button
              disabled={!current}
              onClick={() => current && setTarget({ ...target, ...current })}
              variant="outline"
            >
              Use current as target
            </Button>
            <Button
              onClick={() => send({ type: "stop" })}
              variant="destructive"
            >
              STOP
            </Button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send({
                type: "pan_tilt",
                pan: target.pan,
                tilt: target.tilt,
                pan_speed: target.pan_speed,
                tilt_speed: target.tilt_speed,
              });
            }}
          >
            <div className="fields grid-cols-2">
              <NumberField
                label="Target pan"
                value={target.pan}
                min={-pl}
                max={pl}
                onChange={(pan) => setTarget({ ...target, pan })}
              />
              <NumberField
                label="Target tilt"
                value={target.tilt}
                min={-tl}
                max={tl}
                onChange={(tilt) => setTarget({ ...target, tilt })}
              />
              <NumberField
                label="Pan speed"
                value={target.pan_speed}
                min={1}
                max={24}
                onChange={(pan_speed) => setTarget({ ...target, pan_speed })}
              />
              <NumberField
                label="Tilt speed"
                value={target.tilt_speed}
                min={1}
                max={20}
                onChange={(tilt_speed) => setTarget({ ...target, tilt_speed })}
              />
            </div>
            <Button disabled={disabled} variant="outline">
              Move to position
            </Button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send({ type: "zoom", position: target.zoom });
            }}
          >
            <Button disabled={disabled} variant="outline">
              Set zoom
            </Button>
          </form>
          <Separator className="my-4" />
          <form className="inline-form" onSubmit={preset}>
            <Label className="my-3 grid items-stretch gap-2 leading-normal">
              Save observed position
              <Input
                placeholder="Preset name"
                required
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                maxLength={100}
              />
            </Label>
            <Button disabled={disabled || !current} variant="outline">
              Save preset
            </Button>
          </form>
          <p className="muted">
            Image controls and NDI are planned. Actual camera movement requires
            a verified VISCA profile.
          </p>
        </div>
      </div>
    </Card>
  );
}
function CommandFields({
  command,
  onChange,
}: {
  command: Command;
  onChange: (command: Command) => void;
}) {
  const patch = (key: string, value: unknown) =>
    onChange({ ...command, [key]: value } as Command);
  return (
    <div className="fields">
      {"input" in command && (
        <NumberField
          label="Input"
          min={0}
          max={65535}
          value={command.input}
          onChange={(v) => patch("input", v)}
        />
      )}
      {command.type === "set_input_name" && (
        <>
          <Label className="my-3 grid items-stretch gap-2 leading-normal">
            Long label
            <Input
              required
              value={command.long_name}
              maxLength={20}
              onChange={(e) => patch("long_name", e.target.value)}
            />
          </Label>
          <Label className="my-3 grid items-stretch gap-2 leading-normal">
            Short label
            <Input
              required
              value={command.short_name}
              maxLength={4}
              onChange={(e) => patch("short_name", e.target.value)}
            />
          </Label>
        </>
      )}
      {command.type === "pan_tilt" && (
        <>
          <NumberField
            label="Pan"
            value={command.pan}
            min={-32767}
            max={32767}
            onChange={(v) => patch("pan", v)}
          />
          <NumberField
            label="Tilt"
            value={command.tilt}
            min={-32767}
            max={32767}
            onChange={(v) => patch("tilt", v)}
          />
          <NumberField
            label="Pan speed"
            value={command.pan_speed}
            min={1}
            max={24}
            onChange={(v) => patch("pan_speed", v)}
          />
          <NumberField
            label="Tilt speed"
            value={command.tilt_speed}
            min={1}
            max={20}
            onChange={(v) => patch("tilt_speed", v)}
          />
        </>
      )}
      {command.type === "zoom" && (
        <NumberField
          label="Zoom position"
          value={command.position}
          min={0}
          max={65535}
          onChange={(v) => patch("position", v)}
        />
      )}
      {command.type === "set_pip" && (
        <>
          <Label className="my-3 flex items-center gap-2 leading-normal">
            <Checkbox
              checked={command.enabled}
              onCheckedChange={(checked) => patch("enabled", checked === true)}
            />
            On air
          </Label>
          <NumberField
            label="Fill source"
            value={command.source}
            min={0}
            onChange={(v) => patch("source", v)}
          />
          <NumberField
            label="X"
            value={command.x}
            min={-16}
            max={16}
            step={0.1}
            onChange={(v) => patch("x", v)}
          />
          <NumberField
            label="Y"
            value={command.y}
            min={-9}
            max={9}
            step={0.1}
            onChange={(v) => patch("y", v)}
          />
          <NumberField
            label="Size"
            value={command.size}
            min={0.01}
            max={1}
            step={0.01}
            onChange={(v) => patch("size", v)}
          />
        </>
      )}
    </div>
  );
}
function ActionEditor({
  action,
  devices,
  change,
}: {
  action: Action;
  devices: Device[];
  change: (action: Action) => void;
}) {
  const device = devices.find((d) => d.id === action.device_id);
  return (
    <div className="action-editor">
      <div className="fields">
        <Label className="my-3 grid items-stretch gap-2 leading-normal">
          Device
          <NativeSelect
            aria-label="Device"
            value={action.device_id}
            onChange={(e) =>
              change(newAction(devices.find((d) => d.id === e.target.value)))
            }
          >
            <NativeSelectOption value="" disabled>
              Select device
            </NativeSelectOption>
            {devices.map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className="my-3 grid items-stretch gap-2 leading-normal">
          Command
          <NativeSelect
            aria-label="Command"
            value={action.command.type}
            onChange={(e) =>
              change({
                ...action,
                command: defaultCommand(e.target.value as Command["type"]),
              })
            }
          >
            {commands(device).map((c) => (
              <NativeSelectOption key={c} value={c}>
                {commandNames[c]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
      </div>
      <CommandFields
        command={action.command}
        onChange={(command) => change({ ...action, command })}
      />
      <div className="fields">
        <NumberField
          label="Delay before (ms)"
          value={action.delay_ms}
          min={0}
          max={3600000}
          onChange={(delay_ms) => change({ ...action, delay_ms })}
        />
        <NumberField
          label="Timeout (ms)"
          value={action.timeout_ms}
          min={100}
          max={120000}
          onChange={(timeout_ms) => change({ ...action, timeout_ms })}
        />
      </div>
    </div>
  );
}
function Macros({
  snapshot,
  disabled,
  task,
  save,
}: {
  snapshot: Snapshot;
  disabled: boolean;
  task: Task;
  save: Save;
}) {
  const [editing, setEditing] = useState<Macro>();
  const config = snapshot.config;
  function updateStep(index: number, step: Step) {
    if (editing)
      setEditing({
        ...editing,
        steps: editing.steps.map((s, i) => (i === index ? step : s)),
      });
  }
  return (
    <>
      <div className="section-heading">
        <h2>{config.macros.length} saved macros</h2>
        <Button
          disabled={disabled || !config.devices.length}
          onClick={() =>
            setEditing({
              id: id(),
              name: "",
              description: "",
              steps: [{ type: "action", action: newAction(config.devices[0]) }],
            })
          }
          variant="default"
        >
          + New macro
        </Button>
      </div>
      <div className="cue-grid">
        {config.macros.map((mac) => (
          <Card key={mac.id} className="cue gap-0 p-6 gap-3 p-5" role="article">
            <span className="cue-icon">≋</span>
            <h3>{mac.name}</h3>
            <p>{mac.description || "No description"}</p>
            <span>{mac.steps.length} steps</span>
            <div className="button-row">
              <Button
                disabled={disabled}
                onClick={() => void task(() => api.run(mac.id))}
                variant="default"
              >
                Run
              </Button>
              <Button
                disabled={disabled}
                onClick={() => setEditing(structuredClone(mac))}
                variant="outline"
              >
                Edit
              </Button>
              <Button
                disabled={disabled}
                onClick={() =>
                  void task(() => save(removeMacro(config, mac.id)))
                }
                variant="ghost"
                className="text-destructive hover:text-destructive"
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {editing && (
        <Card className="panel macro-form gap-0 p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task(async () => {
                await save({
                  ...config,
                  macros: [
                    ...config.macros.filter((m) => m.id !== editing.id),
                    editing,
                  ],
                });
                setEditing(undefined);
              });
            }}
          >
            <CardHeader className="panel-heading mb-6 flex flex-row items-center justify-between gap-4 p-0">
              <h2>Macro editor</h2>
              <Button
                type="button"
                onClick={() => setEditing(undefined)}
                variant="outline"
              >
                Close
              </Button>
            </CardHeader>
            <Label className="my-3 grid items-stretch gap-2 leading-normal">
              Name
              <Input
                autoFocus
                required
                maxLength={100}
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </Label>
            <Label className="my-3 grid items-stretch gap-2 leading-normal">
              Description
              <Input
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </Label>
            {editing.steps.map((step, index) => (
              <div className="step" key={index}>
                <div className="step-heading">
                  <span className="step-number">{index + 1}</span>
                  <strong>
                    {step.type === "action"
                      ? "Device action"
                      : step.type === "wait"
                        ? "Timed wait"
                        : step.type === "parallel"
                          ? "Parallel group"
                          : "Legacy concurrent group"}
                  </strong>
                  <div className="button-row">
                    <Button
                      type="button"
                      aria-label={`Move step ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          steps: moveStep(editing.steps, index, -1),
                        })
                      }
                      variant="outline"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      aria-label={`Move step ${index + 1} down`}
                      disabled={index === editing.steps.length - 1}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          steps: moveStep(editing.steps, index, 1),
                        })
                      }
                      variant="outline"
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      aria-label={`Remove step ${index + 1}`}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          steps: editing.steps.filter((_, i) => i !== index),
                        })
                      }
                      variant="outline"
                    >
                      ×
                    </Button>
                  </div>
                </div>
                {step.type === "action" && (
                  <ActionEditor
                    action={step.action}
                    devices={config.devices}
                    change={(action) => updateStep(index, { ...step, action })}
                  />
                )}
                {step.type === "wait" && (
                  <NumberField
                    label="Wait duration (ms)"
                    value={step.duration_ms}
                    min={0}
                    max={3600000}
                    onChange={(duration_ms) =>
                      updateStep(index, { ...step, duration_ms })
                    }
                  />
                )}
                {(step.type === "parallel" ||
                  step.type === "legacy_parallel") && (
                  <>
                    {step.type === "legacy_parallel" && (
                      <Notice>
                        Legacy order and delays remain ignored. Convert to
                        sequential steps to add timing.
                      </Notice>
                    )}
                    {step.actions.map((action, ai) => (
                      <div className="parallel-action" key={ai}>
                        <ActionEditor
                          action={action}
                          devices={config.devices}
                          change={(next) =>
                            updateStep(index, {
                              ...step,
                              actions: step.actions.map((a, i) =>
                                i === ai ? next : a,
                              ),
                            })
                          }
                        />
                        <Button
                          type="button"
                          onClick={() =>
                            updateStep(index, {
                              ...step,
                              actions: step.actions.filter((_, i) => i !== ai),
                            })
                          }
                          variant="outline"
                        >
                          Remove action
                        </Button>
                      </div>
                    ))}
                    {step.type === "parallel" && (
                      <Button
                        type="button"
                        onClick={() =>
                          updateStep(index, {
                            ...step,
                            actions: [
                              ...step.actions,
                              newAction(
                                config.devices.find(
                                  (d) =>
                                    !step.actions.some(
                                      (a) => a.device_id === d.id,
                                    ),
                                ),
                              ),
                            ],
                          })
                        }
                        variant="outline"
                      >
                        + Parallel action
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
            <div className="button-row">
              <Button
                type="button"
                onClick={() =>
                  setEditing({
                    ...editing,
                    steps: [
                      ...editing.steps,
                      { type: "action", action: newAction(config.devices[0]) },
                    ],
                  })
                }
                variant="outline"
              >
                + Action
              </Button>
              <Button
                type="button"
                onClick={() =>
                  setEditing({
                    ...editing,
                    steps: [
                      ...editing.steps,
                      { type: "wait", duration_ms: 500 },
                    ],
                  })
                }
                variant="outline"
              >
                + Wait
              </Button>
              <Button
                type="button"
                onClick={() =>
                  setEditing({
                    ...editing,
                    steps: [
                      ...editing.steps,
                      {
                        type: "parallel",
                        actions: [newAction(config.devices[0])],
                      },
                    ],
                  })
                }
                variant="outline"
              >
                + Parallel group
              </Button>
              <Button
                className="primary push-right"
                disabled={disabled || !editing.steps.length}
                variant="default"
              >
                Save macro
              </Button>
            </div>
            <p className="muted">
              A timed wait does not confirm that a physical camera has settled.
              Parallel groups target each device once.
            </p>
          </form>
        </Card>
      )}
    </>
  );
}
function Shortcuts({
  snapshot,
  disabled,
  task,
  save,
}: {
  snapshot: Snapshot;
  disabled: boolean;
  task: Task;
  save: Save;
}) {
  const [page, setPage] = useState(0);
  const [draftPages, setDraftPages] = useState(1);
  const config = snapshot.config;
  const count = Math.max(
    draftPages,
    1,
    ...config.shortcuts.map((shortcut) => shortcut.page + 1),
  );
  const current = Math.min(page, count - 1);
  return (
    <>
      <div className="section-heading">
        <h2>Shortcut page {current + 1}</h2>
        <span>12 SLOTS</span>
      </div>
      <div className="shortcut-grid">
        {Array.from({ length: 12 }, (_, slot) => {
          const shortcut = config.shortcuts.find(
            (item) => item.page === current && item.slot === slot,
          );
          const mac = config.macros.find(
            (item) => item.id === shortcut?.macro_id,
          );
          return (
            <Card className="shortcut gap-3 p-4" key={slot}>
              <span className="eyebrow">
                SLOT {(slot + 1).toString().padStart(2, "0")}
              </span>
              <Button
                variant="ghost"
                size="shortcut"
                className="shortcut-trigger"
                disabled={disabled || !mac}
                onClick={() => mac && void task(() => api.run(mac.id))}
              >
                {mac ? (
                  <>
                    <span aria-hidden="true">▶</span>
                    {mac.name}
                  </>
                ) : (
                  <span className="muted">Unassigned</span>
                )}
              </Button>
              <Label className="sr-only" htmlFor={`slot-${current}-${slot}`}>
                Assign slot {slot + 1}
              </Label>
              <NativeSelect
                id={`slot-${current}-${slot}`}
                disabled={disabled}
                value={mac?.id ?? ""}
                onChange={(event) => {
                  const macroId = event.target.value;
                  void task(() =>
                    save({
                      ...config,
                      shortcuts: [
                        ...config.shortcuts.filter(
                          (item) => item.page !== current || item.slot !== slot,
                        ),
                        ...(macroId
                          ? [
                              {
                                id: shortcut?.id ?? id(),
                                page: current,
                                slot,
                                macro_id: macroId,
                              },
                            ]
                          : []),
                      ],
                    }),
                  );
                }}
              >
                <NativeSelectOption value="">Assign a macro</NativeSelectOption>
                {config.macros.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Card>
          );
        })}
      </div>
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-5">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Page {current + 1} of {count}
        </p>
        <Pagination aria-label="Shortcut pages" className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous shortcut page"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft />
              </Button>
            </PaginationItem>
            {shortcutPages(current, count).map((item, index) => (
              <PaginationItem
                key={typeof item === "number" ? item : `gap-${index}`}
              >
                {item === "ellipsis" ? (
                  <PaginationEllipsis />
                ) : (
                  <Button
                    variant={item === current ? "secondary" : "ghost"}
                    size="icon"
                    aria-label={`Shortcut page ${item + 1}`}
                    aria-current={item === current ? "page" : undefined}
                    onClick={() => setPage(item)}
                  >
                    {item + 1}
                  </Button>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next shortcut page"
                disabled={current >= count - 1}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        <Button
          variant="outline"
          disabled={disabled || count >= 65536}
          onClick={() => {
            setDraftPages(count + 1);
            setPage(count);
          }}
        >
          <Plus />
          Add page
        </Button>
      </footer>
    </>
  );
}
function Devices({
  snapshot,
  disabled,
  task,
  save,
}: {
  snapshot: Snapshot;
  disabled: boolean;
  task: Task;
  save: Save;
}) {
  const [editing, setEditing] = useState<Device>();
  const config = snapshot.config;
  const referenced = (deviceId: string) =>
    config.macros.some((m) =>
      m.steps.some((step) =>
        step.type === "action"
          ? step.action.device_id === deviceId
          : step.type !== "wait" &&
            step.actions.some((a) => a.device_id === deviceId),
      ),
    );
  return (
    <>
      <div className="section-heading">
        <h2>Device connections</h2>
        <Button
          disabled={disabled}
          onClick={() =>
            setEditing({
              id: id(),
              name: "",
              connection: { type: "simulation", kind: "atem" },
            })
          }
          variant="default"
        >
          + Add device
        </Button>
      </div>
      <div className="device-list">
        {config.devices.map((device) => {
          const state = snapshot.devices.find((s) => s.device_id === device.id);
          return (
            <Card
              key={device.id}
              className="panel device-card gap-0 p-6 flex-row"
              role="article"
            >
              <span className="device-icon">
                {kind(device) === "atem" ? "▦" : "◉"}
              </span>
              <div>
                <h3>{device.name}</h3>
                <p>
                  {device.connection.type === "simulation"
                    ? `Simulated ${device.connection.kind}`
                    : `${device.connection.type.toUpperCase()} · ${device.connection.address}`}
                </p>
                {state?.error && <Notice>{state.error}</Notice>}
              </div>
              <Status
                state={state}
                simulated={device.connection.type === "simulation"}
              />
              <div className="button-row">
                <Button
                  disabled={disabled}
                  onClick={() => setEditing(structuredClone(device))}
                  variant="outline"
                >
                  Edit
                </Button>
                <Button
                  disabled={disabled || referenced(device.id)}
                  title={
                    referenced(device.id)
                      ? "Remove references from macros first"
                      : "Delete device"
                  }
                  onClick={() =>
                    void task(() =>
                      save({
                        ...config,
                        devices: config.devices.filter(
                          (d) => d.id !== device.id,
                        ),
                      }),
                    )
                  }
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                >
                  Delete
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      {editing && (
        <Card className="panel gap-0 p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task(async () => {
                await save({
                  ...config,
                  devices: [
                    ...config.devices.filter((d) => d.id !== editing.id),
                    editing,
                  ],
                });
                setEditing(undefined);
              });
            }}
          >
            <CardHeader className="panel-heading mb-6 flex flex-row items-center justify-between gap-4 p-0">
              <h2>Device setup</h2>
              <Button
                type="button"
                onClick={() => setEditing(undefined)}
                variant="outline"
              >
                Close
              </Button>
            </CardHeader>
            <div className="fields">
              <Label className="my-3 grid items-stretch gap-2 leading-normal">
                Name
                <Input
                  autoFocus
                  required
                  maxLength={100}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </Label>
              <Label className="my-3 grid items-stretch gap-2 leading-normal">
                Connection
                <NativeSelect
                  value={
                    editing.connection.type === "simulation"
                      ? `sim_${editing.connection.kind}`
                      : editing.connection.type
                  }
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      connection:
                        e.target.value === "visca"
                          ? {
                              type: "visca",
                              address: "192.168.1.28",
                              port: 52381,
                              framing: "sony_udp",
                              pan_limit: 32767,
                              tilt_limit: 32767,
                              zoom_limit: 16384,
                            }
                          : e.target.value === "atem"
                            ? { type: "atem", address: "192.168.1.240" }
                            : {
                                type: "simulation",
                                kind:
                                  e.target.value === "sim_camera"
                                    ? "camera"
                                    : "atem",
                              },
                    })
                  }
                >
                  <NativeSelectOption value="sim_atem">
                    Simulated ATEM
                  </NativeSelectOption>
                  <NativeSelectOption value="sim_camera">
                    Simulated camera
                  </NativeSelectOption>
                  <NativeSelectOption value="atem">
                    ATEM hardware · experimental
                  </NativeSelectOption>
                  <NativeSelectOption value="visca">
                    VISCA-IP camera · experimental
                  </NativeSelectOption>
                </NativeSelect>
              </Label>
            </div>
            {editing.connection.type !== "simulation" && (
              <Label className="my-3 grid items-stretch gap-2 leading-normal">
                IP address
                <Input
                  required
                  value={editing.connection.address}
                  onChange={(e) => {
                    if (editing.connection.type !== "simulation")
                      setEditing({
                        ...editing,
                        connection: {
                          ...editing.connection,
                          address: e.target.value,
                        },
                      });
                  }}
                />
              </Label>
            )}
            {editing.connection.type === "atem" && (
              <Notice>
                ATEM controls use M/E 0 and upstream keyer 0. This adapter has
                loopback coverage; verify your model and firmware before
                production use.
              </Notice>
            )}
            {editing.connection.type === "visca" && (
              <>
                <Notice>
                  Verify framing, port and coordinate limits against your camera
                  manual. This adapter has loopback tests; physical hardware is
                  unverified.
                </Notice>
                <div className="fields">
                  <NumberField
                    label="Port"
                    value={editing.connection.port}
                    min={1}
                    max={65535}
                    onChange={(port) => {
                      if (editing.connection.type === "visca")
                        setEditing({
                          ...editing,
                          connection: { ...editing.connection, port },
                        });
                    }}
                  />
                  <Label className="my-3 grid items-stretch gap-2 leading-normal">
                    VISCA framing
                    <NativeSelect
                      value={editing.connection.framing}
                      onChange={(e) => {
                        if (editing.connection.type === "visca")
                          setEditing({
                            ...editing,
                            connection: {
                              ...editing.connection,
                              framing: e.target.value as
                                "sony_udp" | "raw_udp" | "raw_tcp",
                            },
                          });
                      }}
                    >
                      <NativeSelectOption value="sony_udp">
                        Sony framed UDP
                      </NativeSelectOption>
                      <NativeSelectOption value="raw_udp">
                        Raw UDP
                      </NativeSelectOption>
                      <NativeSelectOption value="raw_tcp">
                        Raw TCP
                      </NativeSelectOption>
                    </NativeSelect>
                  </Label>
                  {(["pan_limit", "tilt_limit", "zoom_limit"] as const).map(
                    (field) => (
                      <NumberField
                        key={field}
                        label={field.replace("_", " ")}
                        value={
                          editing.connection.type === "visca"
                            ? editing.connection[field]
                            : 0
                        }
                        min={1}
                        max={field === "zoom_limit" ? 65535 : 32767}
                        onChange={(value) => {
                          if (editing.connection.type === "visca")
                            setEditing({
                              ...editing,
                              connection: {
                                ...editing.connection,
                                [field]: value,
                              },
                            });
                        }}
                      />
                    ),
                  )}
                </div>
              </>
            )}
            <Button disabled={disabled} variant="default">
              Save device
            </Button>
            <p className="muted">
              Devices referenced by macros cannot be deleted until those
              references are removed.
            </p>
          </form>
        </Card>
      )}
    </>
  );
}
function Workspace({
  config,
  disabled,
  task,
}: {
  config: Config;
  disabled: boolean;
  task: Task;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{
    config: Config;
    warnings: string[];
  }>();
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(config, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "atem-control-workspace.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <PostgresImport
        disabled={disabled}
        task={task}
        onPreview={setPreview}
        onChange={() => setPreview(undefined)}
      />
      <Card className="panel gap-0 p-6">
        <CardHeader className="panel-heading mb-6 flex flex-row items-center justify-between gap-4 p-0">
          <div>
            <span className="eyebrow">PORTABLE CONFIGURATION</span>
            <h2>Workspace backup</h2>
          </div>
          <Button disabled={disabled} onClick={download} variant="outline">
            Export JSON
          </Button>
        </CardHeader>
        <p className="muted">
          Devices, macros and shortcut assignments. Import replaces the
          workspace and creates a SQLite backup first.
        </p>
        <Label className="my-3 grid items-stretch gap-2 leading-normal">
          Read a configuration file
          <Input
            type="file"
            accept=".json,application/json"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void task(async () => {
                  if (file.size > 2 * 1024 * 1024)
                    throw new Error(
                      "Configuration file must be smaller than 2 MB",
                    );
                  setText(await file.text());
                  setPreview(undefined);
                });
            }}
          />
        </Label>
        <Label className="my-3 grid items-stretch gap-2 leading-normal">
          Configuration JSON
          <Textarea
            spellCheck={false}
            rows={12}
            value={text}
            placeholder="Paste a versioned workspace or legacy export"
            onChange={(e) => {
              setText(e.target.value);
              setPreview(undefined);
            }}
          />
        </Label>
        <div className="button-row">
          <Button
            disabled={disabled || !text.trim()}
            onClick={() =>
              void task(async () => {
                const value = JSON.parse(text) as Config;
                if (value.version !== undefined)
                  setPreview({
                    config: value,
                    warnings: [
                      "Review the configuration before replacing your workspace. Validation runs when importing.",
                    ],
                  });
                else setPreview(await api.legacy(text));
              })
            }
            variant="outline"
          >
            Review import
          </Button>
        </div>
      </Card>
      {preview && (
        <Card
          aria-label="Import preview"
          className="panel import-preview gap-0 p-6"
          role="region"
        >
          <h3>Import preview</h3>
          <p>
            {preview.config.devices.length} devices ·{" "}
            {preview.config.macros.length} macros ·{" "}
            {preview.config.shortcuts.length} shortcuts
          </p>
          {preview.warnings.map((warning, i) => (
            <Notice key={i}>{warning}</Notice>
          ))}
          <details>
            <summary>Review converted configuration</summary>
            <pre>{JSON.stringify(preview.config, null, 2)}</pre>
          </details>
          <Button
            disabled={disabled}
            onClick={() =>
              void task(async () => {
                await api.import(preview.config);
                setPreview(undefined);
                setText("");
              })
            }
            variant="default"
          >
            Back up & replace workspace
          </Button>
        </Card>
      )}
      <Card className="panel gap-0 p-6">
        <h2>Migration status</h2>
        <p>
          Rust core, SQLite, simulated switching, ATEM and VISCA-IP adapters,
          macro execution and shortcut pages are available in this preview.
        </p>
        <p className="muted">
          ATEM and VISCA hardware acceptance, NDI, image controls and native
          installer verification remain in progress. The legacy application is
          available alongside this workspace.
        </p>
      </Card>
    </>
  );
}
