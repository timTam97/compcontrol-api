import * as cdk from "@aws-cdk/core";
import * as apigw from "@aws-cdk/aws-apigatewayv2";
import * as apigw_integrations from "@aws-cdk/aws-apigatewayv2-integrations";
import * as lambda from "@aws-cdk/aws-lambda";
import { lambdaFunctions } from "./lambda-functions";

export default function CompControlWebsocket(
    stack: cdk.Stack,
    wssApi: apigw.CfnApi,
    functions: lambdaFunctions
) {
    const wssAuth = new apigw.CfnAuthorizer(stack, "CompControlWebsocketAuth", {
        apiId: wssApi.ref,
        authorizerType: "REQUEST",
        identitySource: ["route.request.header.auth"],
        name: "WebsocketAuth",
        authorizerUri: `arn:aws:apigateway:${stack.region}:lambda:path/2015-03-31/functions/${functions.websocketAuthorizer.functionArn}/invocations`,
    });
    const authPerm = new lambda.CfnPermission(stack, "AuthorizerPermission", {
        action: "lambda:InvokeFunction",
        functionName: functions.websocketAuthorizer.functionName,
        principal: "apigateway.amazonaws.com",
    }).addDependsOn(wssApi);

    // onConnect stuff
    const wssConnectIntegration = new apigw.CfnIntegration(
        stack,
        "CompControlWebsocketConnectIntegration",
        {
            apiId: wssApi.ref,
            integrationType: "AWS_PROXY",
            integrationUri: `arn:aws:apigateway:${stack.region}:lambda:path/2015-03-31/functions/${functions.onConnectFunction.functionArn}/invocations`,
        }
    );
    const connectRoute = new apigw.CfnRoute(stack, "OnConnectRoute", {
        apiId: wssApi.ref,
        routeKey: "$connect",
        authorizationType: "CUSTOM",
        authorizerId: wssAuth.ref,
        target: "integrations/" + wssConnectIntegration.ref,
    });
    const connectPerm = new lambda.CfnPermission(stack, "OnConnectPermission", {
        action: "lambda:InvokeFunction",
        functionName: functions.onConnectFunction.functionName,
        principal: "apigateway.amazonaws.com",
    }).addDependsOn(wssApi);

    // onDisconnect stuff
    const wssDisconnectIntegration = new apigw.CfnIntegration(
        stack,
        "CompControlWebsocketDisconnectIntegration",
        {
            apiId: wssApi.ref,
            integrationType: "AWS_PROXY",
            integrationUri: `arn:aws:apigateway:${stack.region}:lambda:path/2015-03-31/functions/${functions.onDisconnectFunction.functionArn}/invocations`,
        }
    );
    const disconnectRoute = new apigw.CfnRoute(stack, "OnDisconnectRoute", {
        apiId: wssApi.ref,
        routeKey: "$disconnect",
        target: "integrations/" + wssDisconnectIntegration.ref,
    }).addDependsOn(wssApi);
    const disconnectPerm = new lambda.CfnPermission(
        stack,
        "OnDisconnectPermission",
        {
            action: "lambda:InvokeFunction",
            functionName: functions.onDisconnectFunction.functionName,
            principal: "apigateway.amazonaws.com",
        }
    ).addDependsOn(wssApi);

    // Set up autodeploy
    const apiStage = new apigw.CfnStage(stack, "CompControlWebsocketStage", {
        autoDeploy: true,
        stageName: "prod",
        apiId: wssApi.ref,
    });

    return {
        wssAuth,
        authPerm,
        wssConnectIntegration,
        connectRoute,
        connectPerm,
        wssDisconnectIntegration,
        disconnectRoute,
        disconnectPerm,
        apiStage,
    };
}
