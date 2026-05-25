export interface NocEntry {
  code: string;
  title: string;
  teer: number;
  category: string;
  description?: string;
  exampleTitles: string[];
  eligibleForFST?: boolean;
  categoryBasedStream?: "STEM" | "Healthcare" | "Trades" | "Transport" | "Agriculture" | "Education" | null;
}

export const CATEGORY_NOC_MAPPING: Record<string, string[]> = {
  STEM: [
    "20010", "20011", "20012", "21210", "21211", "21220", "21221", "21222", "21223", "21230", "21231", "21232", "21233", "21234", "21300", "21301", "21310", "21311", "21320", "21321", "21322", "21330", "22220", "22221", "22222", "22310"
  ],
  Healthcare: [
    "30010", "31100", "31101", "31102", "31103", "31110", "31111", "31112", "31120", "31121", "31200", "31201", "31202", "31203", "31204", "31209", "31300", "31301", "31302", "31303", "32100", "32101", "32102", "32103", "32104", "32109", "32110", "32111", "32112", "32120", "32200", "32201", "32209", "33100", "33101", "33102", "33103", "33109"
  ],
  Trades: [
    "72010", "72011", "72012", "72013", "72014", "72020", "72021", "72022", "72023", "72024", "72100", "72101", "72102", "72103", "72104", "72105", "72106", "72200", "72201", "72202", "72203", "72204", "72205", "72300", "72301", "72302", "72310", "72311", "72320", "72321", "72400", "72401", "72402", "72403", "72404", "72405", "72406", "72410", "72420", "72421", "72422", "72423", "72500", "73100", "73101", "73102", "73110", "73111", "73112", "73113", "73200", "73201", "73202", "73209", "73400"
  ],
  Transport: [
    "70020", "72403", "72404", "72600", "72601", "72602", "72603", "72604", "73300", "73301"
  ],
  Agriculture: [
    "80020", "80021", "82030", "82031", "84120", "85100", "85101"
  ],
  Education: [
    "40020", "40021", "41200", "41210", "41220", "41221", "41300", "41301", "41302", "41310", "41320", "42200", "42201", "42202", "42203", "43100"
  ],
};

