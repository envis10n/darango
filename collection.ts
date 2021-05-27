import { axiod } from "./deps.ts";
import { ArangoCursor, CursorOptions } from "./cursor.ts";

/**
 * Define Document methods.
 */
export interface DocumentBase {
  update(): Promise<void>;
  delete(): Promise<boolean>;
}

/**
 * Join DocumentData<T> and DocumentBase
 */
export type Document<T> =
  & DocumentData<T>
  & DocumentBase;

/**
 * Document ID fields
 */
export type DocumentID = { _id: string; _key: string; _rev: string };

/**
 * Document Data and ID fields.
 */
export type DocumentData<T> = T & DocumentID;

/**
 * An object representing a collection on the ArangoDB server.
 */
export class Collection<T> {
  constructor(private ax: typeof axiod, public readonly name: string) {}
  /**
   * Get a document directly by its key
   * @param key The document key
   * @returns The document specified by the key.
   */
  public async get(key: string): Promise<Document<T>> {
    const res = await this.ax.get(`/_api/document/${this.name}/${key}`);
    if (res.status != 200) {
      throw new Error(`Unable to get document: ${res.data.errorMessage}`);
    }
    return this.makeDocument(res.data);
  }
  private async updateDocument(
    key: string,
    data: DocumentData<T>,
  ): Promise<void> {
    const res = await this.ax.patch(`/_api/document/${this.name}/${key}`, data);
    switch (res.status) {
      case 400:
      case 404:
      case 412:
        throw new Error(`Unable to update document: ${res.data.errorMessage}`);
      default: {
        const ids = res.data as DocumentID;
        data._rev = ids._rev;
      }
    }
  }
  private async deleteDocument(key: string): Promise<boolean> {
    const res = await this.ax.delete(`/_api/document/${this.name}/${key}`);
    switch (res.status) {
      case 404:
      case 412:
        return false;
      default:
        return true;
    }
  }
  private makeDocument(obj: DocumentData<T>): Document<T> {
    const data = Object.assign({}, obj);
    return Object.assign(data, {
      update: async () => {
        await this.updateDocument(data._key, data);
      },
      delete: async () => {
        return await this.deleteDocument(data._key);
      },
    });
  }
  /**
   * Create a new document in the collection.
   * @param data The initial document data.
   * @returns The document, as it exists on the server.
   */
  public async create(data: T): Promise<Document<T>> {
    const res = await this.ax.post(`/_api/document/${this.name}`, data);
    switch (res.status) {
      case 400:
      case 404:
        throw new Error(`Unable to create document. ${res.data.errorMessage}`);
      default: {
        const ids: DocumentID = res.data;
        const doc = await this.get(ids._key);
        if (doc == null) throw new Error("Unable to get created document.");
        return doc;
      }
    }
  }
  /**
   * Find multiple documents matching the filter provided.
   * @param filter Partial document data to filter results by.
   * @returns Documents matching the filter provided.
   */
  public async find(
    filter: Partial<DocumentData<T>>,
  ): Promise<Document<T>[]> {
    const filterStrings: string[] = [];
    // deno-lint-ignore no-explicit-any
    const filterAny: { [key: string]: any } = filter;
    for (const key of Object.keys(filterAny)) {
      filterStrings.push(
        `FILTER doc.${key} == ${JSON.stringify(filterAny[key])}`,
      );
    }
    const query = `FOR doc IN ${this.name}\n\t${
      filterStrings.join("\n\t")
    }\n\tRETURN doc`;
    return await this.query(query);
  }
  /**
   * Run a query, returning the results as Document objects.
   * @param aql The query string to execute.
   * @param options Cursor options.
   * @returns The collected results of the query, converted to Document objects.
   */
  public async query(
    aql: string,
    options?: CursorOptions,
  ): Promise<Document<T>[]> {
    const res = await new ArangoCursor<DocumentData<T>>(this.ax, aql, options)
      .collect();
    return res.map((d) => this.makeDocument(d));
  }
  /**
   * Truncate the collection.
   */
  public async truncate(): Promise<void> {
    const res = await this.ax.put(`/_api/collection/${this.name}/truncate`);
    if (res.data.error) {
      throw new Error(
        `Unable to truncate collection: ${res.data.errorMessage}`,
      );
    }
  }
}
