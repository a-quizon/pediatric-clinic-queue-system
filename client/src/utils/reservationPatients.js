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
    return [{
      childId: reservation.childId || null,
      childName: reservation.childName,
      age: reservation.age,
      sex: reservation.sex
    }];
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
  const children = (selectedChildren || []).map((child) => ({
    childId: child.id || child.childId || null,
    childName: child.childName,
    age: String(child.age ?? "").trim(),
    sex: child.sex || ""
  }));
  const first = children[0] || {};
  return {
    children,
    childName: first.childName || "",
    age: first.age || "",
    sex: first.sex || "",
    concern: (concern || "").trim()
  };
};
