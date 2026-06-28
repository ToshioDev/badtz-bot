import { useEffect, useState, type ReactNode } from "react";

type IdName = { id: string; name: string };
type NameValue = { name: string; value: string };
type Settings = Record<string, string | number | null>;
type Guild = { id: string; name: string; icon: string | null };
type Me = { user: { id: string; username: string; avatar: string | null }; guilds: Guild[] };
type Options = {
  guildName: string;
  text: IdName[];
  voice: IdName[];
  roles: IdName[];
  voices: NameValue[];
  models: NameValue[];
  settings: Settings;
};

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [gid, setGid] = useState<string>("");
  const [opts, setOpts] = useState<Options | null>(null);
  const [draft, setDraft] = useState<Settings>({});
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/me").then(async (r) => {
      if (r.status === 401) return setAuthed(false);
      const d: Me = await r.json();
      setMe(d);
      setAuthed(true);
      if (d.guilds.length === 1) selectGuild(d.guilds[0].id);
    });
  }, []);

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(""), 1700);
  }

  async function selectGuild(id: string) {
    setGid(id);
    setOpts(null);
    const r = await fetch(`/api/options?guild=${id}`);
    if (!r.ok) return flash("Sin acceso a ese servidor");
    const d: Options = await r.json();
    setOpts(d);
    setDraft({ ...d.settings });
  }

  async function save() {
    setBusy(true);
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guild: gid, ...draft }),
    });
    setBusy(false);
    flash(r.ok ? "Guardado ✓" : "Error al guardar");
  }

  async function reset() {
    if (!confirm("¿Restablecer la configuración de este servidor?")) return;
    await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guild: gid }),
    });
    selectGuild(gid);
    flash("Restablecido");
  }

  const set = (k: string, v: string | number | null) => setDraft((d) => ({ ...d, [k]: v }));

  /* ---------- LOGIN ---------- */
  if (authed === false) {
    return (
      <Center>
        <Brand />
        <div className="bg-panel border border-line rounded-2xl p-7 mt-5 text-center">
          <p className="text-muted text-sm mb-5">
            Inicia sesión con Discord para configurar tus servidores.
          </p>
          <a
            href="/api/auth/login"
            className="inline-flex items-center gap-2 bg-blurple text-white font-semibold rounded-xl px-5 py-3"
          >
            <DiscordIcon /> Entrar con Discord
          </a>
        </div>
        <Toast msg={toast} />
      </Center>
    );
  }
  if (authed === null) return <Center><p className="text-muted">Cargando…</p></Center>;

  /* ---------- GUILD PICKER ---------- */
  if (!gid || !opts) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-24">
        <Topbar me={me} />
        <Card title="Elige un servidor">
          {me && me.guilds.length === 0 && (
            <p className="text-muted text-sm">
              No tienes servidores donde seas admin y el bot esté presente.{" "}
              <a className="text-accent underline" href="/api/auth/login">Reintentar</a>
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {me?.guilds.map((g) => (
              <button
                key={g.id}
                onClick={() => selectGuild(g.id)}
                className="flex items-center gap-3 bg-panel2 border border-line rounded-xl p-3 text-left hover:border-blurple"
              >
                {g.icon ? (
                  <img src={g.icon} className="w-10 h-10 rounded-lg" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-line grid place-items-center">{g.name[0]}</div>
                )}
                <span className="font-medium">{g.name}</span>
              </button>
            ))}
          </div>
        </Card>
        <Toast msg={toast} />
      </div>
    );
  }

  /* ---------- CONFIG ---------- */
  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-28">
      <Topbar me={me} guildName={opts.guildName} onSwitch={() => setGid("")} />

      <Card title="Inteligencia artificial (tus propias keys)">
        <p className="text-muted text-xs mb-4">
          Cada servidor usa sus propias keys. Claude: console.anthropic.com · Groq (gratis): console.groq.com
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <SecretField label="🔑 Claude API key" value={draft.anthropicApiKey} onChange={(v) => set("anthropicApiKey", v)} />
          <SecretField label="🔑 Groq API key (gratis)" value={draft.groqApiKey} onChange={(v) => set("groqApiKey", v)} />
          <SelectField label="🗣️ Voz del bot" value={draft.ttsVoice} onChange={(v) => set("ttsVoice", v)} kv={opts.voices} />
          <SelectField label="🧠 Modelo de IA" value={draft.brainModel} onChange={(v) => set("brainModel", v)} kv={opts.models} />
        </div>
      </Card>

      <Card title="Canales">
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField label="🔊 Voz 24/7" value={draft.voice247ChannelId} onChange={(v) => set("voice247ChannelId", v)} items={opts.voice} none />
          <SelectField label="➕ Crear sala" value={draft.joinToCreateChannelId} onChange={(v) => set("joinToCreateChannelId", v)} items={opts.voice} none />
          <SelectField label="🔇 Mudos (texto a voz)" value={draft.mudosChannelId} onChange={(v) => set("mudosChannelId", v)} items={opts.text} none />
          <SelectField label="🔥 Recordatorio de racha" value={draft.streakReminderChannelId} onChange={(v) => set("streakReminderChannelId", v)} items={opts.text} none />
        </div>
        <SelectField label="🏷️ Rol del recordatorio" value={draft.streakReminderRoleId} onChange={(v) => set("streakReminderRoleId", v)} items={opts.roles} none noneLabel="@here (todos)" />
      </Card>

      <Card title="Conversación y micrófono">
        <div className="grid sm:grid-cols-2 gap-4">
          <NumberField label="💬 Conversación sin “Badtz” (s)" value={Math.round(Number(draft.conversationWindowMs ?? 15000) / 1000)} min={5} max={60} onChange={(n) => set("conversationWindowMs", n * 1000)} />
          <NumberField label="🎚️ Sensibilidad (umbral de voz)" value={Number(draft.vadThreshold)} min={200} max={2000} step={50} onChange={(n) => set("vadThreshold", n)} />
          <NumberField label="⏱️ Silencio = fin de frase (ms)" value={Number(draft.vadSilenceMs)} min={400} max={2500} step={50} onChange={(n) => set("vadSilenceMs", n)} />
          <NumberField label="🔉 Voz mínima (ms)" value={Number(draft.vadMinSpeechMs)} min={80} max={800} step={20} onChange={(n) => set("vadMinSpeechMs", n)} />
          <NumberField label="✋ Umbral para interrumpir" value={Number(draft.vadBargeThreshold)} min={600} max={4000} step={100} onChange={(n) => set("vadBargeThreshold", n)} />
          <NumberField label="✋ Voz sostenida interrumpir (ms)" value={Number(draft.bargeMinMs)} min={150} max={800} step={50} onChange={(n) => set("bargeMinMs", n)} />
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/85 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={reset} className="text-muted text-sm border border-line rounded-lg px-3 py-2">Restablecer</button>
          <div className="flex-1" />
          <button onClick={save} disabled={busy} className="bg-accent text-black/80 font-semibold rounded-lg px-5 py-2.5 disabled:opacity-60">
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
      <Toast msg={toast} />
    </div>
  );
}

