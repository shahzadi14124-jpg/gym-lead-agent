import { Router, Request, Response } from 'express';
import { processNewLead } from '../agents/leadIntakeAgent';
import { prisma } from '../services/db';
import { decisionQueue } from '../queues/agentQueue'; // This is now a "let" variable

export const webhookRouter = Router();

// ... (keep all your existing /lead and /voice routes exactly as they are) ...

webhookRouter.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    const { From, Body } = req.body;
    const cleanPhone = From.replace('whatsapp:', '');
    
    let lead = await prisma.lead.findUnique({ where: { phone: cleanPhone } });
    
    if (!lead) {
      lead = await processNewLead({ 
        name: "Unknown WhatsApp", 
        phone: cleanPhone, 
        source: "Inbound WhatsApp",
        messageContext: Body 
      });
    }

    await prisma.messageLog.create({
      data: { leadId: lead.id, direction: 'Inbound', content: Body }
    });

    // SAFETY CHECK: Make sure the queue is ready before adding
    if (decisionQueue) {
      console.log(`[Webhook] Adding Job to Decision Queue for ${cleanPhone}`);
      await decisionQueue.add('evaluate-lead', { leadId: lead.id, triggerEvent: 'WHATSAPP_REPLY' });
    } else {
      console.error('[CRITICAL] Decision Queue is not initialized yet!');
    }

    res.status(200).send('<Response></Response>'); 
  } catch (error) {
    console.error('Webhook WhatsApp Error:', error);
    res.status(500).send('Error');
  }
});
