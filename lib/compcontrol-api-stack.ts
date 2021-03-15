import * as cdk from "@aws-cdk/core";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as lambda from "@aws-cdk/aws-lambda";
import CompControlTables from "./dynamo-tables";
import CompControlFunctions from "./lambda-functions";

export class CompcontrolApiStack extends cdk.Stack {
    constructor(app: cdk.App, id: string) {
        super(app, id);
        const tables = CompControlTables(this);
        const connectionsTable = tables.connectionsTable;
        const keyTable = tables.keyTable;

        const functions = CompControlFunctions(
            this,
            connectionsTable.tableName,
            keyTable.tableName
        );
        connectionsTable.grantReadData(functions.websocketAuthorizer);
        keyTable.grantReadWriteData(functions.generateKeyFunction);
    }
}

const app = new cdk.App();
new CompcontrolApiStack(app, "CompControlAPI");
app.synth();
