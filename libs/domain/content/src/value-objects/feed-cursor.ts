/**
 * Keyset-pagination cursor for publication feeds.
 *
 * A feed is ordered by (createdAt DESC, id DESC), so a stable cursor needs both
 * parts: createdAt alone is not unique when several posts share a timestamp.
 * The wire format is a base64url blob so callers treat it as opaque.
 */
export interface FeedCursorPosition {
  createdAt: Date;
  id: string;
}

const SEPARATOR = '|';

export class FeedCursor {
  /** Encode a position into the opaque token handed to API clients. */
  public static encode(position: FeedCursorPosition): string {
    const raw = `${position.createdAt.toISOString()}${SEPARATOR}${position.id}`;
    return Buffer.from(raw, 'utf8').toString('base64url');
  }

  /**
   * Decode an opaque token. Returns null for anything unparsable so a stale or
   * hand-crafted cursor degrades to "start from the beginning" instead of a 500.
   */
  public static decode(token: string | null | undefined): FeedCursorPosition | null {
    if (!token) {
      return null;
    }

    let raw: string;
    try {
      raw = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      return null;
    }

    const separatorIndex = raw.indexOf(SEPARATOR);
    if (separatorIndex <= 0) {
      return null;
    }

    const createdAt = new Date(raw.slice(0, separatorIndex));
    const id = raw.slice(separatorIndex + 1);
    if (Number.isNaN(createdAt.getTime()) || id.length === 0) {
      return null;
    }

    return { createdAt, id };
  }
}
