import { Queue, Worker } from 'bullmq';
import { redisConnection } from './redisClient';
import { processDecisionJob } from '../agents/decisionAgent';
import { processWhatsappJob } from '../agents/whatsappAgent';

export const decisionQueue = new Queue('decision-queue', { connection: redisConnection });
export const whatsappQueue = new Queue('whatsapp-queue', { connection: redisConnection });
export const voiceQueue = new Queue('voice-queue', { connection: redisConnection });

export function startWorkers() {
  console.log('>>> [STARTUP] Starting AI Workers...');

  new Worker('decision-queue', async (job) => {
    await processDecisionJob(job.data.leadId, job.data.triggerEvent);
  }, { connection: redisConnection });

  new Worker('whatsapp-queue', async (job) => {
    await processWhatsappJob(job.data.leadId, job.data.instruction, job.data.context);
  }, { connection: redisConnection });

  console.log('>>> [SUCCESS] AI Workers are now ACTIVE and listening to the Cloud Box!');
}
