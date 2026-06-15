/**
 * Distinct colours for trip map pins, assigned by position within the day.
 * Stable per index: the 2nd located activity is always the 2nd colour, regardless
 * of how many activities the day has. Wraps around if a day has more activities
 * than colours. All colours are dark enough to stay legible with white pin text.
 *
 * Shared so a later step can colour the matching rows in the activity list.
 */
export const TRIP_PIN_PALETTE = [
  "#E53935", // red
  "#1E88E5", // blue
  "#43A047", // green
  "#FB8C00", // orange
  "#8E24AA", // purple
  "#00897B", // teal
  "#C2185B", // pink
  "#5E35B1", // deep purple
  "#3949AB", // indigo
  "#00838F", // cyan
];

export function tripPinColor(index: number): string {
  return TRIP_PIN_PALETTE[index % TRIP_PIN_PALETTE.length];
}
