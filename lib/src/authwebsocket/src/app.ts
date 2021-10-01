import {
    APIGatewayAuthorizerResult,
    APIGatewayRequestAuthorizerEvent,
} from "aws-lambda";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});

export const withDynamoClientQueryItemSend = async (input: QueryCommand) => {
    return client.send(input);
};

export const handler = async (
    event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
    console.log(event);
    const method = event.methodArn;
    if (!event.headers || !event.headers.auth) {
        return deny(method);
    }
    const token = event.headers.auth;
    const queryCommand = new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "key = :s",
        ExpressionAttributeValues: {
            ":s": { S: token },
        },
    });
    try {
        const data = await withDynamoClientQueryItemSend(queryCommand);
        if (!data.Items || data.Items.length === 0) {
            return deny(method);
        }
    } catch (error) {
        console.error(error);
    }
    return allow(method);
};

const deny = (resource: string) => generatePolicy("Deny", resource);

const allow = (resource: string) => generatePolicy("Allow", resource);

const generatePolicy = (
    effect: string,
    resource: string
): APIGatewayAuthorizerResult => {
    return {
        principalId: "me",
        policyDocument: {
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "execute-api:Invoke",
                    Effect: effect,
                    Resource: resource,
                },
            ],
        },
        usageIdentifierKey: "{api-key}",
    };
};
