import { QdrantClient } from "@qdrant/js-client-rest";
import logger from "../logger";
import OpenAI from "openai";
import { Article } from "../models/articles";

export class Agent {
    readonly client: OpenAI;
    readonly qdrantClient: any;

    constructor() {
        logger.debug("Agent initialized");
        
        this.client = new OpenAI({
                apiKey: process.env['OPENAI_API_KEY'],
        });
        this.qdrantClient = new QdrantClient({url: 'http://127.0.0.1:6333'});
    }

    private async generateEmbedding(texto: string, openAiClient: OpenAI): Promise<number[]> {
        try {
          const response = await openAiClient.embeddings.create({
            model: 'text-embedding-3-small',
            input: texto,
          });
          
          return response.data[0].embedding;
        } catch (error) {
          console.error('Error generate Embedding:', error);
          throw error;
        }
    }

    public async sendUserMessage(userMessageContents: string): Promise<{answer: string, source: Article}> {
        try {
            logger.debug('Sending user message:', userMessageContents);
            const queryEmbedding = await this.generateEmbedding(userMessageContents, this.client);

            const result = await this.qdrantClient.search('articles', {
                vector: queryEmbedding,
                limit: 1,
                with_payload: true,
            });
            const source: Article = result[0].payload;

            const response = await this.client.responses.create({
                model: 'gpt-4o',
                instructions: `
                    You are a assistant who specializes in answering article-based questions. The user will submit their question to you, and below it, a reference article will be provided for you to use in your answer. The article will be provided in the following JSON format that is enclosed in three quotation marks.

                    """
                        {
                            "title": "Title of the Article",
                            "content": "Content of the Article",
                            "url": "URL of the Article",
                            "date": "Published date of the Article",
                        }
                    """

                    You must answer the question based on the article, but do not reference the article to the user. Respond in a polite and direct manner. If you don't find the information from the provided article useful, simply respond that you couldn't find any relevant information.
                `,
                input: `${userMessageContents}\n ${JSON.stringify(source)}`,
            });

            const answer = response.output_text;
            logger.debug('Received answer:', answer);

            return {answer, source};
        } catch (error) {
            logger.error('Error in sendUserMessage:', error);
            throw error;
        }
    }
}