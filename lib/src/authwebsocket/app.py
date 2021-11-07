"""
Lambda authorizer for when clients try to connect
to the websocket. We check that their key is present
in the DB of generated keys.
"""
import os

import boto3
from aws_lambda_powertools import Tracer
from boto3.dynamodb.conditions import Key

tracer = Tracer()

key_table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))


@tracer.capture_lambda_handler
def handler(event, _):
    print(event)
    method = event["methodArn"]
    auth_token = event["headers"].get("auth")
    if auth_token is None:
        return deny(method)
    res = key_table.query(KeyConditionExpression=Key("key").eq(auth_token))
    if len(res["Items"]) == 0:
        return deny(method)
    return allow(method)


def allow(resource):
    return generate_policy("Allow", resource)


def deny(resource):
    return generate_policy("Deny", resource)


def generate_policy(effect, resource):
    """
    Generates an IAM policy.
    """
    return {
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
    }
