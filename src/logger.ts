import winston from 'winston';


const logFormat = winston.format.printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
  });

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.label({ label: 'news_article_agent' }),
        winston.format.timestamp(),
        logFormat
    ),
    transports: [
        new winston.transports.Console({ forceConsole: true }),
    ]
})

export default logger;