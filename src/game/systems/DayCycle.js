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
  { hour: 8, color: 0xffc875, tintAlpha: 0.17, lampAlpha: 0.12 },
  { hour: 9, color: 0xffdfaa, tintAlpha: 0.085, lampAlpha: 0.035 },
  { hour: 10, color: 0xffffff, tintAlpha: 0.008, lampAlpha: 0 },
  { hour: 16, color: 0xfff0d0, tintAlpha: 0.025, lampAlpha: 0.025 },
  { hour: 17.5, color: 0xffa45f, tintAlpha: 0.14, lampAlpha: 0.24 },
  { hour: 18.5, color: 0xc96b83, tintAlpha: 0.23, lampAlpha: 0.52 },
  { hour: 19.25, color: 0x474d85, tintAlpha: 0.34, lampAlpha: 0.86 },
  { hour: 20, color: 0x142347, tintAlpha: 0.46, lampAlpha: 1 },
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
