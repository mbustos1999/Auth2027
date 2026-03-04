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
  // 1) Intentar siempre por id (soporta UUID o numérico)
  try {
    const { data, error } = await supabase
      .from('user_discord_links')
      .select('*')
      .eq('id', state)
      .maybeSingle();

    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.error('Supabase error (findLinkRowByState/id-string):', err);
  }

  // 2) Si es numérico, reintentar casteando a Number (por compatibilidad con ids antiguos)
  if (/^\d+$/.test(state)) {
    try {
      const { data, error } = await supabase
        .from('user_discord_links')
        .select('*')
        .eq('id', Number(state))
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.error('Supabase error (findLinkRowByState/id-number):', err);
    }
  }

  // 3) Si contiene @, interpretarlo como email
  if (state.includes('@')) {
    try {
      const { data, error } = await supabase
        .from('user_discord_links')
        .select('*')
        .eq('email', state)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.error('Supabase error (findLinkRowByState/email):', err);
    }
  }

  // 4) Último intento: interpretar como link_code
  try {
    const { data, error } = await supabase
      .from('user_discord_links')
      .select('*')
      .eq('link_code', state)
      .maybeSingle();

    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.error('Supabase error (findLinkRowByState/link_code):', err);
  }

  return null;
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
  if (!row || !row.email) return row;
  if (row.mercadopago_status || row.mercadopago_data) return row;

  const updated = await fetchMercadoPagoAndUpdateRowForEmail(row.email).catch(() => null);
  return updated || row;
}

