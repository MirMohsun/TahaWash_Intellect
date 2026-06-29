# Allow inbound TCP 1883 for Mosquitto (Pico on LAN → Docker on Windows host).
# Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File scripts/open-mqtt-firewall.ps1

$ruleName = "Tahawash Mosquitto MQTT 1883"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Rule already exists: $ruleName"
    exit 0
}

New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 1883 `
    -Profile Private

Write-Host "Created firewall rule: $ruleName (Private profile)"
