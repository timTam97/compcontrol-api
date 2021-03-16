import * as cdk from "@aws-cdk/core";
import * as apigw from "@aws-cdk/aws-apigatewayv2";
import * as apigw_integrations from "@aws-cdk/aws-apigatewayv2-integrations";
import * as lambda from "@aws-cdk/aws-lambda";
import CompControlTables from "./dynamo-tables";
import CompControlFunctions from "./lambda-functions";

export class CompControlApiStack extends cdk.Stack {
    constructor(app: cdk.App, id: string) {
        super(app, id);

        // DynamoDB stuff
        const tables = CompControlTables(this);
        const connectionsTable = tables.connectionsTable;
        const keyTable = tables.keyTable;

        // APIGW stuff
        const api = new apigw.HttpApi(this, "CompControlHttpApi");

        // Lambda stuff

        // API stuff continued
        // Websocket API

        // L2 websocket constructs (with authorizers) pls :(
        const wssApi = new apigw.CfnApi(this, "CompControlWebsocketApi", {
            protocolType: "WEBSOCKET",
            routeSelectionExpression: "$request.body.action",
            name: "CompControlWebsocketApi",
        });

        // Lambda stuff
        const functions = CompControlFunctions(
            this,
            connectionsTable.tableName,
            keyTable.tableName,
            `https://${wssApi.ref}.execute-api.${this.region}.amazonaws.com/prod`,
            wssApi.ref
        );

        connectionsTable.grantReadData(functions.sendPingFunction);
        connectionsTable.grantReadData(functions.sendCommandFunction);

        connectionsTable.grantReadWriteData(functions.onConnectFunction);
        connectionsTable.grantReadWriteData(functions.onDisconnectFunction);

        keyTable.grantReadData(functions.websocketAuthorizer);
        keyTable.grantReadData(functions.sendCommandFunction);
        keyTable.grantReadWriteData(functions.generateKeyFunction);

        const wssAuth = new apigw.CfnAuthorizer(
            this,
            "CompControlWebsocketAuth",
            {
                apiId: wssApi.ref,
                authorizerType: "REQUEST",
                identitySource: ["route.request.header.auth"],
                name: "WebsocketAuth",
                authorizerUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${functions.websocketAuthorizer.functionArn}/invocations`,
            }
        );
        new lambda.CfnPermission(this, "AuthorizerPermission", {
            action: "lambda:InvokeFunction",
            functionName: functions.websocketAuthorizer.functionName,
            principal: "apigateway.amazonaws.com",
        }).addDependsOn(wssApi);

        // onConnect stuff
        const wssConnectIntegration = new apigw.CfnIntegration(
            this,
            "CompControlWebsocketConnectIntegration",
            {
                apiId: wssApi.ref,
                integrationType: "AWS_PROXY",
                integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${functions.onConnectFunction.functionArn}/invocations`,
            }
        );
        new apigw.CfnRoute(this, "OnConnectRoute", {
            apiId: wssApi.ref,
            routeKey: "$connect",
            authorizationType: "CUSTOM",
            authorizerId: wssAuth.ref,
            target: "integrations/" + wssConnectIntegration.ref,
        });
        new lambda.CfnPermission(this, "OnConnectPermission", {
            action: "lambda:InvokeFunction",
            functionName: functions.onConnectFunction.functionName,
            principal: "apigateway.amazonaws.com",
        }).addDependsOn(wssApi);

        // onDisconnect stuff
        const wssDisconnectIntegration = new apigw.CfnIntegration(
            this,
            "CompControlWebsocketDisconnectIntegration",
            {
                apiId: wssApi.ref,
                integrationType: "AWS_PROXY",
                integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${functions.onDisconnectFunction.functionArn}/invocations`,
            }
        );
        new apigw.CfnRoute(this, "OnDisconnectRoute", {
            apiId: wssApi.ref,
            routeKey: "$disconnect",
            target: "integrations/" + wssDisconnectIntegration.ref,
        }).addDependsOn(wssApi);
        new lambda.CfnPermission(this, "OnDisconnectPermission", {
            action: "lambda:InvokeFunction",
            functionName: functions.onDisconnectFunction.functionName,
            principal: "apigateway.amazonaws.com",
        }).addDependsOn(wssApi);

        // Set up autodeploy
        new apigw.CfnStage(this, "CompControlWebsocketStage", {
            autoDeploy: true,
            stageName: "prod",
            apiId: wssApi.ref,
        });

        // Adding Lambda integrations for HTTP API
        api.addRoutes({
            integration: new apigw_integrations.LambdaProxyIntegration({
                handler: functions.sendCommandFunction,
                payloadFormatVersion: apigw.PayloadFormatVersion.VERSION_2_0,
            }),
            path: "/send/{command}",
            methods: [apigw.HttpMethod.POST],
        });
        api.addRoutes({
            integration: new apigw_integrations.LambdaProxyIntegration({
                handler: functions.generateKeyFunction,
                payloadFormatVersion: apigw.PayloadFormatVersion.VERSION_2_0,
            }),
            path: "/getkey",
            methods: [apigw.HttpMethod.GET],
        });
    }
}

const app = new cdk.App();
new CompControlApiStack(app, "CompControlAPI");
app.synth();
