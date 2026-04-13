import cron from 'node-cron';
import { prisma } from '../services/db';
import { whatsappService } from '../services/whatsappService';

const STAGE_DELAYS_DAYS: Record<number, number> = {
  0: 1,  // After day 0 message, wait 1 day
  1: 2,  // After day 1 message, wait 2 days -> day 3
  3: 4,  // After day 3 message, wait 4 days -> day 7
  7: 7,  // After day 7 message, wait 7 days -> day 14
  14: -1 // Stop
};

export function startFollowUpCron() {
  // Run every 10 minutes to process follow-ups
  cron.schedule('*/10 * * * *', async () => {
    console.log('[CRON] Running scheduled follow-ups...');
    
    try {
      const now = new Date();
      
      // Find leads that are due for follow-up and haven't converted or died
      const readyLeads = await prisma.lead.findMany({
        where: {
          nextFollowUpDate: { lte: now },
          leadStatus: { notIn: ['Dead', 'Converted', 'Visited'] }
        }
      });

      for (const lead of readyLeads) {
        if (lead.followUpStage >= 14) continue; // Should already be marked, but guard just in case

        let messageBody = '';
        const stage = lead.followUpStage;

        // Construct message based on current stage
        switch (stage) {
          case 0:
            messageBody = `Hi ${lead.name}, this is the team at the Gym! Thanks for your interest. Did you have any questions about our memberships?`;
            break;
          case 1:
            messageBody = `Hey ${lead.name}, quick reminder about our 7-day free trial. Would you like me to book you in for a tour?`;
            break;
          case 3:
            messageBody = `Hi ${lead.name}, just checking in! Let me know if you need any help hitting your fitness goals.`;
            break;
          case 7:
            messageBody = `Hey ${lead.name}, our special enrollment offer is expiring soon. Don't miss out!`;
            break;
          case 14:
            messageBody = `Hi ${lead.name}, I won't bug you anymore! If you're ever ready to start your fitness journey, we'll be here.`;
            break;
        }

        if (messageBody) {
          // Send WhatsApp
          await whatsappService.sendMessage(lead.phone, messageBody);
          await prisma.messageLog.create({
            data: { leadId: lead.id, direction: 'Outbound', content: messageBody }
          });
        }

        // Calculate next stage and date
        let nextStage = stage <= 0 ? 1 : (stage <= 1 ? 3 : (stage <= 3 ? 7 : 14));
        if (stage === 14) nextStage = 15; // Done

        let nextDate = null;
        if (STAGE_DELAYS_DAYS[stage] !== -1) {
          nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + STAGE_DELAYS_DAYS[stage]);
        }

        const newLeadStatus = nextStage > 14 ? 'Dead' : lead.leadStatus;

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            followUpStage: nextStage,
            nextFollowUpDate: nextDate,
            leadStatus: newLeadStatus,
            lastContacted: now
          }
        });

        console.log(`[CRON] Processed Stage ${stage} follow-up for lead ${lead.id}`);
      }

    } catch (err) {
      console.error('[CRON] Error processing follow ups:', err);
    }
  });

  console.log('Follow-up cron scheduler initialized.');
}
