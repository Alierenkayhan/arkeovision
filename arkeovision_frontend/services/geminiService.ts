/**
 * API Service for ArkeoVision
 * Backend + Raspberry Pi kamera iletişimi
 */

import { ArtifactAnalysis, ScannedItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const PI_BASE_URL = import.meta.env.VITE_PI_URL || 'http://localhost:8080';

// ============================================================
// Backend API
// ============================================================

export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE_URL}/health/`, { method: 'GET' });
    return res.ok;
  } catch { return false; }
};

export const analyzeArtifactImage = async (
  base64Image: string
): Promise<{ analysis: ArtifactAnalysis }> => {
  const res = await fetch(`${API_BASE_URL}/analyze/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Analiz başarısız (HTTP ${res.status})`);
  }
  const data = await res.json();
  return { analysis: data.analysis || data };
};

export const generateRestoredImage = async (prompt: string): Promise<string> => {
  const res = await fetch(`${API_BASE_URL}/generate/restored/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`Restorasyon başarısız (HTTP ${res.status})`);
  const data = await res.json();
  if (data.success && data.image) return data.image;
  throw new Error('Restorasyon görseli oluşturulamadı');
};

export const generateVREnvironment = async (prompt: string): Promise<string> => {
  const res = await fetch(`${API_BASE_URL}/generate/vr/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`VR başarısız (HTTP ${res.status})`);
  const data = await res.json();
  if (data.success && data.image) return data.image;
  throw new Error('VR ortamı oluşturulamadı');
};

// ============================================================
// Raspberry Pi Kamera
// ============================================================

export const getPiStreamUrl = (): string => `${PI_BASE_URL}/stream`;

export const checkPiStatus = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${PI_BASE_URL}/status`, { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return data.online === true;
  } catch { return false; }
};

// ============================================================
// Tarama Geçmişi
// ============================================================

export const getScanHistory = async (): Promise<ScannedItem[]> => {
  const res = await fetch(`${API_BASE_URL}/scans/`);
  if (!res.ok) throw new Error('Geçmiş alınamadı');
  return res.json();
};

export const saveScan = async (payload: {
  name: string;
  era: string;
  description: string;
  usage: string;
  conservationAdvice: string;
  vrScene: string;
  vrSceneInfo: object;
  capturedImage: string;
  restoredImage: string;
  design3dImage: string;
}): Promise<{ id: number }> => {
  const res = await fetch(`${API_BASE_URL}/scans/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Tarama kaydedilemedi');
  return res.json();
};

export const deleteScan = async (id: number): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/scans/${id}/`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Silme başarısız');
};

export const generate3DDesign = async (prompt: string): Promise<string> => {
  const res = await fetch(`${API_BASE_URL}/generate/3d/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`3D tasarım başarısız (HTTP ${res.status})`);
  const data = await res.json();
  if (data.success && data.image) return data.image;
  throw new Error('3D görsel oluşturulamadı');
};

// ============================================================
// Raspberry Pi Kamera
// ============================================================

/**
 * Pi kamerasından tek kare çek → base64 döndür
 */
export const captureFromPi = async (): Promise<string> => {
  const res = await fetch(`${PI_BASE_URL}/capture`, { method: 'GET' });
  if (!res.ok) throw new Error('Pi kamerasından görüntü alınamadı');
  const data = await res.json();
  if (data.success && data.image) return data.image;
  throw new Error('Pi kare yakalaması başarısız');
};