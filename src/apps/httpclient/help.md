# HTTP Client Help

The Nexus HTTP Client lets you test, debug, and save REST API requests right inside Nexus Arcade OS.

## Features

- **Request Builder:** Choose methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS), set URL parameters, custom headers, auth headers (Bearer, Basic), and JSON/Form request bodies.
- **Environments & Variables:** Define variables like `{{baseUrl}}` or `{{apiKey}}` to quickly switch between local, staging, and production endpoints.
- **Response Inspector:** Inspect HTTP status codes, round-trip latency, payload size, response headers, and formatted JSON/HTML bodies.
- **Diagnostics:** If a request fails due to browser CORS policies or being offline, an informative diagnostic card is shown alongside an auto-generated `curl` command.
- **Code Export:** Export any configured request directly as a `curl` shell command or JavaScript `fetch()` snippet.
