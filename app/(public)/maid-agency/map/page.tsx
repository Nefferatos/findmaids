import Link from "next/link";
import { getAgencyDirectory } from "@/lib/agency-directory-server";
import {
  distanceFromArea,
  formatDistance,
  type AgencyDirectoryData,
} from "@/lib/agency-directory";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Maid agencies near you | FindMaids",
  description:
    "See maid agencies on the map and compare the nearest licensed agencies by address, distance and contact details.",
};

/** Map view is centred on Singapore; agencies are listed by distance from it. */
const SINGAPORE_CENTER = { latitude: 1.3521, longitude: 103.8198 };

const MAP_SRC =
  "https://www.openstreetmap.org/export/embed.html?bbox=103.60%2C1.22%2C104.05%2C1.48&layer=mapnik";

export default async function MaidAgencyMapPage() {
  let data: AgencyDirectoryData = {
    agencies: [],
    total: 0,
    topBanners: [],
    leftBanners: [],
    rightBanners: [],
    featuredPool: [],
  };
  try {
    data = await getAgencyDirectory();
  } catch (error) {
    logger.error(
      { errorType: error instanceof Error ? error.name : "unknown" },
      "Unable to load the agency map",
    );
  }

  const located = data.agencies
    .map((agency) => ({
      agency,
      distance: distanceFromArea(agency, SINGAPORE_CENTER),
    }))
    .sort((left, right) => {
      if (left.distance === null) return 1;
      if (right.distance === null) return -1;
      return left.distance - right.distance;
    });

  return (
    <div className="fm-agency-page">
      <div className="fm-agency-center fm-agency-center-wide">
        <nav className="fm-agency-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">›</span>
          <Link href="/maid-agency">Maid agency</Link>
          <span aria-hidden="true">›</span>
          <span>Map</span>
        </nav>

        <p className="fm-agency-eyebrow">Agencies near you</p>
        <h1 className="fm-agency-title">Maid agencies on the map</h1>
        <p className="fm-agency-lead">
          Agencies are listed by their distance from central Singapore. Call
          ahead to confirm opening hours before visiting, and use the agency
          profile for the full address and contact details.
        </p>

        <div className="fm-agency-map-embed">
          <iframe
            title="Map of Singapore"
            src={MAP_SRC}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <section className="fm-agency-about" aria-labelledby="map-list">
          <h2 id="map-list">Listed agencies</h2>
          {located.length === 0 ? (
            <p>No approved agencies are listed right now.</p>
          ) : (
            <ul className="fm-agency-map-list">
              {located.map(({ agency, distance }) => (
                <li key={agency.id}>
                  <div>
                    <Link href={`/agencies/${agency.slug}`}>{agency.name}</Link>
                    <p>
                      {agency.address}
                      {agency.licenseNumber
                        ? ` · MOM Licence No: ${agency.licenseNumber}`
                        : ""}
                    </p>
                  </div>
                  <span>
                    {distance === null
                      ? "Location not mapped"
                      : `${formatDistance(distance)} from centre`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
