# Lista de pruebas antes de cada versión

Se pasa entera en la **beta** (`https://spider-test.github.io/entreno-semanal/beta/`) antes de pasar nada a la principal.
Usa una cuenta de pruebas o días sin datos reales: la beta comparte la base de datos con la principal.

Apunta en cada versión: fecha, versión, dispositivo (iPhone / Mac / Android) y si pasa (✓) o falla (✗, con qué).

## 1. Entrar y versión
- [ ] Cerrar sesión y volver a entrar con email y contraseña.
- [ ] Ayuda (?) → «Novedades · versión N» muestra la versión nueva. En la beta, el título lleva la etiqueta BETA.
- [ ] Una cuenta sin aprobar ve la pantalla de «pendiente» y no los datos.

## 2. Series de fuerza y de carrera
- [ ] Añadir un ejercicio de fuerza a un día y apuntar una serie (kg × reps).
- [ ] «+ Serie» añade otra; tocar una serie la abre para editar; el botón dice «Guardar 1» al editar la serie 1.
- [ ] Añadir una serie de carrera (metros y tiempo): se ve el ritmo y, si es planificada, el objetivo.
- [ ] La tarjeta del ejercicio con series queda limpia (sin formulario abierto) y muestra «hechas/total».

## 2b. Ejercicio con ×N y OK
- [ ] Añadir un ejercicio, poner 60 kg × 8 y ×4, pulsar OK: se crean 4 series pendientes y el ejercicio se pliega («60 kg × 8 · ×4», 0/4).
- [ ] Tocar el nombre: se abre con los valores y ×4. Cambiar a 62,5 kg y ×6 → OK: las pendientes cambian y hay 6.
- [ ] Con 2 hechas, poner ×1 → pregunta si quitar hechas; «Dejar las hechas» deja solo las 2 hechas. «Deshacer» vuelve atrás.
- [ ] Cambiar el ejercicio en el selector (p. ej. sentadilla → otro de fuerza): se mantienen todas las series.
- [ ] «+ Serie» añade una suelta distinta; tocar una serie la edita sola («Guardar N»).
- [ ] ⋯ → Editar abre el mismo formulario; tocar el nombre con el formulario abierto lo cierra sin guardar.
- [ ] Lo mismo en carrera (metros, tiempo y descanso) y natación. Los bloques ×N y el modo entreno siguen igual.

- [ ] ⋯ de un ejercicio → «Eliminar ejercicio y sus series» → pulsar otra vez: desaparece con todas sus series; «Deshacer» lo recupera.

## 2c. Totales de distancia
- [ ] Día de carrera con calentamiento, 6 × 1000 con 200 m de recuperación (4 hechas): «Total carrera: hecho … de … planificados · tiempo · series · rec. · calent. y calma».
- [ ] Natación en metros con punto de miles («2.400 m»).
- [ ] Carrera en dos sesiones del mismo día: total de cada sesión y «Total del día».
- [ ] El día plegado muestra los km; al terminar el modo entreno aparece el total; el resumen semanal suma lo mismo (con recuperaciones en metros).
- [ ] Un día solo de fuerza no muestra ningún total.

## 3. Marcar, deshacer y deslizar
- [ ] Marcar una serie como hecha tocando su círculo; el número de la serie aparece.
- [ ] «Deshacer» en el aviso la deja como estaba.
- [ ] Desmarcar: tocar el número o ✓ de una serie hecha la vuelve pendiente.
- [ ] Deslizar a la derecha marca o desmarca; deslizar a la izquierda borra (con «Deshacer»).
- [ ] Borrar una serie y deshacer.

## 4. Bloques ×N
- [ ] «+ Bloque» con 2 ejercicios × 3 rondas: se crean las rondas en orden.
- [ ] Marcar una ronda; el progreso del bloque sube.

## 4b. Agrupar en bloque
- [ ] Día con 4 × (1000 m + trote 300 m), 2 hechas: mantener pulsada una serie, tocar las 8 → «Agrupar en bloque» propone «Bloque ×4 · Series 1000 m + Trote…»; al aceptar se conservan las 2 hechas y el total de distancia.
- [ ] «Deshacer» devuelve las series sueltas; ⋯ del bloque → «Desagrupar» también.
- [ ] Importar un archivo con series: marcar vueltas → «Agrupar las marcadas en bloque ×N» → «Quitar agrupación» → volver a agrupar y guardar: el día muestra el bloque.

