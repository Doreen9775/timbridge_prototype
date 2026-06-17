import { useState } from "react";
import { initialTags } from "@/lib/mock-data";
import type { Tag } from "@/lib/types";

// The Tag table store. For now it just holds state seeded from mock data;
// lifecycle transitions (Pending → Received → Available, etc.) come later (§8).
export function useTags() {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  return { tags, setTags };
}
