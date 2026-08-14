import React, { useState, useEffect, useCallback } from "react";
import {
  LogOut, Plus, Copy, Check, X, ArrowLeft, Loader2, Send, Brain, Gamepad2,
  Trash2, Users, Baby, Utensils, Droplet, Moon, Smile, Frown, Meh,
  MessageSquare, ChevronLeft, ChevronRight, ChevronDown
} from "lucide-react";

/* ============================ helpers ============================ */

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const fmtTime = (ms) => new Date(ms).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
function dayLabel(d) {
  const todayKey = dateKey(new Date());
  const key = dateKey(d);
  const base = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return key === todayKey ? `Hoy · ${base}` : base;
}
function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 7; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const MEAL_OPTIONS = [
  { key: "todo", label: "Comió todo" },
  { key: "mitad", label: "La mitad" },
  { key: "nada", label: "Nada" },
];
const DIAPER_OPTIONS = [
  { key: "mojado", label: "Mojado" },
  { key: "sucio", label: "Sucio" },
  { key: "mixto", label: "Mixto" },
  { key: "bano", label: "Fue al baño" },
];
const MOOD_OPTIONS = [
  { key: "alegre", label: "Alegre" },
  { key: "cansado", label: "Cansado" },
  { key: "participativo", label: "Participativo" },
  { key: "indispuesto", label: "Indispuesto" },
];

/* ============================ Supabase storage ============================ */

const SUPABASE_URL = "https://itenhybfheoznyevzyey.supabase.co";
const SUPABASE_KEY = "sb_publishable_89YONfEmxbg27Efv8nmSfw_luRcAyf7";

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function sb(path, options = {}, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: options.prefer || "return=representation",
          ...(options.headers || {}),
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
      }
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await wait(400 * (i + 1));
    }
  }
  throw lastErr;
}

/* ---- professionals ---- */
async function listProfessionals() {
  try { return (await sb("professionals?select=*")) || []; } catch { return []; }
}
async function upsertProfessional(p) {
  await sb("professionals", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify([p]) });
}

/* ---- row <-> object mapping ---- */
function maestraToRow(m) { return { code: m.code, name: m.name, funcion: m.funcion, grupo: m.grupo, professional_id: m.professionalId, created_at: m.createdAt }; }
function rowToMaestra(r) { return { code: r.code, name: r.name, funcion: r.funcion, grupo: r.grupo, professionalId: r.professional_id, createdAt: r.created_at }; }
function ninoToRow(n) { return { id: n.id, name: n.name, grupo: n.grupo, foto: n.foto, professional_id: n.professionalId, created_at: n.createdAt }; }
function rowToNino(r) { return { id: r.id, name: r.name, grupo: r.grupo, foto: r.foto, professionalId: r.professional_id, createdAt: r.created_at }; }
function logToRow(log) { return { id: `${log.ninoId}:${log.date}`, nino_id: log.ninoId, nino_name: log.ninoName, grupo: log.grupo, date: log.date, alimentacion: log.alimentacion, panales: log.panales, siestas: log.siestas, animos: log.animos, notas: log.notas }; }
function rowToLog(r) { return { ninoId: r.nino_id, ninoName: r.nino_name, grupo: r.grupo, date: r.date, alimentacion: r.alimentacion || [], panales: r.panales || [], siestas: r.siestas || [], animos: r.animos || [], notas: r.notas || [] }; }

/* ---- maestras ---- */
async function listMaestras(profId) {
  const rows = await sb(`maestras?professional_id=eq.${encodeURIComponent(profId)}&order=name`);
  return (rows || []).map(rowToMaestra);
}
async function saveMaestra(m) {
  await sb("maestras", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify([maestraToRow(m)]) });
}
async function getMaestra(code) {
  try {
    const rows = await sb(`maestras?code=eq.${encodeURIComponent(code)}`);
    return rows && rows[0] ? rowToMaestra(rows[0]) : null;
  } catch { return null; }
}
async function deleteMaestra(code) {
  try { await sb(`maestras?code=eq.${encodeURIComponent(code)}`, { method: "DELETE" }); } catch {}
}

