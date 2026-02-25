from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check),
    path('analyze/', views.analyze_artifact_view),
    path('generate/restored/', views.generate_restored),
    path('generate/vr/', views.generate_vr),
    path('generate/3d/', views.generate_3d_design),

    # Raspberry Pi kamera
    path('pi/status/', views.pi_status),
    path('pi/capture/', views.pi_capture_proxy),
    path('pi/stream-url/', views.pi_stream_url),

    # Unity VR sahne
    path('vr/scene/', views.vr_scene_get),
    path('vr/scene/consume/', views.vr_scene_consume),
    path('vr/scene/clear/', views.vr_scene_clear),

    # Tarama geçmişi
    path('scans/', views.scan_history),
    path('scans/<int:record_id>/', views.scan_history_delete),
]
