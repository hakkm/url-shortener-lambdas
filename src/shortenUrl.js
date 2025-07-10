const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand
} = require("@aws-sdk/lib-dynamodb");
const { randomBytes } = require("crypto");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "UrlShortenerTable";
const BASE_URL = process.env.BASE_URL || "https://short.aws.khabir-hakim.tech";

function generateBase62Id(length = 4) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    const randIndex = Math.floor(Math.random() * chars.length);
    id += chars[randIndex];
  }
  return id;
}

async function generateUniqueShortId() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortId = generateBase62Id(4); // 4-character base62 ID

    const existing = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { shortId },
      })
    );

    if (!existing.Item) return shortId;
  }
  throw new Error("Could not generate a unique short ID after 5 attempts");
}

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event));

  try {
    // Flexible input parsing: supports both raw and stringified JSON
    let body;
    try {
      body =
        typeof event.body === "string"
          ? JSON.parse(event.body)
          : event.body || event;
    } catch (parseErr) {
      console.error("Error parsing body:", parseErr);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }

    const longUrl = body.url;
    if (!longUrl || typeof longUrl !== "string") {
      console.error("Missing or invalid url:", longUrl);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing or invalid url" }),
      };
    }

    const shortId = await generateUniqueShortId();

    const item = {
      shortId,
      longUrl,
      clickCount: 0,
      lastAccessed: null,
      expirationTime: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // TTL: 30 days
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    const response = {
      shortUrl: `${BASE_URL}/${shortId}`,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (err) {
    console.error("Unhandled error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
