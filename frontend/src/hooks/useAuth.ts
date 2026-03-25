import { useMutation } from '@tanstack/react-query';
import { api, setTokens, clearTokens } from '../services/api';
import type { AuthResponse } from '../types/api';
import { useAuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const useLogin = () => {
  const { setUser } = useAuthContext();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (credentials: any) => {
      const { data } = await api.post<{ success: boolean; data: AuthResponse }>('/auth/login', credentials);
      return data.data;
    },
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      navigate('/dashboard');
    },
  });
};

export const useRegister = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (userData: any) => {
      const { data } = await api.post<{ success: boolean }>('/auth/register', userData);
      return data;
    },
    onSuccess: () => {
      navigate('/login', { state: { message: 'Registration successful! Please log in.' } });
    },
  });
};

export const useLogout = () => {
  const { setUser } = useAuthContext();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      // Backend should ideally handle logout but if it's optional
      await api.post('/auth/logout').catch(() => {});
    },
    onSettled: () => {
      clearTokens();
      setUser(null);
      navigate('/login');
    },
  });
};
