const SUPA = "https://qtdvehlewuuljolistlw.supabase.co";
const CLAVE = "sb_publishable_1W_oC99R9By_5iGixwbEqw_rogdHvoQ";   // clave pública; los datos los protegen las reglas de las tablas

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const NOMBRES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const PISTAS = ["Ej.: Pierna — sentadilla 5×5, peso muerto 3×5", "Ej.: Correr 8 km suave", "Ej.: Torso — press banca 4×8",
                "Ej.: Descanso activo, movilidad 20 min", "Ej.: Series 6×400 m", "Ej.: Tirada larga 15 km", "Ej.: Descanso"];
// Fuerza: kg × reps. Carrera y natación: metros y tiempo, con el ritmo por km o por 100 m
const TIPOS = {
  fuerza: { nombre: "Fuerza" },
  carrera: { nombre: "Carrera", porMetros: 1000, sufijo: "/km" },
  natacion: { nombre: "Natación", porMetros: 100, sufijo: "/100 m" }
};
// Ejercicios habituales que se proponen al buscar; al elegirlos se crean con su tipo
const SUGERIDOS = [
  ["Crol", "natacion"], ["Espalda", "natacion"], ["Braza", "natacion"], ["Mariposa", "natacion"], ["Estilos", "natacion"],
  ["Crol técnica", "natacion"], ["Patada crol con tabla", "natacion"], ["Patada espalda", "natacion"], ["Patada braza", "natacion"],
  ["Crol con pull buoy", "natacion"], ["Crol con palas", "natacion"], ["Remada (sculling)", "natacion"], ["Calentamiento natación", "natacion"], ["Vuelta a la calma natación", "natacion"],
  ["Series", "carrera"], ["Rodaje", "carrera"], ["Fartlek", "carrera"], ["Cuestas", "carrera"], ["Tirada larga", "carrera"], ["Trote de recuperación", "carrera"], ["Calentamiento carrera", "carrera"],
  ["Press banca", "fuerza"], ["Sentadilla", "fuerza"], ["Peso muerto", "fuerza"], ["Press militar", "fuerza"], ["Dominadas", "fuerza"], ["Remo con barra", "fuerza"], ["Hip thrust", "fuerza"], ["Zancadas", "fuerza"]
];
const $ = id => document.getElementById(id);

// ---------- Almacenamiento local (funciona sin conexión) ----------
const leer = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const escribir = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Cada tabla se sincroniza igual: gana la edición más reciente de cada fila.
// El orden importa al subir: primero ejercicios y plantillas, después las series que los usan.
const TABLAS = {
  ejercicios: { clave: "id", conflicto: "id", campos: ["id", "nombre", "tipo", "video_url", "notas", "rm", "borrado", "actualizado"] },
  ciclos: { clave: "id", conflicto: "id", campos: ["id", "ejercicio_id", "numero", "rm_inicio", "peso_inicial", "incremento", "reps_reset", "importadas", "cerrado", "borrado", "actualizado"] },
  plantillas: { clave: "id", conflicto: "id", campos: ["id", "nombre", "items", "borrado", "actualizado"] },
  mesociclos: { clave: "id", conflicto: "id", campos: ["id", "nombre", "inicio", "semanas", "dias", "progresion", "notas", "borrado", "actualizado"] },
  series: { clave: "id", conflicto: "id", campos: ["id", "fecha", "ejercicio_id", "orden", "peso", "reps", "distancia", "tiempo", "descanso", "hecha", "grupo", "meso_id", "bloque_id", "ronda", "rec_dist", "pct", "ciclo_id", "borrado", "actualizado"] },
  entrenos: { clave: "fecha", conflicto: "user_id,fecha", campos: ["fecha", "html", "texto", "actualizado"] }
};
const DEFECTOS = { tipo: "fuerza", hecha: true, grupo: "", meso_id: "", bloque_id: "", ciclo_id: "", importadas: [], cerrado: false, items: [], dias: {}, nombre: "", video_url: "", notas: "", html: "", texto: "", borrado: false };
let sesion = leer("sesion-v1");                 // {access_token, refresh_token, expires_at, user_id, email}
let perfil = leer("perfil-v1");                 // {aprobado, es_admin, email}
let usuarios = [];                              // solo para el administrador
let db = leer("datos-v2") || { entrenos: leer("entrenos-v1") || {} };
Object.keys(TABLAS).forEach(t => { db[t] = db[t] || {}; });
let cursores = leer("cursores-v2") || {};       // última marca de servidor leída por tabla
let enEspera = leer("bloques-v1") || {};        // fecha -> ejercicios añadidos que aún no tienen series
let porta = leer("portapapeles-v1");            // lo último copiado: {nombre, html, items}
const guardarLocal = () => { escribir("datos-v2", db); escribir("cursores-v2", cursores); };
const guardarEspera = () => escribir("bloques-v1", enEspera);

const estado = $("estado");
const setEstado = (t, err) => { estado.textContent = t; estado.classList.toggle("error", !!err); };

