export function MaintenanceBanner({ message }: { message?: string }) {
  if (!message?.trim()) return null;
  return (
    <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      {message.trim().slice(0, 240)}
    </div>
  );
}
