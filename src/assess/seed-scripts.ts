import { BASELINE_CHECKS } from './baseline-checks';

const titles = BASELINE_CHECKS.map(
  (check) => `'${check.id}'='${check.title.replace(/'/g, "''")}'`,
).join(';');

export const BASELINE_ASSESS = `
$titles = @{ ${titles} }
$findings = @()
function Add-Finding([string]$Id, [string]$Status, [string]$Detail) {
  $script:findings += [pscustomobject]@{
    id = $Id
    title = $titles[$Id]
    status = $Status
    detail = $Detail
  }
}
function Skip-Rest {
  param([string[]]$Done)
  foreach ($id in $titles.Keys) {
    if ($Done -notcontains $id) {
      Add-Finding $id 'skip' 'not_collected'
    }
  }
}
$done = @()
try {
  $cfg = Join-Path $env:TEMP ('nxsec-' + [guid]::NewGuid().ToString() + '.inf')
  secedit /export /cfg $cfg /quiet | Out-Null
  $inf = Get-Content -LiteralPath $cfg -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $cfg -Force -ErrorAction SilentlyContinue
  $len = ($inf | Select-String 'MinimumPasswordLength\\s*=\\s*(\\d+)').Matches.Groups[1].Value
  $hist = ($inf | Select-String 'PasswordHistorySize\\s*=\\s*(\\d+)').Matches.Groups[1].Value
  $comp = ($inf | Select-String 'PasswordComplexity\\s*=\\s*(\\d+)').Matches.Groups[1].Value
  $lock = ($inf | Select-String 'LockoutBadCount\\s*=\\s*(\\d+)').Matches.Groups[1].Value
  Add-Finding 'password_complexity' $(if ([int]$comp -eq 1) { 'pass' } else { 'fail' }) "value=$comp"
  Add-Finding 'min_password_length' $(if ([int]$len -ge 14) { 'pass' } else { 'fail' }) "value=$len"
  Add-Finding 'password_history' $(if ([int]$hist -ge 10) { 'pass' } else { 'fail' }) "value=$hist"
  Add-Finding 'account_lockout' $(if ([int]$lock -gt 0) { 'pass' } else { 'fail' }) "value=$lock"
  $done += 'password_complexity','min_password_length','password_history','account_lockout'
} catch {
  foreach ($id in @('password_complexity','min_password_length','password_history','account_lockout')) {
    Add-Finding $id 'skip' $_.Exception.Message
    $done += $id
  }
}
try {
  $guest = Get-LocalUser -Name 'Guest' -ErrorAction SilentlyContinue
  Add-Finding 'guest_disabled' $(if ($guest -and -not $guest.Enabled) { 'pass' } else { 'fail' }) $(if ($guest) { "enabled=$($guest.Enabled)" } else { 'missing' })
  $locals = Get-LocalUser -ErrorAction SilentlyContinue
  $stale = @($locals | Where-Object { $_.Enabled -and $_.Name -notin @('Administrator') -and $_.LastLogon -and ((Get-Date) - $_.LastLogon).Days -gt 90 })
  Add-Finding 'unused_local_accounts' $(if ($stale.Count -eq 0) { 'pass' } else { 'warn' }) "unused=$($stale.Count)"
  $admins = @(Get-LocalGroupMember -Group 'Administrators' -ErrorAction SilentlyContinue)
  Add-Finding 'excessive_local_admins' $(if ($admins.Count -le 3) { 'pass' } else { 'warn' }) "count=$($admins.Count)"
  $stdAdmins = @($admins | Where-Object { $_.ObjectClass -eq 'User' -and $_.Name -notmatch 'Administrator$' })
  Add-Finding 'users_not_local_admins' $(if ($stdAdmins.Count -eq 0) { 'pass' } else { 'warn' }) "extra=$($stdAdmins.Count)"
  Add-Finding 'unnecessary_admin_privs' $(if ($stdAdmins.Count -eq 0) { 'pass' } else { 'warn' }) "extra=$($stdAdmins.Count)"
  $done += 'guest_disabled','unused_local_accounts','excessive_local_admins','users_not_local_admins','unnecessary_admin_privs'
} catch {}
function Get-RegDword($Path, $Name) {
  try { (Get-ItemProperty -LiteralPath $Path -ErrorAction Stop).$Name } catch { $null }
}
$uac = Get-RegDword 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' 'EnableLUA'
Add-Finding 'uac_enabled' $(if ($uac -eq 1) { 'pass' } else { 'fail' }) "EnableLUA=$uac"
$done += 'uac_enabled'
try {
  $profiles = Get-NetFirewallProfile -ErrorAction Stop
  $on = @($profiles | Where-Object { $_.Enabled })
  Add-Finding 'firewall_enabled' $(if ($on.Count -ge 2) { 'pass' } else { 'fail' }) "enabled=$($on.Name -join ',')"
  $rules = @(Get-NetFirewallRule -Direction Inbound -Enabled True -ErrorAction SilentlyContinue)
  Add-Finding 'firewall_rules_reviewed' 'pass' "inbound_enabled=$($rules.Count)"
  Add-Finding 'excessive_inbound_rules' $(if ($rules.Count -le 80) { 'pass' } else { 'warn' }) "count=$($rules.Count)"
  $any = $false
  foreach ($rule in ($rules | Select-Object -First 200)) {
    $pf = Get-NetFirewallAddressFilter -AssociatedNetFirewallRule $rule -ErrorAction SilentlyContinue
    $pt = Get-NetFirewallPortFilter -AssociatedNetFirewallRule $rule -ErrorAction SilentlyContinue
    if ($pf.RemoteAddress -eq 'Any' -and $pt.LocalPort -eq 'Any' -and $pt.Protocol -eq 'Any') { $any = $true; break }
  }
  Add-Finding 'any_any_inbound' $(if ($any) { 'fail' } else { 'pass' }) ''
  $done += 'firewall_enabled','firewall_rules_reviewed','excessive_inbound_rules','any_any_inbound'
} catch {
  Add-Finding 'firewall_enabled' 'skip' $_.Exception.Message
  $done += 'firewall_enabled'
}
try {
  $mp = Get-MpComputerStatus -ErrorAction Stop
  Add-Finding 'defender_realtime' $(if ($mp.RealTimeProtectionEnabled) { 'pass' } else { 'fail' }) ''
  Add-Finding 'defender_tamper' $(if ($mp.IsTamperProtected) { 'pass' } else { 'fail' }) ''
  Add-Finding 'defender_enabled' $(if ($mp.AntivirusEnabled) { 'pass' } else { 'fail' }) ''
  $ex = @(Get-MpPreference | Select-Object -ExpandProperty ExclusionPath -ErrorAction SilentlyContinue)
  Add-Finding 'defender_exclusions' $(if ($ex.Count -le 5) { 'pass' } else { 'warn' }) "count=$($ex.Count)"
  Add-Finding 'defender_intel_updates' $(if ($mp.AntivirusSignatureAge -le 7) { 'pass' } else { 'warn' }) "sigAge=$($mp.AntivirusSignatureAge)"
  $done += 'defender_realtime','defender_tamper','defender_enabled','defender_exclusions','defender_intel_updates'
} catch {
  foreach ($id in @('defender_realtime','defender_tamper','defender_enabled','defender_exclusions','defender_intel_updates')) {
    Add-Finding $id 'skip' 'defender_unavailable'
    $done += $id
  }
}
$smb1 = Get-RegDword 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters' 'SMB1'
Add-Finding 'smbv1_enabled' $(if ($smb1 -eq 1) { 'fail' } else { 'pass' }) "SMB1=$smb1"
$sign = Get-RegDword 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters' 'RequireSecuritySignature'
Add-Finding 'smb_signing' $(if ($sign -eq 1) { 'pass' } else { 'fail' }) "RequireSecuritySignature=$sign"
$restrict = Get-RegDword 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa' 'RestrictAnonymous'
Add-Finding 'anonymous_smb' $(if ($restrict -eq 1 -or $restrict -eq 2) { 'pass' } else { 'fail' }) "RestrictAnonymous=$restrict"
Add-Finding 'null_session' $(if ($restrict -eq 1 -or $restrict -eq 2) { 'pass' } else { 'fail' }) "RestrictAnonymous=$restrict"
$done += 'smbv1_enabled','smb_signing','anonymous_smb','null_session'
$llmnr = Get-RegDword 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient' 'EnableMulticast'
Add-Finding 'llmnr_enabled' $(if ($llmnr -eq 0) { 'pass' } else { 'fail' }) "EnableMulticast=$llmnr"
$done += 'llmnr_enabled'
try {
  $nb = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=true' -ErrorAction SilentlyContinue |
    Where-Object { $_.TcpipNetbiosOptions -ne 2 }
  Add-Finding 'netbios_tcpip' $(if (-not $nb) { 'pass' } else { 'fail' }) ''
  $done += 'netbios_tcpip'
} catch { Add-Finding 'netbios_tcpip' 'skip' ''; $done += 'netbios_tcpip' }
function Ssl-Enabled($Proto) {
  $p = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\$Proto\\Server"
  $e = Get-RegDword $p 'Enabled'
  if ($null -eq $e) { return $false }
  return $e -ne 0
}
Add-Finding 'tls10_enabled' $(if (Ssl-Enabled 'TLS 1.0') { 'fail' } else { 'pass' }) ''
Add-Finding 'tls11_enabled' $(if (Ssl-Enabled 'TLS 1.1') { 'fail' } else { 'pass' }) ''
Add-Finding 'ssl3_enabled' $(if (Ssl-Enabled 'SSL 3.0') { 'fail' } else { 'pass' }) ''
$done += 'tls10_enabled','tls11_enabled','ssl3_enabled'
$scriptBlock = Get-RegDword 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\PowerShell\\ScriptBlockLogging' 'EnableScriptBlockLogging'
Add-Finding 'powershell_logging' $(if ($scriptBlock -eq 1) { 'pass' } else { 'fail' }) ''
Add-Finding 'ps_operational_logging' $(if ($scriptBlock -eq 1) { 'pass' } else { 'fail' }) ''
$psv2 = Get-WindowsOptionalFeature -Online -FeatureName MicrosoftWindowsPowerShellV2 -ErrorAction SilentlyContinue
Add-Finding 'powershell_v2' $(if ($psv2 -and $psv2.State -eq 'Enabled') { 'fail' } else { 'pass' }) "$($psv2.State)"
$done += 'powershell_logging','ps_operational_logging','powershell_v2'
try {
  $listeners = @(Get-ChildItem WSMan:\\localhost\\Listener -ErrorAction SilentlyContinue)
  Add-Finding 'winrm_restricted' $(if ($listeners.Count -gt 0) { 'pass' } else { 'warn' }) "listeners=$($listeners.Count)"
  Add-Finding 'winrm_exposed_lan' 'warn' 'review_listeners'
  $done += 'winrm_restricted','winrm_exposed_lan'
} catch { $done += 'winrm_restricted','winrm_exposed_lan'; Add-Finding 'winrm_restricted' 'skip' ''; Add-Finding 'winrm_exposed_lan' 'skip' '' }
$rdp = Get-RegDword 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server' 'fDenyTSConnections'
Add-Finding 'rdp_enabled' $(if ($rdp -eq 0) { 'warn' } else { 'pass' }) "fDenyTSConnections=$rdp"
$nla = Get-RegDword 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp' 'UserAuthentication'
Add-Finding 'rdp_nla' $(if ($nla -eq 1) { 'pass' } else { 'fail' }) "UserAuthentication=$nla"
Add-Finding 'rdp_exposed_lan' $(if ($rdp -eq 0) { 'fail' } else { 'pass' }) ''
$done += 'rdp_enabled','rdp_nla','rdp_exposed_lan'
function Svc-Bad($Name, $Id) {
  $s = Get-Service -Name $Name -ErrorAction SilentlyContinue
  Add-Finding $Id $(if ($s -and $s.Status -eq 'Running') { 'fail' } else { 'pass' }) $(if ($s) { $s.Status } else { 'absent' })
  $script:done += $Id
}
Svc-Bad 'TlntSvr' 'telnet_enabled'
Svc-Bad 'FTPSVC' 'ftp_enabled'
$watch = @('RemoteRegistry','SSDPSRV','upnphost')
$extra = @($watch | ForEach-Object { Get-Service $_ -ErrorAction SilentlyContinue } | Where-Object { $_.Status -eq 'Running' })
Add-Finding 'unnecessary_services' $(if ($extra.Count -eq 0) { 'pass' } else { 'warn' }) ($extra.Name -join ',')
$done += 'unnecessary_services'
try {
  $sb = Confirm-SecureBootUEFI -ErrorAction SilentlyContinue
  Add-Finding 'secure_boot' $(if ($sb) { 'pass' } else { 'fail' }) ''
} catch { Add-Finding 'secure_boot' 'skip' 'not_uefi' }
$done += 'secure_boot'
try {
  $tpm = Get-Tpm -ErrorAction Stop
  Add-Finding 'tpm_enabled' $(if ($tpm.TpmPresent -and $tpm.TpmReady) { 'pass' } else { 'fail' }) ''
} catch { Add-Finding 'tpm_enabled' 'skip' '' }
$done += 'tpm_enabled'
try {
  $bl = Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop
  $on = $bl.ProtectionStatus.ToString() -match 'On'
  Add-Finding 'bitlocker_enabled' $(if ($on) { 'pass' } else { 'fail' }) "$($bl.ProtectionStatus)"
  Add-Finding 'bitlocker_recovery_backup' $(if ($on) { 'warn' } else { 'skip' }) 'confirm_ad_backup'
} catch {
  Add-Finding 'bitlocker_enabled' 'skip' ''
  Add-Finding 'bitlocker_recovery_backup' 'skip' ''
}
$done += 'bitlocker_enabled','bitlocker_recovery_backup'
$screen = Get-RegDword 'HKCU:\\Control Panel\\Desktop' 'ScreenSaveActive'
$timeout = Get-RegDword 'HKCU:\\Control Panel\\Desktop' 'ScreenSaveTimeOut'
Add-Finding 'screen_lock' $(if ($screen -eq 1 -or $screen -eq '1') { 'pass' } else { 'warn' }) "ScreenSaveActive=$screen"
Add-Finding 'screen_lock_timeout' $(if ([int]$timeout -gt 0 -and [int]$timeout -le 900) { 'pass' } else { 'warn' }) "timeout=$timeout"
$done += 'screen_lock','screen_lock_timeout'
$wdigest = Get-RegDword 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\WDigest' 'UseLogonCredential'
Add-Finding 'wdigest_caching' $(if ($wdigest -eq 1) { 'fail' } else { 'pass' }) "UseLogonCredential=$wdigest"
$done += 'wdigest_caching'
$wu = Get-Service wuauserv -ErrorAction SilentlyContinue
Add-Finding 'windows_update_enabled' $(if ($wu -and $wu.Status -eq 'Running') { 'pass' } else { 'warn' }) "$($wu.Status)"
$done += 'windows_update_enabled'
$pend = Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired'
Add-Finding 'pending_reboot' $(if ($pend) { 'warn' } else { 'pass' }) ''
Add-Finding 'reboot_pending_updates' $(if ($pend) { 'warn' } else { 'pass' }) ''
$done += 'pending_reboot','reboot_pending_updates'
$os = Get-CimInstance Win32_OperatingSystem
$build = [int]$os.BuildNumber
Add-Finding 'windows_version_supported' $(if ($build -ge 19041) { 'pass' } else { 'fail' }) "build=$build"
Add-Finding 'architecture_supported' $(if ($os.OSArchitecture -match '64') { 'pass' } else { 'warn' }) $os.OSArchitecture
$done += 'windows_version_supported','architecture_supported'
$wifi = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' -and $_.Name -match 'Wi-Fi|Wireless' })
$isServer = $os.Caption -match 'Server'
Add-Finding 'wifi_on_server' $(if ($isServer -and $wifi.Count -gt 0) { 'warn' } else { 'pass' }) ''
$bt = Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'OK' }
Add-Finding 'bluetooth_enabled' $(if ($bt) { 'warn' } else { 'pass' }) ''
$done += 'wifi_on_server','bluetooth_enabled'
try {
  $dns = Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.ServerAddresses -and $_.ServerAddresses.Count -gt 0 }
  Add-Finding 'dns_validated' $(if ($dns) { 'pass' } else { 'warn' }) ''
  $done += 'dns_validated'
} catch { Add-Finding 'dns_validated' 'skip' ''; $done += 'dns_validated' }
try {
  $shares = Get-SmbShare -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '\\$$' }
  Add-Finding 'admin_shares' $(if ($shares) { 'warn' } else { 'pass' }) ''
  $done += 'admin_shares'
} catch { Add-Finding 'admin_shares' 'skip' ''; $done += 'admin_shares' }
Skip-Rest $done
$pass = @($findings | Where-Object status -eq 'pass').Count
$warn = @($findings | Where-Object status -eq 'warn').Count
$fail = @($findings | Where-Object status -eq 'fail').Count
$skip = @($findings | Where-Object status -eq 'skip').Count
@{
  positive = ($fail -eq 0)
  summary = "$fail fail, $warn warn, $pass pass, $skip skip"
  data = @{ findings = $findings }
} | ConvertTo-Json -Compress -Depth 6
`.trim();

