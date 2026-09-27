# Access Request Administration Dashboard

A React + TypeScript dashboard for triaging access requests, backed by a small in-memory Express API. The API loads the supplied JSON dataset at startup; decisions are reset when the server restarts.

## Requirements

- Node.js 18 or newer
- npm

## Install and Run

From the repository root:

```sh
./run.sh
```

The script installs root, client, and server dependencies, then starts both development servers. It prints the API and dashboard URLs:

- Dashboard: http://localhost:5173
- API: http://localhost:3001

Stop both services with Ctrl+C. To install dependencies separately and start the services:

```sh
npm run install:all
npm run dev
```

The API defaults to `data/requests.json`, resolved relative to the server package directory. Set `DATA_PATH` to override it; an absolute path avoids ambiguity:

```sh
DATA_PATH=/absolute/path/to/requests.json npm run dev
```

## Tests and Build

Run the client and server unit tests and build the client from the repository root:

```sh
npm --prefix client test
npm --prefix server test
npm --prefix client run build
```

To typecheck the server:

```sh
cd server
npx tsc --noEmit
```

## Design Decisions

### Components and State

The client separates the queue, filters, request details, status/date indicators, and decision dialog into focused components. `RequestList` owns the current search, filters, sort, and page. Those values are part of the React Query key, so changing them requests a distinct result set from the API. The server filters and sorts the queue before slicing the requested page; the UI never downloads the whole queue to paginate locally.

`App` owns the selected request. `RequestDetail` owns the latest version of that record while it is open, and the decision dialog owns the current decision, justification draft, validation, and submission state. Successful decisions and conflict refreshes update the detail state and invalidate the queue query. The API remains authoritative for decision eligibility and validation.

Filters and sort changes reset the page to 1. The queue starts with pending requests selected, while status can be changed to include approved, denied, or cancelled requests. The API returns the total matching count separately from the current page. Its default page size is 25 and its maximum is 100.

### Decision Conflicts

The client validates required justifications before submission, but still handles server `422` responses. A `409` triggers a detail fetch. If the request is still pending, the refreshed record is shown and the typed justification remains in the dialog for review and resubmission. If another administrator has decided it, the current decision is shown and the dialog closes. The request version is sent with every decision attempt.

### Optional Features

- **Audit trail:** The detail view renders the request's existing `history` events.
- **Due-date urgency:** Overdue requests are marked overdue; requests due within two days are marked due soon.
- **Draft-preserving recovery:** A pending request refreshed after a stale-version conflict keeps the administrator's typed justification.
- **Bulk decisions:** The API implements per-item bulk results. Bulk selection and actions are not included in the UI so the individual review and conflict workflow stays the priority.
- **Queue overview and URL-synced filters:** Not included. The filtered queue count and sortable columns provide a compact view for this take-home; shareable filters and aggregate queue metrics can be added if administrators need them.

## Scale: 100,000 Open Requests

Today the server loads the whole dataset into each process's memory, then filters it and sorts the matching records for each list request. Filtering is linear in the dataset size and sorting is approximately $O(n \log n)$. At 100,000 open requests, repeated full-array scans and sorts would increase response latency and CPU use; additional server processes would also each hold a separate copy of the data. Offset pagination can become increasingly expensive for deep pages.

I would move the records and decisions to a database and push filtering, sorting, and pagination into indexed queries. Index status, type, priority, and date fields; use an appropriate text-search index for requester, resource, and request ID; and index risk flags if they are stored as arrays. Start with database-side limit/offset pagination and move to cursor pagination if deep-page performance requires it. Keep the count query efficient, and return only fields needed for the current view where practical.

## Simultaneous Administrators

Within one running API process, the server checks both `PENDING` status and the submitted version before applying a decision. A competing decision made first increments the version and changes the status, so the later request receives `409`; the client refreshes the record rather than presenting the rejected decision as successful. There is no live push or polling, so another administrator's changes are not shown until the reviewer acts and encounters a conflict. Restarting the server also resets all changes.

This in-memory check is not sufficient across multiple API processes: each process has its own copy, so two processes could accept decisions against the same old version. In a persistent service, perform an atomic update such as `UPDATE ... WHERE request_id = ? AND status = 'PENDING' AND version = ?`, check the affected row count, and write the decision and audit event in the same transaction. A zero-row update becomes a conflict; push notifications or controlled refresh/polling can then keep other open dashboards current.

## One More Day

I would first strengthen confidence in the reviewer workflow: add tests for every supported sort and malformed query/body boundary, then manually exercise the full decision flow with the supplied dataset in two browser tabs. I would also do a keyboard and screen-reader pass on the queue and decision dialog, including focus restoration after closing the dialog. With that covered, I would add URL-synced filters and pagination so administrators can bookmark and share queue views. I would keep persistence and multi-step workflow changes out of this extra day because they expand the assignment's scope.