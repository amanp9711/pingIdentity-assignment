import express from 'express';
import cors from 'cors';
import { loadData } from './store';
import requestsRouter from './routes/requests';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/requests', requestsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

loadData();

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});

export default app;