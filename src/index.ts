import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { webhookRouter } from './routes/webhooks';
import { startWorkers } from './queues/agentQueue';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Twilio sends webhooks as application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/webhooks', webhookRouter);

app.get('/health', (req, res) => {
  res.send('Agentic Gym Lead System Status: OK');
});

// Start Server & Queue Workers
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Initialize BullMQ Agent Workers
  startWorkers(); 
});
