import type { RoleFamily } from "@/types/career";
import { aiToolOptions } from "@/lib/modern-work-intelligence";

const toolCategories = {
  general: [
    "Microsoft Excel", "Google Sheets", "Microsoft Word", "Google Docs", "Google Workspace", "Microsoft Office", "Slack", "Microsoft Teams",
    "Zoom", "Notion", "Airtable", "Trello", "Asana", "Monday.com", "ClickUp", "Dropbox", "Box", "SharePoint", "OneDrive", "Google Drive",
    "Canva", "Miro", "Lucidchart", "Loom"
  ],
  support: [
    "Salesforce", "HubSpot", "Zendesk", "Intercom", "Freshdesk", "Help Scout", "Gainsight", "Totango", "ServiceNow", "Front", "LiveChat",
    "Kustomer", "Gladly", "Ada", "Talkdesk", "Five9", "Genesys Cloud", "Aircall", "Dialpad", "RingCentral", "Twilio", "Sprout Social",
    "Hootsuite", "Sprinklr", "Typeform", "SurveyMonkey"
  ],
  operations: [
    "SAP", "Oracle", "NetSuite", "Workday", "ADP", "Kronos", "UKG", "QuickBooks", "DocuSign", "Concur", "Coupa", "ServiceTitan",
    "Smartsheet", "Microsoft Planner", "Google Calendar", "Outlook Calendar", "Calendly", "Deputy", "When I Work", "Homebase",
    "BambooHR", "Greenhouse", "Lever", "Workable", "Paycom", "Paychex"
  ],
  sales: [
    "Salesforce", "HubSpot", "Outreach", "Salesloft", "Apollo", "LinkedIn Sales Navigator", "Pipedrive", "Zoho CRM", "Mailchimp",
    "Constant Contact", "ZoomInfo", "Clearbit", "Gong", "Chorus", "Clari", "Highspot", "Seismic", "Calendly", "DocuSign", "Stripe",
    "Square Invoices", "Shopify", "Google Ads", "Meta Business Suite"
  ],
  tech: [
    "Jira", "Confluence", "ServiceNow", "Zendesk", "Active Directory", "Microsoft Azure", "AWS", "Google Cloud", "Okta", "Jamf",
    "Intune", "GitHub", "GitLab", "Bitbucket", "VS Code", "Postman", "Windows", "macOS", "Linux", "Office 365", "Microsoft 365 Admin",
    "Azure DevOps", "Docker", "Kubernetes", "Datadog", "New Relic", "Splunk", "Sentry", "PagerDuty", "Wireshark", "TeamViewer",
    "AnyDesk", "SCCM", "VMware", "Cisco Meraki", "Ubiquiti", "Figma", "Webflow", "WordPress"
  ],
  data: [
    "SQL", "Python", "Tableau", "Power BI", "Looker", "Google Analytics", "BigQuery", "Snowflake", "R", "SPSS", "Excel", "Google Sheets",
    "Airtable", "Domo", "Mode", "Metabase", "dbt", "Alteryx", "SAS", "Stata", "Power Query", "Microsoft Access", "Google Data Studio",
    "Microsoft Forms", "Qualtrics"
  ],
  retail: [
    "POS Systems", "Shopify POS", "Square", "Toast", "Clover", "Lightspeed", "NCR", "Inventory Systems", "Zebra Scanners", "RF Scanners",
    "WMS", "ShipStation", "Shippo", "FedEx Ship Manager", "UPS WorldShip", "Oracle Retail", "Retail Pro", "Kibo", "Manhattan WMS",
    "Blue Yonder", "Epicor", "Revel Systems", "DoorDash Merchant Portal", "Uber Eats Manager", "Grubhub for Restaurants", "OpenTable",
    "Resy", "SevenRooms", "Olo"
  ],
  aiModernProductivity: aiToolOptions
};

const byFamily: Record<RoleFamily, string[]> = {
  Security: ["Incident Reports", "Access Control System", "Radio Systems", "Surveillance Cameras", "CCTV Systems", "Lenel", "Genetec", "Verkada", ...toolCategories.general.slice(0, 10)],
  "Customer Success": [...toolCategories.support, ...toolCategories.general.slice(0, 16), "CRM Systems", "Knowledge Base Software", ...toolCategories.aiModernProductivity],
  "Project Coordination": [...toolCategories.general, "Jira", "Confluence", "Smartsheet", "Microsoft Project", "Google Calendar", "Outlook Calendar", "Miro", "Lucidchart", ...toolCategories.aiModernProductivity],
  Operations: [...toolCategories.operations, ...toolCategories.retail, ...toolCategories.general.slice(0, 16), ...toolCategories.aiModernProductivity],
  Business: [...toolCategories.data, ...toolCategories.operations.slice(0, 12), ...toolCategories.general, ...toolCategories.aiModernProductivity],
  Sales: [...toolCategories.sales, ...toolCategories.support.slice(0, 8), ...toolCategories.general.slice(0, 12), ...toolCategories.aiModernProductivity],
  Admin: [...toolCategories.general, ...toolCategories.operations, "Medical Records Systems", "EMR Systems", "Epic", "Cerner", ...toolCategories.aiModernProductivity],
  Tech: [...toolCategories.tech, ...toolCategories.data, ...toolCategories.general.slice(0, 12), ...toolCategories.aiModernProductivity],
  "IT Support": [...toolCategories.tech, ...toolCategories.support.slice(2, 10), ...toolCategories.general.slice(0, 10), ...toolCategories.aiModernProductivity]
};

function unique(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const toolSuggestionsByFamily: Record<RoleFamily, string[]> = Object.fromEntries(
  Object.entries(byFamily).map(([family, tools]) => [family, unique(tools)])
) as Record<RoleFamily, string[]>;

export const allToolOptions = unique(Object.values(toolSuggestionsByFamily).flat());
