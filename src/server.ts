import express from 'express';
import agentRouter from './routes/agent';
import logger from './logger';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());

app.use(`/agent`, agentRouter);

app.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
});