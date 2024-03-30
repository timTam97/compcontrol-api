# compcontrol-api

This is a serverless AWS application that enables remote computer control. It consists of a WebSocket API which clients connect to, and a REST API for sending commands to those clients via the persistent WebSocket connection. This app provides the backend Lambda functions, DynamoDB tables, and API gateways needed to create this API.

- [Try it out!](#try-it-out)
- [Client Apps](#client-apps)
- [Setup](#setup)
- [Usage / API Reference](#usage--api-reference)
  - [WebSocket event stream](#websocket-event-stream)
    - [WebSocket stream types](#websocket-stream-types)
  - [REST API for sending commands](#rest-api-for-sending-commands)

## Try it out!

The recommended way of consuming this API is to use [compcontrol-client](https://github.com/timTam97/compcontrol-client). See the [client apps](#client-apps) section below.

This API is live across various domains (`api.timsam.au` and `wss.timsam.au`).

## Client Apps

[compcontrol-client](https://github.com/timTam97/compcontrol-client) is a client app that interfaces with this API. If you get yourself an API key and run this client app on your local machine, you will be able to make web requests and control your computer (ie. sleep, shut down, hibernate, lock) accordingly.

## Setup

As mentioned above, this API is already deployed across multiple domains on `timsam.au`.

If you want to build and deploy it yourself, then:

-   Clone this repo
-   Install the AWS CDK (`npm install -g aws-cdk`) if you haven't already
-   `npm install`
-   `cdk deploy` (ensure your credentials at `~/.aws` are set)

## Usage / API Reference

### WebSocket event stream

_Note:_ You probably only need the WebSocket information if you're writing a client app to interface with this API. If you're already using a client app ([over here](https://github.com/timTam97/compcontrol-client)) and want to send commands to your computer, see the REST API section below.

You first need an API key before you can interact with any of the APIs. First, go to https://command.timsam.au/getkey to get your key.

After you have your key, you can now connect to the WebSocket as well as send commands. The URI for connecting to the websocket is `wss://wss.timsam.au/`. Pass your authentication token in the header with key `auth`.

All messages sent are JSON objects with a `type` key, with an optional `subtype` key.

#### WebSocket stream types

-   `{type: "nop", subtype: "ping"}`
    -   Dummy message sent every 1 minute to confirm the connection is active
-   `{type: "command", subtype: "..."}`
    -   Tells you that a web request has been made. The `subtype` key will contain the command to execute.
    -   The subtype can be any of `sleep`, `shutdown`, `lock` or `hibernate`.

### REST API for sending commands

If you're running compcontrol-client and you want to send commands to your machine, see the [sending commands](https://github.com/timTam97/compcontrol-client#sending-commands) section in the client repo.

The URL to send commands to is `https://command.timsam.au/send/<command>`.

-   Replace `<command>` with the command you want to send to the client.
    -   ❗ The client will only respond to `sleep`, `shutdown`, `lock` and `hibernate` commands.
    -   Any other commands will be ignored and `403`'d.
-   Place your API key in the `auth` part of the header.
-   Send a `POST` request.

For example, if you wanted to send a sleep command and your token was `fwolXHYtGMbmAg`:

```
curl -H "auth: fwolXHYtGMbmAg" \
     -X POST https://command.timsam.au/send/sleep
```

If the request was successful, you will get a `200`. If your token is accepted but there are no connected clients to send the command to, you will receive a `404`.
