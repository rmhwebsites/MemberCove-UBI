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
