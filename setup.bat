@echo off
echo Tworzenie i aktywowanie wirtualnego srodowiska...
cd /d "%~dp0"

python -m venv venv
call venv\Scripts\activate.bat

echo Instalowanie zaleznosci...
pip install -r requirements.txt

echo.
echo Instalacja zakonczona pomyslnie.
echo.
pause