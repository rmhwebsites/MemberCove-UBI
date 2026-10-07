/**
 * The contact form endpoint (POST /api/contact), written against small interfaces so the tests can
 * run it in Node with fakes. index.ts wires in the real bindings: the send_email binding, the rate
 * limiter and fetch for Turnstile.
 *
 * Two kinds of caller:
 *   - the page's script, which posts with `Accept: application/json` and gets JSON back;
 *   - a plain form post (no JavaScript), which gets a redirect to the thank-you page or a short
 *     HTML page explaining what went wrong.
 */

export const MEMBER_RANGES = ["Under 250", "250 to 1,000", "1,000 to 5,000", "More than 5,000", "Not sure yet"] as const;

export const LIMITS = { name: 120, email: 254, association: 160, message: 5000, body: 32 * 1024 } as const;

export interface ContactInput {
  name: string;
  email: string;
  association: string;
  members: string;
  message: string;
}

export type FieldErrors = Partial<Record<keyof ContactInput, string>>;

export type ParseResult =
  | { ok: true; value: ContactInput; isBot: boolean; turnstileToken: string }
  | { ok: false; errors: FieldErrors };

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface ContactDeps {
  /** Where enquiries go (CONTACT_TO). */
  to?: string;
  /** The sender, "Name <address>" (CONTACT_FROM). Must be an address the send_email binding allows. */
  from?: string;
  /** Shown to visitors when sending fails, so they can write directly. */
  fallbackEmail: string;
  limiter?: RateLimiter;
  /** When set, a Turnstile token is required and checked with Cloudflare. */
  turnstileSecret?: string;
  /** Sends a raw MIME message; undefined when the EMAIL binding is missing. */
  send?: (message: { from: string; to: string; raw: string }) => Promise<void>;
  fetch?: typeof fetch;
  now?: () => Date;
  newId?: () => string;
}

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
/** Printable ASCII only: the address goes into the Reply-To header as it is. */
const ASCII = /^[\x21-\x7e]+$/;

/** One line of text: trimmed, inner whitespace (including any line breaks) collapsed to one space. */
function singleLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() : "";
}

/** Free text: Unix line breaks, no control characters other than newline and tab. */
function multiLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim();
}

export function parseContact(fields: Record<string, unknown>): ParseResult {
  const value: ContactInput = {
    name: singleLine(fields.name),
    email: singleLine(fields.email).toLowerCase(),
    association: singleLine(fields.association),
    members: singleLine(fields.members),
    message: multiLine(fields.message),
  };
  const errors: FieldErrors = {};

  if (!value.name) errors.name = "Please enter your name.";
  else if (value.name.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`;

  if (!value.email || value.email.length > LIMITS.email || !ASCII.test(value.email) || !EMAIL_PATTERN.test(value.email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!value.association) errors.association = "Please tell us your association's name.";
  else if (value.association.length > LIMITS.association) {
    errors.association = `Please keep the association name under ${LIMITS.association} characters.`;
  }

  if (value.members && !(MEMBER_RANGES as readonly string[]).includes(value.members)) {
    errors.members = "Please choose one of the options.";
  }

  if (value.message.length > LIMITS.message) errors.message = "Please keep your message under 5,000 characters.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value,
    // The honeypot field is hidden from people; anything in it came from a bot.
    isBot: singleLine(fields.website) !== "",
    turnstileToken: singleLine(fields["cf-turnstile-response"]),
  };
}

// ---- The email ----------------------------------------------------------------------------------

const encoder = new TextEncoder();

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Header text: no line breaks ever, and RFC 2047 encoded words when it is not plain ASCII. */
export function encodeHeaderText(text: string): string {
  const clean = text.replace(/[\r\n]+/g, " ");
  if (/^[\x20-\x7e]*$/.test(clean)) return clean;
  // Encoded words stay under 75 characters: at most 45 bytes each, split between characters.
  const words: string[] = [];
  let chunk = "";
  for (const char of clean) {
    if (encoder.encode(chunk + char).length > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  return words.map((word) => `=?UTF-8?B?${base64(encoder.encode(word))}?=`).join(" ");
}

/** "Name <address>" or a bare address, split up. */
export function parseMailbox(value: string): { name?: string; address: string } {
  const match = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(value);
  if (match) return { name: match[1]?.trim() || undefined, address: match[2]!.trim() };
  return { address: value.trim() };
}

function formatMailbox(name: string | undefined, address: string): string {
  if (!name) return `<${address}>`;
  const encoded = encodeHeaderText(name);
  // An encoded word cannot sit inside quotes; plain text is quoted with " and \ escaped.
  const display = encoded === name ? `"${name.replace(/["\\]/g, "\\$&")}"` : encoded;
  return `${display} <${address}>`;
}

