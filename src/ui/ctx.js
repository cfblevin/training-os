// Shared wiring so UI modules can reach the store without circular imports.
export const ctx = {
  store: null,
  refresh: () => {},
  navigate: () => {},
  openWorkout: () => {},
  closeWorkout: () => {},
  today: () => '',
};
