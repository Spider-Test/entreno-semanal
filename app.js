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
const $ = id => document.getElementById(id);

// ---------- Almacenamiento local (funciona sin conexión) ----------
const leer = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const escribir = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Cada tabla se sincroniza igual: gana la edición más reciente de cada fila.
// El orden importa al subir: primero ejercicios y plantillas, después las series que los usan.
const TABLAS = {
  ejercicios: { clave: "id", conflicto: "id", campos: ["id", "nombre", "tipo", "video_url", "notas", "borrado", "actualizado"] },
  plantillas: { clave: "id", conflicto: "id", campos: ["id", "nombre", "items", "borrado", "actualizado"] },
  mesociclos: { clave: "id", conflicto: "id", campos: ["id", "nombre", "inicio", "semanas", "dias", "progresion", "notas", "borrado", "actualizado"] },
  series: { clave: "id", conflicto: "id", campos: ["id", "fecha", "ejercicio_id", "orden", "peso", "reps", "distancia", "tiempo", "descanso", "hecha", "grupo", "meso_id", "borrado", "actualizado"] },
  entrenos: { clave: "fecha", conflicto: "user_id,fecha", campos: ["fecha", "html", "texto", "actualizado"] }
};
const DEFECTOS = { tipo: "fuerza", hecha: true, grupo: "", meso_id: "", items: [], dias: {}, nombre: "", video_url: "", notas: "", html: "", texto: "", borrado: false };
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
const norm = t => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
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
  if (/(carrera|correr|rodaje|tirada|sprint|series de|fartlek|cuesta|trote|running|\d+ ?m\b|\d+ ?km\b)/.test(n)) return "carrera";
  return "fuerza";
}
const hecha = s => s.hecha !== false;   // las series planificadas tienen hecha = false
const rm = s => n0(s.reps) <= 1 ? n0(s.peso) : n0(s.peso) * (1 + n0(s.reps) / 30);    // 1RM estimado (Epley)
const ritmoSeg = (s, tipo) => n0(s.tiempo) / (n0(s.distancia) / TIPOS[tipo].porMetros);
const ritmo = (s, tipo) => fmtTiempo(ritmoSeg(s, tipo)) + TIPOS[tipo].sufijo;
const conMarca = s => n0(s.tiempo) > 0 && n0(s.distancia) > 0;
function serieTexto(s) {
  const tipo = tipoDe(s.ejercicio_id);
  if (esDistancia(tipo)) return fmtDist(s.distancia) + (n0(s.tiempo) > 0 ? " · " + fmtTiempo(s.tiempo) + " · " + ritmo(s, tipo) : "");
  return n0(s.peso) > 0 ? num(s.peso) + " kg × " + n0(s.reps) : n0(s.reps) + " reps";
}
const descTexto = s => n0(s.descanso) > 0 ? "desc. " + fmtTiempo(s.descanso) : "";
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
    st.resumen = (st.mejorRitmo ? "Mejor ritmo: " + ritmo(st.mejorRitmo, tipo) + " (" + fmtDist(st.mejorRitmo.distancia) + ") · " : "") + fmtDist(st.total) + " en total";
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
let timerSync;
function persistir() {
  guardarLocal();
  setEstado("Guardado en el dispositivo");
  clearTimeout(timerSync);
  timerSync = setTimeout(sincronizar, 1000);
}
function cambiar(tabla, fila, enLote) {
  fila.actualizado = new Date().toISOString();
  fila.sucio = true;
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

// ---------- Temporizador de descanso ----------
let crono = null, audio = null;
function pitar(enSegundos) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const t = audio.currentTime + enSegundos;
    return [0, 0.3, 0.6].map(d => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2);
      o.connect(g).connect(audio.destination);
      o.start(t + d); o.stop(t + d + 0.22);
      return o;
    });
  } catch { return []; }
}
function pararCrono() {
  if (crono) crono.sonidos.forEach(o => { try { o.stop(); } catch {} });
  crono = null;
  $("crono").hidden = true;
}
function iniciarCrono(segundos, nombre) {
  pararCrono();
  crono = { fin: Date.now() + segundos * 1000, nombre, sonidos: pitar(segundos), avisado: false };
  tic();
}
function tic() {
  if (!crono) return;
  const quedan = Math.ceil((crono.fin - Date.now()) / 1000), el = $("crono");
  el.hidden = false;
  el.querySelector(".c-n").textContent = crono.nombre;
  if (quedan > 0) {
    el.classList.remove("listo");
    el.querySelector(".c-t").textContent = "Descanso " + fmtTiempo(quedan);
  } else {
    el.classList.add("listo");
    el.querySelector(".c-t").textContent = "¡A por la siguiente!";
    if (!crono.avisado) { crono.avisado = true; if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
    if (quedan < -10) pararCrono();
  }
}
setInterval(tic, 500);
$("crono").addEventListener("click", pararCrono);

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
                  '<div class="bloques"></div><button type="button" class="add-ej">+ Ejercicio</button>';
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
function itemsDe(series) {
  const items = [];
  series.forEach(s => {
    let it = items.find(x => x.ejercicio_id === s.ejercicio_id && x.grupo === (s.grupo || ""));
    if (!it) { it = { ejercicio_id: s.ejercicio_id, grupo: s.grupo || "", series: [] }; items.push(it); }
    it.series.push({ peso: n0(s.peso), reps: n0(s.reps), distancia: n0(s.distancia), tiempo: n0(s.tiempo), descanso: n0(s.descanso) });
  });
  return items;
}
// Pega ejercicios como series planificadas; el grupo es el nombre de la sesión (p. ej. «Pierna»)
function pegarItems(fecha, items, grupo, mesoId, masKg) {
  let orden = Date.now();
  items.forEach(it => {
    if (!ejercicioVivo(it.ejercicio_id)) return;
    it.series.forEach(v => cambiar("series", {
      id: nuevoId(), fecha, ejercicio_id: it.ejercicio_id, orden: orden++,
      peso: n0(v.peso) > 0 ? Math.max(0, n0(v.peso) + n0(masKg)) : 0, reps: n0(v.reps), distancia: n0(v.distancia), tiempo: n0(v.tiempo), descanso: n0(v.descanso),
      hecha: false, grupo: grupo !== undefined ? grupo : (it.grupo || ""), meso_id: mesoId || "", borrado: false
    }, true));
  });
}
const resumenItems = items => {
  const n = items.reduce((a, it) => a + it.series.length, 0);
  return items.length + (items.length === 1 ? " ejercicio · " : " ejercicios · ") + n + (n === 1 ? " serie" : " series");
};
const nombresItems = items => items.map(it => (db.ejercicios[it.ejercicio_id] || {}).nombre).filter(Boolean).join(", ");
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
  const items = itemsDe(series).map(it => ({ ejercicio_id: it.ejercicio_id, series: it.series }));
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
  delDia.forEach(s => { const g = grupo(s.grupo || ""); if (!g.ids.includes(s.ejercicio_id)) g.ids.push(s.ejercicio_id); });
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
    g.ids.forEach(id => cont.appendChild(bloque(dia, id, delDia.filter(s => s.ejercicio_id === id && (s.grupo || "") === g.nombre), g.nombre)));
  });
}

