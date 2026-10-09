// Contract v2 building blocks. Routes are implemented in MCAH-02..10.
const SCHEMA_VERSION = 2
const id = { type: 'integer', minimum: 1 }
const version = { type: 'integer', minimum: 0 }
const text = { type: 'string', minLength: 1, maxLength: 500, pattern: '\\S' }
const nullableValue = { type: ['string', 'number', 'boolean', 'object', 'array', 'null'] }
const mutation = {
  type: 'object', additionalProperties: false,
  required: ['lock_version', 'expected_revision', 'reason'],
  properties: { lock_version: version, expected_revision: version, reason: text },
}
const source = {
  type: 'object', additionalProperties: false,
  required: ['document_id', 'page_id', 'record_key'],
  properties: {
    document_id: id, page_id: id,
    record_key: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9_-]+$' },
    locator: { type: 'object', additionalProperties: false, properties: {
      sheet: { type: 'string', minLength: 1, maxLength: 100 },
      row: id, column: { type: 'string', minLength: 1, maxLength: 10 },
      bbox: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'number', minimum: 0, maximum: 1 } },
    } },
  },
}
const proposal = {
  type: 'object', additionalProperties: false,
  required: ['schema_version', 'source', 'record_type', 'field_key', 'raw', 'value', 'state', 'missing_reason', 'critical'],
  properties: {
    schema_version: { const: SCHEMA_VERSION }, source,
    record_type: { enum: ['IDENTITY', 'SEA_SERVICE', 'CERTIFICATE'] },
    field_key: { type: 'string', minLength: 1, maxLength: 40, pattern: '^[a-z][a-z0-9_]*$' },
    raw: nullableValue, value: nullableValue,
    state: { enum: ['PROPOSED', 'UNKNOWN', 'DATE_AMBIGUOUS'] },
    missing_reason: { type: ['string', 'null'], minLength: 1, maxLength: 100 },
    critical: { type: 'boolean' },
  },
  allOf: [{ if: { properties: { state: { const: 'UNKNOWN' } } },
    then: { properties: { value: { type: 'null' }, missing_reason: { type: 'string', minLength: 1 } } } }],
}
const decision = {
  type: 'object', additionalProperties: false,
  required: ['lock_version', 'expected_revision', 'action', 'reason'],
  properties: {
    ...mutation.properties,
    action: { enum: ['accept', 'edit', 'reject', 'keepUnknown', 'undo'] },
    value: nullableValue,
    reason: { type: ['string', 'null'], minLength: 1, maxLength: 500 },
  },
  allOf: [
    { if: { properties: { action: { enum: ['edit', 'reject'] } } }, then: { properties: { reason: text } } },
    { if: { properties: { action: { const: 'edit' } } }, then: { required: ['value'], properties: { value: { type: ['string', 'number', 'boolean', 'object', 'array'] } } } },
  ],
}
const pagination = {
  type: 'object', additionalProperties: false,
  properties: { after_id: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
}
const snapshot = {
  type: 'object', additionalProperties: false,
  required: ['schema_version', 'revision_no', 'profile', 'sea_service', 'sources', 'certificates', 'contacts'],
  properties: {
    schema_version: { const: 2 }, revision_no: id, profile: { type: 'object', required: ['id'] },
    sea_service: { type: 'array', items: { type: 'object' } },
    sources: { type: 'array', items: { type: 'object' } },
    certificates: { type: 'array', items: { type: 'object' } },
    contacts: { type: 'array', items: { type: 'object' } },
  },
}
const TRANSITIONS = {
  document: { RECEIVED: ['QUEUED', 'FAILED'], QUEUED: ['READING', 'FAILED'], READING: ['REVIEW_REQUIRED', 'FAILED'], FAILED: ['QUEUED'], REVIEW_REQUIRED: ['COMPLETED'], COMPLETED: ['REVIEW_REQUIRED', 'PUBLISHED'], PUBLISHED: [] },
  job: { QUEUED: ['RUNNING', 'CANCELLED'], RUNNING: ['QUEUED', 'SUCCEEDED', 'FAILED'], FAILED: [], SUCCEEDED: [], CANCELLED: [] },
  export: { DRAFT: ['PENDING_APPROVAL', 'STALE'], PENDING_APPROVAL: ['RELEASED', 'REJECTED', 'STALE'], RELEASED: ['STALE'], REJECTED: [], STALE: [] },
}
function assertTransition(entity, from, to) {
  if (!TRANSITIONS[entity]?.[from]?.includes(to)) {
    throw { statusCode: 409, code: 'INVALID_STATE', message: 'Chuyển trạng thái không hợp lệ' }
  }
}
module.exports = { SCHEMA_VERSION, mutation, source, proposal, decision, pagination, snapshot, TRANSITIONS, assertTransition }
