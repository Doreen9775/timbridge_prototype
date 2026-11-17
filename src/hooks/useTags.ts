import { useState } from "react";
import type { Tag } from "@/lib/types";

// The Tag table store. For now it just holds state seeded from mock data;
// lifecycle transitions (Pending → Received → Available, etc.) come later (§8).
// `seed` comes from the active industry pack (lib/packs.ts).
export function useTags(seed: Tag[]) {
  const [tags, setTags] = useState<Tag[]>(seed);
  return { tags, setTags };
}
