import { Queue, Worker } from 'bullmq';
import { createRedisConnection } from './redisClient';

// Import our agents (to be implemented)
import { processDecisionJob } from '../agents/decisionAgent';
import { processWhatsappJob } from '../agents/whatsappAgent';

// Queues
export const decisionQueue = new Queue('decision-queue', { connection: createRedisConnection() });
export const whatsappQueue = new Queue('whatsapp-queue', { connection: createRedisConnection() });
export const voiceQueue = new Queue('voice-queue', { connection: createRedisConnection() });

// Workers to process the queues
export function startWorkers() {
  console.log('Starting Agent Workers...');

  // 1. Decision Worker: Decides what actions to take on a lead
  const decisionWorker = new Worker('decision-queue', async (job) => {
    const { leadId, triggerEvent } = job.data;
    await processDecisionJob(leadId, triggerEvent);
  }, { connection: createRedisConnection() });

  // 2. WhatsApp Worker: Formats and sends WhatsApp messages
  const whatsappWorker = new Worker('whatsapp-queue', async (job) => {
    const { leadId, instruction, context } = job.data;
    await processWhatsappJob(leadId, instruction, context);
  }, { connection: createRedisConnection() });

  // 3. Voice Worker: Triggers Vapi outbound calls
  const voiceWorker = new Worker('voice-queue', async (job) => {
    const { leadId } = job.data;
    const { prisma } = await import('../services/db');
    const { voiceService } = await import('../services/voiceService');
    
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead && lead.phone) {
      await voiceService.initiateCall(lead.phone, lead.name, lead.id);
    }
  }, { connection: createRedisConnection() });

  // Error logging
  decisionWorker.on('error', err => {});
  whatsappWorker.on('error', err => {});
  voiceWorker.on('error', err => {});
}
