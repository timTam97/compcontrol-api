import * as app from "../../src/app";
import getEvent from "../../events/getEvent";
import postEvent from "../../events/postEvent";
import patchEvent from "../../events/patchEvent";
import deleteEvent from "../../events/deleteEvent";
import {
    DeleteItemCommand,
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
} from "@aws-sdk/client-dynamodb";

const SUPRESS_LOGS = true;

const isTest = process.env.JEST_WORKER_ID;
process.env.TABLE_NAME = "test-table";
process.env.INDEX_NAME = "userIDIndex";

const mockDB = new DynamoDBClient({
    ...(isTest && {
        endpoint: "http://127.0.0.1:8000",
        sslEnabled: false,
        tls: false,
        region: "ap-southeast-1",
        credentials: {
            accessKeyId: "fakeMyKeyId",
            secretAccessKey: "fakeSecretAccessKey",
        },
    }),
});

describe("Test GET /map/{mapid}", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        if (SUPRESS_LOGS)
            jest.spyOn(console, "log").mockImplementation(jest.fn());
    });

    test.each([false, true])(
        "Handles empty path parameters and no mapid",
        async (val) => {
            const spy = jest.spyOn(app, "withDynamoClientQueryItemSend");
            const event = getEvent({ definePathParameters: val });
            const data = await app.handler(event);

            expect(spy).not.toBeCalled();
            expect(data.statusCode).toEqual(400);
            expect(JSON.parse(data.body || "")).toEqual("No map ID");
        }
    );

    test("Handles normal lookup", async () => {
        const event = getEvent({ mapId: "map id" });
        const spy = jest
            .spyOn(app, "withDynamoClientQueryItemSend")
            .mockImplementation(async (input) => await mockDB.send(input));
        await mockDB.send(
            new PutItemCommand({
                TableName: "test-table",
                Item: {
                    mapID: { S: "map id" },
                    associatedUserID: { S: "user id" },
                    mapData: { S: "map data" },
                },
            })
        );
        const data = await app.handler(event);

        expect(spy.mock.calls[0][0]).toMatchObject({
            input: {
                ExpressionAttributeValues: { ":s": { S: "map id" } },
            },
        });
        expect(data.statusCode).toEqual(200);
        expect(JSON.parse(data.body || "")[0]).toEqual({
            mapID: "map id",
            associatedUserID: "user id",
            mapData: "map data",
        });
    });

    test("Handles empty error response from dynamoDB", async () => {
        const event = getEvent({
            mapId: "an invalid map id",
        });
        const spy = jest
            .spyOn(app, "withDynamoClientQueryItemSend")
            .mockRejectedValue("No items found");
        const data = await app.handler(event);

        expect(spy.mock.calls[0][0]).toMatchObject({
            input: {
                ExpressionAttributeValues: { ":s": { S: "an invalid map id" } },
            },
        });
        expect(data.statusCode).toEqual(404);
        expect(JSON.parse(data.body || "")).toEqual([]);
    });

    test("Handles empty response from dynamoDB", async () => {
        const event = getEvent({
            mapId: "a map id",
        });
        const spy = jest
            .spyOn(app, "withDynamoClientQueryItemSend")
            .mockImplementation(async (input) => await mockDB.send(input));
        const data = await app.handler(event);

        const spyCallArg = spy.mock.calls[0][0];
        expect(spyCallArg).toMatchObject({
            input: {
                ExpressionAttributeValues: { ":s": { S: "a map id" } },
            },
        });
        expect(data.statusCode).toEqual(404);
        expect(JSON.parse(data.body || "")).toEqual([]);
    });
});

