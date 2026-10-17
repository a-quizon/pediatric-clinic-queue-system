import React from "react";
import { getBirthdateError } from "../../utils/pediatricAge";
import { manilaDateString } from "../../utils/manilaDate";

export const emptyChildProfile = () => ({
  childName: "",
  birthdate: "",
  sex: "",
});

export const isChildProfileValid = (value) => {
  if (!value) return false;
  const nameOk = Boolean(value.childName?.trim());
  const birthOk = !getBirthdateError(value.birthdate?.trim() || "");
  const sexOk = Boolean(value.sex);
  return nameOk && birthOk && sexOk;
};

export default function ChildProfileForm({ value, onChange, idPrefix = "child" }) {
  const birthdateError = getBirthdateError(value?.birthdate || "");
  const maxDate = manilaDateString();

  const patch = (partial) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${idPrefix}-name`} className="pq-label">
          Child Full Name *
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={value?.childName || ""}
          onChange={(e) => patch({ childName: e.target.value })}
          placeholder="Enter child's full name"
          className="pq-input"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-birthdate`} className="pq-label">
            Birthdate *
          </label>
          <input
            id={`${idPrefix}-birthdate`}
            type="date"
            value={value?.birthdate || ""}
            max={maxDate}
            onChange={(e) => patch({ birthdate: e.target.value })}
            className={`pq-input ${birthdateError && value?.birthdate ? "pq-input-error" : ""}`}
          />
          {value?.birthdate && birthdateError && (
            <p className="pq-error-text mt-1 leading-tight">{birthdateError}</p>
          )}
          {!value?.birthdate && (
            <p className="text-xs pq-muted mt-1 leading-tight">Required. Age is calculated automatically for clinic staff.</p>
          )}
        </div>
        <div>
          <label htmlFor={`${idPrefix}-sex`} className="pq-label">
            Sex *
          </label>
          <select
            id={`${idPrefix}-sex`}
            value={value?.sex || ""}
            onChange={(e) => patch({ sex: e.target.value })}
            className="pq-input cursor-pointer"
          >
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// Re-export for walk-in validation callers that previously used getChildAgeError
export { getBirthdateError };
