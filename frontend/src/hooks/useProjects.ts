import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Project, ApiResponse } from '../types/api';

export const useProjects = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['projects', page, limit],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Project[]>>('/projects', {
        params: { page, limit },
      });
      return data; // Returns the full envelope { success, data, pagination }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache similar to backend
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectData: { name: string; description?: string }) => {
      const { data } = await api.post<ApiResponse<Project>>('/projects', projectData);
      return data.data;
    },
    onSuccess: () => {
      // Invalidate project list cache
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
