import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/features/", "/pricing/", "/security/", "/about/", "/contact/", "/privacy/", "/contact/thanks/", "/no-such-page/"];

/** WCAG 2.1 A and AA checks from axe-core on every page, at both sizes. */
for (const path of PAGES) {
  test(`${path} has no WCAG A or AA violations`, async ({ page }) => {
    await page.route("https://api.fontshare.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join("\n  ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}
