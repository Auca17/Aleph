export interface UserProfile {
  email: string;
  nombre: string;
  avatar: string;
  rol: string;
}

const STORAGE_KEY = 'aleph_session';

export const DEFAULT_USER: UserProfile = {
  email: 'demo@aleph.ai',
  nombre: 'Alex Aleph',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  rol: 'Autónomo / Freelancer'
};

export function getSessionUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as UserProfile;
  } catch {
    return null;
  }
}

export function loginUser(email: string, nombre?: string): UserProfile {
  const user: UserProfile = {
    email: email || DEFAULT_USER.email,
    nombre: nombre || (email ? email.split('@')[0] : DEFAULT_USER.nombre),
    avatar: DEFAULT_USER.avatar,
    rol: DEFAULT_USER.rol
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
  return user;
}

export function logoutUser(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
