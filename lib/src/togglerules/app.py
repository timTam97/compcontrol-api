"""
Disables relevant lambda schedules when there are no items in the dynamoDB
table. Enables them when the table has items.
"""
import os

import boto3

table = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME"))
events = boto3.client("events")


def handler(event, _):
    print(event)
    table_count = table.scan(Select="COUNT")["Count"]
    if table_count == 0:
        events.disable_rule(Name=os.environ.get("WARMER_RULE_NAME"))
        events.disable_rule(Name=os.environ.get("PING_RULE_NAME"))
        return
    elif table_count == 1:
        events.enable_rule(Name=os.environ.get("WARMER_RULE_NAME"))
        events.enable_rule(Name=os.environ.get("PING_RULE_NAME"))
        return
    return
