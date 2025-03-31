import { QdrantClient } from "@qdrant/js-client-rest";
import logger from "../logger";
import OpenAI from "openai";
import { Article } from "../models/articles";
import { FunctionTool, ResponseFunctionToolCall } from "openai/resources/responses/responses";
import { CleanHTMLAgent } from "./cleanHTMLAgent";

const tools = [{
  "type": "function",
  "name": "get_link_content",
  "description": "Get content from a link.",
  "parameters": {
      "type": "object",
      "properties": {
          "url": {
              "type": "string",
              "description": "The URL to get content from.",
          }
      },
      "required": [
          "url"
      ],
      "additionalProperties": false
  },
  "strict": true
}] as FunctionTool[];

export class ChatAgent {
    readonly client: OpenAI;
    readonly qdrantClient: QdrantClient;
    readonly systemPrompt: string;

    constructor() {
        logger.debug("Agent initialized");
        
        this.client = new OpenAI({
                apiKey: process.env['OPENAI_API_KEY'],
        });
        this.qdrantClient = new QdrantClient({url: 'http://127.0.0.1:6333'});
        
        this.systemPrompt = `
        You are a assistant who specializes in answering article-based questions. The user will submit their question to you, and below it, a reference article will be provided for you to use in your answer. The article will be provided in the following JSON format that is enclosed in three quotation marks.

        """
            {
                "title": "Title of the Article",
                "content": "Content of the Article",
                "url": "URL of the Article",
                "date": "Published date of the Article",
            }
        """

        You should answer the question based on the article, but do not refer the user to the article. Answer politely and directly. If you do not find the information in the article provided useful, simply respond that you could not find any relevant information. If the user provides a link, please call tool web_search_preview for the link provided and provide the answer to the question.
        `
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

    private static isArticle(payload: any): payload is Article {
        return (
            payload &&
            typeof payload.title === 'string' &&
            typeof payload.content === 'string' &&
            typeof payload.url === 'string' &&
            typeof payload.datePublished === 'string'
        );
    }

    private async get_link_content(url: string): Promise<Article> {
        const cleanHTMLAgent = new CleanHTMLAgent();
        const responsePage = await fetch(url);
        const htmlContent = await responsePage.text();
        const source = await cleanHTMLAgent.extractDataFromHTML(htmlContent);
        return source;
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

            const payload = result[0].payload;
            if (!payload || !ChatAgent.isArticle(payload)) {
                throw new Error('No valid article found in payload');
            }

            let source: Article = payload;

            const response = await this.client.responses.create({
                model: 'gpt-4o',
                instructions: this.systemPrompt,
                input: `${userMessageContents}\n ${JSON.stringify(source)}`,
                tools: tools,
                tool_choice: "auto"
            });

            let answer = response.output_text;
            if (answer === '' && response.output.length > 0) {
              const functionaName = (response.output[0] as ResponseFunctionToolCall).name;
              const functionArgs = JSON.parse((response.output[0] as ResponseFunctionToolCall).arguments);
              
              if (functionaName === 'get_link_content') {
                const url = functionArgs.url;
                source = await this.get_link_content(url);
                const response = await this.client.responses.create({
                    model: 'gpt-4o',
                    instructions: this.systemPrompt,
                    input: `${userMessageContents}\n ${JSON.stringify(source)}`,
                });
                answer = response.output_text;
              } else {
                throw new Error(`Unknown function name: ${functionaName}`);
              }
            }
            logger.debug(`Received answer: ${answer}`);

            return {answer, source};
        } catch (error) {
            logger.error('Error in sendUserMessage:', error);
            throw error;
        }
    }
}