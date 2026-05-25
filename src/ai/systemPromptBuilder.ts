import { CandidateProfile } from "@prisma/client";

export function buildSystemPrompt(
  basePrompt: string, 
  candidate: CandidateProfile | null, 
  drawContext?: any
): string {
  let prompt = basePrompt;
  
  if (candidate) {
    const pathways = typeof candidate.eligiblePathways === 'string' 
      ? JSON.parse(candidate.eligiblePathways) 
      : (candidate.eligiblePathways || []);
      
    const topPathways = Array.isArray(pathways) 
      ? pathways.slice(0, 3).map(p => `- ${p.program}: ${p.eligible ? 'Eligible' : 'Not yet eligible'} (Score: ${p.eligibilityScore})`).join('\n')
      : "None calculated yet";

    prompt += `\n\n## CANDIDATE PROFILE CONTEXT\n`;
    prompt += `Use this exact profile data to personalize all responses. Do not ask for information that is already provided here.\n\n`;
    prompt += `- Age: ${candidate.age || 'Unknown'}\n`;
    prompt += `- Nationality: ${candidate.nationality || 'Unknown'}\n`;
    prompt += `- Education: ${candidate.educationLevel || 'Unknown'} (ECA: ${candidate.ecaCompleted ? 'Yes' : 'No'})\n`;
    prompt += `- English Level: CLB ${candidate.clbLevel || 'Unknown'}\n`;
    prompt += `- Canadian Work Experience: ${candidate.canadianWorkYears || 0} years\n`;
    prompt += `- Foreign Work Experience: ${candidate.foreignWorkYears || 0} years\n`;
    prompt += `- NOC Codes: ${candidate.nocCodes?.join(", ") || 'None provided'}\n`;
    prompt += `- Job Titles: ${candidate.jobTitles?.join(", ") || 'None provided'}\n`;
    prompt += `- Currently in Canada: ${candidate.currentlyInCanada ? 'Yes' : 'No'}\n`;
    prompt += `- Has Job Offer: ${candidate.hasJobOffer ? 'Yes' : 'No'}\n`;
    prompt += `- Estimated CRS Score: **${candidate.estimatedCRS || 'Need more info to calculate'}**\n\n`;
    
    prompt += `### Best Identified Pathways:\n${topPathways}\n\n`;
    
    prompt += `### INSTRUCTIONS FOR THIS CANDIDATE:\n`;
    prompt += `1. ALWAYS relate answers back to their specific profile.\n`;
    prompt += `2. If their CRS is known, compare it when they ask about Express Entry draws.\n`;
    prompt += `3. If they are missing key info (like IELTS/CLB or Education ECA) to calculate CRS, naturally suggest they provide it.\n`;
    prompt += `4. Proactively mention if their NOC code aligns with Category-Based Selection draws (STEM, Healthcare, Trades, etc).\n`;
  }
  
  if (drawContext) {
    prompt += `\n\n## CURRENT DRAW CONTEXT\n`;
    prompt += `The user is specifically asking about this Express Entry Draw:\n\n`;
    prompt += JSON.stringify(drawContext, null, 2);
    prompt += `\n\n### DRAW INSTRUCTIONS:\n`;
    prompt += `1. Analyze if this candidate would qualify for this specific draw based on their CRS and NOC codes.\n`;
    prompt += `2. Show exactly how many points they are above/below the cutoff.\n`;
    prompt += `3. Explain what type of candidates this draw targeted (referencing the occupation titles if available).\n`;
  }
  
  return prompt;
}
