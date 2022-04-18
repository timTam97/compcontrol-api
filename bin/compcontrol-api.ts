#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { CompControlApiStack } from "../lib/infrastructure/compcontrol-api-stack";

const app = new App();
new CompControlApiStack(app, "CompControlApiStack", {
    env: { region: "ap-southeast-2" },
});
