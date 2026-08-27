// ── Configure these values before building the app ─────────────────────────

/** Content type ID for imported entries */
export const CONTENT_TYPE_ID = 'task';

/** Field ID for the entry title */
export const TITLE_FIELD_ID = 'title';

/** Field ID for the Rich Text body */
export const BODY_FIELD_ID = 'body';

/** Field ID for the slug (set to empty string to skip) */
export const SLUG_FIELD_ID = 'slug';

/** Locale to write fields into */
export const LOCALE = 'en-US';

/** How many files to process in parallel */
export const IMPORT_CONCURRENCY = 5;
