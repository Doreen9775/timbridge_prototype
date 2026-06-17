import { useRef, useState } from "react";
import { Truck, Upload, Loader, CheckCircle, RefreshCw, Edit3, MapPin } from "lucide-react";
import type { Tag } from "@/lib/types";
import { parseDeliverySlip, type ParsedItem } from "@/lib/anthropic";
import { calcFbm } from "@/lib/fbm";

type Stage = "upload" | "analyzing" | "review" | "done";
type ExtractedItem = ParsedItem & { fbm: number; _id: number };

const FIELDS: Record<string, (string | number)[]> = {
  species: ["SPF", "Doug Fir", "Western Red Cedar", "Hem-Fir"],
  grade: ["#1", "#2", "#3", "Select", "Clear", "MSR 1650"],
  state: ["GRN", "KD", "HT", "KD-HT"],
  milling: ["RGH", "STD", "S4S"],
  thick: [1, 2, 4],
  width: [4, 6, 8, 10],
  length: [8, 10, 12, 14, 16, 18, 20],
};

const editSelectCls = "px-2.5 py-1.5 text-xs border border-sage rounded-md bg-white outline-none text-text w-full";

interface DeliverySlipsProps {
  tags: Tag[];
  setTags: (tags: Tag[]) => void;
}

export function DeliverySlips({ tags, setTags }: DeliverySlipsProps) {
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState("");
  const [extracted, setExtracted] = useState<ExtractedItem[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const withFbm = (items: ParsedItem[]): ExtractedItem[] =>
    items.map((it, i) => ({ ...it, fbm: calcFbm(it.thick, it.width, it.length, it.qty), _id: i }));

  const handleFile = (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setError("");
    const isPDF = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPDF && !isImage) {
      setError("Please upload a PDF or image file (JPG / PNG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = String(e.target?.result).split(",")[1];
      setStage("analyzing");
      try {
        const items = await parseDeliverySlip(b64, file.type, isPDF);
        if (items.length === 0) {
          setError("No lumber line items could be detected. Try a clearer image or enter manually.");
          setStage("upload");
          return;
        }
        const list = withFbm(items);
        setExtracted(list);
        setSelected(list.map((_, i) => i));
        setEditIdx(null);
        setStage("review");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Parse failed.");
        setStage("upload");
      }
    };
    reader.readAsDataURL(file);
  };

  const loadDemo = () => {
    const demo: ParsedItem[] = [
      { species: "SPF", grade: "#2", thick: 2, width: 6, length: 16, qty: 150, state: "KD", milling: "STD", supplier: "Pacific Saw Co.", poNumber: "PO-2026-0088", notes: "KD certified" },
      { species: "Doug Fir", grade: "#1", thick: 2, width: 8, length: 14, qty: 60, state: "KD-HT", milling: "S4S", supplier: "Pacific Saw Co.", poNumber: "PO-2026-0088", notes: "" },
      { species: "Hem-Fir", grade: "#2", thick: 2, width: 4, length: 12, qty: 200, state: "GRN", milling: "RGH", supplier: "Pacific Saw Co.", poNumber: "PO-2026-0088", notes: "GRN — air dry 30 days" },
      { species: "Western Red Cedar", grade: "Clear", thick: 1, width: 6, length: 10, qty: 40, state: "KD", milling: "S4S", supplier: "Pacific Saw Co.", poNumber: "PO-2026-0088", notes: "Premium grade" },
    ];
    const list = withFbm(demo);
    setExtracted(list);
    setSelected(list.map((_, i) => i));
    setStage("review");
  };

  const updateItem = (idx: number, key: string, val: string) => {
    setExtracted((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const numeric = ["thick", "width", "length", "qty"].includes(key);
        const updated = { ...it, [key]: numeric ? Number(val) : val } as ExtractedItem;
        updated.fbm = calcFbm(updated.thick, updated.width, updated.length, updated.qty);
        return updated;
      }),
    );
  };

  const confirmCreate = () => {
    const toCreate = extracted.filter((_, i) => selected.includes(i));
    const now = tags.length;
    const newTags: Tag[] = toCreate.map((it, i) => ({
      id: `T-2026-${String(now + 100 + 1 + i).padStart(4, "0")}`,
      species: it.species, grade: it.grade, thick: it.thick, width: it.width, length: it.length,
      qty: it.qty, fbm: it.fbm, state: it.state, milling: it.milling,
      yard: "YD-A", section: "A-1", rack: "R-01", bin: "B1",
      status: "Pending", updated: "just now", parentLog: null,
      history: [{ e: `Created from delivery slip${it.poNumber ? " PO " + it.poNumber : ""}`, t: "Jun 04 2026 14:32", w: "DW" }],
    }));
    setTags([...tags, ...newTags]);
    setCreatedCount(newTags.length);
    setStage("done");
  };

  const reset = () => {
    setStage("upload"); setFileName(""); setExtracted([]); setSelected([]); setEditIdx(null); setError("");
  };

  const selectedItems = extracted.filter((_, i) => selected.includes(i));

  // ── Upload / analyzing ────────────────────────────────────────────────────
  if (stage === "upload" || stage === "analyzing") {
    return (
      <div className="p-8 bg-cream min-h-full">
        <div className="max-w-[600px] mx-auto">
          <div className="bg-white rounded-2xl p-10 shadow-[0_1px_8px_rgba(0,0,0,0.08)] text-center mb-5">
            <div className="w-16 h-16 rounded-full bg-coral/10 flex items-center justify-center mx-auto mb-4">
              <Truck size={28} className="text-coral" />
            </div>
            <div className="text-xl font-semibold text-ink mb-2">Delivery Slip — AI Parser</div>
            <div className="text-[13px] text-text-sec mb-7 leading-relaxed">
              Upload a delivery slip (PDF or photo) and AI will extract all lumber line items.<br />
              Review the results, then create inventory tags in one click.
            </div>

            {stage === "analyzing" ? (
              <div className="py-10">
                <Loader size={36} className="text-coral animate-spin mx-auto mb-4" />
                <div className="text-sm text-text-sec">Analyzing "{fileName}"…</div>
                <div className="text-xs text-text-ter mt-1.5">AI is identifying species, grades, dimensions and quantities</div>
              </div>
            ) : (
              <>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-sage rounded-[10px] px-6 py-9 cursor-pointer transition-colors hover:border-coral mb-4"
                >
                  <Upload size={28} className="text-text-ter mx-auto mb-2.5" />
                  <div className="text-sm text-text font-medium mb-1">Click to upload or drag & drop</div>
                  <div className="text-xs text-text-ter">PDF, JPG, PNG supported</div>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                {error && (
                  <div className="bg-coral/10 border border-coral rounded-lg px-3.5 py-2.5 text-[13px] text-coral mb-3">{error}</div>
                )}
                <div className="text-xs text-text-ter mt-2">— or try a demo —</div>
                <button onClick={loadDemo} className="mt-2.5 px-5 py-2 bg-transparent border border-sage rounded-lg text-[13px] text-text-sec cursor-pointer">
                  Use sample delivery slip
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Review ────────────────────────────────────────────────────────────────
  if (stage === "review") {
    return (
      <div className="p-6 bg-cream min-h-full">
        <div className="max-w-[900px] mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-lg font-semibold text-ink mb-0.5">Review Extracted Items</div>
              <div className="text-[13px] text-text-sec">Source: {fileName || "sample delivery slip"} · {extracted.length} line items detected</div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={reset} className="px-4 py-2 bg-transparent border border-sage rounded-lg text-[13px] cursor-pointer text-text-sec flex items-center gap-1.5">
                <RefreshCw size={14} />Re-upload
              </button>
              <button
                onClick={confirmCreate}
                disabled={selected.length === 0}
                className={[
                  "px-5 py-2 text-white border-0 rounded-lg text-[13px] font-semibold flex items-center gap-1.5",
                  selected.length === 0 ? "bg-[#ccc] cursor-not-allowed" : "bg-coral cursor-pointer",
                ].join(" ")}
              >
                <CheckCircle size={14} />Confirm & Create {selected.length} Tag{selected.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>

          {extracted.length > 0 && extracted[0].supplier && (
            <div className="bg-white rounded-[10px] px-5 py-3.5 mb-4 flex gap-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div><span className="text-[11px] text-text-ter">Supplier</span><div className="text-[13px] font-medium text-text mt-0.5">{extracted[0].supplier}</div></div>
              <div><span className="text-[11px] text-text-ter">PO Number</span><div className="font-mono text-[13px] font-medium text-coral mt-0.5">{extracted[0].poNumber}</div></div>
              <div><span className="text-[11px] text-text-ter">Total FBM</span><div className="text-[13px] font-medium text-text mt-0.5">{selectedItems.reduce((s, it) => s + it.fbm, 0).toLocaleString()}</div></div>
              <div><span className="text-[11px] text-text-ter">Total Pieces</span><div className="text-[13px] font-medium text-text mt-0.5">{selectedItems.reduce((s, it) => s + it.qty, 0).toLocaleString()}</div></div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {extracted.map((it, idx) => {
              const isSel = selected.includes(idx);
              const isEdit = editIdx === idx;
              return (
                <div
                  key={idx}
                  className={[
                    "bg-white rounded-[10px] px-[18px] py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[1.5px] transition-colors",
                    isSel ? "border-coral opacity-100" : "border-sage opacity-50",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => setSelected((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]))}
                      className="mt-[3px] accent-coral w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      {!isEdit ? (
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-[15px] font-semibold text-ink">{it.species}</span>
                          <span className="bg-sage/30 text-ink px-2 py-0.5 rounded-[10px] text-xs">{it.grade}</span>
                          <span className="text-[13px] text-text font-mono">{it.thick}×{it.width} × {it.length}'</span>
                          <span className="text-[13px] text-text">{it.qty} pcs</span>
                          <span className="text-[13px] text-text-sec">{it.state} · {it.milling}</span>
                          <span className="ml-auto text-[13px] font-semibold text-coral">{it.fbm.toLocaleString()} FBM</span>
                          {it.notes && <span className="text-[11px] text-text-ter w-full">{it.notes}</span>}
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2.5">
                          {(["species", "grade", "state", "milling"] as const).map((k) => (
                            <div key={k}>
                              <div className="text-[10px] text-text-ter mb-1 capitalize">{k}</div>
                              <select value={it[k]} onChange={(e) => updateItem(idx, k, e.target.value)} className={editSelectCls}>
                                {FIELDS[k].map((v) => <option key={v}>{v}</option>)}
                              </select>
                            </div>
                          ))}
                          {([["thick", "Thick"], ["width", "Width"], ["length", "Length (ft)"], ["qty", "Qty (pcs)"]] as const).map(([k, l]) => (
                            <div key={k}>
                              <div className="text-[10px] text-text-ter mb-1">{l}</div>
                              <select value={it[k]} onChange={(e) => updateItem(idx, k, e.target.value)} className={editSelectCls}>
                                {(FIELDS[k] ?? []).map((v) => <option key={v}>{v}</option>)}
                              </select>
                            </div>
                          ))}
                          <div className="col-span-4 text-xs text-coral font-semibold mt-1">
                            FBM = {it.thick}×{it.width}×{it.length}×{it.qty}÷12 = {it.fbm.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setEditIdx(isEdit ? null : idx)}
                      className={[
                        "px-3 py-1.5 rounded-md text-xs cursor-pointer border flex items-center gap-1 whitespace-nowrap",
                        isEdit ? "bg-coral text-white border-coral" : "bg-transparent text-text-sec border-sage",
                      ].join(" ")}
                    >
                      {isEdit ? <><CheckCircle size={13} />Done</> : <><Edit3 size={13} />Edit</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-text-ter text-center">Check the items you want to create, then click "Confirm & Create" to add them to inventory.</div>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-10 bg-cream min-h-full flex items-center justify-center">
      <div className="bg-white rounded-2xl p-12 text-center shadow-[0_2px_16px_rgba(0,0,0,0.08)] max-w-[420px]">
        <CheckCircle size={60} className="text-coral mx-auto mb-4" />
        <div className="text-2xl font-bold text-ink mb-2">Tags Created</div>
        <div className="text-[15px] text-text-sec mb-1.5"><strong>{createdCount}</strong> inventory tag{createdCount !== 1 ? "s" : ""} added successfully</div>
        <div className="text-[13px] text-text-ter mb-7">New tags start as <strong>Pending</strong> — confirm them on the floor to receive.</div>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-5 py-2.5 bg-transparent border border-sage rounded-lg text-sm cursor-pointer text-text flex items-center gap-1.5">
            <Upload size={14} />Upload Another
          </button>
          <button onClick={reset} className="px-5 py-2.5 bg-ink text-white border-0 rounded-lg text-sm cursor-pointer flex items-center gap-1.5">
            <MapPin size={14} />View Inventory
          </button>
        </div>
      </div>
    </div>
  );
}
