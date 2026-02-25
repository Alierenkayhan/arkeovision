export interface VRSceneInfo {
  id: string;
  name: string;
  period: string;
  description: string;
}

export interface ArtifactAnalysis {
  name: string;
  era: string;
  description: string;
  usage: string;
  conservationAdvice: string;
  visualPrompt: string;
  eraPrompt: string;
  vrScene: string;          // "neolitik" | "kalkolitik" | "tunc"
  vrSceneInfo: VRSceneInfo;
}

export interface ScannedItem {
  id: number;
  name: string;
  era: string;
  description: string;
  usage: string;
  conservationAdvice: string;
  vrScene: string;
  vrSceneInfo: VRSceneInfo;
  capturedImage: string;
  restoredImage: string;
  design3dImage: string;
  createdAt: string;
}

export enum AppState {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  VR_MODE = 'VR_MODE',
  ERROR = 'ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}