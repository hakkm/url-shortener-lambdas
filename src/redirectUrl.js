const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'UrlShortenerTable';

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event));
    const shortId = event.pathParameters && event.pathParameters.shortId;
    if (!shortId || typeof shortId !== 'string') {
        console.error('Missing or invalid shortId:', shortId);
        return { statusCode: 400, body: 'Missing or invalid shortId' };
    }
    let item;
    try {
        const result = await dynamo.get({
            TableName: TABLE_NAME,
            Key: { shortId }
        }).promise();
        item = result.Item;
        if (!item) {
            console.error('ShortId not found:', shortId);
            return { statusCode: 404, body: 'Not found' };
        }
    } catch (dbErr) {
        console.error('DynamoDB get error:', dbErr);
        return { statusCode: 500, body: 'Database error' };
    }
    try {
        await dynamo.update({
            TableName: TABLE_NAME,
            Key: { shortId },
            UpdateExpression: 'SET clickCount = if_not_exists(clickCount, :zero) + :inc, lastAccessed = :now',
            ExpressionAttributeValues: {
                ':inc': 1,
                ':zero': 0,
                ':now': new Date().toISOString()
            }
        }).promise();
    } catch (dbErr) {
        console.error('DynamoDB update error:', dbErr);
        // Continue to redirect even if update fails
    }
    console.log('Redirecting to:', item.longUrl);
    return {
        statusCode: 301,
        headers: { Location: item.longUrl },
        body: ''
    };
};
