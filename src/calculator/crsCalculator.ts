import { CandidateProfile } from "@prisma/client";

export interface CRSBreakdown {
  core: {
    age: number;
    education: number;
    firstLanguage: number;
    secondLanguage: number;
    canadianWork: number;
    total: number;
  };
  spouse: {
    education: number;
    firstLanguage: number;
    canadianWork: number;
    total: number;
  };
  transferability: {
    educationAndLanguage: number;
    educationAndCanadianWork: number;
    foreignWorkAndLanguage: number;
    foreignWorkAndCanadianWork: number;
    certificateAndLanguage: number;
    total: number;
  };
  additional: {
    provincialNomination: number;
    jobOffer: number;
    canadianStudy: number;
    frenchLanguage: number;
    siblingInCanada: number;
    total: number;
  };
}

export interface ImprovementSuggestion {
  category: string;
  suggestion: string;
  potentialPoints: number;
}

export interface CRSResult {
  total: number;
  breakdown: CRSBreakdown;
  maxPossible: number;
  improvementSuggestions: ImprovementSuggestion[];
}

// Convert IELTS/CELPIP to CLB
export function getClbLevel(test: string | null, scores: any): number {
  if (!test || !scores) return 0;
  // Simplified calculation logic for prototype (in production this would be a full grid lookup)
  // Assumes the lowest score sets the CLB if not provided
  const vals = Object.values(scores).map(v => Number(v));
  if (vals.length === 0) return 0;
  const minScore = Math.min(...vals);
  
  if (test.toUpperCase() === "IELTS") {
    if (minScore >= 8) return 10;
    if (minScore >= 7) return 9;
    if (minScore >= 6.5) return 8;
    if (minScore >= 6) return 7;
    return 6;
  }
  
  // Assume direct map for CELPIP
  return Math.min(Math.floor(minScore), 12);
}

