import React from 'react';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import type { Task } from '../types/api';
import { TaskCard } from './TaskCard';

interface ColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  status: Task['status'];
}

const Column = ({ title, tasks, status }: ColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'Column',
      status,
    },
  });

  return (
    <div className="flex flex-col bg-gray-50/50 border border-gray-200 rounded-2xl p-4 w-full md:min-w-[320px] max-w-[400px]">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="font-bold text-gray-700">{title}</h3>
        <span className="bg-white text-gray-500 text-xs font-bold px-2 py-1 rounded-full border border-gray-200 shadow-sm">
          {tasks.length}
        </span>
      </div>
      
      <div 
        ref={setNodeRef} 
        className={`flex-1 min-h-[500px] flex flex-col gap-3 transition-colors rounded-xl p-1 -mx-1 ${isOver ? 'bg-indigo-50/50 border-2 border-dashed border-indigo-200' : 'bg-transparent border-2 border-transparent'}`}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && !isOver && (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm font-medium border-2 border-dashed border-gray-200 rounded-xl my-4 opacity-50">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
};

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove: (taskId: string, newStatus: Task['status']) => void;
}

export const KanbanBoard = ({ tasks, onTaskMove }: KanbanBoardProps) => {
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const columns: { id: Task['status']; title: string }[] = [
    { id: 'todo', title: 'To Do' },
    { id: 'in_progress', title: 'In Progress' },
    { id: 'done', title: 'Done' },
  ];

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as Task['status'];
    
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
      onTaskMove(taskId, newStatus);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col md:flex-row gap-6 overflow-x-auto pb-4 items-start w-full">
        {columns.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            title={col.title}
            status={col.id}
            tasks={tasks.filter(t => t.status === col.id)}
          />
        ))}
      </div>
      
      <DragOverlay>
        {activeTask ? (
          <div className="opacity-90 shadow-2xl scale-105 rotate-2 cursor-grabbing rounded-xl bg-white isolate ring-2 ring-indigo-500">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
