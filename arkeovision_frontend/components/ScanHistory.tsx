import React, { useEffect, useState } from 'react';
import { ScannedItem } from '../types';
import { getScanHistory, deleteScan } from '../services/geminiService';
import { Viewer3D } from './Viewer3D';

interface Props {
  onClose: () => void;
  onSelect: (item: ScannedItem) => void;
}

export const ScanHistory: React.FC<Props> = ({ onClose, onSelect }) => {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<ScannedItem | null>(null);
  const [detailViewMode, setDetailViewMode] = useState<'restored' | '3d'>('restored');

  useEffect(() => {
    getScanHistory()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteScan(id);
      setItems(prev => prev.filter(i => i.id !== id));
      if (selected?.id === id) setSelected(null);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-arch-dark animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-900/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded border-2 border-arch-gold/60 flex items-center justify-center bg-arch-stone">
            <span className="text-arch-gold font-serif font-bold text-xl">A</span>
          </div>
          <div>
            <h2 className="font-serif text-lg text-white tracking-wide">Tarama Geçmişi</h2>
            <p className="text-xs text-stone-500">{items.length} eser kaydedildi</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-stone-400 flex items-center justify-center text-stone-400 hover:text-white transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Sol panel - liste */}
        <div className="w-full md:w-80 lg:w-96 shrink-0 overflow-y-auto border-r border-stone-800 bg-stone-900/40">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin w-8 h-8 border-2 border-arch-gold border-t-transparent rounded-full"></div>
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center px-6 gap-3">
              <svg className="w-12 h-12 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-stone-500 text-sm">Henüz tarama yapılmadı</p>
              <p className="text-stone-600 text-xs">Bir eser taradığınızda burada görünecek</p>
            </div>
          )}

          {!loading && items.map(item => (
            <button
              key={item.id}
              onClick={() => { setSelected(item); setDetailViewMode(item.design3dImage ? '3d' : 'restored'); }}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-stone-800 transition-all hover:bg-stone-800/60 ${selected?.id === item.id ? 'bg-stone-800 border-l-2 border-l-arch-gold' : ''}`}
            >
              {/* Thumbnail */}
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-stone-700 bg-stone-800 relative">
                {(item.design3dImage || item.restoredImage || item.capturedImage) ? (
                  <img
                    src={item.design3dImage || item.restoredImage || item.capturedImage}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-stone-200 text-sm font-medium truncate">{item.name}</p>
                  <button
                    onClick={e => handleDelete(e, item.id)}
                    disabled={deletingId === item.id}
                    className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-stone-600 hover:text-red-400 hover:bg-red-900/20 transition-all"
                  >
                    {deletingId === item.id
                      ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin"></div>
                      : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    }
                  </button>
                </div>
                <p className="text-arch-gold/70 text-[11px] mt-0.5">{item.era}</p>
                <p className="text-stone-500 text-[10px] mt-1">{formatDate(item.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Sağ panel - detay */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <svg className="w-16 h-16 text-stone-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-stone-600 text-sm">Detaylarını görmek için<br/>soldan bir eser seçin</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row h-full">
              {/* Görsel */}
              <div className="w-full md:w-1/2 bg-black flex flex-col">
                {/* Sekme seçici */}
                <div className="flex shrink-0 bg-stone-900/80 border-b border-stone-800 px-3 pt-3 gap-1">
                  <button
                    onClick={() => setDetailViewMode('restored')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-bold tracking-wide transition-all border-b-2 ${detailViewMode === 'restored'
                      ? 'text-arch-gold border-arch-gold bg-stone-800/60'
                      : 'text-stone-500 border-transparent hover:text-stone-300'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    RESTORASYON
                  </button>
                  <button
                    onClick={() => setDetailViewMode('3d')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-bold tracking-wide transition-all border-b-2 ${detailViewMode === '3d'
                      ? 'text-cyan-400 border-cyan-400 bg-stone-800/60'
                      : 'text-stone-500 border-transparent hover:text-stone-300'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                    </svg>
                    3D TASARIM
                  </button>
                </div>

                {/* Görsel içerik */}
                <div className="flex-1 relative flex items-center justify-center p-4 min-h-56 group">
                  {detailViewMode === 'restored' && (
                    selected.restoredImage ? (
                      <>
                        <img src={selected.restoredImage} alt="Restorasyon" className="max-h-[55vh] max-w-full object-contain rounded-lg border border-arch-gold/20 shadow-2xl" />
                        <div className="absolute top-6 left-6 bg-black/60 backdrop-blur text-arch-gold px-3 py-1 text-xs rounded border border-arch-gold/20 font-bold tracking-wider">RESTORASYON (AI)</div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black p-4 rounded">
                          <img src={selected.capturedImage} alt="Orijinal" className="max-h-[55vh] max-w-full object-contain rounded-lg border border-white/20" />
                          <div className="absolute top-6 left-6 bg-black/60 backdrop-blur text-white px-3 py-1 text-xs rounded border border-white/20 font-bold tracking-wider">ORİJİNAL</div>
                        </div>
                        <div className="absolute bottom-4 inset-x-0 text-center hidden md:block pointer-events-none">
                          <span className="bg-black/40 text-white/60 text-[10px] px-2 py-1 rounded-full backdrop-blur border border-white/10">Karşılaştırmak için üzerine gelin</span>
                        </div>
                      </>
                    ) : (
                      <img src={selected.capturedImage} alt="Orijinal" className="max-h-[55vh] max-w-full object-contain rounded-lg border border-stone-700" />
                    )
                  )}
                  {detailViewMode === '3d' && (
                    selected.design3dImage ? (
                      <div className="relative w-full h-full min-h-56 rounded-lg overflow-hidden border border-cyan-500/20">
                        <Viewer3D imageUrl={selected.design3dImage} className="w-full h-full" />
                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur text-cyan-400 px-3 py-1 text-xs rounded border border-cyan-500/30 font-bold tracking-wider pointer-events-none">3D TASARIM</div>
                        <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
                          <span className="bg-black/50 text-white/60 text-[10px] px-3 py-1 rounded-full backdrop-blur border border-white/10">
                            Sol tık → döndür · Scroll → yakınlaştır · Sağ tık → kaydır
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <svg className="w-10 h-10 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                        </svg>
                        <p className="text-stone-500 text-xs">3D görsel bu kayıt için mevcut değil</p>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Bilgiler */}
              <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                <div>
                  <div className="inline-block px-3 py-1 rounded-sm bg-arch-gold/10 text-arch-gold border-l-2 border-arch-gold text-xs font-bold tracking-wider mb-2">
                    {selected.era.toUpperCase()}
                  </div>
                  <h3 className="text-2xl font-serif text-white leading-tight">{selected.name}</h3>
                  <p className="text-stone-500 text-xs mt-1">{formatDate(selected.createdAt)}</p>
                </div>

                <div className="border border-stone-700 bg-stone-800/50 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-stone-800 border-b border-stone-700">
                    <span className="text-arch-gold font-bold text-xs uppercase tracking-wide">Analiz & Tanım</span>
                  </div>
                  <p className="p-4 text-stone-300 text-sm leading-relaxed">{selected.description}</p>
                </div>

                {selected.usage && (
                  <div className="border border-stone-700 bg-stone-800/50 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-stone-800 border-b border-stone-700">
                      <span className="text-arch-gold font-bold text-xs uppercase tracking-wide">Tarihsel Kullanım</span>
                    </div>
                    <p className="p-4 text-stone-300 text-sm leading-relaxed">{selected.usage}</p>
                  </div>
                )}

                {selected.conservationAdvice && (
                  <div className="border border-stone-700 bg-stone-800/50 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-stone-800 border-b border-stone-700">
                      <span className="text-arch-gold font-bold text-xs uppercase tracking-wide">Onarım & Koruma</span>
                    </div>
                    <p className="p-4 text-stone-300 text-sm leading-relaxed">{selected.conservationAdvice}</p>
                  </div>
                )}

                <div className="mt-auto pt-4 flex flex-col gap-2">
                  <button
                    onClick={() => onSelect(selected)}
                    className="w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-purple-900 to-indigo-900 text-white hover:brightness-110 shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {selected.vrSceneInfo?.name ? `VR: ${selected.vrSceneInfo.name}` : 'VR DENEYİMİ'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
