# Mejoras visuales preparadas para beta

El archivo `estilos.css` ya incluye los ajustes pedidos para la vista móvil:

- Resumen semanal y molestias/lesiones quedan apilados y ocupan el ancho disponible.
- Ambos paneles conservan el formato plegable. El resumen semanal ya lo era y mantiene su estado guardado.
- En móvil, el resumen semanal se distingue con un fondo verde suave y una banda lateral verde; molestias y lesiones llevan un fondo cálido y una banda coral. Así se leen como paneles de información distintos de las tarjetas neutras de los días.
- En móvil, el encabezado de cada categoría abierta en Ejercicios permanece accesible al desplazarse por su lista y deja de fijarse al llegar al final de esa categoría, para que no se apilen varios encabezados.
- El acabado general ahora tiene sombras suaves en paneles, un fondo con halo de color muy sutil, franjas de color por categoría y estados de interacción más claros. Se respetan el modo oscuro, el contraste alto y la preferencia de movimiento reducido.
- Pulsaciones y Bilbo usan colores más fáciles de distinguir en modo oscuro y claro.
- Los valores de zonas de pulso y las próximas sesiones de Bilbo tienen más contraste en modo oscuro.

Para publicar, sustituye `beta/estilos.css` en el repositorio con este `estilos.css` y sube el cambio a la rama beta. No requiere cambios de SQL ni toca datos.

No subir `app.js`, `index.html` ni `sw.js` para este ajuste: no se han modificado.
