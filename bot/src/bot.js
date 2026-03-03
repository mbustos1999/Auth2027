import 'dotenv/config';
import http from 'http';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

// ===== Configuración desde .env =====

const {
  DISCORD_BOT_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GUILD_ID,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  OAUTH_SERVER_PORT,
  MERCADOPAGO_ACCESS_TOKEN_CHILE,
  MERCADOPAGO_ACCESS_TOKEN_ARG,
  MERCADOPAGO_ACCESS_TOKEN
} = process.env;

if (!DISCORD_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan variables de entorno. Revisa bot/.env (TOKEN y SUPABASE).');
  process.exit(1);
}

// ===== Clientes =====

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.User]
});

// ===== Helpers Supabase =====

async function findLinkRowByCode(linkCode) {
  const { data, error } = await supabase
    .from('user_discord_links')
    .select('*')
    .eq('link_code', linkCode)
    .maybeSingle();

  if (error) {
    console.error('Supabase error (findLinkRowByCode):', error);
    return null;
  }

  return data || null;
}

async function updateDiscordLinkRow(rowId, { discordId, discordUsername, roles = [] }) {
  const { error } = await supabase
    .from('user_discord_links')
    .update({
      discord_id: discordId,
      discord_username: discordUsername,
      roles,
      status: 'linked'
    })
    .eq('id', rowId);

  if (error) {
    console.error('Supabase error (updateDiscordLinkRow):', error);
    throw error;
  }
}

async function findLinkRowByDiscordId(discordId) {
  const { data, error } = await supabase
    .from('user_discord_links')
    .select('*')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (error) {
    console.error('Supabase error (findLinkRowByDiscordId):', error);
    return null;
  }

  return data || null;
}

async function findLinkRowByState(state) {
  // Si el state es numérico, interpretarlo como ID
  if (/^\d+$/.test(state)) {
    const { data, error } = await supabase
      .from('user_discord_links')
      .select('*')
      .eq('id', Number(state))
      .maybeSingle();

    if (error) {
      console.error('Supabase error (findLinkRowByState/id):', error);
      return null;
    }

    return data || null;
  }

  // Si contiene @, interpretarlo como email
  if (state.includes('@')) {
    const { data, error } = await supabase
      .from('user_discord_links')
      .select('*')
      .eq('email', state)
      .maybeSingle();

    if (error) {
      console.error('Supabase error (findLinkRowByState/email):', error);
      return null;
    }

    return data || null;
  }

  // Si no es numérico ni email, interpretarlo como link_code
  const { data, error } = await supabase
    .from('user_discord_links')
    .select('*')
    .eq('link_code', state)
    .maybeSingle();

  if (error) {
    console.error('Supabase error (findLinkRowByState/link_code):', error);
    return null;
  }

  return data || null;
}

async function assignAncladoRoleAndGetRoles(member, roleName = 'Anclado') {
  let roles = [];
  if (!member?.guild) return roles;

  try {
    // Asegura que exista el rol y lo asigna (lo crea si falta)
    const ensuredRole = await ensureRoleByName(member, roleName);
    if (ensuredRole) {
      roles = await getUserRolesInGuild(member);
    } else {
      roles = await getUserRolesInGuild(member);
    }
  } catch (err) {
    console.error('Error al asignar rol Anclado:', err);
  }

  return roles;
}

async function ensureRoleByName(member, roleName) {
  if (!member?.guild || !roleName) return null;
  try {
    let role = member.guild.roles.cache.find((r) => r.name === roleName) || null;
    if (!role) {
      role = await member.guild.roles
        .create({
          name: roleName,
          reason: 'Rol de suscripción (Motivo) desde Auth 2027'
        })
        .catch((err) => {
          console.error(`No se pudo crear el rol "${roleName}":`, err);
          return null;
        });
    }
    if (role && !member.roles.cache.has(role.id)) {
      await member.roles.add(role).catch((err) => {
        console.error(`No se pudo asignar el rol "${roleName}":`, err);
      });
    }
    return role;
  } catch (err) {
    console.error(`Error en ensureRoleByName("${roleName}"):`, err);
    return null;
  }
}

