"""
Adds a connectionID to the dynamoDB table.
Invoked when a client connects to the websocket.
"""
import json
import os

import boto3
from aws_xray_sdk.core import patch_all, xray_recorder

patch_all()
table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


@xray_recorder.capture("handler")
def handler(event, _):
    print(event)
    key = event["headers"]["auth"]
    table.put_item(
        Item={
            "connectionId": event["requestContext"]["connectionId"],
            "associatedKey": key,
        }
    )
    return {"statusCode": 200}
