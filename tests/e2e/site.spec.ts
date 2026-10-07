import { expect, test, type Page } from "@playwright/test";

const PAGES = ["/", "/features/", "/pricing/", "/security/", "/about/", "/contact/", "/privacy/"];

/** Each test gets its own client address, so the contact form's rate limit never trips by accident. */
let ipCounter = 0;
function freshIp(workerIndex: number): string {
  ipCounter += 1;
  return `198.51.${100 + workerIndex}.${ipCounter}`;
}

/**
 * Collects console errors and content security policy violations, and keeps the tests off the
 * network: Satoshi normally comes from Fontshare, here it is replaced with an empty stylesheet.
 */
async function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await page.route("https://api.fontshare.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://cdn.fontshare.com/**", (route) => route.fulfill({ status: 404, body: "" }));
  return problems;
}

test.describe("pages", () => {
  for (const path of PAGES) {
    test(`${path} renders cleanly`, async ({ page }) => {
      const problems = await watch(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page).toHaveTitle(/MemberCove/);
      expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
      expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(/^https:\/\/membercove\.com\//);
      expect(await page.locator('meta[http-equiv="content-security-policy"]').count()).toBe(1);

      // Every image has alt text (empty for decoration), and every one on screen actually loads.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
      });
      for (const img of await page.locator("img").all()) {
        expect(await img.getAttribute("alt")).not.toBeNull();
        if (!(await img.isVisible())) continue; // in a closed tab, or a size this layout hides
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      }
      expect(problems).toEqual([]);
    });
  }

  test("every internal link and anchor resolves", async ({ page, request }) => {
    await watch(page);
    const seen = new Set<string>();
    for (const path of PAGES) {
      await page.goto(path);
      const hrefs = await page.locator('a[href^="/"]').evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
      for (const href of hrefs) {
        const [target = "/", hash] = href.split("#");
        if (!seen.has(target)) {
          seen.add(target);
          const res = await request.get(target);
          expect(res.status(), `${href} linked from ${path}`).toBe(200);
        }
        if (hash) {
          await page.goto(target);
          await expect(page.locator(`[id="${hash}"]`), `#${hash} on ${target}`).toHaveCount(1);
          await page.goto(path);
        }
      }
    }
  });

  test("security headers come with every page", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("robots.txt and the sitemap list the site", async ({ request }) => {
    expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://membercove.com/sitemap-index.xml");
    const sitemap = await (await request.get("/sitemap-0.xml")).text();
    for (const path of PAGES) expect(sitemap).toContain(`https://membercove.com${path}`);
    expect(sitemap).not.toContain("/404");
    expect(sitemap).not.toContain("/contact/thanks/");
  });

  test("an unknown address gets the 404 page", async ({ page }) => {
    await watch(page);
    const response = await page.goto("/no-such-page/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("That page isn't here");
  });
});

test.describe("navigation", () => {
  test("the menu opens and closes on small screens", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The menu button only shows on small screens");
    await watch(page);
    await page.goto("/");
    const button = page.getByRole("button", { name: "Open menu" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    const menu = page.locator("#mobile-menu");
    await expect(menu).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await menu.getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing\/$/);
  });

  test("the menu button still appears when the page script is slow", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The menu button only shows on small screens");
    await watch(page);
    // A slow stylesheet holds the page script back past the head script's 2.5 second fallback,
    // which takes the js class off again before the page script adds js-ready.
    await page.route(/\/_astro\/.*\.css$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3500));
      await route.continue();
    });
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveClass(/js-ready/, { timeout: 10_000 });
    expect(await page.evaluate(() => document.documentElement.classList.contains("js"))).toBe(false);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test("the open menu scrolls on a short screen", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The menu button only shows on small screens");
    await watch(page);
    await page.setViewportSize({ width: 320, height: 256 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const last = page.locator("#mobile-menu").getByRole("link", { name: "Book a demo" });
    await last.focus();
    await expect(last).toBeInViewport();
  });

  test("the desktop links mark the current page", async ({ page, isMobile }) => {
    test.skip(isMobile, "The links are in the menu on small screens");
    await watch(page);
    await page.goto("/security/");
    await expect(page.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: "Security" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("home page interactions", () => {
  test("tabs switch with clicks and arrow keys", async ({ page }) => {
    await watch(page);
    await page.goto("/");
    const tablist = page.getByRole("tablist", { name: "Busy times of year" });
    await tablist.scrollIntoViewIfNeeded();
    await expect(page.locator("#closer-panel-renewals")).toBeVisible();
    await expect(page.locator("#closer-panel-events")).toBeHidden();

    await tablist.getByRole("tab", { name: "Events" }).click();
    await expect(page.locator("#closer-panel-events")).toBeVisible();
    await expect(page.locator("#closer-panel-renewals")).toBeHidden();

    await tablist.getByRole("tab", { name: "Events" }).press("ArrowRight");
    await expect(tablist.getByRole("tab", { name: "Email" })).toBeFocused();
    await expect(tablist.getByRole("tab", { name: "Email" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#closer-panel-email")).toBeVisible();
  });

  test("a focused tab shows a marigold focus ring", async ({ page }) => {
    await watch(page);
    await page.goto("/");
    const tab = page.getByRole("tablist", { name: "Busy times of year" }).getByRole("tab", { name: "Renewals" });
    await tab.scrollIntoViewIfNeeded();
    await tab.focus();
    await page.keyboard.press("ArrowRight");
    const focused = page.getByRole("tablist", { name: "Busy times of year" }).getByRole("tab", { name: "Events" });
    await expect(focused).toBeFocused();
    const outline = await focused.evaluate((el) => getComputedStyle(el).outlineColor);
    expect(outline).toBe("rgb(242, 202, 75)");
  });

  test("FAQ answers open and the topic tabs switch", async ({ page }) => {
    await watch(page);
    await page.goto("/");
    const question = page.getByText("Does MemberCove replace our website?");
    await question.scrollIntoViewIfNeeded();
    await question.click();
    await expect(page.getByText("your website stays where it is")).toBeVisible();

    await page.getByRole("tab", { name: "Data and security" }).click();
    await expect(page.getByText("Do you store card numbers?")).toBeVisible();
    await expect(page.getByText("Does MemberCove replace our website?")).toBeHidden();
  });

  test("feature cards turn over to show their link", async ({ page, isMobile }) => {
    await watch(page);
    await page.goto("/");
    const tile = page.locator("[data-flip]").first();
    await tile.scrollIntoViewIfNeeded();
    if (isMobile) await tile.tap();
    else await tile.hover();
    await expect
      .poll(() => tile.locator(".flip-inner").evaluate((el) => getComputedStyle(el).transform))
      .not.toBe("none");
    await expect(tile.getByRole("link", { name: /Learn more/ })).toHaveAttribute("href", "/features/#members");
  });
});

test.describe("entrance animations", () => {
  test.use({ reducedMotion: "no-preference" });

  test("everything that fades in ends up visible", async ({ page }) => {
    await watch(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/js-ready/);
    for (const item of await page.locator(".reveal:visible").all()) {
      await item.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await expect(item).toHaveClass(/is-visible/);
      await expect.poll(() => item.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }
  });

  test("reaching the bottom of the page shows anything still waiting", async ({ page }) => {
    await watch(page);
    await page.goto("/pricing/");
    await expect(page.locator("html")).toHaveClass(/js-ready/);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    for (const item of await page.locator(".reveal:visible").all()) await expect(item).toHaveClass(/is-visible/);
  });
});

test.describe("contact form", () => {
  test("sends a message and says thanks", async ({ page }, testInfo) => {
    await watch(page);
    await page.setExtraHTTPHeaders({ "cf-connecting-ip": freshIp(testInfo.workerIndex) });
    await page.goto("/contact/");
    await page.getByLabel("Your name *").fill("Dana Whitfield");
    await page.getByLabel("Work email *").fill("dana@baysidepma.example");
    await page.getByLabel("Association *").fill("Bayside Practice Managers Association");
    await page.getByLabel("Number of members").selectOption("250 to 1,000");
    await page.getByLabel("What would you like to know?").fill("How do renewals work?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("heading", { name: "Thanks, your message is on its way" })).toBeVisible();
    await expect(page.getByText("dana@baysidepma.example")).toBeVisible();
  });

  test("points out missing fields without sending", async ({ page }) => {
    await watch(page);
    let posted = false;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/contact")) posted = true;
    });
    await page.goto("/contact/");
    await page.getByLabel("Work email *").fill("not an email");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Please enter your name.")).toBeVisible();
    await expect(page.getByText("Please enter a valid email address.")).toBeVisible();
    await expect(page.getByLabel("Your name *")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Your name *")).toBeFocused();
    expect(posted).toBe(false);
  });

  test("shows the server's answer when it refuses", async ({ page }, testInfo) => {
    await watch(page);
    const ip = freshIp(testInfo.workerIndex);
    // Use up this address's allowance, then send through the form.
    for (let i = 0; i < 5; i += 1) {
      await page.request.post("/api/contact", { headers: { accept: "application/json", "cf-connecting-ip": ip }, data: {} });
    }
    await page.setExtraHTTPHeaders({ "cf-connecting-ip": ip });
    await page.goto("/contact/");
    await page.getByLabel("Your name *").fill("Dana Whitfield");
    await page.getByLabel("Work email *").fill("dana@baysidepma.example");
    await page.getByLabel("Association *").fill("Bayside PMA");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert")).toContainText("Too many messages");
    await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  });
});

test.describe("contact form without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("posts normally and lands on the thank-you page", async ({ page }, testInfo) => {
    await watch(page);
    await page.setExtraHTTPHeaders({ "cf-connecting-ip": freshIp(testInfo.workerIndex) });
    await page.goto("/contact/");
    await page.getByLabel("Your name *").fill("Dana Whitfield");
    await page.getByLabel("Work email *").fill("dana@baysidepma.example");
    await page.getByLabel("Association *").fill("Bayside PMA");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page).toHaveURL(/\/contact\/thanks\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thanks, your message is on its way");
  });

  test("content is visible with no script at all", async ({ page }) => {
    await watch(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What MemberCove takes care of" })).toBeVisible();
    // Every tab panel shows when the tabs can't work.
    await expect(page.locator("#closer-panel-email")).toBeVisible();
  });
});

test.describe("contact API", () => {
  test("answers only POST, from this site, with valid fields", async ({ request }, testInfo) => {
    const headers = { accept: "application/json", "cf-connecting-ip": freshIp(testInfo.workerIndex) };
    expect((await request.get("/api/contact")).status()).toBe(405);
    expect((await request.get("/api/nothing-here")).status()).toBe(404);

    const foreign = await request.post("/api/contact", { headers: { ...headers, origin: "https://elsewhere.example" }, data: { name: "A", email: "a@b.co", association: "C" } });
    expect(foreign.status()).toBe(403);

    const invalid = await request.post("/api/contact", { headers, data: { name: "", email: "nope", association: "" } });
    expect(invalid.status()).toBe(400);
    const body = (await invalid.json()) as { errors: Record<string, string> };
    expect(Object.keys(body.errors).sort()).toEqual(["association", "email", "name"]);

    const bot = await request.post("/api/contact", { headers, data: { name: "A", email: "a@b.co", association: "C", website: "spam" } });
    expect(bot.status()).toBe(200);
  });

  test("limits each address to five messages a minute", async ({ request }, testInfo) => {
    const headers = { accept: "application/json", "cf-connecting-ip": freshIp(testInfo.workerIndex) };
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await request.post("/api/contact", { headers, data: {} })).status());
    expect(statuses.slice(0, 5).every((status) => status === 400)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
