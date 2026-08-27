/**
 * Generate a VAPID key pair for Web Push.
 *
 * Usage:
 *   npm run generate-vapid
 *   npx web-push generate-vapid-keys
 *
 * Then set:
 *   server/.env              VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 *   client/.env              VITE_VAPID_PUBLIC_KEY=<public key>
 *   client/functions/.env    VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 */
const webpush = require("web-push");

const keys = webpush.generateVAPIDKeys();

console.log("\nVAPID keys generated. Store the private key only on the server.\n");
console.log("Public Key:\n" + keys.publicKey + "\n");
console.log("Private Key:\n" + keys.privateKey + "\n");
console.log("Add to server/.env:");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:clinic@example.com\n");
console.log("Add to client/.env:");
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}\n`);
