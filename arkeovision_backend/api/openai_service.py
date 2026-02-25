"""
OpenAI AI Service
ChatGPT Vision ile eser analizi + Unity VR sahne eslesmesi.
"""

import base64
import json
import logging
import re

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)

_client = None

# ============================================================
# 3 Unity Sahnesi
# ============================================================
VALID_SCENES = {
    "neolitik": {
        "id": "neolitik",
        "name": "Neolitik Çağ",
        "period": "MÖ 10.000 – 6.000",
        "description": "Yeni Taş Devri — Yerleşik hayata geçiş, tarım, çanak çömlek",
    },
    "kalkolitik": {
        "id": "kalkolitik",
        "name": "Kalkolitik Çağ (Bakır Çağı)",
        "period": "MÖ 5.500 – 3.000",
        "description": "Bakır işçiliği, kerpiç evler, tarımsal gelişim",
    },
    "tunc": {
        "id": "tunc",
        "name": "Tunç Çağı",
        "period": "MÖ 3.300 – 1.200",
        "description": "Kentleşme, ilk krallıklar, tunç alaşım teknolojisi",
    },
}


def _get_client() -> OpenAI:
    global _client
    if _client is not None:
        return _client

    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise ValueError("OPENAI_API_KEY ayarlanmamis. .env dosyasina ekleyin.")

    _client = OpenAI(api_key=api_key)
    return _client


ANALYSIS_PROMPT = """Sen uzman bir arkeolog ve sanat tarihcisisin.
Verilen goruntudeki arkeolojik eseri analiz et ve SADECE asagidaki JSON formatinda yanit ver.
Baska hicbir metin ekleme, sadece JSON dondur:

{
  "name": "Eserin adi (Turkce)",
  "era": "Donem bilgisi (orn: M.O. 3. Yuzyil, Neolitik Cag)",
  "description": "Eserin cok detayli aciklamasi. Malzemesi, yapim teknigi, boyutlari, uzerindeki motifler veya islemeler, hangi kultur veya uygarliga ait oldugu, bulundugu cografi bolge, stil ozellikleri ve korunma durumunu anlat. EN AZ 6 cumle yaz, bilimsel ve ansiklopedik bir dille yaz (Turkce)",
  "usage": "Eserin tarihsel kullanim amaci, hangi sosyal sinif veya meslek grubu tarafindan kullanildigi, gunluk yasam veya rituel baglamdaki rolu, benzer eserlerin diger kulturlerdeki ornekleri. EN AZ 4 cumle yaz (Turkce)",
  "conservationAdvice": "Eserin mevcut korunma durumuna gore nasil onarilabilecegini ve koruma altina alinabilecegini anlat. Gorsel hasarlar (catlamalar, kiriklari, renk solmasi, korozyon, eksik parcalar vb.) ile bunlarin nasil giderilebilecegini belirt. Hangi konservasyon malzemeleri (epoksi, alci, konservasyon badi vb.) ve tekniklerin (fotogrametri destekli 3D modelleme, kimyasal temizleme, fiziksel glue-back vb.) kullanilabilecegini acikla. Onarimin hangi uzman ekip tarafindan (arkeolog, konservator, restorator) yurutulmesi gerektigini yaz. Onarilan eserin ideal depolama ve sergileme koşullarini (nem, sicaklik, isik) belirt. EN AZ 5 cumle yaz, bilimsel bir dille (Turkce)",
  "visualPrompt": "The EXACT SAME artifact shown in the photo but FULLY RESTORED to its original pristine condition as it would have looked when newly made. Same shape, same material, same style but with all damage repaired, cracks filled, missing pieces reconstructed, original colors restored, original surface polish. Museum-quality restoration photograph, studio lighting, neutral background, photorealistic 8k",
  "eraPrompt": "A detailed English prompt to generate a photorealistic wide-angle scene of the historical era and setting where this artifact was used, 8k quality",
  "vrScene": "SADECE su 3 degerden birini yaz: neolitik | kalkolitik | tunc"
}

ONEMLI - vrScene alani icin karar rehberi:
- "neolitik" → Neolitik Cag (Yeni Tas Devri), MO 10.000-6.000. Canak comlek, tas aletler, ilkel seramik, obsidyen, kemik aletler, figurinler
- "kalkolitik" → Kalkolitik Cag (Bakir Cagi), MO 5.500-3.000. Bakir esyalar, susleme seramikleri, bakir takilar, maden curufu
- "tunc" → Tunc Cagi, MO 3.300-1.200. Tunc silahlar, muhurler, yazili tabletler, altin takılar, seramik kaplar, heykeller

Eserin malzemesine, stiline ve tahmini tarihine gore EN YAKIN donemi sec.
Eger goruntude arkeolojik bir eser tespit edemezsen, yine de nesneyi tanimla ve en yakin tarihsel baglamda yorumla."""