export const NOC_DATABASE: NocEntry[] = [
  // TEER 0 (Management)
  { code: "00010", title: "Legislators", teer: 0, category: "Management", exampleTitles: ["Legislator", "Member of Parliament"] },
  { code: "00011", title: "Senior government managers and officials", teer: 0, category: "Management", exampleTitles: ["Deputy minister", "Senior government official"] },
  { code: "00012", title: "Senior managers - financial, communications and other business services", teer: 0, category: "Management", exampleTitles: ["CEO", "CFO", "Bank president"] },
  { code: "00013", title: "Senior managers - health, education, social and community services and membership organizations", teer: 0, category: "Management", exampleTitles: ["Executive director", "Hospital president"] },
  { code: "00014", title: "Senior managers - trade, broadcasting and other services", teer: 0, category: "Management", exampleTitles: ["Broadcasting president", "Retail chain president"] },
  { code: "00015", title: "Senior managers - construction, transportation, production and utilities", teer: 0, category: "Management", exampleTitles: ["Construction CEO", "Airline president"] },
  { code: "10010", title: "Financial managers", teer: 0, category: "Management", exampleTitles: ["Controller", "Finance director"] },
  { code: "10011", title: "Human resources managers", teer: 0, category: "Management", exampleTitles: ["HR director", "HR manager"] },
  { code: "10012", title: "Purchasing managers", teer: 0, category: "Management", exampleTitles: ["Procurement manager", "Purchasing director"] },
  { code: "10019", title: "Other administrative services managers", teer: 0, category: "Management", exampleTitles: ["Administrative services manager"] },
  { code: "10020", title: "Insurance, real estate and financial brokerage managers", teer: 0, category: "Management", exampleTitles: ["Insurance manager", "Real estate agency manager"] },
  { code: "10021", title: "Banking, credit and other investment managers", teer: 0, category: "Management", exampleTitles: ["Bank manager", "Credit manager"] },
  { code: "10022", title: "Advertising, marketing and public relations managers", teer: 0, category: "Management", exampleTitles: ["Marketing manager", "PR director"] },
  { code: "10029", title: "Other business services managers", teer: 0, category: "Management", exampleTitles: ["Business services manager"] },
  { code: "10030", title: "Telecommunication carriers managers", teer: 0, category: "Management", exampleTitles: ["Telecommunications manager"] },
  
  // TEER 1 (Professionals requiring university degree)
  { code: "21211", title: "Data scientists", teer: 1, category: "STEM", exampleTitles: ["Data scientist", "Machine learning engineer"], categoryBasedStream: "STEM" },
  { code: "21220", title: "Cybersecurity specialists", teer: 1, category: "STEM", exampleTitles: ["Cybersecurity specialist", "IT security analyst"], categoryBasedStream: "STEM" },
  { code: "21221", title: "Business systems specialists", teer: 1, category: "STEM", exampleTitles: ["Business systems analyst", "IT business analyst"], categoryBasedStream: "STEM" },
  { code: "21222", title: "Information systems specialists", teer: 1, category: "STEM", exampleTitles: ["Information systems specialist", "IT consultant"], categoryBasedStream: "STEM" },
  { code: "21231", title: "Software engineers and designers", teer: 1, category: "STEM", exampleTitles: ["Software engineer", "Software architect"], categoryBasedStream: "STEM" },
  { code: "21232", title: "Software developers and programmers", teer: 1, category: "STEM", exampleTitles: ["Software developer", "Computer programmer"], categoryBasedStream: "STEM" },
  { code: "31100", title: "Specialists in clinical and laboratory medicine", teer: 1, category: "Healthcare", exampleTitles: ["Pathologist", "Medical microbiologist"], categoryBasedStream: "Healthcare" },
  { code: "31101", title: "Specialists in surgery", teer: 1, category: "Healthcare", exampleTitles: ["Surgeon", "Orthopedic surgeon"], categoryBasedStream: "Healthcare" },
  { code: "31102", title: "General practitioners and family physicians", teer: 1, category: "Healthcare", exampleTitles: ["Family doctor", "General practitioner"], categoryBasedStream: "Healthcare" },
  { code: "31301", title: "Registered nurses and registered psychiatric nurses", teer: 1, category: "Healthcare", exampleTitles: ["Registered nurse (RN)", "Psychiatric nurse"], categoryBasedStream: "Healthcare" },
  { code: "41210", title: "College and other vocational instructors", teer: 1, category: "Education", exampleTitles: ["College professor", "Vocational instructor"], categoryBasedStream: "Education" },
  { code: "41220", title: "Secondary school teachers", teer: 1, category: "Education", exampleTitles: ["High school teacher", "Secondary school teacher"], categoryBasedStream: "Education" },
  { code: "41221", title: "Elementary school and kindergarten teachers", teer: 1, category: "Education", exampleTitles: ["Elementary teacher", "Kindergarten teacher"], categoryBasedStream: "Education" },
  
  // TEER 2 (Supervisors and technical occupations requiring diploma)
  { code: "32101", title: "Licensed practical nurses", teer: 2, category: "Healthcare", exampleTitles: ["LPN", "Registered practical nurse"], categoryBasedStream: "Healthcare" },
  { code: "72010", title: "Contractors and supervisors, machining, metal forming, shaping and erecting trades and related occupations", teer: 2, category: "Trades", exampleTitles: ["Machining supervisor", "Welding contractor"], eligibleForFST: true, categoryBasedStream: "Trades" },
  { code: "72011", title: "Contractors and supervisors, electrical trades and telecommunications occupations", teer: 2, category: "Trades", exampleTitles: ["Electrical contractor", "Telecommunications supervisor"], eligibleForFST: true, categoryBasedStream: "Trades" },
  { code: "72014", title: "Contractors and supervisors, other construction trades, installers, repairers and servicers", teer: 2, category: "Trades", exampleTitles: ["Construction supervisor", "Roofing contractor"], eligibleForFST: true, categoryBasedStream: "Trades" },
  { code: "72200", title: "Electricians (except industrial and power system)", teer: 2, category: "Trades", exampleTitles: ["Construction electrician", "Residential electrician"], eligibleForFST: true, categoryBasedStream: "Trades" },
  { code: "72201", title: "Industrial electricians", teer: 2, category: "Trades", exampleTitles: ["Industrial electrician", "Plant electrician"], eligibleForFST: true, categoryBasedStream: "Trades" },
  { code: "72300", title: "Plumbers", teer: 2, category: "Trades", exampleTitles: ["Plumber", "Maintenance plumber"], eligibleForFST: true, categoryBasedStream: "Trades" },
  { code: "72302", title: "Gas fitters", teer: 2, category: "Trades", exampleTitles: ["Gas fitter", "Gas technician"], eligibleForFST: true, categoryBasedStream: "Trades" },
  { code: "72400", title: "Construction millwrights and industrial mechanics", teer: 2, category: "Trades", exampleTitles: ["Industrial mechanic", "Millwright"], eligibleForFST: true, categoryBasedStream: "Trades" },
  { code: "72600", title: "Air pilots, flight engineers and flying instructors", teer: 2, category: "Transport", exampleTitles: ["Pilot", "Flight instructor"], categoryBasedStream: "Transport" },

  // TEER 3 (Workers requiring college diploma, apprenticeship, or 6+ months training)
  { code: "33102", title: "Nurse aides, orderlies and patient service associates", teer: 3, category: "Healthcare", exampleTitles: ["Nurse aide", "Orderly", "Patient service associate"], categoryBasedStream: "Healthcare" },
  { code: "43100", title: "Elementary and secondary school teacher assistants", teer: 3, category: "Education", exampleTitles: ["Teacher assistant", "Educational assistant"], categoryBasedStream: "Education" },
  { code: "63200", title: "Cooks", teer: 3, category: "Service", exampleTitles: ["Cook", "Line cook", "Short order cook"], eligibleForFST: true },
  { code: "73200", title: "Transport truck drivers", teer: 3, category: "Transport", exampleTitles: ["Truck driver", "Long haul truck driver"], categoryBasedStream: "Transport" },
  { code: "73300", title: "Transport truck mechanics", teer: 3, category: "Transport", exampleTitles: ["Truck mechanic", "Trailer mechanic"], categoryBasedStream: "Transport" },
  { code: "83101", title: "Logging machinery operators", teer: 3, category: "Agriculture", exampleTitles: ["Feller buncher operator", "Skidder operator"], categoryBasedStream: "Agriculture" },
  
  // Note: Only a subset of NOC codes is listed for brevity in this implementation, 
  // but includes key codes for Express Entry TEER 0-3 and all targeted draws.
];

export function searchNoc(query: string): NocEntry[] {
  const q = query.toLowerCase();
  return NOC_DATABASE.filter(n => 
    n.code.includes(q) || 
    n.title.toLowerCase().includes(q) || 
    n.exampleTitles.some(et => et.toLowerCase().includes(q))
  );
}

export function getNocByCode(code: string): NocEntry | undefined {
  return NOC_DATABASE.find(n => n.code === code);
}
