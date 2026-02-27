using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.SceneManagement;

/// <summary>
/// VR sahnesinden Lobby'ye dönüş.
/// Her VR sahnesine ekleyin. Kullanıcı çıkmak istediğinde çağrılır.
/// </summary>
public class ArkeoVisionReturnToLobby : MonoBehaviour
{
    [Header("Ayarlar")]
    [Tooltip("Lobby sahnesinin adı")]
    public string lobbySceneName = "Lobby";

    [Tooltip("Backend URL")]
    public string backendUrl = "http://192.168.1.100:8000/api";

    [Tooltip("Otomatik dönüş süresi (0 = kapalı)")]
    public float autoReturnSeconds = 0f;

    private float timer = 0f;

    void Start()
    {
        if (autoReturnSeconds > 0)
        {
            timer = autoReturnSeconds;
        }
    }

    void Update()
    {
        // Otomatik dönüş sayacı
        if (autoReturnSeconds > 0)
        {
            timer -= Time.deltaTime;
            if (timer <= 0)
            {
                ReturnToLobby();
            }
        }

        // Escape tuşu veya VR controller back butonu ile çıkış
        if (Input.GetKeyDown(KeyCode.Escape) || Input.GetKeyDown(KeyCode.Backspace))
        {
            ReturnToLobby();
        }
    }

    /// <summary>
    /// Lobby'ye dön. UI butonundan da çağrılabilir.
    /// </summary>
    public void ReturnToLobby()
    {
        StartCoroutine(ClearAndReturn());
    }

    IEnumerator ClearAndReturn()
    {
        // Backend'deki sahneyi temizle
        string url = $"{backendUrl}/vr/scene/clear/";
        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(new byte[0]);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = 3;
            yield return request.SendWebRequest();
        }

        SceneManager.LoadScene(lobbySceneName);
    }
}
