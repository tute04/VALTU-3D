# Respaldo y restauración

## Copia inicial del repositorio

Copia creada antes de agregar documentación: `/workspace/backups/valtu-3d/20261020T165007Z/checkout.tar.gz`.

Verificar y restaurar en un directorio NUEVO, sin sobrescribir trabajo existente:

```bash
cd /workspace/backups/valtu-3d/20261020T165007Z
sha256sum -c SHA256SUMS
restore_dir=$(mktemp -d /workspace/valtu-restore-XXXXXX)
tar -xzf checkout.tar.gz -C "$restore_dir"
git -C "$restore_dir/VALTU-3D" fsck --full
git -C "$restore_dir/VALTU-3D" rev-parse HEAD
```

HEAD esperado: `12bce4843febd1d2d1bce14a76b8bf51380d809b`.

El procedimiento fue ejercitado mediante extracción temporal y comparación de todos los archivos, además de validación Git. No cambiar automáticamente el checkout activo por la restauración. Esta copia no incluye los documentos creados después de la auditoría ni datos de la app publicada.

## Datos comerciales: pendiente de acceso

No hay un respaldo de producción disponible. No existe todavía un procedimiento verificado para recuperar clientes, pedidos, cobros, inventario o archivos de la aplicación existente.

Cuando se identifique el almacenamiento:

1. Obtener un respaldo consistente mediante las herramientas soportadas por el proveedor; incluir archivos privados y su relación con registros.
2. Guardar fecha, versión del esquema, cantidades, totales de control e integridad de los archivos. Proteger y limitar el acceso a la copia.
3. Restaurar en un entorno aislado sin envío de correos ni operaciones externas y comprobar relaciones, importes y archivos.
4. Ensayar la migración sobre esa restauración y documentar cómo revertir sin perder operaciones nuevas.
5. Acordar ventana de corte y autorización antes de intervenir producción.

No generar órdenes SQL de reversión sin conocer el esquema. Una copia local del código no reemplaza el respaldo de la base de datos ni los archivos del negocio.

## Actualización después de recuperar el código

El código fue recuperado desde un ZIP sin datos comerciales. Consultar `RECUPERACION.md` para descargar la copia JSON desde **Ajustes y copias** y para las pruebas de restauración aislada que ya pasaron. El respaldo de producción sigue pendiente.
