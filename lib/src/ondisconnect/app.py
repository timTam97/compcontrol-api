"""
Removes a connectionID from the dynamoDB table.
Invoked when a client disconnects from the websocket connection.
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
    table.delete_item(Key={"connectionId": event["requestContext"]["connectionId"]})
    return {"statusCode": 200}
