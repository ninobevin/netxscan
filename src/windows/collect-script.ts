/**
 * Fixed collection and uninstall scripts. Never concatenate user input
 * into these strings. Host and uninstall keys are passed as process arguments.
 */
export const WINDOWS_COLLECT_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
function TryGet([scriptblock]$Block) { try { & $Block } catch { $null } }

$os = TryGet { Get-CimInstance Win32_OperatingSystem }
$cs = TryGet { Get-CimInstance Win32_ComputerSystem }
$cpu = TryGet { Get-CimInstance Win32_Processor | Select-Object -First 1 }
$disks = @(TryGet {
  Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
    Select-Object DeviceID,
      @{n='sizeGb';e={ if ($_.Size) { [math]::Round($_.Size/1GB,1) } else { $null } }},
      @{n='freeGb';e={ if ($_.FreeSpace) { [math]::Round($_.FreeSpace/1GB,1) } else { $null } }}
})
$software = @(TryGet {
  $paths = @(
    'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
  )
  Get-ItemProperty $paths |
    Where-Object { $_.DisplayName } |
    Sort-Object DisplayName
})
$updates = @(TryGet {
  Get-HotFix |
    Sort-Object InstalledOn -Descending |
    Select-Object -First 25 HotFixID, InstalledOn
})
$firewall = @(TryGet {
  Get-NetFirewallProfile | Select-Object Name, Enabled
})
$defender = TryGet { Get-MpComputerStatus }
$bitlocker = @(TryGet {
  Get-BitLockerVolume | Select-Object MountPoint, ProtectionStatus
})

$result = [ordered]@{
  hostname = $env:COMPUTERNAME
  operatingSystem = $os.Caption
  osVersion = $os.Version
  domain = $cs.Domain
  cpu = $cpu.Name
  ramGb = if ($cs.TotalPhysicalMemory) { [math]::Round($cs.TotalPhysicalMemory/1GB,1) } else { $null }
  disks = @($disks | ForEach-Object { @{ device = $_.DeviceID; sizeGb = $_.sizeGb; freeGb = $_.freeGb } })
  software = @($software | ForEach-Object {
    @{
      name = $_.DisplayName
      version = $_.DisplayVersion
      key = $_.PSChildName
      canUninstall = [bool]($_.QuietUninstallString -or $_.UninstallString -or $_.WindowsInstaller -eq 1)
    }
  })
  updates = @($updates | ForEach-Object { @{ id = $_.HotFixID; installedOn = if ($_.InstalledOn) { $_.InstalledOn.ToString('s') } else { $null } } })
  firewall = @($firewall | ForEach-Object { @{ name = $_.Name; enabled = [bool]$_.Enabled } })
  defenderEnabled = if ($defender) { [bool]$defender.AntivirusEnabled } else { $null }
  defenderRealtime = if ($defender) { [bool]$defender.RealTimeProtectionEnabled } else { $null }
  bitlocker = @($bitlocker | ForEach-Object { @{ mountPoint = $_.MountPoint; protection = [string]$_.ProtectionStatus } })
}
$result | ConvertTo-Json -Compress -Depth 6
`.trim();

export const WINDOWS_UNINSTALL_LOOKUP_SCRIPT = `
$ErrorActionPreference = 'Stop'
$Key = [string]$args[0]
if ($Key -notmatch '^[A-Za-z0-9._\\-{}]{1,128}$') { throw 'invalid_key' }

$hives = @(
  "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\$Key",
  "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\$Key"
)
$item = $null
foreach ($path in $hives) {
  if (Test-Path -LiteralPath $path) {
    $item = Get-ItemProperty -LiteralPath $path
    break
  }
}
if (-not $item) { throw 'not_found' }

@{
  windowsInstaller = [bool]($item.WindowsInstaller -eq 1)
  quiet = [string]$item.QuietUninstallString
  uninstall = [string]$item.UninstallString
} | ConvertTo-Json -Compress
`.trim();

export const WINDOWS_UNINSTALL_SCRIPT = `
$ErrorActionPreference = 'Stop'
$Key = [string]$args[0]
if ($Key -notmatch '^[A-Za-z0-9._\\-{}]{1,128}$') { throw 'invalid_key' }

$hives = @(
  "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\$Key",
  "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\$Key"
)
$item = $null
foreach ($path in $hives) {
  if (Test-Path -LiteralPath $path) {
    $item = Get-ItemProperty -LiteralPath $path
    break
  }
}
if (-not $item) { throw 'not_found' }

$guid = $null
if ($Key -match '^\\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\\}$') {
  $guid = $Key
}
$msi = [bool]($item.WindowsInstaller -eq 1)
$quiet = [string]$item.QuietUninstallString
$uninst = [string]$item.UninstallString
$msiexec = "$env:SystemRoot\\System32\\msiexec.exe"

function GuidFrom([string]$text) {
  if ($text -match '\\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\\}') {
    return $Matches[0]
  }
  return $null
}

$exit = 0
if ($msi -or $guid) {
  if (-not $guid) { $guid = GuidFrom $quiet }
  if (-not $guid) { $guid = GuidFrom $uninst }
  if (-not $guid) { throw 'unsupported' }
  $process = Start-Process -FilePath $msiexec -ArgumentList @('/x', $guid, '/qn', '/norestart') -Wait -PassThru -WindowStyle Hidden
  $exit = $process.ExitCode
} elseif ($quiet -and ($quiet -match 'msiexec')) {
  $guid = GuidFrom $quiet
  if (-not $guid) { throw 'unsupported' }
  $process = Start-Process -FilePath $msiexec -ArgumentList @('/x', $guid, '/qn', '/norestart') -Wait -PassThru -WindowStyle Hidden
  $exit = $process.ExitCode
} elseif ($quiet -match '^"([^"]+\\.exe)"\\s*(.*)$') {
  $exe = $Matches[1]
  $rest = $Matches[2].Trim()
  $base = [System.IO.Path]::GetFileName($exe).ToLowerInvariant()
  if ($base -in @('cmd.exe', 'powershell.exe', 'pwsh.exe', 'wscript.exe', 'cscript.exe', 'mshta.exe')) {
    throw 'unsupported'
  }
  if ($rest) {
    $process = Start-Process -FilePath $exe -ArgumentList $rest -Wait -PassThru -WindowStyle Hidden
  } else {
    $process = Start-Process -FilePath $exe -Wait -PassThru -WindowStyle Hidden
  }
  $exit = $process.ExitCode
} else {
  throw 'unsupported'
}

if ($exit -ne 0 -and $exit -ne 3010 -and $exit -ne 1605 -and $exit -ne 1641) {
  throw ('uninstall_failed:' + $exit)
}
@{ ok = $true; exitCode = $exit } | ConvertTo-Json -Compress
`.trim();
