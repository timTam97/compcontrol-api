import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as iam from "@aws-cdk/aws-iam";
import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";

export interface lambdaFunctions {
    websocketAuthorizer: lambda.Function;
    generateKeyFunction: lambda.Function;
    onConnectFunction: lambda.Function;
    onDisconnectFunction: lambda.Function;
    sendCommandFunction: lambda.Function;
    sendPingFunction: lambda.Function;
    scheduledPing: events.Rule;
}

export default function CompControlFunctions(
    stack: cdk.Stack,
    connectionsTableName: string,
    keyTableName: string,
    ApiGwConnectionBaseURL: string,
    wssApiRef: string
): lambdaFunctions {
    const websocketAuthorizer = new lambda.Function(
        stack,
        "WebsocketAuthorizer",
        {
            code: new lambda.AssetCode("lib/src/authwebsocket"),
            handler: "out/app.handler",
            runtime: lambda.Runtime.NODEJS_14_X,
            environment: {
                TABLE_NAME: keyTableName,
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
    sendCommandFunction.addToRolePolicy(
        new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["execute-api:ManageConnections"],
            resources: [
                `arn:aws:execute-api:${stack.region}:${stack.account}:${wssApiRef}/*`,
            ],
        })
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
    sendPingFunction.addToRolePolicy(
        new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["execute-api:ManageConnections"],
            resources: [
                `arn:aws:execute-api:${stack.region}:${stack.account}:${wssApiRef}/*`,
            ],
        })
    );
    const scheduledPing = new events.Rule(stack, "ScheduledPing", {
        schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
        targets: [new targets.LambdaFunction(sendPingFunction)],
    });

    return {
        websocketAuthorizer,
        generateKeyFunction,
        onConnectFunction,
        onDisconnectFunction,
        sendCommandFunction,
        sendPingFunction,
        scheduledPing,
    };
}
