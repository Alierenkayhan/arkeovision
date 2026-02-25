"""
API Views for ArkeoVision
ChatGPT analiz + DALL-E restorasyon + Pi kamera durumu + Unity VR
"""

import logging
import requests
import time

from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status as http_status

from .openai_service import analyze_artifact, generate_image
from . import vr_scene_store
from .models import ScanRecord

logger = logging.getLogger(__name__)


def _check_pi_online() -> bool:
    """Pi kamerasına HTTP ile bağlanmayı dene."""
    pi_url = getattr(settings, 'PI_CAMERA_URL', '')
    if not pi_url:
        return False
    try:
        res = requests.get(f"{pi_url}/status", timeout=3)
        if res.ok:
            data = res.json()
            return data.get('online', False)
    except Exception:
        pass
    return False


# ============================================================
# Health
# ============================================================

@api_view(['GET'])
def health_check(request):
    pi_online = _check_pi_online()
    return Response({
        'status': 'ok',
        'service': 'ArkeoVision Backend',
        'pi_status': 'online' if pi_online else 'offline',
        'pi_url': getattr(settings, 'PI_CAMERA_URL', ''),
    })


# ============================================================
# Pi Durum & Proxy
# ============================================================

@api_view(['GET'])
def pi_status(request):
    pi_online = _check_pi_online()
    return Response({
        'pi_status': 'online' if pi_online else 'offline',
        'pi_url': getattr(settings, 'PI_CAMERA_URL', ''),
    })


@api_view(['GET'])
def pi_capture_proxy(request):
    """Backend uzerinden Pi'dan kare cek."""
    pi_url = getattr(settings, 'PI_CAMERA_URL', '')
    if not pi_url:
        return Response({'detail': 'PI_CAMERA_URL ayarlanmamis'}, status=http_status.HTTP_503_SERVICE_UNAVAILABLE)
    try:
        res = requests.get(f"{pi_url}/capture", timeout=10)
        if res.ok:
            return Response(res.json())
        return Response({'detail': 'Pi kare yakalayamadi'}, status=http_status.HTTP_502_BAD_GATEWAY)
    except Exception as e:
        return Response({'detail': f'Pi baglanti hatasi: {str(e)}'}, status=http_status.HTTP_502_BAD_GATEWAY)


@api_view(['GET'])
def pi_stream_url(request):
    """Frontend'e Pi stream URL'sini doner."""
    pi_url = getattr(settings, 'PI_CAMERA_URL', '')
    return Response({
        'stream_url': f"{pi_url}/stream" if pi_url else None,
        'capture_url': f"{pi_url}/capture" if pi_url else None,
        'pi_url': pi_url,
    })


# ============================================================
# Analiz
# ============================================================

