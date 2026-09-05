import React, { useEffect, useState } from "react";
import { Activity, Phone, MessageSquare, Send, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { getPushApiBase } from "../../services/pushService";
import { formatToE164 } from "../../utils/phoneUtils";

function apiBase() {
  return (getPushApiBase() || "").replace(/\/$/, "");
}

export default function SmsTester() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    "Hello from Pediatric Clinic Queue — this is a textbee SMS test."
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    fetch(`${apiBase()}/api/sms/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() =>
        setStatus({
          configured: false,
          error: "Cannot reach API (is npm run server:dev running on :5000?)",
        })
      );
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10 && !phone.trim().startsWith("+")) {
      toast.error("Enter a 10-digit PH mobile number (e.g. 9171234567).");
      return;
    }

    setLoading(true);
    setLastResult(null);
    try {
      const payloadPhone = phone.trim().startsWith("+")
        ? phone.trim()
        : formatToE164(digits);

      const res = await fetch(`${apiBase()}/api/sms/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: payloadPhone,
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      setLastResult({ ok: res.ok, status: res.status, data });
      if (!res.ok) {
        toast.error(data.message || "SMS send failed.");
      } else {
        toast.success(`SMS sent to ${data.phone}`);
      }
    } catch (err) {
      toast.error(err.message || "Network error — start the Express server.");
      setLastResult({ ok: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans flex items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="pt-8 pb-5 px-8 text-center border-b border-gray-50">
          <div className="mx-auto w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 border border-blue-100">
            <Activity className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">SMS Tester</h1>
          <p className="text-sm text-gray-500 mt-1">Send a raw textbee.dev message</p>
        </div>

        <div className="p-8 space-y-5">
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              status?.configured
                ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                : "bg-amber-50 text-amber-900 border border-amber-100"
            }`}
          >
            {status?.error
              ? status.error
              : status?.configured
                ? "TEXTBEE_API_KEY loaded on the server."
                : "TEXTBEE_API_KEY missing — check server/.env and restart the server."}
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Recipient
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">
                  +63
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full pl-20 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="9171234567"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Message
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-400" />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || status?.configured === false}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-blue-600 ${
                loading || status?.configured === false
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:bg-blue-700"
              }`}
            >
              {loading ? "Sending..." : "Send Test SMS"}
              {!loading && <Send className="w-4 h-4" />}
            </button>
          </form>

          {lastResult && (
            <pre className="text-xs bg-gray-900 text-green-300 rounded-xl p-4 overflow-auto max-h-48">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          )}

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
