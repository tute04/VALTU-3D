# Valtu 3D · Auditoría inicial

> Registro histórico anterior a la entrega del ZIP. El código ya fue recuperado; consultar RECUPERACION.md para el estado actual.

Fecha: 20 de octubre de 2026. Alcance: etapa 1, auditoría y preservación.

## Evidencia disponible

- Repositorio: `tute04/VALTU-3D`, commit `12bce4843febd1d2d1bce14a76b8bf51380d809b`.
- La única rama remota encontrada es `main`; coincide con el commit local. La rama de trabajo local se llama `work`.
- Antes de esta etapa no había cambios locales ni archivos sin seguimiento.
- El árbol del commit contiene únicamente `README.md`, con el título del proyecto.
- No hay instrucciones AGENTS.md, aplicación, manifiestos, dependencias, pruebas, migraciones ni configuración de despliegue disponibles para inspeccionar.
- El acceso Git de lectura funcionó usando la autenticación existente.

## Aplicación publicada y referencia

Aplicación indicada por el usuario: https://valtu-gestion.matebonavia.chatgpt.site/
Referencia indicada: https://www.comunidaderexit3d.com/platform/calculator

Los intentos de lectura HTTPS de ambos sitios recibieron `Tunnel connection failed: 403 Forbidden` del proxy. Esto no demuestra que las aplicaciones estén caídas. No se ha inspeccionado su interfaz, código o comportamiento.

## Arquitectura, datos y capacidades

Arquitectura, tecnologías, proveedor de identidad, base de datos, almacenamiento de archivos y despliegue: desconocidos. Un dominio publicado no permite deducirlos.

No se encontraron datos comerciales en este checkout. Esto no demuestra que no existan datos en la aplicación publicada, en un servidor o en el navegador de sus usuarios.

No es posible clasificar funciones de la aplicación existente como reales o simuladas con la evidencia disponible. No se han validado autenticación, aislamiento, caja, inventario, producción ni cotización. No se eligió una arquitectura nueva: primero se necesita inspeccionar el proyecto exportado para reutilizarlo cuando corresponda.

## Preservación realizada

Se archivó el checkout completo antes de crear estos documentos, incluyendo archivos ocultos y metadatos Git. Se verificaron su SHA-256, la igualdad de los archivos restaurados en un directorio temporal y `git fsck --full` de la restauración.

La copia conserva el repositorio mínimo; NO es un respaldo de los datos de la app publicada. No se ejecutaron migraciones ni se modificó producción.

Ubicación de esta copia en la instancia:

`/workspace/backups/valtu-3d/20261020T165007Z/checkout.tar.gz`

El archivo `SHA256SUMS` está junto a la copia. La permanencia de esa ruta fuera de esta instancia no está verificada; descargar o conservar la copia en un destino de respaldo antes de descartar el entorno.

## Acceso que falta para completar la etapa

1. Exportación del proyecto original desde la herramienta donde se creó, con código, manifiestos y configuración sin secretos; subirlo a este repositorio o adjuntar un ZIP.
2. Identificar dónde persisten los datos actuales. Si hay base de datos: proveedor, esquema y mecanismo autorizado de respaldo/exportación. Si usa almacenamiento del navegador: exportación desde el navegador original antes de cambiar de dominio, borrar caché o sustituir la aplicación.
3. Para inspección visual, capturas de Valtu y la referencia mientras el acceso web esté bloqueado. Las capturas no sustituyen al código ni al respaldo.

No solicitar contraseñas, tokens ni datos de clientes por chat. Cualquier acceso autenticado necesario debe configurarse por el mecanismo seguro del entorno. No hacer pública la información comercial para facilitar la inspección.

## Condición para migrar

Antes de migrar: identificar origen y propietario, conservar un respaldo independiente, restaurarlo en un entorno aislado, comparar cantidades y totales, y definir una correspondencia explícita de todos los registros con la organización Valtu. Mantener identificadores y procedencia para evitar duplicados. Resolver registros sin organización antes de habilitar altas de terceros. Probar aislamiento en servidor y archivos con dos negocios independientes.

No ejecutar cambios destructivos ni publicar sin autorización. La estrategia exacta de migración y reversión depende del almacenamiento real y sigue pendiente.
