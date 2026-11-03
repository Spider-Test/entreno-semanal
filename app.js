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
  ejercicios: { clave: "id", conflicto: "id", campos: ["id", "user_id", "nombre", "tipo", "video_url", "notas", "rm", "compartido", "zonas", "borrado", "actualizado"] },
  personales: { clave: "ejercicio_id", conflicto: "user_id,ejercicio_id", campos: ["ejercicio_id", "rm", "actualizado"] },
  ciclos: { clave: "id", conflicto: "id", campos: ["id", "ejercicio_id", "numero", "rm_inicio", "peso_inicial", "incremento", "reps_reset", "importadas", "cerrado", "borrado", "actualizado"] },
  plantillas: { clave: "id", conflicto: "id", campos: ["id", "nombre", "items", "borrado", "actualizado"] },
  mesociclos: { clave: "id", conflicto: "id", campos: ["id", "nombre", "inicio", "semanas", "dias", "progresion", "descarga", "notas", "borrado", "actualizado"] },
  series: { clave: "id", conflicto: "id", campos: ["id", "fecha", "ejercicio_id", "orden", "peso", "reps", "distancia", "tiempo", "descanso", "hecha", "grupo", "meso_id", "bloque_id", "ronda", "rec_dist", "pct", "ciclo_id", "calentamiento", "borrado", "actualizado"] },
  entrenos: { clave: "fecha", conflicto: "user_id,fecha", campos: ["fecha", "html", "texto", "rpe", "sensacion", "actualizado"] },
  molestias: { clave: "id", conflicto: "id", campos: ["id", "zona", "descripcion", "inicio", "estado", "borrado", "actualizado"] }
};
const DEFECTOS = { tipo: "fuerza", hecha: true, grupo: "", meso_id: "", bloque_id: "", ciclo_id: "", importadas: [], cerrado: false, compartido: false, items: [], dias: {}, descarga: {}, zonas: [], calentamiento: false, inicio: null, zona: "", descripcion: "", estado: "activa", nombre: "", video_url: "", notas: "", html: "", texto: "", sensacion: "", borrado: false };
let sesion = leer("sesion-v1");                 // {access_token, refresh_token, expires_at, user_id, email}
let perfil = leer("perfil-v1");                 // {aprobado, es_admin, email}
let usuarios = [];                              // solo para el administrador
let db = leer("datos-v2") || { entrenos: leer("entrenos-v1") || {} };
Object.keys(TABLAS).forEach(t => { db[t] = db[t] || {}; });
let cursores = leer("cursores-v3") || {};       // última marca de servidor leída por tabla (v3: relee todo al añadir campos)
let enEspera = leer("bloques-v1") || {};        // fecha -> ejercicios añadidos que aún no tienen series
let porta = leer("portapapeles-v1");            // lo último copiado: {nombre, html, items}
const guardarLocal = () => { escribir("datos-v2", db); escribir("cursores-v3", cursores); };
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
// Día abierto a pantalla completa: se recuerda si se abrió hoy (al día siguiente la app vuelve a la semana)
let diaAbierto = (g => g && g.abierto === iso(new Date()) ? g.id : null)(leer("dia-abierto-v1"));
if (diaAbierto) desplazamiento = Math.round((lunesDe(deIso(diaAbierto)) - lunesDe(new Date())) / 6048e5);
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
// Catálogo común: lo editan el administrador y quien él autorice; los ejercicios privados, su dueño
const puedeEditarCatalogo = () => !!(perfil && perfil.aprobado && (perfil.es_admin || perfil.edita_catalogo));
const editable = e => !!e && (!e.compartido || puedeEditarCatalogo());
// Quitar algo del catálogo común (borrarlo o dejar de compartirlo) solo puede hacerlo el administrador
const puedeQuitarDelCatalogo = e => !!e && (!e.compartido || !!(perfil && perfil.es_admin));
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
// El 1RM es personal: los ejercicios del catálogo común son de todos, pero cada uno tiene el suyo
const rmPersonal = id => n0((db.personales[id] || {}).rm) || (db.ejercicios[id] && !db.ejercicios[id].compartido ? n0(db.ejercicios[id].rm) : 0);
function rmReferencia(id) {
  if (rmPersonal(id) > 0) return rmPersonal(id);
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
const seriesDe = id => seriesVivas().filter(s => s.ejercicio_id === id && hecha(s) && !s.calentamiento).sort(ordenSerie);   // solo lo hecho (sin calentamiento) cuenta para récords
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
  const r = await api("/rest/v1/perfiles?select=user_id,email,aprobado,es_admin,edita_catalogo,creado&order=creado.asc");
  if (!r.ok) throw new Error("perfil " + r.status);
  const lista = await r.json();
  const mio = lista.find(p => p.user_id === sesion.user_id);
  perfil = mio ? { aprobado: mio.aprobado, es_admin: mio.es_admin, edita_catalogo: mio.edita_catalogo, email: mio.email } : { aprobado: false, es_admin: false, edita_catalogo: false, email: sesion.email };
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
  // Misma marca y sin cambios locales: solo se copia si el servidor trae algún campo distinto (p. ej. una columna nueva)
  const igual = () => TABLAS[tabla].campos.every(c => c === "actualizado" || JSON.stringify(local[c] ?? null) === JSON.stringify(f[c] ?? null));
  if (local && ((local.sucio && tr <= tl) || (!local.sucio && tr === tl && igual()))) return false;
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
        const filas = pend.map(v => { const f = {}; TABLAS[t].campos.forEach(c => { f[c] = v[c] ?? (c in DEFECTOS ? DEFECTOS[c] : 0); }); f.user_id = v.user_id || sesion.user_id; return f; });   // los ejercicios del catálogo conservan a su dueño
        const w = await api("/rest/v1/" + t + "?on_conflict=" + TABLAS[t].conflicto, {
          method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(filas)
        });
        if (!w.ok) throw new Error("guardar " + t + " " + w.status);
        filas.forEach(f => { const v = db[t][f[TABLAS[t].clave]]; if (v && v.actualizado === f.actualizado) v.sucio = false; });
        guardarLocal();
      }
    } while (repetir);
    await enviarSugerencias();
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
  // Cabecera ligera: el nombre abre el día solo; la negrita aparece solo mientras se escribe
  // El título despliega o pliega el día; ⤢ lo abre solo, a pantalla completa
  col.innerHTML = '<div class="dia-cab"><button type="button" class="dia-abrir" aria-expanded="true"><span class="flecha-dia" aria-hidden="true">▸</span><span class="dia-nombre"></span><span class="dia-fecha"></span></button>' +
                  '<span class="anillo" hidden></span>' +
                  '<button type="button" class="negrita" aria-pressed="false" title="Negrita (⌘B)">N</button>' +
                  '<button type="button" class="dia-max" title="Abrir el día a pantalla completa">⤢</button>' +
                  '<button type="button" class="menu-btn" aria-label="Opciones del día">⋯</button></div>' +
                  '<button type="button" class="dia-resumen"></button>' +
                  '<div class="dia-cuerpo"><div class="dia-cuerpo-in">' +
                  '<div class="editor vacio" role="textbox" aria-multiline="true" contenteditable="true"></div>' +
                  '<div class="bloques"></div><div class="add-fila"><button type="button" class="add-ej">+ Ejercicio</button><button type="button" class="add-ej add-bloque">+ Bloque</button></div>' +
                  '<button type="button" class="primario empezar" hidden>▶ Empezar entreno</button>' +
                  '<button type="button" class="rpe-dia" hidden></button></div></div>';
  col.querySelector(".dia-nombre").textContent = NOMBRES[i];
  col.querySelector(".dia-max").setAttribute("aria-label", "Abrir el " + NOMBRES[i] + " a pantalla completa");
  const ed = col.querySelector(".editor");
  const btn = col.querySelector(".negrita");
  ed.id = "e-" + DIAS[i];
  ed.dataset.pista = PISTAS[i];
  ed.setAttribute("aria-label", "Entrenamiento del " + NOMBRES[i]);
  btn.setAttribute("aria-label", "Negrita en " + NOMBRES[i]);
  $("semana").appendChild(col);
  const dia = { i, col, ed, btn, fechaEl: col.querySelector(".dia-fecha"), bloquesEl: col.querySelector(".bloques"), rpeEl: col.querySelector(".rpe-dia"),
                anillo: col.querySelector(".anillo"), resumenEl: col.querySelector(".dia-resumen"), empezarEl: col.querySelector(".empezar"), id: "" };
  dia.rpeEl.addEventListener("click", () => abrirRpe(dia));
  col.querySelector(".dia-abrir").addEventListener("click", () => plegarDia(dia));
  dia.resumenEl.addEventListener("click", () => plegarDia(dia));
  col.querySelector(".dia-max").addEventListener("click", () => abrirDia(dia.id));
  dia.empezarEl.addEventListener("click", () => empezarEntreno(dia));
  ed.addEventListener("focus", () => col.classList.add("escribiendo"));
  ed.addEventListener("blur", () => col.classList.remove("escribiendo"));
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
    $("mesoBanda").textContent = "Mesociclo «" + m.nombre + "» · semana " + semana + " de " + n0(m.semanas) + (esDescarga(m, semana - 1) ? " · Descarga" : "");
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
  // Cada día se despliega o se pliega (por defecto, solo hoy desplegado); con un día abierto, solo ese día
  $("vistaSemana").classList.toggle("solo-dia", !!diaAbierto);
  $("diaNav").hidden = !diaAbierto;
  $("navSemana").hidden = !!diaAbierto;
  if (diaAbierto) $("diaNavTit").textContent = NOMBRES[(deIso(diaAbierto).getDay() + 6) % 7] + " " + fmt(deIso(diaAbierto)) + (diaAbierto === hoyIso ? " · hoy" : "");
  dias.forEach(d => {
    const f = sumarDias(lunes, d.i);
    d.id = iso(f);
    d.fechaEl.textContent = fmt(f);
    d.col.classList.toggle("hoy", d.id === hoyIso);
    d.col.hidden = !!diaAbierto && d.id !== diaAbierto;
    ponerPlegado(d, !diaAbierto && !desplegado(d.id));
    if (document.activeElement !== d.ed) d.ed.innerHTML = "";
  });
  rellenar();
  pintarBloques(true);
  pintarResumen();
}

