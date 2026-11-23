"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

export type ContractAgency = {
  name: string;
  licenseNumber: string | null;
  address: string;
  city: string;
  province: string;
  phone: string;
  email: string;
};

export type ContractMaid = {
  id: string;
  reference: string;
  nationality: string;
  languages: string[];
  duties: string[];
  monthlySalary: number | null;
  placementType: string;
  availableFrom: string | null;
};

const field =
  "w-full rounded-md border bg-white px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none";

function currency(value: number | null) {
  return value === null ? "to be agreed" : `S$${value.toLocaleString("en-SG")}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-40 shrink-0 font-semibold">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function AgencyContractBuilder({
  agency,
  maids,
}: {
  agency: ContractAgency;
  maids: ContractMaid[];
}) {
  const [doc, setDoc] = useState<"contract" | "biodata">("contract");
  const [maidId, setMaidId] = useState(maids[0]?.id ?? "");
  const [employer, setEmployer] = useState("");
  const [employerAddress, setEmployerAddress] = useState("");
  const [startDate, setStartDate] = useState("");

  const maid = maids.find((item) => item.id === maidId) ?? null;
  const agencyAddress = [agency.address, agency.city, agency.province]
    .filter(Boolean)
    .join(", ");

  if (!maid) {
    return (
      <p className="rounded-md border bg-[#fff7d6] p-3 text-sm">
        Add a maid profile first — contracts and biodata sheets are generated
        from your maid records.
      </p>
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 print:hidden">
        <label className="text-sm font-semibold">
          Document
          <select
            className={`${field} mt-1`}
            value={doc}
            onChange={(event) =>
              setDoc(event.target.value as "contract" | "biodata")
            }
          >
            <option value="contract">Employment contract</option>
            <option value="biodata">Maid biodata summary</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Maid
          <select
            className={`${field} mt-1`}
            value={maidId}
            onChange={(event) => setMaidId(event.target.value)}
          >
            {maids.map((item) => (
              <option key={item.id} value={item.id}>
                {item.reference} · {item.nationality}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Employer name
          <input
            className={`${field} mt-1`}
            value={employer}
            onChange={(event) => setEmployer(event.target.value)}
            placeholder="Filled in by the employer"
          />
        </label>
        <label className="text-sm font-semibold">
          Employer address
          <input
            className={`${field} mt-1`}
            value={employerAddress}
            onChange={(event) => setEmployerAddress(event.target.value)}
            placeholder="Filled in by the employer"
          />
        </label>
        <label className="text-sm font-semibold">
          Start date
          <input
            type="date"
            className={`${field} mt-1`}
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-primary inline-flex touch-manipulation items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
          >
            <Printer aria-hidden="true" className="size-4" />
            Print / save as PDF
          </button>
        </div>
        <p className="text-muted-foreground text-xs sm:col-span-2">
          Template only. Review it with your legal adviser and adjust the terms
          before use.
        </p>
      </div>

      <article className="agency-contract-print mt-4 rounded-md border p-5 text-sm leading-6">
        <header className="border-b pb-3">
          <h3 className="font-display text-lg font-bold">{agency.name}</h3>
          <p className="text-xs">
            {agency.licenseNumber ? `Licence ${agency.licenseNumber} · ` : ""}
            {agencyAddress}
          </p>
          <p className="text-xs">
            {agency.phone} · {agency.email}
          </p>
        </header>

        {doc === "contract" ? (
          <>
            <h4 className="font-display mt-4 text-base font-bold">
              Employment Contract (template)
            </h4>
            <div className="mt-3 grid gap-1">
              <Row
                label="Employer"
                value={employer || "____________________"}
              />
              <Row
                label="Employer address"
                value={employerAddress || "____________________"}
              />
              <Row label="Maid reference" value={maid.reference} />
              <Row label="Nationality" value={maid.nationality} />
              <Row label="Placement type" value={maid.placementType} />
              <Row
                label="Monthly salary"
                value={currency(maid.monthlySalary)}
              />
              <Row
                label="Commencement date"
                value={startDate || "____________________"}
              />
            </div>
            <h4 className="mt-4 font-semibold">Duties</h4>
            <p>
              {maid.duties.length
                ? maid.duties.join(", ")
                : "General household duties as agreed in writing."}
            </p>
            <h4 className="mt-3 font-semibold">Terms</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>
                The employer engages the maid named above from the commencement
                date, subject to the placement type shown.
              </li>
              <li>
                Salary is paid monthly on a date agreed in writing. Any
                deductions are limited to those allowed by law.
              </li>
              <li>
                Working hours, rest days, public holidays and leave follow the
                employer&apos;s obligations under the Employment Act and the
                maid&apos;s work permit conditions.
              </li>
              <li>
                Either party may end this contract by giving written notice or
                payment in lieu, as agreed and permitted by law.
              </li>
              <li>
                The agency named at the top of this document arranges the
                placement; it is not the employer under this contract.
              </li>
            </ol>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="border-t pt-1 text-xs">
                Employer signature / date
              </div>
              <div className="border-t pt-1 text-xs">Maid signature / date</div>
            </div>
          </>
        ) : (
          <>
            <h4 className="font-display mt-4 text-base font-bold">
              Maid biodata summary
            </h4>
            <div className="mt-3 grid gap-1">
              <Row label="Reference" value={maid.reference} />
              <Row label="Nationality" value={maid.nationality} />
              <Row
                label="Languages"
                value={maid.languages.length ? maid.languages.join(", ") : "—"}
              />
              <Row label="Placement type" value={maid.placementType} />
              <Row
                label="Monthly salary"
                value={currency(maid.monthlySalary)}
              />
              <Row
                label="Available from"
                value={maid.availableFrom || "Immediately"}
              />
            </div>
            <h4 className="mt-4 font-semibold">Duties</h4>
            <p>
              {maid.duties.length
                ? maid.duties.join(", ")
                : "General household duties."}
            </p>
            <p className="text-muted-foreground mt-4 text-xs">
              Biodata supplied by {agency.name}. Contact {agency.phone} or{" "}
              {agency.email} to arrange an interview.
            </p>
          </>
        )}
      </article>
    </div>
  );
}
