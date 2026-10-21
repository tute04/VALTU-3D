# Prueba de pedidos y cobros en navegador

Desde la raíz del proyecto, con Node >=22.13, dependencias instaladas y Chromium disponible. Playwright se puede instalar fuera del proyecto para mantener intacto el lockfile:

```bash
npm install --prefix /tmp/valtu-browser-tools --no-save --package-lock=false playwright@1.64.1
VALTU_PLAYWRIGHT_MODULE=/tmp/valtu-browser-tools/node_modules/playwright/index.mjs \
VALTU_CHROMIUM=/usr/bin/chromium \
node tests/browser/smoke.mjs
```

La prueba se ejecutó con Playwright 1.64.1 obtenido mediante npm exec en caché temporal, Chromium del sistema y Node 24.19.0. `VALTU_PLAYWRIGHT_MODULE` permite indicar la ruta del módulo instalado externamente; sin esa variable se resuelve el paquete `playwright` normalmente. No requiere acceso a Sites, tokens ni cuentas reales.

## Qué ejecuta

- Arranca un servidor de prueba únicamente en `127.0.0.1`, con la interfaz Workspace original.
- Compila los handlers reales de `/api/data`, sustituyendo solo identidad de plataforma y binding D1 por un propietario ficticio fijo y un adaptador SQLite en memoria. No hay bypass de autenticación en el código de aplicación.
- Aplica las migraciones existentes a esa memoria. Crea pedidos y pagos ficticios usando la API.
- Usa Chromium sin interfaz en tamaños 1440×1000 y 390×844. El tamaño móvil verifica comportamiento adaptable, no es una prueba en un dispositivo físico.
- Registra un pago parcial de $300 sobre $1.000; simula que se pierde la respuesta después de confirmar y reintenta. Comprueba que persiste un solo cobro.
- Completa el saldo de $700 en otra cuenta, recarga y verifica persistencia en el servidor de prueba y producción intacta.
- Cancela el pedido mediante la API y registra el reintegro por la interfaz.
- Abre otro cobro y simula un pago concurrente. Verifica rechazo por saldo, conservación del formulario y saldo actualizado al volver a abrir.
- Recorre filtros de reintegros y entregados por cobrar, comprueba ausencia de errores JavaScript y desborde horizontal de página/lista/formulario.
- Cierra el navegador, servidor y base en memoria, también si hay un error.

No usa ni lee respaldos reales, `.openai/hosting.json`, credenciales ni D1 remoto. No comprueba el servicio de inicio de sesión de ChatGPT ni la frontera del proxy autenticado de Sites. La equivalencia del adaptador SQLite con D1 real no se da por garantizada. No publica ni migra producción.

La prueba de navegador se ejecuta explícitamente; `node --test tests/*.test.mjs` ejecuta las pruebas de negocio y componentes existentes, no este harness.
