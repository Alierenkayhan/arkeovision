# ArkeoVision Frontend

React + TypeScript frontend for the ArkeoVision archaeological artifact recognition platform.

## Features

- 📸 **Camera Scanning**: Real-time camera feed with scanning overlay
- 🎤 **Voice Commands**: Turkish voice recognition for hands-free operation
- 🖼️ **AI Analysis**: Artifact analysis powered by Django backend
- 🔄 **Restoration View**: Compare original vs AI-restored images
- 🥽 **VR Mode**: Stereoscopic view for VR headsets

## Tech Stack

- React 18
- TypeScript
- Vite
- TailwindCSS (via CDN)
- Web Speech API

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# The default VITE_API_URL points to localhost:8000
# Update if your Django backend runs elsewhere
```

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 4. Make sure Django Backend is Running

```bash
# In the backend directory
cd ../arkeovision_backend
python manage.py runserver 8000
```

## Project Structure

```
arkeovision_frontend/
├── components/
│   ├── ScannerOverlay.tsx    # Camera scanning overlay
│   └── VRViewer.tsx          # VR stereoscopic viewer
├── services/
│   └── geminiService.ts      # API client for Django backend
├── App.tsx                   # Main application component
├── index.tsx                 # Entry point
├── index.html                # HTML template
├── types.ts                  # TypeScript types
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies
├── .env                      # Environment variables
└── README.md                 # This file
```

## Voice Commands (Turkish)

| Command | Action |
|---------|--------|
| "ArkeoVision" / "tara" / "başlat" | Start camera scanning |
| "çek" / "yakala" | Capture photo |

## API Integration

The frontend communicates with the Django backend through these endpoints:

- `GET /api/health/` - Check backend status
- `POST /api/analyze/` - Analyze artifact image
- `POST /api/generate/restored/` - Generate restored image
- `POST /api/generate/vr/` - Generate VR environment

## Demo Mode

If the backend is unavailable, the app automatically falls back to demo mode with mock data. The status indicator in the header shows:

- 🟢 **API Bağlı** - Backend connected
- 🟡 **Demo Mod** - Running with mock data

## Building for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Django backend URL | `http://localhost:8000/api` |

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

Note: Voice recognition requires Chrome or Edge for best results.

## License

MIT License
