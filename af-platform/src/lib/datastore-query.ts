/**
 * AcceleFreight Platform — Datastore Query Adapter
 *
 * The existing src/lib/datastore.ts exposes getKind<T>() and getEntity<T>()
 * which are sufficient for simple all-record fetches (e.g. users, roles).
 *
 * For the companies and shipments modules we need:
 * - Filtered queries (trash=false, company_id=X)
 * - Ordering (order by updated DESC)
 * - Pagination (Datastore cursor)
 * - Multi-key batch gets
 * - Write access (for system logs)
 *
 * This file exports `getDatastore()` — the raw @google-cloud/datastore client.
 * Import this instead of the existing datastore.ts when you need query access.
 *
 * USAGE:
 *   import { getDatastore } from '@/lib/datastore-query';
 *   const ds = getDatastore();
 *   let q = ds.createQuery('Company').filter('trash','=',false).order('name').limit(200);
 *   const [entities] = await ds.runQuery(q);
 *
 * NOTE: If the existing datastore.ts already exports the raw Datastore client
 * (e.g. as `getDatastore()`), you can update the import in companies.ts,
 * shipments.ts, and auth-server.ts to point to './datastore' instead of
 * './datastore-query' and delete this file.
 */

import { Datastore } from '@google-cloud/datastore';

let _datastore: Datastore | null = null;

export function getDatastore(): Datastore {
  if (_datastore) return _datastore;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT_ID env var is not set. ' +
      'Add it to .env.local (e.g. GOOGLE_CLOUD_PROJECT_ID=cloud-accele-freight).'
    );
  }

  _datastore = new Datastore({ projectId });
  return _datastore;
}
