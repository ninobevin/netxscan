/**
 * Windows Credential Manager (GENERIC). Passwords are never written to MySQL.
 * Secrets for write/read travel on PowerShell stdin or stay in the main process.
 */
export const CRED_WRITE_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class NetXCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags;
    public uint Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredWrite(ref CREDENTIAL userCredential, uint flags);
}
"@
$raw = [Console]::In.ReadToEnd()
$data = $raw | ConvertFrom-Json
$target = [string]$data.target
$user = [string]$data.username
$pass = [string]$data.password
$comment = [string]$data.comment
if ($target -notmatch '^NetXScan/[0-9a-fA-F-]{36}$') { throw 'invalid_target' }
$bytes = [Text.Encoding]::Unicode.GetBytes($pass)
$ptr = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
$cred = New-Object NetXCred+CREDENTIAL
$cred.Type = 1
$cred.TargetName = $target
$cred.UserName = $user
$cred.Comment = $comment
$cred.CredentialBlobSize = $bytes.Length
$cred.CredentialBlob = $ptr
$cred.Persist = 2
$ok = [NetXCred]::CredWrite([ref]$cred, 0)
[Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
if (-not $ok) { throw 'cred_write_failed' }
@{ ok = $true } | ConvertTo-Json -Compress
`.trim();

export const CRED_READ_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class NetXCredRead {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags;
    public uint Type;
    public IntPtr TargetName;
    public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public IntPtr TargetAlias;
    public IntPtr UserName;
  }
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredRead(string target, uint type, int reservedFlag, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern bool CredFree(IntPtr buffer);
}
"@
$target = [string]$args[0]
if ($target -notmatch '^NetXScan/[0-9a-fA-F-]{36}$') { throw 'invalid_target' }
$ptr = [IntPtr]::Zero
$ok = [NetXCredRead]::CredRead($target, 1, 0, [ref]$ptr)
if (-not $ok) { throw 'not_found' }
$cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][NetXCredRead+CREDENTIAL])
$user = [Runtime.InteropServices.Marshal]::PtrToStringUni($cred.UserName)
$pass = $null
if ($cred.CredentialBlobSize -gt 0 -and $cred.CredentialBlob -ne [IntPtr]::Zero) {
  $bytes = New-Object byte[] $cred.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $bytes, 0, $cred.CredentialBlobSize)
  $pass = [Text.Encoding]::Unicode.GetString($bytes).TrimEnd([char]0)
}
[NetXCredRead]::CredFree($ptr) | Out-Null
@{ username = $user; password = $pass } | ConvertTo-Json -Compress
`.trim();

export const CRED_DELETE_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class NetXCredDel {
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredDelete(string target, uint type, int flags);
}
"@
$target = [string]$args[0]
if ($target -notmatch '^NetXScan/[0-9a-fA-F-]{36}$') { throw 'invalid_target' }
$ok = [NetXCredDel]::CredDelete($target, 1, 0)
if (-not $ok) { throw 'not_found' }
@{ ok = $true } | ConvertTo-Json -Compress
`.trim();

export const CRED_LIST_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class NetXCredList {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags;
    public uint Type;
    public IntPtr TargetName;
    public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public IntPtr TargetAlias;
    public IntPtr UserName;
  }
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredEnumerate(string filter, int flag, out int count, out IntPtr credentials);
  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern bool CredFree(IntPtr buffer);
}
"@
$count = 0
$ptr = [IntPtr]::Zero
$ok = [NetXCredList]::CredEnumerate('NetXScan*', 0, [ref]$count, [ref]$ptr)
$items = @()
if ($ok -and $count -gt 0) {
  for ($i = 0; $i -lt $count; $i++) {
    $credPtr = [Runtime.InteropServices.Marshal]::ReadIntPtr($ptr, $i * [IntPtr]::Size)
    $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($credPtr, [type][NetXCredList+CREDENTIAL])
    $target = [Runtime.InteropServices.Marshal]::PtrToStringUni($cred.TargetName)
    $user = [Runtime.InteropServices.Marshal]::PtrToStringUni($cred.UserName)
    $comment = [Runtime.InteropServices.Marshal]::PtrToStringUni($cred.Comment)
    $items += @{ target = $target; username = $user; label = $comment }
  }
  [NetXCredList]::CredFree($ptr) | Out-Null
}
@{ credentials = @($items) } | ConvertTo-Json -Compress -Depth 5
`.trim();
