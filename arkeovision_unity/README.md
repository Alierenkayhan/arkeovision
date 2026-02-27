# ArkeoVision Unity VR Entegrasyonu

## Akış

```
Kullanıcı eser tarıyor
        ↓
  ChatGPT analiz ediyor → vrScene: "neolitik" | "kalkolitik" | "tunc"
        ↓
  Backend sahneyi kaydediyor
        ↓
  Unity uygulaması polluyor → /api/vr/scene/
        ↓
  Doğru sahne yükleniyor
```

## Unity Kurulumu

### 1. Sahneleri Build Settings'e Ekle

File → Build Settings → Scenes In Build:

```
0: Lobby        ← Başlangıç sahnesi (bekleme ekranı)
1: Neolitik     ← Neolitik Çağ VR sahnesi
2: Kalkolitik   ← Kalkolitik Çağ VR sahnesi
3: Tunc         ← Tunç Çağı VR sahnesi
```

### 2. Lobby Sahnesine Script Ekle

1. Lobby sahnesinde boş bir GameObject oluştur → adını "SceneLoader" koy
2. `ArkeoVisionSceneLoader.cs` script'ini bu objeye ekle
3. Inspector'da ayarla:
   - **Backend URL**: `http://BILGISAYAR_IP:8000/api`
   - **Poll Interval**: `2` (saniye)
   - **Neolitik Scene Name**: `Neolitik` (Unity'deki sahne adı)
   - **Kalkolitik Scene Name**: `Kalkolitik`
   - **Tunc Scene Name**: `Tunc`
4. (Opsiyonel) UI Text elemanları ekleyip referansları bağla:
   - Status Text: "Tarama bekleniyor..."
   - Artifact Name Text: Eser adı
   - Era Text: Dönem bilgisi

### 3. VR Sahnelerine Dönüş Script'i Ekle

Her VR sahnesinde (Neolitik, Kalkolitik, Tunc):

1. Boş GameObject oluştur → "ReturnManager"
2. `ArkeoVisionReturnToLobby.cs` ekle
3. Inspector'da:
   - **Lobby Scene Name**: `Lobby`
   - **Backend URL**: `http://BILGISAYAR_IP:8000/api`
   - **Auto Return Seconds**: `120` (2dk sonra otomatik dönüş, 0=kapalı)

### 4. Çıkış Butonu (Opsiyonel)

VR sahnelerinde bir UI Button ekleyip OnClick'e:
```
ReturnManager → ArkeoVisionReturnToLobby → ReturnToLobby()
```

## API Endpoint'leri (Unity İçin)

| Method | URL | Açıklama |
|--------|-----|----------|
| GET | `/api/vr/scene/` | Mevcut sahneyi al (Unity pollar) |
| POST | `/api/vr/scene/consume/` | Sahneyi "okundu" olarak işaretle |
| POST | `/api/vr/scene/clear/` | Sahneyi temizle (lobbye dönerken) |

### GET /api/vr/scene/ Response:

```json
{
  "scene": "neolitik",
  "scene_info": {
    "id": "neolitik",
    "name": "Neolitik Çağ",
    "period": "MÖ 10.000 – 6.000",
    "description": "Yeni Taş Devri"
  },
  "artifact_name": "Obsidyen Bıçak",
  "era": "MÖ 8000",
  "consumed": false,
  "timestamp": 1708500000.0
}
```

- `scene` = null → Henüz tarama yapılmadı
- `consumed` = false → Yeni sahne, Unity yüklemeli
- `consumed` = true → Unity zaten yükledi

## Ağ Ayarları

- Unity ve Backend aynı WiFi ağında olmalı
- Backend'i `0.0.0.0:8000` üzerinde başlatın
- Windows Firewall'da 8000 portunu açın