export const SOFTWARE_ASSESS = `
$pkgs = @()
$paths = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
foreach ($path in $paths) {
  Get-ItemProperty $path -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.DisplayName) {
      $pkgs += [pscustomobject]@{
        name = [string]$_.DisplayName
        version = [string]$_.DisplayVersion
        publisher = [string]$_.Publisher
        uninstallKey = [string]$_.PSChildName
      }
    }
  }
}
@{ positive = $true; summary = "$($pkgs.Count) package(s)"; data = @{ packages = $pkgs } } | ConvertTo-Json -Compress -Depth 6
`.trim();

export const SOFTWARE_REMEDIATE = `
$action = [string]$NetxParams.action
$key = [string]$NetxParams.uninstallKey
$id = [string]$NetxParams.wingetId
if ($action -eq 'uninstall') {
  if ($key -notmatch '^\\{[0-9A-Fa-f-]{36}\\}$' -and $key -notmatch '^[A-Za-z0-9._-]{1,128}$') {
    @{ positive = $false; summary = 'invalid uninstall key'; data = @{} } | ConvertTo-Json -Compress
    return
  }
  if ($key -match '^\\{[0-9A-Fa-f-]{36}\\}$') {
    $p = Start-Process -FilePath "$env:SystemRoot\\System32\\msiexec.exe" -ArgumentList @('/x', $key, '/qn') -Wait -PassThru
    @{ positive = ($p.ExitCode -eq 0); summary = "msiexec exit $($p.ExitCode)"; data = @{} } | ConvertTo-Json -Compress
    return
  }
  @{ positive = $false; summary = 'unsupported uninstall key'; data = @{} } | ConvertTo-Json -Compress
  return
}
if ($action -eq 'update') {
  if ($id -notmatch '^[A-Za-z0-9._+-]{1,128}$') {
    @{ positive = $false; summary = 'no winget id'; data = @{} } | ConvertTo-Json -Compress
    return
  }
  $winget = "$env:LocalAppData\\Microsoft\\WindowsApps\\winget.exe"
  if (-not (Test-Path $winget)) {
    @{ positive = $false; summary = 'winget not available'; data = @{} } | ConvertTo-Json -Compress
    return
  }
  $p = Start-Process -FilePath $winget -ArgumentList @('upgrade','--id',$id,'--accept-package-agreements','--accept-source-agreements') -Wait -PassThru
  @{ positive = ($p.ExitCode -eq 0); summary = "winget exit $($p.ExitCode)"; data = @{} } | ConvertTo-Json -Compress
  return
}
@{ positive = $false; summary = 'unknown action'; data = @{} } | ConvertTo-Json -Compress
`.trim();

