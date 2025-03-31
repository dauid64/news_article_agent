import { Router } from "express";
import { ChatAgent } from '../ai/chatAgent';

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    const agent = new ChatAgent()
    const answer = await agent.sendUserMessage(query)
    res.json(answer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while processing your request." });
  }
});

export default router;