// ... existing code at the top ...

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

    // We add it to the Decision Brain here!
    console.log(`[Webhook] Sending ${cleanPhone} to the AI Brain...`);
    await decisionQueue.add('evaluate-lead', { leadId: lead.id, triggerEvent: 'WHATSAPP_REPLY' });

    res.status(200).send('<Response></Response>'); 
  } catch (error) {
    console.error('Webhook WhatsApp Error:', error);
    res.status(500).send('Error');
  }
});
