import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Environment, Grid } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import * as THREE from "three";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, RotateCcw, Trash2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import bundledDefaultVrm from "@/assets/default-kera.vrm";
import { saveVRM, getVRMObjectURL, clearVRM } from "@/lib/vrmStorage";

type Emotion = "neutral" | "happy" | "sad" | "angry" | "surprised" | "relaxed";
const EMOTIONS: Emotion[] = ["neutral", "happy", "sad", "angry", "surprised", "relaxed"];

function GLBModel({ url, autoRotate }: { url: string; autoRotate: boolean }) {
  const gltf = useLoader(GLTFLoader, url);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!gltf?.scene) return;
    // Auto-fit: normalize size to ~1.6m height and center on origin
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const targetHeight = 1.6;
    const scale = size.y > 0 ? targetHeight / size.y : 1;
    gltf.scene.scale.setScalar(scale);
    gltf.scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    gltf.scene.traverse((o: any) => { if (o.isMesh) o.frustumCulled = false; });
  }, [gltf]);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) groupRef.current.rotation.y += delta * 0.3;
  });

  if (!gltf?.scene) return null;
  return <group ref={groupRef}><primitive object={gltf.scene} /></group>;
}

function VRMModel({ url, emotion, intensity, autoRotate }: { url: string; emotion: Emotion; intensity: number; autoRotate: boolean }) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });
  const [vrm, setVrm] = useState<VRM | null>(null);
  const blinkRef = useRef({ next: 2 + Math.random() * 3, t: 0, active: false, progress: 0 });
  const breatheRef = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const loaded = (gltf as any).userData?.vrm as VRM | undefined;
    if (!loaded) return;
    VRMUtils.removeUnnecessaryVertices(loaded.scene);
    VRMUtils.combineSkeletons(loaded.scene);
    loaded.scene.traverse((o: any) => { if (o.isMesh) o.frustumCulled = false; });
    loaded.scene.rotation.y = 0;
    setVrm(loaded);
    return () => { VRMUtils.deepDispose(loaded.scene); };
  }, [gltf]);

  useEffect(() => {
    const expr = vrm?.expressionManager;
    if (!expr) return;
    EMOTIONS.forEach((e) => { try { expr.setValue(e as any, 0); } catch {} });
    if (emotion !== "neutral") {
      try { expr.setValue(emotion as any, intensity); } catch {}
    }
  }, [vrm, emotion, intensity]);

  useFrame((_, delta) => {
    if (!vrm) return;
    const blink = blinkRef.current;
    blink.t += delta;
    if (!blink.active && blink.t >= blink.next) { blink.active = true; blink.progress = 0; }
    if (blink.active) {
      blink.progress += delta * 8;
      const v = blink.progress < 0.5 ? blink.progress * 2 : Math.max(0, 1 - (blink.progress - 0.5) * 2);
      try { vrm.expressionManager?.setValue("blink" as any, v); } catch {}
      if (blink.progress >= 1) { blink.active = false; blink.t = 0; blink.next = 2 + Math.random() * 4; }
    }
    breatheRef.current += delta;
    const chest = vrm.humanoid?.getNormalizedBoneNode("chest" as any);
    if (chest) chest.rotation.x = Math.sin(breatheRef.current * 1.4) * 0.02;
    if (autoRotate && groupRef.current) groupRef.current.rotation.y += delta * 0.3;
    vrm.update(delta);
  });

  if (!vrm) return null;
  return <group ref={groupRef}><primitive object={vrm.scene} /></group>;
}

function LoadingOrb() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.6; });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.4, 1]} />
      <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={0.6} wireframe />
    </mesh>
  );
}

export default function KeraDesktop3D() {
  const [vrmUrl, setVrmUrl] = useState<string>(bundledDefaultVrm);
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [intensity, setIntensity] = useState(0.7);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const stored = await getVRMObjectURL();
      if (stored) setVrmUrl(stored);
    })();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".vrm")) {
      toast.error("Arquivo precisa ter extensão .vrm");
      return;
    }
    try {
      await saveVRM(file);
      const url = URL.createObjectURL(file);
      setVrmUrl(url);
      toast.success(`Modelo carregado: ${file.name}`);
    } catch (err) {
      toast.error("Erro ao salvar modelo: " + (err as Error).message);
    }
  }

  async function handleClearVRM() {
    await clearVRM();
    setVrmUrl(bundledDefaultVrm);
    toast.success("Modelo personalizado removido. Usando Kera padrão.");
  }

  function handleFullscreen() {
    document.documentElement.requestFullscreen?.();
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-primary/10">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-background/80 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link>
          </Button>
          <h1 className="text-lg font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Kera 3D Studio
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleFullscreen}>
          <Maximize2 className="h-4 w-4 mr-2" />Tela cheia
        </Button>
      </div>

      {/* Canvas */}
      <Canvas
        key={resetKey}
        camera={{ position: [0, 1.35, 3.5], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 3]} intensity={1.1} color="#e9d5ff" />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#a855f7" />
        <Suspense fallback={<LoadingOrb />}>
          <VRMModel url={vrmUrl} emotion={emotion} intensity={intensity} autoRotate={autoRotate} />
          <Environment preset="city" />
        </Suspense>
        {showGrid && (
          <Grid
            args={[20, 20]}
            cellColor="#a855f7"
            sectionColor="#7c3aed"
            cellSize={0.5}
            sectionSize={2}
            fadeDistance={15}
            fadeStrength={1}
            position={[0, 0, 0]}
          />
        )}
        <OrbitControls
          target={[0, 1.1, 0]}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={0.3}
          maxDistance={10}
          autoRotate={false}
        />
      </Canvas>

      {/* Side panel */}
      <Card className="absolute top-20 right-4 w-72 p-4 space-y-4 bg-background/80 backdrop-blur-md border-primary/20">
        <div>
          <h3 className="text-sm font-semibold mb-2">Modelo VRM</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept=".vrm"
            className="hidden"
            onChange={handleUpload}
          />
          <div className="flex gap-2">
            <Button onClick={() => fileInputRef.current?.click()} size="sm" className="flex-1">
              <Upload className="h-4 w-4 mr-2" />Carregar .vrm
            </Button>
            <Button onClick={handleClearVRM} size="sm" variant="outline" title="Remover modelo personalizado">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Salvo localmente no navegador</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Emoção</h3>
          <div className="grid grid-cols-3 gap-1">
            {EMOTIONS.map((e) => (
              <Button
                key={e}
                size="sm"
                variant={emotion === e ? "default" : "outline"}
                onClick={() => setEmotion(e)}
                className="text-xs h-8"
              >
                {e}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <h3 className="text-sm font-semibold">Intensidade</h3>
            <span className="text-xs text-muted-foreground">{Math.round(intensity * 100)}%</span>
          </div>
          <Slider value={[intensity]} onValueChange={(v) => setIntensity(v[0])} min={0} max={1} step={0.05} />
        </div>

        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <label className="text-sm">Rotação automática</label>
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} className="h-4 w-4 accent-primary" />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm">Mostrar grade</label>
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="h-4 w-4 accent-primary" />
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => setResetKey((k) => k + 1)} className="w-full">
          <RotateCcw className="h-4 w-4 mr-2" />Resetar câmera
        </Button>
      </Card>

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/60 backdrop-blur-sm px-4 py-2 rounded-full border border-border/50">
        🖱️ Arrastar = girar · Scroll = zoom · Botão direito = pan
      </div>
    </div>
  );
}