function etiquetaTipo(tipo) {
  const t = document.createElement("span");
  t.className = "tipo-tag";
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
        ? '<input class="in-a" inputmode="numeric" pattern="[0-9]*" placeholder="metros" aria-label="Distancia en metros" autocomplete="off" enterkeyhint="next">' +
          '<input class="in-b" inputmode="decimal" placeholder="tiempo 3,40" aria-label="Tiempo (minutos y segundos)" autocomplete="off" enterkeyhint="next">'
        : '<input class="in-a" inputmode="decimal" placeholder="kg" aria-label="Peso en kg" autocomplete="off" enterkeyhint="next">' +
          '<span class="por">×</span><input class="in-b" inputmode="numeric" pattern="[0-9]*" placeholder="reps" aria-label="Repeticiones" autocomplete="off" enterkeyhint="next">') +
      '</div>' +
      '<div class="ns-fila"><input class="in-c" inputmode="decimal" placeholder="⏱ descanso 1,30" aria-label="Descanso después de la serie (minutos y segundos)" autocomplete="off" enterkeyhint="done">' +
      '<button class="anadir">+ Serie</button></div>' +
    '</form>';
  const nom = b.querySelector(".ej-nombre");
  nom.textContent = ej.nombre || "Sin nombre";
  if (tipo !== "fuerza") nom.appendChild(etiquetaTipo(tipo));
  if (ej.video_url) { const v = document.createElement("span"); v.className = "ico"; v.textContent = "▶ vídeo"; nom.appendChild(v); }
  nom.setAttribute("aria-label", "Ver " + (ej.nombre || "ejercicio") + ": vídeo, récords e historial");
  nom.addEventListener("click", () => abrirDetalle(id));
  const quitar = b.querySelector(".quitar");
  if (series.length) quitar.remove();
  else quitar.addEventListener("click", () => { quitarEspera(dia.id, id); pintarDia(dia); });

  const fa = b.querySelector(".in-a"), fb = b.querySelector(".in-b"), fc = b.querySelector(".in-c"), boton = b.querySelector(".anadir");
  const rellenarCon = s => {
    if (dist) { fa.value = n0(s.distancia) || ""; fb.value = n0(s.tiempo) > 0 ? fmtTiempo(s.tiempo) : ""; }
    else { fa.value = n0(s.peso) > 0 ? num(s.peso) : ""; fb.value = n0(s.reps) || ""; }
    fc.value = n0(s.descanso) > 0 ? fmtTiempo(s.descanso) : "";
  };
  const terminar = s => {
    if (n0(s.descanso) > 0) iniciarCrono(n0(s.descanso), ej.nombre);
    pintarBloques(true);
  };

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
      c.addEventListener("click", () => { const h = { ...s, hecha: true }; cambiar("series", h); terminar(h); });
      marca.replaceWith(c);
    } else marca.textContent = numero;
    li.querySelector(".sv-p").textContent = serieTexto(s);
    if (descTexto(s)) { const d = document.createElement("span"); d.className = "desc"; d.textContent = descTexto(s); li.querySelector(".sv").appendChild(d); }
    li.querySelector(".sv").setAttribute("aria-label", (planificada ? "Completar" : "Editar") + " serie " + numero + ": " + serieTexto(s));
    li.querySelector(".sv").addEventListener("click", () => {
      editando = s;
      rellenarCon(s);
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
  const pendiente = series.find(s => !hecha(s));
  const ult = pendiente || series[series.length - 1] || historia[historia.length - 1];
  if (ult) rellenarCon(ult);
  [fa, fb, fc].forEach((inp, k, todos) => {
    inp.addEventListener("focus", () => inp.select());
    if (k < 2) inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); todos[k + 1].focus(); } });
  });
  b.querySelector("form").addEventListener("submit", e => {
    e.preventDefault();
    const descanso = leerDescanso(fc.value);
    if (isNaN(descanso)) { fc.focus(); return; }
    const fila = editando ? { ...editando } : { id: nuevoId(), fecha: dia.id, ejercicio_id: id, orden: Date.now(), grupo, meso_id: "", borrado: false };
    Object.assign(fila, { peso: 0, reps: 0, distancia: 0, tiempo: 0, descanso, hecha: true });
    if (dist) {
      fila.distancia = parseFloat(fa.value.replace(",", "."));
      fila.tiempo = leerTiempo(fb.value);
      if (!(fila.distancia > 0)) { fa.focus(); return; }
      if (isNaN(fila.tiempo)) { fb.focus(); return; }
    } else {
      fila.peso = parseFloat((fa.value.trim() || "0").replace(",", "."));
      fila.reps = parseInt(fb.value, 10);
      if (!(fila.peso >= 0)) { fa.focus(); return; }
      if (!(fila.reps > 0)) { fb.focus(); return; }
    }
    cambiar("series", fila);
    quitarEspera(dia.id, id);
    terminar(fila);
    const otra = dia.bloquesEl.querySelector('[data-ej="' + id + '"][data-grupo="' + CSS.escape(grupo) + '"] .anadir');
    if (otra) otra.focus();
  });
  return b;
}

