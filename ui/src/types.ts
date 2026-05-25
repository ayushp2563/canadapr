// API types for the Canada Immigration Assistant

export interface NocOccupation {
  noc: string;
  title: string;
  teer: number;
  exampleTitles: string[];
}

export interface DrawHistoricalContext {
  avgCrsForThisType: number;
  thisDrawVsAvg: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  lastSimilarDraw: {
    date: string;
    crs: number;
  };
}

export interface Draw {
  id: number;
  drawNumber: number;
  drawDate: string;
  drawType: string;
  crsScore: number;
  invitationsIssued: number;
  tieBreakingRule: string | null;
  drawCategory?: string;
  isOccupationSpecific?: boolean;
  targetedNocCodes?: string[];
  targetedTeerCats?: number[];
  occupationTitles?: NocOccupation[];
  isPnpDraw?: boolean;
  province?: string;
  pnpStream?: string;
  drawAnalysis?: string;
  historicalContext?: DrawHistoricalContext;
  createdAt: string;
  updatedAt: string;
}

export interface PathwayResult {
  pathway: string;
  program: string;
  eligible: boolean;
  eligibilityScore: number;
  missingRequirements: string[];
  meetingRequirements: string[];
  estimatedTimeline: string;
  nextSteps: string[];
  priority: "high" | "medium" | "low";
  crsRequired?: number;
  tips: string[];
}

export interface CandidateProfile {
  id: string;
  sessionId: string;
  age?: number;
  nationality?: string;
  educationLevel?: string;
  ecaCompleted?: boolean;
  clbLevel?: number;
  canadianWorkYears?: number;
  foreignWorkYears?: number;
  nocCodes?: string[];
  jobTitles?: string[];
  currentlyInCanada?: boolean;
  hasJobOffer?: boolean;
  targetProvince?: string;
  estimatedCRS?: number;
  eligiblePathways?: PathwayResult[];
  lastUpdated: string;
}

export interface DrawStats {
  highestCrs: number;
  lowestCrs: number;
  averageCrs: number;
  totalInvitations: number;
}

export interface Announcement {
  id: number;
  title: string;
  url: string;
  publishDate: string;
  category: 'news' | 'notice' | 'policy-change';
  createdAt: string;
}

export interface Source {
  title: string;
  url: string;
  date: string;
  pathwayType: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  modelUsed?: string;
  provider?: 'groq' | 'mistral';
  fallbackUsed?: boolean;
  drawData?: Draw | null;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded';
  timestamp: string;
  services: {
    groq: boolean;
    mistral: boolean;
    vectorDb: boolean;
    database: boolean;
  };
  data: {
    totalDraws: number;
    totalAnnouncements: number;
    lastScrape: string | null;
  };
}
