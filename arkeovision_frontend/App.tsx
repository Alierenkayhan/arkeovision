import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ScannerOverlay } from './components/ScannerOverlay';
import { ScanHistory } from './components/ScanHistory';
import { Viewer3D } from './components/Viewer3D';
import {
  analyzeArtifactImage,
  generateRestoredImage,
  generate3DDesign,
  checkBackendHealth,
  checkPiStatus,
  captureFromPi,
  getPiStreamUrl,
  saveScan,
} from './services/geminiService';
import { AppState, ArtifactAnalysis, ScannedItem } from './types';

// ============================================================
// InfoCard
// ============================================================
const InfoCard: React.FC<{ title: string; content: string; defaultOpen?: boolean }> = ({ title, content, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-stone-700 bg-stone-800/50 rounded-lg overflow-hidden transition-all duration-300">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 bg-stone-800 hover:bg-stone-700 transition-colors">
        <span className="text-arch-gold font-bold text-sm uppercase tracking-wide">{title}</span>
        <svg className={`w-5 h-5 text-arch-gold transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="p-4 text-stone-300 leading-relaxed text-sm md:text-base border-t border-stone-700/50">{content}</p>
      </div>
    </div>
  );
};

// ============================================================
// Types
// ============================================================
type CameraSource = 'phone' | 'pi';
interface VRSceneInfo { id: string; name: string; period: string; description: string; }

// ============================================================
// App
// ============================================================
const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [cameraSource, setCameraSource] = useState<CameraSource>('pi');
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ArtifactAnalysis | null>(null);
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  const [design3dImage, setDesign3dImage] = useState<string | null>(null);
  const [imageViewMode, setImageViewMode] = useState<'restored' | '3d'>('restored');
  const [vrSceneInfo, setVrSceneInfo] = useState<VRSceneInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [piStatus, setPiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [showHistory, setShowHistory] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ========== Health Checks ==========
  useEffect(() => {
    const check = async () => {
      const [backend, pi] = await Promise.all([
        checkBackendHealth(),
        checkPiStatus(),
      ]);
      setBackendStatus(backend ? 'online' : 'offline');
      setPiStatus(pi ? 'online' : 'offline');
      // Pi varsa varsayılan Pi, yoksa telefon
      if (!pi) setCameraSource('phone');
    };
    check();
  }, []);

  // ========== Phone Camera ==========
  const startPhoneCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setVideoStream(stream);
      setAppState(AppState.SCANNING);
      setErrorMsg('');
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Kamera erişimine izin vermediniz.');
        setAppState(AppState.PERMISSION_DENIED);
      } else {
        setErrorMsg('Kamera başlatılamadı: ' + err.message);
        setAppState(AppState.ERROR);
      }
    }
  };

  // ========== Start Scanning ==========
  const startScanning = () => {
    if (cameraSource === 'phone') {
      startPhoneCamera();
    } else {
      // Pi — doğrudan scanning moduna geç, MJPEG stream gösterilecek
      setAppState(AppState.SCANNING);
      setErrorMsg('');
    }
  };

  // ========== Bind video stream ==========
  useEffect(() => {
    if (videoRef.current && videoStream && cameraSource === 'phone') {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream, appState, cameraSource]);

  // ========== Capture ==========
  const handleCapture = useCallback(async () => {
    if (appState !== AppState.SCANNING) return;

    if (cameraSource === 'pi') {
      // Pi'dan çek
      try {
        setAppState(AppState.ANALYZING);
        const base64 = await captureFromPi();
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        setCapturedImage(dataUrl);
        processImage(base64);
      } catch (err: any) {
        setErrorMsg('Pi kamerasından görüntü alınamadı: ' + err.message);
        setAppState(AppState.ERROR);
      }
    } else {
      // Telefon kamerasından çek
      let sourceVideo = videoRef.current;
      if (!sourceVideo || !canvasRef.current) {
        const v = document.querySelector('video');
        if (v) sourceVideo = v;
      }
      if (sourceVideo && canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = sourceVideo.videoWidth;
        canvas.height = sourceVideo.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
          const imageData = canvas.toDataURL('image/jpeg', 0.8);
          setCapturedImage(imageData);
          if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            setVideoStream(null);
          }
          setAppState(AppState.ANALYZING);
          processImage(imageData.split(',')[1]);
        }
      }
    }
  }, [videoStream, appState, cameraSource]);

  // ========== Process ==========
  const processImage = async (base64: string) => {
    try {
      const result = await analyzeArtifactImage(base64);
      const data = result.analysis || result;
      setAnalysis(data);
      if (data.vrSceneInfo) setVrSceneInfo(data.vrSceneInfo);
      setAppState(AppState.RESULT);

      const capturedDataUrl = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;

      const visualPrompt = data.visualPrompt;
      if (visualPrompt) {
        // Restorasyon ve 3D render paralel başlat
        let resolvedRestored = '';
        let resolved3d = '';

        const saveWhenReady = () => {
          if (resolvedRestored && resolved3d) {
            saveScan({
              name: data.name,
              era: data.era,
              description: data.description,
              usage: data.usage || '',
              conservationAdvice: data.conservationAdvice || '',
              vrScene: data.vrScene || '',
              vrSceneInfo: data.vrSceneInfo || {},
              capturedImage: capturedDataUrl,
              restoredImage: resolvedRestored,
              design3dImage: resolved3d,
            }).catch(() => { });
          }
        };

        generateRestoredImage(visualPrompt).then(img => {
          if (img) {
            setRestoredImage(img);
            resolvedRestored = img;
            saveWhenReady();
          }
        }).catch(() => { });

        generate3DDesign(visualPrompt).then(img => {
          if (img) {
            setDesign3dImage(img);
            setImageViewMode('3d');
            resolved3d = img;
            saveWhenReady();
          }
        }).catch(() => { });
      } else {
        saveScan({
          name: data.name,
          era: data.era,
          description: data.description,
          usage: data.usage || '',
          conservationAdvice: data.conservationAdvice || '',
          vrScene: data.vrScene || '',
          vrSceneInfo: data.vrSceneInfo || {},
          capturedImage: capturedDataUrl,
          restoredImage: '',
          design3dImage: '',
        }).catch(() => { });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bir hata oluştu.');
      setAppState(AppState.ERROR);
    }
  };

  // ========== Reset ==========
  const handleReset = () => {
    setAppState(AppState.IDLE);
    setCapturedImage(null);
    setAnalysis(null);
    setRestoredImage(null);
    setDesign3dImage(null);
    setImageViewMode('restored');
    setVrSceneInfo(null);
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
  };

  // ========== Geçmişten eser seç ==========
  const handleHistorySelect = (item: ScannedItem) => {
    setCapturedImage(item.capturedImage);
    setRestoredImage(item.restoredImage || null);
    setDesign3dImage(item.design3dImage || null);
    setImageViewMode(item.design3dImage ? '3d' : 'restored');
    setAnalysis({
      name: item.name,
      era: item.era,
      description: item.description,
      usage: item.usage,
      conservationAdvice: item.conservationAdvice || '',
      visualPrompt: '',
      eraPrompt: '',
      vrScene: item.vrScene,
      vrSceneInfo: item.vrSceneInfo,
    });
    setVrSceneInfo(item.vrSceneInfo);
    setShowHistory(false);
    setAppState(AppState.RESULT);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="relative w-full h-full flex flex-col bg-arch-dark">

      {/* ========== HEADER ========== */}
      <header className="absolute top-0 w-full p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-8 h-8 rounded border-2 border-arch-gold flex items-center justify-center bg-arch-stone">
            <span className="text-arch-gold font-serif font-bold text-xl">A</span>
          </div>
          <h1 className="font-serif text-xl tracking-widest text-stone-200">
            ARKEO<span className="text-arch-gold">VISION</span>
          </h1>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Pi Status */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono border ${piStatus === 'online'
              ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400'
              : 'bg-stone-800/50 border-stone-700 text-stone-500'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${piStatus === 'online' ? 'bg-cyan-500' : 'bg-stone-600'}`}></div>
            <span className="hidden sm:inline">Pi</span>
          </div>

          {/* Backend Status */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono border ${backendStatus === 'online'
              ? 'bg-green-900/30 border-green-500/50 text-green-400'
              : 'bg-red-900/30 border-red-500/50 text-red-400'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'online' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
            <span className="hidden sm:inline">API</span>
          </div>
        </div>
      </header>

      {/* ========== GEÇMİŞ PANELİ ========== */}
      {showHistory && (
        <ScanHistory
          onClose={() => setShowHistory(false)}
          onSelect={handleHistorySelect}
        />
      )}

      <main className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">

        {/* ========== IDLE ========== */}
        {appState === AppState.IDLE && (
          <div className="text-center p-6 space-y-6 animate-fade-in max-w-md">

            {/* Logo */}
            <div className="w-28 h-28 mx-auto rounded-full border-4 border-arch-gold/30 flex items-center justify-center relative hover:scale-105 transition-transform duration-500 group cursor-pointer" onClick={startScanning}>
              <div className="absolute inset-0 border-t-4 border-arch-gold rounded-full animate-spin"></div>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-arch-gold group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl font-serif text-white mb-2">Geçmişi Keşfet</h2>
              <p className="text-stone-400 text-sm mb-3">Tarihi eserleri taramak için kamera kaynağını seçin</p>
            </div>

            {/* Camera Source Toggle */}
            <div className="bg-stone-800 rounded-xl p-1 flex gap-1 max-w-xs mx-auto border border-stone-700">
              <button
                onClick={() => setCameraSource('pi')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${cameraSource === 'pi'
                    ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 shadow-lg'
                    : 'text-stone-500 hover:text-stone-300'
                  }`}
              >
                {/* Raspberry Pi icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="6" y="3" width="12" height="16" rx="2" />
                  <circle cx="12" cy="11" r="3" />
                  <line x1="9" y1="21" x2="15" y2="21" />
                  <line x1="12" y1="19" x2="12" y2="21" />
                </svg>
                <span>Pi Kamera</span>
                {piStatus === 'online' && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>}
              </button>
              <button
                onClick={() => setCameraSource('phone')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${cameraSource === 'phone'
                    ? 'bg-arch-gold/20 text-arch-gold border border-arch-gold/40 shadow-lg'
                    : 'text-stone-500 hover:text-stone-300'
                  }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <rect x="7" y="2" width="10" height="20" rx="2" />
                  <circle cx="12" cy="18" r="1" />
                </svg>
                <span>Telefon</span>
              </button>
            </div>

            {/* Status warnings */}
            {cameraSource === 'pi' && piStatus === 'offline' && (
              <p className="text-red-400/80 text-xs">
                ⚠️ Pi kamerası bağlantısı yok — Pi'ın çalıştığından ve aynı ağda olduğundan emin olun
              </p>
            )}
            {backendStatus === 'offline' && (
              <p className="text-red-400/70 text-xs">⚠️ Backend bağlantısı yok</p>
            )}

            {/* Start Button */}
            <button
              onClick={startScanning}
              disabled={cameraSource === 'pi' && piStatus === 'offline'}
              className={`px-8 py-4 font-bold rounded-full tracking-wider transition-all transform hover:scale-105 flex items-center justify-center gap-2 mx-auto ${cameraSource === 'pi' && piStatus === 'offline'
                  ? 'bg-stone-700 text-stone-500 cursor-not-allowed'
                  : 'bg-arch-gold hover:bg-yellow-600 text-black shadow-[0_0_20px_rgba(212,175,55,0.4)]'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              {cameraSource === 'pi' ? 'Pİ KAMERA İLE TARA' : 'TELEFON İLE TARA'}
            </button>

            {/* Geçmiş Butonu */}
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center justify-center gap-2 text-stone-400 hover:text-arch-gold transition-colors text-sm mx-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tarama Geçmişi
            </button>
          </div>
        )}

        {/* ========== PERMISSION DENIED ========== */}
        {appState === AppState.PERMISSION_DENIED && (
          <div className="text-center p-8 max-w-sm bg-stone-900 border border-red-900/50 rounded-xl shadow-2xl">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Kamera İzni Gerekli</h3>
            <p className="text-stone-400 text-sm mb-6">Kameranıza erişmemiz gerekiyor.</p>
            <button onClick={startScanning} className="w-full px-4 py-3 bg-stone-700 hover:bg-stone-600 border border-stone-500 rounded text-stone-200 transition-colors">Tekrar İzin İste</button>
          </div>
        )}

        {/* ========== ERROR ========== */}
        {appState === AppState.ERROR && (
          <div className="text-center p-8 max-w-sm">
            <div className="relative w-24 h-24 mx-auto mb-6 opacity-80">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-full h-full text-stone-600">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-arch-gold rounded-full flex items-center justify-center shadow-lg">
                <span className="text-black font-bold text-xl">!</span>
              </div>
            </div>
            <h3 className="text-lg font-serif text-red-400 mb-2">Hata</h3>
            <p className="text-stone-400 mb-6 text-sm">{errorMsg}</p>
            <button onClick={handleReset} className="px-6 py-2 border border-arch-gold text-arch-gold hover:bg-arch-gold hover:text-black rounded transition-colors uppercase tracking-widest text-sm font-bold">
              Yeniden Başlat
            </button>
          </div>
        )}

        {/* ========== SCANNING ========== */}
        {appState === AppState.SCANNING && (
          <div className="relative w-full h-full bg-black">

            {/* Pi Camera: MJPEG Stream */}
            {cameraSource === 'pi' && (
              <img
                src={getPiStreamUrl()}
                alt="Pi Camera Stream"
                className="absolute inset-0 w-full h-full object-contain bg-black"
                onError={() => {
                  setErrorMsg('Pi kamera stream bağlantısı kesildi');
                  setAppState(AppState.ERROR);
                }}
              />
            )}

            {/* Phone Camera: Video Element */}
            {cameraSource === 'phone' && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            <canvas ref={canvasRef} className="hidden" />
            <ScannerOverlay isActive={true} />

            {/* Camera source badge */}
            <div className="absolute top-20 left-4 z-30">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border backdrop-blur-sm ${cameraSource === 'pi'
                  ? 'bg-cyan-900/40 border-cyan-500/40 text-cyan-300'
                  : 'bg-arch-gold/20 border-arch-gold/40 text-arch-gold'
                }`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${cameraSource === 'pi' ? 'bg-cyan-400' : 'bg-arch-gold'}`}></div>
                {cameraSource === 'pi' ? 'Raspberry Pi Kamera' : 'Telefon Kamera'}
              </div>
            </div>

            {/* Capture Button */}
            <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center justify-center z-30 gap-4">
              <div className="text-white/70 text-xs bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10 animate-fade-in">
                Fotoğraf çekmek için butona basın
              </div>
              <button
                onClick={handleCapture}
                className="w-20 h-20 rounded-full border-4 border-white/50 bg-white/20 backdrop-blur-sm flex items-center justify-center group relative"
              >
                <div className="absolute inset-0 rounded-full border border-arch-gold opacity-50 animate-ping"></div>
                <div className="w-16 h-16 bg-arch-gold rounded-full group-hover:scale-90 transition-transform shadow-[0_0_20px_#d4af37]"></div>
              </button>

              {/* Back to source select */}
              <button
                onClick={handleReset}
                className="text-white/50 text-xs hover:text-white transition-colors"
              >
                ← Geri
              </button>
            </div>
          </div>
        )}

        {/* ========== ANALYZING ========== */}
        {appState === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center space-y-6">
            {capturedImage && (
              <div className="relative w-64 h-64 rounded-lg overflow-hidden border-2 border-arch-gold shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-arch-gold animate-scan-line shadow-[0_0_15px_#d4af37]"></div>
                <div className="absolute bottom-2 left-2 right-2 space-y-1">
                  <div className="h-1 bg-stone-700 rounded overflow-hidden">
                    <div className="h-full bg-arch-gold w-2/3 animate-pulse"></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-arch-gold font-mono">
                    <span>AI PROCESSING</span>
                    <span className="animate-pulse">...</span>
                  </div>
                </div>
              </div>
            )}
            {!capturedImage && (
              <div className="w-64 h-64 flex items-center justify-center bg-stone-800 rounded-lg border border-stone-700">
                <div className="animate-spin h-10 w-10 border-2 border-arch-gold border-t-transparent rounded-full"></div>
              </div>
            )}
            <div className="text-center">
              <div className="text-arch-gold font-serif text-2xl animate-pulse mb-1">Yapay Zeka Analizi</div>
              <p className="text-stone-500 text-sm font-mono">CHATGPT VISION</p>
            </div>
          </div>
        )}

        {/* ========== RESULT ========== */}
        {appState === AppState.RESULT && analysis && (
          <div className="w-full h-full flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-stone-900">
            {/* Left: Image */}
            <div className="w-full md:w-1/2 h-auto md:h-full relative bg-black flex flex-col border-b md:border-b-0 md:border-r border-stone-800">

              {/* Sekme seçici */}
              <div className="flex shrink-0 bg-stone-900/80 border-b border-stone-800 px-3 pt-16 gap-1">
                <button
                  onClick={() => setImageViewMode('restored')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-bold tracking-wide transition-all border-b-2 ${imageViewMode === 'restored'
                    ? 'text-arch-gold border-arch-gold bg-stone-800/60'
                    : 'text-stone-500 border-transparent hover:text-stone-300'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  RESTORASYON
                  {!restoredImage && <div className="w-1.5 h-1.5 rounded-full bg-arch-gold/50 animate-pulse"></div>}
                </button>
                <button
                  onClick={() => setImageViewMode('3d')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-bold tracking-wide transition-all border-b-2 ${imageViewMode === '3d'
                    ? 'text-cyan-400 border-cyan-400 bg-stone-800/60'
                    : 'text-stone-500 border-transparent hover:text-stone-300'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                  </svg>
                  3D TASARIM
                  {!design3dImage && <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 animate-pulse"></div>}
                </button>
              </div>

              {/* Görsel alanı — RESTORASYON */}
              {imageViewMode === 'restored' && (
                <div className="flex-1 relative flex items-center justify-center p-4 min-h-64 group">
                  {restoredImage ? (
                    <>
                      <img src={restoredImage} alt="Restored" className="max-h-[65vh] max-w-full object-contain rounded-lg border border-arch-gold/20 shadow-2xl" />
                      <div className="absolute top-6 left-6 bg-black/60 backdrop-blur text-arch-gold px-3 py-1 text-xs rounded border border-arch-gold/20 font-bold tracking-wider z-20">RESTORASYON (AI)</div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black p-4">
                        <img src={capturedImage!} alt="Original" className="max-h-[65vh] max-w-full object-contain rounded-lg border border-white/20" />
                        <div className="absolute top-6 left-6 bg-black/60 backdrop-blur text-white px-3 py-1 text-xs rounded border border-white/20 font-bold tracking-wider">ORİJİNAL</div>
                      </div>
                      <div className="absolute bottom-4 inset-x-0 text-center pointer-events-none hidden md:block z-20">
                        <span className="bg-black/40 text-white/60 text-[10px] px-2 py-1 rounded-full backdrop-blur border border-white/10">Karşılaştırmak için üzerine gelin</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full min-h-48 flex flex-col items-center justify-center bg-stone-800/60 rounded-lg border border-stone-700">
                      <div className="animate-spin h-8 w-8 border-2 border-arch-gold border-t-transparent rounded-full mb-2"></div>
                      <span className="text-xs text-stone-400">Restorasyon çiziliyor...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Görsel alanı — 3D TASARIM */}
              {imageViewMode === '3d' && (
                <div className="flex-1 relative p-4 min-h-64">
                  {design3dImage ? (
                    <div className="relative w-full h-full min-h-64 rounded-lg overflow-hidden border border-cyan-500/20">
                      <Viewer3D imageUrl={design3dImage} className="w-full h-full" />
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur text-cyan-400 px-3 py-1 text-xs rounded border border-cyan-500/30 font-bold tracking-wider z-20 pointer-events-none">3D TASARIM</div>
                      <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none z-20">
                        <span className="bg-black/50 text-white/60 text-[10px] px-3 py-1 rounded-full backdrop-blur border border-white/10">
                          Sol tık → döndür · Scroll → yakınlaştır · Sağ tık → kaydır
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full min-h-48 flex flex-col items-center justify-center bg-stone-800/60 rounded-lg border border-stone-700">
                      <div className="animate-spin h-8 w-8 border-2 border-cyan-400 border-t-transparent rounded-full mb-2"></div>
                      <span className="text-xs text-stone-400">3D tasarım oluşturuluyor...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Info */}
            <div className="w-full md:w-1/2 p-4 md:p-8 flex flex-col overflow-y-auto bg-gradient-to-b from-stone-900 to-arch-dark relative">
              {/* Close button */}
              <button onClick={handleReset} className="absolute top-3 right-3 z-40 w-10 h-10 rounded-full bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-white flex items-center justify-center text-stone-400 hover:text-white transition-all shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="mb-6 pr-12">
                <div className="inline-block px-3 py-1 rounded-sm bg-arch-gold/10 text-arch-gold border-l-2 border-arch-gold text-xs font-bold tracking-wider mb-3">
                  {analysis.era.toUpperCase()}
                </div>
                <h2 className="text-3xl font-serif text-white mb-2 leading-tight drop-shadow-lg">{analysis.name}</h2>
              </div>

              <div className="space-y-3 flex-1">
                <InfoCard title="Analiz & Tanım" content={analysis.description} defaultOpen={true} />
                <InfoCard title="Tarihsel Kullanım" content={analysis.usage} />
                {analysis.conservationAdvice && (
                  <InfoCard title="Onarım & Koruma" content={analysis.conservationAdvice} />
                )}
              </div>

              <div className="mt-8 pt-6 flex flex-col gap-3 sticky bottom-0 bg-gradient-to-t from-arch-dark via-arch-dark to-transparent pb-2 z-30">
                <button onClick={() => setAppState(AppState.VR_MODE)} className="w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all relative overflow-hidden bg-gradient-to-r from-purple-900 to-indigo-900 text-white hover:brightness-110 shadow-[0_0_25px_rgba(79,70,229,0.3)]">
                  <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="relative z-10">{vrSceneInfo ? `VR: ${vrSceneInfo.name}` : 'VR DENEYİMİ'}</span>
                </button>
                <button onClick={handleReset} className="w-full py-3 border border-stone-600 text-stone-400 hover:text-white hover:border-white rounded-lg transition-colors flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  YENİ TARAMA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== VR MODE ========== */}
        {appState === AppState.VR_MODE && analysis && (
          <div className="fixed inset-0 z-50 bg-gradient-to-b from-indigo-950 via-purple-950 to-black flex flex-col items-center justify-center p-8">
            <div className="w-32 h-32 mb-8 relative">
              <div className="absolute inset-0 bg-purple-500/20 rounded-full animate-ping"></div>
              <div className="relative w-full h-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <h2 className="text-3xl font-serif text-white mb-3 text-center">VR Gözlüğünüzü Takın</h2>
            <p className="text-purple-300 text-center mb-8 max-w-md">Unity uygulaması sahneyi otomatik olarak yükleyecektir</p>
            {vrSceneInfo && (
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full mb-8">
                <div className="text-center">
                  <div className="text-purple-300 text-xs font-mono tracking-widest mb-2">YÜKLENECEK SAHNE</div>
                  <h3 className="text-2xl font-serif text-white mb-1">{vrSceneInfo.name}</h3>
                  <p className="text-purple-200 text-sm mb-3">{vrSceneInfo.period}</p>
                  <div className="h-px bg-white/20 my-3"></div>
                  <p className="text-purple-300 text-sm">{vrSceneInfo.description}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-white/60 text-sm mb-8">
              <span>Eser:</span>
              <span className="text-arch-gold font-medium">{analysis.name}</span>
              <span>•</span>
              <span>{analysis.era}</span>
            </div>
            <div className="flex items-center gap-3 text-purple-400 text-sm mb-8">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span>Unity uygulaması bekleniyor</span>
            </div>
            <button onClick={() => setAppState(AppState.RESULT)} className="px-6 py-3 border border-white/30 text-white/70 hover:text-white hover:border-white rounded-lg transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Sonuçlara Dön
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;