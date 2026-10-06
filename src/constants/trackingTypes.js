// Generic definitions. Behaviour keys off these, never off habit names.
export const TRACKING_TYPES = {
  BOOLEAN: 'BOOLEAN',
  COUNT: 'COUNT',
  DURATION: 'DURATION',
  QUANTITY: 'QUANTITY',
  TIMER: 'TIMER',
  LIMIT: 'LIMIT',
  ABSTINENCE: 'ABSTINENCE',
};

export const GOAL_DIRECTIONS = {
  INCREASE: 'INCREASE',
  DECREASE: 'DECREASE',
  MAINTAIN: 'MAINTAIN',
  AVOID: 'AVOID',
};

export const HABIT_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
};