# Recuperación del proyecto original

Fecha: 20 de octubre de 2026.

## Procedencia y conservación

Se recibió `VALTU_3D_Codigo_original.zip` y se validaron sus rutas y tipos antes de extraerlo a una ubicación separada. Se recuperaron 114 archivos en `/workspace/VALTU-3D`, manteniendo idénticos sus contenidos. El manifiesto `RECUPERACION-MANIFEST.json` registra SHA-256 del ZIP y de cada archivo. El historial `.git` original no está incluido: el commit declarado por la exportación no está verificado. Se conserva el historial del repositorio de destino.

El README original mínimo fue sustituido por el README recuperado; sigue disponible en Git y en el respaldo inicial. Los documentos anteriores registran el estado previo y no describen la aplicación recuperada.

Una búsqueda de patrones comunes de claves privadas, tokens GitHub y claves API no encontró coincidencias; no constituye una auditoría exhaustiva de secretos. No se encontraron bases de datos ni archivos de entorno en el ZIP. `.openai/hosting.json` contiene la identidad del Site y su binding D1, y se conservó intacto. No se ejecutó ningún despliegue.

## Arquitectura comprobada en código

- TypeScript, React 19, Vinext/Vite, interfaz compatible con Next App Router.
- Cloudflare Workers, binding D1 `DB`, Drizzle y tres migraciones SQL existentes.
- Inicio de sesión delegado a Sites: página protegida con cabecera de correo y API con `oai-authenticated-user-id`.
- Clientes, materiales, pedidos, caja, consumos, productos, compras, configuración y metadatos de restauración.
- Propiedad por `owner`, no organizaciones ni membresías. Cada identidad actual necesita una correspondencia explícita antes de migrar a negocios.
- Importes en centavos enteros; fecha comercial en Córdoba. Verificar límites y decisiones de negocio al ampliar a otras monedas y zonas horarias.

Las cabeceras de identidad solo son confiables detrás del servicio de autenticación que las inserta y elimina las enviadas por clientes. No publicar el Worker directamente ni sustituir esa frontera por una cabecera enviada desde el navegador. No hay alta de correo/contraseña, roles o invitaciones implementadas en este proyecto.

## Validación ejecutada en esta instancia

Node 24.19.0 y npm 11.9.0. Desde `/workspace/VALTU-3D`:

```bash
npm ci --cache /workspace/VALTU-3D/.sites-runtime/npm-cache --fetch-retries=0 --fetch-timeout=30000
./node_modules/.bin/tsc --noEmit --incremental false
WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=/workspace/VALTU-3D/.wrangler/build.log XDG_CONFIG_HOME=/workspace/VALTU-3D/.sites-runtime/xdg-config ./node_modules/.bin/vinext build
node --test tests/*.test.mjs
```

Resultados: instalación, TypeScript y build aprobados; 15 pruebas aprobadas, 0 fallidas y 0 omitidas. Las pruebas usan SQLite aislado y handlers reales con adaptadores de autenticación/D1; no acceden a producción ni prueban la identidad real de Sites. El mensaje `UNIQUE constraint failed: cash.id` aparece en una prueba negativa de restauración que pasa.

Para iniciar desarrollo:

```bash
WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=/workspace/VALTU-3D/.wrangler/dev.log XDG_CONFIG_HOME=/workspace/VALTU-3D/.sites-runtime/xdg-config ./node_modules/.bin/vite --host 127.0.0.1
```

Comprobado por HTTP local: `/api/data` sin sesión responde 401 y `/` responde 307 hacia `/signin-with-chatgpt?return_to=%2F`. El login de Sites no existe en el servidor local; seguir la redirección termina en 404. No se validó una sesión real ni el uso interactivo de la aplicación. El emulador avisó que no pudo obtener metadatos `Request.cf` y siguió con valores de sustitución; esto no impidió las comprobaciones locales.

Se utilizaron comandos directos: los helpers exportados cambian HOME y el ZIP no preserva sus permisos ejecutables. No se usaron ni se modificaron esos helpers, ni se modificó el lockfile. Los comandos anteriores son los verificados en esta instancia.

## Respaldo real que debe conservarse

En la aplicación publicada, iniciar sesión con la cuenta que posee los registros y abrir **Ajustes y copias → Descargar copia completa**. Conservar el JSON descargado en un destino privado; no subirlo a GitHub. Si hay registros bajo distintas cuentas, descargar un respaldo desde cada cuenta y registrar su procedencia sin modificar `owner`.

El código confirma un endpoint de copia autenticado, formato `valtu-3d` versión 1, y validación de propietario, referencias y saldos antes de restaurar. La descarga real todavía no fue comprobada. La suite sí comprueba recuperación con registros de prueba y rechazo de copias inválidas. El CSV de movimientos no reemplaza el JSON completo. La copia funcional tampoco es un dump físico de D1: preservar también una copia consistente del proveedor cuando se obtenga acceso administrativo autorizado.

No usar **Recuperar una copia** en producción como prueba: reemplaza los registros de la cuenta. Ensayar sobre almacenamiento aislado, verificar cantidades y totales y conservar el origen antes de cualquier migración. No compartir contraseñas ni tokens por chat. La arquitectura de organizaciones debe diseñarse antes de importar datos bajo otro sistema de identidad.

## Publicación y remoto

El código está incorporado al checkout local. No se hizo commit ni push, no se publicó una nueva versión, no se conectó esta instancia a la base real y no se ejecutaron migraciones sobre ella. La validación en una tarea nueva y la publicación del entorno son pasos separados aún no comprobados.
