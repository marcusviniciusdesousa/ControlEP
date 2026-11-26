import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const PREFIX = 'ep-filter:';

function read<T>(key: string, initial: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw === null ? initial : (JSON.parse(raw) as T);
  } catch {
    return initial;
  }
}

/**
 * Estado que sobrevive à troca de módulo (e ao recarregar a aba), guardado no
 * sessionStorage: cada aba do navegador mantém seus próprios filtros e eles
 * são descartados ao fechá-la. Usado apenas para filtros de tela.
 */
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => read(key, initial));
  useEffect(() => {
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Armazenamento indisponível: o filtro vale só enquanto a tela estiver aberta
    }
  }, [key, value]);
  return [value, setValue];
}

/** Remove os filtros salvos (ex.: ao sair do sistema). */
export function clearPersistentFilters(): void {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}
