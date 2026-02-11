param(
    [int]$Port = 8080,
    [string]$Path = "/app/index.html",
    [string]$WslDistro = "",
    [switch]$KeepOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).
        IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    if (-not $isAdmin) {
        $argList = @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", "`"$PSCommandPath`"",
            "-Port", $Port,
            "-Path", "`"$Path`""
        )

        if ($WslDistro) {
            $argList += @("-WslDistro", "`"$WslDistro`"")
        }
        if ($KeepOpen) {
            $argList += "-KeepOpen"
        }

        $startArgs = @{
            FilePath     = "powershell.exe"
            Verb         = "RunAs"
            ArgumentList = $argList
        }
        if ($KeepOpen) {
            $startArgs.ArgumentList = @("-NoExit") + $argList
        }

        Start-Process @startArgs | Out-Null
        exit 0
    }
}

function Get-WslIp {
    if ($WslDistro) {
        $wslIp = (wsl -d $WslDistro hostname -I 2>$null | ForEach-Object { $_.Trim() })
    } else {
        $wslIp = (wsl hostname -I 2>$null | ForEach-Object { $_.Trim() })
    }

    if (-not $wslIp) {
        throw "无法读取 WSL 的 IP。请确认已安装 WSL 且至少有一个发行版正在运行。"
    }

    return ($wslIp -split "\s+")[0]
}

function Get-WindowsLanIp {
    $defaultRoute = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix "0.0.0.0/0" |
        Sort-Object -Property RouteMetric, InterfaceMetric |
        Select-Object -First 1

    if (-not $defaultRoute) {
        throw "无法检测到默认 IPv4 路由。"
    }

    $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $defaultRoute.InterfaceIndex |
        Where-Object {
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*"
        } |
        Select-Object -First 1 -ExpandProperty IPAddress

    if (-not $ip) {
        throw "无法检测到 Windows 局域网 IP。"
    }

    return $ip
}

Ensure-Admin

$wslIp = Get-WslIp
$winIp = Get-WindowsLanIp
$ruleName = "WSL 端口 $Port"

Write-Host "WSL IP：$wslIp"
Write-Host "Windows 局域网 IP：$winIp"
Write-Host "正在配置 $Port 端口的 portproxy ..."

netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=$Port | Out-Null
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$Port connectaddress=$wslIp connectport=$Port | Out-Null

Write-Host "正在配置 Windows 防火墙规则 '$ruleName' ..."
netsh advfirewall firewall delete rule name="$ruleName" | Out-Null
netsh advfirewall firewall add rule name="$ruleName" dir=in action=allow protocol=TCP localport=$Port | Out-Null

$normalizedPath = if ($Path.StartsWith("/")) { $Path } else { "/$Path" }
$url = "http://${winIp}:${Port}${normalizedPath}"

Write-Host ""
Write-Host "完成。"
Write-Host "请确保 WSL Web 服务已监听 0.0.0.0:$Port，然后在手机上打开："
Write-Host $url
