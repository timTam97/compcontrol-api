#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CompcontrolApiStack } from '../lib/infrastructure/compcontrol-api-stack';

const app = new cdk.App();
new CompcontrolApiStack(app, 'CompcontrolApiStack');
