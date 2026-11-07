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
  natacion: { nombre: "Natación", porMetros: 100, sufijo: "/100 m" },
  movilidad: { nombre: "Movilidad" }
};
// Ejercicios habituales que se proponen al buscar; al elegirlos se crean con su tipo
const SUGERIDOS = [
  ["Crol", "natacion"], ["Espalda", "natacion"], ["Braza", "natacion"], ["Mariposa", "natacion"], ["Estilos", "natacion"],
  ["Crol técnica", "natacion"], ["Patada crol con tabla", "natacion"], ["Patada espalda", "natacion"], ["Patada braza", "natacion"],
  ["Crol con pull buoy", "natacion"], ["Crol con palas", "natacion"], ["Remada (sculling)", "natacion"], ["Calentamiento natación", "natacion"], ["Vuelta a la calma natación", "natacion"],
  ["Series", "carrera"], ["Rodaje", "carrera"], ["Fartlek", "carrera"], ["Cuestas", "carrera"], ["Tirada larga", "carrera"], ["Trote de recuperación", "carrera"], ["Calentamiento carrera", "carrera"],
  ["Press banca", "fuerza"], ["Sentadilla", "fuerza"], ["Peso muerto", "fuerza"], ["Press militar", "fuerza"], ["Dominadas", "fuerza"], ["Remo con barra", "fuerza"], ["Hip thrust", "fuerza"], ["Zancadas", "fuerza"],
  ["Movilidad de cadera 90/90", "movilidad"], ["Gato-camello", "movilidad"], ["Rotaciones torácicas", "movilidad"], ["Estiramiento de isquios", "movilidad"],
  ["Estiramiento de cuádriceps", "movilidad"], ["Estiramiento de gemelo", "movilidad"], ["Movilidad de tobillo", "movilidad"], ["Movilidad de hombro con pica", "movilidad"],
  ["Paloma (pigeon)", "movilidad"], ["Foam roller", "movilidad"]
];
const $ = id => document.getElementById(id);

// ---------- Almacenamiento local (funciona sin conexión) ----------
// La beta (carpeta /beta/ en la misma web) comparte el navegador con la principal: guarda todo con su propio prefijo
const BETA = location.pathname.includes("/beta/"), PREFIJO = BETA ? "beta:" : "";
const VERSION_VISIBLE = "26";   // la versión que se ve en la app (fija); la interna es VERSION_APP
// La sesión es común a las pestañas de esta versión; los datos locales pertenecen
// a una cuenta concreta durante toda la vida de la página. Cambiar de cuenta recarga.
let errorAlmacenamiento = false;
const leerGeneral = k => { try { return JSON.parse(localStorage.getItem(PREFIJO + k)); } catch { return null; } };
const cuentaLocal = leerGeneral("sesion-v1")?.user_id || null;
const duenoAnterior = leerGeneral("entrenos-dueno");
const claveCuenta = k => PREFIJO + "cuenta:" + cuentaLocal + ":" + k;
const leer = k => {
  if (k === "sesion-v1" || k === "entrenos-dueno") return leerGeneral(k);
  if (!cuentaLocal) return null;
  try {
    const propia = localStorage.getItem(claveCuenta(k));
    if (propia !== null) return JSON.parse(propia);
    // Compatibilidad sin borrar la copia antigua: únicamente su dueño puede leerla.
    if (duenoAnterior === cuentaLocal) return leerGeneral(k);
  } catch { errorAlmacenamiento = true; }
  return null;
};
const escribir = (k, v) => {
  const global = k === "sesion-v1" || k === "entrenos-dueno";
  if (!global && !cuentaLocal) return false;
  try {
    // null se conserva en claves de cuenta para no resucitar un valor antiguo.
    if (global && v === null) localStorage.removeItem(PREFIJO + k);
    else localStorage.setItem(global ? PREFIJO + k : claveCuenta(k), JSON.stringify(v));
  } catch {
    errorAlmacenamiento = true;
    if (k === "sesion-v1") throw new Error("No se puede guardar la sesión en este dispositivo. Revisa el espacio disponible.");
    return false;
  }
  if (!global && CLAVES_EXTRA.has(k)) marcarExtra();
  return true;
};
// Datos de cada día que no son series (ejercicios añadidos aún sin series, entrenos y partes vacíos, su descripción,
// su letra y su posición): se guardan en el día (tabla entrenos, columna extra) para verlos igual en todos los dispositivos
const CLAVES_EXTRA = new Set(["bloques-vacios-v1", "bloques-v1", "sesiones-v1", "espera-grupo-v1", "partes-v1", "espera-parte-v1", "espera-nota-v1", "espera-letra-v1", "espera-antes-v1"]);
if (BETA) { document.documentElement.classList.add("beta"); document.title = "Fuerza y Ritmo β"; document.querySelector('meta[name="apple-mobile-web-app-title"]').content = "Fuerza y Ritmo β"; }

// Cada tabla se sincroniza por cuenta; los cambios locales en conflicto se conservan.
// El orden importa al subir: primero ejercicios y plantillas, después las series que los usan.
const TABLAS = {
  ejercicios: { clave: "id", conflicto: "id", campos: ["id", "user_id", "nombre", "tipo", "video_url", "notas", "rm", "compartido", "zonas", "borrado", "actualizado"] },
  personales: { clave: "ejercicio_id", conflicto: "user_id,ejercicio_id", campos: ["ejercicio_id", "rm", "medida", "lado", "actualizado"] },
  ciclos: { clave: "id", conflicto: "id", campos: ["id", "ejercicio_id", "numero", "rm_inicio", "peso_inicial", "incremento", "reps_reset", "importadas", "cerrado", "borrado", "actualizado"] },
  plantillas: { clave: "id", conflicto: "id", campos: ["id", "nombre", "items", "borrado", "actualizado"] },
  mesociclos: { clave: "id", conflicto: "id", campos: ["id", "nombre", "inicio", "semanas", "dias", "progresion", "descarga", "notas", "borrado", "actualizado"] },
  series: { clave: "id", conflicto: "id", campos: ["id", "fecha", "ejercicio_id", "orden", "peso", "reps", "distancia", "tiempo", "descanso", "hecha", "grupo", "meso_id", "bloque_id", "ronda", "rec_dist", "pct", "ciclo_id", "calentamiento", "desnivel_pos", "desnivel_neg", "ritmo_ajustado", "fc_media", "fc_max", "cadencia", "fc_pico", "fc_hist", "seccion", "por_lado", "nota", "letra_nueva", "max_tiempo", "max_reps", "copia", "rango_min", "rango_max", "borrado", "actualizado"] },
  entrenos: { clave: "fecha", conflicto: "user_id,fecha", campos: ["fecha", "html", "texto", "rpe", "sensacion", "extra", "actualizado"] },
  molestias: { clave: "id", conflicto: "id", campos: ["id", "zona", "descripcion", "inicio", "estado", "borrado", "actualizado"] },
  listas: { clave: "id", conflicto: "id", campos: ["id", "nombre", "items", "siguiente", "borrado", "actualizado"], opcional: true },
  carreras: { clave: "id", conflicto: "id", campos: ["id", "nombre", "fecha", "lugar", "distancia", "tiempo", "chip", "pos_general", "total_general", "categoria", "pos_categoria", "total_categoria", "desnivel_pos", "fc_media", "notas", "enlace", "previsto", "borrado", "actualizado"] }
};
const DEFECTOS = { medida: "", lado: false, extra: {}, seccion: "", por_lado: false, nota: "", letra_nueva: false, max_tiempo: false, max_reps: false, rango_min: 0, rango_max: 0, fecha: null, lugar: "", categoria: "", enlace: "", fc_hist: [], tipo: "fuerza", hecha: true, grupo: "", meso_id: "", bloque_id: "", ciclo_id: "", importadas: [], cerrado: false, compartido: false, items: [], dias: {}, descarga: {}, zonas: [], calentamiento: false, inicio: null, zona: "", descripcion: "", estado: "activa", nombre: "", video_url: "", notas: "", html: "", texto: "", sensacion: "", borrado: false };
let sesion = leer("sesion-v1");                 // {access_token, refresh_token, expires_at, user_id, email}
let perfil = leer("perfil-v1");                 // {aprobado, es_admin, email}
let usuarios = perfil?.es_admin && perfil?.aprobado ? (leer("usuarios-v1") || []) : [];        // solo para el administrador (se guarda para no verla vacía al abrir)
let db = leer("datos-v2") || { entrenos: leer("entrenos-v1") || {} };
Object.keys(TABLAS).forEach(t => { db[t] = Object.assign(Object.create(null), db[t] || {}); });
let cursores = leer("cursores-v4") || {};       // v4: primera lectura completa con paginación, sin borrar la copia local
let enEspera = leer("bloques-v1") || {};
// Entrenos del día aún sin series (fecha -> nombres) y en qué entreno va cada ejercicio añadido sin series (fecha|id -> nombre)
let gruposPlegados = {};   // los grupos y partes empiezan plegados en cada apertura
let carrerasPlegadas = leer("carrera-plegado-v1") || {};
let sesionesVacias = leer("sesiones-v1") || {}, esperaGrupo = leer("espera-grupo-v1") || {};
// Partes de cada entreno aún sin series (fecha|entreno -> nombres) y la parte de cada ejercicio añadido sin series (fecha|id -> parte)
let partesVacias = leer("partes-v1") || {}, esperaParte = leer("espera-parte-v1") || {};
// Bloques vacíos (aún sin ejercicios): «fecha|id» → { g: entreno, p: parte, r: rondas }. Se suben con el día como lo demás
let bloquesVacios = leer("bloques-vacios-v1") || {};
const guardarVacios = () => escribir("bloques-vacios-v1", bloquesVacios);
const guardarSesiones = () => { escribir("sesiones-v1", sesionesVacias); escribir("espera-grupo-v1", esperaGrupo); escribir("partes-v1", partesVacias); escribir("espera-parte-v1", esperaParte); };
// Nombres de las partes de un entreno: las que tienen series y las creadas vacías
const nombresPartes = (fecha, grupo) => [...new Set(seriesDelDia(fecha).filter(s => (s.grupo || "") === grupo).map(s => s.seccion || "").concat(partesVacias[fecha + "|" + grupo] || []))];        // fecha -> ejercicios añadidos que aún no tienen series
let porta = leer("portapapeles-v1");            // lo último copiado: {nombre, html, items}
const guardarLocal = () => { escribir("datos-v2", db); escribir("cursores-v4", cursores); };
const guardarEspera = () => escribir("bloques-v1", enEspera);

const estado = $("estado");
const setEstado = (t, err) => { estado.textContent = errorAlmacenamiento ? "No se ha podido guardar todo en este dispositivo. Exporta una copia desde Ajustes antes de cerrarlo." : t; estado.classList.toggle("error", !!err || errorAlmacenamiento); };

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
// Unidad de distancia (Plan → Ajustes): automática (km desde 3 km), siempre metros o siempre km
let UNIDAD = (leer("ajustes-v1") || {}).unidad || "auto";
const enKm = () => UNIDAD === "km";
const fmtDist = m => UNIDAD === "km" || (UNIDAD !== "m" && n0(m) >= 3000) ? num(Math.round(n0(m) / 10) / 100) + " km" : num(n0(m)) + " m";
// Leer una distancia escrita: «5 km», «400 m» o solo el número en la unidad elegida
function leerDist(txt) {
  const t = norm(String(txt || "")).replace(",", "."), n = parseFloat(t);
  if (!(n > 0)) return 0;
  if (/km/.test(t)) return Math.round(n * 1000);
  if (/m\b|metro/.test(t)) return Math.round(n);
  return Math.round(enKm() ? n * 1000 : n);
}
const distCampo = m => n0(m) > 0 ? (enKm() ? num(n0(m) / 1000) : String(n0(m))) : "";   // valor para rellenar un campo
const UD = () => enKm() ? "km" : "metros";
const fmtSegs = seg => n0(seg) > 0 && n0(seg) < 60 ? n0(seg) + " s" : fmtDuracion(seg);
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
// Movilidad: un número solo son segundos («45»), «2 min» son minutos y «1:30» minutos y segundos
function leerSegs(txt) {
  const t = (txt || "").trim().toLowerCase();
  if (!t) return 0;
  let m = t.match(/^(\d+(?:[.,]\d+)?)\s*(s|seg|segundos?)?$/);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")));
  m = t.match(/^(\d+(?:[.,]\d+)?)\s*(m|min|minutos?)$/);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 60);
  return leerTiempo(t);
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
// Recuperación: tiempo, distancia, o ambas (p. ej. «300 m · 1:30» de una carrera importada)
function leerRecuperacion(txt) {
  const t = (txt || "").trim();
  const partes = t.split(/\s*(?:·|\+)\s*/).filter(Boolean);
  if (partes.length === 2) {
    let distancia = null, tiempo = null;
    for (const parte of partes) {
      const md = parte.match(/^(\d+(?:[.,]\d+)?)\s*m(?:etros?)?$/i);
      if (md && distancia === null) distancia = parseFloat(md[1].replace(",", "."));
      else if (!md && tiempo === null) tiempo = leerDescanso(parte);
      else return null;
    }
    return distancia > 0 && tiempo > 0 && !isNaN(tiempo) ? { descanso: tiempo, rec_dist: distancia } : null;
  }
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*m(?:etros?)?$/i);
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
  tpl.innerHTML = String(html || "");
  const salida = document.createElement("div");
  (function copiar(origen, destino) {
    origen.childNodes.forEach(n => {
      if (n.nodeType === 3) { destino.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"].includes(tag)) return;
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
const aTexto = html => { const t = document.createElement("div"); t.innerHTML = limpiar(String(html || "")).replace(/<br>/g, "\n").replace(/<div>/g, "\n"); return t.textContent.replace(/^\n/, ""); };
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
  if (/(movilidad|estiramiento|estirar|stretch|yoga|foam|rulo|apertura de cadera|gato.?camello|rotaciones? de|circunduccion|pigeon|paloma|cobra|90.?90|world.?s greatest)/.test(n)) return "movilidad";
  if (/(^|\s)(nad|natac|crol|braza|mariposa|piscina|estilos|patada|pull ?buoy)/.test(n)) return "natacion";   // al principio de palabra: «inclinado» no es natación
  if (/(carrera|correr|rodaje|tirada|sprint|series de|fartlek|cuesta|trote|running|\d+ ?m\b|\d+ ?km\b)/.test(n) || /^\d+$/.test(n)) return "carrera";
  return "fuerza";
}
const hecha = s => s.hecha !== false;
// Serie «al máximo» sin apuntar todavía (máx reps o máx tiempo): al hacerla hay que escribir lo que salió
const esMaxSinDato = s => !s.ciclo_id && !(n0(s.reps) > 0) && !(n0(s.tiempo) > 0) && !(n0(s.distancia) > 0);
// Ventana de repeticiones («10-12», «20-25»; en el móvil también «10,12»): se planifica así y al hacerla se apuntan las que salieron
function leerRango(txt) {
  const m = String(txt || "").trim().match(/^(\d{1,3})\s*(?:-|–|—|a|\/|,|\.|\s)\s*(\d{1,3})\s*(?:reps?)?$/i);
  if (!m) return null;
  const a = +m[1], b = +m[2];
  return a > 0 && b > a ? { min: a, max: b } : null;
}
const esRango = s => n0(s.rango_max) > n0(s.rango_min) && n0(s.rango_min) > 0;
const rangoTxt = s => n0(s.rango_min) + "-" + n0(s.rango_max);
// Series que piden un dato al marcarlas: «máx» sin registrar o ventana de reps pendiente
const pideDato = s => esMaxSinDato(s) || (esRango(s) && !s.hecha);   // las series planificadas tienen hecha = false
const rm = s => n0(s.reps) <= 1 ? n0(s.peso) : n0(s.peso) * (1 + n0(s.reps) / 30);    // 1RM estimado (Epley)
const redondear = kg => Math.round(kg / 2.5) * 2.5;
// 1RM de referencia: el que pongas en la ficha o, si no, el mejor estimado de tus series
// El 1RM es personal: los ejercicios del catálogo común son de todos, pero cada uno tiene el suyo
// Cómo se mide el progreso de un ejercicio de fuerza: por el peso (1RM), por las repeticiones máximas (dominadas, fondos…)
// o por el tiempo máximo (plancha, false grip…). Automático por el nombre y lo que apuntas; se puede cambiar en la ficha
const MEDIDAS = { peso: "Peso (1RM)", reps: "Repeticiones máximas", tiempo: "Tiempo (isométrico)" };
function medidaAuto(id) {
  const n = norm(nombreEj(id));
  if (/lastrad|con peso|con disco|con mancuerna|con kettle|con chaleco|\+\s?\d+\s?kg/.test(n)) return "peso";
  if (/plancha|plank|hollow|l.?sit|lever|false grip|colgad|dead ?hang|isometr|wall ?sit|sentadilla en pared|aguant|superman hold|arch hold|bandera|handstand|pino/.test(n)) return "tiempo";
  if (/dominad|chin.?up|pull.?up|fondos|dips|flexion|push.?up|muscle.?up|burpee|pistol|nordic|australian|remo invertido|toes to bar|elevaciones de piernas|abdominal|crunch/.test(n)) return "reps";
  const h = seriesDe(id).filter(x => !x.calentamiento);
  if (h.length >= 3 && h.filter(x => n0(x.peso) > 0).length < h.length / 3) return h.filter(x => n0(x.tiempo) > 0 && !(n0(x.reps) > 0)).length > h.length / 2 ? "tiempo" : "reps";
  return "peso";
}
// «Por lado» se elige una vez en la ficha (zancadas, plancha lateral…) y se aplica solo a todas sus series
const ladoDe = id => !!(db.personales[id] || {}).lado;
const medidaDe = id => MEDIDAS[(db.personales[id] || {}).medida] ? db.personales[id].medida : medidaAuto(id);
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
// ---------- Desnivel de las carreras importadas: ritmo ajustado por pendiente (coste energético de Minetti et al., 2002) ----------
const costeMinetti = i => { const g = Math.max(-0.45, Math.min(0.45, i)); return 155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6; };
const factorPendiente = i => costeMinetti(i) / 3.6;   // cuánto «cuesta» un metro con esa pendiente frente a uno en llano
// Sin perfil punto a punto (CSV): la subida y la bajada de la vuelta, repartidas con la misma pendiente
function factorVuelta(d, sube, baja) {
  if (!(d > 0) || !(sube + baja > 0)) return 1;
  const g = (sube + baja) / d;
  return sube / (sube + baja) * factorPendiente(g) + baja / (sube + baja) * factorPendiente(-g);
}
// Con perfil (GPX/TCX): altitud suavizada con media móvil de 5 puntos (quita el ruido del GPS o del barómetro) y tramos de al menos 20 m
function perfilDesnivel(puntos) {
  const p = puntos.filter(x => isFinite(x.ele) && isFinite(x.d));
  if (p.length < 3) return null;
  const el = p.map((x, i) => { const v = p.slice(Math.max(0, i - 2), i + 3); return v.reduce((a, y) => a + y.ele, 0) / v.length; });
  let sube = 0, baja = 0, eq = 0, i0 = 0;
  for (let i = 1; i < p.length; i++) {
    const dd = p[i].d - p[i0].d;
    if (dd < 20 && i < p.length - 1) continue;
    if (dd > 0) { const dh = el[i] - el[i0]; if (dh > 0) sube += dh; else baja -= dh; eq += dd * factorPendiente(dh / dd); }
    i0 = i;
  }
  const total = p[p.length - 1].d - p[0].d;
  return total > 0 ? { subida: sube, bajada: baja, factor: eq / total } : null;
}
// Tiempo «en llano» de una serie importada con altitud (si no tiene, el real): es el que usan la forma, las marcas y los objetivos
const tiempoLlano = s => n0(s.ritmo_ajustado) > 0 && n0(s.distancia) > 0 ? n0(s.ritmo_ajustado) * n0(s.distancia) / 1000 : n0(s.tiempo);
const conDesnivel = s => n0(s.distancia) > 0 && (n0(s.desnivel_pos) + n0(s.desnivel_neg)) / n0(s.distancia) > 0.04;   // pendiente media > 4 %
const fueraDeMarcas = s => conDesnivel(s) && ajustes().desnivelMarcas !== "contar";
// ---------- Pulsaciones (archivos FIT y TCX) ----------
// Pico mantenido (media de 10 s) e histograma (segundos en cada tramo de 5 ppm desde 70) de un tramo de puntos {t, fc};
// se descartan valores imposibles, saltos bruscos (artefactos del pulsómetro) y, para el pico, los 3 primeros minutos
function analizarPulso(puntos, t0) {
  const p = puntos.filter(x => x.fc >= 50 && x.fc <= 225 && isFinite(x.t)).sort((a, b) => a.t - b.t);
  const ok = p.filter((x, i) => i === 0 || Math.abs(x.fc - p[i - 1].fc) <= 25 * Math.max(1, x.t - p[i - 1].t));
  if (ok.length < 3) return null;
  const hist = new Array(32).fill(0);
  let pico = 0, j = 0, suma = 0;
  for (let i = 0; i < ok.length; i++) {
    const dt = i + 1 < ok.length ? Math.min(10, ok[i + 1].t - ok[i].t) : 1;
    hist[Math.max(0, Math.min(31, Math.floor((ok[i].fc - 70) / 5)))] += dt;
    suma += ok[i].fc;
    while (ok[i].t - ok[j].t > 10) { suma -= ok[j].fc; j++; }
    if (ok[i].t - t0 >= 180 && i - j >= 2) pico = Math.max(pico, suma / (i - j + 1));
  }
  return { fcPico: Math.round(pico), fcHist: hist.map(Math.round) };
}
const sumaHist = lista => lista.reduce((h, x) => { (x || []).forEach((v, k) => { h[k] = (h[k] || 0) + n0(v); }); return h; }, []);
// FC máxima: la puesta a mano; si no, el mayor pico mantenido de los últimos 6 meses (o la máxima registrada); si no, la edad (Tanaka)
function infoFcMax() {
  const a = ajustes();
  const ix = indiceSeries();
  if (ix.fcInfo === undefined) {
    const desde = iso(sumarDias(new Date(), -183)), mayor = campo => ix.vivas.reduce((m, s) => s.fecha >= desde && n0(s[campo]) > (m ? n0(m[campo]) : 0) ? s : m, null);
    const conPico = mayor("fc_pico"), mejor = conPico || mayor("fc_max");
    ix.fcInfo = mejor ? { valor: conPico ? n0(mejor.fc_pico) : n0(mejor.fc_max), fuente: (conPico ? "pico mantenido" : "máxima registrada") + " · " + nombreEj(mejor.ejercicio_id) + " del " + fechaCorta(mejor.fecha), fecha: mejor.fecha, medida: true } : null;
  }
  // Cómo se calcula (Plan → Ajustes): automática (tus archivos; si no hay, la edad), por la edad o puesta a mano
  const modo = a.fcModo || (n0(a.fcMax) > 0 ? "manual" : "auto"), porEdad = n0(a.edad) > 0 ? { valor: Math.round(208 - 0.7 * n0(a.edad)), fuente: "por tu edad (Tanaka: 208 − 0,7 × " + n0(a.edad) + ")" } : null;
  const superada = (lim) => ix.fcInfo && ix.fcInfo.valor > lim ? ix.fcInfo : null;
  if (modo === "manual" && n0(a.fcMax) > 0) return { valor: n0(a.fcMax), fuente: "puesta a mano", superada: superada(n0(a.fcMax)) };
  if (modo === "edad" && porEdad) return { ...porEdad, superada: superada(porEdad.valor) };
  if (ix.fcInfo) return ix.fcInfo;
  return porEdad ? { ...porEdad, fuente: porEdad.fuente + ", provisional hasta que importes un archivo con pulso" } : null;
}
// Lo que daría cada forma de calcularla, para compararlas en Ajustes
function opcionesFcMax() {
  const a = ajustes(), ix = indiceSeries();
  infoFcMax();
  return { auto: ix.fcInfo, edad: n0(a.edad) > 0 ? Math.round(208 - 0.7 * n0(a.edad)) : 0, manual: n0(a.fcMax) };
}
const fcMaxima = () => (infoFcMax() || {}).valor || 0;
// Zonas Z1–Z5: % de la FC máxima o, con FC en reposo, de la reserva (Karvonen)
const NOMBRES_ZONA = ["Z1 recuperación", "Z2 aeróbica", "Z3 tempo", "Z4 umbral", "Z5 máxima"];
function limitesZonas() {
  const max = fcMaxima(), rep = n0(ajustes().fcReposo);
  if (!max) return null;
  return [0.5, 0.6, 0.7, 0.8, 0.9].map(f => Math.round(rep > 0 && rep < max ? rep + f * (max - rep) : f * max));
}
function tiempoZonas(hist) {
  const lim = limitesZonas();
  if (!lim || !hist || !hist.some(v => n0(v) > 0)) return null;
  const z = [0, 0, 0, 0, 0];
  hist.forEach((seg, k) => { const fc = 72.5 + k * 5; let i = 0; lim.forEach((l, n) => { if (fc >= l) i = n; }); z[i] += n0(seg); });
  return z;
}
function barraZonas(z) {
  const total = z.reduce((a, b) => a + b, 0), caja = document.createElement("div");
  caja.className = "zonas-fc";
  const barra = document.createElement("div");
  barra.className = "zf-barra";
  z.forEach((seg, i) => { if (!seg) return; const b = document.createElement("span"); b.className = "zf-" + (i + 1); b.style.width = (seg / total * 100) + "%"; b.title = NOMBRES_ZONA[i] + ": " + fmtTiempo(seg); barra.appendChild(b); });
  const t = document.createElement("span");
  t.className = "zf-texto";
  t.textContent = z.map((seg, i) => seg >= 30 ? "Z" + (i + 1) + " " + fmtTiempo(Math.round(seg)) : "").filter(Boolean).join(" · ");
  caja.append(barra, t);
  return caja;
}
const textoPulso = s => [n0(s.fc_media) > 0 ? "♥ " + n0(s.fc_media) + (n0(s.fc_max) > 0 ? " (máx " + n0(s.fc_max) + ")" : "") + " ppm" : "", n0(s.cadencia) > 0 ? n0(s.cadencia) + " pasos/min" : ""].filter(Boolean).join(" · ");
const textoDesnivel = s => n0(s.desnivel_pos) + n0(s.desnivel_neg) > 0 ? "+" + Math.round(n0(s.desnivel_pos)) + " m / −" + Math.round(n0(s.desnivel_neg)) + " m" + (conDesnivel(s) ? " · con desnivel" : "") : "";
// Bilbo planificado: el peso sale del ciclo activo; %RM planificado: los kg salen del 1RM de referencia
const pesoMostrado = s => !hecha(s) && s.ciclo_id === "auto" ? pesoBilbo(s.ejercicio_id)
  : !hecha(s) && n0(s.pct) > 0 ? kgDePct(s.ejercicio_id, s.pct) || n0(s.peso) : n0(s.peso);
function serieTexto(s) {
  const tipo = tipoDe(s.ejercicio_id);
  if (esDistancia(tipo)) {
    // Por tiempo (sin metros): solo la duración, p. ej. «40 min»
    if (!(n0(s.distancia) > 0)) return n0(s.tiempo) > 0 ? fmtDuracion(s.tiempo) : "—";
    return fmtDist(s.distancia) + (n0(s.tiempo) > 0 ? " · " + fmtTiempo(s.tiempo) + " · " + ritmo(s, tipo) + (n0(s.ritmo_ajustado) > 0 ? " (aj. " + fmtTiempo(s.ritmo_ajustado) + "/km)" : "") : "");
  }
  if (tipo === "movilidad") {
    const partes = [n0(s.reps) > 0 ? n0(s.reps) + " reps" : "", n0(s.tiempo) > 0 ? fmtSegs(s.tiempo) : ""].filter(Boolean);
    return (partes.join(" · ") || "—") + (s.por_lado ? " por lado" : "");
  }
  const lado = s.por_lado ? " por lado" : "";
  const kg = pesoMostrado(s), reps = n0(s.reps) > 0 ? n0(s.reps) : "máx";
  // Como en una hoja: primero las repeticiones (o el tiempo) y el peso detrás, entre paréntesis: «10 reps (100 kg)»
  const peso = kg > 0 || n0(s.pct) > 0 ? " (" + (n0(s.pct) > 0 ? num(s.pct) + " %" + (kg > 0 ? " · " : "") : "") + (kg > 0 ? num(kg) + " kg" : "") + ")" : "";
  // Series «al máximo»: la marca se queda y, al registrarla, lo que salió va entre paréntesis: «máx reps (14 · 10 kg)»
  const kgTxt = kg > 0 ? " · " + num(kg) + " kg" : "";
  if (s.max_tiempo) return "máx tiempo" + lado + (n0(s.tiempo) > 0 ? " (" + fmtSegs(s.tiempo) + kgTxt + ")" : peso);
  if (s.max_reps || (!s.ciclo_id && !(n0(s.reps) > 0) && !(n0(s.tiempo) > 0))) return "máx reps" + lado + (n0(s.reps) > 0 ? " (" + n0(s.reps) + kgTxt + ")" : peso);
  if (n0(s.tiempo) > 0 && !(n0(s.reps) > 0)) return fmtSegs(s.tiempo) + lado + peso;   // por tiempo: bici, plancha, isométricos…
  if (esRango(s)) return hecha(s) ? reps + " reps" + lado + peso.replace(/^ \(/, " (de " + rangoTxt(s) + " · ").replace(/^$/, " (de " + rangoTxt(s) + ")") : rangoTxt(s) + " reps" + lado + peso;
  return (s.ciclo_id ? "Bilbo · " : "") + (reps === "máx" ? "máx reps" : reps + " reps") + lado + peso;
}
const descTexto = s => n0(s.rec_dist) > 0 && n0(s.descanso) > 0 ? "rec. " + fmtDist(s.rec_dist) + " · " + fmtTiempo(s.descanso) : n0(s.rec_dist) > 0 ? "rec. " + fmtDist(s.rec_dist) : n0(s.descanso) > 0 ? "desc. " + fmtTiempo(s.descanso) : "";
const recTexto = s => n0(s.rec_dist) > 0 && n0(s.descanso) > 0 ? num(s.rec_dist) + " m · " + fmtTiempo(s.descanso) : n0(s.rec_dist) > 0 ? num(s.rec_dist) + " m" : n0(s.descanso) > 0 ? fmtTiempo(s.descanso) : "";
const ordenSerie = (a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.orden - b.orden;
// Índice de las series vivas, por día y por ejercicio: se rehace solo cuando cambian los datos (versionDatos).
// Quien lo usa recibe copias, así puede ordenar o filtrar sin estropear el índice.
let indice = { v: -1 };
function indiceSeries() {
  if (indice.v === versionDatos) return indice;
  const vivas = Object.values(db.series).filter(s => !s.borrado && ejercicioVivo(s.ejercicio_id)), porFecha = {}, porEj = {};
  vivas.forEach(s => {
    (porFecha[s.fecha] = porFecha[s.fecha] || []).push(s);
    if (hecha(s) && !s.calentamiento) (porEj[s.ejercicio_id] = porEj[s.ejercicio_id] || []).push(s);
  });
  Object.values(porFecha).forEach(l => l.sort((a, b) => a.orden - b.orden));
  Object.values(porEj).forEach(l => l.sort(ordenSerie));
  return (indice = { v: versionDatos, vivas, porFecha, porEj, prs: {} });
}
const seriesVivas = () => indiceSeries().vivas.slice();
const seriesDe = id => (indiceSeries().porEj[id] || []).slice();   // solo lo hecho (sin calentamiento) cuenta para récords
// Récords de un ejercicio, calculados una vez por versión de los datos
const prsEj = id => { const ix = indiceSeries(); return ix.prs[id] || (ix.prs[id] = prsDe(ix.porEj[id] || [], tipoDe(id), tipoDe(id) === "fuerza" ? medidaDe(id) : "")); };
// PR: más peso (o más reps sin peso) en fuerza; menos tiempo para la misma distancia en carrera y natación
function prsDe(lista, tipo, medida) {
  const prs = new Set();
  if (tipo === "movilidad") return prs;
  // Peso corporal: récord = más repeticiones (o más tiempo aguantado), sin mirar el lastre
  if (medida === "reps" || medida === "tiempo") {
    const campo = medida === "reps" ? "reps" : "tiempo";
    let max = null;
    lista.filter(s => hecha(s) && !s.calentamiento).forEach(s => { const v = n0(s[campo]); if (!(v > 0)) return; if (max !== null && v > max) prs.add(s.id); max = Math.max(max ?? 0, v); });
    return prs;
  }
  if (esDistancia(tipo)) {
    const mejor = {};
    lista.filter(s => conMarca(s) && !fueraDeMarcas(s)).forEach(s => {
      const d = n0(s.distancia), t = tiempoLlano(s);
      if (mejor[d] !== undefined && t < mejor[d]) prs.add(s.id);
      mejor[d] = Math.min(mejor[d] ?? Infinity, t);
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
// Para elegir ejercicio: del más usado al menos (en cuántos días lo has hecho o planificado); a igualdad, el más reciente
function usoEjercicios() {
  const dias = {}, ultimo = {};
  seriesVivas().forEach(s => { (dias[s.ejercicio_id] = dias[s.ejercicio_id] || new Set()).add(s.fecha); if (!ultimo[s.ejercicio_id] || s.fecha > ultimo[s.ejercicio_id]) ultimo[s.ejercicio_id] = s.fecha; });
  const n = id => dias[id] ? dias[id].size : 0;
  return { n, lista: vivos("ejercicios").sort((a, b) => n(b.id) - n(a.id) || (ultimo[b.id] || "").localeCompare(ultimo[a.id] || "") || a.nombre.localeCompare(b.nombre, "es")) };
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
  if (tipo === "movilidad") {
    st.tiempoTotal = lista.reduce((a, s) => a + n0(s.tiempo) * (s.por_lado ? 2 : 1), 0);
    st.resumen = st.sesiones.length + (st.sesiones.length === 1 ? " sesión" : " sesiones") + (st.tiempoTotal > 0 ? " · " + fmtSegs(st.tiempoTotal) + " en total" : "");
    return st;
  }
  const med = tipo === "fuerza" && lista[0] ? medidaDe(lista[0].ejercicio_id) : "peso";
  if (med === "reps" || med === "tiempo") {
    const campo = med === "reps" ? "reps" : "tiempo", m = Math.max.apply(null, lista.map(x => n0(x[campo])).concat(0));
    st.medida = med;
    st.mejorReps = lista.reduce((a, x) => n0(x[campo]) > n0(a[campo]) ? x : a, lista[0]);
    st.resumen = m > 0 ? "Récord: " + (med === "reps" ? m + " reps" : fmtSegs(m)) : st.sesiones.length + (st.sesiones.length === 1 ? " sesión" : " sesiones");
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
class SesionCaducada extends Error {}
class SesionCambiada extends Error {}
let generacionSesion = 0, renovacionSesion = null;
const peticionesSesion = new Set();
const contextoSesion = () => ({ usuario: sesion?.user_id, generacion: generacionSesion });
function comprobarSesion(ctx) {
  const guardada = leerGeneral("sesion-v1");
  if (!ctx.usuario || ctx.generacion !== generacionSesion || sesion?.user_id !== ctx.usuario || guardada?.user_id !== ctx.usuario) throw new SesionCambiada();
}
function invalidarPeticiones() {
  generacionSesion++;
  for (const c of peticionesSesion) c.abort();
  peticionesSesion.clear();
  renovacionSesion = null;
}
function guardarSesion(j) {
  if (!j?.user?.id || !j.access_token || !j.refresh_token) throw new Error("La respuesta de acceso no contiene una sesión válida.");
  const nueva = {
    access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    user_id: j.user.id, email: j.user.email
  };
  escribir("sesion-v1", nueva);
  sesion = nueva;
}
async function peticionDeCuenta(url, opciones, ctx) {
  comprobarSesion(ctx);
  const controller = new AbortController();
  peticionesSesion.add(controller);
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const r = await fetch(url, { ...opciones, signal: controller.signal });
    // Termina de leer antes de liberar el control de cuenta y el tiempo límite.
    const contenido = await r.arrayBuffer();
    comprobarSesion(ctx);
    const respuesta = new Response(r.status === 204 || r.status === 205 || r.status === 304 ? null : contenido, { status: r.status, statusText: r.statusText, headers: r.headers });
    const proteger = res => {
      for (const metodo of ["json", "text"]) {
        const leerCuerpo = res[metodo].bind(res);
        res[metodo] = async () => { comprobarSesion(ctx); const valor = await leerCuerpo(); comprobarSesion(ctx); return valor; };
      }
      const clonar = res.clone.bind(res);
      res.clone = () => proteger(clonar());
      return res;
    };
    return proteger(respuesta);
  } catch (err) {
    comprobarSesion(ctx);
    throw err;
  } finally { clearTimeout(timer); peticionesSesion.delete(controller); }
}
async function refrescar(forzar = false) {
  const ctx = contextoSesion();
  comprobarSesion(ctx);
  if (renovacionSesion?.generacion === ctx.generacion) return renovacionSesion.promesa;
  const tokenInicial = sesion.access_token;
  const renovar = async () => {
    comprobarSesion(ctx);
    const guardada = leerGeneral("sesion-v1");
    if (!guardada?.refresh_token) throw new SesionCaducada();
    // Otra pestaña puede haber renovado mientras esperábamos el bloqueo.
    if (guardada.expires_at * 1000 > Date.now() + 60000 && (!forzar || guardada.access_token !== tokenInicial)) { sesion = guardada; return; }
    const r = await peticionDeCuenta(SUPA + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST", headers: { apikey: CLAVE, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: guardada.refresh_token })
    }, ctx);
    if (r.status === 400 || r.status === 401) {
      const reciente = leerGeneral("sesion-v1");
      if (reciente?.user_id === ctx.usuario && reciente.refresh_token !== guardada.refresh_token) { sesion = reciente; return; }
      throw new SesionCaducada();
    }
    if (!r.ok) throw new Error("refresh " + r.status);
    const j = await r.json();
    comprobarSesion(ctx);
    if (j.user?.id !== ctx.usuario) throw new SesionCambiada();
    guardarSesion(j);
  };
  const promesa = navigator.locks?.request
    ? navigator.locks.request("fyr-auth:" + PREFIJO + ctx.usuario, renovar)
    : renovar();
  const pendiente = { generacion: ctx.generacion, promesa };
  renovacionSesion = pendiente;
  try { await promesa; }
  finally { if (renovacionSesion === pendiente) renovacionSesion = null; }
}
async function api(ruta, opciones = {}, reintento = false) {
  const ctx = contextoSesion();
  comprobarSesion(ctx);
  if (sesion.expires_at * 1000 - 60000 < Date.now()) await refrescar();
  comprobarSesion(ctx);
  const r = await peticionDeCuenta(SUPA + ruta, {
    ...opciones,
    headers: { ...(opciones.headers || {}), apikey: CLAVE, Authorization: "Bearer " + sesion.access_token, "Content-Type": "application/json" }
  }, ctx);
  if (r.status === 401 && !reintento) { await refrescar(true); comprobarSesion(ctx); return api(ruta, opciones, true); }
  return r;
}
// Aislamiento adicional en el cliente; la autorización sigue siendo responsabilidad de RLS.
function filtroPropietario(tabla) {
  const uid = encodeURIComponent(sesion.user_id);
  return tabla === "ejercicios" ? "&and=(or(user_id.eq." + uid + ",compartido.eq.true))" : "&user_id=eq." + uid;
}
async function leerTablaCompleta(tabla, desde = "") {
  const campos = [...new Set([...TABLAS[tabla].campos, "user_id", "servidor_ts"])];
  const orden = "servidor_ts.asc," + TABLAS[tabla].clave + ".asc";
  const ruta = "/rest/v1/" + tabla + "?select=" + campos.join(",") + "&order=" + orden + filtroPropietario(tabla) + desde;
  const filas = [], tamano = 500;
  let siguiente = "", ultimaClave = "";
  const literal = v => '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  // Avanza por fecha de servidor + clave, sin saltarse filas cuando llegan cambios.
  // Una página corta tampoco implica final: puede haber un límite menor en Supabase.
  for (;;) {
    const r = await api(ruta + siguiente + "&limit=" + tamano);
    if (!r.ok) return { respuesta: r, filas: [] };
    const pagina = await r.json();
    if (!Array.isArray(pagina)) throw new Error("Respuesta de sincronización no válida");
    if (!pagina.length) return { respuesta: r, filas };
    for (const f of pagina) {
      if (f.user_id !== sesion.user_id && !(tabla === "ejercicios" && f.compartido)) throw new Error("Datos ajenos rechazados");
    }
    filas.push(...pagina);
    const ultima = pagina[pagina.length - 1], campo = TABLAS[tabla].clave;
    const firma = JSON.stringify([ultima.servidor_ts, ultima[campo]]);
    if (!ultima.servidor_ts || ultima[campo] == null || firma === ultimaClave) throw new Error("La descarga no ha podido avanzar; se reintentará sin perder el progreso.");
    ultimaClave = firma;
    const ts = literal(ultima.servidor_ts), clave = literal(ultima[campo]);
    siguiente = "&or=" + encodeURIComponent("(servidor_ts.gt." + ts + ",and(servidor_ts.eq." + ts + "," + campo + ".gt." + clave + "))");
  }
}

// Perfil: las cuentas nuevas quedan pendientes hasta que el administrador las aprueba
async function cargarPerfil() {
  const campos = "user_id,email,aprobado,es_admin,edita_catalogo,creado,novedades_vistas,ultimo_acceso,ultimo_dispositivo,ultima_version";
  const r = await api("/rest/v1/perfiles?select=" + campos + "&user_id=eq." + encodeURIComponent(sesion.user_id) + "&limit=1");
  if (!r.ok) throw new Error("perfil " + r.status);
  const lista = await r.json(), mio = Array.isArray(lista) && lista.find(p => p.user_id === sesion.user_id);
  perfil = mio ? { aprobado: mio.aprobado, es_admin: mio.es_admin, edita_catalogo: mio.edita_catalogo, email: mio.email, novedades_vistas: mio.novedades_vistas || "" } : { aprobado: false, es_admin: false, edita_catalogo: false, email: sesion.email };
  usuarios = [];
  if (perfil.aprobado && perfil.es_admin) {
    let ultimo = "";
    for (;;) {
      const rr = await api("/rest/v1/perfiles?select=" + campos + "&order=user_id.asc&limit=500" + (ultimo ? "&user_id=gt." + encodeURIComponent(ultimo) : ""));
      if (!rr.ok) throw new Error("No se pudo cargar la lista de usuarios (" + rr.status + ").");
      const pagina = await rr.json();
      if (!Array.isArray(pagina)) throw new Error("Lista de usuarios no válida");
      if (!pagina.length) break;
      const siguiente = pagina[pagina.length - 1].user_id;
      if (!siguiente || siguiente === ultimo) throw new Error("La lista de usuarios no pudo avanzar.");
      usuarios.push(...pagina); ultimo = siguiente;
    }
  }
  escribir("usuarios-v1", usuarios);
  escribir("perfil-v1", perfil);
  if (perfil.es_admin && !$("vistaPlan").hidden) pintarPlan();
  avisoUsuarios();
  pintarAvisoNovedades();
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
// Historial para deshacer y rehacer (Ctrl/Cmd+Z, Ctrl/Cmd+Mayús+Z o Ctrl+Y): cada acción del usuario es un paso con
// cómo estaban antes las filas que tocó. Solo cuenta lo que pasa justo después de tocar o teclear (no la sincronización)
let historial = [], rehechos = [], pasoHist = null, sinHistorial = false, ultimoGesto = 0;
["pointerdown", "keydown", "input", "change", "submit"].forEach(t => addEventListener(t, () => { ultimoGesto = Date.now(); }, true));
function claveDatoValida(clave) {
  return typeof clave === "string" && clave.length > 0 && !["__proto__", "constructor", "prototype"].includes(clave);
}
function cambiar(tabla, fila, enLote) {
  if (!Object.prototype.hasOwnProperty.call(TABLAS, tabla) || !claveDatoValida(fila?.[TABLAS[tabla].clave])) throw new Error("El registro no tiene un identificador válido.");
  if (!sinHistorial && Date.now() - ultimoGesto < 3000) {
    const k = fila[TABLAS[tabla].clave], antes = db[tabla][k];
    if (!pasoHist) { pasoHist = []; historial.push(pasoHist); if (historial.length > 80) historial.shift(); rehechos = []; setTimeout(() => { pasoHist = null; }, 0); }
    if (!pasoHist.some(x => x.t === tabla && x.k === k)) pasoHist.push({ t: tabla, k, antes: antes ? { ...antes } : null });
  }
  fila.actualizado = new Date().toISOString();
  fila.sucio = true;
  versionDatos++;
  db[tabla][fila[TABLAS[tabla].clave]] = fila;
  if (!enLote) persistir();
}
// Aplica un paso del historial y devuelve el paso contrario (para rehacer o volver a deshacer)
function aplicarPaso(paso) {
  const contrario = paso.map(x => ({ t: x.t, k: x.k, antes: db[x.t][x.k] ? { ...db[x.t][x.k] } : null }));
  sinHistorial = true;
  paso.slice().reverse().forEach(x => {
    const actual = db[x.t][x.k];
    if (x.antes) { const c = { ...x.antes }; delete c.sucio; cambiar(x.t, c, true); }
    else if (actual) cambiar(x.t, { ...actual, borrado: true }, true);
  });
  sinHistorial = false;
  persistir();
  pintarTodo();
  if (ent) pintarEntreno();
  return contrario;
}
function deshacerPaso(rehacer) {
  const de = rehacer ? rehechos : historial, a = rehacer ? historial : rehechos;
  const paso = de.pop();
  if (!paso) { avisoDeshacer(rehacer ? "Nada que rehacer" : "Nada que deshacer", null); return; }
  a.push(aplicarPaso(paso));
  const mac = /Mac|iP/.test(navigator.platform);
  avisoDeshacer(rehacer ? "↷ Rehecho" + (rehechos.length ? " · quedan " + rehechos.length + " por rehacer" : "") + " · " + (mac ? "⌘Z" : "Ctrl+Z") + " para deshacer"
    : "↶ Deshecho" + (historial.length ? " · " + historial.length + " más por deshacer" : "") + " · " + (mac ? "⌘⇧Z" : "Ctrl+Y") + " para rehacer", null);
}
addEventListener("keydown", e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k !== "z" && k !== "y") return;
  // Escribiendo en un campo, el deshacer es el del propio texto
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if ($("login") && !$("login").hidden) return;
  e.preventDefault();
  deshacerPaso(k === "y" || e.shiftKey);
});
function mezclar(tabla, f) {
  const k = f[TABLAS[tabla].clave];
  if (!claveDatoValida(k) || !Number.isFinite(Date.parse(f.actualizado))) throw new Error("El servidor devolvió un registro no válido en " + tabla);
  const local = db[tabla][k];
  const tr = Date.parse(f.actualizado), tl = local ? Date.parse(local.actualizado) : 0;
  // Misma marca y sin cambios locales: solo se copia si el servidor trae algún campo distinto (p. ej. una columna nueva)
  const igual = () => TABLAS[tabla].campos.every(c => c === "actualizado" || JSON.stringify(local[c] ?? null) === JSON.stringify(f[c] ?? null));
  if (local?.sucio) {
    if (tr > tl) {
      // Conservar ambas versiones para resolver el conflicto; no sobrescribir una edición pendiente.
      local.conflicto = f;
      guardarLocal();
      mostrarConflictos();
      throw new Error("Hay cambios de otro dispositivo. Pulsa «Revisar cambios pendientes» para elegir qué conservar.");
    }
    return false;
  }
  if (local && tr === tl && igual()) return false;
  const fila = {};
  TABLAS[tabla].campos.forEach(c => { fila[c] = f[c]; });
  fila.actualizado = new Date(tr).toISOString();
  fila.sucio = false;
  db[tabla][k] = fila;
  versionDatos++;
  if (tabla === "entrenos") aplicarExtra(k, fila.extra || {});
  return true;
}
// ---- Extra de cada día: construirlo desde lo guardado en el dispositivo y aplicarlo cuando llega del servidor ----
function extraDe(f) {
  const pre = f + "|";
  const sub = o => { const r = {}; Object.keys(o || {}).filter(k => k.startsWith(pre)).sort().forEach(k => { r[k.slice(pre.length)] = o[k]; }); return r; };
  const e = { e: enEspera[f] || [], s: sesionesVacias[f] || [], g: sub(esperaGrupo), p: sub(partesVacias), pa: sub(esperaParte), n: sub(esperaNota), l: sub(esperaLetra), a: sub(esperaAntes), bv: sub(bloquesVacios) };
  Object.keys(e).forEach(k => { if (Array.isArray(e[k]) ? !e[k].length : !Object.keys(e[k]).length) delete e[k]; });
  return e;
}
let aplicandoExtra = false, timerExtra = null;
function aplicarExtra(f, e) {
  aplicandoExtra = true;
  const pre = f + "|";
  const poner = (o, datos) => { Object.keys(o).forEach(k => { if (k.startsWith(pre)) delete o[k]; }); Object.keys(datos || {}).forEach(k => { o[pre + k] = datos[k]; }); };
  if ((e.e || []).length) enEspera[f] = e.e.slice(); else delete enEspera[f];
  if ((e.s || []).length) sesionesVacias[f] = e.s.slice(); else delete sesionesVacias[f];
  poner(esperaGrupo, e.g); poner(partesVacias, e.p); poner(esperaParte, e.pa); poner(esperaNota, e.n); poner(esperaLetra, e.l); poner(esperaAntes, e.a); poner(bloquesVacios, e.bv);
  guardarVacios();
  escribir("bloques-v1", enEspera); guardarSesiones(); escribir("espera-nota-v1", esperaNota); escribir("espera-letra-v1", esperaLetra); escribir("espera-antes-v1", esperaAntes);
  aplicandoExtra = false;
}
// Tras cambiar algo local, se compara cada día con lo guardado y se marca para subir lo que cambie
function marcarExtra() {
  if (aplicandoExtra) return;
  try { esperaAntes; esperaNota; esperaLetra; } catch { return; }   // aún cargando la app
  clearTimeout(timerExtra);
  timerExtra = setTimeout(volcarExtra, 400);
}
function volcarExtra() {
    clearTimeout(timerExtra);
    if (!sesion || sesion.user_id !== cuentaLocal) return;
    const fechas = new Set([...Object.keys(enEspera), ...Object.keys(sesionesVacias)]);
    [esperaGrupo, partesVacias, esperaParte, esperaNota, esperaLetra, esperaAntes, bloquesVacios].forEach(o => Object.keys(o || {}).forEach(k => fechas.add(k.split("|")[0])));
    Object.values(db.entrenos).forEach(x => { if (x.extra && Object.keys(x.extra).length) fechas.add(x.fecha); });
    let hay = false;
    // Guardado interno y automático: no es un paso que deshacer (si no, Ctrl+Z se «gastaba» en él y se perdía el rehacer)
    const sinH = sinHistorial; sinHistorial = true;
    fechas.forEach(f => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return;
      const e = extraDe(f), actual = (db.entrenos[f] || {}).extra || {};
      if (JSON.stringify(e) === JSON.stringify(actual)) return;
      const previo = db.entrenos[f] || { fecha: f, html: "", texto: "", rpe: 0, sensacion: "" };
      cambiar("entrenos", { ...previo, fecha: f, extra: e }, true);
      hay = true;
    });
    sinHistorial = sinH;
    if (hay) persistir();
}
const hayPendientes = () => Object.keys(TABLAS).some(t => Object.values(db[t]).some(v => v.sucio));

// Fechas pendientes: no adivinar el día ni sustituir un entrenamiento por el día actual.
function fechaSerieValida(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [a, m, d] = v.split("-").map(Number);
  if (a < 1000 || a > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const fecha = new Date(a, m - 1, d);
  return fecha.getFullYear() === a && fecha.getMonth() === m - 1 && fecha.getDate() === d;
}
function marcaSerieValida(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)
    && fechaSerieValida(v.slice(0,10)) && Number.isFinite(Date.parse(v));
}
function seriesConFechaIncorrecta() {
  return Object.values(db.series).filter(s => s.sucio && (!fechaSerieValida(s.fecha) || !marcaSerieValida(s.actualizado)));
}
function mostrarFechasPendientes() {
  const pendientes = seriesConFechaIncorrecta();
  let boton = $("revisarFechasSeries");
  if (!boton && pendientes.length) {
    boton = document.createElement("button"); boton.id = "revisarFechasSeries"; boton.type = "button"; boton.className = "enlace";
    estado.after(boton); boton.addEventListener("click", abrirFechasPendientes);
  }
  if (boton) { boton.hidden = !pendientes.length; boton.textContent = "Revisar fechas pendientes (" + pendientes.length + ")"; }
  return pendientes.length;
}
function botonDescartarFechas(cuerpo, dlg, ctx) {
  const caja = document.createElement("div"), boton = document.createElement("button");
  boton.type = "button"; boton.className = "peligro";
  boton.textContent = "Descartar todas las series pendientes con fecha incorrecta (" + seriesConFechaIncorrecta().length + ")";
  const confirmacion = document.createElement("div"); caja.append(boton, confirmacion); cuerpo.appendChild(caja);
  boton.onclick = () => {
    const filas = seriesConFechaIncorrecta().map(s => ({ id: s.id, original: JSON.stringify(s) }));
    if (!filas.length) { dlg.close(); mostrarFechasPendientes(); return; }
    confirmacion.textContent = "";
    const texto = document.createElement("p");
    texto.textContent = "Se descartarán los cambios pendientes de " + filas.length + " series con fechas incorrectas, incluidas las que no se ven en esta página. Las series nuevas aún no guardadas en la nube se quitarán del dispositivo. Si alguna ya existía en la nube, se recuperará esa versión. No se borrarán otros entrenamientos. Se conservará una copia recuperable antes de continuar.";
    const si = document.createElement("button"), no = document.createElement("button"), estadoDescarte = document.createElement("p");
    si.type = no.type = "button"; si.className = "peligro"; no.className = "nav-btn";
    si.textContent = "Sí, descartar estas " + filas.length + " series"; no.textContent = "Cancelar";
    estadoDescarte.setAttribute("role", "status");
    no.onclick = () => { confirmacion.textContent = ""; boton.disabled = false; };
    confirmacion.append(texto, si, no, estadoDescarte); boton.disabled = true;
    si.onclick = async () => {
      si.disabled = no.disabled = true;
      estadoDescarte.textContent = "Recuperando la versión guardada y conservando una copia…";
      try {
        comprobarSesion(ctx);
        if (sincronizando) throw new Error("Espera a que termine la sincronización y vuelve a intentarlo.");
        const remotas = new Map();
        // Solo lecturas de la cuenta activa. Nunca borrar filas de Supabase para limpiar un error local.
        for (let i = 0; i < filas.length; i += 40) {
          const ids = filas.slice(i, i + 40).map(f => f.id);
          if (ids.some(id => !/^[0-9a-f-]{36}$/i.test(id))) throw new Error("Hay un identificador no reconocido. Conserva la copia y solicita revisión.");
          let ultimo = "";
          for (;;) {
            const ruta = "/rest/v1/series?select=*&user_id=eq." + encodeURIComponent(ctx.usuario)
              + "&id=in.(" + ids.join(",") + ")&order=id.asc&limit=40" + (ultimo ? "&id=gt." + encodeURIComponent(ultimo) : "");
            const respuesta = await api(ruta); comprobarSesion(ctx);
            if (!respuesta.ok) throw new Error("No se pudo consultar la copia de la nube. No se ha descartado nada.");
            const pagina = await respuesta.json();
            if (!Array.isArray(pagina)) throw new Error("Respuesta inesperada. No se ha descartado nada.");
            if (!pagina.length) break;
            for (const r of pagina) {
              if (r.user_id !== ctx.usuario || !ids.includes(r.id) || !fechaSerieValida(r.fecha) || !marcaSerieValida(r.actualizado)) throw new Error("No se pudo recuperar una copia válida. No se ha descartado nada.");
              remotas.set(r.id, r);
            }
            const siguiente = pagina[pagina.length - 1].id;
            if (siguiente === ultimo) throw new Error("No se pudo completar la lectura. No se ha descartado nada.");
            ultimo = siguiente;
          }
        }
        comprobarSesion(ctx);
        if (sincronizando || filas.some(f => JSON.stringify(db.series[f.id]) !== f.original)) throw new Error("Los datos han cambiado durante la revisión. Cierra y abre de nuevo esta ventana.");
        const copia = { creado: new Date().toISOString(), accion: "descartar-pendientes-fecha", series: filas.map(f => ({ original: JSON.parse(f.original), nube: remotas.get(f.id) || null })) };
        if (!escribir("fechas-series-copias-v1", [...(leer("fechas-series-copias-v1") || []), copia])) throw new Error("No hay espacio para guardar la copia. No se ha descartado nada.");
        const series = Object.assign(Object.create(null), db.series);
        filas.forEach(f => {
          const remota = remotas.get(f.id);
          if (!remota) delete series[f.id];
          else {
            const fila = {}; TABLAS.series.campos.forEach(c => { fila[c] = remota[c]; });
            fila.sucio = false; series[f.id] = fila;
          }
        });
        const siguienteDb = { ...db, series };
        if (!escribir("datos-v2", siguienteDb)) throw new Error("No se pudo guardar el resultado en este dispositivo. Se conserva la copia de seguridad.");
        db = siguienteDb; versionDatos++;
        dlg.close(); mostrarFechasPendientes(); pintarTodo();
        setEstado("Descartados los cambios de " + filas.length + " series. Copia conservada en la exportación de Ajustes.");
        sincronizar();
      } catch (e) {
        estadoDescarte.textContent = e instanceof SesionCambiada ? "La cuenta ha cambiado. Cierra esta ventana." : (e.message || "No se ha podido completar el descarte.");
        si.disabled = no.disabled = false;
      }
    };
  };
}

function abrirFechasPendientes() {
  if (!sesion || sesion.user_id !== cuentaLocal) return;
  const pendientes = seriesConFechaIncorrecta().slice(0, 20);
  if (!pendientes.length) { mostrarFechasPendientes(); return; }
  const ctx = contextoSesion(), dlg = document.createElement("dialog"); dlg.setAttribute("aria-label", "Corregir fechas de series");
  const cab = document.createElement("div"); cab.className = "d-cab";
  const titulo = document.createElement("h3"); titulo.className = "d-tit"; titulo.textContent = "Revisar fechas";
  const cerrar = document.createElement("button"); cerrar.type = "button"; cerrar.className = "cerrar"; cerrar.textContent = "✕"; cerrar.setAttribute("aria-label", "Cerrar"); cerrar.onclick = () => dlg.close(); cab.append(titulo, cerrar);
  const cuerpo = document.createElement("div"); cuerpo.className = "d-cuerpo";
  const info = document.createElement("p"); info.textContent = "Estas series siguen guardadas en el dispositivo. Elige el día correcto para cada fecha inválida. Se conservará una copia antes de corregir. Si hay más de 20, podrás revisar las siguientes después."; cuerpo.appendChild(info);
  botonDescartarFechas(cuerpo, dlg, ctx);
  const entradas = pendientes.map(s => {
    const bloque = document.createElement("fieldset"), leyenda = document.createElement("legend");
    leyenda.textContent = (nombreEj(s.ejercicio_id) || "Ejercicio") + (s.grupo ? " · " + s.grupo : "") + (s.borrado ? " · eliminado pendiente de sincronizar" : ""); bloque.appendChild(leyenda);
    const detalle = document.createElement("p"); detalle.textContent = "Serie: " + (s.reps || 0) + " rep. · " + (s.peso || 0) + " kg · " + (s.distancia || 0) + " m"; bloque.appendChild(detalle);
    const lab = document.createElement("label"); lab.className = "campo"; lab.textContent = "Fecha del entrenamiento";
    const fecha = document.createElement("input"); fecha.type = "date"; fecha.required = true; fecha.min = "1000-01-01"; fecha.max = "9999-12-31";
    fecha.value = fechaSerieValida(s.fecha) ? s.fecha : ""; fecha.disabled = fechaSerieValida(s.fecha);
    lab.appendChild(fecha); bloque.appendChild(lab);
    if (!marcaSerieValida(s.actualizado)) {
      const aviso = document.createElement("p"); aviso.textContent = "La marca de última edición no es válida. Al confirmar se registrará esta corrección como una nueva edición, conservando la fecha del entrenamiento."; bloque.appendChild(aviso);
    }
    cuerpo.appendChild(bloque);
    return { id: s.id, original: JSON.stringify(s), fecha };
  });
  const aviso = document.createElement("p"); aviso.className = "aviso"; aviso.setAttribute("role", "status"); cuerpo.appendChild(aviso);
  const guardar = document.createElement("button"); guardar.type = "button"; guardar.className = "anadir"; guardar.textContent = "Guardar correcciones y sincronizar";
  guardar.onclick = () => {
    try { comprobarSesion(ctx); } catch { aviso.textContent = "La cuenta ha cambiado. Cierra esta ventana."; return; }
    if (sincronizando) { aviso.textContent = "Espera a que termine la sincronización y vuelve a pulsar."; return; }
    for (const e of entradas) {
      if (!fechaSerieValida(e.fecha.value)) { e.fecha.reportValidity(); aviso.textContent = "Selecciona una fecha válida para cada serie."; return; }
      const actual = db.series[e.id];
      if (!actual || JSON.stringify(actual) !== e.original || actual.conflicto) { aviso.textContent = "Una serie ha cambiado o tiene un conflicto. Cierra y abre de nuevo la revisión; resuelve primero los conflictos pendientes."; return; }
    }
    const copia = { creado: new Date().toISOString(), series: entradas.map(e => ({ original: JSON.parse(e.original), fechaElegida: e.fecha.value })) };
    const copias = leer("fechas-series-copias-v1") || [];
    if (!escribir("fechas-series-copias-v1", [...copias, copia])) { aviso.textContent = "No hay espacio para conservar la copia. Exporta tus datos desde Ajustes antes de corregir."; return; }
    entradas.forEach(e => cambiar("series", { ...db.series[e.id], fecha: e.fecha.value }, true));
    // Guardar antes de intentar la red; nunca marcar como sincronizadas sin respuesta correcta.
    guardarLocal(); dlg.close(); mostrarFechasPendientes(); pintarTodo(); sincronizar();
  };
  cuerpo.appendChild(guardar); dlg.append(cab, cuerpo); document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove(), { once: true }); dlg.showModal();
}

// El error de guardado debe explicar la causa sin mostrar filas, tokens ni datos personales.
async function errorGuardado(tabla, respuesta) {
  const e = await respuesta.clone().json().catch(() => ({}));
  const codigo = /^[A-Z0-9]{5,12}$/.test(e.code || "") ? e.code : "";
  const mensaje = String(e.message || "");
  let causa = "";
  if (codigo === "22P02") {
    const tipo = (mensaje.match(/(?:type|syntax for)\s+(integer|bigint|smallint|numeric|boolean|uuid|json|date|timestamp)/i) || [])[1];
    causa = "Hay un valor con formato no válido" + (tipo ? " para " + tipo : "") + ".";
  } else if (codigo === "23503") causa = "Una serie hace referencia a un ejercicio u otro registro que no está disponible en la nube.";
  else if (codigo === "23502") {
    const campo = (mensaje.match(/column "([a-z_]+)"/i) || [])[1];
    causa = "Falta un dato obligatorio" + (TABLAS[tabla].campos.includes(campo) ? ": " + campo : "") + ".";
  } else if (codigo === "23514") causa = "Un valor no cumple las condiciones de la base de datos.";
  else if (codigo === "22003") causa = "Un valor numérico supera el límite de la base de datos.";
  else if (codigo === "22007" || codigo === "22008") {
    const tipo = (mensaje.match(/type (date|timestamp with time zone|timestamp without time zone|timestamp|time)/i) || [])[1];
    causa = "El servidor rechaza un formato de fecha u hora" + (tipo ? " (" + tipo + ")" : "") + ".";
    if (tabla === "series" && !seriesConFechaIncorrecta().length) causa += " Las fechas de las series tienen formato válido en la app; falta revisar la causa en el servidor.";
  }
  else if (codigo === "PGRST204" || codigo === "42703") {
    const campo = TABLAS[tabla].campos.find(c => mensaje.includes("'" + c + "'") || mensaje.includes('"' + c + '"') || mensaje.includes(tabla + "." + c));
    causa = "La base de datos no reconoce un campo de esta versión" + (campo ? ": " + campo : "") + ".";
  } else if (codigo === "42501") causa = "La cuenta no tiene permiso para guardar este registro.";
  return new Error("No se pudo guardar " + tabla + " (" + respuesta.status + (codigo ? " · " + codigo : "") + "). " + (causa ? causa + " " : "") + "Los cambios siguen pendientes. Conserva este aviso para resolver la causa.");
}

// Conversión local y conservadora: solo se aceptan líneas que el lector ya entiende.
// Lo ambiguo permanece en el editor; nunca se inventan ejercicios ni se descartan líneas.
// Formato de documento: «2) Press banca:» y viñetas «Cal:», «Método Bilbo:»…
// Solo convertir cuando todas las líneas pertenecen a esta estructura.
function leerRutinaNumerada(texto, nombre) {
  const lineas = String(texto || "").replace(/\r/g, "").replace(/\*\*/g, "").split("\n");
  const ejercicios = []; let actual = null, linea = null;
  for (const raw of lineas) {
    const l = raw.trim(); if (!l) continue;
    const cab = l.match(/^\d+[.)]\s+(.+?):\s*$/);
    if (cab) {
      if (cab[1].length > 80) return null;
      actual = { nombre: cab[1].trim(), lineas: [] }; ejercicios.push(actual); linea = null; continue;
    }
    if (!actual) return null;
    const vineta = l.match(/^[•●▪*–-]\s+(.+)$/);
    if (vineta) { linea = { texto: vineta[1] }; actual.lineas.push(linea); }
    else if (linea) linea.texto += " " + l; // Saltos de línea introducidos por el PDF.
    else return null;
  }
  if (!ejercicios.length) return null;
  const items = [];
  for (const ej of ejercicios) {
    if (!ej.lineas.length) return null;
    const tipo = adivinarTipo(ej.nombre);
    // Este patrón describe series de fuerza; otros deportes siguen con su lector habitual.
    if (tipo !== "fuerza") return null;
    for (const l of ej.lineas) {
      const m = l.texto.match(/^([^:]+):\s*(.+)$/);
      if (!m || l.texto.length > 300) return null;
      const etiqueta = m[1], cuerpo = m[2], series = [];
      const cal = /^(cal\.?|calentamiento)\b/i.test(etiqueta), bilbo = /\bbilbo\b/i.test(etiqueta);
      if (!cal && !bilbo && !/^(resistencia|series?|principal|aproximaci[oó]n)\b/i.test(etiqueta)) return null;
      const pctEtiqueta = etiqueta.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:1\s*)?RM\b/i);
      for (const tramo of cuerpo.split(/\s*\+\s*/)) {
        const q = tramo.match(/^(\d+)\s*[x×]\s*(m[aá]x(?:imas?)?|\d+(?:\s*[-–]\s*\d+)?)\s*(?:repeticiones|reps?|rep\.)?\b\s*(.*)$/i);
        if (!q || !(+q[1] >= 1 && +q[1] <= 50)) return null;
        const resto = q[3], pct = resto.match(/\(\s*(\d+(?:[.,]\d+)?)\s*%\s*(?:1\s*)?RM\s*\)/i) || pctEtiqueta;
        const peso = resto.match(/\(\s*(\d+(?:[.,]\d+)?)\s*kg\s*\)/i);
        if (pct && peso) return null; // Carga ambigua: no elegir entre kilos y porcentaje.
        // No esconder otra prescripción incrustada sin separador.
        if (/\d+\s*[x×]\s*\d/i.test(resto)) return null;
        const valor = leerValor(q[2].replace(/\s/g, "").replace(/–/g, "-") + (pct ? " @" + pct[1] + "%" : "") + (peso ? " @" + peso[1] + "kg" : ""), "fuerza");
        if (valor.error) return null;
        // Las indicaciones originales (recámara, técnica, D/4′…) quedan intactas
        // para revisión, sin asignar descansos ambiguos a todas las series.
        for (let i = 0; i < +q[1]; i++) series.push({ ...valor, calentamiento: cal, bilbo, nota: l.texto });
      }
      const seccion = cal ? "Calentamiento" : bilbo ? "Método Bilbo"
        : /^resistencia/i.test(etiqueta) ? "Resistencia"
        : /^aproximaci[oó]n/i.test(etiqueta) ? "Aproximación" : "Parte principal";
      items.push({ ejercicio: ej.nombre, tipo: "fuerza", seccion, series });
    }
  }
  const titulo = String(nombre || "Entrenamiento importado").replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").slice(0,60);
  return { nombre: titulo, nota: "Las indicaciones originales se conservan en las notas de las series. Puedes revisar y editar los descansos aquí antes de guardar.", semanas: 0, bloques: [{ sesiones: [{ nombre: titulo, dias: [], items }] }], multi: false, conDias: false };
}

function prepararTextoImportado(texto, nombre) {
  const limpio = String(texto || "").replace(/\r/g, "").replace(/\*\*|__/g, "");
  if (/^\s*RUTINA\s*:/im.test(limpio)) return limpio;
  const lineas = limpio.split("\n"), salida = ["RUTINA: " + (nombre || "Entrenamiento importado").replace(/\.[^.]+$/, "").slice(0, 60)];
  let sesion = false, ejercicios = 0;
  for (const original of lineas) {
    const l = original.trim();
    if (!l || /^```/.test(l) || /^[-=]{3,}$/.test(l)) continue;
    const sinMarca = l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "");
    const ej = leerEjercicio(sinMarca, true);
    if (!ej.error) {
      if (!sesion) { salida.push("## Sesión"); sesion = true; }
      salida.push("- " + sinMarca); ejercicios++; continue;
    }
    if (/^(?:#{1,3}\s*)?SEMANA\s+\d+\s*:?$/i.test(l)) { salida.push(l.replace(/^#+\s*/, "").replace(/:$/, "")); sesion = false; continue; }
    if (/^SEMANAS\s*:|^NOTA\s*:/i.test(l)) { salida.push(l); continue; }
    const encabezado = l.replace(/^#{1,6}\s*/, "").replace(/:$/, "");
    if (/^(cal(?:entamiento)?\.?|parte principal|vuelta a la calma|enfriamiento|movilidad|m[eé]todo bilbo|bilbo|resistencia|aproximaci[oó]n)$/i.test(encabezado)) {
      if (!sesion) { salida.push("## Entrenamiento"); sesion = true; }
      salida.push("### " + (/^cal/i.test(encabezado) ? "Calentamiento" : encabezado)); continue;
    }
    if (/^#{1,3}\s+/.test(l) || /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i.test(encabezado)) {
      const dia = encabezado.match(/^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b\s*[-:–]?\s*(.*)$/i);
      salida.push("## " + (dia ? (dia[2] || dia[1]) + " @ " + dia[1] : encabezado)); sesion = true; continue;
    }
    // Una introducción o tabla libre requiere revisión humana, no una conversión parcial.
    return limpio;
  }
  return ejercicios ? salida.join("\n") : limpio;
}

function validarEdicionIA() {
  $("iaMensaje").textContent = "";
  try { comprobarSesion(contextoIA); }
  catch { avisoImportacionIA("La sesión ha cambiado. Vuelve a importar desde tu cuenta."); return false; }
  if (!validarCamposBorradorIA()) return false;
  if (!rutinaIA?.nombre.trim() || sesionesImportadas().some(({s}) => !s.nombre.trim() || s.items.some(it => (it.bloque ? it.tramos : [it]).some(t => !t.ejercicio.trim())))) {
    avisoImportacionIA("Completa los nombres del entrenamiento y sus ejercicios antes de guardar."); return false;
  }
  if (sesionesImportadas().some(({s}) => !s.items.length || (s.partesBorrador || []).some(p => !s.items.some(it => it.seccion === p)))) {
    avisoImportacionIA("Añade un ejercicio a las partes vacías o quítalas antes de guardar."); return false;
  }
  if (sesionesImportadas().some(({s}) => s.items.some(it => (it.bloque ? it.tramos : [it]).some(e => e.series.some(v => v.rango_min && v.rango_max && v.rango_min > v.rango_max))))) {
    avisoImportacionIA("Las repeticiones mínimas no pueden superar las máximas."); return false;
  }
  if (sesionesImportadas().some(({s}) => s.items.some(it => (it.bloque ? it.tramos : [it]).some(e => {
    const id=catalogoElegidoIA.get(e); return id && !vivos("ejercicios").some(x=>x.id===id && x.tipo===e.tipo);
  })))) { avisoImportacionIA("Un ejercicio elegido ya no está disponible. Vuelve a elegirlo en el catálogo."); return false; }
  sesionesImportadas().forEach(({s})=>partesImportacionIA(s));
  return true;
}
function sesionesImportadas() {
  return rutinaIA ? rutinaIA.bloques.flatMap((b, semana) => b.sesiones.map(s => ({ s, semana }))) : [];
}
function actualizarDestinoIA() {
  const sesiones = sesionesImportadas(), sel = $("iaDiaSesion"), anterior = sel.value;
  sel.textContent = "";
  sesiones.forEach(({ s, semana }, i) => {
    const op = document.createElement("option"); op.value = String(i);
    op.textContent = (rutinaIA.multi ? "Semana " + (semana + 1) + " · " : "") + s.nombre; sel.appendChild(op);
  });
  if ([...sel.options].some(op => op.value === anterior)) sel.value = anterior;
  $("iaDiaSesionL").hidden = sesiones.length < 2;
  $("iaDiaOp").hidden = !sesiones.length;

  $("iaMeso").hidden = !sesiones.length;
  $("iaAvisoDias").textContent = "Puedes renombrar las partes y editar ejercicios y series antes de guardar.";
  actualizarGuardadoIA(true);
}

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
        let lectura = await leerTablaCompleta(t, desde), r = lectura.respuesta;
        if (!r.ok) throw new Error("No se pudo leer " + t + " (" + r.status + "). Los cambios siguen pendientes.");
        for (const f of lectura.filas) {
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
        if (pend.some(v => v.conflicto)) { mostrarConflictos(); throw new Error("Revisa los cambios pendientes antes de sincronizar."); }
        if (t === "series" && mostrarFechasPendientes()) {
          throw new Error("Hay series con una fecha o marca de edición incorrecta. Pulsa Revisar fechas pendientes para corregirlas; los datos se conservan.");
        }
        const filas = pend.map(v => { const f = {}; TABLAS[t].campos.forEach(c => { f[c] = v[c] ?? (c in DEFECTOS ? DEFECTOS[c] : 0); }); f.user_id = t === "ejercicios" ? (v.user_id || sesion.user_id) : sesion.user_id; return f; });   // los ejercicios del catálogo conservan a su dueño
        const w = await api("/rest/v1/" + t + "?on_conflict=" + TABLAS[t].conflicto, {
          method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(filas)
        });
        if (!w.ok) throw await errorGuardado(t, w);
        filas.forEach(f => { const v = db[t][f[TABLAS[t].clave]]; if (v && v.actualizado === f.actualizado) v.sucio = false; });
        guardarLocal();
      }
    } while (repetir);
    const sugerenciasEnviadas = await enviarSugerencias();
    setEstado(hayPendientes() || !sugerenciasEnviadas ? "Hay cambios pendientes de sincronizar" : "Sincronizado", hayPendientes() || !sugerenciasEnviadas);
    mostrarConflictos();
  } catch (e) {
    if (e instanceof SesionCaducada) cerrarSesion("Tu sesión ha caducado. Vuelve a entrar; lo que escribiste sigue guardado en este dispositivo.");
    else if (e instanceof SesionCambiada) return;
    else { guardarLocal(); setEstado(navigator.onLine === false ? "Sin conexión · los cambios siguen guardados en el dispositivo" : (e.message || "No se pudo sincronizar. Los cambios siguen pendientes."), true); }
  } finally {
    sincronizando = false;
  }
}

function mostrarConflictos() {
  const conflictos = Object.keys(TABLAS).flatMap(t => Object.values(db[t]).filter(f => f.conflicto).map(f => ({ t, f })));
  let boton = $("revisarConflictos");
  if (!boton && conflictos.length) {
    boton = document.createElement("button"); boton.id = "revisarConflictos"; boton.type = "button"; boton.className = "enlace";
    boton.textContent = "Revisar cambios pendientes"; estado.after(boton);
  }
  if (!boton) return;
  boton.hidden = !conflictos.length;
  boton.onclick = () => {
    const { t, f } = conflictos[0], k = f[TABLAS[t].clave], remoto = f.conflicto;
    const versionElegida = f.actualizado;
    const elegir = usarLocal => {
      if (db[t][k] !== f || f.actualizado !== versionElegida || f.conflicto !== remoto) {
        mostrarConflictos(); setEstado("El registro ha cambiado. Abre de nuevo la revisión antes de elegir.", true); return;
      }
      const copiaLocal = { ...f }; delete copiaLocal.conflicto;
      const copias = leer("conflictos-copia-v1") || [];
      copias.push({ tabla: t, clave: k, fecha: new Date().toISOString(), local: copiaLocal, nube: remoto });
      if (!escribir("conflictos-copia-v1", copias)) { setEstado("Exporta una copia antes de resolver el conflicto: falta espacio local.", true); return; }
      if (usarLocal) {
        cambiar(t, copiaLocal, true);
        db[t][k].actualizado = new Date(Math.max(Date.now(), Date.parse(remoto.actualizado) + 1)).toISOString();
      } else {
        db[t][k].sucio = false;
        delete db[t][k].conflicto;
        mezclar(t, remoto);
      }
      guardarLocal(); mostrarConflictos(); pintarTodo(); sincronizar();
    };
    abrirMenu("Cambios de dos dispositivos", (f.nombre || f.fecha || "Registro") + ": hay dos versiones. Se guardará una copia de ambas, incluida al exportar tus datos.", [
      { texto: "Conservar mis cambios de este dispositivo", accion: () => elegir(true) },
      { texto: "Usar la versión de la nube", accion: () => elegir(false) },
      { texto: "Decidir más tarde", accion: () => {} }
    ]);
  };
}

// ---------- Ventanas pequeñas: menú de opciones y pedir un nombre ----------
// Confirmación antes de borrar: ventana con «Cancelar» y «Eliminar» (Esc o tocar fuera = cancelar)
// ---------- Vista previa desplegable de ejercicios (compartidos, mesociclos, plantillas) ----------
// items en formato compartido ({ejercicio, tipo, series}) o propio ({ejercicio_id, series}); con las partes como subtítulos
function listaItems(items) {
  const comp = items.map(it => it.ejercicio || (it.tramos && it.tramos[0] && it.tramos[0].ejercicio) ? it : paraCompartir([it])[0]);
  const ul = document.createElement("ul");
  ul.className = "vp-lista";
  const linea = it => { const li = document.createElement("li"); li.textContent = textoItemRutina(it); return li; };
  for (let i = 0; i < comp.length;) {
    const parte = comp[i].seccion || "";
    if (!parte) { ul.appendChild(linea(comp[i++])); continue; }
    const itemsParte = [];
    while (i < comp.length && (comp[i].seccion || "") === parte) itemsParte.push(comp[i++]);
    const li = document.createElement("li"); li.className = "rutina-parte-acordeon";
    const d = document.createElement("details"); d.className = "rutina-parte-det"; d.open = true;
    const s = document.createElement("summary");
    const n = contarSeries(itemsParte);
    s.textContent = parte + " · " + n + (n === 1 ? " serie" : " series");
    const dentro = document.createElement("ul");
    itemsParte.forEach(it => dentro.appendChild(linea(it)));
    d.append(s, dentro); li.appendChild(d); ul.appendChild(li);
  }
  if (!comp.length) { const li = document.createElement("li"); li.textContent = "Sin ejercicios"; ul.appendChild(li); }
  return ul;
}
function desplegableItems(titulo, items, abierto) {
  const d = document.createElement("details");
  d.className = "vp-det";
  d.open = !!abierto;
  const s = document.createElement("summary");
  s.textContent = titulo + " · " + contarSeries(items) + (contarSeries(items) === 1 ? " serie" : " series");
  d.append(s, listaItems(items));
  return d;
}
// Mesociclo compartido: cada día (o cada semana y día, si cambia cada semana) con sus plantillas desplegables
function vistaMesoCompartido(x) {
  const caja = document.createElement("div"), mm = x.mesociclo, dias = mm.dias || {};
  const dia = (d, etiqueta) => (d || []).forEach(i => { const p = x.plantillas[i]; if (p) caja.appendChild(desplegableItems(etiqueta + " · " + p.nombre, p.items)); });
  const semanas = Object.keys(dias).filter(k => /^s\d+$/.test(k)).sort((a, b) => +a.slice(1) - +b.slice(1));
  if (semanas.length) semanas.forEach(k => { const h = document.createElement("p"); h.className = "bc-t"; h.textContent = "Semana " + k.slice(1); caja.appendChild(h); NOMBRES.forEach((n, i) => dia(dias[k][i], n)); });
  else NOMBRES.forEach((n, i) => dia(dias[i], n));
  if (!caja.children.length) x.plantillas.forEach(p => caja.appendChild(desplegableItems(p.nombre, p.items)));
  return caja;
}
function confirmar(titulo, texto, si) {
  return new Promise(res => {
    const d = $("dlgConfirmar");
    $("confTit").textContent = titulo;
    $("confTxt").textContent = texto || "";
    $("confTxt").hidden = !texto;
    $("confSi").textContent = si || "Eliminar";
    let hecho = false;
    const fin = v => { if (hecho) return; hecho = true; if (d.open) d.close(); res(v); };
    $("confSi").onclick = () => fin(true);
    $("confNo").onclick = () => fin(false);
    d.onclose = () => fin(false);
    d.onclick = e => { if (e.target === d) fin(false); };
    d.showModal();
    $("confNo").focus();
  });
}
// Texto de la confirmación a partir del antiguo «Pulsa otra vez: …»
const textoConfirmar = t => { const m = String(t || "").match(/^Pulsa otra vez:\s*(.+)$/i); return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) + "." : "No se puede deshacer."; };
function abrirMenu(titulo, detalle, opciones, extra) {
  $("menuTit").textContent = titulo;
  $("menuDet").textContent = detalle || "";
  $("menuDet").hidden = !detalle;
  // Contenido desplegable opcional (vista previa de ejercicios) entre el texto y las opciones
  $("menuExtra").textContent = "";
  $("menuExtra").hidden = !extra;
  if (extra) $("menuExtra").appendChild(extra);
  const cont = $("menuOpciones");
  cont.textContent = "";
  opciones.filter(Boolean).forEach(o => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opcion" + (o.peligro ? " peligro-op" : "");
    b.textContent = o.texto;
    b.addEventListener("click", () => {
      if (o.peligro) {
        $("menu").close();
        confirmar("¿" + o.texto.replace(/…$/, "") + "?", textoConfirmar(o.confirmar), "Eliminar").then(ok => { if (ok) o.accion(); });
        return;
      }
      if (!o.mantener) $("menu").close();
      ultimoTocado = null;   // mover, borrar, pegar…: que la pantalla no salte para «sujetar» el ejercicio
      o.accion();
    });
    cont.appendChild(b);
  });
  if (!$("menu").open) $("menu").showModal();
}
// Texto largo (descripción): devuelve el texto ("" = quitarlo) o null si se cancela
function pedirTexto(titulo, valor, ayuda) {
  return new Promise(resolver => {
    const d = $("dlgTexto");
    $("txtTit").textContent = titulo;
    $("txtAyuda").textContent = ayuda || "";
    $("txtInput").value = valor || "";
    d.returnValue = "";
    d.onclose = () => resolver(d.returnValue === "ok" ? $("txtInput").value.trim().slice(0, 300) : d.returnValue === "quitar" ? "" : null);
    d.showModal();
    $("txtInput").focus();
  });
}
const AYUDA_NOTA = "Por ejemplo «Tempo 3-2-1-2», «Banda roja», «EEP 2 (en reserva)», «Pausa 2 s abajo» o cómo hacerlo. Se ve debajo del ejercicio y en el modo entreno.";
// Pone la misma descripción a todas las series de un ejercicio (o de un tramo de un bloque) en ese día
// Ejercicios aún sin series: su descripción espera aquí (en este dispositivo) hasta que se apunte la primera serie
let esperaNota = leer("espera-nota-v1") || {};
const borradores = {};   // lo escrito en un ejercicio sin pulsar OK (se conserva al repintar el día)
let esperaLetra = leer("espera-letra-v1") || {};
// Marca que un ejercicio o bloque empieza una letra nueva (C1…) o sigue la anterior (B3…)
function ponerLetraNueva(dia, grupo, clave, espera, v) {
  if (espera) { if (v) esperaLetra[dia.id + "|" + clave] = 1; else delete esperaLetra[dia.id + "|" + clave]; escribir("espera-letra-v1", esperaLetra); }
  else { seriesDeItem(dia.id, grupo, clave).forEach(x => cambiar("series", { ...x, letra_nueva: v }, true)); persistir(); }
  pintarDia(dia);
}
async function editarNota(dia, seriesItem, titulo, claveEspera) {
  const actual = (seriesItem.find(x => x.nota) || {}).nota || (!seriesItem.length && claveEspera ? esperaNota[dia.id + "|" + claveEspera] || "" : "");
  const t = await pedirTexto(titulo, actual, AYUDA_NOTA);
  if (t === null || t === actual) return;
  if (!seriesItem.length && claveEspera) {
    if (t) esperaNota[dia.id + "|" + claveEspera] = t; else delete esperaNota[dia.id + "|" + claveEspera];
    escribir("espera-nota-v1", esperaNota);
  } else {
    seriesItem.forEach(x => cambiar("series", { ...x, nota: t }, true));
    persistir();
  }
  pintarDia(dia);
}
const notaDe = lista => (lista.find(x => x.nota) || {}).nota || "";
function lineaNota(texto, alTocar) {
  const n = document.createElement("button");
  n.type = "button"; n.className = "ej-nota"; n.textContent = texto;
  n.setAttribute("aria-label", "Descripción: " + texto + ". Toca para editarla");
  n.addEventListener("click", ev => { ev.stopPropagation(); alTocar(); });
  return n;
}
// Enter en un campo de una ventana guarda (su botón principal, marcado con data-enter); si la ventana no tiene, el campo
// se confirma (como al salir de él). Antes, en las ventanas de nombre, Enter pulsaba «Cancelar» y se perdía lo escrito
["rpeGuardar", "molGuardar", "claveGuardar", "mmGuardar", "carGuardar", "mesoGuardar"].forEach(id => { if ($(id)) $(id).dataset.enter = ""; });
document.addEventListener("click", e => { const b = e.target.closest("[data-cerrar]"); if (b) { const d = b.closest("dialog"); if (d) d.close(b.dataset.cerrar); } });
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" || e.shiftKey || e.defaultPrevented || e.isComposing) return;
  const t = e.target;
  if (!t || t.tagName !== "INPUT" || /^(checkbox|radio|button|submit|file|range|color)$/.test(t.type)) return;
  const d = t.closest("dialog[open]");
  if (!d) return;
  const b = [...d.querySelectorAll("[data-enter]")].find(x => !x.disabled && x.offsetParent !== null);
  e.preventDefault();
  if (b) b.click(); else t.blur();
});
// Fondo quieto mientras haya una ventana abierta (se mira cada vez que se abre o se cierra una)
(() => {
  const mirar = () => document.documentElement.classList.toggle("con-ventana", !!document.querySelector("dialog[open]"));
  const obs = new MutationObserver(mirar);
  document.querySelectorAll("dialog").forEach(d => { obs.observe(d, { attributes: true, attributeFilter: ["open"] }); d.addEventListener("close", mirar); });
  // Las ventanas que se crean después (por si acaso) también
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.tagName === "DIALOG") { obs.observe(n, { attributes: true, attributeFilter: ["open"] }); n.addEventListener("close", mirar); } }))).observe(document.body, { childList: true });
})();
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
                  '<div class="bloques"></div><div class="add-fila"><button type="button" class="add-ej">+ Ejercicio</button><button type="button" class="add-ej add-bloque">+ Bloque</button><button type="button" class="add-ej add-entreno">+ Entreno</button><button type="button" class="add-ej add-parte-btn">+ Parte</button></div>' +
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
  col.querySelector(".add-ej").addEventListener("click", () => enQueEntreno(dia, "Añadir ejercicio", g => abrirSelector(dia, null, g)));
  col.querySelector(".add-bloque").addEventListener("click", () => enQueEntreno(dia, "Añadir bloque", g => abrirBloque(dia, g)));
  col.querySelector(".add-entreno").addEventListener("click", () => elegirNuevoEntreno(dia));
  col.querySelector(".add-parte-btn").addEventListener("click", () => enQueEntreno(dia, "Nueva parte", g => nuevaParte(dia, g)));
  col.querySelector(".menu-btn").addEventListener("click", () => menuDia(dia));
  plegarAdd(col.querySelector(".dia-cuerpo-in > .add-fila"), true);
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
  // «Hoy»: en otra semana, o en esta si hoy está plegado; en la vista de un día, si no es hoy
  $("hoyBtn").hidden = n === 0 && desplegado(hoyIso);
  $("diaHoy").hidden = !diaAbierto;
  if (diaAbierto === hoyIso) $("diaHoy").setAttribute("aria-current", "date");
  else $("diaHoy").removeAttribute("aria-current");
  pintarBanda();
  // Cada día se despliega o se pliega (por defecto, solo hoy desplegado); con un día abierto, solo ese día
  $("vistaSemana").classList.toggle("solo-dia", !!diaAbierto);
  $("diaNav").hidden = !diaAbierto;
  $("navSemana").hidden = !!diaAbierto;
  if (diaAbierto) $("diaNavTit").textContent = NOMBRES[(deIso(diaAbierto).getDay() + 6) % 7] + " " + fmt(deIso(diaAbierto));
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
const seriesDelDia = fecha => (indiceSeries().porFecha[fecha] || []).slice();
// Convierte series en una lista de ejercicios con sus series (para copiar o guardar como plantilla)
// Los bloques se guardan como tramos con una serie por ronda: { bloque: true, tramos: [{ ejercicio_id, series: [ronda 1, ronda 2…] }] }
const valores = s => ({ peso: n0(s.peso), reps: s.ciclo_id ? 0 : n0(s.reps), distancia: n0(s.distancia), tiempo: n0(s.tiempo), descanso: n0(s.descanso), rec_dist: n0(s.rec_dist), pct: n0(s.pct), bilbo: !!s.ciclo_id, calentamiento: !!s.calentamiento, por_lado: !!s.por_lado, nota: s.nota || "", letra_nueva: !!s.letra_nueva, max_tiempo: !!s.max_tiempo, max_reps: !!s.max_reps, rango_min: n0(s.rango_min), rango_max: n0(s.rango_max) });
function itemsDe(series) {
  const items = [], bloques = {};
  series.forEach(s => {
    if (s.bloque_id) {
      if (!bloques[s.bloque_id]) { bloques[s.bloque_id] = { bloque: true, grupo: s.grupo || "", seccion: s.seccion || "", lista: [] }; items.push(bloques[s.bloque_id]); }
      bloques[s.bloque_id].lista.push(s);
      return;
    }
    const cp = n0(s.copia) > 1 ? n0(s.copia) : 0;
    let it = items.find(x => !x.bloque && x.ejercicio_id === s.ejercicio_id && x.grupo === (s.grupo || "") && x.seccion === (s.seccion || "") && n0(x.copia) === cp);
    if (!it) { it = { ejercicio_id: s.ejercicio_id, grupo: s.grupo || "", seccion: s.seccion || "", series: [] }; if (cp) it.copia = cp; items.push(it); }
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
    descanso: n0(v.descanso), rec_dist: n0(v.rec_dist), pct: n0(v.pct), ciclo_id: v.bilbo ? "auto" : "", calentamiento: !!v.calentamiento, por_lado: !!v.por_lado, nota: v.nota || "", letra_nueva: !!v.letra_nueva, max_tiempo: !!v.max_tiempo, max_reps: !!v.max_reps, rango_min: n0(v.rango_min), rango_max: n0(v.rango_max), hecha: false, meso_id: mesoId || "", bloque_id: "", ronda: 0, borrado: false
  }, extra), true);
  items.forEach(it => {
    const g = grupo !== undefined ? grupo : (it.grupo || "");
    if (it.bloque) {
      // Alterna los tramos ronda a ronda: R1 (A, B), R2 (A, B)…
      const tramos = (it.tramos || []).filter(t => ejercicioVivo(t.ejercicio_id));
      if (!tramos.length) return;
      const bloque_id = nuevoId(), rondas = Math.max.apply(null, tramos.map(t => t.series.length));
      for (let r = 0; r < rondas; r++) tramos.forEach(t => nueva(t.ejercicio_id, t.series[r] || t.series[t.series.length - 1], { grupo: g, seccion: it.seccion || "", bloque_id, ronda: r + 1 }));
      return;
    }
    if (!ejercicioVivo(it.ejercicio_id)) return;
    it.series.forEach(v => nueva(it.ejercicio_id, v, { grupo: g, seccion: it.seccion || "", copia: n0(it.copia) }));
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
function copiar(nombre, html, series, ambito) {
  porta = { nombre, html: html || "", items: itemsDe(series), ambito: ambito || "dia" };
  escribir("portapapeles-v1", porta);
  const n = contarSeries(porta.items);
  avisoDeshacer("📋 Copiado: " + nombre + (n ? " (" + n + (n === 1 ? " serie" : " series") + ")" : "") + ". Pégalo en el día que quieras: ⋯ del día → «📋 Pegar»", null);
}
const hayItemsCopiados = () => !!(porta && ((porta.items || []).length || porta.html));
// Pega y deja deshacerlo: todo lo nuevo se puede quitar de golpe
function pegarConDeshacer(dia, hacer) {
  const antes = new Set(Object.keys(db.series));
  hacer();
  persistir();
  rellenar();
  pintarDia(dia);
  const nuevas = Object.values(db.series).filter(x => !antes.has(x.id) && !x.borrado);
  if (!nuevas.length) { avisoDeshacer("No se ha pegado nada (¿el ejercicio copiado se ha borrado?)", null); return; }
  // Si ese ejercicio ya estaba en el mismo entreno y parte, sus series se suman a él (no sale otra tarjeta)
  const yaEstaba = nuevas.some(x => !x.bloque_id && seriesDelDia(x.fecha).some(y => !nuevas.includes(y) && y.ejercicio_id === x.ejercicio_id && !y.bloque_id && (y.grupo || "") === (x.grupo || "") && (y.seccion || "") === (x.seccion || "")));
  avisoDeshacer("Pegado: " + porta.nombre + " (" + nuevas.length + (nuevas.length === 1 ? " serie" : " series") + ")" + (yaEstaba ? " · añadidas al mismo ejercicio, que ya estaba aquí" : ""), nuevas.map(x => ["series", { ...x, borrado: true }]));
}
function pegar(dia) {
  if (!hayItemsCopiados()) return;
  pegarConDeshacer(dia, () => pegarDiaEntero(dia));
}
function pegarDiaEntero(dia) {
  if (["ejercicio", "bloque", "parte"].includes(porta.ambito)) {
    const g0 = (estructuraDia(dia.id)[0] || {}).nombre || "";
    pegarItems(dia.id, porta.ambito === "parte" ? porta.items : porta.items.map(it => ({ ...it, seccion: "" })), g0);
    return;
  }
  if (porta.html) {
    const antes = db.entrenos[dia.id]?.html || "";
    const html = antes ? antes + "<br>" + porta.html : porta.html;
    cambiar("entrenos", { ...db.entrenos[dia.id], fecha: dia.id, html, texto: aTexto(html) }, true);
  }
  pegarItems(dia.id, porta.items);
}
async function guardarPlantilla(nombreSugerido, series) {
  const nombre = await pedirNombre("Guardar como plantilla", nombreSugerido, "Si ya tienes una plantilla con este nombre, se reemplaza.");
  if (!nombre) return;
  const items = itemsDe(series).map(it => it.bloque ? { bloque: true, seccion: it.seccion || "", tramos: it.tramos } : { ejercicio_id: it.ejercicio_id, seccion: it.seccion || "", series: it.series });
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
    gruposDelDia(dia.id).length > 0 && { texto: "Cambiar nombre de un entrenamiento…", accion: () => {
      const gs = gruposDelDia(dia.id);
      if (gs.length === 1) cambiarNombreEntreno(dia,gs[0]);
      else abrirMenu("¿Qué entrenamiento quieres renombrar?", "", gs.map(g => ({ texto:g || "Entreno 1",accion:()=>cambiarNombreEntreno(dia,g) })));
    } },
    (series.length || (enEspera[dia.id] || []).length) && { texto: "📅 Mover el entrenamiento a otro día…", accion: () => elegirDiaDestino(lunesDe(deIso(dia.id)), "¿A qué día muevo el entrenamiento del " + titulo.toLowerCase() + "?", f => moverADia(dia, null, f)) },
    (series.length || aTexto(html).trim()) && { texto: "Copiar día", accion: () => copiar(titulo, html, series, "dia") },
    hayItemsCopiados() && { texto: "📋 Pegar «" + porta.nombre + "» en este día", accion: () => pegar(dia) },
    { texto: "Añadir plantilla…", accion: () => elegirPlantilla("Añadir plantilla al " + titulo, p => aplicarPlantilla(dia, p)) },
    series.filter(s => !s.bloque_id).length > 1 && { texto: "Seleccionar series para agrupar en bloque", accion: () => empezarSelSeries(dia) },
    series.length && { texto: "Guardar en una lista de entrenamientos…", accion: () => guardarEnLista(series[0].grupo || "Entrenamiento", series) },
    series.length && { texto: "Guardar ejercicios como plantilla…", accion: () => guardarPlantilla(series[0].grupo || "Entrenamiento", series) },
    series.length && { texto: "Compartir con un amigo…", accion: () => compartir(series[0].grupo || titulo, itemsDe(series)) },
    series.length && { texto: "Vaciar ejercicios del día", peligro: true, confirmar: "Pulsa otra vez: se borran " + series.length + " series", accion: () => {
      series.forEach(s => cambiar("series", { ...s, borrado: true }, true)); delete enEspera[dia.id]; guardarEspera(); persistir(); pintarDia(dia);
    } }
  ]);
}
// ---------- Partes de un entreno (opcionales): cabecera de color con su progreso y su menú ----------
function cabeceraParte(dia, grupo, p, color, nNombradas, partes, seriesItem) {
  const cab = document.createElement("div");
  cab.className = "parte-cab" + color;
  cab.dataset.parte = p.nombre;
  cab.innerHTML = '<button type="button" class="p-toggle"><span class="flecha-dia" aria-hidden="true">▸</span><span class="p-nombre"></span></button><span class="g-prog"></span><button type="button" class="menu-btn">⋯</button>';
  cab.querySelector(".p-nombre").textContent = p.nombre;
  const ss = p.ids.flatMap(seriesItem);
  cab.querySelector(".g-prog").textContent = ss.length ? ss.filter(hecha).length + "/" + ss.length : p.ids.length ? "" : "vacía";
  cab.querySelector(".menu-btn").setAttribute("aria-label", "Opciones de la parte " + p.nombre);
  cab.querySelector(".menu-btn").addEventListener("click", () => {
    const k = partes.indexOf(p);
    const mover = paso => {
      // Reordena las partes repartiendo los «orden» existentes en el nuevo orden de partes
      const orden = partes.slice();
      let j = k + paso;
      while (j >= 0 && j < orden.length && !orden[j].nombre) j += paso;   // los ejercicios sueltos se quedan en su sitio
      if (j < 0 || j >= orden.length) return;
      [orden[k], orden[j]] = [orden[j], orden[k]];
      const vacias = partesVacias[dia.id + "|" + grupo] || [];
      if (vacias.length) partesVacias[dia.id + "|" + grupo] = orden.map(x => x.nombre).filter(n => vacias.includes(n));
      guardarSesiones();
      reordenar(orden.flatMap(x => x.ids.map(id => seriesItem(id))), "Parte movida");
      pintarDia(dia);
    };
    abrirMenu(p.nombre, ss.length ? ss.length + (ss.length === 1 ? " serie" : " series") : "Parte vacía", [
      { texto: "Cambiar nombre de la parte…", accion: () => cambiarNombreParte(dia, grupo, p.nombre) },
      { texto: "+ Ejercicio en esta parte", accion: () => abrirSelector(dia, null, grupo, p.nombre) },
      ...(() => { const otros = [...dia.bloquesEl.querySelectorAll(":scope > .grupo")].map(x => x.dataset.grupo || "").filter(x => x !== grupo);
        return otros.length ? [{ texto: "Mover la parte a otro entreno…", accion: () => abrirMenu("¿A qué entreno?", "La parte «" + p.nombre + "» pasa entera, con sus ejercicios y bloques", otros.map(x => ({ texto: x || "Entreno 1", accion: () => moverParteAEntreno(dia, grupo, p.nombre, x, ss) }))) }] : []; })(),
      { texto: "+ Bloque en esta parte", accion: () => abrirBloque(dia, grupo, p.nombre) },
      partes.slice(0, k).some(x => x.nombre) && { texto: "Subir parte", accion: () => mover(-1) },
      partes.slice(k + 1).some(x => x.nombre) && { texto: "Bajar parte", accion: () => mover(1) },
      { texto: "Quitar la parte (sus ejercicios quedan sin parte)", accion: () => {
        ss.forEach(x => cambiar("series", { ...x, seccion: "" }, true));
        renombrarParteLocal(dia.id, grupo, p.nombre, "");
        persistir(); pintarDia(dia);
      } },
      ss.length && { texto: "Borrar la parte y sus ejercicios", peligro: true, confirmar: "Pulsa otra vez: se borran " + ss.length + " series", accion: () => {
        const antes = ss.map(x => ["series", { ...x }]);
        ss.forEach(x => cambiar("series", { ...x, borrado: true }, true));
        renombrarParteLocal(dia.id, grupo, p.nombre, null);
        persistir(); pintarDia(dia);
        avisoDeshacer("Parte «" + p.nombre + "» borrada", antes);
      } }
    ]);
  });
  return cab;
}
// Renombra (n), deja sin parte ("") o quita (null) una parte en lo que solo vive en este dispositivo
function renombrarParteLocal(fecha, grupo, viejo, n) {
  const k = fecha + "|" + grupo, l = (partesVacias[k] || []).filter(x => x !== viejo);
  if (n) l.push(n);
  if (l.length) partesVacias[k] = [...new Set(l)]; else delete partesVacias[k];
  Object.keys(esperaParte).forEach(e => { if (e.startsWith(fecha + "|") && (esperaGrupo[e] || "") === grupo && esperaParte[e] === viejo) { if (n) esperaParte[e] = n; else delete esperaParte[e]; } });
  Object.entries(bloquesVacios).forEach(([e,b]) => { if (e.startsWith(fecha + "|") && (b.g || "") === grupo && b.p === viejo) b.p = n || ""; });
  guardarSesiones(); guardarVacios();
}
// Con varios entrenos en el día, los botones de abajo del día preguntan a cuál (antes iba siempre al primero)
function enQueEntreno(dia, titulo, hacer) {
  const gs = [...dia.bloquesEl.querySelectorAll(":scope > .grupo")].map(x => x.dataset.grupo || "");
  if (gs.length <= 1) { hacer(gs[0] || ""); return; }
  abrirMenu(titulo, "¿En qué entreno?", gs.map(x => ({ texto: x || "Entreno 1", accion: () => hacer(x) })));
}
// Pasar un ejercicio o bloque a otro entreno del mismo día, a la parte y el sitio donde se ha soltado
function moverEntreEntrenos(dia, origen, clave, espera, destino, destParte, orden) {
  const k = dia.id + "|" + clave;
  let ids = [], nuevaClave = clave;
  const antes = [];
  if (espera) {
    if (destino) esperaGrupo[k] = destino; else delete esperaGrupo[k];
    if (destParte) esperaParte[k] = destParte; else delete esperaParte[k];
    delete esperaAntes[k];
  } else {
    const mias = seriesDeItem(dia.id, origen, clave);
    ids = mias.map(sr => sr.id);
    const parteOrig = (mias[0] || {}).seccion || "";
    // La parte de la que sale no desaparece aunque se quede vacía
    if (parteOrig) { const kv = dia.id + "|" + origen; if (!(partesVacias[kv] || []).includes(parteOrig)) (partesVacias[kv] = partesVacias[kv] || []).push(parteOrig); }
    // El mismo ejercicio ya en esa parte del otro entreno: va como otra tarjeta (copia), sin juntarse
    let copia = 0;
    if (!clave.startsWith("b:") && mias.length) {
      const ej = mias[0].ejercicio_id, mia = n0(mias[0].copia) > 1 ? n0(mias[0].copia) : 1;
      const usadas = seriesDelDia(dia.id).filter(sr => !ids.includes(sr.id) && sr.ejercicio_id === ej && !sr.bloque_id && (sr.grupo || "") === destino && (sr.seccion || "") === destParte).map(sr => n0(sr.copia) > 1 ? n0(sr.copia) : 1);
      if (usadas.includes(mia)) copia = Math.max(...usadas) + 1;
    }
    mias.forEach(sr => { antes.push(["series", { ...sr }]); cambiar("series", { ...sr, grupo: destino, seccion: destParte, ...(copia ? { copia } : {}) }, true); });
    if (ids.length) nuevaClave = claveSerie(db.series[ids[0]]);
  }
  guardarSesiones();
  // El orden en el entreno de destino, tal como ha quedado al soltar
  orden.forEach((x, j) => {
    if (!x.espera || x.propio && !espera) return;
    const ck = x.propio ? clave : x.clave, sig = orden.slice(j + 1).find(y => !y.espera || (y.propio && !espera));
    if (sig) esperaAntes[dia.id + "|" + ck] = sig.propio ? nuevaClave : sig.clave; else delete esperaAntes[dia.id + "|" + ck];
  });
  escribir("espera-antes-v1", esperaAntes);
  const listas = orden.filter(x => x.propio ? !espera : !x.espera).map(x => x.propio ? ids.map(i => db.series[i]).filter(Boolean) : seriesDeItem(dia.id, destino, x.clave));
  sinHistorial = false;
  reordenar(listas, "");
  persistir();
  pintarDia(dia);
  avisoDeshacer("Movido al entreno «" + (destino || "Entreno 1") + "»", antes.length ? antes : null);
}
// Pasar una parte entera (con sus ejercicios, bloques y bloques vacíos) a otro entreno del día
function moverParteAEntreno(dia, origen, parte, destino, seriesParte) {
  const antes = seriesParte.map(sr => ["series", { ...sr }]);
  seriesParte.forEach(sr => {
    let extra = {};
    if (!sr.bloque_id) {
      const mia = n0(sr.copia) > 1 ? n0(sr.copia) : 1;
      const usadas = seriesDelDia(dia.id).filter(x => !seriesParte.includes(x) && x.ejercicio_id === sr.ejercicio_id && !x.bloque_id && (x.grupo || "") === destino && (x.seccion || "") === parte).map(x => n0(x.copia) > 1 ? n0(x.copia) : 1);
      if (usadas.includes(mia)) extra = { copia: Math.max(...usadas) + 1 };
    }
    cambiar("series", { ...sr, grupo: destino, ...extra }, true);
  });
  Object.keys(esperaParte).forEach(k => { if (k.startsWith(dia.id + "|") && esperaParte[k] === parte && (esperaGrupo[k] || "") === origen) { if (destino) esperaGrupo[k] = destino; else delete esperaGrupo[k]; } });
  Object.keys(bloquesVacios).forEach(k => { if (k.startsWith(dia.id + "|") && (bloquesVacios[k].p || "") === parte && (bloquesVacios[k].g || "") === origen) bloquesVacios[k] = { ...bloquesVacios[k], g: destino }; });
  const ko = dia.id + "|" + origen, kd = dia.id + "|" + destino;
  if ((partesVacias[ko] || []).includes(parte)) { partesVacias[ko] = partesVacias[ko].filter(x => x !== parte); if (!partesVacias[ko].length) delete partesVacias[ko]; }
  if (!seriesParte.length && !(partesVacias[kd] || []).includes(parte)) (partesVacias[kd] = partesVacias[kd] || []).push(parte);
  guardarSesiones(); guardarVacios(); persistir();
  pintarDia(dia);
  avisoDeshacer("Parte «" + parte + "» movida al entreno «" + (destino || "Entreno 1") + "»", antes.length ? antes : null);
}
// «+ Parte»: Calentamiento, Parte principal, Vuelta a la calma… (o el nombre que quieras)
async function nuevaParte(dia, grupo) {
  const hay = nombresPartes(dia.id, grupo).filter(Boolean);
  const sug = ["Calentamiento", "Parte principal", "Vuelta a la calma"].find(x => !hay.includes(x)) || "Parte " + (hay.length + 1);
  const n = await pedirNombre("Nombre de la parte", sug, "Por ejemplo «Calentamiento», «Parte principal», «Fuerza», «Series» o «Vuelta a la calma». Cada parte tiene su color y sus botones para añadir.");
  if (!n) return;
  if (!hay.includes(n)) { const k = dia.id + "|" + grupo; (partesVacias[k] = partesVacias[k] || []).push(n); guardarSesiones(); }
  if (dia.col.classList.contains("plegado")) plegarDia(dia);
  pintarDia(dia);
}
// Cambia la parte de un ejercicio o bloque (sin repintar)
function ponerParte(dia, grupo, clave, espera, x) {
  const antes = espera ? esperaParte[dia.id + "|" + clave] || "" : (seriesDeItem(dia.id, grupo, clave)[0] || {}).seccion || "";
  // La parte que se queda sin nada no desaparece: queda vacía para poder volver a llenarla
  if (antes && antes !== x) { const k = dia.id + "|" + grupo; if (!(partesVacias[k] || []).includes(antes)) (partesVacias[k] = partesVacias[k] || []).push(antes); guardarSesiones(); }
  if (espera) { if (x) esperaParte[dia.id + "|" + clave] = x; else delete esperaParte[dia.id + "|" + clave]; guardarSesiones(); }
  else {
    // Si en esa parte ya está el mismo ejercicio, este pasa como otra tarjeta (copia) en vez de juntarse con él
    let copia;
    if (!clave.startsWith("b:")) {
      const ej = ejDeClave(clave), mias = seriesDeItem(dia.id, grupo, clave);
      const usadas = seriesDelDia(dia.id).filter(sr => !mias.includes(sr) && sr.ejercicio_id === ej && !sr.bloque_id && (sr.grupo || "") === grupo && (sr.seccion || "") === x).map(sr => n0(sr.copia) > 1 ? n0(sr.copia) : 1);
      const mia = mias.length && n0(mias[0].copia) > 1 ? n0(mias[0].copia) : 1;
      if (usadas.includes(mia)) copia = Math.max(...usadas) + 1;
    }
    seriesDeItem(dia.id, grupo, clave).forEach(sr => cambiar("series", { ...sr, seccion: x, ...(copia ? { copia } : {}) }, true)); persistir();
  }
}
// Pasar un ejercicio o bloque a otra parte del mismo entreno
function moverAParte(dia, grupo, clave, espera) {
  const actual = espera ? esperaParte[dia.id + "|" + clave] || "" : (seriesDeItem(dia.id, grupo, clave)[0] || {}).seccion || "";
  const destinos = nombresPartes(dia.id, grupo).concat(actual ? [""] : []).filter((x, i, a) => x !== actual && a.indexOf(x) === i);
  abrirMenu("¿A qué parte?", "", destinos.map(x => ({ texto: x || "Sin parte", accion: () => {
    ponerParte(dia, grupo, clave, espera, x);
    pintarDia(dia);
  } })));
}
// «+ Entreno»: otro entreno el mismo día (por ejemplo, si doblas), separado y con sus propios ejercicios
// «+ Entreno»: uno vacío (con nombre) o uno guardado en una de tus listas
function elegirNuevoEntreno(dia) {
  const ls = vivos("listas").filter(l => entrenosDeLista(l).length);
  if (!ls.length) { nuevoEntreno(dia); return; }
  abrirMenu("+ Entreno en el " + NOMBRES[dia.i].toLowerCase(), "", [
    { texto: "Entreno vacío (le pones nombre)…", accion: () => nuevoEntreno(dia) },
    ...ls.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map(l => ({ texto: "Desde la lista «" + l.nombre + "»…", accion: () => elegirDeLista(l, (p, k) => ponerEnDia(l, p, k, dia.id)) }))
  ]);
}
async function nuevoEntreno(dia) {
  const existentes = [...new Set(seriesDelDia(dia.id).map(s => s.grupo || "").concat(sesionesVacias[dia.id] || []))];
  const n = await pedirNombre("Nombre del nuevo entreno", existentes.length ? "Entreno " + (existentes.length + 1) : "Entreno 2", "Por ejemplo «Mañana», «Tarde», «Carrera» o «Gimnasio». Tendrá sus propios ejercicios y bloques.");
  if (!n) return;
  if (!existentes.includes(n)) { (sesionesVacias[dia.id] = sesionesVacias[dia.id] || []).push(n); guardarSesiones(); }
  if (dia.col.classList.contains("plegado")) plegarDia(dia);
  pintarDia(dia);
  const caja = dia.bloquesEl.querySelector('.grupo[data-grupo="' + CSS.escape(n) + '"]');
  if (caja) caja.scrollIntoView({ block: "center", behavior: "smooth" });
}
// Pasar un entreno (o todo el día si grupo es null) a otro día: sus series, los ejercicios aún sin series y sus partes vacías
function moverADia(dia, grupo, f) {
  if (f === dia.id) return;
  const ss = seriesDelDia(dia.id).filter(x => grupo === null || (x.grupo || "") === grupo);
  const antes = ss.map(x => ["series", { ...x }]);
  ss.forEach(x => cambiar("series", { ...x, fecha: f }, true));
  const vale = g => grupo === null || g === grupo;
  // Lo que vive fuera de las series: ejercicios sin series, entrenos y partes vacías, descripciones, letras y posiciones
  (enEspera[dia.id] || []).filter(id => vale(esperaGrupo[dia.id + "|" + id] || "")).forEach(id => {
    (enEspera[f] = enEspera[f] || []).includes(id) || enEspera[f].push(id);
    ["esperaGrupo", "esperaParte", "esperaNota", "esperaLetra", "esperaAntes"].forEach(n => {
      const o = { esperaGrupo, esperaParte, esperaNota, esperaLetra, esperaAntes }[n], k = dia.id + "|" + id;
      if (o[k] !== undefined) { o[f + "|" + id] = o[k]; delete o[k]; }
    });
    quitarEspera(dia.id, id);
  });
  (sesionesVacias[dia.id] || []).filter(vale).forEach(n => { (sesionesVacias[f] = sesionesVacias[f] || []).includes(n) || sesionesVacias[f].push(n); });
  if (sesionesVacias[dia.id]) { sesionesVacias[dia.id] = sesionesVacias[dia.id].filter(n => !vale(n)); if (!sesionesVacias[dia.id].length) delete sesionesVacias[dia.id]; }
  Object.keys(partesVacias).filter(k => k.startsWith(dia.id + "|") && vale(k.slice(dia.id.length + 1))).forEach(k => {
    const nk = f + k.slice(dia.id.length); partesVacias[nk] = [...new Set((partesVacias[nk] || []).concat(partesVacias[k]))]; delete partesVacias[k];
  });
  guardarEspera(); guardarSesiones(); escribir("espera-nota-v1", esperaNota); escribir("espera-letra-v1", esperaLetra); escribir("espera-antes-v1", esperaAntes);
  persistir();
  irADia(f);
  avisoDeshacer((grupo === null ? "Entrenamiento" : "«" + (grupo || "Entreno 1") + "»") + " movido al " + NOMBRES[(deIso(f).getDay() + 6) % 7].toLowerCase() + " " + fmt(deIso(f)), antes.length ? antes : null);
}
// Juntar dos entrenos del mismo día en uno («Pecho + Pierna»): primero los del primero y detrás los del segundo.
// Partes con el mismo nombre se juntan; el mismo ejercicio en la misma parte queda como otra tarjeta (no se mezcla)
const esNombreCalentamiento = nombre => /calent|warm[\s-]*up/i.test(nombre || "");
function esSerieCalentamiento(s) {
  const nombre = nombreEj(s.ejercicio_id);
  return esNombreCalentamiento(s.seccion) || esNombreCalentamiento(nombre) ||
    (!!s.calentamiento && !/vuelta.*calma|cool[\s-]*down/i.test(nombre + " " + (s.seccion || "")));
}
function tieneCalentamiento(fecha, grupo) {
  return seriesDelDia(fecha).some(s => (s.grupo || "") === grupo && esSerieCalentamiento(s)) ||
    (partesVacias[fecha + "|" + grupo] || []).some(esNombreCalentamiento) ||
    (enEspera[fecha] || []).some(id => (esperaGrupo[fecha + "|" + id] || "") === grupo &&
      (esNombreCalentamiento(esperaParte[fecha + "|" + id]) || esNombreCalentamiento(nombreEj(ejDeClave(id))))) ||
    Object.entries(bloquesVacios).some(([k, b]) => k.startsWith(fecha + "|") && (b.g || "") === grupo && esNombreCalentamiento(b.p));
}
function fusionarEntrenos(dia, primero, segundo, nombre, separarCalentamientos) {
  nombre = (nombre || "").trim();
  if (!nombre || primero === segundo) return false;
  const fecha = dia.id, delDia = seriesDelDia(fecha), deUno = g => g === primero || g === segundo;
  const otros = new Set(delDia.map(s => s.grupo || "").concat(sesionesVacias[fecha] || []));
  Object.keys(partesVacias).filter(k => k.startsWith(fecha + "|")).forEach(k => otros.add(k.slice(fecha.length + 1)));
  (enEspera[fecha] || []).forEach(id => otros.add(esperaGrupo[fecha + "|" + id] || ""));
  Object.entries(bloquesVacios).filter(([k]) => k.startsWith(fecha + "|")).forEach(([, b]) => otros.add(b.g || ""));
  if (otros.has(nombre) && !deUno(nombre)) { avisoDeshacer("Ya hay otro entreno con ese nombre. Elige un nombre diferente."); return false; }
  const filas = [primero, segundo].flatMap(g => delDia.filter(s => (s.grupo || "") === g).sort((a, b) => n0(a.orden) - n0(b.orden)));
  const antes = filas.map(s => ["series", { ...s }]);
  const mapas = { partesVacias, esperaGrupo, esperaParte, esperaAntes, bloquesVacios, gruposPlegados };
  const copia = x => JSON.parse(JSON.stringify(x));
  const meta = Object.fromEntries(Object.entries(mapas).map(([n, m]) => [n, copia(Object.fromEntries(Object.entries(m).filter(([k]) => k.startsWith(fecha + "|"))))]));
  const sesionesAntes = copia(sesionesVacias[fecha] || []);
  const destinoParte = (g, sec, calentamiento = esNombreCalentamiento(sec)) => !calentamiento ? sec || "" :
    separarCalentamientos ? (sec || "Calentamiento") + " · " + (g || "Entreno 1") : "Calentamiento";
  const usadas = new Map(), copias = new Map(), bloques = new Map(), claves = new Map();
  const bloquesPrimero = new Set(filas.filter(s => (s.grupo || "") === primero && s.bloque_id).map(s => s.bloque_id));
  filas.forEach((s, orden) => {
    const g = s.grupo || "";
    const calentamiento = s.bloque_id ? esNombreCalentamiento(s.seccion) || filas.filter(x => (x.grupo || "") === g && x.bloque_id === s.bloque_id).every(esSerieCalentamiento) : esSerieCalentamiento(s);
    const sec = destinoParte(g, s.seccion || "", calentamiento);
    let extra = {};
    if (s.bloque_id) {
      const k = g + "\0" + s.bloque_id;
      if (!bloques.has(k)) bloques.set(k, g === segundo && bloquesPrimero.has(s.bloque_id) ? nuevoId() : s.bloque_id);
      extra.bloque_id = bloques.get(k);
    } else {
      const k = s.ejercicio_id + "\0" + sec, origen = g + "\0" + claveSerie(s);
      if (!usadas.has(k)) usadas.set(k, new Set());
      if (!copias.has(origen)) {
        let n = Math.max(1, n0(s.copia));
        while (usadas.get(k).has(n)) n++;
        usadas.get(k).add(n); copias.set(origen, n);
      }
      extra.copia = copias.get(origen);
    }
    const nueva = { ...s, ...extra, grupo: nombre, seccion: sec, orden: orden + 1 };
    claves.set(g + "\0" + claveSerie(s), claveSerie(nueva));
    cambiar("series", nueva, true);
  });
  // Reasignar la parte antes de cambiar el grupo de los ejercicios pendientes.
  (enEspera[fecha] || []).forEach(id => {
    const k = fecha + "|" + id, g = esperaGrupo[k] || "";
    if (!deUno(g)) return;
    const sec = esperaParte[k] || "";
    esperaParte[k] = destinoParte(g, sec, esNombreCalentamiento(sec) || esNombreCalentamiento(nombreEj(ejDeClave(id))));
    if (esperaAntes[k]) esperaAntes[k] = claves.get(g + "\0" + esperaAntes[k]) || esperaAntes[k];
    esperaGrupo[k] = nombre;
  });
  const partes = [...new Set([primero, segundo].flatMap(g => (partesVacias[fecha + "|" + g] || []).map(sec => destinoParte(g, sec))))];
  delete partesVacias[fecha + "|" + primero]; delete partesVacias[fecha + "|" + segundo];
  if (partes.length) partesVacias[fecha + "|" + nombre] = partes;
  sesionesVacias[fecha] = [...new Set((sesionesVacias[fecha] || []).filter(g => !deUno(g)).concat(nombre))];
  Object.entries(bloquesVacios).forEach(([k, b]) => {
    if (k.startsWith(fecha + "|") && deUno(b.g || "")) bloquesVacios[k] = { ...b, g: nombre, p: destinoParte(b.g || "", b.p || "") };
  });
  delete gruposPlegados[fecha + "|" + primero]; delete gruposPlegados[fecha + "|" + segundo];
  gruposPlegados[fecha + "|" + nombre] = 0;
  const guardar = () => { guardarEspera(); guardarSesiones(); guardarVacios(); escribir("espera-antes-v1", esperaAntes); escribir("grupos-plegados-v1", gruposPlegados); persistir(); };
  guardar(); pintarDia(dia);
  avisoDeshacer("Entrenos fusionados en «" + nombre + "» · Deshacer", antes);
  // Deshacer restaura también partes vacías y ejercicios pendientes de este día.
  deshacerSug = () => {
    antes.forEach(([t, s]) => cambiar(t, { ...s }, true));
    Object.entries(mapas).forEach(([n, m]) => {
      Object.keys(m).filter(k => k.startsWith(fecha + "|")).forEach(k => delete m[k]);
      Object.assign(m, copia(meta[n]));
    });
    if (sesionesAntes.length) sesionesVacias[fecha] = sesionesAntes; else delete sesionesVacias[fecha];
    guardar(); pintarDia(dia);
  };
  return true;
}
function gruposDelDia(fecha) {
  return [...new Set(seriesDelDia(fecha).map(s => s.grupo || "")
    .concat(sesionesVacias[fecha] || [])
    .concat((enEspera[fecha] || []).map(id => esperaGrupo[fecha + "|" + id] || ""))
    .concat(Object.entries(bloquesVacios).filter(([k]) => k.startsWith(fecha + "|")).map(([,b]) => b.g || "")))];
}
async function cambiarNombreEntreno(dia, grupo) {
  const fecha = dia.id, ctx = contextoSesion();
  const nombre = await pedirNombre("Nombre del entrenamiento", grupo, "Solo cambia el nombre de este entrenamiento del día. Se conservan sus partes, series y progreso.");
  try { comprobarSesion(ctx); } catch { return; }
  if (!nombre || nombre === grupo) return;
  if (dia.id !== fecha || !gruposDelDia(fecha).includes(grupo)) { setEstado("El entrenamiento ha cambiado. Abre su menú de nuevo.", true); return; }
  if (gruposDelDia(fecha).some(g => g !== grupo && norm(g) === norm(nombre))) { setEstado("Ya hay un entrenamiento con ese nombre en este día. Elige otro para mantenerlos separados.", true); return; }
  const partes = nombresPartes(fecha, grupo), viejo = fecha + "|" + grupo, nuevo = fecha + "|" + nombre;
  seriesDelDia(fecha).filter(s => (s.grupo || "") === grupo).forEach(s => cambiar("series", { ...s, grupo: nombre }, true));
  sesionesVacias[fecha] = (sesionesVacias[fecha] || []).map(g => g === grupo ? nombre : g);
  (enEspera[fecha] || []).forEach(id => { const k = fecha + "|" + id; if ((esperaGrupo[k] || "") === grupo) esperaGrupo[k] = nombre; });
  if (partesVacias[viejo]) { partesVacias[nuevo] = partesVacias[viejo]; delete partesVacias[viejo]; }
  Object.entries(bloquesVacios).forEach(([k,b]) => { if (k.startsWith(fecha + "|") && (b.g || "") === grupo) b.g = nombre; });
  if (Object.hasOwn(gruposPlegados, viejo)) { gruposPlegados[nuevo] = gruposPlegados[viejo]; delete gruposPlegados[viejo]; }
  partes.forEach(p => {
    const a = "p|" + viejo + "|" + p, b = "p|" + nuevo + "|" + p;
    if (Object.hasOwn(gruposPlegados,a)) { gruposPlegados[b] = gruposPlegados[a]; delete gruposPlegados[a]; }
  });
  if (ent?.dia.id === fecha && ent.grupo === grupo) ent.grupo = nombre;
  guardarSesiones(); guardarVacios(); escribir("grupos-plegados-v1", gruposPlegados); persistir(); pintarDia(dia);
  setEstado("Entrenamiento renombrado: " + nombre);
}
async function cambiarNombreParte(dia, grupo, parte) {
  const fecha = dia.id, ctx = contextoSesion();
  const nombre = await pedirNombre("Nombre de la parte", parte, "Se conservarán todos los ejercicios y series de esta parte.");
  try { comprobarSesion(ctx); } catch { return; }
  if (!nombre || nombre === parte) return;
  if (dia.id !== fecha) { setEstado("El día ha cambiado. Abre la parte de nuevo.",true); return; }
  const nombres = nombresPartes(fecha,grupo).concat((enEspera[fecha] || []).filter(id => (esperaGrupo[fecha+"|"+id] || "") === grupo).map(id => esperaParte[fecha+"|"+id] || ""));
  if (!nombres.includes(parte)) { setEstado("La parte ha cambiado. Abre su menú de nuevo.",true); return; }
  if (nombres.some(p => p !== parte && norm(p) === norm(nombre))) { setEstado("Ya existe esa parte en este entrenamiento. Elige otro nombre.",true); return; }
  seriesDelDia(fecha).filter(s => (s.grupo || "") === grupo && (s.seccion || "") === parte).forEach(s => cambiar("series",{ ...s,seccion:nombre },true));
  renombrarParteLocal(fecha,grupo,parte,nombre);
  const a = "p|"+fecha+"|"+grupo+"|"+parte, b = "p|"+fecha+"|"+grupo+"|"+nombre;
  if (Object.hasOwn(gruposPlegados,a)) { gruposPlegados[b]=gruposPlegados[a]; delete gruposPlegados[a]; }
  escribir("grupos-plegados-v1",gruposPlegados); persistir(); pintarDia(dia);
  setEstado("Parte renombrada: " + nombre);
}

function menuGrupo(dia, grupo) {
  const series = seriesDelDia(dia.id).filter(s => (s.grupo || "") === grupo);
  const nGrupos = new Set(seriesDelDia(dia.id).map(s => s.grupo || "")).size;
  abrirMenu(grupo || "Entrenamiento", resumenItems(itemsDe(series)), [
    { texto: "Cambiar nombre del entrenamiento…", accion: () => cambiarNombreEntreno(dia, grupo) },
    series.length && { texto: series.every(hecha) ? "✓ Completado · Ver entrenamiento" : "▶ Iniciar solo este entrenamiento", accion: () => empezarEntreno(dia, grupo) },
    { texto: "📅 Mover a otro día…", accion: () => elegirDiaDestino(lunesDe(deIso(dia.id)), "¿A qué día muevo «" + (grupo || "Entreno 1") + "»?", f => moverADia(dia, grupo, f)) },
    ...(() => { const otros = [...dia.bloquesEl.querySelectorAll(":scope > .grupo")].map(x => x.dataset.grupo || "").filter(x => x !== grupo);
      return otros.length ? [{ texto: "🔗 Fusionar con otro entreno del día…", accion: () => abrirMenu("¿Con qué entreno lo junto?", "«" + (grupo || "Entreno 1") + "» va primero y el otro detrás, en un solo entreno", otros.map(x => ({ texto: x || "Entreno 1", accion: async () => {
        const hayCal1 = tieneCalentamiento(dia.id, grupo);
        const hayCal2 = tieneCalentamiento(dia.id, x);
        const nombrar = async separar => {
          const n = await pedirNombre("Nombre del entreno fusionado", (grupo || "Entreno 1") + " + " + (x || "Entreno 1"), "Por ejemplo «Pecho + Pierna». Sus ejercicios, bloques y partes pasan a ser un solo entreno.");
          if (n) fusionarEntrenos(dia, grupo, x, n, separar);
        };
        if (hayCal1 && hayCal2) abrirMenu("¿Qué hacemos con los calentamientos?", "Puedes juntarlos en una sola sección o conservarlos separados dentro del entreno fusionado.", [
          { texto: "Unir los calentamientos", accion: () => nombrar(false) },
          { texto: "Mantenerlos separados", accion: () => nombrar(true) }
        ]);
        else nombrar(false);
      } }))) }] : []; })(),
    nGrupos > 1 && { texto: "Subir sesión", accion: () => moverGrupo(dia.id, grupo, -1) },
    nGrupos > 1 && { texto: "Bajar sesión", accion: () => moverGrupo(dia.id, grupo, 1) },
    series.filter(s => !s.bloque_id).length > 1 && { texto: "Seleccionar series para agrupar en bloque", accion: () => empezarSelSeries(dia) },
    series.length && { texto: "Copiar entreno", accion: () => copiar(grupo || "Entreno 1", "", series, "entreno") },
    series.length && { texto: "Guardar en una lista de entrenamientos…", accion: () => guardarEnLista(grupo || "Entrenamiento", series) },
    { texto: "Guardar como plantilla…", accion: () => guardarPlantilla(grupo, series) },
    { texto: "Compartir con un amigo…", accion: () => compartir(grupo, itemsDe(series)) },
    { texto: "Quitar este entreno del día", peligro: true, confirmar: series.length ? "Pulsa otra vez: se borran " + series.length + " series" : "Pulsa otra vez para quitarlo", accion: () => {
      series.forEach(s => cambiar("series", { ...s, borrado: true }, true));
      sesionesVacias[dia.id] = (sesionesVacias[dia.id] || []).filter(x => x !== grupo);
      if (!sesionesVacias[dia.id].length) delete sesionesVacias[dia.id];
      (enEspera[dia.id] || []).filter(id => (esperaGrupo[dia.id + "|" + id] || "") === grupo).forEach(id => { quitarEspera(dia.id, id); delete esperaGrupo[dia.id + "|" + id]; delete esperaParte[dia.id + "|" + id]; });
      // Sus partes vacías también (si no, el entreno seguía apareciendo vacío, «0/0»)
      delete partesVacias[dia.id + "|" + grupo];
      guardarEspera(); guardarSesiones(); persistir(); pintarDia(dia);
    } }
  ]);
}

// ---------- Compartir con amigos: un código (o enlace) que otro usuario añade a su calendario ----------
const URL_APP = "https://spider-test.github.io/fuerza-y-ritmo/";
const nuevoCodigo = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
// Los ejercicios viajan por nombre y tipo, porque cada usuario tiene los suyos
const paraCompartir = items => items.map(it => it.bloque
  ? { bloque: true, seccion: it.seccion || "", tramos: (it.tramos || []).map(t => ({ ejercicio: nombreEj(t.ejercicio_id), tipo: tipoDe(t.ejercicio_id), series: t.series })) }
  : { ejercicio: nombreEj(it.ejercicio_id), tipo: tipoDe(it.ejercicio_id), seccion: it.seccion || "", series: it.series });
function idPorNombre(nombre, tipo) {
  const e = vivos("ejercicios").find(x => compacto(x.nombre) === compacto(nombre));
  return e ? e.id : crearEjercicio(nombre, tipo);
}
const desdeCompartido = items => items.map(it => it.bloque
  ? { bloque: true, seccion: it.seccion || "", tramos: it.tramos.map(t => ({ ejercicio_id: idPorNombre(t.ejercicio, t.tipo), series: t.series })) }
  : { ejercicio_id: idPorNombre(it.ejercicio, it.tipo), seccion: it.seccion || "", series: it.series });
function copiarTexto(t, que) {
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => avisoDeshacer("📋 " + (que || "Copiado") + ": " + t, null), () => avisoDeshacer((que || "Copia esto") + ": " + t, null));
}
async function compartir(nombre, items, crudo) {
  const codigo = nuevoCodigo();
  try {
    const r = await api("/rest/v1/compartidos", { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ codigo, user_id: sesion.user_id, autor: "", nombre, items: crudo ? items : paraCompartir(items) }) });
    if (!r.ok) throw new Error();
  } catch { setEstado("No se ha podido compartir. Necesitas conexión.", true); return; }
  const enlace = URL_APP + "#c=" + codigo;
  const caja = document.createElement("div");
  caja.className = "codigo-comp";
  caja.innerHTML = '<span class="cc-et">Código</span><span class="cc-cod"></span><button type="button" class="anadir">Copiar código</button>';
  caja.querySelector(".cc-cod").textContent = codigo;
  caja.querySelector("button").addEventListener("click", () => copiarTexto(codigo, "Código copiado"));
  abrirMenu("Compartir «" + nombre + "»", "Tu amigo puede abrir el enlace o pegar el código en Plan → Añadir algo compartido (también en otra cuenta tuya).", [
    { texto: "Copiar enlace", mantener: true, accion: () => copiarTexto(enlace, "Enlace copiado") },
    navigator.share && { texto: "Enviar…", mantener: true, accion: () => navigator.share({ title: nombre, text: "Entrenamiento «" + nombre + "» para Fuerza y Ritmo. Código: " + codigo, url: enlace }).catch(() => {}) }
  ], caja);
}
function compartidoValido(c) {
  const objeto = x => x && typeof x === "object" && !Array.isArray(x);
  const texto = x => x == null || typeof x === "string";
  let total = 0;
  const serie = x => objeto(x) && texto(x.nota) && ++total <= 20000;
  const ejercicio = x => objeto(x) && typeof x.ejercicio === "string" && texto(x.tipo) && Array.isArray(x.series) && x.series.every(serie);
  const items = xs => Array.isArray(xs) && xs.length <= 5000 && xs.every(x => objeto(x) && texto(x.seccion) && (x.bloque ? Array.isArray(x.tramos) && x.tramos.length <= 5000 && x.tramos.every(ejercicio) : ejercicio(x)));
  const plantillas = ps => Array.isArray(ps) && ps.length <= 5000 && ps.every(p => objeto(p) && typeof p.nombre === "string" && items(p.items));
  if (!objeto(c) || typeof c.nombre !== "string" || !Array.isArray(c.items) || c.items.length > 5000) return false;
  const x = c.items[0];
  if (x?.paquete || x?.mesociclo) {
    if (c.items.length !== 1 || !plantillas(x.plantillas)) return false;
    if (x.mesociclo) {
      const m = x.mesociclo;
      if (!objeto(m) || !objeto(m.dias) || !texto(m.notas)) return false;
      const dia = ids => Array.isArray(ids) && ids.length <= 5000 && ids.every(i => Number.isInteger(i) && i >= 0 && i < x.plantillas.length);
      const semana = d => objeto(d) && Object.keys(d).filter(k => /^\d$/.test(k)).every(k => dia(d[k]));
      if (!semana(m.dias) || !Object.keys(m.dias).filter(k => /^s\d+$/.test(k)).every(k => semana(m.dias[k]))) return false;
    }
    return true;
  }
  return items(c.items);
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
  if (!compartidoValido(c)) { setEstado("El contenido compartido no tiene un formato válido.", true); return; }
  // Varias plantillas juntas: vista previa y guardarlas (o añadirlas a un día)
  if (c.items[0] && c.items[0].paquete) {
    const x = c.items[0], lunesP = lunesVista();
    const vista = document.createElement("div");
    x.plantillas.forEach(p => vista.appendChild(desplegableItems(p.nombre, p.items)));
    abrirMenu("«" + c.nombre + "»", "Compartido por " + (c.autor || "un amigo") + ". Solo lo estás viendo: toca cada plantilla para ver sus ejercicios. No se añade nada hasta que tú quieras.",
      [{ texto: "+ Añadir a mi rutina…", accion: () => abrirMenu("¿Cómo lo añado?", "«" + c.nombre + "»", [
        { texto: "Guardar en mis plantillas", accion: () => guardarPaqueteCompartido(c) },
        { texto: "Ponerlas en un día…", accion: () => elegirDiaDestino(lunesP, "¿En qué día pongo «" + c.nombre + "»?", f => {
          x.plantillas.forEach(p => pegarItems(f, desdeCompartido(p.items), p.nombre)); persistir(); irADia(f, "«" + c.nombre + "» añadido");
        }) }
      ]) }, { texto: "Solo mirar (cerrar)", accion: () => {} }], vista);
    return;
  }
  // Un mesociclo entero: vista previa y guardarlo con sus plantillas
  if (c.items[0] && c.items[0].mesociclo) {
    const x = c.items[0], mm = x.mesociclo;
    abrirMenu("Mesociclo «" + c.nombre + "»", "Compartido por " + (c.autor || "un amigo") + " · " + n0(mm.semanas) + " semanas" + (n0(mm.progresion) ? " · +" + num(mm.progresion) + " kg/semana" : "") +
      ". Solo lo estás viendo: toca cada día para ver sus ejercicios. Si lo añades, se guarda en tus plantillas y mesociclos y después eliges cuándo empieza.",
      [{ texto: "+ Añadir a mis mesociclos", accion: () => guardarMesoCompartido(c) }, { texto: "Solo mirar (cerrar)", accion: () => {} }], vistaMesoCompartido(x));
    return;
  }
  // Un entrenamiento: primero solo se ve; «Añadir a mi rutina» deja elegir día o guardarlo como plantilla
  const lunes = lunesVista();
  abrirMenu("«" + c.nombre + "»", "Compartido por " + (c.autor || "un amigo") + " · " + contarSeries(c.items) + " series. Solo lo estás viendo: no se añade nada hasta que tú quieras.",
    [{ texto: "+ Añadir a mi rutina…", accion: () => abrirMenu("¿Cómo lo añado?", "«" + c.nombre + "»", [
      { texto: "Ponerlo en un día…", accion: () => elegirDiaDestino(lunes, "¿En qué día pongo «" + c.nombre + "»?", f => {
        pegarItems(f, desdeCompartido(c.items), c.nombre); persistir(); irADia(f, "«" + c.nombre + "» añadido");
      }) },
      { texto: "Guardar como plantilla", accion: () => {
        cambiar("plantillas", { id: nuevoId(), nombre: c.nombre, items: desdeCompartido(c.items), borrado: false }); pintarPlan(); setEstado("Plantilla «" + c.nombre + "» guardada");
      } }
    ]) }, { texto: "Solo mirar (cerrar)", accion: () => {} }], desplegableItems("Ejercicios", c.items, true));
}
// Elegir un día de una semana (con ‹ y › para cambiar de semana)
function elegirDiaDestino(lunes, titulo, alElegir) {
  const hoyIso = iso(new Date());
  abrirMenu(titulo, "Semana del " + fmt(lunes) + " al " + fmt(sumarDias(lunes, 6)), [
    { texto: "‹ Semana anterior", accion: () => elegirDiaDestino(sumarDias(lunes, -7), titulo, alElegir) },
    ...NOMBRES.map((n, i) => { const f = iso(sumarDias(lunes, i)); return { texto: n + " " + fmt(sumarDias(lunes, i)) + (f === hoyIso ? " · hoy" : ""), accion: () => alElegir(f) }; }),
    { texto: "Semana siguiente ›", accion: () => elegirDiaDestino(sumarDias(lunes, 7), titulo, alElegir) }
  ]);
}
// Lleva la semana al día donde se ha añadido algo
function irADia(f, aviso) {
  desplazamiento = Math.round((lunesDe(deIso(f)) - lunesDe(new Date())) / 6048e5);
  verPestana("semana");
  pintarSemana();
  if (aviso) setEstado(aviso);
}

// ---------- Ejercicios de cada día ----------
let repintarLuego = false;
const escribiendoSerie = () => document.activeElement && document.activeElement.closest && document.activeElement.closest(".bloques");
let arrastreActivo = false;   // mientras se arrastra con ≡, la sincronización no repinta el día
function pintarBloques(forzar) {
  if (arrastreActivo || (!forzar && escribiendoSerie())) { repintarLuego = true; return; }
  repintarLuego = false;
  dias.forEach(pintarDia);
  pintarProgresoSemana();
}
// Último ejercicio o bloque tocado (para mantenerlo quieto en pantalla al repintar)
let ultimoTocado = null;
document.addEventListener("pointerdown", ev => { const b = ev.target.closest && ev.target.closest(".bloque[data-clave]"); const d = b && b.closest(".dia"); if (b && d) ultimoTocado = { clave: b.dataset.clave, dia: d.dataset.fecha || [...document.querySelectorAll(".dia")].indexOf(d) }; }, true);
function anclaVista() {
  if (!ultimoTocado || $("vistaSemana").hidden) return null;
  const el = buscarTocado();
  if (!el || !el.querySelector("form.nueva-serie:not([hidden])")) return null;
  const top = el.getBoundingClientRect().top;
  return top > -200 && top < innerHeight ? { top } : null;
}
function buscarTocado() {
  const ds = [...document.querySelectorAll(".dia")];
  const d = typeof ultimoTocado.dia === "number" ? ds[ultimoTocado.dia] : ds.find(x => x.dataset.fecha === ultimoTocado.dia);
  return d ? d.querySelector('.bloque[data-clave="' + CSS.escape(ultimoTocado.clave) + '"]') : null;
}
function recolocar(ancla) {
  const el = buscarTocado();
  if (!el) return;
  const dif = el.getBoundingClientRect().top - ancla.top;
  if (Math.abs(dif) > 2) scrollBy(0, dif);
}
$("semana").addEventListener("focusout", () => setTimeout(() => { if (repintarLuego && !escribiendoSerie()) pintarBloques(); }, 0));

function quitarEspera(fecha, id) {
  if (!enEspera[fecha]) return;
  enEspera[fecha] = enEspera[fecha].filter(x => x !== id);
  if (!enEspera[fecha].length) delete enEspera[fecha];
  guardarEspera();
}

// Agrupa los ejercicios del día por sesión («Pierna», «Pecho»…); los sueltos van sin título
// Que la pantalla no salte al repintar un día: el ejercicio que estabas tocando se queda donde estaba
function pintarDia(dia) {
  const ancla = anclaVista();
  pintarDiaSinAncla(dia);
  if (ancla) recolocar(ancla);
}
// «＋ Añadir»: los botones de añadir (ejercicio, bloque, parte, entreno) se pliegan en uno solo y se despliegan al
// tocarlo; se vuelven a plegar al elegir o al tocar fuera. Donde aún no hay nada salen ya desplegados
function plegarAdd(fila, abierta) {
  if (!fila) return;
  if (!fila.querySelector(":scope > .add-toggle")) {
    const t = document.createElement("button");
    t.type = "button"; t.className = "add-toggle"; t.textContent = "＋ Añadir";
    t.addEventListener("click", e => { e.stopPropagation(); ponerAdd(fila, true); const b = fila.querySelector(".add-ej"); if (b) b.focus({ preventScroll: true }); });
    fila.prepend(t);
    fila.addEventListener("click", e => { if (e.target.closest(".add-ej") && !fila.dataset.fija) setTimeout(() => ponerAdd(fila, false), 0); });
  }
  fila.dataset.fija = abierta ? "1" : "";
  ponerAdd(fila, !!abierta);
}
function ponerAdd(fila, abierta) {
  fila.classList.toggle("plegada", !abierta);
  const t = fila.querySelector(":scope > .add-toggle");
  if (t) { t.setAttribute("aria-expanded", String(abierta)); t.hidden = abierta; }
}
document.addEventListener("pointerdown", e => {
  document.querySelectorAll(".add-fila:not(.plegada)").forEach(f => { if (!f.dataset.fija && f.querySelector(":scope > .add-toggle") && !f.contains(e.target)) ponerAdd(f, false); });
}, true);
function pintarDiaSinAncla(dia) {
  const cont = dia.bloquesEl;
  cont.textContent = "";
  const delDia = seriesDelDia(dia.id);
  const grupos = [];
  const grupo = nombre => grupos.find(g => g.nombre === nombre) || grupos[grupos.push({ nombre, ids: [] }) - 1];
  // Cada elemento de una sesión es un ejercicio suelto o un bloque ("b:" + id), en el orden en que aparecen
  delDia.forEach(s => { const g = grupo(s.grupo || ""), k = claveSerie(s); if (!g.ids.includes(k)) g.ids.push(k); });
  // Entrenos creados con «+ Entreno» que aún no tienen series
  (sesionesVacias[dia.id] || []).forEach(n => grupo(n));
  // …y los entrenos que solo tienen partes vacías (p. ej. «Calentamiento» recién creado en un día sin nada)
  Object.keys(partesVacias).forEach(k => { if (k.startsWith(dia.id + "|")) grupo(k.slice(dia.id.length + 1)); });
  // Los ejercicios aún sin series van a su entreno, donde se dejaron (antes de otro elemento) o, si no, al final
  (enEspera[dia.id] || []).forEach(id => {
    const gn = esperaGrupo[dia.id + "|" + id] || "";
    if (!ejercicioVivo(ejDeClave(id)) || grupos.some(g => g.nombre === gn && g.ids.includes(id))) return;
    const g = grupo(gn), antes = esperaAntes[dia.id + "|" + id], i = antes ? g.ids.indexOf(antes) : -1;
    if (i >= 0) g.ids.splice(i, 0, id); else g.ids.push(id);
  });
  plegarAdd(dia.col.querySelector(".dia-cuerpo-in > .add-fila"), !grupos.length && !Object.keys(bloquesVacios).some(k => k.startsWith(dia.id + "|")));
  Object.keys(bloquesVacios).forEach(k => {
    if (!k.startsWith(dia.id + "|")) return;
    const bv = bloquesVacios[k], g = grupo(bv.g || "");
    g.ids.push("v:" + k.slice(dia.id.length + 1));
  });
  // Cada sesión va en su propio contenedor para poder moverla entera
  const conAsa = grupos.filter(g => g.nombre).length > 1 && grupos.length > 1;
  const varios = grupos.length > 1;   // varios entrenos el mismo día: cada uno en su caja, con su cabecera y sus botones
  dia.col.classList.toggle("varios-entrenos", varios);
  grupos.forEach(g => {
    const caja = document.createElement("div");
    caja.className = "grupo";
    caja.dataset.grupo = g.nombre;
    { // También el entrenamiento sin nombre tiene cabecera y menú para renombrarlo.
      const cab = document.createElement("div");
      cab.className = "grupo-cab";
      cab.innerHTML = true   // cualquier entreno con cabecera se puede plegar (también si es el único del día)
        ? '<button type="button" class="g-nombre g-toggle"><span class="flecha-dia" aria-hidden="true">▸</span><span class="gn-txt"></span><span class="g-res"></span></button><span class="g-prog"></span><button type="button" class="menu-btn">⋯</button>'
        : '<span class="g-nombre"><span class="gn-txt"></span></span><span class="g-prog"></span><button type="button" class="menu-btn">⋯</button>';
      cab.querySelector(".gn-txt").textContent = g.nombre || "Entreno 1";
      const deG = delDia.filter(s => (s.grupo || "") === g.nombre);
      {   // plegar o desplegar el entreno tocando su nombre
        // Varios entrenos en el día: cada uno se pliega o despliega tocando su nombre (se recuerda en este dispositivo)
        const clavePl = dia.id + "|" + g.nombre, tg = cab.querySelector(".g-toggle");
        const nombres = [...new Set(g.ids.map(id => id.startsWith("b:") || id.startsWith("v:") ? "Bloque" : nombreEj(ejDeClave(id))).filter(Boolean))];
        cab.querySelector(".g-res").textContent = nombres.slice(0, 3).join(", ") + (nombres.length > 3 ? "…" : "");
        const ponerPl = pl => { caja.classList.toggle("g-plegado", pl); tg.setAttribute("aria-expanded", String(!pl)); };
        ponerPl(gruposPlegados[clavePl] !== 0);
        tg.addEventListener("click", () => {
          const pl = !caja.classList.contains("g-plegado");
          gruposPlegados[clavePl] = pl ? 1 : 0;
          escribir("grupos-plegados-v1", gruposPlegados);
          ponerPl(pl);
        });
      }
      cab.querySelector(".g-prog").textContent = deG.filter(hecha).length + "/" + deG.length;
      cab.querySelector(".menu-btn").setAttribute("aria-label", "Opciones del entreno " + (g.nombre || "1"));
      cab.querySelector(".menu-btn").addEventListener("click", () => menuGrupo(dia, g.nombre));
      if (conAsa) cab.appendChild(asaArrastre(caja, () => [...cont.querySelectorAll(":scope > .grupo")], n => reordenar(n.map(x => seriesDeGrupo(dia.id, x.dataset.grupo)), "Sesión movida"), "Sesión " + g.nombre));
      caja.appendChild(cab);
    }
    const filasGrupo = delDia.filter(s => (s.grupo || "") === g.nombre);
    const iniciar = document.createElement("button");
    iniciar.type = "button"; iniciar.className = "grupo-iniciar";
    const completado = filasGrupo.length > 0 && filasGrupo.every(hecha);
    iniciar.textContent = !filasGrupo.length ? "Añade series para empezar este entrenamiento" : completado ?
      "✓ Completado · Ver entrenamiento" : (filasGrupo.some(hecha) ? "▶ Seguir" : "▶ Empezar") + " este entrenamiento";
    iniciar.disabled = !filasGrupo.length;
    iniciar.setAttribute("aria-label", (completado ? "Ver entrenamiento completado: " : "Iniciar solo ") + (g.nombre || "Entreno 1"));
    iniciar.addEventListener("click", () => empezarEntreno(dia, g.nombre));
    caja.appendChild(iniciar);
    // Partes opcionales del entreno (Calentamiento, Parte principal…): si no hay ninguna, todo va seguido como siempre
    const seriesItem = id => id.startsWith("b:") ? delDia.filter(s => s.bloque_id === id.slice(2)) : delDia.filter(s => claveSerie(s) === id && (s.grupo || "") === g.nombre);
    const parteDe = id => { if (id.startsWith("v:")) return (bloquesVacios[dia.id + "|" + id.slice(2)] || {}).p || ""; const ss = seriesItem(id); return ss.length ? ss[0].seccion || "" : esperaParte[dia.id + "|" + id] || ""; };
    // Cada parte con nombre va junta donde aparece su primer ejercicio; los sueltos (sin parte) se quedan en su sitio:
    // arriba, entre partes o debajo de la última
    const partes = [], parteDeNombre = n => partes.find(p => p.nombre && p.nombre === n) || partes[partes.push({ nombre: n, ids: [] }) - 1];
    g.ids.forEach(id => {
      const n = parteDe(id), u = partes[partes.length - 1];
      if (n) parteDeNombre(n).ids.push(id);
      else if (u && !u.nombre) u.ids.push(id);
      else partes.push({ nombre: "", ids: [id] });
    });
    (partesVacias[dia.id + "|" + g.nombre] || []).forEach(n => parteDeNombre(n));
    const conNombre = partes.filter(p => p.nombre);
    // Letras como en las hojas de entrenamiento: cada parte empieza una letra nueva (A, B…) y dentro de ella
    // un ejercicio o bloque puede empezar otra (C1, C2… para una superserie aparte); la numeración sigue la letra
    let letraN = -1, numN = 0;
    const letraNuevaDe = id => { const ss = seriesItem(id); return ss.length ? ss.some(x => x.letra_nueva) : !!esperaLetra[dia.id + "|" + id]; };
    partes.forEach(p => {
      const color = p.nombre ? " parte-c" + (conNombre.indexOf(p) % 5) : "";
      // Cada parte con nombre es una caja de su color, desplegable, con sus ejercicios dentro
      let dest = caja;
      if (p.nombre) {
        dest = document.createElement("div");
        dest.className = "parte-caja" + color;
        dest.dataset.parte = p.nombre;
        const cabP = cabeceraParte(dia, g.nombre, p, color, conNombre.length, partes, seriesItem);
        dest.appendChild(cabP);
        caja.appendChild(dest);
        const claveP = "p|" + dia.id + "|" + g.nombre + "|" + p.nombre, tg = cabP.querySelector(".p-toggle");
        const ponerP = pl => { dest.classList.toggle("p-plegada", pl); tg.setAttribute("aria-expanded", String(!pl)); };
        ponerP(gruposPlegados[claveP] !== 0);
        tg.addEventListener("click", () => {
          const pl = !dest.classList.contains("p-plegada");
          gruposPlegados[claveP] = pl ? 1 : 0;
          escribir("grupos-plegados-v1", gruposPlegados);
          ponerP(pl);
        });
      }
      if (p.nombre) { letraN++; numN = 0; }
      const porLetra = [];   // [{ letra, els: [...] }] para agrupar B1, B2… en su desplegable
      p.ids.forEach((id, k) => {
        const el = id.startsWith("v:") ? tarjetaBloqueVacio(dia, id.slice(2)) : id.startsWith("b:") ? tarjetaBloque(dia, id.slice(2), seriesItem(id)) : bloque(dia, ejDeClave(id), seriesItem(id), g.nombre, p.nombre, copiaDeClave(id));
        if (!id.startsWith("v:")) el.dataset.clave = id;   // el vacío no se arrastra: se le arrastran ejercicios encima
        if (p.nombre) {
          const nueva = k > 0 && letraNuevaDe(id);
          if (nueva) { letraN++; numN = 0; }
          numN++;
          el.dataset.letraNueva = nueva ? "1" : "";
          el.dataset.puedeLetra = k > 0 ? "1" : "";
          const et = document.createElement("span");
          et.className = "etq-orden"; et.textContent = String.fromCharCode(65 + (letraN % 26)) + numN;
          const tit = el.querySelector(":scope > .bloque-cab .br-tit, :scope > .bloque-cab .ej-nombre");
          if (tit) {
            // En un bloque basta con «A3 ×2»
            if (tit.classList.contains("br-tit")) tit.textContent = tit.textContent.replace(/^×(\d+) rondas/, "×$1");
            tit.prepend(et);
          }
        }
        if (p.nombre) el.className += " en-parte" + color;
        el.dataset.parte = p.nombre;
        if (p.nombre) {
          const L = String.fromCharCode(65 + (letraN % 26));
          if (!porLetra.length || porLetra[porLetra.length - 1].letra !== L) porLetra.push({ letra: L, items: [] });
          porLetra[porLetra.length - 1].items.push({ el, id });
        }
        dest.appendChild(el);
      });
      // Con dos letras o más en la parte, cada letra (B1, B2… / C1, C2…) va en su propio desplegable
      if (porLetra.length > 1) porLetra.forEach(({ letra, items }) => {
        const lc = document.createElement("div");
        lc.className = "letra-caja";
        lc.dataset.letra = letra;
        const ss = items.flatMap(x => seriesItem(x.id));
        const nombres = items.map(x => x.id.startsWith("b:") || x.id.startsWith("v:") ? "Bloque" : nombreEj(ejDeClave(x.id)));
        const cabL = document.createElement("button");
        cabL.type = "button"; cabL.className = "letra-cab";
        cabL.innerHTML = '<span class="flecha-dia" aria-hidden="true">▸</span><span class="etq-orden"></span><span class="l-nombres"></span><span class="g-prog"></span>';
        cabL.querySelector(".etq-orden").textContent = letra;
        cabL.querySelector(".l-nombres").textContent = nombres.join(" + ");
        cabL.setAttribute("aria-label", "Bloque " + letra + ": " + nombres.join(" + ") + (ss.length ? ". " + ss.filter(hecha).length + " de " + ss.length + " series completadas" : ""));
        cabL.querySelector(".g-prog").textContent = ss.length ? ss.filter(hecha).length + "/" + ss.length : "";
        items[0].el.before(lc);
        lc.appendChild(cabL);
        items.forEach(x => lc.appendChild(x.el));
        const claveL = "l|" + dia.id + "|" + g.nombre + "|" + p.nombre + "|" + letra;
        const ponerL = pl => { lc.classList.toggle("l-plegada", pl); cabL.setAttribute("aria-expanded", String(!pl)); };
        ponerL(gruposPlegados[claveL] !== 0);
        cabL.addEventListener("click", () => {
          const pl = !lc.classList.contains("l-plegada");
          gruposPlegados[claveL] = pl ? 1 : 0;
          escribir("grupos-plegados-v1", gruposPlegados);
          ponerL(pl);
        });
      });
      if (p.nombre) {
        const add = document.createElement("div");
        add.className = "add-fila add-parte" + color;
        add.innerHTML = '<button type="button" class="add-ej">+ Ejercicio</button><button type="button" class="add-ej">+ Bloque</button>';
        add.children[0].setAttribute("aria-label", "Añadir un ejercicio a " + p.nombre);
        add.children[1].setAttribute("aria-label", "Añadir un bloque a " + p.nombre);
        add.children[0].addEventListener("click", () => abrirSelector(dia, null, g.nombre, p.nombre));
        add.children[1].addEventListener("click", () => abrirBloque(dia, g.nombre, p.nombre));
        plegarAdd(add, !p.ids.length);   // parte vacía: las opciones ya a la vista
        dest.appendChild(add);
      }
    });
    // Ejercicios (también los que aún no tienen series) y bloques se mueven dentro de la sesión, en un único orden
    const movibles = () => [...caja.querySelectorAll(":scope > .bloque[data-clave], :scope > .parte-caja > .bloque[data-clave], :scope > .parte-caja > .letra-caja > .bloque[data-clave]")];
    const soltar = (n, movido, destParte, destGrupo) => {
      if (movido && destGrupo !== undefined && destGrupo !== g.nombre) {
        moverEntreEntrenos(dia, g.nombre, movido.dataset.clave, !!movido.dataset.espera, destGrupo, destParte || "", n.map(x => ({ clave: x.dataset.clave, espera: !!x.dataset.espera, propio: x === movido })));
        return;
      }
      // Las series de cada elemento se toman antes de cambiar de parte (su clave cambia) y se releen al final
      const idsDe = n.filter(x => !x.dataset.espera).map(x => seriesDeItem(dia.id, g.nombre, x.dataset.clave).map(sr => sr.id));
      // Si al arrastrar queda entre los ejercicios de otra parte, pasa a esa parte (la del de encima o, si es el primero, la del de debajo)
      // Solo cambia de parte si queda rodeado por otra (entre dos ejercicios de ella); en un borde conserva la suya,
      // así un ejercicio suelto puede quedar debajo de la última parte
      if (movido && destParte !== undefined) {
        // Arrastre con hueco: la parte es la del sitio donde se ha soltado (o suelto, entre partes)
        if (destParte !== (movido.dataset.parte || "")) ponerParte(dia, g.nombre, movido.dataset.clave, !!movido.dataset.espera, destParte);
      } else if (movido && caja.querySelector(":scope > .parte-caja")) {
        const i = n.indexOf(movido), propia = movido.dataset.parte || "";
        const pa = n[i - 1] ? n[i - 1].dataset.parte || "" : null, pb = n[i + 1] ? n[i + 1].dataset.parte || "" : null;
        const dest = pa !== null && pb !== null && pa !== propia && pb !== propia ? pa : propia;
        if (dest !== propia) ponerParte(dia, g.nombre, movido.dataset.clave, !!movido.dataset.espera, dest);
      }
      // Los que aún no tienen series recuerdan delante de qué quedan; los demás reparten su «orden»
      n.forEach((x, k) => {
        if (!x.dataset.espera) return;
        const sig = n.slice(k + 1).find(y => !y.dataset.espera);
        if (sig) esperaAntes[dia.id + "|" + x.dataset.clave] = sig.dataset.clave; else delete esperaAntes[dia.id + "|" + x.dataset.clave];
      });
      escribir("espera-antes-v1", esperaAntes);
      // El orden entre los que aún no tienen series sale de su lista: se guarda tal como han quedado
      const ordenEsp = n.filter(x => x.dataset.espera).map(x => x.dataset.clave);
      if (ordenEsp.length > 1 && enEspera[dia.id]) { enEspera[dia.id] = ordenEsp.concat(enEspera[dia.id].filter(x => !ordenEsp.includes(x))); guardarEspera(); }
      reordenar(idsDe.map(l => l.map(i => db.series[i]).filter(Boolean)), "Ejercicio movido");
      pintarBloques(true);
    };
    const mover = (el, paso) => {
      const l = movibles(), i = l.indexOf(el), j = i + paso;
      if (i < 0 || j < 0 || j >= l.length) return;
      [l[i], l[j]] = [l[j], l[i]];
      soltar(l);
    };
    const otrasSesiones = [...new Set(grupos.map(x => x.nombre))].filter(x => x !== g.nombre);
    movibles().forEach(el => {
      const clave = el.dataset.clave, ej = ejDeClave(clave), nombre = clave.startsWith("b:") ? "Bloque" : nombreEj(ej), espera = !!el.dataset.espera;
      // Arrastrar encima de la cabecera de una parte lo mete en ella, al final
      const zonasParte = { lista: () => [...caja.querySelectorAll(":scope > .parte-caja > .parte-cab")].filter(z => z.dataset.parte !== (el.dataset.parte || ""))
          .concat(clave.startsWith("b:") ? [] : [...caja.querySelectorAll(".bloque-rep > .bloque-cab")]), alSoltar: z => {
        // Soltado encima del título de un bloque: el ejercicio entra en él (una serie suya por ronda)
        if (z.closest(".bloque-vacio")) {
          const sueltas = espera ? [] : seriesDeItem(dia.id, g.nombre, clave).slice().sort((a, b) => a.orden - b.orden);
          if (espera) quitarEspera(dia.id, clave);
          meterEnVacio(dia, z.closest(".bloque-vacio").dataset.vacio, ej, sueltas);
          return;
        }
        if (z.closest(".bloque-rep")) {
          const bs = seriesDelDia(dia.id).filter(s => s.bloque_id === z.closest(".bloque-rep").dataset.clave.slice(2));
          const sueltas = espera ? [] : seriesDeItem(dia.id, g.nombre, clave).slice().sort((a, b) => a.orden - b.orden);
          if (espera) quitarEspera(dia.id, clave);
          meterEnBloque(dia, bs, ej, sueltas);
          return;
        }
        const dest = z.dataset.parte, l = movibles().filter(x => x !== el);
        let k = -1; l.forEach((x, j) => { if ((x.dataset.parte || "") === dest) k = j; });
        l.splice(k < 0 ? l.length : k + 1, 0, el);   // parte vacía: da igual dónde, se pinta dentro de ella
        ponerParte(dia, g.nombre, clave, espera, dest);
        soltar(l);
        setEstado((clave.startsWith("b:") ? "Bloque" : nombre) + " movido a «" + dest + "»");
      } };
      if (movibles().length > 1 || zonasParte.lista().length || otrasSesiones.length) el.querySelector(".bloque-cab").appendChild(asaArrastreDia(el, caja, movibles, soltar, nombre, zonasParte));
      if (clave.startsWith("b:")) return;
      const m = document.createElement("button");
      m.type = "button"; m.className = "menu-btn"; m.textContent = "⋯";
      m.setAttribute("aria-label", "Opciones de " + nombre);
      m.addEventListener("click", () => abrirMenu(nombre, "", [
        el.dataset.puedeLetra && { texto: el.dataset.letraNueva ? "Seguir con la letra anterior" : "Empezar letra nueva aquí (" + String.fromCharCode(el.querySelector(".etq-orden").textContent.charCodeAt(0) + 1) + "1)", accion: () => ponerLetraNueva(dia, g.nombre, clave, espera, !el.dataset.letraNueva) },
        // Editar, la descripción (se toca), subir, bajar y cambiar de parte ya se hacen tocando o con el asa ≡
        !(espera ? esperaNota[dia.id + "|" + clave] : notaDe(seriesDeItem(dia.id, g.nombre, clave))) && { texto: "+ Descripción (tempo, banda, EEP…)", accion: () => editarNota(dia, espera ? [] : seriesDeItem(dia.id, g.nombre, clave), "Descripción de " + nombre, clave) },
        // A otro entreno del día no se puede arrastrar (cada entreno es su caja): esto sí se queda
        !espera && otrasSesiones.length && { texto: "Mover a otro entreno del día…", accion: () => abrirMenu("¿A qué entreno?", "", otrasSesiones.map(x => ({
          texto: x || "Sin sesión", accion: () => moverASesion(seriesDeItem(dia.id, g.nombre, clave), x) }))) },
        { texto: "Ver ficha del ejercicio", accion: () => abrirDetalle(ej) },
        !espera && tipoDe(ej) === "carrera" && { texto: "Marcar como carrera (competición)…", accion: () => marcarComoCarrera(dia, seriesDeItem(dia.id, g.nombre, clave), g.nombre || nombre) },
        { texto: "Eliminar ejercicio" + (espera ? "" : " y sus series"), peligro: true, confirmar: espera ? "Pulsa otra vez para quitarlo" : "Pulsa otra vez: se borran " + seriesDeItem(dia.id, g.nombre, clave).length + " series", accion: () => {
          // Quita el ejercicio de esta sesión con todas sus series (hechas incluidas); se puede deshacer
          const del = espera ? [] : seriesDeItem(dia.id, g.nombre, clave);
          del.forEach(x => cambiar("series", { ...x, borrado: true }, true));
          quitarEspera(dia.id, clave);
          persistir();
          pintarDia(dia);
          avisoDeshacer(nombre + " eliminado" + (del.length ? " (" + del.length + " series)" : ""), del.length ? del.map(x => ["series", { ...x }]) : null);
        } }
      ]));
      const asa = el.querySelector(".bloque-cab .asa");
      if (asa) asa.before(m); else el.querySelector(".bloque-cab").appendChild(m);
    });
    const pie = pieTotal(delDia.filter(s => (s.grupo || "") === g.nombre));
    if (pie) caja.appendChild(pie);
    if (varios) {
      // Añadir directamente a este entreno
      const add = document.createElement("div");
      add.className = "add-fila add-grupo";
      add.innerHTML = '<button type="button" class="add-ej">+ Ejercicio</button><button type="button" class="add-ej">+ Bloque</button><button type="button" class="add-ej">+ Parte</button>';
      add.children[2].addEventListener("click", () => nuevaParte(dia, g.nombre));
      add.children[0].setAttribute("aria-label", "Añadir un ejercicio a " + (g.nombre || "Entreno 1"));
      add.children[1].setAttribute("aria-label", "Añadir un bloque a " + (g.nombre || "Entreno 1"));
      add.children[0].addEventListener("click", () => abrirSelector(dia, null, g.nombre));
      add.children[1].addEventListener("click", () => abrirBloque(dia, g.nombre));
      plegarAdd(add, !g.ids.length);
      caja.appendChild(add);
    }
    cont.appendChild(caja);
  });
  // Si la carrera (o la natación) está repartida en varias sesiones, además el total del día de ese deporte
  const repetidos = ["carrera", "natacion"].filter(t => grupos.filter(g => delDia.some(s => (s.grupo || "") === g.nombre && tipoDe(s.ejercicio_id) === t)).length > 1);
  const pieDia = repetidos.length && pieTotal(delDia.filter(s => repetidos.includes(tipoDe(s.ejercicio_id))), true);
  if (pieDia) cont.appendChild(pieDia);
  pintarRpe(dia);
  pintarCabDia(dia);
  if (selSeries) pintarSelSeries();
}

function etiquetaTipo(tipo) {
  const t = document.createElement("span");
  t.className = "tipo-tag t-" + tipo;
  t.textContent = TIPOS[tipo].nombre;
  return t;
}

function bloque(dia, id, series, grupo, parte, copia) {
  const idK = copia > 1 ? id + "#" + copia : id;   // clave de esta tarjeta (el mismo ejercicio puede ir dos veces)
  const ej = db.ejercicios[id], tipo = tipoDe(id), dist = esDistancia(tipo), mov = tipo === "movilidad";
  const historia = seriesDe(id);
  const prs = prsEj(id);
  let editando = null;   // serie planificada que se está completando
  const b = document.createElement("div");
  b.className = "bloque t-" + tipo;
  b.dataset.ej = idK;
  b.dataset.clave = idK;
  if (!series.length) b.dataset.espera = "1";
  b.dataset.grupo = grupo;
  b.innerHTML = '<div class="bloque-cab"><button type="button" class="ej-nombre"></button><button type="button" class="quitar" aria-label="Quitar ejercicio">✕</button></div>' +
    '<ol class="series"></ol>' +
    '<form class="nueva-serie">' +
      '<div class="ns-fila ns-principal"><label class="veces-l veces-izq" title="Cuántas series iguales"><input class="veces" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="Cuántas series iguales" autocomplete="off" enterkeyhint="next"><span class="vz-et">series</span></label><span class="x-series">×</span>' + (dist
        ? '<button type="button" class="modo-dist" aria-label="Cambiar entre metros y tiempo">m</button>' + paso('<input class="in-a" inputmode="decimal" placeholder="' + UD() + '" aria-label="Distancia en ' + UD() + '" autocomplete="off" enterkeyhint="next">') +
          paso('<input class="in-b" inputmode="decimal" placeholder="tiempo 3,40" aria-label="Tiempo (minutos y segundos)" autocomplete="off" enterkeyhint="next">')
        : mov ? paso('<input class="in-a" inputmode="numeric" pattern="[0-9]*" placeholder="reps" aria-label="Repeticiones (opcional si pones tiempo)" autocomplete="off" enterkeyhint="next">') +
          '<span class="por">o</span>' + paso('<input class="in-b" inputmode="decimal" placeholder="tiempo 45 s" aria-label="Tiempo: 45 son segundos, 2 min o 1,30" autocomplete="off" enterkeyhint="next">')
        : paso('<input class="in-b" inputmode="numeric" placeholder="reps" aria-label="Repeticiones (o «máx»)" autocomplete="off" enterkeyhint="next">') +
          '<span class="kg-par">(</span>' + paso('<input class="in-a" inputmode="decimal" placeholder="peso" aria-label="Peso en kg" autocomplete="off" enterkeyhint="next">') + '<button type="button" class="modo" aria-label="Cambiar entre kg y % del 1RM">kg</button><span class="kg-par">)</span>') +
      '</div>' + (dist ? '<div class="ns-extra"><span class="calc"></span></div>' : mov ? '<div class="ns-extra"><label class="lado-op"><input type="checkbox" class="por-lado"> Por lado (izq. y der.)</label></div>' : '<div class="ns-extra"><span class="calc"></span><span class="ops-fuerza"><button type="button" class="medida-btn" aria-label="Cómo se mide la serie">Reps ▾</button><label class="lado-op"><input type="checkbox" class="por-lado"> Por lado</label></span><span class="seg-medida" role="group" aria-label="Cómo se mide la serie" hidden><button type="button" data-m="reps">Reps</button><button type="button" data-m="t">⏱ Tiempo</button><button type="button" data-m="maxr">Máx. reps</button><button type="button" data-m="maxt">Máx. tiempo</button><input type="checkbox" class="es-max" hidden><input type="checkbox" class="por-t" hidden></span><label class="bilbo-op" hidden><input type="checkbox" class="es-bilbo"> <span></span></label></div>') +
      '<div class="ns-fila ns-desc"><input class="in-c" inputmode="decimal" placeholder="⏱ descanso" title="Descanso tras la serie: 1,30 (minutos), 90 (segundos) o 300 m" aria-label="Descanso o recuperación después de la serie: 1,30, 90 o 300 m" autocomplete="off" enterkeyhint="done">' +
      '<button type="button" class="cancelar-form" aria-label="Cancelar: dejarlo como estaba">Cancelar</button><button class="anadir ok">OK</button></div>' +
      '<button type="button" class="enlace cambiar-ej-btn" hidden>⇄ Cambiar ejercicio</button><label class="cambiar-ej" hidden>Ejercicio <select class="otro-ej" aria-label="Cambiar el ejercicio (se mantienen las series)"></select></label>' +
      '<button type="button" class="enlace desmarcar" hidden>↺ Marcar como pendiente</button>' +
    '</form>';
  // Las carreras importadas representan calentamiento, series y vuelta a la calma como tarjetas
  // separadas. Se pliega cada tarjeta sin cambiar el comportamiento del botón que edita su nombre.
  if (tipo === "carrera") {
    const cab = b.querySelector(".bloque-cab");
    const plegar = document.createElement("button");
    const clave = [dia.id, grupo || "", parte || "", idK].join("|");
    const ponerPlegada = plegada => {
      b.classList.toggle("carrera-plegada", plegada);
      plegar.setAttribute("aria-expanded", String(!plegada));
      plegar.setAttribute("aria-label", (plegada ? "Desplegar " : "Plegar ") + (ej.nombre || "parte de carrera"));
    };
    plegar.type = "button";
    plegar.className = "bloque-toggle";
    plegar.innerHTML = '<span class="flecha-dia" aria-hidden="true">▸</span>';
    ponerPlegada(carrerasPlegadas[clave] === 1);
    plegar.addEventListener("click", ev => {
      ev.stopPropagation();
      const plegada = !b.classList.contains("carrera-plegada");
      carrerasPlegadas[clave] = plegada ? 1 : 0;
      escribir("carrera-plegado-v1", carrerasPlegadas);
      ponerPlegada(plegada);
    });
    cab.prepend(plegar);
  }
  const nom = b.querySelector(".ej-nombre");
  nom.textContent = (ej.nombre || "Sin nombre") + (copia > 1 && !parte ? " (" + copia + ")" : "");
  nom.appendChild(etiquetaTipo(tipo));
  if (ej.video_url) {
    // «▶ vídeo» despliega el vídeo debajo del nombre, sin salir del día
    const v = document.createElement("span");
    v.className = "ico ver-video"; v.textContent = "▶ vídeo";
    v.setAttribute("role", "button");
    v.setAttribute("aria-label", "Ver el vídeo de " + (ej.nombre || "este ejercicio"));
    v.addEventListener("click", ev => { ev.stopPropagation(); verVideo(ej); });
    nom.appendChild(v);
  }
  const dolor = molestiasDe(id);
  if (dolor.length) { const m = document.createElement("span"); m.className = "molestia-tag"; m.textContent = "⚠ " + dolor.map(x => x.zona).join(", "); m.title = dolor.map(x => x.zona + (x.descripcion ? ": " + x.descripcion : "")).join(" · "); nom.appendChild(m); }
  nom.setAttribute("aria-label", series.length ? "Editar " + (ej.nombre || "ejercicio") + ": valores, número de series o ejercicio" : "Ver " + (ej.nombre || "ejercicio") + ": vídeo, récords e historial");
  // Con series: tocar el nombre abre (o cierra sin guardar) la edición del ejercicio; sin series, su ficha
  nom.addEventListener("click", () => !series.length ? abrirDetalle(id) : formEl.hidden ? abrirGrupo() : (delete borradores[dia.id + "|" + (grupo || "") + "|" + idK + "|" + (parte || "")], pintarBloques(true)));
  const notaB = notaDe(series) || (!series.length ? esperaNota[dia.id + "|" + idK] || "" : "");
  const pedirNotaB = () => editarNota(dia, series, "Descripción de " + (ej.nombre || "el ejercicio"), id);
  if (notaB) b.querySelector(".bloque-cab").after(lineaNota(notaB, pedirNotaB));
  else {
    // «+ Descripción» a la vista dentro del formulario, para ponerla al crear el ejercicio
    const bn = document.createElement("button");
    bn.type = "button"; bn.className = "enlace mas-nota"; bn.textContent = "+ Descripción (tempo, banda, EEP…)";
    bn.addEventListener("click", ev => { ev.stopPropagation(); pedirNotaB(); });
    b.querySelector(".nueva-serie").appendChild(bn);
  }
  const quitar = b.querySelector(".quitar");
  if (series.length) quitar.remove();
  else quitar.addEventListener("click", () => { quitarEspera(dia.id, idK); pintarDia(dia); });
  // Con series apuntadas, el ejercicio queda limpio como un bloque: progreso en la cabecera y el formulario plegado
  // hasta pulsar «+ Serie» o tocar una serie para editarla
  const formEl = b.querySelector("form.nueva-serie");
  if (series.length) {
    const prog = document.createElement("span");
    prog.className = "g-prog";
    prog.textContent = series.filter(hecha).length + "/" + series.length;
    nom.after(prog);
    const efect = series.filter(x => !x.calentamiento), textos = new Set(efect.map(x => serieTexto({ ...x, hecha: false, tiempo: dist ? 0 : x.tiempo })));
    if (efect.length && textos.size === 1) {
      const r = document.createElement("span");
      r.className = "ej-resumen";
      // Fuerza: «3 × 10 (100 kg)», como se suele apuntar (series × repeticiones y el peso)
      const e0 = efect[0], kg0 = pesoMostrado(e0);
      r.textContent = tipo === "fuerza" && n0(e0.reps) > 0 && !(n0(e0.tiempo) > 0) && !e0.pct && !e0.ciclo_id
        ? efect.length + " × " + n0(e0.reps) + (kg0 > 0 ? " (" + num(kg0) + " kg)" : "") + (e0.por_lado ? " por lado" : "")
        : [...textos][0] + " · ×" + efect.length;
      prog.before(r);
    }
    formEl.hidden = true;
  }
  // El formulario tiene tres usos: «grupo» (×N series iguales y OK, también para editarlas todas), «una» (+ Serie suelta) y «editar» (una serie)
  let modoForm = "grupo";
  const vecesEl = b.querySelector(".veces"), cambiarEl = b.querySelector(".cambiar-ej"), otroEj = b.querySelector(".otro-ej");
  b.querySelector(".cambiar-ej-btn").addEventListener("click", ev => { ev.currentTarget.hidden = true; cambiarEl.hidden = false; otroEj.focus(); });
  const ponerModoForm = m => {
    modoForm = m;
    b.querySelector(".veces-izq").hidden = m !== "grupo";
    if (m !== "grupo" && extrasEl) extrasEl.textContent = "";
    cambiarEl.hidden = true;
    const ce = b.querySelector(".cambiar-ej-btn"); if (ce) ce.hidden = !(m === "grupo" && series.length);
    if (m !== "editar") boton.textContent = m === "grupo" ? "OK" : "+ Añadir serie";
    boton.setAttribute("aria-label", m === "grupo" ? (series.length ? "OK: guardar los cambios en las series" : "OK: crear las series") : m === "una" ? "Añadir una serie suelta" : "Guardar la serie");
    if (m !== "editar") { editando = null; b.querySelector(".desmarcar").hidden = true; ol.querySelectorAll("li").forEach(x => x.classList.remove("editando")); }
    else delete borradores[dia.id + "|" + (grupo || "") + "|" + idK + "|" + (parte || "")];   // editar una serie concreta descarta el borrador
  };
  const abrirForm = () => { formEl.hidden = false; const m = b.querySelector(".mas-serie"); if (m) m.hidden = true; };
  function abrirGrupo() {
    abrirForm();
    ponerModoForm("grupo");
    const efect = series.filter(x => !x.calentamiento), ref = efect.find(x => !hecha(x)) || efect[efect.length - 1] || series[0];
    if (ref) rellenarCon(efect[0] || ref, true);
    vecesEl.value = efect.length || 1;
    pintarFilas(efect.map(x => ({ r: enTiempo() ? segTxt(x.tiempo) : esRango(x) && !hecha(x) ? rangoTxt(x) : (n0(x.reps) || ""), kg: n0(x.pct) > 0 && !x.ciclo_id ? num(x.pct) : (pesoMostrado(x) > 0 ? num(pesoMostrado(x)) : ""), hecha: hecha(x) })));
    otroEj.textContent = "";
    vivos("ejercicios").filter(e => tipoDe(e.id) === tipo).sort((x, y) => x.nombre.localeCompare(y.nombre, "es")).forEach(e => otroEj.add(new Option(e.nombre, e.id, e.id === id, e.id === id)));
    fa.focus();
    tomarFoto();
  }
  b.abrirEdicion = abrirGrupo;
  // ---- Filas por serie (solo fuerza) ----
  let extrasEl = null;
  function pintarFilas(valores) {
    if (!extrasEl) return;
    const n = modoForm === "grupo" ? Math.min(50, Math.max(1, parseInt(vecesEl.value, 10) || 1)) : 1;
    const previas = [...extrasEl.children].map(row => ({ r: row.querySelector(".r-reps").value, kg: row.querySelector(".r-kg").value, auto: row.hasAttribute("data-auto"), hecha: row.dataset.hecha }));
    extrasEl.textContent = "";
    b.querySelector(".ns-principal").classList.toggle("con-num", n > 1);
    for (let k = 1; k < n; k++) {
      const p = valores ? valores[k] : previas[k - 1];
      const val = p || { r: fb.value, kg: fa.value, auto: true };
      const row = document.createElement("div");
      row.className = "fila-x";
      row.innerHTML = '<span class="fx-n"></span><input class="r-reps" autocomplete="off"><span class="fx-u"></span><input class="r-kg" inputmode="decimal" autocomplete="off"><span class="fx-u fx-kg"></span>';
      row.querySelector(".fx-n").textContent = k + 1;
      const ir = row.querySelector(".r-reps"), ik = row.querySelector(".r-kg");
      ir.value = val.r; ik.value = val.kg;
      ir.inputMode = "decimal";
      ir.placeholder = enMax() ? "máx" : enTiempo() ? "seg" : "reps"; ir.disabled = enMax();
      ik.placeholder = enPct ? "%" : "kg";
      row.querySelector(".fx-u").textContent = enTiempo() ? "s" : "reps";
      row.querySelector(".fx-kg").textContent = enPct ? "%" : "kg";
      if (val.auto) row.setAttribute("data-auto", "");
      if (val.hecha) { row.dataset.hecha = "1"; ir.disabled = ik.disabled = true; row.title = "Serie hecha: se edita tocándola"; }
      [ir, ik].forEach(x => x.addEventListener("input", () => row.removeAttribute("data-auto")));
      extrasEl.appendChild(row);
    }
  }
  // Valores de la serie k (0 = la fila de arriba)
  function valoresFila(k, v) {
    if (!extrasEl || k <= 0) return v;
    const row = extrasEl.children[k - 1];
    if (!row) return v;
    const out = { ...v }, r = row.querySelector(".r-reps").value.trim(), kg = row.querySelector(".r-kg").value.trim();
    if (kg !== "") { const x = parseFloat(kg.replace(",", ".")); if (x >= 0) { out.pct = enPct ? x : 0; out.peso = enPct ? kgDePct(id, x) : x; } }
    if (!enMax() && r !== "") {
      if (enTiempo()) { const t = leerSegs(r); if (t > 0) out.tiempo = t; }
      else if (leerRango(r)) { const g = leerRango(r); out.reps = g.min; out.rango_min = g.min; out.rango_max = g.max; }
      else { const n = parseInt(r, 10); if (n > 0) { out.reps = n; out.rango_min = 0; out.rango_max = 0; } }
    }
    return out;
  }
  // Guardado automático: al editar series que ya existen, si sales del formulario con algo cambiado, se guarda solo (como pulsar OK)
  let foto = null;
  const valoresForm = () => [fa.value, fb.value, fc.value, vecesEl.value, otroEj.value, ...[...formEl.querySelectorAll("input[type=checkbox]")].map(x => x.checked), ...[...formEl.querySelectorAll(".filas-extra input")].map(x => x.value)].join("|");
  const hayDatoForm = () => mov || dist ? !!(fa.value.trim() || fb.value.trim()) : !!(fb.value.trim() || (b.querySelector(".es-max") || {}).checked || (b.querySelector(".es-bilbo") || {}).checked);
  function tomarFoto() { foto = valoresForm(); }
  const dentroForm = el => !!el && (formEl.contains(el) || !!(el.closest && el.closest(".veces-cab") && b.contains(el)));
  // Tocar un botón del formulario (kg/%, Reps ▾, −/+…) le quita el foco al campo en Safari y el móvil: no es salir
  // del formulario. Se espera al siguiente toque fuera de él para guardar o cerrar
  let toqueDentro = 0;
  b.addEventListener("pointerdown", ev => { if (dentroForm(ev.target)) toqueDentro = Date.now(); }, true);
  formEl.addEventListener("focusout", ev => {
    const dentro = dentroForm;
    if (dentro(ev.relatedTarget)) return;
    setTimeout(() => {
      if (formEl.hidden || dentro(document.activeElement) || !b.isConnected) return;
      if (Date.now() - toqueDentro < 700) {
        const fuera = e => { if (dentro(e.target)) return; document.removeEventListener("pointerdown", fuera, true); toqueDentro = 0; if (!formEl.hidden && b.isConnected) formEl.dispatchEvent(new FocusEvent("focusout")); };
        document.addEventListener("pointerdown", fuera, true);
        return;
      }
      // Te vas a otro sitio sin pulsar OK: si has escrito algo válido se guarda solo; si no has cambiado nada, se cierra
      const cambiado = foto !== null && valoresForm() !== foto;
      const hayDato = hayDatoForm();
      if (cambiado && hayDato) { foto = null; formEl.requestSubmit(); return; }
      if (series.length && (modoForm === "editar" || modoForm === "grupo" || modoForm === "una") && !cambiado) { delete borradores[dia.id + "|" + (grupo || "") + "|" + idK + "|" + (parte || "")]; pintarBloques(true); }
    }, 200);
  });

  const fa = b.querySelector(".in-a"), fb = b.querySelector(".in-b"), fc = b.querySelector(".in-c"), boton = b.querySelector(".anadir");
  // Fuerza por tiempo (isométricos: plancha, sentadilla isométrica…): el segundo campo pasa a ser el tiempo
  const chkT = b.querySelector(".por-t");
  const enTiempo = () => !!(chkT && chkT.checked);
  const segTxt = t => n0(t) > 0 ? (n0(t) < 60 ? String(n0(t)) : fmtTiempo(t)) : "";
  const ponerPorT = t => {
    if (!chkT) return;
    chkT.checked = t;
    fb.placeholder = t ? "tiempo 45 s" : "reps";
    fb.inputMode = "decimal";   // con coma: «10,12» es una ventana de reps
    fb.setAttribute("aria-label", t ? "Tiempo: 45 son segundos, 2 min o 1,30" : "Repeticiones (o una ventana: 10-12)");
    const por = fb.closest(".ns-fila").querySelector(".por"); if (por) por.textContent = t ? "·" : "×";
    marcarMedida();
  };
  if (chkT) chkT.addEventListener("change", () => { fb.value = ""; ponerPorT(chkT.checked); ponerMax(enMax()); if (!enMax()) fb.focus(); });
  // Máximas repeticiones (AMRAP / al fallo): sin número; la serie queda como «máx»
  const chkMax = b.querySelector(".es-max");
  const enMax = () => !!(chkMax && chkMax.checked);
  const ponerMax = m => {
    if (!chkMax) return;
    chkMax.checked = m;
    if (m) fb.value = "";
    fb.disabled = m;
    fb.placeholder = m ? (enTiempo() ? "máx tiempo" : "máx") : enTiempo() ? "tiempo 45 s" : "reps";
    marcarMedida();
  };
  if (chkMax) chkMax.addEventListener("change", () => ponerMax(chkMax.checked));
  // Selector «Reps · Tiempo · Máx. reps · Máx. tiempo»: una sola elección en vez de dos casillas
  const segM = b.querySelector(".seg-medida");
  function marcarMedida() {   // declarada (no const) para poder llamarla desde ponerPorT antes de llegar aquí
    const seg = b.querySelector(".seg-medida"), cm = b.querySelector(".es-max"), ct = b.querySelector(".por-t");
    if (!seg) return;
    const t = !!(ct && ct.checked), mx = !!(cm && cm.checked);
    const m = mx ? (t ? "maxt" : "maxr") : t ? "t" : "reps";
    seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.m === m)));
    const mb = b.querySelector(".medida-btn");
    if (mb) mb.textContent = { reps: "Reps", t: "⏱ Tiempo", maxr: "Máx. reps", maxt: "Máx. tiempo" }[m] + " ▾";
  }
  // «Reps ▾»: elegir cómo se mide en un menú (más limpio que cuatro botones)
  const medidaBtn = b.querySelector(".medida-btn");
  // Una línea menos: en fuerza, el descanso y OK van junto a «Reps ▾ · Por lado»
  const opsF = b.querySelector(".ops-fuerza"), filaDesc = b.querySelector(".ns-desc");
  // Fuerza: series junto al nombre; fila «[reps] Reps ▾   [peso] kg»; abajo «Por lado · ⏱ descanso · OK»
  { const cl = b.querySelector(".por-lado"); if (cl) { if (ladoDe(id) && !series.length) cl.checked = true; cl.closest("label").hidden = true; } }
  if (opsF && tipo === "fuerza" && medidaDe(id) !== "peso") {
    b.classList.add("sin-peso");   // dominadas, fondos, plancha…: sin casilla de kg (para el lastre, el ejercicio «lastrado»)
    if (medidaDe(id) === "tiempo" && !series.length) ponerPorT(true);
  }
  if (opsF && medidaBtn) {
    const fila = b.querySelector(".ns-principal");
    fila.querySelectorAll(".x-series, .kg-par").forEach(x => x.remove());
    fb.closest(".paso").after(medidaBtn);
    const vz = b.querySelector(".veces-izq");
    vz.classList.add("veces-cab");
    const cab = b.querySelector(".bloque-cab"), antesDe = cab.querySelector(".ej-resumen, .g-prog, .menu-btn, .quitar");
    if (antesDe) antesDe.before(vz); else cab.appendChild(vz);
    vz.addEventListener("focusout", ev => { if (!formEl.contains(ev.relatedTarget)) formEl.dispatchEvent(new FocusEvent("focusout", { relatedTarget: ev.relatedTarget })); });
    fila.classList.add("fila-fuerza");
    // Una fila por serie (pirámides, series distintas): la 1.ª es la de arriba; las demás la siguen hasta que las cambias
    extrasEl = document.createElement("div");
    extrasEl.className = "filas-extra";
    fila.after(extrasEl);
    vecesEl.addEventListener("input", () => pintarFilas(null));
    [fa, fb].forEach(x => x.addEventListener("input", () => extrasEl.querySelectorAll(".fila-x[data-auto]").forEach(row => {
      row.querySelector(".r-reps").value = fb.value; row.querySelector(".r-kg").value = fa.value;
    })));
  }
  if (opsF && filaDesc) {
    filaDesc.classList.add("desc-en-ops"); opsF.appendChild(filaDesc);
    // Descanso con su icono delante y un ejemplo corto que se lee entero
    const ic = document.createElement("span"); ic.className = "desc-ic"; ic.textContent = "⏱"; ic.setAttribute("aria-hidden", "true");
    fc.before(ic); fc.placeholder = "desc.";
  }
  if (medidaBtn) medidaBtn.addEventListener("click", () => menuMedida(id, m => b.querySelector('.seg-medida [data-m="' + m + '"]').click()));
  marcarMedida();
  if (segM) segM.addEventListener("click", ev => {
    const x = ev.target.closest("button[data-m]");
    if (!x) return;
    const m = x.dataset.m, t = m === "t" || m === "maxt", mx = m === "maxr" || m === "maxt";
    if (t !== enTiempo()) fb.value = "";
    ponerPorT(t); ponerMax(mx);
    if (!mx) fb.focus();
    guardarBor();
  });
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
    fa.placeholder = t ? "tiempo 40" : UD();
    fa.inputMode = "decimal";
    fa.removeAttribute("pattern");
    fa.setAttribute("aria-label", t ? "Tiempo (minutos y segundos)" : "Distancia en " + UD());
    fb.placeholder = t ? UD() + " (opcional)" : "tiempo 3,40";
    fb.inputMode = "decimal";
    fb.setAttribute("aria-label", t ? "Distancia en " + UD() + " (opcional)" : "Tiempo (minutos y segundos)");
  };
  if (modoDist) modoDist.addEventListener("click", () => { const x = fa.value; ponerPorTiempo(!porTiempo); fa.value = fb.value; fb.value = x; fa.focus(); pintarObjetivo(); });
  if (dist) { [fa, fb, fc].forEach(x => x.addEventListener("input", pintarObjetivo)); b.querySelector(".veces").addEventListener("input", pintarObjetivo); }
  // − y +: kg (o %) y reps en fuerza; metros y segundos en carrera y natación
  b.querySelectorAll(".paso").forEach(p => {
    const inp = p.querySelector("input");
    p.querySelectorAll("button").forEach(x => x.addEventListener("click", () => {
      const clase = mov ? (inp === fa ? "reps" : "s") : !dist && inp === fb && enTiempo() ? "s" : inp === fa ? (dist ? (porTiempo ? "t" : "m") : (enPct ? "pct" : "kg")) : (dist ? (porTiempo ? "m" : "t") : "reps");
      ajustarCampo(inp, clase, x.classList.contains("mas") ? 1 : -1);
      pintarCalc();
    }));
  });
  // Objetivo orientativo mientras planificas: cuenta cuántas series añades y su recuperación
  function pintarObjetivo() {
    if (!calc) return;
    if (tipo !== "carrera") { calc.textContent = ""; return; }
    const m = leerDist((porTiempo ? fb : fa).value);
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
    fa.placeholder = pct ? "% 1RM" : "peso";
    fa.setAttribute("aria-label", pct ? "Porcentaje del 1RM" : "Peso en kg");
    pintarCalc();
  };
  // La recuperación solo se copia de una serie de este mismo día: cada entrenamiento la ajusta
  const rellenarCon = (s, conRec) => {
    if (dist) {
      const t = !(n0(s.distancia) > 0) && n0(s.tiempo) > 0, m = distCampo(s.distancia), ti = n0(s.tiempo) > 0 ? fmtTiempo(s.tiempo) : "";
      ponerPorTiempo(t);
      fa.value = t ? ti : m;
      fb.value = t ? m : ti;
    }
    else if (mov) { fa.value = n0(s.reps) || ""; fb.value = n0(s.tiempo) > 0 ? (n0(s.tiempo) < 60 ? String(n0(s.tiempo)) : fmtTiempo(s.tiempo)) : ""; b.querySelector(".por-lado").checked = !!s.por_lado || ladoDe(id); }
    else {
      const t = (n0(s.tiempo) > 0 || !!s.max_tiempo) && !(n0(s.reps) > 0);
      ponerPorT(t);
      if (n0(s.pct) > 0 && !s.ciclo_id) { ponerModo(true); fa.value = num(s.pct); }
      else { ponerModo(false); const kg = pesoMostrado(s); fa.value = kg > 0 ? num(kg) : ""; }
      fb.value = t ? segTxt(s.tiempo) : n0(s.reps) || "";
      if (!t && esRango(s) && !hecha(s)) { fb.value = modoForm === "editar" ? "" : rangoTxt(s); if (modoForm === "editar") setTimeout(() => { fb.placeholder = rangoTxt(s) + ": ¿cuántas?"; }, 0); }
      if (b.querySelector(".por-lado")) b.querySelector(".por-lado").checked = !!s.por_lado || ladoDe(id);
      const esMax = !(n0(s.reps) > 0) && !(n0(s.tiempo) > 0) && !s.ciclo_id;
      // Completar una serie «máx» pendiente: se apunta lo que salió (reps o segundos)
      if (esMax && modoForm === "editar") { ponerMax(false); fb.placeholder = t ? "¿cuántos segundos?" : "¿cuántas reps?"; }
      else ponerMax(esMax);
    }
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
    const nSerie = numero;   // el número de esta serie (numero sigue creciendo en el bucle)
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
        if (s.ciclo_id === "auto" || (tipo === "fuerza" && pideDato(s))) { li.querySelector(".sv").click(); return; }   // en Bilbo y en «máx» hay que apuntar lo que salió
        marcarHecha(s, { ...s, hecha: true, peso: pesoMostrado(s) });
      });
      marca.replaceWith(c);
    } else marca.replaceWith(botonHecha(s, s.calentamiento ? "C" : String(numero), s.calentamiento ? "serie de calentamiento" : "serie " + numero));
    li.querySelector(".sv-p").textContent = (s.calentamiento ? "Calent. · " : "") + serieTexto(s);
    if (descTexto(s)) { const d = document.createElement("span"); d.className = "desc"; d.textContent = descTexto(s); li.querySelector(".sv").appendChild(d); }
    if (dist && textoPulso(s)) { const d = document.createElement("span"); d.className = "desnivel"; d.textContent = textoPulso(s); li.querySelector(".sv").appendChild(d); }
    if (dist && textoDesnivel(s)) { const d = document.createElement("span"); d.className = "desnivel" + (conDesnivel(s) ? " fuerte" : ""); d.textContent = textoDesnivel(s); li.querySelector(".sv").appendChild(d); }
    if (!dist && usaBarra(id) && textoDiscos(pesoMostrado(s))) { const d = document.createElement("span"); d.className = "discos"; d.textContent = textoDiscos(pesoMostrado(s)); li.querySelector(".sv").appendChild(d); }
    if (planificada && tipo === "carrera") { const o = objetivoSerie(s); if (o) { const ob = document.createElement("span"); ob.className = "objetivo"; ob.textContent = textoObjetivo(o); li.querySelector(".sv").appendChild(ob); } }
    li.querySelector(".sv").setAttribute("aria-label", (planificada ? "Completar" : "Editar") + " serie " + numero + ": " + serieTexto(s));
    li.querySelector(".sv").addEventListener("click", () => {
      if (li.dataset.deslizado) return;
      // Había algo a medias (una serie nueva o un cambio): se guarda antes, para no perderlo
      if (!formEl.hidden && foto !== null && valoresForm() !== foto && hayDatoForm() && editando !== s) { foto = null; formEl.requestSubmit(); return; }
      abrirForm();
      ponerModoForm("editar");
      editando = s;
      rellenarCon(s, true);
      if (chkBilbo) chkBilbo.checked = !!s.ciclo_id;
      if (s.ciclo_id === "auto") { fb.value = ""; fb.placeholder = "reps máx"; }
      tomarFoto();
      boton.textContent = "✓ Guardar " + nSerie;
      b.querySelector(".desmarcar").hidden = planificada;
      b.querySelector(".desmarcar").onclick = () => desmarcar(s);
      ol.querySelectorAll("li").forEach(x => x.classList.remove("editando"));
      li.classList.add("editando");
      fa.focus();
    });
    li.querySelector(".borrar").setAttribute("aria-label", "Borrar serie " + numero);
    if (prs.has(s.id)) { const p = document.createElement("span"); p.className = "pr"; p.textContent = "PR"; p.title = "Récord personal"; li.querySelector(".sv").after(p); }
    li.querySelector(".borrar").addEventListener("click", () => borrarSerie(s));
    // Deslizar: a la derecha la marca hecha; a la izquierda la borra (con Deshacer)
    deslizable(li, planificada ? (s.ciclo_id !== "auto" && !(tipo === "fuerza" && pideDato(s)) ? () => marcarHecha(s, { ...s, hecha: true, peso: pesoMostrado(s) }) : null) : () => desmarcar(s), () => borrarSerie(s));
    li.dataset.sid = s.id;
    mantenerPulsado(li, () => { if (!selSeries) empezarSelSeries(dia, s.id); });   // mantener pulsada una serie: elegir varias para agruparlas
    if (series.length > 1) li.appendChild(asaArrastre(li, () => [...ol.querySelectorAll(":scope > li[data-sid]")], n => reordenar(n.map(x => [db.series[x.dataset.sid]]), "Serie movida"), "Serie " + (s.calentamiento ? "de calentamiento" : numero)));
    ol.appendChild(li);
  });

  if (series.length) {
    const mas = document.createElement("button");
    mas.type = "button";
    mas.className = "enlace mas-serie";
    mas.textContent = "+ Serie";
    mas.setAttribute("aria-label", "Añadir otra serie de " + (ej.nombre || "este ejercicio"));
    mas.addEventListener("click", () => { abrirForm(); ponerModoForm("una"); tomarFoto(); fa.focus(); });
    ol.after(mas);
  }
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
  else if (dist && distDeNombre(ej.nombre)) fa.value = distCampo(distDeNombre(ej.nombre));
  if (chkBilbo && pendiente && pendiente.ciclo_id) { chkBilbo.checked = true; fb.value = ""; fb.placeholder = "reps máx"; }
  // Borrador: lo escrito sin pulsar OK no se pierde aunque el día se vuelva a pintar (al añadir o mover otro ejercicio)
  const claveBor = dia.id + "|" + (grupo || "") + "|" + idK + "|" + (parte || "");
  const guardarBor = () => {
    if (modoForm === "editar" || formEl.hidden) { delete borradores[claveBor]; return; }
    borradores[claveBor] = { a: fa.value, b: fb.value, c: fc.value, v: vecesEl.value, modo: modoForm, t: enTiempo(), max: enMax(), lado: !!(b.querySelector(".por-lado") || {}).checked };
  };
  const bor = borradores[claveBor];
  if (bor) {
    if (formEl.hidden) { abrirForm(); ponerModoForm(bor.modo === "una" ? "una" : "grupo"); }
    ponerPorT(!!bor.t);
    ponerMax(!!bor.max);
    fa.value = bor.a; fb.value = bor.b; fc.value = bor.c; vecesEl.value = bor.v;
    if (b.querySelector(".por-lado")) b.querySelector(".por-lado").checked = bor.lado;
    b.classList.add("con-borrador");
    foto = "";   // lo que quedó escrito se guardará al salir
  }
  if (!series.length && foto === null) tomarFoto();
  // Cancelar, como en otras apps: un ejercicio recién añadido (sin series) se quita; uno que ya existía se queda
  // tal cual estaba, sin aplicar cambios, y sale del modo edición
  b.querySelector(".cancelar-form").addEventListener("click", () => {
    foto = null;
    delete borradores[dia.id + "|" + (grupo || "") + "|" + idK + "|" + (parte || "")];
    if (!series.length) { quitarEspera(dia.id, idK); avisoDeshacer((ej.nombre || "Ejercicio") + " quitado", null); }
    pintarBloques(true);
  });   // ejercicio recién añadido: al salir, si has escrito algo, se crean sus series
  [fa, fb, fc, vecesEl].forEach(x => x.addEventListener("input", guardarBor));
  formEl.addEventListener("change", guardarBor);
  [fa, fb, fc].forEach((inp, k, todos) => {
    inp.addEventListener("focus", () => inp.select());
    if (k < 2) inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); todos[k + 1].focus(); } });
  });
  // Lee los campos; null (y el foco en el campo que falla) si algo no vale
  const leerValores = () => {
    const rec = leerRecuperacion(fc.value);
    if (!rec) { fc.focus(); return null; }
    const v = { peso: 0, reps: 0, pct: 0, ciclo_id: "", por_lado: false, max_tiempo: false, distancia: 0, tiempo: 0, descanso: rec.descanso, rec_dist: rec.rec_dist };
    if (dist) {
      const metros = porTiempo ? fb : fa, crono = porTiempo ? fa : fb;
      v.distancia = leerDist(metros.value);
      v.tiempo = leerTiempo(crono.value);
      if (isNaN(v.tiempo)) { crono.focus(); return null; }
      if (!(v.distancia > 0) && !(v.tiempo > 0)) { fa.focus(); return null; }
    } else if (mov) {
      v.reps = parseInt(fa.value, 10) || 0;
      v.tiempo = leerSegs(fb.value);
      if (isNaN(v.tiempo)) { fb.focus(); return null; }
      if (!(v.reps > 0) && !(v.tiempo > 0)) { fa.focus(); return null; }
      v.por_lado = b.querySelector(".por-lado").checked || ladoDe(id);
    } else {
      const x = parseFloat((fa.value.trim() || "0").replace(",", "."));
      v.pct = enPct ? x : 0;
      v.peso = enPct ? kgDePct(id, x) : x;
      v.ciclo_id = chkBilbo && chkBilbo.checked && ciclo ? ciclo.id : "";
      v.por_lado = !!(b.querySelector(".por-lado") || {}).checked || ladoDe(id);
      v.rango_min = 0; v.rango_max = 0;
      if (!(x >= 0) || (enPct && !v.peso)) { fa.focus(); return null; }
      if (enTiempo()) {
        v.reps = 0; v.ciclo_id = "";
        if (enMax() || /^\s*m[aá]x/i.test(fb.value)) { v.tiempo = 0; v.max_tiempo = true; }   // aguantar el máximo
        else { v.tiempo = leerSegs(fb.value); if (!(v.tiempo > 0)) { fb.focus(); return null; } }
      } else if (enMax() || /^\s*(m[aá]x|amrap|fallo)/i.test(fb.value)) {
        v.reps = 0; v.max_reps = true;   // máximas repeticiones
      } else if (chkBilbo && chkBilbo.checked && !fb.value.trim()) {
        v.reps = 0;   // Bilbo: se planifica «reps máx» y al hacerla se apuntan las que salieron
      } else if (leerRango(fb.value)) {
        const g = leerRango(fb.value);
        v.reps = g.min; v.rango_min = g.min; v.rango_max = g.max;   // ventana: queda pendiente hasta apuntar las que salieron
      } else {
        v.reps = parseInt(fb.value, 10);
        if (!(v.reps > 0)) { fb.focus(); return null; }
      }
    }
    return v;
  };
  // Días pasados: se apunta como hecho; hoy y días futuros: quedan pendientes para marcarlas una a una
  const nuevaHecha = dia.id < iso(new Date());
  b.querySelector("form").addEventListener("submit", e => {
    e.preventDefault();
    const v = leerValores();
    if (!v) return;
    delete borradores[dia.id + "|" + (grupo || "") + "|" + idK + "|" + (parte || "")];
    if (modoForm === "editar" && editando) {
      // Una serie concreta: se completa (o corrige) con lo escrito; hoy o antes queda hecha
      const fila = { ...editando, ...v, hecha: dia.id <= iso(new Date()) && !(n0(v.rango_max) > 0) };
      // Ventana pendiente: al apuntar las que salieron se conserva la ventana («11 reps de 10-12»)
      if (esRango(editando) && !(n0(v.rango_max) > 0) && n0(v.reps) > 0) { fila.rango_min = editando.rango_min; fila.rango_max = editando.rango_max; }
      // Si era «al máximo», sigue siéndolo aunque ahora tenga lo que salió
      if (editando.max_tiempo && n0(fila.tiempo) > 0) fila.max_tiempo = true;
      if ((editando.max_reps || esMaxSinDato(editando) && !editando.max_tiempo) && n0(fila.reps) > 0) fila.max_reps = true;
      cambiar("series", fila);
      terminar(fila);
      if (fila.hecha) avisarSiPR(fila);
      return;
    }
    // La descripción puesta antes de la primera serie pasa a las series (y deja de esperar en este dispositivo)
    const notaNueva = notaDe(series) || esperaNota[dia.id + "|" + idK] || "";
    const letraNueva = series.length ? series.some(x => x.letra_nueva) : !!esperaLetra[dia.id + "|" + idK];
    if (esperaLetra[dia.id + "|" + idK]) { delete esperaLetra[dia.id + "|" + idK]; escribir("espera-letra-v1", esperaLetra); }
    if (esperaNota[dia.id + "|" + idK]) { delete esperaNota[dia.id + "|" + idK]; escribir("espera-nota-v1", esperaNota); }
    const nueva = (k, vk) => ({ id: nuevoId(), fecha: dia.id, ejercicio_id: id, orden: Date.now() + k, grupo, seccion: parte || "", meso_id: "", bloque_id: "", ronda: 0, copia: copia > 1 ? copia : 0, borrado: false, calentamiento: false, nota: notaNueva, letra_nueva: letraNueva, ...(vk || v), hecha: nuevaHecha });
    if (modoForm === "una" || !series.length) {
      const n = modoForm === "una" ? 1 : Math.min(50, Math.max(1, parseInt(vecesEl.value, 10) || 1));
      if (!series.length) {
        // Delante del ejercicio que tenga detrás (el «orden» de la primera serie lo coloca colocarPrimeraSerie)
        for (let k = 0; k < n; k++) cambiar("series", nueva(k, valoresFila(k, v)), true);
      } else {
        const ultimo = Math.max(...series.map(x => n0(x.orden)));
        cambiar("series", { ...nueva(0), orden: ultimo + 0.5 }, true);
      }
      colocarPrimeraSerie(dia.id, idK, grupo, !series.length);
      persistir();
      quitarEspera(dia.id, idK);
      terminar();
      return;
    }
    // Editar el ejercicio entero: valores de las pendientes, número de series y, si se pide, otro ejercicio
    const efect = series.filter(x => !x.calentamiento), pend = efect.filter(x => !hecha(x)), hechas = efect.filter(hecha);
    const objetivo = Math.min(50, Math.max(1, parseInt(vecesEl.value, 10) || 1)), destino = otroEj.value || id;
    const aplicar = borrarHechas => {
      const deshacer = series.map(x => ["series", { ...x }]);
      const nuevas = [];
      pend.forEach(x => cambiar("series", { ...x, ...valoresFila(efect.indexOf(x), v), hecha: false }, true));
      if (objetivo > efect.length) {
        const ultimo = Math.max(...series.map(x => n0(x.orden)));
        for (let k = 0; k < objetivo - efect.length; k++) { const f = { ...nueva(k, valoresFila(efect.length + k, v)), orden: ultimo + (k + 1) / 100, hecha: false }; nuevas.push(f); cambiar("series", f, true); }
      } else if (objetivo < efect.length) {
        let sobran = efect.length - objetivo;
        const quitar = pend.slice().reverse().concat(borrarHechas ? hechas.slice().reverse() : []);
        quitar.forEach(x => { if (sobran > 0) { cambiar("series", { ...db.series[x.id], borrado: true }, true); sobran--; } });
      }
      // Otro ejercicio (p. ej. sentadilla → prensa): todas las series de esta tarjeta, hechas incluidas, pasan a él
      if (destino !== id) {
        series.concat(nuevas).forEach(x => { const f = db.series[x.id]; if (f && !f.borrado) cambiar("series", { ...f, ejercicio_id: destino, copia: 0 }, true); });
        quitarEspera(dia.id, destino);
      }
      persistir();
      terminar();
      avisoDeshacer(destino !== id ? "Cambiado a " + nombreEj(destino) : "Series actualizadas · " + nombreEj(id),
        deshacer.concat(nuevas.map(f => ["series", { ...f, borrado: true }])));
    };
    const faltan = efect.length - objetivo - pend.length;
    if (faltan > 0) abrirMenu("¿Quitar también series hechas?", "Para dejar ×" + objetivo + " hay que borrar " + faltan + (faltan === 1 ? " serie hecha" : " series hechas") + ".", [
      { texto: "Borrar " + faltan + (faltan === 1 ? " hecha" : " hechas"), peligro: true, confirmar: "Pulsa otra vez para borrarlas", accion: () => aplicar(true) },
      { texto: "Dejar las hechas (solo quitar pendientes)", accion: () => aplicar(false) }
    ]);
    else aplicar(false);
  });
  return b;
}

// ---------- Bloques: tramos repetidos ×N, mostrados ronda a ronda ----------
// ---------- Agrupar series sueltas en un bloque ×N (y desagrupar) ----------
// El menor patrón que se repite entero (A,B,A,B,A,B → 2); si no se repite, todas en una ronda
function periodoRepetido(claves) {
  for (let p = 1; p <= claves.length / 2; p++) if (claves.length % p === 0 && claves.every((c, i) => c === claves[i % p])) return p;
  return claves.length;
}
let selSeries = null;   // { dia, ids: Set } mientras se eligen series del día para agruparlas
function empezarSelSeries(dia, primera) {
  selSeries = { dia, ids: new Set(primera ? [primera] : []) };
  pintarSelSeries();
  setEstado("Toca las series que quieras agrupar");
}
function salirSelSeries() { selSeries = null; pintarSelSeries(); }
function pintarSelSeries() {
  document.body.classList.toggle("sel-series", !!selSeries);
  document.querySelectorAll(".series li[data-sid]").forEach(li => li.classList.toggle("sel", !!selSeries && selSeries.ids.has(li.dataset.sid)));
  $("selSerBarra").hidden = !selSeries;
  if (!selSeries) return;
  $("selSerN").textContent = selSeries.ids.size + (selSeries.ids.size === 1 ? " serie" : " series");
  $("selSerAgrupar").disabled = selSeries.ids.size < 2;
}
// En modo selección, tocar una serie la marca o desmarca (y no abre su formulario)
document.addEventListener("click", e => {
  if (!selSeries) return;
  const li = e.target.closest(".series li[data-sid]");
  if (!li) return;
  e.preventDefault(); e.stopPropagation();
  if (pulsacionLarga) { pulsacionLarga = false; return; }   // el toque que sigue a mantener pulsado
  const s = db.series[li.dataset.sid];
  if (!s || s.bloque_id || s.fecha !== selSeries.dia.id) return;
  if (selSeries.ids.has(s.id)) selSeries.ids.delete(s.id); else selSeries.ids.add(s.id);
  pintarSelSeries();
}, true);
function agruparSeleccion() {
  const dia = selSeries.dia, elegidas = [...selSeries.ids].map(id => db.series[id]).filter(s => s && !s.borrado && !s.bloque_id);
  if (elegidas.length < 2) return;
  const enDia = elegidas.slice().sort((a, b) => a.orden - b.orden);
  const opcion = (lista, rondas) => {
    const p = rondas ? periodoRepetido(lista.map(s => s.ejercicio_id)) : lista.length, n = lista.length / p;
    const nombres = lista.slice(0, p).map(s => nombreEj(s.ejercicio_id));
    return { lista, p, n, texto: "Bloque ×" + n + " · " + (p > 3 ? nombres.slice(0, 2).join(" + ") + "… (" + p + " tramos)" : nombres.join(" + ")) };
  };
  const aplicar = o => {
    const bloque = nuevoId(), grupo = o.lista[0].grupo || "", huecos = o.lista.map(s => n0(s.orden)).sort((a, b) => a - b);
    const deshacer = o.lista.map(s => ["series", { ...s }]);
    o.lista.forEach((s, i) => cambiar("series", { ...s, bloque_id: bloque, ronda: Math.floor(i / o.p) + 1, grupo, orden: huecos[i] }, true));
    persistir();
    salirSelSeries();
    pintarDia(dia);
    avisoDeshacer("Agrupadas en " + o.texto, deshacer);
  };
  const conPatron = opcion(enDia, true), unaRonda = opcion(enDia, false), orden = opcion(elegidas, true);
  const otroOrden = elegidas.some((s, i) => s !== enDia[i]);
  abrirMenu("Agrupar " + elegidas.length + " series", "Se conservan sus valores, lo hecho y lo pendiente. Elige cómo:", [
    conPatron.n > 1 && { texto: conPatron.texto, accion: () => aplicar(conPatron) },
    { texto: "Bloque ×1 con las " + elegidas.length + " en una ronda", accion: () => aplicar(unaRonda) },
    otroOrden && { texto: "En el orden en que las tocaste · " + orden.texto, accion: () => aplicar(orden) }
  ]);
}
function desagruparBloque(dia, series) {
  const deshacer = series.map(s => ["series", { ...s }]);
  series.forEach(s => cambiar("series", { ...s, bloque_id: "", ronda: 0 }, true));
  persistir();
  pintarDia(dia);
  avisoDeshacer("Bloque desagrupado en series sueltas", deshacer);
}
// Mete un ejercicio en un bloque: una serie suya en cada ronda, al final de la ronda. Si viene de fuera
// (arrastrado), sus series pasan a las rondas (la 1.ª a la R1…) y desaparecen como ejercicio suelto
function meterEnBloque(dia, seriesBloque, ejercicioId, sueltas) {
  const b0 = seriesBloque[0], rondas = [...new Set(seriesBloque.map(s => n0(s.ronda)))].sort((a, b) => a - b);
  const hist = seriesDe(ejercicioId), ult = hist[hist.length - 1];
  const base = sueltas && sueltas.length ? null : ult ? valores(ult) : { reps: tipoDe(ejercicioId) === "fuerza" || tipoDe(ejercicioId) === "movilidad" ? 10 : 0 };
  const antes = (sueltas || []).map(x => ["series", { ...x }]);
  let orden = Date.now();
  const nuevas = [];
  rondas.forEach((r, k) => {
    const v = sueltas && sueltas.length ? sueltas[Math.min(k, sueltas.length - 1)] : base;
    const hechaV = sueltas && sueltas[k] ? hecha(sueltas[k]) : false;
    const fila = { id: nuevoId(), fecha: dia.id, ejercicio_id: ejercicioId, orden: orden++, grupo: b0.grupo || "", seccion: b0.seccion || "", meso_id: b0.meso_id || "",
      bloque_id: b0.bloque_id, ronda: r, peso: n0(v.peso), reps: n0(v.reps), distancia: n0(v.distancia), tiempo: n0(v.tiempo), pct: n0(v.pct), por_lado: !!v.por_lado,
      descanso: n0(v.descanso), rec_dist: n0(v.rec_dist), ciclo_id: "", calentamiento: false, nota: v.nota || "", letra_nueva: !!b0.letra_nueva, hecha: hechaV, borrado: false };
    nuevas.push(fila);
    cambiar("series", fila, true);
  });
  (sueltas || []).forEach(x => cambiar("series", { ...x, borrado: true }, true));
  persistir();
  pintarDia(dia);
  avisoDeshacer(nombreEj(ejercicioId) + " añadido al bloque (" + rondas.length + " rondas)", antes.concat(nuevas.map(f => ["series", { ...f, borrado: true }])));
}
// Bloque vacío: una caja «×N rondas» donde arrastrar (o añadir) ejercicios; con el primero pasa a ser un bloque normal
function meterEnVacio(dia, vid, ejercicioId, sueltas) {
  const bv = bloquesVacios[dia.id + "|" + vid];
  if (!bv) return;
  const rondas = Array.from({ length: Math.max(1, n0(bv.r)) }, (_, k) => ({ ronda: k + 1, grupo: bv.g || "", seccion: bv.p || "", meso_id: "", bloque_id: vid, letra_nueva: false }));
  delete bloquesVacios[dia.id + "|" + vid];
  guardarVacios();
  meterEnBloque(dia, rondas, ejercicioId, sueltas);
}
function tarjetaBloqueVacio(dia, vid) {
  const k = dia.id + "|" + vid, bv = bloquesVacios[k];
  const c = document.createElement("div");
  c.className = "bloque bloque-rep bloque-vacio";
  c.dataset.vacio = vid;
  c.innerHTML = '<div class="bloque-cab"><span class="br-tit"></span><span class="g-prog">vacío</span><button type="button" class="menu-btn" aria-label="Opciones del bloque vacío">⋯</button></div>' +
    '<p class="bv-txt">Arrastra aquí ejercicios del entreno con ≡ (quédate un momento encima del título) o añádelos.</p><button type="button" class="add-ej bv-add">+ Añadir ejercicio al bloque</button>';
  c.querySelector(".br-tit").textContent = "×" + n0(bv.r) + " rondas";
  c.querySelector(".bv-add").addEventListener("click", () => abrirSelector(dia, id => meterEnVacio(dia, vid, id, null), bv.g || "", bv.p || ""));
  const rondas = n => { bloquesVacios[k] = { ...bv, r: Math.max(1, Math.min(50, n)) }; guardarVacios(); pintarDia(dia); };
  c.querySelector(".menu-btn").addEventListener("click", () => abrirMenu("Bloque vacío ×" + n0(bv.r), "", [
    { texto: "Añadir una ronda", accion: () => rondas(n0(bv.r) + 1) },
    n0(bv.r) > 1 && { texto: "Quitar una ronda", accion: () => rondas(n0(bv.r) - 1) },
    { texto: "Quitar bloque vacío", peligro: true, accion: () => { delete bloquesVacios[k]; guardarVacios(); pintarDia(dia); } }
  ]));
  return c;
}
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
      '<div class="ns-fila"><input class="in-a" autocomplete="off" enterkeyhint="next"><button type="button" class="modo br-modo" hidden aria-label="Cambiar entre kg y % del 1RM">kg</button><span class="por"></span><input class="in-b" autocomplete="off" enterkeyhint="next"><button type="button" class="medida-btn br-medida" hidden>Reps ▾</button></div>' +
      '<p class="calc br-calc" hidden></p>' +
      '<div class="ns-fila"><input class="in-c" inputmode="decimal" placeholder="⏱ descanso después: 1,30 o 300 m" aria-label="Descanso o recuperación después de esta serie (tiempo o metros)" autocomplete="off" enterkeyhint="done">' +
      '<button class="anadir">✓ Guardar</button></div>' +
      '<label class="br-todas" hidden><input type="checkbox"> <span></span></label>' +
      '<button type="button" class="enlace desmarcar" hidden>↺ Marcar como pendiente</button></form>';
  // El título solo dice «Bloque ×N»; los ejercicios salen en cada ronda (los de nombre con distancia, como «Series 1000 m», van en el título)
  const enTitulo = [...new Set(primera.map(s => nombreEj(s.ejercicio_id)).filter(n => distDeNombre(n)))];
  c.querySelector(".br-tit").textContent = "×" + rondas.length + " rondas" + (enTitulo.length ? " · " + enTitulo.join(" + ") : "");
  c.querySelector(".g-prog").textContent = series.filter(hecha).length + "/" + series.length;
  // Descripción: si todos los ejercicios tienen la misma, bajo el título; si no, cada una junto a su ejercicio en la R1
  const notasT = primera.map(s0 => notaDe(series.filter(x => x.ejercicio_id === s0.ejercicio_id)));
  const notaComun = notasT.every(n => n === notasT[0]) ? notasT[0] : "";
  if (notaComun) c.querySelector(".bloque-cab").after(lineaNota(notaComun, () => editarNota(dia, series, "Descripción del bloque")));
  const menu = c.querySelector(".menu-btn");
  menu.setAttribute("aria-label", "Opciones del bloque");
  menu.addEventListener("click", () => {
    const ultima = series.filter(s => n0(s.ronda) === rondas[rondas.length - 1]);
    abrirMenu("Bloque ×" + rondas.length, primera.map(s => nombreEj(s.ejercicio_id)).join(" + "), [
      ...[...new Set(seriesDelDia(dia.id).map(s => s.grupo || ""))].filter(x => x !== (series[0].grupo || "")).map(x => ({ texto: "Mover al entreno «" + (x || "Entreno 1") + "»", accion: () => moverASesion(series, x) })),
      { texto: "Añadir una ronda", accion: () => {
        let orden = Date.now();
        ultima.sort((a, b) => a.orden - b.orden).forEach(s => cambiar("series", { ...s, id: nuevoId(), orden: orden++, ronda: n0(s.ronda) + 1, hecha: false, meso_id: s.meso_id || "" }, true));
        persistir(); pintarDia(dia);
      } },
      rondas.length > 1 && { texto: "Quitar la última ronda", accion: () => { ultima.forEach(s => cambiar("series", { ...s, borrado: true }, true)); persistir(); pintarDia(dia); } },
      c.dataset.puedeLetra && { texto: c.dataset.letraNueva ? "Seguir con la letra anterior" : "Empezar letra nueva aquí (" + String.fromCharCode(c.querySelector(".etq-orden").textContent.charCodeAt(0) + 1) + "1)", accion: () => ponerLetraNueva(dia, series[0].grupo || "", "b:" + bloqueId, false, !c.dataset.letraNueva) },
      (variosTramos || !notaDe(series)) && { texto: variosTramos ? "Descripción (del bloque o de un ejercicio)…" : "+ Descripción (tempo, banda, EEP…)", accion: () => !variosTramos ? editarNota(dia, series, "Descripción del bloque")
        : abrirMenu("¿Descripción de qué?", "", [{ texto: "De todo el bloque", accion: () => editarNota(dia, series, "Descripción del bloque") }]
          .concat(primera.map(s0 => ({ texto: nombreEj(s0.ejercicio_id), accion: () => editarNota(dia, series.filter(x => x.ejercicio_id === s0.ejercicio_id), "Descripción de " + nombreEj(s0.ejercicio_id)) })))) },
      { texto: "⏱ Descansos del bloque…", accion: () => menuDescansos() },
      { texto: "+ Añadir un ejercicio al bloque…", accion: () => abrirSelector(dia, id => meterEnBloque(dia, series, id, null), series[0].grupo || "", series[0].seccion || "") },
      variosTramos && { texto: "Quitar un ejercicio del bloque…", accion: () => abrirMenu("¿Qué ejercicio quitas?", "Se borran sus series de todas las rondas", primera.map(s0 => ({ texto: nombreEj(s0.ejercicio_id), peligro: true, accion: () => {
        const fuera = series.filter(x => x.ejercicio_id === s0.ejercicio_id);
        const antes = fuera.map(x => ["series", { ...x }]);
        fuera.forEach(x => cambiar("series", { ...x, borrado: true }, true));
        persistir(); pintarDia(dia);
        avisoDeshacer(nombreEj(s0.ejercicio_id) + " quitado del bloque", antes);
      } }))) },
      { texto: "Desagrupar (series sueltas)", accion: () => desagruparBloque(dia, series) },
      { texto: "Compartir con un amigo…", accion: () => compartir("Bloque ×" + rondas.length + " · " + primera.map(s => nombreEj(s.ejercicio_id)).join(" + "), itemsDe(series)) },
      { texto: "Quitar bloque", peligro: true, confirmar: "Pulsa otra vez: se borran " + series.length + " series", accion: () => {
        series.forEach(s => cambiar("series", { ...s, borrado: true }, true)); persistir(); pintarDia(dia);
      } }
    ]);
  });

  // Descansos: entre ejercicios (dentro de la ronda), entre rondas (tras el último de cada ronda) y al acabar el bloque
  // (tras la última serie: es el descanso antes de lo siguiente). Se guardan en la serie, como en los ejercicios sueltos
  function menuDescansos() {
    const porRonda = rondas.map(r => series.filter(s => n0(s.ronda) === r).sort((a, b) => a.orden - b.orden));
    const entreEj = porRonda.flatMap(l => l.slice(0, -1)), entreR = porRonda.slice(0, -1).map(l => l[l.length - 1]), alFinal = [porRonda[porRonda.length - 1].slice(-1)[0]];
    const actual = l => { const t = l.map(recTexto); return t.every(x => x === t[0]) ? t[0] : ""; };
    const poner = async (lista, titulo) => {
      const t = await pedirNombre(titulo, actual(lista) || "", "Tiempo («1,30»), metros trotando («300 m») o ambos («300 m · 1:30»). «0» lo quita.");
      if (t === null) return;
      const rec = /^\s*0\s*$/.test(t) ? { descanso: 0, rec_dist: 0 } : leerRecuperacion(t);
      if (!rec) { setEstado("No entiendo «" + t + "»: prueba 1,30, 90 o 300 m"); return; }
      const antes = lista.map(x => ["series", { ...x }]);
      lista.forEach(x => cambiar("series", { ...x, descanso: rec.descanso, rec_dist: rec.rec_dist }, true));
      persistir(); pintarDia(dia);
      avisoDeshacer("Descanso puesto en " + lista.length + (lista.length === 1 ? " serie" : " series"), antes);
    };
    const et = l => actual(l) ? " (ahora " + actual(l) + ")" : "";
    abrirMenu("Descansos del bloque", "Se guardan en la serie de antes del descanso, y el modo entreno los usa.", [
      variosTramos && { texto: "Entre ejercicios" + et(entreEj), accion: () => poner(entreEj, "Descanso entre ejercicios") },
      rondas.length > 1 && { texto: "Entre rondas" + et(entreR), accion: () => poner(entreR, "Descanso entre rondas") },
      { texto: "Al terminar el bloque" + et(alFinal), accion: () => poner(alFinal, "Descanso al terminar el bloque") }
    ]);
  }
  const form = c.querySelector("form"), fa = c.querySelector(".in-a"), fb = c.querySelector(".in-b"), fc = c.querySelector(".in-c");
  const brModo = c.querySelector(".br-modo"), brCalc = c.querySelector(".br-calc"), brTodas = c.querySelector(".br-todas");
  let brPct = false, brM = "reps";
  const brMedida = c.querySelector(".br-medida");
  const ponerBrM = (m, completar) => {
    brM = m;
    const t = m === "t" || m === "maxt", mx = m === "maxr" || m === "maxt";
    form.dataset.isoT = t ? "1" : "";
    brMedida.textContent = NOMBRE_MEDIDA[m] + " ▾";
    fb.inputMode = "decimal";
    fb.placeholder = mx ? (completar ? (t ? "¿cuántos seg?" : "¿cuántas?") : "máx") : t ? "seg" : "reps";
    fb.setAttribute("aria-label", mx ? (t ? "Segundos que aguantaste (opcional)" : "Repeticiones que salieron (opcional)") : t ? "Tiempo: 45 son segundos" : "Repeticiones");
    c.querySelector(".por").textContent = t ? "·" : "×";
  };
  brMedida.addEventListener("click", () => menuMedida(editando.ejercicio_id, m => {
    const antesT = form.dataset.isoT === "1";
    ponerBrM(m, true);
    if (antesT !== (form.dataset.isoT === "1")) fb.value = "";
    fb.focus();
  }));
  const pintarBrCalc = () => {
    if (!editando || !brPct) { brCalc.hidden = true; return; }
    const v = parseFloat((fa.value || "").replace(",", ".")), ref = rmReferencia(editando.ejercicio_id);
    brCalc.hidden = false;
    brCalc.textContent = !ref ? "Pon tu 1RM en la ficha del ejercicio" : v > 0 ? "= " + num(kgDePct(editando.ejercicio_id, v)) + " kg (1RM " + num(ref) + ")" : "1RM de referencia: " + num(ref) + " kg";
  };
  const ponerBrModo = pct => {
    brPct = pct;
    brModo.textContent = pct ? "%" : "kg";
    brModo.classList.toggle("activo", pct);
    fa.placeholder = pct ? "% 1RM" : "kg";
    fa.setAttribute("aria-label", pct ? "Porcentaje del 1RM" : "Peso en kg");
    pintarBrCalc();
  };
  brModo.addEventListener("click", () => {
    const id = editando.ejercicio_id, v = parseFloat((fa.value || "").replace(",", ".")), ref = rmReferencia(id);
    if (!brPct) { ponerBrModo(true); fa.value = v > 0 && ref ? num(Math.round(v / ref * 100)) : ""; }
    else { const kg = v > 0 ? kgDePct(id, v) : 0; ponerBrModo(false); fa.value = kg ? num(kg) : ""; }
    fa.focus();
  });
  fa.addEventListener("input", () => { if (/%\s*$/.test(fa.value) && !brPct && !brModo.hidden) { fa.value = fa.value.replace(/\s*%\s*$/, ""); ponerBrModo(true); } pintarBrCalc(); });
  const prs = {};
  primera.forEach(s => { if (!prs[s.ejercicio_id]) prs[s.ejercicio_id] = prsEj(s.ejercicio_id); });
  const editar = (s, li) => {
    c.querySelector(".desmarcar").hidden = !hecha(s);
    c.querySelector(".desmarcar").onclick = () => desmarcar(s);
    editando = s;
    const dist = esDistancia(tipoDe(s.ejercicio_id));
    c.querySelector(".br-que").textContent = "R" + n0(s.ronda) + " · " + nombreEj(s.ejercicio_id);
    const mov = tipoDe(s.ejercicio_id) === "movilidad";
    fa.placeholder = dist ? UD() : mov ? "reps" : "kg"; fa.inputMode = mov ? "numeric" : "decimal"; fa.setAttribute("aria-label", dist ? "Distancia en " + UD() : mov ? "Repeticiones" : "Peso en kg");
    fb.placeholder = dist ? "tiempo 3,40" : mov ? "tiempo 45 s" : "reps o máx"; fb.inputMode = dist || mov ? "decimal" : "text"; fb.setAttribute("aria-label", dist ? "Tiempo (minutos y segundos)" : mov ? "Tiempo: 45 son segundos" : "Repeticiones (o «máx»)");
    c.querySelector(".por").textContent = dist ? "" : mov ? "o" : "×";
    const isoT = !dist && !mov && (n0(s.tiempo) > 0 || !!s.max_tiempo || medidaDe(s.ejercicio_id) === "tiempo" && !s.max_reps) && !(n0(s.reps) > 0);
    form.dataset.isoT = isoT ? "1" : "";
    if (isoT) { fb.placeholder = "tiempo 45 s"; fb.inputMode = "decimal"; fb.setAttribute("aria-label", "Tiempo: 45 son segundos"); c.querySelector(".por").textContent = "·"; }
    const maxSin = !dist && !mov && esMaxSinDato(s);
    brMedida.hidden = dist || mov;
    if (!dist && !mov) ponerBrM(s.max_tiempo || maxSin && isoT ? "maxt" : s.max_reps || maxSin ? "maxr" : isoT ? "t" : "reps", true);
    if (mov) { fa.value = n0(s.reps) || ""; fb.value = (n0(s.tiempo) > 0 ? (n0(s.tiempo) < 60 ? String(n0(s.tiempo)) : fmtTiempo(s.tiempo)) : ""); }
    else if (dist) { fa.value = distCampo(s.distancia); fb.value = n0(s.tiempo) > 0 ? fmtTiempo(s.tiempo) : ""; }
    else { fa.value = pesoMostrado(s) > 0 ? num(pesoMostrado(s)) : ""; if (n0(s.pct) > 0 && !s.ciclo_id) fa.value = num(s.pct); fb.value = isoT ? (n0(s.tiempo) > 0 ? (n0(s.tiempo) < 60 ? String(n0(s.tiempo)) : fmtTiempo(s.tiempo)) : "") : n0(s.reps) || ""; if (!isoT && esRango(s) && !hecha(s)) { fb.value = ""; fb.placeholder = rangoTxt(s) + ": ¿cuántas?"; } }
    fc.value = recTexto(s);
    const fuerza = !dist && !mov;
    form.classList.toggle("br-fuerza", fuerza);
    brModo.hidden = !fuerza || medidaDe(s.ejercicio_id) !== "peso" && !(n0(s.peso) > 0) && !(n0(s.pct) > 0);
    if (fuerza) ponerBrModo(n0(s.pct) > 0 && !s.ciclo_id); else { brPct = false; brCalc.hidden = true; }
    if (fuerza && medidaDe(s.ejercicio_id) !== "peso" && !fa.value) fa.placeholder = "kg (opcional)";
    // Igual en las demás rondas pendientes de este ejercicio
    const otras = series.filter(x => x.ejercicio_id === s.ejercicio_id && x.id !== s.id && !hecha(x));
    brTodas.hidden = !otras.length;
    brTodas.querySelector("input").checked = false;
    brTodas.querySelector("span").textContent = "Igual en las otras " + otras.length + (otras.length === 1 ? " ronda pendiente" : " rondas pendientes");
    c.querySelectorAll("li").forEach(x => x.classList.remove("editando"));
    li.classList.add("editando");
    form.hidden = false;
    (dist && n0(s.distancia) > 0 || !dist && !mov ? fb : fa).focus();
    fotoR = [fa.value, fb.value, fc.value, brPct, false, brM].join("|");
  };
  // Guardado automático al salir de la edición de una ronda, si algo ha cambiado
  let fotoR = null;
  let toqueDentroR = 0;
  form.addEventListener("pointerdown", () => { toqueDentroR = Date.now(); }, true);
  form.addEventListener("focusout", ev => {
    if (form.contains(ev.relatedTarget)) return;
    setTimeout(() => {
      if (form.hidden || form.contains(document.activeElement) || !c.isConnected || fotoR === null) return;
      if (Date.now() - toqueDentroR < 700) {
        const fuera = e => { if (form.contains(e.target)) return; document.removeEventListener("pointerdown", fuera, true); toqueDentroR = 0; if (!form.hidden && c.isConnected) form.dispatchEvent(new FocusEvent("focusout")); };
        document.addEventListener("pointerdown", fuera, true);
        return;
      }
      if ([fa.value, fb.value, fc.value, brPct, brTodas.querySelector("input").checked, brM].join("|") === fotoR) return;
      fotoR = null;
      form.requestSubmit();
    }, 200);
  });
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
        m.addEventListener("click", () => tipoDe(s.ejercicio_id) === "fuerza" && pideDato(s) ? editar(s, li) : marcarHecha(s, { ...s, hecha: true, peso: pesoMostrado(s) }));
        li.querySelector(".n").replaceWith(m);
      } else li.querySelector(".n").replaceWith(botonHecha(s, "✓", "ronda " + r + ", " + nombreEj(s.ejercicio_id)));
      deslizable(li, !hecha(s) ? (tipoDe(s.ejercicio_id) === "fuerza" && pideDato(s) ? null : () => marcarHecha(s, { ...s, hecha: true, peso: pesoMostrado(s) })) : () => desmarcar(s), null);
      // El nombre del tramo solo si aporta algo: «Series 1000 m · 1000 m» se queda en «1000 m»
      const nomTramo = !distDeNombre(nombreEj(s.ejercicio_id)) ? nombreEj(s.ejercicio_id) + " · " : "";
      li.querySelector(".sv-p").textContent = nomTramo + serieTexto(s);
      if (descTexto(s)) { const d = document.createElement("span"); d.className = "desc"; d.textContent = descTexto(s); li.querySelector(".sv").appendChild(d); }
      if (!hecha(s) && tipoDe(s.ejercicio_id) === "carrera") { const o = objetivoSerie(s); if (o) { const ob = document.createElement("span"); ob.className = "objetivo"; ob.textContent = textoObjetivo(o); li.querySelector(".sv").appendChild(ob); } }
      li.querySelector(".sv").setAttribute("aria-label", "Apuntar ronda " + r + ", " + nombreEj(s.ejercicio_id) + ": " + serieTexto(s));
      li.querySelector(".sv").addEventListener("click", () => { if (!li.dataset.deslizado) editar(s, li); });
      const notaT = !notaComun && r === rondas[0] ? notasT[primera.findIndex(x => x.ejercicio_id === s.ejercicio_id)] : "";
      if (notaT) { const d = document.createElement("span"); d.className = "nota-tramo"; d.textContent = notaT; li.querySelector(".sv").appendChild(d); }
      const ejV = db.ejercicios[s.ejercicio_id];
      if (r === rondas[0] && ejV && ejV.video_url) {
        const v = document.createElement("button");
        v.type = "button"; v.className = "br-video"; v.textContent = "▶";
        v.title = "Ver el vídeo"; v.setAttribute("aria-label", "Ver el vídeo de " + (ejV.nombre || "este ejercicio"));
        v.addEventListener("click", ev => { ev.stopPropagation(); verVideo(ejV); });
        li.appendChild(v);
      }
      // ⋯ de cada ejercicio del bloque (en la primera ronda): su ficha, su descripción o quitarlo del bloque
      if (r === rondas[0] && ejV) {
        const mb = document.createElement("button");
        mb.type = "button"; mb.className = "menu-btn br-menu"; mb.textContent = "⋯";
        mb.setAttribute("aria-label", "Opciones de " + (ejV.nombre || "este ejercicio"));
        mb.addEventListener("click", ev => {
          ev.stopPropagation();
          const delEj = series.filter(x => x.ejercicio_id === s.ejercicio_id);
          abrirMenu(ejV.nombre || "Ejercicio", "En este bloque · " + delEj.length + (delEj.length === 1 ? " serie" : " series"), [
            { texto: "Ver ficha del ejercicio", accion: () => abrirDetalle(s.ejercicio_id) },
            { texto: notaDe(delEj) ? "Editar la descripción…" : "+ Descripción (tempo, banda, EEP…)", accion: () => editarNota(dia, delEj, "Descripción de " + (ejV.nombre || "el ejercicio")) },
            variosTramos && { texto: "Quitar del bloque", peligro: true, confirmar: "Pulsa otra vez: se borran sus " + delEj.length + " series de todas las rondas", accion: () => {
              const antes = delEj.map(x => ["series", { ...x }]);
              delEj.forEach(x => cambiar("series", { ...x, borrado: true }, true));
              persistir(); pintarDia(dia);
              avisoDeshacer((ejV.nombre || "Ejercicio") + " quitado del bloque", antes);
            } }
          ]);
        });
        li.appendChild(mb);
      }
      if (prs[s.ejercicio_id] && prs[s.ejercicio_id].has(s.id)) { const p = document.createElement("span"); p.className = "pr"; p.textContent = "PR"; li.appendChild(p); }
      ol.appendChild(li);
    });
    cont.appendChild(fila);
  });

  [fa, fb].forEach((inp, k) => inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); (form.classList.contains("br-fuerza") ? (k ? fa : fc) : (k ? fc : fb)).focus(); } }));
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!editando) return;
    const rec = leerRecuperacion(fc.value);
    if (!rec) { fc.focus(); return; }
    const fila = { ...editando, descanso: rec.descanso, rec_dist: rec.rec_dist, hecha: dia.id <= iso(new Date()) };
    if (esDistancia(tipoDe(fila.ejercicio_id))) {
      fila.distancia = leerDist(fa.value);
      fila.tiempo = leerTiempo(fb.value);
      if (isNaN(fila.tiempo)) { fb.focus(); return; }
      if (!(fila.distancia > 0) && !(fila.tiempo > 0)) { fa.focus(); return; }
    } else if (tipoDe(fila.ejercicio_id) === "movilidad") {
      fila.reps = parseInt(fa.value, 10) || 0;
      fila.tiempo = leerSegs(fb.value);
      if (isNaN(fila.tiempo)) { fb.focus(); return; }
      if (!(fila.reps > 0) && !(fila.tiempo > 0)) { fa.focus(); return; }
    } else {
      const x = parseFloat((fa.value.trim().replace(/%\s*$/, "") || "0").replace(",", "."));
      if (!(x >= 0)) { fa.focus(); return; }
      fila.pct = brPct ? x : 0;
      fila.peso = brPct ? kgDePct(fila.ejercicio_id, x) : x;
      if (brPct && !fila.peso) { fa.focus(); setEstado("Pon tu 1RM en la ficha del ejercicio para usar %"); return; }
      if (fila.ciclo_id && !brPct) fila.ciclo_id = "";
      fila.max_tiempo = false; fila.max_reps = false;
      if (ladoDe(fila.ejercicio_id)) fila.por_lado = true;
      const escritoMax = /^\s*(m[aá]x|amrap|fallo)/i.test(fb.value), m = escritoMax && brM === "reps" ? "maxr" : escritoMax && brM === "t" ? "maxt" : brM;
      const txt = escritoMax ? "" : fb.value;
      if (m === "t" || m === "maxt") {
        fila.reps = 0; fila.tiempo = txt.trim() ? leerSegs(txt) : 0;
        if (m === "t" && !(fila.tiempo > 0)) { fb.focus(); return; }
        if (isNaN(fila.tiempo)) { fb.focus(); return; }
        if (m === "maxt") fila.max_tiempo = true;
      } else {
        const g = m === "reps" ? leerRango(txt) : null;
        fila.tiempo = 0; fila.reps = g ? g.min : txt.trim() ? parseInt(txt, 10) : 0;
        if (g) { fila.rango_min = g.min; fila.rango_max = g.max; fila.hecha = false; }   // escribir una ventana es planificar
        else if (m !== "reps") { fila.rango_min = 0; fila.rango_max = 0; }
        if (m === "reps" && !(fila.reps > 0)) { fb.focus(); return; }
        if (isNaN(fila.reps)) { fb.focus(); return; }
        if (m === "maxr") fila.max_reps = true;
      }
    }
    if (!brTodas.hidden && brTodas.querySelector("input").checked) {
      const copia = { peso: fila.peso, pct: fila.pct, reps: fila.reps, tiempo: fila.tiempo, distancia: fila.distancia, max_tiempo: !!fila.max_tiempo, max_reps: !!fila.max_reps, rango_min: n0(fila.rango_min), rango_max: n0(fila.rango_max), por_lado: !!fila.por_lado, descanso: fila.descanso, rec_dist: fila.rec_dist, ciclo_id: fila.ciclo_id || "" };
      series.filter(x => x.ejercicio_id === fila.ejercicio_id && x.id !== fila.id && !hecha(x)).forEach(x => cambiar("series", { ...x, ...copia }, true));
    }
    cambiar("series", fila);
    terminar(fila);
    if (fila.hecha) avisarSiPR(fila);
  });
  return c;
}

// «Reps ▾» de los bloques: cómo se mide la serie (en los isométricos, según su ficha, solo por tiempo)
const NOMBRE_MEDIDA = { reps: "Reps", t: "⏱ Tiempo", maxr: "Máx. reps", maxt: "Máx. tiempo" };
function menuMedida(ejId, alElegir) {
  const iso = medidaDe(ejId) === "tiempo";
  abrirMenu("¿Cómo se mide la serie?", iso ? "Es isométrico (en su ficha): va por tiempo" : "", (iso ? [["t", "⏱ Tiempo"], ["maxt", "Máx. tiempo (aguantar)"]]
    : [["reps", "Repeticiones"], ["t", "⏱ Tiempo (isométrico)"], ["maxr", "Máx. repeticiones"], ["maxt", "Máx. tiempo (aguantar)"]]).map(([m, t]) => ({ texto: t, accion: () => alElegir(m) })));
}
// Ventana para crear un bloque: tramos (con sus valores y recuperación) y número de rondas
let diaBloque = null, tramos = [];
let grupoBloque = "";
let parteBloque = "";
function abrirBloque(dia, grupoDestino, parteDestino) {
  diaBloque = dia;
  grupoBloque = grupoDestino || "";
  parteBloque = parteDestino || "";
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
      '<div class="ns-fila"><input class="in-a" autocomplete="off"><span class="por"></span><input class="in-b" autocomplete="off"><button type="button" class="medida-btn tr-medida" hidden>Reps ▾</button><button type="button" class="modo tr-modo" hidden aria-label="Cambiar entre kg y % del 1RM">kg</button></div>' +
      '<p class="calc tr-calc" hidden></p>' +
      '<input class="in-c" inputmode="decimal" autocomplete="off" placeholder="⏱ descanso después: 1,30 o 300 m" aria-label="Descanso después de este tramo (tiempo o metros); en el último, es el descanso entre rondas">';
    fila.querySelector(".tr-n").textContent = (k + 1) + ". " + nombreEj(t.ejercicio_id);
    fila.querySelector(".tr-n").appendChild(etiquetaTipo(tipoDe(t.ejercicio_id)));
    const [a, b, cc] = [".in-a", ".in-b", ".in-c"].map(x => fila.querySelector(x));
    const mov = tipoDe(t.ejercicio_id) === "movilidad";
    const fza = !dist && !mov, med = fza ? medidaDe(t.ejercicio_id) : "";
    a.placeholder = dist ? UD() : mov ? "reps" : med !== "peso" ? "kg (opcional)" : "kg"; a.inputMode = "decimal"; a.setAttribute("aria-label", dist ? "Distancia en " + UD() : mov ? "Repeticiones" : "Peso en kg");
    b.placeholder = dist ? "tiempo" : "tiempo 45 s"; b.inputMode = "decimal"; b.setAttribute("aria-label", dist ? "Tiempo (puedes dejar los metros vacíos)" : "Tiempo: 45 son segundos");
    const tmed = fila.querySelector(".tr-medida");
    const pintarM = () => {
      const tt = t.m === "t" || t.m === "maxt", mx = t.m === "maxr" || t.m === "maxt";
      tmed.textContent = NOMBRE_MEDIDA[t.m] + " ▾";
      b.disabled = mx; if (mx) b.value = "";
      b.placeholder = mx ? "máx" : tt ? "seg" : "reps"; b.inputMode = tt ? "decimal" : "numeric";
      b.setAttribute("aria-label", mx ? "Al máximo" : tt ? "Tiempo: 45 son segundos" : "Repeticiones");
      fila.querySelector(".por").textContent = tt ? "·" : "×";
    };
    fila.querySelector(".por").textContent = dist ? "" : mov ? "o" : "×";
    if (fza) {
      fila.classList.add("tr-fuerza");
      if (!t.m) t.m = med === "tiempo" ? "t" : /^\s*m[aá]x/i.test(String(t.b)) ? "maxr" : "reps";
      tmed.hidden = false;
      tmed.addEventListener("click", () => menuMedida(t.ejercicio_id, m => { const antes = t.m === "t" || t.m === "maxt"; t.m = m; if (antes !== (m === "t" || m === "maxt")) { t.b = ""; b.value = ""; } pintarM(); if (!b.disabled) b.focus(); }));
    }
    // kg o % del 1RM, como en los ejercicios
    const tm = fila.querySelector(".tr-modo"), tc = fila.querySelector(".tr-calc");
    const pintarTc = () => {
      tm.textContent = t.p ? "%" : "kg"; tm.classList.toggle("activo", !!t.p);
      if (fza) a.placeholder = t.p ? "% 1RM" : med !== "peso" ? "kg (opcional)" : "kg";
      const v = parseFloat(String(a.value).replace(",", ".")), ref = rmReferencia(t.ejercicio_id);
      tc.hidden = !t.p;
      tc.textContent = !ref ? "Pon tu 1RM en la ficha del ejercicio" : v > 0 ? "= " + num(kgDePct(t.ejercicio_id, v)) + " kg (1RM " + num(ref) + ")" : "1RM de referencia: " + num(ref) + " kg";
    };
    tm.hidden = !fza || med !== "peso";
    tm.addEventListener("click", () => {
      const v = parseFloat(String(a.value).replace(",", ".")), ref = rmReferencia(t.ejercicio_id);
      if (!t.p) { t.p = true; a.value = v > 0 && ref ? num(Math.round(v / ref * 100)) : ""; }
      else { const kg = v > 0 ? kgDePct(t.ejercicio_id, v) : 0; t.p = false; a.value = kg ? num(kg) : ""; }
      t.a = a.value; pintarTc();
    });
    a.value = t.a; b.value = t.b; cc.value = t.c;
    if (fza) { pintarTc(); pintarM(); t.b = b.value; }
    a.addEventListener("input", () => { if (fza && /%\s*$/.test(a.value) && !tm.hidden) { a.value = a.value.replace(/\s*%\s*$/, ""); t.p = true; } t.a = a.value; if (fza) pintarTc(); });
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
  const dist = esDistancia(tipoDe(id)), mov = tipoDe(id) === "movilidad";
  tramos.push(mov ? { ejercicio_id: id, a: u ? String(n0(u.reps) || "") : "", b: u ? (n0(u.tiempo) > 0 ? (n0(u.tiempo) < 60 ? String(n0(u.tiempo)) : fmtTiempo(u.tiempo)) : "") : "", c: "" } : { ejercicio_id: id,
    a: u ? String(dist ? distCampo(u.distancia) : (n0(u.peso) > 0 ? num(u.peso) : "")) : (dist && distDeNombre(nombreEj(id)) ? distCampo(distDeNombre(nombreEj(id))) : ""),
    b: u ? (dist ? (n0(u.tiempo) > 0 ? fmtTiempo(u.tiempo) : "") : String(n0(u.reps) || "")) : "",
    c: "" });   // la recuperación no se arrastra de otros días
  pintarTramos();
}));
$("blqVacio").addEventListener("click", () => {
  const rondas = parseInt($("blqRondas").value, 10);
  if (!(rondas >= 1 && rondas <= 50)) { $("blqAviso").textContent = "Las rondas deben estar entre 1 y 50."; return; }
  bloquesVacios[diaBloque.id + "|" + nuevoId()] = { g: grupoBloque, p: parteBloque, r: rondas };
  guardarVacios();
  $("dlgBloque").close();
  pintarDia(diaBloque);
  setEstado("Bloque vacío ×" + rondas + " creado: arrastra ejercicios encima con ≡");
});
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
      v.distancia = leerDist(t.a);
      v.tiempo = leerTiempo(t.b);
      if (isNaN(v.tiempo)) { aviso.textContent = "Revisa el tiempo del tramo " + (k + 1) + " (por ejemplo 3,40)."; return; }
      if (!(v.distancia > 0) && !(v.tiempo > 0)) { aviso.textContent = "Pon los metros o el tiempo del tramo " + (k + 1) + "."; return; }
    } else if (tipoDe(t.ejercicio_id) === "movilidad") {
      v.reps = parseInt(t.a, 10) || 0;
      v.tiempo = leerSegs(t.b);
      if (isNaN(v.tiempo) || (!(v.reps > 0) && !(v.tiempo > 0))) { aviso.textContent = "Pon las repeticiones o el tiempo del tramo " + (k + 1) + "."; return; }
    } else {
      const conPct = t.p || /%\s*$/.test(String(t.a));
      v.peso = parseFloat((String(t.a).trim().replace(/\s*%\s*$/, "") || "0").replace(",", "."));
      if (conPct && v.peso > 0) { v.pct = v.peso; v.peso = kgDePct(t.ejercicio_id, v.pct); if (!v.peso) { aviso.textContent = "Para usar % en el tramo " + (k + 1) + ", pon su 1RM en la ficha del ejercicio."; return; } }
      if (ladoDe(t.ejercicio_id)) v.por_lado = true;
      if (!(v.peso >= 0)) { aviso.textContent = "Revisa el peso del tramo " + (k + 1) + "."; return; }
      const esMx = t.m === "maxr" || t.m === "maxt" || /^\s*(m[aá]x|amrap|fallo)/i.test(t.b);
      if (t.m === "t" || t.m === "maxt" || !t.m && medidaDe(t.ejercicio_id) === "tiempo") {
        if (esMx) v.max_tiempo = true;
        else { v.tiempo = leerSegs(t.b); if (!(v.tiempo > 0)) { aviso.textContent = "Pon los segundos del tramo " + (k + 1) + " (o «máx»)."; return; } }
      } else {
        const g = esMx ? null : leerRango(t.b);
        v.reps = esMx ? 0 : g ? g.min : parseInt(t.b, 10);
        if (g) { v.rango_min = g.min; v.rango_max = g.max; }
        if (esMx) v.max_reps = true;
        if (!(v.reps > 0) && !esMx) { aviso.textContent = "Pon las repeticiones del tramo " + (k + 1) + " (o «máx»)."; return; }
      }
    }
    lista.push({ ejercicio_id: t.ejercicio_id, series: Array.from({ length: rondas }, () => ({ ...v })) });
  }
  pegarItems(diaBloque.id, [{ bloque: true, grupo: grupoBloque, seccion: parteBloque, tramos: lista }]);
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
  const nombreLimpio = nombre.trim(), tipoLimpio = TIPOS[tipo] ? tipo : "fuerza";
  const existente = vivos("ejercicios").find(e => e.tipo === tipoLimpio && compacto(e.nombre) === compacto(nombreLimpio));
  if (existente) return existente.id;
  const id = nuevoId();
  cambiar("ejercicios", { id, user_id: sesion.user_id, nombre: nombreLimpio, tipo: tipoLimpio, video_url: "", notas: "", compartido: puedeEditarCatalogo(), borrado: false });
  return id;
}
let grupoSel = "";
let parteSel = "";
function abrirSelector(dia, alElegir, grupoDestino, parteDestino) {
  diaSelector = dia;
  alElegirSel = alElegir || null;
  grupoSel = grupoDestino || "";
  parteSel = parteDestino || "";
  // Si el día ya tiene ejercicios de un solo tipo, el buscador se abre en ese tipo
  const tiposDia = dia ? [...new Set(seriesDelDia(dia.id).map(s => s.ejercicio_id).concat((enEspera[dia.id] || []).map(ejDeClave)).map(tipoDe))] : [];
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
  // El mismo ejercicio otra vez en la misma parte: otra tarjeta («Press banca (2)»), con sus propias series
  const enParte = seriesVivas().filter(s => s.fecha === dia.id && s.ejercicio_id === id && !s.bloque_id && (s.grupo || "") === grupoSel && (s.seccion || "") === parteSel).map(s => n0(s.copia) > 1 ? n0(s.copia) : 1)
    .concat((enEspera[dia.id] || []).filter(k => ejDeClave(k) === id).map(k => copiaDeClave(k) || 1));   // los que esperan (sin series) usan una clave por día
  const idK = enParte.length ? id + "#" + (Math.max(...enParte) + 1) : id;
  {
    id = idK;
    enEspera[dia.id] = (enEspera[dia.id] || []).filter(x => x !== id).concat(id); guardarEspera();
    if (grupoSel) esperaGrupo[dia.id + "|" + id] = grupoSel; else delete esperaGrupo[dia.id + "|" + id];
    if (parteSel) esperaParte[dia.id + "|" + id] = parteSel; else delete esperaParte[dia.id + "|" + id];
    guardarSesiones();
  }
  pintarDia(dia);
  const inp = dia.bloquesEl.querySelector('[data-ej="' + id + '"] .in-a');
  if (inp) { inp.scrollIntoView({ block: "center", behavior: "smooth" }); inp.focus(); }
}
function pintarSelector() {
  const q = $("buscarEj").value.trim(), lista = $("listaEj");
  lista.textContent = "";
  const uso = usoEjercicios();
  const ejs = uso.lista.filter(e => compacto(e.nombre).includes(compacto(q)) && (!tipoSel || tipoDe(e.id) === tipoSel));
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
    const veces = uso.n(e.id);
    if (veces) { const c = document.createElement("span"); c.className = "op-uso"; c.textContent = veces + (veces === 1 ? " vez" : " veces"); b.appendChild(c); }
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
  // Agrupado por tipo en secciones desplegables; al buscar se abren las que tienen resultados y se ocultan las vacías
  Object.keys(TIPOS).forEach(tipo => {
    const deTipo = ejs.filter(e => tipoDe(e.id) === tipo);
    if (!deTipo.length) return;
    const abierta = q ? true : catAbiertas[tipo] === true;
    const sec = document.createElement("section");
    sec.className = "cat-sec t-" + tipo + (abierta ? "" : " cerrada");
    sec.innerHTML = '<button type="button" class="sec-toggle"><span class="flecha-dia" aria-hidden="true">▸</span><h3></h3><span class="sec-n"></span></button><div class="sec-cuerpo"><div class="sec-cuerpo-in"><div class="cat-grid"></div></div></div>';
    sec.querySelector("h3").textContent = TIPOS[tipo].nombre;
    sec.querySelector(".sec-n").textContent = "· " + deTipo.length;
    const boton = sec.querySelector(".sec-toggle"), cuerpo = sec.querySelector(".sec-cuerpo");
    boton.setAttribute("aria-expanded", String(abierta));
    cuerpo.inert = !abierta;
    boton.addEventListener("click", () => {
      const abrir = sec.classList.contains("cerrada");
      sec.classList.toggle("cerrada", !abrir);
      boton.setAttribute("aria-expanded", String(abrir));
      cuerpo.inert = !abrir;
      if (!q) { catAbiertas[tipo] = abrir; escribir("catalogo-abiertas-v1", catAbiertas); }
      if (abrir) verAlAbrir(sec);
    });
    const grid = sec.querySelector(".cat-grid");
    deTipo.forEach(e => grid.appendChild(tarjetaEjercicio(e)));
    cont.appendChild(sec);
  });
}
let catAbiertas = {}; // tipos de ejercicios empiezan plegados en cada apertura

// ---------- Listas de entrenamientos: cada lista ordena entrenamientos guardados (plantillas) para elegir y poner en un día ----------
// items: en orden, id de entrenamiento (string) o separador de semana/bloque ({ sep: id, titulo }). Un entrenamiento puede repetirse
// en varias semanas. «siguiente» es la posición (contando solo entrenamientos) del que toca después, para rotar A, B, C…
let listasAbiertas = {}; // listas, semanas y bloques empiezan plegados en cada apertura
const esSep = x => !!(x && typeof x === "object" && x.sep);
// Mesociclo (o fase) de una lista: agrupa todo lo que va debajo (semanas o bloques y entrenamientos) hasta el siguiente
const esGrupoL = x => !!(x && typeof x === "object" && x.grupo);
const entrenosDeLista = l => (l.items || []).filter(x => typeof x === "string").map(id => db.plantillas[id]).filter(p => p && !p.borrado);
// Entrenamientos con su posición (k) y la semana/bloque a la que pertenecen
function recorrerLista(l) {
  const out = []; let sep = null, k = 0;
  (l.items || []).forEach((x, i) => {
    if (esGrupoL(x)) { sep = null; return; }
    if (esSep(x)) { sep = x; return; }
    const p = db.plantillas[x];
    if (p && !p.borrado) out.push({ p, k: k++, i, sep });
  });
  return out;
}
function guardarLista(l, cambios) { cambiar("listas", { ...l, ...cambios }); pintarListas(); }
async function nuevaLista(alCrear) {
  const n = await pedirNombre("Nueva lista de entrenamientos", "", "Por ejemplo «Fuerza 3 días», «Torso / Pierna», «Pretemporada» o «Carrera».");
  if (!n) return;
  const l = { id: nuevoId(), nombre: n, items: [], siguiente: 0, borrado: false };
  listasAbiertas[l.id] = true; escribir("listas-abiertas-v1", listasAbiertas);
  cambiar("listas", l);
  pintarListas();
  if (alCrear) alCrear(db.listas[l.id]);
}
function elegirLista(titulo, alElegir) {
  const ls = vivos("listas").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  abrirMenu(titulo, "", ls.map(l => ({ texto: l.nombre + " · " + entrenosDeLista(l).length + " entrenamientos", accion: () => alElegir(l) }))
    .concat([{ texto: "+ Nueva lista…", accion: () => nuevaLista(alElegir) }]));
}
// Elegir un entrenamiento de una lista (con su semana o bloque delante); el siguiente va marcado
function elegirDeLista(l, alElegir) {
  const rec = recorrerLista(l), sig = rec.length ? n0(l.siguiente) % rec.length : -1;
  abrirMenu("«" + l.nombre + "»", rec.length ? "El marcado con ▶ es el que toca" : "Lista vacía", rec.map(x => ({
    texto: (x.k === sig ? "▶ " : "") + (x.sep ? x.sep.titulo + " · " : "") + x.p.nombre + " · " + resumenItems(x.p.items || []), accion: () => alElegir(x.p, x.k) })));
}
// Inserta en la lista (al final o detrás de una posición de items)
function insertarEnLista(l, valor, tras) {
  const fresca = db.listas[l.id], items = (fresca.items || []).slice();
  if (tras === undefined || tras < 0) items.push(valor); else items.splice(tras + 1, 0, valor);
  guardarLista(fresca, { items });
}
async function guardarEnLista(nombreSugerido, series) {
  elegirLista("¿En qué lista lo guardo?", async l => {
    const nombre = await pedirNombre("Nombre del entrenamiento", nombreSugerido, "Se guarda también en tus plantillas. Si ya hay una con este nombre, se reemplaza.");
    if (!nombre) return;
    const items = itemsDe(series).map(it => it.bloque ? { bloque: true, seccion: it.seccion || "", tramos: it.tramos } : { ejercicio_id: it.ejercicio_id, seccion: it.seccion || "", series: it.series });
    const existe = vivos("plantillas").find(p => norm(p.nombre) === norm(nombre));
    const id = existe ? existe.id : nuevoId();
    cambiar("plantillas", { id, nombre, items, borrado: false });
    insertarEnLista(l, id);
    avisoDeshacer("«" + nombre + "» guardado en la lista «" + l.nombre + "»", null);
  });
}
// Pone el entrenamiento k de la lista en un día; el siguiente pasa a ser el de después
function ponerEnDia(l, p, k, f) {
  pegarItems(f, p.items, p.nombre);
  const n = recorrerLista(db.listas[l.id]).length;
  cambiar("listas", { ...db.listas[l.id], siguiente: n ? (k + 1) % n : 0 });
  persistir();
  irADia(f, "«" + p.nombre + "» puesto el " + NOMBRES[(deIso(f).getDay() + 6) % 7].toLowerCase() + " " + fmt(deIso(f)));
}
const ponerEntrenoDeLista = (l, p, k) => elegirDiaDestino(lunesVista(), "¿En qué día pongo «" + p.nombre + "»?", f => ponerEnDia(l, p, k, f));
function pintarListas() {
  const cont = $("listasCont");
  if (!cont) return;
  cont.textContent = "";
  const ls = vivos("listas").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  if (!ls.length) {
    cont.innerHTML = '<p class="vacio-lista">Aquí guardas tus entrenamientos en listas (por ejemplo «Fuerza 3 días» con Torso, Pierna y Full body), los ordenas por semanas o bloques y, cuando quieras, pones uno en un día. Crea una con «+ Nueva lista», o guarda un día desde su ⋯ → «Guardar en una lista…».</p>';
    return;
  }
  ls.forEach(l => {
    const rec = recorrerLista(l), abierta = listasAbiertas[l.id] === true;
    const sig = rec.length ? n0(l.siguiente) % rec.length : -1;
    const nSem = (l.items || []).filter(esSep).length;
    const sec = document.createElement("section");
    sec.className = "cat-sec lista-sec" + (abierta ? "" : " cerrada");
    sec.innerHTML = '<div class="lista-cab"><button type="button" class="sec-toggle"><span class="flecha-dia" aria-hidden="true">▸</span><h3></h3><span class="sec-n"></span></button><button type="button" class="menu-btn">⋯</button></div><div class="sec-cuerpo"><div class="sec-cuerpo-in"><div class="lista-ents"></div><div class="add-fila"><button type="button" class="add-ej">+ Entrenamiento</button><button type="button" class="add-ej">+ Bloque (semana, fase…)</button><button type="button" class="add-ej add-meso">+ Mesociclo</button></div></div></div>';
    sec.querySelector("h3").textContent = l.nombre;
    const nGr = (l.items || []).filter(esGrupoL).length;
    sec.querySelector(".sec-n").textContent = "· " + rec.length + (nGr ? " · " + nGr + (nGr === 1 ? " mesociclo" : " mesociclos") : "") + (nSem ? " · " + nSem + (nSem === 1 ? " bloque" : " bloques") : "");
    const boton = sec.querySelector(".sec-toggle"), cuerpo = sec.querySelector(".sec-cuerpo");
    boton.setAttribute("aria-expanded", String(abierta)); cuerpo.inert = !abierta;
    boton.addEventListener("click", () => {
      const abrir = sec.classList.contains("cerrada");
      sec.classList.toggle("cerrada", !abrir); boton.setAttribute("aria-expanded", String(abrir)); cuerpo.inert = !abrir;
      listasAbiertas[l.id] = abrir; escribir("listas-abiertas-v1", listasAbiertas);
    });
    const anadir = tras => elegirPlantilla("Añadir a «" + l.nombre + "»", p => insertarEnLista(l, p.id, tras));
    const nuevaSemana = async tras => {
      const n = await pedirNombre("Nombre del bloque", "Semana " + (nSem + 1), "Por ejemplo «Semana 1», «Semana 4 · descarga», «Bloque de fuerza» o «Pretemporada». Dentro pondrás sus entrenamientos.");
      if (n) insertarEnLista(l, { sep: nuevoId(), titulo: n }, tras);
    };
    // Mesociclo: sin ninguno aún, agrupa todo lo que ya hay; si ya hay, empieza uno nuevo al final (o donde se pida)
    const nuevoGrupo = async tras => {
      const its = db.listas[l.id].items || [], nG = its.filter(esGrupoL).length;
      const n = await pedirNombre("Nombre del mesociclo", "Mesociclo " + (nG + 1), "Agrupa semanas o bloques: «Mesociclo 1», «Fase de base», «Pretemporada»… Lo que quede debajo va dentro, hasta el siguiente mesociclo.");
      if (!n) return;
      const pos = tras !== undefined ? tras : (nG ? its.length - 1 : -1);
      const fresca = db.listas[l.id], its2 = (fresca.items || []).slice();
      its2.splice(pos + 1, 0, { grupo: nuevoId(), titulo: n });
      listasAbiertas[l.id] = true; escribir("listas-abiertas-v1", listasAbiertas);
      guardarLista(fresca, { items: its2 });
    };
    const [bEnt, bSem] = sec.querySelectorAll(":scope > .sec-cuerpo .add-fila > .add-ej");
    bEnt.addEventListener("click", () => anadir());
    bSem.addEventListener("click", () => nuevaSemana());
    sec.querySelector(":scope > .sec-cuerpo .add-meso").addEventListener("click", () => nuevoGrupo());
    const menu = sec.querySelector(".lista-cab .menu-btn");
    menu.setAttribute("aria-label", "Opciones de la lista " + l.nombre);
    menu.addEventListener("click", () => abrirMenu(l.nombre, rec.length + (rec.length === 1 ? " entrenamiento" : " entrenamientos"), [
      { texto: "+ Añadir entrenamiento…", accion: () => anadir() },
      { texto: "+ Añadir bloque (semana, fase…)…", accion: () => nuevaSemana() },
      { texto: (l.items || []).some(esGrupoL) ? "+ Añadir mesociclo…" : "Agrupar en un mesociclo…", accion: () => nuevoGrupo() },
      rec.length && { texto: "Poner el siguiente («" + rec[sig].p.nombre + "») en un día…", accion: () => ponerEntrenoDeLista(l, rec[sig].p, rec[sig].k) },
      { texto: "Cambiar nombre…", accion: async () => { const n = await pedirNombre("Nombre de la lista", l.nombre); if (n) guardarLista(db.listas[l.id], { nombre: n }); } },
      { texto: "Eliminar lista", peligro: true, confirmar: "Los entrenamientos siguen en tus plantillas", accion: () => {
        const antes = [["listas", { ...l }]];
        cambiar("listas", { ...l, borrado: true }); pintarListas();
        avisoDeshacer("Lista «" + l.nombre + "» eliminada", antes);
      } }
    ]));
    const caja = sec.querySelector(".lista-ents");
    if (!(l.items || []).length) caja.innerHTML = '<p class="vacio-lista">Lista vacía. Añade entrenamientos con «+ Entrenamiento» (o guarda un día desde su ⋯) y, si quieres, sepáralos en semanas o bloques con «+ Semana o bloque».</p>';
    // Todo (entrenamientos y separadores) se ordena junto con el asa ≡: lo que quede debajo de una semana pasa a ella
    // Entrenamientos: se ordenan junto a las cabeceras de bloque (así se pueden meter en otro bloque); solo los visibles
    const hermanos = () => [...caja.querySelectorAll(".lista-ent, .lista-sep, .lista-gcab")].filter(x => x.offsetParent);
    const soltar = n => {
      const fresca = db.listas[l.id], items = fresca.items || [], actual = recorrerLista(fresca)[sig];
      // Lo que no se ve (bloques plegados o entrenos borrados) sigue pegado a su bloque; el resto, al final
      const enN = new Set(n.map(y => +y.dataset.i)), usados = new Set(enN), nuevo = [];
      n.forEach(y => {
        const i0 = +y.dataset.i;
        nuevo.push(items[i0]);
        // Lo plegado va con su cabecera: un bloque, hasta el siguiente bloque o mesociclo; un mesociclo, hasta el siguiente mesociclo
        if (esSep(items[i0])) for (let j = i0 + 1; j < items.length && !esSep(items[j]) && !esGrupoL(items[j]); j++) { if (!enN.has(j)) { nuevo.push(items[j]); usados.add(j); } }
        if (esGrupoL(items[i0])) for (let j = i0 + 1; j < items.length && !esGrupoL(items[j]); j++) { if (!enN.has(j)) { nuevo.push(items[j]); usados.add(j); } }
      });
      const todo = nuevo.concat(items.filter((x, i) => !usados.has(i)));
      // El «siguiente» sigue siendo el mismo entrenamiento tras moverlo
      const pos = actual ? n.findIndex(y => +y.dataset.i === actual.i) : -1;
      const nuevoSig = pos < 0 ? 0 : nuevo.slice(0, pos).filter(y => typeof y === "string" && db.plantillas[y] && !db.plantillas[y].borrado).length;
      guardarLista(fresca, { items: todo, siguiente: Math.max(0, nuevoSig) });
    };
    const finSeccion = i => { const its = l.items || []; let j = i; while (j + 1 < its.length && !esSep(its[j + 1]) && !esGrupoL(its[j + 1])) j++; return j; };
    const finGrupo = i => { const its = l.items || []; let j = i; while (j + 1 < its.length && !esGrupoL(its[j + 1])) j++; return j; };
    // Bloques (o mesociclos) enteros: se mueven con su asa ≡ y todo lo que llevan dentro va con ellos. Cada uno ocupa
    // el sitio de otro: así un bloque puede pasar a otro mesociclo y los mesociclos no se deshacen
    const reordenarTramos = (n, esTramo, fin) => {
      const fresca = db.listas[l.id], its = fresca.items || [];
      const segs = n.map(b => { const i0 = +b.dataset.i; return its.slice(i0, fin(i0) + 1); });
      const todo = []; let k2 = 0;
      for (let j = 0; j < its.length;) { if (esTramo(its[j])) { todo.push(...(segs[k2++] || [])); j = fin(j) + 1; } else { todo.push(its[j]); j++; } }
      return todo;
    };
    const soltarBloques = (n, grupos) => {
      const fresca = db.listas[l.id];
      const todo = grupos ? reordenarTramos(n, esGrupoL, finGrupo) : reordenarTramos(n, esSep, finSeccion);
      const actual = recorrerLista(fresca)[sig], idAct = actual ? actual.p.id : null;
      guardarLista(fresca, { items: todo, siguiente: 0 });
      if (idAct) { const nuevoK = recorrerLista(db.listas[l.id]).find(x => x.p.id === idAct); if (nuevoK) guardarLista(db.listas[l.id], { siguiente: nuevoK.k }); }
    };
    let k = 0, destino = caja, cajaG = caja;
    (l.items || []).forEach((x, i) => {
      if (esGrupoL(x)) {
        const g = document.createElement("div");
        g.className = "lista-grupo";
        g.dataset.i = i;
        const claveG = "g|" + x.grupo, plegado = listasAbiertas[claveG] !== true;
        g.classList.toggle("lg-plegado", plegado);
        const its = l.items || [], fin = finGrupo(i);
        const nB = its.slice(i + 1, fin + 1).filter(esSep).length, nE = its.slice(i + 1, fin + 1).filter(y => typeof y === "string" && db.plantillas[y] && !db.plantillas[y].borrado).length;
        const cab = document.createElement("div");
        cab.className = "lista-gcab";
        cab.dataset.i = i;
        cab.innerHTML = '<button type="button" class="lg-toggle"><span class="flecha-dia" aria-hidden="true">▸</span><span class="lg-tit"></span><span class="ls-n"></span></button><button type="button" class="menu-btn">⋯</button>';
        cab.querySelector(".lg-tit").textContent = x.titulo;
        cab.querySelector(".ls-n").textContent = (nB ? nB + (nB === 1 ? " semana/bloque · " : " semanas/bloques · ") : "") + nE + (nE === 1 ? " entrenamiento" : " entrenamientos");
        const tg = cab.querySelector(".lg-toggle");
        tg.setAttribute("aria-expanded", String(!plegado));
        tg.addEventListener("click", () => {
          const pl = !g.classList.contains("lg-plegado");
          g.classList.toggle("lg-plegado", pl); tg.setAttribute("aria-expanded", String(!pl));
          listasAbiertas[claveG] = !pl; escribir("listas-abiertas-v1", listasAbiertas);
        });
        cab.querySelector(".menu-btn").setAttribute("aria-label", "Opciones de " + x.titulo);
        cab.querySelector(".menu-btn").addEventListener("click", () => abrirMenu(x.titulo, cab.querySelector(".ls-n").textContent, [
          { texto: "+ Semana o bloque en este mesociclo…", accion: () => nuevaSemana(finGrupo(i)) },
          { texto: "+ Entrenamiento en este mesociclo…", accion: () => anadir(finGrupo(i)) },
          { texto: "Cambiar nombre…", accion: async () => {
            const n = await pedirNombre("Nombre del mesociclo", x.titulo);
            if (!n) return;
            guardarLista(db.listas[l.id], { items: (db.listas[l.id].items || []).map(y => esGrupoL(y) && y.grupo === x.grupo ? { ...y, titulo: n } : y) });
          } },
          { texto: "Duplicar (copia con sus semanas y entrenamientos)", accion: async () => {
            const n = await pedirNombre("Nombre de la copia", /\d+/.test(x.titulo) ? x.titulo.replace(/\d+/, d => String(+d + 1)) : x.titulo + " (copia)");
            if (!n) return;
            const its2 = (db.listas[l.id].items || []).slice(), f2 = finGrupo(i);
            const copia = its2.slice(i + 1, f2 + 1).map(y => esSep(y) ? { ...y, sep: nuevoId() } : y);
            its2.splice(f2 + 1, 0, { grupo: nuevoId(), titulo: n }, ...copia);
            guardarLista(db.listas[l.id], { items: its2 });
          } },
          { texto: "Quitar el mesociclo (sus semanas y entrenamientos se quedan)", accion: () => {
            const fresca = db.listas[l.id], antes = [["listas", { ...fresca }]];
            guardarLista(fresca, { items: (fresca.items || []).filter(y => !(esGrupoL(y) && y.grupo === x.grupo)) });
            avisoDeshacer("Agrupación «" + x.titulo + "» quitada", antes);
          } }
        ]));
        cab.appendChild(asaArrastre(g, () => [...caja.querySelectorAll(":scope > .lista-grupo")], n => soltarBloques(n, true), x.titulo));
        const cuerpoG = document.createElement("div");
        cuerpoG.className = "lg-cuerpo";
        g.append(cab, cuerpoG);
        caja.appendChild(g);
        destino = cajaG = cuerpoG;
        return;
      }
      if (esSep(x)) {
        const fs = document.createElement("div");
        fs.className = "lista-sep";
        fs.dataset.i = i;
        fs.innerHTML = '<span class="ls-tit"></span><span class="ls-n"></span><button type="button" class="menu-btn">⋯</button>';
        fs.querySelector(".ls-tit").textContent = x.titulo;
        const ents = (() => { let c = 0, j = i + 1; const its = l.items || []; while (j < its.length && !esSep(its[j])) { if (db.plantillas[its[j]] && !db.plantillas[its[j]].borrado) c++; j++; } return c; })();
        fs.querySelector(".ls-n").textContent = ents + (ents === 1 ? " entrenamiento" : " entrenamientos");
        fs.querySelector(".menu-btn").addEventListener("click", () => abrirMenu(x.titulo, "", [
          { texto: "+ Añadir entrenamiento aquí…", accion: () => anadir(finSeccion(i)) },
          { texto: "Empezar un mesociclo aquí (agrupa desde esta semana)…", accion: () => nuevoGrupo(i - 1) },
          { texto: "Duplicar (copia con los mismos entrenamientos)", accion: async () => {
            const n = await pedirNombre("Nombre de la copia", x.titulo.replace(/\d+/, d => String(+d + 1)) === x.titulo ? x.titulo + " (copia)" : x.titulo.replace(/\d+/, d => String(+d + 1)));
            if (!n) return;
            const its = (db.listas[l.id].items || []).slice(), fin = finSeccion(i);
            its.splice(fin + 1, 0, { sep: nuevoId(), titulo: n }, ...its.slice(i + 1, fin + 1));
            guardarLista(db.listas[l.id], { items: its });
          } },
          { texto: "Cambiar nombre…", accion: async () => {
            const n = await pedirNombre("Nombre de la semana o bloque", x.titulo);
            if (!n) return;
            const its = (db.listas[l.id].items || []).map(y => esSep(y) && y.sep === x.sep ? { ...y, titulo: n } : y);
            guardarLista(db.listas[l.id], { items: its });
          } },
          { texto: "Quitar el bloque (sus entrenamientos se quedan en la lista)", accion: () => {
            const fresca = db.listas[l.id], antes = [["listas", { ...fresca }]];
            guardarLista(fresca, { items: (fresca.items || []).filter(y => !(esSep(y) && y.sep === x.sep)) });
            avisoDeshacer("«" + x.titulo + "» quitada", antes);
          } }
        ]));
        // Caja del bloque: cabecera (toca para plegar) y sus entrenamientos dentro
        const caj = document.createElement("div");
        caj.className = "lista-bloque";
        caj.dataset.i = i;
        const claveB = "b|" + x.sep, plegado = listasAbiertas[claveB] !== true;
        caj.classList.toggle("lb-plegado", plegado);
        const tit = fs.querySelector(".ls-tit");
        const tg = document.createElement("button");
        tg.type = "button"; tg.className = "ls-toggle";
        tg.innerHTML = '<span class="flecha-dia" aria-hidden="true">▸</span>';
        tg.setAttribute("aria-expanded", String(!plegado));
        tit.before(tg); tg.appendChild(tit); tg.appendChild(fs.querySelector(".ls-n"));
        tg.addEventListener("click", () => {
          const pl = !caj.classList.contains("lb-plegado");
          caj.classList.toggle("lb-plegado", pl); tg.setAttribute("aria-expanded", String(!pl));
          listasAbiertas[claveB] = !pl; escribir("listas-abiertas-v1", listasAbiertas);
        });
        fs.appendChild(asaArrastre(caj, () => [...caja.querySelectorAll(".lista-bloque")].filter(y => y.offsetParent), n => soltarBloques(n, false), x.titulo));
        const cuerpoB = document.createElement("div");
        cuerpoB.className = "lb-cuerpo";
        const add = document.createElement("div");
        add.className = "add-fila lb-add";
        add.innerHTML = '<button type="button" class="add-ej">+ Entrenamiento en este bloque</button>';
        add.firstChild.addEventListener("click", () => anadir(finSeccion(i)));
        caj.append(fs, cuerpoB, add);
        cajaG.appendChild(caj);
        destino = cuerpoB;
        return;
      }
      const p = db.plantillas[x];
      if (!p || p.borrado) return;
      const kk = k++;
      const fila = document.createElement("div");
      fila.className = "lista-ent" + (kk === sig ? " es-siguiente" : "");
      fila.dataset.i = i;
      fila.innerHTML = '<div class="le-cab"><span class="le-n"></span><button type="button" class="le-nombre"><span class="le-tit"></span><span class="le-res"></span></button><button type="button" class="anadir le-dia">+ Día</button><button type="button" class="menu-btn">⋯</button></div><div class="le-prev" hidden></div>';
      fila.querySelector(".le-n").textContent = kk + 1;
      fila.querySelector(".le-tit").textContent = p.nombre;
      if (kk === sig && rec.length > 1) { const b = document.createElement("span"); b.className = "le-sig"; b.textContent = "siguiente"; fila.querySelector(".le-tit").appendChild(b); }
      fila.querySelector(".le-res").textContent = resumenItems(p.items || []);
      const prev = fila.querySelector(".le-prev");
      fila.querySelector(".le-nombre").addEventListener("click", () => {
        if (!prev.childNodes.length) prev.appendChild(listaItems(p.items || []));
        prev.hidden = !prev.hidden;
      });
      fila.querySelector(".le-dia").setAttribute("aria-label", "Poner «" + p.nombre + "» en un día");
      fila.querySelector(".le-dia").addEventListener("click", () => ponerEntrenoDeLista(l, p, kk));
      const m = fila.querySelector(".le-cab .menu-btn");
      m.setAttribute("aria-label", "Opciones de " + p.nombre);
      m.addEventListener("click", () => abrirMenu(p.nombre, resumenItems(p.items || []), [
        { texto: "Poner en un día…", accion: () => ponerEntrenoDeLista(l, p, kk) },
        kk !== sig && { texto: "Marcar como el siguiente", accion: () => guardarLista(db.listas[l.id], { siguiente: kk }) },
        { texto: "Repetir debajo", accion: () => insertarEnLista(l, p.id, i) },
        { texto: "Añadir también a otra lista…", accion: () => elegirLista("¿A qué lista?", l2 => insertarEnLista(l2, p.id)) },
        { texto: "Quitar de la lista", accion: () => {
          const fresca = db.listas[l.id], antes = [["listas", { ...fresca }]];
          const its = (fresca.items || []).slice(); its.splice(i, 1);
          guardarLista(fresca, { items: its, siguiente: kk < sig ? Math.max(0, sig - 1) : sig });
          avisoDeshacer("«" + p.nombre + "» quitado de la lista (sigue en tus plantillas)", antes);
        } }
      ]));
      if ((l.items || []).length > 1) fila.querySelector(".le-cab").appendChild(asaArrastre(fila, hermanos, soltar, p.nombre));
      destino.appendChild(fila);
    });
    cont.appendChild(sec);
  });
}
$("nuevaLista").addEventListener("click", () => nuevaLista());
function tarjetaEjercicio(e) {
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
  return t;
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
// Tramo del vídeo: el inicio que trae el enlace de YouTube (?t=90, ?t=1m30s, &start=) y el final (&end=), o un tramo
// escrito detrás del enlace con un espacio: «https://youtu.be/xxxx 1:30-2:15» (desde 1:30 hasta 2:15)
function tramoYoutube(u) {
  const seg = t => { t = String(t || "").trim(); if (!t) return 0; if (/^\d+$/.test(t)) return +t; const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/); if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); const p = t.split(":").map(Number); return p.some(isNaN) ? 0 : p.reduce((a, x) => a * 60 + x, 0); };
  let inicio = 0, fin = 0;
  const partes = String(u || "").trim().split(/\s+/), extra = partes.slice(1).join(" ");
  try { const x = new URL(partes[0]); inicio = seg(x.searchParams.get("t") || x.searchParams.get("start")); fin = seg(x.searchParams.get("end")); } catch {}
  const m = extra.match(/^(\d[\d:]*)\s*(?:-|a|hasta)\s*(\d[\d:]*)$/) || extra.match(/^(\d[\d:]*)$/);
  if (m) { inicio = seg(m[1]); if (m[2]) fin = seg(m[2]); }
  return { inicio, fin: fin > inicio ? fin : 0 };
}
function idYoutube(u) {
  u = String(u || "").trim().split(/\s+/)[0];
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
  ponerVideo(cont, e);
  $("detBuscar").href = "https://www.youtube.com/results?search_query=" + encodeURIComponent((e.nombre || "") + " técnica");
}
// El vídeo del ejercicio: la miniatura de YouTube abre el visor; otros enlaces (Instagram…) se abren aparte
function ponerVideo(cont, e) {
  const yt = idYoutube(e.video_url);
  if (yt) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "video-mini" + (esShort(e.video_url) ? " vertical" : "");
    b.setAttribute("aria-label", "Ver el vídeo de " + (e.nombre || "este ejercicio"));
    b.innerHTML = '<img alt="" loading="lazy"><span aria-hidden="true">▶</span>';
    b.querySelector("img").src = "https://i.ytimg.com/vi/" + encodeURIComponent(yt) + "/hqdefault.jpg";
    b.addEventListener("click", ev => { ev.stopPropagation(); verVideo(e); });
    cont.appendChild(b);
    const a = document.createElement("a");
    a.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(yt) + (tramoYoutube(e.video_url).inicio ? "&t=" + tramoYoutube(e.video_url).inicio + "s" : ""); a.target = "_blank"; a.rel = "noopener"; a.className = "enlace";
    a.textContent = "Abrir en YouTube";
    cont.appendChild(a);
  } else if (/^https?:\/\//i.test(e.video_url)) {
    const a = document.createElement("a");
    a.href = e.video_url; a.target = "_blank"; a.rel = "noopener"; a.className = "abrir-video";
    a.textContent = "▶ Abrir vídeo";
    cont.appendChild(a);
  }
}
const esShort = u => /\/shorts\//i.test(u || "");
// Visor de vídeo: ventana centrada fuera del <body> (no le afecta la ampliación del ordenador, que descuadraba
// algunos vídeos); los Shorts se ven en vertical y completos
// Vacía el reproductor también antes del cierre para liberar su audio.
function liberarVideo(d) {
  const marco = d && d.querySelector(".vv-marco");
  if (!marco) return;
  marco.querySelectorAll("iframe").forEach(f => { f.src = "about:blank"; f.remove(); });
  marco.textContent = "";
}
function verVideo(e) {
  const yt = idYoutube(e.video_url);
  if (!yt) { const u0 = String(e.video_url || "").trim().split(/\s+/)[0]; if (/^https?:\/\//i.test(u0)) window.open(u0, "_blank", "noopener"); return; }
  let d = document.getElementById("visorVideo");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "visorVideo";
    d.innerHTML = '<div class="vv-caja"><div class="vv-cab"><span class="vv-tit"></span><button type="button" class="vv-cerrar" aria-label="Cerrar el vídeo">✕</button></div><div class="vv-marco"></div><a class="vv-yt" target="_blank" rel="noopener">Abrir en YouTube</a></div>';
    document.documentElement.appendChild(d);
    const cerrar = () => { liberarVideo(d); if (d.open) d.close(); };
    d.querySelector(".vv-cerrar").addEventListener("click", cerrar);
    d.addEventListener("click", ev => { if (ev.target === d) cerrar(); });
    d.addEventListener("cancel", () => liberarVideo(d));
    d.addEventListener("close", () => liberarVideo(d));
  }
  d.classList.toggle("vertical", esShort(e.video_url));
  d.querySelector(".vv-tit").textContent = e.nombre || "Vídeo";
  d.querySelector(".vv-yt").href = "https://www.youtube.com/watch?v=" + encodeURIComponent(yt) + (tramoYoutube(e.video_url).inicio ? "&t=" + tramoYoutube(e.video_url).inicio + "s" : "");
  const f = document.createElement("iframe");
  const tr = tramoYoutube(e.video_url);
  f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(yt) + "?playsinline=1&rel=0&autoplay=1" + (tr.inicio ? "&start=" + tr.inicio : "") + (tr.fin ? "&end=" + tr.fin : "");
  f.title = "Vídeo: " + (e.nombre || "");
  f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
  f.allowFullscreen = true;
  f.referrerPolicy = "strict-origin-when-cross-origin";   // YouTube necesita saber desde qué web se reproduce
  const marco = d.querySelector(".vv-marco");
  liberarVideo(d);
  marco.appendChild(f);
  if (!d.open) d.showModal();
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
  svg += '<text class="gn-txt" x="' + pl + '" y="' + (y(max) - 5) + '">' + etiqueta(Math.max.apply(null, vals)) + "</text>";
  svg += '<text class="gn-txt" x="' + pl + '" y="' + (H - 6) + '">' + fechaCorta(puntos[0].f) + "</text>";
  svg += '<text class="gn-txt" x="' + (W - pr) + '" y="' + (H - 6) + '" text-anchor="end">' + fechaCorta(puntos[puntos.length - 1].f) + "</text>";
  return svg + "</svg>";
}
function refrescarDetalle() {
  const e = ejercicioVivo(detalleId);
  if (!e) { if ($("detalle").open) $("detalle").close(); return; }
  const st = estadisticas(e.id), tipo = st.tipo;
  $("detTipo").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tipo === tipo)));
  const medida = tipo === "fuerza" ? medidaDe(e.id) : "";
  $("detMedidaSec").hidden = tipo !== "fuerza" && tipo !== "movilidad";
  $("detMedida").hidden = tipo !== "fuerza"; $("detMedidaInfo").hidden = tipo !== "fuerza";
  $("detLado").checked = ladoDe(e.id);
  if (tipo === "fuerza") {
    $("detMedida").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.m === medida)));
    const puesta = MEDIDAS[(db.personales[e.id] || {}).medida];
    $("detMedidaInfo").textContent = puesta ? "Elegido por ti." : "Automático (por el nombre y lo que apuntas): " + MEDIDAS[medida].toLowerCase() + ". Toca otra opción si no encaja.";
  }
  const fuerza = tipo === "fuerza" && medida === "peso";
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
  } else if (tipo === "movilidad") {
    const segs = x => n0(x.tiempo) * (x.por_lado ? 2 : 1);
    rec.appendChild(recuadro("Sesiones", String(st.sesiones.length), st.lista.length + " series", true));
    if (st.tiempoTotal > 0) rec.appendChild(recuadro("Tiempo total", fmtSegs(st.tiempoTotal), "contando los dos lados"));
    $("detGraficaTit").textContent = "Progreso · minutos por sesión";
    puntos = st.sesiones.slice(-12).map(s => ({ f: s.fecha, v: Math.round(s.series.reduce((m, x) => m + segs(x), 0) / 6) / 10 }));
    etiqueta = v => num(v) + " min";
  } else if (medida === "reps" || medida === "tiempo") {
    // Peso corporal: el récord son las repeticiones (o el tiempo) máximas de una serie
    const campo = medida === "reps" ? "reps" : "tiempo", fmtV = v => medida === "reps" ? v + " reps" : fmtSegs(v);
    const val = st.lista.filter(x => n0(x[campo]) > 0 && !x.calentamiento);
    const mejor = val.reduce((m, x) => !m || n0(x[campo]) > n0(m[campo]) ? x : m, null);
    if (mejor) rec.appendChild(recuadro(medida === "reps" ? "Máximo de repeticiones" : "Tiempo máximo", fmtV(n0(mejor[campo])), (n0(mejor.peso) > 0 ? "con " + num(mejor.peso) + " kg · " : "") + fechaCorta(mejor.fecha), true));
    rec.appendChild(recuadro("Sesiones", String(st.sesiones.length), st.lista.length + " series"));
    $("detGraficaTit").textContent = "Progreso · " + (medida === "reps" ? "repeticiones máximas" : "tiempo máximo") + " por sesión";
    puntos = st.sesiones.slice(-12).map(x => ({ f: x.fecha, v: Math.max.apply(null, x.series.map(y => n0(y[campo])).concat(0)) }));
    etiqueta = v => medida === "reps" ? num(v) + " reps" : fmtSegs(Math.round(v));
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
  const hist = $("detHistorial"), prs = prsDe(st.lista, tipo, tipo === "fuerza" ? medidaDe(e.id) : "");
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
$("detLado").addEventListener("change", () => {
  if (!detalleId) return;
  const p = db.personales[detalleId] || { ejercicio_id: detalleId, rm: 0 };
  cambiar("personales", { ...p, ejercicio_id: detalleId, rm: n0(p.rm), lado: $("detLado").checked });
  // Las series pendientes de este ejercicio pasan a «por lado» (o dejan de serlo); las hechas no se tocan
  Object.values(db.series).filter(x => x.ejercicio_id === detalleId && !x.borrado && !hecha(x)).forEach(x => cambiar("series", { ...x, por_lado: $("detLado").checked }, true));
  persistir(); pintarBloques(true);
});
$("detMedida").addEventListener("click", ev => {
  const x = ev.target.closest("button[data-m]");
  if (!x || !detalleId) return;
  const p = db.personales[detalleId] || { ejercicio_id: detalleId, rm: 0 };
  // Tocar la que ya sale automática la deja fija; así no cambia aunque cambien las series
  cambiar("personales", { ...p, ejercicio_id: detalleId, rm: n0(p.rm), medida: x.dataset.m });
  indiceSeries().prs[detalleId] = null;
  refrescarDetalle(); pintarBloques(true);
});
$("detRm").addEventListener("change", () => {
  const v = parseFloat(($("detRm").value || "0").replace(",", "."));
  cambiar("personales", { ...(db.personales[detalleId] || {}), ejercicio_id: detalleId, rm: v > 0 ? v : 0 });
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
  let u = $("detVideo").value.trim().replace(/\s+/g, " ");
  if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
  $("detVideo").value = u;
  editarEjercicio({ video_url: u });
  pintarVideo(db.ejercicios[detalleId]);
});
$("detNotas").addEventListener("change", () => editarEjercicio({ notas: $("detNotas").value }));
$("detBorrar").addEventListener("click", () => {
  if (!puedeQuitarDelCatalogo(ejercicioVivo(detalleId))) return;
  confirmar("¿Eliminar este ejercicio?", "Se borra con todas sus series.").then(ok => { if (!ok) return;
    editarEjercicio({ borrado: true });
    $("detalle").close();
  });
});
$("detalle").addEventListener("close", () => {
  $("detEmbed").textContent = "";   // para que el vídeo deje de sonar
  pintarTodo();
});

// ---------- Rendimiento: marcas, forma (VDOT de Daniels), predicciones y ritmos objetivo ----------
// Son estimaciones orientativas calculadas con las series hechas.
const DIST_MARCAS = [100, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 3000, 5000, 10000, 21097, 42195];
// Marcas con décimas cuando las hay (100 m en 13,2 s; o una marca sacada de una serie más larga): sin redondear
const fmtMarca = seg => {
  const t = n0(seg);
  if (t >= 3600 || Math.abs(t - Math.round(t)) < 0.05) return fmtTiempo(t);
  const d = Math.round(t * 10) / 10, m = Math.floor(d / 60), x = d - m * 60;
  return m + ":" + (x < 10 ? "0" : "") + x.toFixed(1).replace(".", ",");
};
const DIST_NADO = [50, 100, 200, 400, 800, 1500];
const nombreDist = d => ({ 250: "250 m", 1000: "1 km", 2000: "2 km", 21097: "Media maratón", 42195: "Maratón" })[d] || fmtDist(d);
const vo2 = v => -4.6 + 0.182258 * v + 0.000104 * v * v;                                   // v en m/min
// t en min; por debajo de 5 min la fórmula de Daniels deja de ser fiable, así que se toma 5 como mínimo
const fraccion = t => { t = Math.max(t, 5); return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t); };
const vdotDe = (m, seg) => vo2(m / (seg / 60)) / fraccion(seg / 60);
const velDeVo2 = o => (-0.182258 + Math.sqrt(0.182258 * 0.182258 + 4 * 0.000104 * (4.6 + o))) / (2 * 0.000104);
const ritmoZona = (vdot, fr) => 1000 / velDeVo2(vdot * fr) * 60;                           // segundos por km
const ZONAS = [["Suave (rodaje)", 0.70], ["Maratón", 0.80], ["Umbral", 0.88], ["Series 1000 m (intervalos)", 0.975], ["Series 200–400 m (ritmo)", 1.05]];
const esRecuperacion = id => /trote|recuper|suave|rodaje|calent|calma/.test(norm(nombreEj(id)));
// Sumatorio de distancia de carrera y natación: lo hecho (series, recuperaciones en metros, calentamiento y vuelta a la calma) y lo planificado
const esCalentamiento = s => !!s.calentamiento || /calent|calma/.test(norm(nombreEj(s.ejercicio_id)));
function totalesDistancia(series) {
  const r = {};
  series.forEach(s => {
    const t = tipoDe(s.ejercicio_id);
    if (t !== "carrera" && t !== "natacion") return;
    const x = r[t] = r[t] || { hecho: 0, plan: 0, tiempo: 0, efectivo: 0, rec: 0, calent: 0, pendientes: 0 };
    const d = n0(s.distancia), rec = n0(s.rec_dist);
    x.plan += d + rec;
    if (!hecha(s)) { x.pendientes++; return; }
    x.hecho += d + rec; x.rec += rec;
    x.tiempo += n0(s.tiempo) + (rec > 0 ? n0(s.descanso) : 0);   // la recuperación en movimiento también es tiempo corriendo
    if (esCalentamiento(s)) x.calent += d; else x.efectivo += d;
  });
  return r;
}
const miles = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const fmtTotal = (t, m) => t === "carrera" ? (m / 1000).toFixed(2).replace(".", ",") + " km" : miles(m) + " m";
// «Total carrera: 7,30 km · 32:10 · series 4,20 km · rec. 1,20 km» (con lo pendiente aparte); null si no hay carrera ni natación
function lineasTotal(series) {
  const tot = totalesDistancia(series);
  return Object.keys(tot).filter(t => tot[t].plan > 0 || tot[t].tiempo > 0).map(t => {
    const x = tot[t], f = m => fmtTotal(t, m), nombre = t === "carrera" ? "carrera" : "natación";
    const partes = [x.efectivo && (x.rec || x.calent) ? "series " + f(x.efectivo) : "", x.rec ? "rec. " + f(x.rec) : "", x.calent ? "calent. y calma " + f(x.calent) : ""].filter(Boolean);
    const principal = !x.hecho && x.pendientes ? "Planificado " + nombre + ": " + f(x.plan)
      : "Total " + nombre + ": " + (x.pendientes && x.plan > x.hecho ? "hecho " + f(x.hecho) + " de " + f(x.plan) + " planificados" : f(x.hecho));
    return { tipo: t, texto: principal, detalle: [x.tiempo ? fmtTiempo(x.tiempo) : ""].concat(x.hecho ? partes : []).filter(Boolean).join(" · "), corto: f(x.hecho || x.plan) };
  });
}
function pieTotal(series, deDia) {
  const ls = lineasTotal(series);
  if (!ls.length) return null;
  const pie = document.createElement("div");
  pie.className = "total-dist" + (deDia ? " del-dia" : "");
  ls.forEach(l => {
    const p = document.createElement("p");
    p.className = "t-" + l.tipo;
    p.innerHTML = "<b></b><span></span>";
    p.firstChild.textContent = (deDia ? l.texto.replace(/^Total /, "Total del día · ") : l.texto);
    p.lastChild.textContent = l.detalle ? " · " + l.detalle : "";
    pie.appendChild(p);
  });
  // Pulsaciones de la sesión: media ponderada por tiempo y máxima
  const conFc = series.filter(s => hecha(s) && n0(s.fc_media) > 0 && n0(s.tiempo) > 0);
  if (conFc.length) {
    const t = conFc.reduce((x, s) => x + n0(s.tiempo), 0), p = document.createElement("p");
    p.className = "t-fc";
    p.textContent = "♥ media " + Math.round(conFc.reduce((x, s) => x + n0(s.fc_media) * n0(s.tiempo), 0) / t) + " · máx " + Math.max(...conFc.map(s => n0(s.fc_max) || n0(s.fc_media))) + " ppm";
    pie.appendChild(p);
  }
  const z = tiempoZonas(sumaHist(series.map(s => s.fc_hist)));
  if (z) pie.appendChild(barraZonas(z));
  return pie;
}
const esTrote = id => /trote|recuper/.test(norm(nombreEj(id)));   // los trotes entre series cuentan como recuperación
function tiempoPrevisto(vdot, m) {
  let lo = m / 600 * 60, hi = m / 50 * 60;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (vdotDe(m, mid) > vdot) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
// La recuperación en metros se supone trotando a ~60 % de la velocidad de la serie
// Recuperar trotando (o en metros) descansa menos que parado: su tiempo cuenta al 60 % como descanso
const segRec = (s, v) => n0(s.rec_dist) > 0 ? (n0(s.descanso) > 0 ? n0(s.descanso) : n0(s.rec_dist) / (v * 0.6) * 60) * 0.6 : n0(s.descanso);
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
  const trotes = ses.trotes.reduce((x, s) => x + (n0(s.tiempo) > 0 ? n0(s.tiempo) : n0(s.distancia) / (v * 0.6) * 60) * 0.6, 0);
  return (enSeries + trotes) / (n - 1);
}
// VDOT de la sesión entera: todas las series, volumen, recuperaciones y si el ritmo se mantuvo o cayó
function vdotSesion(ses) {
  const reps = ses.trabajo.filter(s => hecha(s) && n0(s.tiempo) > 0);
  if (!reps.length) return null;
  const metros = reps.reduce((x, s) => x + n0(s.distancia), 0), seg = reps.reduce((x, s) => x + tiempoLlano(s), 0);
  if (reps.length === 1 && metros < 3000) return null;   // una serie corta suelta no dice nada de la forma
  const v = metros / (seg / 60), recMedia = recuperacionMedia({ trabajo: reps, trotes: ses.trotes.filter(hecha) }, v);
  // Con todo el entrenamiento: nº de series, volumen y descanso (tipo y duración) dan la duración equivalente de esfuerzo
  let vdot = vo2(v) / fraccion(duracionEquivalente(seg, seg / reps.length, recMedia) / 60), caida = 0, deriva = 0, conFc = false;
  const activa = reps.some(s => n0(s.rec_dist) > 0) || ses.trotes.some(hecha);
  const factores = [reps.length + (reps.length === 1 ? " serie de " : " series, ") + fmtDist(metros) + " en " + fmtTiempo(seg) + (reps.length > 1 && recMedia ? " · descanso efectivo " + fmtTiempo(recMedia) + " por serie" + (activa ? " (la recuperación trotando cuenta al 60 %)" : " (parado)") : "")];
  if (reps.some(s => n0(s.ritmo_ajustado) > 0)) factores.push("ritmo ajustado por desnivel");
  const r = s => tiempoLlano(s) / n0(s.distancia), k = Math.max(1, Math.floor(reps.length / 3)), media = (l, f) => l.reduce((x, s) => x + f(s), 0) / l.length;
  if (reps.length >= 3) caida = media(reps.slice(-k), r) / media(reps.slice(0, k), r) - 1;
  // Pulsaciones: qué % de tu FC máxima alcanzaste (si no fue cerca del máximo, no fuiste a tope) y cuánto subió de una serie a otra
  const fcMax = fcMaxima(), conPulso = reps.filter(s => n0(s.fc_pico) > 0 || n0(s.fc_media) > 0), fcDe = s => reps.length === 1 ? n0(s.fc_media) || n0(s.fc_pico) : n0(s.fc_pico) || n0(s.fc_media);   // continua: la media; series: el pico de cada una
  if (fcMax > 0 && conPulso.length) {
    const pct = media(conPulso, fcDe) / fcMax;
    factores.push("FC al " + Math.round(pct * 100) + " % de tu máxima (" + fcMax + ")");
    if (conPulso.length >= 3) {
      const kk = Math.max(1, Math.floor(conPulso.length / 3)), coste = s => (n0(s.fc_media) || fcDe(s)) * r(s);   // pulsaciones por ritmo
      deriva = media(conPulso.slice(-kk), coste) / media(conPulso.slice(0, kk), coste) - 1;
      factores.push("deriva cardiaca " + (deriva >= 0 ? "+" : "−") + Math.abs(Math.round(deriva * 100)) + " %");
    }
    // %VO2máx ≈ (%FCmáx − 37) / 64 (Londeree); en series cortas (< 2 min) la FC no llega a reflejar el esfuerzo
    if (pct < 0.97 && (reps.length === 1 || seg / reps.length >= 120)) {
      const frac = Math.max(0.55, Math.min(1, (pct * 100 - 37) / 64)), vFc = Math.min(vo2(v) / frac, vdot * (reps.length === 1 ? 1.35 : 1.12));
      if (vFc > vdot) { vdot = vFc; conFc = true; factores.push("no fue a tope: se extrapola tu ritmo máximo"); }
    }
  }
  // Si el ritmo cayó o el pulso se disparó al final, estuviste cerca del límite; si no, aún tenías margen (hasta +3 %)
  if (reps.length >= 3) {
    const fatiga = Math.max(0, caida, deriva / 2);
    vdot *= 1 + Math.max(0, 0.03 - fatiga);
    factores.push(caida > 0.02 ? "el ritmo cayó al final" : "ritmo mantenido");
  }
  return { vdot, reps: reps.length, metros, seg, recMedia, caida, deriva, conFc, factores };
}
// ---------- Mis carreras (competiciones): marcas oficiales que pesan más en la forma ----------
const tiempoCarrera = c => n0(c.chip) || n0(c.tiempo);   // el de chip es el que corriste tú; si no, el oficial
const esMarcaManual = c => c.categoria === "__marca";
const marcasManuales = () => vivos("carreras").filter(c => esMarcaManual(c) && n0(c.distancia) > 0 && n0(c.tiempo) > 0);
const carrerasHechas = () => vivos("carreras").filter(c => !esMarcaManual(c) && c.fecha && c.fecha <= iso(new Date()) && tiempoCarrera(c) > 0 && n0(c.distancia) > 0);
const carrerasProximas = () => vivos("carreras").filter(c => !esMarcaManual(c) && c.fecha && c.fecha > iso(new Date())).sort((a, b) => a.fecha.localeCompare(b.fecha));
// Forma: media ponderada de las mejores sesiones de las últimas 12 semanas; lo reciente pesa más (vida media 6 semanas)
function calcularForma() {
  const hoy = new Date();
  const fechas = [...new Set(seriesVivas().filter(s => hecha(s) && tipoDe(s.ejercicio_id) === "carrera").map(s => s.fecha))];
  const lista = fechas.map(fecha => {
    const r = vdotSesion(sesionCarrera(fecha)), dias = Math.max(0, (hoy - deIso(fecha)) / 864e5);
    if (!r || r.vdot < 20 || r.vdot > 90 || dias > 84) return null;
    const peso = Math.pow(0.5, dias / 42);
    return { ...r, fecha, peso, puntos: r.vdot - 3 * (1 - peso) };
  }).filter(Boolean).concat(carrerasHechas().map(c => {
    // Una carrera oficial es un esfuerzo máximo real: su VDOT es directo y pesa un 50 % más
    const dias = Math.max(0, (hoy - deIso(c.fecha)) / 864e5), vdot = vdotDe(n0(c.distancia), tiempoCarrera(c));
    if (dias > 84 || vdot < 20 || vdot > 90) return null;
    const peso = Math.pow(0.5, dias / 42) * 1.5;
    return { vdot, fecha: c.fecha, peso, puntos: vdot - 3 * (1 - Math.min(1, peso)), reps: 1, metros: n0(c.distancia), seg: tiempoCarrera(c), recMedia: 0, caida: 0, carrera: c.nombre, factores: ["carrera oficial «" + c.nombre + "»: " + nombreDist(n0(c.distancia)) + " en " + fmtTiempo(tiempoCarrera(c)) + " (marca real, pesa un 50 % más)"] };
  }).filter(Boolean)).sort((x, y) => y.puntos - x.puntos).filter((s, i, todas) => s.puntos >= todas[0].puntos - 3).slice(0, 3);   // un día suave no rebaja la forma
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
    hechas.forEach((x, i) => { suma += (i + 1) * tiempoLlano(x) / tiempoObj(x); pesos += i + 1; });
    const corr = Math.max(-0.03, Math.min(0.05, 0.5 * (suma / pesos - 1)));
    tiempo *= 1 + corr;
    ajustado = Math.abs(corr) > 0.005;
  }
  return { tiempo, ritmo: tiempo / n0(s.distancia) * 1000, ajustado, fatiga: fatiga > 0 };
}
const textoObjetivo = o => !o ? "" : (o.suave ? "obj. suave ~" + fmtTiempo(o.ritmo) + "/km"
  : "obj. " + fmtTiempo(o.tiempo) + " · " + fmtTiempo(o.ritmo) + "/km" + (o.ajustado ? " · ajustado a cómo vas" : "")) + (o.fatiga ? " · más suave por tu esfuerzo" : "");
// Mejores marcas por distancia: exactas o, dentro de una serie algo más larga, a su ritmo medio
function marcasDe(tipo) {
  const lista = seriesVivas().filter(s => hecha(s) && !s.calentamiento && tipoDe(s.ejercicio_id) === tipo && n0(s.distancia) > 0 && n0(s.tiempo) > 0 && !fueraDeMarcas(s))
    .concat(tipo === "carrera" ? carrerasHechas().map(c => ({ fecha: c.fecha, distancia: n0(c.distancia), tiempo: tiempoCarrera(c), carrera: true })) : [])
    .concat(tipo === "carrera" ? marcasManuales().map(c => ({ fecha: c.fecha, distancia: n0(c.distancia), tiempo: n0(c.tiempo), manual: true })) : []);   // las carreras oficiales son marcas reales
  return (tipo === "natacion" ? DIST_NADO : DIST_MARCAS).map(d => {
    let mejor = null;
    const evol = {};
    lista.filter(s => n0(s.distancia) >= d && n0(s.distancia) <= d * 3).forEach(s => {
      const exacta = n0(s.distancia) === d, t = exacta ? tiempoLlano(s) : tiempoLlano(s) * d / n0(s.distancia);
      if (!mejor || t < mejor.t) mejor = { t, fecha: s.fecha, exacta };
      if (!evol[s.fecha] || t < evol[s.fecha]) evol[s.fecha] = t;
    });
    return mejor ? { d, ...mejor, evol: Object.keys(evol).sort().map(f => ({ f, v: evol[f] })) } : null;
  }).filter(Boolean);
}
// Cada apartado de Marcas se pliega tocando su título (se recuerda en este dispositivo)
function seccionMarcas(titulo) {
  const s = document.createElement("section");
  const k = "s:" + titulo;
  s.className = "plan-sec ms-plegable" + (marcasAbiertas[k] === true ? "" : " plegada");
  const h = document.createElement("h3");
  h.className = "ms-tit";
  h.innerHTML = '<span class="flecha-dia" aria-hidden="true">▸</span><span></span>';
  h.lastChild.textContent = titulo;
  h.tabIndex = 0; h.setAttribute("role", "button");
  h.setAttribute("aria-expanded", String(marcasAbiertas[k] === true));
  const alternar = () => { const pl = !s.classList.contains("plegada"); s.classList.toggle("plegada", pl); h.setAttribute("aria-expanded", String(!pl)); marcasAbiertas[k] = !pl; escribir("marcas-abiertas-v1", marcasAbiertas); };
  h.addEventListener("click", alternar);
  h.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternar(); } });
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
// Marcas en tres apartados desplegables (como el catálogo): Fuerza por zonas del cuerpo, Carrera y Piscina
let marcasAbiertas = {}; // apartados de Marcas empiezan plegados en cada apertura
function apartadoMarcas(cont, clave, titulo, n) {
  const abierta = marcasAbiertas[clave] === true;
  const sec = document.createElement("section");
  sec.className = "cat-sec marcas-sec t-" + clave + (abierta ? "" : " cerrada");
  sec.innerHTML = '<button type="button" class="sec-toggle"><span class="flecha-dia" aria-hidden="true">▸</span><h3></h3><span class="sec-n"></span></button><div class="sec-cuerpo"><div class="sec-cuerpo-in"></div></div>';
  sec.querySelector("h3").textContent = titulo;
  sec.querySelector(".sec-n").textContent = n ? "· " + n : "";
  const boton = sec.querySelector(".sec-toggle"), cuerpo = sec.querySelector(".sec-cuerpo");
  boton.setAttribute("aria-expanded", String(abierta));
  cuerpo.inert = !abierta;
  boton.addEventListener("click", () => {
    const abrir = sec.classList.contains("cerrada");
    sec.classList.toggle("cerrada", !abrir);
    boton.setAttribute("aria-expanded", String(abrir));
    cuerpo.inert = !abrir;
    marcasAbiertas[clave] = abrir;
    escribir("marcas-abiertas-v1", marcasAbiertas);
    if (abrir) verAlAbrir(sec);
  });
  cont.appendChild(sec);
  return sec.querySelector(".sec-cuerpo-in");
}
// Zona del cuerpo de un ejercicio de fuerza: por su nombre (brazos, core) o por las zonas que trabaja
const ZONAS_REGION = [["Pierna", ["Cadera", "Glúteo", "Isquios", "Rodilla", "Gemelo", "Tobillo", "Pie"]], ["Torso", ["Pecho", "Espalda alta", "Hombro", "Cuello"]], ["Brazos", ["Codo", "Muñeca"]], ["Core", ["Lumbar"]]];
function regionEjercicio(id) {
  const n = norm(nombreEj(id));
  if (/curl(?! femoral)|triceps|biceps|antebrazo/.test(n)) return "Brazos";
  if (/plancha|abdominal|crunch|core|rueda|pallof|lumbar/.test(n)) return "Core";
  const z = (db.ejercicios[id] || {}).zonas && db.ejercicios[id].zonas.length ? db.ejercicios[id].zonas : zonasPorNombre(id);
  const cuenta = ZONAS_REGION.map(([r, zs]) => [r, z.filter(x => zs.includes(x)).length]);
  if (cuenta[0][1] > cuenta[1][1]) return "Pierna";
  const mejor = cuenta.find(([, c]) => c > 0);
  return mejor ? mejor[0] : "Otros";
}
// Pulsaciones: FC máxima en grande (y de dónde sale), en reposo, zonas, tiempo en cada zona y evolución del pico por actividad
function marcasPulso(raiz) {
  const info = infoFcMax(), a = ajustes(), modo = a.fcModo || (n0(a.fcMax) > 0 ? "manual" : "auto");
  const caja = apartadoMarcas(raiz, "pulso", "Pulsaciones", info ? info.valor + " ppm" : "");
  const rec = document.createElement("div");
  rec.className = "records";
  rec.appendChild(recuadro("FC máxima", info ? info.valor + " ppm" : "—", info ? (info.medida ? "medida: " : "") + info.fuente : "importa un FIT o TCX con pulso, o pon tu edad", true));
  rec.appendChild(recuadro("FC en reposo", n0(a.fcReposo) ? n0(a.fcReposo) + " ppm" : "—", n0(a.fcReposo) ? "zonas por reserva (Karvonen)" : "opcional: afina las zonas"));
  caja.appendChild(rec);
  if (info && info.superada) caja.appendChild(nota("Ojo: has llegado a " + info.superada.valor + " ppm (" + info.superada.fuente + "), más que la FC máxima que usas."));
  const bot = document.createElement("div");
  bot.className = "botonera";
  const editar = document.createElement("button");
  editar.type = "button"; editar.className = "nav-btn"; editar.textContent = "Editar";
  editar.addEventListener("click", () => editarPulso());
  bot.appendChild(editar);
  if (info && info.fecha) {
    const ir = document.createElement("button");
    ir.type = "button"; ir.className = "nav-btn"; ir.textContent = "Ver la actividad del " + fechaCorta(info.fecha);
    ir.addEventListener("click", () => { verPestana("semana"); abrirDia(info.fecha); });
    bot.appendChild(ir);
  }
  caja.appendChild(bot);
  caja.appendChild(nota("Cómo se calcula: " + ({ auto: "automática, con el pico mantenido (10 s) de tus archivos FIT y TCX de los últimos 6 meses", edad: "por tu edad (208 − 0,7 × edad)", manual: "la has puesto a mano" })[modo] + "."));
  const lim = limitesZonas();
  if (lim) {
    const s = seccionMarcas("Zonas");
    s.appendChild(tablaSimple(["Zona", "Pulsaciones"], NOMBRES_ZONA.map((n, i) => ({ celdas: [n, lim[i] + (i < 4 ? "–" + (lim[i + 1] - 1) : "+") + " ppm"] }))));
    const desde = iso(sumarDias(new Date(), -28)), z = tiempoZonas(sumaHist(seriesVivas().filter(x => x.fecha >= desde && hecha(x)).map(x => x.fc_hist)));
    if (z) { s.appendChild(nota("Tiempo en cada zona en las últimas 4 semanas:")); s.appendChild(barraZonas(z)); }
    caja.appendChild(s);
  }
  // Evolución: el pico mantenido (o, si no lo hay, la máxima) de cada día con pulso
  const porDia = {};
  seriesVivas().forEach(x => { const v = n0(x.fc_pico) || n0(x.fc_max); if (v > 0) porDia[x.fecha] = Math.max(porDia[x.fecha] || 0, v); });
  const evol = Object.keys(porDia).sort().map(f => ({ f, v: porDia[f] }));
  if (evol.length) {
    const s = seccionMarcas("Pico de FC por actividad");
    const g = document.createElement("div");
    g.innerHTML = grafica(evol, v => v + " ppm");
    s.appendChild(g);
    caja.appendChild(s);
  }
}
// Editar desde Marcas: cómo se calcula la FC máxima, la edad y la FC en reposo (los mismos ajustes que en Plan)
function editarPulso() {
  const a = ajustes(), o = opcionesFcMax();
  const guardar = cambios => { const x = leer("ajustes-v1") || {}; Object.entries(cambios).forEach(([k, v]) => { if (v == null) delete x[k]; else x[k] = v; }); escribir("ajustes-v1", x); versionDatos++; pintarInfoFc(); pintarMarcas(); setEstado("Ajuste guardado en este dispositivo"); };
  const numero = async (titulo, actual, lo, hi) => { const v = parseInt(await pedirNombre(titulo, actual ? String(actual) : "", "Entre " + lo + " y " + hi + ". Déjalo vacío para quitarlo."), 10); return v >= lo && v <= hi ? v : null; };
  abrirMenu("Pulsaciones", "FC máxima que se usa ahora: " + (fcMaxima() || "—") + " ppm", [
    { texto: "Automática" + (o.auto ? " · " + o.auto.valor + " ppm (" + o.auto.fuente + ")" : " · sin archivos con pulso"), accion: () => guardar({ fcModo: "auto" }) },
    { texto: "Por tu edad" + (o.edad ? " · " + o.edad + " ppm" : " · pon tu edad"), accion: async () => { const e = n0(a.edad) || await numero("Tu edad", "", 10, 99); if (e) guardar({ fcModo: "edad", edad: e }); } },
    { texto: "A mano" + (o.manual ? " · " + o.manual + " ppm" : "…"), accion: async () => { const v = await numero("FC máxima (ppm)", o.manual || (o.auto && o.auto.valor), 120, 230); if (v) guardar({ fcModo: "manual", fcMax: v }); } },
    { texto: "Edad: " + (n0(a.edad) || "—") + "…", accion: async () => guardar({ edad: await numero("Tu edad", n0(a.edad), 10, 99) }) },
    { texto: "FC en reposo: " + (n0(a.fcReposo) ? n0(a.fcReposo) + " ppm" : "—") + "…", accion: async () => guardar({ fcReposo: await numero("FC en reposo (ppm)", n0(a.fcReposo), 30, 100) }) }
  ]);
}
// Mis carreras: próximas (objetivo y cuenta atrás) y hechas por distancia, con la mejor (PB), su evolución y previsto frente a real
const DIST_CARRERA = [[250, "250 m"], [2000, "2 km"], [5000, "5 km"], [10000, "10 km"], [21097, "Media maratón (21,1 km)"], [42195, "Maratón (42,2 km)"]];
let distCarreraGraf = 0;
let marcaEdit = null;
function abrirMarcaManual(c) {
  marcaEdit = c ? { ...c } : null;
  const t = c ? n0(c.tiempo) : 0;
  $("mmDist").value = c ? (n0(c.distancia) >= 1000 ? num(n0(c.distancia) / 1000) + " km" : n0(c.distancia) + " m") : "";
  $("mmMin").value = c ? Math.floor(t / 60) : "";
  $("mmSeg").value = c ? num(Math.round((t - Math.floor(t / 60) * 60) * 10) / 10) : "";
  $("mmFecha").value = c ? c.fecha : iso(new Date());
  $("mmNota").value = c ? c.notas || "" : "";
  $("mmAviso").textContent = "";
  $("mmBorrar").hidden = !c;
  $("dlgMarca").showModal();
  if (!c) $("mmDist").focus();
}
// «2 km», «2k», «100 m», «21,1 km», «400»: sin unidad, menos de 50 son km
function leerDistMarca(txt) {
  const m = String(txt || "").trim().toLowerCase().replace(",", ".").match(/^(\d+(?:\.\d+)?)\s*(km|k|m|metros)?$/);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  return Math.round(m[2] === "km" || m[2] === "k" || (!m[2] && v < 50) ? v * 1000 : v);
}
$("mmGuardar").addEventListener("click", () => {
  const d = leerDistMarca($("mmDist").value), mi = parseInt($("mmMin").value || "0", 10), se = parseFloat(($("mmSeg").value || "0").replace(",", "."));
  const t = (mi || 0) * 60 + (se || 0), aviso = x => { $("mmAviso").textContent = x; };
  if (!(d > 0)) { aviso("Pon la distancia: 2 km, 100 m, 400…"); $("mmDist").focus(); return; }
  if (isNaN(mi) || isNaN(se) || se >= 60 || !(t > 0)) { aviso("Pon el tiempo: minutos y segundos (los segundos pueden llevar décimas: 13,2)."); $("mmMin").focus(); return; }
  if (!$("mmFecha").value) { aviso("Pon la fecha."); return; }
  const base = marcaEdit || { id: nuevoId(), lugar: "", chip: 0, pos_general: 0, total_general: 0, pos_categoria: 0, total_categoria: 0, desnivel_pos: 0, fc_media: 0, enlace: "", previsto: 0, borrado: false };
  cambiar("carreras", { ...base, nombre: "Marca " + nombreDist(d), categoria: "__marca", fecha: $("mmFecha").value, distancia: d, tiempo: Math.round(t * 10) / 10, notas: $("mmNota").value.trim().slice(0, 200) });
  $("dlgMarca").close();
  pintarMarcas();
  setEstado("Marca guardada: " + nombreDist(d) + " en " + fmtMarca(t));
});
$("mmBorrar").addEventListener("click", () => {
  if (!marcaEdit) return;
  const antes = { ...db.carreras[marcaEdit.id] };
  cambiar("carreras", { ...antes, borrado: true });
  $("dlgMarca").close();
  pintarMarcas();
  avisoDeshacer("Marca borrada", [["carreras", antes]]);
});
function seccionCarreras() {
  const s = seccionMarcas("Mis carreras");
  const cab = s.querySelector("h3");
  const nueva = document.createElement("button");
  nueva.type = "button"; nueva.className = "nav-btn"; nueva.textContent = "+ Carrera";
  nueva.addEventListener("click", () => abrirCarrera());
  const fila = document.createElement("div");
  fila.className = "sec-cab";
  cab.before(fila);
  fila.append(cab, nueva);
  const prox = carrerasProximas(), hechas = carrerasHechas();
  if (!prox.length && !hechas.length) { s.appendChild(nota("Apunta tus carreras (populares o competiciones) con su tiempo y tu posición, o las próximas como objetivo. También desde una carrera importada: ⋯ del ejercicio → «Marcar como carrera». Cuentan como tus marcas reales y pesan más en tu forma.")); return s; }
  const f = rendimiento().forma;
  prox.forEach(c => {
    const dias = Math.round((deIso(c.fecha) - deIso(iso(new Date()))) / 864e5);
    const t = tarjeta("🎯 " + c.nombre, [nombreDist(n0(c.distancia)) + " · " + fechaCorta(c.fecha) + " · faltan " + dias + (dias === 1 ? " día" : " días") + (c.lugar ? " · " + c.lugar : ""),
      [n0(c.tiempo) ? "objetivo " + fmtTiempo(n0(c.tiempo)) : "", f ? "previsto ahora " + fmtTiempo(tiempoPrevisto(f.vdot, n0(c.distancia))) : ""].filter(Boolean).join(" · ")], () => abrirCarrera(c.id));
    t.classList.add("carrera-prox");
    s.appendChild(t);
  });
  // Hechas, por distancia (las «otras» juntas), cada año de más reciente a más antigua
  const grupos = {};
  hechas.forEach(c => { const d = DIST_CARRERA.find(([m]) => Math.abs(n0(c.distancia) - m) <= m * 0.02); (grupos[d ? d[1] : "Otras distancias"] = grupos[d ? d[1] : "Otras distancias"] || []).push(c); });
  Object.keys(grupos).forEach(nom => {
    const lista = grupos[nom].sort((a, b) => b.fecha.localeCompare(a.fecha)), otras = nom === "Otras distancias";
    const pb = otras ? null : lista.reduce((m, c) => !m || tiempoCarrera(c) < tiempoCarrera(m) ? c : m, null);
    const h = document.createElement("p");
    h.className = "bc-t"; h.textContent = nom + " · " + lista.length;
    s.appendChild(h);
    s.appendChild(tablaSimple(["Fecha", "Carrera", "Tiempo", "Ritmo", "Puesto", "Previsto"], lista.map(c => ({
      celdas: [fechaCorta(c.fecha), (c === pb ? "★ " : "") + c.nombre + (otras ? " (" + fmtDist(n0(c.distancia)) + ")" : ""), fmtTiempo(tiempoCarrera(c)), fmtTiempo(tiempoCarrera(c) / n0(c.distancia) * 1000) + "/km",
        n0(c.pos_general) ? n0(c.pos_general) + (n0(c.total_general) ? "/" + n0(c.total_general) : "") + (n0(c.pos_categoria) ? " · " + (c.categoria || "cat.") + " " + n0(c.pos_categoria) + (n0(c.total_categoria) ? "/" + n0(c.total_categoria) : "") : "") : "—",
        n0(c.previsto) ? fmtTiempo(n0(c.previsto)) + " (" + (tiempoCarrera(c) <= n0(c.previsto) ? "−" : "+") + fmtTiempo(Math.abs(tiempoCarrera(c) - n0(c.previsto))) + ")" : "—"],
      activa: c === pb, alPulsar: () => abrirCarrera(c.id)
    }))));
    if (!otras && lista.length >= 2 && (!distCarreraGraf || distCarreraGraf === nom)) {
      distCarreraGraf = nom;
      const g = document.createElement("div");
      g.innerHTML = grafica(lista.slice().reverse().map(c => ({ f: c.fecha, v: tiempoCarrera(c) })), v => fmtTiempo(v));
      s.appendChild(g);
    }
  });
  distCarreraGraf = 0;
  s.appendChild(nota("★ tu mejor marca (PB) en cada distancia. «Previsto»: lo que la app predecía antes de la carrera, y cuánto mejoraste (−) o te quedaste (+). Toca una carrera para editarla."));
  return s;
}
let carEdit = null;
function abrirCarrera(id, base) {
  const c = id ? db.carreras[id] : null;
  carEdit = c ? { ...c } : { id: nuevoId(), nombre: "", fecha: iso(new Date()), lugar: "", distancia: 10000, tiempo: 0, chip: 0, pos_general: 0, total_general: 0, categoria: "", pos_categoria: 0, total_categoria: 0, desnivel_pos: 0, fc_media: 0, notas: "", enlace: "", previsto: 0, borrado: false, nueva: true, ...(base || {}) };
  const e = carEdit, dist = DIST_CARRERA.find(([m]) => m === n0(e.distancia));
  $("carNombre").value = e.nombre; $("carFecha").value = e.fecha || ""; $("carLugar").value = e.lugar || "";
  $("carDist").value = dist ? String(dist[0]) : "otra"; $("carOtra").value = dist ? "" : num(n0(e.distancia) / 1000);
  $("carTiempo").value = n0(e.tiempo) ? fmtTiempo(n0(e.tiempo)) : ""; $("carChip").value = n0(e.chip) ? fmtTiempo(n0(e.chip)) : "";
  $("carPos").value = n0(e.pos_general) || ""; $("carTotal").value = n0(e.total_general) || "";
  $("carCat").value = e.categoria || ""; $("carPosCat").value = n0(e.pos_categoria) || ""; $("carTotalCat").value = n0(e.total_categoria) || "";
  $("carDesnivel").value = n0(e.desnivel_pos) || ""; $("carFc").value = n0(e.fc_media) || "";
  $("carEnlace").value = e.enlace || ""; $("carNotas").value = e.notas || "";
  $("carBorrar").hidden = !!e.nueva; $("carBorrar").classList.remove("confirmar"); $("carBorrar").textContent = "Eliminar";
  $("carAviso").textContent = "";
  pintarCamposCarrera();
  $("dlgCarrera").showModal();
}
function pintarCamposCarrera() {
  const futura = $("carFecha").value > iso(new Date());
  $("carOtraL").hidden = $("carDist").value !== "otra";
  $("carTiempoL").firstChild.textContent = futura ? "Tiempo objetivo " : "Tiempo oficial ";
  $("carResultado").hidden = futura;
  $("carIA").hidden = !futura;
}
["carFecha", "carDist"].forEach(id => $(id).addEventListener("change", pintarCamposCarrera));
function leerCarrera() {
  const e = carEdit, dist = $("carDist").value === "otra" ? parseFloat($("carOtra").value.replace(",", ".")) * 1000 : +$("carDist").value;
  const t = leerTiempo($("carTiempo").value), chip = leerTiempo($("carChip").value), entero = id => parseInt($(id).value, 10) || 0;
  if (!$("carNombre").value.trim()) { $("carAviso").textContent = "Pon el nombre de la carrera."; $("carNombre").focus(); return null; }
  if (!$("carFecha").value) { $("carAviso").textContent = "Pon la fecha."; $("carFecha").focus(); return null; }
  if (!(dist > 0)) { $("carAviso").textContent = "Elige la distancia."; $("carOtra").focus(); return null; }
  if (isNaN(t) || isNaN(chip)) { $("carAviso").textContent = "Escribe los tiempos como 41:30 o 1:45:20."; return null; }
  const c = { ...e, nombre: $("carNombre").value.trim().slice(0, 80), fecha: $("carFecha").value, lugar: $("carLugar").value.trim().slice(0, 80), distancia: Math.round(dist), tiempo: t || 0, chip: chip || 0,
    pos_general: entero("carPos"), total_general: entero("carTotal"), categoria: $("carCat").value.trim().slice(0, 40), pos_categoria: entero("carPosCat"), total_categoria: entero("carTotalCat"),
    desnivel_pos: entero("carDesnivel"), fc_media: entero("carFc"), enlace: $("carEnlace").value.trim().slice(0, 300), notas: $("carNotas").value.trim().slice(0, 1000) };
  // La predicción «antes de la carrera»: se guarda (y se actualiza) mientras la carrera es futura o del mismo día
  const f = rendimiento().forma;
  if (f && c.fecha >= iso(new Date()) && (!n0(e.previsto) || c.fecha > iso(new Date()))) c.previsto = Math.round(tiempoPrevisto(f.vdot, c.distancia));
  delete c.nueva;
  return c;
}
$("carGuardar").addEventListener("click", () => {
  const c = leerCarrera();
  if (!c) return;
  cambiar("carreras", c);
  $("dlgCarrera").close();
  pintarMarcas();
  setEstado("Carrera «" + c.nombre + "» guardada");
});
$("carBorrar").addEventListener("click", async () => {
  if (!await confirmar("¿Eliminar esta carrera?", "Podrás deshacerlo justo después.")) return;
  const antes = { ...db.carreras[carEdit.id] };
  cambiar("carreras", { ...antes, borrado: true });
  $("dlgCarrera").close();
  pintarMarcas();
  avisoDeshacer("Carrera eliminada", [["carreras", antes]]);
});
// Próxima carrera → Crear con IA con la distancia, la fecha y el objetivo ya puestos
$("carIA").addEventListener("click", () => {
  const c = leerCarrera();
  if (!c) return;
  cambiar("carreras", c);
  $("dlgCarrera").close();
  abrirIA("prompt");
  $("iaModo").value = "plan";
  const obj = Object.entries(CARRERA_IA).sort((a, b) => Math.abs(a[1] - c.distancia) - Math.abs(b[1] - c.distancia))[0][0];
  $("iaObjetivo").value = obj;
  $("iaFechaCarrera").value = c.fecha;
  $("iaMarca").value = n0(c.tiempo) ? fmtTiempo(n0(c.tiempo)) : "";
  $("iaMeta").value = c.nombre + (c.lugar ? " (" + c.lugar + ")" : "") + (Math.abs(CARRERA_IA[obj] - c.distancia) > 100 ? ", " + fmtDist(c.distancia) : "");
  pintarCamposIA();
});
// Desde el día: una actividad de carrera se convierte en carrera oficial con su distancia, tiempo, FC y desnivel
function marcarComoCarrera(dia, series, nombre) {
  const hechas = series.filter(s => hecha(s) && n0(s.distancia) > 0);
  const d = hechas.reduce((x, s) => x + n0(s.distancia) + n0(s.rec_dist), 0), t = hechas.reduce((x, s) => x + n0(s.tiempo) + (n0(s.rec_dist) > 0 ? n0(s.descanso) : 0), 0);
  const conFc = hechas.filter(s => n0(s.fc_media) > 0 && n0(s.tiempo) > 0), tf = conFc.reduce((x, s) => x + n0(s.tiempo), 0);
  abrirCarrera(null, { nombre, fecha: dia.id, distancia: Math.round(d), tiempo: Math.round(t), desnivel_pos: Math.round(hechas.reduce((x, s) => x + n0(s.desnivel_pos), 0)), fc_media: tf ? Math.round(conFc.reduce((x, s) => x + n0(s.fc_media) * n0(s.tiempo), 0) / tf) : 0 });
}
function marcasFuerza(cont) {
  const ejs = vivos("ejercicios").filter(e => tipoDe(e.id) === "fuerza" && seriesDe(e.id).length);
  const caja = apartadoMarcas(cont, "fuerza", "Fuerza", ejs.length);
  if (!ejs.length) { caja.appendChild(nota("Cuando apuntes series de fuerza, aquí verás tu récord y tu 1RM estimado de cada ejercicio, separados por pierna, torso, brazos y core.")); return; }
  ["Pierna", "Torso", "Brazos", "Core", "Otros"].forEach(region => {
    const deRegion = ejs.filter(e => regionEjercicio(e.id) === region).map(e => ({ e, st: estadisticas(e.id) }))
      .sort((a, b) => (b.st.mejorRm ? rm(b.st.mejorRm) : 0) - (a.st.mejorRm ? rm(a.st.mejorRm) : 0) || a.e.nombre.localeCompare(b.e.nombre, "es"));
    if (!deRegion.length) return;
    const s = seccionMarcas(region);
    s.appendChild(tablaSimple(["Ejercicio", "Récord", "1RM est.", "Fecha"], deRegion.map(({ e, st }) => {
      const m = st.mejor || st.mejorReps;
      const sinPeso = m && !st.mejor ? (st.medida === "tiempo" ? fmtSegs(n0(m.tiempo)) : n0(m.reps) + (n0(m.reps) === 1 ? " rep" : " reps")) + (n0(m.peso) > 0 ? " · " + num(m.peso) + " kg" : "") + (m.por_lado ? " por lado" : "") : "";
      return { celdas: [e.nombre, m ? (st.mejor ? serieTexto(m) : sinPeso) : "—", st.mejorRm ? num(Math.round(rm(st.mejorRm))) + " kg" : "—", m ? fechaCorta(m.fecha) : ""], alPulsar: () => abrirDetalle(e.id) };
    })));
    caja.appendChild(s);
  });
  caja.appendChild(nota("Toca un ejercicio para ver su gráfica e historial. La zona sale de las que trabaja el ejercicio (en su ficha)."));
}
// ---------- Registro de Bilbo (como la hoja de cálculo): un apartado en Marcas y una ventana por ejercicio ----------
function marcasBilbo(cont) {
  const ejs = [...new Set(vivos("ciclos").map(c => c.ejercicio_id))].filter(id => ejercicioVivo(id));
  if (!ejs.length) return;
  const caja = apartadoMarcas(cont, "bilbo", "Bilbo", ejs.length);
  const s = seccionMarcas("Tus ciclos");
  s.appendChild(tablaSimple(["Ejercicio", "Ciclo", "Próxima", "Récord 1RM"], ejs.map(id => {
    const cs = vivos("ciclos").filter(c => c.ejercicio_id === id), act = cicloActivo(id);
    const todas = cs.flatMap(sesionesBilbo), mr = todas.length ? Math.max(...todas.map(x => rmBilbo(x.peso, x.reps))) : 0;
    return { celdas: [nombreEj(id), act ? "Ciclo " + act.numero + " · " + sesionesBilbo(act).length + " ses." : cs.length + (cs.length === 1 ? " ciclo" : " ciclos"),
      act ? num(pesoBilbo(id)) + " kg × máx" : "—", mr ? num(Math.round(mr * 10) / 10) + " kg" : "—"], alPulsar: () => abrirRegistroBilbo(id) };
  })));
  caja.appendChild(s);
  caja.appendChild(nota("Toca un ejercicio para ver su registro completo: cada ciclo con sus sesiones, el trabajo, el 1RM estimado, los acumulados y los récords."));
}
function abrirRegistroBilbo(id) {
  $("bregTit").textContent = "Bilbo · " + nombreEj(id);
  const cuerpo = $("bregCuerpo");
  cuerpo.textContent = "";
  const ciclos = vivos("ciclos").filter(c => c.ejercicio_id === id).sort((a, b) => n0(a.numero) - n0(b.numero));
  const act = cicloActivo(id);
  if (act) {
    const p = document.createElement("p");
    p.className = "breg-res";
    p.textContent = "Ciclo " + act.numero + " en curso · próxima sesión: " + num(pesoBilbo(id)) + " kg × máx · empezó con 1RM " + num(act.rm_inicio) + " kg (" + num(act.peso_inicial) + " kg) · +" + num(act.incremento) + " kg por sesión · resetear al bajar a " + act.reps_reset + " reps";
    cuerpo.appendChild(p);
  }
  // Récord de 1RM de cada ciclo, para ver la progresión de un vistazo
  const porCiclo = ciclos.map(c => { const ss = sesionesBilbo(c); return { c, ss, mr: ss.length ? Math.max(...ss.map(x => rmBilbo(x.peso, x.reps))) : 0 }; });
  const graf = document.createElement("div");
  graf.className = "breg-graf";
  const evol = porCiclo.flatMap(x => x.ss.filter(y => y.fecha).map(y => ({ v: Math.round(rmBilbo(y.peso, y.reps) * 10) / 10, f: y.fecha })));
  if (evol.length >= 2) { const t = document.createElement("p"); t.className = "bc-t"; t.textContent = "1RM estimado por sesión"; graf.appendChild(t); const g = document.createElement("div"); g.innerHTML = grafica(evol, v => num(v) + " kg"); graf.appendChild(g); cuerpo.appendChild(graf); }
  const fila = document.createElement("div");
  fila.className = "breg-ciclos";
  porCiclo.forEach(({ c, ss, mr }) => {
    const col = document.createElement("section");
    col.className = "breg-ciclo" + (c === act ? " activo" : "");
    const h = document.createElement("h4");
    h.textContent = "Ciclo " + c.numero + (c === act ? " · en curso" : "");
    const sub = document.createElement("p");
    sub.className = "menu-det";
    sub.textContent = "1RM inicio " + num(c.rm_inicio) + " kg · +" + num(c.incremento) + " kg";
    col.append(h, sub);
    const t = document.createElement("table");
    t.className = "tabla-bilbo";
    t.innerHTML = "<thead><tr><th>Día</th><th>Fecha</th><th>Peso</th><th>Reps</th><th>Trabajo</th><th>1RM</th></tr></thead><tbody></tbody><tfoot></tfoot>";
    const tb = t.querySelector("tbody"), mt = ss.length ? Math.max(...ss.map(x => x.peso * x.reps)) : 0;
    const celdas = (vals, clases) => { const tr = document.createElement("tr"); vals.forEach((v, k) => { const td = document.createElement("td"); td.textContent = v; if (clases && clases[k]) td.className = clases[k]; tr.appendChild(td); }); return tr; };
    ss.forEach((x, i) => {
      const tr = x.peso * x.reps, e1 = rmBilbo(x.peso, x.reps);
      tb.appendChild(celdas([i + 1, x.fecha ? fechaCorta(x.fecha) : "—", num(x.peso), x.reps, num(tr), num(Math.round(e1 * 10) / 10)], [0, 0, 0, 0, tr === mt ? "es-pr" : "", e1 === mr ? "es-pr" : ""]));
    });
    // Como en la hoja: las próximas sesiones del ciclo en curso, con el peso que toca
    if (c === act) for (let k = 0; k < 4; k++) { const trp = celdas([ss.length + k + 1, "", num(n0(c.peso_inicial) + n0(c.incremento) * (ss.length + k)), "", "", ""]); trp.className = "breg-futura"; tb.appendChild(trp); }
    const reps = ss.reduce((a, x) => a + x.reps, 0), trabajo = ss.reduce((a, x) => a + x.peso * x.reps, 0);
    const tf = t.querySelector("tfoot");
    const pieFila = (et, vals) => { const tr = celdas([et].concat(vals)); tr.firstChild.colSpan = 3; return tr; };
    tf.appendChild(pieFila("Acumulado", [reps, num(trabajo), ""]));
    tf.appendChild(pieFila("Récords", ["", mt ? num(mt) : "—", mr ? num(Math.round(mr * 10) / 10) : "—"]));
    const sc = document.createElement("div");
    sc.className = "tabla-scroll";
    sc.appendChild(t);
    col.appendChild(sc);
    if (!ss.length) col.appendChild(nota("Aún sin sesiones."));
    fila.appendChild(col);
  });
  cuerpo.appendChild(fila);
  const pie = document.createElement("p");
  pie.className = "menu-det";
  pie.textContent = "Trabajo = peso × repeticiones. 1RM estimado = peso × reps × 0,03 + peso (la fórmula de tu hoja). Resaltados, los récords de cada ciclo; en gris, las próximas sesiones con el peso que toca.";
  cuerpo.appendChild(pie);
  const b = document.createElement("button");
  b.type = "button"; b.className = "nav-btn"; b.textContent = "Ver la ficha del ejercicio";
  b.addEventListener("click", () => { $("dlgBilboReg").close(); abrirDetalle(id); });
  cuerpo.appendChild(b);
  if (!$("dlgBilboReg").open) $("dlgBilboReg").showModal();
  const ult = fila.lastElementChild;
  if (ult) setTimeout(() => { fila.scrollLeft = fila.scrollWidth; }, 0);   // el ciclo más reciente a la vista
}
function pintarMarcas() {
  const raiz = $("marcasCont");
  raiz.textContent = "";
  marcasPulso(raiz);
  marcasFuerza(raiz);
  marcasBilbo(raiz);
  const cont = apartadoMarcas(raiz, "carrera", "Carrera");
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
    if (f.factores) { const pq = nota("Por qué: " + f.factores.join(" · ") + "."); pq.classList.add("por-que"); s1.appendChild(pq); }
    const marcas = marcasDe("carrera");
    const ref = marcas.filter(m => m.d >= 1000).sort((x, y) => vdotDe(y.d, y.t) - vdotDe(x.d, x.t))[0];
    const s2 = seccionMarcas("Marcas previstas");
    // Predicción según tu forma (VDOT) y por Riegel desde tu mejor marca, con su ritmo; al lado, tu marca real si la tienes
    s2.appendChild(tablaSimple(["Distancia", "Según VDOT", "Ritmo", ref ? "Riegel (desde " + nombreDist(ref.d) + ")" : "Riegel", "Real"],
      [250, 1000, 2000, 5000, 10000, 21097, 42195].map(d => {
        const t = tiempoPrevisto(f.vdot, d), real = marcas.find(m => m.d === d);
        return { celdas: [nombreDist(d), fmtTiempo(t), fmtTiempo(t / d * 1000) + "/km", ref ? fmtTiempo(ref.t * Math.pow(d / ref.d, 1.06)) : "—", real ? fmtMarca(real.t) + (real.exacta ? "" : " *") : "—"] };
      })));
    s2.appendChild(nota("«Real»: tu mejor marca en esa distancia (* sacada de una serie algo más larga, a su ritmo medio). La predicción de 250 m es muy orientativa: VDOT y Riegel son menos fiables en distancias cortas de velocidad; un tiempo medido en pista es más representativo."));
    const s3 = seccionMarcas("Ritmos de entrenamiento");
    s3.appendChild(tablaSimple(["Zona", "Por km", "Por 400 m"], ZONAS.map(([n, fr]) => { const r = ritmoZona(f.vdot, fr) * (1 + carga.ajuste); return { celdas: [n, fmtTiempo(r), fmtTiempo(r * 0.4)] }; })));
    s3.appendChild(nota("Cada serie de carrera planificada muestra su objetivo calculado con todo el entrenamiento de ese día (series, bloques, volumen y recuperaciones) y se ajusta según cómo te van saliendo."));
    cont.append(s1, seccionCarreras(), s2, s3);
  }
  if (!f) cont.append(s1, seccionCarreras());

  const piscina = apartadoMarcas(raiz, "natacion", "Piscina", marcasDe("natacion").length);
  if (!marcasDe("natacion").length) piscina.appendChild(nota("Cuando apuntes series de natación con metros y tiempo, aquí verás tus mejores marcas en 50, 100, 200, 400, 800 y 1500 m y su evolución."));
  [["carrera", "Mejores marcas de carrera", 1000, "/km", cont], ["natacion", "Mejores marcas en piscina", 100, "/100 m", piscina]].forEach(([tipo, titulo, por, suf, destino]) => {
    const marcas = marcasDe(tipo);
    if (!marcas.length && tipo !== "carrera") return;
    const s = seccionMarcas(titulo);
    if (tipo === "carrera") {
      const b = document.createElement("button");
      b.type = "button"; b.className = "nav-btn"; b.textContent = "+ Marca";
      b.title = "Añadir una marca sin que sea una carrera (un 2 km, un 100 m…)";
      b.addEventListener("click", () => abrirMarcaManual());
      const fila = document.createElement("div");
      fila.className = "sec-cab";
      s.querySelector("h3").before(fila);
      fila.append(s.querySelector("h3"), b);
      const mm = marcasManuales().sort((a, b2) => b2.fecha.localeCompare(a.fecha));
      if (!marcas.length) { s.appendChild(nota("Apunta series con metros y tiempo, tus carreras o una marca suelta con «+ Marca» (un 2 km, un 100 m…) y aquí verás tus mejores marcas.")); destino.appendChild(s); return; }
      if (mm.length) setTimeout(() => {
        const t = document.createElement("p"); t.className = "bc-t"; t.textContent = "Marcas añadidas a mano";
        s.appendChild(t);
        s.appendChild(tablaSimple(["Distancia", "Tiempo", "Fecha", "Nota"], mm.map(c => ({ celdas: [nombreDist(n0(c.distancia)), fmtMarca(n0(c.tiempo)), fechaCorta(c.fecha), c.notas || "—"], alPulsar: () => abrirMarcaManual(c) }))));
      }, 0);
    }
    const sel = marcas.find(m => tipo + m.d === distGrafica) || marcas.slice().sort((x, y) => y.evol.length - x.evol.length)[0];
    s.appendChild(tablaSimple(["Distancia", "Tiempo", "Ritmo", "Fecha"], marcas.map(m => ({
      celdas: [nombreDist(m.d) + (m.exacta ? "" : " *"), fmtMarca(m.t), fmtTiempo(m.t / m.d * por) + suf, fechaCorta(m.fecha)],
      activa: m === sel, alPulsar: () => { distGrafica = tipo + m.d; pintarMarcas(); }
    }))));
    if (marcas.some(m => !m.exacta)) s.appendChild(nota("* Sacada de una serie algo más larga, a su ritmo medio."));
    const tit = document.createElement("p");
    tit.className = "bc-t";
    tit.textContent = "Evolución · " + nombreDist(sel.d);
    const g = document.createElement("div");
    g.innerHTML = grafica(sel.evol, v => fmtMarca(v));
    s.append(tit, g, nota("Toca otra distancia para ver su evolución. En esta gráfica, más abajo es más rápido."));
    destino.appendChild(s);
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
  pintarInfoFc();   // la FC máxima cambia al importar o sincronizar: se recalcula cada vez que se abre Plan
  const lp = $("listaPlantillas");
  lp.textContent = "";
  const todas = vivos("plantillas").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  // Buscador: por nombre o por los ejercicios que contiene, sin tildes ni mayúsculas
  const q = norm($("buscarPlantilla").value);
  const ps = q ? todas.filter(p => norm(p.nombre).includes(q) || norm(nombresItems(p.items || [])).includes(q)) : todas;
  contadorSec("plantillas", q ? ps.length + " de " + todas.length : todas.length);
  if (!todas.length) lp.innerHTML = '<p class="vacio-lista">Monta un entrenamiento en un día de la semana (por ejemplo, Pierna) y en su menú ⋯ elige «Guardar ejercicios como plantilla».</p>';
  else if (!ps.length) { const v = document.createElement("p"); v.className = "vacio-lista"; v.textContent = "Ninguna plantilla tiene «" + $("buscarPlantilla").value.trim() + "» en su nombre ni en sus ejercicios."; lp.appendChild(v); }
  ps.forEach(p => {
    const t = tarjeta(p.nombre, [resumenItems(p.items || []), nombresItems(p.items || [])], () => { if (pulsacionLarga) { pulsacionLarga = false; return; } if (selPlant) marcarPlant(p.id); else menuPlantilla(p); });
    if (selPlant) { t.classList.add("seleccionable"); t.setAttribute("aria-pressed", String(selPlant.has(p.id))); }
    mantenerPulsado(t, () => { if (!selPlant) { selPlant = new Set(); } selPlant.add(p.id); pintarPlan(); });
    lp.appendChild(t);
  });
  pintarSeleccion(ps);

  const lm = $("listaMesos");
  lm.textContent = "";
  const hoy = iso(new Date());
  const ms = vivos("mesociclos").sort((a, b) => (b.inicio || "").localeCompare(a.inicio || ""));
  contadorSec("mesociclos", ms.length);
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
    if (!usuarios.length) lu.innerHTML = '<p class="vacio-lista">Cargando usuarios… (necesitas conexión)</p>';
    const semana = Date.now() - 7 * 864e5;
    usuarios.slice().sort((a, b) => (b.ultimo_acceso || "").localeCompare(a.ultimo_acceso || "")).forEach(u => {
      const fila = document.createElement("div");
      fila.className = "usuario";
      fila.innerHTML = '<span class="u-info"><span class="u-email"></span><span class="u-fecha"></span></span><span class="u-estado"></span>';
      fila.querySelector(".u-email").textContent = u.email || "(sin email)";
      fila.querySelector(".u-fecha").textContent = "Registrado el " + fechaCorta(iso(new Date(u.creado))) + (u.es_admin ? " · administrador" : "");
      // Solo datos de acceso: cuándo usó la app y desde dónde (nunca qué entrena)
      const acc = document.createElement("span");
      acc.className = "u-acceso";
      // Última conexión (cuándo abrió o usó la app) y, aparte y más pequeño, cuándo metió la contraseña por última vez
      const verU = u.ultima_version || "", nInterna = +((verU.match(/\(v(\d+)\)/) || verU.match(/^v(\d+)$/) || [])[1] || 0);
      const vieja = nInterna && nInterna < +VERSION_APP.split(" ")[0].slice(1) - 5;
      acc.innerHTML = '<b class="u-con"></b><span class="u-disp"></span><span class="u-vieja" hidden></span><span class="u-login"></span>';
      acc.querySelector(".u-con").textContent = "Última conexión: " + fechaHora(u.ultimo_acceso);
      acc.querySelector(".u-disp").textContent = (u.ultimo_dispositivo ? " · " + u.ultimo_dispositivo : "") + (verU ? " · " + verU : "");
      if (vieja) { const v = acc.querySelector(".u-vieja"); v.hidden = false; v.textContent = "⚠ Versión antigua (reiniciar el navegador o cerrar y abrir la aplicación)"; }
      acc.querySelector(".u-login").textContent = "Entró con su contraseña por última vez: " + fechaHora(iniciosSesion[u.user_id]);
      fila.querySelector(".u-info").appendChild(acc);
      if (u.ultimo_acceso && Date.parse(u.ultimo_acceso) > semana) { const b = document.createElement("span"); b.className = "u-activo"; b.textContent = "activo esta semana"; fila.querySelector(".u-email").appendChild(b); }
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
  aplicarGrupoPlan();
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
  $("tabPlan").querySelector("span").textContent = n ? "Ajustes · " + n : "Ajustes";
  $("tabPlan").classList.toggle("con-aviso", n > 0);
}

// Editor de mesociclo
let mesoEdit = null, mesoImportacion = null;
function abrirMeso(id, importacion = null) {
  mesoImportacion = importacion;
  const m = id ? db.mesociclos[id] : null;
  mesoEdit = m ? { ...m, dias: JSON.parse(JSON.stringify(m.dias || {})) }
               : { id: nuevoId(), nombre: "", inicio: iso(lunesDe(new Date())), semanas: 4, dias: {}, progresion: 0, descarga: {}, notas: "", borrado: false, nuevo: true };
  if (importacion) mesoEdit = JSON.parse(JSON.stringify(importacion.borrador));
  $("mesoALista").hidden = !!importacion;
  $("mesoVolverImportacion").hidden = !importacion;
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
  const propias = semanasPropias(mesoEdit);
  if (propias && !mesoImportacion) {
    cont.appendChild(nota("Este mesociclo viene de un plan que cambia cada semana: cada semana usa sus propias plantillas (las que empiezan por «S1 ·», «S2 ·»…)."));
    return;
  }
  const importadas = mesoImportacion?.plantillas || {};
  const plantilla = pid => importadas[pid] || db.plantillas[pid];
  if (mesoImportacion) cont.appendChild(nota("Borrador sin guardar. Revisa la fecha, las semanas y los días. Pulsa + para asignar las sesiones importadas. Guardar conserva el plan; Guardar y rellenar calendario añade sus sesiones para editarlas allí."));
  const semanas = propias ? Object.keys(mesoEdit.dias).filter(k => /^s\d+$/.test(k)).sort((a,b) => +a.slice(1) - +b.slice(1)) : [null];
  semanas.forEach(clave => {
    const dias = clave ? mesoEdit.dias[clave] : mesoEdit.dias;
    if (clave) { const h = document.createElement("h4"); h.textContent = "Semana " + clave.slice(1); cont.appendChild(h); }
    const disponibles = Object.values(importadas).filter(p => !clave || p.semana === +clave.slice(1) - 1);
    const asignadas = new Set(Object.values(dias).flat());
    const faltan = disponibles.filter(p => !asignadas.has(p.id));
    if (faltan.length) cont.appendChild(nota("Por asignar: " + faltan.map(p => p.nombre).join(" · ")));
    NOMBRES.forEach((n, i) => {
      const fila = document.createElement("div"); fila.className = "meso-dia";
      fila.innerHTML = '<span class="md-n"></span><span class="md-chips"></span><button type="button" class="nav-btn md-mas">+</button>';
      fila.querySelector(".md-n").textContent = n;
      const chips = fila.querySelector(".md-chips");
      (dias[i] || []).forEach((pid, k) => {
        const c = document.createElement("button"); c.type = "button"; c.className = "chip";
        c.textContent = (plantilla(pid)?.nombre || "Plantilla borrada") + " ✕";
        c.setAttribute("aria-label", "Quitar " + c.textContent.slice(0, -2) + " del " + n);
        c.addEventListener("click", () => { dias[i].splice(k, 1); pintarDiasMeso(); }); chips.appendChild(c);
      });
      if (!(dias[i] || []).length) { const v = document.createElement("span"); v.className = "md-vacio"; v.textContent = "Descanso"; chips.appendChild(v); }
      const mas = fila.querySelector(".md-mas"); mas.setAttribute("aria-label", "Añadir plantilla al " + n);
      mas.addEventListener("click", () => {
        const ps = [...disponibles, ...vivos("plantillas").sort((a,b) => a.nombre.localeCompare(b.nombre, "es"))];
        if (!ps.length) { $("mesoAviso").textContent = "Primero crea alguna plantilla desde un día de la semana (menú ⋯ → Guardar ejercicios como plantilla)."; return; }
        const lista = document.createElement("div"); lista.className = "md-lista";
        ps.forEach(p => {
          const o = document.createElement("button"); o.type = "button"; o.className = "chip chip-op"; o.textContent = p.nombre;
          o.disabled = (dias[i] || []).includes(p.id);
          o.addEventListener("click", () => { (dias[i] = dias[i] || []).push(p.id); pintarDiasMeso(); }); lista.appendChild(o);
        });
        fila.after(lista); mas.disabled = true;
      });
      cont.appendChild(fila);
      (dias[i] || []).forEach(pid => {
        const p = plantilla(pid); if (!p) return;
        if (!importadas[pid]) { cont.appendChild(desplegableItems(n + " · " + p.nombre, p.items || [])); return; }
        const d = document.createElement("details"), s = document.createElement("summary");
        s.textContent = n + " · " + p.nombre; d.append(s, listaItems(p.items)); cont.appendChild(d);
      });
    });
  });
}
function leerMeso() {
  const nombre = $("mesoNombre").value.trim(), inicio = $("mesoInicio").value, semanas = parseInt($("mesoSemanas").value, 10);
  const progresion = parseFloat(($("mesoProg").value || "0").replace(",", "."));
  if (!nombre) { $("mesoAviso").textContent = "Ponle un nombre (por ejemplo, Fuerza · bloque 1)."; $("mesoNombre").focus(); return null; }
  if (!fechaSerieValida(inicio)) { $("mesoAviso").textContent = "Elige una fecha de inicio válida."; return null; }
  if (!(semanas >= 1 && semanas <= 26)) { $("mesoAviso").textContent = "El número de semanas debe estar entre 1 y 26."; return null; }
  if (isNaN(progresion)) { $("mesoAviso").textContent = "La progresión debe ser un número de kg (puede ser 0)."; return null; }
  const cada = parseInt($("mesoDescCada").value, 10) || 0, pct = parseFloat(($("mesoDescPct").value || "30").replace(",", "."));
  if (cada === 1 || cada < 0) { $("mesoAviso").textContent = "La descarga «cada N semanas» debe ser 2 o más (o déjalo vacío)."; return null; }
  if (!(pct > 0 && pct < 100)) { $("mesoAviso").textContent = "La reducción de la descarga debe estar entre 1 y 99 %."; return null; }
  const descarga = $("mesoDescUltima").checked || cada ? { ultima: $("mesoDescUltima").checked, cada, pct, modo: $("mesoDescModo").value } : {};
  if (mesoImportacion) {
    const propias = semanasPropias(mesoEdit);
    if (propias && semanas !== propias) { $("mesoAviso").textContent = "El documento contiene " + propias + " semanas distintas. Conserva esa duración para no omitir ni dejar vacías semanas."; return null; }
    const mapas = propias ? Object.values(mesoEdit.dias) : [mesoEdit.dias];
    const asignadas = new Set(mapas.flatMap(d => Object.values(d).flat()));
    if (Object.keys(mesoImportacion.plantillas).some(id => !asignadas.has(id))) {
      $("mesoAviso").textContent = "Asigna un día a cada sesión importada con el botón + antes de guardar. No se ha guardado ningún cambio."; return null;
    }
  }
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
// Sin duplicar nunca: cada sesión del plan (semana, plantilla) que ya esté en el calendario —en su día o movida a
// otro, hecha o pendiente— se respeta; solo se crean las que faltan. «rehacer» quita antes lo pendiente
function aplicarMeso(m, rehacer) {
  if (rehacer) quitarMesoDelCalendario(m.id);
  const lunes = deIso(m.inicio);
  const ya = seriesVivas().filter(s => s.meso_id === m.id);
  const semanaDe = f => Math.floor((deIso(f) - lunes) / (7 * 864e5));
  // Huecos del plan por plantilla y semana, y sesiones que ya hay (una por día y entreno)
  const huecos = {}, hay = {};
  for (let w = 0; w < m.semanas; w++) {
    const diasSemana = (m.dias || {})["s" + (w + 1)] || m.dias || {};
    for (let d = 0; d < 7; d++) (diasSemana[d] || []).forEach(pid => { const p = db.plantillas[pid]; if (p && !p.borrado) (huecos[pid + "|" + w] = huecos[pid + "|" + w] || []).push(d); });
  }
  const pidDe = nombre => Object.keys(db.plantillas).find(id => !db.plantillas[id].borrado && db.plantillas[id].nombre === nombre);
  new Set(ya.map(s => s.fecha + "|" + (s.grupo || ""))).forEach(k => {
    const [f, g] = [k.slice(0, 10), k.slice(11)], pid = pidDe(g), w = semanaDe(f);
    if (pid) (hay[pid] = hay[pid] || []).push({ w, d: (deIso(f).getDay() + 6) % 7 });
  });
  let total = 0;
  Object.keys(db.plantillas).forEach(pid => {
    const p = db.plantillas[pid];
    if (p.borrado) return;
    const sesiones = (hay[pid] || []).slice();
    // Primero las que siguen en su semana; las movidas a otra semana cubren los huecos que falten
    const faltan = [];
    for (let w = 0; w < m.semanas; w++) {
      const dias = huecos[pid + "|" + w] || [];
      let enSemana = sesiones.filter(x => x.w === w);
      enSemana.slice(0, dias.length).forEach(x => sesiones.splice(sesiones.indexOf(x), 1));
      const libres = dias.filter(d => !enSemana.some(x => x.d === d));
      for (let k = 0; k < dias.length - Math.min(dias.length, enSemana.length); k++) faltan.push({ w, d: libres[k] !== undefined ? libres[k] : dias[k] });
    }
    faltan.slice(sesiones.length).forEach(({ w, d }) => {
      const items = esDescarga(m, w) ? descargarItems(p.items || [], m.descarga, w * n0(m.progresion)) : p.items || [];
      pegarItems(iso(sumarDias(lunes, w * 7 + d)), items, p.nombre, m.id, esDescarga(m, w) ? 0 : w * n0(m.progresion));
      total += contarSeries(items);
    });
  });
  return total;
}
$("mesoGuardar").addEventListener("click", () => {
  const m = leerMeso(); if (!m || !guardarPlantillasImportadas(m)) return;
  cambiar("mesociclos", m);
  $("dlgMeso").close(); pintarPlan();
});
$("mesoAplicar").addEventListener("click", () => {
  const m = leerMeso(); if (!m) return;
  const fin = iso(sumarDias(deIso(m.inicio), n0(m.semanas) * 7));
  const ya = seriesVivas().filter(s => s.meso_id === m.id);
  const otros = vivos("mesociclos").filter(o => o.id !== m.id && o.inicio && o.inicio < fin && iso(sumarDias(deIso(o.inicio), n0(o.semanas) * 7)) > m.inicio && seriesVivas().some(s => s.meso_id === o.id && s.fecha >= m.inicio && s.fecha < fin));
  const importacionActiva = mesoImportacion;
  const aplicar = rehacer => {
    if (mesoImportacion !== importacionActiva || (importacionActiva && !$("dlgMeso").open)) return;
    if (!guardarPlantillasImportadas(m)) return;
    const antes = new Map(seriesVivas().filter(s => s.meso_id === m.id).map(s => [s.id, { ...s }]));
    cambiar("mesociclos", m, true);
    const n = aplicarMeso(m, rehacer);
    persistir();
    $("dlgMeso").close();
    // Deshacer: vuelve lo que había (lo pendiente quitado) y quita lo nuevo
    const ahora = seriesVivas().filter(s => s.meso_id === m.id);
    const deshacer = [...antes.values()].filter(s => !db.series[s.id] || db.series[s.id].borrado).map(s => ["series", s])
      .concat(ahora.filter(s => !antes.has(s.id)).map(s => ["series", { ...s, borrado: true }]));
    desplazamiento = Math.round((lunesDe(deIso(m.inicio)) - lunesDe(new Date())) / (7 * 864e5));
    verPestana("semana");
    avisoDeshacer(n ? "Mesociclo en el calendario: " + n + " series nuevas" : "No faltaba ninguna sesión: el calendario ya estaba completo", deshacer.length ? deshacer : null);
  };
  const conSolape = rehacer => !otros.length ? aplicar(rehacer) : abrirMenu("Se cruza con otro mesociclo", "En esas fechas ya tienes «" + otros.map(o => o.nombre).join("», «") + "» en el calendario. Si sigues, los dos quedarán juntos esos días.", [
    { texto: "Aplicar igualmente", accion: () => aplicar(rehacer) },
    { texto: "Cancelar", accion: () => {} }
  ]);
  if (!ya.length) { conSolape(false); return; }
  const hechas = new Set(ya.filter(hecha).map(s => s.fecha + "|" + s.grupo)).size, total = new Set(ya.map(s => s.fecha + "|" + s.grupo)).size;
  abrirMenu("Este mesociclo ya está en el calendario", total + (total === 1 ? " sesión" : " sesiones") + (hechas ? " (" + hechas + (hechas === 1 ? " hecha)" : " hechas)") : "") + ". No se duplica nada: lo que hayas movido de día o cambiado a mano se respeta.", [
    { texto: "Completar solo lo que falte (recomendado)", accion: () => conSolape(false) },
    { texto: "Rehacer lo pendiente según el plan", peligro: true, confirmar: "Pulsa otra vez: lo pendiente vuelve a los días del plan (lo hecho no se toca y se puede deshacer)", accion: () => conSolape(true) }
  ]);
});
$("dlgMeso").addEventListener("close", () => { if (!$("dlgMeso").open) mesoImportacion = null; });
$("mesoVolverImportacion").addEventListener("click", () => {
  $("dlgMeso").close(); mesoImportacion = null;
  pasoIA("vista"); pintarVistaIA(); $("dlgIA").showModal();
});
// Añadir un mesociclo a una lista: sus entrenamientos en el orden de la semana; si cada semana es distinta, una
// cabecera por semana («Meso · Semana 2»). Si ya estaba en esa lista, pregunta antes de repetirlo
function anadirMesoALista(m, l) {
  const pref = "«" + m.nombre + "»";
  const porSemana = Object.keys(m.dias || {}).some(k => /^s\d+$/.test(k));
  const semana = w => { const ds = porSemana ? (m.dias["s" + (w + 1)] || {}) : (m.dias || {}); const out = []; for (let d = 0; d < 7; d++) (ds[d] || []).forEach(pid => { if (db.plantillas[pid] && !db.plantillas[pid].borrado) out.push(pid); }); return out; };
  const nuevos = [];
  if (porSemana) for (let w = 0; w < n0(m.semanas); w++) { const ps = semana(w); if (!ps.length) continue; nuevos.push({ sep: nuevoId(), titulo: "Semana " + (w + 1) + (esDescarga(m, w) ? " (descarga)" : "") }, ...ps); }
  else { const ps = semana(0); if (ps.length) nuevos.push(...ps); }
  if (nuevos.length) nuevos.unshift({ grupo: nuevoId(), titulo: m.nombre + " · " + n0(m.semanas) + " semanas" });
  if (!nuevos.length) { avisoDeshacer("Este mesociclo no tiene entrenamientos en sus días: añádelos primero", null); return; }
  const meter = () => {
    const fresca = db.listas[l.id], antes = { ...fresca };
    cambiar("listas", { ...fresca, items: (fresca.items || []).concat(nuevos) });
    pintarListas();
    avisoDeshacer(pref + " añadido a la lista «" + l.nombre + "» (" + nuevos.filter(x => typeof x === "string").length + " entrenamientos)", [["listas", antes]]);
  };
  const ya = (db.listas[l.id].items || []).some(x => (esSep(x) && (x.titulo || "").startsWith(pref)) || (esGrupoL(x) && (x.titulo || "").startsWith(m.nombre + " · ")));
  if (ya) abrirMenu("Ya está en esta lista", pref + " ya está en «" + l.nombre + "». ¿Lo añado otra vez?", [{ texto: "Añadir otra vez", accion: meter }, { texto: "Cancelar", accion: () => {} }]);
  else meter();
}
$("mesoALista").addEventListener("click", () => {
  const m = leerMeso(); if (!m) return;
  cambiar("mesociclos", m);
  elegirLista("¿En qué lista añado «" + m.nombre + "»?", l => anadirMesoALista(db.mesociclos[m.id] || m, l));
});
$("mesoQuitar").addEventListener("click", () => {
  const n = quitarMesoDelCalendario(mesoEdit.id);
  persistir();
  $("mesoAviso").textContent = n ? "Quitadas " + n + " series planificadas (las que ya hiciste se conservan)." : "No había series planificadas de este mesociclo.";
});
$("mesoBorrar").addEventListener("click", async () => {
  if (!await confirmar("¿Eliminar este mesociclo?", "Se quitan también sus series planificadas del calendario (las hechas se conservan).")) return;
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
// Volver a hoy: la semana actual con hoy desplegado y a la vista (o el día de hoy, en la vista de un día)
function irAHoy() {
  const hoy = iso(new Date());
  if (diaAbierto) { abrirDia(hoy); return; }
  desplegados[hoy] = true;
  escribir("dias-desplegados-v1", desplegados);
  irA(0);
  const d = dias.find(x => x.id === hoy);
  if (d) setTimeout(() => d.col.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
}
$("hoyBtn").addEventListener("click", irAHoy);
$("diaHoy").addEventListener("click", irAHoy);
// ---------- Calendario del mes: ver de un vistazo qué días entrenaste y saltar a cualquier fecha ----------
let mesCal = null;
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function abrirCalendario() {
  const base = diaAbierto ? deIso(diaAbierto) : lunesVista();
  mesCal = new Date(base.getFullYear(), base.getMonth(), 1);
  pintarCalendario();
  $("dlgCal").showModal();
}
function pintarCalendario() {
  $("calMes").textContent = MESES_LARGOS[mesCal.getMonth()] + " " + mesCal.getFullYear();
  const cont = $("calDias"), hoy = iso(new Date()), ix = indiceSeries(), ini = lunesVista(), fin = sumarDias(ini, 6);
  cont.textContent = "";
  ["L", "M", "X", "J", "V", "S", "D"].forEach(d => { const c = document.createElement("span"); c.className = "cal-cab"; c.textContent = d; cont.appendChild(c); });
  let d = lunesDe(mesCal);
  const ultimo = new Date(mesCal.getFullYear(), mesCal.getMonth() + 1, 0);
  while (d <= ultimo || (d.getDay() + 6) % 7 !== 0) {
    const id = iso(d), ser = ix.porFecha[id] || [], e = db.entrenos[id], b = document.createElement("button");
    b.type = "button";
    b.className = "cal-dia" + (d.getMonth() !== mesCal.getMonth() ? " fuera" : "") + (id === hoy ? " hoy" : "") + (d >= ini && d <= fin ? " en-vista" : "");
    b.textContent = d.getDate();
    const hechas = ser.filter(hecha).length, tipos = [...new Set(ser.map(s => tipoDe(s.ejercicio_id)))];
    if (ser.length || (e && aTexto(e.html || "").trim())) {
      const p = document.createElement("span");
      p.className = "cal-punto" + (ser.length && hechas === ser.length ? " hecho" : hechas ? " medio" : "") + (tipos.length === 1 ? " t-" + tipos[0] : "");
      b.appendChild(p);
    }
    b.setAttribute("aria-label", d.getDate() + " de " + MESES_LARGOS[d.getMonth()] + (ser.length ? ": " + hechas + " de " + ser.length + " series hechas" : ""));
    const destino = id;
    b.addEventListener("click", () => irAFecha(destino));
    cont.appendChild(b);
    d = sumarDias(d, 1);
  }
}
// Ir a una fecha: se abre su semana con ese día desplegado (o el día suelto, si estabas en esa vista)
function irAFecha(id) {
  $("dlgCal").close();
  if (diaAbierto) { abrirDia(id); return; }
  if (id === iso(new Date())) { irAHoy(); return; }
  desplegados[id] = true;
  escribir("dias-desplegados-v1", desplegados);
  if ($("vistaSemana").hidden) verPestana("semana");
  irA(Math.round((lunesDe(deIso(id)) - lunesDe(new Date())) / 6048e5));
  const d = dias.find(x => x.id === id);
  if (d) setTimeout(() => d.col.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
}
$("calBtn").addEventListener("click", abrirCalendario);
$("calAnt").addEventListener("click", () => { mesCal = new Date(mesCal.getFullYear(), mesCal.getMonth() - 1, 1); pintarCalendario(); });
$("calSig").addEventListener("click", () => { mesCal = new Date(mesCal.getFullYear(), mesCal.getMonth() + 1, 1); pintarCalendario(); });
$("calHoy").addEventListener("click", () => irAFecha(iso(new Date())));

let subVistaOrganizar = leer("organizar-vista-v1") || "listas";
const VISTAS = { semana: "vistaSemana", ejercicios: "vistaEjercicios", listas: "vistaListas", plan: "vistaPlan", marcas: "vistaMarcas" };
const TABS = { semana: "tabSemana", ejercicios: "tabEjercicios", listas: "tabListas", plan: "tabPlan", marcas: "tabMarcas" };
function verPestana(cual) {
  if (!VISTAS[cual]) cual = "semana";
  if (cual !== "plan" && selPlant) { selPlant = null; $("selPlantAcciones").hidden = true; document.body.classList.remove("seleccionando"); }
  Object.keys(VISTAS).forEach(k => {
    $(VISTAS[k]).hidden = k !== cual;
    $(TABS[k]).setAttribute("aria-selected", String(k === cual));
  });
  $("organizarNav").hidden = cual !== "listas";
  if (cual === "plan") { $("vistaListas").hidden = true; mostrarGrupoPlan("cuenta"); }
  else if (cual === "listas") mostrarSubVistaOrganizar(subVistaOrganizar);
  escribir("pestana-v1", cual);
  if (cual === "ejercicios") pintarCatalogo();
  else if (cual === "plan") { pintarPlan(); if (perfil && perfil.es_admin && sesion) { cargarPerfil().catch(() => {}); cargarInicios(); } }
  else if (cual === "marcas") pintarMarcas();
  else if (cual === "listas") { if (subVistaOrganizar === "listas") pintarListas(); else pintarPlan(); }
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
  if (!$("vistaListas").hidden) pintarListas();
  if ($("detalle").open) refrescarDetalle();
}

// Sincronizar al abrir, al volver a la app, al recuperar conexión y cada 30 s
let segundoPlanoDesde = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { segundoPlanoDesde = Date.now(); return; }
  const instalada = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (instalada && sesion && !$("app").hidden && segundoPlanoDesde && Date.now() - segundoPlanoDesde > 1200) reproducirApertura();
  segundoPlanoDesde = 0;
  registrarAcceso(); if (!$("vistaSemana").hidden && !escribiendoSerie()) pintarSemana(); sincronizar();
});
addEventListener("online", sincronizar);
setInterval(() => { if (!document.hidden) sincronizar(); }, 30000);

// ---------- Inicio de sesión y cuentas pendientes ----------
let creando = false;
// Espera complementaria del dispositivo; no sustituye los límites de Supabase.
const CLAVE_ESPERA_ACCESO = PREFIJO + "espera-acceso-v1";
let accesoEnCurso = false, relojAcceso = 0, esperaAccesoMemoria = {};
function leerEsperaAcceso() {
  let x = esperaAccesoMemoria;
  try { x = JSON.parse(localStorage.getItem(CLAVE_ESPERA_ACCESO) || "null") || x; } catch {}
  const ahora = Date.now();
  if (!x || !Number.isFinite(x.ultimo) || ahora - x.ultimo > 1800000) return {fallos:0, hasta:0, ultimo:ahora};
  return {fallos:Math.max(0, Math.min(20, Math.floor(Number(x.fallos)||0))), hasta:Math.max(0, Math.min(Number(x.hasta)||0, ahora+900000)), ultimo:x.ultimo};
}
function guardarEsperaAcceso(x) {
  esperaAccesoMemoria = x;
  try { localStorage.setItem(CLAVE_ESPERA_ACCESO, JSON.stringify(x)); } catch {}
}
function segundosEsperaAcceso() { return Math.max(0, Math.ceil((leerEsperaAcceso().hasta-Date.now())/1000)); }
function pintarEsperaAcceso() {
  clearTimeout(relojAcceso);
  const segundos = segundosEsperaAcceso();
  $("loginBtn").disabled = accesoEnCurso || segundos > 0;
  $("modoBtn").disabled = accesoEnCurso;
  $("loginBtn").textContent = segundos ? "Espera " + segundos + " s" : creando ? "Crear cuenta" : "Entrar";
  if (segundos) relojAcceso = setTimeout(pintarEsperaAcceso, 1000);
}
function registrarFalloAcceso() {
  const x=leerEsperaAcceso(); x.fallos++; x.ultimo=Date.now();
  if (x.fallos >= 5) x.hasta=Math.max(x.hasta, Date.now()+Math.min(900,60*2**(x.fallos-5))*1000);
  guardarEsperaAcceso(x);
}
function registrarLimiteAcceso(valor) {
  const n=Number(valor), fecha=Date.parse(valor || "");
  const segundos=valor && Number.isFinite(n) ? n : Number.isFinite(fecha) ? Math.ceil((fecha-Date.now())/1000) : 60;
  const x=leerEsperaAcceso(); x.ultimo=Date.now();
  x.hasta=Math.max(x.hasta, Date.now()+Math.max(1,Math.min(900,segundos))*1000); guardarEsperaAcceso(x);
}
addEventListener("storage", e => { if (e.key === CLAVE_ESPERA_ACCESO) pintarEsperaAcceso(); });

$("modoBtn").addEventListener("click", () => {
  if (accesoEnCurso) return;
  creando = !creando;
  $("loginBtn").textContent = creando ? "Crear cuenta" : "Entrar";
  $("modoBtn").textContent = creando ? "Ya tengo cuenta" : "¿Primera vez? Crear cuenta";
  $("password").autocomplete = creando ? "new-password" : "current-password";
  $("loginTexto").textContent = creando
    ? "Elige tu email y una contraseña de al menos 6 caracteres. Tu cuenta quedará pendiente hasta que el administrador la apruebe."
    : "Entra con tu email y tu contraseña. Solo hace falta una vez en cada dispositivo.";
  $("loginError").textContent = "";
  pintarEsperaAcceso();
});
const traducir = m => /invalid login/i.test(m) ? "Email o contraseña incorrectos."
  : /already registered|already exists/i.test(m) ? "Ya existe una cuenta con ese email. Pulsa «Ya tengo cuenta» y entra."
  : /at least 6|password should/i.test(m) ? "La contraseña debe tener al menos 6 caracteres."
  : /signups not allowed|signup is disabled/i.test(m) ? "Ahora mismo no se pueden crear cuentas nuevas."
  : /valid email|invalid format/i.test(m) ? "Escribe un email válido."
  : m || "No se ha podido entrar.";
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (accesoEnCurso) return;
  if (segundosEsperaAcceso()) { $("loginError").textContent="Demasiados intentos seguidos. Espera a que termine el contador."; pintarEsperaAcceso(); return; }
  const email = $("email").value.trim(), password = $("password").value, alta = creando;
  if (!email || password.length < 6) { $("loginError").textContent = "Escribe tu email y una contraseña de al menos 6 caracteres."; return; }
  accesoEnCurso = true; pintarEsperaAcceso(); $("loginError").textContent = "";
  const controlador = new AbortController(), tiempo = setTimeout(() => controlador.abort(), 25000);
  try {
    const accesoPrevio = localStorage.getItem(PREFIJO + "sesion-v1"), generacionAcceso = generacionSesion;
    const ruta = alta ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
    const r = await fetch(SUPA + ruta, { method: "POST", signal:controlador.signal, headers: { apikey: CLAVE, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => ({}));
    if (generacionSesion !== generacionAcceso || localStorage.getItem(PREFIJO + "sesion-v1") !== accesoPrevio) throw new Error("La sesión ha cambiado en otra pestaña. Vuelve a abrir la aplicación.");
    if (r.status === 429) { registrarLimiteAcceso(r.headers.get("Retry-After")); throw new Error("El servidor ha limitado los intentos de acceso. Espera a que termine el contador antes de volver a probar."); }
    if (r.ok && alta && !j.access_token) {
      $("password").value = "";
      $("loginError").textContent = "Revisa tu correo para confirmar la cuenta. Después podrás entrar y esperar la aprobación.";
      return;
    }
    if (!r.ok || !j.access_token) {
      const m=j.msg || j.error_description || j.message || "";
      if (!alta && (j.code === "invalid_credentials" || /invalid login credentials/i.test(m))) registrarFalloAcceso();
      throw new Error(segundosEsperaAcceso() ? "Varios intentos incorrectos. Espera a que termine el contador antes de volver a probar." : traducir(m));
    }
    guardarEsperaAcceso({fallos:0,hasta:0,ultimo:Date.now()});
    $("password").value = "";
    entrarConSesion(j);
  } catch (err) {
    $("loginError").textContent = navigator.onLine === false ? "Necesitas conexión para entrar la primera vez." : err.name === "AbortError" ? "La conexión ha tardado demasiado. Vuelve a intentarlo." : err.message;
  } finally {
    clearTimeout(tiempo); accesoEnCurso=false; pintarEsperaAcceso();
  }
});
pintarEsperaAcceso();
// ---------- Contraseña: «¿Has olvidado tu contraseña?» (enlace por correo) y cambiarla con la sesión abierta ----------
$("olvideBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) { $("loginError").textContent = "Escribe arriba tu email y vuelve a pulsar «¿Has olvidado tu contraseña?»."; $("email").focus(); return; }
  $("olvideBtn").disabled = true;
  try {
    const vuelta = encodeURIComponent(location.origin + location.pathname);
    const r = await fetch(SUPA + "/auth/v1/recover?redirect_to=" + vuelta, { method: "POST", headers: { apikey: CLAVE, "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    if (r.status === 429) throw new Error("Has pedido varios correos seguidos. Espera unos minutos y vuelve a probar.");
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(traducir(j.msg || j.error_description || j.message || "") || "No se ha podido enviar el correo."); }
    $("loginError").textContent = "Si hay una cuenta con " + email + ", te hemos enviado un correo con un enlace para elegir una contraseña nueva. Ábrelo en este dispositivo (mira también en spam).";
  } catch (err) {
    $("loginError").textContent = navigator.onLine === false ? "Necesitas conexión para pedir el correo." : err.message;
  } finally { $("olvideBtn").disabled = false; }
});
// Al volver desde el enlace del correo (#access_token=…&type=recovery): se entra y se pide la contraseña nueva
async function entrarDesdeEnlace() {
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, "", location.pathname);
  if (p.get("error")) { $("login").hidden = false; $("loginError").textContent = /expired/i.test(p.get("error_code") || p.get("error_description") || "") ? "El enlace ha caducado o ya se usó. Pide otro con «¿Has olvidado tu contraseña?»." : "No se ha podido usar el enlace. Pide otro."; return; }
  try {
    const token = p.get("access_token");
    if (!token || !p.get("refresh_token")) throw new Error("Enlace incompleto");
    const accesoPrevio = localStorage.getItem(PREFIJO + "sesion-v1"), generacionAcceso = generacionSesion;
    const r = await fetch(SUPA + "/auth/v1/user", { headers: { apikey: CLAVE, Authorization: "Bearer " + token } });
    if (!r.ok) throw new Error();
    const user = await r.json();
    if (generacionSesion !== generacionAcceso || localStorage.getItem(PREFIJO + "sesion-v1") !== accesoPrevio) throw new Error("Sesión cambiada");
    entrarConSesion({ access_token: token, refresh_token: p.get("refresh_token"), expires_in: +p.get("expires_in") || 3600, user }, p.get("type") === "recovery");
  } catch {
    $("login").hidden = false;
    $("loginError").textContent = "El enlace no es válido o ha caducado. Pide otro con «¿Has olvidado tu contraseña?».";
  }
}
function abrirClave(recuperando) {
  $("claveTit").textContent = recuperando ? "Elige tu contraseña nueva" : "Cambiar contraseña";
  $("claveTexto").textContent = recuperando ? "Has entrado con el enlace del correo. Elige ahora una contraseña nueva de al menos 6 caracteres." : "Elige una contraseña nueva de al menos 6 caracteres. Seguirás con la sesión abierta en tus otros dispositivos.";
  $("claveNueva").value = ""; $("claveRepite").value = ""; $("claveAviso").textContent = "";
  $("dlgClave").showModal();
  $("claveNueva").focus();
}
$("claveBtn").addEventListener("click", () => abrirClave(false));
$("claveGuardar").addEventListener("click", async () => {
  const a = $("claveNueva").value, b = $("claveRepite").value;
  if (a.length < 6) { $("claveAviso").textContent = "La contraseña debe tener al menos 6 caracteres."; $("claveNueva").focus(); return; }
  if (a !== b) { $("claveAviso").textContent = "Las dos contraseñas no coinciden."; $("claveRepite").focus(); return; }
  $("claveGuardar").disabled = true;
  try {
    const r = await api("/auth/v1/user", { method: "PUT", body: JSON.stringify({ password: a }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = j.msg || j.error_description || j.message || "";
      throw new Error(/same|different/i.test(m) ? "La contraseña nueva tiene que ser distinta de la actual." : /reauth/i.test(m) ? "Por seguridad, cierra sesión, vuelve a entrar y cámbiala enseguida (o usa «¿Has olvidado tu contraseña?»)." : traducir(m) || "No se ha podido cambiar.");
    }
    $("dlgClave").close();
    setEstado("Contraseña cambiada");
  } catch (err) {
    $("claveAviso").textContent = navigator.onLine === false ? "Necesitas conexión para cambiar la contraseña." : err.message;
  } finally { $("claveGuardar").disabled = false; }
});
function detenerSesionLocal(msg) {
  // Conserva los cambios de esta cuenta y vacía las interfaces sensibles.
  if (sesion && sesion.user_id === cuentaLocal) { volcarExtra(); guardarLocal(); }
  clearTimeout(timerSync); clearTimeout(timerExtra);
  invalidarPeticiones();
  sesion = null; perfil = null; usuarios = []; historial = []; rehechos = [];
  if (typeof ent !== "undefined") ent = null;
  if (typeof bloqueoPantalla !== "undefined" && bloqueoPantalla) { bloqueoPantalla.release().catch(() => {}); bloqueoPantalla = null; }
  document.querySelectorAll("dialog[open]").forEach(d => d.close());
  $("app").hidden = true; $("pendiente").hidden = true; $("login").hidden = false;
  $("loginError").textContent = msg || "";
}
async function cerrarSesion(msg, revocar = false) {
  const anterior = sesion;
  detenerSesionLocal(msg);
  const generacion = generacionSesion;
  if (leerGeneral("sesion-v1")?.user_id === anterior?.user_id) escribir("sesion-v1", null);
  if (!revocar || !anterior?.access_token) return;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(SUPA + "/auth/v1/logout?scope=local", { method: "POST", signal: controller.signal,
      headers: { apikey: CLAVE, Authorization: "Bearer " + anterior.access_token } });
    if (!r.ok) throw new Error("logout " + r.status);
  } catch {
    if (!sesion && generacionSesion === generacion) $("loginError").textContent = "La sesión se ha cerrado en este dispositivo. No se ha podido confirmar el cierre en el servidor por un problema de conexión.";
  } finally { clearTimeout(timer); }
}
window.addEventListener("storage", e => {
  if (e.key !== PREFIJO + "sesion-v1" && e.key !== null) return;
  const actualizada = leerGeneral("sesion-v1");
  if (sesion && actualizada?.user_id === sesion.user_id) { sesion = actualizada; return; }
  detenerSesionLocal("La sesión ha cambiado en otra pestaña.");
  // Recarga todos los estados auxiliares bajo la cuenta correcta; nunca se mezclan.
  if (actualizada) location.reload();
});
function entrarConSesion(j, recuperando = false) {
  invalidarPeticiones();
  guardarSesion(j);
  // Las copias antiguas conservan su propietario. No se reasignan al nuevo usuario.
  if (recuperando) history.replaceState(null, "", location.pathname + "#cambio-clave");
  location.reload();
}
$("salirBtn").addEventListener("click", () => {
  volcarExtra();
  if (hayPendientes()) { setEstado("Hay cambios sin subir. Conéctate a internet antes de cerrar sesión.", true); return; }
  cerrarSesion("", true);
});
function mostrarPendiente() {
  $("login").hidden = true; $("app").hidden = true; $("pendiente").hidden = false;
  $("pendEmail").textContent = sesion.email || "";
}
$("pendReintentar").addEventListener("click", () => { $("pendAviso").textContent = "Comprobando…"; sincronizar().then(() => { $("pendAviso").textContent = perfil && perfil.aprobado ? "" : "Tu cuenta sigue pendiente."; }); });
$("pendSalir").addEventListener("click", () => cerrarSesion("", true));
// ---------- Último acceso (solo lo ve el administrador): se anota como mucho una vez cada 10 minutos ----------
function dispositivo() {
  const ua = navigator.userAgent, app = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const d = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "otro";
  return d + (app ? " (app)" : " (navegador)");
}
setInterval(() => { if (document.visibilityState === "visible") registrarAcceso(); }, 5 * 60e3);
function registrarAcceso() {
  if (!sesion || !navigator.onLine) return;
  const ultimo = n0(leer("ultimo-acceso-v1"));
  if (Date.now() - ultimo < 10 * 60e3) return;
  escribir("ultimo-acceso-v1", Date.now());
  api("/rest/v1/rpc/registrar_acceso", { method: "POST", body: JSON.stringify({ disp: dispositivo(), ver: "v" + VERSION_VISIBLE + " (" + VERSION_APP.split(" ")[0] + ")" }) }).then(r => { if (!r.ok) escribir("ultimo-acceso-v1", ultimo); }).catch(() => escribir("ultimo-acceso-v1", ultimo));
}
// Fecha y hora absolutas: «hoy 21:14», «ayer 9:05» o «4 nov, 21:14» (con el año si no es este)
function fechaHora(ts) {
  if (!ts) return "—";
  const d = new Date(ts), dia = iso(d), hoy = iso(new Date()), hora = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  if (dia === hoy) return "hoy " + hora;
  if (dia === iso(sumarDias(new Date(), -1))) return "ayer " + hora;
  return d.getDate() + " " + MESES[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "") + ", " + hora;
}
let iniciosSesion = {};   // último inicio de sesión de cada usuario (solo para el administrador)
async function cargarInicios() {
  try {
    const r = await api("/rest/v1/rpc/accesos_admin", { method: "POST", body: "{}" });
    if (!r.ok) return;
    iniciosSesion = {};
    (await r.json()).forEach(x => { iniciosSesion[x.user_id] = x.last_sign_in_at; });
    if (!$("vistaPlan").hidden) pintarPlan();
  } catch {}
}
let temporizadorApertura;
function reproducirApertura() {
  const panel = $("aperturaApp");
  if (!panel || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  clearTimeout(temporizadorApertura);
  panel.hidden = false;
  panel.setAttribute("aria-hidden", "false");
  panel.classList.remove("activa");
  void panel.offsetWidth;
  panel.classList.add("activa");
  temporizadorApertura = setTimeout(() => {
    panel.classList.remove("activa");
    panel.hidden = true;
    panel.setAttribute("aria-hidden", "true");
  }, 1080);
}
function mostrarApp(reapertura = false) {
  if (!perfil || perfil.aprobado !== true) { mostrarPendiente(); sincronizar(); return; }
  $("login").hidden = true; $("pendiente").hidden = true; $("app").hidden = false;
  verPestana(leer("pestana-v1") || "semana");
  if (reapertura) reproducirApertura();
  setEstado("Sincronizando…");
  sincronizar();
  registrarAcceso();
  if (perfil && perfil.es_admin) cargarInicios();
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
  const r = { series: hechas.length, total: todas.length, km: 0, nado: 0, kg: 0, mov: 0, prs: 0, dias: new Set(hechas.map(s => s.fecha)).size };
  hechas.forEach(s => { const t = tipoDe(s.ejercicio_id); if (t === "fuerza") r.kg += n0(s.peso) * n0(s.reps); else if (t === "movilidad") r.mov += n0(s.tiempo) * (s.por_lado ? 2 : 1) / 60; });
  // Los km y metros sí incluyen calentamiento y vuelta a la calma: también se corren
  seriesVivas().filter(s => s.fecha >= ini && s.fecha < fin && hecha(s)).forEach(s => {
    const t = tipoDe(s.ejercicio_id);
    const m = n0(s.distancia) + n0(s.rec_dist);   // igual que el total de cada día: con las recuperaciones en metros
    if (t === "carrera") r.km += m / 1000; else if (t === "natacion") r.nado += m;
  });
  r.prs = prsSemana(lunes).length;
  const rpes = Object.values(db.entrenos).filter(e => e.fecha >= ini && e.fecha < fin && n0(e.rpe) > 0).map(e => n0(e.rpe));
  r.rpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 0;
  return r;
}
let claveResumen = "";
// La lista y el contador usan las mismas marcas, comparadas con todo el historial.
function prsSemana(lunes) {
  const ini = iso(lunes), fin = iso(sumarDias(lunes, 7));
  return seriesVivas().filter(s => s.fecha >= ini && s.fecha < fin && hecha(s) && !s.calentamiento && prsEj(s.ejercicio_id).has(s.id))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || n0(b.orden) - n0(a.orden));
}
function abrirPrsSemana(inicio) {
  const lunes = deIso(inicio), filas = prsSemana(lunes), lista = document.createElement("ul");
  lista.className = "pr-semana-lista";
  filas.forEach(s => {
    const li = document.createElement("li"), nombre = document.createElement("strong"), marca = document.createElement("span"), contexto = document.createElement("span");
    nombre.textContent = nombreEj(s.ejercicio_id);
    marca.className = "pr-semana-marca"; marca.textContent = serieTexto(s);
    contexto.className = "pr-semana-fecha";
    contexto.textContent = NOMBRES[(deIso(s.fecha).getDay() + 6) % 7] + " " + fmt(deIso(s.fecha)) + (s.grupo ? " · " + s.grupo : "");
    li.append(nombre, marca, contexto); lista.appendChild(li);
  });
  if (!filas.length) { const li = document.createElement("li"); li.textContent = "No hay nuevos récords personales en esta semana."; lista.appendChild(li); }
  abrirMenu("Tus PR de la semana", fmt(lunes) + " – " + fmt(sumarDias(lunes, 6)) + " · " + filas.length + (filas.length === 1 ? " récord personal" : " récords personales"),
    [{ texto: "Cerrar", accion: () => {} }], lista);
}

function pintarResumen() {
  pintarMolestias();
  const lunes = lunesVista(), clave = versionDatos + "|" + iso(lunes);
  if (clave === claveResumen) return;
  claveResumen = clave;
  const a = datosSemana(lunes), b = datosSemana(sumarDias(lunes, -7));
  $("resumenSem").hidden = !a.total && !b.series && !a.rpe;
  if ($("resumenSem").hidden) return;
  const km = v => num(Math.round(v * 10) / 10) + " km", kg = v => num(Math.round(v)) + " kg", uno = v => num(Math.round(v * 10) / 10);
  const dif = (x, y, f) => Math.abs(x - y) < 1e-9 ? "igual que la semana anterior" : (x > y ? "+" : "−") + f(Math.abs(x - y)) + " frente a la anterior";
  $("resumenLinea").textContent = [a.km || b.km ? km(a.km) : "", a.kg || b.kg ? kg(a.kg) : "", a.mov >= 1 ? num(Math.round(a.mov)) + " min movilidad" : "", a.series + "/" + a.total + " series", a.prs ? a.prs + " PR" : ""].filter(Boolean).join(" · ");
  const cont = $("resumenCont");
  cont.textContent = "";
  if (a.km || b.km) cont.appendChild(recuadro("Carrera", km(a.km), dif(a.km, b.km, km)));
  if (a.nado || b.nado) cont.appendChild(recuadro("Natación", fmtDist(a.nado), dif(a.nado, b.nado, fmtDist)));
  if (a.kg || b.kg) cont.appendChild(recuadro("Fuerza (kg × reps)", kg(a.kg), dif(a.kg, b.kg, kg)));
  const mins = v => num(Math.round(v)) + " min";
  if (a.mov || b.mov) cont.appendChild(recuadro("Movilidad", mins(a.mov), dif(Math.round(a.mov), Math.round(b.mov), mins)));
  cont.appendChild(recuadro("Series hechas", a.series + " de " + a.total, (a.total ? Math.round(a.series / a.total * 100) + " % de lo planificado · " : "") + "anterior: " + b.series + " de " + b.total));
  cont.appendChild(recuadro("Días entrenados", String(a.dias), "anterior: " + b.dias));
  const tarjetaPr = recuadro("Récords (PR)", String(a.prs), "anterior: " + b.prs, a.prs > 0);
  if (a.prs) {
    const verPr = document.createElement("button");
    verPr.type = "button"; verPr.className = "pr-semana-abrir";
    verPr.textContent = "Ver " + (a.prs === 1 ? "el PR" : "los " + a.prs + " PR") + " de esta semana";
    verPr.setAttribute("aria-haspopup", "dialog");
    verPr.addEventListener("click", () => abrirPrsSemana(iso(lunes)));
    tarjetaPr.appendChild(verPr);
  } else tarjetaPr.querySelector(".r-sub").textContent = "Sin nuevos PR esta semana · anterior: " + b.prs;
  cont.appendChild(tarjetaPr);
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
  volcarExtra();
  const datos = {};
  Object.keys(TABLAS).forEach(t => { datos[t] = Object.values(db[t]).map(f => { const c = { ...f }; delete c.sucio; return c; }); });
  descargarArchivo("fuerza-y-ritmo-copia-" + iso(new Date()) + ".json", JSON.stringify({ app: "Fuerza y Ritmo", version: 1, exportado: new Date().toISOString(), email: (sesion && sesion.email) || "", datos, conflictos: leer("conflictos-copia-v1") || [], correccionesFechas: leer("fechas-series-copias-v1") || [] }), "application/json");
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
function limitesInforme() {
  const ref = deIso($("fechaInforme").value || iso(new Date())), modo = $("periodoInforme").value;
  let ini, fin;
  if (modo === "semana") { ini = lunesDe(ref); fin = sumarDias(ini, 7); }
  else if (modo === "mes") { ini = new Date(ref.getFullYear(), ref.getMonth(), 1); fin = new Date(ref.getFullYear(), ref.getMonth() + 1, 1); }
  else { ini = new Date(ref.getFullYear(), 0, 1); fin = new Date(ref.getFullYear() + 1, 0, 1); }
  return { desde: iso(ini), hasta: iso(fin), titulo: modo === "semana" ? "Semana del " + fmt(ini) + " a " + fmt(sumarDias(fin, -1)) : modo === "mes" ? "Mes de " + MESES[ref.getMonth()] + " de " + ref.getFullYear() : "Año " + ref.getFullYear() };
}
let mesCalendarioInforme = deIso(iso(new Date()));
function pintarCalendarioInforme() {
  const anio = mesCalendarioInforme.getFullYear(), mes = mesCalendarioInforme.getMonth();
  $("fechaInformeMes").textContent = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(mesCalendarioInforme);
  const primero = new Date(anio, mes, 1), inicio = (primero.getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate(), elegido = $("fechaInforme").value, hoy = iso(new Date());
  const nombres = ["L", "M", "X", "J", "V", "S", "D"];
  $("fechaInformeDias").innerHTML = nombres.map((n, i) => `<span role="columnheader" aria-label="${["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i]}">${n}</span>`).join("");
  for (let i = 0; i < inicio; i++) $("fechaInformeDias").insertAdjacentHTML("beforeend", "<span aria-hidden=\"true\"></span>");
  for (let dia = 1; dia <= total; dia++) {
    const valor = iso(new Date(anio, mes, dia)), clases = [valor === hoy ? "hoy" : "", valor === elegido ? "seleccionado" : ""].filter(Boolean).join(" ");
    const mesLargo = new Intl.DateTimeFormat("es-ES", { month: "long" }).format(new Date(anio, mes, 1));
    $("fechaInformeDias").insertAdjacentHTML("beforeend", `<button type="button" role="gridcell" class="${clases}" aria-label="${dia} de ${mesLargo} de ${anio}" aria-pressed="${valor === elegido}">${dia}</button>`);
  }
  $("fechaInformeDias").querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    const dia = Number(b.textContent); $("fechaInforme").value = iso(new Date(anio, mes, dia)); actualizarFechaInforme(); cerrarCalendarioInforme(); $("fechaInformeAbrir").focus();
  }));
}
function actualizarFechaInforme() {
  const fecha = deIso($("fechaInforme").value || iso(new Date()));
  $("fechaInformeAbrir").textContent = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(fecha);
}
function abrirCalendarioInforme() {
  mesCalendarioInforme = deIso($("fechaInforme").value || iso(new Date()));
  $("calendarioInforme").hidden = false; $("fechaInformeAbrir").setAttribute("aria-expanded", "true");
  pintarCalendarioInforme();
  $("fechaInformeDias").querySelector(".seleccionado")?.focus();
}
function cerrarCalendarioInforme() {
  $("calendarioInforme").hidden = true; $("fechaInformeAbrir").setAttribute("aria-expanded", "false");
}
$("fechaInformeAbrir").addEventListener("click", () => $("calendarioInforme").hidden ? abrirCalendarioInforme() : cerrarCalendarioInforme());
$("fechaInformeAnterior").addEventListener("click", () => { mesCalendarioInforme = new Date(mesCalendarioInforme.getFullYear(), mesCalendarioInforme.getMonth() - 1, 1); pintarCalendarioInforme(); });
$("fechaInformeSiguiente").addEventListener("click", () => { mesCalendarioInforme = new Date(mesCalendarioInforme.getFullYear(), mesCalendarioInforme.getMonth() + 1, 1); pintarCalendarioInforme(); });
$("calendarioInforme").addEventListener("keydown", e => { if (e.key === "Escape") { cerrarCalendarioInforme(); $("fechaInformeAbrir").focus(); } });
document.addEventListener("pointerdown", e => { if (!e.target.closest(".informe-fecha-campo")) cerrarCalendarioInforme(); });
function descargarResumenPeriodo(formato) {
  if (!formato) {
    abrirMenu("Descargar resumen", "Elige el formato del archivo.", [
      { texto: "Descargar HTML", accion: () => descargarResumenPeriodo("html") },
      { texto: "Guardar como PDF…", accion: () => descargarResumenPeriodo("pdf") }
    ]);
    return;
  }
  const { desde, hasta, titulo } = limitesInforme();
  const filas = seriesVivas().filter(s => s.fecha >= desde && s.fecha < hasta && hecha(s) && !s.calentamiento);
  const dias = new Set(filas.map(s => s.fecha)), sesiones = new Set(filas.map(s => s.fecha + "|" + (s.grupo || "Entreno"))), correr = filas.filter(s => tipoDe(s.ejercicio_id) === "carrera"), nadar = filas.filter(s => tipoDe(s.ejercicio_id) === "natacion"), fuerza = filas.filter(s => tipoDe(s.ejercicio_id) === "fuerza");
  const metros = xs => xs.reduce((a, s) => a + n0(s.distancia), 0), segundos = xs => xs.reduce((a, s) => a + n0(s.tiempo), 0), desnivel = correr.reduce((a, s) => a + n0(s.desnivel_pos), 0);
  const registros = new Map();
  fuerza.forEach(s => { const nombre = nombreEj(s.ejercicio_id), r = rm(s); if (r > 0 && (!registros.has(nombre) || r > registros.get(nombre).valor)) registros.set(nombre, { nombre, valor: r, detalle: num(n0(s.peso)) + " kg × " + num(n0(s.reps)) + " reps · 1RM estimado " + num(r) + " kg" }); });
  correr.filter(s => n0(s.distancia) && n0(s.tiempo)).forEach(s => { const nombre = nombreEj(s.ejercicio_id), r = n0(s.tiempo) / n0(s.distancia); if (!registros.has(nombre) || r < registros.get(nombre).valor) registros.set(nombre, { nombre, valor: r, detalle: fmtDist(s.distancia) + " · " + fmtTiempo(s.tiempo) + " · " + ritmo(s, "carrera") }); });
  const esc = x => String(x).replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);
  const top = [...registros.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).slice(0, 30);
  const contenido = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(titulo)} · Fuerza y Ritmo</title><style>@page{margin:18mm}body{font:16px system-ui,sans-serif;max-width:760px;margin:36px auto;padding:0 20px;color:#20252b}h1{font-size:28px}small{color:#667}section{border-top:1px solid #ddd;padding:14px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px}.k{padding:14px;background:#f3f5f7;border-radius:12px}.k b{display:block;font-size:22px}li{margin:8px 0}@media print{body{margin:0 auto;padding:0;max-width:none}.grid{grid-template-columns:repeat(2,1fr)}.k{break-inside:avoid}section{break-inside:avoid}}</style><h1>${esc(titulo)}</h1><p>Resumen de entrenamientos registrados · ${desde} a ${iso(sumarDias(deIso(hasta),-1))}</p><section class="grid"><div class="k"><b>${sesiones.size}</b>sesiones</div><div class="k"><b>${filas.length}</b>series completadas</div><div class="k"><b>${dias.size}</b>días activos</div><div class="k"><b>${fmtDist(metros(correr))}</b>distancia de carrera</div><div class="k"><b>${fmtDist(metros(nadar))}</b>distancia de natación</div><div class="k"><b>${fmtTiempo(segundos(correr)+segundos(nadar))}</b>tiempo de carrera y natación</div><div class="k"><b>${Math.round(desnivel)} m</b>desnivel positivo registrado</div></section><section><h2>Mejores resultados registrados</h2>${top.length ? `<ul>${top.map(x=>`<li><b>${esc(x.nombre)}</b>: ${esc(x.detalle)}</li>`).join("")}</ul>` : "<p>No hay marcas de fuerza o carrera en este periodo.</p>"}</section><p>Generado por Fuerza y Ritmo. Los datos reflejan lo registrado en la app.</p></html>`;
  const nombre = "resumen-entrenamiento-" + desde + "-" + iso(sumarDias(deIso(hasta),-1));
  if (formato === "html") { descargarArchivo(nombre + ".html", contenido, "text/html"); return; }
  const ventana = window.open("", "_blank");
  if (!ventana) { setEstado("El navegador bloqueó la ventana para imprimir. Permite ventanas emergentes o descarga el resumen en HTML.", true); return; }
  let imprimirIniciado = false;
  const imprimir = () => { if (imprimirIniciado) return; imprimirIniciado = true; setTimeout(() => { ventana.focus(); ventana.print(); }, 250); };
  ventana.addEventListener("load", imprimir, { once: true });
  ventana.document.open(); ventana.document.write(contenido); ventana.document.close();
  setTimeout(imprimir, 700);
}
$("fechaInforme").value = iso(new Date());
actualizarFechaInforme();
$("descargarInforme").addEventListener("click", descargarResumenPeriodo);
// Restaurar: recupera lo que falta, lo borrado o lo más antiguo aquí; nunca borra nada
function restaurar(archivo) {
  const lector = new FileReader();
  lector.onload = () => {
    let j = null;
    try { j = JSON.parse(lector.result); } catch {}
    if (!j || !["Entreno Semanal", "Fuerza y Ritmo"].includes(j.app) || !j.datos) { setEstado("Ese archivo no es una copia de Fuerza y Ritmo.", true); return; }
    const cambios = [];
    Object.keys(TABLAS).forEach(t => (Array.isArray(j.datos[t]) ? j.datos[t] : []).forEach(f => {
      const k = f && f[TABLAS[t].clave];
      if (!claveDatoValida(k) || (t === "ejercicios" && f.compartido && f.user_id && f.user_id !== sesion.user_id)) return;   // el catálogo común no es tuyo
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
const TIPO_TEXTO = { fuerza: "fuerza", carrera: "carrera", natacion: "natacion", nado: "natacion", movilidad: "movilidad", estiramientos: "movilidad", estiramiento: "movilidad" };
function leerValor(txt, tipo) {
  // Une «400 m» → «400m» para leer cada valor como una sola palabra
  const t = txt.replace(/(\d)\s+(km|m|min|s|seg|reps?)\b/gi, "$1$2").replace(/(\d)\s*(minutos?|mins?)\b/gi, "$1min").trim();
  const v = { peso: 0, reps: 0, distancia: 0, tiempo: 0, descanso: 0, rec_dist: 0, pct: 0, bilbo: false, por_lado: false };
  if (/(por|cada|\/)\s*lado|c\/l\b|\bxlado/i.test(t)) v.por_lado = true;
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
  else if ((m = tok.match(/^(\d+)(?:-(\d+))?(?:reps?)?$/))) { v.reps = +m[1]; if (m[2] && +m[2] > +m[1]) { v.rango_min = +m[1]; v.rango_max = +m[2]; } }
  else if (/^(m[aá]x|amrap|fallo)/.test(tok)) { v.reps = 0; if (/^\s*m[aá]x\s*(s\b|seg|tiempo)/i.test(t)) v.max_tiempo = true; else v.max_reps = true; }
  else return { error: "no entiendo «" + tok + "» (usa 8, máx, 400m, 40min o 3:30)" };
  if (tipo === "movilidad") {
    if (v.distancia) return { error: "en movilidad las series van en repeticiones o tiempo (por ejemplo 2x10 por lado o 3x45s)" };
    return v;
  }
  if (tipo !== "fuerza" && v.reps >= 25) { v.distancia = v.reps; v.reps = 0; }   // «6x1000» en carrera son metros
  // En fuerza también valen series por tiempo (calentamiento en bici, movilidad, plancha…): 1x5min, 3x45s
  if (tipo === "fuerza" && v.distancia) return { error: "en fuerza las series van en repeticiones o tiempo (por ejemplo 3x12 o 3x45s)" };
  if (tipo !== "fuerza" && !v.distancia && !v.tiempo) return { error: "en " + TIPOS[tipo].nombre.toLowerCase() + " las series van en metros o tiempo (por ejemplo 5x1000m o 1x40min)" };
  // RPE en fuerza → % del 1RM con la misma fórmula del 1RM estimado (reps + las que quedan en reserva)
  // (con RPE bajo —calentamiento o movilidad— no se calcula carga)
  if (tipo === "fuerza" && rpe >= 6 && v.reps && !v.pct && !v.peso) v.pct = Math.max(50, Math.min(100, Math.round(100 / (1 + (v.reps + 10 - rpe) / 30))));
  if (ritmoM && v.distancia) v.tiempo = Math.round(leerTiempo(ritmoM[1]) * v.distancia / (/km/i.test(ritmoM[2]) ? 1000 : 100));
  return v;
}
function leerEjercicio(txt, conCuenta) {
  const m = txt.match(/^(.+?)\s*\[([^\]]+)\]\s*:?\s*(.*)$/) || txt.match(/^([^:]+):\s*(.*)$/);
  if (!m) return { error: conCuenta ? "falta «:» entre el ejercicio y las series (por ejemplo «Sentadilla [fuerza]: 4x8»)" : "cada tramo va como «Ejercicio [tipo] 400m»" };
  const nombre = m[1].trim(), conTipo = m.length === 4;
  let resto = (conTipo ? m[3] : m[2]).trim(), nota = "";
  const mn = resto.match(/\s*\b(?:nota|descripci[oó]n)\s*:\s*(.+)$/i);
  if (mn) { nota = mn[1].trim().slice(0, 300); resto = resto.slice(0, mn.index).trim(); }
  const tipo = conTipo ? TIPO_TEXTO[norm(m[2]).replace(/[^a-z]/g, "")] : adivinarTipo(nombre);
  if (!tipo) return { error: "tipo «" + m[2] + "» desconocido (usa fuerza, carrera, natacion o movilidad)" };
  if (!nombre) return { error: "falta el nombre del ejercicio" };
  const series = [];
  for (const parte of resto.split(/\s+\+\s+/)) {
    const c = conCuenta ? parte.match(/^(\d+)\s*[x×]\s*(.+)$/i) : [null, "1", parte];
    if (!c) return { error: "las series van como 4x8, 5x1000m o 1x40min" };
    if (!(+c[1] >= 1 && +c[1] <= 50)) return { error: "entre 1 y 50 series" };
    const v = leerValor(c[2], tipo);
    if (v.error) return v;
    for (let k = 0; k < +c[1]; k++) series.push({ ...v, nota });
  }
  return { ejercicio: nombre.slice(0, 80), tipo, series };
}
function leerRutina(texto) {
  const lineas = String(texto || "").replace(/\r/g, "").split("\n");
  const r = { nombre: "", nota: "", semanas: 0, bloques: [] };
  let semana = null, sesion = null, dentro = false, parteIA = "";
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
    if ((m = l.match(/^###\s*(.+)$/)) && sesion) { parteIA = m[1].trim().replace(/[:]+$/, "").slice(0, 40); continue; }   // parte dentro de la sesión
    if ((m = l.match(/^#{1,3}\s*(.+)$/))) {
      parteIA = "";
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
        sesion.items.push({ bloque: true, seccion: parteIA, tramos });
      } else {
        const e = leerEjercicio(m[1], true);
        if (e.error) return fallo(i, e.error);
        if (/^calentamiento$/i.test(parteIA)) e.series.forEach(v => { v.calentamiento = true; });
        if (/^(m[eé]todo )?bilbo$/i.test(parteIA)) e.series.forEach(v => { v.bilbo = true; });
        sesion.items.push({ ...e, seccion: parteIA });
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
    : (v.tiempo && !v.reps ? fmtDuracion(v.tiempo) : (v.reps || "máx")) + (v.pct ? " · " + num(v.pct) + " %" : "") + (v.peso ? " · " + num(v.peso) + " kg" : "");
  return base + (descTexto(v) ? " · " + descTexto(v) : "");
}
const textoItemRutina = it => it.bloque
  ? "(" + it.tramos.map(t => t.ejercicio + " " + textoValor(t.series[0], t.tipo)).join(" + ") + ") ×" + it.tramos[0].series.length
  : it.ejercicio + " " + resumenSeriesRutina(it.series, it.tipo);
// Series iguales seguidas se agrupan: «5×1000 m en 4:05»; tramos distintos se enumeran: «1×8 km en 42:40 + 1×6 km en 29:00»
function resumenSeriesRutina(series, tipo) {
  const grupos = [];
  series.forEach(v => { const t = textoValor(v, tipo), u = grupos[grupos.length - 1]; if (u && u.t === t) u.n++; else grupos.push({ t, n: 1 }); });
  return grupos.map(g => g.n + "×" + g.t).join(" + ");
}
const textoDias = dias => dias.map(d => NOMBRES[d].slice(0, 3)).join(", ");
const lunesSiguiente = () => { const hoy = new Date(); return iso(hoy.getDay() === 1 ? lunesDe(hoy) : sumarDias(lunesDe(hoy), 7)); };
const semanasRutina = r => r.semanas || (r.multi ? r.bloques.length : 4);
// Guarda la rutina como plantillas (y, si se pide, un mesociclo que las reparte por los días); los ejercicios que falten se crean
function guardarRutina(r, comoMeso, inicio, semanas, enLista) {
  const usados = new Set(vivos("plantillas").map(p => norm(p.nombre)));
  const libre = n => { let x = n, k = 2; while (usados.has(norm(x))) x = n + " (" + k++ + ")"; usados.add(norm(x)); return x; };
  const prefijo = r.nombre.split(/[(:·]/)[0].trim();
  const dias = {}, porSemana = [];
  let n = 0;
  r.bloques.forEach((b, w) => {
    const destino = r.multi ? (dias["s" + (w + 1)] = {}) : dias;
    porSemana.push([]);
    b.sesiones.forEach(s => {
      const id = nuevoId();
      porSemana[w].push(id);
      cambiar("plantillas", { id, nombre: libre(r.multi ? prefijo + " · S" + (w + 1) + " · " + s.nombre : s.nombre), items: itemsDesdeImportacion(s.items), borrado: false }, true);
      n++;
      s.dias.forEach(d => (destino[d] = destino[d] || []).push(id));
    });
  });
  // En una lista de entrenamientos: si el plan cambia cada semana, cada semana va en su bloque
  if (enLista) {
    const fresca = db.listas[enLista.id], items = (fresca.items || []).slice();
    if (r.multi) items.push({ grupo: nuevoId(), titulo: r.nombre });
    porSemana.forEach((ids, w) => { if (r.multi) items.push({ sep: nuevoId(), titulo: "Semana " + (w + 1) }); items.push(...ids); });
    cambiar("listas", { ...fresca, items }, true);
    listasAbiertas[fresca.id] = true; escribir("listas-abiertas-v1", listasAbiertas);
    persistir(); pintarPlan();
    avisoDeshacer(n + (n === 1 ? " entrenamiento guardado" : " entrenamientos guardados") + " en la lista «" + fresca.nombre + "»", null);
    verPestana("listas");
    return;
  }
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
// Editor del borrador importado: no escribe en db hasta elegir un destino y guardar.
// Selecciones explícitas solo en memoria; los documentos no pueden proporcionar IDs de catálogo.
const catalogoElegidoIA = new WeakMap();
function claveEjercicioIA(nombre) {
  return norm(nombre).replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}
function afinidadEjercicioIA(a, b) {
  const x = claveEjercicioIA(a), y = claveEjercicioIA(b);
  if (x === y) return 100;
  const alias = t => t.replace(/\bhorizontal\b/g, "").replace(/\s+/g," ").trim();
  if (x.includes("press banca") && y.includes("press banca") && alias(x) === alias(y)) return 90;
  const palabras = x.split(" ").filter(p => p.length > 2);
  return palabras.filter(p => y.split(" ").includes(p)).length * 10;
}
function catalogoImportacionIA(e) {
  return vivos("ejercicios").filter(x => x.tipo === e.tipo).sort((a,b) => afinidadEjercicioIA(e.ejercicio,b.nombre)-afinidadEjercicioIA(e.ejercicio,a.nombre) || a.nombre.localeCompare(b.nombre));
}
function itemsDesdeImportacion(items) {
  const resolver = e => {
    const id = catalogoElegidoIA.get(e);
    const lista = vivos("ejercicios");
    if (id) {
      if (!lista.some(x => x.id === id && x.tipo === e.tipo)) throw new Error("El ejercicio elegido ya no está disponible. Vuelve a elegirlo.");
      return id;
    }
    return lista.find(x => x.tipo === e.tipo && compacto(x.nombre) === compacto(e.ejercicio))?.id || crearEjercicio(e.ejercicio,e.tipo);
  };
  const copias = new Map();
  return items.map(it => it.bloque
    ? {bloque:true,seccion:it.seccion||"",tramos:it.tramos.map(e => ({ejercicio_id:resolver(e),series:e.series}))}
    : (() => {
      const id=resolver(it), clave=JSON.stringify([id,it.seccion||""]), copia=(copias.get(clave)||0)+1;
      copias.set(clave,copia);
      return {ejercicio_id:id,seccion:it.seccion||"",series:it.series,copia:copia>1?copia:0};
    })());
}
function partesImportacionIA(s) {
  const disponibles = [...new Set(s.items.map(it=>it.seccion||"").concat(s.partesBorrador||[]))];
  s.ordenPartesIA = [...(s.ordenPartesIA||[]).filter(p=>disponibles.includes(p)),...disponibles.filter(p=>!(s.ordenPartesIA||[]).includes(p))];
  s.items.sort((a,b)=>s.ordenPartesIA.indexOf(a.seccion||"")-s.ordenPartesIA.indexOf(b.seccion||""));
  return s.ordenPartesIA;
}
function avisoImportacionIA(texto) {
  $("iaMensaje").textContent = texto;
  $("iaAvisoDias").textContent = texto;
}

const ejerciciosEditandoIA = new WeakSet();
function validarCamposBorradorIA() {
  for (const campo of $("iaVista").querySelectorAll("input, textarea, select")) {
    if (!campo.checkValidity()) {
      for (let p = campo.parentElement; p && p !== $("iaVista"); p = p.parentElement) if (p.tagName === "DETAILS") p.open = true;
      avisoImportacionIA("Revisa el campo marcado antes de continuar."); campo.scrollIntoView({block:"center"}); campo.reportValidity(); return false;
    }
  }
  return true;
}
function vistaRutina(r, cont) {
  cont.textContent = "";
  const repintar = () => vistaRutina(r, cont);
  const boton = (texto, accion, clase = "enlace") => {
    const b = document.createElement("button"); b.type = "button"; b.className = clase;
    b.textContent = texto; b.addEventListener("click", accion); return b;
  };
  const renombrar = async (titulo, valor, aplicar) => {
    if (!validarCamposBorradorIA()) return;
    const ctx = contextoSesion(), nombre = await pedirNombre(titulo, valor);
    try { comprobarSesion(ctx); } catch { return; }
    if (!nombre || rutinaIA !== r) return;
    aplicar(nombre.trim()); repintar();
  };
  const campo = (padre, texto, objeto, clave, numerico = false, entero = false) => {
    const lab = document.createElement("label"); lab.className = "campo"; lab.textContent = texto;
    const input = document.createElement(clave === "nota" ? "textarea" : "input");
    if (numerico) { input.type = "number"; input.min = "0"; input.max = "1000000"; input.step = entero ? "1" : "any"; input.inputMode = "decimal"; }
    else { input.maxLength = clave === "nota" ? 300 : 80; input.required = clave !== "nota"; }
    input.value = objeto[clave] ?? (numerico ? 0 : "");
    input.addEventListener("input", () => {
      input.setCustomValidity(!numerico && input.required && !input.value.trim() ? "Escribe un nombre." : "");
      if (numerico) { if (input.checkValidity()) objeto[clave] = Number(input.value); }
      else { objeto[clave] = input.value; if (clave === "ejercicio") catalogoElegidoIA.delete(objeto); }
    });
    lab.appendChild(input); padre.appendChild(lab); return input;
  };
  const marca = (padre, texto, serie, clave) => {
    const lab = document.createElement("label"); lab.className = "campo chk";
    const input = document.createElement("input"); input.type = "checkbox"; input.checked = !!serie[clave];
    input.addEventListener("change", () => { serie[clave] = input.checked; });
    lab.append(input, document.createTextNode(texto)); padre.appendChild(lab);
  };
  if (r.nota) {
    const info = document.createElement("details"), titulo = document.createElement("summary");
    info.className = "ia-indicaciones"; titulo.textContent = "Indicaciones del documento";
    info.append(titulo, nota(r.nota)); cont.appendChild(info);
  }
  r.bloques.forEach((b, w) => {
    if (r.multi) { const h = document.createElement("p"); h.className = "bc-t"; h.textContent = "Semana " + (w + 1); cont.appendChild(h); }
    b.sesiones.forEach(s => {
      const d = document.createElement("div"); d.className = "rutina-ses";
      const cab = document.createElement("div"); cab.className = "ia-editor-cab";
      const t = document.createElement("b"); t.textContent = s.nombre + (s.dias.length ? " · " + textoDias(s.dias) : "");
      cab.append(t, boton("Cambiar nombre", () => renombrar("Nombre del entrenamiento", s.nombre, n => {
        s.nombre = n.slice(0,60); actualizarDestinoIA();
      }))); d.appendChild(cab);
      const partes = partesImportacionIA(s);
      partes.forEach((parte, posicionParte) => {
        const items = s.items.filter(it => (it.seccion || "") === parte);
        const caja = document.createElement("details"); caja.className = "rutina-parte-det ia-parte-editor"; caja.open = true;
        const summary = document.createElement("summary"); summary.textContent = (parte || "Sin parte") + " · " + contarSeries(items) + " series";
        caja.appendChild(summary);
        const acciones = document.createElement("div"); acciones.className = "ia-editor-acciones";
        acciones.appendChild(boton("Renombrar parte", () => renombrar("Nombre de la parte", parte, n => {
          n = n.slice(0,40);
          if (n !== parte && partes.includes(n)) { $("iaAvisoDias").textContent = "Ya existe una parte con ese nombre. Elige uno diferente."; return; }
          items.forEach((it, posicionEjercicio) => { it.seccion = n; });
          s.partesBorrador = (s.partesBorrador || []).map(p => p === parte ? n : p);
          s.ordenPartesIA = partes.map(p => p === parte ? n : p);
        })));
        [-1,1].forEach(paso => {
          const b = boton(paso < 0 ? "↑ Subir parte" : "↓ Bajar parte", () => {
            if (!validarCamposBorradorIA()) return;
            const orden = [...partes], otro = posicionParte + paso;
            [orden[posicionParte],orden[otro]] = [orden[otro],orden[posicionParte]];
            s.ordenPartesIA = orden; repintar();
          });
          b.disabled = posicionParte + paso < 0 || posicionParte + paso >= partes.length; acciones.appendChild(b);
        });
        if (!items.length) acciones.appendChild(boton("Quitar parte vacía", () => { s.partesBorrador = (s.partesBorrador || []).filter(p => p !== parte); repintar(); }));
        caja.appendChild(acciones);
        items.forEach((it, posicionEjercicio) => {
          const fila = document.createElement("div"); fila.className = "ia-ej-editor";
          const titulo = document.createElement("p"); titulo.textContent = textoItemRutina(it); fila.appendChild(titulo);
          const mover = document.createElement("div"); mover.className = "ia-editor-acciones";
          [-1,1].forEach(paso => {
            const b = boton(paso < 0 ? "↑ Subir ejercicio" : "↓ Bajar ejercicio", () => {
              if (!validarCamposBorradorIA()) return;
              const a = s.items.indexOf(it), b = s.items.indexOf(items[posicionEjercicio+paso]);
              [s.items[a],s.items[b]] = [s.items[b],s.items[a]]; repintar();
            });
            b.disabled = posicionEjercicio+paso < 0 || posicionEjercicio+paso >= items.length; mover.appendChild(b);
          });
          const labMover = document.createElement("label"); labMover.className="campo"; labMover.textContent="Mover a otra parte";
          const destino = document.createElement("select"); destino.appendChild(new Option("Elegir parte…",""));
          partes.forEach((p,i)=>{if(p!==parte)destino.appendChild(new Option(p||"Sin parte",String(i)));});
          destino.addEventListener("change",()=>{
            if(destino.value === "" || !validarCamposBorradorIA())return;
            const nueva = partes[Number(destino.value)];
            s.items.splice(s.items.indexOf(it),1); it.seccion=nueva;
            const ultimo=s.items.map(x=>x.seccion||"").lastIndexOf(nueva); s.items.splice(ultimo+1,0,it);
            if(!s.items.some(x=>(x.seccion||"")===parte)) s.partesBorrador=(s.partesBorrador||[]).filter(p=>p!==parte);
            repintar();
          });
          labMover.appendChild(destino); mover.appendChild(labMover); fila.appendChild(mover);
          // La vinculación está disponible sin desplegar todos los campos de las series.
          (it.bloque ? it.tramos : [it]).forEach(e => {
            const lab = document.createElement("label"); lab.className="campo ia-catalogo";
            lab.appendChild(document.createTextNode("Ejercicio guardado · " + e.ejercicio));
            const sel = document.createElement("select"); sel.setAttribute("aria-label","Vincular " + e.ejercicio);
            const lista = catalogoImportacionIA(e), exacto = lista.find(x=>compacto(x.nombre)===compacto(e.ejercicio));
            sel.appendChild(new Option("Crear si no existe: " + e.ejercicio,""));
            lista.forEach(x=>sel.appendChild(new Option(x.nombre+(afinidadEjercicioIA(e.ejercicio,x.nombre)===90 ? " (posible coincidencia)" : ""),x.id)));
            sel.value=catalogoElegidoIA.get(e)||exacto?.id||"";
            sel.addEventListener("change",()=>{
              if(!validarCamposBorradorIA())return;
              const elegido=lista.find(x=>x.id===sel.value), anterior=e.ejercicio;
              // La misma denominación importada se vincula también en sus calentamientos y partes.
              r.bloques.flatMap(b=>b.sesiones).flatMap(s=>s.items).flatMap(it=>it.bloque?it.tramos:[it]).forEach(t=>{
                if(t.tipo!==e.tipo || t.ejercicio!==anterior)return;
                if(elegido){t.ejercicio=elegido.nombre;catalogoElegidoIA.set(t,elegido.id);} else catalogoElegidoIA.delete(t);
              }); repintar();
            });
            lab.appendChild(sel); fila.appendChild(lab);
            if(!exacto && lista.some(x=>afinidadEjercicioIA(e.ejercicio,x.nombre)>=90)) {
              const n=document.createElement("p"); n.className="nota"; n.textContent="Hay una posible coincidencia. Elígela arriba si es el mismo ejercicio; las variantes no se unen automáticamente."; fila.appendChild(n);
            }
          });
          const editando = ejerciciosEditandoIA.has(it);
          fila.appendChild(boton(editando ? "Terminar edición" : "Editar ejercicio y series", () => {
            if (!validarCamposBorradorIA()) return;
            if (editando) ejerciciosEditandoIA.delete(it); else ejerciciosEditandoIA.add(it); repintar();
          }, "nav-btn ia-editar-ej"));
          if (editando) {
            const campos = document.createElement("div"); campos.className = "ia-ej-campos";
            (it.bloque ? it.tramos : [it]).forEach(e => {
              campo(campos, "Nombre del ejercicio", e, "ejercicio");
              e.series.forEach((serie, i) => {
                const fs = document.createElement("fieldset"); fs.className = "ia-serie-editor";
                const legend = document.createElement("legend"); legend.textContent = "Serie " + (i + 1); fs.appendChild(legend);
                const grid = document.createElement("div"); grid.className = "ia-serie-campos";
                const camposSerie = e.tipo === "fuerza" ? [["reps","Repeticiones"],["peso","Peso · kg"],["pct","Carga · % RM"],["tiempo","Tiempo · segundos"]]
                  : e.tipo === "movilidad" ? [["reps","Repeticiones"],["tiempo","Tiempo · segundos"]]
                  : [["distancia","Distancia · metros"],["tiempo","Tiempo · segundos"],["rec_dist","Recuperación · metros"]];
                camposSerie.push(["descanso","Descanso · segundos"]);
                if (serie.rango_min || serie.rango_max) camposSerie.push(["rango_min","Repeticiones mínimas"],["rango_max","Repeticiones máximas"]);
                camposSerie.forEach(([k,n]) => campo(grid,n,serie,k,true,["reps","tiempo","descanso","rango_min","rango_max"].includes(k)));
                fs.appendChild(grid);
                marca(fs,"Calentamiento",serie,"calentamiento");
                if (e.tipo === "fuerza") { marca(fs,"Método Bilbo",serie,"bilbo"); marca(fs,"Máximas repeticiones",serie,"max_reps"); }
                marca(fs,"Por lado",serie,"por_lado");
                campo(fs,"Indicaciones",serie,"nota");
                if (!it.bloque && e.series.length > 1) fs.appendChild(boton("Quitar esta serie", () => { e.series.splice(i,1); repintar(); }));
                campos.appendChild(fs);
              });
              if (!it.bloque) campos.appendChild(boton("+ Serie", () => {
                if (!validarCamposBorradorIA()) return;
                e.series.push({ ...e.series[e.series.length-1] }); repintar();
              }));
            });
            fila.appendChild(campos);
          }
          caja.appendChild(fila);
        });
        caja.appendChild(boton("+ Ejercicio", async () => {
          if (!validarCamposBorradorIA()) return;
          const ctx = contextoSesion(), nombre = await pedirNombre("Nombre del ejercicio", "");
          try { comprobarSesion(ctx); } catch { return; }
          if (!nombre || rutinaIA !== r) return;
          const tipo = adivinarTipo(nombre), valor = { peso:0,reps:tipo === "fuerza" ? 10 : 0,distancia:0,tiempo:0,descanso:0,nota:"",calentamiento:/^calentamiento$/i.test(parte) };
          const it = { ejercicio:nombre.slice(0,80),tipo,seccion:parte,series:[valor] };
          s.items.push(it); ejerciciosEditandoIA.add(it); repintar();
        }));
        d.appendChild(caja);
      });
      d.appendChild(boton("+ Parte", () => renombrar("Nombre de la nueva parte", "", n => {
        n = n.slice(0,40);
        if (partes.includes(n)) { $("iaAvisoDias").textContent = "Ya existe esa parte."; return; }
        (s.partesBorrador = s.partesBorrador || []).push(n);
        // El calentamiento nuevo empieza arriba; después el usuario puede moverlo libremente.
        s.ordenPartesIA = /^calentamiento\b/i.test(n) ? [n,...partes] : [...partes,n];
      })));
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
const OBJETIVOS_IA = { fuerza: "ganar fuerza", hipertrofia: "ganar masa muscular (hipertrofia)", "1k": "mejorar mi marca en 1 km", "2k": "mejorar mi marca en 2 km", "5k": "preparar una carrera de 5 km", "10k": "preparar una carrera de 10 km", media: "preparar una media maratón (21,1 km)", maraton: "preparar un maratón (42,2 km)", combinado: "combinar fuerza y carrera" };
const CARRERA_IA = { "1k": 1000, "2k": 2000, "5k": 5000, "10k": 10000, media: 21097, maraton: 42195 };
const EJEMPLO_SESION_IA = `RUTINA: Pierna 60 min
NOTA: Nivel intermedio, RPE 7-8. Si te sobran repeticiones, sube 2,5 kg la próxima vez.
## Pierna
### Calentamiento
- Bicicleta estática [fuerza]: 1x5min
- Movilidad de cadera 90/90 [movilidad]: 2x8 por lado
- Movilidad de tobillo en pared [movilidad]: 2x10 por lado
- Puente de glúteo [fuerza]: 2x12
### Parte principal
- Sentadilla [fuerza]: 4x6 @RPE8 desc 2:30
- Peso muerto rumano [fuerza]: 3x8-10 @RPE7 desc 2:00
- Zancadas [fuerza]: 3x10 por lado @RPE7 desc 1:30
### Vuelta a la calma
- Estiramiento de cuádriceps [movilidad]: 1x30s por lado`;
const EJEMPLO_IA = `RUTINA: Fuerza y carrera 3 días
SEMANAS: 6
NOTA: Para nivel intermedio. Sube 2,5 kg cuando completes todas las series.
## Fuerza @ Lunes, Jueves
### Calentamiento
- Movilidad torácica en cuadrupedia [movilidad]: 2x8 por lado
- Movilidad de cadera 90/90 [movilidad]: 2x8 por lado
### Parte principal
- Sentadilla [fuerza]: 4x6 @RPE8 desc 2:30
- Press banca [fuerza]: 4x8-10 @75% desc 2:00
- Dominadas [fuerza]: 3xmáx desc 2:00
## Series @ Miércoles
### Calentamiento
- Calentamiento carrera [carrera]: 1x15min
- Movilidad dinámica de cadera [movilidad]: 1x10 por lado
### Parte principal
- Series 1000 m [carrera]: 5x1000m @4:10/km rec 2:00
- BLOQUE x4: Series 200 m [carrera] 200m | Trote de recuperación [carrera] 200m
## Rodaje @ Sábado
- Rodaje [carrera]: 1x45min`;
// ---------- Prompt basado en un mesociclo, una lista o tus últimas semanas ----------
// Resume lo anterior como texto corto para la otra IA: estructura (días, partes, ejercicios y series) y cómo progresaste
function lineasItemsIA(items) {
  const out = []; let parte = null;
  items.forEach(it => {
    const sec = it.seccion || "";
    if (sec !== parte) { if (sec) out.push("### " + sec); parte = sec; }
    if (it.bloque) out.push("- BLOQUE x" + Math.max(1, ...(it.tramos || []).map(t => t.series.length)) + ": " + (it.tramos || []).map(t => nombreEj(t.ejercicio_id) + " [" + tipoDe(t.ejercicio_id) + "] " + textoValor(t.series[0] || {}, tipoDe(t.ejercicio_id))).join(" | "));
    else if (ejercicioVivo(it.ejercicio_id)) out.push("- " + nombreEj(it.ejercicio_id) + " [" + tipoDe(it.ejercicio_id) + "]: " + resumenSeriesRutina(it.series, tipoDe(it.ejercicio_id)) + (it.series[0] && it.series[0].nota ? " nota: " + it.series[0].nota : ""));
  });
  return out;
}
// Sesiones de una semana a partir de sus series (por día y entreno)
function sesionesDeSeries(series) {
  const out = [];
  [...new Set(series.map(s => s.fecha))].sort().forEach(f => {
    const delDia = series.filter(s => s.fecha === f).sort(ordenSerie);
    [...new Set(delDia.map(s => s.grupo || ""))].forEach(g => {
      out.push("## " + (g || "Sesión") + " @ " + diaSemana(f));
      out.push(...lineasItemsIA(itemsDe(delDia.filter(s => (s.grupo || "") === g))));
    });
  });
  return out;
}
// Cómo progresó cada ejercicio de fuerza: la primera y la última vez que lo hiciste
function progresionDeSeries(series) {
  const hechas = series.filter(s => hecha(s) && tipoDe(s.ejercicio_id) === "fuerza");
  const ejs = [...new Set(hechas.map(s => s.ejercicio_id))].slice(0, 16);
  return ejs.map(id => {
    const deEj = hechas.filter(s => s.ejercicio_id === id), fechas = [...new Set(deEj.map(s => s.fecha))].sort();
    const txt = f => resumenSeriesRutina(deEj.filter(s => s.fecha === f).sort(ordenSerie).map(valores), "fuerza");
    return "- " + nombreEj(id) + ": " + (fechas.length > 1 ? fechaCorta(fechas[0]) + " " + txt(fechas[0]) + " → " + fechaCorta(fechas[fechas.length - 1]) + " " + txt(fechas[fechas.length - 1]) : fechaCorta(fechas[0]) + " " + txt(fechas[0]));
  });
}
function referenciaIA(val) {
  if (!val) return null;
  if (val.startsWith("m:")) {
    const m = db.mesociclos[val.slice(2)];
    if (!m || m.borrado) return null;
    const ss = seriesVivas().filter(s => s.meso_id === m.id);
    const sem1 = m.inicio ? ss.filter(s => s.fecha < iso(sumarDias(lunesDe(deIso(m.inicio)), 7))) : [];
    return { titulo: "Mi mesociclo anterior «" + m.nombre + "» (" + n0(m.semanas) + " semanas" + (m.inicio ? " desde el " + fechaCorta(m.inicio) : "") + (n0(m.progresion) ? ", +" + num(m.progresion) + " kg por semana" : "") + ")",
      estructura: sesionesDeSeries(sem1.length ? sem1 : ss.slice(0, 60)), progreso: progresionDeSeries(ss), notas: m.notas || "" };
  }
  if (val.startsWith("l:")) {
    const l = db.listas[val.slice(2)];
    if (!l || l.borrado) return null;
    const lineas = [];
    let sepAnt = null;
    recorrerLista(l).forEach(({ p, sep }) => {
      if (sep && sep !== sepAnt) { lineas.push("SEMANA/BLOQUE: " + (sep.titulo || "")); sepAnt = sep; }
      lineas.push("## " + p.nombre, ...lineasItemsIA(p.items || []));
    });
    const ids = new Set(entrenosDeLista(l).flatMap(p => (p.items || []).flatMap(it => it.bloque ? (it.tramos || []).map(t => t.ejercicio_id) : [it.ejercicio_id])));
    const hace = iso(sumarDias(new Date(), -84));
    return { titulo: "Mi lista de entrenamientos «" + l.nombre + "»", estructura: lineas.slice(0, 140), progreso: progresionDeSeries(seriesVivas().filter(s => ids.has(s.ejercicio_id) && s.fecha >= hace)) };
  }
  const n = val === "u8" ? 8 : 4, desde = iso(sumarDias(new Date(), -7 * n)), hoy = iso(new Date());
  const ss = seriesVivas().filter(s => s.fecha >= desde && s.fecha <= hoy && hecha(s));
  // La estructura: la semana más reciente con entrenamientos
  const ult = ss.length ? iso(lunesDe(deIso(ss.map(s => s.fecha).sort().pop()))) : "";
  return { titulo: "Lo que he entrenado las últimas " + n + " semanas", estructura: sesionesDeSeries(ss.filter(s => s.fecha >= ult)), progreso: progresionDeSeries(ss) };
}
const MODOS_REF = {
  variantes: "Mantén la estructura (días, tipo de sesión, partes, número de ejercicios y volumen parecidos), pero cambia los ejercicios por VARIANTES que trabajen el mismo patrón de movimiento y los mismos músculos: otro agarre, implemento, ángulo o versión unilateral (por ejemplo press banca → press inclinado con mancuernas, sentadilla → sentadilla frontal o búlgara, remo con barra → remo en polea o con mancuerna). Ajusta las cargas e intensidades a partir de mis resultados.",
  progresar: "Continúa la progresión con los mismos ejercicios principales: sube cargas, repeticiones o series según lo que hice; si algún ejercicio se estancó, cámbialo por una variante parecida.",
  nuevo: "Hazme algo con otro enfoque, sin repetir los ejercicios principales, usando lo anterior para saber de dónde parto (nivel, volumen que tolero y cargas)."
};
function bloqueReferenciaIA() {
  const ref = referenciaIA($("iaRef").value);
  if (!ref) return [];
  const out = ["Toma como referencia " + ref.titulo.charAt(0).toLowerCase() + ref.titulo.slice(1) + ". " + MODOS_REF[$("iaRefModo").value || "variantes"]];
  if (ref.notas) out.push("Notas que tenía: " + ref.notas);
  if (ref.estructura.length) out.push("Estructura de referencia:", ...ref.estructura);
  else out.push("(No hay entrenamientos apuntados en esa referencia.)");
  if (ref.progreso.length) out.push("Cómo me fue (primera → última vez):", ...ref.progreso);
  return out.concat("");
}
// Opciones de «Basado en»: tus mesociclos, tus listas y tus últimas semanas
function pintarRefIA() {
  const sel = $("iaRef"), antes = sel.value;
  sel.textContent = "";
  const op = (v, t) => { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); };
  op("", "Nada: desde cero");
  vivos("mesociclos").sort((a, b) => (b.inicio || "").localeCompare(a.inicio || "")).forEach(m => op("m:" + m.id, "Mesociclo · " + m.nombre + (m.inicio ? " (" + fechaCorta(m.inicio) + ")" : "")));
  vivos("listas").forEach(l => op("l:" + l.id, "Lista · " + l.nombre));
  op("u4", "Mis últimas 4 semanas");
  op("u8", "Mis últimas 8 semanas");
  sel.value = [...sel.options].some(o => o.value === antes) ? antes : "";
  $("iaRefModoL").hidden = !sel.value;
}
$("iaRef").addEventListener("change", () => {
  // Un mesociclo de referencia propone sus semanas y días
  const v = $("iaRef").value;
  if (v.startsWith("m:") && db.mesociclos[v.slice(2)]) {
    const m = db.mesociclos[v.slice(2)], dd = [...new Set(seriesVivas().filter(s => s.meso_id === m.id).map(s => diaSemana(s.fecha)))];
    if (n0(m.semanas)) $("iaSemanas").value = n0(m.semanas);
    if (dd.length) $("iaDias").value = dd.length;
  }
  pintarCamposIA();
});
$("iaRefModo").addEventListener("change", pintarCamposIA);
function textoPrompt() {
  if (docIA) return textoPromptDocumento();
  if ($("iaModo").value === "sesion") return textoPromptSesion();
  const g = id => $(id).value.trim(), obj = g("iaObjetivo");
  const f = rendimiento().forma;
  const rms = vivos("ejercicios").filter(e => tipoDe(e.id) === "fuerza" && rmReferencia(e.id) > 0)
    .sort((a, b) => rmReferencia(b.id) - rmReferencia(a.id)).slice(0, 8).map(e => e.nombre + " " + num(rmReferencia(e.id)) + " kg");
  const corre = !!CARRERA_IA[obj] || obj === "combinado", carrera = CARRERA_IA[obj];
  // Marcas previstas (VDOT y Riegel desde tu mejor marca) para que la IA ajuste el plan a tu nivel real
  const marcas = marcasDe("carrera"), ref = marcas.filter(m => m.d >= 1000).sort((x, y) => vdotDe(y.d, y.t) - vdotDe(x.d, x.t))[0];
  const previstas = f ? [250, 1000, 2000, 5000, 10000, 21097, 42195].map(d => nombreDist(d) + " " + fmtTiempo(tiempoPrevisto(f.vdot, d)) + (ref ? " (Riegel " + fmtTiempo(ref.t * Math.pow(d / ref.d, 1.06)) + ")" : "")).join(", ") : "";
  const fechaCarrera = g("iaFechaCarrera"), semanasHasta = fechaCarrera ? Math.max(1, Math.round((deIso(fechaCarrera) - lunesDe(new Date())) / 6048e5)) : 0;
  const datos = [
    "Objetivo: " + OBJETIVOS_IA[obj] + (g("iaMeta") ? " (" + g("iaMeta") + ")" : ""),
    "Días por semana: " + (g("iaDias") || 3),
    "Nivel: " + g("iaNivel"),
    "Duración: " + (semanasHasta || g("iaSemanas") || 4) + " semanas" + (semanasHasta ? " (la carrera es el " + fechaCorta(fechaCarrera) + ")" : ""),
    carrera && g("iaMarca") && "Marca objetivo en la carrera: " + g("iaMarca"),
    carrera && previstas && "Mis marcas previstas ahora: " + previstas,
    "Material: " + (g("iaMaterial") || "gimnasio completo"),
    g("iaLimites") && "Limitaciones: " + g("iaLimites"),
    obj !== "5k" && obj !== "10k" && rms.length && "Mis 1RM aproximados: " + rms.join(", "),
    molestiasActivas().length && "Molestias o lesiones que tengo ahora (adapta el plan para no agravarlas): " + molestiasActivas().map(m => m.zona + (m.descripcion ? " (" + m.descripcion + ")" : "")).join("; "),
    corre && f && "Mis ritmos de carrera actuales por km: " + ZONAS.map(([n, fr]) => n.split(" (")[0] + " " + fmtTiempo(ritmoZona(f.vdot, fr))).join(", ") + " (VDOT " + num(Math.round(f.vdot)) + "). Usa estos ritmos."
  ].filter(Boolean);
  return ["Actúa como entrenador. Diséñame un plan de entrenamiento con estos datos:", ...datos.map(d => "- " + d), "", ...bloqueReferenciaIA(),
    "Responde SOLO con el plan dentro de un bloque de código, sin texto fuera, en este formato exacto (una app lo lee automáticamente):",
    "```", EJEMPLO_IA, "```",
    "Reglas del formato:",
    "- Empieza por «RUTINA: nombre». Después, «NOTA:» con una o dos frases sobre para quién es y cómo progresar.",
    "- Si todas las semanas son iguales, pon «SEMANAS: número» y escribe las sesiones una sola vez. Si el plan cambia cada semana, escribe «SEMANA 1», «SEMANA 2»… y debajo las sesiones de esa semana.",
    "- Cada sesión empieza por «## Nombre @ Día» (Lunes, Martes, Miércoles, Jueves, Viernes, Sábado o Domingo; varios días separados por comas).",
    "- Un ejercicio por línea: «- Nombre [tipo]: series». El tipo es fuerza, carrera, natacion o movilidad (estiramientos y movilidad). Usa nombres de ejercicios comunes en español.",
    "- Series: 4x8 (repeticiones), 4x8-12 (ventana de repeticiones), 3xmáx, 5x1000m, 8x100m, 1x40min, 6x2min. En fuerza también por tiempo: 1x5min (bici de calentamiento), 3x45s (plancha). En movilidad: 2x10 por lado, 2x30s por lado.",
    "- Intensidad: @RPE8 o @75% (del 1RM) en fuerza, @4:30/km en carrera, @1:50/100m en natación. No pongas kilos fijos.",
    "- Descanso: «desc 2:00» o «desc 90» (segundos). En carrera y natación la recuperación también puede ir en metros: «rec 200m».",
    "- Indicaciones de un ejercicio (tempo, tipo de banda o resistencia, EEP/RIR, pausas…): al final de su línea, «nota: …». Ejemplo: «- Sentadilla [fuerza]: 4x6 @RPE8 nota: Tempo 3-1-1-0».",
    "- Tramos que se repiten seguidos: «- BLOQUE x4: Ejercicio [tipo] 400m rec 200m | Ejercicio [tipo] 200m».",
    "- Divide cada sesión en partes con una línea «### Calentamiento», «### Parte principal» y, si encaja, «### Vuelta a la calma» antes de sus ejercicios.",
    "- El calentamiento incluye movilidad [movilidad] de las articulaciones que se van a trabajar ese día (por ejemplo cadera y tobillo para pierna, hombro y columna torácica para torso, o movilidad dinámica antes de correr) y, si encaja, otros ejercicios: bici o trote suave, activación, técnica o series de aproximación [fuerza]. La vuelta a la calma puede llevar estiramientos [movilidad].",
    "- Tirada larga con ritmos distintos por tramos, en una línea: «- Tirada larga [carrera]: 1x8km @5:20/km + 1x6km @4:50/km + 1x2km @5:30/km».",
    carrera && "- Como el plan prepara una carrera, escribe «SEMANA 1», «SEMANA 2»… hasta la última, que es la de la carrera, con progresión, semanas de descarga y un tapering (menos volumen, algo de ritmo de carrera) en las 1–2 semanas previas. La carrera va como «## Carrera @ Día» con «- " + nombreDist(carrera) + " [carrera]: 1x" + (carrera / 1000).toString().replace(".", ",") + "km @ritmo»."].filter(Boolean).join("\n");
}
// Un solo entrenamiento: tipo de sesión, duración, nivel, material, intensidad y molestias
function textoPromptSesion() {
  const g = id => $(id).value.trim(), f = rendimiento().forma;
  const tipo = g("iaSesTipo") === "otro" ? g("iaSesOtro") || "sesión libre" : $("iaSesTipo").selectedOptions[0].textContent;
  const esCarrera = /carrera|series|umbral|rodaje|tirada/i.test(tipo);
  const rms = vivos("ejercicios").filter(e => tipoDe(e.id) === "fuerza" && rmReferencia(e.id) > 0)
    .sort((a, b) => rmReferencia(b.id) - rmReferencia(a.id)).slice(0, 8).map(e => e.nombre + " " + num(rmReferencia(e.id)) + " kg");
  const datos = [
    "Tipo de sesión: " + tipo,
    "Duración aproximada: " + g("iaDuracion") + " minutos",
    "Nivel: " + g("iaNivel"),
    "Intensidad: " + $("iaIntensidad").selectedOptions[0].textContent,
    "Material: " + (g("iaMaterial") || "gimnasio completo"),
    g("iaLimites") && "Limitaciones: " + g("iaLimites"),
    !esCarrera && rms.length && "Mis 1RM aproximados: " + rms.join(", "),
    molestiasActivas().length && "Molestias o lesiones que tengo ahora (adapta la sesión para no agravarlas): " + molestiasActivas().map(m => m.zona + (m.descripcion ? " (" + m.descripcion + ")" : "")).join("; "),
    esCarrera && f && "Mis ritmos de carrera actuales por km: " + ZONAS.map(([n, fr]) => n.split(" (")[0] + " " + fmtTiempo(ritmoZona(f.vdot, fr))).join(", ") + " (VDOT " + num(Math.round(f.vdot)) + "). Usa estos ritmos."
  ].filter(Boolean);
  return ["Actúa como entrenador. Diséñame UN SOLO entrenamiento (una sesión) con estos datos:", ...datos.map(d => "- " + d), "", ...bloqueReferenciaIA(),
    "Responde SOLO con la sesión dentro de un bloque de código, sin texto fuera, en este formato exacto (una app lo lee automáticamente):",
    "```", EJEMPLO_SESION_IA, "```",
    "Reglas del formato:",
    "- Empieza por «RUTINA: nombre» y «NOTA:» con una o dos frases. Después UNA sola línea «## Nombre de la sesión» (sin día).",
    "- Un ejercicio por línea: «- Nombre [tipo]: series». El tipo es fuerza, carrera, natacion o movilidad (estiramientos y movilidad). Incluye calentamiento y vuelta a la calma si encajan.",
    "- Series: 4x8, 4x8-12 (ventana de repeticiones), 3xmáx, 5x1000m, 8x100m, 1x40min, 6x2min. Intensidad: @RPE8 o @75% en fuerza, @4:30/km en carrera, @1:50/100m en natación.",
    "- Calentamiento o isométricos por tiempo: «- Bicicleta estática [fuerza]: 1x5min», «- Plancha [fuerza]: 3x45s».",
    "- Movilidad y estiramientos en repeticiones o tiempo, y «por lado» si se hace a cada lado: «- Movilidad de cadera 90/90 [movilidad]: 2x8 por lado», «- Estiramiento de isquios [movilidad]: 2x30s por lado».",
    "- Descanso: «desc 2:00» o «desc 90»; en carrera y natación también «rec 200m».",
    "- Indicaciones (tempo, banda, EEP/RIR, pausas…): al final de la línea del ejercicio, «nota: …». Ejemplo: «- Remo con banda [fuerza]: 3x12 nota: Banda roja, tempo 2-0-1-1».",
    "- Divide la sesión en partes con una línea «### Calentamiento», «### Parte principal» y «### Vuelta a la calma» antes de sus ejercicios.",
    "- El calentamiento incluye movilidad [movilidad] de las articulaciones que se van a trabajar (cadera y tobillo para pierna, hombro y columna torácica para torso, movilidad dinámica antes de correr) y, si encaja, otros ejercicios: bici o trote suave, activación, técnica o series de aproximación [fuerza]. La vuelta a la calma puede llevar estiramientos [movilidad].",
    "- Tramos que se repiten: «- BLOQUE x4: Ejercicio [tipo] 400m rec 200m | Ejercicio [tipo] 200m». Tirada por tramos: «- Tirada larga [carrera]: 1x8km @5:20/km + 1x6km @4:50/km»."].filter(Boolean).join("\n");
}
// ---------- Importar un documento de entrenamiento (PDF, Word, Excel, CSV, texto o foto) ----------
let docIA = null;   // { nombre, texto, sinTexto } mientras el prompt es para convertir un documento
const LECTORES_DOCUMENTOS = {
  "./vendor/mammoth.browser.min.js": "sha384-8NWE3bZDrmRI4IePMoQaEoLhAQ1MmRMJkdNgnGiHRFanTqsFKr0TmK6aSZvFJ/PO",
  "./vendor/xlsx.full.min.js": "sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT"
};
const lectoresCargando = new Map();
function cargarScript(url) {
  if (!Object.prototype.hasOwnProperty.call(LECTORES_DOCUMENTOS, url)) return Promise.reject(new Error("Lector de documentos no autorizado."));
  if (lectoresCargando.has(url)) return lectoresCargando.get(url);
  const promesa = new Promise((ok, mal) => {
    const sc = document.createElement("script");
    sc.integrity = LECTORES_DOCUMENTOS[url]; sc.crossOrigin = "anonymous";
    sc.onload = ok;
    sc.onerror = () => { sc.remove(); lectoresCargando.delete(url); mal(new Error("No se ha podido cargar el lector. Comprueba la conexión y vuelve a intentarlo.")); };
    sc.src = url; document.head.appendChild(sc);
  });
  lectoresCargando.set(url, promesa);
  return promesa;
}
async function textoDocumento(f) {
  if (f.size > 20 * 1024 * 1024) throw new Error("El documento supera los 20 MB. Divide el archivo antes de importarlo.");
  const n = f.name.toLowerCase();
  if (/^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/.test(n)) return "";
  if (/\.pdf$/.test(n) || f.type === "application/pdf") {
    const pdfjsLib = await import("./vendor/pdf.min.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", location.href).href;
    const cargaPDF = pdfjsLib.getDocument({ data: await f.arrayBuffer(), isEvalSupported: false, enableScripting: false });
    try {
    const pdf = await cargaPDF.promise, partes = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
      const c = await (await pdf.getPage(i)).getTextContent();
      // Une los trozos por líneas (cambia la altura del texto = línea nueva)
      let linea = "", y = null;
      c.items.forEach(it => { const yy = Math.round(it.transform[5]); if (y !== null && Math.abs(yy - y) > 2) { partes.push(linea); linea = ""; } linea += (linea && !linea.endsWith(" ") ? " " : "") + it.str; y = yy; });
      partes.push(linea, "");
    }
    return partes.join("\n");
    } finally { await cargaPDF.destroy(); }
  }
  if (/\.docx$/.test(n)) {
    await cargarScript("./vendor/mammoth.browser.min.js");
    return (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() }, { externalFileAccess: false })).value;
  }
  if (/\.(xlsx|xls|ods)$/.test(n)) {
    await cargarScript("./vendor/xlsx.full.min.js");
    const lib = XLSX.read(await f.arrayBuffer());
    return lib.SheetNames.map(h => "## Hoja «" + h + "»\n" + XLSX.utils.sheet_to_csv(lib.Sheets[h], { FS: " | " }).replace(/(\s*\|\s*)+$/gm, "")).join("\n\n");
  }
  return f.text();
}
async function importarDocumento(f) {
  const ctx = contextoSesion();
  setEstado("Leyendo «" + f.name + "»…");
  let texto = "";
  try { texto = (await textoDocumento(f) || "").replace(/\r/g, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim(); }
  catch (e) { setEstado(e.message || "No se ha podido leer el documento.", true); return; }
  try { comprobarSesion(ctx); } catch { return; }
  abrirIA(texto.trim() ? "pegar" : "prompt");
  docIA = { nombre: f.name, texto: texto.slice(0, 15000), cortado: texto.length > 15000, sinTexto: !texto.trim() };
  if (texto.trim()) {
    $("iaRespuesta").value = prepararTextoImportado(texto, f.name);
    $("iaDocumentoAyuda").hidden = false;
    $("iaRevisar").click();
    setEstado("Documento leído. Revisa el texto y el entrenamiento antes de guardarlo.");
  } else {
    pintarCamposIA();
    setEstado("El archivo no contiene texto extraíble. Puedes adjuntarlo a tu IA con el prompt preparado.");
  }
}
function textoPromptDocumento() {
  const d = docIA, formato = (() => { const p = docIA; docIA = null; const t = textoPrompt(); docIA = p; return t.slice(t.indexOf("Responde SOLO")); })();
  return ["Actúa como entrenador. " + (d.sinTexto ? "Te adjunto en este mismo mensaje un documento («" + d.nombre + "», foto o PDF escaneado) con un plan o un entrenamiento." : "Este es el texto de un documento («" + d.nombre + "») con un plan o un entrenamiento."),
    "Conviértelo a mi formato SIN inventar nada: respeta los ejercicios, series, repeticiones, cargas, distancias, ritmos, descansos, días y semanas que indica. Si algo no aparece, déjalo con la opción más prudente. Si el plan cambia cada semana, usa «SEMANA 1», «SEMANA 2»…; si todas son iguales, «SEMANAS: número». Si es un solo entrenamiento, una sola sesión sin día.",
    d.sinTexto ? "" : "Documento:\n<<<\n" + d.texto + (d.cortado ? "\n[… el documento sigue; convierte al menos esta parte]" : "") + "\n>>>", "", formato].filter(x => x !== "").join("\n");
}
function pintarCamposIA() {
  $("iaPrompt").classList.toggle("con-doc", !!docIA);
  $("iaDocNota").hidden = !docIA;
  if (docIA) $("iaDocNota").textContent = docIA.sinTexto
    ? "📄 «" + docIA.nombre + "» no tiene texto que la app pueda leer (foto o PDF escaneado). Copia el prompt y pégalo en ChatGPT, Claude u otra IA adjuntando el documento; después pega aquí su respuesta (paso 2)."
    : "📄 Prompt preparado con el texto de «" + docIA.nombre + "»" + (docIA.cortado ? " (es largo: va la primera parte)" : "") + ". Cópialo, pégalo en tu IA y pega aquí su respuesta (paso 2).";
  const sesion = $("iaModo").value === "sesion", carrera = !sesion && !!CARRERA_IA[$("iaObjetivo").value];
  $("iaCamposPlan").hidden = sesion;
  $("iaCamposSesion").hidden = !sesion;
  $("iaCamposCarrera").hidden = !carrera;
  $("iaSesOtroL").hidden = $("iaSesTipo").value !== "otro";
  $("iaRefCaja").hidden = !!docIA;
  pintarRefIA();
  $("iaTexto").value = textoPrompt();
}
let rutinaIA = null, contextoIA = null;
// La clasificación usa la estructura reconocida, nunca el número de páginas del PDF.
function tipoRutinaImportada(r) {
  if (r.multi || r.semanas > 1 || /\bmesociclo\b/i.test(r.nombre)) return "mesociclo";
  return r.bloques.reduce((n, b) => n + b.sesiones.length, 0) === 1 ? "entrenamiento" : "elegir";
}
function orientarImportacionIA() {
  const tipo = tipoRutinaImportada(rutinaIA);
  if (tipo === "mesociclo") { abrirMesoImportado(); return; }
  pasoIA("vista");
  $("iaVistaTit").textContent = rutinaIA.nombre.replace(/_/g, " ");
  $("iaAvisoDias").textContent = tipo === "entrenamiento"
    ? "Edita las partes y los ejercicios aquí. Los cambios no se guardan hasta que elijas dónde añadir el entrenamiento."
    : "Hay varias sesiones, pero no se indica una duración en semanas. Elige una sesión para el calendario o abre el editor de mesociclo para organizar el plan.";
  $("iaVistaCaja").scrollIntoView({ block: "start" });
}
function abrirMesoImportado() {
  if (!rutinaIA || !validarEdicionIA()) return;
  const r = rutinaIA, plantillas = {}, dias = {};
  r.bloques.forEach((b, w) => {
    const destino = r.multi ? (dias["s" + (w + 1)] = {}) : dias;
    b.sesiones.forEach(s => {
      const id = nuevoId();
      plantillas[id] = { id, nombre: (r.multi ? r.nombre + " · S" + (w + 1) + " · " : "") + s.nombre,
        items: JSON.parse(JSON.stringify(s.items)), semana: w };
      s.dias.forEach(d => (destino[d] = destino[d] || []).push(id));
    });
  });
  const borrador = { id: nuevoId(), nombre: r.nombre, inicio: lunesSiguiente(), semanas: semanasRutina(r),
    dias, progresion: 0, descarga: {}, notas: r.nota || "", borrado: false, nuevo: true };
  $("dlgIA").close();
  abrirMeso(null, { borrador, plantillas, contexto: contextoIA });
}
function guardarPlantillasImportadas(m) {
  if (!mesoImportacion) return true;
  try { comprobarSesion(mesoImportacion.contexto); }
  catch { $("mesoAviso").textContent = "La sesión ha cambiado. Vuelve a importar el documento desde tu cuenta."; return false; }
  const usados = new Set(vivos("plantillas").map(p => norm(p.nombre)));
  Object.values(mesoImportacion.plantillas).forEach(p => {
    let nombre = p.nombre, n = 2;
    while (usados.has(norm(nombre))) nombre = p.nombre + " (" + n++ + ")";
    usados.add(norm(nombre));
    cambiar("plantillas", { id: p.id, nombre, items: itemsDesdeImportacion(p.items), borrado: false }, true);
  });
  mesoImportacion = null;
  return true;
}

function pasoIA(paso) {
  ["prompt", "pegar"].forEach(p => $("iaPasos").querySelector('[data-paso="' + p + '"]').setAttribute("aria-selected", String(p === paso || (paso === "vista" && p === "pegar"))));
  $("iaPasos").hidden = paso === "vista";
  $("iaPrompt").hidden = paso !== "prompt";
  $("iaPegar").hidden = paso !== "pegar";
  $("iaVistaCaja").hidden = paso === "prompt" || (paso === "pegar" && !rutinaIA);
  $("iaGuardarBarra").hidden = $("iaVistaCaja").hidden;
}
function abrirIA(paso) {
  contextoIA = contextoSesion();
  $("iaDiaOp").open = false;
  $("iaMensaje").textContent = "";
  $("iaDestino").value = "calendario";
  rutinaIA = null;
  docIA = null;
  $("iaDocumentoAyuda").hidden = true;
  $("iaVistaTit").textContent = "";
  $("iaError").textContent = "";
  $("dlgIA").setAttribute("aria-label", paso === "vista" ? "Rutina tipo" : "Crear con IA");
  pasoIA(paso);
  if (paso === "prompt") pintarCamposIA();
  if (!$("dlgIA").open) $("dlgIA").showModal();
}
function pintarVistaIA() {
  const r = rutinaIA;
  $("iaVistaCaja").hidden = !r;
  $("iaGuardarBarra").hidden = !r;
  if (!r) return;
  vistaRutina(r, $("iaVista"));
  const n = sesionesImportadas().length;
  $("iaPlantillas").textContent = "Guardar todas como plantillas (" + n + ")";
  $("iaPlantillas").hidden = n < 2;
  $("iaDiaFecha").value = $("iaDiaFecha").value || iso(new Date());
  actualizarDestinoIA();
}
$("iaPasos").addEventListener("click", ev => { const b = ev.target.closest("[data-paso]"); if (b) { pasoIA(b.dataset.paso); if (b.dataset.paso === "prompt") $("iaTexto").value = textoPrompt(); } });
["iaObjetivo", "iaDias", "iaNivel", "iaSemanas", "iaMaterial", "iaMeta", "iaLimites", "iaModo", "iaSesTipo", "iaSesOtro", "iaDuracion", "iaIntensidad", "iaMarca", "iaFechaCarrera"].forEach(id => ["input", "change"].forEach(ev => $(id).addEventListener(ev, pintarCamposIA)));
$("iaCopiar").addEventListener("click", () => {
  const t = $("iaTexto").value;
  const hecho = () => { $("iaCopiarAviso").textContent = "Prompt copiado. Pégalo en ChatGPT, Claude u otra IA y después pega su respuesta en el paso 2."; };
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(hecho, () => {
    $("iaTexto").focus(); $("iaTexto").select();
    $("iaCopiarAviso").textContent = document.execCommand && document.execCommand("copy") ? "Prompt copiado." : "Mantén pulsado el texto y elige Copiar.";
  });
});
$("iaRevisar").addEventListener("click", () => {
  // Si se pega el propio prompt (lleva un ejemplo dentro), la app leería el ejemplo: se avisa en vez de importarlo
  const txt = $("iaRespuesta").value;
  if (/Reglas del formato:/.test(txt) && /Responde SOLO con/.test(txt)) {
    rutinaIA = null;
    $("iaVistaTit").textContent = "";
    $("iaError").textContent = "Esto es el prompt, no la respuesta: pégalo en ChatGPT, Claude u otra IA y pega aquí lo que te conteste (empieza por «RUTINA:»).";
    pintarVistaIA();
    return;
  }
  const preparado = prepararTextoImportado(txt, docIA?.nombre || "Entrenamiento importado");
  const formato = leerRutina(preparado);
  const numerado = formato.error ? leerRutinaNumerada(txt, docIA?.nombre || "Entrenamiento importado") : null;
  const r = numerado || formato;
  if (!r.error && !numerado) $("iaRespuesta").value = preparado;
  rutinaIA = r.error ? null : r;
  $("iaError").textContent = r.error ? (docIA
    ? "El documento se ha leído, pero su estructura no se puede convertir completa automáticamente. No se ha guardado ningún entrenamiento. Puedes preparar la conversión con tu IA o adaptar el texto; añadir solo RUTINA no basta si las series tienen otro formato."
    : r.error + " Puedes editar el texto aquí. Usa ## para cada sesión y - Ejercicio [fuerza]: 3x10 para sus ejercicios.") : "";
  $("iaVistaTit").textContent = r.error ? "" : r.nombre;
  pintarVistaIA();
  if (!r.error) orientarImportacionIA();
});
$("iaRespuesta").addEventListener("input", () => { rutinaIA = null; $("iaError").textContent = ""; pintarVistaIA(); });
$("iaPlantillas").addEventListener("click", () => { if (!rutinaIA || !validarEdicionIA()) return; $("dlgIA").close(); guardarRutina(rutinaIA, false); });
$("iaLista").addEventListener("click", () => {
  if (!rutinaIA || !validarEdicionIA()) return;
  const r = rutinaIA;
  $("dlgIA").close();
  elegirLista("¿En qué lista guardo «" + r.nombre + "»?", l => guardarRutina(r, false, null, null, l));
});
$("iaMeso").addEventListener("click", abrirMesoImportado);
$("iaVolverTexto").addEventListener("click", () => { pasoIA("pegar"); $("iaPegar").scrollIntoView({ block: "start" }); });
function actualizarGuardadoIA(cambiarNombre = false) {
  const destino = $("iaDestino").value;
  $("iaFechaCaja").hidden = destino === "plantilla";
  $("iaAnadirDia").textContent = destino === "plantilla" ? "Guardar plantilla" : destino === "ambos" ? "Guardar ambos y abrir calendario" : "Guardar y abrir calendario";
  $("iaDestinoNota").textContent = destino === "plantilla" ? "Quedará disponible como plantilla para añadirla a un día cuando quieras."
    : destino === "ambos" ? "Se guardará una plantilla y una copia en el día elegido. Los cambios posteriores del calendario no modifican la plantilla."
    : "Se añadirá al día elegido. Allí podrás editar las partes, ejercicios y series con los controles habituales.";
  if (cambiarNombre) $("iaNombreSesion").value = sesionesImportadas()[Number($("iaDiaSesion").value)]?.s.nombre.replace(/_/g, " ") || "";
}
$("iaContinuar").addEventListener("click", () => {
  if (!rutinaIA || !validarEdicionIA()) return;
  $("iaDiaOp").open = true;
  $("iaDiaOp").scrollIntoView({block:"start"});
  $("iaDestino").focus({preventScroll:true});
});
$("iaDestino").addEventListener("change", () => actualizarGuardadoIA());
$("iaDiaSesion").addEventListener("change", () => actualizarGuardadoIA(true));
$("iaAnadirDia").addEventListener("click", () => {
  const r = rutinaIA, f = $("iaDiaFecha").value, destino = $("iaDestino").value;
  if (!r || !validarEdicionIA()) return;
  const original = sesionesImportadas()[Number($("iaDiaSesion").value)]?.s;
  const titulo = $("iaNombreSesion").value.trim();
  if (!original || !titulo) { avisoImportacionIA("Escribe el nombre del entrenamiento para guardarlo."); $("iaDiaOp").open=true; $("iaNombreSesion").focus(); return; }
  if (destino !== "plantilla" && !fechaSerieValida(f)) { avisoImportacionIA("Elige un día válido para el calendario."); $("iaDiaOp").open=true; $("iaDiaFecha").focus(); $("iaDiaFecha").reportValidity(); return; }
  const s = { ...original, nombre: titulo };
  if (destino !== "calendario") guardarRutina({ ...r, multi: false, bloques: [{ sesiones: [s] }] }, false);
  if (destino === "plantilla") { $("dlgIA").close(); return; }
  const usados = new Set(seriesVivas().filter(x => x.fecha === f).map(x => x.grupo || ""));
  (sesionesVacias[f] || []).forEach(g => usados.add(g));
  let nombre = s.nombre, n = 2;
  while (usados.has(nombre)) nombre = s.nombre + " (" + n++ + ")";
  pegarItems(f, itemsDesdeImportacion(s.items), nombre);
  gruposPlegados[f + "|" + nombre] = 0;
  persistir(); $("dlgIA").close(); abrirDia(f);
  setEstado("«" + nombre + "» añadido al " + fechaCorta(f) + ". Edita cada parte desde su menú ⋯; usa + Parte o + Ejercicio para ampliarlo.");
});
$("iaDocumentoAyuda").addEventListener("click", () => {
  if (!docIA) return;
  // Usa el texto que el usuario está viendo/editando, nunca una selección oculta.
  const texto = $("iaRespuesta").value;
  docIA = { ...docIA, texto: texto.slice(0,15000), cortado: texto.length > 15000, sinTexto: !texto.trim() };
  pasoIA("prompt"); pintarCamposIA();
});
$("iaAbrir").addEventListener("click", () => abrirIA("prompt"));
$("iaDocArchivo").addEventListener("change", ev => { const f = ev.target.files[0]; ev.target.value = ""; if (f) importarDocumento(f); });
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
// Tamaño en el ordenador (en el móvil no cambia nada): automático según la pantalla o elegido
const ponerTam = () => { const t = ajustes().tam || ""; if (t) document.documentElement.dataset.tam = t; else delete document.documentElement.dataset.tam; $("ajTam").value = t; };
$("ajTam").addEventListener("change", () => {
  const a = leer("ajustes-v1") || {};
  if ($("ajTam").value) a.tam = $("ajTam").value; else delete a.tam;
  escribir("ajustes-v1", a);
  ponerTam();
  setEstado("Tamaño guardado en este dispositivo");
});
ponerTam();
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
  const v = clase === "t" ? leerTiempo(inp.value) : clase === "s" ? leerSegs(inp.value) : parseFloat((inp.value || "0").replace(",", ".")) || 0;
  const n = Math.max(0, Math.round(((isNaN(v) ? 0 : v) + signo * { kg: ajustes().pasoKg, pct: 2.5, reps: 1, m: enKm() ? 0.1 : 100, t: 5, s: 5 }[clase]) * 100) / 100);
  inp.value = !n ? "" : clase === "s" ? (n < 60 ? String(n) : fmtTiempo(n)) : clase === "t" ? fmtTiempo(n) : clase === "kg" || clase === "pct" || clase === "m" ? num(n) : String(n);
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
  const activas = molestiasActivas().length;
  $("molestiasSem").classList.toggle("sin-activas", activas === 0);
  $("molestiasLinea").textContent = activas ? activas + (activas === 1 ? " activa" : " activas") : "Sin activas";
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
$("molBorrar").addEventListener("click", async () => {
  if (!await confirmar("¿Eliminar esta molestia?")) return;
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
  if (texto) avisoDeshacer(texto + " · Deshacer para volver como estaba", antes);
}
// Ejercicios añadidos y aún sin series: delante de qué elemento del día quedan (solo en este dispositivo)
let esperaAntes = leer("espera-antes-v1") || {};
// Al recibir su primera serie, el ejercicio se queda donde estaba en vez de irse al final
function colocarPrimeraSerie(fecha, id, grupo, eraEspera) {
  const k = fecha + "|" + id, antes = esperaAntes[k];
  delete esperaAntes[k];
  escribir("espera-antes-v1", esperaAntes);
  if (!eraEspera || !antes) return;
  const g = estructuraDia(fecha).find(x => x.nombre === (grupo || ""));
  if (!g) return;
  const items = g.items.slice(), i = items.findIndex(x => x.clave.split("§")[0] === id && !x.clave.startsWith("b:")), j = items.findIndex(x => x.clave === antes);
  if (i < 0 || j < 0) return;
  const [it] = items.splice(i, 1);
  items.splice(items.findIndex(x => x.clave === antes), 0, it);
  reordenar(items.map(x => x.series), "");
}
// Pasar un ejercicio o bloque a otra sesión del mismo día (con Deshacer)
function moverASesion(series, destino) {
  if (!series.length) return;
  const antes = series.map(s => ["series", { ...s }]);
  series.forEach(s => cambiar("series", { ...s, grupo: destino }, true));
  persistir();
  pintarBloques(true);
  avisoDeshacer("Movido a «" + (destino || "Sin sesión") + "»", antes);
}
// Sesiones del día con sus ejercicios y bloques, en el orden en que se ven
// Clave de un elemento del día: «b:bloque», o el ejercicio y, si tiene parte, «ejercicio§parte»
// El mismo ejercicio puede ir dos veces en la misma parte: la 2.ª tarjeta es «ejercicio#2» (columna «copia»)
const claveSerie = s => s.bloque_id ? "b:" + s.bloque_id : s.ejercicio_id + (n0(s.copia) > 1 ? "#" + n0(s.copia) : "") + (s.seccion ? "§" + s.seccion : "");
const ejDeClave = k => String(k).split("§")[0].split("#")[0];
const copiaDeClave = k => parseInt(String(k).split("§")[0].split("#")[1], 10) || 0;
function estructuraDia(fecha) {
  const grupos = [];
  seriesDelDia(fecha).forEach(s => {
    let g = grupos.find(x => x.nombre === (s.grupo || ""));
    if (!g) grupos.push(g = { nombre: s.grupo || "", items: [] });
    const clave = claveSerie(s);
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
// zonas (opcional): { lista: () => [elementos], alSoltar: zona => … } — soltar encima de una (p. ej. la cabecera
// de «Calentamiento») mete el elemento dentro, como una app en una carpeta
function asaArrastre(el, hermanos, alSoltar, nombre, zonas) {
  const asa = document.createElement("button");
  asa.type = "button";
  asa.className = "asa";
  asa.textContent = "≡";
  asa.setAttribute("aria-label", "Mover " + nombre + " (arrástralo o usa las flechas arriba y abajo)");
  asa.addEventListener("click", e => e.stopPropagation());
  // En iOS, que el toque en el asa no acabe enfocando lo que haya debajo al soltar (abriría el teclado)
  asa.addEventListener("touchstart", e => e.preventDefault(), { passive: false });
  asa.addEventListener("keydown", e => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const h = hermanos(), i = h.indexOf(el), j = i + (e.key === "ArrowUp" ? -1 : 1);
    if (j < 0 || j >= h.length) return;
    const n = h.slice();
    [n[i], n[j]] = [n[j], n[i]];
    alSoltar(n);
  });
  // Arrastre: el elemento sigue al dedo con transform (en cada fotograma), los demás se apartan con una
  // transición corta y el orden se guarda una sola vez al soltar; cerca de los bordes la vista se desplaza sola
  asa.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    ultimoTocado = null;   // al arrastrar, lo movido va a su nuevo sitio: no se «sujeta» la pantalla
    const lista = hermanos(), idx = lista.indexOf(el), zl = zonas ? zonas.lista() : [];
    if ((lista.length < 2 && !zl.length) || idx < 0) return;
    let zona = null, cand = null, candDesde = 0, tZona = 0;
    try { asa.setPointerCapture(e.pointerId); } catch {}
    arrastreActivo = true;
    const y0 = scrollY, cajas = lista.map(x => { const r = x.getBoundingClientRect(); return { top: r.top + y0, alto: r.height }; });
    const hueco = idx + 1 < cajas.length ? cajas[idx + 1].top - cajas[idx].top - cajas[idx].alto : idx > 0 ? cajas[idx].top - cajas[idx - 1].top - cajas[idx - 1].alto : 0;
    const paso = cajas[idx].alto + Math.max(0, hueco), inicioY = e.clientY + y0;
    const zf = el.offsetHeight > 0 ? cajas[idx].alto / el.offsetHeight || 1 : 1;   // zoom del ordenador
    let dedoY = e.clientY, destino = idx, pendiente = false, vivo = true;
    el.classList.add("arrastrando");
    lista.forEach(x => { if (x !== el) x.classList.add("apartandose"); });
    const bordes = () => {
      let arriba = 0, abajo = innerHeight;
      document.querySelectorAll(".cabecera, .tabbar").forEach(b => {
        const pos = getComputedStyle(b).position;
        if (pos !== "sticky" && pos !== "fixed") return;
        const r = b.getBoundingClientRect();
        if (r.height && r.top < innerHeight / 2) arriba = Math.max(arriba, r.bottom); else if (r.height) abajo = Math.min(abajo, r.top);
      });
      return { arriba, abajo };
    };
    const pintar = () => {
      pendiente = false;
      if (!vivo) return;
      // Desplazamiento automático cerca de la cabecera o de la barra de pestañas
      const { arriba, abajo } = bordes();
      if (dedoY < arriba + 48) scrollBy(0, -Math.min(14, arriba + 48 - dedoY));
      else if (dedoY > abajo - 48) scrollBy(0, Math.min(14, dedoY - (abajo - 48)));
      // Cambia de sitio cuando el borde de lo arrastrado (el de abajo al bajar, el de arriba al subir) pasa la mitad del otro: igual de fácil en los dos sentidos
      const dy = dedoY + scrollY - inicioY, arribaEl = cajas[idx].top + dy, abajoEl = arribaEl + cajas[idx].alto;
      destino = idx;
      // ¿El dedo está encima de una zona? Entonces se resalta y los demás no se apartan
      const zc = zl.find(x => { const r = x.getBoundingClientRect(); return dedoY >= r.top && dedoY <= r.bottom; }) || null;
      if (zc !== cand) { cand = zc; candDesde = Date.now(); }
      const z = cand && Date.now() - candDesde >= 450 ? cand : null;
      if (cand && !z) { clearTimeout(tZona); tZona = setTimeout(pedir, 470 - (Date.now() - candDesde)); }
      if (z !== zona) { if (zona) zona.classList.remove("zona-destino"); zona = z; if (zona) zona.classList.add("zona-destino"); el.classList.toggle("sobre-zona", !!zona); }
      lista.forEach((x, k) => {
        if (k === idx) return;
        if (zona) { x.style.transform = ""; return; }
        const medio = cajas[k].top + cajas[k].alto / 2;
        let mueve = 0;
        if (k < idx && arribaEl < medio) { mueve = paso; destino--; }
        else if (k > idx && abajoEl > medio) { mueve = -paso; destino++; }
        x.style.transform = mueve ? "translate3d(0," + mueve / zf + "px,0)" : "";
      });
      el.style.transform = "translate3d(0," + dy / zf + "px,0)";
      if (dedoY < arriba + 48 || dedoY > abajo - 48) pedir();
    };
    const pedir = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(pintar); } };
    const mover = ev => { dedoY = ev.clientY; pedir(); };
    const fin = ev => {
      vivo = false;
      clearTimeout(tZona);
      arrastreActivo = false;
      asa.removeEventListener("pointermove", mover);
      asa.removeEventListener("pointerup", fin);
      asa.removeEventListener("pointercancel", fin);
      lista.forEach(x => { x.style.transform = ""; x.classList.remove("apartandose"); });
      el.classList.remove("arrastrando", "sobre-zona");
      if (zona) zona.classList.remove("zona-destino");
      if (ev.type !== "pointercancel" && zona) { el.style.transform = ""; zonas.alSoltar(zona); return; }
      if (ev.type === "pointercancel" || destino === idx) { if (repintarLuego) pintarBloques(true); return; }
      const nuevo = lista.slice();
      nuevo.splice(idx, 1);
      nuevo.splice(destino, 0, el);
      alSoltar(nuevo, el);
    };
    asa.addEventListener("pointermove", mover);
    asa.addEventListener("pointerup", fin);
    asa.addEventListener("pointercancel", fin);
  });
  return asa;
}

// Arrastrar un ejercicio o bloque dentro de su entreno: lo arrastrado sigue al dedo y un hueco marca dónde caerá.
// Los demás no cambian de parte: solo se apartan dentro de la suya para dejar sitio. El hueco puede ir:
// entre dos ejercicios, al principio de una parte (mitad de abajo de su título), al final (mitad de arriba de su
// «+ Ejercicio») o suelto entre dos partes (mitad de arriba del título de la de abajo, o de abajo del «+ Ejercicio» de la de arriba)
function asaArrastreDia(el, caja, hermanos, alSoltar, nombre, zonas) {
  const asa = asaArrastre(el, hermanos, alSoltar, nombre, zonas);   // teclado (flechas) como siempre
  const nuevo = asa.cloneNode(true);
  nuevo.addEventListener("click", e => e.stopPropagation());
  nuevo.addEventListener("touchstart", e => e.preventDefault(), { passive: false });
  nuevo.addEventListener("keydown", e => asa.dispatchEvent(new KeyboardEvent("keydown", { key: e.key, bubbles: false, cancelable: true })) || e.preventDefault());
  nuevo.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    ultimoTocado = null;
    try { nuevo.setPointerCapture(e.pointerId); } catch {}
    arrastreActivo = true;
    // Sin «position: fixed» (en el iPhone descoloca): lo arrastrado sigue en su sitio sin ocupar espacio
    // (margen negativo) y se mueve con transform; el hueco ocupa su lugar
    const r0 = el.getBoundingClientRect(), y0 = e.clientY, sy0 = scrollY;
    // En el ordenador la app va con zoom (body): las medidas de pantalla se pasan a px de CSS dividiendo por él
    const zf = el.offsetHeight > 0 ? r0.height / el.offsetHeight || 1 : 1;
    const gap = parseFloat(getComputedStyle(el.parentElement).rowGap) || 0;
    const ph = document.createElement("div");
    ph.className = "hueco-arrastre";
    ph.style.height = el.offsetHeight + "px";
    el.before(ph);
    el.classList.add("arrastrando", "arrastre-fijo");
    el.style.marginBottom = -(el.offsetHeight + gap) + "px";
    const zl = zonas ? zonas.lista().filter(z => z.closest(".bloque-rep")) : [];
    let dedoY = e.clientY, ultY = e.clientY, dir = 1, pendiente = false, vivo = true, zona = null, cand = null, candDesde = 0, tZona = 0;
    // Bordes de la pantalla (cabecera y barra fijas): se miden una vez
    let bArriba = 0, bAbajo = innerHeight;
    document.querySelectorAll(".cabecera, .tabbar").forEach(b => {
      const pos = getComputedStyle(b).position;
      if (pos !== "sticky" && pos !== "fixed") return;
      const r = b.getBoundingClientRect();
      if (r.height && r.top < innerHeight / 2) bArriba = Math.max(bArriba, r.bottom); else if (r.height) bAbajo = Math.min(bAbajo, r.top);
    });
    // Posiciones (en el documento, sin transiciones) de lo que puede recibir el hueco: se miden al empezar y cada vez que se mueve el hueco
    // Todo el día: también se puede soltar en otro entreno (su título lo pone el primero; su «+ Ejercicio», el último)
    const zonaDia = caja.closest(".bloques") || caja;
    const calcObjetivos = () => [...zonaDia.querySelectorAll(".grupo .bloque[data-clave], .grupo > .parte-caja > .parte-cab, .grupo > .parte-caja > .add-fila, .letra-caja > .letra-cab, .grupo > .add-fila, .grupo > .grupo-cab")]
      .filter(x => x !== el && !el.contains(x) && x.offsetParent !== null);
    let objetivos = calcObjetivos();
    // Partes, letras o entrenos plegados: si te quedas un momento encima de su título se despliegan para poder
    // meter ahí el ejercicio; al soltar fuera vuelven a quedar plegados (y si lo sueltas dentro, se quedan abiertos)
    const diaId = (dias.find(d => d.col.contains(zonaDia)) || {}).id || "";
    const plegable = cab => {
      const cont = cab.parentElement;
      if (cab.classList.contains("parte-cab") && cont.classList.contains("p-plegada")) return { cont, cls: "p-plegada", key: "p|" + diaId + "|" + ((cont.closest(".grupo") || {}).dataset || {}).grupo + "|" + cont.dataset.parte };
      if (cab.classList.contains("letra-cab") && cont.classList.contains("l-plegada")) { const pc = cont.closest(".parte-caja"); return { cont, cls: "l-plegada", key: "l|" + diaId + "|" + ((cont.closest(".grupo") || {}).dataset || {}).grupo + "|" + (pc ? pc.dataset.parte : "") + "|" + cont.dataset.letra }; }
      if (cab.classList.contains("grupo-cab") && cont.classList.contains("g-plegado")) return { cont, cls: "g-plegado", key: diaId + "|" + (cont.dataset.grupo || "") };
      return null;
    };
    const abiertasTemp = [];
    let candPl = null, candPlDesde = 0, tPl = 0;
    let pos = [], baseEl = 0, trasEl = 0;
    const medir = () => {
      const sy = scrollY;
      pos = objetivos.map(x => { const r = x.getBoundingClientRect(); return { x, top: r.top + sy, bottom: r.bottom + sy }; });
      const re = el.getBoundingClientRect();
      baseEl = re.top + sy - trasEl;   // dónde estaría sin el transform
      zlPos = zl.map(x => { const r = x.getBoundingClientRect(); return { x, top: r.top + sy, bottom: r.bottom + sy }; });
    };
    let zlPos = [];
    const moverHueco = hacer => {
      const antes = new Map(pos.map(p => [p.x, p.top]));
      hacer();
      objetivos.forEach(x => { x.style.transition = "none"; x.style.transform = ""; });
      medir();
      pos.forEach(p => {
        const d = antes.get(p.x) - p.top;
        if (!d) return;
        p.x.style.transform = "translate3d(0," + d / zf + "px,0)";
        requestAnimationFrame(() => { p.x.style.transition = "transform 0.15s ease"; p.x.style.transform = ""; });
      });
    };
    const colocar = (ref, donde) => {   // donde: "antes" | "despues"
      if (donde === "antes" ? ref.previousElementSibling === ph || ref.previousElementSibling === el && el.previousElementSibling === ph : ref.nextElementSibling === ph) return;
      moverHueco(() => donde === "antes" ? ref.before(ph) : ref.after(ph));
    };
    medir();
    const pintar = () => {
      pendiente = false;
      if (!vivo) return;
      if (dedoY < bArriba + 48) scrollBy(0, -Math.min(14, bArriba + 48 - dedoY));
      else if (dedoY > bAbajo - 48) scrollBy(0, Math.min(14, dedoY - (bAbajo - 48)));
      const sy = scrollY, topDoc = r0.top + (dedoY - y0) + sy;   // el dedo manda: lo arrastrado no se separa de él
      trasEl = topDoc - baseEl;
      el.style.transform = "translate3d(0," + trasEl / zf + "px,0)";
      const yDedo = dedoY + sy;
      const zc = (zlPos.find(p => yDedo >= p.top && yDedo <= p.bottom) || {}).x || null;
      if (zc !== cand) { cand = zc; candDesde = Date.now(); }
      const z = cand && Date.now() - candDesde >= 450 ? cand : null;
      if (cand && !z) { clearTimeout(tZona); tZona = setTimeout(pedir, 470 - (Date.now() - candDesde)); }
      if (z !== zona) { if (zona) zona.classList.remove("zona-destino"); zona = z; if (zona) zona.classList.add("zona-destino"); el.classList.toggle("sobre-zona", !!zona); }
      if (!zona) {
        // Se mira con el borde de lo arrastrado: el de abajo al bajar, el de arriba al subir (igual de fácil en los dos sentidos)
        const y = dir > 0 ? topDoc + r0.height - 4 : topDoc + 4;
        const t = pos.find(p => y >= p.top && y <= p.bottom && !plegable(p.x));   // un título plegado no mueve el hueco: espera a desplegarse
        if (t) {
          const x = t.x, arribaMitad = y < (t.top + t.bottom) / 2;
          if (x.classList.contains("grupo-cab")) colocar(x, "despues");
          else if (x.classList.contains("parte-cab") || x.classList.contains("letra-cab")) arribaMitad ? colocar(x.parentElement, "antes") : colocar(x, "despues");
          else if (x.classList.contains("add-fila")) x.parentElement.classList.contains("parte-caja") ? (arribaMitad ? colocar(x, "antes") : colocar(x.parentElement, "despues")) : colocar(x, "antes");
          else colocar(x, arribaMitad ? "antes" : "despues");
        }
      }
      // Si el hueco se ha movido, su sitio de partida ha cambiado: se recoloca en el mismo fotograma (sin saltos)
      if (topDoc - baseEl !== trasEl) { trasEl = topDoc - baseEl; el.style.transform = "translate3d(0," + trasEl / zf + "px,0)"; }
      // Desplegar lo plegado si el dedo se queda un momento encima de su título
      const cabPl = pos.find(p => yDedo >= p.top && yDedo <= p.bottom && plegable(p.x));
      const cp = cabPl ? cabPl.x : null;
      if (cp !== candPl) { candPl = cp; candPlDesde = Date.now(); }
      if (candPl) {
        if (Date.now() - candPlDesde >= 350) {
          const info = plegable(candPl);
          if (info) { info.cont.classList.remove(info.cls); abiertasTemp.push(info); objetivos = calcObjetivos(); medir(); trasEl = topDoc - baseEl; el.style.transform = "translate3d(0," + trasEl / zf + "px,0)"; }
          candPl = null;
        } else { clearTimeout(tPl); tPl = setTimeout(pedir, 370 - (Date.now() - candPlDesde)); }
      }
      ph.classList.toggle("oculto", !!zona);
      if (dedoY < bArriba + 48 || dedoY > bAbajo - 48) pedir();
    };
    const pedir = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(pintar); } };
    const mover = ev => { dedoY = ev.clientY; if (Math.abs(dedoY - ultY) > 2) { dir = dedoY > ultY ? 1 : -1; ultY = dedoY; } pedir(); };
    const fin = ev => {
      vivo = false;
      clearTimeout(tZona); clearTimeout(tPl);
      arrastreActivo = false;
      // Soltado justo encima del título de un entreno o parte plegados (sin esperar a que se abra): entra ahí, al final,
      // y se despliega para que se vea
      let cambioPl = false;
      if (ev.type !== "pointercancel" && !zona) {
        const yF = dedoY + scrollY, cabF = pos.find(p => yF >= p.top && yF <= p.bottom && plegable(p.x));
        if (cabF) {
          const info = plegable(cabF.x), fin = info.cont.querySelector(":scope > .add-fila");
          if (info.cls === "l-plegada") info.cont.appendChild(ph);
          else if (fin) fin.before(ph); else info.cont.appendChild(ph);
          info.cont.classList.remove(info.cls);
          gruposPlegados[info.key] = 0; cambioPl = true;
        }
      }
      // Lo desplegado al pasar: donde ha caído se queda abierto; lo demás vuelve a plegarse
      abiertasTemp.forEach(info => {
        if (!zona && ev.type !== "pointercancel" && info.cont.contains(ph)) { gruposPlegados[info.key] = 0; cambioPl = true; }
        else info.cont.classList.add(info.cls);
      });
      if (cambioPl) escribir("grupos-plegados-v1", gruposPlegados);
      nuevo.removeEventListener("pointermove", mover);
      nuevo.removeEventListener("pointerup", fin);
      nuevo.removeEventListener("pointercancel", fin);
      el.classList.remove("arrastrando", "arrastre-fijo", "sobre-zona");
      el.style.transform = ""; el.style.marginBottom = "";
      objetivos.forEach(x => { x.style.transition = ""; x.style.transform = ""; });
      if (zona) zona.classList.remove("zona-destino");
      if (ev.type !== "pointercancel" && zona) { ph.remove(); zonas.alSoltar(zona); return; }
      const destParte = ph.closest(".parte-caja") ? ph.closest(".parte-caja").dataset.parte || "" : "";
      const cajaDest = ph.closest(".grupo") || caja;
      const orden = [...cajaDest.querySelectorAll(".bloque[data-clave], .hueco-arrastre")].filter(x => x !== el).map(x => x === ph ? el : x);
      ph.remove();
      if (ev.type === "pointercancel") { if (repintarLuego) pintarBloques(true); return; }
      if (cajaDest !== caja) { alSoltar(orden, el, destParte, cajaDest.dataset.grupo || ""); return; }
      const antes = hermanos();
      const igual = antes.length === orden.length && antes.every((x, k) => x === orden[k]) && destParte === (el.dataset.parte || "");
      if (igual) { if (repintarLuego) pintarBloques(true); return; }
      alSoltar(orden, el, destParte);
    };
    nuevo.addEventListener("pointermove", mover);
    nuevo.addEventListener("pointerup", fin);
    nuevo.addEventListener("pointercancel", fin);
  });
  return nuevo;
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
  gestoDia = diaAbierto && e.touches.length === 1 && t.clientX > 30 && !e.target.closest(".series li, input, textarea, select, .editor, .asa") ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
$("semana").addEventListener("touchend", e => {
  if (!gestoDia) return;
  const t = e.changedTouches[0], dx = t.clientX - gestoDia.x, dy = t.clientY - gestoDia.y;
  gestoDia = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) abrirDia(iso(sumarDias(deIso(diaAbierto), dx < 0 ? 1 : -1)));
}, { passive: true });
// Días desplegados o plegados a mano; se recuerdan unas semanas
let desplegados = {}; // todos los días empiezan plegados en cada apertura
const desplegado = id => desplegados[id] ?? false;
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
  if (desplegados[d.id]) verAlAbrir(d.col);
  $("hoyBtn").hidden = desplazamiento === 0 && desplegado(iso(new Date()));
}
// Tras abrir un desplegable, si su contenido queda fuera de la pantalla se desplaza lo justo para verlo
// (si es más alto que la pantalla, su cabecera queda arriba); scroll-margin deja sitio a la cabecera y a las pestañas
function verAlAbrir(el) {
  const rapido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => el.scrollIntoView({ block: "nearest", behavior: rapido ? "auto" : "smooth" }), rapido ? 0 : 280);
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
  const km = lineasTotal(del).map(l => l.corto).join(" · ");
  dia.resumenEl.textContent = nombre ? (km ? km + " · " : "") + nombre
    : [km, del.length ? h + "/" + del.length + " series" : "", n0(e.rpe) ? "esfuerzo " + e.rpe + "/10" : ""].filter(Boolean).join(" · ") || "Nada apuntado";
  dia.resumenEl.title = nombre;
  dia.empezarEl.hidden = !del.length;
  const variasSesiones = new Set(del.map(s => s.grupo || "")).size > 1;
  dia.empezarEl.textContent = del.length && h === del.length ?
    (variasSesiones ? "✓ Día completado · Ver entrenamientos" : "✓ Completado · Ver entrenamiento") :
    variasSesiones ? "▶ Elegir entrenamiento" : h ? "▶ Seguir entreno (" + h + "/" + del.length + ")" : "▶ Empezar entreno";
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
  deshacerSug = null;
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
  if (deshacerSug) { const f = deshacerSug; deshacerSug = null; $("toast").hidden = true; f(); return; }
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
  const pr = hecha(fila) && prsEj(fila.ejercicio_id).has(fila.id);
  if (pr) { celebrar(); avisoDeshacer("¡Nuevo récord! " + nombreEj(fila.ejercicio_id) + " · " + serieTexto(fila), deshacer, true); }
  else if (deshacer) avisoDeshacer("Serie hecha · " + nombreEj(fila.ejercicio_id), deshacer);
  return pr;
}
function marcarHecha(antes, fila) {
  cambiar("series", fila);
  pintarBloques(true);
  avisarSiPR(fila, [["series", antes]]);
}
// Volver a pendiente una serie hecha: deja de contar para récords, volumen y marcas; los objetivos se recalculan
function desmarcar(s) {
  cambiar("series", { ...s, hecha: false });
  pintarBloques(true);
  avisoDeshacer("Serie marcada como pendiente · " + nombreEj(s.ejercicio_id), [["series", s]]);
}
function botonHecha(s, texto, nombre) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "n n-hecha";
  b.textContent = texto;
  b.title = "Marcar como pendiente";
  b.setAttribute("aria-label", "Hecha: " + nombre + ". Pulsa para marcarla como pendiente");
  b.addEventListener("click", () => desmarcar(s));
  return b;
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
function colaEntreno(fecha, grupo = null) {
  const delDia = seriesDelDia(fecha).filter(s => grupo === null || (s.grupo || "") === grupo), grupos = [], cola = [];
  delDia.forEach(s => { if (!grupos.includes(s.grupo || "")) grupos.push(s.grupo || ""); });
  grupos.forEach(g => {
    const partes = [];
    delDia.filter(s => (s.grupo || "") === g).forEach(s => {
      const nombre = s.seccion || "";
      let p = nombre ? partes.find(x => x.nombre === nombre) : partes[partes.length - 1];
      if (!p || (!nombre && p.nombre)) { p = { nombre, filas: [] }; partes.push(p); }
      p.filas.push(s);
    });
    partes.forEach(p => {
      const claves = [...new Set(p.filas.map(claveSerie))];
      claves.forEach(k => p.filas.filter(s => claveSerie(s) === k)
        .sort((a, b) => sOrden(a, b)).forEach(s => cola.push(s.id)));
    });
  });
  return cola;
}
function sOrden(a, b) { return a.bloque_id ? n0(a.ronda) - n0(b.ronda) || n0(a.orden) - n0(b.orden) : n0(a.orden) - n0(b.orden); }
const serieEnt = () => ent && db.series[ent.cola[ent.i]];
function empezarEntreno(dia, grupo) {
  if (grupo === undefined) {
    const grupos = [...new Set(seriesDelDia(dia.id).map(s => s.grupo || ""))];
    const abiertos = [...dia.bloquesEl.querySelectorAll(":scope > .grupo:not(.g-plegado)")].map(x => x.dataset.grupo || "").filter(g => grupos.includes(g));
    if (grupos.length > 1) {
      abrirMenu("Elige un entrenamiento", "Los completados se pueden abrir para revisar lo registrado.", grupos.map(g => {
        const filas = seriesDelDia(dia.id).filter(s => (s.grupo || "") === g), hechas = filas.filter(hecha).length;
        return { texto: (hechas === filas.length ? "✓ " : "▶ ") + (g || "Entreno 1") +
          (hechas === filas.length ? " · Completado" : hechas ? " · Seguir (" + hechas + "/" + filas.length + ")" : " · Empezar"),
          accion: () => empezarEntreno(dia, g) };
      }));
      return;
    }
    grupo = abiertos.length === 1 ? abiertos[0] : grupos[0];
  }
  if (grupo === undefined) return;
  const cola = colaEntreno(dia.id, grupo);
  if (!cola.length) return;
  const i = cola.findIndex(id => !hecha(db.series[id]));
  ent = { dia, grupo, cola, i: Math.max(0, i), fin: 0, timer: null, campos: [] };
  $("enDescanso").hidden = true;
  $("enFin").hidden = true;
  $("dlgEntreno").showModal();
  pintarEntreno();
  if (navigator.wakeLock) navigator.wakeLock.request("screen").then(w => { bloqueoPantalla = w; }).catch(() => {});
}
function pintarEntreno() {
  ent.cola = ent.cola.filter(id => db.series[id] && !db.series[id].borrado && (db.series[id].grupo || "") === ent.grupo && ejercicioVivo(db.series[id].ejercicio_id));
  if (!ent.cola.length) { salirEntreno(); return; }
  ent.i = Math.min(ent.i, ent.cola.length - 1);
  const s = serieEnt(), tipo = tipoDe(s.ejercicio_id), dist = esDistancia(tipo), lista = ent.cola.map(id => db.series[id]);
  const hechas = lista.filter(hecha).length;
  $("enProg").textContent = "Serie " + (ent.i + 1) + " de " + lista.length + " · " + hechas + (hechas === 1 ? " hecha" : " hechas");
  $("enBarra").style.width = (hechas / lista.length * 100).toFixed(1) + "%";
  $("enGrupo").textContent = (s.grupo || NOMBRES[ent.dia.i] + " " + fmt(deIso(ent.dia.id))) + (s.seccion ? " · " + s.seccion : "");
  $("enEj").textContent = nombreEj(s.ejercicio_id);
  $("enEj").appendChild(etiquetaTipo(tipo));
  const videoEj = ejercicioVivo(s.ejercicio_id);
  $("enVideo").hidden = !idYoutube(videoEj?.video_url);
  $("enVideo").setAttribute("aria-label", "Ver el vídeo de " + nombreEj(s.ejercicio_id));
  $("enNota").textContent = s.nota || "";
  $("enNota").hidden = !s.nota;
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
  const mov = tipo === "movilidad";
  ent.campos = dist ? (n0(s.distancia) > 0 ? ["m", "t"] : ["t", "m"]) : !mov && (n0(s.tiempo) > 0 || s.max_tiempo) && !(n0(s.reps) > 0) ? ["kg", "s"] : mov ? (n0(s.reps) > 0 || !(n0(s.tiempo) > 0) ? ["reps", "s"] : ["s", "reps"]) : ["kg", "reps"];
  const etiqueta = { kg: "Peso (kg)", reps: "Repeticiones" + (s.por_lado ? " por lado" : ""), m: enKm() ? "Kilómetros" : "Metros", t: "Tiempo", s: "Tiempo" + (s.por_lado ? " por lado" : "") + " (45 = segundos)" };
  const valor = c => c === "kg" ? (kg ? num(kg) : "") : c === "reps" ? ((s.ciclo_id === "auto" || esRango(s)) && !hecha(s) ? "" : n0(s.reps) || "")
    : c === "m" ? distCampo(s.distancia) : c === "s" ? (n0(s.tiempo) > 0 ? (n0(s.tiempo) < 60 ? String(n0(s.tiempo)) : fmtTiempo(s.tiempo)) : "") : n0(s.tiempo) ? fmtTiempo(s.tiempo) : "";
  [["enA", "enEtA"], ["enB", "enEtB"]].forEach(([inp, et], k) => {
    const c = ent.campos[k];
    $(et).textContent = etiqueta[c] + ((dist || mov) && k === 1 ? " (opcional)" : "");
    $(inp).value = valor(c);
    $(inp).inputMode = c === "reps" ? "numeric" : "decimal";
    // En carrera, el ejemplo del tiempo es el objetivo de la serie (si lo hay), no un número cualquiera
    const obj = c === "t" && !hecha(s) ? objetivoSerie(s) : null;
    const esMaxE = !hecha(s) && !(n0(s.reps) > 0) && !(n0(s.tiempo) > 0);
    $(inp).placeholder = c === "reps" && esRango(s) && !hecha(s) ? rangoTxt(s) + ": ¿cuántas?" : c === "reps" && (s.ciclo_id || esMaxE) ? "máx: ¿cuántas?" : c === "s" ? (esMaxE ? "máx: ¿cuántos s?" : "45") : c === "t" ? (obj && obj.tiempo ? "obj. " + fmtTiempo(obj.tiempo) : "3:40") : "";
  });
  $("enHecha").textContent = hecha(s) ? "Guardar cambios" : "✓ Hecha";
  $("enDesmarcar").hidden = !hecha(s);
  $("enAviso").textContent = "";
  $("enAnt").disabled = ent.i === 0;
  $("enSig").disabled = ent.i >= lista.length - 1;
}
function siguientePendiente() {
  const n = ent.cola.length;
  const sig = Array.from({ length: n }, (_, k) => (ent.i + 1 + k) % n).find(k => !hecha(db.series[ent.cola[k]]));
  if (sig === undefined) {
    $("enFin").hidden = false;
    $("enTotal").textContent = lineasTotal(ent.cola.map(id => db.series[id]).filter(Boolean)).map(l => l.texto + (l.detalle ? " · " + l.detalle : "")).join("\n");
  } else ent.i = sig;
  pintarEntreno();
}
$("enHecha").addEventListener("click", () => {
  const s = serieEnt();
  if (!s) return;
  // El entrenamiento no activa audio: conserva la música de otras aplicaciones.
  const a = $("enA"), b = $("enB"), aviso = t => { $("enAviso").textContent = t; };
  const fila = { ...s, hecha: true };
  if (tipoDe(s.ejercicio_id) === "fuerza" && esMaxSinDato(s) && !s.max_tiempo) fila.max_reps = true;   // «máx reps» de antes, sin marca
  if (ent.campos[0] === "kg" && ent.campos[1] === "reps") {
    const kg = parseFloat((a.value.trim() || "0").replace(",", ".")), reps = parseInt(b.value, 10);
    if (!(kg >= 0)) { aviso("Revisa el peso."); a.focus(); return; }
    if (!(reps > 0)) { aviso("Pon las repeticiones que has hecho."); b.focus(); return; }
    fila.peso = kg; fila.reps = reps;
    if (s.ciclo_id === "auto") { const c = cicloActivo(s.ejercicio_id); fila.ciclo_id = c ? c.id : ""; }
  } else if (ent.campos.includes("s")) {
    const v = {}; v[ent.campos[0]] = a.value; v[ent.campos[1]] = b.value;
    if (ent.campos[0] === "kg") { const kg = parseFloat((v.kg.trim() || "0").replace(",", ".")); if (!(kg >= 0)) { aviso("Revisa el peso."); a.focus(); return; } fila.peso = kg; }
    fila.reps = parseInt(v.reps, 10) || 0;
    fila.tiempo = leerSegs(v.s);
    if (isNaN(fila.tiempo)) { aviso("Revisa el tiempo (por ejemplo 45 o 1,30)."); return; }
    if (!(fila.reps > 0) && !(fila.tiempo > 0)) { aviso("Pon las repeticiones o el tiempo."); return; }
  } else {
    const v = {}; v[ent.campos[0]] = a.value; v[ent.campos[1]] = b.value;
    fila.distancia = leerDist(v.m);
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
function finDescanso() {
  clearInterval(ent.timer);
  ent.timer = null;
  $("enDescanso").classList.add("fin");
  $("enDescTit").textContent = "¡A por la siguiente!";
  // Aviso visual y vibración, sin pitido que interrumpa la música.
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
// Abre el mismo visor de la ficha sin cerrar ni repintar el entrenamiento.
$("enVideo").addEventListener("click", () => {
  const s = serieEnt(), e = s && ejercicioVivo(s.ejercicio_id);
  if ($("dlgEntreno").open && e && idYoutube(e.video_url)) verVideo(e);
});
$("enAnt").addEventListener("click", () => { if (ent.i > 0) { ent.i--; pintarEntreno(); } });
$("enDesmarcar").addEventListener("click", () => { const s = serieEnt(); if (!s || !hecha(s)) return; $("enFin").hidden = true; desmarcar(s); pintarEntreno(); });
$("enCalentSi").addEventListener("click", () => {
  const s = serieEnt();
  if (!s || !ent.calent) return;
  const delEj = seriesDelDia(ent.dia.id).filter(x => x.ejercicio_id === s.ejercicio_id && !x.bloque_id && (x.grupo || "") === (s.grupo || ""));
  const nuevas = aceptarCalent(ent.dia.id, s.ejercicio_id, s.grupo, delEj, ent.calent);
  ent.cola = colaEntreno(ent.dia.id, ent.grupo);
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
// VERSION_APP es interna (sube en cada publicación para que los móviles se actualicen); la que se ve es siempre la 26
const VERSION_APP = "v238" + (BETA ? " beta" : "");
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
    const enviadas = sugPend.slice(), ids = new Set(enviadas.map(x => x.id));
    const filas = enviadas.map(x => ({ ...x, user_id: sesion.user_id, email: sesion.email || "" }));
    const r = await api("/rest/v1/sugerencias?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(filas) });
    if (!r.ok) return false;
    sugPend = sugPend.filter(x => !ids.has(x.id));
    escribir("sugerencias-pend-v1", sugPend);
    return true;
  } catch { return false; }
}
// Para el administrador: lista en Plan con leídas y no leídas
async function cargarSugerencias() {
  if (!(perfil && perfil.es_admin)) return;
  try {
    const r = await api("/rest/v1/sugerencias?select=id,email,tipo,texto,version,agente,creado,leida&borrada=is.false&order=creado.desc&limit=200");
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
  if (!sugerencias.length) { cont.appendChild(nota("No hay sugerencias. Cuando alguien envíe una, te llegará también un correo.")); return; }
  const leidas = sugerencias.filter(s => s.leida);
  if (leidas.length) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "enlace sug-borrar-leidas";
    b.textContent = "Borrar las leídas (" + leidas.length + ")";
    b.addEventListener("click", () => abrirMenu("Borrar " + leidas.length + (leidas.length === 1 ? " sugerencia leída" : " sugerencias leídas"), "", [{ texto: "Borrar", peligro: true,
      confirmar: "Pulsa otra vez: se borran " + leidas.length, accion: () => borrarSugerencias(leidas) }]));
    cont.appendChild(b);
  }
  sugerencias.forEach(s => {
    const d = document.createElement("div");
    d.className = "sug" + (s.leida ? " leida" : "");
    d.innerHTML = '<div class="sug-cab"><span class="sug-tipo"></span><span class="sug-de"></span><button type="button" class="nav-btn"></button><button type="button" class="borrar" aria-label="Borrar sugerencia">✕</button></div><p class="sug-texto"></p>';
    d.querySelector(".borrar").addEventListener("click", () => borrarSugerencias([s]));
    d.querySelector(".sug-tipo").textContent = { idea: "Idea", fallo: "Fallo", otro: "Otro" }[s.tipo] || s.tipo;
    d.querySelector(".sug-tipo").classList.add("t-" + s.tipo);
    d.querySelector(".sug-de").textContent = (s.email || "?") + " · " + fechaCorta(iso(new Date(s.creado))) + (s.version ? " · " + s.version : "");
    d.querySelector(".sug-de").title = s.agente || "";
    d.querySelector(".sug-texto").textContent = s.texto;
    const b = d.querySelector(".nav-btn");
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
// Borrado lógico (columna «borrada»), con Deshacer
async function marcarSugerencias(ids, borrada) {
  const r = await api("/rest/v1/sugerencias?id=in.(" + ids.map(encodeURIComponent).join(",") + ")", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ borrada }) });
  if (!r.ok) throw new Error();
}
async function borrarSugerencias(lista) {
  const ids = lista.map(s => s.id);
  try { await marcarSugerencias(ids, true); } catch { setEstado("No se ha podido borrar. Revisa la conexión.", true); return; }
  sugerencias = sugerencias.filter(s => !ids.includes(s.id));
  pintarSugerencias();
  avisoDeshacer(ids.length === 1 ? "Sugerencia borrada" : ids.length + " sugerencias borradas", null);
  // Deshacer propio: vuelven a la lista y al servidor
  $("toastBtn").hidden = false;
  deshacerSug = async () => {
    try { await marcarSugerencias(ids, false); } catch { setEstado("No se ha podido deshacer. Revisa la conexión.", true); return; }
    await cargarSugerencias();
  };
}
let deshacerSug = null;
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
    const altura = p => { const e = p.getElementsByTagName("ele")[0]; return e ? parseFloat(e.textContent) : NaN; };
    const pts = [...trk.getElementsByTagName("trkpt")].map(p => ({ lat: +p.getAttribute("lat"), lon: +p.getAttribute("lon"), t: Date.parse(textoDe(p, "time")), ele: altura(p) }))
      .filter(p => !isNaN(p.lat) && !isNaN(p.lon) && !isNaN(p.t));
    if (pts.length < 2) return null;
    let d = 0;
    pts[0].d = 0;
    for (let i = 1; i < pts.length; i++) { d += distGeo(pts[i - 1], pts[i]); pts[i].d = d; }
    return { inicio: pts[0].t, nombre: textoDe(trk, "name"), deporte: textoDe(trk, "type"), vueltas: [{ distancia: d, tiempo: (pts[pts.length - 1].t - pts[0].t) / 1000, ...(perfilDesnivel(pts) || {}) }] };
  }).filter(Boolean);
}
function leerTCX(doc) {
  return [...doc.getElementsByTagName("Activity")].map(a => {
    const laps = [...a.getElementsByTagName("Lap")];
    const t0 = Date.parse(textoDe(a, "Time")) / 1000;
    const vueltas = laps.map(l => {
      // Altitud y pulsaciones de cada punto de la vuelta (si el reloj las guarda), con su distancia acumulada
      const pts = [...l.getElementsByTagName("Trackpoint")].map(tp => {
        const a = tp.getElementsByTagName("AltitudeMeters")[0], dm = tp.getElementsByTagName("DistanceMeters")[0], hr = tp.getElementsByTagName("HeartRateBpm")[0];
        return { ele: a ? parseFloat(a.textContent) : NaN, d: dm ? parseFloat(dm.textContent) : NaN, t: Date.parse(textoDe(tp, "Time")) / 1000, fc: hr ? parseFloat(textoDe(hr, "Value")) : NaN };
      });
      const pulso = analizarPulso(pts, t0) || {}, fcs = pts.map(x => x.fc).filter(x => x > 0);
      return { distancia: +textoDe(l, "DistanceMeters") || 0, tiempo: +textoDe(l, "TotalTimeSeconds") || 0, ...(perfilDesnivel(pts) || {}), ...pulso,
        fc: Math.round(+textoDe(l, "AverageHeartRateBpm").replace(/\D/g, "") || (fcs.length ? fcs.reduce((x, y) => x + y, 0) / fcs.length : 0)), fcMax: +textoDe(l, "MaximumHeartRateBpm").replace(/\D/g, "") || (fcs.length ? Math.max(...fcs) : 0) };
    });
    if (!vueltas.length) return null;
    return { inicio: Date.parse(textoDe(a, "Id") || laps[0].getAttribute("StartTime")), nombre: textoDe(a, "Notes"), deporte: a.getAttribute("Sport") || "", vueltas };
  }).filter(Boolean);
}
// ---------- Archivos FIT (COROS, Garmin…): decodificador binario propio, sin servidor ni librerías ----------
// Solo se leen los mensajes que hacen falta: session (18), lap (19), record (20), workout (26) y workout_step (27)
const FIT_EPOCA = 631065600;   // 31-12-1989 en segundos Unix
function decodificarFIT(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  const cab = u8[0];
  if (buf.byteLength < 14 || String.fromCharCode(u8[8], u8[9], u8[10], u8[11]) !== ".FIT") throw new Error("no es un archivo FIT");
  const fin = Math.min(buf.byteLength, cab + dv.getUint32(4, true));
  const defs = {}, out = { 18: [], 19: [], 20: [], 26: [], 27: [] };
  const TAM = { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 4, 6: 4, 7: 1, 8: 4, 9: 8, 10: 1, 11: 2, 12: 4, 13: 1, 14: 8, 15: 8, 16: 8 };
  let pos = cab, ultimoTs = 0;
  const leerValor = (bt, off, tam, le) => {
    const t = bt & 0x1f;
    if (t === 7) { let x = ""; for (let i = 0; i < tam && u8[off + i]; i++) x += String.fromCharCode(u8[off + i]); try { return decodeURIComponent(escape(x)); } catch { return x; } }
    if (tam < (TAM[t] || 1)) return null;
    let v;
    switch (t) {
      case 0: case 2: case 10: case 13: v = u8[off]; return (t === 10 ? v === 0 : v === 0xff) ? null : v;
      case 1: v = dv.getInt8(off); return v === 0x7f ? null : v;
      case 3: v = dv.getInt16(off, le); return v === 0x7fff ? null : v;
      case 4: case 11: v = dv.getUint16(off, le); return (t === 11 ? v === 0 : v === 0xffff) ? null : v;
      case 5: v = dv.getInt32(off, le); return v === 0x7fffffff ? null : v;
      case 6: case 12: v = dv.getUint32(off, le); return (t === 12 ? v === 0 : v === 0xffffffff) ? null : v;
      case 8: v = dv.getFloat32(off, le); return isFinite(v) ? v : null;
      case 9: v = dv.getFloat64(off, le); return isFinite(v) ? v : null;
      default: return null;
    }
  };
  while (pos < fin) {
    const h = u8[pos++];
    if (!(h & 0x80) && (h & 0x40)) {
      // Definición: qué campos trae cada tipo de mensaje local
      const le = u8[pos + 1] === 0, global = le ? dv.getUint16(pos + 2, true) : dv.getUint16(pos + 2, false), n = u8[pos + 4];
      pos += 5;
      const campos = [];
      for (let i = 0; i < n; i++, pos += 3) campos.push({ num: u8[pos], tam: u8[pos + 1], bt: u8[pos + 2] });
      let extra = 0;
      if (h & 0x20) { const nd = u8[pos++]; for (let i = 0; i < nd; i++, pos += 3) extra += u8[pos + 1]; }   // campos de desarrollador: se saltan
      defs[h & 0x0f] = { le, global, campos, extra };
      continue;
    }
    const local = h & 0x80 ? (h >> 5) & 3 : h & 0x0f, d = defs[local];
    if (!d) throw new Error("archivo FIT dañado");
    const m = {};
    d.campos.forEach(c => { if (out[d.global]) m[c.num] = leerValor(c.bt, pos, c.tam, d.le); pos += c.tam; });
    pos += d.extra;
    if (h & 0x80) {   // cabecera con la hora comprimida (5 bits de desfase)
      const off = h & 0x1f;
      ultimoTs = (ultimoTs & ~0x1f) + off + (off < (ultimoTs & 0x1f) ? 0x20 : 0);
      m[253] = ultimoTs;
    } else if (m[253] != null) ultimoTs = m[253];
    if (out[d.global]) out[d.global].push(m);
  }
  return out;
}
const INTENSIDAD_FIT = { 0: "serie", 1: "parado", 2: "calent", 3: "calma", 4: "rec", 5: "serie" };
const DEPORTE_FIT = { 1: "running", 2: "cycling", 5: "swimming", 11: "walking", 17: "hiking" };
function leerFIT(buf) {
  const f = decodificarFIT(buf), ses = f[18][0] || {};
  const recs = f[20].filter(r => r[253] != null).map(r => ({
    t: r[253], d: r[5] != null ? r[5] / 100 : NaN,
    ele: r[78] != null ? r[78] / 5 - 500 : r[2] != null ? r[2] / 5 - 500 : NaN,   // altitud del barómetro si la hay
    fc: r[3], cad: r[4]
  }));
  const laps = f[19].length ? f[19] : [{ 2: ses[2], 253: ses[253], 7: ses[7], 8: ses[8], 9: ses[9], 15: ses[16], 16: ses[17], 17: ses[18], 21: ses[22], 22: ses[23] }];
  // Objetivos del entrenamiento programado (ritmo entre dos velocidades, en m/s × 1000)
  const pasos = f[27].map(p => ({ i: p[254], nombre: p[0] || "", lo: p[5], hi: p[6], tipo: p[3] }));
  const objetivoPaso = i => {
    const p = pasos.find(x => x.i === i);
    if (!p || p.tipo !== 0 || !(p.lo > 0) || !(p.hi > 0)) return "";
    return "obj. " + fmtTiempo(1e6 / p.hi) + "–" + fmtTiempo(1e6 / p.lo) + "/km";
  };
  const vueltas = laps.map(l => {
    const ini = l[2] != null ? l[2] : null, fin = l[253];
    const tramo = ini != null && fin != null ? recs.filter(r => r.t >= ini && r.t <= fin) : [];
    const perfil = perfilDesnivel(tramo);
    const v = { distancia: (l[9] || 0) / 100, tiempo: (l[8] != null ? l[8] : l[7] || 0) / 1000, intensidad: l[23] };
    if (perfil) Object.assign(v, perfil);
    else if (l[21] != null || l[22] != null) { v.subida = l[21] || 0; v.bajada = l[22] || 0; v.factor = factorVuelta(v.distancia, v.subida, v.bajada); }
    // Pulsaciones y cadencia: las de la vuelta o, si faltan, la media de sus puntos
    const fcs = tramo.map(r => r.fc).filter(x => x > 0), cads = tramo.map(r => r.cad).filter(x => x > 0);
    v.fc = l[15] || (fcs.length ? Math.round(fcs.reduce((a, b) => a + b, 0) / fcs.length) : 0);
    v.fcMax = l[16] || (fcs.length ? Math.max(...fcs) : 0);
    const cad = l[17] || (cads.length ? cads.reduce((a, b) => a + b, 0) / cads.length : 0);
    v.cad = cad ? Math.round(cad * 2) : 0;   // el FIT guarda zancadas por minuto (un pie); se muestran pasos
    v.objetivo = objetivoPaso(l[71]);
    Object.assign(v, analizarPulso(tramo.map(x => ({ t: x.t, fc: x.fc })), recs.length ? recs[0].t : 0) || {});
    return v;
  }).filter(v => v.tiempo > 0);
  const inicio = (ses[2] != null ? ses[2] : recs.length ? recs[0].t : laps[0][2]) ;
  const nombre = (f[26][0] && f[26][0][8]) || "";
  return vueltas.length ? [{ inicio: (inicio + FIT_EPOCA) * 1000, nombre, deporte: DEPORTE_FIT[ses[5]] || "", vueltas, fit: true }] : [];
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
function leerCSVActividades(texto, archivo) {
  const filas = filasCSV(texto);
  if (filas.length < 2) return [];
  const cab = filas[0].map(h => norm(h)), col = (...n) => cab.findIndex(h => n.includes(h));
  const vueltasCSV = leerCSVVueltas(filas, cab, col, archivo);
  if (vueltasCSV) return vueltasCSV;
  const iF = col("activity date", "date", "fecha", "fecha de la actividad", "start time", "hora de inicio"), iT = col("activity type", "tipo de actividad", "type", "tipo");
  const iD = col("distance", "distancia"), iM = col("moving time", "tiempo en movimiento"), iE = col("elapsed time", "tiempo transcurrido", "time", "tiempo");
  const iN = col("activity name", "title", "titulo", "nombre de la actividad", "nombre");
  const iS = col("elevation gain", "ascenso total", "desnivel positivo"), iB = col("elevation loss", "descenso total", "desnivel negativo");
  if (iF < 0 || iD < 0 || (iM < 0 && iE < 0)) throw new Error("No reconozco las columnas del CSV (hacen falta fecha, distancia y tiempo).");
  return filas.slice(1).map(f => {
    const tt = String((iM >= 0 && f[iM]) || (iE >= 0 && f[iE]) || "").trim(), tiempo = /:/.test(tt) ? leerTiempo(tt.replace(/\.\d+$/, "")) : parseFloat(tt.replace(",", "."));
    let d = parseFloat(String(f[iD] || "").replace(/\s/g, "").replace(",", "."));
    if (d > 0 && d < 300) d *= 1000;   // en km
    const v = { distancia: d || 0, tiempo: tiempo || 0 };
    if (iS >= 0 && parseFloat(f[iS]) >= 0) {
      // Si solo trae la subida, la bajada se toma igual (casi todas las carreras vuelven al punto de salida)
      v.subida = parseFloat(f[iS]) || 0;
      v.bajada = iB >= 0 && parseFloat(f[iB]) >= 0 ? parseFloat(f[iB]) : v.subida;
      v.factor = factorVuelta(v.distancia, v.subida, v.bajada);
    }
    return { inicio: leerFechaCSV(f[iF]), nombre: iN >= 0 ? (f[iN] || "").trim() : "", deporte: iT >= 0 ? f[iT] || "" : "", vueltas: [v] };
  }).filter(a => !isNaN(a.inicio) && a.vueltas[0].distancia > 0 && a.vueltas[0].tiempo > 0);
}
// CSV de las vueltas de UNA actividad (app de COROS: «Split», «Time», «Moving Time», «GetDistance», «Elevation Gain»…): no trae la fecha,
// así que sale del nombre del archivo (…20261103185611.csv) o de su fecha, y se puede corregir en la vista previa
function leerCSVVueltas(filas, cab, col, archivo) {
  const iV = col("split", "splits", "lap", "laps", "vuelta", "vueltas", "intervalo", "interval");
  const iD = col("getdistance", "distance", "distancia"), iM = col("moving time", "tiempo en movimiento"), iE = col("time", "tiempo", "elapsed time", "tiempo transcurrido");
  if (iV < 0 || iD < 0 || (iM < 0 && iE < 0) || col("activity date", "date", "fecha", "start time", "hora de inicio") >= 0) return null;
  const iS = col("elevation gain", "elev gain", "ascenso", "ascenso total", "desnivel positivo", "ganancia de altura"), iB = col("elev loss", "elevation loss", "descenso", "descenso total", "desnivel negativo");
  const seg = t => { const x = String(t || "").trim().replace(/\.\d+$/, ""); return /:/.test(x) ? leerTiempo(x) : parseFloat(x.replace(",", ".")) || 0; };
  const vueltas = filas.slice(1).filter(f => f.length > iD && !/^(summary|resumen|total)/.test(norm(f[iV] || ""))).map(f => {
    let d = parseFloat(String(f[iD] || "").replace(/\s/g, "").replace(",", "."));
    if (d > 0 && d < 300) d *= 1000;   // en km
    // Con tiempo en movimiento, ese (una pausa larga con el reloj en marcha no cuenta como ritmo)
    const v = { distancia: d || 0, tiempo: (iM >= 0 && seg(f[iM])) || seg(f[iE]) };
    if (iS >= 0) v.subida = parseFloat(f[iS]) || 0;
    if (iB >= 0) v.bajada = parseFloat(f[iB]) || 0;
    if (iS >= 0 || iB >= 0) v.factor = factorVuelta(v.distancia, v.subida || 0, v.bajada || 0);
    return v;
  }).filter(v => v.tiempo > 0);
  if (!vueltas.length) return [];
  const nombre = (archivo && archivo.name) || "", m = nombre.match(/(20\d{2})(\d{2})(\d{2})(\d{2})?(\d{2})?/);
  const inicio = m ? new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0)).getTime() : (archivo && archivo.lastModified) || Date.now();
  const titulo = nombre.replace(/\.[a-z]+$/i, "").replace(/[\d_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return [{ inicio, nombre: titulo, deporte: "", vueltas, fechaDudosa: true }];
}
// Clasifica las vueltas: las rápidas son series; más lentas que el límite, recuperación; sin avanzar, descanso parado;
// las lentas y largas del principio y del final, calentamiento y vuelta a la calma
function clasificarVueltas(vueltas) {
  const lim = ritmoRecImport();
  const v = vueltas.map(x => ({ ...x, ritmo: x.distancia > 0 ? x.tiempo / (x.distancia / 1000) : Infinity }));
  // FIT: el reloj ya dice qué es cada vuelta (activa, descanso, calentamiento, vuelta a la calma, recuperación); sin adivinar por el ritmo
  if (v.some(x => x.intensidad != null && x.intensidad !== 0 && INTENSIDAD_FIT[x.intensidad])) {
    v.forEach(x => { x.clase = x.distancia < 50 && x.intensidad === 0 ? "parado" : INTENSIDAD_FIT[x.intensidad] || "serie"; });
    return { continuo: !v.some(x => x.clase !== "serie") || v.filter(x => x.clase === "serie").length < 2, vueltas: v, delReloj: true };
  }
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
      const nombre = f.name.toLowerCase();
      if (/\.fit$/.test(nombre)) {
        const acts = leerFIT(await f.arrayBuffer());
        if (!acts.length) throw new Error("no tiene ninguna vuelta con tiempo");
        nuevas.push(...acts.map(prepararActividad));
        continue;
      }
      const texto = await f.text();
      let acts;
      if (/\.csv$/.test(nombre) || !/^\s*</.test(texto)) acts = leerCSVActividades(texto, f);
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
    if (a.fechaDudosa) {
      const fl = document.createElement("label");
      fl.className = "imp-fecha";
      fl.innerHTML = 'Fecha de la carrera <input type="date">';
      const fi = fl.querySelector("input");
      fi.value = a.fecha;
      fl.title = "El CSV de vueltas no trae la fecha: sale del nombre del archivo. Corrígela si no es esa.";
      fi.addEventListener("change", () => {
        if (!fi.value) return;
        const d = new Date(a.inicio), n = deIso(fi.value);
        n.setHours(d.getHours(), d.getMinutes());
        importadas[k] = prepararActividad({ inicio: n.getTime(), nombre: a.nombre, deporte: a.deporte, fechaDudosa: true, vueltas: a.vueltas.map(v => ({ ...v })) });
        pintarImportar();
      });
      caja.appendChild(fl);
      caja.appendChild(nota("Este CSV no trae la fecha: sale del nombre del archivo. Corrígela si no es esa."));
    }
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
        // Casilla para agrupar a mano las series en un bloque
        if (v.clase === "serie" && v.grupoManual == null) {
          const chk = document.createElement("input");
          chk.type = "checkbox"; chk.className = "imp-marca"; chk.checked = !!v.marcada;
          chk.setAttribute("aria-label", "Elegir la vuelta " + (i + 1) + " para agruparla");
          chk.addEventListener("change", () => { v.marcada = chk.checked; pintarImportar(); });
          fila.querySelector(".imp-n").prepend(chk);
        } else if (v.grupoManual != null) fila.querySelector(".imp-n").textContent = "▣ " + (i + 1);
        const aj = v.factor && v.distancia >= 50 && isFinite(v.ritmo) ? v.ritmo / v.factor : 0;
        fila.querySelector(".imp-d").textContent = fmtDist(v.distancia) + " · " + fmtTiempo(v.tiempo) + (isFinite(v.ritmo) && v.distancia >= 50 ? " · " + fmtTiempo(v.ritmo) + "/km" : "") +
          (aj && Math.abs(aj - v.ritmo) >= 1 ? " (aj. " + fmtTiempo(aj) + ")" : "") + (n0(v.subida) + n0(v.bajada) > 0 ? " · +" + Math.round(n0(v.subida)) + " m / −" + Math.round(n0(v.bajada)) + " m" : "") +
          (v.fc ? " · ♥ " + v.fc + (v.fcMax ? "/" + v.fcMax : "") : "") + (v.cad ? " · " + v.cad + " ppm" : "") + (v.objetivo ? " · " + v.objetivo : "");
        const sel = fila.querySelector("select");
        Object.keys(CLASES_VUELTA).forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = CLASES_VUELTA[c]; sel.appendChild(o); });
        sel.value = v.clase;
        sel.setAttribute("aria-label", "Vuelta " + (i + 1));
        sel.addEventListener("change", () => { v.clase = sel.value; a.bloque = a.bloque && patronSeries(a.vueltas).regular; pintarImportar(); });
        tabla.appendChild(fila);
      });
      caja.appendChild(tabla);
      // Agrupar a mano: las vueltas marcadas forman un bloque ×N (N según el patrón de distancias que se repite)
      const marcadas = a.vueltas.filter(v => v.marcada && v.clase === "serie" && v.grupoManual == null);
      const grupos = [...new Set(a.vueltas.filter(v => v.grupoManual != null).map(v => v.grupoManual))];
      if (marcadas.length >= 2 || grupos.length) {
        const bot = document.createElement("div");
        bot.className = "botonera imp-agrupar";
        if (marcadas.length >= 2) {
          const n = marcadas.length / periodoRepetido(marcadas.map(v => Math.round(v.distancia / 50)));
          const b = document.createElement("button");
          b.type = "button"; b.className = "anadir";
          b.textContent = "Agrupar las " + marcadas.length + " marcadas en bloque ×" + n;
          b.addEventListener("click", () => { const g = (a.siguienteGrupo = (a.siguienteGrupo || 0) + 1); marcadas.forEach(v => { v.grupoManual = g; v.marcada = false; }); a.bloque = false; pintarImportar(); });
          bot.appendChild(b);
        }
        if (grupos.length) {
          const q = document.createElement("button");
          q.type = "button"; q.className = "nav-btn";
          q.textContent = "Quitar agrupación" + (grupos.length > 1 ? "es (" + grupos.length + ")" : "");
          q.addEventListener("click", () => { a.vueltas.forEach(v => { delete v.grupoManual; }); pintarImportar(); });
          bot.appendChild(q);
        }
        caja.appendChild(bot);
      }
      if (grupos.length) caja.appendChild(nota("Las vueltas con ▣ se guardarán como " + (grupos.length === 1 ? "un bloque" : grupos.length + " bloques") + " (×N según cuántas veces se repite su patrón)."));
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
  // Desnivel y ritmo ajustado por pendiente, solo si el archivo traía altitud
  const conAltura = a.vueltas.some(v => v.factor);
  // Pulsaciones y cadencia (FIT): media ponderada por tiempo y máxima
  const pulso = vs => {
    const conFc = vs.filter(v => v.fc > 0), t = conFc.reduce((x, v) => x + v.tiempo, 0), tc = vs.filter(v => v.cad > 0).reduce((x, v) => x + v.tiempo, 0);
    return {
      fc_media: t > 0 ? Math.round(conFc.reduce((x, v) => x + v.fc * v.tiempo, 0) / t) : 0,
      fc_max: Math.max(0, ...vs.map(v => n0(v.fcMax))),
      cadencia: tc > 0 ? Math.round(vs.filter(v => v.cad > 0).reduce((x, v) => x + v.cad * v.tiempo, 0) / tc) : 0,
      fc_pico: Math.max(0, ...vs.map(v => n0(v.fcPico))),
      fc_hist: vs.some(v => v.fcHist) ? sumaHist(vs.map(v => v.fcHist)) : []
    };
  };
  const desnivel = (vs, d, t) => {
    if (!conAltura || !(d > 0) || !(t > 0)) return {};
    const eq = vs.reduce((x, v) => x + v.distancia * (v.factor || 1), 0), dv = vs.reduce((x, v) => x + v.distancia, 0);
    return { desnivel_pos: Math.round(vs.reduce((x, v) => x + n0(v.subida), 0)), desnivel_neg: Math.round(vs.reduce((x, v) => x + n0(v.bajada), 0)), ritmo_ajustado: eq > 0 ? Math.round(t / (d * eq / dv / 1000)) : 0 };
  };
  if (a.modo === "rodaje") fila(idPorNombre("Rodaje", "carrera"), { distancia: Math.round(a.total.d), tiempo: Math.round(a.total.t), ...desnivel(a.vueltas, a.total.d, a.total.t), ...pulso(a.vueltas) });
  else {
    const p = patronSeries(a.vueltas), idSerie = idPorNombre(p.nombre, "carrera"), bloque = a.bloque && p.regular ? nuevoId() : "";
    // Bloques hechos a mano en la vista previa: su ×N sale del patrón de distancias que se repite
    const manual = {};
    [...new Set(a.vueltas.filter(v => v.grupoManual != null && v.clase === "serie").map(v => v.grupoManual))].forEach(g => {
      const vs = a.vueltas.filter(v => v.grupoManual === g && v.clase === "serie");
      manual[g] = { id: nuevoId(), p: periodoRepetido(vs.map(v => Math.round(v.distancia / 50))), k: 0 };
    });
    let ultima = null, ronda = 0;
    a.vueltas.forEach(v => {
      const d = Math.round(v.distancia), t = Math.round(v.tiempo), m = v.clase === "serie" && manual[v.grupoManual];
      const enBloque = m ? { bloque_id: m.id, ronda: Math.floor(m.k++ / m.p) + 1 } : { bloque_id: bloque, ronda: bloque ? ++ronda : 0 };
      if (v.clase === "serie") ultima = fila(idSerie, { distancia: d, tiempo: t, ...enBloque, ...desnivel([v], d, t), ...pulso([v]) });
      else if ((v.clase === "rec" || v.clase === "parado") && ultima) { ultima.descanso += t; if (v.clase === "rec") ultima.rec_dist += d; if (v.fcHist) ultima.fc_hist = sumaHist([ultima.fc_hist, v.fcHist]); }
      else if (v.clase === "calent" || v.clase === "calma") { fila(idPorNombre(v.clase === "calent" ? "Calentamiento carrera" : "Vuelta a la calma", "carrera"), { distancia: d, tiempo: t, calentamiento: true, ...desnivel([v], d, t), ...pulso([v]) }); ultima = null; }
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
$("selSerAgrupar").addEventListener("click", agruparSeleccion);
$("selSerSalir").addEventListener("click", salirSelSeries);
// Ajuste: las series con mucho desnivel cuentan o no para las marcas por distancia
$("ajDesnivel").value = ajustes().desnivelMarcas === "contar" ? "contar" : "excluir";
$("ajDesnivel").addEventListener("change", () => {
  const a = leer("ajustes-v1") || {};
  if ($("ajDesnivel").value === "contar") a.desnivelMarcas = "contar"; else delete a.desnivelMarcas;
  escribir("ajustes-v1", a);
  versionDatos++;   // las marcas y los récords se recalculan
  setEstado("Ajuste guardado en este dispositivo");
});
// Ajuste: FC máxima (si no se pone, la mayor registrada en los archivos FIT del último año)
$("ajFcMax").value = n0(ajustes().fcMax) || "";
function pintarInfoFc() {
  const i = infoFcMax(), o = opcionesFcMax(), a = ajustes();
  $("ajFcModo").value = a.fcModo || (n0(a.fcMax) > 0 ? "manual" : "auto");
  $("ajFcMaxL").hidden = $("ajFcModo").value !== "manual";
  $("ajFcMax").placeholder = "p. ej. " + (o.auto ? o.auto.valor : o.edad || 190);
  $("ajFcInfo").textContent = (i ? "Se usa: " + i.valor + " ppm (" + i.fuente + ")" + (i.superada ? " · ojo: has llegado a " + i.superada.valor + " ppm" : "") + ". " : "Sin datos de pulso todavía: importa un FIT o TCX, o pon tu edad. ") +
    "Automática: " + (o.auto ? o.auto.valor + " ppm (" + o.auto.fuente + ")" : "sin archivos con pulso") + " · Por edad: " + (o.edad ? o.edad + " ppm" : "pon tu edad") + " · A mano: " + (o.manual ? o.manual + " ppm" : "—") + ".";
}
$("ajFcModo").addEventListener("change", () => {
  const a = leer("ajustes-v1") || {};
  a.fcModo = $("ajFcModo").value;
  escribir("ajustes-v1", a);
  versionDatos++; pintarInfoFc();
  if (a.fcModo === "manual" && !n0(a.fcMax)) $("ajFcMax").focus();
  if (a.fcModo === "edad" && !n0(a.edad)) $("ajEdad").focus();
  setEstado("Ajuste guardado en este dispositivo");
});
[["ajEdad", "edad", 10, 99], ["ajFcReposo", "fcReposo", 30, 100]].forEach(([id, k, lo, hi]) => {
  $(id).value = n0(ajustes()[k]) || "";
  $(id).addEventListener("change", () => {
    const a = leer("ajustes-v1") || {}, v = parseInt($(id).value, 10);
    if (v >= lo && v <= hi) a[k] = v; else delete a[k];
    escribir("ajustes-v1", a);
    $(id).value = a[k] || "";
    versionDatos++; pintarInfoFc();
    setEstado("Ajuste guardado en este dispositivo");
  });
});
pintarInfoFc();
$("ajFcMax").addEventListener("change", () => {
  const a = leer("ajustes-v1") || {}, v = parseInt($("ajFcMax").value, 10);
  if (v >= 120 && v <= 230) a.fcMax = v; else delete a.fcMax;
  escribir("ajustes-v1", a);
  $("ajFcMax").value = a.fcMax || "";
  versionDatos++; pintarInfoFc();
  setEstado("Ajuste guardado en este dispositivo");
});
// Ajuste: unidad de las distancias
$("ajUnidad").value = UNIDAD;
$("ajUnidad").addEventListener("change", () => {
  const a = leer("ajustes-v1") || {};
  UNIDAD = $("ajUnidad").value;
  if (UNIDAD === "auto") delete a.unidad; else a.unidad = UNIDAD;
  escribir("ajustes-v1", a);
  pintarTodo();
  setEstado("Ajuste guardado en este dispositivo");
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

// ---------- Selección múltiple de plantillas ----------
let selPlant = null, pulsacionLarga = false;
// Mantener pulsado medio segundo sin mover el dedo entra en modo selección
function mantenerPulsado(el, accion) {
  let timer = null, x = 0, y = 0;
  const parar = () => { clearTimeout(timer); timer = null; };
  el.addEventListener("pointerdown", e => { if (e.button > 0) return; x = e.clientX; y = e.clientY; parar(); timer = setTimeout(() => { timer = null; pulsacionLarga = true; if (navigator.vibrate) navigator.vibrate(15); accion(); }, 500); });
  el.addEventListener("pointermove", e => { if (timer && Math.hypot(e.clientX - x, e.clientY - y) > 10) parar(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => el.addEventListener(ev, parar));
  el.addEventListener("contextmenu", e => { if (pulsacionLarga) e.preventDefault(); });
}
function marcarPlant(id) {
  if (selPlant.has(id)) selPlant.delete(id); else selPlant.add(id);
  pintarPlan();
}
function salirSeleccion() { selPlant = null; pulsacionLarga = false; pintarPlan(); }
function pintarSeleccion(visibles) {
  const n = selPlant ? selPlant.size : 0;
  document.body.classList.toggle("seleccionando", !!selPlant);
  $("selPlantBarra").hidden = !selPlant;
  $("selPlantAcciones").hidden = !selPlant;
  $("selPlantEntrar").hidden = !!selPlant || !vivos("plantillas").length;
  if (!selPlant) return;
  $("selPlantN").textContent = n === 1 ? "1 seleccionada" : n + " seleccionadas";
  $("selPlantTodas").textContent = visibles.length && visibles.every(p => selPlant.has(p.id)) ? "Quitar todas" : "Seleccionar todas";
  $("selPlantTodas").onclick = () => { const todas = visibles.every(p => selPlant.has(p.id)); visibles.forEach(p => todas ? selPlant.delete(p.id) : selPlant.add(p.id)); pintarPlan(); };
  $("selPlantAcciones").querySelectorAll("button").forEach(b => { b.disabled = !n; });
}
const plantillasSel = () => [...(selPlant || [])].map(id => db.plantillas[id]).filter(p => p && !p.borrado).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
$("selPlantEntrar").addEventListener("click", () => { selPlant = new Set(); pintarPlan(); });
$("selPlantCancelar").addEventListener("click", salirSeleccion);
// Añadir todas a un día de la semana (cada una como su propia sesión)
$("selPlantDia").addEventListener("click", () => {
  const ps = plantillasSel();
  abrirMenu("Añadir " + ps.length + " plantillas", ps.map(p => p.nombre).join(", "), dias.map(d => ({ texto: NOMBRES[d.i] + " " + fmt(deIso(d.id)), accion: () => {
    ps.forEach(p => pegarItems(d.id, p.items || [], p.nombre));
    persistir();
    salirSeleccion();
    abrirDia(d.id);
    setEstado(ps.length + " plantillas añadidas al " + NOMBRES[d.i]);
  } })));
});
// Mesociclo: crear uno nuevo repartiéndolas por la semana, o añadirlas a un día de uno existente
const REPARTO = [0, 2, 4, 1, 3, 5, 6];
$("selPlantMeso").addEventListener("click", () => {
  const ps = plantillasSel();
  const nuevo = { texto: "Crear un mesociclo nuevo con ellas", accion: () => {
    const id = nuevoId(), d = {};
    ps.forEach((p, k) => { const dia = REPARTO[k % 7]; (d[dia] = d[dia] || []).push(p.id); });
    cambiar("mesociclos", { id, nombre: "Mesociclo nuevo", inicio: lunesSiguiente(), semanas: 4, dias: d, progresion: 0, descarga: {}, notas: "", borrado: false });
    salirSeleccion();
    abrirMeso(id);
    setEstado("Repartidas por la semana: ajusta los días, el nombre y las semanas, y pulsa «Guardar y rellenar calendario».");
  } };
  const existentes = vivos("mesociclos").sort((a, b) => (b.inicio || "").localeCompare(a.inicio || "")).map(m => ({ texto: "Añadir a «" + m.nombre + "»…", accion: () => {
    abrirMenu("¿Qué día de «" + m.nombre + "»?", "Se añaden las " + ps.length + " plantillas a ese día de cada semana.", NOMBRES.map((nom, i) => ({ texto: nom, accion: () => {
      const dias2 = JSON.parse(JSON.stringify(m.dias || {}));
      dias2[i] = (dias2[i] || []).concat(ps.map(p => p.id));
      cambiar("mesociclos", { ...m, dias: dias2 });
      salirSeleccion();
      abrirMeso(m.id);
    } })));
  } }));
  abrirMenu("Mesociclo con " + ps.length + " plantillas", "", [nuevo].concat(existentes));
});
// Compartir juntas: un solo enlace o código con todas
$("selPlantCompartir").addEventListener("click", () => {
  const ps = plantillasSel();
  compartir(ps.length === 1 ? ps[0].nombre : ps.length + " plantillas", [{ paquete: true, plantillas: ps.map(p => ({ nombre: p.nombre, items: paraCompartir(p.items || []) })) }], true);
});
// Eliminar: confirmación (es un borrado grande) y Deshacer
$("selPlantBorrar").addEventListener("click", () => {
  const ps = plantillasSel();
  abrirMenu("Eliminar " + ps.length + (ps.length === 1 ? " plantilla" : " plantillas"), ps.map(p => p.nombre).join(", "), [{ texto: "Eliminar", peligro: true, confirmar: "Pulsa otra vez: se eliminan " + ps.length + (ps.length === 1 ? " plantilla" : " plantillas"), accion: () => {
    ps.forEach(p => cambiar("plantillas", { ...p, borrado: true }, true));
    persistir();
    salirSeleccion();
    avisoDeshacer(ps.length + (ps.length === 1 ? " plantilla eliminada" : " plantillas eliminadas"), ps.map(p => ["plantillas", p]));
  } }]);
});
function guardarPaqueteCompartido(c) {
  const x = c.items[0];
  x.plantillas.forEach(p => cambiar("plantillas", { id: nuevoId(), nombre: nombreLibre(p.nombre), items: desdeCompartido(p.items), borrado: false }, true));
  persistir();
  verPestana("plan");
  setEstado(x.plantillas.length + " plantillas guardadas");
}

// ---------- Plan: secciones desplegables con contador; se recuerda cuáles quedan abiertas ----------
let seccionesPlan = {}; // todas las secciones empiezan plegadas en cada apertura
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
  const h = sec.querySelector("h3"), clave = sec.dataset.sec;
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "sec-toggle";
  boton.innerHTML = '<span class="flecha-dia" aria-hidden="true">▸</span>';
  h.before(boton);
  boton.appendChild(h);
  const n = document.createElement("span"); n.className = "sec-n"; boton.appendChild(n);
  // La cabecera es la fila con botones (.sec-cab) o, si el título va solo, el propio botón; lo de después se pliega
  const cab = boton.closest(".sec-cab") || boton;
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
    if (seccionesPlan[clave]) verAlAbrir(sec);
  });
});
const GRUPOS_PLAN = {
  crear: ["importar", "ia", "compartido"],
  entrenos: ["plantillas", "mesociclos", "rutinas"],
  cuenta: ["copia", "ajustes", "ayuda", "sugerencias", "usuarios"]
};
function aplicarGrupoPlan() {
  const grupo = leer("plan-grupo-v1") || "crear", secciones = GRUPOS_PLAN[grupo] || GRUPOS_PLAN.crear;
  document.querySelectorAll("#vistaPlan > .plan-sec[data-sec]").forEach(sec => { sec.hidden = !secciones.includes(sec.dataset.sec); });
}
function mostrarGrupoPlan(grupo) {
  const elegido = GRUPOS_PLAN[grupo] ? grupo : "crear";
  escribir("plan-grupo-v1", elegido);
  aplicarGrupoPlan();
}
function mostrarSubVistaOrganizar(vista) {
  subVistaOrganizar = ["listas", "crear", "entrenos"].includes(vista) ? vista : "listas";
  const esLista = subVistaOrganizar === "listas";
  $("vistaListas").hidden = esLista ? false : true;
  $("vistaPlan").hidden = esLista ? true : false;
  if (!esLista) mostrarGrupoPlan(subVistaOrganizar);
  document.querySelectorAll(".plan-nav-btn[data-organizar]").forEach(b => {
    const activa = b.dataset.organizar === subVistaOrganizar;
    b.classList.toggle("activa", activa);
    b.setAttribute("aria-pressed", String(activa));
  });
  escribir("organizar-vista-v1", subVistaOrganizar);
}
document.querySelectorAll(".plan-nav-btn[data-organizar]").forEach(b => b.addEventListener("click", () => {
  mostrarSubVistaOrganizar(b.dataset.organizar);
  if (b.dataset.organizar === "listas") pintarListas(); else pintarPlan();
}));
mostrarGrupoPlan(leer("plan-grupo-v1") || "crear");
$("buscarPlantilla").addEventListener("input", () => {
  const sec = $("buscarPlantilla").closest(".plan-sec");
  if (sec.classList.contains("cerrada")) { seccionesPlan.plantillas = true; escribir("plan-abiertas-v1", seccionesPlan); ponerSeccion(sec, true); }
  pintarPlan();
});

// ---------- Zoom: sin doble toque a tamaño normal; si se amplía con los dedos, el doble toque nativo de iOS vuelve atrás ----------
// (con zoom se quita «touch-action: manipulation», así el doble toque reduce el zoom en vez de pulsar lo de debajo)
if (window.visualViewport) {
  const marcarZoom = () => document.documentElement.classList.toggle("ampliado", visualViewport.scale > 1.02);
  visualViewport.addEventListener("resize", marcarZoom);
  marcarZoom();
}

// ---------- Instrucciones de uso ----------
// Novedades sin ver: el «?» lleva un punto (y un pulso suave) hasta que abres la Ayuda; se recuerda en tu perfil y en el dispositivo
const VERSION_NOV = VERSION_APP.split(" ")[0];
const novedadesVistas = () => [(perfil && perfil.novedades_vistas) || "", leer("novedades-vistas-v1") || ""].includes(VERSION_NOV);
// Versiones con novedades que merece la pena avisar; en las demás (o para quien entra por primera vez) no hay aviso
const AVISAR_NOVEDADES = false;
function pintarAvisoNovedades() {
  // Quien nunca ha visto ninguna versión entra por primera vez: para él todo es nuevo, así que se da por vista
  if (sesion && perfil && !perfil.novedades_vistas && !leer("novedades-vistas-v1")) { marcarNovedadesVistas(); return; }
  const nuevo = AVISAR_NOVEDADES && !!sesion && !novedadesVistas();
  $("ayudaBtn").classList.toggle("nuevo", nuevo);
  $("ayudaBtn").setAttribute("aria-label", nuevo ? "Instrucciones de uso (hay novedades)" : "Instrucciones de uso");
}
function marcarNovedadesVistas() {
  escribir("novedades-vistas-v1", VERSION_NOV);
  if (perfil) { perfil.novedades_vistas = VERSION_NOV; escribir("perfil-v1", perfil); }
  if (sesion) api("/rest/v1/rpc/marcar_novedades", { method: "POST", body: JSON.stringify({ v: VERSION_NOV }) }).catch(() => {});
  pintarAvisoNovedades();
}
function abrirAyuda() {
  $("ayudaAdmin").hidden = !(perfil && perfil.es_admin);
  const habia = $("ayudaBtn").classList.contains("nuevo");
  if (!$("dlgAyuda").open) $("dlgAyuda").showModal();
  if (habia) {
    // Con novedades sin ver, se abre directamente por ellas
    const nov = $("dlgAyuda").querySelector(".novedades");
    if (nov) { nov.open = true; nov.scrollIntoView({ block: "start" }); }
    marcarNovedadesVistas();
  }
}
pintarAvisoNovedades();
$("ayudaBtn").addEventListener("click", abrirAyuda);
$("dlgAyuda").querySelectorAll("details").forEach(d => d.addEventListener("toggle", () => { if (d.open) verAlAbrir(d); }));

if (new URLSearchParams(location.hash.slice(1)).has("access_token") || /type=recovery|error_code=/.test(location.hash)) entrarDesdeEnlace();
else if (sesion) {
  mostrarApp(true);
  if (location.hash === "#cambio-clave") { history.replaceState(null, "", location.pathname); abrirClave(true); }
} else $("login").hidden = false;

// Cuando el día está fijado, la zona superior queda limpia de contenido desplazado.
(() => {
  const cubierta = document.createElement("div");
  cubierta.id = "cubiertaDia"; cubierta.hidden = true;
  cubierta.setAttribute("aria-hidden", "true"); document.body.appendChild(cubierta);
  let pendiente = false;
  const actualizar = () => {
    pendiente = false;
    let altura = 0;
    if (matchMedia("(max-width: 760px)").matches && !document.querySelector("dialog[open]")) {
      document.querySelectorAll('#vistaSemana .dia:not(.plegado):not([hidden]) > .dia-cab').forEach(cab => {
        if (!cab.getClientRects().length) return;
        const estilo = getComputedStyle(cab), rect = cab.getBoundingClientRect(), top = parseFloat(estilo.top);
        if (estilo.position === "sticky" && Number.isFinite(top) && top > 0 && rect.top > 0 && rect.top <= top + 1)
          altura = Math.ceil(rect.top);
      });
    }
    const oculta = altura === 0;
    if (cubierta.hidden !== oculta) cubierta.hidden = oculta;
    if (!oculta && cubierta.style.height !== altura + "px") cubierta.style.height = altura + "px";
  };
  const pedir = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); } };
  window.addEventListener("scroll", pedir, { passive: true });
  window.addEventListener("resize", pedir);
  document.addEventListener("click", pedir, true);
  document.addEventListener("toggle", pedir, true);
  document.addEventListener("close", pedir, true);
  const app = document.getElementById("app");
  if (app) new MutationObserver(pedir).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "open"] });
  actualizar();
})();

// Aviso en la propia app cuando hay una versión publicada más nueva que la que se está usando
async function comprobarVersionNueva() {
  if (BETA) return; // La beta no muestra el aviso emergente de actualización.
  try {
    const txt = await (await fetch("sw.js?v=" + Date.now(), { cache: "no-store" })).text();
    const nueva = +((txt.match(/"v(\d+)"/) || [])[1] || 0), actual = +VERSION_APP.split(" ")[0].slice(1);
    if (!(nueva > actual) || document.getElementById("avisoVersion")) return;
    const a = document.createElement("div");
    a.id = "avisoVersion"; a.className = "aviso-version"; a.setAttribute("role", "status");
    a.innerHTML = '<span>⚠ Hay una versión nueva. Reinicia el navegador o cierra y abre la aplicación.</span><button type="button" class="anadir">Actualizar ahora</button>';
    a.querySelector("button").addEventListener("click", () => location.reload());
    document.body.appendChild(a);
  } catch {}
}
setTimeout(comprobarVersionNueva, 8000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(comprobarVersionNueva, 3000); });
setInterval(comprobarVersionNueva, 30 * 60e3);
// Versión nueva: en el navegador (y en la app) se busca al volver a la pestaña; cuando la nueva toma el control,
// la página se recarga sola una vez (si no estás escribiendo), para que la web y la app vayan siempre igual
if ("serviceWorker" in navigator) {
  const habiaControl = !!navigator.serviceWorker.controller;
  let recargando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!habiaControl || recargando) return;
    const recargar = () => { if (recargando) return; recargando = true; location.reload(); };
    if (escribiendoSerie() || document.querySelector("dialog[open]")) document.addEventListener("visibilitychange", () => { if (document.hidden) recargar(); }, { once: true });
    else recargar();
  });
  navigator.serviceWorker.register("sw.js").then(reg => {
    document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
    setInterval(() => reg.update().catch(() => {}), 30 * 60e3);
  }).catch(() => {});
}
