"""
Sends a specified command to a websocket client.
We choose which client gets the command based on the
auth token that is passed in.
Commands are checked before sending to ensure they are
legitimate (see the template file for allowed commands)
"""
import json
import os

import boto3
from aws_lambda_powertools import Tracer
from boto3.dynamodb.conditions import Key

tracer = Tracer()

wss_table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))
key_table = boto3.resource("dynamodb").Table(os.environ.get("KEY_TABLE_NAME"))
# https://github.com/boto/boto3/issues/1914
apigw = boto3.client(
    "apigatewaymanagementapi", endpoint_url=os.environ.get("CONNECTION_BASE_URL")
)


@tracer.capture_lambda_handler
def handler(event, _):
    print(event)

    if event.get("source") == "aws.events":
        tracer.put_annotation(key="WarmerInvoke", value="TRUE")
        return response(200, "OK (Warmer path)")

    tracer.put_annotation(key="WarmerInvoke", value="FALSE")

    command = event["pathParameters"]["command"]
    auth_key = event["headers"].get("auth")
    allowed_commands = list(json.loads(os.environ.get("ALLOWED_COMMANDS")).values())

    if command not in allowed_commands:
        return response(403, "Command not whitelisted")
    if auth_key is None:
        return response(403, "Missing authentication token")

    res = key_table.query(KeyConditionExpression=Key("key").eq(auth_key))
    if len(res["Items"]) == 0:
        return response(403, "Invalid authentication token")

    res = wss_table.query(
        TableName=os.environ.get("TABLE_NAME"),
        IndexName="keyIndex",
        KeyConditionExpression=Key("associatedKey").eq(auth_key),
    )
    if len(res["Items"]) == 0:
        return response(404, "No connected clients to send command to")

    connIDs = [dict["connectionId"] for dict in res["Items"]]
    for val in connIDs:
        payload = json.dumps({"type": "command", "subtype": command})
        apigw.post_to_connection(Data=payload, ConnectionId=val)
    return response(200, "Success!")


def response(code, message):
    return {
        "statusCode": code,
        "body": json.dumps({"message": message}),
    }