async function ensureMercadoPagoDataOnRow(row) {
  if (!row || !row.email || !row.id) return row;

  const hasStatus = !!row.mercadopago_status;
  const hasData = !!row.mercadopago_data;

  const tokensToUse = [];
  if (MERCADOPAGO_ACCESS_TOKEN_CHILE) {
    tokensToUse.push({ country: 'chile', token: MERCADOPAGO_ACCESS_TOKEN_CHILE });
  }
  if (MERCADOPAGO_ACCESS_TOKEN_ARG) {
    tokensToUse.push({ country: 'argentina', token: MERCADOPAGO_ACCESS_TOKEN_ARG });
  }
  if (tokensToUse.length === 0 && MERCADOPAGO_ACCESS_TOKEN) {
    tokensToUse.push({ country: 'legacy', token: MERCADOPAGO_ACCESS_TOKEN });
  }

  // Si ya tenemos datos y no hay tokens configurados, no hacemos nada
  if ((hasStatus || hasData) || tokensToUse.length === 0) {
    return row;
  }

  const email = row.email;
  const searchUrlBase = `https://api.mercadopago.com/preapproval/search?payer_email=${encodeURIComponent(email)}`;

  async function queryWithToken(label, token) {
    try {
      const res = await fetch(searchUrlBase, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('Error consultando MercadoPago desde bot:', label, data);
        return { ok: false, status: 'error', data: { error: data.message || res.status, source: label } };
      }

      if (Array.isArray(data.results) && data.results.length > 0) {
        return {
          ok: true,
          status: 'found',
          data: { results: data.results, paging: data.paging, source: label }
        };
      }

      return { ok: true, status: 'not_found', data: { results: [], paging: data.paging, source: label } };
    } catch (e) {
      console.error('Error de red consultando MercadoPago desde bot:', e);
      return { ok: false, status: 'error', data: { error: 'network_error', source: label } };
    }
  }

  const results = [];
  for (const entry of tokensToUse) {
    // eslint-disable-next-line no-await-in-loop
    const r = await queryWithToken(entry.country, entry.token);
    if (r) results.push(r);
  }

  const found = results.filter((r) => r.ok && r.status === 'found');
  if (found.length === 0) {
    return row;
  }

  const allPreapprovals = found.flatMap((r) =>
    r.data && Array.isArray(r.data.results) ? r.data.results : []
  );

  if (!Array.isArray(allPreapprovals) || allPreapprovals.length === 0) {
    return row;
  }

  const first = allPreapprovals[0];
  const rawStatus = String(first.status || '').toLowerCase() || 'unknown';

  const dataToSave = {
    results: allPreapprovals,
    sources: found.map((r) => r.data?.source).filter(Boolean),
    paging: null,
    meta: {
      effective_status: rawStatus,
      ui_label: rawStatus === 'authorized' ? 'Sub activa' : rawStatus,
      raw_status: rawStatus
    }
  };

  const statusToSave = rawStatus;

  try {
    const { data: updated, error } = await supabase
      .from('user_discord_links')
      .update({
        mercadopago_status: statusToSave,
        mercadopago_data: dataToSave,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('No se pudo actualizar mercadopago_data desde el bot:', error);
      return row;
    }

    return updated || row;
  } catch (e) {
    console.error('Error inesperado actualizando mercadopago_data desde el bot:', e);
    return row;
  }
}

function getMotivoRoleNameFromRow(row) {
  if (!row || !row.mercadopago_data) return null;

  let data = row.mercadopago_data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      console.error('mercadopago_data no es JSON válido en fila user_discord_links:', e);
      return null;
    }
  }

  const results = Array.isArray(data.results) ? data.results : [];
  if (results.length === 0) return null;

  const now = new Date();

  function isPreapprovalActive(pre) {
    const rawStatus = String(pre.status || '').toLowerCase();
    const endDateStr =
      pre.end_date ||
      (pre.auto_recurring && pre.auto_recurring.end_date) ||
      null;

    let notExpired = false;
    if (endDateStr) {
      const d = new Date(endDateStr);
      if (!Number.isNaN(d.getTime())) {
        notExpired = d >= now;
      }
    }

    return (
      rawStatus === 'authorized' ||
      (notExpired && (rawStatus === 'cancelled' || rawStatus === 'pending'))
    );
  }

  // Buscar alguna preaprobación "activa" según la lógica de la app
  const activePre = results.find((pre) => isPreapprovalActive(pre));
  if (!activePre) return null;

  const reason =
    activePre.reason ||
    (activePre.auto_recurring && activePre.auto_recurring.reason) ||
    null;

  if (!reason || typeof reason !== 'string') return null;
  return reason.trim();
}

async function assignRolesForLinkedUser(member, row, ancladoRoleName = 'Anclado') {
  if (!member) return [];

  // Asegurarnos de tener datos de MercadoPago (si hay tokens en el bot)
  const rowWithMp = await ensureMercadoPagoDataOnRow(row);

  // Siempre rol Anclado
  await assignAncladoRoleAndGetRoles(member, ancladoRoleName);

  // Si tiene sub activa, rol Motivo (nombre = reason)
  const motivoRoleName = getMotivoRoleNameFromRow(rowWithMp);
  if (motivoRoleName) {
    await ensureRoleByName(member, motivoRoleName);
  }

  // Devolver listado actualizado de roles
  const roles = await getUserRolesInGuild(member);
  return roles;
}

