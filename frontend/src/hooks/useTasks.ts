import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Task, ApiResponse, Project } from '../types/api';

export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData: Partial<Task> & { project_id: string }) => {
      const { data } = await api.post<ApiResponse<Task>>('/tasks', taskData);
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project', variables.project_id] });
    },
  });
};

export const useUpdateTaskStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, status, project_id }: { taskId: string; status: Task['status']; project_id: string }) => {
      const { data } = await api.patch<ApiResponse<Task>>(`/tasks/${taskId}`, { status });
      return data.data;
    },
    // Optimistic update
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['project', variables.project_id] });
      const previousProject = queryClient.getQueryData<Project>(['project', variables.project_id]);

      if (previousProject && previousProject.tasks) {
        queryClient.setQueryData<Project>(['project', variables.project_id], {
          ...previousProject,
          tasks: previousProject.tasks.map((task) =>
            task.id === variables.taskId ? { ...task, status: variables.status } : task
          ),
        });
      }

      return { previousProject };
    },
    onError: (_, variables, context: any) => {
      if (context?.previousProject) {
        queryClient.setQueryData(['project', variables.project_id], context.previousProject);
      }
    },
    onSettled: (_, __, variables) => {
      // Background refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['project', variables.project_id] });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<Task> & { project_id: string } }) => {
      const response = await api.patch<ApiResponse<Task>>(`/tasks/${taskId}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project', variables.data.project_id] });
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, project_id }: { taskId: string; project_id: string }) => {
      const { data } = await api.delete<ApiResponse<{ message: string }>>(`/tasks/${taskId}`);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project', variables.project_id] });
    },
  });
};
