export default function MaidSearchLoading() {
  return (
    <div className="fm-search-page fm-explorer" aria-busy="true">
      <div className="fm-explorer-head">
        <div className="fm-skeleton fm-skeleton-title" />
        <div className="fm-skeleton fm-skeleton-line" />
      </div>
      <div className="fm-explorer-layout">
        <div className="fm-skeleton fm-skeleton-aside" aria-hidden="true" />
        <div className="fm-results-main">
          <div className="fm-skeleton fm-skeleton-line fm-skeleton-line--short" />
          <div className="fm-maid-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="fm-skeleton fm-skeleton-card"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading maid results</span>
    </div>
  );
}
