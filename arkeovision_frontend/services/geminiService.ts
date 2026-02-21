/**
 * API Service for ArkeoVision
 * Communicates with Django backend for ChatGPT analysis and DALL-E image generation
 */

import { ArtifactAnalysis } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

/**
 * Check if the backend is available
 */
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health/`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch (error) {
    console.warn('Backend health check failed:', error);
    return false;
  }
};

/**
 * Analyze an artifact image using ChatGPT Vision
 */
export const analyzeArtifactImage = async (
  base64Image: string
): Promise<{
  analysis: ArtifactAnalysis;
}> => {
  const response = await fetch(`${API_BASE_URL}/analyze/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Analiz başarısız oldu (HTTP ${response.status})`
    );
  }

  const data = await response.json();
  return {
    analysis: data.analysis || data,
  };
};

/**
 * Generate a restored image of the artifact via DALL-E
 */
export const generateRestoredImage = async (prompt: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/generate/restored/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`Restorasyon görseli oluşturulamadı (HTTP ${response.status})`);
  }

  const data = await response.json();
  if (data.success && data.image) return data.image;

  throw new Error('Restorasyon görseli oluşturulamadı');
};

/**
 * Generate a VR environment image via DALL-E
 */
export const generateVREnvironment = async (prompt: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/generate/vr/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`VR ortamı oluşturulamadı (HTTP ${response.status})`);
  }

  const data = await response.json();
  if (data.success && data.image) return data.image;

  throw new Error('VR ortamı oluşturulamadı');
};