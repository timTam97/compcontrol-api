import { Stack, RemovalPolicy } from "aws-cdk-lib";
import { aws_dynamodb as dynamodb } from "aws-cdk-lib";

export default function CompControlTables(stack: Stack) {
    const defaultRemovalPolicy = RemovalPolicy.DESTROY;
    const connectionsTable = new dynamodb.Table(
        stack,
        "CompControlConnectionsTable",
        {
            partitionKey: {
                name: "connectionId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: defaultRemovalPolicy,
            stream: dynamodb.StreamViewType.KEYS_ONLY,
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
