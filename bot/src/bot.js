import 'dotenv/config';
import crypto from 'crypto';
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
  MERCADOPAGO_ACCESS_TOKEN,
  BOT_SHARED_SECRET
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

// ===== Seguridad HTTP básica (shared secret + rate limiting) =====

const SHARED_SECRET = typeof BOT_SHARED_SECRET === 'string' ? BOT_SHARED_SECRET.trim() : '';

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitBuckets = new Map();

function isRateLimited(ip, bucket, limit) {
  if (!ip || !bucket || !Number.isFinite(limit) || limit <= 0) return false;
  const now = Date.now();
  const key = `${ip}:${bucket}`;
  let entry = rateLimitBuckets.get(key);
  if (!entry) {
    entry = [];
    rateLimitBuckets.set(key, entry);
  }
  entry.push(now);
  // Limpiar ventana
  while (entry.length && now - entry[0] > RATE_LIMIT_WINDOW_MS) {
    entry.shift();
  }
  return entry.length > limit;
}

/**
 * Verifica el token de sesión (HMAC). Devuelve el email del token si es válido y no expirado; si requestEmail
 * se pasa, además debe coincidir. Si no, devuelve null.
 */
function verifySessionToken(token, requestEmail) {
  if (!SHARED_SECRET || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;
  try {
    const payloadJson = Buffer.from(parts[0], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    const exp = payload && typeof payload.exp === 'number' ? payload.exp : 0;
    const email = payload && typeof payload.e === 'string' ? payload.e.trim() : '';
    if (!email || Date.now() > exp) return null;
    const expectedSig = crypto.createHmac('sha256', SHARED_SECRET).update(payloadJson).digest('base64url');
    if (parts[1] !== expectedSig) return null;
    if (typeof requestEmail === 'string' && requestEmail.trim() && email.toLowerCase() !== requestEmail.trim().toLowerCase()) return null;
    return email;
  } catch {
    return null;
  }
}

/**
 * Autorización: rate limit, luego secreto compartido O token de sesión válido.
 * Si requestEmail está definido y se envía X-Auth2027-Session, se exige que el email del token coincida con requestEmail.
 */
function ensureAuthorizedRequest(req, res, bucket, limit, requestEmail) {
  const ip = getClientIp(req);

  if (bucket && limit && isRateLimited(ip, bucket, limit)) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: false, message: 'rate_limited' }));
    return false;
  }

  const sessionHeader = req.headers['x-auth2027-session'];
  if (typeof sessionHeader === 'string' && sessionHeader.trim()) {
    const tokenEmail = verifySessionToken(sessionHeader.trim(), requestEmail);
    if (tokenEmail) return true;
    if (requestEmail) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: 'session_invalid_or_email_mismatch' }));
      return false;
    }
  }

  if (!SHARED_SECRET) {
    return true;
  }

  const header = req.headers['x-auth2027-secret'];
  if (typeof header === 'string' && header.trim() === SHARED_SECRET) {
    return true;
  }

  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ success: false, message: 'unauthorized' }));
  return false;
}

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

