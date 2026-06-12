#!/usr/bin/env python3
import os
from pathlib import Path

import aws_cdk as cdk

from asset_staging import prepare_frontend_dist

prepare_frontend_dist(Path(__file__).resolve().parents[1])

from pipeline_stack import RoboticWebAppPipelineStack


app = cdk.App()
RoboticWebAppPipelineStack(
    app,
    "RoboticWebAppPipelineStack",
    env=cdk.Environment(
        account=os.getenv("CDK_DEFAULT_ACCOUNT"),
        region=os.getenv("CDK_DEFAULT_REGION", "ap-southeast-2"),
    ),
)

app.synth()
