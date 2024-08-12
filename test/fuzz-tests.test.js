const axios = require("axios");
const mongodb = require("mongodb");
const yaml = require("yaml");
const fs = require("fs");
const { resolveRefs } = require("./lib/resolver");
const { main } = require("../index");
const { expectMatchesSchema, isObject } = require("./lib/schema");
const { generateData } = require("fuzzmatic");

describe("Fuzz tests from JSON Schema", () => {

    //
    // Note: the test spec must be loaded syncronously because jest does not support async test generation.
    //
    const testSpec = resolveRefs(yaml.parse(fs.readFileSync(`${__dirname}/test-spec.yaml`, 'utf-8')));

    //
    // Generate fuzz data based on the schemas.
    //
    const fuzzedSpecs = testSpec.specs.flatMap(spec => {
        const data = generateData(spec.body);

        //
        // Uncomment to see the generated data.
        //
        // fs.writeFileSync(`./fuzzed-data.json`, JSON.stringify(data, null, 2));

        const validSpecs = data.valid
            .filter(validBody => isObject(validBody)) // Must be an object for Axios.
            .map((validBody, index) => {
                return {
                    ...spec,
                    title: `${spec.title} - valid #${index+1}`,
                    body: validBody,
                    expected: {
                        status: spec.expected.okStatus,
                        body: spec.expected.okBody,
                    },
                };
            });
        const invalidSpecs = data.invalid
            .filter(invalidBody => isObject(invalidBody)) // Must be an object for Axios.
            .map((invalidBody, index) => {
                return {
                    ...spec,
                    title: `${spec.title} - invalid #${index+1}`,
                    body: invalidBody,
                    expected: {
                        status: spec.expected.errorStatus,
                        body: spec.expected.errorBody,
                    },
                };
            });
        return [...validSpecs, ...invalidSpecs];
    });

    //
    // Uncomment to see the generated specs.
    //
    // fs.writeFileSync(`./fuzzed-specs.json`, JSON.stringify(fuzzedSpecs, null, 2));

    let server;
    let baseURL;

    //
    // Loads a test data fixture.
    //
    async function loadFixture(fixtureName) {
        const fixtureFiles = await fs.promises.readdir(`./fixtures/${fixtureName}`);
        const fixtures = {};
        for (const fixtureFile of fixtureFiles) {
            const collectionName = fixtureFile.split(".")[0];
            fixtures[collectionName] = require(`../fixtures/${fixtureName}/${fixtureFile}`);
        }
        mongodb.__setData__(fixtures);
    }

    //
    // Removes all test data.
    //
    function clearFixture() {
        mongodb.__setData__({});
    }   

    //
    // Starts the server on a random port.
    //
    async function startServer() {
        if (process.env.BASE_URL) {
            //
            // Run against an existing server that is started externally.
            //
            baseURL = process.env.BASE_URL;
        }
        else {
            //
            // Run against a server that is started internally for each test.
            //
            server = await main({
                dbConnection: `mongodb://127.0.0.1:1234`,
                dbName: `contract-tests`,
                port: 0, // Allocates a random port.
            });

            baseURL = `http://127.0.0.1:${server.address().port}`;
        }
    }

    //
    // Closes the server.
    //
    function closeServer() {
        return new Promise(resolve => {
            if (server) {
                server.close(resolve);
            }
            else {
                resolve();
            }
        })
    }

    beforeEach(async () => {
        await startServer();
    });

    afterEach(async () => {
        await closeServer();
    });

    test.each(fuzzedSpecs)(`$title`, async spec => { // Generates a test for each test spec in the contract.

        if (spec.fixture) {
            loadFixture(spec.fixture)
        }
        else {
            clearFixture();
        }

        //
        // Makes the HTTP request.
        //
        const response = await axios({
            method: spec.method,
            url: spec.url,
            baseURL,
            data: spec.body,
            validateStatus: () => true, // All status codes are ok.
        });

        //
        // Match status
        //
        if (spec.expected.status) {
            expect(response.status).toEqual(spec.expected.status);
        }

        //
        // Match headers.
        //
        if (spec.expected.headers) {
            for ([headerName, expectedValue] of Object.entries(spec.expected.headers)) {
                const actualValue = response.headers[headerName.toLowerCase()]
                expect(actualValue).toEqual(expectedValue);
            }
        }

        //
        // Match response body against the expected schema.
        //
        if (spec.expected.body) {
            expectMatchesSchema(response.data, spec.expected.body);
        }
    });
});