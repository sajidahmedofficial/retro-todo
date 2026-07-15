// State management for Retro Skeuomorphic Planner

const STORAGE_KEY = 'retro_todo_tasks';
const SETTINGS_KEY = 'retro_todo_settings';

const DEFAULT_LABELS = ['Work', 'Personal', 'Urgent', 'Study'];

const DEFAULT_TASKS = [
  {
    id: 'default-1',
    title: 'Water the office plants',
    description: 'Give the ferns and succulents on the window sill some water.',
    dueDate: getRelativeDateString(0, 10), // due today at 10 AM
    priority: 'Low',
    status: 'Pending',
    labels: ['Personal'],
    subtasks: [
      { id: 'sub-1-1', title: 'Fill watering can', completed: true },
      { id: 'sub-1-2', title: 'Water window succulents', completed: false },
      { id: 'sub-1-3', title: 'Mist the ferns', completed: false }
    ],
    reminderLead: 10, // 10 minutes before
    createdAt: Date.now() - 3600000
  },
  {
    id: 'default-2',
    title: 'Finalize quarterly CSE presentation',
    description: 'Review slides and practice speech for the CSE department review.',
    dueDate: getRelativeDateString(3, 14), // due in 3 days at 2 PM
    priority: 'High',
    status: 'Pending',
    labels: ['Work', 'Urgent'],
    subtasks: [
      { id: 'sub-2-1', title: 'Outline key highlights', completed: true },
      { id: 'sub-2-2', title: 'Draft visual design assets', completed: true },
      { id: 'sub-2-3', title: 'Rehearse speech once', completed: false }
    ],
    reminderLead: 60, // 1 hour before
    createdAt: Date.now() - 7200000
  },
  {
    id: 'default-3',
    title: 'Explore Web Audio API dynamic synth',
    description: 'Build a synthesizer to play retro page-turn and pencil sounds.',
    dueDate: getRelativeDateString(-1, 17), // overdue yesterday at 5 PM
    priority: 'Medium',
    status: 'Pending',
    labels: ['Study'],
    subtasks: [
      { id: 'sub-3-1', title: 'Read MDN docs on OscillatorNode', completed: true },
      { id: 'sub-3-2', title: 'Implement sound synthesizer code', completed: true }
    ],
    reminderLead: 1440, // 1 day before
    createdAt: Date.now() - 86400000
  }
];

function getRelativeDateString(offsetDays, hour) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  // Format to YYYY-MM-DDTHH:mm
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function getTasks() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    saveTasks(DEFAULT_TASKS);
    return DEFAULT_TASKS;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Error parsing tasks from local storage', e);
    return DEFAULT_TASKS;
  }
}

export function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function addTask(taskData) {
  const tasks = getTasks();
  const newTask = {
    id: 'task-' + Math.random().toString(36).substr(2, 9),
    title: taskData.title || 'Untitled Task',
    description: taskData.description || '',
    dueDate: taskData.dueDate || '',
    priority: taskData.priority || 'Low',
    status: 'Pending',
    labels: taskData.labels || [],
    subtasks: taskData.subtasks ? taskData.subtasks.map(t => ({
      id: 'sub-' + Math.random().toString(36).substr(2, 9),
      title: t,
      completed: false
    })) : [],
    reminderLead: taskData.reminderLead !== undefined ? parseInt(taskData.reminderLead) : 0,
    reminderFired: false,
    createdAt: Date.now()
  };
  tasks.push(newTask);
  saveTasks(tasks);
  return newTask;
}

export function updateTask(taskId, taskData) {
  const tasks = getTasks();
  const index = tasks.findIndex(t => t.id === taskId);
  if (index === -1) return null;

  const currentTask = tasks[index];
  
  // Update fields
  const updatedTask = {
    ...currentTask,
    ...taskData,
    // Reset reminder status if due date or lead time changed
    reminderFired: (taskData.dueDate !== undefined && taskData.dueDate !== currentTask.dueDate) || 
                   (taskData.reminderLead !== undefined && taskData.reminderLead !== currentTask.reminderLead) 
                   ? false : currentTask.reminderFired
  };

  // If subtasks are checked/unchecked or manually changed, update complete status
  if (updatedTask.subtasks && updatedTask.subtasks.length > 0) {
    const allCompleted = updatedTask.subtasks.every(s => s.completed);
    if (allCompleted) {
      updatedTask.status = 'Completed';
    } else if (updatedTask.status === 'Completed') {
      // If parent was completed but a subtask is now unchecked, revert status
      updatedTask.status = 'Pending';
    }
  }

  tasks[index] = updatedTask;
  saveTasks(tasks);
  return updatedTask;
}

