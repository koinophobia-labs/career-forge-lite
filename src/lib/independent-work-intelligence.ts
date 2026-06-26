import type { RoleFamily } from "@/types/career";
import type { CareerTarget } from "@/lib/career-targets";

export type IndependentWorkCategory =
  | "Gig / Delivery"
  | "Creator / Media"
  | "Service / Local Business"
  | "Online Commerce"
  | "Volunteer / Community";

export const independentWorkTypes = [
  "Freelance",
  "Self-Employed",
  "Contract",
  "Gig Work",
  "Creator Work",
  "Side Business",
  "Volunteer",
  "Family Business",
  "Other"
];

export const independentWorkArsenals: Record<IndependentWorkCategory, {
  responsibilities: string[];
  skills: string[];
  workflows: string[];
  measurableActivities: string[];
  domainLanguage: string[];
}> = {
  "Gig / Delivery": {
    responsibilities: ["Route planning", "Customer communication", "Order accuracy", "App-based workflow", "Payment handling", "Issue resolution"],
    skills: ["Time Management", "Customer Communication", "Independent Scheduling", "Safety Awareness", "High-Volume Service"],
    workflows: ["Delivery request intake", "Route optimization", "Customer handoff", "Issue escalation", "Payment or order confirmation"],
    measurableActivities: ["Orders completed", "Customers served", "Miles or routes covered", "Hours per week", "Ratings or reviews"],
    domainLanguage: ["app-based service", "route efficiency", "safe service delivery", "independent scheduling"]
  },
  "Creator / Media": {
    responsibilities: ["Content planning", "Audience engagement", "Video editing", "Social media publishing", "Analytics review", "Brand communication"],
    skills: ["Content Production", "Social Media Management", "Community Engagement", "Creative Workflow", "Performance Review"],
    workflows: ["Content calendar planning", "Script or concept drafting", "Editing workflow", "Publishing schedule", "Analytics review"],
    measurableActivities: ["Content posted", "Followers or community size", "Campaigns supported", "Views or engagement", "Projects completed"],
    domainLanguage: ["digital content", "audience engagement", "production workflow", "creator operations"]
  },
  "Service / Local Business": {
    responsibilities: ["Client scheduling", "Customer consultation", "Service delivery", "Appointment management", "Payment processing", "Inventory or supplies"],
    skills: ["Client Relations", "Service Delivery", "Scheduling", "Customer Consultation", "Conflict Resolution"],
    workflows: ["Client intake", "Appointment scheduling", "Service preparation", "Payment collection", "Follow-up communication"],
    measurableActivities: ["Clients supported", "Bookings managed", "Repeat customers", "Services completed", "Hours per week"],
    domainLanguage: ["client-facing service", "appointment-based workflow", "local service operations", "customer retention"]
  },
  "Online Commerce": {
    responsibilities: ["Product listings", "Order fulfillment", "Customer messages", "Inventory tracking", "Pricing", "Shipping"],
    skills: ["Order Fulfillment", "Customer Communication", "Inventory Tracking", "Platform Management", "Sales Tracking"],
    workflows: ["Listing creation", "Customer message response", "Packing and shipping", "Inventory updates", "Dispute resolution"],
    measurableActivities: ["Orders fulfilled", "Listings managed", "Customers supported", "Revenue handled", "Reviews or ratings"],
    domainLanguage: ["independent e-commerce", "platform management", "shipping workflow", "customer messages"]
  },
  "Volunteer / Community": {
    responsibilities: ["Event coordination", "Stakeholder communication", "Scheduling", "Outreach", "Mentoring", "Documentation"],
    skills: ["Community Engagement", "Leadership", "Team Coordination", "Public Speaking", "Problem Solving"],
    workflows: ["Volunteer coordination", "Event planning", "Outreach tracking", "Meeting support", "Public communication"],
    measurableActivities: ["Events supported", "Volunteers coordinated", "Community members reached", "Meetings organized", "Hours served"],
    domainLanguage: ["community support", "volunteer coordination", "public-facing communication", "event operations"]
  }
};

