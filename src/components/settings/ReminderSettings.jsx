import { useEffect, useState } from 'react';
import { useAppState, useAppActions } from '../../store/AppContext';
import { useInstall } from '../../hooks/useInstall';
import { deliverReminder, isRemindersOn, notificationState, setRemindersOn } from '../../services/reminderService';

export default function ReminderSettings() {
  const { settings } = useAppState();
  const actions = useAppActions();
  const { ios, standalone } = useInstall();
  const [on, setOn] = useState(false);
  const [perm, setPerm] = useState(notificationState());
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const emailOn = settings.emailReminders === 'true';

  useEffect(() => {
    let alive = true;
    isRemindersOn().then((v) => { if (alive) setOn(v); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  async function turnOn() {
    setMsg(null);
    try {
      if (notificationState() === 'default') await Notification.requestPermission();   // must run inside the tap
      setPerm(notificationState());
      await setRemindersOn(true);
      setOn(true);
    } catch (err) {
      console.error(err);
      setMsg({ err: 'Could not turn reminders on.' });
    }
  }

  async function turnOff() {
    await setRemindersOn(false);
    setOn(false);
    setMsg(null);
  }

  async function sendTest() {
    const how = await deliverReminder({ key: 'test', title: '⏰ Test reminder', body: 'Reminders work on this device.', url: '#/' });
    setMsg({ ok: how === 'system' ? 'Sent a system notification.' : 'Notifications are not allowed, so reminders appear as a banner inside the app (top of the screen).' });
  }

  async function toggleEmail(next) {
    setSaving(true);
    setMsg(null);
    try {
      const appUrl = `${window.location.origin}${window.location.pathname}`;
      await actions.saveSettings({ emailReminders: String(next), appUrl });
      setMsg({ ok: next ? 'Email reminders are on. Complete the one-time setup below if you have not yet.' : 'Email reminders are off.' });
    } catch (err) {
      console.error(err);
      setMsg({ err: 'Could not save that setting.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>Reminders</h2>
      <p className="muted small">
        Reminders use each habit&apos;s reminder time and your check-in time. They only fire while the app is running. A locked phone or a closed app cannot be woken by a web app, so use email reminders for those.
      </p>

      <h3 className="small-title">On this device</h3>
      {ios && !standalone && <p className="small text-danger">On iPhone, notifications only work after you add the app to the Home Screen.</p>}
      {perm === 'unsupported' && <p className="small">This browser has no notification support, so reminders will appear inside the app.</p>}
      {perm === 'denied' && <p className="small">Notifications are blocked for this site. Reminders will appear inside the app. You can allow them in your browser&apos;s site settings.</p>}
      <div className="btn-row">
        {on ? (
          <>
            <button className="btn" onClick={sendTest}>Send test</button>
            <button className="btn" onClick={turnOff}>Turn off</button>
          </>
        ) : (
          <button className="btn btn--primary" onClick={turnOn}>Turn on reminders</button>
        )}
      </div>
      {on && <p role="status" className="small">✅ Reminders are on for this device.</p>}

      <h3 className="small-title">Email (works with the app closed)</h3>
      <label className="check">
        <input type="checkbox" checked={emailOn} disabled={saving} onChange={(e) => toggleEmail(e.target.checked)} />
        <span>Email me my reminders</span>
      </label>
      <details className="archived">
        <summary>One-time setup in Apps Script</summary>
        <ol className="small">
          <li>Update the Apps Script code (new files <code>Reminders.gs</code> and <code>Import.gs</code>).</li>
          <li>Run <code>testReminderEmail</code> once and approve the permissions. Check your inbox.</li>
          <li>Run <code>installReminderTrigger</code> once. It checks every 15 minutes.</li>
          <li>Deploy a <strong>new version</strong> (Deploy → Manage deployments → ✏️ → New version).</li>
          <li>Turn the switch above on. Emails arrive 0–20 minutes after the reminder time, one email per run.</li>
        </ol>
      </details>

      {msg && msg.ok && <p role="status" className="small">✅ {msg.ok}</p>}
      {msg && msg.err && <p role="alert" className="small text-danger">❌ {msg.err}</p>}
    </section>
  );
}