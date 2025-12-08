import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the shape of your context data
interface AuthContextType {
  isAuthenticated: boolean;
  user: any; // Replace 'any' with your user type
  login: (userData: any) => void; // Replace 'any' with your user data type for login
  logout: () => void;
}

// Create the context with a default undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null); // Replace 'any' with your user type

  const login = (userData: any) => {
    // Implement your login logic here
    setUser(userData);
    setIsAuthenticated(true);
    console.log('User logged in:', userData);
  };

  const logout = () => {
    // Implement your logout logic here
    setUser(null);
    setIsAuthenticated(false);
    console.log('User logged out');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Create a custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
