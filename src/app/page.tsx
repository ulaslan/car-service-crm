"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image"; // LOGO İÇİN GEREKLİ
import Link from "next/link";   // SAYFA GEÇİŞİ İÇİN GEREKLİ

export default function Home() {
  // --- SEKME YÖNETİMİ ---
  const [activeTab, setActiveTab] = useState<"TRANSACTIONS" | "DIRECTORY">("TRANSACTIONS");

  // --- İŞLEM EKRANI STATE'LERİ ---
  const [viewState, setViewState] = useState<"SEARCH" | "FOUND" | "NEW_FORM">("SEARCH");
  const [loading, setLoading] = useState(false);
  const [plate, setPlate] = useState("");
  const [customer, setCustomer] = useState<any>(null);
  const [newCustomer, setNewCustomer] = useState({ fullName: "", phone: "", model: "" });
  const [activeJobs, setActiveJobs] = useState<any[]>([]);

  // --- REHBER STATE'LERİ ---
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // --- GEÇMİŞ DÖKÜMÜ (MODAL) STATE'LERİ ---
  const [historyCustomer, setHistoryCustomer] = useState<any>(null);
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 1. VERİ ÇEKME
  const fetchActiveJobs = async () => {
    const { data, error } = await supabase
      .from("jobs")
      .select("*, customers(plate_number, full_name, car_model)")
      .in("status", ["waiting", "in_progress"])
      .order("created_at", { ascending: true });
    
    if (!error && data) setActiveJobs(data);
  };

  const fetchAllCustomers = async () => {
    let query = supabase.from("customers").select("*").order("full_name", { ascending: true });
    
    if (searchQuery) {
      query = query.or(`full_name.ilike.%${searchQuery}%,plate_number.ilike.%${searchQuery}%`);
    }

    const { data } = await query.limit(50); 
    if (data) setAllCustomers(data);
  };

  // Müşteri Geçmişini Getir
  const openHistory = async (customer: any) => {
    setHistoryCustomer(customer);
    setHistoryLoading(true);
    
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });
      
    if (data) setHistoryJobs(data);
    setHistoryLoading(false);
  };

  const closeHistory = () => {
    setHistoryCustomer(null);
    setHistoryJobs([]);
  };

  useEffect(() => {
    fetchActiveJobs();
    if (activeTab === "DIRECTORY") fetchAllCustomers();
    
    const interval = setInterval(() => {
      fetchActiveJobs();
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab, searchQuery]);

  // 2. AKSİYONLAR
  const deleteJob = async (jobId: string) => {
    if (!confirm("Bu kaydı TAMAMEN SİLMEK istediğinize emin misiniz? Veritabanından kaldırılacak.")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", jobId);
    if (error) alert("Hata: " + error.message);
    else fetchActiveJobs();
  };

  const completeJob = async (jobId: string, plateNumber: string) => {
    if (!confirm(`${plateNumber} plakalı aracın işlemini BİTİRMEK istiyor musunuz?`)) return;
    const { error } = await supabase.from("jobs").update({ status: 'completed' }).eq("id", jobId);
    if (error) alert("Hata: " + error.message);
    else fetchActiveJobs();
  };

  const deleteCustomer = async (customerId: string, customerName: string) => {
    if (!confirm(`${customerName} isimli müşteriyi ve TÜM GEÇMİŞ KAYITLARINI silmek istediğinize emin misiniz?`)) return;
    await supabase.from("jobs").delete().eq("customer_id", customerId);
    await supabase.from("customers").delete().eq("id", customerId);
    fetchAllCustomers();
    if (customer && customer.id === customerId) { setCustomer(null); setViewState("SEARCH"); setPlate(""); }
  };

  // 3. FORMATLAMA
  const formatPlate = (value: string) => {
    let clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    
    if (clean.length <= 2) return clean;

    const city = clean.slice(0, 2);
    let rest = clean.slice(2);

    const firstDigitIndex = rest.search(/\d/);

    if (firstDigitIndex === -1) {
      if (rest.length > 3) rest = rest.slice(0, 3);
      return `${city} ${rest}`;
    } else {
      let letters = rest.slice(0, firstDigitIndex);
      let digits = rest.slice(firstDigitIndex);

      if (letters.length > 3) letters = letters.slice(0, 3);
      if (digits.length > 4) digits = digits.slice(0, 4); // Rakam sınırı 4

      return `${city} ${letters} ${digits}`.trim();
    }
  };

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => { setPlate(formatPlate(e.target.value)); };
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.startsWith("0")) val = val.slice(1);
    if (val.length > 10) val = val.slice(0, 10);
    setNewCustomer({ ...newCustomer, phone: val });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // 4. DB İŞLEMLERİ
  const checkPlate = async () => {
    // Eksik plaka kontrolü (Şehir + Harf + Sayı olmalı)
    if (plate.trim().split(" ").length < 3) return;
    
    setLoading(true);
    const { data } = await supabase.from("customers").select("*").eq("plate_number", plate).single();
    setLoading(false);
    if (data) { setCustomer(data); setViewState("FOUND"); }
    else { setCustomer(null); setViewState("NEW_FORM"); }
  };

  const handleSaveCustomer = async () => {
    if (newCustomer.phone.length < 10) { alert("Telefon eksik."); return; }
    setLoading(true);
    const { data, error } = await supabase.from("customers").insert([{
        plate_number: plate, full_name: newCustomer.fullName, phone_number: newCustomer.phone, car_model: newCustomer.model,
      }]).select().single();
    
    if (!error) { 
      setCustomer(data); 
      setViewState("FOUND"); 
      setNewCustomer({ fullName: "", phone: "", model: "" });
    }
    setLoading(false);
  };

  // --- GÜNCELLENEN FONKSİYON: createJob ---
  // isQuickRecord: true ise direkt 'completed' yapar (Kuyruğa girmez, mesaj gitmez)
  // isQuickRecord: false ise 'waiting' yapar (Kuyruğa girer, mesaj gider)
  const createJob = async (type: "wash" | "repair", isQuickRecord: boolean = false) => {
    if (!customer) return;
    
    setLoading(true);
    
    // Eğer Hızlı Kayıt ise durum 'completed', değilse 'waiting'
    const status = isQuickRecord ? "completed" : "waiting";

    const { error } = await supabase.from("jobs").insert([{
      customer_id: customer.id, 
      service_type: type, 
      status: status,
    }]);

    if (!error) { 
      // İşlem başarılıysa ana ekrana dön ve plakayı temizle
      setPlate(""); 
      setViewState("SEARCH"); 
      fetchActiveJobs(); 

      // Kullanıcıya ufak bir geri bildirim (Opsiyonel ama hoş olur)
      if (isQuickRecord) {
        alert("Kayıt başarıyla eklendi (Mesaj gönderilmedi).");
      }
    }
    setLoading(false);
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start bg-slate-900 text-white p-4 pt-8">
      
      {/* LOGO BÖLÜMÜ */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10">
        <Image 
          src="/logo.png" 
          alt="Oto Birlik Logo"
          width={150} 
          height={80}
          quality={100} 
          unoptimized 
          priority
          className="h-auto w-auto max-w-[100px] sm:max-w-[150px]"
        />
      </div>

      {/* YIKAMA PANELİNE GİT */}
      <div className="absolute top-6 right-6 z-10">
        <Link 
            href="/yikama" 
            target="_blank" 
            className="flex items-center gap-2 bg-cyan-600/20 hover:bg-cyan-600 border border-cyan-500/50 text-cyan-400 hover:text-white px-4 py-2 rounded-xl transition-all font-bold shadow-lg backdrop-blur-sm"
        >
            <span className="text-xl">🚿</span>
            <span className="hidden sm:inline">YIKAMA PANELİ</span>
        </Link>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-blue-400 tracking-tight text-center mt-16 sm:mt-0">BİRLİK OTO KAYIT</h1>
      
      <div className="flex bg-slate-800 p-1 rounded-2xl mb-8 border border-slate-700">
        <button onClick={() => setActiveTab("TRANSACTIONS")} className={`px-6 sm:px-8 py-3 rounded-xl font-bold transition-all text-sm sm:text-base ${activeTab === "TRANSACTIONS" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>⚡ İŞLEMLER</button>
        <button onClick={() => setActiveTab("DIRECTORY")} className={`px-6 sm:px-8 py-3 rounded-xl font-bold transition-all text-sm sm:text-base ${activeTab === "DIRECTORY" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>📖 REHBER</button>
      </div>

      {activeTab === "TRANSACTIONS" && (
        <>
          <div className="w-full max-w-md bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-700 mb-10">
            {viewState === "SEARCH" && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                <label className="text-slate-400 text-sm font-medium">Araç Plakası</label>
                <input 
                  type="text" 
                  value={plate} 
                  onChange={handlePlateChange} 
                  placeholder="34 ABC 123" 
                  className="text-4xl text-center p-4 rounded-2xl bg-slate-900 border-2 border-slate-700 focus:border-blue-500 outline-none uppercase tracking-widest" 
                  onKeyDown={(e) => e.key === "Enter" && checkPlate()} 
                />
                <button onClick={checkPlate} disabled={loading} className="bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold text-xl">{loading ? "Sorgulanıyor..." : "SORGULA"}</button>
              </div>
            )}
            {viewState === "FOUND" && customer && (
              <div className="flex flex-col gap-6 text-center animate-in zoom-in-95">
                <div className="border-b border-slate-700 pb-4">
                  <h2 className="text-4xl font-black">{customer.plate_number}</h2>
                  <p className="text-xl text-green-400 font-bold mt-1">{customer.full_name}</p>
                  <p className="text-slate-400 text-sm uppercase">{customer.car_model}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* --- GÜNCELLENEN KISIM: YIKAMA BUTONLARI --- */}
                  <div className="flex flex-col gap-2">
                    {/* 1. Kuyruğa Al (Mesaj Gider) */}
                    <button 
                      onClick={() => createJob("wash", false)} 
                      className="bg-cyan-600 hover:bg-cyan-500 p-4 rounded-xl font-bold flex flex-col items-center justify-center gap-1 h-full"
                    >
                      <span className="text-2xl">🚿</span> 
                      <span>YIKAMA</span>
                      <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded text-cyan-100 font-normal">Kuyruğa Al</span>
                    </button>
                  </div>

                  {/* 2. Servis Butonu (Değişmedi) */}
                  <button onClick={() => createJob("repair", false)} className="bg-orange-600 hover:bg-orange-500 p-4 rounded-xl font-bold flex flex-col items-center justify-center gap-1">
                    <span className="text-2xl">🔧</span> 
                    <span>SERVİS</span>
                    <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded text-orange-100 font-normal">Kuyruğa Al</span>
                  </button>
                </div>

                {/* --- YENİ EKLENEN KISIM: HIZLI KAYIT BUTONU --- */}
                <button 
                  onClick={() => createJob("wash", true)} 
                  className="mt-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 hover:text-white p-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <span>⚡🚿 HIZLI YIKAMA (Mesaj Gönderme)</span>
                </button>

                <button onClick={() => {setViewState("SEARCH"); setPlate("");}} className="text-slate-500 hover:text-white text-sm mt-2">← Vazgeç</button>
              </div>
            )}
            {viewState === "NEW_FORM" && (
              <div className="flex flex-col gap-4 animate-in fade-in">
                <h2 className="text-2xl font-bold text-center">Yeni Müşteri</h2>
                <div className="bg-slate-900 p-4 rounded-xl text-center text-2xl font-mono text-yellow-400 border border-yellow-900/30">{plate}</div>
                <input type="text" value={newCustomer.fullName} placeholder="Ad Soyad" className="bg-slate-700 p-4 rounded-xl focus:ring-2 ring-blue-500 outline-none" onChange={(e) => setNewCustomer({ ...newCustomer, fullName: e.target.value })} />
                <div className="relative"><span className="absolute left-4 top-4 text-slate-400 font-bold select-none">+90</span><input type="tel" value={newCustomer.phone} placeholder="5XX XXX XX XX" className="bg-slate-700 p-4 pl-14 rounded-xl focus:ring-2 ring-blue-500 outline-none w-full font-mono text-lg" onChange={handlePhoneChange} /></div>
                <input type="text" value={newCustomer.model} placeholder="Araç Modeli" className="bg-slate-700 p-4 rounded-xl focus:ring-2 ring-blue-500 outline-none" onChange={(e) => setNewCustomer({ ...newCustomer, model: e.target.value })} />
                <button onClick={handleSaveCustomer} disabled={loading} className="bg-green-600 hover:bg-green-500 py-4 rounded-xl font-bold text-lg mt-2">{loading ? "Kaydediliyor..." : "KAYDET VE DEVAM ET"}</button>
                <button onClick={() => {setViewState("SEARCH"); setNewCustomer({ fullName: "", phone: "", model: "" });}} className="text-slate-500 text-sm">İptal</button>
              </div>
            )}
          </div>

          <div className="w-full max-w-md animate-in fade-in delay-200">
            <div className="flex justify-between items-center mb-4 px-2">
              <h3 className="text-sm font-bold text-slate-400 tracking-widest uppercase">GÜNCEL KUYRUK</h3>
              <span className="bg-blue-500/10 text-blue-400 text-xs font-black px-2 py-1 rounded-lg border border-blue-500/20">{activeJobs.length}</span>
            </div>
            <div className="space-y-3">
              {activeJobs.length === 0 ? <div className="text-center p-8 bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-700 text-slate-500">Kuyruk boş.</div> : 
                activeJobs.map((job) => (
                  <div key={job.id} className="bg-slate-800 p-3 rounded-2xl border border-slate-700 flex justify-between items-center hover:border-slate-600 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-full text-2xl shadow-inner ${job.service_type === 'wash' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>{job.service_type === 'wash' ? '🚿' : '🔧'}</div>
                      <div>
                        <span className="font-mono font-bold text-lg block leading-none mb-1">{job.customers?.plate_number}</span>
                        <div className="text-xs text-slate-400 uppercase font-medium flex items-center gap-2">{job.customers?.full_name} <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'in_progress' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span></div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => completeJob(job.id, job.customers?.plate_number)} className="bg-green-600/20 hover:bg-green-500 text-green-500 hover:text-white p-2 rounded-xl transition-all">✓</button>
                      <button onClick={() => deleteJob(job.id)} className="bg-red-600/10 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-xl transition-all">✕</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {activeTab === "DIRECTORY" && (
        <div className="w-full max-w-3xl animate-in fade-in">
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
            <div className="relative mb-6">
              <input type="text" placeholder="İsim veya Plaka ile Ara..." className="w-full bg-slate-900 p-4 rounded-2xl pl-12 border border-slate-700 focus:border-blue-500 outline-none text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <span className="absolute left-4 top-4 text-slate-500 text-xl">🔍</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/50">
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-slate-800">
                  {allCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800 transition-colors group">
                      <td 
                        onClick={() => openHistory(c)}
                        className="p-4 font-mono font-bold text-blue-400 cursor-pointer hover:text-blue-300 underline decoration-dashed underline-offset-4"
                        title="Geçmişi Gör"
                      >
                        {c.plate_number}
                      </td>
                      <td className="p-4 font-medium text-white">{c.full_name}</td>
                      <td className="p-4 text-slate-400 hidden sm:table-cell font-mono tracking-tighter">{c.phone_number ? `+90 ${c.phone_number}` : '-'}</td>
                      <td className="p-4 text-slate-400 text-sm hidden sm:table-cell">{c.car_model}</td>
                      <td className="p-4 text-center">
                        <button onClick={() => deleteCustomer(c.id, c.full_name)} className="text-slate-600 hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-all">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {allCustomers.length === 0 && <div className="p-10 text-center text-slate-500 italic">Müşteri bulunamadı.</div>}
            </div>
          </div>
        </div>
      )}

      {historyCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-800 w-full max-w-lg rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 bg-slate-900 border-b border-slate-700 flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-black text-white">{historyCustomer.plate_number}</h2>
                <p className="text-blue-400 font-bold text-lg">{historyCustomer.full_name}</p>
                <p className="text-slate-500 text-sm">{historyCustomer.car_model}</p>
              </div>
              <button onClick={closeHistory} className="bg-slate-800 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-700 transition-colors">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-700 border-b border-slate-700">
              <div className="bg-slate-800 p-4 text-center">
                <div className="text-2xl font-black text-cyan-400">{historyJobs.filter(j => j.service_type === 'wash').length}</div>
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Toplam Yıkama</div>
              </div>
              <div className="bg-slate-800 p-4 text-center">
                <div className="text-2xl font-black text-orange-400">{historyJobs.filter(j => j.service_type === 'repair').length}</div>
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Toplam Servis</div>
              </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-3 bg-slate-900/50 flex-1">
              {historyLoading ? (
                <div className="text-center py-10 text-slate-500">Yükleniyor...</div>
              ) : historyJobs.length === 0 ? (
                <div className="text-center py-10 text-slate-500">Henüz işlem geçmişi yok.</div>
              ) : (
                historyJobs.map((job) => (
                  <div key={job.id} className="flex items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700/50">
                    <div className={`text-2xl w-10 h-10 flex items-center justify-center rounded-full bg-slate-700 ${job.service_type === 'wash' ? 'text-cyan-400' : 'text-orange-400'}`}>{job.service_type === 'wash' ? '🚿' : '🔧'}</div>
                    <div className="flex-1">
                      <div className="font-bold text-white uppercase text-sm">{job.service_type === 'wash' ? 'Oto Yıkama' : 'Tamir & Servis'}</div>
                      <div className="text-xs text-slate-500 mt-1">{formatDate(job.created_at)}</div>
                    </div>
                    <div className="text-right">
                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${job.status === 'completed' ? 'border-green-500/30 text-green-500 bg-green-500/10' : job.status === 'in_progress' ? 'border-blue-500/30 text-blue-500 bg-blue-500/10' : 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'}`}>{job.status === 'completed' ? 'Tamamlandı' : job.status === 'in_progress' ? 'İşlemde' : 'Bekliyor'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}