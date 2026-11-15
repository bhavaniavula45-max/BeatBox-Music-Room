# BeatBox Music Room

## Project description

BeatBox Music Room is a Node.js and Express REST API for maintaining musicians, musical instrument inventory, and instrument loans. It uses SQLite through `better-sqlite3` to persist records and keep instrument availability synchronized as loans are created and returned.

## Problem statement

A music room needs a reliable way to keep track of who is borrowing its instruments, which instruments are available, and whether a musician has reached the borrowing limit. Maintaining these records separately can lead to unavailable instruments being loaned again or returned instruments remaining marked as loaned.

## Project objectives

- Store musician, instrument, and loan records in a relational database.
- Provide HTTP endpoints to manage the implemented musician, instrument, and loan operations.
- Validate API input and report missing records and conflicting operations.
- Search instruments by family.
- Keep loan and instrument status consistent when loans begin and are returned.
- Enforce a maximum of three active loans per musician.

## Technologies

- Node.js (Node.js 22 or later is required by the installed `better-sqlite3` version)
- Express 5
- SQLite
- `better-sqlite3`
- Node.js built-in test runner (`node --test`)
- Postman Collection v2.1

## Database design

The database contains exactly three application tables:

| Table | Purpose | Important fields and constraints |
|---|---|---|
| `musicians` | Music room members | `id`, required `name`, unique required `email`, `created_at` |
| `instruments` | Instrument inventory | `id`, required `name` and `family`, `status` (`available` or `loaned`), `created_at` |
| `loans` | Instrument loan history | `id`, required musician and instrument foreign keys, `loan_date`, nullable `return_date`, `status` (`active` or `returned`) |

Each loan references one musician and one instrument. Foreign-key enforcement is enabled by the database connection. A partial unique index prevents more than one active loan for the same instrument. The API also maintains the instrument status when a loan is created or returned and applies the three-active-loan limit per musician.

By default, the database is created at `database/beatbox.sqlite` when the application loads. Set `DATABASE_PATH` to use a different file. SQLite database files are excluded by `.gitignore`.

## Project structure

```text
.
├── config/
│   └── database.js                  # SQLite connection and schema initialization
├── controllers/                     # Reserved; no controller modules currently
├── database/
│   └── schema.sql                   # Three-table schema and indexes
├── middleware/                      # Reserved; no middleware modules currently
├── postman/
│   └── BeatBox Music Room API.postman_collection.json
├── routes/
│   └── api.js                       # Implemented API routes and validation
├── tests/
│   ├── api.test.js
│   ├── loan-limit.test.js
│   └── server.test.js
├── .gitignore
├── package.json
├── package-lock.json
└── server.js
```

## Installation and running locally

1. Install Node.js 22 or later and npm.
2. From the project root, install the locked dependencies:

   ```sh
   npm ci
   ```

3. Start the server:

   ```sh
   npm start
   ```

   The API listens on port `3000` by default. Override the port with the `PORT` environment variable. For example, in PowerShell:

   ~~~powershell
   $env:PORT = "4000"
   npm start
   ~~~

4. Confirm the local server is responding at `GET http://localhost:3000/health` (or the configured port). The health response is:

   ```json
   {
     "status": "ok",
     "service": "BeatBox Music Room API"
   }
   ```

The root URL (`GET http://localhost:3000/`) returns a JSON project overview with status, available API endpoints, and the health check path.

For development with automatic restarts, run `npm run dev`. Run the full automated test suite with `npm test`.

The API accepts JSON request bodies. For JSON requests, send the `Content-Type: application/json` header.

## API reference

Base URL when running locally: `http://localhost:3000`

