require("dotenv").config();
const fastify = require("fastify")({ logger: true });
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Instagram API configuration
const INSTAGRAM_API_VERSION = "v22.0";
const INSTAGRAM_API_URL = "https://graph.instagram.com";

// Instagram accounts configuration
const INSTAGRAM_ACCOUNTS = {
  "17841401533576017": {
    id: "17841401533576017",
    // The token will be fetched from environment variable token_17841401533576017
  },
};

// Function to get account token
const getAccountToken = (accountId) => {
  const tokenEnvKey = `token_${accountId}`;
  const token = process.env[tokenEnvKey];
  if (!token) {
    throw new Error(`Token not found for account ${accountId}`);
  }
  return token;
};

// Function to send message to Instagram
const sendInstagramMessage = async (recipientId, text, fromAccountId) => {
  if (!INSTAGRAM_ACCOUNTS[fromAccountId]) {
    throw new Error(`Account ${fromAccountId} not configured`);
  }

  const url = `${INSTAGRAM_API_URL}/${INSTAGRAM_API_VERSION}/${fromAccountId}/messages`;
  const token = getAccountToken(fromAccountId);

  try {
    const response = await axios.post(
      url,
      {
        recipient: { id: recipientId },
        message: { text },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    fastify.log.info("Message sent successfully:", response.data);
    return response.data;
  } catch (error) {
    fastify.log.error(
      "Error sending message:",
      error.response?.data || error.message
    );
    throw error;
  }
};

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

    // Process the message if it exists
    if (webhookEvent.object === "instagram" && webhookEvent.entry) {
      for (const entry of webhookEvent.entry) {
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            // Only process if it's a message and not an echo
            if (messagingEvent.message && !messagingEvent.message.is_echo) {
              const senderId = messagingEvent.sender.id;
              const recipientId = messagingEvent.recipient.id;

              // Only respond if we have this account configured
              if (INSTAGRAM_ACCOUNTS[recipientId]) {
                // Send "oii" as a response
                try {
                  await sendInstagramMessage(senderId, "oii", recipientId);
                  fastify.log.info(
                    "Sent response message to:",
                    senderId,
                    "from account:",
                    recipientId
                  );
                } catch (error) {
                  fastify.log.error("Error sending response:", error);
                }
              } else {
                fastify.log.warn(
                  "Received message for unconfigured account:",
                  recipientId
                );
              }
            }
          }
        }
      }
    }
  } catch (error) {
    fastify.log.error("Error processing webhook event:", error);
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
