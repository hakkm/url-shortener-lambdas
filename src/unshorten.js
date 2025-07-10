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

  try {
    const query = event.queryStringParameters || {};
    let shortUrl = query.url;

    if (!shortUrl || typeof shortUrl !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing or invalid url" }),
      };
    }

    // Add https:// if the scheme is missing
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

    // Check hostname match
    if (parsedUrl.hostname !== BASE_HOSTNAME) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `URL hostname must be ${BASE_HOSTNAME}` }),
      };
    }

    // Remove base pathname prefix if any
    let shortId = parsedUrl.pathname.replace(BASE_PATHNAME, "").replace(/^\/+/, "");

    if (!shortId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No shortId found in URL" }),
      };
    }

    // Query DynamoDB
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { shortId },
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Short URL not found" }),
      };
    }

    const response = { longUrl: result.Item.longUrl };
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

