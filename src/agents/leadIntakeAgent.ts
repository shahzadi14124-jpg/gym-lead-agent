import { prisma } from '../services/db';
import { sheetsService } from '../services/sheetsService';
import { decisionQueue } from '../queues/queueDefinitions'; // CORRECTED
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function processNewLead(data: { name: string; phone: string; email?: string; source?: string; messageContext?: string }) {
  if (!data.name || !data.phone) {
    throw new Error('Name and phone are required');
  }

  const formattedPhone = data.phone.startsWith('+') ? data.phone : `+${data.phone}`;

  let lead = await prisma.lead.findUnique({ where: { phone: formattedPhone } });
  
  if (!lead) {
    let intentScore = 50;
    
    if (data.messageContext) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an intake analyst for a Gym. Score the user lead message from 0 to 100 based on their intent to purchase/join immediately. Just output a number.' },
            { role: 'user', content: data.messageContext }
          ]
        });
        intentScore = parseInt(completion.choices[0].message.content || '50', 10);
      } catch (e) {
        console.warn('OpenAI intent scoring failed, defaulting to 50', e);
      }
    }

    let leadTemperature = 'Warm';
    if (intentScore >= 80) leadTemperature = 'Hot';
    if (intentScore < 50) leadTemperature = 'Cold';

    lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone: formattedPhone,
        email: data.email || "",
        source: data.source || 'Manual Webhook',
        intentScore,
        leadTemperature,
        aiSummary: data.messageContext || 'No initial context',
      }
    });

    await sheetsService.appendLeadRow([
      lead.name, lead.phone, lead.email || '', lead.source, lead.callStatus, 
      leadTemperature, intentScore.toString(), new Date().toISOString(), '', 'New'
    ]);
  } else {
    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: { interactionCount: lead.interactionCount + 1 }
    });
  }

  // Trigger the Brain trigger
  await decisionQueue.add('evaluate-lead', { leadId: lead.id, triggerEvent: 'NEW_LEAD' });
  
  return lead;
}

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function processNewLead(data: { name: string; phone: string; email?: string; source?: string; messageContext?: string }) {
  if (!data.name || !data.phone) {
    throw new Error('Name and phone are required');
  }

  const formattedPhone = data.phone.startsWith('+') ? data.phone : `+${data.phone}`;

  let lead = await prisma.lead.findUnique({ where: { phone: formattedPhone } });
  
  if (!lead) {
    // Basic heuristics or fast OpenAI call to score intent if messageContext was provided
    let intentScore = 50; // Default medium intent
    
    if (data.messageContext) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an intake analyst for a Gym. Score the user lead message from 0 to 100 based on their intent to purchase/join immediately. Just output a number.' },
            { role: 'user', content: data.messageContext }
          ]
        });
        intentScore = parseInt(completion.choices[0].message.content || '50', 10);
      } catch (e) {
        console.warn('OpenAI intent scoring failed, defaulting to 50', e);
      }
    }

    // High intent (>80), Medium (50-79), Low (<50)
    let leadTemperature = 'Warm';
    if (intentScore >= 80) leadTemperature = 'Hot';
    if (intentScore < 50) leadTemperature = 'Cold';

    lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone: formattedPhone,
        email: data.email || "",
        source: data.source || 'Manual Webhook',
        intentScore,
        leadTemperature,
        aiSummary: data.messageContext || 'No initial context',
      }
    });

    // Write to CRM
    await sheetsService.appendLeadRow([
      lead.name, lead.phone, lead.email || '', lead.source, lead.callStatus, 
      leadTemperature, intentScore.toString(), new Date().toISOString(), '', 'New'
    ]);
  } else {
    // If returning lead, bump interaction count
    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: { interactionCount: lead.interactionCount + 1 }
    });
  }

  // Pass control to Decision Brain
  await decisionQueue.add('evaluate-lead', { leadId: lead.id, triggerEvent: 'NEW_LEAD' });
  
  return lead;
}
