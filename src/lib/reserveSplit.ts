// Single home for the Available → Reserved commit, including the partial-quantity
// split that used to live in AvailableToSell's per-row Reserve modal. Every path
// that reserves inventory (Create-and-Confirm from Available-to-Sell, and Draft →
// Open confirm from Sales Orders) funnels its line items through here so the split
// rules exist in exactly one place.
//
// For each line item whose reserved qty is the whole tag, the tag flips to Reserved
// in place. For a line reserving fewer pieces than the tag holds, a new Reserved
// child tag is split off for that qty (via calcFbm + parentTagId/splitTagIds +
// history), the parent shrinks and stays Available, and the line item is rewritten
// to point at the child — because status lives on a whole Tag row, not a quantity.
import type { Tag } from "@/lib/types";
import { calcFbm } from "@/lib/fbm";

export interface ReserveLine {
  tagId: string;
  qty: number;
  unitPrice: number;
  discountPct?: number;
}

export interface ReserveContext {
  soId: string; // order the tags are being reserved to
  worker: string; // history "w" attribution
  stamp: string; // history "t" display timestamp
  via: string; // surface label, e.g. "Available-to-Sell" or "Sales Orders"
}

// Mint sequential T-2026-NNNN ids that don't collide with any existing tag id,
// including ids minted earlier in the same commit (multiple partial splits at once).
function nextTagIdFactory(tags: Tag[]): () => string {
  let max = 100;
  for (const t of tags) {
    const m = t.id.match(/^T-2026-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let n = max;
  return () => {
    n += 1;
    return `T-2026-${String(n).padStart(4, "0")}`;
  };
}

// Pure: computes the next tags array and the rewritten line items. Callers own the
// defensive "still Available?" re-check *before* calling this — it assumes the lines
// are reservable and simply applies the transition.
export function reserveLineItems<L extends ReserveLine>(
  tags: Tag[],
  lines: L[],
  ctx: ReserveContext,
): { tags: Tag[]; lineItems: L[] } {
  const nextId = nextTagIdFactory(tags);
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const updates = new Map<string, Tag>(); // id → replacement for an existing tag
  const created: Tag[] = [];

  const lineItems = lines.map((li) => {
    const source = updates.get(li.tagId) ?? tagById.get(li.tagId);
    if (!source) return li; // unknown tag — leave untouched (defensive)

    if (li.qty >= source.qty) {
      updates.set(source.id, {
        ...source,
        status: "Reserved",
        updated: "just now",
        history: [
          ...source.history,
          { e: `Reserved for ${ctx.soId} via ${ctx.via}`, t: ctx.stamp, w: ctx.worker },
        ],
      });
      return li;
    }

    // Partial reserve → split a Reserved child off the Available parent.
    const childId = nextId();
    const remainingQty = source.qty - li.qty;
    created.push({
      ...source,
      id: childId,
      qty: li.qty,
      fbm: calcFbm(source.thick, source.width, source.length, li.qty),
      status: "Reserved",
      updated: "just now",
      parentTagId: source.id,
      splitTagIds: undefined,
      history: [
        ...source.history,
        { e: `Split from ${source.id} · Reserved for ${ctx.soId} via ${ctx.via}`, t: ctx.stamp, w: ctx.worker },
      ],
    });
    updates.set(source.id, {
      ...source,
      qty: remainingQty,
      fbm: calcFbm(source.thick, source.width, source.length, remainingQty),
      updated: "just now",
      splitTagIds: [...(source.splitTagIds ?? []), childId],
      history: [
        ...source.history,
        { e: `Split ${li.qty} pcs into ${childId} · Reserved for ${ctx.soId} via ${ctx.via}`, t: ctx.stamp, w: ctx.worker },
      ],
    });
    return { ...li, tagId: childId };
  });

  const nextTags = tags.map((t) => updates.get(t.id) ?? t).concat(created);
  return { tags: nextTags, lineItems };
}
