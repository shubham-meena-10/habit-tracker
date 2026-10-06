// import { Link } from "react-router";
// import { TRACKING_TYPES as T } from "../../constants/trackingTypes";
// import { formatQuick } from "../../utils/format";

// export default function HabitCard({ item, onAdd, onCheck, onUncheck }) {
//   const { habit, calc } = item;
//   const isBool = habit.trackingType === T.BOOLEAN;
//   const isAbst = habit.trackingType === T.ABSTINENCE;
//   const barTone =
//     item.tone === "done"
//       ? " bar__fill--done"
//       : item.tone === "bad"
//         ? " bar__fill--bad"
//         : "";

//   return (
//     <article className={`hcard hcard--${item.tone}`}>
//       <div className="hcard__top">
//         <span className="hcard__icon" aria-hidden="true">
//           {habit.icon}
//         </span>
//         <div className="hcard__title">
//           <Link className="hcard__name" to={`/habits/${habit.habitId}`}>
//             {habit.name}
//           </Link>
//           {item.timeLabel && (
//             <span className="muted small"> · {item.timeLabel}</span>
//           )}
//         </div>
//         <div className="hcard__value">{item.valueText}</div>
//       </div>

//       {item.statusText && <p className="hcard__warn">⚠️ {item.statusText}</p>}
//       {item.subText && <p className="muted small hcard__sub">{item.subText}</p>}

//       {!isBool && !isAbst && (
//         <div
//           className="bar"
//           role="progressbar"
//           aria-valuemin={0}
//           aria-valuemax={100}
//           aria-valuenow={Math.round(item.barPct)}
//           aria-label={`${habit.name} progress`}
//         >
//           <div
//             className={`bar__fill${barTone}`}
//             style={{ width: `${item.barPct}%` }}
//           />
//         </div>
//       )}

//       <div className="hcard-actions">
//         {isBool &&
//           (item.done ? (
//             <button
//               className="btn btn--done"
//               aria-pressed="true"
//               onClick={() => onUncheck(item)}
//             >
//               ✓ Done · tap to undo
//             </button>
//           ) : (
//             <button
//               className="btn btn--primary"
//               onClick={() => onCheck(habit, 1)}
//             >
//               ✓ Mark done
//             </button>
//           ))}

//         {isAbst && calc.state === "pending" && (
//           <>
//             <button
//               className="btn btn--primary"
//               onClick={() => onCheck(habit, 1)}
//             >
//               ✓ Clean today
//             </button>
//             <button
//               className="btn btn--danger"
//               onClick={() => onCheck(habit, 0)}
//             >
//               Slipped
//             </button>
//           </>
//         )}
//         {isAbst && calc.state === "success" && (
//           <button
//             className="btn btn--done"
//             aria-pressed="true"
//             onClick={() => onUncheck(item)}
//           >
//             ✓ Clean · tap to undo
//           </button>
//         )}
//         {isAbst && calc.state === "slip" && (
//           <>
//             <button className="btn" onClick={() => onUncheck(item)}>
//               Undo
//             </button>
//             <button
//               className="btn btn--primary"
//               onClick={() => onCheck(habit, 1)}
//             >
//               Mark clean instead
//             </button>
//           </>
//         )}

//         {!isBool &&
//           !isAbst &&
//           item.quick.map((delta) => (
//             <button
//               key={delta}
//               className="btn quick"
//               disabled={calc.actual + delta < 0}
//               aria-label={`${formatQuick(habit, delta)} ${habit.name}`}
//               onClick={() => onAdd(habit, delta)}
//             >
//               {formatQuick(habit, delta)}
//             </button>
//           ))}
//       </div>

//       {item.compare && (
//         <p
//           className={`compare${item.compare.good === true ? " compare--good" : item.compare.good === false ? " compare--bad" : ""}`}
//         >
//           {item.compare.text}
//         </p>
//       )}
//     </article>
//   );
// }

import { Link } from "react-router";
import { TRACKING_TYPES as T } from "../../constants/trackingTypes";
import { lowerIsBetter } from "../../engine/calculations";
import { formatQuick } from "../../utils/format";
import TimerChip from "../timer/TimerChip";

