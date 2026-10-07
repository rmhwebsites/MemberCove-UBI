/**
 * Pricing page content. MemberCove is quoted for each association, so there is no price here yet.
 * To publish prices, set `price` (shown in place of "Quoted for your association") and `priceNote`.
 */
export const PRICING = {
  planName: "MemberCove",
  price: null as string | null,
  priceNote: "Priced by the size of your membership",
  cta: { label: "Get a quote", href: "/contact/" },
  included: [
    "The admin console for your staff",
    "A member portal with your association's name",
    "Dues, renewals and invoices",
    "Events, tickets and check-in",
    "Email, designs and automations",
    "CE credit tracking",
    "Forum, committees, jobs and resources",
    "Reports and CSV exports",
    "Website embeds, the JSON API and webhooks",
    "Your own database, with 30 days of restore points",
  ],
  steps: [
    { title: "Tell us about your association", text: "How many members you have, the memberships you offer and what you use today." },
    { title: "Get a quote", text: "We work out a price from the size of your membership and send it to you." },
    { title: "Move in", text: "We set up your portal and database, you import your members, and your staff are invited." },
  ],
  faq: [
    {
      q: "Who pays the card processing fees?",
      a: "Payments go into your association's own Stripe account, and Stripe charges its fees there, the same as if you used Stripe on its own.",
    },
    {
      q: "Can we see it before we decide?",
      a: "Yes. Book a demo and we'll walk you through MemberCove with a sample association's members, events and emails.",
    },
    {
      q: "Can we take our data with us if we leave?",
      a: "Yes. Members, registrations and invoices export to CSV at any time, and every report exports too.",
    },
  ],
};
