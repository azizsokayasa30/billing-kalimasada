import { FileQuestion } from 'lucide-react';

export default function RequestLayanan() {
  return (
    <div className="max-w-xl space-y-5">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Request layanan</h2>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 flex gap-4 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center border border-sky-200 shrink-0">
          <FileQuestion className="w-7 h-7 text-sky-600" />
        </div>
        <p className="text-slate-700 text-sm leading-relaxed">
          Permintaan upgrade paket, isolir sementara, reset PPPoE, dan lainnya dengan persetujuan admin
          akan dihubungkan ke billing. Untuk sementara hubungi admin via WhatsApp atau kantor.
        </p>
      </div>
    </div>
  );
}
