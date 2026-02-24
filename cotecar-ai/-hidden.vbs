Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\19square\Desktop\cotecar-backend-main\cotecar-ai"
WshShell.Run Chr(34) & "C:\Users\19square\Desktop\cotecar-backend-main\cotecar-ai\start-ai.bat" & Chr(34), 0
Set WshShell = Nothing
