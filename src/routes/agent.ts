import { Router } from "express";
import { Agent } from '../ai/agent';

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    const agent = new Agent()
    const {answer, source} = await agent.sendUserMessage(query)
    res.json({
      answer: answer,
      source: source,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while processing your request." });
  }
});

export default router;