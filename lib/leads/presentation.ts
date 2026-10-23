export function redactLockedLeadDetails<T extends {
  name: string;
  email: string;
  phone: string | null;
  message: string;
  privateNotes?: string | null;
  aiSummary?: string | null;
  aiHelperType?: string | null;
  aiLocation?: string | null;
  aiBudgetText?: string | null;
  aiStartDateText?: string | null;
  aiReplyDraft?: string | null;
}>(lead: T, locked: boolean) {
  if (!locked) return { ...lead, detailsLocked: false };
  return {
    ...lead,
    name: "Lead waiting · upgrade to view details",
    email: "",
    phone: null,
    message: "Contact details and enquiry content are locked by the current lead-cap setting.",
    privateNotes: null,
    aiSummary: null,
    aiHelperType: null,
    aiLocation: null,
    aiBudgetText: null,
    aiStartDateText: null,
    aiReplyDraft: null,
    detailsLocked: true,
  };
}
