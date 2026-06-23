import { useState } from "react";
import { Scan, CheckCircle, Plus, ArrowRight } from "lucide-react";
import type { Tag, Species, Grade, MoistureState, Milling } from "@/lib/types";
import { parentLogs } from "@/lib/mock-data";
import { calcFbm, calcLineal, fbmToM3 } from "@/lib/fbm";
import { useRecentRecords } from "@/hooks/useRecentRecords";

const SPECIES: Species[] = ["SPF", "Doug Fir", "Western Red Cedar", "Hem-Fir"];
const GRADES: Grade[] = ["#1", "#2", "#3", "Select", "Clear", "MSR 1650"];
const THICKS = [1, 2, 4];
const WIDTHS = [4, 6, 8, 10];
const LENGTHS = [8, 10, 12, 14, 16, 18, 20];
const STATES: MoistureState[] = ["GRN", "KD", "HT", "KD-HT"];
const MILLINGS: Milling[] = ["RGH", "STD", "S4S"];
const YARDS = ["YD-A", "YD-B", "YD-C"];
const SECTIONS = ["A-1", "A-2", "A-3", "A-4", "B-1", "B-2", "B-3", "C-1", "C-2", "C-3"];
const RACKS = ["R-01", "R-02", "R-03", "R-04", "R-05", "R-06", "R-07", "R-08", "R-09", "R-10", "R-11", "R-12", "R-13", "R-14", "R-15"];
const BINS = ["B1", "B2", "B3", "B4", "B5"];

const inputCls = "w-full px-3 py-2 text-[13px] border border-sage rounded-md bg-white outline-none text-text box-border";
const labelCls = "text-xs text-text-sec block mb-1";

interface TagEntryProps {
  tags: Tag[];
  setTags: (tags: Tag[]) => void;
  floorView: boolean;
}