function rfc5322Date(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`;
}

export function contactSubject(input: ContactInput): string {
  return `Website enquiry from ${input.association}`;
}

export function contactText(input: ContactInput, receivedAt: Date): string {
  return [
    "New message from the contact form on the MemberCove website.",
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Association: ${input.association}`,
    `Members: ${input.members || "Not given"}`,
    "",
    "Message:",
    input.message || "(No message)",
    "",
    `Received ${receivedAt.toUTCString()}. Reply to this email to answer ${input.name}.`,
  ].join("\n");
}

/** A plain-text MIME message with Reply-To set to the visitor. */
export function buildContactEmail(
  input: ContactInput,
  options: { from: string; to: string; date: Date; id: string },
): { raw: string; from: string; to: string } {
  const from = parseMailbox(options.from);
  const to = parseMailbox(options.to);
  const domain = from.address.split("@")[1] ?? "localhost";
  const body = base64(encoder.encode(contactText(input, options.date)))
    .match(/.{1,76}/g)!
    .join("\r\n");
  const headers = [
    `From: ${formatMailbox(from.name, from.address)}`,
    `To: ${formatMailbox(to.name, to.address)}`,
    `Reply-To: ${formatMailbox(input.name, input.email)}`,
    `Subject: ${encodeHeaderText(contactSubject(input))}`,
    `Date: ${rfc5322Date(options.date)}`,
    `Message-ID: <${options.id}@${domain}>`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
  ];
  return { raw: `${headers.join("\r\n")}\r\n\r\n${body}\r\n`, from: from.address, to: to.address };
}

// ---- The request handler ------------------------------------------------------------------------

/**
 * What the rate limit counts a visitor by: an IPv4 address as it is, an IPv6 address by its /64,
 * since one home or server is usually given a whole /64 and could otherwise rotate addresses.
 * (The same rule as ipRateKey in the MemberCove app.)
 */
