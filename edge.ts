import { axiod } from "./deps.ts";
import { Collection, Document, DocumentID } from "./collection.ts";

/**
 * Edge document definition.
 *
 * Returned from the ArangoDB server.
 */
export type EdgeDef = {
  _from: string;
  _to: string;
  $label: string;
} & DocumentID;

/**
 * Edge document GET response.
 */
export interface EdgeResponse {
  edges: EdgeDef[];
  error: boolean;
  code: number;
  stats: {
    writesExecuted: number;
    writesIgnored: number;
    scannedFull: number;
    scannedIndex: number;
    filtered: number;
    httpRequests: number;
    executionTime: number;
    peakMemoryUsage: number;
  };
}

/**
 * Edge document class.
 *
 * Allows getting the _to and _from documents
 * directly from their respective collections.
 */
export class Edge<T, F> {
  public readonly _from_collection: Collection<F>;
  public readonly _to_collection: Collection<T>;
  constructor(private ax: typeof axiod, public readonly _def: EdgeDef) {
    this._from_collection = new Collection(this.ax, _def._from.split("/")[0]);
    this._to_collection = new Collection(this.ax, _def._to.split("/")[0]);
  }
  /**
   * Get the document referenced in the _from field.
   * @returns The document referenced in the _from field.
   */
  public async from(): Promise<Document<F>> {
    return await this._from_collection.get(this._def._from.split("/")[1]);
  }
  /**
   * Get the document referenced in the _to field.
   * @returns The document referenced in the _to field.
   */
  public async to(): Promise<Document<T>> {
    return await this._to_collection.get(this._def._to.split("/")[1]);
  }
}

/**
 * Edge Collection class.
 *
 * A collection of edges used to add relations between vertices.
 */
export class EdgeCollection<T, F> {
  constructor(private ax: typeof axiod, public readonly name: string) {}
  /**
   * Internal method for getting edge documents from this collection.
   * @param vertex The vertex to get edges for.
   * @param direction Direction to use for searching in relation to the vertex.
   * @returns An array of Edge documents.
   */
  private async _internal(
    vertex: string,
    direction?: "in" | "out",
  ): Promise<Edge<T, F>[]> {
    const res = await this.ax.get<EdgeResponse>(
      `/_api/edges/${this.name}?vertex=${vertex}${
        direction != undefined ? `&direction=${direction}` : ""
      }`,
    );
    switch (res.status) {
      case 400:
        throw new Error("Invalid parameters provided.");
      case 404:
        throw new Error("Unable to find edge collection.");
    }
    return res.data.edges.map((_def) => new Edge<T, F>(this.ax, _def));
  }
  /**
   * Get Edge documents for both directions in relation to the vertex.
   * @param vertex The vertex to get edges for.
   * @returns An array of Edge documents in both directions.
   */
  public async any(vertex: string): Promise<Edge<T, F>[]> {
    return await this._internal(vertex);
  }
  /**
   * Get Edge documents coming IN to this vertex.
   * @param vertex The vertex to get edges for.
   * @returns An array of Edge documents coming IN to this vertex.
   */
  public async in(vertex: string): Promise<Edge<T, F>[]> {
    return await this._internal(vertex, "in");
  }
  /**
   * Get Edge documents going OUT from this vertex.
   * @param vertex The vertex to get edges for.
   * @returns An array of Edge documents going OUT from this vertex.
   */
  public async out(vertex: string): Promise<Edge<T, F>[]> {
    return await this._internal(vertex, "out");
  }
}
