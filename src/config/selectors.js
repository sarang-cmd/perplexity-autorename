/**
 * Single source of truth for all Perplexity endpoints, headers, query parameters,
 * request/response payload fields, SSE stream markers, and internal message channels.
 *
 * Do NOT hardcode Perplexity URLs or field names in any other module.
 */

export const MESSAGE_NS = "ppx-autorename";

export const WINDOW_MESSAGES = {
  ANSWER_STARTED: "answer-started",
  ANSWER_COMPLETE: "answer-complete",
  USER_RENAME: "user-rename",
  RENAME_REQUEST: "page-rename-request",
  RENAME_RESPONSE: "page-rename-response",
  THREAD_DETAIL_REQUEST: "page-thread-detail-request",
  THREAD_DETAIL_RESPONSE: "page-thread-detail-response",
  LIST_THREADS_REQUEST: "page-list-threads-request",
  LIST_THREADS_RESPONSE: "page-list-threads-response",
};

export const RUNTIME_MESSAGES = {
  GET_STATE: "get-state",
  GENERATE_TITLE: "generate-title",
  RECORD_RENAME: "record-rename",
  RECORD_STATUS: "record-status",
  TEST_PROVIDER: "test-provider",
  SETTINGS_UPDATED: "settings-updated",
  PING_CONTENT: "ping-content",
  RENAME_CURRENT_CHAT: "rename-current-chat",
  START_BATCH_RENAME: "start-batch-rename",
  CANCEL_BATCH_RENAME: "cancel-batch-rename",
  GET_BATCH_STATUS: "get-batch-status",
  UPDATE_BATCH_STATUS: "update-batch-status",
};

export const PERPLEXITY_CONFIG = {
  origin: "https://www.perplexity.ai",
  hostPattern: "https://www.perplexity.ai/*",
  searchPathPrefix: "/search/",

  apiVersion: "2.18",
  apiClient: "default",
  source: "default",
  renameRequestReason: "thread-item",
  libraryRequestReason: "library",
  defaultLibraryPageSize: 20,

  endpoints: {
    askStreamPath: "/rest/sse/perplexity_ask",
    renamePath: "/rest/thread/set_thread_title",
    sessionPath: "/api/auth/session",
    listThreadsPath: "/rest/thread/list_ask_threads",
    listPinnedThreadsPath: "/rest/thread/list_pinned_ask_threads",
    threadDetailPathPrefix: "/rest/thread/",
  },

  queryParams: {
    version: "version",
    source: "source",
  },

  threadDetailQueryParams: {
    withParentInfo: "with_parent_info",
    withSchematizedResponse: "with_schematized_response",
    limit: "limit",
    offset: "offset",
    fromFirst: "from_first",
  },

  listRequestFields: {
    limit: "limit",
    offset: "offset",
    ascending: "ascending",
    searchTerm: "search_term",
  },

  listItemFields: {
    contextUuid: "context_uuid",
    contextUuidAlt: "contextUUID",
    slug: "slug",
    backendUuid: "backend_uuid",
    uuid: "uuid",
    title: "title",
    name: "name",
    queryStr: "query_str",
    firstMessagePreview: "first_message_preview",
    readWriteToken: "read_write_token",
    readWriteTokenAlt: "readWriteToken",
    lastQueryDatetime: "last_query_datetime",
    updatedDatetime: "updated_datetime",
    createdDatetime: "created_datetime",
    createdAt: "created_at",
    updatedAt: "updated_at",
    queryCount: "query_count",
    status: "status",
    completedStatus: "COMPLETED",
    hasNextPage: "has_next_page",
    containerKeys: ["threads", "items", "data", "results"],
  },

  threadDetailFields: {
    entries: "entries",
    hasNextPage: "has_next_page",
    contextUuid: "context_uuid",
    contextUuidAlt: "contextUUID",
    readWriteToken: "read_write_token",
    readWriteTokenAlt: "readWriteToken",
    backendUuid: "backend_uuid",
    uuid: "uuid",
    status: "status",
    completedStatus: "COMPLETED",
    queryStr: "query_str",
    query: "query",
    title: "title",
    threadTitle: "thread_title",
    thread: "thread",
    entryCreatedDatetime: "entry_created_datetime",
    entryUpdatedDatetime: "entry_updated_datetime",
    blocks: "blocks",
  },

  headers: {
    contentType: "Content-Type",
    apiClient: "x-app-apiclient",
    apiVersion: "x-app-apiversion",
    requestReason: "x-perplexity-request-reason",
    account: "x-pplx-account",
    requestId: "x-request-id",
  },

  askRequestFields: {
    params: "params",
    queryStr: "query_str",
    fallbackQuery: "query",
    lastBackendUuid: "last_backend_uuid",
    isRelatedQuery: "is_related_query",
  },

  renameBodyFields: {
    contextUuid: "context_uuid",
    title: "title",
    readWriteToken: "read_write_token",
  },

  sessionFields: {
    user: "user",
    userId: "id",
  },

  streamFields: {
    eventPrefix: "event:",
    dataPrefix: "data:",
    commentPrefix: ":",
    messageEvent: "message",
    endEvent: "end_of_stream",

    status: "status",
    completedStatus: "COMPLETED",
    final: "final",
    finalSseMessage: "final_sse_message",

    contextUuid: "context_uuid",
    contextUuidAlt: "contextUUID",
    readWriteToken: "read_write_token",
    readWriteTokenAlt: "readWriteToken",
    backendUuid: "backend_uuid",
    backendUuidAlt: "backendUUID",

    nestedContainers: ["entry", "thread", "metadata"],

    itemType: "type",
    workflowItemText: "WORKFLOW_ITEM_TEXT",
    payload: "payload",
    textPayload: "text_payload",
    variant: "variant",
    answerVariant: "answer",
    text: "text",
    chunks: "chunks",

    // Alternate/fallback stream structures
    blocks: "blocks",
    intendedUsage: "intended_usage",
    askTextUsage: "ask_text",
    askTextSectionPattern: /^ask_text_(\d+)_markdown$/,
    markdownBlock: "markdown_block",
    answer: "answer",
    stepType: "step_type",
    finalStepType: "FINAL",
    content: "content",
  },

  domMarkers: {
    pageInjectedAttr: "data-ppx-autorename-page",
    globalFlag: "__ppxAutorenameInstalled",
    toastHostId: "ppx-autorename-toast",
  },
};
