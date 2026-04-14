import { Queue, Worker } from 'bullmq';
import { createRedisConnection } from './redisClient';
import { processDecisionJob } from '../agents/decisionAgent';
import { processWhatsappJob } from '../agents/whatsappAgent';

// Open separate "phone lines" for each queue
export const decisionQueue = new Queue('decision-queue', { connection: createRedisConnection() });
export const whatsappQueue = new Queue('whatsapp-queue', { connection: createRedisConnection() });
export const voiceQueue = new Queue('voice-queue', { connection: createRedisConnection() });

// Start the AI workers with their own connections
export function startWorkers() {
  console.log('Starting Agent Workers...');

  new Worker('decision-queue', async (job) => {
    const { leadId, triggerEvent } = job.data;
    await processDecisionJob(leadId, triggerEvent);
  }, { connection: createRedisConnection() });

  new Worker('whatsapp-queue', async (job) => {
    const { leadId, instruction, context } = job.data;
    await processWhatsappJob(leadId, instruction, context);
  }, { connection: createRedisConnection() });

  new Worker('voice-queue', async (job) => {
    const { leadId } = job.data;
    const { prisma } = await import('../services/db');
    const { voiceService } = await import('../services/voiceService');
    
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead && lead.phone) {
      await voiceService.initiateCall(lead.phone, lead.name, lead.id);
    }
  }, { connection: createRedisConnection() });
}
