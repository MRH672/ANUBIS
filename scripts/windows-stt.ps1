param(
  [string]$WaveFile = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$recognizer = $null

function Write-JsonLine {
  param([hashtable]$Payload)
  $Payload | ConvertTo-Json -Compress | Write-Output
  [Console]::Out.Flush()
}

try {
  Add-Type -AssemblyName System.Speech
  $culture = [System.Globalization.CultureInfo]::GetCultureInfo("en-US")
  $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
  $recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))

  if ($WaveFile -ne "") {
    $recognizer.SetInputToWaveFile($WaveFile)
    $result = $recognizer.Recognize()
    if ($null -ne $result -and $result.Text.Trim().Length -gt 0) {
      Write-JsonLine @{
        type = "result"
        text = $result.Text
        confidence = [Math]::Round($result.Confidence, 3)
      }
    } else {
      Write-JsonLine @{ type = "error"; message = "No speech recognized from selected microphone recording." }
      exit 2
    }
    exit 0
  }

  $recognizer.SetInputToDefaultAudioDevice()

  Register-ObjectEvent -InputObject $recognizer -EventName SpeechRecognized -Action {
    $result = $EventArgs.Result
    if ($null -ne $result -and $result.Confidence -ge 0.35 -and $result.Text.Trim().Length -gt 0) {
      @{
        type = "result"
        text = $result.Text
        confidence = [Math]::Round($result.Confidence, 3)
      } | ConvertTo-Json -Compress | Write-Output
      [Console]::Out.Flush()
    }
  } | Out-Null

  Register-ObjectEvent -InputObject $recognizer -EventName SpeechHypothesized -Action {
    $result = $EventArgs.Result
    if ($null -ne $result -and $result.Text.Trim().Length -gt 0) {
      @{
        type = "partial"
        text = $result.Text
      } | ConvertTo-Json -Compress | Write-Output
      [Console]::Out.Flush()
    }
  } | Out-Null

  Write-JsonLine @{ type = "listening" }
  $recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)

  while ($true) {
    Start-Sleep -Milliseconds 250
  }
} catch {
  Write-JsonLine @{ type = "error"; message = $_.Exception.Message }
  exit 1
} finally {
  if ($null -ne $recognizer) {
    $recognizer.RecognizeAsyncCancel()
    $recognizer.Dispose()
  }
}
