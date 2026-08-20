import { describe, it, expect, beforeEach } from "vitest";
import { useDialogStore } from "./useDialogStore";

describe("useDialogStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useDialogStore.getState().closeDialog();
  });

  describe("initial state", () => {
    it("starts with no dialog open", () => {
      const { kind, itemId } = useDialogStore.getState();

      expect(kind).toBeNull();
      expect(itemId).toBeNull();
    });
  });

  describe("openDialog", () => {
    it("opens confirm-delete dialog with itemId", () => {
      const { openDialog } = useDialogStore.getState();

      openDialog("confirm-delete", "item-123");

      const state = useDialogStore.getState();
      expect(state.kind).toBe("confirm-delete");
      expect(state.itemId).toBe("item-123");
    });

    it("opens mark-renewed dialog with itemId", () => {
      const { openDialog } = useDialogStore.getState();

      openDialog("mark-renewed", "item-456");

      const state = useDialogStore.getState();
      expect(state.kind).toBe("mark-renewed");
      expect(state.itemId).toBe("item-456");
    });

    it("replaces the previous dialog when opening a new one", () => {
      const { openDialog } = useDialogStore.getState();

      openDialog("confirm-delete", "item-123");
      expect(useDialogStore.getState().kind).toBe("confirm-delete");
      expect(useDialogStore.getState().itemId).toBe("item-123");

      openDialog("mark-renewed", "item-456");
      expect(useDialogStore.getState().kind).toBe("mark-renewed");
      expect(useDialogStore.getState().itemId).toBe("item-456");
    });
  });

  describe("closeDialog", () => {
    it("resets kind and itemId to null", () => {
      const { openDialog, closeDialog } = useDialogStore.getState();

      openDialog("confirm-delete", "item-123");
      expect(useDialogStore.getState().kind).toBe("confirm-delete");
      expect(useDialogStore.getState().itemId).toBe("item-123");

      closeDialog();

      const state = useDialogStore.getState();
      expect(state.kind).toBeNull();
      expect(state.itemId).toBeNull();
    });

    it("is idempotent when no dialog is open", () => {
      const { closeDialog } = useDialogStore.getState();

      closeDialog();
      expect(useDialogStore.getState().kind).toBeNull();

      closeDialog();
      expect(useDialogStore.getState().kind).toBeNull();
    });
  });
});
