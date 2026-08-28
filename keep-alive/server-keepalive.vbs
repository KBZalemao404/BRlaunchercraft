' Silent Server Keep-Alive for Minecraft Launcher
' Runs in background, pings server every 60 seconds
' Installed via Task Scheduler on Windows boot

Dim http, url, response, fso, logFile
Set http = CreateObject("MSXML2.XMLHTTP")
Set fso = CreateObject("Scripting.FileSystemObject")

url = "https://minecraft-launcher-updates.vercel.app/api/heartbeat"
Dim logPath
logPath = CreateObject("WScript.Shell").ExpandEnvironmentStrings("%APPDATA%") & "\minecraft-launcher\keepalive.log"

Sub WriteLog(msg)
    On Error Resume Next
    Dim stream
    Set stream = fso.OpenTextFile(logPath, 8, True) ' 8 = ForAppending
    stream.WriteLine "[" & Now & "] " & msg
    stream.Close
End Sub

WriteLog "Keep-Alive service started"

' Loop forever, ping every 60 seconds
Do
    On Error Resume Next
    http.Open "POST", url, False
    http.setRequestHeader "Content-Type", "application/json"
    http.send "{""version"":""keepalive-service"",""platform"":""windows-task-scheduler""}"
    
    If Err.Number = 0 Then
        If http.Status = 200 Then
            WriteLog "Ping OK (HTTP " & http.Status & ")"
        Else
            WriteLog "Ping HTTP " & http.Status
        End If
    Else
        WriteLog "Ping error: " & Err.Description
        Err.Clear
    End If
    
    WScript.Sleep 60000 ' 60 seconds
Loop
