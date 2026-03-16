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
  const pcName = (apiConfig.pcName != null && apiConfig.pcName !== '') ? String(apiConfig.pcName).trim() : '';
  // Config que puede actualizarse desde main (app empaquetada) o desde el bot (/config). El secreto del bot no se expone al renderer.
  const appConfig = {
    discordOAuthBaseUrl: (apiConfig.discordOAuthBaseUrl != null && apiConfig.discordOAuthBaseUrl !== '') ? String(apiConfig.discordOAuthBaseUrl).trim() : '',
    pcName: (apiConfig.pcName != null && apiConfig.pcName !== '') ? String(apiConfig.pcName).trim() : ''
  };
  // Bot remoto desplegado en Railway
  const BOT_BASE_URL = 'https://auth2027-production.up.railway.app';
  // Manifest de mods FC26 (versión + enlace de descarga); al subir versión nueva se obliga a descargar
  const MODS_MANIFEST_URL = 'https://raw.githubusercontent.com/mbustos1999/Auth2027/main/mods-manifest.json';
  const MODS_VERSION_KEY = 'auth2027_mods_version';

  fetch(`${BOT_BASE_URL}/config`)
    .then((r) => r.json())
    .then((data) => {
      if (data && data.success && data.discordOAuthBaseUrl) {
        appConfig.discordOAuthBaseUrl = String(data.discordOAuthBaseUrl).trim();
      }
    })
    .catch(() => {});
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
  const mercadopagoRequestAccessWrap = document.getElementById('mercadopagoRequestAccessWrap');
  const mercadopagoRequestAccessBtn = document.getElementById('mercadopagoRequestAccessBtn');
  const mercadopagoRejectionMessageEl = document.getElementById('mercadopagoRejectionMessage');
  const mercadopagoRequestSuccessMessageEl = document.getElementById('mercadopagoRequestSuccessMessage');
  const mercadopagoRequestAccessDefaultTextEl = document.getElementById('mercadopagoRequestAccessDefaultText');
  const kofiPatreonCardEl = document.getElementById('kofiPatreonCard');
  const kofiStatusBoxEl = document.getElementById('kofiStatusBox');
  const patreonStatusBoxEl = document.getElementById('patreonStatusBox');
  const teamsHeaderStatusEl = document.getElementById('teamsHeaderStatus');
  const modsOrderHeaderStatusEl = document.getElementById('modsOrderHeaderStatus');
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
  const btnApplySquad = document.getElementById('btnApplySquad');
  const btnDownloadMods = document.getElementById('btnDownloadMods');
  const squadStatusText = document.getElementById('squadStatusText');
  const squadModal = document.getElementById('squadModal');
  const squadModalBackdrop = document.getElementById('squadModalBackdrop');
  const squadModalCloseX = document.getElementById('squadModalCloseX');
  const squadModalMessage = document.getElementById('squadModalMessage');
  const squadModalPrimary = document.getElementById('squadModalPrimary');
  const squadModalClose = document.getElementById('squadModalClose');
  const btnPlayModManager = document.getElementById('btnPlayModManager');
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
  let squadStatusLoaded = false;
  let lastHasGameAccess = false;

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

  /** Obtiene el estado de setup local: orden mods, teams, squad aplicada */
  async function getSetupInfo() {
    if (!window.electronAPI) return { mod_order_ok: null, teams_ok: null, squad_applied: null };
    try {
      const [modRes, teamsRes, squadRes] = await Promise.all([
        window.electronAPI.getModOrderStatus?.() ?? Promise.resolve({ ok: false, correct: false }),
        window.electronAPI.getTeamsStatus?.() ?? Promise.resolve({ ok: false, present: false }),
        window.electronAPI.checkSquadStatus?.() ?? Promise.resolve({ ok: false, applied: false })
      ]);
      return {
        mod_order_ok: modRes?.ok ? !!modRes.correct : null,
        teams_ok: teamsRes?.ok ? !!teamsRes.present : null,
        squad_applied: squadRes?.ok ? !!squadRes.applied : null
      };
    } catch (_) {
      return { mod_order_ok: null, teams_ok: null, squad_applied: null };
    }
  }

  /** Envía el setup info al servidor (login/logout). override: { switcher_abierto?: boolean } */
  async function updateUserSetupInfo(override = {}) {
    if (!currentUser?.user_email || typeof fetchBot !== 'function') return;
    try {
      const info = await getSetupInfo();
      const payload = { ...info, ...override };
      await fetchBot(`${BOT_BASE_URL}/user/setup-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (_) {}
  }

  // Peticiones al bot: si hay electronAPI.fetchBot, el main añade secreto + token de sesión (el renderer no ve el secreto)
  async function fetchBot(url, options = {}) {
    if (window.electronAPI && typeof window.electronAPI.fetchBot === 'function') {
      const res = await window.electronAPI.fetchBot(url, options);
      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText || '',
        json: () => Promise.resolve(res.body ? (() => { try { return JSON.parse(res.body); } catch (_) { return {}; } })() : {})
      };
    }
    return fetch(url, options);
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

  async function updateSquadStatus() {
    if (!squadStatusText || !window.electronAPI || !window.electronAPI.checkSquadStatus) return;
    try {
      const res = await window.electronAPI.checkSquadStatus();
      squadStatusLoaded = true;
      squadStatusText.classList.remove('switcher-squad-status--ok', 'switcher-squad-status--error');
      if (!res || res.ok === false) {
        squadStatusText.textContent = 'No se encontró ninguna squad en la carpeta aplicarSquad.';
        squadStatusText.classList.add('switcher-squad-status--error');
        return;
      }
      if (res.applied) {
        squadStatusText.textContent = 'Squad ya está aplicada en EA SPORTS FC 26.';
        squadStatusText.classList.add('switcher-squad-status--ok');
      } else {
        squadStatusText.textContent = 'Falta aplicar squad.';
        squadStatusText.classList.add('switcher-squad-status--error');
      }
    } catch (_) {
      squadStatusText.textContent = 'No se pudo comprobar el estado de la squad.';
      squadStatusText.classList.add('switcher-squad-status--error');
    }
  }

  async function updateTeamsHeaderStatus(hasGameAccess) {
    if (!teamsHeaderStatusEl) return;
    if (!hasGameAccess || !window.electronAPI || !window.electronAPI.getTeamsStatus) {
      teamsHeaderStatusEl.hidden = true;
      teamsHeaderStatusEl.classList.remove('dash-teams-status--ok', 'dash-teams-status--error');
      return;
    }
    try {
      const res = await window.electronAPI.getTeamsStatus();
      const present = !!(res && res.present);
      teamsHeaderStatusEl.hidden = false;
      teamsHeaderStatusEl.textContent = present ? 'Teams OK' : 'Teams Error';
      teamsHeaderStatusEl.classList.toggle('dash-teams-status--ok', present);
      teamsHeaderStatusEl.classList.toggle('dash-teams-status--error', !present);
    } catch (_) {
      teamsHeaderStatusEl.hidden = false;
      teamsHeaderStatusEl.textContent = 'Teams Error';
      teamsHeaderStatusEl.classList.remove('dash-teams-status--ok');
      teamsHeaderStatusEl.classList.add('dash-teams-status--error');
    }
  }

  async function updateModsOrderHeaderStatus(hasGameAccess) {
    if (!modsOrderHeaderStatusEl) return;
    if (!hasGameAccess || !window.electronAPI || !window.electronAPI.getModOrderStatus) {
      modsOrderHeaderStatusEl.hidden = true;
      modsOrderHeaderStatusEl.classList.remove('dash-mods-order-status--ok', 'dash-mods-order-status--error');
      return;
    }
    try {
      const res = await window.electronAPI.getModOrderStatus();
      const correct = !!(res && res.ok && res.correct);
      modsOrderHeaderStatusEl.hidden = false;
      modsOrderHeaderStatusEl.textContent = correct ? 'Orden de los mods es correcta' : 'Orden de mods incorrecta';
      modsOrderHeaderStatusEl.title = correct ? 'El orden de los mods (Argenmod 1, 2, 3, 4) es correcta' : 'El orden de los mods en Mod Manager es incorrecta. Debe ser: Argenmod 1, 2, 3, 4';
      modsOrderHeaderStatusEl.classList.toggle('dash-mods-order-status--ok', correct);
      modsOrderHeaderStatusEl.classList.toggle('dash-mods-order-status--error', !correct);
    } catch (_) {
      modsOrderHeaderStatusEl.hidden = false;
      modsOrderHeaderStatusEl.textContent = 'Orden de mods incorrecta';
      modsOrderHeaderStatusEl.title = 'El orden de los mods en Mod Manager es incorrecta';
      modsOrderHeaderStatusEl.classList.remove('dash-mods-order-status--ok');
      modsOrderHeaderStatusEl.classList.add('dash-mods-order-status--error');
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

  function openSquadModal() {
    if (!squadModal || !squadModalMessage || !squadModalPrimary || !squadModalClose) return;
    squadModal.hidden = false;
  }

  function closeSquadModal() {
    if (squadModal) squadModal.hidden = true;
  }

  async function showSquadModalWithStatus() {
    if (!window.electronAPI || !window.electronAPI.checkSquadStatus) return;
    if (!squadModal || !squadModalMessage || !squadModalPrimary || !squadModalClose) return;
    try {
      const res = await window.electronAPI.checkSquadStatus();
      squadModalPrimary.hidden = true;
      squadModalPrimary.onclick = null;

      if (!res || res.ok === false) {
        squadModalMessage.textContent = 'No se encontró ninguna squad en la carpeta aplicarSquad.';
        openSquadModal();
        return;
      }

      if (res.applied) {
        squadModalMessage.textContent = 'Ya tienes la squad aplicada en EA SPORTS FC 26. Si aplicas de nuevo, se reemplazará.';
        squadModalPrimary.textContent = 'Reemplazar';
        squadModalPrimary.hidden = false;
        squadModalPrimary.onclick = async () => {
          try {
            await window.electronAPI.applySquad();
            squadModalMessage.textContent = 'Squad reemplazada correctamente.';
            squadModalPrimary.hidden = true;
            squadModalPrimary.onclick = null;
            await updateSquadStatus();
          } catch (_) {
            squadModalMessage.textContent = 'No se pudo aplicar la squad.';
            squadModalPrimary.hidden = true;
          }
        };
      } else {
        squadModalMessage.textContent = 'Falta aplicar squad. Pulsa el botón para aplicarla.';
        squadModalPrimary.textContent = 'Aplicar squad';
        squadModalPrimary.hidden = false;
        squadModalPrimary.onclick = async () => {
          try {
            await window.electronAPI.applySquad();
            squadModalMessage.textContent = 'Squad aplicada correctamente.';
            squadModalPrimary.hidden = true;
            squadModalPrimary.onclick = null;
            await updateSquadStatus();
          } catch (_) {
            squadModalMessage.textContent = 'No se pudo aplicar la squad.';
            squadModalPrimary.hidden = true;
          }
        };
      }
      openSquadModal();
    } catch (_) {
      if (squadModalMessage) squadModalMessage.textContent = 'No se pudo comprobar el estado de la squad.';
      openSquadModal();
    }
  }

  if (btnApplySquad) {
    btnApplySquad.addEventListener('click', () => {
      showSquadModalWithStatus();
    });
  }

  if (squadModalCloseX) squadModalCloseX.addEventListener('click', closeSquadModal);
  if (squadModalBackdrop) squadModalBackdrop.addEventListener('click', closeSquadModal);
  if (squadModalClose) squadModalClose.addEventListener('click', closeSquadModal);

  if (btnDownloadMods) {
    btnDownloadMods.addEventListener('click', () => {
      checkModsRequiredAndShowModal(true);
    });
  }

  const LAUNCHER_OPENED_KEY = 'auth2027_launcher_opened';
  const launcherRequiredModal = document.getElementById('launcherRequiredModal');
  const launcherRequiredConfirm = document.getElementById('launcherRequiredConfirm');
  const playChoiceModal = document.getElementById('playChoiceModal');
  const playChoiceJugarBtn = document.getElementById('playChoiceJugar');
  const playChoiceLiveEditorBtn = document.getElementById('playChoiceLiveEditor');

  function closePlayChoiceModal() {
    if (playChoiceModal) playChoiceModal.hidden = true;
  }

  function showLauncherRequiredIfNeeded(launcherRes) {
    if (!window.electronAPI || !window.electronAPI.launchLauncher) return;
    if (launcherRes && launcherRes.ok === true) {
      try { localStorage.setItem(LAUNCHER_OPENED_KEY, '1'); } catch (_) {}
    } else {
      const alreadyAccepted = !!localStorage.getItem(LAUNCHER_OPENED_KEY);
      if (!alreadyAccepted && launcherRequiredModal) launcherRequiredModal.hidden = false;
    }
  }

  if (btnPlayModManager) {
    btnPlayModManager.addEventListener('click', () => {
      if (playChoiceModal) playChoiceModal.hidden = false;
    });
  }

  const arrowStepsToggle = document.getElementById('arrowStepsToggle');
  const arrowStepsBody = document.getElementById('arrowStepsBody');
  const arrowStepsContainer = document.getElementById('arrowStepsContainer');
  if (arrowStepsToggle && arrowStepsBody && arrowStepsContainer) {
    arrowStepsToggle.addEventListener('click', () => {
      const isOpen = arrowStepsContainer.classList.toggle('is-open');
      arrowStepsToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  const tutorialSlider = document.getElementById('tutorialSlider');
  const tutorialPrev = document.getElementById('tutorialPrev');
  const tutorialNext = document.getElementById('tutorialNext');
  const tutorialTrail = document.getElementById('tutorialTrail');
  const TUTORIAL_SLIDES = 4;
  let tutorialIndex = 0;

  function tutorialSlideTo(index) {
    tutorialIndex = Math.max(0, Math.min(index, TUTORIAL_SLIDES - 1));
    const percent = tutorialIndex * 25;
    if (tutorialSlider) tutorialSlider.style.transform = `translateX(-${percent}%)`;
    const items = tutorialTrail && tutorialTrail.querySelectorAll('.tutorial-trail-item');
    if (items) {
      items.forEach((el, i) => el.classList.toggle('active', i === tutorialIndex));
    }
  }

  function tutorialSlideNext() {
    tutorialSlideTo(tutorialIndex < TUTORIAL_SLIDES - 1 ? tutorialIndex + 1 : 0);
  }

  function tutorialSlidePrev() {
    tutorialSlideTo(tutorialIndex > 0 ? tutorialIndex - 1 : TUTORIAL_SLIDES - 1);
  }

  if (tutorialPrev) tutorialPrev.addEventListener('click', tutorialSlidePrev);
  if (tutorialNext) tutorialNext.addEventListener('click', tutorialSlideNext);
  if (tutorialTrail) {
    tutorialTrail.addEventListener('click', (e) => {
      const item = e.target && e.target.closest('.tutorial-trail-item');
      if (!item) return;
      const idx = parseInt(item.getAttribute('data-index'), 10);
      if (Number.isFinite(idx)) tutorialSlideTo(idx);
    });
  }

  if (playChoiceModal) {
    const playChoiceBackdrop = playChoiceModal.querySelector('.recover-modal-backdrop');
    if (playChoiceBackdrop) playChoiceBackdrop.addEventListener('click', closePlayChoiceModal);
  }

  if (playChoiceLiveEditorBtn) {
    playChoiceLiveEditorBtn.addEventListener('click', async () => {
      closePlayChoiceModal();
      if (window.electronAPI && window.electronAPI.launchLauncher) {
        try {
          const launcherRes = await window.electronAPI.launchLauncher();
          showLauncherRequiredIfNeeded(launcherRes);
        } catch (_) {
          showLauncherRequiredIfNeeded({ ok: false });
        }
      }
    });
  }

  if (playChoiceJugarBtn) {
    playChoiceJugarBtn.addEventListener('click', async () => {
      closePlayChoiceModal();
      const api = window.electronAPI;
      const promises = [];
      if (api && api.launchModManager) {
        promises.push(api.launchModManager().catch(() => null));
      }
      if (api && api.launchLauncher) {
        promises.push(api.launchLauncher().catch(() => ({ ok: false })));
      }
      const results = await Promise.all(promises);
      const hasModManager = !!(api && api.launchModManager);
      const modManagerRes = hasModManager ? results[0] : null;
      const launcherRes = api && api.launchLauncher ? (hasModManager ? results[1] : results[0]) : null;
      if (modManagerRes && modManagerRes.ok === false) {
        const msg = modManagerRes.reason === 'not_found'
          ? 'No se encontró FIFA Mod Manager.exe en la carpeta modManager.'
          : 'No se pudo abrir FIFA Mod Manager.';
        alert(msg);
      }
      if (launcherRes) showLauncherRequiredIfNeeded(launcherRes);
    });
  }

  if (launcherRequiredConfirm && launcherRequiredModal) {
    launcherRequiredConfirm.addEventListener('click', () => {
      try { localStorage.setItem(LAUNCHER_OPENED_KEY, '1'); } catch (_) {}
      launcherRequiredModal.hidden = true;
    });
  }
  if (launcherRequiredModal) {
    const backdrop = launcherRequiredModal.querySelector('.recover-modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        launcherRequiredModal.hidden = true;
      });
    }
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
        : (hasConfig ? 'Error' : 'Error');
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
          showError('Error');
        } else {
          showError(data.message);
        }
      } else if (res.status === 404) {
        showError('El usuario no está registrado en la página.');
      } else if (res.status === 401) {
        showError('La contraseña es incorrecta.');
      } else {
        showError('Error de conexión. Comprueba la URL');
      }
      return null;
    } catch (err) {
      showError('No se pudo conectar. Comprueba la URL');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function solicitarRecuperacionPassword(email) {
    const recoverUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/wp-json/argenmod/v1/recuperar-password` : '';
    if (!recoverUrl) {
      showError('Error');
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

  async function showDashboard(user) {
    // Registrar sesión en main para que las peticiones al bot lleven token firmado (email)
    if (window.electronAPI && typeof window.electronAPI.setSessionUser === 'function') {
      try {
        await window.electronAPI.setSessionUser(user.user_email || '');
      } catch (_) {}
    }
    if (window.electronAPI && typeof window.electronAPI.getConfig === 'function') {
      try {
        const c = await window.electronAPI.getConfig();
        if (c && typeof c === 'object') {
          if (c.discordOAuthBaseUrl) appConfig.discordOAuthBaseUrl = String(c.discordOAuthBaseUrl).trim();
          if (c.pcName != null && String(c.pcName).trim() !== '') appConfig.pcName = String(c.pcName).trim();
        }
      } catch (_) {}
    }

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

    // Actualizar setup info (mod order, teams, squad, switcher abierto) en el servidor al abrir sesión
    updateUserSetupInfo({ switcher_abierto: true }).catch(() => {});

    // Al entrar al dashboard, ir directamente a la pestaña Perfil
    activateTab('profile');
  }

  async function showLogin() {
    // Actualizar setup info al cerrar sesión (switcher cerrado, antes de limpiar el token)
    if (currentUser?.user_email) {
      try { await updateUserSetupInfo({ switcher_abierto: false }); } catch (_) {}
    }
    if (window.electronAPI && typeof window.electronAPI.clearSessionUser === 'function') {
      try { window.electronAPI.clearSessionUser(); } catch (_) {}
    }
    panelLogin.hidden = false;
    panelLogin.style.display = '';
    panelDashboard.hidden = true;
    panelDashboard.style.display = 'none';
    usernameInput.value = '';
    passwordInput.value = '';
    clearError();
    restoreRememberedCredentials();
    currentUser = null;
    currentDiscordRow = null;
    stopAccessRequestPolling();
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
    // Al abrir Perfil, refrescar siempre el estado Discord (roles) desde el servidor si hay usuario anclado
    if (tabName === 'profile') {
      if (currentUser) {
        refreshDiscordFromSupabase().catch(() => {});
      } else {
        updateDiscordUI();
      }
    }
    // Al abrir Switcher, comprobamos mods obligatorios y cargamos marcadores/TVs
    if (tabName === 'Switcher') {
      checkModsRequiredAndShowModal();
      loadSwitcherMarkersOnce();
      loadSwitcherTvsOnce();
      loadSwitcherPublicitiesOnce();
      if (!squadStatusLoaded) {
        updateSquadStatus();
      }
    }
    if (tabName === 'home') loadHomeCards();
    if (tabName === 'config') loadConfigCards();
    if (tabName === 'users') fetchAdminUsers();
    if (tabName === 'mpAdmin') {
      loadMpAdminPendingCount();
      loadMpAdminPendingRequests();
      loadMpAdminSwitcherOnline();
    }
    if (tabName === 'bugs') {
      loadBugsAdminChart();
      loadBugsAdminList();
    }
  }

  async function loadHomeCards() {
    const grid = document.getElementById('inicioMarvelGrid');
    if (!grid) return;
    try {
      const res = await fetchBot(`${BOT_BASE_URL}/home-cards`);
      const data = await res.json().catch(() => ({}));
      const cards = Array.isArray(data.cards) ? data.cards : [];
      grid.innerHTML = cards
        .map(
          (c) => `
          <div class="box">
            <p class="marvel">${escapeHtml(c.title || 'MARVEL')}</p>
            <img src="${escapeHtml(c.image_url || '')}" alt="" class="model" onerror="this.style.display='none'">
            <div class="details">
              <img src="${escapeHtml(c.logo_url || '')}" alt="" class="logo" onerror="this.style.display='none'">
              <p>${escapeHtml(c.description || '')}</p>
            </div>
          </div>`
        )
        .join('');
    } catch (_) {
      grid.innerHTML = '';
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    const s = String(str);
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /** Solo permite URLs http/https para href (evita javascript:, file:, etc.) */
  function safeUrlForHref(url) {
    if (!url || typeof url !== 'string') return '';
    const u = url.trim();
    if (u.startsWith('https://') || u.startsWith('http://')) return escapeHtml(u);
    return '';
  }

  /** Formatea un valor booleano de setup (✓ verde, ✗ roja, ? amarillo) */
  function formatSetupCell(val) {
    if (val === true) return '<span class="setup-cell setup-cell--ok">✓</span>';
    if (val === false) return '<span class="setup-cell setup-cell--error">✗</span>';
    return '<span class="setup-cell setup-cell--unknown">?</span>';
  }

  /** Formatea mod_order_ok, teams_ok, squad_applied para mostrar (HTML con colores) */
  function formatSetupInfo(obj) {
    if (!obj || typeof obj !== 'object') return '';
    const mod = obj.mod_order_ok;
    const teams = obj.teams_ok;
    const squad = obj.squad_applied;
    if (mod == null && teams == null && squad == null) return '-';
    return `Mods ${formatSetupCell(mod)} · Teams ${formatSetupCell(teams)} · Squad ${formatSetupCell(squad)}`;
  }

  let configCardsCache = [];

  async function loadConfigCards() {
    if (!currentUser || !currentUser.user_email) return;
    const list = document.getElementById('configCardsList');
    const errEl = document.getElementById('configCardsError');
    if (!list) return;
    if (errEl) errEl.hidden = true;
    try {
      const res = await fetchBot(
        `${BOT_BASE_URL}/admin/home-cards?email=${encodeURIComponent(currentUser.user_email)}`
      );
      const data = await res.json().catch(() => ({}));
      configCardsCache = Array.isArray(data.cards) ? data.cards : [];
      list.innerHTML = configCardsCache
        .map(
          (c) => `
          <div class="config-card-row" data-id="${escapeHtml(c.id)}">
            <span class="config-card-title">${escapeHtml(c.title || '-')}</span>
            <span class="config-card-desc">${escapeHtml((c.description || '').slice(0, 50))}${(c.description || '').length > 50 ? '…' : ''}</span>
            <div class="config-card-actions">
              <button type="button" class="config-card-btn config-card-edit" data-id="${escapeHtml(c.id)}">Editar</button>
              <button type="button" class="config-card-btn config-card-delete" data-id="${escapeHtml(c.id)}">Eliminar</button>
            </div>
          </div>`
        )
        .join('');
      if (configCardsCache.length === 0) list.innerHTML = '<p class="config-no-cards">No hay tarjetas. Añade una con «Nueva tarjeta».</p>';
    } catch (e) {
      if (errEl) {
        errEl.textContent = 'No se pudieron cargar las tarjetas.';
        errEl.hidden = false;
      }
      list.innerHTML = '';
    }
  }

  function openConfigCardModal(card) {
    const modal = document.getElementById('configCardModal');
    const titleEl = document.getElementById('configCardModalTitle');
    document.getElementById('configCardId').value = card ? card.id : '';
    document.getElementById('configCardTitle').value = card ? card.title || '' : '';
    document.getElementById('configCardImageUrl').value = card ? card.image_url || '' : '';
    document.getElementById('configCardLogoUrl').value = card ? card.logo_url || '' : '';
    document.getElementById('configCardDescription').value = card ? card.description || '' : '';
    document.getElementById('configCardSortOrder').value = card != null && card.sort_order != null ? card.sort_order : 0;
    const errEl = document.getElementById('configCardModalError');
    if (errEl) errEl.hidden = true;
    if (titleEl) titleEl.textContent = card ? 'Editar tarjeta' : 'Nueva tarjeta';
    if (modal) modal.hidden = false;
  }

  function closeConfigCardModal() {
    const modal = document.getElementById('configCardModal');
    if (modal) modal.hidden = true;
  }

  async function saveConfigCard() {
    if (!currentUser || !currentUser.user_email) return;
    const id = document.getElementById('configCardId').value.trim();
    const title = document.getElementById('configCardTitle').value.trim() || 'MARVEL';
    const image_url = document.getElementById('configCardImageUrl').value.trim();
    const logo_url = document.getElementById('configCardLogoUrl').value.trim();
    const description = document.getElementById('configCardDescription').value.trim();
    const sort_order = parseInt(document.getElementById('configCardSortOrder').value, 10) || 0;
    const errEl = document.getElementById('configCardModalError');
    if (errEl) errEl.hidden = true;
    const adminEmail = encodeURIComponent(currentUser.user_email);
    try {
      if (id) {
        const res = await fetchBot(`${BOT_BASE_URL}/admin/home-cards/update?email=${adminEmail}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, title, image_url, logo_url, description, sort_order })
        });
        const data = await res.json().catch(() => ({}));
        if (!data.success) {
          if (errEl) { errEl.textContent = data.message || 'Error al guardar'; errEl.hidden = false; }
          return;
        }
      } else {
        const res = await fetchBot(`${BOT_BASE_URL}/admin/home-cards?email=${adminEmail}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, image_url, logo_url, description, sort_order })
        });
        const data = await res.json().catch(() => ({}));
        if (!data.success) {
          if (errEl) { errEl.textContent = data.message || 'Error al crear'; errEl.hidden = false; }
          return;
        }
      }
      closeConfigCardModal();
      loadConfigCards();
      loadHomeCards();
    } catch (e) {
      if (errEl) { errEl.textContent = 'Error de conexión.'; errEl.hidden = false; }
    }
  }

  async function deleteConfigCard(cardId) {
    if (!currentUser || !currentUser.user_email || !cardId) return;
    if (!confirm('¿Eliminar esta tarjeta?')) return;
    const adminEmail = encodeURIComponent(currentUser.user_email);
    try {
      const res = await fetchBot(`${BOT_BASE_URL}/admin/home-cards/delete?email=${adminEmail}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cardId })
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        loadConfigCards();
        loadHomeCards();
      } else {
        alert(data.message || 'Error al eliminar');
      }
    } catch (_) {
      alert('Error de conexión.');
    }
  }

  function setupConfigPanel() {
    const btnClearCache = document.getElementById('btnClearCache');
    const clearCacheMessage = document.getElementById('configClearCacheMessage');
    if (btnClearCache) {
      btnClearCache.addEventListener('click', async () => {
        if (!window.electronAPI?.clearCache) return;
        if (clearCacheMessage) {
          clearCacheMessage.hidden = true;
          clearCacheMessage.classList.remove('message-error', 'message-success');
        }
        btnClearCache.disabled = true;
        try {
          const result = await window.electronAPI.clearCache();
          if (clearCacheMessage) {
            clearCacheMessage.hidden = false;
            if (result && result.ok === false) {
              clearCacheMessage.textContent = result.message || 'Error al borrar caché.';
              clearCacheMessage.classList.add('message-error');
            } else {
              clearCacheMessage.textContent = 'Caché borrada correctamente.';
              clearCacheMessage.classList.add('message-success');
            }
          } else {
            if (result && result.ok === false) {
              alert(result.message || 'Error al borrar caché.');
            } else {
              alert('Caché borrada correctamente.');
            }
          }
        } catch (e) {
          if (clearCacheMessage) {
            clearCacheMessage.hidden = false;
            clearCacheMessage.textContent = 'Error al borrar caché.';
            clearCacheMessage.classList.add('message-error');
          } else {
            alert('Error al borrar caché.');
          }
        }
        btnClearCache.disabled = false;
      });
    }

    const btnAdd = document.getElementById('configCardAdd');
    const modal = document.getElementById('configCardModal');
    const btnCancel = document.getElementById('configCardModalCancel');
    const btnSave = document.getElementById('configCardModalSave');
    const list = document.getElementById('configCardsList');
    if (btnAdd) btnAdd.addEventListener('click', () => openConfigCardModal(null));
    if (btnCancel) btnCancel.addEventListener('click', closeConfigCardModal);
    if (btnSave) btnSave.addEventListener('click', saveConfigCard);
    if (modal && modal.querySelector('.recover-modal-backdrop')) {
      modal.querySelector('.recover-modal-backdrop').addEventListener('click', closeConfigCardModal);
    }
    if (list) {
      list.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.config-card-edit');
        const deleteBtn = e.target.closest('.config-card-delete');
        if (editBtn) {
          const id = editBtn.getAttribute('data-id');
          const card = configCardsCache.find((c) => c.id === id);
          openConfigCardModal(card || null);
        }
        if (deleteBtn) {
          const id = deleteBtn.getAttribute('data-id');
          deleteConfigCard(id);
        }
      });
    }
  }

  let lastModsManifest = null;
  let lastModsRequiredVersion = '';
  let modsDownloadInProgress = false;

  function toDirectDownloadUrl(url) {
    if (typeof url !== 'string') return url;
    // Google Drive: convertir view a export=download (si da 2KB, usar Transfer.it o Dropbox)
    const drive = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
    // Dropbox: forzar descarga directa (?dl=1) para que la app reciba el archivo y no la página
    if (url.includes('dropbox.com') && !url.includes('dl=1')) {
      return url.includes('?') ? url.replace(/\bdl=0\b/, 'dl=1') : url + '?dl=1';
    }
    return url;
  }

  function formatBytes(bytes) {
    if (bytes == null || bytes === 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  async function checkModsRequiredAndShowModal(forceShow) {
    const modal = document.getElementById('modsRequiredModal');
    const msgEl = document.getElementById('modsRequiredMessage');
    const versionEl = document.getElementById('modsRequiredVersion');
    const progressWrap = document.getElementById('modsDownloadProgressWrap');
    const phaseEl = document.getElementById('modsDownloadPhase');
    const fileListEl = document.getElementById('modsDownloadFileList');
    const statsEl = document.getElementById('modsDownloadStats');
    const doneWrap = document.getElementById('modsDownloadDone');
    const closeBtn = document.getElementById('modsRequiredClose');
    const singleListEl = document.getElementById('modsSingleDownloadList');
    if (!modal || !msgEl) return;
    try {
      let manifest = null;
      if (window.electronAPI?.getModsManifestLocal) {
        manifest = await window.electronAPI.getModsManifestLocal();
      }
      if (!manifest || typeof manifest !== 'object') {
        const res = await fetch(MODS_MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' });
        manifest = await res.json().catch(() => null);
      }
      if (!manifest) return;
      if (!forceShow && !manifest.required) return;
      const requiredVersion = String(manifest.version || '0').trim();
      lastModsRequiredVersion = requiredVersion;
      const currentVersion = (localStorage.getItem(MODS_VERSION_KEY) || '').trim();
      const needUpdate = !currentVersion || currentVersion !== requiredVersion;
      if (!forceShow && !needUpdate) return;
      lastModsManifest = manifest;
      if (versionEl) {
        versionEl.textContent = `Versión ${requiredVersion}${
          manifest.sizeHint ? ' · ' + manifest.sizeHint : ''
        }`;
      }
      if (progressWrap) progressWrap.hidden = true;
      if (doneWrap) doneWrap.hidden = true;
      if (singleListEl) singleListEl.innerHTML = '';
      if (closeBtn) {
        closeBtn.onclick = () => {
          if (requiredVersion) try { localStorage.setItem(MODS_VERSION_KEY, requiredVersion); } catch (_) {}
          modal.hidden = true;
        };
      }
      const closeX = document.getElementById('modsModalCloseX');
      if (closeX) {
        closeX.onclick = () => {
          modal.hidden = true;
        };
      }

      // URLs disponibles en el manifest
      const urls = Array.isArray(manifest.downloadUrls) ? manifest.downloadUrls : null;
      const singleUrl = manifest.downloadUrl;
      const hasMultiple = !!(urls && urls.length > 0);
      const hasSingle =
        !!singleUrl && !singleUrl.includes('example.com') && !singleUrl.includes('REEMPLAZA');

      async function startModsDownload(rawUrls, options = {}) {
        if (modsDownloadInProgress) {
          return;
        }
        modsDownloadInProgress = true;
        const preserveExisting = !!options.preserveExisting;
        if (!window.electronAPI?.downloadMods || !Array.isArray(rawUrls) || rawUrls.length === 0) {
          modsDownloadInProgress = false;
          return;
        }
        try {
          localStorage.removeItem(MODS_VERSION_KEY);
        } catch (_) {}

        const toDownload = rawUrls.map((u) => toDirectDownloadUrl(u));
        const totalFiles = toDownload.length;

        if (singleListEl) singleListEl.hidden = true;
        if (progressWrap) progressWrap.hidden = false;
        if (phaseEl) {
          phaseEl.textContent =
            totalFiles > 1 ? `Descargando (0/${totalFiles})…` : 'Descargando…';
        }
        if (fileListEl) {
          fileListEl.innerHTML = '';
          for (let i = 0; i < totalFiles; i++) {
            const row = document.createElement('div');
            row.className = 'mods-download-file-row';
            row.setAttribute('data-file-index', String(i + 1));
            row.innerHTML = `
              <span class="mods-file-check" aria-hidden="true"></span>
              <div class="mods-file-info">
                <div class="mods-file-label">Archivo ${i + 1}${
                  totalFiles > 1 ? ' de ' + totalFiles : ''
                }</div>
                <div class="mods-file-bar-wrap"><div class="mods-file-bar-fill" style="width: 0%"></div></div>
              </div>`;
            fileListEl.appendChild(row);
          }
        }
        if (statsEl) statsEl.textContent = '';

        const unsub = window.electronAPI.onModsDownloadProgress((data) => {
          if (data.phase === 'file_done' && data.fileIndex != null && data.totalFiles != null) {
            const row = fileListEl?.querySelector(`[data-file-index="${data.fileIndex}"]`);
            if (row) {
              row.classList.add('done');
              const fill = row.querySelector('.mods-file-bar-fill');
              if (fill) fill.style.width = '100%';
            }
            if (phaseEl && data.totalFiles > 1) {
              phaseEl.textContent = `Descargando (${data.fileIndex}/${data.totalFiles})…`;
            }
          } else if (data.phase === 'download' || data.phase === 'extract') {
            const idx = data.fileIndex != null ? data.fileIndex : 1;
            const total = data.totalFiles != null ? data.totalFiles : totalFiles;
            if (phaseEl) {
              phaseEl.textContent =
                data.phase === 'extract'
                  ? 'Extrayendo…'
                  : total > 1
                  ? `Descargando (${idx}/${total})…`
                  : 'Descargando…';
            }
            const row = fileListEl?.querySelector(
              `[data-file-index="${String(idx)}"]`
            );
            if (row && !row.classList.contains('done')) {
              const fill = row.querySelector('.mods-file-bar-fill');
              const pct = data.percent != null ? data.percent : 0;
              if (fill) fill.style.width = pct + '%';
            }
            if (statsEl && data.bytesReceived != null) {
              const totalB = data.totalBytes ? ` / ${formatBytes(data.totalBytes)}` : '';
              statsEl.textContent = formatBytes(data.bytesReceived) + totalB;
            }
          }
        });

        try {
          const payload = preserveExisting
            ? { urls: toDownload, preserveExisting: true }
            : (toDownload.length > 1 ? toDownload : toDownload[0]);
          const result = await window.electronAPI.downloadMods(payload);
          if (result && result.ok) {
            if (requiredVersion) {
              try {
                localStorage.setItem(MODS_VERSION_KEY, requiredVersion);
              } catch (_) {}
            }
            if (progressWrap) progressWrap.hidden = true;
            if (doneWrap) doneWrap.hidden = false;
            const warningEl = document.getElementById('modsDownloadCopyWarning');
            const openFolderBtn = document.getElementById('modsOpenModsFolder');
            if (warningEl) {
              warningEl.hidden = true;
              warningEl.textContent = '';
            }
            if (openFolderBtn) {
              openFolderBtn.hidden = true;
              openFolderBtn.onclick = null;
            }
            if (result.copyFailed && result.message) {
              if (warningEl) {
                warningEl.textContent = result.message;
                warningEl.hidden = false;
              } else {
                alert(result.message);
              }
              if (result.path && window.electronAPI?.openFolder) {
                if (openFolderBtn) {
                  openFolderBtn.hidden = false;
                  openFolderBtn.onclick = () => {
                    window.electronAPI.openFolder(result.path);
                  };
                } else if (confirm('¿Abrir la carpeta donde se descargaron los mods para copiarlos manualmente?')) {
                  window.electronAPI.openFolder(result.path);
                }
              }
            }
          } else {
            if (progressWrap) progressWrap.hidden = true;
            if (singleListEl) singleListEl.hidden = false;
            const msg = result?.message || result?.reason || 'Error al descargar o extraer.';
            alert(msg);
          }
        } catch (e) {
          if (progressWrap) progressWrap.hidden = true;
          if (singleListEl) singleListEl.hidden = false;
          alert('No se pudo conectar con el servidor. Comprueba la red e inténtalo de nuevo.');
        } finally {
          unsub();
          modsDownloadInProgress = false;
        }
      }

      if (singleListEl && window.electronAPI?.downloadMods) {
        const listUrls = hasMultiple ? urls : hasSingle ? [singleUrl] : [];
        let existingNames = [];
        if (window.electronAPI.listExistingModFilenames) {
          try {
            existingNames = await window.electronAPI.listExistingModFilenames();
          } catch (_) {}
        }
        const existingSet = new Set(existingNames.map((n) => n.toLowerCase()));
        listUrls.forEach((rawUrl, index) => {
          let fileName;
          let fsName;
          try {
            const u = new URL(rawUrl);
            const seg = (u.pathname || '').split('/').filter(Boolean).pop() || '';
            const decoded = decodeURIComponent(seg).trim();
            fileName = decoded || `Archivo ${index + 1}`;
            // Normalizar como en main.js (safeBasename) para comparar con nombres en disco
            const withoutSlashes = decoded.replace(/[/\\]/g, '');
            fsName = withoutSlashes.replace(/[^\w.\-()\s]/gi, '_').slice(0, 200) || decoded;
          } catch (_) {
            const last = String(rawUrl).split('/').pop() || `Archivo ${index + 1}`;
            const decoded = decodeURIComponent(last).trim();
            fileName = decoded || `Archivo ${index + 1}`;
            const withoutSlashes = decoded.replace(/[/\\]/g, '');
            fsName = withoutSlashes.replace(/[^\w.\-()\s]/gi, '_').slice(0, 200) || decoded;
          }
          const nameForMatch = (fsName || fileName).toLowerCase();
          const alreadyDownloaded = existingSet.has(nameForMatch);
          const container = document.createElement('div');
          container.className = 'mods-single-item';
          if (alreadyDownloaded) {
            const status = document.createElement('div');
            status.className = 'mods-single-item-status';
            status.innerHTML = '<span class="mods-single-item-check" aria-hidden="true">✓</span> Ya descargado';
            container.appendChild(status);
          }
          const label = document.createElement('span');
          label.className = 'mods-single-item-label';
          label.textContent = `Archivo ${index + 1}: ${fileName}`;
          container.appendChild(label);
          const manualBtn = document.createElement('button');
          manualBtn.type = 'button';
          manualBtn.className = 'mods-download-btn mods-download-btn-manual';
          manualBtn.textContent = 'Descarga manual';
          manualBtn.title = 'Abrir enlace en el navegador para descargar';
          manualBtn.addEventListener('click', () => {
            if (rawUrl && window.electronAPI?.openExternal) {
              window.electronAPI.openExternal(rawUrl);
            }
          });
          container.appendChild(manualBtn);
          singleListEl.appendChild(container);
        });
      }
      modal.hidden = false;
      const modsBackdrop = modal.querySelector('.recover-modal-backdrop');
      if (modsBackdrop) modsBackdrop.onclick = () => { modal.hidden = true; };
    } catch (_) {
      // Sin red o manifest no disponible: no bloquear
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

  setupConfigPanel();

  function canAccessTab(tabName) {
    // Perfil siempre accesible
    if (tabName === 'profile') return true;

    const row = currentDiscordRow;
    const hasRow = !!row;
    const linked = hasRow && !!row.discord_id && String(row.status).toLowerCase() === 'linked';
    const roles = Array.isArray(row?.roles) ? row.roles.map((r) => String(r)) : [];

    const { canAccessProtected, hasAdminRole, hasSupportRole } = evaluateAccessFlags(linked, roles);
    // Usuarios, MP, Bugs y Configuración solo para administradores o soporte
    if (tabName === 'users' || tabName === 'config' || tabName === 'mpAdmin' || tabName === 'bugs') {
      return !!(linked && (hasAdminRole || hasSupportRole));
    }
    return canAccessProtected;
  }

  async function syncUserWithSupabase() {
    // Ya no intentamos crear/actualizar filas desde el front.
    // Solo leemos el estado actual desde Supabase.
    await refreshDiscordFromSupabase();
  }

  async function getEffectivePcName() {
    let name = (appConfig.pcName != null && appConfig.pcName !== '') ? appConfig.pcName : pcName;
    if (name) return name;
    if (window.electronAPI && typeof window.electronAPI.getConfig === 'function') {
      try {
        const c = await window.electronAPI.getConfig();
        if (c && c.pcName != null && String(c.pcName).trim() !== '') {
          appConfig.pcName = String(c.pcName).trim();
          return appConfig.pcName;
        }
      } catch (_) {}
    }
    return '';
  }

  async function checkPcBindingForEmail(email) {
    const name = await getEffectivePcName();
    if (!name) return true;

    try {
      const url = `${BOT_BASE_URL}/pc/check-binding?email=${encodeURIComponent(
        email
      )}&pc=${encodeURIComponent(name)}`;
      const res = await fetchBot(url);
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

  let lastMercadoPagoState = '';

  function updateMercadoPagoRequestAccessVisibility() {
    if (!mercadopagoRequestAccessWrap) return;
    const row = currentDiscordRow;
    const linked = !!row && !!row.discord_id && String(row.status || '').toLowerCase() === 'linked';
    const roles = Array.isArray(row?.roles) ? row.roles.map((r) => String(r).toLowerCase()) : [];
    const hasAccesoManual = roles.some((r) => r === 'acceso manual');
    const hasPendingRequest = !!(row && row.has_pending_access_request);
    const show = lastMercadoPagoState === 'not_found' && linked && !hasAccesoManual;
    mercadopagoRequestAccessWrap.hidden = !show;
    if (show) {
      if (hasPendingRequest) {
        if (mercadopagoRejectionMessageEl) mercadopagoRejectionMessageEl.hidden = true;
        if (mercadopagoRequestSuccessMessageEl) {
          mercadopagoRequestSuccessMessageEl.textContent = 'Solicitud en curso. Un administrador la revisará.';
          mercadopagoRequestSuccessMessageEl.hidden = false;
        }
        if (mercadopagoRequestAccessDefaultTextEl) mercadopagoRequestAccessDefaultTextEl.hidden = true;
        if (mercadopagoRequestAccessBtn) mercadopagoRequestAccessBtn.hidden = true;
        return;
      }
      const reason = row && typeof row.access_request_rejection_reason === 'string' && row.access_request_rejection_reason.trim();
      if (mercadopagoRejectionMessageEl) {
        mercadopagoRejectionMessageEl.hidden = !reason;
        mercadopagoRejectionMessageEl.textContent = reason
          ? `Tu última solicitud fue rechazada: ${row.access_request_rejection_reason.trim()}. Puedes volver a solicitar acceso.`
          : '';
      }
      if (mercadopagoRequestSuccessMessageEl) mercadopagoRequestSuccessMessageEl.hidden = true;
      if (mercadopagoRequestAccessDefaultTextEl) mercadopagoRequestAccessDefaultTextEl.hidden = false;
      if (mercadopagoRequestAccessBtn) mercadopagoRequestAccessBtn.hidden = false;
    }
  }

  function setMercadoPagoUI(state, statusText) {
    lastMercadoPagoState = state || '';
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
    updateMercadoPagoRequestAccessVisibility();
    if (state === 'not_found') updateMercadoPagoManualAccessMessage();
  }

  function getAccesoManualDaysLeft(row) {
    if (!row || !row.acceso_manual_until) return null;
    const until = new Date(row.acceso_manual_until);
    const now = new Date();
    if (until <= now) return 0;
    return Math.ceil((until - now) / (24 * 60 * 60 * 1000));
  }

  function updateMercadoPagoManualAccessMessage() {
    if (!mercadopagoNotFoundEl || lastMercadoPagoState !== 'not_found') return;
    const days = getAccesoManualDaysLeft(currentDiscordRow);
    if (days != null && days > 0) {
      mercadopagoNotFoundEl.textContent = `Tienes acceso manual por ${days} día${days === 1 ? '' : 's'}`;
    } else {
      mercadopagoNotFoundEl.textContent = 'No hay suscripción con este correo.';
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
      const res = await fetchBot(mpUrl);
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
          updateMercadoPagoManualAccessMessage();
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
      const res = await fetchBot(url);
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
    updateMercadoPagoRequestAccessVisibility();
    updateMercadoPagoManualAccessMessage();
  }

  function evaluateAccessFlags(isLinked, roles) {
    const rolesStr = roles.map((r) => String(r));
    const normalizedRoles = rolesStr.map((r) => r.toLowerCase());

    const adminRoles = ['admin', '🛡️・𝑨𝑫𝑴𝑰𝑵 𝑺・🛡️'.toLowerCase()];
    const supportRoles = ['⚔️・𝑺𝑶𝑷𝑶𝑹𝑻𝑬・⚔️'.toLowerCase()];
    const subscriptionRoles = [
      'arg-6m',
      'arg-1m',
      'argenmod argentina mensual',
      'arg-3m',
      'chile-1 mes',
      'acceso manual'
    ].map((r) => r.toLowerCase());

    const hasAdminRole = normalizedRoles.some((r) => adminRoles.includes(r));
    const hasSupportRole =
      normalizedRoles.some((r) => supportRoles.includes(r)) ||
      rolesStr.some((r) => r.includes('𝑺𝑶𝑷𝑶𝑹𝑻𝑬'));

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
      hasSupportRole,
      hasSubRole,
      canAccessProtected
    };
  }

  let lastGameDbAccess = false;

  function updateMenuAccess(isLinked, roles) {
    const { canAccessProtected, hasAdminRole, hasSupportRole } = evaluateAccessFlags(isLinked, roles);

    dashTabs.forEach((btn) => {
      const tab = btn.getAttribute('data-tab');
      if (!tab) return;

      const isProfile = tab === 'profile';
      const isUsersTab = tab === 'users';
      const isConfigTab = tab === 'config';
      const isMpAdminTab = tab === 'mpAdmin';
      const isBugsTab = tab === 'bugs';
      const isBugReportBtn = btn.id === 'btnReportBug' || btn.classList.contains('dash-nav-item--bug-report');

      // Reportar Bug: siempre visible para usuarios logueados; bloqueado durante cooldown de 10 min
      if (isBugReportBtn) {
        btn.removeAttribute('hidden');
        if (updateBugReportButtonState(btn)) return;
        btn.classList.remove('dash-nav-item--locked');
        btn.removeAttribute('data-locked');
        btn.removeAttribute('title');
        return;
      }

      // Perfil siempre accesible
      if (isProfile) {
        btn.classList.remove('dash-nav-item--locked');
        btn.removeAttribute('data-locked');
        btn.removeAttribute('title');
        return;
      }

      // Menús Usuarios, MP, Bugs y Configuración: solo admin o soporte; invisibles para el resto
      if (isUsersTab || isConfigTab || isMpAdminTab || isBugsTab) {
        if (!isLinked || (!hasAdminRole && !hasSupportRole)) {
          btn.setAttribute('hidden', '');
          return;
        }
        btn.removeAttribute('hidden');
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

    // Controlar acceso al archivo fifa_ng_db.DB y Teams CSV según permisos de Discord
    const hasGameAccess = !!(isLinked && canAccessProtected);
    if (window.electronAPI && typeof window.electronAPI.setGameDbAccess === 'function') {
      if (hasGameAccess !== lastGameDbAccess) {
        lastGameDbAccess = hasGameAccess;
        window.electronAPI.setGameDbAccess(hasGameAccess);
      }
    }

    // Actualizar estado de Teams y orden de mods en el header
    updateTeamsHeaderStatus(hasGameAccess);
    updateModsOrderHeaderStatus(hasGameAccess);

    if (isLinked && (hasAdminRole || hasSupportRole)) {
      loadMpAdminPendingCount();
      getAccessRequestPendingCount().then((c) => {
        lastAccessRequestCount = c;
        startAccessRequestPolling();
      });
    } else {
      stopAccessRequestPolling();
    }
  }

  const rememberMe = document.getElementById('rememberMe');

  function restoreRememberedCredentials() {
    // Recordar usuario y contraseña (a petición del usuario)
    try {
      const savedRaw = localStorage.getItem('auth2027_remember');
      if (!savedRaw) return;
      const saved = JSON.parse(savedRaw);
      if (!saved || typeof saved !== 'object') return;
      if (saved.u) usernameInput.value = saved.u;
      if (saved.p) passwordInput.value = saved.p;
      if (rememberMe) rememberMe.checked = true;
    } catch (_) {}
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
      const effectivePc = await getEffectivePcName();
      if (effectivePc) {
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

  btnLogout.addEventListener('click', () => showLogin());

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
  const usersAdminSyncRolesBtn = document.getElementById('usersAdminSyncRoles');
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
  let usersAdminSort = { column: null, direction: 'asc' };

  // Admin MP
  const mpAdminEmailInput = document.getElementById('mpAdminEmail');
  const mpAdminSearchBtn = document.getElementById('mpAdminSearch');
  const mpAdminErrorEl = document.getElementById('mpAdminError');
  const mpAdminResultEl = document.getElementById('mpAdminResult');
  const mpAdminResultEmailEl = document.getElementById('mpAdminResultEmail');
  const mpAdminResultHasSubEl = document.getElementById('mpAdminResultHasSub');
  const mpAdminResultStatusEl = document.getElementById('mpAdminResultStatus');
  const mpAdminResultDaysEl = document.getElementById('mpAdminResultDays');
  const mpAdminResultPayerNameEl = document.getElementById('mpAdminResultPayerName');
  const mpAdminResultExternalRefEl = document.getElementById('mpAdminResultExternalRef');
  const mpAdminRequestsList = document.getElementById('mpAdminRequestsList');
  const mpAdminRequestsBadge = document.getElementById('mpAdminRequestsBadge');
  const mpAdminSwitcherOnline = document.getElementById('mpAdminSwitcherOnline');
  const mpAdminSwitcherOnlineList = document.getElementById('mpAdminSwitcherOnlineList');
  const mpNavBadge = document.getElementById('mpNavBadge');
  const comprobanteFullscreenModal = document.getElementById('comprobanteFullscreenModal');
  const comprobanteFullscreenImg = document.getElementById('comprobanteFullscreenImg');

  function openComprobanteFullscreen(dataUrl) {
    if (!comprobanteFullscreenModal || !comprobanteFullscreenImg || !dataUrl) return;
    comprobanteFullscreenImg.src = dataUrl;
    comprobanteFullscreenModal.hidden = false;
  }

  function closeComprobanteFullscreen() {
    if (comprobanteFullscreenModal) {
      comprobanteFullscreenModal.hidden = true;
      if (comprobanteFullscreenImg) comprobanteFullscreenImg.src = '';
    }
  }

  function downloadComprobanteImage(dataUrl, email) {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return;
    try {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `comprobante-${(email || 'solicitud').replace(/[^a-zA-Z0-9.-]/g, '_')}.png`;
      a.click();
    } catch (_) {}
  }

  function setupMpAdminSubTabs() {
    const tabBtns = document.querySelectorAll('.mp-admin-tab-btn');
    const panels = document.querySelectorAll('.mp-admin-tab-panel');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-mp-tab');
        if (!tab) return;
        tabBtns.forEach((b) => {
          b.classList.remove('mp-admin-tab-btn--active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('mp-admin-tab-btn--active');
        btn.setAttribute('aria-selected', 'true');
        panels.forEach((p) => {
          const panelTab = p.getAttribute('data-mp-panel');
          const active = panelTab === tab;
          p.classList.toggle('mp-admin-tab-panel--active', active);
          p.hidden = !active;
        });
      });
    });
  }

  if (comprobanteFullscreenModal) {
    const backdrop = comprobanteFullscreenModal.querySelector('.comprobante-fullscreen-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeComprobanteFullscreen);
    if (comprobanteFullscreenImg) {
      comprobanteFullscreenImg.addEventListener('click', closeComprobanteFullscreen);
      comprobanteFullscreenImg.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (comprobanteFullscreenImg.src) downloadComprobanteImage(comprobanteFullscreenImg.src, '');
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (comprobanteFullscreenModal && !comprobanteFullscreenModal.hidden) {
        closeComprobanteFullscreen();
      } else if (rejectRequestModal && !rejectRequestModal.hidden) {
        closeRejectRequestModal();
      }
    });
  }
  setupMpAdminSubTabs();

  let lastAccessRequestCount = null;
  let accessRequestPollingIntervalId = null;

  function playAccessRequestBell() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const duration = 10;
      const dingInterval = 1;
      const dingDuration = 0.35;
      const freq = 784;
      const volume = 0.6;

      function playDing(atTime) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioContext.destination);
        gain.gain.setValueAtTime(0, atTime);
        gain.gain.linearRampToValueAtTime(volume, atTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, atTime + dingDuration, 1);
        osc.start(atTime);
        osc.stop(atTime + dingDuration);
      }

      for (let t = 0; t < duration; t += dingInterval) {
        playDing(t);
      }
    } catch (_) {}
  }

  async function getAccessRequestPendingCount() {
    if (!currentUser || !currentUser.user_email) return 0;
    const adminEmail = encodeURIComponent(currentUser.user_email);
    try {
      const res = await fetchBot(`${BOT_BASE_URL}/admin/access-requests/pending-count?email=${adminEmail}`);
      const data = await res.json().catch(() => ({}));
      return (data.success && typeof data.count === 'number') ? data.count : 0;
    } catch (_) {
      return 0;
    }
  }

  async function loadMpAdminPendingCount() {
    if (!currentUser || !currentUser.user_email) return;
    const count = await getAccessRequestPendingCount();
    if (mpAdminRequestsBadge) {
      mpAdminRequestsBadge.textContent = count;
      mpAdminRequestsBadge.hidden = count === 0;
    }
    if (mpNavBadge) {
      mpNavBadge.textContent = count;
      mpNavBadge.hidden = count === 0;
    }
  }

  function startAccessRequestPolling() {
    if (accessRequestPollingIntervalId) return;
    accessRequestPollingIntervalId = setInterval(async () => {
      if (!currentUser || !currentUser.user_email) return;
      const count = await getAccessRequestPendingCount();
      if (lastAccessRequestCount !== null && count > lastAccessRequestCount) {
        playAccessRequestBell();
        loadMpAdminPendingCount();
      }
      lastAccessRequestCount = count;
    }, 20000);
  }

  function stopAccessRequestPolling() {
    if (accessRequestPollingIntervalId) {
      clearInterval(accessRequestPollingIntervalId);
      accessRequestPollingIntervalId = null;
    }
    lastAccessRequestCount = null;
  }

  async function loadMpAdminSwitcherOnline() {
    if (!mpAdminSwitcherOnline || !mpAdminSwitcherOnlineList || !currentUser?.user_email) return;
    try {
      const adminEmail = encodeURIComponent(currentUser.user_email);
      const res = await fetchBot(`${BOT_BASE_URL}/admin/switcher-online?email=${adminEmail}`);
      const data = await res.json().catch(() => ({}));
      const users = Array.isArray(data.users) ? data.users : [];
      if (users.length === 0) {
        mpAdminSwitcherOnline.hidden = true;
        return;
      }
      mpAdminSwitcherOnlineList.textContent = users.map((u) => u.name || u.email || '-').join(', ');
      mpAdminSwitcherOnline.hidden = false;
    } catch (_) {
      mpAdminSwitcherOnline.hidden = true;
    }
  }

  async function loadMpAdminPendingRequests() {
    if (!mpAdminRequestsList || !currentUser || !currentUser.user_email) return;
    const adminEmail = encodeURIComponent(currentUser.user_email);
    mpAdminRequestsList.innerHTML = '<p class="dash-card-text">Cargando…</p>';
    try {
      const res = await fetchBot(`${BOT_BASE_URL}/admin/access-requests/pending?email=${adminEmail}`);
      const data = await res.json().catch(() => ({}));
      const requests = Array.isArray(data.requests) ? data.requests : [];
      mpAdminRequestsList.innerHTML = '';
      if (requests.length === 0) {
        const p = document.createElement('p');
        p.className = 'dash-card-text';
        p.textContent = 'No hay solicitudes pendientes.';
        mpAdminRequestsList.appendChild(p);
        return;
      }
      requests.forEach((req) => {
        const card = document.createElement('div');
        card.className = 'mp-admin-request-card';
        const created = req.created_at ? new Date(req.created_at).toLocaleString() : '-';
        const email = req.user_email || '-';
        const discordUser = req.discord_username || req.discord_id || null;
        let html = '<div class="mp-admin-request-meta">';
        html += `<p class="dash-card-text"><strong>Correo:</strong> ${escapeHtml(email)}</p>`;
        if (discordUser) {
          html += `<p class="dash-card-text"><strong>Usuario Discord:</strong> ${escapeHtml(String(discordUser))}</p>`;
        }
        html += `<p class="dash-card-text"><strong>Fecha:</strong> ${escapeHtml(created)}</p>`;
        if (req.comprobante_data && req.comprobante_data.startsWith('data:image/')) {
          const safeSrc = (req.comprobante_data || '').replace(/"/g, '&quot;');
          html += '</div>';
          html += `<div class="mp-admin-request-preview-wrap" title="Clic para ampliar, clic derecho para descargar"><div class="mp-admin-request-preview"><img src="${safeSrc}" alt="Comprobante" class="mp-admin-request-img" data-comprobante-src="" /></div></div>`;
        } else {
          html += '</div>';
        }
        html += '<div class="mp-admin-request-actions">';
        html += `<button type="button" class="login-btn-secondary mp-admin-request-approve" data-id="${Number(req.id)}">Aprobar (dar acceso manual)</button>`;
        html += `<button type="button" class="recover-btn recover-btn-secondary mp-admin-request-reject" data-id="${Number(req.id)}">Rechazar</button>`;
        html += '</div>';
        card.innerHTML = html;
        const wrap = card.querySelector('.mp-admin-request-preview-wrap');
        if (wrap && req.comprobante_data) {
          const img = card.querySelector('.mp-admin-request-img');
          if (img) {
            img.setAttribute('data-comprobante-src', req.comprobante_data);
            wrap.addEventListener('click', () => openComprobanteFullscreen(req.comprobante_data));
            wrap.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              downloadComprobanteImage(req.comprobante_data, email);
            });
          }
        }
        mpAdminRequestsList.appendChild(card);
      });
      mpAdminRequestsList.querySelectorAll('.mp-admin-request-approve').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.getAttribute('data-id'));
          if (!id) return;
          btn.disabled = true;
          try {
            const res = await fetchBot(`${BOT_BASE_URL}/admin/access-requests/approve?email=${adminEmail}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id })
            });
            const data = await res.json().catch(() => ({}));
            if (data.success) {
              loadMpAdminPendingRequests();
              loadMpAdminPendingCount();
            } else {
              if (mpAdminErrorEl) {
                mpAdminErrorEl.textContent = data.message || 'Error al aprobar.';
                mpAdminErrorEl.hidden = false;
              }
            }
          } catch (_) {
            if (mpAdminErrorEl) {
              mpAdminErrorEl.textContent = 'Error de conexión.';
              mpAdminErrorEl.hidden = false;
            }
          } finally {
            btn.disabled = false;
          }
        });
      });
      mpAdminRequestsList.querySelectorAll('.mp-admin-request-reject').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = Number(btn.getAttribute('data-id'));
          if (!id) return;
          openRejectRequestModal(id);
        });
      });
    } catch (_) {
      mpAdminRequestsList.innerHTML = '<p class="dash-card-text message-error">Error al cargar solicitudes.</p>';
    }
  }

  let pendingRejectRequestId = null;
  const rejectRequestModal = document.getElementById('rejectRequestModal');
  const rejectRequestReasonEl = document.getElementById('rejectRequestReason');
  const rejectRequestModalCancel = document.getElementById('rejectRequestModalCancel');
  const rejectRequestModalConfirm = document.getElementById('rejectRequestModalConfirm');
  const rejectRequestModalErrorEl = document.getElementById('rejectRequestModalError');

  function openRejectRequestModal(id) {
    pendingRejectRequestId = id;
    if (rejectRequestReasonEl) rejectRequestReasonEl.value = '';
    if (rejectRequestModalErrorEl) {
      rejectRequestModalErrorEl.hidden = true;
      rejectRequestModalErrorEl.textContent = '';
    }
    if (rejectRequestModal) rejectRequestModal.hidden = false;
  }

  function closeRejectRequestModal() {
    pendingRejectRequestId = null;
    if (rejectRequestModal) rejectRequestModal.hidden = true;
  }

  if (rejectRequestModal) {
    const backdrop = rejectRequestModal.querySelector('.recover-modal-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeRejectRequestModal);
  }
  if (rejectRequestModalCancel) rejectRequestModalCancel.addEventListener('click', closeRejectRequestModal);
  if (rejectRequestModalConfirm) {
    rejectRequestModalConfirm.addEventListener('click', () => {
      if (pendingRejectRequestId == null || !currentUser || !currentUser.user_email) return;
      const idToReject = pendingRejectRequestId;
      const reason = (rejectRequestReasonEl && rejectRequestReasonEl.value) ? rejectRequestReasonEl.value.trim() : '';
      const adminEmail = encodeURIComponent(currentUser.user_email);
      closeRejectRequestModal();
      (async () => {
        try {
          const res = await fetchBot(`${BOT_BASE_URL}/admin/access-requests/reject?email=${adminEmail}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: idToReject, reason })
          });
          const data = await res.json().catch(() => ({}));
          if (data.success) {
            loadMpAdminPendingRequests();
            loadMpAdminPendingCount();
          } else {
            alert(data.message || 'Error al rechazar la solicitud.');
          }
        } catch (_) {
          alert('Error de conexión. No se pudo rechazar.');
        }
      })();
    });
  }

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

  // --- Modal solicitar acceso (comprobante cuando no hay suscripción MP) ---
  const accessRequestModal = document.getElementById('accessRequestModal');
  const accessRequestFile = document.getElementById('accessRequestFile');
  const accessRequestPreview = document.getElementById('accessRequestPreview');
  const accessRequestModalError = document.getElementById('accessRequestModalError');
  const accessRequestCancel = document.getElementById('accessRequestCancel');
  const accessRequestSubmit = document.getElementById('accessRequestSubmit');

  let accessRequestDataUrl = null;

  function closeAccessRequestModal() {
    if (accessRequestModal) accessRequestModal.hidden = true;
    if (accessRequestFile) accessRequestFile.value = '';
    if (accessRequestPreview) {
      accessRequestPreview.hidden = true;
      accessRequestPreview.innerHTML = '';
    }
    if (accessRequestModalError) {
      accessRequestModalError.hidden = true;
      accessRequestModalError.textContent = '';
    }
    accessRequestDataUrl = null;
  }

  function openAccessRequestModal() {
    if (!accessRequestModal) return;
    closeAccessRequestModal();
    accessRequestModal.hidden = false;
  }

  if (mercadopagoRequestAccessBtn) {
    mercadopagoRequestAccessBtn.addEventListener('click', () => openAccessRequestModal());
  }

  if (accessRequestModal) {
    const backdrop = accessRequestModal.querySelector('.recover-modal-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeAccessRequestModal);
  }
  if (accessRequestCancel) {
    accessRequestCancel.addEventListener('click', closeAccessRequestModal);
  }

  if (accessRequestFile) {
    accessRequestFile.addEventListener('change', () => {
      accessRequestDataUrl = null;
      if (accessRequestPreview) {
        accessRequestPreview.hidden = true;
        accessRequestPreview.innerHTML = '';
      }
      const file = accessRequestFile.files && accessRequestFile.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        accessRequestDataUrl = reader.result;
        if (accessRequestPreview && typeof accessRequestDataUrl === 'string') {
          const img = document.createElement('img');
          img.src = accessRequestDataUrl;
          img.alt = 'Vista previa del comprobante';
          img.className = 'access-request-preview-img';
          accessRequestPreview.innerHTML = '';
          accessRequestPreview.appendChild(img);
          accessRequestPreview.hidden = false;
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (accessRequestSubmit) {
    accessRequestSubmit.addEventListener('click', async () => {
      if (!accessRequestDataUrl) {
        if (accessRequestModalError) {
          accessRequestModalError.textContent = 'Selecciona una imagen del comprobante.';
          accessRequestModalError.hidden = false;
        }
        return;
      }
      if (accessRequestModalError) accessRequestModalError.hidden = true;
      accessRequestSubmit.disabled = true;
      try {
        const res = await fetchBot(`${BOT_BASE_URL}/access-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comprobante: accessRequestDataUrl })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          closeAccessRequestModal();
          if (mercadopagoRequestAccessWrap) {
            if (mercadopagoRejectionMessageEl) mercadopagoRejectionMessageEl.hidden = true;
            if (mercadopagoRequestSuccessMessageEl) mercadopagoRequestSuccessMessageEl.hidden = false;
            if (mercadopagoRequestAccessDefaultTextEl) mercadopagoRequestAccessDefaultTextEl.hidden = true;
            if (mercadopagoRequestAccessBtn) mercadopagoRequestAccessBtn.hidden = true;
          }
        } else {
          if (accessRequestModalError) {
            accessRequestModalError.textContent = data.message || 'Error al enviar la solicitud.';
            accessRequestModalError.hidden = false;
          }
        }
      } catch (_) {
        if (accessRequestModalError) {
          accessRequestModalError.textContent = 'Error de conexión. Intenta de nuevo.';
          accessRequestModalError.hidden = false;
        }
      } finally {
        accessRequestSubmit.disabled = false;
      }
    });
  }

  // --- Reportar Bug/Problema ---
  const BUG_REPORT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos
  const BUG_REPORT_COOLDOWN_KEY = 'bugReportCooldownUntil';

  function getBugReportCooldownRemaining() {
    try {
      const until = parseInt(localStorage.getItem(BUG_REPORT_COOLDOWN_KEY) || '0', 10);
      return Math.max(0, until - Date.now());
    } catch (_) {
      return 0;
    }
  }

  function updateBugReportButtonState(btn) {
    if (!btn) return false;
    const remaining = getBugReportCooldownRemaining();
    if (remaining > 0) {
      const mins = Math.ceil(remaining / 60000);
      btn.classList.add('dash-nav-item--locked');
      btn.setAttribute('data-locked', 'cooldown');
      btn.title = mins <= 1 ? 'Podrás reportar otro bug en 1 minuto.' : `Podrás reportar otro bug en ${mins} minutos.`;
      return true;
    }
    try {
      localStorage.removeItem(BUG_REPORT_COOLDOWN_KEY);
    } catch (_) {}
    btn.classList.remove('dash-nav-item--locked');
    btn.removeAttribute('data-locked');
    btn.removeAttribute('title');
    return false;
  }

  const btnReportBug = document.getElementById('btnReportBug');
  const bugReportModal = document.getElementById('bugReportModal');
  const bugReportModalCloseX = document.getElementById('bugReportModalCloseX');
  const bugReportEquipo = document.getElementById('bugReportEquipo');
  const bugReportTemporada = document.getElementById('bugReportTemporada');
  const bugReportProblema = document.getElementById('bugReportProblema');
  const bugReportCareerUrl = document.getElementById('bugReportCareerUrl');
  const bugReportModalError = document.getElementById('bugReportModalError');
  const bugReportSuccessMessage = document.getElementById('bugReportSuccessMessage');
  const bugReportCancel = document.getElementById('bugReportCancel');
  const bugReportSubmit = document.getElementById('bugReportSubmit');

  function closeBugReportModal() {
    if (bugReportModal) bugReportModal.hidden = true;
    if (bugReportEquipo) bugReportEquipo.value = '';
    if (bugReportTemporada) bugReportTemporada.value = '';
    if (bugReportProblema) bugReportProblema.value = '';
    if (bugReportCareerUrl) bugReportCareerUrl.value = '';
    if (bugReportModalError) {
      bugReportModalError.hidden = true;
      bugReportModalError.textContent = '';
    }
    if (bugReportSuccessMessage) bugReportSuccessMessage.hidden = true;
  }

  function openBugReportModal() {
    if (!bugReportModal) return;
    closeBugReportModal();
    bugReportModal.hidden = false;
  }

  if (btnReportBug) {
    btnReportBug.addEventListener('click', () => {
      if (btnReportBug.classList.contains('dash-nav-item--locked')) return;
      openBugReportModal();
    });
  }

  if (bugReportModal) {
    const backdrop = bugReportModal.querySelector('.recover-modal-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeBugReportModal);
  }
  if (bugReportModalCloseX) bugReportModalCloseX.addEventListener('click', closeBugReportModal);
  if (bugReportCancel) bugReportCancel.addEventListener('click', closeBugReportModal);

  if (bugReportSubmit) {
    bugReportSubmit.addEventListener('click', async () => {
      const equipo = bugReportEquipo?.value?.trim();
      const temporada = bugReportTemporada?.value?.trim();
      const problema = bugReportProblema?.value?.trim();
      const careerUrl = bugReportCareerUrl?.value?.trim() || '';
      if (!equipo || !temporada || !problema) {
        if (bugReportModalError) {
          bugReportModalError.textContent = 'Equipo, temporada y problema son obligatorios.';
          bugReportModalError.hidden = false;
        }
        return;
      }
      if (careerUrl && !careerUrl.toLowerCase().includes('transfer.it')) {
        if (bugReportModalError) {
          bugReportModalError.textContent = 'El enlace debe ser de transfer.it. Sube tu archivo en https://transfer.it/ y pega el enlace aquí.';
          bugReportModalError.hidden = false;
        }
        return;
      }
      if (bugReportModalError) bugReportModalError.hidden = true;
      bugReportSubmit.disabled = true;
      try {
        const setupInfo = await getSetupInfo();
        const payload = {
          equipo,
          temporada: parseInt(temporada, 10),
          problema,
          career_file_url: careerUrl || undefined,
          mod_order_ok: setupInfo.mod_order_ok,
          teams_ok: setupInfo.teams_ok,
          squad_applied: setupInfo.squad_applied
        };
        const res = await fetchBot(`${BOT_BASE_URL}/bug-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          try {
            localStorage.setItem(BUG_REPORT_COOLDOWN_KEY, String(Date.now() + BUG_REPORT_COOLDOWN_MS));
          } catch (_) {}
          closeBugReportModal();
          if (btnReportBug) updateBugReportButtonState(btnReportBug);
        } else {
          if (bugReportModalError) {
            bugReportModalError.textContent = data.message || 'Error al enviar el reporte.';
            bugReportModalError.hidden = false;
          }
        }
      } catch (_) {
        if (bugReportModalError) {
          bugReportModalError.textContent = 'Error de conexión. Intenta de nuevo.';
          bugReportModalError.hidden = false;
        }
      } finally {
        bugReportSubmit.disabled = false;
      }
    });
  }

  // Actualizar cada minuto el estado del botón Reportar Bug durante el cooldown
  setInterval(() => {
    if (btnReportBug && getBugReportCooldownRemaining() > 0) {
      updateBugReportButtonState(btnReportBug);
    }
  }, 60000);

  // --- Bugs admin panel ---
  const bugsAdminList = document.getElementById('bugsAdminList');
  const bugsAdminError = document.getElementById('bugsAdminError');
  const bugsAdminFilterStatus = document.getElementById('bugsAdminFilterStatus');
  const bugsAdminRefresh = document.getElementById('bugsAdminRefresh');
  const bugsChartPending = document.getElementById('bugsChartPending');
  const bugsChartEnCurso = document.getElementById('bugsChartEnCurso');
  const bugsChartResolved = document.getElementById('bugsChartResolved');
  const bugsChartPendingCount = document.getElementById('bugsChartPendingCount');
  const bugsChartEnCursoCount = document.getElementById('bugsChartEnCursoCount');
  const bugsChartResolvedCount = document.getElementById('bugsChartResolvedCount');
  const bugDetailModal = document.getElementById('bugDetailModal');
  const bugDetailId = document.getElementById('bugDetailId');
  const bugDetailContent = document.getElementById('bugDetailContent');
  const bugDetailProblemaTipo = document.getElementById('bugDetailProblemaTipo');
  const bugDetailResueltoEnMod = document.getElementById('bugDetailResueltoEnMod');
  const bugDetailNota = document.getElementById('bugDetailNota');
  const bugDetailRespuesta = document.getElementById('bugDetailRespuesta');
  const bugDetailEnCurso = document.getElementById('bugDetailEnCurso');
  const bugDetailResuelto = document.getElementById('bugDetailResuelto');
  const bugDetailGuardar = document.getElementById('bugDetailGuardar');
  const bugDetailCancel = document.getElementById('bugDetailCancel');
  const bugDetailError = document.getElementById('bugDetailError');
  const bugDetailModalCloseX = document.getElementById('bugDetailModalCloseX');

  let currentBugDetailId = null;

  function hasOwnerRole() {
    const roles = Array.isArray(currentDiscordRow?.roles) ? currentDiscordRow.roles.map((r) => String(r)) : [];
    return roles.some((r) => /owner/i.test(r) || r.includes('𝑶𝑾𝑵𝑬𝑹'));
  }

  function updateBugDetailResueltoEnModState() {
    if (!bugDetailProblemaTipo || !bugDetailResueltoEnMod) return;
    const problemaTipo = bugDetailProblemaTipo.value;
    const isOwner = hasOwnerRole();
    if (problemaTipo === 'error_usuario') {
      bugDetailResueltoEnMod.value = 'no_aplica';
      bugDetailResueltoEnMod.disabled = true;
    } else if (problemaTipo === 'error_mod') {
      if (!bugDetailResueltoEnMod.value || bugDetailResueltoEnMod.value === 'no_aplica') {
        bugDetailResueltoEnMod.value = 'no';
      }
      bugDetailResueltoEnMod.disabled = !isOwner;
      const siOpt = bugDetailResueltoEnMod.querySelector('option[value="si"]');
      if (siOpt) siOpt.disabled = false;
    } else {
      bugDetailResueltoEnMod.value = 'no';
      bugDetailResueltoEnMod.disabled = !isOwner;
    }
  }

  async function loadBugsAdminChart() {
    if (!currentUser?.user_email || !bugsChartPending || !bugsChartEnCurso || !bugsChartResolved) return;
    try {
      const adminEmail = encodeURIComponent(currentUser.user_email);
      const res = await fetchBot(`${BOT_BASE_URL}/admin/bugs/stats?email=${adminEmail}`);
      const data = await res.json().catch(() => ({}));
      const stats = data?.stats || { pending: 0, en_curso: 0, resolved: 0 };
      const total = stats.pending + stats.en_curso + stats.resolved;
      const maxVal = Math.max(total, 1);
      const pctP = (stats.pending / maxVal) * 100;
      const pctE = (stats.en_curso / maxVal) * 100;
      const pctR = (stats.resolved / maxVal) * 100;
      if (bugsChartPending) {
        bugsChartPending.style.width = `${pctP}%`;
      }
      if (bugsChartEnCurso) {
        bugsChartEnCurso.style.width = `${pctE}%`;
      }
      if (bugsChartResolved) {
        bugsChartResolved.style.width = `${pctR}%`;
      }
      if (bugsChartPendingCount) bugsChartPendingCount.textContent = stats.pending;
      if (bugsChartEnCursoCount) bugsChartEnCursoCount.textContent = stats.en_curso;
      if (bugsChartResolvedCount) bugsChartResolvedCount.textContent = stats.resolved;
    } catch (_) {}
  }

  async function loadBugsAdminList() {
    if (!bugsAdminList || !currentUser?.user_email) return;
    const adminEmail = encodeURIComponent(currentUser.user_email);
    const status = bugsAdminFilterStatus?.value || '';
    const url = status ? `${BOT_BASE_URL}/admin/bugs?email=${adminEmail}&status=${status}` : `${BOT_BASE_URL}/admin/bugs?email=${adminEmail}`;
    bugsAdminList.innerHTML = '<p class="bugs-list-loading">Cargando…</p>';
    if (bugsAdminError) bugsAdminError.hidden = true;
    try {
      const res = await fetchBot(url);
      const data = await res.json().catch(() => ({}));
      const bugs = Array.isArray(data.bugs) ? data.bugs : [];
      if (bugs.length === 0) {
        bugsAdminList.innerHTML = '<p class="bugs-list-empty">No hay reportes de bugs.</p>';
        return;
      }
      bugsAdminList.innerHTML = '';
      bugs.forEach((bug) => {
        const statusLabel = bug.status === 'resolved' ? 'Resuelto' : bug.status === 'en_curso' ? 'En curso' : 'Pendiente';
        const statusClass = bug.status === 'resolved' ? 'completed' : bug.status === 'en_curso' ? 'in-progress' : 'pending';
        const byInfo = bug.status === 'en_curso' && bug.en_curso_by
          ? ` (por ${escapeHtml(bug.en_curso_by)})`
          : bug.status === 'resolved' && bug.resolved_by
            ? ` (por ${escapeHtml(bug.resolved_by)})`
            : '';
        const setupStr = formatSetupInfo(bug);
        const fileLink = bug.career_file_url && safeUrlForHref(bug.career_file_url)
          ? `<a href="${safeUrlForHref(bug.career_file_url)}" target="_blank" rel="noopener" class="bugs-card-link">Abrir archivo</a>`
          : '<span class="bugs-card-muted">—</span>';
        const resueltoEnModVal = bug.resuelto_en_mod || 'no';
        const resueltoEnModLabel = resueltoEnModVal === 'si' ? 'Sí' : resueltoEnModVal === 'no_aplica' ? 'No aplica' : 'No';
        const resueltoEnModClass = resueltoEnModVal === 'si' ? 'resuelto-mod-si' : resueltoEnModVal === 'no_aplica' ? 'resuelto-mod-no-aplica' : 'resuelto-mod-no';
        const problemaTipoLabel = bug.problema_tipo === 'error_mod' ? 'Error del mod' : bug.problema_tipo === 'error_usuario' ? 'Error del usuario' : '—';
        const card = document.createElement('div');
        card.className = `bugs-card ${bug.status === 'resolved' ? 'bugs-card--resolved' : ''}`;
        card.innerHTML = `
          <div class="bugs-card-header">
            <span class="bugs-card-id">#${bug.id}</span>
            <span class="status ${statusClass}">${statusLabel}${byInfo}</span>
            <span class="resuelto-mod-badge ${resueltoEnModClass}">${escapeHtml(resueltoEnModLabel)}</span>
            <button type="button" class="bugs-card-btn bug-admin-view-detail" data-id="${bug.id}">Ver detalle</button>
          </div>
          <div class="bugs-card-body">
            <div class="bugs-card-grid">
              <div class="bugs-card-field">
                <span class="bugs-card-label">Usuario</span>
                <span class="bugs-card-value" title="${escapeHtml(bug.user_email || '')}">${escapeHtml(bug.discord_username || bug.discord_id || '-')}</span>
              </div>
              <div class="bugs-card-field">
                <span class="bugs-card-label">Equipo</span>
                <span class="bugs-card-value">${escapeHtml(bug.equipo || '-')}</span>
              </div>
              <div class="bugs-card-field">
                <span class="bugs-card-label">Temp</span>
                <span class="bugs-card-value">${bug.temporada || '-'}</span>
              </div>
              <div class="bugs-card-field">
                <span class="bugs-card-label">Tipo</span>
                <span class="bugs-card-value">${escapeHtml(problemaTipoLabel)}</span>
              </div>
              <div class="bugs-card-field bugs-card-field--full">
                <span class="bugs-card-label">Problema</span>
                <span class="bugs-card-value">${escapeHtml(bug.problema || '-')}</span>
              </div>
              <div class="bugs-card-field">
                <span class="bugs-card-label">Setup</span>
                <span class="bugs-card-value">${setupStr || '-'}</span>
              </div>
              <div class="bugs-card-field bugs-card-field--full">
                <span class="bugs-card-label">Nota</span>
                <span class="bugs-card-value">${escapeHtml(bug.admin_nota || '-')}</span>
              </div>
              <div class="bugs-card-field">
                <span class="bugs-card-label">Archivo</span>
                <span class="bugs-card-value">${fileLink}</span>
              </div>
            </div>
          </div>
        `;
        const viewBtn = card.querySelector('.bug-admin-view-detail');
        if (viewBtn) viewBtn.addEventListener('click', () => openBugDetailModal(Number(viewBtn.getAttribute('data-id'))));
        bugsAdminList.appendChild(card);
      });
    } catch (_) {
      bugsAdminList.innerHTML = '<p class="bugs-list-error">Error al cargar bugs.</p>';
    }
  }

  if (bugsAdminRefresh) bugsAdminRefresh.addEventListener('click', () => { loadBugsAdminChart(); loadBugsAdminList(); });
  if (bugsAdminFilterStatus) bugsAdminFilterStatus.addEventListener('change', () => loadBugsAdminList());

  async function openBugDetailModal(id) {
    if (!currentUser?.user_email || !id) return;
    const adminEmail = encodeURIComponent(currentUser.user_email);
    try {
      const res = await fetchBot(`${BOT_BASE_URL}/admin/bugs/${id}?email=${adminEmail}`);
      const data = await res.json().catch(() => ({}));
      if (!data.success || !data.bug) {
        if (bugsAdminError) {
          bugsAdminError.textContent = 'No se pudo cargar el bug.';
          bugsAdminError.hidden = false;
        }
        return;
      }
      const bug = data.bug;
      currentBugDetailId = id;
      if (bugDetailId) bugDetailId.textContent = id;
      if (bugDetailProblemaTipo) bugDetailProblemaTipo.value = bug.problema_tipo || '';
      if (bugDetailResueltoEnMod) {
        const rem = bug.resuelto_en_mod || 'no';
        bugDetailResueltoEnMod.value = (rem === 'si' || rem === 'no' || rem === 'no_aplica') ? rem : 'no';
      }
      updateBugDetailResueltoEnModState();
      if (bugDetailNota) bugDetailNota.value = bug.admin_nota || '';
      if (bugDetailRespuesta) bugDetailRespuesta.value = bug.admin_respuesta || '';
      if (bugDetailError) bugDetailError.hidden = true;
      let content = '<div class="bug-detail-content-inner">';
      content += `<p class="dash-card-text"><strong>Equipo:</strong> ${escapeHtml(bug.equipo || '-')}</p>`;
      content += `<p class="dash-card-text"><strong>Temporada:</strong> ${bug.temporada || '-'}</p>`;
      content += `<p class="dash-card-text"><strong>Usuario Discord:</strong> ${escapeHtml(bug.discord_username || bug.discord_id || '-')}</p>`;
      content += `<p class="dash-card-text"><strong>Correo:</strong> ${escapeHtml(bug.user_email || '-')}</p>`;
      content += `<p class="dash-card-text"><strong>Problema:</strong></p><p class="dash-card-text">${escapeHtml(bug.problema || '-')}</p>`;
      const problemaTipoLabel = bug.problema_tipo === 'error_mod' ? 'Error del mod' : bug.problema_tipo === 'error_usuario' ? 'Error del usuario' : null;
      const resueltoEnModLabel = bug.resuelto_en_mod === 'si' ? 'Sí' : bug.resuelto_en_mod === 'no_aplica' ? 'No aplica' : 'No';
      if (problemaTipoLabel) content += `<p class="dash-card-text"><strong>Tipo de problema:</strong> ${escapeHtml(problemaTipoLabel)}</p>`;
      content += `<p class="dash-card-text"><strong>Resuelto en el mod:</strong> ${escapeHtml(resueltoEnModLabel)}</p>`;
      const statusLabel = bug.status === 'resolved' ? 'Resuelto' : bug.status === 'en_curso' ? 'En curso' : 'Pendiente';
      const byInfo = bug.status === 'en_curso' && bug.en_curso_by
        ? ` (por ${escapeHtml(bug.en_curso_by)})`
        : bug.status === 'resolved' && bug.resolved_by
          ? ` (por ${escapeHtml(bug.resolved_by)})`
          : '';
      content += `<p class="dash-card-text"><strong>Estado:</strong> ${statusLabel}${byInfo}</p>`;
      const setupStr = formatSetupInfo(bug);
      if (setupStr) content += `<p class="dash-card-text"><strong>Setup al reportar:</strong> ${setupStr}</p>`;
      if (bug.career_file_url && safeUrlForHref(bug.career_file_url)) {
        content += `<p class="dash-card-text"><a href="${safeUrlForHref(bug.career_file_url)}" target="_blank" rel="noopener" class="mods-download-btn" style="display:inline-block;margin-top:8px">Abrir archivo de modo carrera (Transfer.it)</a></p>`;
      }
      content += '</div>';
      if (bugDetailContent) bugDetailContent.innerHTML = content;
      if (bugDetailModal) bugDetailModal.hidden = false;
      const isResolved = bug.status === 'resolved';
      if (bugDetailResuelto) bugDetailResuelto.hidden = isResolved;
      if (bugDetailEnCurso) bugDetailEnCurso.hidden = isResolved || bug.status === 'en_curso';
      if (bugDetailGuardar) bugDetailGuardar.hidden = !isResolved;
    } catch (_) {
      if (bugsAdminError) {
        bugsAdminError.textContent = 'Error al cargar el bug.';
        bugsAdminError.hidden = false;
      }
    }
  }

  function closeBugDetailModal() {
    currentBugDetailId = null;
    if (bugDetailModal) bugDetailModal.hidden = true;
  }

  if (bugDetailModal) {
    const backdrop = bugDetailModal.querySelector('.recover-modal-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeBugDetailModal);
  }
  if (bugDetailModalCloseX) bugDetailModalCloseX.addEventListener('click', closeBugDetailModal);
  if (bugDetailCancel) bugDetailCancel.addEventListener('click', closeBugDetailModal);
  if (bugDetailProblemaTipo) bugDetailProblemaTipo.addEventListener('change', updateBugDetailResueltoEnModState);

  if (bugDetailEnCurso) {
    bugDetailEnCurso.addEventListener('click', async () => {
      if (!currentBugDetailId || !currentUser?.user_email) return;
      const adminEmail = encodeURIComponent(currentUser.user_email);
      const problemaTipo = bugDetailProblemaTipo?.value || '';
      let resueltoEnMod = bugDetailResueltoEnMod?.value || 'no';
      if (bugDetailProblemaTipo?.value === 'error_usuario') resueltoEnMod = 'no_aplica';
      if (bugDetailError) bugDetailError.hidden = true;
      bugDetailEnCurso.disabled = true;
      try {
        const patchBody = { en_curso: true };
        if (problemaTipo) patchBody.problema_tipo = problemaTipo;
        patchBody.resuelto_en_mod = resueltoEnMod;
        const res = await fetchBot(`${BOT_BASE_URL}/admin/bugs/${currentBugDetailId}?email=${adminEmail}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody)
        });
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          closeBugDetailModal();
          loadBugsAdminChart();
          loadBugsAdminList();
        } else {
          if (bugDetailError) {
            bugDetailError.textContent = data.message || 'Error al marcar en curso.';
            bugDetailError.hidden = false;
          }
        }
      } catch (_) {
        if (bugDetailError) {
          bugDetailError.textContent = 'Error de conexión.';
          bugDetailError.hidden = false;
        }
      } finally {
        bugDetailEnCurso.disabled = false;
      }
    });
  }

  if (bugDetailResuelto) {
    bugDetailResuelto.addEventListener('click', async () => {
      if (!currentBugDetailId || !currentUser?.user_email) return;
      const adminEmail = encodeURIComponent(currentUser.user_email);
      const nota = bugDetailNota?.value?.trim() || '';
      const respuesta = bugDetailRespuesta?.value?.trim() || '';
      if (!nota || !respuesta) {
        if (bugDetailError) {
          bugDetailError.textContent = 'La nota interna y la respuesta al usuario son obligatorias.';
          bugDetailError.hidden = false;
        }
        return;
      }
      const problemaTipo = bugDetailProblemaTipo?.value || '';
      let resueltoEnMod = bugDetailResueltoEnMod?.value || 'no';
      if (bugDetailProblemaTipo?.value === 'error_usuario') resueltoEnMod = 'no_aplica';
      if (bugDetailError) bugDetailError.hidden = true;
      bugDetailResuelto.disabled = true;
      try {
        const patchBody = { nota, respuesta, resolved: true };
        if (problemaTipo) patchBody.problema_tipo = problemaTipo;
        patchBody.resuelto_en_mod = resueltoEnMod;
        const res = await fetchBot(`${BOT_BASE_URL}/admin/bugs/${currentBugDetailId}?email=${adminEmail}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody)
        });
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          closeBugDetailModal();
          loadBugsAdminChart();
          loadBugsAdminList();
        } else {
          if (bugDetailError) {
            bugDetailError.textContent = data.message || 'Error al guardar y resolver.';
            bugDetailError.hidden = false;
          }
        }
      } catch (_) {
        if (bugDetailError) {
          bugDetailError.textContent = 'Error de conexión.';
          bugDetailError.hidden = false;
        }
      } finally {
        bugDetailResuelto.disabled = false;
      }
    });
  }

  if (bugDetailGuardar) {
    bugDetailGuardar.addEventListener('click', async () => {
      if (!currentBugDetailId || !currentUser?.user_email) return;
      const adminEmail = encodeURIComponent(currentUser.user_email);
      const nota = bugDetailNota?.value?.trim() || '';
      const respuesta = bugDetailRespuesta?.value?.trim() || '';
      const problemaTipo = bugDetailProblemaTipo?.value || '';
      let resueltoEnMod = bugDetailResueltoEnMod?.value || 'no';
      if (bugDetailProblemaTipo?.value === 'error_usuario') resueltoEnMod = 'no_aplica';
      if (bugDetailError) bugDetailError.hidden = true;
      bugDetailGuardar.disabled = true;
      try {
        const patchBody = {};
        if (nota) patchBody.nota = nota;
        if (respuesta) patchBody.respuesta = respuesta;
        if (problemaTipo) patchBody.problema_tipo = problemaTipo;
        patchBody.resuelto_en_mod = resueltoEnMod;
        const res = await fetchBot(`${BOT_BASE_URL}/admin/bugs/${currentBugDetailId}?email=${adminEmail}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody)
        });
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          closeBugDetailModal();
          loadBugsAdminChart();
          loadBugsAdminList();
        } else {
          if (bugDetailError) {
            bugDetailError.textContent = data.message || 'Error al guardar.';
            bugDetailError.hidden = false;
          }
        }
      } catch (_) {
        if (bugDetailError) {
          bugDetailError.textContent = 'Error de conexión.';
          bugDetailError.hidden = false;
        }
      } finally {
        bugDetailGuardar.disabled = false;
      }
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

  function clearMpAdminError() {
    if (!mpAdminErrorEl) return;
    mpAdminErrorEl.hidden = true;
    mpAdminErrorEl.textContent = '';
  }

  function showMpAdminError(msg) {
    if (!mpAdminErrorEl) return;
    mpAdminErrorEl.textContent = msg;
    mpAdminErrorEl.hidden = false;
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

    const manualDays = getAccesoManualDaysLeft(row);
    if (manualDays != null && manualDays > 0) {
      return `Manual (${manualDays} días)`;
    }

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

    let filtered = usersAdminCache.filter((row) => {
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

    const sortCol = usersAdminSort.column;
    const sortDir = usersAdminSort.direction === 'desc' ? -1 : 1;
    if (sortCol) {
      const cmp = (a, b) => {
        let va = '';
        let vb = '';
        switch (sortCol) {
          case 'email':
            va = (a.email || '').toString().toLowerCase();
            vb = (b.email || '').toString().toLowerCase();
            break;
          case 'discord':
            va = (a.discord_username || a.discord_id || '').toString().toLowerCase();
            vb = (b.discord_username || b.discord_id || '').toString().toLowerCase();
            break;
          case 'estado':
            va = (a.status || '').toString().toLowerCase();
            vb = (b.status || '').toString().toLowerCase();
            break;
          case 'roles':
            va = (pickDisplayRole(a.roles) || '').toLowerCase();
            vb = (pickDisplayRole(b.roles) || '').toLowerCase();
            break;
          case 'mp':
            va = (pickMercadoPagoLabel(a) || '').toLowerCase();
            vb = (pickMercadoPagoLabel(b) || '').toLowerCase();
            break;
          case 'pc':
            va = (a.pc_name || '').toString().toLowerCase();
            vb = (b.pc_name || '').toString().toLowerCase();
            break;
          case 'mod_order':
            va = String(a.mod_order_ok ?? '?');
            vb = String(b.mod_order_ok ?? '?');
            break;
          case 'teams':
            va = String(a.teams_ok ?? '?');
            vb = String(b.teams_ok ?? '?');
            break;
          case 'squad':
            va = String(a.squad_applied ?? '?');
            vb = String(b.squad_applied ?? '?');
            break;
          case 'switcher':
            va = a.switcher_abierto ? 'abierto' : 'cerrado';
            vb = b.switcher_abierto ? 'abierto' : 'cerrado';
            break;
          default:
            return 0;
        }
        return va.localeCompare(vb, undefined, { sensitivity: 'base' }) * sortDir;
      };
      filtered = filtered.slice().sort(cmp);
    }

    if (filtered.length === 0) {
      usersAdminTableBody.innerHTML = '<tr><td colspan="11">Sin resultados para este filtro.</td></tr>';
      updateUsersAdminSortHeaders();
      return;
    }

    usersAdminTableBody.innerHTML = '';

    filtered.forEach((row) => {
      const tr = document.createElement('tr');
      const displayRole = pickDisplayRole(row.roles);
      const mpText = pickMercadoPagoLabel(row);
      const statusRaw = (row.status || '').toString().toLowerCase();
      const statusClass = statusRaw === 'linked' ? 'linked' : statusRaw === 'pending' ? 'pending' : statusRaw === 'banned' || statusRaw === 'disabled' ? statusRaw : 'pending';
      const statusLabel = row.status || '-';
      const discordName = row.discord_username || row.discord_id || '-';
      const discordInitials = discordName !== '-' && discordName.length >= 2
        ? (discordName.slice(0, 2)).toUpperCase()
        : discordName !== '-' && discordName.length === 1
          ? discordName.toUpperCase()
          : '?';

      tr.innerHTML = `
        <td>${escapeHtml(row.email || '-')}</td>
        <td>
          <div class="assignee">
            <div class="avatar">${escapeHtml(discordInitials)}</div>
            ${escapeHtml(discordName)}
          </div>
        </td>
        <td><span class="status ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span></td>
        <td>${escapeHtml(displayRole)}</td>
        <td>${escapeHtml(mpText)}</td>
        <td>${escapeHtml(row.pc_name || '-')}</td>
        <td>${formatSetupCell(row.mod_order_ok)}</td>
        <td>${formatSetupCell(row.teams_ok)}</td>
        <td>${formatSetupCell(row.squad_applied)}</td>
        <td><span class="status ${row.switcher_abierto ? 'linked' : 'pending'}">${row.switcher_abierto ? 'Abierto' : 'Cerrado'}</span></td>
        <td>
          <div class="users-admin-actions">
            <button type="button" class="users-admin-btn users-admin-btn--edit" data-user-id="${escapeHtml(String(row.id))}">Editar</button>
            <button type="button" class="users-admin-btn users-admin-btn--delete" data-user-id="${escapeHtml(String(row.id))}">Eliminar</button>
          </div>
        </td>
      `;

      usersAdminTableBody.appendChild(tr);
    });

    updateUsersAdminSortHeaders();
  }

  function updateUsersAdminSortHeaders() {
    const table = usersAdminTableBody && usersAdminTableBody.closest('table');
    if (!table) return;
    const ths = table.querySelectorAll('thead th.users-admin-th-sortable');
    const col = usersAdminSort.column;
    const dir = usersAdminSort.direction;
    ths.forEach((th) => {
      const key = th.getAttribute('data-sort');
      th.classList.remove('sort-asc', 'sort-desc');
      if (key && key === col) {
        th.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  }

  async function fetchAdminUsers() {
    clearUsersAdminError();
    if (!currentUser || !currentUser.user_email) {
      showUsersAdminError('No hay sesión válida.');
      return;
    }
    if (!usersAdminTableBody) return;

    usersAdminTableBody.innerHTML = '<tr><td colspan="11">Cargando usuarios...</td></tr>';

    try {
      const email = encodeURIComponent(currentUser.user_email);
      const res = await fetchBot(`${BOT_BASE_URL}/admin/users?email=${email}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data || !data.success || !Array.isArray(data.users)) {
        const msg = data.message === 'rate_limited' || res.status === 429
          ? 'Demasiadas peticiones. Espera un momento y vuelve a intentar.'
          : (data.message || 'No se pudo cargar la lista de usuarios.');
        showUsersAdminError(msg);
        usersAdminTableBody.innerHTML = '';
        return;
      }

      usersAdminCache = data.users;
      if (usersAdminCache.length === 0) {
        usersAdminTableBody.innerHTML = '<tr><td colspan="11">No hay usuarios registrados.</td></tr>';
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

      const res = await fetchBot(`${BOT_BASE_URL}/admin/users/update?email=${adminEmail}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetchBot(`${BOT_BASE_URL}/admin/users/delete?email=${adminEmail}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const discordOAuthUrl = appConfig.discordOAuthBaseUrl;
      if (!discordOAuthUrl) {
        alert('Discord OAuth no está configurado. Comprueba que el bot tenga DISCORD_CLIENT_ID y DISCORD_REDIRECT_URI.');
        return;
      }

      // Asegurarnos de tener una fila en user_discord_links y su ID
      if (!currentDiscordRow) {
        await syncUserWithSupabase().catch(() => {});
      }

      const row = currentDiscordRow;
      // Usar solo id o link_code (nunca email) para evitar que alguien vincule su Discord a la cuenta de otro
      const stateValue = (row && (row.id || row.link_code)) || null;

      if (!stateValue) {
        alert('No se pudo preparar el enlace con Discord. Asegúrate de tener sesión iniciada y vuelve a intentarlo.');
        return;
      }

      const hasQuery = discordOAuthUrl.includes('?');
      const sep = hasQuery ? '&' : '?';
      const url = `${discordOAuthUrl}${sep}state=${encodeURIComponent(String(stateValue))}`;
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

  if (usersAdminSyncRolesBtn) {
    usersAdminSyncRolesBtn.addEventListener('click', async () => {
      clearUsersAdminError();
      if (!currentUser || !currentUser.user_email) {
        showUsersAdminError('No hay sesión válida.');
        return;
      }
      usersAdminSyncRolesBtn.disabled = true;
      usersAdminSyncRolesBtn.textContent = 'Sincronizando...';
      try {
        const adminEmail = encodeURIComponent(currentUser.user_email);
        const res = await fetchBot(`${BOT_BASE_URL}/admin/users/sync-roles?email=${adminEmail}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data || !data.success) {
          showUsersAdminError(data.message || 'No se pudieron refrescar los roles.');
        } else {
          await fetchAdminUsers();
        }
      } catch (_) {
        showUsersAdminError('Error de conexión al refrescar roles.');
      } finally {
        usersAdminSyncRolesBtn.disabled = false;
        usersAdminSyncRolesBtn.textContent = 'Refrescar roles';
      }
    });
  }

  if (mpAdminSearchBtn && mpAdminEmailInput && mpAdminResultEl) {
    mpAdminSearchBtn.addEventListener('click', async () => {
      clearMpAdminError();
      if (mpAdminResultEl) mpAdminResultEl.hidden = true;
      if (!currentUser || !currentUser.user_email) {
        showMpAdminError('No hay sesión válida.');
        return;
      }
      const email = (mpAdminEmailInput.value || '').trim();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        showMpAdminError('Introduce un correo electrónico válido.');
        return;
      }
      mpAdminSearchBtn.disabled = true;
      const originalText = mpAdminSearchBtn.textContent;
      mpAdminSearchBtn.textContent = 'Buscando...';
      try {
        const adminEmail = encodeURIComponent(currentUser.user_email);
        const res = await fetchBot(`${BOT_BASE_URL}/admin/mp/status?email=${adminEmail}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data || !data.success) {
          showMpAdminError(data.message || 'No se pudo obtener el estado de Mercado Pago.');
          return;
        }
        if (mpAdminResultEmailEl) mpAdminResultEmailEl.textContent = data.email || email;
        if (mpAdminResultHasSubEl) {
          mpAdminResultHasSubEl.textContent = data.has_subscription ? 'Sí' : 'No';
        }
        if (mpAdminResultStatusEl) {
          mpAdminResultStatusEl.textContent = data.status_label || data.raw_status || '-';
        }
        if (mpAdminResultDaysEl) {
          if (typeof data.days_left === 'number') {
            mpAdminResultDaysEl.textContent =
              data.days_left + ' día' + (data.days_left === 1 ? '' : 's');
          } else {
            mpAdminResultDaysEl.textContent = '-';
          }
        }
        if (mpAdminResultPayerNameEl) {
          const first = (data.payer_first_name || '').trim();
          const last = (data.payer_last_name || '').trim();
          mpAdminResultPayerNameEl.textContent = (first + ' ' + last).trim() || '-';
        }
        if (mpAdminResultExternalRefEl) {
          mpAdminResultExternalRefEl.textContent = (data.external_reference || '').trim() || '-';
        }
        mpAdminResultEl.hidden = false;
      } catch (_) {
        showMpAdminError('Error de conexión al consultar Mercado Pago.');
      } finally {
        mpAdminSearchBtn.disabled = false;
        mpAdminSearchBtn.textContent = originalText || 'Buscar';
      }
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

  const usersAdminTableWrapper = document.querySelector('.users-admin-table-wrapper');
  if (usersAdminTableWrapper) {
    usersAdminTableWrapper.addEventListener('click', (e) => {
      const th = e.target && e.target.closest('th.users-admin-th-sortable');
      if (!th) return;
      const key = th.getAttribute('data-sort');
      if (!key) return;
      if (usersAdminSort.column === key) {
        usersAdminSort.direction = usersAdminSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        usersAdminSort.column = key;
        usersAdminSort.direction = 'asc';
      }
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
  const btnFullscreen = document.getElementById('btnFullscreen');
  const iconFullscreen = btnFullscreen?.querySelector('.titlebar-icon-fullscreen');
  const iconRestore = btnFullscreen?.querySelector('.titlebar-icon-restore');
  function updateFullscreenButton(isFull) {
    if (!btnFullscreen || !iconFullscreen || !iconRestore) return;
    btnFullscreen.setAttribute('aria-label', isFull ? 'Salir de pantalla completa' : 'Pantalla completa');
    iconFullscreen.hidden = !!isFull;
    iconRestore.hidden = !isFull;
  }
  if (btnFullscreen && window.electronAPI.toggleFullscreen) {
    btnFullscreen.addEventListener('click', () => window.electronAPI.toggleFullscreen());
    window.electronAPI.isFullScreen?.().then(updateFullscreenButton).catch(() => {});
    window.electronAPI.onFullscreenChange?.(updateFullscreenButton);
  }
  document.getElementById('btnClose').addEventListener('click', () => window.electronAPI.close());

  // Versión y auto-actualización (solo en app empaquetada)
  const appVersionEl = document.getElementById('appVersion');
  const updateBanner = document.getElementById('updateBanner');
  const updateBannerText = document.getElementById('updateBannerText');
  const btnRestartToUpdate = document.getElementById('btnRestartToUpdate');
  const updateModal = document.getElementById('updateModal');
  const updateModalMessage = document.getElementById('updateModalMessage');
  const updateModalRestart = document.getElementById('updateModalRestart');

  function showUpdateModal(message) {
    if (!updateModal) return;
    if (updateModalMessage && typeof message === 'string' && message.trim() !== '') {
      updateModalMessage.textContent = message;
    }
    updateModal.hidden = false;
  }
  if (window.electronAPI.getAppVersion) {
    window.electronAPI.getAppVersion().then((v) => {
      if (appVersionEl && v) appVersionEl.textContent = 'v' + v;
    }).catch(() => {});
  }
  if (window.electronAPI.onUpdateStatus && updateBanner && updateBannerText && btnRestartToUpdate) {
    window.electronAPI.onUpdateStatus((payload) => {
      if (payload.type === 'update-available') {
        updateBannerText.textContent =
          'Nueva versión ' + (payload.version || '') + ' disponible. Descargando…';
        btnRestartToUpdate.hidden = true;
        updateBanner.hidden = false;
      } else if (payload.type === 'update-downloaded') {
        const versionLabel = payload.version ? ` (${payload.version})` : '';
        updateBannerText.textContent =
          'Actualización lista' + versionLabel + '. Reinicia la aplicación para instalar.';
        btnRestartToUpdate.hidden = false;
        updateBanner.hidden = false;
        showUpdateModal(
          `Se ha descargado una nueva versión${versionLabel}. Debes reiniciar Argenmod Auth para completar la actualización.`
        );
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
  if (updateModalRestart) {
    updateModalRestart.addEventListener('click', () => {
      if (window.electronAPI.quitAndInstall) window.electronAPI.quitAndInstall();
    });
  }

  // Al volver a la app (p. ej. desde Discord), refrescar estado y roles si el usuario está anclado
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!currentUser || !panelDashboard || panelDashboard.hidden) return;
    refreshDiscordFromSupabase().catch(() => {});
  });
  window.addEventListener('focus', () => {
    if (!currentUser || !panelDashboard || panelDashboard.hidden) return;
    refreshDiscordFromSupabase().catch(() => {});
  });
})();
