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

## Estructura

- `main.js` — proceso principal de Electron
- `preload.js` — puente seguro (config + controles de ventana)
- `index.html` / `styles.css` / `renderer.js` — interfaz y lógica de login
- `config.js` — URL de la API