export const UPDATES_ASSESS = `
$installed = @()
try {
  Get-HotFix -ErrorAction SilentlyContinue | ForEach-Object {
    $installed += [pscustomobject]@{ kb = $_.HotFixID; title = $_.Description; installedOn = [string]$_.InstalledOn }
  }
} catch {}
$missing = @()
try {
  $s = New-Object -ComObject Microsoft.Update.Session
  $searcher = $s.CreateUpdateSearcher()
  $r = $searcher.Search('IsInstalled=0 and Type=''Software''')
  for ($i = 0; $i -lt $r.Updates.Count; $i++) {
    $u = $r.Updates.Item($i)
    $missing += [pscustomobject]@{ title = $u.Title; isSecurity = [bool]$u.MsrcSeverity }
  }
} catch {}
$secMissing = @($missing | Where-Object { $_.isSecurity -or $_.title -match 'Security' })
@{
  positive = ($secMissing.Count -eq 0)
  summary = "$($installed.Count) installed, $($missing.Count) missing ($($secMissing.Count) security)"
  data = @{ installed = $installed; missing = $missing }
} | ConvertTo-Json -Compress -Depth 6
`.trim();

export const UPDATES_REMEDIATE = `
try {
  $s = New-Object -ComObject Microsoft.Update.Session
  $searcher = $s.CreateUpdateSearcher()
  $r = $searcher.Search('IsInstalled=0 and Type=''Software''')
  $toInstall = New-Object -ComObject Microsoft.Update.UpdateColl
  for ($i = 0; $i -lt $r.Updates.Count; $i++) { [void]$toInstall.Add($r.Updates.Item($i)) }
  if ($toInstall.Count -eq 0) {
    @{ positive = $true; summary = 'no updates to install'; data = @{} } | ConvertTo-Json -Compress
    return
  }
  $down = $s.CreateUpdateDownloader(); $down.Updates = $toInstall; [void]$down.Download()
  $inst = $s.CreateUpdateInstaller(); $inst.Updates = $toInstall; $res = $inst.Install()
  @{ positive = ($res.ResultCode -eq 2); summary = "install result $($res.ResultCode)"; data = @{} } | ConvertTo-Json -Compress
} catch {
  @{ positive = $false; summary = $_.Exception.Message; data = @{} } | ConvertTo-Json -Compress
}
`.trim();

