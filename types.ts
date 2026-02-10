export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export interface User {
  username: string;
  password?: string; // Optional when retrieving lists for security, though we use localstorage mock
  role: UserRole;
}

export enum AssetStatus {
  ACTIVE = 'active',
  DISPOSED = 'disposed',
}

export interface Asset {
  id: string;
  make: string;
  serialNumber: string;
  assetId: string;
  location: string;
  value: number;
  title: string;
  createdBy: string;
  createdAt: string; // ISO Date string
  status: AssetStatus;
  disposalReason?: string;
  disposedBy?: string;
  disposedAt?: string;
}

export type ViewState = 'assets' | 'users';