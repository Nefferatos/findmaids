import type { ComponentType, SVGProps } from "react";
import {
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  KeyRound,
  Mail,
  Megaphone,
  Settings,
  Sparkles,
  Star,
  UserPlus,
  Users,
} from "lucide-react";

/**
 * The classic portal keeps the grey navigation bar under the header on every
 * page (see the reference screenshot), so sub-pages opt in by default.
 */
export const SHOW_NAV_ON_SUBPAGES = true;

/** Placeholder inside descriptions that becomes a link to the public listing. */
export const LISTING_LINK_TOKEN = "{{listing}}";

export type AgencyIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type AgencyMenuItem = {
  id:
    | "profile"
    | "add-maids"
    | "manage-maids"
    | "password"
    | "contracts"
    | "enquiries"
    | "reviews"
    | "billing"
    | "advertising"
    | "analytics"
    | "ai-assistant"
    | "account-settings";
  label: string;
  navLabel: string;
  path: string;
  icon: AgencyIcon;
  description: string[];
  badge?: "NEW";
};

/** Left-hand menu on the home page (screenshot order). */
export const MENU_ITEMS: AgencyMenuItem[] = [
  {
    id: "profile",
    label: "Agency Profile",
    navLabel: "AGENCY PROFILE",
    path: "/agency/profile",
    icon: Building2,
    description: [
      "This option allows you to view and modify the current company information such as addresses, phone numbers, and contact names.",
      "Please keep your company information up to date so that visitors of your website always see your current phone numbers and mailing address. This information is used in all automatic email messages from this website, on the {{listing}}, and in all email messages from your visitors.",
    ],
  },
  {
    id: "add-maids",
    label: "Add Maids",
    navLabel: "ADD MAIDS",
    path: "/agency/maids/new",
    icon: UserPlus,
    description: [
      "Add a new maid to your listing. Fill in her details and photo, then choose whether she is shown to the public or kept hidden.",
    ],
  },
  {
    id: "manage-maids",
    label: "Edit/Delete Maids",
    navLabel: "EDIT/DELETE MAIDS",
    path: "/agency/maids",
    icon: Users,
    description: [
      "View all the maids in your agency. Edit their details, show or hide them from the public, or delete them.",
    ],
  },
  {
    id: "password",
    label: "Change Password",
    navLabel: "CHANGE PASSWORD",
    path: "/agency/change-password",
    icon: KeyRound,
    description: [
      "Change the password you use to log in to your agency account. Choose a strong password and keep it private.",
    ],
  },
  {
    id: "contracts",
    label: "Employment Contracts & Forms",
    navLabel: "EMPLOYMENT CONTRACTS & FORMS",
    path: "/agency/forms",
    icon: FileText,
    badge: "NEW",
    description: [
      "Download employment contracts and forms for your employers and maids.",
    ],
  },
];

/** Nav-only entries (not in the left menu). */
export const NAV_ONLY_ITEMS: AgencyMenuItem[] = [
  {
    id: "enquiries",
    label: "Enquiries",
    navLabel: "ENQUIRIES",
    path: "/agency/enquiries",
    icon: Mail,
    description: [
      "View the enquiries employers and visitors have sent to your agency.",
    ],
  },
];

export const MORE_ITEMS: AgencyMenuItem[] = [
  {
    id: "reviews",
    label: "Reviews",
    navLabel: "REVIEWS",
    path: "/agency/reviews",
    icon: Star,
    description: ["Reviews published on your agency profile and your replies."],
  },
  {
    id: "billing",
    label: "Billing & plan",
    navLabel: "BILLING & PLAN",
    path: "/agency/billing",
    icon: CreditCard,
    description: ["Your plan, renewal date, payments and invoices."],
  },
  {
    id: "advertising",
    label: "Advertising",
    navLabel: "ADVERTISING",
    path: "/agency/advertising",
    icon: Megaphone,
    description: ["Featured and homepage placements for your agency."],
  },
  {
    id: "analytics",
    label: "Analytics",
    navLabel: "ANALYTICS",
    path: "/agency/analytics",
    icon: BarChart3,
    description: ["Profile views, contact clicks and enquiry sources."],
  },
  {
    id: "ai-assistant",
    label: "AI assistant",
    navLabel: "AI ASSISTANT",
    path: "/agency/ai-assistant",
    icon: Sparkles,
    description: ["Reply tone, knowledge base and AI drafting settings."],
  },
  {
    id: "account-settings",
    label: "Account settings",
    navLabel: "ACCOUNT SETTINGS",
    path: "/agency/account-settings",
    icon: Settings,
    description: ["Notification preferences and data-deletion requests."],
  },
];

export const HOME_ITEM = {
  id: "home" as const,
  label: "Home",
  navLabel: "HOME",
  path: "/agency",
};

export const NAV_ITEMS = [
  HOME_ITEM,
  ...MENU_ITEMS.filter((item) => item.id !== "contracts").map((item) => ({
    id: item.id,
    label: item.label,
    navLabel: item.navLabel,
    path: item.path,
  })),
  ...NAV_ONLY_ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    navLabel: item.navLabel,
    path: item.path,
  })),
];

const ALL_ITEMS: AgencyMenuItem[] = [
  ...MENU_ITEMS,
  ...NAV_ONLY_ITEMS,
  ...MORE_ITEMS,
];

export function agencyMenuItem(id: AgencyMenuItem["id"]) {
  const item = ALL_ITEMS.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown agency menu item: ${id}`);
  return item;
}

/** Map for legacy /agency/dashboard/* redirects. */
export const AGENCY_PATH_BY_LEGACY_SECTION: Record<string, string> = {
  home: "/agency",
  overview: "/agency",
  profile: "/agency/profile",
  "add-maids": "/agency/maids/new",
  maids: "/agency/maids",
  "manage-maids": "/agency/maids",
  "maids/add": "/agency/maids/new",
  password: "/agency/change-password",
  "change-password": "/agency/change-password",
  contracts: "/agency/forms",
  forms: "/agency/forms",
  enquiries: "/agency/enquiries",
  leads: "/agency/enquiries",
  reviews: "/agency/reviews",
  billing: "/agency/billing",
  ads: "/agency/advertising",
  advertising: "/agency/advertising",
  analytics: "/agency/analytics",
  "ai-assistant": "/agency/ai-assistant",
  settings: "/agency/account-settings",
  "account-settings": "/agency/account-settings",
};
