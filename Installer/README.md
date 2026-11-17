# Trade English Setup

TradeEnglish-Setup.exe is a Windows x64, per-user offline installer.
Bundled private runtimes: Microsoft.NETCore.App and Microsoft.WindowsDesktop.App 10.0.10.
Includes 1,997 MP3 files. No API calls or voice generation.
Install location: %LOCALAPPDATA%/Programs/TradeEnglish.
Desktop and Start Menu shortcuts launch the app through its bundled dotnet host.
Existing progress remains in %LOCALAPPDATA%/TradeEnglish.

Setup.cs contains the WinForms installer source, compiled with the Windows .NET Framework compiler.
The embedded payload is Build/Installer/payload.zip.
The executable is unsigned. No automatic updates or Apps & Features uninstall entry are included.
To remove it, close the app, remove the installation folder and the two Trade English shortcuts; preserve the separate progress folder if desired.
