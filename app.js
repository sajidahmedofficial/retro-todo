// Core Application Controller for Retro Skeuomorphic Planner
import * as State from './state.js';
import * as Audio from './audio.js';
import * as Notifications from './notifications.js';
import { config } from './config.js';

// Application state
let currentFilterType = 'all'; // 'all', 'today', 'upcoming', 'overdue', or 'label'
let currentFilterValue = '';    // if filter type is 'label', holds label name
let currentView = 'journal';    // 'journal' or 'corkboard'
let editingTaskId = null;

// DOM Elements
const bodyEl = document.body;
const viewSwitchBtn = document.getElementById('view-switch-btn');
const volumeDial = document.getElementById('volume-dial');
const volumeSlider = document.getElementById('volume-slider');
const alarmClock = document.getElementById('alarm-clock');
const deskSearch = document.getElementById('desk-search');

// Journal elements
const leftPage = document.querySelector('.left-page');
const rightPage = document.querySelector('.right-page');
const rightPageContent = document.getElementById('right-page-content');
const leftPageFilters = document.getElementById('left-page-filters');
const floatingMemo = document.getElementById('floating-memo');

// Corkboard elements
const corkboardContainer = document.getElementById('corkboard-container');
const trashCanZone = document.getElementById('trash-can-zone');

// Modals
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const cancelTaskBtn = document.getElementById('cancel-task-btn');
const modalTitle = document.getElementById('modal-title');
const labelSelectorChips = document.getElementById('label-selector-chips');
const newLabelInput = document.getElementById('new-label-input');
const addNewLabelBtn = document.getElementById('add-new-label-btn');

// Alarm Modal
const alarmModal = document.getElementById('alarm-modal');
const alarmTaskTitle = document.getElementById('alarm-task-title');
const alarmDoneBtn = document.getElementById('alarm-done-btn');
const alarmSnooze10mBtn = document.getElementById('alarm-snooze-10m');
const alarmSnooze1hBtn = document.getElementById('alarm-snooze-1h');
const alarmSnooze1dBtn = document.getElementById('alarm-snooze-1d');

// Toast Notification container
const toastContainer = document.getElementById('toast-container');

// Temp form states
let selectedFormLabels = [];

// Typewriter Chat elements
const retroIntercom = document.getElementById('retro-intercom');
const intercomLed = document.getElementById('intercom-led');
const chatDrawer = document.getElementById('typewriter-chat-drawer');
const chatCloseBtn = document.getElementById('chat-close-btn');
const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatScrollArea = document.getElementById('chat-scroll-area');
const chatTypingStatus = document.getElementById('chat-typing-status');
const serverStatusDot = document.getElementById('server-status-dot');
const serverStatusText = document.getElementById('server-status-text');

let chatHistory = [];
let isChatThinking = false;
let isCheckingServerStatus = false;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // First user interaction setup for audio context
  document.addEventListener('click', () => {
    // Triggers Web Audio API init safely
    Audio.playPageFlip(); // silent or tiny sound depending on mute
  }, { once: true });
  
  initUI();
  renderApp();
  
  // Register Scheduler callback
  Notifications.initNotifications((task) => {
    // On alarm trigger
    alarmClock.classList.add('alarm-ringing');
    alarmTaskTitle.textContent = task.title;
    alarmModal.classList.add('active');
  });
});

