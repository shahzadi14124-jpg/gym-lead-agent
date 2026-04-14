import { Queue, Worker } from 'bullmq';
import { createRedisConnection } from './redisClient';
import { processDecisionJob } from '../agents/decisionAgent';
import { processWhatsappJob } from '../agents/whatsappAgent';

export let decisionQueue: Queue;
export let whatsappQueue: Queue;
export let voiceQueue: Queue;

export function startWorkers() {
  console.log('>>> [STARTUP] Initializing Agent Queues...');
  
  decisionQueue = new Queue('decision-queue', { connection: createRedisConnection() });
  whatsappQueue = new Queue('whatsapp-queue', { connection: createRedisConnection() });
  voiceQueue = new Queue('voice-queue', { connection: createRedisConnection() });

  console.log('>>> [STARTUP] Launching AI Workers...');

  new Worker('decision-queue', async (job) => {
    const { leadId, triggerEvent } = job.data;
    await processDecisionJob(leadId, triggerEvent);
  }, { connection: createRedisConnection() });

  new Worker('whatsapp-queue', async (job) => {
    const { leadId, instruction, context } = job.data;
    await processWhatsappJob(leadId, instruction, context);
  }, { connection: createRedisConnection() });

  console.log('>>> [STARTUP] Agent Workers are now ACTIVE and listening to Redis!');
}
