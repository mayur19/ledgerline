import type { Logger } from 'pino';
import type { Env } from './config/env';
import type { Db } from './db/pool';
import type { AuthThrottle } from './http/login-throttle';

/** Everything a route module needs, injected once at app construction (no globals). */
export interface AppDeps {
  readonly env: Env;
  readonly logger: Logger;
  readonly db: Db;
  readonly version: string;
  readonly throttle: AuthThrottle;
}
