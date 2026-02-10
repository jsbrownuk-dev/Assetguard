import { User, Asset, UserRole, AssetStatus } from '../types';

const USERS_KEY = 'asset_guard_users';
const CURRENT_USER_KEY = 'asset_guard_current_session';
const API_URL = 'http://10.121.224.118:3001/assets';

// Helper for generating IDs without crypto API (works in non-secure contexts like HTTP IP access)
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Seed initial admin (Local only for now as requested API is for assets)
const seedData = () => {
  const existingUsers = localStorage.getItem(USERS_KEY);
  if (!existingUsers) {
    const adminUser: User = {
      username: 'Admin',
      password: 'Summerhill', // In a real app, hash this!
      role: UserRole.ADMIN,
    };
    localStorage.setItem(USERS_KEY, JSON.stringify([adminUser]));
  }
};

seedData();

export const storageService = {
  // User Management (Kept Local for Auth simplicity)
  getUsers: (): User[] => {
    const usersStr = localStorage.getItem(USERS_KEY);
    return usersStr ? JSON.parse(usersStr) : [];
  },

  addUser: (user: User): void => {
    const users = storageService.getUsers();
    if (users.find(u => u.username.toLowerCase() === user.username.toLowerCase())) {
      throw new Error('Username already exists');
    }
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  deleteUser: (username: string): void => {
    let users = storageService.getUsers();
    // Prevent deleting the main Admin
    if (username === 'Admin') throw new Error('Cannot delete main Admin account');
    users = users.filter(u => u.username !== username);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  login: (username: string, password: string): User | null => {
    const users = storageService.getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      // Return user without password
      const { password, ...safeUser } = user;
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
      return safeUser as User;
    }
    return null;
  },

  logout: (): void => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => {
    const userStr = localStorage.getItem(CURRENT_USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },

  // Asset Management (Remote API)
  getAssets: async (): Promise<Asset[]> => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Failed to fetch assets');
      return await response.json();
    } catch (error) {
      console.error('Error getting assets:', error);
      throw error;
    }
  },

  addAsset: async (assetData: Omit<Asset, 'id' | 'createdAt' | 'status'>): Promise<Asset> => {
    const newAsset: Asset = {
      ...assetData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      status: AssetStatus.ACTIVE,
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAsset),
      });

      if (!response.ok) throw new Error('Failed to create asset');
      return await response.json();
    } catch (error) {
      console.error('Error adding asset:', error);
      throw error;
    }
  },

  disposeAsset: async (id: string, reason: string, disposedBy: string): Promise<void> => {
    const updates = {
      status: AssetStatus.DISPOSED,
      disposalReason: reason,
      disposedBy,
      disposedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to dispose asset');
    } catch (error) {
      console.error('Error disposing asset:', error);
      throw error;
    }
  },
};