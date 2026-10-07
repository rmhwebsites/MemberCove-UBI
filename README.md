# MemberCove website

The marketing site for MemberCove, membership software for practice management associations. It is built on the UBI design system from BYQ Supply and runs on Cloudflare Workers: Astro builds the pages into static files, Workers Static Assets serves them, and a small Worker handles the contact form.

| Page | Path |
| --- | --- |
| Home | `/` |
| Features | `/features/` |
| Pricing | `/pricing/` |
| Security | `/security/` |
| About | `/about/` |
| Contact (with the form) | `/contact/`, then `/contact/thanks/` |
| Privacy notice | `/privacy/` |
| Not found | any other address (`src/pages/404.astro`) |

## Running it

Node 22 and pnpm 10.

```bash
pnpm install
pnpm dev        # http://localhost:4321, pages only (the contact form needs the Worker)
pnpm preview    # builds, then serves everything through the Worker at http://localhost:8787
```

In `pnpm preview` the contact form sends for real through the local email simulator: each message is written to an `.eml` file under `.wrangler/tmp/email/`, and the terminal prints its path.

## Checks and tests

```bash
pnpm check                     # Worker types, astro check, the Worker's TypeScript, unit tests
pnpm build && pnpm test:e2e    # Playwright against the built site in the Workers runtime
```

The end-to-end tests run every page at desktop and phone sizes. They run axe-core's WCAG 2.1 A and AA checks, and check for console errors and content security policy violations, missing alt text, broken links and anchors, the security headers, the sitemap, the 404 page, the mobile menu, tabs, FAQ, flip cards and entrance animations, and the contact form with and without JavaScript, including its validation and rate limit. Set `CHROMIUM_PATH` to use a Chromium other than the one Playwright installed.

## Deploying on Cloudflare

The site deploys with Workers Builds, which builds and deploys on every push to `main`.

1. In the Cloudflare dashboard, go to Workers & Pages, choose Create, then Import a repository, and pick `rmhwebsites/MemberCove-UBI`.
2. Keep the Worker name `membercove-site` (it must match `name` in `wrangler.jsonc`).
3. Build command: `pnpm run build`. Deploy command: `npx wrangler deploy` (the default). Root directory: `/`.
4. Deploy. The site is then live on its `workers.dev` address.

`wrangler.jsonc` holds everything else: the assets folder, the 404 page, the email binding, the rate limiter and the two contact form settings. To deploy by hand instead: `pnpm exec wrangler login`, then `pnpm run deploy`.

### Contact form email

Messages are sent with Cloudflare Email Sending through the `EMAIL` binding, from `no-reply@mail.membercove.com` (the sending domain the MemberCove app already uses) to `hello@membercove.com`. Change either in `vars` in `wrangler.jsonc`; a new sender also has to be added to `allowed_sender_addresses`. Each message has Reply-To set to the visitor, so replying in your mail app answers them directly.

Before launch, make sure `hello@membercove.com` exists and receives mail. If sending ever fails, visitors are told and given that address to write to directly, and the Worker logs `contact.send_failed` (Workers Logs are turned on).

The form has a hidden field that catches most bots, and each IP address can send five messages a minute (`CONTACT_LIMITER`, rate limit namespace `2001`; the app's limiters use 1001 to 1004).

### Turnstile (optional)

To add Cloudflare's bot check to the form:

1. Create a Turnstile widget for the site's domain.
2. In the Worker's build settings, add the build variable `PUBLIC_TURNSTILE_SITE_KEY` with the site key, and deploy. The widget now shows on the form.
3. Then add the secret: `pnpm exec wrangler secret put TURNSTILE_SECRET_KEY`. From then on the Worker rejects messages that did not pass the check.

Do it in that order. A secret without the widget would turn every message away.

### Domain

Add the domain under the Worker's Settings, Domains & Routes, or uncomment `routes` in `wrangler.jsonc`. The domain has to be a zone in the same Cloudflare account. `SITE_URL` (a build variable, `https://membercove.com` by default) sets the canonical links, the sitemap and the share image address; change it if the site lives somewhere else.

## Where things are

| What | Where |
| --- | --- |
| Design tokens, type scale, buttons, tabs (UBI) | `src/styles/global.css` |
| Name, nav, footer links, contact address | `src/data/site.ts` |
| Home page questions | `src/data/faq.ts` |
| Pricing page content | `src/data/pricing.ts` |
| Pages | `src/pages/` |
| Sections and mockups | `src/components/`, `src/components/mockups/` |
| Page behaviour (menu, tabs, flip cards, animations) | `src/scripts/site.ts` |
| Contact form script | `src/scripts/contact-form.ts` |
| Contact form Worker | `src/worker/index.ts` (bindings), `src/worker/contact.ts` (logic, unit tested) |
| Security headers | `public/_headers`; the content security policy is in `astro.config.mjs` |

The sections follow UBI's: hero-1 (home hero), combo-1 (stats), combo-3 (console and portal), features-1 (flip cards), tabs-1, combo-4 (image and checklist), integrations-1, faq-1, cta-section-1, hero-2 (inner page heroes), pricing-2 and contact-3.

### Screenshots and mockups

The product screenshots in `src/assets/screens/` come from the MemberCove demo association (Bayside Practice Managers Association, all sample data), captured at 1440 by 900 for the admin console and 390 by 844 for the portal, both at high density. Astro resizes and compresses them at build time. The device frames, the upcoming events card, the Apple Wallet ticket (with its QR code) and the check-in card are drawn in HTML.

The share image (`public/og.png`) and the Apple touch icon are made by `node scripts/make-images.mjs`. Run it again after changing the logo, the headline or the hero screenshot.

### Fonts

Playfair Display is bundled. Satoshi loads from Fontshare's CDN, because its licence does not allow the font files in a public repository. The privacy notice mentions Fontshare for that reason.

## Before launch

- Set the pricing approach in `src/data/pricing.ts`. The page says MemberCove is quoted by membership size and that every feature is included; change it if that isn't how you sell it.
- Have the privacy notice (`src/pages/privacy.astro`) reviewed.
- Set up `hello@membercove.com` (see "Contact form email").
- Attach the domain.