/* ---- ninos ---- */
async function listNinos(profId) {
  const rows = await sb(`ninos?professional_id=eq.${encodeURIComponent(profId)}&order=grupo,name`);
  return (rows || []).map(rowToNino);
}
async function saveNino(n) {
  await sb("ninos", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify([ninoToRow(n)]) });
}
async function deleteNino(id) {
  try { await sb(`ninos?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }); } catch {}
}

/* ---- bitacoras ---- */
async function getLog(ninoId, date) {
  try {
    const id = `${ninoId}:${date}`;
    const rows = await sb(`bitacoras?id=eq.${encodeURIComponent(id)}`);
    return rows && rows[0] ? rowToLog(rows[0]) : null;
  } catch { return null; }
}
function emptyLog(nino, date) {
  return { ninoId: nino.id, ninoName: nino.name, grupo: nino.grupo, date, alimentacion: [], panales: [], siestas: [], animos: [], notas: [] };
}
async function saveLog(log) {
  await sb("bitacoras", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify([logToRow(log)]) });
}

/* ---------------------------- Glass primitives --------------------------- */

function GlassCard({ children, className = "", style = {} }) {
  return (
    <div
      className={`relative rounded-3xl ${className}`}
      style={{
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.8)",
        boxShadow: "0 8px 32px rgba(91,95,239,0.10), inset 0 1px 0 rgba(255,255,255,0.9)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function GlassButton({ children, onClick, variant = "primary", className = "", disabled, type = "button" }) {
  const variants = {
    primary: { background: "linear-gradient(135deg, #6366F1 0%, #5B5FEF 100%)", color: "white", boxShadow: "0 4px 20px rgba(91,95,239,0.35)" },
    secondary: { background: "rgba(255,255,255,0.7)", color: "#3730A3", border: "1px solid rgba(91,95,239,0.25)" },
    ghost: { background: "transparent", color: "#4C4E9E" },
    danger: { background: "rgba(239,68,68,0.1)", color: "#DC2626", border: "1px solid rgba(239,68,68,0.25)" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-3 rounded-2xl font-medium text-sm transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2 ${className}`}
      style={variants[variant]}
    >
      {children}
    </button>
  );
}

function Backdrop({ children }) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center"
      style={{
        background:
          "radial-gradient(circle at 15% 10%, #E0E7FF 0%, transparent 45%), radial-gradient(circle at 85% 20%, #CFFAFE 0%, transparent 40%), radial-gradient(circle at 50% 100%, #FCE7F3 0%, transparent 45%), #F3F4FB",
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  );
}

function Logo({ size = 10 }) {
  return (
    <div
      className="rounded-2xl overflow-hidden relative shrink-0"
      style={{ width: size * 4, height: size * 4, background: "#0B0E1A", boxShadow: "0 4px 16px rgba(0,0,0,0.25)" }}
    >
      <div className="absolute inset-0 flex">
        <div className="w-1/2 h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#20263f,#0b0e1a)" }}>
          <Brain size={size * 1.7} color="#D9B36A" strokeWidth={1.6} />
        </div>
        <div className="w-1/2 h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0b0e1a,#12294a)" }}>
          <Gamepad2 size={size * 1.7} color="#5DA9F5" strokeWidth={1.6} />
        </div>
      </div>
      <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: "rgba(255,255,255,0.15)" }} />
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl text-sm font-medium z-50" style={{ background: "rgba(30,27,75,0.92)", color: "white", backdropFilter: "blur(10px)" }}>
      {msg}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="w-full max-w-md px-5 mt-16">
          <GlassCard className="p-8 text-center">
            <p className="font-semibold mb-2" style={{ color: "#DC2626" }}>Ocurrió un error</p>
            <p className="text-sm mb-4" style={{ color: "#6B7280" }}>{String(this.state.error.message || this.state.error)}</p>
            <GlassButton className="w-full" onClick={() => this.setState({ error: null })}>Reintentar</GlassButton>
          </GlassCard>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ================================ APP ==================================== */

