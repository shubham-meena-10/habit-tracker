import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import PageHeader from "../components/common/PageHeader";
import HabitForm from "../components/habits/HabitForm";
import HabitActions from "../components/habits/HabitActions";
import { describeError } from "../api/api";
import { useAppState, useAppActions } from "../store/AppContext";
import { useAnchorsByHabit } from "../hooks/useAnchors";
import { computeTarget } from "../engine/progression";
import {
  NEW_CATEGORY,
  buildPayload,
  emptyForm,
  habitToForm,
} from "../utils/habitForm";
import { todayStr } from "../utils/date";
import PlanEditor from "../components/habits/PlanEditor";
import { isCheckHabit } from "../engine/calculations";

export default function HabitEditPage() {
  const { habitId } = useParams();
  const isNew = habitId === undefined;
  const navigate = useNavigate();
  const { ready, habits, categories, settings } = useAppState();
  const actions = useAppActions();
  const anchors = useAnchorsByHabit();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const habit = isNew
    ? null
    : habits.find((h) => h.habitId === habitId) || null;

  if (!ready)
    return (
      <>
        <PageHeader title={isNew ? "New habit" : "Edit habit"} />
        <p className="muted">Loading…</p>
      </>
    );
  if (!isNew && !habit) {
    return (
      <>
        <PageHeader title="Habit not found" />
        <Link className="btn" to="/habits">
          Back to habits
        </Link>
      </>
    );
  }

  // const info = habit ? computeTarget(habit, anchors.get(habit.habitId) || [], todayStr()) : null;
  const today = todayStr();
  const habitAnchors = habit ? anchors.get(habit.habitId) || [] : [];
  const info = habit ? computeTarget(habit, habitAnchors, today) : null;

  async function handleSubmit(form) {
    setSaving(true);
    setError("");
    try {
      let categoryId = form.categoryId;
      if (categoryId === NEW_CATEGORY) {
        const res = await actions.saveCategory({
          name: form.newCategoryName.trim(),
          icon: form.newCategoryIcon.trim(),
        });
        categoryId = res.category.categoryId;
      }
      await actions.saveHabit(
        buildPayload(form, {
          isNew,
          habitId: habit ? habit.habitId : undefined,
          categoryId,
        }),
      );
      // navigate("/habits");
      navigate(isNew ? '/habits' : `/habits/${habit.habitId}`); 
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={isNew ? "New habit" : `${habit.icon} ${habit.name}`}
        subtitle={
          isNew
            ? "Everything is configurable. Nothing here is hardcoded."
            : undefined
        }
        action={
          <Link className="btn" to={isNew ? "/habits" : `/habits/${habitId}`}>
            Back
          </Link>
        }
      />
      {!isNew && <HabitActions habit={habit} info={info} />}
      {!isNew &&
        !isCheckHabit(habit) &&
        habit.status === "active" &&
        (habit.goalDirection === "INCREASE" ||
          habit.goalDirection === "DECREASE") && (
          <PlanEditor
            habit={habit}
            anchors={habitAnchors}
            info={info}
            today={today}
          />
        )}
      <HabitForm
        key={habit ? habit.habitId : "new"}
        initial={habit ? habitToForm(habit) : emptyForm(settings)}
        isNew={isNew}
        categories={categories}
        currentTarget={info ? info.target : null}
        submitting={saving}
        serverError={error}
        onSubmit={handleSubmit}
        onCancel={() => navigate(isNew ? '/habits' : `/habits/${habitId}`)}
      />
    </>
  );
}
