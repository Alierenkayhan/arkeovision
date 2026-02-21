"""
VR Scene Store
Son analiz sonucundaki sahne bilgisini tutar.
Unity uygulamasi /api/vr/scene/ endpoint'ini polleyerek sahneyi ogrenır.
"""

import threading
import time

_lock = threading.Lock()
_current_scene = {
    "scene": None,          # "neolitik" | "kalkolitik" | "tunc" | None
    "scene_info": None,      # { id, name, period, description }
    "artifact_name": None,   # Eserin adi
    "era": None,             # Donem bilgisi
    "timestamp": None,       # Ne zaman set edildi
    "consumed": True,        # Unity okudu mu?
}


def set_scene(scene_id: str, scene_info: dict, artifact_name: str, era: str):
    """Yeni sahne ayarla (analiz tamamlandiginda cagirilir)."""
    with _lock:
        _current_scene["scene"] = scene_id
        _current_scene["scene_info"] = scene_info
        _current_scene["artifact_name"] = artifact_name
        _current_scene["era"] = era
        _current_scene["timestamp"] = time.time()
        _current_scene["consumed"] = False


def get_scene() -> dict:
    """Mevcut sahneyi dondur (Unity pollar)."""
    with _lock:
        return dict(_current_scene)


def consume_scene() -> dict:
    """Sahneyi oku ve consumed olarak isaretle (Unity sahneyi yuklediginde)."""
    with _lock:
        data = dict(_current_scene)
        _current_scene["consumed"] = True
        return data


def clear_scene():
    """Sahneyi temizle."""
    with _lock:
        _current_scene["scene"] = None
        _current_scene["scene_info"] = None
        _current_scene["artifact_name"] = None
        _current_scene["era"] = None
        _current_scene["timestamp"] = None
        _current_scene["consumed"] = True
