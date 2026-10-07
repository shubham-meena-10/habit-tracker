import { useState } from "react";
import { describeError } from "../../api/api";
import { useAppActions } from "../../store/AppContext";
import { applyTheme } from "../../hooks/useTheme";
import { clearHistoryCache } from "../../hooks/useHistoryEntries";

export default function DangerSettings() {
  const actions = useAppActions();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function run() {
    if (busy || text.trim() !== "RESET") return;
    if (
      !window.confirm(
        "Aakhri warning: Sheet aur is device ka SAARA data (habits, history, settings) hat jayega aur default habits wapas aa jayengi. Ye undo nahi hoga. Continue?",
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const result = await actions.factoryReset();
      clearHistoryCache();
      applyTheme("system");
      setText("");
      setMsg(
        result.ok
          ? { ok: "Done. Sheet aur ye device default par aa gaye." }
          : {
              err:
                result.message ||
                "Reset ho gaya, lekin reload fail hua. Full resync try karo.",
            },
      );
    } catch (err) {
      setMsg({ err: `${describeError(err)} Reset poora nahi hua.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card warn-card">
      <h2>⚠️ Reset everything</h2>
      <p className="small">
        Google Sheet aur is device ka saara data delete hoga: habits, entries,
        history, settings, timers. Default habits aur default settings wapas
        aayengi. API token aur reminders ka on/off switch bacha rahega.
      </p>
      <p className="muted small">
        Pehle <strong>Data &amp; backup → Export everything (JSON)</strong> se
        backup le lo. Dusre devices par baad me{" "}
        <strong>Reset local cache</strong> chalana, warna wahan purana data
        dikhega.
      </p>
      <div className="form-row">
        <div className="field">
          <label htmlFor="rs-confirm">Confirm karne ke liye RESET likho</label>
          <input
            id="rs-confirm"
            className="input"
            autoComplete="off"
            value={text}
            onChange={(e) => {
              setMsg(null);
              setText(e.target.value);
            }}
          />
        </div>
      </div>
      <div className="btn-row">
        <button
          className="btn btn--danger"
          disabled={busy || text.trim() !== "RESET"}
          onClick={run}
        >
          {busy ? "Resetting…" : "Reset everything"}
        </button>
      </div>
      {msg && msg.ok && (
        <p role="status" className="small">
          ✅ {msg.ok}
        </p>
      )}
      {msg && msg.err && (
        <p role="alert" className="small text-danger">
          ❌ {msg.err}
        </p>
      )}
    </section>
  );
}
