import json
import os

import boto3

apigw = boto3.client("apigatewaymanagementapi")
table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


def handler(event, context):
    base_url = os.environ.get("CONNECTION_BASE_URL")
    res = table.scan(Select="ALL_ATTRIBUTES")
    connIDs = [dict["connectionId"] for dict in res["Items"]]
    for val in connIDs:
        apigw.post_to_connection(Data="sleep", ConnectionId=val)
    print(connIDs)
    return {"isBase64Encoded": False, "statusCode": 200, "body": "yes"}