export default function HabitCard({
  item,
  timer,
  glass,
  detailsTo,
  onAdd,
  onCheck,
  onUncheck,
  onStartTimer,
}) {
  const { habit, calc } = item;
  const isBool = habit.trackingType === T.BOOLEAN;
  const isAbst = habit.trackingType === T.ABSTINENCE;
  const hasTimer = habit.trackingType === T.TIMER && !lowerIsBetter(habit);
  const barTone =
    item.tone === "done"
      ? " bar__fill--done"
      : item.tone === "bad"
        ? " bar__fill--bad"
        : "";

  return (
    <article className={`hcard hcard--${item.tone}`}>
      <div className="hcard__top">
        <span className="hcard__icon" aria-hidden="true">
          {habit.icon}
        </span>
        <div className="hcard__title">
          <Link className="hcard__name" to={`/habits/${habit.habitId}`}>
            {habit.name}
          </Link>
          {item.timeLabel && (
            <span className="muted small"> · {item.timeLabel}</span>
          )}
        </div>
        <div className="hcard__value">{item.valueText}</div>
      </div>

      {item.statusText && <p className="hcard__warn">⚠️ {item.statusText}</p>}
      {item.subText && <p className="muted small hcard__sub">{item.subText}</p>}
      {item.levelUp && <p className="hcard__level">🆙 {item.levelUp}</p>}
      {item.progressNote && (
        <p className="muted small hcard__sub">{item.progressNote}</p>
      )}

      {!isBool && !isAbst && (
        <div
          className="bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(item.barPct)}
          aria-label={`${habit.name} progress`}
        >
          <div
            className={`bar__fill${barTone}`}
            style={{ width: `${item.barPct}%` }}
          />
        </div>
      )}

      <div className="hcard-actions">
        {isBool &&
          (item.done ? (
            <button
              className="btn btn--done"
              aria-pressed="true"
              onClick={() => onUncheck(item)}
            >
              ✓ Done · tap to undo
            </button>
          ) : (
            <button
              className="btn btn--primary"
              onClick={() => onCheck(habit, 1)}
            >
              ✓ Mark done
            </button>
          ))}

        {isAbst && calc.state === "pending" && (
          <>
            <button
              className="btn btn--primary"
              onClick={() => onCheck(habit, 1)}
            >
              ✓ Clean today
            </button>
            <button
              className="btn btn--danger"
              onClick={() => onCheck(habit, 0)}
            >
              Slipped
            </button>
          </>
        )}
        {isAbst && calc.state === "success" && (
          <button
            className="btn btn--done"
            aria-pressed="true"
            onClick={() => onUncheck(item)}
          >
            ✓ Clean · tap to undo
          </button>
        )}
        {isAbst && calc.state === "slip" && (
          <>
            <button className="btn" onClick={() => onUncheck(item)}>
              Undo
            </button>
            <button
              className="btn btn--primary"
              onClick={() => onCheck(habit, 1)}
            >
              Mark clean instead
            </button>
          </>
        )}

        {hasTimer &&
          (timer ? (
            <Link className="btn btn--primary" to={`/timer/${habit.habitId}`}>
              ⏱ <TimerChip timer={timer} /> · Open
            </Link>
          ) : (
            <button
              className="btn btn--primary"
              onClick={() => onStartTimer(item)}
            >
              ▶ Start
            </button>
          ))}

        {glass && (
          <button
            className="btn btn--primary btn--glass"
            aria-label={`Add one glass, ${formatQuick(habit, glass.delta)} ${habit.name}`}
            onClick={() => onAdd(habit, glass.delta)}
          >
            + 1 Glass{" "}
            <span className="btn__sub">
              {formatQuick(habit, glass.delta).replace(/^\+/, "")}
            </span>
          </button>
        )}

        {!isBool &&
          !isAbst &&
          item.quick
            .filter((d) => !glass || d !== glass.delta)
            .map((delta) => (
              <button
                key={delta}
                className="btn quick"
                disabled={calc.actual + delta < 0}
                aria-label={`${formatQuick(habit, delta)} ${habit.name}`}
                onClick={() => onAdd(habit, delta)}
              >
                {formatQuick(habit, delta)}
              </button>
            ))}
      </div>

      {item.compare && (
        <p
          className={`compare${item.compare.good === true ? " compare--good" : item.compare.good === false ? " compare--bad" : ""}`}
        >
          {item.compare.text}
        </p>
      )}
      {detailsTo && (
        <Link className="small card-link" to={detailsTo}>
          Stats &amp; history →
        </Link>
      )}
    </article>
  );
}