// ---------- Fechas, números y tiempos ----------
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const deIso = s => { const p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const lunesDe = d => { const l = new Date(d.getFullYear(), d.getMonth(), d.getDate()); l.setDate(l.getDate() - (l.getDay() + 6) % 7); return l; };
const sumarDias = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const fmt = d => d.getDate() + " " + MESES[d.getMonth()];
const fechaCorta = s => { const d = deIso(s); return fmt(d) + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""); };
const n0 = v => +v || 0;
const num = n => (+n).toLocaleString("es-ES", { maximumFractionDigits: 2 });
const fmtTiempo = seg => {
  const s = Math.round(n0(seg)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0");
};
const fmtDist = m => n0(m) >= 3000 ? num(Math.round(n0(m) / 10) / 100) + " km" : num(n0(m)) + " m";
const fmtDuracion = seg => n0(seg) % 60 === 0 && n0(seg) < 3600 ? n0(seg) / 60 + " min" : fmtTiempo(seg);
// "3:40", "3,40", "3'40" o "1:02:30"; un número solo son minutos
function leerTiempo(txt) {
  const t = (txt || "").trim();
  if (!t) return 0;
  const partes = t.split(/[:.,'´’"”]+/).filter(Boolean).map(Number);
  if (partes.some(isNaN)) return NaN;
  if (partes.length === 1) return Math.round(partes[0] * 60);
  return partes.reduce((acc, p) => acc * 60 + p, 0);
}
// Descanso: "1:30" o "2,00"; un número solo hasta 15 son minutos y más son segundos
function leerDescanso(txt) {
  const t = (txt || "").trim();
  if (!t) return 0;
  if (/[:.,'´’"”]/.test(t)) return leerTiempo(t);
  const n = Number(t);
  if (isNaN(n)) return NaN;
  return Math.round(n <= 15 ? n * 60 : n);
}
// Recuperación: tiempo ("1:30", "2") o distancia ("300 m", "300m")
function leerRecuperacion(txt) {
  const t = (txt || "").trim();
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*m(etros)?$/i);
  if (m) return { descanso: 0, rec_dist: parseFloat(m[1].replace(",", ".")) };
  const d = leerDescanso(t);
  return isNaN(d) ? null : { descanso: d, rec_dist: 0 };
}
const norm = t => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const compacto = t => norm(t).replace(/\s+/g, "");   // para buscar «300m» y encontrar «Series 300 m»
const nuevoId = () => crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
let desplazamiento = 0;   // semanas respecto a la actual
const lunesVista = () => sumarDias(lunesDe(new Date()), desplazamiento * 7);

// ---------- Texto del día: solo saltos de línea y negrita ----------
function limpiar(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const salida = document.createElement("div");
  (function copiar(origen, destino) {
    origen.childNodes.forEach(n => {
      if (n.nodeType === 3) { destino.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      const peso = n.style && n.style.fontWeight;
      let nuevo = null;
      if (tag === "BR") { destino.appendChild(document.createElement("br")); return; }
      if (tag === "B" || tag === "STRONG" || peso === "bold" || +peso >= 600) nuevo = document.createElement("b");
      else if (tag === "DIV" || tag === "P") nuevo = document.createElement("div");
      if (nuevo) { copiar(n, nuevo); destino.appendChild(nuevo); } else copiar(n, destino);
    });
  })(tpl.content, salida);
  return salida.innerHTML;
}
const aTexto = html => { const t = document.createElement("div"); t.innerHTML = html.replace(/<br>/g, "\n").replace(/<div>/g, "\n"); return t.textContent.replace(/^\n/, ""); };
const marcarVacio = ed => ed.classList.toggle("vacio", ed.textContent.trim() === "");

// ---------- Datos derivados: ejercicios, series y récords ----------
const vivos = tabla => Object.values(db[tabla]).filter(x => !x.borrado);
const ejercicioVivo = id => { const e = db.ejercicios[id]; return e && !e.borrado ? e : null; };
const tipoDe = id => { const e = db.ejercicios[id]; return e && TIPOS[e.tipo] ? e.tipo : "fuerza"; };
const esDistancia = tipo => tipo === "carrera" || tipo === "natacion";
function adivinarTipo(nombre) {
  const n = norm(nombre);
  if (/(nad|natac|crol|braza|mariposa|piscina|estilos|patada|pull ?buoy)/.test(n)) return "natacion";
  if (/(carrera|correr|rodaje|tirada|sprint|series de|fartlek|cuesta|trote|running|\d+ ?m\b|\d+ ?km\b)/.test(n) || /^\d+$/.test(n)) return "carrera";
  return "fuerza";
}
const hecha = s => s.hecha !== false;   // las series planificadas tienen hecha = false
const rm = s => n0(s.reps) <= 1 ? n0(s.peso) : n0(s.peso) * (1 + n0(s.reps) / 30);    // 1RM estimado (Epley)
const redondear = kg => Math.round(kg / 2.5) * 2.5;
// 1RM de referencia: el que pongas en la ficha o, si no, el mejor estimado de tus series
function rmReferencia(id) {
  const e = db.ejercicios[id];
  if (e && n0(e.rm) > 0) return n0(e.rm);
  const p = seriesDe(id).filter(s => n0(s.peso) > 0);
  return p.length ? Math.round(Math.max.apply(null, p.map(rm))) : 0;
}
const kgDePct = (id, pct) => { const r = rmReferencia(id); return r ? redondear(r * n0(pct) / 100) : 0; };
const distDeNombre = nombre => { const m = norm(nombre).match(/(\d+(?:[.,]\d+)?)\s*(km|m)\b/); return m ? parseFloat(m[1].replace(",", ".")) * (m[2] === "km" ? 1000 : 1) : 0; };
const ritmoSeg = (s, tipo) => n0(s.tiempo) / (n0(s.distancia) / TIPOS[tipo].porMetros);
const ritmo = (s, tipo) => fmtTiempo(ritmoSeg(s, tipo)) + TIPOS[tipo].sufijo;
const conMarca = s => n0(s.tiempo) > 0 && n0(s.distancia) > 0;
// Bilbo planificado: el peso sale del ciclo activo; %RM planificado: los kg salen del 1RM de referencia
const pesoMostrado = s => !hecha(s) && s.ciclo_id === "auto" ? pesoBilbo(s.ejercicio_id)
  : !hecha(s) && n0(s.pct) > 0 ? kgDePct(s.ejercicio_id, s.pct) || n0(s.peso) : n0(s.peso);
function serieTexto(s) {
  const tipo = tipoDe(s.ejercicio_id);
  if (esDistancia(tipo)) {
    // Por tiempo (sin metros): solo la duración, p. ej. «40 min»
    if (!(n0(s.distancia) > 0)) return n0(s.tiempo) > 0 ? fmtDuracion(s.tiempo) : "—";
    return fmtDist(s.distancia) + (n0(s.tiempo) > 0 ? " · " + fmtTiempo(s.tiempo) + " · " + ritmo(s, tipo) : "");
  }
  const kg = pesoMostrado(s), reps = n0(s.reps) > 0 ? n0(s.reps) : "máx";
  return (s.ciclo_id ? "Bilbo · " : "") + (n0(s.pct) > 0 ? num(s.pct) + " % · " : "") + (kg > 0 ? num(kg) + " kg × " + reps : reps + " reps");
}
const descTexto = s => n0(s.rec_dist) > 0 ? "rec. " + fmtDist(s.rec_dist) : n0(s.descanso) > 0 ? "desc. " + fmtTiempo(s.descanso) : "";
const recTexto = s => n0(s.rec_dist) > 0 ? num(s.rec_dist) + " m" : n0(s.descanso) > 0 ? fmtTiempo(s.descanso) : "";
const seriesVivas = () => Object.values(db.series).filter(s => !s.borrado && ejercicioVivo(s.ejercicio_id));
const ordenSerie = (a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.orden - b.orden;
const seriesDe = id => seriesVivas().filter(s => s.ejercicio_id === id && hecha(s)).sort(ordenSerie);   // solo lo hecho cuenta para récords
// PR: más peso (o más reps sin peso) en fuerza; menos tiempo para la misma distancia en carrera y natación
function prsDe(lista, tipo) {
  const prs = new Set();
  if (esDistancia(tipo)) {
    const mejor = {};
    lista.filter(conMarca).forEach(s => {
      const d = n0(s.distancia);
      if (mejor[d] !== undefined && n0(s.tiempo) < mejor[d]) prs.add(s.id);
      mejor[d] = Math.min(mejor[d] ?? Infinity, n0(s.tiempo));
    });
    return prs;
  }
  let maxP = null, maxR = null;
  lista.forEach(s => {
    if (n0(s.peso) > 0) { if (maxP !== null && n0(s.peso) > maxP) prs.add(s.id); maxP = Math.max(maxP ?? 0, n0(s.peso)); }
    else { if (maxR !== null && n0(s.reps) > maxR) prs.add(s.id); maxR = Math.max(maxR ?? 0, n0(s.reps)); }
  });
  return prs;
}
function ejerciciosOrdenados() {
  const ultimo = {};
  seriesVivas().forEach(s => { if (!ultimo[s.ejercicio_id] || s.fecha > ultimo[s.ejercicio_id]) ultimo[s.ejercicio_id] = s.fecha; });
  return vivos("ejercicios").sort((a, b) => (ultimo[b.id] || "").localeCompare(ultimo[a.id] || "") || a.nombre.localeCompare(b.nombre, "es"));
}
function porSesion(lista) {
  const ses = {};
  lista.forEach(s => (ses[s.fecha] = ses[s.fecha] || []).push(s));
  return Object.keys(ses).sort().map(f => ({ fecha: f, series: ses[f] }));
}
function estadisticas(id) {
  const tipo = tipoDe(id), lista = seriesDe(id);
  if (!lista.length) return { tipo, lista, sesiones: [], resumen: "Sin series todavía", ultima: "" };
  const sesiones = porSesion(lista);
  const ult = sesiones[sesiones.length - 1];
  const st = { tipo, lista, sesiones, ultima: "Última vez: " + fechaCorta(ult.fecha) + " · " + ult.series.slice(0, 3).map(serieTexto).join(", ") + (ult.series.length > 3 ? "…" : "") };
  if (esDistancia(tipo)) {
    st.total = lista.reduce((a, s) => a + n0(s.distancia), 0);
    const marcadas = lista.filter(conMarca);
    if (marcadas.length) st.mejorRitmo = marcadas.reduce((m, s) => ritmoSeg(s, tipo) < ritmoSeg(m, tipo) ? s : m);
    const porDist = {};
    marcadas.forEach(s => { const d = n0(s.distancia); if (!porDist[d] || n0(s.tiempo) < n0(porDist[d].tiempo)) porDist[d] = s; });
    st.marcas = Object.keys(porDist).map(Number).sort((a, b) => a - b).map(d => porDist[d]);
    st.tiempoTotal = lista.reduce((a, s) => a + n0(s.tiempo), 0);
    st.resumen = (st.mejorRitmo ? "Mejor ritmo: " + ritmo(st.mejorRitmo, tipo) + " (" + fmtDist(st.mejorRitmo.distancia) + ") · " : "") + (st.total > 0 ? fmtDist(st.total) : fmtTiempo(st.tiempoTotal)) + " en total";
    return st;
  }
  const pesadas = lista.filter(s => n0(s.peso) > 0);
  if (pesadas.length) {
    st.mejor = pesadas.reduce((m, s) => n0(s.peso) > n0(m.peso) || (n0(s.peso) === n0(m.peso) && n0(s.reps) > n0(m.reps)) ? s : m);
    st.mejorRm = pesadas.reduce((m, s) => rm(s) > rm(m) ? s : m);
    st.resumen = "Récord: " + serieTexto(st.mejor) + " · 1RM est. " + num(Math.round(rm(st.mejorRm))) + " kg";
  } else {
    st.mejorReps = lista.reduce((m, s) => n0(s.reps) > n0(m.reps) ? s : m);
    st.resumen = "Récord: " + n0(st.mejorReps.reps) + " reps";
  }
  return st;
}

// ---------- Bilbo: una serie al fallo que sube de peso cada sesión hasta que las reps bajan al límite ----------
const cicloActivo = id => vivos("ciclos").filter(c => c.ejercicio_id === id && !c.cerrado).sort((a, b) => n0(b.numero) - n0(a.numero))[0] || null;
const rmBilbo = (peso, reps) => n0(peso) * n0(reps) * 0.03 + n0(peso);   // la fórmula de tu hoja de Bilbo
// Sesiones de un ciclo: las importadas de la hoja y las apuntadas en la app
function sesionesBilbo(c) {
  const imp = (c.importadas || []).map(x => ({ fecha: x.fecha || "", peso: n0(x.peso), reps: n0(x.reps) }));
  const reg = seriesVivas().filter(s => s.ciclo_id === c.id && hecha(s)).sort(ordenSerie).map(s => ({ fecha: s.fecha, peso: n0(s.peso), reps: n0(s.reps) }));
  return imp.concat(reg);
}
function pesoBilbo(id) {
  const c = cicloActivo(id);
  return c ? n0(c.peso_inicial) + n0(c.incremento) * sesionesBilbo(c).length : 0;
}

// ---------- Conexión con Supabase ----------
function guardarSesion(j) {
  sesion = {
    access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    user_id: j.user.id, email: j.user.email
  };
  escribir("sesion-v1", sesion);
}
class SesionCaducada extends Error {}
async function refrescar() {
  const r = await fetch(SUPA + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST", headers: { apikey: CLAVE, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: sesion.refresh_token })
  });
  if (r.status === 400 || r.status === 401) throw new SesionCaducada();
  if (!r.ok) throw new Error("refresh " + r.status);
  guardarSesion(await r.json());
}
async function api(ruta, opciones = {}, reintento = false) {
  if (sesion.expires_at * 1000 - 60000 < Date.now()) await refrescar();
  const r = await fetch(SUPA + ruta, {
    ...opciones,
    headers: { apikey: CLAVE, Authorization: "Bearer " + sesion.access_token, "Content-Type": "application/json", ...(opciones.headers || {}) }
  });
  if (r.status === 401 && !reintento) { await refrescar(); return api(ruta, opciones, true); }
  return r;
}

// Perfil: las cuentas nuevas quedan pendientes hasta que el administrador las aprueba
async function cargarPerfil() {
  const r = await api("/rest/v1/perfiles?select=user_id,email,aprobado,es_admin,creado&order=creado.asc");
  if (!r.ok) throw new Error("perfil " + r.status);
  const lista = await r.json();
  const mio = lista.find(p => p.user_id === sesion.user_id);
  perfil = mio ? { aprobado: mio.aprobado, es_admin: mio.es_admin, email: mio.email } : { aprobado: false, es_admin: false, email: sesion.email };
  usuarios = perfil.es_admin ? lista : [];
  escribir("perfil-v1", perfil);
  avisoUsuarios();
  return perfil;
}

// Guarda una edición en el dispositivo y la deja pendiente de subir
let timerSync, versionDatos = 0;
function persistir() {
  guardarLocal();
  setEstado("Guardado en el dispositivo");
  clearTimeout(timerSync);
  timerSync = setTimeout(sincronizar, 1000);
}
function cambiar(tabla, fila, enLote) {
  fila.actualizado = new Date().toISOString();
  fila.sucio = true;
  versionDatos++;
  db[tabla][fila[TABLAS[tabla].clave]] = fila;
  if (!enLote) persistir();
}
function mezclar(tabla, f) {
  const k = f[TABLAS[tabla].clave], local = db[tabla][k];
  const tr = Date.parse(f.actualizado), tl = local ? Date.parse(local.actualizado) : 0;
  if (local && ((local.sucio && tr <= tl) || (!local.sucio && tr === tl))) return false;
  const fila = {};
  TABLAS[tabla].campos.forEach(c => { fila[c] = f[c]; });
  fila.actualizado = new Date(tr).toISOString();
  fila.sucio = false;
  db[tabla][k] = fila;
  versionDatos++;
  return true;
}
const hayPendientes = () => Object.keys(TABLAS).some(t => Object.values(db[t]).some(v => v.sucio));

let sincronizando = false, repetir = false;
async function sincronizar() {
  if (!sesion) return;
  if (sincronizando) { repetir = true; return; }
  sincronizando = true;
  try {
    await cargarPerfil();
    if (!perfil.aprobado) { mostrarPendiente(); return; }
    if ($("app").hidden) mostrarApp();
    do {
      repetir = false;
      let cambio = false;
      // Bajar solo lo que ha cambiado en el servidor (con 5 s de margen)
      for (const t of Object.keys(TABLAS)) {
        const desde = cursores[t] ? "&servidor_ts=gte." + encodeURIComponent(new Date(Date.parse(cursores[t]) - 5000).toISOString()) : "";
        const r = await api("/rest/v1/" + t + "?select=" + TABLAS[t].campos.join(",") + ",servidor_ts&order=servidor_ts.asc" + desde);
        if (!r.ok) throw new Error("leer " + t + " " + r.status);
        for (const f of await r.json()) {
          if (mezclar(t, f)) cambio = true;
          if (!cursores[t] || Date.parse(f.servidor_ts) > Date.parse(cursores[t])) cursores[t] = f.servidor_ts;
        }
      }
      guardarLocal();
      if (cambio) pintarTodo();
      // Subir lo pendiente
      for (const t of Object.keys(TABLAS)) {
        const pend = Object.values(db[t]).filter(v => v.sucio);
        if (!pend.length) continue;
        const filas = pend.map(v => { const f = { user_id: sesion.user_id }; TABLAS[t].campos.forEach(c => { f[c] = v[c] ?? (c in DEFECTOS ? DEFECTOS[c] : 0); }); return f; });
        const w = await api("/rest/v1/" + t + "?on_conflict=" + TABLAS[t].conflicto, {
          method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(filas)
        });
        if (!w.ok) throw new Error("guardar " + t + " " + w.status);
        filas.forEach(f => { const v = db[t][f[TABLAS[t].clave]]; if (v && v.actualizado === f.actualizado) v.sucio = false; });
        guardarLocal();
      }
    } while (repetir);
    setEstado("Sincronizado");
  } catch (e) {
    if (e instanceof SesionCaducada) cerrarSesion("Tu sesión ha caducado. Vuelve a entrar; lo que escribiste sigue guardado en este dispositivo.");
    else setEstado(hayPendientes() ? "Sin conexión · guardado en el dispositivo, se subirá al volver la conexión" : "Sin conexión · mostrando lo último guardado");
  } finally {
    sincronizando = false;
  }
}

// ---------- Ventanas pequeñas: menú de opciones y pedir un nombre ----------
function abrirMenu(titulo, detalle, opciones) {
  $("menuTit").textContent = titulo;
  $("menuDet").textContent = detalle || "";
  $("menuDet").hidden = !detalle;
  const cont = $("menuOpciones");
  cont.textContent = "";
  opciones.filter(Boolean).forEach(o => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opcion" + (o.peligro ? " peligro-op" : "");
    b.textContent = o.texto;
    b.addEventListener("click", () => {
      if (o.peligro && !b.dataset.confirmar) { b.dataset.confirmar = "1"; b.textContent = o.confirmar || "Pulsa otra vez para confirmar"; return; }
      if (!o.mantener) $("menu").close();
      o.accion();
    });
    cont.appendChild(b);
  });
  if (!$("menu").open) $("menu").showModal();
}
function pedirNombre(titulo, valor, ayuda) {
  return new Promise(resolver => {
    const d = $("dlgNombre");
    $("nomTit").textContent = titulo;
    $("nomAyuda").textContent = ayuda || "";
    $("nomInput").value = valor || "";
    d.returnValue = "";
    d.onclose = () => resolver(d.returnValue === "ok" ? $("nomInput").value.trim() || null : null);
    d.showModal();
    $("nomInput").select();
  });
}

// ---------- Semana ----------
const dias = DIAS.map((_, i) => {
  const col = document.createElement("section");
  col.className = "dia";
  col.innerHTML = '<div class="dia-cab"><span class="dia-nombre"></span><span class="dia-fecha"></span>' +
                  '<button type="button" class="menu-btn" aria-label="Opciones del día">⋯</button>' +
                  '<button type="button" class="negrita" aria-pressed="false" title="Negrita (⌘B)">N</button></div>' +
                  '<div class="editor vacio" role="textbox" aria-multiline="true" contenteditable="true"></div>' +
                  '<div class="bloques"></div><div class="add-fila"><button type="button" class="add-ej">+ Ejercicio</button><button type="button" class="add-ej add-bloque">+ Bloque</button></div>';
  col.querySelector(".dia-nombre").textContent = NOMBRES[i];
  const ed = col.querySelector(".editor");
  const btn = col.querySelector(".negrita");
  ed.id = "e-" + DIAS[i];
  ed.dataset.pista = PISTAS[i];
  ed.setAttribute("aria-label", "Entrenamiento del " + NOMBRES[i]);
  btn.setAttribute("aria-label", "Negrita en " + NOMBRES[i]);
  $("semana").appendChild(col);
  const dia = { i, col, ed, btn, fechaEl: col.querySelector(".dia-fecha"), bloquesEl: col.querySelector(".bloques"), id: "" };
  col.querySelector(".add-ej").addEventListener("click", () => abrirSelector(dia));
  col.querySelector(".add-bloque").addEventListener("click", () => abrirBloque(dia));
  col.querySelector(".menu-btn").addEventListener("click", () => menuDia(dia));
  return dia;
});

// Pone en cada día su texto guardado (sin tocar el que se está escribiendo)
function rellenar() {
  dias.forEach(({ id, ed }) => {
    if (document.activeElement === ed) return;
    const nuevo = limpiar(db.entrenos[id]?.html || "");
    if (limpiar(ed.innerHTML) !== nuevo) ed.innerHTML = nuevo;
    marcarVacio(ed);
  });
}

function mesoDe(fechaIso) {
  return vivos("mesociclos").find(m => m.inicio && fechaIso >= m.inicio && fechaIso < iso(sumarDias(deIso(m.inicio), n0(m.semanas) * 7)));
}
// Aviso de la semana del mesociclo en curso
function pintarBanda() {
  const lunes = lunesVista(), m = mesoDe(iso(lunes));
  $("mesoBanda").hidden = !m;
  if (m) {
    const semana = Math.floor((lunes - lunesDe(deIso(m.inicio))) / (7 * 864e5)) + 1;
    $("mesoBanda").textContent = "Mesociclo «" + m.nombre + "» · semana " + semana + " de " + n0(m.semanas);
  }
}
function pintarSemana() {
  const lunes = lunesVista();
  const hoyIso = iso(new Date());
  $("rango").textContent = fmt(lunes) + " – " + fmt(sumarDias(lunes, 6));
  const n = desplazamiento, rel = $("relativa");
  rel.textContent = n === 0 ? "Esta semana" : n === -1 ? "Semana pasada" : n === 1 ? "Próxima semana"
                  : n < 0 ? "Hace " + -n + " semanas" : "Dentro de " + n + " semanas";
  rel.classList.toggle("actual", n === 0);
  $("hoyBtn").hidden = n === 0;
  pintarBanda();
  dias.forEach(d => {
    const f = sumarDias(lunes, d.i);
    d.id = iso(f);
    d.fechaEl.textContent = fmt(f);
    d.col.classList.toggle("hoy", d.id === hoyIso);
    if (document.activeElement !== d.ed) d.ed.innerHTML = "";
  });
  rellenar();
  pintarBloques(true);
}

function editado(dia) {
  const html = limpiar(dia.ed.innerHTML);
  marcarVacio(dia.ed);
  cambiar("entrenos", { fecha: dia.id, html, texto: aTexto(html) });
}

dias.forEach(dia => {
  const { ed, btn } = dia;
  ed.addEventListener("input", () => editado(dia));
  ed.addEventListener("blur", () => rellenar());
  ed.addEventListener("paste", e => {   // pegar siempre como texto sin formato
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
  });
  btn.addEventListener("pointerdown", e => e.preventDefault());   // que el botón no quite el foco
  btn.addEventListener("mousedown", e => e.preventDefault());
  btn.addEventListener("click", () => {
    if (document.activeElement !== ed) {
      ed.focus();
      const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    document.execCommand("bold");
    btn.setAttribute("aria-pressed", document.queryCommandState("bold") ? "true" : "false");
    editado(dia);
  });
});
document.addEventListener("selectionchange", () => {
  dias.forEach(({ ed, btn }) => {
    btn.setAttribute("aria-pressed", document.activeElement === ed && document.queryCommandState("bold") ? "true" : "false");
  });
});

// ---------- Copiar, pegar y plantillas ----------
const seriesDelDia = fecha => seriesVivas().filter(s => s.fecha === fecha).sort((a, b) => a.orden - b.orden);
// Convierte series en una lista de ejercicios con sus series (para copiar o guardar como plantilla)
// Los bloques se guardan como tramos con una serie por ronda: { bloque: true, tramos: [{ ejercicio_id, series: [ronda 1, ronda 2…] }] }
const valores = s => ({ peso: n0(s.peso), reps: s.ciclo_id ? 0 : n0(s.reps), distancia: n0(s.distancia), tiempo: n0(s.tiempo), descanso: n0(s.descanso), rec_dist: n0(s.rec_dist), pct: n0(s.pct), bilbo: !!s.ciclo_id });
function itemsDe(series) {
  const items = [], bloques = {};
  series.forEach(s => {
    if (s.bloque_id) {
      if (!bloques[s.bloque_id]) { bloques[s.bloque_id] = { bloque: true, grupo: s.grupo || "", lista: [] }; items.push(bloques[s.bloque_id]); }
      bloques[s.bloque_id].lista.push(s);
      return;
    }
    let it = items.find(x => !x.bloque && x.ejercicio_id === s.ejercicio_id && x.grupo === (s.grupo || ""));
    if (!it) { it = { ejercicio_id: s.ejercicio_id, grupo: s.grupo || "", series: [] }; items.push(it); }
    it.series.push(valores(s));
  });
  items.filter(it => it.bloque).forEach(it => {
    const rondas = [...new Set(it.lista.map(s => n0(s.ronda)))].sort((a, b) => a - b);
    const porRonda = rondas.map(r => it.lista.filter(s => n0(s.ronda) === r).sort((a, b) => a.orden - b.orden));
    it.tramos = porRonda[0].map((s0, k) => ({ ejercicio_id: s0.ejercicio_id, series: porRonda.map(rs => valores(rs[k] || rs[rs.length - 1])) }));
    delete it.lista;
  });
  return items;
}
// Pega ejercicios y bloques como series planificadas; el grupo es el nombre de la sesión (p. ej. «Pierna»)
function pegarItems(fecha, items, grupo, mesoId, masKg) {
  let orden = Date.now();
  const nueva = (ejercicio_id, v, extra) => cambiar("series", Object.assign({
    id: nuevoId(), fecha, ejercicio_id, orden: orden++,
    peso: n0(v.peso) > 0 ? Math.max(0, n0(v.peso) + n0(masKg)) : 0, reps: n0(v.reps), distancia: n0(v.distancia), tiempo: n0(v.tiempo),
    descanso: n0(v.descanso), rec_dist: n0(v.rec_dist), pct: n0(v.pct), ciclo_id: v.bilbo ? "auto" : "", hecha: false, meso_id: mesoId || "", bloque_id: "", ronda: 0, borrado: false
  }, extra), true);
  items.forEach(it => {
    const g = grupo !== undefined ? grupo : (it.grupo || "");
    if (it.bloque) {
      // Alterna los tramos ronda a ronda: R1 (A, B), R2 (A, B)…
      const tramos = (it.tramos || []).filter(t => ejercicioVivo(t.ejercicio_id));
      if (!tramos.length) return;
      const bloque_id = nuevoId(), rondas = Math.max.apply(null, tramos.map(t => t.series.length));
      for (let r = 0; r < rondas; r++) tramos.forEach(t => nueva(t.ejercicio_id, t.series[r] || t.series[t.series.length - 1], { grupo: g, bloque_id, ronda: r + 1 }));
      return;
    }
    if (!ejercicioVivo(it.ejercicio_id)) return;
    it.series.forEach(v => nueva(it.ejercicio_id, v, { grupo: g }));
  });
}
const contarSeries = items => items.reduce((a, it) => a + (it.bloque ? (it.tramos || []).reduce((b, t) => b + t.series.length, 0) : it.series.length), 0);
const resumenItems = items => {
  const n = contarSeries(items);
  return items.length + (items.length === 1 ? " elemento · " : " elementos · ") + n + (n === 1 ? " serie" : " series");
};
const nombreEj = id => (db.ejercicios[id] || {}).nombre || "";
const nombresItems = items => items.map(it => it.bloque
  ? "(" + (it.tramos || []).map(t => nombreEj(t.ejercicio_id)).join(" + ") + ") ×" + Math.max.apply(null, (it.tramos || []).map(t => t.series.length).concat(1))
  : nombreEj(it.ejercicio_id)).filter(Boolean).join(", ");
function copiar(nombre, html, series) {
  porta = { nombre, html: html || "", items: itemsDe(series) };
  escribir("portapapeles-v1", porta);
  setEstado("Copiado: " + nombre);
}
function pegar(dia) {
  if (!porta) return;
  if (porta.html) {
    const antes = db.entrenos[dia.id]?.html || "";
    const html = antes ? antes + "<br>" + porta.html : porta.html;
    cambiar("entrenos", { fecha: dia.id, html, texto: aTexto(html) }, true);
  }
  pegarItems(dia.id, porta.items);
  persistir();
  rellenar();
  pintarDia(dia);
}
async function guardarPlantilla(nombreSugerido, series) {
  const nombre = await pedirNombre("Guardar como plantilla", nombreSugerido, "Si ya tienes una plantilla con este nombre, se reemplaza.");
  if (!nombre) return;
  const items = itemsDe(series).map(it => it.bloque ? { bloque: true, tramos: it.tramos } : { ejercicio_id: it.ejercicio_id, series: it.series });
  const existe = vivos("plantillas").find(p => norm(p.nombre) === norm(nombre));
  cambiar("plantillas", { id: existe ? existe.id : nuevoId(), nombre, items, borrado: false });
  setEstado("Plantilla «" + nombre + "» guardada");
}
function aplicarPlantilla(dia, p) {
  pegarItems(dia.id, p.items, p.nombre);
  persistir();
  pintarDia(dia);
}
function elegirPlantilla(titulo, alElegir) {
  const ps = vivos("plantillas").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  abrirMenu(titulo, ps.length ? "" : "Aún no tienes plantillas. Monta un entrenamiento en un día y usa «Guardar ejercicios como plantilla».",
    ps.map(p => ({ texto: p.nombre + " · " + resumenItems(p.items || []), accion: () => alElegir(p) })));
}
function menuDia(dia) {
  const series = seriesDelDia(dia.id), html = db.entrenos[dia.id]?.html || "";
  const titulo = NOMBRES[dia.i] + " " + fmt(deIso(dia.id));
  abrirMenu(titulo, "", [
    (series.length || aTexto(html).trim()) && { texto: "Copiar día", accion: () => copiar(titulo, html, series) },
    porta && { texto: "Pegar «" + porta.nombre + "»", accion: () => pegar(dia) },
    { texto: "Añadir plantilla…", accion: () => elegirPlantilla("Añadir plantilla al " + titulo, p => aplicarPlantilla(dia, p)) },
    series.length && { texto: "Guardar ejercicios como plantilla…", accion: () => guardarPlantilla(series[0].grupo || "Entrenamiento", series) },
    series.length && { texto: "Compartir con un amigo…", accion: () => compartir(series[0].grupo || titulo, itemsDe(series)) },
    series.length && { texto: "Vaciar ejercicios del día", peligro: true, confirmar: "Pulsa otra vez: se borran " + series.length + " series", accion: () => {
      series.forEach(s => cambiar("series", { ...s, borrado: true }, true)); delete enEspera[dia.id]; guardarEspera(); persistir(); pintarDia(dia);
    } }
  ]);
}
function menuGrupo(dia, grupo) {
  const series = seriesDelDia(dia.id).filter(s => (s.grupo || "") === grupo);
  abrirMenu(grupo, resumenItems(itemsDe(series)), [
    { texto: "Copiar sesión", accion: () => copiar(grupo, "", series) },
    { texto: "Guardar como plantilla…", accion: () => guardarPlantilla(grupo, series) },
    { texto: "Compartir con un amigo…", accion: () => compartir(grupo, itemsDe(series)) },
    { texto: "Cambiar nombre de la sesión…", accion: async () => {
      const n = await pedirNombre("Nombre de la sesión", grupo);
      if (!n) return;
      series.forEach(s => cambiar("series", { ...s, grupo: n }, true)); persistir(); pintarDia(dia);
    } },
    { texto: "Quitar sesión del día", peligro: true, confirmar: "Pulsa otra vez: se borran " + series.length + " series", accion: () => {
      series.forEach(s => cambiar("series", { ...s, borrado: true }, true)); persistir(); pintarDia(dia);
    } }
  ]);
}

// ---------- Compartir con amigos: un código (o enlace) que otro usuario añade a su calendario ----------
const URL_APP = "https://spider-test.github.io/entreno-semanal/";
const nuevoCodigo = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
// Los ejercicios viajan por nombre y tipo, porque cada usuario tiene los suyos
const paraCompartir = items => items.map(it => it.bloque
  ? { bloque: true, tramos: (it.tramos || []).map(t => ({ ejercicio: nombreEj(t.ejercicio_id), tipo: tipoDe(t.ejercicio_id), series: t.series })) }
  : { ejercicio: nombreEj(it.ejercicio_id), tipo: tipoDe(it.ejercicio_id), series: it.series });
function idPorNombre(nombre, tipo) {
  const e = vivos("ejercicios").find(x => compacto(x.nombre) === compacto(nombre));
  return e ? e.id : crearEjercicio(nombre, tipo);
}
const desdeCompartido = items => items.map(it => it.bloque
  ? { bloque: true, tramos: it.tramos.map(t => ({ ejercicio_id: idPorNombre(t.ejercicio, t.tipo), series: t.series })) }
  : { ejercicio_id: idPorNombre(it.ejercicio, it.tipo), series: it.series });
function copiarTexto(t) {
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => setEstado("Copiado: " + t), () => setEstado("Código: " + t));
}
async function compartir(nombre, items) {
  const codigo = nuevoCodigo();
  try {
    const r = await api("/rest/v1/compartidos", { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ codigo, user_id: sesion.user_id, autor: sesion.email || "", nombre, items: paraCompartir(items) }) });
    if (!r.ok) throw new Error();
  } catch { setEstado("No se ha podido compartir. Necesitas conexión.", true); return; }
  const enlace = URL_APP + "#c=" + codigo;
  abrirMenu("Compartir «" + nombre + "»", "Código " + codigo + ". Tu amigo puede abrir el enlace o pegar el código en Plan → Añadir algo compartido.", [
    navigator.share && { texto: "Enviar…", mantener: true, accion: () => navigator.share({ title: nombre, text: "Entrenamiento «" + nombre + "» para Entreno Semanal (código " + codigo + ")", url: enlace }).catch(() => {}) },
    { texto: "Copiar enlace", mantener: true, accion: () => copiarTexto(enlace) },
    { texto: "Copiar código", mantener: true, accion: () => copiarTexto(codigo) }
  ]);
}
async function abrirCompartido(texto) {
  const m = (texto || "").toUpperCase().match(/([A-Z2-9]{8})\s*$/);
  if (!m) { setEstado("Ese código no es válido: son 8 letras y números.", true); return; }
  let c = null;
  try {
    const r = await api("/rest/v1/rpc/ver_compartido", { method: "POST", body: JSON.stringify({ p_codigo: m[1] }) });
    if (r.ok) c = await r.json();
  } catch { setEstado("Necesitas conexión para abrir algo compartido.", true); return; }
  if (!c) { setEstado("No hay nada compartido con el código " + m[1] + ".", true); return; }
  const lunes = lunesVista();
  const nombres = c.items.map(it => it.bloque ? "(" + it.tramos.map(t => t.ejercicio).join(" + ") + ")" : it.ejercicio).join(", ");
  abrirMenu("«" + c.nombre + "»", "Compartido por " + (c.autor || "un amigo") + ": " + nombres + " · " + contarSeries(c.items) + " series. ¿Dónde lo añado?",
    NOMBRES.map((n, i) => ({ texto: "Añadir al " + n + " " + fmt(sumarDias(lunes, i)), accion: () => {
      pegarItems(iso(sumarDias(lunes, i)), desdeCompartido(c.items), c.nombre); persistir(); verPestana("semana");
    } })).concat([{ texto: "Guardar como plantilla", accion: () => {
      cambiar("plantillas", { id: nuevoId(), nombre: c.nombre, items: desdeCompartido(c.items), borrado: false }); pintarPlan(); setEstado("Plantilla «" + c.nombre + "» guardada");
    } }]));
}

// ---------- Ejercicios de cada día ----------
let repintarLuego = false;
const escribiendoSerie = () => document.activeElement && document.activeElement.closest && document.activeElement.closest(".bloques");
function pintarBloques(forzar) {
  if (!forzar && escribiendoSerie()) { repintarLuego = true; return; }
  repintarLuego = false;
  dias.forEach(pintarDia);
}
$("semana").addEventListener("focusout", () => setTimeout(() => { if (repintarLuego && !escribiendoSerie()) pintarBloques(); }, 0));

function quitarEspera(fecha, id) {
  if (!enEspera[fecha]) return;
  enEspera[fecha] = enEspera[fecha].filter(x => x !== id);
  if (!enEspera[fecha].length) delete enEspera[fecha];
  guardarEspera();
}

// Agrupa los ejercicios del día por sesión («Pierna», «Pecho»…); los sueltos van sin título
function pintarDia(dia) {
  const cont = dia.bloquesEl;
  cont.textContent = "";
  const delDia = seriesDelDia(dia.id);
  const grupos = [];
  const grupo = nombre => grupos.find(g => g.nombre === nombre) || grupos[grupos.push({ nombre, ids: [] }) - 1];
  // Cada elemento de una sesión es un ejercicio suelto o un bloque ("b:" + id), en el orden en que aparecen
  delDia.forEach(s => { const g = grupo(s.grupo || ""), k = s.bloque_id ? "b:" + s.bloque_id : s.ejercicio_id; if (!g.ids.includes(k)) g.ids.push(k); });
  (enEspera[dia.id] || []).forEach(id => { if (ejercicioVivo(id) && !grupos.some(g => g.ids.includes(id))) grupo("").ids.push(id); });
  grupos.forEach(g => {
    if (g.nombre) {
      const cab = document.createElement("div");
      cab.className = "grupo-cab";
      cab.innerHTML = '<span class="g-nombre"></span><span class="g-prog"></span><button type="button" class="menu-btn">⋯</button>';
      cab.querySelector(".g-nombre").textContent = g.nombre;
      const deG = delDia.filter(s => (s.grupo || "") === g.nombre);
      cab.querySelector(".g-prog").textContent = deG.filter(hecha).length + "/" + deG.length;
      cab.querySelector(".menu-btn").setAttribute("aria-label", "Opciones de la sesión " + g.nombre);
      cab.querySelector(".menu-btn").addEventListener("click", () => menuGrupo(dia, g.nombre));
      cont.appendChild(cab);
    }
    g.ids.forEach(id => cont.appendChild(id.startsWith("b:")
      ? tarjetaBloque(dia, id.slice(2), delDia.filter(s => s.bloque_id === id.slice(2)))
      : bloque(dia, id, delDia.filter(s => s.ejercicio_id === id && !s.bloque_id && (s.grupo || "") === g.nombre), g.nombre)));
  });
}

function etiquetaTipo(tipo) {
  const t = document.createElement("span");
  t.className = "tipo-tag t-" + tipo;
  t.textContent = TIPOS[tipo].nombre;
  return t;
}

function bloque(dia, id, series, grupo) {
  const ej = db.ejercicios[id], tipo = tipoDe(id), dist = esDistancia(tipo);
  const historia = seriesDe(id);
  const prs = prsDe(historia, tipo);
  let editando = null;   // serie planificada que se está completando
  const b = document.createElement("div");
  b.className = "bloque";
  b.dataset.ej = id;
  b.dataset.grupo = grupo;
  b.innerHTML = '<div class="bloque-cab"><button type="button" class="ej-nombre"></button><button type="button" class="quitar" aria-label="Quitar ejercicio">✕</button></div>' +
    '<ol class="series"></ol>' +
    '<form class="nueva-serie">' +
      '<div class="ns-fila">' + (dist
        ? '<button type="button" class="modo-dist" aria-label="Cambiar entre metros y tiempo">m</button><input class="in-a" inputmode="numeric" pattern="[0-9]*" placeholder="metros" aria-label="Distancia en metros" autocomplete="off" enterkeyhint="next">' +
          '<input class="in-b" inputmode="decimal" placeholder="tiempo 3,40" aria-label="Tiempo (minutos y segundos)" autocomplete="off" enterkeyhint="next">'
        : '<button type="button" class="modo" aria-label="Cambiar entre kg y % del 1RM">kg</button><input class="in-a" inputmode="decimal" placeholder="kg" aria-label="Peso en kg" autocomplete="off" enterkeyhint="next">' +
          '<span class="por">×</span><input class="in-b" inputmode="numeric" pattern="[0-9]*" placeholder="reps" aria-label="Repeticiones" autocomplete="off" enterkeyhint="next">') +
      '</div>' + (dist ? '<div class="ns-extra"><span class="calc"></span></div>' : '<div class="ns-extra"><span class="calc"></span><label class="bilbo-op" hidden><input type="checkbox" class="es-bilbo"> <span></span></label></div>') +
      '<div class="ns-fila"><input class="in-c" inputmode="decimal" placeholder="⏱ descanso 1,30 o 300 m" aria-label="Descanso o recuperación después de la serie (tiempo o metros)" autocomplete="off" enterkeyhint="done">' +
      '<select class="veces" aria-label="Cuántas series iguales añadir">' + [1, 2, 3, 4, 5, 6, 8, 10].map(n => '<option value="' + n + '">×' + n + '</option>').join("") + '</select>' +
      '<button class="anadir">+ Serie</button></div>' +
    '</form>';
  const nom = b.querySelector(".ej-nombre");
  nom.textContent = ej.nombre || "Sin nombre";
  nom.appendChild(etiquetaTipo(tipo));
  if (ej.video_url) { const v = document.createElement("span"); v.className = "ico"; v.textContent = "▶ vídeo"; nom.appendChild(v); }
  nom.setAttribute("aria-label", "Ver " + (ej.nombre || "ejercicio") + ": vídeo, récords e historial");
  nom.addEventListener("click", () => abrirDetalle(id));
  const quitar = b.querySelector(".quitar");
  if (series.length) quitar.remove();
  else quitar.addEventListener("click", () => { quitarEspera(dia.id, id); pintarDia(dia); });

  const fa = b.querySelector(".in-a"), fb = b.querySelector(".in-b"), fc = b.querySelector(".in-c"), boton = b.querySelector(".anadir");
  const modo = b.querySelector(".modo"), calc = b.querySelector(".calc"), opBilbo = b.querySelector(".bilbo-op"), chkBilbo = b.querySelector(".es-bilbo");
  let enPct = false;
  // Carrera y natación: por metros (con tiempo opcional) o por tiempo (con metros opcionales)
  const modoDist = b.querySelector(".modo-dist");
  let porTiempo = false;
  const ponerPorTiempo = t => {
    porTiempo = t;
    if (!modoDist) return;
    modoDist.textContent = t ? "min" : "m";
    modoDist.classList.toggle("activo", t);
    fa.placeholder = t ? "tiempo 40" : "metros";
    fa.inputMode = t ? "decimal" : "numeric";
    if (t) fa.removeAttribute("pattern"); else fa.setAttribute("pattern", "[0-9]*");
    fa.setAttribute("aria-label", t ? "Tiempo (minutos y segundos)" : "Distancia en metros");
    fb.placeholder = t ? "metros (opcional)" : "tiempo 3,40";
    fb.inputMode = t ? "numeric" : "decimal";
    fb.setAttribute("aria-label", t ? "Distancia en metros (opcional)" : "Tiempo (minutos y segundos)");
  };
  if (modoDist) modoDist.addEventListener("click", () => { const x = fa.value; ponerPorTiempo(!porTiempo); fa.value = fb.value; fb.value = x; fa.focus(); pintarObjetivo(); });
  if (dist) { [fa, fb, fc].forEach(x => x.addEventListener("input", pintarObjetivo)); b.querySelector(".veces").addEventListener("change", pintarObjetivo); }
  // Objetivo orientativo mientras planificas: cuenta cuántas series añades y su recuperación
  function pintarObjetivo() {
    if (!calc) return;
    if (tipo !== "carrera") { calc.textContent = ""; return; }
    const m = parseFloat(((porTiempo ? fb : fa).value || "").replace(",", ".")) || 0;
    const rec = leerRecuperacion(fc.value) || { descanso: 0, rec_dist: 0 };
    const veces = parseInt(b.querySelector(".veces").value, 10) || 1;
    const nuevas = Array.from({ length: veces }, (_, k) => ({ id: "nueva-" + k, fecha: dia.id, orden: Date.now() + k, ejercicio_id: id, distancia: m, tiempo: 0, hecha: false, descanso: rec.descanso, rec_dist: rec.rec_dist }));
    const o = objetivoSerie(nuevas[0], nuevas);
    calc.textContent = o ? "Orientativo: " + textoObjetivo(o) : "";
  }
  const pintarCalc = () => {
    if (!calc) return;
    if (dist) { pintarObjetivo(); return; }
    if (!enPct) { calc.textContent = ""; return; }
    const v = parseFloat((fa.value || "").replace(",", ".")), ref = rmReferencia(id);
    calc.textContent = !ref ? "Pon tu 1RM en la ficha del ejercicio" : v > 0 ? "= " + num(kgDePct(id, v)) + " kg (1RM " + num(ref) + ")" : "1RM de referencia: " + num(ref) + " kg";
  };
  const ponerModo = pct => {
    enPct = pct;
    if (!modo) return;
    modo.textContent = pct ? "%" : "kg";
    modo.classList.toggle("activo", pct);
    fa.placeholder = pct ? "% 1RM" : "kg";
    fa.setAttribute("aria-label", pct ? "Porcentaje del 1RM" : "Peso en kg");
    pintarCalc();
  };
  // La recuperación solo se copia de una serie de este mismo día: cada entrenamiento la ajusta
  const rellenarCon = (s, conRec) => {
    if (dist) {
      const t = !(n0(s.distancia) > 0) && n0(s.tiempo) > 0, m = n0(s.distancia) || "", ti = n0(s.tiempo) > 0 ? fmtTiempo(s.tiempo) : "";
      ponerPorTiempo(t);
      fa.value = t ? ti : m;
      fb.value = t ? m : ti;
    }
    else if (n0(s.pct) > 0 && !s.ciclo_id) { ponerModo(true); fa.value = num(s.pct); fb.value = n0(s.reps) || ""; }
    else { ponerModo(false); const kg = pesoMostrado(s); fa.value = kg > 0 ? num(kg) : ""; fb.value = n0(s.reps) || ""; }
    fc.value = conRec ? recTexto(s) : "";
    pintarCalc();
  };
  if (modo) {
    modo.addEventListener("click", () => {
      const v = parseFloat((fa.value || "").replace(",", ".")), ref = rmReferencia(id);
      if (!enPct) { ponerModo(true); fa.value = v > 0 && ref ? num(Math.round(v / ref * 100)) : ""; }
      else { const kg = v > 0 ? kgDePct(id, v) : 0; ponerModo(false); fa.value = kg ? num(kg) : ""; }
      pintarCalc();
    });
    fa.addEventListener("input", pintarCalc);
  }
  // Bilbo: si el ejercicio tiene un ciclo activo, se puede marcar la serie como Bilbo con el peso que toca
  const ciclo = dist ? null : cicloActivo(id);
  if (ciclo && opBilbo) {
    const ses = sesionesBilbo(ciclo), u = ses[ses.length - 1];
    opBilbo.hidden = false;
    opBilbo.querySelector("span").textContent = "Serie Bilbo · sesión " + (ses.length + 1) + " · " + num(pesoBilbo(id)) + " kg";
    chkBilbo.addEventListener("change", () => {
      if (chkBilbo.checked) { ponerModo(false); fa.value = num(pesoBilbo(id)); fb.value = ""; fb.placeholder = "reps máx"; fb.focus(); }
      else fb.placeholder = "reps";
    });
    if (u && u.reps > 0 && u.reps <= n0(ciclo.reps_reset)) {
      const a = document.createElement("p");
      a.className = "aviso-bilbo";
      a.textContent = "Bilbo: la última sesión fue de " + u.reps + " repeticiones. Toca resetear el ciclo (en la ficha del ejercicio).";
      b.querySelector(".series").before(a);
    }
  }
  const terminar = () => pintarBloques(true);

  const ol = b.querySelector(".series");
  let numero = 0;
  series.forEach(s => {
    numero++;
    const li = document.createElement("li");
    const planificada = !hecha(s);
    li.className = planificada ? "plan" : "";
    li.innerHTML = '<span class="n"></span><button type="button" class="sv"><span class="sv-p"></span></button><button type="button" class="borrar">✕</button>';
    const marca = li.querySelector(".n");
    if (planificada) {
      // Círculo para marcarla como hecha tal cual estaba planificada
      const c = document.createElement("button");
      c.type = "button"; c.className = "marcar"; c.textContent = "";
      c.setAttribute("aria-label", "Marcar como hecha la serie " + numero);
      c.addEventListener("click", () => {
        if (s.ciclo_id === "auto") { li.querySelector(".sv").click(); return; }   // en Bilbo hay que apuntar las repeticiones
        const h = { ...s, hecha: true, peso: pesoMostrado(s) }; cambiar("series", h); terminar(h);
      });
      marca.replaceWith(c);
    } else marca.textContent = numero;
    li.querySelector(".sv-p").textContent = serieTexto(s);
    if (descTexto(s)) { const d = document.createElement("span"); d.className = "desc"; d.textContent = descTexto(s); li.querySelector(".sv").appendChild(d); }
    if (planificada && tipo === "carrera") { const o = objetivoSerie(s); if (o) { const ob = document.createElement("span"); ob.className = "objetivo"; ob.textContent = textoObjetivo(o); li.querySelector(".sv").appendChild(ob); } }
    li.querySelector(".sv").setAttribute("aria-label", (planificada ? "Completar" : "Editar") + " serie " + numero + ": " + serieTexto(s));
    li.querySelector(".sv").addEventListener("click", () => {
      editando = s;
      rellenarCon(s, true);
      if (chkBilbo) chkBilbo.checked = !!s.ciclo_id;
      if (s.ciclo_id === "auto") { fb.value = ""; fb.placeholder = "reps máx"; }
      boton.textContent = "✓ Guardar " + numero;
      ol.querySelectorAll("li").forEach(x => x.classList.remove("editando"));
      li.classList.add("editando");
      fa.focus();
    });
    li.querySelector(".borrar").setAttribute("aria-label", "Borrar serie " + numero);
    if (prs.has(s.id)) { const p = document.createElement("span"); p.className = "pr"; p.textContent = "PR"; p.title = "Récord personal"; li.querySelector(".sv").after(p); }
    li.querySelector(".borrar").addEventListener("click", () => { cambiar("series", { ...s, borrado: true }); pintarBloques(true); });
    ol.appendChild(li);
  });

  // Rellena con la primera serie pendiente, o con la última hecha de este ejercicio
  const pendiente = series.find(s => !hecha(s)), ultDelDia = series[series.length - 1];
  const ult = pendiente || ultDelDia || historia[historia.length - 1];
  if (ult) rellenarCon(ult, ult === pendiente || ult === ultDelDia);
  else if (dist && distDeNombre(ej.nombre)) fa.value = distDeNombre(ej.nombre);
  if (chkBilbo && pendiente && pendiente.ciclo_id) { chkBilbo.checked = true; fb.value = ""; fb.placeholder = "reps máx"; }
  [fa, fb, fc].forEach((inp, k, todos) => {
    inp.addEventListener("focus", () => inp.select());
    if (k < 2) inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); todos[k + 1].focus(); } });
  });
  b.querySelector("form").addEventListener("submit", e => {
    e.preventDefault();
    const rec = leerRecuperacion(fc.value);
    if (!rec) { fc.focus(); return; }
    const fila = editando ? { ...editando } : { id: nuevoId(), fecha: dia.id, ejercicio_id: id, orden: Date.now(), grupo, meso_id: "", bloque_id: "", ronda: 0, borrado: false };
    Object.assign(fila, { peso: 0, reps: 0, distancia: 0, tiempo: 0, descanso: rec.descanso, rec_dist: rec.rec_dist, hecha: true });
    if (dist) {
      const metros = porTiempo ? fb : fa, crono = porTiempo ? fa : fb;
      fila.distancia = parseFloat(metros.value.replace(",", ".")) || 0;
      fila.tiempo = leerTiempo(crono.value);
      if (isNaN(fila.tiempo)) { crono.focus(); return; }
      if (!(fila.distancia > 0) && !(fila.tiempo > 0)) { fa.focus(); return; }
    } else {
      const v = parseFloat((fa.value.trim() || "0").replace(",", "."));
      fila.pct = enPct ? v : 0;
      fila.peso = enPct ? kgDePct(id, v) : v;
      fila.reps = parseInt(fb.value, 10);
      fila.ciclo_id = chkBilbo && chkBilbo.checked && ciclo ? ciclo.id : "";
      if (!(v >= 0) || (enPct && !fila.peso)) { fa.focus(); return; }
      if (!(fila.reps > 0)) { fb.focus(); return; }
    }
    // En días futuros se programa (queda planificada); hoy o antes se apunta como hecha
    fila.hecha = dia.id <= iso(new Date());
    const veces = editando ? 1 : parseInt(b.querySelector(".veces").value, 10) || 1;
    for (let k = 0; k < veces; k++) cambiar("series", k ? { ...fila, id: nuevoId(), orden: fila.orden + k } : fila, true);
    persistir();
    quitarEspera(dia.id, id);
    terminar(fila);
    const otra = dia.bloquesEl.querySelector('[data-ej="' + id + '"][data-grupo="' + CSS.escape(grupo) + '"] .anadir');
    if (otra) otra.focus();
  });
  return b;
}