// Opcional: obtiene roles "bonitos" del servidor para guardarlos como texto
async function getUserRolesInGuild(member) {
  try {
    const roles = member.roles.cache
      .filter((r) => r.name !== '@everyone')
      .map((r) => r.name);
    return roles;
  } catch {
    return [];
  }
}

// ===== Lógica del comando !link =====

client.on('messageCreate', async (message) => {
  try {
    // Ignorar bots y DMs si quieres que solo funcione en un servidor
    if (message.author.bot) return;
    if (GUILD_ID && message.guild?.id !== GUILD_ID) return;

    const content = message.content.trim();
    if (!content.toLowerCase().startsWith('!link ')) return;

    const parts = content.split(/\s+/);
    const code = parts[1]?.trim();

    if (!code) {
      await message.reply('Usa el comando así: `!link CODIGO` (lo ves en Auth 2027 > Perfil).');
      return;
    }

    await message.channel.sendTyping();

    const row = await findLinkRowByCode(code);

    if (!row) {
      await message.reply('❌ Ese código no es válido o ya fue usado. Asegúrate de copiarlo bien desde Auth 2027.');
      return;
    }

    // Si ya estaba vinculado, avisar
    if (row.status === 'linked') {
      await message.reply('✅ Ese código ya está vinculado a una cuenta de Discord.');
      return;
    }

    let roles = [];
    let member = null;
    let ancladoRoleName = 'Anclado';

    if (message.guild) {
      member = await message.guild.members.fetch(message.author.id).catch(() => null);

      if (member) {
        // Siempre rol "Anclado", y si tiene sub activa, rol "Motivo"
        roles = await assignRolesForLinkedUser(member, row, ancladoRoleName);
      }
    }

    // EN ESTE PUNTO es donde se guarda el usuario en la base de datos
    await updateDiscordLinkRow(row.id, {
      discordId: message.author.id,
      discordUsername: message.author.username,
      roles
    });

    await message.reply('✅ Rol **Anclado** asignado y tu cuenta ha sido guardada en la base de datos. Vuelve a Auth 2027 y pulsa "Comprobar estado".');
  } catch (err) {
    console.error('Error en comando !link:', err);
    try {
      await message.reply('❌ Ocurrió un error al intentar vincular tu Discord. Inténtalo de nuevo más tarde.');
    } catch (_) {}
  }
});

client.once('ready', () => {
  console.log(`Bot conectado como ${client.user.tag}`);
});

client.login(DISCORD_BOT_TOKEN);

// ===== Asignación automática al entrar al servidor =====

client.on('guildMemberAdd', async (member) => {
  try {
    if (member.user.bot) return;
    if (GUILD_ID && member.guild.id !== GUILD_ID) return;

    const row =
      (await findLinkRowByDiscordId(member.id)) ||
      null;

    if (!row) return;

    const roles = await assignRolesForLinkedUser(member, row, 'Anclado');

    await updateDiscordLinkRow(row.id, {
      discordId: member.id,
      discordUsername: row.discord_username || member.user.username,
      roles
    });
  } catch (err) {
    console.error('Error en guildMemberAdd:', err);
  }
});

// ===== Servidor HTTP para OAuth de Discord =====

