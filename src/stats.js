const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "UrlShortenerTable";
const BASE_URL = process.env.BASE_URL || "https://short.aws.khabir-hakim.tech";
const { hostname: BASE_HOSTNAME, pathname: BASE_PATHNAME } = new URL(BASE_URL);

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event));

  // Support receiving URL in query string ?url=...
  let shortUrl = event.queryStringParameters?.url || event.url;

  if (!shortUrl || typeof shortUrl !== "string") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing or invalid url parameter" }),
    };
  }

  // Add scheme if missing (assume https)
  if (!shortUrl.match(/^https?:\/\//)) {
    shortUrl = `https://${shortUrl}`;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(shortUrl);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid URL format" }),
    };
  }

  if (parsedUrl.hostname !== BASE_HOSTNAME) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `URL must be for domain ${BASE_HOSTNAME}` }),
    };
  }

  // Extract shortId from pathname
  const shortId = parsedUrl.pathname.replace(BASE_PATHNAME, "").replace(/^\/+/, "");

  if (!shortId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Short ID not found in URL" }),
    };
  }

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { shortId },
        ProjectionExpression: "clickCount, lastAccessed",
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Short URL not found" }),
      };
    }

    const { clickCount = 0, lastAccessed = null } = result.Item;

    return {
      statusCode: 200,
      body: JSON.stringify({ totalClicks: clickCount, lastAccessed }),
    };
  } catch (err) {
    console.error("Error fetching stats:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