## 4c. Calendario y unidades
- [ ] 📅 abre el mes: puntos en los días con entrenamiento (hecho, a medias, planificado), hoy marcado, la semana visible resaltada; ‹ › cambian de mes; tocar un día lleva a su semana con ese día desplegado; «Ir a hoy».
- [ ] Plan → Ajustes → Distancias en «Kilómetros»: las series salen en km, los campos piden km, − y + suben 0,1; escribir «400 m» o «5 km» en cualquier campo guarda bien; volver a «Automático».

## 5. Desplegables
- [ ] Plegar y desplegar cada día; tras recargar, quedan como estaban.
- [ ] Resumen de la semana, secciones de Plan, tipos de Ejercicios y apartados de la Ayuda: abren y cierran.
- [ ] Al abrir un desplegable que queda por debajo, la pantalla baja sola hasta verlo (sin taparlo la barra de pestañas).

## 6. Reordenar
- [ ] En un día con 4 o más elementos, arrastrar con ≡ el último hasta arriba: el movimiento es fluido y el orden se guarda.
- [ ] Tras soltar no se abre el teclado ni se edita nada debajo.
- [ ] Un ejercicio todavía sin series también se puede mover.
- [ ] ⋯ → «Mover a otra sesión…» lo pasa de sesión.

## 7. Modo entreno
- [ ] «Empezar entreno» abre la primera serie pendiente.
- [ ] Apuntar y marcar «✓ Hecha»: arranca el descanso y pasa a la siguiente.
- [ ] Anterior / Siguiente; «Marcar como pendiente» en una serie hecha.
- [ ] En carrera, el campo de tiempo muestra el objetivo como ejemplo.
- [ ] Salir y comprobar en la semana que lo marcado se ve igual.

## 8. Plantillas y mesociclos
- [ ] Guardar un día como plantilla; buscarla; añadirla a otro día.
- [ ] Seleccionar varias plantillas (mantener pulsada una) y usar la barra de acciones.
- [ ] Crear un mesociclo corto (2 semanas, con descarga) y aplicarlo; quitarlo después.

## 9. Sincronización entre dos pestañas o dispositivos
- [ ] Abrir la app en dos pestañas (o iPhone y Mac). Marcar una serie en una.
- [ ] En la otra, al volver a ella (o en menos de 30 s), aparece marcada.
- [ ] Editar la misma serie en las dos: gana la última edición.

## 10. Sin conexión
- [ ] Activar modo avión (o desconectar en el Mac). La app abre y deja apuntar series («Guardado en el dispositivo»).
- [ ] Al reconectar, el estado pasa a «Sincronizado» y la otra pestaña o dispositivo recibe el cambio.

## 11. Importar carreras
- [ ] Plan → Importar carreras → un GPX de prueba con vueltas: se crean las series y recuperaciones en su fecha.
- [ ] Borrar lo importado si era una prueba.

- [ ] CSV de vueltas de COROS (p. ej. …20261103185611.csv): sale el 3 nov 18:56 con fecha editable; calentamiento, 4 series y recuperaciones; cambiar la fecha y comprobar que se guarda en el día elegido.

- [ ] GPX con cuestas (o el CSV de COROS): la vista previa muestra «(aj. …)» y «+X m / −Y m» por vuelta; tras importar, cada serie lo enseña y las de más del 4 % salen «con desnivel».
- [ ] Marcas: la serie «con desnivel» no aparece en mejores marcas; con Plan → Ajustes → «Cuentan, con su ritmo ajustado», sí (con el tiempo ajustado).
- [ ] Un archivo sin altitud y las series apuntadas a mano siguen como antes (sin «aj.»).

- [ ] FIT de COROS (o el de prueba «5x1000 cuestas»): fecha y hora del archivo, vueltas clasificadas por el reloj (calentamiento, serie, recuperación, vuelta a la calma), bloque ×5, objetivos «obj. 3:50–4:00/km», ♥ media/máxima, pasos/min y desnivel por vuelta en la vista previa y en cada serie.
- [ ] Marcas: un rodaje con FC sube (o mantiene) el VDOT y la nota dice «estimado con tus pulsaciones»; cambiar la FC máxima en Plan → Ajustes lo recalcula.

## 11b. Crear con IA
- [ ] «Entrenamiento suelto»: tipo, duración e intensidad cambian el prompt; pegar una sesión de ejemplo → vista previa → «Añadir al día» (con «guardarla también como plantilla»): aparece en el día con el nombre de la sesión y en Plantillas.
- [ ] Objetivo «Maratón» con marca y fecha: el prompt cuenta las semanas hasta la carrera, incluye las marcas previstas y pide tapering; pegar un plan de maratón de ejemplo con SEMANA 1…N y una tirada larga por tramos («1x8km @5:20/km + 1x6km @4:50/km») y crear el mesociclo.

