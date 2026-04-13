import { prisma } from '../services/db';
import { voiceQueue, whatsappQueue } from '../queues/agentQueue';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function processDecisionJob(leadId: number, triggerEvent: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  console.log(`[Decision Agent] Evaluating Lead ${leadId} for event: ${triggerEvent}`);

  // Base Logic Routing
  if (triggerEvent === 'NEW_LEAD') {
    if (lead.intentScore >= 80) {
      // Hot: Vapi Call instantly
      await prisma.lead.update({ where: { id: lead.id }, data: { nextBestAction: 'Instant Call' } });
      await voiceQueue.add('vapi-call', { leadId: lead.id });
    } else if (lead.intentScore >= 50) {
      // Warm: WhatsApp initial offer, then schedule a check
      await prisma.lead.update({ where: { id: lead.id }, data: { nextBestAction: 'Initial WhatsApp Offer' } });
      await whatsappQueue.add('send-whatsapp', { 
        leadId: lead.id, 
        instruction: 'Send a friendly intro and offer a free 7-day trial. Push to visit the gym tonight.' 
      });
    } else {
      // Cold: Nurture
      await prisma.lead.update({ where: { id: lead.id }, data: { nextBestAction: 'Delayed Nurture' } });
      await whatsappQueue.add('send-whatsapp', { 
        leadId: lead.id, 
        instruction: 'Send a soft intro asking about their fitness goals.'
      }, { delay: 1000 * 60 * 60 }); // 1 hour delay
    }
    return;
  }

  if (triggerEvent === 'WHATSAPP_REPLY') {
    // If the lead replied, we read their history and decide next step
    const recentMessages = await prisma.messageLog.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const contextStr = recentMessages.reverse().map(m => `${m.direction}: ${m.content}`).join('\n');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are the core logic brain for a gym lead management bot. Based on the conversation history, determine the EXACT state of the lead. Output one of: "INTERESTED", "BUSY", "NOT_INTERESTED", "NEEDS_INFO"' },
        { role: 'user', content: contextStr }
      ]
    });

    const state = completion.choices[0].message.content?.trim() || 'NEEDS_INFO';
    console.log(`[Decision Agent] Lead ${leadId} State evaluated as: ${state}`);

    if (state === 'NOT_INTERESTED') {
      await prisma.lead.update({ where: { id: lead.id }, data: { leadStatus: 'Dead', nextBestAction: 'Stop contacting' } });
      // Stop all automations
      return;
    }

    if (state === 'BUSY') {
      await prisma.lead.update({ where: { id: lead.id }, data: { nextBestAction: 'Follow up tomorrow' } });
      await whatsappQueue.add('send-whatsapp', { 
        leadId: lead.id, 
        instruction: 'Acknowledge they are busy and say you will reach out tomorrow.'
      }, { delay: 1000 * 60 * 5 }); // Actually wait 5 mins to reply so they see we registered they are busy
      return;
    }

    if (state === 'INTERESTED' || state === 'NEEDS_INFO') {
      await prisma.lead.update({ where: { id: lead.id }, data: { leadTemperature: 'Hot', leadStatus: 'Interested', nextBestAction: 'Answer and Push Booking' } });
      await whatsappQueue.add('send-whatsapp', { 
        leadId: lead.id, 
        instruction: 'Answer their question based on context. Then aggressively push booking a free trial visit.'
      });
      return;
    }
  }
}
