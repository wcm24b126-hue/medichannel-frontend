/* MediChannel browser API client.
 *
 * Every call goes through the same-origin BFF, which attaches the
 * HttpOnly session cookie as a Bearer token. The access token is never
 * visible to this file.
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
    if (body && typeof body.message === "string" && body.message.trim()) {
      return body.message.trim();
    }
    if (status === 401) return "Please sign in again to continue.";
    if (status === 403) return "You do not have access to this item.";
    if (status === 404) return "That record could not be found.";
    if (status === 409) return "That action conflicts with the current state.";
    if (status === 422) return "Some of the details provided are not valid.";
    if (status === 429) return "Too many requests. Please wait a moment.";
    if (status >= 500) {
      return "The hospital service is unavailable right now. Please try again.";
    }
    return fallback || "The request could not be completed.";
  }

  async function request(path, options) {
    const settings = Object.assign(
      { method: "GET", credentials: "same-origin", cache: "no-store" },
      options || {}
    );

    const headers = new Headers(settings.headers || {});

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

    let response;

    try {
      response = await fetch(
        "/api/backend/" + String(path).replace(/^\/+/, ""),
        settings
      );
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

    const text = await response.text();
    let body = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!response.ok) {
      throw new MediChannelError(
        friendlyMessage(response.status, body),
        response.status,
        body
      );
    }

    return body;
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
    async me() {
      // The session route lives outside the BFF prefix.
      const response = await fetch("/api/auth/me", {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (response.status === 401) return null;

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new MediChannelError(
          friendlyMessage(response.status, body),
          response.status,
          body
        );
      }

      return body;
    },

    wsTicket() {
      return request("auth/ws-ticket", { method: "POST" });
    },

    // Discovery ------------------------------------------------------
    doctors(filters) {
      return request("doctors" + query(filters));
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

    cancelSession(sessionId) {
      return request("sessions/" + encodeURIComponent(sessionId) + "/cancel", {
        method: "PATCH",
        body: {},
      });
    },

    delaySession(sessionId, minutes) {
      return request("sessions/" + encodeURIComponent(sessionId) + "/delay", {
        method: "PATCH",
        body: { delayMinutes: Number(minutes) || 15 },
      });
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

    adminUsers(params) {
      return request("admin/users" + query(params));
    },

    adminStats() {
      return request("admin/stats");
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

    bookAppointment(sessionId, reason) {
      return request("appointments", {
        method: "POST",
        body: { sessionId, reason },
      });
    },

    cancelAppointment(appointmentId) {
      return request(
        "appointments/" + encodeURIComponent(appointmentId) + "/cancel",
        { method: "PATCH", body: {} }
      );
    },

    checkIn(appointmentId) {
      return request(
        "appointments/" + encodeURIComponent(appointmentId) + "/check-in",
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

    // Chat -----------------------------------------------------------
    chatHistory(appointmentId) {
      return request(
        "appointments/" +
          encodeURIComponent(appointmentId) +
          "/chat/messages"
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