/* ---------- componentes ---------- */
function Center({ children }: { children: ReactNode }) {
  return <div className="min-h-full grid place-items-center px-4"><div className="w-full max-w-sm">{children}</div></div>;
}
function Brand() {
  return (
    <div className="flex items-center gap-3 justify-center">
      <div className="w-12 h-12 rounded-xl grid place-items-center text-2xl bg-gradient-to-br from-accent to-orange-700">🐧</div>
      <div><h1 className="text-xl font-bold leading-tight">BadtzBot</h1><p className="text-muted text-sm">Panel SaaS</p></div>
    </div>
  );
}
function Topbar({ me, guildName, onSwitch }: { me: Me | null; guildName?: string; onSwitch?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center text-xl bg-gradient-to-br from-accent to-orange-700">🐧</div>
        <div>
          <h1 className="text-lg font-bold leading-tight">BadtzBot</h1>
          <p className="text-muted text-xs">{guildName || "Panel"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onSwitch && <button onClick={onSwitch} className="text-muted text-sm border border-line rounded-lg px-3 py-2">Cambiar servidor</button>}
        <span className="text-muted text-sm hidden sm:block">{me?.user.username}</span>
        <a href="/api/logout" onClick={(e) => { e.preventDefault(); fetch("/api/logout", { method: "POST" }).then(() => location.reload()); }}
          className="text-muted text-sm border border-line rounded-lg px-3 py-2">Salir</a>
      </div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="bg-panel border border-line rounded-2xl p-5 mt-5"><h2 className="text-xs uppercase tracking-wider text-muted mb-4">{title}</h2>{children}</section>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block mb-4 last:mb-0"><span className="block text-sm text-muted mb-1.5">{label}</span>{children}</label>;
}
const inputCls = "w-full bg-panel2 border border-line rounded-xl px-3 py-3 outline-none focus:border-blurple";
function SelectField({ label, value, onChange, items, kv, none, noneLabel }: {
  label: string; value: string | number | null; onChange: (v: string | null) => void;
  items?: IdName[]; kv?: NameValue[]; none?: boolean; noneLabel?: string;
}) {
  return (
    <Field label={label}>
      <select className={inputCls + " appearance-none"} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        {none && <option value="">{noneLabel || "— ninguno —"}</option>}
        {items?.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
        {kv?.map((it) => <option key={it.value} value={it.value}>{it.name}</option>)}
      </select>
    </Field>
  );
}
function NumberField({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number;
}) {
  return <Field label={label}><input type="number" value={Number.isFinite(value) ? value : ""} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className={inputCls} /></Field>;
}
function SecretField({ label, value, onChange }: { label: string; value: string | number | null; onChange: (v: string) => void }) {
  const isSet = value === "__set__";
  return (
    <Field label={label}>
      <input
        type="password"
        value={isSet ? "" : ((value as string) ?? "")}
        placeholder={isSet ? "configurada ✓ — escribe para cambiar" : "pega tu API key"}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </Field>
  );
}
function Toast({ msg }: { msg: string }) {
  return <div className={`fixed top-4 left-1/2 -translate-x-1/2 bg-ok text-black/80 font-semibold px-4 py-2 rounded-lg transition-opacity ${msg ? "opacity-100" : "opacity-0"}`}>{msg || "."}</div>;
}
function DiscordIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.07.07 0 0 0-.073.035c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.07.07 0 0 0-.073-.034A19.74 19.74 0 0 0 5.34 4.369a.06.06 0 0 0-.03.024C2.94 7.89 2.29 11.32 2.61 14.71a.08.08 0 0 0 .03.054 19.9 19.9 0 0 0 5.993 3.03.07.07 0 0 0 .078-.027c.462-.63.873-1.295 1.226-1.994a.07.07 0 0 0-.038-.097 13.1 13.1 0 0 1-1.872-.892.07.07 0 0 1-.007-.117c.126-.094.252-.192.371-.291a.07.07 0 0 1 .071-.01c3.927 1.793 8.18 1.793 12.061 0a.07.07 0 0 1 .072.009c.12.099.245.198.372.292a.07.07 0 0 1-.006.117c-.598.349-1.22.645-1.873.891a.07.07 0 0 0-.038.098c.36.698.772 1.362 1.225 1.993a.07.07 0 0 0 .078.028 19.84 19.84 0 0 0 6.002-3.03.07.07 0 0 0 .03-.053c.383-3.92-.642-7.32-2.717-10.317a.06.06 0 0 0-.03-.025ZM8.02 12.645c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z"/></svg>;
}
