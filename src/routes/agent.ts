import { Router } from "express";
import { Agent } from '../ai/agent';

const router = Router();

router.post("/", async (req, res) => {
  const { query } = req.body;
  const agent = new Agent()
  const {answer, source} = await agent.sendUserMessage(query)
  res.json({
    answer: answer,
    source: source,
  });
});

export default router;