// app/yikama/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function YikamaEkrani() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // İşleri veritabanından çek (Sadece bitmemiş yıkamalar)
  const fetchJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        *,
        customers (plate_number, car_model, full_name)
      `)
      .eq("service_type", "wash")
      .neq("status", "completed") // Bitmişleri gösterme
      .order("created_at", { ascending: true }); // Eskiden yeniye sırala

    if (error) console.error("Hata:", error);
    else setJobs(data || []);
    setLoading(false);
  };

  // Sayfa açıldığında verileri çek
  useEffect(() => {
    fetchJobs();
    
    // Her 10 saniyede bir listeyi otomatik yenile (Polling)
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  // Durum Güncelleme (Başlat/Bitir)
  const updateStatus = async (jobId: string, newStatus: string) => {
    // Önce arayüzde hızlıca güncelleyelim (Optimistic Update)
    setJobs(jobs.map(job => job.id === jobId ? { ...job, status: newStatus } : job));

    const { error } = await supabase
      .from("jobs")
      .update({ status: newStatus })
      .eq("id", jobId);

    if (error) alert("Durum güncellenemedi!");
    
    // Veritabanından son hali tekrar çek
    fetchJobs(); 
    
    // BURAYA İLERİDE WHATSAPP TETİKLEYİCİSİ GELECEK
    if(newStatus === 'in_progress') {
        console.log("WhatsApp: Yıkama Başladı mesajı gönderilecek...");
    } else if (newStatus === 'completed') {
        console.log("WhatsApp: Aracınız Hazır mesajı gönderilecek...");
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-4">
      <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-blue-400">Yıkama Kuyruğu</h1>
        <button onClick={fetchJobs} className="bg-gray-800 p-2 rounded-full text-sm">
          🔄 Yenile
        </button>
      </div>

      {loading && <p className="text-center text-gray-500">Yükleniyor...</p>}

      <div className="flex flex-col gap-4">
        {jobs.length === 0 && !loading && (
          <div className="text-center py-10 text-gray-500">
            Sırada araç yok. Çay molası! ☕
          </div>
        )}

        {jobs.map((job) => (
          <div 
            key={job.id} 
            className={`p-4 rounded-xl border-l-8 shadow-lg ${
              job.status === 'in_progress' 
                ? 'bg-slate-800 border-green-500' 
                : 'bg-slate-900 border-yellow-500'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-3xl font-black text-white tracking-wider">
                  {job.customers?.plate_number}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {job.customers?.car_model} - {job.customers?.full_name}
                </p>
              </div>
              <span className={`px-3 py-1 rounded text-xs font-bold ${
                job.status === 'in_progress' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
              }`}>
                {job.status === 'in_progress' ? 'YIKANIYOR' : 'BEKLİYOR'}
              </span>
            </div>

            <div className="mt-4">
              {job.status === 'waiting' && (
                <button
                  onClick={() => updateStatus(job.id, 'in_progress')}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg text-xl"
                >
                  YIKAMAYA BAŞLA ▶
                </button>
              )}

              {job.status === 'in_progress' && (
                <button
                  onClick={() => updateStatus(job.id, 'completed')}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-lg text-xl"
                >
                  BİTTİ (TESLİM ET) ✅
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}