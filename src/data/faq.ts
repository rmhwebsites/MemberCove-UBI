/** The home page questions, grouped under the FAQ tabs. Every answer describes the product as built. */
export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqGroup {
  id: string;
  label: string;
  items: FaqItem[];
}

export const HOME_FAQ: FaqGroup[] = [
  {
    id: "start",
    label: "Getting started",
    items: [
      {
        q: "What do we need to get started?",
        a: "A list of your members (an export from your current system or a spreadsheet is fine), your membership types and dues, and a Stripe account for payments. We set up your association's portal and database, then you invite your staff.",
      },
      {
        q: "Can we bring our members over from another system?",
        a: "Yes. Export your members to a CSV file and the import wizard shows how it will read each column before anything is saved. Members already on file are matched by email address and updated, and join dates carry over.",
      },
      {
        q: "Does MemberCove replace our website?",
        a: "No, your website stays where it is. The member portal has a web address of its own, and your site can show your events and join form through embeds or the JSON API.",
      },
      {
        q: "How do members sign in?",
        a: "With a one-time link we email them, a passkey or a password. They can also add the portal to their phone's home screen and open it like an app.",
      },
    ],
  },
  {
    id: "payments",
    label: "Members and payments",
    items: [
      {
        q: "How do members pay their dues?",
        a: "By card or ACH bank transfer through Stripe Checkout, paid into your association's own Stripe account. Staff can record checks and cash by hand, and members can save a card for auto-renew.",
      },
      {
        q: "Can renewals run on their own?",
        a: "Yes. Reminders go out on a schedule before each membership expires, auto-renew charges a saved card, and a grace period gives late payers time before a membership lapses. You can also set up a win-back series for members who lapse.",
      },
      {
        q: "Can events have member and non-member prices?",
        a: "Yes. Each event has its own ticket types, early bird pricing and promo codes. Members are recognized when they register, so they get member pricing without a code.",
      },
      {
        q: "Do you track CE credit?",
        a: "Yes. Credits are added to a member's record when they check in at an event. Members can log outside courses for staff to verify, and print their own certificates.",
      },
    ],
  },
  {
    id: "data",
    label: "Data and security",
    items: [
      {
        q: "Is our data kept apart from other associations?",
        a: "Yes. Each association gets its own copy of MemberCove on Cloudflare, with its own database and file storage. No data is shared between associations.",
      },
      {
        q: "Do you store card numbers?",
        a: "No. Members enter card details on Stripe's checkout page, and MemberCove keeps only the record of the payment.",
      },
      {
        q: "What if something is deleted by mistake?",
        a: "The database can be restored to any minute in the last 30 days.",
      },
      {
        q: "Can we get our data out?",
        a: "Whenever you like. Members, registrations and invoices export to CSV from settings, and every report exports too.",
      },
      {
        q: "Who can see what?",
        a: "Each staff member has one of six roles: owner, admin, events, finance, communications or read-only. Owners and admins need a second step at sign-in, and the audit log records who changed what.",
      },
    ],
  },
];