// ---------- Bloques: tramos repetidos ×N, mostrados ronda a ronda ----------
function tarjetaBloque(dia, bloqueId, series) {
  const rondas = [...new Set(series.map(s => n0(s.ronda)))].sort((a, b) => a - b);
  const primera = series.filter(s => n0(s.ronda) === rondas[0]).sort((a, b) => a.orden - b.orden);
  const variosTramos = primera.length > 1;
  let editando = null;
  const c = document.createElement("div");
  c.className = "bloque bloque-rep";
  c.innerHTML = '<div class="bloque-cab"><span class="br-tit"></span><span class="g-prog"></span><button type="button" class="menu-btn">⋯</button></div>' +
    '<div class="rondas"></div>' +
    '<form class="nueva-serie br-form" hidden><span class="br-que"></span>' +
      '<div class="ns-fila"><input class="in-a" autocomplete="off" enterkeyhint="next"><span class="por"></span><input class="in-b" autocomplete="off" enterkeyhint="next"></div>' +
      '<div class="ns-fila"><input class="in-c" inputmode="decimal" placeholder="⏱ recuperación 2,00 o 300 m" aria-label="Recuperación (tiempo o metros)" autocomplete="off" enterkeyhint="done">' +
      '<button class="anadir">✓ Guardar</button></div></form>';
  c.querySelector(".br-tit").textContent = "Bloque ×" + rondas.length + " · " + primera.map(s => nombreEj(s.ejercicio_id)).join(" + ");
  c.querySelector(".g-prog").textContent = series.filter(hecha).length + "/" + series.length;
  const menu = c.querySelector(".menu-btn");
  menu.setAttribute("aria-label", "Opciones del bloque");
  menu.addEventListener("click", () => {
    const ultima = series.filter(s => n0(s.ronda) === rondas[rondas.length - 1]);
    abrirMenu("Bloque ×" + rondas.length, primera.map(s => nombreEj(s.ejercicio_id)).join(" + "), [
      { texto: "Añadir una ronda", accion: () => {
        let orden = Date.now();
        ultima.sort((a, b) => a.orden - b.orden).forEach(s => cambiar("series", { ...s, id: nuevoId(), orden: orden++, ronda: n0(s.ronda) + 1, hecha: false, meso_id: s.meso_id || "" }, true));
        persistir(); pintarDia(dia);
      } },
      rondas.length > 1 && { texto: "Quitar la última ronda", accion: () => { ultima.forEach(s => cambiar("series", { ...s, borrado: true }, true)); persistir(); pintarDia(dia); } },
      { texto: "Copiar bloque", accion: () => copiar("Bloque ×" + rondas.length, "", series) },
      { texto: "Compartir con un amigo…", accion: () => compartir("Bloque ×" + rondas.length + " · " + primera.map(s => nombreEj(s.ejercicio_id)).join(" + "), itemsDe(series)) },
      { texto: "Quitar bloque", peligro: true, confirmar: "Pulsa otra vez: se borran " + series.length + " series", accion: () => {
        series.forEach(s => cambiar("series", { ...s, borrado: true }, true)); persistir(); pintarDia(dia);
      } }
    ]);
  });

  const form = c.querySelector("form"), fa = c.querySelector(".in-a"), fb = c.querySelector(".in-b"), fc = c.querySelector(".in-c");
  const prs = {};
  primera.forEach(s => { if (!prs[s.ejercicio_id]) prs[s.ejercicio_id] = prsDe(seriesDe(s.ejercicio_id), tipoDe(s.ejercicio_id)); });
  const editar = (s, li) => {
    editando = s;
    const dist = esDistancia(tipoDe(s.ejercicio_id));
    c.querySelector(".br-que").textContent = "R" + n0(s.ronda) + " · " + nombreEj(s.ejercicio_id);
    fa.placeholder = dist ? "metros" : "kg"; fa.inputMode = dist ? "numeric" : "decimal"; fa.setAttribute("aria-label", dist ? "Distancia en metros" : "Peso en kg");
    fb.placeholder = dist ? "tiempo 3,40" : "reps"; fb.inputMode = dist ? "decimal" : "numeric"; fb.setAttribute("aria-label", dist ? "Tiempo (minutos y segundos)" : "Repeticiones");
    c.querySelector(".por").textContent = dist ? "" : "×";
    if (dist) { fa.value = n0(s.distancia) || ""; fb.value = n0(s.tiempo) > 0 ? fmtTiempo(s.tiempo) : ""; }
    else { fa.value = pesoMostrado(s) > 0 ? num(pesoMostrado(s)) : ""; fb.value = n0(s.reps) || ""; }
    fc.value = recTexto(s);
    c.querySelectorAll("li").forEach(x => x.classList.remove("editando"));
    li.classList.add("editando");
    form.hidden = false;
    (dist && n0(s.distancia) > 0 ? fb : fa).focus();
  };
  const terminar = () => pintarBloques(true);

  const cont = c.querySelector(".rondas");
  rondas.forEach(r => {
    const fila = document.createElement("div");
    fila.className = "ronda";
    fila.innerHTML = '<span class="r-lab"></span><ol class="series"></ol>';
    fila.querySelector(".r-lab").textContent = "R" + r;
    const ol = fila.querySelector("ol");
    series.filter(s => n0(s.ronda) === r).sort((a, b) => a.orden - b.orden).forEach(s => {
      const li = document.createElement("li");
      li.className = hecha(s) ? "" : "plan";
      li.innerHTML = '<span class="n">✓</span><button type="button" class="sv"><span class="sv-p"></span></button>';
      if (!hecha(s)) {
        const m = document.createElement("button");
        m.type = "button"; m.className = "marcar";
        m.setAttribute("aria-label", "Marcar como hecho: ronda " + r + ", " + nombreEj(s.ejercicio_id));
        m.addEventListener("click", () => { const h = { ...s, hecha: true, peso: pesoMostrado(s) }; cambiar("series", h); terminar(h); });
        li.querySelector(".n").replaceWith(m);
      }
      li.querySelector(".sv-p").textContent = (variosTramos ? nombreEj(s.ejercicio_id) + " · " : "") + serieTexto(s);
      if (descTexto(s)) { const d = document.createElement("span"); d.className = "desc"; d.textContent = descTexto(s); li.querySelector(".sv").appendChild(d); }
      if (!hecha(s) && tipoDe(s.ejercicio_id) === "carrera") { const o = objetivoSerie(s); if (o) { const ob = document.createElement("span"); ob.className = "objetivo"; ob.textContent = textoObjetivo(o); li.querySelector(".sv").appendChild(ob); } }
      li.querySelector(".sv").setAttribute("aria-label", "Apuntar ronda " + r + ", " + nombreEj(s.ejercicio_id) + ": " + serieTexto(s));
      li.querySelector(".sv").addEventListener("click", () => editar(s, li));
      if (prs[s.ejercicio_id] && prs[s.ejercicio_id].has(s.id)) { const p = document.createElement("span"); p.className = "pr"; p.textContent = "PR"; li.appendChild(p); }
      ol.appendChild(li);
    });
    cont.appendChild(fila);
  });

  [fa, fb].forEach((inp, k) => inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); (k ? fc : fb).focus(); } }));
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!editando) return;
    const rec = leerRecuperacion(fc.value);
    if (!rec) { fc.focus(); return; }
    const fila = { ...editando, descanso: rec.descanso, rec_dist: rec.rec_dist, hecha: dia.id <= iso(new Date()) };
    if (esDistancia(tipoDe(fila.ejercicio_id))) {
      fila.distancia = parseFloat(fa.value.replace(",", ".")) || 0;
      fila.tiempo = leerTiempo(fb.value);
      if (isNaN(fila.tiempo)) { fb.focus(); return; }
      if (!(fila.distancia > 0) && !(fila.tiempo > 0)) { fa.focus(); return; }
    } else {
      fila.peso = parseFloat((fa.value.trim() || "0").replace(",", "."));
      fila.reps = parseInt(fb.value, 10);
      if (!(fila.peso >= 0)) { fa.focus(); return; }
      if (!(fila.reps > 0)) { fb.focus(); return; }
    }
    cambiar("series", fila);
    terminar(fila);
  });
  return c;
}

