import { pingDatabase } from '../src/mongodb.ts';
import { createReadinessHandler } from '../src/readiness.ts';

export default {
  fetch: createReadinessHandler({ ping: pingDatabase, token: () => process.env.READINESS_TOKEN }),
};