def analyze_artifact(base64_image: str) -> dict:
    """Base64 goruntuyu ChatGPT Vision ile analiz et."""
    client = _get_client()
    model = settings.OPENAI_CHAT_MODEL

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "Sen uzman bir arkeolog ve sanat tarihcisisin. Sadece JSON formatinda yanit ver.",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": ANALYSIS_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}",
                            "detail": "high",
                        },
                    },
                ],
            },
        ],
        temperature=0.7,
        max_completion_tokens=2048,
    )

    text = response.choices[0].message.content.strip()

    # JSON cikar
    json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1)
    else:
        text = text.strip('` \n')
        if not text.startswith('{'):
            start = text.find('{')
            if start != -1:
                text = text[start:]

    result = json.loads(text)

    for field in ['name', 'era', 'description', 'usage', 'conservationAdvice', 'visualPrompt', 'eraPrompt']:
        if field not in result:
            result[field] = "Bilgi uretilemedi"

    # vrScene dogrulama — gecersizse en yakin eslestir
    vr_scene = result.get('vrScene', '').lower().strip()
    if vr_scene not in VALID_SCENES:
        vr_scene = _guess_scene_from_era(result.get('era', ''))
    result['vrScene'] = vr_scene

    # Sahne detaylarini ekle
    scene_info = VALID_SCENES.get(vr_scene, VALID_SCENES['neolitik'])
    result['vrSceneInfo'] = scene_info

    logger.info(f"Analiz tamamlandi ({model}): {result.get('name', '?')} → VR: {vr_scene}")
    return result


def _guess_scene_from_era(era_text: str) -> str:
    """Era metninden sahne tahmin et (fallback)."""
    era_lower = era_text.lower()

    # Tunc Cagi ipuclari
    tunc_keywords = ['tunç', 'tunc', 'bronze', 'hitit', 'asur', 'miken', 'minos',
                     'mö 3', 'mö 2', 'mö 1', 'mo 3', 'mo 2', 'mo 1']
    for kw in tunc_keywords:
        if kw in era_lower:
            return 'tunc'

    # Kalkolitik ipuclari
    kalko_keywords = ['kalkolitik', 'bakır', 'bakir', 'chalcolithic', 'copper',
                      'mö 5', 'mö 4', 'mo 5', 'mo 4']
    for kw in kalko_keywords:
        if kw in era_lower:
            return 'kalkolitik'

    # Neolitik ipuclari
    neo_keywords = ['neolitik', 'taş devri', 'tas devri', 'neolithic', 'stone age',
                    'mö 10', 'mö 9', 'mö 8', 'mö 7', 'mö 6', 'mo 10', 'mo 9',
                    'mo 8', 'mo 7', 'mo 6', 'göbeklitepe', 'catalhoyuk', 'çatalhöyük']
    for kw in neo_keywords:
        if kw in era_lower:
            return 'neolitik'

    # Varsayilan
    return 'neolitik'


def generate_image(prompt: str) -> str | None:
    """DALL-E ile gorsel uret."""
    client = _get_client()
    image_model = settings.OPENAI_IMAGE_MODEL

    try:
        response = client.images.generate(
            model=image_model,
            prompt=prompt,
            n=1,
            size=settings.OPENAI_IMAGE_SIZE,
            quality=settings.OPENAI_IMAGE_QUALITY,
            response_format="b64_json",
        )

        b64 = response.data[0].b64_json
        return f"data:image/png;base64,{b64}"

    except Exception as e:
        logger.error(f"DALL-E hatasi ({image_model}): {e}")
        return None
