import React, { useState, useEffect, useCallback } from "react";
import {
  LogOut, Plus, Copy, Check, X, ArrowLeft, Loader2, Send, Brain, Gamepad2,
  Trash2, Users, Baby, Utensils, Droplet, Moon, Smile, Frown, Meh,
  MessageSquare, ChevronLeft, ChevronRight, ChevronDown, ShieldCheck, FileDown, DoorOpen,
  Heart, Megaphone, MessageCircle, Home
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
const NAP_DURATIONS = [
  { key: "menos10", label: "10 minutos o menos" },
  { key: "10a30", label: "10 a 30 minutos" },
  { key: "30a60", label: "30 minutos a 1 hora" },
  { key: "mas60", label: "Más de una hora" },
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
async function deleteProfessional(id) {
  try { await sb(`professionals?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }); } catch {}
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

/* ---- padres ---- */
function padreToRow(p) { return { code: p.code, name: p.name, nino_ids: p.ninoIds, professional_id: p.professionalId, created_at: p.createdAt }; }
function rowToPadre(r) { return { code: r.code, name: r.name, ninoIds: r.nino_ids || [], professionalId: r.professional_id, createdAt: r.created_at }; }
async function listPadres(profId) {
  const rows = await sb(`padres?professional_id=eq.${encodeURIComponent(profId)}&order=name`);
  return (rows || []).map(rowToPadre);
}
async function savePadre(p) {
  await sb("padres", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify([padreToRow(p)]) });
}
async function getPadre(code) {
  try {
    const rows = await sb(`padres?code=eq.${encodeURIComponent(code)}`);
    return rows && rows[0] ? rowToPadre(rows[0]) : null;
  } catch { return null; }
}
async function deletePadre(code) {
  try { await sb(`padres?code=eq.${encodeURIComponent(code)}`, { method: "DELETE" }); } catch {}
}

/* ---- circulares (anuncios) ---- */
function circularToRow(c) { return { id: c.id, professional_id: c.professionalId, title: c.title, body: c.body, created_at: c.createdAt }; }
function rowToCircular(r) { return { id: r.id, professionalId: r.professional_id, title: r.title, body: r.body, createdAt: r.created_at }; }
async function listCirculares(profId) {
  const rows = await sb(`circulares?professional_id=eq.${encodeURIComponent(profId)}&order=created_at.desc`);
  return (rows || []).map(rowToCircular);
}
async function saveCircular(c) {
  await sb("circulares", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify([circularToRow(c)]) });
}
async function deleteCircular(id) {
  try { await sb(`circulares?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }); } catch {}
}

/* ---- mensajes con padres ---- */
function msgToRow(m) { return { id: m.id, padre_code: m.padreCode, from_role: m.from, text: m.text, at: m.at }; }
function rowToMsg(r) { return { id: r.id, padreCode: r.padre_code, from: r.from_role, text: r.text, at: r.at }; }
async function listMensajesPadre(padreCode) {
  const rows = await sb(`mensajes_padres?padre_code=eq.${encodeURIComponent(padreCode)}&order=at.asc`);
  return (rows || []).map(rowToMsg);
}
async function sendMensajePadre(padreCode, from, text) {
  const id = `${padreCode}:${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const m = { id, padreCode, from, text, at: Date.now() };
  await sb("mensajes_padres", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify([msgToRow(m)]) });
  return m;
}

/* ---------------------------- Glass primitives --------------------------- */

function SmilingBrainIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M32 9c-6.5 0-10.5 3.8-11.5 7.8-5 1-8.5 5-8.5 9.7 0 2.8 1.2 5.2 3 7-1.3 2-2 4.2-2 6.3 0 5.8 4.8 9.7 10.5 9.7h.8c1 3.8 4.8 6.5 8.7 6.5s7.7-2.7 8.7-6.5h.8c5.7 0 10.5-3.9 10.5-9.7 0-2.1-.7-4.3-2-6.3 1.8-1.8 3-4.2 3-7 0-4.7-3.5-8.7-8.5-9.7C42.5 12.8 38.5 9 32 9z"
        fill="#A8E6CF" stroke="#3D8577" strokeWidth="2.2" strokeLinejoin="round"
      />
      <path d="M32 15v34" stroke="#3D8577" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
      <path d="M20 24c2.5-1.5 5-1.5 6 .5M38 24.5c1-2 3.5-2 6-.5" stroke="#3D8577" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
      <circle cx="24.5" cy="31" r="2.4" fill="#2E3A36" />
      <circle cx="39.5" cy="31" r="2.4" fill="#2E3A36" />
      <path d="M23.5 39c2.8 3.2 12.2 3.2 15 0" stroke="#2E3A36" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function DoorIcon({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="9" width="26" height="47" rx="2.5" fill="#FBEEE3" stroke="#DDA15E" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M38 9 L50 15.5 L50 49.5 L38 56 Z" fill="#F6DCC8" stroke="#E29578" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="44.5" cy="33" r="1.8" fill="#E29578" />
      <path d="M53 20c2 3 2 9 0 13" stroke="#E29578" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      <path d="M57 16c3.5 6 3.5 15 0 21" stroke="#E29578" strokeWidth="1.6" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

function GlassCard({ children, className = "", style = {} }) {
  return (
    <div
      className={`relative rounded-[20px] ${className}`}
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(46,58,54,0.06)",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function GlassButton({ children, onClick, variant = "primary", className = "", disabled, type = "button" }) {
  const variants = {
    primary: { background: "#5FB3A1", color: "white", boxShadow: "0 8px 20px -4px rgba(95,179,161,0.45)" },
    secondary: { background: "#FFFFFF", color: "#4A9483", border: "1.5px solid rgba(95,179,161,0.35)" },
    ghost: { background: "transparent", color: "#4A9483" },
    danger: { background: "#FDEDEB", color: "#D9584F", border: "1px solid rgba(217,88,79,0.25)" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-3 rounded-full font-medium text-sm transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2 ${className}`}
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
        background: "#FAF8F5",
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif',
      }}
    >
      {children}
      <style>{`
        #bitacora-print-area { display: none; }
        @media print {
          body.printing-bitacora > *:not(#bitacora-print-area) { display: none !important; }
          body.printing-bitacora #bitacora-print-area { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function Logo({ size = 10 }) {
  const px = size * 4;
  return (
    <div
      className="rounded-2xl flex items-center justify-center shrink-0"
      style={{ width: px, height: px, background: "#FFFFFF", boxShadow: "0 8px 20px -6px rgba(95,179,161,0.35)" }}
    >
      <SmilingBrainIcon size={px * 0.72} />
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl text-sm font-medium z-50" style={{ background: "rgba(31,58,53,0.92)", color: "white", backdropFilter: "blur(10px)" }}>
      {msg}
    </div>
  );
}

function safeStorageGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch {}
}

function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState("android"); // "android" | "ios"

  useEffect(() => {
    try {
      const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
      if (isStandalone) return;
      if (safeStorageGet("skillmind-install-dismissed") === "1") return;

      const ua = window.navigator.userAgent || "";
      const isIOS = /iPhone|iPad|iPod/.test(ua) && !window.MSStream;

      if (isIOS) {
        setPlatform("ios");
        setVisible(true);
        return;
      }

      function onPrompt(e) {
        e.preventDefault();
        setDeferredEvent(e);
        setPlatform("android");
        setVisible(true);
      }
      window.addEventListener("beforeinstallprompt", onPrompt);
      return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    } catch {}
  }, []);

  function dismiss() {
    setVisible(false);
    safeStorageSet("skillmind-install-dismissed", "1");
  }

  async function install() {
    if (!deferredEvent) return;
    try {
      deferredEvent.prompt();
      await deferredEvent.userChoice;
    } catch {}
    setVisible(false);
    safeStorageSet("skillmind-install-dismissed", "1");
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-50">
      <GlassCard className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#F0FAF7" }}>
            <SmilingBrainIcon size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#2E3A36" }}>Instala Skillmind</p>
            {platform === "android" ? (
              <p className="text-xs mt-0.5" style={{ color: "#7A8A85" }}>Agrégala a tu pantalla de inicio para abrirla como app, sin buscarla en el navegador.</p>
            ) : (
              <p className="text-xs mt-0.5" style={{ color: "#7A8A85" }}>Toca el botón compartir <span style={{ fontWeight: 600 }}>⬆️</span> y luego "Agregar a pantalla de inicio".</p>
            )}
            <div className="flex items-center gap-2 mt-2.5">
              {platform === "android" && (
                <button onClick={install} className="px-3.5 py-2 rounded-full text-xs font-medium" style={{ background: "#5FB3A1", color: "white" }}>Instalar</button>
              )}
              <button onClick={dismiss} className="px-3.5 py-2 rounded-full text-xs font-medium" style={{ background: "transparent", color: "#7A8A85" }}>Ahora no</button>
            </div>
          </div>
          <button onClick={dismiss} className="p-1 shrink-0" style={{ color: "#BFD9D1" }}><X size={16} /></button>
        </div>
      </GlassCard>
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
            <p className="font-semibold mb-2" style={{ color: "#D9584F" }}>Ocurrió un error</p>
            <p className="text-sm mb-4" style={{ color: "#7A8A85" }}>{String(this.state.error.message || this.state.error)}</p>
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
  const [padreCode, setPadreCode] = useState(null);
  const [isPreview, setIsPreview] = useState(false);
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
        const p = hash.match(/#padre\/([A-Za-z0-9]+)/);
        if (m) {
          setMaestraCode(m[1]);
        } else if (p) {
          setPadreCode(p[1]);
        } else {
          // Sin hash en la URL (ej. se abrió desde el ícono instalado): revisa si
          // este dispositivo ya guardó un acceso propio de maestra o padre.
          const saved = safeStorageGet("skillmind-my-access");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.type === "maestra" && parsed.code) setMaestraCode(parsed.code);
            else if (parsed?.type === "padre" && parsed.code) setPadreCode(parsed.code);
          }
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  function handleLogout() { setCurrentPro(null); setView("login"); }

  if (!ready) {
    return (
      <Backdrop>
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader2 className="animate-spin" size={28} color="#4A9483" />
        </div>
      </Backdrop>
    );
  }

  if (maestraCode) {
    return (
      <Backdrop>
        <ErrorBoundary>
          <MaestraHub code={maestraCode} persist={!isPreview} onExitDemo={() => { setMaestraCode(null); setIsPreview(false); }} showToast={showToast} />
        </ErrorBoundary>
        <Toast msg={toast} />
        <InstallPrompt />
      </Backdrop>
    );
  }

  if (padreCode) {
    return (
      <Backdrop>
        <ErrorBoundary>
          <PadreHub code={padreCode} persist={!isPreview} onExitDemo={() => { setPadreCode(null); setIsPreview(false); }} showToast={showToast} />
        </ErrorBoundary>
        <Toast msg={toast} />
        <InstallPrompt />
      </Backdrop>
    );
  }

  return (
    <Backdrop>
      <div className="w-full max-w-3xl px-5 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={10} />
          <span className="font-semibold text-lg tracking-tight" style={{ color: "#2E3A36" }}>
            Skillmind
          </span>
        </div>
        {currentPro && (
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl active:scale-95 transition-transform" style={{ color: "#7A8A85" }}>
            <DoorOpen size={16} /> Cerrar sesión
          </button>
        )}
      </div>

      <div className="w-full max-w-3xl px-5 pb-24">
        <ErrorBoundary>
          {view === "login" && (
            <LoginView professionals={professionals} onLogin={(pro) => { setCurrentPro(pro); setView("dashboard"); }} />
          )}
          {view === "dashboard" && currentPro && (
            <AdminDashboard pro={currentPro} professionals={professionals} setProfessionals={setProfessionals} showToast={showToast} onPreviewMaestra={(code) => { setIsPreview(true); setMaestraCode(code); }} onPreviewPadre={(code) => { setIsPreview(true); setPadreCode(code); }} />
          )}
        </ErrorBoundary>
      </div>
      <Toast msg={toast} />
        <InstallPrompt />
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
      <GlassCard className="w-full p-8" style={{ border: "1.5px solid rgba(95,179,161,0.3)" }}>
        <div className="flex justify-center mb-2"><DoorIcon size={64} /></div>
        <h1 className="text-2xl font-semibold mb-1 text-center" style={{ color: "#2E3A36" }}>Iniciar sesión</h1>
        <p className="text-sm mb-6 text-center" style={{ color: "#7A8A85" }}>Ingresa con el usuario y contraseña que te asignaron.</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "#4A9483" }}>Usuario</label>
            <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Tu usuario" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(e); }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "#4A9483" }}>Contraseña</label>
            <input type="password" className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Tu contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(e); }} />
          </div>
          {error && <p className="text-sm" style={{ color: "#D9584F" }}>{error}</p>}
          <GlassButton onClick={submit} className="w-full mt-1">Ingresar</GlassButton>
        </div>
      </GlassCard>
    </div>
  );
}

/* ---------------------------- Admin dashboard ------------------------------ */

function HomeTile({ icon: Icon, label, sublabel, onClick, accentColor, accentBg }) {
  return (
    <button onClick={onClick} className="flex flex-col items-start gap-3 p-5 rounded-[20px] text-left transition-all active:scale-95"
      style={{ background: "#FFFFFF", border: "1px solid rgba(46,58,54,0.06)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: accentBg }}><Icon size={22} color={accentColor} strokeWidth={2} /></div>
      <div><p className="font-semibold" style={{ color: "#2E3A36" }}>{label}</p>{sublabel && <p className="text-xs mt-0.5" style={{ color: "#7A8A85" }}>{sublabel}</p>}</div>
    </button>
  );
}

function AdminDashboard({ pro, professionals, setProfessionals, showToast, onPreviewMaestra, onPreviewPadre }) {
  const [section, setSection] = useState("home");
  const [maestras, setMaestras] = useState([]);
  const [ninos, setNinos] = useState([]);
  const [padres, setPadres] = useState([]);
  const [circulares, setCirculares] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [m, n, p, c] = await Promise.all([listMaestras(pro.id), listNinos(pro.id), listPadres(pro.id), listCirculares(pro.id)]);
    setMaestras(m); setNinos(n); setPadres(p); setCirculares(c);
    setLoading(false);
  }, [pro.id]);

  useEffect(() => { reload(); }, [reload]);

  function addMaestraLocal(m) { setMaestras((prev) => [...prev, m].sort((a, b) => a.name.localeCompare(b.name))); }
  function removeMaestraLocal(code) { setMaestras((prev) => prev.filter((m) => m.code !== code)); }
  function addNinoLocal(n) { setNinos((prev) => [...prev, n].sort((a, b) => (a.grupo || "").localeCompare(b.grupo || "") || a.name.localeCompare(b.name))); }
  function removeNinoLocal(id) { setNinos((prev) => prev.filter((n) => n.id !== id)); }
  function addUserLocal(u) { setProfessionals((prev) => [...prev, u]); }
  function removeUserLocal(id) { setProfessionals((prev) => prev.filter((p) => p.id !== id)); }
  function addPadreLocal(p) { setPadres((prev) => [...prev, p].sort((a, b) => a.name.localeCompare(b.name))); }
  function removePadreLocal(code) { setPadres((prev) => prev.filter((p) => p.code !== code)); }
  function addCircularLocal(c) { setCirculares((prev) => [c, ...prev]); }
  function removeCircularLocal(id) { setCirculares((prev) => prev.filter((c) => c.id !== id)); }

  function linkUrl(code) {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#maestra/${code}`;
  }
  function copyLink(code) { navigator.clipboard?.writeText(linkUrl(code)); showToast("Link copiado"); }
  function padreLinkUrl(code) {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#padre/${code}`;
  }
  function copyPadreLink(code) { navigator.clipboard?.writeText(padreLinkUrl(code)); showToast("Link copiado"); }

  if (section === "home") {
    return (
      <div className="mt-2 space-y-5">
        <div>
          <h1 className="text-xl font-semibold mb-0.5" style={{ color: "#2E3A36" }}>{pro.guarderia || `Hola, ${pro.name}`}</h1>
          <p className="text-sm" style={{ color: "#7A8A85" }}>{pro.guarderia ? `Hola, ${pro.name}` : "¿Qué quieres revisar hoy?"}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <HomeTile icon={Users} label="Maestras" sublabel={`${maestras.length} registrada(s)`} accentColor="#F28C38" accentBg="#FFF5EC" onClick={() => setSection("maestras")} />
          <HomeTile icon={Baby} label="Niños" sublabel={`${ninos.length} registrado(s)`} accentColor="#E8B93D" accentBg="#FFFDF0" onClick={() => setSection("ninos")} />
          <HomeTile icon={Utensils} label="Bitácoras diarias" sublabel="Reportes de hoy" accentColor="#82C46C" accentBg="#F2F9EF" onClick={() => setSection("bitacoras")} />
          <HomeTile icon={Heart} label="Padres de familia" sublabel={`${padres.length} registrado(s)`} accentColor="#9B7FC7" accentBg="#F3EFFA" onClick={() => setSection("padres")} />
          <HomeTile icon={Megaphone} label="Anuncios" sublabel={`${circulares.length} publicado(s)`} accentColor="#E6A4B4" accentBg="#FBF1F3" onClick={() => setSection("anuncios")} />
          {pro.role === "superadmin" && (
            <HomeTile icon={ShieldCheck} label="Usuarios" sublabel={`${professionals.length} cuenta(s)`} accentColor="#7B93B8" accentBg="#F1F5FA" onClick={() => setSection("usuarios")} />
          )}
        </div>
      </div>
    );
  }

  const titles = { maestras: "Maestras", ninos: "Niños", bitacoras: "Bitácoras diarias", usuarios: "Usuarios", padres: "Padres de familia", anuncios: "Anuncios" };

  return (
    <div className="mt-2 space-y-4">
      <button onClick={() => setSection("home")} className="text-sm flex items-center gap-1.5" style={{ color: "#7A8A85" }}><ArrowLeft size={14} /> Menú principal</button>
      <h1 className="text-xl font-semibold" style={{ color: "#2E3A36" }}>{titles[section]}</h1>

      {section === "maestras" && <MaestrasTab pro={pro} maestras={maestras} loading={loading} reload={reload} onAdded={addMaestraLocal} onRemoved={removeMaestraLocal} showToast={showToast} />}
      {section === "ninos" && <NinosTab pro={pro} ninos={ninos} maestras={maestras} loading={loading} reload={reload} onAdded={addNinoLocal} onRemoved={removeNinoLocal} showToast={showToast} />}
      {section === "bitacoras" && <BitacorasAdminTab maestras={maestras} ninos={ninos} loading={loading} copyLink={copyLink} linkUrl={linkUrl} onPreview={onPreviewMaestra} showToast={showToast} />}
      {section === "padres" && <PadresTab pro={pro} padres={padres} ninos={ninos} loading={loading} onAdded={addPadreLocal} onRemoved={removePadreLocal} copyLink={copyPadreLink} linkUrl={padreLinkUrl} onPreview={onPreviewPadre} showToast={showToast} />}
      {section === "anuncios" && <CircularesTab pro={pro} circulares={circulares} loading={loading} onAdded={addCircularLocal} onRemoved={removeCircularLocal} showToast={showToast} />}
      {section === "usuarios" && pro.role === "superadmin" && (
        <UsuariosTab professionals={professionals} onAdded={addUserLocal} onRemoved={removeUserLocal} showToast={showToast} />
      )}
    </div>
  );
}

