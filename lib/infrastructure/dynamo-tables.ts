import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb";

export default function CompControlTables(stack: cdk.Stack) {
    const defaultRemovalPolicy = cdk.RemovalPolicy.DESTROY;
    const connectionsTable = new dynamodb.Table(
        stack,
        "CompControlConnectionsTable",
        {
            partitionKey: {
                name: "connectionId",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "associatedKey",
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: defaultRemovalPolicy,
        }
    );
    connectionsTable.addGlobalSecondaryIndex({
        indexName: "keyIndex",
        partitionKey: {
            name: "associatedKey",
            type: dynamodb.AttributeType.STRING,
        },
        projectionType: dynamodb.ProjectionType.ALL,
    });

    const keyTable = new dynamodb.Table(stack, "CompControlApiKeyTable", {
        partitionKey: {
            name: "key",
            type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: defaultRemovalPolicy,
    });

    return { connectionsTable, keyTable };
}
