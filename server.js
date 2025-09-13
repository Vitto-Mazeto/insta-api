require("dotenv").config();
const fastify = require("fastify")({ logger: true });
const fs = require("fs");
const path = require("path");

// Webhook verification token (you should set this in .env file)
const VERIFY_TOKEN =
  process.env.WEBHOOK_VERIFY_TOKEN || "your_random_verify_token";

// Function to log webhook events
const logWebhookEvent = (event) => {
  const timestamp = new Date().toISOString();
  const logFileName = `webhook_${timestamp.split("T")[0]}.txt`;
  const logFilePath = path.join(__dirname, "logs", logFileName);

  const logEntry = `
=== Webhook Event ${timestamp} ===
${JSON.stringify(event, null, 2)}
=====================================

`;

  fs.appendFileSync(logFilePath, logEntry);
};

// Webhook validation route
fastify.get("/webhook", async (request, reply) => {
  // Get the query parameters
  const mode = request.query["hub.mode"];
  const token = request.query["hub.verify_token"];
  const challenge = request.query["hub.challenge"];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      fastify.log.info("WEBHOOK_VERIFIED");
      return challenge;
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      reply.code(403).send("Forbidden");
    }
  }
});

// Webhook POST route
fastify.post("/webhook", async (request, reply) => {
  const webhookEvent = request.body;

  // Log the webhook event
  try {
    logWebhookEvent(webhookEvent);
    fastify.log.info("Webhook event logged successfully");
  } catch (error) {
    fastify.log.error("Error logging webhook event:", error);
  }

  // Return a 200 OK response
  return { status: "ok" };
});

// Default route
fastify.get("/", async (request, reply) => {
  return { message: "Hello World" };
});

// Run the server!
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
