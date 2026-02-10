import React from 'react';
import { User, UserRole, ViewState } from '../types';
import { LayoutDashboard, Users, LogOut, Package2 } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  user, 
  currentView, 
  onNavigate, 
  onLogout 
}) => {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Package2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">AssetGuard</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => onNavigate('assets')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'assets' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Assets Inventory</span>
          </button>

          {user.role === UserRole.ADMIN && (
            <button
              onClick={() => onNavigate('users')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === 'users' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">User Management</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-semibold text-gray-800">
            {currentView === 'assets' ? 'Asset Inventory' : 'User Administration'}
          </h1>
        </header>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};