// ---------- Elegir o crear ejercicio ----------
let diaSelector = null;
function crearEjercicio(nombre, tipo) {
  const id = nuevoId();
  cambiar("ejercicios", { id, nombre: nombre.trim(), tipo: TIPOS[tipo] ? tipo : "fuerza", video_url: "", notas: "", borrado: false });
  return id;
}
function abrirSelector(dia) {
  diaSelector = dia;
  $("buscarEj").value = "";
  pintarSelector();
  $("selector").showModal();
  $("buscarEj").focus();
}
function elegir(id) {
  const dia = diaSelector;
  $("selector").close();
  const yaTiene = seriesVivas().some(s => s.fecha === dia.id && s.ejercicio_id === id);
  if (!yaTiene) { enEspera[dia.id] = (enEspera[dia.id] || []).filter(x => x !== id).concat(id); guardarEspera(); }
  pintarDia(dia);
  const inp = dia.bloquesEl.querySelector('[data-ej="' + id + '"] .in-a');
  if (inp) { inp.scrollIntoView({ block: "center", behavior: "smooth" }); inp.focus(); }
}
function pintarSelector() {
  const q = $("buscarEj").value.trim(), lista = $("listaEj");
  lista.textContent = "";
  const ejs = ejerciciosOrdenados().filter(e => norm(e.nombre).includes(norm(q)));
  if (q && !ejs.some(e => norm(e.nombre) === norm(q))) {
    // Crear: el tipo que parece por el nombre va primero y resaltado
    const fila = document.createElement("div");
    fila.className = "crear-fila";
    const t = document.createElement("span");
    t.className = "cf-t";
    t.textContent = "+ Crear «" + q + "» como:";
    fila.appendChild(t);
    const sugerido = adivinarTipo(q);
    [sugerido].concat(Object.keys(TIPOS).filter(k => k !== sugerido)).forEach(k => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opcion-tipo" + (k === sugerido ? " sugerido" : "");
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
    if (tipoDe(e.id) !== "fuerza") b.appendChild(etiquetaTipo(tipoDe(e.id)));
    b.addEventListener("click", () => elegir(e.id));
    lista.appendChild(b);
  });
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
  const ejs = ejerciciosOrdenados().filter(e => norm(e.nombre).includes(norm(q)));
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
  const rec = $("detRecords"), marcas = $("detMarcas");
  rec.textContent = ""; marcas.textContent = "";
  let puntos = [], etiqueta = v => num(v);
  if (!st.lista.length) {
    rec.innerHTML = '<p class="vacio-lista">Aún no hay series hechas. Añádelas desde un día de la semana con «+ Ejercicio».</p>';
    $("detGraficaTit").textContent = "Progreso";
  } else if (esDistancia(tipo)) {
    if (st.mejorRitmo) rec.appendChild(recuadro("Mejor ritmo", ritmo(st.mejorRitmo, tipo), fmtDist(st.mejorRitmo.distancia) + " en " + fmtTiempo(st.mejorRitmo.tiempo) + " · " + fechaCorta(st.mejorRitmo.fecha), true));
    rec.appendChild(recuadro("Distancia total", fmtDist(st.total), st.sesiones.length + " sesiones · " + st.lista.length + " series"));
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
function abrirDetalle(id) {
  const e = ejercicioVivo(id);
  if (!e) return;
  detalleId = id;
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
        total += (p.items || []).reduce((a, it) => a + it.series.length, 0);
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

// ---------- Navegación ----------
function irA(n) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  desplazamiento = n;
  pintarSemana();
}
$("antBtn").addEventListener("click", () => irA(desplazamiento - 1));
$("sigBtn").addEventListener("click", () => irA(desplazamiento + 1));
$("hoyBtn").addEventListener("click", () => irA(0));

const VISTAS = { semana: "vistaSemana", ejercicios: "vistaEjercicios", plan: "vistaPlan" };
const TABS = { semana: "tabSemana", ejercicios: "tabEjercicios", plan: "tabPlan" };
function verPestana(cual) {
  if (!VISTAS[cual]) cual = "semana";
  Object.keys(VISTAS).forEach(k => {
    $(VISTAS[k]).hidden = k !== cual;
    $(TABS[k]).setAttribute("aria-selected", String(k === cual));
  });
  escribir("pestana-v1", cual);
  if (cual === "ejercicios") pintarCatalogo();
  else if (cual === "plan") pintarPlan();
  else pintarSemana();
}
Object.keys(TABS).forEach(k => $(TABS[k]).addEventListener("click", () => verPestana(k)));

function pintarTodo() {
  rellenar();
  pintarBloques(false);
  pintarBanda();
  if (!$("vistaEjercicios").hidden) pintarCatalogo();
  if (!$("vistaPlan").hidden) pintarPlan();
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
}

if (sesion) mostrarApp(); else $("login").hidden = false;

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
