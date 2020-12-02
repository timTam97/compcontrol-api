# compcontrol-api

This is a serverless AWS application that enables remote computer control. It consists of a WebSocket API which clients connect to, and a REST API for sending commands to those clients via the persistent WebSocket connection. This app provides the backend Lambda functions, DynamoDB table, and API gateways needed to create this API.

## Client Apps

[pushbullet-automation-haskell](https://github.com/timTam97/pushbullet-automation-haskell) is a client app that acts as a consumer of this API. If you deploy this app on AWS and run the client app on your local machine, you will be able to make web requests and control your computer (ie. sleep, shut down, hibernate, lock) accordingly.

## Setup

The easiest way to deploy this serverless stack is to deploy it straight from its [listing](https://serverlessrepo.aws.amazon.com/applications/ap-southeast-2/670960088768/compcontrol-api) on the AWS Serverless Application Repository.

Alternatively, you can clone this repo and use the SAM CLI to build and deploy the stack yourself:

```
sam deploy --guided
```

## Usage / API Reference

### WebSocket event stream

After building and/or deploying the stack, you will see some outputs. The output called `WebSocketURI` is the URI that you will need to connect via a secure WebSocket client.

All messages sent are JSON objects with a `type` key, with an optional `subtype` key. 

#### WebSocket stream types
- `{type: "nop", subtype: "ping"}`
  - Dummy message sent every 1 minute to confirm the connection is active
- `{type: "command", subtype: "..."}`
  - Tells you that a web request has been made. The `subtype` key will contain the command to execute.
  - The subtype can be any of `sleep`, `shutdown`, `lock` or `hibernate`.

### REST API for sending commands

The `SendCommandURL` in the outputs of the AWS app indicates the URL that you should make a `POST` web request to in order to send the command to all clients that are currently connected to the WebSocket.

You should append your command to the end of this URL. For example, if you wanted to send a sleep command:

```
curl -X POST https://xxxxxxxx.execute-api.ap-southeast-2.amazonaws.com/Prod/sleep
```

The API will return a status code and JSON indicating success or failure.

**Note:** Only `sleep`, `shutdown`, `lock` and `hibernate` can currently be passed to this API. Any other commands that are sent will be ignored and `403`d.