function editado(dia) {
  const html = limpiar(dia.ed.innerHTML);
  marcarVacio(dia.ed);
  cambiar("entrenos", { ...db.entrenos[dia.id], fecha: dia.id, html, texto: aTexto(html) });
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
const valores = s => ({ peso: n0(s.peso), reps: s.ciclo_id ? 0 : n0(s.reps), distancia: n0(s.distancia), tiempo: n0(s.tiempo), descanso: n0(s.descanso), rec_dist: n0(s.rec_dist), pct: n0(s.pct), bilbo: !!s.ciclo_id, calentamiento: !!s.calentamiento });
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
    descanso: n0(v.descanso), rec_dist: n0(v.rec_dist), pct: n0(v.pct), ciclo_id: v.bilbo ? "auto" : "", calentamiento: !!v.calentamiento, hecha: false, meso_id: mesoId || "", bloque_id: "", ronda: 0, borrado: false
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
    cambiar("entrenos", { ...db.entrenos[dia.id], fecha: dia.id, html, texto: aTexto(html) }, true);
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
  const nGrupos = new Set(seriesDelDia(dia.id).map(s => s.grupo || "")).size;
  abrirMenu(grupo, resumenItems(itemsDe(series)), [
    nGrupos > 1 && { texto: "Subir sesión", accion: () => moverGrupo(dia.id, grupo, -1) },
    nGrupos > 1 && { texto: "Bajar sesión", accion: () => moverGrupo(dia.id, grupo, 1) },
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
async function compartir(nombre, items, crudo) {
  const codigo = nuevoCodigo();
  try {
    const r = await api("/rest/v1/compartidos", { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ codigo, user_id: sesion.user_id, autor: sesion.email || "", nombre, items: crudo ? items : paraCompartir(items) }) });
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
  // Un mesociclo entero: vista previa y guardarlo con sus plantillas
  if (c.items[0] && c.items[0].mesociclo) {
    const x = c.items[0], mm = x.mesociclo;
    abrirMenu("Mesociclo «" + c.nombre + "»", "Compartido por " + (c.autor || "un amigo") + " · " + n0(mm.semanas) + " semanas" + (n0(mm.progresion) ? " · +" + num(mm.progresion) + " kg/semana" : "") +
      ". Plantillas: " + x.plantillas.map(p => p.nombre + " (" + contarSeries(p.items) + " series)").join(", ") + ". Se guardan en tus plantillas y mesociclos; después eliges cuándo empieza.",
      [{ texto: "Guardar en mis mesociclos", accion: () => guardarMesoCompartido(c) }]);
    return;
  }
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
  pintarProgresoSemana();
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
  // Cada sesión va en su propio contenedor para poder moverla entera
  const conAsa = grupos.filter(g => g.nombre).length > 1 && grupos.length > 1;
  grupos.forEach(g => {
    const caja = document.createElement("div");
    caja.className = "grupo";
    caja.dataset.grupo = g.nombre;
    if (g.nombre) {
      const cab = document.createElement("div");
      cab.className = "grupo-cab";
      cab.innerHTML = '<span class="g-nombre"></span><span class="g-prog"></span><button type="button" class="menu-btn">⋯</button>';
      cab.querySelector(".g-nombre").textContent = g.nombre;
      const deG = delDia.filter(s => (s.grupo || "") === g.nombre);
      cab.querySelector(".g-prog").textContent = deG.filter(hecha).length + "/" + deG.length;
      cab.querySelector(".menu-btn").setAttribute("aria-label", "Opciones de la sesión " + g.nombre);
      cab.querySelector(".menu-btn").addEventListener("click", () => menuGrupo(dia, g.nombre));
      if (conAsa) cab.appendChild(asaArrastre(caja, () => [...cont.querySelectorAll(":scope > .grupo")], n => reordenar(n.map(x => seriesDeGrupo(dia.id, x.dataset.grupo)), "Sesión movida"), "Sesión " + g.nombre));
      caja.appendChild(cab);
    }
    g.ids.forEach(id => caja.appendChild(id.startsWith("b:")
      ? tarjetaBloque(dia, id.slice(2), delDia.filter(s => s.bloque_id === id.slice(2)))
      : bloque(dia, id, delDia.filter(s => s.ejercicio_id === id && !s.bloque_id && (s.grupo || "") === g.nombre), g.nombre)));
    // Ejercicios y bloques de la sesión: se mueven dentro de ella (los que ya tienen series)
    const movibles = () => [...caja.querySelectorAll(":scope > .bloque[data-clave]")];
    if (movibles().length > 1) movibles().forEach(el => {
      const clave = el.dataset.clave, nombre = clave.startsWith("b:") ? "Bloque" : nombreEj(clave);
      el.querySelector(".bloque-cab").appendChild(asaArrastre(el, movibles, n => reordenar(n.map(x => seriesDeItem(dia.id, g.nombre, x.dataset.clave)), "Ejercicio movido"), nombre));
      if (!clave.startsWith("b:")) {
        const m = document.createElement("button");
        m.type = "button"; m.className = "menu-btn"; m.textContent = "⋯";
        m.setAttribute("aria-label", "Opciones de " + nombre);
        m.addEventListener("click", () => abrirMenu(nombre, "", [
          { texto: "Subir", accion: () => moverItem(dia.id, g.nombre, clave, -1) },
          { texto: "Bajar", accion: () => moverItem(dia.id, g.nombre, clave, 1) },
          { texto: "Ver ficha del ejercicio", accion: () => abrirDetalle(clave) }
        ]));
        el.querySelector(".asa").before(m);
      }
    });
    cont.appendChild(caja);
  });
  pintarRpe(dia);
  pintarCabDia(dia);
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
  b.className = "bloque t-" + tipo;
  b.dataset.ej = id;
  if (series.length) b.dataset.clave = id;
  b.dataset.grupo = grupo;
  b.innerHTML = '<div class="bloque-cab"><button type="button" class="ej-nombre"></button><button type="button" class="quitar" aria-label="Quitar ejercicio">✕</button></div>' +
    '<ol class="series"></ol>' +
    '<form class="nueva-serie">' +
      '<div class="ns-fila">' + (dist
        ? '<button type="button" class="modo-dist" aria-label="Cambiar entre metros y tiempo">m</button>' + paso('<input class="in-a" inputmode="numeric" pattern="[0-9]*" placeholder="metros" aria-label="Distancia en metros" autocomplete="off" enterkeyhint="next">') +
          paso('<input class="in-b" inputmode="decimal" placeholder="tiempo 3,40" aria-label="Tiempo (minutos y segundos)" autocomplete="off" enterkeyhint="next">')
        : '<button type="button" class="modo" aria-label="Cambiar entre kg y % del 1RM">kg</button>' + paso('<input class="in-a" inputmode="decimal" placeholder="kg" aria-label="Peso en kg" autocomplete="off" enterkeyhint="next">') +
          '<span class="por">×</span>' + paso('<input class="in-b" inputmode="numeric" pattern="[0-9]*" placeholder="reps" aria-label="Repeticiones" autocomplete="off" enterkeyhint="next">')) +
      '</div>' + (dist ? '<div class="ns-extra"><span class="calc"></span></div>' : '<div class="ns-extra"><span class="calc"></span><label class="bilbo-op" hidden><input type="checkbox" class="es-bilbo"> <span></span></label></div>') +
      '<div class="ns-fila"><input class="in-c" inputmode="decimal" placeholder="⏱ descanso 1,30 o 300 m" aria-label="Descanso o recuperación después de la serie (tiempo o metros)" autocomplete="off" enterkeyhint="done">' +
      '<select class="veces" aria-label="Cuántas series iguales añadir">' + [1, 2, 3, 4, 5, 6, 8, 10].map(n => '<option value="' + n + '">×' + n + '</option>').join("") + '</select>' +
      '<button class="anadir">+ Serie</button></div>' +
    '</form>';
  const nom = b.querySelector(".ej-nombre");
  nom.textContent = ej.nombre || "Sin nombre";
  nom.appendChild(etiquetaTipo(tipo));
  if (ej.video_url) { const v = document.createElement("span"); v.className = "ico"; v.textContent = "▶ vídeo"; nom.appendChild(v); }
  const dolor = molestiasDe(id);
  if (dolor.length) { const m = document.createElement("span"); m.className = "molestia-tag"; m.textContent = "⚠ " + dolor.map(x => x.zona).join(", "); m.title = dolor.map(x => x.zona + (x.descripcion ? ": " + x.descripcion : "")).join(" · "); nom.appendChild(m); }
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
  // − y +: kg (o %) y reps en fuerza; metros y segundos en carrera y natación
  b.querySelectorAll(".paso").forEach(p => {
    const inp = p.querySelector("input");
    p.querySelectorAll("button").forEach(x => x.addEventListener("click", () => {
      const clase = inp === fa ? (dist ? (porTiempo ? "t" : "m") : (enPct ? "pct" : "kg")) : (dist ? (porTiempo ? "m" : "t") : "reps");
      ajustarCampo(inp, clase, x.classList.contains("mas") ? 1 : -1);
      pintarCalc();
    }));
  });
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
    if (!enPct) { const d = usaBarra(id) ? textoDiscos(parseFloat((fa.value || "").replace(",", "."))) : ""; calc.textContent = d ? d[0].toUpperCase() + d.slice(1) : ""; return; }
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
    if (!s.calentamiento) numero++;
    const li = document.createElement("li");
    const planificada = !hecha(s);
    li.className = (planificada ? "plan" : "") + (s.calentamiento ? " calent" : "");
    li.innerHTML = '<span class="n"></span><button type="button" class="sv"><span class="sv-p"></span></button><button type="button" class="borrar">✕</button>';
    const marca = li.querySelector(".n");
    if (planificada) {
      // Círculo para marcarla como hecha tal cual estaba planificada
      const c = document.createElement("button");
      c.type = "button"; c.className = "marcar"; c.textContent = "";
      c.setAttribute("aria-label", "Marcar como hecha la serie " + numero);
      c.addEventListener("click", () => {
        if (s.ciclo_id === "auto") { li.querySelector(".sv").click(); return; }   // en Bilbo hay que apuntar las repeticiones
        marcarHecha(s, { ...s, hecha: true, peso: pesoMostrado(s) });
      });
      marca.replaceWith(c);
    } else marca.textContent = s.calentamiento ? "C" : numero;
    li.querySelector(".sv-p").textContent = (s.calentamiento ? "Calent. · " : "") + serieTexto(s);
    if (descTexto(s)) { const d = document.createElement("span"); d.className = "desc"; d.textContent = descTexto(s); li.querySelector(".sv").appendChild(d); }
    if (!dist && usaBarra(id) && textoDiscos(pesoMostrado(s))) { const d = document.createElement("span"); d.className = "discos"; d.textContent = textoDiscos(pesoMostrado(s)); li.querySelector(".sv").appendChild(d); }
    if (planificada && tipo === "carrera") { const o = objetivoSerie(s); if (o) { const ob = document.createElement("span"); ob.className = "objetivo"; ob.textContent = textoObjetivo(o); li.querySelector(".sv").appendChild(ob); } }
    li.querySelector(".sv").setAttribute("aria-label", (planificada ? "Completar" : "Editar") + " serie " + numero + ": " + serieTexto(s));
    li.querySelector(".sv").addEventListener("click", () => {
      if (li.dataset.deslizado) return;
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
    li.querySelector(".borrar").addEventListener("click", () => borrarSerie(s));
    // Deslizar: a la derecha la marca hecha; a la izquierda la borra (con Deshacer)
    deslizable(li, planificada && s.ciclo_id !== "auto" ? () => marcarHecha(s, { ...s, hecha: true, peso: pesoMostrado(s) }) : null, () => borrarSerie(s));
    li.dataset.sid = s.id;
    if (series.length > 1) li.appendChild(asaArrastre(li, () => [...ol.querySelectorAll(":scope > li[data-sid]")], n => reordenar(n.map(x => [db.series[x.dataset.sid]]), "Serie movida"), "Serie " + (s.calentamiento ? "de calentamiento" : numero)));
    ol.appendChild(li);
  });

  // Calentamiento sugerido antes de la primera serie efectiva (hoy y sin haber empezado)
  const pasosCalent = sugerenciaCalent(dia.id, id, series);
  if (pasosCalent) {
    const cal = document.createElement("div");
    cal.className = "calent-sug";
    cal.innerHTML = '<span class="cs-t"></span><span class="cs-b"><button type="button" class="nav-btn cs-no">No</button><button type="button" class="anadir cs-si">Añadir</button></span>';
    cal.querySelector(".cs-t").textContent = "¿Calentamiento? " + pasosCalent.map(p => (p.barra ? "barra" : num(p.peso) + " kg") + " × " + p.reps).join(" · ");
    cal.querySelector(".cs-si").addEventListener("click", () => aceptarCalent(dia.id, id, grupo, series, pasosCalent));
    cal.querySelector(".cs-no").addEventListener("click", () => { rechazarCalent(dia.id, id); pintarDia(dia); });
    ol.after(cal);
  }
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
    if (fila.hecha) avisarSiPR(fila);
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
  c.dataset.clave = "b:" + bloqueId;
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
      { texto: "Subir", accion: () => moverItem(dia.id, series[0].grupo || "", "b:" + bloqueId, -1) },
      { texto: "Bajar", accion: () => moverItem(dia.id, series[0].grupo || "", "b:" + bloqueId, 1) },
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
        m.addEventListener("click", () => marcarHecha(s, { ...s, hecha: true, peso: pesoMostrado(s) }));
        li.querySelector(".n").replaceWith(m);
      }
      deslizable(li, !hecha(s) ? () => marcarHecha(s, { ...s, hecha: true, peso: pesoMostrado(s) }) : null, null);
      li.querySelector(".sv-p").textContent = (variosTramos ? nombreEj(s.ejercicio_id) + " · " : "") + serieTexto(s);
      if (descTexto(s)) { const d = document.createElement("span"); d.className = "desc"; d.textContent = descTexto(s); li.querySelector(".sv").appendChild(d); }
      if (!hecha(s) && tipoDe(s.ejercicio_id) === "carrera") { const o = objetivoSerie(s); if (o) { const ob = document.createElement("span"); ob.className = "objetivo"; ob.textContent = textoObjetivo(o); li.querySelector(".sv").appendChild(ob); } }
      li.querySelector(".sv").setAttribute("aria-label", "Apuntar ronda " + r + ", " + nombreEj(s.ejercicio_id) + ": " + serieTexto(s));
      li.querySelector(".sv").addEventListener("click", () => { if (!li.dataset.deslizado) editar(s, li); });
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
    if (fila.hecha) avisarSiPR(fila);
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
  cambiar("ejercicios", { id, user_id: sesion.user_id, nombre: nombre.trim(), tipo: TIPOS[tipo] ? tipo : "fuerza", video_url: "", notas: "", compartido: puedeEditarCatalogo(), borrado: false });
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
    if (e.compartido) { const c = document.createElement("span"); c.className = "comun-tag"; c.textContent = "común"; nombre.appendChild(c); }
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
    if (document.activeElement !== $("detRm")) $("detRm").value = rmPersonal(e.id) > 0 ? num(rmPersonal(e.id)) : "";
    const p = st.lista.filter(s => n0(s.peso) > 0);
    $("detRmEst").textContent = p.length ? "Estimado con tus series: " + num(Math.round(Math.max.apply(null, p.map(rm)))) + " kg" + (rmPersonal(e.id) > 0 ? "" : " (se usa este)")
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
    li.querySelector(".h-f").textContent = fechaCorta(s.fecha) + (n0((db.entrenos[s.fecha] || {}).rpe) ? " · RPE " + db.entrenos[s.fecha].rpe : "");
    if ((db.entrenos[s.fecha] || {}).sensacion) li.title = db.entrenos[s.fecha].sensacion;
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
  cambiar("personales", { ejercicio_id: detalleId, rm: v > 0 ? v : 0 });
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
  // Los del catálogo común solo los editan el administrador y quien él autorice
  const puede = editable(e), propio = !e.user_id || e.user_id === sesion.user_id;
  ["detNombre", "detVideo", "detNotas"].forEach(x => { $(x).disabled = !puede; });
  $("detTipo").querySelectorAll("button").forEach(b => { b.disabled = !puede; });
  $("detBorrar").hidden = !puede || !puedeQuitarDelCatalogo(e);
  $("detAvisoComun").hidden = puede;
  $("detCompSec").hidden = !(puedeEditarCatalogo() && propio);
  $("detComp").checked = !!e.compartido;
  $("detComp").disabled = !puedeQuitarDelCatalogo(e);
  pintarVideo(e);
  refrescarDetalle();
  pintarZonasDetalle(e);
  if (!$("detalle").open) $("detalle").showModal();
  $("detalle").scrollTop = 0;
}
const editarEjercicio = cambios => { const e = ejercicioVivo(detalleId); if (editable(e)) cambiar("ejercicios", { ...e, ...cambios }); };
$("detComp").addEventListener("change", () => {
  if (!$("detComp").checked && !puedeQuitarDelCatalogo(ejercicioVivo(detalleId))) { $("detComp").checked = true; return; }
  editarEjercicio({ compartido: $("detComp").checked }); pintarTodo();
});
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
  if (!puedeQuitarDelCatalogo(ejercicioVivo(detalleId))) return;
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
// t en min; por debajo de 5 min la fórmula de Daniels deja de ser fiable, así que se toma 5 como mínimo
const fraccion = t => { t = Math.max(t, 5); return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t); };
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
  const todas = seriesVivas().filter(s => s.fecha === fecha && tipoDe(s.ejercicio_id) === "carrera" && !s.calentamiento).concat(extra || []);
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
  }).filter(Boolean).sort((x, y) => y.puntos - x.puntos).filter((s, i, todas) => s.puntos >= todas[0].puntos - 3).slice(0, 3);   // un día suave no rebaja la forma
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
  // Si los últimos días el esfuerzo (RPE) fue alto, el objetivo se suaviza un poco
  const fatiga = ajusteRpe(s.fecha), aj = carga.ajuste + fatiga;
  const suave = { ritmo: ritmoZona(f.vdot, 0.70) * (1 + aj), suave: true, fatiga: fatiga > 0 };
  if (!(n0(s.distancia) > 0) || esRecuperacion(s.ejercicio_id) || (ses.trabajo.length === 1 && n0(s.distancia) >= 3000)) return suave;
  const tiempoObj = x => n0(x.distancia) / velObjetivo(x, ses, f) * 60 * (1 + aj);
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
  return { tiempo, ritmo: tiempo / n0(s.distancia) * 1000, ajustado, fatiga: fatiga > 0 };
}
const textoObjetivo = o => !o ? "" : (o.suave ? "objetivo suave ~" + fmtTiempo(o.ritmo) + "/km"
  : "objetivo " + fmtTiempo(o.tiempo) + " (" + fmtTiempo(o.ritmo) + "/km)" + (o.ajustado ? " · ajustado a cómo vas" : "")) + (o.fatiga ? " · más suave por tu esfuerzo reciente" : "");
// Mejores marcas por distancia: exactas o, dentro de una serie algo más larga, a su ritmo medio
function marcasDe(tipo) {
  const lista = seriesVivas().filter(s => hecha(s) && !s.calentamiento && tipoDe(s.ejercicio_id) === tipo && n0(s.distancia) > 0 && n0(s.tiempo) > 0);
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
  if (semanasPropias(m)) return "Plan distinto cada semana (" + semanasPropias(m) + " semanas preparadas)";
  return NOMBRES.map((n, i) => (d[i] || []).length ? n.slice(0, 3) + ": " + d[i].map(pid => (db.plantillas[pid] || {}).nombre || "?").join(" + ") : "").filter(Boolean).join(" · ") || "Sin plantillas asignadas";
}
function pintarPlan() {
  const lp = $("listaPlantillas");
  lp.textContent = "";
  const todas = vivos("plantillas").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  // Buscador: por nombre o por los ejercicios que contiene, sin tildes ni mayúsculas
  const q = norm($("buscarPlantilla").value);
  const ps = q ? todas.filter(p => norm(p.nombre).includes(q) || norm(nombresItems(p.items || [])).includes(q)) : todas;
  contadorSec("plantillas", q ? ps.length + " de " + todas.length : todas.length);
  if (!todas.length) lp.innerHTML = '<p class="vacio-lista">Monta un entrenamiento en un día de la semana (por ejemplo, Pierna) y en su menú ⋯ elige «Guardar ejercicios como plantilla».</p>';
  else if (!ps.length) { const v = document.createElement("p"); v.className = "vacio-lista"; v.textContent = "Ninguna plantilla tiene «" + $("buscarPlantilla").value.trim() + "» en su nombre ni en sus ejercicios."; lp.appendChild(v); }
  ps.forEach(p => lp.appendChild(tarjeta(p.nombre, [resumenItems(p.items || []), nombresItems(p.items || [])], () => menuPlantilla(p))));

  const lm = $("listaMesos");
  lm.textContent = "";
  const hoy = iso(new Date());
  const ms = vivos("mesociclos").sort((a, b) => (b.inicio || "").localeCompare(a.inicio || ""));
  contadorSec("mesociclos", ms.length);
  contadorSec("molestias", molestiasActivas().length ? molestiasActivas().length + " activa" + (molestiasActivas().length === 1 ? "" : "s") : vivos("molestias").length);
  contadorSec("rutinas", RUTINAS_TIPO.length);
  contadorSec("usuarios", usuarios.filter(u => !u.aprobado).length ? usuarios.filter(u => !u.aprobado).length + " pendientes" : usuarios.length);
  if (!ms.length) lm.innerHTML = '<p class="vacio-lista">Un mesociclo reparte tus plantillas por los días de la semana durante varias semanas, con progresión de peso si quieres.</p>';
  ms.forEach(m => {
    const actual = m.inicio && hoy >= m.inicio && hoy < iso(sumarDias(deIso(m.inicio), n0(m.semanas) * 7));
    const semana = actual ? Math.floor((lunesDe(new Date()) - lunesDe(deIso(m.inicio))) / (7 * 864e5)) + 1 : 0;
    lm.appendChild(tarjeta(m.nombre, [rangoMeso(m) + (actual ? " · ahora en la semana " + semana : "") + (actual && esDescarga(m, semana - 1) ? " (descarga)" : ""),
      resumenDiasMeso(m) + (n0(m.progresion) ? " · +" + num(m.progresion) + " kg/semana" : "") + (textoDescarga(m) ? " · " + textoDescarga(m) : "")], () => abrirMeso(m.id)));
  });

  pintarSugerencias();
  pintarMolestias();
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
        b.addEventListener("click", () => cambiarPerfil(u.user_id, { aprobado: !u.aprobado }, !u.aprobado ? "Usuario aprobado" : "Acceso retirado"));
        if (!u.aprobado) { const p = document.createElement("span"); p.className = "pr"; p.textContent = "PENDIENTE"; est.appendChild(p); }
        est.appendChild(b);
        if (u.aprobado) {
          const l = document.createElement("label");
          l.className = "permiso";
          l.innerHTML = '<input type="checkbox"> Puede editar el catálogo común';
          const c = l.querySelector("input");
          c.checked = !!u.edita_catalogo;
          c.addEventListener("change", () => cambiarPerfil(u.user_id, { edita_catalogo: c.checked }, c.checked ? "Ahora puede editar el catálogo" : "Ya no puede editar el catálogo"));
          fila.appendChild(l);
        }
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
async function cambiarPerfil(uid, cambios, aviso) {
  try {
    const r = await api("/rest/v1/perfiles?user_id=eq." + encodeURIComponent(uid), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(cambios) });
    if (!r.ok) throw new Error();
    await cargarPerfil();
    setEstado(aviso);
  } catch { setEstado("No se ha podido cambiar. Revisa la conexión.", true); }
  pintarPlan();
}
function avisoUsuarios() {
  const n = usuarios.filter(u => !u.aprobado).length;
  $("tabPlan").querySelector("span").textContent = n ? "Plan · " + n : "Plan";
  $("tabPlan").classList.toggle("con-aviso", n > 0);
}