// Ventana para crear un bloque: tramos (con sus valores y recuperación) y número de rondas
let diaBloque = null, tramos = [];
function abrirBloque(dia) {
  diaBloque = dia;
  tramos = [];
  $("blqRondas").value = "4";
  $("blqAviso").textContent = "";
  pintarTramos();
  $("dlgBloque").showModal();
}
function pintarTramos() {
  const cont = $("blqTramos");
  cont.textContent = "";
  if (!tramos.length) { const p = document.createElement("p"); p.className = "vacio-lista"; p.textContent = "Añade el primer tramo: por ejemplo «Series 1000 m», o «Press banca» y luego «Remo» para una superserie."; cont.appendChild(p); }
  tramos.forEach((t, k) => {
    const dist = esDistancia(tipoDe(t.ejercicio_id));
    const fila = document.createElement("div");
    fila.className = "tramo";
    fila.innerHTML = '<div class="tr-cab"><span class="tr-n"></span><button type="button" class="quitar">✕</button></div>' +
      '<div class="ns-fila"><input class="in-a" autocomplete="off"><span class="por"></span><input class="in-b" autocomplete="off"></div>' +
      '<input class="in-c" inputmode="decimal" autocomplete="off" placeholder="⏱ recuperación después: 2,00 o 300 m" aria-label="Recuperación después de este tramo (tiempo o metros)">';
    fila.querySelector(".tr-n").textContent = (k + 1) + ". " + nombreEj(t.ejercicio_id);
    fila.querySelector(".tr-n").appendChild(etiquetaTipo(tipoDe(t.ejercicio_id)));
    const [a, b, cc] = [".in-a", ".in-b", ".in-c"].map(x => fila.querySelector(x));
    a.placeholder = dist ? "metros" : "kg"; a.inputMode = dist ? "numeric" : "decimal"; a.setAttribute("aria-label", dist ? "Distancia en metros" : "Peso en kg");
    b.placeholder = dist ? "tiempo" : "reps"; b.inputMode = dist ? "decimal" : "numeric"; b.setAttribute("aria-label", dist ? "Tiempo (puedes dejar los metros vacíos)" : "Repeticiones");
    fila.querySelector(".por").textContent = dist ? "" : "×";
    a.value = t.a; b.value = t.b; cc.value = t.c;
    a.addEventListener("input", () => { t.a = a.value; });
    b.addEventListener("input", () => { t.b = b.value; });
    cc.addEventListener("input", () => { t.c = cc.value; });
    const q = fila.querySelector(".quitar");
    q.setAttribute("aria-label", "Quitar el tramo " + (k + 1));
    q.addEventListener("click", () => { tramos.splice(k, 1); pintarTramos(); });
    cont.appendChild(fila);
  });
}
$("blqAnadir").addEventListener("click", () => abrirSelector(diaBloque, id => {
  const h = seriesDe(id), u = h[h.length - 1];
  const dist = esDistancia(tipoDe(id));
  tramos.push({ ejercicio_id: id,
    a: u ? String(dist ? n0(u.distancia) || "" : (n0(u.peso) > 0 ? num(u.peso) : "")) : (dist && distDeNombre(nombreEj(id)) ? String(distDeNombre(nombreEj(id))) : ""),
    b: u ? (dist ? (n0(u.tiempo) > 0 ? fmtTiempo(u.tiempo) : "") : String(n0(u.reps) || "")) : "",
    c: "" });   // la recuperación no se arrastra de otros días
  pintarTramos();
}));
$("blqCrear").addEventListener("click", () => {
  const rondas = parseInt($("blqRondas").value, 10), aviso = $("blqAviso");
  if (!tramos.length) { aviso.textContent = "Añade al menos un tramo."; return; }
  if (!(rondas >= 1 && rondas <= 50)) { aviso.textContent = "Las rondas deben estar entre 1 y 50."; return; }
  const lista = [];
  for (const [k, t] of tramos.entries()) {
    const rec = leerRecuperacion(t.c);
    if (!rec) { aviso.textContent = "Revisa la recuperación del tramo " + (k + 1) + " (por ejemplo 2,00 o 300 m)."; return; }
    const v = { peso: 0, reps: 0, distancia: 0, tiempo: 0, descanso: rec.descanso, rec_dist: rec.rec_dist };
    if (esDistancia(tipoDe(t.ejercicio_id))) {
      v.distancia = parseFloat(String(t.a).replace(",", ".")) || 0;
      v.tiempo = leerTiempo(t.b);
      if (isNaN(v.tiempo)) { aviso.textContent = "Revisa el tiempo del tramo " + (k + 1) + " (por ejemplo 3,40)."; return; }
      if (!(v.distancia > 0) && !(v.tiempo > 0)) { aviso.textContent = "Pon los metros o el tiempo del tramo " + (k + 1) + "."; return; }
    } else {
      v.peso = parseFloat((String(t.a).trim() || "0").replace(",", "."));
      v.reps = parseInt(t.b, 10);
      if (!(v.peso >= 0)) { aviso.textContent = "Revisa el peso del tramo " + (k + 1) + "."; return; }
      if (!(v.reps > 0)) { aviso.textContent = "Pon las repeticiones del tramo " + (k + 1) + "."; return; }
    }
    lista.push({ ejercicio_id: t.ejercicio_id, series: Array.from({ length: rondas }, () => ({ ...v })) });
  }
  pegarItems(diaBloque.id, [{ bloque: true, grupo: "", tramos: lista }]);
  persistir();
  $("dlgBloque").close();
  pintarDia(diaBloque);
});

