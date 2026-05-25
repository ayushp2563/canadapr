import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { sanitizeChatRequest, type ChatRequest } from "../middleware/sanitize.js";
import { retrieve, detectPathwayType } from "../../rag/retriever.js";
import { routeAndStream, isBlockedQuery, SYSTEM_PROMPT } from "../../llm/router.js";
import { PrismaClient } from "@prisma/client";
import { extractProfileInfo } from "../../ai/profileExtractor.js";
import { profileService } from "../../services/profileService.js";
import { memoryManager } from "../../memory/conversationMemory.js";
import { buildSystemPrompt } from "../../ai/systemPromptBuilder.js";
import { drawEnricher } from "../../scraper/drawEnricher.js";

const router = Router();
const prisma = new PrismaClient();

// ============================================================
// POST /api/chat  (SSE streaming)
// ============================================================
router.post("/", sanitizeChatRequest, async (req: Request, res: Response) => {
  // Extending ChatRequest locally to include drawId
  const { message, sessionId, language } = req.body as ChatRequest & { drawId?: number };
  const reqSessionId = sessionId ?? uuidv4();

  // --- Jailbreak / off-topic guard ---
  const blocked = isBlockedQuery(message);
  if (blocked.blocked) {
    res.status(400).json({
      error: blocked.reason === "off_topic"
        ? "I'm specialized in Canadian immigration topics. Please ask about Express Entry, PNP, family sponsorship, or other Canadian PR pathways."
        : "This request cannot be processed.",
      code: blocked.reason,
    });
    return;
  }

  // --- Set SSE headers ---
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Session-Id", reqSessionId);
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 1. Profile Extraction & Merging
    const extractedInfo = await extractProfileInfo(message);
    const updatedCandidate = await profileService.mergeAndSave(reqSessionId, extractedInfo);
    const completeness = profileService.getCompleteness(updatedCandidate);

    // 2. Load Draw Context (if drawId is provided or load latest)
    let drawContext: any = null;
    if (req.body.drawId) {
      const draw = await prisma.expressEntryDraw.findUnique({
        where: { drawNumber: req.body.drawId }
      });
      if (draw) {
        if (!draw.drawCategory || !draw.drawAnalysis) {
          const enriched = await drawEnricher.enrichDraw(draw);
          drawContext = await prisma.expressEntryDraw.update({
            where: { id: draw.id },
            data: enriched as any
          });
        } else {
          drawContext = draw;
        }
      }
    } else {
      // Default to latest draw for general context
      drawContext = await prisma.expressEntryDraw.findFirst({
        orderBy: { drawDate: "desc" }
      });
    }

    // 3. Load DB Conversation History
    const history = await memoryManager.loadHistory(reqSessionId);

    // 4. RAG Retrieval
    const pathwayFilter = detectPathwayType(message);
    const ragResult = await retrieve(message, { pathwayTypeFilter: pathwayFilter });
    const ragContextStr = ragResult.contextString ? `\n\n## RAG CONTEXT:\n${ragResult.contextString}` : "";

    // 5. Build Final Context & System Prompt
    const fullContext = (drawContext && !req.body.drawId) 
      ? `\n\n## Latest Express Entry Draw Data (from IRCC)\n- Draw #${drawContext.drawNumber} (${drawContext.drawType}): CRS ${drawContext.crsScore}, ${drawContext.invitationsIssued} invitations, ${new Date(drawContext.drawDate).toLocaleDateString("en-CA")}`
      : "";
    
    // Inject Profile + RAG + Draw specifics into the system prompt
    const finalSystemPrompt = buildSystemPrompt(SYSTEM_PROMPT + fullContext + ragContextStr, updatedCandidate, req.body.drawId ? drawContext : null);

    // --- Send metadata start event ---
    sendEvent("start", {
      sessionId: reqSessionId,
      sources: ragResult.sourcesFormatted,
      draw_data: drawContext ?? null,
      language,
      candidateProfile: updatedCandidate,
      crsScore: updatedCandidate.estimatedCRS,
      topPathways: updatedCandidate.eligiblePathways,
      profileCompleteness: completeness.score,
      missingInfo: completeness.missingCritical
    });

    // 6. Save user message to DB
    await memoryManager.saveMessage(reqSessionId, "user", message, { extractedInfo });

    // 7. Stream LLM response
    let modelUsed = "";
    let provider: "groq" | "mistral" = "groq";
    let fallbackUsed = false;
    let fullResponse = "";

    // Hack: We temporarily override SYSTEM_PROMPT logic in routeAndStream by passing it via 'context' or intercepting inside router.
    // For simplicity, we pass finalSystemPrompt as 'context' and let router prepend its own base prompt, but we'll modify router.ts to accept systemPrompt.
    
    for await (const event of routeAndStream(message, "", history as any, finalSystemPrompt)) {
      if (event.type === "chunk") {
        fullResponse += event.text;
        sendEvent("chunk", { text: event.text });
      } else if (event.type === "meta") {
        modelUsed = event.meta.model_used;
        provider = event.meta.provider;
        fallbackUsed = event.meta.fallback_used;
      }
    }

    // 8. Save assistant message to DB
    await memoryManager.saveMessage(reqSessionId, "assistant", fullResponse, { 
      modelUsed, 
      provider, 
      fallbackUsed, 
      sources: ragResult.sourcesFormatted 
    });

    // --- Send completion event ---
    sendEvent("done", {
      model_used: modelUsed,
      provider,
      fallback_used: fallbackUsed,
      sources: ragResult.sourcesFormatted,
    });

    res.end();
  } catch (err) {
    console.error("Chat error:", err);
    sendEvent("error", { message: "An error occurred. Please try again." });
    res.end();
  }
});

export default router;
