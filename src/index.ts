import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { webhookRouter } from './routes/webhooks';
import { startWorkers } from './queues/agentQueue';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/webhooks', webhookRouter);

app.get('/health', (req, res) => {
  res.send('Agentic Gym Lead System Status: OK');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startWorkers(); 
});
