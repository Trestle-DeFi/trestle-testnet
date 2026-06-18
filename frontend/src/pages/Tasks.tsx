import { useState, useEffect } from "react";
import { useContracts } from "../hooks/useContracts";
import { api } from "../lib/api";

interface Task {
  id: number;
  title: string;
  desc: string;
  reward: string;
  type: string;
  active: boolean;
}

interface CompletedTask {
  task_id: number;
  title: string;
  reward: string;
  completed_at: string;
}

export default function Tasks() {
  const { address, isConnected } = useContracts();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<CompletedTask[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    api<Task[]>("/api/tasks").then(t => setTasks(t.filter(t => t.active))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!address) return;
    api<CompletedTask[]>(`/api/users/${address}/completed`).then(setCompleted).catch(() => {});
  }, [address]);

  const completeIds = new Set(completed.map(c => c.task_id));

  const handleComplete = async (taskId: number) => {
    if (!address || busy !== null) return;
    setBusy(taskId);
    try {
      await api(`/api/users/${address}/complete-task`, {
        method: "POST",
        body: JSON.stringify({ taskId }),
      });
      setCompleted(prev => [...prev, { task_id: taskId, title: "", reward: "", completed_at: new Date().toISOString() }]);
    } catch (e: any) {
      alert(e.message);
    }
    setBusy(null);
  };

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">🔐</div>
        <p className="text-gray-500">Connect wallet to view tasks</p>
      </div>
    );
  }

  const todayCompleted = completed.filter(c => {
    const d = new Date(c.completed_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <span className="text-xs text-gray-500">{todayCompleted} completed today</span>
      </div>
      <p className="text-xs text-gray-500">Complete tasks to earn hNOBT points. Tasks reset daily.</p>

      {tasks.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
          <p className="text-sm">No tasks available yet</p>
        </div>
      )}

      <div className="space-y-2">
        {tasks.map(task => {
          const done = completeIds.has(task.id);
          return (
            <div key={task.id} className={`bg-white rounded-xl border p-4 ${done ? "border-emerald-200 opacity-60" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm">{task.title}</h3>
                  {task.desc && <p className="text-[11px] text-gray-500 mt-0.5">{task.desc}</p>}
                </div>
                <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">+{task.reward} hNOBT</span>
              </div>
              <button
                onClick={() => handleComplete(task.id)}
                disabled={done || busy === task.id}
                className={`mt-2 w-full py-2 rounded-lg text-xs font-medium disabled:opacity-50 ${done ? "bg-gray-100 text-gray-400" : "bg-emerald-500 text-white hover:bg-emerald-600"}`}
              >
                {done ? "Completed" : busy === task.id ? "Completing..." : "Complete"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
