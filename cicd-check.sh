# Run deploy.sh in the background and log output to a file

: > deploy.log

nohup ./deploy.sh > deploy.log 2>&1 &
echo "🚀 [POST-COMMIT] Deployment started in background! Check deploy.log for progress."