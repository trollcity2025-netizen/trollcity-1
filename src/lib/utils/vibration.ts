export const triggerVibration = (duration: number | number[]) => {
  if (typeof window !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(duration);
  }
};
