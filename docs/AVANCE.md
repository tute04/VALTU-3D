# Avance

## Etapa 1: código recuperado y respaldo recibido validado en aislamiento

Completado:
- Checkout previo conservado y restauración comprobada.
- 114 archivos originales recuperados desde el ZIP, con igualdad de contenido SHA-256 por archivo y manifiesto de procedencia.
- Instalación con lockfile, compilación, TypeScript y 15 pruebas existentes aprobadas.
- Identificados almacenamiento D1 y autenticación delegada a ChatGPT Sites.
- Identificada descarga de copia completa y validación/restauración transaccional existente.

Validación adicional completada:
- Copia JSON real recibida y preservada fuera de Git.
- Esquema, restauración en memoria, comparación de datos, idempotencia, aislamiento e integridad comprobados; ver VALIDACION-RESPALDO.md.

Pendiente de operación:
- Mantener una copia privada independiente del entorno.
- QA de navegador y acceso autenticado real en Sites.
- No se comprobó restauración contra D1 real ni se modificó producción.

## Prioridad actual: Valtu para los dos hermanos

Por decisión del usuario, posponer registro público, organizaciones, invitaciones y roles. Primero mejorar pedidos y cobros, luego caja/insumos, cotización y producción según el uso diario. Reutilizar el código existente, preservar datos y probar cambios con datos sintéticos. El acceso compartido entre los dos hermanos deberá respetar la autenticación actual; no eliminar aislamiento por owner.

No se publicó, no se ejecutaron migraciones en producción y no se subió el código al remoto. La recuperación está disponible en el checkout para revisión.

## Primera mejora: pedidos y cobros

Implementado en el checkout local:
- Resumen global por cobrar, entregados con saldo y reintegros de cancelados; explícitamente independiente del filtro de lista.
- Estado de pago separado de producción: sin cobrar, pago parcial, saldado y reintegro pendiente.
- Accesos a cobrar y reintegrar desde la lista.
- Formulario con total, cobrado neto y saldo posterior al importe ingresado. Acción para completar el saldo.
- Validación cliente de importes positivos, centavos enteros y límite disponible; el servidor conserva su validación transaccional existente.

Verificación: TypeScript y compilación aprobados; 20 pruebas aprobadas (15 existentes y 5 nuevas). Las nuevas prueban pagos parciales, anulaciones, reintegros, presupuestos, entregados, centavos, límites y cambio de saldo concurrente. Sin cambios de esquema, dependencias o datos comerciales.

Pendiente: comprobación interactiva de escritorio/celular con sesión real de Sites. Prueba manual recomendada, solo con datos ficticios: crear pedido confirmado de $1.000, registrar $300, verificar pago parcial y saldo $700; completar $700 y verificar saldado; cancelar otro pedido con seña y comprobar su reintegro. Confirmar que esto no cambia producción ni genera consumo de materiales. No se publicó esta mejora ni se hizo push.

## Continuación: 21 de octubre de 2026

- Resúmenes de cobros convertidos en accesos a filtros: entregados con saldo y cancelados con reintegros pendientes. Pulsarlos limpia la búsqueda para mostrar todos los casos correspondientes.
- Cálculo de la lista filtrada unificado para no repetir condiciones.
- Prueba de navegador reproducible en `tests/browser/smoke.mjs`, con guía en `tests/browser/README.md`. Ejecutada correctamente en Chromium a 1440 y 390 px con datos sintéticos y handlers reales sobre SQLite en memoria.
- Flujos comprobados: pago parcial, pérdida de respuesta después de confirmar, reintento sin duplicado, pago del saldo, recarga, reintegro y rechazo de cobro concurrente conservando el formulario. Estado de producción no alterado por cobros. Sin errores JS ni desborde horizontal en las pantallas comprobadas.
- Sigue pendiente la comprobación con autenticación real y D1 de Sites. La prueba aislada no permite afirmar que eso se haya verificado.
- No se publicó, no se migraron datos reales, ni se modificaron dependencias o el lockfile.
