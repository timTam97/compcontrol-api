"""
TODO
"""
import os

import boto3
from boto3.dynamodb.conditions import Key

key_table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


def handler(event, context):
    print(event)
    method = event["methodArn"]
    res = key_table.query(
        KeyConditionExpression=Key("key").eq(event["headers"]["Auth"])
    )
    print(res)
    if len(res["Items"]) == 0:
        return deny(method)
    return allow(method)


def allow(resource):
    return generate_policy("me", "Allow", resource)


def deny(resource):
    return generate_policy("me", "Deny", resource)


def generate_policy(principal_id, effect, resource):
    return {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": resource,
                }
            ],
        },
        "context": {"stringKey": "value", "numberKey": "1", "booleanKey": "true"},
        "usageIdentifierKey": "{api-key}",
    }

    # auth_response = {}
    # auth_response["principalId"] = principal_id
    # policy_document = {}
    # policy_document["Version"] = "2012-10-17"
    # policy_document["Statement"] = []
    # statement_one = {}
    # statement_one["Action"] = "execute-api:Invoke"
    # statement_one["Effect"] = effect
    # statement_one["Resource"] = resource
    # policy_document.get("Statement")[0] = statement_one
    # auth_response["policyDocument"] = policy_document
    # return auth_response