function startOAuthServer() {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) {
    console.warn(
      'OAuth de Discord no configurado. Faltan DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET o DISCORD_REDIRECT_URI.'
    );
    return;
  }

  const port = Number(OAUTH_SERVER_PORT) || 4000;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${port}`);

      // Aceptar la ruta que coincida con DISCORD_REDIRECT_URI (ej. /auth/discord/callback o /discord/callback)
      const callbackPath = DISCORD_REDIRECT_URI ? new URL(DISCORD_REDIRECT_URI).pathname : '/discord/callback';
      if (url.pathname !== callbackPath && url.pathname !== '/discord/callback') {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code || !state) {
        res.statusCode = 400;
        res.end('Missing code or state');
        return;
      }

      // Intercambiar el code por un access_token
      const tokenParams = new URLSearchParams();
      tokenParams.set('client_id', DISCORD_CLIENT_ID);
      tokenParams.set('client_secret', DISCORD_CLIENT_SECRET);
      tokenParams.set('grant_type', 'authorization_code');
      tokenParams.set('code', code);
      tokenParams.set('redirect_uri', DISCORD_REDIRECT_URI);

      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenParams
      });

      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenData.access_token) {
        console.error('Error al obtener token de Discord:', tokenData);
        res.statusCode = 500;
        res.end('Error al obtener token de Discord');
        return;
      }

      // Obtener datos del usuario
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      });

      const userData = await userRes.json().catch(() => ({}));
      if (!userRes.ok || !userData.id) {
        console.error('Error al obtener usuario de Discord:', userData);
        res.statusCode = 500;
        res.end('Error al obtener usuario de Discord');
        return;
      }

      const discordId = userData.id;
      const discordUsername =
        userData.global_name ||
        (userData.username && userData.discriminator
          ? `${userData.username}#${userData.discriminator}`
          : userData.username || 'Desconocido');

      let rowFromState = await findLinkRowByState(state);

      // Si no existe fila pero el state es un email, crearla al vuelo (bot usa service_role, evita RLS)
      if ((!rowFromState || !rowFromState.id) && state.includes('@')) {
        const linkCode = Array.from({ length: 8 }, () =>
          'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
        ).join('');
        const { data: created, error: insertError } = await supabase
          .from('user_discord_links')
          .insert({
            email: state,
            link_code: linkCode,
            status: 'pending'
          })
          .select('*')
          .maybeSingle();

        if (insertError) {
          console.error('No se pudo crear fila user_discord_links para email state:', state, insertError);
        } else {
          rowFromState = created;
        }
      }

      if (!rowFromState || !rowFromState.id) {
        console.error('No se encontró fila en user_discord_links para state (ni se pudo crear):', state);
        res.statusCode = 400;
        res.end('State inválido');
        return;
      }

      const rowId = rowFromState.id;

      await updateDiscordLinkRow(rowId, {
        discordId,
        discordUsername,
        roles: []
      });

      // Intentar asignar rol Anclado inmediatamente si ya está en el servidor
      try {
        if (GUILD_ID) {
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(discordId).catch(() => null);
          if (member) {
            const roles = await assignRolesForLinkedUser(member, rowFromState, 'Anclado');
            await updateDiscordLinkRow(rowId, {
              discordId,
              discordUsername,
              roles
            });
          }
        }
      } catch (e) {
        console.error('No se pudo asignar rol tras OAuth:', e);
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Discord conectado</title>
    <style>
      :root {
        color-scheme: dark;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: radial-gradient(circle at top left, #4f46e5 0, #020617 45%, #000 100%);
        color: #e5e7eb;
      }
      .card {
        background: rgba(15, 23, 42, 0.95);
        border-radius: 20px;
        padding: 28px 32px 24px;
        max-width: 420px;
        width: 100%;
        box-shadow:
          0 18px 45px rgba(15, 23, 42, 0.9),
          0 0 0 1px rgba(148, 163, 184, 0.35);
        text-align: center;
      }
      .icon {
        width: 48px;
        height: 48px;
        border-radius: 999px;
        margin: 0 auto 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at 30% 20%, #a5b4fc, #4f46e5);
        color: #ecfeff;
        font-size: 26px;
        box-shadow: 0 0 0 1px rgba(191, 219, 254, 0.3), 0 18px 35px rgba(15, 23, 42, 0.9);
      }
      h1 {
        font-size: 22px;
        margin-bottom: 8px;
      }
      p {
        font-size: 14px;
        color: #9ca3af;
        margin-bottom: 18px;
      }
      .hint {
        font-size: 12px;
        color: #6b7280;
        margin-top: 6px;
      }
      button {
        margin-top: 4px;
        padding: 9px 16px;
        border-radius: 999px;
        border: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        background: linear-gradient(135deg, #22c55e, #4ade80);
        color: #022c22;
        box-shadow: 0 10px 25px rgba(34, 197, 94, 0.45);
        transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
      }
      button:hover {
        transform: translateY(-1px);
        filter: brightness(1.03);
        box-shadow: 0 16px 35px rgba(34, 197, 94, 0.6);
      }
      button:active {
        transform: translateY(0);
        box-shadow: 0 8px 18px rgba(34, 197, 94, 0.45);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">✓</div>
      <h1>Discord conectado correctamente</h1>
      <p>Tu cuenta de Discord se ha vinculado. Ya puedes volver a Auth 2027; la app comprobará tu estado automáticamente en unos segundos.</p>
      <button type="button" onclick="window.close()">Cerrar esta ventana</button>
      <div class="hint">Si la ventana no se cierra, puedes hacerlo manualmente.</div>
    </div>
  </body>
</html>`);
    } catch (err) {
      console.error('Error en servidor OAuth de Discord:', err);
      res.statusCode = 500;
      res.end('Error interno');
    }
  });

  server.listen(port, () => {
    console.log(`Servidor OAuth de Discord escuchando en puerto ${port}`);
  });
}

startOAuthServer();