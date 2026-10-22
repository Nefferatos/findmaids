"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";

type FormState = { message: string; error: boolean };

function Status({ state }: { state: FormState }) {
  return state.message ? (
    <p
      role="status"
      aria-live="polite"
      className={state.error ? "text-sm text-red-700" : "text-primary text-sm"}
    >
      {state.message}
    </p>
  ) : null;
}

const inputClass =
  "mt-1 block min-h-11 w-full rounded-md border bg-white px-3 py-2 text-base";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [state, setState] = useState<FormState>({ message: "", error: false });
  const callbackUrl = search.get("callbackUrl") ?? "/";

  async function submit(formData: FormData) {
    setState({ message: "", error: false });
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      totp: formData.get("totp"),
      redirect: false,
      redirectTo: callbackUrl,
    });
    if (result?.error)
      setState({
        message:
          "Email or password is incorrect, or your email is not verified.",
        error: true,
      });
    else router.push(callbackUrl);
  }

  return (
    <form action={submit} className="space-y-4">
      <label className="block text-sm font-semibold">
        Email
        <input
          className={inputClass}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <label className="block text-sm font-semibold">
        Password
        <input
          className={inputClass}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      <label className="block text-sm font-semibold">
        Authenticator code (ADMIN accounts with 2FA)
        <input className={inputClass} name="totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} />
      </label>
      <Status state={state} />
      <button className="bg-primary min-h-11 w-full rounded-md px-4 font-bold text-white hover:brightness-90">
        Log in
      </button>
      {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
        <button
          type="button"
          onClick={() => void signIn("google", { redirectTo: callbackUrl })}
          className="hover:bg-muted min-h-11 w-full rounded-md border bg-white px-4 font-semibold"
        >
          Continue with Google
        </button>
      )}
    </form>
  );
}

export function RegisterForm({
  initialAccountType = "employer",
}: {
  initialAccountType?: "employer" | "agency";
}) {
  const [state, setState] = useState<FormState>({ message: "", error: false });
  async function submit(formData: FormData) {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const data = await response.json();
    setState({ message: data.message ?? data.error, error: !response.ok });
  }
  return (
    <form action={submit} className="space-y-4">
      <label className="block text-sm font-semibold">
        Full name
        <input
          className={inputClass}
          name="name"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
        />
      </label>
      <label className="block text-sm font-semibold">
        Email
        <input
          className={inputClass}
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
        />
      </label>
      <label className="block text-sm font-semibold">
        Password
        <input
          className={inputClass}
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
        />
        <span className="text-muted-foreground mt-1 block text-xs font-normal">
          Use at least 10 characters.
        </span>
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">I am registering as</legend>
        <div className="mt-2 flex flex-wrap gap-5">
          <label className="flex min-h-10 items-center gap-2">
            <input
              type="radio"
              name="accountType"
              value="employer"
              defaultChecked={initialAccountType === "employer"}
            />
            Employer
          </label>
          <label className="flex min-h-10 items-center gap-2">
            <input
              type="radio"
              name="accountType"
              value="agency"
              defaultChecked={initialAccountType === "agency"}
            />
            Agency
          </label>
        </div>
      </fieldset>
      <Status state={state} />
      <button className="bg-primary min-h-11 w-full rounded-md px-4 font-bold text-white hover:brightness-90">
        Create account
      </button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, setState] = useState<FormState>({ message: "", error: false });
  async function submit(formData: FormData) {
    const response = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formData.get("email") }),
    });
    const data = await response.json();
    setState({ message: data.message ?? data.error, error: !response.ok });
  }
  return (
    <form action={submit} className="space-y-4">
      <label className="block text-sm font-semibold">
        Email
        <input
          className={inputClass}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <Status state={state} />
      <button className="bg-primary min-h-11 w-full rounded-md px-4 font-bold text-white">
        Send reset instructions
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({ message: "", error: false });
  async function submit(formData: FormData) {
    const response = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: formData.get("password") }),
    });
    const data = await response.json();
    setState({ message: data.message ?? data.error, error: !response.ok });
    if (response.ok) router.push("/login");
  }
  return (
    <form action={submit} className="space-y-4">
      <label className="block text-sm font-semibold">
        New password
        <input
          className={inputClass}
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <Status state={state} />
      <button className="bg-primary min-h-11 w-full rounded-md px-4 font-bold text-white">
        Update password
      </button>
    </form>
  );
}

