// Notification and Alarm Scheduler for Retro Skeuomorphic Planner
import { getTasks, updateTask, getSettings } from './state.js';
import { startAlarm } from './audio.js';

let checkInterval = null;
let activeAlarmTaskId = null;
let onAlarmTriggeredCallback = null;

export function initNotifications(onAlarmTriggered) {
  onAlarmTriggeredCallback = onAlarmTriggered;
  
  // Start checking for reminders every 10 seconds
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(checkReminders, 10000);
  
  // Run an immediate check on startup
  checkReminders();
}

export function requestNotificationPermission() {
  if (!('Notification' in window)) return Promise.resolve(false);
  
  return Notification.requestPermission().then(permission => {
    return permission === 'granted';
  });
}

function checkReminders() {
  const tasks = getTasks();
  const now = Date.now();
  
  tasks.forEach(task => {
    if (task.status === 'Completed' || !task.dueDate || task.reminderFired) {
      return;
    }
    
    const dueTime = new Date(task.dueDate).getTime();
    if (isNaN(dueTime)) return;
    
    // Calculate trigger time based on reminder lead minutes (e.g. 10m before)
    const leadTimeMs = (task.reminderLead || 0) * 60 * 1000;
    const triggerTime = dueTime - leadTimeMs;
    
    // Fire if we are past the trigger time, but not overdue by more than 15 minutes (to avoid old alarms on reload)
    if (now >= triggerTime && now < dueTime + 900000) {
      triggerAlarm(task);
    }
  });
}

function triggerAlarm(task) {
  // Mark as fired so it doesn't trigger repeatedly
  updateTask(task.id, { reminderFired: true });
  
  // Start the physical synthesised alarm sound
  startAlarm();
  activeAlarmTaskId = task.id;
  
  // Trigger callback to animate the alarm clock in UI and show snooze card
  if (onAlarmTriggeredCallback) {
    onAlarmTriggeredCallback(task);
  }
  
  // Send native browser notification if enabled
  const settings = getSettings();
  if (settings.notificationsEnabled && Notification.permission === 'granted') {
    let bodyText = `Due at ${formatTime(task.dueDate)}`;
    if (task.reminderLead > 0) {
      bodyText = `Reminder: Due in ${task.reminderLead} minutes (at ${formatTime(task.dueDate)})`;
    }
    
    const notification = new Notification(`Task Reminder: ${task.title}`, {
      body: bodyText,
      icon: 'favicon.ico', // fallback
      tag: 'task-reminder-' + task.id,
      requireInteraction: true
    });
    
    notification.onclick = function() {
      window.focus();
      notification.close();
    };
  }
}

export function getActiveAlarmTaskId() {
  return activeAlarmTaskId;
}

export function clearActiveAlarm() {
  activeAlarmTaskId = null;
}

// Simple time formatter
function formatTime(dateTimeStr) {
  try {
    const d = new Date(dateTimeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return dateTimeStr;
  }
}