| Method | Path | Purpose | Success |
|---|---|---|---|
| `GET` | `/` | Show the project overview and available API endpoints | `200` |
| `GET` | `/health` | Check whether the API is responding | `200` |
| `GET` | `/api/musicians` | Retrieve all musicians | `200` |
| `GET` | `/api/musicians/:id` | Retrieve one musician | `200` |
| `POST` | `/api/musicians` | Create a musician | `201` |
| `GET` | `/api/instruments` | Retrieve all instruments | `200` |
| `GET` | `/api/instruments?family=Strings` | Retrieve instruments whose family exactly matches the query value | `200` |
| `GET` | `/api/instruments/:id` | Retrieve one instrument | `200` |
| `POST` | `/api/instruments` | Create an available instrument | `201` |
| `PUT` | `/api/instruments/:id` | Update instrument name and family | `200` |
| `DELETE` | `/api/instruments/:id` | Delete an instrument that is not loaned | `204` |
| `GET` | `/api/loans` | Retrieve all loans, including musician and instrument names | `200` |
| `GET` | `/api/loans/:id` | Retrieve one loan, including musician and instrument names | `200` |
| `POST` | `/api/loans` | Create a loan | `201` |
| `PUT` | `/api/loans/:id/return` | Return an active loan | `200` |

There are no musician update/delete routes, instrument status update route, or general loan update/delete routes in the current implementation.

### Example: create a musician

`POST /api/musicians`

Request:

```json
{
  "name": "Asha Patel",
  "email": "asha.patel@example.com"
}
```

Response (`201 Created`):

```json
{
  "id": 1,
  "name": "Asha Patel",
  "email": "asha.patel@example.com",
  "created_at": "2026-11-12 12:00:00"
}
```

The ID and creation timestamp are generated by SQLite.

### Example: create and search instruments

`POST /api/instruments`

Request:

```json
{
  "name": "Yamaha Acoustic Guitar",
  "family": "Strings"
}
```

Response (`201 Created`):

```json
{
  "id": 1,
  "name": "Yamaha Acoustic Guitar",
  "family": "Strings",
  "status": "available",
  "created_at": "2026-11-12 12:00:00"
}
```

Search with `GET /api/instruments?family=Strings`. The family comparison is an exact match; an unknown family returns `200 OK` with an empty array. An empty family query value is invalid and returns `400 Bad Request`.

Example search response:

```json
[
  {
    "id": 1,
    "name": "Yamaha Acoustic Guitar",
    "family": "Strings",
    "status": "available",
    "created_at": "2026-11-12 12:00:00"
  }
]
```

### Example: update an instrument

`PUT /api/instruments/1`

Request:

```json
{
  "name": "Yamaha Concert Guitar",
  "family": "Strings"
}
```

Response (`200 OK`) is the updated instrument object, including its unchanged `status` and `created_at`.

### Example: create a loan

`POST /api/loans`

Request:

```json
{
  "musician_id": 1,
  "instrument_id": 1,
  "loan_date": "2026-11-12"
}
```

`loan_date` is optional; when omitted, the API uses the current UTC date. The response (`201 Created`) is:

```json
{
  "id": 1,
  "musician_id": 1,
  "instrument_id": 1,
  "loan_date": "2026-11-12",
  "return_date": null,
  "status": "active"
}
```

Loan list and detail responses also include `musician_name` and `instrument_name`.

### Example: return a loan

`PUT /api/loans/1/return` has no request body. Response (`200 OK`):

```json
{
  "id": 1,
  "musician_id": 1,
  "instrument_id": 1,
  "loan_date": "2026-11-12",
  "return_date": "2026-11-12",
  "status": "returned"
}
```

Returning a loan sets its status to `returned`, records the return date, and marks the instrument `available`.

### Example: delete an instrument

`DELETE /api/instruments/1` has no request body. A successful deletion responds with `204 No Content` and an empty response body. An instrument cannot be deleted while its status is `loaned` or it has an active loan.

## HTTP status codes

| Status | Meaning in this API |
|---|---|
| `200 OK` | Successful retrieval, instrument update, or loan return |
| `201 Created` | Musician, instrument, or loan created |
| `204 No Content` | Instrument deleted |
| `400 Bad Request` | Invalid input, malformed ID, missing required field, or invalid family query |
| `404 Not Found` | Requested record (or referenced musician/instrument) does not exist |
| `409 Conflict` | Duplicate musician email, unavailable/loaned instrument, loan already returned, attempted deletion of a loaned instrument, or active-loan limit reached |

Errors are JSON objects with an `error` field. For example:

```json
{
  "error": "Limit of 3 reached"
}
```

## Validation rules

