import { Router, Request, Response } from 'express';
import { processNewLead } from '../agents/leadIntakeAgent';
import { prisma } from '../services/db';
import { decisionQueue } from '../queues/queueDefinitions'; 

export const webhookRouter = Router();

webhookRouter.post('/lead', async (req: Request, res: Response) => {
  try {
    const lead = await processNewLead(req.body);
    res.status(200).json({ success: true, leadId: lead.id });
  } catch (error: any) {
    console.error('Webhook Lead Error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

webhookRouter.post('/voice', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (payload.message && payload.message.type === 'end-of-call-report') {
      const callData = payload.message;
      const metadata = callData.call?.metadata;
      if (metadata && metadata.leadId) {
        const leadId = metadata.leadId;
        const callStatus = callData.endedReason === 'customer-hung-up' || callData.endedReason === 'assistant-hung-up' ? 'Called_Answered' : 'Called_Unanswered';
        const summary = callData.summary || 'No summary available';
        await prisma.callLog.create({ data: { leadId, status: callStatus, notes: summary } });
        await prisma.lead.update({ where: { id: leadId }, data: { callStatus } });
        await decisionQueue.add('evaluate-lead', { leadId, triggerEvent: 'VOICE_CALL_ENDED' });
      }
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook Voice Error:', error);
    res.status(500).send('Error');
  }
});

webhookRouter.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    const { From, Body } = req.body;
    const cleanPhone = From.replace('whatsapp:', '');
    console.log(`[WhatsApp Webhook] Message from: ${cleanPhone}`);

    let lead = await prisma.lead.findUnique({ where: { phone: cleanPhone } });
    if (!lead) {
      lead = await processNewLead({ name: "Unknown WhatsApp", phone: cleanPhone, source: "Inbound WhatsApp", messageContext: Body });
    }

    await prisma.messageLog.create({ data: { leadId: lead.id, direction: 'Inbound', content: Body } });
    await prisma.lead.update({ where: { id: lead.id }, data: { interactionCount: lead.interactionCount + 1 } });

    console.log(`[Webhook] Sending ${cleanPhone} to the AI Brain...`);
    await decisionQueue.add('evaluate-lead', { leadId: lead.id, triggerEvent: 'WHATSAPP_REPLY' });

    res.status(200).send('<Response></Response>'); 
  } catch (error) {
    console.error('Webhook WhatsApp Error:', error);
    res.status(500).send('Error');
  }
});
