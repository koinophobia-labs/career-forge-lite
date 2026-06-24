const companyCategories = {
  tech: [
    "Amazon", "Apple", "Google", "Microsoft", "Meta", "Salesforce", "HubSpot", "Oracle", "IBM", "Cisco", "Adobe", "Intuit", "ServiceNow",
    "Workday", "Snowflake", "Datadog", "Atlassian", "Shopify", "Stripe", "Square", "Block", "PayPal", "eBay", "Netflix", "Hulu", "Roku",
    "OpenAI", "NVIDIA", "Intel", "AMD", "Dell Technologies", "HP", "Lenovo", "Zoom", "Slack", "Dropbox", "Box", "DocuSign", "Twilio",
    "Okta", "GitHub", "GitLab", "Figma", "Canva", "Airtable", "Notion", "Asana", "Monday.com", "ClickUp"
  ],
  consulting: [
    "Accenture", "Deloitte", "Capgemini", "Cognizant", "Infosys", "Tata Consultancy Services", "Wipro", "EY", "PwC", "KPMG",
    "Booz Allen Hamilton", "Slalom", "EPAM", "Publicis Sapient", "Thoughtworks", "CGI", "NTT DATA", "HCLTech", "Genpact", "Concentrix",
    "Teleperformance", "TaskUs", "Alorica", "Foundever", "TTEC", "Robert Half", "Kelly Services", "Adecco", "Randstad", "ManpowerGroup"
  ],
  finance: [
    "JPMorgan Chase", "Bank of America", "Wells Fargo", "Capital One", "Discover", "American Express", "Citibank", "Goldman Sachs",
    "Morgan Stanley", "Charles Schwab", "Fidelity Investments", "Vanguard", "US Bank", "PNC Bank", "Truist", "TD Bank", "BMO",
    "KeyBank", "Ally", "SoFi", "Chime", "Rocket Mortgage", "State Farm", "GEICO", "Progressive", "Allstate", "Liberty Mutual",
    "Nationwide", "Travelers", "Aflac", "New York Life", "Prudential", "MetLife", "The Hartford", "USAA"
  ],
  airlinesLogistics: [
    "United Airlines", "Delta Air Lines", "American Airlines", "Southwest Airlines", "JetBlue", "Alaska Airlines", "Spirit Airlines",
    "Frontier Airlines", "FedEx", "UPS", "DHL", "USPS", "XPO", "Ryder", "J.B. Hunt", "C.H. Robinson", "Maersk", "Expeditors",
    "Lineage Logistics", "GXO Logistics", "Amazon Logistics", "DoorDash", "Uber", "Lyft", "Instacart", "Shipt", "GoPuff", "Grubhub"
  ],
  retail: [
    "Walmart", "Target", "Best Buy", "Costco", "Sam's Club", "Walgreens", "CVS Health", "Home Depot", "Lowe's", "Kroger", "Albertsons",
    "Aldi", "Trader Joe's", "Whole Foods Market", "Meijer", "Publix", "H-E-B", "Safeway", "Dollar General", "Dollar Tree", "Family Dollar",
    "Macy's", "Nordstrom", "Kohl's", "TJ Maxx", "Marshalls", "Ross Stores", "Burlington", "Old Navy", "Gap", "Nike", "Adidas",
    "Lululemon", "Sephora", "Ulta Beauty", "PetSmart", "Petco", "AutoZone", "O'Reilly Auto Parts", "Advance Auto Parts", "CarMax"
  ],
  foodHospitality: [
    "Starbucks", "McDonald's", "Chipotle", "Chick-fil-A", "Taco Bell", "KFC", "Pizza Hut", "Domino's", "Papa Johns", "Subway", "Panera Bread",
    "Dunkin'", "Culver's", "Wendy's", "Burger King", "Shake Shack", "Five Guys", "Olive Garden", "Texas Roadhouse", "Darden Restaurants",
    "Hilton", "Marriott", "Hyatt", "IHG Hotels & Resorts", "Wyndham Hotels", "Four Seasons", "MGM Resorts", "Caesars Entertainment",
    "Live Nation", "Aramark", "Sodexo", "Compass Group", "Levy Restaurants"
  ],
  healthcare: [
    "UnitedHealth Group", "Optum", "CVS Health", "Walgreens Boots Alliance", "Northwestern Medicine", "Advocate Health", "Kaiser Permanente",
    "HCA Healthcare", "Mayo Clinic", "Cleveland Clinic", "Ascension", "CommonSpirit Health", "Trinity Health", "Tenet Healthcare",
    "DaVita", "Quest Diagnostics", "Labcorp", "Cigna", "Elevance Health", "Humana", "Aetna", "Blue Cross Blue Shield", "Centene",
    "Molina Healthcare", "Walgreens", "Rite Aid", "Medtronic", "Johnson & Johnson", "Pfizer", "Moderna", "Abbott", "GE HealthCare"
  ],
  gamingMediaTelecom: [
    "DraftKings", "FanDuel", "BetMGM", "Fanatics", "ESPN", "Disney", "Comcast", "Verizon", "AT&T", "T-Mobile", "Charter Communications",
    "Spectrum", "Cox Communications", "Warner Bros. Discovery", "Paramount", "NBCUniversal", "Fox Corporation", "SiriusXM", "iHeartMedia",
    "Audacy", "TikTok", "YouTube", "Twitch", "Roblox", "Electronic Arts", "Take-Two Interactive", "Activision Blizzard", "Riot Games",
    "Epic Games", "Unity", "PlayStation", "Xbox"
  ],
  educationGovernment: [
    "University of Illinois", "Arizona State University", "Ohio State University", "University of Michigan", "University of Texas", "UCLA",
    "USC", "New York University", "DePaul University", "Northwestern University", "City Colleges of Chicago", "Community College System",
    "State Government", "City Government", "County Government", "Federal Government", "Department of Veterans Affairs", "Department of Defense",
    "Department of Homeland Security", "TSA", "US Census Bureau", "Maximus", "Leidos", "SAIC", "General Dynamics Information Technology",
    "Peraton", "CACI", "Amentum", "Jacobs", "Serco"
  ],
  local: [
    "Local Business", "Small Business", "Freelance", "Self-Employed", "Contract Work", "Family Business", "Campus Job", "Internship",
    "Volunteer Organization", "Nonprofit Organization", "Local Restaurant", "Local Retail Store", "Local Warehouse", "Local Security Company",
    "Local Healthcare Clinic", "Local School", "Local Government Office", "Temporary Assignment", "Staffing Agency", "Independent Contractor"
  ]
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

export const companySuggestions = unique(Object.values(companyCategories).flat());
