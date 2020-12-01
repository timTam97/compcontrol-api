import json
import os

import boto3

table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


def handler(event, context):
    table.delete_item(Key={"connectionId": event["requestContext"]["connectionId"]})
    return {"isBase64Encoded": False, "statusCode": 200, "body": "yes"}
