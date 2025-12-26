$file = 'src\App.tsx'
$content = Get-Content $file -Raw

$oldText = '"/support"
    ]);'

$newText = '"/support",
      "/store",
      "/coins"
    ]);'

$newContent = $content.Replace($oldText, $newText)
Set-Content $file $newContent -Encoding UTF8
Write-Host "File updated successfully"
