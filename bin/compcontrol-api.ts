#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import {
    CompControlApiStack,
    WebsiteStack,
} from "../lib/infrastructure/compcontrol-api-stack";

const app = new cdk.App();
new WebsiteStack(app, "WebsiteStack", {
    env: { region: "us-east-1" },
});
new CompControlApiStack(app, "CompControlAPI", {
    env: { region: "ap-southeast-2" },
});
