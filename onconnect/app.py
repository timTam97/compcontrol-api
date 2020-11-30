import json
import os

import boto3

sns = boto3.client("sns")
table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


def handler(event, context):
    table_name = os.environ.get("TABLE_NAME")
    table.put_item(Item={"connectionId": event["requestContext"]["connectionId"]})

    # print("OVER HERE")
    # print(event)
    return {"isBase64Encoded": False, "statusCode": 200, "body": "yes"}
