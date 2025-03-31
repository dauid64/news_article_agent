import logger from "../logger";
import OpenAI from "openai";
import { Article } from "../models/articles";
import * as cheerio from 'cheerio';
import { ResponseTextConfig } from "openai/resources/responses/responses";

export class CleanHTMLAgent{
    readonly client: OpenAI;
    readonly qdrantClient: any;
    readonly systemPrompt: string;
    readonly text: ResponseTextConfig;

    constructor() {
        logger.debug("Agent initialized");
        
        this.client = new OpenAI({
                apiKey: process.env['OPENAI_API_KEY'],
        });

        this.systemPrompt = `
            You are a assistant specialized extract data from articles that are in HTML format.
        `

        this.text = {
            format: {
                "type": "json_schema",
                "name": "article",
                "schema": {
                    "type": "object",
                    "properties": {
                        "article": {
                            "type": "object",
                            "properties": {
                                "title": {
                                    "type": "string",
                                    "description": "Title of the article.",
                                },
                                "content": {
                                    "type": "string",
                                    "description": "Content of the article.",
                                },
                                "url": {
                                    "type": "string",
                                    "description": "URL of the article.",
                                },
                                "datePublished": {
                                    "type": "string",
                                    "description": "Date published of the article.",
                                }
                            },
                            "required": ["title", "content", "url", "datePublished"],
                            "additionalProperties": false
                        }
                    },
                    "required": ["article"],
                    "additionalProperties": false // <- adicionado aqui
                }
            }
        }
    }

    async extractDataFromHTML(htmlContent: string): Promise<Article> {
        const $ = cheerio.load(htmlContent);
        $('script, style').remove(); // Remove Scripts and CSS
        const cleanHtml = $('body').text();
        
        // Use OpenAI to extract data from the HTML
        const response = await this.client.responses.create({
            model: 'gpt-4o',
            instructions: this.systemPrompt,
            input: `${cleanHtml}`,
            text: this.text,
        });

        const dataResponse = response.output_text;
        
        return JSON.parse(dataResponse) as Article;
    }
}