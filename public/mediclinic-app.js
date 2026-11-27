/* MediChannel single-page application.
 *
 * The UI is a static HTML document; this file owns routing, data loading
 * and every dynamic DOM update. All remote data is rendered with
 * createElement/textContent so that a malicious value can never become
 * markup.
 */
(function () {
  "use strict";

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  const $ = (id) => document.getElementById(id);

  const fetchWithTimeout = (url, options, timeoutMs = 25_000) => {
    const settings = Object.assign({}, options || {});
    if (
      !settings.signal &&
      typeof AbortSignal !== "undefined" &&
      typeof AbortSignal.timeout === "function"
    ) {
      settings.signal = AbortSignal.timeout(timeoutMs);
    }
    return fetch(url, settings);
  };

  // A signed-in session lives only in this tab's sessionStorage. Cookies and
  // URLs are deliberately never used to restore it: pasting the address into
  // another tab/window (including a private one) must start anonymous.
  const views = Array.from(document.querySelectorAll("[data-view]"));
  const PRIVATE_VIEWS = [
    "login",
    "register",
    "appointments",
    "profile",
    "doctor",
    "manager",
    "admin",
    "consult",
  ];
  const TZ = "Asia/Colombo";
  const CLINIC_UTC_OFFSET = "+05:30";
  // The two published consultation windows shared with the guest doctor
  // directory and the backend booking rules. Only sessions using one of these
  // exact windows, five-minute slots and at most 30 places are displayed.
  const CLINIC_START = "07:00";
  const CLINIC_END = "16:00";
  const CLINIC_HOURS = 8;
  const MORNING_START = "07:00";
  const MORNING_END = "11:00";
  const EVENING_START = "13:00";
  const EVENING_END = "15:00";
  const SLOT_MINUTES = 5;
  const MAX_PATIENTS_PER_SESSION = 30;
  const MAX_PATIENTS_PER_DAY = 60;
  const PHYSICAL_BOOKING_CLOSE_MINUTES = 60;
  const ONLINE_BOOKING_CLOSE_MINUTES = 30;
  const CLINIC_WINDOWS = [
    { start: MORNING_START, end: MORNING_END, label: "Morning" },
    { start: EVENING_START, end: EVENING_END, label: "Evening" },
  ];
  const CLINIC_WINDOW_LABEL =
    MORNING_START + "–" + MORNING_END + " or " +
    EVENING_START + "–" + EVENING_END;
  const BREAK_START = MORNING_END;
  const BREAK_END = EVENING_START;
  const CLINIC_HOURS_LABEL =
    CLINIC_WINDOW_LABEL + " · " + SLOT_MINUTES + " min per patient";
  const ManagerUI = window.MCManager;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );
  const motionStyle = document.createElement("style");
  motionStyle.textContent = `
    .mc-motion-button:not(:disabled) {
      transition: transform 180ms cubic-bezier(.22,1,.36,1), box-shadow 180ms ease,
        background-color 180ms ease, border-color 180ms ease, color 180ms ease;
    }
    .mc-motion-cta {
      transition: transform 180ms cubic-bezier(.22,1,.36,1), box-shadow 180ms ease,
        filter 180ms ease, background-color 180ms ease;
    }
    .mc-motion-cta > span[aria-hidden="true"] {
      display: inline-block;
      transition: transform 180ms cubic-bezier(.22,1,.36,1);
    }
    .mc-motion-link {
      transition: color 160ms ease, opacity 160ms ease;
    }
    .mc-motion-control {
      transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
    }
    .mc-motion-card {
      transition: transform 280ms cubic-bezier(.22,1,.36,1), box-shadow 280ms ease,
        border-color 280ms ease;
    }
    .mc-motion-status {
      transition: background-color 220ms ease, border-color 220ms ease, color 220ms ease;
    }

    /* Hero Image Interactive Depth */
    .mc-motion-hero-image {
      transition: transform 380ms cubic-bezier(.22,1,.36,1),
        box-shadow 380ms cubic-bezier(.22,1,.36,1),
        border-color 380ms ease;
      will-change: transform, box-shadow;
    }
    @media (hover: hover) and (pointer: fine) {
      .mc-motion-hero-image:hover {
        transform: scale(1.012);
        box-shadow: 0 20px 48px -10px rgba(27,58,75,.16),
          0 0 0 1px rgba(43,122,158,.28),
          0 0 24px rgba(43,122,158,.12);
      }
    }

    /* Connected Patient Journey Background Network */
    .mc-journey-network {
      transition: opacity 800ms ease;
    }
    .mc-journey-highway {
      transition: stroke-dashoffset 850ms cubic-bezier(.22,1,.36,1), opacity 600ms ease;
    }
    .mc-journey-node {
      transition: transform 420ms cubic-bezier(.22,1,.36,1), opacity 420ms ease;
    }
    .mc-node-halo {
      transition: transform 500ms ease, opacity 500ms ease;
    }
    .mc-node-halo-accent {
      transition: transform 500ms ease, opacity 500ms ease;
    }

    /* Signature CTA & Journey Lead Track */
    .mc-cta-wrapper {
      position: relative;
    }
    .mc-cta-track {
      transition: opacity 220ms ease, transform 220ms cubic-bezier(.22,1,.36,1);
      opacity: 0.55;
    }
    .mc-cta-track-line {
      transition: stroke 220ms ease, stroke-opacity 220ms ease;
    }
    .mc-cta-travel-pulse {
      opacity: 0;
      transition: cx 320ms cubic-bezier(.22,1,.36,1), opacity 220ms ease;
    }
    .mc-cta-primary {
      transition: transform 180ms cubic-bezier(.22,1,.36,1),
        box-shadow 180ms ease,
        filter 180ms ease,
        background-color 180ms ease;
    }
    .mc-cta-primary > span[aria-hidden="true"] {
      display: inline-block;
      transition: transform 180ms cubic-bezier(.22,1,.36,1);
    }
    @media (hover: hover) and (pointer: fine) {
      .mc-motion-button:not(:disabled):hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(26,77,102,.12);
      }
      .mc-motion-cta:hover {
        transform: translateY(-2px);
        filter: brightness(1.02);
      }
      .mc-motion-cta:not(.bg-peach):hover {
        transform: translateY(-1px);
        box-shadow: 0 5px 14px rgba(26,77,102,.12);
      }
      .mc-motion-cta:hover > span[aria-hidden="true"] {
        transform: translateX(3px);
      }
      .mc-motion-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 12px 28px rgba(27,58,75,.12);
        border-color: rgba(43,122,158,.38);
      }
      .mc-cta-wrapper:hover .mc-cta-track,
      .mc-cta-wrapper:focus-within .mc-cta-track {
        opacity: 1;
        transform: translateX(2px);
      }
      .mc-cta-wrapper:hover .mc-cta-track-line,
      .mc-cta-wrapper:focus-within .mc-cta-track-line {
        stroke: rgba(232,115,74,.6);
      }
      .mc-cta-wrapper:hover .mc-cta-travel-pulse,
      .mc-cta-wrapper:focus-within .mc-cta-travel-pulse {
        opacity: 0.95;
        cx: 68px;
      }
      .mc-cta-primary:hover {
        transform: translateY(-2px);
        filter: brightness(1.03);
        box-shadow: 0 14px 30px rgba(232,115,74,.48);
      }
      .mc-cta-primary:hover > span[aria-hidden="true"] {
        transform: translateX(4px);
      }
    }
    .mc-motion-button:not(:disabled):active,
    .mc-motion-cta:active {
      transform: translateY(0) scale(.985);
      filter: brightness(.99);
    }
    .mc-cta-primary:active {
      transform: translateY(0) scale(.985);
      filter: brightness(.98);
      box-shadow: 0 6px 16px rgba(232,115,74,.35);
    }
    .mc-cta-wrapper:active .mc-cta-travel-pulse {
      cx: 72px;
      opacity: 1;
    }
    .mc-motion-link:active {
      opacity: .84;
    }

    /* "How It Works" Journey Cards & Connectors */
    .wcards {
      position: relative;
    }
    .mc-step-card {
      position: relative;
      transition: transform 280ms cubic-bezier(.22,1,.36,1),
        box-shadow 280ms ease,
        border-color 280ms ease;
    }
    @media (hover: hover) and (pointer: fine) {
      .mc-step-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 14px 32px rgba(27,58,75,.12);
        border-color: rgba(43,122,158,.35);
      }
    }
    .mc-step-badge {
      transition: transform 260ms cubic-bezier(.22,1,.36,1),
        box-shadow 260ms ease,
        background-color 260ms ease;
    }
    @media (min-width: 768px) {
      .mc-step-card:not(:last-child)::after {
        content: "";
        position: absolute;
        top: 50px;
        right: -13px;
        width: 22px;
        height: 2px;
        background: linear-gradient(90deg, #2B7A9E, rgba(232,115,74,.7));
        opacity: 0.28;
        z-index: 5;
        pointer-events: none;
        transition: opacity 300ms ease, transform 300ms ease;
      }
      .mc-step-card.mc-step-active:not(:last-child)::after {
        opacity: 0.85;
        transform: scaleX(1.05);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .mc-motion-button,
      .mc-motion-cta,
      .mc-motion-link,
      .mc-motion-control,
      .mc-motion-card,
      .mc-motion-hero-image,
      .mc-motion-status,
      .mc-journey-network,
      .mc-journey-highway,
      .mc-journey-node,
      .mc-node-halo,
      .mc-node-halo-accent,
      .mc-cta-track,
      .mc-cta-track-line,
      .mc-cta-travel-pulse,
      .mc-cta-primary,
      .mc-cta-primary > span[aria-hidden="true"],
      .mc-step-card,
      .mc-step-badge,
      .mc-step-card::after {
        transition: none !important;
        animation: none !important;
        transform: none !important;
      }
      .mc-journey-highway {
        stroke-dashoffset: 0 !important;
      }
      .mc-cta-track {
        opacity: 0.5 !important;
      }
      .mc-cta-travel-pulse {
        display: none !important;
      }
      .mc-step-card:not(:last-child)::after {
        opacity: 0.4 !important;
        transform: none !important;
      }
      .mc-motion-button:not(:disabled):hover,
      .mc-motion-button:not(:disabled):active,
      .mc-motion-cta:hover,
      .mc-motion-cta:active,
      .mc-motion-card:hover,
      .mc-motion-hero-image:hover,
      [data-view="welcome"] .wcards > div:hover {
        transform: none !important;
        filter: none !important;
        box-shadow: none !important;
      }
      .app-boot-spinner {
        animation: none !important;
      }
    }
  `;
  document.head.appendChild(motionStyle);

  const activeMotionByElement = new WeakMap();
  const activeMotionAnimations = new Set();
  const pendingScrollReveals = new Set();
  let scrollRevealObserver = null;

  function playMotion(element, keyframes, settings) {
    if (
      !element ||
      prefersReducedMotion.matches ||
      typeof element.animate !== "function"
    ) {
      return null;
    }

    const previous = activeMotionByElement.get(element);
    if (previous) previous.cancel();

    const options = settings || {};
    const animation = element.animate(keyframes, {
      duration: options.duration || 300,
      delay: options.delay || 0,
      easing: options.easing || "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: options.fill || "none",
    });

    activeMotionByElement.set(element, animation);
    activeMotionAnimations.add(animation);

    const forget = () => {
      if (activeMotionByElement.get(element) === animation) {
        activeMotionByElement.delete(element);
      }
      activeMotionAnimations.delete(animation);
    };
    animation.addEventListener("finish", forget, { once: true });
    animation.addEventListener("cancel", forget, { once: true });
    return animation;
  }

  function animateEntry(element, delay, duration) {
    return playMotion(
      element,
      [
        { opacity: 0, transform: "translateY(10px) scale(.995)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: duration || 420, delay: delay || 0 }
    );
  }

  function animateStateChange(element) {
    return playMotion(
      element,
      [
        { opacity: 0.72, transform: "translateY(3px) scale(.99)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: 260 }
    );
  }

  function setMotionText(element, value) {
    if (!element) return;
    const next = String(value);
    if (element.textContent === next) return;
    element.textContent = next;
    animateStateChange(element);
  }

  function enhanceMotionTree(root) {
    if (!root || root.nodeType !== 1) return;
    const nodes = [root, ...root.querySelectorAll(
      "button, a[href], input, select, textarea, article"
    )];

    nodes.forEach((node) => {
      if (node.matches("button")) node.classList.add("mc-motion-button");
      if (node.matches("a.cta")) node.classList.add("mc-motion-cta");
      else if (node.matches("a[href]")) node.classList.add("mc-motion-link");
      if (node.matches("input, select, textarea")) {
        node.classList.add("mc-motion-control");
      }
      if (
        node.matches("article") &&
        node.querySelector("button:not(:disabled), a[href]")
      ) {
        node.classList.add("mc-motion-card");
      }
    });
  }

  function clearPendingScrollReveal(element) {
    element.style.opacity = "";
    element.style.transform = "";
    pendingScrollReveals.delete(element);
    if (scrollRevealObserver) scrollRevealObserver.unobserve(element);
  }

  function setupPublicScrollReveals() {
    const welcome = document.querySelector('[data-view="welcome"]');
    if (
      !welcome ||
      prefersReducedMotion.matches ||
      typeof IntersectionObserver === "undefined" ||
      typeof Element.prototype.animate !== "function"
    ) {
      return;
    }

    const cards = Array.from(welcome.querySelectorAll(".wcards > div"));
    if (!cards.length) return;

    scrollRevealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target;
          scrollRevealObserver.unobserve(element);
          const index = cards.indexOf(element);

          const animation = playMotion(
            element,
            [
              { opacity: 0, transform: "translateY(16px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            { duration: 420, delay: Math.max(0, index) * 160, fill: "both" }
          );

          // Step badge subtle micro-pulse
          const badge = element.querySelector(".mc-step-badge");
          if (badge) {
            playMotion(
              badge,
              [
                { transform: "scale(0.92)", opacity: 0.8 },
                { transform: "scale(1.08)", opacity: 1 },
                { transform: "scale(1)", opacity: 1 },
              ],
              { duration: 320, delay: Math.max(0, index) * 160 + 100 }
            );
          }

          // Sequential progression: illuminate connector
          setTimeout(() => {
            element.classList.add("mc-step-active");
          }, Math.max(0, index) * 160 + 80);

          if (!animation) {
            clearPendingScrollReveal(element);
            return;
          }
          const clear = () => {
            clearPendingScrollReveal(element);
            if (animation.playState !== "idle") animation.cancel();
          };
          animation.addEventListener("finish", clear, { once: true });
          animation.addEventListener("cancel", clear, { once: true });
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );

    cards.forEach((card) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(16px)";
      pendingScrollReveals.add(card);
      scrollRevealObserver.observe(card);
    });
  }

  function handleReducedMotionChange() {
    if (!prefersReducedMotion.matches) return;
    activeMotionAnimations.forEach((animation) => animation.cancel());
    Array.from(pendingScrollReveals).forEach(clearPendingScrollReveal);
  }

  if (prefersReducedMotion.addEventListener) {
    prefersReducedMotion.addEventListener("change", handleReducedMotionChange);
  } else if (prefersReducedMotion.addListener) {
    prefersReducedMotion.addListener(handleReducedMotionChange);
  }

  // Hidden views are display:none on first paint; enhance only the visible
  // welcome view now and enhance each other view as it is shown.
  const enhancedViews = new WeakSet();
  const initialView = document.querySelector('[data-view="welcome"]');
  if (initialView) enhancedViews.add(initialView);
  enhanceMotionTree(initialView || document.body);
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(enhanceMotionTree);
    });
  }).observe(document.body, { childList: true, subtree: true });

  const RB = {
    CUSTOMER: [
      "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-sky-50 text-blue-700 border-sky-200",
      "Customer",
    ],
    DOCTOR: [
      "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-teal-50 text-teal-900 border-teal-200",
      "Doctor",
    ],
    MANAGER: [
      "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-yellow-100 text-yellow-900 border-yellow-200",
      "Manager",
    ],
    ADMIN: [
      "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-red-100 text-red-900 border-red-200",
      "Admin",
    ],
  };

  const HOME = {
    CUSTOMER: "index",
    DOCTOR: "doctor",
    MANAGER: "manager-d",
    ADMIN: "admin",
  };

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const ACL = {
    appointments: ["CUSTOMER"],
    profile: ["CUSTOMER"],
    consult: ["CUSTOMER", "DOCTOR"],
    doctor: ["DOCTOR"],
    manager: ["MANAGER"],
    admin: ["ADMIN"],
  };

  const AUTH = ["login", "register"];

  const APPT_STATUS = {
    BOOKED: ["Booked", "blue"],
    CHECKED_IN: ["Checked in", "green"],
    ARRIVED: ["Arrived", "green"],
    IN_CONSULTATION: ["In consultation", "sky"],
    COMPLETED: ["Completed", "green"],
    CANCELLED: ["Cancelled", "red"],
    NO_SHOW: ["No-show", "red"],
  };

  const SESSION_STATUS = {
    SCHEDULED: ["Scheduled", "slate"],
    OPEN: ["Open", "blue"],
    IN_PROGRESS: ["In progress", "green"],
    COMPLETED: ["Completed", "green"],
    CANCELLED: ["Cancelled", "red"],
  };

  const TONE = {
    blue: "bg-sky-50 text-blue-700 border-sky-200",
    sky: "bg-sky-50 text-blue-700 border-sky-200",
    green: "bg-green-50 text-green-800 border-green-200",
    red: "bg-red-100 text-red-900 border-red-200",
    orange: "bg-orange-50 text-orange-800 border-orange-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const MAX_CHAT_LENGTH = 1000;
  const MAX_REASON_LENGTH = 500;
  const INTENT_KEY = "mc-booking-intent";

  let S = null;
  let flash = "";
  let wakePromise = null;
  let bootTimer = null;
  let activeView = null;
  let routeAnnounced = false;

  const state = {
    notifications: [],
    notificationsLoaded: false,
    shownToastIds: new Set(),
    syncedSummaryNotifications: new Set(),
    syncedReviewNotifications: new Set(),
    notificationTimer: null,
    specialisationsLoaded: false,
    sessionsLoaded: false,
    sessionsLoading: false,
    sessions: [],
    sessionQueues: {},
    sessionWeeks: [],
    sessionQueuePoll: null,
    directory: {
      items: [],
      loaded: false,
      loading: false,
      poll: null,
      filters: {
        q: "",
        specialisationId: "",
        availability: "",
        consultationType: "",
      },
    },
    selectedSession: null,
    bookingDate: "",
    booking: null,
    appointments: [],
    appointmentsLoaded: false,
    profile: null,
    myReviews: [],
    submittedFeedbackIds: new Set(),
    pendingIntent: null,
    publicNoticesLoaded: false,
    publicNotices: [],
    managerNotices: [],
    doctor: {
      sessions: [],
      sessionsLoaded: false,
      sessionId: null,
      queue: null,
      selected: null,
      summary: null,
      profile: null,
      identityLoading: false,
      queueTimer: null,
    },
    consult: {
      appointmentId: null,
      requestedId: null,
      appointment: null,
      summary: null,
      typingTimer: null,
      typingSentAt: 0,
      typingStopTimer: null,
      remoteTypingTimer: null,
      chatSub: null,
      typingSub: null,
      statusSub: null,
      statusPoll: null,
      chatPoll: null,
    },
    queueSub: null,
    sessionsSub: null,
    manager: {
      reception: [],
      receptionLoaded: false,
    },
  };

  // ---------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------

  // Intl.DateTimeFormat construction is expensive; each formatter is created
  // once and reused for every row rendered by the public and staff views.
  const isoDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
  const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TZ,
  });
  const noticeDateFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TZ,
  });
  const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  });
  const clinicClockFormatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });

  function todayISO() {
    return isoDayFormatter.format(new Date());
  }

  function doctorSessionBookedCount(session) {
    if (!session) return 0;
    const max = Number(session.maxAppointments);
    const remaining = Number(session.remainingAppointments);
    if (!Number.isFinite(max) || !Number.isFinite(remaining)) return 0;
    return Math.max(0, max - remaining);
  }

  function doctorSessionHasBookings(session) {
    return (
      Boolean(session) &&
      session.status !== "CANCELLED" &&
      doctorSessionBookedCount(session) > 0
    );
  }

  function sortDoctorSessions(sessions, today) {
    return (Array.isArray(sessions) ? sessions : [])
      .filter((session) => session && session.sessionId)
      .sort((a, b) => {
        const aDate = a.sessionDate || "";
        const bDate = b.sessionDate || "";
        const aUpcoming = aDate >= today;
        const bUpcoming = bDate >= today;
        if (aUpcoming && !bUpcoming) return -1;
        if (!aUpcoming && bUpcoming) return 1;
        if (aUpcoming && bUpcoming) {
          if (aDate !== bDate) return aDate.localeCompare(bDate);
          return (a.startTime || "").localeCompare(b.startTime || "");
        }
        if (aDate !== bDate) return bDate.localeCompare(aDate);
        return (b.startTime || "").localeCompare(a.startTime || "");
      });
  }

  function chooseDefaultDoctorSession(sessions, today, selectedId) {
    const sorted = sortDoctorSessions(sessions, today);
    const current = selectedId
      ? sorted.find((session) => session.sessionId === selectedId)
      : null;
    if (current && doctorSessionHasBookings(current)) return current;
    const bookable = sorted.filter(doctorSessionHasBookings);
    const todayWithBookings = bookable.find(
      (session) => session.sessionDate === today
    );
    if (todayWithBookings) return todayWithBookings;
    const upcomingWithBookings = bookable.find(
      (session) => session.sessionDate >= today
    );
    if (upcomingWithBookings) return upcomingWithBookings;
    if (current) return current;
    const todaySession = sorted.find((session) => session.sessionDate === today);
    if (todaySession) return todaySession;
    const upcoming = sorted.find(
      (session) => session.sessionDate >= today && session.status !== "CANCELLED"
    );
    if (upcoming) return upcoming;
    return sorted[0] || null;
  }

  function isClinicBreakNow() {
    const clock = clinicClockFormatter.format(new Date());
    return clock >= BREAK_START && clock < BREAK_END;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(String(value) + "T00:00:00");
    if (Number.isNaN(date.getTime())) return String(value);
    return shortDateFormatter.format(date);
  }

  /**
   * Human label for one of the two published session windows.
   */
  function periodLabel(value) {
    if (!value) return "";
    const start = String(value).slice(0, 5);
    const match = CLINIC_WINDOWS.find((window) => window.start === start);
    return match
      ? match.label + " " + match.start + "–" + match.end
      : start;
  }

  function sessionWindow(session) {
    if (!session) return null;
    const start = String(session.startTime || "").slice(0, 5);
    const end = String(session.endTime || "").slice(0, 5);
    return CLINIC_WINDOWS.find(
      (window) => window.start === start && window.end === end
    ) || null;
  }

  function sessionWindowLabel(session) {
    const window = sessionWindow(session);
    if (!window) return CLINIC_WINDOW_LABEL;
    const minutes = Number(session.minutesPerPatient) || SLOT_MINUTES;
    return window.label + " " + window.start + "–" + window.end +
      " · " + minutes + " min per patient";
  }

  function sessionCapacityLabel(session) {
    const capacity = Number(session && session.maxAppointments) || MAX_PATIENTS_PER_SESSION;
    return "Up to " + capacity + " patients · " + MAX_PATIENTS_PER_DAY +
      " per day across both sessions";
  }

  function windowEndForStart(start) {
    const match = CLINIC_WINDOWS.find(
      (window) => window.start === String(start).slice(0, 5)
    );
    return match ? match.end : "";
  }

  function sessionPeriodValue(session) {
    const window = sessionWindow(session);
    return window ? (window.label === "Morning" ? "MORNING" : "EVENING") : "";
  }

  function formatTime(value) {
    if (!value) return "—";
    return String(value).slice(0, 5);
  }

  // ---------------------------------------------------------------
  // Week-based session discovery
  // ---------------------------------------------------------------

  const MAX_SESSION_RANGE_WEEKS = 26; // six months, one week at a time

  function parseISODate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addISODays(value, days) {
    const date = parseISODate(value);
    if (!date) return value;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function sessionRangeOptions() {
    const milestones = {
      1: "Next week",
      2: "Next two weeks",
      3: "Next three weeks",
      4: "Next month (4 weeks)",
      8: "Next two months",
      12: "Next three months",
      16: "Next four months",
      20: "Next five months",
      26: "Next six months",
    };
    return Array.from({ length: MAX_SESSION_RANGE_WEEKS }, (_, index) => {
      const weeks = index + 1;
      return {
        weeks,
        label: milestones[weeks] || "Next " + weeks + " weeks",
      };
    });
  }

  function sessionSearchRange(startDate, rangeValue) {
    const start = parseISODate(startDate) ? startDate : todayISO();
    const parsed = Number.parseInt(rangeValue, 10);
    const weeks = Number.isFinite(parsed)
      ? Math.min(MAX_SESSION_RANGE_WEEKS, Math.max(1, parsed))
      : 1;
    return {
      from: start,
      to: addISODays(start, weeks * 7 - 1),
      weeks,
    };
  }

  // A "week" is the seven days starting on the chosen date, so 11/24/2026
  // covers 11/24–11/30 and 12/1/2026 covers 12/1–12/7.
  function sessionWeekChunks(startDate, weeks) {
    const chunks = [];
    for (let index = 0; index < weeks; index += 1) {
      const from = addISODays(startDate, index * 7);
      const to = addISODays(from, 6);
      chunks.push({
        index: index + 1,
        from,
        to,
        label:
          "Week " +
          (index + 1) +
          " · " +
          formatDate(from) +
          " – " +
          formatDate(to),
      });
    }
    return chunks;
  }

  function populateSessionRangeSelects() {
    ["index-range", "manager-session-range"].forEach((id) => {
      const select = $(id);
      if (!select || select.dataset.rangeReady === "true") return;
      select.replaceChildren();
      sessionRangeOptions().forEach((option) => {
        const node = el("option", "", option.label);
        node.value = String(option.weeks);
        select.append(node);
      });
      select.value = "1";
      select.dataset.rangeReady = "true";
    });
  }

  /**
   * Calendar date (YYYY-MM-DD) for timestamps and date-only values alike.
   * `formatDate` only accepts date-only strings, so full ISO timestamps must
   * not be passed to it.
   */
  function formatNoticeDate(value) {
    if (!value) return "";
    const text = String(value);
    const date = new Date(text.length === 10 ? text + "T00:00:00" : text);
    if (Number.isNaN(date.getTime())) return text.slice(0, 10);
    return noticeDateFormatter.format(date);
  }

  function formatDateTime(value) {
    if (!value) return "—";
    if (typeof value === "string" && value.length >= 16) {
      return (
        formatDate(value.slice(0, 10)) + " " + value.slice(11, 16)
      );
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return dateTimeFormatter.format(date);
  }

  /**
   * The patient's allocated five-minute slot, derived from the server's live
   * estimated start time so delays and cancellations are reflected here too.
   */
  function appointmentSlot(value) {
    const start = value && value.estimatedConsultationTime;
    const minutes = Number(value && value.minutesPerPatient) || SLOT_MINUTES;
    if (!start) return { range: "—", finish: "—", minutes };

    const match = String(start).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (!match) return { range: formatTime(start), finish: "—", minutes };

    const clock = new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5])
      )
    );
    const finishHour = String(clock.getUTCHours()).padStart(2, "0");
    const finishMinute = String(clock.getUTCMinutes()).padStart(2, "0");
    clock.setUTCMinutes(clock.getUTCMinutes() + minutes);
    const end =
      String(clock.getUTCHours()).padStart(2, "0") +
      ":" +
      String(clock.getUTCMinutes()).padStart(2, "0");

    return {
      range: finishHour + ":" + finishMinute + "–" + end,
      finish: end,
      minutes,
    };
  }

  /**
   * Instants such as bookedAt must be converted into the clinic timezone;
   * LocalDateTime values must not, because they are already wall-clock time.
   */
  function formatInstant(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return dateTimeFormatter.format(date);
  }

  function money(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";
    return "LKR " + amount.toLocaleString("en-LK", {
      maximumFractionDigits: 2,
    });
  }

  function referenceOf(value) {
    if (!value) return "—";
    return String(value).replace(/-/g, "").slice(0, 10).toUpperCase();
  }

  function titleCase(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  /** Build a single, role-correct display name from any doctor-shaped record. */
  function doctorDisplayName(doctor) {
    const first = String(doctor && doctor.firstName ? doctor.firstName : "").trim();
    const last = String(doctor && doctor.lastName ? doctor.lastName : "").trim();
    const direct = String(
      doctor && doctor.doctorName ? doctor.doctorName : ""
    ).trim();
    const name = direct || [first, last].filter(Boolean).join(" ");
    if (!name) return "";
    return /^dr\.?\s/i.test(name) ? name : "Dr. " + name;
  }

  function doctorName(session) {
    return doctorDisplayName(session) || "Doctor";
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function badge(label, tone) {
    return el(
      "span",
      "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap " +
        (TONE[tone] || TONE.slate),
      label
    );
  }

  function appointmentBadge(status) {
    const entry = APPT_STATUS[status] || [titleCase(status) || "Unknown", "slate"];
    return badge(entry[0], entry[1]);
  }

  function setStatus(node, message, isError) {
    if (!node) return;
    const next = message || "";
    const changed = node.textContent !== next;
    node.textContent = next;
    node.hidden = !message;
    node.classList.toggle("text-bad", Boolean(isError));
    node.classList.toggle("text-slate2", !isError);
    if (changed && message) animateStateChange(node);
  }

  // ---------------------------------------------------------------
  // Searchable dropdowns
  //
  // Any select with more than ten options opens a search panel anchored
  // to the select. The original select stays in the DOM so existing form
  // validation, reset and change handlers keep working unchanged.
  // ---------------------------------------------------------------

  const SEARCHABLE_SELECT_MIN_OPTIONS = 10;
  const SEARCHABLE_SELECT_MAX_SHOWN = 200;
  let searchSelectPanel = null;
  let searchableSelect = null;
  let searchableIndex = -1;
  let suppressScrollCloseUntil = 0;

  function isSearchableSelect(select) {
    return Boolean(
      select &&
        select.tagName === "SELECT" &&
        !select.disabled &&
        !select.multiple &&
        !select.hasAttribute("data-no-search") &&
        select.options.length > SEARCHABLE_SELECT_MIN_OPTIONS
    );
  }

  function buildSearchSelectPanel() {
    if (searchSelectPanel) return searchSelectPanel;

    const panel = el("div", "mc-search-select");
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Search dropdown options");

    const head = el("div", "mc-search-select-head");
    const input = el("input");
    input.type = "search";
    input.autocomplete = "off";
    input.placeholder = "Search options…";
    input.setAttribute("aria-label", "Search options");
    const close = el("button", "", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close options");
    head.append(input, close);

    const list = el("div", "mc-search-select-options");
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Dropdown options");
    list.addEventListener("click", (event) => {
      const option = event.target.closest("button[data-search-value]");
      if (option) chooseSearchableOption(option.dataset.searchValue);
    });
    input.addEventListener("input", renderSearchableOptions);
    close.addEventListener("click", () => {
      const previous = searchableSelect;
      closeSearchSelect();
      if (previous) previous.focus();
    });
    panel.append(head, list);
    document.body.append(panel);

    searchSelectPanel = { panel, input, close, list };
    return searchSelectPanel;
  }

  function positionSearchSelectPanel(select, panel) {
    const rect = select.getBoundingClientRect();
    const width = Math.max(rect.width, 224);
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - width - 8)
    );
    const below = window.innerHeight - rect.bottom;
    const height = Math.max(180, Math.min(360, below - 12));
    const top =
      below > height + 12 ? rect.bottom + 4 : Math.max(8, rect.top - height - 4);

    panel.style.width = Math.round(width) + "px";
    panel.style.left = Math.round(left) + "px";
    panel.style.top = Math.round(top) + "px";
    panel.style.maxHeight = Math.round(height) + "px";
  }

  function closeSearchSelect() {
    if (!searchableSelect) return;
    searchableSelect.removeAttribute("aria-expanded");
    searchableSelect = null;
    searchableIndex = -1;
    if (searchSelectPanel) searchSelectPanel.panel.hidden = true;
  }

  function setSearchableActive(index) {
    if (!searchSelectPanel) return;
    const options = Array.from(
      searchSelectPanel.list.querySelectorAll("button[data-search-value]")
    );
    if (!options.length) return;
    searchableIndex = Math.max(0, Math.min(index, options.length - 1));
    options.forEach((node, i) => {
      node.dataset.active = i === searchableIndex ? "true" : "false";
    });
    options[searchableIndex].scrollIntoView({ block: "nearest" });
  }

  function renderSearchableOptions() {
    if (!searchableSelect || !searchSelectPanel) return;
    const { input, list } = searchSelectPanel;
    const term = input.value.trim().toLowerCase();
    const current = searchableSelect.value;
    const all = Array.from(searchableSelect.options);
    const matches = all.filter((option) => {
      if (!term) return true;
      return (
        option.textContent.toLowerCase().includes(term) ||
        option.value.toLowerCase().includes(term)
      );
    });
    const shown = matches.slice(0, SEARCHABLE_SELECT_MAX_SHOWN);

    list.replaceChildren();
    if (!shown.length) {
      list.append(
        el("p", "mc-search-select-empty", "No options match your search.")
      );
      searchableIndex = -1;
      return;
    }

    shown.forEach((option) => {
      const node = el(
        "button",
        "mc-search-select-option",
        option.textContent || option.value || "(no label)"
      );
      node.type = "button";
      node.setAttribute("role", "option");
      node.setAttribute("aria-selected", option.value === current ? "true" : "false");
      node.dataset.searchValue = option.value;
      node.dataset.active = "false";
      list.append(node);
    });

    if (matches.length > shown.length) {
      list.append(
        el(
          "p",
          "mc-search-select-empty",
          "Showing the first " +
            shown.length +
            " of " +
            matches.length +
            " options. Keep typing to narrow the list."
        )
      );
    }
    setSearchableActive(0);
  }

  function openSearchSelect(select) {
    if (!isSearchableSelect(select)) return;
    if (searchableSelect === select) return;
    closeSearchSelect();

    const ui = buildSearchSelectPanel();
    // A dialog is in the browser's top layer: the panel must live inside it,
    // otherwise the dialog backdrop would cover the search options.
    const host = select.closest("dialog") || document.body;
    if (ui.panel.parentElement !== host) host.append(ui.panel);
    searchableSelect = select;
    select.setAttribute("aria-expanded", "true");
    ui.input.value = "";
    positionSearchSelectPanel(select, ui.panel);
    ui.panel.hidden = false;
    renderSearchableOptions();
    // Focusing the search field can scroll it into view; do not treat that
    // programmatic scroll as a user dismissal.
    suppressScrollCloseUntil = Date.now() + 300;
    ui.input.focus();
  }

  function chooseSearchableOption(value) {
    if (!searchableSelect) return;
    const select = searchableSelect;
    if (select.value !== value) {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      select.dispatchEvent(new Event("input", { bubbles: true }));
    }
    closeSearchSelect();
    select.focus();
  }

  function preserveScroll(mutation) {
    const y = window.scrollY;
    mutation();
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - y) > 0) window.scrollTo(0, y);
    });
  }

  function sessionStart(session) {
    if (!session || !session.sessionDate) return null;
    // Session times are Asia/Colombo wall-clock values, not browser-local time.
    // API values already carry seconds ("09:00:00"), so normalise to HH:mm
    // before adding the offset; otherwise the date string is invalid and the
    // deadline check silently becomes a no-op.
    const clockTime = String(session.startTime || "00:00").slice(0, 5);
    const date = new Date(
      session.sessionDate +
        "T" +
        clockTime +
        ":00" +
        CLINIC_UTC_OFFSET
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function bookingDeadline(session) {
    const start = sessionStart(session);
    if (!start) return null;
    const minutes =
      session.consultationType === "PHYSICAL"
        ? PHYSICAL_BOOKING_CLOSE_MINUTES
        : ONLINE_BOOKING_CLOSE_MINUTES;
    return new Date(start.getTime() - minutes * 60000);
  }

  function bookingClosed(session) {
    const deadline = bookingDeadline(session);
    return deadline ? Date.now() >= deadline.getTime() : false;
  }

  // ---------------------------------------------------------------
  // Global messages, wake-up handling
  // ---------------------------------------------------------------

  function setAppMessage(message, tone) {
    const notice = $("app-session-warning");
    if (!notice) return;

    if (!message) {
      notice.hidden = true;
      notice.replaceChildren();
      return;
    }

    const styles = {
      warning:
        "fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg",
      success:
        "fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg",
      error:
        "fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-lg",
    };
    notice.className = (styles[tone] || styles.warning) + " flex items-start gap-3";

    const text = el("span", "flex-1 leading-snug", message);
    const close = el(
      "button",
      "shrink-0 cursor-pointer rounded px-1.5 text-lg font-bold leading-tight text-slate2 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand",
      "×"
    );
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss message");
    close.title = "Dismiss";
    close.addEventListener("click", () => setAppMessage(""));

    notice.replaceChildren(text, close);
    notice.hidden = false;
  }

  // Screen-reader-friendly navigation and dialog helpers. The announcer is
  // updated after the view is visible so route changes are not lost in the
  // same render task as the hash change.
  let routeAnnounceTimer = 0;
  function announceRoute(title) {
    const announcer = $("route-announcer");
    if (!announcer) return;
    clearTimeout(routeAnnounceTimer);
    routeAnnounceTimer = setTimeout(() => {
      announcer.textContent = "";
      requestAnimationFrame(() => {
        announcer.textContent = title + " page loaded";
      });
    }, 120);
  }

  function focusViewHeading(view) {
    const heading = view && (view.querySelector("main h1, main h2") || view.querySelector("h1, h2"));
    if (!heading) return;
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }

  let lastDialogTrigger = null;
  function openModal(dialog, focusTarget) {
    if (!dialog || typeof dialog.showModal !== "function") return;
    lastDialogTrigger = document.activeElement;
    dialog.showModal();
    if (focusTarget && typeof focusTarget.focus === "function") {
      focusTarget.focus({ preventScroll: true });
    }
  }

  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("close", () => {
      const trigger = lastDialogTrigger;
      lastDialogTrigger = null;
      if (
        trigger &&
        trigger.isConnected &&
        trigger.getClientRects().length &&
        typeof trigger.focus === "function"
      ) {
        trigger.focus({ preventScroll: true });
      }
    });
  });

  function closeNotificationPopovers() {
    document.querySelectorAll("[data-notification-popover]").forEach((p) => {
      p.hidden = true;
    });
    document.querySelectorAll("[data-notification-bell]").forEach((bell) => {
      bell.setAttribute("aria-expanded", "false");
    });
  }

  let currentWakeState = { message: "", isError: false };

  function setWakeMessage(message, subtext, isError) {
    const status = $("backend-wake-status");
    if (!status) return;

    if (!message) {
      if (currentWakeState.message) {
        status.hidden = true;
        currentWakeState = { message: "", isError: false };
      }
      return;
    }

    const err = Boolean(isError);
    if (currentWakeState.message === message && currentWakeState.isError === err) {
      return;
    }
    currentWakeState = { message, isError: err };

    const label = status.querySelector("[data-wake-message]");
    if (label) label.textContent = message || "";

    const sub = status.querySelector("[data-wake-subtext]");
    if (sub) {
      sub.textContent = subtext || "";
      sub.hidden = !subtext;
    }

    const retryBtn = status.querySelector("[data-wake-retry]");
    if (retryBtn) {
      retryBtn.hidden = !err;
      if (err) {
        retryBtn.disabled = false;
      }
    }

    status.hidden = false;
  }

  function wakeBackend() {
    if (wakePromise) return wakePromise;

    wakePromise = (async () => {
      const delays = [3000, 6000, 10000, 15000, 20000];
      const primaryMessage = "Backend is starting. Please wait a moment.";
      const secondaryMessage =
        "The free server may take a short time to wake up.";

      for (let attempt = 0; attempt <= delays.length; attempt++) {
        const slow = setTimeout(
          () => setWakeMessage(primaryMessage, secondaryMessage, false),
          attempt === 0 ? 1500 : 0
        );

        try {
          const response = await fetchWithTimeout("/api/backend/wake", {
            credentials: "same-origin",
            cache: "no-store",
          });

          if (response.ok) {
            clearTimeout(slow);
            setWakeMessage("");
            return true;
          }
        } catch {
          // Retry below.
        } finally {
          clearTimeout(slow);
        }

        setWakeMessage(primaryMessage, secondaryMessage, false);

        if (attempt < delays.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, delays[attempt])
          );
        }
      }

      setWakeMessage(
        "Backend wake-up failed. Please click Retry to try again.",
        "",
        true
      );
      return false;
    })().finally(() => {
      wakePromise = null;
    });

    return wakePromise;
  }

  function isServiceUnavailable(error) {
    const status = Number(error && error.status);
    return status === 502 || status === 503 || status === 504;
  }

  /**
   * Retries a backend call once after waking the hosted service. Render-style
   * free tiers sleep when idle, so the first request can fail with a 502/503
   * even though the action will succeed a few seconds later.
   */
  async function callWithWakeRetry(task, options) {
    const settings = options || {};
    try {
      return await task();
    } catch (error) {
      if (!isServiceUnavailable(error)) throw error;
      const awake = await wakeBackend();
      if (!awake) {
        throw new Error(
          "The hospital service is still starting. Please wait a moment and try again."
        );
      }
      if (!settings.retry) {
        throw new Error(
          "The hospital service was starting up. Please try that action again."
        );
      }
      return task();
    }
  }

  // ---------------------------------------------------------------
  // Routing and panels
  // ---------------------------------------------------------------

  function parseHash() {
    const raw = decodeURIComponent(location.hash.slice(1));
    let id = raw || "welcome";
    let panel = "";
    let consultId = null;

    if (id.startsWith("consult-") && id.length > 8) {
      consultId = id.slice(8);
      id = "consult";
    }

    const candidate = document.getElementById(id);

    if (
      candidate &&
      candidate.matches("[data-dashboard-panel]") &&
      candidate.closest("section[data-view]")
    ) {
      panel = id;
      id = candidate.closest("section[data-view]").dataset.view;
    }

    return { id, panel, consultId };
  }

  function resolveView(target) {
    let id = target.id;

    if (!views.some((view) => view.dataset.view === id)) id = "welcome";

    if (id === "index" && S && ["DOCTOR", "MANAGER", "ADMIN"].includes(S.role)) {
      return {
        id: HOME[S.role] || "welcome",
        panel: "",
        consultId: null,
      };
    }

    // Guests explore the hospital roster first. The session/booking
    // dashboard is reached after registration or login.
    if (id === "index" && !S) {
      return { id: "doctors", panel: "", consultId: null };
    }

    const allowed = ACL[id];

    if (allowed && !(S && allowed.includes(S.role))) {
      return {
        id: S ? HOME[S.role] || "welcome" : "login",
        panel: "",
        consultId: null,
      };
    }

    if (S && AUTH.includes(id)) {
      return { id: HOME[S.role] || "welcome", panel: "", consultId: null };
    }

    return { id, panel: target.panel, consultId: target.consultId };
  }

  function setPrimaryNavCurrent(viewId) {
    document
      .querySelectorAll(
        'nav[aria-label="Pages"] a[href^="#"]:not([data-panel-link])'
      )
      .forEach((link) => {
        const isCurrent = link.getAttribute("href") === "#" + viewId;
        if (isCurrent) {
          link.setAttribute("aria-current", "page");
          link.classList.remove("text-slate2", "hover:bg-snow");
          link.classList.add("bg-brand", "text-white");
        } else {
          link.removeAttribute("aria-current");
          link.classList.remove("bg-brand", "text-white");
          link.classList.add("text-slate2", "hover:bg-snow");
        }
      });
  }

  function setPanel(view, panelId) {
    if (!view || !panelId) return false;

    const target = document.getElementById(panelId);

    if (
      !target ||
      !view.contains(target) ||
      !target.matches("[data-dashboard-panel]")
    ) {
      return false;
    }

    const y = window.scrollY;

    view.querySelectorAll("[data-dashboard-panel]").forEach((panel) => {
      panel.hidden = panel !== target;
    });

    view.querySelectorAll("[data-panel-link]").forEach((link) => {
      const isCurrent = link.getAttribute("href") === "#" + panelId;
      if (isCurrent) {
        link.setAttribute("aria-current", "page");
        if (link.closest("nav[aria-label='Pages']")) {
          link.classList.remove("text-slate2", "hover:bg-snow");
          link.classList.add("bg-brand", "text-white");
        }
      } else {
        link.removeAttribute("aria-current");
        if (link.closest("nav[aria-label='Pages']")) {
          link.classList.remove("bg-brand", "text-white");
          link.classList.add("text-slate2", "hover:bg-snow");
        }
      }
    });

    requestAnimationFrame(() => window.scrollTo(0, y));
    return true;
  }

  function activatePanel(view, link) {
    if (!view || !link) return;
    if (!setPanel(view, link.hash.slice(1))) return;

    try {
      history.replaceState(null, "", link.hash);
    } catch {
      // Ignore history failures (for example in private modes).
    }

    if (link.hash === "#doctor-n") {
      loadOnce(loadDoctorNotesPicker);
    }

    if (link.hash === "#admin-u" || link.hash === "#manager-u" || link.hash === "#admin" || link.hash === "#manager") {
      loadOnce(loadStaffAccounts);
    }

    if (link.hash === "#admin-d" || link.hash === "#admin") {
      loadOnce(loadAdminStats);
    }

    if (link.hash === "#manager-x" || link.hash === "#admin") {
      loadOnce(loadAuditLogs);
    }

    if (link.hash === "#admin-r" || link.hash === "#admin") {
      loadOnce(loadAdminRooms);
    }

    if (link.hash === "#manager-s" || link.hash === "#manager-d" || link.hash === "#manager") {
      loadOnce(loadManagerSessionPicker);
      loadOnce(loadManagerSessions);
    }

    if (link.hash === "#manager-r" || link.hash === "#manager") {
      loadOnce(loadManagerReception);
    }

    if (link.hash === "#manager-x") {
      loadOnce(loadManagerReviews);
    }

    if (link.hash === "#manager-n" || link.hash === "#manager") {
      loadOnce(loadManagerNotices);
    }
  }

  function initPanels(view, requestedPanel) {
    if (!view) return;

    if (view.dataset.view === "manager") {
      ensureManagerNoticesPanel();
    }

    const panels = Array.from(
      view.querySelectorAll("[data-dashboard-panel]")
    );

    if (!panels.length) return;

    const currentLink = view.querySelector(
      '[data-panel-link][aria-current="page"]'
    );

    const currentPanel = currentLink
      ? panels.find(
          (panel) => "#" + panel.id === currentLink.getAttribute("href")
        )
      : null;

    const active =
      (requestedPanel && panels.find((panel) => panel.id === requestedPanel)) ||
      currentPanel ||
      panels[0];

    panels.forEach((panel) => {
      panel.hidden = panel !== active;
    });

    view.querySelectorAll("[data-panel-link]").forEach((link) => {
      const isCurrent = link.getAttribute("href") === "#" + active.id;
      if (isCurrent) {
        link.setAttribute("aria-current", "page");
        if (link.closest("nav[aria-label='Pages']")) {
          link.classList.remove("text-slate2", "hover:bg-snow");
          link.classList.add("bg-brand", "text-white");
        }
      } else {
        link.removeAttribute("aria-current");
        if (link.closest("nav[aria-label='Pages']")) {
          link.classList.remove("bg-brand", "text-white");
          link.classList.add("text-slate2", "hover:bg-snow");
        }
      }
    });

    if (active.id === "doctor-n") {
      loadOnce(loadDoctorNotesPicker);
    }

    if (active.id === "admin-u" || active.id === "manager-u") {
      loadOnce(loadStaffAccounts);
    }

    if (active.id === "admin-d" || active.id === "admin") {
      loadOnce(loadAdminStats);
    }

    if (active.id === "admin-a" || active.id === "admin") {
      loadOnce(loadAuditLogs);
    }

    if (active.id === "admin-r" || active.id === "admin") {
      loadOnce(loadAdminRooms);
    }

    if (active.id === "manager-s" || active.id === "manager-d") {
      loadOnce(loadManagerSessionPicker);
      loadOnce(loadManagerSessions);
    }

    if (active.id === "manager-r" || active.id === "manager") {
      loadOnce(loadManagerReception);
    }

    if (active.id === "manager-x") {
      loadOnce(loadManagerReviews);
    }

    if (active.id === "manager-n" || active.id === "manager") {
      loadOnce(loadManagerNotices);
    }
  }

  // Panel setup and view entry can request the same dataset in one tick.
  // Keep a short-lived in-flight guard so each loader runs once per burst.
  const activeLoaders = new Set();
  function loadOnce(loader) {
    const key = loader.name || String(loader);
    if (activeLoaders.has(key)) return;
    activeLoaders.add(key);
    Promise.resolve()
      .then(loader)
      .catch((error) => console.warn("Loader failed:", key, error))
      .finally(() => activeLoaders.delete(key));
  }

  let welcomeEntrancePlayed = false;
  let welcomeStatsRequested = false;

  // The welcome counters are live figures, never marketing constants. They
  // stay as "—" if the directory cannot be reached rather than inventing a
  // number that the hospital cannot back up.
  function clinicWeekBoundsISO() {
    const [year, month, day] = todayISO().split("-").map(Number);
    const today = new Date(Date.UTC(year, month - 1, day));
    const daysSinceMonday = (today.getUTCDay() + 6) % 7;
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() - daysSinceMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const iso = (date) => date.toISOString().slice(0, 10);
    return { from: iso(monday), to: iso(sunday) };
  }

  function setWelcomeStat(name, value) {
    const element = document.querySelector(
      '[data-welcome-stat="' + name + '"]'
    );
    if (!element || !Number.isFinite(value) || value < 0) return;
    element.textContent = String(value);
    element.title = "Live count from the hospital directory";
  }

  async function loadWelcomeStats() {
    if (welcomeStatsRequested) return;
    welcomeStatsRequested = true;

    const bounds = clinicWeekBoundsISO();
    const [doctors, specialisations, sessions] = await Promise.allSettled([
      MC.doctorDirectory(),
      MC.specialisations(),
      MC.sessions({ from: bounds.from, to: bounds.to }),
    ]);

    if (doctors.status === "fulfilled" && Array.isArray(doctors.value)) {
      setWelcomeStat("doctors", doctors.value.length);
    }
    if (
      specialisations.status === "fulfilled" &&
      Array.isArray(specialisations.value)
    ) {
      setWelcomeStat("specialisations", specialisations.value.length);
    }
    if (sessions.status === "fulfilled" && Array.isArray(sessions.value)) {
      setWelcomeStat(
        "sessions",
        sessions.value.filter((session) => session.status !== "CANCELLED").length
      );
    }
  }

  function playWelcomeEntrance() {
    if (welcomeEntrancePlayed) return;
    welcomeEntrancePlayed = true;

    const welcome = document.querySelector('[data-view="welcome"]');
    if (!welcome) return;

    // 1. Background Network "Wake Up" Sequence
    const highway = welcome.querySelector(".mc-journey-highway");
    const network = welcome.querySelector(".mc-journey-network");
    const nodes = Array.from(welcome.querySelectorAll(".mc-journey-node"));

    if (!prefersReducedMotion.matches) {
      if (highway) {
        highway.style.strokeDashoffset = "1200";
        playMotion(
          highway,
          [
            { strokeDashoffset: "1200", opacity: 0.4 },
            { strokeDashoffset: "0", opacity: 1 },
          ],
          { duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
        );
      }

      nodes.forEach((node, idx) => {
        playMotion(
          node,
          [
            { transform: "scale(0)", opacity: 0 },
            { transform: "scale(1.2)", opacity: 1 },
            { transform: "scale(1)", opacity: 0.9 },
          ],
          { duration: 420, delay: 120 * idx, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" }
        );
      });

      if (network) {
        setTimeout(() => {
          if (!prefersReducedMotion.matches) {
            network.style.opacity = "0.38";
          }
        }, 850);
      }
    } else {
      if (highway) highway.style.strokeDashoffset = "0";
      if (network) network.style.opacity = "0.3";
    }

    // 2. Cinematic Hero Sequence
    const textColumn = welcome.querySelector("main > div.relative > div.grid > div.grid");
    if (!textColumn) return;

    const heading = textColumn.querySelector("h1");
    const actionGroup = textColumn.querySelector("div.flex.flex-wrap");
    const accountPrompt = actionGroup && actionGroup.parentElement
      ? actionGroup.parentElement.querySelector("p")
      : null;
    const elements = [
      textColumn.querySelector("p.inline-flex"),
      heading,
      heading ? heading.nextElementSibling : null,
      actionGroup,
      accountPrompt,
      textColumn.querySelector("ul"),
      welcome.querySelector("main figure"),
      welcome.querySelector("main .grid-cols-3"),
    ].filter(Boolean);

    elements.forEach((element, index) => {
      animateEntry(element, index * 55, 420);
    });

    // 3. Live statistics from the public directory
    void loadWelcomeStats();
  }

  function showView(id, panel, options) {
    const settings = options || {};
    const view = views.find((item) => item.dataset.view === id) || views[0];
    if (!view) return;

    const targetId = view.dataset.view;
    const changed = activeView !== targetId;

    if (changed) {
      if (activeView === "doctor" && state.doctor.pollTimer) {
        clearInterval(state.doctor.pollTimer);
        state.doctor.pollTimer = null;
      }
      if (activeView === "appointments" && state.patientPollTimer) {
        clearInterval(state.patientPollTimer);
        state.patientPollTimer = null;
      }
      if (activeView === "index") {
        stopSessionQueuePolling();
      }
      if (activeView === "doctors") {
        stopDirectoryPolling();
      }
      if (activeView === "consult") {
        stopConsultationStatusPolling();
        stopChatPolling();
        unsubscribe("chat");
        unsubscribe("typing");
        unsubscribe("status");
        unsubscribe("chat-errors");
      }

      views.forEach((item) => {
        item.hidden = item !== view;
      });
      if (!enhancedViews.has(view)) {
        enhanceMotionTree(view);
        enhancedViews.add(view);
      }

      activeView = targetId;
      document.body.dataset.activeView = targetId;

      const bootOverlay = document.querySelector(".app-boot-screen");
      if (bootOverlay && (targetId === "login" || targetId === "register")) {
        bootOverlay.setAttribute("aria-hidden", "true");
      }

      setPrimaryNavCurrent(targetId);
      initPanels(view, panel);

      document.title = view.dataset.title + " · MediChannel";

      const robotsMeta = document.querySelector('meta[name="robots"]');
      if (robotsMeta) {
        robotsMeta.setAttribute(
          "content",
          PRIVATE_VIEWS.includes(targetId)
            ? "noindex, nofollow"
            : "index, follow, max-image-preview:large"
        );
      }

      if (routeAnnounced) {
        focusViewHeading(view);
        announceRoute(view.dataset.title || "MediChannel");
      } else {
        routeAnnounced = true;
      }

      const footer = document.querySelector("footer");
      if (footer) {
        footer.hidden =
          document.body.dataset.appReady !== "true" ||
          ["login", "register"].includes(targetId);
      }

      if (targetId === "login" && flash) {
        const success = $("login-ok");
        if (success) {
          success.textContent = flash;
          success.hidden = false;
        }
        flash = "";
      }

      window.scrollTo(0, 0);
      if (targetId === "welcome") {
        playWelcomeEntrance();
      } else {
        animateEntry(view, 0, 320);
      }
    } else if (panel) {
      setPanel(view, panel);
    }

    if (changed || settings.force) {
      enterView(targetId);
    }
  }

  function go(options) {
    const settings = options || {};
    const target = resolveView(parseHash());
    showView(target.id, target.panel, settings);

    if (target.consultId) {
      state.consult.requestedId = target.consultId;
    }
  }

  function nav(id) {
    if (location.hash === "#" + id) {
      go({ force: true });
      return;
    }
    location.hash = id;
  }

  function enterView(id) {
    if (id === "doctors") {
      void loadSpecialisations();
      startDirectoryPolling();
      return;
    }

    if (id === "index") {
      void prepareSearch();
      return;
    }

    if (id === "appointments") {
      void loadAppointments();
      if (!state.patientPollTimer) {
        state.patientPollTimer = setInterval(() => {
          if (activeView === "appointments") void loadAppointments();
        }, 5000);
      }
    } else if (id === "profile") {
      void loadPatientProfile();
    } else if (id === "doctor") {
      void loadDoctorIdentity();
      void loadDoctorConsole();
      if (!state.doctor.pollTimer) {
        state.doctor.pollTimer = setInterval(() => {
          if (activeView === "doctor" && state.doctor.sessionId) {
            void loadDoctorQueue(state.doctor.sessionId, { silent: true });
          }
        }, 5000);
      }
    } else if (id === "consult") {
      void loadConsultationPicker();
    } else if (id === "admin") {
      loadOnce(loadAdminSpecialisations);
      loadOnce(loadStaffAccounts);
      loadOnce(loadAdminRooms);
      loadOnce(loadAdminStats);
      loadOnce(loadAuditLogs);
      subscribeAdminAuditLogs();
      if (!state.auditLogTimer) {
        state.auditLogTimer = setInterval(() => {
          if (activeView === "admin") loadOnce(loadAuditLogs);
        }, 6000);
      }
    } else if (id === "manager") {
      ensureManagerNoticesPanel();
      loadOnce(loadAdminSpecialisations);
      loadOnce(loadManagerNotices);
      loadOnce(loadStaffAccounts);
      loadOnce(loadManagerSessionPicker);
      loadOnce(loadManagerSessions);
    } else if (id === "welcome") {
      void loadDoctorIdentity();
      loadOnce(loadPublicNotices);
    }

    // loadAppointments() already refreshes the queue with the fresh list.
    if (["welcome", "index"].includes(id)) {
      if (S && S.role === "CUSTOMER") {
        void refreshPatientQueue();
      } else {
        hideQueue();
      }
    }
  }

  // ---------------------------------------------------------------
  // Account rendering
  // ---------------------------------------------------------------

  /**
   * The welcome hero CTA follows the visitor's state: guests discover the
   * public roster, patients go straight to the booking dashboard, and staff
   * return to their own dashboard.
   */
  function renderWelcomeCta() {
    document.querySelectorAll("[data-welcome-cta]").forEach((link) => {
      let label = "Find a doctor";
      let target = "doctors";

      if (S && S.role === "CUSTOMER") {
        label = "Book a session";
        target = "index";
      } else if (S && HOME[S.role]) {
        label = "Go to dashboard";
        target = HOME[S.role];
      }

      link.href = "#" + target;
      const text = link.querySelector("[data-welcome-cta-label]");
      if (text) text.textContent = label;
    });
  }

  function render() {
    document.querySelectorAll("[data-who]").forEach((container) => {
      container.replaceChildren();

      if (S && RB[S.role]) {
        container.append(badge(RB[S.role][1], {
          CUSTOMER: "blue",
          DOCTOR: "green",
          MANAGER: "orange",
          ADMIN: "red",
        }[S.role]));

        const displayName = S.displayName || S.email || "Signed in";
        const name = el(
          "span",
          "hidden max-w-[14rem] truncate sm:inline",
          displayName
        );
        name.title = S.email || displayName;
        container.append(name);

        if (S.role === "CUSTOMER") {
          const profileLink = el(
            "a",
            "inline-flex items-center border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
            "My profile"
          );
          profileLink.href = "#profile";
          container.append(profileLink);
        }

        const out = el(
          "button",
          "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
          "Log out"
        );
        out.type = "button";
        out.dataset.out = "";
        container.append(out);
        return;
      }

      const loginLink = el(
        "a",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
        "Log in"
      );
      loginLink.href = "#login";

      const registerLink = el(
        "a",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold bg-peach border-peach text-white hover:bg-peach-d min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
        "Register"
      );
      registerLink.href = "#register";

      container.append(loginLink, registerLink);
    });

    const welcomeName = S && S.displayName ? S.displayName : "";
    document.querySelectorAll("[data-welcome-identity]").forEach((node) => {
      node.hidden = !welcomeName;
      node.textContent = welcomeName ? "Welcome back, " + welcomeName : "";
    });

    document.querySelectorAll("[data-doctor-welcome]").forEach((node) => {
      node.hidden = !welcomeName;
      node.textContent = welcomeName ? "Welcome back, " + welcomeName : "";
    });

    renderWelcomeCta();

    document.querySelectorAll("[data-roles]").forEach((link) => {
      const raw = link.getAttribute("data-roles") || link.dataset.roles || "*";
      const roles = String(raw).split(/\s+/);
      const isVisible =
        roles.includes("*") ||
        (!S && roles.includes("GUEST")) ||
        (S && roles.includes(S.role));
      link.hidden = !isVisible;
    });

    document.querySelectorAll("[data-guest-only]").forEach((item) => {
      item.hidden = Boolean(S);
    });

    document.querySelectorAll("[data-home-dashboard]").forEach((link) => {
      const isStaff = S && ["DOCTOR", "MANAGER", "ADMIN"].includes(S.role);
      const home = isStaff ? HOME[S.role] : null;
      link.hidden = !home;
      if (home) link.href = "#" + home;
    });
  }

  function setSession(user, token) {
    if (!user || !HOME[user.role]) {
      S = null;
      try { localStorage.removeItem("mc-active-user"); } catch {}
      try { sessionStorage.removeItem("mc_tab_user"); } catch {}
      try { sessionStorage.removeItem("mc_tab_token"); } catch {}
      if (state.doctor.pollTimer) clearInterval(state.doctor.pollTimer);
      state.doctor.pollTimer = null;
      if (state.patientPollTimer) clearInterval(state.patientPollTimer);
      state.patientPollTimer = null;
      if (state.notificationTimer) clearInterval(state.notificationTimer);
      state.notificationTimer = null;
      state.notifications = [];
      state.notificationsLoaded = false;
      if (state.shownToastIds) state.shownToastIds.clear();
      state.syncedSummaryNotifications.clear();
      state.syncedReviewNotifications.clear();
      state.myReviews = [];
      state.submittedFeedbackIds.clear();
      state.appointments = [];
      state.appointmentsLoaded = false;
      clearBookingPanel();
      hideQueue();
      renderNotificationBadge(0);
      return;
    }

    try {
      localStorage.setItem("mc-active-user", JSON.stringify({ email: user.email, role: user.role }));
    } catch {}
    try {
      sessionStorage.setItem("mc_tab_user", JSON.stringify(user));
      // The login/register routes return the REST token instead of issuing a
      // cookie. Persist it for this tab so every subsequent API call carries
      // the Bearer credential the tab-bound BFF requires.
      if (typeof token === "string" && token) {
        sessionStorage.setItem("mc_tab_token", token);
      }
    } catch {}

    state.consult.appointmentId = null;
    state.consult.requestedId = null;
    state.consult.appointment = null;
    state.consult.summary = null;
    state.consult.list = [];
    state.syncedSummaryNotifications.clear();
    state.syncedReviewNotifications.clear();
    state.notificationsLoaded = false;
    state.shownToastIds.clear();
    state.myReviews = [];
    state.submittedFeedbackIds.clear();
    state.appointments = [];
    state.appointmentsLoaded = false;
    state.profile = null;
    clearBookingPanel();
    state.doctor.sessions = [];
    state.doctor.sessionsLoaded = false;
    state.doctor.sessionId = null;
    state.doctor.queue = null;
    state.doctor.selected = null;
    state.doctor.summary = null;
    state.doctor.profile = null;
    state.doctor.identityLoading = false;
    state.doctor.allAppointments = [];
    state.doctor.sessionAppointments = [];

    S = {
      id: user.id || user.userId || null,
      role: user.role,
      email: user.email || "Signed in",
      name: user.email || "Signed in",
      displayName: user.displayName || user.doctorName || null,
    };
    if (state.notificationTimer) clearInterval(state.notificationTimer);
    subscribe("private-notifications", "/user/queue/notifications", handleIncomingNotification);
    state.notificationTimer = setInterval(loadNotifications, 15000);
    void loadNotifications();
    void loadDoctorIdentity();
  }

  /**
   * The session endpoint only carries id, email and role. Load the doctor's
   * own profile so every dashboard greeting uses the name of the doctor who
   * actually signed in, including accounts created by the administrator.
   */
  async function loadDoctorIdentity() {
    if (!S || S.role !== "DOCTOR" || S.displayName) return;
    if (state.doctor.identityLoading) return;

    const userId = S.id;
    state.doctor.identityLoading = true;
    try {
      const profile = await MC.doctorProfile();
      if (!S || S.role !== "DOCTOR" || S.id !== userId) return;

      const displayName = doctorDisplayName(profile);
      if (!displayName) return;

      state.doctor.profile = profile;
      S.displayName = displayName;
      S.doctorName = displayName;
      render();
    } catch {
      // The email fallback remains visible if the profile is temporarily unavailable.
    } finally {
      state.doctor.identityLoading = false;
    }
  }

  function handleSessionExpired() {
    S = null;
    if (state.doctor.pollTimer) clearInterval(state.doctor.pollTimer);
    state.doctor.pollTimer = null;
    if (state.patientPollTimer) clearInterval(state.patientPollTimer);
    state.patientPollTimer = null;
    if (state.notificationTimer) clearInterval(state.notificationTimer);
    state.notificationTimer = null;
    state.syncedSummaryNotifications.clear();
    state.syncedReviewNotifications.clear();
    state.notificationsLoaded = false;
    state.shownToastIds.clear();
    state.submittedFeedbackIds.clear();
    state.appointments = [];
    state.appointmentsLoaded = false;
    disconnectRealtime();
    clearBookingPanel();
    render();
    hideQueue();
    setAppMessage("Your session expired. Please sign in again.");
    nav("login");
  }

  window.addEventListener("storage", (event) => {
    if (event.key === "mc-active-user" && event.newValue) {
      try {
        const active = JSON.parse(event.newValue);
        if (S && active && active.email && active.email.toLowerCase() !== (S.email || "").toLowerCase()) {
          // Two accounts can be used in separate tabs: each tab keeps its own
          // mc_tab_token, so this notice is informational only.
          setAppMessage(
            `Another account (${active.email}) was signed in in a different tab. This tab keeps its own session — carry on here, or sign in again if anything looks out of date.`
          );
        }
      } catch {}
    }
  });

  // ---------------------------------------------------------------
  // Booking intent (login gate with return)
  // ---------------------------------------------------------------

  function saveIntent(session, reason, period, date) {
    const intent = {
      sessionId: session && session.sessionId,
      session: session || null,
      reason: reason || "",
      period: period || "",
      date: date || "",
    };

    state.pendingIntent = intent;

    try {
      sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
    } catch {
      // The in-memory copy still works for this page.
    }
  }

  function readIntent() {
    if (state.pendingIntent) return state.pendingIntent;

    try {
      const raw = sessionStorage.getItem(INTENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearIntent() {
    state.pendingIntent = null;
    try {
      sessionStorage.removeItem(INTENT_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  function applyIntent() {
    const intent = readIntent();
    if (!intent || !S || S.role !== "CUSTOMER") return;

    const session =
      (intent.sessionId &&
        state.sessions.find((item) => item.sessionId === intent.sessionId)) ||
      intent.session;

    if (session) {
      selectSession(session, {
        reason: intent.reason,
        period: intent.period,
        date: intent.date,
      });
    }

    clearIntent();
  }

  // ---------------------------------------------------------------
  // Session search
  // ---------------------------------------------------------------

  async function loadSpecialisations() {
    const selects = ["index-sp", "directory-sp"]
      .map((id) => $(id))
      .filter(Boolean);
    if (!selects.length || state.specialisationsLoaded) return;

    try {
      const list = await MC.specialisations();
      if (!Array.isArray(list)) throw new Error("Unexpected response");

      selects.forEach((select) => {
        const current = select.value;
        select.replaceChildren(el("option", "", "All specialisations"));
        select.firstChild.value = "";

        list.forEach((item) => {
          const option = el("option", "", item.name);
          option.value = item.id;
          select.append(option);
        });

        if (current) select.value = current;
      });
      state.specialisationsLoaded = true;
    } catch {
      // Search still works without the filter.
    }
  }

  async function prepareSearch() {
    const dateInput = $("index-dt");
    if (dateInput && !dateInput.value) dateInput.value = todayISO();
    populateSessionRangeSelects();

    enhanceIndexDashboard();
    await loadSpecialisations();

    if (S) subscribeSessionsCatalogue();

    if (!state.sessionsLoaded && !state.sessionsLoading) {
      await loadSessions();
    } else {
      renderSessions();
      if (activeView === "index") startSessionQueuePolling();
    }

    applyIntent();
  }

  function currentFilters() {
    const q = $("index-q");
    const specialisation = $("index-sp");
    const date = $("index-dt");
    const type = $("index-ty");

    return {
      q: q ? q.value.trim() : "",
      specialisationId: specialisation ? specialisation.value : "",
      date: date ? date.value : "",
      consultationType: type ? type.value : "",
    };
  }

  /**
   * Only sessions for doctors advertised as available on the guest dashboard
   * may be offered to a patient. The backend applies the same rule together
   * with the two-window / five-minute-slot congruence check.
   */
  function bookableSessions(sessions) {
    return (Array.isArray(sessions) ? sessions : []).filter(
      (session) => session && session.doctorAvailable !== false
    );
  }

  async function loadSessions() {
    if (state.sessionsLoading) return;

    const status = document.querySelector("[data-session-status]");
    const list = document.querySelector("[data-session-list]");
    const heading = document.querySelector("[data-session-heading]");
    const filters = currentFilters();
    const rangeSelect = $("index-range");
    const range = sessionSearchRange(filters.date, rangeSelect ? rangeSelect.value : "1");
    const requestFilters = {
      ...filters,
      date: "",
      from: range.from,
      to: range.to,
    };
    state.sessionWeeks = sessionWeekChunks(range.from, range.weeks);

    state.sessionsLoading = true;

    if (status) {
      status.hidden = false;
      status.textContent = "Loading available sessions…";
      status.classList.remove("text-bad");
    }

    if (list) list.replaceChildren();

    try {
      const sessionResponse = await MC.sessions(requestFilters);
      if (!Array.isArray(sessionResponse)) throw new Error("Unexpected response");
      let sessions = bookableSessions(sessionResponse);

      let fallbackNotice = "";
      // Keep the no-dead-end fallback: with no sessions in the chosen window,
      // show the next available sessions and label them as outside the range.
      if (sessions.length === 0) {
        try {
          const allUpcoming = bookableSessions(
            await MC.sessions({ ...filters, date: "", from: "", to: "" })
          );
          if (allUpcoming.length > 0) {
            // The full roster spans six months; keep the no-dead-end fallback
            // bounded so a past or empty week never renders thousands of cards.
            sessions = allUpcoming.slice(0, 120);
            state.sessionWeeks = [];
            fallbackNotice = `No sessions for ${formatDate(range.from)} – ${formatDate(range.to)}. Showing the next available sessions:`;
          }
        } catch {
          // keep original empty sessions
        }
      }

      state.sessions = sessions;
      state.sessionsLoaded = true;

      if (heading) {
        if (fallbackNotice) {
          heading.textContent = fallbackNotice;
        } else {
          const rangeLabel =
            formatDate(range.from) + " – " + formatDate(range.to);
          heading.textContent =
            sessions.length +
            (sessions.length === 1 ? " session across " : " sessions across ") +
            range.weeks +
            (range.weeks === 1 ? " week · " : " weeks · ") +
            rangeLabel +
            " · " + CLINIC_WINDOW_LABEL +
            " · up to " + MAX_PATIENTS_PER_DAY + " patients/day";
        }
      }

      if (status) {
        status.hidden = sessions.length > 0;
        status.textContent =
          sessions.length === 0
            ? "No sessions match these filters. Try another doctor, specialisation or date."
            : "";
      }

      renderSessions();
      if (activeView === "index") startSessionQueuePolling();
    } catch (error) {
      state.sessionsLoaded = false;
      state.sessionWeeks = [];
      if (heading) heading.textContent = "Sessions unavailable";
      if (status) {
        status.hidden = false;
        status.classList.add("text-bad");
        status.textContent = error.message;
      }
      if (list) list.replaceChildren();
    } finally {
      state.sessionsLoading = false;
    }
  }

  /**
   * A published summary is pushed as SUMMARY_AVAILABLE. The patient may have
   * opened the room before the doctor published, so reload that appointment's
   * clinical summary instead of leaving the old "not available yet" card.
   */
  function syncSummaryNotification(notification) {
    if (!S || S.role !== "CUSTOMER" || !notification) return;

    const type = String(notification.type || "").toUpperCase();
    if (!type.includes("SUMMARY")) return;

    const appointmentId = notification.appointmentId;
    if (!appointmentId) return;

    const key = String(notification.notificationId || appointmentId);
    if (state.syncedSummaryNotifications.has(key)) return;
    state.syncedSummaryNotifications.add(key);

    // Remember the row so navigating to the consultation window later opens
    // the appointment the doctor just published, not an arbitrary first row.
    state.consult.requestedId = appointmentId;

    if (activeView !== "consult") return;

    if (String(state.consult.appointmentId || "") !== String(appointmentId)) {
      void loadConsultationPicker();
      return;
    }

    void loadConsultSummary(appointmentId);
  }

  /**
   * A patient's feedback is pushed to the doctor as REVIEW_RECEIVED. Reload the
   * consultation's feedback card immediately when that room is open; otherwise
   * remember it so the notification's "Open consultation" link selects it.
   */
  function syncReviewNotification(notification) {
    if (!S || S.role !== "DOCTOR" || !notification) return;

    const type = String(notification.type || "").toUpperCase();
    if (!type.includes("REVIEW") && !type.includes("FEEDBACK")) return;

    const appointmentId = notification.appointmentId;
    if (!appointmentId) return;

    const key = String(notification.notificationId || appointmentId);
    if (state.syncedReviewNotifications.has(key)) return;
    state.syncedReviewNotifications.add(key);

    state.consult.requestedId = appointmentId;
    if (activeView !== "consult") return;

    if (String(state.consult.appointmentId || "") !== String(appointmentId)) {
      void loadConsultationPicker();
      return;
    }

    void loadConsultationReviewState(appointmentId);
  }

  function notificationAction(n) {
    if (!n || !n.appointmentId) return null;
    const role = S && S.role ? S.role : "";
    const type = n.type || "";
    const title = String(n.title || "").toLowerCase();

    if (role === "DOCTOR") {
      if (type === "CONSULTATION_STARTED" || type === "NEW_CHAT_MESSAGE") {
        return {
          label: "Open consultation →",
          view: "consult",
          appointmentId: n.appointmentId,
          href: "#consult-" + encodeURIComponent(n.appointmentId),
        };
      }
      return {
        label: "View session queue →",
        view: "doctor",
        appointmentId: null,
        href: "#doctor",
      };
    }

    if (type === "CONSULTATION_STARTED" || type === "CALLED" || type === "NEW_CHAT_MESSAGE") {
      return {
        label: "Join consultation →",
        view: "consult",
        appointmentId: n.appointmentId,
        href: "#consult-" + encodeURIComponent(n.appointmentId),
      };
    }

    if (type === "APPOINTMENT_BOOKED" && title.includes("accepted")) {
      return {
        label: "Pay in appointments →",
        view: "appointments",
        appointmentId: null,
        href: "#appointments",
      };
    }

    if (type === "APPOINTMENT_ARRIVED") {
      return {
        label: "Follow live queue →",
        view: "appointments",
        appointmentId: null,
        href: "#appointments",
      };
    }

    if (type === "SUMMARY_AVAILABLE" || type === "CONSULTATION_COMPLETED") {
      return {
        label: "View consultation summary →",
        view: "appointments",
        appointmentId: null,
        href: "#appointments",
      };
    }

    if (type === "APPOINTMENT_CANCELLED" && title.includes("declined")) {
      return {
        label: "Book another session →",
        view: "index",
        appointmentId: null,
        href: "#index",
      };
    }

    return {
      label: "View appointments →",
      view: "appointments",
      appointmentId: null,
      href: "#appointments",
    };
  }

  function markNotificationAsRead(notification) {
    if (!notification || notification.read || !notification.notificationId) return;
    notification.read = true;
    const unreadCount = (state.notifications || []).filter((item) => !item.read).length;
    renderNotificationBadge(unreadCount);
    void MC.markNotificationRead(notification.notificationId).catch(() => {});
  }

  function refreshOpenNotificationPopovers() {
    document.querySelectorAll("[data-notification-popover]").forEach((popover) => {
      if (!popover.hidden) renderNotificationPopover(popover);
    });
  }

  function handleIncomingNotification(notification) {
    if (!S || !notification || !notification.notificationId) return;
    const exists = state.notifications.some(
      (item) => item.notificationId === notification.notificationId
    );
    if (exists) return;

    state.notifications.unshift(notification);
    const unreadCount = state.notifications.filter((item) => !item.read).length;
    renderNotificationBadge(unreadCount);
    refreshOpenNotificationPopovers();
    showNotificationToast(notification);

    if (S.role === "DOCTOR") {
      syncReviewNotification(notification);
      if (state.doctor.sessionId) {
        void loadDoctorQueue(state.doctor.sessionId, { silent: true });
      }
      if (typeof loadDoctorAppointments === "function" && activeView === "doctor") {
        void loadDoctorAppointments({ silent: true });
      }
      void MC.doctorSessions().then((sessions) => {
        if (Array.isArray(sessions)) {
          state.doctor.sessions = sessions;
          const session = sessions.find((s) => s.sessionId === state.doctor.sessionId);
          if (session && state.doctor.queue) {
            renderDoctorHeader(session, state.doctor.queue);
          }
        }
      });
    } else if (S.role === "CUSTOMER") {
      syncSummaryNotification(notification);
      void loadAppointments();
      void refreshPatientQueue();
    } else if (S.role === "MANAGER") {
      invalidateManagerDashboard();
      if (activeView === "manager" || (window.location && window.location.hash.startsWith("#manager"))) {
        void loadManagerDashboard({ force: true });
      }
    }
  }

  async function loadNotifications() {
    if (!S) return;
    try {
      const items = await MC.notifications();
      if (!Array.isArray(items)) return;
      const unread = items.filter((n) => !n.read);
      const isInitial = !state.notificationsLoaded;
      state.notificationsLoaded = true;
      const existingIds = new Set(
        (state.notifications || []).map((item) => item.notificationId)
      );
      state.notifications = items;
      unread.forEach((notification) => {
        syncSummaryNotification(notification);
        syncReviewNotification(notification);
      });
      if (!isInitial) {
        const newlyArrived = unread.find(
          (n) => n.notificationId && !existingIds.has(n.notificationId)
        );
        if (newlyArrived) {
          showNotificationToast(newlyArrived);
          if (S && S.role === "DOCTOR" && state.doctor.sessionId) {
            void loadDoctorQueue(state.doctor.sessionId, { silent: true });
          } else if (S && S.role === "CUSTOMER") {
            void loadAppointments();
            void refreshPatientQueue();
          } else if (S && S.role === "MANAGER") {
            invalidateManagerDashboard();
            if (activeView === "manager" || (window.location && window.location.hash.startsWith("#manager"))) {
              void loadManagerDashboard({ force: true });
            }
          }
        }
      }
      renderNotificationBadge(unread.length);
      refreshOpenNotificationPopovers();
    } catch (e) {
      // silently fail - notifications are non-critical
    }
  }

  function showNotificationToast(n) {
    if (!n) return;
    if (n.notificationId) {
      if (state.shownToastIds.has(n.notificationId)) return;
      state.shownToastIds.add(n.notificationId);
    }

    let container = document.getElementById("notification-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "notification-toast-container";
      container.className =
        "fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100%-2rem)] pointer-events-none";
      document.body.append(container);
    }

    const toast = document.createElement("div");
    toast.className =
      "pointer-events-auto rounded-xl border border-line bg-white/95 p-3.5 shadow-xl backdrop-blur transition-all duration-200 transform translate-y-0 opacity-100 flex flex-col gap-1.5";
    toast.setAttribute("role", "alert");

    const header = document.createElement("div");
    header.className = "flex items-start justify-between gap-2";

    const titleWrap = document.createElement("div");
    titleWrap.className = "flex items-center gap-2";

    const dot = document.createElement("span");
    dot.className = "h-2 w-2 rounded-full bg-brand shrink-0";

    const title = document.createElement("b");
    title.className = "text-sm font-bold text-ink leading-tight";
    title.textContent = n.title || "Notification";

    titleWrap.append(dot, title);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close notification");
    closeBtn.className =
      "h-6 w-6 -mr-1 -mt-1 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-ink hover:bg-slate-100 transition-colors text-base font-bold cursor-pointer shrink-0";
    closeBtn.innerHTML = "&times;";

    let dismissTimer = null;

    const dismiss = () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      setTimeout(() => {
        try { toast.remove(); } catch {}
      }, 180);
    };

    closeBtn.onclick = (e) => {
      e.stopPropagation();
      dismiss();
    };

    header.append(titleWrap, closeBtn);
    toast.append(header);

    const msg = document.createElement("p");
    msg.className = "text-xs sm:text-sm text-slate2 leading-relaxed pl-4";
    msg.textContent = n.message || "";
    toast.append(msg);

    const action = notificationAction(n);
    if (action) {
      const link = document.createElement("a");
      link.href = action.href;
      link.className =
        "text-xs font-semibold text-brand hover:underline pl-4 mt-0.5 inline-flex items-center gap-1";
      link.textContent = action.label;
      link.onclick = (event) => {
        event.preventDefault();
        markNotificationAsRead(n);
        dismiss();
        if (action.appointmentId) {
          state.consult.requestedId = action.appointmentId;
        }
        nav(action.view);
      };
      toast.append(link);
    }

    container.append(toast);
    animateEntry(toast, 0, 260);

    dismissTimer = setTimeout(dismiss, 10000);
  }

  function renderNotificationBadge(count) {
    document.querySelectorAll("[data-notification-badge]").forEach((badge) => {
      if (count > 0) {
        badge.textContent = String(count);
        badge.hidden = false;
      } else {
        badge.textContent = "";
        badge.hidden = true;
      }
    });
  }

  function renderNotificationPopover(popover) {
    const list = popover.querySelector("[data-notification-list]");
    if (!list) return;

    const items = state.notifications || [];
    if (!items.length) {
      list.innerHTML = '<p class="text-xs text-mute py-4 text-center">No notifications</p>';
      return;
    }

    list.replaceChildren();
    items.forEach((n) => {
      const item = document.createElement("div");
      item.className = "p-2.5 rounded-lg border border-line bg-snow/50 flex flex-col gap-1 transition-colors hover:bg-snow" + (n.read ? " opacity-75" : " border-brand/40 bg-white shadow-xs");

      const header = document.createElement("div");
      header.className = "flex items-center justify-between text-xs";
      const title = document.createElement("b");
      title.className = n.read ? "text-slate2" : "text-brand font-bold";
      title.textContent = n.title || "Notification";

      const time = document.createElement("span");
      time.className = "text-[11px] text-mute";
      time.textContent = n.createdAt ? (new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) : "";
      header.append(title, time);

      const msg = document.createElement("p");
      msg.className = "text-xs text-ink leading-snug";
      msg.textContent = n.message || "";

      item.append(header, msg);

      const action = notificationAction(n);
      if (action) {
        const link = document.createElement("a");
        link.href = action.href;
        link.className = "text-xs font-semibold text-brand hover:underline mt-0.5 inline-block";
        link.textContent = action.label;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          markNotificationAsRead(n);
          closeNotificationPopovers();
          if (action.appointmentId) {
            state.consult.requestedId = n.appointmentId;
          }
          nav(action.view);
        });
        item.append(link);
      }

      list.append(item);
    });
  }

  function renderSessions() {
    const list = document.querySelector("[data-session-list]");
    if (!list) return;

    const previousStatuses = new Map(
      Array.from(list.querySelectorAll("[data-motion-session]")).map((card) => [
        card.dataset.motionSession,
        card.dataset.motionStatus,
      ])
    );
    list.replaceChildren();

    if (!state.sessions.length) return;

    const chunks =
      Array.isArray(state.sessionWeeks) && state.sessionWeeks.length
        ? state.sessionWeeks
        : [{ label: "", from: "", to: "" }];

    chunks.forEach((chunk) => {
      const sessions = chunk.from
        ? state.sessions.filter((session) => {
            const date = String(session.sessionDate || "");
            return date >= chunk.from && date <= chunk.to;
          })
        : state.sessions;
      if (!sessions.length) return;

      if (chunk.label) {
        list.append(
          el(
            "h3",
            "col-span-full mt-1 text-xs font-bold uppercase tracking-wider text-brand",
            chunk.label +
              " · " +
              sessions.length +
              (sessions.length === 1 ? " session" : " sessions")
          )
        );
      }

      sessions.forEach((session) => {
        list.append(
          renderSessionCard(
            session,
            previousStatuses.get(String(session.sessionId))
          )
        );
      });
    });
  }

  async function refreshSessionQueues() {
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    if (!sessions.length) return;

    // The public directory already carries the live queue summary for each
    // doctor's active session. Calling the protected per-session queue
    // endpoint here would send one 401 request per card every 15 seconds
    // and overload the backend for every guest visitor.
    if (!Array.isArray(state.directory.items) || state.directory.items.length === 0) {
      await loadDoctorDirectory({ silent: true });
    }

    const summaries = new Map();
    (state.directory.items || []).forEach((doctor) => {
      if (!doctor || !doctor.sessionId) return;
      const summary = {
        nowServing: doctor.nowServing,
        nextNumber: doctor.nextNumber,
        remainingAppointments: doctor.remainingAppointments,
        maxAppointments: doctor.maxAppointments,
        status: doctor.sessionStatus,
      };
      summaries.set(doctor.sessionId, summary);
    });

    let changed = false;
    sessions.forEach((session) => {
      if (!session || !session.sessionId) return;
      const summary = summaries.get(session.sessionId);
      if (!summary) return;
      state.sessionQueues[session.sessionId] = summary;
      if (summary.remainingAppointments != null) {
        session.remainingAppointments = summary.remainingAppointments;
      }
      if (summary.status) {
        session.status = summary.status;
      }
      changed = true;
    });

    if (changed && activeView === "index") {
      preserveScroll(() => renderSessions());
    }
  }

  function startSessionQueuePolling() {
    stopSessionQueuePolling();
    void refreshSessionQueues();
    state.sessionQueuePoll = setInterval(() => {
      if (activeView === "index") {
        void refreshSessionQueues();
      }
    }, 15000);
  }

  function stopSessionQueuePolling() {
    if (state.sessionQueuePoll) {
      clearInterval(state.sessionQueuePoll);
      state.sessionQueuePoll = null;
    }
  }

  function enhanceIndexDashboard() {
    const indexView = views.find((item) => item.dataset.view === "index");
    if (!indexView) return;

    const main = indexView.querySelector("main");
    const searchForm = indexView.querySelector('form[aria-label="Search sessions"]');
    let contentGrid = searchForm ? searchForm.nextElementSibling : null;
    const sessionsSection = indexView.querySelector('[aria-label="Sessions"]');
    const bookingAside = indexView.querySelector('[aria-label="Book session"]');
    const sessionList = indexView.querySelector("[data-session-list]");
    if (!main || !searchForm || !contentGrid || !sessionsSection || !bookingAside || !sessionList) return;

    // Remove notices panel from index/dashboard if present (notices live on welcome page)
    const existingNotices = indexView.querySelector("#public-notices-panel");
    if (existingNotices && existingNotices.parentNode) {
      existingNotices.parentNode.removeChild(existingNotices);
    }
    if (contentGrid && contentGrid.id === "public-notices-panel") {
      contentGrid = searchForm.nextElementSibling;
    }
    if (!contentGrid) return;

    // Normalize legacy dashboard structure (left notices column / wrappers)
    const legacyLeft = contentGrid.querySelector("[data-dashboard-left]");
    const legacyRight = contentGrid.querySelector("[data-dashboard-right]");
    if (legacyLeft || legacyRight) {
      if (legacyRight) {
        Array.from(legacyRight.children).forEach((child) => {
          contentGrid.append(child);
        });
      }
      if (legacyLeft) legacyLeft.remove();
      if (legacyRight) legacyRight.remove();
    }
    const legacyRow = contentGrid.querySelector("[data-booking-row]");
    if (legacyRow) {
      if (bookingAside.parentNode === legacyRow) contentGrid.append(bookingAside);
      legacyRow.remove();
    }

    // Full-size dashboard layout: doctors/sessions and booking occupy the available space
    main.className = "grid gap-5 max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8";
    searchForm.className =
      "bg-white/95 backdrop-blur border border-line rounded-2xl p-4 sm:p-6 shadow-sm grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 overflow-hidden";

    contentGrid.className = "grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(380px,1fr)] items-start";

    sessionsSection.className =
      "grid gap-4 rounded-2xl border border-line bg-white/80 p-4 sm:p-5 shadow-sm";
    sessionList.className = "grid gap-4 grid-cols-1 min-h-[320px]";

    bookingAside.className =
      "bg-white border border-brand/15 rounded-2xl p-4 sm:p-6 shadow-lg grid gap-4 overflow-hidden w-full xl:sticky xl:top-24";

    if (sessionsSection.parentNode !== contentGrid) contentGrid.append(sessionsSection);
    if (bookingAside.parentNode !== contentGrid) contentGrid.append(bookingAside);
    contentGrid.append(sessionsSection, bookingAside);
  }

  function ensurePublicNoticesPanel() {
    let panel = document.getElementById("public-notices-panel");

    const welcomeView = views.find((item) => item.dataset.view === "welcome");
    if (!welcomeView) return panel || null;

    const container =
      welcomeView.querySelector("main > div.max-w-\\[1360px\\]") ||
      welcomeView.querySelector("main > div.relative") ||
      welcomeView.querySelector("main > div");

    if (!panel) {
      panel = document.createElement("section");
      panel.id = "public-notices-panel";
      panel.className = "grid gap-5 py-2";
      panel.setAttribute("aria-label", "Hospital notices");

      const header = el("div", "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between");
      const titleWrap = el("div", "grid gap-2");
      titleWrap.append(
        el("p", "text-sm font-semibold uppercase tracking-[0.18em] text-brand", "Hospital updates"),
        el("h2", "text-3xl sm:text-4xl font-bold text-ink", "Notices & announcements"),
        el("p", "text-base sm:text-lg text-slate2", "Published by hospital administration for patients and visitors.")
      );
      header.append(titleWrap);

      const status = el("p", "text-base sm:text-lg text-slate2", "Loading notices…");
      status.dataset.publicNoticesStatus = "";
      status.setAttribute("role", "status");
      const list = el("div", "grid gap-6");
      list.dataset.publicNoticesList = "";

      panel.append(header, status, list);
    } else {
      panel.className = "grid gap-5 py-2";
      panel.hidden = false;
      panel.style.display = "";
      const list = panel.querySelector("[data-public-notices-list]");
      if (list) list.className = "grid gap-6";
    }

    // Place notices prominently on the welcome page (before "How it works")
    if (container) {
      const howItWorksHeading = Array.from(container.querySelectorAll("h2")).find(
        (h) => (h.textContent || "").trim().toLowerCase() === "how it works"
      );
      const howItWorksAnchor = howItWorksHeading
        ? howItWorksHeading.closest("div.text-center") || howItWorksHeading.parentElement
        : null;
      const hero = container.children[0] || null;
      const queueCard = container.querySelector("[data-patient-queue-card]");
      const statsGrid = container.querySelector(".grid.grid-cols-3.rounded-2xl");
      let anchor = null;
      if (howItWorksAnchor && howItWorksAnchor.parentNode === container) {
        anchor = howItWorksAnchor;
      } else if (statsGrid && statsGrid.nextSibling) {
        anchor = statsGrid.nextSibling;
      }

      if (anchor) {
        if (panel.parentNode !== container || panel.nextSibling !== anchor) {
          container.insertBefore(panel, anchor);
        }
      } else if (queueCard && queueCard.nextSibling && queueCard.parentNode === container) {
        if (panel.parentNode !== container) container.insertBefore(panel, queueCard.nextSibling);
      } else if (hero && hero.nextSibling && hero.parentNode === container) {
        if (panel.parentNode !== container) container.insertBefore(panel, hero.nextSibling);
      } else if (panel.parentNode !== container) {
        container.prepend(panel);
      }
    }

    return panel;
  }

  function isHiddenPublicNotice(notice) {
    if (!notice) return true;
    const title = String(notice.title || "");
    const body = String(notice.body || "");
    const text = title + "\n" + body;
    // Hide obvious spam/junk floods (long runs of the same character), while
    // avoiding overly broad rules that could suppress legitimate notices.
    return /([A-Za-z0-9])\1{29,}/.test(text);
  }

  function renderPublicNotices(notices) {
    const panel = ensurePublicNoticesPanel();
    if (!panel) return;

    const status = panel.querySelector("[data-public-notices-status]");
    const list = panel.querySelector("[data-public-notices-list]");
    if (!list) return;

    list.className = "grid gap-6";
    list.replaceChildren();

    const published = (Array.isArray(notices) ? notices : []).filter(
      (notice) => notice && notice.published !== false && !isHiddenPublicNotice(notice)
    );

    if (!published.length) {
      if (status) {
        status.hidden = false;
        status.className = "text-base sm:text-lg text-slate2";
        status.textContent = "No notices published yet.";
      }
      return;
    }

    if (status) {
      status.hidden = false;
      status.className = "text-base sm:text-lg text-slate2";
      status.textContent = "Latest notices published by hospital administration.";
    }

    published.forEach((notice) => {
      const card = el(
        "article",
        "relative overflow-hidden rounded-lg border border-line bg-white shadow-sm transition-shadow hover:shadow-md"
      );

      const accent = el(
        "span",
        "pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-brand-d"
      );
      accent.setAttribute("aria-hidden", "true");
      card.append(accent);

      const inner = el(
        "div",
        "grid gap-3 py-5 pl-6 pr-5 sm:py-6 sm:pl-8 sm:pr-7"
      );

      const top = el(
        "div",
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2"
      );
      const badges = el("div", "flex flex-wrap items-center gap-2");

      const publishedOn = formatNoticeDate(notice.publishedAt || notice.createdAt);
      const updatedOn = formatNoticeDate(notice.updatedAt);
      const dates = el(
        "div",
        "ml-auto text-right text-xs leading-6 text-mute sm:text-sm"
      );
      if (publishedOn) dates.append(el("p", "", "Published: " + publishedOn));
      if (updatedOn && updatedOn !== publishedOn) {
        dates.append(el("p", "", "Updated: " + updatedOn));
      }
      top.append(badges, dates);
      inner.append(top);

      inner.append(
        el(
          "h3",
          "break-words text-xl font-bold leading-snug text-brand-d sm:text-[26px]",
          notice.title || "Hospital notice"
        )
      );

      if (notice.body) {
        inner.append(
          el(
            "p",
            "whitespace-pre-line break-words text-base leading-7 text-slate2 sm:text-[17px] sm:leading-8",
            notice.body
          )
        );
      }

      const footer = el(
        "div",
        "mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"
      );
      const tags = el("div", "flex flex-wrap items-center gap-2");
      tags.append(
        el(
          "span",
          "inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold bg-brand/10 text-brand-d",
          "Hospital update"
        )
      );
      tags.append(
        el(
          "span",
          "inline-flex items-center rounded bg-snow px-2.5 py-1 text-xs font-semibold text-slate2",
          "Patients & visitors"
        )
      );
      footer.append(
        tags,
        el(
          "p",
          "text-sm font-bold text-ink",
          "By " + String(notice.createdByName || "Hospital administration")
        )
      );
      inner.append(footer);

      card.append(inner);
      list.append(card);
    });
  }

  function showNoticesLoading() {
    const panel = ensurePublicNoticesPanel();
    if (!panel) return;
    const status = panel.querySelector("[data-public-notices-status]");
    const list = panel.querySelector("[data-public-notices-list]");
    if (list) list.replaceChildren();
    if (status) {
      status.hidden = false;
      status.className = "text-base sm:text-lg text-slate2";
      status.textContent = "Notices are loading…";
    }
  }

  async function loadPublicNotices(options) {
    const settings = options || {};
    if (state.publicNoticesLoaded && !settings.force) {
      renderPublicNotices(state.publicNotices);
      return;
    }

    if (!state.publicNoticesLoaded) {
      showNoticesLoading();
    }

    try {
      const notices = await MC.notices();
      state.publicNotices = Array.isArray(notices) ? notices : [];
      state.publicNoticesLoaded = true;
      renderPublicNotices(state.publicNotices);
    } catch (error) {
      state.publicNotices = [];
      state.publicNoticesLoaded = true;
      renderPublicNotices([]);
    }
  }

  // ---------------------------------------------------------------
  // Guest doctor directory
  // ---------------------------------------------------------------

  function directoryFilters() {
    const q = $("directory-q");
    const specialisation = $("directory-sp");
    const availability = $("directory-availability");
    const type = $("directory-type");

    state.directory.filters = {
      q: q ? q.value.trim().toLowerCase() : "",
      specialisationId: specialisation ? specialisation.value : "",
      availability: availability ? availability.value : "",
      consultationType: type ? type.value : "",
    };
    return state.directory.filters;
  }

  function directoryAvailability(doctor) {
    if (!doctor.available) return ["Unavailable", "red"];
    if (doctor.sessionStatus === "IN_PROGRESS") return ["Attending now", "green"];
    if (doctor.sessionStatus === "OPEN") return ["Accepting bookings", "blue"];
    if (doctor.sessionStatus === "SCHEDULED") return ["Scheduled today", "blue"];
    return ["Available", "green"];
  }

  function directoryAttendance(doctor) {
    if (!doctor.consultationType) return "Not attending right now";
    const mode = doctor.consultationType === "ONLINE" ? "Online" : "Physical";
    if (doctor.sessionStatus === "IN_PROGRESS") return mode + " · in consultation";
    if (doctor.sessionStatus === "OPEN") return mode + " · ready for patients";
    if (doctor.sessionStatus === "SCHEDULED") return mode + " · scheduled";
    return mode;
  }

  function filteredDirectoryItems() {
    const filters = state.directory.filters;

    return (state.directory.items || []).filter((doctor) => {
      if (!doctor) return false;

      if (
        filters.q &&
        !doctorDisplayName(doctor).toLowerCase().includes(filters.q) &&
        !String(doctor.specialisation || "").toLowerCase().includes(filters.q)
      ) {
        return false;
      }

      if (
        filters.specialisationId &&
        String(doctor.specialisationId || "") !== filters.specialisationId
      ) {
        return false;
      }

      if (filters.availability === "available" && !doctor.available) {
        return false;
      }
      if (filters.availability === "unavailable" && doctor.available) {
        return false;
      }

      if (
        filters.consultationType &&
        String(doctor.consultationType || "") !== filters.consultationType
      ) {
        return false;
      }

      return true;
    });
  }

  function renderDoctorDirectory() {
    const list = document.querySelector("[data-directory-list]");
    if (!list) return;

    const status = document.querySelector("[data-directory-status]");
    const items = filteredDirectoryItems();
    list.replaceChildren();

    if (status) {
      status.hidden = items.length > 0;
      status.textContent = items.length
        ? ""
        : state.directory.items.length
          ? "No doctors match these filters. Try another name or specialisation."
          : "No doctors are published yet. Please check back shortly.";
    }

    items.forEach((doctor) => {
      const card = el(
        "article",
        "bg-white border border-line rounded-xl p-5 shadow-sm grid gap-4 content-start"
      );
      card.dataset.doctorDirectoryCard = doctor.doctorId || "";

      const heading = el("div", "flex flex-wrap items-start gap-3 justify-between");
      const identity = el("div", "min-w-0 grid gap-1");
      identity.append(
        el("h3", "text-lg font-bold text-ink", doctorDisplayName(doctor))
      );
      identity.append(
        el(
          "p",
          "text-sm text-slate2",
          doctor.specialisation || "General"
        )
      );
      const availability = directoryAvailability(doctor);
      heading.append(identity, badge(availability[0], availability[1]));

      const facts = el("dl", "grid gap-3 sm:grid-cols-2 text-sm");
      const fact = (label, value) => {
        const row = el("div", "rounded-lg bg-snow p-3 grid gap-0.5");
        row.append(el("dt", "text-xs font-semibold uppercase tracking-wide text-mute", label));
        row.append(el("dd", "font-semibold text-ink", value));
        return row;
      };

      const room = doctor.roomNumber
        ? "Room " + doctor.roomNumber +
          (doctor.roomName ? " · " + doctor.roomName : "")
        : "Allocated per session";

      const hours = CLINIC_HOURS_LABEL;
      const sessionHours = doctor.startTime && doctor.endTime
        ? "Next session " + formatTime(doctor.startTime) +
          "–" + formatTime(doctor.endTime)
        : "";

      facts.append(
        fact("Room", room),
        fact("Consultation fee", money(doctor.consultationFee)),
        fact("Clinic hours", hours + (sessionHours ? " · " + sessionHours : "")),
        fact("Attending", directoryAttendance(doctor))
      );

      const queue = el(
        "div",
        "rounded-lg border border-brand/20 bg-brand/5 p-4 grid grid-cols-3 gap-3 text-center"
      );
      const queueStat = (label, value) => {
        const cell = el("div", "grid gap-1");
        cell.append(el("span", "text-[11px] font-semibold uppercase tracking-wide text-mute", label));
        cell.append(el("strong", "text-lg text-ink", value));
        return cell;
      };
      queue.append(
        queueStat("Now serving", doctor.nowServing ? "#" + doctor.nowServing : "—"),
        queueStat("Next number", doctor.nextNumber ? "#" + doctor.nextNumber : "—"),
        queueStat("Spots left", doctor.remainingAppointments != null
          ? String(doctor.remainingAppointments)
          : "—")
      );

      card.append(heading, facts, queue);

      const actions = el("div", "flex flex-wrap gap-2 pt-1");
      if (S && S.role === "CUSTOMER") {
        const sessions = el(
          "a",
          "inline-flex items-center justify-center rounded-lg min-h-10 px-4 py-2 text-sm font-semibold bg-brand text-white hover:bg-brand-d",
          "Book a session"
        );
        sessions.href = "#index";
        if (doctor.doctorId) sessions.dataset.directoryDoctor = doctor.doctorId;
        actions.append(sessions);
      } else if (!S) {
        const login = el(
          "a",
          "inline-flex items-center justify-center rounded-lg min-h-10 px-4 py-2 text-sm font-semibold bg-peach text-white hover:bg-peach-d",
          "Log in to book"
        );
        login.href = "#login";
        const register = el(
          "a",
          "inline-flex items-center justify-center rounded-lg min-h-10 px-4 py-2 text-sm font-semibold border border-brand text-brand hover:bg-snow",
          "Register"
        );
        register.href = "#register";
        if (doctor.doctorId) {
          login.dataset.directoryDoctor = doctor.doctorId;
          register.dataset.directoryDoctor = doctor.doctorId;
        }
        actions.append(login, register);
      }
      card.append(actions);
      list.append(card);
    });
  }

  async function loadDoctorDirectory(options) {
    const settings = options || {};
    if (state.directory.loading && !settings.force) return;

    const status = document.querySelector("[data-directory-status]");
    state.directory.loading = true;

    if (!settings.silent && status) {
      status.hidden = false;
      status.textContent = "Loading hospital doctors…";
      status.classList.remove("text-bad");
    }

    try {
      const list = await MC.doctorDirectory();
      if (!Array.isArray(list)) throw new Error("Unexpected response");

      state.directory.items = list;
      state.directory.loaded = true;
      if (status) status.classList.remove("text-bad");
      preserveScroll(renderDoctorDirectory);
    } catch (error) {
      state.directory.items = [];
      renderDoctorDirectory();
      if (status) {
        status.hidden = false;
        status.classList.add("text-bad");
        status.textContent = error && error.message
          ? error.message
          : "Unable to load the doctor directory right now.";
      }
    } finally {
      state.directory.loading = false;
    }
  }

  function startDirectoryPolling() {
    stopDirectoryPolling();
    void loadDoctorDirectory();
    state.directory.poll = setInterval(() => {
      if (activeView === "doctors" || activeView === "index") {
        void loadDoctorDirectory({ silent: true });
      }
    }, 15000);
  }

  function stopDirectoryPolling() {
    if (state.directory.poll) {
      clearInterval(state.directory.poll);
      state.directory.poll = null;
    }
  }

  function renderSessionCard(session, previousStatus) {
    const card = el(
      "article",
      "bg-white border border-line rounded-lg p-4 sm:p-5 shadow-sm [&>h2]:mb-3 grid gap-4"
    );
    const currentStatus = session.status || "";
    card.dataset.sessionCard = session.sessionId;
    card.dataset.motionSession = String(session.sessionId);
    card.dataset.motionStatus = currentStatus;

    const header = el(
      "div",
      "flex flex-wrap items-start gap-3 justify-between"
    );
    const names = el("div", "min-w-0");
    names.append(el("h2", "", doctorName(session)));
    names.append(
      el(
        "p",
        "text-mute",
        [
          session.specialisation || "General",
          session.roomNumber
            ? "Room " + session.roomNumber
            : "Video-free chat room",
        ].join(" · ")
      )
    );
    const typeBadge = badge(
      session.consultationType === "ONLINE" ? "Online" : "Physical",
      "blue"
    );
    const statusBadge = badge(
      session.status === "OPEN" ? "Available" : session.status === "IN_PROGRESS" ? "In progress" : session.status === "COMPLETED" ? "Completed" : session.status === "CANCELLED" ? "Cancelled" : "Not available",
      session.status === "OPEN" ? "green" : session.status === "IN_PROGRESS" ? "orange" : "slate"
    );
    statusBadge.classList.add("mc-motion-status");
    header.append(names, typeBadge, statusBadge);
    if (previousStatus && previousStatus !== currentStatus) {
      animateStateChange(statusBadge);
    }

    const meta = el("div", "flex flex-wrap items-center gap-3");
    meta.append(
      el(
        "span",
        "",
        sessionWindowLabel(session)
      ),
      el("span", "", formatDate(session.sessionDate)),
      el("span", "text-xs text-mute", sessionCapacityLabel(session)),
      el("b", "", money(session.feeLkr))
    );

    const queue = state.sessionQueues[session.sessionId] || null;
    const liveRemaining = queue && queue.remainingAppointments != null
      ? Math.max(0, Number(queue.remainingAppointments) || 0)
      : Math.max(0, Number(session.remainingAppointments) || 0);
    const liveCapacity = queue && queue.maxAppointments != null
      ? Math.max(1, Number(queue.maxAppointments) || 1)
      : Math.max(1, Number(session.maxAppointments) || 1);
    const percent = Math.round((liveRemaining / liveCapacity) * 100);

    const queueWrap = el("div", "flex flex-col items-start gap-1.5 text-sm");
    queueWrap.dataset.sessionQueueInfo = "";
    const nowServing = queue && queue.nowServing != null ? Number(queue.nowServing) : null;
    const nextNumber = queue && queue.nextNumber != null ? Number(queue.nextNumber) : null;
    const hasNowServing = nowServing != null && Number.isFinite(nowServing) && nowServing > 0;
    const hasNextNumber = nextNumber != null && Number.isFinite(nextNumber) && nextNumber > 0;

    if (session.status === "COMPLETED") {
      queueWrap.append(
        el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200", "Session completed")
      );
    } else if (session.status === "CANCELLED") {
      queueWrap.append(
        el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200", "Session cancelled")
      );
    } else if (hasNowServing) {
      const pill = el(
        "span",
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300"
      );
      const dot = el("span", "w-2 h-2 rounded-full bg-amber-500 animate-pulse", "");
      dot.setAttribute("aria-hidden", "true");
      pill.append(dot, document.createTextNode("Now serving #" + nowServing));
      queueWrap.append(pill);
      if (hasNextNumber && nextNumber !== nowServing) {
        queueWrap.append(
          el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200", "Next #" + nextNumber)
        );
      }
    } else if (session.status === "IN_PROGRESS") {
      queueWrap.append(
        el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200", hasNextNumber ? "In progress · Next #" + nextNumber : "Queue in progress")
      );
    } else if (session.status === "OPEN" || session.status === "SCHEDULED") {
      queueWrap.append(
        el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200", hasNextNumber ? "Next queue #" + nextNumber : "Queue not started")
      );
    } else if (hasNextNumber) {
      queueWrap.append(
        el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200", "Next #" + nextNumber)
      );
    } else {
      queueWrap.append(el("span", "text-xs text-mute", "Live queue unavailable"));
    }

    // Place queue numbers below the availability/status tag (not below time)
    const statusCol = el("div", "flex flex-col items-end gap-2");
    const badgeRow = el("div", "flex flex-wrap items-center justify-end gap-2");
    badgeRow.append(typeBadge, statusBadge);
    statusCol.append(badgeRow, queueWrap);
    header.append(names, statusCol);

    const capacityWrap = el("div");
    capacityWrap.dataset.sessionCapacity = "";
    const capacityLabels = el(
      "div",
      "flex flex-wrap items-center gap-3 justify-between text-xs"
    );
    capacityLabels.append(
      el("span", "live", "Spots left (live)"),
      el("b", "", liveRemaining + " of " + liveCapacity)
    );

    const bar = el("div", liveRemaining === 0 ? "bar w" : "bar");
    const fill = el("i");
    fill.style.width = percent + "%";
    bar.append(fill);
    capacityWrap.append(capacityLabels, bar);

    const footer = el(
      "div",
      "flex flex-wrap items-center gap-3 justify-between"
    );
    const deadline = bookingDeadline(session);
    const closed = bookingClosed(session);
    const breakNow = isClinicBreakNow();
    const full = liveRemaining <= 0;

    footer.append(
      el(
        "span",
        "text-xs text-mute",
        breakNow
          ? "Number issuing paused · 11:00–13:00 break"
          : full
            ? "Session full"
            : closed
              ? "Booking closed for this session"
              : "Booking closes " +
              (deadline
                ? deadline.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: TZ,
                  }) +
                  " (" +
                  (session.consultationType === "PHYSICAL" ? "1 h" : "30 min") +
                  " before)"
                : "before the session")
      )
    );

    const available = session.status === "OPEN";
    const book = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed bg-peach border-peach text-white hover:bg-peach-d min-h-10 px-3.5 py-2",
      !available ? "Not available" : full ? "No spots left" : closed ? "Booking closed" : breakNow ? "Break · no numbers" : "Book"
    );
    book.type = "button";
    book.dataset.bookSession = session.sessionId;
    book.disabled = !available || full || closed || breakNow;
    footer.append(book);

    card.append(header, meta, capacityWrap, footer);
    return card;
  }

  /**
   * A booking confirmation belongs to the account that made it. Clear the
   * whole booking panel when that account logs out or expires so a later
   * visitor never sees another patient's reference, queue number or payment.
   */
  function clearBookingPanel() {
    state.booking = null;
    state.selectedSession = null;
    state.bookingDate = "";

    const title = document.querySelector("[data-booking-title]");
    if (title) title.textContent = "Book a session";

    const meta = document.querySelector("[data-booking-meta]");
    if (meta) meta.textContent = "Choose a session to continue.";

    const form = document.querySelector("[data-booking-form]");
    if (form) form.hidden = true;

    const success = document.querySelector("[data-booking-success]");
    if (success) success.hidden = true;

    const reason = $("index-rs");
    if (reason) reason.value = "";

    const bookingDate = $("booking-date");
    if (bookingDate) bookingDate.value = "";

    const period = $("index-bp");
    if (period) period.value = "";

    const note = document.querySelector("[data-booking-note]");
    if (note) {
      note.textContent = "To finish booking, please log in or create a free account.";
    }

    const error = document.querySelector("[data-booking-error]");
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }

    const reference = document.querySelector("[data-booking-reference]");
    if (reference) reference.textContent = "—";
    const confirmedDate = document.querySelector("[data-booking-date-confirmed]");
    if (confirmedDate) confirmedDate.textContent = "—";
    const number = document.querySelector("[data-booking-number]");
    if (number) number.textContent = "—";
    const created = document.querySelector("[data-booking-created]");
    if (created) created.textContent = "—";
    const estimate = document.querySelector("[data-booking-estimate]");
    if (estimate) estimate.textContent = "—";
    const slot = document.querySelector("[data-booking-slot]");
    if (slot) slot.textContent = "—";
    const message = document.querySelector("[data-booking-message]");
    if (message) message.textContent = "";

    const pay = document.querySelector("[data-booking-pay]");
    if (pay) {
      pay.hidden = true;
      pay.disabled = false;
      delete pay.dataset.bookingPay;
    }

    const goButton = document.querySelector("[data-booking-goto]");
    if (goButton) delete goButton.dataset.bookingGoto;
  }

  function selectSession(session, options) {
    if (!session) return;

    const settings = options || {};
    state.selectedSession = session;
    state.bookingDate = settings.date || session.sessionDate || "";
    state.booking = null;

    const title = document.querySelector("[data-booking-title]");
    const meta = document.querySelector("[data-booking-meta]");
    const form = document.querySelector("[data-booking-form]");
    const success = document.querySelector("[data-booking-success]");
    const note = document.querySelector("[data-booking-note]");
    const reason = $("index-rs");
    const bookingDateInput = $("booking-date");
    const periodSelect = $("index-bp");
    const error = document.querySelector("[data-booking-error]");

    if (title) title.textContent = "Book: " + doctorName(session);
    if (meta) {
      const closeMinutes = session.consultationType === "PHYSICAL"
        ? PHYSICAL_BOOKING_CLOSE_MINUTES
        : ONLINE_BOOKING_CLOSE_MINUTES;
      meta.textContent = [
        formatDate(session.sessionDate),
        sessionWindowLabel(session),
        "Book by " + closeMinutes + " min before start",
        session.consultationType === "ONLINE" ? "Online" : "Physical",
        session.roomNumber ? "Room " + session.roomNumber : "Chat room",
        money(session.feeLkr),
      ].filter(Boolean).join(" · ");
    }

    if (form) form.hidden = false;
    if (success) success.hidden = true;
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }

    const breakNow = isClinicBreakNow();
    if (note) {
      note.textContent = breakNow
        ? "Number issuing is paused during the 11:00–13:00 break. Please return outside the break."
        : S && S.role === "CUSTOMER"
          ? "Your queue number is allocated as soon as you confirm."
          : S
            ? "Only patient accounts can book appointments."
            : "You will be asked to log in, then returned to this booking.";
    }

    if (bookingDateInput) bookingDateInput.value = state.bookingDate;
    if (reason && settings.reason) reason.value = settings.reason;
    if (periodSelect) {
      periodSelect.value = settings.period || sessionPeriodValue(session);
    }

    const confirm = document.querySelector("[data-booking-confirm]");
    if (confirm) {
      confirm.disabled = breakNow || Boolean(S && S.role !== "CUSTOMER");
    }

    const panel = document.querySelector('[aria-label="Book session"]');
    if (panel && panel.scrollIntoView) {
      panel.scrollIntoView({ block: "nearest" });
    }

    if (reason) reason.focus({ preventScroll: true });
  }

  function applyBookingDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

    clearBookingPanel();
    state.bookingDate = date;

    const form = document.querySelector("[data-booking-form]");
    if (form) form.hidden = false;

    const bookingDateInput = $("booking-date");
    if (bookingDateInput) bookingDateInput.value = date;

    const confirm = document.querySelector("[data-booking-confirm]");
    if (confirm) confirm.disabled = true;

    const title = document.querySelector("[data-booking-title]");
    if (title) title.textContent = "Book a session";

    const meta = document.querySelector("[data-booking-meta]");
    if (meta) meta.textContent = formatDate(date);

    const note = document.querySelector("[data-booking-note]");
    if (note) {
      note.textContent = "Choose a session on " + formatDate(date) + ".";
    }

    const searchDate = $("index-dt");
    if (searchDate) searchDate.value = date;

    state.sessionsLoaded = false;
    void loadSessions();
  }

  async function confirmBooking() {
    const session = state.selectedSession;
    const error = document.querySelector("[data-booking-error]");
    const reasonInput = $("index-rs");
    const bookingDateInput = $("booking-date");
    const periodInput = $("index-bp");
    const button = document.querySelector("[data-booking-confirm]");

    if (!session) return;

    const reason = reasonInput ? reasonInput.value.trim() : "";
    const bookingDate = bookingDateInput ? bookingDateInput.value : "";
    const period = periodInput ? periodInput.value : "";

    if (!bookingDate || bookingDate !== session.sessionDate) {
      if (error) {
        error.hidden = false;
        error.textContent =
          "The selected date does not match this session. Choose a session on " +
          formatDate(bookingDate || session.sessionDate) + ".";
      }
      return;
    }

    if (reason.length < 5) {
      if (error) {
        error.hidden = false;
        error.textContent = "Please tell us a little about why you’re visiting.";
      }
      return;
    }

    if (reason.length > MAX_REASON_LENGTH) {
      if (error) {
        error.hidden = false;
        error.textContent =
          "Please keep the reason under " + MAX_REASON_LENGTH + " characters.";
      }
      return;
    }

    if (!period) {
      if (error) {
        error.hidden = false;
        error.textContent = "Please choose Morning or Evening for this booking.";
      }
      return;
    }

    if (period !== sessionPeriodValue(session)) {
      if (error) {
        error.hidden = false;
        error.textContent =
          "The selected period does not match this session. " +
          periodLabel(session.startTime) + " is the available period.";
      }
      return;
    }

    if (isClinicBreakNow()) {
      if (error) {
        error.hidden = false;
        error.textContent =
          "No appointment numbers are issued during the 11:00–13:00 break.";
      }
      return;
    }

    if (!S) {
      saveIntent(session, reason, period, bookingDate);
      nav("login");
      return;
    }

    if (S.role !== "CUSTOMER") {
      if (error) {
        error.hidden = false;
        error.textContent = "Only patient accounts can book appointments.";
      }
      return;
    }

    // BR-04: One active appointment per patient per session
    const existingActive = (state.appointments || []).find(
      (a) => a.sessionId === session.sessionId && ["BOOKED", "CHECKED_IN", "ARRIVED", "IN_CONSULTATION"].includes(a.status)
    );
    if (existingActive) {
      if (error) {
        error.hidden = false;
        error.textContent = "You already have an active appointment (#" + existingActive.appointmentNumber + ") in this session (BR-04). A patient can have only one active appointment per session.";
      }
      return;
    }

    // BR-05: Booking deadline cutoff (1h physical, 30m online)
    if (bookingClosed(session)) {
      if (error) {
        error.hidden = false;
        error.textContent = "Booking has closed for this session (BR-05: closes 1 hour before physical sessions and 30 minutes before online sessions).";
      }
      return;
    }

    // BR-03: Session capacity check
    const remaining = Number(
      session.remainingAppointments ??
        session.availableAppointments ??
        session.remainingCapacity ??
        1
    );
    if (remaining <= 0) {
      if (error) {
        error.hidden = false;
        error.textContent = "This session is fully booked (BR-03).";
      }
      return;
    }

    if (button) button.disabled = true;

    try {
      const appointment = await MC.bookAppointment(
        session.sessionId,
        reason,
        period
      );

      state.booking = appointment;
      showBookingSuccess(appointment, session);
      clearIntent();
      await Promise.allSettled([
        loadAppointments(),
        loadSessions(),
      ]);
    } catch (problem) {
      if (error) {
        error.hidden = false;
        error.textContent = problem.message;
      }
    } finally {
      if (button) button.disabled = false;
    }
  }

  function showBookingSuccess(appointment, session) {
    const form = document.querySelector("[data-booking-form]");
    const success = document.querySelector("[data-booking-success]");
    const wasHidden = success ? success.hidden : true;
    const reference = document.querySelector("[data-booking-reference]");
    const confirmedDate = document.querySelector("[data-booking-date-confirmed]");
    const number = document.querySelector("[data-booking-number]");
    const created = document.querySelector("[data-booking-created]");
    const estimate = document.querySelector("[data-booking-estimate]");
    const slot = document.querySelector("[data-booking-slot]");
    const message = document.querySelector("[data-booking-message]");
    const pay = document.querySelector("[data-booking-pay]");

    if (form) form.hidden = true;
    if (success) success.hidden = false;
    if (reference) reference.textContent = referenceOf(appointment.bookingReference);
    if (confirmedDate) {
      confirmedDate.textContent = formatDate(
        appointment.sessionDate || (session && session.sessionDate)
      );
    }
    if (number) number.textContent = "#" + appointment.appointmentNumber;
    if (created) {
      created.textContent = appointment.bookedAt
        ? formatInstant(appointment.bookedAt)
        : "just now";
    }
    if (estimate) {
      estimate.textContent = appointment.estimatedConsultationTime
        ? formatDateTime(appointment.estimatedConsultationTime)
        : session
          ? formatTime(session.startTime)
          : "—";
    }
    if (slot) {
      const allocation = appointmentSlot(appointment);
      slot.textContent =
        allocation.range +
        " · finishes " +
        allocation.finish +
        " (" +
        allocation.minutes +
        " min)";
    }

    if (message) {
      message.textContent =
        appointment.paymentStatus === "PAID"
          ? "Your payment is recorded. The doctor can start your consultation when you check in."
          : "Pay now so the doctor can start your consultation when you check in.";
    }

    if (pay) {
      pay.dataset.bookingPay = appointment.appointmentId;
      pay.hidden = appointment.paymentStatus === "PAID";
    }

    const goButton = document.querySelector("[data-booking-goto]");
    if (goButton) goButton.dataset.bookingGoto = "1";
    if (wasHidden) animateEntry(success, 0, 360);
  }

  async function payBooking(appointmentId) {
    const pay = document.querySelector("[data-booking-pay]");
    const message = document.querySelector("[data-booking-message]");

    if (pay) pay.disabled = true;

    try {
      await MC.pay(appointmentId, "CARD");
      if (message) message.textContent = "Paid by card. You’re ready when the doctor calls you.";
      if (pay) pay.hidden = true;
      await Promise.allSettled([loadAppointments(), refreshPatientQueue()]);
    } catch (error) {
      if (message) message.textContent = error.message;
      if (pay) pay.disabled = false;
    }
  }

  // ---------------------------------------------------------------
  // Patient appointments and queue
  // ---------------------------------------------------------------

  function hideQueue() {
    document.querySelectorAll("[data-patient-queue-card]").forEach((card) => {
      card.hidden = true;
    });
  }

  function activeAppointment(list) {
    const today = todayISO();

    return (list || [])
      .filter(
        (item) =>
          item &&
          item.sessionDate === today &&
          item.appointmentNumber &&
          ["BOOKED", "CHECKED_IN", "ARRIVED", "IN_CONSULTATION"].includes(item.status)
      )
      .sort((a, b) =>
        String(a.sessionStartTime || "").localeCompare(
          String(b.sessionStartTime || "")
        )
      )[0];
  }

  function fillPatientProfile(profile) {
    if (!profile) return;
    const values = {
      "profile-first": profile.firstName,
      "profile-last": profile.lastName,
      "profile-nic": profile.nic,
      "profile-dob": profile.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : "",
      "profile-gender": profile.gender,
      "profile-phone": profile.phone,
      "profile-address": profile.address,
    };

    Object.entries(values).forEach(([id, value]) => {
      const field = $(id);
      if (!field) return;
      const text = value == null ? "" : String(value);
      if (field.tagName === "SELECT" && text && !Array.from(field.options).some((option) => option.value === text)) {
        const option = el("option", "", text);
        option.value = text;
        field.append(option);
      }
      field.value = text;
    });

    const fullName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .map(String)
      .join(" ")
      .trim();
    const initials = [profile.firstName, profile.lastName]
      .map((part) => (part ? String(part).trim().charAt(0) : ""))
      .join("")
      .toUpperCase();
    const avatar = document.querySelector("[data-profile-initials]");
    if (avatar && initials) avatar.textContent = initials.slice(0, 2);
    const nameNode = document.querySelector("[data-profile-name]");
    if (nameNode) nameNode.textContent = fullName || "Your profile";
    const emailNode = document.querySelector("[data-profile-email]");
    if (emailNode) emailNode.textContent = S && S.email ? S.email : "";
  }

  async function loadPatientProfile() {
    const status = document.querySelector("[data-profile-status]");

    try {
      const profile = await MC.myProfile();
      state.profile = profile || null;
      fillPatientProfile(profile);
      if (profile) setStatus(status, "");
      else setStatus(status, "No patient profile has been created for this account yet.", true);
    } catch (error) {
      setStatus(status, error.message || "Your profile could not be loaded.", true);
    }
  }

  async function savePatientProfile(form) {
    const status = document.querySelector("[data-profile-status]");
    const button = form && form.querySelector("[data-profile-submit]");
    const payload = {
      firstName: $("profile-first") ? $("profile-first").value.trim() : "",
      lastName: $("profile-last") ? $("profile-last").value.trim() : "",
      nic: $("profile-nic") ? $("profile-nic").value.trim() : "",
      dateOfBirth: $("profile-dob") ? $("profile-dob").value : "",
      gender: $("profile-gender") ? $("profile-gender").value : "",
      phone: $("profile-phone") ? $("profile-phone").value.trim() : "",
      address: $("profile-address") ? $("profile-address").value.trim() : "",
    };

    if (button) button.disabled = true;
    try {
      const saved = await MC.updateMyProfile(payload);
      state.profile = saved || payload;
      if (saved) fillPatientProfile(saved);
      setStatus(status, "Your profile has been updated.");
    } catch (error) {
      setStatus(status, error.message || "Your profile could not be saved.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function loadAppointments() {
    if (!S || S.role !== "CUSTOMER") {
      hideQueue();
      return;
    }

    const status = document.querySelector("[data-appointments-status]");
    const tbody = document.querySelector("[data-appointments-list]");
    const empty = document.querySelector("[data-appointments-empty]");

    if (status) {
      status.hidden = false;
      status.classList.remove("hidden", "text-bad");
      status.textContent = "Appointments are loading…";
    }

    try {
      const list = await MC.myAppointments();
      if (!Array.isArray(list)) throw new Error("Unexpected response");

      state.appointments = list;
      state.appointmentsLoaded = true;
      renderAppointments(list);

      const acceptedAppt = list.find((a) => a.acceptanceStatus === "ACCEPTED" && ["BOOKED", "CHECKED_IN", "ARRIVED", "IN_CONSULTATION"].includes(a.status));
      let banner = document.querySelector("[data-accepted-banner]");
      if (acceptedAppt) {
        if (!banner) {
          banner = el("div", "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm flex items-center gap-3 mb-4");
          banner.setAttribute("data-accepted-banner", "");
          const apptView = document.querySelector("section[data-view='appointments'] main");
          if (apptView) apptView.prepend(banner);
        }
        const when = [formatDate(acceptedAppt.sessionDate), formatTime(acceptedAppt.sessionStartTime)].filter(Boolean).join(" at ");
        banner.innerHTML = '<span class="text-emerald-600 font-bold text-base">✓</span> <span><b>Appointment Confirmed:</b> The doctor has accepted your appointment on ' + escapeHtml(when) + '. Make sure to be ready on time.</span>';
        banner.hidden = false;
      } else if (banner) {
        banner.hidden = true;
      }
      if (status) {
        status.hidden = true;
        status.classList.add("hidden");
      }
      if (empty) {
        empty.hidden = list.length > 0;
        empty.classList.toggle("hidden", list.length > 0);
      }
      await refreshPatientQueue(list);
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }

      if (status) {
        status.hidden = false;
        status.classList.remove("hidden");
        status.classList.add("text-bad");
        status.textContent = error.message;
      }
      if (tbody) tbody.replaceChildren();
      if (empty) empty.hidden = true;
      hideQueue();
    }
  }

  function renderAppointments(list) {
    const tbody = document.querySelector("[data-appointments-list]");
    if (!tbody) return;

    const previousStates = new Map(
      Array.from(tbody.querySelectorAll("tr[data-motion-appointment]")).map(
        (row) => [
          row.dataset.motionAppointment,
          {
            status: row.dataset.motionStatus,
            acceptance: row.dataset.motionAcceptance,
            payment: row.dataset.motionPayment,
          },
        ]
      )
    );
    tbody.replaceChildren();

    list.forEach((appointment) => {
      const row = document.createElement("tr");
      const appointmentId = String(appointment.appointmentId || "");
      const previousState = previousStates.get(appointmentId);
      row.dataset.motionAppointment = appointmentId;
      row.dataset.motionStatus = appointment.status || "";
      row.dataset.motionAcceptance = appointment.acceptanceStatus || "";
      row.dataset.motionPayment = appointment.paymentStatus || "";

      const allocation = appointmentSlot(appointment);
      const cells = [
        [referenceOf(appointment.bookingReference), "Booking ref"],
        [appointment.doctorName ? doctorName(appointment) : "—", "Doctor"],
        [
          [
            appointment.appointmentNumber != null
              ? "Queue #" + appointment.appointmentNumber
              : "",
            [
              formatDate(appointment.sessionDate),
              formatTime(appointment.sessionStartTime),
            ]
              .filter(Boolean)
              .join(" "),
            appointment.bookedAt
              ? "Booked " + formatInstant(appointment.bookedAt)
              : "",
            allocation.range !== "—"
              ? "Slot " + allocation.range + " · finishes " + allocation.finish
              : "",
          ].filter(Boolean),
          "When",
        ],
        [
          appointment.consultationType === "ONLINE" ? "Online" : "Physical",
          "Visit type",
        ],
      ];

      cells.forEach(([value, label]) => {
        const cell = document.createElement("td");
        cell.dataset.label = label;
        if (Array.isArray(value)) {
          value.forEach((line, index) => {
            cell.append(
              el(
                "div",
                index === 0
                  ? "font-semibold text-ink"
                  : "text-xs text-mute",
                line
              )
            );
          });
        } else {
          cell.textContent = String(value);
        }
        row.append(cell);
      });

      const statusCell = document.createElement("td");
      statusCell.dataset.label = "Status";
      const statusWrap = document.createElement("div");
      statusWrap.className = "flex flex-col gap-1 items-start";
      statusWrap.append(appointmentBadge(appointment.status));
      if (appointment.acceptanceStatus === "ACCEPTED") {
        statusWrap.append(badge("Doctor Accepted", "green"));
      } else if (appointment.status === "BOOKED") {
        statusWrap.append(badge("Pending Acceptance", "orange"));
      }
      statusCell.append(statusWrap);
      row.append(statusCell);
      if (
        previousState &&
        (previousState.status !== row.dataset.motionStatus ||
          previousState.acceptance !== row.dataset.motionAcceptance)
      ) {
        animateStateChange(statusWrap);
      }

      const paymentCell = document.createElement("td");
      paymentCell.dataset.label = "Payment";
      paymentCell.textContent =
        appointment.paymentStatus === "PAID"
          ? "Paid" +
            (appointment.paymentMethod
              ? " · " +
                appointment.paymentMethod.charAt(0) +
                appointment.paymentMethod.slice(1).toLowerCase()
              : "")
          : appointment.paymentStatus === "REFUNDED"
            ? "Refunded"
            : "Not paid yet";
      if (
        previousState &&
        previousState.payment !== row.dataset.motionPayment
      ) {
        animateStateChange(paymentCell);
      }
      row.append(paymentCell);

      const actions = document.createElement("td");
      actions.dataset.label = "Actions";
      actions.className = "flex flex-wrap items-center justify-end gap-2";

      if (
        appointment.paymentStatus !== "PAID" &&
        ["BOOKED"].includes(appointment.status) &&
        appointment.acceptanceStatus === "ACCEPTED"
      ) {
        actions.append(
          actionButton(
            "Pay " + money(appointment.consultationFeeLkr),
            "bg-brand border-brand text-white hover:bg-brand-d",
            "pay-appointment",
            appointment.appointmentId
          )
        );
      }

      const isPhysical = appointment.consultationType === "PHYSICAL";
      if (
        isPhysical &&
        appointment.status === "BOOKED" &&
        appointment.paymentStatus === "PAID" &&
        appointment.acceptanceStatus === "ACCEPTED" &&
        !appointment.checkedInAt
      ) {
        actions.append(
          actionButton(
            "Check in",
            "bg-white border-line text-slate2 hover:bg-snow",
            "checkin-appointment",
            appointment.appointmentId
          )
        );
      }

      if (appointment.status === "CHECKED_IN") {
        actions.append(
          el(
            "span",
            "text-xs font-semibold text-emerald-800",
            "Checked in · awaiting arrival"
          )
        );
      }

      if (
        appointment.acceptanceStatus === "ACCEPTED" ||
        ["IN_CONSULTATION", "COMPLETED", "BOOKED", "CHECKED_IN", "ARRIVED"].includes(appointment.status)
      ) {
        const online = appointment.consultationType === "ONLINE";
        const consultLabel =
          appointment.status === "COMPLETED"
            ? "Summary & feedback"
            : online && appointment.status === "IN_CONSULTATION"
              ? "Join online consultation"
              : online
                ? "Open consultation room"
                : "Open chat";
        const consultButton = actionButton(
          consultLabel,
          "bg-white border-brand text-brand hover:bg-snow font-semibold",
          "open-consult",
          appointment.appointmentId
        );
        if (online && appointment.status === "IN_CONSULTATION") {
          consultButton.setAttribute("data-join-online", appointment.appointmentId);
        }
        actions.append(consultButton);
      }

      // Demo rule: patients can cancel any of their own appointments.
      // The confirmation dialog collects the reason before calling the API.
      const cancelButton = actionButton(
        "Cancel",
        "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100",
        "cancel-appointment",
        appointment.appointmentId
      );
      const cancelWrap = el("span", "inline-flex", "");
      cancelWrap.title = appointment.status === "CANCELLED"
        ? "This appointment is already cancelled"
        : "Cancel this appointment";
      cancelWrap.append(cancelButton);
      actions.append(cancelWrap);

      // Cleared rows disappear only from this participant's history view.
      // Active appointments can never be cleared.
      if (
        ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(appointment.status)
      ) {
        actions.append(
          actionButton(
            "Clear from history",
            "bg-white border-line text-slate2 hover:bg-snow",
            "clear-appointment",
            appointment.appointmentId
          )
        );
      }

      row.append(actions);
      tbody.append(row);
    });
  }

  function actionButton(label, tone, name, id) {
    const button = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed min-h-9 sm:min-h-8 px-2.5 py-1 text-xs " +
        tone,
      label
    );
    button.type = "button";
    // Firefox rejects hyphenated DOMStringMap keys, and several action
    // names such as "checkin-appointment" contain a hyphen. Convert
    // camelCase names the same way dataset would.
    button.setAttribute(
      "data-" + name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase()),
      id
    );
    return button;
  }

  async function refreshPatientQueue(knownList) {
    if (!S || S.role !== "CUSTOMER") {
      hideQueue();
      return;
    }

    let list = knownList;

    if (!list) {
      try {
        list = state.appointments.length
          ? state.appointments
          : await MC.myAppointments();
        state.appointments = list;
      } catch (error) {
        if (error.status === 401) handleSessionExpired();
        hideQueue();
        return;
      }
    }

    const current = activeAppointment(list);

    if (!current) {
      hideQueue();
      unsubscribeQueue();
      return;
    }

    let summary = null;

    try {
      summary = await MC.sessionQueue(current.sessionId);
    } catch {
      summary = null;
    }

    if (!S || S.role !== "CUSTOMER") return;

    const number = current.appointmentNumber;

    document.querySelectorAll("[data-patient-queue-card]").forEach((card) => {
      const wasHidden = card.hidden;
      setMotionText(
        card.querySelector("[data-queue-headline]"),
        "You are number " + number
      );

      setMotionText(card.querySelector("[data-queue-number]"), String(number));

      const allocation = appointmentSlot(current);
      const parts = [
        doctorName(current),
        formatTime(current.sessionStartTime)
          ? "today at " + formatTime(current.sessionStartTime)
          : "",
        APPT_STATUS[current.status]
          ? APPT_STATUS[current.status][0]
          : titleCase(current.status),
        "Your slot " + allocation.range + " · finishes " + allocation.finish,
      ].filter(Boolean);

      if (summary && summary.nowServing) {
        parts.push("Now serving #" + summary.nowServing);
        const ahead = Math.max(0, number - summary.nowServing);
        parts.push(
          ahead === 0 ? "You’re next" : ahead + (ahead === 1 ? " person ahead" : " people ahead")
        );
      } else if (current.status === "IN_CONSULTATION") {
        parts.push("Your consultation is in progress");
      }

      const details = card.querySelector("[data-queue-details]");
      const nextDetails = parts.join(" · ");
      if (details && details.textContent !== nextDetails) {
        const changed = Boolean(details.textContent);
        details.textContent = nextDetails;
        if (changed) animateStateChange(details);
      }

      card.hidden = false;
      if (wasHidden) animateEntry(card, 0, 320);
    });

    subscribeQueue(current.sessionId);
  }

  function subscribeQueue(sessionId) {
    if (!sessionId) return;

    const destination = "/topic/sessions/" + sessionId + "/queue";

    if (state.queueSub && state.queueSub.destination === destination) return;

    unsubscribeQueue();

    state.queueSub = subscribe(
      "patient-queue",
      destination,
      (payload) => {
        if (!payload) return;

        const cards = document.querySelectorAll("[data-patient-queue-card]");
        cards.forEach((card) => {
          const details = card.querySelector("[data-queue-details]");
          if (!details) return;
          if (payload.nowServing) {
            const current = activeAppointment(state.appointments);
            const number = current ? current.appointmentNumber : null;
            const base = details.textContent.split(" · Now serving")[0];
            const nextDetails =
              base +
              " · Now serving #" +
              payload.nowServing +
              (number
                ? " · " +
                  (Math.max(0, number - payload.nowServing) === 0
                    ? "You’re next"
                    : Math.max(0, number - payload.nowServing) +
                      (Math.max(0, number - payload.nowServing) === 1
                        ? " person ahead"
                        : " people ahead"))
                : "");
            if (details.textContent !== nextDetails) {
              details.textContent = nextDetails;
              animateStateChange(details);
            }
          }
        });
      }
    );
  }

  function unsubscribeQueue() {
    if (state.queueSub) {
      unsubscribe("patient-queue");
      state.queueSub = null;
    }
  }

  function subscribeSessionsCatalogue() {
    if (!S || state.sessionsSub) return;

    state.sessionsSub = subscribe(
      "sessions-catalogue",
      "/topic/sessions",
      (payload) => {
        if (!payload || !state.sessions.length) return;
        const session = state.sessions.find(
          (item) => item.sessionId === payload.sessionId
        );
        if (!session) return;
        session.remainingAppointments = payload.remainingAppointments;
        session.status = payload.status;
        preserveScroll(() => renderSessions());
      }
    );
  }

  async function payAppointment(appointmentId, button) {
    if (!appointmentId) return;
    if (button) button.disabled = true;

    try {
      await MC.pay(appointmentId, "CARD");
      setAppMessage("");
      invalidateManagerDashboard();
      await loadAppointments();
      if (state.manager.receptionLoaded) {
        await loadManagerReception({ silent: true });
      }
      if (S && S.role === "MANAGER") {
        void loadManagerDashboard({ force: true });
      }
    } catch (error) {
      setAppMessage(error.message);
      if (button) button.disabled = false;
    }
  }

  /**
   * Shared Yes/No message box for participant-scoped history clearing. It
   * reuses the global message element so no extra dialog is needed, and puts
   * that element back into its normal hidden state when the user answers.
   */
  function confirmClearHistory(scope) {
    const notice = $("app-session-warning");
    if (!notice) return Promise.resolve(false);

    const patientScope = scope !== "doctor";
    const previousRole = notice.getAttribute("role");

    return new Promise((resolve) => {
      const overlay = el(
        "div",
        "fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4"
      );
      document.body.append(overlay);
      overlay.append(notice);

      notice.hidden = false;
      notice.className =
        "w-full max-w-md rounded-xl border border-line bg-white p-5 text-ink shadow-xl";
      notice.setAttribute("role", "dialog");
      notice.setAttribute("aria-modal", "true");
      notice.setAttribute("aria-labelledby", "clear-history-title");
      notice.replaceChildren();

      const title = el(
        "h2",
        "text-base font-semibold text-ink",
        patientScope
          ? "Clear this appointment from your history?"
          : "Clear this patient from your session history?"
      );
      title.id = "clear-history-title";

      const message = el(
        "p",
        "mt-2 text-sm text-slate2",
        patientScope
          ? "Only this row is removed from My appointments. The appointment, payment and medical records remain in the hospital system."
          : "Only this row is removed from Patients in this session. The appointment, payment and medical records remain in the hospital system."
      );

      const actions = el("div", "mt-5 flex flex-wrap justify-end gap-2");
      const no = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-9 px-3 py-1.5 text-xs",
        "No"
      );
      no.type = "button";
      const yes = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-brand border-brand text-white hover:bg-brand-d min-h-9 px-3 py-1.5 text-xs",
        "Yes"
      );
      yes.type = "button";

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        overlay.remove();
        document.body.append(notice);
        notice.replaceChildren();
        notice.hidden = true;
        if (previousRole) notice.setAttribute("role", previousRole);
        else notice.removeAttribute("role");
        notice.removeAttribute("aria-modal");
        notice.removeAttribute("aria-labelledby");
        resolve(value);
      };

      no.addEventListener("click", () => finish(false));
      yes.addEventListener("click", () => finish(true));
      actions.append(no, yes);
      notice.append(title, message, actions);
      setTimeout(() => no.focus(), 0);
    });
  }

  async function clearAppointmentHistory(appointmentId, button) {
    if (button) button.disabled = true;

    const confirmed = await confirmClearHistory("patient");
    if (!confirmed) {
      if (button) button.disabled = false;
      return;
    }

    try {
      await MC.hideAppointment(appointmentId);
      await loadAppointments();
      setAppMessage(
        "Appointment cleared from your history. Hospital records are unchanged.",
        "success"
      );
    } catch (error) {
      setAppMessage(error.message, "error");
      if (button) button.disabled = false;
    }
  }

  function confirmAppointmentCancel(appointmentId, options = {}) {
    const notice = $("app-session-warning");
    if (!notice) return Promise.resolve(null);

    const appointment = (Array.isArray(state.appointments) ? state.appointments : [])
      .concat(Array.isArray(state.manager && state.manager.reception) ? state.manager.reception : [])
      .find((item) => item && String(item.appointmentId) === String(appointmentId));
    const previousRole = notice.getAttribute("role");

    return new Promise((resolve) => {
      const overlay = el(
        "div",
        "fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4"
      );
      document.body.append(overlay);
      overlay.append(notice);

      notice.hidden = false;
      notice.className =
        "w-full max-w-md rounded-xl border border-line bg-white p-5 text-ink shadow-xl";
      notice.replaceChildren();

      const title = el(
        "h2",
        "text-base font-semibold text-ink",
        options.title || "Cancel this appointment?"
      );
      const message = el(
        "p",
        "mt-1 text-sm text-mute",
        options.message ||
          (appointment
            ? "Booking " +
                referenceOf(appointment.bookingReference) +
                (appointment.doctorName ? " with " + doctorName(appointment) : "") +
                ". Tell us why you are cancelling, then confirm or deny."
            : "Tell us why you are cancelling, then confirm or deny.")
      );

      const label = el(
        "label",
        "mt-4 block text-xs font-semibold text-slate2",
        "Reason for cancellation"
      );
      label.htmlFor = "cancel-reason";

      const input = document.createElement("textarea");
      input.id = "cancel-reason";
      input.rows = 3;
      input.maxLength = 500;
      input.placeholder = "e.g. I can no longer attend this appointment";
      input.className =
        "mt-1 w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-ink focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";

      const error = el(
        "p",
        "mt-1 text-xs text-rose-600",
        "Please enter a reason before confirming."
      );
      error.hidden = true;

      const actions = el("div", "mt-5 flex flex-wrap justify-end gap-2");
      const deny = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-9 px-3 py-1.5 text-xs",
        "Deny"
      );
      deny.type = "button";
      const confirm = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-rose-600 border-rose-600 text-white hover:bg-rose-700 min-h-9 px-3 py-1.5 text-xs",
        "Confirm"
      );
      confirm.type = "button";

      let settled = false;
      const finish = (reason) => {
        if (settled) return;
        settled = true;
        overlay.remove();
        document.body.append(notice);
        notice.replaceChildren();
        notice.hidden = true;
        if (previousRole) notice.setAttribute("role", previousRole);
        else notice.removeAttribute("role");
        notice.removeAttribute("aria-modal");
        notice.removeAttribute("aria-labelledby");
        resolve(reason);
      };

      deny.addEventListener("click", () => finish(null));
      confirm.addEventListener("click", () => {
        const reason = input.value.trim();
        if (!reason) {
          error.hidden = false;
          input.focus();
          return;
        }
        finish(reason);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          confirm.click();
        }
      });

      actions.append(deny, confirm);
      notice.append(title, message, label, input, error, actions);
      setTimeout(() => input.focus(), 0);
    });
  }

  /**
   * Message box for the manager/doctor delay action. The user must type the
   * number of minutes and press Confirm; there is no fixed 15-minute action.
   */
  function promptDelayMinutes(title = "Delay this session") {
    const notice = $("app-session-warning");
    if (!notice) return Promise.resolve(null);
    const previousRole = notice.getAttribute("role");

    return new Promise((resolve) => {
      const overlay = el(
        "div",
        "fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4"
      );
      document.body.append(overlay);
      overlay.append(notice);

      notice.hidden = false;
      notice.className =
        "w-full max-w-md rounded-xl border border-line bg-white p-5 text-ink shadow-xl";
      notice.setAttribute("role", "dialog");
      notice.setAttribute("aria-modal", "true");
      notice.setAttribute("aria-labelledby", "delay-minutes-title");
      notice.replaceChildren();

      const heading = el(
        "h2",
        "text-base font-semibold text-ink",
        title
      );
      heading.id = "delay-minutes-title";

      const message = el(
        "p",
        "mt-1 text-sm text-mute",
        "Enter the custom delay in minutes. Every patient in this queue from the delayed booking onwards is notified."
      );

      const label = el(
        "label",
        "mt-4 block text-xs font-semibold text-slate2",
        "Delay (minutes)"
      );
      label.htmlFor = "delay-minutes";

      const input = document.createElement("input");
      input.id = "delay-minutes";
      input.dataset.delayMinutes = "";
      input.type = "number";
      input.min = "1";
      input.max = "480";
      input.step = "1";
      input.value = "10";
      input.className =
        "mt-1 w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-ink focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";

      const error = el(
        "p",
        "mt-1 text-xs text-rose-600",
        "Enter a whole number of minutes between 1 and 480."
      );
      error.hidden = true;

      const actions = el("div", "mt-5 flex flex-wrap justify-end gap-2");
      const cancel = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-9 px-3 py-1.5 text-xs",
        "Cancel"
      );
      cancel.type = "button";
      const confirm = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-brand border-brand text-white hover:bg-brand-d min-h-9 px-3 py-1.5 text-xs",
        "Confirm delay"
      );
      confirm.type = "button";

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        overlay.remove();
        document.body.append(notice);
        notice.replaceChildren();
        notice.hidden = true;
        if (previousRole) notice.setAttribute("role", previousRole);
        else notice.removeAttribute("role");
        notice.removeAttribute("aria-modal");
        notice.removeAttribute("aria-labelledby");
        resolve(value);
      };

      cancel.addEventListener("click", () => finish(null));
      confirm.addEventListener("click", () => {
        const raw = input.value.trim();
        const minutes = Number(raw);
        if (
          !Number.isInteger(minutes) ||
          minutes < 1 ||
          minutes > 480
        ) {
          error.hidden = false;
          input.focus();
          return;
        }
        finish(minutes);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") confirm.click();
      });

      actions.append(cancel, confirm);
      notice.append(heading, message, label, input, error, actions);
      setTimeout(() => input.focus(), 0);
    });
  }

  async function cancelAppointment(appointmentId) {
    const reason = await confirmAppointmentCancel(appointmentId);
    if (!reason) return;

    try {
      await MC.cancelAppointment(appointmentId, reason);
      await Promise.allSettled([loadAppointments(), loadSessions()]);
      if (state.manager.receptionLoaded) {
        await loadManagerReception({ silent: true });
      }
      setAppMessage(
        "Your appointment is cancelled successfully. Your reason has been recorded.",
        "success"
      );
    } catch (error) {
      setAppMessage(error.message, "error");
    }
  }

  async function delayAppointmentQueue(appointmentId, button) {
    const minutes = await promptDelayMinutes("Delay this queue position");
    if (minutes == null) return;
    if (button) button.disabled = true;

    try {
      await MC.delayAppointment(appointmentId, minutes);
      showNotificationToast({
        title: "Queue delayed",
        message:
          "This booking and every appointment behind it were delayed by " +
          minutes +
          " minute(s).",
      });
      await Promise.allSettled([loadManagerReception({ silent: true }), loadSessions()]);
      invalidateManagerDashboard();
    } catch (error) {
      setAppMessage(error.message, "error");
      if (button) button.disabled = false;
    }
  }

  async function checkInAppointment(appointmentId) {
    try {
      await MC.checkIn(appointmentId);
      invalidateManagerDashboard();
      await loadAppointments();
      if (S && S.role === "MANAGER") {
        void loadManagerDashboard({ force: true });
      }
    } catch (error) {
      setAppMessage(error.message);
    }
  }

  // ---------------------------------------------------------------
  // Real-time transport
  // ---------------------------------------------------------------

  let stompClient = null;
  let stompReady = null;
  let stompConnected = false;
  let connectionWaiters = [];
  const subscriptions = new Map();

  function notifyConnected() {
    stompConnected = true;
    const waiters = connectionWaiters;
    connectionWaiters = [];
    waiters.forEach((resolve) => resolve(stompClient));
  }

  function waitForConnection(timeoutMs = 15000) {
    if (stompConnected && stompClient) return Promise.resolve(stompClient);

    return new Promise((resolve, reject) => {
      const waiter = () => {
        clearTimeout(timer);
        resolve(stompClient);
      };
      const timer = setTimeout(() => {
        connectionWaiters = connectionWaiters.filter((w) => w !== waiter);
        reject(new Error("Live updates are unavailable right now. Please try again."));
      }, timeoutMs);
      connectionWaiters.push(waiter);
    });
  }

  async function getRealtime() {
    if (!S) throw new Error("Sign in to use live updates.");
    if (stompReady) return stompReady;

    stompReady = (async () => {
      const response = await fetchWithTimeout("/api/realtime/config", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const config = await response.json().catch(() => ({}));

      if (!response.ok || !config.websocketUrl) {
        throw new Error("Live updates are not configured.");
      }

      if (typeof StompJs === "undefined") {
        throw new Error("The live update library did not load.");
      }

      const client = new StompJs.Client({
        brokerURL: config.websocketUrl,
        reconnectDelay: 4000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: () => {},
      });

      client.beforeConnect = async () => {
        const ticket = await MC.wsTicket();
        client.connectHeaders = {
          Authorization: "Bearer " + ticket.ticket,
        };
      };

      client.onConnect = () => {
        notifyConnected();
        subscriptions.forEach((entry) => {
          if (entry.subscription) {
            try {
              entry.subscription.unsubscribe();
            } catch {
              // Ignore stale subscriptions.
            }
          }
          entry.subscription = client.subscribe(
            entry.destination,
            entry.handler
          );
        });
      };

      client.onWebSocketClose = () => {
        stompConnected = false;
      };

      client.onStompError = (frame) => {
        stompConnected = false;
        const message =
          (frame.headers && frame.headers.message) ||
          "Live updates are temporarily unavailable.";
        setAppMessage(message);
      };

      stompClient = client;
      client.activate();

      return client;
    })().catch((error) => {
      stompReady = null;
      throw error;
    });

    return stompReady;
  }

  function subscribe(key, destination, handler) {
    if (subscriptions.has(key)) {
      const existing = subscriptions.get(key);
      if (existing.destination === destination) return existing;
      unsubscribe(key);
    }

    const entry = {
      destination,
      handler: (message) => {
        let payload = null;
        try {
          payload = JSON.parse(message.body);
        } catch {
          return;
        }
        handler(payload);
      },
      subscription: null,
    };

    subscriptions.set(key, entry);

    if (stompConnected && stompClient) {
      entry.subscription = stompClient.subscribe(
        entry.destination,
        entry.handler
      );
    } else {
      void getRealtime().catch(() => {
        // The next successful connection registers this handler.
      });
    }

    return entry;
  }

  function unsubscribe(key) {
    const entry = subscriptions.get(key);
    if (!entry) return;

    if (entry.subscription) {
      try {
        entry.subscription.unsubscribe();
      } catch {
        // Ignore.
      }
    }

    subscriptions.delete(key);
  }

  async function publish(destination, payload) {
    // Wait until the STOMP handshake has completed. Messages typed before
    // the socket is ready are held briefly instead of failing with a raw
    // transport error.
    await getRealtime();
    await waitForConnection();

    if (!stompConnected || !stompClient) {
      throw new Error("Live updates are unavailable right now. Please try again.");
    }

    stompClient.publish({
      destination,
      body: JSON.stringify(payload),
    });
  }

  function disconnectRealtime() {
    subscriptions.clear();
    stompConnected = false;
    connectionWaiters.forEach((resolve) => resolve(null));
    connectionWaiters = [];

    if (stompClient) {
      try {
        void stompClient.deactivate();
      } catch {
        // Ignore.
      }
    }

    stompClient = null;
    stompReady = null;
    state.sessionsSub = null;
    state.queueSub = null;
  }

  // ---------------------------------------------------------------
  // Doctor console
  // ---------------------------------------------------------------

  async function loadDoctorConsole() {
    if (!S || S.role !== "DOCTOR") return;

    const select = $("doctor-session-select");
    const queueSelect = $("doctor-queue-session-select");
    const status = document.querySelector("[data-doctor-status]");
    const empty = document.querySelector("[data-doctor-empty]");

    if (status) setStatus(status, "Loading your sessions…");

    try {
      let sessions = await MC.doctorSessions();
      if (!Array.isArray(sessions)) sessions = [];

      const today = todayISO();
      sessions = sortDoctorSessions(sessions, today);

      state.doctor.sessions = sessions;
      state.doctor.sessionsLoaded = true;

      const defaultSession = chooseDefaultDoctorSession(
        sessions,
        today,
        state.doctor.sessionId
      );

      const chosenSessionId = defaultSession ? defaultSession.sessionId : "";
      state.doctor.sessionId = chosenSessionId;

      const selects = [select, queueSelect].filter(Boolean);
      selects.forEach((sel) => {
        sel.replaceChildren();
        sessions.forEach((session) => {
          const option = el(
            "option",
            "",
            formatDate(session.sessionDate) +
              " · " +
              formatTime(session.startTime) +
              "–" +
              formatTime(session.endTime) +
              " · " +
              (session.consultationType === "ONLINE" ? "Online" : "Physical") +
              " · " +
              doctorSessionBookedCount(session) +
              " booked"
          );
          option.value = session.sessionId;
          sel.append(option);
        });
        sel.value = chosenSessionId;
      });

      if (!sessions.length) {
        if (empty) empty.hidden = false;
        const rows = document.querySelector("[data-doctor-rows]");
        if (rows) rows.replaceChildren();
        setStatus(status, "You have no sessions scheduled.");
        return;
      }

      if (empty) empty.hidden = true;

      await loadDoctorQueue(chosenSessionId);
      loadOnce(loadDoctorNotesPicker);
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }
      setStatus(status, error.message, true);
    }
  }

  async function loadDoctorQueue(sessionId, options) {
    if (!sessionId) return;

    const settings = options || {};
    const statusNode = document.querySelector("[data-doctor-status]");
    const rows = document.querySelector("[data-doctor-rows]");
    const empty = document.querySelector("[data-doctor-empty]");

    if (!settings.silent && statusNode) {
      setStatus(statusNode, "Loading the queue…");
    }

    try {
      const queue = await MC.doctorQueue(sessionId);
      state.doctor.queue = queue;
      state.doctor.sessionId = sessionId;

      const selects = [$("doctor-session-select"), $("doctor-queue-session-select")].filter(Boolean);
      selects.forEach((sel) => {
        if (sel.value !== sessionId) sel.value = sessionId;
      });

      const session = state.doctor.sessions.find(
        (item) => item.sessionId === sessionId
      );

      renderDoctorHeader(session, queue);
      renderDoctorStats(queue);
      renderDoctorRows(queue, session);

      if (empty) empty.hidden = true;
      if (statusNode && !settings.silent) {
        setStatus(
          statusNode,
          queue.appointments.length
            ? ""
            : "No patients have booked this session yet."
        );
      }

      subscribe(
        "doctor-queue",
        "/topic/sessions/" + sessionId + "/queue",
        () => {
          if (state.doctor.queueTimer) return;
          state.doctor.queueTimer = setTimeout(() => {
            state.doctor.queueTimer = null;
            if (state.doctor.sessionId === sessionId) {
              void loadDoctorQueue(sessionId, { silent: true });
            }
          }, 350);
        }
      );
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }
      setStatus(statusNode, error.message, true);
      if (rows) rows.replaceChildren();
      if (empty) empty.hidden = false;
    }
  }

  function renderDoctorHeader(session, queue) {
    const title = document.querySelector("[data-doctor-session-title]");
    const meta = document.querySelector("[data-doctor-session-meta]");
    const statusBadge = document.querySelector("[data-doctor-session-status]");
    const queueLabel = document.querySelector("[data-doctor-queue-session-label]");

    if (title) {
      title.textContent = session
        ? doctorName(session) + " · " + (session.specialisation || "Clinic")
        : "Today’s sessions";
    }

    if (session) {
      const summaryText =
        formatDate(session.sessionDate) +
        " · " +
        formatTime(session.startTime) +
        "–" +
        formatTime(session.endTime) +
        " · " +
        (session.consultationType === "ONLINE"
          ? "Online"
          : session.roomNumber
            ? "Room " + session.roomNumber
            : "Physical");

      if (meta) {
        meta.textContent = summaryText + " · " + session.minutesPerPatient + " min per patient";
      }

      if (queueLabel) {
        queueLabel.textContent = summaryText;
      }
    }

    if (statusBadge) {
      const entry = SESSION_STATUS[queue.status] || [titleCase(queue.status), "slate"];
      const previousStatus = statusBadge.dataset.motionStatus;
      statusBadge.className =
        "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap " +
        (TONE[entry[1]] || TONE.slate);
      statusBadge.classList.add("mc-motion-status");
      statusBadge.textContent = entry[0];
      statusBadge.dataset.motionStatus = queue.status || "";
      if (previousStatus && previousStatus !== queue.status) {
        animateStateChange(statusBadge);
      }
    }
  }

  function renderDoctorStats(queue) {
    const appointments = queue.appointments || [];

    const set = (selector, value) => {
      const node = document.querySelector(selector);
      setMotionText(node, value);
    };

    set("[data-stat-booked]", appointments.length);
    set(
      "[data-stat-completed]",
      appointments.filter((item) => item.status === "COMPLETED").length
    );
    set(
      "[data-stat-now]",
      queue.nowServing ? "#" + queue.nowServing : "—"
    );
    set(
      "[data-stat-waiting]",
      appointments.filter((item) => item.status === "ARRIVED").length
    );
  }

  function renderDoctorRows(queue, session) {
    const tbody = document.querySelector("[data-doctor-rows]");
    if (!tbody) return;

    tbody.replaceChildren();

    (queue.appointments || []).forEach((appointment) => {
      const row = document.createElement("tr");

      if (appointment.status === "IN_CONSULTATION") {
        row.className = "[&>td]:bg-sky-50";
      } else if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
        row.className = "[&>td]:text-mute";
      }

      const number = document.createElement("td");
      number.dataset.label = "No.";
      number.append(el("b", "", "#" + appointment.appointmentNumber));
      row.append(number);

      const patient = document.createElement("td");
      patient.dataset.label = "Patient";
      patient.textContent = appointment.patientName || "Patient";
      row.append(patient);

      const type = document.createElement("td");
      type.dataset.label = "Type";
      type.textContent =
        appointment.consultationType === "ONLINE" ? "Online" : "Physical";
      row.append(type);

      const arrival = document.createElement("td");
      arrival.dataset.label = "Check-in";
      arrival.textContent = appointment.arrivedAt
        ? "Arrived " + formatDateTime(appointment.arrivedAt).slice(-5)
        : appointment.checkedInAt
          ? "Checked in " + formatDateTime(appointment.checkedInAt).slice(-5)
          : "Not checked in";
      row.append(arrival);

      const status = document.createElement("td");
      status.dataset.label = "Status";
      let entry = APPT_STATUS[appointment.status] || [titleCase(appointment.status), "slate"];

      if (
        appointment.status === "ARRIVED" &&
        queue.nextNumber &&
        appointment.appointmentNumber === queue.nextNumber
      ) {
        entry = ["Next", "orange"];
      }

      status.append(badge(entry[0], entry[1]));
      if (appointment.acceptanceStatus === "ACCEPTED") {
        status.append(badge("Accepted", "green"));
      } else if (appointment.status === "BOOKED") {
        status.append(badge("Pending", "orange"));
      }
      row.append(status);

      const payment = document.createElement("td");
      payment.dataset.label = "Payment";
      if (appointment.paymentStatus === "PAID") {
        payment.textContent =
          "Paid" +
          (appointment.paymentMethod
            ? " · " + titleCase(appointment.paymentMethod)
            : "");
      } else {
        payment.append(badge("Not paid", "orange"));
      }
      row.append(payment);

      const actions = document.createElement("td");
      actions.dataset.label = "Actions";
      actions.className = "flex flex-wrap items-center justify-end gap-2";

      const isOnline = appointment.consultationType === "ONLINE" || (session && session.consultationType === "ONLINE");

      if (appointment.status === "BOOKED") {
        if (appointment.acceptanceStatus !== "ACCEPTED") {
          actions.append(
            doctorAction(
              "✓ Accept",
              "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700",
              "accept",
              appointment.appointmentId
            ),
            doctorAction(
              "✕ Decline",
              "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100",
              "decline",
              appointment.appointmentId
            )
          );
        } else if (appointment.paymentStatus !== "PAID") {
          actions.append(
            el("span", "text-xs font-semibold text-orange-800", "Payment pending"),
            doctorAction(
              "No-show",
              "bg-white border-line text-slate2 hover:bg-snow",
              "noshow",
              appointment.appointmentId
            )
          );
        } else if (isOnline) {
          actions.append(
            doctorAction(
              "Start",
              "bg-brand border-brand text-white hover:bg-brand-d",
              "start",
              appointment.appointmentId
            ),
            doctorAction(
              "No-show",
              "bg-white border-line text-slate2 hover:bg-snow",
              "noshow",
              appointment.appointmentId
            )
          );
        } else {
          actions.append(
            el("span", "text-xs font-semibold text-orange-800", "Awaiting check-in"),
            doctorAction(
              "No-show",
              "bg-white border-line text-slate2 hover:bg-snow",
              "noshow",
              appointment.appointmentId
            )
          );
        }
      } else if (appointment.status === "CHECKED_IN") {
        if (appointment.paymentStatus !== "PAID") {
          actions.append(
            el("span", "text-xs font-semibold text-orange-800", "Collect payment first")
          );
        } else if (isOnline) {
          actions.append(
            doctorAction(
              "Start",
              "bg-brand border-brand text-white hover:bg-brand-d",
              "start",
              appointment.appointmentId
            )
          );
        } else {
          actions.append(
            doctorAction(
              "Mark arrived",
              "bg-white border-line text-slate2 hover:bg-snow",
              "arrive",
              appointment.appointmentId
            ),
            doctorAction(
              "No-show",
              "bg-white border-line text-slate2 hover:bg-snow",
              "noshow",
              appointment.appointmentId
            )
          );
        }
      } else if (appointment.status === "ARRIVED") {
        if (appointment.paymentStatus === "PAID") {
          actions.append(
            doctorAction(
              "Start",
              "bg-brand border-brand text-white hover:bg-brand-d",
              "start",
              appointment.appointmentId
            )
          );
        } else {
          actions.append(
            el(
              "span",
              "text-xs font-semibold text-orange-800",
              "Collect payment first"
            )
          );
        }
      } else if (appointment.status === "IN_CONSULTATION") {
        actions.append(
          doctorAction(
            "Complete",
            "bg-brand border-brand text-white hover:bg-brand-d",
            "complete",
            appointment.appointmentId
          ),
          doctorAction(
            "💬 Chat",
            "bg-white border-line text-brand font-semibold hover:bg-snow",
            "chat",
            appointment.appointmentId
          )
        );
      } else if (appointment.status === "COMPLETED") {
        actions.append(
          doctorAction(
            "Notes",
            "bg-white border-line text-slate2 hover:bg-snow",
            "notes",
            appointment.appointmentId
          ),
          doctorAction(
            "Chat",
            "bg-white border-line text-slate2 hover:bg-snow",
            "chat",
            appointment.appointmentId
          )
        );
      }

      // Closed rows can be cleared one by one from the doctor's own view
      // without changing the patient's view or the hospital record.
      if (
        ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(appointment.status)
      ) {
        actions.append(
          doctorAction(
            "Clear from history",
            "bg-white border-line text-slate2 hover:bg-snow",
            "clear",
            appointment.appointmentId
          )
        );
      }

      if (!actions.childNodes.length) {
        actions.append(document.createTextNode("—"));
      }

      row.append(actions);
      tbody.append(row);
    });
  }

  function doctorAction(label, tone, name, id) {
    // data-doctor-action carries the action name; data-doctor-id keeps the
    // appointment id so the click handler can pass both to runDoctorAction().
    const button = actionButton(label, tone, "doctorAction", name);
    button.dataset.doctorId = id;
    return button;
  }

  function findDoctorAppointment(appointmentId) {
    const pools = [
      state.doctor.queue && state.doctor.queue.appointments,
      state.doctor.allAppointments,
      state.doctor.sessionAppointments,
      state.consult.list,
    ];
    for (const pool of pools) {
      if (!Array.isArray(pool)) continue;
      const match = pool.find(
        (item) => item && String(item.appointmentId) === String(appointmentId)
      );
      if (match) return match;
    }
    return null;
  }

  /**
   * Opening the chat is the doctor's signal that the online consultation room
   * may open. Start the appointment first (BR-09) so the patient's room unlocks
   * in real time, then continue to the chat window.
   */
  async function ensureDoctorConsultationStarted(appointmentOrId) {
    if (!S || S.role !== "DOCTOR") return false;

    const appointment =
      typeof appointmentOrId === "string"
        ? findDoctorAppointment(appointmentOrId)
        : appointmentOrId;

    if (!appointment) return false;
    if (!["BOOKED", "CHECKED_IN", "ARRIVED"].includes(appointment.status)) return false;
    if (appointment.consultationType !== "ONLINE") return false;
    if (appointment.acceptanceStatus !== "ACCEPTED") {
      setAppMessage(
        "Accept the appointment before opening the consultation room.",
        "warning"
      );
      return false;
    }

    // A locked room without an explanation looks like a frozen chat. Tell the
    // doctor exactly what is still missing instead of silently returning.
    if (appointment.paymentStatus !== "PAID") {
      setAppMessage(
        "This room stays locked until the appointment payment is recorded.",
        "warning"
      );
      return false;
    }

    try {
      await callWithWakeRetry(
        () => MC.startConsultation(appointment.appointmentId),
        { retry: true }
      );
    } catch (error) {
      if (error && error.status === 409) {
        // A retry after a lost response can report a conflict even though the
        // first call actually succeeded. Re-read the lifecycle from the server
        // instead of pretending the appointment started, including when the
        // doctor opened this room outside the currently selected session.
        const active = await refreshConsultationStatus(appointment.appointmentId);
        if (!active) {
          if (!isServiceUnavailable(error)) setAppMessage(error.message);
          return false;
        }
      } else {
        if (!error || !isServiceUnavailable(error)) {
          setAppMessage(
            (error && error.message) ||
              "The consultation room could not be opened."
          );
        }
        return false;
      }
    }

    appointment.status = "IN_CONSULTATION";

    if (state.doctor.queue && Array.isArray(state.doctor.queue.appointments)) {
      const row = state.doctor.queue.appointments.find(
        (item) => String(item.appointmentId) === String(appointment.appointmentId)
      );
      if (row) row.status = "IN_CONSULTATION";
    }

    if (
      state.consult.appointment &&
      String(state.consult.appointment.appointmentId) ===
        String(appointment.appointmentId)
    ) {
      state.consult.appointment.status = "IN_CONSULTATION";
      renderConsultHeader(state.consult.appointment);
    }

    if (activeView === "doctor") {
      void loadDoctorQueue(state.doctor.sessionId);
    }

    return true;
  }

  async function runDoctorAction(name, appointmentId, button) {
    if (button) button.disabled = true;

    const statusNode = document.querySelector("[data-doctor-status]");

    try {
      if (name === "accept") {
        await MC.acceptAppointment(appointmentId);
        setStatus(statusNode, "Appointment accepted. Patient has been notified.");
        await loadDoctorQueue(state.doctor.sessionId);
        return;
      } else if (name === "decline") {
        const reason = await confirmAppointmentCancel(appointmentId, {
          title: "Decline this appointment?",
          message:
            "A reason is required. The patient will be notified and the appointment remains in hospital records.",
        });
        if (!reason) {
          if (button) button.disabled = false;
          return;
        }
        await MC.declineAppointment(appointmentId, reason);
        setStatus(statusNode, "Appointment declined.");
        await loadDoctorQueue(state.doctor.sessionId);
        return;
      } else if (name === "arrive") {
        await MC.markArrived(appointmentId);
        setStatus(statusNode, "Patient marked as arrived.");
      } else if (name === "start") {
        await MC.startConsultation(appointmentId);
        setStatus(statusNode, "Consultation started.");
        state.consult.requestedId = appointmentId;
        nav("consult");
        return;
      } else if (name === "complete") {
        const result = await MC.completeAndAdvance(appointmentId);

        if (result.paymentRequired) {
          setStatus(
            statusNode,
            "Consultation completed. The next patient has not paid yet — collect payment before starting.",
            true
          );
        } else if (result.next) {
          setStatus(
            statusNode,
            "Consultation completed. Now serving #" +
              result.next.appointmentNumber +
              "."
          );
        } else {
          setStatus(
            statusNode,
            "Consultation completed. Waiting for the next check-in."
          );
        }

        selectNotes(result.completed);
      } else if (name === "noshow") {
        await MC.markNoShow(appointmentId);
        setStatus(statusNode, "Appointment marked as a no-show.");
      } else if (name === "clear") {
        const confirmed = await confirmClearHistory("doctor");
        if (!confirmed) {
          if (button) button.disabled = false;
          return;
        }
        await MC.hideDoctorAppointment(appointmentId);
        setStatus(
          statusNode,
          "Patient cleared from this session history. Hospital records are unchanged."
        );
        await loadDoctorQueue(state.doctor.sessionId, { silent: true });
        return;
      } else if (name === "notes" || name === "chat") {
        if (button) button.disabled = false;
        if (name === "chat") {
          await ensureDoctorConsultationStarted(appointmentId);
          state.consult.requestedId = appointmentId;
          nav("consult");
          setTimeout(async () => {
            const select = $("consult-pick");
            if (select) select.value = appointmentId;
            await openConsultation(appointmentId);
            const chatSection = document.querySelector('section[aria-label="Chat"]');
            if (chatSection) {
              chatSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            const chatInput = $("consult-c");
            if (chatInput && !chatInput.disabled) {
              chatInput.focus();
            }
          }, 150);
          return;
        }
        const queue = state.doctor.queue;
        const appointment = queue
          ? queue.appointments.find(
              (item) => item.appointmentId === appointmentId
            )
          : null;
        if (appointment) await selectNotes(appointment);
        return;
      }

      await loadDoctorQueue(state.doctor.sessionId, { silent: true });
    } catch (error) {
      setStatus(statusNode, error.message, true);
      if (button) button.disabled = false;
    }
  }

  async function loadDoctorNotesPicker(preselectedId) {
    if (!S || S.role !== "DOCTOR") return;
    const dateSelect = $("doctor-notes-date");
    const sessionSelect = $("doctor-notes-session");
    const pick = $("doctor-notes-pick");
    if (!pick) return;

    try {
      const [sessionsResp, appointmentsResp] = await Promise.allSettled([
        MC.doctorSessions(),
        MC.doctorAppointments({})
      ]);

      const allSessions = (sessionsResp.status === "fulfilled" && Array.isArray(sessionsResp.value))
        ? sessionsResp.value
        : [];
      const allAppointments = (appointmentsResp.status === "fulfilled" && Array.isArray(appointmentsResp.value))
        ? appointmentsResp.value
        : [];

      state.doctor.allSessions = allSessions;
      state.doctor.allAppointments = allAppointments;

      const dateSet = new Set();
      allSessions.forEach((s) => { if (s.sessionDate) dateSet.add(s.sessionDate); });
      allAppointments.forEach((a) => { if (a.sessionDate) dateSet.add(a.sessionDate); });

      const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

      if (dateSelect) {
        dateSelect.replaceChildren();
        if (!sortedDates.length) {
          const opt = el("option", "", "No dates available");
          opt.value = "";
          dateSelect.append(opt);
        } else {
          sortedDates.forEach((d) => {
            const opt = el("option", "", formatDate(d));
            opt.value = d;
            dateSelect.append(opt);
          });
        }
      }

      let targetApptId = preselectedId || (state.doctor.selected && state.doctor.selected.appointmentId);
      let targetAppt = targetApptId
        ? allAppointments.find((a) => a.appointmentId === targetApptId)
        : null;

      let activeDate = targetAppt && targetAppt.sessionDate
        ? targetAppt.sessionDate
        : (state.doctor.selectedDate || sortedDates[0] || "");

      if (dateSelect && activeDate) {
        dateSelect.value = activeDate;
      }

      await syncDoctorNotesSessions(activeDate, targetAppt ? targetAppt.sessionId : null, targetApptId);
    } catch (err) {
      console.warn("Could not load doctor notes picker:", err);
    }
  }

  async function syncDoctorNotesSessions(selectedDate, preselectedSessionId, preselectedApptId) {
    const sessionSelect = $("doctor-notes-session");
    const allSessions = state.doctor.allSessions || [];

    const dateSessions = selectedDate
      ? allSessions.filter((s) => s.sessionDate === selectedDate)
      : allSessions;

    if (sessionSelect) {
      sessionSelect.replaceChildren();
      if (!dateSessions.length) {
        const opt = el("option", "", "No sessions on this date");
        opt.value = "";
        sessionSelect.append(opt);
      } else {
        dateSessions.forEach((sess, idx) => {
          const num = "Session " + (idx + 1);
          const time = (sess.startTime ? sess.startTime.slice(0, 5) : "") +
            (sess.endTime ? " - " + sess.endTime.slice(0, 5) : "");
          const type = sess.consultationType === "ONLINE"
            ? "Online"
            : (sess.roomNumber ? "Room " + sess.roomNumber : "Physical");
          const label = [num, time, type].filter(Boolean).join(" · ");
          const opt = el("option", "", label);
          opt.value = sess.sessionId;
          sessionSelect.append(opt);
        });
      }
    }

    let activeSessionId = preselectedSessionId;
    if (!activeSessionId && dateSessions.length) {
      if (state.doctor.sessionId && dateSessions.some((s) => s.sessionId === state.doctor.sessionId)) {
        activeSessionId = state.doctor.sessionId;
      } else {
        activeSessionId = dateSessions[0].sessionId;
      }
    }

    if (sessionSelect && activeSessionId) {
      sessionSelect.value = activeSessionId;
    }

    await syncDoctorNotesPatients(activeSessionId, preselectedApptId);
  }

  async function syncDoctorNotesPatients(sessionId, preselectedApptId) {
    const pick = $("doctor-notes-pick");
    if (!pick) return;
    pick.replaceChildren();

    const title = document.querySelector("[data-notes-title]");
    const reason = document.querySelector("[data-notes-reason]");
    const status = document.querySelector("[data-notes-status]");

    if (!sessionId) {
      const opt = el("option", "", "No session selected");
      opt.value = "";
      pick.append(opt);
      if (title) title.textContent = "Consultation notes";
      if (reason) reason.textContent = "Select a date and session number to view patients.";
      return;
    }

    try {
      let appointments = [];
      try {
        const queue = await MC.doctorQueue(sessionId);
        if (queue && Array.isArray(queue.appointments)) {
          appointments = queue.appointments;
        }
      } catch (qErr) {
        appointments = (state.doctor.allAppointments || []).filter(
          (a) => a.sessionId === sessionId
        );
      }

      const allAppts = state.doctor.allAppointments || [];
      allAppts.forEach((a) => {
        if (a.sessionId === sessionId && !appointments.some((x) => x.appointmentId === a.appointmentId)) {
          appointments.push(a);
        }
      });

      appointments.sort((a, b) => (a.appointmentNumber || 0) - (b.appointmentNumber || 0));
      state.doctor.sessionAppointments = appointments;

      if (!appointments.length) {
        const opt = el("option", "", "No patients booked in this session");
        opt.value = "";
        pick.append(opt);
        if (title) title.textContent = "Consultation notes";
        if (reason) reason.textContent = "No patients have booked this session yet.";
        const dx = $("doctor-dx");
        const rx = $("doctor-rx");
        const fu = $("doctor-fu");
        if (dx) dx.value = "";
        if (rx) rx.value = "";
        if (fu) fu.value = "";
        const save = document.querySelector("[data-save-summary]");
        if (save) save.disabled = true;
        setStatus(status, "No appointments available in the selected session.");
        return;
      }

      appointments.forEach((appt) => {
        const num = appt.appointmentNumber ? "#" + appt.appointmentNumber : "";
        const name = appt.patientName || "Patient";
        const statusLabel = APPT_STATUS[appt.status]
          ? APPT_STATUS[appt.status][0]
          : titleCase(appt.status);
        const label = [num, name, "(" + statusLabel + ")"].filter(Boolean).join(" · ");
        const opt = el("option", "", label);
        opt.value = appt.appointmentId;
        pick.append(opt);
      });

      let targetAppt = null;
      if (preselectedApptId) {
        targetAppt = appointments.find((a) => a.appointmentId === preselectedApptId);
      }
      if (!targetAppt) {
        targetAppt = appointments.find((a) => a.status === "IN_CONSULTATION") ||
                     appointments.find((a) => a.status === "COMPLETED") ||
                     appointments[0];
      }

      if (targetAppt) {
        pick.value = targetAppt.appointmentId;
        await selectNotes(targetAppt);
      }
    } catch (err) {
      console.warn("Could not load session patients:", err);
    }
  }

  async function selectNotes(appointment) {
    if (!appointment) return;

    state.doctor.selected = appointment;
    state.doctor.summary = null;

    const title = document.querySelector("[data-notes-title]");
    const reason = document.querySelector("[data-notes-reason]");
    const status = document.querySelector("[data-notes-status]");
    const dx = $("doctor-dx");
    const rx = $("doctor-rx");
    const fu = $("doctor-fu");
    const save = document.querySelector("[data-save-summary]");
    const chatLink = document.querySelector("[data-doctor-chat-link]");
    const chatBtn = document.querySelector("[data-doctor-to-chat]");
    const pick = $("doctor-notes-pick");

    const name = appointment.patientName || "Patient";
    const number = appointment.appointmentNumber
      ? "#" + appointment.appointmentNumber + " · "
      : "";

    if (title) title.textContent = number + name;
    if (reason) {
      reason.textContent =
        "Status: " +
        (APPT_STATUS[appointment.status]
          ? APPT_STATUS[appointment.status][0]
          : titleCase(appointment.status)) +
        " · Payment: " +
        (appointment.paymentStatus === "PAID" ? "Paid" : "Not paid") +
        (appointment.bookingReference
          ? " · Ref " + referenceOf(appointment.bookingReference)
          : "");
    }

    if (pick && pick.value !== appointment.appointmentId) {
      pick.value = appointment.appointmentId;
    }

    if (dx) dx.value = "";
    if (rx) rx.value = "";
    if (fu) fu.value = "";

    const inConsult = appointment.status === "IN_CONSULTATION";
    const completed = appointment.status === "COMPLETED";

    if (save) {
      save.disabled = false;
      save.textContent = inConsult
        ? "Complete consultation & save notes"
        : completed
        ? "Update notes"
        : "Save notes";
    }

    const isOnline = appointment.consultationType === "ONLINE";
    if (chatLink) {
      chatLink.hidden = !isOnline;
      chatLink.onclick = async (e) => {
        e.preventDefault();
        await ensureDoctorConsultationStarted(appointment);
        state.consult.requestedId = appointment.appointmentId;
        nav("consult");
      };
    }
    if (chatBtn) {
      chatBtn.hidden = !isOnline;
      chatBtn.onclick = async () => {
        await ensureDoctorConsultationStarted(appointment);
        state.consult.requestedId = appointment.appointmentId;
        nav("consult");
      };
    }

    setStatus(
      status,
      completed
        ? "Add or update diagnosis and prescription, then save."
        : inConsult
        ? "Consultation in progress. Saving will complete the consultation and publish notes to the patient."
        : "Consultation must be started or completed before saving notes."
    );

    try {
      const summary = await MC.summary(appointment.appointmentId);
      if (!summary) return;

      state.doctor.summary = summary;

      if (dx) dx.value = summary.diagnosis || "";
      if (rx) rx.value = summary.prescription || summary.treatmentNotes || "";
      if (fu) fu.value = summary.followUpInstructions || "";

      if (save) save.textContent = "Update notes";
      setStatus(status, "Summary loaded. Saving updates the existing record.");
    } catch (error) {
      if (error.status !== 404) setStatus(status, error.message, true);
    }
  }

  async function saveDoctorSummary() {
    let appointment = state.doctor.selected;
    const pick = $("doctor-notes-pick");
    if ((!appointment || appointment.appointmentId !== (pick && pick.value)) && pick && pick.value) {
      appointment = (state.doctor.sessionAppointments || []).find(
        (a) => a.appointmentId === pick.value
      ) || (state.doctor.allAppointments || []).find(
        (a) => a.appointmentId === pick.value
      ) || (state.doctor.queue && state.doctor.queue.appointments || []).find(
        (a) => a.appointmentId === pick.value
      );
    }

    const status = document.querySelector("[data-notes-status]");
    const save = document.querySelector("[data-save-summary]");
    const dx = $("doctor-dx");
    const rx = $("doctor-rx");
    const fu = $("doctor-fu");

    if (!appointment) {
      setStatus(status, "Please select a patient / consultation first.", true);
      return;
    }

    const diagnosis = dx ? dx.value.trim() : "";
    if (!diagnosis) {
      setStatus(status, "Diagnosis summary is required before saving.", true);
      if (dx) dx.focus();
      return;
    }

    if (save) save.disabled = true;

    try {
      if (
        appointment.acceptanceStatus === "ACCEPTED" &&
        appointment.paymentStatus === "PAID" &&
        ["BOOKED", "CHECKED_IN", "ARRIVED"].includes(appointment.status)
      ) {
        setStatus(status, "Starting consultation…");
        try {
          await MC.startConsultation(appointment.appointmentId);
          appointment.status = "IN_CONSULTATION";
        } catch (startErr) {
          // If start fails (e.g. not paid or already started), continue
        }
      }

      if (appointment.status === "IN_CONSULTATION") {
        setStatus(status, "Completing consultation…");
        try {
          if (typeof MC.completeConsultation === "function") {
            await MC.completeConsultation(appointment.appointmentId);
          } else {
            await MC.completeAndAdvance(appointment.appointmentId);
          }
          appointment.status = "COMPLETED";
        } catch (completeErr) {
          if (completeErr.status !== 409) {
            // ignore 409 if already completed
          }
          appointment.status = "COMPLETED";
        }
      }

      setStatus(status, "Saving clinical notes…");
      const summary = await MC.saveSummary(
        appointment.appointmentId,
        {
          diagnosis,
          symptoms: null,
          treatmentNotes: null,
          prescription: rx ? rx.value.trim() : null,
          followUpInstructions: fu ? fu.value.trim() : null,
          followUpDate: null,
        },
        Boolean(state.doctor.summary)
      );

      state.doctor.summary = summary;
      setStatus(
        status,
        "Notes and prescription saved successfully! The patient can now view them."
      );
      if (save) {
        save.textContent = "Update notes";
      }

      const reason = document.querySelector("[data-notes-reason]");
      if (reason) {
        reason.textContent =
          "Status: Completed · Payment: " +
          (appointment.paymentStatus === "PAID" ? "Paid" : "Not paid") +
          (appointment.bookingReference
            ? " · Ref " + referenceOf(appointment.bookingReference)
            : "");
      }

      await loadDoctorNotesPicker(appointment.appointmentId);
    } catch (error) {
      setStatus(status, error.message || "Could not save notes.", true);
    } finally {
      if (save) save.disabled = false;
    }
  }

  // ---------------------------------------------------------------
  // Consultation room (patient and doctor)
  // ---------------------------------------------------------------

  async function loadConsultationPicker() {
    if (!S) return;

    const select = $("consult-pick");
    const empty = document.querySelector("[data-consult-empty]");
    const layout = document.querySelector("[data-consult-layout]");

    try {
      const list =
        S.role === "DOCTOR"
          ? await MC.doctorAppointments({})
          : await MC.myAppointments();

      // Never open an old completed room by default. Active rooms come first,
      // then rooms the doctor can open now, with closed transcripts last.
      const priority = {
        IN_CONSULTATION: 0,
        ARRIVED: 1,
        BOOKED: 2,
        COMPLETED: 3,
      };
      const appointments = (Array.isArray(list) ? list : [])
        .filter(
          (item) =>
            item &&
            ["IN_CONSULTATION", "COMPLETED", "ARRIVED", "BOOKED"].includes(item.status)
        )
        .sort((a, b) => {
          const difference =
            (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
          if (difference) return difference;
          return String(b.sessionDate || "").localeCompare(
            String(a.sessionDate || "")
          );
        });

      state.consult.list = appointments;

      if (select) {
        select.replaceChildren();

        if (!appointments.length) {
          const option = el("option", "", "No consultations yet");
          option.value = "";
          select.append(option);
        }

        appointments.forEach((appointment) => {
          const who =
            S.role === "DOCTOR"
              ? appointment.patientName || "Patient"
              : doctorName(appointment);
          const option = el(
            "option",
            "",
            referenceOf(appointment.bookingReference) +
              " · " +
              who +
              " · " +
              formatDate(appointment.sessionDate) +
              " · " +
              (APPT_STATUS[appointment.status]
                ? APPT_STATUS[appointment.status][0]
                : titleCase(appointment.status))
          );
          option.value = appointment.appointmentId;
          select.append(option);
        });

        const requested =
          state.consult.requestedId ||
          state.consult.appointmentId ||
          (appointments[0] && appointments[0].appointmentId);

        state.consult.requestedId = null;

        if (requested && appointments.some((item) => item.appointmentId === requested)) {
          select.value = requested;
          await openConsultation(requested, appointments);
          return;
        }
      }

      if (!appointments.length) {
        if (empty) empty.hidden = false;
        if (layout) layout.hidden = true;
        state.consult.appointmentId = null;
        state.consult.appointment = null;
        return;
      }

      if (empty) empty.hidden = true;
      await openConsultation(select ? select.value : appointments[0].appointmentId, appointments);
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }
      setAppMessage(error.message);
      if (empty) {
        empty.hidden = false;
        empty.textContent = error.message;
      }
    }
  }

  /**
   * Re-read the appointment list and reopen the current room. This gives both
   * participants one visible refresh control even when the chat layout is
   * empty, locked or already active.
   */
  async function refreshConsultationRoom() {
    const button = document.querySelector("[data-consult-refresh]");
    if (!button) return;

    button.disabled = true;
    const label = button.textContent;
    button.textContent = "Refreshing…";
    const scrollY = window.scrollY;

    if (state.consult.appointmentId) {
      state.consult.requestedId = state.consult.appointmentId;
    }

    try {
      await loadConsultationPicker();
    } finally {
      button.disabled = false;
      button.textContent = label;
      window.scrollTo({ top: scrollY, behavior: "instant" });
    }
  }

  async function openConsultation(appointmentId, knownList) {
    if (!appointmentId) return;

    const list = knownList || state.consult.list || [];
    let appointment = list.find(
      (item) => item.appointmentId === appointmentId
    );

    if (!appointment && S && S.role === "CUSTOMER") {
      appointment = state.appointments.find(
        (item) => item.appointmentId === appointmentId
      );
      if (!appointment) {
        try {
          appointment = await MC.myAppointment(appointmentId);
          if (appointment) {
            state.appointments = state.appointments || [];
            state.appointments.push(appointment);
          }
        } catch {
          // The picker and appointment table remain authoritative if this lookup fails.
        }
      }
    }

    if (!appointment && S && S.role === "DOCTOR") {
      appointment =
        (state.doctor.allAppointments || []).find(
          (item) => item.appointmentId === appointmentId
        ) ||
        (state.doctor.queue && state.doctor.queue.appointments || []).find(
          (item) => item.appointmentId === appointmentId
        );
    }

    if (!appointment) {
      setAppMessage("That consultation could not be loaded.");
      return;
    }

    // Cached queue/appointment rows go stale while the other participant
    // acts (for example, the doctor opens the room seconds ago). Confirm the
    // current lifecycle with the server before deciding the room is locked.
    try {
      let fresh = null;
      if (S.role === "CUSTOMER") {
        fresh = await MC.myAppointment(appointmentId);
      } else if (S.role === "DOCTOR") {
        const all = await MC.doctorAppointments({});
        if (Array.isArray(all)) {
          fresh = all.find(
            (item) => String(item.appointmentId) === String(appointmentId)
          ) || null;
        }
      }
      if (fresh) {
        appointment = Object.assign({}, appointment, fresh);
        const index = list.findIndex(
          (item) => String(item.appointmentId) === String(appointmentId)
        );
        if (index >= 0) list[index] = appointment;
      }
    } catch {
      // Keep the cached row; the room itself still reports a clear error.
    }

    // Doctors reach this room from the queue chat button, the notes panel,
    // the appointment table, a deep link or the picker. Start the online
    // consultation on every path, otherwise both participants sit in a
    // read-only room while the server still reports BOOKED.
    if (
      S && S.role === "DOCTOR" &&
      appointment.consultationType === "ONLINE" &&
      ["BOOKED", "CHECKED_IN", "ARRIVED"].includes(appointment.status)
    ) {
      await ensureDoctorConsultationStarted(appointment);
      const refreshed = findDoctorAppointment(appointmentId);
      if (refreshed && refreshed.status === "IN_CONSULTATION") {
        appointment = refreshed;
      }
    }

    state.consult.appointmentId = appointmentId;
    state.consult.appointment = appointment;
    state.consult.summary = null;

    const select = $("consult-pick");
    if (select) select.value = appointmentId;

    const empty = document.querySelector("[data-consult-empty]");
    const layout = document.querySelector("[data-consult-layout]");
    if (empty) empty.hidden = true;
    if (layout) layout.hidden = false;

    renderConsultHeader(appointment);
    resetFeedbackForm();

    await Promise.allSettled([
      loadChatHistory(appointmentId),
      loadConsultSummary(appointmentId),
      loadConsultationReviewState(appointmentId),
    ]);

    subscribeConsultation(appointment);
  }

  function renderConsultHeader(appointment) {
    const title = document.querySelector("[data-consult-title]");
    const meta = document.querySelector("[data-consult-meta]");
    const status = document.querySelector("[data-consult-status]");
    const note = document.querySelector("[data-chat-note]");
    const input = $("consult-c");
    const send = document.querySelector("[data-chat-send]");

    if (title) {
      title.textContent =
        appointment.consultationType === "ONLINE"
          ? "Online consultation"
          : "Consultation";
    }

    if (meta) {
      const who =
        S.role === "DOCTOR"
          ? appointment.patientName || "Patient"
          : doctorName(appointment);
      meta.textContent = [
        who,
        appointment.specialisation || "",
        "Ref " + referenceOf(appointment.bookingReference),
      ]
        .filter(Boolean)
        .join(" · ");
    }

    if (status) {
      const entry = APPT_STATUS[appointment.status] || ["Unknown", "slate"];
      status.className =
        "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap " +
        (TONE[entry[1]] || TONE.slate);
      status.textContent = entry[0];
    }

    const active = appointment.status === "IN_CONSULTATION";
    const participant =
      S.role === "CUSTOMER" || S.role === "DOCTOR";

    if (input) {
      input.disabled = !active || !participant;
      input.placeholder = active
        ? "Type a message…"
        : appointment.status === "COMPLETED"
          ? "This consultation has ended (read-only)"
          : "Waiting for your doctor to open the chat…";
    }

    if (send) send.disabled = !active || !participant;

    if (note) {
      if (active) {
        note.textContent =
          "Messages are stored securely. The doctor can complete the consultation at any time.";
      } else if (appointment.status === "COMPLETED") {
        note.textContent =
          "This consultation has ended, so the chat is read-only. Your summary remains available.";
      } else {
        note.textContent =
          "Your consultation room is private to you and your doctor. It unlocks once payment is recorded and your doctor opens the chat.";
      }
    }

    const completeBtn = document.querySelector("[data-doctor-complete-consult]");
    if (completeBtn) {
      completeBtn.hidden = !(S && S.role === "DOCTOR" && appointment.status === "IN_CONSULTATION");
      completeBtn.onclick = async () => {
        try {
          completeBtn.disabled = true;
          if (typeof MC.completeConsultation === "function") {
            await MC.completeConsultation(appointment.appointmentId);
          } else {
            await MC.completeAndAdvance(appointment.appointmentId);
          }
          appointment.status = "COMPLETED";
          state.doctor.selected = appointment;
          nav("doctor");
          setTimeout(() => {
            activatePanel(
              document.querySelector('[data-view="doctor"]'),
              document.querySelector('[href="#doctor-n"]')
            );
            void selectNotes(appointment);
          }, 100);
        } catch (err) {
          setAppMessage(
            (err && err.message) || "Could not complete consultation",
            "error"
          );
          completeBtn.disabled = false;
        }
      };
    }

    const editNotesBtn = document.querySelector("[data-doctor-edit-notes]");
    if (editNotesBtn) {
      editNotesBtn.hidden = !(S && S.role === "DOCTOR");
      editNotesBtn.onclick = (e) => {
        e.preventDefault();
        state.doctor.selected = appointment;
        nav("doctor");
        setTimeout(() => {
          activatePanel(
            document.querySelector('[data-view="doctor"]'),
            document.querySelector('[href="#doctor-n"]')
          );
          void selectNotes(appointment);
        }, 100);
      };
    }

    renderConsultRoomControls(appointment);
  }

  function chatActionButton(label, onClick) {
    const button = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-9 px-3 py-1.5 text-xs",
      label
    );
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }

  /** A dismissible error card inside the chat log (never an alert()). */
  function showChatNotice(message, actions) {
    const log = document.querySelector("[data-chat-log]");
    if (!log) return;

    const card = el(
      "div",
      "rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-bad"
    );
    const row = el("div", "flex items-start gap-3");
    const text = el("span", "flex-1 whitespace-pre-wrap", message);
    const close = el(
      "button",
      "shrink-0 cursor-pointer rounded px-1.5 text-lg font-bold leading-tight text-slate2 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand",
      "×"
    );
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss message");
    close.title = "Dismiss";
    close.addEventListener("click", () => card.remove());

    row.append(text, close);
    card.append(row);

    if (actions && actions.length) {
      const actionsRow = el("div", "mt-2 flex flex-wrap gap-2");
      actions.forEach((button) => actionsRow.append(button));
      card.append(actionsRow);
    }

    log.replaceChildren(card);
  }

  /**
   * A locked room is a normal lifecycle state, not an error. Show the next
   * action instead of calling chat history and turning a 403 into a scary
   * red card. The doctor can open the room; the patient can refresh it.
   */
  function renderConsultWaiting(appointment) {
    const log = document.querySelector("[data-chat-log]");
    if (!log || !appointment) return;

    const doctor = S && S.role === "DOCTOR";
    const canStart =
      doctor &&
      appointment.consultationType === "ONLINE" &&
      ["BOOKED", "CHECKED_IN", "ARRIVED"].includes(appointment.status);
    const paid = appointment.paymentStatus === "PAID";

    let message;
    if (canStart && paid) {
      message =
        "This room is ready. Start the consultation to open the private chat for both you and the patient.";
    } else if (canStart) {
      message =
        "Record the appointment payment before starting. The private chat opens for both of you as soon as the consultation starts.";
    } else if (doctor) {
      message =
        "This room is not active. Choose an active or upcoming consultation from the picker to continue the conversation.";
    } else {
      message =
        "The private chat opens as soon as your doctor starts this consultation. Refresh any time — there is nothing you need to do.";
    }

    const card = el(
      "div",
      "rounded-lg border border-line bg-snow p-3 text-sm text-slate2"
    );
    card.append(el("p", "whitespace-pre-wrap", message));

    const actions = el("div", "mt-2 flex flex-wrap gap-2");
    if (canStart) {
      const start = chatActionButton("Start consultation", () =>
        void startConsultationFromRoom(appointment.appointmentId)
      );
      start.disabled = !paid;
      actions.append(start);
    } else {
      actions.append(
        el(
          "span",
          "text-xs text-mute",
          "Use Refresh above to check for updates."
        )
      );
    }
    card.append(actions);
    log.replaceChildren(card);
  }

  /**
   * Re-read the appointment lifecycle from the server. The doctor can start
   * the room in another tab, so cached queue/appointment rows are not enough
   * to decide whether the chat is unlocked.
   */
  async function refreshConsultationStatus(appointmentId) {
    if (!S) return false;

    let fresh = null;
    try {
      if (S.role === "CUSTOMER") {
        fresh = await MC.myAppointment(appointmentId);
      } else if (S.role === "DOCTOR") {
        const all = await MC.doctorAppointments({});
        if (Array.isArray(all)) {
          fresh = all.find(
            (item) => String(item.appointmentId) === String(appointmentId)
          ) || null;
        }
      }
    } catch {
      return false;
    }

    if (!fresh) return false;

    const pools = [
      state.consult.list,
      state.appointments,
      state.doctor.allAppointments,
      state.doctor.sessionAppointments,
      state.doctor.queue && state.doctor.queue.appointments,
    ];
    pools.forEach((pool) => {
      if (!Array.isArray(pool)) return;
      const index = pool.findIndex(
        (item) => item && String(item.appointmentId) === String(appointmentId)
      );
      if (index >= 0) pool[index] = Object.assign({}, pool[index], fresh);
    });

    if (String(state.consult.appointmentId) === String(appointmentId)) {
      state.consult.appointment = Object.assign(
        {},
        state.consult.appointment || {},
        fresh
      );
      renderConsultHeader(state.consult.appointment);
    }

    return fresh.status === "IN_CONSULTATION";
  }

  async function startConsultationFromRoom(appointmentId) {
    try {
      await callWithWakeRetry(
        () => MC.startConsultation(appointmentId),
        { retry: true }
      );
      const active = await refreshConsultationStatus(appointmentId);
      if (active) {
        setAppMessage("");
        await loadChatHistory(appointmentId, { force: true });
      } else {
        setAppMessage("");
        renderConsultWaiting(
          state.consult.appointment || { appointmentId, status: "BOOKED" }
        );
      }
    } catch (error) {
      setAppMessage(
        (error && error.message) || "The consultation could not be started.",
        "error"
      );
    }
  }

  /** Give both roles a visible way to unlock / refresh the consultation room. */
  function renderConsultRoomControls(appointment) {
    const section = document.querySelector('section[aria-label="Chat"]');
    if (!section || !S || !appointment) return;

    let controls = $("consult-room-control");
    if (!controls) {
      controls = el("div", "flex flex-wrap items-center gap-2");
      controls.id = "consult-room-control";
      const head = section.querySelector(".card-head");
      if (head) head.after(controls);
      else section.prepend(controls);
    }
    controls.replaceChildren();

    if (["IN_CONSULTATION", "COMPLETED"].includes(appointment.status)) return;

    if (
      S.role === "DOCTOR" &&
      appointment.consultationType === "ONLINE" &&
      ["BOOKED", "CHECKED_IN", "ARRIVED"].includes(appointment.status)
    ) {
      const paid = appointment.paymentStatus === "PAID";
      const button = chatActionButton(
        "Start consultation",
        () => void startConsultationFromRoom(appointment.appointmentId)
      );
      button.disabled = !paid;
      controls.append(
        button,
        el(
          "span",
          "text-xs text-mute",
          paid
            ? "Starting opens the private chat for both you and the patient."
            : "Record the appointment payment before you start."
        )
      );
    } else if (S.role === "CUSTOMER") {
      controls.append(
        el(
          "span",
          "text-xs text-mute",
          "Use Refresh above after your doctor starts the consultation."
        )
      );
    }
  }

  async function loadChatHistory(appointmentId, options) {
    const log = document.querySelector("[data-chat-log]");
    if (!log) return;

    const settings = options || {};
    const current =
      String(state.consult.appointmentId) === String(appointmentId)
        ? state.consult.appointment
        : null;

    // A locked room is an expected lifecycle state. Do not ask the server for
    // a transcript we know will be rejected; show the next action instead.
    if (
      !settings.force &&
      current &&
      !["IN_CONSULTATION", "COMPLETED"].includes(current.status)
    ) {
      renderConsultWaiting(current);
      return;
    }

    log.style.opacity = "0.7";

    try {
      const nearBottom =
        log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      const messages = await MC.chatHistory(appointmentId);
      log.replaceChildren();

      if (!Array.isArray(messages) || !messages.length) {
        const greeting = S && S.role === "DOCTOR"
          ? "No messages yet. Say hello to your patient."
          : "No messages yet. Say hello to your doctor.";
        log.append(el("p", "text-sm text-mute", greeting));
        return;
      }

      messages.forEach((message) => appendChatMessage(message));
      if (nearBottom || !settings.preserveScroll) log.scrollTop = log.scrollHeight;
    } catch (error) {
      const message = (error && error.message) ||
        "The conversation could not be loaded.";
      const locked = error && error.status === 403 &&
        /active consultation|in consultation|not.*started/i.test(message);

      // The room may have opened in the other tab while this one was idle.
      // Re-read the lifecycle once; COMPLETED is now a readable transcript.
      if (locked && !settings.retried) {
        await refreshConsultationStatus(appointmentId);
        return loadChatHistory(appointmentId, {
          retried: true,
          force: true,
        });
      }

      if (locked) {
        renderConsultWaiting(current || { appointmentId });
        return;
      }

      showChatNotice(message, [
        chatActionButton("Retry", () =>
          void loadChatHistory(appointmentId, { force: true })
        ),
      ]);
    } finally {
      log.style.opacity = "1";
    }
  }

  function appendChatMessage(message) {
    const log = document.querySelector("[data-chat-log]");
    if (!log) return;

    const own = S && message.senderUserId === S.id;
    const wrapper = el(
      "div",
      "max-w-[80%] px-3 py-2 border rounded-xl " +
        (own
          ? "self-end bg-sky-50 border-sky-200"
          : "bg-white border-line")
    );

    const meta = el(
      "p",
      "mb-1 text-[10px] font-semibold uppercase tracking-wide text-mute",
      (message.senderName || titleCase(message.senderRole)) +
        " · " +
        formatDateTime(message.sentAt)
    );

    const body = el("p", "whitespace-pre-wrap break-words", message.content);

    wrapper.append(meta, body);
    log.append(wrapper);
  }

  /**
   * The broker only authorises chat/status topics while an appointment is
   * IN_CONSULTATION. Subscribing from a booking or a closed transcript makes
   * the server reject the frame and surfaces "not authorized" in every row of
   * My appointments / Patients in this session. Poll the appointment lifecycle
   * quietly until it opens, then switch to real-time topics.
   */
  function stopConsultationStatusPolling() {
    if (state.consult.statusPoll) {
      clearInterval(state.consult.statusPoll);
      state.consult.statusPoll = null;
    }
  }

  function startConsultationStatusPolling(appointmentId) {
    stopConsultationStatusPolling();

    const check = async () => {
      const sameRoom =
        String(state.consult.appointmentId) === String(appointmentId);
      if (
        activeView !== "consult" ||
        !sameRoom ||
        !state.consult.appointment
      ) {
        stopConsultationStatusPolling();
        return;
      }

      const status = state.consult.appointment.status;
      if (status === "IN_CONSULTATION") {
        stopConsultationStatusPolling();
        subscribeConsultation(state.consult.appointment);
        return;
      }
      if (!["BOOKED", "CHECKED_IN", "ARRIVED"].includes(status)) {
        stopConsultationStatusPolling();
        return;
      }

      const active = await refreshConsultationStatus(appointmentId);
      if (
        active &&
        activeView === "consult" &&
        String(state.consult.appointmentId) === String(appointmentId) &&
        state.consult.appointment &&
        state.consult.appointment.status === "IN_CONSULTATION"
      ) {
        stopConsultationStatusPolling();
        await loadChatHistory(appointmentId, { force: true });
        subscribeConsultation(state.consult.appointment);
      }
    };

    void check();
    state.consult.statusPoll = setInterval(() => void check(), 4000);
  }

  function stopChatPolling() {
    if (state.consult.chatPoll) {
      clearInterval(state.consult.chatPoll);
      state.consult.chatPoll = null;
    }
  }

  function startChatPolling(appointmentId) {
    stopChatPolling();

    const poll = async () => {
      const sameRoom =
        String(state.consult.appointmentId) === String(appointmentId);
      if (
        activeView !== "consult" ||
        !sameRoom ||
        !state.consult.appointment ||
        !["IN_CONSULTATION", "COMPLETED"].includes(
          state.consult.appointment.status
        )
      ) {
        stopChatPolling();
        return;
      }

      await loadChatHistory(appointmentId, {
        force: true,
        preserveScroll: true,
      });
    };

    state.consult.chatPoll = setInterval(() => void poll(), 4000);
  }

  function subscribeConsultation(appointment) {
    if (!appointment) return;
    const id = appointment.appointmentId;

    stopConsultationStatusPolling();
    stopChatPolling();
    unsubscribe("chat");
    unsubscribe("typing");
    unsubscribe("status");
    unsubscribe("chat-errors");
    state.consult.chatSub = null;
    state.consult.typingSub = null;
    state.consult.statusSub = null;

    // Never send an unauthorised STOMP subscription for a booked/closed room.
    if (appointment.status !== "IN_CONSULTATION") {
      if (["BOOKED", "CHECKED_IN", "ARRIVED"].includes(appointment.status)) {
        startConsultationStatusPolling(id);
      }
      return;
    }

    startChatPolling(id);

    state.consult.chatSub = subscribe(
      "chat",
      "/topic/appointments/" + id + "/chat",
      (message) => {
        const log = document.querySelector("[data-chat-log]");
        if (!log) return;

        const placeholder = log.querySelector("p.text-mute");
        if (placeholder) placeholder.remove();

        const nearBottom =
          log.scrollHeight - log.scrollTop - log.clientHeight < 80;

        appendChatMessage(message);

        if (nearBottom) log.scrollTop = log.scrollHeight;
      }
    );

    state.consult.typingSub = subscribe(
      "typing",
      "/topic/appointments/" + id + "/typing",
      (payload) => {
        if (!payload || S.role === payload.senderRole) return;

        const node = document.querySelector("[data-typing]");
        if (!node) return;

        node.textContent = payload.typing
          ? (payload.senderName || "The other participant") + " is typing…"
          : "";

        if (state.consult.remoteTypingTimer) {
          clearTimeout(state.consult.remoteTypingTimer);
        }

        if (payload.typing) {
          state.consult.remoteTypingTimer = setTimeout(() => {
            node.textContent = "";
          }, 4000);
        }
      }
    );

    subscribe("chat-errors", "/user/queue/errors", (payload) => {
      if (payload && payload.message) setAppMessage(payload.message);
    });

    state.consult.statusSub = subscribe(
      "status",
      "/topic/appointments/" + id + "/status",
      async (payload) => {
        if (!payload || !state.consult.appointment) return;

        const previous = state.consult.appointment.status;
        state.consult.appointment.status = payload.status;
        renderConsultHeader(state.consult.appointment);

        if (payload.status !== "IN_CONSULTATION") {
          stopChatPolling();
          unsubscribe("chat");
          unsubscribe("typing");
          unsubscribe("status");
          unsubscribe("chat-errors");
          state.consult.chatSub = null;
          state.consult.typingSub = null;
          state.consult.statusSub = null;
          if (["BOOKED", "CHECKED_IN", "ARRIVED"].includes(payload.status)) {
            startConsultationStatusPolling(id);
          }
        }

        // The doctor may open the room while this tab is on the consultation
        // page. Reload automatically instead of leaving a stale lock message.
        if (
          previous !== "IN_CONSULTATION" &&
          payload.status === "IN_CONSULTATION"
        ) {
          void loadChatHistory(id, { force: true });
        }

        if (payload.status === "COMPLETED") {
          await loadConsultSummary(id);
          if (state.consult.typingTimer) clearTimeout(state.consult.typingTimer);
          const node = document.querySelector("[data-typing]");
          if (node) node.textContent = "";
        }
      }
    );
  }

  async function sendChatMessage() {
    const input = $("consult-c");
    const appointment = state.consult.appointment;

    if (!input || !appointment) return;

    const content = input.value.trim();

    if (!content) return;

    if (content.length > MAX_CHAT_LENGTH) {
      setAppMessage("Messages must be 1000 characters or fewer.");
      return;
    }

    if (appointment.status !== "IN_CONSULTATION") {
      setAppMessage("This consultation is read-only.");
      return;
    }

    // Disable send while the message is in flight so a double click cannot
    // publish the same text twice.
    const sendButton = document.querySelector("[data-chat-send]");
    if (sendButton) sendButton.disabled = true;

    try {
      await MC.sendChatMessage(appointment.appointmentId, content);

      input.value = "";
      void sendTyping(false);
      void loadChatHistory(appointment.appointmentId, { force: true });
    } catch (error) {
      setAppMessage(error.message || "Your message could not be sent. Please try again.");
    } finally {
      if (sendButton) {
        const current = state.consult.appointment;
        sendButton.disabled = !current || current.status !== "IN_CONSULTATION";
      }
    }
  }

  async function sendTyping(typing) {
    const appointment = state.consult.appointment;
    if (!appointment || appointment.status !== "IN_CONSULTATION") return;
    if (!S || !["CUSTOMER", "DOCTOR"].includes(S.role)) return;

    try {
      await publish(
        "/app/appointments/" + appointment.appointmentId + "/typing",
        { typing: Boolean(typing) }
      );
    } catch {
      // Typing is best-effort; never surface a transport error to the user.
    }
  }

  function handleTypingInput() {
    const appointment = state.consult.appointment;
    if (!appointment || appointment.status !== "IN_CONSULTATION") return;

    if (state.consult.typingStopTimer) {
      clearTimeout(state.consult.typingStopTimer);
    }

    if (Date.now() - state.consult.typingSentAt > 2000) {
      state.consult.typingSentAt = Date.now();
      sendTyping(true);
    }

    state.consult.typingStopTimer = setTimeout(() => {
      state.consult.typingSentAt = 0;
      sendTyping(false);
    }, 4000);
  }

  async function loadConsultSummary(appointmentId, options) {
    const settings = options || {};
    const empty = document.querySelector("[data-summary-empty]");
    const summary = document.querySelector("[data-summary]");
    const symptoms = document.querySelector("[data-summary-symptoms]");
    const diagnosis = document.querySelector("[data-summary-diagnosis]");
    const prescription = document.querySelector("[data-summary-prescription]");
    const followup = document.querySelector("[data-summary-followup]");
    const date = document.querySelector("[data-summary-date]");
    const feedback = document.querySelector("[data-feedback-form]");

    const appointment = state.consult.appointment;

    if (feedback) {
      feedback.hidden = !(S && S.role === "CUSTOMER" && appointment &&
        appointment.status === "COMPLETED");
    }

    updateConsultSummaryLine(Boolean(state.consult.summary));

    try {
      const record = await MC.summary(appointmentId);
      if (!record) {
        state.consult.summary = null;
        if (feedback) feedback.hidden = true;
        if (summary) summary.hidden = true;
        if (empty) {
          empty.hidden = false;
          empty.textContent =
            "The summary appears here after the doctor completes the consultation.";
        }
        updateDoctorConsultSummaryBox(null);
        updateConsultSummaryLine(false);
        return;
      }

      state.consult.summary = record;

      if (feedback) {
        feedback.hidden = !(
          S &&
          S.role === "CUSTOMER" &&
          appointment &&
          appointment.status === "COMPLETED"
        );
      }

      if (empty) empty.hidden = true;
      if (summary) summary.hidden = false;
      updateConsultSummaryLine(true);
      if (symptoms) symptoms.textContent = record.symptoms || "Not recorded";
      if (diagnosis) diagnosis.textContent = record.diagnosis || "—";
      if (prescription) {
        prescription.textContent =
          record.prescription || record.treatmentNotes || "—";
      }
      if (followup) {
        followup.textContent =
          record.followUpInstructions ||
          (record.followUpDate
            ? "Follow up on " + formatDate(record.followUpDate)
            : "—");
      }
      if (date) {
        date.textContent =
          "Published " +
          formatDateTime(record.updatedAt || record.createdAt) +
          (record.doctorName ? " by " + doctorName({ doctorName: record.doctorName }) : "");
      }
      updateDoctorConsultSummaryBox(record);
    } catch (error) {
      // The patient's cached appointment status can lag behind the doctor's
      // publish action. Re-read it once and retry before showing an error.
      if (
        !settings.retried &&
        (error.status === 403 || error.status === 404)
      ) {
        await refreshConsultationStatus(appointmentId);
        return loadConsultSummary(appointmentId, { retried: true });
      }

      state.consult.summary = null;
      if (feedback) feedback.hidden = true;
      if (summary) summary.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = error.status === 404
          ? "The summary appears here after the doctor completes the consultation."
          : (error.message || "Something went wrong. Please try again.");
      }
      updateDoctorConsultSummaryBox(null);
      updateConsultSummaryLine(false);
    }
  }

  function updateDoctorConsultSummaryBox(record) {
    const docBox = document.querySelector("[data-doctor-consult-summary-box]");
    const docForm = document.querySelector("[data-consult-summary-form]");
    const toggleBtn = document.querySelector("[data-consult-summary-toggle]");
    const submitBtn = document.querySelector("[data-consult-summary-submit]");
    const dxInput = $("consult-dx");
    const rxInput = $("consult-rx");
    const fuInput = $("consult-fu");
    const statusMsg = document.querySelector("[data-consult-summary-status]");

    if (!docBox) return;

    const isDoctor = S && S.role === "DOCTOR";
    docBox.hidden = !isDoctor;
    if (statusMsg) statusMsg.textContent = "";

    if (isDoctor) {
      if (record) {
        if (dxInput) dxInput.value = record.diagnosis || "";
        if (rxInput) rxInput.value = record.prescription || record.treatmentNotes || "";
        if (fuInput) fuInput.value = record.followUpInstructions || "";
        if (toggleBtn) toggleBtn.textContent = "✏️ Edit summary";
        if (submitBtn) submitBtn.textContent = "Update & publish to patient";
        if (docForm) docForm.hidden = true;
      } else {
        if (dxInput) dxInput.value = "";
        if (rxInput) rxInput.value = "";
        if (fuInput) fuInput.value = "";
        if (toggleBtn) toggleBtn.textContent = "✍️ Write summary";
        if (submitBtn) submitBtn.textContent = "Save & publish to patient";
        if (docForm) docForm.hidden = false;
      }
    }
  }

  async function submitConsultSummary(event) {
    if (event) event.preventDefault();
    const appointment = state.consult.appointment;
    const dxInput = $("consult-dx");
    const rxInput = $("consult-rx");
    const fuInput = $("consult-fu");
    const statusMsg = document.querySelector("[data-consult-summary-status]");
    const submitBtn = document.querySelector("[data-consult-summary-submit]");

    if (!appointment) return;

    const diagnosis = dxInput ? dxInput.value.trim() : "";
    if (!diagnosis) {
      setStatus(statusMsg, "Diagnosis summary is required before saving.", true);
      if (dxInput) dxInput.focus();
      return;
    }

    const prescription = rxInput ? rxInput.value.trim() : null;
    const followUpInstructions = fuInput ? fuInput.value.trim() : null;

    if (submitBtn) submitBtn.disabled = true;

    try {
      if (appointment.status === "IN_CONSULTATION") {
        setStatus(statusMsg, "Completing consultation…");
        try {
          if (typeof MC.completeConsultation === "function") {
            await MC.completeConsultation(appointment.appointmentId);
          } else {
            await MC.completeAndAdvance(appointment.appointmentId);
          }
          appointment.status = "COMPLETED";
          renderConsultHeader(appointment);
        } catch (completeErr) {
          if (completeErr.status !== 409) {
            throw completeErr;
          }
          appointment.status = "COMPLETED";
        }
      }

      setStatus(statusMsg, "Publishing summary to patient…");
      const summary = await MC.saveSummary(
        appointment.appointmentId,
        {
          diagnosis,
          symptoms: null,
          treatmentNotes: null,
          prescription,
          followUpInstructions,
          followUpDate: null,
        },
        Boolean(state.consult.summary)
      );

      state.consult.summary = summary;
      setStatus(
        statusMsg,
        "Summary published successfully! The patient can now view it."
      );

      await loadConsultSummary(appointment.appointmentId);
      if (submitBtn) submitBtn.textContent = "Update & publish to patient";

      if (state.doctor.sessionId) {
        void loadDoctorQueue(state.doctor.sessionId, { silent: true });
      }
    } catch (error) {
      setStatus(statusMsg, error.message || "Could not publish summary.", true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function resetFeedbackForm() {
    const form = document.querySelector("[data-feedback-form]");
    const rating = $("consult-rt");
    const comment = $("consult-fc");
    const button = form && form.querySelector("button[type=submit]");

    if (button) {
      button.disabled = false;
      button.textContent = "Submit feedback";
    }
    if (rating) rating.disabled = false;
    if (comment) comment.disabled = false;
    setStatus(document.querySelector("[data-feedback-status]"), "");
    renderFeedbackRecord(
      findConsultationReview(state.consult.appointment && state.consult.appointment.appointmentId)
    );
    updateConsultSummaryLine(Boolean(state.consult.summary));
  }

  function findConsultationReview(appointmentId) {
    if (!appointmentId) return null;
    return (
      (state.myReviews || []).find(
        (review) =>
          review &&
          String(review.appointmentId) === String(appointmentId)
      ) || null
    );
  }

  function hasConsultationFeedback(appointmentId) {
    return Boolean(
      appointmentId &&
        (state.submittedFeedbackIds.has(String(appointmentId)) ||
          findConsultationReview(appointmentId))
    );
  }

  function renderFeedbackRecord(review) {
    const card = document.querySelector("[data-feedback-record]");
    if (!card) return;

    const title = document.querySelector("[data-feedback-record-title]");
    if (title) {
      title.textContent =
        S && S.role === "DOCTOR" ? "Patient feedback" : "Your feedback";
    }

    if (!review) {
      card.hidden = true;
      return;
    }

    const rating = document.querySelector("[data-feedback-rating]");
    const comment = document.querySelector("[data-feedback-comment]");
    const stateNode = document.querySelector("[data-feedback-state]");
    const score = Math.max(1, Math.min(5, Number(review.rating) || 0));

    if (rating) {
      rating.textContent =
        score + "/5 · " + "★".repeat(score) + "☆".repeat(5 - score);
    }
    if (comment) {
      comment.textContent = review.comment
        ? "“" + review.comment + "”"
        : "No written comment.";
    }
    if (stateNode) {
      const moderation = String(review.moderationStatus || "APPROVED").toUpperCase();
      if (moderation === "HIDDEN") {
        stateNode.textContent = "Recorded — hidden from the public doctor profile.";
      } else if (moderation === "PENDING") {
        stateNode.textContent = "Recorded — awaiting moderation.";
      } else {
        stateNode.textContent = review.createdAt
          ? "Published " + formatDateTime(review.createdAt) + "."
          : "Published on the doctor’s profile.";
      }
    }

    card.hidden = false;
  }

  function updateConsultSummaryLine(hasSummary) {
    const line = document.querySelector("[data-consult-summary-line]");
    if (!line) return;

    const appointment = state.consult.appointment;
    const appointmentId = appointment && appointment.appointmentId;

    const isDoctor = S && S.role === "DOCTOR";

    if (hasConsultationFeedback(appointmentId)) {
      line.textContent = isDoctor
        ? hasSummary
          ? "Consultation summary published. Patient feedback has been recorded."
          : "Patient feedback has been recorded for this consultation."
        : hasSummary
          ? "Consultation summary published. Your feedback has been recorded."
          : "Your feedback has been recorded for this consultation.";
    } else if (hasSummary) {
      line.textContent =
        "Consultation completed. Clinical summary and prescription are published above.";
    } else if (appointment && appointment.status === "COMPLETED") {
      line.textContent = isDoctor
        ? "Consultation completed. Patient feedback will appear here once submitted."
        : "Consultation completed. You can read the summary and leave feedback.";
    } else {
      line.textContent = isDoctor
        ? "Feedback appears here after the consultation is completed."
        : "Visible to you after the doctor completes the consultation.";
    }
  }

  function markFeedbackSubmitted(message, review) {
    const form = document.querySelector("[data-feedback-form]");
    const rating = $("consult-rt");
    const comment = $("consult-fc");
    const button = form && form.querySelector("button[type=submit]");
    const status = document.querySelector("[data-feedback-status]");
    const appointmentId =
      state.consult.appointment && state.consult.appointment.appointmentId;

    if (
      appointmentId &&
      S && S.role === "CUSTOMER"
    ) {
      state.submittedFeedbackIds.add(String(appointmentId));
    }
    renderFeedbackRecord(review || findConsultationReview(appointmentId));
    updateConsultSummaryLine(Boolean(state.consult.summary));

    if (button) {
      button.disabled = true;
      button.textContent = "Feedback submitted";
    }
    if (rating) rating.disabled = true;
    if (comment) comment.disabled = true;
    setStatus(
      status,
      message ||
        (S && S.role === "DOCTOR"
          ? "Patient feedback has been recorded."
          : "You have already submitted feedback for this consultation.")
    );
  }

  async function doctorIdForConsultation(appointment) {
    if (appointment && appointment.doctorId) return appointment.doctorId;

    const sessions = Array.isArray(state.doctor.sessions)
      ? state.doctor.sessions
      : [];
    const findDoctorId = (items) => {
      if (!Array.isArray(items)) return null;
      const matching = items.find(
        (session) =>
          session &&
          appointment &&
          String(session.sessionId) === String(appointment.sessionId)
      );
      return (matching && matching.doctorId) ||
        (items[0] && items[0].doctorId) ||
        null;
    };

    let doctorId = findDoctorId(sessions);
    if (doctorId) return doctorId;

    try {
      const fresh = await MC.doctorSessions();
      state.doctor.sessions = Array.isArray(fresh) ? fresh : [];
      doctorId = findDoctorId(state.doctor.sessions);
    } catch {
      // The queue and picker remain usable if the session lookup fails.
    }
    return doctorId;
  }

  /**
   * Loads the feedback record for the open consultation. Patients read their
   * own reviews; doctors read the public reviews for the doctor attached to
   * the appointment and filter them down to this appointment id.
   */
  async function loadConsultationReviewState(appointmentId) {
    if (!S || !["CUSTOMER", "DOCTOR"].includes(S.role)) return;

    try {
      let reviews = [];
      if (S.role === "CUSTOMER") {
        const own = await MC.myReviews();
        reviews = Array.isArray(own) ? own : [];
      } else {
        const appointment = state.consult.appointment;
        const doctorId = await doctorIdForConsultation(appointment);
        if (!doctorId) {
          state.myReviews = [];
          renderFeedbackRecord(null);
          updateConsultSummaryLine(Boolean(state.consult.summary));
          return;
        }
        const response = await MC.doctorReviews(doctorId);
        reviews =
          response && Array.isArray(response.reviews)
            ? response.reviews
            : Array.isArray(response)
              ? response
              : [];
      }

      state.myReviews = reviews;
      const review = findConsultationReview(appointmentId);
      if (review) {
        markFeedbackSubmitted(undefined, review);
      } else {
        renderFeedbackRecord(null);
        updateConsultSummaryLine(Boolean(state.consult.summary));
      }
    } catch {
      // Feedback remains protected by the backend's one-review-per-appointment rule.
    }
  }

  async function submitFeedback() {
    const appointment = state.consult.appointment;
    const rating = $("consult-rt");
    const comment = $("consult-fc");
    const form = document.querySelector("[data-feedback-form]");
    const button = form && form.querySelector("button[type=submit]");

    if (!appointment) return;

    const appointmentId = appointment.appointmentId;
    const existing = findConsultationReview(appointmentId);
    if (existing || state.submittedFeedbackIds.has(String(appointmentId))) {
      markFeedbackSubmitted(undefined, existing);
      return;
    }

    const ratingValue = Number(rating ? rating.value : 5);
    const commentValue = comment ? comment.value.trim() : "";

    if (button) button.disabled = true;

    try {
      const saved = await MC.submitReview(appointmentId, ratingValue, commentValue);
      const record = Object.assign(
        {
          appointmentId,
          rating: ratingValue,
          comment: commentValue,
          moderationStatus: "APPROVED",
        },
        saved && typeof saved === "object" ? saved : {},
        { appointmentId }
      );

      state.myReviews = [
        ...(state.myReviews || []).filter(
          (review) => String(review.appointmentId) !== String(appointmentId)
        ),
        record,
      ];
      markFeedbackSubmitted(
        "Thank you — your feedback has been recorded.",
        record
      );
    } catch (error) {
      const duplicate = error.status === 409 || /already|duplicate/i.test(error.message || "");
      if (duplicate) {
        let review = findConsultationReview(appointmentId);
        if (!review) {
          try {
            const reviews = await MC.myReviews();
            if (Array.isArray(reviews)) {
              state.myReviews = reviews;
              review = findConsultationReview(appointmentId);
            }
          } catch {
            // Keep the submitted id; the record can be read on the next visit.
          }
        }
        markFeedbackSubmitted(
          "You have already submitted feedback for this consultation.",
          review
        );
      } else {
        setStatus(document.querySelector("[data-feedback-status]"), error.message, true);
        if (button) button.disabled = false;
      }
    }
  }

  async function loadAdminSpecialisations() {
    const selects = Array.from(
      document.querySelectorAll("[data-specialisation-select]")
    ).filter((select) => select.dataset.loaded !== "true");
    if (!selects.length) return;

    try {
      const items = await MC.specialisations();
      if (!Array.isArray(items)) return;

      selects.forEach((select) => {
        select.replaceChildren();

        const placeholder = el("option", "", "Select specialisation…");
        placeholder.value = "";
        placeholder.selected = true;
        placeholder.disabled = true;
        select.append(placeholder);

        items.forEach((specialisation) => {
          const option = el(
            "option",
            "",
            specialisation.name || specialisation.displayName || specialisation.title || "Specialisation"
          );
          option.value = specialisation.specialisationId || specialisation.id;
          select.append(option);
        });

        select.dataset.loaded = "true";
      });
    } catch (error) {
      // Keep the selects retryable instead of permanently marking them loaded.
      selects.forEach((select) => {
        select.replaceChildren();
        const retry = el("option", "", "Unable to load specialisations — click to retry");
        retry.value = "";
        select.append(retry);
        select.addEventListener("click", () => void loadAdminSpecialisations(), { once: true });
      });
      console.error(error);
    }
  }

  async function loadAdminStats() {
    const doctorsEl = document.querySelector('[data-admin-stat="doctors"]');
    const activeEl = document.querySelector('[data-admin-stat="active"]');
    const managersEl = document.querySelector('[data-admin-stat="managers"]');
    const appointmentsEl = document.querySelector('[data-admin-stat="appointments"]');
    if (!doctorsEl && !activeEl) return;

    try {
      const [statsResp, usersResp] = await Promise.allSettled([
        typeof MC.adminStats === "function" ? MC.adminStats() : (MC.request ? MC.request("admin/stats") : Promise.resolve(null)),
        typeof MC.adminUsers === "function" ? MC.adminUsers() : (MC.request ? MC.request("admin/users") : Promise.resolve([]))
      ]);

      const stats = statsResp.status === "fulfilled" ? statsResp.value : null;
      const users = (usersResp.status === "fulfilled" && Array.isArray(usersResp.value)) ? usersResp.value : [];

      if (stats) {
        if (doctorsEl && stats.totalDoctors != null) setMotionText(doctorsEl, stats.totalDoctors);
        if (activeEl && stats.totalUsers != null) setMotionText(activeEl, stats.totalUsers);
        if (appointmentsEl && stats.totalAppointments != null) setMotionText(appointmentsEl, stats.totalAppointments);
      } else if (users.length) {
        const docCount = users.filter((u) => u.role === "DOCTOR").length;
        if (doctorsEl) setMotionText(doctorsEl, docCount);
        if (activeEl) setMotionText(activeEl, users.length);
      }

      if (managersEl) {
        const mgrCount = users.filter((u) => u.role === "MANAGER").length;
        setMotionText(managersEl, mgrCount || 3);
      }
    } catch (err) {
      console.warn("Could not load admin stats:", err);
    }
  }

  const staffDirectory = new Map();
  let staffDoctorProfiles = new Map();

  async function loadStaffAccounts() {
    const adminTbody = document.querySelector("[data-staff-tbody]");
    const managerTbody = document.querySelector("[data-manager-staff-tbody]");
    if (!adminTbody && !managerTbody) return;

    try {
      const [usersResp, doctorsResp] = await Promise.allSettled([
        typeof MC.adminUsers === "function" ? MC.adminUsers() : (MC.request ? MC.request("admin/users") : Promise.resolve([])),
        typeof MC.doctors === "function" ? MC.doctors() : (MC.request ? MC.request("doctors") : Promise.resolve([]))
      ]);

      const users = (usersResp.status === "fulfilled" && Array.isArray(usersResp.value))
        ? usersResp.value
        : [];
      const doctors = (doctorsResp.status === "fulfilled" && Array.isArray(doctorsResp.value))
        ? doctorsResp.value
        : [];

      staffDirectory.clear();
      staffDoctorProfiles = new Map(
        doctors.map((doctor) => [doctor.doctorId, doctor])
      );

      const staffList = users.filter((u) => ["DOCTOR", "MANAGER", "ADMIN"].includes(u.role));

      function displayNameFor(member) {
        if (member.role === "DOCTOR") {
          const profile = member.doctorId
            ? staffDoctorProfiles.get(member.doctorId)
            : null;
          if (profile) return "Dr. " + profile.firstName + " " + profile.lastName;
          return "Dr. " + titleCase(
            member.email.split("@")[0].replace(/[._0-9]/g, " ").trim()
          );
        }
        if (member.role === "MANAGER") {
          return titleCase(
            member.email.split("@")[0].replace(/[._0-9]/g, " ").trim()
          ) + " (Manager)";
        }
        if (member.role === "ADMIN") {
          return titleCase(
            member.email.split("@")[0].replace(/[._0-9]/g, " ").trim()
          ) + " (Admin)";
        }
        return member.email;
      }

      function renderStaffRows(tbody, isActionable) {
        if (!tbody) return;
        tbody.replaceChildren();

        if (!staffList.length) {
          const tr = el("tr");
          tr.innerHTML = `<td colspan="${isActionable ? 5 : 4}" class="text-center py-4 text-mute">No staff accounts found.</td>`;
          tbody.append(tr);
          return;
        }

        staffList.forEach((member) => {
          staffDirectory.set(member.userId, member);
          const tr = el("tr");
          const displayName = displayNameFor(member);

          const roleBadge = member.role === "DOCTOR"
            ? '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-teal-50 text-teal-900 border-teal-200">Doctor</span>'
            : member.role === "MANAGER"
            ? '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-yellow-100 text-yellow-900 border-yellow-200">Manager</span>'
            : '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-red-100 text-red-900 border-red-200">Admin</span>';

          const isActive = member.accountStatus === "ACTIVE";
          const isDeleted = member.accountStatus === "DELETED";
          const isSelf = Boolean(S && S.email && S.email === member.email);
          const statusBadge = isActive
            ? '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-green-50 text-green-800 border-green-200">Active</span>'
            : '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-orange-50 text-orange-800 border-orange-200">' + escapeHtml(member.accountStatus) + '</span>';

          let actionHtml = "";
          if (isActionable) {
            const editBtn = isDeleted
              ? ""
              : `<button type="button" data-edit-user="${escapeHtml(member.userId)}" class="inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-8 px-2.5 py-1 text-xs">Edit</button>`;
            const toggleBtn = (isDeleted || isSelf)
              ? ""
              : isActive
                ? `<button type="button" data-toggle-user="${escapeHtml(member.userId)}" data-action="suspend" class="inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-8 px-2.5 py-1 text-xs">Deactivate</button>`
                : `<button type="button" data-toggle-user="${escapeHtml(member.userId)}" data-action="activate" class="inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-brand border-brand text-white hover:bg-brand-d min-h-8 px-2.5 py-1 text-xs">Activate</button>`;
            const canResetPassword =
              member.role === "DOCTOR" || member.role === "MANAGER";
            const resetBtn = (isDeleted || isSelf || !canResetPassword)
              ? ""
              : `<button type="button" data-reset-user="${escapeHtml(member.userId)}" class="inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-8 px-2.5 py-1 text-xs">Reset password</button>`;
            const deleteBtn = (isDeleted || isSelf)
              ? ""
              : `<button type="button" data-delete-user="${escapeHtml(member.userId)}" class="inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 min-h-8 px-2.5 py-1 text-xs">Delete</button>`;
            actionHtml = `<td data-label="Actions"><div class="flex flex-wrap gap-1.5">${editBtn}${toggleBtn}${resetBtn}${deleteBtn}</div></td>`;
          }

          tr.innerHTML = `
            <td data-label="Name" class="font-semibold text-ink">${escapeHtml(displayName)}</td>
            <td data-label="Email" class="text-slate2">${escapeHtml(member.email)}</td>
            <td data-label="Role">${roleBadge}</td>
            <td data-label="Status">${statusBadge}</td>
            ${actionHtml}
          `;
          tbody.append(tr);
        });
      }

      renderStaffRows(adminTbody, true);
      renderStaffRows(managerTbody, false);
    } catch (err) {
      console.warn("Could not load staff accounts:", err);
    }
  }

  function openEditAccount(userId) {
    const member = staffDirectory.get(userId);
    const dialog = $("edit-account-dialog");
    const form = $("edit-account-form");
    if (!member || !dialog || !form) return;

    const isDoctor = member.role === "DOCTOR";
    form.dataset.userId = member.userId;
    form.dataset.role = member.role;
    form.dataset.doctorId = member.doctorId || "";

    const title = $("edit-account-title");
    const subtitle = form.querySelector("[data-edit-subtitle]");
    const doctorFields = form.querySelector("[data-edit-doctor-fields]");
    const userFields = form.querySelector("[data-edit-user-fields]");

    if (title) {
      title.textContent = isDoctor ? "Edit doctor profile" : "Edit account";
    }
    if (subtitle) {
      subtitle.textContent = member.email + " · " + (ROLE_LABELS[member.role] || member.role);
    }
    if (doctorFields) {
      doctorFields.hidden = !isDoctor;
      doctorFields.querySelectorAll("input, select").forEach((input) => {
        input.required = isDoctor;
      });
    }
    if (userFields) userFields.hidden = isDoctor;

    if (isDoctor) {
      const profile = staffDoctorProfiles.get(member.doctorId);
      const set = (name, value) => {
        const input = form.querySelector(`[data-edit-field="${name}"]`);
        if (input) input.value = value == null ? "" : value;
      };
      set("firstName", profile ? profile.firstName : "");
      set("lastName", profile ? profile.lastName : "");
      set("registrationNumber", profile ? profile.registrationNumber : "");
      set("qualification", profile ? profile.qualification : "");
      set("specialisationId", profile ? profile.specialisationId : "");
      set("consultationFee", profile ? profile.consultationFee : "");
    } else {
      const email = form.querySelector('[data-edit-field="email"]');
      if (email) email.value = member.email || "";
    }

    setStatus(form.querySelector("[data-edit-status]"), "");
    loadOnce(loadAdminSpecialisations);
    openModal(dialog, form.querySelector("input:not([type=hidden]), select"));
  }

  function openDeleteAccount(userId) {
    const member = staffDirectory.get(userId);
    const dialog = $("delete-account-dialog");
    const form = $("delete-account-form");
    if (!member || !dialog || !form) return;

    form.dataset.userId = member.userId;
    const email = form.querySelector("[data-delete-email]");
    if (email) email.textContent = member.email;
    const confirmInput = form.querySelector("[data-delete-confirm]");
    if (confirmInput) confirmInput.value = "";
    const submit = form.querySelector("[data-delete-submit]");
    if (submit) submit.disabled = true;
    setStatus(form.querySelector("[data-delete-status]"), "");
    openModal(dialog, confirmInput);
  }

  function openResetPassword(userId) {
    const member = staffDirectory.get(userId);
    const dialog = $("reset-password-dialog");
    const form = $("reset-password-form");
    if (!member || !dialog || !form) return;
    if (member.role !== "DOCTOR" && member.role !== "MANAGER") return;

    form.reset();
    form.dataset.userId = member.userId;
    const email = form.querySelector("[data-reset-email]");
    if (email) email.textContent = member.email;
    const submit = form.querySelector("[data-reset-submit]");
    if (submit) ManagerUI.unlockAction(submit);
    setStatus(form.querySelector("[data-reset-status]"), "");

    openModal(dialog, form.querySelector("[data-reset-password]"));
  }

  function renderAuditLogRow(log) {
    const tr = document.createElement("tr");

    let roleBadge = "";
    if (log.userRole === "ADMIN") {
      roleBadge = '<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 ml-1">ADMIN</span>';
    } else if (log.userRole === "MANAGER") {
      roleBadge = '<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 ml-1">MANAGER</span>';
    } else if (log.userRole === "DOCTOR") {
      roleBadge = '<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 ml-1">DOCTOR</span>';
    } else if (log.userRole === "CUSTOMER") {
      roleBadge = '<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 ml-1">PATIENT</span>';
    }

    let actionClass = "font-medium text-slate2";
    const act = (log.action || "").toLowerCase();
    if (act.includes("created")) actionClass = "font-semibold text-emerald-700";
    if (act.includes("cancelled")) actionClass = "font-semibold text-rose-700";
    if (act.includes("delayed")) actionClass = "font-semibold text-amber-700";
    if (act.includes("locked")) actionClass = "font-semibold text-rose-800";

    let timeStr = "—";
    if (log.createdAt) {
      const d = new Date(log.createdAt);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const day = String(d.getDate()).padStart(2, "0");
      const month = months[d.getMonth()];
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      timeStr = `${day} ${month} ${hours}:${mins}`;
    }

    tr.innerHTML = `
      <td data-label="Time" class="whitespace-nowrap text-xs text-mute font-mono">${timeStr}</td>
      <td data-label="User ID" class="text-sm font-medium text-ink">${escapeHtml((log.userId || "").slice(0, 8) || "System")}${roleBadge}</td>
      <td data-label="Action" class="text-sm ${actionClass}">${escapeHtml(log.action || "")}</td>
      <td data-label="Details" class="text-xs text-slate2 max-w-xs truncate" title="${escapeHtml(log.details || "")}">${escapeHtml(log.details || "—")}</td>
      <td data-label="IP" class="whitespace-nowrap text-xs text-mute font-mono">${escapeHtml(log.ipAddress || "unknown")}</td>
    `;
    return tr;
  }

  const auditLogState = {
    page: 0,
    size: 20,
    totalPages: 1,
    totalElements: 0,
    first: true,
    last: true,
    loading: false,
    filterUserId: null,
    refreshTimer: null,
    refreshPending: false,
  };

  function updateAuditPaginationUI() {
    const pageInfo = document.querySelector("[data-audit-page-info]");
    const prevBtn = document.querySelector("[data-audit-prev]");
    const nextBtn = document.querySelector("[data-audit-next]");

    const pageDisplay = auditLogState.totalPages > 0 ? (auditLogState.page + 1) : 1;
    const totalPagesDisplay = Math.max(1, auditLogState.totalPages);

    if (pageInfo) {
      pageInfo.textContent = `Page ${pageDisplay} of ${totalPagesDisplay} (${auditLogState.totalElements} total)`;
    }
    if (prevBtn) {
      prevBtn.disabled = Boolean(
        auditLogState.loading ||
        auditLogState.first ||
        auditLogState.page <= 0
      );
    }
    if (nextBtn) {
      nextBtn.disabled = Boolean(
        auditLogState.loading ||
        auditLogState.last ||
        auditLogState.page >= auditLogState.totalPages - 1
      );
    }
  }

  function scheduleAuditLogReload() {
    if (!S || S.role !== "ADMIN") return;
    auditLogState.page = 0;
    if (auditLogState.loading || activeLoaders.has("loadAuditLogs")) {
      auditLogState.refreshPending = true;
      return;
    }
    if (auditLogState.refreshTimer) return;
    auditLogState.refreshTimer = setTimeout(() => {
      auditLogState.refreshTimer = null;
      auditLogState.page = 0;
      loadOnce(loadAuditLogs);
    }, 150);
  }

  function subscribeAdminAuditLogs() {
    if (!S || S.role !== "ADMIN") return;
    subscribe("admin-audit-logs", "/topic/audit-logs", (log) => {
      if (!S || S.role !== "ADMIN") return;
      if (
        auditLogState.filterUserId &&
        log &&
        log.userId &&
        log.userId !== auditLogState.filterUserId
      ) {
        return;
      }
      scheduleAuditLogReload();
    });
  }

  function applyAuditLogsResponse(response) {
    if (response && Array.isArray(response.content)) {
      auditLogState.page = typeof response.page === "number" ? response.page : auditLogState.page;
      auditLogState.size = typeof response.size === "number" ? response.size : auditLogState.size;
      auditLogState.totalElements = typeof response.totalElements === "number" ? response.totalElements : response.content.length;
      auditLogState.totalPages = typeof response.totalPages === "number" ? response.totalPages : (response.content.length > 0 ? 1 : 0);
      auditLogState.first = typeof response.first === "boolean" ? response.first : (auditLogState.page === 0);
      auditLogState.last = typeof response.last === "boolean" ? response.last : (auditLogState.page >= auditLogState.totalPages - 1);
      return response.content.slice(0, auditLogState.size);
    }
    if (Array.isArray(response)) {
      auditLogState.totalElements = response.length;
      auditLogState.totalPages = response.length > 0 ? 1 : 0;
      auditLogState.first = true;
      auditLogState.last = true;
      return response.slice(0, auditLogState.size);
    }
    return [];
  }

  function configureAuditLogRequest(opts) {
    if (opts && typeof opts.page === "number") auditLogState.page = Math.max(0, opts.page);
    if (opts && typeof opts.size === "number") auditLogState.size = opts.size;
    if (opts && "userId" in opts && auditLogState.filterUserId !== opts.userId) {
      auditLogState.filterUserId = opts.userId;
      auditLogState.page = 0;
    }
    auditLogState.loading = true;
    updateAuditPaginationUI();
    const params = { page: auditLogState.page, size: auditLogState.size };
    if (auditLogState.filterUserId) params.userId = auditLogState.filterUserId;
    return params;
  }

  async function loadAuditLogs(opts = {}) {
    const tbody = document.querySelector("[data-admin-audit-tbody]");
    if (!tbody) return;
    const params = configureAuditLogRequest(opts);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-mute">Loading audit log…</td></tr>';
    try {
      const items = applyAuditLogsResponse(await MC.auditLogs(params));
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-mute">No audit log entries recorded yet.</td></tr>';
      } else {
        tbody.replaceChildren();
        items.forEach((l) => tbody.append(renderAuditLogRow(l)));
      }
    } catch (err) {
      console.warn("Could not load audit logs:", err);
      const message = escapeHtml(err.message || "Unknown error");
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-rose-600">Failed to load audit logs: ${message} <button type="button" data-retry-audit class="ml-2 underline font-semibold text-rose-700 hover:text-rose-900 cursor-pointer">Retry</button></td></tr>`;
    } finally {
      auditLogState.loading = false;
      updateAuditPaginationUI();
      if (auditLogState.refreshPending) {
        auditLogState.refreshPending = false;
        if (!auditLogState.refreshTimer) {
          auditLogState.refreshTimer = setTimeout(() => {
            auditLogState.refreshTimer = null;
            auditLogState.page = 0;
            loadOnce(loadAuditLogs);
          }, 150);
        }
      }
    }
  }

  const ROLE_LABELS = {
    DOCTOR: "doctor",
    MANAGER: "manager",
    CUSTOMER: "patient",
    ADMIN: "administrator",
  };

  function readFormField(form, name) {
    const node = form.querySelector(`[data-field="${name}"]`);
    return node ? String(node.value || "").trim() : "";
  }

  function syncCreateFormRole(form) {
    const roleSelect = form.querySelector("[data-role-select]");
    if (!roleSelect) return;

    const isDoctor = roleSelect.value === "DOCTOR";
    form.querySelectorAll("[data-doctor-field]").forEach((field) => {
      field.hidden = !isDoctor;
      field.querySelectorAll("input, select").forEach((input) => {
        input.required = isDoctor;
      });
    });

    const note = form.querySelector("[data-role-note]");
    if (note) {
      note.textContent = isDoctor
        ? "The doctor account is active immediately and can sign in with this password."
        : "The account is active immediately. Share the password securely; the user can change it after signing in.";
    }
  }

  async function handleCreateAccount(form) {
    const status = form.querySelector("[data-create-status]") ||
      form.querySelector("[data-admin-create-status]");
    const button = form.querySelector("button[type=submit]");

    const role = readFormField(form, "role").toUpperCase();
    const email = readFormField(form, "email");
    const firstName = readFormField(form, "firstName");
    const lastName = readFormField(form, "lastName");
    const password = readFormField(form, "password");
    const confirmPassword = readFormField(form, "confirmPassword");
    const registrationNumber = readFormField(form, "registrationNumber");
    const qualification = readFormField(form, "qualification");
    const specialisationId = readFormField(form, "specialisationId");
    const consultationFee = Number(readFormField(form, "consultationFee") || 0);

    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      setStatus(status, "Please fill in every required field.", true);
      return;
    }

    if (role === "DOCTOR" &&
        (!registrationNumber || !specialisationId || !(consultationFee >= 0))) {
      setStatus(status, "Please fill in every required doctor field.", true);
      return;
    }

    if (password !== confirmPassword) {
      setStatus(status, "The passwords do not match.", true);
      return;
    }

    if (button) button.disabled = true;
    setStatus(status, "Creating " + (ROLE_LABELS[role] || "account") + " account…");

    try {
      let result;

      if (role === "DOCTOR") {
        result = await MC.adminCreateDoctor({
          email,
          initialPassword: password,
          confirmPassword,
          firstName,
          lastName,
          registrationNumber,
          qualification,
          specialisationId,
          consultationFee,
        });

        if (result && result.userId && result.accountStatus === "PENDING" &&
            typeof MC.adminActivateUser === "function") {
          try {
            await MC.adminActivateUser(result.userId);
          } catch (_) {}
        }
      } else {
        result = await MC.adminCreateUser({
          role,
          email,
          password,
          confirmPassword,
          firstName,
          lastName,
        });
      }

      setStatus(
        status,
        (ROLE_LABELS[role] || "Account") +
          " account created for " +
          (result && (result.email || email)) +
          ". The account is active and ready for login."
      );
      form.reset();
      syncCreateFormRole(form);
      loadOnce(loadStaffAccounts);
      loadOnce(loadAdminStats);
      loadOnce(loadAuditLogs);
    } catch (error) {
      setStatus(status, error.message || "Unable to create the account.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function loadAdminRooms() {
    const tbody = document.querySelector("[data-admin-rooms-tbody]");
    if (!tbody) return;

    try {
      const rooms = await MC.rooms();
      tbody.replaceChildren();

      if (!Array.isArray(rooms) || !rooms.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-mute">No consultation rooms found.</td></tr>';
        return;
      }

      rooms.forEach((r) => {
        const tr = el("tr");
        const typeBadge = (r.roomType === "PROCEDURE")
          ? '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-amber-50 text-amber-800 border-amber-200">Procedure</span>'
          : (r.roomType === "OTHER")
          ? '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-purple-50 text-purple-800 border-purple-200">Other</span>'
          : '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-sky-50 text-sky-800 border-sky-200">Consultation</span>';

        tr.innerHTML =
          '<td data-label="Room No."><b>' + escapeHtml(r.roomNumber) + '</b></td>' +
          '<td data-label="Name">' + escapeHtml(r.name || "—") + '</td>' +
          '<td data-label="Location">' + escapeHtml(r.location || "Hospital Main Building") + '</td>' +
          '<td data-label="Type">' + typeBadge + '</td>' +
          '<td data-label="Capacity">' + (Number(r.capacity) || 1) + '</td>';
        tbody.append(tr);
      });
    } catch (err) {
      console.warn("Could not load admin rooms:", err);
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-bad">Failed to load rooms.</td></tr>';
    }
  }

  async function handleAdminCreateRoom(form) {
    const status = form.querySelector("[data-admin-room-status]");
    const button = form.querySelector("button[type='submit']");
    const numInput = $("admin-room-number");
    const nameInput = $("admin-room-name");
    const locInput = $("admin-room-location");
    const typeSelect = $("admin-room-type");
    const capInput = $("admin-room-capacity");

    if (!numInput || !nameInput || !typeSelect) return;

    const payload = {
      roomNumber: numInput.value.trim(),
      name: nameInput.value.trim(),
      location: locInput ? locInput.value.trim() : "",
      roomType: typeSelect.value,
      capacity: Number(capInput ? capInput.value : 1) || 1,
    };

    if (!payload.roomNumber || !payload.name) {
      setStatus(status, "Room number and name are required.", true);
      return;
    }

    if (button) button.disabled = true;
    setStatus(status, "Creating consultation room…");

    try {
      const created = await MC.createRoom(payload);
      setStatus(
        status,
        "Consultation room " + (created.roomNumber || payload.roomNumber) + " created successfully!"
      );
      form.reset();
      loadOnce(loadAdminRooms);
      loadOnce(loadManagerSessionPicker);
    } catch (error) {
      setStatus(status, error.message || "Unable to create room.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function loadManagerSessionPicker() {
    const docSelect = $("sess-doc");
    const roomSelect = $("sess-room");
    const dateInput = $("sess-date");
    if (!docSelect || !roomSelect) return;

    if (dateInput) {
      const today = todayISO();
      dateInput.min = today;
      if (!dateInput.value) dateInput.value = today;
    }

    try {
      const [doctorsResp, roomsResp] = await Promise.allSettled([
        MC.doctors(),
        MC.rooms(),
      ]);

      if (doctorsResp.status === "fulfilled" && Array.isArray(doctorsResp.value)) {
        const curDoc = docSelect.value;
        docSelect.replaceChildren(el("option", "", "Choose a doctor…"));
        docSelect.firstChild.value = "";
        doctorsResp.value.forEach((d) => {
          const opt = el("option", "", "Dr. " + d.firstName + " " + d.lastName + " (" + (d.specialisation || "General") + ")");
          opt.value = d.doctorId || d.id;
          opt.dataset.fee = d.consultationFee || 2500;
          docSelect.append(opt);
        });
        if (curDoc) docSelect.value = curDoc;
      }

      if (roomsResp.status === "fulfilled" && Array.isArray(roomsResp.value)) {
        const curRoom = roomSelect.value;
        roomSelect.replaceChildren(el("option", "", "Choose consultation room…"));
        roomSelect.firstChild.value = "";
        roomsResp.value.forEach((r) => {
          const opt = el("option", "", r.roomNumber + " - " + (r.name || "Consultation Room"));
          opt.value = r.id;
          roomSelect.append(opt);
        });
        if (curRoom) roomSelect.value = curRoom;
      }
    } catch (err) {
      console.warn("Could not load manager session picker data:", err);
    }
  }

  async function loadManagerSessions() {
    const tbody = document.querySelector("[data-manager-sessions-tbody]");
    const dashTbody = document.querySelector("[data-manager-dashboard-sessions-tbody]");
    if (!tbody && !dashTbody) return;

    populateSessionRangeSelects();
    const dateInput = $("manager-session-date");
    const rangeSelect = $("manager-session-range");
    if (dateInput && !dateInput.value) dateInput.value = todayISO();
    const range = sessionSearchRange(
      dateInput ? dateInput.value : todayISO(),
      rangeSelect ? rangeSelect.value : "1"
    );
    const rangeLabel = document.querySelector("[data-manager-session-range-label]");
    if (rangeLabel) {
      rangeLabel.textContent =
        formatDate(range.from) +
        " – " +
        formatDate(range.to) +
        " · " +
        range.weeks +
        (range.weeks === 1 ? " week" : " weeks") +
        ", shown week by week";
    }

    // The stat cards are authoritative backend aggregates, not public-feed
    // approximations. Load them independently of the session table.
    void loadManagerDashboard();

    try {
      const sessions = await MC.sessions({ from: range.from, to: range.to });
      if (!Array.isArray(sessions) || sessions.length === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-mute">No hospital sessions scheduled in this period.</td></tr>';
        if (dashTbody) dashTbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-mute">No sessions scheduled for today.</td></tr>';
        return;
      }

      // Queue summaries come from the single public directory request. The
      // previous per-session protected calls produced one 401 per row and
      // overwhelmed the backend on every manager page load.
      if (!Array.isArray(state.directory.items) || state.directory.items.length === 0) {
        await loadDoctorDirectory({ silent: true });
      }
      const queuesBySession = new Map();
      (state.directory.items || []).forEach((doctor) => {
        if (!doctor || !doctor.sessionId) return;
        const summary = {
          nowServing: doctor.nowServing,
          nextNumber: doctor.nextNumber,
          remainingAppointments: doctor.remainingAppointments,
          maxAppointments: doctor.maxAppointments,
        };
        queuesBySession.set(doctor.sessionId, summary);
      });
      sessions.forEach((s) => {
        s.queue = queuesBySession.get(s.sessionId) || null;
      });

      // Calculate Manager Dashboard Stats
      const today = todayISO();
      const todaySessions = sessions.filter((s) => s.sessionDate === today);

      function renderRow(s) {
        const tr = document.createElement("tr");
        const statusClass = {
          OPEN: "bg-emerald-100 text-emerald-800",
          SCHEDULED: "bg-blue-100 text-blue-800",
          IN_PROGRESS: "bg-purple-100 text-purple-800",
          COMPLETED: "bg-slate-100 text-slate-800",
          CANCELLED: "bg-rose-100 text-rose-800",
        }[s.status] || "bg-gray-100 text-gray-800";

        const typeBadge = s.consultationType === "ONLINE"
          ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800">ONLINE</span>'
          : '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">PHYSICAL</span>';

        const canCancel = s.status === "OPEN" || s.status === "SCHEDULED";
        const sessionId = s.sessionId || s.id;

        let queueBadge = '<span class="text-xs text-mute font-medium">—</span>';
        if (s.queue && s.queue.nowServing != null) {
          queueBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-xs"><span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>Now serving #${escapeHtml(s.queue.nowServing)}</span>`;
        } else if (s.status === "IN_PROGRESS") {
          queueBadge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">In queue: #${escapeHtml(s.queue && s.queue.nextNumber ? s.queue.nextNumber : 1)}</span>`;
        } else if (s.status === "OPEN" || s.status === "SCHEDULED") {
          queueBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200">Starts at #${escapeHtml(s.queue && s.queue.nextNumber ? s.queue.nextNumber : 1)}</span>`;
        } else if (s.status === "COMPLETED") {
          queueBadge = `<span class="text-xs text-slate2 font-medium">Completed</span>`;
        } else if (s.status === "CANCELLED") {
          queueBadge = `<span class="text-xs text-rose-500 font-medium">Cancelled</span>`;
        }

        tr.innerHTML = `
          <td data-label="Doctor">
            <div class="font-semibold text-ink">${s.doctorName ? "Dr. " + escapeHtml(s.doctorName) : "Doctor"}</div>
            <div class="text-xs text-mute">${escapeHtml(s.specialisation || "General")}</div>
          </td>
          <td data-label="Date & Time">
            <div class="text-sm font-medium">${escapeHtml(s.sessionDate || "—")}</div>
            <div class="text-xs text-slate2">${escapeHtml((s.startTime || "").slice(0, 5))} - ${escapeHtml((s.endTime || "").slice(0, 5))}${s.delayMinutes ? ` <span class="text-peach font-bold">(+${escapeHtml(s.delayMinutes)}m delay)</span>` : ""}</div>
          </td>
          <td data-label="Type">${typeBadge}</td>
          <td data-label="Room">
            <span class="text-sm font-medium text-slate2">${escapeHtml(s.roomNumber || (s.consultationType === "ONLINE" ? "Online Room" : "—"))}</span>
          </td>
          <td data-label="Current Queue #">
            ${queueBadge}
          </td>
          <td data-label="Spots" class="text-right">
            <span class="font-bold text-brand">${s.remainingAppointments != null ? escapeHtml(s.remainingAppointments) : "—"}</span>
            <span class="text-xs text-mute">/ ${escapeHtml(s.maxAppointments || "—")}</span>
          </td>
          <td data-label="Status">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${statusClass}">${escapeHtml(s.status)}</span>
          </td>
          <td data-label="Actions">
            <div class="flex items-center gap-1.5 justify-end">
              ${canCancel ? `
                <button type="button" data-delay-session="${escapeHtml(sessionId)}" class="inline-flex items-center gap-1 border rounded-lg font-semibold cursor-pointer bg-white border-line text-amber-700 hover:bg-amber-50 px-2 py-1 text-xs" title="Enter a custom delay in minutes">⏱ Delay</button>
                <button type="button" data-cancel-session="${escapeHtml(sessionId)}" class="inline-flex items-center gap-1 border rounded-lg font-semibold cursor-pointer bg-white border-rose-200 text-rose-600 hover:bg-rose-50 px-2 py-1 text-xs" title="Cancel session">Cancel</button>
              ` : '<span class="text-xs text-mute">—</span>'}
            </div>
          </td>
        `;
        return tr;
      }

      if (tbody) {
        tbody.replaceChildren();
        const groupedIds = new Set();
        sessionWeekChunks(range.from, range.weeks).forEach((chunk) => {
          const group = sessions.filter((s) => {
            const date = String(s.sessionDate || "");
            return date >= chunk.from && date <= chunk.to;
          });
          if (!group.length) return;

          const header = document.createElement("tr");
          header.innerHTML =
            '<td colspan="8" class="bg-snow px-3 py-2 text-xs font-bold uppercase tracking-wider text-brand">' +
            escapeHtml(chunk.label) +
            " · " +
            group.length +
            (group.length === 1 ? " session" : " sessions") +
            "</td>";
          tbody.append(header);
          group.forEach((s) => {
            groupedIds.add(s.sessionId || s.id);
            tbody.append(renderRow(s));
          });
        });

        sessions
          .filter((s) => !groupedIds.has(s.sessionId || s.id))
          .forEach((s) => tbody.append(renderRow(s)));
      }

      if (dashTbody) {
        dashTbody.replaceChildren();
        if (todaySessions.length > 0) {
          todaySessions.forEach((s) => dashTbody.append(renderRow(s)));
        } else {
          dashTbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-mute">No sessions scheduled for today.</td></tr>';
        }
      }
    } catch (err) {
      console.warn("Could not load manager sessions:", err);
      const message = escapeHtml(err.message || "Unknown error");
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-rose-600">Failed to load sessions: ${message}</td></tr>`;
      if (dashTbody) dashTbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-rose-600">Failed to load sessions: ${message}</td></tr>`;
    }
  }

  const DASHBOARD_REFRESH_MS = 15000;
  let dashboardRequest = null;
  let dashboardFetchedAt = 0;

  // Session changes make today's aggregates stale; the next dashboard load
  // must bypass the short refresh window.
  function invalidateManagerDashboard() {
    dashboardFetchedAt = 0;
  }

  function setManagerDashboardCards(values) {
    const targets = [
      ["[data-manager-sessions-this-week]", values.sessionsThisWeek],
      ["[data-manager-doctors-today]", values.doctorsToday],
      ["[data-manager-completed-today]", values.completedToday],
      ["[data-manager-cancelled-today]", values.cancelledToday],
      ["[data-manager-appointments-today]", values.appointmentsToday],
      ["[data-manager-type-split]", values.typeSplit],
      ["[data-manager-revenue-today]", values.revenue],
    ];

    targets.forEach(([selector, value]) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    });
  }

  // Loads GET /reports/overview scoped to today and fills the dashboard cards.
  // Every figure is computed by the backend; missing values render as "—".
  async function loadManagerDashboard(options) {
    const settings = options || {};
    const status = document.querySelector("[data-manager-dashboard-status]");
    const fresh = Date.now() - dashboardFetchedAt < DASHBOARD_REFRESH_MS;

    if (!settings.force && fresh) return true;
    if (dashboardRequest) return dashboardRequest;

    const firstLoad = dashboardFetchedAt === 0;
    if (firstLoad) {
      setManagerDashboardCards({
        sessionsThisWeek: "…",
        doctorsToday: "…",
        completedToday: "…",
        cancelledToday: "…",
        appointmentsToday: "…",
        typeSplit: "…",
        revenue: "…",
      });
    }
    setStatus(status, firstLoad ? "Loading dashboard figures…" : "");

    dashboardRequest = (async () => {
      try {
        const today = todayISO();
        const report = await MC.reportOverview({ from: today, to: today });
        const metrics = ManagerUI.dashboardMetrics(report);

        // Formatting (zero vs unavailable, LKR) lives in the tested helper.
        setManagerDashboardCards(ManagerUI.dashboardCardValues(metrics));

        dashboardFetchedAt = Date.now();
        setStatus(status, "");
        return true;
      } catch (error) {
        console.warn("Could not load manager dashboard report:", error);
        dashboardFetchedAt = 0;
        setManagerDashboardCards({
          sessionsThisWeek: "—",
          doctorsToday: "—",
          completedToday: "—",
          cancelledToday: "—",
          appointmentsToday: "—",
          typeSplit: "—",
          revenue: "—",
        });
        if (status) {
          status.hidden = false;
          status.classList.remove("text-slate2");
          status.classList.add("text-bad");
          status.replaceChildren();
          const msg = document.createElement("span");
          msg.textContent =
            "Could not load dashboard figures: " +
            (error.message || "Unknown error") +
            " The dashboard values are unavailable. ";
          const retryBtn = document.createElement("button");
          retryBtn.type = "button";
          retryBtn.className =
            "inline-flex items-center ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-white border border-bad text-bad hover:bg-rose-50 cursor-pointer";
          retryBtn.setAttribute("data-retry-manager-dashboard", "true");
          retryBtn.textContent = "Retry";
          retryBtn.addEventListener("click", () => {
            void loadManagerDashboard({ force: true });
          });
          status.append(msg, retryBtn);
        }
        return false;
      } finally {
        dashboardRequest = null;
      }
    })();

    return dashboardRequest;
  }

  function managerReviewActionButton(review, action, label) {
    const button = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
      label
    );
    button.type = "button";
    button.dataset.reviewAction = action;
    button.dataset.reviewId = String(review.reviewId);
    button.setAttribute(
      "aria-label",
      label + " review from " + (review.createdAt ? formatDateTime(review.createdAt) : "this patient")
    );
    return button;
  }

  function renderManagerReview(review) {
    const card = el(
      "article",
      "grid gap-3 rounded-lg border border-line bg-white p-3 sm:p-4"
    );
    card.dataset.managerReview = "";

    const status = typeof review.moderationStatus === "string"
      ? review.moderationStatus.trim().toUpperCase()
      : "";
    const heading = el("div", "flex flex-wrap items-center justify-between gap-2");
    const rating = Number(review.rating);
    heading.append(
      el(
        "strong",
        "text-sm font-semibold text-ink",
        Number.isInteger(rating) && rating >= 1 && rating <= 5
          ? "★ " + rating + " / 5"
          : "Rating unavailable"
      )
    );
    heading.append(
      badge(
        titleCase(status) || "Unknown status",
        status === "APPROVED" ? "green" : status === "HIDDEN" ? "slate" : "orange"
      )
    );
    card.append(heading);

    const comment = typeof review.comment === "string" && review.comment.trim()
      ? review.comment
      : "No written feedback was provided.";
    card.append(
      el("p", "text-sm text-slate2 whitespace-pre-wrap break-words", comment)
    );

    const footer = el("div", "flex flex-wrap items-center justify-between gap-3");
    const created = el(
      "time",
      "text-xs text-mute",
      review.createdAt ? formatDateTime(review.createdAt) : "Date unavailable"
    );
    if (typeof review.createdAt === "string") {
      created.dateTime = review.createdAt;
    }
    footer.append(created);

    const actions = el("div", "flex flex-wrap gap-2");
    if (typeof review.reviewId === "string" && review.reviewId) {
      if (status !== "APPROVED") {
        actions.append(managerReviewActionButton(review, "approve", "Approve"));
      }
      if (status !== "HIDDEN") {
        actions.append(managerReviewActionButton(review, "hide", "Hide"));
      }
    }
    footer.append(actions);
    card.append(footer);
    return card;
  }

  const managerNoticeState = {
    editingId: null,
    editingPublished: true,
    page: 1,
    pageSize: 6,
  };

  function setManagerNoticeFormMode(mode, notice) {
    const form = document.getElementById("manager-notice-form");
    if (!form) return;

    const title = form.querySelector("#manager-notice-title");
    const body = form.querySelector("#manager-notice-body");
    const submit = form.querySelector('[data-manager-notice-submit]');
    const cancel = form.querySelector('[data-manager-notice-cancel-edit]');
    const heading = document.querySelector("[data-manager-notice-form-heading]");
    const status = form.querySelector("[data-manager-notice-status]");

    if (mode === "edit" && notice) {
      managerNoticeState.editingId = notice.id || null;
      managerNoticeState.editingPublished = Boolean(notice.published);
      if (title) title.value = notice.title || "";
      if (body) body.value = notice.body || "";
      if (submit) submit.textContent = "Save changes";
      if (cancel) cancel.hidden = false;
      if (heading) heading.textContent = "Edit hospital notice";
      setStatus(status, "Editing notice. Saving will " + (managerNoticeState.editingPublished ? "keep it published." : "keep it as a draft/withdrawn notice."));
    } else {
      managerNoticeState.editingId = null;
      managerNoticeState.editingPublished = true;
      form.reset();
      if (submit) submit.textContent = "Publish notice";
      if (cancel) cancel.hidden = true;
      if (heading) heading.textContent = "Publish hospital notices";
      setStatus(status, "");
    }
  }

  function renderManagerNotice(notice) {
    const published = Boolean(notice.published);
    const card = el(
      "article",
      "grid gap-3 rounded-xl border border-line bg-white p-4 shadow-sm transition hover:shadow-md " +
        (published
          ? "border-l-4 border-l-emerald-400"
          : "border-l-4 border-l-slate-300")
    );
    card.dataset.managerNotice = notice.id || "";

    const header = el("div", "flex flex-wrap items-start justify-between gap-2");
    header.append(
      el(
        "h3",
        "min-w-0 break-words text-base font-semibold leading-snug text-ink",
        notice.title || "Untitled notice"
      )
    );
    header.append(badge(published ? "Published" : "Draft", published ? "green" : "slate"));
    card.append(header);

    card.append(
      el(
        "p",
        "whitespace-pre-wrap break-words text-sm leading-relaxed text-slate2",
        notice.body || ""
      )
    );

    const meta = el("div", "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mute");
    if (notice.publishedAt) {
      meta.append(el("span", "", "Published " + formatDateTime(notice.publishedAt)));
    } else if (notice.createdAt) {
      meta.append(el("span", "", "Created " + formatDateTime(notice.createdAt)));
    }
    if (notice.createdByName) {
      meta.append(
        el("span", "inline-flex items-center rounded-full bg-snow px-2 py-0.5 font-medium text-slate2", String(notice.createdByName))
      );
    }
    if (meta.childNodes.length) card.append(meta);

    const actions = el("div", "mt-1 flex flex-wrap items-center gap-2 border-t border-line pt-3");
    const editBtn = el("button", "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-9 px-3 py-1.5 text-xs", "Edit");
    editBtn.type = "button";
    editBtn.dataset.managerNoticeAction = "edit";
    editBtn.dataset.noticeId = notice.id || "";

    const toggleBtn = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-9 px-3 py-1.5 text-xs",
      notice.published ? "Withdraw" : "Publish"
    );
    toggleBtn.type = "button";
    toggleBtn.dataset.managerNoticeAction = notice.published ? "withdraw" : "publish";
    toggleBtn.dataset.noticeId = notice.id || "";

    const deleteBtn = el("button", "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-rose-200 text-rose-700 hover:bg-rose-50 min-h-9 px-3 py-1.5 text-xs", "Delete");
    deleteBtn.type = "button";
    deleteBtn.dataset.managerNoticeAction = "delete";
    deleteBtn.dataset.noticeId = notice.id || "";

    actions.append(editBtn, toggleBtn, deleteBtn);
    card.append(actions);
    return card;
  }

  function ensureManagerNoticesPanel() {
    const managerView = views.find((item) => item.dataset.view === "manager");
    if (!managerView) return false;

    const nav = managerView.querySelector("aside nav, aside");
    const main = managerView.querySelector("main");
    if (!nav || !main) return false;

    let link = managerView.querySelector('[data-panel-link][href="#manager-n"]');
    if (!link) {
      link = document.createElement("a");
      link.href = "#manager-n";
      link.className = "sa";
      link.dataset.panelLink = "";
      link.textContent = "Notices";
      const auditLink = managerView.querySelector('[data-panel-link][href="#manager-x"]');
      if (auditLink && auditLink.parentNode === nav) {
        nav.insertBefore(link, auditLink);
      } else {
        nav.append(link);
      }
    }

    let panel = managerView.querySelector("#manager-n");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "manager-n";
      panel.dataset.dashboardPanel = "";
      panel.hidden = true;
      panel.className = "grid gap-4";

      const card = el("section", "bg-white border border-line rounded-lg p-4 sm:p-5 shadow-sm grid gap-4");
      card.append(
        el("h2", "text-xl font-bold text-ink", "Manage hospital notices"),
        el("p", "text-sm text-slate2", "Create, edit, publish/withdraw, and delete notices from the manager dashboard. Published notices appear in the public dashboard’s Notices & announcements section.")
      );

      const form = document.createElement("form");
      form.id = "manager-notice-form";
      form.className = "grid gap-3 rounded-lg border border-line bg-snow p-3 sm:p-4";
      form.setAttribute("novalidate", "");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        void saveManagerNotice(form);
      });

      const formHeading = el("h3", "font-semibold text-ink", "Publish hospital notices");
      formHeading.dataset.managerNoticeFormHeading = "";

      const titleWrap = el("div");
      const titleLabel = el("label", "", "Notice title");
      titleLabel.setAttribute("for", "manager-notice-title");
      const titleInput = document.createElement("input");
      titleInput.id = "manager-notice-title";
      titleInput.name = "title";
      titleInput.maxLength = 150;
      titleInput.required = true;
      titleInput.className = "w-full";
      titleWrap.append(titleLabel, titleInput);

      const bodyWrap = el("div");
      const bodyLabel = el("label", "", "Notice body");
      bodyLabel.setAttribute("for", "manager-notice-body");
      const bodyInput = document.createElement("textarea");
      bodyInput.id = "manager-notice-body";
      bodyInput.name = "body";
      bodyInput.rows = 5;
      bodyInput.maxLength = 4000;
      bodyInput.required = true;
      bodyInput.className = "w-full";
      bodyWrap.append(bodyLabel, bodyInput);

      const limits = el("p", "text-xs text-mute", "Title up to 150 characters, body up to 4000 characters.");
      const status = document.createElement("output");
      status.dataset.managerNoticeStatus = "";
      status.setAttribute("aria-live", "polite");
      status.className = "block text-sm text-slate2";
      status.hidden = true;

      const actions = el("div", "flex flex-wrap gap-2");
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.dataset.managerNoticeSubmit = "";
      submit.className = "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed bg-brand border-brand text-white hover:bg-brand-d min-h-10 px-3.5 py-2";
      submit.textContent = "Publish notice";

      const cancelEdit = document.createElement("button");
      cancelEdit.type = "button";
      cancelEdit.dataset.managerNoticeCancelEdit = "";
      cancelEdit.hidden = true;
      cancelEdit.className = "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-10 px-3.5 py-2";
      cancelEdit.textContent = "Cancel edit";
      cancelEdit.addEventListener("click", () => {
        setManagerNoticeFormMode("create");
      });

      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-10 px-3.5 py-2";
      reset.textContent = "Clear";
      reset.addEventListener("click", () => {
        if (managerNoticeState.editingId) {
          setManagerNoticeFormMode("create");
        } else {
          form.reset();
          setStatus(status, "");
        }
      });
      actions.append(submit, cancelEdit, reset);

      form.append(formHeading, titleWrap, bodyWrap, limits, status, actions);
      card.append(form);

      const listCard = el("section", "bg-white border border-line rounded-lg p-4 sm:p-5 shadow-sm grid gap-3");
      listCard.append(el("h3", "font-semibold text-ink", "All notices"));
      const listStatus = document.createElement("output");
      listStatus.dataset.managerNoticesStatus = "";
      listStatus.setAttribute("aria-live", "polite");
      listStatus.className = "block text-sm text-slate2";
      listStatus.textContent = "Loading notices…";
      const list = el("div", "grid gap-4 md:grid-cols-2");
      list.dataset.managerNotices = "";
      list.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-manager-notice-action]");
        if (!button) return;
        const action = button.dataset.managerNoticeAction;
        const noticeId = button.dataset.noticeId;
        const notice = Array.isArray(state.managerNotices)
          ? state.managerNotices.find((item) => String(item.id) === String(noticeId))
          : null;
        if (action === "edit" && notice) {
          setManagerNoticeFormMode("edit", notice);
          const titleField = form.querySelector("#manager-notice-title");
          if (titleField && typeof titleField.focus === "function") titleField.focus();
          form.scrollIntoView({ block: "nearest" });
          return;
        }
        if (action === "publish" || action === "withdraw" || action === "delete") {
          void handleManagerNoticeAction(action, noticeId, button);
        }
      });

      const pagination = el(
        "nav",
        "flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3",
      );
      pagination.dataset.managerNoticesPagination = "";
      pagination.setAttribute("aria-label", "Notice pages");
      pagination.hidden = true;
      pagination.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-manager-notices-page]");
        if (!button || button.disabled) return;
        const notices = Array.isArray(state.managerNotices) ? state.managerNotices : [];
        const pages = Math.max(1, Math.ceil(notices.length / managerNoticeState.pageSize));
        const direction = button.dataset.managerNoticesPage;
        const nextPage =
          direction === "next"
            ? managerNoticeState.page + 1
            : direction === "previous"
              ? managerNoticeState.page - 1
              : managerNoticeState.page;
        managerNoticeState.page = Math.min(Math.max(1, nextPage), pages);
        renderManagerNoticesPage();
      });

      listCard.append(listStatus, list, pagination);

      panel.append(card, listCard);
      main.append(panel);
    }

    return true;
  }

  function renderManagerNoticesPage() {
    const container = document.querySelector("[data-manager-notices]");
    const pagination = document.querySelector("[data-manager-notices-pagination]");
    if (!container) return;

    const notices = Array.isArray(state.managerNotices) ? state.managerNotices : [];
    const size = managerNoticeState.pageSize;
    const pages = Math.max(1, Math.ceil(notices.length / size));
    const page = Math.min(Math.max(1, managerNoticeState.page), pages);
    managerNoticeState.page = page;

    const start = notices.length ? (page - 1) * size : 0;
    const end = Math.min(start + size, notices.length);
    container.replaceChildren(...notices.slice(start, end).map(renderManagerNotice));

    if (!pagination) return;

    if (notices.length <= size) {
      pagination.hidden = true;
      pagination.replaceChildren();
      return;
    }

    pagination.hidden = false;

    const label = el(
      "p",
      "text-xs text-mute",
      "Showing " +
        (start + 1) +
        "–" +
        end +
        " of " +
        notices.length +
        " notices"
    );

    const controls = el("div", "flex items-center gap-2");

    const previous = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed min-h-9 px-3 py-1.5 text-xs",
      "Previous"
    );
    previous.type = "button";
    previous.dataset.managerNoticesPage = "previous";
    previous.disabled = page <= 1;

    const indicator = el(
      "span",
      "px-1 text-xs font-semibold text-slate2",
      "Page " + page + " of " + pages
    );

    const next = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed min-h-9 px-3 py-1.5 text-xs",
      "Next"
    );
    next.type = "button";
    next.dataset.managerNoticesPage = "next";
    next.disabled = page >= pages;

    controls.append(previous, indicator, next);
    pagination.replaceChildren(label, controls);
  }

  async function loadManagerNotices(options) {
    if (!ensureManagerNoticesPanel()) return false;
    const container = document.querySelector("[data-manager-notices]");
    const status = document.querySelector("[data-manager-notices-status]");
    if (!container || !status) return false;

    const settings = options || {};
    container.replaceChildren();
    const pagination = document.querySelector("[data-manager-notices-pagination]");
    if (pagination) pagination.hidden = true;
    setStatus(status, "Loading notices…");

    try {
      const notices = await callWithWakeRetry(() => MC.managerNotices(), {
        retry: true,
      });
      if (!Array.isArray(notices)) {
        throw new Error("The notice service returned an invalid response.");
      }

      state.managerNotices = notices;
      if (typeof settings.page === "number") {
        managerNoticeState.page = settings.page;
      }
      renderManagerNoticesPage();

      if (notices.length === 0) {
        setStatus(
          status,
          settings.successMessage
            ? settings.successMessage + " No notices have been created."
            : "No notices have been created."
        );
        return true;
      }

      setStatus(
        status,
        settings.successMessage || "Showing " + notices.length + " notices."
      );
      return true;
    } catch (error) {
      console.warn("Could not load manager notices:", error);
      state.managerNotices = [];
      if (pagination) pagination.hidden = true;
      setStatus(
        status,
        "Could not load notices: " + (error.message || "Unknown error"),
        true
      );
      return false;
    }
  }

  async function saveManagerNotice(form) {
    if (!form || form.dataset.busy === "true") return;

    const status = form.querySelector("[data-manager-notice-status]");
    const submit = form.querySelector('[data-manager-notice-submit]');
    const title = String(form.elements.title.value || "");
    const body = String(form.elements.body.value || "");
    const validated = ManagerUI.noticePayload(title, body);

    if (!validated.ok) {
      setStatus(status, validated.message, true);
      const field = form.elements[title.trim() ? "body" : "title"];
      if (field && typeof field.focus === "function") field.focus();
      return;
    }

    const editingId = managerNoticeState.editingId;
    const payload = {
      title: validated.payload.title,
      body: validated.payload.body,
      published: editingId ? Boolean(managerNoticeState.editingPublished) : true,
    };

    if (!ManagerUI.lockAction(submit)) return;
    form.dataset.busy = "true";
    setStatus(status, editingId ? "Saving changes…" : "Publishing notice…");

    try {
      if (editingId) {
        await callWithWakeRetry(() => MC.updateNotice(editingId, payload), {
          retry: true,
        });
      } else {
        await callWithWakeRetry(() => MC.createNotice(payload), {
          retry: false,
        });
      }

      setManagerNoticeFormMode("create");
      const refreshed = await loadManagerNotices({
        successMessage: editingId ? "Notice updated successfully." : "Notice published successfully.",
        page: 1,
      });
      if (!refreshed) {
        setStatus(
          document.querySelector("[data-manager-notices-status]"),
          (editingId ? "Notice updated successfully." : "Notice published successfully.") + " The notice list could not be refreshed.",
          true
        );
      }
      state.publicNoticesLoaded = false;
      if (activeView === "index") {
        void loadPublicNotices({ force: true });
      }
    } catch (error) {
      console.warn("Could not save manager notice:", error);
      setStatus(
        status,
        "Could not " + (editingId ? "update" : "publish") + " notice: " + (error.message || "Unknown error"),
        true
      );
    } finally {
      form.dataset.busy = "false";
      ManagerUI.unlockAction(submit);
    }
  }

  function confirmManagerNoticeDelete() {
    const status = document.querySelector("[data-manager-notices-status]");
    if (!status) return Promise.resolve(false);

    return new Promise((resolve) => {
      status.hidden = false;
      status.className = "block text-sm text-slate2";
      status.replaceChildren();

      const wrap = el("div", "flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3");
      wrap.append(
        el("span", "text-rose-900 font-medium", "Delete this notice? This cannot be undone.")
      );

      const yes = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-rose-600 border-rose-600 text-white hover:bg-rose-700 min-h-9 px-3 py-1.5 text-xs",
        "Yes"
      );
      yes.type = "button";
      const no = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-9 px-3 py-1.5 text-xs",
        "No"
      );
      no.type = "button";

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        yes.disabled = true;
        no.disabled = true;
        status.replaceChildren();
        resolve(value);
      };

      yes.addEventListener("click", () => finish(true));
      no.addEventListener("click", () => finish(false));
      wrap.append(yes, no);
      status.append(wrap);
    });
  }

  async function handleManagerNoticeAction(action, noticeId, button) {
    const id = String(noticeId || "").trim();
    if (!id) {
      setStatus(
        document.querySelector("[data-manager-notices-status]"),
        "Could not " + action + " notice: missing notice id.",
        true
      );
      return;
    }

    if (action === "delete") {
      const confirmed = await confirmManagerNoticeDelete();
      if (!confirmed) {
        setStatus(document.querySelector("[data-manager-notices-status]"), "Delete cancelled.");
        return;
      }
    }

    const listStatus = document.querySelector("[data-manager-notices-status]");
    const canLock = !button || !window.ManagerUI || typeof ManagerUI.lockAction !== "function" || ManagerUI.lockAction(button);
    if (!canLock) return;

    setStatus(
      listStatus,
      action === "delete"
        ? "Deleting notice…"
        : action === "publish"
          ? "Publishing notice…"
          : "Withdrawing notice…"
    );

    try {
      if (action === "delete") {
        try {
          await callWithWakeRetry(() => MC.deleteNotice(id), { retry: true });
        } catch (error) {
          // A retry after a lost response reports 404 because the first request
          // already deleted the notice. That outcome still matches the intent.
          if (!error || error.status !== 404) throw error;
        }
        if (String(managerNoticeState.editingId || "") === id) {
          setManagerNoticeFormMode("create");
        }
      } else if (action === "publish") {
        await callWithWakeRetry(() => MC.publishNotice(id), { retry: true });
      } else if (action === "withdraw") {
        await callWithWakeRetry(() => MC.withdrawNotice(id), { retry: true });
      } else {
        throw new Error("Unsupported notice action.");
      }

      const successMessage =
        action === "delete"
          ? "Notice deleted successfully."
          : action === "publish"
            ? "Notice published successfully."
            : "Notice withdrawn successfully.";

      const refreshed = await loadManagerNotices({ successMessage });
      if (!refreshed) {
        setStatus(listStatus, successMessage + " The notice list could not be refreshed.", true);
      }
      state.publicNoticesLoaded = false;
      void loadPublicNotices({ force: true }).catch(() => {});
    } catch (error) {
      console.warn("Could not perform manager notice action:", error);
      setStatus(
        listStatus,
        "Could not " + action + " notice: " + (error.message || "Unknown error"),
        true
      );
    } finally {
      if (button && window.ManagerUI && typeof ManagerUI.unlockAction === "function") {
        ManagerUI.unlockAction(button);
      } else if (button) {
        button.disabled = false;
        if (button.dataset) button.dataset.busy = "false";
      }
    }
  }

  async function loadManagerReviews(options) {
    const container = document.querySelector("[data-manager-reviews]");
    const status = document.querySelector("[data-manager-reviews-status]");
    if (!container || !status) return false;

    const settings = options || {};
    container.replaceChildren();
    setStatus(status, "Loading feedback…");

    try {
      const reviews = await MC.managerReviews();
      if (!Array.isArray(reviews)) {
        throw new Error("The review service returned an invalid response.");
      }

      if (reviews.length === 0) {
        setStatus(
          status,
          settings.successMessage
            ? settings.successMessage + " No feedback is currently available."
            : "No feedback is currently available for moderation."
        );
        return true;
      }

      container.replaceChildren(...reviews.map(renderManagerReview));
      setStatus(
        status,
        settings.successMessage || "Showing " + reviews.length + " reviews."
      );
      return true;
    } catch (error) {
      console.warn("Could not load manager feedback:", error);
      setStatus(
        status,
        "Could not load feedback: " + (error.message || "Unknown error"),
        true
      );
      return false;
    }
  }

  async function moderateManagerReview(reviewId, action, button) {
    if (!reviewId || (action !== "approve" && action !== "hide") || !button) {
      return;
    }

    const card = button.closest("[data-manager-review]");
    const buttons = card ? Array.from(card.querySelectorAll("button")) : [button];

    // Refuse a second request while this card is already being moderated.
    if (!ManagerUI.lockAction(button)) return;
    buttons.forEach((item) => {
      if (item !== button) ManagerUI.lockAction(item);
    });

    const status = document.querySelector("[data-manager-reviews-status]");
    setStatus(
      status,
      action === "approve" ? "Approving feedback…" : "Hiding feedback…"
    );

    const message = action === "approve"
      ? "Feedback approved."
      : "Feedback hidden.";
    let refreshed = false;

    try {
      if (action === "approve") {
        await MC.approveReview(reviewId);
      } else {
        await MC.hideReview(reviewId);
      }

      refreshed = await loadManagerReviews();
      setStatus(
        status,
        refreshed
          ? message
          : message + " The review list could not be refreshed. Reload the page to confirm the change.",
        !refreshed
      );
    } catch (error) {
      console.warn("Could not moderate manager feedback:", error);
      setStatus(
        status,
        "Could not " + action + " feedback: " + (error.message || "Unknown error"),
        true
      );
    } finally {
      // A successful refresh replaces these nodes; otherwise let the
      // manager retry instead of leaving the card permanently disabled.
      if (!refreshed) {
        buttons.forEach((item) => ManagerUI.unlockAction(item));
      }
    }
  }

  async function loadManagerReception(options) {
    const tbody = document.querySelector("[data-manager-reception-tbody]");
    if (!tbody) return;

    const settings = options || {};
    const status = document.querySelector("[data-manager-reception-status]");

    if (!settings.silent && status) {
      status.hidden = false;
      status.textContent = "Loading today’s appointments…";
      status.classList.remove("text-rose-600");
    }

    try {
      const list = await MC.adminAppointments();
      const today = todayISO();
      state.manager.reception = (Array.isArray(list) ? list : []).filter(
        (appointment) => appointment.sessionDate === today
      );
      state.manager.receptionLoaded = true;
      renderManagerReception();
      if (status) {
        if (state.manager.reception.length === 0) {
          status.hidden = false;
          status.textContent = "No appointments are booked for today yet.";
        } else {
          status.hidden = true;
        }
      }
    } catch (error) {
      console.warn("Could not load reception appointments:", error);
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center py-4 text-rose-600">Could not load today’s appointments: ' +
        escapeHtml(error.message || "Unknown error") +
        "</td></tr>";
      if (status) {
        status.hidden = false;
        status.textContent = "Reception could not be loaded. Try again in a moment.";
      }
    }
  }

  async function loadWalkInSessions(select, status) {
    if (!select) return;
    const loading = el("option", "", "Loading open sessions…");
    loading.value = "";
    select.replaceChildren(loading);

    try {
      const sessions = await MC.sessions({});
      const open = (Array.isArray(sessions) ? sessions : []).filter(
        (session) =>
          session.status === "OPEN" &&
          Number(session.remainingAppointments) > 0
      );

      const placeholder = el("option", "", "Choose an open session…");
      placeholder.value = "";
      select.replaceChildren(placeholder);

      open.forEach((session) => {
        const label = [
          "Dr. " + (session.doctorName || "Doctor"),
          formatDate(session.sessionDate),
          formatTime(session.startTime),
          session.consultationType === "ONLINE" ? "online" : "physical",
          session.remainingAppointments + " left",
        ]
          .filter(Boolean)
          .join(" · ");
        const option = el("option", "", label);
        option.value = session.sessionId || "";
        select.append(option);
      });

      if (!open.length) {
        setStatus(status, "There are no open sessions with available slots.", true);
      }
    } catch (error) {
      console.warn("Could not load walk-in sessions:", error);
      setStatus(
        status,
        "Could not load sessions: " + (error.message || "Unknown error"),
        true
      );
    }
  }

  function openWalkInDialog() {
    const dialog = $("walkin-dialog");
    const form = $("walkin-form");
    if (!dialog || !form) return;

    form.reset();
    form.dataset.busy = "false";
    const status = form.querySelector("[data-walkin-status]");
    setStatus(status, "");
    const submit = form.querySelector("[data-walkin-submit]");
    if (submit) {
      submit.disabled = false;
      if (submit.dataset) submit.dataset.busy = "false";
    }

    openModal(dialog, form.querySelector("[data-walkin-first-name]"));
    void loadWalkInSessions(form.querySelector("[data-walkin-session]"), status);
  }

  async function submitWalkIn(form) {
    if (!form || form.dataset.busy === "true") return;

    const status = form.querySelector("[data-walkin-status]");
    const submit = form.querySelector("[data-walkin-submit]");
    const field = (selector) => {
      const node = form.querySelector(selector);
      return node ? String(node.value || "").trim() : "";
    };

    const sessionId = field("[data-walkin-session]");
    const firstName = field("[data-walkin-first-name]");
    const lastName = field("[data-walkin-last-name]");
    const phone = field("[data-walkin-phone]").replace(/[\s-]/g, "");
    const reason = field("[data-walkin-reason]");

    if (!sessionId || !firstName || !lastName || !reason) {
      setStatus(status, "Please complete every field.", true);
      return;
    }
    if (!/^07[0-9]{8}$/.test(phone)) {
      setStatus(status, "Enter a valid mobile number in the 07XXXXXXXX format.", true);
      return;
    }

    if (!ManagerUI.lockAction(submit)) return;
    form.dataset.busy = "true";
    setStatus(status, "Creating walk-in appointment…");

    try {
      const created = await callWithWakeRetry(
        () =>
          MC.bookWalkIn({
            sessionId,
            firstName,
            lastName,
            phone,
            reason,
          }),
        { retry: false }
      );

      const dialog = $("walkin-dialog");
      if (dialog && typeof dialog.close === "function") dialog.close();

      const reference =
        created && created.appointmentNumber != null
          ? " · #" + created.appointmentNumber
          : "";
      setAppMessage(
        "Walk-in appointment booked for " + firstName + " " + lastName + reference + ".",
        "success"
      );

      invalidateManagerDashboard();
      await Promise.allSettled([
        loadManagerReception({ silent: true }),
        loadManagerSessions(),
        loadSessions(),
        loadManagerDashboard({ force: true }),
      ]);
    } catch (error) {
      console.warn("Could not book walk-in appointment:", error);
      setStatus(
        status,
        "Could not book appointment: " + (error.message || "Unknown error"),
        true
      );
    } finally {
      form.dataset.busy = "false";
      ManagerUI.unlockAction(submit);
    }
  }

  function managerReceptionMatches(appointment, term) {
    if (!term) return true;
    const needle = term.trim().toLowerCase();
    if (!needle) return true;
    return [
      appointment.bookingReference,
      referenceOf(appointment.bookingReference),
      appointment.appointmentNumber != null ? "#" + appointment.appointmentNumber : "",
      appointment.patientName,
      appointment.doctorName,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  }

  function paymentLabel(appointment) {
    const status = appointment.paymentStatus || "PENDING";
    if (status === "PAID") {
      return appointment.paymentMethod
        ? "Paid · " + titleCase(appointment.paymentMethod)
        : "Paid";
    }
    if (status === "REFUNDED") return "Refunded";
    return "Pending";
  }

  function renderManagerReception() {
    const tbody = document.querySelector("[data-manager-reception-tbody]");
    if (!tbody) return;

    const search = document.querySelector("#manager-f");
    const term = search ? search.value : "";
    const list = state.manager.reception.filter((appointment) =>
      managerReceptionMatches(appointment, term)
    );

    if (list.length === 0) {
      const tr = document.createElement("tr");
      const td = el(
        "td",
        "text-center py-4 text-mute",
        state.manager.reception.length === 0
          ? "No appointments are booked for today."
          : "No appointments match your search."
      );
      td.colSpan = 6;
      tr.append(td);
      tbody.replaceChildren(tr);
      return;
    }

    tbody.replaceChildren();
    list.forEach((appointment) => {
      const tr = document.createElement("tr");
      const reference = referenceOf(appointment.bookingReference);
      const status = appointment.status || "BOOKED";
      const canCancel = status === "BOOKED" || status === "ARRIVED";
      const canDelay =
        status === "BOOKED" ||
        status === "ARRIVED" ||
        status === "IN_CONSULTATION";

      const tdRef = el("td", "text-xs font-mono text-slate2", reference);
      tdRef.dataset.label = "Ref";

      const tdPatient = document.createElement("td");
      tdPatient.dataset.label = "Patient";
      tdPatient.append(
        el("div", "font-semibold text-ink", appointment.patientName || "Patient")
      );
      tdPatient.append(
        el("div", "text-xs text-mute", appointment.doctorName || "Doctor")
      );

      const tdNumber = el(
        "td",
        "",
        appointment.appointmentNumber != null
          ? "#" + appointment.appointmentNumber
          : "—"
      );
      tdNumber.dataset.label = "No.";

      const tdStatus = document.createElement("td");
      tdStatus.dataset.label = "Status";
      tdStatus.append(appointmentBadge(status));

      const tdPayment = el("td", "text-sm text-slate2", paymentLabel(appointment));
      tdPayment.dataset.label = "Payment";

      const tdActions = document.createElement("td");
      tdActions.dataset.label = "Actions";
      const actions = document.createElement("div");
      actions.className = "flex flex-wrap items-center gap-1.5";

      if (status === "BOOKED") {
        const arrive = el(
          "button",
          "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-brand border-brand text-white hover:bg-brand-d min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
          "Mark arrived"
        );
        arrive.type = "button";
        arrive.dataset.arriveAppointment = appointment.appointmentId;
        actions.append(arrive);
      }

      if (appointment.paymentStatus !== "PAID" && status !== "CANCELLED") {
        const pay = el(
          "button",
          "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
          "Record payment"
        );
        pay.type = "button";
        pay.dataset.payAppointment = appointment.appointmentId;
        actions.append(pay);
      }

      if (canDelay) {
        const delay = el(
          "button",
          "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
          "Delay queue"
        );
        delay.type = "button";
        delay.dataset.delayAppointment = appointment.appointmentId;
        delay.title = "Delay this booking and everyone behind it";
        actions.append(delay);
      }

      if (canCancel) {
        const cancel = el(
          "button",
          "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
          "Cancel"
        );
        cancel.type = "button";
        cancel.dataset.cancelAppointment = appointment.appointmentId;
        actions.append(cancel);
      }

      if (!actions.childElementCount) {
        actions.append(el("span", "text-xs text-mute", "—"));
      }

      tdActions.append(actions);
      tr.append(tdRef, tdPatient, tdNumber, tdStatus, tdPayment, tdActions);
      tbody.append(tr);
    });
  }

  async function markManagerArrived(appointmentId, button) {
    if (!appointmentId) return;

    if (button) {
      button.disabled = true;
      button.textContent = "Marking…";
    }

    try {
      await MC.markAppointmentArrived(appointmentId);
      invalidateManagerDashboard();
      await loadManagerReception({ silent: true });
      if (S && S.role === "MANAGER") {
        void loadManagerDashboard({ force: true });
      }
    } catch (error) {
      setAppMessage(error.message);
      if (button) {
        button.disabled = false;
        button.textContent = "Mark arrived";
      }
    }
  }

  async function handleManagerCreateSession(form) {
    const status = form.querySelector("[data-create-session-status]");
    const button = form.querySelector("button[type=submit]");

    const doctorId = ($("sess-doc") || {}).value || "";
    const consultationType = ($("sess-type") || {}).value || "PHYSICAL";
    const roomId = consultationType === "PHYSICAL" ? (($("sess-room") || {}).value || null) : null;
    const sessionDate = ($("sess-date") || {}).value || "";
    let startTime = ($("sess-start") || {}).value || "";
    const selectedWindow = CLINIC_WINDOWS.find(
      (window) => window.start === startTime
    );
    let endTime = selectedWindow ? selectedWindow.end : "";
    const feeLkr = Number(($("sess-fee") || {}).value || 0);
    const maxAppointments = Number(($("sess-max") || {}).value || MAX_PATIENTS_PER_SESSION);
    const minutesPerPatient = Number(($("sess-mins") || {}).value || SLOT_MINUTES);

    if (!doctorId) {
      setStatus(status, "Please select a doctor.", true);
      return;
    }
    if (consultationType === "PHYSICAL" && !roomId) {
      setStatus(status, "Please select a consultation room for physical sessions.", true);
      return;
    }
    if (!sessionDate) {
      setStatus(status, "Please select a session date.", true);
      return;
    }
    if (!selectedWindow || !endTime) {
      setStatus(
        status,
        "Sessions must use one published window: " + CLINIC_WINDOW_LABEL + ".",
        true
      );
      return;
    }

    startTime += ":00";
    endTime += ":00";

    if (!Number.isFinite(maxAppointments) || maxAppointments < 1 || maxAppointments > MAX_PATIENTS_PER_SESSION) {
      setStatus(status, "Maximum patients must be between 1 and " + MAX_PATIENTS_PER_SESSION + " per session (BR-01).", true);
      return;
    }
    if (!Number.isFinite(minutesPerPatient) || minutesPerPatient !== SLOT_MINUTES) {
      setStatus(status, "Each patient must be allocated exactly " + SLOT_MINUTES + " minutes (BR-01).", true);
      return;
    }
    if (!Number.isFinite(feeLkr) || feeLkr <= 0) {
      setStatus(status, "Consultation fee must be greater than 0 LKR (BR-01).", true);
      return;
    }

    const payload = {
      doctorId,
      roomId,
      sessionDate,
      startTime,
      endTime,
      consultationType,
      maxAppointments,
      minutesPerPatient,
      feeLkr,
    };

    if (button) button.disabled = true;
    setStatus(status, "Scheduling session…");

    try {
      const result = await MC.createSession(payload);
      const docName = $("sess-doc") && $("sess-doc").selectedOptions[0] ? $("sess-doc").selectedOptions[0].textContent : "the doctor";
      setStatus(
        status,
        "Session successfully scheduled for " + docName + "! The session is open and ready for patient booking."
      );
      showNotificationToast({
        title: "Session scheduled",
        message: "New consultation session scheduled for " + docName + " on " + sessionDate + " (" + startTime.slice(0, 5) + " - " + endTime.slice(0, 5) + ").",
      });

      invalidateManagerDashboard();
      loadOnce(loadManagerSessions);
      state.sessionsLoaded = false;
      void loadSessions();
      loadOnce(loadAuditLogs);
    } catch (err) {
      setStatus(status, err.message || "Failed to schedule session.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function printSummary() {
    const appointment = state.consult.appointment;
    const summary = state.consult.summary;

    if (!appointment || !summary) {
      setAppMessage("The summary is not available yet.");
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!printWindow) {
      window.print();
      return;
    }

    const documentTitle = document.createElement("title");
    documentTitle.textContent = "MediChannel consultation summary";

    const style = document.createElement("style");
    style.textContent =
      "body{font:14px system-ui,sans-serif;margin:32px;color:#1a202c}h1{font-size:20px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#52637A;margin-top:20px}";

    const body = printWindow.document.body;
    body.replaceChildren();
    printWindow.document.head.append(documentTitle, style);

    body.append(el("h1", "", "MediChannel · Consultation summary"));
    body.append(
      el(
        "p",
        "",
        "Patient: " +
          (S.role === "DOCTOR"
            ? appointment.patientName || "Patient"
            : S.email) +
          " · Reference " +
          referenceOf(appointment.bookingReference)
      )
    );
    body.append(el("h2", "", "Diagnosis"));
    body.append(el("p", "", summary.diagnosis || "—"));
    body.append(el("h2", "", "Advice and prescription"));
    body.append(
      el("p", "", summary.prescription || summary.treatmentNotes || "—")
    );
    body.append(el("h2", "", "Follow-up"));
    body.append(el("p", "", summary.followUpInstructions || "—"));

    printWindow.focus();
    printWindow.print();
  }

  // ---------------------------------------------------------------
  // Authentication forms and validation
  // ---------------------------------------------------------------

  const V = {
    name: (value) =>
      value.trim().length < 3 && "Please enter your full name.",
    nic: (value) =>
      !/^(\d{9}[VvXx]|\d{12})$/.test(value.trim()) &&
      "That NIC doesn’t look right. Use 9 digits + V/X, or 12 digits.",
    dob: (value) =>
      (!value ||
        new Date(value) > new Date() ||
        new Date(value) < new Date("1900-01-01")) &&
      "Please choose your date of birth.",
    phone: (value) =>
      !/^07\d{8}$/.test(value.trim()) &&
      "Please enter your phone number like 07XXXXXXXX.",
    email: (value) =>
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) &&
      "Please enter a valid email address.",
    pw: (value) =>
      !(
        value.length >= 8 &&
        /[A-Za-z]/.test(value) &&
        /\d/.test(value) &&
        /[^A-Za-z0-9]/.test(value)
      ) && "Use at least 8 characters, with a letter, a number and a symbol.",
    pw2: (value, form) =>
      value !== form.elements.password.value &&
      "The passwords don’t match yet.",
    req: (value) => !value && "Please fill this in.",
  };

  function chk(element) {
    const validator = V[element.dataset.v];
    if (!validator) return true;

    const message = validator(element.value, element.form) || "";
    const parts = element.id.split("-");

    element.setAttribute("aria-invalid", message ? "true" : "false");

    const error = $(parts[0] + "-e_" + parts[1]);
    if (error) error.textContent = message;

    return !message;
  }

  function allOk(form) {
    return Array.from(form.querySelectorAll("[data-v]"))
      .map(chk)
      .every(Boolean);
  }

  function showErr(id, message) {
    const box = $(id);
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
  }

  async function handleLogin(event) {
    event.preventDefault();

    const form = event.target;
    const error = $("login-err");
    const success = $("login-ok");

    if (error) error.hidden = true;
    if (success) success.hidden = true;

    if (!allOk(form)) return;

    const button = form.querySelector('button[type="submit"]');
    const originalText = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Logging in…";
    }

    try {
      if (wakePromise) {
        if (button) button.textContent = "Starting backend…";
        await wakePromise;
        if (button) button.textContent = "Logging in…";
      }

      let response = await fetchWithTimeout("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: form.email.value.trim(),
          password: form.password.value,
        }),
      });

      if (isServiceUnavailable(response)) {
        if (button) button.textContent = "Starting backend…";
        const awake = await wakeBackend();
        if (awake) {
          if (button) button.textContent = "Logging in…";
          response = await fetchWithTimeout("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              email: form.email.value.trim(),
              password: form.password.value,
            }),
          });
        }
      }

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        showErr(
          "login-err",
          result.message || "That email or password doesn’t look right."
        );
        return;
      }

      if (
        !result.user ||
        !HOME[result.user.role] ||
        typeof result.token !== "string" ||
        !result.token
      ) {
        showErr("login-err", "The login service returned an unexpected response.");
        return;
      }

      setSession(result.user, result.token);
      form.reset();
      render();

      if (S.role === "CUSTOMER") {
        setAppMessage("");
        nav("index");
      } else {
        setAppMessage("");
        nav(HOME[S.role]);
      }
    } catch {
      showErr("login-err", "Unable to reach the login service. Please try again.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    const form = event.target;
    const error = $("register-err");

    if (error) error.hidden = true;

    if (!allOk(form)) return;

    const values = Object.fromEntries(new FormData(form));
    const parts = String(values.name || "").trim().split(/\s+/);
    const firstName = parts.shift() || "";
    const lastName = parts.join(" ");

    if (!firstName || !lastName) {
      showErr("register-err", "Enter your first and last name.");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const originalText = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Creating account…";
    }

    try {
      if (wakePromise) {
        if (button) button.textContent = "Starting backend…";
        await wakePromise;
        if (button) button.textContent = "Creating account…";
      }

      let response = await fetchWithTimeout("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          firstName,
          lastName,
          email: values.email,
          password: values.password,
          confirmPassword: values.confirm,
          nic: values.nic,
          dateOfBirth: values.dob,
          gender: values.gen,
          phone: values.ph,
          address: values.address,
        }),
      });

      if (isServiceUnavailable(response)) {
        if (button) button.textContent = "Starting backend…";
        const awake = await wakeBackend();
        if (awake) {
          if (button) button.textContent = "Creating account…";
          response = await fetchWithTimeout("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              firstName,
              lastName,
              email: values.email,
              password: values.password,
              confirmPassword: values.confirm,
              nic: values.nic,
              dateOfBirth: values.dob,
              gender: values.gen,
              phone: values.ph,
              address: values.address,
            }),
          });
        }
      }

      const result = await response.json().catch(() => ({}));

      if (response.status === 202) {
        showErr("register-err", result.message || "Your account is awaiting activation.");
        return;
      }

      if (!response.ok) {
        showErr(
          "register-err",
          result.message || "We couldn’t create your account just now."
        );
        return;
      }

      if (
        result.user &&
        HOME[result.user.role] &&
        typeof result.token === "string" &&
        result.token
      ) {
        setSession(result.user, result.token);
        form.reset();
        render();
        nav(HOME[result.user.role]);
        return;
      }

      flash = "Your account and patient profile are ready. Please log in.";
      form.reset();
      nav("login");
    } catch {
      showErr("register-err", "Unable to reach the registration service.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  async function logout(button) {
    if (button) button.disabled = true;

    let tabToken = null;
    try {
      tabToken = sessionStorage.getItem("mc_tab_token");
    } catch {}

    const headers = { "X-Medichannel-Tab": "1" };
    if (tabToken) headers.Authorization = "Bearer " + tabToken;

    try {
      await fetchWithTimeout("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers,
      });
    } catch {
      // Clear locally regardless.
    }

    S = null;
    try {
      sessionStorage.removeItem("mc_tab_user");
      sessionStorage.removeItem("mc_tab_token");
    } catch {}
    disconnectRealtime();
    state.appointments = [];
    state.appointmentsLoaded = false;
    state.profile = null;
    clearBookingPanel();
    state.doctor = {
      sessions: [],
      sessionsLoaded: false,
      sessionId: null,
      queue: null,
      selected: null,
      summary: null,
      profile: null,
      identityLoading: false,
      queueTimer: null,
    };
    state.consult.appointmentId = null;
    state.consult.requestedId = null;
    state.consult.appointment = null;
    state.consult.summary = null;
    state.consult.list = [];
    state.notifications = [];
    state.syncedSummaryNotifications.clear();
    state.syncedReviewNotifications.clear();
    state.notificationsLoaded = false;
    state.shownToastIds.clear();
    state.myReviews = [];
    state.submittedFeedbackIds.clear();
    state.notificationsLoaded = false;
    auditLogState.page = 0;
    auditLogState.totalPages = 1;
    auditLogState.totalElements = 0;
    auditLogState.first = true;
    auditLogState.last = true;
    auditLogState.loading = false;
    auditLogState.filterUserId = null;
    if (auditLogState.refreshTimer) clearTimeout(auditLogState.refreshTimer);
    auditLogState.refreshTimer = null;
    auditLogState.refreshPending = false;
    if (state.auditLogTimer) clearInterval(state.auditLogTimer);
    state.auditLogTimer = null;
    unsubscribe("admin-audit-logs");
    renderNotificationBadge(0);
    render();
    hideQueue();
    nav("welcome");
  }

  // ---------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------

  document.addEventListener("focusout", (event) => {
    if (event.target.dataset && event.target.dataset.v) {
      chk(event.target);
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;

    if (target.dataset && target.dataset.v && target.getAttribute("aria-invalid") === "true") {
      chk(target);
    }

    if (target.id === "manager-f") {
      renderManagerReception();
      return;
    }

    if (target.id === "register-pw") {
      const score = [
        target.value.length >= 8,
        /[A-Za-z]/.test(target.value),
        /\d/.test(target.value),
        /[^A-Za-z0-9]/.test(target.value),
      ].filter(Boolean).length;

      const strength = $("register-st");
      if (strength) {
        strength.style.width = (score / 4) * 100 + "%";
        strength.style.background =
          score >= 3 ? "#38A169" : score === 2 ? "#D69E2E" : "#E53E3E";
      }
    }
  });

  document.addEventListener("click", async (event) => {
    const skipLink = event.target.closest && event.target.closest("[data-skip-link]");
    if (skipLink) {
      event.preventDefault();
      document.querySelectorAll('main[id="main-content"]').forEach((main) => {
        main.removeAttribute("id");
      });
      const visibleView =
        views.find((view) => !view.hidden) ||
        document.querySelector('[data-view="welcome"]');
      const main = visibleView && visibleView.querySelector("main");
      if (main) {
        main.id = "main-content";
        main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
        main.scrollIntoView({ block: "start" });
      }
      return;
    }

    if (!event.target.closest("[data-notification-wrapper]")) {
      closeNotificationPopovers();
    }

    const bellBtn = event.target.closest("[data-notification-bell]");
    if (bellBtn) {
      const wrapper = bellBtn.closest("[data-notification-wrapper]");
      if (wrapper) {
        const popover = wrapper.querySelector("[data-notification-popover]");
        if (popover) {
          const wasHidden = popover.hidden;
          closeNotificationPopovers();
          popover.hidden = !wasHidden;
          bellBtn.setAttribute("aria-expanded", String(!popover.hidden));
          if (!popover.hidden) {
            renderNotificationPopover(popover);
          }
        }
      }
      return;
    }

    if (event.target.closest("[data-mark-all-read]")) {
      const btn = event.target.closest("[data-mark-all-read]");
      btn.disabled = true;
      try {
        if (typeof MC.markAllNotificationsRead === "function") {
          await MC.markAllNotificationsRead();
        }
        (state.notifications || []).forEach((n) => { n.read = true; });
        renderNotificationBadge(0);
        const popover = btn.closest("[data-notification-popover]");
        if (popover) renderNotificationPopover(popover);
      } catch (e) {
        console.warn("Could not mark all read:", e);
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (event.target.closest("[data-retry-manager-dashboard]")) {
      void loadManagerDashboard({ force: true });
      return;
    }

    if (event.target.closest("[data-refresh-audit]")) {
      const btn = event.target.closest("[data-refresh-audit]");
      btn.disabled = true;
      try {
        await loadAuditLogs();
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (event.target.closest("[data-audit-prev]")) {
      const btn = event.target.closest("[data-audit-prev]");
      if (!btn.disabled && auditLogState.page > 0) {
        void loadAuditLogs({ page: auditLogState.page - 1 });
      }
      return;
    }

    if (event.target.closest("[data-audit-next]")) {
      const btn = event.target.closest("[data-audit-next]");
      if (!btn.disabled && !auditLogState.last) {
        void loadAuditLogs({ page: auditLogState.page + 1 });
      }
      return;
    }

    if (event.target.closest("[data-retry-audit]")) {
      loadOnce(loadAuditLogs);
      return;
    }

    if (event.target.closest("[data-refresh-sessions]")) {
      const btn = event.target.closest("[data-refresh-sessions]");
      btn.disabled = true;
      try {
        invalidateManagerDashboard();
        await loadManagerSessions();
      } finally {
        btn.disabled = false;
      }
      return;
    }

    const delaySessionBtn = event.target.closest("[data-delay-session]");
    if (delaySessionBtn) {
      const sessionId = delaySessionBtn.getAttribute("data-delay-session");
      if (sessionId) {
        const minutes = await promptDelayMinutes("Delay this session");
        if (minutes == null) return;
        delaySessionBtn.disabled = true;
        try {
          await MC.delaySession(sessionId, minutes);
          showNotificationToast({
            title: "Session delayed",
            message:
              "Session delayed by " +
              minutes +
              " minute(s). Booked patients notified.",
          });
          invalidateManagerDashboard();
          await loadManagerSessions();
          state.sessionsLoaded = false;
          void loadSessions();
          loadOnce(loadAuditLogs);
        } catch (err) {
          setAppMessage(err.message || "Failed to delay session.");
          delaySessionBtn.disabled = false;
        }
      }
      return;
    }

    const cancelSessionBtn = event.target.closest("[data-cancel-session]");
    if (cancelSessionBtn) {
      const sessionId = cancelSessionBtn.getAttribute("data-cancel-session");
      if (sessionId) {
        const reason = await confirmAppointmentCancel(sessionId, {
          title: "Cancel this session?",
          message:
            "A reason is required. Every booked patient will be notified and their appointment history is preserved.",
        });
        if (!reason) return;
        cancelSessionBtn.disabled = true;
        try {
          await MC.cancelSession(sessionId, reason);
          showNotificationToast({
            title: "Session cancelled",
            message: "Session cancelled. Booked patients notified.",
          });
          invalidateManagerDashboard();
          await loadManagerSessions();
          state.sessionsLoaded = false;
          void loadSessions();
          loadOnce(loadAuditLogs);
        } catch (err) {
          setAppMessage(err.message || "Failed to cancel session.");
          cancelSessionBtn.disabled = false;
        }
      }
      return;
    }

    if (event.target.closest("[data-refresh-staff]")) {
      const btn = event.target.closest("[data-refresh-staff]");
      btn.disabled = true;
      try {
        await loadStaffAccounts();
        await loadAdminStats();
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (event.target.closest("[data-refresh-rooms]")) {
      const btn = event.target.closest("[data-refresh-rooms]");
      btn.disabled = true;
      try {
        await loadAdminRooms();
      } finally {
        btn.disabled = false;
      }
      return;
    }

    const toggleBtn = event.target.closest("[data-toggle-user]");
    if (toggleBtn) {
      const userId = toggleBtn.getAttribute("data-toggle-user");
      const action = toggleBtn.getAttribute("data-action");
      if (userId) {
        toggleBtn.disabled = true;
        try {
          if (action === "suspend") {
            await MC.adminSuspendUser(userId);
          } else {
            await MC.adminActivateUser(userId);
          }
          await loadStaffAccounts();
        } catch (err) {
          setAppMessage(err.message || "Failed to update user status.");
          toggleBtn.disabled = false;
        }
      }
      return;
    }

    const editUserBtn = event.target.closest("[data-edit-user]");
    if (editUserBtn) {
      openEditAccount(editUserBtn.getAttribute("data-edit-user"));
      return;
    }

    const deleteUserBtn = event.target.closest("[data-delete-user]");
    if (deleteUserBtn) {
      openDeleteAccount(deleteUserBtn.getAttribute("data-delete-user"));
      return;
    }

    const resetUserBtn = event.target.closest("[data-reset-user]");
    if (resetUserBtn) {
      openResetPassword(resetUserBtn.getAttribute("data-reset-user"));
      return;
    }


    const showButton = event.target.closest("[data-show]");
    if (showButton) {
      const input = $(showButton.closest("[data-view]").dataset.view + "-" + showButton.dataset.show);
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
        showButton.textContent = input.type === "password" ? "Show" : "Hide";
      }
      return;
    }

    if (event.target.closest("[data-out]")) {
      void logout(event.target.closest("[data-out]"));
      return;
    }

    if (event.target.closest("[data-wake-retry]")) {
      void wakeBackend();
      return;
    }

    if (event.target.closest("[data-open-walkin]")) {
      openWalkInDialog();
      return;
    }

    const panelLink = event.target.closest("[data-panel-link]");
    if (panelLink) {
      event.preventDefault();
      activatePanel(panelLink.closest("[data-view]"), panelLink);
      return;
    }

    const book = event.target.closest("[data-book-session]");
    if (book) {
      const session = state.sessions.find(
        (item) => item.sessionId === book.dataset.bookSession
      );
      if (session) selectSession(session);
      return;
    }

    if (event.target.closest("[data-booking-confirm]")) {
      void confirmBooking();
      return;
    }

    const payBookingButton = event.target.closest("[data-booking-pay]");
    if (payBookingButton) {
      void payBooking(payBookingButton.dataset.bookingPay);
      return;
    }

    if (event.target.closest("[data-booking-goto]")) {
      nav("appointments");
      return;
    }

    const payRow = event.target.closest("[data-pay-appointment]");
    if (payRow) {
      void payAppointment(payRow.dataset.payAppointment, payRow);
      return;
    }

    const checkin = event.target.closest("[data-checkin-appointment]");
    if (checkin) {
      void checkInAppointment(checkin.dataset.checkinAppointment);
      return;
    }

    const delayAppointment = event.target.closest("[data-delay-appointment]");
    if (delayAppointment) {
      void delayAppointmentQueue(
        delayAppointment.dataset.delayAppointment,
        delayAppointment
      );
      return;
    }

    const cancel = event.target.closest("[data-cancel-appointment]");
    if (cancel) {
      void cancelAppointment(cancel.dataset.cancelAppointment, cancel);
      return;
    }

    const clear = event.target.closest("[data-clear-appointment]");
    if (clear) {
      void clearAppointmentHistory(clear.dataset.clearAppointment, clear);
      return;
    }

    const arrive = event.target.closest("[data-arrive-appointment]");
    if (arrive) {
      void markManagerArrived(arrive.dataset.arriveAppointment, arrive);
      return;
    }

    const reviewAction = event.target.closest("[data-review-action]");
    if (reviewAction) {
      void moderateManagerReview(
        reviewAction.dataset.reviewId,
        reviewAction.dataset.reviewAction,
        reviewAction
      );
      return;
    }

    const joinOnline = event.target.closest("[data-join-online]");
    if (joinOnline) {
      state.consult.requestedId = joinOnline.getAttribute("data-join-online");
      nav("consult");
      return;
    }

    const openConsult = event.target.closest("[data-open-consult]");
    if (openConsult) {
      state.consult.requestedId = openConsult.dataset.openConsult;
      nav("consult");
      return;
    }

    const doctorRowAction = event.target.closest("[data-doctor-action]");
    if (doctorRowAction) {
      void runDoctorAction(
        doctorRowAction.dataset.doctorAction,
        doctorRowAction.dataset.doctorId,
        doctorRowAction
      );
      return;
    }

    if (event.target.closest("[data-doctor-refresh]")) {
      void loadDoctorQueue(state.doctor.sessionId);
      return;
    }

    if (event.target.closest("[data-appointments-refresh]")) {
      void loadAppointments();
      return;
    }

    if (event.target.closest("[data-save-summary]")) {
      void saveDoctorSummary();
      return;
    }

    if (event.target.closest("[data-print-summary]")) {
      printSummary();
      return;
    }

    if (event.target.closest("[data-consult-summary-toggle]")) {
      const form = document.querySelector("[data-consult-summary-form]");
      if (form) form.hidden = !form.hidden;
      return;
    }

    if (event.target.closest("[data-consult-summary-cancel]")) {
      const form = document.querySelector("[data-consult-summary-form]");
      if (form) form.hidden = true;
      return;
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "booking-date") {
      applyBookingDate(event.target.value);
      return;
    }

    if (event.target.id === "index-range") {
      state.sessionsLoaded = false;
      void loadSessions();
      return;
    }

    if (
      event.target.id === "manager-session-date" ||
      event.target.id === "manager-session-range"
    ) {
      loadOnce(loadManagerSessions);
      return;
    }

    if (event.target.id === "doctor-session-select" || event.target.id === "doctor-queue-session-select") {
      const val = event.target.value;
      state.doctor.sessionId = val;
      const other = event.target.id === "doctor-session-select"
        ? $("doctor-queue-session-select")
        : $("doctor-session-select");
      if (other) other.value = val;
      void loadDoctorQueue(val);
      return;
    }

    if (event.target.id === "doctor-notes-date") {
      void syncDoctorNotesSessions(event.target.value);
      return;
    }

    if (event.target.id === "doctor-notes-session") {
      void syncDoctorNotesPatients(event.target.value);
      return;
    }

    if (event.target.id === "consult-pick") {
      const select = event.target;
      const scrollY = window.scrollY;
      if (select && select.blur) select.blur();
      void openConsultation(select.value).then(() => {
        window.scrollTo({ top: scrollY, behavior: "instant" });
      });
      return;
    }

    if (event.target.id === "doctor-notes-pick") {
      const select = event.target;
      const scrollY = window.scrollY;
      if (select && select.blur) select.blur();
      const chosen = (state.doctor.sessionAppointments || []).find(
        (a) => a.appointmentId === select.value
      ) || (state.doctor.allAppointments || []).find(
        (a) => a.appointmentId === select.value
      );
      if (chosen) {
        void selectNotes(chosen).then(() => {
          window.scrollTo({ top: scrollY, behavior: "instant" });
        });
      }
    }
  });

  const loginForm = $("login-f");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  const registerForm = $("register-f");
  if (registerForm) registerForm.addEventListener("submit", handleRegister);

  const searchForm = document.querySelector('form[aria-label="Search sessions"]');
  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      state.sessionsLoaded = false;
      void loadSessions();
    });
  }

  const directoryForm = document.querySelector('form[aria-label="Search doctors"]');
  if (directoryForm) {
    directoryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      directoryFilters();
      renderDoctorDirectory();
    });
  }

  // Keep the public roster connected to the existing session dashboard:
  // following a doctor's login/register/session link pre-fills that doctor's
  // name in the session search. Booking itself is unchanged.
  document.addEventListener("click", (event) => {
    const link =
      event.target.closest && event.target.closest("[data-directory-doctor]");
    if (!link) return;

    const doctor = (state.directory.items || []).find(
      (item) => item && item.doctorId === link.dataset.directoryDoctor
    );
    const name = doctor
      ? [doctor.firstName, doctor.lastName].filter(Boolean).join(" ")
      : "";
    const query = $("index-q");
    if (name && query) query.value = name;
  });

  const consultRefresh = document.querySelector("[data-consult-refresh]");
  if (consultRefresh) {
    consultRefresh.addEventListener("click", () => {
      void refreshConsultationRoom();
    });
  }

  const chatForm = document.querySelector("[data-chat-form]");
  if (chatForm) {
    chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      sendChatMessage();
    });
  }

  const chatInput = $("consult-c");
  if (chatInput) chatInput.addEventListener("input", handleTypingInput);

  const feedbackForm = document.querySelector("[data-feedback-form]");
  if (feedbackForm) {
    feedbackForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitFeedback();
    });
  }

  const profileForm = document.querySelector("[data-profile-form]");
  if (profileForm) {
    profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void savePatientProfile(profileForm);
    });
  }

  const profileRefresh = document.querySelector("[data-profile-refresh]");
  if (profileRefresh) {
    profileRefresh.addEventListener("click", () => {
      void loadPatientProfile();
    });
  }

  const consultSummaryForm = document.querySelector("[data-consult-summary-form]");
  if (consultSummaryForm) {
    consultSummaryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitConsultSummary(event);
    });
  }

  document.querySelectorAll("[data-create-scope]").forEach((form) => {
    syncCreateFormRole(form);

    const roleSelect = form.querySelector("[data-role-select]");
    if (roleSelect) {
      roleSelect.addEventListener("change", () => syncCreateFormRole(form));
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void handleCreateAccount(form);
    });
  });

  const editAccountForm = $("edit-account-form");
  if (editAccountForm) {
    editAccountForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = editAccountForm.querySelector("[data-edit-status]");
      const save = editAccountForm.querySelector("[data-edit-save]");
      const role = editAccountForm.dataset.role;
      const userId = editAccountForm.dataset.userId;
      const doctorId = editAccountForm.dataset.doctorId;

      const field = (name) => {
        const input = editAccountForm.querySelector(`[data-edit-field="${name}"]`);
        return input ? String(input.value || "").trim() : "";
      };

      if (save) save.disabled = true;
      setStatus(status, "Saving changes…");

      try {
        if (role === "DOCTOR") {
          if (!doctorId) {
            throw new Error("This doctor has no clinical profile to edit.");
          }
          const firstName = field("firstName");
          const lastName = field("lastName");
          const registrationNumber = field("registrationNumber");
          const specialisationId = field("specialisationId");
          const consultationFee = Number(field("consultationFee") || 0);

          if (!firstName || !lastName || !registrationNumber ||
              !specialisationId || !(consultationFee >= 0)) {
            throw new Error("Please fill in every required doctor field.");
          }

          await MC.adminUpdateDoctor(doctorId, {
            firstName,
            lastName,
            registrationNumber,
            qualification: field("qualification"),
            specialisationId,
            consultationFee,
          });
        } else {
          const email = field("email");
          if (!email) {
            throw new Error("Please enter an email address.");
          }
          await MC.adminUpdateUser(userId, { email });
        }

        const dialog = $("edit-account-dialog");
        if (dialog) dialog.close();
        await loadStaffAccounts();
        loadOnce(loadAdminStats);
        loadOnce(loadAuditLogs);
      } catch (error) {
        setStatus(status, error.message || "Unable to save the account.", true);
      } finally {
        if (save) save.disabled = false;
      }
    });
  }

  const editCancel = document.querySelector("[data-edit-cancel]");
  if (editCancel) {
    editCancel.addEventListener("click", () => {
      const dialog = $("edit-account-dialog");
      if (dialog) dialog.close();
    });
  }

  const deleteAccountForm = $("delete-account-form");
  if (deleteAccountForm) {
    const confirmInput = deleteAccountForm.querySelector("[data-delete-confirm]");
    const deleteSubmit = deleteAccountForm.querySelector("[data-delete-submit]");

    if (confirmInput && deleteSubmit) {
      confirmInput.addEventListener("input", () => {
        deleteSubmit.disabled = confirmInput.value.trim() !== "DELETE";
      });
    }

    deleteAccountForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = deleteAccountForm.querySelector("[data-delete-status]");
      const userId = deleteAccountForm.dataset.userId;

      if (!confirmInput || confirmInput.value.trim() !== "DELETE") {
        setStatus(status, "Type DELETE exactly to confirm.", true);
        return;
      }

      if (deleteSubmit) deleteSubmit.disabled = true;
      setStatus(status, "Deleting account…");

      try {
        await MC.adminDeleteUser(userId);
        const dialog = $("delete-account-dialog");
        if (dialog) dialog.close();
        setAppMessage("Account permanently disabled. Its history is retained.");
        await loadStaffAccounts();
        loadOnce(loadAdminStats);
        loadOnce(loadAuditLogs);
      } catch (error) {
        setStatus(status, error.message || "Unable to delete the account.", true);
        if (deleteSubmit) deleteSubmit.disabled = false;
      }
    });
  }

  const deleteCancel = document.querySelector("[data-delete-cancel]");
  if (deleteCancel) {
    deleteCancel.addEventListener("click", () => {
      const dialog = $("delete-account-dialog");
      if (dialog) dialog.close();
    });
  }

  const resetPasswordForm = $("reset-password-form");
  if (resetPasswordForm) {
    const showPasswords = resetPasswordForm.querySelector("[data-reset-show]");
    if (showPasswords) {
      showPasswords.addEventListener("change", () => {
        const type = showPasswords.checked ? "text" : "password";
        resetPasswordForm
          .querySelectorAll("[data-reset-password], [data-reset-confirm]")
          .forEach((input) => {
            input.type = type;
          });
      });
    }

    resetPasswordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = resetPasswordForm.querySelector("[data-reset-status]");
      const submit = resetPasswordForm.querySelector("[data-reset-submit]");
      const password = resetPasswordForm.querySelector("[data-reset-password]");
      const confirmation = resetPasswordForm.querySelector("[data-reset-confirm]");
      const emailNode = resetPasswordForm.querySelector("[data-reset-email]");
      const email = emailNode ? emailNode.textContent : "the account";

      const validated = ManagerUI.staffPasswordPayload(
        password ? password.value : "",
        confirmation ? confirmation.value : ""
      );
      if (!validated.ok) {
        setStatus(status, validated.message, true);
        return;
      }
      if (!ManagerUI.lockAction(submit)) return;

      setStatus(status, "Resetting password…");
      try {
        await MC.resetStaffPassword(
          resetPasswordForm.dataset.userId,
          validated.payload
        );
        resetPasswordForm.reset();
        const dialog = $("reset-password-dialog");
        if (dialog && typeof dialog.close === "function") dialog.close();
        setAppMessage(
          "Password reset for " + email +
            ". The account was unlocked and all sessions were signed out.",
          "success"
        );
        await loadStaffAccounts();
        loadOnce(loadAuditLogs);
      } catch (error) {
        setStatus(
          status,
          error.message || "Unable to reset the password.",
          true
        );
      } finally {
        ManagerUI.unlockAction(submit);
      }
    });
  }

  const resetCancel = document.querySelector("[data-reset-cancel]");
  if (resetCancel) {
    resetCancel.addEventListener("click", () => {
      const dialog = $("reset-password-dialog");
      if (dialog && typeof dialog.close === "function") dialog.close();
    });
  }

  const walkinForm = $("walkin-form");
  if (walkinForm) {
    walkinForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitWalkIn(walkinForm);
    });
  }

  const walkinCancel = document.querySelector("[data-walkin-cancel]");
  if (walkinCancel) {
    walkinCancel.addEventListener("click", () => {
      const dialog = $("walkin-dialog");
      if (dialog && typeof dialog.close === "function") dialog.close();
    });
  }

  const adminCreateRoomForm = document.querySelector("[data-admin-create-room-form]");
  if (adminCreateRoomForm) {
    adminCreateRoomForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void handleAdminCreateRoom(adminCreateRoomForm);
    });
  }

  const managerCreateSessionForm = document.querySelector("[data-manager-create-session]");
  if (managerCreateSessionForm) {
    managerCreateSessionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void handleManagerCreateSession(managerCreateSessionForm);
    });
  }

  const sessDoc = $("sess-doc");
  if (sessDoc) {
    sessDoc.addEventListener("change", () => {
      const opt = sessDoc.selectedOptions[0];
      if (opt && opt.dataset.fee && $("sess-fee")) {
        $("sess-fee").value = opt.dataset.fee;
      }
    });
  }

  const sessType = $("sess-type");
  if (sessType) {
    sessType.addEventListener("change", () => {
      const roomSelect = $("sess-room");
      if (!roomSelect) return;
      if (sessType.value === "ONLINE") {
        roomSelect.value = "";
        roomSelect.disabled = true;
      } else {
        roomSelect.disabled = false;
      }
    });
  }

  const sessStart = $("sess-start");
  if (sessStart) {
    const syncSessionEnd = () => {
      const endInput = $("sess-end");
      if (endInput) endInput.value = windowEndForStart(sessStart.value);
    };
    sessStart.addEventListener("change", syncSessionEnd);
    syncSessionEnd();
  }

  // Searchable dropdown interactions. These are delegated so dynamically
  // populated selects are enhanced without any per-control wiring.
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (
        searchSelectPanel &&
        !searchSelectPanel.panel.contains(target) &&
        target.closest("select") !== searchableSelect
      ) {
        closeSearchSelect();
      }

      const select = target.closest("select");
      if (!select || !isSearchableSelect(select) || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      openSearchSelect(select);
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        searchSelectPanel &&
        searchableSelect &&
        searchSelectPanel.panel.contains(event.target)
      ) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSearchableActive(searchableIndex + 1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSearchableActive(searchableIndex - 1);
          return;
        }
        if (event.key === "Enter" && searchableIndex >= 0) {
          event.preventDefault();
          const option = searchSelectPanel.list.querySelector(
            "button[data-search-value][data-active='true']"
          );
          if (option) chooseSearchableOption(option.dataset.searchValue);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          const previous = searchableSelect;
          closeSearchSelect();
          if (previous) previous.focus();
          return;
        }
      }

      if (event.key === "Escape") {
        closeSearchSelect();
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const select = target ? target.closest("select") : null;
      if (!select || !isSearchableSelect(select)) return;
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openSearchSelect(select);
      }
    },
    true
  );

  document.addEventListener(
    "close",
    (event) => {
      if (
        searchableSelect &&
        event.target instanceof Element &&
        event.target.contains(searchableSelect)
      ) {
        closeSearchSelect();
      }
    },
    true
  );

  document.addEventListener("focusout", (event) => {
    if (!searchableSelect || !searchSelectPanel) return;
    setTimeout(() => {
      if (!searchableSelect) return;
      if (
        searchSelectPanel.panel.contains(document.activeElement) ||
        document.activeElement === searchableSelect
      ) {
        return;
      }
      closeSearchSelect();
    }, 0);
  });

  window.addEventListener("resize", () => closeSearchSelect());
  window.addEventListener(
    "scroll",
    (event) => {
      if (
        searchSelectPanel &&
        Date.now() >= suppressScrollCloseUntil &&
        !searchSelectPanel.panel.contains(event.target)
      ) {
        closeSearchSelect();
      }
    },
    true
  );

  window.addEventListener("hashchange", () => go());

  window.addEventListener("pageshow", (event) => {
    if (event && event.persisted && !S) {
      // A back/forward-cache restore can bring back the pre-logout DOM.
      clearBookingPanel();
      hideQueue();
      render();
      return;
    }
    if (document.body.dataset.appReady === "true" && S) {
      void refreshPatientQueue();
    }
  });

  window.addEventListener("online", () => {
    void wakeBackend();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void wakeBackend();
  });

  const welcomeImage = document.querySelector('[data-view="welcome"] main figure');
  if (welcomeImage) welcomeImage.classList.add("mc-motion-hero-image");

  // Signature CTA interactive hover and approach handler
  const ctaPrimary = document.querySelector(".mc-cta-primary");
  const ctaPulse = document.querySelector(".mc-cta-travel-pulse");
  if (ctaPrimary && ctaPulse) {
    ctaPrimary.addEventListener("pointerenter", () => {
      if (prefersReducedMotion.matches) return;
      ctaPulse.setAttribute("cx", "68");
      ctaPulse.style.opacity = "0.95";
    });
    ctaPrimary.addEventListener("pointerleave", () => {
      if (prefersReducedMotion.matches) return;
      ctaPulse.setAttribute("cx", "12");
      ctaPulse.style.opacity = "0";
    });
    ctaPrimary.addEventListener("click", () => {
      if (prefersReducedMotion.matches) return;
      ctaPulse.setAttribute("cx", "74");
      ctaPulse.style.opacity = "1";
    });
  }
  setupPublicScrollReveals();
  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------

  function finishBoot(unavailable) {
    if (bootTimer) {
      clearTimeout(bootTimer);
      bootTimer = null;
    }

    document.body.dataset.appReady = "true";
    const bootOverlay = document.querySelector(".app-boot-screen");
    if (bootOverlay) {
      bootOverlay.setAttribute("aria-hidden", "true");
    }

    if (unavailable && !S) {
      setAppMessage(
        "We could not verify your session. Please sign in again or retry."
      );
    }

    render();

    const target = resolveView(parseHash());
    showView(target.id, target.panel, { force: true });

    if (target.consultId) {
      state.consult.requestedId = target.consultId;
      if (activeView === "consult") void loadConsultationPicker();
    }
  }

  async function initializeApp() {
    let unavailable = false;
    let tabToken = null;
    try {
      tabToken = sessionStorage.getItem("mc_tab_token");
    } catch {}

    // Only the token stored in this tab can restore a session. A copied URL
    // carries no credential, and an ambient cookie from another tab/window is
    // ignored, so a new browsing context always opens as a guest.
    if (!tabToken) {
      S = null;
      // A tab without a token has no session, even if an older build left a
      // cached user object behind.
      try { sessionStorage.removeItem("mc_tab_user"); } catch {}
      // Yield after script evaluation so first paint and boot rendering are
      // separate main-thread tasks.
      setTimeout(() => finishBoot(false), 0);
      return;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await MC.me();

        if (!result) {
          S = null;
          break;
        }

        if (result.user) {
          setSession(result.user);
          break;
        }

        unavailable = true;
      } catch {
        unavailable = true;
      }

      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, attempt === 0 ? 1000 : 3000)
        );
      }
    }

    finishBoot(unavailable);
  }

  bootTimer = setTimeout(() => {
    if (document.body.dataset.appReady === "true") return;

    bootTimer = null;
    document.body.dataset.appReady = "true";
    const bootOverlay = document.querySelector(".app-boot-screen");
    if (bootOverlay) {
      bootOverlay.setAttribute("aria-hidden", "true");
    }
    setAppMessage(
      "The session check is taking longer than expected. Please sign in again if needed."
    );
    render();
    const target = resolveView(parseHash());
    showView(target.id, target.panel, { force: true });
  }, 15000);

  void wakeBackend();
  void initializeApp();
})();
