using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.SceneManagement;

/// <summary>
/// ArkeoVision VR Scene Loader
/// Django backend'i pollar ve doğru sahneyi yükler.
/// 
/// KURULUM:
/// 1. Bu script'i ilk sahnenize (örn: "Lobby" veya "MainMenu") boş bir GameObject'e ekleyin.
/// 2. Inspector'da Backend URL'yi ayarlayın.
/// 3. Unity'de 3 sahnenizi Build Settings'e ekleyin:
///    - Sahne 0: Lobby (bu script'in olduğu sahne)
///    - Sahne 1: Neolitik
///    - Sahne 2: Kalkolitik  
///    - Sahne 3: Tunc
/// 4. Scene Mapping'de sahne adlarını Unity sahne adlarıyla eşleştirin.
/// </summary>
public class ArkeoVisionSceneLoader : MonoBehaviour
{
    [Header("Backend Bağlantısı")]
    [Tooltip("Django backend URL (örn: http://192.168.1.100:8000/api)")]
    public string backendUrl = "http://192.168.1.100:8000/api";

    [Tooltip("Backend'i ne sıklıkla pollla (saniye)")]
    public float pollInterval = 2f;

    [Header("Sahne Eşleştirme")]
    [Tooltip("neolitik → Unity sahne adı")]
    public string neolitikSceneName = "Neolitik";

    [Tooltip("kalkolitik → Unity sahne adı")]
    public string kalkolitikSceneName = "Kalkolitik";

    [Tooltip("tunc → Unity sahne adı")]
    public string tuncSceneName = "Tunc";

    [Header("UI Referansları (Opsiyonel)")]
    [Tooltip("Bekleme durumunu gösteren UI Text")]
    public UnityEngine.UI.Text statusText;

    [Tooltip("Eser adını gösteren UI Text")]
    public UnityEngine.UI.Text artifactNameText;

    [Tooltip("Dönem bilgisini gösteren UI Text")]
    public UnityEngine.UI.Text eraText;

    // Durum
    private bool isLoading = false;
    private string currentScene = "";

    void Start()
    {
        UpdateStatus("Backend'e bağlanılıyor...");
        StartCoroutine(PollBackend());
    }

    IEnumerator PollBackend()
    {
        while (true)
        {
            if (!isLoading)
            {
                yield return StartCoroutine(CheckForScene());
            }
            yield return new WaitForSeconds(pollInterval);
        }
    }

    IEnumerator CheckForScene()
    {
        string url = $"{backendUrl}/vr/scene/";

        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            request.timeout = 5;
            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                string json = request.downloadHandler.text;
                SceneResponse response = JsonUtility.FromJson<SceneResponse>(json);

                // Yeni, consume edilmemiş sahne var mı?
                if (!string.IsNullOrEmpty(response.scene) && !response.consumed)
                {
                    string targetScene = MapScene(response.scene);

                    if (!string.IsNullOrEmpty(targetScene) && targetScene != currentScene)
                    {
                        Debug.Log($"[ArkeoVision] Yeni sahne algılandı: {response.scene} → {targetScene}");
                        Debug.Log($"[ArkeoVision] Eser: {response.artifact_name} | Dönem: {response.era}");

                        UpdateArtifactInfo(response.artifact_name, response.era);
                        UpdateStatus($"Sahne yükleniyor: {targetScene}...");

                        // Sahneyi consumed olarak işaretle
                        yield return StartCoroutine(ConsumeScene());

                        // Sahneyi yükle
                        yield return StartCoroutine(LoadScene(targetScene));
                    }
                }
                else
                {
                    UpdateStatus("Tarama bekleniyor...\nArkeoVision uygulamasından eser tarayın.");
                }
            }
            else
            {
                UpdateStatus($"Backend bağlantı hatası\n{backendUrl}");
                Debug.LogWarning($"[ArkeoVision] Backend hatası: {request.error}");
            }
        }
    }

    IEnumerator ConsumeScene()
    {
        string url = $"{backendUrl}/vr/scene/consume/";

        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(new byte[0]);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = 5;
            yield return request.SendWebRequest();
        }
    }

    IEnumerator LoadScene(string sceneName)
    {
        isLoading = true;

        // Sahne var mı kontrol et
        AsyncOperation asyncLoad = SceneManager.LoadSceneAsync(sceneName);

        if (asyncLoad == null)
        {
            Debug.LogError($"[ArkeoVision] Sahne bulunamadı: {sceneName}");
            Debug.LogError("Build Settings'e sahneyi eklediğinizden emin olun!");
            UpdateStatus($"HATA: '{sceneName}' sahnesi bulunamadı!");
            isLoading = false;
            yield break;
        }

        asyncLoad.allowSceneActivation = false;

        while (asyncLoad.progress < 0.9f)
        {
            float progress = asyncLoad.progress * 100f;
            UpdateStatus($"Yükleniyor... %{progress:F0}");
            yield return null;
        }

        UpdateStatus("Sahne hazır!");
        yield return new WaitForSeconds(0.5f);

        asyncLoad.allowSceneActivation = true;
        currentScene = sceneName;
        isLoading = false;
    }

    string MapScene(string sceneId)
    {
        switch (sceneId.ToLower().Trim())
        {
            case "neolitik": return neolitikSceneName;
            case "kalkolitik": return kalkolitikSceneName;
            case "tunc": return tuncSceneName;
            default:
                Debug.LogWarning($"[ArkeoVision] Bilinmeyen sahne: {sceneId}, neolitik kullanılıyor");
                return neolitikSceneName;
        }
    }

    void UpdateStatus(string message)
    {
        if (statusText != null)
            statusText.text = message;
    }

    void UpdateArtifactInfo(string name, string era)
    {
        if (artifactNameText != null)
            artifactNameText.text = name ?? "";
        if (eraText != null)
            eraText.text = era ?? "";
    }

    // JSON response modeli
    [Serializable]
    private class SceneResponse
    {
        public string scene;
        public string artifact_name;
        public string era;
        public bool consumed;
        public float timestamp;
    }
}
