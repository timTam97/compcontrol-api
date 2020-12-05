"""
Sends a specified command to all connected websocket clients. Commands are
checked before sending to ensure they are legitimate (see the template file
for allowed commands)
"""
import json
import os

import boto3

table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))
# https://github.com/boto/boto3/issues/1914
apigw = boto3.client(
    "apigatewaymanagementapi", endpoint_url=os.environ.get("CONNECTION_BASE_URL")
)


def handler(event, context):
    command = event["pathParameters"]["command"]
    allowed_commands = list(json.loads(os.environ.get("ALLOWED_COMMANDS")).values())
    if command not in allowed_commands:
        return {
            "isBase64Encoded": False,
            "statusCode": 403,
            "body": json.dumps({"message": "Command not whitelisted"}),
        }
    res = table.scan(Select="ALL_ATTRIBUTES")
    connIDs = [dict["connectionId"] for dict in res["Items"]]
    for val in connIDs:  # Send to all connections
        payload = json.dumps({"type": "command", "subtype": command})
        apigw.post_to_connection(Data=payload, ConnectionId=val)
    return {
        "isBase64Encoded": False,
        "statusCode": 200,
        "body": json.dumps({"message": "Success"}),
    }
