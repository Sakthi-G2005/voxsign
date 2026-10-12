Write-Host "Building VoxSign project for GitHub Pages..."
npm run build
Copy-Item -Path ".output\public\index.html" -Destination ".output\public\404.html" -Force

Push-Location ".output\public"
git init
git config user.name "Sakthi G"
git config user.email "Sakthi-G2005@users.noreply.github.com"
git checkout -B gh-pages
git add -A
git commit -m "Deploy VoxSign to GitHub Pages"
git remote add origin https://github.com/Sakthi-G2005/voxsign.git 2>$null
git push -f origin gh-pages
Pop-Location

Write-Host "Deployment complete! Live at https://sakthi-g2005.github.io/voxsign/"