function initUI() {
  const settings = State.getSettings();
  
  // Setup volume dial and mute states
  updateVolumeDial(settings.volume, settings.muted);
  volumeSlider.value = settings.volume;
  
  volumeDial.addEventListener('click', () => {
    const s = State.getSettings();
    const isMuted = !s.muted;
    State.saveSettings({ muted: isMuted });
    updateVolumeDial(s.volume, isMuted);
    
    // Play light click if unmuted
    if (!isMuted) {
      Audio.playScribble();
    }
    showToast(isMuted ? "Sounds muted" : "Sounds unmuted");
  });
  
  volumeSlider.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value);
    State.saveSettings({ volume: vol, muted: vol === 0 });
    updateVolumeDial(vol, vol === 0);
  });
  
  // Setup View Toggle Switch
  viewSwitchBtn.addEventListener('click', () => {
    currentView = currentView === 'journal' ? 'corkboard' : 'journal';
    Audio.playPageFlip();
    
    if (currentView === 'corkboard') {
      bodyEl.classList.add('corkboard-active');
      document.getElementById('journal-panel').classList.remove('active');
      document.getElementById('corkboard-panel').classList.add('active');
      showToast("Switched to Corkboard view");
    } else {
      bodyEl.classList.remove('corkboard-active');
      document.getElementById('journal-panel').classList.add('active');
      document.getElementById('corkboard-panel').classList.remove('active');
      showToast("Switched to Journal view");
    }
    renderApp();
  });
  
  // Live search input handler
  deskSearch.addEventListener('input', (e) => {
    if (e.target.value.length === 1) {
      Audio.playScribble();
    }
    if (currentView === 'journal') {
      renderJournalTasks();
    } else {
      renderCorkboardTasks();
    }
  });

  // Open task creation modal
  floatingMemo.addEventListener('click', () => {
    openTaskModal();
  });
  
  // Modal Close
  cancelTaskBtn.addEventListener('click', () => {
    taskModal.classList.remove('active');
  });
  
  // Submit Task Form
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-desc').value.trim();
    const dueDate = document.getElementById('task-due-date').value;
    const priority = document.getElementById('task-priority').value;
    const reminderLead = document.getElementById('task-reminder-lead').value;
    
    if (!title) return;
    
    const taskData = {
      title,
      description,
      dueDate,
      priority,
      reminderLead,
      labels: selectedFormLabels
    };
    
    if (editingTaskId) {
      State.updateTask(editingTaskId, taskData);
      showToast("Task updated");
      Audio.playStamp();
    } else {
      State.addTask(taskData);
      showToast("New Memo Written");
      // Animate pen pencil lines writing if desired, just play sound
      Audio.playScribble();
    }
    
    taskModal.classList.remove('active');
    renderApp();
  });
  
  // Click alarm clock to manually stop ringing
  alarmClock.addEventListener('click', () => {
    if (alarmClock.classList.contains('alarm-ringing')) {
      stopRingingAlarm();
      showToast("Alarm Snoozed");
    } else {
      // If not ringing, prompt browser notifications permission
      Notifications.requestNotificationPermission().then(granted => {
        State.saveSettings({ notificationsEnabled: granted });
        showToast(granted ? "Reminders active!" : "Notification blocked");
      });
    }
  });
  
  // Alarm Modal Snoozes
  alarmDoneBtn.addEventListener('click', () => {
    const taskId = Notifications.getActiveAlarmTaskId();
    if (taskId) {
      State.toggleTaskStatus(taskId);
      Audio.playCheck();
      showToast("Task Completed");
    }
    stopRingingAlarm();
  });
  
  alarmSnooze10mBtn.addEventListener('click', () => {
    snoozeActiveAlarm('1h'); // Using 1h or tomorrow as standard quick snooze
    showToast("Snoozed by 1 hour");
  });
  
  alarmSnooze1hBtn.addEventListener('click', () => {
    snoozeActiveAlarm('tomorrow');
    showToast("Snoozed to tomorrow");
  });
  
  alarmSnooze1dBtn.addEventListener('click', () => {
    snoozeActiveAlarm('nextweek');
    showToast("Snoozed to next week");
  });
  
  // Add new custom label inside modal
  addNewLabelBtn.addEventListener('click', () => {
    const labelText = newLabelInput.value.trim();
    if (labelText && !selectedFormLabels.includes(labelText)) {
      selectedFormLabels.push(labelText);
      newLabelInput.value = '';
      renderLabelSelectorChips();
      Audio.playScribble();
    }
  });
  
  // Setup drag and drop for Trash Can
  trashCanZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    trashCanZone.style.transform = 'scale(1.1)';
  });
  
  trashCanZone.addEventListener('dragleave', () => {
    trashCanZone.style.transform = 'scale(1)';
  });
  
  trashCanZone.addEventListener('drop', (e) => {
    e.preventDefault();
    trashCanZone.style.transform = 'scale(1)';
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      deleteTaskWithAnimation(taskId);
    }
  });
  
  trashCanZone.addEventListener('click', () => {
    showToast("Drag task notes here to crumble them!");
  });

  // Connect Retro Intercom & Typewriter Chat behavior
  if (retroIntercom) {
    retroIntercom.addEventListener('click', () => {
      chatDrawer.classList.toggle('active');
      if (chatDrawer.classList.contains('active')) {
        chatInput.focus();
        Audio.playPageFlip();
      } else {
        Audio.playPageFlip();
      }
    });
  }

  if (chatCloseBtn) {
    chatCloseBtn.addEventListener('click', () => {
      chatDrawer.classList.remove('active');
      Audio.playPageFlip();
    });
  }

  if (chatSendBtn && chatInput) {
    chatSendBtn.addEventListener('click', () => {
      sendChatMessage();
    });

    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    });
  }

  // Start periodic status check for the server
  checkServerStatus();
  setInterval(checkServerStatus, 5000);
}

