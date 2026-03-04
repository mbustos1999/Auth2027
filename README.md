# Auth 2027

Aplicación de escritorio en Electron con login contra tu API WordPress.

## Configuración

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Configurar la URL de tu API** en `config.js`:
   - `API_BASE_URL`: URL base de tu sitio (ej: `https://tudominio.com`)
   - `AUTH_ENDPOINT`: ruta del endpoint de login (ej: `/wp-json/custom/v1/auth`)

   El endpoint debe aceptar **POST** con body JSON:
   ```json
   { "username": "usuario o email", "password": "contraseña" }
   ```
   y devolver las respuestas que ya tienes (404 usuario no existe, 401 contraseña incorrecta, 200 éxito con `user_id`, `display_name`, `user_email`).

3. **Ejecutar**
   ```bash
   npm start
   ```

## Actualizaciones automáticas (GitHub Releases)

La app comprueba si hay una versión nueva en GitHub Releases al abrirse (solo en la versión empaquetada, no en `npm start`).

**Flujo:**

1. **Desarrollo** — Modificas el código y subes los cambios a tu repo.
2. **Subir release** — En `package.json` sustituye `TU_USUARIO` por tu usuario de GitHub y el nombre del repo si es distinto. Luego:
   ```bash
   npm run build
   ```
   Esto genera el instalador en `dist/`. Crea una nueva **Release** en GitHub (p. ej. tag `v1.0.1`), sube el `.exe` (Windows) o el `.dmg` (Mac) que haya en `dist/`.
3. **Notificación** — Al abrir la app, detecta si hay una release más nueva.
4. **Actualizar** — La app descarga la actualización en segundo plano y muestra un aviso; el usuario pulsa "Reiniciar para actualizar" y la app se reinicia con la nueva versión.

**Comandos útiles:**

- `npm run build` — Genera el instalador (sin publicar).
- `npm run build:win` — Solo Windows.
- `npm run build:mac` — Solo macOS.
- `npm run release` — Build y publicar en GitHub (requiere `GH_TOKEN` y que el repo esté en GitHub).

Asegúrate de que la **versión** en `package.json` coincida con el tag de la release (ej. `"version": "1.0.1"` y tag `v1.0.1`).

## Estructura

- `main.js` — proceso principal de Electron
- `preload.js` — puente seguro (config + controles de ventana)
- `index.html` / `styles.css` / `renderer.js` — interfaz y lógica de login
- `config.js` — URL de la API
