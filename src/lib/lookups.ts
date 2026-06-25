// Lookup tables for the 5 Tag Entry / Stock Locator dropdown fields that Managers can extend
// with custom values (Settings → Custom Values). System defaults are hardcoded here and are
// never written to localStorage — only user-added entries persist (see useLookups.tsx).

export type LookupTable = "species" | "grades" | "states" | "milling" | "locations";

export interface LookupValue {
  code: string;
  label: string;
  isSystem: boolean;
}

export const LOOKUP_TABLE_LABELS: Record<LookupTable, string> = {
  species: "Species",
  grades: "Grade",
  states: "State",
  milling: "Milling",
  locations: "Yard Location",
};

function sys(code: string, label: string): LookupValue {
  return { code, label, isSystem: true };
}

// Codes match the existing mock-data values verbatim (not the abbreviated SPF/HF/WRC/DF form),
// so all 18 seeded tags keep matching a real dropdown option everywhere — confirmed with the user.
export const SYSTEM_DEFAULTS: Record<LookupTable, LookupValue[]> = {
  species: [
    sys("SPF", "SPF"),
    sys("Hem-Fir", "Hem-Fir"),
    sys("Western Red Cedar", "Western Red Cedar"),
    sys("Doug Fir", "Doug Fir"),
  ],
  grades: [
    sys("#1", "#1"),
    sys("#2", "#2"),
    sys("#3", "#3"),
    sys("Select", "Select"),
    sys("Clear", "Clear"),
    sys("MSR 1650", "MSR 1650"),
  ],
  states: [
    sys("GRN", "Green"),
    sys("KD", "Kiln Dried"),
    sys("HT", "Heat Treated"),
    sys("KD-HT", "Kiln Dried + Heat Treated"),
  ],
  milling: [
    sys("RGH", "Rough"),
    sys("STD", "Standard"),
    sys("S4S", "Surfaced 4 Sides"),
  ],
  // Spec calls for an empty system-default list ("all locations are mill-specific"), but the
  // existing Tag Entry wizard default and all 18 seeded mock tags use YD-A/YD-B/YD-C — seeding
  // them here keeps that functionality working out of the box (confirmed with the user).
  locations: [
    sys("YD-A", "YD-A"),
    sys("YD-B", "YD-B"),
    sys("YD-C", "YD-C"),
  ],
};
