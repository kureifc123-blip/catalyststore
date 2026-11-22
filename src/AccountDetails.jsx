import { useEffect, useRef, useState } from "react";

export function AccountGallery({ images, title }) {
  const [selected, setSelected] = useState(0);
  const dialog = useRef(null);
  const photos = images || [];
  const index = Math.min(selected, Math.max(0, photos.length - 1));
  useEffect(() => {
    const element = dialog.current;
    const closeOutside = (event) => { if (event.target === element) element.close(); };
    element?.addEventListener("click", closeOutside);
    return () => element?.removeEventListener("click", closeOutside);
  }, []);
  if (!photos.length) return <div className="h-full grid place-items-center text-xs text-slate-500">Belum ada foto</div>;
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label={`Lihat ${photos.length} foto ${title}`} className="w-full h-full text-left focus-visible:outline-2 focus-visible:outline-cyan-400">
        <img src={photos[0]} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
        <span className="absolute bottom-3 left-3 rounded-lg border border-slate-600 bg-slate-950/90 px-2.5 py-1 text-[10px] text-cyan-300 font-bold">Lihat {photos.length} foto</span>
      </button>
      <dialog ref={dialog} aria-label={`Galeri ${title}`} className="fixed m-auto w-[calc(100%-2rem)] max-w-4xl max-h-[90dvh] overflow-y-auto bg-slate-900 text-white border border-slate-700 rounded-2xl p-4 backdrop:bg-slate-950/90">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h3 className="font-bold text-sm break-words">{title}</h3>
          <button type="button" onClick={() => dialog.current.close()} className="shrink-0 rounded-lg border border-slate-600 px-3 py-2 text-xs hover:bg-slate-800">Tutup</button>
        </div>
        <img src={photos[index]} alt={`${title}, foto ${index + 1}`} className="w-full h-[50dvh] object-contain rounded-xl bg-slate-950" />
        <div className="flex items-center justify-between my-3 text-xs text-slate-300">
          <button type="button" disabled={photos.length < 2} onClick={() => setSelected((index + photos.length - 1) % photos.length)} className="px-3 py-2 border border-slate-700 rounded-lg disabled:opacity-40">Sebelumnya</button>
          <span aria-live="polite">{index + 1} / {photos.length}</span>
          <button type="button" disabled={photos.length < 2} onClick={() => setSelected((index + 1) % photos.length)} className="px-3 py-2 border border-slate-700 rounded-lg disabled:opacity-40">Berikutnya</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button type="button" key={`${url}-${i}`} onClick={() => setSelected(i)} aria-label={`Lihat foto ${i + 1}`} aria-pressed={i === index} className={`shrink-0 rounded-lg overflow-hidden border-2 ${i === index ? "border-cyan-400" : "border-slate-700"}`}>
              <img src={url} alt={`Foto ${i + 1}`} className="w-20 h-16 object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </dialog>
    </>
  );
}

export function AccountDescription({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  return (
    <div className="mt-2">
      <span className="text-[10px] font-bold uppercase text-slate-500">Deskripsi Produk</span>
      <p className={`text-[11px] text-slate-400 whitespace-pre-wrap break-words mt-1 ${expanded ? "" : "line-clamp-2"}`}>{text}</p>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="text-[11px] text-cyan-400 hover:text-cyan-300 mt-1 py-1 font-bold">{expanded ? "Tampilkan sebagian" : "Lihat deskripsi lengkap"}</button>
    </div>
  );
}