describe("Test GET /map/list", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        if (SUPRESS_LOGS)
            jest.spyOn(console, "log").mockImplementation(jest.fn());
    });

    test("Handles undefined authorization", async () => {
        const spy = jest.spyOn(app, "withDynamoClientQueryItemSend");
        const event = getEvent({ hasAuthorizer: false, isList: true });
        const data = await app.handler(event);

        expect(spy).not.toBeCalled();
        expect(data.statusCode).toEqual(400);
        expect(JSON.parse(data.body || "")).toEqual("No user ID");
    });

    test("Handles no items found with dynamo error", async () => {
        const event = getEvent({ jwtSubject: "unknownUser", isList: true });
        const spy = jest
            .spyOn(app, "withDynamoClientQueryItemSend")
            .mockRejectedValue("No items found");
        const data = await app.handler(event);

        expect(spy.mock.calls[0][0]).toMatchObject({
            input: {
                ExpressionAttributeValues: { ":s": { S: "unknownUser" } },
            },
        });
        expect(data.statusCode).toEqual(200);
        expect(JSON.parse(data.body || "")).toEqual([]);
    });

    test("Bails on unknown error", async () => {
        const event = getEvent({ jwtSubject: "unknownUser", isList: true });
        const spy = jest
            .spyOn(app, "withDynamoClientQueryItemSend")
            .mockRejectedValue("Hitherto unforseen error");
        const data = await app.handler(event);

        expect(spy.mock.calls[0][0]).toMatchObject({
            input: {
                ExpressionAttributeValues: { ":s": { S: "unknownUser" } },
            },
        });
        expect(data.statusCode).toEqual(500);
        expect(JSON.parse(data.body || "")).toEqual(
            "Internal server error (own)"
        );
    });

    test("Handles no items found", async () => {
        const event = getEvent({ jwtSubject: "unknownUser", isList: true });
        const spy = jest
            .spyOn(app, "withDynamoClientQueryItemSend")
            .mockImplementation(async (input) => await mockDB.send(input));
        const data = await app.handler(event);

        expect(spy.mock.calls[0][0]).toMatchObject({
            input: {
                ExpressionAttributeValues: { ":s": { S: "unknownUser" } },
            },
        });
        expect(data.statusCode).toEqual(200);
        expect(JSON.parse(data.body || "")).toEqual([]);
    });

    test("Handles one map returned", async () => {
        const event = getEvent({
            jwtSubject: "arbitrary jwt subject",
            isList: true,
        });
        const spy = jest
            .spyOn(app, "withDynamoClientQueryItemSend")
            .mockImplementation(async (input) => await mockDB.send(input));
        await mockDB.send(
            new PutItemCommand({
                TableName: "test-table",
                Item: {
                    mapID: { S: "some map id" },
                    associatedUserID: { S: "arbitrary jwt subject" },
                    mapData: { S: "map data" },
                },
            })
        );
        const data = await app.handler(event);

        expect(spy.mock.calls[0][0]).toMatchObject({
            input: {
                ExpressionAttributeValues: {
                    ":s": { S: "arbitrary jwt subject" },
                },
            },
        });
        expect(data.statusCode).toEqual(200);
        expect(JSON.parse(data.body || "")[0]).toEqual({
            mapID: "some map id",
            associatedUserID: "arbitrary jwt subject",
            mapData: "map data",
        });
    });

    test("Handles two maps returned", async () => {
        const event = getEvent({ jwtSubject: "user", isList: true });
        const spy = jest
            .spyOn(app, "withDynamoClientQueryItemSend")
            .mockImplementation(async (input) => await mockDB.send(input));
        await mockDB.send(
            new PutItemCommand({
                TableName: "test-table",
                Item: {
                    mapID: { S: "map1" },
                    associatedUserID: { S: "user" },
                    mapData: { S: "mapdata1" },
                },
            })
        );
        await mockDB.send(
            new PutItemCommand({
                TableName: "test-table",
                Item: {
                    mapID: { S: "map2" },
                    associatedUserID: { S: "user" },
                    mapData: { S: "mapdata2" },
                },
            })
        );
        const data = await app.handler(event);

        expect(spy.mock.calls[0][0]).toMatchObject({
            input: {
                ExpressionAttributeValues: { ":s": { S: "user" } },
            },
        });
        expect(data.statusCode).toEqual(200);
        expect(JSON.parse(data.body || "")).toHaveLength(2);
    });
});

