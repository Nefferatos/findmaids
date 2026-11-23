/** Rendered inside the home layout while the launcher data loads. */
export default function AgencyHomeLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading agency portal…</span>
      <p className="ag-welcome">Loading…</p>
      <p className="ag-counts">Fetching your agency details…</p>
    </div>
  );
}
