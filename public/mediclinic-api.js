/* MediChannel browser API client.
 *
 * Every call goes through the same-origin BFF. The tab-specific bearer token
 * (mc_tab_token in sessionStorage) is the only credential this client sends;
 * no cookie fallback exists, so a URL pasted into another browsing context
 * cannot inherit the session.
 */
(function () {
  "use strict";

  class MediChannelError extends Error {
    constructor(message, status, body) {
      super(message || "The request could not be completed.");
      this.name = "MediChannelError";
      this.status = status || 0;
      this.body = body || null;
      this.code = body && typeof body.errorCode === "string"
        ? body.errorCode
        : null;
    }
  }

  function friendlyMessage(status, body, fallback) {
    if (status === 403) {
      // Each tab carries its own bearer token (mc_tab_token), so a 403 is the
      // server's real access/state decision - not evidence that another tab
      // replaced this tab's session. Show the actual reason to the user.
      return (body && typeof body.message === "string" && body.message.trim())
        ? body.message.trim()
        : "You do not have access to this item.";
    }
    if (body && typeof body.message === "string" && body.message.trim()) {
      return body.message.trim();
    }
    if (status === 401) return "Please sign in again to continue.";
    if (status === 404) return "That record could not be found.";
    if (status === 409) return "That action conflicts with the current state.";
    if (status === 422) return "Some of the details provided are not valid.";
    if (status === 429) return "Too many requests. Please wait a moment.";
    if (status >= 500) {
      return "The hospital service is unavailable right now. Please try again.";
    }
    return fallback || "The request could not be completed.";
  }

  // Reads a response body once, tolerating empty and non-JSON replies.
  async function readBody(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  function errorFromResponse(response, body) {
    return new MediChannelError(
      friendlyMessage(response.status, body),
      response.status,
      body
    );
  }

  const DEFAULT_TIMEOUT_MS = 25_000;
  const inFlight = new Map();

  function requestSignal(settings) {
    if (settings.signal) return settings.signal;
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
    }
    return undefined;
  }

  // Collapse simultaneous identical reads. The cache lives only for the
  // lifetime of the request, so fresh data is never served from memory.
  function dedupe(key, task) {
    if (!key) return task();
    const pending = inFlight.get(key);
    if (pending) return pending;

    const promise = Promise.resolve()
      .then(task)
      .finally(() => {
        if (inFlight.get(key) === promise) inFlight.delete(key);
      });
    inFlight.set(key, promise);
    return promise;
  }

  async function performRequest(url, settings) {
    let response;

    try {
      response = await fetch(url, settings);
    } catch (cause) {
      const offline = new MediChannelError(
        navigator.onLine
          ? "Unable to reach the hospital service. Check your connection."
          : "You appear to be offline. Reconnect and try again.",
        0,
        null
      );
      offline.cause = cause;
      throw offline;
    }

    const body = await readBody(response);

    if (!response.ok) {
      throw errorFromResponse(response, body);
    }

    return body;
  }

  function request(path, options) {
    const settings = Object.assign(
      { method: "GET", credentials: "same-origin", cache: "no-store" },
      options || {}
    );

    const headers = new Headers(settings.headers || {});
    const tabToken = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("mc_tab_token") : null;
    // Marks this as SPA traffic so the BFF never falls back to an ambient
    // cookie. The tab token below is the only credential the SPA accepts.
    headers.set("X-Medichannel-Tab", "1");
    if (tabToken && !headers.has("Authorization")) {
      headers.set("Authorization", "Bearer " + tabToken);
    }

    if (
      settings.body !== undefined &&
      settings.body !== null &&
      !(settings.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
      settings.body = JSON.stringify(settings.body);
    }

    settings.headers = headers;
    const callerSignal = settings.signal;
    const signal = requestSignal(settings);
    if (signal) settings.signal = signal;

    const url = "/api/backend/" + String(path).replace(/^\/+/, "");
    const method = String(settings.method || "GET").toUpperCase();
    const key =
      !callerSignal && (method === "GET" || method === "HEAD")
        ? method + " " + url
        : null;

    return dedupe(key, () => performRequest(url, settings));
  }

  function query(params) {
    const search = new URLSearchParams();

    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, value);
      }
    });

    const encoded = search.toString();
    return encoded ? "?" + encoded : "";
  }

  const api = {
    MediChannelError,

    request,

    // Authentication -------------------------------------------------
    me() {
      // The session route lives outside the BFF prefix. Never fall back to a
      // shared cookie: without this tab's token there is no session to keep.
      const tabToken = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("mc_tab_token") : null;
      if (!tabToken) return Promise.resolve(null);

      const headers = { "X-Medichannel-Tab": "1" };
      headers["Authorization"] = "Bearer " + tabToken;
      const settings = {
        headers,
        credentials: "same-origin",
        cache: "no-store",
      };
      const signal = requestSignal(settings);
      if (signal) settings.signal = signal;

      return dedupe("GET /api/auth/me", async () => {
        const response = await fetch("/api/auth/me", settings);

        if (response.status === 401) return null;

        const body = await readBody(response);

        if (!response.ok) {
          throw errorFromResponse(response, body);
        }

        return body;
      });
    },

    wsTicket() {
      return request("auth/ws-ticket", { method: "POST" });
    },

    // Discovery ------------------------------------------------------
    doctors(filters) {
      return request("doctors" + query(filters));
    },

    // Guest dashboard roster with room, fee, clinic hours and live queue.
    doctorDirectory() {
      return request("public/doctors");
    },

    specialisations() {
      return request("specialisations");
    },

    sessions(filters) {
      return request("sessions" + query(filters));
    },

    createSession(payload) {
      return request("sessions", {
        method: "POST",
        body: payload,
      });
    },

    rooms() {
      return request("rooms");
    },

    createRoom(payload) {
      return request("rooms", {
        method: "POST",
        body: payload,
      });
    },

    cancelSession(sessionId, reason) {
      return request("sessions/" + encodeURIComponent(sessionId) + "/cancel", {
        method: "PATCH",
        body: { reason },
      });
    },

    delaySession(sessionId, minutes) {
      return request("sessions/" + encodeURIComponent(sessionId) + "/delay", {
        method: "PATCH",
        body: { delayMinutes: Number(minutes) },
      });
    },

    delayAppointment(appointmentId, minutes) {
      return request(
        "appointments/" + encodeURIComponent(appointmentId) + "/delay",
        {
          method: "PATCH",
          body: { delayMinutes: Number(minutes) },
        }
      );
    },

    // Notifications --------------------------------------------------
    notifications() {
      return request("notifications");
    },

    unreadNotificationCount() {
      return request("notifications/unread-count");
    },

    markNotificationRead(id) {
      return request("notifications/" + encodeURIComponent(id) + "/read", { method: "PATCH" });
    },

    markAllNotificationsRead() {
      return request("notifications/read-all", { method: "PATCH" });
    },

    auditLogs(params) {
      return request("audit-logs" + query(params));
    },

    // Reports ---------------------------------------------------------
    // Authoritative dashboard figures. Pass { from, to } to scope the
    // aggregates to a single day instead of the backend's 30-day default.
    reportOverview(filters) {
      return request("reports/overview" + query(filters));
    },

    // Notices ---------------------------------------------------------
    notices() {
      return request("notices");
    },

    managerNotices() {
      return request("notices/manage");
    },

    createNotice(payload) {
      return request("notices", {
        method: "POST",
        body: payload,
      });
    },

    updateNotice(noticeId, payload) {
      return request("notices/" + encodeURIComponent(noticeId), {
        method: "PUT",
        body: payload,
      });
    },

    publishNotice(noticeId) {
      return request(
        "notices/" + encodeURIComponent(noticeId) + "/publish",
        { method: "PATCH" }
      );
    },

    withdrawNotice(noticeId) {
      return request(
        "notices/" + encodeURIComponent(noticeId) + "/withdraw",
        { method: "PATCH" }
      );
    },

    deleteNotice(noticeId) {
      return request("notices/" + encodeURIComponent(noticeId), {
        method: "DELETE",
      });
    },

    // Feedback moderation ---------------------------------------------
    managerReviews(status, page, size, doctorId, rating) {
      const params = {};
      if (status) params.status = status;
      if (page != null) params.page = page;
      if (size != null) params.size = size;
      if (doctorId) params.doctorId = doctorId;
      if (rating != null) params.rating = rating;
      return request("reviews/manage" + query(params));
    },

    approveReview(reviewId) {
      return request(
        "reviews/" + encodeURIComponent(reviewId) + "/approve",
        { method: "PATCH" }
      );
    },

    hideReview(reviewId) {
      return request(
        "reviews/" + encodeURIComponent(reviewId) + "/hide",
        { method: "PATCH" }
      );
    },

    sessionQueue(sessionId) {
      return request(
        "sessions/" + encodeURIComponent(sessionId) + "/queue"
      );
    },

    // Admin -----------------------------------------------------------
    adminCreateDoctor(payload) {
      return request("doctors", {
        method: "POST",
        body: payload,
      });
    },

    adminUpdateDoctor(doctorId, payload) {
      return request(
        "doctors/" + encodeURIComponent(doctorId),
        {
          method: "PUT",
          body: payload,
        }
      );
    },

    adminCreateUser(payload) {
      return request("admin/users", {
        method: "POST",
        body: payload,
      });
    },

    adminUpdateUser(userId, payload) {
      return request(
        "admin/users/" + encodeURIComponent(userId),
        {
          method: "PATCH",
          body: payload,
        }
      );
    },

    resetStaffPassword(userId, payload) {
      return request(
        "admin/users/" +
          encodeURIComponent(userId) +
          "/reset-password",
        {
          method: "POST",
          body: payload,
        }
      );
    },

    adminDeleteUser(userId) {
      return request(
        "admin/users/" + encodeURIComponent(userId),
        {
          method: "DELETE",
        }
      );
    },

    adminDeleteDoctor(doctorId) {
      return request(
        "doctors/" + encodeURIComponent(doctorId),
        {
          method: "DELETE",
        }
      );
    },

    adminUsers(params) {
      return request("admin/users" + query(params));
    },

    adminStats() {
      return request("admin/stats");
    },

    adminAppointments(params) {
      return request("admin/appointments" + query(params));
    },

    markAppointmentArrived(appointmentId) {
      return request(
        "admin/appointments/" +
          encodeURIComponent(appointmentId) +
          "/arrive",
        { method: "PATCH", body: {} }
      );
    },

    bookWalkIn(payload) {
      return request("admin/appointments/walk-in", {
        method: "POST",
        body: payload,
      });
    },

    adminActivateUser(userId) {
      return request(
        "admin/users/" + encodeURIComponent(userId) + "/activate",
        {
          method: "PATCH",
          body: {},
        }
      );
    },

    adminSuspendUser(userId) {
      return request(
        "admin/users/" + encodeURIComponent(userId) + "/suspend",
        {
          method: "PATCH",
          body: {},
        }
      );
    },

    // Patient appointments -------------------------------------------
    myAppointments() {
      return request("appointments/me");
    },

    myActiveAppointments() {
      return request("appointments/me/active");
    },

    myAppointmentHistory(params) {
      return request("appointments/me/history" + query(params));
    },

    myAppointment(appointmentId) {
      return request("appointments/" + encodeURIComponent(appointmentId));
    },

    bookAppointment(sessionId, reason, period) {
      return request("appointments", {
        method: "POST",
        body: { sessionId, reason, period },
      });
    },

    cancelAppointment(appointmentId, reason) {
      return request(
        "appointments/" + encodeURIComponent(appointmentId) + "/cancel",
        { method: "PATCH", body: { reason } }
      );
    },

    checkIn(appointmentId) {
      return request(
        "appointments/" + encodeURIComponent(appointmentId) + "/check-in",
        { method: "PATCH", body: {} }
      );
    },

    hideAppointment(appointmentId) {
      return request(
        "appointments/" + encodeURIComponent(appointmentId) + "/hide",
        { method: "PATCH", body: {} }
      );
    },

    pay(appointmentId, method) {
      return request(
        "appointments/" + encodeURIComponent(appointmentId) + "/payments",
        { method: "POST", body: { method: method || "CARD" } }
      );
    },

    summary(appointmentId) {
      return request(
        "appointments/" + encodeURIComponent(appointmentId) + "/summary"
      );
    },

    submitReview(appointmentId, rating, comment) {
      return request(
        "appointments/" + encodeURIComponent(appointmentId) + "/review",
        { method: "POST", body: { rating, comment } }
      );
    },

    myReviews() {
      return request("reviews/me");
    },

    doctorReviews(doctorId) {
      const page = arguments[1];
      const size = arguments[2];
      const params = {};
      if (page != null) params.page = page;
      if (size != null) params.size = size;
      return request(
        "doctors/" + encodeURIComponent(doctorId) + "/reviews" + query(params)
      );
    },

    // Patient profile -------------------------------------------------
    myProfile() {
      return request("patients/me");
    },

    updateMyProfile(payload) {
      return request("patients/me", {
        method: "PUT",
        body: payload,
      });
    },

    // Chat -----------------------------------------------------------
    chatHistory(appointmentId) {
      return request(
        "appointments/" +
          encodeURIComponent(appointmentId) +
          "/chat/messages"
      );
    },

    sendChatMessage(appointmentId, content) {
      return request(
        "appointments/" +
          encodeURIComponent(appointmentId) +
          "/chat/messages",
        {
          method: "POST",
          body: { content },
        }
      );
    },

    // Doctor console -------------------------------------------------
    doctorProfile() {
      return request("doctor/profile");
    },

    doctorSessions(date) {
      return request("doctor/sessions" + query({ date }));
    },

    doctorQueue(sessionId) {
      return request(
        "doctor/sessions/" +
          encodeURIComponent(sessionId) +
          "/queue"
      );
    },

    doctorAppointments(filters) {
      return request("doctor/appointments" + query(filters));
    },

    doctorAppointment(appointmentId) {
      return request(
        "doctor/appointments/" + encodeURIComponent(appointmentId)
      );
    },

    doctorActiveAppointments(filters) {
      return request("doctor/appointments/active" + query(filters));
    },

    doctorAppointmentHistory(filters) {
      return request("doctor/appointments/history" + query(filters));
    },

    acceptAppointment(appointmentId) {
      return request(
        "doctor/appointments/" + encodeURIComponent(appointmentId) + "/accept",
        { method: "PATCH", body: {} }
      );
    },

    declineAppointment(appointmentId, reason) {
      return request(
        "doctor/appointments/" + encodeURIComponent(appointmentId) + "/decline",
        { method: "PATCH", body: { reason } }
      );
    },

    markArrived(appointmentId) {
      return request(
        "doctor/appointments/" + encodeURIComponent(appointmentId) + "/arrive",
        { method: "PATCH", body: {} }
      );
    },

    startConsultation(appointmentId) {
      return request(
        "doctor/appointments/" + encodeURIComponent(appointmentId) + "/start",
        { method: "PATCH", body: {} }
      );
    },

    completeConsultation(appointmentId) {
      return request(
        "doctor/appointments/" +
          encodeURIComponent(appointmentId) +
          "/complete",
        { method: "PATCH", body: {} }
      );
    },

    completeAndAdvance(appointmentId) {
      return request(
        "doctor/appointments/" +
          encodeURIComponent(appointmentId) +
          "/complete-and-advance",
        { method: "PATCH", body: {} }
      );
    },

    markNoShow(appointmentId) {
      return request(
        "doctor/appointments/" + encodeURIComponent(appointmentId) + "/no-show",
        { method: "PATCH", body: {} }
      );
    },

    hideDoctorAppointment(appointmentId) {
      return request(
        "doctor/appointments/" + encodeURIComponent(appointmentId) + "/hide",
        { method: "PATCH", body: {} }
      );
    },

    saveSummary(appointmentId, summary, exists) {
      return request(
        "appointments/" + encodeURIComponent(appointmentId) + "/summary",
        {
          method: exists ? "PUT" : "POST",
          body: summary,
        }
      );
    },

    request(path, options) {
      return request(path, options);
    },
  };

  window.MC = api;
})();
