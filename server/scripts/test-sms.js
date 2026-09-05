#!/usr/bin/env node
/**
 * CLI SMS tester for textbee.dev
 *
 * Usage:
 *   npm run sms:test -- 9171234567
 *   npm run sms:test -- +639171234567 "Custom message here"
 *
 * Note: Avoid process.exit() after fetch on Windows (Node 23+/24 libuv assertion).
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { sendSms, normalizePhoneE164, isSmsConfigured } = require("../services/smsService");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  const phoneArg = process.argv[2];
  const messageArg = process.argv[3];

  if (!phoneArg) {
    fail("Usage: npm run sms:test -- <phone> [message]\nExample: npm run sms:test -- 9171234567");
    return;
  }

  if (!isSmsConfigured()) {
    fail("TEXTBEE_API_KEY is missing in server/.env");
    return;
  }

  const phone = normalizePhoneE164(phoneArg);
  if (!phone) {
    fail(`Invalid phone number: ${phoneArg}`);
    return;
  }

  const message =
    messageArg ||
    `Pediatric Clinic Queue — SMS CLI test at ${new Date().toLocaleString("en-PH")}.`;

  console.log(`Sending to ${phone} ...`);
  const result = await sendSms(phone, message);
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    process.exitCode = 1;
    return;
  }

  console.log("Queued by textbee. Check the gateway phone / textbee dashboard for delivery.");
  process.exitCode = 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
