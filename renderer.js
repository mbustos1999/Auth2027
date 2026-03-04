(function () {
  const panelLogin = document.getElementById('panelLogin');
  const panelDashboard = document.getElementById('panelDashboard');
  const formLogin = document.getElementById('formLogin');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const btnSubmit = document.getElementById('btnSubmit');
  const messageError = document.getElementById('messageError');
  const loginMainLoader = document.getElementById('loginMainLoader');
  const userNameEl = document.getElementById('userName');
  const userAvatarEl = document.getElementById('userAvatar');
  const discordHeaderLinkedEl = document.getElementById('discordHeaderLinked');
  const discordHeaderUnlinkedEl = document.getElementById('discordHeaderUnlinked');
  const btnLogout = document.getElementById('btnLogout');

  const apiConfig = window.apiConfig || {};
  const baseUrl = (apiConfig.baseUrl != null && apiConfig.baseUrl !== '') ? String(apiConfig.baseUrl).trim() : '';
  const authEndpoint = (apiConfig.authEndpoint != null && apiConfig.authEndpoint !== '') ? String(apiConfig.authEndpoint).trim() : '';
  const authUrl = baseUrl && authEndpoint ? `${baseUrl.replace(/\/$/, '')}${authEndpoint}` : '';
  const discordOAuthBaseUrl = (apiConfig.discordOAuthBaseUrl != null && apiConfig.discordOAuthBaseUrl !== '') ? String(apiConfig.discordOAuthBaseUrl).trim() : '';
  const pcName = (apiConfig.pcName != null && apiConfig.pcName !== '') ? String(apiConfig.pcName).trim() : '';
  const botSharedSecret = (apiConfig.botSharedSecret != null && apiConfig.botSharedSecret !== '')
    ? String(apiConfig.botSharedSecret).trim()
    : '';
  // Bot remoto desplegado en Railway
  const BOT_BASE_URL = 'https://auth2027-production.up.railway.app';
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
  const kofiPatreonCardEl = document.getElementById('kofiPatreonCard');
  const kofiStatusBoxEl = document.getElementById('kofiStatusBox');
  const patreonStatusBoxEl = document.getElementById('patreonStatusBox');
  const switcherWrapper = document.getElementById('switcherWrapper');
  const switcherPower = document.getElementById('switcherPower');
  const switcherChannelLabel = document.getElementById('switcherChannelLabel');
  const switcherChannelImage = document.getElementById('switcherChannelImage');
  const switcherTvImage = document.getElementById('switcherTvImage');
  const switcherDropdown = document.getElementById('switcherDropdown');
  const switcherDropdownMenu = document.getElementById('switcherDropdownMenu');
  const switcherSelectedLogo = document.getElementById('switcherSelectedLogo');
  const switcherSelectedName = document.getElementById('switcherSelectedName');
  const switcherTvDropdown = document.getElementById('switcherTvDropdown');
  const switcherTvDropdownMenu = document.getElementById('switcherTvDropdownMenu');
  const switcherSelectedTvLogo = document.getElementById('switcherSelectedTvLogo');
  const switcherSelectedTvName = document.getElementById('switcherSelectedTvName');
  const switcherPubDropdown = document.getElementById('switcherPubDropdown');
  const switcherPubDropdownMenu = document.getElementById('switcherPubDropdownMenu');
  const switcherSelectedPubLogo = document.getElementById('switcherSelectedPubLogo');
  const switcherSelectedPubName = document.getElementById('switcherSelectedPubName');

  let currentUser = null;
  let currentDiscordRow = null;
  let discordLinkPolling = false;
  let loginCooldownUntil = 0;
  let loginCooldownTimeoutId = null;
  let switcherMarkers = [];
  let switcherMarkersLoaded = false;
  let switcherSelectedId = null;
  let switcherTvs = [];
  let switcherTvsLoaded = false;
  let switcherSelectedTvId = null;
  let switcherPublicities = [];
  let switcherPublicitiesLoaded = false;
  let switcherSelectedPubId = null;

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

  function buildBotHeaders(extra = {}) {
    const headers = { ...extra };
    if (botSharedSecret) {
      headers['X-Auth2027-Secret'] = botSharedSecret;
    }
    return headers;
  }

  function isLoginInCooldown() {
    const now = Date.now();
    return loginCooldownUntil > now;
  }

  function startLoginCooldown(seconds) {
    const ms = Math.max(0, Math.floor(seconds * 1000));
    const now = Date.now();
    loginCooldownUntil = now + ms;

    if (loginCooldownTimeoutId) {
      clearTimeout(loginCooldownTimeoutId);
      loginCooldownTimeoutId = null;
    }

    btnSubmit.disabled = true;
    btnSubmit.classList.add('cooldown');

    loginCooldownTimeoutId = setTimeout(() => {
      loginCooldownTimeoutId = null;
      loginCooldownUntil = 0;
      btnSubmit.disabled = false;
      btnSubmit.classList.remove('cooldown');
    }, ms);
  }

  // Switcher: alternar encendido/apagado pantalla CRT
  if (switcherPower && switcherWrapper) {
    const toggleSwitcher = () => {
      if (switcherWrapper.classList.contains('on')) {
        switcherWrapper.classList.remove('on');
        switcherWrapper.classList.add('off');
      } else {
        switcherWrapper.classList.remove('off');
        switcherWrapper.classList.add('on');
      }
    };
    switcherPower.addEventListener('click', toggleSwitcher);
    switcherPower.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleSwitcher();
      }
    });
  }

  async function loadSwitcherMarkersOnce() {
    if (switcherMarkersLoaded) return;
    if (!window.electronAPI || !window.electronAPI.listSwitcherMarkers) return;
    try {
      const list = await window.electronAPI.listSwitcherMarkers();
      if (!Array.isArray(list) || list.length === 0 || !switcherDropdownMenu) {
        switcherMarkersLoaded = true;
        return;
      }
      switcherMarkers = list;
      switcherDropdownMenu.innerHTML = '';

      // Opción "Ninguno" para limpiar marcador y borrar overlay
      const noneBtn = document.createElement('button');
      noneBtn.type = 'button';
      noneBtn.className = 'switcher-dropdown-item';
      const noneSpan = document.createElement('span');
      noneSpan.textContent = 'Ninguno';
      noneBtn.appendChild(noneSpan);
      noneBtn.addEventListener('click', () => {
        clearSwitcherSelection();
        switcherDropdownMenu.hidden = true;
      });
      switcherDropdownMenu.appendChild(noneBtn);

      list.forEach((marker) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'switcher-dropdown-item';
        btn.dataset.markerId = marker.id;

        const img = document.createElement('img');
        img.className = 'switcher-logo';
        if (marker.logoSrc) {
          img.src = marker.logoSrc;
        } else {
          img.hidden = true;
        }

        const span = document.createElement('span');
        span.textContent = marker.name || marker.id;

        btn.appendChild(img);
        btn.appendChild(span);

        btn.addEventListener('click', () => {
          applySwitcherSelection(marker);
          switcherDropdownMenu.hidden = true;
        });

        switcherDropdownMenu.appendChild(btn);
      });
      switcherMarkersLoaded = true;
    } catch (_) {
      switcherMarkersLoaded = true;
    }
  }

  function updateSwitcherChannel(marker) {
    if (!switcherChannelLabel || !switcherChannelImage) return;
    if (marker && marker.markerSrc) {
      switcherChannelLabel.hidden = true;
      switcherChannelImage.hidden = false;
      switcherChannelImage.src = marker.markerSrc;
    } else {
      switcherChannelImage.hidden = true;
      switcherChannelLabel.hidden = false;
      switcherChannelLabel.textContent = 'AV1';
    }
  }

  async function applySwitcherSelection(marker) {
    const idLower = String(marker?.name || marker?.id || '').trim().toLowerCase();
    if (idLower === 'ninguno') {
      await clearSwitcherSelection();
      return;
    }
    switcherSelectedId = marker.id;
    if (switcherSelectedName) {
      switcherSelectedName.textContent = marker.name || marker.id;
    }
    if (switcherSelectedLogo) {
      if (marker.logoSrc) {
        switcherSelectedLogo.hidden = false;
        switcherSelectedLogo.src = marker.logoSrc;
      } else {
        switcherSelectedLogo.hidden = true;
      }
    }
    updateSwitcherChannel(marker);

    if (window.electronAPI && window.electronAPI.applySwitcherMarker) {
      try {
        await window.electronAPI.applySwitcherMarker(marker.id);
      } catch (_) {
        // ignorar errores silenciosamente, la UI sigue funcionando
      }
    }
  }

  async function clearSwitcherSelection() {
    switcherSelectedId = null;
    if (switcherSelectedName) {
      switcherSelectedName.textContent = 'Ninguno';
    }
    if (switcherSelectedLogo) {
      switcherSelectedLogo.hidden = true;
    }
    updateSwitcherChannel(null);

    if (window.electronAPI && window.electronAPI.clearSwitcherOverlay) {
      try {
        await window.electronAPI.clearSwitcherOverlay();
      } catch (_) {
        // ignorar errores
      }
    }
  }

  async function loadSwitcherTvsOnce() {
    if (switcherTvsLoaded) return;
    if (!window.electronAPI || !window.electronAPI.listSwitcherTvs) return;
    try {
      const list = await window.electronAPI.listSwitcherTvs();
      if (!Array.isArray(list) || list.length === 0 || !switcherTvDropdownMenu) {
        switcherTvsLoaded = true;
        return;
      }
      switcherTvs = list;
      switcherTvDropdownMenu.innerHTML = '';

      const noneBtn = document.createElement('button');
      noneBtn.type = 'button';
      noneBtn.className = 'switcher-dropdown-item';
      const noneSpan = document.createElement('span');
      noneSpan.textContent = 'Ninguno';
      noneBtn.appendChild(noneSpan);
      noneBtn.addEventListener('click', () => {
        clearSwitcherTvSelection();
        switcherTvDropdownMenu.hidden = true;
      });
      switcherTvDropdownMenu.appendChild(noneBtn);

      list.forEach((tv) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'switcher-dropdown-item';
        btn.dataset.tvId = tv.id;

        const img = document.createElement('img');
        img.className = 'switcher-logo';
        if (tv.imageSrc) {
          img.src = tv.imageSrc;
        } else {
          img.hidden = true;
        }

        const span = document.createElement('span');
        span.textContent = tv.name || tv.id;

        btn.appendChild(img);
        btn.appendChild(span);

        btn.addEventListener('click', () => {
          applySwitcherTvSelection(tv);
          switcherTvDropdownMenu.hidden = true;
        });

        switcherTvDropdownMenu.appendChild(btn);
      });

      switcherTvsLoaded = true;
    } catch (_) {
      switcherTvsLoaded = true;
    }
  }

  function updateSwitcherTvImage(tv) {
    if (!switcherTvImage) return;
    if (tv && tv.imageSrc) {
      switcherTvImage.hidden = false;
      switcherTvImage.src = tv.imageSrc;
    } else {
      switcherTvImage.hidden = true;
    }
  }

  async function applySwitcherTvSelection(tv) {
    const idLower = String(tv?.name || tv?.id || '').trim().toLowerCase();
    if (idLower === 'ninguno') {
      await clearSwitcherTvSelection();
      return;
    }
    switcherSelectedTvId = tv.id;
    if (switcherSelectedTvName) {
      switcherSelectedTvName.textContent = tv.name || tv.id;
    }
    if (switcherSelectedTvLogo) {
      if (tv.imageSrc) {
        switcherSelectedTvLogo.hidden = false;
        switcherSelectedTvLogo.src = tv.imageSrc;
      } else {
        switcherSelectedTvLogo.hidden = true;
      }
    }
    updateSwitcherTvImage(tv);

    if (window.electronAPI && window.electronAPI.applySwitcherTv) {
      try {
        await window.electronAPI.applySwitcherTv(tv.id);
      } catch (_) {
        // ignorar errores
      }
    }
  }

  async function clearSwitcherTvSelection() {
    switcherSelectedTvId = null;
    if (switcherSelectedTvName) {
      switcherSelectedTvName.textContent = 'Ninguno';
    }
    if (switcherSelectedTvLogo) {
      switcherSelectedTvLogo.hidden = true;
    }
    updateSwitcherTvImage(null);

    if (window.electronAPI && window.electronAPI.clearSwitcherTvOverlay) {
      try {
        await window.electronAPI.clearSwitcherTvOverlay();
      } catch (_) {
        // ignorar errores
      }
    }
  }

  async function loadSwitcherPublicitiesOnce() {
    if (switcherPublicitiesLoaded) return;
    if (!window.electronAPI || !window.electronAPI.listSwitcherPublicities) return;
    try {
      const list = await window.electronAPI.listSwitcherPublicities();
      if (!Array.isArray(list) || list.length === 0 || !switcherPubDropdownMenu) {
        switcherPublicitiesLoaded = true;
        return;
      }
      switcherPublicities = list;
      switcherPubDropdownMenu.innerHTML = '';

      const noneBtn = document.createElement('button');
      noneBtn.type = 'button';
      noneBtn.className = 'switcher-dropdown-item';
      const noneSpan = document.createElement('span');
      noneSpan.textContent = 'Ninguno';
      noneBtn.appendChild(noneSpan);
      noneBtn.addEventListener('click', () => {
        clearSwitcherPubSelection();
        switcherPubDropdownMenu.hidden = true;
      });
      switcherPubDropdownMenu.appendChild(noneBtn);

      list.forEach((pub) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'switcher-dropdown-item';
        btn.dataset.pubId = pub.id;

        const img = document.createElement('img');
        img.className = 'switcher-logo';
        if (pub.imageSrc) {
          img.src = pub.imageSrc;
        } else {
          img.hidden = true;
        }

        const span = document.createElement('span');
        span.textContent = pub.name || pub.id;

        btn.appendChild(img);
        btn.appendChild(span);

        btn.addEventListener('click', () => {
          applySwitcherPubSelection(pub);
          switcherPubDropdownMenu.hidden = true;
        });

        switcherPubDropdownMenu.appendChild(btn);
      });

      switcherPublicitiesLoaded = true;
    } catch (_) {
      switcherPublicitiesLoaded = true;
    }
  }

  async function applySwitcherPubSelection(pub) {
    const idLower = String(pub?.name || pub?.id || '').trim().toLowerCase();
    if (idLower === 'ninguno') {
      await clearSwitcherPubSelection();
      return;
    }

    switcherSelectedPubId = pub.id;
    if (switcherSelectedPubName) {
      switcherSelectedPubName.textContent = pub.name || pub.id;
    }
    if (switcherSelectedPubLogo) {
      if (pub.imageSrc) {
        switcherSelectedPubLogo.hidden = false;
        switcherSelectedPubLogo.src = pub.imageSrc;
      } else {
        switcherSelectedPubLogo.hidden = true;
      }
    }

    if (window.electronAPI && window.electronAPI.applySwitcherPublicity) {
      try {
        await window.electronAPI.applySwitcherPublicity(pub.id);
      } catch (_) {
        // ignorar errores
      }
    }
  }

  async function clearSwitcherPubSelection() {
    switcherSelectedPubId = null;
    if (switcherSelectedPubName) {
      switcherSelectedPubName.textContent = 'Ninguno';
    }
    if (switcherSelectedPubLogo) {
      switcherSelectedPubLogo.hidden = true;
    }

    if (window.electronAPI && window.electronAPI.clearSwitcherPublicity) {
      try {
        await window.electronAPI.clearSwitcherPublicity();
      } catch (_) {
        // ignorar errores
      }
    }
  }

  if (switcherDropdown) {
    switcherDropdown.addEventListener('click', async () => {
      await loadSwitcherMarkersOnce();
      if (!switcherDropdownMenu) return;
      const isHidden = switcherDropdownMenu.hidden;
      switcherDropdownMenu.hidden = !isHidden;
    });
  }

  if (switcherTvDropdown) {
    switcherTvDropdown.addEventListener('click', async () => {
      await loadSwitcherTvsOnce();
      if (!switcherTvDropdownMenu) return;
      const isHidden = switcherTvDropdownMenu.hidden;
      switcherTvDropdownMenu.hidden = !isHidden;
    });
  }

  if (switcherPubDropdown) {
    switcherPubDropdown.addEventListener('click', async () => {
      await loadSwitcherPublicitiesOnce();
      if (!switcherPubDropdownMenu) return;
      const isHidden = switcherPubDropdownMenu.hidden;
      switcherPubDropdownMenu.hidden = !isHidden;
    });
  }

  function setLoading(loading) {
    btnSubmit.disabled = loading;
    btnSubmit.classList.toggle('loading', loading);
    if (loginMainLoader) {
      loginMainLoader.hidden = !loading;
    }
    if (formLogin) {
      formLogin.setAttribute('aria-busy', loading ? 'true' : 'false');
    }
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

      // Límite de intentos desde el servidor (3 intentos fallidos -> bloqueo 60s)
      if (res.status === 429 && data && data.error === 'too_many_attempts') {
        const retryAfter = typeof data.retry_after === 'number' ? data.retry_after : 60;
        startLoginCooldown(retryAfter);
        if (data.message) {
          showError(data.message);
        } else {
          showError('Demasiados intentos fallidos. Espera un momento antes de volver a intentar.');
        }
        return null;
      }

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

    // Sincronizar estado desde Supabase y consultar MercadoPago
    syncUserWithSupabase()
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
    panelLogin.style.display = '';
    panelDashboard.hidden = true;
    panelDashboard.style.display = 'none';
    usernameInput.value = '';
    passwordInput.value = '';
    clearError();
    // Si el usuario marcó "Recordar usuario y contraseña", restaurar desde localStorage
    restoreRememberedCredentials();
    currentUser = null;
    currentDiscordRow = null;
    if (discordHeaderLinkedEl) discordHeaderLinkedEl.hidden = true;
    if (discordHeaderUnlinkedEl) discordHeaderUnlinkedEl.hidden = false;
    setMercadoPagoUI('loading');
    updateMercadoPagoHeaderIcon(null);

    // Al cerrar sesión, revocar siempre acceso al archivo fifa_ng_db.DB
    if (window.electronAPI && typeof window.electronAPI.setGameDbAccess === 'function') {
      window.electronAPI.setGameDbAccess(false);
    }

    // Al cerrar sesión, limpiar también overlays seleccionados
    if (window.electronAPI) {
      if (typeof window.electronAPI.clearSwitcherOverlay === 'function') {
        window.electronAPI.clearSwitcherOverlay();
      }
      if (typeof window.electronAPI.clearSwitcherTvOverlay === 'function') {
        window.electronAPI.clearSwitcherTvOverlay();
      }
      if (typeof window.electronAPI.clearSwitcherPublicity === 'function') {
        window.electronAPI.clearSwitcherPublicity();
      }
    }

    // Pequeña animación al volver a mostrar el login
    panelLogin.classList.remove('panel-login-animate');
    // forzar reflujo para reiniciar la animación
    // eslint-disable-next-line no-unused-expressions
    panelLogin.offsetHeight;
    panelLogin.classList.add('panel-login-animate');
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
    // Al abrir Switcher, cargamos marcadores y TVs (si no se han cargado ya)
    if (tabName === 'Switcher') {
      loadSwitcherMarkersOnce();
      loadSwitcherTvsOnce();
      loadSwitcherPublicitiesOnce();
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
    if (!pcName) return true;

    try {
      const url = `${BOT_BASE_URL}/pc/check-binding?email=${encodeURIComponent(
        email
      )}&pc=${encodeURIComponent(pcName)}`;
      const res = await fetch(url, {
        headers: buildBotHeaders()
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok || !payload || typeof payload.allowed !== 'boolean') {
        // En caso de error del bot, no bloqueamos el login
        return true;
      }

      return !!payload.allowed;
    } catch (_) {
      // En caso de error de red/bot, no bloqueamos el login
      return true;
    }
  }

  // Toda la creación/actualización de filas ahora la hace el bot (service_role).

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
      const mpUrl = `${BOT_BASE_URL}/mp/status?email=${encodeURIComponent(email)}`;
      const res = await fetch(mpUrl, {
        headers: buildBotHeaders()
      });
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
    if (!currentUser) return;
    try {
      const url = `${BOT_BASE_URL}/u/state?email=${encodeURIComponent(
        currentUser.user_email
      )}`;
      const res = await fetch(url, {
        headers: buildBotHeaders()
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok || !payload || !payload.success) {
        currentDiscordRow = null;
        updateDiscordUI();
        return;
      }

      currentDiscordRow = payload.row || null;
      updateDiscordUI();
    } catch (_) {
      currentDiscordRow = null;
      updateDiscordUI();
    }
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

    // Mostrar estado Ko-fi / Patreon según roles del servidor.
    // Regla:
    // - Si el usuario NO está vinculado a Discord -> ocultar todo, SIEMPRE.
    // - Si tiene rol de Ko-fi -> mostrar solo Ko-fi.
    // - Si tiene rol de Patreon -> mostrar solo Patreon.
    // - Si tiene ambos -> mostrar ambos.
    if (kofiPatreonCardEl && kofiStatusBoxEl && patreonStatusBoxEl) {
      if (!linked) {
        // No vinculado: forzamos a ocultar cualquier cosa.
        kofiStatusBoxEl.hidden = true;
        patreonStatusBoxEl.hidden = true;
        kofiPatreonCardEl.hidden = true;
        kofiStatusBoxEl.style.display = 'none';
        patreonStatusBoxEl.style.display = 'none';
        kofiPatreonCardEl.style.display = 'none';
      } else {
        const rolesStr = roles.map((r) => String(r));
        const rolesLower = rolesStr.map((r) => r.toLowerCase());

        // Soportar tanto nombres normales ("Ko-fi", "Patreon") como los estilizados del servidor.
        const hasKofi =
          rolesLower.some((r) => r.includes('ko-fi') || r.includes('kofi')) ||
          rolesStr.some((r) => r.includes('𝙆𝙊𝙁𝙄'));

        const hasPatreon =
          rolesLower.some((r) => r.includes('patreon')) ||
          rolesStr.some((r) => r.includes('𝙋𝘼𝙏𝙍𝙀𝙊𝙉'));

        const showKofi = hasKofi;
        const showPatreon = hasPatreon;
        const showAny = showKofi || showPatreon;

        kofiStatusBoxEl.hidden = !showKofi;
        patreonStatusBoxEl.hidden = !showPatreon;
        kofiPatreonCardEl.hidden = !showAny;

        kofiStatusBoxEl.style.display = showKofi ? '' : 'none';
        patreonStatusBoxEl.style.display = showPatreon ? '' : 'none';
        kofiPatreonCardEl.style.display = showAny ? '' : 'none';
      }
    }

    updateMenuAccess(linked, roles);
  }

  function evaluateAccessFlags(isLinked, roles) {
    const rolesStr = roles.map((r) => String(r));
    const normalizedRoles = rolesStr.map((r) => r.toLowerCase());

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

    // Considerar también roles de Ko-fi / Patreon como suscripción válida.
    const hasKofiSub =
      normalizedRoles.some((r) => r.includes('ko-fi') || r.includes('kofi')) ||
      rolesStr.some((r) => r.includes('𝙆𝙊𝙁𝙄'));

    const hasPatreonSub =
      normalizedRoles.some((r) => r.includes('patreon')) ||
      rolesStr.some((r) => r.includes('𝙋𝘼𝙏𝙍𝙀𝙊𝙉'));

    const hasBaseSubRole = normalizedRoles.some((r) => subscriptionRoles.includes(r));
    const hasSubRole = hasBaseSubRole || hasKofiSub || hasPatreonSub;

    const canAccessProtected = isLinked && (hasAdminRole || hasSubRole);

    return {
      normalizedRoles,
      hasAdminRole,
      hasSubRole,
      canAccessProtected
    };
  }

  let lastGameDbAccess = false;

  function updateMenuAccess(isLinked, roles) {
    const { canAccessProtected, hasAdminRole } = evaluateAccessFlags(isLinked, roles);

    dashTabs.forEach((btn) => {
      const tab = btn.getAttribute('data-tab');
      if (!tab) return;

      const isProfile = tab === 'profile';
      const isUsersTab = tab === 'users';

      // Perfil siempre accesible
      if (isProfile) {
        btn.classList.remove('dash-nav-item--locked');
        btn.removeAttribute('data-locked');
        btn.removeAttribute('title');
        return;
      }

      // Menú Usuarios: requiere admin sí o sí
      if (isUsersTab) {
        if (!isLinked || !hasAdminRole) {
          btn.classList.add('dash-nav-item--locked');
          btn.setAttribute('data-locked', 'admin-only');
          btn.title = 'Este menú solo está disponible para administradores.';
          return;
        }
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

    // Controlar acceso al archivo fifa_ng_db.DB según permisos de Discord
    const hasGameAccess = !!(isLinked && canAccessProtected);
    if (window.electronAPI && typeof window.electronAPI.setGameDbAccess === 'function') {
      if (hasGameAccess !== lastGameDbAccess) {
        lastGameDbAccess = hasGameAccess;
        window.electronAPI.setGameDbAccess(hasGameAccess);
      }
    }
  }

  const rememberMe = document.getElementById('rememberMe');

  function restoreRememberedCredentials() {
    // Cargar credenciales guardadas (si el usuario eligió recordarlas)
    try {
      const savedRaw = localStorage.getItem('auth2027_remember');
      if (!savedRaw) return;
      const saved = JSON.parse(savedRaw);
      if (!saved || typeof saved !== 'object') return;
      if (saved.u) usernameInput.value = saved.u;
      if (saved.p) passwordInput.value = saved.p;
      if (rememberMe) rememberMe.checked = true;
    } catch (_) {
      // ignorar errores de JSON / storage
    }
  }

  // Al iniciar la app, rellenar si había "Recordar usuario y contraseña"
  restoreRememberedCredentials();

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (isLoginInCooldown()) {
      const remainingMs = loginCooldownUntil - Date.now();
      const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
      showError(`Has superado el número de intentos. Espera ${remainingSec} segundo(s) antes de volver a intentar.`);
      return;
    }

    if (!username || !password) {
      showError('Introduce usuario o email y contraseña.');
      return;
    }

    const user = await login(username, password);
    if (user) {
      // Validar que la cuenta esté anclada (o se ancle ahora) a este PC
      let pcOk = true;
      if (pcName) {
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

  // Admin usuarios
  const usersAdminErrorEl = document.getElementById('usersAdminError');
  const usersAdminRefreshBtn = document.getElementById('usersAdminRefresh');
  const usersAdminTableBody = document.getElementById('usersAdminTableBody');
  const usersAdminFilterEmail = document.getElementById('usersAdminFilterEmail');
  const usersAdminFilterDiscord = document.getElementById('usersAdminFilterDiscord');
  const userEditModal = document.getElementById('userEditModal');
  const userEditEmailInput = document.getElementById('userEditEmail');
  const userEditDiscordInput = document.getElementById('userEditDiscord');
  const userEditStatusSelect = document.getElementById('userEditStatus');
  const userEditPcNameInput = document.getElementById('userEditPcName');
  const userEditErrorEl = document.getElementById('userEditError');
  const userEditCancelBtn = document.getElementById('userEditCancel');
  const userEditSaveBtn = document.getElementById('userEditSave');
  let userEditCurrentId = null;
  let usersAdminCache = [];

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

  // --- Admin: gestión de usuarios ---

  function clearUsersAdminError() {
    if (!usersAdminErrorEl) return;
    usersAdminErrorEl.hidden = true;
    usersAdminErrorEl.textContent = '';
  }

  function showUsersAdminError(msg) {
    if (!usersAdminErrorEl) return;
    usersAdminErrorEl.textContent = msg;
    usersAdminErrorEl.hidden = false;
  }

  function openUserEditModal(row) {
    if (!userEditModal) return;
    userEditCurrentId = row.id;
    userEditEmailInput.value = row.email || '';
    userEditDiscordInput.value = row.discord_username || row.discord_id || '';
    userEditStatusSelect.value = row.status || 'pending';
    userEditPcNameInput.value = row.pc_name || '';
    userEditErrorEl.hidden = true;
    userEditErrorEl.textContent = '';
    userEditModal.hidden = false;
  }

  function closeUserEditModal() {
    if (!userEditModal) return;
    userEditCurrentId = null;
    userEditModal.hidden = true;
  }

  function pickMercadoPagoLabel(row) {
    if (!row) return '-';

    const status = (row.mercadopago_status || '').toString().toLowerCase();

    // Sin plan registrado
    if (!status || status === 'not_found') {
      return 'Sin plan';
    }

    let data = row.mercadopago_data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (_) {
        data = null;
      }
    }

    const meta = data && typeof data === 'object' ? data.meta || {} : {};

    const effective = (meta.effective_status || status || '').toString().toLowerCase();
    const uiLabelRaw = meta.ui_label || status || '-';

    let label = uiLabelRaw;
    // Normalizar algunos textos
    if (effective === 'active') {
      label = 'Sub activa';
    } else if (effective === 'pending') {
      label = 'Sub pendiente';
    } else if (effective === 'cancelled') {
      label = 'Sub cancelada';
    } else if (effective === 'paused') {
      label = 'Sub pausada';
    } else if (effective === 'expired') {
      label = 'Sub expirada';
    }

    const daysLeft =
      typeof meta.days_left === 'number' ? meta.days_left : null;

    if (daysLeft != null && daysLeft >= 0) {
      const suffix =
        daysLeft === 1 ? '1 día' : `${daysLeft} días`;
      return `${label} (${suffix})`;
    }

    return label;
  }

  function pickDisplayRole(roles) {
    if (!Array.isArray(roles) || roles.length === 0) return '-';

    const rolesStr = roles.map((r) => String(r));
    const rolesLower = rolesStr.map((r) => r.toLowerCase());

    const candidates = [
      { type: 'lower', value: 'arg-6m', label: 'arg-6m' },
      { type: 'lower', value: 'arg-1m', label: 'arg-1m' },
      { type: 'lower', value: 'argenmod argentina mensual', label: 'Argenmod Argentina Mensual' },
      { type: 'lower', value: 'arg-3m', label: 'arg-3m' },
      { type: 'lower', value: 'chile-1 mes', label: 'Chile-1 mes' },
      { type: 'exact', value: '☕・𝙈𝙄𝙀𝙈𝘽𝙍𝙊 𝙆𝙊𝙁𝙄', label: '☕・𝙈𝙄𝙀𝙈𝘽𝙍𝙊 𝙆𝙊𝙁𝙀' },
      { type: 'exact', value: '💲・ 𝙋𝘼𝙏𝙍𝙀𝙊𝙉・💲', label: '💲・ 𝙋𝘼𝙏𝙍𝙀𝙊𝙉・💲' },
      { type: 'lower', value: 'admin', label: 'admin' },
      { type: 'exact', value: '🛡️・𝑨𝑫𝑴𝑰𝑵 𝑺・🛡️', label: '🛡️・𝑨𝑫𝑴𝑰𝑵 𝑺・🛡️' }
    ];

    for (const rule of candidates) {
      if (rule.type === 'exact') {
        if (rolesStr.includes(rule.value)) return rule.label;
      } else if (rule.type === 'lower') {
        if (rolesLower.includes(rule.value)) return rule.label;
      }
    }

    return '-';
  }

  function renderAdminUsersTable() {
    if (!usersAdminTableBody) return;

    const emailFilter = (usersAdminFilterEmail?.value || '').trim().toLowerCase();
    const discordFilter = (usersAdminFilterDiscord?.value || '').trim().toLowerCase();

    const filtered = usersAdminCache.filter((row) => {
      const email = (row.email || '').toString().toLowerCase();
      const discord = (
        row.discord_username ||
        row.discord_id ||
        ''
      ).toString().toLowerCase();

      if (emailFilter && !email.includes(emailFilter)) return false;
      if (discordFilter && !discord.includes(discordFilter)) return false;
      return true;
    });

    if (filtered.length === 0) {
      usersAdminTableBody.innerHTML = '<tr><td colspan="7">Sin resultados para este filtro.</td></tr>';
      return;
    }

    usersAdminTableBody.innerHTML = '';

    filtered.forEach((row) => {
      const tr = document.createElement('tr');
      const displayRole = pickDisplayRole(row.roles);
      const mpText = pickMercadoPagoLabel(row);
      const statusText = row.status || '-';

      tr.innerHTML = `
        <td>${row.email || '-'}</td>
        <td>${row.discord_username || row.discord_id || '-'}</td>
        <td>${statusText}</td>
        <td>${displayRole}</td>
        <td>${mpText}</td>
        <td>${row.pc_name || '-'}</td>
        <td>
          <div class="users-admin-actions">
            <button type="button" class="users-admin-btn users-admin-btn--edit" data-user-id="${row.id}">Editar</button>
            <button type="button" class="users-admin-btn users-admin-btn--delete" data-user-id="${row.id}">Eliminar</button>
          </div>
        </td>
      `;

      usersAdminTableBody.appendChild(tr);
    });
  }

  async function fetchAdminUsers() {
    clearUsersAdminError();
    if (!currentUser || !currentUser.user_email) {
      showUsersAdminError('No hay sesión válida.');
      return;
    }
    if (!usersAdminTableBody) return;

    usersAdminTableBody.innerHTML = '<tr><td colspan="7">Cargando usuarios...</td></tr>';

    try {
      const email = encodeURIComponent(currentUser.user_email);
      const res = await fetch(`${BOT_BASE_URL}/admin/users?email=${email}`, {
        headers: buildBotHeaders()
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data || !data.success || !Array.isArray(data.users)) {
        showUsersAdminError(data.message || 'No se pudo cargar la lista de usuarios.');
        usersAdminTableBody.innerHTML = '';
        return;
      }

      usersAdminCache = data.users;
      if (usersAdminCache.length === 0) {
        usersAdminTableBody.innerHTML = '<tr><td colspan="7">No hay usuarios registrados.</td></tr>';
        return;
      }

      renderAdminUsersTable();
    } catch (e) {
      showUsersAdminError('Error de conexión al cargar usuarios.');
      usersAdminTableBody.innerHTML = '';
    }
  }

  async function saveUserEdits() {
    if (!currentUser || !currentUser.user_email || !userEditCurrentId) return;

    try {
      const adminEmail = encodeURIComponent(currentUser.user_email);
      const payload = {
        email: currentUser.user_email,
        id: userEditCurrentId,
        updates: {
          status: userEditStatusSelect.value || 'pending',
          pc_name: userEditPcNameInput.value || null
        }
      };

      const res = await fetch(`${BOT_BASE_URL}/admin/users/update?email=${adminEmail}`, {
        method: 'POST',
        headers: buildBotHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || !data.success) {
        userEditErrorEl.textContent = data.message || 'No se pudieron guardar los cambios.';
        userEditErrorEl.hidden = false;
        return;
      }

      closeUserEditModal();
      await fetchAdminUsers();
    } catch (e) {
      userEditErrorEl.textContent = 'Error de conexión al guardar los cambios.';
      userEditErrorEl.hidden = false;
    }
  }

  async function deleteUserById(id) {
    if (!currentUser || !currentUser.user_email) return;
    if (!id) return;

    const confirmed = window.confirm('¿Seguro que quieres eliminar este usuario? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    clearUsersAdminError();

    try {
      const adminEmail = encodeURIComponent(currentUser.user_email);
      const payload = { email: currentUser.user_email, id };
      const res = await fetch(`${BOT_BASE_URL}/admin/users/delete?email=${adminEmail}`, {
        method: 'POST',
        headers: buildBotHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || !data.success) {
        showUsersAdminError(data.message || 'No se pudo eliminar el usuario.');
        return;
      }

      await fetchAdminUsers();
    } catch (e) {
      showUsersAdminError('Error de conexión al eliminar usuario.');
    }
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

  if (usersAdminRefreshBtn) {
    usersAdminRefreshBtn.addEventListener('click', () => {
      fetchAdminUsers();
    });
  }

  if (usersAdminFilterEmail) {
    usersAdminFilterEmail.addEventListener('input', () => {
      renderAdminUsersTable();
    });
  }

  if (usersAdminFilterDiscord) {
    usersAdminFilterDiscord.addEventListener('input', () => {
      renderAdminUsersTable();
    });
  }

  if (usersAdminTableBody) {
    usersAdminTableBody.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const editBtn = target.closest('.users-admin-btn--edit');
      const deleteBtn = target.closest('.users-admin-btn--delete');

      if (editBtn) {
        const id = editBtn.getAttribute('data-user-id');
        if (!id || !usersAdminTableBody) return;

        const rowEl = editBtn.closest('tr');
        if (!rowEl) return;
        const cells = rowEl.querySelectorAll('td');
        const rowData = {
          id,
          email: cells[0]?.textContent || '',
          discord_username: cells[1]?.textContent || '',
          status: cells[2]?.textContent || '',
          roles: (cells[3]?.textContent || '').split(',').map((s) => s.trim()).filter(Boolean),
          mercadopago_status: cells[4]?.textContent || '',
          pc_name: cells[5]?.textContent || ''
        };
        openUserEditModal(rowData);
      } else if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-user-id');
        if (!id) return;
        deleteUserById(id);
      }
    });
  }

  if (userEditCancelBtn) {
    userEditCancelBtn.addEventListener('click', () => {
      closeUserEditModal();
    });
  }

  if (userEditSaveBtn) {
    userEditSaveBtn.addEventListener('click', () => {
      saveUserEdits();
    });
  }

  document.getElementById('btnMinimize').addEventListener('click', () => window.electronAPI.minimize());
  document.getElementById('btnClose').addEventListener('click', () => window.electronAPI.close());

  // Versión y auto-actualización (solo en app empaquetada)
  const appVersionEl = document.getElementById('appVersion');
  const updateBanner = document.getElementById('updateBanner');
  const updateBannerText = document.getElementById('updateBannerText');
  const btnRestartToUpdate = document.getElementById('btnRestartToUpdate');
  if (window.electronAPI.getAppVersion) {
    window.electronAPI.getAppVersion().then((v) => {
      if (appVersionEl && v) appVersionEl.textContent = 'v' + v;
    }).catch(() => {});
  }
  if (window.electronAPI.onUpdateStatus && updateBanner && updateBannerText && btnRestartToUpdate) {
    window.electronAPI.onUpdateStatus((payload) => {
      if (payload.type === 'update-available') {
        updateBannerText.textContent = 'Nueva versión ' + (payload.version || '') + ' disponible. Descargando…';
        btnRestartToUpdate.hidden = true;
        updateBanner.hidden = false;
      } else if (payload.type === 'update-downloaded') {
        updateBannerText.textContent = 'Actualización lista. Reinicia la aplicación para instalar.';
        btnRestartToUpdate.hidden = false;
        updateBanner.hidden = false;
      } else if (payload.type === 'update-not-available') {
        updateBanner.hidden = true;
      } else if (payload.type === 'error') {
        updateBannerText.textContent = 'Error al buscar actualizaciones.';
        btnRestartToUpdate.hidden = true;
        updateBanner.hidden = false;
      }
    });
  }
  if (btnRestartToUpdate) {
    btnRestartToUpdate.addEventListener('click', () => {
      if (window.electronAPI.quitAndInstall) window.electronAPI.quitAndInstall();
    });
  }
})();
