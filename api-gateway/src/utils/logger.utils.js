import { createLogger, format, transports } from 'winston';
import LokiTransport from 'winston-loki';

// log format
const customLogFormat = format.printf(({level, message, timestamp}) => {
    return `[${ new Date(timestamp).toLocaleString() }] ${level.toUpperCase()}: ${message}`;
})

const logger = createLogger({
    level:"debug",
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
        }),
        new transports.File({filename: '../logs/combined.log',}),
        new LokiTransport({
            labels: { app: 'api-gateway' },
            host: `http://${process.env.IP}:3100`,
            onConnectionError: (err) => console.error(err),
        })
    ]
})

logger.info('Logger initialized');
export default logger;