import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";

export default function CompControlFunctions(
    stack: cdk.Stack,
    connectionsTableName: string,
    keyTableName: string,
    ApiGwConnectionBaseURL: string
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

    const onConnectFunction = new lambda.Function(stack, "OnConnectFunction", {
        code: new lambda.AssetCode("lib/src/onconnect"),
        handler: "app.handler",
        runtime: lambda.Runtime.PYTHON_3_8,
        environment: {
            TABLE_NAME: connectionsTableName,
        },
    });

    const onDisconnectFunction = new lambda.Function(
        stack,
        "OnDisconnectFunction",
        {
            code: new lambda.AssetCode("lib/src/ondisconnect"),
            handler: "app.handler",
            runtime: lambda.Runtime.PYTHON_3_8,
            environment: {
                TABLE_NAME: connectionsTableName,
            },
        }
    );

    const sendCommandFunction = new lambda.Function(
        stack,
        "SendCommandFunction",
        {
            code: new lambda.AssetCode("lib/src/sendcommand"),
            handler: "app.handler",
            runtime: lambda.Runtime.PYTHON_3_8,
            environment: {
                TABLE_NAME: connectionsTableName,
                KEY_TABLE_NAME: keyTableName,
                CONNECTION_BASE_URL: ApiGwConnectionBaseURL,
                ALLOWED_COMMANDS:
                    '{"command1": "sleep", "command2": "hibernate", "command3": "shutdown","command4": "lock"}',
            },
        }
    );

    const sendPingFunction = new lambda.Function(stack, "SendPingFunction", {
        code: new lambda.AssetCode("lib/src/sendping"),
        handler: "app.handler",
        runtime: lambda.Runtime.PYTHON_3_8,
        environment: {
            TABLE_NAME: connectionsTableName,
            CONNECTION_BASE_URL: ApiGwConnectionBaseURL,
        },
    });

    return {
        websocketAuthorizer,
        generateKeyFunction,
        onConnectFunction,
        onDisconnectFunction,
        sendCommandFunction,
        sendPingFunction,
    };
}
