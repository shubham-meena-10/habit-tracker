// import PageHeader from '../components/common/PageHeader';
// import EmptyState from '../components/common/EmptyState';

// export default function ProgressPage() {
//   return (
//     <>
//       <PageHeader title="Progress" />
//       <EmptyState
//         title="Nothing to show yet"
//         message="Your progress will appear here once you start tracking."
//       />
//     </>
//   );
// }


import { useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import PeriodSummary from '../components/progress/PeriodSummary';
import YearSummary from '../components/progress/YearSummary';
import { useAppState } from '../store/AppContext';
import { useStatsContext } from '../hooks/useStatsContext';

const VIEWS = [['week', 'Week'], ['month', 'Month'], ['year', 'Year']];

export default function ProgressPage() {
  const { ready, habits } = useAppState();
  const ctx = useStatsContext();
  const [view, setView] = useState('week');

  if (!ready) return (<><PageHeader title="Progress" /><p className="muted">Loading…</p></>);
  if (!habits.some((h) => h.status !== 'archived')) {
    return (
      <>
        <PageHeader title="Progress" />
        <EmptyState title="Nothing to show yet" message="Your progress will appear here once you start tracking." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Progress" />
      <div className="chip-row" role="group" aria-label="Period" style={{ marginBottom: 16 }}>
        {VIEWS.map(([key, label]) => (
          <button key={key} className={`chip${view === key ? ' chip--on' : ''}`} aria-pressed={view === key} onClick={() => setView(key)}>
            {label}
          </button>
        ))}
      </div>
      {view === 'year' ? <YearSummary ctx={ctx} /> : <PeriodSummary key={view} kind={view} ctx={ctx} />}
    </>
  );
}