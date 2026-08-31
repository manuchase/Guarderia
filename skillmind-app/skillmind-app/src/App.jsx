import React, { useState, useEffect, useCallback } from "react";
import {
  LogOut, Plus, Copy, Check, X, ArrowLeft, Loader2, Send, Brain, Gamepad2,
  Trash2, Users, Baby, Utensils, Droplet, Moon, Smile, Frown, Meh,
  MessageSquare, ChevronLeft, ChevronRight, ChevronDown, ShieldCheck, FileDown, DoorOpen,
  Heart, Megaphone, MessageCircle, Home, Search, Eye, EyeOff, Target
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
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const MONTH_NAMES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function monthLabel(mk) {
  const [y, m] = mk.split("-").map(Number);
  return `${MONTH_NAMES_ES[m - 1]} ${y}`;
}
function edadEnMeses(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento + "T00:00:00");
  const hoy = new Date();
  let meses = (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + (hoy.getMonth() - nacimiento.getMonth());
  if (hoy.getDate() < nacimiento.getDate()) meses -= 1;
  return Math.max(0, meses);
}
function formatEdad(fechaNacimiento) {
  const meses = edadEnMeses(fechaNacimiento);
  if (meses === null) return "";
  const anios = Math.floor(meses / 12);
  const restoMeses = meses % 12;
  if (anios === 0) return `${restoMeses} ${restoMeses === 1 ? "mes" : "meses"}`;
  if (restoMeses === 0) return `${anios} ${anios === 1 ? "año" : "años"}`;
  return `${anios} ${anios === 1 ? "año" : "años"} ${restoMeses} ${restoMeses === 1 ? "mes" : "meses"}`;
}

function waDigits(telefono) {
  const digits = (telefono || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith("52")) return digits;
  if (digits.length === 10) return "52" + digits;
  return digits;
}
function whatsAppUrl(telefono, text) {
  const num = waDigits(telefono);
  const base = num ? `https://wa.me/${num}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://itenhybfheoznyevzyey.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_89YONfEmxbg27Efv8nmSfw_luRcAyf7";

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function sb(path, options = {}, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
          apikey: SUPABASE_KEY,
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
  if (lastErr?.name === "TypeError" || lastErr?.message === "Failed to fetch") {
    throw new Error("No se pudo conectar con Supabase. Revisa que el proyecto esté activo y que la URL de Supabase sea correcta.");
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
function maestraToRow(m) { return { code: m.code, name: m.name, funcion: m.funcion, grupo: m.grupo, telefono: m.telefono || null, professional_id: m.professionalId, created_at: m.createdAt }; }
function rowToMaestra(r) { return { code: r.code, name: r.name, funcion: r.funcion, grupo: r.grupo, telefono: r.telefono || "", professionalId: r.professional_id, createdAt: r.created_at }; }
function ninoToRow(n) { return { id: n.id, name: n.name, grupo: n.grupo, foto: n.foto, fecha_nacimiento: n.fechaNacimiento || null, professional_id: n.professionalId, created_at: n.createdAt, activo: n.activo !== false }; }
function rowToNino(r) { return { id: r.id, name: r.name, grupo: r.grupo, foto: r.foto, fechaNacimiento: r.fecha_nacimiento || "", professionalId: r.professional_id, createdAt: r.created_at, activo: r.activo !== false }; }
function logToRow(log) { return { id: `${log.ninoId}:${log.date}`, nino_id: log.ninoId, nino_name: log.ninoName, grupo: log.grupo, date: log.date, professional_id: log.professionalId, alimentacion: log.alimentacion, panales: log.panales, siestas: log.siestas, animos: log.animos, notas: log.notas }; }
function rowToLog(r) { return { ninoId: r.nino_id, ninoName: r.nino_name, grupo: r.grupo, date: r.date, professionalId: r.professional_id, alimentacion: r.alimentacion || [], panales: r.panales || [], siestas: r.siestas || [], animos: r.animos || [], notas: r.notas || [] }; }

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
  return { ninoId: nino.id, ninoName: nino.name, grupo: nino.grupo, date, professionalId: nino.professionalId, alimentacion: [], panales: [], siestas: [], animos: [], notas: [] };
}
async function saveLog(log) {
  await sb("bitacoras", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify([logToRow(log)]) });
}
async function listNinoIdsWithLogOn(profId, date) {
  try {
    const rows = await sb(`bitacoras?professional_id=eq.${encodeURIComponent(profId)}&date=eq.${encodeURIComponent(date)}&select=nino_id`);
    return new Set((rows || []).map((r) => r.nino_id));
  } catch { return new Set(); }
}

/* ================================ módulo PLAN ============================= */

const AREAS = [
  { key: "motricidad", label: "Motricidad" },
  { key: "lenguaje", label: "Lenguaje y comunicación" },
  { key: "cognicion", label: "Cognición" },
  { key: "socioemocional", label: "Desarrollo socioemocional" },
  { key: "autonomia", label: "Autonomía" },
];
const ESTADOS_OBJETIVO = [
  { key: "no_iniciado", label: "No iniciado", color: "#7A8A85", bg: "#F1F2F0" },
  { key: "en_proceso", label: "En proceso", color: "#C99A2E", bg: "#FFFDF0" },
  { key: "logrado", label: "Logrado", color: "#5FA34A", bg: "#F2F9EF" },
];

// Biblioteca orientativa de objetivos por edad. Son sugerencias generales de
// desarrollo, no diagnósticos ni requisitos — cada niño avanza a su propio ritmo.
const OBJETIVOS_LIBRARY = [
  {
    minMeses: 0, maxMeses: 11, etapa: "0 a 11 meses",
    objetivos: [
      { area: "motricidad", texto: "Sostener la cabeza y girar sobre sí mismo/a" },
      { area: "motricidad", texto: "Sentarse sin apoyo" },
      { area: "lenguaje", texto: "Balbucear y responder a sonidos familiares" },
      { area: "cognicion", texto: "Seguir objetos con la mirada y buscar objetos escondidos" },
      { area: "socioemocional", texto: "Sonreír y reconocer caras conocidas" },
      { area: "autonomia", texto: "Llevarse objetos a la boca para explorar" },
    ],
  },
  {
    minMeses: 12, maxMeses: 23, etapa: "1 a 2 años",
    objetivos: [
      { area: "motricidad", texto: "Caminar de forma independiente" },
      { area: "motricidad", texto: "Subir escalones con ayuda" },
      { area: "lenguaje", texto: "Decir algunas palabras sueltas con intención" },
      { area: "cognicion", texto: "Apilar bloques o encajar piezas simples" },
      { area: "socioemocional", texto: "Mostrar interés por jugar cerca de otros niños" },
      { area: "autonomia", texto: "Intentar comer solo/a con cuchara" },
    ],
  },
  {
    minMeses: 24, maxMeses: 35, etapa: "2 a 3 años",
    objetivos: [
      { area: "motricidad", texto: "Correr y patear una pelota con control" },
      { area: "lenguaje", texto: "Formar frases cortas de 2-3 palabras" },
      { area: "cognicion", texto: "Reconocer colores básicos" },
      { area: "socioemocional", texto: "Participar en juego paralelo con otros niños" },
      { area: "autonomia", texto: "Avisar para ir al baño" },
      { area: "autonomia", texto: "Lavarse las manos con ayuda mínima" },
    ],
  },
  {
    minMeses: 36, maxMeses: 47, etapa: "3 a 4 años",
    objetivos: [
      { area: "motricidad", texto: "Saltar con ambos pies y mantener el equilibrio breve" },
      { area: "lenguaje", texto: "Contar experiencias sencillas en oraciones completas" },
      { area: "cognicion", texto: "Clasificar objetos por tamaño o forma" },
      { area: "socioemocional", texto: "Compartir juguetes y esperar turnos con apoyo" },
      { area: "autonomia", texto: "Vestirse con prendas sencillas de forma independiente" },
    ],
  },
  {
    minMeses: 48, maxMeses: 59, etapa: "4 a 5 años",
    objetivos: [
      { area: "motricidad", texto: "Recortar con tijeras siguiendo una línea" },
      { area: "lenguaje", texto: "Narrar una historia corta con inicio y final" },
      { area: "cognicion", texto: "Reconocer letras de su nombre" },
      { area: "socioemocional", texto: "Resolver pequeños conflictos con palabras" },
      { area: "autonomia", texto: "Guardar sus pertenencias sin recordatorio" },
    ],
  },
  {
    minMeses: 60, maxMeses: 999, etapa: "5 a 6 años",
    objetivos: [
      { area: "motricidad", texto: "Escribir su nombre" },
      { area: "lenguaje", texto: "Seguir instrucciones de varios pasos" },
      { area: "cognicion", texto: "Reconocer números y contar hasta 10" },
      { area: "socioemocional", texto: "Trabajar en equipo en actividades grupales" },
      { area: "autonomia", texto: "Organizar su mochila o materiales antes de salir" },
    ],
  },
];
function objetivosParaEdad(meses) {
  if (meses === null) return [];
  const etapa = OBJETIVOS_LIBRARY.find((e) => meses >= e.minMeses && meses <= e.maxMeses);
  return etapa ? etapa.objetivos : [];
}

/* ---- row <-> object mapping ---- */
function planToRow(p) { return { id: p.id, nino_id: p.ninoId, professional_id: p.professionalId, mes: p.mes, maestra_code: p.maestraCode, edad_meses: p.edadMeses, estado: p.estado, created_at: p.createdAt, closed_at: p.closedAt || null, resumen: p.resumen || null }; }
function rowToPlan(r) { return { id: r.id, ninoId: r.nino_id, professionalId: r.professional_id, mes: r.mes, maestraCode: r.maestra_code, edadMeses: r.edad_meses, estado: r.estado, createdAt: r.created_at, closedAt: r.closed_at, resumen: r.resumen }; }
function objetivoToRow(o) { return { id: o.id, plan_id: o.planId, origen: o.origen, area: o.area, texto: o.texto, es_principal: !!o.esPrincipal, nivel_inicial: o.nivelInicial || "", meta_esperada: o.metaEsperada || "", progreso: o.progreso || 0, estado: o.estado, observaciones: o.observaciones || "", visible_padres: !!o.visiblePadres, updated_at: o.updatedAt }; }
function rowToObjetivo(r) { return { id: r.id, planId: r.plan_id, origen: r.origen, area: r.area, texto: r.texto, esPrincipal: !!r.es_principal, nivelInicial: r.nivel_inicial || "", metaEsperada: r.meta_esperada || "", progreso: r.progreso || 0, estado: r.estado, observaciones: r.observaciones || "", visiblePadres: !!r.visible_padres, updatedAt: r.updated_at }; }
function registroToRow(r) { return { id: r.id, objetivo_id: r.objetivoId, fecha: r.fecha, progreso: r.progreso, observacion: r.observacion || "", usuario: r.usuario, created_at: r.createdAt }; }
function rowToRegistro(r) { return { id: r.id, objetivoId: r.objetivo_id, fecha: r.fecha, progreso: r.progreso, observacion: r.observacion || "", usuario: r.usuario, createdAt: r.created_at }; }

/* ---- planes ---- */
async function listPlanesByNino(ninoId) {
  const rows = await sb(`planes?nino_id=eq.${encodeURIComponent(ninoId)}&order=mes.desc`);
  return (rows || []).map(rowToPlan);
}
async function savePlan(p) {
  await sb("planes", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify([planToRow(p)]) });
}
async function getOrCreatePlanDelMes(nino, professionalId, maestraCode) {
  const mk = monthKey(new Date());
  const id = `${nino.id}:${mk}`;
  try {
    const rows = await sb(`planes?id=eq.${encodeURIComponent(id)}`);
    if (rows && rows[0]) return rowToPlan(rows[0]);
  } catch {}
  const nuevo = { id, ninoId: nino.id, professionalId, mes: mk, maestraCode, edadMeses: edadEnMeses(nino.fechaNacimiento), estado: "abierto", createdAt: Date.now(), closedAt: null, resumen: null };
  await savePlan(nuevo);
  return nuevo;
}

/* ---- objetivos ---- */
async function listObjetivos(planId) {
  const rows = await sb(`plan_objetivos?plan_id=eq.${encodeURIComponent(planId)}&order=id`);
  return (rows || []).map(rowToObjetivo);
}
async function saveObjetivo(o) {
  await sb("plan_objetivos", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify([objetivoToRow(o)]) });
}
async function deleteObjetivo(id) {
  try { await sb(`plan_objetivos?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }); } catch {}
}

