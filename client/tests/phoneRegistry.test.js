import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const functionsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../functions");
const requireFromFunctions = createRequire(path.join(functionsDir, "package.json"));
const {
  assertPhoneAvailable,
  reservePhone,
  bindPhone,
  phoneToKey,
  PHONE_IN_USE_MESSAGE,
  normalizePhoneE164,
} = requireFromFunctions("./phoneRegistry.js");

function createMemoryDb(initial = {}) {
  const root = structuredClone(initial);
  const parts = (nodePath) => String(nodePath || "").split("/").filter(Boolean);
  const get = (nodePath) =>
    parts(nodePath).reduce(
      (node, key) => (node == null || typeof node !== "object" ? undefined : node[key]),
      root
    );
  const set = (nodePath, value) => {
    const keys = parts(nodePath);
    let node = root;
    for (let i = 0; i < keys.length - 1; i += 1) {
      if (node[keys[i]] == null || typeof node[keys[i]] !== "object") node[keys[i]] = {};
      node = node[keys[i]];
    }
    if (value == null) delete node[keys[keys.length - 1]];
    else node[keys[keys.length - 1]] = structuredClone(value);
  };
  const snapshot = (value) => ({
    exists: () => value != null,
    val: () => (value == null ? null : structuredClone(value)),
    forEach: (cb) => {
      if (value == null || typeof value !== "object") return false;
      Object.keys(value).forEach((key) => {
        cb({
          key,
          val: () => structuredClone(value[key]),
        });
      });
      return false;
    },
  });

  const orderByChild = (field) => ({
    equalTo: (candidate) => ({
      once: async () => {
        const users = get("users") || {};
        const matches = {};
        for (const [uid, user] of Object.entries(users)) {
          if (user && user[field] === candidate) matches[uid] = user;
        }
        const value = Object.keys(matches).length ? matches : null;
        return snapshot(value);
      },
    }),
  });

  const ref = (nodePath = "") => ({
    once: async () => snapshot(get(nodePath)),
    set: async (value) => set(nodePath, value),
    remove: async () => set(nodePath, null),
    update: async (updates) => set(nodePath, { ...(get(nodePath) || {}), ...updates }),
    orderByChild: nodePath === "users" || nodePath === "" ? orderByChild : undefined,
    transaction: async (fn) => {
      const current = get(nodePath);
      const next = fn(current == null ? null : structuredClone(current));
      if (next === undefined) return { committed: false, snapshot: snapshot(get(nodePath)) };
      set(nodePath, next);
      return { committed: true, snapshot: snapshot(get(nodePath)) };
    },
  });

  // phoneLookup uses db.ref("users").orderByChild(...)
  const db = {
    root,
    ref: (nodePath = "") => {
      const r = ref(nodePath);
      if (nodePath === "users") {
        r.orderByChild = orderByChild;
      }
      return r;
    },
  };
  return db;
}

describe("phoneRegistry + normalize", () => {
  it("normalizes PH formats to the same E.164 value", () => {
    assert.equal(normalizePhoneE164("09171234567"), "+639171234567");
    assert.equal(normalizePhoneE164("+639171234567"), "+639171234567");
    assert.equal(normalizePhoneE164("639171234567"), "+639171234567");
    assert.equal(normalizePhoneE164("917-123-4567"), "+639171234567");
    assert.equal(normalizePhoneE164("917 123 4567"), "+639171234567");
  });

  it("rejects a duplicate mobile number already on another account", async () => {
    const db = createMemoryDb({
      users: {
        u1: { phone: "+639171234567", role: "parent", status: "active" },
      },
    });
    await assert.rejects(
      () => assertPhoneAvailable(db, "0917-123-4567"),
      (err) => err.code === "phone_in_use" && err.message === PHONE_IN_USE_MESSAGE
    );
  });

  it("reserves then binds a phone for registration", async () => {
    const db = createMemoryDb({ users: {} });
    const phone = await reservePhone(db, "09171234567", {
      verificationId: "ver-1",
      purpose: "register",
    });
    assert.equal(phone, "+639171234567");
    const key = phoneToKey(phone);
    assert.equal(db.root.phoneRegistry[key].verificationId, "ver-1");

    await bindPhone(db, phone, "uid-new", {
      verificationId: "ver-1",
      purpose: "register",
    });
    assert.equal(db.root.phoneRegistry[key].uid, "uid-new");
  });

  it("rejects a second reservation while an in-flight reserve exists", async () => {
    const db = createMemoryDb({ users: {} });
    await reservePhone(db, "+639171234567", {
      verificationId: "ver-1",
      purpose: "register",
    });
    await assert.rejects(
      () =>
        reservePhone(db, "09171234567", {
          verificationId: "ver-2",
          purpose: "register",
        }),
      (err) => err.code === "phone_in_use"
    );
  });
});
