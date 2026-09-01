import { database } from "../firebase/database";
import { ref, push, set, update, remove, onValue } from "firebase/database";
import { formatName } from "../utils/stringUtils";

const childrenRef = (uid) => ref(database, `users/${uid}/children`);
const childRef = (uid, childId) => ref(database, `users/${uid}/children/${childId}`);

const toChildList = (raw) => {
  if (!raw) return [];
  return Object.entries(raw).map(([id, value]) => ({
    id,
    childName: value.childName || "",
    age: value.age != null ? String(value.age) : "",
    sex: value.sex || "",
    createdAt: value.createdAt || 0
  })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
};

const normalizePayload = (data) => ({
  childName: formatName(data.childName || ""),
  age: String(data.age || "").trim(),
  sex: data.sex || ""
});

export const subscribeToChildren = (uid, callback) => {
  if (!uid) {
    callback([]);
    return () => {};
  }
  return onValue(childrenRef(uid), (snapshot) => {
    callback(toChildList(snapshot.val()));
  });
};

export const addChild = async (uid, data) => {
  const newRef = push(childrenRef(uid));
  await set(newRef, {
    ...normalizePayload(data),
    createdAt: Date.now()
  });
  return newRef.key;
};

export const updateChild = async (uid, childId, data) => {
  await update(childRef(uid, childId), {
    ...normalizePayload(data),
    updatedAt: Date.now()
  });
};

export const removeChild = async (uid, childId) => {
  await remove(childRef(uid, childId));
};
