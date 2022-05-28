import {
    Stack,
    BundlingOptions,
    Duration,
    aws_lambda as lambda,
    aws_iam as iam,
    aws_events as events,
    aws_events_targets as targets,
    aws_lambda_event_sources as sources,
    aws_dynamodb as dynamodb,
} from "aws-cdk-lib";

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
    stack: Stack,
    connectionsTable: dynamodb.Table,
    keyTableName: string,
    ApiGwConnectionBaseURL: string
): lambdaFunctions {
    /**
     * Bundling knowledge is from
     * https://stackoverflow.com/a/69276116/13161283
     */
    const defaultPythonBundling: BundlingOptions = {
        image: lambda.Runtime.PYTHON_3_9.bundlingImage,
        command: [
            "bash",
            "-c",
            "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output",
        ],
    };

    const defaultLambdaOptions = {
        handler: "app.handler",
        runtime: lambda.Runtime.PYTHON_3_9,
        architecture: lambda.Architecture.ARM_64,
        tracing: lambda.Tracing.ACTIVE,
    };

    const websocketAuthorizer = new lambda.Function(
        stack,
        "WebsocketAuthorizer",
        {
            ...defaultLambdaOptions,
            code: new lambda.AssetCode("lib/src/authwebsocket", {
                bundling: defaultPythonBundling,
            }),
            environment: {
                TABLE_NAME: keyTableName,
            },
            memorySize: 512,
        }
    );

    const generateKeyFunction = new lambda.Function(
        stack,
        "GenerateKeyFunction",
        {
            ...defaultLambdaOptions,
            code: new lambda.AssetCode("lib/src/generatekey", {
                bundling: defaultPythonBundling,
            }),
            environment: {
                TABLE_NAME: keyTableName,
            },
            memorySize: 256,
        }
    );

    const onConnectFunction = new lambda.Function(stack, "OnConnectFunction", {
        ...defaultLambdaOptions,
        code: new lambda.AssetCode("lib/src/onconnect", {
            bundling: defaultPythonBundling,
        }),
        environment: {
            TABLE_NAME: connectionsTable.tableName,
        },
        memorySize: 256,
    });

    const onDisconnectFunction = new lambda.Function(
        stack,
        "OnDisconnectFunction",
        {
            ...defaultLambdaOptions,
            code: new lambda.AssetCode("lib/src/ondisconnect", {
                bundling: defaultPythonBundling,
            }),
            environment: {
                TABLE_NAME: connectionsTable.tableName,
            },
            memorySize: 256,
        }
    );

    const sendCommandFunction = new lambda.Function(
        stack,
        "SendCommandFunction",
        {
            ...defaultLambdaOptions,
            code: new lambda.AssetCode("lib/src/sendcommand", {
                bundling: defaultPythonBundling,
            }),
            environment: {
                TABLE_NAME: connectionsTable.tableName,
                KEY_TABLE_NAME: keyTableName,
                CONNECTION_BASE_URL: ApiGwConnectionBaseURL,
                ALLOWED_COMMANDS:
                    '{"command1": "sleep", "command2": "hibernate", "command3": "shutdown","command4": "lock"}',
            },
            memorySize: 512,
        }
    );
    const sendCommandWarmer = new events.Rule(stack, "SendCommandWarmer", {
        schedule: events.Schedule.rate(Duration.minutes(3)),
        targets: [new targets.LambdaFunction(sendCommandFunction)],
    });

    const sendPingFunction = new lambda.Function(stack, "SendPingFunction", {
        ...defaultLambdaOptions,
        code: new lambda.AssetCode("lib/src/sendping", {
            bundling: defaultPythonBundling,
        }),
        environment: {
            TABLE_NAME: connectionsTable.tableName,
            CONNECTION_BASE_URL: ApiGwConnectionBaseURL,
        },
        memorySize: 256,
    });
    const scheduledPing = new events.Rule(stack, "ScheduledPing", {
        schedule: events.Schedule.rate(Duration.minutes(1)),
        targets: [new targets.LambdaFunction(sendPingFunction)],
    });

    const toggleRulesFunction = new lambda.Function(
        stack,
        "ToggleRuleFunction",
        {
            ...defaultLambdaOptions,
            code: new lambda.AssetCode("lib/src/togglerules", {
                bundling: defaultPythonBundling,
            }),
            environment: {
                TABLE_NAME: connectionsTable.tableName,
                WARMER_RULE_NAME: sendCommandWarmer.ruleName,
                PING_RULE_NAME: scheduledPing.ruleName,
            },
            memorySize: 256,
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
