/**
 * Viewer3D — DALL-E görselini gerçek 3D displacement mesh'e dönüştürür.
 *
 * Nasıl çalışır:
 *  - Görsel hem renk (map) hem de yükseklik haritası (displacementMap) olarak kullanılır.
 *  - Parlak pikseller → vertex ileri çıkar (eser yüzeyi)
 *  - Koyu pikseller  → vertex geri çekilir (arka plan / gölgeler)
 *  - Sonuç: fare ile döndürülebilen, gerçek 3D relief geometrisi
 *
 * Kontroller: Sol tık döndür · Scroll yakınlaştır · Sağ tık kaydır
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Props {
  imageUrl: string;   // base64 data URL
  className?: string;
}

export const Viewer3D: React.FC<Props> = ({ imageUrl, className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // ── Scene ────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080808);
    scene.fog = new THREE.FogExp2(0x080808, 0.06);

    // ── Camera ───────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / mount.clientHeight,
      0.01,
      100,
    );
    // Başlangıç kamerası biraz yandan — derinliği hemen gösterir
    camera.position.set(0.6, 0.2, 2.8);
    camera.lookAt(0, 0, 0);

    // ── Controls ─────────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 0.8;
    controls.maxDistance = 7;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;
    controls.target.set(0, 0, 0);

    // ── Işıklar ──────────────────────────────────────────────────────────
    // Ambient — zemin ışığı
    const ambient = new THREE.AmbientLight(0xfff4e0, 0.35);
    scene.add(ambient);

    // Key light — soldan üstten, gölge oluşturur
    const key = new THREE.DirectionalLight(0xfff8f0, 2.8);
    key.position.set(-2.5, 3, 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 15;
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -3;
    key.shadow.bias = -0.0005;
    scene.add(key);

    // Fill light — sağdan, yumuşak
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.6);
    fill.position.set(3, 1, 2);
    scene.add(fill);

    // Rim light — arkadan, silüet için
    const rim = new THREE.DirectionalLight(0xffd080, 0.8);
    rim.position.set(0, 0.5, -4);
    scene.add(rim);

    // Alt ışık — altın parlaması
    const bottom = new THREE.PointLight(0xd4af37, 0.9, 5);
    bottom.position.set(0, -1.5, 1);
    scene.add(bottom);

    // ── Zemin ────────────────────────────────────────────────────────────
    const floorGeo = new THREE.CircleGeometry(4, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c0c0a,
      roughness: 0.98,
      metalness: 0.02,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Altın zemin halkası
    const ringGeo = new THREE.RingGeometry(0.42, 0.56, 72);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.19;
    scene.add(ring);

    // Kaide
    const pedGeo = new THREE.CylinderGeometry(0.38, 0.46, 0.85, 36);
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x181410,
      roughness: 0.75,
      metalness: 0.15,
    });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.y = -1.2 + 0.85 / 2;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    // ── Displacement mesh ────────────────────────────────────────────────
    // Texture yüklenince mesh oluşturulur
    const textureLoader = new THREE.TextureLoader();
    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroup.position.y = 0;

    let colorTex: THREE.Texture;
    let frontMesh: THREE.Mesh;
    let backMesh: THREE.Mesh;
    let edgeMesh: THREE.Mesh;

    textureLoader.load(imageUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      colorTex = tex;

      // Görsel en-boy oranı
      const imgW = tex.image.width as number;
      const imgH = tex.image.height as number;
      const aspect = imgW / imgH;

      // Mesh boyutları — uzun kenar 2 birim
      const mW = aspect >= 1 ? 2.0 : 2.0 * aspect;
      const mH = aspect >= 1 ? 2.0 / aspect : 2.0;

      // Yüksek poligon sayısı = daha smooth displacement
      // 512 segment her boyut için ~260k vertex → iyi detay
      const segX = 384;
      const segY = Math.round(segX / aspect);

      // ── Ön yüz: renkli + displacement ─────────────────────────────
      const frontGeo = new THREE.PlaneGeometry(mW, mH, segX, segY);
      const frontMat = new THREE.MeshStandardMaterial({
        map: tex,
        displacementMap: tex,
        displacementScale: 0.52,   // derinlik miktarı
        displacementBias: -0.18,   // arka planı geri çeker
        roughness: 0.68,
        metalness: 0.04,
        side: THREE.FrontSide,
      });
      frontMesh = new THREE.Mesh(frontGeo, frontMat);
      frontMesh.castShadow = true;
      frontMesh.receiveShadow = true;
      meshGroup.add(frontMesh);

      // ── Arka yüz: koyu, aynı displacement → dönerken düzgün görünür
      const backGeo = new THREE.PlaneGeometry(mW, mH, segX, segY);
      const backMat = new THREE.MeshStandardMaterial({
        map: tex,
        displacementMap: tex,
        displacementScale: 0.52,
        displacementBias: -0.18,
        roughness: 0.9,
        metalness: 0.02,
        color: new THREE.Color(0.18, 0.14, 0.10),
        side: THREE.BackSide,
      });
      backMesh = new THREE.Mesh(backGeo, backMat);
      meshGroup.add(backMesh);

      // ── Kenar dolgusu:얇은 kutu, displacement yok ──────────────────
      const edgeGeo = new THREE.BoxGeometry(mW, mH, 0.03);
      const edgeMat = new THREE.MeshStandardMaterial({
        color: 0x1a1208,
        roughness: 0.85,
      });
      edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
      edgeMesh.position.z = -0.02;
      edgeMesh.castShadow = true;
      meshGroup.add(edgeMesh);

      // Kaide ve halka y konumunu güncelle
      const bottomEdge = -mH / 2 - 0.05;
      pedestal.position.y = bottomEdge - 0.85 / 2;
      ring.position.y = bottomEdge - 0.85 - 0.01;
      floor.position.y = ring.position.y - 0.01;
      bottom.position.y = pedestal.position.y;

      // Kamera hedefini güncelle
      controls.target.set(0, 0, 0);
      camera.position.set(0.5, 0.15, mW * 1.55);
      camera.lookAt(0, 0, 0);
      controls.update();
    });

    // ── Resize ───────────────────────────────────────────────────────────
    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(mount);

    // ── Animasyon ────────────────────────────────────────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Hafif yüzer
      meshGroup.position.y = Math.sin(t * 0.75) * 0.018;

      // Altın halka nabzı
      ringMat.opacity = 0.22 + Math.sin(t * 1.3) * 0.1;
      bottom.intensity = 0.8 + Math.sin(t * 1.1) * 0.25;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ── Temizlik ─────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      colorTex?.dispose();
      frontMesh?.geometry.dispose();
      backMesh?.geometry.dispose();
      edgeMesh?.geometry.dispose();
      [floorGeo, ringGeo, pedGeo].forEach(g => g.dispose());
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [imageUrl]);

  return (
    <div
      ref={mountRef}
      className={`w-full h-full ${className}`}
      style={{ touchAction: 'none' }}
    />
  );
};
