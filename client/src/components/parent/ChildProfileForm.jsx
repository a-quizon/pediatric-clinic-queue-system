import React from "react";

export const emptyChildProfile = () => ({
  childName: "",
  age: "",
  sex: ""
});

export const getChildAgeError = (age) => {
  if (!age) return "";
  if (/[^0-9]/.test(age)) {
    return "Please enter numbers only (no letters, decimals, or negative signs).";
  }
  const numVal = parseInt(age, 10);
  if (numVal <= 0 || numVal > 25) {
    return "Please enter a valid pediatric age (1 - 25).";
  }
  return "";
};

export const isChildProfileValid = (value) => {
  if (!value) return false;
  const nameOk = Boolean(value.childName?.trim());
  const age = value.age?.trim() || "";
  const ageOk = /^\d+$/.test(age) && !getChildAgeError(age);
  const sexOk = Boolean(value.sex);
  return nameOk && ageOk && sexOk;
};

export default function ChildProfileForm({ value, onChange, idPrefix = "child" }) {
  const ageError = getChildAgeError(value?.age || "");

  const patch = (partial) => {
    onChange({ ...value, ...partial });
  };

  const handleAgeChange = (e) => {
    const rawVal = e.target.value;
    if (/[^0-9]/.test(rawVal)) {
      patch({ age: rawVal.replace(/[^0-9]/g, "") });
    } else {
      patch({ age: rawVal });
    }
  };

  const handleAgePaste = (e) => {
    const pasteData = e.clipboardData.getData("text");
    if (/[^0-9]/.test(pasteData)) {
      e.preventDefault();
      patch({ age: pasteData.replace(/[^0-9]/g, "") });
    }
  };

  const handleAgeKeyDown = (e) => {
    if (["e", "E", "+", "-", "."].includes(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${idPrefix}-name`} className="block text-sm font-medium text-gray-700 mb-1">
          Child Full Name *
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={value?.childName || ""}
          onChange={(e) => patch({ childName: e.target.value })}
          placeholder="Enter child's full name"
          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-age`} className="block text-sm font-medium text-gray-700 mb-1">
            Age (numeric) *
          </label>
          <input
            id={`${idPrefix}-age`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value?.age || ""}
            onChange={handleAgeChange}
            onPaste={handleAgePaste}
            onKeyDown={handleAgeKeyDown}
            placeholder="e.g. 5"
            className={`w-full px-4 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${
              ageError ? "border-red-500 text-red-600" : "border-gray-200 focus:border-blue-500"
            }`}
          />
          {ageError && (
            <p className="text-xs font-semibold text-red-600 mt-1 leading-tight">{ageError}</p>
          )}
        </div>
        <div>
          <label htmlFor={`${idPrefix}-sex`} className="block text-sm font-medium text-gray-700 mb-1">
            Sex *
          </label>
          <select
            id={`${idPrefix}-sex`}
            value={value?.sex || ""}
            onChange={(e) => patch({ sex: e.target.value })}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
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
