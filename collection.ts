import { axiod } from "./deps.ts";
import { ArangoCursor, CursorOptions } from "./cursor.ts";

export interface DocumentBase {
  update(): Promise<void>;
  delete(): Promise<boolean>;
}

export type Document<T> =
  & DocumentData<T>
  & DocumentBase;

export type DocumentID = { _id: string; _key: string; _rev: string };
export type DocumentData<T> = T & DocumentID;

export type DocumentFilter<T> = {
  [Property in keyof DocumentData<T>]: string | DocumentData<T>[Property];
};

export class Collection<T> {
  constructor(private ax: typeof axiod, public readonly name: string) {
    //
  }
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
  public async query(
    aql: string,
    options?: CursorOptions,
  ): Promise<Document<T>[]> {
    const res = await new ArangoCursor<T>(this.ax, aql, options).collect();
    return res.map((d) => this.makeDocument(d));
  }
  public async truncate(): Promise<void> {
    const res = await this.ax.put(`/_api/collection/${this.name}/truncate`);
    if (res.data.error) {
      throw new Error(
        `Unable to truncate collection: ${res.data.errorMessage}`,
      );
    }
  }
}
