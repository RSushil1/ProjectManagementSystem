import { useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useProjects, useCreateProject } from '../hooks/useProjects';
import { Link } from 'react-router-dom';
import {
  FolderPlus,
  Loader2,
  Users,
  CheckSquare,
  LogOut,
  Calendar,
  X,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { clearTokens } from '../services/api';

export const Dashboard = () => {
  const { user, setUser } = useAuthContext();
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const { data: response, isLoading, isError, error } = useProjects(page, limit);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const handleLogout = () => {
    setUser(null);
    clearTokens();
  };

  const projects = response?.data || [];
  const pagination = response?.pagination;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Top Header */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <CheckSquare className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-bold text-xl text-gray-900 tracking-tight">FocusFlow</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-gray-700 hidden sm:block">
                {user?.name}
              </div>
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-md">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Projects</h2>
            <p className="text-gray-500 mt-1">Manage all your projects in one place.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <FolderPlus className="w-5 h-5" />
            <span className="hidden sm:inline">New Project</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
            <p className="text-gray-500 font-medium">Loading projects...</p>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="bg-red-50/80 border border-red-200 text-red-700 p-6 rounded-2xl flex flex-col items-center text-center">
            <p className="font-semibold text-lg mb-2">Failed to load projects</p>
            <p className="text-sm">{(error as any)?.message || 'An unexpected error occurred.'}</p>
          </div>
        )}

        {/* Project Grid */}
        {!isLoading && !isError && projects.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600">
              <FolderPlus className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">Create your first project to start organizing tasks and collaborating with your team.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-6 rounded-xl shadow-lg transition-all active:scale-95"
            >
              Create Project
            </button>
          </div>
        )}

        {!isLoading && !isError && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const myRole = project.members?.find((m) => m.user_id === user?.id)?.role || 'member';
              
              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="group bg-white rounded-3xl p-6 border border-gray-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-900/5 transition-all duration-300 relative overflow-hidden flex flex-col h-full"
                >
                  {/* Decorative background gradient */}
                  <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-indigo-50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full shrink-0 ${
                      myRole === 'owner' 
                        ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    }`}>
                      {myRole === 'owner' ? 'Owner' : 'Member'}
                    </span>
                  </div>
                  
                  <p className="text-gray-500 text-sm mb-6 line-clamp-2 flex-grow relative z-10">
                    {project.description || 'No description provided.'}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-4 border-t border-gray-50 relative z-10">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5" title="Members">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{project.members?.length || 1}</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Tasks">
                        <CheckSquare className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{project._count?.tasks || 0}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5" title="Created Date">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>{new Date(project.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !isError && pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center mt-10 gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 py-2 font-medium text-sm text-gray-700 bg-white border border-gray-200 rounded-xl">
              Page {page} of {pagination.totalPages}
            </div>
            <button
              disabled={page === pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {isModalOpen && <CreateProjectModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};

const CreateProjectModal = ({ onClose }: { onClose: () => void }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { mutate: createProject, isPending, error } = useCreateProject();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProject(
      { name, description },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const errMessage = (error as any)?.response?.data?.error?.message || (error as Error)?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in border border-gray-100">
        <div className="px-6 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-xl font-bold text-gray-900">Create New Project</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50/80 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
              {errMessage || 'An error occurred'}
            </div>
          )}
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Name</label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                placeholder="E.g., Marketing Campaign Q3"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(Optional)</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none"
                placeholder="Briefly describe the project goals..."
              />
            </div>
          </div>
          
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
            >
              {isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
