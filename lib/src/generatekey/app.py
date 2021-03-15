"""
Generates an API key, adds it to the DB of
generated keys and sends it to the caller.
Invoked on a GET request to our API.
"""
import json
import os
import secrets
import string

import boto3

table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


def handler(event, context):
    key = secrets.token_urlsafe(64)
    table.put_item(Item={"key": key})
    return {
        "isBase64Encoded": False,
        "statusCode": 200,
        "body": json.dumps({"key": key}),
    }
