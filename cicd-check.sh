# Run deploy.sh in the background and log output to a file

: > post-commit.log

nohup ./deploy.sh > post-commit.log 2>&1 &
echo "🚀 [POST-COMMIT] Deployment started in background! Check deploy.log for progress."