import { useMemo, useState } from "react";
import { ArrowLeft, Check, ClipboardList, MapPin, Ruler } from "lucide-react";
import type { EntryFilter, Role, Tag } from "@/lib/types";
import { usePack } from "@/hooks/usePack";
import { Button } from "@/components/shared/Button";
import { LOG_GRADES, LOG_SPECIES, LOG_SUPPLIERS, logPrice } from "@/lib/mock-data-logs";

// Scale Intake (log-trading pack) — record a scaled lot into inventory.
// Step 1 enters what the scale ticket says; step 2 reviews the scaling reference,
// measured volume and storage location before anything is written; step 3 confirms and
// links to the new lot in Log Inventory. A lot lands as Available: scaled volume is
// ready to allocate to a customer boom.

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = (n: number) => String(n).padStart(2, "0");

interface ScaleIntakeProps {
  tags: Tag[];
  setTags: (tags: Tag[]) => void;
  floorView: boolean;
  role: Role;
  onViewInInventory: (filter: EntryFilter) => void;
}

type Step = "enter" | "review" | "done";

export function ScaleIntake({ tags, setTags, floorView, role, onViewInInventory }: ScaleIntakeProps) {
  const { pack } = usePack();
  const [step, setStep] = useState<Step>("enter");
  const [scaleRef, setScaleRef] = useState("");
  const [species, setSpecies] = useState(LOG_SPECIES[0]);
  const [grade, setGrade] = useState(LOG_GRADES[1]);
  const [volume, setVolume] = useState("");
  const [logs, setLogs] = useState("");
  const [supplier, setSupplier] = useState(LOG_SUPPLIERS[0]);
  const [site, setSite] = useState(pack.sites[0]?.code ?? "");
  const [bay, setBay] = useState("Bay 1");
  const [created, setCreated] = useState<Tag | null>(null);

  // Prices are commercial data — the yard crew (Floor) records volume, not money.
  const showPrices = role !== "floor";
  const vol = Math.round(Number(volume) * 10) / 10;
  const logCount = Math.round(Number(logs));
  const price = useMemo(() => logPrice(species, grade), [species, grade]);
  const siteName = pack.sites.find((s) => s.code === site)?.name ?? site;
  const errors: string[] = [];
  if (!scaleRef.trim()) errors.push("Enter the scaling reference from the scale ticket.");
  if (!(vol > 0)) errors.push("Enter the measured volume in m³.");
  if (logs !== "" && !(logCount > 0)) errors.push("Log count must be a whole number above zero.");
  const duplicateRef = scaleRef.trim() !== "" && tags.some((t) => t.scaleRef?.toLowerCase() === scaleRef.trim().toLowerCase());

  const nextId = () => {
    const max = tags.reduce((m, t) => {
      const n = Number(t.id.match(/^T-2026-(\d+)$/)?.[1] ?? 0);
      return n > m ? n : m;
    }, 0);
    return `T-2026-${String(max + 1).padStart(4, "0")}`;
  };

  const handleAdd = () => {
    const now = new Date();
    const iso = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
    const stamp = `${MONTHS_SHORT[now.getMonth()]} ${p2(now.getDate())} ${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}`;
    const worker = role === "floor" ? "Floor" : role === "sales" ? "Sales" : "Manager";
    const ref = scaleRef.trim();
    const tag: Tag = {
      id: nextId(),
      productType: "log",
      species, grade,
      thick: 0, width: 0, length: 0,
      qty: vol, volume: vol,
      ...(logCount > 0 ? { pieces: logCount } : {}),
      scaleRef: ref,
      state: "—", milling: "—",
      yard: site, section: bay.trim() || "—", rack: "—", bin: "—",
      status: "Available",
      date: iso,
      updated: "just now",
      parentLog: null,
      supplier,
      cost: price.cost,
      marketValue: price.marketValue,
      history: [
        { e: `Scaled — ${vol} m³${logCount > 0 ? `, ${logCount} logs` : ""} (scale ref ${ref})`, t: stamp, w: worker },
        { e: "Released — available to allocate", t: stamp, w: "System" },
      ],
    };
    setTags([...tags, tag]);
    setCreated(tag);
    setStep("done");
  };

  const reset = () => {
    setScaleRef("");
    setVolume("");
    setLogs("");
    setCreated(null);
    setStep("enter");
  };

  const big = floorView;
  const inputCls = `w-full border border-sage rounded-lg px-3 ${big ? "py-3 text-base" : "py-2 text-[14px]"} bg-white text-text outline-none focus:border-coral`;
  const label = (text: string, hint?: string) => (
    <div className={`${big ? "text-sm" : "text-[12px]"} text-text-sec mb-1`}>
      {text}
      {hint && <span className="text-text-ter"> · {hint}</span>}
    </div>
  );

  return (
    <div className="p-6 bg-cream min-h-full">
      <div className="max-w-[760px] mx-auto">
        <div className="mb-5">
          <h1 className="text-[26px] font-bold text-ink leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>Scale Intake</h1>
          <p className="text-sm text-text-sec mt-1">Record a scaled lot of logs into inventory.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5 text-[12px]">
          {(["enter", "review", "done"] as Step[]).map((s, i) => {
            const idx = ["enter", "review", "done"].indexOf(step);
            const on = i === idx;
            const done = i < idx;
            return (
              <div key={s} className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold ${on ? "bg-ink text-white" : done ? "bg-sage text-ink" : "bg-white text-text-ter border border-sage"}`}>
                  {done ? <Check size={13} /> : i + 1}
                </span>
                <span className={on ? "text-ink font-semibold" : "text-text-sec"}>{["Scale ticket", "Review", "Added"][i]}</span>
                {i < 2 && <span className="w-8 h-px bg-sage" />}
              </div>
            );
          })}
        </div>

        {step === "enter" && (
          <div className="bg-white rounded-xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]" data-onboarding="scale-intake-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block sm:col-span-2">
                {label("Scaling reference", "scale ticket number")}
                <input className={inputCls} value={scaleRef} onChange={(e) => setScaleRef(e.target.value)} placeholder="e.g. SC-4120" />
                {duplicateRef && <div className="text-[12px] text-coral mt-1">A lot with this scaling reference is already in inventory.</div>}
              </label>
              <label className="block">
                {label("Species")}
                <select className={inputCls} value={species} onChange={(e) => setSpecies(e.target.value)}>
                  {LOG_SPECIES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label className="block">
                {label("Grade")}
                <select className={inputCls} value={grade} onChange={(e) => setGrade(e.target.value)}>
                  {LOG_GRADES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label className="block">
                {label("Measured volume", "m³")}
                <input className={inputCls} type="number" min="0" step="0.1" inputMode="decimal" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="0.0" />
              </label>
              <label className="block">
                {label("Log count", "optional")}
                <input className={inputCls} type="number" min="0" step="1" inputMode="numeric" value={logs} onChange={(e) => setLogs(e.target.value)} placeholder="0" />
              </label>
              <label className="block sm:col-span-2">
                {label("Seller")}
                <select className={inputCls} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                  {LOG_SUPPLIERS.map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label className="block">
                {label("Storage location")}
                <select className={inputCls} value={site} onChange={(e) => setSite(e.target.value)}>
                  {pack.sites.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                </select>
              </label>
              <label className="block">
                {label("Bay / position")}
                <input className={inputCls} value={bay} onChange={(e) => setBay(e.target.value)} />
              </label>
            </div>
            {errors.length > 0 && (scaleRef !== "" || volume !== "") && (
              <ul className="mt-4 text-[12px] text-coral list-disc pl-5">
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="primary" size={big ? "lg" : "md"} disabled={errors.length > 0} onClick={() => setStep("review")}>
                Review lot
              </Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="bg-white rounded-xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
            <div className="text-[15px] font-semibold text-ink mb-1">Check before adding to inventory</div>
            <div className="text-[13px] text-text-sec mb-5">This creates one lot. It will be available to allocate to a customer boom.</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <ReviewTile icon={<ClipboardList size={16} />} label="Scaling reference" value={scaleRef.trim()} />
              <ReviewTile icon={<Ruler size={16} />} label="Measured volume" value={`${vol.toLocaleString()} m³`} sub={logCount > 0 ? `${logCount} logs` : "Log count not recorded"} strong />
              <ReviewTile icon={<MapPin size={16} />} label="Storage location" value={siteName} sub={`${site} · ${bay.trim() || "—"}`} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px] mb-6">
              <Detail label="Species" value={species} />
              <Detail label="Grade" value={grade} />
              <Detail label="Seller" value={supplier} />
              {showPrices ? <Detail label="List price" value={`$${price.marketValue.toFixed(2)} / m³`} /> : <Detail label="Status after intake" value={pack.tagStatusLabel.Available} />}
            </div>
            <div className="flex justify-between gap-3">
              <Button size={big ? "lg" : "md"} leftIcon={<ArrowLeft size={14} />} onClick={() => setStep("enter")}>Edit</Button>
              <Button variant="primary" size={big ? "lg" : "md"} onClick={handleAdd}>Add to inventory</Button>
            </div>
          </div>
        )}

        {step === "done" && created && (
          <div className="bg-white rounded-xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-full bg-sage flex items-center justify-center"><Check size={18} className="text-ink" /></span>
              <div>
                <div className="text-[15px] font-semibold text-ink">Lot {created.id} added</div>
                <div className="text-[13px] text-text-sec">{created.volume.toLocaleString()} m³ of {created.species} {created.grade} at {siteName}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                size={big ? "lg" : "md"}
                onClick={() => onViewInInventory({ tagIds: [created.id], filterLabel: `Lot ${created.id} added · ${created.volume.toLocaleString()} m³` })}
              >
                View in Log Inventory
              </Button>
              <Button size={big ? "lg" : "md"} onClick={reset}>Scale another lot</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewTile({ icon, label, value, sub, strong }: { icon: React.ReactNode; label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-sage/70 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-text-sec">{icon}{label}</div>
      <div className={`mt-1 ${strong ? "text-[22px] font-bold" : "text-[15px] font-semibold"} text-ink`}>{value}</div>
      {sub && <div className="text-[11px] text-text-ter mt-0.5">{sub}</div>}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F9FAFB] rounded-md px-3 py-2">
      <div className="text-[10px] text-text-ter mb-0.5">{label}</div>
      <div className="font-medium text-text">{value}</div>
    </div>
  );
}
