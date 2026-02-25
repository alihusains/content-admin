/**
 * Toast notification system and UI utility helpers.
 * Provides non-intrusive feedback to users for all operations.
 */

/* ── Toast Notifications ── */
const Toast = {
  container: null,

  /**
   * Initialize the toast container (call once on page load)
   */
  init() {
    if (this.container) return;
    this.container = document.createElement("div");
    this.container.className = "toast-container position-fixed top-0 end-0 p-3";
    this.container.style.zIndex = "9999";
    document.body.appendChild(this.container);
  },

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - 'success' | 'error' | 'warning' | 'info'
   * @param {number} duration - Auto-dismiss time in ms (0 = manual)
   */
  show(message, type = "info", duration = 4000) {
    this.init();

    const icons = {
      success: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>`,
      error: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293z"/></svg>`,
      warning: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/></svg>`,
      info: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.399l-.442.002-.073-.346 2.435-.558z"/><circle cx="8" cy="4.5" r="1"/></svg>`,
    };

    const colorMap = {
      success: "bg-success",
      error: "bg-danger",
      warning: "bg-warning text-dark",
      info: "bg-primary",
    };

    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-white border-0 ${colorMap[type]} show`;
    toast.setAttribute("role", "alert");
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          ${icons[type] || ""} ${this.escapeHtml(message)}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto"
                onclick="this.closest('.toast').remove()"></button>
      </div>`;

    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        toast.classList.add("toast-fade-out");
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    return toast;
  },

  success(msg) { return this.show(msg, "success"); },
  error(msg) { return this.show(msg, "error", 6000); },
  warning(msg) { return this.show(msg, "warning", 5000); },
  info(msg) { return this.show(msg, "info"); },

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },
};

/* ── Loading State Helpers ── */
const Loading = {
  /**
   * Show loading state on a button
   */
  start(btn, text = "Loading...") {
    if (!btn) return;
    btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${text}`;
  },

  /**
   * Restore button to original state
   */
  stop(btn) {
    if (!btn || !btn.dataset.originalText) return;
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText;
    delete btn.dataset.originalText;
  },
};

/* ── Confirmation Dialog ── */
async function confirmAction(title, message, btnText = "Delete", btnClass = "btn-danger") {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal fade show d-block";
    modal.style.background = "rgba(0,0,0,0.5)";
    modal.style.zIndex = "10000";
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="btn-close" data-action="cancel"></button>
          </div>
          <div class="modal-body"><p>${message}</p></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-action="cancel">Cancel</button>
            <button class="btn ${btnClass}" data-action="confirm">${btnText}</button>
          </div>
        </div>
      </div>`;

    modal.addEventListener("click", (e) => {
      const action = e.target.dataset.action;
      if (action === "confirm") { modal.remove(); resolve(true); }
      else if (action === "cancel") { modal.remove(); resolve(false); }
    });

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === "Escape") { modal.remove(); resolve(false); document.removeEventListener("keydown", escHandler); }
    };
    document.addEventListener("keydown", escHandler);

    document.body.appendChild(modal);
  });
}

/* ── Date Formatting ── */
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Debounce ── */
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
