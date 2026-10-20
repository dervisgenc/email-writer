// The root package.json is the only place the version is kept; bundling takes it from there.
import { version } from '../../../package.json';

export const HOST_VERSION: string = version;
