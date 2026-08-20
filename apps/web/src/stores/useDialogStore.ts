import { create } from "zustand";

type DialogKind = "confirm-delete" | "mark-renewed" | null;

interface DialogState {
  kind: DialogKind;
  itemId: string | null;
}

interface DialogActions {
  openDialog: (kind: Exclude<DialogKind, null>, itemId: string) => void;
  closeDialog: () => void;
}

type DialogStore = DialogState & DialogActions;

const initialState: DialogState = {
  kind: null,
  itemId: null,
};

/**
 * Dialog state store.
 *
 * Keeping dialog state here rather than in page components is what lets a card
 * in the calendar and a row on the dashboard open the same dialog.
 */
export const useDialogStore = create<DialogStore>()((set) => ({
  ...initialState,

  openDialog: (kind, itemId) => set({ kind, itemId }),

  closeDialog: () => set(initialState),
}));