- Musician `name` must be a non-empty string.
- Musician `email` must be a non-empty email-shaped value no longer than 254 characters, and it must be unique.
- Instrument `name` and `family` must be non-empty strings.
- Instrument status values are constrained to `available` or `loaned`. Creation defaults to `available`; clients cannot create or update an instrument to `loaned` directly. Loan operations manage availability.
- Instrument updates require both `name` and `family`; a `status` field is not accepted for updates.
- IDs in paths must be positive safe integers. Invalid IDs return `400`; valid IDs for missing records return `404`.
- Loan creation requires positive integer JSON values for `musician_id` and `instrument_id`. Both referenced records must exist.
- If supplied, `loan_date` must be a real calendar date in `YYYY-MM-DD` format.
- Instrument family search requires a non-empty `family` query value when provided.
- An instrument cannot have more than one active loan. Duplicate active instrument loans are conflicts.

## Three-active-loan business rule

A musician may have at most three active loans. Loan creation checks the musician's active-loan count inside an immediate SQLite transaction. Returned loans are excluded from the count. If the musician already has three active loans, the API responds `409 Conflict` with the exact message `Limit of 3 reached`.

Loan creation also checks that the instrument is available and has no active loan. Creation changes the instrument status to `loaned`. Returning an active loan changes the loan to `returned`, records `return_date`, and changes the instrument status back to `available`. The state changes for each operation are transactional.

## Automated tests and required loan scenarios

Run all tests with:

```sh
npm test
```

The tests use separate temporary SQLite database files and clean them up; they do not use the development database file. The loan-limit tests cover:

1. **Three active loans:** Asha creates three loans; each request returns `201`.
2. **Fourth active loan:** Asha's fourth active loan returns `409` with `Limit of 3 reached`.
3. **Return and borrow again:** After returning one of the three loans, Asha can create a replacement loan with `201`.

The API tests also cover endpoint behavior, validation, family search, duplicate email and active-instrument conflicts, and missing resources. The health endpoint has a separate test.

## Postman collection

Import [`postman/BeatBox Music Room API.postman_collection.json`](./postman/BeatBox%20Music%20Room%20API.postman_collection.json) into Postman:

1. Open Postman and select **Import**.
2. Choose the collection JSON file from the project's `postman` directory.
3. Start the local server with `npm start` and keep the collection's `baseUrl` set to `http://localhost:3000`, or change it to match your local `PORT`.
4. Run the requests in order on a fresh/local database. The collection saves created IDs into collection variables and includes assertions for expected statuses and the loan-limit message.

The collection includes the create/read/update/delete operations that exist, validation and missing-resource examples, family search, duplicate/availability conflict examples, and the three-loan, fourth-loan, and return-then-reborrow flows.

## Team Members and Responsibilities

### Project overview

BeatBox Music Room is a group-built backend for managing musicians, instrument inventory, and instrument loans. The team divided the work across the Express API, SQLite persistence, CRUD operations, validation and search, the active-loan business rule and tests, and Postman and project documentation.

### Contributions

1. **AVULA BHAVANI – Express Server and API Routes**  
   Set up the Express server and organized the API route integration.
2. **MANI KUMARI – SQLite Database and SQL Queries**  
   Developed the SQLite schema, database connection, relationships, and parameterized SQL query foundation.
3. **MANISHWAR – REST APIs and CRUD Operations**  
   Implemented the musician, instrument, and loan REST operations, including instrument updates and deletion.
4. **SANTHOSH – Input Validation and Instrument Search**  
   Added request validation and family-based instrument search with clear error responses.
5. **SAI HARSHA – Three Active Loans Business Rule and Testing**  
   Implemented the maximum-three-active-loans rule and tests for loan creation, limit conflicts, and returning loans.
6. **PRAHARSHA – Postman Collection and README Documentation**  
   Prepared the Postman collection and project documentation for testing and submission.

## GitHub submission notes

- `package-lock.json` is present; use `npm ci` for a reproducible dependency installation.
- `.gitignore` excludes `node_modules/`, environment files, and SQLite database/journal files. Install dependencies locally rather than including `node_modules` in a submission.
- The default development database is generated locally and ignored; `database/schema.sql` is the schema source.
- No deployment configuration or deployment claim is included in this documentation.
