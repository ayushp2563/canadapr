import { CandidateProfile } from "@prisma/client";
import { calculateCRS } from "../calculator/crsCalculator.js";
import { CATEGORY_NOC_MAPPING } from "../data/nocDatabase.js";

export interface PathwayResult {
  pathway: string;
  program: string;
  eligible: boolean;
  eligibilityScore: number; // 0-100
  missingRequirements: string[];
  meetingRequirements: string[];
  estimatedTimeline: string;
  nextSteps: string[];
  priority: "high" | "medium" | "low";
  crsRequired?: number;
  tips: string[];
}

export function findBestPathways(profile: Partial<CandidateProfile>): PathwayResult[] {
  const results: PathwayResult[] = [];
  
  // 1. Express Entry - Federal Skilled Worker
  results.push(checkFederalSkilledWorker(profile));
  
  // 2. Express Entry - Canadian Experience Class
  results.push(checkCanadianExperienceClass(profile));
  
  // 3. Express Entry - Federal Skilled Trades
  results.push(checkFederalSkilledTrades(profile));

  // 4. Provincial Nominee Programs (OINP, BCPNP, etc. - simplified)
  results.push(checkOINPHumanCapital(profile));
  
  // Filter and sort results
  return results
    .filter(r => r.eligibilityScore > 20 || r.eligible)
    .sort((a, b) => {
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      return b.eligibilityScore - a.eligibilityScore;
    });
}

function checkFederalSkilledWorker(profile: Partial<CandidateProfile>): PathwayResult {
  const missing: string[] = [];
  const meeting: string[] = [];
  let score = 0;

  // Requirements: 1 yr continuous work, CLB 7, High school + ECA, 67/100 grid points
  const workYrs = profile.foreignWorkYears || 0;
  if (workYrs >= 1) {
    meeting.push(`Has ${workYrs} years of foreign work experience (min 1 year required)`);
    score += 40;
  } else {
    missing.push("Needs at least 1 year of continuous, paid work experience in TEER 0, 1, 2, or 3");
  }

  const clb = profile.clbLevel || 0; // simplistic check
  if (clb >= 7) {
    meeting.push(`Meets minimum language requirement (CLB ${clb} >= 7)`);
    score += 30;
  } else {
    missing.push("Language test scores showing minimum CLB 7 in all four abilities");
  }

  if (profile.educationLevel && profile.educationLevel !== "none") {
    if (profile.educationCountry !== "Canada" && !profile.ecaCompleted) {
      missing.push("Educational Credential Assessment (ECA) is required for foreign degrees");
      score += 10;
    } else {
      meeting.push("Meets education requirements");
      score += 30;
    }
  } else {
    missing.push("Minimum secondary school (high school) diploma or equivalent");
  }

  const eligible = missing.length === 0;

  return {
    pathway: "Express Entry",
    program: "Federal Skilled Worker (FSW)",
    eligible,
    eligibilityScore: score,
    missingRequirements: missing,
    meetingRequirements: meeting,
    estimatedTimeline: "6-8 months after ITA",
    nextSteps: eligible 
      ? ["Create an Express Entry profile", "Enter the pool and wait for an ITA"]
      : ["Complete the missing requirements to become eligible"],
    priority: eligible ? "high" : "medium",
    tips: ["FSW uses a 100-point grid. You must score 67 points to enter the pool."]
  };
}

function checkCanadianExperienceClass(profile: Partial<CandidateProfile>): PathwayResult {
  const missing: string[] = [];
  const meeting: string[] = [];
  let score = 0;

  const canWork = profile.canadianWorkYears || 0;
  if (canWork >= 1) {
    meeting.push(`Has ${canWork} years of Canadian work experience (min 1 year required)`);
    score += 60;
  } else {
    missing.push("Needs at least 1 year of skilled work experience in Canada within the last 3 years");
  }

  const clb = profile.clbLevel || 0;
  const isTeer0or1 = profile.teerCategory === 0 || profile.teerCategory === 1;
  const reqClb = isTeer0or1 ? 7 : 5;

  if (clb >= reqClb) {
    meeting.push(`Meets minimum language requirement (CLB ${clb} >= ${reqClb} for your TEER)`);
    score += 40;
  } else {
    missing.push(`Language test scores showing minimum CLB ${reqClb} for your occupation level`);
  }

  const eligible = missing.length === 0;

  return {
    pathway: "Express Entry",
    program: "Canadian Experience Class (CEC)",
    eligible,
    eligibilityScore: score,
    missingRequirements: missing,
    meetingRequirements: meeting,
    estimatedTimeline: "5-6 months after ITA",
    nextSteps: eligible 
      ? ["Create an Express Entry profile"]
      : ["Gain the required Canadian work experience or language score"],
    priority: eligible ? "high" : "low",
    tips: ["CEC is often prioritized by IRCC in specific draws."]
  };
}

