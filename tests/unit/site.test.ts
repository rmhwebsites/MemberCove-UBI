import { describe, expect, it } from "vitest";
import { demoUrlFrom } from "../../src/data/site";

describe("the live demo link (PUBLIC_DEMO_URL)", () => {
  it("takes a plain https address and keeps only its origin", () => {
    expect(demoUrlFrom("https://demo.membercove.com")).toBe("https://demo.membercove.com");
    expect(demoUrlFrom("  https://demo.membercove.com/  ")).toBe("https://demo.membercove.com");
    expect(demoUrlFrom("https://demo.membercove.com/login?x=1")).toBe("https://demo.membercove.com");
  });

  it("shows no link without a usable address", () => {
    for (const raw of [undefined, "", "   ", "demo.membercove.com", "http://demo.membercove.com", "javascript:alert(1)", "https://user:pass@demo.membercove.com"]) expect(demoUrlFrom(raw)).toBeNull();
  });
});
