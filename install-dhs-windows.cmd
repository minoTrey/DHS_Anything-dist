@echo off
echo DHS - Windows 설치를 시작합니다...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; iex ((iwr 'https://raw.githubusercontent.com/minoTrey/DHS_Anything-dist/main/install-dhs-windows.ps1' -UseBasicParsing).Content)"
echo.
pause