function updateVolumeDial(vol, isMuted) {
  if (isMuted) {
    volumeDial.style.transform = 'rotate(-90deg)';
  } else {
    // Map volume 0..1 to angle -60 to 180 degrees
    const angle = -60 + vol * 240;
    volumeDial.style.transform = `rotate(${angle}deg)`;
  }
}

function snoozeActiveAlarm(mode) {
  const taskId = Notifications.getActiveAlarmTaskId();
  if (taskId) {
    State.postponeTask(taskId, mode);
    Audio.playStamp();
  }
  stopRingingAlarm();
}

function stopRingingAlarm() {
  Audio.stopAlarm();
  alarmClock.classList.remove('alarm-ringing');
  alarmModal.classList.remove('active');
  Notifications.clearActiveAlarm();
  renderApp();
}

function renderApp() {
  renderLeftPageFilters();
  
  if (currentView === 'journal') {
    renderJournalTasks();
  } else {
    renderCorkboardTasks();
  }
}

// ---------------------------------------------------------
// RENDERING LEFT PAGE FILTERS & LABELS
// ---------------------------------------------------------
function renderLeftPageFilters() {
  const tasks = State.getTasks();
  const labels = State.getLabels();
  
  // Counts
  const counts = {
    all: tasks.length,
    today: 0,
    upcoming: 0,
    overdue: 0
  };
  
  const labelCounts = {};
  labels.forEach(l => labelCounts[l] = 0);
  
  const now = new Date();
  now.setHours(0,0,0,0);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  tasks.forEach(t => {
    if (t.status === 'Completed') return;
    
    if (t.dueDate) {
      const d = new Date(t.dueDate);
      if (d < now) {
        counts.overdue++;
      } else if (d >= now && d < tomorrow) {
        counts.today++;
      } else {
        counts.upcoming++;
      }
    }
    
    if (t.labels) {
      t.labels.forEach(l => {
        if (labelCounts[l] !== undefined) {
          labelCounts[l]++;
        }
      });
    }
  });
  
  let html = `
    <li class="index-card ${currentFilterType === 'all' ? 'active' : ''}" data-filter="all">
      <span>📓 All Memos</span>
      <span class="badge">${counts.all}</span>
    </li>
    <li class="index-card ${currentFilterType === 'today' ? 'active' : ''}" data-filter="today">
      <span>⏰ Due Today</span>
      <span class="badge ${counts.today > 0 ? 'badge-red' : ''}">${counts.today}</span>
    </li>
    <li class="index-card ${currentFilterType === 'upcoming' ? 'active' : ''}" data-filter="upcoming">
      <span>📅 Upcoming</span>
      <span class="badge">${counts.upcoming}</span>
    </li>
    <li class="index-card ${currentFilterType === 'overdue' ? 'active' : ''}" data-filter="overdue">
      <span>⚠️ Overdue</span>
      <span class="badge badge-red">${counts.overdue}</span>
    </li>
  `;
  
  html += `<div class="notebook-sub-header">🏷️ Categories</div>`;
  
  labels.forEach(label => {
    const isActive = currentFilterType === 'label' && currentFilterValue === label;
    html += `
      <li class="index-card ${isActive ? 'active' : ''}" data-filter="label" data-value="${label}">
        <span>📌 ${label}</span>
        <span class="badge">${labelCounts[label] || 0}</span>
      </li>
    `;
  });
  
  leftPageFilters.innerHTML = html;
  
  // Attach Filter Listeners
  leftPageFilters.querySelectorAll('.index-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const target = e.currentTarget;
      const type = target.dataset.filter;
      const val = target.dataset.value || '';
      
      if (currentFilterType === type && currentFilterValue === val) return;
      
      // Page Flip Animation
      rightPageContent.classList.add('page-animating');
      Audio.playPageFlip();
      
      setTimeout(() => {
        currentFilterType = type;
        currentFilterValue = val;
        renderLeftPageFilters();
        if (currentView === 'journal') {
          renderJournalTasks();
        } else {
          renderCorkboardTasks();
        }
        rightPageContent.classList.remove('page-animating');
      }, 350);
    });
  });
}

