/** Rendered inside the inner layout while a section loads. */
export default function AgencyInnerLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading page…</span>
      <div className="ag-page-heading">
        <h1>Loading…</h1>
      </div>
      <hr className="ag-divider" />
      <p className="text-[12px] text-[#666]">Fetching this section…</p>
    </div>
  );
}
