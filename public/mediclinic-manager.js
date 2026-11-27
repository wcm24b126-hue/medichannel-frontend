/* MediChannel manager UI helpers.
 *
 * Small, dependency-free functions shared by the manager dashboard, the
 * notice form and the feedback moderation panel. Keeping this logic in one
 * place makes the backend contract easy to unit test without a DOM.
 */
(function () {
  "use strict";

  // Mirrors com.medichannel.dto.notice.NoticeRequest validation.
  var NOTICE_LIMITS = Object.freeze({ title: 150, body: 4000 });

  // Mirrors ResetStaffPasswordRequest and PasswordPolicy.
  var STAFF_PASSWORD = Object.freeze({ minLength: 8, maxBytes: 72 });

  function toNumber(value) {
    if (typeof value === "number") {
      return isFinite(value) ? value : null;
    }
    if (typeof value === "string" && value.trim() !== "") {
      var parsed = Number(value);
      return isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  function formatCount(value) {
    var number = toNumber(value);
    if (number === null) return "—";
    return number.toLocaleString("en-LK");
  }

  // Sri Lankan rupees. Never renders a missing figure as zero.
  function formatLkr(value) {
    var number = toNumber(value);
    if (number === null) return "—";
    return (
      "LKR " +
      number.toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function validateNoticeInput(title, body) {
    var cleanTitle = String(title == null ? "" : title).trim();
    var cleanBody = String(body == null ? "" : body).trim();

    if (!cleanTitle && !cleanBody) {
      return {
        ok: false,
        message: "Enter a title and notice body before publishing.",
      };
    }
    if (!cleanTitle) {
      return { ok: false, message: "A notice title is required." };
    }
    if (!cleanBody) {
      return { ok: false, message: "A notice body is required." };
    }
    if (cleanTitle.length > NOTICE_LIMITS.title) {
      return {
        ok: false,
        message:
          "The title must not exceed " + NOTICE_LIMITS.title + " characters.",
      };
    }
    if (cleanBody.length > NOTICE_LIMITS.body) {
      return {
        ok: false,
        message:
          "The body must not exceed " + NOTICE_LIMITS.body + " characters.",
      };
    }
    return { ok: true, title: cleanTitle, body: cleanBody };
  }

  // Builds the exact NoticeRequest payload. `published` is required by the
  // backend; without it notices are silently created as drafts.
  function noticePayload(title, body) {
    var validated = validateNoticeInput(title, body);
    if (!validated.ok) return validated;
    return {
      ok: true,
      payload: {
        title: validated.title,
        body: validated.body,
        published: true,
      },
    };
  }

  function staffPasswordPayload(password, confirmation) {
    var value = String(password == null ? "" : password);
    var confirm = String(confirmation == null ? "" : confirmation);

    if (!value) {
      return { ok: false, message: "A new password is required." };
    }
    if (value !== confirm) {
      return { ok: false, message: "The passwords do not match." };
    }
    if (value.length < STAFF_PASSWORD.minLength) {
      return {
        ok: false,
        message:
          "Use at least " + STAFF_PASSWORD.minLength + " characters.",
      };
    }

    var byteLength = value.length;
    if (typeof TextEncoder === "function") {
      byteLength = new TextEncoder().encode(value).length;
    }
    if (byteLength > STAFF_PASSWORD.maxBytes) {
      return {
        ok: false,
        message:
          "The password must not exceed " +
          STAFF_PASSWORD.maxBytes +
          " UTF-8 bytes.",
      };
    }
    if (
      !/[A-Za-z]/.test(value) ||
      !/\d/.test(value) ||
      !/[^A-Za-z0-9]/.test(value)
    ) {
      return {
        ok: false,
        message:
          "Use at least one letter, one number and one symbol.",
      };
    }

    return {
      ok: true,
      payload: { newPassword: value, confirmPassword: confirm },
    };
  }

  function sumField(list, field) {
    if (!Array.isArray(list)) return null;
    if (list.length === 0) return 0;
    var total = 0;
    for (var index = 0; index < list.length; index += 1) {
      var value = toNumber(list[index] ? list[index][field] : null);
      if (value === null) return null;
      total += value;
    }
    return total;
  }

  function countDoctors(list) {
    if (!Array.isArray(list)) return null;
    if (list.length === 0) return 0;
    var names = new Set();
    list.forEach(function (session) {
      var name = session && typeof session.doctorName === "string"
        ? session.doctorName.trim()
        : "";
      if (name) names.add(name);
    });
    // Sessions exist but the backend omitted doctor names: unknown, not zero.
    return names.size === 0 ? null : names.size;
  }

  // Maps ReportOverviewResponse onto the manager dashboard cards.
  // Missing values stay null so the UI can show "—" instead of a fake zero.
  function dashboardMetrics(report) {
    var metrics = {
      sessionsThisWeek: null,
      doctorsToday: null,
      completedToday: null,
      cancelledToday: null,
      appointmentsToday: null,
      physicalAppointments: null,
      onlineAppointments: null,
      revenueLkr: null,
    };

    if (!report || typeof report !== "object") return metrics;

    var sessions = Array.isArray(report.todaySessions)
      ? report.todaySessions
      : null;

    // The brief states more than 120 sessions per week. The backend computes
    // this from the Monday–Sunday Asia/Colombo roster, independently of the
    // today-scoped range used for the other cards.
    metrics.sessionsThisWeek = toNumber(report.sessionsThisWeek);
    metrics.doctorsToday = report.doctorsToday != null
      ? toNumber(report.doctorsToday)
      : countDoctors(sessions);
    metrics.completedToday = report.completedAppointments != null
      ? toNumber(report.completedAppointments)
      : sumField(sessions, "completed");
    metrics.cancelledToday = toNumber(report.cancelledAppointments);
    metrics.appointmentsToday = toNumber(report.totalAppointments);
    metrics.physicalAppointments = toNumber(report.physicalAppointments);
    metrics.onlineAppointments = toNumber(report.onlineAppointments);
    metrics.revenueLkr = toNumber(report.revenueLkr);

    // Authoritative backend aggregates
    metrics.completedAppointments = metrics.completedToday;
    metrics.bookedAppointments = toNumber(report.bookedAppointments);
    metrics.checkedInAppointments = toNumber(report.checkedInAppointments);
    metrics.arrivedAppointments = toNumber(report.arrivedAppointments);
    metrics.inConsultationAppointments = toNumber(report.inConsultationAppointments);
    metrics.noShowAppointments = toNumber(report.noShows);
    metrics.unpaidAppointments = toNumber(report.unpaidAppointments);
    metrics.unpaidAmountLkr = toNumber(report.unpaidAmountLkr);
    metrics.roomsToday = toNumber(report.roomsToday);
    metrics.sessionsToday = toNumber(report.sessionsToday);
    metrics.activeSessionsToday = toNumber(report.activeSessionsToday);
    metrics.completedSessionsToday = toNumber(report.completedSessionsToday);
    metrics.cancelledSessionsToday = toNumber(report.cancelledSessionsToday);
    metrics.totalCapacity = toNumber(report.totalCapacity);
    metrics.bookedCapacity = toNumber(report.bookedCapacity);
    metrics.occupancyRate = toNumber(report.occupancyRate);
    metrics.noShowRate = toNumber(report.noShowRate);

    return metrics;
  }

  function formatTypeSplit(metrics) {
    if (!metrics) return "—";
    var physical = metrics.physicalAppointments;
    var online = metrics.onlineAppointments;
    if (physical === null || online === null) return "—";
    return formatCount(physical) + " / " + formatCount(online);
  }

  // Formats dashboardMetrics() into the exact strings the dashboard cards
  // render. Kept here so "zero" versus "unavailable" stays testable without
  // a DOM.
  function dashboardCardValues(metrics) {
    var values = metrics || {};
    return {
      sessionsThisWeek: formatCount(values.sessionsThisWeek),
      doctorsToday: formatCount(values.doctorsToday),
      completedToday: formatCount(values.completedToday),
      cancelledToday: formatCount(values.cancelledToday),
      appointmentsToday: formatCount(values.appointmentsToday),
      typeSplit: formatTypeSplit(values),
      revenue: formatLkr(values.revenueLkr),
    };
  }

  // Opens/closes the notice form, keeps aria-expanded in sync and moves
  // keyboard focus to the field on open and back to the toggle on close.
  function applyNoticeFormState(state) {
    var form = state && state.form;
    if (!form) return false;

    var open = Boolean(state.open);
    form.hidden = !open;

    if (state.toggle) {
      state.toggle.setAttribute("aria-expanded", String(open));
    }

    if (open) {
      if (
        form.elements &&
        form.elements.title &&
        typeof form.elements.title.focus === "function"
      ) {
        form.elements.title.focus();
      }
    } else if (state.toggle && typeof state.toggle.focus === "function") {
      state.toggle.focus();
    }

    return true;
  }

  // Returns false when the same control is already busy, so double clicks
  // cannot fire two moderation/publish requests.
  function lockAction(button) {
    if (!button) return false;
    if (button.dataset && button.dataset.busy === "true") return false;
    if (button.dataset) button.dataset.busy = "true";
    button.disabled = true;
    return true;
  }

  function unlockAction(button) {
    if (!button) return false;
    if (button.dataset) button.dataset.busy = "false";
    button.disabled = false;
    return true;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var MCManager = {
    NOTICE_LIMITS: NOTICE_LIMITS,
    STAFF_PASSWORD: STAFF_PASSWORD,
    validateNoticeInput: validateNoticeInput,
    noticePayload: noticePayload,
    staffPasswordPayload: staffPasswordPayload,
    dashboardMetrics: dashboardMetrics,
    dashboardCardValues: dashboardCardValues,
    formatCount: formatCount,
    formatLkr: formatLkr,
    formatTypeSplit: formatTypeSplit,
    applyNoticeFormState: applyNoticeFormState,
    lockAction: lockAction,
    unlockAction: unlockAction,
    escapeHtml: escapeHtml,
  };

  if (typeof window !== "undefined") {
    window.MCManager = MCManager;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = MCManager;
  }
})();
