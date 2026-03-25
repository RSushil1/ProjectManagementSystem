import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ExportRecord, ApiResponse } from '../types/api';

export const useTriggerExport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data } = await api.post<ApiResponse<{ exportId: string; status: string }>>(`/projects/${projectId}/export`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exports'] });
    },
  });
};

export const useExportStatus = (exportId: string | null) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['export', exportId],
    queryFn: async () => {
      if (!exportId) return null;
      const { data } = await api.get<ApiResponse<ExportRecord>>(`/exports/${exportId}`);
      return data.data;
    },
    enabled: !!exportId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') {
        return false; // stop polling
      }
      return 3000; // poll every 3 seconds
    },
    // When completed, invalidate exports history so it updates
    refetchIntervalInBackground: true,
  });
};

export const useExportHistory = (page = 1, limit = 50) => {
  return useQuery({
    queryKey: ['exports', page, limit],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ExportRecord[]>>('/exports', {
        params: { page, limit },
      });
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const downloadExportFile = async (exportId: string) => {
  try {
    const response = await api.get(`/exports/${exportId}/download`, {
      responseType: 'blob',
    });
    
    // Create a Blob from the response data
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Extract filename from header or fallback
    const disposition = response.headers['content-disposition'];
    let filename = `export-${exportId}.csv`;
    if (disposition && disposition.indexOf('attachment') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed', error);
    throw error;
  }
};
