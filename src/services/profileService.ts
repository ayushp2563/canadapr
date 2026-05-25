import { PrismaClient, CandidateProfile } from "@prisma/client";
import { calculateCRS } from "../calculator/crsCalculator.js";
import { findBestPathways } from "../pathways/eligibilityEngine.js";

const prisma = new PrismaClient();

export class ProfileService {
  
  async getOrCreate(sessionId: string): Promise<CandidateProfile> {
    const existing = await prisma.candidateProfile.findUnique({
      where: { sessionId }
    });
    
    if (existing) return existing;
    
    return prisma.candidateProfile.create({
      data: { sessionId }
    });
  }

  async mergeAndSave(sessionId: string, delta: Partial<CandidateProfile>): Promise<CandidateProfile> {
    const current = await this.getOrCreate(sessionId);
    
    // Smart merge: do not overwrite existing true/valued fields with nulls/false
    const updatedData: any = {};
    for (const [key, value] of Object.entries(delta)) {
      // Only take new values if they are defined and not null
      if (value !== null && value !== undefined) {
        // Exception: arrays should be merged uniquely if possible, or overwritten
        if (Array.isArray(value)) {
          const currArr = current[key as keyof CandidateProfile] as any[] || [];
          updatedData[key] = Array.from(new Set([...currArr, ...value]));
        } else {
          updatedData[key] = value;
        }
      }
    }
    
    if (Object.keys(updatedData).length === 0) return current;

    // Merge for calculation purposes
    const mergedProfile = { ...current, ...updatedData };
    
    // Recalculate CRS and Pathways
    const crsResult = calculateCRS(mergedProfile);
    updatedData.estimatedCRS = crsResult.total;
    
    const pathways = findBestPathways(mergedProfile);
    updatedData.eligiblePathways = pathways as any;

    return prisma.candidateProfile.update({
      where: { sessionId },
      data: updatedData
    });
  }

  getCompleteness(profile: CandidateProfile): { score: number, missingCritical: string[] } {
    let score = 0;
    let maxScore = 100;
    const missing: string[] = [];

    // Age (10)
    if (profile.age) score += 10;
    else missing.push("Age");

    // Education (20)
    if (profile.educationLevel) score += 20;
    else missing.push("Education Level");

    // Language (30)
    if (profile.clbLevel || profile.englishTest) score += 30;
    else missing.push("English/French Language Scores");

    // Work Experience (20)
    if (profile.canadianWorkYears !== null || profile.foreignWorkYears !== null) score += 20;
    else missing.push("Work Experience");

    // NOC (20)
    if (profile.nocCodes && profile.nocCodes.length > 0) score += 20;
    else missing.push("Job Title / NOC Code");

    return { score, missingCritical: missing };
  }
}

export const profileService = new ProfileService();