/* -------------------------------- Usuarios -------------------------------- */

function UsuariosTab({ professionals, onAdded, onRemoved, showToast }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [guarderia, setGuarderia] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function addUser() {
    setFormError("");
    if (!username.trim() || !password.trim() || !guarderia.trim()) { setFormError("Faltan campos por llenar — usuario, contraseña y nombre de guardería son obligatorios."); return; }
    if (professionals.some((p) => p.username === username.trim())) { setFormError("Ese usuario ya existe."); return; }
    setSaving(true);
    const u = { id: "p" + Date.now() + Math.random().toString(36).slice(2, 5), username: username.trim(), password: password.trim(), name: guarderia.trim(), guarderia: guarderia.trim(), role: "profesional" };
    try {
      await upsertProfessional(u);
      onAdded(u);
      setUsername(""); setPassword(""); setGuarderia("");
      showToast("Usuario creado");
    } catch (err) { setFormError("No se pudo guardar: " + (err?.message || "intenta de nuevo")); }
    setSaving(false);
  }

  async function remove(u) {
    onRemoved(u.id);
    await deleteProfessional(u.id);
    showToast("Usuario eliminado");
  }

  const others = professionals.filter((p) => p.role !== "superadmin");

  return (
    <div className="space-y-4">
      <GlassCard className="p-6 space-y-3">
        <h2 className="font-semibold" style={{ color: "#2E3A36" }}>Nuevo usuario</h2>
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Usuario" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Nombre de guardería" value={guarderia} onChange={(e) => setGuarderia(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addUser(); }} />
        {formError && <p className="text-sm" style={{ color: "#D9584F" }}>{formError}</p>}
        <GlassButton className="w-full" onClick={addUser} disabled={saving}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Crear usuario</GlassButton>
      </GlassCard>

      <GlassCard className="p-2">
        <div className="px-3 py-3 space-y-2">
          {others.length === 0 && <p className="text-sm text-center py-8" style={{ color: "#7A8A85" }}>Aún no hay usuarios adicionales.</p>}
          {others.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.6)" }}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "#2E3A36" }}>{u.guarderia || u.name}</p>
                <p className="text-xs" style={{ color: "#7A8A85" }}>@{u.username}</p>
              </div>
              <button onClick={() => remove(u)} className="p-2.5 rounded-xl shrink-0" style={{ background: "rgba(217,88,79,0.08)" }}><Trash2 size={15} color="#D9584F" /></button>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

/* -------------------------------- Padres -------------------------------- */

function ChildChecklist({ ninos, selected, onToggle }) {
  if (ninos.length === 0) {
    return <p className="text-xs" style={{ color: "#7A8A85" }}>Registra primero a los niños en el apartado "Niños".</p>;
  }
  return (
    <div className="space-y-1.5">
      {ninos.map((n) => {
        const checked = selected.includes(n.id);
        return (
          <button key={n.id} onClick={() => onToggle(n.id)} className="w-full flex items-center justify-between text-sm p-2.5 rounded-xl text-left" style={{ background: checked ? "rgba(155,127,199,0.1)" : "rgba(255,255,255,0.6)" }}>
            <span style={{ color: "#2E3A36" }}>{n.name} <span style={{ color: "#7A8A85" }}>· {n.grupo}</span></span>
            <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={checked ? { background: "#9B7FC7" } : { border: "1.5px solid rgba(155,127,199,0.35)" }}>
              {checked && <Check size={12} color="white" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PadreRow({ p, ninos, copyLink, linkUrl, onPreview, onRemove, showToast }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const childrenNames = ninos.filter((n) => p.ninoIds.includes(n.id)).map((n) => n.name).join(", ") || "Sin hijos vinculados";

  async function loadMessages() {
    setLoadingMsgs(true);
    const m = await listMensajesPadre(p.code);
    setMessages(m);
    setLoadingMsgs(false);
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) loadMessages();
  }

  async function sendReply() {
    if (!reply.trim()) return;
    const text = reply.trim();
    setReply("");
    try { const m = await sendMensajePadre(p.code, "coordinadora", text); setMessages((prev) => [...prev, m]); }
    catch { showToast("No se pudo enviar el mensaje"); }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.6)" }}>
      <div className="flex items-center justify-between gap-2 p-3.5">
        <button onClick={toggleOpen} className="flex items-center gap-2 min-w-0 flex-1 text-left">
          <ChevronDown size={15} color="#C7D9D4" className="shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "#2E3A36" }}>{p.name}</p>
            <p className="text-xs truncate" style={{ color: "#7A8A85" }}>{childrenNames}</p>
          </div>
        </button>
        <button onClick={() => onRemove(p.code)} className="p-2.5 rounded-xl shrink-0" style={{ background: "rgba(217,88,79,0.08)" }}><Trash2 size={15} color="#D9584F" /></button>
      </div>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-3" style={{ borderTop: "1px solid rgba(155,127,199,0.12)" }}>
          <div className="pt-3">
            <p className="text-xs font-medium mb-1.5" style={{ color: "#4A9483" }}>Link único para esta familia</p>
            <p className="text-xs font-mono truncate mb-2" style={{ color: "#BFD9D1" }}>{linkUrl(p.code)}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => copyLink(p.code)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(155,127,199,0.1)", color: "#7A5FA8" }}><Copy size={13} /> Copiar link</button>
              <button onClick={() => onPreview(p.code)} className="flex-1 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.7)", color: "#7A5FA8", border: "1px solid rgba(155,127,199,0.2)" }}>Vista previa</button>
            </div>
          </div>
          <div className="pt-1">
            <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "#4A9483" }}><MessageCircle size={13} /> Mensajes</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto mb-2">
              {loadingMsgs && <p className="text-xs" style={{ color: "#7A8A85" }}>Cargando…</p>}
              {!loadingMsgs && messages.length === 0 && <p className="text-xs" style={{ color: "#BFD9D1" }}>Aún no hay mensajes.</p>}
              {messages.map((m, i) => (
                <div key={i} className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs ${m.from === "coordinadora" ? "ml-auto" : ""}`}
                  style={m.from === "coordinadora" ? { background: "#5FB3A1", color: "white" } : { background: "rgba(255,255,255,0.9)", color: "#2E3A36" }}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Responder…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }} />
              <button onClick={sendReply} className="p-2.5 rounded-xl" style={{ background: "#5FB3A1" }}><Send size={14} color="white" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PadresTab({ pro, padres, ninos, loading, onAdded, onRemoved, copyLink, linkUrl, onPreview, showToast }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function toggleChild(id) { setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }

  async function addPadre() {
    setFormError("");
    if (!name.trim()) { setFormError("Falta el nombre del padre o tutor."); return; }
    if (selected.length === 0) { setFormError("Selecciona al menos un niño para vincular."); return; }
    setSaving(true);
    const p = { code: genCode(), name: name.trim(), ninoIds: selected, professionalId: pro.id, createdAt: Date.now() };
    try {
      await savePadre(p);
      onAdded(p);
      setName(""); setSelected([]);
      showToast("Padre/tutor agregado");
    } catch (err) { setFormError("No se pudo guardar: " + (err?.message || "intenta de nuevo")); }
    setSaving(false);
  }

  async function remove(code) {
    onRemoved(code);
    await deletePadre(code);
    showToast("Registro eliminado");
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-6 space-y-3">
        <h2 className="font-semibold" style={{ color: "#2E3A36" }}>Nuevo padre/tutor</h2>
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(155,127,199,0.25)" }} placeholder="Nombre del padre o tutor" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: "#4A9483" }}>Hijos a vincular</p>
          <ChildChecklist ninos={ninos} selected={selected} onToggle={toggleChild} />
        </div>
        {formError && <p className="text-sm" style={{ color: "#D9584F" }}>{formError}</p>}
        <GlassButton className="w-full" onClick={addPadre} disabled={saving}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Crear y generar link</GlassButton>
      </GlassCard>

      <GlassCard className="p-2">
        <div className="px-3 py-3 space-y-2">
          {loading && <p className="text-sm text-center py-6" style={{ color: "#7A8A85" }}>Cargando…</p>}
          {!loading && padres.length === 0 && <p className="text-sm text-center py-8" style={{ color: "#7A8A85" }}>Aún no hay padres de familia registrados.</p>}
          {padres.map((p) => <PadreRow key={p.code} p={p} ninos={ninos} copyLink={copyLink} linkUrl={linkUrl} onPreview={onPreview} onRemove={remove} showToast={showToast} />)}
        </div>
      </GlassCard>
    </div>
  );
}

/* -------------------------------- Anuncios -------------------------------- */

function CircularesTab({ pro, circulares, loading, onAdded, onRemoved, showToast }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function addCircular() {
    setFormError("");
    if (!title.trim() || !body.trim()) { setFormError("Falta el título o el contenido del anuncio."); return; }
    setSaving(true);
    const c = { id: "c" + Date.now() + Math.random().toString(36).slice(2, 5), professionalId: pro.id, title: title.trim(), body: body.trim(), createdAt: Date.now() };
    try {
      await saveCircular(c);
      onAdded(c);
      setTitle(""); setBody("");
      showToast("Anuncio publicado");
    } catch (err) { setFormError("No se pudo publicar: " + (err?.message || "intenta de nuevo")); }
    setSaving(false);
  }

  async function remove(id) { onRemoved(id); await deleteCircular(id); showToast("Anuncio eliminado"); }

  return (
    <div className="space-y-4">
      <GlassCard className="p-6 space-y-3">
        <h2 className="font-semibold" style={{ color: "#2E3A36" }}>Nuevo anuncio</h2>
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(230,164,180,0.35)" }} placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" rows={4} style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(230,164,180,0.35)" }} placeholder="Escribe el anuncio o circular…" value={body} onChange={(e) => setBody(e.target.value)} />
        {formError && <p className="text-sm" style={{ color: "#D9584F" }}>{formError}</p>}
        <GlassButton className="w-full" onClick={addCircular} disabled={saving}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Megaphone size={16} />} Publicar anuncio</GlassButton>
      </GlassCard>

      <div className="space-y-2">
        {loading && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Cargando…</p></GlassCard>}
        {!loading && circulares.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Aún no has publicado ningún anuncio.</p></GlassCard>}
        {circulares.map((c) => (
          <GlassCard key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "#2E3A36" }}>{c.title}</p>
                <p className="text-xs mt-1" style={{ color: "#7A8A85" }}>{c.body}</p>
                <p className="text-xs mt-1.5" style={{ color: "#BFD9D1" }}>{new Date(c.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <button onClick={() => remove(c.id)} className="p-2 rounded-xl shrink-0" style={{ background: "rgba(217,88,79,0.08)" }}><Trash2 size={14} color="#D9584F" /></button>
            </div>
          </GlassCard>
        ))}
      </div>
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
        <h2 className="font-semibold" style={{ color: "#2E3A36" }}>Nueva maestra</h2>
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Nombre completo *" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Función (ej. Maestra titular, Auxiliar)" value={funcion} onChange={(e) => setFuncion(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Grupo (ej. Maternal, Lactantes 1) *" value={grupo} onChange={(e) => setGrupo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addMaestra(); }} />
        {formError && <p className="text-sm" style={{ color: "#D9584F" }}>{formError}</p>}
        <GlassButton className="w-full" onClick={addMaestra} disabled={saving}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Agregar maestra</GlassButton>
      </GlassCard>

      <GlassCard className="p-2">
        <div className="px-3 py-3 space-y-2">
          {loading && <p className="text-sm text-center py-6" style={{ color: "#7A8A85" }}>Cargando…</p>}
          {!loading && maestras.length === 0 && <p className="text-sm text-center py-8" style={{ color: "#7A8A85" }}>Aún no hay maestras registradas.</p>}
          {maestras.map((m) => (
            <div key={m.code} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.6)" }}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "#2E3A36" }}>{m.name}</p>
                <p className="text-xs" style={{ color: "#7A8A85" }}>{m.funcion} · {m.grupo}</p>
              </div>
              <button onClick={() => remove(m.code)} className="p-2.5 rounded-xl shrink-0" style={{ background: "rgba(217,88,79,0.08)" }}><Trash2 size={15} color="#D9584F" /></button>
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
        <h2 className="font-semibold" style={{ color: "#2E3A36" }}>Nuevo niño</h2>
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" list="grupos-list" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Grupo (ej. Maternal)" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
        <datalist id="grupos-list">{grupoOptions.map((g) => <option key={g} value={g} />)}</datalist>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shrink-0" style={{ background: "rgba(232,185,61,0.12)" }}>
            {processingPhoto ? <Loader2 className="animate-spin" size={18} color="#C99A2E" /> : foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <Baby size={20} color="#C99A2E" />}
          </div>
          <label className="flex-1">
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <span className="block text-center px-4 py-3 rounded-2xl text-sm font-medium cursor-pointer" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)", color: "#4A9483" }}>
              {foto ? "Cambiar foto" : "Subir foto"}
            </span>
          </label>
          {foto && (
            <button onClick={() => setFoto("")} className="p-3 rounded-2xl shrink-0" style={{ background: "rgba(217,88,79,0.08)" }}><X size={15} color="#D9584F" /></button>
          )}
        </div>
        <GlassButton className="w-full" onClick={addNino} disabled={saving || processingPhoto}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Agregar niño</GlassButton>
        {formError && <p className="text-sm" style={{ color: "#D9584F" }}>{formError}</p>}
      </GlassCard>

      <GlassCard className="p-2">
        <div className="px-3 py-3 space-y-2">
          {loading && <p className="text-sm text-center py-6" style={{ color: "#7A8A85" }}>Cargando…</p>}
          {!loading && ninos.length === 0 && <p className="text-sm text-center py-8" style={{ color: "#7A8A85" }}>Aún no hay niños registrados.</p>}
          {ninos.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.6)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "rgba(232,185,61,0.12)" }}>
                  {n.foto ? <img src={n.foto} alt="" className="w-full h-full object-cover" /> : <Baby size={16} color="#C99A2E" />}
                </div>
                <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: "#2E3A36" }}>{n.name}</p><p className="text-xs" style={{ color: "#7A8A85" }}>{n.grupo}</p></div>
              </div>
              <button onClick={() => remove(n.id)} className="p-2.5 rounded-xl shrink-0" style={{ background: "rgba(217,88,79,0.08)" }}><Trash2 size={15} color="#D9584F" /></button>
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
      <button onClick={() => setDate(dateKey(addDays(d, -1)))} className="p-2 rounded-xl" style={{ background: "rgba(95,179,161,0.08)" }}><ChevronLeft size={16} color="#4A9483" /></button>
      <p className="text-sm font-medium capitalize" style={{ color: "#2E3A36" }}>{dayLabel(d)}</p>
      <button onClick={() => setDate(dateKey(addDays(d, 1)))} className="p-2 rounded-xl" style={{ background: "rgba(95,179,161,0.08)" }}><ChevronRight size={16} color="#4A9483" /></button>
    </div>
  );
}

/* ------------------------------ Nino log widget ----------------------------- */

function NinoLogWidget({ nino, date, showToast, readOnly }) {
  const [log, setLog] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [napAsking, setNapAsking] = useState(false);

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
  function logNapNo() { if (!log) return; persist({ ...log, siestas: [...log.siestas, { time: Date.now(), durmio: "no" }] }); setNapAsking(false); showToast && showToast("Registrado"); }
  function logNapYes(duracion) { if (!log) return; persist({ ...log, siestas: [...log.siestas, { time: Date.now(), durmio: "si", duracion }] }); setNapAsking(false); showToast && showToast("Registrado"); }
  function logMood(estado) { if (!log) return; persist({ ...log, animos: [...log.animos, { time: Date.now(), estado }] }); }
  function sendNote() { if (!log || !noteText.trim()) return; persist({ ...log, notas: [...log.notas, { time: Date.now(), text: noteText.trim() }] }); setNoteText(""); }

  const lastMeal = log?.alimentacion[log.alimentacion.length - 1];
  const lastMood = log?.animos[log.animos.length - 1];
  const diaperCount = log?.panales.length || 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.6)" }}>
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between gap-3 p-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "rgba(232,185,61,0.12)" }}>
            {nino.foto ? <img src={nino.foto} alt="" className="w-full h-full object-cover" /> : <Baby size={16} color="#C99A2E" />}
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium truncate" style={{ color: "#2E3A36" }}>{nino.name}</p>
            <p className="text-xs truncate" style={{ color: "#7A8A85" }}>
              {lastMeal ? `Comida: ${MEAL_OPTIONS.find((o) => o.key === lastMeal.cantidad)?.label}` : "Sin registros hoy"}
            </p>
          </div>
        </div>
        <ChevronDown size={16} color="#C7D9D4" className="shrink-0 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
      </button>

      {expanded && log && (
        <div className="px-3.5 pb-4 space-y-4" style={{ borderTop: "1px solid rgba(95,179,161,0.1)" }}>
          {/* Alimentación */}
          <div className="pt-3">
            <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "#4A9483" }}><Utensils size={13} /> Alimentación</p>
            {!readOnly && (
              <div className="grid grid-cols-3 gap-1.5">
                {MEAL_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => logMeal(o.key)} className="py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(232,185,61,0.1)", color: "#C99A2E" }}>{o.label}</button>
                ))}
              </div>
            )}
            <div className="mt-1.5 space-y-0.5">
              {log.alimentacion.length === 0 && <p className="text-xs" style={{ color: "#BFD9D1" }}>Sin registros.</p>}
              {log.alimentacion.map((a, i) => <p key={i} className="text-xs" style={{ color: "#7A8A85" }}>{fmtTime(a.time)} · {MEAL_OPTIONS.find((o) => o.key === a.cantidad)?.label}</p>)}
            </div>
          </div>

          {/* Pañal / baño */}
          <div>
            <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "#4A9483" }}><Droplet size={13} /> Pañal / baño ({diaperCount})</p>
            {!readOnly && (
              <div className="grid grid-cols-2 gap-1.5">
                {DIAPER_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => logDiaper(o.key)} className="py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(95,179,161,0.08)", color: "#4A9483" }}>{o.label}</button>
                ))}
              </div>
            )}
            <div className="mt-1.5 space-y-0.5">
              {log.panales.length === 0 && <p className="text-xs" style={{ color: "#BFD9D1" }}>Sin registros.</p>}
              {log.panales.map((p, i) => <p key={i} className="text-xs" style={{ color: "#7A8A85" }}>{fmtTime(p.time)} · {DIAPER_OPTIONS.find((o) => o.key === p.tipo)?.label}</p>)}
            </div>
          </div>

          {/* Siesta */}
          <div>
            <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "#4A9483" }}><Moon size={13} /> Siesta</p>
            {!readOnly && (
              napAsking ? (
                <div>
                  <p className="text-xs mb-1.5" style={{ color: "#7A8A85" }}>¿Cuánto durmió?</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {NAP_DURATIONS.map((d) => (
                      <button key={d.key} onClick={() => logNapYes(d.key)} className="py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(95,179,161,0.08)", color: "#4A9483" }}>{d.label}</button>
                    ))}
                  </div>
                  <button onClick={() => setNapAsking(false)} className="text-xs mt-1.5" style={{ color: "#7A8A85" }}>Cancelar</button>
                </div>
              ) : (
                <div>
                  <p className="text-xs mb-1.5" style={{ color: "#7A8A85" }}>¿Durmió siesta?</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => setNapAsking(true)} className="py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(130,196,108,0.14)", color: "#5FA34A" }}>Sí</button>
                    <button onClick={logNapNo} className="py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.7)", color: "#5C6B66", border: "1px solid rgba(122,138,133,0.2)" }}>No</button>
                  </div>
                </div>
              )
            )}
            <div className="mt-1.5 space-y-0.5">
              {log.siestas.length === 0 && <p className="text-xs" style={{ color: "#BFD9D1" }}>Sin registros.</p>}
              {log.siestas.map((s, i) => (
                <p key={i} className="text-xs" style={{ color: "#7A8A85" }}>
                  {fmtTime(s.time)} · {s.durmio === "si" ? `Durmió: ${NAP_DURATIONS.find((d) => d.key === s.duracion)?.label}` : "No durmió siesta"}
                </p>
              ))}
            </div>
          </div>

          {/* Ánimo y notas */}
          <div>
            <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "#4A9483" }}><Smile size={13} /> Ánimo y observaciones</p>
            {!readOnly && (
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {MOOD_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => logMood(o.key)} className="py-2.5 rounded-xl text-xs font-medium" style={{ background: lastMood?.estado === o.key ? "linear-gradient(135deg,#5FB3A1,#4A9483)" : "rgba(255,255,255,0.7)", color: lastMood?.estado === o.key ? "white" : "#4A9483", border: "1px solid rgba(95,179,161,0.15)" }}>{o.label}</button>
                ))}
              </div>
            )}
            {!readOnly && (
              <div className="flex gap-2 mb-2">
                <input className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Nota rápida…" value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendNote(); }} />
                <button onClick={sendNote} className="p-2.5 rounded-xl" style={{ background: "linear-gradient(135deg,#5FB3A1,#4A9483)" }}><Send size={14} color="white" /></button>
              </div>
            )}
            <div className="space-y-0.5">
              {log.animos.length === 0 && log.notas.length === 0 && <p className="text-xs" style={{ color: "#BFD9D1" }}>Sin registros.</p>}
              {log.animos.map((a, i) => <p key={"a" + i} className="text-xs" style={{ color: "#7A8A85" }}>{fmtTime(a.time)} · Ánimo: {MOOD_OPTIONS.find((o) => o.key === a.estado)?.label}</p>)}
              {log.notas.map((n, i) => <p key={"n" + i} className="text-xs" style={{ color: "#7A8A85" }}>{fmtTime(n.time)} · "{n.text}"</p>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Admin bitácoras ----------------------------- */

function fmtDateEs(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function buildBitacoraHTML(maestra, dateStr, entries) {
  const rows = entries.map(({ nino, log }) => {
    const alimentacion = log.alimentacion.length
      ? log.alimentacion.map((a) => `${fmtTime(a.time)} · ${MEAL_OPTIONS.find((o) => o.key === a.cantidad)?.label}`).join("<br/>")
      : "Sin registros";
    const panales = log.panales.length
      ? log.panales.map((p) => `${fmtTime(p.time)} · ${DIAPER_OPTIONS.find((o) => o.key === p.tipo)?.label}`).join("<br/>")
      : "Sin registros";
    const siestas = log.siestas.length
      ? log.siestas.map((s) => `${fmtTime(s.time)} · ${s.durmio === "si" ? "Durmió: " + NAP_DURATIONS.find((d) => d.key === s.duracion)?.label : "No durmió siesta"}`).join("<br/>")
      : "Sin registros";
    const animos = log.animos.length
      ? log.animos.map((a) => `${fmtTime(a.time)} · ${MOOD_OPTIONS.find((o) => o.key === a.estado)?.label}`).join("<br/>")
      : "Sin registros";
    const notas = log.notas.length ? log.notas.map((n) => `${fmtTime(n.time)} · "${n.text}"`).join("<br/>") : "Sin notas";
    return `
      <section style="page-break-inside:avoid;margin-bottom:22px;border:1px solid #ddd;border-radius:10px;padding:14px 16px;">
        <h3 style="margin:0 0 10px;font-size:15px;">${nino.name}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr><td style="width:120px;font-weight:600;vertical-align:top;padding:4px 0;">Alimentación</td><td style="padding:4px 0;">${alimentacion}</td></tr>
          <tr><td style="font-weight:600;vertical-align:top;padding:4px 0;">Pañal / baño</td><td style="padding:4px 0;">${panales}</td></tr>
          <tr><td style="font-weight:600;vertical-align:top;padding:4px 0;">Siesta</td><td style="padding:4px 0;">${siestas}</td></tr>
          <tr><td style="font-weight:600;vertical-align:top;padding:4px 0;">Ánimo</td><td style="padding:4px 0;">${animos}</td></tr>
          <tr><td style="font-weight:600;vertical-align:top;padding:4px 0;">Notas</td><td style="padding:4px 0;">${notas}</td></tr>
        </table>
      </section>`;
  }).join("");

  return `
    <div style="font-family:-apple-system,Arial,sans-serif;color:#111;padding:24px;">
      <h1 style="font-size:20px;margin:0 0 14px;">Bitácora diaria</h1>
      <p style="margin:0 0 4px;font-size:13px;"><strong>Maestra:</strong> ${maestra.name}</p>
      <p style="margin:0 0 4px;font-size:13px;"><strong>Grupo:</strong> ${maestra.grupo}</p>
      <p style="margin:0 0 20px;font-size:13px;"><strong>Fecha:</strong> ${fmtDateEs(dateStr)}</p>
      ${entries.length ? rows : '<p style="color:#777;">No hay niños registrados en este grupo.</p>'}
    </div>`;
}

function printBitacoraReport(maestra, dateStr, entries) {
  const container = document.createElement("div");
  container.id = "bitacora-print-area";
  container.innerHTML = buildBitacoraHTML(maestra, dateStr, entries);
  document.body.appendChild(container);
  document.body.classList.add("printing-bitacora");
  const originalTitle = document.title;
  document.title = "Bitácora diaria";
  setTimeout(() => window.print(), 50);
  const cleanup = () => {
    document.body.classList.remove("printing-bitacora");
    document.title = originalTitle;
    container.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
}

function MaestraAccordionRow({ m, ninos, copyLink, linkUrl, onPreview, showToast }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(dateKey(new Date()));
  const [downloading, setDownloading] = useState(false);
  const grupoNinos = ninos.filter((n) => n.grupo === m.grupo);

  async function download() {
    setDownloading(true);
    try {
      const entries = [];
      for (const n of grupoNinos) {
        const log = await getLog(n.id, date);
        entries.push({ nino: n, log: log || emptyLog(n, date) });
      }
      printBitacoraReport(m, date, entries);
    } catch { showToast("No se pudo generar la bitácora"); }
    setDownloading(false);
  }

  return (
    <GlassCard className="p-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-3">
        <div className="min-w-0 text-left"><p className="text-sm font-medium" style={{ color: "#2E3A36" }}>{m.name}</p><p className="text-xs" style={{ color: "#7A8A85" }}>{m.grupo} · {grupoNinos.length} niño(s)</p></div>
        <ChevronDown size={16} color="#C7D9D4" className="shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="mt-3 pt-3 space-y-3" style={{ borderTop: "1px solid rgba(95,179,161,0.1)" }}>
          <div className="flex items-center gap-2">
            <button onClick={() => copyLink(m.code)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(95,179,161,0.08)", color: "#4A9483" }}><Copy size={13} /> Copiar link</button>
            <button onClick={() => onPreview(m.code)} className="flex-1 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.7)", color: "#4A9483", border: "1px solid rgba(95,179,161,0.15)" }}>Vista previa</button>
          </div>
          <DayNav date={date} setDate={setDate} />
          <GlassButton className="w-full" onClick={download} disabled={downloading}>
            {downloading ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />} Descargar bitácora
          </GlassButton>
        </div>
      )}
    </GlassCard>
  );
}

function BitacorasAdminTab({ maestras, ninos, loading, copyLink, linkUrl, onPreview, showToast }) {
  return (
    <div className="space-y-2">
      {loading && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Cargando…</p></GlassCard>}
      {!loading && maestras.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Agrega maestras primero para poder enviarles su link de bitácora.</p></GlassCard>}
      {maestras.map((m) => <MaestraAccordionRow key={m.code} m={m} ninos={ninos} copyLink={copyLink} linkUrl={linkUrl} onPreview={onPreview} showToast={showToast} />)}
    </div>
  );
}

/* ------------------------------ Maestra hub (link) --------------------------- */

function MaestraHub({ code, onExitDemo, showToast, persist = true }) {
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
        if (persist) safeStorageSet("skillmind-my-access", JSON.stringify({ type: "maestra", code }));
        const all = await listNinos(m.professionalId);
        setNinos(all.filter((n) => n.grupo === m.grupo).sort((a, b) => a.name.localeCompare(b.name)));
      }
      setLoading(false);
    })();
  }, [code, persist]);

  async function bulkMeal(cantidad) {
    setBulkBusy(true);
    for (const n of ninos) {
      const log = (await getLog(n.id, date)) || emptyLog(n, date);
      await saveLog({ ...log, alimentacion: [...log.alimentacion, { time: Date.now(), cantidad }] });
    }
    setBulkBusy(false);
    showToast("Registrado para todo el grupo");
  }
  async function bulkNap(durmio, duracion) {
    setBulkBusy(true);
    for (const n of ninos) {
      const log = (await getLog(n.id, date)) || emptyLog(n, date);
      await saveLog({ ...log, siestas: [...log.siestas, { time: Date.now(), durmio, ...(durmio === "si" ? { duracion } : {}) }] });
    }
    setBulkBusy(false);
    showToast("Registrado para todo el grupo");
  }

  if (loading) return <div className="flex-1 flex items-center justify-center py-24 min-h-screen"><Loader2 className="animate-spin" color="#4A9483" /></div>;

  if (!maestra) {
    return (
      <div className="w-full max-w-md px-5 mt-16">
        <GlassCard className="p-8 text-center"><p style={{ color: "#2E3A36" }}>Este link no es válido.</p></GlassCard>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md px-5 pt-8 pb-16 flex-1">
      <div className="flex items-center gap-2.5 mb-5">
        <Logo size={9} />
        <div><p className="text-xs" style={{ color: "#7A8A85" }}>{maestra.funcion}</p><p className="font-semibold" style={{ color: "#2E3A36" }}>{maestra.name} · {maestra.grupo}</p></div>
      </div>

      <GlassCard className="p-4 mb-4">
        <DayNav date={date} setDate={setDate} />
      </GlassCard>

      <GlassCard className="p-4 mb-4">
        <p className="text-xs font-medium mb-2" style={{ color: "#4A9483" }}>Registro rápido para todo el grupo</p>
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          {MEAL_OPTIONS.map((o) => (
            <button key={o.key} disabled={bulkBusy} onClick={() => bulkMeal(o.key)} className="py-2.5 rounded-xl text-xs font-medium disabled:opacity-40" style={{ background: "rgba(232,185,61,0.1)", color: "#C99A2E" }}>{o.label}</button>
          ))}
        </div>
        <p className="text-xs mb-1.5" style={{ color: "#7A8A85" }}>Siesta (todos)</p>
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          {NAP_DURATIONS.map((d) => (
            <button key={d.key} disabled={bulkBusy} onClick={() => bulkNap("si", d.key)} className="py-2.5 rounded-xl text-xs font-medium disabled:opacity-40" style={{ background: "rgba(95,179,161,0.08)", color: "#4A9483" }}>{d.label}</button>
          ))}
        </div>
        <button disabled={bulkBusy} onClick={() => bulkNap("no")} className="w-full py-2.5 rounded-xl text-xs font-medium disabled:opacity-40" style={{ background: "rgba(255,255,255,0.7)", color: "#5C6B66", border: "1px solid rgba(122,138,133,0.2)" }}>No durmieron siesta (todos)</button>
      </GlassCard>

      <div className="space-y-2">
        {ninos.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>No hay niños registrados en tu grupo todavía.</p></GlassCard>}
        {ninos.map((n) => <NinoLogWidget key={n.id} nino={n} date={date} showToast={showToast} />)}
      </div>

      <button onClick={onExitDemo} className="text-xs mt-6 mx-auto flex items-center gap-1 justify-center w-full" style={{ color: "#BFD9D1" }}>
        <ArrowLeft size={12} /> Salir de la vista previa
      </button>
    </div>
  );
}

/* ------------------------------ Padre hub (link) --------------------------- */

function PadreBottomNav({ tab, setTab }) {
  const items = [
    { id: "inicio", label: "Inicio", icon: Home },
    { id: "anuncios", label: "Anuncios", icon: Megaphone },
    { id: "mensajes", label: "Mensajes", icon: MessageCircle },
  ];
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-md z-40">
      <GlassCard className="p-1.5" style={{ boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12)" }}>
        <div className="flex">
          {items.map((it) => {
            const Icon = it.icon;
            const activeStyle = tab === it.id;
            return (
              <button key={it.id} onClick={() => setTab(it.id)} className="flex-1 py-2.5 rounded-2xl flex flex-col items-center gap-1 transition-all"
                style={activeStyle ? { background: "#5FB3A1" } : {}}>
                <Icon size={18} color={activeStyle ? "white" : "#7A8A85"} />
                <span className="text-[10px] font-medium" style={{ color: activeStyle ? "white" : "#7A8A85" }}>{it.label}</span>
              </button>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

function PadreInicioTab({ hijos }) {
  const [date, setDate] = useState(dateKey(new Date()));
  return (
    <div className="space-y-3">
      <GlassCard className="p-4"><DayNav date={date} setDate={setDate} /></GlassCard>
      {hijos.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Aún no hay niños vinculados a tu cuenta.</p></GlassCard>}
      {hijos.map((n) => <NinoLogWidget key={n.id} nino={n} date={date} readOnly />)}
    </div>
  );
}

function PadreAnunciosTab({ profesionalId }) {
  const [circulares, setCirculares] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { listCirculares(profesionalId).then((c) => { setCirculares(c); setLoading(false); }); }, [profesionalId]);

  return (
    <div className="space-y-2">
      {loading && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Cargando…</p></GlassCard>}
      {!loading && circulares.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Aún no hay anuncios publicados.</p></GlassCard>}
      {circulares.map((c) => (
        <GlassCard key={c.id} className="p-4">
          <p className="text-sm font-medium" style={{ color: "#2E3A36" }}>{c.title}</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "#7A8A85" }}>{c.body}</p>
          <p className="text-xs mt-1.5" style={{ color: "#BFD9D1" }}>{new Date(c.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</p>
        </GlassCard>
      ))}
    </div>
  );
}

function PadreMensajesTab({ padreCode, showToast }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { listMensajesPadre(padreCode).then((m) => { setMessages(m); setLoading(false); }); }, [padreCode]);

  async function send() {
    if (!text.trim()) return;
    const t = text.trim();
    setText("");
    try { const m = await sendMensajePadre(padreCode, "padre", t); setMessages((prev) => [...prev, m]); }
    catch { showToast("No se pudo enviar"); }
  }

  return (
    <GlassCard className="p-6 flex flex-col" style={{ minHeight: 420 }}>
      <h2 className="font-semibold mb-3" style={{ color: "#2E3A36" }}>Mensajes con la coordinadora</h2>
      <div className="flex-1 space-y-2 overflow-y-auto mb-3">
        {loading && <p className="text-sm" style={{ color: "#7A8A85" }}>Cargando…</p>}
        {!loading && messages.length === 0 && <p className="text-sm" style={{ color: "#7A8A85" }}>Escríbele a la coordinadora si tienes alguna duda.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${m.from === "padre" ? "ml-auto" : ""}`}
            style={m.from === "padre" ? { background: "#5FB3A1", color: "white" } : { background: "rgba(255,255,255,0.9)", color: "#2E3A36" }}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="flex-1 px-4 py-2.5 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Escribe un mensaje…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button onClick={send} className="p-3 rounded-2xl" style={{ background: "#5FB3A1" }}><Send size={15} color="white" /></button>
      </div>
    </GlassCard>
  );
}

function PadreHub({ code, onExitDemo, showToast, persist = true }) {
  const [padre, setPadre] = useState(null);
  const [hijos, setHijos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("inicio");

  useEffect(() => {
    (async () => {
      const p = await getPadre(code);
      setPadre(p);
      if (p) {
        if (persist) safeStorageSet("skillmind-my-access", JSON.stringify({ type: "padre", code }));
        const allNinos = await listNinos(p.professionalId);
        setHijos(allNinos.filter((n) => p.ninoIds.includes(n.id)));
      }
      setLoading(false);
    })();
  }, [code, persist]);

  if (loading) return <div className="flex-1 flex items-center justify-center py-24 min-h-screen"><Loader2 className="animate-spin" color="#5FB3A1" /></div>;

  if (!padre) {
    return (
      <div className="w-full max-w-md px-5 mt-16">
        <GlassCard className="p-8 text-center"><p style={{ color: "#2E3A36" }}>Este link no es válido.</p></GlassCard>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md px-5 pt-8 pb-28 flex-1">
      <div className="flex items-center gap-2.5 mb-6">
        <Logo size={9} />
        <div>
          <p className="text-xs" style={{ color: "#7A8A85" }}>Hola,</p>
          <p className="font-semibold" style={{ color: "#2E3A36" }}>{padre.name}</p>
        </div>
      </div>

      {tab === "inicio" && <PadreInicioTab hijos={hijos} />}
      {tab === "anuncios" && <PadreAnunciosTab profesionalId={padre.professionalId} />}
      {tab === "mensajes" && <PadreMensajesTab padreCode={padre.code} showToast={showToast} />}

      <PadreBottomNav tab={tab} setTab={setTab} />

      <button onClick={onExitDemo} className="text-xs mt-6 mx-auto flex items-center gap-1 justify-center w-full" style={{ color: "#BFD9D1" }}>
        <ArrowLeft size={12} /> Salir de la vista previa
      </button>
    </div>
  );
}
