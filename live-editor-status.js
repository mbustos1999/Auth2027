(() => {
  const LIVE_EDITOR_OK_TEXT = "Live editor OK";
  const LIVE_EDITOR_BAD_TEXT = "No tienes live editor instalado o en la ruta correcta";
  const MODS_OK_TEXT = "Orden de mods es correcta";
  const MODS_BAD_TEXT = "Orden de mods incorrecta";
  const USERS_OK_TEXT = "OK";
  const USERS_BAD_TEXT = "RUTA INCORRECTA";

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
    } catch (_err) {
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
    try {
      const result = await window.electronAPI?.getModOrderStatus?.();
      const isOk = !!(result && result.ok && result.correct === true);
      setModsOrderHeaderStatus(isOk);
    } catch (_err) {
      setModsOrderHeaderStatus(false);
    }
  }

  function parseLiveEditorFlag(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === "true" || v === "1" || v === "ok") return true;
    if (v === "false" || v === "0" || v === "nok") return false;
    return null;
  }

  function getRowLiveEditorOk(row) {
    const fromRow = parseLiveEditorFlag(row.getAttribute("data-live-editor-ok"));
    if (fromRow !== null) return fromRow;

    const fromAnyCell = parseLiveEditorFlag(row.getAttribute("data-live-editor"));
    if (fromAnyCell !== null) return fromAnyCell;

    const actionable = row.querySelector("button, a");
    const fromAction = parseLiveEditorFlag(actionable?.getAttribute("data-live-editor-ok"));
    if (fromAction !== null) return fromAction;

    return false;
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

      const isOk = getRowLiveEditorOk(row);
      liveCell.textContent = isOk ? USERS_OK_TEXT : USERS_BAD_TEXT;
      liveCell.title = liveCell.textContent;
      liveCell.classList.toggle("users-live-editor-cell--ok", !!isOk);
      liveCell.classList.toggle("users-live-editor-cell--nok", !isOk);
    });
  }

  const observer = new MutationObserver(() => patchUsersLiveEditorCells());

  window.addEventListener("DOMContentLoaded", () => {
    patchUsersLiveEditorCells();
    refreshHeaderFromLocalMods();
    refreshModsOrderStatus();

    const usersBody = document.getElementById("usersAdminTableBody");
    if (usersBody) {
      observer.observe(usersBody, { childList: true, subtree: true });
    }

    document.addEventListener("click", (ev) => {
      const btn = ev.target instanceof Element ? ev.target.closest('[data-tab="Switcher"]') : null;
      if (btn) {
        refreshModsOrderStatus();
      }
    });

    window.setInterval(refreshHeaderFromLocalMods, 12000);
    window.setInterval(refreshModsOrderStatus, 8000);
  });
})();
