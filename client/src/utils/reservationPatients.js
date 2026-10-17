import { getBirthdateError } from "./pediatricAge.js";

const asChildList = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "object") return Object.values(raw).filter(Boolean);
  return [];
};

export const getReservationChildren = (reservation) => {
  if (!reservation) return [];
  const fromArray = asChildList(reservation.children);
  if (fromArray.length > 0) return fromArray;
  if (reservation.childName) {
    return [
      {
        childId: reservation.childId || null,
        childName: reservation.childName,
        birthdate: reservation.birthdate || "",
        age: reservation.age,
        sex: reservation.sex,
      },
    ];
  }
  return [];
};

export const getReservationChildDisplayName = (reservation, fallback = "N/A") => {
  const names = getReservationChildren(reservation)
    .map((child) => child.childName)
    .filter(Boolean);
  return names.length ? names.join(", ") : fallback;
};

export const buildPatientInfoPayload = (selectedChildren, concern = "") => {
  const children = (selectedChildren || []).map((child) => {
    const birthdate = String(child.birthdate || "").trim();
    const error = getBirthdateError(birthdate);
    if (error) {
      throw new Error(
        `${child.childName || "Each child"} needs a valid birthdate before reserving.`
      );
    }
    return {
      childId: child.id || child.childId || null,
      childName: child.childName,
      birthdate,
      sex: child.sex || "",
    };
  });
  const first = children[0] || {};
  return {
    children,
    childName: first.childName || "",
    birthdate: first.birthdate || "",
    sex: first.sex || "",
    concern: (concern || "").trim(),
  };
};
