import { Worker } from 'bullmq';
import { redisConnection } from './redisClient';
import { processDecisionJob } from '../agents/decisionAgent';
import { processWhatsappJob } from '../agents/whatsappAgent';

export function startWorkers() {
  console.log('>>> [STARTUP] AI Workers are waking up...');

  // The Decision Worker
  new Worker('decision-queue', async (job) => {
    console.log(`[Queue] Processing Decision for Lead: ${job.data.leadId}`);
    await processDecisionJob(job.data.leadId, job.data.triggerEvent);
  }, { connection: redisConnection });

  // The WhatsApp Worker
  new Worker('whatsapp-queue', async (job) => {
    console.log(`[Queue] Sending WhatsApp for Lead: ${job.data.leadId}`);
    await processWhatsappJob(job.data.leadId, job.data.instruction, job.data.context);
  }, { connection: redisConnection });

  console.log('>>> [SUCCESS] AI Workers are 100% ONLINE!');
}
