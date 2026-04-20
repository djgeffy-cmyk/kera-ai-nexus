/**
 * Armazenamento local do VRM personalizado da Kera usando IndexedDB.
 *
 * Por que IndexedDB e não localStorage?
 * - Modelos .vrm normalmente têm 3-30 MB. localStorage tem limite de ~5 MB
 *   e só guarda strings (precisaria base64 = +33% de tamanho).
 * - IndexedDB guarda Blobs nativamente, sem cota apertada.
 *
 * Por que não Supabase Storage?
 * - O usuário pediu uma solução simples sem custo. Local funciona perfeito
 *   pra um modelo pessoal — fica no navegador dele, carrega instantâneo.
 */

const DB_NAME = "kera-assets";
const STORE = "vrm";
const KEY = "kera-avatar";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveVRM(file: Blob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadVRMBlob(): Promise<Blob | null> {
  try {
    const db = await openDB();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function clearVRM(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Cria uma URL temporária (blob:) pro VRM salvo. Lembre de revogar depois. */
export async function getVRMObjectURL(): Promise<string | null> {
  const blob = await loadVRMBlob();
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
