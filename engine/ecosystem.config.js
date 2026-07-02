const path = require('path')
const ROOT = __dirname

module.exports = {
  apps: [
    {
      name: 'assistant-backend',
      cwd: path.join(ROOT, 'backend'),
      script: path.join(ROOT, 'venv', 'bin', 'python'),
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8000 --reload',
      watch: [path.join(ROOT, 'backend')],
      ignore_watch: ['__pycache__', '*.pyc', '.git'],
      env: {
        PYTHONUNBUFFERED: '1',
      },
      exp_backoff_restart_delay: 100,
    },
    {
      name: 'assistant-wakeword',
      cwd: path.join(ROOT, 'wake_word_service'),
      script: path.join(ROOT, 'venv', 'bin', 'python'),
      args: 'main.py',
      watch: [path.join(ROOT, 'wake_word_service')],
      ignore_watch: ['__pycache__', '*.pyc', '.git'],
      env: {
        PYTHONUNBUFFERED: '1',
      },
      exp_backoff_restart_delay: 100,
    },
    {
      name: 'assistant-webapp',
      cwd: path.join(ROOT, 'webapp'),
      script: path.join(ROOT, 'webapp', 'node_modules', '.bin', 'vite'),
      args: '--host 0.0.0.0',
      watch: [path.join(ROOT, 'webapp', 'src')],
      ignore_watch: ['node_modules', '.git'],
    },
  ],
}