// ---------- Elegir o crear ejercicio ----------
let diaSelector = null, alElegirSel = null;
// Tipo de entrenamiento elegido en el buscador ("" = todos): solo se ven y se crean ejercicios de ese tipo
let tipoSel = leer("tipo-sel-v1") || "";
function pintarFiltroTipo() {
  $("selTipo").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tipo === tipoSel)));
}
$("selTipo").addEventListener("click", ev => {
  const b = ev.target.closest("button[data-tipo]");
  if (!b) return;
  tipoSel = b.dataset.tipo;
  escribir("tipo-sel-v1", tipoSel);
  pintarFiltroTipo();
  pintarSelector();
  $("buscarEj").focus();
});
function crearEjercicio(nombre, tipo) {
  const id = nuevoId();
  cambiar("ejercicios", { id, nombre: nombre.trim(), tipo: TIPOS[tipo] ? tipo : "fuerza", video_url: "", notas: "", borrado: false });
  return id;
}
function abrirSelector(dia, alElegir) {
  diaSelector = dia;
  alElegirSel = alElegir || null;
  // Si el día ya tiene ejercicios de un solo tipo, el buscador se abre en ese tipo
  const tiposDia = dia ? [...new Set(seriesDelDia(dia.id).map(s => s.ejercicio_id).concat(enEspera[dia.id] || []).map(tipoDe))] : [];
  if (tiposDia.length === 1) tipoSel = tiposDia[0];
  pintarFiltroTipo();
  $("buscarEj").value = "";
  pintarSelector();
  $("selector").showModal();
  $("buscarEj").focus();
}
function elegir(id) {
  const dia = diaSelector;
  $("selector").close();
  if (alElegirSel) { const f = alElegirSel; alElegirSel = null; f(id); return; }
  const yaTiene = seriesVivas().some(s => s.fecha === dia.id && s.ejercicio_id === id);
  if (!yaTiene) { enEspera[dia.id] = (enEspera[dia.id] || []).filter(x => x !== id).concat(id); guardarEspera(); }
  pintarDia(dia);
  const inp = dia.bloquesEl.querySelector('[data-ej="' + id + '"] .in-a');
  if (inp) { inp.scrollIntoView({ block: "center", behavior: "smooth" }); inp.focus(); }
}
function pintarSelector() {
  const q = $("buscarEj").value.trim(), lista = $("listaEj");
  lista.textContent = "";
  const ejs = ejerciciosOrdenados().filter(e => compacto(e.nombre).includes(compacto(q)) && (!tipoSel || tipoDe(e.id) === tipoSel));
  // «300», «300m» o «series 300 m» propone directamente «Series 300 m» de carrera
  const md = q.match(/^(?:series\s*(?:de\s*)?)?(\d+(?:[.,]\d+)?)\s*(m|km|metros)?$/i);
  const sugerencia = md ? "Series " + md[1] + " " + (md[2] && md[2].toLowerCase() === "km" ? "km" : "m") : "";
  if (sugerencia && (!tipoSel || tipoSel === "carrera") && !vivos("ejercicios").some(e => compacto(e.nombre) === compacto(sugerencia))) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opcion crear-dist";
    b.textContent = "+ Crear «" + sugerencia + "» (carrera)";
    b.addEventListener("click", () => elegir(crearEjercicio(sugerencia, "carrera")));
    lista.appendChild(b);
  }
  if (q && !ejs.some(e => compacto(e.nombre) === compacto(q)) && !SUGERIDOS.some(([n]) => compacto(n) === compacto(q))) {
    // Crear: el tipo que parece por el nombre va primero y resaltado
    const fila = document.createElement("div");
    fila.className = "crear-fila";
    const sugerido = tipoSel || adivinarTipo(q);
    const t = document.createElement("button");
    t.type = "button";
    t.className = "cf-t";
    t.textContent = "+ Crear «" + q + "» (" + TIPOS[sugerido].nombre.toLowerCase() + ")" + (tipoSel ? "" : " · o elige el tipo:");
    t.addEventListener("click", () => elegir(crearEjercicio(q, sugerido)));
    fila.appendChild(t);
    (tipoSel ? [] : [sugerido].concat(Object.keys(TIPOS).filter(k => k !== sugerido))).forEach(k => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opcion-tipo t-" + k + (k === sugerido ? " sugerido" : "");
      b.textContent = TIPOS[k].nombre;
      b.addEventListener("click", () => elegir(crearEjercicio(q, k)));
      fila.appendChild(b);
    });
    lista.appendChild(fila);
  }
  ejs.forEach(e => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opcion";
    b.textContent = e.nombre;
    b.appendChild(etiquetaTipo(tipoDe(e.id)));
    b.addEventListener("click", () => elegir(e.id));
    lista.appendChild(b);
  });
  const tengo = new Set(vivos("ejercicios").map(e => compacto(e.nombre)));
  const sug = SUGERIDOS.filter(([n, tipo]) => !tengo.has(compacto(n)) && compacto(n).includes(compacto(q)) && (!tipoSel || tipo === tipoSel));
  if (sug.length) {
    const h = document.createElement("p");
    h.className = "sug-tit";
    h.textContent = "Sugerencias";
    lista.appendChild(h);
    sug.forEach(([n, tipo]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opcion sugerida";
      b.textContent = n;
      b.appendChild(etiquetaTipo(tipo));
      b.addEventListener("click", () => elegir(crearEjercicio(n, tipo)));
      lista.appendChild(b);
    });
  }
  if (!lista.children.length) {
    const p = document.createElement("p");
    p.className = "vacio-lista";
    p.textContent = "Escribe el nombre del ejercicio (por ejemplo, Press banca, Series 1000 m o Crol) para crearlo.";
    lista.appendChild(p);
  }
}
$("buscarEj").addEventListener("input", pintarSelector);
$("buscarEj").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); const primera = $("listaEj").querySelector(".opcion-tipo, .opcion"); if (primera) primera.click(); }
});

// ---------- Catálogo de ejercicios ----------
function pintarCatalogo() {
  const cont = $("catalogo"), q = $("filtroEj").value.trim();
  cont.textContent = "";
  const ejs = ejerciciosOrdenados().filter(e => compacto(e.nombre).includes(compacto(q)));
  if (!ejs.length) {
    const p = document.createElement("p");
    p.className = "vacio-lista";
    p.textContent = q ? "No hay ningún ejercicio con ese nombre. Pulsa «+ Nuevo» para crearlo."
                      : "Aún no tienes ejercicios. Añádelos desde un día con «+ Ejercicio» o pulsa «+ Nuevo».";
    cont.appendChild(p);
    return;
  }
  ejs.forEach(e => {
    const st = estadisticas(e.id);
    const t = document.createElement("button");
    t.type = "button";
    t.className = "tarjeta";
    t.innerHTML = '<span class="t-nombre"></span><span class="t-mejor"></span><span class="t-ultima"></span>';
    const nombre = t.querySelector(".t-nombre");
    nombre.textContent = e.nombre || "Sin nombre";
    nombre.appendChild(etiquetaTipo(st.tipo));
    if (e.video_url) { const v = document.createElement("span"); v.className = "ico"; v.textContent = "▶ vídeo"; nombre.appendChild(v); }
    t.querySelector(".t-mejor").textContent = st.resumen;
    t.querySelector(".t-ultima").textContent = st.ultima;
    if (!st.ultima) t.querySelector(".t-ultima").remove();
    t.addEventListener("click", () => abrirDetalle(e.id));
    cont.appendChild(t);
  });
}
$("filtroEj").addEventListener("input", pintarCatalogo);
$("nuevoEj").addEventListener("click", () => {
  const nombre = $("filtroEj").value.trim() || "Nuevo ejercicio";
  const id = crearEjercicio(nombre, adivinarTipo(nombre));
  pintarCatalogo();
  abrirDetalle(id);
  $("detNombre").select();
});