export const FIREWALL_ASSESS = `
try {
  $profiles = @(Get-NetFirewallProfile | ForEach-Object {
    [pscustomobject]@{
      name = $_.Name
      enabled = [bool]$_.Enabled
      defaultInbound = [string]$_.DefaultInboundAction
      defaultOutbound = [string]$_.DefaultOutboundAction
    }
  })
  $counts = @{}
  foreach ($p in $profiles) {
    $counts[$p.name] = @(Get-NetFirewallRule -Enabled True -PolicyStore ActiveStore -ErrorAction SilentlyContinue |
      Where-Object { $_.Profile -match $p.name }).Count
  }
  $domainOn = ($profiles | Where-Object { $_.name -eq 'Domain' -and $_.enabled }).Count -gt 0
  $privateOn = ($profiles | Where-Object { $_.name -eq 'Private' -and $_.enabled }).Count -gt 0
  @{
    positive = ($domainOn -and $privateOn)
    summary = 'firewall profiles'
    data = @{ profiles = $profiles; enabledRuleCounts = $counts }
  } | ConvertTo-Json -Compress -Depth 6
} catch {
  @{ positive = $false; summary = $_.Exception.Message; data = @{} } | ConvertTo-Json -Compress
}
`.trim();

export const LOCAL_USERS_ASSESS = `
$users = @()
try {
  Get-LocalUser | ForEach-Object {
    $users += [pscustomobject]@{
      name = $_.Name
      enabled = [bool]$_.Enabled
      lastLogon = [string]$_.LastLogon
      description = [string]$_.Description
    }
  }
} catch {}
@{ positive = $true; summary = "$($users.Count) local user(s)"; data = @{ users = $users } } | ConvertTo-Json -Compress -Depth 5
`.trim();