- [ ] Pegar una sesión con «Bicicleta estática [fuerza]: 1x5min» y «Plancha [fuerza]: 3x45s»: se lee sin error y en el día sale «5 min» y «45 s».

## 11c. Aviso de novedades
- [ ] Con una versión nueva, el «?» lleva un punto (y pulso suave; sin animación con «Reducir movimiento»). Al pulsarlo se abren las Novedades y el punto desaparece; en otro dispositivo con la misma cuenta tampoco sale.

- [ ] Pulsaciones: sin datos y con edad 40 → FC máx 180 «provisional por tu edad»; tras importar un FIT con pulso → «pico mantenido · <serie> del <fecha>» en Ajustes y Marcas; ponerla a mano más baja que el pico → aviso «has llegado a …».
- [ ] Zonas: debajo del total de la carrera importada sale la barra Z1–Z5 con tiempos; Marcas → Pulsaciones muestra la tabla de zonas y el reparto de 4 semanas; con FC en reposo cambian los límites.
- [ ] Forma: Marcas → «Por qué» lista series, volumen, descanso efectivo (trotando al 60 %), desnivel, % de FC máxima, deriva cardiaca y caída de ritmo.

- [ ] Marcas: tres apartados desplegables (Fuerza, Carrera, Piscina) que recuerdan si estaban abiertos; Fuerza separa Pierna, Torso, Brazos y Core con récord, 1RM y fecha, y al tocar un ejercicio abre su ficha; Piscina muestra las marcas de natación.

- [ ] Marcas → Pulsaciones (arriba): FC máxima en grande con su origen, «Ver la actividad del …» abre ese día, FC en reposo, zonas, tiempo por zona y gráfica del pico; «Editar» cambia entre automática, por edad y a mano. Tras importar un FIT, Plan → Ajustes muestra la FC máxima (no «sin datos»). El total de una carrera importada muestra «♥ media … · máx … ppm».

- [ ] Marcas → Carrera → Marcas previstas: filas de 1 km y 2 km con VDOT, ritmo, Riegel y «Real» (tu mejor marca, con * si sale de una serie más larga); 2000 m en Mejores marcas; Crear con IA tiene «Carrera 1 km» y «Carrera 2 km».

- [ ] Mis carreras: «+ Carrera» con fecha futura → aparece como objetivo con cuenta atrás y «Preparar con IA» rellena distancia, fecha y objetivo; con fecha pasada y tiempo → sale en su distancia con ★ si es la mejor, ritmo, puesto y previsto; ⋯ de un ejercicio de carrera → «Marcar como carrera» rellena distancia, tiempo, FC y desnivel; la carrera aparece en Mejores marcas y en el «Por qué» de la forma; eliminar y deshacer.

## 12. Sugerencias
- [ ] Enviar una sugerencia de prueba desde «Enviar sugerencia».
- [ ] (Administrador) Plan → Sugerencias: aparece; marcarla como leída; borrarla y deshacer.

## 12b. Accesos (administrador)
- [ ] Plan → Usuarios: cada usuario muestra «Último uso: hoy 21:14 · iPhone (app) · v52» y «Último inicio de sesión»; ordenada por uso; «activo esta semana» en quien entró en 7 días. Un usuario normal no ve nada de esto.

## 13. Móvil (iPhone y Android)
- [ ] Doble toque sin zoom no amplía; pellizcar sí amplía; con zoom, el doble toque reduce sin pulsar lo de debajo.
- [ ] La barra de pestañas no tapa el último elemento de ninguna pestaña.
- [ ] Modo claro y oscuro: todo se lee bien.

## 14. Ordenador
- [ ] A 1280 y 1440 px: la semana en 7 columnas; el día desplegado se ensancha y sus series caben en una o dos líneas.
- [ ] ⋯ y ✕ aparecen al pasar el ratón.

## 15. Publicación
- [ ] VERSION_APP (app.js), VERSION (sw.js), Novedades y Ayuda actualizados.
- [ ] GitHub → Actions → «pages build and deployment» termina en verde.
- [ ] La web sirve la versión nueva (Ayuda → Novedades). Si el despliegue falla o tarda más de 10 minutos, relanzarlo con un commit mínimo (subir VERSION en sw.js).
- [ ] Solo después de pasar todo en la beta, copiar los mismos archivos a la principal y repetir 1, 9 y 15 allí.

## Rendimiento (de referencia)
Con un año simulado (≈3.300 series), en el Mac: abrir la app ≈ 25 ms, pintar la semana ≈ 15–18 ms, un día ≈ 7 ms, Marcas ≈ 7 ms.
Si alguna cifra se multiplica por 3 o más en una versión nueva, revisar antes de publicar.