// ---------- Ficha del ejercicio: tipo, vídeo, récords, progreso e historial ----------
let detalleId = null;
function idYoutube(u) {
  try {
    const x = new URL(u);
    if (/(^|\.)youtu\.be$/.test(x.hostname)) return x.pathname.slice(1).split("/")[0] || null;
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(x.hostname)) {
      if (x.searchParams.get("v")) return x.searchParams.get("v");
      const m = x.pathname.match(/\/(shorts|embed|live)\/([\w-]+)/);
      if (m) return m[2];
    }
  } catch {}
  return null;
}
function pintarVideo(e) {
  const cont = $("detEmbed");
  cont.textContent = "";
  const yt = idYoutube(e.video_url);
  if (yt) {
    const w = document.createElement("div"); w.className = "video";
    const f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(yt) + "?playsinline=1&rel=0";
    f.title = "Vídeo: " + e.nombre;
    f.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    f.allowFullscreen = true;
    f.referrerPolicy = "strict-origin-when-cross-origin";   // YouTube necesita saber desde qué web se reproduce
    w.appendChild(f); cont.appendChild(w);
    const a = document.createElement("a");
    a.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(yt); a.target = "_blank"; a.rel = "noopener"; a.className = "enlace";
    a.textContent = "Abrir en YouTube";
    cont.appendChild(a);
  } else if (/^https?:\/\//i.test(e.video_url)) {
    const a = document.createElement("a");
    a.href = e.video_url; a.target = "_blank"; a.rel = "noopener"; a.className = "abrir-video";
    a.textContent = "▶ Abrir vídeo";
    cont.appendChild(a);
  }
  $("detBuscar").href = "https://www.youtube.com/results?search_query=" + encodeURIComponent((e.nombre || "") + " técnica");
}
function recuadro(etiqueta, valor, sub, oro) {
  const d = document.createElement("div");
  d.className = "rec" + (oro ? " oro" : "");
  d.innerHTML = '<span class="r-et"></span><span class="r-val"></span><span class="r-sub"></span>';
  d.querySelector(".r-et").textContent = etiqueta;
  d.querySelector(".r-val").textContent = valor;
  d.querySelector(".r-sub").textContent = sub || "";
  return d;
}
function grafica(puntos, etiqueta) {
  if (puntos.length < 2) return '<p class="vacio-lista">La gráfica aparece cuando tengas dos sesiones o más.</p>';
  const W = 320, H = 130, pl = 6, pr = 6, pt = 18, pb = 22;
  const vals = puntos.map(p => p.v);
  let min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  if (max === min) { min -= 1; max += 1; }
  const x = i => pl + i * (W - pl - pr) / (puntos.length - 1);
  const y = v => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
  const linea = puntos.map((p, i) => x(i).toFixed(1) + "," + y(p.v).toFixed(1)).join(" ");
  const area = "M" + x(0).toFixed(1) + "," + (H - pb) + " L" + linea.split(" ").join(" L") + " L" + x(puntos.length - 1).toFixed(1) + "," + (H - pb) + " Z";
  let svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="graf" role="img" aria-label="Progreso por sesión">';
  svg += '<line class="g-rejilla" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(max) + '" y2="' + y(max) + '"/>';
  svg += '<line class="g-rejilla" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + (H - pb) + '" y2="' + (H - pb) + '"/>';
  svg += '<path class="g-area" d="' + area + '"/><polyline class="g-linea" points="' + linea + '"/>';
  puntos.forEach((p, i) => { svg += '<circle class="' + (i === puntos.length - 1 ? "g-fin" : "g-punto") + '" cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="' + (i === puntos.length - 1 ? 4.5 : 3) + '"/>'; });
  svg += '<text class="g-txt" x="' + pl + '" y="' + (y(max) - 5) + '">' + etiqueta(Math.max.apply(null, vals)) + "</text>";
  svg += '<text class="g-txt" x="' + pl + '" y="' + (H - 6) + '">' + fechaCorta(puntos[0].f) + "</text>";
  svg += '<text class="g-txt" x="' + (W - pr) + '" y="' + (H - 6) + '" text-anchor="end">' + fechaCorta(puntos[puntos.length - 1].f) + "</text>";
  return svg + "</svg>";
}
function refrescarDetalle() {
  const e = ejercicioVivo(detalleId);
  if (!e) { if ($("detalle").open) $("detalle").close(); return; }
  const st = estadisticas(e.id), tipo = st.tipo;
  $("detTipo").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tipo === tipo)));
  const fuerza = tipo === "fuerza";
  $("detRmSec").hidden = !fuerza;
  $("detBilboSec").hidden = !fuerza;
  if (fuerza) {
    if (document.activeElement !== $("detRm")) $("detRm").value = n0(e.rm) > 0 ? num(e.rm) : "";
    const p = st.lista.filter(s => n0(s.peso) > 0);
    $("detRmEst").textContent = p.length ? "Estimado con tus series: " + num(Math.round(Math.max.apply(null, p.map(rm)))) + " kg" + (n0(e.rm) > 0 ? "" : " (se usa este)")
                                         : "Ponlo para que las series en % del RM calculen los kg.";
    pintarBilbo(e);
  }
  const rec = $("detRecords"), marcas = $("detMarcas");
  rec.textContent = ""; marcas.textContent = "";
  let puntos = [], etiqueta = v => num(v);
  if (!st.lista.length) {
    rec.innerHTML = '<p class="vacio-lista">Aún no hay series hechas. Añádelas desde un día de la semana con «+ Ejercicio».</p>';
    $("detGraficaTit").textContent = "Progreso";
  } else if (esDistancia(tipo)) {
    if (st.mejorRitmo) rec.appendChild(recuadro("Mejor ritmo", ritmo(st.mejorRitmo, tipo), fmtDist(st.mejorRitmo.distancia) + " en " + fmtTiempo(st.mejorRitmo.tiempo) + " · " + fechaCorta(st.mejorRitmo.fecha), true));
    rec.appendChild(recuadro("Distancia total", fmtDist(st.total), st.sesiones.length + " sesiones · " + st.lista.length + " series"));
    if (st.tiempoTotal > 0) rec.appendChild(recuadro("Tiempo total", fmtTiempo(st.tiempoTotal), ""));
    (st.marcas || []).forEach(s => {
      const li = document.createElement("li");
      li.innerHTML = '<span class="m-d"></span><span class="m-t"></span><span class="m-f"></span>';
      li.querySelector(".m-d").textContent = fmtDist(s.distancia);
      li.querySelector(".m-t").textContent = fmtTiempo(s.tiempo) + " · " + ritmo(s, tipo);
      li.querySelector(".m-f").textContent = fechaCorta(s.fecha);
      marcas.appendChild(li);
    });
    const km = tipo === "carrera";
    $("detGraficaTit").textContent = "Progreso · distancia por sesión";
    puntos = st.sesiones.slice(-12).map(s => ({ f: s.fecha, v: s.series.reduce((a, x) => a + n0(x.distancia), 0) / (km ? 1000 : 1) }));
    etiqueta = v => km ? num(Math.round(v * 100) / 100) + " km" : num(Math.round(v)) + " m";
  } else if (st.mejor) {
    rec.appendChild(recuadro("Peso máximo", num(st.mejor.peso) + " kg", "× " + n0(st.mejor.reps) + " · " + fechaCorta(st.mejor.fecha), true));
    rec.appendChild(recuadro("1RM estimado", num(Math.round(rm(st.mejorRm))) + " kg", serieTexto(st.mejorRm) + " · " + fechaCorta(st.mejorRm.fecha)));
    rec.appendChild(recuadro("Sesiones", String(st.sesiones.length), st.lista.length + " series"));
    $("detGraficaTit").textContent = "Progreso · 1RM estimado";
    puntos = st.sesiones.slice(-12).map(s => ({ f: s.fecha, v: Math.max.apply(null, s.series.filter(x => n0(x.peso) > 0).map(rm).concat(0)) }));
    etiqueta = v => num(Math.round(v * 10) / 10) + " kg";
  } else {
    rec.appendChild(recuadro("Más repeticiones", n0(st.mejorReps.reps) + " reps", fechaCorta(st.mejorReps.fecha), true));
    rec.appendChild(recuadro("Sesiones", String(st.sesiones.length), st.lista.length + " series"));
    $("detGraficaTit").textContent = "Progreso · repeticiones";
    puntos = st.sesiones.slice(-12).map(s => ({ f: s.fecha, v: Math.max.apply(null, s.series.map(x => n0(x.reps))) }));
    etiqueta = v => num(v) + " reps";
  }
  $("detGrafica").innerHTML = st.lista.length ? grafica(puntos, etiqueta) : "";
  const hist = $("detHistorial"), prs = prsDe(st.lista, tipo);
  hist.textContent = "";
  st.sesiones.slice().reverse().forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = '<span class="h-f"></span><span class="h-s"></span>';
    li.querySelector(".h-f").textContent = fechaCorta(s.fecha);
    s.series.sort((a, b) => a.orden - b.orden).forEach(x => {
      const sp = document.createElement("span");
      sp.textContent = serieTexto(x) + (prs.has(x.id) ? " · PR" : "");
      if (prs.has(x.id)) sp.className = "es-pr";
      if (descTexto(x)) { const d = document.createElement("span"); d.className = "desc"; d.textContent = " · " + descTexto(x); sp.appendChild(d); }
      li.querySelector(".h-s").appendChild(sp);
    });
    hist.appendChild(li);
  });
}
// Bilbo en la ficha: ciclo activo con su tabla, aviso de reseteo y ciclos anteriores
let bilboReset = false;
function pintarBilbo(e) {
  const cont = $("detBilbo"), c = cicloActivo(e.id);
  cont.textContent = "";
  const anteriores = vivos("ciclos").filter(x => x.ejercicio_id === e.id && x.cerrado).sort((a, b) => n0(b.numero) - n0(a.numero));
  if (!c || bilboReset) {
    const ref = c ? Math.round(Math.max.apply(null, sesionesBilbo(c).map(x => rmBilbo(x.peso, x.reps)).concat(n0(c.rm_inicio)))) : rmReferencia(e.id);
    const f = document.createElement("div");
    f.className = "bilbo-form";
    f.innerHTML = '<p class="vacio-lista"></p>' +
      '<div class="fila"><label class="campo">1RM para este ciclo (kg) <input class="b-rm" inputmode="decimal"></label>' +
      '<label class="campo">Sube cada sesión (kg) <input class="b-inc" inputmode="decimal"></label>' +
      '<label class="campo">Resetear al bajar a (reps) <input class="b-reset" inputmode="numeric"></label></div>' +
      '<p class="b-calc menu-det"></p>' +
      '<div class="d-botones"><button type="button" class="nav-btn b-cancelar">Cancelar</button><button type="button" class="anadir b-ok"></button></div>';
    f.querySelector("p").textContent = c
      ? "Nuevo ciclo: se cierra el ciclo " + c.numero + " y vuelves a empezar con el 50 % del 1RM. Te propongo el mejor 1RM estimado de este ciclo."
      : "Bilbo: una serie al fallo con el 50 % de tu 1RM, subiendo de peso cada sesión. Cuando las repeticiones bajen al límite, reseteas con tu nuevo 1RM.";
    const [irm, iinc, ires] = [".b-rm", ".b-inc", ".b-reset"].map(x => f.querySelector(x));
    irm.value = ref ? num(ref) : "";
    iinc.value = num(c ? c.incremento : 2.5);
    ires.value = c ? c.reps_reset : 15;
    const calcular = () => { const v = parseFloat(irm.value.replace(",", ".")); f.querySelector(".b-calc").textContent = v > 0 ? "Empezarás con " + num(redondear(v / 2)) + " kg." : ""; };
    irm.addEventListener("input", calcular);
    calcular();
    f.querySelector(".b-cancelar").hidden = !c;
    f.querySelector(".b-cancelar").addEventListener("click", () => { bilboReset = false; pintarBilbo(e); });
    f.querySelector(".b-ok").textContent = c ? "Resetear y empezar el ciclo " + (n0(c.numero) + 1) : "Empezar Bilbo";
    f.querySelector(".b-ok").addEventListener("click", () => {
      const v = parseFloat(irm.value.replace(",", ".")), inc = parseFloat(iinc.value.replace(",", ".")), lim = parseInt(ires.value, 10);
      if (!(v > 0)) { irm.focus(); return; }
      if (!(inc > 0)) { iinc.focus(); return; }
      if (!(lim > 0)) { ires.focus(); return; }
      if (c) cambiar("ciclos", { ...c, cerrado: true }, true);
      const numero = c ? n0(c.numero) + 1 : (anteriores.length ? n0(anteriores[0].numero) + 1 : 1);
      cambiar("ciclos", { id: nuevoId(), ejercicio_id: e.id, numero, rm_inicio: v, peso_inicial: redondear(v / 2), incremento: inc, reps_reset: lim, importadas: [], cerrado: false, borrado: false }, true);
      persistir();
      bilboReset = false;
      refrescarDetalle();
    });
    cont.appendChild(f);
  } else {
    const ses = sesionesBilbo(c), u = ses[ses.length - 1];
    const cab = document.createElement("div");
    cab.className = "bilbo-cab";
    cab.innerHTML = '<span class="bc-t"></span><span class="bc-s"></span>';
    cab.querySelector(".bc-t").textContent = "Ciclo " + c.numero + " · próxima sesión " + (ses.length + 1) + ": " + num(pesoBilbo(e.id)) + " kg × máx";
    cab.querySelector(".bc-s").textContent = "Empezó en " + num(c.peso_inicial) + " kg (1RM " + num(c.rm_inicio) + ") · +" + num(c.incremento) + " kg por sesión · resetear al bajar a " + c.reps_reset + " reps";
    cont.appendChild(cab);
    if (u && u.reps > 0 && u.reps <= n0(c.reps_reset)) {
      const a = document.createElement("p");
      a.className = "aviso-bilbo";
      a.textContent = "La última sesión fue de " + u.reps + " repeticiones: es momento de resetear.";
      cont.appendChild(a);
    }
    cont.appendChild(tablaBilbo(ses));
    const b = document.createElement("button");
    b.type = "button";
    b.className = "nav-btn";
    b.textContent = "Resetear Bilbo (nuevo ciclo)";
    b.addEventListener("click", () => { bilboReset = true; pintarBilbo(e); });
    cont.appendChild(b);
  }
  anteriores.forEach(x => {
    const ses = sesionesBilbo(x);
    const d = document.createElement("details");
    d.className = "bilbo-ant";
    d.innerHTML = "<summary></summary>";
    const mt = ses.length ? Math.max.apply(null, ses.map(s => s.peso * s.reps)) : 0;
    const mr = ses.length ? Math.max.apply(null, ses.map(s => rmBilbo(s.peso, s.reps))) : 0;
    d.querySelector("summary").textContent = "Ciclo " + x.numero + " · " + ses.length + " sesiones · récord trabajo " + num(mt) + " · récord 1RM " + num(Math.round(mr * 10) / 10) + " kg";
    d.appendChild(tablaBilbo(ses));
    cont.appendChild(d);
  });
}
function tablaBilbo(ses) {
  const caja = document.createElement("div");
  caja.className = "tabla-scroll";
  if (!ses.length) {
    const p = document.createElement("p");
    p.className = "vacio-lista";
    p.textContent = "Aún no hay sesiones. En un día de la semana, añade este ejercicio y marca «Serie Bilbo».";
    caja.appendChild(p);
    return caja;
  }
  const t = document.createElement("table");
  t.className = "tabla-bilbo";
  t.innerHTML = "<thead><tr><th>#</th><th>Fecha</th><th>Kg</th><th>Reps</th><th>Trabajo</th><th>1RM</th></tr></thead><tbody></tbody><tfoot><tr><td colspan=\"3\">Acumulado</td><td></td><td></td><td></td></tr></tfoot>";
  const mt = Math.max.apply(null, ses.map(s => s.peso * s.reps)), mr = Math.max.apply(null, ses.map(s => rmBilbo(s.peso, s.reps)));
  ses.forEach((s, i) => {
    const tr = document.createElement("tr"), trabajo = s.peso * s.reps, erm = rmBilbo(s.peso, s.reps);
    [i + 1, s.fecha ? fechaCorta(s.fecha) : "—", num(s.peso), s.reps, num(trabajo), num(Math.round(erm * 10) / 10)].forEach((v, k) => {
      const td = document.createElement("td");
      td.textContent = v;
      if ((k === 4 && trabajo === mt) || (k === 5 && erm === mr)) td.className = "es-pr";
      tr.appendChild(td);
    });
    t.querySelector("tbody").appendChild(tr);
  });
  const pie = t.querySelectorAll("tfoot td");
  pie[1].textContent = ses.reduce((a, s) => a + s.reps, 0);
  pie[2].textContent = num(ses.reduce((a, s) => a + s.peso * s.reps, 0));
  caja.appendChild(t);
  return caja;
}
$("detRm").addEventListener("change", () => {
  const v = parseFloat(($("detRm").value || "0").replace(",", "."));
  editarEjercicio({ rm: v > 0 ? v : 0 });
  refrescarDetalle();
});

function abrirDetalle(id) {
  const e = ejercicioVivo(id);
  if (!e) return;
  detalleId = id;
  bilboReset = false;
  $("detNombre").value = e.nombre;
  $("detVideo").value = e.video_url;
  $("detNotas").value = e.notas || "";
  $("detBorrar").classList.remove("confirmar");
  $("detBorrar").textContent = "Eliminar ejercicio";
  pintarVideo(e);
  refrescarDetalle();
  if (!$("detalle").open) $("detalle").showModal();
  $("detalle").scrollTop = 0;
}
const editarEjercicio = cambios => { const e = ejercicioVivo(detalleId); if (e) cambiar("ejercicios", { ...e, ...cambios }); };
$("detTipo").addEventListener("click", ev => {
  const b = ev.target.closest("button[data-tipo]");
  if (!b) return;
  editarEjercicio({ tipo: b.dataset.tipo });
  refrescarDetalle();
});
$("detNombre").addEventListener("change", () => {
  const n = $("detNombre").value.trim();
  if (!n) { $("detNombre").value = db.ejercicios[detalleId].nombre; return; }
  editarEjercicio({ nombre: n });
  pintarVideo(db.ejercicios[detalleId]);
});
$("detVideo").addEventListener("change", () => {
  let u = $("detVideo").value.trim();
  if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
  $("detVideo").value = u;
  editarEjercicio({ video_url: u });
  pintarVideo(db.ejercicios[detalleId]);
});
$("detNotas").addEventListener("change", () => editarEjercicio({ notas: $("detNotas").value }));
$("detBorrar").addEventListener("click", () => {
  const b = $("detBorrar");
  if (!b.classList.contains("confirmar")) { b.classList.add("confirmar"); b.textContent = "Pulsa otra vez para eliminarlo con todas sus series"; return; }
  editarEjercicio({ borrado: true });
  $("detalle").close();
});
$("detalle").addEventListener("close", () => {
  $("detEmbed").textContent = "";   // para que el vídeo deje de sonar
  pintarTodo();
});

