import { axiod } from "./deps.ts";
import { ArangoCursor } from "./cursor.ts";
import { DocumentData } from "./collection.ts";

export interface EdgeDefinition {
  collection: string;
  from: string[];
  to: string[];
}

export interface GraphDefinition {
  _key: string;
  _rev: string;
  _id: string;
  name: string;
  edgeDefinitions: EdgeDefinition[];
  orphanCollections: string[];
}

export type GraphGetBase = {
  error: boolean;
  code: 200 | 404;
};

export type GraphGetOK = GraphGetBase & {
  error: false;
  code: 200;
  graph: GraphDefinition;
};

export type GraphGetERR = GraphGetBase & {
  error: true;
  code: 404;
  errorNum: number;
  errorMessage: string;
};

export type GraphGetResponse = GraphGetOK | GraphGetERR;

export interface GraphTraversalOptions<T> {
  prune?: Partial<T>;
  filter?: Partial<T>;
  limit?: number;
}

export class Graph {
  constructor(
    private readonly ax: typeof axiod,
    public readonly name: string,
  ) {
    //
  }
  public async get(): Promise<GraphDefinition> {
    const res = await this.ax.get<GraphGetResponse>(
      `/_api/gharial/${this.name}`,
    );
    const data = res.data;
    if (data.code == 404) throw new Error(data.errorMessage);
    else return data.graph;
  }
  public traversal<T>(
    startVertex: string,
    direction: "OUTBOUND" | "INBOUND" | "ANY",
    options?: GraphTraversalOptions<T>,
  ): ArangoCursor<DocumentData<T>> {
    if (options == undefined) options = {};
    let query = "FOR vertex IN";
    if (options.limit != undefined) {
      query += ` 1..${options.limit} ${direction} `;
    } else {
      query += ` ${direction} `;
    }
    query += ` '${startVertex}' GRAPH '${this.name}'\n`;
    if (options.prune != undefined) {
      for (const key of Object.keys(options.prune)) {
        query += `PRUNE vertex.${key} == ${
          JSON.stringify((options.prune as { [key: string]: any })[key])
        }\n`;
      }
    }
    if (options.filter != undefined) {
      for (const key of Object.keys(options.filter)) {
        query += `FILTER vertex.${key} == ${
          JSON.stringify((options.filter as { [key: string]: any })[key])
        }\n`;
      }
    }
    query += "RETURN vertex";
    return new ArangoCursor(this.ax, query);
  }
  public shortestPath<T>(
    startVertex: string,
    endVertex: string,
    direction: "OUTBOUND" | "INBOUND" | "ANY",
  ): ArangoCursor<DocumentData<T>> {
    const query =
      `FOR vertex IN ${direction} SHORTEST_PATH '${startVertex}' TO '${endVertex}' GRAPH '${this.name}'\n\tRETURN vertex`;
    return new ArangoCursor(this.ax, query);
  }
}
