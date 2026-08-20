import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IsoDate } from "@renewal/shared";
import { shiftAnchor, type CalendarView } from "@renewal/shared";

interface CalendarState {
  view: CalendarView;
  anchor: IsoDate;
}

interface CalendarActions {
  setView: (view: CalendarView) => void;
  setAnchor: (anchor: IsoDate) => void;
  goToToday: (today: IsoDate) => void;
  shiftBy: (delta: number, today: IsoDate, weekStartsOn: 0 | 1) => void;
}

type CalendarStore = CalendarState & CalendarActions;

const initialState: CalendarState = {
  view: "month",
  anchor: "2026-01-01" as IsoDate, // Placeholder, replaced by today on first render
};

export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setView: (view) => set({ view }),

      setAnchor: (anchor) => set({ anchor }),

      goToToday: (today) => set({ anchor: today }),

      shiftBy: (delta, today, weekStartsOn) =>
        set((state) => ({
          anchor: shiftAnchor(state.anchor, state.view, delta, {
            today,
            weekStartsOn,
          }),
        })),
    }),
    {
      name: "renewal-tracker-calendar-v1",
      version: 1,
      // Only persist view preference, not anchor.
      // Reopening the app should land on today, not on last month.
      partialize: (state) => ({ view: state.view }),
    },
  ),
);
