import { createLogger, format, transports } from 'winston';

// Define the log format
const customLogFormat = format.printf(({level, message, timestamp}) => {
    return `[${ new Date(timestamp).toLocaleString() }] ${level.toUpperCase()}: ${message}`;
})

const logger = createLogger({
    level:"http",
    format: format.combine(
        format.timestamp(),
        customLogFormat,
        // format.json()
    ),
    transports:[
        new transports.Console({
            level: 'error'
        }),
        new transports.File({filename: '../logs/error.log', level:'error'}),
        new transports.File({
            filename: '../logs/warn.log', 
            format: format.combine(
                format((info) => {
                    return info.level === 'warn' ? info : false
                })(),
                format.timestamp(),
                customLogFormat
            )
        }),
        new transports.File({
            filename: '../logs/http.log',
            format: format.combine(
                format((info) => {
                    // console.log(info);
                    return info.level === 'http' ? info : false
                })(),
                format.timestamp(),
                customLogFormat
            )
            // level: 'http',   // log everything at level 'http' and all higher priority levels
        }),
        new transports.File({filename: '../logs/combined.log',}),
    ]
})

logger.info('Logger initialized');
// logger.warn('This is a warning message');
// logger.error('This is an error message');
export default logger;