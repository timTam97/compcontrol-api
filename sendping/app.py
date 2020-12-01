"""
Sends a ping to all connections to confirm the connection is active.
Invoked every minute (see template for schedule).
"""
import json
import os

import boto3

table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))
# https://github.com/boto/boto3/issues/1914
apigw = boto3.client(
    "apigatewaymanagementapi", endpoint_url=os.environ.get("CONNECTION_BASE_URL")
)


def handler(event, context):
    base_url = os.environ.get("CONNECTION_BASE_URL")
    res = table.scan(Select="ALL_ATTRIBUTES")
    connIDs = [dict["connectionId"] for dict in res["Items"]]
    for val in connIDs:  # Send to all connections
        payload = json.dumps({"type": "nop", "sub": "ping"})
        apigw.post_to_connection(Data=payload, ConnectionId=val)
    return {
        "isBase64Encoded": False,
        "statusCode": 200,
        "body": json.dumps({"message": "Success"}),
    }
