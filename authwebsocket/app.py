"""
Lambda authorizer for when clients try to connect
to the websocket. We check that their key is present
in the DB of generated keys.
"""
import os

import boto3
from boto3.dynamodb.conditions import Key

key_table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


def handler(event, context):
    method = event["methodArn"]
    auth_token = event["headers"].get("auth")
    if auth_token is None:
        return deny(method)
    res = key_table.query(KeyConditionExpression=Key("key").eq(auth_token))
    if len(res["Items"]) == 0:
        return deny(method)
    return allow(method)


def allow(resource):
    return generate_policy("me", "Allow", resource)


def deny(resource):
    return generate_policy("me", "Deny", resource)


def generate_policy(principal_id, effect, resource):
    """
    Generates an IAM policy.
    """
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