export function deleteTask(taskId) {
  const tasks = getTasks();
  const filtered = tasks.filter(t => t.id !== taskId);
  saveTasks(filtered);
  return true;
}

export function toggleTaskStatus(taskId) {
  const tasks = getTasks();
  const index = tasks.findIndex(t => t.id === taskId);
  if (index === -1) return null;

  const current = tasks[index];
  const newStatus = current.status === 'Completed' ? 'Pending' : 'Completed';
  
  current.status = newStatus;
  
  // If completed, check off all subtasks
  if (newStatus === 'Completed' && current.subtasks) {
    current.subtasks.forEach(s => s.completed = true);
  } else if (newStatus === 'Pending' && current.subtasks && current.subtasks.every(s => s.completed)) {
    // If pending and all subtasks were completed, uncheck them all (or just keep them. Let's uncheck them to let user redo)
    current.subtasks.forEach(s => s.completed = false);
  }

  tasks[index] = current;
  saveTasks(tasks);
  return current;
}

// Subtask specific methods
export function addSubtask(taskId, title) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  const newSub = {
    id: 'sub-' + Math.random().toString(36).substr(2, 9),
    title: title,
    completed: false
  };

  task.subtasks = task.subtasks || [];
  task.subtasks.push(newSub);
  task.status = 'Pending'; // since a new incomplete subtask is added
  saveTasks(tasks);
  return task;
}

export function toggleSubtask(taskId, subtaskId) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  const sub = task.subtasks.find(s => s.id === subtaskId);
  if (!sub) return null;

  sub.completed = !sub.completed;

  // Auto-complete parent task if all subtasks are completed
  const allDone = task.subtasks.every(s => s.completed);
  if (allDone) {
    task.status = 'Completed';
  } else {
    task.status = 'Pending';
  }

  saveTasks(tasks);
  return task;
}

export function deleteSubtask(taskId, subtaskId) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
  
  // Re-evaluate parent task completion status
  if (task.subtasks.length > 0) {
    const allDone = task.subtasks.every(s => s.completed);
    task.status = allDone ? 'Completed' : 'Pending';
  }

  saveTasks(tasks);
  return task;
}

// Postpone / Reschedule
export function postponeTask(taskId, mode, customDate = '') {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  let newDate = new Date(task.dueDate || new Date());
  
  // If the due date was invalid or empty, set to today
  if (isNaN(newDate.getTime())) {
    newDate = new Date();
  }

  if (mode === '1h') {
    newDate.setHours(newDate.getHours() + 1);
  } else if (mode === 'tomorrow') {
    newDate.setDate(newDate.getDate() + 1);
  } else if (mode === 'nextweek') {
    newDate.setDate(newDate.getDate() + 7);
  } else if (mode === 'custom' && customDate) {
    newDate = new Date(customDate);
  }

  // Format to string
  const yyyy = newDate.getFullYear();
  const mm = String(newDate.getMonth() + 1).padStart(2, '0');
  const dd = String(newDate.getDate()).padStart(2, '0');
  const hh = String(newDate.getHours()).padStart(2, '0');
  const min = String(newDate.getMinutes()).padStart(2, '0');
  
  task.dueDate = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  task.reminderFired = false; // Reset reminder

  saveTasks(tasks);
  return task;
}

// Settings management
export function getSettings() {
  const data = localStorage.getItem(SETTINGS_KEY);
  const defaults = {
    muted: false,
    volume: 0.5,
    notificationsEnabled: false,
    theme: 'wood-leather'
  };

  if (!data) {
    return defaults;
  }
  try {
    return { ...defaults, ...JSON.parse(data) };
  } catch (e) {
    return defaults;
  }
}

export function saveSettings(settings) {
  const current = getSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

// Helper to get custom labels (defaults + any new labels created by user)
export function getLabels() {
  const tasks = getTasks();
  const labelsSet = new Set(DEFAULT_LABELS);
  tasks.forEach(t => {
    if (t.labels) {
      t.labels.forEach(l => labelsSet.add(l));
    }
  });
  return Array.from(labelsSet);
}