export default function SkillmindPlatform() {
  const [ready, setReady] = useState(false);
  const [professionals, setProfessionals] = useState([]);
  const [currentPro, setCurrentPro] = useState(null);
  const [view, setView] = useState("login");
  const [maestraCode, setMaestraCode] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => {
    const SUPERADMIN = { id: "p1", name: "Manu", username: "manu", password: "carem2412", role: "superadmin" };
    (async () => {
      let profs = await listProfessionals();
      if (!profs.some((p) => p.username === "manu")) {
        try { await upsertProfessional(SUPERADMIN); } catch {}
        profs = [...profs, SUPERADMIN];
      }
      setProfessionals(profs);
      try {
        const hash = window.location.hash || "";
        const m = hash.match(/#maestra\/([A-Za-z0-9]+)/);
        if (m) setMaestraCode(m[1]);
      } catch {}
      setReady(true);
    })();
  }, []);

  function handleLogout() { setCurrentPro(null); setView("login"); }

  if (!ready) {
    return (
      <Backdrop>
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader2 className="animate-spin" size={28} color="#5B5FEF" />
        </div>
      </Backdrop>
    );
  }

  if (maestraCode) {
    return (
      <Backdrop>
        <ErrorBoundary>
          <MaestraHub code={maestraCode} onExitDemo={() => setMaestraCode(null)} showToast={showToast} />
        </ErrorBoundary>
        <Toast msg={toast} />
      </Backdrop>
    );
  }

  return (
    <Backdrop>
      <div className="w-full max-w-3xl px-5 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={10} />
          <span className="font-semibold text-lg tracking-tight" style={{ backgroundImage: "linear-gradient(90deg, #B8934E 0%, #4C4E9E 55%, #3E7FD1 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            Skillmind
          </span>
        </div>
        {currentPro && (
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl active:scale-95 transition-transform" style={{ color: "#6B7280" }}>
            <LogOut size={15} /> {currentPro.name}
          </button>
        )}
      </div>

      <div className="w-full max-w-3xl px-5 pb-24">
        <ErrorBoundary>
          {view === "login" && (
            <LoginView professionals={professionals} onLogin={(pro) => { setCurrentPro(pro); setView("dashboard"); }} />
          )}
          {view === "dashboard" && currentPro && (
            <AdminDashboard pro={currentPro} showToast={showToast} onPreviewMaestra={(code) => setMaestraCode(code)} />
          )}
        </ErrorBoundary>
      </div>
      <Toast msg={toast} />
    </Backdrop>
  );
}

/* -------------------------------- Login ---------------------------------- */

function LoginView({ professionals, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const list = Array.isArray(professionals) ? professionals : [];
    const u = username.trim();
    const pw = password.trim();
    const FALLBACK = { id: "p1", name: "Manu", username: "manu", password: "carem2412", role: "superadmin" };
    const found = list.find((p) => p.username === u && p.password === pw) || (u === FALLBACK.username && pw === FALLBACK.password ? FALLBACK : null);
    if (found) { setError(""); onLogin(found); } else { setError("Usuario o contraseña incorrectos."); }
  }

  return (
    <div className="mt-10 flex flex-col items-center">
      <GlassCard className="w-full p-8">
        <h1 className="text-2xl font-semibold mb-1" style={{ color: "#1E1B4B" }}>Iniciar sesión</h1>
        <p className="text-sm mb-6" style={{ color: "#6B7280" }}>Ingresa con el usuario y contraseña que te asignaron.</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "#4C4E9E" }}>Usuario</label>
            <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(91,95,239,0.2)" }} placeholder="Tu usuario" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(e); }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "#4C4E9E" }}>Contraseña</label>
            <input type="password" className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(91,95,239,0.2)" }} placeholder="Tu contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(e); }} />
          </div>
          {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}
          <GlassButton onClick={submit} className="w-full mt-1">Ingresar</GlassButton>
        </div>
      </GlassCard>
    </div>
  );
}

/* ---------------------------- Admin dashboard ------------------------------ */

function HomeTile({ icon: Icon, label, sublabel, onClick, accent }) {
  return (
    <button onClick={onClick} className="flex flex-col items-start gap-3 p-5 rounded-3xl text-left transition-all active:scale-95"
      style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.8)", boxShadow: "0 8px 32px rgba(91,95,239,0.10), inset 0 1px 0 rgba(255,255,255,0.9)" }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: accent }}><Icon size={22} color="white" /></div>
      <div><p className="font-semibold" style={{ color: "#1E1B4B" }}>{label}</p>{sublabel && <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{sublabel}</p>}</div>
    </button>
  );
}