// Editor de mesociclo
let mesoEdit = null;
function abrirMeso(id) {
  const m = id ? db.mesociclos[id] : null;
  mesoEdit = m ? { ...m, dias: JSON.parse(JSON.stringify(m.dias || {})) }
               : { id: nuevoId(), nombre: "", inicio: iso(lunesDe(new Date())), semanas: 4, dias: {}, progresion: 0, descarga: {}, notas: "", borrado: false, nuevo: true };
  const desc = mesoEdit.descarga || {};
  $("mesoDescUltima").checked = !!desc.ultima;
  $("mesoDescCada").value = n0(desc.cada) >= 2 ? desc.cada : "";
  $("mesoDescPct").value = n0(desc.pct) > 0 ? desc.pct : "";
  $("mesoDescModo").value = desc.modo === "series" ? "series" : "carga";
  $("mesoNombre").value = mesoEdit.nombre;
  $("mesoInicio").value = mesoEdit.inicio;
  $("mesoSemanas").value = mesoEdit.semanas;
  $("mesoProg").value = n0(mesoEdit.progresion) ? num(mesoEdit.progresion) : "";
  $("mesoNotas").value = mesoEdit.notas || "";
  $("mesoBorrar").hidden = !!mesoEdit.nuevo;
  $("mesoQuitar").hidden = !!mesoEdit.nuevo;
  $("mesoCompartir").hidden = !!mesoEdit.nuevo;
  $("mesoBorrar").classList.remove("confirmar"); $("mesoBorrar").textContent = "Eliminar mesociclo";
  $("mesoAviso").textContent = "";
  pintarDiasMeso();
  $("dlgMeso").showModal();
}
function pintarDiasMeso() {
  const cont = $("mesoDias");
  cont.textContent = "";
  if (semanasPropias(mesoEdit)) {
    cont.appendChild(nota("Este mesociclo viene de un plan que cambia cada semana: cada semana usa sus propias plantillas (las que empiezan por «S1 ·», «S2 ·»…). Puedes editarlas en Plan → Plantillas."));
    return;
  }
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
  const cada = parseInt($("mesoDescCada").value, 10) || 0, pct = parseFloat(($("mesoDescPct").value || "30").replace(",", "."));
  if (cada === 1 || cada < 0) { $("mesoAviso").textContent = "La descarga «cada N semanas» debe ser 2 o más (o déjalo vacío)."; return null; }
  if (!(pct > 0 && pct < 100)) { $("mesoAviso").textContent = "La reducción de la descarga debe estar entre 1 y 99 %."; return null; }
  const descarga = $("mesoDescUltima").checked || cada ? { ultima: $("mesoDescUltima").checked, cada, pct, modo: $("mesoDescModo").value } : {};
  const m = { ...mesoEdit, nombre, inicio: iso(lunesDe(deIso(inicio))), semanas, progresion, descarga, notas: $("mesoNotas").value };
  delete m.nuevo;
  return m;
}
function quitarMesoDelCalendario(mesoId) {
  let n = 0;
  seriesVivas().filter(s => s.meso_id === mesoId && !hecha(s)).forEach(s => { cambiar("series", { ...s, borrado: true }, true); n++; });
  return n;
}
// Rellena el calendario: cada semana, cada día con sus plantillas; la progresión suma kg cada semana
// y las semanas de descarga bajan la carga o el número de series
function aplicarMeso(m) {
  quitarMesoDelCalendario(m.id);
  const lunes = deIso(m.inicio);
  let total = 0;
  for (let w = 0; w < m.semanas; w++) {
    const diasSemana = (m.dias || {})["s" + (w + 1)] || m.dias || {};
    for (let d = 0; d < 7; d++) {
      const fecha = iso(sumarDias(lunes, w * 7 + d));
      (diasSemana[d] || []).forEach(pid => {
        const p = db.plantillas[pid];
        if (!p || p.borrado) return;
        const items = esDescarga(m, w) ? descargarItems(p.items || [], m.descarga, w * n0(m.progresion)) : p.items || [];
        pegarItems(fecha, items, p.nombre, m.id, esDescarga(m, w) ? 0 : w * n0(m.progresion));
        total += contarSeries(items);
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
  pintarResumen();
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

// ---------- Esfuerzo (RPE) y sensaciones de cada día ----------
const RPE_TEXTO = ["", "Muy suave", "Muy suave", "Suave", "Suave", "Moderado", "Moderado", "Duro", "Duro", "Muy duro", "Máximo"];
// Media del RPE de los últimos días (hasta 3 en los 10 anteriores): si fue alto, los objetivos de carrera bajan un poco
function ajusteRpe(fecha) {
  const desde = iso(sumarDias(deIso(fecha), -10));
  const ult = Object.values(db.entrenos).filter(e => n0(e.rpe) > 0 && e.fecha < fecha && e.fecha >= desde).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3);
  if (!ult.length) return 0;
  const media = ult.reduce((x, e) => x + n0(e.rpe), 0) / ult.length;
  return media >= 9 ? 0.03 : media >= 8 ? 0.02 : 0;
}
function pintarRpe(dia) {
  const e = db.entrenos[dia.id] || {}, r = n0(e.rpe), el = dia.rpeEl;
  const algo = seriesDelDia(dia.id).some(hecha) || aTexto(e.html || "").trim();
  el.hidden = !r && !e.sensacion && !(algo && dia.id <= iso(new Date()));
  el.classList.toggle("con-rpe", r > 0 || !!e.sensacion);
  el.textContent = r || e.sensacion ? (r ? "Esfuerzo " + r + "/10 · " + RPE_TEXTO[r] : "Sensaciones") + (e.sensacion ? " — " + e.sensacion : "") : "+ Esfuerzo y sensaciones";
}
let rpeDia = null, rpeSel = 0;
const rpeEscala = $("rpeEscala");
for (let k = 1; k <= 10; k++) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = k; b.dataset.v = k;
  b.setAttribute("aria-label", "Esfuerzo " + k + ": " + RPE_TEXTO[k]);
  rpeEscala.appendChild(b);
}
function marcarRpe() {
  rpeEscala.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === rpeSel)));
  $("rpeTexto").textContent = rpeSel ? rpeSel + "/10 · " + RPE_TEXTO[rpeSel] : "1 = muy suave, 10 = esfuerzo máximo.";
}
rpeEscala.addEventListener("click", ev => { const b = ev.target.closest("button"); if (b) { rpeSel = +b.dataset.v === rpeSel ? 0 : +b.dataset.v; marcarRpe(); } });
function abrirRpe(dia) {
  rpeDia = dia;
  const e = db.entrenos[dia.id] || {};
  rpeSel = n0(e.rpe);
  $("rpeTit").textContent = "Esfuerzo · " + NOMBRES[dia.i] + " " + fmt(deIso(dia.id));
  $("rpeNota").value = e.sensacion || "";
  marcarRpe();
  $("dlgRpe").showModal();
}
function guardarRpe(rpe, sensacion) {
  const e = db.entrenos[rpeDia.id] || { html: "", texto: "" };
  cambiar("entrenos", { ...e, fecha: rpeDia.id, rpe, sensacion });
  $("dlgRpe").close();
  pintarRpe(rpeDia);
  pintarResumen();
}
$("rpeGuardar").addEventListener("click", () => guardarRpe(rpeSel, $("rpeNota").value.trim().slice(0, 300)));
$("rpeQuitar").addEventListener("click", () => guardarRpe(0, ""));

// ---------- Resumen de la semana, comparado con la anterior ----------
function datosSemana(lunes) {
  const ini = iso(lunes), fin = iso(sumarDias(lunes, 7));
  const todas = seriesVivas().filter(s => s.fecha >= ini && s.fecha < fin && !s.calentamiento), hechas = todas.filter(hecha);
  const r = { series: hechas.length, total: todas.length, km: 0, nado: 0, kg: 0, prs: 0, dias: new Set(hechas.map(s => s.fecha)).size };
  hechas.forEach(s => { if (tipoDe(s.ejercicio_id) === "fuerza") r.kg += n0(s.peso) * n0(s.reps); });
  // Los km y metros sí incluyen calentamiento y vuelta a la calma: también se corren
  seriesVivas().filter(s => s.fecha >= ini && s.fecha < fin && hecha(s)).forEach(s => {
    const t = tipoDe(s.ejercicio_id);
    if (t === "carrera") r.km += n0(s.distancia) / 1000; else if (t === "natacion") r.nado += n0(s.distancia);
  });
  [...new Set(hechas.map(s => s.ejercicio_id))].forEach(id => { const prs = prsDe(seriesDe(id), tipoDe(id)); hechas.forEach(s => { if (prs.has(s.id)) r.prs++; }); });
  const rpes = Object.values(db.entrenos).filter(e => e.fecha >= ini && e.fecha < fin && n0(e.rpe) > 0).map(e => n0(e.rpe));
  r.rpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 0;
  return r;
}
let claveResumen = "";
function pintarResumen() {
  const lunes = lunesVista(), clave = versionDatos + "|" + iso(lunes);
  if (clave === claveResumen) return;
  claveResumen = clave;
  const a = datosSemana(lunes), b = datosSemana(sumarDias(lunes, -7));
  $("resumenSem").hidden = !a.total && !b.series && !a.rpe;
  if ($("resumenSem").hidden) return;
  const km = v => num(Math.round(v * 10) / 10) + " km", kg = v => num(Math.round(v)) + " kg", uno = v => num(Math.round(v * 10) / 10);
  const dif = (x, y, f) => Math.abs(x - y) < 1e-9 ? "igual que la semana anterior" : (x > y ? "+" : "−") + f(Math.abs(x - y)) + " frente a la anterior";
  $("resumenLinea").textContent = [a.km || b.km ? km(a.km) : "", a.kg || b.kg ? kg(a.kg) : "", a.series + "/" + a.total + " series", a.prs ? a.prs + " PR" : ""].filter(Boolean).join(" · ");
  const cont = $("resumenCont");
  cont.textContent = "";
  if (a.km || b.km) cont.appendChild(recuadro("Carrera", km(a.km), dif(a.km, b.km, km)));
  if (a.nado || b.nado) cont.appendChild(recuadro("Natación", fmtDist(a.nado), dif(a.nado, b.nado, fmtDist)));
  if (a.kg || b.kg) cont.appendChild(recuadro("Fuerza (kg × reps)", kg(a.kg), dif(a.kg, b.kg, kg)));
  cont.appendChild(recuadro("Series hechas", a.series + " de " + a.total, (a.total ? Math.round(a.series / a.total * 100) + " % de lo planificado · " : "") + "anterior: " + b.series + " de " + b.total));
  cont.appendChild(recuadro("Días entrenados", String(a.dias), "anterior: " + b.dias));
  cont.appendChild(recuadro("Récords (PR)", String(a.prs), "anterior: " + b.prs, a.prs > 0));
  if (a.rpe || b.rpe) cont.appendChild(recuadro("Esfuerzo medio", a.rpe ? uno(a.rpe) + "/10" : "—", b.rpe ? "anterior: " + uno(b.rpe) + "/10" : "sin datos la semana anterior"));
}
$("resumenSem").open = !!leer("resumen-abierto-v1");
$("resumenSem").addEventListener("toggle", () => escribir("resumen-abierto-v1", $("resumenSem").open));

// ---------- Semana de descarga de los mesociclos ----------
const semanasPropias = m => Object.keys((m && m.dias) || {}).filter(k => /^s\d+$/.test(k)).length;
function esDescarga(m, w) {
  const d = (m && m.descarga) || {};
  return !!(d.ultima && w === n0(m.semanas) - 1) || (n0(d.cada) >= 2 && (w + 1) % n0(d.cada) === 0);
}
function textoDescarga(m) {
  const d = m.descarga || {}, cuando = [d.ultima && "la última semana", n0(d.cada) >= 2 && "cada " + d.cada + " semanas"].filter(Boolean);
  return cuando.length ? "descarga " + cuando.join(" y ") + " (−" + num(n0(d.pct) || 30) + " % " + (d.modo === "series" ? "series" : "carga") + ")" : "";
}
// En descarga: menos peso, % y distancia (modo carga) o menos series (modo series); Bilbo no cambia
function descargarItems(items, desc, masKg) {
  const f = 1 - (n0((desc || {}).pct) || 30) / 100, porSeries = (desc || {}).modo === "series";
  const conKg = v => n0(v.peso) > 0 ? n0(v.peso) + n0(masKg) : 0;
  const ajustar = v => v.bilbo ? v : porSeries ? { ...v, peso: conKg(v) } : {
    ...v, peso: conKg(v) ? redondear(conKg(v) * f) : 0, pct: n0(v.pct) > 0 ? Math.round(n0(v.pct) * f) : 0,
    distancia: n0(v.distancia) > 0 ? Math.round(n0(v.distancia) * f / 10) * 10 : 0, tiempo: Math.round(n0(v.tiempo) * f)
  };
  const recortar = lista => porSeries ? lista.slice(0, Math.max(1, Math.round(lista.length * f))) : lista;
  return items.map(it => it.bloque ? { ...it, tramos: (it.tramos || []).map(t => ({ ...t, series: recortar(t.series || []).map(ajustar) })) }
                                   : { ...it, series: recortar(it.series || []).map(ajustar) });
}