/* ---- registros de avance ---- */
async function listRegistros(objetivoId) {
  const rows = await sb(`plan_registros?objetivo_id=eq.${encodeURIComponent(objetivoId)}&order=created_at.desc`);
  return (rows || []).map(rowToRegistro);
}
async function saveRegistro(r) {
  await sb("plan_registros", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify([registroToRow(r)]) });
}

/* ---- padres ---- */
function padreToRow(p) { return { code: p.code, name: p.name, nino_ids: p.ninoIds, telefono: p.telefono || null, professional_id: p.professionalId, created_at: p.createdAt }; }
function rowToPadre(r) { return { code: r.code, name: r.name, ninoIds: r.nino_ids || [], telefono: r.telefono || "", professionalId: r.professional_id, createdAt: r.created_at }; }
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
async function listLastMessagesByPadres(padreCodes) {
  if (!padreCodes || padreCodes.length === 0) return {};
  try {
    const list = padreCodes.map((c) => `"${c}"`).join(",");
    const rows = await sb(`mensajes_padres?padre_code=in.(${list})&order=at.desc`);
    const map = {};
    for (const r of rows || []) {
      const msg = rowToMsg(r);
      if (!map[msg.padreCode]) map[msg.padreCode] = msg;
    }
    return map;
  } catch { return {}; }
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
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-50">
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
  const [usuariosShortcut, setUsuariosShortcut] = useState(0);
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
          <div className="flex items-center gap-1">
            {currentPro.role === "superadmin" && (
              <button onClick={() => setUsuariosShortcut((v) => v + 1)} className="p-2 rounded-xl active:scale-95 transition-transform" style={{ color: "#7A8A85" }} title="Usuarios">
                <ShieldCheck size={17} />
              </button>
            )}
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl active:scale-95 transition-transform" style={{ color: "#7A8A85" }}>
              <DoorOpen size={16} /> Cerrar sesión
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-3xl px-5 pb-4">
        <ErrorBoundary>
          {view === "login" && (
            <LoginView professionals={professionals} onLogin={(pro) => { setCurrentPro(pro); setView("dashboard"); }} />
          )}
          {view === "dashboard" && currentPro && (
            <AdminDashboard pro={currentPro} professionals={professionals} setProfessionals={setProfessionals} showToast={showToast} onPreviewMaestra={(code) => { setIsPreview(true); setMaestraCode(code); }} onPreviewPadre={(code) => { setIsPreview(true); setPadreCode(code); }} usuariosShortcut={usuariosShortcut} />
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

function HomeTile({ icon: Icon, label, sublabel, onClick, accentColor, accentBg, badge }) {
  return (
    <button onClick={onClick} className="flex flex-col items-start gap-3 p-5 rounded-[20px] text-left transition-all active:scale-95 relative"
      style={{ background: "#FFFFFF", border: "1px solid rgba(46,58,54,0.06)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
      {badge && <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full" style={{ background: "#D9584F" }} />}
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: accentBg }}><Icon size={22} color={accentColor} strokeWidth={2} /></div>
      <div><p className="font-semibold" style={{ color: "#2E3A36" }}>{label}</p>{sublabel && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "#7A8A85" }}>{sublabel}</p>}</div>
    </button>
  );
}

function CoordBottomNav({ section, setSection }) {
  const items = [
    { id: "home", label: "Inicio", icon: Home },
    { id: "maestras", label: "Maestras", icon: Users },
    { id: "ninos", label: "Niños", icon: Baby },
    { id: "bitacoras", label: "Bitácoras", icon: Utensils },
    { id: "padres", label: "Padres", icon: Heart },
    { id: "anuncios", label: "Anuncios", icon: Megaphone },
  ];
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] max-w-3xl z-40">
      <GlassCard className="p-2" style={{ boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)" }}>
        <div className="flex gap-1.5">
          {items.map((it) => {
            const Icon = it.icon;
            const active = section === it.id;
            return (
              <button key={it.id} onClick={() => setSection(it.id)} className="flex-1 py-3 px-1 rounded-2xl flex flex-col items-center gap-1.5 transition-all"
                style={active ? { background: "#5FB3A1" } : {}}>
                <Icon size={24} color={active ? "white" : "#7A8A85"} />
                <span className="text-[11px] font-medium leading-none whitespace-nowrap" style={{ color: active ? "white" : "#7A8A85" }}>{it.label}</span>
              </button>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

function AdminDashboard({ pro, professionals, setProfessionals, showToast, onPreviewMaestra, onPreviewPadre, usuariosShortcut }) {
  const [section, setSection] = useState("home");
  const [maestras, setMaestras] = useState([]);
  const [ninos, setNinos] = useState([]);
  const [padres, setPadres] = useState([]);
  const [circulares, setCirculares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayIds, setTodayIds] = useState(new Set());
  const [lastMsgs, setLastMsgs] = useState({});

  const reload = useCallback(async () => {
    setLoading(true);
    const today = dateKey(new Date());
    const [m, n, p, c, todaySet] = await Promise.all([listMaestras(pro.id), listNinos(pro.id), listPadres(pro.id), listCirculares(pro.id), listNinoIdsWithLogOn(pro.id, today)]);
    setMaestras(m); setNinos(n); setPadres(p); setCirculares(c); setTodayIds(todaySet);
    const msgs = await listLastMessagesByPadres(p.map((x) => x.code));
    setLastMsgs(msgs);
    setLoading(false);
  }, [pro.id]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (usuariosShortcut) setSection("usuarios"); }, [usuariosShortcut]);

  function markPadreAnswered(code, message) {
    setLastMsgs((prev) => ({ ...prev, [code]: message }));
  }

  function addMaestraLocal(m) { setMaestras((prev) => [...prev, m].sort((a, b) => a.name.localeCompare(b.name))); }
  function savedMaestraLocal(m) { setMaestras((prev) => prev.map((x) => (x.code === m.code ? m : x)).sort((a, b) => a.name.localeCompare(b.name))); }
  function removeMaestraLocal(code) { setMaestras((prev) => prev.filter((m) => m.code !== code)); }
  function addNinoLocal(n) { setNinos((prev) => [...prev, n].sort((a, b) => (a.grupo || "").localeCompare(b.grupo || "") || a.name.localeCompare(b.name))); }
  function savedNinoLocal(n) { setNinos((prev) => prev.map((x) => (x.id === n.id ? n : x)).sort((a, b) => (a.grupo || "").localeCompare(b.grupo || "") || a.name.localeCompare(b.name))); }
  function addUserLocal(u) { setProfessionals((prev) => [...prev, u]); }
  function removeUserLocal(id) { setProfessionals((prev) => prev.filter((p) => p.id !== id)); }
  function addPadreLocal(p) { setPadres((prev) => [...prev, p].sort((a, b) => a.name.localeCompare(b.name))); }
  function savedPadreLocal(p) { setPadres((prev) => prev.map((x) => (x.code === p.code ? p : x)).sort((a, b) => a.name.localeCompare(b.name))); }
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

  const activeNinos = ninos.filter((n) => n.activo !== false);
  const maestrasConHoy = maestras.filter((m) => activeNinos.some((n) => n.grupo === m.grupo && todayIds.has(n.id)));
  const maestrasPendientes = maestras.filter((m) => !maestrasConHoy.includes(m));

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const circularesSemana = circulares.filter((c) => c.createdAt >= weekAgo).length;
  const padresPendientes = padres.filter((p) => lastMsgs[p.code]?.from === "padre").sort((a, b) => (lastMsgs[b.code]?.at || 0) - (lastMsgs[a.code]?.at || 0));

  const titles = { home: "Inicio", maestras: "Maestras", ninos: "Niños", bitacoras: "Bitácoras diarias", usuarios: "Usuarios", padres: "Padres de familia", anuncios: "Anuncios" };

  return (
    <div className="mt-2 pb-24">
      {section !== "home" && (
        <h1 className="text-xl font-semibold mb-4" style={{ color: "#2E3A36" }}>{titles[section]}</h1>
      )}

      {section === "home" && (
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold mb-0.5" style={{ color: "#2E3A36" }}>{pro.guarderia || `Hola, ${pro.name}`}</h1>
            <p className="text-sm" style={{ color: "#7A8A85" }}>{pro.guarderia ? `Hola, ${pro.name}` : "Esto es lo que pasa hoy"}</p>
          </div>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#F2F9EF" }}><Utensils size={17} color="#5FA34A" /></div>
              <p className="font-semibold" style={{ color: "#2E3A36" }}>Bitácoras de hoy</p>
            </div>
            <p className="text-2xl font-semibold mt-2" style={{ color: "#2E3A36" }}>
              {maestrasConHoy.length} <span className="text-base font-normal" style={{ color: "#7A8A85" }}>de {maestras.length} maestras</span>
            </p>
            {maestrasPendientes.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium" style={{ color: "#7A8A85" }}>Faltan por registrar:</p>
                <p className="text-sm" style={{ color: "#2E3A36" }}>{maestrasPendientes.map((m) => m.name).join(", ")}</p>
              </div>
            )}
            <button onClick={() => setSection("bitacoras")} className="text-xs font-medium mt-3" style={{ color: "#4A9483" }}>Ver bitácoras →</button>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#F3EFFA" }}><Heart size={17} color="#7A5FA8" /></div>
              <p className="font-semibold" style={{ color: "#2E3A36" }}>Mensajes de padres</p>
            </div>
            {padresPendientes.length === 0 ? (
              <p className="text-sm" style={{ color: "#7A8A85" }}>No hay mensajes sin responder.</p>
            ) : (
              <div className="space-y-2">
                {padresPendientes.map((p) => (
                  <button key={p.code} onClick={() => setSection("padres")} className="w-full flex items-start justify-between gap-2 p-3 rounded-xl text-left" style={{ background: "rgba(155,127,199,0.08)" }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#2E3A36" }}>{p.name}</p>
                      <p className="text-xs truncate" style={{ color: "#7A8A85" }}>{lastMsgs[p.code]?.text}</p>
                    </div>
                    <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: "#D9584F" }} />
                  </button>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#FBF1F3" }}><Megaphone size={17} color="#C96A87" /></div>
              <p className="font-semibold" style={{ color: "#2E3A36" }}>Anuncios ({circularesSemana} esta semana)</p>
            </div>
            {circulares.length === 0 ? (
              <p className="text-sm" style={{ color: "#7A8A85" }}>Aún no has publicado ningún anuncio.</p>
            ) : (
              <div className="space-y-2">
                {circulares.slice(0, 3).map((c) => (
                  <button key={c.id} onClick={() => setSection("anuncios")} className="w-full text-left p-3 rounded-xl" style={{ background: "rgba(230,164,180,0.1)" }}>
                    <p className="text-sm font-medium" style={{ color: "#2E3A36" }}>{c.title}</p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "#7A8A85" }}>{c.body}</p>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setSection("anuncios")} className="text-xs font-medium mt-3" style={{ color: "#4A9483" }}>Ver todos →</button>
          </GlassCard>
        </div>
      )}

      {section === "maestras" && <MaestrasTab pro={pro} maestras={maestras} loading={loading} onAdded={addMaestraLocal} onSavedMaestra={savedMaestraLocal} onRemoved={removeMaestraLocal} showToast={showToast} />}
      {section === "ninos" && <NinosTab pro={pro} ninos={ninos} maestras={maestras} loading={loading} onAdded={addNinoLocal} onSavedNino={savedNinoLocal} showToast={showToast} />}
      {section === "bitacoras" && <BitacorasAdminTab maestras={maestras} ninos={activeNinos} loading={loading} copyLink={copyLink} linkUrl={linkUrl} onPreview={onPreviewMaestra} showToast={showToast} />}
      {section === "padres" && <PadresTab pro={pro} padres={padres} ninos={activeNinos} loading={loading} onAdded={addPadreLocal} onSavedPadre={savedPadreLocal} onRemoved={removePadreLocal} copyLink={copyPadreLink} linkUrl={padreLinkUrl} onPreview={onPreviewPadre} lastMsgs={lastMsgs} onAnswered={markPadreAnswered} showToast={showToast} />}
      {section === "anuncios" && <CircularesTab pro={pro} circulares={circulares} loading={loading} onAdded={addCircularLocal} onRemoved={removeCircularLocal} showToast={showToast} />}
      {section === "usuarios" && pro.role === "superadmin" && (
        <UsuariosTab professionals={professionals} onAdded={addUserLocal} onRemoved={removeUserLocal} showToast={showToast} />
      )}

      <CoordBottomNav section={section} setSection={setSection} />
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

  function remove(u) {
    if (!window.confirm(`¿Seguro que quieres eliminar al usuario "${u.username}"? Perderá acceso a su panel.`)) return;
    onRemoved(u.id);
    deleteProfessional(u.id);
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

function PadreRow({ p, ninos, copyLink, linkUrl, onPreview, onRemove, onSaved, lastMsg, onAnswered, showToast }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(p.name);
  const [editTelefono, setEditTelefono] = useState(p.telefono || "");
  const [editSelected, setEditSelected] = useState(p.ninoIds);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const childrenNames = ninos.filter((n) => p.ninoIds.includes(n.id)).map((n) => n.name).join(", ") || "Sin hijos vinculados";
  const pending = lastMsg?.from === "padre";

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
    try {
      const m = await sendMensajePadre(p.code, "coordinadora", text);
      setMessages((prev) => [...prev, m]);
      onAnswered && onAnswered(p.code, m);
    } catch { showToast("No se pudo enviar el mensaje"); }
  }

  function shareWhatsApp() {
    const text = `Hola ${p.name}, este es el link de Skillmind para ver la bitácora de ${childrenNames}: ${linkUrl(p.code)}`;
    window.open(whatsAppUrl(p.telefono, text), "_blank");
  }

  function toggleEditChild(id) { setEditSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }

  function confirmRemove() {
    if (window.confirm(`¿Seguro que quieres eliminar a ${p.name}? Su link dejará de funcionar.`)) onRemove(p.code);
  }

  async function saveEdit() {
    setEditError("");
    if (!editName.trim()) { setEditError("Falta el nombre del padre o tutor."); return; }
    if (editSelected.length === 0) { setEditError("Selecciona al menos un niño."); return; }
    setSavingEdit(true);
    const updated = { ...p, name: editName.trim(), ninoIds: editSelected, telefono: editTelefono.trim() };
    try { await savePadre(updated); onSaved(updated); setEditing(false); showToast("Cambios guardados"); }
    catch (err) { setEditError("No se pudo guardar: " + (err?.message || "intenta de nuevo")); }
    setSavingEdit(false);
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.6)" }}>
      <div className="flex items-center justify-between gap-2 p-3.5">
        <button onClick={toggleOpen} className="flex items-center gap-2 min-w-0 flex-1 text-left">
          <ChevronDown size={15} color="#C7D9D4" className="shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium truncate" style={{ color: "#2E3A36" }}>{p.name}</p>
              {pending && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#D9584F" }} />}
            </div>
            <p className="text-xs truncate" style={{ color: pending ? "#D9584F" : "#7A8A85" }}>{pending ? "Sin responder · " : ""}{childrenNames}</p>
          </div>
        </button>
        <button onClick={confirmRemove} className="p-2.5 rounded-xl shrink-0" style={{ background: "rgba(217,88,79,0.08)" }}><Trash2 size={15} color="#D9584F" /></button>
      </div>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-3" style={{ borderTop: "1px solid rgba(155,127,199,0.12)" }}>
          <div className="pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium" style={{ color: "#4A9483" }}>Link único para esta familia</p>
              <button onClick={() => setEditing((v) => !v)} className="text-xs font-medium" style={{ color: "#7A5FA8" }}>{editing ? "Cancelar" : "Editar"}</button>
            </div>
            {!editing ? (
              <>
                <p className="text-xs font-mono truncate mb-2" style={{ color: "#BFD9D1" }}>{linkUrl(p.code)}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyLink(p.code)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(155,127,199,0.1)", color: "#7A5FA8" }}><Copy size={13} /> Copiar</button>
                  <button onClick={shareWhatsApp} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(37,211,102,0.12)", color: "#1DA851" }}><MessageCircle size={13} /> WhatsApp</button>
                  <button onClick={() => onPreview(p.code)} className="flex-1 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.7)", color: "#7A5FA8", border: "1px solid rgba(155,127,199,0.2)" }}>Ver</button>
                </div>
              </>
            ) : (
              <div className="space-y-2.5">
                <input className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(155,127,199,0.25)" }} placeholder="Nombre del padre o tutor" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <input className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(155,127,199,0.25)" }} placeholder="Teléfono (10 dígitos, para WhatsApp)" value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} />
                <input className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(155,127,199,0.25)" }} placeholder="Teléfono (10 dígitos, para WhatsApp)" value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} />
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: "#4A9483" }}>Hijos vinculados</p>
                  <ChildChecklist ninos={ninos} selected={editSelected} onToggle={toggleEditChild} />
                </div>
                {editError && <p className="text-xs" style={{ color: "#D9584F" }}>{editError}</p>}
                <GlassButton variant="secondary" className="w-full" onClick={saveEdit} disabled={savingEdit}>{savingEdit ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Guardar cambios</GlassButton>
              </div>
            )}
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

function PadresTab({ pro, padres, ninos, loading, onAdded, onSavedPadre, onRemoved, copyLink, linkUrl, onPreview, lastMsgs, onAnswered, showToast }) {
  const [name, setName] = useState("");
  const [telefono, setTelefono] = useState("");
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function toggleChild(id) { setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }

  async function addPadre() {
    setFormError("");
    if (!name.trim()) { setFormError("Falta el nombre del padre o tutor."); return; }
    if (selected.length === 0) { setFormError("Selecciona al menos un niño para vincular."); return; }
    setSaving(true);
    const p = { code: genCode(), name: name.trim(), ninoIds: selected, telefono: telefono.trim(), professionalId: pro.id, createdAt: Date.now() };
    try {
      await savePadre(p);
      onAdded(p);
      setName(""); setTelefono(""); setSelected([]);
      showToast("Padre/tutor agregado");
    } catch (err) { setFormError("No se pudo guardar: " + (err?.message || "intenta de nuevo")); }
    setSaving(false);
  }

  async function remove(code) {
    onRemoved(code);
    await deletePadre(code);
    showToast("Registro eliminado");
  }

  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visible = padres.filter((p) => {
    if (!q) return true;
    if (p.name.toLowerCase().includes(q)) return true;
    const childNames = ninos.filter((n) => p.ninoIds.includes(n.id)).map((n) => n.name.toLowerCase()).join(" ");
    return childNames.includes(q);
  });

  return (
    <div className="space-y-4">
      <GlassCard className="p-6 space-y-3">
        <h2 className="font-semibold" style={{ color: "#2E3A36" }}>Nuevo padre/tutor</h2>
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(155,127,199,0.25)" }} placeholder="Nombre del padre o tutor" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(155,127,199,0.25)" }} placeholder="Teléfono (10 dígitos, para WhatsApp)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: "#4A9483" }}>Hijos a vincular</p>
          <ChildChecklist ninos={ninos} selected={selected} onToggle={toggleChild} />
        </div>
        {formError && <p className="text-sm" style={{ color: "#D9584F" }}>{formError}</p>}
        <GlassButton className="w-full" onClick={addPadre} disabled={saving}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Crear y generar link</GlassButton>
      </GlassCard>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid rgba(46,58,54,0.08)" }}>
        <Search size={15} color="#7A8A85" />
        <input className="flex-1 text-sm outline-none bg-transparent" placeholder="Buscar por padre o nombre del niño…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <GlassCard className="p-2">
        <div className="px-3 py-3 space-y-2">
          {loading && <p className="text-sm text-center py-6" style={{ color: "#7A8A85" }}>Cargando…</p>}
          {!loading && visible.length === 0 && <p className="text-sm text-center py-8" style={{ color: "#7A8A85" }}>{q ? "Sin resultados." : "Aún no hay padres de familia registrados."}</p>}
          {visible.map((p) => <PadreRow key={p.code} p={p} ninos={ninos} copyLink={copyLink} linkUrl={linkUrl} onPreview={onPreview} onRemove={remove} onSaved={onSavedPadre} lastMsg={lastMsgs?.[p.code]} onAnswered={onAnswered} showToast={showToast} />)}
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

  function remove(id) {
    if (!window.confirm("¿Seguro que quieres eliminar este anuncio?")) return;
    onRemoved(id);
    deleteCircular(id);
    showToast("Anuncio eliminado");
  }

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

function MaestraRow({ m, onSaved, onRemove }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(m.name);
  const [funcion, setFuncion] = useState(m.funcion);
  const [grupo, setGrupo] = useState(m.grupo);
  const [telefono, setTelefono] = useState(m.telefono || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!name.trim() || !grupo.trim()) { setError("El nombre y el grupo son obligatorios."); return; }
    setSaving(true);
    const updated = { ...m, name: name.trim(), funcion: funcion.trim() || "Maestra", grupo: grupo.trim(), telefono: telefono.trim() };
    try { await saveMaestra(updated); onSaved(updated); setOpen(false); }
    catch (err) { setError("No se pudo guardar: " + (err?.message || "intenta de nuevo")); }
    setSaving(false);
  }

  function confirmRemove() {
    if (window.confirm(`¿Seguro que quieres eliminar a ${m.name}? Su link dejará de funcionar.`)) onRemove(m.code);
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.6)" }}>
      <div className="flex items-center justify-between gap-2 p-3.5">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
          <ChevronDown size={15} color="#C7D9D4" className="shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "#2E3A36" }}>{m.name}</p>
            <p className="text-xs" style={{ color: "#7A8A85" }}>{m.funcion} · {m.grupo}</p>
          </div>
        </button>
        <button onClick={confirmRemove} className="p-2.5 rounded-xl shrink-0" style={{ background: "rgba(217,88,79,0.08)" }}><Trash2 size={15} color="#D9584F" /></button>
      </div>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5" style={{ borderTop: "1px solid rgba(95,179,161,0.1)" }}>
          <input className="w-full mt-3 px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Función" value={funcion} onChange={(e) => setFuncion(e.target.value)} />
          <input className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
          <input className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Teléfono (10 dígitos, para WhatsApp)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          {error && <p className="text-xs" style={{ color: "#D9584F" }}>{error}</p>}
          <GlassButton variant="secondary" className="w-full" onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Guardar cambios</GlassButton>
        </div>
      )}
    </div>
  );
}

function MaestrasTab({ pro, maestras, loading, onAdded, onSavedMaestra, onRemoved, showToast }) {
  const [name, setName] = useState("");
  const [funcion, setFuncion] = useState("");
  const [grupo, setGrupo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");

  async function addMaestra() {
    setFormError("");
    if (!name.trim() || !grupo.trim()) { setFormError("Falta el nombre o el grupo — ambos son obligatorios."); return; }
    setSaving(true);
    const m = { code: genCode(), name: name.trim(), funcion: funcion.trim() || "Maestra", grupo: grupo.trim(), telefono: telefono.trim(), professionalId: pro.id, createdAt: Date.now() };
    try {
      await saveMaestra(m);
      onAdded(m);
      setName(""); setFuncion(""); setGrupo(""); setTelefono("");
      showToast("Maestra agregada");
    } catch (err) { setFormError("No se pudo guardar: " + (err?.message || "intenta de nuevo")); }
    setSaving(false);
  }

  async function remove(code) {
    onRemoved(code);
    await deleteMaestra(code);
    showToast("Maestra eliminada");
  }

  const q = search.trim().toLowerCase();
  const visible = maestras.filter((m) => !q || m.name.toLowerCase().includes(q) || m.grupo.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <GlassCard className="p-6 space-y-3">
        <h2 className="font-semibold" style={{ color: "#2E3A36" }}>Nueva maestra</h2>
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Nombre completo *" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Función (ej. Maestra titular, Auxiliar)" value={funcion} onChange={(e) => setFuncion(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Grupo (ej. Maternal, Lactantes 1) *" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Teléfono (10 dígitos, para WhatsApp)" value={telefono} onChange={(e) => setTelefono(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addMaestra(); }} />
        {formError && <p className="text-sm" style={{ color: "#D9584F" }}>{formError}</p>}
        <GlassButton className="w-full" onClick={addMaestra} disabled={saving}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Agregar maestra</GlassButton>
      </GlassCard>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid rgba(46,58,54,0.08)" }}>
        <Search size={15} color="#7A8A85" />
        <input className="flex-1 text-sm outline-none bg-transparent" placeholder="Buscar por nombre o grupo…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <GlassCard className="p-2">
        <div className="px-3 py-3 space-y-2">
          {loading && <p className="text-sm text-center py-6" style={{ color: "#7A8A85" }}>Cargando…</p>}
          {!loading && visible.length === 0 && <p className="text-sm text-center py-8" style={{ color: "#7A8A85" }}>{q ? "Sin resultados." : "Aún no hay maestras registradas."}</p>}
          {visible.map((m) => <MaestraRow key={m.code} m={m} onSaved={onSavedMaestra} onRemove={remove} />)}
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

function NinoRow({ n, grupoOptions, onSaved, onArchiveToggle, onViewPlan }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(n.name);
  const [grupo, setGrupo] = useState(n.grupo);
  const [foto, setFoto] = useState(n.foto || "");
  const [fechaNacimiento, setFechaNacimiento] = useState(n.fechaNacimiento || "");
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProcessingPhoto(true);
    try { const dataUrl = await resizeImageFile(file); setFoto(dataUrl); }
    catch { setError("No se pudo procesar la imagen"); }
    setProcessingPhoto(false);
  }

  async function save() {
    setError("");
    if (!name.trim() || !grupo.trim()) { setError("El nombre y el grupo son obligatorios."); return; }
    setSaving(true);
    const updated = { ...n, name: name.trim(), grupo: grupo.trim(), foto: foto.trim(), fechaNacimiento };
    try { await saveNino(updated); onSaved(updated); setOpen(false); }
    catch (err) { setError("No se pudo guardar: " + (err?.message || "intenta de nuevo")); }
    setSaving(false);
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.6)", opacity: n.activo === false ? 0.55 : 1 }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-3 p-3.5 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "rgba(232,185,61,0.12)" }}>
            {n.foto ? <img src={n.foto} alt="" className="w-full h-full object-cover" /> : <Baby size={16} color="#C99A2E" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "#2E3A36" }}>{n.name} {n.activo === false && <span className="text-xs font-normal">(archivado)</span>}</p>
            <p className="text-xs" style={{ color: "#7A8A85" }}>{n.grupo}{n.fechaNacimiento ? ` · ${formatEdad(n.fechaNacimiento)}` : ""}</p>
          </div>
        </div>
        <ChevronDown size={15} color="#C7D9D4" className="shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5" style={{ borderTop: "1px solid rgba(95,179,161,0.1)" }}>
          <div className="pt-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center shrink-0" style={{ background: "rgba(232,185,61,0.12)" }}>
              {processingPhoto ? <Loader2 className="animate-spin" size={16} color="#C99A2E" /> : foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <Baby size={18} color="#C99A2E" />}
            </div>
            <label className="flex-1">
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              <span className="block text-center px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)", color: "#4A9483" }}>{foto ? "Cambiar foto" : "Subir foto"}</span>
            </label>
          </div>
          <input className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" list="grupos-list-edit" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
          <datalist id="grupos-list-edit">{grupoOptions.map((g) => <option key={g} value={g} />)}</datalist>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "#4A9483" }}>Fecha de nacimiento (para el módulo Plan)</label>
            <input type="date" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
          </div>
          {error && <p className="text-xs" style={{ color: "#D9584F" }}>{error}</p>}
          <button onClick={() => onViewPlan(n)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(95,179,161,0.08)", color: "#4A9483" }}>
            <Target size={13} /> Ver plan de desarrollo
          </button>
          <div className="flex gap-2">
            <GlassButton variant="secondary" className="flex-1" onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Guardar</GlassButton>
            <button onClick={() => onArchiveToggle(n)} className="flex-1 rounded-full text-xs font-medium" style={n.activo === false ? { background: "rgba(95,179,161,0.1)", color: "#4A9483" } : { background: "rgba(217,88,79,0.08)", color: "#D9584F" }}>
              {n.activo === false ? "Reactivar" : "Archivar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NinosTab({ pro, ninos, maestras, loading, onAdded, onSavedNino, showToast }) {
  const [name, setName] = useState("");
  const [grupo, setGrupo] = useState("");
  const [foto, setFoto] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [planNino, setPlanNino] = useState(null);

  if (planNino) {
    return (
      <div className="space-y-3">
        <button onClick={() => setPlanNino(null)} className="text-sm flex items-center gap-1.5" style={{ color: "#7A8A85" }}><ArrowLeft size={14} /> Todos los niños</button>
        <PlanView nino={planNino} professionalId={pro.id} mode="coordinadora" showToast={showToast} />
      </div>
    );
  }

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
    const n = { id: "n" + Date.now() + Math.random().toString(36).slice(2, 5), name: name.trim(), grupo: grupo.trim(), foto: foto.trim(), fechaNacimiento, professionalId: pro.id, createdAt: Date.now(), activo: true };
    try {
      await saveNino(n);
      onAdded(n);
      setName(""); setGrupo(""); setFoto(""); setFechaNacimiento("");
      showToast("Niño agregado");
    } catch (err) { setFormError("No se pudo guardar: " + (err?.message || "intenta de nuevo")); }
    setSaving(false);
  }

  async function archiveToggle(n) {
    const updated = { ...n, activo: n.activo === false ? true : false };
    try { await saveNino(updated); onSavedNino(updated); showToast(updated.activo ? "Niño reactivado" : "Niño archivado"); }
    catch { showToast("No se pudo actualizar"); }
  }

  const q = search.trim().toLowerCase();
  const visible = ninos
    .filter((n) => (showArchived ? true : n.activo !== false))
    .filter((n) => !q || n.name.toLowerCase().includes(q) || n.grupo.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <GlassCard className="p-6 space-y-3">
        <h2 className="font-semibold" style={{ color: "#2E3A36" }}>Nuevo niño</h2>
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none" list="grupos-list" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} placeholder="Grupo (ej. Maternal)" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#4A9483" }}>Fecha de nacimiento (para el módulo Plan)</label>
          <input type="date" className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(95,179,161,0.2)" }} value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
        </div>
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

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid rgba(46,58,54,0.08)" }}>
          <Search size={15} color="#7A8A85" />
          <input className="flex-1 text-sm outline-none bg-transparent" placeholder="Buscar por nombre o grupo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowArchived((v) => !v)} className="px-3 py-2.5 rounded-2xl text-xs font-medium shrink-0" style={showArchived ? { background: "#5FB3A1", color: "white" } : { background: "#FFFFFF", color: "#7A8A85", border: "1px solid rgba(46,58,54,0.08)" }}>
          Archivados
        </button>
      </div>

      <GlassCard className="p-2">
        <div className="px-3 py-3 space-y-2">
          {loading && <p className="text-sm text-center py-6" style={{ color: "#7A8A85" }}>Cargando…</p>}
          {!loading && visible.length === 0 && <p className="text-sm text-center py-8" style={{ color: "#7A8A85" }}>{q ? "Sin resultados." : "Aún no hay niños registrados."}</p>}
          {visible.map((n) => <NinoRow key={n.id} n={n} grupoOptions={grupoOptions} onSaved={onSavedNino} onArchiveToggle={archiveToggle} onViewPlan={setPlanNino} />)}
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

function buildNinoRowsHTML(entries) {
  return entries.map(({ nino, log }) => {
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
}

function buildMaestraSectionHTML(maestra, entries) {
  return `
    <div>
      <h2 style="font-size:17px;margin:0 0 4px;">${maestra.name}</h2>
      <p style="margin:0 0 14px;font-size:13px;color:#555;">Grupo: ${maestra.grupo}</p>
      ${entries.length ? buildNinoRowsHTML(entries) : '<p style="color:#777;">No hay niños registrados en este grupo.</p>'}
    </div>`;
}

function buildBitacoraHTML(maestra, dateStr, entries) {
  return `
    <div style="font-family:-apple-system,Arial,sans-serif;color:#111;padding:24px;">
      <h1 style="font-size:20px;margin:0 0 14px;">Bitácora diaria</h1>
      <p style="margin:0 0 4px;font-size:13px;"><strong>Maestra:</strong> ${maestra.name}</p>
      <p style="margin:0 0 4px;font-size:13px;"><strong>Grupo:</strong> ${maestra.grupo}</p>
      <p style="margin:0 0 20px;font-size:13px;"><strong>Fecha:</strong> ${fmtDateEs(dateStr)}</p>
      ${entries.length ? buildNinoRowsHTML(entries) : '<p style="color:#777;">No hay niños registrados en este grupo.</p>'}
    </div>`;
}

function buildAllBitacorasHTML(dateStr, sections) {
  const body = sections.map(({ maestra, entries }, i) => `
    <div style="${i > 0 ? "page-break-before:always;" : ""}padding-top:${i > 0 ? "8px" : "0"};">
      ${buildMaestraSectionHTML(maestra, entries)}
    </div>`).join("");
  return `
    <div style="font-family:-apple-system,Arial,sans-serif;color:#111;padding:24px;">
      <h1 style="font-size:20px;margin:0 0 4px;">Bitácoras diarias — Todas las maestras</h1>
      <p style="margin:0 0 20px;font-size:13px;"><strong>Fecha:</strong> ${fmtDateEs(dateStr)}</p>
      ${sections.length ? body : '<p style="color:#777;">No hay maestras registradas.</p>'}
    </div>`;
}

function printHTMLReport(html, title) {
  const container = document.createElement("div");
  container.id = "bitacora-print-area";
  container.innerHTML = html;
  document.body.appendChild(container);
  document.body.classList.add("printing-bitacora");
  const originalTitle = document.title;
  document.title = title;
  setTimeout(() => window.print(), 50);
  const cleanup = () => {
    document.body.classList.remove("printing-bitacora");
    document.title = originalTitle;
    container.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
}

function printBitacoraReport(maestra, dateStr, entries) {
  printHTMLReport(buildBitacoraHTML(maestra, dateStr, entries), "Bitácora diaria");
}

async function printAllBitacoras(maestras, ninos, dateStr) {
  const sections = [];
  for (const m of maestras) {
    const grupoNinos = ninos.filter((n) => n.grupo === m.grupo);
    const entries = [];
    for (const n of grupoNinos) {
      const log = await getLog(n.id, dateStr);
      entries.push({ nino: n, log: log || emptyLog(n, dateStr) });
    }
    sections.push({ maestra: m, entries });
  }
  printHTMLReport(buildAllBitacorasHTML(dateStr, sections), "Bitácoras diarias");
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

  function shareWhatsApp() {
    const text = `Hola ${m.name}, este es tu link de Skillmind para llenar la bitácora diaria de tu grupo (${m.grupo}): ${linkUrl(m.code)}`;
    window.open(whatsAppUrl(m.telefono, text), "_blank");
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
            <button onClick={() => copyLink(m.code)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(95,179,161,0.08)", color: "#4A9483" }}><Copy size={13} /> Copiar</button>
            <button onClick={shareWhatsApp} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(37,211,102,0.12)", color: "#1DA851" }}><MessageCircle size={13} /> WhatsApp</button>
            <button onClick={() => onPreview(m.code)} className="flex-1 py-2.5 rounded-xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.7)", color: "#4A9483", border: "1px solid rgba(95,179,161,0.15)" }}>Ver</button>
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
  const [allDate, setAllDate] = useState(dateKey(new Date()));
  const [downloadingAll, setDownloadingAll] = useState(false);

  async function downloadAll() {
    setDownloadingAll(true);
    try { await printAllBitacoras(maestras, ninos, allDate); }
    catch { showToast("No se pudo generar el reporte"); }
    setDownloadingAll(false);
  }

  return (
    <div className="space-y-2">
      {maestras.length > 0 && (
        <GlassCard className="p-4 mb-2">
          <p className="text-xs font-medium mb-2" style={{ color: "#4A9483" }}>Descargar todas las maestras de un día</p>
          <DayNav date={allDate} setDate={setAllDate} />
          <GlassButton className="w-full mt-2" onClick={downloadAll} disabled={downloadingAll}>
            {downloadingAll ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />} Descargar todas ({maestras.length})
          </GlassButton>
        </GlassCard>
      )}
      {loading && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Cargando…</p></GlassCard>}
      {!loading && maestras.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Agrega maestras primero para poder enviarles su link de bitácora.</p></GlassCard>}
      {maestras.map((m) => <MaestraAccordionRow key={m.code} m={m} ninos={ninos} copyLink={copyLink} linkUrl={linkUrl} onPreview={onPreview} showToast={showToast} />)}
    </div>
  );
}

/* ------------------------------ Módulo PLAN (UI) --------------------------- */

function ObjetivoCard({ objetivo, onUpdate, onDelete, readOnly, hideHiddenObs }) {
  const [open, setOpen] = useState(false);
  const [progreso, setProgreso] = useState(objetivo.progreso);
  const [estado, setEstado] = useState(objetivo.estado);
  const [observaciones, setObservaciones] = useState(objetivo.observaciones);
  const [visiblePadres, setVisiblePadres] = useState(objetivo.visiblePadres);
  const [registros, setRegistros] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [showAddReg, setShowAddReg] = useState(false);
  const [regProgreso, setRegProgreso] = useState(objetivo.progreso);
  const [regObs, setRegObs] = useState("");
  const [savingReg, setSavingReg] = useState(false);

  const st = ESTADOS_OBJETIVO.find((e) => e.key === estado) || ESTADOS_OBJETIVO[0];

  async function loadRegistros() {
    setLoadingRegs(true);
    const r = await listRegistros(objetivo.id);
    setRegistros(r);
    setLoadingRegs(false);
  }
  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) loadRegistros();
  }

  async function saveChanges(patch) {
    const updated = { ...objetivo, progreso, estado, observaciones, visiblePadres, ...patch, updatedAt: Date.now() };
    try { await saveObjetivo(updated); onUpdate(updated); } catch {}
  }

  async function addRegistro() {
    setSavingReg(true);
    const reg = { id: `${objetivo.id}:${Date.now()}`, objetivoId: objetivo.id, fecha: dateKey(new Date()), progreso: regProgreso, observacion: regObs.trim(), usuario: "Maestra", createdAt: Date.now() };
    try {
      await saveRegistro(reg);
      setRegistros((prev) => [reg, ...prev]);
      setProgreso(regProgreso);
      await saveChanges({ progreso: regProgreso });
      setRegObs(""); setShowAddReg(false);
    } catch {}
    setSavingReg(false);
  }

  const mostrarObs = !hideHiddenObs || objetivo.visiblePadres;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.6)" }}>
      <button onClick={toggleOpen} className="w-full flex items-center justify-between gap-3 p-3.5 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {objetivo.esPrincipal && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: "rgba(95,179,161,0.15)", color: "#4A9483" }}>Principal</span>}
            <p className="text-sm font-medium" style={{ color: "#2E3A36" }}>{objetivo.texto}</p>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#7A8A85" }}>{AREAS.find((a) => a.key === objetivo.area)?.label}</p>
          <div className="w-full h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${progreso}%`, background: st.color }} />
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded-full font-medium shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-3" style={{ borderTop: "1px solid rgba(95,179,161,0.1)" }}>
          {!readOnly && (
            <div className="pt-3 space-y-2.5">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#4A9483" }}>Progreso: {progreso}%</label>
                <input type="range" min="0" max="100" step="5" value={progreso} className="w-full"
                  onChange={(e) => setProgreso(Number(e.target.value))}
                  onMouseUp={() => saveChanges({ progreso })} onTouchEnd={() => saveChanges({ progreso })} />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ESTADOS_OBJETIVO.map((e) => (
                  <button key={e.key} onClick={() => { setEstado(e.key); saveChanges({ estado: e.key }); }} className="py-2 rounded-xl text-xs font-medium"
                    style={estado === e.key ? { background: e.color, color: "white" } : { background: e.bg, color: e.color }}>
                    {e.label}
                  </button>
                ))}
              </div>
              <textarea className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" rows={2} placeholder="Observaciones internas…"
                style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }}
                value={observaciones} onChange={(e) => setObservaciones(e.target.value)} onBlur={() => saveChanges({ observaciones })} />
              <button onClick={() => { const v = !visiblePadres; setVisiblePadres(v); saveChanges({ visiblePadres: v }); }} className="text-xs font-medium flex items-center gap-1.5" style={{ color: visiblePadres ? "#4A9483" : "#7A8A85" }}>
                {visiblePadres ? <Eye size={13} /> : <EyeOff size={13} />} {visiblePadres ? "Visible para padres" : "Solo personal autorizado"}
              </button>
              {registros.length === 0 && (
                <button onClick={() => onDelete(objetivo.id)} className="text-xs font-medium" style={{ color: "#D9584F" }}>Eliminar esta meta</button>
              )}
            </div>
          )}
          {readOnly && mostrarObs && objetivo.observaciones && (
            <p className="text-sm pt-3" style={{ color: "#2E3A36" }}>{objetivo.observaciones}</p>
          )}

          <div className="pt-2">
            <p className="text-xs font-medium mb-1.5" style={{ color: "#4A9483" }}>Historial de avances</p>
            {loadingRegs && <p className="text-xs" style={{ color: "#7A8A85" }}>Cargando…</p>}
            {!loadingRegs && registros.length === 0 && <p className="text-xs" style={{ color: "#BFD9D1" }}>Sin registros aún.</p>}
            {registros.map((r) => (
              <div key={r.id} className="text-xs p-2 rounded-lg mb-1" style={{ background: "rgba(255,255,255,0.5)" }}>
                <span style={{ color: "#2E3A36" }}>{r.fecha} · {r.progreso}%</span>
                {r.observacion && mostrarObs && <p style={{ color: "#7A8A85" }}>{r.observacion}</p>}
              </div>
            ))}
            {!readOnly && (
              showAddReg ? (
                <div className="space-y-2 mt-2">
                  <input type="range" min="0" max="100" step="5" value={regProgreso} onChange={(e) => setRegProgreso(Number(e.target.value))} className="w-full" />
                  <p className="text-xs text-center" style={{ color: "#7A8A85" }}>{regProgreso}%</p>
                  <textarea className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" rows={2} placeholder="Observación de este avance…"
                    style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} value={regObs} onChange={(e) => setRegObs(e.target.value)} />
                  <div className="flex gap-2">
                    <GlassButton variant="secondary" className="flex-1" onClick={addRegistro} disabled={savingReg}>{savingReg ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />} Guardar avance</GlassButton>
                    <button onClick={() => setShowAddReg(false)} className="px-3 text-xs" style={{ color: "#7A8A85" }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddReg(true)} className="text-xs font-medium mt-2" style={{ color: "#4A9483" }}>+ Registrar avance</button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddObjetivoPanel({ plan, existingTextos, onAdded, showToast }) {
  const [open, setOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [customArea, setCustomArea] = useState(AREAS[0].key);
  const [adding, setAdding] = useState(null);

  const sugeridos = objetivosParaEdad(plan.edadMeses).filter((o) => !existingTextos.includes(o.texto));

  async function addFromLibrary(o) {
    setAdding(o.texto);
    const obj = { id: `${plan.id}:${Date.now()}${Math.random().toString(36).slice(2, 5)}`, planId: plan.id, origen: "biblioteca", area: o.area, texto: o.texto, esPrincipal: false, nivelInicial: "", metaEsperada: "", progreso: 0, estado: "no_iniciado", observaciones: "", visiblePadres: false, updatedAt: Date.now() };
    try { await saveObjetivo(obj); onAdded(obj); } catch { showToast("No se pudo agregar"); }
    setAdding(null);
  }

  async function addCustom() {
    if (!customText.trim()) return;
    setAdding("custom");
    const obj = { id: `${plan.id}:${Date.now()}${Math.random().toString(36).slice(2, 5)}`, planId: plan.id, origen: "personalizada", area: customArea, texto: customText.trim(), esPrincipal: false, nivelInicial: "", metaEsperada: "", progreso: 0, estado: "no_iniciado", observaciones: "", visiblePadres: false, updatedAt: Date.now() };
    try { await saveObjetivo(obj); onAdded(obj); setCustomText(""); } catch { showToast("No se pudo agregar"); }
    setAdding(null);
  }

  return (
    <GlassCard className="p-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "#2E3A36" }}>+ Agregar meta</p>
        <ChevronDown size={15} color="#C7D9D4" className="transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {sugeridos.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: "#4A9483" }}>Sugeridos para su edad</p>
              <div className="space-y-1.5">
                {sugeridos.map((o, i) => (
                  <button key={i} disabled={adding === o.texto} onClick={() => addFromLibrary(o)} className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl text-left text-sm" style={{ background: "rgba(95,179,161,0.06)" }}>
                    <span style={{ color: "#2E3A36" }}>{o.texto}<span className="block text-xs" style={{ color: "#7A8A85" }}>{AREAS.find((a) => a.key === o.area)?.label}</span></span>
                    <Plus size={14} color="#4A9483" className="shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: "#4A9483" }}>Meta personalizada</p>
            <textarea className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" rows={2} placeholder="Escribe una meta…" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} value={customText} onChange={(e) => setCustomText(e.target.value)} />
            <select className="w-full mt-2 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} value={customArea} onChange={(e) => setCustomArea(e.target.value)}>
              {AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
            <GlassButton variant="secondary" className="w-full mt-2" onClick={addCustom} disabled={adding === "custom"}>{adding === "custom" ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Agregar</GlassButton>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function PlanView({ nino, maestraCode, professionalId, mode, showToast }) {
  const [planes, setPlanes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [objetivos, setObjetivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingObjs, setLoadingObjs] = useState(true);
  const [closing, setClosing] = useState(false);
  const [obsFinales, setObsFinales] = useState("");
  const [showCloseForm, setShowCloseForm] = useState(false);

  const reloadPlanes = useCallback(async () => {
    setLoading(true);
    let list = await listPlanesByNino(nino.id);
    if (mode === "maestra") {
      const mk = monthKey(new Date());
      if (!list.some((p) => p.mes === mk)) {
        const nuevo = await getOrCreatePlanDelMes(nino, professionalId, maestraCode);
        list = [nuevo, ...list];
      }
    }
    if (mode === "padre") {
      const mk = monthKey(new Date());
      list = list.filter((p) => p.mes === mk || p.estado === "cerrado");
    }
    setPlanes(list);
    setSelectedId((prev) => (prev && list.some((p) => p.id === prev) ? prev : list[0]?.id || null));
    setLoading(false);
  }, [nino.id, mode, professionalId, maestraCode]);

  useEffect(() => { reloadPlanes(); }, [reloadPlanes]);

  useEffect(() => {
    if (!selectedId) { setObjetivos([]); setLoadingObjs(false); return; }
    setLoadingObjs(true);
    listObjetivos(selectedId).then((list) => { setObjetivos(list); setLoadingObjs(false); });
  }, [selectedId]);

  function updateObjetivoLocal(o) { setObjetivos((prev) => prev.map((x) => (x.id === o.id ? o : x))); }
  function addObjetivoLocal(o) { setObjetivos((prev) => [...prev, o]); }
  async function removeObjetivo(id) { setObjetivos((prev) => prev.filter((x) => x.id !== id)); await deleteObjetivo(id); }

  const selectedPlan = planes.find((p) => p.id === selectedId);
  const isCurrentOpen = selectedPlan && selectedPlan.estado === "abierto";

  async function closeMonth() {
    setClosing(true);
    const counts = { logrado: 0, en_proceso: 0, no_iniciado: 0 };
    let sumaProgreso = 0;
    objetivos.forEach((o) => { counts[o.estado] = (counts[o.estado] || 0) + 1; sumaProgreso += o.progreso; });
    const resumen = { logrados: counts.logrado || 0, enProceso: counts.en_proceso || 0, noIniciados: counts.no_iniciado || 0, porcentajePromedio: objetivos.length ? Math.round(sumaProgreso / objetivos.length) : 0, observacionesFinales: obsFinales.trim() };
    const updated = { ...selectedPlan, estado: "cerrado", closedAt: Date.now(), resumen };
    try { await savePlan(updated); setPlanes((prev) => prev.map((p) => (p.id === updated.id ? updated : p))); setShowCloseForm(false); showToast && showToast("Mes cerrado"); }
    catch { showToast && showToast("No se pudo cerrar el mes"); }
    setClosing(false);
  }

  if (loading) return <GlassCard className="p-6"><p className="text-sm" style={{ color: "#7A8A85" }}>Cargando plan…</p></GlassCard>;

  const existingTextos = objetivos.map((o) => o.texto);
  const counts = { logrado: 0, en_proceso: 0, no_iniciado: 0 };
  objetivos.forEach((o) => { counts[o.estado] = (counts[o.estado] || 0) + 1; });
  const promedio = objetivos.length ? Math.round(objetivos.reduce((s, o) => s + o.progreso, 0) / objetivos.length) : 0;

  return (
    <div className="space-y-3">
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="font-semibold" style={{ color: "#2E3A36" }}>{nino.name}</p>
          {nino.fechaNacimiento ? <span className="text-xs" style={{ color: "#7A8A85" }}>{formatEdad(nino.fechaNacimiento)}</span> : <span className="text-xs" style={{ color: "#D9584F" }}>Falta fecha de nacimiento</span>}
        </div>
        <p className="text-xs" style={{ color: "#7A8A85" }}>{nino.grupo}</p>
      </GlassCard>

      {planes.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Aún no hay planes para este niño.</p></GlassCard>}

      {planes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {planes.map((p) => (
            <button key={p.id} onClick={() => setSelectedId(p.id)} className="shrink-0 px-3.5 py-2 rounded-full text-xs font-medium"
              style={selectedId === p.id ? { background: "#5FB3A1", color: "white" } : { background: "#FFFFFF", color: "#7A8A85", border: "1px solid rgba(46,58,54,0.08)" }}>
              {monthLabel(p.mes)}{p.estado === "cerrado" ? " ✓" : ""}
            </button>
          ))}
        </div>
      )}

      {selectedPlan && (
        <>
          <GlassCard className="p-4">
            <p className="text-xs font-medium mb-2" style={{ color: "#4A9483" }}>PLAN DE {monthLabel(selectedPlan.mes).toUpperCase()}</p>
            <div className="flex items-center gap-3 text-xs mb-2 flex-wrap">
              <span style={{ color: "#5FA34A" }}>● Logrado: {counts.logrado || 0}</span>
              <span style={{ color: "#C99A2E" }}>● En proceso: {counts.en_proceso || 0}</span>
              <span style={{ color: "#7A8A85" }}>● No iniciado: {counts.no_iniciado || 0}</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
              <div className="h-full rounded-full" style={{ width: `${promedio}%`, background: "#5FB3A1" }} />
            </div>
            <p className="text-xs mt-1" style={{ color: "#7A8A85" }}>{promedio}% de progreso general</p>
            {selectedPlan.estado === "cerrado" && selectedPlan.resumen?.observacionesFinales && (
              <p className="text-sm mt-3 pt-3" style={{ color: "#2E3A36", borderTop: "1px solid rgba(95,179,161,0.1)" }}>{selectedPlan.resumen.observacionesFinales}</p>
            )}
          </GlassCard>

          {loadingObjs && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Cargando metas…</p></GlassCard>}
          {!loadingObjs && objetivos.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Aún no hay metas en este plan.</p></GlassCard>}
          {!loadingObjs && objetivos.map((o) => (
            <ObjetivoCard key={o.id} objetivo={o} onUpdate={updateObjetivoLocal} onDelete={removeObjetivo} readOnly={mode !== "maestra"} hideHiddenObs={mode === "padre"} />
          ))}

          {mode === "maestra" && isCurrentOpen && !loadingObjs && (
            <AddObjetivoPanel plan={selectedPlan} existingTextos={existingTextos} onAdded={addObjetivoLocal} showToast={showToast || (() => {})} />
          )}

          {mode === "maestra" && isCurrentOpen && objetivos.length > 0 && (
            showCloseForm ? (
              <GlassCard className="p-4 space-y-2.5">
                <p className="text-sm font-semibold" style={{ color: "#2E3A36" }}>Cerrar el mes</p>
                <textarea className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" rows={3} placeholder="Observaciones finales del mes…" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(95,179,161,0.2)" }} value={obsFinales} onChange={(e) => setObsFinales(e.target.value)} />
                <div className="flex gap-2">
                  <GlassButton className="flex-1" onClick={closeMonth} disabled={closing}>{closing ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Confirmar cierre</GlassButton>
                  <button onClick={() => setShowCloseForm(false)} className="px-3 text-xs" style={{ color: "#7A8A85" }}>Cancelar</button>
                </div>
              </GlassCard>
            ) : (
              <GlassButton variant="secondary" className="w-full" onClick={() => setShowCloseForm(true)}>Cerrar mes</GlassButton>
            )
          )}
        </>
      )}
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
  const [modo, setModo] = useState("bitacoras"); // "bitacoras" | "plan"
  const [ninoPlan, setNinoPlan] = useState(null);

  useEffect(() => {
    (async () => {
      const m = await getMaestra(code);
      setMaestra(m);
      if (m) {
        if (persist) safeStorageSet("skillmind-my-access", JSON.stringify({ type: "maestra", code }));
        const all = await listNinos(m.professionalId);
        setNinos(all.filter((n) => n.grupo === m.grupo && n.activo !== false).sort((a, b) => a.name.localeCompare(b.name)));
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

  if (ninoPlan) {
    return (
      <div className="w-full max-w-md px-5 pt-8 pb-16 flex-1">
        <button onClick={() => setNinoPlan(null)} className="text-sm flex items-center gap-1.5 mb-4" style={{ color: "#7A8A85" }}><ArrowLeft size={14} /> Todos los niños</button>
        <PlanView nino={ninoPlan} maestraCode={maestra.code} professionalId={maestra.professionalId} mode="maestra" showToast={showToast} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md px-5 pt-8 pb-16 flex-1">
      <div className="flex items-center gap-2.5 mb-5">
        <Logo size={9} />
        <div><p className="text-xs" style={{ color: "#7A8A85" }}>{maestra.funcion}</p><p className="font-semibold" style={{ color: "#2E3A36" }}>{maestra.name} · {maestra.grupo}</p></div>
      </div>

      <GlassCard className="p-1.5 mb-4">
        <div className="flex gap-1">
          {[{ id: "bitacoras", label: "Bitácoras" }, { id: "plan", label: "Plan de desarrollo" }].map((t) => (
            <button key={t.id} onClick={() => setModo(t.id)} className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
              style={modo === t.id ? { background: "#5FB3A1", color: "white" } : { color: "#7A8A85" }}>
              {t.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {modo === "bitacoras" ? (
        <>
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
        </>
      ) : (
        <div className="space-y-2">
          {ninos.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>No hay niños registrados en tu grupo todavía.</p></GlassCard>}
          {ninos.map((n) => (
            <button key={n.id} onClick={() => setNinoPlan(n)} className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.6)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "rgba(95,179,161,0.12)" }}>
                  {n.foto ? <img src={n.foto} alt="" className="w-full h-full object-cover" /> : <Target size={16} color="#4A9483" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#2E3A36" }}>{n.name}</p>
                  <p className="text-xs" style={{ color: "#7A8A85" }}>{n.fechaNacimiento ? formatEdad(n.fechaNacimiento) : "Sin fecha de nacimiento"}</p>
                </div>
              </div>
              <ChevronRight size={16} color="#C7D9D4" className="shrink-0" />
            </button>
          ))}
        </div>
      )}

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
    { id: "avances", label: "Avances", icon: Target },
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

function WeeklySummaryCard({ nino }) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const days = [];
      for (let i = 6; i >= 0; i--) days.push(dateKey(addDays(new Date(), -i)));
      const results = await Promise.all(days.map((d) => getLog(nino.id, d)));
      setLogs(results.filter(Boolean));
      setLoading(false);
    })();
  }, [nino.id]);

  if (loading) return <GlassCard className="p-5"><p className="text-sm" style={{ color: "#7A8A85" }}>Cargando…</p></GlassCard>;

  const diasConRegistro = logs.length;
  const napYes = logs.filter((l) => l.siestas.some((s) => s.durmio === "si")).length;
  const meal = { todo: 0, mitad: 0, nada: 0 };
  logs.forEach((l) => l.alimentacion.forEach((a) => { if (meal[a.cantidad] != null) meal[a.cantidad]++; }));
  const moodCounts = {};
  logs.forEach((l) => l.animos.forEach((a) => { moodCounts[a.estado] = (moodCounts[a.estado] || 0) + 1; }));
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <GlassCard className="p-5">
      <p className="text-sm font-semibold mb-3" style={{ color: "#2E3A36" }}>{nino.name} · últimos 7 días</p>
      {diasConRegistro === 0 ? (
        <p className="text-sm" style={{ color: "#7A8A85" }}>Sin registros esta semana.</p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#F2F9EF" }}><Moon size={14} color="#5FA34A" /></div>
            <p className="text-sm" style={{ color: "#2E3A36" }}>Durmió siesta <strong>{napYes}</strong> de {diasConRegistro} días con registro</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FFFDF0" }}><Utensils size={14} color="#C99A2E" /></div>
            <p className="text-sm" style={{ color: "#2E3A36" }}>Comió todo <strong>{meal.todo}</strong> · la mitad <strong>{meal.mitad}</strong> · nada <strong>{meal.nada}</strong></p>
          </div>
          {topMood && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#F3EFFA" }}><Smile size={14} color="#7A5FA8" /></div>
              <p className="text-sm" style={{ color: "#2E3A36" }}>Ánimo más frecuente: <strong>{MOOD_OPTIONS.find((o) => o.key === topMood[0])?.label}</strong></p>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function PadreInicioTab({ hijos }) {
  const [date, setDate] = useState(dateKey(new Date()));
  const [view, setView] = useState("dia"); // "dia" | "semana"

  return (
    <div className="space-y-3">
      <GlassCard className="p-1.5">
        <div className="flex gap-1">
          {[{ id: "dia", label: "Hoy" }, { id: "semana", label: "Semana" }].map((t) => (
            <button key={t.id} onClick={() => setView(t.id)} className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
              style={view === t.id ? { background: "#5FB3A1", color: "white" } : { color: "#7A8A85" }}>
              {t.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {view === "dia" ? (
        <>
          <GlassCard className="p-4"><DayNav date={date} setDate={setDate} /></GlassCard>
          {hijos.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Aún no hay niños vinculados a tu cuenta.</p></GlassCard>}
          {hijos.map((n) => <NinoLogWidget key={n.id} nino={n} date={date} readOnly />)}
        </>
      ) : (
        <>
          {hijos.length === 0 && <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Aún no hay niños vinculados a tu cuenta.</p></GlassCard>}
          {hijos.map((n) => <WeeklySummaryCard key={n.id} nino={n} />)}
        </>
      )}
    </div>
  );
}

function PadreAvancesTab({ hijos, professionalId }) {
  const [selected, setSelected] = useState(hijos[0] || null);

  if (hijos.length === 0) return <GlassCard className="p-6"><p className="text-sm text-center" style={{ color: "#7A8A85" }}>Aún no hay niños vinculados a tu cuenta.</p></GlassCard>;

  return (
    <div className="space-y-3">
      {hijos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {hijos.map((n) => (
            <button key={n.id} onClick={() => setSelected(n)} className="shrink-0 px-3.5 py-2 rounded-full text-xs font-medium"
              style={selected?.id === n.id ? { background: "#5FB3A1", color: "white" } : { background: "#FFFFFF", color: "#7A8A85", border: "1px solid rgba(46,58,54,0.08)" }}>
              {n.name}
            </button>
          ))}
        </div>
      )}
      {selected && <PlanView nino={selected} professionalId={professionalId} mode="padre" />}
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
      {tab === "avances" && <PadreAvancesTab hijos={hijos} professionalId={padre.professionalId} />}
      {tab === "anuncios" && <PadreAnunciosTab profesionalId={padre.professionalId} />}
      {tab === "mensajes" && <PadreMensajesTab padreCode={padre.code} showToast={showToast} />}

      <PadreBottomNav tab={tab} setTab={setTab} />

      <button onClick={onExitDemo} className="text-xs mt-6 mx-auto flex items-center gap-1 justify-center w-full" style={{ color: "#BFD9D1" }}>
        <ArrowLeft size={12} /> Salir de la vista previa
      </button>
    </div>
  );
}
