export function shouldSetFirstRespondedAt(input: {
  previousStatus: "NEW" | "CONTACTED" | "CLOSED";
  nextStatus?: "NEW" | "CONTACTED" | "CLOSED";
  previousNotes: string | null;
  nextNotes?: string;
}) {
  const statusChangedFromNew =
    input.previousStatus === "NEW" &&
    input.nextStatus !== undefined &&
    input.nextStatus !== "NEW";
  const noteAddedOrChanged = Boolean(
    input.nextNotes?.trim() && input.nextNotes.trim() !== (input.previousNotes ?? "").trim(),
  );
  return statusChangedFromNew || noteAddedOrChanged;
}
