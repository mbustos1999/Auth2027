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
  const mercadopagoHeaderStatusIconTopEl = document.getElementById('mercadopagoHeaderStatusIconTop');
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
    // Seguridad adicional: no permitir abrir pestañas restringidas
    if (!canAccessTab(tabName)) return;
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
    // Al abrir Perfil, solo refrescamos la UI desde el estado actual en memoria
    if (tabName === 'profile') {
      updateDiscordUI();
    }
  }

  dashTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (!tab) return;

      // Bloquear navegación si el ítem está marcado como bloqueado
      if (btn.classList.contains('dash-nav-item--locked')) {
        // Solo mostramos el tooltip (title) configurado en el botón.
        // No abrimos ningún popup extra.
        return;
      }

      activateTab(tab);
    });
  });

  function canAccessTab(tabName) {
    // Perfil siempre accesible
    if (tabName === 'profile') return true;

    const row = currentDiscordRow;
    const hasRow = !!row;
    const linked = hasRow && !!row.discord_id && String(row.status).toLowerCase() === 'linked';
    const roles = Array.isArray(row?.roles) ? row.roles.map((r) => String(r)) : [];

    const { canAccessProtected } = evaluateAccessFlags(linked, roles);
    // Cualquier pestaña distinta de "profile" se considera protegida
    return canAccessProtected;
  }

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
    const normalized = (status || '').toLowerCase();
    const hasStatus = !!normalized;

    const isAuthorized =
      normalized === 'authorized' || normalized === 'active' || normalized === 'sub_activa';

    function applyToElement(el, okClass, badClass) {
      if (!el) return;

      if (!hasStatus) {
        el.hidden = true;
        el.classList.remove(okClass, badClass);
        el.innerHTML = '';
        return;
      }

      el.hidden = false;
      el.classList.toggle(okClass, isAuthorized);
      el.classList.toggle(badClass, !isAuthorized);

      if (isAuthorized) {
        el.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      } else {
        el.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      }
    }

    // Icono dentro de la tarjeta Perfil (MercadoPago)
    applyToElement(
      mercadopagoHeaderStatusIconEl,
      'mercadopago-header-status-icon--ok',
      'mercadopago-header-status-icon--bad'
    );

    // Icono en el header principal
    applyToElement(
      mercadopagoHeaderStatusIconTopEl,
      'dash-mercado-status-icon--ok',
      'dash-mercado-status-icon--bad'
    );
  }

  async function fetchMercadoPagoAndSave() {
    if (!currentUser || !currentUser.user_email) {
      setMercadoPagoUI('error');
      updateMercadoPagoHeaderIcon('error');
      return;
    }
    const email = currentUser.user_email;

    setMercadoPagoUI('loading');

    let statusToSave = 'error';
    let dataToSave = null;

    try {
      const mpUrl = `http://localhost:4000/mp/status?email=${encodeURIComponent(email)}`;
      const res = await fetch(mpUrl);
      const payload = await res.json().catch(() => ({}));

      if (!res.ok || !payload || !payload.success) {
        setMercadoPagoUI('error');
        statusToSave = 'error';
      } else {
        statusToSave = payload.mercadopago_status || 'not_found';
        dataToSave = payload.mercadopago_data || null;

        const meta = (dataToSave && dataToSave.meta) || {};
        const effective = (meta.effective_status || statusToSave || '').toLowerCase();
        const uiLabel = meta.ui_label || (effective === 'active' ? 'Sub activa' : effective || '-');

        if (effective === 'active') {
          setMercadoPagoUI('found', uiLabel);
        } else if (statusToSave === 'not_found') {
          setMercadoPagoUI('not_found');
        } else {
          setMercadoPagoUI('error');
        }

        // Rellenar detalles si tenemos datos
        const results = Array.isArray(dataToSave?.results) ? dataToSave.results : [];
        const first = results[0] || null;
        if (first) {
          const reason =
            first.reason ||
            (first.auto_recurring && first.auto_recurring.reason) ||
            '-';
          const chargedAmount =
            first.charged_amount ||
            (first.auto_recurring && first.auto_recurring.transaction_amount) ||
            '-';

          const payerFirstName =
            first.payer_first_name ||
            (first.payer && (first.payer.first_name || first.payer.name)) ||
            '';
          const payerLastName =
            first.payer_last_name ||
            (first.payer && (first.payer.last_name || first.payer.surname)) ||
            '';

          const payerName =
            (payerFirstName || payerLastName)
              ? `${payerFirstName} ${payerLastName}`.trim()
              : '-';

          const rawStatus =
            first.status ||
            meta.raw_status ||
            '-';

          const daysLeft =
            typeof meta.days_left === 'number' ? meta.days_left : null;

          if (mercadopagoReasonEl) mercadopagoReasonEl.textContent = String(reason);
          if (mercadopagoAmountEl) mercadopagoAmountEl.textContent = String(chargedAmount);
          if (mercadopagoPayerNameEl) mercadopagoPayerNameEl.textContent = payerName;
          if (mercadopagoStatusRawEl) mercadopagoStatusRawEl.textContent = String(rawStatus);
          if (mercadopagoDaysLeftEl) {
            mercadopagoDaysLeftEl.textContent =
              daysLeft != null ? `${daysLeft} día${daysLeft === 1 ? '' : 's'}` : '-';
          }
        }
      }
    } catch (_) {
      setMercadoPagoUI('error');
      statusToSave = 'error';
    }

    updateMercadoPagoHeaderIcon(statusToSave);

    // La actualización en Supabase ya la realiza el bot en /mp/status con service_role.
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

    // Actualizar panel de roles y permisos de menú
    const roles = Array.isArray(row?.roles) ? row.roles.map((r) => String(r)) : [];

    if (linked) {
      discordUsernameLabel.textContent = row.discord_username || '(sin nombre)';
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

    updateMenuAccess(linked, roles);
  }

  function evaluateAccessFlags(isLinked, roles) {
    const normalizedRoles = roles.map((r) => r.toLowerCase());

    const adminRoles = ['admin', '🛡️・𝑨𝑫𝑴𝑰𝑵 𝑺・🛡️'.toLowerCase()];
    const subscriptionRoles = [
      'anclado',
      'arg-6m',
      'arg-1m',
      'argenmod argentina mensual',
      'arg-3m',
      'chile-1 mes'
    ].map((r) => r.toLowerCase());

    const hasAdminRole = normalizedRoles.some((r) => adminRoles.includes(r));
    const hasSubRole = normalizedRoles.some((r) => subscriptionRoles.includes(r));
    const canAccessProtected = isLinked && (hasAdminRole || hasSubRole);

    return { normalizedRoles, hasAdminRole, hasSubRole, canAccessProtected };
  }

  function updateMenuAccess(isLinked, roles) {
    const { canAccessProtected } = evaluateAccessFlags(isLinked, roles);

    dashTabs.forEach((btn) => {
      const tab = btn.getAttribute('data-tab');
      if (!tab) return;

      const isProfile = tab === 'profile';

      // Perfil siempre accesible
      if (isProfile) {
        btn.classList.remove('dash-nav-item--locked');
        btn.removeAttribute('data-locked');
        btn.removeAttribute('title');
        return;
      }

      if (!isLinked) {
        btn.classList.add('dash-nav-item--locked');
        btn.setAttribute('data-locked', 'unlinked');
        btn.title = 'Debes vincular tu Discord para ver este menú.';
        return;
      }

      if (!canAccessProtected) {
        btn.classList.add('dash-nav-item--locked');
        btn.setAttribute('data-locked', 'no-permission');
        btn.title = 'No tienes los roles necesarios para este menú.';
        return;
      }

      // Tiene permisos completos
      btn.classList.remove('dash-nav-item--locked');
      btn.removeAttribute('data-locked');
      btn.removeAttribute('title');
    });
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