// Filter tasks helper
function getFilteredTasks() {
  const tasks = State.getTasks();
  const now = new Date();
  now.setHours(0,0,0,0);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  let filtered = tasks.filter(t => {
    if (currentFilterType === 'all') return true;
    
    if (currentFilterType === 'today') {
      if (!t.dueDate || t.status === 'Completed') return false;
      const d = new Date(t.dueDate);
      return d >= now && d < tomorrow;
    }
    
    if (currentFilterType === 'upcoming') {
      if (!t.dueDate || t.status === 'Completed') return false;
      const d = new Date(t.dueDate);
      return d >= tomorrow;
    }
    
    if (currentFilterType === 'overdue') {
      if (!t.dueDate || t.status === 'Completed') return false;
      const d = new Date(t.dueDate);
      return d < now;
    }
    
    if (currentFilterType === 'label') {
      return t.labels && t.labels.includes(currentFilterValue);
    }
    
    return true;
  });

  // Apply search query filter
  const query = deskSearch ? deskSearch.value.toLowerCase().trim() : '';
  if (query) {
    filtered = filtered.filter(t => 
      t.title.toLowerCase().includes(query) || 
      t.description.toLowerCase().includes(query) ||
      (t.labels && t.labels.some(l => l.toLowerCase().includes(query)))
    );
  }
  
  return filtered;
}

