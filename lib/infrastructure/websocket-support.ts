import { Stack, aws_certificatemanager as certman } from "aws-cdk-lib";
import { lambdaFunctions } from "./lambda-functions";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as apigw_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as apigw_auth from "aws-cdk-lib/aws-apigatewayv2-authorizers";

export default function CompControlWebsocket(
    stack: Stack,
    functions: lambdaFunctions,
    cert: certman.Certificate
) {
    const wssApi = new apigw.WebSocketApi(
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

    const connectRoute = new apigw.WebSocketRoute(
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

    const disconnectRoute = new apigw.WebSocketRoute(
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

    const apiDomainName = new apigw.DomainName(
        stack,
        "CompControlWebsocketDomain",
        {
            certificate: cert,
            domainName: "wss.timsam.au",
        }
    );

    const apiStage = new apigw.WebSocketStage(
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
        connectRoute,
        disconnectRoute,
        apiStage,
    };
}
