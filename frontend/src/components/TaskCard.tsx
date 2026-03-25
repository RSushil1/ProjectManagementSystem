import { useDraggable } from '@dnd-kit/core';
import type { Task } from '../types/api';
import { Calendar, AlertCircle } from 'lucide-react';

interface TaskCardProps {
  task: Task;
}

export const TaskCard = ({ task }: TaskCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const priorityColors = {
    low: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    high: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white p-4 rounded-xl border sm:cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all ${
        isDragging ? 'opacity-50 border-indigo-500 shadow-xl scale-105 z-50 relative' : 'border-gray-200'
      }`}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <h4 className="font-semibold text-gray-900 leading-tight line-clamp-2">
          {task.title}
        </h4>
        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border shrink-0 ${priorityColors[task.priority]}`}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>
      
      {task.description && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-4">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-4 flex-wrap gap-2 text-xs text-gray-500 border-t border-gray-50 pt-3">
        {task.assignee ? (
          <div className="flex items-center gap-1.5" title="Assignee">
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-[10px] shadow-sm">
              {task.assignee.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium truncate max-w-[80px]">{task.assignee.name.split(' ')[0]}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-gray-400">
            <div className="w-5 h-5 rounded-full bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
              <span className="text-lg pb-1">+</span>
            </div>
            <span>Unassigned</span>
          </div>
        )}

        {task.due_date && (
          <div className={`flex items-center gap-1 font-medium ${new Date(task.due_date) < new Date() ? 'text-red-500' : ''}`}>
            {new Date(task.due_date) < new Date() ? <AlertCircle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
            {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  );
};