async function updateDiscordLinkRow(rowId, { discordId, discordUsername, roles = [], acceso_manual_until }) {
  const patch = {
    discord_id: discordId,
    discord_username: discordUsername,
    roles,
    status: 'linked',
    updated_at: new Date().toISOString()
  };
  if (acceso_manual_until !== undefined) {
    patch.acceso_manual_until = acceso_manual_until;
  }
  const { error } = await supabase.from('user_discord_links').update(patch).eq('id', rowId);

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
          reason: 'Rol de suscripción (Motivo) desde Argenmod Auth'
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
          // Priorizar siempre next_payment_date para calcular días restantes;
          // si no existe, caer a end_date / auto_recurring.end_date.
          const endDateStr =
            pre.next_payment_date ||
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
          first.next_payment_date ||
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
      const pre = decision ? decision.preapproval : null;
      dataToSave = {
        results: allPreapprovals,
        sources: found.map((r) => r.data?.source).filter(Boolean),
        paging: null,
        meta: {
          effective_status: decision ? decision.effectiveStatus : null,
          ui_label: decision ? decision.uiLabel : null,
          raw_status: decision ? decision.rawStatus : null,
          end_date: decision && decision.endDate ? decision.endDate.toISOString() : null,
          days_left: decision && typeof decision.daysLeft === 'number' ? decision.daysLeft : null,
          payer_first_name: pre && pre.payer_first_name != null ? String(pre.payer_first_name) : null,
          payer_last_name: pre && pre.payer_last_name != null ? String(pre.payer_last_name) : null,
          external_reference: pre && pre.external_reference != null ? String(pre.external_reference) : null
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

  // 4) Acceso manual (30 días): si expiró, quitar rol y actualizar BD; si no, asegurar rol
  const manualUntil = rowWithMp && rowWithMp.acceso_manual_until ? new Date(rowWithMp.acceso_manual_until) : null;
  const now = new Date();
  if (manualUntil && manualUntil <= now) {
    const accRole = member.guild.roles.cache.find((r) => r.name === 'acceso manual');
    if (accRole && member.roles.cache.has(accRole.id)) {
      await member.roles.remove(accRole).catch((err) => {
        console.error('No se pudo quitar rol acceso manual (expirado):', err);
      });
    }
    const currentRoles = await getUserRolesInGuild(member);
    const rolesWithoutManual = currentRoles.filter((r) => r.toLowerCase() !== 'acceso manual');
    await supabase
      .from('user_discord_links')
      .update({
        roles: rolesWithoutManual,
        acceso_manual_until: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', rowWithMp.id);
    return rolesWithoutManual;
  }
  if (manualUntil && manualUntil > now) {
    await ensureRoleByName(member, 'acceso manual');
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
      await message.reply('Usa el comando así: `!link CODIGO` (lo ves en Argenmod Auth > Perfil).');
      return;
    }

    await message.channel.sendTyping();

    const row = await findLinkRowByCode(code);

    if (!row) {
      await message.reply('❌ Ese código no es válido o ya fue usado. Asegúrate de copiarlo bien desde Argenmod Auth.');
      return;
    }

    // Un Discord no puede estar anclado a dos cuentas diferentes
    const existingByDiscord = await findLinkRowByDiscordId(message.author.id);
    if (existingByDiscord && existingByDiscord.id !== row.id) {
      await message.reply('❌ Este Discord ya está anclado a otra cuenta. Usa siempre la misma cuenta de Argenmod Auth.');
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

    await message.reply('✅ Rol **Anclado** asignado y tu cuenta ha sido guardada en la base de datos. Vuelve a Argenmod Auth y pulsa "Comprobar estado".');
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

      // Configuración pública para la app (Discord OAuth, etc.) — la app la usa cuando no tiene .env
      if (url.pathname === '/config' && req.method === 'GET') {
        const redirectUri = (DISCORD_REDIRECT_URI || '').trim().replace(/\/$/, '') || '';
        const clientId = (DISCORD_CLIENT_ID || '').trim();
        const discordOAuthBaseUrl =
          clientId && redirectUri
            ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20email`
            : null;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(
          JSON.stringify({
            success: true,
            discordOAuthBaseUrl
          })
        );
        return;
      }

      // Diagnóstico OAuth Discord (sin secretos adicionales): ver qué redirect_uri y client_id usa el bot
      if (url.pathname === '/auth/discord/debug') {
        const redirectUri = (DISCORD_REDIRECT_URI || '').trim().replace(/\/$/, '') || null;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify(
            {
              discord_redirect_uri: redirectUri,
              discord_client_id_set: !!DISCORD_CLIENT_ID,
              discord_client_id: DISCORD_CLIENT_ID ? `${String(DISCORD_CLIENT_ID).slice(0, 6)}...` : null
            },
            null,
            2
          )
        );
        return;
      }

      // Endpoint interno para estado de MercadoPago
      if (url.pathname === '/mp/status') {
        const email = url.searchParams.get('email');
        if (!email) {
          res.statusCode = 400;
          res.end('Missing email');
          return;
        }
        if (!ensureAuthorizedRequest(req, res, 'mp_status', 60, email)) return;

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

      // --- Solicitud de acceso manual (usuario con Discord vinculado, sin suscripción MP) ---
      if (url.pathname === '/access-request' && req.method === 'POST') {
        if (isRateLimited(getClientIp(req), 'access_request', 10)) {
          res.statusCode = 429;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: 'rate_limited' }));
          return;
        }
        const sessionHeader = req.headers['x-auth2027-session'];
        const userEmail = typeof sessionHeader === 'string' && sessionHeader.trim()
          ? verifySessionToken(sessionHeader.trim(), null)
          : null;
        if (!userEmail) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: 'Sesión inválida o expirada.' }));
          return;
        }
        const body = await new Promise((resolve) => {
          let data = '';
          req.on('data', (chunk) => {
            data += chunk.toString();
            if (data.length > 3e6) req.destroy();
          });
          req.on('end', () => {
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch {
              resolve({});
            }
          });
          req.on('error', () => resolve({}));
        });
        const comprobante = body && typeof body.comprobante === 'string' ? body.comprobante.trim() : '';
        if (!comprobante || !comprobante.startsWith('data:image/')) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: 'Debes adjuntar una imagen (comprobante).' }));
          return;
        }
        if (comprobante.length > 2500000) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: 'La imagen es demasiado grande. Usa una más pequeña.' }));
          return;
        }
        const { data: linkRow, error: linkError } = await supabase
          .from('user_discord_links')
          .select('id, discord_id, status')
          .eq('email', userEmail)
          .maybeSingle();
        if (linkError || !linkRow || !linkRow.discord_id || String(linkRow.status || '').toLowerCase() !== 'linked') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: 'Debes tener Discord vinculado para solicitar acceso.' }));
          return;
        }
        const { data: existingPending } = await supabase
          .from('access_requests')
          .select('id')
          .eq('user_email', userEmail)
          .eq('status', 'pending')
          .limit(1)
          .maybeSingle();
        if (existingPending) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            success: false,
            message: 'Ya tienes una solicitud en curso. Espera a que sea aprobada o rechazada antes de enviar otra.'
          }));
          return;
        }
        const { error: insertErr } = await supabase.from('access_requests').insert({
          user_email: userEmail,
          discord_id: linkRow.discord_id,
          comprobante_data: comprobante,
          status: 'pending'
        });
        if (insertErr) {
          console.error('Error insertando access_request:', insertErr);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: 'Error al guardar la solicitud.' }));
          return;
        }
        await supabase
          .from('user_discord_links')
          .update({
            access_request_rejection_reason: null,
            access_request_rejection_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('email', userEmail);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: 'Solicitud enviada. Un administrador la revisará.' }));
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
        if (!ensureAuthorizedRequest(req, res, 'admin', 30, adminEmail)) return;

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
            const elevatedRoles = [
              'admin',
              '🛡️・𝑨𝑫𝑴𝑰𝑵 𝑺・🛡️'.toLowerCase(),
              '⚔️・𝑺𝑶𝑷𝑶𝑹𝑻𝑬・⚔️'.toLowerCase()
            ];

            const isLinkedElevated =
              bestRow.discord_id &&
              String(bestRow.status || '').toLowerCase() === 'linked' &&
              rolesLower.some((r) => elevatedRoles.includes(r));

            return isLinkedElevated;
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

        if (url.pathname === '/admin/users/sync-roles' && req.method === 'POST') {
          try {
            // Forzar sincronización inmediata de roles (Discord + Supabase + MP)
            await syncAllLinkedUsersRoles();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            console.error('Error inesperado en /admin/users/sync-roles:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'internal_error' }));
          }
          return;
        }

        if (url.pathname === '/admin/mp/status' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const targetEmailRaw = body && typeof body.email === 'string' ? body.email.trim() : '';
            if (!targetEmailRaw) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'Falta el correo a consultar.' }));
              return;
            }

            const row = await fetchMercadoPagoAndUpdateRowForEmail(targetEmailRaw).catch(() => null);
            if (!row) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'No se pudo obtener estado de MercadoPago.' }));
              return;
            }

            let mpData = row.mercadopago_data;
            if (typeof mpData === 'string') {
              try {
                mpData = JSON.parse(mpData);
              } catch {
                mpData = null;
              }
            }
            const meta = mpData && typeof mpData === 'object' ? mpData.meta || {} : {};
            const effective =
              (meta.effective_status || row.mercadopago_status || '').toString().toLowerCase();
            const uiLabel = meta.ui_label || (effective || '-');
            let daysLeft =
              typeof meta.days_left === 'number' ? meta.days_left : null;
            // Recalcular días restantes si no viene precalculado pero tenemos una fecha de fin
            if (daysLeft == null && typeof meta.end_date === 'string' && meta.end_date.trim()) {
              const end = new Date(meta.end_date);
              if (!Number.isNaN(end.getTime())) {
                const now = new Date();
                const diffMs = end.getTime() - now.getTime();
                const ONE_DAY_MS = 24 * 60 * 60 * 1000;
                daysLeft = Math.max(0, Math.ceil(diffMs / ONE_DAY_MS));
              }
            }
            const rawStatus = meta.raw_status || row.mercadopago_status || null;
            const hasSubscription =
              !!effective &&
              effective !== 'not_found' &&
              effective !== 'error' &&
              effective !== 'unknown';
            const isActive = effective === 'active';

            let payerFirstName = meta.payer_first_name != null ? String(meta.payer_first_name) : null;
            let payerLastName = meta.payer_last_name != null ? String(meta.payer_last_name) : null;
            let externalRef = meta.external_reference != null ? String(meta.external_reference) : null;
            if ((payerFirstName == null || payerLastName == null || externalRef == null) && Array.isArray(mpData?.results) && mpData.results.length > 0) {
              const first = mpData.results.find((r) => String(r.status || '').toLowerCase() === 'authorized') || mpData.results[0];
              if (payerFirstName == null && first.payer_first_name != null) payerFirstName = String(first.payer_first_name);
              if (payerLastName == null && first.payer_last_name != null) payerLastName = String(first.payer_last_name);
              if (externalRef == null && first.external_reference != null) externalRef = String(first.external_reference);
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                success: true,
                email: row.email || targetEmailRaw,
                mercadopago_status: row.mercadopago_status || null,
                has_subscription: hasSubscription,
                is_active: isActive,
                days_left: daysLeft,
                status_label: uiLabel,
                raw_status: rawStatus,
                payer_first_name: payerFirstName,
                payer_last_name: payerLastName,
                external_reference: externalRef
              })
            );
          } catch (e) {
            console.error('Error inesperado en /admin/mp/status:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'internal_error' }));
          }
          return;
        }

        if (url.pathname === '/admin/access-requests/pending-count' && req.method === 'GET') {
          try {
            const { count, error } = await supabase
              .from('access_requests')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'pending');
            if (error) throw error;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, count: count || 0 }));
          } catch (e) {
            console.error('Error en /admin/access-requests/pending-count:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, count: 0 }));
          }
          return;
        }

        if (url.pathname === '/admin/access-requests/pending' && req.method === 'GET') {
          try {
            const { data: rows, error } = await supabase
              .from('access_requests')
              .select('id, user_email, discord_id, comprobante_data, created_at')
              .eq('status', 'pending')
              .order('created_at', { ascending: true });
            if (error) throw error;
            const requests = rows || [];
            const discordIds = [...new Set(requests.map((r) => r.discord_id).filter(Boolean))];
            let discordUsernameById = {};
            if (discordIds.length > 0) {
              const { data: linkRows } = await supabase
                .from('user_discord_links')
                .select('discord_id, discord_username')
                .in('discord_id', discordIds);
              if (Array.isArray(linkRows)) {
                linkRows.forEach((l) => {
                  if (l.discord_id) discordUsernameById[l.discord_id] = l.discord_username || null;
                });
              }
            }
            const requestsWithDiscord = requests.map((r) => ({
              ...r,
              discord_username: r.discord_id ? discordUsernameById[r.discord_id] || null : null
            }));
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, requests: requestsWithDiscord }));
          } catch (e) {
            console.error('Error en /admin/access-requests/pending:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, requests: [] }));
          }
          return;
        }

        if (url.pathname === '/admin/access-requests/approve' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const id = body && body.id != null ? Number(body.id) : NaN;
          if (!Number.isInteger(id) || id < 1) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'ID inválido.' }));
            return;
          }
          try {
            const { data: reqRow, error: fetchErr } = await supabase
              .from('access_requests')
              .select('*')
              .eq('id', id)
              .eq('status', 'pending')
              .maybeSingle();
            if (fetchErr || !reqRow) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'Solicitud no encontrada o ya atendida.' }));
              return;
            }
            const discordId = reqRow.discord_id;
            if (!discordId || !GUILD_ID) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'Falta discord_id o GUILD_ID.' }));
              return;
            }
            const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
            if (!guild) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'No se pudo acceder al servidor Discord.' }));
              return;
            }
            const member = await guild.members.fetch(discordId).catch(() => null);
            if (!member) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'Usuario no está en el servidor Discord.' }));
              return;
            }
            await ensureRoleByName(member, 'acceso manual');
            const { data: linkRow } = await supabase.from('user_discord_links').select('roles').eq('discord_id', discordId).maybeSingle();
            const rolesArr = Array.isArray(linkRow?.roles) ? linkRow.roles.map((r) => String(r)) : [];
            const hasAccesoManual = rolesArr.some((r) => r.toLowerCase() === 'acceso manual');
            const accesoManualUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await supabase
              .from('user_discord_links')
              .update({
                roles: hasAccesoManual ? rolesArr : [...rolesArr, 'acceso manual'],
                acceso_manual_until: accesoManualUntil,
                updated_at: new Date().toISOString()
              })
              .eq('discord_id', discordId);
            await supabase.from('access_requests').delete().eq('id', id).eq('status', 'pending');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, message: 'Rol "acceso manual" asignado en Discord. Solicitud eliminada.' }));
          } catch (e) {
            console.error('Error en /admin/access-requests/approve:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: e?.message || 'internal_error' }));
          }
          return;
        }

        if (url.pathname === '/admin/access-requests/reject' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const id = body && body.id != null ? Number(body.id) : NaN;
          const reason = body && typeof body.reason === 'string' ? body.reason.trim() : '';
          if (!Number.isInteger(id) || id < 1) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: 'ID inválido.' }));
            return;
          }
          try {
            const { data: reqRow, error: fetchErr } = await supabase
              .from('access_requests')
              .select('user_email')
              .eq('id', id)
              .eq('status', 'pending')
              .maybeSingle();
            if (fetchErr || !reqRow || !reqRow.user_email) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: 'Solicitud no encontrada o ya atendida.' }));
              return;
            }
            await supabase
              .from('user_discord_links')
              .update({
                access_request_rejection_reason: reason || null,
                access_request_rejection_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('email', reqRow.user_email);
            const { error } = await supabase.from('access_requests').delete().eq('id', id).eq('status', 'pending');
            if (error) throw error;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, message: 'Solicitud rechazada y eliminada.' }));
          } catch (e) {
            console.error('Error en /admin/access-requests/reject:', e);
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
            res.end(JSON.stringify({ success: false, message: 'Incluye al menos un campo a actualizar.' }));
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
        if (!ensureAuthorizedRequest(req, res, 'u_state', 60, email)) return;

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

          let payloadRow = bestRow;
          if (bestRow && bestRow.email) {
            const { data: pendingReq } = await supabase
              .from('access_requests')
              .select('id')
              .eq('user_email', bestRow.email)
              .eq('status', 'pending')
              .limit(1)
              .maybeSingle();
            payloadRow = { ...bestRow, has_pending_access_request: !!pendingReq };
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, row: payloadRow }));
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
        if (!ensureAuthorizedRequest(req, res, 'pc_check', 60, email)) return;

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

      // Normalizar redirect_uri: sin espacios ni barra final (Discord es estricto)
      const redirectUri = (DISCORD_REDIRECT_URI || '').trim().replace(/\/$/, '') || null;
      const callbackPath = redirectUri ? new URL(redirectUri).pathname.replace(/\/$/, '') || '/discord/callback' : '/discord/callback';
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

      // Intercambiar el code por un access_token (redirect_uri debe coincidir exactamente con el de la autorización)
      const tokenParams = new URLSearchParams();
      tokenParams.set('client_id', DISCORD_CLIENT_ID);
      tokenParams.set('client_secret', DISCORD_CLIENT_SECRET);
      tokenParams.set('grant_type', 'authorization_code');
      tokenParams.set('code', code);
      tokenParams.set('redirect_uri', redirectUri);

      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenParams
      });

      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenData.access_token) {
        const errCode = tokenData.error || 'unknown';
        const errDesc = tokenData.error_description || tokenData.message || '';
        const rawJson = JSON.stringify(tokenData, null, 2);
        console.error('Error al obtener token de Discord:', tokenRes.status, errCode, errDesc, 'redirect_uri=', redirectUri, 'body=', rawJson);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error OAuth Discord</title></head><body style="font-family:sans-serif;max-width:600px;margin:2rem auto;padding:1rem;background:#1a1a2e;color:#eee;">
          <h2 style="color:#f87171;">Error al obtener token de Discord</h2>
          <p><strong>HTTP:</strong> ${tokenRes.status}</p>
          <p><strong>Código:</strong> ${errCode}</p>
          <p><strong>Detalle:</strong> ${errDesc || '(sin mensaje)'}</p>
          <p><strong>redirect_uri que usa el bot:</strong><br><code style="background:#333;padding:4px 8px;word-break:break-all;">${redirectUri || '(no configurado)'}</code></p>
          <details style="margin-top:1rem;"><summary style="cursor:pointer;color:#94a3b8;">Respuesta completa de Discord (JSON)</summary><pre style="background:#0f172a;padding:8px;overflow:auto;font-size:12px;">${rawJson.replace(/</g, '&lt;')}</pre></details>
          <p style="font-size:0.9em;color:#94a3b8;margin-top:1rem;">• <code>invalid_grant</code> = código ya usado, caducado o redirect_uri/client_id no coinciden.<br>• Verifica que DISCORD_CLIENT_ID en Render sea el mismo que en Discord Developer Portal (aplicación donde está el Redirect).<br>• Prueba diagnóstico: <a href="/auth/discord/debug" style="color:#818cf8;">/auth/discord/debug</a></p>
          </body></html>`);
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
        Esta cuenta de Discord ya fue vinculada a otra cuenta de Argenmod Auth.<br />
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
      <p>Tu cuenta de Discord se ha vinculado. Ya puedes volver a Argenmod Auth; la app comprobará tu estado automáticamente en unos segundos.</p>
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