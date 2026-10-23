export function adminMfaSatisfied(input: {
  role: string;
  permission: string;
  totpEnabled: boolean;
  sessionVerified: boolean;
}) {
  return (
    input.role !== "ADMIN" ||
    input.permission === "twoFactor" ||
    (input.totpEnabled && input.sessionVerified)
  );
}