function checkFederalSkilledTrades(profile: Partial<CandidateProfile>): PathwayResult {
  const missing: string[] = [];
  const meeting: string[] = [];
  let score = 0;

  const isTrade = profile.nocCodes?.some(noc => CATEGORY_NOC_MAPPING.Trades.includes(noc));
  if (isTrade) {
    meeting.push("Experience is in an eligible skilled trade");
    score += 30;
  } else {
    missing.push("Requires experience in a recognized skilled trade occupation");
  }

  const totalWork = (profile.canadianWorkYears || 0) + (profile.foreignWorkYears || 0);
  if (totalWork >= 2) {
    meeting.push(`Has ${totalWork} years of work experience in the trade (min 2 required)`);
    score += 30;
  } else {
    missing.push("Needs at least 2 years of full-time work experience in a skilled trade within the 5 years before applying");
  }

  const clb = profile.clbLevel || 0;
  // FST requires CLB 5 speaking/listening, CLB 4 reading/writing
  if (clb >= 5) {
    meeting.push("Meets minimum language requirement for FST (CLB 5)");
    score += 20;
  } else {
    missing.push("Needs minimum CLB 5 for speaking and listening, and CLB 4 for reading and writing");
  }

  if (profile.hasJobOffer || profile.provincialNomination) { // Simplified certificate of qualification check
    meeting.push("Has valid job offer or certificate of qualification");
    score += 20;
  } else {
    missing.push("Requires a valid job offer of full-time employment for at least 1 year OR a certificate of qualification in that skilled trade issued by a Canadian provincial, territorial or federal authority");
  }

  const eligible = missing.length === 0;

  return {
    pathway: "Express Entry",
    program: "Federal Skilled Trades (FST)",
    eligible,
    eligibilityScore: score,
    missingRequirements: missing,
    meetingRequirements: meeting,
    estimatedTimeline: "6-8 months after ITA",
    nextSteps: eligible 
      ? ["Create an Express Entry profile"]
      : ["Obtain a job offer or a Canadian certificate of qualification"],
    priority: eligible ? "high" : "low",
    tips: ["FST draws usually have much lower CRS cutoffs than general draws."]
  };
}

function checkOINPHumanCapital(profile: Partial<CandidateProfile>): PathwayResult {
  const missing: string[] = [];
  const meeting: string[] = [];
  let score = 0;
  
  if (profile.educationLevel === "bachelors" || profile.educationLevel === "masters" || profile.educationLevel === "phd") {
    meeting.push("Meets education requirement (Bachelors or higher)");
    score += 40;
  } else {
    missing.push("Requires a Bachelor's, Master's or PhD degree");
  }
  
  if ((profile.clbLevel || 0) >= 7) {
    meeting.push("Meets language requirement (CLB 7+)");
    score += 40;
  } else {
    missing.push("Requires minimum CLB 7 in English or French");
  }
  
  // Target province check
  if (profile.targetProvince === "Ontario" || !profile.targetProvince) {
    meeting.push("Intends to reside in Ontario");
    score += 20;
  } else {
    missing.push("Must intend to live in Ontario");
  }

  const eligible = missing.length === 0;

  return {
    pathway: "Provincial Nominee Program (PNP)",
    program: "OINP Human Capital Priorities",
    eligible,
    eligibilityScore: score,
    missingRequirements: missing,
    meetingRequirements: meeting,
    estimatedTimeline: "2-3 months for nomination, then 6 months for PR",
    nextSteps: eligible 
      ? ["Opt-in to OINP in your Express Entry profile", "Wait for Notification of Interest (NOI)"]
      : ["Improve language score or education level"],
    priority: eligible ? "high" : "medium",
    tips: ["OINP targets specific NOC codes in each draw (Tech, Healthcare, Trades)."]
  };
}
