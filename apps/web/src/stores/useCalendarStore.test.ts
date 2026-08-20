import { describe, it, expect, beforeEach } from "vitest";
import { useCalendarStore } from "./useCalendarStore";
import type { IsoDate } from "@renewal/shared";

describe("useCalendarStore", () => {
  const today = "2026-03-15" as IsoDate;
  const weekStartsOn = 1; // Monday

  beforeEach(() => {
    // Reset store to initial state
    useCalendarStore.setState({
      view: "month",
      anchor: today,
    });
  });

  describe("setView", () => {
    it("updates the view", () => {
      const { setView } = useCalendarStore.getState();

      setView("week");

      expect(useCalendarStore.getState().view).toBe("week");
    });
  });

  describe("setAnchor", () => {
    it("updates the anchor", () => {
      const { setAnchor } = useCalendarStore.getState();
      const newDate = "2026-04-01" as IsoDate;

      setAnchor(newDate);

      expect(useCalendarStore.getState().anchor).toBe(newDate);
    });
  });

  describe("goToToday", () => {
    it("sets anchor to the passed-in today", () => {
      const { setAnchor, goToToday } = useCalendarStore.getState();

      // Set to a different date
      setAnchor("2026-01-01" as IsoDate);
      expect(useCalendarStore.getState().anchor).toBe("2026-01-01");

      // Go to today
      goToToday(today);

      expect(useCalendarStore.getState().anchor).toBe(today);
    });
  });

  describe("shiftBy", () => {
    it("shifts week view by delta weeks", () => {
      const { setView, setAnchor, shiftBy } = useCalendarStore.getState();

      setView("week");
      setAnchor("2026-03-15" as IsoDate);

      // Shift forward 1 week
      shiftBy(1, today, weekStartsOn);
      expect(useCalendarStore.getState().anchor).toBe("2026-03-22");

      // Shift back 2 weeks
      shiftBy(-2, today, weekStartsOn);
      expect(useCalendarStore.getState().anchor).toBe("2026-03-08");
    });

    it("shifts month view by delta months", () => {
      const { setView, setAnchor, shiftBy } = useCalendarStore.getState();

      setView("month");
      setAnchor("2026-03-15" as IsoDate);

      // Shift forward 1 month
      shiftBy(1, today, weekStartsOn);
      expect(useCalendarStore.getState().anchor).toBe("2026-04-15");

      // Shift back 2 months
      shiftBy(-2, today, weekStartsOn);
      expect(useCalendarStore.getState().anchor).toBe("2026-02-15");
    });

    it("shifts year view by delta years", () => {
      const { setView, setAnchor, shiftBy } = useCalendarStore.getState();

      setView("year");
      setAnchor("2026-03-15" as IsoDate);

      // Shift forward 1 year
      shiftBy(1, today, weekStartsOn);
      expect(useCalendarStore.getState().anchor).toBe("2027-03-15");

      // Shift back 2 years
      shiftBy(-2, today, weekStartsOn);
      expect(useCalendarStore.getState().anchor).toBe("2025-03-15");
    });

    it("handles shifting back from the 31st of a month", () => {
      const { setView, setAnchor, shiftBy } = useCalendarStore.getState();

      setView("month");
      setAnchor("2026-01-31" as IsoDate);

      // Shift forward to February (which has fewer days)
      shiftBy(1, today, weekStartsOn);
      // date-fns addMonths handles this by clamping to the last day of Feb
      expect(useCalendarStore.getState().anchor).toBe("2026-02-28");
    });

    it("shiftBy(-1) on a month anchor moves back a month", () => {
      const { setView, setAnchor, shiftBy } = useCalendarStore.getState();

      setView("month");
      setAnchor("2026-05-15" as IsoDate);

      shiftBy(-1, today, weekStartsOn);

      expect(useCalendarStore.getState().anchor).toBe("2026-04-15");
    });
  });
});
