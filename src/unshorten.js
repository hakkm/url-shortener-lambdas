const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'UrlShortenerTable';
const BASE_URL = process.env.BASE_URL || 'https://short.url';

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event));
    const params = event.queryStringParameters || {};
    const shortUrl = params.url;
    if (!shortUrl || typeof shortUrl !== 'string') {
        console.error('Missing or invalid url:', shortUrl);
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid url' }) };
    }
    let shortId;
    if (shortUrl.startsWith(BASE_URL + '/')) {
        shortId = shortUrl.replace(BASE_URL + '/', '');
    } else {
        shortId = shortUrl.split('/').pop();
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
            return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
        }
    } catch (dbErr) {
        console.error('DynamoDB get error:', dbErr);
        return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) };
    }
    const response = { longUrl: item.longUrl };
    console.log('Returning response:', response);
    return {
        statusCode: 200,
        body: JSON.stringify(response)
    };
};
