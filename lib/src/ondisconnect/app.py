"""
Removes a connectionID from the dynamoDB table.
Invoked when a client disconnects from the websocket connection.
"""
import os

import boto3
from aws_lambda_powertools import Tracer

tracer = Tracer()

table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


@tracer.capture_lambda_handler
def handler(event, _):
    print(event)
    table.delete_item(Key={"connectionId": event["requestContext"]["connectionId"]})
    return {"statusCode": 200}
