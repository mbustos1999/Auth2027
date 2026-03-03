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

  document.getElementById('btnMinimize').addEventListener('click', () => window.electronAPI.minimize());
  document.getElementById('btnClose').addEventListener('click', () => window.electronAPI.close());
})();