async function fetchMercadoPagoAndUpdateRowForEmail(email) {
  if (!email) return null;

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

  if (tokensToUse.length === 0) return null;

  const searchUrlBase = `https://api.mercadopago.com/preapproval/search?payer_email=${encodeURIComponent(
    email
  )}`;

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

  let statusToSave = 'not_found';
  let dataToSave = { results: [], sources: [], paging: null };
  let anyError = false;

  const found = results.filter((r) => r.ok && r.status === 'found');
  if (found.length > 0) {
    const allPreapprovals = found.flatMap((r) =>
      r.data && Array.isArray(r.data.results) ? r.data.results : []
    );

    if (!Array.isArray(allPreapprovals) || allPreapprovals.length === 0) {
      statusToSave = 'not_found';
      dataToSave = {
        results: [],
        sources: found.map((r) => r.data?.source).filter(Boolean),
        paging: null
      };
    } else {
      function pickBestPreapproval(preapprovals) {
        if (!Array.isArray(preapprovals) || preapprovals.length === 0) return null;
        const now = new Date();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        let bestActive = null;

        for (const pre of preapprovals) {
          const rawStatus = String(pre.status || '').toLowerCase();
          const endDateStr =
            pre.end_date ||
            (pre.auto_recurring && pre.auto_recurring.end_date) ||
            null;

          let endDate = null;
          let notExpired = false;
          if (endDateStr) {
            const d = new Date(endDateStr);
            if (!Number.isNaN(d.getTime())) {
              endDate = d;
              notExpired = d >= now;
            }
          }

          const isActive =
            rawStatus === 'authorized' ||
            (notExpired && (rawStatus === 'cancelled' || rawStatus === 'pending'));

          if (isActive) {
            if (!bestActive || (endDate && bestActive.endDate && endDate > bestActive.endDate)) {
              bestActive = { pre, endDate, rawStatus, notExpired };
            } else if (!bestActive) {
              bestActive = { pre, endDate, rawStatus, notExpired };
            }
          }
        }

        if (bestActive) {
          return {
            preapproval: bestActive.pre,
            effectiveStatus: 'active',
            uiLabel: 'Sub activa',
            rawStatus: bestActive.rawStatus,
            endDate: bestActive.endDate,
            daysLeft: bestActive.endDate
              ? Math.max(0, Math.ceil((bestActive.endDate.getTime() - now.getTime()) / ONE_DAY_MS))
              : null
          };
        }

        // Si ninguna está "activa" según la lógica anterior, usar la primera como referencia
        const first = preapprovals[0];
        const rawStatus = String(first.status || '').toLowerCase();

        const endDateStrFirst =
          first.end_date ||
          (first.auto_recurring && first.auto_recurring.end_date) ||
          null;
        let endDateFirst = null;
        let daysLeftFirst = null;
        if (endDateStrFirst) {
          const d = new Date(endDateStrFirst);
          if (!Number.isNaN(d.getTime()) && d >= new Date()) {
            endDateFirst = d;
            daysLeftFirst = Math.max(
              0,
              Math.ceil((d.getTime() - new Date().getTime()) / ONE_DAY_MS)
            );
          }
        }
        let uiLabel = rawStatus || '-';
        switch (rawStatus) {
          case 'authorized':
            uiLabel = 'Sub activa';
            break;
          case 'pending':
            uiLabel = 'Sub pendiente';
            break;
          case 'cancelled':
            uiLabel = 'Sub cancelada';
            break;
          case 'paused':
            uiLabel = 'Sub pausada';
            break;
          case 'expired':
            uiLabel = 'Sub expirada';
            break;
          default:
            break;
        }

        return {
          preapproval: first,
          effectiveStatus: rawStatus || 'unknown',
          uiLabel,
          rawStatus,
          endDate: endDateFirst,
          daysLeft: daysLeftFirst
        };
      }

      const decision = pickBestPreapproval(allPreapprovals);

      statusToSave = decision ? decision.effectiveStatus : 'not_found';
      dataToSave = {
        results: allPreapprovals,
        sources: found.map((r) => r.data?.source).filter(Boolean),
        paging: null,
        meta: {
          effective_status: decision ? decision.effectiveStatus : null,
          ui_label: decision ? decision.uiLabel : null,
          raw_status: decision ? decision.rawStatus : null,
          end_date: decision && decision.endDate ? decision.endDate.toISOString() : null,
          days_left: decision && typeof decision.daysLeft === 'number' ? decision.daysLeft : null
        }
      };
    }
  } else if (results.length > 0 && results.every((r) => r.status === 'not_found')) {
    statusToSave = 'not_found';
    dataToSave = {
      results: [],
      sources: results.map((r) => r.data?.source).filter(Boolean),
      paging: null
    };
  } else if (anyError || results.length === 0) {
    statusToSave = 'error';
    dataToSave = {
      error: 'error_consultando_mercadopago',
      sources: results.map((r) => r.data?.source).filter(Boolean)
    };
  }

  try {
    // Buscar o crear fila por email
    let { data: row, error } = await supabase
      .from('user_discord_links')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('Error leyendo user_discord_links por email:', error);
      return null;
    }

    if (!row) {
      const insertRes = await supabase
        .from('user_discord_links')
        .insert({
          email,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .maybeSingle();

      if (insertRes.error) {
        console.error('No se pudo crear fila user_discord_links para email:', email, insertRes.error);
        return null;
      }
      row = insertRes.data;
    }

    const { data: updated, error: updateError } = await supabase
      .from('user_discord_links')
      .update({
        mercadopago_status: statusToSave,
        mercadopago_data: dataToSave,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id)
      .select('*')
      .maybeSingle();

    if (updateError) {
      console.error('No se pudo actualizar mercadopago_data desde el bot:', updateError);
      return row;
    }

    return updated || row;
  } catch (e) {
    console.error('Error inesperado en fetchMercadoPagoAndUpdateRowForEmail:', e);
    return null;
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

  // Gestionar roles de suscripción (Motivo)
  // 1) Obtener motivo "activo" actual
  const motivoRoleName = getMotivoRoleNameFromRow(rowWithMp);

  // 2) Lista fija de posibles nombres de rol de suscripción (motivo)
  const knownMotivoRoles = [
    'arg-1m',
    'arg-3m',
    'arg-6m',
    'Argenmod Argentina Mensual',
    'Chile-1 mes'
  ];
  const knownMotivoLower = knownMotivoRoles.map((r) => r.toLowerCase());

  const memberRoles = member.roles.cache;

  // 3) Limpiar/asignar roles de motivo en Discord:
  //    - Si hay motivo activo: asegurar ese rol y quitar otros motivos conocidos
  //    - Si no hay motivo activo: quitar todos los roles cuyo nombre sea un motivo conocido
  if (motivoRoleName) {
    const motivoLower = motivoRoleName.toLowerCase();

    // Asegurar rol del motivo actual
    await ensureRoleByName(member, motivoRoleName);

    // Quitar otros motivos conocidos que ya no apliquen
    for (const role of memberRoles.values()) {
      const nameLower = role.name.toLowerCase();
      if (knownMotivoLower.includes(nameLower) && nameLower !== motivoLower) {
        // eslint-disable-next-line no-await-in-loop
        await member.roles.remove(role).catch((err) => {
          console.error('No se pudo quitar rol de motivo antiguo:', role.name, err);
        });
      }
    }
  } else {
    // Sin sub activa: quitar todos los roles de motivo conocidos
    for (const role of memberRoles.values()) {
      const nameLower = role.name.toLowerCase();
      if (knownMotivoLower.includes(nameLower)) {
        // eslint-disable-next-line no-await-in-loop
        await member.roles.remove(role).catch((err) => {
          console.error('No se pudo quitar rol de motivo (sub finalizada):', role.name, err);
        });
      }
    }
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

    // Un Discord no puede estar anclado a dos cuentas diferentes
    const existingByDiscord = await findLinkRowByDiscordId(message.author.id);
    if (existingByDiscord && existingByDiscord.id !== row.id) {
      await message.reply('❌ Este Discord ya está anclado a otra cuenta. Usa siempre la misma cuenta de Auth 2027.');
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

// ===== Sincronización periódica de roles según Supabase + MercadoPago =====

async function syncAllLinkedUsersRoles() {
  try {
    if (!GUILD_ID) return;

    const guild = await client.guilds.fetch(GUILD_ID);

    const { data: rows, error } = await supabase
      .from('user_discord_links')
      .select('*')
      .not('discord_id', 'is', null);

    if (error) {
      console.error('Error al leer user_discord_links para sync periódico:', error);
      return;
    }

    if (!Array.isArray(rows) || rows.length === 0) return;

    for (const row of rows) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const member = await guild.members.fetch(row.discord_id).catch(() => null);
        if (!member) continue;

        // eslint-disable-next-line no-await-in-loop
        const roles = await assignRolesForLinkedUser(member, row, 'Anclado');

        // eslint-disable-next-line no-await-in-loop
        await updateDiscordLinkRow(row.id, {
          discordId: member.id,
          discordUsername: row.discord_username || member.user.username,
          roles
        });
      } catch (e) {
        console.error('Error sincronizando roles periódicamente para fila:', row.id, e);
      }
    }
  } catch (e) {
    console.error('Error global en syncAllLinkedUsersRoles:', e);
  }
}

// Ejecutar sync al arrancar y luego cada 10 minutos
client.once('ready', () => {
  syncAllLinkedUsersRoles().catch(() => {});
  setInterval(() => {
    syncAllLinkedUsersRoles().catch(() => {});
  }, 10 * 60 * 1000);
});

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

  // En hosting (Render, Railway, etc.) suelen inyectar PORT en el entorno.
  // Localmente puedes seguir usando OAUTH_SERVER_PORT o 4000 por defecto.
  const port = Number(process.env.PORT || OAUTH_SERVER_PORT) || 4000;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${port}`);

      // Endpoint interno para estado de MercadoPago
      if (url.pathname === '/mp/status') {
        const email = url.searchParams.get('email');
        if (!email) {
          res.statusCode = 400;
          res.end('Missing email');
          return;
        }

        const row = await fetchMercadoPagoAndUpdateRowForEmail(email).catch(() => null);
        if (!row) {
          res.statusCode = 500;
          res.end('No se pudo obtener estado de MercadoPago');
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            success: true,
            mercadopago_status: row.mercadopago_status || null,
            mercadopago_data: row.mercadopago_data || null
          })
        );
        return;
      }

      // --- Tarjetas del Inicio (público: cualquiera puede leer) ---
      if (url.pathname === '/home-cards' && req.method === 'GET') {
        try {
          const { data: rows, error } = await supabase
            .from('home_cards')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

          if (error) {
            console.error('Error leyendo home_cards:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'db_error', cards: [] }));
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, cards: rows || [] }));
        } catch (e) {
          console.error('Error inesperado en /home-cards:', e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, cards: [] }));
        }
        return;
      }

      // --- Admin: gestión de usuarios ---
      if (url.pathname.startsWith('/admin/')) {
        const adminEmail = url.searchParams.get('email');
        if (!adminEmail) {
          res.statusCode = 400;
          res.end('Missing email');
          return;
        }

        async function isAdminByEmail(email) {
          try {
            const { data: rows, error } = await supabase
              .from('user_discord_links')
              .select('*')
              .eq('email', email);

            if (error || !Array.isArray(rows) || rows.length === 0) {
              return false;
            }

            let bestRow = null;
            const candidates = rows.filter((r) => r && r.discord_id) || rows;

            candidates.sort((a, b) => {
              const da = a && a.updated_at ? new Date(a.updated_at).getTime() : 0;
              const db = b && b.updated_at ? new Date(b.updated_at).getTime() : 0;
              return db - da;
            });

            bestRow = candidates[0] || null;
            if (!bestRow) return false;

            const rolesArr = Array.isArray(bestRow.roles) ? bestRow.roles.map((r) => String(r)) : [];
            const rolesLower = rolesArr.map((r) => r.toLowerCase());
            const adminRoles = ['admin', '🛡️・𝑨𝑫𝑴𝑰𝑵 𝑺・🛡️'.toLowerCase()];

            const isLinkedAdmin =
              bestRow.discord_id &&
              String(bestRow.status || '').toLowerCase() === 'linked' &&
              rolesLower.some((r) => adminRoles.includes(r));

            return isLinkedAdmin;
          } catch (e) {
            console.error('Error en isAdminByEmail:', e);
            return false;
          }
        }

        async function readJsonBody(reqToRead) {
          return new Promise((resolve) => {
            let body = '';
            reqToRead.on('data', (chunk) => {
              body += chunk.toString();
              if (body.length > 1e6) {
                reqToRead.destroy();
              }
            });
            reqToRead.on('end', () => {
              try {
                const parsed = body ? JSON.parse(body) : {};
                resolve(parsed);
              } catch {
                resolve({});
              }
            });
            reqToRead.on('error', () => resolve({}));
          });
        }

        if (!(await isAdminByEmail(adminEmail))) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: 'Acceso denegado (admin requerido).' }));
          return;
        }

        if (url.pathname === '/admin/users' && req.method === 'GET') {
          try {
            const { data: rows, error } = await supabase
              .from('user_discord_links')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(500);

            if (error) {
              console.error('Error leyendo user_discord_links para /admin/users:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'db_error' }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, users: rows || [] }));
          } catch (e) {
            console.error('Error inesperado en /admin/users:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'internal_error' }));
          }
          return;
        }

        if (url.pathname === '/admin/users/update' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const { id, updates } = body || {};

          if (!id || !updates || typeof updates !== 'object') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'Parámetros inválidos.' }));
            return;
          }

          try {
            const patch = {};
            if (typeof updates.status === 'string') {
              patch.status = updates.status;
            }
            if (typeof updates.pc_name === 'string' || updates.pc_name === null) {
              patch.pc_name = updates.pc_name;
            }
            patch.updated_at = new Date().toISOString();

            const { error, data: updated } = await supabase
              .from('user_discord_links')
              .update(patch)
              .eq('id', id)
              .select('*')
              .maybeSingle();

            if (error) {
              console.error('Error en /admin/users/update:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'db_error' }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, user: updated }));
          } catch (e) {
            console.error('Error inesperado en /admin/users/update:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'internal_error' }));
          }
          return;
        }

        if (url.pathname === '/admin/users/delete' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const { id } = body || {};

          if (!id) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'Parámetros inválidos.' }));
            return;
          }

          try {
            const { error } = await supabase
              .from('user_discord_links')
              .delete()
              .eq('id', id);

            if (error) {
              console.error('Error en /admin/users/delete:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'db_error' }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            console.error('Error inesperado en /admin/users/delete:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'internal_error' }));
          }
          return;
        }

        // --- Admin: tarjetas del Inicio (CRUD) ---
        if (url.pathname === '/admin/home-cards' && req.method === 'GET') {
          try {
            const { data: rows, error } = await supabase
              .from('home_cards')
              .select('*')
              .order('sort_order', { ascending: true })
              .order('created_at', { ascending: true });

            if (error) {
              console.error('Error leyendo home_cards (admin):', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'db_error', cards: [] }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, cards: rows || [] }));
          } catch (e) {
            console.error('Error inesperado en /admin/home-cards:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, cards: [] }));
          }
          return;
        }

        if (url.pathname === '/admin/home-cards' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const { title, image_url, logo_url, description, sort_order } = body || {};

          if (!title || typeof title !== 'string') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'Falta title.' }));
            return;
          }

          try {
            const { data: inserted, error } = await supabase
              .from('home_cards')
              .insert({
                title: String(title).trim(),
                image_url: typeof image_url === 'string' ? image_url.trim() : '',
                logo_url: typeof logo_url === 'string' ? logo_url.trim() : '',
                description: typeof description === 'string' ? description.trim() : '',
                sort_order: typeof sort_order === 'number' ? sort_order : 0,
                updated_at: new Date().toISOString()
              })
              .select('*')
              .single();

            if (error) {
              console.error('Error insertando home_card:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'db_error' }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, card: inserted }));
          } catch (e) {
            console.error('Error inesperado en POST /admin/home-cards:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'internal_error' }));
          }
          return;
        }

        if (url.pathname === '/admin/home-cards/update' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const { id, title, image_url, logo_url, description, sort_order } = body || {};

          if (!id) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'Falta id.' }));
            return;
          }

          const updates = {};
          if (typeof title === 'string') updates.title = title.trim();
          if (typeof image_url === 'string') updates.image_url = image_url.trim();
          if (typeof logo_url === 'string') updates.logo_url = logo_url.trim();
          if (typeof description === 'string') updates.description = description.trim();
          if (typeof sort_order === 'number') updates.sort_order = sort_order;
          updates.updated_at = new Date().toISOString();

          if (Object.keys(updates).length <= 1) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'Incluye al menos un campo a actualizar (title, image_url, logo_url, description, sort_order).' }));
            return;
          }

          try {
            const { data: updated, error } = await supabase
              .from('home_cards')
              .update(updates)
              .eq('id', id)
              .select('*')
              .single();

            if (error) {
              console.error('Error actualizando home_card:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'db_error' }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, card: updated }));
          } catch (e) {
            console.error('Error inesperado en POST /admin/home-cards/update:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'internal_error' }));
          }
          return;
        }

        if (url.pathname === '/admin/home-cards/delete' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const { id } = body || {};

          if (!id) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'Falta id.' }));
            return;
          }

          try {
            const { error } = await supabase.from('home_cards').delete().eq('id', id);

            if (error) {
              console.error('Error eliminando home_card:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'db_error' }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            console.error('Error inesperado en POST /admin/home-cards/delete:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'internal_error' }));
          }
          return;
        }

        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: 'Not found' }));
        return;
      }

      // Endpoint interno para obtener estado completo de usuario
      if (url.pathname === '/u/state') {
        const email = url.searchParams.get('email');
        if (!email) {
          res.statusCode = 400;
          res.end('Missing email');
          return;
        }

        try {
          const { data: rows, error } = await supabase
            .from('user_discord_links')
            .select('*')
            .eq('email', email);

          if (error) {
            console.error('Error leyendo user_discord_links para /u/state:', error);
            res.statusCode = 500;
            res.end('db_error');
            return;
          }

          let bestRow = null;
          if (Array.isArray(rows) && rows.length > 0) {
            const withDiscord = rows.filter((r) => r && r.discord_id);
            const candidates = withDiscord.length > 0 ? withDiscord : rows;

            candidates.sort((a, b) => {
              const da = a && a.updated_at ? new Date(a.updated_at).getTime() : 0;
              const db = b && b.updated_at ? new Date(b.updated_at).getTime() : 0;
              return db - da;
            });

            bestRow = candidates[0] || null;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, row: bestRow }));
        } catch (e) {
          console.error('Error inesperado en /u/state:', e);
          res.statusCode = 500;
          res.end('internal_error');
        }
        return;
      }

      // Endpoint interno para verificar/anclar PC a cuenta
      if (url.pathname === '/pc/check-binding') {
        const email = url.searchParams.get('email');
        const pc = (url.searchParams.get('pc') || '').trim();

        if (!email || !pc) {
          res.statusCode = 400;
          res.end('Missing email or pc');
          return;
        }

        try {
          let { data: row, error } = await supabase
            .from('user_discord_links')
            .select('*')
            .eq('email', email)
            .maybeSingle();

          if (error) {
            console.error('Error leyendo user_discord_links para check-binding:', error);
            res.statusCode = 500;
            res.end('db_error');
            return;
          }

          let allowed = true;

          if (!row) {
            const insertRes = await supabase
              .from('user_discord_links')
              .insert({
                email,
                pc_name: pc,
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select('*')
              .maybeSingle();

            if (insertRes.error) {
              console.error(
                'No se pudo crear fila user_discord_links en check-binding:',
                email,
                insertRes.error
              );
              // Si falla la creación, por seguridad NO bloqueamos el login
              allowed = true;
            }
          } else {
            const storedPc = (row.pc_name || '').trim();
            if (!storedPc) {
              const updateRes = await supabase
                .from('user_discord_links')
                .update({
                  pc_name: pc,
                  updated_at: new Date().toISOString()
                })
                .eq('id', row.id);

              if (updateRes.error) {
                console.error(
                  'No se pudo actualizar pc_name en check-binding:',
                  row.id,
                  updateRes.error
                );
              }
            } else if (storedPc !== pc) {
              allowed = false;
            }
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ allowed }));
        } catch (e) {
          console.error('Error inesperado en /pc/check-binding:', e);
          // En caso de error inesperado, no bloqueamos el login
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ allowed: true }));
        }
        return;
      }

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

      // Un Discord no puede estar anclado a dos cuentas diferentes
      const existingByDiscord = await findLinkRowByDiscordId(discordId);
      if (existingByDiscord && existingByDiscord.id !== rowFromState.id) {
        console.error('Discord ya anclado a otra cuenta. state:', state);
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Discord ya vinculado</title>
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
        background: radial-gradient(circle at top left, #7f1d1d 0, #020617 45%, #000 100%);
        color: #e5e7eb;
      }
      .card {
        background: rgba(15, 23, 42, 0.96);
        border-radius: 20px;
        padding: 26px 30px 22px;
        max-width: 420px;
        width: 100%;
        box-shadow:
          0 18px 45px rgba(15, 23, 42, 0.95),
          0 0 0 1px rgba(248, 113, 113, 0.5);
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
        background: radial-gradient(circle at 30% 20%, #fecaca, #b91c1c);
        color: #fef2f2;
        font-size: 26px;
        box-shadow: 0 0 0 1px rgba(252, 165, 165, 0.4), 0 18px 35px rgba(15, 23, 42, 0.9);
      }
      h1 {
        font-size: 22px;
        margin-bottom: 8px;
      }
      p {
        font-size: 14px;
        color: #e5e7eb;
        margin-bottom: 16px;
      }
      .hint {
        font-size: 12px;
        color: #9ca3af;
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
        background: linear-gradient(135deg, #f97373, #ef4444);
        color: #111827;
        box-shadow: 0 10px 25px rgba(248, 113, 113, 0.45);
        transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
      }
      button:hover {
        transform: translateY(-1px);
        filter: brightness(1.03);
        box-shadow: 0 16px 35px rgba(248, 113, 113, 0.6);
      }
      button:active {
        transform: translateY(0);
        box-shadow: 0 8px 18px rgba(248, 113, 113, 0.45);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">!</div>
      <h1>Este Discord ya está anclado</h1>
      <p>
        Esta cuenta de Discord ya fue vinculada a otra cuenta de Auth 2027.<br />
        Usa siempre la misma cuenta en la app para evitar problemas.
      </p>
      <button type="button" onclick="window.close()">Cerrar esta ventana</button>
      <div class="hint">Si la ventana no se cierra sola, puedes cerrarla manualmente.</div>
    </div>
  </body>
</html>`);
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