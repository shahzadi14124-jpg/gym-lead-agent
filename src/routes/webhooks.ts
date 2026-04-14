import { Router, Request, Response } from 'express';
import { processNewLead } from '../agents/leadIntakeAgent';
import { prisma } from '../services/db';
import { decisionQueue } from '../queues/queueDefinitions'; 

export const webhookRouter = Router();

webhookRouter.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    const { From, Body } = req.body;
    const cleanPhone = From.replace('whatsapp:', '');

    let lead = await prisma.lead.findUnique({ where: { phone: cleanPhone } });
    if (!lead) {
      lead = await processNewLead({ name: "Unknown WhatsApp", phone: cleanPhone, source: "Inbound WhatsApp", messageContext: Body });
    }

    await prisma.messageLog.create({ data: { leadId: lead.id, direction: 'Inbound', content: Body } });
    await prisma.lead.update({ where: { id: lead.id }, data: { interactionCount: lead.interactionCount + 1 } });

    await decisionQueue.add('evaluate-lead', { leadId: lead.id, triggerEvent: 'WHATSAPP_REPLY' });

    res.status(200).send('<Response></Response>'); 
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).send('Error');
  }
});