// ---------- Copia de seguridad: JSON completo (sirve para restaurar) y CSV para Excel ----------
function descargarArchivo(nombre, texto, tipo) {
  const archivo = new File([texto], nombre, { type: tipo });
  // En el iPhone se abre el menú de compartir (Guardar en Archivos, AirDrop…); en el ordenador, una descarga normal
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare && navigator.canShare({ files: [archivo] })) {
    navigator.share({ files: [archivo], title: nombre }).catch(() => {});
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(archivo);
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const diaSemana = f => NOMBRES[(deIso(f).getDay() + 6) % 7];
const celda = v => { let t = String(v ?? ""); if (/^[=+\-@]/.test(t)) t = "'" + t; return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
const decimal = n => n ? String(Math.round(n * 100) / 100).replace(".", ",") : "";
const csv = filas => "﻿" + filas.map(f => f.map(celda).join(";")).join("\r\n");   // con ; y coma decimal, como lo espera Excel en español
function exportarJSON() {
  const datos = {};
  Object.keys(TABLAS).forEach(t => { datos[t] = Object.values(db[t]).map(f => { const c = { ...f }; delete c.sucio; return c; }); });
  descargarArchivo("entreno-copia-" + iso(new Date()) + ".json", JSON.stringify({ app: "Entreno Semanal", version: 1, exportado: new Date().toISOString(), email: (sesion && sesion.email) || "", datos }), "application/json");
}
function exportarSeries() {
  const filas = [["Fecha", "Día", "Sesión", "Ejercicio", "Tipo", "Estado", "Peso (kg)", "% 1RM", "Reps", "Distancia (m)", "Tiempo", "Ritmo", "Descanso", "Recuperación (m)", "Bloque", "Esfuerzo del día (RPE)", "Sensaciones del día"]];
  seriesVivas().sort(ordenSerie).forEach(s => {
    const tipo = tipoDe(s.ejercicio_id), e = db.entrenos[s.fecha] || {};
    filas.push([s.fecha, diaSemana(s.fecha), s.grupo || "", nombreEj(s.ejercicio_id), TIPOS[tipo].nombre, (s.calentamiento ? "Calentamiento · " : "") + (hecha(s) ? "Hecha" : "Planificada"),
      decimal(pesoMostrado(s)), decimal(n0(s.pct)), n0(s.reps) || "", decimal(n0(s.distancia)), n0(s.tiempo) ? fmtTiempo(s.tiempo) : "",
      esDistancia(tipo) && conMarca(s) ? ritmo(s, tipo) : "", n0(s.descanso) ? fmtTiempo(s.descanso) : "", decimal(n0(s.rec_dist)),
      s.bloque_id ? "Ronda " + n0(s.ronda) : "", n0(e.rpe) || "", e.sensacion || ""]);
  });
  descargarArchivo("entreno-series-" + iso(new Date()) + ".csv", csv(filas), "text/csv");
}
function exportarDias() {
  const filas = [["Fecha", "Día", "Texto del día", "Esfuerzo (RPE)", "Sensaciones"]];
  Object.values(db.entrenos).filter(e => aTexto(e.html || "").trim() || n0(e.rpe) || e.sensacion).sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach(e => filas.push([e.fecha, diaSemana(e.fecha), aTexto(e.html || "").trim(), n0(e.rpe) || "", e.sensacion || ""]));
  descargarArchivo("entreno-dias-" + iso(new Date()) + ".csv", csv(filas), "text/csv");
}
// Restaurar: recupera lo que falta, lo borrado o lo más antiguo aquí; nunca borra nada
function restaurar(archivo) {
  const lector = new FileReader();
  lector.onload = () => {
    let j = null;
    try { j = JSON.parse(lector.result); } catch {}
    if (!j || j.app !== "Entreno Semanal" || !j.datos) { setEstado("Ese archivo no es una copia de Entreno Semanal.", true); return; }
    const cambios = [];
    Object.keys(TABLAS).forEach(t => (Array.isArray(j.datos[t]) ? j.datos[t] : []).forEach(f => {
      const k = f && f[TABLAS[t].clave];
      if (!k || (t === "ejercicios" && f.compartido && f.user_id && f.user_id !== sesion.user_id)) return;   // el catálogo común no es tuyo
      const local = db[t][k];
      if (!local || (local.borrado && !f.borrado) || Date.parse(f.actualizado) > Date.parse(local.actualizado)) cambios.push([t, f]);
    }));
    if (!cambios.length) { setEstado("La copia no tiene nada que no esté ya en la app."); return; }
    abrirMenu("Restaurar copia", "Copia del " + (j.exportado ? fechaCorta(iso(new Date(j.exportado))) : "?") + ": se recuperan " + cambios.length + " elementos que faltan o son más antiguos aquí. No se borra nada de lo que tienes.", [
      { texto: "Restaurar " + cambios.length + " elementos", accion: () => {
        cambios.forEach(([t, f]) => {
          const fila = {};
          TABLAS[t].campos.forEach(c => { if (f[c] !== undefined) fila[c] = f[c]; });
          if (t === "ejercicios" && !(f.compartido && f.user_id === sesion.user_id)) fila.user_id = sesion.user_id;
          cambiar(t, fila, true);
        });
        persistir(); pintarTodo(); setEstado("Copia restaurada: " + cambios.length + " elementos");
      } }
    ]);
  };
  lector.readAsText(archivo);
}
$("expJson").addEventListener("click", exportarJSON);
$("expCsv").addEventListener("click", exportarSeries);
$("expDias").addEventListener("click", exportarDias);
$("impJson").addEventListener("change", ev => { const f = ev.target.files[0]; ev.target.value = ""; if (f) restaurar(f); });

// ---------- Rutinas en texto: las de ejemplo y las que escribe una IA usan el mismo formato ----------
// RUTINA: nombre / NOTA: … / SEMANAS: n / SEMANA n / ## Sesión @ Lunes, Jueves / - Ejercicio [tipo]: 4x8 @RPE8 desc 2:00 / - BLOQUE x4: A [carrera] 400m | B [carrera] 200m
const TIPO_TEXTO = { fuerza: "fuerza", carrera: "carrera", natacion: "natacion", nado: "natacion" };
function leerValor(txt, tipo) {
  // Une «400 m» → «400m» para leer cada valor como una sola palabra
  const t = txt.replace(/(\d)\s+(km|m|min|s|seg|reps?)\b/gi, "$1$2").replace(/(\d)\s*(minutos?|mins?)\b/gi, "$1min").trim();
  const v = { peso: 0, reps: 0, distancia: 0, tiempo: 0, descanso: 0, rec_dist: 0, pct: 0, bilbo: false };
  const tok = (t.split(/\s+/)[0] || "").toLowerCase().replace(/,(?=\d)/, ".");
  let rpe = 0, m;
  if ((m = t.match(/@?\s*RPE\s*(\d+(?:[.,]\d)?)/i))) rpe = parseFloat(m[1].replace(",", "."));
  if ((m = t.match(/@\s*(\d+(?:[.,]\d+)?)\s*%/))) v.pct = parseFloat(m[1].replace(",", "."));
  if ((m = t.match(/@\s*(\d+(?:[.,]\d+)?)\s*kg/i))) v.peso = parseFloat(m[1].replace(",", "."));
  const ritmoM = t.match(/@?\s*(?:ritmo\s*)?(\d+[:'´’]\d{2})\s*\/\s*(km|100\s*m)/i);
  const recM = t.match(/\b(?:desc(?:anso)?|rec(?:uperaci[oó]n)?)\.?\s*:?\s*(\d+(?:[.,:'´’]\d+)?)\s*(m\b|metros|min|s\b|seg)?/i);
  if (recM) {
    const n = recM[1], u = (recM[2] || "").toLowerCase();
    if (u === "m" || u === "metros") v.rec_dist = parseFloat(n.replace(",", "."));
    else if (u === "min") v.descanso = leerTiempo(n);
    else if (u === "s" || u === "seg") v.descanso = Math.round(parseFloat(n.replace(",", ".")));
    else v.descanso = leerDescanso(n);
    if (isNaN(v.descanso)) return { error: "no entiendo el descanso «" + recM[0] + "»" };
  }
  if ((m = tok.match(/^(\d+(?:\.\d+)?)(km|m)$/))) v.distancia = parseFloat(m[1]) * (m[2] === "km" ? 1000 : 1);
  else if ((m = tok.match(/^(\d+(?:\.\d+)?)(min|')$/))) v.tiempo = Math.round(parseFloat(m[1]) * 60);
  else if ((m = tok.match(/^(\d+)(s|seg|")$/))) v.tiempo = +m[1];
  else if (/^\d+[:'´’]\d{2}([:'´’]\d{2})?$/.test(tok)) v.tiempo = leerTiempo(tok);
  else if ((m = tok.match(/^(\d+)(?:-\d+)?(?:reps?)?$/))) v.reps = +m[1];
  else if (/^(m[aá]x|amrap|fallo)/.test(tok)) v.reps = 0;
  else return { error: "no entiendo «" + tok + "» (usa 8, máx, 400m, 40min o 3:30)" };
  if (tipo !== "fuerza" && v.reps >= 25) { v.distancia = v.reps; v.reps = 0; }   // «6x1000» en carrera son metros
  if (tipo === "fuerza" && (v.distancia || v.tiempo)) return { error: "en fuerza las series van en repeticiones (por ejemplo 3x12)" };
  if (tipo !== "fuerza" && !v.distancia && !v.tiempo) return { error: "en " + TIPOS[tipo].nombre.toLowerCase() + " las series van en metros o tiempo (por ejemplo 5x1000m o 1x40min)" };
  // RPE en fuerza → % del 1RM con la misma fórmula del 1RM estimado (reps + las que quedan en reserva)
  if (tipo === "fuerza" && rpe && v.reps && !v.pct && !v.peso) v.pct = Math.max(50, Math.min(100, Math.round(100 / (1 + (v.reps + 10 - rpe) / 30))));
  if (ritmoM && v.distancia) v.tiempo = Math.round(leerTiempo(ritmoM[1]) * v.distancia / (/km/i.test(ritmoM[2]) ? 1000 : 100));
  return v;
}
function leerEjercicio(txt, conCuenta) {
  const m = txt.match(/^(.+?)\s*\[([^\]]+)\]\s*:?\s*(.*)$/) || txt.match(/^([^:]+):\s*(.*)$/);
  if (!m) return { error: conCuenta ? "falta «:» entre el ejercicio y las series (por ejemplo «Sentadilla [fuerza]: 4x8»)" : "cada tramo va como «Ejercicio [tipo] 400m»" };
  const nombre = m[1].trim(), conTipo = m.length === 4, resto = (conTipo ? m[3] : m[2]).trim();
  const tipo = conTipo ? TIPO_TEXTO[norm(m[2]).replace(/[^a-z]/g, "")] : adivinarTipo(nombre);
  if (!tipo) return { error: "tipo «" + m[2] + "» desconocido (usa fuerza, carrera o natacion)" };
  if (!nombre) return { error: "falta el nombre del ejercicio" };
  const series = [];
  for (const parte of resto.split(/\s+\+\s+/)) {
    const c = conCuenta ? parte.match(/^(\d+)\s*[x×]\s*(.+)$/i) : [null, "1", parte];
    if (!c) return { error: "las series van como 4x8, 5x1000m o 1x40min" };
    if (!(+c[1] >= 1 && +c[1] <= 50)) return { error: "entre 1 y 50 series" };
    const v = leerValor(c[2], tipo);
    if (v.error) return v;
    for (let k = 0; k < +c[1]; k++) series.push({ ...v });
  }
  return { ejercicio: nombre.slice(0, 80), tipo, series };
}
function leerRutina(texto) {
  const lineas = String(texto || "").replace(/\r/g, "").split("\n");
  const r = { nombre: "", nota: "", semanas: 0, bloques: [] };
  let semana = null, sesion = null, dentro = false;
  const fallo = (i, msg) => ({ error: "Línea " + (i + 1) + ": " + msg + ". Dice: «" + lineas[i].trim().slice(0, 90) + "»" });
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i].trim().replace(/^\*\*(.*)\*\*$/, "$1");
    let m;
    if (/^```/.test(l)) { if (dentro && r.bloques.length) break; continue; }
    if ((m = l.match(/^RUTINA\s*:\s*(.+)$/i))) { r.nombre = m[1].trim().slice(0, 60); dentro = true; continue; }
    if (!dentro || !l || /^-{3,}$/.test(l)) continue;   // lo que la IA escriba antes de «RUTINA:» se ignora
    if ((m = l.match(/^NOTA\s*:\s*(.*)$/i))) { r.nota += (r.nota ? " " : "") + m[1].trim(); continue; }
    if ((m = l.match(/^SEMANAS\s*:\s*(\d+)/i))) { r.semanas = Math.min(26, +m[1]); continue; }
    if ((m = l.match(/^[=#\s]*SEMANA\s+(\d+)[=\s:]*$/i))) { semana = { sesiones: [] }; r.bloques.push(semana); sesion = null; continue; }
    if ((m = l.match(/^#{1,3}\s*(.+)$/))) {
      const [nom, cuando] = m[1].split("@");
      const dias = [];
      for (const d of (cuando || "").split(/,|\s+y\s+/).map(x => norm(x).slice(0, 3)).filter(Boolean)) {
        const k = DIAS.findIndex(x => x.startsWith(d));
        if (k < 0) return fallo(i, "no reconozco el día «" + d + "» (usa Lunes, Martes…)");
        if (!dias.includes(k)) dias.push(k);
      }
      if (!semana) { semana = { sesiones: [] }; r.bloques.push(semana); }
      sesion = { nombre: nom.trim().slice(0, 50) || "Sesión", dias, items: [] };
      semana.sesiones.push(sesion);
      continue;
    }
    if ((m = l.match(/^[-•*]\s*(.+)$/))) {
      if (!sesion) return fallo(i, "falta antes una sesión que empiece por ## (por ejemplo «## Pierna @ Lunes»)");
      const b = m[1].match(/^BLOQUE\s*[x×]\s*(\d+)\s*:?\s*(.+)$/i);
      if (b) {
        const rondas = +b[1], tramos = [];
        if (!(rondas >= 1 && rondas <= 50)) return fallo(i, "un bloque se repite entre 1 y 50 veces");
        for (const t of b[2].split("|")) {
          const e = leerEjercicio(t.trim(), false);
          if (e.error) return fallo(i, e.error);
          tramos.push({ ejercicio: e.ejercicio, tipo: e.tipo, series: Array.from({ length: rondas }, () => ({ ...e.series[0] })) });
        }
        sesion.items.push({ bloque: true, tramos });
      } else {
        const e = leerEjercicio(m[1], true);
        if (e.error) return fallo(i, e.error);
        sesion.items.push(e);
      }
      continue;
    }
    return fallo(i, "no entiendo esta línea");
  }
  if (!r.nombre) return { error: "Falta la línea «RUTINA: nombre». Copia la respuesta completa de la IA." };
  r.bloques = r.bloques.filter(b => b.sesiones.some(s => s.items.length));
  r.bloques.forEach(b => { b.sesiones = b.sesiones.filter(s => s.items.length); });
  if (!r.bloques.length) return { error: "No hay ninguna sesión con ejercicios (cada sesión empieza por ## y sus ejercicios por -)." };
  r.multi = r.bloques.length > 1;
  r.conDias = r.bloques.some(b => b.sesiones.some(s => s.dias.length));
  return r;
}
// Texto corto de un ejercicio de la rutina: «Press banca 4×8 · 75 % · desc. 2:00»
function textoValor(v, tipo) {
  const base = esDistancia(tipo) ? (v.distancia ? fmtDist(v.distancia) + (v.tiempo ? " en " + fmtTiempo(v.tiempo) : "") : fmtDuracion(v.tiempo))
    : (v.reps || "máx") + (v.pct ? " · " + num(v.pct) + " %" : "") + (v.peso ? " · " + num(v.peso) + " kg" : "");
  return base + (v.rec_dist ? " · rec. " + fmtDist(v.rec_dist) : v.descanso ? " · desc. " + fmtTiempo(v.descanso) : "");
}
const textoItemRutina = it => it.bloque
  ? "(" + it.tramos.map(t => t.ejercicio + " " + textoValor(t.series[0], t.tipo)).join(" + ") + ") ×" + it.tramos[0].series.length
  : it.ejercicio + " " + it.series.length + "×" + textoValor(it.series[0], it.tipo) + (it.series.some(v => JSON.stringify(v) !== JSON.stringify(it.series[0])) ? " (con variaciones)" : "");
const textoDias = dias => dias.map(d => NOMBRES[d].slice(0, 3)).join(", ");
const lunesSiguiente = () => { const hoy = new Date(); return iso(hoy.getDay() === 1 ? lunesDe(hoy) : sumarDias(lunesDe(hoy), 7)); };
const semanasRutina = r => r.semanas || (r.multi ? r.bloques.length : 4);
// Guarda la rutina como plantillas (y, si se pide, un mesociclo que las reparte por los días); los ejercicios que falten se crean
function guardarRutina(r, comoMeso, inicio, semanas) {
  const usados = new Set(vivos("plantillas").map(p => norm(p.nombre)));
  const libre = n => { let x = n, k = 2; while (usados.has(norm(x))) x = n + " (" + k++ + ")"; usados.add(norm(x)); return x; };
  const prefijo = r.nombre.split(/[(:·]/)[0].trim();
  const dias = {};
  let n = 0;
  r.bloques.forEach((b, w) => {
    const destino = r.multi ? (dias["s" + (w + 1)] = {}) : dias;
    b.sesiones.forEach(s => {
      const id = nuevoId();
      cambiar("plantillas", { id, nombre: libre(r.multi ? prefijo + " · S" + (w + 1) + " · " + s.nombre : s.nombre), items: desdeCompartido(s.items), borrado: false }, true);
      n++;
      s.dias.forEach(d => (destino[d] = destino[d] || []).push(id));
    });
  });
  if (comoMeso) {
    const id = nuevoId();
    cambiar("mesociclos", { id, nombre: r.nombre, inicio, semanas, dias, progresion: 0, descarga: {}, notas: r.nota || "", borrado: false }, true);
    persistir(); pintarPlan();
    setEstado("Mesociclo «" + r.nombre + "» creado con " + n + " plantillas. Revísalo y pulsa «Guardar y rellenar calendario».");
    abrirMeso(id);
  } else {
    persistir(); pintarPlan();
    setEstado(n + (n === 1 ? " plantilla guardada" : " plantillas guardadas") + " desde «" + r.nombre + "»");
  }
}
function vistaRutina(r, cont) {
  cont.textContent = "";
  if (r.nota) cont.appendChild(nota(r.nota));
  r.bloques.forEach((b, w) => {
    if (r.multi) { const h = document.createElement("p"); h.className = "bc-t"; h.textContent = "Semana " + (w + 1); cont.appendChild(h); }
    b.sesiones.forEach(s => {
      const d = document.createElement("div");
      d.className = "rutina-ses";
      const t = document.createElement("b");
      t.textContent = s.nombre + (s.dias.length ? " · " + textoDias(s.dias) : " · sin día");
      const ul = document.createElement("ul");
      s.items.forEach(it => { const li = document.createElement("li"); li.textContent = textoItemRutina(it); ul.appendChild(li); });
      d.append(t, ul);
      cont.appendChild(d);
    });
  });
}

// Rutinas de ejemplo (sugerencias generales)
const RUTINAS_TIPO = [
`RUTINA: Cuerpo completo 3 días
SEMANAS: 8
NOTA: Para quien empieza o vuelve a entrenar. Usa un peso con el que te sobren 2 o 3 repeticiones; cuando completes todas las series con buena técnica, sube 2,5 kg (1 o 2 kg en los ejercicios pequeños).
## Cuerpo completo A @ Lunes, Viernes
- Sentadilla [fuerza]: 3x8 @RPE7 desc 2:00
- Press banca [fuerza]: 3x8 @RPE7 desc 2:00
- Remo con barra [fuerza]: 3x10 @RPE7 desc 1:30
- Zancadas [fuerza]: 2x10 desc 1:00
## Cuerpo completo B @ Miércoles
- Peso muerto rumano [fuerza]: 3x8 @RPE7 desc 2:00
- Press militar [fuerza]: 3x8 @RPE7 desc 1:30
- Jalón al pecho [fuerza]: 3x10 @RPE7 desc 1:30
- Hip thrust [fuerza]: 3x10 desc 1:30`,
`RUTINA: Torso / Pierna 4 días
SEMANAS: 6
NOTA: Para quien ya entrena con regularidad. RPE 8 es dejar unas 2 repeticiones en reserva. Sube el peso cuando hagas todas las repeticiones; si te estancas dos semanas seguidas, haz una semana de descarga.
## Torso A @ Lunes
- Press banca [fuerza]: 4x6 @RPE8 desc 2:30
- Remo con barra [fuerza]: 4x8 @RPE8 desc 2:00
- Press militar [fuerza]: 3x8 @RPE8 desc 2:00
- Dominadas [fuerza]: 3xmáx desc 2:00
- Curl de bíceps [fuerza]: 2x12 desc 1:00
## Pierna A @ Martes
- Sentadilla [fuerza]: 4x6 @RPE8 desc 3:00
- Peso muerto rumano [fuerza]: 3x8 @RPE8 desc 2:00
- Zancadas [fuerza]: 3x10 desc 1:30
- Curl femoral [fuerza]: 3x12 desc 1:00
## Torso B @ Jueves
- Press inclinado con mancuernas [fuerza]: 4x10 @RPE8 desc 2:00
- Jalón al pecho [fuerza]: 4x10 @RPE8 desc 1:30
- Fondos [fuerza]: 3xmáx desc 1:30
- Elevaciones laterales [fuerza]: 3x15 desc 1:00
- Extensión de tríceps [fuerza]: 2x12 desc 1:00
## Pierna B @ Viernes
- Peso muerto [fuerza]: 3x5 @RPE8 desc 3:00
- Prensa [fuerza]: 3x10 @RPE8 desc 2:00
- Hip thrust [fuerza]: 3x10 desc 1:30
- Gemelos [fuerza]: 3x15 desc 1:00`,
`RUTINA: Empezar a correr (0 a 5 km)
NOTA: Para quien no corre o lleva mucho sin hacerlo. Trota a un ritmo al que puedas hablar. Si una semana se te hace muy dura, repítela antes de pasar a la siguiente.
SEMANA 1
## Correr y caminar @ Lunes, Miércoles, Sábado
- Caminar [carrera]: 1x5min
- BLOQUE x8: Trote suave [carrera] 1min | Caminar [carrera] 1:30
SEMANA 2
## Correr y caminar @ Lunes, Miércoles, Sábado
- Caminar [carrera]: 1x5min
- BLOQUE x6: Trote suave [carrera] 2min | Caminar [carrera] 2min
SEMANA 3
## Correr y caminar @ Lunes, Miércoles, Sábado
- Caminar [carrera]: 1x5min
- BLOQUE x5: Trote suave [carrera] 3min | Caminar [carrera] 1:30
SEMANA 4
## Correr y caminar @ Lunes, Miércoles, Sábado
- Caminar [carrera]: 1x5min
- BLOQUE x4: Trote suave [carrera] 5min | Caminar [carrera] 2min
SEMANA 5
## Correr y caminar @ Lunes, Miércoles, Sábado
- Caminar [carrera]: 1x5min
- BLOQUE x3: Trote suave [carrera] 8min | Caminar [carrera] 2min
SEMANA 6
## Correr y caminar @ Lunes, Miércoles, Sábado
- Caminar [carrera]: 1x5min
- BLOQUE x2: Trote suave [carrera] 12min | Caminar [carrera] 2min
SEMANA 7
## Trote continuo @ Lunes, Miércoles, Sábado
- Caminar [carrera]: 1x5min
- Trote suave [carrera]: 1x25min
SEMANA 8
## Trote continuo @ Lunes, Miércoles, Sábado
- Caminar [carrera]: 1x5min
- Trote suave [carrera]: 1x30min`,
`RUTINA: Series típicas de carrera
NOTA: Sesiones sueltas para guardar como plantilla. Con datos en Marcas, la app te propone el ritmo de cada serie según tu forma.
## Series 400 m
- Calentamiento carrera [carrera]: 1x15min
- Series 400 m [carrera]: 8x400m rec 1:30
- Trote de recuperación [carrera]: 1x10min
## Series 1000 m
- Calentamiento carrera [carrera]: 1x15min
- Series 1000 m [carrera]: 5x1000m rec 2:00
- Trote de recuperación [carrera]: 1x10min
## Fartlek
- Calentamiento carrera [carrera]: 1x10min
- BLOQUE x6: Fartlek [carrera] 2min | Trote de recuperación [carrera] 1min
- Trote de recuperación [carrera]: 1x10min
## Umbral
- Calentamiento carrera [carrera]: 1x15min
- Umbral [carrera]: 3x8min rec 2:00
- Trote de recuperación [carrera]: 1x10min`
].map(leerRutina);
function pintarRutinas() {
  const cont = $("listaRutinas");
  cont.textContent = "";
  RUTINAS_TIPO.forEach(r => {
    const sesiones = r.bloques.reduce((a, b) => a + b.sesiones.length, 0);
    cont.appendChild(tarjeta(r.nombre, [r.multi ? r.bloques.length + " semanas que van cambiando" : sesiones + (sesiones === 1 ? " sesión" : " sesiones") + (r.conDias ? " · " + semanasRutina(r) + " semanas" : ""), r.nota], () => abrirRutina(r)));
  });
}
function abrirRutina(r) {
  abrirIA("vista");
  rutinaIA = r;
  $("iaVistaTit").textContent = r.nombre;
  pintarVistaIA();
}

// ---------- Crear con IA: prompt listo para copiar y lectura de la respuesta ----------
const OBJETIVOS_IA = { fuerza: "ganar fuerza", hipertrofia: "ganar masa muscular (hipertrofia)", "5k": "preparar una carrera de 5 km", "10k": "preparar una carrera de 10 km", combinado: "combinar fuerza y carrera" };
const EJEMPLO_IA = `RUTINA: Fuerza y carrera 3 días
SEMANAS: 6
NOTA: Para nivel intermedio. Sube 2,5 kg cuando completes todas las series.
## Fuerza @ Lunes, Jueves
- Sentadilla [fuerza]: 4x6 @RPE8 desc 2:30
- Press banca [fuerza]: 4x8 @75% desc 2:00
- Dominadas [fuerza]: 3xmáx desc 2:00
## Series @ Miércoles
- Calentamiento carrera [carrera]: 1x15min
- Series 1000 m [carrera]: 5x1000m @4:10/km rec 2:00
- BLOQUE x4: Series 200 m [carrera] 200m | Trote de recuperación [carrera] 200m
## Rodaje @ Sábado
- Rodaje [carrera]: 1x45min`;
function textoPrompt() {
  const g = id => $(id).value.trim(), obj = g("iaObjetivo");
  const f = rendimiento().forma;
  const rms = vivos("ejercicios").filter(e => tipoDe(e.id) === "fuerza" && rmReferencia(e.id) > 0)
    .sort((a, b) => rmReferencia(b.id) - rmReferencia(a.id)).slice(0, 8).map(e => e.nombre + " " + num(rmReferencia(e.id)) + " kg");
  const corre = obj === "5k" || obj === "10k" || obj === "combinado";
  const datos = [
    "Objetivo: " + OBJETIVOS_IA[obj] + (g("iaMeta") ? " (" + g("iaMeta") + ")" : ""),
    "Días por semana: " + (g("iaDias") || 3),
    "Nivel: " + g("iaNivel"),
    "Duración: " + (g("iaSemanas") || 4) + " semanas",
    "Material: " + (g("iaMaterial") || "gimnasio completo"),
    g("iaLimites") && "Limitaciones: " + g("iaLimites"),
    obj !== "5k" && obj !== "10k" && rms.length && "Mis 1RM aproximados: " + rms.join(", "),
    molestiasActivas().length && "Molestias o lesiones que tengo ahora (adapta el plan para no agravarlas): " + molestiasActivas().map(m => m.zona + (m.descripcion ? " (" + m.descripcion + ")" : "")).join("; "),
    corre && f && "Mis ritmos de carrera actuales por km: " + ZONAS.map(([n, fr]) => n.split(" (")[0] + " " + fmtTiempo(ritmoZona(f.vdot, fr))).join(", ") + " (VDOT " + num(Math.round(f.vdot)) + "). Usa estos ritmos."
  ].filter(Boolean);
  return ["Actúa como entrenador. Diséñame un plan de entrenamiento con estos datos:", ...datos.map(d => "- " + d), "",
    "Responde SOLO con el plan dentro de un bloque de código, sin texto fuera, en este formato exacto (una app lo lee automáticamente):",
    "```", EJEMPLO_IA, "```",
    "Reglas del formato:",
    "- Empieza por «RUTINA: nombre». Después, «NOTA:» con una o dos frases sobre para quién es y cómo progresar.",
    "- Si todas las semanas son iguales, pon «SEMANAS: número» y escribe las sesiones una sola vez. Si el plan cambia cada semana, escribe «SEMANA 1», «SEMANA 2»… y debajo las sesiones de esa semana.",
    "- Cada sesión empieza por «## Nombre @ Día» (Lunes, Martes, Miércoles, Jueves, Viernes, Sábado o Domingo; varios días separados por comas).",
    "- Un ejercicio por línea: «- Nombre [tipo]: series». El tipo es fuerza, carrera o natacion. Usa nombres de ejercicios comunes en español.",
    "- Series: 4x8 (repeticiones), 3xmáx, 5x1000m, 8x100m, 1x40min, 6x2min. Sin rangos: 4x10, no 4x8-12.",
    "- Intensidad: @RPE8 o @75% (del 1RM) en fuerza, @4:30/km en carrera, @1:50/100m en natación. No pongas kilos fijos.",
    "- Descanso: «desc 2:00» o «desc 90» (segundos). En carrera y natación la recuperación también puede ir en metros: «rec 200m».",
    "- Tramos que se repiten seguidos: «- BLOQUE x4: Ejercicio [tipo] 400m rec 200m | Ejercicio [tipo] 200m»."].join("\n");
}
let rutinaIA = null;
function pasoIA(paso) {
  ["prompt", "pegar"].forEach(p => $("iaPasos").querySelector('[data-paso="' + p + '"]').setAttribute("aria-selected", String(p === paso || (paso === "vista" && p === "pegar"))));
  $("iaPasos").hidden = paso === "vista";
  $("iaPrompt").hidden = paso !== "prompt";
  $("iaPegar").hidden = paso !== "pegar";
  $("iaVistaCaja").hidden = paso === "prompt" || (paso === "pegar" && !rutinaIA);
}
function abrirIA(paso) {
  rutinaIA = null;
  $("iaVistaTit").textContent = "";
  $("iaError").textContent = "";
  $("dlgIA").setAttribute("aria-label", paso === "vista" ? "Rutina tipo" : "Crear con IA");
  pasoIA(paso);
  if (paso === "prompt") $("iaTexto").value = textoPrompt();
  if (!$("dlgIA").open) $("dlgIA").showModal();
}
function pintarVistaIA() {
  const r = rutinaIA;
  $("iaVistaCaja").hidden = !r;
  if (!r) return;
  vistaRutina(r, $("iaVista"));
  $("iaMesoOp").hidden = !r.conDias;
  $("iaMeso").hidden = !r.conDias;
  $("iaInicio").value = lunesSiguiente();
  $("iaMesoSem").value = semanasRutina(r);
  const n = r.bloques.reduce((a, b) => a + b.sesiones.length, 0);
  $("iaPlantillas").textContent = n === 1 ? "Usar como plantilla" : "Usar como plantillas (" + n + ")";
  $("iaAvisoDias").textContent = r.conDias ? (r.bloques.some(b => b.sesiones.some(s => !s.dias.length)) ? "Las sesiones sin día solo se guardan como plantilla." : "") : "Ninguna sesión tiene día: se guardan como plantillas para usarlas cuando quieras.";
}
$("iaPasos").addEventListener("click", ev => { const b = ev.target.closest("[data-paso]"); if (b) { pasoIA(b.dataset.paso); if (b.dataset.paso === "prompt") $("iaTexto").value = textoPrompt(); } });
["iaObjetivo", "iaDias", "iaNivel", "iaSemanas", "iaMaterial", "iaMeta", "iaLimites"].forEach(id => $(id).addEventListener("input", () => { $("iaTexto").value = textoPrompt(); }));
$("iaCopiar").addEventListener("click", () => {
  const t = $("iaTexto").value;
  const hecho = () => { $("iaCopiarAviso").textContent = "Prompt copiado. Pégalo en ChatGPT, Claude u otra IA y después pega su respuesta en el paso 2."; };
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(hecho, () => {
    $("iaTexto").focus(); $("iaTexto").select();
    $("iaCopiarAviso").textContent = document.execCommand && document.execCommand("copy") ? "Prompt copiado." : "Mantén pulsado el texto y elige Copiar.";
  });
});
$("iaRevisar").addEventListener("click", () => {
  const r = leerRutina($("iaRespuesta").value);
  rutinaIA = r.error ? null : r;
  $("iaError").textContent = r.error || "";
  $("iaVistaTit").textContent = r.error ? "" : r.nombre;
  pintarVistaIA();
});
$("iaRespuesta").addEventListener("input", () => { rutinaIA = null; $("iaError").textContent = ""; pintarVistaIA(); });
$("iaPlantillas").addEventListener("click", () => { if (!rutinaIA) return; $("dlgIA").close(); guardarRutina(rutinaIA, false); });
$("iaMeso").addEventListener("click", () => {
  if (!rutinaIA) return;
  const sem = parseInt($("iaMesoSem").value, 10), ini = $("iaInicio").value;
  if (!ini || !(sem >= 1 && sem <= 26)) { $("iaAvisoDias").textContent = "Elige la fecha de inicio y entre 1 y 26 semanas."; return; }
  $("dlgIA").close();
  guardarRutina(rutinaIA, true, iso(lunesDe(deIso(ini))), sem);
});
$("iaAbrir").addEventListener("click", () => abrirIA("prompt"));
$("iaPegarAbrir").addEventListener("click", () => { abrirIA("pegar"); $("iaRespuesta").focus(); });
pintarRutinas();

// ---------- Ajustes de este dispositivo: barra y salto de los botones − y + ----------
const ajustes = () => ({ barra: 20, pasoKg: 2.5, ...(leer("ajustes-v1") || {}) });
function pintarAjustes() {
  const a = leer("ajustes-v1") || {};
  $("ajBarra").value = a.barra ? num(a.barra) : "";
  $("ajPaso").value = a.pasoKg ? num(a.pasoKg) : "";
}
[["ajBarra", "barra"], ["ajPaso", "pasoKg"]].forEach(([id, k]) => $(id).addEventListener("change", () => {
  const a = leer("ajustes-v1") || {}, v = parseFloat($(id).value.replace(",", "."));
  if (v > 0 && v < 100) a[k] = v; else delete a[k];
  escribir("ajustes-v1", a);
  pintarAjustes();
  setEstado("Ajuste guardado en este dispositivo");
}));
pintarAjustes();
// Discos por lado con los discos habituales (sin límite de pares)
const DISCOS = [25, 20, 15, 10, 5, 2.5, 1.25];
function textoDiscos(kg) {
  const barra = ajustes().barra;
  if (!(kg >= barra)) return "";
  let lado = (kg - barra) / 2;
  if (lado < 0.01) return "solo la barra";
  const usados = [];
  for (const d of DISCOS) while (lado >= d - 1e-9) { usados.push(d); lado -= d; }
  return "por lado: " + usados.map(num).join(" + ") + (lado > 0.01 ? " (faltan " + num(Math.round(lado * 200) / 100) + " kg)" : "");
}
// Campo con − y + a los lados
const paso = input => '<span class="paso"><button type="button" class="menos" aria-label="Menos" tabindex="-1">−</button>' + input + '<button type="button" class="mas" aria-label="Más" tabindex="-1">+</button></span>';
function ajustarCampo(inp, clase, signo) {
  const v = clase === "t" ? leerTiempo(inp.value) : parseFloat((inp.value || "0").replace(",", ".")) || 0;
  const n = Math.max(0, (isNaN(v) ? 0 : v) + signo * { kg: ajustes().pasoKg, pct: 2.5, reps: 1, m: 100, t: 5 }[clase]);
  inp.value = !n ? "" : clase === "t" ? fmtTiempo(n) : clase === "kg" || clase === "pct" ? num(n) : String(n);
  inp.dispatchEvent(new Event("input"));
}

// ---------- Discos y calentamiento sugerido ----------
// Con barra: por el nombre (sentadilla, press banca, peso muerto…) o lo que se marque en la ficha de este dispositivo
const usaBarraNombre = id => /sentadilla|banca|peso muerto|press militar|remo con barra|hip thrust|con barra|cargada|arrancada|clean|snatch|good morning|buenos dias/.test(norm(nombreEj(id)))
  && !/mancuerna|polea|maquina|kettle|smith|multipower|goblet/.test(norm(nombreEj(id)));
const usaBarra = id => { const o = (ajustes().barras || {})[id]; return tipoDe(id) === "fuerza" && (o !== undefined ? o : usaBarraNombre(id)); };
// Hoy, antes de la primera serie efectiva con peso: barra × 10 (si va con barra), 50 % × 5, 70 % × 3 y 85 % × 1
function sugerenciaCalent(fecha, id, series) {
  if (tipoDe(id) !== "fuerza" || fecha !== iso(new Date())) return null;
  const efectivas = series.filter(s => !s.calentamiento).sort((a, b) => a.orden - b.orden);
  if (!efectivas.length || series.some(s => s.calentamiento) || efectivas.some(hecha)) return null;
  if ((leer("calent-rechazado-v1") || {})[fecha + "|" + id]) return null;
  const kg = pesoMostrado(efectivas[0]), barra = usaBarra(id) ? ajustes().barra : 0;
  if (!(kg >= 40)) return null;
  const pasos = barra ? [{ peso: barra, reps: 10, barra: true }] : [];
  [[0.5, 5], [0.7, 3], [0.85, 1]].forEach(([f, reps]) => {
    const p = redondear(kg * f), previo = pasos.length ? pasos[pasos.length - 1].peso : 0;
    if (p > previo && p < kg) pasos.push({ peso: p, reps });
  });
  return pasos.length >= 2 ? pasos : null;
}
function aceptarCalent(fecha, id, grupo, series, pasos) {
  const primera = Math.min.apply(null, series.map(s => n0(s.orden)));
  const nuevas = pasos.map((p, k) => ({ id: nuevoId(), fecha, ejercicio_id: id, orden: primera - pasos.length + k, peso: p.peso, reps: p.reps, distancia: 0, tiempo: 0,
    descanso: 60, rec_dist: 0, pct: 0, ciclo_id: "", calentamiento: true, hecha: false, grupo: grupo || "", meso_id: "", bloque_id: "", ronda: 0, borrado: false }));
  nuevas.forEach(f => cambiar("series", f, true));
  persistir();
  pintarBloques(true);
  avisoDeshacer("Calentamiento añadido · " + nombreEj(id), nuevas.map(f => ["series", { ...f, borrado: true }]));
  return nuevas;
}
function rechazarCalent(fecha, id) {
  const r = leer("calent-rechazado-v1") || {}, limite = iso(sumarDias(new Date(), -7));
  Object.keys(r).forEach(k => { if (k.slice(0, 10) < limite) delete r[k]; });
  r[fecha + "|" + id] = true;
  escribir("calent-rechazado-v1", r);
}

// ---------- Molestias y lesiones, y zonas que trabaja cada ejercicio ----------
const ZONAS_CUERPO = ["Cuello", "Hombro", "Codo", "Muñeca", "Pecho", "Espalda alta", "Lumbar", "Cadera", "Glúteo", "Isquios", "Rodilla", "Gemelo", "Tobillo", "Pie"];
function zonasPorNombre(id) {
  const n = norm(nombreEj(id)), tipo = tipoDe(id), z = new Set();
  const si = (re, ...zs) => { if (re.test(n)) zs.forEach(x => z.add(x)); };
  if (tipo === "carrera") ["Rodilla", "Tobillo", "Pie", "Gemelo", "Cadera", "Isquios"].forEach(x => z.add(x));
  if (tipo === "natacion") { ["Hombro", "Cuello", "Lumbar"].forEach(x => z.add(x)); si(/braza/, "Rodilla"); }
  si(/sentadilla|prensa|zancada|bulgara|extension de cuadriceps|step|salto/, "Rodilla", "Cadera");
  si(/sentadilla|peso muerto|buenos dias|good morning|remo con barra|plancha|abdominal/, "Lumbar");
  si(/peso muerto|rumano|curl femoral|hip thrust|puente/, "Isquios", "Cadera", "Glúteo");
  si(/press|banca|fondos|aperturas|flexiones/, "Hombro", "Codo", "Muñeca");
  si(/banca|aperturas|fondos|flexiones/, "Pecho");
  si(/militar|elevaciones laterales|pajaro|face pull/, "Hombro");
  si(/dominada|jalon|remo/, "Espalda alta", "Codo", "Hombro");
  si(/curl|triceps/, "Codo", "Muñeca");
  si(/gemelo|pantorrilla/, "Gemelo", "Tobillo");
  si(/hip thrust|patada de gluteo/, "Glúteo");
  return ZONAS_CUERPO.filter(x => z.has(x));
}
const zonasDe = id => { const e = db.ejercicios[id]; return e && Array.isArray(e.zonas) && e.zonas.length ? e.zonas : zonasPorNombre(id); };
const molestiasActivas = () => vivos("molestias").filter(m => m.estado === "activa").sort((a, b) => (b.inicio || "").localeCompare(a.inicio || ""));
const molestiasDe = id => { const z = zonasDe(id); return molestiasActivas().filter(m => z.includes(m.zona)); };
function pintarMolestias() {
  const cont = $("listaMolestias");
  cont.textContent = "";
  const lista = vivos("molestias").sort((a, b) => (a.estado === b.estado ? 0 : a.estado === "activa" ? -1 : 1) || (b.inicio || "").localeCompare(a.inicio || ""));
  if (!lista.length) { cont.appendChild(nota("Apunta aquí una molestia o lesión (zona, qué notas y desde cuándo). Los ejercicios que trabajan esa zona te avisarán con ⚠ y la IA la tendrá en cuenta.")); return; }
  const recientes = ejerciciosOrdenados().slice(0, 40);
  lista.forEach(m => {
    const afecta = m.estado === "activa" ? recientes.filter(e => zonasDe(e.id).includes(m.zona)).slice(0, 4).map(e => e.nombre) : [];
    const t = tarjeta((m.estado === "activa" ? "⚠ " : "✓ ") + m.zona, [m.descripcion || "Sin descripción",
      (m.inicio ? "desde el " + fechaCorta(m.inicio) + " · " : "") + (m.estado === "activa" ? "activa" : "resuelta") + (afecta.length ? " · afecta a " + afecta.join(", ") : "")], () => abrirMolestia(m.id));
    t.classList.toggle("molestia-resuelta", m.estado !== "activa");
    cont.appendChild(t);
  });
}
let molEdit = null;
ZONAS_CUERPO.forEach(z => { const o = document.createElement("option"); o.value = o.textContent = z; $("molZona").appendChild(o); });
function abrirMolestia(id) {
  const m = id ? db.molestias[id] : null;
  molEdit = m ? { ...m } : { id: nuevoId(), zona: "Rodilla", descripcion: "", inicio: iso(new Date()), estado: "activa", borrado: false, nueva: true };
  $("molZona").value = molEdit.zona;
  $("molDesc").value = molEdit.descripcion || "";
  $("molInicio").value = molEdit.inicio || "";
  $("molEstado").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.estado === molEdit.estado)));
  $("molBorrar").hidden = !!molEdit.nueva;
  $("molBorrar").classList.remove("confirmar"); $("molBorrar").textContent = "Eliminar";
  $("dlgMolestia").showModal();
}
$("molEstado").addEventListener("click", ev => {
  const b = ev.target.closest("[data-estado]");
  if (!b) return;
  molEdit.estado = b.dataset.estado;
  $("molEstado").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
});
$("molGuardar").addEventListener("click", () => {
  const m = { ...molEdit, zona: $("molZona").value, descripcion: $("molDesc").value.trim().slice(0, 500), inicio: $("molInicio").value || null };
  delete m.nueva;
  cambiar("molestias", m);
  $("dlgMolestia").close();
  pintarPlan();
  pintarBloques(true);
});
$("molBorrar").addEventListener("click", () => {
  const b = $("molBorrar");
  if (!b.classList.contains("confirmar")) { b.classList.add("confirmar"); b.textContent = "Pulsa otra vez para eliminarla"; return; }
  cambiar("molestias", { ...db.molestias[molEdit.id], borrado: true });
  $("dlgMolestia").close();
  pintarPlan();
  pintarBloques(true);
});
$("nuevaMolestia").addEventListener("click", () => abrirMolestia(null));
// En la ficha: zonas que trabaja el ejercicio (sugeridas por el nombre hasta que se ajusten) y si va con barra
function pintarZonasDetalle(e) {
  const cont = $("detZonas"), propias = Array.isArray(e.zonas) && e.zonas.length, actuales = zonasDe(e.id), puede = editable(e);
  cont.textContent = "";
  ZONAS_CUERPO.forEach(z => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip chip-op zona";
    b.textContent = z;
    b.setAttribute("aria-pressed", String(actuales.includes(z)));
    b.disabled = !puede;
    b.addEventListener("click", () => {
      const nuevas = actuales.includes(z) ? actuales.filter(x => x !== z) : ZONAS_CUERPO.filter(x => x === z || actuales.includes(x));
      editarEjercicio({ zonas: nuevas });
      pintarZonasDetalle(db.ejercicios[e.id]);
    });
    cont.appendChild(b);
  });
  $("detZonasNota").textContent = (propias ? "" : "Sugeridas según el nombre. ") + (puede ? "Toca para ajustarlas." : "Las ajusta quien edita el catálogo común.");
  $("detBarra").checked = usaBarra(e.id);
}
$("detBarra").addEventListener("change", () => {
  const a = leer("ajustes-v1") || {};
  a.barras = a.barras || {};
  a.barras[detalleId] = $("detBarra").checked;
  escribir("ajustes-v1", a);
  pintarBloques(true);
});

// ---------- Compartir un mesociclo entero (con sus plantillas) ----------
const nombreLibre = n => { const usados = new Set(vivos("plantillas").map(p => norm(p.nombre))); let x = n, k = 2; while (usados.has(norm(x))) x = n + " (" + k++ + ")"; return x; };
function compartirMeso(m) {
  const listas = [m.dias || {}].concat(Object.keys(m.dias || {}).filter(k => /^s\d+$/.test(k)).map(k => m.dias[k]));
  const pids = [...new Set(listas.flatMap(d => Object.keys(d).filter(k => /^\d$/.test(k)).flatMap(k => d[k] || [])))].filter(p => db.plantillas[p] && !db.plantillas[p].borrado);
  const idx = {};
  pids.forEach((p, i) => { idx[p] = i; });
  const mapa = d => { const r = {}; Object.keys(d).filter(k => /^\d$/.test(k)).forEach(k => { r[k] = (d[k] || []).filter(p => p in idx).map(p => idx[p]); }); return r; };
  const dias = mapa(m.dias || {});
  Object.keys(m.dias || {}).filter(k => /^s\d+$/.test(k)).forEach(k => { dias[k] = mapa(m.dias[k]); });
  compartir(m.nombre, [{ mesociclo: { semanas: n0(m.semanas), progresion: n0(m.progresion), descarga: m.descarga || {}, notas: m.notas || "", dias },
    plantillas: pids.map(p => ({ nombre: db.plantillas[p].nombre, items: paraCompartir(db.plantillas[p].items || []) })) }], true);
}
function guardarMesoCompartido(c) {
  const x = c.items[0], mm = x.mesociclo;
  const ids = x.plantillas.map(p => { const id = nuevoId(); cambiar("plantillas", { id, nombre: nombreLibre(p.nombre), items: desdeCompartido(p.items), borrado: false }, true); return id; });
  const mapa = d => { const r = {}; Object.keys(d || {}).filter(k => /^\d$/.test(k)).forEach(k => { r[k] = (d[k] || []).map(i => ids[i]).filter(Boolean); }); return r; };
  const dias = mapa(mm.dias);
  Object.keys(mm.dias || {}).filter(k => /^s\d+$/.test(k)).forEach(k => { dias[k] = mapa(mm.dias[k]); });
  const id = nuevoId();
  cambiar("mesociclos", { id, nombre: c.nombre, inicio: lunesSiguiente(), semanas: Math.min(26, n0(mm.semanas) || 4), dias, progresion: n0(mm.progresion), descarga: mm.descarga || {}, notas: mm.notas || "", borrado: false }, true);
  persistir();
  verPestana("plan");
  setEstado("Mesociclo «" + c.nombre + "» guardado con " + ids.length + " plantillas. Elige la fecha y pulsa «Guardar y rellenar calendario».");
  abrirMeso(id);
}
$("mesoCompartir").addEventListener("click", () => {
  const m = leerMeso();
  if (!m) return;
  cambiar("mesociclos", m);
  compartirMeso(m);
});

// ---------- Reordenar dentro de un día: series, ejercicios y bloques, y sesiones ----------
// Las series de cada día se ordenan por «orden»: reordenar es repartir los mismos valores en el orden nuevo
function reordenar(conjuntos, texto) {
  const todas = conjuntos.flat().filter(Boolean);
  if (todas.length < 2) return;
  const huecos = todas.map(s => n0(s.orden)).sort((a, b) => a - b), antes = [];
  let k = 0;
  conjuntos.forEach(c => c.filter(Boolean).slice().sort((a, b) => a.orden - b.orden).forEach(s => {
    const o = huecos[k++];
    if (n0(s.orden) !== o) { antes.push(["series", { ...s }]); cambiar("series", { ...s, orden: o }, true); }
  }));
  if (!antes.length) { pintarBloques(true); return; }
  persistir();
  pintarBloques(true);
  avisoDeshacer(texto + " · Deshacer para volver como estaba", antes);
}
// Sesiones del día con sus ejercicios y bloques, en el orden en que se ven
function estructuraDia(fecha) {
  const grupos = [];
  seriesDelDia(fecha).forEach(s => {
    let g = grupos.find(x => x.nombre === (s.grupo || ""));
    if (!g) grupos.push(g = { nombre: s.grupo || "", items: [] });
    const clave = s.bloque_id ? "b:" + s.bloque_id : s.ejercicio_id;
    let it = g.items.find(x => x.clave === clave);
    if (!it) g.items.push(it = { clave, series: [] });
    it.series.push(s);
  });
  return grupos;
}
const seriesDeGrupo = (fecha, nombre) => seriesDelDia(fecha).filter(s => (s.grupo || "") === nombre);
const seriesDeItem = (fecha, grupo, clave) => ((estructuraDia(fecha).find(g => g.nombre === grupo) || { items: [] }).items.find(x => x.clave === clave) || { series: [] }).series;
function moverItem(fecha, grupo, clave, paso) {
  const g = estructuraDia(fecha).find(x => x.nombre === grupo);
  if (!g) return;
  const i = g.items.findIndex(x => x.clave === clave), j = i + paso;
  if (i < 0 || j < 0 || j >= g.items.length) return;
  const items = g.items.slice();
  [items[i], items[j]] = [items[j], items[i]];
  reordenar(items.map(x => x.series), "Ejercicio movido");
}
function moverGrupo(fecha, nombre, paso) {
  const gs = estructuraDia(fecha), i = gs.findIndex(x => x.nombre === nombre), j = i + paso;
  if (i < 0 || j < 0 || j >= gs.length) return;
  const lista = gs.slice();
  [lista[i], lista[j]] = [lista[j], lista[i]];
  reordenar(lista.map(g => g.items.flatMap(x => x.series)), "Sesión movida");
}
// Asa ≡: se arrastra (dedo o ratón) con vista en vivo, o se mueve con las flechas del teclado
function asaArrastre(el, hermanos, alSoltar, nombre) {
  const asa = document.createElement("button");
  asa.type = "button";
  asa.className = "asa";
  asa.textContent = "≡";
  asa.setAttribute("aria-label", "Mover " + nombre + " (arrástralo o usa las flechas arriba y abajo)");
  asa.addEventListener("click", e => e.stopPropagation());
  asa.addEventListener("keydown", e => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const h = hermanos(), i = h.indexOf(el), j = i + (e.key === "ArrowUp" ? -1 : 1);
    if (j < 0 || j >= h.length) return;
    const n = h.slice();
    [n[i], n[j]] = [n[j], n[i]];
    alSoltar(n);
  });
  asa.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    const inicial = hermanos();
    if (inicial.length < 2) return;
    try { asa.setPointerCapture(e.pointerId); } catch {}
    let y0 = e.clientY;
    el.classList.add("arrastrando");
    const mover = ev => {
      const lista = hermanos(), i = lista.indexOf(el), antes = lista[i - 1], despues = lista[i + 1];
      const arriba = el.offsetTop;
      if (despues && ev.clientY > despues.getBoundingClientRect().top + despues.offsetHeight / 2) despues.after(el);
      else if (antes && ev.clientY < antes.getBoundingClientRect().top + antes.offsetHeight / 2) antes.before(el);
      y0 += el.offsetTop - arriba;
      el.style.transform = "translateY(" + (ev.clientY - y0) + "px)";
    };
    const fin = ev => {
      asa.removeEventListener("pointermove", mover);
      asa.removeEventListener("pointerup", fin);
      asa.removeEventListener("pointercancel", fin);
      el.classList.remove("arrastrando");
      el.style.transform = "";
      const final = hermanos();
      if (ev.type === "pointercancel" || final.every((x, k) => x === inicial[k])) { pintarBloques(true); return; }
      alSoltar(final);
    };
    asa.addEventListener("pointermove", mover);
    asa.addEventListener("pointerup", fin);
    asa.addEventListener("pointercancel", fin);
  });
  return asa;
}

// ---------- Vista de un solo día ----------
function abrirDia(id) {
  if (!id) return;
  diaAbierto = id;
  escribir("dia-abierto-v1", { id, abierto: iso(new Date()) });
  desplazamiento = Math.round((lunesDe(deIso(id)) - lunesDe(new Date())) / 6048e5);
  if ($("vistaSemana").hidden) verPestana("semana"); else pintarSemana();
  scrollTo(0, 0);
}
function cerrarDia() {
  diaAbierto = null;
  escribir("dia-abierto-v1", null);
  pintarSemana();
}
$("volverSemana").addEventListener("click", cerrarDia);
$("diaAnt").addEventListener("click", () => abrirDia(iso(sumarDias(deIso(diaAbierto), -1))));
$("diaSig").addEventListener("click", () => abrirDia(iso(sumarDias(deIso(diaAbierto), 1))));
// Tocar «Semana» estando ya en la semana con un día abierto vuelve a la semana entera
let semanaVisible = false;
$("tabSemana").addEventListener("pointerdown", () => { semanaVisible = !$("vistaSemana").hidden; });
$("tabSemana").addEventListener("click", () => { if (semanaVisible && diaAbierto) cerrarDia(); });
// Deslizar en horizontal sobre el día pasa al anterior o al siguiente (no desde el borde, que es el «atrás» de Safari)
let gestoDia = null;
$("semana").addEventListener("touchstart", e => {
  const t = e.touches[0];
  gestoDia = diaAbierto && e.touches.length === 1 && t.clientX > 30 && !e.target.closest(".series li, input, textarea, select, .editor") ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
$("semana").addEventListener("touchend", e => {
  if (!gestoDia) return;
  const t = e.changedTouches[0], dx = t.clientX - gestoDia.x, dy = t.clientY - gestoDia.y;
  gestoDia = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) abrirDia(iso(sumarDias(deIso(diaAbierto), dx < 0 ? 1 : -1)));
}, { passive: true });
// Días desplegados o plegados a mano; se recuerdan unas semanas
let desplegados = leer("dias-desplegados-v1") || {};
const desplegado = id => desplegados[id] ?? id === iso(new Date());
function ponerPlegado(d, plegado) {
  d.col.classList.toggle("plegado", plegado);
  d.col.querySelector(".dia-abrir").setAttribute("aria-expanded", String(!plegado));
  d.col.querySelector(".dia-cuerpo").inert = plegado;
}
function plegarDia(d) {
  if (diaAbierto) return;
  desplegados[d.id] = !desplegado(d.id);
  const limite = iso(sumarDias(new Date(), -60));
  Object.keys(desplegados).forEach(k => { if (k < limite) delete desplegados[k]; });
  escribir("dias-desplegados-v1", desplegados);
  ponerPlegado(d, !desplegados[d.id]);
}

// Cabecera de cada día: anillo de series hechas, resumen de una línea (día plegado) y botón de entreno
function anilloSvg(f) {
  const c = 2 * Math.PI * 15;
  return '<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="a-fondo" cx="18" cy="18" r="15"/><circle class="a-hecho" cx="18" cy="18" r="15" stroke-dasharray="' +
    (f * c).toFixed(1) + " " + c.toFixed(1) + '" transform="rotate(-90 18 18)"/></svg>';
}
function pintarCabDia(dia) {
  const del = seriesDelDia(dia.id), h = del.filter(hecha).length, e = db.entrenos[dia.id] || {};
  dia.anillo.hidden = !del.length;
  if (del.length) {
    dia.anillo.innerHTML = anilloSvg(h / del.length) + "<span></span>";
    dia.anillo.lastChild.textContent = h + "/" + del.length;
    dia.anillo.classList.toggle("completo", h === del.length);
    dia.anillo.setAttribute("aria-label", h + " de " + del.length + " series hechas");
  }
  // Día plegado: su título (primera línea del texto o sus sesiones); si no hay ninguno, el resumen de series
  const titulo = aTexto(e.html || "").split("\n").map(l => l.trim()).find(Boolean) || "";
  const sesiones = [...new Set(del.map(s => s.grupo).filter(Boolean))];
  const nombre = titulo || sesiones.join(" + ");
  dia.resumenEl.classList.toggle("es-titulo", !!nombre);
  dia.resumenEl.textContent = nombre ? nombre.slice(0, 140)
    : [del.length ? h + "/" + del.length + " series" : "", n0(e.rpe) ? "esfuerzo " + e.rpe + "/10" : ""].filter(Boolean).join(" · ") || "Nada apuntado";
  dia.resumenEl.title = nombre;
  dia.empezarEl.hidden = !del.length || h === del.length || !(dia.id === iso(new Date()) || dia.id === diaAbierto);
  dia.empezarEl.textContent = h ? "▶ Seguir entreno (" + h + "/" + del.length + ")" : "▶ Empezar entreno";
}
function pintarProgresoSemana() {
  const ini = iso(lunesVista()), fin = iso(sumarDias(lunesVista(), 7));
  const del = seriesVivas().filter(s => s.fecha >= ini && s.fecha < fin), h = del.filter(hecha).length;
  $("semBarra").hidden = !del.length || !!diaAbierto;
  $("semBarra").firstElementChild.style.width = del.length ? (h / del.length * 100).toFixed(1) + "%" : "0";
  $("semBarra").title = h + " de " + del.length + " series hechas esta semana";
}

// ---------- Deshacer, deslizar y récords ----------
let deshacerPend = null, timerAviso = null;
const capaArriba = () => ($("dlgEntreno").open ? $("dlgEntreno") : document.body);
function avisoDeshacer(texto, deshacer, pr) {
  const t = $("toast");
  if (t.parentNode !== capaArriba()) capaArriba().appendChild(t);
  deshacerPend = deshacer || null;
  $("toastTxt").textContent = texto;
  $("toastBtn").hidden = !deshacerPend;
  t.classList.toggle("pr", !!pr);
  t.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => { t.hidden = true; deshacerPend = null; }, pr ? 6000 : 5000);
}
$("toastBtn").addEventListener("click", () => {
  if (!deshacerPend) return;
  deshacerPend.forEach(([t, f]) => { const c = { ...f }; delete c.sucio; cambiar(t, c, true); });
  deshacerPend = null;
  persistir();
  $("toast").hidden = true;
  pintarTodo();
  if (ent) pintarEntreno();
});
function celebrar() {
  if (navigator.vibrate) navigator.vibrate(40);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const f = $("fiesta");
  if (f.parentNode !== capaArriba()) capaArriba().appendChild(f);
  f.textContent = "";
  const colores = ["var(--gold)", "var(--accent)", "var(--carrera)", "var(--fuerza)"];
  for (let k = 0; k < 22; k++) {
    const p = document.createElement("i");
    p.style.left = (Math.random() * 100).toFixed(1) + "%";
    p.style.animationDelay = (Math.random() * 0.3).toFixed(2) + "s";
    p.style.background = colores[k % 4];
    f.appendChild(p);
  }
  f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");
  setTimeout(() => { f.classList.remove("on"); f.textContent = ""; }, 1800);
}
// Avisa del récord (con celebración) o, si no lo es, de que la serie está hecha; las dos con Deshacer
function avisarSiPR(fila, deshacer) {
  const pr = hecha(fila) && prsDe(seriesDe(fila.ejercicio_id), tipoDe(fila.ejercicio_id)).has(fila.id);
  if (pr) { celebrar(); avisoDeshacer("¡Nuevo récord! " + nombreEj(fila.ejercicio_id) + " · " + serieTexto(fila), deshacer, true); }
  else if (deshacer) avisoDeshacer("Serie hecha · " + nombreEj(fila.ejercicio_id), deshacer);
  return pr;
}
function marcarHecha(antes, fila) {
  cambiar("series", fila);
  pintarBloques(true);
  avisarSiPR(fila, [["series", antes]]);
}
function borrarSerie(s) {
  cambiar("series", { ...s, borrado: true });
  pintarBloques(true);
  avisoDeshacer("Serie borrada · " + nombreEj(s.ejercicio_id), [["series", s]]);
}
// Deslizar con el dedo (no con ratón); el desplazamiento vertical sigue siendo de la página
function deslizable(li, derecha, izquierda) {
  if (!derecha && !izquierda) return;
  li.classList.add("desliza");
  let x0 = null, y0 = 0, dx = 0, activo = false, pid = null;
  li.addEventListener("pointerdown", e => { if (e.pointerType === "mouse") return; x0 = e.clientX; y0 = e.clientY; dx = 0; activo = false; pid = e.pointerId; });
  li.addEventListener("pointermove", e => {
    if (x0 === null || e.pointerId !== pid) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!activo) {
      if (Math.abs(my) > 10) { x0 = null; return; }
      if (Math.abs(mx) < 12) return;
      activo = true;
      try { li.setPointerCapture(pid); } catch {}
    }
    dx = (mx > 0 && !derecha) || (mx < 0 && !izquierda) ? mx / 4 : mx;
    li.style.transform = "translateX(" + dx + "px)";
    li.dataset.dir = dx > 0 ? "der" : "izq";
    li.classList.toggle("listo", Math.abs(dx) > 80);
  });
  const fin = () => {
    if (x0 === null) return;
    const d = dx, fue = activo;
    x0 = null; activo = false;
    li.style.transform = ""; li.classList.remove("listo"); delete li.dataset.dir;
    if (!fue) return;
    li.dataset.deslizado = "1";
    setTimeout(() => { delete li.dataset.deslizado; }, 350);
    if (d > 80 && derecha) derecha(); else if (d < -80 && izquierda) izquierda();
  };
  li.addEventListener("pointerup", fin);
  li.addEventListener("pointercancel", fin);
}

// ---------- Modo entreno: una serie cada vez, en grande, con el descanso integrado ----------
let ent = null, bloqueoPantalla = null;
// Mismo orden que en pantalla: por sesión y, dentro, ejercicio a ejercicio o bloque ronda a ronda
function colaEntreno(fecha) {
  const delDia = seriesDelDia(fecha), grupos = [], cola = [];
  delDia.forEach(s => { if (!grupos.includes(s.grupo || "")) grupos.push(s.grupo || ""); });
  grupos.forEach(g => {
    const deG = delDia.filter(s => (s.grupo || "") === g), claves = [];
    deG.forEach(s => { const k = s.bloque_id ? "b:" + s.bloque_id : s.ejercicio_id; if (!claves.includes(k)) claves.push(k); });
    claves.forEach(k => {
      const blq = k.startsWith("b:");
      deG.filter(s => blq ? s.bloque_id === k.slice(2) : s.ejercicio_id === k && !s.bloque_id)
        .sort((a, b) => blq ? n0(a.ronda) - n0(b.ronda) || a.orden - b.orden : a.orden - b.orden).forEach(s => cola.push(s.id));
    });
  });
  return cola;
}
const serieEnt = () => ent && db.series[ent.cola[ent.i]];
function empezarEntreno(dia) {
  const cola = colaEntreno(dia.id);
  if (!cola.length) return;
  const i = cola.findIndex(id => !hecha(db.series[id]));
  ent = { dia, cola, i: Math.max(0, i), fin: 0, timer: null, audio: null, campos: [] };
  $("enDescanso").hidden = true;
  $("enFin").hidden = true;
  $("dlgEntreno").showModal();
  pintarEntreno();
  if (navigator.wakeLock) navigator.wakeLock.request("screen").then(w => { bloqueoPantalla = w; }).catch(() => {});
}
function pintarEntreno() {
  ent.cola = ent.cola.filter(id => db.series[id] && !db.series[id].borrado && ejercicioVivo(db.series[id].ejercicio_id));
  if (!ent.cola.length) { salirEntreno(); return; }
  ent.i = Math.min(ent.i, ent.cola.length - 1);
  const s = serieEnt(), tipo = tipoDe(s.ejercicio_id), dist = esDistancia(tipo), lista = ent.cola.map(id => db.series[id]);
  const hechas = lista.filter(hecha).length;
  $("enProg").textContent = "Serie " + (ent.i + 1) + " de " + lista.length + " · " + hechas + (hechas === 1 ? " hecha" : " hechas");
  $("enBarra").style.width = (hechas / lista.length * 100).toFixed(1) + "%";
  $("enGrupo").textContent = s.grupo || NOMBRES[ent.dia.i] + " " + fmt(deIso(ent.dia.id));
  $("enEj").textContent = nombreEj(s.ejercicio_id);
  $("enEj").appendChild(etiquetaTipo(tipo));
  if (s.bloque_id) {
    const rondas = Math.max.apply(null, lista.filter(x => x.bloque_id === s.bloque_id).map(x => n0(x.ronda)));
    $("enSerie").textContent = "Bloque · ronda " + n0(s.ronda) + " de " + rondas;
  } else if (s.calentamiento) {
    $("enSerie").textContent = "Calentamiento";
  } else {
    const mismas = lista.filter(x => x.ejercicio_id === s.ejercicio_id && !x.bloque_id && !x.calentamiento && (x.grupo || "") === (s.grupo || ""));
    $("enSerie").textContent = "Serie " + (mismas.indexOf(s) + 1) + " de " + mismas.length;
  }
  $("enValor").textContent = serieTexto(s);
  $("enValor").classList.toggle("hecha", hecha(s));
  const kg = dist ? 0 : pesoMostrado(s), o = tipo === "carrera" && !hecha(s) ? objetivoSerie(s) : null;
  const dolor = molestiasDe(s.ejercicio_id);
  $("enExtra").textContent = [hecha(s) ? "✓ Hecha" : "", kg && usaBarra(s.ejercicio_id) ? textoDiscos(kg) : "", o ? textoObjetivo(o) : "", descTexto(s),
    dolor.length ? "⚠ cuidado con: " + dolor.map(m => m.zona).join(", ") : ""].filter(Boolean).join(" · ");
  // Calentamiento sugerido al llegar a la primera serie de un ejercicio
  const delEj = s.bloque_id ? [] : seriesDelDia(ent.dia.id).filter(x => x.ejercicio_id === s.ejercicio_id && !x.bloque_id && (x.grupo || "") === (s.grupo || ""));
  ent.calent = s.bloque_id ? null : sugerenciaCalent(ent.dia.id, s.ejercicio_id, delEj);
  $("enCalent").hidden = !ent.calent;
  if (ent.calent) $("enCalentT").textContent = "¿Calentamiento? " + ent.calent.map(p => (p.barra ? "barra" : num(p.peso) + " kg") + " × " + p.reps).join(" · ");
  // Campos para apuntar lo que de verdad se hizo
  ent.campos = dist ? (n0(s.distancia) > 0 ? ["m", "t"] : ["t", "m"]) : ["kg", "reps"];
  const etiqueta = { kg: "Peso (kg)", reps: "Repeticiones", m: "Metros", t: "Tiempo" };
  const valor = c => c === "kg" ? (kg ? num(kg) : "") : c === "reps" ? (s.ciclo_id === "auto" && !hecha(s) ? "" : n0(s.reps) || "")
    : c === "m" ? n0(s.distancia) || "" : n0(s.tiempo) ? fmtTiempo(s.tiempo) : "";
  [["enA", "enEtA"], ["enB", "enEtB"]].forEach(([inp, et], k) => {
    const c = ent.campos[k];
    $(et).textContent = etiqueta[c] + (dist && k === 1 ? " (opcional)" : "");
    $(inp).value = valor(c);
    $(inp).inputMode = c === "reps" || c === "m" ? "numeric" : "decimal";
    $(inp).placeholder = c === "reps" && s.ciclo_id ? "máx" : c === "t" ? "3,40" : "";
  });
  $("enHecha").textContent = hecha(s) ? "Guardar cambios" : "✓ Hecha";
  $("enAviso").textContent = "";
  $("enAnt").disabled = ent.i === 0;
  $("enSig").disabled = ent.i >= lista.length - 1;
}
function siguientePendiente() {
  const n = ent.cola.length;
  const sig = Array.from({ length: n }, (_, k) => (ent.i + 1 + k) % n).find(k => !hecha(db.series[ent.cola[k]]));
  if (sig === undefined) $("enFin").hidden = false; else ent.i = sig;
  pintarEntreno();
}
$("enHecha").addEventListener("click", () => {
  const s = serieEnt();
  if (!s) return;
  // El sonido del final del descanso solo puede prepararse con un toque
  if (!ent.audio && window.AudioContext) { try { ent.audio = new AudioContext(); } catch {} }
  const a = $("enA"), b = $("enB"), aviso = t => { $("enAviso").textContent = t; };
  const fila = { ...s, hecha: true };
  if (ent.campos[0] === "kg") {
    const kg = parseFloat((a.value.trim() || "0").replace(",", ".")), reps = parseInt(b.value, 10);
    if (!(kg >= 0)) { aviso("Revisa el peso."); a.focus(); return; }
    if (!(reps > 0)) { aviso("Pon las repeticiones que has hecho."); b.focus(); return; }
    fila.peso = kg; fila.reps = reps;
    if (s.ciclo_id === "auto") { const c = cicloActivo(s.ejercicio_id); fila.ciclo_id = c ? c.id : ""; }
  } else {
    const v = {}; v[ent.campos[0]] = a.value; v[ent.campos[1]] = b.value;
    fila.distancia = parseFloat((v.m || "").replace(",", ".")) || 0;
    fila.tiempo = leerTiempo(v.t);
    if (isNaN(fila.tiempo)) { aviso("Revisa el tiempo (por ejemplo 3,40)."); return; }
    if (!(fila.distancia > 0) && !(fila.tiempo > 0)) { aviso("Pon los metros o el tiempo."); return; }
  }
  const yaHecha = hecha(s);
  cambiar("series", fila);
  pintarBloques(true);
  avisarSiPR(fila, [["series", s]]);
  if (yaHecha) { pintarEntreno(); return; }
  siguientePendiente();
  if (!$("enFin").hidden) return;   // era la última: no hay descanso
  if (n0(fila.descanso) > 0) empezarDescanso(n0(fila.descanso));
  else if (n0(fila.rec_dist) > 0) mostrarRecuperacion(n0(fila.rec_dist));
});
document.querySelectorAll("#dlgEntreno .paso").forEach((p, k) => p.querySelectorAll("button").forEach(x => x.addEventListener("click", () => {
  if (ent) ajustarCampo(p.querySelector("input"), ent.campos[k], x.classList.contains("mas") ? 1 : -1);
})));
function empezarDescanso(seg) {
  ent.fin = Date.now() + seg * 1000;
  $("enDescTit").textContent = "Descanso";
  $("enDescanso").classList.remove("fin");
  $("enDescanso").hidden = false;
  $("enMenos").hidden = $("enMas").hidden = false;
  clearInterval(ent.timer);
  ent.timer = setInterval(ticDescanso, 250);
  ticDescanso();
}
function ticDescanso() {
  const r = Math.max(0, Math.ceil((ent.fin - Date.now()) / 1000));
  $("enReloj").textContent = fmtTiempo(r);
  if (r <= 0) finDescanso();
}
function pitido() {
  const ac = ent && ent.audio;
  if (!ac) return;
  try {
    ac.resume();
    [0, 0.35].forEach(t => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880; g.gain.value = 0.25;
      o.connect(g); g.connect(ac.destination);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.2);
    });
  } catch {}
}
function finDescanso() {
  clearInterval(ent.timer);
  ent.timer = null;
  $("enDescanso").classList.add("fin");
  $("enDescTit").textContent = "¡A por la siguiente!";
  pitido();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  setTimeout(() => { if (ent && !ent.timer) $("enDescanso").hidden = true; }, 4000);
}
function mostrarRecuperacion(m) {
  clearInterval(ent.timer);
  ent.timer = null;
  $("enDescanso").classList.remove("fin");
  $("enDescTit").textContent = "Recuperación";
  $("enReloj").textContent = fmtDist(m);
  $("enMenos").hidden = $("enMas").hidden = true;
  $("enDescanso").hidden = false;
}
const moverDescanso = seg => {
  if (!ent || !ent.fin) return;
  ent.fin = Math.max(Date.now(), ent.fin) + seg * 1000;
  $("enDescanso").classList.remove("fin");
  $("enDescTit").textContent = "Descanso";
  if (!ent.timer) ent.timer = setInterval(ticDescanso, 250);
  ticDescanso();
};
$("enMenos").addEventListener("click", () => moverDescanso(-15));
$("enMas").addEventListener("click", () => moverDescanso(15));
$("enSaltarD").addEventListener("click", () => { clearInterval(ent.timer); ent.timer = null; ent.fin = 0; $("enDescanso").hidden = true; });
$("enAnt").addEventListener("click", () => { if (ent.i > 0) { ent.i--; pintarEntreno(); } });
$("enCalentSi").addEventListener("click", () => {
  const s = serieEnt();
  if (!s || !ent.calent) return;
  const delEj = seriesDelDia(ent.dia.id).filter(x => x.ejercicio_id === s.ejercicio_id && !x.bloque_id && (x.grupo || "") === (s.grupo || ""));
  const nuevas = aceptarCalent(ent.dia.id, s.ejercicio_id, s.grupo, delEj, ent.calent);
  ent.cola = colaEntreno(ent.dia.id);
  ent.i = Math.max(0, ent.cola.indexOf(nuevas[0].id));
  pintarEntreno();
});
$("enCalentNo").addEventListener("click", () => { const s = serieEnt(); if (s) rechazarCalent(ent.dia.id, s.ejercicio_id); pintarEntreno(); });
$("enSig").addEventListener("click", () => { if (ent.i < ent.cola.length - 1) { ent.i++; pintarEntreno(); } });
function salirEntreno() {
  if ($("dlgEntreno").open) $("dlgEntreno").close();
}
$("dlgEntreno").addEventListener("close", () => {
  if (ent) clearInterval(ent.timer);
  ent = null;
  if (bloqueoPantalla) { bloqueoPantalla.release().catch(() => {}); bloqueoPantalla = null; }
  document.body.append($("toast"), $("fiesta"));
  pintarTodo();
});
$("enSalir").addEventListener("click", salirEntreno);
$("enRpe").addEventListener("click", () => { const d = ent.dia; salirEntreno(); abrirRpe(d); });

// ---------- Sugerencias: se guardan en el dispositivo y se envían en cuanto hay conexión ----------
const VERSION_APP = "v24";
let sugPend = leer("sugerencias-pend-v1") || [], sugTipo = "idea", sugerencias = [];
function abrirSug() {
  sugTipo = "idea";
  $("sugTipo").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tipo === sugTipo)));
  $("sugAviso").textContent = "";
  if ($("dlgAyuda").open) $("dlgAyuda").close();
  $("dlgSug").showModal();
  $("sugTexto").focus();
}
$("sugTipo").addEventListener("click", ev => {
  const b = ev.target.closest("[data-tipo]");
  if (!b) return;
  sugTipo = b.dataset.tipo;
  $("sugTipo").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
});
$("sugEnviar").addEventListener("click", async () => {
  const texto = $("sugTexto").value.trim();
  if (!texto) { $("sugAviso").textContent = "Escribe tu sugerencia antes de enviarla."; $("sugTexto").focus(); return; }
  sugPend.push({ id: nuevoId(), tipo: sugTipo, texto: texto.slice(0, 2000), email: (sesion && sesion.email) || "", version: VERSION_APP, agente: navigator.userAgent.slice(0, 300), creado: new Date().toISOString() });
  escribir("sugerencias-pend-v1", sugPend);
  $("sugTexto").value = "";
  $("dlgSug").close();
  const ok = await enviarSugerencias();
  avisoDeshacer(ok ? "¡Gracias! Tu sugerencia se ha enviado" : "¡Gracias! Se enviará en cuanto haya conexión");
});
// Envía las pendientes; el id evita duplicados si un envío se repite
async function enviarSugerencias() {
  if (!sugPend.length || !sesion) return true;
  try {
    const r = await api("/rest/v1/sugerencias?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(sugPend) });
    if (!r.ok) return false;
    sugPend = [];
    escribir("sugerencias-pend-v1", sugPend);
    return true;
  } catch { return false; }
}
// Para el administrador: lista en Plan con leídas y no leídas
async function cargarSugerencias() {
  if (!(perfil && perfil.es_admin)) return;
  try {
    const r = await api("/rest/v1/sugerencias?select=id,email,tipo,texto,version,agente,creado,leida&order=creado.desc&limit=200");
    if (r.ok) sugerencias = await r.json();
  } catch {}
  pintarSugerencias();
}
function pintarSugerencias() {
  const admin = !!(perfil && perfil.es_admin);
  $("bloqueSug").hidden = !admin;
  if (!admin) return;
  const noLeidas = sugerencias.filter(s => !s.leida).length;
  contadorSec("sugerencias", noLeidas ? noLeidas + " sin leer" : sugerencias.length);
  const cont = $("listaSug");
  cont.textContent = "";
  if (!sugerencias.length) { cont.appendChild(nota("Aún no hay sugerencias. Cuando alguien envíe una, te llegará también un correo.")); return; }
  sugerencias.forEach(s => {
    const d = document.createElement("div");
    d.className = "sug" + (s.leida ? " leida" : "");
    d.innerHTML = '<div class="sug-cab"><span class="sug-tipo"></span><span class="sug-de"></span><button type="button" class="nav-btn"></button></div><p class="sug-texto"></p>';
    d.querySelector(".sug-tipo").textContent = { idea: "Idea", fallo: "Fallo", otro: "Otro" }[s.tipo] || s.tipo;
    d.querySelector(".sug-tipo").classList.add("t-" + s.tipo);
    d.querySelector(".sug-de").textContent = (s.email || "?") + " · " + fechaCorta(iso(new Date(s.creado))) + (s.version ? " · " + s.version : "");
    d.querySelector(".sug-de").title = s.agente || "";
    d.querySelector(".sug-texto").textContent = s.texto;
    const b = d.querySelector("button");
    b.textContent = s.leida ? "Marcar no leída" : "Marcar leída";
    b.addEventListener("click", async () => {
      try {
        const r = await api("/rest/v1/sugerencias?id=eq." + encodeURIComponent(s.id), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ leida: !s.leida }) });
        if (!r.ok) throw new Error();
        s.leida = !s.leida;
        pintarSugerencias();
      } catch { setEstado("No se ha podido cambiar. Revisa la conexión.", true); }
    });
    cont.appendChild(d);
  });
}
$("sugAyuda").addEventListener("click", abrirSug);
$("sugPie").addEventListener("click", abrirSug);
$("sugRecargar").addEventListener("click", cargarSugerencias);
$("tabPlan").addEventListener("click", cargarSugerencias);

// ---------- Importar carreras: GPX y TCX del reloj, o el CSV de actividades de Strava o Garmin ----------
const ritmoRecImport = () => n0(ajustes().ritmoRec) || 480;   // más lento que esto (s/km) es recuperación
const distGeo = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
};
const textoDe = (el, tag) => ((el.getElementsByTagName(tag)[0] || {}).textContent || "").trim();
function leerGPX(doc) {
  return [...doc.getElementsByTagName("trk")].map(trk => {
    const pts = [...trk.getElementsByTagName("trkpt")].map(p => ({ lat: +p.getAttribute("lat"), lon: +p.getAttribute("lon"), t: Date.parse(textoDe(p, "time")) }))
      .filter(p => !isNaN(p.lat) && !isNaN(p.lon) && !isNaN(p.t));
    if (pts.length < 2) return null;
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += distGeo(pts[i - 1], pts[i]);
    return { inicio: pts[0].t, nombre: textoDe(trk, "name"), deporte: textoDe(trk, "type"), vueltas: [{ distancia: d, tiempo: (pts[pts.length - 1].t - pts[0].t) / 1000 }] };
  }).filter(Boolean);
}
function leerTCX(doc) {
  return [...doc.getElementsByTagName("Activity")].map(a => {
    const laps = [...a.getElementsByTagName("Lap")];
    const vueltas = laps.map(l => ({ distancia: +textoDe(l, "DistanceMeters") || 0, tiempo: +textoDe(l, "TotalTimeSeconds") || 0 }));
    if (!vueltas.length) return null;
    return { inicio: Date.parse(textoDe(a, "Id") || laps[0].getAttribute("StartTime")), nombre: textoDe(a, "Notes"), deporte: a.getAttribute("Sport") || "", vueltas };
  }).filter(Boolean);
}
function filasCSV(texto) {
  const primera = texto.split("\n")[0], sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ";" : ",";
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += c; }
    else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && texto[i + 1] === "\n") i++; fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(x => x.trim()));
}
const MESES_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function leerFechaCSV(s) {
  const t = norm(String(s || "")).replace(/\./g, "");
  let m;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ t](\d{1,2}):(\d{2})/))) return new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]).getTime();   // Garmin: hora local
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/))) return new Date(+m[3], m[2] - 1, +m[1], +(m[4] || 12), +(m[5] || 0)).getTime();
  // Strava (en UTC): «Nov 3, 2026, 5:45:12 PM» o «3 nov 2026, 17:45:12»
  if ((m = t.match(/^([a-z]{3})[a-z]* (\d{1,2}),? (\d{4}),? (\d{1,2}):(\d{2})(?::\d{2})? ?(am|pm)?/)) && MESES_EN.includes(m[1])) {
    let h = +m[4];
    if (m[6] === "pm" && h < 12) h += 12;
    if (m[6] === "am" && h === 12) h = 0;
    return Date.UTC(+m[3], MESES_EN.indexOf(m[1]), +m[2], h, +m[5]);
  }
  if ((m = t.match(/^(\d{1,2}) (?:de )?([a-z]{3})[a-z]*(?: de)? (\d{4}),? (\d{1,2}):(\d{2})/)) && MESES.map(norm).includes(m[2])) return Date.UTC(+m[3], MESES.map(norm).indexOf(m[2]), +m[1], +m[4], +m[5]);
  const x = Date.parse(s);
  return isNaN(x) ? NaN : x;
}
function leerCSVActividades(texto) {
  const filas = filasCSV(texto);
  if (filas.length < 2) return [];
  const cab = filas[0].map(h => norm(h)), col = (...n) => cab.findIndex(h => n.includes(h));
  const iF = col("activity date", "date", "fecha", "fecha de la actividad", "start time", "hora de inicio"), iT = col("activity type", "tipo de actividad", "type", "tipo");
  const iD = col("distance", "distancia"), iM = col("moving time", "tiempo en movimiento"), iE = col("elapsed time", "tiempo transcurrido", "time", "tiempo");
  const iN = col("activity name", "title", "titulo", "nombre de la actividad", "nombre");
  if (iF < 0 || iD < 0 || (iM < 0 && iE < 0)) throw new Error("No reconozco las columnas del CSV (hacen falta fecha, distancia y tiempo).");
  return filas.slice(1).map(f => {
    const tt = String((iM >= 0 && f[iM]) || (iE >= 0 && f[iE]) || "").trim(), tiempo = /:/.test(tt) ? leerTiempo(tt.replace(/\.\d+$/, "")) : parseFloat(tt.replace(",", "."));
    let d = parseFloat(String(f[iD] || "").replace(/\s/g, "").replace(",", "."));
    if (d > 0 && d < 300) d *= 1000;   // en km
    return { inicio: leerFechaCSV(f[iF]), nombre: iN >= 0 ? (f[iN] || "").trim() : "", deporte: iT >= 0 ? f[iT] || "" : "", vueltas: [{ distancia: d || 0, tiempo: tiempo || 0 }] };
  }).filter(a => !isNaN(a.inicio) && a.vueltas[0].distancia > 0 && a.vueltas[0].tiempo > 0);
}
// Clasifica las vueltas: las rápidas son series; más lentas que el límite, recuperación; sin avanzar, descanso parado;
// las lentas y largas del principio y del final, calentamiento y vuelta a la calma
function clasificarVueltas(vueltas) {
  const lim = ritmoRecImport();
  const v = vueltas.map(x => ({ distancia: x.distancia, tiempo: x.tiempo, ritmo: x.distancia > 0 ? x.tiempo / (x.distancia / 1000) : Infinity }));
  v.forEach(x => { x.clase = x.distancia < 50 || x.tiempo <= 0 || x.ritmo > 1800 ? "parado" : x.ritmo > lim ? "rec" : "serie"; });
  const rapidas = v.filter(x => x.clase === "serie").map(x => x.ritmo).sort((a, b) => a - b);
  if (!rapidas.length) return { continuo: true, vueltas: v };
  // Vueltas automáticas por km en un rodaje: ritmos parecidos y sin recuperaciones
  if (v.length === 1 || (!v.some(x => x.clase === "rec") && rapidas[rapidas.length - 1] / rapidas[0] < 1.15)) return { continuo: true, vueltas: v };
  const ref = rapidas[Math.floor((rapidas.length - 1) / 3)], lenta = x => x.ritmo > ref * 1.2, larga = x => x.distancia >= 800 || x.tiempo >= 240;
  const i0 = v.findIndex(x => x.clase === "serie" && !lenta(x)), i1 = v.length - 1 - v.slice().reverse().findIndex(x => x.clase === "serie" && !lenta(x));
  v.forEach((x, i) => {
    if (x.clase === "parado" || !larga(x) || !(lenta(x) || x.clase === "rec")) return;
    if (i < i0) x.clase = "calent"; else if (i > i1) x.clase = "calma";
  });
  return { continuo: false, vueltas: v };
}
const CLASES_VUELTA = { serie: "Serie", rec: "Recuperación", parado: "Descanso parado", calent: "Calentamiento", calma: "Vuelta a la calma", ignorar: "No importar" };
// Series de distancia parecida (±5 %): se pueden agrupar como bloque ×N
function patronSeries(v) {
  const s = v.filter(x => x.clase === "serie");
  if (!s.length) return { nombre: "Series", regular: false };
  const media = s.reduce((a, x) => a + x.distancia, 0) / s.length, regular = s.every(x => Math.abs(x.distancia - media) <= media * 0.05);
  const redondo = media >= 300 ? Math.round(media / 100) * 100 : Math.round(media / 50) * 50;
  return { nombre: regular ? "Series " + redondo + " m" : "Series", regular: regular && s.length >= 3, n: s.length };
}
let importadas = [];
const noEsCarrera = d => /bik|cycl|ride|cicl|bici|swim|nata|walk|camin|hik|sender|yoga|weight|fuerza|gym/.test(norm(d));
function prepararActividad(a) {
  const d0 = new Date(a.inicio), fecha = iso(d0), hora = String(d0.getHours()).padStart(2, "0") + ":" + String(d0.getMinutes()).padStart(2, "0");
  const total = a.vueltas.reduce((x, v) => ({ d: x.d + v.distancia, t: x.t + v.tiempo }), { d: 0, t: 0 });
  const c = clasificarVueltas(a.vueltas), grupo = (a.nombre || "Carrera").slice(0, 40) + " · " + hora;
  // Ya importada: misma sesión ese día, o casi la misma distancia de carrera ese día
  const delDia = seriesVivas().filter(s => s.fecha === fecha && tipoDe(s.ejercicio_id) === "carrera");
  const kmDia = delDia.reduce((x, s) => x + n0(s.distancia) + n0(s.rec_dist), 0);
  const dup = delDia.some(s => s.grupo === grupo) || (kmDia > 0 && Math.abs(kmDia - total.d) <= total.d * 0.03);
  return { ...a, fecha, hora, grupo, total, vueltas: c.vueltas, modo: c.continuo ? "rodaje" : "vueltas", bloque: patronSeries(c.vueltas).regular, dup, otro: noEsCarrera(a.deporte), importar: !dup && !noEsCarrera(a.deporte) };
}
async function leerArchivosImport(archivos) {
  $("impAviso").textContent = "";
  const nuevas = [];
  for (const f of archivos) {
    try {
      const texto = await f.text(), nombre = f.name.toLowerCase();
      let acts;
      if (/\.csv$/.test(nombre) || !/^\s*</.test(texto)) acts = leerCSVActividades(texto);
      else {
        const doc = new DOMParser().parseFromString(texto, "application/xml");
        if (doc.getElementsByTagName("parsererror").length) throw new Error("el archivo está dañado o no es GPX/TCX");
        acts = doc.getElementsByTagName("TrainingCenterDatabase").length ? leerTCX(doc) : leerGPX(doc);
      }
      if (!acts.length) throw new Error("no tiene ninguna actividad con distancia y tiempo");
      nuevas.push(...acts.map(prepararActividad));
    } catch (e) { $("impAviso").textContent += f.name + ": " + (e.message || "no se ha podido leer") + ". "; }
  }
  importadas = nuevas.sort((a, b) => b.inicio - a.inicio);
  pintarImportar();
}
function pintarImportar() {
  const cont = $("impLista");
  cont.textContent = "";
  importadas.forEach((a, k) => {
    const caja = document.createElement("div");
    caja.className = "imp-act";
    const cab = document.createElement("label");
    cab.className = "imp-cab";
    cab.innerHTML = '<input type="checkbox"><span class="imp-t"></span>';
    const chk = cab.querySelector("input");
    chk.checked = a.importar;
    chk.addEventListener("change", () => { a.importar = chk.checked; pintarBotonImport(); });
    cab.querySelector(".imp-t").textContent = NOMBRES[(new Date(a.inicio).getDay() + 6) % 7] + " " + fechaCorta(a.fecha) + " · " + a.hora + (a.nombre ? " · " + a.nombre : "") +
      " — " + fmtDist(a.total.d) + " en " + fmtTiempo(a.total.t) + " (" + fmtTiempo(a.total.t / (a.total.d / 1000)) + "/km)";
    caja.appendChild(cab);
    if (a.dup || a.otro) caja.appendChild(nota(a.dup ? "Parece que ya está en tu calendario: no se importará salvo que la marques." : "No parece una carrera (" + a.deporte + "): márcala si quieres importarla igualmente."));
    if (a.vueltas.length > 1) {
      const modo = document.createElement("select");
      modo.className = "imp-modo";
      modo.innerHTML = '<option value="rodaje">Como un rodaje (una sola serie)</option><option value="vueltas">Vuelta a vuelta (series y recuperaciones)</option>';
      modo.value = a.modo;
      modo.setAttribute("aria-label", "Cómo guardar esta actividad");
      modo.addEventListener("change", () => { a.modo = modo.value; pintarImportar(); });
      caja.appendChild(modo);
    }
    if (a.modo === "vueltas") {
      const tabla = document.createElement("div");
      tabla.className = "imp-vueltas";
      a.vueltas.forEach((v, i) => {
        const fila = document.createElement("div");
        fila.className = "imp-v c-" + v.clase;
        fila.innerHTML = '<span class="imp-n"></span><span class="imp-d"></span><select></select>';
        fila.querySelector(".imp-n").textContent = i + 1;
        fila.querySelector(".imp-d").textContent = fmtDist(v.distancia) + " · " + fmtTiempo(v.tiempo) + (isFinite(v.ritmo) && v.distancia >= 50 ? " · " + fmtTiempo(v.ritmo) + "/km" : "");
        const sel = fila.querySelector("select");
        Object.keys(CLASES_VUELTA).forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = CLASES_VUELTA[c]; sel.appendChild(o); });
        sel.value = v.clase;
        sel.setAttribute("aria-label", "Vuelta " + (i + 1));
        sel.addEventListener("change", () => { v.clase = sel.value; a.bloque = a.bloque && patronSeries(a.vueltas).regular; pintarImportar(); });
        tabla.appendChild(fila);
      });
      caja.appendChild(tabla);
      const p = patronSeries(a.vueltas);
      caja.appendChild(nota(p.n ? p.n + (p.n === 1 ? " serie" : " series") + " → «" + p.nombre + "». Las recuperaciones y los descansos se guardan como descanso de la serie anterior; el calentamiento y la vuelta a la calma no cuentan para marcas." : "No hay ninguna vuelta marcada como serie."));
      if (p.regular) {
        const b = document.createElement("label");
        b.className = "permiso";
        b.innerHTML = '<input type="checkbox"> Agrupar las series como bloque ×' + p.n;
        b.querySelector("input").checked = a.bloque;
        b.querySelector("input").addEventListener("change", ev => { a.bloque = ev.target.checked; });
        caja.appendChild(b);
      }
    }
    cont.appendChild(caja);
  });
  pintarBotonImport();
}
function pintarBotonImport() {
  const n = importadas.filter(a => a.importar).length;
  $("impGuardar").hidden = !importadas.length;
  $("impGuardar").disabled = !n;
  $("impGuardar").textContent = n ? "Importar " + n + (n === 1 ? " actividad" : " actividades") : "Marca alguna actividad";
}
function guardarActividad(a) {
  let orden = Date.now() + Math.round(Math.random() * 1000);
  const filas = [];
  const fila = (ej, extra) => { const f = { id: nuevoId(), fecha: a.fecha, ejercicio_id: ej, orden: orden++, peso: 0, reps: 0, distancia: 0, tiempo: 0, descanso: 0, rec_dist: 0, pct: 0,
    ciclo_id: "", calentamiento: false, hecha: true, grupo: a.grupo, meso_id: "", bloque_id: "", ronda: 0, borrado: false, ...extra }; filas.push(f); return f; };
  if (a.modo === "rodaje") fila(idPorNombre("Rodaje", "carrera"), { distancia: Math.round(a.total.d), tiempo: Math.round(a.total.t) });
  else {
    const p = patronSeries(a.vueltas), idSerie = idPorNombre(p.nombre, "carrera"), bloque = a.bloque && p.regular ? nuevoId() : "";
    let ultima = null, ronda = 0;
    a.vueltas.forEach(v => {
      const d = Math.round(v.distancia), t = Math.round(v.tiempo);
      if (v.clase === "serie") ultima = fila(idSerie, { distancia: d, tiempo: t, bloque_id: bloque, ronda: bloque ? ++ronda : 0 });
      else if ((v.clase === "rec" || v.clase === "parado") && ultima) { ultima.descanso += t; if (v.clase === "rec") ultima.rec_dist += d; }
      else if (v.clase === "calent" || v.clase === "calma") { fila(idPorNombre(v.clase === "calent" ? "Calentamiento carrera" : "Vuelta a la calma", "carrera"), { distancia: d, tiempo: t, calentamiento: true }); ultima = null; }
    });
  }
  filas.forEach(f => cambiar("series", f, true));
  return filas.length;
}
$("impArchivo").addEventListener("change", ev => { const fs = [...ev.target.files]; ev.target.value = ""; if (fs.length) leerArchivosImport(fs); });
$("impGuardar").addEventListener("click", () => {
  const elegidas = importadas.filter(a => a.importar);
  const n = elegidas.reduce((x, a) => x + guardarActividad(a), 0);
  persistir();
  $("dlgImport").close();
  setEstado("Importadas " + elegidas.length + (elegidas.length === 1 ? " actividad" : " actividades") + " (" + n + " series)");
  if (elegidas.length === 1) abrirDia(elegidas[0].fecha); else { pintarTodo(); verPestana("semana"); }
});
$("impAbrir").addEventListener("click", () => {
  importadas = [];
  $("impLista").textContent = "";
  $("impAviso").textContent = "";
  pintarBotonImport();
  $("dlgImport").showModal();
});
// Ajuste: ritmo a partir del cual una vuelta es recuperación
$("ajRitmoRec").value = ajustes().ritmoRec ? fmtTiempo(ajustes().ritmoRec) : "";
$("ajRitmoRec").addEventListener("change", () => {
  const a = leer("ajustes-v1") || {}, v = leerTiempo($("ajRitmoRec").value);
  if (v >= 180 && v <= 1200) a.ritmoRec = v; else delete a.ritmoRec;
  escribir("ajustes-v1", a);
  $("ajRitmoRec").value = a.ritmoRec ? fmtTiempo(a.ritmoRec) : "";
  setEstado("Ajuste guardado en este dispositivo");
});

// ---------- Plan: secciones desplegables con contador; se recuerda cuáles quedan abiertas ----------
let seccionesPlan = { plantillas: true, mesociclos: true, ...(leer("plan-abiertas-v1") || {}) };
function ponerSeccion(sec, abierta) {
  sec.classList.toggle("cerrada", !abierta);
  sec.querySelector(".sec-toggle").setAttribute("aria-expanded", String(abierta));
  sec.querySelector(".sec-cuerpo").inert = !abierta;
}
function contadorSec(clave, n) {
  const el = document.querySelector('#vistaPlan [data-sec="' + clave + '"] .sec-n');
  if (el) el.textContent = n === "" || n === 0 ? "" : "· " + n;
}
document.querySelectorAll("#vistaPlan > .plan-sec[data-sec]").forEach(sec => {
  const h = sec.querySelector("h3"), cab = h.closest(".sec-cab") || h, clave = sec.dataset.sec;
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "sec-toggle";
  boton.innerHTML = '<span class="flecha-dia" aria-hidden="true">▸</span>';
  h.before(boton);
  boton.appendChild(h);
  const n = document.createElement("span"); n.className = "sec-n"; boton.appendChild(n);
  const cuerpo = document.createElement("div"), dentro = document.createElement("div");
  cuerpo.className = "sec-cuerpo"; dentro.className = "sec-cuerpo-in";
  while (cab.nextSibling) dentro.appendChild(cab.nextSibling);
  cuerpo.appendChild(dentro);
  sec.appendChild(cuerpo);
  ponerSeccion(sec, !!seccionesPlan[clave]);
  boton.addEventListener("click", () => {
    seccionesPlan[clave] = sec.classList.contains("cerrada");
    escribir("plan-abiertas-v1", seccionesPlan);
    ponerSeccion(sec, seccionesPlan[clave]);
  });
});
$("buscarPlantilla").addEventListener("input", () => {
  const sec = $("buscarPlantilla").closest(".plan-sec");
  if (sec.classList.contains("cerrada")) { seccionesPlan.plantillas = true; escribir("plan-abiertas-v1", seccionesPlan); ponerSeccion(sec, true); }
  pintarPlan();
});

// ---------- Instrucciones de uso ----------
function abrirAyuda() {
  $("ayudaAdmin").hidden = !(perfil && perfil.es_admin);
  if (!$("dlgAyuda").open) $("dlgAyuda").showModal();
}
$("ayudaBtn").addEventListener("click", abrirAyuda);

if (sesion) mostrarApp(); else $("login").hidden = false;

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
