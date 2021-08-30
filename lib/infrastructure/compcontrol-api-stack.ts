import * as cdk from "@aws-cdk/core";
import * as apigw from "@aws-cdk/aws-apigatewayv2";
import * as apigw_integrations from "@aws-cdk/aws-apigatewayv2-integrations";
import * as acm from "@aws-cdk/aws-certificatemanager";
import CompControlTables from "./dynamo-tables";
import CompControlFunctions from "./lambda-functions";
import CompControlWebsocket from "./websocket-support";
import ReactOnS3 from "./react-s3";

export class WebsiteStack extends cdk.Stack {
    public readonly certificate: acm.Certificate;
    constructor(app: cdk.App, id: string, props?: cdk.StackProps) {
        super(app, id, props);
        ReactOnS3(this);
    }
}

export class CompControlApiStack extends cdk.Stack {
    constructor(app: cdk.App, id: string, props?: cdk.StackProps) {
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
        cdk.Tags.of(customDomainCert).add("Name", "CompControlApiCertificate");

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
        const wssApi = new apigw.CfnApi(this, "CompControlWebsocketApi", {
            protocolType: "WEBSOCKET",
            routeSelectionExpression: "$request.body.action",
            name: "CompControlWebsocketApi",
            disableExecuteApiEndpoint: true,
        });

        // Lambda stuff
        const functions = CompControlFunctions(
            this,
            connectionsTable.tableName,
            keyTable.tableName,
            "https://wss.timsam.live",
            wssApi.ref
        );

        connectionsTable.grantReadData(functions.sendPingFunction);
        connectionsTable.grantReadData(functions.sendCommandFunction);
        connectionsTable.grantReadWriteData(functions.onConnectFunction);
        connectionsTable.grantReadWriteData(functions.onDisconnectFunction);
        keyTable.grantReadData(functions.websocketAuthorizer);
        keyTable.grantReadData(functions.sendCommandFunction);
        keyTable.grantReadWriteData(functions.generateKeyFunction);

        // Websocket API setup
        CompControlWebsocket(this, wssApi, functions, customDomainCert);

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
new WebsiteStack(app, "WebsiteStack", {
    env: { region: "us-east-1" },
});
new CompControlApiStack(app, "CompControlApiStack", {
    env: { region: "ap-southeast-2" },
});
app.synth();
