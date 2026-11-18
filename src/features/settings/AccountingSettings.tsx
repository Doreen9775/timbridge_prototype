import { CheckCircle2, Link2, Unlink } from "lucide-react";
import { useFinance } from "@/hooks/useFinance";
import { useClients } from "@/hooks/useClients";
import { usePack } from "@/hooks/usePack";
import { Button } from "@/components/shared/Button";
import { CONNECTORS, TAX_CODES, type ConnectorId } from "@/lib/finance";

// Settings → Accounting. Everything a company decides once about how Timbridge hands
// work to its accounting system: which system (the connector), when invoices are
// drafted, whether they are sent automatically, currency and tax codes, and how its
// customers line up with the accounting system's. The connection itself is mocked.
export function AccountingSettings() {
  const finance = useFinance();
  const { clients } = useClients();
  const { pack } = usePack();
  const s = finance.settings;
  const conn = CONNECTORS.find((c) => c.id === s.connector)!;
  const selectCls = "border border-sage rounded-md px-2.5 py-1.5 text-[13px] bg-white text-text outline-none focus:border-coral";

  return (
    <div className="mb-8" data-onboarding="settings-accounting">
      <div className="mb-1 text-xl font-display font-bold text-ink">Accounting</div>
      <div className="text-[13px] text-text-sec mb-4">
        Timbridge records what was delivered and received; your accounting system keeps the books. Invoices and bills are drafted here and sent there — payments come back.
      </div>

      <div className="bg-white rounded-xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.07)] space-y-6">
        {/* Connection */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">Accounting system</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Accounting system">
            {CONNECTORS.map((c) => {
              const on = c.id === s.connector;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!c.available}
                  onClick={() => !on && finance.updateSettings({ connector: c.id as ConnectorId, ...(c.syncs ? {} : { autoSend: false }) })}
                  className={[
                    "text-left rounded-lg p-3 border-2 transition-colors",
                    on ? "border-ink bg-white" : c.available ? "border-sage/60 bg-white hover:border-sage cursor-pointer" : "border-sage/40 bg-[#F9FAFB] cursor-not-allowed opacity-70",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">{c.label}</span>
                    {!c.available && <span className="text-[10px] font-medium text-text-ter">Coming soon</span>}
                    {on && <CheckCircle2 size={14} className="text-[#4E6B0E]" />}
                  </div>
                  <div className="text-[11px] text-text-sec mt-0.5">{c.description}</div>
                </button>
              );
            })}
          </div>
          {conn.syncs && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 bg-[#F9FAFB] rounded-lg px-4 py-3">
              <div className="text-[13px]">
                {s.connected ? (
                  <span className="inline-flex items-center gap-1.5 text-[#4E6B0E]"><Link2 size={14} />Connected to <strong className="text-ink">{s.companyName || pack.company}</strong></span>
                ) : (
                  <span className="text-text-sec">Not connected. Connecting opens the {conn.label} sign-in to authorize Timbridge.</span>
                )}
                <div className="text-[11px] text-text-ter mt-0.5">Prototype: the connection is simulated — no data leaves this browser.</div>
              </div>
              {s.connected ? (
                <Button size="sm" variant="destructive" leftIcon={<Unlink size={13} />} onClick={() => finance.updateSettings({ connected: false })}>Disconnect</Button>
              ) : (
                <Button size="sm" variant="primary" leftIcon={<Link2 size={13} />} onClick={() => finance.updateSettings({ connected: true, companyName: pack.company })}>Connect {conn.label}</Button>
              )}
            </div>
          )}
        </section>

        {/* Billing rules */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">Billing rules</div>
          <div className="space-y-2 text-[13px]">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="radio" name="trigger" className="accent-coral mt-0.5" checked={s.invoiceTrigger === "onDelivery"} onChange={() => finance.updateSettings({ invoiceTrigger: "onDelivery" })} />
              <span>
                <span className="font-medium text-ink">Draft an invoice when {pack.terms.orders.toLowerCase()} are {pack.terms.shipped.toLowerCase()}</span>
                <span className="block text-[12px] text-text-sec">Billed on what was actually {pack.terms.shipped.toLowerCase()}{pack.id === "logTrading" ? " (delivered m³)" : ""}, at the agreed price.</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="radio" name="trigger" className="accent-coral mt-0.5" checked={s.invoiceTrigger === "manual"} onChange={() => finance.updateSettings({ invoiceTrigger: "manual" })} />
              <span>
                <span className="font-medium text-ink">Create invoices by hand</span>
                <span className="block text-[12px] text-text-sec">{pack.terms.shipped} {pack.terms.orders.toLowerCase()} wait in Invoicing → Ready to invoice.</span>
              </span>
            </label>
            <label className={`flex items-start gap-2.5 pt-2 ${finance.canSync ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
              <input type="checkbox" className="accent-coral mt-0.5" disabled={!finance.canSync} checked={s.autoSend && finance.canSync} onChange={(e) => finance.updateSettings({ autoSend: e.target.checked })} />
              <span>
                <span className="font-medium text-ink">Send new invoices and bills to {conn.syncs ? conn.label : "the accounting system"} automatically</span>
                <span className="block text-[12px] text-text-sec">Off: drafts wait for a review in Invoicing before they are sent.</span>
              </span>
            </label>
          </div>
        </section>

        {/* Currency and tax */}
        <section>
          <div className="text-[14px] font-semibold text-ink mb-2">Currency and tax</div>
          <div className="flex flex-wrap gap-4 text-[13px]">
            <label>
              <div className="text-[11px] text-text-sec mb-1">Currency</div>
              <select className={selectCls} value={s.currency} onChange={(e) => finance.updateSettings({ currency: e.target.value })}>
                {["CAD", "USD"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <div className="text-[11px] text-text-sec mb-1">Tax code on invoices</div>
              <select className={selectCls} value={s.salesTaxCode} onChange={(e) => finance.updateSettings({ salesTaxCode: e.target.value })}>
                {TAX_CODES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <div className="text-[11px] text-text-sec mb-1">Tax code on bills</div>
              <select className={selectCls} value={s.purchaseTaxCode} onChange={(e) => finance.updateSettings({ purchaseTaxCode: e.target.value })}>
                {TAX_CODES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="text-[12px] text-text-ter mt-2">Timbridge sends amounts before tax with the tax code; the accounting system calculates the tax. New documents use these settings.</div>
        </section>

        {/* Customer matching */}
        {conn.syncs && (
          <section>
            <div className="text-[14px] font-semibold text-ink mb-2">Customers in {conn.label}</div>
            <div className="border border-sage/60 rounded-lg overflow-hidden">
              {clients.map((c) => {
                const known = finance.knownCustomers.has(c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px] border-b border-[#F3F4F6] last:border-0">
                    <span className="text-ink">{c.name}</span>
                    {known ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-[#4E6B0E]"><CheckCircle2 size={12} />Matched</span>
                    ) : (
                      <span className="text-[12px] text-text-sec">Will be created with its first invoice</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-[12px] text-text-ter mt-2">Products are sent as line descriptions with quantity, unit and rate ({pack.terms.tags.toLowerCase()} priced per {pack.id === "logTrading" ? "m³" : "piece"}).</div>
          </section>
        )}
      </div>
    </div>
  );
}
