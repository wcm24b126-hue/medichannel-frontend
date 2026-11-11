(() => {
  const updateRail = (rail) => {
    const nav = rail.querySelector('nav[aria-label="Pages"]');
    const previous = rail.querySelector('[data-nav-direction="previous"]');
    const next = rail.querySelector('[data-nav-direction="next"]');

    if (!nav || !previous || !next) return;

    const maxScroll = nav.scrollWidth - nav.clientWidth;
    const hasOverflow = maxScroll > 2;
    const previousWasHidden = previous.hidden;
    const nextWasHidden = next.hidden;
    rail.classList.toggle("has-overflow", hasOverflow);
    previous.hidden = !hasOverflow || nav.scrollLeft <= 1;
    next.hidden = !hasOverflow || nav.scrollLeft >= maxScroll - 1;

    if (previous.hidden !== previousWasHidden || next.hidden !== nextWasHidden) {
      requestAnimationFrame(() => updateRail(rail));
    }
  };

  const updateAllRails = () => {
    document.querySelectorAll(".sn-scroll-rail").forEach(updateRail);
  };

  const setupRails = () => {
    document.querySelectorAll('nav[aria-label="Pages"]').forEach((nav, index) => {
      if (nav.parentElement?.classList.contains("sn-scroll-rail")) return;

      const rail = document.createElement("div");
      rail.className = "sn-scroll-rail";
      nav.id ||= `mediclinic-pages-${index + 1}`;
      nav.tabIndex = 0;
      nav.before(rail);

      const makeArrow = (direction, label, glyph) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "sn-scroll-arrow";
        button.dataset.navDirection = direction;
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-controls", nav.id);
        button.textContent = glyph;
        button.addEventListener("click", () => {
          nav.scrollLeft += (direction === "next" ? 1 : -1) * Math.max(160, nav.clientWidth * 0.7);
          updateRail(rail);
        });
        return button;
      };

      const previous = makeArrow("previous", "Scroll navigation left", "‹");
      const next = makeArrow("next", "Scroll navigation right", "›");
      rail.append(previous, nav, next);
      nav.addEventListener("scroll", () => updateRail(rail), { passive: true });

      if ("ResizeObserver" in window) {
        new ResizeObserver(() => updateRail(rail)).observe(nav);
      }

      new MutationObserver(() => requestAnimationFrame(() => updateRail(rail))).observe(
        nav,
        { attributes: true, childList: true, subtree: true, attributeFilter: ["hidden"] }
      );
      updateRail(rail);
    });

    new MutationObserver(() => requestAnimationFrame(updateAllRails)).observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class", "hidden", "style"],
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupRails, { once: true });
  } else {
    setupRails();
  }

  setTimeout(updateAllRails, 250);
  window.addEventListener("resize", updateAllRails, { passive: true });
  window.addEventListener("hashchange", () => {
    setTimeout(updateAllRails, 100);
  });
  window.addEventListener("load", () => setTimeout(updateAllRails, 250), { once: true });
})();
