import { Stack, aws_certificatemanager as certman } from "aws-cdk-lib";
import { lambdaFunctions } from "./lambda-functions";
import * as apigw_alpha from "@aws-cdk/aws-apigatewayv2-alpha";
import * as apigw_integrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as apigw_auth from "@aws-cdk/aws-apigatewayv2-authorizers-alpha";

export default function CompControlWebsocket(
    stack: Stack,
    functions: lambdaFunctions,
    cert: certman.Certificate
) {
    const wssApi = new apigw_alpha.WebSocketApi(
        stack,
        "CompControlWebsocketApi",
        {
            apiName: "CompControlWebsocketApi",
        }
    );

    const wssAuth = new apigw_auth.WebSocketLambdaAuthorizer(
        "CompControlWebsocketAuth",
        functions.websocketAuthorizer,
        {
            identitySource: ["route.request.header.auth"],
        }
    );

    const wssConnectIntegration = new apigw_alpha.WebSocketIntegration(
        stack,
        "CompControlWebsocketConnectIntegration",
        {
            integrationType: apigw_alpha.WebSocketIntegrationType.AWS_PROXY,
            integrationUri: `arn:aws:apigateway:${stack.region}:lambda:path/2015-03-31/functions/${functions.onConnectFunction.functionArn}/invocations`,
            webSocketApi: wssApi,
        }
    );

    const connectRoute = new apigw_alpha.WebSocketRoute(
        stack,
        "OnConnectRoute",
        {
            integration: new apigw_integrations.WebSocketLambdaIntegration(
                "onconnect",
                functions.onConnectFunction
            ),
            routeKey: "$connect",
            webSocketApi: wssApi,
            authorizer: wssAuth,
        }
    );

    const disconnectRoute = new apigw_alpha.WebSocketRoute(
        stack,
        "OnDisconnectRoute",
        {
            integration: new apigw_integrations.WebSocketLambdaIntegration(
                "ondisconnect",
                functions.onDisconnectFunction
            ),
            routeKey: "$disconnect",
            webSocketApi: wssApi,
        }
    );

    const apiDomainName = new apigw_alpha.DomainName(
        stack,
        "CompControlWebsocketDomain",
        {
            certificate: cert,
            domainName: "wss.timsam.live",
        }
    );

    const apiStage = new apigw_alpha.WebSocketStage(
        stack,
        "CompControlWebsocketStage",
        {
            stageName: "prod",
            webSocketApi: wssApi,
            autoDeploy: true,
            domainMapping: {
                domainName: apiDomainName,
            },
        }
    );

    return {
        wssApi,
        wssAuth,
        wssConnectIntegration,
        connectRoute,
        disconnectRoute,
        apiStage,
    };
}
