import { z } from 'zod';

/**
 * The content security policy of extension pages does not allow `eval`. Zod's
 * optimization that generates code at runtime is turned off; schema validation gives the
 * same result on a slower but safe path.
 */
z.config({ jitless: true });
