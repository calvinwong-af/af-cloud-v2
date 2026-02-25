import { Datastore } from "@google-cloud/datastore";

let _ds: Datastore | undefined;

function ds(): Datastore {
  if (!_ds) {
    _ds = new Datastore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
  }
  return _ds;
}

export async function getKind<T>(kindName: string): Promise<T[]> {
  const query = ds().createQuery(kindName);
  const [entities] = await ds().runQuery(query);
  return entities.map((entity) => {
    const key = entity[Datastore.KEY];
    const { [Datastore.KEY]: _, ...data } = entity;
    return { uid: key.name ?? key.id, ...data } as T;
  });
}

export async function getEntity<T>(kindName: string, id: string): Promise<T | null> {
  const key = ds().key([kindName, id]);
  const [entity] = await ds().get(key);
  if (!entity) return null;
  const { [Datastore.KEY]: _, ...data } = entity;
  return { uid: id, ...data } as T;
}