describe("Test POST /map", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        if (SUPRESS_LOGS)
            jest.spyOn(console, "log").mockImplementation(jest.fn());
    });

    test("Handles undefined authorization", async () => {
        const spy = jest.spyOn(app, "withDynamoClientPutItemSend");
        const event = postEvent({ hasAuthorizer: false });
        const data = await app.handler(event);

        expect(spy).not.toBeCalled();
        expect(data.statusCode).toEqual(400);
        expect(JSON.parse(data.body || "")).toEqual("No user ID");
    });

    test("Handles empty mapdata", async () => {
        const spy = jest.spyOn(app, "withDynamoClientPutItemSend");
        const event = postEvent({ jwtSubject: "test" });
        const data = await app.handler(event);

        expect(spy).not.toBeCalled();
        expect(data.statusCode).toEqual(400);
        expect(JSON.parse(data.body || "")).toEqual("mapdata not specified");
    });

    test("Inserts correctly on POST", async () => {
        jest.spyOn(app, "withDynamoClientPutItemSend").mockImplementation(
            async (input) => await mockDB.send(input)
        );
        const data = await app.handler(
            postEvent({
                mapData: "arbitrary map data",
                jwtSubject: "testUserId",
            })
        );

        // Look up table and verify item was inserted correctly
        expect(data.statusCode).toEqual(200);
        const res = await mockDB.send(
            new GetItemCommand({
                TableName: "test-table",
                Key: {
                    mapID: { S: JSON.parse(data.body || "").mapID },
                },
            })
        );
        expect(res.Item).toEqual({
            mapID: { S: JSON.parse(data.body || "").mapID },
            associatedUserID: { S: "testUserId" },
            mapData: { S: "arbitrary map data" },
        });
    });

    test("Bails on unknown error", async () => {
        const event = postEvent({
            mapData: "arbitrary map data",
            jwtSubject: "testUserId",
        });
        const spy = jest
            .spyOn(app, "withDynamoClientPutItemSend")
            .mockRejectedValue("Hitherto unforseen error");
        const data = await app.handler(event);

        expect(data.statusCode).toEqual(500);
        expect(JSON.parse(data.body || "")).toEqual(
            "Internal server error (own)"
        );
    });
});

describe("Test PATCH /map/{mapid}", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        if (SUPRESS_LOGS)
            jest.spyOn(console, "log").mockImplementation(jest.fn());
    });

    test("Handles undefined authorization", async () => {
        const spy = jest.spyOn(app, "withDynamoClientPutItemSend");
        const event = patchEvent({ hasAuthorizer: false, mapId: "test" });
        const data = await app.handler(event);

        expect(spy).not.toBeCalled();
        expect(data.statusCode).toEqual(400);
        expect(JSON.parse(data.body || "")).toEqual("No user ID");
    });

    test.each([false, true])("Handles no map id", async (val) => {
        const spy = jest.spyOn(app, "withDynamoClientPutItemSend");
        const event = patchEvent({ definePathParameters: val });
        const data = await app.handler(event);

        expect(spy).not.toBeCalled();
        expect(data.statusCode).toEqual(400);
        expect(JSON.parse(data.body || "")).toEqual("No map ID");
    });

    test("Handles empty mapdata", async () => {
        const spy = jest.spyOn(app, "withDynamoClientPutItemSend");
        const event = patchEvent({ mapId: "test", userId: "test" });
        const data = await app.handler(event);

        expect(spy).not.toBeCalled();
        expect(data.statusCode).toEqual(400);
        expect(JSON.parse(data.body || "")).toEqual("mapdata not specified");
    });

    test("Denies PATCH when no map with specified mapid exists", async () => {
        const spy = jest.spyOn(app, "withDynamoClientPutItemSend");
        jest.spyOn(app, "withDynamoClientQueryItemSend").mockImplementation(
            async (input) => await mockDB.send(input)
        );
        // The dynamoDB mock can't reset after each test run so we have to make
        // sure we're passing in a unique mapId to ensure it's not found in the DB.
        const event = patchEvent({
            mapData: "testMapData",
            userId: "testUserId",
            mapId: "12345-unique-asdasdasdasd",
        });
        const data = await app.handler(event);

        expect(spy).not.toBeCalled();
        expect(data.statusCode).toEqual(400);
        expect(JSON.parse(data.body || "")).toEqual(
            "A map with specified mapid does not exist"
        );
    });

    test("Allows PATCH when specified mapId already exists in DB", async () => {
        const spy = jest
            .spyOn(app, "withDynamoClientPutItemSend")
            .mockImplementation(async (input) => await mockDB.send(input));
        jest.spyOn(app, "withDynamoClientQueryItemSend").mockImplementation(
            async (input) => await mockDB.send(input)
        );
        mockDB.send(
            new PutItemCommand({
                TableName: "test-table",
                Item: {
                    mapID: { S: "someMapId" },
                    associatedUserID: { S: "someUserId" },
                    mapData: { S: "mapData" },
                },
            })
        );
        const event = patchEvent({
            mapData: "newMapData",
            userId: "someUserId",
            mapId: "someMapId",
        });
        const data = await app.handler(event);

        expect(data.statusCode).toEqual(200);
        expect(spy).toBeCalledTimes(1);
        const res = await mockDB.send(
            new GetItemCommand({
                TableName: "test-table",
                Key: {
                    mapID: { S: JSON.parse(data.body || "").mapID },
                },
            })
        );
        expect(res.Item).toEqual({
            mapID: { S: JSON.parse(data.body || "").mapID },
            associatedUserID: { S: "someUserId" },
            mapData: { S: "newMapData" },
        });
    });
});