// ---------- Rendimiento: marcas, forma (VDOT de Daniels), predicciones y ritmos objetivo ----------
// Son estimaciones orientativas calculadas con las series hechas.
const DIST_MARCAS = [200, 400, 800, 1000, 1500, 3000, 5000, 10000, 21097, 42195];
const nombreDist = d => ({ 21097: "Media maratón", 42195: "Maratón" })[d] || fmtDist(d);
const vo2 = v => -4.6 + 0.182258 * v + 0.000104 * v * v;                                   // v en m/min
const fraccion = t => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);   // t en min
const vdotDe = (m, seg) => vo2(m / (seg / 60)) / fraccion(seg / 60);
const velDeVo2 = o => (-0.182258 + Math.sqrt(0.182258 * 0.182258 + 4 * 0.000104 * (4.6 + o))) / (2 * 0.000104);
const ritmoZona = (vdot, fr) => 1000 / velDeVo2(vdot * fr) * 60;                           // segundos por km
const ZONAS = [["Suave (rodaje)", 0.70], ["Maratón", 0.80], ["Umbral", 0.88], ["Series 1000 m (intervalos)", 0.975], ["Series 200–400 m (ritmo)", 1.05]];
const esRecuperacion = id => /trote|recuper|suave|rodaje|calent|calma/.test(norm(nombreEj(id)));
const esTrote = id => /trote|recuper/.test(norm(nombreEj(id)));   // los trotes entre series cuentan como recuperación
function tiempoPrevisto(vdot, m) {
  let lo = m / 600 * 60, hi = m / 50 * 60;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (vdotDe(m, mid) > vdot) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
// La recuperación en metros se supone trotando a ~60 % de la velocidad de la serie
const segRec = (s, v) => n0(s.descanso) > 0 ? n0(s.descanso) : n0(s.rec_dist) > 0 ? n0(s.rec_dist) / (v * 0.6) * 60 : 0;
// Duración equivalente del trabajo: sin recuperar cuenta todo seguido; con mucha recuperación, casi como cada serie suelta
function duracionEquivalente(total, segRep, recMedia) {
  const rr = segRep ? recMedia / segRep : 0;
  return segRep + (total - segRep) / (1 + 2 * rr);
}
// Una sesión de carrera es todo lo corrido ese día: las series de trabajo y los trotes entre ellas
function sesionCarrera(fecha, extra) {
  const todas = seriesVivas().filter(s => s.fecha === fecha && tipoDe(s.ejercicio_id) === "carrera").concat(extra || []);
  return { trabajo: todas.filter(s => !esRecuperacion(s.ejercicio_id) && n0(s.distancia) > 0).sort((x, y) => x.orden - y.orden), trotes: todas.filter(s => esTrote(s.ejercicio_id)) };
}
// Recuperación media entre series de trabajo: la apuntada en cada serie más el tiempo de los trotes
function recuperacionMedia(ses, v) {
  const n = ses.trabajo.length;
  if (n < 2) return 0;
  const enSeries = ses.trabajo.slice(0, -1).reduce((x, s) => x + segRec(s, v), 0);
  const trotes = ses.trotes.reduce((x, s) => x + (n0(s.tiempo) > 0 ? n0(s.tiempo) : n0(s.distancia) / (v * 0.6) * 60), 0);
  return (enSeries + trotes) / (n - 1);
}
// VDOT de la sesión entera: todas las series, volumen, recuperaciones y si el ritmo se mantuvo o cayó
function vdotSesion(ses) {
  const reps = ses.trabajo.filter(s => hecha(s) && n0(s.tiempo) > 0);
  if (!reps.length) return null;
  const metros = reps.reduce((x, s) => x + n0(s.distancia), 0), seg = reps.reduce((x, s) => x + n0(s.tiempo), 0);
  if (reps.length === 1 && metros < 3000) return null;   // una serie corta suelta no dice nada de la forma
  const v = metros / (seg / 60), recMedia = recuperacionMedia({ trabajo: reps, trotes: ses.trotes.filter(hecha) }, v);
  let vdot = vo2(v) / fraccion(duracionEquivalente(seg, seg / reps.length, recMedia) / 60), caida = 0;
  if (reps.length >= 3) {
    const k = Math.max(1, Math.floor(reps.length / 3)), r = s => n0(s.tiempo) / n0(s.distancia);
    caida = reps.slice(-k).reduce((x, s) => x + r(s), 0) / reps.slice(0, k).reduce((x, s) => x + r(s), 0) - 1;
    vdot *= 1 + Math.max(0, 0.03 - Math.max(0, caida));   // si no hubo caída, no fue al límite
  }
  return { vdot, reps: reps.length, metros, seg, recMedia, caida };
}
// Forma: media ponderada de las mejores sesiones de las últimas 12 semanas; lo reciente pesa más (vida media 6 semanas)
function calcularForma() {
  const hoy = new Date();
  const fechas = [...new Set(seriesVivas().filter(s => hecha(s) && tipoDe(s.ejercicio_id) === "carrera").map(s => s.fecha))];
  const lista = fechas.map(fecha => {
    const r = vdotSesion(sesionCarrera(fecha)), dias = Math.max(0, (hoy - deIso(fecha)) / 864e5);
    if (!r || r.vdot < 20 || r.vdot > 90 || dias > 84) return null;
    const peso = Math.pow(0.5, dias / 42);
    return { ...r, fecha, peso, puntos: r.vdot - 3 * (1 - peso) };
  }).filter(Boolean).sort((x, y) => y.puntos - x.puntos).slice(0, 3);
  if (!lista.length) return null;
  const pesos = lista.reduce((x, s) => x + s.peso, 0);
  return { ...lista[0], vdot: lista.reduce((x, s) => x + s.puntos * s.peso, 0) / pesos, sesiones: lista.length };
}
function calcularCarga() {
  const lunes = lunesDe(new Date());
  const km = desde => seriesVivas().filter(s => hecha(s) && tipoDe(s.ejercicio_id) === "carrera" && s.fecha >= iso(desde) && s.fecha < iso(sumarDias(desde, 7))).reduce((x, s) => x + n0(s.distancia), 0) / 1000;
  const actual = km(lunes), media = [1, 2, 3, 4].map(i => km(sumarDias(lunes, -7 * i))).reduce((x, y) => x + y, 0) / 4;
  return { actual, media, ajuste: media > 0 && actual / media > 1.3 ? 0.02 : 0 };
}
let memoRend = { v: -1 };
function rendimiento() {
  if (memoRend.v !== versionDatos) memoRend = { v: versionDatos, forma: calcularForma(), carga: calcularCarga() };
  return memoRend;
}
// Velocidad objetivo de una serie dentro del trabajo entero de su sesión (~97 % del esfuerzo máximo)
function velObjetivo(s, ses, f) {
  const metros = ses.trabajo.reduce((x, y) => x + n0(y.distancia), 0);
  let lo = 100, hi = 600;
  for (let i = 0; i < 40; i++) {
    const v = (lo + hi) / 2;
    const est = vo2(v) / fraccion(duracionEquivalente(metros / v * 60, n0(s.distancia) / v * 60, recuperacionMedia(ses, v)) / 60);
    if (est > f.vdot * 0.97) hi = v; else lo = v;
  }
  return (lo + hi) / 2;
}
// Objetivo de una serie de carrera: siempre con todas las series y trotes del día, nunca con la serie suelta
function objetivoSerie(s, extra) {
  if (tipoDe(s.ejercicio_id) !== "carrera") return null;
  const { forma: f, carga } = rendimiento();
  if (!f) return null;
  const ses = sesionCarrera(s.fecha, extra);
  const suave = { ritmo: ritmoZona(f.vdot, 0.70) * (1 + carga.ajuste), suave: true };
  if (!(n0(s.distancia) > 0) || esRecuperacion(s.ejercicio_id) || (ses.trabajo.length === 1 && n0(s.distancia) >= 3000)) return suave;
  const tiempoObj = x => n0(x.distancia) / velObjetivo(x, ses, f) * 60 * (1 + carga.ajuste);
  let tiempo = tiempoObj(s), ajustado = false;
  // Durante la sesión: cuánto se desvían las series hechas de su objetivo (las últimas pesan más); se corrige la mitad
  const hechas = ses.trabajo.filter(x => hecha(x) && n0(x.tiempo) > 0 && x.id !== s.id);
  if (hechas.length && !hecha(s)) {
    let suma = 0, pesos = 0;
    hechas.forEach((x, i) => { suma += (i + 1) * n0(x.tiempo) / tiempoObj(x); pesos += i + 1; });
    const corr = Math.max(-0.03, Math.min(0.05, 0.5 * (suma / pesos - 1)));
    tiempo *= 1 + corr;
    ajustado = Math.abs(corr) > 0.005;
  }
  return { tiempo, ritmo: tiempo / n0(s.distancia) * 1000, ajustado };
}
const textoObjetivo = o => !o ? "" : o.suave ? "objetivo suave ~" + fmtTiempo(o.ritmo) + "/km"
  : "objetivo " + fmtTiempo(o.tiempo) + " (" + fmtTiempo(o.ritmo) + "/km)" + (o.ajustado ? " · ajustado a cómo vas" : "");
// Mejores marcas por distancia: exactas o, dentro de una serie algo más larga, a su ritmo medio
function marcasDe(tipo) {
  const lista = seriesVivas().filter(s => hecha(s) && tipoDe(s.ejercicio_id) === tipo && n0(s.distancia) > 0 && n0(s.tiempo) > 0);
  return DIST_MARCAS.map(d => {
    let mejor = null;
    const evol = {};
    lista.filter(s => n0(s.distancia) >= d && n0(s.distancia) <= d * 3).forEach(s => {
      const exacta = n0(s.distancia) === d, t = exacta ? n0(s.tiempo) : n0(s.tiempo) * d / n0(s.distancia);
      if (!mejor || t < mejor.t) mejor = { t, fecha: s.fecha, exacta };
      if (!evol[s.fecha] || t < evol[s.fecha]) evol[s.fecha] = t;
    });
    return mejor ? { d, ...mejor, evol: Object.keys(evol).sort().map(f => ({ f, v: evol[f] })) } : null;
  }).filter(Boolean);
}
function seccionMarcas(titulo) {
  const s = document.createElement("section");
  s.className = "plan-sec";
  const h = document.createElement("h3");
  h.textContent = titulo;
  s.appendChild(h);
  return s;
}
function nota(texto) {
  const p = document.createElement("p");
  p.className = "menu-det nota";
  p.textContent = texto;
  return p;
}
function tablaSimple(cabecera, filas) {
  const caja = document.createElement("div");
  caja.className = "tabla-scroll";
  const t = document.createElement("table");
  t.className = "tabla-bilbo tabla-marcas";
  const cab = document.createElement("tr");
  cabecera.forEach(c => { const th = document.createElement("th"); th.textContent = c; cab.appendChild(th); });
  t.appendChild(document.createElement("thead")).appendChild(cab);
  const tb = t.appendChild(document.createElement("tbody"));
  filas.forEach(f => {
    const tr = document.createElement("tr");
    f.celdas.forEach(c => { const td = document.createElement("td"); td.textContent = c; tr.appendChild(td); });
    if (f.alPulsar) { tr.className = "fila-pulsable" + (f.activa ? " activa" : ""); tr.tabIndex = 0; tr.addEventListener("click", f.alPulsar); }
    tb.appendChild(tr);
  });
  caja.appendChild(t);
  return caja;
}
let distGrafica = "";
function pintarMarcas() {
  const cont = $("marcasCont");
  cont.textContent = "";
  const { forma: f, carga } = rendimiento();
  const s1 = seccionMarcas("Forma en carrera");
  if (!f) s1.appendChild(nota("Apunta series o rodajes de carrera con metros y tiempo para estimar tu forma, tus marcas previstas y tus ritmos."));
  else {
    const caja = document.createElement("div");
    caja.className = "records";
    caja.appendChild(recuadro("VDOT estimado", num(Math.round(f.vdot * 10) / 10), "con " + f.sesiones + (f.sesiones === 1 ? " sesión reciente" : " sesiones recientes"), true));
    caja.appendChild(recuadro("Carga de la semana", num(Math.round(carga.actual * 10) / 10) + " km", "media de 4 semanas: " + num(Math.round(carga.media * 10) / 10) + " km" + (carga.ajuste ? " · objetivos un 2 % más suaves" : "")));
    s1.appendChild(caja);
    s1.appendChild(nota("Se calcula con cada entrenamiento completo (todas sus series, volumen, recuperaciones y cómo evolucionó el ritmo), nunca con una serie suelta, y combina tus mejores sesiones recientes; lo reciente pesa más. La principal, el " + fechaCorta(f.fecha) + ": " +
      f.reps + (f.reps === 1 ? " serie, " : " series, ") + fmtDist(f.metros) + " en " + fmtTiempo(f.seg) + (f.recMedia ? ", recuperación media " + fmtTiempo(f.recMedia) : "") + (f.reps >= 3 ? (f.caida > 0.02 ? ", el ritmo cayó al final" : ", ritmo mantenido") : "") + "."));
    const marcas = marcasDe("carrera");
    const ref = marcas.filter(m => m.d >= 1000).sort((x, y) => vdotDe(y.d, y.t) - vdotDe(x.d, x.t))[0];
    const s2 = seccionMarcas("Marcas previstas");
    s2.appendChild(tablaSimple(["Distancia", "Según VDOT", ref ? "Riegel (desde " + nombreDist(ref.d) + ")" : "Riegel"],
      [5000, 10000, 21097, 42195].map(d => ({ celdas: [nombreDist(d), fmtTiempo(tiempoPrevisto(f.vdot, d)), ref ? fmtTiempo(ref.t * Math.pow(d / ref.d, 1.06)) : "—"] }))));
    const s3 = seccionMarcas("Ritmos de entrenamiento");
    s3.appendChild(tablaSimple(["Zona", "Por km", "Por 400 m"], ZONAS.map(([n, fr]) => { const r = ritmoZona(f.vdot, fr) * (1 + carga.ajuste); return { celdas: [n, fmtTiempo(r), fmtTiempo(r * 0.4)] }; })));
    s3.appendChild(nota("Cada serie de carrera planificada muestra su objetivo calculado con todo el entrenamiento de ese día (series, bloques, volumen y recuperaciones) y se ajusta según cómo te van saliendo."));
    cont.append(s1, s2, s3);
  }
  if (!f) cont.appendChild(s1);
  [["carrera", "Mejores marcas de carrera", 1000, "/km"]].forEach(([tipo, titulo, por, suf]) => {
    const marcas = marcasDe(tipo);
    if (!marcas.length) return;
    const s = seccionMarcas(titulo);
    const sel = marcas.find(m => tipo + m.d === distGrafica) || marcas.slice().sort((x, y) => y.evol.length - x.evol.length)[0];
    s.appendChild(tablaSimple(["Distancia", "Tiempo", "Ritmo", "Fecha"], marcas.map(m => ({
      celdas: [nombreDist(m.d) + (m.exacta ? "" : " *"), fmtTiempo(m.t), fmtTiempo(m.t / m.d * por) + suf, fechaCorta(m.fecha)],
      activa: m === sel, alPulsar: () => { distGrafica = tipo + m.d; pintarMarcas(); }
    }))));
    if (marcas.some(m => !m.exacta)) s.appendChild(nota("* Sacada de una serie algo más larga, a su ritmo medio."));
    const tit = document.createElement("p");
    tit.className = "bc-t";
    tit.textContent = "Evolución · " + nombreDist(sel.d);
    const g = document.createElement("div");
    g.innerHTML = grafica(sel.evol, v => fmtTiempo(v));
    s.append(tit, g, nota("Toca otra distancia para ver su evolución. En esta gráfica, más abajo es más rápido."));
    cont.appendChild(s);
  });
}

// ---------- Plan: plantillas, mesociclos y usuarios ----------
function tarjeta(titulo, lineas, alPulsar) {
  const t = document.createElement("button");
  t.type = "button";
  t.className = "tarjeta";
  t.innerHTML = '<span class="t-nombre"></span>';
  t.querySelector(".t-nombre").textContent = titulo;
  lineas.filter(Boolean).forEach((l, i) => { const s = document.createElement("span"); s.className = i ? "t-ultima" : "t-mejor"; s.textContent = l; t.appendChild(s); });
  t.addEventListener("click", alPulsar);
  return t;
}
function rangoMeso(m) {
  const ini = deIso(m.inicio), fin = sumarDias(ini, n0(m.semanas) * 7 - 1);
  return fmt(ini) + " – " + fechaCorta(iso(fin)) + " · " + n0(m.semanas) + (n0(m.semanas) === 1 ? " semana" : " semanas");
}
function resumenDiasMeso(m) {
  const d = m.dias || {};
  return NOMBRES.map((n, i) => (d[i] || []).length ? n.slice(0, 3) + ": " + d[i].map(pid => (db.plantillas[pid] || {}).nombre || "?").join(" + ") : "").filter(Boolean).join(" · ") || "Sin plantillas asignadas";
}
function pintarPlan() {
  const lp = $("listaPlantillas");
  lp.textContent = "";
  const ps = vivos("plantillas").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  if (!ps.length) lp.innerHTML = '<p class="vacio-lista">Monta un entrenamiento en un día de la semana (por ejemplo, Pierna) y en su menú ⋯ elige «Guardar ejercicios como plantilla».</p>';
  ps.forEach(p => lp.appendChild(tarjeta(p.nombre, [resumenItems(p.items || []), nombresItems(p.items || [])], () => menuPlantilla(p))));

  const lm = $("listaMesos");
  lm.textContent = "";
  const hoy = iso(new Date());
  const ms = vivos("mesociclos").sort((a, b) => (b.inicio || "").localeCompare(a.inicio || ""));
  if (!ms.length) lm.innerHTML = '<p class="vacio-lista">Un mesociclo reparte tus plantillas por los días de la semana durante varias semanas, con progresión de peso si quieres.</p>';
  ms.forEach(m => {
    const actual = m.inicio && hoy >= m.inicio && hoy < iso(sumarDias(deIso(m.inicio), n0(m.semanas) * 7));
    const semana = actual ? Math.floor((lunesDe(new Date()) - lunesDe(deIso(m.inicio))) / (7 * 864e5)) + 1 : 0;
    lm.appendChild(tarjeta(m.nombre, [rangoMeso(m) + (actual ? " · ahora en la semana " + semana : ""), resumenDiasMeso(m) + (n0(m.progresion) ? " · +" + num(m.progresion) + " kg/semana" : "")], () => abrirMeso(m.id)));
  });

  $("bloqueUsuarios").hidden = !(perfil && perfil.es_admin);
  if (perfil && perfil.es_admin) {
    const lu = $("listaUsuarios");
    lu.textContent = "";
    usuarios.forEach(u => {
      const fila = document.createElement("div");
      fila.className = "usuario";
      fila.innerHTML = '<span class="u-info"><span class="u-email"></span><span class="u-fecha"></span></span><span class="u-estado"></span>';
      fila.querySelector(".u-email").textContent = u.email || "(sin email)";
      fila.querySelector(".u-fecha").textContent = "Registrado el " + fechaCorta(iso(new Date(u.creado))) + (u.es_admin ? " · administrador" : "");
      const est = fila.querySelector(".u-estado");
      if (u.user_id === sesion.user_id) est.textContent = "Tú";
      else {
        const b = document.createElement("button");
        b.type = "button";
        b.className = u.aprobado ? "nav-btn" : "anadir";
        b.textContent = u.aprobado ? "Quitar acceso" : "Aprobar";
        b.addEventListener("click", () => aprobar(u.user_id, !u.aprobado));
        if (!u.aprobado) { const p = document.createElement("span"); p.className = "pr"; p.textContent = "PENDIENTE"; est.appendChild(p); }
        est.appendChild(b);
      }
      lu.appendChild(fila);
    });
  }
}
function menuPlantilla(p) {
  abrirMenu(p.nombre, resumenItems(p.items || []) + ": " + nombresItems(p.items || []), [
    { texto: "Añadir a un día de esta semana…", accion: () => abrirMenu("¿A qué día?", "", dias.map(d => ({ texto: NOMBRES[d.i] + " " + fmt(deIso(d.id)), accion: () => { aplicarPlantilla(d, p); verPestana("semana"); } }))) },
    { texto: "Compartir con un amigo…", accion: () => compartir(p.nombre, p.items || []) },
    { texto: "Cambiar nombre…", accion: async () => { const n = await pedirNombre("Nombre de la plantilla", p.nombre); if (n) { cambiar("plantillas", { ...p, nombre: n }); pintarPlan(); } } },
    { texto: "Eliminar plantilla", peligro: true, accion: () => { cambiar("plantillas", { ...p, borrado: true }); pintarPlan(); } }
  ]);
}
async function aprobar(uid, valor) {
  try {
    const r = await api("/rest/v1/perfiles?user_id=eq." + encodeURIComponent(uid), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ aprobado: valor }) });
    if (!r.ok) throw new Error();
    await cargarPerfil();
    setEstado(valor ? "Usuario aprobado" : "Acceso retirado");
  } catch { setEstado("No se ha podido cambiar. Revisa la conexión.", true); }
  pintarPlan();
}
function avisoUsuarios() {
  const n = usuarios.filter(u => !u.aprobado).length;
  $("tabPlan").textContent = n ? "Plan · " + n : "Plan";
  $("tabPlan").classList.toggle("con-aviso", n > 0);
}

