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

// Cada tabla se sincroniza igual: gana la edición más reciente de cada fila
const TABLAS = {
  ejercicios: { clave: "id", conflicto: "id", campos: ["id", "nombre", "tipo", "video_url", "notas", "borrado", "actualizado"] },
  series: { clave: "id", conflicto: "id", campos: ["id", "fecha", "ejercicio_id", "orden", "peso", "reps", "distancia", "tiempo", "descanso", "borrado", "actualizado"] },
  entrenos: { clave: "fecha", conflicto: "user_id,fecha", campos: ["fecha", "html", "texto", "actualizado"] }
};
let sesion = leer("sesion-v1");                 // {access_token, refresh_token, expires_at, user_id, email}
let db = leer("datos-v2");
if (!db) { db = { entrenos: leer("entrenos-v1") || {}, ejercicios: {}, series: {} }; }
let cursores = leer("cursores-v2") || {};       // última marca de servidor leída por tabla
let enEspera = leer("bloques-v1") || {};        // fecha -> ejercicios añadidos que aún no tienen series
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
const ejercicioVivo = id => { const e = db.ejercicios[id]; return e && !e.borrado ? e : null; };
const tipoDe = id => { const e = db.ejercicios[id]; return e && TIPOS[e.tipo] ? e.tipo : "fuerza"; };
const esDistancia = tipo => tipo === "carrera" || tipo === "natacion";
function adivinarTipo(nombre) {
  const n = norm(nombre);
  if (/(nad|natac|crol|braza|mariposa|piscina|estilos|patada|pull ?buoy)/.test(n)) return "natacion";
  if (/(carrera|correr|rodaje|tirada|sprint|series de|fartlek|cuesta|trote|running|\d+ ?m\b|\d+ ?km\b)/.test(n)) return "carrera";
  return "fuerza";
}
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
const seriesDe = id => seriesVivas().filter(s => s.ejercicio_id === id).sort(ordenSerie);
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
  return Object.values(db.ejercicios).filter(e => !e.borrado)
    .sort((a, b) => (ultimo[b.id] || "").localeCompare(ultimo[a.id] || "") || a.nombre.localeCompare(b.nombre, "es"));
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