@api_view(['POST'])
def analyze_artifact_view(request):
    source = request.data.get('source', '')
    base64_image = request.data.get('image', '')

    # Pi karesini backend uzerinden cek
    if source == 'pi' or not base64_image:
        pi_url = getattr(settings, 'PI_CAMERA_URL', '')
        if pi_url:
            try:
                res = requests.get(f"{pi_url}/capture", timeout=10)
                if res.ok:
                    data = res.json()
                    base64_image = data.get('image', '')
            except Exception as e:
                logger.error(f"Pi capture hatasi: {e}")

        if not base64_image:
            return Response(
                {'detail': 'Goruntu alinamadi. image alani gonderin veya Pi kamerasinin calistigindan emin olun.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

    if ',' in base64_image:
        base64_image = base64_image.split(',', 1)[1]

    try:
        analysis = analyze_artifact(base64_image)
    except Exception as e:
        logger.error(f"Analiz hatasi: {e}")
        return Response(
            {'detail': f'AI analizi basarisiz: {str(e)}'},
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    vr_scene_store.set_scene(
        scene_id=analysis.get('vrScene', 'neolitik'),
        scene_info=analysis.get('vrSceneInfo', {}),
        artifact_name=analysis.get('name', ''),
        era=analysis.get('era', ''),
    )

    return Response({'analysis': analysis})


# ============================================================
# Gorsel Uretimi
# ============================================================

@api_view(['POST'])
def generate_restored(request):
    prompt = request.data.get('prompt')
    if not prompt:
        return Response({'detail': 'Prompt gerekli.'}, status=http_status.HTTP_400_BAD_REQUEST)
    try:
        image = generate_image(prompt)
        if image:
            return Response({'success': True, 'image': image})
        return Response({'detail': 'Gorsel uretilemedi.'}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'detail': str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def generate_vr(request):
    prompt = request.data.get('prompt')
    if not prompt:
        return Response({'detail': 'Prompt gerekli.'}, status=http_status.HTTP_400_BAD_REQUEST)
    vr_prompt = f"{prompt}, panoramic wide angle, immersive environment, photorealistic 8k"
    try:
        image = generate_image(vr_prompt)
        if image:
            return Response({'success': True, 'image': image})
        return Response({'detail': 'VR gorseli uretilemedi.'}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'detail': str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def generate_3d_design(request):
    """Eserin 3D müze sergi kalitesinde tasarım görselini üret."""
    prompt = request.data.get('prompt')
    if not prompt:
        return Response({'detail': 'Prompt gerekli.'}, status=http_status.HTTP_400_BAD_REQUEST)
    # Bu prompt displacement map için optimize edilmiştir:
    # - Tam önden görüş: geometri düzgün çıkar
    # - Koyu siyah arka plan: arka plan düz kalır (karanlık = displacement yok)
    # - Güçlü yan ışık: yüzey detaylarını belirginleştirir, derinlik hissi verir
    # - Yüksek kontrast: daha belirgin 3D relief efekti
    design_prompt = (
        f"{prompt}, "
        "front-facing centered view, artifact isolated on pure black background, "
        "strong single directional side lighting casting clear shadows across the surface, "
        "high contrast photorealistic render, full artifact visible, "
        "no background objects, sharp surface texture detail, museum specimen photography, "
        "8k resolution"
    )
    try:
        image = generate_image(design_prompt)
        if image:
            return Response({'success': True, 'image': image})
        return Response({'detail': '3D görsel üretilemedi.'}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'detail': str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================
# Unity VR Scene
# ============================================================

@api_view(['GET'])
def vr_scene_get(request):
    return Response(vr_scene_store.get_scene())

@api_view(['POST'])
def vr_scene_consume(request):
    data = vr_scene_store.consume_scene()
    return Response({'status': 'ok', 'consumed_scene': data.get('scene')})

@api_view(['POST'])
def vr_scene_clear(request):
    vr_scene_store.clear_scene()
    return Response({'status': 'ok'})


# ============================================================
# Tarama Geçmişi
# ============================================================

@api_view(['GET', 'POST'])
def scan_history(request):
    if request.method == 'GET':
        records = ScanRecord.objects.all()
        data = [
            {
                'id': r.id,
                'name': r.name,
                'era': r.era,
                'description': r.description,
                'usage': r.usage,
                'vrScene': r.vr_scene,
                'vrSceneInfo': r.vr_scene_info,
                'capturedImage': r.captured_image,
                'restoredImage': r.restored_image,
                'design3dImage': r.design_3d_image,
                'conservationAdvice': r.conservation_advice,
                'createdAt': r.created_at.isoformat(),
            }
            for r in records
        ]
        return Response(data)

    # POST — yeni tarama kaydet
    body = request.data
    required = ['name', 'era', 'description', 'capturedImage']
    for field in required:
        if not body.get(field):
            return Response(
                {'detail': f'{field} alanı zorunlu.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

    record = ScanRecord.objects.create(
        name=body['name'],
        era=body['era'],
        description=body['description'],
        usage=body.get('usage', ''),
        vr_scene=body.get('vrScene', ''),
        vr_scene_info=body.get('vrSceneInfo', {}),
        captured_image=body['capturedImage'],
        restored_image=body.get('restoredImage', ''),
        design_3d_image=body.get('design3dImage', ''),
        conservation_advice=body.get('conservationAdvice', ''),
    )
    return Response({'id': record.id, 'status': 'ok'}, status=http_status.HTTP_201_CREATED)


@api_view(['DELETE'])
def scan_history_delete(request, record_id):
    try:
        record = ScanRecord.objects.get(id=record_id)
        record.delete()
        return Response({'status': 'ok'})
    except ScanRecord.DoesNotExist:
        return Response({'detail': 'Kayıt bulunamadı.'}, status=http_status.HTTP_404_NOT_FOUND)
