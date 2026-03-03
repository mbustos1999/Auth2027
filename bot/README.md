# Bot de Discord - Auth 2027

Este bot se encarga de **vincular tu cuenta de Discord** con el usuario que inicia sesión en Auth 2027 usando Supabase.

## 1. Requisitos

- Node.js 18+ instalado.
- Proyecto de Supabase configurado con la tabla `user_discord_links` (la que creaste para guardar:
  `wp_user_id`, `email`, `link_code`, `discord_id`, `discord_username`, `roles`, `status`, etc.).
- Bot de Discord creado en el [Developer Portal](https://discord.com/developers/applications) con su **TOKEN**.

## 2. Instalación

```bash
cd bot
npm install
```

## 3. Configuración

1. Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

2. Rellena `.env` con tus datos reales:

- `DISCORD_BOT_TOKEN`: token del bot de Discord.
- `SUPABASE_URL`: URL de tu proyecto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: **service role key** de Supabase (solo en el servidor, nunca en la app Electron).
- `GUILD_ID` (opcional): ID del servidor donde quieres que funcione el comando `!link`.

## 4. Ejecución

```bash
cd bot
npm run start
```

El bot se conectará y escuchará mensajes en el servidor configurado.

## 5. Comando `!link`

El flujo es:

1. El usuario inicia sesión en Auth 2027.
2. La app registra/actualiza un registro en `user_discord_links` y muestra un **código de enlace** en la pestaña Perfil.
3. En Discord, el usuario escribe en un canal del servidor:

```text
!link CODIGO
```

4. El bot:
   - Busca en Supabase la fila con ese `link_code`.
   - Si existe y no está ya vinculada, actualiza:
     - `discord_id`
     - `discord_username`
     - `roles` (roles actuales del usuario en el servidor)
     - `status = 'linked'`
   - Responde con un mensaje de confirmación.

5. De vuelta en Auth 2027, el usuario pulsa **"Comprobar estado"** en la pestaña Perfil y la app vuelve a leer Supabase para mostrar:
   - Usuario de Discord vinculado.
   - Roles guardados.

