/**
 * Page behaviour shared by every page: entrance animations, the header border, the mobile menu,
 * tabs and the flip tiles. Everything here is an enhancement; without it the pages still read.
 */

const root = document.documentElement;

// Entrance animations. global.css hides .reveal only while <html> has the js class, and the inline
// head script takes that class off again unless js-ready shows up, so a failed load never hides content.
function initReveal() {
  const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    // Wait until an element is a little way up from the bottom edge, so the rise is seen.
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  items.forEach((el) => observer.observe(el));

  // An element in that bottom strip at the very end of the page could never move up into view,
  // so once the visitor reaches the bottom, show whatever is still waiting.
  const revealRest = () => {
    if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 2) return;
    for (const el of items) {
      if (el.classList.contains("is-visible")) continue;
      el.classList.add("is-visible");
      observer.unobserve(el);
    }
    window.removeEventListener("scroll", revealRest);
  };
  window.addEventListener("scroll", revealRest, { passive: true });
  revealRest();
}

function initHeader() {
  const header = document.querySelector<HTMLElement>("[data-header]");
  if (!header) return;
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

function initMenu() {
  const button = document.querySelector<HTMLButtonElement>("[data-menu-button]");
  const menu = document.querySelector<HTMLElement>("[data-menu]");
  if (!button || !menu) return;
  const label = button.querySelector<HTMLElement>("[data-menu-label]");
  const openIcon = button.querySelector<HTMLElement>("[data-menu-open-icon]");
  const closeIcon = button.querySelector<HTMLElement>("[data-menu-close-icon]");

  const setOpen = (open: boolean) => {
    button.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
    if (label) label.textContent = open ? "Close menu" : "Open menu";
    openIcon?.classList.toggle("hidden", open);
    closeIcon?.classList.toggle("hidden", !open);
  };

  button.addEventListener("click", () => setOpen(button.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      button.focus();
    }
  });
  // Close when the window grows past the breakpoint, so the menu is not left open behind the links.
  window.matchMedia("(min-width: 992px)").addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}

/**
 * Tabs, following the WAI-ARIA tabs pattern: arrow keys, Home and End move between tabs, and only
 * the selected tab is in the tab order. Without this script every panel shows, one after another.
 */
function initTabs() {
  document.querySelectorAll<HTMLElement>("[data-tabs]").forEach((group) => {
    const tabs = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls") ?? ""));

    const select = (index: number, focus: boolean) => {
      tabs.forEach((tab, i) => {
        const selected = i === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        const panel = panels[i];
        if (panel) {
          panel.hidden = !selected;
          panel.classList.toggle("is-active", selected);
        }
      });
      if (focus) tabs[index]?.focus();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(i, false));
      tab.addEventListener("keydown", (event) => {
        const last = tabs.length - 1;
        let next: number | undefined;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = i === last ? 0 : i + 1;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = i === 0 ? last : i - 1;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = last;
        if (next === undefined) return;
        event.preventDefault();
        select(next, true);
      });
    });

    const initial = Math.max(
      0,
      tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true"),
    );
    select(initial, false);
  });
}

/**
 * Flip tiles turn over on hover and keyboard focus (CSS). On touch screens there is no hover, so a
 * tap on the front turns the tile over, and a tap on the back (outside its link) turns it back.
 */
function initFlipTiles() {
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  document.querySelectorAll<HTMLElement>("[data-flip]").forEach((tile) => {
    tile.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("a")) return;
      tile.classList.toggle("is-flipped");
    });
  });
}

initReveal();
initHeader();
initMenu();
initTabs();
initFlipTiles();
root.classList.add("js-ready");
