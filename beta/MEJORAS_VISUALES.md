# Mejoras visuales preparadas para beta

El archivo `estilos.css` ya incluye los ajustes pedidos para la vista móvil:

- Resumen semanal y molestias/lesiones quedan apilados y ocupan el ancho disponible.
- Ambos paneles conservan el formato plegable. El resumen semanal ya lo era y mantiene su estado guardado.
- En móvil, el resumen semanal se distingue con un fondo verde suave y una banda lateral verde; molestias y lesiones llevan un fondo cálido y una banda coral. Así se leen como paneles de información distintos de las tarjetas neutras de los días.
- En móvil, el encabezado de cada categoría abierta en Ejercicios permanece accesible al desplazarse por su lista y deja de fijarse al llegar al final de esa categoría, para que no se apilen varios encabezados.
- En móvil, los encabezados de los días abiertos en Semana también permanecen visibles durante su contenido y se liberan al llegar al siguiente día.
- El selector Listas / Crear o importar / Mis entrenamientos queda como una banda segmentada horizontal en móvil, con una selección activa más clara.
- La barra inferior usa el mismo lenguaje de botones segmentados, con el acceso activo destacado y las cinco pestañas adaptadas al ancho del móvil.
- Al abrir un día en Semana desde el móvil, el nombre y la fecha quedan completos en una línea; los accesos para volver a la semana, cambiar de día y saltar a Hoy quedan ordenados debajo.
- Las partes de los entrenamientos se pueden plegar y desplegar en las vistas previas, también en carrera.
- En Marcas, el resumen descargable queda plegado al entrar. Al descargar, se puede elegir HTML o abrir la impresión del navegador para guardar como PDF.
- El tema oscuro usa un acento verde salvia más suave. En móvil se desactiva el rebote de sobre-desplazamiento que hacía bajar la cabecera al tirar desde arriba.
- El acabado general ahora tiene sombras suaves en paneles, un fondo con halo de color muy sutil, franjas de color por categoría y estados de interacción más claros. Se respetan el modo oscuro, el contraste alto y la preferencia de movimiento reducido.
- Pulsaciones y Bilbo usan colores más fáciles de distinguir en modo oscuro y claro.
- Los valores de zonas de pulso y las próximas sesiones de Bilbo tienen más contraste en modo oscuro.

Para publicar esta versión, sube los archivos de la app de esta carpeta a la ubicación beta correspondiente. La versión interna y la caché se actualizaron para que los móviles reciban los cambios. No requiere cambios de SQL ni toca datos.
