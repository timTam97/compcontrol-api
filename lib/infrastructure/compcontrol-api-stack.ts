import {
    App,
    Stack,
    StackProps,
    Tags,
    aws_certificatemanager as acm,
} from "aws-cdk-lib";
import * as apigw from "@aws-cdk/aws-apigatewayv2-alpha";
import * as apigw_integrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
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

        // Lambda stuff
        const functions = CompControlFunctions(
            this,
            connectionsTable,
            keyTable.tableName,
            "https://wss.timsam.live"
        );

        // Websocket API setup
        const wssApiConstructs = CompControlWebsocket(
            this,
            functions,
            customDomainCert
        );
        const wssApi = wssApiConstructs.wssApi;

        wssApi.grantManageConnections(functions.websocketAuthorizer);
        wssApi.grantManageConnections(functions.sendCommandFunction);
        wssApi.grantManageConnections(functions.sendPingFunction);

        connectionsTable.grantReadData(functions.sendPingFunction);
        connectionsTable.grantReadData(functions.sendCommandFunction);
        connectionsTable.grantReadData(functions.toggleRulesFunction);
        connectionsTable.grantReadWriteData(functions.onConnectFunction);
        connectionsTable.grantReadWriteData(functions.onDisconnectFunction);
        keyTable.grantReadData(functions.websocketAuthorizer);
        keyTable.grantReadData(functions.sendCommandFunction);
        keyTable.grantReadWriteData(functions.generateKeyFunction);

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
