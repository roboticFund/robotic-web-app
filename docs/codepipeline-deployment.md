# CodePipeline Deployment

The production deployment pipeline is defined in `infra/pipeline_stack.py`.

Every push to the `main` branch runs:

1. Backend smoke tests.
2. Frontend TypeScript/Vite production build.
3. CDK synthesis with Docker-based Lambda packaging.
4. Pipeline self-update when pipeline code changes.
5. Deployment of the existing `RoboticWebAppInfraStack`.
6. Production `/health` and database API smoke checks.

## One-Time GitHub Authorization

The CodeConnections resource has already been created:

```text
arn:aws:codeconnections:ap-southeast-2:302826945104:connection/acbe2646-866f-4b59-9b3d-a59bf7d7bb03
```

Complete its GitHub authorization:

1. Open the [AWS CodeConnections console](https://ap-southeast-2.console.aws.amazon.com/codesuite/settings/connections?region=ap-southeast-2).
2. Open **Developer Tools** then **Settings** then **Connections**.
3. Select `robotic-web-app-github`.
4. Choose **Update pending connection**.
5. Authorize or install **AWS Connector for GitHub**.
6. Grant access to `roboticFund/robotic-web-app`.
7. Confirm the connection status is **Available**.

The GitHub organization owner may need to approve the GitHub App installation.

Verify from PowerShell:

```powershell
aws codeconnections get-connection `
  --connection-arn arn:aws:codeconnections:ap-southeast-2:302826945104:connection/acbe2646-866f-4b59-9b3d-a59bf7d7bb03 `
  --region ap-southeast-2 `
  --profile daniel-robotic-fund `
  --query "Connection.ConnectionStatus" `
  --output text
```

## Pipeline Deployment

`RoboticWebAppPipelineStack` and the `robotic-web-app-prod` pipeline have already
been deployed. These commands are only needed if the pipeline stack must be
recreated:

```powershell
cd infra
.\.venv\Scripts\Activate.ps1

cdk diff RoboticWebAppPipelineStack `
  --app "python pipeline_app.py" `
  --profile daniel-robotic-fund

cdk deploy RoboticWebAppPipelineStack `
  --app "python pipeline_app.py" `
  --profile daniel-robotic-fund
```

## Start Automatic Deployment

Commit and push the pipeline files and application changes:

```powershell
git status
git add README.md docs/codepipeline-deployment.md infra/README.md infra/app.py infra/application_stage.py infra/asset_staging.py infra/cdk.json infra/pipeline_app.py infra/pipeline_stack.py infra/robotic_web_app_infra_stack.py
git commit -m "Add AWS CodePipeline deployment"
git push origin main
```

The push starts the `robotic-web-app-prod` pipeline automatically.

Check its status:

```powershell
aws codepipeline get-pipeline-state `
  --name robotic-web-app-prod `
  --region ap-southeast-2 `
  --profile daniel-robotic-fund `
  --query "stageStates[].{Stage:stageName,Status:latestExecution.status}" `
  --output table
```

After the initial setup, normal deployments are:

```powershell
git add <CHANGED_FILES>
git commit -m "<COMMIT_MESSAGE>"
git push origin main
```

Do not run `cdk deploy` for routine application releases.
