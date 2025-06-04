/**
 * Format time in milliseconds to a display string
 * @param timeMs Time in milliseconds
 * @returns Formatted time string in mm:ss format
 */
export const formatTime = (timeMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};
