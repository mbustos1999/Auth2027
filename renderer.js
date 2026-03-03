(function () {
  const panelLogin = document.getElementById('panelLogin');
  const panelDashboard = document.getElementById('panelDashboard');
  const formLogin = document.getElementById('formLogin');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const btnSubmit = document.getElementById('btnSubmit');
  const messageError = document.getElementById('messageError');
  const userNameEl = document.getElementById('userName');
  const userAvatarEl = document.getElementById('userAvatar');
  const discordHeaderLinkedEl = document.getElementById('discordHeaderLinked');
  const discordHeaderUnlinkedEl = document.getElementById('discordHeaderUnlinked');
  const btnLogout = document.getElementById('btnLogout');

  const apiConfig = window.apiConfig || {};
  const baseUrl = (apiConfig.baseUrl != null && apiConfig.baseUrl !== '') ? String(apiConfig.baseUrl).trim() : '';
  const authEndpoint = (apiConfig.authEndpoint != null && apiConfig.authEndpoint !== '') ? String(apiConfig.authEndpoint).trim() : '';
  const authUrl = baseUrl && authEndpoint ? `${baseUrl.replace(/\/$/, '')}${authEndpoint}` : '';
  const supabaseUrl = (apiConfig.supabaseUrl != null && apiConfig.supabaseUrl !== '') ? String(apiConfig.supabaseUrl).trim() : '';
  const supabaseKey = (apiConfig.supabaseAnonKey != null && apiConfig.supabaseAnonKey !== '') ? String(apiConfig.supabaseAnonKey).trim() : '';
  const discordOAuthBaseUrl = (apiConfig.discordOAuthBaseUrl != null && apiConfig.discordOAuthBaseUrl !== '') ? String(apiConfig.discordOAuthBaseUrl).trim() : '';
  const mercadopagoAccessToken = (apiConfig.mercadopagoAccessToken != null) ? String(apiConfig.mercadopagoAccessToken).trim() : '';
  const mercadopagoAccessTokenChile =
    apiConfig.mercadopagoAccessTokenChile != null ? String(apiConfig.mercadopagoAccessTokenChile).trim() : '';
  const mercadopagoAccessTokenArg =
    apiConfig.mercadopagoAccessTokenArg != null ? String(apiConfig.mercadopagoAccessTokenArg).trim() : '';
  const pcName = (apiConfig.pcName != null && apiConfig.pcName !== '') ? String(apiConfig.pcName).trim() : '';
  const dashTabs = Array.from(document.querySelectorAll('.dash-nav-item'));
  const dashPanels = Array.from(document.querySelectorAll('.dash-tab'));
  const discordLinkStatusEl = document.getElementById('discordLinkStatus');
  const discordLinkedBoxEl = document.getElementById('discordLinkedBox');
  const discordUsernameLabel = document.getElementById('discordUsernameLabel');
  const discordRolesList = document.getElementById('discordRolesList');
  const btnConnectDiscord = document.getElementById('btnConnectDiscord');
  const mercadopagoLoadingEl = document.getElementById('mercadopagoLoading');
  const mercadopagoNotFoundEl = document.getElementById('mercadopagoNotFound');
  const mercadopagoFoundEl = document.getElementById('mercadopagoFound');
  const mercadopagoStatusLabelEl = document.getElementById('mercadopagoStatusLabel');
  const mercadopagoErrorEl = document.getElementById('mercadopagoError');
  const mercadopagoHeaderStatusIconEl = document.getElementById('mercadopagoHeaderStatusIcon');
  const mercadopagoDetailsEl = document.getElementById('mercadopagoDetails');
  const mercadopagoReasonEl = document.getElementById('mercadopagoReason');
  const mercadopagoAmountEl = document.getElementById('mercadopagoAmount');
  const mercadopagoPayerNameEl = document.getElementById('mercadopagoPayerName');
  const mercadopagoStatusRawEl = document.getElementById('mercadopagoStatusRaw');
  const mercadopagoDaysLeftEl = document.getElementById('mercadopagoDaysLeft');

  let currentUser = null;
  let currentDiscordRow = null;
  let discordLinkPolling = false;

  function showError(msg) {
    messageError.textContent = msg;
    messageError.hidden = false;
    usernameInput.classList.toggle('error', msg.includes('registrado') || msg.includes('Usuario'));
    passwordInput.classList.toggle('error', msg.includes('contraseña') || msg.includes('incorrecta'));
  }

  function clearError() {
    messageError.hidden = true;
    messageError.textContent = '';
    usernameInput.classList.remove('error');
    passwordInput.classList.remove('error');
  }

  function setLoading(loading) {
    btnSubmit.disabled = loading;
    btnSubmit.classList.toggle('loading', loading);
  }

  async function login(username, password) {
    if (!authUrl) {
      const hasConfig = !!(baseUrl || authEndpoint);
      const msg = !window.electronAPI
        ? 'Ejecuta la app con: npm start (no abras index.html en el navegador).'
        : (hasConfig ? 'Reinicia la aplicación para cargar la configuración.' : 'Configura API_BASE_URL y AUTH_ENDPOINT en config.js.');
      showError(msg);
      return null;
    }

    clearError();
    setLoading(true);

    try {
      const res = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        return {
          user_id: data.user_id,
          display_name: data.display_name,
          user_email: data.user_email
        };
      }

      if (data.message) {
        const isNoRoute = /no se encontró una ruta|no route found|rest_no_route/i.test(data.message);
        if (isNoRoute) {
          showError('WordPress no encuentra la ruta. Revisa: permalinks (no uses "Simple"), que el plugin/código que registra /validar-login esté activo, y que la URL sea correcta.');
        } else {
          showError(data.message);
        }
      } else if (res.status === 404) {
        showError('El usuario no está registrado en la página.');
      } else if (res.status === 401) {
        showError('La contraseña es incorrecta.');
      } else {
        showError('Error de conexión. Comprueba la URL en config.js.');
      }
      return null;
    } catch (err) {
      showError('No se pudo conectar. Comprueba la URL en config.js.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function solicitarRecuperacionPassword(email) {
    const recoverUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/wp-json/argenmod/v1/recuperar-password` : '';
    if (!recoverUrl) {
      showError('Configura la URL de WordPress en config.js para recuperar la contraseña.');
      return;
    }

    clearError();
    try {
      const res = await fetch(recoverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        showError('Te hemos enviado un correo con instrucciones para restablecer tu contraseña.');
        messageError.classList.remove('message-error');
        messageError.classList.add('message-success');
      } else {
        messageError.classList.remove('message-success');
        messageError.classList.add('message-error');
        showError(data.message || 'No se pudo iniciar el proceso de recuperación.');
      }
    } catch (e) {
      showError('Error de conexión al solicitar la recuperación de contraseña.');
    }
  }

  function showDashboard(user) {
    currentUser = user;
    currentDiscordRow = null; // Hasta que Supabase responda, considerar no vinculado
    userNameEl.textContent = user.display_name || 'Usuario';
    userAvatarEl.textContent = (user.display_name || user.user_email || 'U').charAt(0).toUpperCase();
    if (discordHeaderLinkedEl) discordHeaderLinkedEl.hidden = true;
    if (discordHeaderUnlinkedEl) discordHeaderUnlinkedEl.hidden = false;
    panelLogin.hidden = true;
    panelLogin.style.display = 'none';
    panelDashboard.hidden = false;
    panelDashboard.style.display = 'block';

    // Mostrar solo "Pendiente" hasta confirmar el estado real desde Supabase
    updateDiscordUI();

    // Crear/actualizar fila básica en Supabase (email + nombre de PC),
    // luego sincronizar y consultar MercadoPago
    ensureSupabaseUserRow()
      .then(() => syncUserWithSupabase())
      .then(() => fetchMercadoPagoAndSave())
      .catch(() => {
        // Aunque falle Supabase, intentamos al menos consultar MercadoPago
        fetchMercadoPagoAndSave().catch(() => {});
      });

    // Al entrar al dashboard, ir directamente a la pestaña Perfil
    activateTab('profile');
  }

  function showLogin() {
    panelLogin.hidden = false;
    panelDashboard.hidden = true;
    usernameInput.value = '';
    passwordInput.value = '';
    clearError();
    currentUser = null;
    currentDiscordRow = null;
    if (discordHeaderLinkedEl) discordHeaderLinkedEl.hidden = true;
    if (discordHeaderUnlinkedEl) discordHeaderUnlinkedEl.hidden = false;
    setMercadoPagoUI('loading');
    updateMercadoPagoHeaderIcon(null);
  }

  function activateTab(tabName) {
    dashTabs.forEach((btn) => {
      const t = btn.getAttribute('data-tab');
      btn.classList.toggle('dash-nav-item--active', t === tabName);
    });
    dashPanels.forEach((panel) => {
      const p = panel.getAttribute('data-tab-panel');
      const active = p === tabName;
      panel.classList.toggle('dash-tab--active', active);
      panel.hidden = !active;
    });
    // Al abrir Perfil, refrescar desde Supabase y luego actualizar UI
    if (tabName === 'profile') {
      refreshDiscordFromSupabase()
        .then(() => {
          updateDiscordUI();
        })
        .catch(() => {
          updateDiscordUI();
        });
    }
  }

  dashTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) activateTab(tab);
    });
  });

  async function syncUserWithSupabase() {
    // Ya no intentamos crear/actualizar filas desde el front.
    // Solo leemos el estado actual desde Supabase.
    await refreshDiscordFromSupabase();
  }

  async function checkPcBindingForEmail(email) {
    if (!supabaseUrl || !supabaseKey) return true;

    const base = supabaseUrl.replace(/\/$/, '');
    try {
      const url = `${base}/rest/v1/user_discord_links?email=eq.${encodeURIComponent(
        email
      )}&select=id,pc_name`;
      const res = await fetch(url, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      });
      const rows = await res.json().catch(() => []);

      if (!Array.isArray(rows) || rows.length === 0) {
        // No hay fila aún: se creará luego, permitimos el login
        return true;
      }

      const row = rows[0];
      const storedPc = (row.pc_name || '').trim();
      const currentPc = (pcName || '').trim();

      // Si no tenemos nombre de PC actual, no bloqueamos
      if (!currentPc) return true;

      // Si no hay PC guardado, lo fijamos ahora
      if (!storedPc) {
        const patchUrl = `${base}/rest/v1/user_discord_links?id=eq.${row.id}`;
        await fetch(patchUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            pc_name: currentPc,
            updated_at: new Date().toISOString()
          })
        });
        return true;
      }

      // Si coincide, ok; si no, bloquear
      return storedPc === currentPc;
    } catch (_) {
      // En caso de error de red/Supabase, no bloqueamos el login
      return true;
    }
  }

  async function ensureSupabaseUserRow() {
    if (!currentUser || !currentUser.user_email || !supabaseUrl || !supabaseKey) return;

    const email = currentUser.user_email;
    const base = supabaseUrl.replace(/\/$/, '');

    try {
      const getUrl = `${base}/rest/v1/user_discord_links?email=eq.${encodeURIComponent(email)}&select=*`;
      const res = await fetch(getUrl, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      });
      const rows = await res.json().catch(() => []);

      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        if (!row.pc_name && pcName) {
          const patchUrl = `${base}/rest/v1/user_discord_links?id=eq.${row.id}`;
          await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: 'return=minimal'
            },
            body: JSON.stringify({
              pc_name: pcName,
              updated_at: new Date().toISOString()
            })
          });
        }
        return;
      }

      // No existe fila: crearla con email y pc_name, resto vacío
      const insertUrl = `${base}/rest/v1/user_discord_links`;
      await fetch(insertUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          email,
          pc_name: pcName || null,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
    } catch (_) {
      // Ignorar errores silenciosamente: la app sigue funcionando sin Supabase
    }
  }

  function setMercadoPagoUI(state, statusText) {
    if (mercadopagoLoadingEl) mercadopagoLoadingEl.hidden = state !== 'loading';
    if (mercadopagoNotFoundEl) mercadopagoNotFoundEl.hidden = state !== 'not_found';
    if (mercadopagoFoundEl) {
      mercadopagoFoundEl.hidden = state !== 'found';
      if (mercadopagoStatusLabelEl) mercadopagoStatusLabelEl.textContent = statusText || '-';
    }
    if (mercadopagoErrorEl) mercadopagoErrorEl.hidden = state !== 'error';

    if (mercadopagoDetailsEl) {
      const showDetails = state === 'found';
      mercadopagoDetailsEl.hidden = !showDetails;
      if (!showDetails) {
        if (mercadopagoReasonEl) mercadopagoReasonEl.textContent = '-';
        if (mercadopagoAmountEl) mercadopagoAmountEl.textContent = '-';
        if (mercadopagoPayerNameEl) mercadopagoPayerNameEl.textContent = '-';
        if (mercadopagoStatusRawEl) mercadopagoStatusRawEl.textContent = '-';
        if (mercadopagoDaysLeftEl) mercadopagoDaysLeftEl.textContent = '-';
      }
    }
  }

  function updateMercadoPagoHeaderIcon(status) {
    if (!mercadopagoHeaderStatusIconEl) return;

    const normalized = (status || '').toLowerCase();
    const hasStatus = !!normalized;

    if (!hasStatus) {
      mercadopagoHeaderStatusIconEl.hidden = true;
      mercadopagoHeaderStatusIconEl.classList.remove('mercadopago-header-status-icon--ok', 'mercadopago-header-status-icon--bad');
      mercadopagoHeaderStatusIconEl.innerHTML = '';
      return;
    }

    const isAuthorized = normalized === 'authorized' || normalized === 'active' || normalized === 'sub_activa';
    mercadopagoHeaderStatusIconEl.hidden = false;
    mercadopagoHeaderStatusIconEl.classList.toggle('mercadopago-header-status-icon--ok', isAuthorized);
    mercadopagoHeaderStatusIconEl.classList.toggle('mercadopago-header-status-icon--bad', !isAuthorized);

    if (isAuthorized) {
      mercadopagoHeaderStatusIconEl.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    } else {
      mercadopagoHeaderStatusIconEl.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    }
  }

  async function fetchMercadoPagoAndSave() {
    if (!currentUser || !currentUser.user_email) {
      setMercadoPagoUI('error');
      updateMercadoPagoHeaderIcon('error');
      return;
    }
    const email = currentUser.user_email;

    const tokensToUse = [];
    if (mercadopagoAccessTokenChile) {
      tokensToUse.push({ country: 'chile', token: mercadopagoAccessTokenChile });
    }
    if (mercadopagoAccessTokenArg) {
      tokensToUse.push({ country: 'argentina', token: mercadopagoAccessTokenArg });
    }

    if (tokensToUse.length === 0 && !mercadopagoAccessToken) {
      setMercadoPagoUI('error');
      updateMercadoPagoHeaderIcon('error');
      return;
    }

    setMercadoPagoUI('loading');

    const searchUrlBase = `https://api.mercadopago.com/preapproval/search?payer_email=${encodeURIComponent(email)}`;
    let statusToSave = 'not_found';
    let dataToSave = { results: [], sources: [], paging: null };
    let anyError = false;

    // Función auxiliar para consultar con un token concreto
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
          anyError = true;
          return { ok: false, status: 'error', data: { error: data.message || res.status, source: label } };
        }

        if (Array.isArray(data.results) && data.results.length > 0) {
          return {
            ok: true,
            status: 'found',
            data: { results: data.results, paging: data.paging, source: label }
          };
        }

        // Sin resultados pero sin error
        return { ok: true, status: 'not_found', data: { results: [], paging: data.paging, source: label } };
      } catch (_) {
        anyError = true;
        return { ok: false, status: 'error', data: { error: 'network_error', source: label } };
      }
    }

    const queries = [];

    // Primero, usar los tokens específicos de país
    for (const entry of tokensToUse) {
      queries.push(queryWithToken(entry.country, entry.token));
    }

    // Compatibilidad: si existe un token unificado adicional, también consultarlo
    if (mercadopagoAccessToken && tokensToUse.length === 0) {
      queries.push(queryWithToken('legacy', mercadopagoAccessToken));
    }

    const results = [];
    for (const q of queries) {
      // Ejecutar en serie para evitar límites agresivos de rate limit
      // eslint-disable-next-line no-await-in-loop
      const r = await q;
      if (r) results.push(r);
    }

    // Combinar resultados
    const found = results.filter((r) => r.ok && r.status === 'found');
    if (found.length > 0) {
      const allPreapprovals = found.flatMap((r) =>
        r.data && Array.isArray(r.data.results) ? r.data.results : []
      );

      // Elegir la mejor preaprobación: activa si end_date >= hoy aunque status sea cancelado
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
          if (!Number.isNaN(d.getTime()) && d >= now) {
            endDateFirst = d;
            daysLeftFirst = Math.max(0, Math.ceil((d.getTime() - now.getTime()) / ONE_DAY_MS));
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

      const uiLabel = decision ? decision.uiLabel : 'Sub activa';
      setMercadoPagoUI('found', uiLabel);

      // Rellenar detalles en la tarjeta
      if (decision && decision.preapproval) {
        const pre = decision.preapproval;
        const reason =
          pre.reason ||
          (pre.auto_recurring && pre.auto_recurring.reason) ||
          '-';
        const chargedAmount =
          pre.charged_amount ||
          (pre.auto_recurring && pre.auto_recurring.transaction_amount) ||
          '-';

        const payerFirstName =
          pre.payer_first_name ||
          (pre.payer && (pre.payer.first_name || pre.payer.name)) ||
          '';
        const payerLastName =
          pre.payer_last_name ||
          (pre.payer && (pre.payer.last_name || pre.payer.surname)) ||
          '';

        const payerName =
          (payerFirstName || payerLastName)
            ? `${payerFirstName} ${payerLastName}`.trim()
            : '-';

        const rawStatus =
          pre.status ||
          (decision.rawStatus ? decision.rawStatus : '-') ||
          '-';

        if (mercadopagoReasonEl) mercadopagoReasonEl.textContent = String(reason);
        if (mercadopagoAmountEl) mercadopagoAmountEl.textContent = String(chargedAmount);
        if (mercadopagoPayerNameEl) mercadopagoPayerNameEl.textContent = payerName;
        if (mercadopagoStatusRawEl) mercadopagoStatusRawEl.textContent = String(rawStatus);
        if (mercadopagoDaysLeftEl) {
          const daysLeft =
            decision && typeof decision.daysLeft === 'number' ? decision.daysLeft : null;
          mercadopagoDaysLeftEl.textContent =
            daysLeft != null ? `${daysLeft} día${daysLeft === 1 ? '' : 's'}` : '-';
        }
      }
    } else if (results.length > 0 && results.every((r) => r.status === 'not_found')) {
      statusToSave = 'not_found';
      dataToSave = {
        results: [],
        sources: results.map((r) => r.data?.source).filter(Boolean),
        paging: null
      };
      setMercadoPagoUI('not_found');
    } else if (anyError || results.length === 0) {
      statusToSave = 'error';
      dataToSave = {
        error: 'error_consultando_mercadopago',
        sources: results.map((r) => r.data?.source).filter(Boolean)
      };
      setMercadoPagoUI('error');
    }

    updateMercadoPagoHeaderIcon(statusToSave);

    if (supabaseUrl && supabaseKey) {
      try {
        const base = supabaseUrl.replace(/\/$/, '');
        let patchUrl = `${base}/rest/v1/user_discord_links?email=eq.${encodeURIComponent(email)}`;

        // Si ya tenemos fila en memoria, usar id (evita problemas de mayúsculas/minúsculas en email)
        if (currentDiscordRow && typeof currentDiscordRow.id === 'number') {
          patchUrl = `${base}/rest/v1/user_discord_links?id=eq.${currentDiscordRow.id}`;
        }

        await fetch(patchUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            mercadopago_status: statusToSave,
            mercadopago_data: dataToSave,
            updated_at: new Date().toISOString()
          })
        });
      } catch (_) {}
    }
  }

  async function refreshDiscordFromSupabase() {
    if (!currentUser || !supabaseUrl || !supabaseKey) return;
    const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/user_discord_links?email=eq.${encodeURIComponent(currentUser.user_email)}&select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });
    const rows = await res.json().catch(() => []);

    let bestRow = null;
    if (Array.isArray(rows) && rows.length > 0) {
      // Si hay varias filas, preferir la que tenga discord_id y el updated_at más reciente
      const withDiscord = rows.filter((r) => r && r.discord_id);
      const candidates = withDiscord.length > 0 ? withDiscord : rows;

      candidates.sort((a, b) => {
        const da = a && a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const db = b && b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return db - da;
      });

      bestRow = candidates[0] || null;
    }

    currentDiscordRow = bestRow;
    updateDiscordUI();
  }

  function startDiscordLinkPolling() {
    if (discordLinkPolling) return;
    discordLinkPolling = true;

    const maxAttempts = 20; // ~60s si usamos 3s entre intentos
    const delayMs = 3000;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      await refreshDiscordFromSupabase().catch(() => {});

      const row = currentDiscordRow;
      const linked =
        row && row.discord_id && String(row.status || '').toLowerCase() === 'linked';

      if (linked || attempts >= maxAttempts) {
        // Si se vinculó, volver a consultar MercadoPago y guardar en Supabase
        if (linked) {
          fetchMercadoPagoAndSave().catch(() => {});
        }
        discordLinkPolling = false;
        return;
      }

      setTimeout(poll, delayMs);
    };

    setTimeout(poll, delayMs);
  }

  function updateDiscordUI() {
    if (!discordLinkStatusEl || !discordLinkedBoxEl) return;

    const row = currentDiscordRow;
    const hasRow = !!row;
    // Solo "Discord vinculado" cuando hay fila, discord_id rellenado y estado linked
    const linked = hasRow && !!row.discord_id && String(row.status).toLowerCase() === 'linked';

    // Mostrar solo una caja: Pendiente O Discord vinculado, nunca las dos
    discordLinkStatusEl.hidden = linked;
    discordLinkedBoxEl.hidden = !linked;

    if (btnConnectDiscord) {
      btnConnectDiscord.hidden = linked;
      btnConnectDiscord.disabled = linked;
    }

    if (discordHeaderLinkedEl && discordHeaderUnlinkedEl) {
      discordHeaderLinkedEl.hidden = !linked;
      discordHeaderUnlinkedEl.hidden = linked;
    }

    if (linked) {
      discordUsernameLabel.textContent = row.discord_username || '(sin nombre)';
      const roles = Array.isArray(row.roles) ? row.roles : [];
      discordRolesList.innerHTML = '';
      if (roles.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Sin roles especiales';
        discordRolesList.appendChild(li);
      } else {
        roles.forEach((r) => {
          const li = document.createElement('li');
          li.textContent = r;
          discordRolesList.appendChild(li);
        });
      }
    }
  }

  const rememberMe = document.getElementById('rememberMe');

  // Cargar credenciales guardadas (si el usuario eligió recordarlas)
  try {
    const savedRaw = localStorage.getItem('auth2027_remember');
    if (savedRaw) {
      const saved = JSON.parse(savedRaw);
      if (saved && typeof saved === 'object') {
        if (saved.u) usernameInput.value = saved.u;
        if (saved.p) passwordInput.value = saved.p;
        if (rememberMe) rememberMe.checked = true;
      }
    }
  } catch (_) {}

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError('Introduce usuario o email y contraseña.');
      return;
    }

    const user = await login(username, password);
    if (user) {
      // Validar que la cuenta esté anclada (o se ancle ahora) a este PC
      let pcOk = true;
      if (pcName && supabaseUrl && supabaseKey) {
        pcOk = await checkPcBindingForEmail(user.user_email);
      }

      if (!pcOk) {
        showError('Esta cuenta ya está anclada a otro PC. Solo puedes usarla en el equipo donde se registró.');
        return;
      }

      if (rememberMe && rememberMe.checked) {
        try {
          localStorage.setItem('auth2027_remember', JSON.stringify({ u: username, p: password }));
        } catch (_) {}
      } else {
        localStorage.removeItem('auth2027_remember');
      }
      showDashboard(user);
    }
  });

  btnLogout.addEventListener('click', showLogin);

  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const createAccountLink = document.getElementById('createAccountLink');
  const recoverModal = document.getElementById('recoverModal');
  const recoverEmailInput = document.getElementById('recoverEmail');
  const recoverCancelBtn = document.getElementById('recoverCancel');
  const recoverSendBtn = document.getElementById('recoverSend');
  const registerModal = document.getElementById('registerModal');
  const regUsernameInput = document.getElementById('regUsername');
  const regEmailInput = document.getElementById('regEmail');
  const regPasswordInput = document.getElementById('regPassword');
  const regPasswordConfirmInput = document.getElementById('regPasswordConfirm');
  const regCountryInput = document.getElementById('regCountry');
  const registerCancelBtn = document.getElementById('registerCancel');
  const registerSendBtn = document.getElementById('registerSend');
  const btnOpenRegister = document.getElementById('btnOpenRegister');
  const registerErrorEl = document.getElementById('registerError');

  function openRecoverModal() {
    if (!recoverModal) return;
    clearError();
    recoverModal.hidden = false;
    const current = usernameInput.value.trim();
    if (current && current.includes('@')) {
      recoverEmailInput.value = current;
    } else {
      recoverEmailInput.value = '';
    }
    recoverEmailInput.focus();
  }

  function closeRecoverModal() {
    if (!recoverModal) return;
    recoverModal.hidden = true;
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', () => {
      openRecoverModal();
    });
  }

  if (createAccountLink) {
    createAccountLink.addEventListener('click', () => {
      window.open('https://argenmod.com', '_blank');
    });
  }

  if (recoverCancelBtn) {
    recoverCancelBtn.addEventListener('click', () => {
      closeRecoverModal();
    });
  }

  if (recoverSendBtn) {
    recoverSendBtn.addEventListener('click', async () => {
      const email = (recoverEmailInput.value || '').trim();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        showError('Introduce un correo electrónico válido.');
        return;
      }
      await solicitarRecuperacionPassword(email);
      // si no hay error de conexión, cerramos modal (el mensaje se muestra en el panel)
      closeRecoverModal();
    });
  }

  // --- Registro de cuenta ---

  const registerUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/wp-json/argenmod/v1/crear-cuenta` : '';

  function clearRegisterError() {
    if (!registerErrorEl) return;
    registerErrorEl.hidden = true;
    registerErrorEl.textContent = '';
  }

  function showRegisterError(msg) {
    if (!registerErrorEl) {
      showError(msg);
      return;
    }
    registerErrorEl.textContent = msg;
    registerErrorEl.hidden = false;
  }

  function openRegisterModal() {
    if (!registerModal) return;
    clearError();
    clearRegisterError();
    registerModal.hidden = false;
    regUsernameInput.value = usernameInput.value.trim();
    regEmailInput.value = '';
    regPasswordInput.value = '';
    regPasswordConfirmInput.value = '';
    regCountryInput.value = '';
    (regUsernameInput.value ? regEmailInput : regUsernameInput).focus();
  }

  function closeRegisterModal() {
    if (!registerModal) return;
    registerModal.hidden = true;
  }

  async function crearCuenta() {
    if (!registerUrl) {
      showRegisterError('Configura la URL de WordPress en config.js para crear cuentas.');
      return;
    }

    const username = regUsernameInput.value.trim();
    const email = regEmailInput.value.trim();
    const password = regPasswordInput.value;
    const passwordConfirm = regPasswordConfirmInput.value;
    const pais = regCountryInput.value.trim();

    if (!username || !email || !password || !passwordConfirm) {
      showRegisterError('Completa usuario, email y contraseñas.');
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      showRegisterError('Introduce un correo electrónico válido.');
      return;
    }

    if (password !== passwordConfirm) {
      showRegisterError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 8) {
      showRegisterError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    clearError();
    clearRegisterError();
    setLoading(true);
    try {
      const res = await fetch(registerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          password_confirm: passwordConfirm,
          pais,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        closeRegisterModal();
        usernameInput.value = username;
        passwordInput.value = password;
        showError('Cuenta creada correctamente. Ahora puedes iniciar sesión.');
        messageError.classList.remove('message-error');
        messageError.classList.add('message-success');
      } else {
        showRegisterError(data.message || 'No se pudo crear la cuenta.');
      }
    } catch (e) {
      showRegisterError('Error de conexión al crear la cuenta.');
    } finally {
      setLoading(false);
    }
  }

  if (btnOpenRegister) {
    btnOpenRegister.addEventListener('click', openRegisterModal);
  }

  if (registerCancelBtn) {
    registerCancelBtn.addEventListener('click', closeRegisterModal);
  }

  if (registerSendBtn) {
    registerSendBtn.addEventListener('click', crearCuenta);
  }

  if (btnConnectDiscord) {
    btnConnectDiscord.addEventListener('click', async () => {
      if (!discordOAuthBaseUrl) {
        alert('Discord OAuth no está configurado. Falta DISCORD_OAUTH_BASE_URL.');
        return;
      }

      // Asegurarnos de tener una fila en user_discord_links y su ID
      if (!currentDiscordRow) {
        await syncUserWithSupabase().catch(() => {});
      }

      const row = currentDiscordRow;
      const stateValue =
        (row && (row.id || row.link_code || row.email)) ||
        (currentUser && currentUser.user_email) ||
        null;

      if (!stateValue) {
        alert('No se pudo preparar el enlace con Discord (sin identificador). Intenta volver a iniciar sesión.');
        return;
      }

      const hasQuery = discordOAuthBaseUrl.includes('?');
      const sep = hasQuery ? '&' : '?';
      const url = `${discordOAuthBaseUrl}${sep}state=${encodeURIComponent(String(stateValue))}`;
      window.open(url, '_blank');

      // Después de abrir la ventana de autorización, empezamos a consultar Supabase
      // para detectar cuándo se complete la vinculación y refrescar la vista.
      startDiscordLinkPolling();
    });
  }

  document.getElementById('btnMinimize').addEventListener('click', () => window.electronAPI.minimize());
  document.getElementById('btnClose').addEventListener('click', () => window.electronAPI.close());
})();
