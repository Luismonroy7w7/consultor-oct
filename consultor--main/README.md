# Ruta de Comercios

Aplicación web local para visualizar comercios, ordenar por cercanía, crear rutas y registrar visitas.

## Iniciar

Desde esta carpeta, abre PowerShell y ejecuta:

```powershell
py -m http.server 4173
```

Después abre `http://localhost:4173` en el navegador. Pulsa **Usar mi ubicación** y permite el acceso a ubicación. La opción **Abrir ruta** envía los comercios seleccionados a Google Maps.

Los registros de visita (motivo, notas y fecha) se guardan en el navegador de este equipo. El archivo CSV original no se modifica.
