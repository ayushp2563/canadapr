import { Mistral } from "@mistralai/mistralai";
import { CandidateProfile } from "@prisma/client";
import { env } from "../config/env.js";

const mistral = new Mistral({ apiKey: env.MISTRAL_API_KEY });

const EXTRACTION_PROMPT = `
You are a profile extraction engine for Canadian immigration assessment.
Extract ALL immigration-relevant information from the user message and return ONLY valid JSON.

Extract these fields if mentioned (use null if not mentioned or unconfirmed):
{
  "age": number | null,
  "nationality": string | null,
  "currentCountry": string | null,
  "educationLevel": "highSchool"|"diploma"|"bachelors"|"masters"|"phd"|"trade" | null,
  "educationCountry": string | null,
  "ecaCompleted": boolean | null,
  "englishTest": "IELTS"|"CELPIP"|"TEF"|"TCF" | null,
  "clbLevel": number | null,
  "canadianWorkYears": number | null,
  "foreignWorkYears": number | null,
  "nocCodes": [string] | null,
  "jobTitles": [string] | null,
  "currentlyInCanada": boolean | null,
  "currentVisaType": "study"|"work"|"visitor"|"none" | null,
  "studiedInCanada": boolean | null,
  "hasSpouseOrCLP": boolean | null,
  "hasJobOffer": boolean | null,
  "jobOfferProvince": string | null,
  "provincialNomination": boolean | null,
  "targetProvince": string | null,
  "settlementFunds": number | null
}

IMPORTANT:
- Return ONLY the raw JSON object. Do not include markdown code blocks (\`\`\`json).
- If the user is just saying "hi" or asking a general question without giving profile info, return all nulls.
`;

export async function extractProfileInfo(userMessage: string): Promise<Partial<CandidateProfile>> {
  try {
    const response = await mistral.chat.complete({
      model: "mistral-large-latest",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: userMessage }
      ],
      responseFormat: { type: "json_object" }
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return {};

    const extracted = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
    
    // Clean up empty/null fields
    const cleaned: any = {};
    for (const [key, value] of Object.entries(extracted)) {
      if (value !== null && value !== undefined && value !== "") {
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  } catch (error) {
    console.error("Profile extraction failed:", error);
    return {};
  }
}
