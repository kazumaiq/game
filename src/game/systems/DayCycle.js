/**
 * DayCycle — deterministic clock and lighting profile for a single work shift.
 * The full in-game shift (08:00–20:00) maps to BALANCE.time.shiftDurationMs.
 */

const PHASES = {
  morning: { label: 'УТРО', icon: '🌤', description: 'Утренняя смена' },
  day: { label: 'ДЕНЬ', icon: '☀️', description: 'Дневной пик' },
  golden: { label: 'ЗАКАТ', icon: '🌇', description: 'Золотой час' },
  evening: { label: 'ВЕЧЕР', icon: '🌙', description: 'Вечерняя смена' },
};

const KEYFRAMES = [
  { hour: 8, color: 0xffd9a0, tintAlpha: 0.105, lampAlpha: 0.08 },
  { hour: 9, color: 0xffe7c0, tintAlpha: 0.055, lampAlpha: 0.025 },
  { hour: 10, color: 0xffffff, tintAlpha: 0, lampAlpha: 0 },
  { hour: 16, color: 0xfff4dd, tintAlpha: 0.018, lampAlpha: 0.015 },
  { hour: 17.5, color: 0xffbc7a, tintAlpha: 0.105, lampAlpha: 0.16 },
  { hour: 18.5, color: 0xe28b80, tintAlpha: 0.16, lampAlpha: 0.38 },
  { hour: 19.25, color: 0x55517c, tintAlpha: 0.27, lampAlpha: 0.72 },
  { hour: 20, color: 0x1b2b56, tintAlpha: 0.39, lampAlpha: 1 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function phaseForHour(hour) {
  if (hour < 10) return 'morning';
  if (hour < 16.5) return 'day';
  if (hour < 18.5) return 'golden';
  return 'evening';
}

function mixColor(a, b, amount) {
  const t = clamp(amount, 0, 1);
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

/** Returns the current in-game clock and readable part-of-day metadata. */
export function getShiftClock(remainingMs, timeConfig = {}) {
  const durationMs = Math.max(1, Number(timeConfig.shiftDurationMs) || 180_000);
  const startHour = Number.isFinite(timeConfig.dayStartHour) ? timeConfig.dayStartHour : 8;
  const endHour = Number.isFinite(timeConfig.dayEndHour) ? timeConfig.dayEndHour : 20;
  const elapsedMs = clamp(durationMs - (Number(remainingMs) || 0), 0, durationMs);
  const progress = elapsedMs / durationMs;
  const hour = startHour + (endHour - startHour) * progress;
  const totalMinutes = clamp(Math.round(hour * 60), Math.round(startHour * 60), Math.round(endHour * 60));
  const clockHour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const phase = phaseForHour(hour);
  const phaseMeta = PHASES[phase];

  return {
    hour,
    progress,
    clock: `${String(clockHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    phase,
    label: phaseMeta.label,
    icon: phaseMeta.icon,
    description: phaseMeta.description,
  };
}

/** Interpolated warm-to-cool environmental tint and practical-light intensity. */
export function getDayCycleProfile(hour) {
  const safeHour = clamp(Number.isFinite(hour) ? hour : 8, KEYFRAMES[0].hour, KEYFRAMES[KEYFRAMES.length - 1].hour);
  let left = KEYFRAMES[0];
  let right = KEYFRAMES[KEYFRAMES.length - 1];

  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (safeHour >= KEYFRAMES[i].hour && safeHour <= KEYFRAMES[i + 1].hour) {
      left = KEYFRAMES[i];
      right = KEYFRAMES[i + 1];
      break;
    }
  }

  const span = right.hour - left.hour || 1;
  const t = (safeHour - left.hour) / span;
  return {
    phase: phaseForHour(safeHour),
    tintColor: mixColor(left.color, right.color, t),
    tintAlpha: left.tintAlpha + (right.tintAlpha - left.tintAlpha) * t,
    lampAlpha: left.lampAlpha + (right.lampAlpha - left.lampAlpha) * t,
  };
}

export default { getShiftClock, getDayCycleProfile };