describe("Test DELETE /map/{mapid}", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        if (SUPRESS_LOGS)
            jest.spyOn(console, "log").mockImplementation(jest.fn());
    });

    test.each([false, true])("Handles empty mapid", async (val) => {
        const spy = jest.spyOn(app, "withDynamoClientDeleteItemSend");
        const event = deleteEvent({
            userId: "test",
            definePathParameters: val,
        });
        const data = await app.handler(event);

        expect(spy).not.toBeCalled();
        expect(data.statusCode).toEqual(400);
        expect(JSON.parse(data.body || "")).toEqual("No map ID");
    });

    test("Handles undefined authorization", async () => {
        const spy = jest.spyOn(app, "withDynamoClientDeleteItemSend");
        const event = deleteEvent({
            hasAuthorizer: false,
            mapId: "test",
        });
        const data = await app.handler(event);

        expect(spy).not.toBeCalled();
        expect(data.statusCode).toEqual(400);
        expect(JSON.parse(data.body || "")).toEqual("No user ID");
    });

    test("Handles delete request for nonexistent item", async () => {
        const spy = jest
            .spyOn(app, "withDynamoClientDeleteItemSend")
            .mockImplementation(async (input) => await mockDB.send(input));
        const event = deleteEvent({
            userId: "delete-test-userid",
            mapId: "delete-test-mapid",
        });
        const data = await app.handler(event);

        expect(spy).toBeCalledTimes(1);
        expect(spy.mock.calls[0][0]).toMatchObject({
            input: {
                ExpressionAttributeValues: {
                    ":s": { S: "delete-test-userid" },
                },
            },
        });
        expect(data.statusCode).toEqual(404);
    });

    test("Handles delete request for item that exists", async () => {
        const spy = jest
            .spyOn(app, "withDynamoClientDeleteItemSend")
            .mockImplementation(async (input) => await mockDB.send(input));
        const event = deleteEvent({
            userId: "delete-test-userid",
            mapId: "delete-test-mapid",
        });
        await mockDB.send(
            new PutItemCommand({
                TableName: "test-table",
                Item: {
                    mapID: { S: "delete-test-mapid" },
                    associatedUserID: { S: "delete-test-userid" },
                    mapData: { S: "some map data" },
                },
            })
        );
        const data = await app.handler(event);

        expect(spy).toBeCalledTimes(1);
        expect(spy.mock.calls[0][0]).toMatchObject({
            input: {
                ExpressionAttributeValues: {
                    ":s": { S: "delete-test-userid" },
                },
            },
        });
        expect(data.statusCode).toEqual(200);
        const res = await mockDB.send(
            new GetItemCommand({
                TableName: "test-table",
                Key: {
                    mapID: { S: "delete-test-mapid" },
                },
            })
        );
        expect(res.Item).toBeUndefined();
    });

    test("Bails on unknown error", async () => {
        const event = deleteEvent({
            mapId: "arbitrary map id",
            userId: "testUserId",
        });
        const spy = jest
            .spyOn(app, "withDynamoClientDeleteItemSend")
            .mockRejectedValue("Hitherto unforseen error");
        const data = await app.handler(event);

        expect(data.statusCode).toEqual(500);
        expect(JSON.parse(data.body || "")).toEqual(
            "Internal server error (own)"
        );
    });
});

describe("Miscellaneous tests", () => {
    test.each(["HEAD", "PUT", "CONNECT", "TRACE", "OPTIONS"])(
        "Handles unsupported HTTP method %s",
        async (method) => {
            let event = getEvent({});
            event.requestContext.http.method = method;
            const data = await app.handler(event);
            expect(data.statusCode).toEqual(405);
        }
    );

    test.each([
        postEvent({ mapData: "yes", jwtSubject: "yes" }),
        getEvent({ mapId: "yes", jwtSubject: "test" }),
        deleteEvent({ mapId: "yes", userId: "yes" }),
    ])("$routeKey route bails on client error", async (event) => {
        jest.spyOn(console, "error").mockImplementation(jest.fn());
        const data = await app.handler(event);
        expect(data.statusCode).toEqual(500);
        expect(JSON.parse(data.body || "")).toEqual(
            "Internal server error (own)"
        );
    });
});
