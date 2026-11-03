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

## 3. Marcar, deshacer y deslizar
- [ ] Marcar una serie como hecha tocando su círculo; el número de la serie aparece.
- [ ] «Deshacer» en el aviso la deja como estaba.
- [ ] Desmarcar: tocar el número o ✓ de una serie hecha la vuelve pendiente.
- [ ] Deslizar a la derecha marca o desmarca; deslizar a la izquierda borra (con «Deshacer»).
- [ ] Borrar una serie y deshacer.

## 4. Bloques ×N
- [ ] «+ Bloque» con 2 ejercicios × 3 rondas: se crean las rondas en orden.
- [ ] Marcar una ronda; el progreso del bloque sube.

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

## 12. Sugerencias
- [ ] Enviar una sugerencia de prueba desde «Enviar sugerencia».
- [ ] (Administrador) Plan → Sugerencias: aparece; marcarla como leída; borrarla y deshacer.

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
