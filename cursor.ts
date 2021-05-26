import { axiod } from "./deps.ts";
import { DocumentData } from "./collection.ts";

/**
 * A Cursor object from the server.
 */
export interface Cursor<T> {
  result: DocumentData<T>[];
  id: string;
  hasMore: boolean;
  code: number;
  error: boolean;
  count: number;
}

/**
 * Options for a Cursor.
 */
export interface CursorOptions {
  count?: boolean;
  batchSize?: number;
}

/**
 * A Cursor object capable of executing a query and returning the results sets.
 */
export class ArangoCursor<T> implements AsyncIterable<DocumentData<T>[]> {
  private id: string | null;
  private options: CursorOptions;
  private hasMore: boolean;
  constructor(
    private readonly ax: typeof axiod,
    public readonly query: string,
    options?: CursorOptions,
  ) {
    //
    this.id = null;
    this.hasMore = false;
    this.options = options || {};
  }
  private getOptions(): { query: string } & CursorOptions {
    return Object.assign({}, this.options, { query: this.query });
  }
  /**
   * Collect all of the results sets and return them as a single array.
   * @returns All of the results sets from this query flattened into a 1D array.
   */
  public async collect(): Promise<DocumentData<T>[]> {
    const res: DocumentData<T>[] = [];
    for await (const docs of this) {
      res.push(...docs);
    }
    return res;
  }
  async *[Symbol.asyncIterator](): AsyncIterableIterator<DocumentData<T>[]> {
    while (this.hasMore || this.id === null) {
      const res = await this.ax.post(
        `/_api/cursor${this.id === null ? "" : `/${this.id}`}`,
        this.id === null ? this.getOptions() : undefined,
      );
      switch (res.status) {
        case 400:
        case 404:
        case 405:
          throw new Error(`Unable to get cursor: ${res.data.errorMessage}`);
        default: {
          const cursor: Cursor<T> = res.data;
          this.id = cursor.id || null;
          this.hasMore = cursor.hasMore;
          yield cursor.result.filter((v) => v !== null);
          break;
        }
      }
      if (!this.hasMore) break;
    }
  }
}