// Editor de mesociclo
let mesoEdit = null;
function abrirMeso(id) {
  const m = id ? db.mesociclos[id] : null;
  mesoEdit = m ? { ...m, dias: JSON.parse(JSON.stringify(m.dias || {})) }
               : { id: nuevoId(), nombre: "", inicio: iso(lunesDe(new Date())), semanas: 4, dias: {}, progresion: 0, notas: "", borrado: false, nuevo: true };
  $("mesoNombre").value = mesoEdit.nombre;
  $("mesoInicio").value = mesoEdit.inicio;
  $("mesoSemanas").value = mesoEdit.semanas;
  $("mesoProg").value = n0(mesoEdit.progresion) ? num(mesoEdit.progresion) : "";
  $("mesoNotas").value = mesoEdit.notas || "";
  $("mesoBorrar").hidden = !!mesoEdit.nuevo;
  $("mesoQuitar").hidden = !!mesoEdit.nuevo;
  $("mesoBorrar").classList.remove("confirmar"); $("mesoBorrar").textContent = "Eliminar mesociclo";
  $("mesoAviso").textContent = "";
  pintarDiasMeso();
  $("dlgMeso").showModal();
}
function pintarDiasMeso() {
  const cont = $("mesoDias");
  cont.textContent = "";
  NOMBRES.forEach((n, i) => {
    const fila = document.createElement("div");
    fila.className = "meso-dia";
    fila.innerHTML = '<span class="md-n"></span><span class="md-chips"></span><button type="button" class="nav-btn md-mas">+</button>';
    fila.querySelector(".md-n").textContent = n;
    const chips = fila.querySelector(".md-chips");
    (mesoEdit.dias[i] || []).forEach((pid, k) => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "chip";
      c.textContent = ((db.plantillas[pid] || {}).nombre || "Plantilla borrada") + " ✕";
      c.setAttribute("aria-label", "Quitar " + c.textContent.slice(0, -2) + " del " + n);
      c.addEventListener("click", () => { mesoEdit.dias[i].splice(k, 1); pintarDiasMeso(); });
      chips.appendChild(c);
    });
    if (!(mesoEdit.dias[i] || []).length) { const v = document.createElement("span"); v.className = "md-vacio"; v.textContent = "Descanso"; chips.appendChild(v); }
    const mas = fila.querySelector(".md-mas");
    mas.setAttribute("aria-label", "Añadir plantilla al " + n);
    mas.addEventListener("click", () => {
      const ps = vivos("plantillas").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      if (!ps.length) { $("mesoAviso").textContent = "Primero crea alguna plantilla desde un día de la semana (menú ⋯ → Guardar ejercicios como plantilla)."; return; }
      // Lista sencilla dentro del propio editor para no abrir otra ventana encima
      const lista = document.createElement("div");
      lista.className = "md-lista";
      ps.forEach(p => {
        const o = document.createElement("button");
        o.type = "button"; o.className = "chip chip-op"; o.textContent = p.nombre;
        o.addEventListener("click", () => { (mesoEdit.dias[i] = mesoEdit.dias[i] || []).push(p.id); pintarDiasMeso(); });
        lista.appendChild(o);
      });
      fila.after(lista);
      mas.disabled = true;
    });
    cont.appendChild(fila);
  });
}
function leerMeso() {
  const nombre = $("mesoNombre").value.trim(), inicio = $("mesoInicio").value, semanas = parseInt($("mesoSemanas").value, 10);
  const progresion = parseFloat(($("mesoProg").value || "0").replace(",", "."));
  if (!nombre) { $("mesoAviso").textContent = "Ponle un nombre (por ejemplo, Fuerza · bloque 1)."; $("mesoNombre").focus(); return null; }
  if (!inicio) { $("mesoAviso").textContent = "Elige la fecha de inicio."; return null; }
  if (!(semanas >= 1 && semanas <= 26)) { $("mesoAviso").textContent = "El número de semanas debe estar entre 1 y 26."; return null; }
  if (isNaN(progresion)) { $("mesoAviso").textContent = "La progresión debe ser un número de kg (puede ser 0)."; return null; }
  const m = { ...mesoEdit, nombre, inicio: iso(lunesDe(deIso(inicio))), semanas, progresion, notas: $("mesoNotas").value };
  delete m.nuevo;
  return m;
}
function quitarMesoDelCalendario(mesoId) {
  let n = 0;
  seriesVivas().filter(s => s.meso_id === mesoId && !hecha(s)).forEach(s => { cambiar("series", { ...s, borrado: true }, true); n++; });
  return n;
}
// Rellena el calendario: cada semana, cada día con sus plantillas; la progresión suma kg cada semana
function aplicarMeso(m) {
  quitarMesoDelCalendario(m.id);
  const lunes = deIso(m.inicio);
  let total = 0;
  for (let w = 0; w < m.semanas; w++) {
    for (let d = 0; d < 7; d++) {
      const fecha = iso(sumarDias(lunes, w * 7 + d));
      (m.dias[d] || []).forEach(pid => {
        const p = db.plantillas[pid];
        if (!p || p.borrado) return;
        pegarItems(fecha, p.items || [], p.nombre, m.id, w * n0(m.progresion));
        total += contarSeries(p.items || []);
      });
    }
  }
  return total;
}
$("mesoGuardar").addEventListener("click", () => {
  const m = leerMeso(); if (!m) return;
  cambiar("mesociclos", m);
  $("dlgMeso").close(); pintarPlan();
});
$("mesoAplicar").addEventListener("click", () => {
  const m = leerMeso(); if (!m) return;
  cambiar("mesociclos", m, true);
  const n = aplicarMeso(m);
  persistir();
  $("dlgMeso").close();
  setEstado("Mesociclo aplicado: " + n + " series planificadas");
  desplazamiento = Math.round((lunesDe(deIso(m.inicio)) - lunesDe(new Date())) / (7 * 864e5));
  verPestana("semana");
});
$("mesoQuitar").addEventListener("click", () => {
  const n = quitarMesoDelCalendario(mesoEdit.id);
  persistir();
  $("mesoAviso").textContent = n ? "Quitadas " + n + " series planificadas (las que ya hiciste se conservan)." : "No había series planificadas de este mesociclo.";
});
$("mesoBorrar").addEventListener("click", () => {
  const b = $("mesoBorrar");
  if (!b.classList.contains("confirmar")) { b.classList.add("confirmar"); b.textContent = "Pulsa otra vez: se quitan también sus series planificadas"; return; }
  quitarMesoDelCalendario(mesoEdit.id);
  cambiar("mesociclos", { ...db.mesociclos[mesoEdit.id], borrado: true });
  $("dlgMeso").close(); pintarPlan();
});
$("nuevoMeso").addEventListener("click", () => abrirMeso(null));
$("abrirComp").addEventListener("click", () => abrirCompartido($("codigoComp").value));

// ---------- Navegación ----------
function irA(n) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  desplazamiento = n;
  pintarSemana();
}
$("antBtn").addEventListener("click", () => irA(desplazamiento - 1));
$("sigBtn").addEventListener("click", () => irA(desplazamiento + 1));
$("hoyBtn").addEventListener("click", () => irA(0));

const VISTAS = { semana: "vistaSemana", ejercicios: "vistaEjercicios", plan: "vistaPlan", marcas: "vistaMarcas" };
const TABS = { semana: "tabSemana", ejercicios: "tabEjercicios", plan: "tabPlan", marcas: "tabMarcas" };
function verPestana(cual) {
  if (!VISTAS[cual]) cual = "semana";
  Object.keys(VISTAS).forEach(k => {
    $(VISTAS[k]).hidden = k !== cual;
    $(TABS[k]).setAttribute("aria-selected", String(k === cual));
  });
  escribir("pestana-v1", cual);
  if (cual === "ejercicios") pintarCatalogo();
  else if (cual === "plan") pintarPlan();
  else if (cual === "marcas") pintarMarcas();
  else pintarSemana();
}
Object.keys(TABS).forEach(k => $(TABS[k]).addEventListener("click", () => verPestana(k)));

function pintarTodo() {
  rellenar();
  pintarBloques(false);
  pintarBanda();
  if (!$("vistaEjercicios").hidden) pintarCatalogo();
  if (!$("vistaPlan").hidden) pintarPlan();
  if (!$("vistaMarcas").hidden) pintarMarcas();
  if ($("detalle").open) refrescarDetalle();
}

// Sincronizar al abrir, al volver a la app, al recuperar conexión y cada 30 s
document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (!$("vistaSemana").hidden && !escribiendoSerie()) pintarSemana(); sincronizar(); } });
addEventListener("online", sincronizar);
setInterval(() => { if (!document.hidden) sincronizar(); }, 30000);

// ---------- Inicio de sesión y cuentas pendientes ----------
let creando = false;
$("modoBtn").addEventListener("click", () => {
  creando = !creando;
  $("loginBtn").textContent = creando ? "Crear cuenta" : "Entrar";
  $("modoBtn").textContent = creando ? "Ya tengo cuenta" : "¿Primera vez? Crear cuenta";
  $("password").autocomplete = creando ? "new-password" : "current-password";
  $("loginTexto").textContent = creando
    ? "Elige tu email y una contraseña de al menos 6 caracteres. Tu cuenta quedará pendiente hasta que el administrador la apruebe."
    : "Entra con tu email y tu contraseña. Solo hace falta una vez en cada dispositivo.";
  $("loginError").textContent = "";
});
const traducir = m => /invalid login/i.test(m) ? "Email o contraseña incorrectos."
  : /already registered|already exists/i.test(m) ? "Ya existe una cuenta con ese email. Pulsa «Ya tengo cuenta» y entra."
  : /at least 6|password should/i.test(m) ? "La contraseña debe tener al menos 6 caracteres."
  : /signups not allowed|signup is disabled/i.test(m) ? "Ahora mismo no se pueden crear cuentas nuevas."
  : /valid email|invalid format/i.test(m) ? "Escribe un email válido."
  : m || "No se ha podido entrar.";
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("email").value.trim(), password = $("password").value;
  if (!email || password.length < 6) { $("loginError").textContent = "Escribe tu email y una contraseña de al menos 6 caracteres."; return; }
  $("loginBtn").disabled = true; $("loginError").textContent = "";
  try {
    const ruta = creando ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
    const r = await fetch(SUPA + ruta, { method: "POST", headers: { apikey: CLAVE, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(traducir(j.msg || j.error_description || j.message || ""));
    if (leer("entrenos-dueno") !== j.user.id) {
      db = {}; Object.keys(TABLAS).forEach(t => { db[t] = {}; }); cursores = {}; enEspera = {}; perfil = null; porta = null;
      guardarLocal(); guardarEspera(); escribir("perfil-v1", null); escribir("portapapeles-v1", null); escribir("entrenos-dueno", j.user.id);
    }
    guardarSesion(j);
    $("password").value = "";
    try { await cargarPerfil(); } catch {}
    mostrarApp();
  } catch (err) {
    $("loginError").textContent = navigator.onLine === false ? "Necesitas conexión para entrar la primera vez." : err.message;
  } finally {
    $("loginBtn").disabled = false;
  }
});
function cerrarSesion(msg) {
  sesion = null; escribir("sesion-v1", null);
  $("app").hidden = true; $("pendiente").hidden = true; $("login").hidden = false;
  $("loginError").textContent = msg || "";
}
$("salirBtn").addEventListener("click", () => {
  if (hayPendientes()) { setEstado("Hay cambios sin subir. Conéctate a internet antes de cerrar sesión.", true); return; }
  cerrarSesion("");
});
function mostrarPendiente() {
  $("login").hidden = true; $("app").hidden = true; $("pendiente").hidden = false;
  $("pendEmail").textContent = sesion.email || "";
}
$("pendReintentar").addEventListener("click", () => { $("pendAviso").textContent = "Comprobando…"; sincronizar().then(() => { $("pendAviso").textContent = perfil && perfil.aprobado ? "" : "Tu cuenta sigue pendiente."; }); });
$("pendSalir").addEventListener("click", () => cerrarSesion(""));
function mostrarApp() {
  if (perfil && perfil.aprobado === false) { mostrarPendiente(); return; }
  $("login").hidden = true; $("pendiente").hidden = true; $("app").hidden = false;
  verPestana(leer("pestana-v1") || "semana");
  setEstado("Sincronizando…");
  sincronizar();
  // Enlace compartido por un amigo: #c=CODIGO
  if (/^#c=/i.test(location.hash)) {
    const h = location.hash;
    history.replaceState(null, "", location.pathname);
    setTimeout(() => abrirCompartido(h), 1200);
  }
}

if (sesion) mostrarApp(); else $("login").hidden = false;

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
