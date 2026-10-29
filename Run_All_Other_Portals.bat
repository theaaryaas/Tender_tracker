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
"%PYTHON_EXE%" bitvivid_tender_tracker.py --sites central,psu,uttarakhand,rajasthan,bihar,uttar_pradesh,madhya_pradesh,maharashtra,cotton,defence,ihmcl,nhai,edcil,himachal_pradesh,jharkhand,west_bengal,west_bengal_new,odisha,haryana,cpwd,cpwd_direct,railtel --output "BitVivid_Tender_Tracker_Other_Portals.xlsx" --csv "BitVivid_Tender_Tracker_Other_Portals.csv" --delay 1.0
if errorlevel 1 goto error
echo.
echo Non-GeM multi-portal tender report is complete.
echo Check the Search Errors worksheet and verify each tender on its official portal.
pause
exit /b 0
:error
echo.
echo The tracker stopped with an error. Read the message above and share a screenshot.
pause
exit /b 1
