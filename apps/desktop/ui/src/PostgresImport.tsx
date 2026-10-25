import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { api } from "./api";
import type { ImportPreview } from "./api";
import type { PostgresImportSettings } from "./bindings";
export default function PostgresImport({
  disabled,
  task,
  onPreview,
  onChange,
}: {
  disabled: boolean;
  task: (work: () => Promise<unknown>) => Promise<void>;
  onPreview: (preview: ImportPreview) => void;
  onChange: () => void;
}) {
  const [settings, setSettings] = useState<PostgresImportSettings>({
    host: "localhost",
    port: 5432,
    database: "nestjs",
    username: "",
    password: "",
    schema: "public",
    require_tls: false,
  });
  function change<K extends keyof PostgresImportSettings>(
    key: K,
    value: PostgresImportSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    onChange();
  }
  return (
    <Card className="panel gap-0 p-6">
      <CardHeader className="panel-heading mb-6 flex flex-row items-center justify-between gap-4 p-0">
        <div>
          <span className="eyebrow">EXISTING INSTALLATION</span>
          <h2>Import from PostgreSQL</h2>
        </div>
      </CardHeader>
      <p className="muted">
        Connect to your existing installation to review its devices, macros and
        shortcuts. Reading the database makes no workspace changes.
      </p>
      <form
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          onChange();
          void task(async () => {
            try {
              onPreview(await api.postgres(settings));
            } finally {
              setSettings((current) => ({ ...current, password: "" }));
            }
          });
        }}
      >
        <fieldset disabled={disabled} className="postgres-fields">
          <div className="fields">
            <Label className="my-3 grid items-stretch gap-2 leading-normal">
              PostgreSQL host
              <Input
                required
                value={settings.host}
                maxLength={253}
                onChange={(e) => change("host", e.target.value)}
                placeholder="localhost or Docker host address"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Label>
            <Label className="my-3 grid items-stretch gap-2 leading-normal">
              PostgreSQL port
              <Input
                type="number"
                required
                min={1}
                max={65535}
                value={settings.port}
                onChange={(e) => change("port", Number(e.target.value))}
              />
            </Label>
            <Label className="my-3 grid items-stretch gap-2 leading-normal">
              PostgreSQL database
              <Input
                required
                value={settings.database}
                maxLength={63}
                onChange={(e) => change("database", e.target.value)}
                autoCapitalize="none"
                spellCheck={false}
              />
            </Label>
          </div>
          <div className="fields">
            <Label className="my-3 grid items-stretch gap-2 leading-normal">
              PostgreSQL username
              <Input
                required
                value={settings.username}
                maxLength={63}
                onChange={(e) => change("username", e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Label>
            <Label className="my-3 grid items-stretch gap-2 leading-normal">
              PostgreSQL password
              <Input
                type="password"
                value={settings.password}
                onChange={(e) => change("password", e.target.value)}
                autoComplete="off"
                maxLength={4096}
              />
            </Label>
            <Label className="my-3 grid items-stretch gap-2 leading-normal">
              PostgreSQL schema
              <Input
                required
                value={settings.schema}
                maxLength={63}
                onChange={(e) => change("schema", e.target.value)}
                autoCapitalize="none"
                spellCheck={false}
              />
            </Label>
          </div>
          <Label className="my-3 flex items-center gap-2 leading-normal">
            <Checkbox
              checked={settings.require_tls}
              onCheckedChange={(checked) =>
                change("require_tls", checked === true)
              }
            />
            Require TLS and verify the server certificate
          </Label>
          <p className="muted">
            The Docker installation defaults to database <strong>nestjs</strong>{" "}
            on port <strong>5432</strong>. Use the Docker host’s address; its
            internal <strong>database</strong> alias is not a desktop hostname.
            TLS uses your system’s trusted certificate authorities.
          </p>
          <Button type="submit" variant="default">
            Read PostgreSQL & review import
          </Button>
          <p className="muted">
            Credentials are used for this connection only and are not saved. The
            password is cleared after each attempt.
          </p>
        </fieldset>
      </form>
    </Card>
  );
}
