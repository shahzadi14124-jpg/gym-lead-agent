import { prisma } from '../services/db';
import { whatsappService } from '../services/whatsappService';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function processWhatsappJob(leadId: number, instruction: string, injectedContext?: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  // Gather past messages for context
  const recentMessages = await prisma.messageLog.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: 'desc' },
    take: 6
  });
  const contextStr = recentMessages.reverse().map(m => `${m.direction}: ${m.content}`).join('\n');

  console.log(`[WhatsApp Agent] Generating message for lead ${leadId}`);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `You are the sales agent for a top Gym in Delhi. Your tone is friendly, direct, and confident (not overly salesy). 
Keep messages VERY SHORT (1-3 sentences max). Use formatting like *bold* appropriately. 
Goal: Get them to walk into the gym.
Lead Name: ${lead.name}
Instruction from Brain: ${instruction}`
        },
        { 
          role: 'user', 
          content: `Here is the recent conversation history:\n${contextStr}\n\n${injectedContext ? `Additional Context: ${injectedContext}` : ''}\n\nGenerate the next WhatsApp message exactly as it should be sent.`
        }
      ]
    });

    const responseText = completion.choices[0].message.content?.trim();
    if (!responseText) throw new Error("No response generated");

    // Actually send it
    await whatsappService.sendMessage(lead.phone, responseText);
    
    // Log outbound message
    await prisma.messageLog.create({
      data: { leadId: lead.id, direction: 'Outbound', content: responseText }
    });

    // Update lead last contact
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastContacted: new Date() }
    });

    console.log(`[WhatsApp Agent] Message sent to ${lead.phone}`);

  } catch (err) {
    console.error(`[WhatsApp Agent] Error:`, err);
  }
}
