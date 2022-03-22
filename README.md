[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/darango/mod.ts)

# DArango

An ArangoDB driver for Deno.

```ts
import { Arango } from "https://deno.land/x/darango/mod.ts";
```

## Features

- [x] Collection create, get, and truncate.
- [x] Document get, find, update, delete.
- [x] AQL query support, returning the result set as a specific generic type.
- [x] AQL query on a collection, returning results as Documents.
- [x] Graph get, traversal, and shortest_path.
- [x] Edge collection get.

_More planned for future releases._

## Usage

Here are some examples for getting a client instance.

### Authenticating

#### Basic Auth

```ts
import { Arango } from "https://deno.land/x/darango/mod.ts";

// Connect and obtain a JWT token from the server by providing basic auth details.
const arango = await Arango.basicAuth({
  uri: "http://localhost:8529/_db/some_db",
  username: "arango",
  password: "arango",
});
```

#### JWT Auth

```ts
import { Arango } from "https://deno.land/x/darango/mod.ts";

// Connect and test that the token works by checking for DBs the token can access.
const arango = await Arango.jwtAuth({
  uri: "http://localhost:8529/_db/some_db",
  jwt: "JWT Token Here",
});
```

### Getting a Collection

```ts
// Some dummy interface to use as the document structure.
interface TestType {
  code: number;
  text: string;
}

const collection = await arango.collection<TestType>("test");

// OR

const collection = await arango.createCollection<TestType>("test");
```

The generic type provided for `Collection<T>` will be used as the document type.
`Document<T>` is a joined type including `_id`, `_key`, and `_rev` fields, along
with your own interface's fields.

### Modifying a Document

```ts
// Some dummy interface to use as the document structure.
interface TestType {
  code: number;
  text: string;
}

const collection = await arango.collection<TestType>("test");

const doc = await collection.get("documentkey");

// Update document's fields.
doc.code = 200;
doc.text = "Hello, world!";

// Update document on the server. After this call, the _rev field will be updated on the object to match the new revision.
await doc.update();

// Delete the document. Do not use it after this, since the key will no longer exist on the server.
await doc.delete();
```

### Running an AQL query

#### Query with custom type definition

```ts
// Some dummy interface to use as the document structure.
interface TestType {
  code: number;
  text: string;
}

const cursor = await arango.query<TestType>("FOR d IN test RETURN d");

for await (const docs of cursor) {
  // Each loop here will continue calling the cursor, until it is exhausted on the server side.
  for (const doc of docs) {
    // Document data available, but cannot be directly manipulated and updated on the server.
    console.log(doc.code); // Log the code
  }
}
```

#### Query from collection object

```ts
// Some dummy interface to use as the document structure.
interface TestType {
  code: number;
  text: string;
}

const collection = await arango.collection<TestType>("test");

// This is mainly a helper that is calling arango.query<TestType>, but also transforms the results set to contain actual Document<T> objects.
const results = await collection.query("FOR d IN test RETURN d");
for (const doc of results) {
  // Document data available as if you had called collection.get("key")
  doc.code = 200;
  await doc.update();
}
```
