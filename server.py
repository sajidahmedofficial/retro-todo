import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from google import genai
from google.genai import types

# Configurations
PORT = 5000
MODEL_NAME = 'gemini-3.5-flash'

# Setup Gemini Client (lazy initialization to allow server to start without key)
API_KEY = os.environ.get("GEMINI_API_KEY") or ""
_client = None

def get_client():
    global _client
    if _client is None:
        if not API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable is not set. Please set it and restart the server.")
        _client = genai.Client(api_key=API_KEY)
    return _client

# Global queue for actions dispatch to frontend in the current request
frontend_actions = []

# Define python functions as tools for Gemini automatic function calling
def add_todo_task(title: str, description: str = "", due_date: str = "", priority: str = "Medium", labels: list[str] = None) -> str:
    """Add a new task/memo to the planner. Use this when the user asks to add, write, record, or pin a new task.
    
    Args:
        title: The title or subject of the task (required).
        description: Details or notes about the task.
        due_date: The due date/time in YYYY-MM-DDTHH:mm format (e.g. '2026-07-18T09:00').
        priority: The priority of the task ('High', 'Medium', or 'Low').
        labels: List of tags/labels (e.g. ['Work', 'Personal']).
    """
    global frontend_actions
    action = {
        "type": "ADD_TASK",
        "data": {
            "title": title,
            "description": description,
            "dueDate": due_date,
            "priority": priority,
            "labels": labels or []
        }
    }
    frontend_actions.append(action)
    return f"Task '{title}' added successfully to frontend."

def update_todo_task(task_id: str, title: str = None, description: str = None, due_date: str = None, priority: str = None, labels: list[str] = None, status: str = None) -> str:
    """Update details of an existing task/memo in the planner. Use this to change status (complete/pending), reschedule due dates, update descriptions, add labels, or edit titles.
    
    Args:
        task_id: The ID of the task to update (required).
        title: The new title of the task.
        description: The new description of the task.
        due_date: The new due date/time in YYYY-MM-DDTHH:mm format.
        priority: The new priority ('High', 'Medium', 'Low').
        labels: The new list of labels.
        status: The new status of the task ('Pending' or 'Completed').
    """
    global frontend_actions
    data = {"id": task_id}
    if title is not None: data["title"] = title
    if description is not None: data["description"] = description
    if due_date is not None: data["dueDate"] = due_date
    if priority is not None: data["priority"] = priority
    if labels is not None: data["labels"] = labels
    if status is not None: data["status"] = status
    
    action = {
        "type": "UPDATE_TASK",
        "data": data
    }
    frontend_actions.append(action)
    return f"Task '{task_id}' updated successfully in frontend."

def delete_todo_task(task_id: str) -> str:
    """Delete (crumple) a task/memo from the planner. Use this when the user asks to delete, remove, or crumple a task.
    
    Args:
        task_id: The ID of the task to delete (required).
    """
    global frontend_actions
    action = {
        "type": "DELETE_TASK",
        "data": {"id": task_id}
    }
    frontend_actions.append(action)
    return f"Task '{task_id}' crumpled/deleted successfully in frontend."


def convert_history(frontend_history, latest_message):
    """Converts the frontend chat history format to the google-genai Content structure."""
    contents = []
    if frontend_history:
        for turn in frontend_history:
            role = turn.get("role", "user")
            if role == "ai":
                role = "model"
            
            parts_data = turn.get("parts", [])
            parts = []
            for p in parts_data:
                text = p.get("text", "")
                if text:
                    parts.append(types.Part.from_text(text=text))
            
            if parts:
                contents.append(types.Content(role=role, parts=parts))
                
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=latest_message)]))
    return contents


class AIRequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "online", "model": MODEL_NAME}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/api/chat':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode('utf-8'))
                return

            user_message = data.get("message", "")
            current_tasks = data.get("tasks", [])
            frontend_history = data.get("history", [])
            
            # Reset actions queue for this request
            global frontend_actions
            frontend_actions = []

            # Format current tasks list as context for the assistant
            tasks_context = "Current tasks in the planner:\n"
            if current_tasks:
                for idx, t in enumerate(current_tasks):
                    tasks_context += (
                        f"- ID: {t.get('id')}\n"
                        f"  Title: {t.get('title')}\n"
                        f"  Description: {t.get('description', '')}\n"
                        f"  DueDate: {t.get('dueDate', 'No due date')}\n"
                        f"  Priority: {t.get('priority', 'Medium')}\n"
                        f"  Status: {t.get('status', 'Pending')}\n"
                        f"  Labels: {', '.join(t.get('labels', []))}\n"
                    )
            else:
                tasks_context += "(No tasks in the planner currently)\n"

            system_prompt = (
                "You are the Retro Planner AI assistant, an agent built into a premium physical organizer and corkboard planner desk setup.\n"
                "Your role is to help the user manage their tasks/memos. You can add, update, delete, or list tasks using the tools provided.\n"
                "If the user asks you to write, pin, schedule, reschedule, check off, complete, or crumple/delete a task, call the appropriate tool.\n"
                "Be polite, helpful, and matching the nostalgic typewriter/leather desk planner aesthetic. Keep answers clear and concise.\n\n"
                f"{tasks_context}"
            )

            # Convert history to google-genai formats
            contents = convert_history(frontend_history, user_message)

            try:
                # Use generate_content with automatic function calling
                response = get_client().models.generate_content(
                    model=MODEL_NAME,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        tools=[
                            add_todo_task,
                            update_todo_task,
                            delete_todo_task
                        ],
                        temperature=0.7
                    )
                )

                response_text = response.text or ""
                print(f"Response Text: {response_text}")
                print(f"Frontend Actions: {frontend_actions}")

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "response": response_text,
                    "actions": frontend_actions
                }).encode('utf-8'))

            except Exception as e:
                import traceback
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, AIRequestHandler)
    print(f"Starting Vintage ToDo AI Server on port {PORT}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()

if __name__ == '__main__':
    # CLI sanity check option
    import sys
    if '--check' in sys.argv:
        print("server.py syntax check passed.")
        sys.exit(0)
    run_server()