// Guarda una edición en el dispositivo y la deja pendiente de subir
let timerSync;
function cambiar(tabla, fila) {
  fila.actualizado = new Date().toISOString();
  fila.sucio = true;
  db[tabla][fila[TABLAS[tabla].clave]] = fila;
  guardarLocal();
  setEstado("Guardado en el dispositivo");
  clearTimeout(timerSync);
  timerSync = setTimeout(sincronizar, 1000);
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
      // Subir lo pendiente (primero los ejercicios, luego sus series)
      for (const t of Object.keys(TABLAS)) {
        const pend = Object.values(db[t]).filter(v => v.sucio);
        if (!pend.length) continue;
        const filas = pend.map(v => { const f = { user_id: sesion.user_id }; TABLAS[t].campos.forEach(c => { f[c] = v[c] ?? (c === "tipo" ? "fuerza" : 0); }); return f; });
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

// ---------- Semana ----------
const dias = DIAS.map((_, i) => {
  const col = document.createElement("section");
  col.className = "dia";
  col.innerHTML = '<div class="dia-cab"><span class="dia-nombre"></span><span class="dia-fecha"></span>' +
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

function pintarSemana() {
  const lunes = lunesVista();
  const hoyIso = iso(new Date());
  $("rango").textContent = fmt(lunes) + " – " + fmt(sumarDias(lunes, 6));
  const n = desplazamiento, rel = $("relativa");
  rel.textContent = n === 0 ? "Esta semana" : n === -1 ? "Semana pasada" : n === 1 ? "Próxima semana"
                  : n < 0 ? "Hace " + -n + " semanas" : "Dentro de " + n + " semanas";
  rel.classList.toggle("actual", n === 0);
  $("hoyBtn").hidden = n === 0;
  dias.forEach(d => {
    const f = sumarDias(lunes, d.i);
    d.id = iso(f);
    d.fechaEl.textContent = fmt(f);
    d.col.classList.toggle("hoy", d.id === hoyIso);
    d.ed.innerHTML = "";
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

function pintarDia(dia) {
  const cont = dia.bloquesEl;
  cont.textContent = "";
  const delDia = seriesVivas().filter(s => s.fecha === dia.id).sort((a, b) => a.orden - b.orden);
  const ids = [];
  delDia.forEach(s => { if (!ids.includes(s.ejercicio_id)) ids.push(s.ejercicio_id); });
  (enEspera[dia.id] || []).forEach(id => { if (!ids.includes(id) && ejercicioVivo(id)) ids.push(id); });
  ids.forEach(id => cont.appendChild(bloque(dia, id, delDia.filter(s => s.ejercicio_id === id))));
}

function etiquetaTipo(tipo) {
  const t = document.createElement("span");
  t.className = "tipo-tag";
  t.textContent = TIPOS[tipo].nombre;
  return t;
}

function bloque(dia, id, series) {
  const ej = db.ejercicios[id], tipo = tipoDe(id), dist = esDistancia(tipo);
  const historia = seriesDe(id);
  const prs = prsDe(historia, tipo);
  const b = document.createElement("div");
  b.className = "bloque";
  b.dataset.ej = id;
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

  const ol = b.querySelector(".series");
  series.forEach((s, i) => {
    const li = document.createElement("li");
    li.innerHTML = '<span class="n"></span><span class="sv"><span class="sv-p"></span></span><button type="button" class="borrar">✕</button>';
    li.querySelector(".n").textContent = i + 1;
    li.querySelector(".sv-p").textContent = serieTexto(s);
    if (descTexto(s)) { const d = document.createElement("span"); d.className = "desc"; d.textContent = descTexto(s); li.querySelector(".sv").appendChild(d); }
    li.querySelector(".borrar").setAttribute("aria-label", "Borrar serie " + (i + 1));
    if (prs.has(s.id)) { const p = document.createElement("span"); p.className = "pr"; p.textContent = "PR"; p.title = "Récord personal"; li.querySelector(".sv").after(p); }
    li.querySelector(".borrar").addEventListener("click", () => { cambiar("series", { ...s, borrado: true }); pintarBloques(true); });
    ol.appendChild(li);
  });

  // Rellena con la última serie de este ejercicio para registrar rápido
  const fa = b.querySelector(".in-a"), fb = b.querySelector(".in-b"), fc = b.querySelector(".in-c");
  const ult = series[series.length - 1] || historia[historia.length - 1];
  if (ult) {
    if (dist) { fa.value = n0(ult.distancia) || ""; fb.value = n0(ult.tiempo) > 0 ? fmtTiempo(ult.tiempo) : ""; }
    else { fa.value = n0(ult.peso) > 0 ? num(ult.peso) : ""; fb.value = n0(ult.reps) || ""; }
    fc.value = n0(ult.descanso) > 0 ? fmtTiempo(ult.descanso) : "";
  }
  [fa, fb, fc].forEach((inp, k, todos) => {
    inp.addEventListener("focus", () => inp.select());
    if (k < 2) inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); todos[k + 1].focus(); } });
  });
  b.querySelector("form").addEventListener("submit", e => {
    e.preventDefault();
    const descanso = leerDescanso(fc.value);
    if (isNaN(descanso)) { fc.focus(); return; }
    const fila = { id: nuevoId(), fecha: dia.id, ejercicio_id: id, orden: Date.now(), peso: 0, reps: 0, distancia: 0, tiempo: 0, descanso, borrado: false };
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
    if (descanso > 0) iniciarCrono(descanso, ej.nombre);
    pintarBloques(true);
    const otra = dia.bloquesEl.querySelector('[data-ej="' + id + '"] .anadir');
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
    rec.innerHTML = '<p class="vacio-lista">Aún no hay series. Añádelas desde un día de la semana con «+ Ejercicio».</p>';
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

// ---------- Navegación ----------
function irA(n) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  desplazamiento = n;
  pintarSemana();
}
$("antBtn").addEventListener("click", () => irA(desplazamiento - 1));
$("sigBtn").addEventListener("click", () => irA(desplazamiento + 1));
$("hoyBtn").addEventListener("click", () => irA(0));

function verPestana(cual) {
  const ej = cual === "ejercicios";
  $("tabSemana").setAttribute("aria-selected", String(!ej));
  $("tabEjercicios").setAttribute("aria-selected", String(ej));
  $("vistaSemana").hidden = ej;
  $("vistaEjercicios").hidden = !ej;
  escribir("pestana-v1", cual);
  if (ej) pintarCatalogo(); else pintarSemana();
}
$("tabSemana").addEventListener("click", () => verPestana("semana"));
$("tabEjercicios").addEventListener("click", () => verPestana("ejercicios"));

function pintarTodo() {
  rellenar();
  pintarBloques(false);
  if (!$("vistaEjercicios").hidden) pintarCatalogo();
  if ($("detalle").open) refrescarDetalle();
}

// Sincronizar al abrir, al volver a la app, al recuperar conexión y cada 30 s
document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (!$("vistaSemana").hidden && !escribiendoSerie()) pintarSemana(); sincronizar(); } });
addEventListener("online", sincronizar);
setInterval(() => { if (!document.hidden) sincronizar(); }, 30000);

// ---------- Inicio de sesión ----------
let creando = false;
$("modoBtn").addEventListener("click", () => {
  creando = !creando;
  $("loginBtn").textContent = creando ? "Crear cuenta" : "Entrar";
  $("modoBtn").textContent = creando ? "Ya tengo cuenta" : "¿Primera vez? Crear cuenta";
  $("password").autocomplete = creando ? "new-password" : "current-password";
  $("loginTexto").textContent = creando
    ? "Elige tu email y una contraseña de al menos 6 caracteres. Con ellos entrarás en el iPhone y en el Mac."
    : "Entra con tu email y tu contraseña. Solo hace falta una vez en cada dispositivo.";
  $("loginError").textContent = "";
});
const traducir = m => /invalid login/i.test(m) ? "Email o contraseña incorrectos."
  : /already registered|already exists/i.test(m) ? "Ya existe una cuenta con ese email. Pulsa «Ya tengo cuenta» y entra."
  : /at least 6|password should/i.test(m) ? "La contraseña debe tener al menos 6 caracteres."
  : /signups not allowed|signup is disabled/i.test(m) ? "No se pueden crear cuentas nuevas. Entra con tu cuenta."
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
      db = { entrenos: {}, ejercicios: {}, series: {} }; cursores = {}; enEspera = {};
      guardarLocal(); guardarEspera(); escribir("entrenos-dueno", j.user.id);
    }
    guardarSesion(j);
    $("password").value = "";
    mostrarApp();
  } catch (err) {
    $("loginError").textContent = navigator.onLine === false ? "Necesitas conexión para entrar la primera vez." : err.message;
  } finally {
    $("loginBtn").disabled = false;
  }
});
function cerrarSesion(msg) {
  sesion = null; escribir("sesion-v1", null);
  $("app").hidden = true; $("login").hidden = false;
  $("loginError").textContent = msg || "";
}
$("salirBtn").addEventListener("click", () => {
  if (hayPendientes()) { setEstado("Hay cambios sin subir. Conéctate a internet antes de cerrar sesión.", true); return; }
  cerrarSesion("");
});
function mostrarApp() {
  $("login").hidden = true; $("app").hidden = false;
  verPestana(leer("pestana-v1") === "ejercicios" ? "ejercicios" : "semana");
  setEstado("Sincronizando…");
  sincronizar();
}

if (sesion) mostrarApp(); else $("login").hidden = false;

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