export function TagEntry({ tags, setTags, floorView }: TagEntryProps) {
  const { pushRecord } = useRecentRecords();
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [species, setSpecies] = useState<Species>("SPF");
  const [grade, setGrade] = useState<Grade>("#1");
  const [thick, setThick] = useState(2);
  const [width, setWidth] = useState(4);
  const [state_, setState_] = useState<MoistureState>("KD");
  const [milling, setMilling] = useState<Milling>("STD");
  const [parentLog, setParentLog] = useState("");
  const [smartShown, setSmartShown] = useState(false);

  const [qty, setQty] = useState(100);
  const [length, setLength] = useState(16);
  const [yard, setYard] = useState("YD-A");
  const [section, setSection] = useState("A-1");
  const [rack, setRack] = useState("R-01");
  const [bin, setBin] = useState("B1");

  const fbm = calcFbm(thick, width, length, qty);
  const lineal = calcLineal(length, qty);
  const m3 = fbmToM3(fbm);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleScan = () => {
    const src = tags[Math.floor(Math.random() * tags.length)];
    setSpecies(src.species);
    setGrade(src.grade);
    setThick(src.thick);
    setWidth(src.width);
    setState_(src.state);
    setMilling(src.milling);
    setSmartShown(false);
    showToast(`Scanned ${src.id} — fields prefilled. Edit as needed.`);
  };

  const handleSave = () => {
    const newId = `T-2026-${String(tags.length + 100 + 1).padStart(4, "0")}`;
    const newTag: Tag = {
      id: newId, species, grade, thick, width, length, qty, fbm, state: state_, milling,
      yard, section, rack, bin, status: "Available", updated: "just now",
      parentLog: parentLog || null,
      history: [{ e: "Tag created via Tag Entry", t: "Jun 04 2026 14:32", w: "DW" }],
    };
    setTags([...tags, newTag]);
    pushRecord({ type: "tag", id: newId, label: newId });
    setDone(newId);
  };

  const reset = () => {
    setStep(1); setDone(null);
    setSpecies("SPF"); setGrade("#1"); setThick(2); setWidth(4); setState_("KD"); setMilling("STD");
    setParentLog(""); setSmartShown(false);
    setQty(100); setLength(16); setYard("YD-A"); setSection("A-1"); setRack("R-01"); setBin("B1");
  };

  // ── Floor view ────────────────────────────────────────────────────────────
  if (floorView) {
    return (
      <div className="p-8 bg-cream min-h-full flex flex-col items-center">
        {!done ? (
          <>
            <button onClick={handleScan} className="w-[260px] h-[260px] rounded-full bg-coral border-0 cursor-pointer flex flex-col items-center justify-center text-white mb-8">
              <Scan size={64} className="mb-3" />
              <span className="text-[22px] font-semibold">Tap to Scan</span>
            </button>
            <div className="w-full max-w-[400px]">
              <div className="bg-white rounded-xl p-5 mb-4">
                <div className="text-base text-text-sec mb-1">Species</div>
                <select value={species} onChange={(e) => setSpecies(e.target.value as Species)} className={`${inputCls} text-lg p-3`}>
                  {SPECIES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white rounded-xl p-4">
                  <div className="text-sm text-text-sec mb-1">Qty</div>
                  <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className={`${inputCls} text-xl p-2.5`} />
                </div>
                <div className="bg-white rounded-xl p-4">
                  <div className="text-sm text-text-sec mb-1">Location</div>
                  <select value={yard} onChange={(e) => setYard(e.target.value)} className={`${inputCls} text-base`}>
                    {YARDS.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleSave} className="w-full p-5 bg-coral text-white border-0 rounded-[10px] text-[22px] font-bold cursor-pointer">Save Tag</button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <CheckCircle size={80} className="text-coral mb-5 mx-auto" />
            <div className="text-[28px] font-bold text-ink mb-2">Tag Saved!</div>
            <div className="font-mono text-[22px] text-text mb-6">{done}</div>
            <button onClick={reset} className="px-8 py-4 bg-coral text-white border-0 rounded-lg text-lg cursor-pointer">Add Another</button>
          </div>
        )}
      </div>
    );
  }

  // ── Success state (desktop) ───────────────────────────────────────────────
  if (done) {
    return (
      <div className="p-10 bg-cream min-h-full flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl p-10 text-center shadow-[0_2px_16px_rgba(0,0,0,0.08)] max-w-[400px]">
          <CheckCircle size={56} className="text-coral mb-4 mx-auto" />
          <div className="text-[22px] font-semibold text-ink mb-1.5">Tag Created</div>
          <div className="font-mono text-xl font-bold text-text mb-2">{done}</div>
          <div className="text-[13px] text-text-sec mb-6">Tag is now live in Stock Locator</div>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="px-5 py-2.5 bg-transparent border border-sage rounded-lg text-sm cursor-pointer text-text flex items-center gap-1.5">
              <Plus size={14} />Add Another
            </button>
            <button onClick={reset} className="px-5 py-2.5 bg-coral text-white border-0 rounded-lg text-sm cursor-pointer flex items-center gap-1.5">
              View in Inventory<ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard (desktop) ──────────────────────────────────────────────────────
  const steps = ["Product", "Quantity & Location", "Review"];
  const reviewGroups = [
    { label: "Product", fields: [["Species", species], ["Grade", grade], ["Dimensions", `${thick}×${width} × ${length}'`], ["State", state_], ["Milling", milling]] },
    { label: "Quantity", fields: [["Quantity", `${qty} pcs`], ["FBM", `${fbm.toLocaleString()} fbm`], ["Length", `${length}'`]] },
    { label: "Location", fields: [["Yard", yard], ["Section", section], ["Rack", rack], ["Bin", bin]] },
    ...(parentLog ? [{ label: "Linkage", fields: [["Parent Log", parentLog]] }] : []),
  ];

  return (
    <div className="p-6 bg-cream min-h-full">
      {toast && (
        <div className="fixed top-5 right-6 bg-ink text-white px-5 py-3 rounded-lg text-[13px] z-[200] shadow-[0_4px_12px_rgba(0,0,0,0.15)]">{toast}</div>
      )}
      <div className="max-w-[640px] mx-auto">
        <div className="flex items-center mb-7">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold ${step > i + 1 ? "bg-coral text-white" : step === i + 1 ? "bg-ink text-white" : "bg-[#E5E7EB] text-text-sec"}`}>
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <span className={`text-[13px] ${step === i + 1 ? "font-semibold text-ink" : "text-text-sec"}`}>{s}</span>
              </div>
              {i < 2 && <div className={`w-10 h-0.5 mx-2.5 ${step > i + 1 ? "bg-coral" : "bg-sage"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="bg-white rounded-xl p-7 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
            <button onClick={handleScan} className="w-full py-3.5 border-2 border-dashed border-coral rounded-lg bg-transparent text-coral text-sm font-medium cursor-pointer mb-5 flex items-center justify-center gap-2">
              <Scan size={18} />Scan Existing Tag to Duplicate
            </button>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>Species</label>
                <select value={species} onChange={(e) => { setSpecies(e.target.value as Species); setSmartShown(true); }} className={inputCls}>
                  {SPECIES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Grade</label>
                <select value={grade} onChange={(e) => { setGrade(e.target.value as Grade); setSmartShown(true); }} className={inputCls}>
                  {GRADES.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            {smartShown && (
              <div className="bg-sage/20 border border-sage rounded-lg px-3.5 py-2.5 mb-4 flex items-center justify-between">
                <span className="text-[13px] text-ink">💡 Suggested: KD + STD (based on 12 similar tags this week)</span>
                <button onClick={() => { setState_("KD"); setMilling("STD"); setSmartShown(false); }} className="px-3 py-1 bg-coral text-white border-0 rounded-md text-xs cursor-pointer">Apply</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>Thickness × Width</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={thick} onChange={(e) => setThick(Number(e.target.value))} className={inputCls}>
                    {THICKS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select value={width} onChange={(e) => setWidth(Number(e.target.value))} className={inputCls}>
                    {WIDTHS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>State</label>
                <select value={state_} onChange={(e) => setState_(e.target.value as MoistureState)} className={inputCls}>
                  {STATES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>Milling</label>
                <select value={milling} onChange={(e) => setMilling(e.target.value as Milling)} className={inputCls}>
                  {MILLINGS.map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Parent Log (optional)</label>
                <select value={parentLog} onChange={(e) => setParentLog(e.target.value)} className={inputCls}>
                  <option value="">— none —</option>
                  {parentLogs.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <button onClick={() => setStep(2)} className="w-full py-3 bg-ink text-white border-0 rounded-lg text-sm font-medium cursor-pointer">Next: Quantity & Location</button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl p-7 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelCls}>Quantity (pcs)</label>
                <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Length</label>
                <select value={length} onChange={(e) => setLength(Number(e.target.value))} className={inputCls}>
                  {LENGTHS.map((v) => <option key={v} value={v}>{v}'</option>)}
                </select>
              </div>
            </div>
            <div className="bg-coral/5 border border-coral/30 rounded-[10px] px-5 py-[18px] mb-5">
              <div className="text-[11px] text-text-sec mb-2">Live FBM Calculator</div>
              <div className="text-[13px] text-text-sec font-mono mb-2">{thick} × {width} × {length} × {qty} ÷ 12 =</div>
              <div className="text-4xl font-bold text-ink mb-1">{fbm.toLocaleString()} FBM</div>
              <div className="text-xs text-text-sec">Lineal feet: {lineal.toLocaleString()} · M³: {m3}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelCls}>Yard</label>
                <select value={yard} onChange={(e) => setYard(e.target.value)} className={inputCls}>
                  {YARDS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Section</label>
                <select value={section} onChange={(e) => setSection(e.target.value)} className={inputCls}>
                  {SECTIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Rack</label>
                <select value={rack} onChange={(e) => setRack(e.target.value)} className={inputCls}>
                  {RACKS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Bin</label>
                <select value={bin} onChange={(e) => setBin(e.target.value)} className={inputCls}>
                  {BINS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setStep(1)} className="flex-1 py-3 bg-transparent border border-sage rounded-lg text-sm cursor-pointer text-text">Back</button>
              <button onClick={() => setStep(3)} className="flex-[2] py-3 bg-ink text-white border-0 rounded-lg text-sm font-medium cursor-pointer">Next: Review</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-xl p-7 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
            <div className="text-sm font-medium text-text mb-4">Review & Confirm</div>
            {reviewGroups.map((g) => (
              <div key={g.label} className="mb-4">
                <div className="text-[11px] font-semibold text-text-ter tracking-[1px] uppercase mb-2">{g.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  {g.fields.map(([k, v]) => (
                    <div key={k} className="bg-[#F9FAFB] rounded-md px-3 py-2">
                      <div className="text-[10px] text-text-ter mb-0.5">{k}</div>
                      <div className="text-[13px] font-medium text-text">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setStep(2)} className="flex-1 py-3 bg-transparent border border-sage rounded-lg text-sm cursor-pointer text-text">Back</button>
              <button onClick={handleSave} className="flex-[2] py-[13px] bg-coral text-white border-0 rounded-lg text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5">
                <CheckCircle size={15} />Save Tag
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
