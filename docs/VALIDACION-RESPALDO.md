# Validación del respaldo recibido

Fecha: 20 de octubre de 2026.

Se recibió una copia JSON de la aplicación original y se conservó, con permisos restringidos, fuera del checkout. El archivo y los resultados privados no se incorporaron a Git. No se muestran identidades, contactos, notas ni importes en este informe.

## Comprobaciones ejecutadas

- Formato `valtu-3d`, versión 1, validado con el esquema real de la aplicación.
- Migraciones SQL existentes aplicadas únicamente a SQLite en memoria con claves foráneas habilitadas.
- Restauración transaccional mediante la función original `restoreBackup`.
- Nueva exportación con `makeBackup` y comparación completa de los datos comerciales normalizados. Se excluyen del comparador las revisiones técnicas que la restauración incrementa deliberadamente y la propiedad reinyectada por el servidor; no se excluyen importes, fechas, relaciones ni contenido de los registros.
- Repetir la misma operación no modifica los datos ni vuelve a incrementar revisiones.
- Una identidad distinta lee listas vacías y no puede restaurar la copia ajena.
- Integridad SQLite y referencias comprobadas.

Todo lo anterior pasó. No se modificó la base publicada ni se accedió a ella. Este ensayo usa un adaptador SQLite aislado; no demuestra una restauración en Cloudflare D1 real, ni que la copia incluya cambios posteriores a su descarga. La base de ensayo en memoria fue cerrada tras las verificaciones.

## Conservación

El original recibido está en los adjuntos de esta instancia y se hizo una copia adicional privada en `/workspace/private-valtu`, fuera de Git. Esto no es un respaldo remoto independiente ni garantiza permanencia después de descartar el entorno. El usuario debe conservar su descarga original en un destino privado propio. No subir los JSON comerciales ni bases de datos a GitHub.

## Alcance acordado

Primero mejorar Valtu para su uso diario por los dos hermanos. Registro público, múltiples negocios, invitaciones y roles quedan pospuestos. Conservar autenticación y aislamiento existentes hasta decidir y probar cómo compartir el acceso del equipo. No publicar ni migrar producción sin autorización.

La próxima mejora se centra en pedidos y cobros, reutilizando la aplicación existente y trabajando con datos sintéticos. El respaldo real no debe convertirse en un fixture versionado o información de demostración.
