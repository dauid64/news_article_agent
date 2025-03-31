import logger from "../logger";
import OpenAI from "openai";
import { Article } from "../models/articles";
import * as cheerio from 'cheerio';

export class CleanHTMLAgent{
    readonly client: OpenAI;
    readonly qdrantClient: any;
    readonly systemPrompt: string;

    constructor() {
        logger.debug("Agent initialized");
        
        this.client = new OpenAI({
                apiKey: process.env['OPENAI_API_KEY'],
        });

        this.systemPrompt = `
            You are a assistant specialized in extracting data from HTML, your task is to extract the data and return it in JSON format with the following data and format which will be between three quotes.

            """
                {
                    "title": "Title of the Article",
                    "content": "Content of the Article",
                    "url": "URL of the Article",
                    "datePublished": "Published date of the Article",
                }
            """
        `
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
        });

        const dataResponse = response.output_text;
        const match = dataResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
            const jsonString = match[1];
            const article: Article = JSON.parse(jsonString);
            return article
        } else {
            throw new Error('No JSON data found in the response');
        }
    }
}