export function EnquiryForm({
  agencyId,
  agencyName,
}: {
  agencyId: string;
  agencyName: string;
}) {
  const [state, setState] = useState<FormState>({ message: "", error: false });
  const [turnstileToken, setTurnstileToken] = useState("");
  async function submit(formData: FormData) {
    const response = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...Object.fromEntries(formData),
        agencyId,
        turnstileToken,
      }),
    });
    const data = await response.json();
    setState({ message: data.message ?? data.error, error: !response.ok });
    if (response.ok)
      (
        document.getElementById("enquiry-form") as HTMLFormElement | null
      )?.reset();
  }
  return (
    <form
      id="enquiry-form"
      action={submit}
      className="space-y-4 rounded-md border bg-white p-5"
    >
      <h2 className="font-display text-2xl font-bold">Contact {agencyName}</h2>
      <label className="block text-sm font-semibold">
        Name
        <input
          className={inputClass}
          name="name"
          required
          minLength={2}
          maxLength={100}
        />
      </label>
      <label className="block text-sm font-semibold">
        Email
        <input
          className={inputClass}
          name="email"
          type="email"
          required
          maxLength={254}
        />
      </label>
      <label className="block text-sm font-semibold">
        Phone
        <input className={inputClass} name="phone" type="tel" maxLength={40} />
      </label>
      <label className="block text-sm font-semibold">
        Preferred start date
        <input className={inputClass} name="preferredStartDate" type="date" />
      </label>
      <label className="block text-sm font-semibold">
        Monthly budget (PHP)
        <input
          className={inputClass}
          name="budget"
          type="number"
          min="0"
          step="100"
        />
      </label>
      <label className="block text-sm font-semibold">
        Message
        <textarea
          className={`${inputClass} min-h-28`}
          name="message"
          required
          minLength={5}
          maxLength={4000}
        />
      </label>
      <label className="hidden" aria-hidden="true">
        Leave this field blank
        <input tabIndex={-1} autoComplete="off" name="website" />
      </label>
      <label className="flex items-start gap-3 text-sm leading-6">
        <input
          className="mt-1 size-4"
          type="checkbox"
          name="consentGiven"
          required
        />
        <span>
          I consent to FindMaids sharing these details with {agencyName} to
          respond to this enquiry. I understand I can contact FindMaids to
          request access or correction.{" "}
          <strong>
            Draft consent text; review for Data Privacy Act compliance before
            launch.
          </strong>
        </span>
      </label>
      <Status state={state} />
      <button className="bg-primary min-h-11 w-full rounded-md px-4 font-bold text-white">
        Send enquiry
      </button>
      <p className="text-muted-foreground text-xs">
        Your details are used to process this enquiry. See our{" "}
        <a className="underline" href="/privacy">
          Privacy Policy
        </a>
        .
      </p>
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <Turnstile
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
        />
      )}
    </form>
  );
}

export function ReviewForm({ agencyId }: { agencyId: string }) {
  const [state, setState] = useState<FormState>({ message: "", error: false });
  async function submit(formData: FormData) {
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...Object.fromEntries(formData), agencyId }),
    });
    const data = await response.json();
    setState({ message: data.message ?? data.error, error: !response.ok });
  }
  return (
    <form action={submit} className="space-y-3 rounded-md border bg-white p-5">
      <h3 className="font-display text-xl font-bold">Leave a review</h3>
      <label className="block text-sm font-semibold">
        Your name
        <input
          className={inputClass}
          name="authorName"
          required
          minLength={2}
          maxLength={100}
        />
      </label>
        <label className="block text-sm font-semibold">
          Email (optional)
          <input className={inputClass} name="reviewerEmail" type="email" maxLength={254} autoComplete="email" />
        </label>
      <label className="block text-sm font-semibold">
        Rating
        <select className={inputClass} name="rating" required defaultValue="5">
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Good</option>
          <option value="3">3 - Average</option>
          <option value="2">2 - Poor</option>
          <option value="1">1 - Very poor</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Title
        <input
          className={inputClass}
          name="title"
          required
          minLength={3}
          maxLength={120}
        />
      </label>
      <label className="block text-sm font-semibold">
        Review
        <textarea
          className={`${inputClass} min-h-24`}
          name="body"
          required
          minLength={10}
          maxLength={3000}
        />
      </label>
      <Status state={state} />
      <button className="hover:bg-muted min-h-11 rounded-md border px-4 font-semibold">
        Submit for moderation
      </button>
    </form>
  );
}
