//winston dependencies
const { createLogger, format, transports } = require("winston");
const { combine, timestamp, splat, colorize, uncolorize, printf } = format;

const config = require("./config");
const path = require("path");

const enumerateErrorFormat = format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

const logger = createLogger({
  level: config.env === "development" ? "debug" : "info",
  format: combine(
    enumerateErrorFormat(),
    config.env === "development" ? colorize() : uncolorize(),
    splat(),
    // timestamp({ format: "YYYY/MM/DD HH:mm:ss" }),
    timestamp({ format: "HH:mm:ss" }),
    printf(
      ({ level, message, timestamp, label }) =>
        `${timestamp} : ${level} : ${message}`
    )
  ),
  transports: [
    new transports.Console({
      stderrLevels: ["error"],
    }),
  ],
});

module.exports = logger;

/**

 * SUBFORMATS:
 *
 * winston.format.splat():
 * This format enables string interpolation for log messages.
 *
 * winston.format.printf(...):
 * This format defines how each log entry should be formatted.
 *
 * Transports define where the log messages will be sent.
 */
