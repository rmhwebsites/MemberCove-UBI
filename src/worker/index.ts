/**
 * The Worker in front of the static site. Workers Static Assets serves the pages; only /api/*
 * reaches this code first (run_worker_first in wrangler.jsonc). Anything else that arrives here is
 * handed back to the assets, which answer with the page or the 404 page.
 */
import { EmailMessage } from "cloudflare:email";
import { handleContact, type RateLimiter } from "./contact";

interface WorkerEnv {
  ASSETS: Fetcher;
  /** Cloudflare Email Sending; the sender must be in allowed_sender_addresses. */
  EMAIL?: SendEmail;
  CONTACT_LIMITER?: RateLimiter;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
  /** Optional. When set, the contact form must pass a Turnstile check. */
  TURNSTILE_SECRET_KEY?: string;
}

const FALLBACK_EMAIL = "hello@membercove.com";

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/contact" || pathname === "/api/contact/") {
      const email = env.EMAIL;
      return handleContact(request, {
        to: env.CONTACT_TO,
        from: env.CONTACT_FROM,
        fallbackEmail: env.CONTACT_TO || FALLBACK_EMAIL,
        limiter: env.CONTACT_LIMITER,
        turnstileSecret: env.TURNSTILE_SECRET_KEY || undefined,
        send: email
          ? async ({ from, to, raw }) => {
              await email.send(new EmailMessage(from, to, raw));
            }
          : undefined,
      });
    }

    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ ok: false, message: "Not found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
      });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;
