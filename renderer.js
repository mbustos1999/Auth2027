(function () {
  const panelLogin = document.getElementById('panelLogin');
  const panelDashboard = document.getElementById('panelDashboard');
  const formLogin = document.getElementById('formLogin');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const btnSubmit = document.getElementById('btnSubmit');
  const messageError = document.getElementById('messageError');
  const userNameEl = document.getElementById('userName');
  const userEmailEl = document.getElementById('userEmail');
  const userAvatarEl = document.getElementById('userAvatar');
  const btnLogout = document.getElementById('btnLogout');

  const apiConfig = window.apiConfig || {};
  const baseUrl = (apiConfig.baseUrl != null && apiConfig.baseUrl !== '') ? String(apiConfig.baseUrl).trim() : '';
  const authEndpoint = (apiConfig.authEndpoint != null && apiConfig.authEndpoint !== '') ? String(apiConfig.authEndpoint).trim() : '';
  const authUrl = baseUrl && authEndpoint ? `${baseUrl.replace(/\/$/, '')}${authEndpoint}` : '';

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
    userNameEl.textContent = user.display_name || 'Usuario';
    userEmailEl.textContent = user.user_email || '';
    userAvatarEl.textContent = (user.display_name || user.user_email || 'U').charAt(0).toUpperCase();
    panelLogin.hidden = true;
    panelDashboard.hidden = false;
  }

  function showLogin() {
    panelLogin.hidden = false;
    panelDashboard.hidden = true;
    usernameInput.value = '';
    passwordInput.value = '';
    clearError();
  }

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError('Introduce usuario o email y contraseña.');
      return;
    }

    const user = await login(username, password);
    if (user) showDashboard(user);
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

  document.getElementById('btnMinimize').addEventListener('click', () => window.electronAPI.minimize());
  document.getElementById('btnClose').addEventListener('click', () => window.electronAPI.close());
})();