export const LOGGED_IN_ASSESS = `
$users = @()
try {
  $cs = Get-CimInstance Win32_ComputerSystem
  if ($cs.UserName) {
    $users += [pscustomobject]@{ name = $cs.UserName; session = 'console' }
  }
} catch {}
try {
  quser 2>$null | Select-Object -Skip 1 | ForEach-Object {
    $parts = ($_ -replace '\\s{2,}', '|').Split('|')
    if ($parts[0]) { $users += [pscustomobject]@{ name = $parts[0].Trim(); session = $parts[2] } }
  }
} catch {}
@{ positive = $true; summary = $(if ($users.Count) { $users[0].name } else { 'no interactive logon' }); data = @{ users = $users } } | ConvertTo-Json -Compress -Depth 5
`.trim();

export const DC_ASSESS = `
$domain = $env:USERDOMAIN
$logon = $env:LOGONSERVER
$dcName = $null
$dcAddress = $null
try {
  $part = Get-CimInstance Win32_ComputerSystem
  if ($part.PartOfDomain) { $domain = $part.Domain }
  else {
    @{ positive = $false; summary = 'workgroup'; data = @{ domain = $part.Workgroup; logonServer = $logon } } | ConvertTo-Json -Compress
    return
  }
} catch {}
try {
  $nl = nltest /dsgetdc:$domain 2>$null | Out-String
  if ($nl -match 'DC:\\s*\\\\(\\S+)') { $dcName = $Matches[1] }
  if ($nl -match 'Address:\\s*(\\S+)') { $dcAddress = $Matches[1] }
} catch {}
@{
  positive = [bool]($dcName -or $logon)
  summary = $(if ($dcName) { $dcName } elseif ($logon) { $logon } else { 'DC not found' })
  data = @{ domain = $domain; logonServer = $logon; dcName = $dcName; dcAddress = $dcAddress }
} | ConvertTo-Json -Compress -Depth 4
`.trim();
