@echo off
rem Starts CIS Client. The first run creates a private Python environment in .venv.
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
	echo Setting up ^(first run only^)...
	where py >nul 2>nul && (py -3 -m venv .venv) || (python -m venv .venv)
	if not exist ".venv\Scripts\python.exe" (
		echo Python 3.9 or newer is required: https://www.python.org/downloads/
		pause
		exit /b 1
	)
)

if not exist ".venv\.installed" (
	".venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check --upgrade pip
	".venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r requirements.txt
	if errorlevel 1 (
		pause
		exit /b 1
	)
	type nul > ".venv\.installed"
)

".venv\Scripts\python.exe" -m cis_client %*
if errorlevel 1 pause
