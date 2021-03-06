# compcontrol-api

This is a serverless AWS application that enables remote computer control. It consists of a WebSocket API which clients connect to, and a REST API for sending commands to those clients via the persistent WebSocket connection. This app provides the backend Lambda functions, DynamoDB tables, and API gateways needed to create this API.

## Try it out!

This API is live at `https://*.timsam.live`. See the API reference below for details, and the section just below this one for an app that uses this API.

## Client Apps

[compcontrol-client](https://github.com/timTam97/compcontrol-client) is a client app that interfaces with this API. If you get yourself an API key and run this client app on your local machine, you will be able to make web requests and control your computer (ie. sleep, shut down, hibernate, lock) accordingly.

## Setup

As mentioned above, this API is already deployed at `https://*.timsam.live`.

If you want to build and deploy it yourself, then:
- Clone this repo
- Install the AWS CDK (`npm install -g aws-cdk`) if you haven't already
- `npm install`
- `cdk deploy` (ensure your credentials at `~/.aws` are set)

## Usage / API Reference

### WebSocket event stream

*Note:* You probably only need the WebSocket information if you're writing a client app to interface with this API. If you're already using a client app ([over here](https://github.com/timTam97/compcontrol-client)) and want to send commands to your computer, see the REST API section below.

You first need an API key before you can interact with any of the APIs. First, go to https://command.timsam.live/getkey to get your key.

After you have your key, you can now connect to the WebSocket as well as send commands. The URI for connecting to the websocket is `wss://wss.timsam.live/`. Pass your authentication token in the header with key `auth`.

All messages sent are JSON objects with a `type` key, with an optional `subtype` key. 

#### WebSocket stream types
- `{type: "nop", subtype: "ping"}`
  - Dummy message sent every 1 minute to confirm the connection is active
- `{type: "command", subtype: "..."}`
  - Tells you that a web request has been made. The `subtype` key will contain the command to execute.
  - The subtype can be any of `sleep`, `shutdown`, `lock` or `hibernate`.

### REST API for sending commands

The URL to send commands to is `https://command.timsam.live/send/<command>`. Replace `<command>` with the command you want to send to the client. Place your auth token in the `auth` part of the header.

For example, if you wanted to send a sleep command:

```
curl -H "auth: <your_token_here>" \
     -X POST https://command.timsam.live/send/sleep
```

The API will return a status code and JSON indicating success or failure.

**Note:** Only `sleep`, `shutdown`, `lock` and `hibernate` can currently be passed to this API. Any other commands that are sent will be ignored and `403`d.
