import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { AssetList } from './components/AssetList';
import { UserManagement } from './components/UserManagement';
import { storageService } from './services/storage';
import { User, ViewState } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('assets');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const currentUser = storageService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('assets');
  };

  const handleLogout = () => {
    storageService.logout();
    setUser(null);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading...</div>;
  }

  if (!user) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <Layout
      user={user}
      currentView={currentView}
      onNavigate={setCurrentView}
      onLogout={handleLogout}
    >
      {currentView === 'assets' ? (
        <AssetList currentUser={user} />
      ) : (
        <UserManagement />
      )}
    </Layout>
  );
}

export default App;