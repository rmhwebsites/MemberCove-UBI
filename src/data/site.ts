/**
 * Site-wide settings. The contact address shows in the footer and on the contact page, and the
 * contact form's fallback message points people to it when sending fails.
 */
export const SITE = {
  name: "MemberCove",
  tagline: "Membership software for practice management associations",
  description:
    "Members, dues, events and email for practice management associations, with a member portal that carries your association's name. Each association gets its own database.",
  email: "hello@membercove.com",
  year: 2026,
};

export interface NavLink {
  label: string;
  href: string;
}

export const NAV: NavLink[] = [
  { label: "Features", href: "/features/" },
  { label: "Pricing", href: "/pricing/" },
  { label: "Security", href: "/security/" },
  { label: "About", href: "/about/" },
];

export const CTA: NavLink = { label: "Book a demo", href: "/contact/" };

/**
 * The public demo's address from the PUBLIC_DEMO_URL build variable, as an https origin, or null
 * when it is unset or not a plain https address. The "Try the live demo" links only show when it
 * is set, so the site never links to a demo that is not running.
 */
export function demoUrlFrom(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const DEMO_URL = demoUrlFrom(import.meta.env.PUBLIC_DEMO_URL as string | undefined);

export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features/" },
      { label: "Pricing", href: "/pricing/" },
      { label: "Security", href: "/security/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about/" },
      { label: "Contact", href: "/contact/" },
    ],
  },
  {
    title: "Legal",
    links: [{ label: "Privacy", href: "/privacy/" }],
  },
];
