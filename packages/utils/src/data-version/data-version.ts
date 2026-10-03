/**
 * Response header carrying the user's new data version after a write that changed their data. The
 * writing client records it, so its next check (`GET /data-version`) doesn't take its own write
 * for a change made elsewhere.
 */
export const DATA_VERSION_HEADER = 'X-Data-Version'
