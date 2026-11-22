// `bun refresh`: fetch the newest closes for the watchlist from the command line.
import { refreshSnapshot } from '../src/server/snapshot.ts';

try {
  console.log(await refreshSnapshot());
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
