import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName } from "@pixiv/three-vrm";
import * as THREE from "three";
import bundledDefaultVrm from "@/assets/default-kera.vrm";

/**
 * URL pública de um VRM gratuito (sample oficial pixiv/three-vrm, MIT).
 * Usuário pode substituir mandando seu próprio .vrm e trocando esta URL,
 * ou colocando um arquivo em /public/avatars/kera.vrm e usando "/avatars/kera.vrm".
 */
const DEFAULT_VRM_URL = bundledDefaultVrm;

type Emotion = "neutral" | "happy" | "sad" | "angry" | "surprised" | "relaxed";

/** Detecta emoção dominante a partir do texto da resposta. */
function detectEmotion(text: string | undefined): Emotion {
  if (!text) return "neutral";
  const t = text.toLowerCase();
  if (/[😀😄😁😊🥰😍🤩❤️]|haha|kkkk|que (bom|legal|massa|ótimo|otimo|maravilh)|adorei|amei|perfeito|parabéns/.test(t))
    return "happy";
  if (/[😢😭💔]|que pena|sinto muito|triste|infelizmente|lamento/.test(t))
    return "sad";
  if (/[😡🤬]|absurdo|inaceitável|inaceitavel|raiva|irritad|inadmiss/.test(t))
    return "angry";
  if (/[😮😱🤯]|nossa|caramba|sério\?|serio\?|incrível|incrivel|uau|wow/.test(t))
    return "surprised";
  if (/calma|relaxa|tranqui|paz|meditação|respira/.test(t)) return "relaxed";
  return "neutral";
}

/** Carrega VRM de uma URL e devolve o objeto VRM já configurado. */
function useVRM(url: string): VRM | null {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });
  const [vrm, setVrm] = useState<VRM | null>(null);

  useEffect(() => {
    const loaded = (gltf as any).userData?.vrm as VRM | undefined;
    if (!loaded) return;
    VRMUtils.removeUnnecessaryVertices(loaded.scene);
    VRMUtils.combineSkeletons(loaded.scene);
    loaded.scene.traverse((obj: any) => {
      if (obj.isMesh) obj.frustumCulled = false;
    });
    // Vira a Kera pra olhar pra câmera (VRM padrão olha pro -Z, viramos pro +Z).
    loaded.scene.rotation.y = Math.PI;
    setVrm(loaded);
    return () => {
      VRMUtils.deepDispose(loaded.scene);
    };
  }, [gltf]);

  return vrm;
}

type AvatarMeshProps = {
  vrmUrl: string;
  audioElement: HTMLAudioElement | null;
  speaking: boolean;
  emotion: Emotion;
};

