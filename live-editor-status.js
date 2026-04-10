(() => {
  const LIVE_EDITOR_OK_TEXT = "Live editor OK";
  const LIVE_EDITOR_BAD_TEXT = "No tienes live editor instalado o en la ruta correcta";
  const MODS_OK_TEXT = "Orden de mods es correcta";
  const MODS_BAD_TEXT = "Orden de mods incorrecta";
  const USERS_OK_TEXT = "OK";
  const USERS_BAD_TEXT = "RUTA INCORRECTA";
  const USERS_UNKNOWN_TEXT = "—";

  /** @type {Map<string, boolean | null>} email -> true | false | null (sin dato claro) */
  const liveEditorByEmail = new Map();

  /** @type {number|null} */
  let intervalHeaderMods = null;
  /** @type {number|null} */
  let intervalModsOrder = null;
  /** Flag para evitar llamadas concurrentes a refreshModsOrderStatus */
  let modsOrderRefreshInProgress = false;

  function normalizeEmail(s) {
    return String(s || "").trim().toLowerCase();
  }

  function ingestAdminUsersPayload(raw) {
    let data = raw;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      } catch (err) {
        console.warn("[live-editor-status] Error al parsear payload de admin/users:", err.message);
        return;
      }
    }
    if (!data || !Array.isArray(data.users)) return;

    data.users.forEach((u) => {
      const email = normalizeEmail(u.email);
      if (!email) return;

      if (u.live_editor_ok === true) {
        liveEditorByEmail.set(email, true);
        return;
      }
      if (u.live_editor_ok === false) {
        liveEditorByEmail.set(email, false);
        return;
      }

      if (Array.isArray(u.mods_files) && u.mods_files.length > 0) {
        liveEditorByEmail.set(email, true);
        return;
      }

      liveEditorByEmail.set(email, null);
    });

    patchUsersLiveEditorCells();
  }

  function patchFetchBotForAdminUsers() {
    const api = window.electronAPI;
    if (!api || typeof api.fetchBot !== "function" || api.__liveEditorAdminUsersPatched) return;
    const orig = api.fetchBot.bind(api);
    api.fetchBot = async (url, opts) => {
      const result = await orig(url, opts);
      try {
        if (
          String(url).includes("admin/users") &&
          result &&
          result.ok &&
          typeof result.body === "string"
        ) {
          ingestAdminUsersPayload(result.body);
        }
      } catch (err) {
        console.warn("[live-editor-status] Error al procesar respuesta de admin/users:", err.message);
      }
      return result;
    };
    api.__liveEditorAdminUsersPatched = true;
  }

  function getEmailFromUserRow(row) {
    if (!row) return "";
    const first = row.querySelector("td");
    if (!first) return "";
    const t = normalizeEmail(first.textContent.replace(/\s+/g, " "));
    return t.includes("@") ? t : "";
  }

  function setLiveEditorHeaderStatus(isOk) {
    const headerEl = document.getElementById("liveEditorHeaderStatus");
    if (!headerEl) return;
    headerEl.hidden = false;
    headerEl.textContent = isOk ? LIVE_EDITOR_OK_TEXT : LIVE_EDITOR_BAD_TEXT;
    headerEl.title = headerEl.textContent;
    headerEl.classList.toggle("dash-live-editor-status--ok", !!isOk);
    headerEl.classList.toggle("dash-live-editor-status--nok", !isOk);
  }

  async function refreshHeaderFromLocalMods() {
    try {
      const files = await window.electronAPI?.listLiveEditorModsFiles?.();
      const isOk = Array.isArray(files) && files.length > 0;
      setLiveEditorHeaderStatus(isOk);
    } catch (err) {
      console.error("[live-editor-status] Error IPC al listar archivos de mods:", err.message);
      setLiveEditorHeaderStatus(false);
    }
  }

  function setModsOrderHeaderStatus(isOk) {
    const statusEl = document.getElementById("modsOrderHeaderStatus");
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = isOk ? MODS_OK_TEXT : MODS_BAD_TEXT;
    statusEl.title = statusEl.textContent;
    statusEl.classList.toggle("dash-mods-order-status--ok", !!isOk);
    statusEl.classList.toggle("dash-mods-order-status--error", !isOk);
  }

  async function refreshModsOrderStatus() {
    if (modsOrderRefreshInProgress) return;
    modsOrderRefreshInProgress = true;
    try {
      const result = await window.electronAPI?.getModOrderStatus?.();
      const isOk = !!(result && result.ok && result.correct === true);
      setModsOrderHeaderStatus(isOk);
    } catch (err) {
      console.error("[live-editor-status] Error IPC al obtener estado de orden de mods:", err.message);
      setModsOrderHeaderStatus(false);
    } finally {
      modsOrderRefreshInProgress = false;
    }
  }

  function parseLiveEditorFlag(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === "true" || v === "1" || v === "ok") return true;
    if (v === "false" || v === "0" || v === "nok") return false;
    return null;
  }

  /**
   * @returns {'ok'|'bad'|'unknown'}
   */
  function getRowLiveEditorState(row) {
    const fromRow = parseLiveEditorFlag(row.getAttribute("data-live-editor-ok"));
    if (fromRow === true) return "ok";
    if (fromRow === false) return "bad";

    const fromAnyCell = parseLiveEditorFlag(row.getAttribute("data-live-editor"));
    if (fromAnyCell === true) return "ok";
    if (fromAnyCell === false) return "bad";

    const actionable = row.querySelector("button, a");
    const fromAction = parseLiveEditorFlag(actionable?.getAttribute("data-live-editor-ok"));
    if (fromAction === true) return "ok";
    if (fromAction === false) return "bad";

    const email = getEmailFromUserRow(row);
    if (email && liveEditorByEmail.has(email)) {
      const v = liveEditorByEmail.get(email);
      if (v === true) return "ok";
      if (v === false) return "bad";
      return "unknown";
    }

    return "unknown";
  }

  function patchUsersLiveEditorCells() {
    const body = document.getElementById("usersAdminTableBody");
    if (!body) return;

    const rows = body.querySelectorAll("tr");
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (!cells || cells.length === 0) return;

      const actionCell = cells[cells.length - 1];
      let liveCell = row.querySelector("td.users-live-editor-cell");
      if (!liveCell) {
        liveCell = document.createElement("td");
        liveCell.className = "users-live-editor-cell";
        row.insertBefore(liveCell, actionCell);
      }

      const state = getRowLiveEditorState(row);
      if (state === "ok") {
        liveCell.textContent = USERS_OK_TEXT;
        liveCell.title = "Ruta de Live Editor correcta (último reporte al iniciar sesión)";
      } else if (state === "bad") {
        liveCell.textContent = USERS_BAD_TEXT;
        liveCell.title = "Sin carpeta mods en la ruta esperada o reporte en false";
      } else {
        liveCell.textContent = USERS_UNKNOWN_TEXT;
        liveCell.title =
          "Sin datos: el usuario aún no envió setup-info tras actualizar la app, o no se pudo leer el email de la fila";
      }
      liveCell.classList.toggle("users-live-editor-cell--ok", state === "ok");
      liveCell.classList.toggle("users-live-editor-cell--nok", state === "bad");
      liveCell.classList.toggle("users-live-editor-cell--unknown", state === "unknown");
    });
  }

  /** Fallback SVG por número de paso para imágenes del tutorial que no cargan */
  const TUTORIAL_STEP_FALLBACKS = {
    "Paso 1": "%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 120 120%22%3E%3Crect width%3D%22120%22 height%3D%22120%22 rx%3D%2212%22 fill%3D%22%231e293b%22%2F%3E%3Ctext x%3D%2260%22 y%3D%2272%22 font-size%3D%2248%22 font-weight%3D%22bold%22 fill%3D%22%2360a5fa%22 text-anchor%3D%22middle%22%3E1%3C%2Ftext%3E%3C%2Fsvg%3E",
    "Paso 2": "%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 120 120%22%3E%3Crect width%3D%22120%22 height%3D%22120%22 rx%3D%2212%22 fill%3D%22%231e293b%22%2F%3E%3Ctext x%3D%2260%22 y%3D%2272%22 font-size%3D%2248%22 font-weight%3D%22bold%22 fill%3D%22%2394a3b8%22 text-anchor%3D%22middle%22%3E2%3C%2Ftext%3E%3C%2Fsvg%3E",
    "Paso 4": "%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 120 120%22%3E%3Crect width%3D%22120%22 height%3D%22120%22 rx%3D%2212%22 fill%3D%22%231e293b%22%2F%3E%3Ctext x%3D%2260%22 y%3D%2272%22 font-size%3D%2248%22 font-weight%3D%22bold%22 fill%3D%22%2394a3b8%22 text-anchor%3D%22middle%22%3E4%3C%2Ftext%3E%3C%2Fsvg%3E",
  };

  function attachTutorialImageFallbacks() {
    document.querySelectorAll(".tutorial-illustration img[alt]").forEach((img) => {
      const alt = img.getAttribute("alt");
      const fallback = TUTORIAL_STEP_FALLBACKS[alt];
      if (!fallback) return;
      img.addEventListener("error", function onError() {
        img.removeEventListener("error", onError);
        img.src = "data:image/svg+xml," + fallback;
      });
    });
  }

  function handleSwitcherClick(ev) {
    const btn = ev.target instanceof Element ? ev.target.closest('[data-tab="Switcher"]') : null;
    if (btn) {
      refreshModsOrderStatus();
    }
  }

  function cleanup() {
    if (intervalHeaderMods !== null) {
      clearInterval(intervalHeaderMods);
      intervalHeaderMods = null;
    }
    if (intervalModsOrder !== null) {
      clearInterval(intervalModsOrder);
      intervalModsOrder = null;
    }
    observer.disconnect();
    document.removeEventListener("click", handleSwitcherClick);
  }

  const observer = new MutationObserver(() => patchUsersLiveEditorCells());

  patchFetchBotForAdminUsers();

  window.addEventListener("DOMContentLoaded", () => {
    patchFetchBotForAdminUsers();
    patchUsersLiveEditorCells();
    attachTutorialImageFallbacks();
    refreshHeaderFromLocalMods();
    refreshModsOrderStatus();

    const usersBody = document.getElementById("usersAdminTableBody");
    if (usersBody) {
      observer.observe(usersBody, { childList: true, subtree: true });
    }

    document.addEventListener("click", handleSwitcherClick);

    intervalHeaderMods = window.setInterval(refreshHeaderFromLocalMods, 12000);
    intervalModsOrder = window.setInterval(refreshModsOrderStatus, 8000);
  });

  window.addEventListener("beforeunload", cleanup);
})();
