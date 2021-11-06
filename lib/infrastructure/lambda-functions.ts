import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as iam from "@aws-cdk/aws-iam";
import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";
import * as sources from "@aws-cdk/aws-lambda-event-sources";
import * as dynamodb from "@aws-cdk/aws-dynamodb";

export interface lambdaFunctions {
    websocketAuthorizer: lambda.Function;
    generateKeyFunction: lambda.Function;
    onConnectFunction: lambda.Function;
    onDisconnectFunction: lambda.Function;
    sendCommandFunction: lambda.Function;
    sendPingFunction: lambda.Function;
    scheduledPing: events.Rule;
    sendCommandWarmer: events.Rule;
    toggleRulesFunction: lambda.Function;
}

export default function CompControlFunctions(
    stack: cdk.Stack,
    connectionsTable: dynamodb.Table,
    keyTableName: string,
    ApiGwConnectionBaseURL: string,
    wssApiRef: string
): lambdaFunctions {
    /**
     * Bundling knowledge is from
     * https://stackoverflow.com/a/69276116/13161283
     */

    const defaultPythonBundling: cdk.BundlingOptions = {
        image: lambda.Runtime.PYTHON_3_9.bundlingImage,
        command: [
            "bash",
            "-c",
            "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output",
        ],
    };

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
            architecture: lambda.Architecture.ARM_64,
            memorySize: 512,
            tracing: lambda.Tracing.ACTIVE,
        }
    );

    const generateKeyFunction = new lambda.Function(
        stack,
        "GenerateKeyFunction",
        {
            code: new lambda.AssetCode("lib/src/generatekey", {
                bundling: defaultPythonBundling,
            }),
            handler: "app.handler",
            runtime: lambda.Runtime.PYTHON_3_9,
            environment: {
                TABLE_NAME: keyTableName,
            },
            architecture: lambda.Architecture.ARM_64,
            memorySize: 256,
            tracing: lambda.Tracing.ACTIVE,
        }
    );

    const onConnectFunction = new lambda.Function(stack, "OnConnectFunction", {
        code: new lambda.AssetCode("lib/src/onconnect", {
            bundling: defaultPythonBundling,
        }),
        handler: "app.handler",
        runtime: lambda.Runtime.PYTHON_3_9,
        environment: {
            TABLE_NAME: connectionsTable.tableName,
        },
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        tracing: lambda.Tracing.ACTIVE,
    });

    const onDisconnectFunction = new lambda.Function(
        stack,
        "OnDisconnectFunction",
        {
            code: new lambda.AssetCode("lib/src/ondisconnect", {
                bundling: defaultPythonBundling,
            }),
            handler: "app.handler",
            runtime: lambda.Runtime.PYTHON_3_9,
            environment: {
                TABLE_NAME: connectionsTable.tableName,
            },
            architecture: lambda.Architecture.ARM_64,
            memorySize: 256,
            tracing: lambda.Tracing.ACTIVE,
        }
    );

    const sendCommandFunction = new lambda.Function(
        stack,
        "SendCommandFunction",
        {
            code: new lambda.AssetCode("lib/src/sendcommand", {
                bundling: defaultPythonBundling,
            }),
            handler: "app.handler",
            runtime: lambda.Runtime.PYTHON_3_9,
            environment: {
                TABLE_NAME: connectionsTable.tableName,
                KEY_TABLE_NAME: keyTableName,
                CONNECTION_BASE_URL: ApiGwConnectionBaseURL,
                ALLOWED_COMMANDS:
                    '{"command1": "sleep", "command2": "hibernate", "command3": "shutdown","command4": "lock"}',
            },
            architecture: lambda.Architecture.ARM_64,
            memorySize: 512,
            tracing: lambda.Tracing.ACTIVE,
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
    const sendCommandWarmer = new events.Rule(stack, "SendCommandWarmer", {
        schedule: events.Schedule.rate(cdk.Duration.minutes(3)),
        targets: [new targets.LambdaFunction(sendCommandFunction)],
    });

    const sendPingFunction = new lambda.Function(stack, "SendPingFunction", {
        code: new lambda.AssetCode("lib/src/sendping", {
            bundling: defaultPythonBundling,
        }),
        handler: "app.handler",
        runtime: lambda.Runtime.PYTHON_3_9,
        environment: {
            TABLE_NAME: connectionsTable.tableName,
            CONNECTION_BASE_URL: ApiGwConnectionBaseURL,
        },
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        tracing: lambda.Tracing.ACTIVE,
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

    const toggleRulesFunction = new lambda.Function(
        stack,
        "ToggleRuleFunction",
        {
            code: new lambda.AssetCode("lib/src/togglerules", {
                bundling: defaultPythonBundling,
            }),
            handler: "app.handler",
            runtime: lambda.Runtime.PYTHON_3_9,
            environment: {
                TABLE_NAME: connectionsTable.tableName,
                WARMER_RULE_NAME: sendCommandWarmer.ruleName,
                PING_RULE_NAME: scheduledPing.ruleName,
            },
            architecture: lambda.Architecture.ARM_64,
            memorySize: 256,
            tracing: lambda.Tracing.ACTIVE,
        }
    );
    toggleRulesFunction.addEventSource(
        new sources.DynamoEventSource(connectionsTable, {
            startingPosition: lambda.StartingPosition.LATEST,
        })
    );
    toggleRulesFunction.addToRolePolicy(
        new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["events:DisableRule", "events:EnableRule"],
            resources: [sendCommandWarmer.ruleArn, scheduledPing.ruleArn],
        })
    );

    return {
        websocketAuthorizer,
        generateKeyFunction,
        onConnectFunction,
        onDisconnectFunction,
        sendCommandFunction,
        sendPingFunction,
        scheduledPing,
        sendCommandWarmer,
        toggleRulesFunction,
    };
}
