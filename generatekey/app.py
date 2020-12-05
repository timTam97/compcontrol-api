"""
Generates an API key, adds it to the DB and sends it to the caller.
Invoked on a GET request to an implicit API.
"""
import json
import os
import random
import string

import boto3

table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


def handler(event, context):
    key = "".join(
        random.choices(
            string.ascii_uppercase + string.digits + string.ascii_lowercase, k=64
        )
    )
    table.put_item(Item={"key": key})
    return {
        "isBase64Encoded": False,
        "statusCode": 200,
        "body": json.dumps({"key": key}),
    }
