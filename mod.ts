import { axiod } from "./deps.ts";
import { Collection } from "./collection.ts";
import { ArangoCursor, CursorOptions } from "./cursor.ts";

interface ArangoOptionsBase {
  uri: string;
}

interface ArangoOptionsBasicAuth extends ArangoOptionsBase {
  username: string;
  password: string;
}

interface ArangoOptionsJWT extends ArangoOptionsBase {
  jwt: string;
}

export class Arango {
  public ax: typeof axiod;
  constructor(
    private readonly uri: string,
    public jwt: string,
  ) {
    this.ax = axiod.create({
      "baseURL": this.uri,
      "headers": {
        "Authorization": `bearer ${this.jwt}`,
      },
    });
  }
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
  public query<T>(aql: string, options?: CursorOptions): ArangoCursor<T> {
    return new ArangoCursor(this.ax, aql, options);
  }
  public async collection<T>(name: string): Promise<Collection<T>> {
    const res = await this.ax.get(`/_api/collection/${name}`);
    if (res.status != 200) throw new Error("Unable to find collection.");
    return new Collection(this.ax, name);
  }
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
}
