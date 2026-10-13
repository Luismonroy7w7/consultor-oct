# Publicar la app conectada a Google Sheets

Esta carpeta contiene el backend para la hoja compartida. Google Apps Script alojará la app en HTTPS, lo cual también corrige la geolocalización en iPhone.

1. Abre [script.new](https://script.new) con la misma cuenta que administra la hoja.
2. En el nuevo proyecto, reemplaza el contenido de `Code.gs` con el archivo `Code.gs` de esta carpeta.
3. Crea tres archivos de tipo **HTML**: `Index`, `styles` y `app`.
4. Copia, respectivamente, los contenidos de `Index.html`, `../styles.css` y `../app.js`.

5. Pulsa **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: tu cuenta. Quién tiene acceso: las personas que usarán la app (o cualquier persona con cuenta de Google si trabajarán con diferentes cuentas).
6. Autoriza el acceso a la hoja y comparte la URL de la aplicación web con el equipo. Abierta desde Safari en el iPhone, esa URL permite autorizar ubicación.

`Visitas` se creará automáticamente al guardar el primer registro; conserva la pestaña de comercios sin modificarla.
