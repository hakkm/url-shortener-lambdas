const AWS = require('aws-sdk');
const crypto = require('crypto');

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'UrlShortenerTable';
const BASE_URL = process.env.BASE_URL || 'https://short.url';

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event));
    try {
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (parseErr) {
            console.error('Error parsing body:', parseErr);
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
        }
        const longUrl = body.url;
        if (!longUrl || typeof longUrl !== 'string') {
            console.error('Missing or invalid url:', longUrl);
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid url' }) };
        }
        const shortId = crypto.randomBytes(4).toString('hex');
        const item = {
            shortId,
            longUrl,
            clickCount: 0,
            lastAccessed: null
        };
        try {
            await dynamo.put({
                TableName: TABLE_NAME,
                Item: item
            }).promise();
        } catch (dbErr) {
            console.error('DynamoDB put error:', dbErr);
            return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) };
        }
        const response = { shortUrl: `${BASE_URL}/${shortId}` };
        console.log('Returning response:', response);
        return {
            statusCode: 200,
            body: JSON.stringify(response)
        };
    } catch (err) {
        console.error('Unhandled error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
