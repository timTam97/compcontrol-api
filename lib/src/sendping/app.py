"""
Sends a ping to all connections to confirm the connection is active.
Invoked every minute (see template for schedule).
"""
import json
import os

import boto3
from aws_xray_sdk.core import patch_all, xray_recorder

patch_all()

table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))
# https://github.com/boto/boto3/issues/1914
apigw = boto3.client(
    "apigatewaymanagementapi", endpoint_url=os.environ.get("CONNECTION_BASE_URL")
)


@xray_recorder.capture("handler")
def handler(event, _):
    print(event)
    res = table.scan(Select="ALL_ATTRIBUTES")
    connIDs = [dict["connectionId"] for dict in res["Items"]]
    for val in connIDs:  # Send to all connections
        payload = json.dumps({"type": "nop", "subtype": "ping"})
        apigw.post_to_connection(Data=payload, ConnectionId=val)
    return {"statusCode": 200}
