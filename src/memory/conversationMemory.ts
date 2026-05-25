import { PrismaClient, ChatMessage, ChatSession } from "@prisma/client";

const prisma = new PrismaClient();

export class ConversationMemory {
  
  async getOrCreateSession(sessionId: string, candidateId?: string, drawId?: number): Promise<ChatSession> {
    let session = await prisma.chatSession.findFirst({
      where: { sessionId }
    });
    
    if (!session) {
      session = await prisma.chatSession.create({
        data: {
          sessionId,
          candidateId,
          drawId
        }
      });
    }
    return session;
  }

  async loadHistory(sessionId: string): Promise<{ role: "user"|"assistant"|"system", content: string }[]> {
    const session = await prisma.chatSession.findFirst({
      where: { sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20 // Retrieve last 20 messages to keep context window manageable
        }
      }
    });
    
    if (!session) return [];
    
    const history: { role: "user"|"assistant"|"system", content: string }[] = [];
    
    // Inject summary of older messages if it exists
    if (session.summary) {
      history.push({
        role: "system",
        content: `SUMMARY OF PREVIOUS CONVERSATION: ${session.summary}`
      });
    }
    
    for (const msg of session.messages) {
      history.push({
        role: msg.role as "user"|"assistant"|"system",
        content: msg.content
      });
    }
    
    return history;
  }

  async saveMessage(sessionId: string, role: string, content: string, metadata?: any): Promise<ChatMessage> {
    const session = await this.getOrCreateSession(sessionId);
    
    return prisma.chatMessage.create({
      data: {
        sessionId: session.id, // Links to ChatSession's internal ID
        role,
        content,
        metadata
      }
    });
  }
}

export const memoryManager = new ConversationMemory();
