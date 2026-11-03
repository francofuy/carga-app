# Copia la memoria de Claude y la conversación a la carpeta de proyecto de esta PC.
# Se corre desde la raíz del repo clonado: powershell -ExecutionPolicy Bypass -File .handoff/restore.ps1
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
# Claude Code nombra la carpeta del proyecto con la ruta, cambiando todo lo que no es letra o número por «-»
$name = $repo -replace '[^a-zA-Z0-9]', '-'
$dest = Join-Path $env:USERPROFILE ".claude\projects\$name"
New-Item -ItemType Directory -Force -Path (Join-Path $dest 'memory') | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'memory\*.md') (Join-Path $dest 'memory') -Force
Copy-Item (Join-Path $PSScriptRoot 'session\*.jsonl') $dest -Force
Write-Host "Listo. Memoria y conversación copiadas a: $dest"
Write-Host "Ahora, dentro de la carpeta del repo, corré: claude --resume"
