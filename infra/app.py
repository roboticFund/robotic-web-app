#!/usr/bin/env python3
import os
import aws_cdk as cdk

from robotic_web_app_infra_stack import RoboticWebAppInfraStack

app = cdk.App()
RoboticWebAppInfraStack(
    app,
    "RoboticWebAppInfraStack",
    env=cdk.Environment(
        account=os.getenv("CDK_DEFAULT_ACCOUNT"),
        region=os.getenv("CDK_DEFAULT_REGION", "ap-southeast-2"),
    ),
)

app.synth()