export function calculateCRS(profile: Partial<CandidateProfile>): CRSResult {
  const isMarried = profile.hasSpouseOrCLP || false;
  
  const breakdown: CRSBreakdown = {
    core: { age: 0, education: 0, firstLanguage: 0, secondLanguage: 0, canadianWork: 0, total: 0 },
    spouse: { education: 0, firstLanguage: 0, canadianWork: 0, total: 0 },
    transferability: { educationAndLanguage: 0, educationAndCanadianWork: 0, foreignWorkAndLanguage: 0, foreignWorkAndCanadianWork: 0, certificateAndLanguage: 0, total: 0 },
    additional: { provincialNomination: 0, jobOffer: 0, canadianStudy: 0, frenchLanguage: 0, siblingInCanada: 0, total: 0 }
  };

  const suggestions: ImprovementSuggestion[] = [];

  // --- CORE FACTORS ---
  // Age
  if (profile.age) {
    if (profile.age >= 20 && profile.age <= 29) breakdown.core.age = isMarried ? 100 : 110;
    else if (profile.age < 20 && profile.age >= 18) breakdown.core.age = isMarried ? 90 : 99;
    else if (profile.age >= 30 && profile.age <= 44) {
      const penalty = (profile.age - 29) * (isMarried ? 5 : 5.5);
      breakdown.core.age = Math.floor((isMarried ? 100 : 110) - penalty);
    }
  }

  // Education
  const eduLevel = profile.educationLevel?.toLowerCase();
  if (eduLevel) {
    if (eduLevel === "phd") breakdown.core.education = isMarried ? 140 : 150;
    else if (eduLevel === "masters") breakdown.core.education = isMarried ? 126 : 135;
    else if (eduLevel === "bachelors") breakdown.core.education = isMarried ? 112 : 120;
    else if (eduLevel === "diploma") breakdown.core.education = isMarried ? 91 : 98;
    else if (eduLevel === "highschool") breakdown.core.education = isMarried ? 28 : 30;
  } else {
    suggestions.push({ category: "Education", suggestion: "Get an ECA for your education to claim points.", potentialPoints: isMarried ? 140 : 150 });
  }

  // Language
  const clb = profile.clbLevel || getClbLevel(profile.englishTest || null, profile.englishScores);
  if (clb) {
    if (clb >= 10) breakdown.core.firstLanguage = isMarried ? 128 : 136;
    else if (clb === 9) breakdown.core.firstLanguage = isMarried ? 116 : 124;
    else if (clb === 8) breakdown.core.firstLanguage = isMarried ? 88 : 92;
    else if (clb === 7) breakdown.core.firstLanguage = isMarried ? 64 : 68;
    
    if (clb < 9) {
      suggestions.push({ category: "Language", suggestion: "Improve English to CLB 9 to max out language and unlock transferability points.", potentialPoints: (isMarried ? 116 : 124) - breakdown.core.firstLanguage });
    }
  } else {
    suggestions.push({ category: "Language", suggestion: "Take an approved English test (IELTS/CELPIP) to claim language points.", potentialPoints: isMarried ? 128 : 136 });
  }

  // Canadian Work Experience
  if (profile.canadianWorkYears) {
    if (profile.canadianWorkYears >= 5) breakdown.core.canadianWork = isMarried ? 70 : 80;
    else if (profile.canadianWorkYears >= 3) breakdown.core.canadianWork = isMarried ? 56 : 64;
    else if (profile.canadianWorkYears >= 2) breakdown.core.canadianWork = isMarried ? 46 : 53;
    else if (profile.canadianWorkYears >= 1) breakdown.core.canadianWork = isMarried ? 35 : 40;
  }

  breakdown.core.total = breakdown.core.age + breakdown.core.education + breakdown.core.firstLanguage + breakdown.core.secondLanguage + breakdown.core.canadianWork;

  // --- SPOUSE FACTORS ---
  if (isMarried) {
    const spEdu = profile.spouseEducation?.toLowerCase();
    if (spEdu === "phd" || spEdu === "masters") breakdown.spouse.education = 10;
    else if (spEdu === "bachelors") breakdown.spouse.education = 8;
    else if (spEdu) breakdown.spouse.education = 5;

    if (profile.spouseLanguageScores) breakdown.spouse.firstLanguage = 20; // simplified
    if (profile.spouseCanadianWork) breakdown.spouse.canadianWork = 10;

    breakdown.spouse.total = breakdown.spouse.education + breakdown.spouse.firstLanguage + breakdown.spouse.canadianWork;
  }

  // --- SKILL TRANSFERABILITY (Max 100) ---
  if (eduLevel && clb >= 9) breakdown.transferability.educationAndLanguage = 50;
  else if (eduLevel && clb >= 7) breakdown.transferability.educationAndLanguage = 25;

  if (eduLevel && (profile.canadianWorkYears || 0) >= 2) breakdown.transferability.educationAndCanadianWork = 50;
  else if (eduLevel && (profile.canadianWorkYears || 0) >= 1) breakdown.transferability.educationAndCanadianWork = 25;

  if ((profile.foreignWorkYears || 0) >= 3 && clb >= 9) breakdown.transferability.foreignWorkAndLanguage = 50;
  else if ((profile.foreignWorkYears || 0) >= 1 && clb >= 9) breakdown.transferability.foreignWorkAndLanguage = 25;
  else if ((profile.foreignWorkYears || 0) >= 3 && clb >= 7) breakdown.transferability.foreignWorkAndLanguage = 25;
  else if ((profile.foreignWorkYears || 0) >= 1 && clb >= 7) breakdown.transferability.foreignWorkAndLanguage = 13;

  if ((profile.foreignWorkYears || 0) >= 3 && (profile.canadianWorkYears || 0) >= 2) breakdown.transferability.foreignWorkAndCanadianWork = 50;
  else if ((profile.foreignWorkYears || 0) >= 1 && (profile.canadianWorkYears || 0) >= 1) breakdown.transferability.foreignWorkAndCanadianWork = 25;

  breakdown.transferability.total = Math.min(100, 
    breakdown.transferability.educationAndLanguage + 
    breakdown.transferability.educationAndCanadianWork + 
    breakdown.transferability.foreignWorkAndLanguage + 
    breakdown.transferability.foreignWorkAndCanadianWork + 
    breakdown.transferability.certificateAndLanguage
  );

  // --- ADDITIONAL POINTS ---
  if (profile.provincialNomination) breakdown.additional.provincialNomination = 600;
  if (profile.hasJobOffer) {
    if (profile.jobOfferNoc && profile.jobOfferNoc.startsWith("00")) breakdown.additional.jobOffer = 200;
    else breakdown.additional.jobOffer = 50;
  }
  if (profile.studiedInCanada) breakdown.additional.canadianStudy = 30; // simplify 30/15 points
  if (profile.frenchTest) breakdown.additional.frenchLanguage = 50; // max french points
  if (profile.siblingInCanada) breakdown.additional.siblingInCanada = 15;

  breakdown.additional.total = Math.min(600, 
    breakdown.additional.provincialNomination + breakdown.additional.jobOffer + breakdown.additional.canadianStudy + breakdown.additional.frenchLanguage + breakdown.additional.siblingInCanada
  );

  const total = breakdown.core.total + breakdown.spouse.total + breakdown.transferability.total + breakdown.additional.total;

  if (!profile.provincialNomination) {
    suggestions.push({ category: "Provincial Nomination", suggestion: "Securing a PNP nomination would add 600 points.", potentialPoints: 600 });
  }

  return {
    total,
    breakdown,
    maxPossible: 1200,
    improvementSuggestions: suggestions.sort((a,b) => b.potentialPoints - a.potentialPoints)
  };
}
