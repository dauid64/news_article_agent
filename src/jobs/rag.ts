import { Consumer, Kafka } from "kafkajs";
import * as dotenv from 'dotenv';
import logger from "../logger";
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { randomUUID } from "crypto";
import { CleanHTMLAgent } from "../ai/cleanHTMLAgent";
import { split_text } from "../ai/splitter";

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

async function connectOpenAI(): Promise<OpenAI> {
    const openAiClient = new OpenAI({
        apiKey: process.env['OPENAI_API_KEY'],
    });
    return openAiClient;
}

async function connectQdrant(): Promise<QdrantClient> {
    const qdrantClient = new QdrantClient({url: 'http://127.0.0.1:6333'});

    return qdrantClient;
}

async function create_collection_if_not_exists(qdrantClient: QdrantClient, collectionName: string) {
    const responseCollections = await qdrantClient.getCollections();
    const collectionNames = responseCollections.collections.map((collection) => collection.name);
    if (collectionNames.includes(collectionName)) {
        logger.info('Collection already exists');
    } else {
        logger.info('Creating collection...');
        await qdrantClient.createCollection(collectionName, {
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
}

async function connectKafkaAndConfig(): Promise<Consumer> {
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

    return consumer
}

async function main() {
    logger.info('Starting Rag...');

    logger.info('Open AI Connection...');
    const openAiClient = await connectOpenAI();

    logger.info('Qdrant Connection and Create Colletion...');
    const qdrantClient = await connectQdrant();
    await create_collection_if_not_exists(qdrantClient, 'articles');

    logger.info('kafta Config...');
    const consumer = await connectKafkaAndConfig();

    const cleanHTMLAgent = new CleanHTMLAgent();

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
                        // Parse the message value
                        const jsonData = JSON.parse(message.value.toString());
                        const url = jsonData.value.url;
                        logger.debug(`URL: ${url}`);

                        // Fetch the HTML content from the URL
                        const responsePage = await fetch(url);
                        const htmlContent = await responsePage.text();
                        const article = await cleanHTMLAgent.extractDataFromHTML(htmlContent)

                        // Split text, generate embedding and upsert into Qdrant
                        const texts_splitted = await split_text(article.content);
                        texts_splitted.forEach(async (content) => {
                            const embedding = await generateEmbedding(content, openAiClient);

                            const id = randomUUID();
                            qdrantClient.upsert("articles", {
                                points: [
                                    {
                                        id: id,
                                        vector: embedding,
                                        payload: {
                                            title: article.title,
                                            content: article.content,
                                            url: article.url,
                                            datePublished: article.datePublished,
                                        },
                                    },
                                ],
                            })
                        })
                    } catch (e) {
                    logger.debug('Error parsing message value:', e);
                    }
                } else {
                    logger.debug('Empty message');
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