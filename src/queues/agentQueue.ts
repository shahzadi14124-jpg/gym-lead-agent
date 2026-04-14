import { Queue, Worker } from 'bullmq';
import { redisConnection } from './redisClient';
import { processDecisionJob } from '../agents/decisionAgent';
import { processWhatsappJob } from '../agents/whatsappAgent';

console.log('>>> [STARTUP] Booting up Decision Queues...');

export const decisionQueue = new Queue('decision-queue', { connection: redisConnection });
export const whatsappQueue = new Queue('whatsapp-queue', { connection: redisConnection });
export const voiceQueue = new Queue('voice-queue', { connection: redisConnection });

export function startWorkers() {
  console.log('>>> [STARTUP] AI Workers are waking up...');

  new Worker('decision-queue', async (job) => {
    console.log(`[Queue] Caught Job for Lead ${job.data.leadId}`);
    await processDecisionJob(job.data.leadId, job.data.triggerEvent);
  }, { connection: redisConnection });

  new Worker('whatsapp-queue', async (job) => {
    console.log(`[Queue] Sending WhatsApp for Lead ${job.data.leadId}`);
    await processWhatsappJob(job.data.leadId, job.data.instruction, job.data.context);
  }, { connection: redisConnection });

  console.log('>>> [SUCCESS] AI Workers are 100% ACTIVE!');
}
