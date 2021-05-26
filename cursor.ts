import { axiod } from "./deps.ts";
import { DocumentData } from "./collection.ts";

export interface Cursor<T> {
  result: DocumentData<T>[];
  id: string;
  hasMore: boolean;
  code: number;
  error: boolean;
  count: number;
}

export interface CursorOptions {
  count?: boolean;
  batchSize?: number;
}

export class ArangoCursor<T> implements AsyncIterable<DocumentData<T>[]> {
  id: string | null;
  private options: CursorOptions;
  hasMore: boolean;
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