function AvatarMesh({ vrmUrl, audioElement, speaking, emotion }: AvatarMeshProps) {
  const vrm = useVRM(vrmUrl);
  const blinkRef = useRef({ next: 2 + Math.random() * 3, t: 0, active: false, progress: 0 });
  const breatheRef = useRef(0);
  const lookRef = useRef({ x: 0, y: 0, tx: 0, ty: 0, t: 0 });

  // Web Audio analyser para lipsync (nível de volume → abertura da boca)
  const analyserRef = useRef<{
    ctx: AudioContext;
    src: MediaElementAudioSourceNode;
    analyser: AnalyserNode;
    data: Uint8Array;
  } | null>(null);

  useEffect(() => {
    if (!audioElement) return;
    // (Re)cria analyser quando o elemento <audio> muda
    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx: AudioContext = new AudioCtx();
      const src = ctx.createMediaElementSource(audioElement);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = {
        ctx,
        src,
        analyser,
        data: new Uint8Array(analyser.frequencyBinCount),
      };
    } catch (e) {
      // Em alguns browsers, recriar o source falha — ignore e continue só com idle
      console.warn("[KeraAvatar3D] analyser não pôde ser criado:", e);
    }
    return () => {
      try {
        analyserRef.current?.ctx.close();
      } catch {}
      analyserRef.current = null;
    };
  }, [audioElement]);

  // Aplica expressão emocional quando muda
  useEffect(() => {
    const expr = vrm?.expressionManager;
    if (!expr) return;
    const presets: Emotion[] = [
      "happy",
      "sad",
      "angry",
      "surprised",
      "relaxed",
      "neutral",
    ];
    presets.forEach((e) => {
      try {
        expr.setValue(e as any, 0);
      } catch {}
    });
    if (emotion !== "neutral") {
      try {
        expr.setValue(emotion as any, 0.7);
      } catch {}
    }
  }, [vrm, emotion]);

  useFrame((_, delta) => {
    if (!vrm) return;

    // ----- Lipsync via volume do áudio -----
    let mouthValue = 0;
    const a = analyserRef.current;
    if (a && speaking) {
      a.analyser.getByteFrequencyData(a.data as any);
      // foca em frequências de voz (índices ~1..30 cobrem ~80Hz–3kHz com fftSize 256/44.1kHz)
      let sum = 0;
      const lo = 1;
      const hi = Math.min(30, a.data.length);
      for (let i = lo; i < hi; i++) sum += a.data[i];
      const avg = sum / (hi - lo) / 255; // 0..1
      mouthValue = Math.min(1, Math.pow(avg * 1.6, 0.8));
    }
    try {
      vrm.expressionManager?.setValue("aa" as any, mouthValue);
    } catch {}

    // ----- Piscar -----
    const blink = blinkRef.current;
    blink.t += delta;
    if (!blink.active && blink.t >= blink.next) {
      blink.active = true;
      blink.progress = 0;
    }
    if (blink.active) {
      blink.progress += delta * 8;
      const v =
        blink.progress < 0.5
          ? blink.progress * 2
          : Math.max(0, 1 - (blink.progress - 0.5) * 2);
      try {
        vrm.expressionManager?.setValue("blink" as any, v);
      } catch {}
      if (blink.progress >= 1) {
        blink.active = false;
        blink.t = 0;
        blink.next = 2 + Math.random() * 4;
      }
    }

    // ----- Respirar (oscilação suave do peito) -----
    breatheRef.current += delta;
    const bone = vrm.humanoid?.getNormalizedBoneNode("chest" as any);
    if (bone) {
      bone.rotation.x = Math.sin(breatheRef.current * 1.4) * 0.02;
    }

    // ----- Olhar levemente em direções aleatórias -----
    const look = lookRef.current;
    look.t += delta;
    if (look.t > 3) {
      look.tx = (Math.random() - 0.5) * 0.25;
      look.ty = (Math.random() - 0.5) * 0.15;
      look.t = 0;
    }
    look.x += (look.tx - look.x) * delta * 2;
    look.y += (look.ty - look.y) * delta * 2;
    const head = vrm.humanoid?.getNormalizedBoneNode("head" as any);
    if (head) {
      head.rotation.y = look.x;
      head.rotation.x = look.y;
    }

    vrm.update(delta);
  });

  if (!vrm) return null;
  return <primitive object={vrm.scene} />;
}

/** Garante que a câmera olhe para o tronco/cabeça da Kera, não para os pés. */
function CameraRig({ targetY = 1.1 }: { targetY?: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(0, targetY, 0);
    camera.updateProjectionMatrix();
  }, [camera, targetY]);
  return null;
}

function LoadingOrb() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.6;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.4, 1]} />
      <meshStandardMaterial
        color="#a855f7"
        emissive="#7c3aed"
        emissiveIntensity={0.6}
        wireframe
      />
    </mesh>
  );
}

export type KeraAvatar3DProps = {
  /** Texto da última fala da Kera — usado pra detectar emoção */
  lastReplyText?: string;
  /** Está falando agora? (controla lipsync ativo) */
  speaking?: boolean;
  /** Ref pro <audio> que está tocando o TTS — usado pra ler volume */
  audioElement?: HTMLAudioElement | null;
  /** Sobrepor a URL padrão do VRM (ex: "/avatars/kera.vrm" se você colocar o seu) */
  vrmUrl?: string;
  /** Permitir orbitar com o mouse (default: false) */
  interactive?: boolean;
  className?: string;
};

export default function KeraAvatar3D({
  lastReplyText,
  speaking = false,
  audioElement = null,
  vrmUrl = DEFAULT_VRM_URL,
  interactive = false,
  className,
}: KeraAvatar3DProps) {
  const emotion = useMemo(() => detectEmotion(lastReplyText), [lastReplyText]);

  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 1.3, 2.8], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <CameraRig targetY={1.1} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 3]} intensity={1.1} color="#e9d5ff" />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#a855f7" />
        <Suspense fallback={<LoadingOrb />}>
          <AvatarMesh
            vrmUrl={vrmUrl}
            audioElement={audioElement}
            speaking={speaking}
            emotion={emotion}
          />
          <Environment preset="city" />
        </Suspense>
        {interactive && (
          <OrbitControls
            target={[0, 1.1, 0]}
            enablePan={false}
            minDistance={0.8}
            maxDistance={3}
          />
        )}
      </Canvas>
    </div>
  );
}