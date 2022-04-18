import { Construct } from "constructs";
import { App, Stack, StackProps, Tags, aws_apigatewayv2 } from "aws-cdk-lib";
import * as apigw from "@aws-cdk/aws-apigatewayv2-alpha";
import * as apigw_integrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { aws_certificatemanager as acm } from "aws-cdk-lib";
import CompControlTables from "./dynamo-tables";
import CompControlFunctions from "./lambda-functions";
import CompControlWebsocket from "./websocket-support";

export class CompControlApiStack extends Stack {
    constructor(app: App, id: string, props?: StackProps) {
        super(app, id, props);

        // DynamoDB stuff
        const tables = CompControlTables(this);
        const connectionsTable = tables.connectionsTable;
        const keyTable = tables.keyTable;

        // HTTP API stuff
        const customDomainCert = new acm.Certificate(
            this,
            "CompControlApiDomainCert",
            {
                domainName: "*.timsam.live",
                validation: acm.CertificateValidation.fromDns(),
            }
        );
        Tags.of(customDomainCert).add("Name", "CompControlApiCertificate");

        // The other custom domain is in websocket-support.ts
        // as it needs to be a CfnDomain :(
        const commandDomain = new apigw.DomainName(
            this,
            "CompControlCommandDomain",
            {
                domainName: "command.timsam.live",
                certificate: customDomainCert,
            }
        );

        const api = new apigw.HttpApi(this, "CompControlHttpApi", {
            defaultDomainMapping: {
                domainName: commandDomain,
            },
            disableExecuteApiEndpoint: true,
        });

        /**
         * Create base websocket API
         * Need to do this here as we need the base URL of this API for one of the lambdas.
         * also i want L2 constructs (with authorizers!) :(
         */
        const wssApi = new aws_apigatewayv2.CfnApi(
            this,
            "CompControlWebsocketApi",
            {
                protocolType: "WEBSOCKET",
                routeSelectionExpression: "$request.body.action",
                name: "CompControlWebsocketApi",
                disableExecuteApiEndpoint: true,
            }
        );

        // Lambda stuff
        const functions = CompControlFunctions(
            this,
            connectionsTable,
            keyTable.tableName,
            "https://wss.timsam.live",
            wssApi.ref
        );

        connectionsTable.grantReadData(functions.sendPingFunction);
        connectionsTable.grantReadData(functions.sendCommandFunction);
        connectionsTable.grantReadData(functions.toggleRulesFunction);
        connectionsTable.grantReadWriteData(functions.onConnectFunction);
        connectionsTable.grantReadWriteData(functions.onDisconnectFunction);
        keyTable.grantReadData(functions.websocketAuthorizer);
        keyTable.grantReadData(functions.sendCommandFunction);
        keyTable.grantReadWriteData(functions.generateKeyFunction);

        // Websocket API setup
        CompControlWebsocket(this, wssApi, functions, customDomainCert);

        // Adding Lambda integrations for HTTP API
        api.addRoutes({
            integration: new apigw_integrations.HttpLambdaIntegration(
                "SendIntegration",
                functions.sendCommandFunction
            ),
            path: "/send/{command}",
            methods: [apigw.HttpMethod.POST],
        });
        api.addRoutes({
            integration: new apigw_integrations.HttpLambdaIntegration(
                "GetKeyIntegration",
                functions.generateKeyFunction
            ),
            path: "/getkey",
            methods: [apigw.HttpMethod.GET],
        });
    }
}

const app = new App();
new CompControlApiStack(app, "CompControlApiStack", {
    env: { region: "ap-southeast-2" },
});
app.synth();
