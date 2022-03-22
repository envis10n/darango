import { axiod } from "./deps.ts";
import { ArangoCursor } from "./cursor.ts";
import { Document } from "./collection.ts";

// TODO: Add graph class and allow for traversals

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
    max: number,
    min = 1,
  ): AsyncIterable<Document<T>[]> {
    const query =
      `FOR vertex, edge IN ${min}..${max} ${direction} '${startVertex}' GRAPH '${this.name}'\n\tRETURN {'vertex': vertex, 'edge': edge}`;
    return new ArangoCursor(this.ax, query);
  }
  public shortestPath<T>(
    startVertex: string,
    endVertex: string,
    direction: "OUTBOUND" | "INBOUND" | "ANY",
  ): AsyncIterable<Document<T>[]> {
    const query =
      `FOR vertex, edge IN ${direction} SHORTEST_PATH '${startVertex}' TO '${endVertex}' GRAPH '${this.name}'\n\tRETURN {'vertex': vertex, 'edge': edge}`;
    return new ArangoCursor(this.ax, query);
  }
}
