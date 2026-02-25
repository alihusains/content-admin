/**
 * API client wrapper — handles auth headers, JSON parsing, and error handling.
 * All API calls go through this module for consistency.
 */
const API = {
  /**
   * Get the stored JWT token
   */
  getToken() {
    return localStorage.getItem("token");
  },

  /**
   * Get decoded token payload (without verification — for UI display only)
   */
  getUser() {
    const token = this.getToken();
    if (!token) return null;
    try {
      // Decode JWT payload using base64url-safe decoding
      let base64 = token.split(".")[1];
      base64 = base64.replace(/-/g, "+").replace(/_/g, "/");
      // Add padding if needed
      while (base64.length % 4) base64 += "=";
      const payload = JSON.parse(atob(base64));
      // Check expiry
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        this.logout();
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.getUser() !== null;
  },

  /**
   * Clear token and redirect to login
   */
  logout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  },

  /**
   * Build authorization headers
   */
  headers(extra = {}) {
    const h = { "Content-Type": "application/json", ...extra };
    const token = this.getToken();
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  },

  /**
   * Generic fetch wrapper with error handling
   */
  async request(url, options = {}) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: this.headers(options.headers),
      });

      // Handle auth errors globally
      if (res.status === 401) {
        this.logout();
        return null;
      }

      // For file downloads
      if (res.headers.get("content-type")?.includes("application/sql") ||
          res.headers.get("content-type")?.includes("application/octet-stream")) {
        return res;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      return data;
    } catch (err) {
      if (err.message === "Failed to fetch") {
        throw new Error("Network error. Please check your connection.");
      }
      throw err;
    }
  },

  // --- Auth ---
  login(email, password) {
    return this.request("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  // --- Content ---
  getTree(mode = "structure", languageCode = null) {
    let url = `/api/content-tree?mode=${mode}`;
    if (languageCode) url += `&language_code=${languageCode}`;
    return this.request(url);
  },

  getChildren(parentId = null) {
    const pid = parentId || "null";
    return this.request(`/api/content-children?parent_id=${pid}`);
  },

  createContent(data) {
    return this.request("/api/content-create", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateContent(data) {
    return this.request("/api/content-update", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteContent(id) {
    return this.request("/api/content-delete", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  },

  reorderContent(parentId, orderedIds) {
    return this.request("/api/content-reorder", {
      method: "POST",
      body: JSON.stringify({ parent_id: parentId, ordered_ids: orderedIds }),
    });
  },

  // --- Translations ---
  getTranslations(contentId) {
    return this.request(`/api/translations-get?content_id=${contentId}`);
  },

  saveTranslation(data) {
    return this.request("/api/translation-save", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // --- Versions ---
  getVersions() {
    return this.request("/api/versions-list");
  },

  exportDb(versionNumber, notes) {
    return this.request("/api/export-db", {
      method: "POST",
      body: JSON.stringify({ version_number: versionNumber, notes }),
    });
  },

  // --- Stats ---
  getStats() {
    return this.request("/api/stats");
  },
};

// Auth guard — redirect to login if not authenticated (except on login page)
function requireAuth() {
  if (!API.isAuthenticated() && !window.location.pathname.match(/^\/?(index\.html)?$/)) {
    window.location.href = "/";
    return false;
  }
  return true;
}
