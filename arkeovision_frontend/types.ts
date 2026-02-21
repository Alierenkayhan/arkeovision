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
  visualPrompt: string;
  eraPrompt: string;
  vrScene: string;          // "neolitik" | "kalkolitik" | "tunc"
  vrSceneInfo: VRSceneInfo;
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