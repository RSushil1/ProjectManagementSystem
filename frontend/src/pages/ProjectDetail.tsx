import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { useProject, useAddMember } from '../hooks/useProject';
import { useCreateTask, useUpdateTaskStatus } from '../hooks/useTasks';
import { useTriggerExport, useExportStatus, useExportHistory, downloadExportFile } from '../hooks/useExports';
import { KanbanBoard } from '../components/KanbanBoard';
import type { Task, ProjectMember, ExportRecord } from '../types/api';
import { 
  ArrowLeft, Download, Plus, Users, Filter, 
  Loader2, Mail, X, CheckSquare, FileText,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';

export const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthContext();
  const { data: project, isLoading, isError, error } = useProject(id!);
  
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeExportId, setActiveExportId] = useState<string | null>(null);
  
  const { mutate: updateTaskStatus } = useUpdateTaskStatus();
  const { mutate: addMember, isPending: isAddingMember } = useAddMember();

  const { mutate: triggerExport, isPending: isTriggeringExport } = useTriggerExport();
  const { data: activeExport } = useExportStatus(activeExportId);
  const { data: historyResponse } = useExportHistory();

  // Check if polling finished
  useEffect(() => {
    if (activeExport) {
      if (activeExport.status === 'completed') {
        // Stop polling handled inside hook via return false
      } else if (activeExport.status === 'failed') {
        alert('Export failed to process.');
      }
    }
  }, [activeExport]);

  const handleExport = () => {
    triggerExport(id!, {
      onSuccess: (data) => {
        setActiveExportId(data.exportId);
        setIsHistoryOpen(true); // Open history to show progress
      },
      onError: () => alert('Failed to start export'),
    });
  };

  const handleDownload = async (exportId: string) => {
    try {
      await downloadExportFile(exportId);
    } catch {
      alert('Failed to download file');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl max-w-md text-center border border-red-200">
          <h2 className="text-xl font-bold mb-2">Failed to load project</h2>
          <p>{(error as any)?.message || 'Project not found or access denied.'}</p>
          <Link to="/dashboard" className="mt-4 inline-block text-indigo-600 hover:underline font-medium">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const myRole = project.members?.find((m) => m.user_id === user?.id)?.role;
  const isOwner = myRole === 'owner';

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail) return;
    addMember({ projectId: id!, email: memberEmail }, {
      onSuccess: () => setMemberEmail(''),
      onError: (err: any) => alert(err?.response?.data?.error?.message || 'Failed to add member'),
    });
  };

  const visibleTasks = (project.tasks || []).filter(task => 
    priorityFilter === 'all' ? true : task.priority === priorityFilter
  );

  const projectExports = historyResponse?.data?.filter(e => e.project_id === id) || [];
  
  // Check active polling vs general button state
  const isExporting = isTriggeringExport || (activeExport && activeExport.status !== 'completed' && activeExport.status !== 'failed');

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 -ml-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                  <CheckSquare className="w-5 h-5 text-white" />
                </div>
                <h1 className="font-bold text-xl text-gray-900 tracking-tight hidden sm:block">FocusFlow</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeExport && activeExport.status === 'completed' && activeExportId === activeExport.id ? (
                <button 
                  onClick={() => handleDownload(activeExport.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl hover:bg-green-100 transition-all font-medium text-sm shadow-sm active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Download CSV</span>
                </button>
              ) : (
                <button 
                  onClick={handleExport}
                  disabled={isExporting as boolean}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium text-sm shadow-sm active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Project Header Area */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col lg:flex-row gap-8 justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{project.name}</h2>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border shrink-0 ${
                  isOwner ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                }`}>
                  {isOwner ? 'Owner' : 'Member'}
                </span>
              </div>
              <p className="text-gray-500 max-w-2xl leading-relaxed">
                {project.description || 'No description provided.'}
              </p>
            </div>
            
            <div className="flex flex-col gap-4 min-w-[300px]">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  Team Members ({project.members?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {project.members?.map((member) => (
                    <div 
                      key={member.id} 
                      title={`${member.user?.name} (${member.role})`}
                      className={`relative flex items-center justify-center w-10 h-10 rounded-full text-white font-bold shadow-sm ring-2 ring-white cursor-help transition-transform hover:scale-110 ${member.role === 'owner' ? 'bg-gradient-to-tr from-purple-500 to-indigo-500' : 'bg-gradient-to-tr from-indigo-400 to-blue-400'}`}
                    >
                      {member.user?.name.charAt(0).toUpperCase()}
                      {member.role === 'owner' && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center border-2 border-white text-[10px]">
                          ★
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {isOwner && (
                <form onSubmit={handleAddMember} className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder="Add user by email..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isAddingMember}
                    className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 border border-indigo-100 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Board Controls */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm w-full sm:w-auto overflow-x-auto">
            <div className="pl-3 pr-2 text-gray-400">
              <Filter className="w-4 h-4" />
            </div>
            {['all', 'high', 'medium', 'low'].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors whitespace-nowrap ${
                  priorityFilter === p
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Task</span>
          </button>
        </div>

        {/* Kanban Board */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden min-h-[600px] mb-8">
          <KanbanBoard 
            tasks={visibleTasks} 
            onTaskMove={(taskId, status) => {
              updateTaskStatus({ taskId, status, project_id: id! });
            }} 
          />
        </div>

        {/* Export History Module */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
          <button 
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="w-full px-6 md:px-8 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-bold text-gray-900">Export History</h3>
              {projectExports.length > 0 && (
                <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full border border-indigo-100">
                  {projectExports.length}
                </span>
              )}
            </div>
            {isHistoryOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          
          {isHistoryOpen && (
            <div className="px-6 md:px-8 pb-6 border-t border-gray-100 pt-4 bg-gray-50/30">
              {projectExports.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No exports found for this project.</p>
              ) : (
                <div className="space-y-3">
                  {/* If there's an active export polling that isn't in history yet, maybe show it, but history usually gets it if we invalidate */}
                  {projectExports.map((exp: ExportRecord) => (
                    <div key={exp.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 text-sm rounded-xl hover:border-indigo-200 transition-colors">
                      <div className="flex items-center gap-3">
                        {exp.status === 'completed' ? (
                          <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : exp.status === 'failed' ? (
                          <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900 capitalize">{exp.status} Export</p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {new Date(exp.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      {exp.status === 'completed' && exp.download_url && (
                        <button
                          onClick={() => handleDownload(exp.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg transition-colors border border-indigo-100"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create Task Modal */}
      {isTaskModalOpen && (
        <CreateTaskModal 
          projectId={id!} 
          members={project.members || []} 
          onClose={() => setIsTaskModalOpen(false)} 
        />
      )}
    </div>
  );
};

const CreateTaskModal = ({ 
  projectId, 
  members, 
  onClose 
}: { 
  projectId: string; 
  members: ProjectMember[]; 
  onClose: () => void;
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [assignee, setAssignee] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  
  const { mutate: createTask, isPending, error } = useCreateTask();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTask({
      project_id: projectId,
      title,
      description,
      priority,
      assigned_to: assignee || null,
      due_date: dueDate || null,
    }, {
      onSuccess: () => onClose(),
    });
  };

  const errMessage = (error as any)?.response?.data?.error?.message || (error as Error)?.message;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in border border-gray-100">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-xl font-bold text-gray-900">Create New Task</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50/80 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
              {errMessage || 'An error occurred'}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Task Title *</label>
              <input
                type="text"
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="What needs to be done?"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                placeholder="Add more details..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign To</label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="">Unassigned</option>
                {members.map((m: ProjectMember) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user?.name} ({m.user?.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
