import json
import os

import boto3

sns = boto3.client("sns")
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
        apigw.post_to_connection(
            Data=event["pathParameters"]["command"], ConnectionId=val
        )
    return {"isBase64Encoded": False, "statusCode": 200, "body": "yes"}
