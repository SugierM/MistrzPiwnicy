@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion

echo.
echo ==========================================
echo Uruchamianie aplikacji Flask...
echo ==========================================

:: Aktywuj virtualenv
call venv\Scripts\activate.bat

:: Wyszukaj tylko prywatne IPv4 (192.168.x.x lub 10.x.x.x)
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr "IPv4" ^| findstr /R "192\.168\. 10\."') do (
    set "LOCALIP=%%A"
    set "LOCALIP=!LOCALIP: =!"
    goto FOUNDIP
)
:FOUNDIP

echo.
echo Dostepne adresy aplikacji:
echo ------------------------------------------
echo Na tym komputerze:   http://127.0.0.1:5000
echo Na innym urzadzeniu: http://!LOCALIP!:5000
echo ------------------------------------------

:: Otworz aplikacje w przegladarce lokalnie
start "" http://127.0.0.1:5000

:: Uruchom Flask
python app.py

echo.
echo Serwer Flask zostal zatrzymany.
pause