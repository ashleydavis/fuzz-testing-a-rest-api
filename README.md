# fuzz-testing-a-rest-api

An example of fuzz testing a REST API with generated data.

Built on:
- Fuzzmatic to generate the data from the JSON schema.
- Express.js to implement the REST API.
- MongoDB for the database.
- Jest for running the tests and matching expectations.
- Jest is used to mock MongoDB for the automated fuzz tests.
- Axios for making the HTTP requests.
- Ajv for testing the REST API response against the JSON schema in the test spec.
- Yaml for parsing the test spec.

## Test spec

See the test spec here: [./test/test-spec.yaml](./test/test-spec.yaml).

See the contract testing code here: [./test/fuzz-tests.test.js](./test/fuzz-tests.test.js).

## Setup

```bash
git clone https://github.com/ashleydavis/fuzz-testing-a-rest-api
cd fuzz-testing-a-rest-api
npm install
```

## Run tests

```bash
npm test
```

Note: Testing uses a mocked version of MongoDB.

## Run the REST API

```bash
npm start
```

Note: This includes an instant development database.

