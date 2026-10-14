import { useEffect, useState } from "react";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { ALL_BRANCHES } from "../../utils/reportSessions";
import ChipGroup from "./ChipGroup";

export default function BranchChipFilter({ value, onChange }) {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getBranchConfigurations()
      .then((list) => {
        if (!cancelled) setBranches(list || []);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  const options = [
    { value: ALL_BRANCHES, label: "All" },
    ...branches.map((b) => ({ value: b.name, label: b.name })),
  ];

  return (
    <ChipGroup
      label="Branch"
      options={options}
      value={value || ALL_BRANCHES}
      onChange={onChange}
    />
  );
}
