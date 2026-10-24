# Discovery Report: Perplexity Traffic & Stream Format

Summarizes the verified Phase 0 HAR findings used to build `perplexity-autorename`.

## 1. Answer Stream (`POST /rest/sse/perplexity_ask`)

- **Endpoint**: `POST https://www.perplexity.ai/rest/sse/perplexity_ask`
- **Response Content-Type**: `text/event-stream`
- **Request JSON**:
  ```json
  {
    "params": { ... },
    "query_str": "<user question>"
  }
  ```
- **First question vs. follow-up**:
  - Fresh threads have no non-empty `last_backend_uuid` in `params`.
  - Follow-ups include `params.last_backend_uuid`.
  - Related-query clicks include `params.last_backend_uuid` and `params.is_related_query: "True"`.
- **Stream framing**:
  - `event: message` frames carrying JSON `data:` objects.
  - Frames are separated by `\r\n\r\n` in HAR captures (parser supports both `\r\n\r\n` and `\n\n`).
  - Final answer frame includes `"status": "COMPLETED"` alongside `"final": true` and/or `"final_sse_message": true`, followed by `event: end_of_stream`.
- **Identifiers in stream**:
  - `context_uuid`: Thread context UUID required by the rename endpoint.
  - `read_write_token`: Write authorization token appearing in the opening frame of the stream; required by the rename endpoint.
  - `backend_uuid`: Answer entry UUID corresponding to the thread URL slug (`/search/<slug>`).
- **Answer text extraction**:
  - Items with `"type": "WORKFLOW_ITEM_TEXT"` and `payload.text_payload.variant === "answer"`.
  - `payload.text_payload.text` contains the complete accumulated answer text; `chunks` duplicates `text` and is used only as a fallback when `text` is empty.

## 2. Thread Rename (`POST /rest/thread/set_thread_title`)

```http
POST https://www.perplexity.ai/rest/thread/set_thread_title?version=2.18&source=default
Content-Type: application/json
x-app-apiclient: default
x-app-apiversion: 2.18
x-perplexity-request-reason: thread-item
x-pplx-account: <user.id from /api/auth/session>
x-request-id: <random UUID v4>

{
  "context_uuid": "...",
  "title": "...",
  "read_write_token": "..."
}
```

- **Expected success status**: `204 No Content`.
- **Authentication**: First-party session cookies (`credentials: "include"` from same-origin MAIN world).

## 3. Account Identifier (`GET /api/auth/session`)

- Returns JSON containing `user.id` (used for the `x-pplx-account` header).
- No other fields from `/api/auth/session` are stored or logged.