export const independentWorkRoles: Array<CareerTarget & { category: IndependentWorkCategory; aliases?: string[] }> = [
  ...["Uber Driver", "Lyft Driver", "DoorDash Courier", "Uber Eats Courier", "Instacart Shopper", "Amazon Flex Driver", "Delivery Driver", "Rideshare Driver", "Courier", "Personal Shopper"].map((title) => ({ title, roleFamily: "Operations" as RoleFamily, category: "Gig / Delivery" as IndependentWorkCategory })),
  ...["Content Creator", "TikTok Creator", "YouTube Creator", "Twitch Streamer", "Podcast Host", "Social Media Manager", "Video Editor", "Photographer", "Videographer", "Music Producer", "DJ", "Graphic Designer"].map((title) => ({ title, roleFamily: "Project Coordination" as RoleFamily, category: "Creator / Media" as IndependentWorkCategory })),
  ...["Barber", "Hair Stylist", "Nail Technician", "Tattoo Artist", "Personal Trainer", "Fitness Coach", "Dog Walker", "Pet Sitter", "House Cleaner", "Landscaper", "Handyman", "Event Staff", "Bartender", "Private Chef", "Tutor", "Childcare Provider"].map((title) => ({ title, roleFamily: "Customer Success" as RoleFamily, category: "Service / Local Business" as IndependentWorkCategory })),
  ...["Etsy Seller", "eBay Reseller", "Shopify Store Owner", "Depop Seller", "Poshmark Seller", "Online Reseller", "Digital Product Seller", "Virtual Assistant", "Freelance Writer", "Copywriter", "Consultant"].map((title) => ({ title, roleFamily: "Business" as RoleFamily, category: "Online Commerce" as IndependentWorkCategory })),
  ...["Volunteer Coordinator", "Community Organizer", "Church Volunteer", "Youth Coach", "Mentor", "Event Organizer", "Club Leader"].map((title) => ({ title, roleFamily: "Project Coordination" as RoleFamily, category: "Volunteer / Community" as IndependentWorkCategory }))
];

export function findIndependentWorkRole(title: string) {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;
  return independentWorkRoles.find((role) => role.title.toLowerCase() === normalized || role.aliases?.some((alias) => alias.toLowerCase() === normalized)) ?? null;
}

export function inferIndependentWorkCategory(value: string): IndependentWorkCategory | null {
  const text = value.toLowerCase();
  if (/uber|lyft|doordash|door dash|ubereats|uber eats|instacart|courier|delivery|rideshare|driver|amazon flex|shopper/.test(text)) return "Gig / Delivery";
  if (/creator|tiktok|youtube|twitch|podcast|video|photo|media|content|stream|dj|music|graphic|design/.test(text)) return "Creator / Media";
  if (/barber|hair|nail|tattoo|trainer|fitness|dog|pet|clean|landscap|handyman|bartender|chef|tutor|childcare|client|appointment/.test(text)) return "Service / Local Business";
  if (/etsy|ebay|shopify|depop|poshmark|reseller|commerce|store|seller|product|copywriter|consultant|virtual assistant/.test(text)) return "Online Commerce";
  if (/volunteer|community|church|coach|mentor|event organizer|club|nonprofit/.test(text)) return "Volunteer / Community";
  return null;
}

export function inferIndependentWorkRoleTitle(value: string) {
  const text = value.toLowerCase();
  const role = independentWorkRoles.find((item) => text.includes(item.title.toLowerCase()));
  if (role) return role.title;
  if (/doordash|door dash/.test(text)) return "DoorDash Courier";
  if (/uber eats|ubereats/.test(text)) return "Uber Eats Courier";
  if (/uber/.test(text) && /drive|driver|rideshare/.test(text)) return "Uber Driver";
  if (/lyft/.test(text)) return "Lyft Driver";
  if (/instacart/.test(text)) return "Instacart Shopper";
  if (/depop/.test(text)) return "Depop Seller";
  if (/poshmark/.test(text)) return "Poshmark Seller";
  if (/etsy/.test(text)) return "Etsy Seller";
  if (/ebay/.test(text)) return "eBay Reseller";
  if (/shopify/.test(text)) return "Shopify Store Owner";
  if (/cut hair|barber/.test(text)) return "Barber";
  if (/tattoo/.test(text)) return "Tattoo Artist";
  if (/tiktok|tik tok/.test(text)) return "TikTok Creator";
  if (/youtube/.test(text)) return "YouTube Creator";
  if (/twitch/.test(text)) return "Twitch Streamer";
  if (/podcast/.test(text)) return "Podcast Host";
  if (/volunteer/.test(text) && /coordinat/.test(text)) return "Volunteer Coordinator";
  if (/community/.test(text) && /organ/.test(text)) return "Community Organizer";
  return "";
}

export function isIndependentWorkTitle(title: string) {
  return Boolean(findIndependentWorkRole(title) ?? inferIndependentWorkRoleTitle(title) ?? inferIndependentWorkCategory(title));
}

export function formatIndependentTitle(title: string, workType: string) {
  const cleanedTitle = title.trim();
  const type = workType.trim();
  if (!cleanedTitle) return cleanedTitle;
  if (/^(freelance|independent|self-employed|contract|volunteer|founder|operator)\b/i.test(cleanedTitle)) return cleanedTitle;
  if (/volunteer/i.test(type)) return `Volunteer ${cleanedTitle}`;
  if (/freelance/i.test(type)) return `Freelance ${cleanedTitle}`;
  if (/self-employed/i.test(type)) return `Self-Employed ${cleanedTitle}`;
  if (/contract/i.test(type)) return `Contract ${cleanedTitle}`;
  if (/side business|family business|creator work|gig work/i.test(type)) return `Independent ${cleanedTitle}`;
  return cleanedTitle;
}
