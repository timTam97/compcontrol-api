import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";

export default function CompControlFunctions(
    stack: cdk.Stack,
    connectionsTableName: string,
    keyTableName: string
) {
    const websocketAuthorizer = new lambda.Function(
        stack,
        "WebsocketAuthorizer",
        {
            code: new lambda.AssetCode("lib/src/authwebsocket"),
            handler: "app.handler",
            runtime: lambda.Runtime.PYTHON_3_8,
            environment: {
                TABLE_NAME: connectionsTableName,
            },
        }
    );

    const generateKeyFunction = new lambda.Function(
        stack,
        "GenerateKeyFunction",
        {
            code: new lambda.AssetCode("lib/src/generatekey"),
            handler: "app.handler",
            runtime: lambda.Runtime.PYTHON_3_8,
            environment: {
                TABLE_NAME: keyTableName,
            },
        }
    );

    return { websocketAuthorizer, generateKeyFunction };
}