function AdminDashboard({ pro, showToast, onPreviewMaestra }) {
  const [section, setSection] = useState("home");
  const [maestras, setMaestras] = useState([]);
  const [ninos, setNinos] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [m, n] = await Promise.all([listMaestras(pro.id), listNinos(pro.id)]);
    setMaestras(m); setNinos(n);
    setLoading(false);
  }, [pro.id]);

  useEffect(() => { reload(); }, [reload]);

  function addMaestraLocal(m) { setMaestras((prev) => [...prev, m].sort((a, b) => a.name.localeCompare(b.name))); }
  function removeMaestraLocal(code) { setMaestras((prev) => prev.filter((m) => m.code !== code)); }
  function addNinoLocal(n) { setNinos((prev) => [...prev, n].sort((a, b) => (a.grupo || "").localeCompare(b.grupo || "") || a.name.localeCompare(b.name))); }
  function removeNinoLocal(id) { setNinos((prev) => prev.filter((n) => n.id !== id)); }

  function linkUrl(code) {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#maestra/${code}`;
  }
  function copyLink(code) { navigator.clipboard?.writeText(linkUrl(code)); showToast("Link copiado"); }

  if (section === "home") {
    return (
      <div className="mt-2 space-y-5">
        <div>
          <h1 className="text-xl font-semibold mb-0.5" style={{ color: "#1E1B4B" }}>Hola, {pro.name}</h1>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>¿Qué quieres revisar hoy?</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <HomeTile icon={Users} label="Maestras" sublabel={`${maestras.length} registrada(s)`} accent="linear-gradient(135deg,#6366F1,#5B5FEF)" onClick={() => setSection("maestras")} />
          <HomeTile icon={Baby} label="Niños" sublabel={`${ninos.length} registrado(s)`} accent="linear-gradient(135deg,#EC4899,#DB2777)" onClick={() => setSection("ninos")} />
          <HomeTile icon={Utensils} label="Bitácoras diarias" sublabel="Reportes de hoy" accent="linear-gradient(135deg,#14B8A6,#0D9488)" onClick={() => setSection("bitacoras")} />
        </div>
      </div>
    );
  }

  const titles = { maestras: "Maestras", ninos: "Niños", bitacoras: "Bitácoras diarias" };

  return (
    <div className="mt-2 space-y-4">
      <button onClick={() => setSection("home")} className="text-sm flex items-center gap-1.5" style={{ color: "#6B7280" }}><ArrowLeft size={14} /> Menú principal</button>
      <h1 className="text-xl font-semibold" style={{ color: "#1E1B4B" }}>{titles[section]}</h1>

      {section === "maestras" && <MaestrasTab pro={pro} maestras={maestras} loading={loading} reload={reload} onAdded={addMaestraLocal} onRemoved={removeMaestraLocal} showToast={showToast} />}
      {section === "ninos" && <NinosTab pro={pro} ninos={ninos} maestras={maestras} loading={loading} reload={reload} onAdded={addNinoLocal} onRemoved={removeNinoLocal} showToast={showToast} />}
      {section === "bitacoras" && <BitacorasAdminTab maestras={maestras} ninos={ninos} loading={loading} copyLink={copyLink} linkUrl={linkUrl} onPreview={onPreviewMaestra} showToast={showToast} />}
    </div>
  );
}

/* -------------------------------- Maestras -------------------------------- */

