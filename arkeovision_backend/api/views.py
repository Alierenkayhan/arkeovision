"""
API Views for ArkeoVision
"""

import logging

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .openai_service import analyze_artifact, generate_image
from . import vr_scene_store

logger = logging.getLogger(__name__)


@api_view(['GET'])
def health_check(request):
    return Response({'status': 'ok', 'service': 'ArkeoVision Backend'})


@api_view(['POST'])
def analyze_artifact_view(request):
    """
    POST { "image": "<base64>" }
    → analiz + vrScene belirleme + Unity icin sahne kaydetme
    """
    base64_image = request.data.get('image')
    if not base64_image:
        return Response(
            {'detail': 'image alani gerekli.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if ',' in base64_image:
        base64_image = base64_image.split(',', 1)[1]

    try:
        analysis = analyze_artifact(base64_image)
    except Exception as e:
        logger.error(f"Analiz hatasi: {e}")
        return Response(
            {'detail': f'AI analizi basarisiz: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Unity icin sahneyi kaydet
    vr_scene_store.set_scene(
        scene_id=analysis.get('vrScene', 'neolitik'),
        scene_info=analysis.get('vrSceneInfo', {}),
        artifact_name=analysis.get('name', ''),
        era=analysis.get('era', ''),
    )

    return Response({
        'analysis': analysis,
    })


@api_view(['POST'])
def generate_restored(request):
    """POST { "prompt": "..." } → { "success": true, "image": "data:..." }"""
    prompt = request.data.get('prompt')
    if not prompt:
        return Response({'detail': 'Prompt gerekli.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        image = generate_image(prompt)
        if image:
            return Response({'success': True, 'image': image})
        return Response({'detail': 'Gorsel uretilemedi.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        logger.error(f"Restorasyon hatasi: {e}")
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def generate_vr(request):
    """POST { "prompt": "..." } → { "success": true, "image": "data:..." }"""
    prompt = request.data.get('prompt')
    if not prompt:
        return Response({'detail': 'Prompt gerekli.'}, status=status.HTTP_400_BAD_REQUEST)

    vr_prompt = f"{prompt}, panoramic wide angle, immersive environment, photorealistic 8k"

    try:
        image = generate_image(vr_prompt)
        if image:
            return Response({'success': True, 'image': image})
        return Response({'detail': 'VR gorseli uretilemedi.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        logger.error(f"VR hatasi: {e}")
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================
# Unity VR Scene Endpoints
# ============================================================

@api_view(['GET'])
def vr_scene_get(request):
    """
    Unity bu endpoint'i pollar.
    Yeni sahne varsa dondurur, yoksa scene=null doner.

    GET /api/vr/scene/
    → {
        "scene": "neolitik",
        "scene_info": { "id": "neolitik", "name": "Neolitik Çağ", ... },
        "artifact_name": "Obsidyen Bıçak",
        "era": "MÖ 8000",
        "consumed": false
      }
    """
    data = vr_scene_store.get_scene()
    return Response(data)


@api_view(['POST'])
def vr_scene_consume(request):
    """
    Unity sahneyi yukledikten sonra bunu cagirır.
    Sahneyi "consumed" olarak isaretler.

    POST /api/vr/scene/consume/
    """
    data = vr_scene_store.consume_scene()
    return Response({'status': 'ok', 'consumed_scene': data.get('scene')})


@api_view(['POST'])
def vr_scene_clear(request):
    """
    Sahneyi temizle.

    POST /api/vr/scene/clear/
    """
    vr_scene_store.clear_scene()
    return Response({'status': 'ok'})
