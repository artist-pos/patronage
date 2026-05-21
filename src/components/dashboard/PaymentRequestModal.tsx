"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { requestPayment } from "@/app/dashboard/payment-actions";

const NZ_BANK_RE = /^\d{2}-\d{4}-\d{7}-\d{2,3}$/;
const GST_RE = /^\d{8,9}$/;

interface Props {
  applicationId: string;
  prefillName: string;
  prefillGstRegistered: boolean;
  prefillGstNumber: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentRequestModal({
  applicationId,
  prefillName,
  prefillGstRegistered,
  prefillGstNumber,
  onClose,
  onSuccess,
}: Props) {
  const [accountHolder, setAccountHolder] = useState(prefillName);
  const [bankAccount, setBankAccount] = useState("");
  const [gstRegistered, setGstRegistered] = useState(prefillGstRegistered);
  const [gstNumber, setGstNumber] = useState(prefillGstNumber ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function validate() {
    const errs: Record<string, string> = {};
    if (!accountHolder.trim()) errs.accountHolder = "Required";
    if (!NZ_BANK_RE.test(bankAccount.trim())) errs.bankAccount = "Enter a valid NZ bank account (00-0000-0000000-00)";
    if (gstRegistered && gstNumber && !GST_RE.test(gstNumber.trim())) errs.gstNumber = "Enter a valid GST number (8–9 digits)";
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) errs.amount = "Enter a valid amount";
    if (!description.trim()) errs.description = "Required";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    const result = await requestPayment({
      applicationId,
      accountHolder: accountHolder.trim(),
      bankAccount: bankAccount.trim(),
      gstRegistered,
      gstNumber: gstRegistered && gstNumber.trim() ? gstNumber.trim() : null,
      amount: parseFloat(amount),
      description: description.trim(),
    });
    setSubmitting(false);

    if (result.error) {
      setToast("Error: " + result.error);
      setTimeout(() => setToast(null), 4000);
    } else {
      onSuccess();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-black w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black sticky top-0 bg-background">
          <h2 className="text-sm font-semibold">Request payment</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <Field label="Account holder name" error={errors.accountHolder}>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="w-full text-sm border border-black/30 px-3 py-2 focus:outline-none focus:border-black"
            />
          </Field>

          <Field label="Bank account number" hint="NZ format: 00-0000-0000000-00" error={errors.bankAccount}>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="00-0000-0000000-00"
              className="w-full text-sm border border-black/30 px-3 py-2 focus:outline-none focus:border-black font-mono"
            />
          </Field>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gstRegistered}
                onChange={(e) => setGstRegistered(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-sm">GST registered</span>
            </label>
            {gstRegistered && (
              <Field label="GST number" error={errors.gstNumber}>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="123456789"
                  className="w-full text-sm border border-black/30 px-3 py-2 focus:outline-none focus:border-black"
                />
              </Field>
            )}
          </div>

          <Field label="Amount (NZD)" error={errors.amount}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-sm border border-black/30 px-3 py-2 focus:outline-none focus:border-black"
            />
          </Field>

          <Field label="Services description" error={errors.description}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="e.g. Artist fee for participation in Open Call 2026"
              className="w-full text-sm border border-black/30 px-3 py-2 focus:outline-none focus:border-black resize-none"
            />
          </Field>

          {toast && (
            <p className="text-xs text-destructive">{toast}</p>
          )}

          <p className="text-xs text-muted-foreground">
            Your bank account number is sent directly to the organiser by email and is not stored by Patronage.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="w-full text-sm bg-black text-white px-4 py-2.5 hover:bg-black/80 transition-colors disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send payment request →"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
