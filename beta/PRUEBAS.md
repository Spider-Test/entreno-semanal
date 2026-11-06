# Lista de pruebas antes de cada versión

Se pasa entera en la **beta** (`https://spider-test.github.io/fuerza-y-ritmo/beta/`) antes de pasar nada a la principal.
**No hagas pruebas que escriban datos hasta comprobar que `app.js` apunta al proyecto Supabase de pruebas aislado.** Esta copia conserva la conexión que ya traía y no se ha confirmado que sea el proyecto nuevo; la versión beta anterior compartía la base de datos con la principal.

Apunta en cada versión: fecha, versión, dispositivo (iPhone / Mac / Android) y si pasa (✓) o falla (✗, con qué).

## 1. Entrar y versión
- [ ] Cerrar sesión y volver a entrar con email y contraseña.
- [ ] Ayuda (?) → «Novedades · versión N» muestra la versión nueva. En la beta, el título lleva la etiqueta BETA.
- [ ] Una cuenta sin aprobar ve la pantalla de «pendiente» y no los datos.

- [ ] «¿Has olvidado tu contraseña?» sin email avisa; con email llega el correo, su enlace abre la app y pide la contraseña nueva; después se entra con ella.
- [ ] «Cambiar contraseña» (abajo): si no coinciden o tiene menos de 6 caracteres, avisa; al guardar, la nueva sirve para entrar.

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

## 4d. Varios entrenos el mismo día
- [ ] «+ Entreno» → «Tarde»: aparece una caja vacía con «+ Ejercicio» y «+ Bloque»; el primero se llama «Entreno 1».
- [ ] Añadir un ejercicio y un bloque a «Tarde»: sus series se guardan en «Tarde» y no se mezclan con el primero.
- [ ] Renombrar «Entreno 1» a «Mañana»; quitar un entreno vacío; recargar y que todo siga igual.

## 4e. Partes de un entreno
- [ ] Sin crear partes, el entreno se ve como siempre (sin cabeceras).
- [ ] «+ Parte» → «Calentamiento» y «Parte principal»: cabeceras de colores distintos; «+ Ejercicio» y «+ Bloque» de cada parte guardan ahí; «Mover a otra parte»; subir, bajar, renombrar, quitar y borrar (con deshacer).
- [ ] Guardar el día como plantilla y aplicarla otro día: mantiene las partes. Pegar en Crear con IA una sesión con «### Calentamiento»: la vista previa y el día las muestran. El modo entreno pone «Entreno · Parte».

