// Node App starts from here

const mongoose = require("mongoose");
const config = require("./config/config");
const app = require("./app");
const logger = require("./config/logger");
let server;

logger.warn("--------------------------------------");

// Connect to DB first, then start the server
mongoose.connect(config.mongoose.url, config.mongoose.options).then(async () => {
  logger.info(`Connected to MongoDB => ${config.mongoose.url}`);
  logger.warn("--------------------------------------");

  try {
    // Migration block removed to preserve unique bed prices
  } catch (e) {
    logger.error("Failed to execute self-correcting bed price migration:", e);
  }

  // Start Cron Jobs
  const { startCronJobs } = require("./cron/scheduler");
  startCronJobs();

  server = app.listen(config.port, () => {
    logger.info(`Node server listening on port => ${config.port}`);
  });

}).catch((err) => {
  logger.error(`MongoDB connection failed: ${err.message}`);
  process.exit(1);
});

// Manually close the server if an unhandled exception occurs
const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('---------------------------------------------------')
      logger.info("Server closed");
      logger.info('---------------------------------------------------')
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

// Listen to unhandled exceptions and call handler when such exceptions occur
process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);

// Close the server if command received to close the server.
// E.g. Node process killed by OS or by the user using kill, pkill, task manager, etc.
process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  if (server) {
    server.close();
  }
});

// Handle Nodemon restarts
process.once("SIGUSR2", () => {
  if (server) {
    server.close(() => {
      process.kill(process.pid, "SIGUSR2");
    });
  } else {
    process.kill(process.pid, "SIGUSR2");
  }
});

// Handle Ctrl+C
process.on("SIGINT", () => {
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
 
