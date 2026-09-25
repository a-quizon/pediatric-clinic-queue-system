/**
 * Copy the installable debug APK into Vite's public folder under a stable name
 * so Firebase Hosting can serve /downloads/pediatric-clinic.apk.
 *
 * Usage: npm run apk:stage
 *
 * The staged file is gitignored — run this before build/deploy.
 */
import { copyFile, access, mkdir, constants } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const SOURCE = join(root, "apk-output", "pediatric-clinic-queue-v1.8-debug.apk");
const DEST_DIR = join(root, "client", "public", "downloads");
const DEST = join(DEST_DIR, "pediatric-clinic.apk");

try {
  await access(SOURCE, constants.R_OK);
} catch {
  console.error(
    `[apk:stage] Missing source APK:\n  ${SOURCE}\nPlace the v1.8 debug APK in apk-output/ and retry.`
  );
  process.exit(1);
}

await mkdir(DEST_DIR, { recursive: true });
await copyFile(SOURCE, DEST);
console.log(`[apk:stage] Staged:\n  ${SOURCE}\n→ ${DEST}`);