function MaestrasTab({ pro, maestras, loading, onAdded, onRemoved, showToast }) {
  const [name, setName] = useState("");
  const [funcion, setFuncion] = useState("");
  const [grupo, setGrupo] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function addMaestra() {
    setFormError("");
    if (!name.trim() || !grupo.trim()) { setFormError("Falta el nombre o el grupo — ambos son obligatorios."); return; }
    setSaving(true);
    const m = { code: genCode(), name: name.trim(), funcion: funcion.trim() || "Maestra", grupo: grupo.trim(), professionalId: pro.id, createdAt: Date.now() };
    try {
      await saveMaestra(m);
      onAdded(m);
      setName(""); setFuncion(""); setGrupo("");
      showToast("Maestra agregada");
    } catch (err) { setFormError("No se pudo guardar: " + (err?.message || "intenta de nuevo")); }
    setSaving(false);
  }

  async function remove(code) {
    onRemoved(code);
    await deleteMaestra(code);
    showToast("Maestra eliminada");
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-6 space-y-3">
        <h2 className="font-semibold" style={{ color: "#1E1B4B" }}>Nueva maestra</h2>
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(91,95,239,0.2)" }} placeholder="Nombre completo *" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(91,95,239,0.2)" }} placeholder="Función (ej. Maestra titular, Auxiliar)" value={funcion} onChange={(e) => setFuncion(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(91,95,239,0.2)" }} placeholder="Grupo (ej. Maternal, Lactantes 1) *" value={grupo} onChange={(e) => setGrupo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addMaestra(); }} />
        {formError && <p className="text-sm" style={{ color: "#DC2626" }}>{formError}</p>}
        <GlassButton className="w-full" onClick={addMaestra} disabled={saving}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Agregar maestra</GlassButton>
      </GlassCard>

      <GlassCard className="p-2">
        <div className="px-3 py-3 space-y-2">
          {loading && <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>Cargando…</p>}
          {!loading && maestras.length === 0 && <p className="text-sm text-center py-8" style={{ color: "#9CA3AF" }}>Aún no hay maestras registradas.</p>}
          {maestras.map((m) => (
            <div key={m.code} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.6)" }}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "#1E1B4B" }}>{m.name}</p>
                <p className="text-xs" style={{ color: "#9CA3AF" }}>{m.funcion} · {m.grupo}</p>
              </div>
              <button onClick={() => remove(m.code)} className="p-2.5 rounded-xl shrink-0" style={{ background: "rgba(239,68,68,0.08)" }}><Trash2 size={15} color="#DC2626" /></button>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

/* ---------------------------------- Niños ---------------------------------- */

function resizeImageFile(file, maxSize = 300, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Archivo de imagen inválido"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height) { if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; } }
        else { if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize; } }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function NinosTab({ pro, ninos, maestras, loading, onAdded, onRemoved, showToast }) {
  const [name, setName] = useState("");
  const [grupo, setGrupo] = useState("");
  const [foto, setFoto] = useState("");
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProcessingPhoto(true);
    try { const dataUrl = await resizeImageFile(file); setFoto(dataUrl); }
    catch { showToast("No se pudo procesar la imagen"); }
    setProcessingPhoto(false);
  }

  const grupoOptions = Array.from(new Set(maestras.map((m) => m.grupo))).filter(Boolean);

  async function addNino() {
    setFormError("");
    if (!name.trim() || !grupo.trim()) { setFormError("Falta el nombre o el grupo — ambos son obligatorios."); return; }
    setSaving(true);
    const n = { id: "n" + Date.now() + Math.random().toString(36).slice(2, 5), name: name.trim(), grupo: grupo.trim(), foto: foto.trim(), professionalId: pro.id, createdAt: Date.now() };
    try {
      await saveNino(n);
      onAdded(n);
      setName(""); setGrupo(""); setFoto("");
      showToast("Niño agregado");
    } catch (err) { setFormError("No se pudo guardar: " + (err?.message || "intenta de nuevo")); }
    setSaving(false);
  }

  async function remove(id) { onRemoved(id); await deleteNino(id); showToast("Registro eliminado"); }

  return (
    <div className="space-y-4">
      <GlassCard className="p-6 space-y-3">
        <h2 className="font-semibold" style={{ color: "#1E1B4B" }}>Nuevo niño</h2>
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(91,95,239,0.2)" }} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" list="grupos-list" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(91,95,239,0.2)" }} placeholder="Grupo (ej. Maternal)" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
        <datalist id="grupos-list">{grupoOptions.map((g) => <option key={g} value={g} />)}</datalist>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shrink-0" style={{ background: "rgba(236,72,153,0.12)" }}>
            {processingPhoto ? <Loader2 className="animate-spin" size={18} color="#DB2777" /> : foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <Baby size={20} color="#DB2777" />}
          </div>
          <label className="flex-1">
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <span className="block text-center px-4 py-3 rounded-2xl text-sm font-medium cursor-pointer" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(91,95,239,0.2)", color: "#3730A3" }}>
              {foto ? "Cambiar foto" : "Subir foto"}
            </span>
          </label>
          {foto && (
            <button onClick={() => setFoto("")} className="p-3 rounded-2xl shrink-0" style={{ background: "rgba(239,68,68,0.08)" }}><X size={15} color="#DC2626" /></button>
          )}
        </div>
        <GlassButton className="w-full" onClick={addNino} disabled={saving || processingPhoto}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Agregar niño</GlassButton>
        {formError && <p className="text-sm" style={{ color: "#DC2626" }}>{formError}</p>}
      </GlassCard>

      <GlassCard className="p-2">
        <div className="px-3 py-3 space-y-2">
          {loading && <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>Cargando…</p>}
          {!loading && ninos.length === 0 && <p className="text-sm text-center py-8" style={{ color: "#9CA3AF" }}>Aún no hay niños registrados.</p>}
          {ninos.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.6)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "rgba(236,72,153,0.12)" }}>
                  {n.foto ? <img src={n.foto} alt="" className="w-full h-full object-cover" /> : <Baby size={16} color="#DB2777" />}
                </div>
                <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: "#1E1B4B" }}>{n.name}</p><p className="text-xs" style={{ color: "#9CA3AF" }}>{n.grupo}</p></div>
              </div>
              <button onClick={() => remove(n.id)} className="p-2.5 rounded-xl shrink-0" style={{ background: "rgba(239,68,68,0.08)" }}><Trash2 size={15} color="#DC2626" /></button>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

/* ------------------------------ Day navigator ------------------------------ */

function DayNav({ date, setDate }) {
  const d = new Date(date + "T00:00:00");
  return (
    <div className="flex items-center justify-between mb-1">
      <button onClick={() => setDate(dateKey(addDays(d, -1)))} className="p-2 rounded-xl" style={{ background: "rgba(91,95,239,0.08)" }}><ChevronLeft size={16} color="#5B5FEF" /></button>
      <p className="text-sm font-medium capitalize" style={{ color: "#1E1B4B" }}>{dayLabel(d)}</p>
      <button onClick={() => setDate(dateKey(addDays(d, 1)))} className="p-2 rounded-xl" style={{ background: "rgba(91,95,239,0.08)" }}><ChevronRight size={16} color="#5B5FEF" /></button>
    </div>
  );
}

/* ------------------------------ Nino log widget ----------------------------- */

function NinoLogWidget({ nino, date, showToast, readOnly }) {
  const [log, setLog] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    let alive = true;
    getLog(nino.id, date).then((l) => { if (alive) setLog(l || emptyLog(nino, date)); });
    return () => { alive = false; };
  }, [nino.id, date]);

  async function persist(updated) {
    setLog(updated);
    try { await saveLog(updated); } catch { showToast && showToast("No se pudo guardar"); }
  }

  function logMeal(cantidad) { if (!log) return; persist({ ...log, alimentacion: [...log.alimentacion, { time: Date.now(), cantidad }] }); showToast && showToast("Registrado"); }
  function logDiaper(tipo) { if (!log) return; persist({ ...log, panales: [...log.panales, { time: Date.now(), tipo }] }); showToast && showToast("Registrado"); }
  function startNap() { if (!log) return; persist({ ...log, siestas: [...log.siestas, { inicio: Date.now(), fin: null }] }); }
  function endNap() {
    if (!log || log.siestas.length === 0) return;
    const siestas = [...log.siestas];
    const idx = siestas.length - 1;
    if (!siestas[idx].fin) { siestas[idx] = { ...siestas[idx], fin: Date.now() }; persist({ ...log, siestas }); }
  }
  function logMood(estado) { if (!log) return; persist({ ...log, animos: [...log.animos, { time: Date.now(), estado }] }); }
  function sendNote() { if (!log || !noteText.trim()) return; persist({ ...log, notas: [...log.notas, { time: Date.now(), text: noteText.trim() }] }); setNoteText(""); }

  const lastMeal = log?.alimentacion[log.alimentacion.length - 1];
  const lastMood = log?.animos[log.animos.length - 1];
  const activeNap = log?.siestas.find((s) => !s.fin);
  const diaperCount = log?.panales.length || 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.6)" }}>
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between gap-3 p-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "rgba(236,72,153,0.12)" }}>
            {nino.foto ? <img src={nino.foto} alt="" className="w-full h-full object-cover" /> : <Baby size={16} color="#DB2777" />}
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium truncate" style={{ color: "#1E1B4B" }}>{nino.name}</p>
            <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>
              {lastMeal ? `Comida: ${MEAL_OPTIONS.find((o) => o.key === lastMeal.cantidad)?.label}` : "Sin registros hoy"}
              {activeNap ? " · Durmiendo" : ""}
            </p>
          </div>
        </div>
        <ChevronDown size={16} color="#C7C9E8" className="shrink-0 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
      </button>

      {expanded && log && (
        <div className="px-3.5 pb-4 space-y-4" style={{ borderTop: "1px solid rgba(91,95,239,0.1)" }}>
          {/* Alimentación */}
          <div className="pt-3">
            <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "#4C4E9E" }}><Utensils size={13} /> Alimentación</p>
            {!readOnly && (
              <div className="grid grid-cols-3 gap-1.5">
                {MEAL_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => logMeal(o.key)} className="py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(20,184,166,0.1)", color: "#0D9488" }}>{o.label}</button>
                ))}
              </div>
            )}
            <div className="mt-1.5 space-y-0.5">
              {log.alimentacion.length === 0 && <p className="text-xs" style={{ color: "#B3B6D9" }}>Sin registros.</p>}
              {log.alimentacion.map((a, i) => <p key={i} className="text-xs" style={{ color: "#6B7280" }}>{fmtTime(a.time)} · {MEAL_OPTIONS.find((o) => o.key === a.cantidad)?.label}</p>)}
            </div>
          </div>

          {/* Pañal / baño */}
          <div>
            <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "#4C4E9E" }}><Droplet size={13} /> Pañal / baño ({diaperCount})</p>
            {!readOnly && (
              <div className="grid grid-cols-2 gap-1.5">
                {DIAPER_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => logDiaper(o.key)} className="py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(91,95,239,0.08)", color: "#3730A3" }}>{o.label}</button>
                ))}
              </div>
            )}
            <div className="mt-1.5 space-y-0.5">
              {log.panales.length === 0 && <p className="text-xs" style={{ color: "#B3B6D9" }}>Sin registros.</p>}
              {log.panales.map((p, i) => <p key={i} className="text-xs" style={{ color: "#6B7280" }}>{fmtTime(p.time)} · {DIAPER_OPTIONS.find((o) => o.key === p.tipo)?.label}</p>)}
            </div>
          </div>

          {/* Siesta */}
          <div>
            <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "#4C4E9E" }}><Moon size={13} /> Siesta</p>
            {!readOnly && (
              activeNap ? (
                <GlassButton variant="secondary" className="w-full" onClick={endNap}>Terminar siesta (inició {fmtTime(activeNap.inicio)})</GlassButton>
              ) : (
                <GlassButton variant="secondary" className="w-full" onClick={startNap}>Iniciar siesta</GlassButton>
              )
            )}
            <div className="mt-1.5 space-y-0.5">
              {log.siestas.length === 0 && <p className="text-xs" style={{ color: "#B3B6D9" }}>Sin registros.</p>}
              {log.siestas.map((s, i) => <p key={i} className="text-xs" style={{ color: "#6B7280" }}>{fmtTime(s.inicio)} – {s.fin ? fmtTime(s.fin) : "en curso"}</p>)}
            </div>
          </div>

          {/* Ánimo y notas */}
          <div>
            <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "#4C4E9E" }}><Smile size={13} /> Ánimo y observaciones</p>
            {!readOnly && (
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {MOOD_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => logMood(o.key)} className="py-2.5 rounded-xl text-xs font-medium" style={{ background: lastMood?.estado === o.key ? "linear-gradient(135deg,#6366F1,#5B5FEF)" : "rgba(255,255,255,0.7)", color: lastMood?.estado === o.key ? "white" : "#3730A3", border: "1px solid rgba(91,95,239,0.15)" }}>{o.label}</button>
                ))}
              </div>
            )}
            {!readOnly && (
              <div className="flex gap-2 mb-2">
                <input className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(91,95,239,0.2)" }} placeholder="Nota rápida…" value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendNote(); }} />
                <button onClick={sendNote} className="p-2.5 rounded-xl" style={{ background: "linear-gradient(135deg,#6366F1,#5B5FEF)" }}><Send size={14} color="white" /></button>
              </div>
            )}
            <div className="space-y-0.5">
              {log.animos.length === 0 && log.notas.length === 0 && <p className="text-xs" style={{ color: "#B3B6D9" }}>Sin registros.</p>}
              {log.animos.map((a, i) => <p key={"a" + i} className="text-xs" style={{ color: "#6B7280" }}>{fmtTime(a.time)} · Ánimo: {MOOD_OPTIONS.find((o) => o.key === a.estado)?.label}</p>)}
              {log.notas.map((n, i) => <p key={"n" + i} className="text-xs" style={{ color: "#6B7280" }}>{fmtTime(n.time)} · "{n.text}"</p>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Admin bitácoras ----------------------------- */

function BitacorasAdminTab({ maestras, ninos, loading, copyLink, linkUrl, onPreview, showToast }) {
  const [openMaestra, setOpenMaestra] = useState(null);
  const [date, setDate] = useState(dateKey(new Date()));

  if (openMaestra) {
    const grupoNinos = ninos.filter((n) => n.grupo === openMaestra.grupo);
    return (
      <div className="space-y-4">
        <button onClick={() => setOpenMaestra(null)} className="text-sm flex items-center gap-1.5" style={{ color: "#6B7280" }}><ArrowLeft size={14} /> Todas las maestras</button>
        <GlassCard className="p-5">
          <p className="font-semibold mb-0.5" style={{ color: "#1E1B4B" }}>{openMaestra.name}</p>
          <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>{openMaestra.grupo}</p>
          <DayNav date={date} setDate={setDate} />
        </GlassCard>
        <div className="space-y-2">
          {grupoNinos.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#9CA3AF" }}>No hay niños registrados en este grupo.</p></GlassCard>}
          {grupoNinos.map((n) => <NinoLogWidget key={n.id} nino={n} date={date} readOnly showToast={showToast} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {loading && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#9CA3AF" }}>Cargando…</p></GlassCard>}
      {!loading && maestras.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#9CA3AF" }}>Agrega maestras primero para poder enviarles su link de bitácora.</p></GlassCard>}
      {maestras.map((m) => (
        <GlassCard key={m.code} className="p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="min-w-0"><p className="text-sm font-medium" style={{ color: "#1E1B4B" }}>{m.name}</p><p className="text-xs" style={{ color: "#9CA3AF" }}>{m.grupo}</p></div>
            <button onClick={() => copyLink(m.code)} className="p-2.5 rounded-xl shrink-0" style={{ background: "rgba(91,95,239,0.08)" }}><Copy size={15} color="#5B5FEF" /></button>
          </div>
          <p className="text-xs font-mono truncate mb-3" style={{ color: "#B3B6D9" }}>{linkUrl(m.code)}</p>
          <div className="flex gap-2">
            <GlassButton variant="secondary" className="flex-1" onClick={() => setOpenMaestra(m)}>Ver bitácora de hoy</GlassButton>
            <GlassButton variant="ghost" onClick={() => onPreview(m.code)}>Vista previa</GlassButton>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

/* ------------------------------ Maestra hub (link) --------------------------- */

function MaestraHub({ code, onExitDemo, showToast }) {
  const [maestra, setMaestra] = useState(null);
  const [ninos, setNinos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(dateKey(new Date()));
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const m = await getMaestra(code);
      setMaestra(m);
      if (m) {
        const all = await listNinos(m.professionalId);
        setNinos(all.filter((n) => n.grupo === m.grupo).sort((a, b) => a.name.localeCompare(b.name)));
      }
      setLoading(false);
    })();
  }, [code]);

  async function bulkMeal(cantidad) {
    setBulkBusy(true);
    for (const n of ninos) {
      const log = (await getLog(n.id, date)) || emptyLog(n, date);
      await saveLog({ ...log, alimentacion: [...log.alimentacion, { time: Date.now(), cantidad }] });
    }
    setBulkBusy(false);
    showToast("Registrado para todo el grupo");
  }
  async function bulkNap(action) {
    setBulkBusy(true);
    for (const n of ninos) {
      const log = (await getLog(n.id, date)) || emptyLog(n, date);
      if (action === "start") {
        await saveLog({ ...log, siestas: [...log.siestas, { inicio: Date.now(), fin: null }] });
      } else {
        const siestas = [...log.siestas];
        const idx = siestas.length - 1;
        if (idx >= 0 && !siestas[idx].fin) { siestas[idx] = { ...siestas[idx], fin: Date.now() }; await saveLog({ ...log, siestas }); }
      }
    }
    setBulkBusy(false);
    showToast(action === "start" ? "Siesta iniciada para el grupo" : "Siesta terminada para el grupo");
  }

  if (loading) return <div className="flex-1 flex items-center justify-center py-24 min-h-screen"><Loader2 className="animate-spin" color="#5B5FEF" /></div>;

  if (!maestra) {
    return (
      <div className="w-full max-w-md px-5 mt-16">
        <GlassCard className="p-8 text-center"><p style={{ color: "#1E1B4B" }}>Este link no es válido.</p></GlassCard>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md px-5 pt-8 pb-16 flex-1">
      <div className="flex items-center gap-2.5 mb-5">
        <Logo size={9} />
        <div><p className="text-xs" style={{ color: "#9CA3AF" }}>{maestra.funcion}</p><p className="font-semibold" style={{ color: "#1E1B4B" }}>{maestra.name} · {maestra.grupo}</p></div>
      </div>

      <GlassCard className="p-4 mb-4">
        <DayNav date={date} setDate={setDate} />
      </GlassCard>

      <GlassCard className="p-4 mb-4">
        <p className="text-xs font-medium mb-2" style={{ color: "#4C4E9E" }}>Registro rápido para todo el grupo</p>
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          {MEAL_OPTIONS.map((o) => (
            <button key={o.key} disabled={bulkBusy} onClick={() => bulkMeal(o.key)} className="py-2.5 rounded-xl text-xs font-medium disabled:opacity-40" style={{ background: "rgba(20,184,166,0.1)", color: "#0D9488" }}>{o.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button disabled={bulkBusy} onClick={() => bulkNap("start")} className="py-2.5 rounded-xl text-xs font-medium disabled:opacity-40" style={{ background: "rgba(91,95,239,0.08)", color: "#3730A3" }}>Iniciar siesta (todos)</button>
          <button disabled={bulkBusy} onClick={() => bulkNap("end")} className="py-2.5 rounded-xl text-xs font-medium disabled:opacity-40" style={{ background: "rgba(91,95,239,0.08)", color: "#3730A3" }}>Terminar siesta (todos)</button>
        </div>
      </GlassCard>

      <div className="space-y-2">
        {ninos.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#9CA3AF" }}>No hay niños registrados en tu grupo todavía.</p></GlassCard>}
        {ninos.map((n) => <NinoLogWidget key={n.id} nino={n} date={date} showToast={showToast} />)}
      </div>

      <button onClick={onExitDemo} className="text-xs mt-6 mx-auto flex items-center gap-1 justify-center w-full" style={{ color: "#B3B6D9" }}>
        <ArrowLeft size={12} /> Salir de la vista previa
      </button>
    </div>
  );
}
