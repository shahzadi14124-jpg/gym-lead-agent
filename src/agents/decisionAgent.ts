import { prisma } from '../services/db';
import { voiceQueue, whatsappQueue } from '../queues/queueDefinitions'; // CORRECTED
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function processDecisionJob(leadId: number, triggerEvent: string) {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    console.log(`[Decision Agent] Evaluating Lead ${leadId} for event: ${triggerEvent}`);

    if (triggerEvent === 'WHATSAPP_REPLY') {
      const recentMessages = await prisma.messageLog.findMany({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      const contextStr = recentMessages.reverse().map(m => `${m.direction}: ${m.content}`).join('\n');
      
      console.log(`[Decision Agent] Sending context to OpenAI for Lead ${leadId}...`);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are the core logic brain for a gym lead management bot. Based on the conversation history, determine the EXACT state of the lead. Output one of: "INTERESTED", "BUSY", "NOT_INTERESTED", "NEEDS_INFO"' },
          { role: 'user', content: contextStr }
        ]
      });

      const state = completion.choices[0].message.content?.trim() || 'NEEDS_INFO';
      console.log(`[Decision Agent] Success! State evaluated as: ${state}`);

      if (state === 'INTERESTED' || state === 'NEEDS_INFO' || state === 'NEW_LEAD') {
        await prisma.lead.update({ where: { id: lead.id }, data: { nextBestAction: 'Answer and Push Booking' } });
        await whatsappQueue.add('send-whatsapp', { 
          leadId: lead.id, 
          instruction: 'Answer their question based on context. Then aggressively push booking a free trial visit.'
        });
      }
    }
  } catch (error: any) {
    console.error(`[Decision Agent Error]`, error.message);
  }
}
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function processDecisionJob(leadId: number, triggerEvent: string) {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    console.log(`[Decision Agent] Evaluating Lead ${leadId} for event: ${triggerEvent}`);

    if (triggerEvent === 'WHATSAPP_REPLY') {
      const recentMessages = await prisma.messageLog.findMany({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      const contextStr = recentMessages.reverse().map(m => `${m.direction}: ${m.content}`).join('\n');
      
      console.log(`[Decision Agent] Sending context to OpenAI for Lead ${leadId}...`);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are the core logic brain for a gym lead management bot. Based on the conversation history, determine the EXACT state of the lead. Output one of: "INTERESTED", "BUSY", "NOT_INTERESTED", "NEEDS_INFO"' },
          { role: 'user', content: contextStr }
        ]
      });

      const state = completion.choices[0].message.content?.trim() || 'NEEDS_INFO';
      console.log(`[Decision Agent] Success! State evaluated as: ${state}`);

      if (state === 'INTERESTED' || state === 'NEEDS_INFO' || state === 'NEW_LEAD') {
        await prisma.lead.update({ where: { id: lead.id }, data: { nextBestAction: 'Answer and Push Booking' } });
        await whatsappQueue.add('send-whatsapp', { 
          leadId: lead.id, 
          instruction: 'Answer their question based on context. Then aggressively push booking a free trial visit.'
        });
      }
    }
  } catch (error: any) {
    console.error(`[Decision Agent CRITICAL ERROR] Lead ${leadId}:`, error.message);
    if (error.message.includes('quota')) {
      console.error('>>> ALERT: Your OpenAI Account has run out of credits! <<<');
    }
  }
}
