"""
Adds a connectionID to the dynamoDB table.
Invoked when a client connects to the websocket.
"""

import os

import boto3
from aws_lambda_powertools import Tracer

tracer = Tracer()

table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


@tracer.capture_lambda_handler()
def handler(event, _):
    print(event)
    table.put_item(
        Item={
            "connectionId": event["requestContext"]["connectionId"],
            "associatedKey": event["headers"]["auth"],
        }
    )
    return {"statusCode": 200}
