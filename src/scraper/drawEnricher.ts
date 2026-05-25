import { ExpressEntryDraw } from "@prisma/client";
import { Mistral } from "@mistralai/mistralai";
import { env } from "../config/env.js";
import { CATEGORY_NOC_MAPPING, getNocByCode } from "../data/nocDatabase.js";

const mistral = new Mistral({ apiKey: env.MISTRAL_API_KEY });

export class DrawEnricher {
  
  detectCategory(drawType: string): string | null {
    const lower = drawType.toLowerCase();
    if (lower.includes("stem")) return "STEM";
    if (lower.includes("healthcare")) return "Healthcare";
    if (lower.includes("trades")) return "Trades";
    if (lower.includes("transport")) return "Transport";
    if (lower.includes("agriculture") || lower.includes("agri-food")) return "Agriculture";
    if (lower.includes("french")) return "French";
    if (lower.includes("provincial") || lower.includes("pnp")) return "PNP";
    if (lower.includes("canadian experience class") || lower.includes("cec")) return "CEC";
    return "General";
  }

  async enrichDraw(draw: ExpressEntryDraw): Promise<Partial<ExpressEntryDraw>> {
    const category = this.detectCategory(draw.drawType);
    const isOccupationSpecific = category && ["STEM", "Healthcare", "Trades", "Transport", "Agriculture", "Education"].includes(category);
    
    let targetedNocCodes: string[] = [];
    let occupationTitles: any[] = [];
    let targetedTeerCats: number[] = [];

    if (isOccupationSpecific && category) {
      targetedNocCodes = CATEGORY_NOC_MAPPING[category] || [];
      
      const teers = new Set<number>();
      for (const code of targetedNocCodes) {
        const noc = getNocByCode(code);
        if (noc) {
          teers.add(noc.teer);
          occupationTitles.push({
            noc: noc.code,
            title: noc.title,
            teer: noc.teer,
            exampleTitles: noc.exampleTitles
          });
        }
      }
      targetedTeerCats = Array.from(teers);
    }

    // AI Analysis Generation
    const prompt = `Analyze this Canadian Express Entry draw and write a 3-paragraph plain-language summary for candidates:
    
    Draw Date: ${draw.drawDate}
    Draw Type: ${draw.drawType}
    CRS Score Cutoff: ${draw.crsScore}
    Invitations Issued: ${draw.invitationsIssued}
    
    1. Paragraph 1: What happened in this draw (who was targeted, size of draw).
    2. Paragraph 2: Context on the CRS score (is it high or low compared to historical averages for this type? What does it signal?).
    3. Paragraph 3: Actionable advice for candidates targeting this category.
    
    Keep it professional, encouraging, and easy to read. Format with simple paragraphs, no markdown headers.`;

    let drawAnalysis = "";
    try {
      const response = await mistral.chat.complete({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: prompt }]
      });
      const content = response.choices?.[0]?.message?.content;
      if (typeof content === 'string') {
        drawAnalysis = content;
      }
    } catch (e) {
      console.error("Failed to generate draw analysis:", e);
    }

    return {
      drawCategory: category || null,
      isOccupationSpecific: !!isOccupationSpecific,
      targetedNocCodes,
      targetedTeerCats,
      occupationTitles: occupationTitles as any,
      drawAnalysis,
      isPnpDraw: category === "PNP"
    };
  }
}

export const drawEnricher = new DrawEnricher();
