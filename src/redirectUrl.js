const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "UrlShortenerTable";

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event));

  const shortId = event.pathParameters?.url;

  if (!shortId || typeof shortId !== "string") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing or invalid short ID in path" }),
    };
  }

  try {
    // Fetch the item from DynamoDB
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { shortId },
      })
    );

    const item = result.Item;

    if (!item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Short URL not found" }),
      };
    }

    // Non-blocking: update clickCount and lastAccessed
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { shortId },
        UpdateExpression: "SET clickCount = if_not_exists(clickCount, :zero) + :inc, lastAccessed = :now",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":inc": 1,
          ":now": Date.now(),
        },
      })
    ).catch((err) => {
      console.error("Non-blocking update failed:", err);
    });

    // Return 301 redirect to original long URL
    return {
      statusCode: 301,
      headers: {
        Location: item.longUrl,
      },
      body: "",
    };
  } catch (err) {
    console.error("Unhandled error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Internal Server Error" }),
    };
  }
};