// ---------------------------------------------------------
// JOURNAL TASKS LIST VIEW
// ---------------------------------------------------------
function renderJournalTasks() {
  const filtered = getFilteredTasks();
  
  if (filtered.length === 0) {
    rightPageContent.innerHTML = `
      <div style="font-family: var(--font-hand); font-size: 1.8rem; text-align: center; color: #888; padding-top: 80px;">
        No memos recorded here.
      </div>
    `;
    return;
  }
  
  let html = '<div class="task-list-scroller">';
  
  filtered.forEach(task => {
    const isCompleted = task.status === 'Completed';
    const subtaskCount = task.subtasks ? task.subtasks.length : 0;
    const completedSubtaskCount = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
    
    let progressStr = '';
    if (subtaskCount > 0) {
      progressStr = `<span class="progress-note">(${completedSubtaskCount}/${subtaskCount} done)</span>`;
    }
    
    // Format labels
    const labelHTML = task.labels ? task.labels.map(l => `<span style="font-size: 0.65rem; color:#555; background:#e8e4c9; border: 1px dashed #aaa; padding:1px 4px; border-radius:3px; margin-left:5px;">${l}</span>`).join('') : '';
    
    html += `
      <div class="task-container" id="task-container-${task.id}">
        <div class="task-item ${isCompleted ? 'completed' : ''}" data-id="${task.id}">
          <div class="task-content-wrap">
            <div class="sketch-checkbox" data-id="${task.id}"></div>
            <div class="task-title-line">
              ${task.title}
              ${labelHTML}
              <span class="priority-tag ${task.priority}">${task.priority}</span>
              ${progressStr}
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            ${task.dueDate ? `<span style="font-size: 0.9rem; color: #555;">${formatDueDate(task.dueDate)}</span>` : ''}
            <span style="font-size: 0.95rem; cursor: pointer; padding: 2px;" class="task-options-trigger">⚙️</span>
          </div>
        </div>
        
        <!-- Expanded Subtasks Panel -->
        <div class="subtasks-panel" id="subtasks-${task.id}">
          <div style="font-size: 1.1rem; color: #555; margin-bottom: 8px; border-bottom: 1px dashed rgba(0,0,0,0.1); padding-bottom: 2px;">
            ${task.description || 'No description provided.'}
          </div>
          
          <div class="subtasks-list">
            ${task.subtasks ? task.subtasks.map(sub => `
              <div class="subtask-item" data-task-id="${task.id}" data-sub-id="${sub.id}">
                <div class="sketch-checkbox ${sub.completed ? 'completed' : ''}" style="width: 16px; height: 16px;"></div>
                <span class="${sub.completed ? 'completed-text' : ''}" style="${sub.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                  ${sub.title}
                </span>
                <span class="delete-subtask-btn" style="margin-left: auto; font-size: 0.9rem; opacity: 0.5; cursor: pointer;" data-task-id="${task.id}" data-sub-id="${sub.id}">❌</span>
              </div>
            `).join('') : ''}
          </div>
          
          <!-- Add Subtask inline -->
          <div style="display: flex; margin-top: 10px; gap: 5px;">
            <input type="text" class="subtask-input form-input" style="font-size: 1.1rem; padding: 3px 6px; flex: 1;" placeholder="New checklist item..." data-id="${task.id}">
            <button class="btn btn-primary add-subtask-btn" style="padding: 3px 10px; font-size: 0.8rem;" data-id="${task.id}">Add</button>
          </div>
          
          <!-- Detail Actions (Stamp & Delete) -->
          <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 12px; gap: 10px; border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 10px;">
            <span style="font-family: var(--font-type); font-size: 0.75rem; color:#888;">Stamp:</span>
            <button class="stamp-btn postpone-stamp-btn" style="padding: 2px 6px; font-size: 0.65rem;" data-id="${task.id}" data-mode="1h">Snooze 1h</button>
            <button class="stamp-btn postpone-stamp-btn" style="padding: 2px 6px; font-size: 0.65rem;" data-id="${task.id}" data-mode="tomorrow">Tomorrow</button>
            <button class="stamp-btn postpone-stamp-btn" style="padding: 2px 6px; font-size: 0.65rem;" data-id="${task.id}" data-mode="nextweek">Next Week</button>
            
            <button class="btn btn-secondary edit-task-btn" style="padding: 3px 10px; font-size: 0.8rem;" data-id="${task.id}">Edit</button>
            <button class="btn btn-secondary delete-task-btn" style="padding: 3px 10px; font-size: 0.8rem; background:#ffccd5; border-color:#d99; color:#622;" data-id="${task.id}">Crumple</button>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  rightPageContent.innerHTML = html;
  
  // Attach Event Listeners to List View
  attachJournalEventListeners();
}

function attachJournalEventListeners() {
  // Toggle Parent complete status (click checkbox)
  rightPageContent.querySelectorAll('.task-item .sketch-checkbox').forEach(box => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = e.currentTarget.dataset.id;
      State.toggleTaskStatus(taskId);
      Audio.playCheck();
      renderApp();
    });
  });
  
  // Toggle details dropdown (click task item bar)
  rightPageContent.querySelectorAll('.task-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't expand if click was on settings wheel or checkbox
      if (e.target.classList.contains('sketch-checkbox') || e.target.classList.contains('task-options-trigger')) return;
      
      const taskId = e.currentTarget.dataset.id;
      const isExpanded = e.currentTarget.classList.contains('expanded');
      
      // Collapse others, expand this
      rightPageContent.querySelectorAll('.task-item').forEach(t => {
        t.classList.remove('expanded');
      });
      
      if (!isExpanded) {
        e.currentTarget.classList.add('expanded');
        Audio.playScribble();
      }
    });
  });
  
  // Toggle subtask status
  rightPageContent.querySelectorAll('.subtask-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-subtask-btn')) return;
      
      const taskId = e.currentTarget.dataset.taskId;
      const subId = e.currentTarget.dataset.subId;
      State.toggleSubtask(taskId, subId);
      Audio.playCheck();
      renderApp();
    });
  });
  
  // Add subtask inline input (Enter key)
  rightPageContent.querySelectorAll('.subtask-input').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const taskId = e.target.dataset.id;
        const val = e.target.value.trim();
        if (val) {
          State.addSubtask(taskId, val);
          Audio.playScribble();
          renderApp();
        }
      }
    });
  });
  
  // Add subtask inline (Button)
  rightPageContent.querySelectorAll('.add-subtask-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.target.dataset.id;
      const input = rightPageContent.querySelector(`.subtask-input[data-id="${taskId}"]`);
      const val = input.value.trim();
      if (val) {
        State.addSubtask(taskId, val);
        Audio.playScribble();
        renderApp();
      }
    });
  });
  
  // Delete subtask
  rightPageContent.querySelectorAll('.delete-subtask-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.target.dataset.taskId;
      const subId = e.target.dataset.subId;
      if (confirm('Delete this checklist item?')) {
        State.deleteSubtask(taskId, subId);
        Audio.playCrumple();
        renderApp();
      }
    });
  });
  
  // Edit Task button
  rightPageContent.querySelectorAll('.edit-task-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.target.dataset.id;
      openTaskModal(taskId);
    });
  });
  
  // Delete Task button (Crumple)
  rightPageContent.querySelectorAll('.delete-task-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.target.dataset.id;
      deleteTaskWithAnimation(taskId);
    });
  });
  
  // Postpone stamp buttons
  rightPageContent.querySelectorAll('.postpone-stamp-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.target.dataset.id;
      const mode = e.target.dataset.mode;
      State.postponeTask(taskId, mode);
      Audio.playStamp();
      showToast(`Stamped: Rescheduled!`);
      renderApp();
    });
  });
}

// ---------------------------------------------------------
// CORKBOARD VIEW (PINNED CARDS)
// ---------------------------------------------------------
function renderCorkboardTasks() {
  const filtered = getFilteredTasks();
  
  if (filtered.length === 0) {
    corkboardContainer.innerHTML = `
      <div style="grid-column: 1/-1; font-family: var(--font-hand); font-size: 1.8rem; text-align: center; color: #5a3825; padding-top: 100px;">
        Corkboard is currently empty.
      </div>
    `;
    return;
  }
  
  let html = '';
  
  filtered.forEach(task => {
    const isCompleted = task.status === 'Completed';
    // Generate random rot angle between -4deg and 4deg for realistic messy pinup
    const rot = (Math.random() * 8 - 4).toFixed(1);
    
    // Stamp overlay if completed or postponed
    let stampHTML = '';
    if (isCompleted) {
      stampHTML = `<div class="distressed-stamp">COMPLETED</div>`;
    }
    
    const subtaskCount = task.subtasks ? task.subtasks.length : 0;
    const completedSubCount = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
    
    html += `
      <div class="sticky-note ${isCompleted ? 'Completed' : task.priority}" 
           style="transform: rotate(${rot}deg);" 
           draggable="true" 
           data-id="${task.id}">
        
        <div class="pushpin"></div>
        ${stampHTML}
        
        <div class="sticky-title">${task.title}</div>
        
        <div class="sticky-desc">${task.description || ''}</div>
        
        ${subtaskCount > 0 ? `
          <div style="font-family: var(--font-hand); font-size: 1rem; color: #555; margin-bottom: 5px; font-weight: bold;">
            📋 checklist: ${completedSubCount}/${subtaskCount}
          </div>
        ` : ''}
        
        <div class="sticky-footer">
          <div class="sticky-due">
            ${task.dueDate ? `📅 ${formatDueDateShort(task.dueDate)}` : 'No date'}
          </div>
          <button class="sketch-checkbox" data-id="${task.id}" style="width: 18px; height: 18px; ${isCompleted ? 'opacity: 0.5;' : ''}"></button>
        </div>
      </div>
    `;
  });
  
  corkboardContainer.innerHTML = html;
  
  attachCorkboardEventListeners();
}

function attachCorkboardEventListeners() {
  // Toggle complete from board
  corkboardContainer.querySelectorAll('.sketch-checkbox').forEach(box => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = e.currentTarget.dataset.id;
      State.toggleTaskStatus(taskId);
      Audio.playCheck();
      renderApp();
    });
  });
  
  // Double click sticky note to edit
  corkboardContainer.querySelectorAll('.sticky-note').forEach(note => {
    note.addEventListener('dblclick', (e) => {
      const taskId = e.currentTarget.dataset.id;
      openTaskModal(taskId);
    });
    
    // Drag start
    note.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', e.currentTarget.dataset.id);
      e.currentTarget.style.opacity = '0.4';
    });
    
    note.addEventListener('dragend', (e) => {
      e.currentTarget.style.opacity = '1';
    });
  });
}

// ---------------------------------------------------------
// TASK CREATE/EDIT MODAL
// ---------------------------------------------------------
function openTaskModal(taskId = null) {
  editingTaskId = taskId;
  taskForm.reset();
  selectedFormLabels = [];
  
  if (taskId) {
    // Edit Mode
    const tasks = State.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    modalTitle.textContent = "✍️ Edit Memo Details";
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-desc').value = task.description || '';
    document.getElementById('task-due-date').value = task.dueDate || '';
    document.getElementById('task-priority').value = task.priority;
    document.getElementById('task-reminder-lead').value = task.reminderLead || 0;
    
    selectedFormLabels = task.labels ? [...task.labels] : [];
  } else {
    // New Mode
    modalTitle.textContent = "✍️ Write New Memo";
    // Set default due date to 1 hour from now
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    const yyyy = nextHour.getFullYear();
    const mm = String(nextHour.getMonth() + 1).padStart(2, '0');
    const dd = String(nextHour.getDate()).padStart(2, '0');
    const hh = String(nextHour.getHours()).padStart(2, '0');
    document.getElementById('task-due-date').value = `${yyyy}-${mm}-${dd}T${hh}:00`;
  }
  
  renderLabelSelectorChips();
  taskModal.classList.add('active');
  Audio.playPageFlip();
}

function renderLabelSelectorChips() {
  const allLabels = State.getLabels();
  let html = '';
  
  allLabels.forEach(l => {
    const isSelected = selectedFormLabels.includes(l);
    html += `
      <span class="chip ${isSelected ? 'selected' : ''}" data-label="${l}">
        ${l}
      </span>
    `;
  });
  
  labelSelectorChips.innerHTML = html;
  
  // Attach select listeners
  labelSelectorChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const label = e.currentTarget.dataset.label;
      const index = selectedFormLabels.indexOf(label);
      if (index === -1) {
        selectedFormLabels.push(label);
      } else {
        selectedFormLabels.splice(index, 1);
      }
      renderLabelSelectorChips();
      Audio.playScribble();
    });
  });
}

// ---------------------------------------------------------
// ANIMATED TASK DELETION (CRUMPLE PAPER)
// ---------------------------------------------------------
function deleteTaskWithAnimation(taskId) {
  const container = document.getElementById(`task-container-${taskId}`);
  const card = corkboardContainer.querySelector(`.sticky-note[data-id="${taskId}"]`);
  
  const elementToAnimate = container || card;
  
  if (elementToAnimate) {
    // Play sound
    Audio.playCrumple();
    
    // Add page crumble shrink/rotate animation
    elementToAnimate.style.transition = 'all 0.4s ease-in';
    elementToAnimate.style.transform = 'scale(0.1) rotate(45deg)';
    elementToAnimate.style.opacity = '0';
    
    setTimeout(() => {
      State.deleteTask(taskId);
      showToast("Memo crumpled & thrown away");
      renderApp();
    }, 400);
  } else {
    State.deleteTask(taskId);
    showToast("Memo crumpled & thrown away");
    renderApp();
  }
}

// ---------------------------------------------------------
// TOAST NOTIFICATIONS & DATE FORMATTERS
// ---------------------------------------------------------
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease-out';
    toast.style.transform = 'translateX(-30px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toastContainer.removeChild(toast);
    }, 300);
  }, 2500);
}

function formatDueDate(dateTimeStr) {
  try {
    const d = new Date(dateTimeStr);
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleDateString([], options);
  } catch (e) {
    return dateTimeStr;
  }
}

function formatDueDateShort(dateTimeStr) {
  try {
    const d = new Date(dateTimeStr);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch (e) {
    return dateTimeStr;
  }
}

// ---------------------------------------------------------
// VINTAGE TELE-PLANNER CHAT BACKEND INTEGRATION
// ---------------------------------------------------------
// Determine backend URL dynamically from config
const AI_BACKEND_URL = config.AI_BACKEND_URL;

async function checkServerStatus() {
  if (isCheckingServerStatus) return;
  isCheckingServerStatus = true;

  if (!AI_BACKEND_URL) {
    setServerOffline('OFFLINE (AI requires local server.py)');
    isCheckingServerStatus = false;
    return;
  }

  try {
    const res = await fetch(`${AI_BACKEND_URL}/api/status`);
    const data = await res.json();
    if (data.status === 'online') {
      intercomLed.className = 'intercom-led online';
      serverStatusDot.className = 'status-dot online';
      serverStatusText.textContent = `ONLINE (Gemini AI Active)`;
    } else {
      setServerOffline();
    }
  } catch (err) {
    setServerOffline();
  } finally {
    isCheckingServerStatus = false;
  }
}

function setServerOffline(msg) {
  if (intercomLed) intercomLed.className = 'intercom-led';
  if (serverStatusDot) serverStatusDot.className = 'status-dot';
  if (serverStatusText) serverStatusText.textContent = msg || 'OFFLINE (Run python server.py)';
}

async function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text || isChatThinking) return;

  chatInput.value = '';
  isChatThinking = true;

  // Add user bubble
  appendUserMessage(text);
  
  // Check if backend is available
  if (!AI_BACKEND_URL) {
    isChatThinking = false;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble system-message';
    bubble.innerHTML = `<span class="msg-sender">SYSTEM:</span> AI chat requires the Python backend running locally. Run 'python server.py' on your machine, then open http://localhost:3000 to use the AI assistant.`;
    chatLog.appendChild(bubble);
    chatScrollArea.scrollTop = chatScrollArea.scrollHeight;
    Audio.playTypewriterBell();
    return;
  }

  // Set intercom indicators to thinking
  if (intercomLed) intercomLed.className = 'intercom-led thinking';
  if (serverStatusDot) serverStatusDot.className = 'status-dot thinking';
  if (chatTypingStatus) chatTypingStatus.style.display = 'block';
  chatScrollArea.scrollTop = chatScrollArea.scrollHeight;

  // Play pencil sound
  Audio.playScribble();

  // Save turn to history
  chatHistory.push({ role: 'user', parts: [{ text: text }] });
  if (chatHistory.length > 20) {
    chatHistory.shift();
  }

  try {
    const res = await fetch(`${AI_BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text,
        tasks: State.getTasks(),
        history: chatHistory
      })
    });

    if (!res.ok) {
      // Remove last user message from history if failed
      chatHistory.pop();
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json();

    // Process actions
    if (data.actions && data.actions.length > 0) {
      processAIActions(data.actions);
    }

    // Hide indicator
    if (chatTypingStatus) chatTypingStatus.style.display = 'none';

    // Type the response
    await appendAiMessageAndType(data.response);

    // Save AI response to history
    chatHistory.push({ role: 'model', parts: [{ text: data.response }] });
    if (chatHistory.length > 20) {
      chatHistory.shift();
    }

  } catch (err) {
    console.error("AI Error:", err);
    if (chatTypingStatus) chatTypingStatus.style.display = 'none';
    showToast("AI Telegram connection failed");
    
    // Type system error message
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble system-message';
    bubble.innerHTML = `<span class="msg-sender">SYSTEM:</span> Error communicating with AI server. Make sure 'server.py' is running and active.`;
    chatLog.appendChild(bubble);
    chatScrollArea.scrollTop = chatScrollArea.scrollHeight;
    Audio.playTypewriterBell();
  } finally {
    isChatThinking = false;
    checkServerStatus(); // restore LED status
  }
}

function appendUserMessage(text) {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble user-message';
  
  const senderSpan = document.createElement('span');
  senderSpan.className = 'msg-sender';
  senderSpan.textContent = 'USER: ';
  bubble.appendChild(senderSpan);
  
  const textNode = document.createTextNode(text);
  bubble.appendChild(textNode);
  
  chatLog.appendChild(bubble);
  chatScrollArea.scrollTop = chatScrollArea.scrollHeight;
}

function processAIActions(actions) {
  let modified = false;
  actions.forEach(action => {
    if (action.type === 'ADD_TASK') {
      State.addTask(action.data);
      modified = true;
    } else if (action.type === 'UPDATE_TASK') {
      State.updateTask(action.data.id, action.data);
      modified = true;
    } else if (action.type === 'DELETE_TASK') {
      State.deleteTask(action.data.id);
      modified = true;
    }
  });

  if (modified) {
    showToast("Planner updated by AI Assistant");
    renderApp();
    Audio.playStamp();
  }
}

function appendAiMessageAndType(text) {
  return new Promise((resolve) => {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ai-message';
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'msg-sender';
    senderSpan.textContent = 'AI: ';
    bubble.appendChild(senderSpan);
    
    const textNode = document.createTextNode('');
    bubble.appendChild(textNode);
    chatLog.appendChild(bubble);
    
    let index = 0;
    
    // Play initial bell
    Audio.playTypewriterBell();
    
    function typeChar() {
      if (index < text.length) {
        const char = text[index];
        textNode.appendData(char);
        index++;
        
        if (char !== ' ' && char !== '\n') {
          Audio.playTypewriterKey();
        } else if (char === '\n') {
          Audio.playTypewriterBell();
        }
        
        chatScrollArea.scrollTop = chatScrollArea.scrollHeight;
        
        const delay = char === ',' || char === '.' || char === '?' || char === '!' ? 180 : 20 + Math.random() * 15;
        setTimeout(typeChar, delay);
      } else {
        Audio.playTypewriterBell();
        resolve();
      }
    }
    
    typeChar();
  });
}
