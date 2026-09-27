/**
 * Copy the installable debug APK into Vite's public folder under a stable name
 * so Firebase Hosting can serve /downloads/pediatric-clinic.apk.
 *
 * Usage: npm run apk:stage
 *
 * The source version is read from android/app/build.gradle (versionName).
 * The staged file is gitignored — run this before build/deploy.
 */
import { copyFile, access, mkdir, readFile, constants } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const gradle = await readFile(join(root, "android", "app", "build.gradle"), "utf8");
const versionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
if (!versionName) {
  console.error("[apk:stage] Could not read versionName from android/app/build.gradle");
  process.exit(1);
}

const SOURCE = join(root, "apk-output", `pediatric-clinic-queue-v${versionName}-debug.apk`);
const DEST_DIR = join(root, "client", "public", "downloads");
const DEST = join(DEST_DIR, "pediatric-clinic.apk");

try {
  await access(SOURCE, constants.R_OK);
} catch {
  console.error(
    `[apk:stage] Missing source APK:\n  ${SOURCE}\nPlace the v${versionName} debug APK in apk-output/ and retry.`
  );
  process.exit(1);
}

await mkdir(DEST_DIR, { recursive: true });
await copyFile(SOURCE, DEST);
console.log(`[apk:stage] Staged:\n  ${SOURCE}\n→ ${DEST}`);
