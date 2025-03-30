import { Kafka } from "kafkajs";
import * as dotenv from 'dotenv';
import logger from "../logger";
import OpenAI from "openai";
import * as cheerio from 'cheerio';
import { Article } from "../models/articles";
import { QdrantClient } from "@qdrant/js-client-rest";
import { randomUUID } from "crypto";

dotenv.config();

async function generateEmbedding(texto: string, openAiClient: OpenAI): Promise<number[]> {
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

async function main() {
    logger.info('Starting Rag...');

    logger.info('Open AI Connection...');
    const openAiClient = new OpenAI({
        apiKey: process.env['OPENAI_API_KEY'],
    });

    logger.info('Qdrant Connection and Config...');
    const qdrantClient = new QdrantClient({url: 'http://127.0.0.1:6333'});
    const responseCollections = await qdrantClient.getCollections();
    const collectionNames = responseCollections.collections.map((collection) => collection.name);
    if (collectionNames.includes("articles")) {
        logger.info('Collection already exists');
    } else {
        logger.info('Creating collection...');
        await qdrantClient.createCollection("articles", {
            vectors: {
                size: 1536,
                distance: "Cosine",
            },
            optimizers_config: {
              default_segment_number: 2,
            },
            replication_factor: 1,
        });
        logger.info('Collection created');
    }

    logger.info('kafta Connection and Config...');
    const kafka = new Kafka({
        clientId: process.env.KAFKA_CLIENT_ID as string,
        brokers: [process.env.KAFKA_BROKER as string],
        ssl: true,
        sasl: {
        mechanism: 'plain',
        username: process.env.KAFKA_USERNAME as string,
        password: process.env.KAFKA_PASSWORD as string
        }
    });

    const timestamp = Date.now();
    const consumerGroup = `${process.env.KAFKA_GROUP_ID_PREFIX}-consumer-${timestamp}`;

    const consumer = kafka.consumer({ 
        groupId: consumerGroup,
    });

    const shutdown = async () => {
        logger.info('Shutting down gracefully...');
        await consumer.disconnect();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        logger.info('Connecting to Kafka...');
        await consumer.connect();

        const topic = process.env.KAFKA_TOPIC_NAME;
        await consumer.subscribe({ topic: topic as string, fromBeginning: true });
        logger.info(`Subscribed to topic ${topic}`);

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                logger.debug('----------------------------------------');
            
            if (message.value) {  
                try {
                    const jsonData = JSON.parse(message.value.toString());
                    const url = jsonData.value.url;
                    logger.debug(`URL: ${url}`);
                    const responsePage = await fetch(url);
                    const htmlContent = await responsePage.text();
                    const $ = cheerio.load(htmlContent);
                    $('script, style').remove(); // Remove Scripts and CSS
                    const cleanHtml = $('body').text();

                    const response = await openAiClient.responses.create({
                        model: 'gpt-4o',
                        instructions: `
                            You are a assistant specialized in extracting data from HTML, your task is to extract the data and return it in JSON format with the following data and format which will be between three quotes.

                            """
                                {
                                    "title": "Title of the Article",
                                    "content": "Content of the Article",
                                    "url": "URL of the Article",
                                    "date": "Published date of the Article",
                                }
                            """
                        `,
                        input: `${cleanHtml}`,
                    });
                    const dataResponse = response.output_text;
                    const match = dataResponse.match(/```json\s*([\s\S]*?)\s*```/);
                    if (match && match[1]) {
                        const jsonString = match[1];
                        const jsonData: Article = JSON.parse(jsonString);
                        const embedding = await generateEmbedding(jsonData.content, openAiClient);
                        const id = randomUUID();
                        qdrantClient.upsert("articles", {
                            points: [
                                {
                                    id: id,
                                    vector: embedding,
                                    payload: {
                                        title: jsonData.title,
                                        content: jsonData.content,
                                        url: jsonData.url,
                                        datePublished: jsonData.datePublished,
                                    },
                                },
                            ],
                        })
                    } else {
                        throw new Error('No JSON data found in the response');
                    }
                    
                } catch (e) {
                logger.debug('Error parsing message value:', e);
                }
            } else {
                logger.debug('Empty message');
            }
    
            // Mostrar cabeçalhos se existirem
            if (message.headers && Object.keys(message.headers).length > 0) {
                logger.debug('Cabeçalhos:');
                for (const [key, value] of Object.entries(message.headers)) {
                    logger.debug(`  ${key}: ${value ? value.toString() : 'null'}`);
                }
            }
            
            logger.debug('----------------------------------------\n');
            },
        });

        logger.info('Consumer is running. Press Ctrl+C to exit.');
    } catch (error) {
        logger.error(`Error in consumer: ${error}`);
        process.exit(1);
    }
}

main()