- [ ] «Hoy» (verde): aparece en otra semana, con hoy plegado y en la vista de otro día; lleva a hoy desplegado (o al día de hoy en la vista de día).
- [ ] Abrir un mesociclo o plantillas compartidos (#c=…): cada día o plantilla se despliega con sus ejercicios, partes y bloques; en el editor del mesociclo, cada día también.
- [ ] Borrar cualquier cosa abre la ventana Cancelar / Eliminar.

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

- [ ] «Importar documento…» con un PDF y un Word de un plan: el prompt incluye su texto y el formato; un .txt ya en formato de la app abre la vista previa directamente; una foto avisa de que no hay texto y prepara el prompt para adjuntarla.

## 11c. Aviso de novedades
- [ ] Con una versión nueva, el «?» lleva un punto (y pulso suave; sin animación con «Reducir movimiento»). Al pulsarlo se abren las Novedades y el punto desaparece; en otro dispositivo con la misma cuenta tampoco sale.

- [ ] Pulsaciones: sin datos y con edad 40 → FC máx 180 «provisional por tu edad»; tras importar un FIT con pulso → «pico mantenido · <serie> del <fecha>» en Ajustes y Marcas; ponerla a mano más baja que el pico → aviso «has llegado a …».
- [ ] Zonas: debajo del total de la carrera importada sale la barra Z1–Z5 con tiempos; Marcas → Pulsaciones muestra la tabla de zonas y el reparto de 4 semanas; con FC en reposo cambian los límites.
- [ ] Forma: Marcas → «Por qué» lista series, volumen, descanso efectivo (trotando al 60 %), desnivel, % de FC máxima, deriva cardiaca y caída de ritmo.

- [ ] Marcas: tres apartados desplegables (Fuerza, Carrera, Piscina) que recuerdan si estaban abiertos; Fuerza separa Pierna, Torso, Brazos y Core con récord, 1RM y fecha, y al tocar un ejercicio abre su ficha; Piscina muestra las marcas de natación.

- [ ] Marcas → Pulsaciones (arriba): FC máxima en grande con su origen, «Ver la actividad del …» abre ese día, FC en reposo, zonas, tiempo por zona y gráfica del pico; «Editar» cambia entre automática, por edad y a mano. Tras importar un FIT, Plan → Ajustes muestra la FC máxima (no «sin datos»). El total de una carrera importada muestra «♥ media … · máx … ppm».

- [ ] Marcas → Carrera → Marcas previstas: filas de 1 km y 2 km con VDOT, ritmo, Riegel y «Real» (tu mejor marca, con * si sale de una serie más larga); 2000 m en Mejores marcas; Crear con IA tiene «Carrera 1 km» y «Carrera 2 km».

- [ ] Mis carreras: «+ Carrera» con fecha futura → aparece como objetivo con cuenta atrás y «Preparar con IA» rellena distancia, fecha y objetivo; con fecha pasada y tiempo → sale en su distancia con ★ si es la mejor, ritmo, puesto y previsto; ⋯ de un ejercicio de carrera → «Marcar como carrera» rellena distancia, tiempo, FC y desnivel; la carrera aparece en Mejores marcas y en el «Por qué» de la forma; eliminar y deshacer.

- [ ] Movilidad (v59): crear «Estiramiento de isquios» → sale como Movilidad (morado); serie «2 o 30» con «Por lado» → «2 reps · 30 s por lado»; «45» en tiempo son 45 s; −/+ del tiempo sube 5 s; sin PR; ficha con Sesiones y Tiempo total; Ejercicios tiene el apartado «Movilidad»; resumen de la semana con «Movilidad · N min»; modo entreno con Repeticiones y Tiempo; bloque con un tramo de movilidad; IA o texto «- Paloma [movilidad]: 2x30s por lado» se lee bien.

- [ ] v63: las partes con nombre son cajas de su color con sus ejercicios dentro; tocar el nombre las pliega (solo queda la cabecera con el progreso) y se recuerda al recargar; arrastrar a la cabecera de otra parte sigue funcionando.
- [ ] v63: ⋯ de un bloque → «+ Añadir un ejercicio al bloque…» lo añade en todas las rondas (con los valores de su última serie); «Quitar un ejercicio del bloque…» lo saca con Deshacer; arrastrar un ejercicio suelto encima del título del bloque lo mete (la 1.ª serie a R1, la 2.ª a R2…) y desaparece como suelto; Deshacer lo devuelve.

- [ ] v64: bloque con título «A3 ×2» dentro de una parte o «×2 rondas» fuera (sin repetir ejercicios) y el nombre en cada ronda; ▶ a la derecha de cada ejercicio con vídeo en la R1 abre el visor; en cada parte, etiquetas A1, A2… (B1, B2… en la segunda parte) en ejercicios y bloques.

- [ ] v65: ⋯ de un ejercicio → «+ Descripción» → «Tempo 3-2-1-2» se ve bajo el nombre y en el modo entreno; tocarla la edita; «Quitar» la borra; las series nuevas la heredan; en un bloque, «De todo el bloque» va bajo el título y la de un ejercicio junto a él en la R1; se conserva al copiar, en plantillas y al compartir; «nota: …» en el texto de la IA se lee. Requiere la columna series.nota (SQL).
- [ ] v66: un ejercicio recién añadido (sin series) muestra «+ Descripción» bajo sus casillas; la descripción se ve y pasa a las series al pulsar OK; una parte con ejercicios sin series no pone «vacía».

- [ ] v67: letras continuas entre partes (A1, A2 | B1, B2…); ⋯ de un ejercicio o bloque (no el primero de su parte) → «Empezar letra nueva aquí» → C1, C2…; «Seguir con la letra anterior» lo quita; se mantiene al apuntar la primera serie, al copiar y en plantillas. Requiere la columna series.letra_nueva (SQL).

- [ ] v68: abrir un código compartido → solo vista previa con «+ Añadir a mi rutina…» y «Solo mirar (cerrar)»; Añadir → «Ponerlo en un día…» (semana con ‹ ›) o «Guardar como plantilla»; al ponerlo en un día, la semana salta a ese día; igual con plantillas y mesociclos.

- [ ] v69: el formulario muestra «Series − N +» arriba y kg × reps debajo; «⏱ Por tiempo (isométrico)» en fuerza → «10 kg · 45 s» (también en bloques y modo entreno); escribir valores sin OK y añadir o mover otro ejercicio conserva lo escrito; mover un ejercicio sin series por encima de otro sin series se queda; «Remo inclinado» se adivina como fuerza; «Al máximo» (o escribir «máx», también en las rondas de un bloque) guarda «40 kg × máx»; con «Por tiempo» → «máx tiempo»; al tocar la serie pendiente pide «¿cuántas reps?» / «¿cuántos segundos?» y guarda lo que salió; «3xmáx tiempo» en texto se lee (v70, requiere series.max_tiempo).

- [ ] v72: en fuerza, «Por lado» bajo el selector → «30 s por lado» / «12 kg × 10 por lado»; se marca al editar la serie y el modo entreno dice «Tiempo por lado».

- [ ] v73: parte con varias letras → cajas «▸ B …», «▸ C …» con nombres y progreso; tocar pliega/despliega y se recuerda; con una sola letra no hay caja; arrastrar entre cajas sigue funcionando.

- [ ] v74: ⋯ de un ejercicio sin «Editar», «Editar la descripción», «Subir», «Bajar» ni «Mover a otra parte»; queda «Mover a otro entreno del día…» si hay varios; ⋯ de un bloque sin Subir/Bajar/Mover a otra parte.

- [ ] v75: ⋯ ejercicio → Copiar ejercicio (aviso «📋 Copiado…»); ⋯ parte → Copiar parte / Pegar en esta parte; ⋯ entreno → Copiar entreno / Pegar aquí; tocar una serie → «📋 Copiar esta serie» → ⋯ de otro ejercicio del mismo tipo → Pegar serie; todo lo pegado queda pendiente y Deshacer lo quita; la serie no se ofrece en ejercicios de otro tipo. v76: un ejercicio pegado en el ⋯ de un día va a su primer entreno (no crea uno con el nombre del original); pegado donde ya está, el aviso dice «añadidas al mismo ejercicio».

- [ ] v77: con algo copiado sale «📋 Pegar» junto a «+ Ejercicio» en el día, en cada entreno y en cada parte; pega ahí (también en la misma sesión).

- [ ] v78: «✂️ Cortar» en el ⋯ de ejercicio, bloque, parte y entreno lo quita (con Deshacer) y queda listo para «📋 Pegar»; tocar una serie → «✂️ Cortar» la quita y se pega con «Pegar serie».

- [ ] v79: en un día con partes, «📋 Pegar» solo sale dentro de cada parte (no abajo del día ni en el ⋯ del día, salvo que lo copiado sea un día entero); pegar en la parte B un ejercicio copiado de la A lo deja solo en B.

- [ ] v80: copiar y pegar solo de entrenamientos: ⋯ día → Copiar día / ⋯ entreno → Copiar entreno → ⋯ de otro día → «📋 Pegar … en este día» (con Deshacer); ya no hay copiar/cortar/pegar en ejercicios, bloques, partes ni series, ni botones «📋 Pegar»; el mismo ejercicio en dos partes sale como dos tarjetas.

- [ ] v82 (Listas, requiere la tabla «listas»): pestaña Listas; + Nueva lista; ⋯ de un día → «Guardar en una lista…» (elige o crea lista y nombre) lo guarda como plantilla y lo añade; + Añadir entrenamiento elige una plantilla; tocar el nombre despliega los ejercicios; + Día lo pone en el día elegido y salta a él; «siguiente» avanza; ≡ ordena; ⋯ → marcar como siguiente / añadir a otra lista / quitar (con Deshacer); eliminar lista con Deshacer; sin la tabla en el servidor el resto sigue sincronizando.

- [ ] v83: «+ Semana o bloque» añade separadores; ≡ mueve entrenamientos y semanas juntos; ⋯ de semana → añadir aquí / duplicar (copia con los mismos entrenamientos, nombre «Semana 2») / renombrar / quitar; ⋯ entrenamiento → Repetir debajo; «+ Entreno» en un día → vacío o «Desde la lista…» (▶ marca el siguiente).

- [ ] v84: los bloques de una lista son cajas con sus entrenamientos dentro; tocar el nombre las pliega (se recuerda); ≡ del bloque lo mueve entero (también plegado, sin perder lo de dentro); ≡ de un entrenamiento lo pasa a otro bloque; «+ Entrenamiento en este bloque»; bloque vacío muestra el aviso.

- [ ] v85: en un bloque ×N, cada ejercicio tiene ⋯ en la R1 → Ver ficha / Descripción / Quitar del bloque (con Deshacer).

- [ ] v86: un entreno vacío («Entreno 1 · 0/0», con una parte vacía dentro) desaparece con ⋯ → «Quitar este entreno del día».

- [ ] v87: Compartir muestra el código grande con «Copiar código» (aviso «Código copiado»), «Copiar enlace» y «Enviar…»; con la web abierta en una pestaña, al publicar una versión nueva se actualiza sola al volver a la pestaña (se recarga una vez).

- [ ] v88 (requiere entrenos.extra): un ejercicio añadido sin series (con parte, descripción y letra), un entreno vacío y una parte vacía en el móvil aparecen en el ordenador tras sincronizar, y al quitarlos desaparecen en los dos.

- [ ] v89: si en Supabase falta una columna nueva, la app sigue sincronizando el resto y abajo dice «falta en la base de datos: …»; tras ejecutar el SQL, desaparece el aviso.

- [ ] v93: Crear con IA / importar documento → Revisar → «Guardar en una lista» → elegir o crear lista; los entrenamientos se guardan como plantillas y entran en la lista; si el plan tiene SEMANA 1, 2…, cada semana va en su bloque; salta a la pestaña Listas.

- [ ] v94: editar una serie, el ejercicio entero o una ronda de bloque y tocar fuera → se guarda solo; abrir y salir sin cambiar no guarda.

- [ ] v100: en una serie «máx tiempo» o «máx reps», tocar el círculo abre el formulario con «¿cuántos segundos?» / «¿cuántas reps?» (y kg) y queda «máx tiempo (52 s · 5 kg) ✓» / «máx reps (14 · 10 kg) ✓» (v101, columna series.max_reps); también en las rondas de un bloque y al editar una ya hecha.

- [ ] v106 (requiere personales.medida): ficha → «Cómo mides tu progreso» Peso / Reps máx. / Tiempo máx.; automático por el nombre (dominadas → reps, lastradas → peso, plancha/false grip → tiempo); con reps/tiempo no sale 1RM ni Bilbo, el récord y la gráfica van por reps o tiempo, el PR es más reps o más tiempo y el formulario no pide kg; elegir a mano queda «Elegido por ti».

- [ ] v107 (requiere personales.lado): ficha → «Se hace por lado» → las series nuevas y las pendientes salen «por lado»; el formulario ya no muestra la casilla Por lado (fuerza y movilidad).

- [ ] v108: ⋯ de un entreno → «📅 Mover a otro día…» y ⋯ del día → «📅 Mover el entrenamiento a otro día…»: pasa todo (series, ejercicios sin series, partes) al día elegido, la semana salta allí y Deshacer lo devuelve.

- [ ] v109: un entreno con nombre que es el único del día («Ciclo de dominadas») también se pliega y despliega tocando su nombre.

- [ ] v110: vídeo con ?t=90 empieza en 1:30; «enlace 1:30-2:15» se ve solo de 1:30 a 2:15; «Abrir en YouTube» también empieza ahí.

- [ ] v113: ejercicio nuevo: escribir series/reps/kg y tocar otro ejercicio sin OK → se crean las series; abrir la edición sin cambiar y salir → se cierra; «+ Serie», escribir y salir → se añade.

- [ ] v115: «Cancelar» junto a OK: en un ejercicio recién añadido lo quita; en uno con series descarta los cambios y cierra la edición; cabe en la línea del descanso en el móvil.

## 12. Sugerencias
- [ ] Enviar una sugerencia de prueba desde «Enviar sugerencia».
- [ ] (Administrador) Plan → Sugerencias: aparece; marcarla como leída; borrarla y deshacer.

## 12b. Accesos (administrador)
- [ ] Plan → Usuarios: cada usuario muestra «Último uso: hoy 21:14 · iPhone (app) · v52» y «Último inicio de sesión»; ordenada por uso; «activo esta semana» en quien entró en 7 días. Un usuario normal no ve nada de esto.

- [ ] v81 (se ve «versión 26»): al abrir Plan, la lista de usuarios se recarga; nunca sale vacía si ya se había cargado (se guarda en el dispositivo); sin conexión dice «Cargando usuarios…»; el último uso se anota al abrir o volver a la app y cada 5 min con ella abierta (máx. 1 vez cada 10 min) y muestra «v26 (v81)».

- [ ] v90: Usuarios muestra «Última conexión: hoy 08:39 · dispositivo · versión» en negrita y, aparte, «Entró con su contraseña por última vez…»; quien tenga una versión antigua sale con «⚠ versión antigua…».

- [ ] v91: con una versión publicada más nueva, arriba sale «⚠ Hay una versión nueva. Reinicia el navegador o cierra y abre la aplicación» con «Actualizar ahora»; en Usuarios, quien va atrasado sale con «⚠ Versión antigua (reiniciar el navegador o cerrar y abrir la aplicación)».

## 13. Móvil (iPhone y Android)
- [ ] v111: arrastrar un ejercicio o usar un menú (mover, borrar…) no hace saltar la pantalla; al editar y guardar, el ejercicio se queda quieto.
- [ ] v105: fuerza → «[3] series» junto al nombre (solo con el formulario abierto); fila «[reps] Reps ▾   [peso] kg»; abajo «☐ Por lado · ⏱ desc. · OK»; crear y editar guardan bien (también al tocar fuera).
- [ ] v102: formulario más limpio: «Reps ▾» (menú con Reps / Tiempo / Máx. reps / Máx. tiempo) y «Por lado» en una línea; «⇄ Cambiar ejercicio» plegado hasta tocarlo. v103: el botón kg/% va a la derecha del peso y el descanso (casilla corta) y OK van en la misma línea que «Reps ▾ · Por lado».
- [ ] v99: cada serie se ve «10 reps (100 kg)», «máx reps (40 kg)», «45 s por lado (10 kg)», «8 reps (75 %)», en el día, en los bloques, en la ficha y en el historial.
- [ ] v98: formulario de fuerza «[series] × [reps] ( kg [peso] )» en una fila (en el móvil sin − y +, casillas anchas); resumen del ejercicio «3 × 10 (100 kg)».
- [ ] v96: al editar un ejercicio en el móvil y guardar (o al guardarse solo), el ejercicio se queda en el mismo sitio de la pantalla, sin saltar; escribir en «Series» no amplía la pantalla del iPhone.
- [ ] v95: la ficha de un ejercicio en el móvil no se sale por la derecha (selector Fuerza/Carrera/Natación/Movilidad en dos filas si no cabe); el filtro del buscador de ejercicios igual.
- [ ] v92: en el móvil los nombres largos no se parten a mitad de palabra; «MOVILIDAD», «▶ vídeo» y A1 van enteros; el resumen (10 reps · ×1 · 0/1) va en la línea de debajo del nombre.
- [ ] Doble toque sin zoom no amplía; pellizcar sí amplía; con zoom, el doble toque reduce sin pulsar lo de debajo.
- [ ] La barra de pestañas no tapa el último elemento de ninguna pestaña.
- [ ] Modo claro y oscuro: todo se lee bien.

## 14. Ordenador
- [ ] v116: arrastrar con ≡ un entreno (o ejercicio) cambia de sitio en cuanto el ratón/dedo pasa la mitad del otro, igual hacia arriba que hacia abajo, aunque sean altos.
- [ ] v117: fuerza con 4 series → salen filas 2, 3 y 4 con reps y kg; cambiar los kg de la 3 guarda solo esa; las filas nuevas copian la 1 hasta tocarlas; las hechas salen grises y bloqueadas.
- [ ] v117: apuntando una serie nueva, tocar otra de arriba guarda la nueva antes de abrir la otra.
- [ ] v117: con Bilbo marcado se guarda sin reps; luego se toca y se apuntan las que salieron.
- [ ] v118: ⋯ del bloque → «⏱ Descansos del bloque…»: entre ejercicios, entre rondas y al terminar cambian solo esas series; «0» los quita.
- [ ] v118: en una serie de un bloque de fuerza, kg/% cambia los kilos y el % (con 1RM); «Igual en las otras rondas pendientes» lo aplica a todas; crear un bloque con «75%» funciona.
- [ ] v119: crear bloque y editar una ronda de fuerza: reps a la izquierda, kg y botón kg/% a la derecha; Enter va reps → kg → descanso.
- [ ] v119: en un ejercicio o en una ronda, tocar kg/% no guarda ni cierra; al tocar fuera sí se guarda.
- [ ] v120: crear bloque y editar ronda: «Reps ▾» cambia a Tiempo / Máx. reps / Máx. tiempo; en máx se guarda sin número y luego se apunta lo que salió.
- [ ] v120: ficha → «Isométrico (tiempo)»: el ejercicio y el bloque piden segundos y el menú solo ofrece Tiempo y Máx. tiempo.
- [ ] v120: añadir un ejercicio que ya está en otra parte u otro entreno del día crea otra tarjeta.
- [ ] v121: añadir un ejercicio que ya está en la misma parte crea «… (2)»; sus series van aparte y se ven igual en otro dispositivo (tras el SQL de «copia»).
- [ ] v122: dentro de una parte, el ejercicio repetido no lleva «(2)» (lo distingue la letra).
- [ ] v122: «+ Ejercicio» suelto en un entreno con partes queda debajo de la última parte; se arrastra arriba y abajo sin meterse en la parte.
- [ ] v122: arrastrar con ≡ hacia abajo cuesta lo mismo que hacia arriba; pasar por encima del título de una parte o bloque no lo mete; quedarse encima un momento sí.
- [ ] v123: arrastrar un ejercicio de una parte a otra: sale un hueco de puntos; los ejercicios de la otra parte se apartan sin salirse de ella.
- [ ] v123: hueco al principio de una parte (mitad de abajo del título), al final (mitad de arriba de «+ Ejercicio») y suelto entre dos partes (justo encima del título de la de abajo).
- [ ] v123: pasar un ejercicio a una parte donde ya está el mismo no los junta; en el ordenador y en el móvil.
- [ ] v124: en el iPhone, al coger un ejercicio con ≡ no se desplaza de lado y va pegado al dedo sin tirones.
- [ ] v125: en un ordenador de pantalla grande (con zoom), al arrastrar con ≡ la tarjeta no se va a la derecha, el hueco mide lo mismo que ella y va pegada al ratón (también las series y los entrenos).
- [ ] v126: Marcas → Bilbo → tocar un ejercicio abre su registro (ciclos en columnas, acumulados, récords, próximas sesiones, gráfica).
- [ ] v126: «10-12» o «10,12» en reps (ejercicio, fila, bloque, crear bloque) sale «10-12 reps»; al marcar pide las reps y queda «11 reps (de 10-12)»; en el modo entreno también las pide.
- [ ] v126: en el ordenador, Ctrl/⌘+Z deshace lo último y Ctrl+Y / ⌘⇧Z lo rehace; dentro de un campo deshace el texto.
- [ ] v126: «+ Bloque» → «Crear vacío»; arrastrar un ejercicio encima de su título lo mete en todas las rondas; ⋯ cambia rondas o lo quita.
- [ ] v128: arrastrar un ejercicio o bloque a otro entreno del día lo pasa allí, al sitio del hueco; ⋯ de una parte → «Mover la parte a otro entreno…».
- [ ] v128: con un solo entreno con nombre, «+ Parte/+ Ejercicio/+ Bloque» de abajo añaden a ese entreno (no crean «Entreno 1»); con varios, preguntan a cuál; 8 partes o más funcionan.
- [ ] v128: al arrastrar, quedarse encima de una parte plegada la despliega; soltar fuera la vuelve a plegar; soltar dentro la deja abierta.
- [ ] v129: crear un entrenamiento con IA: la respuesta trae «### Calentamiento» con ejercicios [movilidad] y la app los mete en la parte Calentamiento; «4x8-12» se importa como ventana.
- [ ] v130: Crear con IA → «Basado en» un mesociclo, lista o últimas semanas: el prompt incluye la estructura y la progresión; «¿Cómo?» cambia la instrucción (variantes / progresar / otro enfoque); un mesociclo propone sus semanas.
- [ ] v131: pegar el prompt en «Respuesta de la IA» y Revisar avisa de que es el prompt (no importa el ejemplo «Fuerza y carrera 3 días»).
- [ ] v132: aplicar un mesociclo ya puesto pregunta; «Completar» no duplica y respeta una sesión movida de día; «Rehacer» devuelve lo pendiente a su día sin duplicar lo hecho; si se cruza con otro mesociclo avisa; el aviso permite deshacer.
- [ ] v133: mesociclo → «Añadir a una lista…»: aparecen su cabecera y sus entrenamientos en orden; repetirlo en la misma lista avisa; Deshacer lo quita.
- [ ] v134: día/entreno/parte con contenido muestran solo «＋ Añadir»; al tocarlo salen los botones y se recogen al elegir o tocar fuera; día o parte vacíos los muestran ya; arrastrar al final de una parte sigue funcionando.
- [ ] v135: al añadir ejercicio, la lista va del más usado al menos (con «N veces»); con otro usuario el orden es el suyo.
- [ ] v136: Marcas → «+ Marca»: 100 m en 0 min 13,2 s sale «0:13,2» en mejores marcas y en «Marcas añadidas a mano»; tocarla deja corregir o borrar (con deshacer); no sale en «Mis carreras».
- [ ] v136: mejores marcas en 300…900 m; tiempos con décimas; «Mis carreras» debajo de la forma; los apartados se pliegan y se recuerda.
- [ ] v136: Marcas → Fuerza: plancha lateral (por tiempo) muestra su mejor tiempo.
- [ ] v137: crear o renombrar una lista (o semana/bloque, parte, plantilla) y pulsar Enter guarda el nombre; Cancelar no guarda; Enter guarda también en marca, carrera, mesociclo, molestia, esfuerzo y contraseña.
- [ ] v138: lista con 6 semanas → «+ Mesociclo» las agrupa en «Mesociclo 1»; ⋯ de la semana 4 → «Empezar un mesociclo aquí» crea «Mesociclo 2» con las semanas 4-6; plegar, renombrar, duplicar, quitar y mover con ≡ funcionan; «Poner el siguiente» sigue el orden.
- [ ] v139: ⋯ de un entreno → «Fusionar con otro entreno del día»: queda uno solo con el nombre elegido, el primero arriba; el mismo ejercicio en los dos queda en dos tarjetas; Deshacer.
- [ ] v139: soltar un ejercicio encima del título de un entreno plegado lo mete al final y lo despliega.
- [ ] v140: tres cambios seguidos (apuntar, marcar, marcar) → Ctrl/⌘+Z tres veces los deshace uno a uno; Ctrl+Y / ⌘⇧Z los rehace; el aviso dice cuántos quedan.
- [ ] v141: abrir la ficha de un ejercicio y bajar hasta el final (dedo o rueda): la semana de detrás no se mueve; al cerrar, sigue en el mismo sitio.
- [ ] v142: la Ayuda (?) ya no tiene el apartado «Novedades» ni sale el aviso de novedades en el «?».
- [ ] v112: semana en 7 columnas: los nombres de ejercicios y partes no se parten letra a letra (los títulos largos acaban en «…»), el resumen del ejercicio se oculta y nada se sale de su columna.
- [ ] A 1280 y 1440 px: la semana en 7 columnas; el día desplegado se ensancha y sus series caben en una o dos líneas.
- [ ] ⋯ y ✕ aparecen al pasar el ratón.
- [ ] v61: zoom automático 1 / 1,06 / 1,12 / 1,25 / 1,45 (hasta 1500, 1800, 2200, 2700 px); Plan → Ajustes → Tamaño en el ordenador cambia al momento y se recuerda.
- [ ] v61: día con dos entrenos → tocar el nombre de uno lo pliega (se ven sus ejercicios en una línea y el progreso); se recuerda al recargar.
- [ ] v61: la beta instalada tiene el icono naranja «BETA».
- [ ] v62: «▶ vídeo» (ejercicio suelto, bloque ×N con «▶ Nombre», miniatura de la ficha) abre el visor centrado; un Short se ve vertical y completo, un vídeo normal en 16:9; en el ordenador ampliado no se descuadra; se cierra con ✕, tocando fuera o con Esc y el vídeo deja de sonar; un enlace que no es de YouTube se abre aparte.
- [ ] v61: en una pestaña con poco contenido (Ejercicios casi vacío), Enviar sugerencia / Cambiar contraseña / Cerrar sesión salen al fondo, justo encima de las pestañas (móvil) o al pie de la ventana (ordenador), sin scroll de más.
- [ ] v61: arrastrar un ejercicio sin parte (asa ≡) encima de la cabecera «Calentamiento» → se ilumina y entra al final; arrastrarlo entre los ejercicios de otra parte lo cambia de parte; la parte que queda vacía sigue ahí; también con un bloque ×N.
- [ ] v61: en un día, «▶ vídeo» de un ejercicio con vídeo de YouTube lo despliega debajo del nombre (sin abrir la edición); «✕ vídeo» lo cierra; un enlace que no es de YouTube muestra «▶ Abrir vídeo».
- [ ] A 1440, 1920 y 2560 px (v60): la app se amplía (zoom 1,12 / 1,25 / 1,45) sin barra horizontal; la semana en 7 columnas; ficha, Ayuda y modo entreno caben enteros en la pantalla.

## 15. Publicación
- [ ] VERSION_APP (app.js), VERSION (sw.js), Novedades y Ayuda actualizados.
- [ ] GitHub → Actions → «pages build and deployment» termina en verde.
- [ ] La web sirve la versión nueva (Ayuda → Novedades). Si el despliegue falla o tarda más de 10 minutos, relanzarlo con un commit mínimo (subir VERSION en sw.js).
- [ ] Solo después de pasar todo en la beta, copiar los mismos archivos a la principal y repetir 1, 9 y 15 allí.

## v143 · Organización de Plan e informes
- [ ] Plan abre en «Crear o importar» y permite cambiar entre Crear o importar, Mis entrenamientos y Ajustes y datos; cada sección muestra solo sus apartados y recuerda la elección.
- [ ] Importar carreras se distingue con «Elegir archivo de carrera…» y abre el selector; importar un FIT/GPX/TCX/CSV de prueba conserva el comportamiento actual.
- [ ] Marcas → Resumen descargable permite elegir semana, mes o año y fecha de referencia; el HTML descargado muestra el intervalo, días activos, series, distancia, tiempo, desnivel y mejores resultados registrados, y se puede imprimir/guardar como PDF.
- [ ] En móvil y ordenador, controles de Plan e informe caben en pantalla y los apartados no aparecen duplicados al cambiar de grupo.

## v144 · Navegación principal
- [ ] La pestaña «Entrenamientos» contiene el selector Listas / Crear o importar / Mis entrenamientos; Listas conserva las listas y Mis entrenamientos abre plantillas, mesociclos y rutinas tipo.
- [ ] «Ajustes» abre ajustes y datos con molestias, copia, ajustes del dispositivo, sugerencias y Usuarios; Usuarios solo aparece para el administrador y nunca bajo Mis entrenamientos.
- [ ] Al cambiar pestañas y recargar, se conserva el apartado de Entrenamientos seleccionado; los botones y paneles funcionan en móvil y ordenador.

## v145 · Fusión de calentamientos
- [ ] Fusionar dos entrenos con una parte «Calentamiento» en cada uno pregunta si unirla o mantenerlas separadas.
- [ ] «Unir» deja una única parte Calentamiento; «Mantener separados» deja la del segundo como «Calentamiento (nombre del entreno)».
- [ ] Si solo uno o ninguno tiene calentamiento, la fusión continúa sin pregunta; partes, bloques y ejercicios vacíos conservan su asociación correcta.

## v146 · Tamaño de controles del resumen
- [ ] En ordenador, selector de periodo y fecha de referencia tienen la misma altura; Descargar resumen no se estira.
- [ ] En móvil, los controles se apilan con botones cómodos de pulsar; el icono de calendario tiene tamaño suficiente.

## v147 · Contraste de texto en gráficas
- [ ] En modo oscuro, valor y fechas de las gráficas se leen con texto claro; línea, puntos y área conservan el color de acento.
- [ ] En modo claro, las etiquetas de las gráficas mantienen el contraste del tema.

## v148 · Vista inicial plegada
- [ ] Primera visita: días de la semana, secciones de Plan/Entrenamientos/Ajustes, apartados de Marcas, tipos de Ejercicios y listas empiezan plegados.
- [ ] Desplegar manualmente contenido sigue funcionando y se recuerda; buscar un ejercicio abre los resultados correspondientes.

## v149 · Secciones de administrador
- [ ] En Entrenamientos → Crear o importar, Sugerencias y Usuarios quedan ocultos incluso después de actualizar/sincronizar el contenido.
- [ ] En Ajustes aparecen para el administrador; Usuarios no aparece para cuentas normales.

## Rendimiento (de referencia)
Con un año simulado (≈3.300 series), en el Mac: abrir la app ≈ 25 ms, pintar la semana ≈ 15–18 ms, un día ≈ 7 ms, Marcas ≈ 7 ms.
Si alguna cifra se multiplica por 3 o más en una versión nueva, revisar antes de publicar.


## v150 · Plegado al abrir
- [ ] Cerrar y volver a abrir la aplicación: días, grupos, partes, listas, apartados de Ejercicios, Marcas, Entrenamientos y Ajustes arrancan plegados, aunque se hubieran desplegado en la sesión anterior.
- [ ] Desplegar y plegar durante la sesión funciona y no modifica ni borra los datos de entrenamiento.

## v151 · Evitar ejercicios duplicados
- [ ] Crear un ejercicio con el mismo nombre (ignorando mayúsculas, tildes y espacios) y el mismo tipo reutiliza el existente.
- [ ] El mismo nombre con otro tipo sigue pudiendo crearse como entrada aparte.

## v153–v154 · Navegación, descargas y tema oscuro (pendiente de prueba en móvil)
- [ ] En un iPhone estrecho, abrir un día: el nombre y la fecha se ven completos; «Semana», anterior, «Hoy» y siguiente caben en una franja ordenada.
- [ ] En el día de hoy, «Hoy» permanece visible; en otro día, tocar «Hoy» lleva al día actual.
- [ ] Cambiar entre las cinco pestañas inferiores: el rótulo largo de Entrenamientos puede partirse limpiamente y la pestaña activa destaca sin desplazar los otros botones.
- [ ] Marcas → Resumen descargable → Descargar resumen: ofrece HTML y PDF; HTML se descarga/compartir, PDF abre imprimir y permite guardar como PDF; cancelar la impresión no cambia datos.
- [ ] En vistas previas de plantillas y entrenamientos, cada parte (calentamiento, principal, vuelta a la calma) se puede plegar y desplegar; ejercicios sin parte siguen visibles.
- [ ] En modo oscuro, el acento de la app se ve verde salvia y el fondo/paneles conservan el contraste; comprobar texto, botones, días, resumen y pestaña activa.
- [ ] En móvil, tirar hacia abajo desde el inicio de la página no arrastra la cabecera de la app ni activa el rebote de actualización; el scroll normal hacia arriba y abajo sigue funcionando.

## v155 · Partes de carreras importadas
- [ ] En un entreno importado con «Calentamiento carrera», «Series» y/o «Vuelta a la calma», cada tarjeta tiene una flecha para plegar y desplegar sus detalles, también en móvil.
- [ ] Plegar una tarjeta no oculta ni modifica las otras partes; el botón del nombre sigue abriendo la edición y las series conservan sus datos.
