import { describe, expect, it, vi } from "vitest";
import { buildContactEmail, encodeHeaderText, handleContact, parseContact, parseMailbox, rateKey, type ContactDeps } from "../../src/worker/contact";

const valid = {
  name: "Dana Whitfield",
  email: "Dana@BaysidePMA.example",
  association: "Bayside Practice Managers Association",
  members: "250 to 1,000",
  message: "We'd like to see renewals and events.\r\nThanks!",
};

function decodeWords(header: string): string {
  return header.replace(/=\?UTF-8\?B\?([^?]+)\?=\s?/g, (_, b64: string) => Buffer.from(b64, "base64").toString("utf8"));
}

function bodyOf(raw: string): string {
  const [, body] = raw.split("\r\n\r\n");
  return Buffer.from(body!.replace(/\r\n/g, ""), "base64").toString("utf8");
}

describe("parseContact", () => {
  it("accepts a complete enquiry and tidies it", () => {
    const result = parseContact({ ...valid, name: "  Dana   Whitfield ", website: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Dana Whitfield");
    expect(result.value.email).toBe("dana@baysidepma.example");
    expect(result.value.message).toBe("We'd like to see renewals and events.\nThanks!");
    expect(result.isBot).toBe(false);
  });

  it("names each missing or bad field", () => {
    const result = parseContact({ name: "", email: "not-an-email", association: "", members: "Lots" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["association", "email", "members", "name"]);
  });

  it("allows the member count and message to be left out", () => {
    const result = parseContact({ name: "A", email: "a@b.co", association: "C" });
    expect(result.ok).toBe(true);
  });

  it("rejects overlong fields", () => {
    expect(parseContact({ ...valid, name: "x".repeat(121) }).ok).toBe(false);
    expect(parseContact({ ...valid, message: "x".repeat(5001) }).ok).toBe(false);
    expect(parseContact({ ...valid, email: `${"x".repeat(250)}@b.co` }).ok).toBe(false);
  });

  it("flattens line breaks out of one-line fields", () => {
    const result = parseContact({ ...valid, name: "Eve\r\nBcc: victim@example.com" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe("Eve Bcc: victim@example.com");
  });

  it("refuses an email address carrying a header", () => {
    expect(parseContact({ ...valid, email: "a@b.co\r\nBcc: c@d.co" }).ok).toBe(false);
  });

  it("refuses addresses that aren't plain ASCII, which would go raw into Reply-To", () => {
    expect(parseContact({ ...valid, email: "zoë@example.com" }).ok).toBe(false);
    expect(parseContact({ ...valid, email: "dana@exämple.com" }).ok).toBe(false);
  });

  it("marks a filled honeypot as a bot", () => {
    const result = parseContact({ ...valid, website: "http://spam.example" });
    expect(result.ok && result.isBot).toBe(true);
  });

  it("ignores values that are not strings", () => {
    const result = parseContact({ name: ["x"], email: { a: 1 }, association: 5 });
    expect(result.ok).toBe(false);
  });
});

describe("encodeHeaderText", () => {
  it("leaves plain ASCII alone", () => {
    expect(encodeHeaderText("Website enquiry from BPMA")).toBe("Website enquiry from BPMA");
  });

  it("encodes other text in short words that decode back", () => {
    const text = "Association des gestionnaires de cliniques médicales du Québec et de l'Ontario";
    const encoded = encodeHeaderText(text);
    for (const word of encoded.split(" ")) expect(word.length).toBeLessThanOrEqual(75);
    expect(decodeWords(encoded)).toBe(text);
  });

  it("never lets a line break through", () => {
    expect(encodeHeaderText("a\r\nb")).toBe("a b");
  });
});

describe("parseMailbox", () => {
  it("splits a name and an address", () => {
    expect(parseMailbox("MemberCove website <no-reply@mail.membercove.com>")).toEqual({ name: "MemberCove website", address: "no-reply@mail.membercove.com" });
    expect(parseMailbox("hello@membercove.com")).toEqual({ address: "hello@membercove.com" });
  });
});

describe("buildContactEmail", () => {
  const parsed = parseContact(valid);
  if (!parsed.ok) throw new Error("fixture invalid");
  const message = buildContactEmail(parsed.value, {
    from: "MemberCove website <no-reply@mail.membercove.com>",
    to: "hello@membercove.com",
    date: new Date(Date.UTC(2026, 9, 7, 14, 5, 9)),
    id: "abc123",
  });

  it("addresses the message and sets Reply-To to the visitor", () => {
    expect(message.from).toBe("no-reply@mail.membercove.com");
    expect(message.to).toBe("hello@membercove.com");
    expect(message.raw).toContain('From: "MemberCove website" <no-reply@mail.membercove.com>\r\n');
    expect(message.raw).toContain("To: <hello@membercove.com>\r\n");
    expect(message.raw).toContain('Reply-To: "Dana Whitfield" <dana@baysidepma.example>\r\n');
    expect(message.raw).toContain("Subject: Website enquiry from Bayside Practice Managers Association\r\n");
    expect(message.raw).toContain("Date: Wed, 07 Oct 2026 14:05:09 +0000\r\n");
    expect(message.raw).toContain("Message-ID: <abc123@mail.membercove.com>\r\n");
  });

  it("carries every field in the body", () => {
    const body = bodyOf(message.raw);
    expect(body).toContain("Name: Dana Whitfield");
    expect(body).toContain("Email: dana@baysidepma.example");
    expect(body).toContain("Members: 250 to 1,000");
    expect(body).toContain("We'd like to see renewals and events.\nThanks!");
  });

  it("wraps the encoded body at 76 characters", () => {
    const [, body] = message.raw.split("\r\n\r\n");
    for (const line of body!.trimEnd().split("\r\n")) expect(line.length).toBeLessThanOrEqual(76);
  });

  it("escapes quotes in a display name and encodes non-ASCII ones", () => {
    const quoted = buildContactEmail({ ...parsed.value, name: 'Dana "DW" Whitfield' }, { from: "a@b.co", to: "c@d.co", date: new Date(0), id: "x" });
    expect(quoted.raw).toContain('Reply-To: "Dana \\"DW\\" Whitfield" <dana@baysidepma.example>');
    const accented = buildContactEmail({ ...parsed.value, name: "Zoë Brontë" }, { from: "a@b.co", to: "c@d.co", date: new Date(0), id: "x" });
    const replyTo = accented.raw.split("\r\n").find((line) => line.startsWith("Reply-To: "))!;
    expect(decodeWords(replyTo)).toContain("Zoë Brontë");
  });

  it("has no header lines beyond the ones it sets", () => {
    const evil = buildContactEmail({ ...parsed.value, association: "X\r\nBcc: victim@example.com" }, { from: "a@b.co", to: "c@d.co", date: new Date(0), id: "x" });
    const headers = evil.raw.split("\r\n\r\n")[0]!.split("\r\n");
    expect(headers.some((line) => line.startsWith("Bcc"))).toBe(false);
  });
});

describe("rateKey", () => {
  it("counts IPv4 addresses one by one", () => {
    expect(rateKey("203.0.113.9")).toBe("203.0.113.9");
  });

  it("counts IPv6 addresses by their /64", () => {
    const a = rateKey("2001:db8:1234:5678:1:2:3:4");
    expect(a).toBe("2001:db8:1234:5678::/64");
    expect(rateKey("2001:db8:1234:5678:ffff::1")).toBe(a);
    expect(rateKey("2001:DB8:1234:5678::abcd")).toBe(a);
    expect(rateKey("2001:db8:1234:5679::1")).not.toBe(a);
  });

  it("handles short forms, zones and IPv4-mapped addresses", () => {
    expect(rateKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(rateKey("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(rateKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(rateKey(null)).toBe("unknown");
  });
});

describe("handleContact", () => {
  const url = "https://membercove.com/api/contact";

  function post(fields: Record<string, string>, init: { json?: boolean; headers?: Record<string, string> } = {}): Request {
    const headers: Record<string, string> = { origin: "https://membercove.com", "cf-connecting-ip": "203.0.113.9", ...init.headers };
    if (init.json) {
      headers.accept = "application/json";
      headers["content-type"] = "application/json";
      return new Request(url, { method: "POST", headers, body: JSON.stringify(fields) });
    }
    return new Request(url, { method: "POST", headers, body: new URLSearchParams(fields) });
  }

  function deps(extra: Partial<ContactDeps> = {}) {
    const send = vi.fn(async (_message: { from: string; to: string; raw: string }) => {});
    return {
      send,
      deps: {
        to: "hello@membercove.com",
        from: "MemberCove website <no-reply@mail.membercove.com>",
        fallbackEmail: "hello@membercove.com",
        send,
        now: () => new Date(Date.UTC(2026, 9, 7)),
        newId: () => "id-1",
        ...extra,
      } satisfies ContactDeps,
    };
  }

  it("sends a valid enquiry and answers the script with JSON", async () => {
    const { send, deps: d } = deps();
    const res = await handleContact(post(valid, { json: true }), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]![0].to).toBe("hello@membercove.com");
    expect(send.mock.calls[0]![0].from).toBe("no-reply@mail.membercove.com");
  });

  it("redirects a plain form post to the thank-you page", async () => {
    const { deps: d } = deps();
    const res = await handleContact(post(valid), d);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://membercove.com/contact/thanks/");
  });

  it("only takes POST", async () => {
    const { deps: d } = deps();
    const res = await handleContact(new Request(url), d);
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });

  it("refuses posts from other sites", async () => {
    const { send, deps: d } = deps();
    const res = await handleContact(post(valid, { json: true, headers: { origin: "https://evil.example" } }), d);
    expect(res.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses an oversized body", async () => {
    const { deps: d } = deps();
    const res = await handleContact(post(valid, { json: true, headers: { "content-length": "999999" } }), d);
    expect(res.status).toBe(413);
  });

  it("refuses an oversized body that doesn't declare its length", async () => {
    const { send, deps: d } = deps();
    const big = new TextEncoder().encode(`name=A&email=a%40b.co&association=C&message=${"x".repeat(200_000)}`);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < big.length; i += 16_384) controller.enqueue(big.subarray(i, i + 16_384));
        controller.close();
      },
    });
    const request = new Request(url, {
      method: "POST",
      headers: { origin: "https://membercove.com", "content-type": "application/x-www-form-urlencoded" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(request.headers.get("content-length")).toBeNull();
    const res = await handleContact(request, d);
    expect(res.status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });

  it("reads multipart form posts", async () => {
    const { send, deps: d } = deps();
    const form = new FormData();
    for (const [key, value] of Object.entries(valid)) form.append(key, value);
    const res = await handleContact(new Request(url, { method: "POST", headers: { origin: "https://membercove.com", accept: "application/json" }, body: form }), d);
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
  });

  it("counts IPv6 visitors by their /64 for the rate limit", async () => {
    const limit = vi.fn(async () => ({ success: true }));
    const { deps: d } = deps({ limiter: { limit } });
    await handleContact(post(valid, { json: true, headers: { "cf-connecting-ip": "2001:db8:1:2:aaaa::9" } }), d);
    expect(limit).toHaveBeenCalledWith({ key: "2001:db8:1:2::/64" });
  });

  it("returns field errors as JSON", async () => {
    const { send, deps: d } = deps();
    const res = await handleContact(post({ ...valid, email: "nope" }, { json: true }), d);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { errors: Record<string, string> };
    expect(data.errors.email).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  it("explains a problem in HTML to a plain form post", async () => {
    const { deps: d } = deps();
    const res = await handleContact(post({ ...valid, name: "" }), d);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Please enter your name.");
  });

  it("pretends to accept a bot's message and sends nothing", async () => {
    const { send, deps: d } = deps();
    const res = await handleContact(post({ ...valid, website: "spam" }, { json: true }), d);
    expect(res.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it("rate limits by IP address", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const { send, deps: d } = deps({ limiter: { limit } });
    const res = await handleContact(post(valid, { json: true }), d);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(limit).toHaveBeenCalledWith({ key: "203.0.113.9" });
    expect(send).not.toHaveBeenCalled();
  });

  it("requires a passing Turnstile check when a secret is set", async () => {
    const verify = vi.fn(async () => new Response(JSON.stringify({ success: false })));
    const { send, deps: d } = deps({ turnstileSecret: "secret", fetch: verify as unknown as typeof fetch });
    const missing = await handleContact(post(valid, { json: true }), d);
    expect(missing.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
    const failed = await handleContact(post({ ...valid, "cf-turnstile-response": "token" }, { json: true }), d);
    expect(failed.status).toBe(400);
    expect(verify).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends once Turnstile passes", async () => {
    const verify = vi.fn(async () => new Response(JSON.stringify({ success: true })));
    const { send, deps: d } = deps({ turnstileSecret: "secret", fetch: verify as unknown as typeof fetch });
    const res = await handleContact(post({ ...valid, "cf-turnstile-response": "token" }, { json: true }), d);
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
  });

  it("says so when email is not set up", async () => {
    const { deps: d } = deps({ send: undefined });
    const res = await handleContact(post(valid, { json: true }), d);
    expect(res.status).toBe(503);
    const data = (await res.json()) as { message: string };
    expect(data.message).toContain("hello@membercove.com");
  });

  it("reports a failed send with the address to write to", async () => {
    const { deps: d } = deps({ send: vi.fn(async () => { throw new Error("binding refused"); }) });
    const res = await handleContact(post(valid, { json: true }), d);
    expect(res.status).toBe(502);
    const data = (await res.json()) as { message: string };
    expect(data.message).toContain("hello@membercove.com");
  });
});
