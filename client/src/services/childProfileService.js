import { getDb } from "../firebase/database";
import { ref, push, set, update, remove } from "firebase/database";
import { subscribeOnValue } from "../firebase/rtdbSubscribe";
import { formatName } from "../utils/stringUtils";
import { getBirthdateError } from "../utils/pediatricAge";

const childrenRef = (uid) => ref(getDb(), `users/${uid}/children`);
const childRef = (uid, childId) => ref(getDb(), `users/${uid}/children/${childId}`);

const toChildList = (raw) => {
  if (!raw) return [];
  return Object.entries(raw)
    .map(([id, value]) => ({
      id,
      childName: value.childName || "",
      birthdate: value.birthdate ? String(value.birthdate) : "",
      // Legacy age kept for staff fallback until parent supplies birthdate
      age: value.age != null && value.age !== "" ? String(value.age) : "",
      sex: value.sex || "",
      createdAt: value.createdAt || 0,
    }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
};

const normalizePayload = (data) => {
  const birthdate = String(data.birthdate || "").trim();
  const error = getBirthdateError(birthdate);
  if (error) throw new Error(error);
  return {
    childName: formatName(data.childName || ""),
    birthdate,
    sex: data.sex || "",
  };
};

export const subscribeToChildren = (uid, callback) => {
  if (typeof callback !== "function") return () => {};
  if (!uid) {
    callback([]);
    return () => {};
  }
  return subscribeOnValue(childrenRef(uid), (snapshot) => {
    callback(toChildList(snapshot.val()));
  });
};

export const addChild = async (uid, data) => {
  const newRef = push(childrenRef(uid));
  await set(newRef, {
    ...normalizePayload(data),
    createdAt: Date.now(),
  });
  return newRef.key;
};

export const updateChild = async (uid, childId, data) => {
  const payload = normalizePayload(data);
  await update(childRef(uid, childId), {
    ...payload,
    updatedAt: Date.now(),
    // Stop writing age; leave existing legacy age unless we clear it after birthdate set
    age: null,
  });
};

export const removeChild = async (uid, childId) => {
  await remove(childRef(uid, childId));
};
