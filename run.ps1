.\gradlew installDebug

if ($?) { 
    [System.Console]::Beep(1000, 500)
    $v = New-Object -ComObject SAPI.SpVoice
    $v.Speak("Build sukses")
    adb shell monkey -p com.aistudio.iotdashboard.lmnxqa -c android.intent.category.LAUNCHER 1 
} else { 
    [System.Console]::Beep(300, 1500)
    $v = New-Object -ComObject SAPI.SpVoice
    $v.Speak("Build gagal") 
}