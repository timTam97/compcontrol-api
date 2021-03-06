"""
Adds a connectionID to the dynamoDB table.
Invoked when a client connects to the websocket.
"""
import json
import os

import boto3

table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


def handler(event, context):
    print(event)
    key = event["headers"]["auth"]
    table.put_item(
        Item={
            "connectionId": event["requestContext"]["connectionId"],
            "associatedKey": key,
        }
    )
    return {"isBase64Encoded": False, "statusCode": 200, "body": "yes"}
