from django.db import models
import json


class ScanRecord(models.Model):
    """Daha önce taranmış eserlerin kayıtları."""
    name = models.CharField(max_length=255)
    era = models.CharField(max_length=255)
    description = models.TextField()
    usage = models.TextField(blank=True)
    vr_scene = models.CharField(max_length=100, blank=True)
    vr_scene_info = models.JSONField(default=dict, blank=True)
    captured_image = models.TextField()            # base64 (data URL)
    restored_image = models.TextField(blank=True)  # base64 (data URL)
    design_3d_image = models.TextField(blank=True) # base64 (data URL), 3D render
    conservation_advice = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.era})"
