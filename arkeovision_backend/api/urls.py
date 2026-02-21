from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check),
    path('analyze/', views.analyze_artifact_view),
    path('generate/restored/', views.generate_restored),
    path('generate/vr/', views.generate_vr),

    # Unity VR Scene endpoints
    path('vr/scene/', views.vr_scene_get),
    path('vr/scene/consume/', views.vr_scene_consume),
    path('vr/scene/clear/', views.vr_scene_clear),
]