export function rateKey(ip: string | null): string {
  if (!ip) return "unknown";
  const raw = ip.trim().split("%")[0]!.toLowerCase();
  if (!raw.includes(":")) return raw;
  if (raw.includes(".")) return raw.slice(raw.lastIndexOf(":") + 1); // IPv4-mapped, ::ffff:203.0.113.9
  const [head, tail] = raw.includes("::") ? raw.split("::", 2) : [raw, undefined];
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = tail === undefined ? h : [...h, ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  if (groups.length < 4) return raw;
  return `${groups
    .slice(0, 4)
    .map((g) => (parseInt(g, 16) || 0).toString(16))
    .join(":")}::/64`;
}

const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function verifyTurnstile(deps: ContactDeps, token: string, ip: string | null): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.append("secret", deps.turnstileSecret ?? "");
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  try {
    const res = await (deps.fetch ?? fetch)(TURNSTILE_VERIFY, { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

function wantsJson(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("application/json") || (request.headers.get("content-type") ?? "").includes("application/json");
}

const BASE_HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

function json(data: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...BASE_HEADERS, "content-type": "application/json; charset=utf-8", ...extra } });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** The answer to a form post made without JavaScript, when something went wrong. */
function htmlProblem(message: string, status: number, fallbackEmail: string): Response {
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Message not sent | MemberCove</title><style>body{margin:0;font:20px/1.4 system-ui,sans-serif;color:#282c32;background:#fffcf2}main{max-width:640px;margin:15vh auto;padding:0 24px}h1{font:400 44px/1.2 Georgia,serif;margin:0 0 16px}a{color:#282c32}</style></head><body><main><h1>Your message wasn't sent</h1><p>${escapeHtml(message)}</p><p><a href="/contact/">Back to the contact form</a> or email <a href="mailto:${escapeHtml(fallbackEmail)}">${escapeHtml(fallbackEmail)}</a>.</p></main></body></html>`;
  return new Response(page, { status, headers: { ...BASE_HEADERS, "content-type": "text/html; charset=utf-8" } });
}

/** The request body, or null once it passes `limit` bytes, whatever Content-Length said. */
async function readCapped(request: Request, limit: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** The form's fields from a JSON, URL-encoded or multipart body; null when it can't be read. */
async function parseFields(body: Uint8Array, type: string): Promise<Record<string, unknown> | null> {
  try {
    if (type.includes("application/json")) {
      const data: unknown = JSON.parse(new TextDecoder().decode(body));
      return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
    }
    let form: URLSearchParams | FormData;
    if (type.includes("application/x-www-form-urlencoded")) form = new URLSearchParams(new TextDecoder().decode(body));
    else if (type.includes("multipart/form-data")) form = await new Response(body, { headers: { "content-type": type } }).formData();
    else return null;
    const fields: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) if (typeof value === "string") fields[key] = value;
    return fields;
  } catch {
    return null;
  }
}

export async function handleContact(request: Request, deps: ContactDeps): Promise<Response> {
  const asJson = wantsJson(request);
  const problem = (message: string, status: number, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
    asJson ? json({ ok: false, message, ...extra }, status, headers) : htmlProblem(message, status, deps.fallbackEmail);

  if (request.method !== "POST") {
    return json({ ok: false, message: "Send the form with POST." }, 405, { allow: "POST" });
  }

  // Browsers say where a form post came from; refuse posts from other sites' pages.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return problem("This form only accepts messages sent from the MemberCove website.", 403);

  // Refuse early when the size is declared; readCapped also stops a body that doesn't declare it.
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > LIMITS.body) return problem("That message is too long to send.", 413);

  const ip = request.headers.get("cf-connecting-ip");
  if (deps.limiter) {
    const { success } = await deps.limiter.limit({ key: rateKey(ip) });
    if (!success) return problem("Too many messages have come from your connection. Please wait a minute and try again.", 429, {}, { "retry-after": "60" });
  }

  const body = await readCapped(request, LIMITS.body);
  if (!body) return problem("That message is too long to send.", 413);
  const fields = await parseFields(body, request.headers.get("content-type") ?? "");
  if (!fields) return problem("We couldn't read the form. Please try again.", 400);

  const parsed = parseContact(fields);
  if (!parsed.ok) {
    const first = Object.values(parsed.errors)[0] ?? "Please check the form.";
    return problem(first, 400, { errors: parsed.errors });
  }

  // A bot that filled the honeypot gets the same answer as a person, and nothing is sent.
  if (parsed.isBot) return asJson ? json({ ok: true }, 200) : Response.redirect(new URL("/contact/thanks/", request.url).href, 303);

  if (deps.turnstileSecret && !(await verifyTurnstile(deps, parsed.turnstileToken, ip))) {
    return problem("Please complete the check above the Send button and try again.", 400, { errors: { turnstile: "Please complete the check." } });
  }

  if (!deps.send || !deps.to || !deps.from) {
    console.error(JSON.stringify({ event: "contact.not_configured", hasBinding: Boolean(deps.send), hasTo: Boolean(deps.to), hasFrom: Boolean(deps.from) }));
    return problem(`The contact form isn't working right now. Please email us at ${deps.fallbackEmail}.`, 503);
  }

  const date = (deps.now ?? (() => new Date()))();
  const id = (deps.newId ?? (() => crypto.randomUUID()))();
  const message = buildContactEmail(parsed.value, { from: deps.from, to: deps.to, date, id });
  try {
    await deps.send(message);
  } catch (err) {
    console.error(JSON.stringify({ event: "contact.send_failed", id, error: err instanceof Error ? err.message : String(err) }));
    return problem(`Your message didn't go through. Please email us at ${deps.fallbackEmail}.`, 502);
  }

  console.log(JSON.stringify({ event: "contact.sent", id }));
  return asJson ? json({ ok: true }, 200) : Response.redirect(new URL("/contact/thanks/", request.url).href, 303);
}
