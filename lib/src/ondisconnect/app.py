"""
Removes a connectionID from the dynamoDB table.
Invoked when a client disconnects from the websocket connection.
"""
import json
import os

import boto3

table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


def handler(event, context):
    print(event)
    table.delete_item(Key={"connectionId": event["requestContext"]["connectionId"]})
    return {"isBase64Encoded": False, "statusCode": 200, "body": "yes"}
