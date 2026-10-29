@echo off
setlocal
cd /d "%~dp0"
set "PYTHON_EXE=D:\Whatsapp Archive App\python\python.exe"
if not exist "%PYTHON_EXE%" (
  echo Python was not found at:
  echo %PYTHON_EXE%
  echo Edit this file and update PYTHON_EXE to your python.exe location.
  pause
  exit /b 1
)
"%PYTHON_EXE%" -m pip install -r requirements.txt
if errorlevel 1 goto error
"%PYTHON_EXE%" bitvivid_tender_tracker.py --sites gem --output "BitVivid_Tender_Tracker_GeM.xlsx" --csv "BitVivid_Tender_Tracker_GeM.csv" --gem-pages 4
if errorlevel 1 goto error
echo.
echo GeM-only tender report is complete.
pause
exit /b 0
:error
echo.
echo The tracker stopped with an error. Read the message above and share a screenshot.
pause
exit /b 1
