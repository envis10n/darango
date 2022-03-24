import { axiod } from "./deps.ts";
import { Collection } from "./collection.ts";
import { EdgeCollection } from "./edge.ts";
import { ArangoCursor, CursorOptions } from "./cursor.ts";
import { EdgeDefinitions, Graph, GraphCreateOptions } from "./graph.ts";

/**
 * Base options required.
 */
interface ArangoOptionsBase {
  uri: string;
}

/**
 * Basic Auth options.
 */
interface ArangoOptionsBasicAuth extends ArangoOptionsBase {
  username: string;
  password: string;
}

/**
 * JWT Auth options.
 */
interface ArangoOptionsJWT extends ArangoOptionsBase {
  jwt: string;
}

/**
 * The ArangoDB client.
 */
export class Arango {
  private ax: typeof axiod;
  constructor(
    private readonly uri: string,
    private jwt: string,
  ) {
    this.ax = axiod.create({
      "baseURL": this.uri,
      "headers": {
        "Authorization": `bearer ${this.jwt}`,
      },
    });
  }
  /**
   * Create a new Arango instance by first obtaining a valid JWT token.
   * @param options Options required for Basic Auth.
   * @returns A new Arango instance.
   */
  public static async basicAuth(
    options: ArangoOptionsBasicAuth,
  ): Promise<Arango> {
    const res = await axiod({
      "baseURL": options.uri,
      "url": "/_open/auth",
      "method": "post",
      "data": { username: options.username, password: options.password },
    });
    if (res.status != 200) {
      throw new Error(`Bad response from server: ${res.statusText}`);
    }
    return new Arango(options.uri, res.data.jwt);
  }
  /**
   * Create a new Arango instance using a previously obtained JWT token, validating it first.
   * @param options Options required for JWT Auth.
   * @returns A new Arango instance.
   */
  public static async jwtAuth(options: ArangoOptionsJWT): Promise<Arango> {
    const res = await axiod({
      "baseURL": options.uri,
      "url": "/_api/database/user",
      headers: {
        "Authorization": `bearer ${options.jwt}`,
      },
      "method": "get",
    });
    if (res.status != 200) {
      throw new Error(`Bad response from server: ${res.statusText}`);
    }
    return new Arango(options.uri, options.jwt);
  }
  /**
   * Create a new Cursor to execute a query. NOTE: Data returned by this cannot be turned into a Document object for direct modification.
   * @param aql The query string to be executed.
   * @param options Cursor options.
   * @returns A new ArangoCursor that can be asynchronously iterated or collected.
   */
  public query<T>(aql: string, options?: CursorOptions): ArangoCursor<T> {
    return new ArangoCursor(this.ax, aql, options);
  }
  /**
   * Get an existing collection by name.
   * @param name The name of the collection to get.
   * @returns A Collection instance.
   */
  public async collection<T>(name: string): Promise<Collection<T>> {
    const res = await this.ax.get(`/_api/collection/${name}`);
    if (res.status != 200) throw new Error("Unable to find collection.");
    return new Collection(this.ax, name);
  }
  /**
   * Get an existing Edge collection by name.
   * @param name The name of the edge collection.
   * @returns An EdgeCollection instance.
   */
  public async edgeCollection<T, F>(
    name: string,
  ): Promise<EdgeCollection<T, F>> {
    const res = await this.ax.get(`/_api/collection/${name}`);
    if (res.status != 200) throw new Error("Unable to find collection.");
    return new EdgeCollection(this.ax, name);
  }
  public async graph(name: string): Promise<Graph> {
    const res = await this.ax.get(`/_api/gharial/${name}`);
    if (res.status == 404) throw new Error("Unable to find graph.");
    else return new Graph(this.ax, name);
  }
  /**
   * @param name The name of the collection.
   * @param edge Optional. Make this an edge collection.
   * @returns The new collection as a Collection instance.
   */
  public async createCollection<T>(
    name: string,
    edge?: boolean,
  ): Promise<Collection<T>> {
    const res = await this.ax.post("/_api/collection", {
      name,
      type: edge ? 3 : 2,
    });
    switch (res.status) {
      case 400:
      case 404:
        throw new Error(
          `Unable to create collection: ${res.data.errorMessage}`,
        );
      default:
        return new Collection(this.ax, name);
    }
  }
  /**
   * Get all graphs stored on this instance.
   * @returns An array of all graphs.
   */
  public async listGraphs(): Promise<Graph[]> {
    const res = await this.ax.get<{ graphs: [{ name: string }] }>(
      "/_api/gharial",
    );
    if (res.status != 200) throw new Error("Unable to get graph list.");
    const graphs: Graph[] = [];
    for (const g of res.data.graphs) {
      graphs.push(await this.graph(g.name));
    }
    return graphs;
  }
  /**
   * Create a graph on this instance.
   * @param name The name of the graph.
   * @param edges Edge definitions for this graph.
   * @param orphans Orphaned vertex collections.
   * @returns The created graph.
   */
  public async createGraph(
    name: string,
    edges: EdgeDefinitions[],
    ...orphans: string[]
  ): Promise<Graph> {
    const opts: GraphCreateOptions = {
      name,
      edgeDefinitions: edges,
      orphanCollections: orphans,
      isSmart: false,
      isDisjoint: false,
      options: {},
    };
    const res = await this.ax.post(`/_api/gharial`, opts);
    switch (res.status) {
      case 400:
      case 403:
      case 409:
        throw new Error(res.data.errorMessage);
      default:
        return await this.graph(name);
    }
  }
}
