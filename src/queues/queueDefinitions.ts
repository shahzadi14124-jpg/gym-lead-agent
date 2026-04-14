import { Queue } from 'bullmq';
import { redisConnection } from './redisClient';

export const decisionQueue = new Queue('decision-queue', { connection: redisConnection });
export const whatsappQueue = new Queue('whatsapp-queue', { connection: redisConnection });
export const voiceQueue = new Queue('voice-queue', { connection: redisConnection });
